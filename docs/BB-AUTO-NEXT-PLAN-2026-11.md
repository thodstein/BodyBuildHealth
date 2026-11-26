# BB-авто: план дальнейших работ (2026-11)

Состояние на 2026-11-25, от `82517e9a6` (третий проход — якорь дня плана, §2 «Третий проход»).
История аудитов и решений — `docs/BB-AUDIT-P0P1-FIX-PLAN-2026-11.md`
(§4 — что осталось по P2/P3 прошлой серии), общая рамка — `docs/BB-AUTO-MASTER-PLAN.md`.
Правило серии: пункт закрывается только вместе с замком (тестом), который падает без правки.

## 1. Измеренное состояние

| проверка | факт в рабочем дереве (2026-11-24) |
|---|---|
| `npm run type-check` | 0 ошибок |
| `npx vitest run` по 10 файлам BB/виджетов | 10 файлов / 73 теста — зелёные |
| `npm run verify:apk-design` | OK, все маркеры на месте |
| якорь дня плана (`startDate`) | одно правило — `src/engines/training-day.engine.ts`; якорь пишут четыре продюсера `he_pl_runtime`; сигнал изменений — `core/pl-runtime-events`; замки: `training-day.test.ts` 19, `coach-agenda-startdate.test.ts` 3, `pl-runtime-anchor.test.ts` 8, `pl-runtime-events.test.ts` 4, `session-player-initial-day.test.tsx` 4, `training-runtime-day-default.test.ts` 2 |
| статус объёма на границе MRV | `effective === mrv` → `approaching_mrv` (`bb-metrics.engine.ts:109` и `162`, канон `volumeStatusOf` — `volume-landmarks.engine.ts:209`) |
| `src/data/usda-foods.ts` | 8742 записи, полных близнецов нет (12 удалено), ссылок на удалённые `id` нет; замок — `src/data/__tests__/usda-foods-integrity.test.ts` |
| `npm run test:bb` | флаги верные (`--pool=forks` + пара `maxForks=1`/`minForks=1`, `package.json:21`): `maxForks` **без** `minForks` даёт `RangeError: options.minThreads and options.maxThreads must not conflict`, а пара работает; полный прогон под параллельной нагрузкой падает `Fatal process out of memory` (exit `-1073740791`), поэтому гонять его можно только в одиночку (см. P1-3) |

Состояние коммитов этой серии проверено отдельно — в чистом worktree от `82517e9a6`, куда положены
только файлы пунктов, а не всё грязное дерево: `tsc --noEmit` → 0; `npx vitest run` по
`widget-bridge` / `bb-metrics-landmarks` / `bb-volume` / `bb-fatigue` → 73 passed;
`usda-foods-integrity` → 2 passed.

`test:bb` — единственная проверка BB-движка, которая здесь не гоняется. Пока это так, любой
BB-пункт ниже проверяется точечно (`npx vitest run <файлы>`), а не штатным скриптом.

## 2. Очередь работ

Порядок — по соотношению «эффект / риск». Формат пункта: где, дефект, что сделать, чем мерить,
замок, что может сломаться.

### P1-1. Старт тренировки из виджета не работает, когда плеер на «Итоге» (S)

- **Сделано (2026-11-24):** слушатель `he-workout-widget-start` в `SessionPlayer.tsx` принимает и
  `cooldown`, и `done` (сброс → `startMain()`, `handled` по фактическому возврату) — код в HEAD
  (`f7873c605`). Замок: `session-player-hardening.test.tsx` — «старт из виджета с фазы «Итог» не
  теряется и пустая сессия не пишется в историю» (доходит до реального `done-empty`).
- **Открытый риск:** сброс идёт глобальным `he-workout-close`, а его слушают родители
  (`TrainingScreen.tsx:480`, `ExecutionZone.tsx:164`) и сворачивают карточку плеера: после старта из
  виджета сессия может идти в скрытой карточке. Правильнее локальный сброс + `he-workout-open`.
- **Где:** `src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx` — слушатель `he-workout-widget-start`
  реагирует только при `phase === 'ready'`; `src/ui/native/widget-sync.ts` — ветка `workout_start`
  уходит в локальный путь (`saveActiveSession(sessionFromPlan(plan))`);
  `src/engines/workout-logger.engine.ts:464-466` — `isActiveSessionWorthSaving` требует хотя бы один подход.
  Обе ветки реле сейчас живут в незакоммиченном виде — это часть P1-2, поэтому P1-1 делается после него.
- **Дефект:** при открытом плеере на экране «Итог» тап «Начать тренировку» с виджета не даёт ничего:
  `startMain()` не вызывается (фаза не `ready`), а локальный путь возвращает `false` на пустой сессии.
  Пользователь видит, что кнопка «не работает», и это честный отказ только по факту, а не по коду.
- **Сделать:** слушатель принимает и завершённое состояние — сбрасывает плеер тем же путём, что
  событие `he-workout-close` (`setPhase('ready')`, `setDone(null)`, `setSession(null)`), затем зовёт
  `startMain()`; `handled` выставлять по фактическому возврату. Второй вариант — отдельное событие
  сброса, чтобы не смешивать «закрыть отчёт» и «начать заново»; выбрать по коду, не по вкусу.
- **Мерить:** тест «плеер в фазе `done`, очередь `workout_start` → фаза `main`, `workoutsStarted`
  ожидаемый (1 при реально созданной сессии, 0 при пустом плане)»; до правки — `phase === 'done'`,
  сессии нет, оба счётчика 0.
- **Замок:** `src/core/__tests__/widget-workout-integrity.test.ts` (в нём уже 12 тестов, включая
  реле старта при открытом плеере).
- **Риск:** двойной старт, если автосейв подхода и реле придут в одном тике — проверять на живой
  сессии, а не только на снимке очереди.

### P1-2. Ветки моста и журнала живут в незакоммиченном виде (M)

- **Сделано (2026-11-24):** владелец закоммитил ветку — `f7873c605` «честные RPE/план и надёжный
  пульт в проведении тренировки» (19 файлов, включая `widget-sync.ts`,
  `workout-logger.engine.ts`, `widget-bridge.test.ts`, `workout-logger-undo.test.ts`,
  `widget-sync-serial.test.ts`). В рабочем дереве эти файлы больше не висят незакоммиченными;
  `widget-bridge.test.ts` байт-в-байт равен HEAD.
- **Где:** `src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx` (таймеры на завершении, `logOne(ov)`,
  восстановление таймера сессии, знаменатель — подходы дня), `src/ui/native/widget-sync.ts`
  (сериал синка, дата `set_add` из метки времени, коалесценция `pushTrainingWidget`),
  `src/engines/workout-logger.engine.ts` (`removeLastSet`, PR против базиса e1RM,
  `saveActiveSession(..., { plannedTotalMax })`), `src/core/__tests__/widget-bridge.test.ts` (тесты 59–60),
  `src/engines/__tests__/workout-logger-undo.test.ts`, `src/core/__tests__/widget-sync-serial.test.ts`.
- **Дефект:** это работоспособная ветка (type-check зелёный, тесты зелёные), но она нигде не
  зафиксирована. Любая уборка дерева или `git checkout` её сотрёт.
- **Сделать:** довести и закоммитить одним рядом (не смешивать с BB-ядром), предварительно
  прогнав `npx vitest run` по `src/core/__tests__/widget-*.test.ts`, `src/engines/__tests__/workout-logger-undo.test.ts`
  и `session-widgets-fixes`/`session-player-hardening`.
- **Мерить:** `git status` не содержит этих файлов; тесты те же 100 % зелёные.
- **Замок:** сами тесты ветки.
- **Риск:** коммит «полу-фичи» — перед фиксацией руками пройти по диффу и убедиться, что каждая
  правка закрыта тестом; иначе резать на два коммита (мост / журнал).

### P1-3. Штатная BB-проверка не запускается (S)

- **Где:** `package.json:21` → `test:bb`: уже стоит `--max-old-space-size=8192`, `--pool=forks` и
  `--poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1`; окружение Windows + vitest 1.6.1.
- **Дефект:** полный прогон упирается в OOM (`Fatal process out of memory`, exit `-1073740791`) —
  но это нехватка памяти/конкуренция за CPU, а не флаги: `maxForks` **без** `minForks` даёт
  `RangeError: options.minThreads and options.maxThreads must not conflict`, пара из `package.json:21`
  работает (проверено A/B на одном файле). Флаги **не трогать.**
