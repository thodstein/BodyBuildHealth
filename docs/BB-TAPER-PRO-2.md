# BB Taper PRO-2 — план доводки тапера до науки 2021–2026 (тренировки + питание, mobile-first под АПК)

Статус: **план, код не начат**. База: `docs/BB-TAPER-PRO-PLAN.md` закрыт полностью (Э0–Э9, Sep 11 2026):
единый контур записи, единый рендер пик-недели, адаптивный тапер, рефиды + карб-волна, недельный луп
(`he_prep_week_checkins`), show-чеклист (`he_prep_show_checklist`), мед-процесс, `postShowReverseDiet`
(+100 ккал/нед ×4), отчёт тренеру. Объёмная модель ББ (MEV/MAV/MRV, `BB_TAPER_CURVE`) не меняется —
всё аддитивно, как в PRO-1.

Правило PRO-2: **ни один эпик не перестраивает выданный план** — только оверлеи, гварды, питание
по дате и UI. Движки читают дневники, не пишут в них.

---

## 1. Что уже хорошо (не трогаем)

- Кривая `BB_TAPER_CURVE` (объём 0.90→0.60, интенсивность 0.95→0.85, RIR 2–4, без отказа) +
  `PER_MUSCLE_TAPER_MULT` (ноги/спина режутся раньше) + спец-щажение ×1.18 — в коридоре Bosquet.
- `TRAINING_BY_PHASE`: last hard не позже D-3/D-5, деплеция мягкая 8–12 повт ~60% RIR 2–3, без новых
  движений и тяжёлых эксцентриков — паритет Homer/Helms.
- Дефолт `stable` вода/натрий + `confirmedManipulation`-гейт + `blockedProtocol` — честная
  harm-reduction позиция.
- Карб-бюджет total 8–12 г/кг за 36–48 ч (не в день), деплеция мягкая 1.2–1.8 г/кг, trial→стратегия
  (`recommendCarbStrategyFromTrial`), женские полы (1400 ккал, жиры ≥0.8 г/кг, лютеин).
- Рефиды детерминированы, post-show 28 дней, reverse-кривая в живых целях рациона.

---

## 2. Интернет-синтез (на чём стоит PRO-2)

**Пик-неделя, карбс/вода/натрий:**
- Escalante et al. 2021 (BMC Sports Sci Med Rehabil, `doi:10.1186/s13102-021-00296-y`) — базовый
  evidence-обзор: гликоген-максимум + минимум подкожной воды + минимум вздутия; вода 4–12 л/день
  с урезанием за 10–24 ч до выхода; натрий load→cut за 3–4 дня; калий адекватен (внутриклеточный
  катион, удержание гликогена); фибра вниз до **10–13 г/день × ~5 дней** (Rale: очистка ЖКТ);
  правило №1 — **манипуляции только после trial-прогона, иначе всё stable**.
- Homer / Cross / Helms 2024, narrative review (Sports Med Open, `pubmed:38218750`): карб-манипуляции
  популярны при слабой доказательности; диапазон загрузки **3–12 г/кг** (индивидуально/по дивизиону);
  вода+электролиты «на спекулятивных механизмах, могут вредить»; ICW≠внутримышечная /
  ECW≠подкожная — урезание воды **поднимает долю ECW** (r=−0.44, Escalante 2024); рестрикт натрия
  тормозит SGLT1/GLUT-транспорт глюкозы + роняет АД (хуже памп); рекомендация — **как можно меньше
  переменных за раз + trial заранее**.
- Homer et al. 2024, RCT-кроссовер (Nutrition, `doi:10.1016/j.nut.2024.112528`, n=4, диета+сушка):
  3 дня деплеции → 9 г/кг загрузка: MT +2.9% от пост-деплеции (+2.1% к базе), BM +0.3%, SF −2.3%;
  эффект на грани ошибки измерения, **ответ индивидуален — доза титруется по trial + визуалу**.
- Barakat / Schoenfeld et al. 2022, case study (Sports): деплеция <50 г ×3 дня → >450 г ×2 дня:
  MT рук +5%, квадр +2% (без базы до деплеции — сравнить не с чем, визуал решает).
