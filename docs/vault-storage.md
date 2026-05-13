# External Vault Storage Design

`min_scifi` should not trap research material inside the frontend. The app treats the browser UI as one editor for an external, structured research vault that can also be opened by Obsidian, a text editor, scripts, or future analysis tools.

## Goals

- Keep project data readable outside the app.
- Store the canonical snapshot as JSON and the working material as Markdown.
- Let users choose where the vault lives when the runtime supports it.
- Keep `localStorage` only as a fallback draft cache and last-connection status.
- Leave raw source material in normal folders instead of importing it into an opaque database.

## Runtime Modes

### Browser Vault Mode

Modern Chromium browsers expose the File System Access API. In this mode the user clicks `连接资料库目录`, chooses a folder, and the app writes vault files there after explicit permission.

Browser security does not allow a static page to silently write to a typed path such as `D:\Research\my-vault`. The app may display a path note chosen by the user, but the actual folder permission comes from the browser directory picker.

### Local Backend Mode

For users who need a typed absolute path, run the optional local backend:

```powershell
python backend/server.py --vault D:\Research\min-scifi-vault --port 8765
```

Then open `http://localhost:8765/`. The frontend can call backend APIs to read/write the configured vault path. The backend uses only Python standard library modules.

### Fallback Mode

If neither browser vault mode nor backend mode is available, the app continues to work with `localStorage` and JSON export. This mode is a convenience cache, not the long-term source of truth.

## Vault Layout

```text
min-scifi-vault/
  project.json
  README.md
  preregistration/
    current.md
  literature/
    items.json
    items.md
  logs/
    daily.md
    weekly.md
  writing/
    preprint-outline.md
  sources/
    README.md
```

### `project.json`

Machine-readable snapshot of the normalized app state.

```json
{
  "schemaVersion": 1,
  "app": "min_scifi",
  "project": {
    "status": "preregistered",
    "title": "夜间屏幕亮度与入睡时长的小样本观察",
    "question": "在 14 天自我观察中，睡前一小时平均屏幕亮度是否与入睡时长相关？",
    "domain": "行为科学 / 自我量化",
    "targetDate": "2026-06-27"
  },
  "preregistration": {
    "hypothesis": "...",
    "expectedResult": "...",
    "falsification": "...",
    "method": "..."
  },
  "literature": [
    {
      "title": "doi:10.1073/pnas.1418490112",
      "note": "夜间蓝光与睡眠节律相关。"
    }
  ],
  "logs": {
    "daily": "...",
    "weekly": "..."
  },
  "writing": {
    "outline": "..."
  },
  "settings": {
    "quietMode": false
  }
}
```

### Markdown Files

Markdown files are intentionally redundant with `project.json`. They are the human-facing working files. If another tool edits them, future import/parsing can reconcile those edits; for now `project.json` remains the reliable machine-readable source.

### `sources/`

Raw material lives here: PDFs, CSVs, images, copied notes, exported Zotero files, or experiment data. The app creates only a README in this folder and never rewrites user source files.

## Frontend Boundary

The UI should call storage services instead of formatting files inline. The storage layer owns:

- State normalization.
- Vault file serialization.
- Browser directory writes.
- Backend API calls.

The UI owns:

- Form binding.
- Review cards and status messages.
- User actions such as connect, sync, export, and load example.

## Backend API

The optional local backend exposes:

- `GET /api/health`
- `GET /api/vault/config`
- `POST /api/vault/config` with `{ "vaultPath": "D:\\Research\\min-scifi-vault" }`
- `GET /api/vault/state`
- `POST /api/vault/state` with normalized app state

The backend writes the same vault layout as browser vault mode. It should reject empty paths, create the vault directory if needed, and keep private runtime config out of git.

## Safety Rules

- Do not delete files in `sources/`.
- Do not remove unknown files in the vault.
- Do not require external storage to use the app.
- Do not store credentials in the vault.
- Do not make Markdown the only copy until import/parsing is robust.
