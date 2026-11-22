---
name: Audit & Plan Docs
description: Write audits, master plans and fix plans in docs/ using this repository's conventions
---

# Audits and plans in `docs/`

- Plans/audits live in `docs/` as Markdown, written in Russian, named `<AREA>-<KIND>-<VERSION/date>.md`:
  `APK-ADAPTATION-MASTER-PLAN.md`, `ARM-DIAGNOSTICS-PRO-AUDIT-2026-10.md`, `BB-AUTO-PROFESSIONAL-AUDIT-2.md`.
- `docs/AGENTS-AUDIT-ARCHIVE.md` is the changelog of finished work; do not grow `AGENTS.md` — append history there.
- Findings are ordered by severity (`P0` / `P1` / `P2` / `P3`) with concrete `file:line` references and a
  reproduction or verification step for each claim. No vague "improve X".
- Every plan ends with an explicit check list: `npm run type-check`, targeted `npm test`
  (`test:core` / `test:ui` / `test:bb`) and `npm run verify:apk-design` for APK-facing UI.

## Working rules while executing a plan

1. Read `AGENTS.md` and the relevant `docs/*-PLAN*.md` first.
2. Touch only files the step needs; leave unrelated WIP changes alone.
3. After TypeScript edits run the checks (or call the `project_verify` tool).
4. Report what changed, what was verified, and what is deliberately left out.
