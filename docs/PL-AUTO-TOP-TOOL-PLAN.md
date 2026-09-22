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
- 2.3 ✅ Один набор % прикидов: `pro/pl-attempts.engine` (StrengthAnalysisHub) переведён на канон `MEET_STRATEGY_PCT` (`competition-attempts`): safe→conservative 90/95.5/100, standard→balanced 92/96/102, record→aggressive 93/97/105; второй набор 92.5/97.5/102.5 удалён. Осознанный re-baseline `strength-hub-p5` (180 кг: 167.5/175/185 → 165/172.5/182.5) с комментарием «было→стало».
- 2.4 ✅ **Единый реестр стартов** (решение пользователя «да — делай»): NEW `pl-meet-registry.engine.ts` — канон `he_pl_macro.competitions` (id/неделя года/дата/приоритет), `plMeetList` остаётся надстройкой (федерация/заявленные ПМ/стратегия); `mergeMeetRegistry` делает lossless-миграцию обоих направлений (легаси-старт → событие года; событие без старта → старт с дефолтами; склейка по id/имени; неделя года главнее при конфликте), `syncCompetitionsFromMeets` — обратная запись upsert/удаление с сохранением `notes/cycleId/cycleIds`. Вшито: `SRCBBScreen` гидратирует слияние при монтировании и по `he-pl-macrocycle-updated`, обратно пишет старты; **фикс**: правки `competitions` в `MacrocyclePanel` теперь персистятся в `he_pl_macro` (раньше терялись при перезагрузке, если не жать «Построить макроцикл»). Если год не построен — поведение прежнее (локальный список, без выдумывания событий). Тесты: `pl-meet-registry` 8/8 + wiring-гард 2/2; круги 1212/1212.
- 2.7 ✅ Единый контур печати/переключателя: NEW `CalendarViewSwitch` — один компонент в обоих местах `PLPlanView` (дубль разметки убран, aria-pressed, guard-тест); печать тапера в `PLCompetitionTab` сведена к одному `handlePrintTaperPlan` (inline-копия `window.open` удалена, канон `buildPLTaperPrintHtml` получил опциональную строку данных `metaLine` — федерация/стратегия/ПМ); экспорт из «Справки» и `PLPlanView` уже используют один `pl-export.ts` — подтверждено, дублей реализации нет.
- Проверено: `tsc --noEmit` — по моим файлам 0 (2 ошибки в `ArticlesScreen.tsx` — чужой коммит `2a907558a` параллельного агента, не тронут); круги lms+SRCBBScreen_parts 1193/1194 и расширенный (TrainingScreen_parts 1392/1392 + мосты) 1241/1242 — единственный красный предсуществующий `pl-auto-regressions`; unhandled `URL.revokeObjectURL` (ExerciseLabMerged) — чужой предсуществующий.

