# Аудит ББ-авто, Taper и Contest Prep

**Дата:** 24.09.2026
**Статус:** P0/P1/P2 remediation завершена; line-level аудит закрыт, safety/validation/MRV/autocoach и cycle/library parity подтверждены тестами.
**Цель:** зафиксировать реальные разрывы между конфигом, сохранённым планом, UI, persistence, экспортом и применением к ББ-плану.

## 1. Область и ограничения

Проверены:

- `bb-contest-prep.engine.ts`: конфиг, валидация, build plan, peak week, nutrition targets, exports, trial storage;
- `bb-contest-prep-sync.ts`: запись, чтение, миграция, события;
- `BbAutoConstructor.tsx`, `bb-contest-prep-sections.tsx`, `TaperPlannerTab.tsx`, `IndividualPlanContext.tsx`, `PeakWeekTab.tsx`;
- `bb-builder.engine.ts`, `bb-volume.engine.ts`, `cycle-to-plan.ts`, `bb-autocoach.engine.ts`;
- BB validation/quality/stale-state и safety-score callsites;
- Prep-cycle, cycle conversion и direct API paths.

Не изменялись и не должны затрагиваться чужие WIP из `git status`, включая Android/OCR/arm/annual-training изменения.

## 2. Базовая проверка

Узкий regression-набор прошёл:

- 6 файлов;
- 25 тестов;
- 0 падений.

Проверенные файлы:

- `src/engines/bb/__tests__/bb-export-report.test.ts`
- `src/engines/bb/__tests__/bb-quality-report.test.ts`
- `src/engines/bb/__tests__/bb-validation-severity.test.ts`
- `src/engines/bb/__tests__/bb-load-revalidation.test.ts`
- `src/engines/bb/__tests__/bb-edit-validation.test.ts`
- `src/ui/screens/TrainingScreen_parts/__tests__/bb-plan-validation-view.test.ts`

После remediation:

- `bb-contest-prep-professional-audit.test.ts`: 15 passed, 0 todo;
- `bb-quality-report.test.ts`: 11 passed;
- `bb-plan-validation-view.test.ts`: 6 passed;
- `bb-validator.test.ts`: 3 passed;
- полный `src/engines/bb`: 2850 passed, 4 skipped, 20 skipped;
- `tsc --noEmit` с `NODE_OPTIONS=--max-old-space-size=12288`: 0 ошибок;
- `git diff --check`: без ошибок.

## 3. Severity

- **P0** — потенциально опасный safety-разрыв или ложное подтверждение применения.
- **P1** — потеря реального состояния, неверная безопасность/стратегия, либо silent failure на production-поверхности.
- **P2** — локальная потеря/несогласованность без немедленного safety-эффекта.

## 4. Findings

### P0/P1 — безопасность и применение

#### CP-01 — `buildPeakWeek` и date API обходят `blockedProtocol`

**Источник:**

- `bb-contest-prep.engine.ts:388` — `KNOWN_CONTRAINDICATIONS` содержит только `kidney`, `heart`, `hypertension`;
- `bb-contest-prep.engine.ts:476-489` — matcher знает 8 противопоказаний, включая `diabetes`, `pregnancy`, `eating_disorder`, `seizures`, `electrolyte`;
- `bb-contest-prep.engine.ts:630-633` — `applyForcedModes` использует только validation;
- `bb-contest-prep.engine.ts:976-979` — `buildPeakWeek` применяет `applyForcedModes`, но не `manipulationLockedFor`/`blockedProtocol`;
- `bb-contest-prep.engine.ts:1519-1526` — `peakWeekDayForDate` делает то же;
- `bb-contest-prep.engine.ts:1772`, `:1835` — overlay paths напрямую передают raw config в `buildPeakWeek`.

**Runtime-доказательство:**

Для `diabetes`, `high` + `cut_2d` + `hasTrialPeak` + `confirmedManipulation`:

