# Калькулятор поддержки — ПОЛНЫЙ АУДИТ (мужской и женский) + план доработок

**Статус:** аудит выполнен (чтение кода, 2 разведки + перепроверка ключевых находок). Код НЕ менялся — это план.
**Основание:** запись §16 в `docs/FEMALE_AAS_PROTOCOLS.md` (по команде пользователя: «проанализировать весь калькулятор, выявить недостатки, составить план доработок, исследовать дубли карточек внизу, проработать женский блок анализов»).
**Связанные документы:** `docs/SUPPORT-CALC-LOWER-CARDS-PLAN.md` (предыдущий план P1–P7 по нижним карточкам — актуален, но номера строк сдвинулись после раунда «Женский слой»), `docs/FEMALE_AAS_PROTOCOLS.md` (§16).

**Что уже сделано в этом раунде до плана:**
- §16.3 (женские лабы в движке) — **выполнено** (коммит `2f02892c`): пол в `TzSpecInput`, женские floors (HCT 48/52, АЛТ/АСТ/ГГТ ULN 31, TT>6, креатинин), женские m_i-шкалы (TT/FT/SHBG/E2), проброс из калькулятора/вкладки «Риски»/LabsScreen; мужской путь байт-в-байт (13 тестов).
- Гэп категорийных лимитов женского слоя поддержки — **выполнено** (коммит `f22cb1b1f`).

---

## §1. Методология

1. Полная инвентаризация рендера: `AutoCalculator.tsx` (674) → `CalcMapperCard` (`Calc.mapper.tsx` ~4310) → `CalcActions`; все субкомпоненты `Calculator/`.
2. Сквозной grep-аудит импортёров по `src` (без `__tests__`) — мёртвый код.
3. Перепроверка вручную ключевых находок (навигация `mixcalc`, `setShowMegaPopup(true)` = 0 вхождений, мёртвые импорты `CalcPEDCard/CalcProfileCard/CalcLabsCard`).

---

## §2. Карта (кто кого рендерит)

- Прод-вход: `SupportScreen.tsx:91` → рендер `:3482-3502` (всегда `embedded`).
- `AutoCalculator` → `CalcMapperCard` (`AutoCalculator.tsx:659`); после — алерт-блок `:664-669`.
- Порядок верхнего уровня: Автозаполнение → Доп.PED → Фаза → Курс ААС → Анализы → Риск (`TzRiskCard`).
- Внутри `CalcMapperCard` (поток): LabsDueBanner → режим (Интеллектуальная/Ручной) → **PED-баннер** → **♀ женский баннер** → Усиление → подтверждения модулей → Симптомы → Фаза → Сводка → **«О подборе»** → **♀ компакт** → STOP/алерты → Ручной план → План поддержки → Миксы → База → Синергии → **Мониторинг (свёрнут, 17 подсекций)** → UL → Противопоказания → Ребаунд → Применить → CalcActions.

---

## §3. Дубли карточек (главный запрос «дубли внизу»)

| № | Дубль | Где | Вердикт |
|---|-------|-----|---------|
| Д1 | PED-risk gross→net: полный ↔ сокращённый | `Calc.mapper.tsx:1278-1383` ↔ `:2726-2761` | Осознанное «полный/компакт», но в одном экране — 2×; P2: оставить один якорь + ссылку |
| Д2 | ♀ Женский слой: полный ↔ компакт | `:1386-1413` ↔ `:2763-2776` | Свежая правка этого раунда; тот же паттерн «полный/компакт» — P2 |
| Д3 | Алерты `rec.alerts` | `:2779-2785` (STOP), `:2788-2792` (TIER), `SafetyAlerts` в мониторинге (`CalcSafetyLayer.tsx:60-76`) | Один и тот же текст 2-3× — P1: дедуп (алерты только у сводки, в мониторинге — ссылка) |
| Д4 | Предупреждения курса (pedFlags) | `:3497-3502` ↔ `SafetyPedEscalation` (`CalcSafetyLayer.tsx:283-306`) | 3 из 4 флагов дублируются — P1: однострочники убрать/заменить ссылкой |
| Д5 | Синергии: два списка в одной карточке | `:3063` (`buildStackSynergyDescription`, 30 пар) ↔ `:3064-3076` (`SYNERGY_NETWORK`) | Пересечения D3+K2, NAC+TUDCA, NAC+глицин, фибринолитики — P1: единый источник (сеть) + хардкод только для «нет в сети» |
| Д6 | Взаимодействия: два блока разных БД | `:3077-3130` (`checkInteractions`) ↔ `:3132` (`planResult.conflicts`/`rec.conflicts`) | Соседние блоки с разными источниками — P1: объединить в один с приоритетом |
| Д7 | Мониторинг: 4 перечня маркеров подряд | `:3269-3281` (schedule) + `:3283-3290` (K0–K10) + `:3292-3314` (персональные) + `:3318-3348` (SYSTEM_PANELS) | АЛТ/АСТ и др. повторяются; дедуп есть только внутри персональных — P1: дедуп между блоками (или явные подписи «источник») |
| Д8 | Список стеков: ручной попап ↔ попап «Усиление» | `:1184-1266` ↔ `:1594-1699` (раскрытый блок — почти дословная копия JSX) | P1: вынести в общий компонент `StackExpandableRow` |
| Д9 | Выбранные стеки: 2 списка | `:1496-1505` ↔ `:1163-1178` | P2: один компонент чипов |
| Д10 | Риск системы считается дважды | `AutoCalculator.tsx:44-56` ↔ `Calc.mapper.tsx:882-909` | Разные входы → числа могут расходиться — P0-кандидат: сверить и подписать, какой расчёт канон |
| Д11 | Противопоказания: 2 списка | `AutoCalculator.tsx:664-669` ↔ `Calc.mapper.tsx:3723-3812` | Разные источники, пересечения возможны — P1: объединить/дедуп по веществу |
| Д12 | Автозаполнение: 3 механизма + кодовый дубль маппинга AAS | `AutoCalculator.tsx:316-368`/`:68-145` ↔ `Calc.mapper.tsx:1416-1484`/`:2630-2681`; маппинг AAS продублирован `AutoCalculator.tsx:73-95` ↔ `:200-212` | P2: вынести маппинг в одну функцию |
| Д13 | Фаза: 2 описания | `AutoCalculator.tsx:405-414` ↔ `Calc.mapper.tsx:2710` (`PHASE_PROTOCOL`) | P2: ссылка на единый источник |

---

## §4. Мёртвый код (найдено + перепроверено)

**Компоненты без прод-использования:**
- `CalcPEDCard`, `CalcProfileCard`, `CalcLabsCard` — импортируются в `Calc.mapper.tsx:34-36`, но не рендерятся (живут только в тестах).
- `CalcSafetyLayer` агрегатор (`CalcSafetyLayer.tsx:363-382`) — помечен «LEGACY, не используется»; `SafetyProtocolWarnings` (`:79`) — нигде; `SafetyDepletion` (`:220`) и `SafetyPctTiming` (`:324`) — только в мёртвом агрегаторе (+ тесты).
- `Calc.result.tsx`: `RiskBar`, `SchedBlock`, `LabDeltaView` — мёртвы; жив только `MechanismView`.
- `Calc.lab.tsx`: `LabSliceInput`, `FullLabInput` — мертвы вместе с `CalcLabsCard`.
- `Calc.parts.tsx`: `SevSelect`, `PopupSelect`, `PopupBool`, `PopupText` — только barrel/тесты.
- `RiskTimelineChart.tsx`, `WeeklyPlanView.tsx` — только тесты.

**Мёртвые состояния/импорты в `Calc.mapper.tsx`:**
- `savedSearch`, `manualSubInput`, `catalogSubsCount`, `showInteractions`;
- **`showMegaPopup` + весь попап «🚀 Мега-усиление» (`:1706-1796`) — недостижим: `setShowMegaPopup(true)` = 0 вхождений** (перепроверено grep);
- `megaSuggestions`/`megaSelected` считаются вхолостую;
- проп `onOpenManualPicker` не вызывается → `SupportManualPicker` в `SupportScreen` недостижим (единственный сеттер завязан на этот проп);
- мёртвые импорты: `SafetyDepletion`, `SafetyPctTiming`, `getSubstanceForm`, `getTitrationProtocol`, `CONTRAINDICATIONS`, `BADGE`, `SupportRisk` и др.

---

## §5. Баги навигации (P0/P1)

1. **P0: `calcView='mixcalc'` → пустой экран.** `SupportFavoritesView.tsx:614` ставит `section='info'`, `calcView='mixcalc'`, но **ни один рендер-гейт `mixcalc` не обрабатывает** (перепроверено: единственные вхождения — типы в `SupportShared.tsx:14` и `SupportScreen.tsx:66`). Кнопка «📂» в «Избранном» открывает пустоту.
2. **P1: «🧮 В калькулятор» из рекомендаций миксов** (`SupportFavoritesView.tsx:110`) ставит `section='info'` + `calcView='calculator'`, а гейт калькулятора требует `section==='generator' && tab==='calculator'` — кнопка не работает.
3. **P2: недостижимый попапы** (Мега/ручной пикер) — см. §4.

---

## §6. Женский блок анализов

### §6.1 Выполнено (§16.3, коммит `2f02892c`)
- `TzSpecInput.sex?`, `clinicalFloorsForLabs(labs, sex?)`: HCT 52/48, АЛТ/АСТ 93/62 (ULN 31), TT>6 → reproductive 50.
- `getMiFromLab(..., sex?)`: hem1/cv4/cv5 HCT, HGB, RBC, liv1 ALT/AST, liv2 ГГТ, rep2/rep5 TT+FT+SHBG, rep4 E2, ren1 креатинин — женские шкалы.
- Проброс: `buildTzInput` (front `state.profile.sex`), `buildTzInputCore(sex?)`, `LabsTzRiskTab` (+ женские placeholders норм), `LabsScreen:517`.
- Закрыты дефекты «по умолчанию»: женский TT 10 нмоль/л больше не m=0; E2 100 pg/mL не ложный m2/m3; HCT 50 виден.
- **Проверка полноты (этот раунд):** женские протоколы приложения — 59/59 тестов (`support-protocol-women-female-aas` 25 + `women-protocol-menu-e2e` 1 + `female-support-layer` 15 + `female-aas-risk` 19); найден гэп — добавки женского слоя `vitex`/`inositol` не имели записей в `support-dosing.ts` → **закрыт** (2 записи + lock-тест «все FEMALE_LAYER_SUBS имеют дозировку»).
### §6.2 Осталось (низкий риск, отдельным раундом)
- ✅ `risk-verification.engine.ts` — женские пороги в отчёте верификации выполнены (P1, `7ffd3e93`): femaleThresholds/femaleDirection маркеров + femaleValue/femaleLabel/femaleOnly floors, пол из профиля (`RiskVerificationList`).
- ✅ `LAB_MONITOR_DB`/`support-phase-labs`/`substance-monitoring-db` — женские пометки текстов выполнены в `support-phase-labs` (K0/K2/K5/K7 femaleNote, рендер при sex=female); `LAB_MONITOR_DB` — покрыт женскими протоколами/паспортом (отдельные пометки не дублируются — см. §6.4).
- ✅ **Четырнадцатый проход**: `notification-engine` (♀ пороги HCT 48/52, АЛТ 78, E2-диапазон цикла, E2-краш только на ИА), доменная карта гематологии в калькуляторе (♀ 44/48 + Hb 150 + подписи ♀), `estimateCardioRisk` (возрастной порог 55 ♂ / 65 ♀), мёртвый дубль интерпретации анализов в `training-calendar.engine.ts` удалён (единственный источник — `lab-analysis.engine.ts`).
- ✅ **Пятнадцатый проход**: алерты `notification-engine` (E2/HCT/АЛТ/PRL/ЛПНП/eGFR/D-димер + ♀ пороги) видны в калькуляторе — `CalcNotificationsBanner`, `labs_overdue` не дублируется с `LabsDueBanner`, закрытие стартует cooldown правила (`markNotificationShown`).
- ✅ **Шестнадцатый проход**: «Суммарная нагрузка / UL» считается по тем же дозам плана, что UL-проверка (`planDosesInUlScale`), с канонизацией алиасов; в сводку входят только истинные `UL` (B6/A/K2/фолат теперь видимы, `ClinicalGuidance`/`SafeLevel` — нет).
- ✅ **Семнадцатый проход**: одна доза на всех поверхностях — `buildScheduleFromPlan` (расписание из карточки плана), `applyTitration` для нутриентов из `resolvePlanDose` (вес-таблица + потолки UL), `WEIGHT_BASED_DOSING_MCG` для D3/Se, рампа NAC/TUDCA как доля плана; тест «карточка == титрация» на 60/80/140/200 кг.
- ✅ **Восемнадцатый проход**: мёртвый `SUBSTANCE_ENHANCERS` (перепутанные единицы, B6 50 мг > UL) удалён; усилители — только `detectEnhancers` из каталога.
- ✅ **Девятнадцатый проход**: PDF «для врача» больше не угадывает дозу регэкспом из текста обоснования (МНН и доза — из карточки плана), fallback-график и стоп-критерии учитывают пол (♀ HCT 48/52, АЛТ 31/78, без ПСА).
- Остаётся (P2): `risk-engine-v7-matrix`/`training-calendar` и другие дубли порогов, если найдутся; `Calc.labs-derived`/`Calc.mapper` — базовые пороги уже gendered.
- ✅ **Двадцать четвёртый проход**: `LAB_REFERENCES` (V7) ULN печени/почек выведены из `UCUM_MAP` (было: АСТ 35 vs 40, ГГТ 50 vs 55, креатинин 106 vs 110, ЩФ 120 vs 130, билирубин 20 vs 17.1); `Calc.labs-derived` — АЛТ/АСТ/ГГТ/билирубин/креатинин/HCT считаются от `getLabNorm(sex)` (`hctSymptomCuts`), а не от мужских литералов; мужской путь байт-в-байт.

### §6.4 Женские ПРОТОКОЛЫ «Женщины и ААС» — сверка с приложением (P1)
> ✅ **Выполнено (P1, `7ffd3e93`, без пуша).** Протокол внедрён (13 табов, коммиты `7c9dc7f08/8f0df35f9/e9e9cfdfa/4fe56401`) и покрыт тестами (25/25 + e2e). Согласованность контента протокола с движками после §16.3:
> **Обновление таба «Препараты» (раунд «раздел препаратов», `3f3cb71a`):** все позиции согласованы с движком — женские пороги/флаги в примечаниях каждой строки (оксан 10/20 мг/день, тест 10–20 мг/нед и репро-риск при T>6, нандролон 50–75/125-граница, метан 5–10, примо 50–75, мастерон 75–100, болденон HCT 48/52); добавлены строки **DHB** (5α-восстановлен) и **SARMs S23/YK-11** (абсолютные противопоказания); либидо-эффекты (стан ⬇, трен ⬇⬇, анастрозол «не обнулять E2»); интро про авто-слой (пороги+флаги+витекс/инозитол поверх мужского набора). В таб «Дозы» добавлены таблица андрогенных индексов и примеры расчёта, шапка протокола указывает на калькулятор (`504eed54`). Тесты: женский 25/25, аудит 61/61; `tsc` 0.
1. ✅ **Единый источник порогов** (проход 27): `FEMALE_AAS_PROFILES` (движок, мг/нед) ↔ `FEMALE_VIRILIZATION_CALC` (живой калькулятор, оральные — мг/день) закрыты кросс-лок-тестом `female-virilization-parity` (5): красный порог после пересчёта день×7, андрогенный индекс и флаг абсолютного противопоказания совпадают для всех 14 позиций. Значения сведены, дубль остаётся как «движок/витрина» под локи.
2. **Сверка 11 «примерных протоколов поддержки»** женского таба с общими протоколами приложения (Печень, Гематология, Пролактин, Липиды/E2, PostCycle): дозы/пороги не конфликтуют, нет дублей, кросс-ссылки двусторонние.
3. ✅ **Женские пометки в общих протоколах**: `supportProtocolHepatic` (♀ ULN АЛТ/АСТ 31, ГГТ 32), `supportProtocolHemato` (♀ Hct 36–48, пороги 48/52, HGB/RBC по женским зонам), `supportProtocolProlactin` (♀ референс ниже, аменорея/галакторея → гинеколог-эндокринолог), `supportProtocolE2` (♀ E2 по фазе цикла, AI — только врач) — строки «♀ …» в шапке протоколов.
4. ✅ **Каталог рецептурных женских позиций**: `spironolactone` уже в каталоге (`support-catalog-data.ts`, `tier: 'specialty'`, органы KIDNEYS/HEART/REPRODUCTIVE, механизмы ANTI_ANDROGEN/5AR_INHIBITION) — протокольный флаг не нужен.
5. ✅ **Паспорт/калькулятор доз**: `vitex`/`inositol` подхватываются окном (`doseWindowFor`) и паспортом — лок в `female-phase-lab-notes.test.tsx` (doseWindowFor: окно из THERAPEUTIC_WINDOWS, не «по инструкции»).
6. ✅ **Фертильность/ПКТ**: `FertilityPCTScreen` показывает женщинам предупреждение (`data-female-fertility-note`): экран про мужскую фертильность, кломифен/hCG «по-мужски» не применяются, женские шаги — в табе «Женщины и ААС» → «Контрацепция/Фертильность».

