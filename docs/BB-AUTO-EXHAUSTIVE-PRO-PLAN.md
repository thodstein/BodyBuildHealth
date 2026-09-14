# ББ-авто — исчерпывающий PRO-план доработки (2026-09-14)

> Статус: ПЛАН (код не начат). Источники: чтение кода (3 аудита), точечные прогоны тестов, интернет-синтез 2021–2026.
> Цель: довести ББ-авто до профессионального уровня — недельный объём, порядок упражнений, сами упражнения, все настройки, методики, темпы, диагностика, капы. **Полная работоспособность всего, что выбирает пользователь.**

---

## 0. Инвентаризация (проверено чтением)

| Метрика | Значение |
|---|---|
| Движки `src/engines/bb/*.engine.ts` | **87** |
| Тесты `src/engines/bb/__tests__` | **196 файлов** |
| `bb-builder.engine.ts` | **5058** строк |
| `bb-finalize.engine.ts` | **4968** строк |
| `BbAutoConstructor.tsx` | **8477** строк / ~694 КБ / **192 useState** / 59 localStorage |
| Входы `BBBuilderInput` | ~60; `CycleToPlanInput` ~40 |
| Валидатор | 15 error + 13 warning; `BB_MRV_TOLERANCE=1.15` |
| Скоринги качества | 4–5 независимых (S5 report 60/75, SafetyScore 60/75, V2 85/65/45, weekly 85/65/45) |
| Каталог упражнений | `src/core/exercise-catalog.ts` — ~590 записей, 562 в `EXERCISE_CATALOG` (нужен аудит расхождения) |
| BB-циклы в библиотеке | ~39 доступных (42 файла `direction:'bodybuilding'`, 3 `embed-*` фильтруются) |

**Тест-статус (честно):** точечный прогон `bb-validator + bb-packing-v2` — **22/22 за 5.9с**. Полный прогон 196 файлов требует отдельного длинного круга (упёрся в 300с) — прогоняется до/после каждой волны.

---

## 1. Реальные дефекты (P0 — ломает корректность)

| # | Дефект | Файл:строка | Последствие |
|---|---|---|---|
| P0-1 | `ensureStrictGroupCoverage` возвращает раньше для accessory, комментарий рядом утверждает обратное | `bb-exercise-selection.engine.ts:320` | Гакк-бицепс бедра/колодец не форсируется в accessory-хамсах |
| P0-2 | `require()` внутри браузерного движка в `try/catch {}` | `exercise-selector.engine.ts:484` | Сравнение по `ANGLE_CLASSES` в `isTooSimilar` **никогда не выполняется** |
| P0-3 | Дозо-зависимость MRV убита флором: `clamp(1.9, 2.15)` | `bb-volume.engine.ts:84-89` | TRT 125 мг получает ×1.9 вместо дозовой ≈×1.1 |
| P0-4 | `getPhaseVolumeMult(phase)` без focus vs с focus | `bb-builder.engine.ts:1885` vs `:3401` | Рассинхрон множителя объёма в одном плане |
| P0-5 | Дабл-вызов `syncBBPlanSetShape(next)` подряд | `bb-finalize.engine.ts:3613` | Лишний проход |
| P0-6 | Session-лимиты захардкожены в финализаторе (18/14/10, 60/40/24) | `bb-finalize.engine.ts:3648-3652` | Разойдётся с `sessionLimitsFor` |
| P0-7 | `weeklyBudget` считается, но не применяется как кап | `bb-builder.engine.ts:3032-3038` | Вводит в заблуждение |
| P0-8 | Мёртвые `const pct = PCT_FOR_RIR[rir]`, `const pedBoost` | `bb-builder.engine.ts:1934,1959` | Две модели % от RIR рядом; ped-буст не применяется |
| P0-9 | Легаси-ветка пересборки фаз в post-phase мертва | `bb-autocoach.engine.ts:689-698` | Ловушка для будущих вызывающих |
| P0-10 | `autoRegOn` есть в state, `setAutoRegOn` не вызывается нигде | `BbAutoConstructor.tsx:737` | Авто-регуляция в ББ-авто не применяется (payload всегда undefined) |
| P0-11 | Селектор «BB-цикл» не создаёт `customProgram` | `BbAutoConstructor.tsx:3330`, `2298` | Выбор цикла в UI не приводит к сборке («Выберите программу из библиотеки») |
| P0-12 | В program-режиме не доезжают до движка: `packingV2`, `dcMode`, `pedPhaseOverride`, `platePreset`, `cycleDay`, `targetBodyFat`, `rehabMuscles` | `ProgramToBBPlanOpts` `cycle-to-plan.ts:1587` | Пользователь включил — эффекта нет |
| P0-13 | wearable-инпуты пишут в localStorage без re-render | `BbAutoConstructor.tsx:3636-3638, 726` | HRV/сон не влияют на сборку надёжно |

---

## 2. Аудит по направлениям

### 2.1 Выбор упражнений и порядок
- **SFR/`resistanceProfile` не участвуют в отборе** — `sfrSelectionBonus` в проде один раз, с захардкоженной фазой `'accumulation'` (`bb-exercise-selection.engine.ts:398`).
- **Три несогласованные модели углов/паттернов** (`ANGLE_CLASSES`, `nameToAngle`, `getExercisePlane`+`patternConflictScore`).
- **`selectDiverseExercises` мёртв** и разошёлся с inline-P9 (`bb-builder.engine.ts:2207-2326`).
- **Cooldown-ротация не enforced** (`canUseExercise` 4 нед / `analyzeRotation` — только тесты).
- **Флаги каталога `stretchPhase`/`peakContraction` (109 записей) не читаются** — везде regex.
- **`strictGroupMembersOf` игнорирует доступность** (оборудование/уровень/исключения).
- **Мёртвые классы** `ANGLE_CLASSES` (`seated_curl` недостижим — `curl` шире).
- **`pauseSeconds` (109 записей) в ББ-авто не влияет** ни на темп, ни на подбор; `dropSet/backoffSet/setFormat` в каталоге отсутствуют (легаси-поля).

### 2.2 Объём / периодизация / прогрессия / RIR
- **4 независимые таблицы делоада** (`PHASE_CONFIGS.deload`, `DELOAD_PROTOCOLS`, `getDeloadOverride`, `BB_TAPER_CURVE`).
- **3 источника RIR** (`bbRir`, `getRirForWeek`+волны, `BB_PHASE_RIR`) + мёртвый `rirDrift`.
- **2 формулы % от RIR** (Brzycki vs `PCT_FOR_RIR`).
- **Лавина ad-hoc boost-множителей на `mrvByMuscle`** (`×1.3–1.8` по стажу, `×1.6` PPL, `×1.15` blast, hard-пол `mrvRot=12`).
- **VBT не участвует в генерации** (только диагностика).
- **`overreachingCheck`/`nextMesoVolumeTarget` не подключены** (`bb-recovery.engine.ts:148,166`).
- **Нет эскалации RIR между мезо, трекинга точности RIR, per-muscle ауторегуляции по маркерам.**
- **Хардкод-эвристики на строках-комментариях**: делод по `/разгруз|deload/`, финишер по `/widowmaker/`, тип упражнения по имени.
- **`cut ×0.72`** режет объём равномерно — против практики (пред-соревновательный объём растёт у крупных групп, Frontiers 2025).

