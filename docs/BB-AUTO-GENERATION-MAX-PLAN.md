# План доведения ББ-авто до максимального уровня

Дата: 2026-07-31
Статус: основной pipeline завершён; остаются non-blocking улучшения target-volume planner и UI smoke coverage

## Цель

Довести генерацию ББ-программы до детерминированного тренерского pipeline с едиными правилами выбора упражнений, порядка, direct/effective volume, fatigue budget, MRV-контроля и финальной валидации.

## Этап 0. Baseline

- Зафиксировать `tsc --noEmit`, `vite build`, Vitest.
- Проверить `fullbody_3`, `upper_lower_4`, `ppl_6`, `bro_5`, `phul_4`, rolling и glute-focus.
- Проверить natural/PED, injuries, equipment и avoid-axial режимы.
- Снять метрики: упражнения/сессия, общий объём, объём по мышцам, MEV/MAV/MRV, частота, порядок, feeders, дубликаты и неправильная атрибуция.

## Этап 1. Единая модель мышц и объёма

- Создать единый нормализатор BB-мышц.
- Устранить расхождения между `muscle`, `group`, `trueMuscleOf`, `collapseKey`, `repKey`.
- Ввести direct, indirect, effective и fatigue-weighted sets.
- Разделить объём за ротацию и нормализованный объём за 7 дней.

Реализовано:

- `src/engines/bb/bb-volume.engine.ts` — единая нормализация и direct/effective aggregation.
- `bb-metrics.engine.ts` использует effective volume для статуса MEV/MAV/MRV.
- Добавлены unit-тесты `bb-volume.test.ts`.

## Этап 2. Планировщик целевого объёма

- Создать `bb-volume.engine.ts`.
- Рассчитывать MEV/MAV/MRV и target volume до выбора упражнений.
- Учитывать частоту, ротацию, цель, specialization, weak points, PED, recovery, nutrition, lab и ACWR.
- Учитывать minimum/maximum sets per session.
- Встроить feeders в target-volume планирование, а не добавлять их бесконтрольно постфактум.

Реализовано:

- `buildBBVolumeTarget()` рассчитывает target, minimum и maximum sets/session.
- `BBPlan.volumeTargets` сохраняет целевые объёмы.
- UI показывает direct/effective/target sets.
- Generic, проф-циклы и FullProgram получают единый `volumeTargets`.

Остаточный риск: feeders пока выбираются отдельным финальным pass по фактическому effective deficit; следующий уровень — планировать feeder slots одновременно с target-volume allocation.

## Этап 3. Единый exercise planner

- Объединить `selectExercisesSmart`, angle diversity и специальные плечевые/мышечные блоки.
- Стабилизировать главные compounds на 3-5 недель.
- Ротировать вторичные compounds и изоляции по отдельным правилам.
- Обеспечить покрытие растянутой, средней и сокращённой позиции.
- Сделать единый fallback, сохраняющий muscle, type, equipment и injury constraints.

Реализовано:

- Adapt-пути используют общий anti-spam/tidy pass.
- Для малых мышц один movement pattern, для крупных максимум два.
- Primary и weak/focus priority защищены от удаления.
- Faithful-пути сохраняют исходный набор упражнений.
- `bb-rotation.engine.ts` диагностирует смену primary и повтор accessory patterns по неделям.
- Primary lift считается стабильным, а accessory rotation получает отдельные предупреждения.
- Deload safety определяется по `week.phase`/`week.deload`, а не только по комментариям отдельных упражнений.
- Controlled rotation в adapt заменяет повторяющийся accessory на каноническую альтернативу другой вариации/equipment.
- Faithful и primary lifts не ротируются автоматически.
- Controlled rotation учитывает фазу: accumulation → machine/cable/dumbbell, deload → machine/cable, intensification/peaking → barbell/Smith/machine.
- Controlled rotation уважает `equipment` пользователя во всех трёх BB-путях.
- Controlled rotation уважает `excludedExercises`, `avoidAxialLoad` и `excludedMuscles`/injury restrictions.
- При замене упражнения пересчитывается рабочий вес по equipment load ratio и добавляется пояснение в comment/rationale.
- `BBPlan.rotationReport` сохраняет primary stability и accessory rotation diagnostics для UI/export.
- `BBPlan.fatigueReport` сохраняет weekly/session time, systemic, axial, joint и local cost для UI/export.
- `BBPlan.weeklyVolume` сохраняет фактический post-processing direct/effective volume каждой недели.
- BB-auto UI использует `weeklyVolume` выбранной недели и показывает статус `MEV- / OK / MAV+ / MRV+`.
- `volumeLandmarks` пересчитываются после финального processing и совпадают с фактическим direct weekly volume.
- `calcBBPlanMetrics` использует финальные landmarks плана, включая lab/recovery/PED-коррекции.
- Финальный пересчёт landmarks сохраняет effective PED/lab MRV multiplier.
- `BBPlan.report` содержит export-safe summary по объёму, ротации и fatigue для всех BB-источников.
- `BBPlan.report` также содержит validation status, errors и warnings для сохранённых вариантов/export.
- Report разделяет total direct volume за мезоцикл и peak-week direct volume.
- Report/UI отдельно показывают количество `session_muscle_leak` предупреждений.
- `BBPlan.validation` сохраняет финальный valid/errors/warnings status и отображает блокирующие safety-ошибки в UI.
- Validator дополнительно проверяет order contract для generic/adapt (primary compound до accessory); faithful сознательно отключает только order rewrite/check, сохраняя исходный порядок.
- Кнопка «К выполнению» блокирует планы с `validation.valid=false`.
- При equipment restrictions неизвестное упражнение без каталожного профиля блокируется.
- Сохранение в localStorage, варианты, «Мои тренировки» и «Мои программы» также блокируется для invalid-планов.
- Все export-пути используют один и тот же snapshot после inline-правок и revalidation.
- Метрики сохраняемого варианта рассчитываются из того же export snapshot, а не из устаревшего UI state.
- Quality score сохранённого варианта также рассчитывается из export snapshot.
- Добавлены end-to-end safety tests для generic и проф-циклов с machine-only/avoid-axial ограничениями.
- Safety integration покрывает все 24 generic split patterns.
- Adapt safety-repair заменяет unsafe primary/accessory на допустимую альтернативу той же мышцы; faithful сохраняет исходник и блокируется validation.
- Adapt safety-repair заменяет неизвестные упражнения на подтверждённые каталожные варианты при equipment restrictions.
- `BBPlan.safetyConstraints` сохраняет ограничения для повторной проверки после ручных правок.
- Inline-правки пересчитывают validation перед сохранением варианта/плана.
- Загрузка сохранённого варианта повторно синхронизирует sets/workSets и validation.
- Автозагрузка `he_bb_plan_saved` использует тот же полный revalidation boundary.
- Ручная замена упражнения пересчитывает equipment-based weight и validation.
- Массовые ручные коррекции объёма/веса и перестановки проходят общий edit revalidation boundary.
- Повторный вызов финализатора идемпотентен: feeders и rotation не дублируются.
- Повторная финализация автоматически объединяет новые options с сохранённым safety-профилем.
- Validator проверяет phase invariants: deload volume reduction и минимальный deload RIR.
- Validator диагностирует muscle leakage между session tags, включая composite FullBody/Upper/Lower дни.
- Validator предупреждает о росте объёма в peak/taper-неделе.
- Сравнение сохранённых BB-вариантов показывает peak direct/effective sets, max duration и axial cost.

## Этап 4. Единый order engine

- Оставить один финальный `orderBBSessionExercises`.
- Устранить конкурирующий A3-сортировщик.
- Порядок: primary compound, secondary compound, secondary muscles, lengthened, mid-range, shortened isolation, small muscles, finishers, feeders.
- В этот же порядок явно включить руки: после косвенной нагрузки от жимов/тяг распределять biceps/triceps по остаточному effective-volume бюджету, не выдавать им независимый объём поверх уже превышенного overlap.
- Для рук разделять biceps, triceps и forearms; учитывать long/short head, положение плеча, overhead/elbow-extension и различать прямые сеты от косвенных сетов из жимов и тяг.
- Не позволять arm-guarantee добавлять фиксированные сеты после общего бюджета без повторного пересчёта effective volume и fatigue.
- Сохранить корректную работу `compound_first`, `pre_exhaust`, `post_exhaust`.
- Обрезать сессию только через приоритетный planner, а не простым удалением хвоста.