---

## §7. План доработок (приоритеты)

### P0 (врущие данные / недоступная функциональность) — ✅ выполнено

1. ✅ **Расчёт риска (Д10)** — коммит `a5ce655f`:
   - паритет-тест `risk-parity-contours.test.ts` (5/5): составы обоих контуров совпадают (canonId, обе стороны), математика едина для беспикового случая; `engine.tzSpecResult.overall` == `overallRisk*`;
   - **найденная причина расхождения**: верхняя карточка показывает **пик курса** (timeline-peak патч `engine.ts:640-672`), а попапы/«Риски» — текущую композицию. `tzSpecResult` был смешанным (органы пик + overall текущий) — **исправлено** (overall тоже = пик, объект однороден);
   - `TzRiskCard` += `peakWeek` → подпись «· пик курса — нед N» (честная семантика различия).
2. ✅ **Навигация** — коммит `706c5b81`:
   - «🧮 В калькулятор» (рекомендации миксов): `section='generator'` + `tab/genTab='calculator'` (гейт проходим);
   - «📂» комплект: вещества (`kit.stack`, mg≠0) ставятся в очередь плана (`he_training_mix_plan_queue`) + переход в калькулятор; пустой комплект — честное «⚠ нет распознанных веществ» (вместо ложного «переключите тайминги»);
   - несуществующий `calcView='mixcalc'` больше никем не ставится.
   - Тест `favorites-nav-p0` (3/3); круг движков 616/616, UI 63/63.

**Остаток Д10 (перенесено в P1):** правки попапов (добавить/убрать вещество вручную) не отражаются в верхней карточке — движок считает по `deferredState`, не зная `manualSubs/addedSubs/removedSubs` из `CalcMapper`. Требуется callback-лифт `onRiskChange` (CalcMapperCard → AutoCalculator) — отдельный заход.

### P1 (UX/честность)

**Статус: ✅ выполнен (Sep 14 2026, коммиты `0d48196c`/`aa3a5505`/`5e62c84d`/`7ffd3e93`/`b1ef31e9`/`8f9763b8`, без пуша).**

3. ✅ **Д3+Д4** (`0d48196c`): алерты `rec.alerts` — единственная точка показа (якорь `#calc-alerts-summary`, в мониторинге — бейдж `data-alerts-badge` + ссылка «↑ К тревогам»); однострочники pedFlags убраны, детали — `SafetyPedEscalation` (+`has17AlphaAndGH` переехал туда); тест `calc-dedup-p1` 3/3.
4. ✅ **Д5/Д6/Д7** (`aa3a5505`): синергии — сеть приоритетна (`filterSynergiesCoveredByNetwork` + `synergyLinePairs`); взаимодействия — один блок с приоритетом `checkInteractions` (`SafetyConflicts` только fallback/≤1 вещество); мониторинг — 4 подписи источников; тест `calc-synergy-monitor-p1` 6/6.
5. ✅ **Д8/Д9** (`5e62c84d`): общие компоненты `StackExpandableRow` + `SelectedStackChips` (`CalcStackComponents.tsx`) в ручном попапе и попапе «Усиление»; тест `calc-stack-components` 5/5.
6. ✅ **§6.2** (`7ffd3e93`): женские пороги `risk-verification.engine` (маркеры + floors, пол из профиля в `RiskVerificationList`), ♀ пометки `support-phase-labs` (K0/K2/K5/K7 + рендер в `CalcPhaseLabCards`); тесты `risk-verification-female` 12 + `female-phase-lab-notes` 5.
7. ✅ **Мёртвый код** (`b1ef31e9`): `showMegaPopup` оживлён (кнопка «🚀 Мега (N)»), `onOpenManualPicker` оживлён (кнопка «📚 Расширенный ручной пикер»); удалены `showInteractions`/`savedSearch`/`manualSubInput`/`catalogSubsCount` и мёртвые импорты карточек; тест `calc-deadcode-p1` 4/4.
8. ✅ **Callback-лифт риска** (`8f9763b8`): `onRiskChange` CalcMapperCard → AutoCalculator (`mapperRisk ?? result.tzSpecResult`, маркер «📝 Учтены ручные правки»); без правок — прежний путь; тест `calc-risk-lift-p1` 2/2.
9. ✅ **§6.4** (`7ffd3e93`): сверка `FEMALE_VIRILIZATION_CALC ↔ FEMALE_AAS_PROFILES` (найдены и закрыты реальные гэпы: `drostanolone⊂stan`-коллизия — мастерон ловился станом; алиасы `nand_phenyl`/`drost_prop`/`drost_enan`), ♀ пометки 4 общих протоколов, спиронолактон-каталог («только врач» + креатинин/беременность), vitex/inositol в `THERAPEUTIC_WINDOWS`+`DEFAULT_DOSAGES` (паспорт без «нет данных»), оговорка `FertilityPCTScreen` для женщин; тест `female-protocol-engine-parity` 8/8 + `fertility-pct-female-note` 2/2.

Проверено: support/risk-круг **332/332** + rest-hooks/labs-risk **76/76**; `tsc --noEmit` — 0 по своим файлам (24 чужие ошибки параллельных WIP: bb-builder/meal-plan-engine/BbAutoConstructor); `verify:apk-design` OK. НЕ ПУШИЛ.

### P2 (полировка)

**Статус: ✅ выполнен (Sep 14 2026, коммит `239cebdb`, без пуша) — кроме осознанно отложенного п.12.**

9. ✅ **Д1/Д2** (`239cebdb`): полный/компакт PED-risk и женского слоя — единые анкоры `#calc-ped-risk-summary` / `#calc-female-layer-summary`, в деталях только строка-индекс (уровни/вещества/флаги) + кнопка «↑ Полная сводка выше»; тексты рисков, покрытие и обоснования — один раз (тесты `calc-p2-dedup`).
10. ✅ **Д11–Д13** (`239cebdb`): противопоказания — дедуп ПО ИСТОЧНИКУ (нижний блок честно назван «Медицинские ограничения (по состоянию здоровья)» + отсылка к «Противопоказаниям» веществ; физическое слияние разных БД осознанно не делалось); автозаполнение — дубль маппинга AAS вынесен в `calc-course-link.ts` (`deriveCourseLinkPatch`, оба пути: эффект + «Фарма курс», source-lock-тест); фаза — подпись «Источник: PHASE_PROTOCOL движка» (`data-phase-source`).
11. ✅ **P2-UX** (`239cebdb`): PillBurden-число в hero (`data-pill-hero`, из `planResult.pillBurden`); якорный индекс веществ — чипы списка (`data-sub-chip`) скроллят к карточкам `#calc-sub-*`; K-тизер (`phaseLabTeaser`) был закрыт ранее.
12. ✅ **Остальные пункты §6.2 закрыты четырнадцатым проходом** (см. ниже): `notification-engine` — женские пороги без фазовой модели (E2 алерты только на ИА/выше овуляторного пика); `estimateCardioRisk(entries, {sex})` — возрастной порог 55 ♂ / 65 ♀; `training-calendar.engine.ts` LAB_REFERENCE_DB — мёртвый дубль удалён (прод-потребителей не было, второй набор порогов расходился с `lab-analysis.engine.ts`).
   - ✅ Сделано из §6.2 (`239cebdb`): `Calc.mapper` градация HCT (жен 44/48/52, `hctGradationLabel`) и `Calc.labs-derived` (`hctElevation` жен 48/52/56; мужской путь без sex байт-в-байт).
   - ✅ **`risk-engine-v7-matrix` LAB_REFERENCES — выполнено** (`b6f826cf`): `LAB_REFERENCES_FEMALE` + `getLabReference(code, sex?)`; женские ветки проброшены в `computeV7Matrix` (`MatrixInput.sex`), `risk-engine-v7` (`V7RiskInput.sex` → z-скоры/refs/matrixInput) и `risk-engine-tz` (`computeLabFactor(..., sex)`, пол уже был в `TZRiskInput`); `useV7Risk` передаёт пол профиля. Мужской путь без sex/`male` — байт-в-байт (lock-тесты). Половые гормоны намеренно не переопределялись (V7 z-семантика требует женской фазовой модели — она в §16.3/TZ).

### Вне этого плана (чужие зоны/риски)
- ~~`SupportScreen.tsx`/`SupportFavoritesView.tsx` навигационные правки~~ — P0 выполнен внутри `SupportFavoritesView.tsx` (гейт `SupportScreen` не менялся, legacy `mixcalc` больше не пишется).
- `notification-engine`, `risk-engine-v7` — отдельные раунды.

---

## §8. Критерии готовности (для будущего выполнения)

- Каждый P0/P1: тест на регресс (поведенческий или source-lock), мужской путь байт-в-байт где применимо.
- Прогон support/risk-круга (~600+ тестов) + `tsc --noEmit` 0 + `verify:apk-design`.
- Обновление этого файла статусами по мере выполнения.

---

## §9. Стартовый промпт для новой сессии (P1)

> Скопировать агенту в новую сессию (контекст восстанавливается из этого файла).

```
Проект: D:\BodyBuildHealth. Выполни P1 из docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md (§7 P1 + §6.2 + §6.4):

1) Д3+Д4 — дедуп алертов rec.alerts (×2-3) и pedFlags (однострочники vs SafetyPedEscalation) в Calc.mapper.tsx/CalcSafetyLayer.tsx;
2) Д5/Д6/Д7 — синергии: один источник (SYNERGY_NETWORK) вместо двух списков; взаимодействия: один блок с приоритетом checkInteractions; мониторинг: дедуп между 4 перечнями маркеров;
3) Д8/Д9 — вынести раскрытую карточку стека и чипы в общий компонент;
4) §6.2 + §6.4 (женское): пороги в risk-verification.engine, пометки LAB_MONITOR_DB/support-phase-labs, сверка таблиц женского протокола с движком (единый источник порогов FEMALE_AAS_PROFILES ↔ FEMALE_VIRILIZATION_CALC), женские пометки в общих протоколах (Печень/Гемато/Пролактин/E2), каталог спиронолактона, проверка паспорта/доз vitex/inositol, аудит FertilityPCTScreen на мужские меры;
5) мёртвый код: решить судьбу showMegaPopup (недостижим) и onOpenManualPicker, убрать мёртвые импорты карточек;
6) callback-лифт onRiskChange (CalcMapperCard → AutoCalculator) — остаток Д10.

Правила проекта (обязательны): только Edit/Write + vitest/tsc; НЕ трогать чужие файлы; коммиты строго `git commit -m "…" -- <свои файлы>` (pathspec); после любых скриптов перечитывать файл перед Edit; НЕ использовать PowerShell для правок файлов; чекаут запрещён; каждый пункт — с тестом на регресс; мужской путь байт-в-байт (lock-тесты); финал: support/risk-круг + `tsc --noEmit` (NODE_OPTIONS=12GB) + `verify:apk-design`; пуш — только когда очередь origin/main..HEAD состоит ТОЛЬКО из своих коммитов.
```

**Напоминание из прошлой сессии:** P0 выполнен (`a5ce655f`, `706c5b81`, `14e1df74d`, запушены); женские протоколы в приложении полные (59/59 тестов + закрыт гэп дозировок vitex/inositol); P1/P2 аудита калькулятора выполнены (`0d48196c`–`239cebdb`), v7-женские LAB_REFERENCES — `b6f826cf` (запушены).

---

## §10. Женский слой — фаза 2 (Sep 14 2026): риски по препаратам фармакологии + вкладка «Анализы»

> **Статус: ✅ ВЫПОЛНЕНО КОДОМ (Sep 15 2026, 2 коммита pathspec, без пуша):**
> - **P1 `2df69c82`** (Ж1–Ж5): `getDrugThreshold(id,sex)` + контуры (V7/TZ/weekly/AR-нагрузка), `femaleDrugThresholdView` + карточки RiskScreen/RiskOverview (бейдж ♀ 1/4–1/10 + ссылка), `mapStackToPathologies(drugs,sex)` (5 женских патологий), lab-pharma женские пороги. Тесты: `female-phase2-risk` 25/25 + `risk-female-thresholds` UI 4/4; мужской JSON-lock.
> - **P2 `7271a215`** (Л8–Л11): NEW `lab-norms.engine.ts` (`getLabNorm`/`FEMALE_LAB_BOUNDS` из `LAB_REFERENCES_FEMALE`; Hb ULN 155→150, GGT 32→31, +LLN), LabsCatalog/LabsCatalogTab/LabsScreen/LabsResults/LabsOverview/LabDiaryTab/ExtendedLabsTab, role-view (HCT 36–48 вместо ×0.85), легенда/бейджи ♀, femaleNote в 4 панелях, `FEMALE_MARKER_EC50` в clinical-analyzer. Тесты: `lab-norms-female` 10/10 + `labs-female-p2` UI 7/7 + паритет FEMALE_LAB_GROUPS; круг labs 804 + risk 65; `tsc --noEmit` 0 по проекту; `verify:apk-design` OK.
> - **Хвосты `5dac0d5b`** (все 6 закрыты): дозо-индекс вирилизации в карточке RiskScreen/RiskOverview, default-ветка RiskOverview с sex, **кликабельная** кросс-ссылка (`NAV_TARGETS['support-women']` + ветка `initialSubTab='women'` в SupportScreen — ведёт в detail протокола), `normalizedRatio` HCT female 36–48 (core/labs-mapping), `LabsInvestigations` женские нормы, PharmaScreen `MapperTab` с полом. Тесты: +6 (11/11 lab-norms, 8/8 labs-female-p2, 2/2 mapper, 2/2 deeplink); `tsc 0`.
> - **Финал `9135b3ef`** (последние 2 остатка): Ж4 — `analyzeLabDrugCorrelation` в `LabsRisksTab` (RiskScreen) получает `profileSex` (раньше мужские пороги) + guard; Л8 — `normalizedRatio` через единый `getLabNorm` для ВСЕХ женских маркеров (не только HCT) и `labs-indices` (`computeLabIndices(indexDetails)` + `sex` из LabsScreen); мужской путь — JSON-lock. Остатков по §10 нет.
> - Осознанное отклонение: `clinical-pathology-db` НЕ менялся — женский ec50 сделан сепаратором `FEMALE_MARKER_EC50` в analyzer (общая база в других контурах цела).

**Основание:** запрос пользователя: «добавь в план риски для женщин по препаратам фармакологии адаптировать, вкладку анализы адаптировать отображение и индикацию под женщин тоже». **Аудит выполнен чтением кода (grep-инвентарь потребителей), код НЕ менялся — это план.** Единый женский источник уже существует: `FEMALE_AAS_PROFILES` (22 профиля: yellow/red мг/нед, androgenIndex, contraindicated) + `assessFemaleAas` (`engines/female-aas-risk.ts:31/92`) — сейчас подключён только к калькулятору поддержки, но НЕ к вкладке «Риски» и НЕ к фарма-контурам.

### §10.1 Аудит: риски по препаратам (фармакология) — что показывается сейчас

| # | Точка | Файл:строка | Сейчас | Женского нет |
|---|-------|-------------|--------|--------------|
| Ж-1 | Карточка «Пороги и препараты (ААС, ГЧ, инсулин)» | `RiskScreen.tsx:773-814` | `DRUG_THRESHOLDS`: dosePerWeek + androgenicity-градация (муж) | нет женских yellow/red, нет «⛔ абсолютно противопоказано», нет дозо-индекса вирилизации |
| Ж-2 | Таблица порогов по андрогенности | `RiskScreen_parts/RiskOverview.tsx:273-281` | то же, компакт | то же |
| Ж-3 | Реестр порогов | `core/constants.ts:11-110+` (`DRUG_THRESHOLDS`) | единый муж-реестр | женский источник (`FEMALE_AAS_PROFILES`) не подключён ни к одной точке RiskScreen |
| Ж-4 | V7-дозовые тиры и вклад препаратов | `risk-engine-v7-matrix.ts:144+` (`DRUG_THRESHOLDS_V7`), `computeDrugContributions` (~`:978` `doseRatio × weight × androgenicity`) | пол не влияет на тиры/AR-вклад | женские пороги в 1/4–1/10 мужских, абсолютные противопоказания не эскалируют контур |
| Ж-5 | AR-нагрузка | `risk-engine-v7-extensions.ts:124-154` (`androgenicLoad`), `stack-burden.engine.ts:13-58`, `support.engine.ts:835-845`, `PharmaScreen_parts/DosageCalculatorTab.tsx:58-128,176` | муж пороги | женские AR/дозовые пороги |
| Ж-6 | Патологии стека | `drug-mapper.engine.ts` (`mapStackToPathologies`; вызов `RiskScreen.tsx:1541-1567`) | только муж патологии (HPTA, гемато, липиды…) | нет женских патологий: вирилизация, нарушение цикла, фертильность, голос/клитор, кости/волосы; функция без `sex` |
| Ж-7 | Латентный дубль-слой | `assessPedRisk(peds, level, sex)` (`ped-risk-matrix`) уже возвращает `femaleFlags/femaleVirilizationIndex/femaleContraindicated` и показывается в `Calc.mapper`, но НЕ в RiskScreen | — | подключить как UI-слой без новой математики |
| Ж-8 | Lab-pharma корреляции | `lab-pharma-correlation.engine.ts:123-168` | «HCT >54% — флеботомия», «TT high → контроль PSA» (муж) | женские пороги (HCT 48/52; TT>6 = вирилизация → отмена/эскалация; PRL женский; E2 по фазе — с оговоркой) |