- Mitchell et al. (интервью, 7 натуралов): 100% лили >10 л с урезанием к шоу — **признали
  неэффективным**; натрий load→cut — «больше не будем без trial». Вывод для АПК: манипуляции
  за гейтом trial, не в один тап.

**Тапер/делод (сила vs физик):**
- Bosquet et al. 2007, мета-анализ (27 исследований): оптимум — **2 нед, объём −41…−60%
  экспоненциально, интенсивность и частота без изменений**.
- Travis et al. 2020 (Powerlifting taper review, PMC7552788): сила — объём −30…−70%,
  интенсивность ≥85% 1RM, экспоненциальный/step 1–2 нед + прекращение 2–7 дней; срез >70%
  = риск детрейна/потери поперечника.
- Bell et al. 2025 (Strength Cond J, deload guide) + Rogerson/Bell 2024 (опрос, Sports Med Open):
  **делод ≠ тапер**: делод — объём вниз + интенсивность вниз + RIR вверх, каждые ~5–6 нед × ~6 дней;
  тапер — объём вниз + интенсивность держать; у физиков тапера в силовом смысле почти нет —
  они держат RT и крутят диету/кардио/шаги. Наш BB-тапер уже ближе к правде, чем копипаст ПЛ.
- Homer et al. 2024 (JSCR, опрос peak-week RT у физиков): пик-неделя = снижение стресса +
  деплеция гликогена без damage (привычные движения 10–20 повт RIR 1–2, длинные эксцентрики
  заменены, день −1 без RT).

**Post-show (главный разворот PRO-2):**
- Helms 2025 (Sports Nutrition Association, recovery vs reverse): reverse (≈+100 ккал/нед,
  долгий дефицит) **затягивает LEA/RED-S**, лептин и TDEE не восстанавливаются пока атлет
  lean; recovery (сразу к maintenance нового веса + жир до здоровой точки) — 60–70% успеха.
- Buechel et al. 2025 (qualitative, 19 натуралов): reverse **недержим** (голод+ригидность после
  16+ нед диеты), recovery с гибкой структурой — легче психологически; ключ — **продолженное
  ведение тренером**, иначе «брошенность»; Conlin: flexible > rigid (FFM +1.7 vs +0.7 кг).
- Chappell et al. 2021 (biopsychosocial, 4 натурала, 8 мес): вес −8.6 кг → +7.9 кг за 2 мес post;
  сила/гормоны/настроение возвращаются только с весом и ккал; reverse «не рекомендован,
  adherence плохой». Rossow (кейс 12 мес): тестостерон 9.22→2.27→9.91 нг/мл — только с жиром.
- Scoping review (PMC9364707): 3 трека — gradual / ad libitum / **сразу maintenance**; консенсуса
  нет, но gradual в одиночку = медленное восстановление RMR/цикла (кейс: +97% ккал сразу →
  +22% веса + полный RMR + цикл).
- Практика (Universal Performance, rebound): калории к новому maintenance за 4–8 нед, +5–10%
  stage weight, объём сначала назад, стимы/T3 — тейпер, еда — главный анаболик.

---

## 3. Дыры PRO-1 (таблица разрывов)

| # | Наука | У нас | Разрыв |
|---|---|---|---|
| T1 | Trial обязателен для любых манипуляций (Escalante №1) | trial влияет только на стратегию, не на доступность воды/Na | нет гейта «без trial — только stable» |
| T2 | Доза загрузки 3–12 г/кг, титрация по trial+визуал | бюджет = середина × tolerance, дозы фиксированы | нет персональной дозы из trial |
| T3 | Фибра 10–13 г/день ×5 дней к шоу | fiberMax = 14 г/1000 ккал константа (~28 г при 2000) | нет fiber-curve пик-недели |
| T4 | Na-cut режет SGLT1/памп; K floor обязателен | Na и карбс независимы, K только в пик-днях | нет связки Na×K×карбс + варнинга |
| T5 | Last heavy: ноги D-5…D-7, верх памп до D-2 | TRAINING_BY_PHASE без привязки к группам | нет per-групп last-hard |
| T6 | Делод ≠ тапер (интенсивность!) | авто-тапер и prep-тапер рядом без объяснения | нет UI-различения + explainer |
| T7 | Recovery diet > reverse (adherence, гормоны, RMR) | только reverse +100/нед ×4 | нет recovery-трека (дефолтом) |
| T8 | Post-show: психика, голод, «брошенность», цикл/тесто | psyche 1–5 только в препе, post — плоские цели | нет post-псих лупa и маркеров восстановления |
| T9 | Diet break 7–14 дней при препе >16 нед | только рефид-дни | нет diet-break календаря |
| T10 | Стимы/T3 тейпер, PED-comedown — harm-reduction | мед-процесс без comedown-блока | нет doctorOnly comedown-памятки |

