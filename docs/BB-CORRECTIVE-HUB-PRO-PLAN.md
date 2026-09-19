# ББ-коррекции в контексте хаба — PRO-уровень: аудит реальности упражнений + план K1–K7

Статус: **ВЫПОЛНЕН ПОЛНОСТЬЮ** (K1–K7, 7 коммитов pathspec: `617f994b` K1 · `41a3508a` K2 ·
`e3bc0fce` K3 · `b410f593` K4 · `c74d4f19` K5 · `28b34fef` K6 · `77babb5e` K7; без пуша).
Проверено: corrective/diagnostics/injection/rank 32 файла **530/530**, все bb-UI 23 файла/189,
`tsc --noEmit` 0 по всему проекту, `verify:apk-design` OK. Осознанный re-baseline не потребовался
(PRO-5-локи не менялись по контракту). См. §7 (факт) ниже. Дата плана: Sep 18 2026.
Запрос: «проверь все упражнения коррекции и их реальность именно в контексте хаба — должно быть всё
чётко и профессионально; хаб должен стать уровнем про».
Основание: аудит кода `bb-corrective.engine.ts` (43 записи) + `bb-correction-rank.engine.ts` +
`bb-exercise-correction.engine.ts` + `bb-diagnostics-injection.engine.ts` + хаб/интейк/тесты
(полные выкладки — §1). Web-поиск в этой сессии недоступен (провайдер вернул 403) — синтез §2
собран из уже верифицированных источников прошлых раундов (ссылки в §2), ничего выдуманного.

Где живёт коррекция в хабе (3 слоя, важно не путать):
1. **Библиотека** `BB_CORRECTIVES` — карточка «🛠 Коррекция по скринингам» (`corrective-card`),
   доза/кью/прогрессия/ре-тест; она же — первичный источник инъекции (`preferredIds`/`corrective`).
2. **Каталожный ранжир** `rankCorrectionsForWeak` — чипы топ-3 в «Слабых» и fallback инъекции.
3. **Разбор** `prescribeCorrections` — замены/добавления в табе «Разбор».

---

## §1. Аудит (факты, file:line)

### 1.1. Реальность id — база чистая
- `BB_CORRECTIVES` = **43 записи / 40 уникальных `exerciseId`** (`bb-corrective.engine.ts:60–206`),
  в шапке файла заявлено «~50» (`:57`) — доки дрейфуют.
- **Все 40 id существуют** в `EXERCISE_CATALOG` (нормализация keep-first, `exercise-catalog.ts:686–721`);
  дубликаты id переиспользованы осознанно: `incline_db` (`cu-incline-length`/`cu-bench-neutral`),
  `bulgarian_split_db` (`lh-tempo-split`/`ybt-split-reach`), `dead_bug` (`core-deadbug`/`pm-deload-technique`).
- `equipmentAlt` (все 40+ id реальны) — поле **не читается нигде** → мёртвые данные (`:43`).

### 1.2. Смысловые несоответствия title ↔ упражнение (главный «непро» слой)