- `buildBBContestPrepPlan(...).safety.blockedProtocol = true`;
- `buildPeakWeek(...)[6].waterLiters = 0.9`;
- `buildPeakWeek(...)[6].sodiumMg = 900`;
- `peakWeekDayForDate('2026-10-10', cfg)` также возвращает `0.9 л / 900 мг`;
- `manipulationLockedFor(cfg) = false`.

Для `kidney/heart/hypertension` plan builder принудительно переводит режим в stable, но прямой `buildPeakWeek` всё равно не использует safety-plan и даёт агрессивные значения `1.7 л / 2000 мг` в show-day.

**Риск:** production overlay может применить высокую водную/натриевую манипуляцию к пользователю, для которого plan builder уже выставил `blockedProtocol`.

**Acceptance:**

1. `buildPeakWeek`, `peakWeekDayForDate`, `buildTrainingTaper`, `applyTrainingTaperToBBPlan`, `applyPeakWeekOverlayToBBPlan` и `applyContestPrepToBBPlan` используют одну safety-функцию.
2. Все 8 противопоказаний из `hasContraindication` дают stable water/sodium и отсутствие агрессивного режима.
3. `requiresReview`/`blockedProtocol` plan и overlay всегда совпадают.
4. Для direct API отсутствие подтверждения не должно давать high/cut.

#### VAL-01 — stale validation result попадает в quality/UI

**Источник:**

- `bb-finalize.engine.ts:4816-4827`;
- `bb-builder.engine.ts:4654`;
- `BbAutoConstructor.tsx:2876-2879`;
- `bb-quality-report.engine.ts:147+`.

После revalidate/quality-build UI может показать старую валидность или старую ошибку. В quality report одновременно возможны `validationValid=true`, `ok=true` и issue `sets_mismatch`.

**Acceptance:** результат validation, quality и UI должен быть одним snapshot с plan nonce; изменение weeks/sessions/exercise edits обязано инвалидировать старый результат.

#### VAL-02 — fail-open malformed validation view

`bb-plan-validation-view.ts:93+` получает `{ weeks: null }` и возвращает `ok:true` с пустыми `errors/warnings/infos`.

**Acceptance:** malformed plan → `ok:false`, explicit `invalid-input` и отсутствие «безопасного плана».

#### VAL-03 — `all_clear` игнорирует критические issues

`bb-validator.engine.ts:394+` не включает `sets_mismatch`, `invalid_work_set`, `excluded_muscle_present`, `tendon_limit_exceeded` в conservative error path.

**Acceptance:** любой safety/integrity issue не может давать `✅ План безопасен` или `all_clear`.

#### VAL-04 — quality report противоречит validation

`bb-quality-report.engine.ts` может вернуть `validationValid:true` и `✅ План безопасен для выполнения` при `sets_mismatch`.

**Acceptance:** quality report обязан наследовать final validation state; safety badge и issue list не могут расходиться.

#### VAL-05 — injury safety score callsites теряют детали

`calculatePlanSafetyScore` учитывает ROM, push/pull и mobility restrictions, но callsites передают только `injuryCount`:

- `BbAutoConstructor.tsx:2606`;
- `BbAutoConstructor.tsx:2621`;
- `BbAutoConstructor.tsx:3020`.

**Acceptance:** save/export/plan safety используют полный список ограничений, не только count.

### P1 — trial, persistence и round-trip

#### CP-02 — trial ID используется как plan ID

`configFromPlan` (`bb-contest-prep.engine.ts:2783-2784`) вызывает:

```text
latestTestPeakWeek(plan.testPeakWeekId)
```

Но `latestTestPeakWeek` (`bb-contest-prep.engine.ts:3153-3159`) ищет `t.planId === переданному planId`.

Дополнительно:

- `saveTestPeakWeekResult` добавляет записи через `unshift`;
- UI `BbAutoConstructor.tsx:704-708` проверяет `arr[arr.length - 1]`, то есть самую старую запись;
- `loadContestPrepConfig` сначала возвращает raw `bbPeakConfig`, поэтому исправление только `configFromPlan` не устраняет dual-source drift.

Runtime с двумя trial-записями:

- `latestTestPeakWeek(planId)` возвращает новую;
- `configFromPlan({ ...plan, testPeakWeekId: olderTrialId })` не находит trial;
- `hasTrialPeak` отсутствует, доза и water mode становятся дефолтными.

**Acceptance:**

1. Единый lookup helper по `plan.id`;
2. newest-first во всех чтениях;
3. raw config merge не может затереть plan-level trial state;
4. trial ID и результат должны round-trip после reload/двух записей.

#### CP-03 — persistence failure выглядит как успех

`bb-contest-prep-sync.ts:37-95`, `:138-166`, `:168-181` ловят ошибки `updateProfile` и продолжают:

- `saveContestPrepEverywhere` возвращает plan;
- `storeContestPrepPlan` возвращает `void`;
- `clearContestPrepEverywhere` возвращает `void`;
- event dispatch выполняется после неуспешной записи.

Quota runtime:

- `saveContestPrepEverywhere` вернул non-null plan;
- event был dispatched `1` раз;
- `loadContestPrepPlan()` вернул `null`.

**Acceptance:** persistence возвращает success/error; failed write не показывает toast/flash успеха и не отправляет update event; clear аналогично.

#### CP-04 — повреждённый plan принимается и блокирует миграцию

`deserializeBBContestPrepPlan` (`bb-contest-prep.engine.ts:2678-2714`) проверяет только верхнюю форму. Принимаются:

- `phases:[null]`;
- `phases:[]`;
- отсутствующие `taper/peakWeek/safety` или неполный `preparation`.

`configFromPlan` затем падает на `plan.taper.weeks`; print/report paths могут падать на `phase.label`.

`migrateLegacyContestPrepIfNeeded` (`bb-contest-prep-sync.ts:190-218`) использует `hasPlan = !!storedPlan`, поэтому битый plan блокирует fallback, даже если рядом валидный legacy config.

**Acceptance:** deserializer валидирует вложенные поля; migration использует результат `loadContestPrepPlan`, а не truthiness JSON; corrupt plan → repair/fallback/error state без exception в UI.

#### CP-05 — plan projection теряет PED/RED-S/контекст

`BBContestPrepPlan` не хранит полный `BBContestPrepConfig`, а `configFromPlan` восстанавливает только часть. Теряются:

- `heightCm`;
- `bodyFatPct`;
- `cycleDay`;
- `enhanced`;
- `experienceLevel`;
- `prepCount`;
- `pedContext`;
- `hasTrialPeak` без корректного lookup;
- `schedule`;
- `confirmedManipulation`.

Из-за этого повторный build может изменить carb tolerance, water, luteal warnings и RED-S warnings.

#### CP-06 — `TaperPlannerTab` перезаписывает полный config минимальным

`TaperPlannerTab.tsx:861-875` создаёт минимальный config без:

- `heightCm/bodyFatPct/cycleDay`;
- `experienceLevel` из профиля;
- `enhanced/pedContext`;
- `prepCount`;
- `hasTrialPeak`;
- `testPeakWeekId`;
- `schedule/competitions/contraindications`.

Затем вызывается `saveContestPrepEverywhere`, который сохраняет этот raw config поверх существующего плана.

Runtime:

- plan-level `carbDoseGPerKg=10` и `testPeakWeekId` сохранились;
- raw config после save: `enhanced=false`, `prepCount=0`, без height/bodyFat/cycle/trial.

**Acceptance:** любой production caller, который может сохранить поверх существующего плана, обязан merge с existing config; raw config и plan должны сохраняться из одного authoritative snapshot.

#### CP-07 — shift/extend теряют trial dose и safety context

