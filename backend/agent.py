import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib import request
from urllib.parse import urlparse

from backend.server import normalize_state


ALLOWED_PATCH_FIELDS = {
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
    "papers",
}


@dataclass
class AgentConfig:
    api_key: str = ""
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    model: str = "qwen-plus"
    app_base_url: str = ""
    app_id: str = ""

    @classmethod
    def from_env(cls):
        app_base_url, app_id = parse_app_url(os.environ.get("MINSCIFI_QWEN_APP_URL", ""))
        return cls(
            api_key=os.environ.get("DASHSCOPE_API_KEY", ""),
            base_url=os.environ.get("MINSCIFI_QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            model=os.environ.get("MINSCIFI_QWEN_MODEL", "qwen-plus"),
            app_base_url=os.environ.get("MINSCIFI_QWEN_APP_BASE_URL", app_base_url),
            app_id=os.environ.get("MINSCIFI_QWEN_APP_ID", app_id),
        )

    def public_summary(self):
        return {
            "configured": bool(self.api_key),
            "model": self.model,
            "baseUrl": self.base_url,
            "appMode": bool(self.app_id),
            "appBaseUrl": self.app_base_url,
            "appId": self.app_id,
        }


class AgentBackend:
    def __init__(self, config=None, vault_backend=None, transport=None):
        self.config = config or AgentConfig.from_env()
        self.vault_backend = vault_backend
        self.transport = transport or self._send_http_request

    def get_config(self):
        return {"ok": True, **self.config.public_summary()}

    def handle_message(self, payload):
        if not self.config.api_key:
            raise ValueError("Qwen API key is not configured. Set DASHSCOPE_API_KEY in the local backend environment.")

        user_message = str(payload.get("message") or "").strip()
        if not user_message:
            raise ValueError("Agent message cannot be empty.")

        state = normalize_state(payload.get("state") or {})
        mode = str(payload.get("mode") or "research_shaper")
        message_id = new_id("msg")
        proposal_id = new_id("prop")

        qwen_payload = self._build_qwen_payload(
            message_id=message_id,
            mode=mode,
            user_message=user_message,
            state=state,
        )
        qwen_response = self.transport(qwen_payload)
        proposal = self._parse_qwen_response(qwen_response)
        proposal = sanitize_proposal(proposal, proposal_id=proposal_id, message_id=message_id)

        self._record_agent_exchange(
            message_id=message_id,
            proposal_id=proposal_id,
            mode=mode,
            user_message=user_message,
            state=state,
            proposal=proposal,
        )

        return proposal

    def _build_qwen_payload(self, message_id, mode, user_message, state):
        system_prompt = build_system_prompt()
        context_packet = {
            "messageId": message_id,
            "mode": mode,
            "state": state,
            "allowedPatchFields": sorted(ALLOWED_PATCH_FIELDS),
        }

        if self.config.app_id:
            app_base = self.config.app_base_url or "https://dashscope.aliyuncs.com"
            return {
                "kind": "dashscope_app",
                "url": f"{app_base.rstrip('/')}/api/v1/apps/{self.config.app_id}/completion",
                "headers": {
                    "Authorization": f"Bearer {self.config.api_key}",
                    "Content-Type": "application/json",
                },
                "body": {
                    "input": {
                        "prompt": (
                            f"{system_prompt}\n\n"
                            f"Context JSON:\n{json.dumps(context_packet, ensure_ascii=False)}\n\n"
                            f"User message:\n{user_message}"
                        )
                    }
                },
            }

        return {
            "kind": "openai_compatible",
            "url": f"{self.config.base_url.rstrip('/')}/chat/completions",
            "headers": {
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            "body": {
                "model": self.config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Context JSON:\n{json.dumps(context_packet, ensure_ascii=False)}\n\n"
                            f"User message:\n{user_message}"
                        ),
                    },
                ],
                "temperature": 0.3,
            },
        }

    def _parse_qwen_response(self, response_payload):
        content = ""
        if isinstance(response_payload, dict):
            choices = response_payload.get("choices")
            if choices:
                content = choices[0].get("message", {}).get("content", "")
            elif response_payload.get("output"):
                output = response_payload["output"]
                content = output.get("text") or output.get("content") or ""

        if not content:
            raise ValueError("Qwen response did not include text content.")

        return extract_json_object(content)

    def _send_http_request(self, qwen_payload):
        body = json.dumps(qwen_payload["body"], ensure_ascii=False).encode("utf-8")
        http_request = request.Request(
            qwen_payload["url"],
            data=body,
            headers=qwen_payload["headers"],
            method="POST",
        )
        with request.urlopen(http_request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))

    def _record_agent_exchange(self, message_id, proposal_id, mode, user_message, state, proposal):
        if not self.vault_backend or not self.vault_backend.vault_path:
            return

        now = datetime.now(timezone.utc).isoformat()
        agent_dir = self.vault_backend.vault_path / "agent"
        proposals_dir = agent_dir / "proposals"
        proposals_dir.mkdir(parents=True, exist_ok=True)

        append_jsonl(agent_dir / "conversation.jsonl", {
            "id": message_id,
            "role": "user",
            "content": user_message,
            "mode": mode,
            "createdAt": now,
        })
        append_jsonl(agent_dir / "conversation.jsonl", {
            "id": new_id("msg"),
            "role": "assistant",
            "content": proposal.get("reply", ""),
            "proposalId": proposal_id,
            "createdAt": now,
        })
        append_jsonl(agent_dir / "events.jsonl", {
            "type": "proposal_created",
            "proposalId": proposal_id,
            "basis": proposal.get("basis", []),
            "createdAt": now,
        })

        proposal_file = proposals_dir / f"{proposal_id}.json"
        proposal_file.write_text(
            json.dumps({
                "proposal": proposal,
                "stateSummary": {
                    "projectTitle": state.get("projectTitle", ""),
                    "projectStatus": state.get("projectStatus", ""),
                },
                "createdAt": now,
            }, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def build_system_prompt():
    return (
        "You are min_scifi's research companion for independent researchers. "
        "Be warm and concrete, but do not blur scientific judgment. "
        "Ask at most one clarifying question unless the user asks for brainstorming. "
        "Never invent citations, data, or results. "
        "Return one valid JSON object only, with keys: reply, intent, questions, patch, basis, riskFlags, nextAction. "
        "Every patch field must be grounded in a basis item. "
        "If evidence is missing, say it is missing."
    )


def sanitize_proposal(raw_proposal, proposal_id, message_id):
    patch = raw_proposal.get("patch") if isinstance(raw_proposal.get("patch"), dict) else {}
    safe_patch = {
        key: value
        for key, value in patch.items()
        if key in ALLOWED_PATCH_FIELDS
    }

    basis = raw_proposal.get("basis") if isinstance(raw_proposal.get("basis"), list) else []
    if not basis:
        basis = [{"type": "user_message", "id": message_id}]

    return {
        "ok": True,
        "proposalId": proposal_id,
        "reply": str(raw_proposal.get("reply") or ""),
        "intent": str(raw_proposal.get("intent") or "general_research_support"),
        "questions": normalize_string_list(raw_proposal.get("questions")),
        "patch": safe_patch,
        "basis": basis,
        "riskFlags": normalize_string_list(raw_proposal.get("riskFlags")),
        "nextAction": str(raw_proposal.get("nextAction") or ""),
    }


def normalize_string_list(value):
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def extract_json_object(text):
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)
    elif not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            cleaned = cleaned[start:end + 1]

    return json.loads(cleaned)


def parse_app_url(app_url):
    value = str(app_url or "").strip()
    if not value:
        return "", ""

    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return "", value.strip("/")

    parts = [part for part in parsed.path.split("/") if part]
    app_id = parts[-1] if parts else ""
    return f"{parsed.scheme}://{parsed.netloc}", app_id


def append_jsonl(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
