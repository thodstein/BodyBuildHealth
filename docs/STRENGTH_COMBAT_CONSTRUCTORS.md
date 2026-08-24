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

**Единоборства:**
- Типы `src/engines/combat/combat.types.ts` — `discipline boxing|mma|wrestling|kickboxing|general`, `dupMode power_endurance`, `intensityTech rest_pause`
- Сплиты `src/engines/combat/combat-split-patterns.ts` 5 шт (2a/2b/3/3b/4)
- Объём `src/engines/combat/combat-volume.ts` — neck 4/6/10, grip 4/8/12, rotational 4/6/10
- Отбор `src/engines/combat/combat-selection.ts` — `CB_ANGLE_CLASSES` neck/grip/rotation/unilateral, STRICT, tier/injury
- Нагрузка `src/engines/combat/combat-loading.ts` — `tempoForCB` X-0-X-0 тяж, `restForCB` 150/75
- PED `src/engines/combat/combat-ped-adaptation.ts` кап 1.35
- Лимиты `src/engines/combat/combat-limits.ts` — 22/30 sets, `validateSyncCombat`
- Финализация `src/engines/combat/combat-finalize.engine.ts` — neck/grip/rot MRV, push/pull баланс, weeklyBudget
- Builder `src/engines/combat/combat-builder.engine.ts` — outside `тяж→памп`, accent `accentForDiscipline`, gentle ×0.6
- UI `src/ui/screens/combat/CombatConstructor.tsx` — аналогично + weightCut, heatmap neck/grip

**Интеграция в планировщик:** `src/ui/screens/TrainingScreen_parts/nav.ts:86` `PLANNER_MODES` strength/combat, `src/ui/screens/TrainingScreen.tsx:612` рендер, `src/ui/screens/TrainingScreen_parts/shared.ts:126` `PlanningTrack`.

**Тесты:** 498 (outside 10 + strength 6+9+197+5+4 + combat 7+8+245+3+4) — матрицы 192+240 детерминизм, gentle, outside, DUP/intensity, mobility.