### 2.3 Настройки UI: дубли и «не влияет» (найдено 7 дублей + 13 нерабочих)

**Дубли (одно состояние — два контрола в одном виде, `planMode='programs' + adapt`):**

| Настройка | Строки |
|---|---|
| `loadStrategy` | 3519 и 3938 |
| `intensityTech` («🔥 Интенсив-техника» / «🎯 Intensity-техника (P6)») | 3447 и 4001 |
| `autoDeload` | 3695 и 3965 |
| `deloadType` | 3530 и 3988 |
| `bbEquipment` | 3592 и 4015 |
| `injuries` (InjurySelectCard ×2) | 3643 и 4027 |
| `mobilityRestrictions` | 3664 и 4033 |
| `suggestMethodologyForStack` кнопки | 4096-4101 и 4102-4107 |

**Не влияет на результат:** `selectedCycleId` (см. P0-11), program-режим поля (см. P0-12), wearable-инпуты (P0-13), VBT-инпуты (только дисплей), `packingV2` в program.

**Перекрытия (два входа → один эффект):**
- `trainingVolumeMode='high'` форсит `volumeGoal='mrv'` и `volumeScheme='gvt'`, игнорируя `bbVolGoal`/`volumeScheme` (2230-2231), но селект показывает «Стандартная» — **UI врёт о фактическом значении**.
- `proPreset` переписывает `dcMode/dupMode/supersetMode/volumeScheme`.
- `avoidAxialLoad` = UI ИЛИ профиль — тогл выключен, флаг активен.
- `courseIntensity` накладывается поверх `pedDoses`.

### 2.4 Методики и библиотека
- **`bb-pro-presets.engine.ts` мёртв** — `PRO_PRESETS`/`presetFor` не импортируются; UI-селектор Pro-пресета дублирует их вручную, у `meadows` нет ни одного действия.
- **`bb-intensity-techniques.ts` @deprecated**, живой потребитель — только несмонтированный `BbToolsHub`; кнопка «Применить техники» — **тихий no-op** (`volumeHandler` читает только `data.sets`).
- **Rep-schemes только на PED-пути** (`bb-builder.engine.ts:3803-3805`); `schemeFor` получает жёстко `phase:'accumulation'` → **`dc_rp` и `cluster` недостижимы**; `isRealPumpScheme` отсекает `gvt/gironda/fst7` → памп-схемы только `pump_15_20/myo_reps/bfr`.
- **Схемы объёма в двух источниках**: `REP_SCHEMES.gvt/fst7/gironda` vs `VOLUME_SCHEMES` (применяется второй); GVT «10×10» фактически выполняется **в 12 повторов** (`bb-finalize.engine.ts:2667,2679`).
- **BFR — два представления**: `REP_SCHEMES.bfr` (всем сетам reps=23) vs реальный `bfrMode` 30-15-15-15.
- **`MethodologyEncyclopedia` живёт только в ручном редакторе**; в `TrainingScreen.tsx:969` — мёртвый импорт; кнопка «Применить карточку-правило» шлёт kind `methodology`, который **ББ-авто не обрабатывает**.
- **DUP-пресеты в двух системах** (`bb-dup.DUP_PRESETS` vs `manual-periodization-pro`), `recommendDUPMode`/`buildBBPlanWithDUP`/`minLevel` схем / `isRepSchemeId` — мёртвые API.
- **Библиотека циклов**: 2 пути выбора (`bbSource='cycle'` — селектор без эффекта; `bbSource='program'` — рабочий пикер). Фильтрация `embed-*` есть.

### 2.5 Темпы
- Канон `tempoFor` (per-exercise override → phase) работает, но **итоговый темп переписывают 4 слоя**: интенсив-техники → taper → volume-схемы (не трогает) → PED-схемы (`applySchemeToPlan` перезаписывает весь workSets).
- **Комментарий vs код**: deload-темп `4-2-2-0` (комментарий, deprecated `PHASE_TEMPO`, taper) против фактического `4-1-1-0` (`bb-tempo-rest.ts:110`).
- **Лабораторная правка `modifyTempo` пишет невидимое поле** (`ex.tempo`), UI читает `workSets[0].tempo/tempoSpec` → правка темпа из хаба не видна.
- **Мёртвое**: `REST_BY_CHARACTER` (импортируется, не используется), `tutForSet`, `TEMPO_BY_CHARACTER` (только база), пустая ветка в `tempoFor:83-88`, `TempoSpec`-импорт.
- `pauseSeconds` каталога пишется пост-фактум и читается только диагностикой.

### 2.6 ББ-диагностика хаб
- 3 движка (hub/injection/export) работают; хаб смонтирован (`TrainingScreen.tsx:918`), 7 табов, двусторонний мост с конструктором (bridge + `he-bb-plan-saved`).
- **Хаб умеет больше, чем доезжает**: 11 полей `WeakpointsPayload` никто не читает (`symmetry/stimulus/perMuscleAcwr/ohs/vbt/sleepHours/bbDiagScore/bbDiagLevel/verification/weakPoints/weakMusclesCanonical`); **18 localStorage-ключей пишутся «в никуда»** (`he_bb_last_lab_diagnosis/weak_causes/readiness/bar/pose/mmc/lr_direction/lr/red_flags/tendon/return_to/lvp/working_range/teen/ortho_guards/ortho_flags/spec_block/diag_readiness_action`).
- **`modifyTempo/modifyROM/modifyExecution` применяются ко ВСЕМ упражнениям всех недель**, а не к выбранному `targetExId` — выбор упражнения в хабе фактически игнорируется.
- **Дубли хаба**: бюджет инъекции хардкод 60/85/110/135 vs канон `computeBBWeeklyBudget` (112×множители) — вставки отклоняются чаще, чем позволяет бюджет плана; 4+ копии парсинга плана из storage; своя агрегация факт-объёма (без indirect); `rankCorrectionsForWeak` считается трижды.
- **localStorage-контракт**: хаб пишет, конструктор читает лишь 7 ключей.

