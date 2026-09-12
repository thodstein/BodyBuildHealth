# Арм-планировщик PRO-5 — аудит + интернет-синтез + план доработки

> Статус: **ВЫПОЛНЕНО КОДОМ** (Sep 12 2026, коммит pathspec своих, без пуша).
> Приёмка: NEW `arm-pro5` 40/40 + движки arm **831/831 (76 файлов)** + UI arm 132/132 (12 файлов) + `tsc --noEmit` **0 по всему проекту**.
> Основание: полный техаудит (суб-агент по коду) + свежий веб-синтез (StrengthLog 2025, ImproveYourGrip 2026, Marotta 2026, WAF-2025, IronMind CoC/RT/Hub, GripStrength 2026, Armlifting USA 2026).

---

## 1. Аудит — что есть сейчас (факт по коду)

- **Ядро:** `src/engines/arm/arm-builder.engine.ts:264 buildArmPlan` — 914 строк, ~60 полей `ArmBuilderInput`, цепочка: applyArmPro → mergedWorkMax → matchup/RFD/LR-split/Table-IQ → PED/recovery/lab/nutrition/tendon → MRV×spec×tech → schedule+phases → понедельный цикл (weekMult + correctionPct + Grip-RPE) → medley-ротация/sim-инъекция/LR-добивка/grip-протокол → rationale. `finalizeArmPlan` + `validateArmPlan` + taper вызываются СНАРУЖИ (UI/annual), не внутри билда.
- **Объём:** 78 движков `src/engines/arm/*.engine.ts`, 75 тестовых файлов движков, 23 UI-теста `arm*`. Библиотека циклов — **19 шаблонов** (12 базовых + 7 R9-волны), сплиты — **8**, мышцы — **19** (кисть/пронация/супинация/давления/хваты).
- **Визард:** `ArmAutoConstructor.tsx` ~2010 строк — **8 шагов** params/athlete/grip/split/plan/quality/export/year, ~50 useState, сборка `handleBuild`, мосты входа (planner-bridge: armDiscipline/Table-IQ/ortho/bench/diagnostics) и выхода (печать/CSV/ICS/варианты/коррекция/год).
- **Год:** `arm-annual.ts` + `arm-macrocycle.engine.ts` — блок строится именным cycleId (passthrough), non-classic пресет цикла приоритетнее годовой классики.
- **Хабы:** `ArmliftingDiagnosticsHub` (RT/pinch/hub + класс/рецепт/LMS) и `ArmDiagnosticsHub` (12 точек + Table-IQ + bilateral + ortho) → конструктор через `he_arm_last_*` + truthy-гарды.
- **TODO/заглушек:** поиском `TODO|FIXME|XXX|HACK|not implemented|throw new Error` в билдере/конструкторе/хабах/циклах — **0 совпадений**. Явных стабов нет.

### Топ-10 техдолгов (из аудита, серьёзность честно)

| # | Долг | Где |
|---|---|---|
| 1 | `weightForMuscle` fallback `default‖30` + fuzzy-substring — молча неверный вес при пустом профиле | builder:251 |
| 2 | `pickExerciseForMuscle` fallback вставляет упражнение чужой мышцы без варнинга | builder:153 |
| 3 | 12+ `try/catch{}` с пустым телом — ошибки глотаются, план молча деградирует до generic | builder (12 мест) |
| 4 | PED-fallback для неизвестных id (`1+doseSum/1000*0.4`) — выдуманная формула под видом adaptForPEDs; двойной tendon-кап | builder:334-367 |
| 5 | `correctionPct` двойного назначения (внутрицикловой рост + кросс-мезо rate) — одно поле, две семантики | builder:395,542 |
| 6 | Двойной тейпер держится на флаге `cycleTaperActive` — хрупко, рассинхрон = срез 0.45×0.6 | builder:503-535 + finalize |
| 7 | Валидатор: вся безопасность (humerus/UCL/плечо/tendon) — только warnings, опасный план `valid=true` | validator:60-100 |
| 8 | God-объекты: buildArmPlan 914 строк + ~50 useState + `builtPlan:any` + ключи `he_arm_*` без версионирования | builder + constructor |
| 9 | Consent-машина `fitCycleToWeeks` + mismatch цикл↔сплит только warning — легко собрать несочетаемое | cycle-library + validator |
| 10 | `acwrMult=1` всегда (ACWR заявлен, но константа); mojibake `�` в кириллице исходников | builder:377 + validator/taper |

