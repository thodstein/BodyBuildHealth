# Суставы и ортопедия — аудит, синтез, план доработки (Sep 2026)

## §1. Аудит: что уже есть в коде

### 1.1 Движки BB (`src/engines/bb/`)
- `bb-mobility.engine.ts:13` — 5 regex-паттернов (shoulder/hip/ankle/lower_back/wrist) + `isMobilityRestricted`.
- `bb-injury-prevention.engine.ts:25` — карта мышца→сустав (shoulder/knee/spine/elbow/wrist/hip/ankle/neck) + JointStressScore недели.
- `bb-joint-guard.engine.ts:20` — GH/инсулин/тяж.курс: штраф axial/high-stress, замена на машины/кабели, темп 4-2-1-0.
- `bb-tendon-guard.engine.ts:11` — локоть/плечо по объёму тяг/жимов из дневника (ok/warn/stop 12/18).
- `bb-red-flags.engine.ts:7` — 4 флага (боль/отёк/онемение/щелчки с болью), hard-стоп блокирует вставку.
- `bb-return-to.engine.ts:42` — 3 ступени возврата (0% → 50% → 100%, ручной переход).
- `bb-symmetry.engine.ts:43` + `bb-lr-volume/lr-history/readiness` — L/R-вердикты 7/12%, персист `he_bb_lr_history`, светофор боли.
- `bb-bar-path.engine.ts:15` — xLoop → SRD 4/6см.
- `bb-joint-jsi-bridge.ts:1`, `bb-exercise-diagnosis (jointRisk)`, `bb-exercise-correction (substitute/mobilitySwap/modifyROM/modifyLoad)` — точечные мосты.

### 1.2 PL/LMS/PRO (`lms/`, `pro/`, корень engines)
- `pro/joint-load-master.engine.ts:28` — единый мастер: 8 суставов + опасные структуры (labrum/rotator/ACL/мениск/L4-S1) + готовые протоколы.
- `pro/joint-jsi.engine.ts:19` — JSI = объём×K_base×K_tempo×K_anatomy×K_pharma×K_pain×K_amplitude + deadly-комбо.
- `orthopedic-load-engines.ts:61` — blacklist паттернов по травме (knee_acl/hip_labrum/spine_disc/shoulder_rotator) + ROM-лимиты.
- `biomechanics-risk-engine.ts:97` — torque-модель: impingement/rotator плеча, вальгус/пателла колена, компрессия/сдвиг позвоночника.
- `lms/weakpoint-pl.ts:28` + `pro/lift-diagnostics` — 12 лифтов × мёртвые точки + углы суставов по фазам.
- `mobility-assessment.engine.ts:30` — 6 FMS-подобных тестов 0–12 + тренд; `mobility-protocol`, `warmup-joints` (8 суставов), `injury-cycle-blood` (prehab + rehab-фазы + Empty-can/McGill Curl-Up как критерии возврата), `federation-grip-mobility`.

### 1.3 Strength-sport / ARM
- `strength-sport-ohs.engine.ts:13` — OHS 6 сегментов + knee-to-wall ≥12/≥9 + heel-raise retest 2.5см; `ta-asymmetry/sm-asymmetry` 7/12%; `sm-biceps-risk` гейт ≥70; `sm-safety` axial-бюджет McGill; `pose/video` (Kinovea CSV, BlazePose-stub).
- `arm-mobility.engine.ts:26` — 5 ROM-чеков кисти/локтя + reverse-grip retest; `arm-injury-guard` (humerus side ≤6/9, ≤10%/нед); `arm-tendon-fuel` (коллаген 15г+VitC 200мг за 30–60мин); `arm-video-analysis` (hook/toproll/press + SRD 4).

### 1.4 Хабы
- `BBDiagnosticsHub` — weak/symmetry/exercise/stimulus/volume/recovery/mobility; OHS, knee-to-wall, pose-CSV, red-flags, return-to, teen, bar-path, mobility→профиль.
- `WLDiagnosticsHub` — OHS 6 + knee-to-wall L/R, pose-CSV, IMTP/ISPP, pull-phase, knee-вальгус ACL-флаги, mobility→профиль.
- `StrongmanDiagnosticsHub` — McGill-budget, sway 3/5, OHS-история, hold-медли, pose-углы.
- `ArmDiagnosticsHub` — 12 точек + ROM + asymmetry-вердикт + humerus-чеки + red-flags + teen + return-to-pull.
- `TrainingSafetyHub` — контейнер (ortho-быстрый чек + load/autoreg/recovery).

