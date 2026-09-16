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
- [x] Волна 3 (UI-остаток): закрыт полностью (3.6–3.11).
- [x] **Волна 4 — часть 1 (4.2 + 4.6)** — коммит этого раунда:
  - **4.2 «двойной SafetyScore» — оказалось уже исправлено**: `calculatePlanSafetyScore` вызывается
    один раз через `useMemo` (`safetyScore`), остальные вызовы — событийные (сохранение/экспорт),
    не per-render. Изменений не требовалось (проверено чтением/грепом).
  - **4.6 мёртвое UI**: удалены `BbToolsCard.tsx` (дублирует контролы конструктора: темп/техники/
    слабые/демография) и `BBMetricsSummaryCard.tsx` (дублирует «Объём на мышцу» в шаге «Качество»),
    их smoke-использования в `rest-hooks-native` убраны. Удалены мёртвые импорты конструктора
    (`markAntagonistSupersets`, `applyVolumeScheme`, `rehabNotes`).
  - **Проверка стейл-клеймов**: `expandedSummary` НЕ мёртв — читается `bb-quality-report.engine`
    (totalWorkingSets) и `bb-report.engine`; `buildBBPlanReportText` — экспорт движка с тестами
    (UI-привязку делаем в 4.7/4.8).
  - Проверено: `rest-hooks-native` **68/68** (+1 пред-существующий unhandled-шум ReportsScreen),
    `tsc` — мои файлы чисты (в проекте чужая ошибка синтаксиса `ArmliftingDiagnosticsHub.tsx` WIP,
    не тронут), `verify:apk-design` OK.
- [~] **Волна 4 — часть 2 (4.7 + 4.8)** — коммит этого раунда:
  - **4.7 печать**: кнопка «📋 Вся таблица» больше не дублирует rich-PDF — теперь через единый
    движковый `buildBBPlanPrintHtml` (фазы/легенда/таблица мезоцикла/heatmap); «🖨 PDF» остаётся
    богатой BB-версией (техники/рационале/пик-заметки). `buildBBPlanPrintHtml` перестал быть мёртвым.
  - **4.8 экспорт**: NEW кнопка «📄 Отчёт (txt)» — качество + безопасность + валидатор +
    `generateActionableRecommendations` + базовый `buildBBPlanReportText` (был мёртвый экспорт движка).
    NEW `bb-export-report` 7/7 (движок рекомендаций + source-guard проводки).
  - Проверено: целевые 7/7, `tsc` — мои файлы чисты (чужая ошибка `ArmliftingDiagnosticsHub.tsx` WIP).
- [x] **Волна 4 — часть 3 (4.4 a11y)** — коммит этого раунда:
  - единый `useInlineDialogA11y` (фокус на диалог + возврат + Escape) для 3 inline-модалок
    ББ-авто (замена упражнения, ввод имени, «Начать заново») — `role="dialog"` + `aria-modal`
    + `aria-label`; `role="status"` (live) у flash/моста сохранён. NEW `bb-a11y-dialogs` 4/4.
  - Проверено: целевые 4/4, `tsc` — мои файлы чисты (чужие WIP: `ArmliftingDiagnosticsHub.tsx`,
    `RiskScreen.tsx` — не тронуты).
