# PL-AUTO-TOP-TOOL-PLAN — ПЛ-авто до топ-уровня

Дата аудита: 21 сентября 2026. Метод: 4 параллельных аудита кода (движки `src/engines/lms` + `src/engines/pro`, UI `SRCBBScreen` + parts, сохранность оригиналов циклов, данные/хранилища) + верификация ключевых мест чтением кода. Тесты на момент аудита: `src/engines/lms` — **1025/1026** (1 предсуществующий красный: `pl-auto-regressions` — алиасы на несуществующие id `ohp_bar`/`ohp_seated_db`/`lateral_raise_v2`), `SRCBBScreen_parts` — **144/144**.

Требования пользователя:
1. ПЛ-авто — топ-инструмент по пауэрлифтингу.
2. Дублирующие функции — убрать.
3. Одинаковый дизайн карточек.
4. **ОРИГИНАЛ ЦИКЛА меняется только по согласованию с пользователем в приложении.**

---

## §1. Карта

Маршрут: `TrainingScreen.tsx` (planningTrack `pl`) → `PlannerPlAuto.tsx:14` → `<SRCBBScreen track="pl">` → `SRCBBInner` (2354 стр.) в `PLTaperProvider` (taper-state.tsx).

Табы ПЛ: `settings` (ПМ/PED/питание/сезон), `diagnostics` (LiftMasterCard), `plan` (`PLPlanView` 1186), `charts`, `reference`, `competition` (`PLCompetitionTab` 882), `macro` (`MacrocyclePanel` 3104 + `PLSeasonBuilder` 639), `tools` (`PLToolsCard`).

Ядро: `buildLMSPlan` (`lms-builder.engine.ts` 2240), реестр 132 шаблонов (`src/data/lms-cycles`, `LMS_CYCLES`), ~35 PL-движков (`lms/*`, `pro/*`). Хранилища: `he_pl_session` (весь экран), `he_pl_macro` (годовой план, v7-сериализация), `he_pl_runtime` (исполнение), `he_lv_profile_ss_v1`, `he_srpe_sessions`.

## §2. Аудит — P0 (ломает доверие/данные)

### P0-1. Оригинал цикла не защищён и меняется без согласия
- `LMS_CYCLES` — мутабельный массив без `Object.freeze` (`lms-cycle-index.ts:149`; единственный freeze в проекте — `rir-table.ts:23`). Шаблоны — обычные интерфейсы без `readonly` (`lms-types.ts:77-87`).
- `LMSBuildOutput.template` — **ссылка на оригинал** (`lms-builder.engine.ts:1599`): мутация `plan.template` любым будущим потребителем изменит реестр для всех.
- `buildSrcMacrocycle` (`SRCBBScreen.tsx:451-551`): `weeksOverride: block.weeks` (467) + повтор недель `index % output.weeks.length` (494-497) — растяжение/сжатие/повтор **без согласия и предупреждения**.
- Годовой план: `loopWeeksToLength` (`block-builders.engine.ts:464-479,525`) повтор/обрезка недель; `selectPLCycleForBlock` (`:568,593-597`) молча **заменяет выбранный цикл** на другой (только warning-строка).
- `planSeason` при ручном выборе: цикл не найден среди кандидатов → берётся `candidates[0]` (`lms-season.engine.ts:304-314`) — note, но не согласие.
- `fitCycleToWeeks` — поверхностные копии: элементы `weeks` — ссылки на `SRDaySpec` оригинала (`lms-season.engine.ts:129,144`).
- `expandCycleWeeks` (`lms-to-pl.ts:29-30`) возвращает ссылки на дни шаблона (потребитель read-only, контракт не защищён).

### P0-2. Диалог согласия сезона врёт
- `PLSeasonBuilder.tsx:377` — `orig = raw.cycle.meta.weeks` берётся из **уже изменённой** производной (для extend/shrink `meta.weeks` = целевой) → тексты «сжать N→N».
- Кнопка «✕ Оставить как есть 1:1» (`:399-406`) пишет `consents[idx]=false` → `applyFitConsent(false)` = `strict_skip` (`lms-season.engine.ts:170-176`) → сегмент выбрасывается; «1:1» в UI недостижимо.
- В `lms-comp-gap.engine.ts:225` тот же диалог корректен (берёт `originalCycleWeeks`).