### 1.5 Поддержка суставов (калькулятор)
- `tz-bridge-boosters.ts:193` — `JOINTS_BOOST` LV1 (коллаген/глюкозамин/хондроитин/босвеллия/MSM/куркумин/гиалуронка/C/D3/омега) → LV2 (UC-II/кремний/Mn/D3/K2/Ca/бор/havinson_a4/ligamentide/voltaren_gel) → LV3 (bpc157+tb500+ghk_cu).
- `ped-risk-matrix` (jointsBoosterTier 0–3, станозолол → авто-тир), `supportProtocolJoints.tsx` (UC-II 40мг/глюкозамин 1500/хондроитин 800–1200/MSM 2–3г + асептика-варнинги BPC/TB).
- Пробел: отдельного суставного меха в ТЗ-28 нет — бустер идёт через перекрёстные `cns2/cv1/hem2`.

### 1.6 Травмы/исключения
- `manual-plan-builder` (`expandInjuryMuscle`, `getExcludedMuscles/getGradedInjuries`) → `bb-builder`/`cycle-to-plan` (exclude пропуск, graded 0.6× + repsCap) → `exercise-substitution` (gentle той же мышцы) → `bb-finalize` (не возвращать объём excluded). Профиль: `health.mobilityRestrictions` + `training.mobilityRestrictions` — пишут хабы BB/WL/ARM.

### 1.7 Пробелы (не покрыто)
- Плечо: нет Neer/Hawkins/Jobe/Full-can/Drop-arm/Apprehension как тестов (Empty-can — только критерий возврата).
- Локоть: нет valgus-stress, нет кубитального Tinel.
- Кисть: нет Finkelstein (де Кервена), Phalen/Tinel (карпальный); нет динамометрии в динамике.
- ТБС: нет FADDIR/FABER/IROP/sour-теста; только OHS-глубина + hipFlexion 120°/IR 35°.
- Колено: нет Lachman/Thessaly/McMurray/Apley; нет hop-тестов, LSI, YBT, ACL-RSI; только вальгус-флаг + knee-to-wall.
- Голеностоп: нет Thompson (ахилл); только knee-to-wall.
- Позвоночник: нет Schober/SLR-гейта/Stork; McGill — только axial-бюджет + Curl-Up в rehab; ASLR без болевого гейта.
- Общее: нет FMS 0–21 (свой 0–12), нет single-leg squat/step-down, нет scapular dyskinesis, нет Beighton-гипермобильности, нет teen-гейта TA/STRONG, нет yellow flags, нет маршрута «боль → врач» кроме generic red-flags.

## §2. Интернет-синтез 2023–2026