### §10.2 Аудит: вкладка «Анализы» — отображение и индикация

| # | Точка | Файл:строка | Сейчас | Женского нет |
|---|-------|-------------|--------|--------------|
| Л-1 | Справочник норм | `LabsScreen_parts/LabsCatalog.tsx:76-84` | min/max из `UCUM_MAP` (lln/uln) без пола | женские границы; описания гормонов мужские (`AMH:70`, `INHB:71`, `PSA:72`, `DHEA_S:69` — «сперматогенез/простата» без женского контекста) |
| Л-2 | Динамические границы T/TT/HCT/E2 | `core/constants.ts:440-447` (`UCUM_MAP.dynamic`) | `sexFactor` только у TT/HCT/E2; **HCT female ×0.85 применяется к ОБОИМ границам** (LLN 36→30.6 — заниженная анемия-граница; корректно 36–48) | Hb/RBC/ALT/AST/GGT/креатинин/ферритин/PRL вообще без пола |
| Л-3 | Статусы (стрелки, цвета, «отклонение») | `LabsScreen.tsx:443-444` (ULN/LLN из `refLow/refHigh`/LAB_MARKERS), `:1127-1128` (`isHigh/isLow` по муж порогам) | без пола | женские пороги в индикации |
| Л-4 | Точка «в норме» (sex-aware) | `LabsScreen.tsx:2263` (`normalizedRatio(..., profileSex)`) | работает, но только для dynamic-маркеров TT/HCT/E2 | расширить резолвер норм (единый `getLabNorm(code, sex)`) |
| Л-5 | Остальные части | `LabsScreen_parts/*` кроме `LabsTzRiskTab` — 0 упоминаний пола (`LabsResults`, `LabsOverview`, `LabDiaryTab`, `ExtendedLabsTab`, `LabsSchedule`, `LabsProblemPanelsTab`, `LabsInvestigations`) | муж нормы в таблицах/панелях/дневнике | женские нормы + бейдж «♀» |
| Л-6 | Роль-вид | `role-view.engine.ts:21-22` | ULN/LLN через тот же огрублённый `sexFactor` | уточнить женские границы |
| Л-7 | Клиническая база | `data/clinical-pathology-db.ts:67` (`Hematocrit ec50 52`) → `clinical-analyzer.engine.ts`, динамический импорт `RiskScreen.tsx:1528` | муж ec50 | женский ec50/сепаратор (осторожно — движок общий) |
| — | **Уже сделано (не дублировать)** | `risk-verification.engine` жен пороги+floors (`7ffd3e93`); `support-phase-labs` femaleNote K0/K2/K5/K7; `LAB_REFERENCES_FEMALE`+`getLabReference` (`b6f826cf`); TZ `clinicalFloorsForLabs/getMiFromLab(sex)` (§16.3); `LabsTzRiskTab` жен placeholder-нормы; `LabsScoreCard` получает `sex` (LabsScreen:1823) | | |

### §10.3 План P1 (женские риски по препаратам — фармакология)

1. **Ж1. Карточки порогов в RiskScreen**: адаптер `femaleDrugThresholdView(pedIds, sex)` (без новых чисел — из `FEMALE_AAS_PROFILES`/`assessFemaleAas`): при sex=female карточка «Пороги и препараты» (`RiskScreen.tsx:800+`) и `RiskOverview` показывают женские yellow/red, androgenIndex, «⛔ абсолютное противопоказание», дозо-индекс вирилизации; мужской путь 1-в-1.
2. **Ж2. Дозовые тиры движков**: резолвер `getDrugThreshold(id, sex)` (женский override из `FEMALE_AAS_PROFILES`: red → тир-эквивалент, contraindicated → жёсткая эскалация) → `computeDrugContributions` / `androgenicLoad` / `weekly-risk-dynamics` (пол уже течёт в `V7RiskInput.sex`/`TZRiskInput.sex`); lock мужского JSON байт-в-байт.
3. **Ж3. Женские патологии стека**: `mapStackToPathologies(drugs, sex?)` + 4–6 женских патологий (вирилизация, менструальный цикл, фертильность, либидо, кости/волосы) с source-текстами из `FEMALE_AAS_PROFILES`; `RiskScreen.tsx:1541` передаёт пол профиля; без sex — прежний результат.
4. **Ж4. Lab-pharma рекомендации**: `lab-pharma-correlation.engine.ts` — женские пороги (HCT 48/52; TT>6 = вирилизация; PRL женский; E2 фаза-зависимо — честная оговорка «интерпретация по фазе цикла»).
5. **Ж5. Честные подписи**: у женских строк/карточек — бейдж «♀ женские пороги (1/4–1/10 мужских)», источник (`FEMALE_AAS_PROFILES`) и кросс-ссылка «Женщины и ААС → Дозы/Лабы»; женские алерты не дублировать в двух местах (правило Д3).

### §10.4 План P2 (вкладка «Анализы» — отображение и индикация)

1. **Л8. Единый резолвер норм**: `getLabNorm(code, sex)` (новый, поверх `LAB_REFERENCES_FEMALE` (уже есть) + `FEMALE_LAB_GROUPS`) → `LabsCatalog` (женские min/max + чип «♀»), `LabsScreen` статусы (443-444/1127-1128), `role-view` (замена симметричного ×0.85 на асимметричные женские границы: HCT 36–48, Hb 120–150, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ULN 31, креатинин ≤97, ферритин ≤200).
2. **Л9. Индикация**: легенда «♀ пороги по полу» в шапке списка анализов + бейдж «♀» у строк с женскими границами; нейтральные описания гормонов (`AMH/INHB/PSA/DHEA_S`) с «у мужчин / у женщин».
3. **Л10. Панели/дневник**: `LabDiaryTab`/`ExtendedLabsTab`/`LabsOverview` — строка-пометка femaleNote (по образцу K-карточек) и переход на женские нормы; `LabsResults` — женские границы в таблицах.
4. **Л11. Клинический contур**: `clinical-pathology-db` — женские ec50 для HCT/гемато (или честный сепаратор), только при sex=female; муж путь байт-в-байт.
5. **Осознанно вне**: фазовые женские нормы E2/прогестерона по фазам цикла (нужна фазовая модель — §16.3/§10.5), notification-engine (отложено ранее).

### §10.5 Критерии готовности (фаза 2)

- Мужской путь байт-в-байт: JSON-lock на `computeDrugContributions`/`mapStackToPathologies`/`getLabNorm`/`DRUG_THRESHOLDS`-строки; UI-тесты «♀ видно при female / скрыто при male».
- Каждый пункт — с тестом; финал: support/risk-круг + labs-круг + `tsc --noEmit` (12GB) + `verify:apk-design`; коммиты строго pathspec; пуш — только при чистой очереди.

---

## §11. Стартовый промпт для новой сессии (женские риски препаратов + «Анализы»)

> Скопировать агенту в новую сессию (контекст — §10 этого файла + §16 `FEMALE_AAS_PROTOCOLS.md`).

```
Проект: D:\BodyBuildHealth. Выполни «Фазу 2 женского слоя» из docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md (§10):

P1 — риски по препаратам (фармакология), адаптировать под женщин:
1) Ж1: RiskScreen карточка «Пороги и препараты (ААС, ГЧ, инсулин)» (RiskScreen.tsx:773-814) и таблица RiskOverview.tsx:273-281 — при sex=female показывать женские пороги из ЕДИНОГО источника FEMALE_AAS_PROFILES/assessFemaleAas (engines/female-aas-risk.ts:31/92): yellow/red мг/нед, androgenIndex, «⛔ абсолютное противопоказание», дозо-индекс вирилизации; мужской путь 1-в-1; бейдж «♀ (1/4–1/10 мужских)» + ссылка на таб «Женщины и ААС»;
2) Ж2: женские дозовые тиры в контурах — getDrugThreshold(id, sex) поверх DRUG_THRESHOLDS_V7 (risk-engine-v7-matrix.ts:144+; computeDrugContributions ~:978) и androgenicLoad (risk-engine-v7-extensions.ts:124-154), weekly-risk-dynamics; пол уже в V7RiskInput.sex/TZRiskInput.sex; мужской JSON байт-в-байт (lock-тест);
3) Ж3: женские патологии стека — mapStackToPathologies(drugs, sex?) (engines/drug-mapper.engine.ts; вызов RiskScreen.tsx:1541-1567): вирилизация, нарушение цикла, фертильность, либидо, кости/волосы (тексты из FEMALE_AAS_PROFILES, без новых чисел); без sex — как раньше;
4) Ж4: lab-pharma рекомендации (engines/lab-pharma-correlation.engine.ts:123-168) — женские пороги: HCT 48/52, TT>6=вирилизация, PRL женский, E2 по фазе с оговоркой;
5) Ж5: честные подписи/кросс-ссылки; алерты не дублировать (правило Д3 из §7).

P2 — вкладка «Анализы»: отображение и индикация под женщин:
6) Л8: единый getLabNorm(code, sex) поверх LAB_REFERENCES_FEMALE (risk-engine-v7-matrix, уже есть) + FEMALE_LAB_GROUPS → LabsCatalog.tsx:76-84 (женские min/max + «♀»), LabsScreen.tsx:443-444/1127-1128 (статусы), role-view.engine.ts:21-22 (заменить симметричный HCT ×0.85 на женские границы 36–48, Hb 120–150, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ULN 31, креатинин ≤97, ферритин ≤200);
7) Л9: легенда «♀ пороги по полу» + бейдж у строк; нейтральные описания AMH/INHB/PSA/DHEA_S;
8) Л10: femaleNote-строка в LabsOverview/LabDiaryTab/ExtendedLabsTab/LabsResults;
9) Л11: clinical-pathology-db женский ec50 для гемато (или сепаратор) — осторожно, движок общий.

Правила проекта (обязательны): только Edit/Write + vitest/tsc; НЕ трогать чужие файлы; коммиты строго `git commit -m "…" -- <свои файлы>` (pathspec); после любых скриптов перечитывать файл перед Edit; НЕ использовать PowerShell для правок файлов; чекаут запрещён; каждый пункт — с тестом; мужской путь без sex — байт-в-байт (JSON-lock + UI «♀ скрыто при male»); финал: support/risk+labs-круг + `tsc --noEmit` (NODE_OPTIONS=12GB) + `verify:apk-design`; пуш — только когда очередь origin/main..HEAD состоит ТОЛЬКО из своих коммитов.

Напоминание (сделано, не дублировать): женские пороги risk-verification (`7ffd3e93`), v7-LAB_REFERENCES женские (`b6f826cf`), TZ женские floors/m_i (§16.3, `2f02892c`), K-карточки femaleNote, спиронолактон/дозы/фертильность (§6.4, `7ffd3e93`).
```

---

## §12. Механизм-ориентированная модель как единственная база риска (ноябрь 2026)

> **Статус: ✅ ВЫПОЛНЕНО КОДОМ (без коммита/пуша по правилу проекта).**
> Цель: привести ВСЕ препараты и ВЕСЬ каталог БАД к модели 28 механизмов (`risk-engine-tz-spec.ts`) — остальные контуры подчинены ей, а не наоборот.

### Что было сломано (по факту кода)
1. **67 из 521 веществ каталога** молча давали `0` вклада в покрытие риска: регистровые дубли (`NAC`, `TUDCA`, `VITAMIN_E`) и 15 реальных пробелов (цинк, селен, куркумин, AI/SERM). Модель искала поддержку по точному ключу `SUPPLEMENTS_DB`/`PHARMACY_DB`.
2. **Препараты без `DRUG_DB`** (hgh, clenbuterol, t3/t4, sustanon, test_susp, methenolone_acetate) давали 0 во все механизмы → экран показывал «риск 0 % / покрытие 100 %».
3. **Флажки GH/IGF/инсулин** входили в модель с ХАРДКОДОМ дозировки (`cjc1295 300`, `igf1_lr3 100`, `ins_short 10`), а не с реальной дозой попапа.
4. **Длительность курса** была искусственной (12 нед) вместо самого длинного препарата списка.
5. **Единицы доз**: UI подписывал всё «мг» → 200 мкг селена как «200 мг» (×1000), 5000 МЕ витамина D как «5000 мг».
6. **Снапшот входа** `he_calc_tz_input` писался в `useMemo` без подписи состава → «Риски» до 24 ч показывали СТАРЫЙ курс после его изменения.
7. **Удалённые вещества** плана возвращались при пересчёте (менеджер веществ не влиял на итог).
8. Легаси `support.engine.systemSupport` отдавал веса (0–1) вместо процентов → `data-link`/`calculateRisks` занижали защиту ≈ в 6.7 раза.

### Что сделано
- **`src/data/support-db/mech-map.ts` (новый)** — единый резолвер `id → 28 механизмов`: кураторская запись → явные доработки (`EXTRA_SUPPORT_MECHS`) → производная оценка из каталога (`deriveFromCatalog`, всегда `q='C'`, `k ≤ 0.12`, `source = DERIVED_SOURCE`). Кураторские записи НЕ перетираются. `listUnmappedSupportIds()` = `[]`.
- **`DRUG_DB`** +7 препаратов (`hgh`, `clenbuterol`, `t3`, `t4`, `sustanon`, `test_susp`, `methenolone_acetate`); `TzDrugClass` += `thermo`/`thyroid`/`glp1`/`sarm`/`pct`; `getDoseFactor` для новых классов.
- **`risk-engine-tz-spec.ts`** — `riskStatus: 'ok'|'partial'|'no_data'`, `unmodeledDrugs`, `unmappedSupport` (честный отказ от цифр вместо «0 %»); `supportLookup` через `getSupportMechs` (исправлен баг: `[]` truthy ломал fallback на `PROCEDURE_DB`).
- **`engine-helpers.buildTzInput`** — реальные дозы (`ghIU`/`insulinIU`/`igfMcg`/`clenMcg`/`t3Mcg`), класс из `DRUG_DB`, длительность = max(weeks), дедуп по канону; `extractLabValues` с CKD-EPI 2021; `checkUpperLimits(..., rawDoses)` видит превышение UL до капа; `applyTitration(..., rawDosesOut)` отдаёт сырые дозы наружу.
- **`src/data/dose-units.ts` (новый)** — одна единица на вещество (`мг`/`мкг`/`МЕ`/`Ед`/`млрд КОЕ`); витамин D внутри в мкг, отображение в МЕ при ≥1000.
- **`src/engines/tz-snapshot.ts` (новый)** — `courseSignature` (id+доза, без порядка/дублей, с алиасами), запись снапшота в `useEffect`, TTL 24 ч, старый формат без `sig` принимается.
- **`src/data/support-names.ts` (новый)** — общий резолвер русских имён (`supportNameRu`/`supportNamesRu`) для Тренировок/Хаба/отчётов.
- **UI**: менеджер веществ (`toRemove` только по видимым id через `NON_PILL_SUPPORT_IDS`, «↺ Сбросить правки», сохранение состава в избранное, автосейв с merge journal/labs), `excludedSubs` (удалённое не возвращается), честный текст при `no_data`, `RiskTimelineChart`, дозы через `formatDose`/`formatDefaultDose`.
- **Читатели `he_support_plan_result`** (Тренировки/Хаб/Дневник/Питание/Отчёт) — массив id; объект `{substances}` поддержан только как legacy-ветка.
- **Легаси `support.engine`** — `systemSupport` в реальном проценте (0..95), веса только для средней.

### Тесты-гарды (новые)
- `src/data/__tests__/mech-map-coverage.test.ts` (9): 0 непокрытых веществ, индекс = весь каталог, механизмы ∈ 28, кураторские записи не перетёрты, производные `q='C'/k ≤ 0.12`, каждый препарат `PHARMA_DB` резолвится в `DRUG_DB`.
- `src/data/__tests__/dose-units.test.ts` (15): единицы по веществам, «200 мкг ≠ 200 мг», D3 мкг↔МЕ, мг-шкала каталога → мкг/МЕ/г (`formatDoseFromMg`), `toMgEquivalent`.
- `src/engines/__tests__/tz-snapshot.test.ts` (8): подпись (порядок/дубли/алиасы), совпадение/несовпадение/legacy/TTL/мусор.
- `src/engines/__tests__/tz-risk-status.test.ts` (5): `ok`/`partial`/`no_data`, `unmodeledDrugs`, `unmappedSupport`, NAC не увеличивает риск.
- `src/engines/__tests__/build-tz-input.test.ts` (8): реальные дозы попапов, классы/форма из `DRUG_DB`, длительность из курса, дедуп, `null` без препаратов.
- `src/engines/__tests__/support-dose-display-units.test.ts` (5): дозы плана/расписания в натуральной единице (селен мкг, D3 МЕ), крупные мг → г, «по инструкции» вместо выдуманного «500 мг».
- `src/data/__tests__/support-names.test.ts` (6): резолвер имён.
- `src/engines/__tests__/comprehensive-report.test.ts` (+3 в третьем проходе): план из id → русское имя + единица по веществу (`vitamin_d3` = МЕ, `selenium` = мкг) без дублей; GH в курсе — «МЕ», а не «мг»; старая запись `doseUnit='g'` не даёт «5000 г».
- `src/engines/__tests__/bioequivalence-units.test.ts` (3): единица в предупреждении о дозе замены (по умолчанию «мг», переданная `мкг` соблюдается, ±20 % без предупреждения).
- `src/engines/__tests__/support-genetics-diet.test.ts` +1: пометка «уже принимаете» подписана единицей вещества (селен — мкг), крупные мг — в граммах.
- `src/ui/screens/RiskScreen_parts/__tests__/risk-spec-honesty.test.tsx` (3): механизм-модель показывает «Расчёт неполный / Риск НЕ рассчитан» и список не смоделированных препаратов.