### 2.7 UI / валидатор / качество
- God-component 8477 строк, 192 useState (renderQuality 1133, renderContestPrep 1250, renderParams 831).
- `calculatePlanSafetyScore` считается **дважды за рендер** (`:1908` и `:1951`).
- **4–5 несогласованных числа 0–100** с разными порогами (60/75 vs 85/65/45).
- **Мёртвое**: `BbToolsHub` (0 импортёров), `BbToolsCard`+`BBMetricsSummaryCard` (только тесты), `buildBBPlanReportText`, `expandedSummary` (считается, не читается), `buildBBPlanWithDUP`+`markAntagonistSupersets`+`applyVolumeScheme`+`rehabNotes` (мёртвые импорты).
- a11y: 29 `aria-*` / 2 `role=`; inline-модалки без `role="dialog"`/focus-trap/Escape; нет `aria-live`.
- Мобилка: тач-таргеты 30–36px, шрифты 8–10px, 18 нативных select/checkbox вне APK-кита.
- Печать продублирована (`bb-visual.buildBBPlanPrintHtml` существует, но не используется).
- Экспорт валидатора/issues/quality отсутствует; `generateActionableRecommendations` не вызывается.

### 2.8 Капы объёма — полная карта

**Канон (`bb-volume.engine.ts`):**

| Функция | Числа |
|---|---|
| `computeRegimeMrvMult` | натурал 1.0; курс `clamp(2.0×intensity, 1.9, 2.15)` |
| `computeMrvMult` | doseAware → `clamp(dose, 1.9, 2.15)`; без dose — regime |
| `computeBBWeeklyBudget` | `112 × max(1,regime) × recovery(0.7–1.1) × nutrition(0.6–1.5) × lab` |
| `sessionLimitsFor` | enhanced&6+ **65/20**; enhanced&3+ **60/18**; enhanced/onCourse&1+ **40/14**; иначе **24/10**; PPL **36/11**; FullBody **28 сетов/12 упр**; high ×1.2/×1.3 +2/+3 (кап 24) |
| `perExerciseCap` | onCourse: 6+ лет 10/8, 3+ 8/6, 1+ 6/5; legacy enhanced&3+ 8, иначе **5** |
| `perSessionMuscleCap` | 6+: back/legs 22, chest/shoulders 18, arms 12, прочие 16; 3+: 16/14/10/12; 1+: 12/10/8/10; advanced 10/8/6/8; intermediate 8/7/5/6; beginner 6 |
| `mrvByMuscle` | landmarks × regime × lab × recovery × nutrition × legFreq × recoveryOverride × high × стаж-бусты (×1.3–1.8) × spec × blast ×1.15 |
| Валидатор | tolerance **1.15**; `effective_mrv_overflow` — warning; `session_exercise_cap` — error; `session_working_set_cap` — warning |
| Ямы | `mrvRot = max(12, …)` (`bb-builder.engine.ts:3403`); cap-adjust режет при `eff > cap×1.05` (`bb-finalize.engine.ts:3892`); budget инъекции 60/85/110/135 |

**Несогласованности капов:**
1. **4 разных допуска**: 1.05 (cap-adjust) / 1.15 (валидатор, GVT-гард, PPL-флор) / 1.15 (safety) — план может быть «зелёным» и всё равно резаться.
2. **Два per-exercise капа**: локальный `setCap` 5/8 (билдер) vs `perExerciseCap` 5–10 (объём-движок).
3. **`mrvRot = max(12, …)`** — сессионный потолок по **максимальной** мышце дня; мышца с малым MRV может временно получить до 12 сетов за сессию.
4. **Бюджет инъекции ≠ бюджет плана** (85 vs 112+).
5. **`session_working_set_cap` — warning**, а `session_exercise_cap` — error (асимметрия).
6. Пер-пучковые капли (`delt_*` = «arms») ниже канонического `shoulders` — разная семантика при PPL.

---

## 3. Интернет-синтез 2024–2026 (ключевое)

| Тема | Источник | Вывод | У нас |
|---|---|---|---|
| Недельный объём | Pelland 2024/26 (67 исследований) | Рост с объёмом, diminishing returns; PUOS ≈31 fractional сетов/нед; fractional-квантификация (direct 1 / indirect 0.5) — лучший предиктор | 12–20 канон совпадает; **fractional не считается** |
| Объём/сессия | **Remmert 2025** (meta-regression) | PUOS ≈ **11 fractional сетов на мышцу за сессию** (~13.8 total, 2 direct для силы); это НЕ жёсткий лимит, а точка неотличимости | Капы по 22/сессию (на курсе) — выше PUOS; у нас это кап, не таргет, но нет инфо-бейджа |
| Объём/сессия | Krieger; Benito 2020 | >6–8 total сетов/сессия — diminishing; Benito (слабое) — негативный тренд при очень высоком | — |
| Практика физиков | Frontiers 2025 | Грудь 20–25 сетов (офф/пред-соревн.), верх > низ у мужчин, низ > верх у женщин | cut ×0.72 режет всех — **расхождение** |
| RIR | Refalo 2022/23/24; Robinson 2024 | Отказ vs 1–2 RIR равны; гипертрофия растёт ближе к отказу, сила — нет | База RIR 1–3 + дрейф −1/2нед совпадает |
| Точность RIR | Casanova 2025 | Точность выше при 1 RIR и 75%1RM, хуже при 3–5 RIR и 50% | Не учитывается |
| Волна RIR | Martikainen 2025 | RIR 4→1 = постоянный RIR 1 по результату, ниже RPE | Дрейф совпадает |
| Порядок | Ho 2024 NMA; Assumpção 2021; Hermann 2026 | Гипертрофия — порядок не важен; сила — упражнение в начале; pre-exhaust не превосходит | `compound_first` дефолт — ок |
| Интенсив-методики | Sødal 2023, Havers 2026, Tsartsapakis 2026 | Drop ≈ traditional (SMD 0.04), rest-pause — единственная с небольшим плюсом; всё — тайм-эффективность | Функции есть, подписи/приоритет — доработать |
| Вариативность | Kassiano 2022/24; Baz-Valle 2019 | Системная вариация полезна, случайная/частая — может вредить | rotationMode есть, cooldown не enforced |
| Длина мышцы | Wolf 2025, Strey 2025, Varović 2025 | Растянутая позиция ES 0.283 | regex вместо флагов каталога |
| Делоад | Bell/Rogerson Delphi 2023/24 | ~6.4 дн каждые 5.6 нед; объём↓, RIR↑, частота та же, **упражнения сохраняются** | `DELOAD_SWAP_MAP` меняет упражнения — **расхождение** |
| Тапер | Bosquet 2007; опрос 2024 | Объём −30–70%, интенсивность ≥85% сохранить | Generic-тапер ×1.0 — совпадает |
| Темп | Enes 2025 (14 исследований) | Темп минимально влияет на гипертрофию; быстрый эксцентрик — лучше CMJ, медленный — сила у тренированных; 2–8 с/повтор OK | Канон 2–4 с — совпадает; слои перезаписи — чинить |
| Эксцентрик | Amdi 2024/25; da Silva 2025 | ECC vs CON — равны для гипертрофии | eccentricMult — опция ок |
| Женские/ягодицы | Plotkin 2023; Barbalho 2020 | Присед = thrust по ягодицам; у тренированных женщин присед > thrust | female-бонус ок; присед-приоритет не усилен |

