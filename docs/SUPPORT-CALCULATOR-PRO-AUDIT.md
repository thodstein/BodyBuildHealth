# Калькулятор поддержки — аудит и план доработок (редакция 2)

**Дата:** 28 сентября 2026
**Область:** `src/engines/support-plan/`, `src/engines/tz-mapper-engine.ts`, `src/engines/tz-bridge-boosters.ts`, `src/engines/ped-risk-matrix.ts`, `src/engines/female-support-layer.ts`, `src/ui/screens/Calculator/`, `src/data/support-*`, `src/data/substance-*`

> ## ⚠️ Урок этой редакции (важно)
> Первая редакция этого документа утверждала «каталог заполнен на 16%, дозировки на 22%, 84% веществ без данных».
> **Это было ложное срабатывание**: аудит читал только один статический файл `support-catalog-data.ts` и не учёл
> многослойную сборку каталога (шарды + рантайм-автогенератор + отдельные слои форм/противопоказаний/мониторинга).
> Все цифры ниже — **измерены пробой в рантайме** (vitest-скрипт импортировал реальные модули и вызвал
> `registerCatalogExtras`), а не прочитаны из файла.
> Это тот же класс ошибки, что зафиксирован в AGENTS.md: «план C5 врал в 6 пунктах из 10», «мёртвый/write-only
> проверяется сканером, а не чтением». **Правило подтверждено: дефицит данных проверяется замером, не чтением.**

---

## §1. Как каталог и дозы реально собираются (многослойно)

Каталог поддержки — это **не один файл**, а сумма слоёв:

| Слой | Файл | Когда применяется |
|------|------|-------------------|
| Базовые «богатые» записи | `support-catalog-data.ts` | статически |
| Доп. записи шарда | `support-catalog-supplement.ts` | аппенд на init (`import` в `support-substances.ts:8`, `support-database.ts:6`) |
| Автогенератор для ВСЕХ мех-веществ | `support-catalog-extras.ts` → `registerCatalogExtras(cat)` | **импорт-сайд-эффект в прод-UI**: `Calc.mapper.tsx:23`, `CalcSubstanceManager.tsx`, `CalcSubstanceDetail.tsx` |
| Отдельные слои | `substance-forms.ts`, `substance-contraindications.ts`, `substance-monitoring-db.ts`, `support-enrichment.ts`, `support-coverage-map.ts`, `support-category-data.ts` | подключаются потребителями точечно |
| Дозы | `DEFAULT_DOSAGES` (`support-meta.ts`) и `SUPPORT_DOSING` (`support-dosing.ts`) | `buildSubstances` берёт `DEFAULT_DOSAGES[id]` → каталожная доза → фолбэк |

Доза при построении плана: `substances.ts:118`
`doseMg = def?.mg ?? e?.dosage?.mg ?? (FOUNDATION_ITEMS[cid] ? 0 : 500)`.

---

## §2. Измеренные рантайм-цифры (проба, 28.09.2026)

| Метрика | Значение |
|---------|----------|
| Каталог — статически | **396** |
| Каталог — после `registerCatalogExtras` | **507** (автогенератор добавляет **111**) |
| `SUPPLEMENTS_DB` (мех-вещества) | **371** |
| `PHARMACY_DB` | **72** |
| `SUPPORT_DOSING` | **85** |
| `DEFAULT_DOSAGES` | **73** |
| Вещества (без 6 основ-поведения), т.е. «таблеточные» | **365** |
| Тонкие каталог-записи (нет синергий + нет побочек + пустая форма) | **24** |
| **Без дозы после разрешения алиасов** (`canonId` + каталожная доза) | **20** |
| ID-дрейф, при котором доза есть **только под каноническим id** | **14** |
| Сиротные дозы (есть в dosing, нет в `SUPPLEMENTS_DB`) | **15** |

**Вывод:** покрытие — не «16%», а подавляющее; но есть точечные реальные дефекты (§3), а не катастрофа данных.

---

## §3. Подтверждённые дефекты

### P0-1. Недетерминированная инициализация каталога 🟠
`registerCatalogExtras` **мутирует общий объект каталога на импорте** (`support-catalog-extras.ts:384-405`),
вызывается только из компонентов Калькулятора (`Calc.mapper.tsx:23` и др.) и **не вызывается из хаба «6 в 1»**.
Следствие: содержимое каталога в хабе зависит от того, монтировался ли ранее компонент Калькулятора в этой сессии.
Зафиксировано ранее: `docs/CALCULATOR-HUBS-PROFESSIONAL-AUDIT-PLAN.md:220` (C6).
В медицинском инструменте недетерминированные данные недопустимы.
**Фикс:** единый `initSupportCatalog()` (идемпотентный), вызываемый один раз на входе приложения (например, в
`support-index.ts`/barrel), а не как сайд-эффект импорта UI-компонента.