---

## 4. Эпики PRO-2 (все под АПК)

### АПК-рамка (действует на все эпики, не повторяется ниже)

- Тач **44px** минимум (кнопки/чипы/степперы/чекбоксы чек-листов), инпуты **16px** (без iOS-зума).
- Весь серый текст (`rgba(255,255,255,0.4–0.85)`, `TEXT_2/3`) → **#fff**; иерархия — размером/жирностью,
  статусные цвета (зелень/янтарь/красень фаз и вердиктов) не трогаем.
- Компакт: корень gap ≤10, карточки ≤14/10, секции collapsible с саммари; ленты (фазы, недели,
  чек-листы) — горизонтальный snap, не простыня.
- Липкая шапка шага + CTA снизу над пилюлей (`var(--tabbar-lift)`), safe-area, `reduced-motion`.
- Только `html.app-native`-скоуп в CSS, без hex-литералов акцентов (чекер `verify:apk-design` зелёный).
- Офлайн-first: все новые state — localStorage-ключи `he_prep_*` с валидацией формы при чтении,
  битые → дефолт без краша; экспорты через существующие `shareOrCopyText/printPlanHtml`.

### P1 — гейт манипуляций «без trial — только stable» (добивка T1)

Файлы: `bb-contest-prep.engine.ts` (NEW `manipulationLockedFor`/`applyManipulationGate`/
`manipulationLockNote` — экспорт, движок back-compat), `BbAutoConstructor.tsx` (шаг contest,
чип-замок у стратегий), NEW тест.

- Скоуп честно сужен при реализации: гейт лочит только **high/classic воду** (опасная манипуляция;
  validate уже документировал «иначе будет применён stable»). Tapered вода/натрий — warning-only
  (умеренная манипуляция; тесты `bb-contest-prep.test.ts:322`/`bb-contest-prep-plan` пинят поведение
  без trial — ломать их ради гейта нельзя). Карбс-доза — через P2, не через гейт.
- `applyManipulationGate` осознанно НЕ вшит в `applyForcedModes` (иначе `buildPeakWeek(classic)`
  без confirm сломал бы 3 существующих теста) — применяется на UI-поверхности: чип
  `manipulationLockNote` у кнопок воды + существующий build-блок «High без trial → ⛔»
  (`BbAutoConstructor:assembleContestPrep`).

### P2 — персональная доза загрузки из trial (T2)

Файлы: `bb-contest-prep.engine.ts` (NEW `trialCarbDoseGPerKg(trial, category, sex)` 3–12 г/кг:
spill→низ диапазона, flat→верх, непредсказуемый→середина + undulating), `buildPeakWeek`
принимает `opts.carbDoseGPerKg` (дефолт — текущий бюджет, байт-в-байт без trial), чек-ин
пик-недели — ввод «визуал: flat/full/spill» → пересчёт оставшихся load-дней (тот же
`liveAdjustForPeakDay`, расширенный дозой). Тесты 4 (доза в коридоре; spill < flat; без trial —
старый бюджет; live-пересчёт не превышает кап категории). АПК: визуал-чипы Flat/Full/Spill 44px
в чек-ине D-2/D-1, пересчёт одной кнопкой «Пересчитать загрузку» 52px.

### P3 — fiber-curve + Na×K-связка пик-недели (T3/T4)