### Догон: единицы доз в отображении (второй проход)
Найдено чтением кода (grep `dosage.mg` + `мг`-шаблоны) — все места, где доза подписывалась «мг» независимо от вещества:
- `dose-units.ts` — две разные шкалы разведены явно: `DEFAULT_DOSAGES` = натуральная единица (`formatDefaultDose`), `SUPPORT_CATALOG_DATA[id].dosage.mg` = миллиграммы (новый `formatDoseFromMg`: 0.2 мг селена → «200 мкг», 0.125 мг D3 → «5000 МЕ», ≥1000 мг → «г», hcg/пробиотики — уже в МЕ/млрд КОЕ). Крупные мг теперь и в `formatDefaultDose` показываются в граммах.
- Убран выдуманный «ФЕ»: наттокиназа/серрапептаза дозируются в МГ (100 мг ≈ 2000 ФЕ), поэтому `doseUnit` возвращает «мг», а не «ФЕ»; литерал `nattokinase:'2000 ФЕ'` в `engine-helpers` → `'100 мг'`.
- Пробиотики: «капс» → «млрд КОЕ» (значение 20 — это 20 млрд КОЕ, а не 20 капсул).
- Исправлены точечные ошибки: `SupportScreen` карточка каталога (`mg<1 → «мкг»` без ×1000 давало «0.2 мкг» вместо 200 мкг; `≥1000 → «г»` без деления давало «2000 г»), `buildSubstances`/`buildSchedule` (селен «200 мг» → «200 мкг», D3 «5000 мг» → «5000 МЕ», выдуманное «500 мг» при отсутствии данных → «по инструкции»), `SupportFavoritesView` (таблица плана и корзина: доза в корзину писалась ЧИСЛОМ в мг-шкале, хотя все остальные писатели кладут строку), share-текст плана, `SupportDiaryView`, `SupportStacksView`, `DosageCalculator`, `recommendation-engine`, `score-engine`, `supplement-optimizer`.

### Догон: единицы доз в отображении (третий проход — отчёты, аналоги, курс)
Тот же класс ошибок, но уже на «выходе» данных: доза хранится в натуральной единице, а подпись — «мг».
- **`comprehensive-report.engine` (раздел «Поддержка»)** — план из `he_support_plan_result` попадал в отчёт СЫРЫМИ id (`selenium`, `zinc_sup`) и с `doseMg: 0` («—» вместо дозы). Теперь: русское имя через `supportNameRu`, типовая доза из `DEFAULT_DOSAGES`, единица — через локальный `unitOf(id, raw)` (приоритет `defaultDoseUnit`, т.к. число в профиле/дефолтах в натуральной единице; сохранённая подпись `mcg`/`IU` берётся только для мкг/МЕ; `'g'` игнорируется — историческая подпись без пересчёта значения давала «5000 г»). План не дублирует уже добавленные из профиля вещества.
- **Курс в отчёте** — GH подписывался «8 мг» вместо «8 МЕ»: `doseDisplay` теперь `${doseMg} ${unitOf(id)}` (AAS — мг, GH/ХГЧ — МЕ, клен/Т3 — мкг).
- **`SupportScreen` (запись `nutrition.currentSupplements`)** — убран мусорный тернарник `doseMg` и подстановка `doseUnit='g'` при `dosage.mg >= 5000` БЕЗ деления значения (в отчёте это давало «5000 г»). Пишем ровно натуральную единицу: `мкг → 'mcg'`, `МЕ → 'IU'`, иначе `'mg'`; число не пересчитываем.
- **`SupportAnalogCalculator`** — `SUBSTANCE_ANALOGS[].mg` хранит натуральную единицу (D3 5000 = МЕ, селен 200 = мкг, пробиотики 20 = млрд КОЕ), а UI писал «200 мг» / «5000 мг». Теперь `formatDefaultDose(id, …)` для замены и рекомендуемой дозы.
- **`bioequivalence-base.validateReplacementDose`** — новый опциональный параметр `unit` (по умолчанию `'мг'`): текст предупреждения больше не приписывает «мг» дозам в мкг/МЕ. Вызывающий `biostack-clinical-v2` передаёт `defaultDoseUnit(cid)`.
- **`biostack-clinical-recommender`** — fallback-доза из каталога подписывалась «мг» независимо от источника: `DEFAULT_DOSAGES` → `formatDefaultDose`, `catalog.dosage.mg` → `formatDoseFromMg`.
- **`comprehensive-report-html` / `ReportsScreen`** — доза больше не «200мкг» слипшись: `${doseMg} ${unit}`.

### Догон: остаточные «мг»-подписи (четвёртый проход)
Сплошной поиск по шаблонам `${…} мг` с переменными доз — остатки того же класса:
- `support-genetics-diet.engine` — пометки «учёт принимаемых добавок» («уже принимаете 200 мг» для селена, «1000 из 2000 мг» для омеги): `formatDefaultDose` по веществу; крупные мг → г. Тест обновлён (`1 г из 2 г`) + новый гард «селен — мкг, а не мг».
- `ClinicalResultCard` (карточка клинической замены) — `rep.doseMg`/`recommendedDoseMg` из `SUBSTANCE_ANALOGS` тоже натуральные: через `formatDefaultDose`.
- `support-plan/engine-helpers.adjustForBioavailability` — «доза скорректирована: 500 мг» для мкг-веществ: `formatDefaultDose`, и в текст попадает УЖЕ клампленная доза (раньше было неклампленное значение, т.е. текст расходился с планом).
- `data/support-substances` (бэкфилл описаний) — «Доза: 0.2 мг» из мг-шкалы каталога → `formatDoseFromMg` («200 мкг», D3 «5000 МЕ»).
- `supplement-finder.estimateDose` — «0.2 мг/день (0.003 мг/кг)» для селена: единица через `formatDoseFromMg`, а «мг/кг» показываем только для веществ в мг-шкале (для мкг/МЕ/млрд КОЕ пересчёт на кг бессмыслен).
- Проверено и оставлено как есть: `training-plan-save` (`mg` — реальные миллиграммы спортивного стека: кофеин, креатин), `hydration`/`bb-*` (натрий/калий — мг), `pct-planner` (кломифен/тамоксифен — мг), `tz-mapper-engine` (телмисартан/TUDCA/NAC — мг).

### Догон: честность в «Рисках» (пятый проход)
Поля `riskStatus`/`unmodeledDrugs` писались калькулятором, но экран «Риски» их не читал.
- `RiskSpecMethod` (вкладка «Механизм-ориентированная») — `calculateTzSpecRisk` возвращает `riskStatus`, а UI показывал только проценты: препарат без записи в `DRUG_DB` не даёт вклада, и «низкий риск» читался как «всё безопасно». Теперь при `partial`/`no_data` — плашка «Расчёт неполный / Риск НЕ рассчитан» со списком не смоделированных препаратов.
- `RiskScreen` (страница «Общий риск» в «Других методах») — читает `he_support_risk.riskStatus`/`unmodeledDrugs` (SupportScreen их писал, никто не читал) → та же плашка над карточкой общего риска.
- Новый гард `risk-spec-honesty.test.tsx` (3): неизвестный препарат → «НЕ рассчитан» + id; смешанный курс → «Расчёт неполный»; полностью известный курс → плашек нет.

### Догон: честность производного покрытия (шестой проход)
Пятый проход закрыл «препараты не смоделированы», но остался второй источник выдуманной уверенности: **поддержка**. У 454 из 521 вещества каталога нет кураторской записи механизмов — k/q выводятся из токенов каталога (`mech-map.deriveFromCatalog`, q='C', k≤0.12). Эти проценты попадали в «Kp», в план и в отчёты без единой пометки.
- `risk-engine-tz-spec` → `TzSpecResult.derivedSupport: string[]` (вещества, у которых ХОТЯ БЫ один механизм из `DERIVED_SOURCE`) + строка в `explanation`; `support-plan/engine` → `CalculatorResult.derivedSupport` (для UI SupportScreen).
- `SupportScreen` → `he_support_risk.derivedSupport` и `risk-bridge.supportDerived`.
- UI: `TzRiskCard` (калькулятор) и `RiskSpecMethod` (вкладка «Механизм-ориентированная») — фиолетовая плашка «Оценочно (механизмы выведены из каталога, q=C, k≤0.12 — не доказательная база)» со списком; `RiskScreen` (Общий риск) — та же плашка из `he_support_risk`.
- `CalcSubstanceDetail` — у вещества без кураторской записи «док. C» получает «(оценка)», а над чипами механизмов — «оценочно — механизмы выведены из каталога»; `Calc.mapper` (текстовый экспорт для врача) — «уровень доказательности: C (оценка по каталогу)».
- Отчёт: «Эффективность поддержки» получает `note` «Оценочное покрытие (q=C…): …» из моста.
- Экспорт для врача (`Calc.mapper`): «СИСТЕМНЫЕ РИСКИ» дополняются предупреждением о неполном/нерасчитанном риске и списком оценочных веществ; запись `he_support_risk` из калькулятора теперь несёт `unmodeledDrugs`/`unmappedSupport`/`derivedSupport` — тем же контрактом, что SupportScreen.
- **Найден и исправлен целый ложный «0%»**: вкладка «Риски (ТЗ)» в лабораториях (`LabsTzRiskTab`) считала движок с `drugName:'custom'`, которого нет в `DRUG_DB` → все веса 28 механизмов = 0 → «0% → 0%» как безопасный курс. Теперь у класса есть препарат-модель (`REP_DRUG`: `test_enan`/`hgh`/`ins_short`), смена класса ставит типовую дозу и показывает единицу (мг/нед, МЕ/сут, Ед/сут), а плашки неполноты/оценочности выводятся под результатом.
- `LabsScreen` (карточка «Риски (ТЗ)» в анализах): без курса движок больше не считается (было «0% → 0%» с тем же `'custom'`) — честное «Добавьте препараты в курс»; с курсом добавлены плашки `riskStatus`/`derivedSupport`.
- Новый гард `labs-tz-risk-class-model.test.tsx` (3): все `REP_DRUG` существуют в `DRUG_DB` с непустыми весами механизмов, расчёт по классу даёт риск > 0 и не пишет «НЕ рассчитан».
- Новый гард `dose-scale-consistency.test.ts` (4): сверка `DEFAULT_DOSAGES` (натуральная единица) с `SUPPORT_CATALOG_DATA[id].dosage.mg` (мг) по всем 61 пересекающимся id — ловит будущую «×1000» при добавлении доз; плюс явные кейсы selenium/D3.
- Новые гарды: `tz-risk-status.test.ts` +4 (производное вещество попадает в `derivedSupport`, NAC — нет, неизвестное — нет, `explanation` помечает), `tz-risk-card-derived.test.tsx` (3), `comprehensive-report.test.ts` +2 (note есть/нет).

### Догон: «доза = натуральная единица» и честность сохранённого плана (седьмой проход)
Шестой проход закрыл пометки оценочности, но остался класс ошибок масштаба в **дозах плана** и в **сохранённых планах**.

Дозы плана (`PlanSubstance.doseMg`, `PlanResult.dosages[id].mg`) читаются UI и шерингом через `formatDefaultDose` (натуральная единица: мкг/МЕ), а фолбэк брал `SUPPORT_CATALOG_DATA[id].dosage.mg` — МИЛЛИГРАММЫ:
- `support-plan/substances.ts` — фолбэк каталога переводится в натуральную единицу (`naturalFromMg`, `dose-units.ts`); weight-based дозы считаются в мг, но в `doseMg` попадают уже приведёнными. Биотин «5 мг» из каталога показывался как «5 мкг» (1000× ниже), йод — «0.15 мкг» вместо 150 мкг.
- `biostack-clinical-recommender.ts` — тот же фолбэк (+ канонизация id: алиас больше не теряет дозу из `DEFAULT_DOSAGES`), подпись всегда `formatDefaultDose`.
- `Calc.mapper.subDosage` (калькулятор) — предпочитала каталожную мг-дозу и отдавала её в `formatDefaultDose`/сравнение с фактическим приёмом: селен «0.2 мкг», D3 «0.13 МЕ», а `applyDietAwareToRecSubs` считал 5 мкг биотина «полностью перекрытыми». Теперь `naturalFromMg`; `CalcSubstanceDetail` и чипы состава подписывают через `formatDefaultDose` (титрация больше не переключает на мкг-форматтер).
- `SupportStacksView` — дозы сохранённого стека (`effectiveLevel.dosages`, натуральная единица) подписывались `formatDoseFromMg` (мг-шкала): селен 200 мкг превращался в «200000 мкг». Теперь `formatDefaultDose`.
- `engine-helpers.adjustForBioavailability` — доза приходит из titration-карты, где витамин D в МКГ: подпись «доза скорректирована: 34 МЕ» (вместо ~1360 МЕ) из-за `formatDefaultDose`. Теперь `formatDose` (+ мг округляется до целого). Заодно убрана строка «доза скорректирована: —» у веществ без титрованной дозы.

Честность сохранённого плана:
- `PlanResult` теперь несёт `riskStatus`/`unmodeledDrugs`/`derivedSupport` (из `CalculatorResult`) — шеринг плана («Риск: X% → Y%») больше не выглядит доказанным: под процентами идут «⚠ Риск НЕ рассчитан…» / «⚠ Расчёт неполный: не смоделированы — …» и «ℹ Оценочное покрытие (q=C): …».
- `savePlan` («Мои планы») сохранял только level/subs/dosages/date/riskBefore/riskAfter — список показывал «undefined · нед. undefined · Покрытие: NaN/100». Теперь пишутся `id`/`name`/`week`/`supportScore`/`riskStatus`/`unmodeledDrugs`/`derivedSupport`; карточка плана читает их и показывает плашки неполноты/оценочности, а для старых записей честно считает покрытие как `100 − риск` (без «NaN»).

Тесты-гарды (новые/расширенные):
- `dose-scale-consistency.test.ts` +1: для ВСЕХ позиций каталога `formatDefaultDose(id, naturalFromMg(id, catMg))` совпадает с `formatDoseFromMg(id, catMg)` — «одна и та же физическая доза» (ловит будущую ×1000/×40 на любом добавленном веществе).
- `plan-dose-units.test.ts` (7): биотин/йод/BPC-157 в мкг, B3 в мг, бетаин в граммах, D3 приоритет `DEFAULT_DOSAGES`, расписание подписывает те же единицы.
- `calc-sub-dosage-units.test.ts` (5): `subDosage` отдаёт натуральную единицу (селен 200, D3 5000, биотин 5000, NAC 600) и `null` для неизвестного.
- `bioavailability-units.test.ts` (4): «доза скорректирована» для D3 — в МЕ и > 500; строки «—» нет ни у одной позиции; мг-вещества — в мг.
- `support-calc-e2e.test.ts` +3: `riskStatus='ok'` для известного курса, `no_data` + `unmodeledDrugs` для неизвестного препарата, `derivedSupport` — массив строк.
- `fav-plan-source.test.tsx` +2: сохранённый план с `riskStatus='partial'`/`derivedSupport` подписан плашками и показывает «нед. 4»/«70/100»; старый план без `supportScore`/недели не содержит «NaN»/«undefined».

### Догон: покрытие каталога — что реально покрыто, а что «не поддержка» (восьмой проход)
Седьмой проход закрыл шкалы, но проверка «весь каталог → 28 механизмов» держалась на тесте, который читал каталог БЕЗ `support-catalog-init`. В приложении init выполняется, и там 20 записей каталога не давали ни одного механизма:
- 3 исторических дубля (`metformin_dup`, `levothyroxine_dup`, `liothyronine_dup`) — запись живёт под каноническим id, а резолвер `mech-map` не смотрел глобальные алиасы. Теперь `getSupportMechs`/`isCuratedSupport` падают в `canonId` (из `shared-constants`), если по прямому ключу пусто.
- 16 настоящих сопутствующих препаратов (НПВС: ibuprofen/naproxen/celecoxib; ГКС: prednisone/dexamethasone/hydrocortisone/methylprednisolone; антиконвульсанты: carbamazepine/phenytoin; иммунодепрессанты: tacrolimus/cyclosporine/mycophenolate/azathioprine; гормоны: estradiol/cortisol/glucagon) + служебная запись `pharma`. Они в каталоге ради взаимодействий/противопоказаний и НЕ являются поддержкой: давать им k-покрытие значило бы записывать НПВС в «снижатели риска». Введены `CONCOMITANT_ONLY_IDS`, `isSupportSubstanceId()`; `listUnmappedSupportIds()` теперь возвращает только реальные пробелы поддержки (=0).
- UI больше не смешивает два разных «не учтено»: `TzRiskCard` показывает «Не участвуют в покрытии (нет привязки к 28 механизмам)» только для веществ поддержки, а сопутствующие препараты — отдельной строкой «учитываются во взаимодействиях, не в покрытии». То же разделение в `explanation` механизм-модели (уходит в отчёт/PDF).
- Экран «Как работает»: вместо выдуманной строки «Все 435 мех-веществ имеют каталог-описания (полное покрытие)» — цифры из данных: сколько веществ поддержки, сколько кураторских и сколько оценочных (q=C) записей, сколько сопутствующих препаратов и сколько реальных пробелов.
- Карточка вещества в калькуляторе (`CalcSubstanceDetail`) для сопутствующего препарата прямо пишет «не участвует в покрытии риска: учитывается во взаимодействиях и противопоказаниях» — пустой список механизмов больше не читается как «нет данных».
- `AutoCalculator`: если механизм-модель недоступна и показана старая системная модель, проценты подписаны «⚠ … модель V7 (не сверена с 28 механизмами)».
- «Мои расчёты»: старые записи `calcResult` без `riskStatus` подписаны «ℹ расчёт без статуса риска (старый формат)», а с `partial`/`no_data` — «⚠ риск неполный: <препараты>».
- Тест покрытия теперь импортирует `support-catalog-init` (как приложение) и проверяет обе стороны: у веществ поддержки механизмы есть, у объявленных сопутствующих — нет (если сопутствующий вдруг получит покрытие, тест упадёт и потребует обновить классификацию).

