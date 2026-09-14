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

**Напоминание из прошлой сессии:** P0 выполнен (`a5ce655f`, `706c5b81`, `14e1df74d`, запушены); женские протоколы в приложении полные (59/59 тестов + закрыт гэп дозировок vitex/inositol).