---

## 2. Интернет-синтез 2025–2026 (что нового относительно наших движков)

| # | Источник | Новое для планировщика |
|---|---|---|
| 1 | **StrengthLog — Arm Wrestling Strength Training** (Abelsson, rev. 2025-12-02) | 8 нед = 2 фазы 4+4: W1–4 база RPE 7–8, W5–8 интенсивность RPE 8–9, сеты базы −1; 4 дня + table time отдельно; связка RPE↔RIR для паритета фаз |
| 2 | **Devon Larratt — minimalist singles** (Voice of Armwrestling 2025; BoxLife 2025) | 3 движения (high/low pronation + cup), 17–18 тяжёлых синглов, микрошаг +1.25 lb, working max ≈92%; протокол синглов для advanced вместо «тяжёлых подходов вообще» |
| 3 | **ImproveYourGrip — Periodization** (Henry, 2026) | Годовая лестница off-season (containment/wrist integrity) → strength/power → peaking; deload-плановые, tendon-care как фаза, а не сноска |
| 4 | **Marotta et al. 2026** (Appl. Sci., kinematics+sEMG локтя) | Hook грузит flexor-pronator (PT concentric 30→127 µV после реаба); вывод: кап объёма hook + эксцентрик-концентрик блок сгибателей-пронаторов в план |
| 5 | **Переломы humerus — video analysis** (Springer; Oh 2024; PMC-обзоры) | Риск = ротация корпуса к атаке + разрыв оси кисть-локоть-плечо + защита/проигрышная позиция (62% в defense zone) + холод/без разминки; spiral distal-third, лучевой нерв 22–44% при B2. Вывод: axis-guard + losing-position warning + warmup-гейт |
| 6 | **WAF Rules 2025** (waf-armwrestling.com) | Весовые Senior M11/F8 + Masters/GM/SGM/SSGM + SubJunior/Junior/Youth23; фолы: плечо за центрлайн, касание тела, dangerous position (плечо внутрь/ниже локтя в neutral), локоть-отрыв, slip-out правила, ремни-протокол, 2 варнинга=фол, 2 фола=поражение |
| 7 | **IronMind CoC** (FAQ + буклет 11 грипперов Guide→#4) | Лесенка warm/work/challenge, переход при 10–12 повторах, low-rep/high-effort 2–3×/нед, экстензоры (Expand Bands) после каждого краша; калибровка №1≈140/№2≈195/№3≈280 lb |
| 8 | **GripStrength — Periodized CoC 8/12-week** (2026-03) | RPE вместо % (скачки между грипперами слишком велики), deload = −40% объёма при RPE 5–6 без максимумов, grip НЕ в день тяжёлых тяг, negatives/overcrush/partials только в интенсификацию |
| 9 | **Armlifting USA 2026** (Worlds + Super Series + Arnold) | Актуальные снаряды: Axle 60mm, Anvil (Staniewicz SSE), Saxon Medley 2×5 / 3×4, Raptor 1.75" 1H, Grandfather Clock, Country Crush 2H, Fat Gripz DOH, Hub freestyle; формат last-man-standing, до 4 попыток, 60 сек, только мел |
| 10 | **IronMind RT/Hub rules** | Вращающаяся ручка (проверка проворота), центр хвата, без thumbless, 1 сек контроль + down-signal, Hub — 5 пальцев на базе, ‖ полу, только магнезия |

### Честная сверка «наука → наши движки»

- WAF-категории/возраста у нас есть (`arm-waf`), но **фолы-2025/ремни/dangerous-position как гейты плана** — нет.
- Humerus-guard у нас есть, но **триггер «разрыв оси + ротация корпуса + проигрышная позиция + холод»** — нет.
- Hook-кап и **эксцентрик flexor-pronator как назначаемый блок** — нет (реабилитация только текстом).
- CoC-лесенка 11 ступеней с правилом 10–12 и **экстензор-балансом** — нет (есть cocWorking/coverage, но без лесенки).
- **Saxon/Hub/Raptor/Clock/Anvil/Country Crush/Fat Gripz как платформы 2026** — частично (RT/Axle/Hub/Saxon/pinch/CoC есть; Raptor/Clock/Anvil/Crush/FatGripz — нет).
- Larratt-синглы и StrengthLog RPE-паритет — частично (heavySingles флаг есть, но без протокола 17–18 × +1.25).
- Deload −40% + «grip не в день тяг» — нет как гейты.

---

## 3. План доработки PRO-5 (7 эпиков)

### P1 — Safety PRO-5 (травмобезопасность как гейты, а не варнинги)
- `axisGuard`: разрыв оси кисть-локоть-плечо + ротация корпуса → блок side-pressure в неделе (процедурой без лифта, как table-inject при срывах).
- `losingPosition`: проигрышная/защитная позиция + весогонка к старту → warning + запрет стресс-синглов 100–125% в эту неделю.
- `warmupGate`: холод/без разминки (из diary/check-in) → обязательный разминочный блок перед столом.
- `hookCap`: hook-объём кап по неделе + назначаемый эксцентрик-концентрик flexor-pronator (Marotta-протокол) при жалобах на медиальный локоть.
- WAF-2025: чек-лист фолов (центрлайн/касание/dangerous/локоть/slip/ремни) в contest-sim + экспорт.
- Критерий: каждый триггер имеет свой тест (мутация гарда → падение); `valid` получает уровень `blocked` для axis/humerus (warnings-only остаётся для мягких).

### P2 — Armlifting 2026 (платформы + формат)
- NEW платформы: Raptor 1.75" 1H, Grandfather Clock, Anvil SSE, Country Crush 2H, Fat Gripz DOH (факт без % там, где нет WR — честно).
- Формат LMS: last-man-standing попытки (до 4, 60 сек, только мел, down-signal) в contest-sim + весогонка до границы класса.
- Правила на снаряд (RT/Hub/Axle/Saxon/новые) — чек-лист в помосте.
- Критерий: матрица снаряды×правила, старые %WR не сдвигаются.

### P3 — CoC-лесенка (IronMind + GripStrength-2026)
- 11 ступеней Guide→#4 с фунтами; warm/work/challenge автовыбор; правило перехода 10–12 повторов; экстензор-баланс (Expand Bands) после краш-дней; negatives/overcrush/partials только в интенсификацию; deload −40% без максимумов; запрет тяжёлого grip в день тяжёлых тяг (гейт расписания).
- Критерий: лестничные тесты (переход/делоад/гейт дня тяг).

### P4 — Синглы Larratt + StrengthLog-паритет
- Протокол 17–18 синглов × микрошаг (кг-эквивалент +1.25 lb) на 3 движениях для advanced; working max ≈92% с кросс-мезо записью.
- RPE↔RIR карта для фаз (7–8 → RIR 2–3; 8–9 → RIR 1–2) + шаблон 4 дня + table time отдельно + сеты базы −1 во 2-й фазе.
- Критерий: parity-тест фаз W1–4/W5–8 на эталонном цикле.

### P5 — Периодизация-гигиена
- Deload каждая 4-я (masters 50+ — каждая 3-я, уже есть — добить enforcement, а не флаг).
- Off-season → strength/power → peaking как годовая лестница (suggest-мост уже есть — добавить фазовые пресеты объёма).
- Тейпер: единый явный стейт вместо флага `cycleTaperActive` (устраняет долг №6).
- Критерий: годовой E2E 52 нед без двойного среза (регрессия на маркерах).

### P6 — Техгигиена (долги №1–5, 7–10)
- Типизированные ошибки вместо пустых catch (план несёт `degraded: reason[]` в rationale — честная деградация).
- Вес-фолбэк: вместо silent-30 — явный «вес не задан» + пропуск прогрессии с пометкой.
- Чужеродный пул: warning вместо молчаливой вставки.
- PED-fallback: честный «неизвестный id — без буста + warning» (формулу удалить).
- `correctionPct` → два поля (cyclePct + mesoRate) с миграцией.
- Валидатор: уровень `blocked` для безопасности; ACWR реальный вместо `=1`; версионирование `he_arm_*`.
- Критерий: tsc 0, старые контракты целы, каждый фикс с мутационным тестом.

### P7 — UX consent-машины
- Несочетаемый цикл↔сплит: вместо warning — кнопка «Починить (предложить сплит под цикл)» в один клик.
- Consent-диалог fit: показать недели было/стало + «применить/оставить/ другой».
- Критерий: UI-тесты на оба пути.

---

## 4. Не делаем (осознанно)

- Свои %WR для снарядов без verified-источников (факт без % — честно).
- Меддиагнозы и назначение фармы/процедур (только скрининг + «к врачу»).
- Он-девайс видеоанализ (Kinovea-CSV как есть; Pose — stub).
- Переписывание god-билдера с нуля (только разрез по слоям сверху вниз, инварианты целы).
- Чужие WIP/файлы других агентов — только свои pathspec, повершел-редиректы запрещены (кодировка).

## 5. Порядок и приёмка

1. P6-ядро (ошибки/PED/поля/тейпер-стейт) → 2. P1-safety → 3. P2-платформы → 4. P3-лесенка → 5. P4-синглы/RPE → 6. P5-периодизация → 7. P7-UX.
2. Приёмка каждого эпика: движок-тесты + UI-тест (где есть UI) + соседи arm-круга + `tsc --noEmit` 0 по своим + `verify:apk-design` при UI-касании. Коммиты pathspec своих, без пуша.

---

## 6. Выполнение (факт)

Честный реаудит перед кодом показал: половина плана уже существует (CoC-лесенка 11, regimen-синглы, axis-чек, contest-sim с фолами, медли-2026, ACWR-движок) — дубли не писал, закрывал только реальные гэпы:

- **NEW 6 движков**: `arm-pro5-core` (G1 degraded-причины/G2 PED-пометка/G3 распил correctionPct→cyclePctPerWeek+mesoRatePct/G4 taperStateFor/G6 живой acwrMult/G7 вес-ориентир/G8 чужеродный пул), `arm-pro5-safety` (axis-gate high→техника+blocked/guarded→warning, warmup-gate, hook-кап 12 + Marotta-эксцентрик, losing-gate), `arm-pro5-platform-rules` (9 снарядов 2026 с правилами; Raptor/FatGripz честно без % + LMS-канон + лесенка), `arm-pro5-coc-gate` (crush не в день тяг + Expand Bands), `arm-pro5-singles` (RPE↔RIR + StrengthLog-карта + Larratt 5×1 @92%), `arm-pro5-ux` (suggestSplitForCycle + consentPreview + deloadEnforcement + ARM_PHASE_PRESETS).
- **MOD 4**: `arm-types` (7 опциональных полей + `blocked[]`), `arm-builder` (degraded[] в 8 catch, PED/ACWR/safety/singles/rpeParity/вес-пул пост-проход, сплит-подсказка; дефолт байт-в-байт), `arm-validator` (`blocked[]` + каденс делоадов 4/3; `valid` не менялся), `arm-contest-sim` (WAF-2025 чек-лист 7 фолов в checklist).
- **Поймано своим тестом**: hook-кап считал всю супинацию hook-объёмом при balanced (ложные 3 варнинга, ломали контракт «чистая база») — гейт только hook/явный кап; deload-тест упирался в гвард последней недели — переписан на 6 нед.
- **Отклонения (честно)**: PED-формула неизвестных id сохранена (тесты test_e требуют поведения) + warning вместо удаления; синглы — 5 зачётных в плане + лесенка 17–18 практикой строкой (полные 17 сломали бы MRV/valid); UI-конструктор не тронут (движки + валидатор покрывают; соседние UI-тесты целы); версионирование `he_arm_*` не делал (миграция стора — риск соседям, только чтение через существующие ключи).
- Проверено: NEW 40/40 + arm-движки 831/831 + UI 132/132 + tsc 0 по проекту. НЕ ПУШИЛ.
- **Добивка «продолжай» (коммит pathspec, без пуша)**: P7-поверхность в шаге сплита (consent-превью было/стало + кнопка «подходит сплит — применить в 1 клик», UI 3/3→5/5) + хаб-правила 2026 (per-implement блок по выбранному снаряду + LMS-канон + collapsible-список 9; Raptor/FatGripz без новых полей — %WR не выдумываем) + annual-пресеты (`ARM_PHASE_PRESETS` → подпись фазы в warnings блоков). Проверено: движки+UI **924/924 (88 файлов)** + tsc 0.
- **Добивка-2 «полное выполнение» (коммит pathspec, без пуша)**: закрыты пункты «что осталось» — UI-контролы всех новых входов (ставки цикл/мезо, RIR-StrengthLog, микрошаг синглов, hook-кап, warmup-выполнена) в именном цикле + рендер `blocked[]` в гейтах качества (`data-arm="gates-blocked"`). Проверено: NEW UI 8/8 + движки+UI **927/927 (88 файлов)** + tsc 0.
- **Добивка-3 «1-2-7» (коммит pathspec, без пуша)**: (1) annual passthrough PRO-5 (`cyclePctPerWeek/mesoRatePct/rpeParity/larrattStepKg/hookCapSets/warmupDone/elbowPain` в `buildArmBlock` + consent-превью цикла в warnings блоков); (2) E2E 52 нед (`buildArmYearBlocks super_series` → все блоки собираются, маркеров `[arm-taper:]` ≤3 и ≤1 на неделю + чувствительный ассерт гарда: хвост toproll-пресета идёт полным против generic 0.45); (7) UI-flow тесты hook-кап/warmup. Поймано своим тестом: гейты рендерят только `validation.warnings` (первые 5 карточки) — пост-чеки билдера не были видны → те же 4 проверки продублированы в валидатор (структура + снапшот) и подняты первыми (safety раньше объёмной мелочи). Проверено: NEW движки 45/45 + UI 10/10 + круг **933/933 (88 файлов)** + tsc 0 по своим (1 ошибка — чужой `combat-builder` WIP, не тронут).
- **Добивка-4 «мост + ARM-конфиг» (коммит pathspec, без пуша)**: (5) мост несёт ось/warmup — humerus-чеклист хаба персистится (`he_arm_humerus_checks`) и едет в конструктор (`armAxisCheck/armWarmupDone`, приёмник только добавляет флаги + один флеш; `elbow`-провал честно не маппится — флага оси нет); ставки/RPE/hook-кап мостом не едут осознанно (хабы их не собирают — едут annual-конфигом, №6); (6) конфиг ARM-блоков: тип `AnnualBlockConfig` += 4 опциональных PRO-5 поля + контролы панели (PopupNumber ставки/hook-кап + RIR-тогл) → `buildArmBlock` напрямую. Поймано своим прогоном: моя RIR-кнопка задвоила чужой ассерт `/StrengthLog/` — лейбл переименован в «RIR-паритет» (чужой тест не тронут). Проверено: движки 47/47 + UI 12/12 + панель 3/3 + круг **985/985 (90 файлов)** + соседи annual-build 22/22 + `tsc` **0 по всему проекту**.