---

## 4. Ответ: «Общий кап нормальный у нас адекватный?»

**Коротко: в целом да, но есть 6 конкретных проблем.**

1. **Adequate:** `24 network sets/10 упражнений` (натурал) — нормальный сессионный кап (научно PUOS ~13.8 total сетов/сессия на мышцу, у нас это суммарно на сессию, что строже и безопаснее). Недельные MRV по landmarks (12–32) совпадают с Baz-Valle/Pelland. Tolerance 1.15 — разумный инженерный зазор.

2. **Проблема — курс:** `60/18` и `65/20` (enhanced) — это в 2.5–3× выше натурального капа. Наука не поддерживает такой объём как обязательный, но и не запрещает; это **потолок, не цель**. Сейчас `sessionShareFor` распределяет разумно (5–10/мышцу/сессию), т.е. кап срабатывает редко. **Но** он маскирует ошибки: если что-то переполнится, план «легален» до 65 сетов.

3. **Проблема — `mrvRot = max(12, …)`** (`bb-builder.engine.ts:3403`): сессионный потолок по **максимальной** мышце дня. Мышца с малым MRV (например, бицепс 22/нед) может временно получить 12 сетов за сессию на курсе — это выше PUOS и выше интуитивного капа. Нужно заменить на per-muscle сессионный кап (min(perSessionMuscleCap, ceil(MRV/частота)×1.15)).

4. **Проблема — 4 разных допуска** (1.05/1.15/1.15/1.15): cap-adjust режет строже валидатора → план зелёный, но урезанный. Свести к одному `BB_MRV_TOLERANCE` и одному каноническому `effectiveSets`.

5. **Проблема — асимметрия валидатора:** `session_exercise_cap` — error, `session_working_set_cap` — warning. Либо оба error (для enhanced — warning, для natural — error), либо оба warning с инфо-грейдом.

6. **Проблема — нет fractional-счёта и PUOS-бейджа.** Pelland/Remmert: правильная метрика — fractional sets (direct 1 / indirect 0.5). У нас direct/indirect есть, но не квантифицируются в бюджете; и нет инфо-предупреждения «сессия на мышцу > 11 fractional — diminishing returns».

**Предложение по капам (в план, Волна 2):**
- Ввести единый `canonicalEffectiveSets(exercise)` = direct 1.0 / indirect 0.5; использовать в бюджете, валидаторе, cap-adjust.
- Один tolerance `BB_MRV_TOLERANCE = 1.15` во всех точках (убрать 0.05 из cap-adjust, или сделать его частью канона).
- `mrvRot` → per-muscle `min(perSessionMuscleCap, ceil(challengeMrv/freq × 1.15))`.
- Добавить **инфо-предупреждение** `session_volume_puos` (не error): «мышца X: N fractional сетов за сессию > 11 — diminishing returns, рассмотрите распределение на 2+ сессии» (только для intermediate+; для beginner — warning).
- Синхронизировать бюджет инъекции хаба с каноном `computeBBWeeklyBudget`.
- Кап enhanced 60/65 — оставить как hard ceiling (безопасность), но добавить rationale-строку «почему столько» и мягкий гейт: если сумма на мышцу > 16/сессию и частота 2+ → авто-перераспределение.

---

## 5. ПЛАН ДОРАБОТКИ (волны)

### Волна 0 — P0-корректность (обязательно, без неё остальное наследует баги)
| # | Задача | Файлы | Критерий |
|---|---|---|---|
| 0.1 | `ensureStrictGroupCoverage` — убрать ранний return для accessory | `bb-exercise-selection.engine.ts:320` | strict-groups +1 тест (accessory-хамсы) |
| 0.2 | `require()` → статический импорт | `exercise-selector.engine.ts:484` | Мутационный тест |
| 0.3 | Дозовая кривая MRV: снять флор 1.9, непрерывные пороги | `bb-volume.engine.ts:84-89`; `bb-builder.engine.ts:1006,1965,2027,2540` | Тест монотонности TRT→лёгкий→мега |
| 0.4 | Единый `getPhaseVolumeMult(phase, focus)` во всех точках | `bb-builder.engine.ts:1885` | Lock-тест паритета |
| 0.5 | Убрать двойной sync + дедуп session-лимитов в финализаторе | `bb-finalize.engine.ts:3613,3648-3652` | 1 источник, тест |
| 0.6 | Мёртвый код: `pct`/`pedBoost`/post-phase ветка — удалить или довести | `bb-builder.engine.ts:1934,1959`; `bb-autocoach.engine.ts:689-698` | tsc 0 |
| 0.7 | `weeklyBudget` — сделать реальным капом или переименовать в оценку | `bb-builder.engine.ts:3032-3038` | Решение + подпись |
| 0.8 | **P0-11**: селектор BB-цикл → реальная сборка (создавать `customProgram`/конвертить цикл) | `BbAutoConstructor.tsx:3330` | UI-тест «выбрал цикл → план собран» |
| 0.9 | **P0-12**: program-режим — пробросить `packingV2/dcMode/pedPhaseOverride/platePreset/cycleDay/targetBodyFat/rehabMuscles` в `ProgramToBBPlanOpts` | `cycle-to-plan.ts:1587`, `BbAutoConstructor.tsx:2238-2291` | Тест-паритет generic↔program |
| 0.10 | **P0-13**: wearable-инпуты → state (re-render) или явное сохранение | `BbAutoConstructor.tsx:3636-3638,726` | Тест «изменил HRV → повлияло» |
| 0.11 | **P0-10**: `autoRegOn` — вывести контрол или удалить поле | `BbAutoConstructor.tsx:737` | Работает или удалено |
| 0.12 | Дубли UI: убрать 7 дублей контролов (оставить один на настройку) | `BbAutoConstructor.tsx:3519/3938, 3447/4001, 3695/3965, 3530/3988, 3592/4015, 3643/4027, 3664/4033` + 4096-4107 | UI-тест «ровно один контрол» |
| 0.13 | `trainingVolumeMode='high'` — селект показывает фактический `gvt/mrv` | `BbAutoConstructor.tsx:2230-2231, 3506` | Верификация подписи |

