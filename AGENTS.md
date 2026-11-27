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
- Quality tools: `quality.domain_guards`, `quality.medical_safety`, `quality.ocr_benchmark`, `quality.security_privacy`, `quality.release_gate`, `quality.diff_scope`, `quality.training_quality`, `quality.performance_profiler`, `quality.data_import_audit`, `quality.visual_regression`. Они только докладывают evidence/findings и не придумывают медицинские факты/не меняют файлы.
- Evidence tools (keyless, live): `evidence_literature` (PubMed + Europe PMC), `evidence_trials` (ClinicalTrials.gov), `evidence_drug_label` (DailyMed SPL), `evidence_substance` (PubChem), `evidence_citation` (Crossref + OpenAlex, с флагом retraction), `web_search` (DuckDuckGo). Встроенный `websearch` включён через провайдер в `evidence.ts`.
- Repo knowledge: `repo_pharma` (запись `PHARMA_DB` + поддерживающие базы ПКТ/БАД + правила взаимодействий + женский протокол по веществу), `repo_lab` (норма `UCUM_MAP`, женские границы, пороги по коду), `repo_doc` (поиск по `docs/`, `src/`, `scripts/`: `file:line` + строка).
- Маршрутизация (не по привычке, а по вопросу): код и данные — `read`/`grep`; что уже знает приложение — `repo_pharma`/`repo_lab`; эффективность, дозы, ПКТ, побочки, БАДы — `evidence_literature` (или MCP `pubmed`); инструкция препарата — `evidence_drug_label`; исследования и набор — `evidence_trials`; идентичность вещества (CID/CAS) — `evidence_substance`; проверка DOI/PMID и отзыв — `evidence_citation`; цены, вендоры, новости, софт — `websearch`/`web_search`; документация библиотек — `context7`; небиомедицинская литература и цитатные графы — `openalex`. Факт без источника не попадает в код: нет источника — «нет данных».
- Автовыбор: сначала `project_route` / `/route`, затем загрузить доменные навыки по карте. Триггеры включают «питание», «КБЖУ», «OCR», «анализы», «биомаркер», «доза», «ААС», «бодибилдинг», «пауэрлифтинг», «армрестлинг», «стронгмен», «UI», «APK». Агенты `lead`/`worker` обязаны начинать с триажа и грузить нужный навык — не действовать по памяти.
- Self-learning: `project_learn` (факт в `docs/AGENTS-MEMORY.md`), `project_learn_skill` (создать/обновить навык в `.opencode/skills/`), `project_learn_config` (автообучение вкл/выкл). `context`-хук плагина `learning.ts` подмешивает свежую память в каждый запрос — записанное действует без перечитывания файла; скилл `self-learning` объясняет, что куда писать.
- Commands: `/do` (задача целиком: план + параллельные агенты + проверки до зелёного), `/route` (домены, навыки, источники, файлы и проверки), `/quality` (production quality gates), `/evidence` (факт-чек по медицине/фарме/БАДам → отчёт), `/learn` (дистилляция сессии в память и навыки, `auto on|off`), `/verify`, `/apk`, `/doctor`.
- Agents: `lead` (primary, оркестратор — запускает субагентов), `worker` (правки в заданных файлах), `verifier` (прогон проверок, read-only), `reviewer` (read-only review).
- Headless-запуск до завершения: `opencode run --agent lead --auto "<задача>"` (в скриптах/CI — ещё `--format json`, `--archived`).
- `.opencode/plugins/*.ts` не входят в tsconfig: синтаксис проверяй `node .opencode/plugin-syntax-check.cjs .opencode/plugins/*.ts`, форматирование — `npx prettier --check ".opencode/**"`.
- Skills — release/process: `apk-release`, `supabase-migrations`, `bb-audit`, `asset-sync`, `professional-quality`; code areas: `bb-engine` (движок и каталог), `ui-design` (UI + APK-маркеры), `data-import` (парсеры), `backend-api` (`api/`, edge functions, auth/env), `testing-workflow` (какой vitest-сьют гонять); OCR/data: `nutrition-ocr` (еда, этикетки, штрихкоды, КБЖУ), `lab-ocr` (анализы, провайдеры, биомаркеры, UCUM); research: `research` (PubMed/Europe PMC/OpenAlex, уровни доказательности); оркестрация: `orchestration` (декомпозиция, параллельные субагенты, цикл проверок); силовые виды спорта: `strength-sports` (бодибилдинг, пауэрлифтинг, армрестлинг, стронгмен); память: `self-learning` (куда писать факт, навык или правило); медицинский слой: `aas-medicine` (вещества, PK/PD, дозы, ПКТ, взаимодействия, лаб-нормы).
- Formatter is on (Prettier, `.prettierrc` + `.prettierignore`); `.env*`, `dist/`, `android/**/build/` edits are denied, `git commit/push` ask.
- MCP: `browse` (browser), `supabase` (read-only), `context7`, `github`, `pubmed` (PubMed/PMC/Europe PMC full text, iCite, MeSH), `openalex` (270M+ scholarly works, citation graphs). Remote servers need a one-time sign-in via `/mcps`; `pubmed`/`openalex` are keyless and anonymous.
- Local `java`/`gradle`/`ANDROID_HOME` are absent: APK builds only through `.github/workflows/android-apk.yml`.
