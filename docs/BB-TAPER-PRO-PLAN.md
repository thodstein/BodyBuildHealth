# BB Taper PRO — план полноценного инструмента подготовки к соревнованиям

Статус: **выполнен полностью кодом** (Sep 11 2026, в worktree БЕЗ коммита). Цель: превратить тапер ББ из «финальной подводки» в
полноценный про-инструмент подготовки — от первого дня препа до show day и post-show: единый контур
записи, живой недельный луп чек-инов, живое питание по фазам, оживление уже написанного адаптивного
контента, show-day исполнение. Только тренировочный контур ББ (ПЛ/арм/стронг — не трогаем), объёмная
модель движков ББ (MEV/MAV/MRV, кривая тапера BB_TAPER_CURVE) не меняется — всё аддитивно/дедуп.

---

## 1. Аудит текущего состояния

### 1.1 Что уже есть и хорошо

**Ядро** — `src/engines/bb/bb-contest-prep.engine.ts` (3206 строк, канон):
- `BBContestPrepPlan` v2 (версионированный): блоки `preparation/taper/peakWeek`, 6 фаз
  `PrepPhaseKey` (preparation → final_preparation → taper → peak_week → show_day → post_show, :1954),
  `phases[]` с датами (`computePrepPhaseRanges` :2086), `frozenWeeks` (завершённые недели не
  пересчитываются — `shiftBBContestPrepShowDate` :2309), `safety` (противопоказания → blockedProtocol),
  `adjustments[]` (история коррекций, :3032), `testPeakWeekId`.
- Тапер: `buildTrainingTaper` (BB_TAPER_CURVE, RIR 2–4, объём 0.9→0.6), per-muscle щажение
  (ноги раньше, специализация щадится — `PER_MUSCLE_TAPER_MULT` :640), `applyTrainingTaperToBBPlan`
  идемпотентен (:1427), оркестратор `applyContestPrepToBBPlan` (:1639: режим подготовки RIR 1–3 без
  отказных техник, разметка `wk.contestPhase`, гварды от чужих проходов).
- Пик-неделя 7 дней: `buildPeakWeek` (:835, deplete→load→peak→show), вода/Na/карбы по дням,
  женская лютеиновая поправка (:430), `spillRiskScore` (:1036), `buildShowTimeline` (:1058).
- Trial peak week (репетиция пика за 3–4 нед): `scoreTestPeakWeek`/`resolvePeakStrategy` (:2616/:2670)
  → стратегия пика из испытанного.
- Адаптация по весу: `prepWeightAdvice` (:2775, темп 0.25–0.75%/нед, ступени ±150–175 ккал / ∓20 мин
  кардио, запрет коррекций в тапер/пик).
- Питание на дату: `nutritionTargetsForPrepDate` (:2490) — живой путь рациона (Context :3269).
- Post-show: `buildPostShowPlan` (:2898), support план от show_day.
- Экспорты: печать `.html` (:2951), `.ics` (:3060), JSON тренеру (:3090), `prepTrainingCompliance` (:3136).
- Мост питания: `bb-contest-prep-sync.ts` (`saveContestPrepEverywhere`/`CONTEST_PREP_UPDATED_EVENT`).
- **Prep-цикл** (`bb-prep-cycle.engine.ts`, живой, шаг «🔁 Prep-цикл»): полная подготовка с нуля —
  сплит по категории, специализация с донорами, объёмный каскад (`prepVolumePlan`), prep-делоды,
  `prepCutProjection`, сезон нескольких стартов (`buildPrepSeason`), **позирование**
  (`posingPlanForCategory` + чек-ины `he_prep_posing_v1`), таблица «Питание по фазам»
  (`buildPrepNutritionPlan` :619 — с рефидами :648–670).
- Безопасность: `applyForcedModes`/`professionalReviewConditions` (:617/:2077), женские полы
  (ккал ≥1400, жиры ≥0.8 г/кг, RED-S, лютеин).

### 1.2 Дыра №1: расходящиеся контуры записи (P0 — риск потери/расщепления данных)