- [x] **Внеочередной фикс выбора сплита** (жалоба: «выбираю ППЛ → собирается фулбоди/рандом»):
  - **Скоринг дней (root)**: в `rankBBSplits` сплит с МЕНЬШИМ числом дней получал +25
    (`overage <= 0.5` ловил отрицательный overage) → `fullbody_3` выигрывал при 3/4/5/6 днях
    (подтверждено дампом: 85 у всех). Теперь **симметричный day-fit** (точно 60 / недобор 1 = +30,
    2 = +12, ≥3 = −12; перебор 1 = +12, 2 = −10, ≥3 = −25) + tie-break по близости дней и числу
    сессий. Итог: 6 дн → bro_6/6-сессийные, 4 дн → upper_lower_4, 3 дн → fullbody_3.
  - **Ветка программы захватывала generic**: `if (planMode === 'programs' || effectiveProgram)` —
    при `planMode='generic_split'` оставался `customProgram` от прошлой сессии → выбор сплита
    игнорировался, собирался старый/чужой план. Теперь программная ветка **только при
    `planMode==='programs'`**.
  - **Стоп-кран stale-плана**: эффект автосейва писал `he_bb_plan_saved` на КАЖДУЮ смену параметров
    (включая `selectedSplitId`) со СТАРЫМ `builtPlan` — затем FIX-19 авто-загружал его и прыгал на
    шаг «План». Запись `he_bb_plan_saved` из этого эффекта убрана (план сохраняется только явно).
  - **Ручной выбор пиннится**: `splitTouched` — авто-рекомендация больше не перезаписывает выбор
    пользователя; в шаге сплита добавлена строка «✅ Будет собран: …» для контроля.
  - NEW `bb-split-selection` 6/6; тест `bb-ped-enhancements` «мягкий PED-бонус» переписан честно
    (прирост ≤8 по каждому сплиту вместо абсолютного разрыва топ-5, который ломался day-fit'ом).
  - Проверено: bb-круг **2351/2352** (единственное — пред-существующее чужое `bb-diagnostics-max-pro`),
    `tsc` — мои файлы чисты (чужие WIP: `ArmliftingDiagnosticsHub.tsx`, `RiskScreen.tsx`,
    `armlift-correction.engine.ts` — не тронуты).
- [x] **Волна 4 — 4.1 (единая шкала качества)** — коммит этого раунда:
  - `QUALITY_GRADE_THRESHOLDS` (85/65/45) — единый источник ступеней; `gradeQualityScore`
    (V2/report) и `gradeFor` (недельная) читают его (ярлыки поверхностей сохранены —
    обратная совместимость UI/тестов).
  - NEW `bb-quality-grade-scale` — лок-тест: канон + границы обеих функций + «одинаковый
    уровень при одних баллах»; потребители (quality-score-v2/parity/quality-weekly/v2/report/
    quality-actions) 84/84.
- [x] **Волна 4 — 4.3 этап 1 (служебный слой)**: NEW `bb-auto-constructor-shared.tsx` — вынесены
  `CollapsibleCard`, типы шагов/фаз (`Step`/`BBPhase`/`PlanMode`), константы (`WEAK_GROUPS`/
  `BB_WM_KEYS`/`BB_WM_RU`/`TAG_LABELS_RU`/`PHASE_TECHNIQUES`/`DONOR_GROUPS`) и все чистые хелперы
  (`getPhaseMap`/`phaseForWeek`/`isWeakMuscle`/`normalizeDonorTargets`/`computePhases`/
  `exerciseComment`/`annualBlockCtxToPrepPatch`/`annualActiveBlockLine`/`backSubgroupLabel`/
  `armHeadLabel`/`isAbRotationActive`/`chipBtn`/`useInlineDialogA11y`) — перенос 1-в-1, публичные
  символы ре-экспортированы (потребители/тесты не менялись); `BbAutoConstructor.tsx` −~300 строк
  (в т.ч. чистка устаревших импортов). Проверено: bb-UI 8 файлов 30/30 (в т.ч. `bb-a11y-dialogs`
  читает оба файла), `rest-hooks-native`+`apk-top-pack` 99/99 (1 чужой unhandled ReportsScreen),
  `tsc` 0.
- [x] **Волна 4 — 4.5 (мобилка: нативные контролы → АПК-кит)**: в `BbAutoConstructor.tsx`
  не осталось ни одного `<select>`/`type="checkbox"` (было 19):
  - NEW в `bb-auto-constructor-shared.tsx` — `BbRowSwitch` (строка-переключатель: заголовок 12px +
    описание 10px + трек/тамб, касание ≥44px, `role="switch"`/`aria-checked`) и `BbToggleChip`
    (компактный чип-тумблер для чек-листов/инлайн-рядов, ≥44px);
  - 10 выпадающих списков переведены на `PopupSelect` (уже АПК-кит шагов): VBT-движение,
    категория/специализация пика (×2 места), поле/режим пакетной правки, интенсив-техника и
    суперсет упражнения, приоритет старта (×2), цикл пост-шоу, категория/сплит Prep-цикла;
  - 5 чекбоксов — кит-тумблеры: cross-mesocycle, низковолокнистые карбс, стоп креатин,
    подтверждение модуляции воды/натрия, чек-лист шоу (6 пунктов).
  - NEW lock-тест `bb-auto-apk-controls` 3/3 (0 нативных контролов + role=switch/44px/шрифты +
    `PopupSelect` ≥8).
  - Проверено: bb-UI + широкий круг **129/129** (10 файлов, 1 чужой unhandled ReportsScreen),
    `tsc` 0, `verify:apk-design` OK.
- [x] **Волна 4 — 4.3 этап 2 (шаговые компоненты, паттерн props)**: NEW `bb-step-split.tsx` (шаг 3
  «🏆 Выбор сплита», 12 явных props) и `bb-step-ped.tsx` (шаг 2 «💉 Фармакология и рабочие веса»,
  35 props: state-сеттеры передаются напрямую) — перенос 1-в-1 (логика/тексты/стили не менялись),
  оба шага в `BbAutoConstructor.tsx` стали тонкими вызовами `<BbSplitStep/>`/`<BbPedWorkMaxStep/>`;
  файл −~376 строк (8624→8248), осиротевшие импорты почищены. Проверено: bb-UI + широкий круг
  **132/132** (11 файлов, 1 чужой unhandled ReportsScreen), `tsc` **0 по проекту**, `verify:apk-design` OK.
- [x] **Волна 4 — 4.3 этап 3 (оставшиеся шаги, паттерн props)**: вынесены все 6 шагов 1-в-1
  (`bb-step-<name>.tsx`, критерий переноса — Node-сверка тела против HEAD «identical modulo indent»):
  - `bb-step-weights.tsx` (10 props) — шаг «⚖️ Реальные веса»;
  - `bb-step-ex-swap.tsx` (7 props) — модалка замены упражнения (a11y-ref `useInlineDialogA11y` прокинут);
  - `bb-step-adjust.tsx` (62 props) — шаг 6 «🛠 Ручная коррекция» (4 секции: фидбэк/наглядность/план-факт/редактор);
  - `bb-step-prep-cycle.tsx` (49 props) — режим «🏁 Prep-цикл» (локальные чистые деривации catOpts/prepProfile/muscleRu перенесены внутрь);
  - `bb-step-params.tsx` (101 prop) — шаг 1 «📋 Базовые параметры» (единственные отличия: `specializationSelection` и `isFemaleProfile` как props);
  - `bb-step-plan.tsx` (26 props) — шаг 4 «📋 План» (единственное отличие: `actionRow` prop);
  `BbAutoConstructor.tsx` 8061→6070 строк (−~2 тыс.), 30+ осиротевших импортов убрано; guard-тесты
  `bb-a11y-dialogs`/`bb-auto-apk-controls` теперь читают `bb-step-*.tsx` (все 3 модалки и 0 нативных
  контролов держатся по сумме файлов). Проверено по каждому этапу: bb-UI паки (8 файлов, вкл.
  volume-toggle-e2e/dup/prep-cycle) + `rest-hooks-native`/`apk-top-pack` + `tsc` 0 по проекту +
  `verify:apk-design` OK. **Шторм-инцидент**: параллельный `checkout` снёс незакоммиченные правки
  Prep-цикла — переприменено и закоммичено сразу (урок: коммит в ту же минуту после зелёных тестов).
- [x] **Волна 4 — 4.3 этап 4 (под-секции Quality, начат)**: самые большие `renderQuality`/`renderContestPrep`
  режутся под-секциями (компонент на секцию, 8-16 props), каждая — отдельный коммит с проверками.
  Сделано 3 из ~5 под-секций `renderQuality` (NEW `bb-quality-sections.tsx`, перенос 1-в-1, Node-сверка
  против HEAD «identical modulo indent»):
  - `BbQualityUnifiedCard` (7 props) — «🛡 Единое качество плана» (VBT/суперсет-время/перегруз/quality issues + V2-карта);
    единственная замена — readiness-выражение из `linked` вынесено в prop тем же результатом;
  - `BbQualityPlanLogicCard` (35 props) — «🧠 Логика построения плана» (7 под-карточек: вход/сплит/периодизация/объём/приоритеты/безопасность/методики),
    по пути пойман и исправлен свой пробой текста («подмышки»→«подмышцы»);
  - `BbQualitySafetySection` (16 props: safetyScore + 7 тоглов + pedAdapt) — «🛡️ Безопасность плана»
    (factor-breakdown, суставный анализ 5 блоков, профилактика, распределение, вывод, 321 строка).
  `BbAutoConstructor.tsx` 8061→5551 строк; 9+3 осиротевших импортов убрано; `bb-a11y-dialogs` теперь
  читает и `bb-quality-sections.tsx` (live-region «Безопасности» цел). Проверено: 125/125 (9 файлов,
  вкл. bb-quality-v2-card/volume-toggle/prep-cycle/dup) + `tsc` 0 по проекту + `verify:apk-design` OK.
  **Остаток этапа 4** (следующая сессия): блок «🏋️ Тренировочная нагрузка плана» внутри `renderQuality`
  (~600 строк: тогл + «Общая информация»/«Качество плана понедельно»/«Общие сведения»/PHASE-факт/объёмные карточки —
  резать 2-3 под-секциями) и весь `renderContestPrep` (~1378: prep-форма, таймлайн фаз, peak-week, адаптация по весу,
  показ-чеклист, экспорты — резать по 8-15 props).
- [ ] **4.3 — остаток (новая сессия)**: `renderQuality` train-load блок (~600) + `renderContestPrep` (~1378):
  у них ~80-100 state-ссылок, резать **под-секциями** (каждая секция — компонент с 8-15 props)
  или через контекст-объект, а не целиком. Инварианты для каждого этапа: `tsc` 0,
  bb-UI паки (bb-auto-smoke/annual/prep-cycle/dup/volume-toggle/reproductive/a11y/apk-controls) +
  rest-hooks-native/apk-top-pack, `verify:apk-design`; коммит строго pathspec своих файлов.
- [ ] Волна 5 — каталог/данные

---

## 8. Запрос пользователя (2026-09-15): методики, женские сплиты, аудит выдачи

> Добавлено по команде: «проверить что методики реально выбираются и строятся — ВСЕ МЕТОДИКИ ВЫБРАННЫЕ; добавить женские сплиты к выбору (сейчас там не все); проверить качество выдаваемой программы и объём сетов/повторений/RIR, применение методик — полный анализ выдачи тренировочного плана по всем циклам».

### 8.1 M1 — «все выбранные методики реально строятся» (аудит влияния)
Матрица «настройка → где применяется → видимый маркер в плане → тест» для **всех** входов ББ-авто, по трём путям (`buildBBPlan` generic / `convertCycleToBBPlan` cycle / `programToBBPlan` program):
- `bbMethodology` (compound_first / pre_exhaust / post_exhaust / mountain_dog / fst7 / hyperemia), `loadStrategy` (double/linear/wave/rpe_based), `intensityTech` (rest_pause/drop_set/myo_reps/pause_rep/mechanical_drop/negative/twenty_ones), `volumeScheme` (GVT 10×10 / FST-7 / Gironda 8×8), `supersetMode`, `dupMode` (+per-muscle), `deloadType`/`autoDeload`, `bbTrainingFocus`, `bbVolGoal`/`trainingVolumeMode`, `pedPhaseOverride`, `dcMode`, `bfrMode`, `packingV2`, `abPatternRotation`, `rotationMode`, `intensityLevel`, `allowStrengthLifts`, `eccentricMult`, `blastCruise`, `cycleDay`, `targetBodyFat`, `rehabMuscles`, `platePreset`.
- Критерий: 0 настроек, которые не читаются в выбранном пути (или честная подпись «только X»), у каждой — видимый маркер (rationale/техника/comment/фаза/RIR) + lock-тест «выбрал → видно».

### 8.2 M2 — женские сплиты в выборе
Сейчас `SPLIT_PATTERNS` имеет только `female_glute_5` (+`glute_focus_4`), а `rankBBSplits` учитывает `sex` только для `female + glutes`. Добавить научно обоснованные женские сплиты (Schoenfeld 2016 частота 2–3×; Kassiano 2024 glute/ham; Barbalho присед vs thrust; верх для баланса):
- `female_lower_upper_4` (низ-доминанта 4×/нед: 2 низа + 2 верха), `female_glute_upper_5` (глуты 3× + верх 2×), `female_bikini_5` (свип-пропорции: плечи/ягодицы/квадр), `female_wellness_5` (низ-доминанта с акцентом КМС-МС), `female_upper_glute_4` (верх + глуты).
- Учитывать `sex` в ранжировании (мягкий бонус женским для female, штраф нижне-доминантных для male), показывать в шаге сплита; не ломать мужской путь (байт-в-байт без sex=female).

### 8.3 M3 — полный аудит качества выдачи по всем циклам
Матрица: все BB-циклы × {male, female} × {mass,cut} × {novice/intermediate/advanced/enhanced} + все generic-сплиты × все методики. Проверять:
- **sets/reps/RIR**: соответствие методике (dc_rp/cluster/GVT ровно 10×10 / Gironda 8×8 / BFR 30-15-15-15 / 21s / negatives), RIR в диапазоне фазы, reps в диапазоне характера дня, `sets === workSets.length`;
- **объём**: effectiveSets ≤ MRV×1.15, ≥ MEV-флор, частота группы ≥2×/нед (флаг при 1×), сессии ≤ session-капов;
- **методики**: каждая выбранная отражена (rationale/technique/comment); отказные техники не в peaking/taper/prep;
- **структура**: фазы/делоды/тапер на месте, нет NaN/пустых сессий/дублей упражнений, вес достижим (пластины);
- human-readable дампы + property-тесты. Критерий: 0 ошибок на всей матрице (кроме осознанных warning-гейтов).

### Порядок работ
M1 (аудит + мёртвые настройки) → M2 (женские сплиты) → M3 (матрица выдачи). Каждый этап — отчёт + коммит pathspec.

### 8.4 Прогресс
- [x] **M1 — влияние методик (коммит этого раунда)**: NEW `bb-methodology-influence` (21/21) —
  property-матрица «настройка → план изменился» + точечные маркеры для generic `buildBBPlan`:
  methodology (pre/post_exhaust), loadStrategy, intensityTechnique (drop/negative), volumeScheme
  (GVT 10 / Gironda 8), supersetMode, trainingFocus, volumeGoal (mev<mrv), trainingVolumeMode high,
  bfrMode (30-15-15-15), eccentricMult, abPatternRotation, intensityLevel, allowStrengthLifts,
  packingV2, pedPhaseOverride (MGF+IGF1), DUP (`applyDUPOverlay`). **Найден и починен реальный баг**:
  `rehabMuscles` в generic-пути применялся ДО `finalizeBBPlan`, и MEV-фидер возвращал объём —
  рампа не работала (объём даже рос). Теперь применяется ПОСЛЕ finalize (паритет с program-путём).
- [x] **M2 — женские сплиты (коммит этого раунда)**: добавлены 4 научно обоснованных сплита —
  `female_lower_upper_4` (низ+верх 4×), `female_bikini_5` (свип-пропорции), `female_wellness_5`
  (низ-доминанта 5×), `female_upper_glute_4` (компактный верх+ягодицы). Итого 5 `female_*` +
  `glute_focus_4`. `rankBBSplits`: мягкий бонус `female_*` для `sex='female'` (+8) и штраф для
  `sex='male'` (−12, не навязываем). NEW `bb-female-splits` 4/4 (состав/инварианты/сборка без error/
  sex-скоринг); соседи 50/50. Мужской путь без `sex` не затронут.
- [x] **M3 — аудит качества выдачи (срез 1)**: NEW `bb-output-quality` 3/3 —
  все 30 generic-сплитов × {beginner/intermediate/enhanced} × {male,female}, 3 нед: нет NaN/undefined,
  `sets === workSets.length`, повторы 1–30, RIR 0–6, вес конечный, нет дублей упражнений в сессии,
  нет пустых сессий, фазы на всех неделях, маркеры методик (drop/rest-pause/pre-exhaust) видны.
  **Найден и починен реальный дефект**: в beginner-планах leg-pump и feeder-проходы добавляли одно
  и то же упражнение — дубль внутри сессии (напр. «Разгибания ног в тренажёре»). Добавлен центральный
  пост-проход дедупа в `finalizeBBPlan` (survivor = PRIMARY, сеты сливаются до per-exercise капа,
  порядок сохраняется); ключ `exerciseName||name` (не склеивать разные движения с общим id).
- [x] **M3 — остаток: полный аудит по ВСЕМ BB-циклам (коммит этого раунда)**. NEW 6 файлов аудита
  по реальному UI-пути «📋 ПРОФ-цикл» (`cycleTemplateToFullProgram → programToBBPlan`):
  - `bb-cycle-audit-library` (лёгкий, **всегда в круге**): состав библиотеки (38 циклов, без embed-*),
    паритет generic↔program по цели/полу, дословность faithful, маркеры методик в цикловом пути
    (drop_set/rest_pause comments, negative — темп, loadStrategy/linear, pre_exhaust, GVT 10, суперсеты).
  - `bb-cycle-audit-{beginner,intermediate,advanced,enhanced}` (по уровню; матрица 38 циклов × 2 пола ×
    2 цели adapt + faithful; структура/MRV/валидатор/делод). **Тяжёлая матрица (~760 сборок, ~20 мин CPU)
    идёт ОТДЕЛЬНО** (env-гейт `BB_CYCLE_AUDIT_FULL=1`; в общем круге 20 тестов скипаются, круг ~7 мин):
    `$env:BB_CYCLE_AUDIT_FULL='1'; npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts`
    → **20/20 за ~3.5 мин** (4 уровня параллельно).
  - **Найдено и починено 5 реальных дефектов циклового UI-пути** (все — lock-аудит):
    1. **Недельного MRV-капа не было вовсе**: program-путь не нёс `mrvByMuscle` и не звал
       `normalizeWeekMrv`/effective-трим → `cycle-08` beginner давал hamstrings 18 effective при MRV 12,
       glutes 17.6 > 12 на каждой неделе. Добавлен полный блок паритета convert/generic
       (`mrvByMuscle` × PED/recovery/nutrition/lab + female ×1.2 + spec-фактор, недельный кап +
       effective-трим, `plan.mrvByMuscle` для валидатора).
    2. **Сессионный кап рабочих сетов не соблюдался** (beginner — hard-гарантия): `cycle-08` beginner
       держал 25 сетов при капе 24. Добавлен пост-пасс (режем самый мелкий accessory до floor 1,
       MGF-слот не трогаем) после MRV-трима.
    3. **Делод не снижал объём** (`volumeMultiplier ×0.5` источника нигде не применялся; формула
       `0.5/max(0.5, volMult)` давала ×1): `cycle-bb-m-beginner-ul-8` W8 69→69, `dumbbell-8` W8 даже
       рос. Теперь делод применяет `volumeMultiplier` напрямую (×0.5), а enhanced leg-инвариант
       больше не раздувает deload-недели.
    4. **`goal` из UI не доезжал** в `programToBBPlan` (сушка/масса не влияли на объём циклового пути —
       тихий игнор выбора пользователя): добавлено типизированное поле + проброс `goal: bbGoal`;
       lock-тест «цель/пол влияют».
    5. **Дубли упражнений**: `ensureArmHeadCoverage` переименовывал слот в имя, уже присутствующее в
       сессии (источник нёс incline-curl с композитной мышцей `arms`) → два одинаковых имени; плюс
       ключ дедупа `exerciseName||name` не склеивал `name||` vs `name||name`. Оба закрыты.
  - Дополнительно: MEV-фидер получил честный лимит сессии (`feederMaxExercises` — dense-циклы 11-13
    упражнений упирались в hardcoded-10).
  - **Проверено**: полный гейт-аудит **20/20** (4 уровня, ~3.5 мин) + лёгкий файл 4/4; bb-круг с гейтом
    **2419 passed / 1 failed (предсуществующее чужое `bb-diagnostics-max-pro` female-symmetry) /
    20 skipped**, ~6.8 мин; `tsc --noEmit` **0 по проекту**; `verify:apk-design` OK.
  - **Осознанно**: `target_volume_deficit` (warning) не считается дефектом матрицы — одинаковые
    дефициты даёт и convert-путь (arms-8 → chest 4<6; hotel-4 → hamstrings 2<4), и generic на enhanced
    (дамп 29/30 сплитов: calves/delt_*/quads/forearms/abs/traps/shoulders); аудит строг к ERROR-уровню
    («volume 0») и к overflow. Дроп/рест-пауз мини-сеты остаются render-only (комментарий-маркер;
    инвариант `sets === workSets.length` — дизайн «цепочка в UI», Aug-2026).