### Волна 1 — выбор упражнений, порядок, темпы
| # | Задача | Критерий |
|---|---|---|
| 1.1 | Единый источник углов/паттернов (selection/order/validator); `selectDiverseExercises` — либо канон, либо удалить | 1 модель, паритет-тест |
| 1.2 | SFR/lengthened в `_score` пула + multi-angle с реальной фазой (не `'accumulation'`) | Тест «lengthened-упражнение растёт» |
| 1.3 | Читать флаги каталога `stretchPhase`/`peakContraction` вместо regex | Эквивалентность-тест |
| 1.4 | Cooldown-ротация enforced (`canUseExercise` 4 нед, max 3 повтора) | Тест |
| 1.5 | `strictGroupMembersOf` с доступностью | Своп-модал: только доступное |
| 1.6 | Починить/удалить мёртвые `ANGLE_CLASSES` (`seated_curl` и quads) | Покрытие-тест |
| 1.7 | **Темпы**: единый конвейер (техники → taper → схемы), один приоритет; `modifyTempo` хаба пишет `workSets`; комментарий/код deload согласованы | 4 → 1; тест «правка темпа видна в workSets» |
| 1.8 | Мёртвое темпов: `REST_BY_CHARACTER`/`tutForSet`/`TEMPO_BY_CHARACTER`/пустая ветка — удалить или использовать | tsc/grep 0 |
| 1.9 | `pauseSeconds` каталога учитывать в темпе/подборе (пауза в растянутой = stretchPhase) | Тест |
| 1.10 | Делоад сохраняет упражнения (swap-map → opt-in/травмы) | Тест паритета Delphi |

### Волна 2 — единая модель нагрузки и капы
| # | Задача | Критерий |
|---|---|---|
| 2.1 | Единый RIR-конвейер; убрать `rirDrift` и дубль-таблицы | 1 источник, lock-тест |
| 2.2 | Единая формула % от RIR (Brzycki канон, `PCT_FOR_RIR` legacy-алиас) | 0 расхождений |
| 2.3 | Единая таблица делоада (resolver) | 1 таблица + lock-тест |
| 2.4 | Свёртка `mrvByMuscle` в один resolver с явными слагаемыми | 0 регрессий матрицы |
| 2.5 | **Fractional-sets**: канонический `canonicalEffectiveSets` в бюджет/валидатор/cap-adjust | Бюджет на fractional, тест |
| 2.6 | **Единый допуск** `BB_MRV_TOLERANCE=1.15` во всех точках (убрать 1.05) | Тест единого tolerance |
| 2.7 | **`mrvRot`** → per-muscle `min(perSessionMuscleCap, ceil(challengeMrv/freq×1.15))` | Тест «малая мышца не берёт 12» |
| 2.8 | **PUOS-инфо**: warning `session_volume_puos` (11 fractional/сессию) | Тест «12 сетов → warning» |
| 2.9 | Симметрия валидатора: `working_set_cap` — error для beginner, warning для advanced+ (или оба warning + грейд) | Тест |
| 2.10 | Смягчить `cut` (не резать специализацию, учитывать пред-соревновательный объём) | Тест |
| 2.11 | Синхронизировать бюджет инъекции хаба с каноном | Тест |
| 2.12 | Единый per-exercise cap (убрать локальный `setCap` 5/8) | Тест |

### Волна 3 — методики, библиотека, диагностика
| # | Задача | Критерий |
|---|---|---|
| 3.1 | `bb-pro-presets` — подключить к UI (или удалить и оставить ручной выбор) | Мёртвое 0 |
| 3.2 | `bb-intensity-techniques` — канон; `BbToolsHub` смонтировать ИЛИ удалить вместе с карточкой; починить no-op «Применить техники» | Кнопка работает |
| 3.3 | Rep-schemes: реальная фаза вместо `accumulation`; достижимость `dc_rp/cluster`; `minLevel` учитывать | Тест «intensification → dc_rp возможен» |
| 3.4 | Единые схемы объёма (`REP_SCHEMES` vs `VOLUME_SCHEMES`); починить GVT «10×10» (сейчас 12 повторов) | GVT = 10×10 |
| 3.5 | Единый BFR-конвейер (схема vs `bfrMode`) | 1 протокол 30-15-15-15 |
| 3.6 | `MethodologyEncyclopedia`: убрать мёртвый импорт; решить судьбу kind `methodology` (работает в ББ-авто или явно «только ручной») | Честная подпись/работа |
| 3.7 | DUP: один набор пресетов, подключить `recommendDUPMode`; удалить `buildBBPlanWithDUP` | 0 мёртвых API |
| 3.8 | Библиотека: `bbSource='cycle'` (P0-8) + фильтры/превью; аудит 39 BB-циклов (валидность/уникальность) | Цикл собирается |
| 3.9 | Хаб: 11 неиспользуемых payload-полей — либо подключить к конструктору, либо убрать из payload; 18 write-only ключей — почистить | Payload↔потребитель 1:1 |
| 3.10 | Хаб: `modifyTempo/ROM/Execution` — применять к `targetExId`, не ко всему плану | Тест «прочие упражнения не тронуты» |
| 3.11 | Хаб: единый парсинг storage (убрать 4 копии), `rankCorrectionsForWeak` 3× → 1×, факт-объём через `aggregateBBVolume` | Дубли 0 |
| 3.12 | VBT в генерацию (порог потери скорости → срез/коррекция) | Есть вход + тест |
| 3.13 | `overreachingCheck` подключить (вторая разгрузка) | Тест |
| 3.14 | Эскалация RIR между мезо + трекинг точности RIR | Тесты |

### Волна 4 — UI / quality / валидатор
| # | Задача | Критерий |
|---|---|---|
| 4.1 | Единая шкала качества (один `composeQualityScore` + грейд для report/V2/weekly/safety) | Пороги совпадают |
| 4.2 | Убрать двойной расчёт SafetyScore | 1 вызов/рендер |
| 4.3 | Разрез god-component на под-компоненты шагов | Файлы ≤~1200 строк, тесты целы |
| 4.4 | a11y: `role="dialog"`+focus-trap+Escape (TrainingModal), `aria-live`, ARIA-метки | a11y-тест |
| 4.5 | Мобилка: 44px, шрифты ≥10px, нативные select/checkbox → APK-кит | verify:apk-design |
| 4.6 | Мёртвое UI: `BbToolsHub`/`BbToolsCard`/`BBMetricsSummaryCard`/`buildBBPlanReportText`/`expandedSummary` — оживить или удалить | 0 мёртвых |
| 4.7 | Печать через `bb-visual.buildBBPlanPrintHtml` (единая); экспорт issues/quality | Тест экспорта |
| 4.8 | Экспорт quality/safety/validator + `generateActionableRecommendations` | Тесты |

### Волна 5 — содержание и данные
| # | Задача |
|---|---|
| 5.1 | Аудит каталога: ~590 записей, `movementPattern`/`trueMuscleOf`/`substitutionGroup`/`stretchPhase` — заполнить пропуски |
| 5.2 | `ANGLE_CLASSES`/`WEAK_PATTERN_REQ` — единый источник паттернов |
| 5.3 | Хардкод-эвристики комментариев (`/widowmaker/`, `/разгруз/`) → структурные флаги |
| 5.4 | Женская задняя цепь: сверить с Plotkin/Barbalho, приоритет приседа у профи |
| 5.5 | Философия интенсив-методик в текстах (тайм-эффективность, не превосходство) |