Тесты: `mech-map-coverage` +3 (сопутствующие — единственные без механизмов, `*_dup` резолвятся, индекс покрывает все id поддержки), `support-geninfo-coverage` (4), `tz-risk-card-derived` +3 (пробел vs сопутствующий vs смешанный список), `calc-substance-detail-concomitant` (2), `fav-plan-source` +1 (старый расчёт без статуса / с неполным риском), `support-risk-contract` (4 — оба писателя `he_support_risk` обязаны передавать `riskStatus`/`unmodeledDrugs`/`derivedSupport`/`unmappedSupport`).

### Догон: «покрытие» — это не «100 − остаточный риск» (девятый проход)
Восьмой проход закрыл «что покрыто», но осталась подмена величины: везде, где UI писал «Покрытие: 70/100», реально показывался `100 − риск после` (риск-скор), а не доля закрытых механизмов. При риске 40% → 25% это читалось как «всё покрыто», хотя 6 из 19 механизмов риска могли остаться без поддержки.
- `mechanismCoverageOf(tz)` в `risk-engine-tz-spec` — единственный источник честного покрытия: знаменатель — механизмы, которые ДАЮТ риск в этом расчёте (`raw > 0`), числитель — те, у которых `k_used > 0`. Механизмы, не относящиеся к курсу, знаменатель не размывают.
- Поля-контракты: `PlanResult.mechanismCoverage`, `CalculatorResult.mechanismCoverage`; `coveragePercent`/`supportScore` оставлены (совместимость), но задокументированы как «100 − остаточный риск» и в UI больше не называются «покрытием».
- UI: «Мои планы» — «Снижение риска: 70/100» + строка «Механизмы: 3 из 6» (только когда поле есть — старые записи не рисуют пустую строку); «Мои расчёты» — то же из `calcResult.mechanismCoverage`; шеринг плана — «Риск: A% -> B% (снижение N п.п.)» + «Покрытие механизмов: X% (c из t)» вместо «Покрытие: 100 − риск%»; карточка риска (`TzRiskCard`) — «Механизмы: c/t закрыто» рядом с `Kp`.
- `savePlan` пишет `mechanismCoverage`, чтобы сохранённый план не пересчитывал покрытие из риска.
- Страховка: покрытие не считается при `no_data` (механизмов риска нет) — 0/0, а не «100%».

Тесты-гарды:
- `support-calc-e2e.test.ts` +5: `mechanismCoverageOf` считает только `raw>0` (1/2), `null`/пустой результат → `0/0/0` (не `NaN` и не 100%), план и калькулятор отдают одно и то же покрытие, курс с поддержкой реально закрывает ≥1 механизм, неизвестный препарат → `0%` (а не «всё покрыто»).
- `tz-risk-card-derived.test.tsx` +2: строка «Механизмы: 1/2 закрыто» по механизмам с риском; при `no_data` строки нет.
- `fav-plan-source.test.tsx` +2/−0: сохранённый план с `mechanismCoverage` показывает «Снижение риска: 70/100» и «Механизмы: 50% (3 из 6)»; старый план без поля не содержит «Механизмы:».

### Догон: план больше не заявляет ложное покрытие механизмов (десятый проход)
Девятый проход дал честную метрику (`mechanismCoverage`), но внутри плана остался **второй, врущий источник**: `PlanResult.mechanisms` строился по органу — любое вещество поддержки с `organId` системы объявлялось покрывающим ВСЕ механизмы этой системы. `WeeklyPlanView` выводил их как «🎯 Механизмы с покрытием (28)» сырыми ключами `cardio.cv1`, а непокрытые механизмы (`uncoveredMechanisms` движок считал) не показывал вообще.
- `support-plan/systems.buildMechanisms` — теперь из механизм-модели: только механизмы с риском (`raw > 0`), покрытие — по `k_used` (тот же критерий, что `mechanismCoverageOf`), вещества — точное сопоставление через единый резолвер `mech-map` (`getSupportMechs` + `PROCEDURE_DB`) с учётом синергетических трио движка (плазма/фибринолиз). Старое системное сопоставление осталось только фолбэком, когда `tzSpecResult` недоступен.
- `PlanMechanism` += `covered?: boolean` (k > 0) и `confidence?: 'A'|'B'|'C'` (лучшая доказательность среди покрывающих веществ); `uncoveredMechanisms` строится как дополнение покрытых (без порога «> 5», отсортировано по риску).
- `WeeklyPlanView`: «🎯 Закрыто X из N механизмов риска (Y%)» + русские подписи механизмов вместо сырых ключей; отдельный жёлтый блок «⚠ Не закрыто (M): поддержка не даёт k этим механизмам» с риском каждого механизма (топ-8, «+N ещё»).
- Шеринг плана: строка «⚠ Не закрыто механизмов риска: M — …» со списком самых рискованных (до 5) — план больше не выглядит так, будто закрывает всё.
- Покрытие механизмов доведено до всех поверхностей риска: `RiskSpecMethod` (вкладка «Механизм-ориентированная») — чип «Механизмы: c/t закрыто» рядом с `Kp`; оба писателя `he_support_risk` (SupportScreen и Calc.mapper) передают `mechanismCoverage` — контракт-гард расширен; `RiskScreen` читает `he_support_risk.mechanismCoverage` и передаёт в обе ветки `RiskOverview` («🎯 Механизмы риска: закрыто c из t» внутри секции — отдельно от доли снижения риска; при `total = 0` строки нет).
- `RiskOverview`: секция «Покрытие поддержкой» переименована в «Снижение риска поддержкой» с пояснением «доля снижённого риска по системам — не доля закрытых механизмов»: число там считается как `(raw − net)/raw` и «покрытием» больше не называется.
- Инвариант: `plan.mechanisms.length === mechanismCoverage.total`, покрытых — ровно `mechanismCoverage.covered`, непокрытые ∩ покрытые = ∅.

Тесты-гарды:
- `plan-mechanisms.test.ts` (7): список = механизмы риска (совпадает с `mechanismCoverage.total/covered`), проценты одинаковы во всех полях, ключи — реальные id модели (не «cardio.cv1»), покрытый механизм называет вещества, реально дающие ему k (`getSupportMechs`/процедуры/трио), `uncoveredMechanisms` — точное дополнение без пересечений и повторов, сортировка по риску, уровень «max» не закрывает меньше, чем «basic».
- `weekly-plan-mech-coverage.test.tsx` (4): «Закрыто 2 из 3 (67%)» + непокрытый в отдельном блоке с риском, сырые ключи не показываются, при полном покрытии блока «Не закрыто» нет, усечение списка с «+N ещё».
- `support-risk-contract.test.ts` +3: `mechanismCoverage` обязаны передавать оба писателя `he_support_risk`, `RiskScreen` — прокидывать его в обе ветки `RiskOverview`, а `RiskOverview` — не рисовать «0 из 0» и держать подпись «Механизмы риска» отдельно от «Снижения риска поддержкой»; `RiskOverviewCoverage.test.tsx` — заголовок секции «Снижение риска поддержкой» (обновлено осознанно, т.к. старое имя выдавало долю снижения за покрытие) + 2 теста на строку покрытия механизмов; `risk-spec-honesty.test.tsx` +1: чип «Механизмы: c/t закрыто» рядом с `Kp`; `fav-plan-source.test.tsx` +1: план с `covered: 0, total: 0` не рисует «Механизмы: 0%».

### Догон: UL считается по фактическим дозам плана, а не по каталогу (одиннадцатый проход)
Движок `checkUpperLimits` давно считал превышения честно — по фактическим дозам после нормализации на вес и видел, что UL-кап срезал дозу, — но `PlanResult` это поле не содержал, и экран поддержки его не выводил. «Контроль дозировок» в калькуляторе (`checkStackToxicity`) берёт **типовые дозы каталога** (`SUPPORT_CATALOG_DATA[id].dosage.mg`), поэтому фактические дозы плана в UL-проверке не участвовали: при весе 300 кг D3 считался как 5960 МЕ, капался до 4000 МЕ — и пользователь не видел ни расчёта, ни капа.
- `ULWarning` (+`CalculatorResult`/`PlanResult`) += `appliedDoseMg` — доза, реально попавшая в план после UL-капа; `currentDoseMg` — расчётная до капа. Старые сохранённые расчёты поля не имеют (опционально).
- Текст рекомендации больше не противоречит плану: при >150 % раньше советовалось «≤1.5×UL», хотя план капался до UL; теперь «снизить до ≤UL» + «в плане ограничено до …».
- `runSupportUnified` прокидывает `tzRes.ulWarnings` в `PlanResult`; `WeeklyPlanView` показывает блок «⚠ Пределы доз (UL) по фактическим дозам плана» — расчётная доза, кап, UL и % от UL через `formatDose` (D3 — в МЕ, селен — в мкг, не «мг»).
- Шеринг плана: строка «⚠ UL по фактическим дозам плана: … (UL …, N%)».
- Калькулятор: подпись под «Контролем дозировок» честно говорит, что проверка идёт по типовой дозе каталога, а UL по фактическим дозам — в недельном плане поддержки.
- `savePlan` сохраняет `ulWarnings`, «Мои планы» показывают «⚠ UL по фактическим дозам: N — вещества»: сохранённый план с дозой, срезанной пределом, больше не выглядит безупречным.

Тесты-гарды:
- `plan-ul-warnings.test.ts` (7): `checkUpperLimits` отдаёт и расчётную, и применённую дозу (149 мкг → кап 100 мкг, UL 100 мкг = 4000 МЕ), ровно на UL — без предупреждения, без `doses[id]` применённая доза не выдумывается; `PlanResult.ulWarnings === calculateSupportTZ(state).ulWarnings`; при весе 300 кг предупреждения реально есть; `appliedDoseMg ≤ ulMg < currentDoseMg`; рекомендация всегда называет UL.
- `weekly-plan-ul-warnings.test.tsx` (3): блок показывает «5960 МЕ» (расчёт), «4000 МЕ» (UL/кап), «149% от UL», «ограничено до»; без предупреждений блока нет; микродозы подписаны «мкг», не «мг».
- `fav-plan-source.test.tsx` +2: сохранённый план с `ulWarnings` рисует «UL по фактическим дозам: 2 — …», старый план без поля — строки нет.

### Финал
`npm run type-check` — 0 ошибок; `npm run verify:apk-design` — OK; широкий прогон (`src/engines` + `src/ui/components` + `src/ui/screens/__tests__` + `src/ui/__tests__`, 975 файлов): **14 253 теста зелёные**, 1 падение — предсуществующее и не связанное с правками: `diary-mmc-checkin-integration.test.tsx` — ожидает «2 сетов» вместо «2 сета» после `8aeb72252` (воспроизводится на HEAD-версиях). Ранее отмеченное `risk-women-deeplink.test.tsx` (`initialSubTab='women'`) в этот круг не входит и тоже воспроизводится на HEAD.
Контрольный прогон `src/engines` + `src/data` + `src/ui` целиком (1556 файлов): **19 901 тест зелёный**, 20 skipped, 1 падение — то же самое предсуществующее (`diary-mmc`).
Шестой проход (честность производного покрытия): `src/engines` — **13 857 зелёных**, 20 skipped, то же единственное предсуществующее падение; `src/ui` целиком (632 файла) — **6 034 зелёных**.
Седьмой проход (натуральная единица доз + честность сохранённого плана): `src/engines` (921 файл) — **13 850 зелёных**, 20 skipped, то же единственное предсуществующее падение (`diary-mmc`); `src/ui` целиком (633 файла) — **6 041 зелёный**.
Восьмой проход (честное покрытие каталога): итоговый прогон после всех правок — `src/engines` (922 файла) — **13 854 зелёных**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, ожидает «2 сетов» вместо «2 сета»); `src/ui` целиком (635 файлов) — **6 051 зелёный**, 0 падений. `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Девятый проход (честное покрытие механизмов): контрольный прогон `src/engines` + `src/ui` (1557 файлов) — **19 913 тестов зелёные**, 20 skipped, 1 падение — то же предсуществующее (`diary-mmc-checkin-integration.test.tsx:111`, ожидает «2 сетов» вместо «2 сета»); `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Десятый проход (честное покрытие в плане): `src/engines` (923 файла) — **13 867 зелёных**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, «2 сетов» vs «2 сета»); `src/ui` целиком (637 файлов) — **6 064 зелёных**, 0 падений; `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Одиннадцатый проход (UL по фактическим дозам): `src/engines` + `src/ui` (1561 файл) — **19 941 зелёный**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, «2 сетов» vs «2 сета»); `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Двенадцатый проход (одна доза D3 + один UL-контур в элементарном веществе): продуктовые вопросы из прохода 11 закрыты ответом «D3 — 2000 МЕ; магний — в пересчёте на элементарный».

**1. Витамин D3: одна базовая доза 2000 МЕ.**
Раньше контур жил с двумя числами: витрина плана 5000 МЕ (`DEFAULT_DOSAGES.vitamin_d3`, каталог `0.125 мг`, протоколы стеков), а титрация движка считала 50 мкг = 2000 МЕ. При этом 5000 МЕ **выше UL 4000 МЕ** (`NUTRIENT_UL['vitamin_d3'] = 100 мкг`) — то есть каждый план формально выходил за предел.
- `DEFAULT_DOSAGES.vitamin_d3` 5000 → **2000** (натуральная единица — МЕ); каталог `dosage.mg` 0.125 → **0.05**, форма «D3 2000 МЕ» отмечена `best`, а 5000 МЕ осталось альтернативой с пометкой «коррекция дефицита — по назначению врача».
- Протоколы стеков (`support-stacks-part1/part2/late` — дозы и `timingSummary`), быстрые списки `Calc.mapper`, `SYNERGY/PROTOCOL` в `support-meta`, рекомендации `tz-mapper-engine` («D3 2000 МЕ», «Mg 200 мг элементарного»), `lab-tier-recommendations` (база 2000, эскалация осталась), `complete-nutrition-db`, `blood-stack-macro`, `recovery-techniques`, `nutrition-periodization`, `biohacking-environment` — приведены к 2000 МЕ.
- Клинические диапазоны коррекции (5000–10000 МЕ в статьях/симптом-солвере/фертильности, бренды в `lab-priority-map`) **оставлены**: это протокол дефицита по назначению врача, а не базовая доза плана.
- 2000 МЕ = 50 мкг = **50 % UL** — базовая доза больше не капается и не конфликтует с пределом.

**2. UL: один реестр и элементарное вещество.**
«Контроль дозировок» (`checkStackToxicity`) держал **четвёртую** копию таблицы пределов (`SUPPLEMENT_UPPER_LIMITS`): B6 = 100 мг (IOM) вместо EFSA 12 мг, селен 400 вместо 255, всё в «мг». Плюс пересчёт микронутриентов был сломан: каталог хранит мг, а коэффициенты `0.001`/`0.000025` считали их мкг/МЕ — селен и D3 занижались в 1000×/40000×, и реальные превышения молча не находились.
- Источник предела теперь один — `NUTRIENT_LIMITS_V2`; `SUPPLEMENT_UPPER_LIMITS` стал производным видом (мг) для обратной совместимости.
- Пересчёт «масса соли → элементарное вещество» вынесен в `src/data/elemental-dose.ts` (`resolveElementalFactor`, `elementalMgOf`) — его используют и UL-контур, и карточка вещества. Решение: UL считаем по **фактическому количеству минерала в таблетке** («магний цитрат 400 мг» ≈ 64 мг элементарного Mg), а не по массе соли.
- Карточка вещества в калькуляторе показывает «≈ X мг элементарного» рядом с дозой-этикеткой — иначе «400 мг» читались как 400 мг магния.
- Тип предела больше не маскируется: превышение настоящего `UL` → `danger`/`warning`, 80–100 % → `safe`; `SafeLevel` (железо) → жёлтое «это НЕ порог токсичности, UL не установлен»; `ClinicalGuidance` (NAC, CoQ10, B12 и т.п.) и клинический оптимум → `titrate`, не «превышение»; `NotEstablished` (креатин) → предупреждения нет вовсе.
- Тексты предупреждений подписаны в единице реестра (`255 мкг`, `4000 МЕ`, `12 мг`), а не склеены в «мг»: `ToxWarning` += `doseText`/`limitText`/`elemental`.
- `DEFAULT_DOSAGES.magnesium` 400 → **200 мг элементарного** — совпадает с титрацией движка (раньше карточка плана показывала 400, а UL/агрегат считали 200) и укладывается в UL 350 мг.

