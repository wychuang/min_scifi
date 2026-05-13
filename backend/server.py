import argparse
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


FIELDS = [
    "projectStatus",
    "projectTitle",
    "researchQuestion",
    "domain",
    "targetDate",
    "hypothesis",
    "expectedResult",
    "falsification",
    "method",
    "dailyLog",
    "outline",
    "weeklyReview",
    "quietMode",
    "vaultPathHint",
]


DEFAULT_STATE = {
    "projectStatus": "draft",
    "projectTitle": "",
    "researchQuestion": "",
    "domain": "",
    "targetDate": "",
    "hypothesis": "",
    "expectedResult": "",
    "falsification": "",
    "method": "",
    "dailyLog": "",
    "outline": "",
    "weeklyReview": "",
    "quietMode": False,
    "vaultPathHint": "",
    "papers": [],
}


class VaultBackend:
    def __init__(self, config_path=None, vault_path=None):
        self.config_path = Path(config_path or Path(__file__).with_name(".min_scifi_backend.json"))
        self._vault_path = None
        self._load_config()
        if vault_path:
            self.set_vault_path(vault_path)

    @property
    def vault_path(self):
        return self._vault_path

    def get_config(self):
        return {
            "ok": True,
            "vaultPath": str(self._vault_path) if self._vault_path else "",
        }

    def set_vault_path(self, vault_path):
        path_text = str(vault_path or "").strip()
        if not path_text:
            raise ValueError("Vault path cannot be empty.")

        path = Path(path_text).expanduser()
        if not path.is_absolute():
            path = path.resolve()

        path.mkdir(parents=True, exist_ok=True)
        self._vault_path = path
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            json.dumps({"vaultPath": str(path)}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return self.get_config()

    def save_state(self, raw_state):
        if not self._vault_path:
            raise ValueError("Vault path is not configured.")

        state = normalize_state(raw_state)
        files = build_vault_files(state)
        for relative_path, content in files:
            target = self._vault_path / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        return {
            "ok": True,
            "vaultPath": str(self._vault_path),
            "fileCount": len(files),
        }

    def load_state(self):
        if not self._vault_path:
            raise ValueError("Vault path is not configured.")

        project_file = self._vault_path / "project.json"
        if not project_file.exists():
            return {"ok": True, "state": normalize_state({})}

        project = json.loads(project_file.read_text(encoding="utf-8"))
        return {"ok": True, "state": project_json_to_state(project)}

    def _load_config(self):
        if not self.config_path.exists():
            return

        try:
            config = json.loads(self.config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return

        vault_path = str(config.get("vaultPath") or "").strip()
        if vault_path:
            self._vault_path = Path(vault_path)


def normalize_state(saved_state):
    normalized = {**DEFAULT_STATE, "papers": []}
    if not isinstance(saved_state, dict):
        return normalized

    for field in FIELDS:
        if field == "quietMode":
            normalized[field] = bool(saved_state.get(field))
        elif saved_state.get(field) is not None:
            normalized[field] = str(saved_state.get(field))

    papers = saved_state.get("papers")
    if isinstance(papers, list):
        normalized["papers"] = [normalize_paper(paper) for paper in papers]

    return normalized


def normalize_paper(paper):
    if not isinstance(paper, dict):
        return {"title": "", "note": ""}

    return {
        "title": str(paper.get("title") or ""),
        "note": str(paper.get("note") or ""),
    }


def build_project_json(state):
    return {
        "schemaVersion": 1,
        "app": "min_scifi",
        "project": {
            "status": state["projectStatus"],
            "title": state["projectTitle"],
            "question": state["researchQuestion"],
            "domain": state["domain"],
            "targetDate": state["targetDate"],
        },
        "preregistration": {
            "hypothesis": state["hypothesis"],
            "expectedResult": state["expectedResult"],
            "falsification": state["falsification"],
            "method": state["method"],
        },
        "literature": state["papers"],
        "logs": {
            "daily": state["dailyLog"],
            "weekly": state["weeklyReview"],
        },
        "writing": {
            "outline": state["outline"],
        },
        "settings": {
            "quietMode": state["quietMode"],
            "vaultPathHint": state["vaultPathHint"],
        },
    }


def project_json_to_state(project):
    return normalize_state(
        {
            "projectStatus": project.get("project", {}).get("status", ""),
            "projectTitle": project.get("project", {}).get("title", ""),
            "researchQuestion": project.get("project", {}).get("question", ""),
            "domain": project.get("project", {}).get("domain", ""),
            "targetDate": project.get("project", {}).get("targetDate", ""),
            "hypothesis": project.get("preregistration", {}).get("hypothesis", ""),
            "expectedResult": project.get("preregistration", {}).get("expectedResult", ""),
            "falsification": project.get("preregistration", {}).get("falsification", ""),
            "method": project.get("preregistration", {}).get("method", ""),
            "dailyLog": project.get("logs", {}).get("daily", ""),
            "weeklyReview": project.get("logs", {}).get("weekly", ""),
            "outline": project.get("writing", {}).get("outline", ""),
            "quietMode": project.get("settings", {}).get("quietMode", False),
            "vaultPathHint": project.get("settings", {}).get("vaultPathHint", ""),
            "papers": project.get("literature", []),
        }
    )


def build_vault_files(state):
    return [
        ("project.json", json.dumps(build_project_json(state), ensure_ascii=False, indent=2) + "\n"),
        ("README.md", build_vault_readme(state)),
        ("preregistration/current.md", build_preregistration_markdown(state)),
        ("literature/items.json", json.dumps(state["papers"], ensure_ascii=False, indent=2) + "\n"),
        ("literature/items.md", build_literature_markdown(state)),
        ("logs/daily.md", f"# 研究日志\n\n{state['dailyLog'] or '尚未记录。'}\n"),
        ("logs/weekly.md", f"# 每周复盘\n\n{state['weeklyReview'] or '尚未复盘。'}\n"),
        ("writing/preprint-outline.md", (state["outline"] or "# 预印本骨架\n\n尚未生成。").rstrip() + "\n"),
        ("sources/README.md", build_sources_readme()),
    ]


def build_vault_readme(state):
    title = state["projectTitle"] or "未命名研究"
    question = state["researchQuestion"] or "尚未填写。"
    return "\n".join(
        [
            f"# {title}",
            "",
            "这是一个 min_scifi 外部资料库。",
            "",
            "## 研究问题",
            question,
            "",
            "## 目录",
            "",
            "- `project.json`: 机器可读的项目快照。",
            "- `preregistration/current.md`: 当前预注册内容。",
            "- `literature/`: 文献与证据笔记。",
            "- `logs/`: 日志与复盘。",
            "- `writing/`: 预印本写作材料。",
            "- `sources/`: 原始资料。应用只创建说明文件，不会改写你的资料。",
            "",
            "你可以用 Obsidian、文本编辑器、脚本或其他研究工具直接处理这个文件夹。",
            "",
        ]
    )


def build_preregistration_markdown(state):
    return "\n".join(
        [
            "# 当前预注册",
            "",
            "## 可证伪假设",
            state["hypothesis"] or "尚未填写。",
            "",
            "## 预期结果",
            state["expectedResult"] or "尚未填写。",
            "",
            "## 否证条件",
            state["falsification"] or "尚未填写。",
            "",
            "## 方法与数据",
            state["method"] or "尚未填写。",
            "",
        ]
    )


def build_literature_markdown(state):
    papers = [paper for paper in state["papers"] if paper["title"].strip() or paper["note"].strip()]
    if not papers:
        return "# 文献与证据\n\n尚未添加文献。\n"

    lines = ["# 文献与证据", ""]
    for index, paper in enumerate(papers, start=1):
        lines.extend(
            [
                f"## {index}. {paper['title'] or '未命名文献'}",
                "",
                paper["note"] or "尚未填写笔记。",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def build_sources_readme():
    return "\n".join(
        [
            "# 原始资料",
            "",
            "把 PDF、CSV、图片、实验记录、Zotero 导出或其他原始资料放在这里。",
            "",
            "min_scifi 不会删除或改写这个目录里的未知文件。",
            "",
        ]
    )


def create_handler(backend, static_root, agent_backend=None):
    from backend.agent import AgentBackend

    agent = agent_backend or AgentBackend(vault_backend=backend)

    class MinScifiHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(static_root), **kwargs)

        def do_GET(self):
            if self.path == "/api/health":
                self._send_json({"ok": True})
                return
            if self.path == "/api/vault/config":
                self._send_json(backend.get_config())
                return
            if self.path == "/api/vault/state":
                self._handle_api(lambda: backend.load_state())
                return
            if self.path == "/api/agent/config":
                self._send_json(agent.get_config())
                return
            super().do_GET()

        def do_POST(self):
            if self.path == "/api/vault/config":
                payload = self._read_json()
                self._handle_api(lambda: backend.set_vault_path(payload.get("vaultPath", "")))
                return
            if self.path == "/api/vault/state":
                payload = self._read_json()
                self._handle_api(lambda: backend.save_state(payload))
                return
            if self.path == "/api/agent/message":
                payload = self._read_json()
                self._handle_api(lambda: agent.handle_message(payload))
                return
            self.send_error(404)

        def _read_json(self):
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            return json.loads(raw or "{}")

        def _handle_api(self, callback):
            try:
                self._send_json(callback())
            except (ValueError, OSError, json.JSONDecodeError) as error:
                self._send_json({"ok": False, "error": str(error)}, status=400)

        def _send_json(self, payload, status=200):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return MinScifiHandler


def main():
    parser = argparse.ArgumentParser(description="Run the min_scifi local vault backend.")
    parser.add_argument("--vault", help="External vault directory path.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    backend = VaultBackend(vault_path=args.vault)
    server = ThreadingHTTPServer((args.host, args.port), create_handler(backend, PROJECT_ROOT))
    print(f"min_scifi backend listening at http://{args.host}:{args.port}/")
    if backend.vault_path:
        print(f"Vault path: {backend.vault_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