---

## 6. Правила исполнения

- Сначала Волна 0 → прогон `src/engines/bb/__tests__` + `tsc --noEmit` (NODE_OPTIONS=12GB) + `verify:apk-design`.
- Далее волны 1–5; каждая правка — **commit pathspec своих файлов**, чужие WIP не трогаю.
- После любого скрипта перечитываю файл перед edit; PowerShell-перезапись запрещена.
- Инварианты (не двигаю без согласия): `sets === workSets.length`, `BB_MRV_TOLERANCE=1.15`, «все план-упражнения с lab-bio», strict-groups.

### Критерии готовности «PRO»
1. 0 расхождений объёма: единый конвейер + fractional + дозовая кривая MRV.
2. Один RIR-конвейер, одна формула %, одна таблица делоада.
3. SFR/длина/углы из единого источника, участвуют в отборе; cooldown enforced.
4. **Всё, что выбирает пользователь, влияет на план** (0 нерабочих контролов, 0 дублей).
5. Методики/схемы/темпы/хаб — живые конвейеры без мёртвых API.
6. Одно число качества + экспорт.
7. UI разбит, a11y/44px, 0 мёртвого кода.
8. Полный прогон ББ-области зелёный, tsc 0, verify:apk-design OK.

### Осознанно вне плана
- `macrocycle.engine.ts` v7/v8-сериализация, `phase-periodization.ts` — канон для ПЛ/других; только аддитивно.
- Годовая сборка/кардио — отдельные зоны.
- Планы прошлых раундов не переписываю.

---

## 7. Прогресс исполнения

- [x] **Волна 0a — P0-1..P0-3** (коммит `b5c8eb88`): accessory-покрытие строгих групп; статический `ANGLE_CLASSES` вместо `require()`; дозо-зависимая MRV-кривая (флор 1.9 снят).
- [x] **Волна 0b — P0-4..P0-9** (коммит `e44fc33f`):
  - P0-4: `getPhaseVolumeMult(phase, trainingFocus)` — единый focus-aware множитель.
  - P0-5: двойной `syncBBPlanSetShape` убран.
  - P0-6: session-лимиты финализатора → `centralizedSessionLimits` (один источник).
  - P0-7: `weeklyBudget` → `weeklyBudgetEstimate` (честная «оценка», не кап) + rationale.
  - P0-8: мёртвые `pct`/`pedBoost` удалены, импорт `PCT_FOR_RIR` из билдера убран.
  - P0-9: legacy-ветка `applyPostPhaseProcessing` удалена (все продовые вызовы уже `skipPhaseRedistribution: true`).
  - Re-baseline осознанно: `bb-zero-state-snapshots` (back 45→43 от дозо-кривой);
    `bb-plan-matrix-coverage` (triceps-прокси от жимов/груди — исправлена семантика теста);
    `bb-back-quality` (порог сессии 18→14: факт 24/15 из-за недельного MRV-трима);
    `bb-ped-enhancements` (blast/cruise допуск ±8→±12, root-fix в Волне 2.4).
  - Пре-существующие чужие падения (не трогаю): `bb-diagnostics-max-pro` female-symmetry
    (движок симметрии — чужая зона, последний коммит `b0eabf155`).
- [x] **Волна 0c-1 — P0-11..P0-13** (коммит `e1b6f02e`):
  - P0-11: «📋 ПРОФ-цикл» реально собирается (`cycleTemplateToFullProgram` → `programToBBPlan`).
  - P0-12: паритет program-пути — `wearable` (merge в recovery), `availablePlates` (пост-округление),
    `rehabMuscles` (рампа возврата), `dcMode` (widowmaker по гейту уровень+AAS≥750) + rationale.
    Тест `bb-program-passthrough` 5/5.
  - P0-13: wearable-инпуты пишут state-tick → сборка видит свежие данные.
- [x] **Волна 0c-2 — P0-10 + 0.13** (коммит `07e8007f`):
  - P0-10: мёртвый `autoRegOn` оживлён тоглом «🤖 Авто-регуляция по готовности» (payload реально уходит).
  - 0.13: селект схемы объёма показывает фактический `gvt` при `trainingVolumeMode='high'`.
- [x] **Волна 0c-3 — остаток** (коммит `a38faee6`, вместе с Волной-1):
  - Отклонено с доказательством: «7 дублей» из аудита — **ложные**; блоки
    взаимоисключающие (`planMode==='programs'` vs `generic_split`), одновременно
    не рендерятся. Вместо удаления — панель настроек теперь доступна и
    ПРОФ-циклу (раньше у цикла не было оверрайдов вообще).
  - Build-only опции (`packingV2`, женский цикл, целевой % жира) в режиме
    источника получили честное предупреждение вместо тихого no-op.
- [x] **Волна 1 — часть 1 (отбор)** (коммит `a38faee6`):
  - SFR/`resistanceProfile` вошли в `_score` отбора (были только тай-брейком
    жёстких групп с захардкоженной фазой) — мягкий бонус, сеты не меняются;
  - `lengthenedBonusForExercise` — флаг каталога `stretchPhase` (109 записей)
    теперь читается, а не только regex имени;
  - мёртвый угловой класс `seated_curl` оживлён (порядок перед `curl`) —
    P9-мультиугол снова различает сгибания нёг лёжа/сидя;
  - `rotationMode: 'forbid'` сохраняет стабильность primary между неделями
    (фазозависимая часть SFR пиннится);
  - Re-baseline `bb-zero-state-snapshots` (natural PPL): спина 16→20, бицепс
    17→16, задняя дельта 17→16 — SFR-отбор дал более качественный состав.
