# Development Guide

`min_scifi` is a local-first MVP for an independent research workbench. The core app is still static HTML/CSS/JS with no package manager or build step, and it now has an optional Python standard-library backend for writing an external research vault to a configured path.

## Run Locally

You can open `index.html` directly in a browser. If you want a local URL:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

For typed-path vault storage, run the optional backend:

```bash
python backend/server.py --vault D:\Research\min-scifi-vault --port 8765
```

Then open `http://localhost:8765/`.

## Verify

Run the project check script:

```powershell
.\scripts\check.ps1
```

It runs JavaScript syntax checks, Python backend syntax checks, Node tests, Python backend tests, and a headless browser first-render check when Chrome/Edge is available.

## File Map

- `index.html`: page structure and form fields.
- `styles.css`: responsive layout and visual design.
- `app.js`: UI binding, rule checks, JSON export, outline generation, vault actions.
- `src/storage-schema.js`: normalized state model and vault file serialization.
- `src/storage-adapters.js`: browser directory and backend API storage adapters.
- `backend/server.py`: optional local backend for typed vault paths.
- `docs/vault-storage.md`: external vault storage design.
- `discussion.md`: product/design discussion notes.

## State Model

Browser draft state is stored in `localStorage` under:

```text
min-scifi-ir-workbench
```

The external vault is the preferred durable storage layer. It writes:

```text
project.json
README.md
preregistration/current.md
literature/items.json
literature/items.md
logs/daily.md
logs/weekly.md
writing/preprint-outline.md
sources/README.md
```

The export button serializes the same state to JSON. Clearing browser storage resets local draft state, but files already written to an external vault remain available outside the app.

## Editing Workflow

- Add new persisted fields to `src/storage-schema.js`, then add the element id in `index.html`.
- Add or change review checks in the `rules` array in `app.js`.
- Keep file-writing logic in `src/storage-schema.js`, `src/storage-adapters.js`, or `backend/server.py`, not inline in UI event handlers.
- Keep generated user-facing text in Chinese unless the product direction changes.
- Keep the app usable without remote network access or external APIs.

## Manual Test Checklist

After changing UI or state logic:

1. Load the page from a clean browser profile or after clearing localStorage.
2. Click `填入示例`.
3. Edit each major form section and refresh the page to confirm persistence.
4. Run `运行检查` and verify the score/review cards update.
5. Add and remove a literature item.
6. Click `生成骨架`.
7. Connect a browser vault directory in Chrome/Edge and click `写入资料库`.
8. Confirm `project.json`, Markdown files, and `sources/README.md` are written.
9. Export JSON and confirm the downloaded file contains the current state.