### P0-3. `buildSrc` игнорирует переданные параметры + rationale врёт
- Аргумент `weeks` не читается (`SRCBBScreen.tsx:398`→`407`).
- `faithful: true` (`:440`) → `hasExplicitWeeks` (`lms-builder.engine.ts:1132`) → `weeksOverride` игнорируется (`:1134-1136`), `peakMode/taperWeeks/peakCycleId` — no-op (гейт `!faithful && !hasExplicitWeeks`, `:1592`), `phaseVolMod = 1.0` (`:1249`), множители volumeGoal/focus/weak не применяются (`:1289`).
- При этом rationale безусловно печатает «Объём аксессуаров…», «Приоритет: акцент… (+20% объёма)», «Слабые группы… (+20% объёма)» (`:1572-1574`) — план врёт о применённых опциях.
- `dupWave` объявлен в `LMSBuildInput` (`:104`) и не используется нигде.

### P0-4. Коррекции моста не доходят до сборки
- `volumeTarget` — state, который никто не читает (`SRCBBScreen.tsx:759`, устанавливается `:1091`) → панель «Объём» моста — no-op.
- `priAdjust/rirShiftAdjust/deloadAdjust/peakAdjust/tempoAdjust` используются только в runtime-оверлеях (`:1117-1135`) — таблица плана ≠ SessionPlayer.
- Kind'ы `program/design/macrocycle/annual_block/methodology/cardio/bb_nutrition` в ПЛ-экране молча съедаются (`:1093-1094`).

### P0-5. «Дневник → план» для ПЛ не замкнут
- `lms-progression-feedback.engine.ts` (`computePLPlanFeedback`, `summarizePLFeedback`) — без единого продового потребителя (только тесты). Фактически дневник влияет на ПЛ через `diary-autoreg` (`SRCBBScreen.tsx:823`) и `pm-autoreg`.

### P0-6. Фальшивые сохранения/замеры
- `PLToolsCard.tsx:85` пишет `he_lv_profile_ss_v1` в формате `{60,70,80,slope,intercept}`, канонический читатель ждёт `{[lift]: LVPProfile}` (`strength-sport-lvp-calibration.engine.ts:34`) → «Сохранить LVP» ни на что не влияет.
- `he_opl_history`/`he_opl_name` (`:35`) — write-only; тост «график DOTS обновится» ложный.
- Frequency Planner получает вымышленные объёмы `{chest:12,back:10,legs:14,shoulders:8,arms:6,core:4}` (`SRCBBScreen.tsx:1686`); DOTS — от 83 кг male (`PLToolsCard:98`).

### P0-7. Нет разгрузок в PL-пути
- PL-билдер читает только `meta.deloadWeeks` (`lms-builder.engine.ts:1253`), а его нет у ~93 из 132 циклов; инференс `inferCycleDeloadWeeks` есть только в ББ-конвертере (`cycle-to-plan.ts:964`).

### P0-8. Данные циклов
- Псевдо-упражнения «Отдых» (`sheiko-32.ts:34`), «Тест: проходка (до макс)» (`candito-6.ts:55` и др.) попадают в КПШ/тоннаж/сессии — фильтров нет.
- `weakpoint-pl.ts:17-26` теряет 8/63 ассистентов (нет core-fallback/алиасов).
- 112 из 228 имён упражнений циклов не привязываются к каталогу.
- `LMS_EXERCISES` — шум из xlsm (`'1050-68'`, `'ОФП'`, `'Тяжелая'`, пары двойников).
- `sessionsPerWeek` ≠ числу дней в явных неделях (`block-bench-int.ts:15` и др.).

## §3. Аудит — P1 (дубли функций и контролов)