| # | Запись (line) | Сейчас | Проблема | Кандидат (id существует) |
|---|---|---|---|---|
| 1 | `tri-overhead-length` (`:168`) | title «Французский из-за головы (длина)» → `kickback_v2` (разгибание в наклоне) | длина трицепса кикбэком не достигается | `bb_triceps_long` (растянутая головка) |
| 2 | `tri-pushdown-peak` (`:171`) | «Разгибания на блоке (пик)» → `dips_tricep_v2` (брусья) | подмена снаряда/смысла | `tricep_pushdown_rope` / `tricep_pushdown_bar` |
| 3 | `dr-erir-rotation` (`:107`) | «Наружная ротация» (ре-тест ER:IR) → `cable_facepull_rope` | face pull ≠ ротация | `cable_external_rotation` / `scaption` |
| 4 | `sh-neutral-press` (`:188`) | «Жим нейтральным» → `pulldown_rev` (тяга) | заявлен жим, вставлена тяга | реальный жим нейтральным/лэндмайн (подобрать по каталогу) либо честно переименовать в тягу |
| 5 | `lh-trap-swap` (`:192`) | «Трап/блоки вместо пола» → `hack_squat_ham` (гакк) | трап-гриф подменён; в каталоге есть трап | `deadlift_trapbar` |
| 6 | `cu-bench-neutral` (`:66`) | кью «Хват 1.2–1.5 BAW» → `incline_db` (гантели) | кью про штанговый хват на гантелях | штанговый вар (`incline_bar`/`bench_bar`) или переписать кью |
| 7 | `ch-fly-stretch` (`:70`) | разводка приписана `chest_lower` | спорная атрибуция низа груди | уточнить targets либо добавить реальный низ (`dips_chest` уже есть) |
| 8 | `core-hinge-rdl` (`:181`) | targets `core`, упражнение `rdl_db` (ноги) | в план уедет `muscle:'core'` с 3 сетами → ломается учёт объёма | targets → `hinge-fail/hamstrings`, muscle из каталога |
| 9 | `ad-copenhagen` (`:154`) | muscle `adductor`, а `adductor` нет в `WEAK_TO_MUSCLE` (`bb-builder.engine.ts:~645`) | инъекция/учёт идут «мимо» мышц; каталожный ранжир для `adductor` пуст | добавить `adductor` в маппинг либо мапить на `glutes`/`hamstrings` |
| 10 | `g-clam-complex` (`:144`) | title «Комплекс ТБС 8 нед» → 2×15–20 изоляции | комплекс живёт только в тексте progression | переименовать/вшить реальный комплекс в protocol |

### 1.3. Инъекция: реальность дозы расходится с показанным (`bb-diagnostics-injection.engine.ts`)
- **Вес всегда 32.5 кг**: хаб не передаёт `workMax` (`BBDiagnosticsHub.tsx:1612`), движок берёт
  `base=50`, `weight=round(base*0.65/2.5)*2.5` (`:145–149`) — одинаково для `dead_bug`, `wall_slide`,
  `hip_thrust_barbell`, `rdl`. В `BBPlan` workMax не хранится.
- **rest всегда 90 с** (`:157`): библиотечные 45–150 (`restSec`) не доезжают, поля в opts нет.
- **repsMax теряется**: хаб шлёт `reps: dose.repsMin` (`:1569`), инъекция пишет один reps (`:198–200`).
- **RIR-сдвиг не работает для RIR3-записей**: `min(3, 3+shift)` (`:155`) — 7 записей без реакции.
- **Нет валидации `preferredIds`**: битый id → строка с `name = raw id` (`:122–125`).
- **Гейтов нет**: уровень, оборудование, мобильность, junk, осевая, bodyweight — ничего не проверяется
  (в билдере эти гейты есть; после revalidate конструктора `fitBBSessionToBudget`/TAG-гигиена/лимит
  сессии могут выкинуть вставленное — «вставилось» ≠ «дожило»).
- `week.totalSets += addSets` (`:209`) без пересчёта session/`weeklyVolume`/валидации — метрики stale.
- Fallback `BB_WEAK_CORRECTION` (`:11–31`): **2 несуществующих id** — `lying_tricep_extension` (`:25`),
  `hanging_leg_raise` (`:30`); `forearms` ведёт на бицепс (`hammer_curl`, `curl_bar` — `:28`).

### 1.4. Покрытие зон (библиотека)
| Зона | Записей | Комментарий |
|---|---|---|
| traps / forearms / abs | **0 / 0 / 0** | зоны `GRANULAR_OPTS`/`WEAK_GROUPS` без библиотеки (каталожный fallback работает) |
| biceps | **1** | один сценарий — «всегда одно и то же» |
| adductor | 1 | и каталожный ранжир для неё пуст (нет группы/маппинга) |
| delt_mid / delt_front / chest_upper / chest_lower / calves / triceps / back_thickness | 2 | минимум, но без вариативности |
| quads 6 / glutes 5 / back_width 4 / hamstrings 4 / delt_rear 3 / core 3 | ок | |
Однозаписные сигналы: `bench-watch`, `ktw-asym`, `pm-yellow`.

### 1.5. Ранжир: две системы дублируются и расходятся
- Каталожный пул почти всюду содержит те же id, что библиотека (дубль систем).
- Библиотечный `rankCorrectives` **не знает `inPlanIds`** → топ уже стоит в плане → `skippedDup`,
  зона остаётся без коррекции, хотя fallback-ранжир вставил бы другое.
