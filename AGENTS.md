# AGENTS.md

Project root instructions (kept intentionally short). Full audit/changelog history moved to `docs/AGENTS-AUDIT-ARCHIVE.md`; read only when a specific past decision is needed.

## Commands
- Type check: `npm run type-check`
- Tests: `npm test`
- Dev server: `npm run dev`
- Production build: `npm run build`
- APK design markers: `npm run verify:apk-design`

## Working rules
- Prefer Edit/Write tools for file changes; do not touch unrelated WIP files.
- After TypeScript changes, run `npm run type-check`; after behavior changes, run targeted tests (`npm test`).
- Do not commit, amend, or push unless the user explicitly asks.
- Treat build/generated files and worktrees as needing care; verify with `verify:apk-design` for APK-facing UI changes.
