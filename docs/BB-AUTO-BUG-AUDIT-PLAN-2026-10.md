# BB-AUTO: полный план реальных недостатков и неработающих функций (v3, верифицированный)

> Дата: 2026-10-31. Версия 3 заменяет v2 (2026-10-18), которая опиралась на архив аудита и содержала
> пункты «на проверку», уже закрытые в коде.
>
> Метод: каждый дефект подтверждён чтением кода **и/или** изолированным прогоном движка.
> Все записи ниже имеют статус `OPEN` (подтверждён) либо `VERIFIED / NO ACTION`.
> Ничего не исправлялось — это план.

---

## 0. Главный вывод

Движок ББ (объём, taper, packing, ramp, MEV-калибровка, восстановление, contest-prep) **рабочий**:
полный прогон `src/engines/bb/__tests__` — `267 passed / 4 skipped` файлов, `3104 passed / 20 skipped`
тестов, **0 failed**.

Реальные дефекты сосредоточены в трёх слоях, которые тестами не покрыты:

| Слой | Что происходит | Сколько дефектов ниже |
|---|---|---|
| **UI → движок (BbAutoConstructor)** | Пост-обработка плана (свопы, «предпочтения», L/R, PROF) применяется **после** `buildBBPlan` и **не пере-финализируется**: нет `workSets`, рассинхрон `sets`, стухшая валидация | BB-01 … BB-03, BB-13, BB-14, BB-16 |
| **Финализатор и автопилот** | Хардкод-гарантии PPL и P8-фидеры добавляют упражнения **без учёта инвентаря** и с именами вне каталога → ошибки валидатора в готовом плане | BB-04, BB-05 |
| **Персистентность и входы** | Параметры (режим, цикл, фарма, травмы, фокус) теряются при перезагрузке; `age`, `painLevel`, `soreness010`, `cooldownHistory`, `deloadReadiness` не доходят из UI | BB-06 … BB-09, BB-10 |

Побочно: валидатор выдаёт ложные `muscle_attribution` (BB-15), а диагностический `zzattr.test.ts`
печатает «Total issues: 115» и всегда зелёный (BB-17) — из-за этого шум в отчётах считался «багами движка».

---

## 1. Реестр подтверждённых дефектов

Легенда приоритета: **P1** — пользователь получает неверный/небезопасный план или падение;
**P2** — функция молча не работает/врёт в цифрах; **P3** — шум, консистентность, долг.

### P1

#### BB-01. Пост-обработка плана не валидируется и не финализируется (зонтичный дефект)

- **Где:** `BbAutoConstructor.tsx:2369-2505` (свопы, предпочтения, PROF-коррекции, L/R-добивка)
  → `:2537 setBuiltPlan({ ...plan })`.
- **Что не так:** все инъекции идут поверх уже финализированного `buildBBPlan`. Обратной
  `revalidateEditedPlan`/`syncBBPlanSetShape` нет (для ручных правок она есть — `:2993`).
  Поэтому `plan.validation`, `weeklyVolume`, `metrics` остаются от плана **до** инъекций.
- **Последствия:** ошибки `sets_mismatch` невидимы; недостающий `workSets` доезжает до runtime;
  недельный объём в отчёте не учитывает добавленные упражнения.
- **Минимальный фикс:** в конце `buildBb` — `setBuiltPlan(revalidateEditedPlan(plan))`;
  для случая «план не менялся» — не трогать. Это одна строка + прогон существующих тестов
  правок (они уже используют `revalidateEditedPlan`).
- **DoD:** после сборки плана с `preferredExerciseIds`/`lrTopUp`/свопами:
  у каждого упражнения `sets === workSets.length`; `plan.validation.errors.length === 0`
  (кроме обоснованных предупреждений уровня `warning`).
- **Проверка:** unit-тест на чистой функции сборки инъекций (см. BB-02) + ручной клик по «вес +3%».

#### BB-02. «Предпочтительное» упражнение добавляется без `workSets` (и затирает `workSets` при замене)

- **Где:** `BbAutoConstructor.tsx:2399-2406` — push объекта `{ ..., sets: 3 }` без `workSets`;
  `:2421` — своп заменяет существующее упражнение объектом без `workSets` (старые сеты теряются).
- **Последствия (цепочка):**
  1. `handleSendToExecution:3024` — `targetSets = (e.workSets || []).map(...)` → пустой массив,
     упражнение в плеере без подходов;
  2. `adjustWeight:2081-2090` — `for (const ws of e.workSets)` → `TypeError` при клике «вес +3%»;
  3. `handleReplaceExercise:2989` — `target.workSets.map(...)` → `TypeError`;
  4. объём/отчёт не считают это упражнение.
- **Минимальный фикс:** общий helper `makeWorkSets(sets, reps, rir, weight)` (взять шаблон
  генерации из `bb-builder:2996-3035`), применять в обеих ветках; плюс BB-01.
- **DoD:** каждый добавленный/заменённый объект имеет `workSets.length === sets`;
  клики «вес±», «заменить», «на тренировку» не падают на таком плане.
- **Проверка:** вынести инъекционный блок в `bb-auto-injections.ts` и покрыть unit-тестом
  (сейчас логика живёт внутри 4000-строчного компонента и недостижима для тестов).