- Оборудование: `equipOk` библиотеки не считает `machine` всегда доступной, каталожный
  `equipmentAllows` — считает (`bb-correction-rank.engine.ts:63`).

### 1.6. Мёртвое/заглушки/дрейф
`equipmentAlt` и `regression` не читаются; `correctiveById`/`correctiveExportLines`/`BB_CORRECTIVE_COUNT`/
`top3CorrectionsForWeak` — только тесты; `benchWatch` никем не ставится (`:229`); пустые if-блоки
equipment/mobility в `bb-exercise-correction.engine.ts:66–71` (комментарии обещают фильтры, их нет);
`slice(0,6)` в `rankCorrectives` при использовании топ-1..3; уровни `beginner/advanced` в библиотеке
не заняты (39 `any` + 4 `intermediate`).

### 1.7. Чего НЕ ловят тесты (11 дыр — цели K1–K7)
title↔упражнение; существование `equipmentAlt`; покрытие зон ≥1–2; реальность fallback-id;
инъектабельность всех 40 id через gate-путь; паритет дозы (rest/repsMax/вес/RIR3); «топ уже в плане →
альтернатива»; валидация preferredId; выживание вставки на заполненной сессии (текущие тесты — на
планах из 1 сессии/1 упражнения); пустой rank для `adductor`; note↔доза в `correctiveDose`
(genetics «4–5×», «−25 %»).

---

## §2. Синтез (верифицированные источники прошлых раундов)

> Web-поиск в сессии недоступен (403 провайдера) — новые ссылки не выдумывались; ниже только то,
> что уже было проверено и зафиксировано в движках/доках этого репо.

- **Та же мышца — замена внутри пула, не смена группы**: строгие группы замен, длина/пик/углы
  (раунды «ББ-упражнения: строгие группы + углы/сечка»; `ANGLE_CLASSES`/`STRICT_EXERCISE_GROUPS`).
- **Растянутая позиция как приоритет коррекции** (Maeo 2021, Wolf/Schleip 2025, Kassiano 2024 —
  уже в `bb-corrective` источниках записей `*-length`).
- **SFR/системная усталость** (Israetel/RP; Outlift 2024 — уже в `bb-correction-rank` скоринге).
- **Коррекция ≠ лечение**: скрин-движение не прогноз травмы (Dorrel 2015; Moran 2017 BJSM — уже в
  `SCREENING_DISCLAIMER`/JOINTS-плане) → дозы «техника/стабильность» — рабочие правила, не терапия.
- **NHE/Копенгаген** — экстраполяции с честными дисклеймерами (Franke 2025/van Dyk 2019; Quintana-Cepedal
  2025 — уже в `bb-posterior-readiness`/Copenhagen-записи).
- **Паритет «показано = вставится = выгружено»** (Э3/Э5 PRO-5) — распространить и на дозу коррекций
  (вес/отдых/повторы), а не только на текст.

---

## §3. Эпики K1–K7

### K1. Реальность и семантика библиотеки (P0)
- Правки 1–5 из §1.2 (подмена упражнений на реальные id: `bb_triceps_long`, `tricep_pushdown_rope`/
  `tricep_pushdown_bar`, `cable_external_rotation`, `deadlift_trapbar`; `sh-neutral-press` — подобрать
  реальный жим либо честное переименование) + средние 6–10 (кью/атрибуции/`core-hinge-rdl` targets,
  `adductor`-маппинг, `g-clam-complex` protocol/название).
- **Lock-тест «title не врёт»**: для каждой записи — смысловые требования (например,
  `*-length` записи обязаны иметь `stretchPhase`-профиль каталога; face-pull-записи не претендуют на
  ротацию; трап-запись содержит `trap`; трицепс-длина ≠ кикбэк) — минимум чек-лист по ключевым словам
  id/названия + ручные исключения с комментариями.

### K2. Покрытие зон (P0)
- +2 `traps` (`shrug_db`, `shrug_bar` — реальные id), +2 `forearms` (`wrist_curl_db`,
  `reverse_curl_cable`), +2 `abs` (`cable_crunch`/`leg_raise`/`hanging_knee_raise`/`plank_side`),
  +1 `biceps` (молотковые/штанга), второй `adductor`-сценарий (подобрать реальный id).