Реализовано:

- `orderSessionExercises()` принимает `priorityMuscles` для weak/focus.
- Generic builder передаёт weak/focus при каждом финальном reorder.
- Конкурирующий A3-проход удалён; общий `orderSessionExercises` — единственный финальный order authority.
- Общий `bb-finalize.engine.ts` применяется к generic, cycle и program outputs.

## Этап 5. Распределение сетов

- Распределять direct sets после расчёта effective target.
- Минимум 2 рабочих сета на упражнение.
- Сокращать сначала feeders, redundant isolation и вторичные упражнения.
- Не сокращать главный compound и единственное упражнение мышцы.
- После распределения пересчитывать фактический effective volume.

Реализовано:

- Общий fatigue pass сначала сокращает вторичные pump/isolation sets до минимума 2.
- Primary и единственное упражнение мышцы не сокращаются и не удаляются.
- После сокращения синхронизируются `sets` и `workSets`; фактический объём пересчитывается финализатором.

## Этап 6. Fatigue budget

- Разделить local, systemic, axial, joint и time cost.
- Учитывать exercise, sets, RIR, reps, tempo, rest, phase, level, recovery, PED и ACWR.
- Устранить универсальный `fatigueCost = 5`.
- Ограничить дневную усталость и длительность сессии.

Реализовано:

- `bb-fatigue.engine.ts` оценивает systemic, axial, joint, local и time cost.
- Validator выдаёт предупреждения для длительных и осево-тяжёлых сессий.
- Рабочий бюджет автоматически сокращает вторичные sets и упражнения до session time/axial/exercise caps.

Дополнительно реализовано:

- `fitBBSessionToBudget()` для adapt/generic outputs.
- Сначала удаляются вторичные pump/accessory упражнения.
- Primary-упражнения сохраняются.
- До удаления упражнений автоматически сокращаются вторичные sets; защищаются primary и единственный стимул мышцы.
- Budget pass применяется к generic, cycle и FullProgram adapt outputs через общий финализатор.
- Budget pass применяется также к faithful outputs; faithful сохраняет исходный порядок/выбор, но не может обходить safety budget.
- Ограничение в 10 упражнений применяется единым priority-aware cap ко всем источникам, без raw truncation хвоста.
- Load/save/export/execution используют один revalidated snapshot после inline edits; report, weeklyVolume и fatigueReport пересчитываются из этого же snapshot.
- Загрузка сохранённого варианта валидирует клонированный объект, а plan-vs-fact execution не использует устаревший validation state.
- Validator предупреждает об effective MRV overflow.

## Текущий результат

- Все BB-источники проходят общий финальный shape/order/validation pass.
- `sets` и `workSets` синхронизируются после поздних post-processing операций.
- Generic: все 24 сплита покрыты интеграционным тестом.
- Cycle/Program: adapt и faithful покрыты интеграционными тестами.
- Direct/effective volume, target volume и fatigue warnings доступны на общем уровне.

## Этап 7. Feeders и pump-finishers

- Добавлять feeder только при дефиците MEV, наличии бюджета и места.
- Выбирать feeder по локальной усталости, паттерну, оборудованию и безопасности.
- Включить pump-finisher в общий volume planner.
- После добавления выполнять volume validation, ordering и duration validation.

Реализовано:

- Adapt MEV feeder pass добавляет только недостающий объём в существующий релевантный день.
- Учитываются equipment, excluded exercises/muscles и axial restriction.
- Faithful не получает автоматических feeder-ов.
- Feeder получает рабочий вес из `workMax` с безопасным fallback вместо нулевой нагрузки.
- MEV coverage выполняется по каждой рабочей неделе и пропускает deload.
- MEV coverage сравнивает effective volume, включая indirect contribution compound-упражнений.
- После feeder выполняются общий tidy/order, fatigue fit, shape sync и финальная validation.
- При большом MEV-дефиците добавляется несколько безопасных feeder-ов до покрытия target в пределах exercise/time budget; canonical muscle attribution учитывает aliases.

## Этап 8. Фазы и прогрессия