#### BB-03. Замена упражнения: вес считается от композитной группы, `muscle` портится

- **Где:** `applyBbSubstitution:2136` — `bbWorkMax[(rep as any).group || oldEx.muscle || 'chest'] || 80`;
  `:2144` — `muscle` берётся из каталожной `group`; `handleReplaceExercise:2988` — `target.muscle = found.group`;
  свопы `:2420-2421` — вес вообще не пересчитывается.
- **Что не так:** у каталога группы композитные (`arms`, `legs`, `shoulders`, `core`), а
  `bbWorkMax`/канон объёма — по мышцам (`biceps`, `quads`, `delt_mid`…). Итог: для любого
  упражнения рук/ног/плеч вес = **fallback 80 кг**, а объём приписывается несуществующей мышце.
- **Минимальный фикс:** `const canon = trueMuscleOf(newCat)` для `muscle` и
  `bbWorkMax[canon] ?? bbWorkMax[oldEx.muscle] ?? 0` для веса; для свопов — `loadRatio`
  (как уже сделано в `handleReplaceExercise:2989`).
- **DoD:** замена «жим штанги лёжа → разводка гантелей»: вес ≤ workMax груди, `muscle='chest'`;
  замена в день ног не даёт `weight=80` при workMax 140; в `weeklyVolume` нет ключа `legs`.

#### BB-04. Гарантии PPL и P8-фидеры игнорируют инвентарь → план с ошибками валидатора

- **Где:** `bb-finalize.engine.ts:1983-2052` (`ensurePPLCalves`, хардкод `'Подъём на носки сидя'`),
  `:2207-2250` (`ensurePPLLegs`: `'Жим ногами (45°)'`, `'Разгибания ног в тренажёре'`),
  хардкод-записи в `ensurePPLBiceps/Triceps/Chest/Back` (`:1850-2140`), применяются всегда
  через `applyPPLRules:2252`; `bb-autocoach:958` — `suggestFeeders(weakPoints, [])`.
- **Измерено (probe, удалён после прогона):**

  | equipment | ошибки `equipment_restriction_violation` |
  |---|---|
  | `['dumbbell']` | **11** |
  | `['dumbbell','barbell','bodyweight']` | **9** |
  | `['dumbbell','barbell','cable','machine','bodyweight']` | 0 |

  Примеры нарушителей: `Подъём на носки сидя`, `Жим ногами (45°)`, `Разгибания ног в тренажёре`,
  `Сгибания ног в тренажёре лёжа`, `Гиперэкстензия (45°)`.
- **Последствия:** пользователь с домашним залом получает «зелёный» по ощущениям, но формально
  невалидный план (ошибки в `plan.validation`, предупреждение при отправке на тренировку),
  и не может выполнить упражнения.
- **Минимальный фикс:** в каждой `ensurePPL*` брать кандидата только через
  `findCatalogCandidate(...)` (он уже фильтрует `equipment`, `mobility`, `avoidAxialLoad`);
  если кандидата нет — не добавлять (не подставлять хардкод). В P8 — передавать `equipment`
  в `suggestFeeders`.
- **DoD:** для любого набора оборудования без `machine` планы `ppl_6`/`upper_lower_4` дают
  **0** ошибок `equipment_*`; для полного зала — регресса нет (текущие тесты зелёные).

#### BB-05. P8-фидер: упражнения вне каталога, только 1-я неделя, дубль с фидерами билдера

- **Где:** `bb-autocoach.engine.ts:954-998`; имена вида `'Разгибания рук на блоке (лёгкий)'`,
  `exerciseName = f.exercise` (display-name), `sets: 3`, `only first matching week`.
- **Измерено (probe):** `applyPostPhaseProcessing({weakPoints:['triceps']})` добавляет **ровно 1**
  упражнение, `week=1`, `inCatalog=false`; при этом `notes` обещают «Ежедневно 3×12».
- **Последствия:** `equipment_unknown_exercise` от валидатора; ключ весов/экспорта не совпадает
  с каталогом; P8 дублирует фидеры билдера (`bb-builder:3910-3982`: 2 сета, все недели,
  с фильтром оборудования) → в одной сессии возможны 2+3 сета фидера на одну мышцу,
  а недельный объём получает непредусмотренный скачок в неделю 1 (ломает рампа-логику).
- **Решение (выбрать одно):**
  1. удалить P8-ветку и оставить единственный пайплайн фидеров в билдере (предпочтительно), или
  2. переписать P8 на каталожные id + `equipment` + все недели + дедуп по `muscle+session`.
- **DoD:** при `weakPoints.length > 0` в плане нет упражнений, отсутствующих в `EXERCISE_CATALOG`;
  нет двух фидеров одной мышцы в одной сессии; `equipment_*` ошибок = 0.

#### BB-06. Параметры BB-Auto не переживают перезагрузку (режим, программа, фарма, травмы, фокус)

- **Где:** `training-profile.ts:98-124` — маппинг UnifiedSettings → TrainingProfile **не содержит**
  `injuries`, `onCourse`, `bbPeds`, `courseIntensity`, `planMode`, `bbCycleId`, `trainingFocus`;
  `saveTrainingProfile:135-170` тоже их не пишет (кроме `trainingFocus`, который вызывающая
  сторона не передаёт).