### P0-2. Поиск дозы не канонизирует id 🟠
`substances.ts:111` вычисляет `cid = canonId(id)`, но `substances.ts:116` берёт дозу по **сырому** `DEFAULT_DOSAGES[id]`.
14 id-дрейфов имеют дозу только под каноническим id и при выдаче под «сырым» id не получают её:
`udca→tudca`, `legalon→milk_thistle`, `zinc_carnosine→zinc`, `carnitine→l_carnitine`,
`acetyl_l_carnitine→l_carnitine`, `magnesium_l_threonate→magnesium`, `l_theanine→theanine`,
`pharma_anastrozole→anastrozole`, `pharma_cabergoline→cabergoline`, `pharma_letrozole→letrozole`,
`pharma_tadalafil→tadalafil`, `telmi→telmisartan`, `metformin_dup→metformin`, `collagen_uc2→collagen`.
Следствие: вещество может показаться с фабричной дозой `500 мг` (или «по инструкции») там, где реальная доза известна.
**Фикс:** в `buildSubstances` брать `DEFAULT_DOSAGES[cid] ?? DEFAULT_DOSAGES[id]`; то же проверить в остальных точках
резолва дозы (`getProtocolDose`, `engine-helpers`).

### P1-3. Тонкие авто-записи каталога (24)
У 24 мех-веществ авто-запись неглубокая: `synergies: []`, `sideEffects: []`, форма без дозы.
Примеры: `vitex`, `p5p`, `tadalafil`, `metformin_dup`, `progesterone`, `pygeum`, `eleuthero`, `propolis`, `parsley`,
`nettle`, `buchu`, `goldenrod`, `horsetail`, `uva_ursi`, `bromocriptine`, `estradiol`, `glucagon`, `cortisol`, `adrenaline`.
**Фикс:** обогатить **только те**, что реально выдаются планом (список получить сканером выдач), не «весь хвост».

### P1-4. 20 веществ без дозы после алиасов
Список (часть — фарма, обрабатываемая отдельной ветвью, часть — травы):
`adrenaline, eleuthero, progesterone, pygeum, bromocriptine, estradiol, glucagon, levothyroxine_dup,
liothyronine_dup, cortisol, endocannabinoid, propolis, pharma, parsley, nettle, buchu, goldenrod, horsetail, uva_ursi, p5p`.
**Фикс:** разделить на (а) фарма — убедиться, что дозы идут из `PHARMACY_DB`/фарма-ветки; (б) травы — добавить дозы
или честно помечать «доза не установлена» вместо фабричных 500 мг.

### P1-5. Сиротные записи доз (15)
Есть в `SUPPORT_DOSING`, нет в `SUPPLEMENTS_DB`:
`amlodipine, atorvastatin, rosuvastatin, ezetimibe, red_yeast_rice, clomiphene, enclomiphene, glycyrrhizic_acid,
sam_e, ketosteril, sodium_bicarbonate, enoxaparin, iron_bisglycinate, metformin, b_complex`.
Часть — лекарственные-классы (намеренно), но `iron_bisglycinate` — реально используется женским слоем;
`red_yeast_rice`/`b_complex` дублируют канонические `red_yeast`/`vitamin_b_complex`.
**Фикс:** либо канонизировать дубли, либо убедиться, что потребители резолвят канон.

### P1-6. Тестовые пробелы безопасности 🟠
- `checkContraindications` (`substance-contraindications.ts:264`) — **0 прямых юнит-тестов**, только косвенно через `resolvePlan` с пустыми условиями.
- `resolvePlan` по фазам **PCT / bridge / fertility / TRT** — нет e2e-тестов (тестируется только `course`).
- Женский HCT-гейт железа — тестируется в слое, но **не через полный `resolvePlan`**.
- `buildMapperCtx`, `canonId` — без прямых юнит-тестов.
- Нет негативных/граничных тестов (`applyTitration` с неизвестным веществом, `normalizeDoseByWeight` с 0/NaN/экстремумом).

### P2-7. Гигиена
- Два `console.error` в точке входа (`support-plan/index.ts:56`, `engine.ts:788`) — сбой калькулятора не показывается пользователю дружелюбно.
- `any` в тестах (`support-calc-e2e.test.ts:15`, `support-hub-pro.test.ts:44-45`).
- Нет мутационного тестирования guard-тестов (в проекте это уже признанный обязательный приём).