`BbAutoConstructor.tsx:815-825` и `:840-852` вызывают `applyContestPrepToBBPlan(..., { force:true })`, но не передают `carbDoseGPerKg`; `cfg` строится через lossy `buildContestPrepConfig`.

**Acceptance:** shift/extend должны использовать тот же plan snapshot, что и основной build: trial dose, hasTrial, PED/RED-S, confirmed manipulation и contraindications.

#### CP-08 — weekly report не содержит taper/peak

`buildPrepWeeklyReportHtml` (`bb-contest-prep.engine.ts:3824-3843`) делает `total = plan.preparation.weeks`, поэтому при `prepWeeks=8`, `taperWeeks=2` строки заканчиваются на preparation week 8.

**Acceptance:** отчёт должен включать `preparation + final_preparation + taper + peak_week + show_day`, с датами и check-in rows.

#### CP-09 — print path теряет trial dose

`buildContestPrepPrintHtml` (`bb-contest-prep.engine.ts:3617-3620`) вызывает `buildPeakWeek(configFromPlan(plan))` без `plan.peakWeek.carbDoseGPerKg`.

Для live `carbDoseGPerKg=10` HTML и plan peak-week расходятся по carb budget/dose.

**Acceptance:** print должен использовать `plan.peakWeek.carbDoseGPerKg` и trial-resolved config, как live nutrition path.

#### CP-10 — weekly report/coach strategy stale after successful trial

`buildBBContestPrepPlan` сохраняет `peakWeek.strategy` как `conservative/moderate`; `resolvePeakStrategy(plan)` отдельно возвращает `tested`.

Runtime:

- `plan.peakWeek.strategy = moderate`;
- `resolvePeakStrategy(plan) = tested`;
- `buildPrepWeeklyReportHtml` печатает `moderate`;
- `buildContestPrepPrintHtml`/`buildPrepCoachJson` не показывают resolved strategy.

**Acceptance:** serialized `peakWeek.strategy` и все UI/export paths должны использовать один resolver.

#### CP-16 — trial storage не устойчив к corrupt JSON shape

`saveTestPeakWeekResult` (`bb-contest-prep.engine.ts:3143-3148`) не проверяет `Array.isArray(list)`. При `he_bb_test_peak_weeks='{}'` функция возвращает результат, но запись остаётся `{}`, `latestTestPeakWeek` возвращает `null`.

**Acceptance:** corrupt/non-array storage → безопасный reset/fallback; результат либо реально сохранён, либо caller получает failure.

### P2 — локальные потери и несогласованности

#### CP-11 — `addPeakPriming` дублирует упражнение

`bb-contest-prep.engine.ts:1347-1390` заявляет «не добавляет новые упражнения», но prepend-ит копию primary с `sets=3` и `workSets=3`.

Runtime: `added=1`, `count` упражнений вырос, `duplicateBench=2`.

#### CP-12 — `extendBBPlanPreparation` не обновляет `contestPrep.phases`

`bb-contest-prep.engine.ts:2048+` меняет BB weeks, но оставляет старые phase metadata. Production handler затем заново применяет plan; standalone API остаётся несогласованным.

#### CP-13 — `replanBBContestPrep` не пересчитывает taper profiles

`bb-contest-prep.engine.ts:2619-2631` меняет `taper.weeks`, но сохраняет старые `volumeProfile/intensityProfile/rirProfile` длины 2.

#### CP-14 — high-water mode не round-trip-ится

`configFromPlan` восстанавливает только `moderate → tapered`, `stable → stable`; `high/classic` теряется и становится `tapered`/stable в следующих consumers.

#### CP-15 — schedule не входит в serialized plan

`buildShowTimeline` (`bb-contest-prep.engine.ts:1237-1239`) использует `cfg.schedule`, но plan не сохраняет schedule. После reload применяются defaults `07:00/12:00`.

#### CP-17 — plan ID недетерминирован