- **Плечо, одиночные тесты слабые — кластеры лучше.** Hawkins для импинджмента DOR 2.86 (sens 0.58/spec 0.67); Neer sens 79%/spec 53%; Hawkins sens 79%/spec 59% (Hegedus 2008; Gismervik 2017; DARE-апдейт: ни один тест не дискриминирует SAM в одиночку). Supraspinatus/Empty-can + Infraspinatus — кандидаты в confirmatory для импинджмента. Для разрывов cuff сильнее lag-signs: ERLS 90°/IRLS (мета-анализ 2024, Jain: значимая точность vs Jobe/Hawkins/Bear-hug). Для нестабильности: apprehension DOR 53.6 + relocation/surprise (высокоспецифичны). Вывод для плана: **никакого диагноза по 1 тесту; только кластер ≥2 + маршрут к врачу/МРТ.**
- **FMS: надёжность отличная, прогноз слабый.** Bonazza 2017: ICC inter/intra 0.81; OR травмы при ≤14 = 2.74. Но Dorrel 2015: sens 24.7%/spec 85.7%, AUC 0.587 (≈ монетка), LR+ 1.7. Moran 2017 (BJSM, 24 когорты): pooled RR 1.47 у военных (small), **против использования composite как предиктора в футболе**, остальные — limited/conflicting. Вывод: FMS-композит не продавать как «прогноз травмы»; использовать по-движениям + боль-правило (pain = стоп).
- **ТБС: FADDIR чувствителен, не специфичен.** Pålsson 2020: FADDIR/AIMT sens 80%, spec 24–26%, kappa >0.6; FABER sens 41–97%/spec 18–100% (широкий разброс); IROP sens 75–91% лучший для FAI; комбинация impingement + ROM повышает точность. Систематический обзор 2025 (15 студий, 1378 ТБС): FADIR sens до 100% для labral, FABER spec до 100% в отдельных выборках, для микронестабильности — AB-HEER sens 80.6%/Prone-instability spec 97.6%. Вывод: FADDIR — скрининг (rule-out слабый), подтверждение — только МРТ/инъекция; в аппе — опросник, не «диагноз FAI».
- **Колено/ACL RTS: стандарта нет, вальгус — главный качественный предиктор.** Wright 2025 (scoping, 33 студии, 6000+): LSI ≥90% сила/прыжки — де-факто стандарт, сроки 6–9 мес, но вариабельность огромная; смена направления/биомеханика измеряются редко. BMJ SEM 2024: вальгус опорной ноги в sidestep-cut → aOR 4.64 повторного ACL. AAOS AUC 2025: многофакторное решение (стабильность + симптомы + сила + баланс + симметрия + время + психоготовность + prevention-программа). LSI переоценивает (больная нога vs детренированная здоровая). Вывод: LSI + время + качество движения + псих-флаг, всё вместе.
- **YBT-LQ: надёжен, cutoff — популяционно-специфичны.** Plisky 2021 (мета, 57 студий): intra-rater 0.85–0.91; общий cutoff без стратификации — не предиктивен. Garrison: ANT-асимметрия >4см на 12-й нед после ACLR → неп Gateway 90% LSI на RTS (AUC 0.82–0.85, sens 0.92–0.96). Корреляции с hop/прыжком слабые-умеренные (r 0.26–0.53). Вывод: ANT>4см — дешёвый ранний флаг (рулетка + скотч), не «диагноз».
- **Гипермобильность: сила можно и нужно, но по-другому.** Brittain 2023 (scoping PT при G-HSD/hEDS): therapeutic exercise + motor-function training — efficacious; остальное — weak. Møller (классический EDS, 3 пациента): тяжёлая силовая 3×/нед 4 мес — feasible + улучшение muscle-tendon без major side effects. EDS Society/Parry: closed-chain, proprioception/balance, core/pilates-база, избегать high-impact/contact и end-range под нагрузкой. Beighton-пороги возрастные (≥6 дети, ≥5 до 50, ≥4 после 50) + 5PQ-опросник. Вывод: Beighton-скрининг + щадящий режим, а не запрет силы.
- **Сухожилия/добавки: честная иерархия.** Nulty 2025 (EJSS RCT): 30г гидролизата + 50мг VitC 2×/нед после тренировки 12 нед → CSA/stiffness/Young's modulus пателлярного выше, чем тренировка alone (средний возраст — впервые). Shaw-подобный протокол (15г + VitC за 30–60мин до) — база для `arm-tendon-fuel` (уже в коде, ок). VitC — кофактор гидроксилирования Pro/Lys + антиоксидант (scoping 2022). UC-II 40мг: Lugo 2013 (здоровые, степмилл, 120 дн — экстензия + безболевой период), Crowley 2016 (OA колено, 180 дн — WOMAC vs плацебо p=0.002 и vs G+C p=0.04); эффект умеренный, механизм — оральная толерантность. Глюкозамин/хондроитин: мета-анализы 20 RCT — при adequate concealment пользы по боли/WOMAC нет. Вывод: коллаген+VitC (тайминг!) и UC-II — оставить; G+C — понизить в иерархии.
- **BPC-157/TB-500: сильный preclinical, почти ноль human.** Gwyer 2019 + Regeneration-or-Risk 2025 + Biçer 2026 (крысы, ахилл): Fmax выше, коллаген I/III интенсивнее, но n=4/группа, комбинированная группа — без преимущества; Lee-Burgess 2025 — только pilot безопасности на 2 здоровых (IV, переносимость, без efficacy). Rx 2026: ни одного контролируемого efficacy-испытания у людей. TB-500 — в листе WADA. Вывод: текущий LV3-статус в коде честно маркировать investigational + WADA-флаг + онко-предосторожность (уже есть в стеке) — без обещаний «регенерации».

## §3. План: эпики J1–J7

Общий принцип (из синтеза выше): **скрининг, не диагноз; кластеры, а не 1 тест; боль = стоп; маршрут к врачу.** Всё — аддитивно, движки/строки/aria существующих хабов не ломать. Честные цифры sens/spec — в UI-подсказках, а не в скoring-магии.

