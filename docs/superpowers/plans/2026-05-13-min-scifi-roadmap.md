# Min Scifi Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `min_scifi` from a static MVP into a trustworthy local-first workbench that helps one independent researcher push one small project from question to preprint draft.

**Architecture:** Keep the product state-first and rule-first. The durable core is a normalized local project state, deterministic review rules, evidence notes, preregistration versions, and writing outputs; optional LLM features come later and must cite the rule, paper, or user input that triggered each suggestion.

**Tech Stack:** Current stack is vanilla HTML/CSS/JavaScript, `localStorage`, Node's built-in test runner, and `scripts/check.ps1`. Future backend or framework work should be justified by real workflow pressure, not by platform ambition.

---

## Product Understanding

`min_scifi` is not a broad "civilian science operating system" and should not court the high-risk meaning of "民科". The target user is an independent researcher who accepts falsifiability, evidence, and structured feedback, but may lack a lab, advisor, or stable research routine.

The core promise is modest and strong: make one small project clearer, more testable, better documented, and easier to turn into a preprint draft. The tool should protect users from vague claims, p-hacking, literature blindness, and premature grand promises.

Anti-goals stay explicit:

- No investment matching, patent agency promises, or formal journal-submission guarantees.
- No full-web scraping.
- No "complete paper generation" without user-supplied data and source anchors.
- No opaque AI judgment; every AI suggestion must be traceable.
- No community free-for-all before the product has structured feedback rules.

## Current Stability Baseline

The current app should remain usable by opening `index.html` directly. Its basic health check is:

```powershell
.\scripts\check.ps1
```

That command verifies JavaScript syntax, Node smoke tests, and a headless browser first render. Any future task that changes UI, state, or review rules should finish by running it.

## Phase 0: Stabilize The Static MVP

**Objective:** Make the current single-page app hard to break before adding scope.

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/app-smoke.test.mjs`
- Verify: `scripts/check.ps1`

- [ ] **Task 0.1: Expand smoke coverage for core buttons**

Add tests that click `填入示例`, `生成骨架`, `添加文献`, and `删除`, then assert the state and rendered controls match. Keep the fake DOM harness local to `tests/app-smoke.test.mjs` until it becomes painful.

Run:

```powershell
node --test tests/app-smoke.test.mjs
```

Expected: all tests pass.

- [ ] **Task 0.2: Add JSON import**

Add an import button and hidden file input in `index.html`. Reuse `normalizeState()` in `app.js` so imported files go through the same safety path as `localStorage`. Imported data should replace the current project only after valid JSON is parsed.

Run:

```powershell
.\scripts\check.ps1
```

Expected: syntax, smoke tests, and headless first render pass.

- [ ] **Task 0.3: Add preregistration lock**

Add a "锁定预注册" action that stores an immutable snapshot of hypothesis, expected result, falsification, method, target date, and timestamp. The user may create a later version, but prior versions must remain readable.

Run:

```powershell
.\scripts\check.ps1
```

Expected: locked preregistration versions survive refresh and export.

## Phase 1: Make It A Real Research Workflow

**Objective:** Turn the app from a form into a small research cockpit.

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/app-smoke.test.mjs`

- [ ] **Task 1.1: Add project checklist**

Add a checklist for minimum viable research work: question, variables, data source, ethics note, preregistration, first observation, analysis note, draft outline. Store completion in state and reflect it in the side panel.

- [ ] **Task 1.2: Add timeline and next-action field**

Add a small timeline that shows target date, current status, last log update, and the next 25-minute action. This should support the existing "gentle prompt" idea without becoming a chat assistant.

- [ ] **Task 1.3: Add multi-project storage only after import/export is stable**

Move from one `localStorage` object to a project list with active project id. Preserve backwards compatibility by migrating the current single-project state into the first project.

## Phase 2: Evidence And Literature Layer

**Objective:** Help users avoid duplicate work and unsupported claims.

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/app-smoke.test.mjs`

- [ ] **Task 2.1: Split literature fields**

Replace the single title field with structured fields: title, identifier, source type, stance, and note. Keep free-form entry available so the tool stays lightweight.

- [ ] **Task 2.2: Add manual citation map**

Let users mark whether a paper supports, contradicts, contextualizes, or supplies a method. Surface a small "evidence balance" signal in the review report.

- [ ] **Task 2.3: Add optional arXiv/Zotero lookup**

Only after manual literature notes work well, add optional metadata lookup. Do not add broad web scraping.

## Phase 3: Writing Output With Source Anchors

**Objective:** Make the generated outline become a usable preprint draft workspace.

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/app-smoke.test.mjs`

- [ ] **Task 3.1: Split outline into sections**

Store abstract, introduction, related work, method, results, discussion, and limitations as separate state fields. Preserve Markdown export.

- [ ] **Task 3.2: Require source anchors for generated claims**

Each generated or suggested claim should point to a user note, preregistration field, result entry, or literature item. If there is no anchor, label the claim as "需要用户核对".

- [ ] **Task 3.3: Export Markdown**

Add a Markdown export separate from JSON backup. The export must include preregistration version, literature list, and limitations.

## Phase 4: Optional LLM Review

**Objective:** Add AI only where deterministic rules stop being enough.

**Files:**
- Create: `llm/` or backend files only after an API boundary is chosen.
- Modify: `app.js` only for client-side integration after privacy copy exists.
- Test: add mocked request tests before real API calls.

- [ ] **Task 4.1: Define the AI trust contract**

Before implementation, write visible product copy explaining what data leaves the browser, what is stored, and that AI suggestions are fallible.

- [ ] **Task 4.2: Add traceable review output**

Every AI suggestion must include `basisType`, `basisId`, and a short explanation. Valid basis types are rule, preregistration, literature, log, or user text.

- [ ] **Task 4.3: Add cost and rate limits**

Set a hard per-user monthly budget if a hosted backend exists. If no backend exists, require user-provided API keys and keep them out of repository history.

## Phase 5: Structured Feedback Community

**Objective:** Support feedback without creating an echo chamber.

**Files:**
- New app/backend architecture required; do not build this into the static page.

- [ ] **Task 5.1: Prototype private reviewer packets**

Export a review packet containing research question, preregistration, method, literature map, and specific feedback questions.

- [ ] **Task 5.2: Enforce structured feedback**

Use a fixed response format: core hypothesis, main doubt, suggested related work, method concern, and next experiment.

- [ ] **Task 5.3: Add human moderation before open community**

Do not launch open discussion until invite-only review has proven useful.

## Success Metrics

- A first-time user can open the app, load the example, understand the workflow, and export JSON in under 5 minutes.
- A real user can keep one project active for 2 weeks without losing state.
- At least 5 seed users create a preregistration snapshot and a draft outline.
- At least 3 seed users say the red/yellow/green review changed their next research action.
- The first preprint draft generated from the workflow includes limitations and source anchors instead of unsupported claims.

## Commit Discipline

Use small commits by behavior:

```powershell
git add app.js tests/app-smoke.test.mjs
git commit -m "fix: describe the behavior"
```

Run `.\scripts\check.ps1` before every commit that changes app behavior. Keep unrelated user work, private config, browser caches, and research scratch files out of commits.
