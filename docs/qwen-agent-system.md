# Qwen Agent System Design

`min_scifi` should become an agent-centered research companion, not just a structured form. The form and vault are the durable memory; natural-language conversation is the humane interface that helps users who do not already think in clean research schemas.

## Design Thesis

Most independent researchers will not arrive with a precise question, falsifiable hypothesis, method, and literature map. The agent should help them grow into that structure through conversation:

1. Listen to the user's messy idea.
2. Ask one useful question at a time.
3. Extract tentative structure from the conversation.
4. Show the extracted structure as a reviewable patch.
5. Apply accepted changes to the project state and vault files.
6. Keep every important suggestion tied to an explicit basis.

The agent is not the source of truth. The external vault is the source of truth. The agent proposes, explains, and tracks.

## Qwen Integration Boundary

Use Qwen through DashScope's OpenAI-compatible chat interface from the local backend. The backend owns the API key and model configuration.

Recommended environment variables:

```text
DASHSCOPE_API_KEY=...
MINSCIFI_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MINSCIFI_QWEN_MODEL=qwen-plus
# Optional DashScope application mode:
MINSCIFI_QWEN_APP_URL=https://dashscope.aliyuncs.com/apps/anthropic
```

The frontend must never receive or store the API key. The vault must never contain the API key. Local backend config should stay in ignored runtime files.

Regional defaults:

- China Beijing: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Singapore: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- US Virginia: `https://dashscope-us.aliyuncs.com/compatible-mode/v1`

## Agent Loop

```text
User message
  -> Conversation intake
  -> Context builder
  -> Qwen agent call
  -> Response parser
  -> Patch preview
  -> User accepts / edits / rejects
  -> Project state update
  -> Vault sync
  -> Agent event log
```

### Conversation Intake

The user can speak naturally:

> 我想研究熬夜刷短视频是不是让第二天注意力下降，但我不知道怎么设计。

The UI records this as a conversation message and sends it to the backend with the current normalized state and selected vault context.

### Context Builder

The backend constructs a compact context packet:

```json
{
  "state": {
    "projectTitle": "...",
    "researchQuestion": "...",
    "hypothesis": "...",
    "method": "...",
    "papers": []
  },
  "vaultIndex": {
    "hasPreregistration": true,
    "literatureCount": 2,
    "recentLogSummary": "..."
  },
  "conversationTail": [
    {"role": "user", "content": "..."}
  ],
  "allowedPatchFields": [
    "projectTitle",
    "researchQuestion",
    "hypothesis",
    "expectedResult",
    "falsification",
    "method",
    "dailyLog",
    "weeklyReview",
    "papers"
  ]
}
```

Only include raw source content when the user explicitly selects it or asks the agent to inspect it. Raw PDFs, CSVs, and large notes should be indexed first, not blindly pasted into model context.

### Qwen Agent Call

The system prompt should force a dual output:

1. Natural response for the user.
2. Structured proposal object for the app.

The model should not directly mutate project state. It returns a proposal:

```json
{
  "reply": "你这个问题可以先收敛成一个 7 天自我观察研究...",
  "intent": "shape_research_question",
  "questions": [
    "你能每天固定做一个 10 分钟注意力测试吗？"
  ],
  "patch": {
    "researchQuestion": "连续 7 天中，睡前短视频使用时长是否与第二天 10 分钟注意力测试成绩相关？",
    "hypothesis": "如果睡前短视频使用时长增加，则第二天注意力测试成绩会下降。"
  },
  "basis": [
    {
      "type": "user_message",
      "id": "msg_2026-05-13_001",
      "quote": "熬夜刷短视频是不是让第二天注意力下降"
    }
  ],
  "riskFlags": [
    "需要定义可重复的注意力测量方式"
  ],
  "nextAction": "先决定注意力测试工具，并试跑 1 天。"
}
```

### Patch Preview

The frontend shows:

- Agent reply.
- Proposed field changes.
- Basis for each change.
- Accept, edit, or reject controls.

Accepted patches update the normalized state, then write the vault files. Rejected patches remain in the conversation log but do not alter `project.json`.

## Agent Roles

Use one orchestrating agent with mode-specific prompts rather than many independent agents.

### 1. Research Shaper

Turns vague ideas into smaller research questions.

Output focus:

- Research question candidate.
- Variables.
- Scope limits.
- One clarifying question.

### 2. Preregistration Coach

Helps write falsifiable hypotheses, expected results, falsification conditions, and methods.

Output focus:

- Field patch proposal.
- Missing-design warnings.
- One next action.

### 3. Evidence Mapper

Works with literature notes and raw-source indexes.

Output focus:

- What supports the claim.
- What contradicts the claim.
- What is still unsupported.
- Source anchors.

### 4. Writing Partner

Turns accepted project structure into draft sections.

Output focus:

- Section draft.
- Claims requiring verification.
- Citations or source anchors.
- Limitations.

### 5. Reflection Coach

Helps with weekly review without pretending to be therapy.

Output focus:

- Progress summary.
- Bottleneck.
- Next 25-minute action.
- Optional gentle reframing.

## Vault Additions

Add these files and folders when the agent layer is implemented:

```text
agent/
  conversation.jsonl
  events.jsonl
  proposals/
    2026-05-13T14-00-00-shape-question.json
  memory.md
evidence/
  claims.json
  source-index.json
```

### `agent/conversation.jsonl`

Append-only conversation log. Store user and assistant messages, but do not store secrets.

```json
{"id":"msg_001","role":"user","content":"...","createdAt":"2026-05-13T14:00:00+08:00"}
```

### `agent/events.jsonl`

Append-only action log:

```json
{"type":"proposal_created","proposalId":"prop_001","basis":["msg_001"],"createdAt":"..."}
{"type":"proposal_accepted","proposalId":"prop_001","fields":["researchQuestion","hypothesis"],"createdAt":"..."}
```

### `agent/proposals/*.json`

Exact Qwen structured output plus local validation status. This lets users audit what the agent suggested and what actually changed.

### `agent/memory.md`

Human-readable rolling summary of stable project context:

- What the project is about.
- Current hypothesis.
- Important decisions.
- Known limitations.
- User preferences about feedback style.

### `evidence/claims.json`

Claim ledger:

```json
[
  {
    "id": "claim_001",
    "text": "睡前短视频使用时长可能与第二天注意力下降相关。",
    "status": "hypothesis",
    "anchors": ["msg_001", "paper_001"],
    "needsVerification": true
  }
]
```

## Backend API Additions

Add Qwen-backed endpoints to `backend/server.py` or split into `backend/agent.py` once it grows.

```text
POST /api/agent/message
POST /api/agent/proposals/{id}/accept
POST /api/agent/proposals/{id}/reject
GET  /api/agent/timeline
```

### `POST /api/agent/message`

Request:

```json
{
  "message": "我想研究熬夜刷短视频是不是让第二天注意力下降",
  "mode": "research_shaper",
  "selectedSources": []
}
```

Response:

```json
{
  "reply": "...",
  "proposalId": "prop_001",
  "patch": {},
  "basis": [],
  "riskFlags": [],
  "nextAction": "..."
}
```

## Prompt Contract

The Qwen system prompt should include these hard rules:

1. You are a research companion for independent researchers.
2. Be warm, but do not blur scientific judgment.
3. Ask at most one clarifying question unless the user asks for brainstorming.
4. Never invent citations, data, or results.
5. Every proposed state change must include a basis.
6. If evidence is missing, mark it as missing instead of filling the gap.
7. Return valid JSON for the structured proposal.
8. Do not claim that a project is publishable; say what is ready and what is not.

## State Patch Validation

Before applying a Qwen proposal:

- Reject fields not in `allowedPatchFields`.
- Coerce all strings through the same `normalizeState()` path.
- Reject patches with no basis.
- Store proposal even if rejected.
- Require user confirmation before state changes.

## Implementation Phases

### Phase A: Local Agent Skeleton

- Add agent folders to vault serialization.
- Add conversation and proposal data structures.
- Add frontend chat panel with mock agent responses.
- Store proposals without calling Qwen.

### Phase B: Qwen Backend

- Add environment-based Qwen config.
- Add a small OpenAI-compatible HTTP client using Python standard library.
- Add `/api/agent/message`.
- Validate structured JSON response.
- Log conversation and proposals to the vault.

### Phase C: Patch Preview

- Render proposed state changes.
- Let users accept, edit, or reject.
- Apply accepted patch through `normalizeState()`.
- Sync vault after acceptance.

### Phase D: Evidence Tracking

- Add claim ledger.
- Connect literature items and source-index entries to Qwen basis objects.
- Show unsupported claims in the UI.

### Phase E: Source Processing

- Index filenames and metadata under `sources/`.
- Add opt-in text extraction for selected plain-text/Markdown/CSV files.
- Defer PDF parsing until there is a clear library choice.

## Product Feeling

The app should feel like:

- "Talk to the research companion."
- "The companion turns conversation into visible project structure."
- "Nothing important changes without my approval."
- "Every suggestion has a reason."
- "My files remain mine."

That last line is the heart of the product: the agent helps the user think, but the project lives in ordinary files that outlast the agent.

## Current Implementation Status

The first implementation pass adds:

- `backend/agent.py`: Qwen client, OpenAI-compatible request builder, optional DashScope app-mode request builder, structured JSON parser, proposal sanitizer, and vault logging.
- `POST /api/agent/message`: backend endpoint for natural-language research companion messages.
- `GET /api/agent/config`: safe config summary that does not include the API key.
- Frontend Agent panel: sends user message plus current normalized project state, then displays reply, patch draft, basis, risk flags, and next action.
- Proposal tracking in the vault backend: `agent/conversation.jsonl`, `agent/events.jsonl`, and `agent/proposals/*.json`.

Still intentionally deferred:

- User-confirmed accept/edit/reject patch application.
- Full source indexing under `sources/`.
- Live citation retrieval.
- Automatic claim ledger updates.