Файлы: `bb-contest-prep.engine.ts` (`buildPeakWeek` + `computePeakWeekNutritionTargets`), NEW тест.
- Фибра: D-7…D-5 ≤20 г, D-4…D-2 **10–13 г**, D-1/шоу ≤10 г (Rale/Escalante), источники — только
  low-residue (рис/картофель/банан), флаг `preferLowFiberCarbs` уже есть — привязать к кривой.
- Na×K: загрузочные дни (`load_*`) — запрет Na-cut (гард: `sodiumStrategy=tapered` сдвигается на
  пост-загрузку, варнинг «Na-cut во время загрузки режет SGLT1/памп»); калий floor 3500/4000
  мг все дни пика (уже считается — пробросить в цели дня, сейчас теряется); вода-кап при
  `high`: ≤8 л (наблюдаемый потолок 4–12 л, Mitchell: >10 л — без trial мусор).
Тесты 5 (фибра по дням; Na-cut не на load; K floor в целях; water-кап; без конфига — байт-в-байт).
АПК: только строки в `ContestPeakWeekCard` (фибра/калий колонки) + варнинг-чип, новых экранов нет.

### P4 — per-групп last-hard + «тапер ≠ делод» (T5/T6)

Файлы: `bb-contest-prep.engine.ts` (`TRAINING_BY_PHASE` + NEW `LAST_HARD_BY_GROUP`: ноги D-6,
спина D-5, грудь/дельты D-4, руки памп D-2, шоу-памп backstage), `toPeakWeekSession` выбирает
протокол по доминантной группе сессии; `applyTaperToFinalWeeks` без изменений. UI: explainer-
бейдж в шаге contest «📉 Тапер держит вес (≥85%), делод роняет всё — у вас тапер» + ссылка на
неделю-делод цикла (если есть). Тесты 4 (ноги раньше верха; руки — только памп; deload-неделя
не получает last-hard; бейдж-строка). АПК: таблица last-hard — 5 строк-чипов 44px, не таблица.

### P5 — recovery-трек post-show дефолтом (T7, главный питательный эпик)

Файлы: `bb-contest-prep.engine.ts` (NEW `postShowRecoveryDiet(plan, weightKg, sex)` рядом с
`postShowReverseDiet`, не вместо), `nutritionTargetsForPrepDate` (post_show-ветка: выбор трека),
шаг contest (селектор трека), NEW тест. Механика: **Recovery (дефолт)** — неделя 1: сразу
maintenance нового веса (база + гликоген/вода +300–500 ккал к финалу препа), белок 2 г/кг,
далее +50–100/нед до offseason-цели; цель regain **5–10% stage weight**; **Reverse (opt-in)** —
текущая кривая +100/нед ×4 (только с чекбоксом «понимаю: восстановление медленнее»).
Автопереключение целей рациона уже идёт через `nutritionTargetsForPrepDate` — проброс трека
из `plan.postShow.recoveryTrack`. Тесты 5 (recovery неделя 1 > reverse недели 1; монотонность;
кап maintenance+10%; дефолт recovery; reverse без opt-in недоступен). АПК: селектор-треки —
2 карточки 56px с саммари (ккал нед 1 / regain / скорость восстановления), не радиокнопки.

### P6 — post-show луп восстановления (T8/T10)

Файлы: NEW `prep-post-show-log.ts` (движок, storage `he_prep_postshow_v1` по planId):
еженедельно 6 нед — вес, сон, голод 1–5, настроение 1–5, цикл (Ж: да/нет/нерегулярно),
либидо/энергия 1–5, сила-возврат %; маркеры «восстановлено» (вес ≥+5% stage, сон ≥7, голод ≤3,
цикл вернулся / тесто-симптомы ушли); comedown-памятка (стимы/T3 — тейпер вниз, PED — только
harm-reduction + «👨‍⚕️ под контролем врача», дозировок НЕ назначаем — паритет с калькулятором
поддержки). UI: блок «🔄 Восстановление» в шаге contest после show day (лента 6 недель +
прогресс-бар маркеров). Тесты 4 (CRUD/маркеры/женский цикл/comedown без доз). АПК: лента недель
+ шкалы-степперы 44px, reduced-motion на прогресс-баре.