| Что | Где | Дубль |
|---|---|---|
| Авторегуляция off/auto/diary | `SRCBBScreen.tsx:1924` | `PLPlanView.tsx:359,562,624`; `PLCompetitionTab.tsx:398-409` |
| ПМ-поля | `SRCBBScreen.tsx:1474-1523` | `PLPlanView.tsx:590-608`; `PeakingPanel.tsx:180-226` |
| Настройки тапера (2 разных state одной подписи) | `macroTaperMode` `SRCBB:151` | `peakMode` `taper-state.tsx:70` |
| Кривые тапера | канон `lms-taper.engine.ts:194` | дословная копия `lms-taper.engine.ts:128-187` = `pl-peak-cycle-taper.engine.ts:118-177`; дубль `weightGoalVolumeMult`, `isoAddDays`; `pro/taper.taperPlan`; `mesocycle-progression.taperCurve` |
| Прикиды (%) | `competition-attempts.ts:20` | `pl-attempts.engine.ts:19`; `attempt-calculator.engine.ts:10` |
| e1RM/LVP | `estimate1rm.engine.ts:147` | `vbt.engine.ts:LOAD_VELOCITY_PROFILE` |
| RPE→% | `autoregulation-pro.engine.ts:20` | `rpe-table.engine.ts:29` |
| Реестры соревнований | `he_pl_session.plMeetList` | `he_pl_macro.competitions` |
| Экспорт/печать | `SRCBBScreen.tsx:1831-1855` | `PLPlanView.tsx:1080-1186` |
| «Оригинальный/С тапером» | `PLPlanView.tsx:467` | `PLPlanView.tsx:1015` |
| Сценарии | `he_macro_scenarios` | `he_annual_scenarios` |
| Мёртвые ветки экрана | BB/manual/bridge/peak_bb/methods/analytics/prometrics `SRCBBScreen.tsx:1877-2333` (маунт только `track="pl"`) | — |
| Мосты | kind `cycle` отправляется (`PeriodizationDesignerTab.tsx:743`), не зарегистрирован; `macrocycle`/`cardio` — обработчики без отправителей | — |

## §4. Аудит — P1/P2 (точечно неработающее, мёртвый код, дизайн)

- `PLCompetitionTab.tsx:520-532` — «ℹ️ в плане» чистит `taperNote`, а он гейт 5 других кнопок → рассинхрон UI и плана.
- `PLCompetitionTab.tsx:609` — мёртвое выражение `{... && null}`.
- `MacrocyclePanel` — `activePopup:'competition'` без сеттеров.
- alert/prompt вместо тостов: `AutoregPanel.tsx:61,64`, `PeakingPanel.tsx:216,224`, `RecoveryPanel.tsx:79,82`, `PlDeadpointsBarPathCard.tsx` (6 мест).
- `macroTaperMode/macroWeightGoal/macroMockMeet/macroPostMeet` не сериализуются в `he_pl_session` (`SRCBBScreen.tsx:270`) — сброс при перезагрузке.
- `autoRegOn` — только в deps (`SRCBB:786,1135,1178`).
- Мёртвый код движков (≈70 экспортов): файл `periodization-methods.ts` (0 ссылок), `lms-progression-feedback`, `pl-peak-cycle-taper.ts:48-87,184` (5 функций), `TAPER_MODE_DESCS`, `hasExplicitWeeks` (экспорт), `buildSeasonWithCompWindow`, `lms-metrics.*` (6), `rpeAttempts`, `limiterCategoriesForLift/limiterOptionsForLift/limiterProtocolFor/analyzeLimiterForLift`, `rpeWeightFor/e1RMFromRpeSet`, `VL_THRESHOLDS/vblLoad/rpeVbtDiscrepancy`, `adjustedLoad`, `planAllFrequencies`, `findBlockByPhase`, `bbTrainingFocusForWeek`, `liftKeyOf`, `findPlCorrection`, `getScheme`, `DOTS_CLASS_TABLE`, `analysesForUnified/UNIFIED_LIFT_RU`, `applicableFormulasForLift/SUPPORTED_LIFTS` и др.
- Дизайн карточек: эталон `BbCard/BbFoldCard` (`bb-auto-constructor-shared.tsx:113-160`) и `training-ui` CARD/BTN; в ПЛ 7+ независимых наборов токенов: `SRCBBScreen.tsx:88-96` (radius 12, кнопки 40), `PLPlanView.tsx:39-47`, `PLCompetitionTab.tsx:29-30,164`, `RecoveryPanel/AutoregPanel/ProMetricsPanel` (3 копии), `PeakingPanel/TaperCoachCard/SessionPlayer`, `PLToolsCard` (radius 8-10, шрифты 9-10), `TrainingPopups.tsx:233,247`. Серый текст: `SRCBB:1749,1798,1905,2021,2059,2103,2185,2233`, `PLToolsCard:47,48,68,79,80,87`, `BlockView:5,35,42,43`, `MacrocyclePanel:1723,1732`.

