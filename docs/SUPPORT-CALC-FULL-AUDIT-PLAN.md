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
- Остаётся (P2): `Calc.mapper.tsx:2349` (HCT-градация), `Calc.labs-derived.ts:247-253`, `risk-engine-v7-matrix`/`training-calendar`, `notification-engine`, `estimateCardioRisk(entries, {sex})` — по желанию.

### §6.4 Женские ПРОТОКОЛЫ «Женщины и ААС» — сверка с приложением (P1)
> ✅ **Выполнено (P1, `7ffd3e93`, без пуша).** Протокол внедрён (13 табов, коммиты `7c9dc7f08/8f0df35f9/e9e9cfdfa/4fe56401`) и покрыт тестами (25/25 + e2e). Согласованность контента протокола с движками после §16.3:
> **Обновление таба «Препараты» (раунд «раздел препаратов», `3f3cb71a`):** все позиции согласованы с движком — женские пороги/флаги в примечаниях каждой строки (оксан 10/20 мг/день, тест 10–20 мг/нед и репро-риск при T>6, нандролон 50–75/125-граница, метан 5–10, примо 50–75, мастерон 75–100, болденон HCT 48/52); добавлены строки **DHB** (5α-восстановлен) и **SARMs S23/YK-11** (абсолютные противопоказания); либидо-эффекты (стан ⬇, трен ⬇⬇, анастрозол «не обнулять E2»); интро про авто-слой (пороги+флаги+витекс/инозитол поверх мужского набора). В таб «Дозы» добавлены таблица андрогенных индексов и примеры расчёта, шапка протокола указывает на калькулятор (`504eed54`). Тесты: женский 25/25, аудит 61/61; `tsc` 0.
1. **Единый источник порогов**: движок `FEMALE_AAS_PROFILES` (22 профиля, `female-aas-risk.ts`) ↔ UI `FEMALE_VIRILIZATION_CALC` (14 AAS, `supportProtocolWomenData.ts`) ↔ таблицы доз таба «Дозы» — свести или кросс-лок-тест на согласование red-порогов (сейчас значения совпадают, но два источника).
2. **Сверка 11 «примерных протоколов поддержки»** женского таба с общими протоколами приложения (Печень, Гематология, Пролактин, Липиды/E2, PostCycle): дозы/пороги не конфликтуют, нет дублей, кросс-ссылки двусторонние.
3. **Женские пометки в общих протоколах** (там, где показываются мужские нормы): Печень (ULN 31), Гематология (HCT 48/52), Пролактин (женские пороги), E2 (фаза-зависимо) — добавить «♀ …» строки по образцу таба «Лабы».
4. **Каталог рецептурных женских позиций**: `spironolactone` — нет записи в `support-catalog-*` (только механизмы/interactions); решить: добавить каталог-запись (флаг «только врач») или оставить протокольным флагом.
5. **Паспорт/калькулятор доз**: проверить, что новые записи `vitex`/`inositol` подхватываются паспортом вещества и расчётом доз (как `getProfile`-зависимые), без «по инструкции».
6. **Фертильность/ПКТ**: сверка женского таба «Контрацепция/Фертильность» с `FertilityPCTScreen` — не предлагает ли общий экран мужские меры (Clomid/hCG) женщинам без оговорки.

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
12. ⏳ **Остальные пункты §6.2 — осознанно отложены**: `training-calendar.engine.ts` LAB_REFERENCE_DB (у `interpretLabValue`/`analyzeLabPanel` нет прод-потребителей — менять нечего); `notification-engine` (женские алерты требуют фазовой модели E2 — иначе ложные тревоги ×2-3 в неделю); `estimateCardioRisk(entries, {sex})` — контракт: параметр пока не используется, менять семантику риск-скоринга без клинической модели не стали.
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