- **Сделать:** гонять `test:bb` только в одиночку (без параллельных vitest); если OOM остаётся —
  резать на два скрипта (`test:bb:core`, `test:bb:ui`) с честными именами, а не менять пул.
- **Мерить:** `npm run test:bb` → `Test Files … passed`, exit 0.
- **Результат (2026-11-24, 19:38–19:54):** прогон на свободной машине (без параллельных vitest/tsc) —
  `Test Files 319 passed | 4 skipped (323)`, `Tests 3682 passed | 20 skipped (3702)`, падений 0,
  `Duration 993.92s`. Тот же скрипт под параллельной нагрузкой падает
  `FATAL ERROR: Zone Allocation failed - process out of memory` после ~42 файлов: причина — память
  машины, а не флаги. Вывод — `%TEMP%\bb-full5.log`.
- **Замок:** запись в `docs/AGENTS-MEMORY.md` обновить по факту (сейчас там зафиксировано падение).
- **Риск:** перенос части сьютов в отдельный скрипт может скрыть регрессии, если CI зовёт только один.

### P2-1. Правило статуса объёма продублировано в шести местах (M)

- **Сделано (2026-11-24):** канон `volumeStatusOf(sets, { mev, mav, mrv })` —
  `volume-landmarks.engine.ts:209` (`checkVolumeStatus` делегирует), `armLandmarkStatus` —
  `arm-volume-landmarks.engine.ts:142-145`, два прохода в `bb-metrics.engine.ts:109` и `:162`.
  Замки: `bb-metrics-landmarks.test.ts` (4.9 / 5 / 6 / 7 / 7.1 / 9 / 9.1 — на `9` до правки был
  `exceeding_mrv`) и новый `src/engines/arm/__tests__/arm-landmark-status.test.ts` (паритет с
  `checkVolumeStatus`). Не унифицированы намеренно: `ArmHeatmap.tsx:54-56` (визуал),
  `quality-score-v2.engine.ts:489-521` (считает по прямым семам), `plan-quality.engine.ts:231-235`
  (своя зона `in_mev`).
- **Где:** `src/engines/volume-landmarks.engine.ts:207-212` (канон `checkVolumeStatus`),
  `src/engines/arm/arm-volume-landmarks.engine.ts:142-147` (`armLandmarkStatus` — байт-в-байт копия),
  `src/engines/bb/bb-metrics.engine.ts:105-112` и `165-168` (два независимых прохода),
  `src/ui/screens/TrainingScreen_parts/VolumeBudgetCard.tsx:26-35`,
  `src/ui/screens/TrainingScreen_parts/bb-quality-load-sections.tsx:400` (inline-подпись).
- **Дефект:** граница MRV уже дала реальный off-by-one (`>= mrv` показывал «Перегруз: −0.0» на
  строке «12 эфф · MRV 12»); пока правило скопировано, следующая правка снова разойдётся.
- **Сделать:** один helper `volumeStatusOf(effective, { mev, mav, mrv })` рядом с `checkVolumeStatus`
  и переиспользовать его в arm- и BB-путях; подписи строить из статуса, а не из повторных сравнений.
- **Мерить:** `rg ">= m.mrv|>= mrv|<= m.mrv" src` — совпадений нет вне канона; граничные значения
  MEV/MAV/MRV одинаковы во всех путях.
- **Замок:** расширить `src/engines/bb/__tests__/bb-metrics-landmarks.test.ts` до трёх границ
  (MEV−0.1 / MEV / MAV / MRV / MRV+0.1) и добавить парный кейс на `armLandmarkStatus`.
- **Риск:** `armLandmarkStatus` может использоваться с ориентирами другой формы — сверить типы перед
  заменой, а не «подтянуть» их к `MuscleVolumeLandmarks`.

### P2-2. Подпись карточки бюджета объёма противоречит бейджу (S)

- **Сделано (2026-11-24):** одна функция подписи `volumeRecommendation(m, unit)` —
  `src/ui/screens/TrainingScreen_parts/volume-recommendation.ts`; текст строится из `m.status`
  (`switch`, ни одного повторного сравнения с `mev`/`mav`/`mrv`). Используется в
  `VolumeBudgetCard.tsx` (локальная `recommendation()` удалена) и `bb-quality-load-sections.tsx`.
  Замок: `__tests__/volume-recommendation.test.ts` — 16 тестов, значения 4.9/5/6/7/7.1/9/9.1, статус
  берётся из канона `checkVolumeStatus`, отдельная проверка «нет `+0.0`/`−0.0`» и что `9` при MRV 9 —
  не «Перегруз»; плюс нормализация `effectiveSets` до 0.1 и finite-гард — float-хвост и `NaN` не
  печатают `+0.0`/`NaN`.
- **Где:** `src/ui/screens/TrainingScreen_parts/VolumeBudgetCard.tsx:29-34`.
- **Дефект:** при `eff === mev` статус — `optimal` (бейдж «оптимум»), но текст
  `if (eff < m.mav) return 'Ниже оптимума: +X до MAV'` пишет «Ниже оптимума».
  Коммит `fix(bb)` этой серии правит только границу MRV — эта строка в него не входит.
- **Сделать:** текст строить по `status` (одна функция на карточку и на секцию качества), а не по
  повторным сравнениям с `mav`/`mev`.
- **Мерить:** кейс `eff === mev` → бейдж и текст согласованы; кейс `eff === mav` и `eff === mrv`
  тоже.
- **Замок:** новый тест карточки (`VolumeBudgetCard` уже рендерится в jsdom-сьютах тренировки).
- **Риск:** тексты читаются пользователем — менять формулировки только по согласованию, смысл не трогать.

### P2-3. Дубли в каталоге USDA появляются на генерации, а не в коде (S)

- **Где:** `src/data/usda-foods.ts` (авто-генерируемый, шапка «Auto-generated from USDA SR28 RU database»);
  генератора в репозитории нет.
- **Дефект:** в файле было 12 пар «полных близнецов» (все поля совпадают, различался только `id`) —
  поиск продукта показывал две одинаковые строки. Удалены 2026-11-24, шапка-счётчик исправлена на 8742.
- **Сделано (этим же коммитом):** правка данных + замок `src/data/__tests__/usda-foods-integrity.test.ts`
  (уникальность полного набора полей без `id`, счётчик шапки = `USDA_FOODS.length`).
- **Мерить:** на текущем каталоге — 2 passed; на прежней версии (8754 записи) тест красный и печатает
  12 пар — проверено прогоном на файле из worktree `D:\BodyBuildHealth-base`.
- **Замок:** `src/data/__tests__/usda-foods-integrity.test.ts`.
- **Риск:** «близнецы» с разными `id` могут быть легитимными (разные порции) — судить только по
  полному совпадению всех полей, включая `servingSize` и `micros`.

### P2-4. Счётчики подходов и честность PR после отмены (M)

- **Где:** `src/engines/workout-logger.engine.ts` — `recomputeExerciseTotals`/`recomputeSessionTotals`
  (единый путь для `logSet` и `removeLastSet`), `WorkoutExercise.totalSets?/totalReps?/prCount?`.
- **Дефект (до правки):** `totalSets`/`totalReps`/`prCount` заполнял только undo-путь, обычная
  сессия несла `undefined`; после отмены подхода сессионные `prCount` и `avgIntensity` оставались
  от удалённого сета — «PR за неделю» показывал рекорд, которого в подходах уже нет.
- **Сделать:** правка уже в дереве, но тест на неё лежит в незакоммиченном
  `src/engines/__tests__/workout-logger-undo.test.ts` — коммитить вместе с P1-2.
- **Мерить:** тест «счётчики честные и до, и после отмены» (запись → 1 сет / 5 повторов / RPE 9,
  после отмены → нули).
- **Замок:** тот же файл теста.
- **Риск:** `best1RM` теперь пересчитывается от набора подходов, а не монотонно растёт — для сессии
  без отмены результат тот же, но при импорте истории поведение проверить отдельно.

### P2-5. Форматирование смешано с семантикой (S)

