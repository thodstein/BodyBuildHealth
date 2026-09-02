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

**Единоборства — PRO MAX (Sep 02 2026) — 360 тестов:**
- Типы `combat.types.ts` — `discipline` 5, `goal` 5 + `periodizationModel atr_10/linear/conjugate`, `conditioningMode alactic/lactic/aerobic`, `fightStyle striker/grappler/hybrid`, `fightDate/taperWeeks`, `workMax/workMaxByExercise`, `acwr/velocityLossPct`
- Сплиты `combat-split-patterns.ts` 5 шт (2a/2b/3/3b/4) + ATR-autoselect
- Объём `combat-volume.ts` — neck 4-16, grip 4-22, rotational 4-18, legs/push/pull 6-24 (per level)
- Отбор `combat-selection.ts` — `CB_ANGLE_CLASSES` 5 тегов ×4-6 классов (push/pull/neck/grip/prehab/oly/plyo/core_anti/carry), `STRICT` 7 групп, `filterByTierCB` beginner без depth_jump/oly, `filterByInjuryCB` 6 зон + **graded `gentleFactorForCB 0.6-0.7` + `repsCapForCB 10-15` (P0-4)**, `CB_TIER` tier1-4 + `neck_isometric_*`
- Нагрузка `combat-loading.ts` — `tempoForCB` 24 override (X-0-X-0 для тяж/oly/plyo, 3-1-1-0 для RDL), `restForCB` 150/120/90/60 по ex
- Периодизация `combat-periodization.engine.ts` — **ATR 5/3/2 (Issurin)**, `linear`, `conjugate` (max/dynamic/repetition), deload 3/1 (ATR) / 2/1 (camp), taper 1-2нед, `reps/ rirForCombatPhase`, **Jamieson power vs capacity разведены в кондиции**
- Тапер `combat-taper.engine.ts` — `fightWeekIndex`, `isTaperByFightDate`, `taperVolumeMultiplier` 0.65/0.45 (Bosquet), `buildTaperRationale` + heat acclimation
- Весогонка `combat-weight-cut.engine.ts` — **ISSN 2025 PRO MAX**: `WeightCutProtocol` water load_cut/sodium moderate_cut/carb deplete_reload + **weighInType day_before_24h/same_day_2h (wrestling same-day ≤3кг без острой)** + **fiber <10г×4д** `weightCutFiberForWeek` + **ORS 50-90 mmol 1-1.5л/ч** `weightCutOrsProtocol` + **staged post** `weightCutPostWeighInPlan` 3 фазы (MMA 24-36ч 8-12г/кг / same-day 1-2ч 30-40г) + **confirmedManipulation гейт** + **female 5% cap** + `validateWeightCutProtocol` + `weightCutSafetyBanner`, `weightCutNutritionForWeek` (P2.2/C3/W1, fiber/ors, RED-S 1400), `combatWeightCutToMealInput` (fiber/weighInType/ors)
- Кондиция `combat-conditioning.engine.ts` — 3 системы **Jamieson: alactic power 8×10с/50с (1:5) vs capacity 8×10с/30с (1:3), lactic power 20-40с/8-15мин vs capacity 90-120с/60с, aerobic cardiac output 40′ Zone2 130-150 <ANT**, `modalityForWeek`/`conditioningSessionsForWeek` (**outside≥5 → 1× Zone2 30′ maintenance** P0-2, Boxing Science 77%), `conditioningBudgetCost`, `buildConditioningRationale`
- WorkMax `combat-workmax.ts` — `getCombatWorkMax` (workMaxByExercise → workMax[muscle] → BW coeff) + 40 дефолтов, шаг 2.5/0.5кг для шеи
 - Мониторинг `combat-monitoring.engine.ts` — `combatACWR` (0.8/1.3/1.5), `vbtVelocityForPct`/`vbtRecommendation` (loss>20% → RIR+1), `hrvGrade` + `hrvFromHistory/loadHrvHistory/combatHrvReport` (mean±SD, dangerous <mean-1SD) + **EWMA `hrvEwma α0.3` `combatHrvReportEwma`**
 - Шея 2.0 `combat-neck.engine.ts` — **Collins +1lb=−5% сотряс, BJSM Delphi 2025**: `NECK_IDS` 11 (isometric front/back/side, band_rotation_isometric, eccentric, harness_rotation), `NECK_LEVELS[4]` (L1 изометрия 2×20с → L4 мост+суперсет), `neckWeeklyPlan` + `neckVolumeCheck` 4 плоскости + `collinsNoteForLevel`, `ufcNeckMatrixCategory`
 - Core `combat-core.engine.ts` — **Boxing Science 4 функции** anti_extension/rotation/lateral/hip_flexion + rotation_power, 4 уровня, `coreWeeklyPlan` + `coreVolumeCheck`
 - VBT `combat-vbt.engine.ts` — **per-exercise EWMA**: `velocityForCombat/estimate1RMFromVelocityCombat`, `diagnoseVelocityLossCombat` per lift, `loadVbtHistoryCB/saveVbtHistoryCB`, `vbtEwma`, `vbtHistoryForLift`, `diagnoseVelocityLossEwma`, `vbtTrendForLift`
 - PED `combat-ped-adaptation.ts` — **dose-aware AAS/GH/insulin/MGF/IGF + tEq** tren2.5/nand1.3, cap по дисциплине wrestling 1.45/mma1.38/boxing1.32 + **weight_cut 1.18** + GH+IGF 1.01 synergy
 - Лимиты `combat-limits.ts` — 22/30×8/10 cap5, `validateSyncCombat` sets==workSets
 - Финализация `combat-finalize.engine.ts` — neck/grip/rot/coreAnti vs MEV/MRV, **push/pull horiz+vert 1.8/0.55, unilateral, prehab <3 → авто face_pull 3×15, HRV warning, outside конфликт, weightCut deficit + Collins + мультипланарная шея check**
 - Builder `combat-builder.engine.ts` — `POOL_BY_TAG` 15/12/15/... **70 упражнений** (P0-3 +6 neck), `filterPool` (cable/sled fallback **FALLBACK_COEFF 0.85-0.95 с комментами**), **graded `gentleFactorForCB + repsCapForCB`**, `weightForCombatExercise` через `weightForCombatExerciseResolved`, **budget = MAV+4 ×ped×lab×outside×recovery×nutrition×acwr**, **taper к дате боя, весогонка volume 0.65/0.82 + fiber/ORS + staged, ACWR RIR+1-2, conditioning 2-3 системы (outside≥5 → Zone2), DUP+intensity post-hoc**, **fightStyle striker (rot+plyo contrast) vs grappler (neck/grip+unilateral)** `accentForFightStyle`
 - DUP `combat-dup.ts` — `off/power_endurance/heavy_light/conjugate` (3 волны, deload/taper пропуск)
 - Intensity `combat-intensity.ts` — `none/rest_pause/myo_reps/cluster/contrast` (taper/deload пропуск)
 - Мезоцикл `combat-mesocycle.ts` — **+2.5кг compound / +1кг изоляция**, ACWR-aware (danger → 0.97), weight_cut без бампа + `combatMesocycleSummary`
 - Годовой `combat-annual.ts` — **ATR 50/30/20 + transition 2нед + multi-cycle 2-4 (Issurin 8-13нед)**, `buildAnnualATR(cycles,disciplinePerCycle)`, `buildAnnualATRCycles`, `annualCBPhaseForWeek`, `buildAnnualPrintHtml/Ics`, `addCompetitionToAnnual` + `removeAnnualCB`
 - Хранение `combat-storage.ts` — `he_combat_plan_v1/list` + **миграция v1→v3** `migrateCombatPlan` (дискр. бокс→boxing, gpp→accumulation, conditioning defaults, fightStyle/weighInType/fiber/ors/confirmed, version 3)
 - Печать `combat-print.engine.ts` — `buildCombatPrintHtml` XSS + Collins/sparring/weighInType/ORS/staged, `buildCombatCsv/downloadCombatCsv`, `buildCombatPlanIcs`, `buildCombatShareHash`
 - Интеграция `combat-integration.engine.ts` — `combatDiaryStatsFromSessions`, `combatToNutritionPayload` (**ISSN mealInput + weighInType/fiber/ORS**), `combatToCardioPayload` (**zone2 даже при high outside**)
 - Дневник `combat-diary.engine.ts` — **per-group e1RM + grip изометрия holdSec×10** `buildDiaryTrendCB`, `gripIsometricVolume`
 - UI `CombatConstructor.tsx` — PRO MAX: `periodizationModel/conditioningMode/weighInType/orsSodium/confirmed`, `fightDate/taperWeeks/startDate`, `bodyweight/sex/age + workMax 7 + workMaxByExercise 70 (showExactWM)`, `ACWR/VBT/HRV line + EWMA`, ISSN `water/sodium/carb/fiber/ORS/heat/confirmed + female RED-S`, `DUP 4 / intensity 5 / fightStyle 3`, `POOL 70 + heatmap шея 4 плоскости (Collins)`, ` diary 7д + VBT per-lift`, ` годовой ATR 12/24/36/52 multi-cycle + бои + print/ics`, ` план печать HTML/CSV/ICS` `buildCombatPrintHtml`

**Интеграция в планировщик:** `src/ui/screens/TrainingScreen_parts/nav.ts:86` `PLANNER_MODES` strength/combat, `src/ui/screens/TrainingScreen.tsx:612` рендер, `src/ui/screens/TrainingScreen_parts/shared.ts:126` `PlanningTrack`.

**Тесты:** 498 → **~611** (outside 10 + strength 221 + combat **360** = matrix 245 + builder 7 + pro 16 + p2-polish 12 + balance 4 + dup 3 + **issn-pro-max 31 + extra 8** — детерминизм 240, ATR multi-cycle, taper, weightCut ISSN fiber/ORS/window/confirmed, conditioning Jamieson + outside≥5 Zone2, neck 2.0 Collins 4 плоскости, graded травмы, VBT EWMA per-lift, diary grip, fightStyle, annual 2-4, PED cap 1.18, print). Запуск `npx vitest run src/engines/combat` — **360/360**.