- Унифицировать generic и cycle/program пути.
- Согласовать accumulation, intensification, peaking, deload и taper.
- Не накладывать taper поверх уже сниженного deload.
- Сохранять интенсивность в taper и снижать объём преимущественно в изоляциях.
- Применять double progression только к стабильным упражнениям.

Реализовано:

- Фаза каждой недели берётся из явной разметки источника; cycle/program больше не получают guessed 60/40 phase map.
- Phase safety и phase markers применяются также к faithful; faithful не меняет исходную селекцию и прогрессию без явного adapt-параметра.
- Taper вынесен в общий финализатор и применяется ровно один раз к generic, cycle и FullProgram.
- Deload/taper guard сохраняет интенсивность taper и не накладывает taper на уже разгруженную неделю.
- Generic `phaseByWeek` заполняется для всех недель каждой phase-блока, а не только для `startWeek`.

## Этап 9. Metrics и UI

- Показывать direct, effective и fatigue-weighted sets.
- Разделить sets/week и sets/rotation.
- Исправить учёт lab MRV и overlap для дельт/рук.
- Показывать фактический финальный объём после всех caps, feeders и taper.
- Показывать rationale выбора упражнения и его позиции.

Реализовано:

- Финальный `weeklyVolume` является единым snapshot для engine, UI, report и export.
- UI показывает direct/effective/target/status для выбранной недели и fatigue-weighted volume в итоговом отчёте.
- Volume aggregation учитывает indirect overlap и RIR-зависимый fatigue-weighted sets.
- Статус UI использует фактический финальный effective volume, а не устаревший rotation volume.

## Этап 10. Финальный validator

Создать `validateBBGeneratedPlan()` с проверками структуры, muscle attribution, junk/PL leakage, порядка, объёма, MRV, minimum sets, fatigue, duration, injuries и equipment.

Реализовано:

- `src/engines/bb/bb-validator.engine.ts`.
- Финальная синхронизация `sets` и `workSets` после всех модификаций.
- Проверки структуры, количества упражнений, рабочих сетов и диапазонов сетов.
- `src/engines/bb/bb-finalize.engine.ts` подключён к generic, проф-циклам и FullProgram.
- Fatigue budget, exercise cap, volume aggregation, report и validation проходят через общий финализатор во всех режимах; faithful сохраняет исходную селекцию/порядок, но не обходит safety checks.
- Runtime boundary проверен для ручных замен, перестановок, inline set/weight edits, сохранённых вариантов и отправки в SessionPlayer.
- Generic weeks сохраняют явные `phase`/`deload` поля; deterministic/property matrix покрывает все 24 split patterns, cap, set shape и диапазоны рабочих сетов.
- Ротация primary/accessory проверяется по slot/phase: вариация primary может измениться только на границе phase block, не внутри одного блока.
- `bb-rotation.engine.ts` теперь диагностирует primary stability внутри phase block; смена на границе phase не считается ошибкой.
- Rotation issues сохраняют `phase` и BB-auto UI показывает фазу рядом с диагностикой; metadata входит в export-safe `rotationReport`.
- Accessory repetition diagnostics scoped to `phase|muscle`, поэтому одинаковый аксессуар на границе фаз не считается ложным последовательным повтором; repeated finalization сохраняет report/weeklyVolume/validation snapshot.
- Plan-vs-fact feedback и double progression применяются одинаково в generic, cycle и FullProgram `adapt`; фактическая фаза недели передаётся в `prescribeLoad`, а deload защищён от feedback-перезаписи.
- `faithful` сохраняет исходные данные программы и получает только общие safety/metrics passes.
- Recovery soft-cap вынесен в общий `computeBBRecoveryMultiplier`; cycle и FullProgram используют те же body-fat/lean-mass/HRV/sleep/stress правила, что и generic.
- UI BB-auto передаёт training focus, recovery и lab MRV параметры в generic, cycle и FullProgram converters.
- Manual periodization designer и macrocycle-to-BB bridge также передают injuries, avoid-axial, excluded/favorite exercises и recovery/lab параметры в общий BB draft.
- Round-trip BBPlan → UserProgram сохраняет phase/deload, volume budget, weekly direct/effective/fatigue volume, fatigue/rotation/report/validation metadata и safety constraints.
- Legacy localStorage UserProgram и SavedBBPlan записи мигрируются безопасно: старые weeks/params/metrics получают канонические defaults без удаления исходного плана.