---

## §4. Что оказалось ЛОЖНЫМ в первой редакции (убрано)

| Пункт ред.1 | Почему ложно |
|-------------|--------------|
| «Каталог заполнен на 16% (61/371)» | читался один файл; реально 396 → 507 в рантайме, плюс слои форм/противопоказаний |
| «Дозы на 22% (83/371)» | не учтены `DEFAULT_DOSAGES` (73), каталожные дозы, вес-дозинг `WEIGHT_BASED_DOSING` |
| «84% веществ без каталожной записи» | автогенератор создаёт запись для **всех** мех-веществ |
| «`iron_bisglycinate` отсутствует» | есть в `support-dosing.ts:539`, `substance-forms.ts:321`, `substance-contraindications.ts:114` |
| «Заполнить 50 каталожных записей + 50 дозировок» | задача не нужна в таком объёме |
| «Добавить 6 синергий (ZMA и др.)» | часть уже есть в `support-meta.ts`; нужен список **реально отсутствующих** |

---

## §5. Пересобранный план

### Фаза A (P0) — детерминизм и корректность данных

| № | Задача | Файл(ы) | Критерий |
|---|--------|---------|----------|
| A1 | Единый идемпотентный `initSupportCatalog()`; убрать сайд-эффект импорта UI | `support-catalog-extras.ts`, `support-index.ts`, `Calc.mapper.tsx` | Повторный вызов не меняет каталог; хаб и калькулятор видят одинаковый размер независимо от порядка монтирования |
| A2 | Канонизация id при поиске дозы (`DEFAULT_DOSAGES[cid] ?? DEFAULT_DOSAGES[id]`) | `substances.ts:116`, проверить `getProtocolDose`/`engine-helpers` | Lock-тест: все 14 id-дрейфов получают реальную дозу, не 500 |
| A3 | Источник-гард: резолв дозы **обязан** идти через `canonId` | тест | Мутация «вернуть сырой id» роняет тест |

### Фаза B (P0) — тесты безопасности

| № | Задача | Критерий |
|---|--------|----------|
| B1 | Юнит-тесты `checkContraindications` (все противопоказания × классы веществ + пустой вход) | ≥12 тестов, включая абсолютные/относительные |
| B2 | E2E `resolvePlan` для фаз **PCT / bridge / fertility / TRT** | 4+ тестов, проверка обязательных/запрещённых категорий фазы |
| B3 | E2E женского HCT-гейта через `resolvePlan` (ферритин<30 & HCT<48 → железо есть; HCT≥48 → вырезано) | 2+ тестов end-to-end |
| B4 | Негативные/граничные: `applyTitration`(неизвестное), `normalizeDoseByWeight`(0/NaN/300 кг), `checkInteractions`(пусто/1/неизвестное) | ≥8 тестов |

### Фаза C (P1) — качество выдачи

| № | Задача | Критерий |
|---|--------|----------|
| C1 | Сканер выдач: на 20 профилях собрать множество реально выдаваемых веществ; из них найти тонкие авто-записи | Список тонких **среди выдаваемых** (ожидается ≪24) |
| C2 | Обогатить только этот список (синергии/побочки/формы) | Каждое выдаваемое вещество имеет непустые формы+дозу |
| C3 | Разделить 20 «без дозы»: фарма → фарма-ветка, травы → доза или честная пометка | 0 веществ с фабричной 500 мг без обоснования |
| C4 | Сиротные дозы: канонизировать `red_yeast_rice`/`b_complex`, подтвердить `iron_bisglycinate` в женском слое e2e | Нет дублей-id; женское железо доезжает до плана и дозы |

### Фаза D (P2) — гигиена и ценность

| № | Задача |
|---|--------|
| D1 | Дружелюбный экран ошибки вместо `console.error` в `calculateSupportTZ`/`runSupportUnified` |
| D2 | Убрать `any` в тестах, добавить source-guard'ы в e2e |
| D3 | Проверить, не реализованы ли уже «хотелки» ред.1 (PDF/A-B/история) — часть уже существует (ProtocolExport, снапшоты) |
| D4 | Сиротные/мёртвые символы — по сканеру потребителей, а не по чтению |

---

## §6. Что НЕ делаем

- Не заполняем «50+50» каталожных/доз-записей — задача выведена из ложной посылки.
- Не переписываем каталог целиком; правим точечно по измеренному списку выдач.
- Не трогаем чужой WIP и не откатываем чужие изменения (правила проекта).