- **Сделано частично (2026-11-24):** правки этой серии в движке пересобраны как «HEAD + смысловые
  замены» скриптом через `fs.writeFileSync` (хук format-on-save обойдён), поэтому диффы минимальны:
  `volume-landmarks.engine.ts` 11/4, `arm-volume-landmarks.engine.ts` 3/5,
  `bb-metrics.engine.ts` 3/9, `bb-metrics-landmarks.test.ts` 29/0 — `git diff -w` совпадает с полным.
  Массовый `style: prettier` по `usda-foods.ts` / `SessionPlayer.tsx` не делался (чужая зона).
- **Где:** `src/data/usda-foods.ts` (полный reformat, ~130 тыс. строк диффа против HEAD),
  `SessionPlayer.tsx` (~7 тыс.), 6 файлов `src/engines/bb/*` (переформатированы format-on-save хуком).
- **Дефект:** ревью диффа невозможно: смысловая правка в 1–4 строки утопает в переформатировании.
- **Сделать:** отдельный коммит `style: prettier` на затронутые файлы, до или после смысловых
  коммитов (но не внутри них).
- **Мерить:** в смысловых коммитах `git diff -w` ≈ полный дифф.
- **Замок:** нет (процессное).
- **Риск:** если Prettier в репозитории не закреплён по версии, повторный прогон даст новый шум —
  сверить `.prettierrc` и версию в `package.json` перед массовым форматированием.

### P3-1. Остальные тесты, зависящие от дня недели (S)

- **Сделано (2026-11-24):** `widget-bridge.test.ts` уже с фейковой датой (в HEAD);
  `widget-workout-integrity.test.ts` получил `vi.useFakeTimers({ toFake: ['Date'] })` +
  `vi.setSystemTime(new Date(2026, 10, 23, 10, 0, 0))` (понедельник) в `beforeEach` и
  `vi.useRealTimers()` в `afterEach` — фейкуется только `Date`, реальные таймеры живы, остальные
  тесты файла от часов не зависят.
- **Где:** `src/core/__tests__/widget-bridge.test.ts` (исправлено: фейковая дата на понедельнике),
  `resolveWorkoutPlan`/`pickPlanDayIndex`/`trainingWeekdays` в `widget-sync.ts`.
- **Дефект:** 5 тестов из 60 падали во вторник–воскресенье не из-за кода, а из-за даты прогона.
- **Сделать:** пройти `rg "resolveWorkoutPlan|trainingWeekdays" src --glob '*test*'` и зафиксировать
  дату в каждом таком сьюте.
- **Мерить:** прогон с `vi.setSystemTime` на вторник и на воскресенье даёт одинаковый результат.
- **Замок:** сам приём с фейковой датой в каждом сьюте.
- **Риск:** фейковые таймеры в сьюте, который проверяет реальные `setTimeout`, — брать
  `vi.useFakeTimers({ toFake: ['Date'] })`, а не полный набор.

### P3-2. Инлайновые подписи объёма в секции качества (S)

- **Сделано (2026-11-24):** IIFE заменён на `{volumeRecommendation(m)}` (см. P2-2), сам inline-блок
  удалён; секция и карточка теперь берут текст из одной функции.
- **Где:** `src/ui/screens/TrainingScreen_parts/bb-quality-load-sections.tsx:400` — IIFE внутри JSX
  повторяет логику `recommendation()` из `VolumeBudgetCard`.
- **Сделать:** вынести одну функцию подписи и использовать в обоих компонентах (см. P2-1/P2-2).
- **Мерить/замок:** тот же набор граничных кейсов, что в P2-2.

### P3-3. Правило для «интенсивностей» и BFR-подобных костылей

- Не выдумывать числовые эффекты без прямой ссылки на исследование именно этого эффекта.
  Пример из этой серии: `BFR_MRV_BOOST` (`+15 % MRV` от BFR) ссылался на обзор eTRIMP
  (OpenAlex `W4390013292`), который про внутреннюю нагрузку и MRV не исследует; код удалён до коммита.
- **Замок:** любую новую константу-эффект заводить вместе с полем-источником (PMID/DOI) и тестом,
  который проверяет наличие источника.

### P3-4. Мелкие расхождения с каноном объёма и «кракозябры» (S)

- **Сделано (2026-11-24):**
  - `bb-metrics.engine.ts` — засеянные головки дельт (`:150`, `:185`) больше не пишут
    `status: 'below_mev'` литералом, а получают `volumeStatusOf(0, {mev,mav,mrv})`; при вырожденных
    ориентирах `{0,0,0}` это `optimal`, как в каноне.
  - `ArmHeatmap.tsx` — ровно MAV теперь зелёный (`sets > mav` для амбра): канон даёт на MAV
    `optimal`, виджет красил его как «MAV→MRV». `colorFor` вынесен экспортом ради замка.
  - `quality-score-v2.engine.ts` — статус и числа в сообщениях считаются по `effectiveSets`
    (округление до 0.1), а не по прямым сетам: мышца с малым числом прямых сетов и тяжёлой
    косвенной нагрузкой больше не уходит в «недогруз», а `effectiveSets` в объекте совпадает
    с тем, по чему принято решение.
  - Кракозябры (U+FFFD) в комментариях/названиях тестов: `DiaryProgressView.tsx:1`,
    `planner-bridge-handlers.test.ts:548`, `cardio-cycle.test.ts:1289`, `pdf-parser.engine.ts:1131`,
    `combat-e5-camp.test.tsx:25`, `UnifiedSynergyCalculator.tsx:1070`, `arm-rfd-honesty.test.ts:67`,
    `drug-drug-interactions.ts:150`. В `ocr-engine.ts:405` U+FFFD остаётся намеренно — это часть
    regex-детектора битого текста.
- **Замки:** `bb-metrics-landmarks.test.ts` («seeded delt heads …»), `arm-heatmap.test.tsx`
  (граница MAV/MAV+0.1/MRV/MRV+0.1), `quality-score-v2.test.ts` (effective > MRV при прямых 6;
  прямые 18 при effective 13).
- **Остаток:** два файла с кракозябрами в зоне питания (`NutritionScreen_parts/IndividualPlan/__tests__/planner-micro-pools.test.ts`,
  `planner-nut-ceiling-8131.test.ts`) и `docs/NUTRITION-PLANNER-QUALITY-AUDIT-2026-10.md` —
  их правит другой агент.
- **Второй проход (2026-11-24, зоны виджетов/проведения/заметок/календаря):**
  - `training-ui.tsx` — `mrvBadge` берёт цвет из `CANONICAL_STATUS_COLOR`: раньше «близко к MRV»
    печаталось красным, а «недотрен» янтарным, и один статус в двух таблицах выглядел по-разному.
    Замок — `__tests__/training-ui-status-colors.test.ts`.
  - `ProfileNotesTab.tsx` — просроченный срок заметки виден: `data-overdue="true"`, цвет `danger`,
    хвост «· просрочено»; срок «сегодня» просроченным не считается. Замок —
    `__tests__/profile-notes-overdue.test.tsx`.
  - `widget-sync.ts` — удалена мёртвая `patternTrainingToday` (цикл «работа/отдых» с выдуманной эпохой
    2024-01-01 ни разу не вызывалась); для `scheduleType='pattern'` виджет по-прежнему берёт день
    ротацией, потому что в профиле нет якоря начала цикла. Ограничение известно: в день отдыха
    виджет может предложить тренировку.
  - `widget-sync.ts` — `pushTrainingWidget` снимает флаг «в полёте» в `finally`: синхронный бросок в
    `collectTraining()` оставлял флаг навсегда, и все следующие пуши возвращали старый результат,
    хотя новой отправки не было.
  - `TrainingCalendarTab.tsx` — календарь больше не выдумывает план: дата дня плана берётся из
    явного `date` или `startDate + dayOfWeek`, иначе день не рисуется; `totalVolume`/`totalSets`
    считаются из реальных `targetSets` (было `|| 3000` / `|| 15`); демо-план `generateSyntheticPlan`
    (Push/Pull/Legs, 4 дня) удалён — без плана календарь пустой и без «Пропущено». Замки —
    `training-runtime.test.ts` (явная дата / `startDate+dayOfWeek` / без даты — пропуск / реальные суммы)
    и новый `training-calendar-planned.test.tsx` (факт 500 кг против плана 1460 не даёт `missed`;
    пустой localStorage — ни одного `missed` и ни одного демо-лейбла).
  - `ExecutionZone.tsx` — кнопка «📅 Сегодня» берёт день недели ВНУТРИ списка дней микроцикла
    (`todayTrainingDayIndex` по меткам `Пн`…`Вс`), а не «день недели по модулю числа дней плана»
    и не индекс дня из `he_pl_runtime` (план и микроцикл — разные источники: 4-дневный план при
    3-дневном микроцикле открывал чужой день). День отдыха — `-1`: кнопка `disabled` и подпись
    «Сегодня — отдых». Побочно `diary-shared.ts` перестал импортировать `widget-sync`.
  - `VolumeBudgetCard`/`bb-quality-load-sections`/`volume-optimizer-parts`/`mrvBadge` — цвет статуса
    объёма из одного `VOLUME_STATUS_META` (цвет = `CANONICAL_STATUS_COLOR`): до правки «недотрен»
    был синим на двух экранах и красным в оптимизаторе, а синий в каноне — это `maintenance`.
  - Календарь: плановый подход без RIR больше не пишется как «RIR 0 / RPE 10»; мёртвый
    `generateSyntheticPlan` (демо-PPL на 1/2/3-е число) удалён из `training-calendar.engine.ts`.
  - `pushTrainingWidget` перезапускает проход, если вызов пришёл в окно «цикл закончен, флаг ещё
    в полёте»; раньше такой вызов помечал `trainingPushPending`, но проход уже не запускался.
  - `ProgressTab.tsx` / `DiaryAnalyticsView.tsx` — недельные корзины по понедельнику
    (`weekStartIsoMon`), без `new Date('YYYY-MM-DD')` (UTC-сдвиг) и без воскресного старта, который
    раскладывал сб/вс по разным неделям, чем дневник. Замок — `week-buckets-and-today-index.test.ts`.
  - `AnalyticsTab.tsx` — `durationMin` больше не подставляется как 60 минут (только факт из записи,
    иначе 0); `catch (e)` без использования → `catch`.