## Этап 11. Тесты

- Добавить unit-тесты volume, effective sets, order и validator.
- Добавить интеграционные тесты FullBody, Upper/Lower, PPL, Bro, PHUL, Arnold, rolling и glute focus.
- Проверить natural/PED, cut, specialization, injuries, equipment, axial restriction, methodology, deload и taper.
- Добавить property-проверки: не более 10 упражнений, минимум 2 рабочих сета, MRV cap, корректная мышца, корректный order и UI volume parity.

Реализовано частично:

- `bb-generation.integration.test.ts` проверяет все 24 generic-сплита.
- `bb-all-paths.integration.test.ts` проверяет проф-цикл и FullProgram в adapt/faithful.
- Baseline: 77 test files / 644 passing tests.
- Matrix coverage: 24 generic split patterns, cycle/program adapt+faithful, safety restrictions, phase/taper, feedback, migration and round-trip export.

## Этап 12. Runtime и документация

- Проверить генерацию, SessionPlayer, замену упражнений, сохранение/загрузку и plan-vs-fact.
- Обновить `AGENTS.md` и документацию движка.
- Зафиксировать итоговые метрики и остаточные риски.

Реализовано:

- Проверены generation, SessionPlayer payload, manual replacement, save/load, export and plan-vs-fact boundaries.
- Обновлены `AGENTS.md` и эта документация.
- Остаточные риски: нет browser-level smoke suite (UI-смоук на уровне jsdom/unit покрыт: ProfileScreen_v2, TrainingScreen_parts, 875 BB-тестов).
- Feeder-интеграция ВЫПОЛНЕНА (Aug 13 2026): максимум 2 feeder-слота/мышцу, deficit 4+3 (cap 5), скип дублей с builder-feeder; MEV-guard в buildSession и minSetsByMuscle в budget-фите гарантируют MEV-минимум на этапе распределения — feeders стали редкой добивкой.
- MRV-overflow: 0 во всех 125 комбинациях (5 профилей x 25 сплитов).
- Раунд 2 (Aug 13 2026): тяж/памп чередование (ноги 2x/нед: тяж quads/памп hams и наоборот), cap 5 сетов/упражнение (глобально), специализация по паттернам (WEAK_PATTERN_REQ), малые группы (calves 6+4, traps 5-6, forearms, abs), mid-delt с грудью, повторный MRV-кап после fill.

## Качественный review внешнего анализа

Проверены предложения из внешнего анализа BB-auto. В план включены только подтверждённые текущим кодом улучшения:

- **P1: единый compound classifier.** `bb-builder` и `bb-session-order` используют разные источники истины (`catalog.type` против name-regex/role). Объединить их через catalog profile с безопасным fallback; добавить property-тесты для primary/accessory и PL-leakage.
- Реализовано: `isCompoundEx()` использует catalog `type` по имени/id, regex остаётся только fallback для неизвестных упражнений.
- Финальная позиция каждого упражнения добавляется в `rationale` после order/budget passes и доступна UI/export (`primary/lead`, `secondary compound`, `accessory`, `pump finisher`).
- **P1: session working-set cap.** Exercise cap уже существует, но отдельного явного cap по суммарным рабочим сетам сессии нет. Добавить target-aware cap, который сначала режет вторичные isolation/feeders, сохраняя primary и единственный стимул мышцы.
- Shared fatigue budget теперь применяет default `maxWorkingSets=24` для всех adaptive sources; cap режет вторичные sets до удаления упражнений.
- Feeder allocation теперь уважает `volumeTargets.maxSetsPerSession`, а не только общий exercise cap; избыток MEV-дефицита объясняется через target/session ceiling.
- Validator показывает non-blocking `target_volume_deficit` и `session_working_set_cap` warnings, чтобы пользователь видел причину недобора после feeder/session safety caps.
- BB-auto UI теперь выводит эти warnings отдельным блоком рядом с blocking validation errors; report/export сохраняет warning count.
- Все новые BB passes, включая balance report (press/pull/raise, compound/isolation, lengthened/mid/shortened и movement patterns), подключаются через общий finalizer и проверяются для generic, BB-cycle и FullProgram в adapt/faithful режимах.
- Balance report теперь отдельно оценивает upper push/pull ratio, не смешивая жимы верхней части с объёмом ног; серьёзные перекосы отображаются как actionable warning.
- Balance snapshot теперь входит также в `BBPlan.report` и UserProgram derived metadata, поэтому не теряется при export/round-trip.
- Balance report теперь хранит coverage `byMuscle`: patterns и sets в lengthened/midRange/shortened позициях для каждой мышцы; UI показывает coverage, warnings объясняют отсутствующие позиции или доминирование одного паттерна.
- Balance categories используют catalog `movementPattern/type` с name fallback, чтобы face pull/RDL/hip thrust не ошибочно считались raise/press; добавлены classifier tests.
- Position categories используют catalog `stretchPhase/peakContraction` перед name fallback, поэтому stretch/peak coverage устойчив к локализации названий упражнений.
- Quality audit стал weekly-aware: MRV overflow проверяется по каждой неделе, а balance ratio строится по рабочим неделям без deload/taper contamination.
- Severity contract зафиксирован: equipment/injury/axial/structure errors блокируют export/execution, а target-volume/session-cap diagnostics остаются объясняющими warnings; composite session leakage не переводится в error без отдельного benchmark.
- **P2: hamstring angle diversity.** Расширить canonical angle classes: seated/lying curl, RDL, good morning, glute-ham/Nordic при доступности и safety restrictions.
- **P2: glute angle diversity.** Расширить canonical classes: hip-thrust variations, kickback, abduction и 45-degree extension с equipment/injury фильтрами.
- Реализовано: hamstring classes расширены seated curl/good morning/GHR-Nordic, glute classes — abduction/45-degree extension; общий pool safety фильтрует недоступное оборудование и травмы.
- **P2: fatigue-aware DUP.** Учитывать накопленную усталость при распределении reps/weight между рабочими сетами, сохраняя phase/training-focus диапазоны.
- Реализовано: middle DUP sets после первых тяжёлых сетов получают мягкое снижение reps в пределах заданного phase/training-focus диапазона; deload не изменяется.
- Реализовано: BB plan-vs-fact использует canonical Epley e1RM и выбирает top set по максимальному весу; autorег RIR shift ограничен категориями intensity/load общим потолком 4.

Отклонено как уже реализованное или неподтверждённое:

- Feeder attribution через `e.group`: текущий feeder pipeline уже использует `trueMuscleOf` с canonical fallback.
- Отсутствие pump-finisher duplicate guard: текущий pipeline проверяет существующий pump и паттерны.
- Безусловное снижение natural `exerciseCount`: текущий level/role/PED planner и fatigue budget уже ограничивают результат; изменение требует отдельного volume-quality benchmark.
- Benchmark подтверждает решение: natural все 24 split patterns удерживаются в пределах 10 упражнений/24 рабочих сетов на сессию; enhanced detail разрешён только при явном PED/level input и также ограничен cap. Безусловное снижение natural exerciseCount не требуется.
- BB-auto UI содержит отдельный entrypoint `🗓` для годового планирования; tools popup имеет независимый mobile-safe scroll container.
- Faithful exact mode не применяет незапрошенные taper, budget trimming, rotation, feeders или phase rewrite; сохраняется только обязательная shape/validation metadata обработка.

## Порядок реализации

1. Baseline и snapshots.
2. Muscle normalizer.
3. `bb-volume.engine.ts`.
4. Effective volume.
5. Unified exercise planner.
6. Unified order engine.
7. Set distribution.
8. Fatigue budget.
9. Feeder/pump integration.
10. Phases, taper, progression.
11. Final validator.
12. Metrics/UI.
13. Integration/property tests.
14. Runtime verification.
15. Documentation and final report.

## Definition of Done

- `tsc --noEmit`, `vite build` и все тесты проходят.
- Generic, cycle и program paths используют единые правила.
- Нет упражнений не той мышечной группы или junk/PL leakage.
- Главный compound стоит корректно и не теряется из-за caps.
- Direct/effective volume отображается одинаково в engine и UI.
- MRV не превышается, а дефицит MEV объясняется.
- Feeders добавляются только по расчёту.
- Результат стабилен при одинаковых входных данных.