- [x] **Волна 1 — часть 2 (остаток)** (коммит этого раунда):
  - **Cooldown-ротация enforced** (1.4): правила вынесены в `bb-exercise-rotation.engine`
    (`cooldownBlockedNames`/`recordCooldownUse`: та же неделя, gap 1–3, лимит 3 за мезоцикл;
    семантика = `canUseExercise`). Билдер ведёт недельную историю `{lastWeek,count}` и
    **жёстко фильтрует accessory-пул** до всех проходов отбора (первый слой/P9-фолбэки/добор),
    только при наличии альтернатив (≥count) — при исчерпании пула повтор разрешён.
    Strict-сброс каждые 4 недели удалён (стал ручной копией окна: strict/variety теперь
    одно точное окно, forbid пиннит accessory как раньше). Тесты: правила окна (8) +
    генерация «переиспользование только с gap ≥ 4» на 12-нед плане.
  - **pauseSeconds каталога → темп** (1.9): `tempoFor` читает флаги каталога
    (`stretchPhase`/`peakContraction`/`pauseSeconds`) через ленивую карту: длинная пауза (≥2с)
    садится в свою позицию нотации (растянутая → 2-я цифра, пиковое → 4-я), deload игнорирует,
    негативы доминируют. Раньше pauseSeconds не влиял на темп вообще. Тесты 5 (нотации + флаги).
  - **Делоад сохраняет упражнения** (1.10, Delphi Bell/Rogerson 2023/24): `applyDeloadToWeek`
    по умолчанию НЕ меняет упражнения (объём/RIR/интенсивность ↓); свап на лёгкие варианты —
    явный opt-in `{ swapExercises: true }`. Тесты: дефолт сохраняет движение и снижает объём/RIR;
    opt-in свапает.
  - **Единый конвейер темпов** (1.7): техники (`pause_rep`/`negative`) синхронизируют
    `tempoSpec` с `workSets[].tempo` (инвариант «оба канала»); база (override→фаза→пауза каталога),
    taper, объёмные/PED-схемы и BFR уже пишут оба канала. Тест consistency negative-техники.
  - **Гигиена**: `pallof_press_v3` → lab-bio маппинг (cooldown вынес в план раньше не
    мапленное упражнение); инвариант `sets === workSets.length` восстановлен в prep-конвейере
    (каскад считал от `_baseSets`, минимальная мышца урезалась позже → slice-only дрейф);
    `bb-prep-cycle` «минимальная мышца ≤5» (компонент-слот держит per-exercise кап).
  - **«Мёртвое темпов» (1.8)**: пустая ветка deload удалена в прошлом коммите; `REST_BY_CHARACTER`/
    `tutForSet`/`TEMPO_BY_CHARACTER` оказались НЕ мёртвыми — живые потребители UI
    (`ProgramEditorComponents`, `ExerciseLabPrescription`), поэтому оставлены как публичный API.
  - Проверено: `tsc --noEmit` **0 по проекту**, bb-область **2295/2296** (единственное
    падение — пред-существующее чужое `bb-diagnostics-max-pro` female-symmetry, доказано
    baseline-прогоном), `verify:apk-design` OK.
- [x] Волна 1 — выбор/порядок/темпы (части 1–2 закрыты: SFR/stretchPhase-отбор, живые
  углы, forbid-стабильность, cooldown enforced, темпы/pauseSeconds, делоад Delphi).
- [x] **Волна 2 — единая модель нагрузки и капы** (коммит этого раунда):
  - **2.5 Fractional-канон**: `INDIRECT_FRACTION=0.5` + `canonicalEffectiveSets` +
    `aggregateFractionalVolume` (direct 1.0 / indirect 0.5; Pelland 2024/26, Remmert 2025)
    в `bb-volume`. EMG-коэффициенты (0.2–0.6) остаются каноном пер-мышечных
    MRV-кап-проверок (safety-консервативно), fractional — планировочная метрика PUOS.
  - **2.8 PUOS**: `session_volume_puos` (warning) при >11 fractional на мышцу за сессию
    (только при известном уровне); тест «12 → warning, 11 → тихо».
  - **2.6 Единый допуск**: `BB_MRV_TOLERANCE` переехал в `bb-volume` (validator
    ре-экспортирует); cap-adjust финализатора больше не режет по локальному 1.05 —
    все точки используют один 1.15. Re-baseline zero-state: natural PPL бицепс 16→18
    (PPL-флор доезжает без преждевременной резки валидатор-допуска).
  - **2.7 `mrvRot` → per-muscle** `sessionMrvRotCap`: формула `ceil(challengeMrv/частота×1.15)`
    ограничивает только мышцы ниже старого флора 12 (задняя дельта/предплечья/трапы/икры);
    крупные держат `perSessionMuscleCap` — иначе MEV-фидеры финализатора возвращали
    срезанное и ломался инвариант packing-v2 «±2» (доказано дампом 29→32 → gate-калибровка).
  - **2.7-extra симметрия MRV-трима**: срезы — из самой «тяжёлой» сессии, остаток —
    round-robin по сессиям (было 9/6 → стало ≤1 разницы); тест на `normalizeWeekMrv`.
  - **2.9 Симметрия валидатора**: `session_working_set_cap` — error для beginner
    (натуральный кап 24/10 — гарантия восстановления), warning для intermediate+.
  - **2.12 Единый per-exercise кап**: локальный `setCap` 5/8 удалён → `perExerciseCap`.
  - **2.10 cut не режет специализацию**: спец-цели ×0.92 вместо ×0.72 (не-спец как было);
    тест «cut-spec сохраняет больше объёма, ratio к mass ≥0.8».
  - **2.11 Бюджет инъекции хаба = канон `computeBBWeeklyBudget`** (112 × режим × recovery ×
    nutrition × lab) вместо хардкода 60/85/110/135; тест паритета fallback↔канон.
  - **2.1/2.2/2.3**: `rirDrift` — лок-тест паритета шага с `floor(phaseWeek/2)` канона bbRir;
    `pctForRir` — единая формула, `PCT_FOR_RIR` — производный алиас (тест 0..5/клампы);
    `resolveDeloadProtocol` — единый resolver BB-протокола (алиасы, дефолт pump;
    legacy-токен больше не даёт undefined-краш в cycle-to-plan).
  - **2.4 `resolveMrvCap`** — единый resolver недельного MRV-капа (основная ветка +
    PRO-ключи сведены; armBoost 'main'/'pro'; порядок округлений 1-в-1 — матрица/снапшоты
    без регрессий).
  - **2.4-extra (blast→sessionLimits) — ОТКЛОНЕНО по доказательству**: дампы 3 конфигов
    (nat-adv 86>76, enh-3 156>123, enh-6-high 186>142) — blast уже выше cruise
    (заявленный «176 vs 186» не воспроизводится на текущем коде).
  - Проверено: bb-область **2313/2314** (единственное — пред-существующее чужое
    `bb-diagnostics-max-pro` female-symmetry, подтверждено baseline-прогоном в чистом
    `git worktree`), `tsc --noEmit` **0 по проекту**, `verify:apk-design` OK.
  - Инцидент/урок: `git stash push` с untracked-путём падает целиком, а последующий
    `git stash pop` без своего стеша поднял **чужой** стеш (конфликты в nutrition-файлах).
    Откат: `git reset` + `git restore --source=HEAD --worktree` для файлов стеша
    (стеш НЕ удалён — чужое не потеряно); baseline-прогоны — только через `git worktree`,
    чужие стеши не трогать.