- **Третий проход (2026-11-25, якорь дня плана `startDate`):**
  - Правило «день плана ↔ дата» теперь одно — `src/engines/training-day.engine.ts`
    (`isTrainingDayFor`, `pickPlanDayIndex`, `planDatesForIndexes`, `weeklyTrainingDays`,
    `patternCycle`). Локальные копии удалены из `coach-agenda.engine.ts` и `widget-sync.ts`,
    календарь зовёт движок напрямую. Замки — `src/engines/__tests__/training-day.test.ts` (19)
    и `src/engines/coach/__tests__/coach-agenda-startdate.test.ts` (3).
  - Продюсеры `he_pl_runtime` пишут якорь `startDate` (локальная ISO-дата): `BbAutoConstructor` (2 записи) —
    выбранная в конструкторе дата старта мезоцикла (`planAnchorIso()`, от неё же считаются недели, ICS,
    печать); `ProgramEditorView` (2) и `PLPlanView` (1) — момент отправки (`localIsoDate()`); `SRCBBScreen`
    (1) — `anchorForWrite(readPlRuntime(), playerDays)`: зеркальная запись при монтировании сохраняет
    прежний якорь, пока массив дней тот же, иначе любой проход по конструктору сдвигал старт уже
    отправленного плана. Замок — `TrainingScreen_parts/__tests__/pl-runtime-anchor.test.ts`,
    поведение `anchorForWrite` — `src/core/__tests__/pl-runtime-events.test.ts`.
  - `storage`-событие не приходит своему окну, поэтому появился общий сигнал
    `src/core/pl-runtime-events.ts` (`notifyPlRuntimeSaved` / `onPlRuntimeSaved`): продюсеры
    уведомляют после успешной записи, `TrainingScreen` и `TrainingCalendarTab` пересчитывают план.
    Замок — `src/core/__tests__/pl-runtime-events.test.ts`.
  - Плеер открывается на дне, вычисленном по якорю (`ExecutionZone` → `SessionPlayer.initialDayIndex`).
    Смена якоря переключает день только в фазе «готов» и без активной сессии: план, пришедший из другого
    окна, иначе менял день под уже начатой тренировкой (подходы записаны в день 3, селектор показывал
    день 1). `runtimeDay` по умолчанию `0` (был `1` — свежий пользователь открывал «День 2»). Замки —
    `SRCBBScreen_parts/__tests__/session-player-initial-day.test.tsx` (в т. ч. кейс «якорь сменился
    во время сессии — день не меняется»), `TrainingScreen_parts/__tests__/training-runtime-day-default.test.ts`.
  - Следствия: 5-дневный план при 3 тренировках в неделю проходит дни 1…5 (раньше 4–5 были
    недостижимы); `daysPerWeek: 0` читается как «не задано» (3 дня, а не одна среда); фаза
    `pattern`-цикла считается от якоря, а не от 2024-01-01.
  - Календарь: дата дня плана — явная `day.date` → якорь (`planDatesForIndexes`, N-й
    тренировочный день от `startDate`) → `startDate + dayOfWeek`; без якоря и без дат день
    пропускается (догадок нет), `plannedData` пересчитывается по сигналу плана, а не по смене месяца.
  - Виджет и нативный календарь виджета согласованы с плеером на одном payload: слот плана — элемент
    массива `days` (пустой день пик-недели/«отдых» остаётся слотом; раньше `resolveWorkoutPlan`
    выбрасывал пустые дни, и индекс дня расходился с плеером), плановые дни до якоря не рисуются,
    сканирование начинается от `max(from, startDate)`, тренировочный день считается `isTrainingDayFor`
    с якорем. Замок — `src/core/__tests__/widget-workout-integrity.test.ts` (кейс пик-недели).
- **Известные ограничения:**
  - PR-детект (`workout-logger.engine.ts`) сравнивает `sessionBestE1RM` только внутри текущей
    сессии и ищет историю по подстрочному совпадению имени — ложный PR на первом подходе нового
    упражнения и на втором сете без рекорда. Код не менялся.
- **Закрыто 25.11.2026 — 11 запаркованных дефектов** (у каждого свой тест):
  - `computeWeeklyBreakdown` группирует по локальному понедельнику (`mondayOfIso`), в записи есть
    `weekStart`, `week` = YYYYMMDD → `src/engines/__tests__/analytics-weekly-breakdown.test.ts`.
  - Срез журнала перенесён на запись: `MAX_STORED_SESSIONS = 2000` + `markTrimmed`, поэтому
    `archiveActiveSession` находит записанную сессию → `src/engines/__tests__/workout-history-cap.test.ts`.
  - Ветка `ei < 0` в `he-workout-widget-set` создаёт упражнение в живой сессии и пишет подход тем же
    путём (`d.handled = persisted`) → `session-player-widget-offplan.test.tsx`.
  - `data-act="finish-session"` подтверждает выход при несохранённых подходах (`exit-confirm` /
    `exit-save`) → тот же файл.
  - Цель недели — дни графика профиля (`weeklyTrainingDays`), а не длина цикла; СЧЁТЧИК недели —
    по датам Пн–Вс (`getSessionsInWeek`), а не по `weekNumber` (в журнале две шкалы: неделя плана 1..N
    и ISO-неделя из CSV) → тесты 59–62 в `src/core/__tests__/widget-bridge.test.ts`.
  - `PlanSetTarget.rir` стал `number | null`: план без RIR больше не получает выдуманный `rir: 2` → там же.
  - Календарь клэмпит сам `rir` в 0…10 (пара RIR/RPE согласована) → `training-calendar-honesty.test.tsx`.
  - `plannedData` подписан на правку профиля через `onAnyProfileChangeCrossTab` (шина окна + `storage`)
    → тот же файл + `src/core/__tests__/profile-events-crosstab.test.ts`.
  - Экспорт журнала через `core/apk-share` (`saveCsvApk`/`saveTextFileApk`), `<a download>` убран → там же.
  - `he_runtime_day`: одноразовая миграция унаследованной `1` → `0` с флагом `he_runtime_day_migrated`
    (`TrainingScreen_parts/runtime-day.ts`) → `training-runtime-day-default.test.ts`.
  - Порядок дат дня плана: явная `day.date` → якорь (`planDatesForIndexes`) → `startDate + dayOfWeek`
    → `training-calendar-honesty.test.tsx`.