| Поверхность | Что пишет | Проблема |
|---|---|---|
| `BbAutoConstructor` шаг «contest» (`savePrepToProfile` :968–979) | инлайн в профиль + свой dispatch `he-bb-contest-prep-updated` | **минуя `bb-contest-prep-sync`** — два пути записи в одной поверхности (Prep-цикл пишет по-другому :6941/:7001) |
| `PeakingPanel.tsx` «🏆 Шоу ББ» (`updateSection('goals',{bbPeakConfig…})` :243–247) | **только legacy `bbPeakConfig`** | НЕ пишет `bbContestPrepPlan`, НЕ диспатчит событие → карточки тренировок/питания расходятся с этой веткой (Context подхватит через `planFromStored`-bridge только при следующем чтении) |
| `PeakWeekTab.tsx` (питание) | через `saveContestPrepEverywhere` (правильный путь) | эталон, но запись в трёх местах = три точки истины |
| `bb-contest-prep-sync.loadContestPrepConfig` :110–117 | — | fallback-ветка **всегда возвращает null** при живом плане — тихий мёртвый путь чтения конфига |

### 1.3 Дубли UI (тот же контент рендерится N раз)

- **Пик-неделя 7 дней рендерится в 5 местах**: BbAuto (шаг contest + Prep-цикл result), PeakWeekTab,
  PeakingPanel, MacrocyclePanel, мёртвый TaperPlannerTab. Правка протокола = правка 5 рендеров.
- **Редактор стратегий в 3 комплектах с РАЗНЫМИ словарями**: BbAuto/PeakingPanel — легаси
  вода `minimal/moderate/classic`, натрий `constant/cut_2d/cut_3d`; ContestPrepConfigEditor — PRO
  `stable/tapered/high`, `stable/tapered`. Один и тот же конфиг пользователь заполняет двумя языками.
- Две read-only карточки препа (`BBContestPrepActiveCard` в дневнике, `BBContestPrepCard` в
  PerformanceScreen) — дубль данных, разные форматы; док BBContestPrepCard про MacrocyclePanel **stale** (L2–15).
- `ContestPrepConfigEditor` импортирован в BbAuto (:97) и **не рендерится** — мёртвый импорт.
- `docs/MACROCYCLE-ROADMAP.md:53` ссылается на удалённый `bb-peak-week.engine`; тест
  `bb-peak-week-strategy.test.ts` носит legacy-имя.

### 1.4 Мёртвый функционал (написан в движках, ни одного импортёра в UI)

Проверено grep по `src/ui` — 0 совпадений:
- **Адаптивный тапер** `sRPEAdjustment`/`recommendBBTaperConfig`/`applyAdaptiveTaper`
  (bb-contest-prep :700/:711/:742) — готовый механизм правки тапера по sRPE/ACWR, в UI не встроен.
- **Два шоу** `planTwoShowSequence` (:1162), **прайминг** `buildPreTaperCascade` (:1206)/
  `coordinateLastHeavyDay` (:1092)/`addPeakPriming` (:1113) — мульти-старты и последняя тяжёлая
  тренировка не подключены.
- **Live-adjust пика** `liveAdjustForPeakDay` (:2713) — D-1 коррекция карбов по
  flat/spill/waterRetention живёт только в карточке **trial** (BbAuto :6566), а в реальную пик-неделю
  (чек-ины D-3…D-1) не встроена.
- `prepToMealPlanInput` (:2569) — адаптер целей → MealPlanInput, планировщик собирает цели сам.
- **Мед-процесс** `bb-prep-process.engine.ts` (240 строк): `PREP_PROCEDURES`/`PREP_LAB_PANEL`/
  `PREP_HYDRATION_GUIDELINES`/`PREP_POST_SHOW` — harm-reduction контент (процедуры doctorOnly, панель
  анализов к шоу, гидратация) не показывается нигде.
- `bb-show-coach.recommendBBShowConfig` (:162) — авто-подбор конфига; жив только score в PeakingPanel.
- `bb-trial-peak.engine.ts` — legacy-шим (0 импортёров) + мёртвые константы `PEAK_FOODS_ALLOW/DENY/FIBER_CAP`.
- `prep-phase-nutrition.engine.ts` — дубль `PrepPhase` + advisory-макросы (мёртв).
- `peaking-protocols.BB_PROTOCOL` — deprecated (RIR 0), но экспортируется в UI-справочники мёртвых табов.
- Мёртвые storage: `he_bb_peak_plan` (TaperPlannerTab) и `he_taper_plan` пишутся, не читаются.
- Мёртвые экспорты живых движков: `peakTrainingProfile`, `buildPrepProgression`,
  `prepSplitsForCategory`, `isKnownPrepCategory`, `applyPeakingToMicrocycles`.