## §5. Оригинал цикла — целевой контракт

1. `LMS_CYCLES` и вложенные данные — **deep-freeze** после сборки реестра; dev-ассерт `Object.isFrozen`; `LMSBuildOutput.template` — клон (или `Readonly`).
2. Единый `cloneCycleTemplate()` на всех границах fit (season/macro/annual/hybrid).
3. Единый consent-контракт `needsConsent` + `applyFitConsent` — обязателен в: `fitCycleToWeeks` (уже есть), `buildSrcMacrocycle` (нет), годовая сборка `loopWeeksToLength`/`selectPLCycleForBlock` (нет), `planSeason`-substitution (нет).
4. UI сезона: `orig` — из реестра (`originalCycleWeeks(getCycleById(...))`); кнопка «1:1» — либо реально сохраняет длину цикла (меняя окно), либо честно называется «Пропустить слот (раскладка не изменена)».
5. Snapshot-тесты `JSON.stringify(LMS_CYCLES)` до/после всех UI-путей (single/season/gap/annual/macro/hybrid); движковые гарды уже есть (`pl-audit-original-preserve.test.ts`).

---

## §6. Фазы выполнения

### Фаза 0 — сохранность оригинала (P0) — ✅ ВЫПОЛНЕНА (21.09.2026)
- 0.1 ✅ NEW `src/data/lms-cycles/lms-cycle-clone.ts` (`cloneCycleTemplate`/`cloneCycleDay`/`deepFreezeCycleTemplates`); реестр глубоко заморожен в `lms-cycle-index.ts`; `LMSBuildOutput.template` — клон (`lms-builder.engine.ts`). Мутация оригинала теперь бросает TypeError.
- 0.2 ✅ `fitCycleToWeeks` (`lms-season.engine.ts`) строит производные через deep-clone (exact/extend/shrink), без ссылок на `SRDaySpec` оригинала.
- 0.3 ✅ `PLSeasonBuilder.tsx`: `orig` — из реестра (`originalCycleWeeks`), кнопка отказа честно «✕ Пропустить слот (цикл не меняем)» (было лживое «1:1», выполнявшее strict_skip).
- 0.4 ✅ `MacrocyclePanel.tsx`: панель `data-pl="macro-fit-consent"` со списком «цикл X нед → блок Y нед»; «Применить весь макроцикл» и «Начать работу по циклу» заблокированы до согласия; отзыв согласия возвращает блокировку; без расхождений панели нет (байт-в-байт поведение).
- 0.5 ✅ NEW `pl-cycle-immutability.test.ts` (9) + `pl-consent-gates.test.tsx` (4); `tsc --noEmit` 0; круги lms+UI — 1169/1170 (красный — предсуществующий `pl-auto-regressions`), расширенный круг 1369/1371 (второй красный — предсуществующий `annual-audit-fixes-2026-08`, размер года 2583.7 КБ BB-пути, к PL не относится).