### Фаза 3 — единый дизайн (P1) — ✅ ВЫПОЛНЕНА ПОЛНОСТЬЮ (21.09.2026 токены+цвет; 22.09.2026 структура)
- ✅ Токены едины: `SRCBBScreen`, `PLPlanView`, `PLCompetitionTab`, `TaperCoachCard`, `SessionPlayer` больше не определяют локальные `CARD/SMALL/BTN/BTN_GHOST/IN` — импорт из кита `TrainingScreen_parts/training-ui` (единые радиусы 16/12, стекло, кнопки 44px).
- ✅ Серый→белый: 37 замен `color: rgba(255,255,255,0.xx)` → `#fff` в 9 живых PL-файлах (рамки/фоны не тронуты; печать `pl-export.ts` исключена).
- ✅ Guard-тест `pl-card-design` (нет локальных токенов, нет серого текста, карточные файлы импортируют кит).
- ✅ **Структурная миграция на `BbCard/BbFoldCard` (22.09.2026)**: кит перенесён в `training-ui.tsx` (единственный набор; `bb-auto-constructor-shared.tsx` — ре-экспорт), `BbCard`/`BbFoldCard` получили аддитивные `right/className/id/style`/`right`-слот у fold.
  - `PLPlanView.tsx`: шапка плана → `BbCard` (📋 + бейдж календаря), «Как собран план»/«Расчёты цикла»/«Прогрессия ПМ» → `BbFoldCard`, «Слабые точки СРЦ» → `BbCard`.
  - `PLSeasonBuilder.tsx`: корень → `BbCard` (🧩 + переключатель режима в `right`), «Циклы между соревнованиями» → `BbFoldCard defaultOpen` (интерактив согласий не прячется).
  - `PLToolsCard.tsx`: все 6 блоков — кит (OPL → fold, Frequency → fold `right=«Применить в план»`, Attempt/Traffic/VBT/Sheiko → `BbCard`).
  - `PLCompetitionTab.tsx`: корень → `BbCard` (🏁, статус-строка в `right`).
  - `MacrocyclePanel.tsx`: локальный `SectionCard` удалён → `BbCard` («Фазы», «Макроцикл (вертикально)», «Сборка года по конструкторам»); `SectionHead` остаётся заголовком под-секций.
  - `SRCBBScreen.tsx`: «Питание», heatmap объёма, «Тренды e1RM», «Тапер/пик в макроцикле» → `BbCard`.
  - `BlockView.tsx`: PowerSheets → `BbFoldCard` (свёрнут по умолчанию, класс `.pl-blockview` сохранён).
  - `TrainingPopups.tsx`: `ExpandableCard`/`MetricCard` → кит-стиль (иконка-тайл + 12.5/800 + верхняя кромка; `.pl-expandcard`/`.pl-metriccard` и тексты «▼ подробнее/▲ свернуть» сохранены, у fold — `aria-expanded`). Обвязка/тайл/заголовок/бейдж вынесены в кит-хелперы `bbCardChrome/bbIconTile/bbCardTitle/bbCardBadge` (training-ui) — попапы берут значения оттуда, локальных копий нет (DOM не менялся: APK-слой `styles-native` селекторы `.pl-expandcard > …` целы).
  - `SessionPlayer.tsx`: только шапки — верхняя кромка акцента + заголовок недели 12.5/800.
  - DOM-контракты: re-baseline только 3 ассертов `🧩 Сборка года по конструкторам` → `Сборка года по конструкторам` (иконка вынесена в тайл), комментарии «было→стало».
  - Guard расширен: живые PL-файлы обязаны использовать `BbCard`/`BbFoldCard` из кита, локальных `SectionCard`-дублей нет, `TrainingPopups` берёт обвязку из кит-хелперов (`bbCardChrome`/`bbIconTile`, без локальных литералов кромки/тайла), добавлены DOM-дампы кита и живой карточки (`BlockView`) с проверкой кромки/тайла/12.5/aria-expanded.
- Проверено: `tsc --noEmit` 0 по всему проекту; `SRCBBScreen_parts` 168/168; `TrainingScreen_parts` 1397/1397 (+чужой unhandled `revokeObjectURL`); `src/engines/lms` 1049/1049; `verify:apk-design` OK.