- **Как проявляется:** инициализаторы читают `prof.*` —
  `BbAutoConstructor:291-295` (фокус/режим/цикл), `:349-351` (стек), `:419` (травмы).
  После F5: режим → `generic_split`, `selectedCycleId=''`, стек пуст → `onCourse=false`
  (**MRV и недельный бюджет падают примерно вдвое**), `courseIntensity='moderate'`,
  фокус → `hypertrophy`, травмы → `[]`.
- **Дополнительно:** `prof` мемоизирован (`:123`) и не обновляется, поэтому даже сохранение
  внутри сессии не переживает remount.
- **Минимальный фикс:** расширить интерфейс `TrainingProfile` + оба маппинга
  (load/save) всеми 7 полями; `injuries` хранить в `settings.health.injuries`
  (единый источник с профилем — см. BB-07).
- **DoD:** round-trip тест `save→load` по 7 полям; ручной сценарий: выбрать программу,
  отметить курс, добавить травму → F5 → все значения на месте, объём плана тот же (сравнить
  `weeklyVolume`).

#### BB-07. Травмы из «Профиль → Здоровье» не влияют на план BB-Auto

- **Где:** `loadTrainingProfile:98-124` не читает `s.health.injuries`;
  `BbAutoConstructor:419` берёт только `prof.injuries` (своя форма).
- **Последствия:** пользователь вносит травму в профиль (там есть `location`, `painLevel`,
  `movementLimit`), а план строится без исключений — риск усугубления травмы; при этом
  в BB-Auto есть вторая, независимая форма травм.
- **Минимальный фикс:** маппинг `settings.health.injuries → TrainingProfile.injuries`
  (`location → muscle`, `painLevel → exclude/volumePct`), запись обратно через `updateProfile`;
  в UI показывать «из профиля» с возможностью переопределить.
- **DoD:** травма колена в профиле → в плане нет `oseвых` приседаний/выпадов на эту ногу,
  в `rationale` есть строка про исключение; тест конверсии.

#### BB-08. `age` не доходит до движка → коррекция для 40+ не работает у пользователя

- **Где:** `bb-builder:3478` (`mastersMrvMult(input.age)`), `:54`; вызов
  `computeBBRecoveryScore` (`:3358-3364`) вообще не передаёт `age`; UI-payload'ы
  (`BbAutoConstructor:2188-2255` program, `:2269-2340` generic) `age` не содержат.
- **Последствия:** обещанное снижение MRV для мастеров существует только в тестах;
  восстановление для 45+ переоценено → систематическая перегрузка.
- **Минимальный фикс:** `age: linked.profile?.settings?.personal?.age` в оба payload
  (поле уже читается рядом — `:2584 bodyFat`), плюс `age` в `computeBBRecoveryScore`.
- **DoD:** план для `age=50` имеет `mrvMultiplier < 1` (сравнить с `age=25` при прочих равных),
  в `inputSnapshot` есть `age`.

#### BB-09. `painLevel` / `painLocation` / `soreness010` недостижимы из UI → relief-движок мёртв

- **Где:** `bb-builder:5101-5109` (`applyRecoveryRelief({ painLevel, painLocation, soreness010 })`);
  ни один вызов `buildBBPlan` из UI эти поля не передаёт (grep по `src/ui` — 0);
  `bb-diag-intake:143-145` превращает `painMon` хаба только в текст.
- **Последствия:** обещанные ×0.6/×0.85 объёма и RIR+2 при боли/крепатуре не применяются
  из продукта; единственный реальный рычаг безопасности не подключён.
- **Минимальный фикс:** прокинуть `painMon` (хаб диагностики) и данные дневника
  (`soreness010`) в payload; маппинг `green/yellow/red → PainLevel` уже есть в движке.
- **DoD:** при `painLevel='red'` объём группы ≤ 60%, `rir + 2`, в `rationale` строка «Pain relief»;
  план по умолчанию не меняется (обратная совместимость).

### P2

#### BB-10. Входы движка без источника данных

| Поле | Объявлено | Источник в UI |
|---|---|---|
| `cooldownHistory` | `bb-builder:280` («подаётся из прошлых планов/дневника»), используется `:3815` | **нет** (только тесты `bb-cooldown-rotation`) |
| `deloadReadiness` | `bb-builder:293`, `:5156` overreaching-check | **нет** (только `bb-wave3-hooks`, `bb-structural-flags`) |
| `soreness010` | `bb-builder:126`, `:5109` | **нет** (только `bb-auto-audit-2026-10-p0`) |
| `volumeWave` | `bb-builder:3736` | **нет** (контрола в UI нет) |

- **Что не так:** комментарии обещают интеграцию с дневником/историей; фактически данные не приходят.
- **Фикс:** либо подключить (дневник → `cooldownHistory` из последних 2 недель факта,
  `soreness010` из утренней записи, `deloadReadiness` из pre/post замеров), либо убрать
  обещание из комментария/интерфейса и пометить `@deprecated` до появления источника.
- **DoD:** решение зафиксировано в этом файле; при подключении — тест «данные → план меняется».

#### BB-11. Готовые фичи без точки входа: `replanBBMesoFromFact` и `bb-bar-path`

- **Где:** `src/engines/bb/bb-replan.engine.ts`, `src/engines/bb/bb-bar-path.engine.ts` —
  используются только в тестах (grep по `src/ui` пуст).