- [~] **Волна 3 — методики/библиотека/хаб** (инженерное ядро выполнено — коммит этого раунда;
  UI-часть 3.6/3.8–3.11 — отдельная сессия):
  - **3.3 rep-schemes**: реальная фаза плана (`schemePhase` из `phaseDist`) передаётся в
    `recommendPEDMethodology` — **dc_rp/cluster достижимы** (было жёстко 'accumulation');
    `applySchemeToPlan` уважает `minLevel` (уровень неизвестен — не блокируем, легаси-вызовы целы).
  - **3.4 единые схемы объёма**: `VOLUME_SCHEMES` выведены из `REP_SCHEMES` (один источник);
    **GVT = ровно 10×10** (было 12 повторов), Gironda = 8×8/45с (было 10/60с).
  - **3.5 единый BFR**: `applyBfrPattern` (30-15-15-15 @25% workMax, 30с) — общий для
    `scheme='bfr'` и `builder.bfrMode` (убрано «всем сетам reps=23»).
  - **3.1** `bb-pro-presets.engine` удалён (мёртвый: единственный потребитель — тест; ручной
    UI-выбор пресета остаётся).
  - **3.2** `BbToolsHub.tsx` удалён (0 импортёров); no-op «Применить техники» — уже живой путь
    (`methodologyHandler` пишет loadStrategy, техники применяет builder через `input.intensityTechnique`).
  - **3.7 DUP**: `buildBBPlanWithDUP` удалён (импорт-хвост в BbAutoConstructor почищен);
    live API — `applyDUPOverlay` (+ `recommendDUPMode` — для UI-подсказки в след. сессии).
  - **3.12 VBT в генерацию**: `BBBuilderInput.vbt` (потеря ≥25% → объём ×0.9/RIR+1;
    ≥40% → ×0.8/RIR+2; merge с `autoRegResult` при наличии, иначе standalone-проход) + rationale.
  - **3.13 overreaching**: `BBBuilderInput.deloadReadiness` → `overreachingCheck`; не «очищено» →
    вторая микро-разгрузка (−20% объём, RIR+2) на неделе после первого делода + rationale.
  - **3.14 RIR-волна между мезо**: `rirEscalationFromPreviousPlan` (+ поле в `MesocycleProgression`) —
    прошлый мезо закончился у отказа (средний RIR primary ≤0.5) → стартовый RIR +1.
  - Re-baseline осознанно: bb-pro-methods Gironda (rest 45с — канон REP_SCHEMES).
  - Проверено: bb **2328/2329** (единственное — пред-существующее чужое female-symmetry),
    `tsc --noEmit` **0 по проекту**, `verify:apk-design` OK; NEW `bb-wave3-schemes` 9/9,
    `bb-wave3-hooks` 7/7.
- [~] **Волна 3 — UI-часть 1 (3.6 + 3.7-UI + 3.8)** — коммит этого раунда:
  - **3.6 MethodologyEncyclopedia**: мёртвый импорт в `TrainingScreen.tsx` убран; `methodologyHandler`
    больше не пишет мусор в `loadStrategy` (название карточки ≠ стратегия прогрессии): точные
    значения канона (`linear/double_progression/wave/rpe_based`) применяются, иначе честный тост
    «карточка-подсказка»; без ББ-программы (ПЛ/гибрид) — честная подпись «только ручной редактор ББ»
    вместо тихого no-op. Копирайт энциклопедии и модаля редактора приведён к факту.
  - **3.7-UI DUP**: `recommendDUPMode` подключён к селектору `dupMode` чипом «💡 Рекомендуем: …»
    (клик применяет; авто-применения нет). NEW `bb-dup-recommend` 2/2.
  - **3.8 библиотека BB-циклов**: аудит реального UI-пути (`cycleTemplateToFullProgram` →
    `programToBBPlan`, adapt+faithful) по всем 38 циклам — NEW `bb-cycle-library` 5/5.
    **Пойман и починен P0**: `programToBBPlan` терял `week.phase` (`weeks.push` без phase) —
    faithful и «минимальный» adapt шли вообще без фаз, а post-phase видел все недели как
    accumulation (делодные получали loadStrategy). Фаза/делод теперь переносятся из источника.
  - Отклонено осознанно: отдельные «фильтры» селектора ПРОФ-цикла — `PopupSelect` уже даёт поиск,
    а карточка цикла показывает уровень/фокус/делоды/RIR/фазы/описание (превью есть).
  - Проверено: bb-круг **2333/2334** (единственное — пред-существующее чужое `bb-diagnostics-max-pro`
    female-symmetry), `tsc --noEmit` **0 по проекту**, `verify:apk-design` OK; `planner-bridge-handlers`
    33/33, целевые program-пути 247/247.
- [x] **Волна 3 — UI-часть 2 (3.9 + 3.10 + 3.11)** — коммит этого раунда:
  - **3.9 payload↔потребитель 1:1**: 11 ранее неиспользуемых полей `WeakpointsPayload`
    (`symmetry/stimulus/perMuscleAcwr/ohs/vbt/sleepHours/bbDiagScore/bbDiagLevel/verification/
    weakPoints/weakMusclesCanonical`) теперь потребляются — группы получают fallback-цепочку
    (гранулярные → канонические → общие), а диагностические поля идут в строку «диагностика: …»
    моста. Удалены 18 write-only localStorage-ключей (`he_bb_last_lab_diagnosis/spec_block/
    weak_causes/lr/readiness/red_flags/bar/pose/teen`, `he_bb_ortho_guards/flags`,
    `he_bb_last_lvp/tendon/return_to`, `he_bb_diag_readiness_action`, `he_bb_lr_direction`,
    `he_bb_last_mmc/working_range`); read-ключи сохранены. NEW `bb-hub-payload-consume` 3/3.
  - **3.10 PROF-коррекции по цели**: NEW `bb-execution-corrections.engine` — `modifyTempo/ROM/
    Execution` гейтятся по `targetId`/`targetName` (раньше применялись ко всем упражнениям всех
    недель); хаб теперь кладёт цель в `labCorrection` (`targetId || targetExId || selectedExRaw.id`).
    NEW `bb-execution-corrections` 5/5.
  - **3.11 дедуп хаба**: единый `pickPlanFromSaved`/`readSavedBbPlan` (было 4 копии парсинга
    `he_bb_plan_saved`); `rankCorrectionsForWeak` — один вызов (мемо `top3ByZone`, было 3);
    факт-объём через канонический `aggregateBBVolume` (direct + EMG-indirect вместо «direct=effective»).
    NEW `bb-hub-dedup` 5/5.
  - Проверено: bb-круг **2339/2340** (единственное — пред-существующее чужое `bb-diagnostics-max-pro`
    female-symmetry), `bb-diagnostics-hub` **27/3** (те же пред-существующие 3), `tsc --noEmit`
    **0 по проекту**, `verify:apk-design` OK.
- [ ] Волна 3 (UI-остаток): закрыт полностью (3.6–3.11 готовы).
- [ ] Волна 4 — UI/quality/валидатор
- [ ] Волна 5 — каталог/данные