`buildBBContestPrepPlan` (`bb-contest-prep.engine.ts:2556-2558`) использует `Date.now()` и `Math.random()`.

#### CP-18 — `validateBBContestPrepConfig` использует UTC-дата вместо локальной

`bb-contest-prep.engine.ts:513-514` использует `new Date().toISOString().slice(0,10)`, хотя рядом уже есть `isoToday()` (`bb-contest-prep.engine.ts:445-449`).

#### CP-19 — Prep-цикл не передаёт peak `pedContext`/trial context — закрыт 2026-09-25

`PrepCycleConfig` и `PrepSeasonConfig` теперь сохраняют и передают `heightCm`, `cycleDay` и `pedContext` в `prepCfg`; production wiring Prep-цикла и сезона берёт рост/цикл из профиля и PED-контекст из курса. Trial не дублируется отдельным флагом: `buildBBContestPrepPlan` разрешает `testPeakWeekId` через канонический lookup. Покрыто `bb-prep-cycle.test.ts` и UI SSR smoke.

#### BB-MRV-01 — финальный `normalizeWeekMrv` теряет `onCourse`

Промежуточный вызов передаёт `{ level, trainingYears, onCourse }`, но финальные вызовы в `bb-builder.engine.ts` около `:4200` и `:4291` передают options без `onCourse`.

Прямой probe:

- `advanced`, `trainingYears=1`, `onCourse=undefined` → `sets=5`;
- `onCourse=false` → `sets=5`;
- `onCourse=true` → `sets=6`.

Generic runtime build не показал `sets>5`, поэтому finding пока source parity gap, а не доказанный пользовательский overflow.

#### BB-MRV-02 — `convertCycleToBBPlan` не имеет typed `onCourse`

`cycle-to-plan.ts:364+` не содержит `onCourse`; `:1543/:1554` используют `(input as any).onCourse`. `programToBBPlan` корректно выводит `onCourse` из PED.

`CYCLE_08` probe с custom 6-set shoulders и `onCourse:true` через `as any` дал `diffCount=0`; после conversion/finalizer осталось 5 sets.

**Acceptance MRV:** generic builder и cycle/program paths должны использовать одну course-aware final cap; conversion должен иметь typed `onCourse`/`peds` source.

### BB-auto autocoach/RIR

#### BB-AUTO-01 — peaking получает `rest_pause`

`bb-autocoach.engine.ts:311-315` задаёт `DEFAULT_TECHNIQUE_BY_PHASE.peaking='rest_pause'`; `applyPostPhaseProcessing` (`bb-autocoach.engine.ts:782+`) применяет технику к peaking без taper/peak guard.

Runtime minimal plan:

- `sets=3`, `workSets=5`;
- `comment` содержит `[Пик] · 🎯 Rest-pause финальный сет`.

#### BB-AUTO-02 — RIR drift достигает 0

`bbRir` (`bb-builder.engine.ts:989-1019`) получает phase-local `phaseWeek`; `FOCUS_RIR_TABLE` допускает drift до 0.

Runtime:

- `strength/accumulation`: `1 → 0 → 0 → 0`;
- `strength/intensification`: `0 → 0 → 0 → 0`;
- `strength/peaking`: `1 → 0 → 0 → 0`;
- `hypertrophy/intensification`: `1 → 0 → 0 → 0`.

В taper/peak ожидаемый safety floor должен оставаться минимум 1–2 RIR; failure sets не должны появляться из фазового drift.

## 5. Safety-gate matrix