- **Что не так:** «пересчитать остаток мезоцикла по факту» (G7) и PRO-вердикт по траектории
  штанги (P4) реализованы, но пользователь до них добраться не может.
- **Фикс:** либо кнопка в шаге «План»/«Коррекция» (`replan` для текущего мезо),
  либо явно зафиксировать «API-only, UI вне скоупа».
- **DoD:** есть кнопка + тест сценария, либо запись в этом файле о сознательном отказе.

#### BB-12. `handleSendToExecution` пишет сырой ключ мышцы, а сборка — подпись

- **Где:** `BbAutoConstructor:3030` — `muscleGroup: e.muscle` (`'delt_mid'`);
  `:2615` — `muscleLabel(e.muscle)` (`'Плечи (средняя)'`).
- **Последствия:** в плеере группировка/фильтры по мышце ведут себя по-разному в зависимости
  от того, откуда план попал в runtime.
- **Фикс:** `muscleGroup: muscleLabel(e.muscle)` в обеих точках (или канонический ключ в обеих).
- **DoD:** один план, отправленный двумя путями, даёт одинаковые `muscleGroup`.

#### BB-13. L/R-добивка: `sets` ≠ `workSets.length`, коллизия ключа веса

- **Где:** `BbAutoConstructor:2480-2489` — `{ ...src, sets: addSets, ... }` копирует `workSets`
  исходного упражнения (например, 4 сета), а `sets` ставит 1–3; `exerciseName` тот же, что у `src`.
- **Последствия:** ошибка `sets_mismatch`; в плеере выполняется 4 подхода при учтённых 1–3;
  два упражнения с одинаковым ключом весов перезаписывают друг друга.
- **Фикс:** генерировать `workSets` ровно по `addSets` (унилатерально, слабая сторона первой),
  `exerciseName` — уникальный (`... + ' #LR'`), плюс BB-01.
- **DoD:** `sets_mismatch = 0`; сохранённый вес L/R не влияет на базовое упражнение.

#### BB-14. Свопы (Lab/PROF) не пересчитывают вес и оставляют старую мышцу

- **Где:** `BbAutoConstructor:2420-2421` — `{ ...ex, name, exerciseName: newCat.id, ...keeps }`,
  `keeps.muscle = ex.muscle || newCat.group`.
- **Последствия:** замена «присед → жим ногами» сохраняет 140 кг на снаряде с другим
  рычагом (травмоопасно); при замене на другую мышцу объём считается по старой.
- **Фикс:** `loadRatio` между снарядами (как в `:3504` финализатора) + `trueMuscleOf(newCat)`.
- **DoD:** своп меняет вес в пределах разумного (0.3–1.0 от исходного) и корректно переносит мышцу.

#### BB-15. Валидатор: ложные `muscle_attribution`

- **Где:** `bb-validator.engine.ts:203` — `trueMuscleOf({ name: exercise.name, muscle: exercise.muscle })`.
- **Что не так:** в объекте нет `group`/`targetMuscle`, поэтому `derivePattern`
  (`movement-pattern.ts:99`) ловит общий regex `/жим/` и отдаёт `horizontal_push → chest`.
  В результате: `Арнольд-жим` (каталог `delts`), `JM-жим` (`triceps`), `Отжимания от скамьи`
  (`triceps`), `Пуловер` и т.п. получают предупреждения «каталог определяет chest».
- **Пруф:** пробный прогон `zzattr.test.ts` печатает эти предупреждения на чистом плане.
- **Фикс:** резолвить каталожную запись (`resolveExerciseCatalogEntry` уже импортирован
  и используется на `:220`) и передавать полный объект (`group`, `movementPattern`, `targetMuscle`).
- **DoD:** на эталонном плане предупреждений `muscle_attribution` для Арнольд/JM-жима нет;
  реальные мис-атрибуции (если есть) остаются.

#### BB-16. Смешанная конвенция `exerciseName` (id vs display-name)

- **Где:** движок пишет display-name — `bb-builder:2996` (`exerciseName: exData.name || exData.id`);
  UI-замены пишут **id** — `BbAutoConstructor:2144`, `:2421`, `:2987`
  (при этом комментарий `:2141` утверждает обратное).
- **Последствия:** ключ весов/калибровки/экспорта для заменённого упражнения не совпадает
  с остальным планом → сохранённый вес не подхватывается, возможны дубли записей.
- **Фикс:** выбрать один канон (рекомендую `id` — устойчив к переименованию) и ввести
  helper; чтение старых ключей — с fallback по имени. Либо вернуть UI на display-name
  и удалить неверный комментарий.
- **DoD:** ключи весов для одного и того же упражнения совпадают во всех точках
  (сборка / замена / плеер / экспорт), есть тест на helper.

### P3

#### BB-17. `zzattr.test.ts` — probe без ассертов, засоряет прогон

- **Где:** `src/engines/bb/__tests__/zzattr.test.ts` — `expect(true)`, печатает
  `Total issues: 115` и десятки предупреждений.
- **Фикс:** либо превратить в регрессионный тест с реальными границами
  (например, `expect(issues.filter(i => i.code === 'muscle_attribution').length).toBe(0)`
  после BB-15), либо перенести в `scratch/` и убрать из `__tests__`.