### Фаза 4 — гигиена данных и кода (P2) — ◐ ВЫПОЛНЕНА ЧАСТЬ (21.09.2026)
- ✅ Алиасы циклов приведены к существующим id каталога (после keep-first дедупа): `ohp_bar→ohp`, `ohp_seated_db→bench_db` («жим гантелей вниз головой»), `lateral_raise_v2→lateral_raise` / `front_raise_db` («перед собой»); добавлен комментарий-контракт. **Красный `pl-auto-regressions` позеленел** — круг lms+SRCBBScreen_parts **1197/1197, 0 падений**.
- ✅ Удалён мёртвый файл `src/engines/lms/periodization-methods.ts` (0 импортёров, включая тесты) + осиротевшие `bbChart` и `methodHints` в `SRCBBScreen`/`PLPlanView` (сеттер жил только в удалённой BB-вкладке «Методики» — бейдж был недостижим).
- ✅ Псевдо-упражнения источника («Отдых», «Тест: проходка (до макс)») больше не портят метрики: NEW `isPseudoExercise` в `lms-metrics.engine`, фильтр в `calcSessionMetrics` (и, через него, в `calcCycleMetrics`/`calcCycleMetricsAggregate`) — не идут в КПШ/тоннаж/интенсивность и не считаются в `exerciseCount`; строки в плане/UI сохранены. NEW `pl-metrics-pseudo.test.ts` 3/3. Круг lms+UI **1200/1200**.
- ℹ️ Проверка «мёртвых экспортов» (`TAPER_MODE_DESCS`, `hasExplicitWeeks`, `buildSeasonWithCompWindow`, `liftKeyOf`, UI-хелперы `pl-peak-cycle-taper`) показала: они залочены собственными тестами (10 тестов) → удаление отменено, API сохранён (не мёртвое по контракту).
- ✅ Висячие ссылки замен вычищены: в `exercise-catalog.ts` 57 ссылок `'ohp_bar'`/`'ohp_seated_db'` → живые `'ohp'`/`'db_press'` (записи-определения вытесненных id не тронуты, id-count ассертился скриптом); также `bb-builder` (мёртвый id в пуле), `bb-stimulus-target` (2 списка), `bb-sfr-db` (мёртвый ключ → `db_press`), `bb-exercise-levels` (дубль-ключ `ohp_bar`), `pl-correction-exercises` (`canReplace`). Теперь правила замен/SFR/регрессий реально работают. Круги зелёные (lms+UI+bb-target: **1231/1231**).
- 🔍 Замер `sessionsPerWeek` vs явные недели (probe, удалён): 24 цикла с расхождением, из них **19 — плановые короткие недели делода/тейпера** (cycle-07, block-*, sheiko-*, smolov, candito-6, wendler-*, rts-9, tsa-9 и др. — метаданные = типовая неделя, менять не нужно), **5 — реальный дефект данных**: `juggernaut-2`, `korte-3x3`, `cube`, `russian-squat`, `src2-solovyov-bench-28` хранят **одну сессию в неделе** при заявленных 3–4×/нед (план из них = 1 сессия/нед). Правка размножит сессии по неделям → **меняет планы** (объём ×3–4) — вынесено на решение; альтернатива без смены математики (spw=1 + исключение из 3–4-дневных подборов) делает честными метаданные, но циклы становятся неприменимы на 3–4 днях.
- ✅ **Решение пользователя по 5 дефектным циклам**: корректно пересобрать нельзя → **удалены** `juggernaut-2`, `korte-3x3`, `cube`, `russian-squat`, `src2-solovyov-bench-28` (файлы + индекс + `SPEED_CYCLE_IDS`); реестр 132→127, PL-циклов 89→84, advanced-фильтр 66→65 (re-baseline с комментариями). Круги lms+UI **1238/1238**.
- ⏸ Решение пользователя: PL-делод-инференс — **не делаем** (зафиксировано).
- ⏸ Остаток (по решению/чистке): записи-определения вытесненных id в каталоге (keep-first их не пропускает); dead bio-маппинг для вытесненных id (`exercise-id-mapping.ts`). Полная структура `BbCard/BbFoldCard` — ✅ выполнена в Фазе 3 (22.09.2026).

## §7. Критерии готовности
- Любой UI-путь не меняет `LMS_CYCLES` (snapshot-тест) и не применяет изменённый цикл без явного согласия.
- `tsc --noEmit` 0; PL-тесты зелёные (кроме документированного `pl-auto-regressions`).
- Каждая фаза — отдельные коммиты строго pathspec своих файлов, чужие WIP не тронуты.

## §8. Границы (не делаем в Фазе 0)
- Пересборка архитектуры сезона/годового плана «с нуля» — только точечные consent-гейты.
- Изменение математики ПМ/тапера/объёмов — Фаза 1+.
- Дизайн-миграция карточек — Фаза 3 (после честности).

## §9. Промпт Фазы 3-остатка — ✅ ВЫПОЛНЕН (22.09.2026), историческая запись

