# AGENTS.md - BioStackAIScreen + BB-builder

## Current project state (Jul 29 2026)

### Build status
- `tsc --noEmit` - 0 errors (entire project clean)
- `vite build` - OK (694+ modules)
- `vitest` - all passing

### Git
- `origin/main` - tracked
- uncommitted changes: BB-builder priority-1 edits in progress

---

## BB-builder: Priority 1 - RIR by training focus (in progress)

Goal: add `BBTrainingFocus` type (`'strength' | 'hypertrophy' | 'endurance'`) to control RIR/reps/tempo based on evidence 2022+.

Done so far:
- `bb-goal-types.ts` - created with `FOCUS_RIR_TABLE`, `FOCUS_REPS_TABLE`, `PHASE_TEMPO`, `LEVEL_REP_MOD`
- `bb-tempo-rest.ts` - `tempoFor()` accepts optional `phase` param (ACSM 2023: eccentric 2-4s)
- `bb-builder.engine.ts`:
  - Added `trainingFocus` + `bodyFat` + `leanMass` + `hrvMs` + `sleepHours` + `stressLevel` + `eccentricMult` + `calorieSurplus` + `proteinPerKg` to `BBBuilderInput`
  - `charReps()` now takes `focus` param - uses `FOCUS_REPS_TABLE`
  - `bbRir()` now takes `focus` param - uses `FOCUS_RIR_TABLE` (Roberts 2022, Schoenfeld 2021)
  - `buildSession()` now accepts `trainingFocus` and forwards to `bbRir`

Still needed:
- `buildSession()` call site in `buildBBPlan` (line ~1907) - needs `input.trainingFocus` passed
- `tempoFor()` call sites (4) - pass `phase` param
- `charReps()` call sites - pass `focus` param
- Compute recovery multiplier from `bodyFat/leanMass/hrvMs/sleepHours/stressLevel` → MRV adjustment
- Compute protein/calorie multiplier from `proteinPerKg/calorieSurplus` → MRV adjustment

---

## Architecture

### BB engine files
| File | Role |
|------|------|
| `bb-builder.engine.ts` | Main BB plan generator |
| `bb-split-patterns.ts` | 16 split definitions |
| `bb-day-types.ts` | Day character, TAG_MUSCLES, ROTATION_PAIRS |
| `bb-tempo-rest.ts` | Tempo/rest specs |
| `bb-autocoach.engine.ts` | Post-phase processing, feeders, deload protocols |
| `bb-metrics.engine.ts` | Plan metrics (heavy%, pump%, MRV checks) |
| `bb-goal-types.ts` | BBTrainingFocus + evidence RIR/reps tables |
| `bb-ped-adaptation.engine.ts` | PED MRV boost |
| `bb-session-order.engine.ts` | Exercise ordering by layer |
| `bb-weakpoint.ts` | Weak-point diagnostics |
| `bb-progression-feedback.engine.ts` | sRPE feedback loop |
| `cycle-to-plan.ts` | Cycle template → BB plan converter |

### SPLIT_PATTERNS (16)
- 3 fullbody variants (2×/3×/4× per week)
- 3 upper/lower variants (3×/4× per week + PHUL)
- PPL 6×, Arnold 6×, Bro 5×, PRO 8-day
- 3 rolling patterns (3/1/3/1, 4/1, ТПТ-О-ТТП)
- Push/Pull 4×, Torso/Limb 4×, Glute Focus 4×
