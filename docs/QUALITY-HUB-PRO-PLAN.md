# Хаб «Качество программы» — аудит + PRO-план

Статус: P1–P7 ВЫПОЛНЕНЫ кодом (Sep 12 2026, закоммичено pathspec своих, без пуша).
Проверено: NEW v2 35/35 + S1-V2 11/11 + helpers 13/13 + actions 5/5 + соседи 67/67 = 131/131; `tsc` 0 по своим.
Добивка «V2 в ББ-авто»: NEW bb-quality-v2 8/8 + card 3/3 + соседи 131/131 = 142/142; `tsc` 0 по проекту.
Отклонения: legacy push/pull-ratio и грейды S3/S5 оставлены (V2-дубль рядом); QualityDiagnosticsHub не схлопнут (свои пропсы); числа VOLUME_LANDMARKS_DB не тронуты.
Хаб: `QualityHub.tsx` (тонкая обёртка) → `CalcQualityTab.tsx` (~1100 строк) → движки `plan-quality.engine.ts` / `plan-quality-score.ts` / `manual-constructor/manual-quality.engine.ts` / `manual-constructor/pro-quality-analysis.engine.ts` / `volume-landmarks.engine.ts` / `bb/bb-quality-report.engine.ts`.
Диагностика движения — соседний `DiagnosticsHub.tsx` (9 лифтов, вне скоупа этого плана, только стыки).
Тесты: `__tests__/calc-quality-tab.test.tsx` (2 smoke), `manual-constructor/__tests__/pro-quality.test.ts`, `bb/__tests__/bb-*-quality*`.

## 1. Аудит — что есть сейчас и где болит

### 1.1 Архитектура: 5 скорингов без единого источника правды
| # | Скоринг | Формула | Где виден |
|---|---------|---------|-----------|
| S1 | `validatePlanQuality` (plan-quality.engine, 591 строка) | 100 −15/−5/−2 за issue +20 бонус weakCoverage×0.2 +5 делод | ручной конструктор, макроцикл |
| S2 | `calcQualityScore` (plan-quality-score.ts, 93 строки) | 100 −8×readinessFactor/−6/−10/−15/−20/−5 | TrainingConstructor/PlanDisplay (legacy) |
| S3 | `computePlanQualityFor` (manual-quality, 173 строки) | 100 −8/−3/−2/−1, грейды A/B/C/D | CalcQualityTab (основной!) |
| S4 | `analyzeProQuality` (pro-quality-analysis, 381 строка) | delta −30..+5 к S3 | CalcQualityTab PRO-блок |
| S5 | `bb-quality-report` (231 строка) | safety-база −8/−3 по уникальным кодам | BB-авто шаг «План» |

Одна и та же программа даёт 3–4 разные оценки в разных вкладках (пороги/грейды/штрафы не совпадают: S1 «🟢 Профессионально ≥85», S3 «🟢 A ≥90»). Пользователь не понимает, какой цифре верить. S2/S5 вообще не вызываются из хаба — мёртвый/параллельный контур.

### 1.2 Пороги объёма: два канона конфликтуют
- `VOLUME_THRESHOLDS` (plan-quality.engine:26): грубое big/small × 4 уровня. Beginner big MEV 8 / MRV 18; small MEV 6 / MRV 16.
- `VOLUME_LANDMARKS_DB` (volume-landmarks.engine:36): тонкие 15 мышц × 4 уровня (chest 6/10/15 beginner … 12/18/28 enhanced; delt_front MEV=0 — косвенная работа жимов; composite legs=quads+hams, arms=bi+tri).
- S1 использует первый канон (+ масштаб `mrvByMuscle`), S3/S4 — второй (+ `courseIntensity` 1.15/1.2/1.3). Результат: один и тот же chest 18 сетов — «approaching_mrv» в одном месте и «high» в другом. `plan-quality-score.ts` — третий канон (`levelBaseMrv 15/20/24/28` + `mrvOverride`).
- Нет MV (maintenance volume, RP: 0–6 сетов) — поддерживающий объём клеймится «недотрен». Нет session-MAV (RP: 5–12 сетов/мышцу/сессию) — 20 сетов груди в один день проходят недельный гейт. Нет effective/direct-различения в S1 (S3 через `analyzeManualVolume` indirect 0.45/0.35/0.4 уже умеет — паритет не доведён).

### 1.3 Частота: бинарный варнинг мимо науки
S1: `freq===1 && BIG → warning «субоптимально (Schoenfeld 2016)»`. Наука точнее: 2× > 1× при уравненном объёме (Schoenfeld 2016, ES 0.49 vs 0.30); но 2× ≈ 3× ≈ 4× при уравненном объёме (Grgic 2018; Hamarsland 2022; Schoenfeld 2019; Brigatto/Colquhoun/Zaroni). Текущий гейт штрафует 1× всегда (даже когда это осознанный bro-сплит с объёмом в MAV) и никак не поощряет разбиение большого объёма на 2 сессии (где реальный выигрыш — Session MAV + MPS-окна). Частоты >2 не различаются.