> Статус: задача выполнена в раунде 22.09.2026 (см. Фазу 3 §6 и запись в AGENTS.md).
> Кит вынесен в `training-ui.tsx`; все 9 живых PL-файлов + `TrainingPopups` переведены на
> `BbCard`/`BbFoldCard`; guard расширен на структуру и DOM-дампы; круги зелёные.
> Ниже — исходный промпт (для истории).

> **Задача**: довести структурную подачу карточек ПЛ-авто до эталона `BbCard`/`BbFoldCard`
> (`src/ui/screens/TrainingScreen_parts/bb-auto-constructor-shared.tsx`) — не только токены/цвета
> (это уже сделано), а структуру: иконка-тайл + заголовок 12.5/800 + верхняя кромка акцента,
> сворачиваемые секции (`BbFoldCard`) для длинных блоков. Только Edit/Write + vitest/tsc;
> чужие WIP не трогать; коммиты строго pathspec.
>
> **Область (живые PL-файлы)**: `SRCBBScreen.tsx`, `SRCBBScreen_parts/PLPlanView.tsx`,
> `PLCompetitionTab.tsx`, `PLSeasonBuilder.tsx`, `PLToolsCard.tsx`, `MacrocyclePanel.tsx`
> (SectionCard → BbCard), `SessionPlayer.tsx` (только шапки карточек, не логика), `BlockView.tsx`,
> `TrainingPopups.tsx` (ExpandableCard/MetricCard → единый fold-стиль).
>
> **Обязательные условия**:
> 1. DOM-контракты сохранить: тексты/роли/aria/`data-*`-хуки не переименовывать (159 UI-тестов
>    SRCBBScreen_parts должны пройти без правок; при неизбежном изменении — re-baseline с
>    комментарием «было→стало»).
> 2. `BbCard` импортировать из `bb-auto-constructor-shared.tsx` (или вынести общий кит в
>    `training-ui.tsx`, если импорт из BB-файла создаёт цикл) — без третьего набора токенов.
> 3. Сворачивать только длинные вторичные блоки (детали цикла, отчёты, справка), критичные
>    статусы (план/вердикт/требуется согласие) оставлять развёрнутыми.
> 4. Прогон: `tsc --noEmit` 0; `SRCBBScreen_parts` + `TrainingScreen_parts` + `src/engines/lms`
>    зелёные; `verify:apk-design` OK; скриншот-проверка структуры через DOM-дамп (заголовок+иконка+крем).
> 5. Обновить AGENTS.md (запись раунда) и §6 Фазы 3 этого плана.
>
> **Критерий готовности**: карточки ПЛ визуально и структурно неотличимы от ББ-авто (один кит,
> одинаковые шапки/кромки/фолды), все круги зелёные, новых токенов/копий разметки ноль
> (guard-тест `pl-card-design` расширить на структуру: `BbCard`/`BbFoldCard` используются,
> локальных `SectionCard`-дублей нет).

## §10. Аудит-раунд Sep 22 2026 (P0/P1 + P2) + делод по кнопке — ✅ ВЫПОЛНЕНО ПОЛНОСТЬЮ

Полный аудит 4 направлений (движки/UI/данные/статус плана) с перепроверкой чтением; закрыто:

- **Делод по кнопке (запрос пользователя)**: NEW `src/engines/lms/lms-deload.engine.ts`
  (`pickDeloadWeeks`/`applyPLDeload`/`planHasDeload`): делод применяется к САМОМУ плану
  (объём ×volumeMult, RIR+shift, флаг `deload`, пересчёт метрик дня/цикла/landmarks),
  защищённые недели (meet/mock/post/taper) и повторные клики пропускаются с причиной,
  пустой список недель → ближайшая подходящая от текущей; вход не мутируется.
  Проводка: `SRCBBScreen` (buildSrc/buildSrcMacrocycle/мост kind `deload`/реальный
  «↩ Убрать делод»), конфиг персистится (`plDeloadCfg`) и переприменяется при сборке;
  `PLPlanView` — маркер `🔋`, баннер `data-pl="deload-banner"`, кнопка `data-pl="deload-remove"`.
  Тесты: `pl-deload` 7/7, `pl-deload-wiring` 6/6.
