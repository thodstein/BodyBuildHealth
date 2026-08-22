# ББ-авто — максимальный финальный план 2026-08-22 (весь аудит + все уточнения)

> **Статус:** build-mode, read-only план зафиксирован. Капы frozen ≈ как сейчас, все фичи из кнопок обязаны давать след в `BBPlan`.

## 0. Исходный план (из docs/BB-AUTO-GENERATION-MAX-PLAN.md)

Этапы 0-12 исходного плана доведены до DONE: единый мышечный нормализатор, `bb-volume.engine.ts`, `buildBBVolumeTarget`, unified exercise planner, unified order `orderSessionExercises`, set distribution, fatigue budget `bb-fatigue.engine.ts`, feeder/pump, фазы/прогрессия, metrics/UI, `validateBBGeneratedPlan`, тесты 24 сплита + cycle/program adapt+faithful. Остаточные риски исходного плана: нет browser smoke, target-volume+feeder можно глубже объединить, P1/P2 hamstring/glute angle diversity и fatigue-aware DUP — реализованы частично (см. строки 291-296 исходного файла).

## 1. Полный аудит 2026-08-22 — что проверено

* **37 `bb-*.engine.ts`** + `562` упражнений `src/core/exercise-catalog.ts` + `BbAutoConstructor.tsx:5558` (8 шагов `params→ped→split→plan→quality→adjust→contest→annual`).
* **`BBBuilderInput` 44 поля** `src/engines/bb/bb-builder.engine.ts:77` (level/trainingYears/bodyweightCapability/goal/weeks/workMax/weakPoints/focusGroup/volumeGoal/specializationSchedule/injuries/planStartWeek/favorite/excluded/avoidAxialLoad/fewerCompound/rotationMode/intensityLevel/allowStrengthLifts/sex/intensityTechnique/autoDeload/deloadType/loadStrategy/autoRegResult/pedDoses/courseIntensity/equipment/methodology/labMrvMultiplier/trainingFocus/bodyFat/leanMass/hrvMs/sleepHours/stressLevel/eccentricMult/calorieSurplus/proteinPerKg/mobilityRestrictions/previousPlan/supersetMode/volumeScheme).
* **Пути:** generic `buildBBPlan:2271`, cycle `convertCycleToBBPlan:809` adapt/faithful, program `programToBBPlan:1531`, contest `applyContestPrepToBBPlan:1165` + `applyTrainingTaperToBBPlan:947`, annual `he_bb_plan_saved_ctx:1197`, `autodraftBBPlan`, `DUP/superset/volumeScheme`.
* **Хранилище:** `he_bb_plans` cap8, `he_bb_session`, `he_bb_plan_saved(_ctx)`, `he_bb_macro` — `try/catch` глотают `QuotaExceededError`. Валидатор `src/engines/bb/bb-validator.engine.ts:314` пропускает `NaN`.
* **Покрытие:** `src/engines/bb/__tests__` 125 файлов / 1123 теста + SSR `bb-auto-smoke:5` без кликов.

## 2. Все баги одним списком (P0/P1/P2)

### P0 — критика (капы не меняем)
| # | Файл:строка | Баг | Фикс |
|---|---|---|---|
| P0-1 | `bb-builder:2271` | `getPattern()` fallback `SPLIT_PATTERNS[0]` на warn | throw ValidationError |
| P0-2 | `bb-builder:1025,2626` | `buildSession()` 47 positional + тень `weekLocalUsed = new Map()` | `BuildSessionInput` объект |
| P0-3 | `bb-builder:1946` vs `bb-volume:284` | `indirect 0.5 vs 0.45` | единый `INDIRECT_COEFF=0.45` |
| P0-4 | `bb-volume:152` | `if(enhanced\|\|>=3)60 else if(enhanced\|\|>=1)40` — 2-я недостижима | `level==='advanced'` во 2-й |
| P0-5 | `cycle-to-plan:950` | `exclPartial` substring `жим` | точное `id`/canonical |
| P0-6 | `cycle-to-plan:937,1698` | `trueMuscleOf===null` gate зависит от каталога | явный JUNK+PL список |
| P0-7 | `bb-finalize:1897` | `earlyReturn if(any prepProtocol)` включая `Пропущена` | `!startsWith('Пропущена')` |
| P0-8 | `bb-finalize:2331` + `bb-contest-prep:998` | `applyTaperToFinalWeeks` без идемпотентности | `taperApplied` флаг + `origVolumes` кэш |
| P0-9 | `bb-validator:113,59` | `NaN` bypass `weight<0/false` | `!isFinite` guard |
| P0-10 | `BbAutoConstructor:2650` | нет `busy` на `buildBb` | `isBuilding`+disabled |
| P0-11 | `BbAutoConstructor:983,1011,1197` | `setBbWeeks(cycle.meta.weeks)` без clamp, `ctx.weeks NaN→NaN` | `clamp(4,24)` + `isFinite` в `annualBlockCtxToPrepPatch:251` |
| P0-12 | `bb-contest-prep:994` | `isDeload` на мутированном `weeks` | кэш до цикла |
| P0-13 | `bb-rotation` / `bb-selection` | `FOCUS_REPS_TABLE:40` мёртвая, `LEVEL_REP_MOD`, `dupRepsOffset:1857` | удалить/оживить |
| P0-14 | `BbAutoConstructor:457` | `spec-block-${length+1}` коллизия после удаления | `maxId+1` |