- **DoD:** в прогоне нет «тестов», которые не могут упасть.

#### BB-18. Алиасы зон в `suggestFeeders`

- **Где:** `bb-autocoach:508-620` — `switch` покрывает `side_delts/delt_mid/…`, но **не**
  `rear_delts`, `upper_back`, `chest_mid`, `lower_back`, `adductors`, `neck`.
- **Последствия:** при слабой зоне «задние дельты» фидер молча не добавляется.
- **Актуальность:** если BB-05 закрывается удалением P8, дефект уходит вместе с ним.
  Если P8 остаётся — добавить нормализацию ключа через `WEAK_TO_MUSCLE`.
- **DoD:** все зоны из мультиселекта дают фидер либо сознательно исключены списком.

---

## 2. Мёртвые/недостижимые входы движка (сводная таблица)

| Вход | Движок | UI | Вердикт |
|---|---|---|---|
| `age` | `bb-builder:3478`, `bb-volume:computeBBRecoveryScore` | не передаётся | **BB-08 (P1)** |
| `painLevel` / `painLocation` | `bb-builder:5101-5109` | не передаётся | **BB-09 (P1)** |
| `soreness010` | `bb-builder:126,5109` | не передаётся | **BB-09/BB-10** |
| `cooldownHistory` | `bb-builder:280,3815` | не передаётся | **BB-10** |
| `deloadReadiness` | `bb-builder:293,5156` | не передаётся | **BB-10** |
| `volumeWave` | `bb-builder:3736` | контрола нет | **BB-10** |
| `hrvBaseline` | `bb-builder:249-254,3362` | не передаётся, но `computeBBRecoveryMultiplier:286` берёт базу из `he_hrv_log` | **не баг** (есть fallback) |
| `wearable` | `bb-builder:3421` | передаётся (`:2251,2333`) | ok |
| `recoveryMultOverride` | `bb-builder:3366` | передаётся (`:2242,2311`) | ok |
| `labMrvMultiplier`, `bodyFat`, `leanMass`, `proteinPerKg`, `hrvMs` | builder | передаются | ok |
| `volumeRamp` (programs) | не используется в `cycle-to-plan` | контрол в этом режиме скрыт (`bb-step-params:418-433`) | **не баг**, но декларация в `ProgramToBBPlanOptions:2027` мертва — убрать |

---

## 3. Проверено — НЕ является дефектом (снимаем с реестра)

| Пункт | Почему закрыт |
|---|---|
| packingV2 не применяется | `packedSets` учитывается: `bb-builder:2852-2928` |
| Taper не идёт по PPL/cycle/program | guard-пассы `taper/taperApplied/peakWeek` в finalize (`810,932,2605,3300,3713,3775,3979,5873`) |
| Taper ×1.0 при `taper:true` | идемпотентность `bb-autocoach:1112,1161` |
| MRV cap ×1.15 vs validator | единый `BB_MRV_TOLERANCE=1.15` (`bb-volume:19`) |
| `detectGarbageVolume` мёртв | работает: `bb-autocoach:671-680` |
| Ramp-скачок 55–67% | `lastAppliedWeekMult` + `MAX_WEEK_RAMP` (`bb-builder:3726-3730`) |
| MEV-калибровка не доходит | `mevCalibration` → `finalizeBBPlan` (`bb-builder:5041-5048`) |
| Contest-prep experience/glycogen | «показано = применяется» (`BbAutoConstructor:729-732`) |
| Save/restore теряет параметры | restore из `inputSnapshot` + `applyVariantParams` |
| `metrics.mrvMultiplier = 1` | считается (`BbAutoConstructor:1807-1811`) |
| Нет action-row в диагностике | `renderActionRow:3317,3619,3771` |
| Adherence по сессиям | elapsed-окно `planWeeksStartISO` |
| e1RM без null-guard | `number\|null` + badge |
| `workMax['legs']` unknown | `DEFAULT_WORKMAX` + collapse-resolver |
| `bb-insulin-window` — мусор | интегрирован: `bb-builder:80,5407-5408` |
| `lengthened_partials` / `rest_pause_cluster` | `bb-autocoach:457-472` |
| `freqOptResult` не отображается | отображается (`:3621-3627`) |
| CSV/print-инъекции | `csvCell` + экранирование `& < > " '` в `handlePrintPlan`, `buildBBPlanPrintHtml`, `buildContestPrepPrintHtml` |
| VBT-пороги захардкожены | per-lift пороги; standalone-проход `bb-builder:5130` работает и без autoReg |
| manual-draft «−20 сетов» / `volumeGoal` | «−20» не найдено; `volumeGoal` опционален, default `mav` |
| auto-MEV-фидер ломает deload | добавляется до финализации, deload-пассы его обрабатывают |
| `reconcileVolumeTargets` мешает фидерам | вызывается **после** `finalizeBBPlan` (фидеры уже добавлены) |
| 5 «известных падающих» файлов | все проходят изолированно: `course-sync` 11, `bb-macrocycle` 35, `annual-audit-fixes-2026-08` 14, `pl-auto-regressions` 3, `bb-diagnostics-max-pro` 94 |
| Полный прогон движка | `3104 passed / 0 failed` (см. §0) |
| Скипнутые `bb-cycle-audit-*` | намеренно (UI-покрытие M3 §8.3) |