- Lock: **каждая зона `GRANULAR_OPTS` + `WEAK_GROUPS` имеет ≥2 записи** (исключения — только с
  комментарием и тестом-allowlist); `Biceps≥2`, `traps/forearms/abs≥2`.

### K3. Инъекция: реальность дозы (P0)
- Хаб передаёт `workMax` в `injectBBWeakPoints`: источник — `he_profile_v2.training.workMax`/
  `workMaxByExercise` (профиль уже хранит максимумы по мышцам), fallback — без веса + честная нота.
- `BBInjectionOpts.corrective += { restSec?, repsMax?, bodyweight?: boolean, loadFactor?: number }`:
  rest из записи (45–150), reps-окно, для `bodyweight/band`-упражнений — без кг (пометка в комментарии),
  вес = `loadFactor ?? 0.65` × workMax соответствующей мышцы (для «длины/техники» ниже, для «силы» выше).
- RIR-сдвиг: база записи 0–4, `rirShift` аддитивно с клампом 0–4 (RIR3-записи реагируют).
- После вставки — пересчёт `week.totalSets`/session-метрик (или явная пометка «revalidate в ББ-авто»),
  строка в rationale с фактической дозой (вес/отдых/повторы).
- Lock: карточка `correctiveDose` == фактической вставке (вес/отдых/reps/RIR) — паритет полей.

### K4. Гейты инъекции (P1)
- Перед вставкой кандидат проверяется теми же канонами билдера: `isLevelAllowed`/`isPoolAllowed`
  (уровень каталога ≠ only-olympic эвристика), `isMobilityRestricted`, оборудование по каталогу
  (единая политика с `equipmentAllows`), `isBBJunk`-исключения (для коррекций — только осознанный
  allowlist дриллов), осевая при `avoidAxialLoad`, bodyweight-упражнения — не считаются «штангой».
- При отказе — **следующий кандидат** (library top2/top3 → каталожный fallback), заметка «заменено:
  причина» (видно в тосте/экспорте).

### K5. Ранжир: единая цепочка и inPlan (P1)
- `rankCorrectives` получает `inPlanIds` (как каталожный) и штраф/исключение дублей — топ-1 не должен
  быть занят планом.
- Унифицировать политику оборудования библиотека↔каталог (один helper).
- Lock-тест: «зона, чей топ-1 стоит в плане, получает альтернативу, а не `skippedDup`».

### K6. Гигиена и мёртвый код (P1)
- Заменить 2 битых id `BB_WEAK_CORRECTION` и forearms-фолбэк (`:25/:28/:30`) реальными.
- `equipmentAlt`: решение — **оживить** (строка «чем заменить» в карточке + использование при отказе
  оборудования в инъекции) ЛИБО удалить; `benchWatch` — ставить из хаба (`benchV.level==='watch'`)
  либо удалить; `regression` — вывести в карточку (как в TA) либо убрать; `slice(0,6)` → использовать
  или срезать; дока «~50» → 43; пустые if-блоки в `bb-exercise-correction.engine.ts:66–71` — реальные
  фильтры или честные комментарии без обещаний.

### K7. UI/экспорт PRO (P2)
- Карточка коррекции: «≈N кг · отдых Nс · N–N повт» (из K3), «чем заменить» (K6), бейдж фазы/уровня,
  строка покрытия «зона: N вариантов».
- Экспорт HTML/CSV и мост несут те же поля (расширить `correctiveDetail.protocol` без ломки формата —
  добавить `weightHint/restSec/reps` опционально, старые потребители не трогаются).
- Тесты UI на вес/отдых/«чем заменить» и паритет карточка=экспорт.

---

## §4. Тесты и критерии приёмки (~35)
- K1: title↔упражнение (5 критичных + 4 средних) — 10; K2: покрытие зон (3 табличных теста); K3:
  workMax/вес/отдых/repsMax/RIR3/паритет — 7; K4: гейты ×5 (уровень/оборудование/мобильность/осевая/
  bodyweight) — 5; K5: inPlan-альтернатива + единое оборудование — 2; K6: битые id/мёртвое/доки — 4;
  K7: UI-вес/отдых/замена + экспорт-паритет — 4; плюс `bb-corrective` соседи и UI-круг хаба зелёные.
