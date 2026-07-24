# Session Summary (Jul 23) — Training planner “Мои программы”: audit + improvement plan

## Objective
- Analyze the current state of the “Мои программы” tab in the training planner
- Identify problems and gaps caused by dual-storage architecture
- Provide professional-grade improvement proposals organized by priority (P0/P1/P2/P3)

## Current state

### What works
- **ProgramManagerPanel** (~1050 lines): PRO-level editor with wizard, BB/PL editing, search/filter/sort, revision history, export → canonical `he_user_programs`.
- **ProgramsTab** (391 line): library catalog with goal/level filters, “add to my programs” and “send to BB-auto” buttons → legacy `myTrainingPlans`.
- **MyTrainingTab** (334 lines): 4 sub-tabs (exercises/plans/cycles/progress), saves plans/cycles to `myTrainingPlans`/`myTrainingCycles`, progress from StrengthDiary, “load to constructor” via `onLoadToConstructor` → planner-bridge.

### Critical problems
- **Dual storage**: `ProgramManagerPanel` writes to `he_user_programs`, while `MyTrainingTab`+`ProgramsTab` write to `myTrainingPlans`/`myTrainingCycles`. These never sync, so the same “my programs” list shows different content in different tabs.
- **BbAutoConstructor duplicate write**: `handleSaveAsUserProgram` writes to BOTH `myTrainingPlans` and `he_user_programs`, worsening desync.
- **Flat vs rich model**: legacy tabs store flat `{id,name,date,exercises[]}`, while canonical model is `UserProgram` (weeks→sessions→blocks→sets, revisions, meta). Library programs saved as flat lose structure, editability, and validation.

### Data flow
```
ProgramManagerPanel → program-store.ts → he_user_programs ✅
MyTrainingTab      → localStorage   → myTrainingPlans / myTrainingCycles ❌
ProgramsTab        → localStorage   → myTrainingPlans ❌
BbAutoConstructor  → both ❌
```

## Improvement proposals

### P0 — CRITICAL
| # | Problem | Fix | Files |
|---|---------|-----|-------|
| P0-1 | Double storage → programs vanish between tabs | Redirect MyTrainingTab/ProgramsTab to use only program-store.ts (`saveUserProgram`/`loadUserPrograms`). Remove direct localStorage writes. | MyTrainingTab.tsx, ProgramsTab.tsx |
| P0-2 | BbAutoConstructor duplicates to both storages | Keep ONLY `saveUserProgram` (canonical). Remove duplicate `localStorage.setItem('myTrainingPlans')` in `handleSaveAsUserProgram`. | BbAutoConstructor.tsx |
| P0-3 | No migration of existing user data | On first load: if `myTrainingPlans`/`myTrainingCycles` exist → migrate into program-store.ts and clear old keys. One-time safe migration. | MyTrainingTab.tsx, ProgramsTab.tsx |

**P0 outcome:** single source of truth (`he_user_programs`), all 3 UIs see the same list.

### P1 — IMPORTANT
| # | Problem | Fix | Files |
|---|---------|-----|-------|
| P1-1 | MyTrainingTab lacks search/filter/sort | Add shared `useUserPrograms()` hook in program-store.ts with filter/sort/search. Both UIs consume it. | program-store.ts, MyTrainingTab.tsx |
| P1-2 | ProgramsTab saves library programs as flat array | Convert `FULL_PROGRAM_LIBRARY` program via `programToCycleTemplate` + `createFromBuild` → save as full `UserProgram` (BB), not flat exercises[]. | ProgramsTab.tsx |
| P1-3 | “My cycles” stored separately from programs | Move `myTrainingCycles` into `UserProgram` with `direction='pl'`, `pl.sourceCycleId`. Single list, single search. | MyTrainingTab.tsx, program-store.ts |
| P1-4 | No program limit enforced on legacy storages | Apply `MAX_PROGRAMS = 30` from program-store.ts to all write paths. | program-store.ts |

**P1 outcome:** both UIs have search/filter/sort; library programs saved as full BB/PL programs; everything in one list.

### P2 — DESIRABLE
| # | Problem | Fix | Files |
|---|---------|-----|-------|
| P2-1 | No exercise editor in MyTrainingTab | Extract `ExercisePicker` from ProgramManagerPanel into shared component and connect inline replace/edit sets/reps/RIR. | ExercisePicker.tsx, MyTrainingTab.tsx |
| P2-2 | Progress tab is not program-specific | When a program is selected, filter StrengthDiary logs by programId → show progress for that program only. Currently progress is global. | MyTrainingTab.tsx, StrengthDiary |
| P2-3 | No “apply to planner” for saved programs | Add `applyToPlanner({ kind:'program', label:p.meta.title, data: programToCycleTemplate(p) })` to program cards. | MyTrainingTab.tsx |
| P2-4 | “Load to constructor” supports manual only | Route by program type: BB → BbAutoConstructor, PL → SRCBBScreen, manual → TrainingConstructor. Currently only manual path exists. | LibraryZone.tsx, TrainingScreen.tsx |
| P2-5 | No deduplication of programs | On save: check duplicate `meta.title + direction` → offer update instead of creating copy. | program-store.ts |
| P2-6 | No drag-drop ordering | Add drag-drop reordering in ProgramManagerPanel for user priority. | ProgramManagerPanel.tsx |

### P3 — FUTURE
| # | Feature | Location |
|---|---------|----------|
| P3-1 | Program sharing (export/import JSON) | program-store.ts + UI |
| P3-2 | Cloud sync (Firebase/Telegram cloud) | new module |
| P3-3 | Program ratings/likes | analytics |
| P3-4 | Coach mode — share program with client | new flow |

## Recommended work order
1. **P0-1** redirect MyTrainingTab/ProgramsTab to program-store.ts
2. **P0-2** remove duplicate write in BbAutoConstructor
3. **P0-3** one-time migration of legacy data
4. **P1-1** shared `useUserPrograms()` hook
5. **P1-2** proper library→UserProgram save
6. **P1-3** merge myTrainingCycles into UserProgram
7. **P2-3** “apply to planner” from saved programs

**P0 = 3 files, ~2 hours. P1 = +3 files, ~3 hours. P2 optional.**

## Relevant files
- `src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx`
- `src/ui/screens/TrainingScreen_parts/MyTrainingTab.tsx`
- `src/ui/screens/TrainingScreen_parts/ProgramsTab.tsx`
- `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx`
- `src/ui/screens/TrainingScreen_parts/LibraryZone.tsx`
- `src/engines/user-program/program-store.ts`
- `src/engines/user-program/user-program.types.ts`
- `src/ui/screens/TrainingScreen_parts/planner-bridge.ts`