---

## 4. Порядок работ

### Волна 1 — P1 (безопасность и корректность)

| Шаг | Дефекты | Почему в этом порядке |
|---|---|---|
| 1.1 | **BB-01** | Зонтик: без пере-финализации остальные UI-фиксы не видны в валидации |
| 1.2 | **BB-02, BB-03, BB-13, BB-14, BB-16** | Один общий рефактор: вынести инъекции в чистый модуль `bb-auto-injections.ts` + helper `makeWorkSets` / `exerciseKey` |
| 1.3 | **BB-04** | Инвентарь: правки `ensurePPL*` + `findCatalogCandidate` |
| 1.4 | **BB-05** | Решение по P8: удалить или переписать (после BB-04, чтобы не дублировать работу) |
| 1.5 | **BB-06, BB-07** | Персистентность + единый источник травм |
| 1.6 | **BB-08, BB-09** | Прокидка `age` и pain/soreness в payload |

### Волна 2 — P2

`BB-10` (решить: подключать или депрекейтить) → `BB-12` → `BB-15` → `BB-11` (решение по UI).

### Волна 3 — P3 и инфраструктура

`BB-17`, `BB-18`, тестовая инфраструктура (§5).

---

## 5. Тестовая инфраструктура (блокер для регресса)

Текущие ограничения среды:

- полный `npm test` падает по памяти (`memory allocation of 959140 bytes failed`);
- `tsc --noEmit` не завершается за 10+ минут;
- `git status/diff` иногда падает с `fatal: Out of memory`;
- рабочий формат полного прогона движка:
  ```bash
  node --max-old-space-size=6144 ./node_modules/vitest/vitest.mjs run src/engines/bb/__tests__ \
    --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1 --reporter=dot
  ```
- изолированный прогон: `npx vitest run <file> --pool=forks --reporter=dot`.

Задачи и их статус (2026-11):

| # | Задача | Статус |
|---|---|---|
| 1 | npm-скрипты `test:bb` / `test:ui` / `test:core` (сегментация полного прогона) | **DONE** — добавлены в `package.json` с безопасными флагами |
| 2 | Безопасный флаг памяти для `vitest` | **DONE** — в тех же скриптах: `--max-old-space-size=8192` + `--pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1` |
| 3 | `tsc`: `skipLibCheck` / project references / инкрементальный `tsbuildinfo` | **НЕ НУЖНО** — `npm run type-check` (4096 МБ) на текущем размере кода завершается с `EXIT=0` за приемлемое время. OOM в прошлых сессиях воспроизводился только при **параллельном** прогоне тестов; если повторится — поднять до `--max-old-space-size=12288` вручную, менять скрипт не требуется |
| 4 | Тест-паритет «UI-инъекции → revalidate → `sets_mismatch = 0`» | **DONE** — `TrainingScreen_parts/__tests__/bb-auto-wiring.test.ts` (11 проверок): пере-финализация пост-фазы, синхрон `workSets` в `adjustVolume`/`adjustWeight`, единый `makeWorkSets`, `estimatedWeightFor`/`loadRatioBetween`, `age`+`painLevel` в обоих payload, защита пересборки остатка, `muscleLabel` в плеере |

Побочный вывод по п.3: «параллельные прогоны vitest в одном проекте» — единственный
воспроизводимый источник OOM и «фантомного» `exit 1`. Прогоны запускать по одному.

Попутно (нашлось при проверке новых скриптов): `src/core/__tests__/widget-bridge.test.ts`
падал по утрам — тест брал дату `new Date().toISOString().slice(0,10)` (UTC), а
`addWater()` пишет через канон `localIsoDate()` (локальный календарь). В UTC+10 при
локальном времени до 10:00 UTC-дата = «вчера» → строки за сегодня нет. Заменено на
`localIsoDate()` из `src/core/local-date.ts`; файл 11/11.

---

## 6. Критерии приёмки плана работ

- Для каждого `BB-xx` есть регрессионный тест (unit для движка, probe-тест для UI-хелперов).
- `ppl_6` с `equipment=['dumbbell','barbell','bodyweight']` → `equipment_*` ошибок **0**.
- План с `preferred/swap/LR/soreness/pain` → `sets === workSets.length`, валидация чистая.
- Round-trip профиля сохраняет 7 полей; F5 не сбрасывает режим/цикл/фарму/травмы/фокус.
- `age=50` реально снижает MRV; `painLevel='red'` реально режет объём.
- `zzattr` больше не «всегда зелёный»; `muscle_attribution` для Арнольд/JM-жима отсутствует.
- Полный прогон `src/engines/bb/__tests__` — 0 failed; `npm run type-check` — 0 ошибок;
  `npm run verify:apk-design` — OK (UI менялся).

---

## 7. Вопросы на утверждение

1. **BB-05:** удаляем P8-фидер (единый пайплайн в билдере) или переписываем его на каталожные id?
   Рекомендация: удалить — билдерный фидер уже умеет оборудование, все недели и дедуп.
2. **BB-16:** канон `exerciseName` — `id` (с миграцией чтения) или display-name (минимум правок)?
   Рекомендация: `id` + fallback по имени.