Тесты-гарды:
- `d3-single-dose.test.ts` (4): `DEFAULT_DOSAGES`/каталог/`formatDefaultDose`/`formatDoseFromMg` дают одни и те же 2000 МЕ; 50 мкг < UL 100 мкг; ни один стек не содержит дозу D3 «5000»; 5000 МЕ в каталоге — не `best` и помечено «дефицит».
- `elemental-dose.test.ts` (7): форма соли определяет долю (цитрат 0.16 / бисглицинат 0.139 / оксид 0.603), неизвестная форма — консервативный дефолт, микронутриенты и органика — без коэффициента (не 1000×), нулевая/битая доза → 0.
- `ul-single-registry.test.ts` (8): `SUPPLEMENT_UPPER_LIMITS` = реестр (B6 = 12 мг EFSA, селен 255 мкг, D3 0.1 мг, zinc 40, vitC 2000); `creatine` без UL; B6 50 мг каталога → `danger` 417 % с текстом «12 мг»; селен/D3 не занижены в 1000×; магний 400 мг соли ≈ 64 мг элементарного и не «danger»; `SafeLevel` (железо) → `warning` с «НЕ порог токсичности»; `ClinicalGuidance` (NAC) → `titrate`.
- Обновлены осознанно: `dose-scale-consistency` (2000/0.05), `dose-units` (`formatDefaultDose` 2000), `calc-sub-dosage-units` (2000 МЕ), `plan-dose-units` (2000 МЕ), `support-dose-display-units` (магний 200 мг).

