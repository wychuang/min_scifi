import json
import tempfile
import unittest
from pathlib import Path

from backend.server import VaultBackend


class VaultBackendTest(unittest.TestCase):
    def test_save_state_writes_external_vault_layout(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            vault_path = temp_path / "research-vault"
            backend = VaultBackend(config_path=temp_path / "config.json")
            backend.set_vault_path(str(vault_path))

            result = backend.save_state(
                {
                    "projectStatus": "preregistered",
                    "projectTitle": "后端资料库测试",
                    "researchQuestion": "外部结构化存储是否可用？",
                    "hypothesis": "如果写入外部目录，则其他工具可以读取资料。",
                    "expectedResult": "生成 JSON 与 Markdown 文件。",
                    "falsification": "如果文件无法被普通编辑器打开，则设计失败。",
                    "method": "使用 Python 标准库写入 UTF-8 文件。",
                    "dailyLog": "今天验证后端写入。",
                    "weeklyReview": "下周处理导入。",
                    "outline": "# 后端资料库测试\n\n## 摘要\n...",
                    "quietMode": False,
                    "papers": [{"title": "paper b", "note": "note b"}],
                }
            )

            self.assertEqual(result["fileCount"], 9)
            self.assertTrue((vault_path / "project.json").exists())
            self.assertTrue((vault_path / "sources" / "README.md").exists())

            project = json.loads((vault_path / "project.json").read_text(encoding="utf-8"))
            self.assertEqual(project["project"]["title"], "后端资料库测试")
            self.assertEqual(project["literature"][0]["title"], "paper b")
            self.assertIn("原始资料", (vault_path / "sources" / "README.md").read_text(encoding="utf-8"))

    def test_rejects_empty_vault_path(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            backend = VaultBackend(config_path=Path(temp_dir) / "config.json")

            with self.assertRaises(ValueError):
                backend.set_vault_path("   ")


if __name__ == "__main__":
    unittest.main()