### 1.5 Отсутствующее (никто не реализовывал)

1. **Недельный луп подготовки**: нет экрана «недели препа» с чек-инами (вес/талия/фото/сон/сила/психика),
   связанными с адаптацией. Есть только дневные чипы 6 пунктов (`PREP_CHECKIN_ITEMS`, BbAuto :832,
   `he_prep_checkin`) и read-only вес в MacrocyclePanel. `prepWeightAdvice` изолирован.
2. **Живое питание preparation — плоское**: `nutritionTargetsForPrepDate` :2507–2564 даёт ОДНИ ккал/Б/Ж/У
   на всю фазу подготовки (дефицит по `currentCalories`), без рефид-дней и карб-волны под тяжёлые дни
   (в отличие от display-таблицы Prep-цикла :648–670, где рефиды есть). fiberMax/water/Na — константы.
3. **Сила-мониторинг при дефиците**: нет трекинга e1RM тяжёлых дней в препе и предупреждения
   «сила падает быстрее нормы при дефиците» (в дневнике силы данные есть).
4. **D-7 чек-лист show day**: tan (слои/дни), волосы/ноги, позы/walkthrough, сумка/документы/еда на
   сцену — нет (есть только декоративный чек-лист PeakWeekTab без state и дневные чипы).
5. **Reverse-diet пост-шоу**: post_show цели плоские (поддержание), нет понедельного возврата ккал
   (+75–125/нед, угли +15–30 г/нед) с автоматическим переключением целей рациона после show day.
6. **Чек-лист PeakWeekTab декоративный** (5 чекбоксов без state, PeakWeekTab :411–422).

---

## 2. Эпики плана

### Э0 (P0) — единый контур записи и дедуп UI

Файлы: `BbAutoConstructor.tsx`, `PeakingPanel.tsx`, `bb-contest-prep-sync.ts`, `PeakWeekTab.tsx`,
`BBContestPrepCard.tsx`, `BBContestPrepActiveCard.tsx`, shared-компонент NEW.

- **Одна точка записи**: все сборки (шаг contest, Prep-цикл, PeakWeekTab) идут через
  `saveContestPrepEverywhere`; инлайн `savePrepToProfile` (:968) и прямые dispatch'и Prep-цикла
  удаляются (событие и 3 ключа профиля пишет sync-модуль).
- **PeakingPanel BB-ветка переводится на sync** (`saveContestPrepEverywhere`) и, главное, пишет
  версионированный план (источник: локальный конфиг → `buildBBContestPrepPlan`), иначе — read-only
  зеркало с кнопкой «Настроить» (ведёт в BbAuto/contest). Решение по умолчанию: перевод на sync
  (сохранить привычный пользователю экран).
- **Легаси-стратегии → PRO-словарь**: маппинг `minimal→stable`, `moderate→tapered`, `classic→high`
  (и `constant→stable`, `cut_2d/cut_3d→tapered`) как алиасы чтения; контролы BbAuto и PeakingPanel
  переводятся на наборы ContestPrepConfigEditor (`stable/tapered/high`, `stable/tapered`), legacy-значения
  нормализуются при чтении конфига (`legacyConfigFromProfile` + normalize).
- **Один рендер пик-недели**: NEW `ContestPeakWeekCard.tsx` (shared, в `ui/components/contest-prep/`) —
  таблица 7 дней (ккал/Б/У/Ж/вода/Na/тренировка/позы/фаза) + таймлайн, принимают `BBContestPrepResult`;
  4 живых рендера заменяются на него (BbAuto ×2, PeakWeekTab, PeakingPanel; MacrocyclePanel оставляет
  компактную строку — там другая плотность).
- `loadContestPrepConfig` (sync :110–117) — dead-ветка возвращ null починена (конфиг из плана).
- Два read-only карточки слиты в одну `BBContestPrepCard` с compact-пропом (дневник = compact),
  stale-док в шапке переписан; мёртвый импорт ContestPrepConfigEditor из BbAuto удалён.