- **J1 Плечевой кластер (опросник, без рук).** 5 вопросов да/нет: Painful-arc (боль 60–120° при подъёме), Hawkins-провокация (врач/партнёр ротирует согнутое плечо — было больно?), Jobe/Empty-can слабость (не удержать руки против сопротивления), Drop-arm (рука падает с 90°), Apprehension (страх вывиха при отведении+ротации). Правило: 0–1 = «кластер отрицательный, качай технику/объём»; ≥2 = «кластер положительный → к врачу/МРТ, жимы над головой и рывки — на паузу, только безболевой ROM». Никакого «у вас импинджмент» — только «кластер ±». Источник-гейт: Gismervik/Jain-2024. Потребители: BB/TA/STRONG-хабы + `joint-load-master` (shoulder-флаг).
- **J2 ТБС-скрининг (FADDIR + FABER + IROP опросником).** 3 вопроса (боль в паху при глубоком приседе/сидении; боль при FABER-позе; боль при внутренней ротации под нагрузкой) + ROM-флаг (IR <20° или асимметрия). Правило: FADDIR-положительный один — только «наблюдение + ограничить глубокий присед/рывок в сед»; ≥2 или +ROM-флаг — «к врачу (FAI/labrum в дифф. ряду), МРТ-артрография — золотой стандарт, а не наш опросник». Pålsson/обзор-2025 цифры — в подсказке.
- **J3 Колено/ACL-батарея.** (a) Single-leg squat + step-down самопроверка (вальгус «колено внутрь от 2-го пальца» да/нет + шатание) — предиктор aOR 4.64 при резких сменах; (b) YBT-ANT прокси без кита (рулетка: разница >4см = флаг); (c) RTS-чеклист по AAOS/Wright: LSI ≥90% (сила + hop, если мерялось) + срок ≥6 (BTB)/7+ (hamstring) мес + псих-флаг (страх = не готов) + prevention-программа. Без hop-данных — честно «не измерено», а не «пройдено». Встройка: WL-хаб (вальгус уже есть — добавить step-down + YBT-флаг), BB-ноги, STRONG (йок/фермер на вальгусе — стоп).
- **J4 Позвоночник/голеностоп/локоть/кисть — минимум.** SLR-вопрос (боль по задней ноге при подъёме прямой <60° → к врачу, без «диагноза грыжи»); Schober-lite (нагнуться — скованность + утренняя >30мин → к ревматологу в дифф. ряд); Thompson-вопрос (хлопок в икре + невозможность встать на носок → срочно к врачу); Finkelstein/Phalen/Tinel-опросник кисти (3 вопроса → к врачу, шина/нагрузка-пауза); локтевой valgus-stress вопрос (боль медиально при броске/жиме → пауза вальгусных). Всё — вопросы + red-flags-маршрут, без мануальных тестов (их нельзя делать самому).
- **J5 Beighton-гипермобильность + щадящий режим.** 9-балльный чек (мизинцы/большие пальцы/локти/колени/наклон) + возрастные пороги (≥6/≥5/≥4) + 5PQ при пограничных. При положительном: closed-chain + proprioception-приоритет, запрет end-range под нагрузкой и high-impact/contact, темп 3-1-1-0, RIR≥2, прогрессия ≤10%/нед; сила НЕ запрещается (Møller/Brittain). Встройка: профиль-флаг + фильтры пулов (все конструкторы) + teen-гейт TA/STRONG (как BB/ARM уже имеют).
- **J6 Честность суставной поддержки.** Коллаген 15–30г + VitC 50мг за 30–60мин ДО тренировки с верёвкой/прыжками (Nulty/Shaw; `arm-tendon-fuel` уже так — расширить подсказку на ноги/плечо); UC-II 40мг отдельным треком натощак (не смешивать с гидролизатом в один приём); G+C — понизить в ранжире (weak evidence, оставить как опцию, не как базу); BPC/TB — ярлык investigational + WADA-флаг (TB-500) + онко-предосторожность (уже в стеке) + «нет human efficacy RCT на 2026». Отдельный суставной мех в ТЗ-28 — не вводить (решение 2026 в силе), но в UI развести «доказано / умеренно / исследуется».
- **J7 Проводка: единый орто-скрининг + хабы + план.** NEW `ortho-screen.engine.ts` (чистые функции J1–J5: вопросы → флаги → кластер → маршрут; без диагнозов, с sens/spec-строками для UI) + карточки во все 4 хаба (переиспользование red-flags/return-to/mobilityRestrictions) + профиль (`health.orthoFlags`) + builder-гарды (кластер+ → axial/overhead-пауза, вальгус+ → йок/присед-гейт, Beighton+ → closed-chain) + экспорт/мост (HTML/CSV строки, как PRO-2/PRO-3) + yellow-flags (сон/стресс/страх движения) и teen TA/STRONG. Тесты: кластерные пороги (0/1/2+), YBT 4см, Beighton-пороги по возрастам, LSI-гейт без данных = «не измерено», каждый со своим триггером.