- Критерии: движки чистые; инъекция не меняет сборку при пустом выборе; все id реальны (lock);
  экспорт без новых данных — байт-в-байт (новые поля только при заполнении); `tsc` 0; apk-verify OK;
  source-локи PRO-5 (`bb-corrective-ui`, `bb-hub-export`, `bb-hub-dedup`) не сломаны без осознанного
  re-baseline с комментариями.

## §5. Границы (осознанно не делаем)
- Авто-правка собранного плана по скринингам (решение §9.2 PRO — только явные кнопки).
- Медицинские протоколы/реабилитация (коррекция — тренировочный слой; стоп-флаги → врач).
- Синтетические упражнения без каталога (только реальные id).
- Полный merge библиотеки и каталожного ранжира в один движок (риск сломать calibrated-локи;
  делаем паритет политик, не слияние).

## §6. Готовый стартовый промпт новой сессии
```
Выполни docs/BB-CORRECTIVE-HUB-PRO-PLAN.md по эпикам K1–K7 (один эпик = один коммит pathspec
своих файлов, без пуша; перед коммитом git status/diff --stat — только свои файлы). Только
Edit/Write + vitest/tsc; чужие WIP (nutrition/arm/strength-sport и др.) не трогать.
Обязательно: все exerciseId — реальные в EXERCISE_CATALOG (lock-тест); title не врёт
(смысловые локи по §1.2); доза карточки = дозе вставки (вес от workMax профиля, rest/repsMax
из записи, RIR3-сдвиг работает); битые fallback-id заменены; покрытие зон ≥2 (allowlist с
комментариями); экспорт без новых данных байт-в-байт; source-локи PRO-5 при правке — осознанный
re-baseline с «было→стало». Тесты по эпику + соседи (bb-corrective, bb-diagnostics-injection,
bb-correction-rank, bb-corrective-ui, bb-hub-export, bb-hub-dedup, pro/pro2/pro3/max-pro) + tsc 0
+ verify:apk-design. Веб-поиск при недоступности не выдумывать — синтез в §2 уже верифицирован.
```

## §7. Факт выполнения (Sep 19 2026)

Все K1–K7 выполнены, техника и приёмка §4 соблюдены:

| Эпик | Коммит | Содержание | Тесты эпика |
|---|---|---|---|
| K1 | `617f994b` | семантика 10 пунктов §1.2 (id/title/targets/кью), lock title↔упражнение | `bb-corrective-semantics` 11 |
| K2 | `41a3508a` | +8 записей (traps×2/forearms×2/abs×2/biceps/adductor), lock покрытия зон | `bb-corrective-coverage` 4 |
| K3 | `e3bc0fce` | workMax/вес/rest/repsMax/bodyweight/RIR0–4, `correctiveWeightHint`, rationale-доза | `bb-corrective-dose` 9 |
| K4 | `b410f593` | кандидаты+гейты (уровень/оборудование/мобильность/осевая/junk-allowlist), note замены | `bb-corrective-gates` 7 |
| K5 | `c74d4f19` | `inPlanIds` (альтернатива вместо skippedDup), единый `equipmentAllows` strict-machine | `bb-corrective-rank-inplan` 5 |
| K6 | `28b34fef` | битые id, equipmentAlt/regression в карточке и инъекции, benchWatch-дубль, реальные фильтры | `bb-corrective-hygiene` 7 |
| K7 | `77babb5e` | карточка ≈кг/отдых/бейджи/покрытие, HTML «Доза»+CSV `corr_*`, мост опционально | `bb-corrective-export-dose` 4 + UI 2 |

Инвентарь после: `BB_CORRECTIVES` = 52 записи (43 + ch-decline-lower + 8 K2), все id — реальные
(Lock-тесты), fallback-пул — все id реальные. Найденный при K2 дефект каталога: `hanging_knee_raise` —
keep-first дубль по имени с `knee_raise` (удаляется из `EXERCISE_CATALOG`) — учтено в fallback.
Осознанно не сломано: PRO-5-локи (`bb-corrective-ui` ≥3/≥1 счётчики, `bb-hub-export`, `bb-hub-dedup`)
и calibrated-лок `equipmentAllows('machine', [])` (default-политика сохранена; строгая — параметром).
