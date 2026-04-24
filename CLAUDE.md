# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Open Worker Manager** — a Tauri 2.x desktop app for managing Cloudflare Workers projects. Users select a local directory; the Rust backend recursively scans it for `wrangler.toml`/`wrangler.jsonc` files and surfaces them as cards. From there users can deploy, tail logs, and run Wrangler commands through an embedded xterm.js terminal.

## Commands

```bash
# Development (starts Vite + opens Tauri window)
npx tauri dev

# Production build
npx tauri build

# Frontend only (no Tauri window)
npm run dev      # Vite on http://localhost:1420
npm run build    # tsc + vite build → dist/
```

No test suite is configured yet.

## Architecture

### Frontend (`src/`)

- **`App.tsx`** — single orchestrator: holds all state (worker list, login status, search, terminal height), calls `invoke('scan_workers')`, and polls `wrangler whoami` every 30 s while disconnected. Persists last path and shell choice in `localStorage`.
- **`components/WorkerCard.tsx`** — one card per worker; deploy/logs/env buttons write commands to the Terminal ref.
- **`components/FolderGroup.tsx`** — recursive folder tree built from the flat `WorkerInfo[]` array.
- **`components/Terminal.tsx`** — xterm.js shell; receives commands imperatively via a `ref`. Executes them through the Tauri `shell` plugin; streams stdout/stderr back to the terminal.

### Backend (`src-tauri/src/`)

- **`lib.rs`** — exposes a single Tauri command `scan_workers(base_path: String)`. Uses `walkdir` to traverse the directory (skips `node_modules/`, `.git/`, `target/`), parses TOML with the `toml` crate and JSONC with `json5`/`json_comments`, and returns `Vec<WorkerInfo>` (name, absolute path, relative path, env list).
- **`main.rs`** — calls `lib::run()`; registers plugins: `shell`, `dialog`, `opener`.

### Data Flow

```
User picks folder
  → invoke('scan_workers', { basePath })
  → Rust walks FS, parses configs
  → WorkerInfo[] returned as JSON
  → React renders FolderGroup + WorkerCards
  → Button click → Terminal executes `npx wrangler <command>`
  → xterm.js streams output
```

## Key Technologies

| Layer | Stack |
|-------|-------|
| UI | React 19, TypeScript 5.8, Tailwind CSS 3, xterm.js 6 |
| Bundler | Vite 7 |
| Desktop | Tauri 2.x (Rust backend + WebView) |
| Rust crates | `walkdir`, `toml`, `json5`, `json_comments`, `serde_json`, tauri plugins |

## Tauri ↔ Frontend Bridge

- All Rust commands are invoked via `import { invoke } from '@tauri-apps/api/core'`
- Shell commands (wrangler, npm) run through `@tauri-apps/plugin-shell` — on Windows these target `npx.cmd`, not `npx`
- File/folder picker: `@tauri-apps/plugin-dialog`
- Open in editor: `@tauri-apps/plugin-opener`

## Styling Conventions

- Dark theme only; color palette: sky / indigo / purple
- `.glass` utility class = glassmorphism header (defined in `index.css`)
- Terminal panel is drag-resizable; its height is stored in React state
