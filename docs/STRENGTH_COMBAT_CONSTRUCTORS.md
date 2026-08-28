# Силовой экстрим/ТА + Единоборства — изолированные конструкторы (только зал)

**Изоляция:** `src/engines/strength-sport/*` и `src/engines/combat/*` не импортируют `bb/*`/`lms/*`, не трогают `src/core/exercise-catalog.ts` (локальные `SS_EX_META`/`CB_EX_META`), не трогают `src/engines/annual-training/*` (свои `he_strength_annual_v1`/`he_combat_annual_v1`).

**Модель вне зала:** `src/engines/outside-load.engine.ts` — декларация `OutsideLoad {sessionsPerWeek, avgDurationMin, avgSRPE, interference, highIntensityDays}` → `weeklyLoad` → `volumeMultiplier 0.55-1.0` + `frequencyPenalty` + `isDayConflictWithOutside` (тяж ноги за день до high).

**Стронг+ТА:**
- Типы `src/engines/strength-sport/strength-sport.types.ts` — `mode weightlifting|strongman|hybrid`, `focus snatch|clean|squat|overhead|carry|stone`, `dupMode`, `intensityTech`
- Сплиты `src/engines/strength-sport/strength-sport-split-patterns.ts` 9 шт (wl_3/4/5/6, sm_2/3/4, hyb_3/4)
- Объём `src/engines/strength-sport/strength-sport-volume.ts` — WL lifts 15/30/45, Strong carry метры
- Отбор `src/engines/strength-sport/strength-sport-selection.ts` — `SS_ANGLE_CLASSES`/`SS_STRICT_GROUPS`, tier, injury, `selectDiverse` с `lengthenedBonus` `src/engines/strength-sport/strength-sport-bonus.ts`
- Нагрузка `src/engines/strength-sport/strength-sport-loading.ts` — `tempoForSS` X-0-X-0 для oly, `src/engines/strength-sport/strength-sport-warmup.ts` ramp 12×0.4/8×0.55/5×0.7/3×0.85
- PED `src/engines/strength-sport/strength-sport-ped-adaptation.ts` dose-aware 1.0-1.7, cap 1.7
- Лимиты `src/engines/strength-sport/strength-sport-limits.ts` — `sessionLimitsFor` 24/38/55, `validateSync`
- Финализация `src/engines/strength-sport/strength-sport-finalize.engine.ts` — капы, sync, outside highDays, deload 70%, per-lift MRV, push/pull баланс 1.8/0.55
- Builder `src/engines/strength-sport/strength-sport-builder.engine.ts` — RIR `rirForWeek` drift, `pmForWeek`, `filterPool` fallback `STRONG_FALLBACK`, `gentleFactor` ×0.6, `orderByMethod`, DUP `src/engines/strength-sport/strength-sport-dup.ts` + intensity `src/engines/strength-sport/strength-sport-intensity.ts`
- UI `src/ui/screens/strength-sport/StrengthSportConstructor.tsx` — params/outside/split/plan, focus/methodology/DUP/intensity, equipment/mobility/injury, heatmap `getWL/getStrong`, diary 7д, годовой, редактирование вес/репы/RIR + ↑↓, копирование недели, печать, экспорт `he_last_strength_program`