- Порядок: сначала унификация записи (Э0.1), потом замена рендеров (Э0.2) — каждый шаг с зелёными
  тестами.

### Э1 (P0) — один формат пик-недели в плане

- `applyPeakWeekOverlayToBBPlan` (:1561) дополнительно ставит `wk.contestPhase='peak_week'`
  (сейчас ставит только legacy `wk.peakWeek=true` + prepProtocol) — единый маркер; существующие
  гварды (finalize :737/:3117/:4902, autocoach :935–943, bb-prep-cycle :888–1065) не трогаются
  (перечисление обоих маркеров остаётся валидным).
- Тест: пик через MacrocyclePanel-путь и через `applyContestPrepToBBPlan` дают ОДИНАКОВЫЙ набор
  маркеров недели (parity-тест), финализатор не добирает объём в обеих ветках.

### Э2 (P1) — живой адаптивный тапер (sRPE/ACWR)

Файлы: `bb-contest-prep.engine.ts` (экспорт уже есть), `BbAutoConstructor.tsx` (шаг contest, блок
«📉 Недели тапера»), NEW тест.

- NEW `adaptiveTaperStep(plan, sessions)`: сдирает факт sRPE 7/28д + ACWR (движки
  `training-load.engine`/`he_srpe_sessions` — те же источники, что у годового планировщика) →
  `recommendBBTaperConfig`/`applyAdaptiveTaper` → карточка «🤖 Адаптивный тапер»: рекомендация
  (недели тапера/смещение последней тяжёлой) + «Применить» (пересборка prep с новыми неделями) или
  «Оставить как есть».
- Лимиты: рекомендация не режет тапер короче 1 недели и не двигает пик-неделю (weekNumber шоу
  неприкосновенен); rationale-строки в план (prepProtocol/notes).
- Trial-стрелка: если trial peak показал tested_ok → «Тапер 2 нед → 1 нед» хинт (мост trial → тапер).

### Э3 (P1) — живое питание подготовки: рефиды + карб-волна + дневные пакеты

Файлы: `bb-contest-prep.engine.ts` (`nutritionTargetsForPrepDate` :2490 + NEW календарь рефидов),
`IndividualPlanContext.tsx` (:3269 уже передаёт), NEW тесты.

- NEW `prepRefeedCalendar(plan)`: детерминированные рефид-дни по фазе подготовки (каждые 7–10 дней
  при дефиците ≥12%; ккал до поддержания, угли до 4–6 г/кг, жиры на полу) — общий источник для
  `nutritionTargetsForPrepDate` И display-таблицы `buildPrepNutritionPlan` (сейчас они расходятся).
- `nutritionTargetsForPrepDate` принимает `opts?: { isHeavyTrainDay?: boolean; dayIdx?: number }`:
  рефид-день → ккал поддержания; тяжёлый день → угли +15% (в пределах капа), лёгкий/отдых → −10%
  (carb cycling преп-периода, паритет с существующей `carbPeriodization` планировщика — но
  prep-цели приоритетнее и этот слой управляется prep-планом).
- Дневные пакеты не только в пик: fiberMax/water/Na по фазе (подготовка: fiber ≤14 г/1000 ккал как
  было, вода по весу ×35 мл + попр. Энода на тапере «сухой»-стратегии, Na floor 800–1200 жен/муж).
- IndividualPlanContext передаёт `isHeavyTrainDay` (уже вычислен для carb-периодизации) в цели дня.
- Тесты: рефид-детерминизм (та же дата → тот же рефид), ккал-инвариант (рефид = поддержание), тяжёлый
  день больше углей без превышения капа, parity с buildPrepNutritionPlan (рефид-недели совпадают).

### Э4 (P1) — недельный луп подготовки (сердце нового тапера)

Файлы: `BbAutoConstructor.tsx` (шаг contest — NEW блок «📊 Недели подготовки»), NEW
`prep-weekly-log.ts` (движок), NEW тесты. Ничего не переписываем — блок добавляется рядом с
«Выполнением подготовки».

- NEW `prepWeekCheckins` (storage `he_prep_week_checkins`): по неделе prep — вес (средний 7д из
  weight-лога), талия, фото (ref, как в дневниках веса), сон ср, сессии факт, психика 1–5, чек
  «on_track/too_fast/too_slow» от `prepWeightAdvice` (та же математика, не копия).
