# СТРОНГ+ТА — Pro-уровень (изолированный конструктор)

**Изоляция:** `src/engines/strength-sport/*` 20 файлов + `src/ui/screens/strength-sport/StrengthSportConstructor.tsx` не импортируют `bb/*`/`lms/*`/`annual-training`, свой `he_strength_annual_v1`/`he_strength_sport_*`. Вне зала — декларация `OutsideLoad` → `weeklyLoad` → `volumeMultiplier`.

**Исследование:** Torokhtiy 10 нед 4 фазы `Acc 3 / Trans 3 / Real 3 / Taper 1×65%` (store.torokhtiy.com/strongman), Catalyst/Boostcamp block, Rest Timer Science — `log 3-5 мин (90%+ 5-7), stones 4-6, farmers/yoke 5-8 мин`, FitnessVolt, IWF Sinclair 2017-2020.

## Движок
- **Типы** `strength-sport.types.ts:7` — `mode wl|sm|hyb`, `goal 5`, `level 4`, `phase 5`, `workMax 11`, `taperWeeks/diaryTrend/velocityLossPct/acwr`.
- **Сплиты** `split-patterns.ts:25` 9 шт `wl_3/4/5/6 sm_2/3/4 hyb_3/4` 7д ротация.
- **Объём** `volume.ts:9` WL `snatch 15/30/45..95 lifts`, Strong `carry 80/150/250..500м` (per-exercise дистанция в `finalize:111` `yoke20 farmers40 sled25`).
- **Прогрессия** `progression.ts:15` `LIFT_K_FACTOR` snatch 0.45 vs squat 1.0, `pmForWeek(...,liftId)` cap `1.25/1.35/1.5`, `phaseForWeek`/`buildPhaseDistribution` 3/3/3/1 + `phaseForDate(competitionDate)`.
- **Отбор** `selection.ts:7` `SS_ANGLE_CLASSES` 6 тегов, `SS_STRICT_GROUPS 8` (snatch/clean/jerk/carry/stone/squat/press/pull), `filterByTier` beginner без `COMPLEX_IDS` (high_hang/low_block), `filterByInjury` `exclude` vs `graded×0.6`, `selectDiverse` + `lengthenedBonus`.
- **Нагрузка** `loading.ts:13` `TEMPO X-0-X-0` для oly, `PCT 0.75/0.85/0.92`, `repsForSS` Prilepin `optimalRepsForPct(pct,isWL)` `WL <70% 3-5 / 90%+ 1-2`, `restForSS` `90%+ yoke 480с / log 300с / squat 240с`.
- **Builder** `builder.engine.ts:378` — `filterPool` BFS `STRONG_FALLBACK` `yoke→farmers→deadlift`, `gentleFactor×0.6`, `taper` `×0.55 вес×0.92 RIR1` vs `deload ×0.6 вес×0.6 RIR4`, `catalog 584` via `getExerciseById`.
- **PED** `ped-adaptation.ts:37` tEq tren 2.5/nand 1.3, cap 1.7.
- **Limits** `limits.ts:4` `24/38/55` sets `10/13/16` ex cap `5/6`.
- **Finalize** `finalize.engine.ts:14` — enforce caps (accessory первыми), `ACWR` `dangerous×0.60`, `VBT>20%`, `joint` `yoke>2.5×BW`, `outside highDays`, `volume vs landmarks` `snatch/clean/squat/pull/carry/stone`, `Sinclair` `0.7519/175.5` `IWF 55..109` `Masters 1.02..1.20`, `DOTS/Wilks/IPF GL`.
- **Export** `export.ts:1` CSV `;` + HTML + `buildStrengthShareHash` base64 url-safe + `telegram`.

## UI
`StrengthSportConstructor.tsx:224` — `params/outside/split/plan`, `sex/weight/age/competitionDate/taperWeeks`, `ACWR/VBT` badge, `diaryTrend` 28д e1RM, `pattern` radio + preview `snatch·clean·отд`, `heatmap` 4 ряда `snatch/clean/squat/carry`, `per-set` редактор `weight×reps×RIR+pct`, `Gantt` годовой, `CSV/HTML/telegram/Экспорт в программу`.

## Тесты
`src/engines/strength-sport/__tests__` 8 файлов, 258 тестов (матрица 197 + p0 14 + p3 12 + tempo 10 + builder 6 + balance 4). `tsc 0`.

## Эволюция
P0 Prilepin/per-lift/taper → P1 Wilks/Sinclair/ACWR/VBT → P2 JSI/cardio/telegram → P3 catalog/Gantt/per-set. Остаток — `xlsx` с форматированием, `annual-training` sync.