- **Закрыто 25.11.2026 (четвёртый проход) — 7 дефектов ревью** (у каждого свой замок):
  - Запись тренировки больше не «успешна по умолчанию»: `finishSessionWithSave()` возвращает
    `{ session, saved }`, прежний `finishSession()` оставлен для экспорта/тестов. Плеер и виджет-фолбэк
    проверяют `saved` и только тогда вызывают `clearActiveSession()`; при провале живая сессия остаётся
    единственной копией, а в плеере показывается `[data-session="save-error"]` →
    `src/engines/__tests__/workout-logger-save-report.test.ts`, `session-player-save-honesty.test.tsx`,
    тест 64 в `src/core/__tests__/widget-bridge.test.ts`.
  - `SessionPlayer.startMain()` не стартует новую тренировку, если у живой сессии были подходы, а
    `archiveActiveSession()` вернул `null` (квота/сессия не попала в срез): автосейв пустой новой сессии
    больше не затирает единственную копию → `session-player-save-honesty.test.tsx`.
  - Quota-фолбэк `saveSessions()` пишет не больше `MAX_STORED_SESSIONS` (раньше `trySave(sortedAsc,
    'full')` проходил, если квоту выбили другие ключи) и зовёт `markTrimmed` →
    `workout-logger-save-report.test.ts`.
  - `logSet` держит RIR в шкале 0…10 (было 0…20: RPE = 10 − RIR уходил в 0) →
    `workout-logger-save-report.test.ts`; виджет-путь `set_add` тоже клампит в 10.
  - У `[data-session="exit-confirm"]` появился `padding-bottom: calc(12px + env(safe-area-inset-bottom))`
    — кнопка «Остаться в тренировке» не упирается в системный жест.
  - `runtimeDay` задокументирован как индекс списка тренировочных дней микроцикла, а не день недели;
    клампинг вынесен в `resolveRuntimeDayIndex()` (`runtime-day.ts`), `ExecutionZone` берёт его по длине
    отфильтрованного списка; цена миграции `1 → 0` описана честно (до флага осознанный выбор второго дня
    не отличим от унаследованного дефолта) → `training-runtime-day-default.test.ts`.
  - `WorkoutWidgetExercise.rir` стал `number | null`: план без RIR больше не превращается в `rir: 0`
    в снапшоте; `syncWorkoutWidget` сохраняет `null`, `WorkoutWidgetProvider` не передаёт `EXTRA_RIR`
    при `null`, и поле RIR в диалоге подхода остаётся пустым → тест 63 в `widget-bridge.test.ts`.
  - Дополнительно закрыто по ревью этого же прохода (найдено уже после первого прогона проверок):
    - `saved` в `finishSessionWithSave()` теперь «сессия реально в журнале»: `saveSessions` режет
      историю до `MAX_STORED_SESSIONS` по дате, и завершённая сессия могла вылететь из среза при
      `true` от записи — вызывающий стёр бы живую копию. Проверка членства —
      `saved && loadSessions().some(s => s.sessionId === finished.sessionId)`; замок — кейс
      «сессия вылетела из среза истории» в `workout-logger-save-report.test.ts`.
    - `workout_start` из виджета не дописывает план дня в живую сессию ПРОШЛОГО дня (условие
      по дате, а не «плеер отверг» — путь без смонтированного плеера так же склеивал подходы
      двух дней в записи с датой вчера) → новый кейс в `widget-workout-integrity.test.ts`.
    - `readRuntimeDay()` пишет мигрированное значение ПЕРЕД флагом и держит записи в разных
      `try`: провал записи больше не возвращает 0 и не «съедает» миграцию навсегда →
      два новых кейса в `training-runtime-day-default.test.ts`.
    - `SET_LIMITS.maxRir` 20 → 10 (поле не участвовало в валидации, но противоречило клампу `logSet`);
      `resolveWorkoutPlan` считает сессии недели через `getSessionsInWeek` — ротация дня плана без
      якоря больше не застревает на первом дне.
- **Закрыто 25.11.2026 (пятый проход) — 8 запаркованных дефектов** (у каждого свой замок):
  - «RIR не вводили» отличается от «до отказа» на всём пути: Java кладёт
    `item.put("rirMissing", !rirEntered)` рядом с `rir` (там `0` — заполнитель), очередь несёт поле
    (`QueuedItem.rirMissing`), `logSet` сохраняет отметку в сете (`WorkoutSet.rirMissing`, `rir: 0`),
    снапшот виджета отдаёт `rir: null`, плеер и строка подхода печатают `RIR —`. Элементы очереди от
    старой сборки APK (без поля) считаются «не вводили», если `rir` не больше нуля → замки «подход без RIR
    не выдаёт RIR 0 в снапшоте», «элемент очереди от старой APK: rir 0 без метки — „не вводили“»,
    «реле подхода несёт rirMissing» в
    `src/core/__tests__/widget-workout-integrity.test.ts`, `session-player-save-honesty.test.tsx`,
    `src/engines/__tests__/workout-logger-active-guard.test.ts`.
  - Явный старт без подходов больше не немой: `saveActiveSession(..., { allowEmpty: true })` пишет
    сессию с меткой `ActiveSession.startedWithoutSets`, `loadActiveSession` читает её (обычный пустой
    черновик — нет), с первым подходом метка снимается. `workout_start` из виджета снимает пустой
    черновик прошлого дня по `sessionId` и создаёт сегодняшний → `widget-workout-integrity.test.ts`.
  - Пустое завершение не выдаёт себя за отказ хранилища: `finishSessionWithSave` отдаёт
    `{ saved: false, empty: true }` и в журнал не пишет; плеер и виджет-фолбэк снимают свой живой ключ
    и не показывают «ошибку записи» (`data-session="autosave-error"` не появляется) →
    `workout-logger-active-guard.test.ts`, `session-player-save-honesty.test.tsx`.
  - `clearActiveSession(sessionId?)` удаляет только совпадающую запись (битый JSON — как мусор):
    завершение/архив больше не стирают чужой черновик, легший в ключ между чтением и очисткой →
    `workout-logger-active-guard.test.ts`, кейс «чужая живая копия…» в `session-player-save-honesty`.
  - `SessionPlayer` проверяет результат автосейва: при `hasSets && !saved` показывается
    `[data-session="autosave-error"]` с кнопкой «Понятно» (живая копия остаётся единственной) →
    `session-player-save-honesty.test.tsx`.
  - Провал `archiveActiveSession()` в диалогах «В дневник» и «Начать заново» объясняется баннером
    `save-error`; карточка/панель не закрываются, новая тренировка не начинается → тот же файл.
  - Quota-фолбэк проверен на реальной лестнице `500/100/50`, включая провал всех ступеней и случай
    «успех на 500 не помечает срез как 100/50» → новый `src/engines/__tests__/workout-logger-quota-ladder.test.ts`.
  - Source-замки `runtimeDay` переведены на регулярки по нормализованному тексту (перенос строки и
    отступы больше не ломают проверку), а `runtimeDaysToBridgeSessions` лишился неиспользуемых
    `year`/`month` (вызовы в `training-runtime.test.ts` обновлены) →
    `training-runtime-day-default.test.ts`, `training-calendar-honesty.test.tsx`.
  - Дополнительно: из `archiveActiveSession()` убран второй разбор журнала (членство уже гарантирует
    `saved` в `finishSessionWithSave`), мёртвый экспорт `getSessionsByWeek()` удалён.
- **Закрыто по ревью 25.11.2026 (шестой проход) — 13 находок** (у каждой свой замок):
  - `set_add` с виджета больше не дописывает подход в живую сессию чужого дня: если запись
    обновлялась не сегодня (`savedAt`), она архивируется (с подходами) или снимается (пустой
    черновик), а подход уходит в сегодняшнюю сессию; при провале архива подход не пишется и
    снапшот виджета возвращается к факту. Тренировка, начатая вчера и продолженная ночью
    (`savedAt` сегодня), остаётся одной записью с датой старта → `widget-workout-integrity.test.ts`,
    `widget-sync-serial.test.ts`.
  - Старт с виджета при чужой живой сессии пушит снапшот (`pushWorkoutWidget`) — пульт не остаётся
    в оптимистичном «идёт тренировка».
  - «Продолжить» перечитывает живую копию (`loadActiveSession`), если `sessionId` тот же: подход,
    записанный виджетом в фазе `ready`, не теряется при пересборке из старого снимка.
  - Пустой вчерашний черновик не предлагается как «Продолжить»: снимается по `sessionId`, кнопка
    ведёт в новый старт с сегодняшней датой.
  - Ручной «✓» пишет `rirMissing` (нет ни RIR, ни RPE), а при введённом только RPE выводит
    RIR = 10 − RPE вместо противоречивой пары `rir: 0 / rpe: 8`; ручная правка RIR/RPE снимает
    метку «с виджета» → `session-player-save-honesty.test.tsx`.
  - RIR в плеере и в Java-диалоге клампится 0…10 (`max={10}`, `Math.min(10, …)`, `parseQty(rirEt, 10)`);
    нечитаемое значение RIR в Java — ошибка ввода, а не «до отказа».
  - Явный старт в плеере пишет живой черновик (`allowEmpty`): после убийства WebView «Продолжить»
    появляется; тесты `session-player-hardening` и `pl-session-diary-integrity` обновлены.
  - `structured-analytics.engine.ts` больше не читает `rpe: 0` как «работал в запасе»: `calc1RM` даёт
    чистый Epley, интенсивность считается только по измеренным сетам → новый
    `structured-analytics-rpe-honesty.test.ts`.
  - Средний RIR на экране тренировок пропускает `rirMissing`-сеты (ноль-заполнитель не тянет вниз).
  - Новые кнопки баннеров и «Начать заново» получили тап-таргет 44 px; экран пустого завершения
    больше не печатает « · – · фокус: » над «Подходы не записаны».