| API/поверхность | `kidney/heart/hypertension` | `diabetes/pregnancy/eating_disorder/seizures/electrolyte` | Статус |
|---|---:|---:|---|
| `buildBBContestPrepPlan` | stable + review | stable/blocked в plan metadata | неполный контракт |
| `buildPeakWeek` | не использует plan `blockedProtocol` | может вернуть 0.9 л/900 мг | P0/P1 |
| `peakWeekDayForDate` | обходит gate | обходит gate | P0/P1 |
| `applyTrainingTaperToBBPlan` | зависит от forced modes | raw config path не заблокирован | P0/P1 |
| `applyPeakWeekOverlayToBBPlan` | зависит от forced modes | raw config path не заблокирован | P0/P1 |
| `applyContestPrepToBBPlan` | inner gate частично есть | `blockedProtocol` plan не переносится в raw overlay | P0/P1 |

## 6. Regression-контракты

Будущий файл аудита:

`src/engines/bb/__tests__/bb-contest-prep-professional-audit.test.ts`

Обязательные `it.todo`/future contracts:

1. `buildPeakWeek` и `peakWeekDayForDate` возвращают stable для всех известных противопоказаний.
2. `buildContestPrepPlan.safety.blockedProtocol` и результат overlay совпадают.
3. `configFromPlan` находит trial через plan ID и использует newest-first.
4. `saveTestPeakWeekResult` не возвращает успешный результат без записи.
5. `saveContestPrepEverywhere`, `storeContestPrepPlan`, `clearContestPrepEverywhere` не dispatch-ят success event при quota failure.
6. `deserializeBBContestPrepPlan` отклоняет null/incomplete phase entries без исключения.
7. `migrateLegacyContestPrepIfNeeded` чинит corrupt plan при валидном legacy config.
8. `configFromPlan` round-trip сохраняет PED/RED-S/trial/schedule context.
9. TaperPlanner save не затирает существующий rich config.
10. shift/extend сохраняют trial dose и safety config.
11. weekly report включает preparation/taper/peak/show.
12. print/report/coach используют resolved tested strategy и plan dose.
13. `addPeakPriming` не увеличивает число упражнений.
14. `extendBBPlanPreparation` и `replanBBContestPrep` пересчитывают metadata.
15. `saveTestPeakWeekResult` восстанавливается из corrupt non-array storage.
16. финальный `normalizeWeekMrv` получает `onCourse` во всех builder/cycle paths.
17. `convertCycleToBBPlan` не использует `as any` для `onCourse`.
18. peaking не получает `rest_pause`/failure techniques.
19. RIR в taper/peak не опускается ниже safety floor.
20. validation malformed/error никогда не даёт `all_clear`.

## 7. Матрица применения методик

Проверка выполнялась по всей цепочке: UI → state/variant storage → builder/converter → finalizer → generated fields → plan rationale → print/CSV/coach export → tests.

| Методика | Generic builder | Cycle/library path | Что реально применяется | Изменение состава/caps/output | Статус |
|---|---|---|---|---|---|
| `compound_first` | Да | Да, но через default | Только порядок упражнений | Нет | Работает |
| `pre_exhaust` | Да | Да, `cycle-to-plan.ts` передаёт `input.methodology` | Один изоляционный стимул ставится перед соответствующим compound | Только порядок; число упражнений/loading не меняются | Работает; контракт покрыт тестом |
| `post_exhaust` | Да | Да, `cycle-to-plan.ts` передаёт `opts.methodology` | Изоляция ставится сразу после compound | Только порядок | Работает; default/natural output не меняется |
| `mountain_dog` | Да, order-only | Да, order-only | Активация → база → памп → растяжка; отдельного loading-пакета нет | Только порядок | Работает; loading не заявляется |
| `fst7` | Да, отдельный `volumeScheme` 7-in-1 | Да, `cycle-to-plan.ts`/finalizer с теми же gates | 7 подходов одним финишером только в enhanced adapt без joint-guard и соло-инсулина | Может менять число упражнений/сетов | Паритет generic/cycle/library; faithful = standard |
| `hyperemia` | Да, order-only | Да, order-only | Памп-изоляции перед тяжёлыми; отдельного loading-пакета нет | Только порядок | Работает; loading не заявляется |
| DUP | Overlay реально меняет характер дней | Поддержан отдельно в Prep-цикле и production wiring | Вид сессии, reps/RIR и маркеры | Да, методика намеренно меняет план | Работает, но не единый canon |
| Volume schemes (`pre_exhaust`, `drop_set`, `rest_pause`, `myo_reps`, `negative`, cluster) | Распределяются finalizer/builder по уровню и фазе | Частично наследуются конвертером | Нужна проверка каждого output-поля отдельно | Обычно да | Есть незакрытые parity-гейты |