### Фаза 1 — честность плана (P0) — ✅ ВЫПОЛНЕНА (21.09.2026), политика «тексты честные, математику не менять»
- 1.1 ✅ `lms-builder.engine.ts`: rationale в faithful больше не обещает «+20% объёма» по volumeGoal/focusLift/weakPoints — печатает «в дословном режиме не применяется» / «ассистенты добавлены сверху»; удалён мёртвый `dupWave`; docs `peakMode/taperWeeks/peakCycleId` помечены no-op при faithful. `buildSrc` (`SRCBBScreen`): убран weeks-аргумент (тихий no-op), из сборки убраны no-op тапер-параметры; кнопка/`cycleWeeks` показывают реальную длину оригинала; при применении блока года с другой длиной — честная заметка; баннер правки PL-блока больше не обещает «сохранить недели» (сохранение доступно только ББ).
- 1.2 ✅ `volumeTarget` (мёртвый state) удалён; мост kind `volume` теперь честно сообщает, что посетовый объём не применяется к дословному плану.
- 1.3 ✅ `lms-progression-feedback` помечен `@deprecated` с причиной (нет потребителя; подключение изменило бы математику — отложено решением).
- 1.4 ✅ `PLToolsCard`: Frequency Planner получает реальные объёмы из `plVolumeLandmarks` (хардкод 12/10/14/8/6/4 убран, пусто → честная подсказка); DOTS — реальный вес/пол профиля (+честная пометка фолбэка и `data-pl="dots-line"`); LVP сохраняется в каноническом формате `{[lift]: LVPProfile}` (+статус, было — мёртвый плоский формат); OPL-тост без ложного обещания.
- 1.5 ⏸ PL-делод (`inferCycleDeloadWeeks` в PL-путь) — отложено: меняет сами планы (политика «математику не менять»), требует отдельного решения/согласия.
- Бонус-честность: `buildSrcMacrocycle` помечает в rationale недели без собственного цикла («использована ближайшая тренировочная раскладка»).
- Тесты: NEW `pl-rationale-honesty.test.ts` 3/3 + `pl-tools-card.test.tsx` 5/5; `tsc --noEmit` 0; круг lms+SRCBBScreen_parts 1190/1191 (красный — предсуществующий `pl-auto-regressions`).

### Фаза 2 — дубли (P1) — ◐ ВЫПОЛНЕНА БЕЗОПАСНАЯ ЧАСТЬ (21.09.2026)
- 2.1 ✅ Один селектор авторегуляции: NEW `AutoRegModeSwitch.tsx` (канон меток «ВЫКЛ/🤖 Авто/📓 Авто-дневник», aria-pressed, title) — заменены 4 копии (`PLPlanView` ×3, `PLCompetitionTab` ×1); локальные `segBtn/arBtn` удалены, source-guard-тест.
- 2.2 ◐ Тапер-канон: удалена дословная inline-копия `buildPeakCycleCurveInline` — канон `buildPeakCycleTaperCurve` теперь один в `lms-taper.engine`, `pl-peak-cycle-taper` ре-экспортирует (круговой импорт разорван). `pro/taper.taperPlan` и `mesocycle-progression.taperCurve` пока оставлены (используются TaperPlannerTab/PeriodizationHub — решение об их сведении в Фазе 4).
- 2.5 ✅ Мёртвые ветки `SRCBBScreen` удалены: BB-план, manual-заглушка, bridge, BB-tools, peak_bb/methods/analytics/prometrics/bb-charts (358 строк) + осиротевшие импорты/`deriveHints`/группы табов; `subViewList.bb/manual` = []; файл 2424→2067 строк (скрипт-хирургия `.tmp/pl-deadcode-surgery.mjs` с маркер-ассертами, проверено чтением).
- 2.6 ✅ Мост `kind cycle` зарегистрирован: тип `CyclePayload` в `planner-bridge.ts` (без `as any`), дизайнер шлёт payload + `planning-track-open('pl')`, `SRCBBScreen` применяет свежий payload (ts ≤ 5 мин) при монтировании и пересобирает план. NEW тест `bridge-cycle` 4/4.
- 2.3 ⏸ Один набор % прикидов (канон `competition-attempts`) — отложено: менять цифры P2-наборов означает пересмотр выдачи в других хабах (решение пользователя).
- 2.4 ⏸ Слияние реестров соревнований (`plMeetList` ↔ `he_pl_macro.competitions`) — отложено: требует миграции данных (риск потери стартов).
- 2.7 ⏸ Один контур экспорта/печати и один переключатель «Оригинальный/С тапером» — отложено (дизайн-фаза).
- Проверено: `tsc --noEmit` — по моим файлам 0 (2 ошибки в `ArticlesScreen.tsx` — чужой коммит `2a907558a` параллельного агента, не тронут); круги lms+SRCBBScreen_parts 1193/1194 и расширенный (TrainingScreen_parts 1392/1392 + мосты) 1241/1242 — единственный красный предсуществующий `pl-auto-regressions`; unhandled `URL.revokeObjectURL` (ExerciseLabMerged) — чужой предсуществующий.