- **Закрыто по второму кругу ревью 25.11.2026 — 5 находок:**
  - `rirMissing` переживает границу журнала: поле добавлено в `StrengthLogEntry['sets']`, три
    адаптера (`sessionToWorkoutLog`, `workoutLogToSession`, адаптер `workout-summary`) переносят метку,
    `workoutLogToSession` больше не подставляет `rir ?? 2`, а средний RIR и `failureSets` считаются
    только по измеренным подходам → `src/engines/__tests__/rir-missing-journal-boundary.test.ts`.
  - В `set_add` реле плееру выполняется ДО архивации чужой живой сессии: тренировка, начатая вчера и
    продолженная ночью, остаётся в состоянии плеера и не архивируется под ним →
    `widget-workout-integrity.test.ts` («плеер открыт: подход уходит в живую сессию…»).
  - Введённый в виджете RPE без RIR — измерение: `set_add` выводит `rir = 10 − RPE` и не ставит
    `rirMissing`, поэтому подход не ложится как `rpe 8 / rir 0` при открытом плеере и как `rpe 0`
    при закрытом → там же + `session-player-save-honesty.test.tsx`.
  - Выход из явно начатой тренировки без единого подхода снимает живой черновик по `sessionId` и пушит
    снапшот: виджет не застревает в «идёт тренировка», `startTime` не переезжает в следующую сессию →
    `session-player-save-honesty.test.tsx`.
  - `skipExercise` пишет `rirMissing`, а не выдуманный `rir: 0`; `structured-analytics` level 3
    усредняет RPE только по сессиям с измеренным RPE.
- **Закрыто по третьему кругу ревью 25.11.2026 — 6 находок:**
  - Домашняя карточка/виджет видят явный старт без подходов как живую тренировку:
    `summarizeActiveSession` отдаёт сводку и для `startedWithoutSets` (`setsDone: 0`). Иначе тап
    «Начать» с виджета не менял карточку (`live:false`, «▶ Начать»), и пользователь жал снова →
    `widget-workout-integrity.test.ts` («тап старта…» + сводка).
  - `exitSession` в плеере считает живые подходы по `liveSessionRef.current ?? session`: реле виджета
    обновляет ref синхронно, а state — ре-рендером, поэтому тап «Завершить» между ними снимал
    черновик вместе с только что принятым подходом → `session-player-save-honesty.test.tsx`
    (замок проверен: без фикса тест падает).
  - `rpe: 0` больше не попадает в средний RPE отчёта (`workout-summary`, `exRpeN`): три подхода без
    оценки глушили триггер разгрузки `avgRPE ≥ 9` → `rir-missing-journal-boundary.test.ts`.
  - `buildSetDetails`/текст отчёта и карточка подходов печатают `@—`, а не выдуманный `@0`
    (`SetDetailRow.rirMissing`, `WorkoutSummaryReport`) → там же.
  - 1RM для тренда в `structured-analytics` берётся из измеренных подходов, если они есть: незаполненный
    20-повторный подход больше не становится «лучшим 1RM» периода →
    `structured-analytics-rpe-honesty.test.ts`.
  - Java: дробный RIR (`1,5`) не округляется молча — целое 0…10 или явная ошибка ввода.
- **Закрыто по четвёртому кругу ревью 25.11.2026 — 3 находки (следствия правок третьего круга):**
  - Пустой явный старт в карточке «Незавершённая тренировка» больше не зовёт архив: «В дневник» и
    «Начать заново» снимают черновик по `sessionId`, ложная ошибка хранилища не показывается и
    тренировку можно начать заново → `session-player-save-honesty.test.tsx`.
  - Брошенный вчерашний явный старт без подходов не считается «идущим»: `summarizeActiveSession`
    отдаёт пустую явную сессию только в её собственный день, иначе карточка висела бы с «● Идёт» и
    «+ Сет» через сутки → `widget-workout-integrity.test.ts`.
  - Тренд 1RM не сравнивает измеренный метод (поправка по RPE) с чистым Epley: при разных методах
    периодов тренд равен 0, а «лучший 1RM» периода по-прежнему только из измеренных подходов →
    `structured-analytics-rpe-honesty.test.ts`.
- **Закрыто по пятому кругу ревью 25.11.2026 — 3 находки:**
  - Пустота черновика в карточке «Незавершённая тренировка» решается по хранилищу
    (`dropResumeDraft` → `loadActiveSession()`), а не по снимку `resumeFrom`: виджет в фазе `ready` и
    вторая вкладка пишут подходы в тот же ключ после рендера карточки, и снимок «пусто» стирал их без
    следа. Заодно «копия уже снята другой вкладкой» больше не даёт ложную ошибку квоты →
    `session-player-save-honesty.test.tsx` (замок проверен: со снимком подход теряется).
  - Виджет «Проведение» считает `live` по сводке (`summarizeActiveSession`), как и домашняя карточка:
    брошенный вчерашний старт без подходов не держит «● Идёт» и «+ Сет» →
    `widget-workout-integrity.test.ts` (замок проверен: без гейта `live: true`).
  - Тренд 1RM сравнивается только при данных с обеих сторон и одном методе оценки; у периода без
    сравнения `rmComparable: false` и текст «Нет сравнимых данных» вместо «Стабильно»/«Регресс −100 %»
    → `structured-analytics-rpe-honesty.test.ts` (замок проверен: без требования обеих сторон тренд −100).
- **Закрыто по шестому кругу ревью 25.11.2026 — 4 находки ревьюера + 1 найденная при их закрытии (все P3):**
  - Карточка «Незавершённая тренировка» и подпись «Продолжить тренировку» показывают живую копию
    (`shownResume()` предпочитает ключ при совпадении `sessionId`), а не снимок: подход, дописанный
    виджетом в фазе `ready`, больше не отображается как «0 подх. уже записано» →
    `session-player-save-honesty.test.tsx` (замок проверен: со снимком тест падает).
  - Архив из карточки пишет честную заметку «Незавершённая тренировка: перенесена в дневник»
    (прежний текст «сохранена при старте новой» врал: этот путь новую не стартует); если копию
    сняла другая вкладка между рендером и тапом — карточка закрывается без ложной ошибки квоты.
  - Уровни без измерений больше не объявляют «оптимально»: нет RPE → warning + «RPE не измерялся»,
    нет длительности → warning + «Длительность не записана» (уровни 3, 4, 18); несравнимый тренд 1RM
    (уровни 6-8) — тоже warning → `structured-analytics-rpe-honesty.test.ts`.
  - Прогноз 1RM (уровень 21) не печатает «squat: 0 кг» для упражнения, которого нет в текущем
    периоде: паттерны с `estimated1RM = 0` в прогноз не попадают, пустой прогноз — «Нет данных» →
    там же.
  - «В дневник» не архивирует сессию, которая появилась в ключе после рендера карточки (старт из
    виджета/второй вкладки): раньше архивировалось то, что лежит в ключе, и идущая тренировка
    закрывалась на середине; теперь карточка перечитывает живую копию →
    `session-player-save-honesty.test.tsx` (замок проверен: без гейта сессия уходит в журнал).