### Финал
`npm run type-check` — 0 ошибок; `npm run verify:apk-design` — OK; широкий прогон (`src/engines` + `src/ui/components` + `src/ui/screens/__tests__` + `src/ui/__tests__`, 975 файлов): **14 253 теста зелёные**, 1 падение — предсуществующее и не связанное с правками: `diary-mmc-checkin-integration.test.tsx` — ожидает «2 сетов» вместо «2 сета» после `8aeb72252` (воспроизводится на HEAD-версиях). Ранее отмеченное `risk-women-deeplink.test.tsx` (`initialSubTab='women'`) в этот круг не входит и тоже воспроизводится на HEAD.
Контрольный прогон `src/engines` + `src/data` + `src/ui` целиком (1556 файлов): **19 901 тест зелёный**, 20 skipped, 1 падение — то же самое предсуществующее (`diary-mmc`).
Шестой проход (честность производного покрытия): `src/engines` — **13 857 зелёных**, 20 skipped, то же единственное предсуществующее падение; `src/ui` целиком (632 файла) — **6 034 зелёных**.
Седьмой проход (натуральная единица доз + честность сохранённого плана): `src/engines` (921 файл) — **13 850 зелёных**, 20 skipped, то же единственное предсуществующее падение (`diary-mmc`); `src/ui` целиком (633 файла) — **6 041 зелёный**.
Восьмой проход (честное покрытие каталога): итоговый прогон после всех правок — `src/engines` (922 файла) — **13 854 зелёных**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, ожидает «2 сетов» вместо «2 сета»); `src/ui` целиком (635 файлов) — **6 051 зелёный**, 0 падений. `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Девятый проход (честное покрытие механизмов): контрольный прогон `src/engines` + `src/ui` (1557 файлов) — **19 913 тестов зелёные**, 20 skipped, 1 падение — то же предсуществующее (`diary-mmc-checkin-integration.test.tsx:111`, ожидает «2 сетов» вместо «2 сета»); `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

Десятый проход (честное покрытие в плане): `src/engines` (923 файла) — **13 867 зелёных**, 20 skipped, единственное падение предсуществующее (`diary-mmc`, «2 сетов» vs «2 сета»); `src/ui` целиком (637 файлов) — **6 064 зелёных**, 0 падений; `npm run type-check` — 0 ошибок, `npm run verify:apk-design` — OK.

### Осознанные отклонения
- Кураторская база + производный fallback вместо ручного переписывания 12k-строчного каталога. Деривация консервативна и всегда помечена `q='C'` — «правдоподобно», а не «доказано».
- UL-кап в `applyTitration` оставлен (доза всё равно безопасна), но сырые дозы доступны через `rawDosesOut` — чтобы `checkUpperLimits` мог честно предупредить о превышении.
- `he_support_plan_result` остаётся массивом id (без миграции формата в объект).
- **Две дозы витамина D3 живут сознательно** и не сводятся: витринная/клиническая 5000 МЕ (`DEFAULT_DOSAGES`, каталог, протоколы титрации, стеки) и расчётная UL-безопасная ≈2000–2200 МЕ (titration-карта в МКГ, `NUTRIENT_UL` = 100 мкг). План показывает первую, расписание движка (`CalculatorResult.schedule`) — вторую; автоматическое сведение изменило бы либо клиническую рекомендацию, либо UL-математику. Зафиксировано как открытый продуктовый вопрос, а не «исправлено» наугад.
- Дозы плана остаются ТИПОВЫМИ (DEFAULT_DOSAGES/каталог), а не титрованными: `applyTitration` — персональная ramp-up/UL-логика движка; сведение в один источник требует решения по D3 (см. выше).
- 16 сопутствующих препаратов каталога (НПВС, ГКС, антиконвульсанты, иммунодепрессанты, эстрадиол/кортизол/глюкагон) сознательно НЕ получают k-покрытия: они не снижают риск, а учитываются во взаимодействиях. Классификация вынесена в `CONCOMITANT_ONLY_IDS` + `isSupportSubstanceId()`, чтобы это не выглядело «дырой в данных» и не разрасталось молча.