### Фаза 3 — единый дизайн (P1) — ◐ ВЫПОЛНЕНА (21.09.2026; структура BbCard — отдельным шагом)
- ✅ Токены едины: `SRCBBScreen`, `PLPlanView`, `PLCompetitionTab`, `TaperCoachCard`, `SessionPlayer` больше не определяют локальные `CARD/SMALL/BTN/BTN_GHOST/IN` — импорт из кита `TrainingScreen_parts/training-ui` (единые радиусы 16/12, стекло, кнопки 44px).
- ✅ Серый→белый: 37 замен `color: rgba(255,255,255,0.xx)` → `#fff` в 9 живых PL-файлах (рамки/фоны не тронуты; печать `pl-export.ts` исключена).
- ✅ Guard-тест `pl-card-design` (нет локальных токенов, нет серого текста, карточные файлы импортируют кит).
- ⏸ Полная структурная миграция карточек на `BbCard/BbFoldCard` (иконка-шапка, fold-поведение) не делалась — токены и цвет уже едины; шаг отложен, чтобы не ломать DOM-контракты 159 UI-тестов.
- Проверено: `tsc` 0 по моим файлам; `SRCBBScreen_parts` 159/159; `TrainingScreen_parts` 1392/1392 (+ чужой unhandled `revokeObjectURL`).

### Фаза 4 — гигиена данных и кода (P2) — ◐ ВЫПОЛНЕНА ЧАСТЬ (21.09.2026)
- ✅ Алиасы циклов приведены к существующим id каталога (после keep-first дедупа): `ohp_bar→ohp`, `ohp_seated_db→bench_db` («жим гантелей вниз головой»), `lateral_raise_v2→lateral_raise` / `front_raise_db` («перед собой»); добавлен комментарий-контракт. **Красный `pl-auto-regressions` позеленел** — круг lms+SRCBBScreen_parts **1197/1197, 0 падений**.
- ✅ Удалён мёртвый файл `src/engines/lms/periodization-methods.ts` (0 импортёров, включая тесты) + осиротевшие `bbChart` и `methodHints` в `SRCBBScreen`/`PLPlanView` (сеттер жил только в удалённой BB-вкладке «Методики» — бейдж был недостижим).
- ✅ Псевдо-упражнения источника («Отдых», «Тест: проходка (до макс)») больше не портят метрики: NEW `isPseudoExercise` в `lms-metrics.engine`, фильтр в `calcSessionMetrics` (и, через него, в `calcCycleMetrics`/`calcCycleMetricsAggregate`) — не идут в КПШ/тоннаж/интенсивность и не считаются в `exerciseCount`; строки в плане/UI сохранены. NEW `pl-metrics-pseudo.test.ts` 3/3. Круг lms+UI **1200/1200**.
- ℹ️ Проверка «мёртвых экспортов» (`TAPER_MODE_DESCS`, `hasExplicitWeeks`, `buildSeasonWithCompWindow`, `liftKeyOf`, UI-хелперы `pl-peak-cycle-taper`) показала: они залочены собственными тестами (10 тестов) → удаление отменено, API сохранён (не мёртвое по контракту).
- ⏸ Остаток (требует решения/отдельной волны): PL-делод-инференс (меняет планы); dangling `canReplace`-ссылки на `ohp_bar` в каталоге (~60 записей — не влияют на выдачу, но врут движку замен); `sessionsPerWeek` несоответствия в блок-циклах (метаданные влияют на ранжир — нужен осторожный re-baseline); `SM 48→56`-класс мелочи; полная структура `BbCard/FbFoldCard`.

## §7. Критерии готовности
- Любой UI-путь не меняет `LMS_CYCLES` (snapshot-тест) и не применяет изменённый цикл без явного согласия.
- `tsc --noEmit` 0; PL-тесты зелёные (кроме документированного `pl-auto-regressions`).
- Каждая фаза — отдельные коммиты строго pathspec своих файлов, чужие WIP не тронуты.

## §8. Границы (не делаем в Фазе 0)
- Пересборка архитектуры сезона/годового плана «с нуля» — только точечные consent-гейты.
- Изменение математики ПМ/тапера/объёмов — Фаза 1+.
- Дизайн-миграция карточек — Фаза 3 (после честности).