- **Закрыто в седьмом проходе 26.11.2026 — 10 дефектов тренировочного слоя:**
  - `StructuredAnalyticsCard` больше не читает через `as any` несуществующие поля: рендерит `overallScore`,
    `levels` (подходы/повторы, объём), паттерны с 1RM и трендом, прогноз только при `rmComparable === true`,
    предупреждения уровней; историю делит по дате на прошлый/текущий период → `structured-analytics-card.test.tsx`.
  - `computeStructuredAnalytics` сам делит историю пополам, если `prevSessions` пуст и сессий ≥ 2 (явный
    `prevSessions` сильнее); тренд 1RM и прогноз больше не сравнивают период сам с собой.
  - Уровень 5 (распределение повторений) без единого сета → `warning` + «Подходов нет — распределение
    повторений не оценивается»; уровень 21 прогнозирует только `estimated1RM > 0 && rmComparable === true`,
    пусто → «Нет сравнимых периодов для прогноза 1RM», в инсайте рост `Nкг (+X%)` →
    `structured-analytics-rpe-honesty.test.ts`.
  - `workout_start` из виджета учитывает `savedAt`: сессию, начатую вчера и обновлённую сегодня, «Начать»
    не рвёт на две записи; пустой черновик прошлого дня по-прежнему заменяется сегодняшним стартом →
    `widget-workout-integrity.test.ts`.
  - Подход виджета не теряется при провале архива чужого дня или провале `saveActiveSession`: элемент уходит
    в JS-буфер `he_widget_set_retry_v1` (дедуп по сигнатуре `ts|упражнение|вес|повторы`, хранятся свежие 50),
    `applyWidgetQueue` разбирает буфер на каждом синке, `setsAdded` молчит до фактической записи → там же.
  - Элемент очереди старой APK: `rir 0 + rpe 10` — измеренный «до отказа»; `rir 0` без RPE — «не вводили» →
    там же.
  - Подход с виджета в разминке не превращается в отдельную тренировку при входе в основную часть: «своя»
    живая копия сверяется по именам упражнений, а не по индексам → `session-player-save-honesty.test.tsx`
    (замок проверен: с прежним сравнением по индексу подход уходит в архив, тест падает).
  - Карточка «Незавершённая» обновляется сразу: `saveActiveSession`/`clearActiveSession` шлют
    `he-active-session-changed`, плеер в фазе `ready` подписан на него и на `storage` → там же (замок
    проверен: без подписки счётчик остаётся «0 подх. уже записано»).
  - `currentRir` — `number | null` по цепочке (`TrainingScreen`, `DiagnosticsHub`, `LiftMasterCard`,
    `PlannerToolsPanel`, `QualityJointHub`); `MesoCorrectionCard` при `null` пишет «нет измерений», не двигает
    RIR и не делает кнопку активной, `DiaryAnalyticsView` берёт средний измеренный RIR из истории (RIR, иначе
    10 − RPE, `rirMissing` пропускается) → `meso-correction-rir-honesty.test.tsx`.
- **Закрыто после ревью 26.11.2026 (5 находок P2/P3):**
  - Карточка мезоцикла больше не печатает выдуманный «RIR 2» строкой рекомендаций: движок принимает
    `currentRir: number | null` и при `null` не пишет RIR в `comment`, не даёт `rir_up`/`rir_down` и не
    снижает RIR за прогресс; кнопка «Применить» считает множитель объёма от базы с тем же полом
    (`max(6, объём)`), а сдвиг RIR — от `min(4, max(0, RIR))`, поэтому пол движка не превращается в
    «объём ×1.5» → `meso-correction-rir-honesty.test.tsx`.
  - `StructuredAnalyticsCard`: паттерн, оставшийся только в прошлом периоде, печатает «—» вместо «0 кг»;
    статус `Excellent` получает цвет (ключ `excellent`) → `structured-analytics-card.test.tsx`.
  - Подход с меткой прошлого дня больше не дописывается в сегодняшнюю тренировку: день берётся из `ts`
    элемента, а «прошлый» элемент пишется в журнал сразу (`finishSessionWithSave`, `sessionId = wset_<день>` —
    одна запись на день, второй подход дописывается в неё), живая копия не архивируется и не меняется →
    `widget-workout-integrity.test.ts`, `widget-sync-serial.test.ts`.
  - Прошлый подход при открытом плеере больше не уезжает в сегодняшнюю сессию: реле получает только подходы
    своей даты, а прошлый пишется в журнал своей → `widget-workout-integrity.test.ts`.
  - Исключение на элементе очереди больше не теряет подход: `set_add` возвращается в буфер повтора (отказ
    самого `logSet` по границам значений по-прежнему не повторяется — он не пройдёт никогда).
  - Уровень 17 «Тренировочная частота» считает тренировки в неделю по длине окна периода, а не длину
    массива (после деления истории пополам 40 записей читались как «40/нед») →
    `structured-analytics-rpe-honesty.test.ts`.
  - `startMain` продолжает живую сессию дня, если совпало хотя бы одно упражнение (план пересобрался, а
    виджет дописал упражнение вне него), и архивирует только при полном несовпадении →
    `session-player-save-honesty.test.tsx`.
  - Наследие `rir: 0` без метки `rirMissing` и без введённого RPE — «не вводили» в `TrainingScreen` и
    `DiaryAnalyticsView`; выдуманный `currentVolume = 16` в дневнике убран (нет данных — нет рекомендации).
- **Осталось / риски этого прохода:**
  - Java-сборка (`WidgetQuickAddActivity`) проверяется только CI после push: локально нет
    `java`/`gradle`/`ANDROID_HOME`.
  - Буфер повторных подходов ограничен 50 свежими элементами: при долгом отказе хранилища более старые попытки
    отбрасываются — нативного push-back API у `applyWidgetQueue` нет.
  - Деление истории пополам (и в карточке, и в движке) — решение отображения: отдельной границы мезоцикла в
    истории тренировок нет, поэтому «прошлый период» — первая половина по дате.
  - Подход, доехавший из очереди за прошлый день, ложится отдельной записью `wset_<день>` (одна на день):
    уже завершённую реальную тренировку того же дня она не дополняет — журнал не ищет сессию по дате.
  - Повторная доставка прошлого подхода распознаётся по сигнатуре `ts|упражнение|вес|повторы` в
    `he_widget_retro_done_v1` (хранятся 200): за пределами окна повтор снова создаст запись дня.