3. **BB-10/BB-11:** подключаем к дневнику сейчас или фиксируем как «осознанно отложено»
   (тогда убираем обещания из комментариев/подсказок)?
4. **BB-04:** при отсутствии упражнения под инвентарь — молча пропускать гарантию
   (мышца недобирает объём) или предлагать ближайшую замену с пометкой в rationale?
   Рекомендация: замену через `findCatalogCandidate`, а при полном отсутствии — пропуск + warning.

---

## 8. Статус реализации (2026-11-01): выполнено

Принятые решения по §7 (реализованы в коде):

1. **BB-05** — P8-фидер **удалён**; единственный пайплайн фидеров — билдерный
   (оборудование, все недели, дедуп по имени). Функция `suggestFeeders` оставлена
   публичным API (её используют ProgramEditor/ProgramManager).
2. **BB-16** — канон `exerciseName` = **display-name** (как уже писал движок
   `bb-builder:2996`); UI перестал писать `id`. Миграция не нужна: чтение везде
   идёт через `resolveExerciseCatalogEntry(name, exerciseName)` с fallback по имени.
3. **BB-10** — `cooldownHistory` / `deloadReadiness` / `volumeWave` помечены
   `@unwired` в `BBBuilderInput`: контракт остаётся, UI-обещаний больше нет.
   **BB-11** — `replanBBMesoFromFact` подключён кнопкой «Пересобрать остаток»
   в шаге плана (недели 1..N−1 замораживаются). `bb-bar-path` — документированный
   deprecated-шим над `pro/bar-path-core` (реальный UI живёт в ТА/СМ-хабах).
4. **BB-04** — при отсутствии каталожного кандидата под инвентарь гарантия
   **пропускается** (хардкод больше не ставится); `findCatalogCandidate` ищет
   замену под доступное оборудование, полный пропуск — только если замены нет.

| ID | Статус | Где исправлено |
| --- | --- | --- |
| BB-01 | DONE | `BbAutoConstructor` — единый `revalidateEditedPlan(plan)` перед `setBuiltPlan` (пере-финализация + свежая `plan.validation`) |
| BB-02 | DONE | `adjustWeight`/`adjustVolume` guard `Array.isArray(workSets)`; `handleReplaceExercise` пересобирает workSets |
| BB-03 | DONE | `bb-auto-injections.estimatedWeightFor` (канон мышцы, без fallback 80 кг) |
| BB-04 | DONE | `bb-finalize` — `pplPushAllowed` на calves/legs/back-rename + отказ от хардкод-фолбэка |
| BB-05 | DONE | `bb-autocoach` — блок P8 удалён |
| BB-06 | DONE | `training-profile.load/save` — `planMode/bbCycleId/onCourse/courseIntensity/bbPeds/trainingFocus/injuries` |
| BB-07 | DONE | `training-profile.healthInjuriesToTraining` + `mergeInjuries` (травмы из «Здоровья» → план) |
| BB-08 | DONE | UI передаёт `age` (generic + program + SRCBBScreen); билдер → `computeBBRecoveryScore`; program-путь → `mastersAdjust` |
| BB-09 | DONE | Хаб шлёт `painLevel/painLocation`; конструктор хранит и передаёт `painLevel/painLocation/soreness010`; program-путь применяет `applyRecoveryRelief` |
| BB-10 | DONE (док) | `@unwired` в `BBBuilderInput` |
| BB-11 | DONE | Кнопка «Пересобрать остаток» в шаге плана (только сплиты; программы → честный `null`); bar-path — deprecated-шим |
| BB-12 | DONE | `handleSendToExecution` → `muscleLabel(e.muscle)` |
| BB-13 | DONE | `adjustVolume` синхронизирует workSets; L/R-добивка строит свои workSets и уникальный `exerciseName` |
| BB-14 | DONE | Свопы пересчитывают вес (`loadRatioBetween`) вместо сохранения старого |
| BB-15 | DONE | `bb-validator` — атрибуция по полной каталожной записи |
| BB-16 | DONE | UI пишет display-name (`exerciseKeyOf`) |
| BB-17 | DONE | `zzattr.test.ts` — 4 инвариант-проверки вместо `expect(true)` |
| BB-18 | DONE | `suggestFeeders` — алиасы `rear_delts`/`upper_back`/`chest_mid` |
| BB-19 | DONE | Целевой % жира: в инициализаторе `targetBodyFat` считался `def` (18/10) и выбрасывался → `cut/recomp` без явной цели молча теряли поправку объёма (`bodyCompVolumeFactor` = 1.0). Теперь fallback = `defaultTargetBodyFat(sex, goal)` |
| BB-20 | DONE | Удалён неиспользуемый `buildPeakConfig` (дубль живого `buildContestPrepConfig`; оверлей пик-недели снят — кнопка ведёт на шаг Contest Prep) + мёртвый импорт `legacyConfigFromProfile` |
| BB-21 | DONE | Удалён мёртвый `regimeMrvMult` (`computeRegimeMrvMult` считался, но нигде не применялся): единственный источник множителя — `plan.mrvMultiplier` / `pedAdapt.combinedMrvMultiplier` |
| BB-22 | DONE | `platePreset` (набор пластин зала) и `targetBodyFat` (% жира) не сохранялись: жили только в состоянии компонента и сбрасывались после перезагрузки (для % жира это ещё и меняло объём — канон пола вместо цели). Теперь персистятся в `settings.training` через `training-profile` и читаются в инициализаторах; `cycleDay` **осознанно** не сохраняется (это параметр «на сегодня») |
| BB-23 | DONE | Удалены мёртвые импорты `STEP_PILL` и `PCT_FOR_RIR` в конструкторе |
| BB-24 | DONE | Мёртвый код в соседних экранах BB: в `SRCBBScreen` — `isCompound`, `cardBg`, `SEL`, `LABEL`, `CAT_GROUPS`, `GRP_RU`, `addAccessory`, `toggleDayInMap`, `toggleExerciseInMap` + 3 неиспользуемые карточки (`TaperCoachCard`, `DeloadProtocolCard`, `LimiterCalculatorCard`); в `BBDiagnosticsHub` — 13 импортов оговорок/справочников (реально рисуются в `bb-hub-screening-tab.tsx`, в хабе были пустыми) |