---

## §7. Готовый промпт новой сессии (Фаза A+B)

```
Выполни Фазу A и Фазу B плана docs/SUPPORT-CALCULATOR-PRO-AUDIT.md:
A1: единый идемпотентный initSupportCatalog() — убрать mutate-on-import в support-catalog-extras.ts,
    вызывать один раз из barrel (support-index.ts), убрать сайд-эффект из Calc.mapper.tsx.
A2: substances.ts:116 — искать дозу по canonId(id) (DEFAULT_DOSAGES[cid] ?? DEFAULT_DOSAGES[id]),
    проверить getProtocolDose/engine-helpers на ту же ошибку.
B1: юнит-тесты checkContraindications (абсолютные/относительные/пустой вход).
B2: e2e resolvePlan для фаз PCT/bridge/fertility/TRT.
B3: e2e женский HCT-гейт через resolvePlan.
B4: негативные/граничные тесты applyTitration/normalizeDoseByWeight/checkInteractions.

Сначала — замер (проба в рантайме) до и после. Только Edit/Write + vitest/tsc; чужие WIP не трогать.
Любой guard-тест обязан падать на мутации (возврат старого поведения).
```

---

## §8. ОТЧЁТ О ВЫПОЛНЕНИИ (28.09.2026, выполнено полностью)

### Фаза A — детерминизм и корректность дозы ✅

- **A1**: NEW `src/data/support-catalog-init.ts` — единая точка инициализации с фиксированным порядком
  **base (396) → supplement (55) → автогенератор (111+)**. `registerCatalogExtras` стал идемпотентным
  (`_extrasRegistered`-флаг). Инициализация подключена к `support-database.ts` (хаб/биостек),
  barrel `support-index.ts` (до построения обратных индексов) и трём хаб-файлам с прямым импортом
  каталога (`SupportDiaryView`/`ComplaintsTab`/`SymptomSolverTab`). Mutate-on-import сайд-эффекты UI
  (`Calc.mapper.tsx`, `CalcSubstanceManager.tsx`, `CalcSubstanceDetail.tsx`) убраны.
  **Почему нельзя было просто вызвать из `support-catalog-data.ts`:** supplement скипает существующие
  ключи — автогенератор до шарда вытеснил бы 55 богатых записей тонкими (проверено чтением цикла).
- **A2**: канонизация id при поиске дозы в 4 точках: `substances.ts:116` (buildSubstances) и `:197`
  (buildSchedule) → `DEFAULT_DOSAGES[cid] || DEFAULT_DOSAGES[id]`; `types.ts defaultDosage()`;
  `support-dosing.ts getDosingRecord()` (+canonId-импорт; модуль чистый, циклов нет); автогенератор
  (`support-catalog-extras.ts:418`) тоже канонизирует.
- **A3**: поведенческий лок (14 id-дрейфов получают канон-дозу) — **мутация «вернуть сырой id» в
  `buildSubstances` роняет ровно 1 тест** (проверено запуском с мутацией, восстановлено).

### Фаза B — тесты безопасности ✅ (47 тестов, 3 новых файла)

- **B1** `support-contraindications.test.ts` — **18**: абсолютные по заболеваниям (tadalafil/spiro/
  metformin/testosterone/iron_bisglycinate/telmisartan/K2), относительные (nebivolol/curcumin/metformin-CKD3),
  регистр-независимость, неизвестные/пустые входы, структура всех правил справочника.
- **B2/B3** `support-phase-e2e.test.ts` — **10**: PCT (AI заблокирован блоклистом), bridge, TRT (UI-значение
  `'trt'`), fertility, легаси `'base'`, course-дефолт + женский HCT-гейт e2e (ферритин 20 + HCT 45 → железо
  в плане; HCT 50 → вырезано + предупреждение; без анализов → тихо; male-контроль → слоя нет).
- **B4** — в `support-calc-canon-init.test.ts`: NaN/0/отрицательный вес → референсная доза
  (добавлен граничный гард в `normalizeDoseByWeight` — NaN протекал в дозу), UL-кап D3 при 300 кг,
  applyTitration с неизвестным веществом, checkInteractions пусто/одиночный/неизвестный.
- **Мутация B2**: возврат `'base'-only` маппинга в mapper-ctx роняет 1 тест (проверено, восстановлено).

### ⚡ ГЛАВНАЯ НАХОДКА ВЫПОЛНЕНИЯ — фазовая проводка была сломана для 2 фаз из 5

