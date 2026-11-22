---
name: BB Engine
description: Change src/engines/bb (plan builder, exercise catalog, food DB, product scoring) without breaking its invariants
---

# BB engine (`src/engines/bb`)

## Shape of the code

- ~130 flat modules named `bb-<topic>.engine.ts`; pure data/type modules sit next to them:
  `bb-types.ts`, `bb-day-types.ts`, `bb-split-patterns.ts`, `bb-sfr-db.ts`, `bb-methodology-spec.ts`,
  `bb-specialization-registry.ts`, `bb-utils.ts`, `bb-catalog-index.ts`.
- Pipeline: `buildBBPlan` (`bb-builder.engine.ts`) → `finalizeBBPlan` (`bb-finalize.engine.ts`) →
  `validateBBPlan` (`bb-validator.engine.ts`). Cycle conversion: `convertCycleToBBPlan` / `programToBBPlan`
  (`cycle-to-plan.ts`).
- `bb-types.ts` is the single source of `BBSet / BBExercise / BBSession / BBWeek / BBPlan`. It exists to break
  the builder ↔ autocoach ↔ finalize ↔ validator import cycle — never import those engine modules from it.
- UI builds asynchronously: `buildBBPlanAsync` (`bb-build-async.ts`) → `bb-build.worker.ts` (module Worker) →
  `bb-build-worker-handler.ts` (`runBBTask`). `prewarmBBWorker()` / `isBBWorkerAvailable()` guard it.
  Anything on the build path must stay DOM-free so it runs inside the worker.
- `bb-catalog-index.ts` caches `byMuscle / byName / byId` Maps from `EXERCISE_CATALOG` and invalidates them
  only when the catalog length changes; call `clearBBCatalogIndex()` in tests that mutate the catalog.

## Invariants (enforced by tests, not by docs)

- Weights are rounded to 0.1 (`Math.round(x * 10) / 10`); plates via `roundToPlate(weight, 2.5)`
  (`bb-autocoach.engine.ts`) or `roundToAvailablePlates` (`bb-plates.engine.ts`).
- RIR is clamped to 0..5 (`bb-utils.ts`), asserted in `bb-deterministic-properties.test.ts`.
- The build path has **no RNG** — the only `Math.random()` in `src/engines/bb` is a test-run id in
  `bb-contest-prep.engine.ts`. Do not add `Math.random()` / `Date.now()` to planning logic; determinism is
  asserted by `bb-deterministic-properties.test.ts` and `bb-deterministic-cycle-program.test.ts`.

## Adding an exercise

1. Append to `EXERCISE_CATALOG` (`src/core/exercise-catalog.ts`) with `id, name, group, type, equipment,
difficulty, jointStress, fatigueCost, targetMuscle, order, substitutionGroup, movementPattern,
canReplace, cannotReplace` (+ optional `technique, pauseSeconds, peakContraction, stretchPhase, comments`).
2. Extra pools: `src/core/exercise-catalog-arm.ts`, `src/core/exercise-catalog-ta-supplement.ts`.
3. Aliases: `src/data/exercise-id-mapping.ts`, `src/data/lms-cycles/exercise-alias-map.ts`; pattern/muscle
   classification: `src/engines/movement-pattern.ts` (`derivePattern`, `trueMuscleOf`, `isCarryExercise`).
4. `__tests__/bb-catalog-consistency.test.ts` enforces unique ids, non-empty
   `movementPattern / substitutionGroup / targetMuscle`, and `trueMuscleOf` coverage (≥ 529 non-null, ≤ 44 NULL).
   Change those thresholds only if the catalog legitimately grew.

## Adding a food

- `FOOD_DB` in `src/core/nutrition-database.ts` (`FoodItem` interface at the top). Every macro is **per 100 g**;
  there is no `perServing` field and `servingSize` is a human-readable string only.
- `foodState`: `raw | cooked | dry | powder | liquid | as_is`; `tier`: `basic | mid | max`.
- Supplements: `src/core/nutrition-database-supplement*.ts`.
- Guarded by `src/data/__tests__/nutrition-usda-top100.test.ts` (+ `nutrition-usda-top100.fixture.ts`, the only
  fixture file in the repo).

## Product scoring

- `src/engines/product-usefulness-v2.engine.ts`: `scoreAllProductsV2`, `calcMealScoreV2`, `analyzeDailyDiet`,
  `calcDIAAS`.
- Product data: `src/data/support-catalog-*.ts`, `support-meta.ts`, `support-dosing.ts`, `support-db/index.ts`.
- Tests: `src/engines/__tests__/product-usefulness-v1.test.ts`, `usefulness-calc.test.ts`,
  `usefulness-daily-flags.test.ts`.

## Tests

- All BB tests are `src/engines/bb/__tests__/bb-*.test.ts` (324 files). `src/engines/bb/__tests` (one underscore)
  is empty and unused — do not put tests there.
- Shared helpers: `__tests__/bb-test-helpers.ts` (`makeInput`, `makeMockPreviousPlan`, `totalSetsForMuscle`,
  `allExerciseNames`, `expectValidPlan`).
- Verify with `npm run test:bb` (single fork, 8 GB heap) and `npm run type-check`; `project_verify` runs both when
  files under `src/engines/bb/` change.