### Новые файлы/замки

- `src/ui/screens/TrainingScreen_parts/bb-auto-injections.ts` — чистые хелперы
  пост-обработки плана (канон мышцы, workSets, вес, коэффициент свопа, ключ упражнения).
- `src/engines/bb/__tests__/bb-auto-audit-2026-11.test.ts` — 19 регрессионных
  проверок на BB-01…BB-18 (оборудование, фидеры, возраст, боль — generic и program
  пути, атрибуция, алиасы, пересборка остатка, хелперы инъекций).
- `src/ui/screens/TrainingScreen_parts/__tests__/training-profile-health-injuries.test.ts` —
  3 проверки BB-07: русские локации профиля «Здоровье» → канон мышц, тяжёлая травма
  = исключение, явная запись BB-Auto приоритетнее производной.
- `src/ui/screens/TrainingScreen_parts/__tests__/bb-auto-wiring.test.ts` — 13 source-guard
  проверок **проводки** (не хелперов): BB-01 пере-финализация пост-фазы, BB-02/BB-13 синхрон
  `workSets`, единый `makeWorkSets`, BB-03/BB-14 расчёт веса, BB-08/BB-09 `age`+боль в обоих
  payload, BB-11 защита пересборки остатка, BB-12 подпись мышцы в плеере, BB-19 канон
  `defaultTargetBodyFat`, BB-20/BB-21 отсутствие вернувшегося мёртвого кода.
- `src/ui/screens/TrainingScreen_parts/__tests__/training-profile-params.test.ts` —
  2 проверки BB-22: round-trip `platePreset`/`targetBodyFat` и «очистка % жира не
  залипает на старом значении».

### Верификация

- `tsc --noEmit` — **EXIT=0** (после всех правок).
- Финальный **чистый** прогон (одиночный, без параллельных vitest-процессов):
  `src/engines/bb/__tests__` + `training-profile-health-injuries` + `profile-integration`
  + `profile-e2e` → **271 файл / 3171 тест passed, 0 failed, 20 skipped**,
  `FINAL_LASTEXITCODE=0`, 39 мин 37 с.
- `bb-auto-audit-2026-11` — **19/19 pass**; `training-profile-health-injuries` (BB-07) — **3/3**;
  `profile-integration` + `profile-e2e` — **42/42**.
- Зафиксировано наблюдение: если запустить vitest **параллельно** с другим прогоном
  того же проекта, процесс может завершиться с кодом 1 при нуле упавших тестов
  (общий Vite-кэш, ошибка на teardown). Прогоны запускать по одному.
- `npm run test:core` — **33 файла / 454 теста passed**, `EXIT=0`.
- `npm run test:ui` — **555 файлов / 5330 тестов passed**; 1 файл красный
  (`movement-hub-export-metadata.test.tsx`, 2 теста про «модель поворота») —
  это незакоммиченная работа другого автора в `src/engines/pro/*` и
  `src/core/ocr-engine.ts` на момент прогона, к BB-Auto не относится.
  Оба новых замка (`bb-auto-wiring`, `training-profile-health-injuries`) — зелёные.

### Важные заметки для будущих правок

- `bb-auto-injections.ts` — единственное место, где UI собирает упражнение «поверх
  плана». Не добавлять push без `makeWorkSets`: `finalizeBBPlan` начинает с
  `syncBBPlanSetShape`, но слайсы/пороги читают `workSets` раньше.
- Пере-финализация после инъекций (`revalidateEditedPlan` в `postPhaseInjected`)
  включается **только** при реальных инъекциях — чистая сборка программ (faithful)
  обязана оставаться байт-в-байт.
- Локации травм в профиле «Здоровье» — **русские** подписи (`INJURY_LOCATIONS`);
  любые новые места конверсии должны идти через `HEALTH_LOCATION_TO_MUSCLE`.
- Пересборка остатка (`replanBBMesoFromFact`) работает только для планов из сплита:
  у ПРОФ-программ `pattern.id` = id программы, и движок возвращает `null`
  (иначе `buildBBPlan` молча падал бы в `SPLIT_PATTERNS[0]` — чужой сплит).
- **Не править файлы, пока идёт прогон сьюта**: воркер кеширует трансформ модулей,
  и правка посреди прогона даёт «смешанную» версию (тест может упасть на коде,
  который уже исправлен).