### 1.4 Push/pull-сеты — ложная метрика плеча
S1 считает `pushSets` (chest+triceps+shoulders+delt_front/mid) vs `pullSets` (back+biceps+delt_rear+hamstrings+glutes!), порог 1.5. Проблемы: (а) ноги (hams/glutes) в «тяни» искажают плечевой баланс; (б) горизонт/вертикаль не различаются; (в) литература (Rehab-U; Ellenbecker/Davies ER/IR 66–75%; Kolber/Gentil обзоры травм плеча в RT: жим/отжимания за головой/флаи — техника и объём жимов, а не сырой sets-ratio) — «золотое 2:1 тяни» как обязательный стандарт не подтверждается. Нужен плечевой суб-скор (жимовый объём + вертикаль/горизонталь + ротаторка/face-pull наличие), а не один ratio.

### 1.5 Разгрузка: только факт наличия
S1: `!hasDeload && weeks≥6 → critical`; `interval>7 → warning`. Наука (Rogerson Delphi 2024; Stronger 2026; RP; Israetel): делод каждые 4–6 нед intermediate, 3–6 advanced, 6.4±1.7 дня; объём −30…−50%, нагрузка −10…−30%, RIR+2…+4, частота сохраняется/снижается на 1. Хаб не проверяет КАЧЕСТВО делода (срез объёма? RIR? интенсивность сохранена для ПЛ-тапера vs снижена для ББ-делода?), не различает deload vs taper vs peak (тапering держит интенсивность — Bosquet/Travis; делод снижает всё).

### 1.6 RIR/близость к отказу — не валидируется
Движки знают RIR, но качество его не оценивает. Наука (Refalo 2024: 1–2 RIR ≈ отказ для квадрицепса за 8 нед; Martikainen 2025: волновой RIR 4→1 = тот же рост при меньшем RPE; Remmert/Zourdos 2023–2024: точность RIR растёт у отказа и в поздних сетах): новичку RIR 0 во всех сетах — красный флаг; всем RIR 4+ — «мусорный объём»; отсутствие ни одного тяжёлого сета (RIR≤2) — недогруз стимула. Сейчас — тишина.

### 1.7 Длина/углы/разнообразие — только в PRO-ответвлении
S4 (паттерны/углы/stretch/техника/цель) работает только для сохранённых UserProgram и только через `collectExercises` с fuzzy-матчингом каталога. S1 (универсальный валидатор для BB-планов/циклов) про углы/длинную-длину не знает вообще. Наука длины (Maeo 2021–2023: seated leg curl/overhead extension > короткой; Kassiano 2023: икры на длине +15.2%; Wolf 2023 meta; Strey 2026 meta ES 0.283 за LL, дистал/центр значимо): boolean `stretchPhase` недостаточен — нужен per-muscle length-bias (доля длины ≥50% для груди/хамсов/трицепса/икроножных). Diversity-гейт S1 (`unique/total<0.4 → info`) тривиально обходится.

### 1.6b Нагрузка/восстановление — нет ACWR/монотонии
Хаб не считает ACWR, монотонию/strain, sRPE-тренд (Gabbett; Foster). Дневник рядом (`bbExtra/plExtra` считают тоннаж/эфф.сеты), но в скор не входит. Сон/стресс/HRV — только через `labMult`/`readinessFactor`, без гейтов «сегодня можно/нельзя».

### 1.8 UX: god-компонент без действий
- `CalcQualityTab` ~1100 строк: 4× дублированный синтез customWeeks из `sourceCycleId`, хардкоды (`workMax {140/100/160}`, `fallbackPm 80`, `pm=100` условный, `вес 60`), три параллельных чарта (lmsChart/bbChart/bbWeeklyChart + bbExtra/plExtra + bbReportExtras/plReportExtras).
- Оценки read-only: `fix:`-строки S1 никуда не ведут (нет «Применить», «Открыть в редакторе», «Снизить до MAV одной кнопкой»).
- Нет истории/тренда (снапшоты `he_quality_history`), сравнения программ (A vs B), экспорта (HTML/CSV/печать), моста в конструкторы (в отличие от BB/PL-диагностик с `training-open-tab` + `weakpoints`).
- `QualityHub` (24 строки) и `QualityDiagnosticsHub` (82 строки) дублируют друг друга (два «единых хаба»); `BBFeedbackCard` сверху не связан со скором снизу.
- A11y/АПК: кнопки 6–10px тексты, таблицы без tabular, нет `data-q="..."` хуков для native-слоя.

## 2. Интернет-синтез 2024–2026 (что берём в план)