- Лента недель (weeksOut → today): каждая карточка = фаза + дата + цель темпа + факт Δ + статус
  + кнопка «✍ Чек-ин»; клик по прошлой неделе = только просмотр, по текущей/будущей = ввод.
- Связка с адаптацией: статус `too_fast/too_slow` 2 недели подряд → подсказка «Применить калории ±»
  (существующие кнопки `prepWeightAdvice` переносятся сюда) + запись в `plan.adjustments`.
- Сила-мониторинг: NEW `prepStrengthTrend(sessions, plan)`: e1RM тяжёлых лифтов (из дневника силы)
  понедельно в препе; предупреждение «сила −5%+ за 2 недели на дефиците» → совет (дефицит не
  заглублять / кардио-мин −20) — только подсказка, вес плана не трогаем.
- Trial-хук: напоминание «🧪 Trial peak за 21–28 дней до шоу» в ленте (если ещё не сделан).

### Э5 (P1) — show day: исполнение, не только расписание

Файлы: `bb-contest-prep.engine.ts` (+NEW чек-лист движок), `BbAutoConstructor.tsx` (блок
«📋 Чек-лист D-7»), `ContestPeakWeekCard` (Э0), NEW тесты.

- NEW `buildShowChecklist(showDate)`: структурированный чек-лист с датами-триггерами:
  - D-10…D-7: пробный грим/позы под музыку (секунды), финал страховки;
  - D-7…D-5: tan-сессии (первый слой за 2–3 дня до, тест на патче), волосы/ноги;
  - D-3…D-2: чек-ины пик-недели (вес/fullness/вода) → **live-adjust** (`liveAdjustForPeakDay`
    :2713 встраивается в чек-ин D-3/D-2/D-1 реальной пик-недели — сейчас живёт только в trial);
  - D-1: сумка (чемпионаты: костюм/очки/еда/вода/соль/тройной tan/полотенца/билет), еда на утро,
    вода по плану D-1, документы;
  - D-0 (show day): чипы таймлайна с чекбоксами (выполнено ✓, персист `he_prep_show_checklist`).
- Tan/позы добавляются в `buildShowTimeline` (:1058) отдельными пунктами (без ломки существующих
  — таймлайн расширяется аддитивно, тест на порядок пунктов).
- `.ics` (:3060) получает события tan-сессий и чек-инов (опциональные элементы — не ломает существующий
  формат; тест на паритет старых событий).
- Чек-лист PeakWeekTab (:411–422) заменяется на этот движок (персист, не декорация).

### Э6 (P2) — мед-процесс prep подключить

Файлы: `bb-prep-process.engine.ts` (живой, не подключён), `BbAutoConstructor.tsx` (секция
«🩺 Мед-процесс» в шаге contest, collapsible), NEW тест.

- Показывается: панель анализов к шоу (`PREP_LAB_PANEL`: HCT/липиды/ALT-AST/eGFR + сроки сдачи по
  фазам), процедуры doctorOnly (флеботомия/эритроцитаферез и др. — с бейджем «👨‍⚕️ под контролем
  врача», паритет с калькулятором поддержки), правила гидратации.
- `PREP_POST_SHOW` (дубль-тексты) удаляется — единственный источник пост-шоу текстов = `buildPostShowPlan`.
- Связь: `plan.safety.contraindications` подсвечивает нужные пункты лабы (без новой математики).

### Э7 (P2) — post-show reverse-diet

Файлы: `bb-contest-prep.engine.ts` (`buildPostShowPlan` :2898 + NEW `postShowReverseDietWeeks`),
`nutritionTargetsForPrepDate` (:2507 post_show-ветка), NEW тест.

- NEW кривая возврата: недели 1–4 post_show: ккал +75–125/нед от поддержания к целевому поддерживающему
  (муж/жен cap), угли +15–30 г/нед, жиры на полу, белок 2 г/кг первые 2 нед → 1.8–2.2.
- `nutritionTargetsForPrepDate` по дате внутри post_show-недели возвращает уровень кривой (не плоский
  поддержание) + заметка недели («обратная диета: нед 2/4, +100 ккал»).
- Автопереключение: после show day рационы дня (Context) автоматически идут по кривой (уже пользуются
  `nutritionTargetsForPrepDate` — ничего дополнительно в Context).