Прогон двенадцатого прохода: `src/engines` + `src/data` (936 файлов) — **13 957 зелёных**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, «2 сетов» vs «2 сета»); `src/ui` целиком (639 файлов, `forks` 1–2) — **6 076 зелёных**, 1 падение вне зоны правок (`training-native.test.tsx` — ожидает «К дашборду» в тренировочном экране, чужая WIP-зона) и 2 несовместимых с загрузкой чужих `__tmp-*.test.ts` в папке планировщика питания; `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

### Тринадцатый проход (витамины A/E в единицах реестра + UL видит фактические дозы плана)

**1. Витамин A/E: подпись «МЕ» при хранении в мг.**
`doseUnit('vitamin_a'|'vitamin_e')` возвращал «МЕ», хотя `SUPPORT_CATALOG_DATA.dosage.mg` хранит миллиграммы:
- витамин A, каталог `1 мг` → «1 МЕ» вместо ≈3300 МЕ (ошибка 3300×), и план считал 1 «МЕ» для UL;
- витамин E, каталог `200 мг` → «200 МЕ» (≈300 МЕ ≈ 200 мг), `DEFAULT_DOSAGES` 400 «МЕ» и каталог 200 мг жили в разных шкалах;
- UL E = **300 мг** α-токоферола, но `formatDose('vitamin_e', 300)` показывал «300 МЕ» — предел был подписан чужой единицей.

Решение: натуральная единица A/E = единица реестра пределов — **мкг RAE** (A) и **мг α-токоферола** (E). МЕ остаётся в тексте формы («Ретинола пальмитат 3300 МЕ (1 мг ретинола)», «Смешанные токоферолы (200 мг ≈ 300 МЕ)»).
- `dose-units.ts`: A → `MCG_IDS`, A/E убраны из `IU_IDS`; `DEFAULT_UNIT` A — мкг, E — мг; экспортирован `vitaminDMcgFromIu` (план D3 в МЕ → мкг для реестра).
- `DEFAULT_DOSAGES.vitamin_e` 400 → **200 мг**; компаньон омега-3 (защита ПНЖК от окисления) тоже 200 мг.
- Каталог: формы A (10 000 МЕ при «1 мг» — арифметически неверно: 10 000 МЕ = 3 мг ретинола) и β-каротина (25 000 МЕ = 15 мг) исправлены; форма E «400 МЕ» при дозе 200 мг исправлена на «200 мг ≈ 300 МЕ».

**2. UL-контур считался не по тем дозам.**
`checkUpperLimits` вызывался с картой титрации (`applyTitration`), где есть только Mg, Zn, D3, Se, витамин C, NAC, ALA, CoQ10, глицин, калий, таурин. B6, витамин A, K2, фолат, бор, медь, железо, P5P в неё **не попадают** — их дозы не проверялись вообще, хотя:
- `DEFAULT_DOSAGES.vitamin_b6 = 25 мг` при EFSA UL **12 мг**, а комментарий в `support-meta` обещал «движок капит UL-гейтом»;
- `p5p` (активная B6) 25 мг — та же история;
- витамин A вообще отсутствовал в `NUTRIENT_UL` (нет ключа) — самый гепатотоксичный витамин без предела.

Закрыто:
- `substances.ts`: единый резолвер `resolvePlanDose(id, weight)` (из него же строит дозы `buildSubstances`) — движок проверяет ровно ту дозу, которую видит пользователь.
- `engine-helpers.ts`: `checkPlanUpperLimits(substances, planDoses, appliedDoses)` — переводит план в единицу реестра (D3: МЕ→мкг) и делегирует в `checkUpperLimits`; старый контракт `checkUpperLimits` сохранён (единица реестра, тесты без изменений).
- `ulLimitKeyOf`: канонизация алиасов (`selenium_yeast`→`selenium`, `methylfolate`→`folate`, `methylcobalamin`→`vitamin_b12`) + `NUTRIENT_UL_ALIAS` (`p5p`→`vitamin_b6`).
- `NUTRIENT_UL` += `vitamin_a` (3000 мкг RAE, EFSA); `NUTRIENT_UL_MCG_KEYS` += `vitamin_a`.
- Тип предела больше не маскируется: `UlWarning.limitKind` (`types.ts`, единый контракт движок→план→UI/сохранённые планы); `ClinicalGuidance` (NAC, CoQ10, B12, K2, хром) в UL-блок **не попадает** — это не пределы; `SafeLevel` (железо) попадает с текстом «safe level — это НЕ порог токсичности».
- `WeeklyPlanView`: подпись «UL»/«safe level» по `limitKind`; сноска больше не обещает кап всем веществам — «титруемые капаются, для остальных превышение показывается предупреждением, дозу в плане не меняем».

**3. Найденное превышение в собственных таблицах.**
Новый контур сразу показал: `WEIGHT_BASED_DOSING.magnesium` = 6 мг/кг (480 мг при 80 кг) выдавал **137 % UL 350** в каждом плане — при том что проход 12 решением «DEFAULT 200 мг элементарного» уже выровнял базовую дозу. Исправлено: `magnesium` = 2.5 мг/кг, min 200, max **350** (= UL); `zinc` max 50 → **40** (IOM UL, выше — дефицит меди).

**4. Расписание и карточка плана — одна доза.**
`generateSchedule` для не-титруемых веществ брал локальные строки (`vitamin_e: '100 мг'`, `vitamin_b6: '25 мг'`, для витамина A — «по инструкции»). Теперь принимает `planDoses` и подписывает `formatDefaultDose` — строка приёма совпадает с карточкой (E — 200 мг, A — 1000 мкг).

Тесты-гарды:
- `plan-ul-actual-doses.test.ts` (11): B6 25 мг ловится (UL 12 мг, 208 %), B6 ≤12 — нет; `p5p` проверяется как B6; D3 2000 МЕ ok / 8000 МЕ = 200 % (UL 100 мкг); витамин A 1000 vs 6000 мкг; витамин E 200 vs 600 мг; `selenium_yeast` канонизируется; железо даёт `SafeLevel` + «НЕ порог токсичности»; NAC/B12 (ClinicalGuidance) не выдаются за UL; `appliedDoseMg` и «ограничено до» для Mg 800→350; нулевые дозы не создают предупреждений.
- `dose-units.test.ts` (18): A — мкг, E — мг; `formatDoseFromMg('vitamin_a', 1)` = «1000 мкг», E 200 = «200 мг»; `naturalFromMg` A/E; `toMgEquivalent` A/E.
- `plan-ul-warnings.test.ts` (8): при 300 кг предупреждение реально есть (B6), Mg/Zn больше не превышают (вес-доза ограничена UL), D3 2000 МЕ не даёт ложного «2000 % UL» (проверка пересчёта МЕ→мкг), `PlanResult.ulWarnings === движок`.
- Обновлено осознанно: `dose-units.test.ts` (E была «МЕ»), `plan-ul-warnings.test.ts` (фикстура 300 кг давала превышение через Mg; теперь через B6).

**Осознанное отклонение прохода:** дозы плана по-прежнему типовые — B6 25 мг / P5P 25 мг остаются в плане, превышение UL показывается предупреждением «снизить до ≤12 мг под контролем врача», а не молчаливым капом. Причина: 25–50 мг B6/P5P — терапевтический коридор протоколов приложения (пролактин), и решение о капе — продуктовое, а не техническое. Честность контура при этом полная: цифра, предел и рекомендация видны рядом.

Прогон тринадцатого прохода: `src/engines` + `src/data` (937 файлов) — **13 969 зелёных**, 20 skipped, 7 падений вне зоны правок: 6 в чужой WIP-зоне `src/engines/bb/*` (`bb-*-quality`, `bb-user-text-labels`, `bb-pro-methods-levels`, `bb-full-matrix-extended`, `audit_full_matrix` — меняются `bb-*.engine.ts` в рабочем дереве) и предсуществующее `diary-mmc` («2 сетов» vs «2 сета»); `src/ui/screens/SupportScreen_parts/__tests__` + `src/ui/screens/Calculator/__tests__` (42 файла, forks 1–2) — **278 зелёных**; `npm run type-check` — 0 ошибок.

### Четырнадцатый проход (женские пороги без фазовой модели, sex в оценке ССЗ, мёртвый дубль анализов)

**1. `notification-engine`: мужские пороги для женщин.**
Правила E2/HCT/АЛТ были написаны под мужской контур. У женщины E2 <15 пг/мл — норма ранней фолликулярной фазы, 80–200 — норма цикла, HCT 48 — уже эритроцитоз (норма 36–48), АЛТ 2.5×ULN = 78 (ULN 31). Итог — ложные «критические» алерты 2–3 раза в неделю и совет «увеличить дозу АИ», плюс упоминание гинекомастии.
- `NotificationState.sex?: 'male' | 'female'`; без поля — прежний мужской путь байт-в-байт.
- Мужские `e2_monitor`/`e2_crash`/`e2_high`/`hct_high`/`alt_critical` гейтятся `!isFemale(s)`.
- Женские: `hct_high_female` (ULN 48) и `hct_critical_female` (ULN+4 = 52) — та же лестница «терапия/ургент», что `hctGradationLabel`; `alt_critical_female` (2.5×ULN 31 = 78); `e2_crash_female` — только на фоне ИА (<20): без ИА низкий E2 не тревога; `e2_high_female` — только >400 (выше типичного овуляторного пика); `e2_monitor_female` — мониторинг на ИА, без гинекомастии, с оговоркой про цикл/кости/либидо.
- Числа HCT/АЛТ считаются от единого резолвера `getLabNorm(...)` (`lab-norms.engine`), а не литералами. `Calc.mapper` прокидывает пол профиля и считает `hasAI` по всем трём ИА (анастрозол/летрозол/экземестан) — раньше только анастрозол.
- **Найденный побочный дефект (закрыт пятнадцатым проходом):** результат `checkNotifications` в `Calc.mapper` никуда не выводился — у движка не было UI-поверхности (баннер/toast). Пороги теперь честные, но пользователь их не видел.

**2. Доменная карта гематологии (видимая часть калькулятора).**
`buildHematoSymptomsFromState` применял мужские 48/52 и Hb 175 ко всем. Теперь пороги — `hctSymptomCuts(sex)`/`hgbSymptomCut(sex)` в `Calc.labs-derived` (от `getLabNorm`): ♀ HCT 44/48 и Hb 150, ♂ прежние 48/52/175. У женских чипов появилась подпись `♀` (`DomainSym.femaleLabel`), чтобы женщина не видела «Гематокрит >48%», сработавший на 45%.

**3. `estimateCardioRisk`: пол больше не игнорируется.**
Параметр `sex` принимался и не использовался. Возрастной фактор теперь по полу: ♂ ≥55, ♀ ≥65 (ССЗ у женщин манифестируют в среднем ~на 10 лет позже); в факторе подписано «♀ порог 65 лет». Остальные факторы (АД, вариабельность, BP Load, ЧСС, курение) не менялись.

**4. `training-calendar.engine.ts`: мёртвый дубль интерпретации анализов удалён.**
`LAB_REFERENCE_DB` + `INTERPRETATION_DB` + `interpretLabValue`/`analyzeLabPanel`/`generateHealthReport` и их типы не имели прод-потребителей, но держали второй набор порогов и советов (HCT >51, «рассмотрите ИА» при E2 >200, TUDCA-рекомендации) — расходящийся с живым `lab-analysis.engine.ts`. Удалено 236 строк; единственный источник — `lab-analysis.engine.ts` (+ женские нормы `lab-norms.engine`). `exportToJSON`/`exportWorkoutsToCSV` оставлены — их использует `TrainingCalendarTab`.

Тесты-гарды:
- `notification-female.test.ts` (11): HCT ♀ 48/52 и ♂ 52; E2 120 ♀ — не «высокий», ♂ — высокий; E2 10 ♀ без ИА — не краш, на ИА — краш; E2 450 ♀ — выше пика; AЛТ 85 ♀ — критично, ♂ — нет; пролактин и путь без `sex` — прежние.
- `calc-labs-female-p2.test.ts` (+2): `hctSymptomCuts` ♂ 48/52 ↔ ♀ 44/48; `hgbSymptomCut` ♂ 175 ↔ ♀ 150.
- `bp-hr-data.test.ts` (+1): возрастной фактор 60 лет — активен у ♂, не активен у ♀; 70 лет — активен у ♀.
- `training-calendar-local-dates`/`-duration` — без изменений, зелёные (удалённый кластер не был покрыт).

Прогон четырнадцатого прохода: `src/ui/screens/Calculator/__tests__` (22 файла) — **130 зелёных**; точечно `notification-female` + `calc-labs-female-p2` + `bp-hr-data` + `training-calendar-*` + `lab-norms-female` — **86 зелёных**; `npm run type-check` — 0 ошибок; `npm run verify:apk-design` — OK.

### Пятнадцатый проход (у уведомлений появилась UI-поверхность)

**Проблема.** `checkNotifications` в `Calc.mapper` вызывался в `useEffect`, результат выбрасывался. Все пороги (E2, HCT, АЛТ, пролактин, ЛПНП, eGFR, D-димер — включая только что сделанные женские) не доходили до пользователя. Это же скрывало и `labs_overdue`, который дублировал бы существующий `LabsDueBanner`.

**Решение.**
- Новый `CalcNotificationsBanner` (`src/ui/screens/Calculator/`): компактный список алертов с priority-тонами (`critical` — красный, `warning` — янтарный, `info` — синий), `role="alert"`, `data-calc-notif="<ruleId>"` / `data-calc-notif-priority` для тестов, кнопка × с `aria-label`.
- `visibleCalcNotifications(rules)` убирает `labs_overdue` — его рисует `LabsDueBanner` по тем же данным (дедуп, а не второй счётчик).
- `Calc.mapper`: `setCalcNotifs(visibleCalcNotifications(checkNotifications(notifState)))`; баннер вставлен сразу под `LabsDueBanner`, поэтому не конкурирует с его sticky-позицией. В зависимости эффекта добавлен `state.profile?.sex` — смена пола пересчитывает пороги.
- `notification-engine` += `markNotificationShown(ruleId)` — закрытие алерта пишет в `he_notification_log`, и правило не возвращается в течение своего `cooldownHours`. Алерт при этом не исчезает сам: критичный HCT/E2 виден до явного подтверждения (в отличие от `triggerNotifications`, который помечает всё показанным сразу).

Тесты-гарды:
- `calc-notifications-banner.test.tsx` (5): пустой список → нет DOM; сообщения/priority-атрибуты; × отдаёт id; `visibleCalcNotifications` фильтрует `labs_overdue`; **source-lock** — в `Calc.mapper` есть `setCalcNotifs(visibleCalcNotifications(checkNotifications(...)))` и нет «вычислено и выброшено» (`checkNotifications(notifState);`).
- `notification-female.test.ts` (+1): после `markNotificationShown` правило скрывается на cooldown, остальные не затронуты.

Прогон пятнадцатого прохода: `src/ui/screens/Calculator/__tests__` (19 файлов) — **93 зелёных**; `notification-female` — 12; `npm run type-check` — 0; `npm run verify:apk-design` — OK.

### Шестнадцатый проход (нагрузка и UL — один счёт)

**Проблема.** Блок «Суммарная нагрузка / UL» (`aggregateDailyLoad` → `buildCumulativeLoad` → `SafetyCumulativeLoad`) считался по карте **титрации** `applyTitration`, а там только Mg/Zn/D3/Se/VitC/NAC/ALA/CoQ10/глицин/калий/омега-3. Последствия:
- B6 25 мг (EFSA UL 12 мг), витамин A, K2, фолат, бор, медь, железо в сводку не попадали вовсе — при этом UL-блок рядом уже предупреждал (проход 13). Два блока на одном экране считали разные дозы;
- алиасы (`selenium_yeast`, `p5p`) не канонизировались — вместо суммы получались отдельные ряды, и `p5p` вообще терялся;
- доза в МЕ (`vitamin_d3`) складывалась с UL в мкг — при dosis 2000 «МЕ» процент UL был бы 2000 %;
- `NUTRIENT_UL` содержит и `ClinicalGuidance` (NAC 1800, CoQ10, B12, K2, калий, хром), и `SafeLevel` (железо) — сводка выдавала их за «UL».

**Решение.**
- `planDosesInUlScale` — общий пересчёт доз плана в единицу реестра (D3: МЕ→мкг); его используют и `checkPlanUpperLimits`, и `aggregateDailyLoad`, поэтому блоки не расходятся по определению.
- `aggregateDailyLoad(substances, planDoses, appliedDoses?)` теперь берёт дозы **плана** (все вещества), канонизирует алиасы через `ulLimitKeyOf` (суммирует `p5p` + `vitamin_b6`, `selenium_yeast` + `selenium`), а если доза капнута титрацией — в нагрузку идёт фактический приём (`appliedDoses`).
- В сводку попадают только истинные `UL`: тип определяется через `resolveNutrient` (ключ `NUTRIENT_UL` — id ВЕЩЕСТВА `vitamin_d3`, а `NUTRIENT_LIMIT_INFO` — id НУТРИЕНТА `vitamin_d`; прямое обращение к `NUTRIENT_LIMIT_INFO[key]` давало `undefined` и молча выключало D3). `ClinicalGuidance` и `SafeLevel` в «нагрузку / UL» не входят — у них другая природа (см. проход 13).
- `engine.ts`: `aggregateDailyLoad(substances, planDoses, titration)`.

Тесты-гарды (`daily-load-ul-parity.test.ts`, 11):
- `planDosesInUlScale`: 2000 МЕ → 50 мкг, 4000 → 100; мг/мкг не пересчитываются; 0/NaN/−5 отбрасываются;
- B6 25 мг виден в нагрузке с UL 12 (раньше строки не было вообще);
- `p5p` 25 + B6 10 = 35 мг в одной строке `vitamin_b6`;
- `selenium_yeast` 200 + `selenium` 50 = 250 мкг против UL 255;
- D3 2000 МЕ = 50 мкг (50 % UL), не 2000 %;
- кап титрации: план D3 8000 МЕ → в нагрузке 100 мкг; Mg 800 → 350 (UL);
- `ClinicalGuidance`/`SafeLevel`/`creatine` не создают строк;
- витамин A 6000 мкг против UL 3000.

Прогон шестнадцатого прохода: `daily-load-ul-parity` + `plan-ul-actual-doses` — 22 зелёных; поддержка/планирование (`support-calc-e2e`, `support-calc-audit`, `plan-mechanisms`, `support-limits-registry`, `ul-single-registry`, `plan-ul-warnings`, `plan-quality-v2`, `support-dose-display-units`) — **150 зелёных**; `npm run type-check` — 0; `npm run verify:apk-design` — OK.

### Семнадцатый проход (одна доза: карточка = расписание = титрация)

**Проблема.** Дозу нутриента считали ДВЕ модели, и третья — для расписания:
- карточка (`buildSubstances` → `resolvePlanDose`): `WEIGHT_BASED_DOSING`, линейно по мг/кг с потолками UL (магний 2.5 мг/кг, ≤350);
- `applyTitration`: фиксированная база × `(bw/80)^0.75` (магний 200 мг → при 140 кг 293 мг);
- `PlanResult.schedule` вообще собирался заново из `DEFAULT_DOSAGES` без веса (`buildSchedule(ids)`).

Итог: при 140 кг карточка показывала «Магний 350 мг», а «Расписание приёма» — «Магний 200 мг». Так же расходились витамин C (800 в карточке против 500 в приёме), омега-3 (4000 против 2000), D3 (2000 МЕ против 2220 МЕ из аллометрии 50 мкг при 80 кг).

**Решение.**
- `buildScheduleFromPlan(subs)` — расписание строится из уже готовых `PlanSubstance[]` (берёт `doseDisplay` и `timing`), поэтому карточка и приём совпадают по построению. `index.ts` использует его вместо `buildSchedule(tzRes.selectedSubstances)`; старый `buildSchedule` остался для юнит-тестов единиц.
- `applyTitration` для нутриентов больше не имеет своей модели: доза = `resolvePlanDose(id, bw)` (+ D3: МЕ→мкг), затем прежний UL-кап. Вещества: Mg, Zn, D3, Se, VitC, omega-3, ALA, CoQ10, глицин, калий.
- `WEIGHT_BASED_DOSING_MCG` — вес-дозы D3/Se в мкг (D3 50 мкг при 70 кг, ≤UL 100 мкг = 4000 МЕ; Se 50 мкг, ≤255). В мг-таблице это были бы 0.0007 мг/кг.
- NAC/TUDCA: рампа теперь доля дозы плана (2/3 → 1 и 1/2 → 1), а не отдельные абсолютные числа: при 80 кг NAC 800→1200, при 120 кг 1200→1800 (прежние клинические значения — на прежнем весе), расписание больше не выше карточки.
- `WeeklyPlanView`: бейдж «Адаптация: дозы ×0.5» заменён на «Адаптация: ввод в курс» + пояснение, что расписание показывает ЦЕЛЕВЫЕ дозы плана (до этого бейдж обещал половину дозы, а расписание печатало полную).

Тесты-гарды (`plan-schedule-dose-parity.test.ts`, 5): `doseDisplay` попадает в расписание 1:1; 140 кг → Mg 350 мг (а не 200); 60 кг → Mg 200 мг; **карточка == карта титрации** для 10 нутриентов при 60/80/140/200 кг; E2E `runSupportUnified` — у каждого вещества плана доза в приёме равна дозе карточки.

Прогон семнадцатого прохода: `plan-schedule-dose-parity` + `support-calc-audit` + `plan-ul-actual-doses` + `support-calc-e2e` + `support-calc-canon-init` — **96 зелёных**; `src/ui/screens/SupportScreen_parts/__tests__` — **192 зелёных**; `npm run type-check` — 0; `npm run verify:apk-design` — OK.

### Восемнадцатый проход (мёртвая таблица доз-усилителей удалена)

**Проблема.** В `src/data/support-meta.ts` жил экспорт `SUBSTANCE_ENHANCERS` с 0 потребителей и перепутанными единицами: селен и K2 — «200 мг» (на деле мкг), магний в паре с D3/ашвагандой — «400 мг» соли без пересчёта в элементарный, B6 к магнию — **50 мг** (417 % EFSA UL 12 мг). Любой, кто подключил бы таблицу к UI, показал бы пользователю 1000× ошибку по селену и дозу B6 в 4× выше предела.

**Решение.** Таблица удалена, а не «починена»: второй кураторский источник доз противоречит принципу «одна доза на вещество» (проход 17), и у него не было ни одного потребителя. Пары «с чем принимать» и так выводятся из каталога — `detectEnhancers` + `MODIFIERS` (жиры, пиперин, витамин C, хелат, липосомы…). На месте таблицы оставлен комментарий, почему её больше нет.

Тест-гард (`src/data/__tests__/support-meta-dead-doses.test.ts`, 2): `export const SUBSTANCE_ENHANCERS` не вернулся ни в `support-meta`, ни в ре-экспорт `support-database`; единственный источник усилителей — `detectEnhancers`.

Прогон восемнадцатого прохода: `src/data/__tests__` — **69 зелёных** (11 файлов); `npm run type-check` — 0.

### Девятнадцатый проход (PDF для врача: дозы из плана + женские пороги)

**Проблема.** Кнопка «🖨 PDF» — единственный документ, который уходит врачу, — собирал таблицу назначений из текста обоснования:
- `mnn: s.reason.split(' — ')[0]` → в колонку «МНН» попадало обоснование («Антиоксидант: ↑ глутатион…»), а не название;
- `dose: s.reason.match(/([\d.]+\s*(?:мг|г|МЕ|мкг|табл|капс))/)[0]` → доза выдёргивалась регэкспом из прозы: первое число с единицей в тексте (в обоснованиях встречаются «200 мг», «5000 МЕ», «2 г») либо пусто;
- `frequency` искался по `\d[x×р]/[дн]` — практически не срабатывал.

При этом реальная доза плана (`PlanSubstance.doseDisplay`, посчитанная `resolvePlanDose`) в PDF не попадала вообще. Плюс fallback-график анализов и стоп-критерии были мужскими: HCT `<50/>54`, АЛТ `<40/>200`, E2 `20-40/<15/>80`, строка ПСА — для пациентки-женщины это неверные цели и бессмысленный маркер.

**Решение.**
- `buildExportDataFromRec(rec, patient, course, planDoses?)`: МНН — `plan.name` → `SUPPORT_CATALOG_DATA[id].nameRu` → id; доза — `plan.doseDisplay`; приём — `plan.timing`; без плана — честный «—» (а не число из прозы). Колонка «Частота» переименована в «Приём» (там время/контекст еды, а не кратность). `CalcActions` получил `planResult`, `Calc.mapper` пробрасывает `planResult.substances`.
- Пороги fallback-графика и стоп-критериев — из `getLabNorm(code, sex)` (UCUM_MAP / женский слой): ♀ HCT 48/52, АЛТ/АСТ 31/78 (2.5×ULN), ГГТ 31, креатинин 97, E2 без мужской цели «20-40» (по фазе цикла; краш <20 на ИА, >400 вне овуляции), ПСА-строки нет, `FEMALE_LABS_NOTE` в клинических заметках. ♂ — прежние числа (54 %, 200 Ед/л, E2 20-40, ПСА).
- `FEMALE_HCT_THERAPY`/`FEMALE_HCT_URGENT`/`FEMALE_ALT_2_5_ULN` переехали из `notification-engine` в `lab-norms.engine`: ULN+4 и 2.5×ULN теперь считаются в одной точке и для уведомлений, и для PDF.

Тест-гард (`protocol-export-labs.test.ts`, 7): доза берётся из плана, а «5000 МЕ» из обоснования игнорируется; без плана доза «—» и название из каталога; ♀ fallback — HCT 48/52, АЛТ 31/78, креатинин 97, нет ПСА, ♀-легенда; ♂ (и legacy `sex='m'`) — 54 %, 200, ПСА на месте.

Прогон девятнадцатого прохода: `protocol-export-labs` + `notification-female` — **19 зелёных**; `src/engines/__tests__` + `src/ui/components` — **3969 зелёных**, 1 предсуществующее падение `diary-mmc` (плюс `support-hub-pro` таймаутил при параллельной нагрузке, отдельно — 77/77); `npm run type-check` — 0; `npm run verify:apk-design` — OK.

### Двадцатый проход (тексты «Копировать»/«Врачу»: полный план и доза карточки)

**Проблема.** Оба текстовых экспорта (`buildPlanText`, `buildDoctorReport`):
1. группировали вещества по плюральным литералам — «Минералы», «БАДы», «Препараты», — а `planItemKind` возвращает единственное число («Минерал», «БАД», «Препарат»). Совпадение было только у «База», поэтому в документ попадала ТОЛЬКО база курса (гидратация/кардио/шаги): весь план препаратов и БАД молча терялся. Врач получал отчёт без назначений;
2. дозу считали `subDosage(id).mg × titrationFactor` (типовая доза × лаб-титрация), а карточка/расписание — `resolvePlanDose` (вес + потолки UL). При 140 кг карточка показывала магний 350 мг, а текст — 200 мг; фактор титрации молча умножался на типовую дозу, хотя в план не заложен.

**Решение.**
- `PLAN_KIND_HEADINGS`/`PLAN_KIND_ORDER` типизированы `ReturnType<typeof planItemKind>` — заголовки и фильтр больше не могут разойтись; оба экспорта используют один список.
- `planDoseOf(id, weight)` → `resolvePlanDose`; если вещества нет в справочнике доз, доза не печатается (раньше резолвер отдал бы фолбэк 500 мг). Этим же резолвером теперь живут чипы быстрого списка и карточка вещества (`CalcSubstanceDetail.planDose`), а не `DEFAULT × tF`.
- Лаб-титрация остаётся ориентиром: множитель в чипе подписан подсказкой «в дозу плана не заложена», в тексте — строка `[TITR↑…]` из обоснования.

Тесты (`plan-text-dose-parity.test.ts`, 7): все 4 группы попадают в оба экспорта; Mg 350 мг при 140 кг и 200 мг при 60 кг (а не 300 мг = 200×1.5); D3 4000 МЕ; гидратация без выдуманных «500 мг»; «Врачу» = карточка.

Прогон двадцатого прохода: `src/ui/screens/Calculator/__tests__` + `src/ui/components` — **133 зелёных** (26 файлов); `npm run type-check` — 0.

### Двадцать первый проход (один сборщик расписания + D3 в протоколе титрации)

**Проблема.**
- `buildSchedule(ids)` — второй сборщик расписания со своей моделью доз (`DEFAULT_DOSAGES`, без веса и UL). Прод с прохода 17 его не вызывал, но функция оставалась публичной: юнит-тесты охраняли мёртвый путь, а любой новый потребитель получил бы «магний 200 мг» при 140 кг.
- В раскрытой карточке D3 «Протокол титрации» старт был **5000 МЕ/день** при плане 2000 МЕ — вторая базовая доза (нарушение решения прохода 12: 5000+ только в текстах коррекции дефицита).

**Решение.**
- `buildSchedule` удалён; его тесты единиц переведены на реальный путь `buildScheduleFromPlan(buildSubstances(ids))`.
- `titration-protocols.vitamin_d3`: `startDose` = 2000 МЕ/день (базовая доза плана, вес-рост до 4000), шаги 10000/20000 МЕ подписаны как коррекция подтверждённого дефицита (25-OH-D3 <30 / <15), `maxDose` — «только коррекция дефицита под контролем врача». Стоп-условия не менялись.

Тесты-гарды: `no-legacy-schedule` (2, source-lock — в `substances.ts` нет `export function buildSchedule`, `index.ts` не вызывает `buildSchedule(`); `titration-d3-base-dose` (2 — старт протокола равен `formatDefaultDose(resolvePlanDose('vitamin_d3', 70))`; шаги выше UL существуют только с «дефицит» в триггере).

Прогон двадцать первого прохода: `src/data/__tests__` + `src/engines/support-plan` — **102 зелёных** (17 файлов); `npm run type-check` — 0.

### Двадцать второй проход (экран «Фертильность/ПКТ»: дозы выше UL)

**Проблема.** На экране «Фертильность/ПКТ» жили четыре собственных списка добавок, не связанных с реестром пределов: D3 «3000–5000 МЕ/день» (UL 4000), цинк «30–50 мг/день» (UL 40), витамин E «400–800 МЕ/день» (~268–536 мг, UL 300 мг). Пользователь видел в одном приложении разные «базовые» дозы одного вещества, а часть из них — прямо выше UL без пометки.

**Решение.** Все четыре поверхности (текстовый ПКТ-блок, карточка «Нутрицевтическая поддержка ПКТ», «Подробная нутрицевтическая поддержка», «Универсальные добавки для фертильности») приведены к реестру:
- D3 → «2000–4000 МЕ/день (UL 4000; больше — только при дефиците)»;
- цинк → «до 40 мг/день (UL)» (+ медь 2–3 мг как раньше);
- витамин E → «до 300 мг/день (~450 МЕ; UL)».

Тест-гард `fertility-supplement-ul` (3): числа в тексте сверяются с `NUTRIENT_LIMITS_V2` (D 4000 МЕ, Zn 40 мг, E 300 мг), старые диапазоны не вернулись, исправлены все 4 списка цинка / 3 списка D3 / 3 списка витамина E.

Прогон двадцать второго прохода: `src/data/__tests__` + `src/engines/support-plan` — **105 зелёных** (18 файлов).

Замечено, но не тронуто (отдельный проход): `symptom-solver.data-part1/part3` (D3 5000–10000, E 400–800) и `training-methodology` (D3 2000–5000) — это тексты-рекомендации вне плана, их правка требует клинического ревью всего контента.

### Двадцать третий проход (solver симптомов + четвёртая копия UL)

**Проблема.** У «Что беспокоит» (solver симптомов) был свой набор доз, не связанный с реестром: D3 5000–10000 МЕ (UL 4000), витамин E 400–800 МЕ (~536 мг при UL 300), цинк 30–50 и 50–100 мг (UL 40), B6/P5P 50–400 мг (UL 12) — без единой пометки. Плюс `THERAPEUTIC_WINDOWS.ul` держал четвёртую копию порогов: селен 300 мкг (реестр 255, EFSA), железо «UL 45» (реестр Safe Level 40 — не порог токсичности). `evidence-dosage-db.vitamin_d3.optMg` = 5000 — «оптимальная» доза выше UL.

**Решение.**
- Solver (21 замена в 3 файлах): D3 → «2000–4000 МЕ (5000–10000 — только при дефиците 25-OH-D3, врач)»; цинк → «до 40 мг (UL)» (акне — «30–40 мг, выше — под контролем врача»); витамин E → «до 300 мг (~450 МЕ; UL)»; B6/P5P выше UL подписаны «выше UL B6 12 мг — под контролем врача».
- `THERAPEUTIC_WINDOWS`: селен 300 → 255, железо 45 → 40 + подпись Safe Level; числа окна теперь сверяются тестом с `NUTRIENT_LIMITS_V2` (zn/mg/ca/se/d3/vitc/iodine/fe).
- `evidence-dosage-db.vitamin_d3.optMg` 5000 → 4000, notes «поддерживающая 2000–4000 (UL)»; `support-interaction-enrichment` (D3+K2), `training-methodology`, `articles-manifest` — диапазоны приведены к 2000–4000 / цинк ≤40 / магний 350.

Тест-гард `symptom-solver-dose-ul` (6): построчный парсер `dose` у supplement-записей — цинк ≤UL, D3 ≤UL, E ≤UL (МЕ×0.67), B6 выше UL обязан содержать «UL B6», старые диапазоны не вернулись. Плюс блок в `support-limits-registry` (2) на совпадение окон с реестром.

Прогон: `symptom-solver-dose-ul`, `support-limits-registry` (47), `support-hub-pro` (77), `female-phase-lab-notes` (5), `solver-plan-target` (2) — **137 зелёных**.

### Двадцать четвёртый проход (дубли порогов: V7-модель ↔ «Анализы» ↔ калькулятор)

**Проблема.** Один и тот же пациент получал разные «нормы» на трёх поверхностях.
- `LAB_REFERENCES` (V7, знаменатель labFactor): АСТ 35, ГГТ 50, креатинин 106, ЩФ 120, билирубин 20 — против `UCUM_MAP`/`getLabNorm` (40/55/110/130/17.1). Риск-модель видела отклонение там, где экран анализов показывал норму (и наоборот).
- `Calc.labs-derived.deriveStateFromLabs` — мужские литералы: АЛТ/АСТ 40/80/120, ГГТ 55/100/200, билирубин 21/40/60, креатинин 110/130/150, HCT 52/56/60 (и отдельная женская тройка 48/52/56). Женщина с АЛТ 35 была «нормой» в калькуляторе при женском ULN 31; креатинин 100 у женщины — тоже «норма» при ULN 97.

**Решение.**
- `risk-engine-v7-matrix`: ULN печёночно-почечной панели (ALT/AST/GGT/ALP/Bilirubin/Creatinine/Hct) выводится из `UCUM_MAP` (`UCUM_ULN_SOURCE`, Hct ÷100). `mean/sd/alpha` остаются параметрами модели — UCUM задаёт только границу.
- `Calc.labs-derived`: АЛТ/АСТ и ГГТ/билирубин/креатинин считаются от `getLabNorm(code, sex).uln` (кратности ×1/×2/×3, ГГТ ×1/×2/×4, креатинин +20/+40), HCT — от `hctSymptomCuts(sex)` (ULN, +4, +8). Мужской путь байт-в-байт (52/56/60, 40/80/120, 110/130/150), женский стал женским.

Тесты: `v7-lab-references-female` +1 (ULN = UCUM, Hct ÷100, ♀-ветки не тронуты), `calc-labs-female-p2` +4 (АЛТ 35 / ГГТ 40 / креатинин 100 / билирубин 19: ♂ норма ↔ ♀ mild; билирубин 19 больше не «норма» по литералу 21).

Прогон: `src/ui/screens/Calculator/__tests__` + `src/ui/components` — **137 зелёных** (26 файлов); `v7*`+`lab-norms-female`+`support-calc-audit` — 75 зелёных; type-check — 0.

### Двадцать пятый проход (живой сумматор кросс-капов ↔ реестр UL)

**Проблема.** `CROSS_CAPS` («Кросс-модульные капы» в протоколах — интерактивный сумматор) держал свою пятую копию порогов: **магний 800 мг** (UL 350), **цинк 50 мг** (UL 40), NAC 4000 (клинический кап движка 2400). Вводя 500 мг Mg, пользователь видел зелёное «500 / 800 — норма», хотя UL-контур и план считают это перебором. Ту же цифру повторяли ~15 текстов протоколов: «Суммарно Mg ≤800 мг/сут», «Zn ≤50 мг/сут суммарно», «Кросс-кап 800 мг/сут».

**Решение.**
- `CROSS_CAPS`: `mg`/`zn`/`d3`/`se` берутся из `NUTRIENT_LIMITS_V2` (350/40/4000/255), в label указано «UL»; `b6` остаётся потолком протокола 100 мг с подписью «EFSA UL 12 мг»; `nac` — 4000 как потолок протокола с подписью «движок капит 2400» (NAC в реестре — `ClinicalGuidance`, не UL; поэтому и не в UL-блоке).
- Тексты протоколов приведены к тем же числам: кардио/адаптогены/сон/электролиты/нейро/женские протоколы — «Mg ≤350 мг/сут из добавок (UL); 400–600 мг — только по назначению врача»; иммунитет/волосы/ЖКТ/E2/акне — «Zn ≤40 мг/сут постоянно (UL); 50 мг — курсом 8-12 нед».
- Дозы-исключения подписаны на месте: цинк 50 мг в протоколе иммунитета («только курсом»), Mg 600–800 в электролитах («выше UL — только при подтверждённой гипомагниемии»).

Тесты: `cross-cap-calc` (7) — капы сверяются с реестром, якоря mg ≤350 / zn ≤40 / d3 ≤4000, NAC = потолок `ClinicalGuidance` с подписью; `protocol-cap-texts` (4) — построчный лок исходников протоколов: «Mg ≤800», «Zn ≤50», «Кросс-кап 800» вернуться не могут, а протокольный цинк 50 подписан «только курсом». Прогон `src/ui/screens/SupportScreen_parts/__tests__` — **25 файлов зелёные**; type-check — 0.

### Двадцать шестой проход (единицы справочника доз)

**Проблема.** Блок «📖 Справочник терапевтических диапазонов» (`DOSE_RANGES` → `SupportEffectiveDose`) печатал **«мг» для каждой строки**, игнорируя собственный label: «Витамин D3 (МЕ): 1000–5000 **мг**» (это 200 000 МЕ), «B12 (мкг): 500–2000 **мг**», «Фолат (мкг): 400–1000 **мг**». Тот же миллиграмм уезжал в `doseWindowFor` из fallback-ветки по `ranges` — окно фолата (400–1000 мкг) подписывалось «мг». Плюс `slice(0, 12)` молча обрезал справочник: железо, креатин, ашваганда, родиола не показывались вообще. И верхние границы (D3 5000, Zn 50, Mg 600) стояли без предела рядом.

**Решение.** В `DOSE_RANGES` добавлено поле `unit` (мг/мкг/МЕ) у всех 17 строк; рендер идёт через `doseRangeText(key)` — «Цинк (элемент): 15–50 мг · UL 40 мг», «Железо: 18–65 мг · Safe Level 40 мг», «D3: 1000–5000 МЕ · UL 4000 МЕ». Обрезка `slice(0,12)` снята. `doseWindowFor` берёт единицу из таблицы (`r.unit ?? 'мг'`) вместо литерала. Блок загрузочных протоколов подписан: «Насыщение — только при подтверждённом дефиците и под контролем (D3 — 25-OH-D и Ca; железо — ферритин/ОЖСС; Mg — Mg плазмы)», поддерживающие дозы D3/Mg — с UL.

Тесты: `support-effective-dose-units` (7) — у каждой строки есть единица, D3 = МЕ и не содержит «мг», B12/фолат = мкг, предел печатается рядом (Zn UL 40, Mg UL 350, железо Safe Level), `doseWindowFor('folate')` = мкг. Прогон `SupportScreen_parts/__tests__` + `Calculator/__tests__` — **46 файлов зелёные**; type-check — 0.

### Двадцать седьмой проход (§6.4: кросс-лок женских порогов + дозы женских протоколов)

**Проблема.** §6.4 держал два открытых пункта.
- Пороги вирилизации жили в двух местах: движок `FEMALE_AAS_PROFILES` (мг/нед) и UI `FEMALE_VIRILIZATION_CALC` (оральные — мг/день). Совпадение держалось «на честном слове».
- «Примерные протоколы поддержки» женщины обещали дозы выше UL: цинк 25–50 и 30–50 мг/день (UL 40), магний 400–600 мг/день при UL 350 (в одной строке «кросс-кап 350 (UL)» и доза 400–600), B6 100–200 мг/день (UL 12) без подписи.

**Решение.**
- `female-virilization-parity` (5): для всех 14 позиций сверяются красный порог после нормировки (день ×7), андрогенный индекс и флаг абсолютного противопоказания. Значения совпали — тест закрывает расхождение на будущее.
- `FEMALE_SUPPORT_PROTOCOLS`: цинк → «25–40 мг/день (UL)» / «30–40 мг/день (UL)» (+ «50 мг — только курсом 8-12 нед»), магний → «350 мг/день (UL)» (+ «400–600 мг — только при подтверждённом дефиците/по назначению врача»), B6 → «100–200 мг/день (выше UL B6 12 мг — под контролем врача)». D3 2000–4000 и витамин E 400 МЕ (~268 мг) уже были в границах.
- `female-support-ul` (5) парсит основную часть дозы и сверяет с `NUTRIENT_LIMITS_V2`: Zn ≤40, Mg ≤350, D3 ≤4000, B6 выше 12 мг обязан содержать «UL B6».

Прогон `src/ui/screens/SupportScreen_parts/__tests__` — **28 файлов зелёные**; type-check — 0.

### Двадцать восьмой проход (триггеры системных попапов: пороги по полу)

**Проблема.** `SPECIALIZED_DOMAINS` в `Calc.mapper.tsx` держал пятую копию лабораторных порогов — мужские литералы `HCT>48`, `АЛТ/АСТ>40`, `ГГТ>55`, `ЩФ>120`, `билирубин>21`, `креатинин>105`, `E2>40`. Для женщины это значило: АЛТ 35 (ULN 31) не включала «Цитолиз», HCT 45 (ULN 48) — «Эндотелий/тромбоз», креатинин 100 (ULN 97) — «Фильтрацию», а E2 60 (нормальная фолликулярная фаза) включала мужской AI-триггер с анастрозолом. На экране «Анализы» те же значения уже были помечены как отклонение — два экрана спорили.

**Решение.**
- `normUln(code, state, fallback)` — порог из единого резолвера `getLabNorm` (+пол из `state.profile.sex`); `hctCorrection(state)` — порог гемореологии из `hctSymptomCuts` (♂ 48 / ♀ 44).
- Триггеры: эндотелий ← `hctCorrection`, цитолиз ← `normUln('ALT'/'AST')`, холестаз ← `normUln('GGT'/'ALP'/'BIL')`, фильтрация ← `normUln('CREATININE')`. ЩФ и билирубин приведены к UCUM (130 и 17.1 вместо 120 и 21), креатинин — к 110/97.
- E2-домен для женщины выключен (мужской AI-триггер к ней не относится; женские гормоны ведёт слой «Женщины»). Клинические пороги без полового разделения (PRL 25, глюкоза 5.6, кортизол 535) не тронуты.
- Мужской путь: HCT 48, АЛТ/АСТ 40, ГГТ 55 — те же числа (кроме ЩФ/билирубина/креатинина, где литерал расходился с нормой экрана).

Тесты: `calc-specialized-sex-thresholds` (6) — ♂/♀ по каждому триггеру, E2-гейт, неизменность клинических порогов. Прогон `Calculator/__tests__` + `SupportScreen_parts/__tests__` — **49 файлов зелёные**; type-check — 0.

### Двадцать девятый проход (цели мониторинга в протоколе «Печень»)

**Проблема.** Таблица мониторинга `supportProtocolHepatic` обещала цели, которых нет на экране «Анализы»: «ЩФ **<150** Ед/л» (норма приложения 130), «билирубин **<21** мкмоль/л» (норма 17.1) — пользователь видел «цель <150» при красном флаге на 140. Женская пометка называла ГГТ **32** (ULN в `LAB_REFERENCES_FEMALE` — 31), а в гематологии — «не мужские **51/54**», которых в приложении нет (мужской ULN 52, ургент >54).

**Решение.** Цели приведены к `UCUM_MAP`: ЩФ `<130`, билирубин `<17.1 / <5`, ГГТ ♀ — 31; в гематологии пометка переписана: «Hct 36–48% (ULN 48); 48% — усиленный контроль, 52% — флеботомия; мужские пороги лестницы (48/52/54) к женщинам не применяются».

Тест `protocol-lab-targets` (4): цели АЛТ/АСТ/ГГТ/ЩФ/билирубина сверяются с `UCUM_MAP` (а не с литералами), старые `<150`/`<21` и «51/54» вернуться не могут. Прогон `SupportScreen_parts/__tests__` — **29 файлов зелёные**.

### Осознанные отклонения
- Кураторская база + производный fallback вместо ручного переписывания 12k-строчного каталога. Деривация консервативна и всегда помечена `q='C'` — «правдоподобно», а не «доказано».
- UL-кап в `applyTitration` оставлен (доза всё равно безопасна), но сырые дозы доступны через `rawDosesOut` — чтобы `checkUpperLimits` мог честно предупредить о превышении.
- `he_support_plan_result` остаётся массивом id (без миграции формата в объект).
- ~~**Две дозы витамина D3**~~ — **решено в двенадцатом проходе**: единственная базовая доза 2000 МЕ (50 мкг, 50 % UL), 5000–10000 МЕ остались только в текстах коррекции дефицита.
- ~~Дозы плана остаются ТИПОВЫМИ (DEFAULT_DOSAGES/каталог), а не титрованными~~ — **решено в семнадцатом проходе**: доза нутриента одна на всех поверхностях (`resolvePlanDose`: вес-таблица + потолки UL), `applyTitration` переводит её в единицу реестра и капает по UL, расписание строится из карточки плана. Отдельной аллометрической модели (`normalizeDoseByWeight` для нутриентов) больше нет; функция осталась только там, где её вызывают другие движки. D3 — единая база 2000 МЕ при 70 кг, вес-рост до UL 4000 МЕ; магний 200 мг (2.5 мг/кг, ≤UL 350); цинк ≤UL 40.
- ~~UL-контур проверял карту титрации~~ — **решено в тринадцатом проходе**: `checkPlanUpperLimits` считает по фактическим дозам плана (`resolvePlanDose`), канонизирует алиасы (`selenium_yeast`, `methylfolate`, `p5p`), переводит витамин D из МЕ в мкг и различает `UL` / `SafeLevel` по `UlWarning.limitKind`. `ClinicalGuidance` (NAC, CoQ10, B12, K2, хром) в UL-блок не попадает — это ориентиры, а не пределы.
- B6/P5P 25 мг остаются в плане: превышение EFSA UL 12 мг показывается предупреждением с рекомендацией «снизить до ≤UL под контролем врача», а не молчаливым капом. 25–50 мг — терапевтический коридор протоколов приложения (пролактин), кап — продуктовое решение. Магний/цинк, для которых вес-доза противоречила UL, наоборот приведены к пределу.
- 16 сопутствующих препаратов каталога (НПВС, ГКС, антиконвульсанты, иммунодепрессанты, эстрадиол/кортизол/глюкагон) сознательно НЕ получают k-покрытия: они не снижают риск, а учитываются во взаимодействиях. Классификация вынесена в `CONCOMITANT_ONLY_IDS` + `isSupportSubstanceId()`, чтобы это не выглядело «дырой в данных» и не разрасталось молча.
- Рекомендация при превышении UL изменена сознательно: вместо «снизить до ≤1.5×UL» (совет выше самого предела и противоречил UL-капу плана) — «снизить до ≤UL» + фактическая применённая доза. Это меняет текст, но не числа плана.
- ~~«Контроль дозировок» со своей таблицей UL~~ — **сведено в двенадцатом проходе**: `checkStackToxicity` читает `NUTRIENT_LIMITS_V2` (производный `SUPPLEMENT_UPPER_LIMITS`), пересчёт соли → элементарное вещество — `src/data/elemental-dose.ts`. Отличие от плана остаётся только по источнику дозы (типовая доза каталога vs титрация), и оно подписано в UI.
- Женский `notification-engine` сознательно **не** вводит фазовую модель цикла (это отдельная продуктовая фича): E2-алерты у женщин включаются только там, где фаза не нужна для интерпретации — краш на ИА (<20) и уровень выше типичного овуляторного пика (>400). Физиологические 20–400 пг/мл и низкий E2 без ИА не тревожат. Порог HCT «ургент» = ULN+4 выбран по градации приложения (♀ 44/48/52), а не как отдельная клиническая рекомендация.
- `notification-engine` до пятнадцатого прохода не имел UI-поверхности: `checkNotifications` вызывался в `Calc.mapper`, но результат отбрасывался. Закрыто баннером `CalcNotificationsBanner` (см. ниже): алерт виден до явного закрытия, закрытие стартует cooldown правила.