1. **MEV/MAV/MRV — калибровка, не догма.** RP/Israetel (Arvo 2026; TrainerStudio 2026; lifting-volumes-overview): MEV ~6–8, MAV ~12–18, MRV ~20–25 сетов/мышцу/нед; по группам грудь 6–8/12–18/20–24, спина 8–10/14–20/22–26, плечи-бок 6–8/12–20/24, квадры 6–8/12–18/20–24, хамсы 4–6/10–14/16–20, бицепс 4–6/10–14/16–20, трицепс 4–6/10–12/14–18, икры 6–8/12–16/20–24; MV 0–6 (поддержание косвенной работой: передняя дельта/трапы/пресс MEV=0 допустим); Session MAV 5–12 (лимит ~10 прямых сетов/мышцу/сессию); enhanced +~15%. Наши `VOLUME_LANDMARKS_DB` в коридорах — **не переписываем числа**, добавляем MV + session-кап + effective-объём. Schoenfeld 2017 dose-response: 10+ сетов дают +36% к <5 сетам — держим MEV-гейт строгим, а «перегруз +10%» — толерантностью, не ошибкой.
2. **Частота: 2× минимум при равном объёме, дальше — делёж объёма.** Schoenfeld 2016 (2×>1×, p=0.002); Grgic/Schoenfeld 2018–2019, Hamarsland 2022 (2×≈3–4× при equated volume). Правило хаба: 1× допустим только если объём ≤ MAV и сессия ≤ session-MAV; объём > MAV → требовать ≥2× (разбить, а не резать); 2× vs 3× — не штрафовать.
3. **RIR: 1–2 до отказа достаточно.** Refalo 2024 (FAIL ≈ 2/1-RIR за 8 нед, усталость выше у FAIL); Martikainen 2025 (RIR 4→1 волна = тот же рост, RPE ниже; точность RIR приемлема и растёт); Helms/RIR-RPE шкала. Правило: средний RIR недели 1–3 (масса), доля RIR≤2 ≥30% сетов, RIR 0 только у intermediate+ и ≤15% сетов; новичку RIR 0 — critical.
4. **Делод: короткий, плановый, с цифрами.** Rogerson Delphi 2024 + Springer survey (6.4±1.7 дня каждые 5.6±2.3 нед; объём ↓ сетами+повторами, частота чаще сохраняется); Stronger 10k логов 2026 (делод 4–6 нед → −35% pain-флагов, +3–5% силы в нед 1–2 после); RP-мезоцикл 4–6 нед +1 нед ×0.5. Правило: проверять глубину (объём −30…−50%, RIR+2, нагрузка −10…−30%), различать deload/taper/peak.
5. **Длина мышцы бьёт короткую.** Maeo 2021–2023 (seated curl/overhead tri > короткой), Kassiano 2023 (икры на длине), Wolf 2023 meta (тренд за длину), Strey 2026 meta (LL>SL ES 0.283, дистально 0.433). Правило: per-muscle length-доля (≥1 упражнения с stretchPhase / паттерны RDL/инклайн/overhead/глубокий присед) — warning, не critical.
6. **Плечо: техника+баланс плоскостей, а не сырой ratio.** Rehab-U разбор мифа 2:1; Ellenbecker ER/IR 66–75%; обзоры Gentil/Kolber (жим лёжа/за голову/флаи/военный — техника и end-range). Правило: плечевой суб-блок (жимы vs тяги по ВЕРХУ отдельно от ног; вертикаль+горизонталь обе представлены; face-pull/наружная ротация наличие) вместо одного `push/pull>1.5`.
7. **Нагрузка: ACWR + монотония.** Gabbett ACWR 0.8–1.3 low risk; Foster monotony/strain. Правило: опциональный дневник-слой (факт 7/28д → ACWR-зона + «сегодня можно/нельзя»), без дневника — честное «нет данных», скор не штрафуем.

## 3. PRO-план (эпики P1–P7, только свои файлы)

Контракты: единый `QualityScoreV2 {score, grade, perMuscle[], issues[], recommendations[], breakdown{volume/frequency/rir/deload/shoulder/length/diversity/load}, meta}`; единый грейд `≥85 Профессионально / ≥65 Хорошо / ≥45 Удовлетворительно / иначе Требует доработки` во всех 5 скорингах (S2/S5 — адаптеры, не дубли). Старые сигнатуры — `@deprecated`-обёртки, тесты зелёные без правок чужих файлов.