- Тесты: монотонный рост ккал, cap поддержания не превышен, старт = поддержание, заметка по неделям.

### Э8 (P2) — экспорт тренеру: недельный отчёт

Файлы: `bb-contest-prep.engine.ts` (+NEW `buildPrepWeeklyReportHtml`), `BbAutoConstructor.tsx`
(кнопка), тест XSS/контент.

- HTML-отчёт тренеру: таблица недель (фаза/дата/цель темпа/факт Δ/статус/сила-тренд/чек-ины) +
  текущий протокол пик-недели + safety + история коррекций. XSS-esc как в существующих экспортах.
- CSV чек-инов (`he_prep_week_checkins`) — колонки неделя/дата/вес/талия/сон/сессии/психика/статус.

### Э9 (P2) — чистка мёртвого и хвостов

- Удалить: `bb-trial-peak.engine.ts` (перед этим проверить, что никто не читает `he_bb_trial_peaks_v2`
  — шим оставляет совместимость чтения; если читается — оставить только getTrialPeaks-фолбэк в sync),
  `prep-phase-nutrition.engine.ts` (advisory перенесён в Э3 или удалён с тестом), мёртвую BB-ветку
  `TaperPlannerTab` (713 строк, файл не монтируется — удалить вместе с записью `he_bb_peak_plan`),
  `PeakingProtocolTab`/`PeakingProtocolsTab` (мёртвые, только rest-hooks-тест), мёртвые экспорты
  (`peakTrainingProfile`, `buildPrepProgression`, `prepSplitsForCategory`, `isKnownPrepCategory`,
  `applyPeakingToMicrocycles`, `PEAK_FOODS_*`), устаревший `peaking-engine.ts` (тип
  `BBPeakingOutput` переносится в bb-contest-prep), deprecated `BB_PROTOCOL` из справочников UI.
- `peaking-protocols.BB_PROTOCOL`: пометка deprecated остаётся в данных (обратная совместимость тестов),
  но из UI-справочников мёртвых табов уходит вместе с ними.
- Доки: `MACROCYCLE-ROADMAP.md:53` (ссылка на удалённый движок), переименование
  `bb-peak-week-strategy.test.ts` → `bb-contest-prep-strategy.test.ts` (git mv, содержимое цело).

---

## 3. Порядок и границы

Порядок: **Э0 → Э1 → Э3 → Э4 → Э5 → Э2 → Э6 → Э7 → Э8 → Э9**
(Э0/Э1 — контур и маркеры, на которых строятся остальные; Э3/Э4 — основная ценность «препа не только
подводки»; Э2 оживляет адаптив — после того как недельный луп готов принимать его рекомендации).

Не трогаем: объёмную модель ББ (MEV/MAV/MRV, BB_TAPER_CURVE значения), кривые тапера ПЛ/арм/стронг,
валидатор фаз (`BBWeekPrepPhase`), протокол пик-недели по дням (вода/Na/карб-кривые — только
подключение live-adjust), гварды finalize/autocoach (перечисление маркеров остаётся).

## 4. Тесты (план ~45 новых)

- Э0: запись через sync из 3 поверхностей даёт 3 ключа профиля + событие (мутационный: прямая запись
  мимо sync падает), legacy→PRO алиасы воды/Na (6), паритет рендера пик-недели (shared-карточка).
- Э1: parity маркеров пик-недели двух путей (2).
- Э2: адаптив-рекомендация по sRPE/ACWR (high → больше тапер-недель), лимит «не двигает пик» (2).
- Э3: рефид-календарь детерминизм/паритет с Prep-циклом (4), тяжёлый день угли ± (2), фибра/вода по фазе (2).
- Э4: недельный чек-ин CRUD/статусы (4), сила-тренд предупреждение (2), связка с prepWeightAdvice (2).
- Э5: чек-лист D-10…D-0 по датам (3), live-adjust в чек-ине пик-недели (2), tan в таймлайне (1), ics (1).
- Э7: reverse-diet кривая (4).
- Э8: HTML/CSV контент + XSS (3).
- Широкие прогоны: bb-область (bb-contest-prep/prep-cycle/prep-splits/peak-techniques/taper-* —
  все существующие 240+ тестов зелёные), IndividualPlan (питание), SRCBBScreen_parts, tsc 0.