## §4. Не делаем (осознанно)
- Диагнозы по опроснику («у вас FAI/разрыв cuff») — только кластер ± и маршрут.
- Мануальные тесты руками пациента (Lachman/McMurray/Apprehension с партнёром-насилием, Thompson с силой) — риск ятрогении.
- MPT/рентген-чтение, инъекционные назначения, дозировки BPC/TB (только safety-рамка).
- Отдельный суставный механизм ТЗ-29 (решение 2026: мехов не добавляем).
- FMS-композит как «прогноз травмы» (AUC 0.587 — не продавать; только по-движениям + боль-правило).
- Хруст/щелчки без боли как патология (норма — наблюдать).

## §5. Выполнение J1–J7 кодом (Sep 2026)
- NEW `src/engines/pro/ortho-screen.engine.ts` (J1 плечо 5/кластер≥2 + urgent apprehension+dropArm; J2 ТБС 3+ROM; J3 вальгус/YBT>4/RTS LSI+срок+псих+prevention; J4 SLR/Schober-lite/Thompson/кисть 3/локоть; J5 Beighton 9 + пороги 6/5/4 + 5PQ; yellow + teen 14–15; J6 ранжир proven/moderate/weak/investigational + WADA; J7 screenOrtho/orthoGuardsForPlan/профиль/HTML+CSV+BOM/мост).
- NEW `OrthoScreenCard.tsx` (полная + compact; персист `he_ortho_screen_v1`; кнопки 💾/CSV/HTML/📦 weakpoints+orthoGuards).
- Проводка: `joint-load-master` += orthoBlockedPatterns (мёрдж); `planner-bridge` WeakpointsPayload += orthoFlags/orthoSummary/orthoGuards; карточка в 5 точках (TrainingSafetyHub + BB/WL/SM/ARM mobility/recovery); `supportProtocolJoints` += J6-легенда + UC-II-сепарация.
- Живые контуры (добивка): мост несёт `orthopedic.blockedPatterns` → SRCBBScreen weakpoints → `orthopedicBlockedPatterns` → lms-builder фильтрует паттерны (плечо+ реально ставит vertical_push на паузу) + `teenNote` → ББ-приёмник `he_bb_last_teen`.
- Добивка-2 «1–5 полностью» (закрыты все честные гэпы): П1 гарды исполняются — ББ-приёмник мёржит shoulder/hip в `mobilityRestrictions` (живой фильтр пула) + Beighton+ включает авто-делод; SM/TA-приёмник (`sm-bridge-intake` += orthoBlocked/orthoMobility/orthoYokeGate/orthoClosedChain/orthoTeen/orthoSummary) мёржит mobility + смягчает стратегию (yoke→не-агрессив, teen→conservative) + `orthoNote` в rationale плана; АРМ-приёмник персистит гарды/флаги + флешит teen. П2 Beighton в отбор: кисть→wrist + локоть→elbow в `mobilityAdd` движка и профиля (ключи ARM-пула/SM-MOBILITY_RU; ББ whitelist чистит чужие). П3 teen TA/STRONG — через тот же SM-приёмник. П4 печать HTML окном (`window.open`, фолбэк — копия). П5 hop-LSI: `hopLsi/hopLsiOverall` (min/max×100, мусор→null) приоритетнее чекбоксов в `assessRts` + 4 поля в карточке с живым LSI.
- Проверено: NEW ortho-screen 34/34 + card 4/4 + arm-bridge-ortho 3/3 + sm-bridge-intake 14/14 + соседи (bb-smoke/hub-bridge/arm-hub/discipline/sm-hub/joint/orthopedic/support) 117/117; `tsc` 0. BB-hub 3 падения — предсуществующие чужие (доказано прогоном без моих правок: те же 3).
