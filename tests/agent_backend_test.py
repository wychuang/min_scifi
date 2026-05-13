import json
import tempfile
import unittest
from pathlib import Path

from backend.agent import AgentBackend, AgentConfig, extract_json_object, parse_app_url
from backend.server import VaultBackend


class AgentBackendTest(unittest.TestCase):
    def test_extracts_json_from_qwen_markdown_response(self):
        parsed = extract_json_object(
            """
            好的。

            ```json
            {
              "reply": "可以先收敛成 7 天观察。",
              "patch": {"researchQuestion": "短视频时长是否影响注意力？"},
              "basis": [{"type": "user_message", "id": "msg_1"}]
            }
            ```
            """
        )

        self.assertEqual(parsed["reply"], "可以先收敛成 7 天观察。")
        self.assertEqual(parsed["patch"]["researchQuestion"], "短视频时长是否影响注意力？")

    def test_parse_app_url_extracts_app_id_and_api_base(self):
        app_base, app_id = parse_app_url("https://dashscope.aliyuncs.com/apps/anthropic")

        self.assertEqual(app_base, "https://dashscope.aliyuncs.com")
        self.assertEqual(app_id, "anthropic")

    def test_agent_config_summary_does_not_include_secret(self):
        config = AgentConfig(api_key="secret-value", model="qwen-plus", app_id="anthropic")

        summary = config.public_summary()

        self.assertTrue(summary["configured"])
        self.assertEqual(summary["model"], "qwen-plus")
        self.assertNotIn("secret-value", json.dumps(summary))

    def test_agent_config_loads_local_dotenv_without_exposing_secret(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / ".env"
            env_file.write_text(
                "\n".join(
                    [
                        "DASHSCOPE_API_KEY=local-secret",
                        "MINSCIFI_QWEN_MODEL=qwen-test",
                        "MINSCIFI_QWEN_APP_URL=https://dashscope.aliyuncs.com/apps/anthropic",
                    ]
                ),
                encoding="utf-8",
            )

            config = AgentConfig.from_env(dotenv_path=env_file, environ={})

            self.assertEqual(config.api_key, "local-secret")
            self.assertEqual(config.model, "qwen-test")
            self.assertEqual(config.app_id, "anthropic")
            self.assertNotIn("local-secret", json.dumps(config.public_summary()))

    def test_generates_sanitized_patch_and_logs_to_vault(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            vault_path = Path(temp_dir) / "vault"
            vault = VaultBackend(config_path=Path(temp_dir) / "config.json")
            vault.set_vault_path(str(vault_path))

            def fake_transport(request):
                return {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "reply": "先把问题收敛成一个 7 天观察。",
                                        "intent": "shape_research_question",
                                        "questions": ["你能每天固定做一次注意力测试吗？"],
                                        "patch": {
                                            "researchQuestion": "睡前短视频使用时长是否与第二天注意力测试成绩相关？",
                                            "unknownField": "must be dropped",
                                        },
                                        "basis": [{"type": "user_message", "id": "msg_test"}],
                                        "riskFlags": ["需要定义注意力测量方式"],
                                        "nextAction": "先选择一个固定注意力测试。",
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        }
                    ]
                }

            agent = AgentBackend(
                config=AgentConfig(api_key="secret-value", model="qwen-plus"),
                vault_backend=vault,
                transport=fake_transport,
            )

            result = agent.handle_message(
                {
                    "message": "我想研究熬夜刷短视频是不是让第二天注意力下降",
                    "mode": "research_shaper",
                    "state": {"projectTitle": "短视频和注意力"},
                }
            )

            self.assertEqual(result["reply"], "先把问题收敛成一个 7 天观察。")
            self.assertIn("proposalId", result)
            self.assertEqual(
                result["patch"],
                {"researchQuestion": "睡前短视频使用时长是否与第二天注意力测试成绩相关？"},
            )
            self.assertNotIn("secret-value", json.dumps(result, ensure_ascii=False))

            proposals = list((vault_path / "agent" / "proposals").glob("*.json"))
            self.assertEqual(len(proposals), 1)
            proposal_text = proposals[0].read_text(encoding="utf-8")
            self.assertIn("睡前短视频", proposal_text)
            self.assertNotIn("secret-value", proposal_text)
            self.assertTrue((vault_path / "agent" / "conversation.jsonl").exists())


if __name__ == "__main__":
    unittest.main()