- **Закрыто в четвёртом проходе (26.11.2026) — запаркованное из ревью:**
  - `computeStructuredAnalytics`: при истории меньше трёх сессий (`chronicWeeks = 0`) `chronicLoad` больше не
    делится на ноль (`Infinity`); `acwrComputed = false`, уровень 13 — `dataMissing` и «Меньше 3 тренировок
    в истории — ACWR не считается», уровень 16 — «Нет хронической базы», уровень 19 не выводит «признаков нет»
    без измеренных маркеров → `structured-analytics-data-gaps.test.ts`.
  - `hubDiagnostics` вынесен в чистую `computeHubDiagnostics(historyWorkouts, plannedWeekly)`
    (`TrainingScreen_parts/hub-diagnostics.ts`): объём, пропуски и средний RIR считаются в одном 7-дневном окне,
    ветка 7–14 дней и `cutoff14` удалены; RIR читается через `measuredSetRir` (легаси-ноль при RPE 8 — RIR 2,
    ноль без RPE — «нет измерений») → `hub-diagnostics.test.ts`. Половины e1RM по-прежнему берутся по медиане
    дат: границы мезоцикла в истории нет.
  - `overallScore` штрафует только оценённые уровни: у `AnalyticsLevel` появился `dataMissing`, у
    `StructuredAnalyticsOutput` — `evaluatedLevels`/`dataGapLevels`; карточка печатает «оценено N из M» и
    «Нет данных для N из M уровней — на оценку не влияют», а уровни без данных не попадают в ⚠-список →
    `structured-analytics-data-gaps.test.ts`, `structured-analytics-card.test.tsx`.
  - Уровни 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22 и паттерны 6–10 без входных данных остаются
    `status: 'warning'` (уровень не выдаётся за «оптимально»), но помечены `dataMissing` и молчат в предупреждениях.
  - Непосчитанные показатели профиля — `null`/«—», а не 0/1: `FatigueProfile.acwr/monotony/strain/recoveryDebt` и
    `predictions.overtrainingRisk/plateauRisk` нулевые только при измеренном входе. Уровень 19 считает маркер лишь
    из измеренного компонента (ACWR / монотонность / RPE / ЦНС-подходы) и печатает «—» для остальных, в инсайте —
    «проверено N из 4 маркеров»; уровень 22 без динамики объёма пишет «риск плато не оценивается», а не
    «прогноз благоприятный».
  - Нулевой объём (подходы без веса) — не «объём в норме» и не плотность (уровни 2 и 4 `dataMissing`); уровень 18
    без длительности печатает «—» вместо 0 минут; уровень 5 без подходов — «—» вместо «0/0/0» →
    `structured-analytics-data-gaps.test.ts`.
  - Push/pull: без тяги — «Тяговых упражнений нет — перекос в push» (прежний текст был перевёрнут), без обеих
    категорий — `dataMissing` и «—» в `ratio`. Статусы уровней 2 (спад объёма), 15 (порог предупреждения 10),
    17 (<2 тренировок/нед) и 22 (риск плато >50 %) приведены в соответствие со своими текстами.
  - Единое правило RIR — `src/core/rir-honesty.ts` (`measuredSetRir`): `rirMissing`/пусто → `null`;
    `rir: 0 + rpe: 8` → 2 (заполнитель старой сборки); `rir: 0 + rpe: 10` → 0 (настоящий отказ); ни RIR,
    ни RPE → `null`. Потребители: `workout-summary.engine.ts` (`avgRIR`/`failureSets` и `SetDetailRow`),
    `DiaryAnalyticsView.tsx`, `hub-diagnostics.ts` → `rir-honesty.test.ts`,
    `workout-summary-rir-legacy.test.ts` (замок: подход `rir: 0, rpe: 8` не считается отказом и печатается
    как `@2`, а не `@0`), `workout-summary.engine.test.ts` (фикстуры «RIR 0 = отказ» получили `rpe: 10`).
  - `sessionToWorkoutLog`/`StrengthDiary` переносят `rirMissing` в журнал: правка была обещана сообщением
    коммита `0178a8619`, но не попала в него, поэтому закоммиченный `rir-missing-journal-boundary.test.ts`
    падал на HEAD; теперь метка реально переживает границу сессии.
- **Закрыто в пятом проходе (после read-only ревью):**
  - Плеер: очистка поля RIR больше не пишется как измеренный отказ. `+'' === 0` превращал стёртое значение
    в `rir: 0` + `rpe: 10`; теперь пустая строка → `rirMissing: true`, и `enteredRir` дополнительно
    проверяется на `>= 0` (иначе `-1` схлопывался в ноль и тоже читался как отказ) →
    `session-player-save-honesty.test.tsx` («стёртый RIR не превращается в „до отказа“»).
  - `measuredSetRir`: RPE вне 0..10 (`rpe: 12` из старого бэкапа) — мусор, а не измерение; прежде он
    зажимался в 10 и подходам приписывался настоящий отказ → `rir-honesty.test.ts`.
  - Авто-сплит истории: граница периодов может проходить только между РАЗНЫМИ датами (ближайшая к середине
    смена даты). Две тренировки одного дня больше не дают «+10 % за день» и прогноз 1RM из утренней сессии →
    `structured-analytics-data-gaps.test.ts` (в том числе сдвиг границы при дубле даты).
  - Тренд RPE без измерений в прошлом периоде — «—», а не «стабильно 0.0»; сама интенсивность при этом
    остаётся оценённой (иначе реальный «критический» RPE не штрафовал бы балл).
  - ЦНС-вход без единого RPE — не «баланс в норме»: уровень 15 `dataMissing` и «—», маркер `cns` в уровне 19
    больше не считается измеренным → покрыто тестом «история без RPE».
  - `computeStructuredAnalytics([])` отдаёт `null` в непосчитанных полях (`acwr/monotony/strain/recoveryDebt`,
    риски), а упражнение без подходов не даёт `-Infinity` в 1RM.
  - `computeHubDiagnostics`: окно ровно 7 календарных дней (включая сегодня; прежнее `>=` захватывало 8 дат),
    ACWR требует 3 sRPE-сессии И непустую хроническую базу (2 записи в одной неделе давали ratio 2.0),
    медиана дат e1RM считается по уникальным датам (две тренировки в день не обнуляли «после») →
    `hub-diagnostics.test.ts` (ACWR с базой и без, граница окна, динамика e1RM).
  - Дневник: карточка коррекции получает `acwr`/`monotony` как `undefined` при отсутствии базы (прежде —
    выдуманный `1.0`), `missedSessions` — из того же `computeHubDiagnostics`, `currentVolume` — подходы за
    7 дней, а не число упражнений за 14 тренировок (карточка подписывала их как «сетов/нед»). Мёртвый
    `expertRecentVol` удалён из контекста хаба.
- **Остаточные ограничения (осознанно, не дефекты):**
  - Деление истории на прошлый/текущий период выполняет движок (одна точка правды для всех вызывающих), но
    границы мезоцикла в истории по-прежнему нет — это первая/вторая половина по дате, граница сдвигается к
    ближайшей смене даты; при всей истории одного дня прошлого периода нет (`dataMissing`).
  - `computeStructuredAnalytics([])` сохраняет нейтральный `overallScore = 50` (карточка в этом случае ничего
    не рендерит), но метрики профиля и риски в этом ответе — `null`, а не нули.

- **Закрыто в шестом проходе (26–27.11.2026) — два последних красных теста репозитория:**
  - `src/engines/__tests__/diary-mmc-checkin-integration.test.tsx` ждал «2 сетов», а `MMCTrackingCard`
    после `8aeb72252` печатает `ruCount(a.totalSets, RU_SETS)` → «2 сета». Тест фиксировал неверное
    склонение, а не поведение продукта: ожидание заменено на `/2 сета/`, файл
    заодно приведён к Prettier. Прогон файла: 10 passed (было 1 failed | 9 passed).
  - `src/ui/screens/Calculator/__tests__/calc-cardio-vitals-domains.test.ts` держал границы калия
    литералами 5.0/5.1, а проход 209 (`4c95e0dae`) сознательно поднял верх ступени
    `LAB_TIERS.POTASSIUM` до 5.1 (референс Хеликс 06-064): 5.1 стала нормой, и домен «Электролиты»
    перестал включаться на 5.1. Теперь тест берёт границы из `LAB_TIERS.POTASSIUM.normal`
    (граница ступени — норма, шаг за ней — домен) и не может разойтись с данными. Прогон файла: 18 passed.
  - Полный `vitest run` до правки второго теста: `24449 passed | 1 failed (24470)` — единственным
    падением был он. Финальный прогон после обеих правок: `1932 passed | 4 skipped (1936 файлов)`,
    `24459 passed | 20 skipped`, exit 0.
- **Закрыто в третьем проходе:** производители `he_pl_runtime` пишут `startDate` (см. выше), поэтому
  календарь, виджет, плеер и планёр строят плановые дни от якоря. Дат у отдельных дней по-прежнему нет:
  `days` остаётся плоским списком, а дата дня = N-й тренировочный день от `startDate` по графику профиля.
  Два источника локальной даты (`core/local-date.localIsoDate` и `engines/bb/bb-contest-prep.isoToday`,
  второй использует `SRCBBScreen`) функционально совпадают — сведение отдельной правкой. Отдельного «дня
  начала цикла» в профиле нет: фаза `pattern` идёт от `startDate` плана, при смене плана цикл начинается
  заново (продуктовое решение).

## 3. Порядок закрепления

1. P2-1 + P2-2 вместе (одно правило статуса, одна подпись) — один коммит `fix(bb)`.
2. P2-3 — отдельный коммит `test(data)` + при наличии правки данных `fix(data)`.
3. P1-2 + P2-4 — ряд коммитов `fix(workout)` (мост виджетов, журнал), каждый со своим тестом.
4. P1-1 — после P1-2, в тот же ряд `fix(workout)`.
5. P1-3 и P2-5 — инфраструктурные, отдельно от смысловых.

## 4. Чек-лист проверки для каждого пункта

- `npm run type-check` → 0 ошибок.
- `npx vitest run <затронутые тесты>` → зелёные (полный `test:bb` — после P1-3).
- `npm run verify:apk-design` → OK, если тронут UI/APK-разметка.
- `git status` → в коммите только файлы пункта, чужие WIP-файлы не втянуты.