- **P0**: `selectedCycleId` удалённого цикла больше не роняет план (`PLPlanView:979` guard +
  валидация при загрузке сессии); `he_pl_session` пишется merge-записью — больше не теряет
  `season`, `peds/pedDoses/courseIntensity` и deload-конфиг.
- **P1**: mrv-мост в ПЛ — честная заметка (а не тихий no-op); «ℹ️ в плане» → реальный
  «↩ Убрать тапер из плана» (снимок недель `he_pl_prev_weeks_v1`); `progressionRationale`
  уважает `pmCap` (+тесты); `detectLift('Приседания из ямы')` → squat (+тесты); `pl-tonnage-gate`
  флагает только РОСТ, снижение — заметка `ok` (+тесты); тихие catch моста → заметки;
  слабая сторона диагностики (`diagnosticWeakSide`) доезжает до плана/сезона/пролётов;
  сезон: индексы `consents/selections` больше не съезжают (`slotIndex`, `enabledIdxOf`,
  swap при перемещении, персист вкл/выкл); нулевое окно между стартами даёт НЕ пустую
  стартовую неделю (+тест).
- **P2 (часть)**: `rpeAttempts` → канон `MEET_STRATEGY_PCT`; удалён мёртвый `TAPER_MODE_DESCS`;
  CJK в `training-load`; неиспользуемый `tw` в `pro/taper`; мёртвый JSX в `PLCompetitionTab`;
  честные тексты (PED-белок, федерация, правка недели); полный словарь `PL_WEAKPOINT_LABELS`;
  чистка импортов `PLPlanView`.
- **Проверено**: `tsc --noEmit` 0; `src/engines/lms`+`SRCBBScreen_parts` **1241/1241 (74 файла)**;
  `TrainingScreen_parts` **1400/1400 (154 файла)** (+чужой unhandled `revokeObjectURL`);
  `verify:apk-design` OK.

### §10.1 Промт сессии P2 — ✅ ВЫПОЛНЕН ЦЕЛИКОМ (Sep 22 2026, см. §10.2)