`buildMapperCtx` знал только легаси `'base'` (TRT-псевдоним из hydrate), а UI-селектор фаз
(`AutoCalculator.tsx:322`) пишет `'trt'` и `'fertility'` → **оба значения проваливались в `'course'`**:
- пользователь TRT получал КУРСОВОЙ протокол (обязательный гепатопротектор в курсовой дозе,
  репродуктивная ветка, блоклист курса);
- пользователь фертильности получал курсовой протокол вместо фазового (hCG 1500-2500 МЕ, SERM,
  блоклист AI), хотя `PHASE_BLOCKLIST.fertility` и `PHASE_PROTOCOL.fertility` уже существовали.
**Фикс (4 точки):** `CoursePhase` += `'trt' | 'fertility'`; mapper-ctx маппит оба + `inFertilityProgram`
живой; два phaseMap-дубля (engine.ts:882 hydrateState, Calc.mapper.tsx:1420) — `fertility: 'fertility'`
(было `'base'` = TRT-протокол для фертильности).

### Фаза C — качество выдачи ✅

- **C1 сканер выдач (проба, 20 профилей): 86 уникальных веществ реально выдаётся**; из 24 тонких —
  **выдаются только p5p, tadalafil, niacin** (+vitex — ложноположительный: проба-1 не грузила шард,
  богатая запись витекса уже была). Из 20 без-дозных — **выдаётся только p5p**. Хвост
  (horsetail/nettle/…) планом не выдаётся — обогащение не нужно (тот же класс ложных дефицитов, что §4).
- **C2**: 3 полных записи в `support-catalog-supplement.ts` (p5p/tadalafil/niacin — синергии/конфликты/
  формы/мониторинг/честные оговорки: ниацин — «AIM-HIGH/HPS2-THRIVE — исходы не улучшил, evidence C»).
- **C3**: `p5p` доза добавлена в `DEFAULT_DOSAGES` (50 мг/сут, «>100 мг/сут — риск нейропатии»);
  остальные 19 без-дозных не выдаются (без влияния на пользователя).
- **C4**: канонические ключи `red_yeast` и `vitamin_b_complex` в `SUPPORT_DOSING` (легаси-ключи
  сохранены); iron_bisglycinate доезжает до плана и дозы — залочено B3-тестом.

### Фаза D — гигиена ✅

- **D1**: `PlanResult.error?` (types.ts) — заполняется в catch `runSupportUnified` и в
  SupportScreen-catch; тост «⚠ Ошибка расчёта поддержки…» в useEffect (раньше — только console.error).
- **D2**: `any` → `Partial<CalculatorState>` (e2e) и типизированные фикстуры (hub-pro).
- **D3 (проверка, без кода)**: PDF-экспорт уже есть (`printProtocol`/`buildExportDataFromRec`,
  Calc.mapper:38); история планов/снапшоты существуют. A/B-сравнение планов поддержки — НЕ реализовано
  (нужен отдельный заказ; не делалось в этом раунде).
- **D4 (скан сирот, без кода)**: 13 оставшихся сиротных dosing-ключей — фарма-классы
  (amlodipine/atorvastatin/rosuvastatin/ezetimibe/clomiphene/enclomiphene/glycyrrhizic_acid/sam_e/
  ketosteril/sodium_bicarbonate/enoxaparin/metformin) и `iron_bisglycinate` (женский слой, своя
  mech-запись) — намеренные, дозы резолвятся через canonId.

### Верификация

- **Новые тесты: 47 (3 файла)** + мутационные проверки A3/B2 (каждая роняет ровно свой тест).
- Круги: support-plan + support-круг **503/503 (13 файлов)**; Calculator UI + биостек **62/62 (14 файлов)**;
  SupportScreen_parts **193/193 (22 файла)**; риск-круг **57/57**; широкий повтор **524/524 (41 файл)**
  (единичный флейк E1.6 под параллельной нагрузкой — в изоляции и повторе зелёный).
- `tsc --noEmit` — **EXIT=0 по всему проекту** (пойманный по пути TS1117 — мой дубль vitex-записи — удалён;
  витекс уже был богатым, проба-1 была без шарда).
- Кодировка: без U+FFFD; BOM в 3 Calculator-файлах — предсуществующий (в HEAD), не тронут.
- Пробы (`_tmp_support_probe`, `_tmp_support_issuance_probe`) удалены до фиксации.
- Чужие WIP (5 nutrition-файлов в worktree) не тронуты. **НЕ ПУШИЛ.**