### P7 — diet-break календарь длинного препа (T9)

Файлы: `bb-contest-prep.engine.ts` (NEW `prepDietBreaks(plan)`: препы ≥16 нед — 7–10 дней
на maintenance каждые 8–12 нед, синхронизировано с deload-неделями плана), `prepRefeedDates`
(брейк-дни исключаются из рефидов — не двойной бонус), `nutritionTargetsForPrepDate`
(брейк → maintenance дня), лента недель (бейдж «🏖 Diet break»). Тесты 3 (брейк только ≥16 нед;
синк с deload; брейк = maintenance, не рефид). АПК: только бейдж + строка в карточке недели.

---

## 5. Не делаем (осознанно)

- Диуретики/фарма-протоколы пика и post-show дозировки — только doctorOnly-памятки, чисел нет
  (harm-reduction, паритет с поддержкой).
- Своя VBT/ posing-оценка в тапере — данные уже есть в хабе ББ, мост не дублируем.
- ПЛ/арм/стронг-кривые — не трогаем (чужой контур).
- `peaking-protocols.BB_PROTOCOL` (RIR 0) остаётся deprecated-данными для совместимости тестов.

---

## 6. Тесты (план ~28 новых)

- P1: гейт-манипуляции 3. P2: доза 4. P3: фибра/NaK/вода 5. P4: last-hard 4. P5: recovery 5.
  P6: post-лог 4. P7: брейки 3.
- Широкие прогоны: bb-область (contest-prep/prep-plan/prep-cycle/taper-*/peak-* — все зелёные),
  IndividualPlan (живые цели post-show обоих треков), SRCBBScreen_parts, `tsc --noEmit` 0,
  `verify:apk-design` OK.
- Порядок: **P1 → P3 → P2 → P4 → P5 → P6 → P7** (сначала гварды/безопасность, потом ценность).

---

## 7. Выполнение (статус: код в worktree, БЕЗ коммита — чекаут запрещён)

Все 7 эпиков выполнены кодом. Только Edit/Write-инструмент; чужие WIP не тронуты.

- **Движок** (`bb-contest-prep.engine.ts`, MOD): P1 `manipulationLockedFor`/`applyManipulationGate`/
  `manipulationLockNote` (только high-вода, back-compat — см. скоуп выше); P2 `trialCarbDoseGPerKg`
  (spill→низ / flat→верх коридора, без trial→середина) + `buildPeakWeek(cfg, {carbDoseGPerKg})`
  (кламп коридором, без opts — байт-в-байт); P3 fiber load 16→12 (деплеция 20/шоу 10/пик 12),
  high-кап воды 8 л, калий в живых целях по полу (Ж 3500/М 4000), Na-tapered SGLT1-кламп
  задокументирован тестом; P4 `LAST_HARD_BY_GROUP`/`lastHardDayForMuscle`/`TAPER_VS_DELOAD_NOTE`;
  P5 `postShowRecoveryDiet` (+75/нед, кап +300, regain 5–10%) + `activePostShowCurve` +
  `postShowTrack` в плане/opts (дефолт recovery; reverse жив) + `nutritionTargetsForPrepDate`
  трек через opts>план>recovery; P7 `prepDietBreaks`/`isPrepDietBreakDay` (≥16 нед, 7 дней
  каждые 8 нед) + приоритет брейка над рефидом в целях и в `prepRefeedDates`.
- **NEW `bb-prep-post-show-log.engine.ts`** (P6): CRUD `he_prep_postshow_v1` по planId (кап 6,
  идемпотентно по неделе, битый стор → []), `postShowRecoveryMarkers` (5 маркеров, вес-гейт
  +5% stage), `postShowComedownNotes` (без доз, с врачом).