### N1 — `methodology` parity между generic и cycle/library path

До remediation `cycle-to-plan.ts` передавал `undefined` в `tidySessionExercises`, поэтому выбор пользователя мог сохраняться в metadata, но не менять порядок в adapt-режиме. Сейчас оба converter path передают typed `methodology` (`input.methodology` для `convertCycleToBBPlan`, `opts.methodology` для `programToBBPlan`). `pre_exhaust`, `post_exhaust`, `mountain_dog`, `fst7` и `hyperemia` являются order-only контрактами, если не выбран отдельный совместимый `volumeScheme`; loading, число упражнений, reps/load/RIR и default/natural baseline не изменяются. `methodologyApplied` в faithful явно равен `false`, а report не выдаёт выбранный порядок за применённый. Это покрыто cycle/program/report regression-тестами.

### N1.1 — FST-7 loading gate и сохранение фактической схемы

`fst7` как `methodology` меняет только порядок. 7-in-1 loading включается отдельным `volumeScheme='fst7'` и теперь проходит через общий enhanced/joint-guard/соло-инсулин gate в generic, cycle и program paths. В faithful и при не пройденном gate фактический output — `standard`, а пользовательский выбор остаётся в `inputSnapshot`; rationale/report не выдают неприменённую схему за активную. BbAuto сохраняет этот metadata-слепок после калибровки весов.

### N2 — Prep-cycle/Prep-season authoritative safety projection

`bb-prep-cycle.engine.ts` и сезонный builder уже используют единый projection в `BBContestPrepConfig`: передаются `waterStrategy`, `sodiumStrategy`, `carbLoadStrategy`, `confirmedManipulation`, `currentCalories`, `prepVolumeMult`, `contraindications`, `pedContext` и расписание соревнований. Preview, build и сохранённый plan используют один нормализованный источник; отсутствующие значения получают safety-first defaults (`stable`), а не случайные значения из другого surface.

## 8. Internet-исследование 2024–2026 и границы решений

### 8.1. Periodization и taper

- Systematic review/meta-analysis 2024: https://pubmed.ncbi.nlm.nih.gov/35044672
- Практические ограничения и безопасная реализация: https://bjsm.bmj.com/content/bjsports/57/18/1211.full.pdf

**Вывод для проекта:** непрерывность упражнений, сохранение привычного движения, снижение объёма при сохранении/росте интенсивности и отдельный taper-блок подходят; попытка сделать каждую неделю недельным peak не нужна.

### 8.2. Пол и менструальный цикл

- Обзор evidence-based periodization: https://journals.lww.com/nsca-scj/fulltext/2025/12000/evidence_for_periodizing_strength_and_or_endurance.4.aspx
- 12-недельное исследование RT у женщин и мужчин: https://pmc.ncbi.nlm.nih.gov/articles/PMC12421175

**Вывод:** при сопоставимом training volume, intensity и frequency реакция на RT у женщин в значительной части общей; оснований создавать отдельные male/female rep/range/shift деревья нет. Цикловую фазу можно использовать как advisory-контекст, но не как автоматический пересчёт всего плана.

### 8.3. Superset, cluster, BFR

- Метаанализ superset vs traditional training, 2025: https://pubmed.ncbi.nlm.nih.gov/39903375
- Cluster sets, 2026: https://link.springer.com/article/10.1186/s13102-026-01550-x
- BFR систематический обзор, 2025: https://pubmed.ncbi.nlm.nih.gov/39835205