### P1 — важное
* Двойной recovery `bb-builder:2370` vs `bb-volume:195`, `cut×0.75` только на rotation `2389` не на `mrvByMuscle:2447`, `perExCap 8/6/5` тройной `bb-finalize:2101`/`sessionShareFor`/`buildSession:2032` → freeze `5`, `prescribeLoad:2829` без `nextRIR`, `HEAVY_GROUPS` `bb-day-types:36` vs памп ног, `finalize:2047 preserveSource` фейк fit, `cap-adjust:2518` без `isPrepControlled`, `bb-weakpoint:21` / `FOCUS_REPS_TABLE`, `bb-frequency-optimizer:59` typo `muscleGroup`, `bb-tempo-rest:33,77` substring.

### P2 — качество
* God-файл `3679`, `TAG_MUSCLES FullBody arms`, `ROTATION_PAIRS` порядок-зависим, `bb-safety-score:72 acwr||1.0` маскирует `null`, `days.size<1` флаг, `bb-validator:194 ×1.15` скрывает overflow, `step pill` без `aria-current`, `PopupNumber` без clamp, `goAnnual` глотает квоту.

### Фичи «кнопка 0 эффекта» — оживить (все)
`trainingFocus reps`, `favoriteExercises +15`, `superset/volumeScheme/rotation` gate `pattern.id:2507`, `autoReg/lab` до `earlyReturn`, `eccentricMult`, `previousPlan` faithful, `planStartWeek` per-week, `sync` после `autoAssignIntensityTechniques:2473` (render-only `bb-technique-display`), `mobility` фейк `{id:muscle}` → `null`+rationale.

## 3. Покрытие — дыры
injury expiry per-week, `weeks 52 clamp`, `workMax NaN/Infinity`, `mobility×5`, `self-donor`, `excluded RU vs id`, `female_glute_5 days3`, `all-worst 0.6×0.7`, `beginner объёмный→24`, `enhanced 6г объёмный→60`, `GVT cap5` — нет тестов. `BbAutoConstructor` 0 RTL кликов.

## 4. Новые уточнения пользователя (входят в максимальный план)

| Требование | Реализация |
|---|---|
| **Кнопка «Объёмный тренинг ↔ Обычный» с пояснениями** | `BbAutoConstructor:params` секция `📦 Объём`: 2 чипа + `ⓘ` попап (`Обычный=MAV`, `Объёмный=+памп+GVT/FST-7 только intermediate+`, капы те же `perEx5` GVT `10→5+5`) `src/engines/bb/bb-builder.engine.ts:183` gate убрать |
| **Капы от уровня** | Бейдж `Лимит: 24/40/60` из `sessionLimitsFor(level,years,onCourse):152` + `back/leg/torsoProfile:192` (`beginner 24/10`, `enhanced 1г 40/14`, `6г 60/18`); объёмный не поднимает выше уровневого капа — `beginner` без фармы `60` дизейбл |
| **Дефицит/восстановление как сейчас** | ACWR чип `bb-builder:126-132` + `computeBBRecoveryScore:70` — без новых кнопок |
| **Дефолт 24 с фармой — норма** | `24` = `intermediate natural`, `40` = `enhanced 1-3г`, `60` = `enhanced 6г` — оставляем |

**Логика капов:** `baseMrv=landmarksForRotation(level,muscle,rotationDays):2419` → `regime=computeRegimeMrvMult():51 ×1.0/1.9-2.15` → `recovery=computeBBRecoveryScore:70 ×0.7-1.1` → `effectiveCap=base*regime*recovery*lab*nutrition`; `high_volume` лишь не даёт `cut/recovery` срезать ниже `×0.95`.

## 5. Фазы максимального плана (капы frozen)

**Ф0 — гарды (1д):** clamp `bbWeeks 4-24`, `workMax finite`, `ctx.weeks`, `earlyReturn Пропущена`, `taper origVolumes`, `spec-block maxId+1`, `busy`, `QuotaExceeded` toast.

**Ф1 — объёмная кнопка + бейдж (1д):** `trainingVolumeMode` проброс, бейдж `sessionLimitsFor`, дизейбл `Объёмный` для `beginner`.

**Ф2 — проводка фич (2д):** убрать `pattern.id` gate `finalize:1969,2507,2605`, favorite/eccentric/rotation в `buildSession:1025`, `planStartWeek` per-week, `autoReg/lab` до `earlyReturn`, `sync` после техники.

**Ф3 — консолидация (1д):** единый `INDIRECT_COEFF`, fix `sessionLimitsFor` ветвь, `level enum`, `TAG_MUSCLES FullBody → biceps/triceps`, удалить/оживить мёртвые таблицы.

**Ф4 — тесты (1-2д):** 15 интеграционных + RTL E2E `render→split→specBlock chest_upper donor biceps reduce→Build→assert weeks12 + no errors + he_bb_plans+1` + проверка `beginner объёмный→24`, `enhanced 6г объёмный→60`, `GVT cap5`, `superset всегда`.

## 6. Приёмка
* `tsc 0`, `vite build OK`, `bb 1123+15` зелёных, `beginner` не получает `60`, повторный `finalize` не `×0.56`, каждая кнопка даёт след в `BBPlan`.

## 7. Связь с исходным планом
Исходные этапы 0-12 — база; этот план наследует их DONE-результаты и доводит их до финальной консистентности с фокусом на «каждая кнопка работает, капы от уровня, объёмный с пояснениями». Отдельно остаётся non-blocking `target-volume+feeder глубже объединить` — перенесено в бэклог после Ф4.