**Единоборства — PRO (Aug 28 2026):**
- Типы `combat.types.ts` — `discipline` 5, `goal` 5 + `periodizationModel atr_10/linear/conjugate`, `conditioningMode alactic/lactic/aerobic`, `fightDate/taperWeeks`, `workMax/workMaxByExercise`, `acwr/velocityLossPct`
- Сплиты `combat-split-patterns.ts` 5 шт (2a/2b/3/3b/4) + ATR-autoselect
- Объём `combat-volume.ts` — neck 4-16, grip 4-22, rotational 4-18, legs/push/pull 6-24 (per level)
- Отбор `combat-selection.ts` — `CB_ANGLE_CLASSES` 5 тегов ×4-6 классов (push/pull/neck/grip/prehab/oly/plyo/core_anti/carry), `STRICT` 7 групп, `filterByTierCB` beginner без depth_jump/oly, `filterByInjuryCB` 6 зон
- Нагрузка `combat-loading.ts` — `tempoForCB` 24 override (X-0-X-0 для тяж/oly/plyo, 3-1-1-0 для RDL), `restForCB` 150/120/90/60 по ex, `repsForCB/rirForCB` дублированы в `combat-periodization`
- Периодизация `combat-periodization.engine.ts` — **ATR 5/3/2 (Issurin)**, `linear`, `conjugate` (max/dynamic/repetition), deload 3/1 (ATR) / 2/1 (camp), taper 1-2нед, `reps/ rirForCombatPhase`
- Тапер `combat-taper.engine.ts` — `fightWeekIndex`, `isTaperByFightDate`, `taperVolumeMultiplier` 0.65/0.45 (Bosquet), `buildTaperRationale` + heat acclimation
- Весогонка `combat-weight-cut.engine.ts` — **ISSN 2025**: `WeightCutProtocol` water load_cut/sodium moderate_cut/carb deplete_reload, `weightCutPhaseForWeek` camp/taper/fight_week, `weightCutNutritionForWeek` (P2.2/C3/W1), `weightCutRehydrationNotes` 125-150%, `validate`
- Кондиция `combat-conditioning.engine.ts` — 3 системы **alactic 8×10с/50с, lactic 5×3мин/90с, aerobic Zone2 40′**, `modalityForWeek`/`conditioningSessionsForWeek` (outside≥5 → 0), `buildConditioningRationale`
- WorkMax `combat-workmax.ts` — `getCombatWorkMax` (workMaxByExercise → workMax[muscle] → BW coeff) + 40 дефолтов, шаг 2.5/0.5кг для шеи
 - Мониторинг `combat-monitoring.engine.ts` — `combatACWR` (0.8/1.3/1.5), `vbtVelocityForPct`/`vbtRecommendation` (loss>20% → RIR+1), `hrvGrade` + `hrvFromHistory/loadHrvHistory/combatHrvReport` (mean±SD, dangerous <mean-1SD)
 - Core `combat-core.engine.ts` — **Boxing Science 4 функции** anti_extension/rotation/lateral/hip_flexion + rotation_power, 4 уровня, `coreWeeklyPlan` + `coreVolumeCheck`
 - PED `combat-ped-adaptation.ts` — **dose-aware AAS/GH/insulin/MGF/IGF + tEq** tren2.5/nand1.3, cap по дисциплине wrestling 1.45/mma1.38/boxing1.32
 - Лимиты `combat-limits.ts` — 22/30×8/10 cap5, `validateSyncCombat` sets==workSets
 - Финализация `combat-finalize.engine.ts` — neck/grip/rot/coreAnti vs MEV/MRV, **push/pull horiz+vert отдельно 1.8/0.55, unilateral vs bilateral, prehab <3 → авто face_pull 3×15, HRV warning, outside конфликт, weightCut deficit**
 - Builder `combat-builder.engine.ts` — `POOL_BY_TAG` 15/12/15/... **64 упражнения**, `filterPool` (cable/sled fallback), `gentleFactor` 0.6-0.7, `weightForCombatExercise` через `weightForCombatExerciseResolved` (single path, без дубля), **budget =112×ped×lab×outside×recovery×nutrition×acwr**, **taper к дате боя, весогонка volume 0.65/0.82, ACWR RIR+1-2, conditioning 2-3 системы, DUP+intensity post-hoc**
 - DUP `combat-dup.ts` — `off/power_endurance/heavy_light/conjugate` (3 волны, deload/taper пропуск)
 - Intensity `combat-intensity.ts` — `none/rest_pause/myo_reps/cluster/contrast` (taper/deload пропуск)
 - Мезоцикл `combat-mesocycle.ts` — **+2.5кг compound / +1кг изоляция**, ACWR-aware (danger → 0.97), weight_cut без бампа + `combatMesocycleSummary`
 - Годовой `combat-annual.ts` — **ATR 50/30/20 + transition 2нед на 52нед**, `buildAnnualATR`, `annualCBPhaseForWeek`, `buildAnnualPrintHtml/Ics`, `addCompetitionToAnnual` + `removeAnnualCB`
 - Хранение `combat-storage.ts` — `he_combat_plan_v1/list` + **миграция v1→v2** `migrateCombatPlan` (дискр. бокс→boxing, gpp→accumulation, conditioning defaults, version 2) + `migrateAllCombatStorage`
 - Печать `combat-print.engine.ts` — `buildCombatPrintHtml` XSS, `buildCombatCsv/downloadCombatCsv`, `buildCombatPlanIcs`, `buildCombatShareHash`
 - Интеграция `combat-integration.engine.ts` — `combatDiaryStatsFromSessions`, `combatToNutritionPayload`, `combatToCardioPayload`
 - UI `CombatConstructor.tsx` — PRO: `periodizationModel/conditioningMode`, `fightDate/taperWeeks/startDate`, `bodyweight/sex/age + workMax 7 + workMaxByExercise 64 (showExactWM)`, `ACWR/VBT/HRV line`, ISSN `water/sodium/carb/heat`, `DUP 4 / intensity 5`, `POOL 64 + heatmap шея/хват/core`, ` diary 7д`, ` годовой ATR 12/24/36/52 + бои + print/ics`, ` план печать HTML/CSV/ICS` `buildCombatPrintHtml`

**Интеграция в планировщик:** `src/ui/screens/TrainingScreen_parts/nav.ts:86` `PLANNER_MODES` strength/combat, `src/ui/screens/TrainingScreen.tsx:612` рендер, `src/ui/screens/TrainingScreen_parts/shared.ts:126` `PlanningTrack`.

**Тесты:** 498 → **~578** (outside 10 + strength 221 + combat **295** = matrix 245 + builder 7 + pro 16 + **p2-polish 12** + balance 4 + dup 3 — детерминизм 240, ATR, taper, weightCut, conditioning, ACWR/VBT/HRV, Core4, PED cap, mesocycle, annual ATR, tier1-4, prehab, print XSS/CSV/ICS, миграция, workMax exact, budget). Запуск `npx vitest run src/engines/combat` — **295/295**.