- **UI** (`BbAutoConstructor.tsx`, `ContestPeakWeekCard.tsx`): P1 чип-замок у стратегий; P2 строка
  дозы trial в trial-блоке; P3 колонка «Клетч.» в таблице пик-недели; P4 бейдж тапер≠делод +
  4 чипа last-hard; P5 селектор треков 2×56px + recovery-кривая в Post-show; P6 блок
  «Восстановление» (маркеры + форма нед/вес/сон/голод/цикл/сила + comedown); P7 бейдж diet-break
  под таблицей подготовки. Всё белым текстом, тачи 44px+, без новых CSS (существующие токены).
- **Тесты**: NEW `bb-taper-pro2.test.ts` 20/20 (P1 3, P2 3, P3 4, P4 2, P5 3, P6 3, P7 2).
- **Проверено**: NEW 20/20 + соседи contest-prep 282/282 + bb-область **2206/2207** (1 падение
  `bb-diagnostics-max-pro` female-symmetry — чужое: файл импортирует только symmetry/weak-cause/
  rank/spec/prof/diagnosis/injection/export, моих файлов там нет; движок правится чужими
  BB-diagnostics rounds — `git log` подтверждает); taper-smoke/card/annual-ctx/peak-smoke 20/20;
  `tsc --noEmit` 0 (6GB heap); `verify:apk-design` OK. Контекст питания (`IndividualPlanContext`)
  не тронут — трек едет через план (дефолт recovery), сигнатура расширена опционально.
- НЕ закоммичено (чекаут/коммит запрещены): файлы в worktree — MOD движок/BbAuto/PeaкWeekCard,
  NEW движок post-show-лога + NEW тест + этот док.

## 8. Доводка: закрыты 4 честных гэпа (добивка кодом, закоммичена pathspec)

По вопросу «что осталось» найдены и закрыты пп. 1–3 и 5 (P4-тайминг в сессиях — вне скоупа,
остался дисплей-only осознанно).

- **Доза в сборке (был гэп №1)**: `carbDoseGPerKg` проброшен сквозь `buildBBContestPrepPlan.opts` →
  `plan.peakWeek.carbDoseGPerKg` → `nutritionTargetsForPrepDate` (пик-ветка) + `buildBBContestPrep.opts`
  + `applyTrainingTaperToBBPlan.opts` + `ContestPrepApplyOpts` → пик-неделя плана; кэш
  `peakWeekCached` с дозой в ключе; BbAuto `assembleContestPrep` считает дозу из `lastTest` и
  передаёт в оба пути (UI-строка «применится через Пересобрать» теперь правда). Без дозы/теста —
  байт-в-байт. Тесты +3.
- **Трек при пересборке (был гэп №2)**: `assembleContestPrep` передаёт
  `postShowTrack: prepPlan?.postShowTrack ?? 'recovery'` — селектор больше не сбрасывается.
  Тест +1 (reverse в плане → живые цели reverse без opts).
- **Таблица с брейками (был гэп №3)**: `buildPrepNutritionPlan` (`bb-prep-cycle.engine.ts`, единственное
  касание чужой зоны — только P7-ветка) читает `prepDietBreaks`/`isPrepRefeedDay`: нед 8/16/… —
  Diet break без рефида, остальные рефиды — по календарю движка (паритет живые цели ↔ таблица).
  Тесты +2.
- **Лог в экспорте (был гэп №5)**: `buildPrepCoachJson(plan, {postShowLog})` несёт записи;
  `buildContestPrepPrintHtml(plan, {…, postShowLog})` рисует секцию «Восстановление post-show»
  (таблица + маркеры + comedown); оба callsites BbAuto передают `getPostShowLog(prepPlan.id)`.
  Тест +1 (JSON + наличие/отсутствие секции).
- **Проверено**: PRO-2 тест 27/27 + prep-cycle 48/48 + соседи 311/311 + `tsc` 0 по своим файлам
  (2 ошибки — чужой `BBDiagnosticsHub.tsx` WIP: `report` TDZ, файл не тронут) + `verify:apk-design` OK.
- **Шторм-процедура**: в `BbAutoConstructor.tsx` параллельный агент держит свой ханк PRO-3 R2 —
  в коммит взяты только 5 своих ханков (фильтр патча побайтово через Python + `git apply --cached
  --unidiff-zero`; без флага zero-контекст не применяется). Чужое не тронуто, не стейджено, не откачено.