**Вывод:** отдельные loading-протоколы допустимы для опытных атлетов и должны иметь собственные caps/order/exit criteria. Они не должны включаться новичку, в taper/peak либо менять weekly MRV скрыто.

### 8.4. Статус feature-кандидатов

| Кандидат | Решение | Ограничение |
|---|---|---|
| Пол отдельной loading-методикой по умолчанию | Не включать | При равных объёме/интенсивности/частоте доказательной базы для радикально иных шаблонов недостаточно |
| Автоматическая смена reps/load по менструальной фазе | Не включать | Только наблюдение/подсказка без изменения недельных targets |
| Cluster/BFR как opt-in для experienced/advanced | Кандидат после method-parity | Не новичкам, не taper/peak, не скрытый weekly-MRV bypass |
| Mountain Dog/FST-7/Hyperemia отдельными loading-пакетами | Кандидат после method-parity | Только при наличии измеримого effect в `workSets`, rationale и export |
| `pre_exhaust`/`post_exhaust` | Исправить parity во всех paths | Меняют порядок; reps/load/RIR не должны меняться без отдельного контракта |
| DUP | Сохранить как реально применяемый opt-in overlay | Не смешивать с order-only значениями `methodology` |

## 9. Acceptance criteria по влиянию на output

1. **Default/natural без методики:** байт-в-байт совпадает с baseline: упражнения, sets/workSets, reps, load, RIR, order, MRV и rationale.
2. **`pre_exhaust`/`post_exhaust`:** меняется только порядок; число упражнений и loading остаются прежними.
3. **`fst7`/`mountain_dog`/`hyperemia`:** order-only методы отмечаются только как порядок; FST-7 loading включается только через отдельный `volumeScheme` с явным gate и фактическим output.
4. **Cycle/library/generic:** одинаковый `methodology` даёт одинаковый семантический контракт; faithful не получает order/volume rewrite; private `as any` для `onCourse`/`methodology` отсутствует.
5. **Taper/peak:** method не назначается в phase/taper/peak; RIR не опускается ниже safety floor.
6. **Plan safety:** validation/quality/UI используют один snapshot; malformed/consent-red отсутствующие данные не дают fail-open.
7. **Config round-trip:** PED, RED-S, height, cycle day, experience/prep count, schedule, competition set, trial id/dose, confirmation и contraindications сохраняются без догадок.
8. **Persistence:** write failure возвращается вызывающему коду; success event не отправляется; corrupt plan не блокирует валидную legacy migration.
9. **Sex/cycle context:** мужчины и женщины с одинаковыми training inputs сохраняют одинаковую loading-семантику; цикл используется только как контекст/advisory.
10. **Проверка:** targeted tests, полный BB circle, `tsc --noEmit`, `git diff --check`; известная чужая arm-ошибка фиксируется отдельно.

## 10. Итог

P0/P1/P2 remediation завершена:

- safety gate, trial/confirmed-manipulation contract и authoritative snapshot wired во все plan/direct/overlay пути;
- persistence, corrupt-storage migration, config round-trip и export parity подтверждены;
- validation/quality fail closed при malformed или отсутствующей валидации;
- cycle/library `methodology` parity и Prep-cycle safety projection подтверждены;
- final MRV normalization получает `onCourse`, RIR имеет safety floor, peaking не получает failure techniques;
- BB plan validation/quality/UI tests и полный BB circle прошли без новых падений.

Оставшиеся ограничения — осознанные границы: `mountain_dog` и `hyperemia` не получают отдельный loading-пакет без измеримого контракта; FST-7 loading разрешён только в enhanced adapt без joint-guard/соло-инсулина, а в faithful всегда остаётся `standard`. Предыдущие remediation-коммиты сохранены; текущий follow-up methodology остаётся локальным до отдельной проверки/коммита.
