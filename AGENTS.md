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

## Agent tooling (`.opencode/`, `opencode.json`)

- Tools `project_verify` (runs type-check + the matching vitest suite + APK markers for the changed files) and `project_apk_preflight` (version/gradle sync, APK guards, local buildability).
- Commands: `/do` (задача целиком: план + параллельные агенты + проверки до зелёного), `/verify`, `/apk`, `/doctor`.
- Agents: `lead` (primary, оркестратор — запускает субагентов), `worker` (правки в заданных файлах), `verifier` (прогон проверок, read-only), `reviewer` (read-only review).
- Headless-запуск до завершения: `opencode run --agent lead --auto "<задача>"` (в скриптах/CI — ещё `--format json`, `--archived`).
- Skills — release/process: `apk-release`, `supabase-migrations`, `bb-audit`, `asset-sync`; code areas: `bb-engine` (движок и каталог), `ui-design` (UI + APK-маркеры), `data-import` (парсеры), `backend-api` (`api/`, edge functions, auth/env), `testing-workflow` (какой vitest-сьют гонять); research: `research` (PubMed/Europe PMC/OpenAlex, уровни доказательности); оркестрация: `orchestration` (декомпозиция, параллельные субагенты, цикл проверок).
- Formatter is on (Prettier, `.prettierrc` + `.prettierignore`); `.env*`, `dist/`, `android/**/build/` edits are denied, `git commit/push` ask.
- MCP: `browse` (browser), `supabase` (read-only), `context7`, `github`, `pubmed` (PubMed/PMC/Europe PMC full text, iCite, MeSH), `openalex` (270M+ scholarly works, citation graphs). Remote servers need a one-time sign-in via `/mcps`; `pubmed`/`openalex` are keyless and anonymous.
- Local `java`/`gradle`/`ANDROID_HOME` are absent: APK builds only through `.github/workflows/android-apk.yml`.