> Задача: закрыть остаток P2 аудит-раунда ПЛ-авто (Sep 22 2026). Репо `D:\BodyBuildHealth`.
> Никаких изменений математики планов без явного согласия; только Edit/Write + vitest/tsc;
> чужие WIP не трогать; коммиты строго `git commit -m ... -- <свои файлы>`; НЕ пушить.
>
> 1. Персист черновиков тапера: `taper-state.tsx` — `taperPlan` и `taperAttemptOverride`
>    не сохраняются в `he_pl_session` (после F5 карточка «📋 Тапер-план» пустая, кнопки
>    печати/сохранения disabled, хотя статус «тапер: встроен/готов» — главный писатель в
>    `SRCBBScreen` merge-запись уже есть, добавь `plTaperPlan`/`plTaperAttemptOverride`
>    (кап по размеру, `validateSavedSrc`-подобная проверка формы) + восстановление.
>    Тест: ремаунт провайдера видит план; битый стор → пусто.
> 2. Мёртвый код UI: `SRCBBScreen.tsx` — неиспользуемые импорты/state (bridgeSessions/
>    bridgeWeek/bridgeAutoreg/progressSnap/peakRirTarget/appliedMethods/PL_WP_OPTIONS/
>    toggleWeak/WEAK_GROUPS и список из аудита), если удаление не ломает tsc — убрать;
>    `PeakingPanel.tsx` (41КБ) и `ProMetricsPanel.tsx` (29КБ) не смонтированы нигде —
>    принять решение: подключить или помечены `@deprecated` с причиной.
> 3. `PLToolsCard` OPL-импорт: пишет `he_opl_history`/`he_opl_name` без читателя — либо
>    отрисовать историю (DOTS-график), либо убрать запись и оставить честную подсказку.
> 4. Данные циклов (аккуратно, lock-тесты обязательны): нормализация RPE/T-суффиксов имён
>    («Присед @RPE8», «Жим лежа T2») в резолвере `lms-builder` (`findCatalogExerciseByLabel`),
>    мёртвые ключи `exercise-id-mapping.ts` (42 шт — стираются keep-first дедупом),
>    гард `pct > 1.1` (15 проходок) в валидации/движке; `LMS_EXERCISES` (xlsm-шум) — merge
>    с каталогом по плану §3.0 (реальные id/имена), без выдуманных упражнений.
> 5. `assembleSeasonPlan` при полной блокировке согласием подставляет `LMS_CYCLES[0]` как
>    template с пустыми метриками — заменить на честный `null`-шаблон/флаг или первый
>    сегмент плана, покрыть тестом.
> 6. Памятка: полный прогон `npx vitest run src/engines/lms src/ui/screens/SRCBBScreen_parts
>    src/ui/screens/TrainingScreen_parts` + `tsc --noEmit` (NODE_OPTIONS=12GB) + `verify:apk-design`;
>    обновить AGENTS.md и §10 этого плана.

### §10.2 Результат P2-остатка (Sep 22 2026) — ✅ выполнено кодом, без изменения математики планов

1. **Персист тапера** — `taper-state.tsx`: `validateSavedTaperPlan` (weeks/days/exercises +
   `template.meta`) и `validateSavedTaperAttemptOverride` (числа 0..3); восстановление в
   `usePLTaperState`; merge-запись `he_pl_session` в `SRCBBScreen` пишет `plTaperPlan`
   (кап `TAPER_PLAN_PERSIST_MAX_CHARS = 1_500_000` символов; `null` = честная очистка) и
   `plTaperAttemptOverride`. Тесты: ремаунт провайдера видит план/прикиды; битый стор → пусто;
   отсутствие ключей — обратная совместимость (`taper-state` 3→6).
2. **Мёртвый код UI** — `SRCBBScreen`: удалён write-only мост план→сессия
   (`he_bridge_sessions`/`he_bridge_progress`, `bridgeSessions/bridgeAutoreg/progressSnap/
   bridgeWeek` + мемо), `WEAK_GROUPS/toggleWeak/PL_WP_OPTIONS/PL_WEAKPOINT_LABELS/peakRirTarget/
   appliedMethods/BB_WM_KEYS/BB_WM_RU/setBbWm/displayPhaseForWeek/weekVolumeOf`, неиспользуемые
   деструктуризации тапер-контекста и 44 импорта; `PLPlanView` — api без `bridgeSessions/
   setBridgeWeek/bridgeWeek` (и без типа `BridgeSession`). Решение по панелям без маунта:
   `PeakingPanel`/`ProMetricsPanel` → `@deprecated` с причиной (тапер/пик — `PLCompetitionTab`+
   `TaperPlannerTab`, ББ-преп — `BbAutoConstructor`; `FFChart` из ProMetrics живой).
   Source-guard — в новом `pl-p2-data-hygiene`.
3. **OPL** — `PLToolsCard` читает `he_opl_history` при монтировании и рисует
   `data-pl="opl-history"` (SVG DOTS + лучший старт + диапазон дат); запись `he_opl_name`
   удалена; битый стор → пусто. Тесты `pl-tools-card` 5→8.
4. **Данные циклов** — `stripCycleNotation` + экспорт `findCatalogExerciseByLabel`;
   +5 alias (`бицепс стоя со штангой`, `разгиб. с гантелью из-за головы`, `приседания со
   штангой на груди`, `жим лежа с паузой`, `тяга в наклоне`); 57 мёртвых ключей
   `exercise-id-mapping.ts` удалены; `LMS_EXERCISES` 78→73 с реальным `catalogId` у каждой
   записи (шум xlsm удалён); `MAX_SOURCE_SET_PCT = 1.3` — единый гард для 15 проходок
   (>110%, макс 129.25%) в 7 циклах, UI-редактор `% ПМ` до 130%. Lock-тесты:
   `pl-p2-data-hygiene` 14/14.
5. **Сезон** — `assembleSeasonPlan` при полной блокировке: `blocked: true`, `template` =
   цикл первого сегмента или пустой шаблон-заглушка (никакого чужого `LMS_CYCLES[0]`);
   `lms-season` 26→29.
6. **Проверено** — `tsc --noEmit` 0 по всему проекту (12GB); `src/engines/lms` 52/1082;
   `SRCBBScreen_parts` 23/182; `TrainingScreen_parts` 154/1402 (+чужой unhandled
   `revokeObjectURL`); `verify:apk-design` OK. Коммит pathspec своих файлов, без пуша.

### §10.3 Остатки после P2 (зафиксированы и выполняются, Sep 22 2026)

Записаны честные «не полностью» из отчёта P2-остатка; порядок = безопасность/ценность.

1. **⏳ BB-ветка `SRCBBScreen`** (решение требуется). Экран монтируется только
   `track="pl"` (`PlannerPlAuto`), `setMainTab` зовётся только с `'pl'` → недостижимы
   `buildBb`, `applyBBMacrocycle`, `bbDaysArr`, `builtBb/bbWeekSel/bbWorkMax/bbGoal/...`,
   ветка `'bb'` pending-apply и роутинг `applyExternal` по bb-циклам. Удаление ветки —
   крупная операция: `bbLevel` завязан на `baseMrv`→`pedAdapt` (PED-карточка ПЛ),
   `he_bb_session`-запись пересекается с BbAutoConstructor, `saveTrainingProfile(workMax)`
   пишет профиль. **Решение (Sep 23 2026): оставить как неактивный резерв** — код не
   менялся (аудит подтвердил: `SRCBBScreen` монтируется только из `PlannerPlAuto`
   `track="pl"`, ни один тест не рендерит `track='bb'`; удаление задело бы общие узлы без
   пользовательской ценности).
2. **✅ Имена циклов wave-2** — после RPE/T-нормализации оставалось 76/227 нерезолвленных.
   В этом раунде добавлены: alias-фолбэк в core-ветке резолвера (parenthetical: «Жим лежа
   с паузой (ME Upper)», «Дотяга (с плинтов)», «ЖЛШХ (жим широким хватом)») + 60 точных
   alias (Conjugate `DE/ME ... + цепи`, `BBB`, «до макс», «скоростная/лёгкий/негатив»,
   падежи: «Фронт-присед», «Тяга становая», «Разгибания ног сидя», «Разводка лёжа», …).
   Остаток фиксируется allowlist-локом (17): псевдо («Отдых», «Тест: проходка…»,
   «Опциональная тяга…»), arm-имена другого каталога («Пронация СБ», «Кисть РР»…),
   «Присед ТА» (WL), неоднозначные («Сгибания обратным хватом», «Жим-разводка») и плио
   («Прыжки на box», «Выпрыгивания»).
3. **⏸ Потребитель `catalogId`** (`LMS_EXERCISES`) — **Решение (Sep 23 2026): оставить на
   именах** (код не менялся). Данные и lock есть, но `diagnosticGroupForExercise` и
   `lift-assistance` остаются на именах/`groups`: parity-тест зелёный, а перевод на
   `catalogId` менял бы протоколы (re-baseline «было→стало») и дозировку диагностических
   инъекций без явной пользовательской ценности. При будущем переводе — только синхронно
   в обоих контурах (parity-лок).
4. **✅ pct-проходка в UI** — display-only пометка «проходка» для сетов >110% (не меняет
   числа; проходки уже не клампятся).
5. **✅ Кап персиста тапера** — честная заметка при отказе записи (план больше 1.5М символов).
6. **✅ OPL-хвост** — имя атлета снова персистится (`he_opl_name`) и восстанавливается при
   монтировании; сетевой путь «Найти» покрыт тестом с моком движка.
7. **✅ Верификация** — `npx vitest run src/engines/lms src/ui/screens/SRCBBScreen_parts
   src/ui/screens/TrainingScreen_parts` **229 файлов / 2675 тестов, 0 падений** (2 unhandled
   `revokeObjectURL` — чужие предсуществующие); `tsc --noEmit` **0 по всему проекту**;
   `verify:apk-design` OK; `vite build` **OK** (32.65с, PWA сгенерён). Полный прогон всего
   проекта — по запросу (тяжёлый, вне обязательного круга).