- **P1 Единый скоринг (ядро).** NEW `quality-score-v2.engine.ts` (композитор: volume 40 + frequency 15 + rir 10 + deload 10 + shoulder 10 + length/diversity 10 + load 5; веса в константах, сумма 100): S1/S2/S3/S4/S5 делегируют ему (S1 — volume+frequency+deload-срез, S3 — volume-срез, S4 — length/diversity/rir-срез как `scoreDelta`, S5 — safety-срез). Добавить MV-статус (`maintenance` — не штраф, отдельная плашка), session-MAV гейт (мышца >10 прямых сетов/сессию → warning с разбиением), effective-объём (indirect-коэффициенты из `analyzeManualVolume`, паритет с S3) во все срезы. Тесты: матрица паритет-A/B (один план → все скоринги в ±3 балла), MV не штрафуется, session-кап ловится, effective ≤ direct+indirect.
- **P2 Частота v2 + RIR-гейты.** `frequencyForVolume` (объём ≤MAV → 1× допустим info; >MAV → нужен ≥2× warning; >MRV → critical независимо от частоты) + `rirProfileCheck` (средний RIR, доля RIR≤2, доля RIR 0 по уровням; новичок RIR 0 — critical; >40% техник — перебор из S4 переиспользовать). Встройка в V2-composer + `bbPlanToQualityInput` (средний RIR из workSets) + `manualToQualityInput`. Тесты: bro-сплит MAV проходит; верх MAV в 1 сессию — warning с «разбить на 2»; новичок с отказом — critical; все RIR 4+ — warning «мусорный объём».
- **P3 Делод-качество + taper-различение.** `deloadQualityCheck` (глубина объёма −30…−50%, RIR+2, нагрузка −10…−30%, длительность 5–10 дней, частота не выросла) + `phaseTag` (deload vs taper vs peak по `contestPhase/peakWeek/taper` — taper держит интенсивность, делод снижает; неверный тег — info). Тесты: делод-призрак (только флаг без среза) ловится; taper с интенсивностью проходит; отсутствие делода при 12 нед — critical как было.
- **P4 Плечо v2 + длина/углы в общий валидатор.** `shoulderBalanceCheck` (верх push vs верх pull отдельно, без ног; вертикаль+горизонталь покрытие; face-pull/ER наличие — info «добавьте тягу к лицу» вместо critical) + `lengthBiasCheck` (per-muscle доля длины через `stretchPhase`/паттерн-маппинг S4, порог 50% для chest/hams/triceps/calves/glutes — warning). Старый `push_pull_imbalance>1.5` — downgrade до info с ссылкой на новый блок (совместимость тестов). Тесты: ноги больше не ломают плечо; жим-доминация без тяг — warning; длина 0% у груди — warning, у пресса — тишина.
- **P5 Нагрузка из дневника (опционально) + специализация/MV-осознанность.** `loadLayerCheck` (дневник 7/28д → ACWR-зона Gabbett + монотония Foster + «сегодня» бейдж; без дневника — `no_data`, скор не трогаем) + `specAwareVolume` (недели специализации/баланса из `specializationSchedule` — цели судятся по MAV блока, не-цели по MEV; MV-режим мышцы — плашка, не штраф). Тесты: без дневника — no_data и 0 штрафа; ACWR danger — warning; спец-неделя не-цели на MEV проходит.
- **P6 Хаб-действия: сравнение/история/экспорт/мост.** Хаб: снапшоты `he_quality_history` (кап 10, Δ было/стало), сравнение A vs B (дельта скора + per-muscle таблица), кнопки «Применить фикс» (снизить до MAV / разбить на 2× / добавить делод — через `planner-bridge` в ручной/ББ-конструктор), экспорт HTML/CSV/печать (XSS-esc, как `bb-quality-report` экспорт-паттерн), `data-q` хуки + tabular + 44px кнопки (АПК-слой append-only). Тесты: UI smoke (снапшот/сравнение/экспорт/мост-превью без чужих моков).
- **P7 Чистка god-компонента.** `CalcQualityTab` распил без смены логики: `useQualityProgram` (выбор программы + синтез weeks), `useQualityCharts` (lms/bb-weekly чарты, единый `resolveWorkMax` без хардкодов 140/100/160/80/60/100), `QualityScoreCard/PerMuscleBars/QualityActions` компоненты; `QualityHub` vs `QualityDiagnosticsHub` — один живёт (второй — re-export-алиас, без дубля UI). Тесты: существующие 2 smoke зелёные без правок + 1 NEW на `resolveWorkMax` (профиль > фолбэк > 60).

## 4. Не делаем (осознанно)

- Не переписываем числа `VOLUME_LANDMARKS_DB` (коридоры совпадают с RP 2026 — только MV/session-кап/effective сверху).
- Не строим медицинский риск плеча/позвоночника (только программные гейты; «не диагноз» плашка).
- Не тянем on-device видео/VBT в скоринг (это `DiagnosticsHub`, стык — только ссылкой).
- Не ломаем старые сигнатуры S1–S5 (адаптеры + `@deprecated`, чужие тесты/вызовы целы).
- Не оцениваем питание/фарму внутри скора (только `labMult/courseMult` контекст-строкой как сейчас).
