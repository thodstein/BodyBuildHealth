# CARDIO-PRO-LEVEL-PLAN.md — вывод кардио-конструктора на PRO-уровень

Статус: ✅ ВЫПОЛНЕН (эпики A–G). Baseline 540 тестов зелёные, +26 PRO-тестов.
Файлы только свои: `src/engines/lms/cardio-*`, `src/engines/cardio-import.engine.ts`,
`src/ui/screens/TrainingScreen_parts/Cardio*`. Чужие файлы не тронуты.

## Источники (2024–2025)

- Silva et al. Sports Med 2025 — POL vs PYR без разницы VO2/TT; competitive → POL, recreational → PYR.
- Cove et al. JSMS 2024 — велосипедисты POL = NP.
- Nøst et al. Sports 2024 — POL 75-80% LIT + 15-20% HIT оптимально для VO2.
- Treff et al. 2019 — PI = log10(Z1/Z2×Z3), порог 2.
- Filipas 2021 — PYR→POL 16 нед +3% VO2max.
- Strepp et al. 2024 — HR занижает Z3 до 40% в HIIT-shock; нужны power/pace.
- Wang et al. PMC 2023 — taper 41-60% 8-14д progressive.
- Bosquet 2007 — 40-60% 14д exponential, +1.9%.
- Thomas & Busso — overload +20% 28д → taper 21д.
- Front Sports 2024 F-OR — AF +1.82% vs F-OR −0.49%.
- Papini et al. Front Physiol 2024 — HR-drift коррекция, hysteresis AUC −77%.
- Barsumyan et al. Front AI 2025 — VGP 0.93 responder по drift+decoupling.
- Rothschild 2025 — HR/FR decoupling предсказывает падение VT1 (MAE 7.2W).
- TrainingPeaks — decoupling <5%/5-10%/>10%; Pw:Hr / Pa:Hr.
- Wilson 2012 — бег вредит силе/гипертрофии, вело нет; r=−0.26..−0.75.
- Huiberts 2023 — interference lower-body мужчины −0.43, женщины ~0.
- Petré 2021 — тренированные страдают только при same session (ES −0.66).
- Robineau — интервал ≥6ч между силой и выносливостью.
- Polar — дрейф после 60-90'; >90' pace/RPE первичны.

## Эпик A — полевая калибровка ✅

`cardio-field-tests.engine.ts`: `ftpFrom20MinTest` (×0.95 Allen & Coggan),
`criticalPowerFrom3And12` (Monod & Scherrer), `talkTestZone2Ceiling`/`zonesFromTalkTest`,
`personalZones` (LTHR > FTP > CP > VDOT > talk > age), `recommendFieldTest`, `validateFieldTestInput`.
Интеграция: `CardioCycleInput.lthr/ftpWatts/talkZone2Hr` + `buildCardioCycle` использует
LTHR/talk вместо age; UI `CardioParamsStep` PRO-аккордеон + `CardioConstructor` state/persist.

## Эпик B — PMC daily + HR-drift ✅

`cardio-pmc.engine.ts`: `dailyPmcSeries` (EWMA 42/7, календарно), `hrTss` (Banister),
`powerTss` (NP/FTP), `runTss` (VDOT), `correctHrForDrift` (Papini-lite: >60' + жара + дегидратация),
`driftCorrectedTss`, `tssRampRate` (>15% warn), `interpretTsb`.
UI: `CardioAnalyticsDashboard` — TSB/CTL tile + PMC-блок + рампа.

## Эпик C — FIT-native ✅

`cardio-import.engine.ts` уже парсит FIT через `fit-file-parser` (sessions/laps).
Добавлено PRO: `fitDecoupling` (power/HR или speed/HR по половинам),
`fitHrZoneHistogram`, `fitSecondHalfDrop` (durability-флаг >10%).
ZIP/TCX/GPX/CSV/JSON без изменений.

## Эпик D — TID + PI ✅

`cardio-tid.engine.ts`: `tidZoneOf` (rec/zone2→Z1, miss→Z2, hiit→Z3), `timeInZones`,
`polarizationIndex` (доли, порог 2: 80/5/15→2.38 POL, 80/15/5→1.42 PYR),
`classifyTid` (PI + Z1>Z3>Z2), `tidAdvice` (Silva/Cove), `phasedTidTarget`
(general 85/8/7 → specific 80/10/10 → precomp 78/5/17 → comp 75/5/20),
`tidDistanceToTarget`. UI: POL-IDX в `CardioPreviewStep` + `CardioAnalyticsDashboard`.

## Эпик E — durability ✅

`cardio-durability.engine.ts`: `aerobicDecoupling` (<5 strong / 5-10 moderate / >10 weak),
`efficiencyPowerHr/PaceHr`, `durabilityTrend` (≥2 замеров ≥60'), `responderClassification`
(Barsumyan lite), `durabilityDurationTarget` (вело 2-4ч, бег 1-2ч).
UI: DECOUPL-блок в дашборде.

## Эпик F — taper-индивидуализация ✅

`cardio-taper-pro.engine.ts`: `exponentialTaperMult`/`stepTaperMult`,
`recommendTaperDecay` (≤14д fast τ=4, >14д slow τ=8),
`individualizedTaperPlan` (база 14д −50% exp; overload +20% → 21д; F-OR/ACWR≥1.5/сон<6 → 21д −60% + гигиена сна),
`performanceGainEstimate` (оптимум 41-60% 8-21д → 1.9-2.6%).

## Эпик G — safety + interference v2 ✅

`cardio-safety.engine.ts`: `heatAltitudeHrAdd` (жара >25 +1/°C кап 10, высота +1/300м кап 15),
`hydrationAdvice` (500-750 мл/ч, >90' электролиты + 30-60г углей/ч),
`cardioTimingPenalty` (separate 0 > 6h 0.5 > 2h 1.5 > same session 2.5, Petré),
`cardioInterferenceV2` (Wilson/Huiberts/Petré/Robineau, пол ×0.85, шкала 0-10).
Интеграция: `CardioCycleInput.tempC/humidityPct/altitudeM` сдвигают зоны в `buildCardioCycle`
+ rationale; дашборд — safety-блок + Interference v2.

## Тесты

`cardio-pro-level.test.ts` 32/32: FTP/CP/talk/personalZones/build LTHR+жара;
PMC/drift/TSS/ramp/TSB; TID/PI/advice/phased; decoupling/trend/responder;
taper exp/step/decay/individual/gain; safety heat/timing/interference v2; FIT decoupling/hist/drop;
apply taper + cut; CP МНК + журнал тестов; extractFitRecords.
Полная кардио-область 566+6 зелёные, tsc 0 по своим файлам (фильтр cardio).

## Продолжение — раунд 2 (остатки закрыты)

- **Taper-pro применяется**: `applyIndividualizedTaperToCycle(cycle, plan, {showWeek})`
  в `cardio.engine.ts` — окно round(days/7) нед перед шоу, непрерывный exp-множитель
  (τ плана), N-1 только zone2/recovery, идемпотентен, возвращает changes на подтверждение.
  UI: `taperCutFromCycle` считает фактический срез цикла → строка прогноза
  «−X% за Nд → +Y%» в taper-карточке `CardioPreviewStep`.
- **FIT-записи**: `extractFitRecords(parsed, cap)` (snake/camelCase, м/с→км/ч, кап 20000) +
  `parseCardioFitRecords(buffer)` (сводка + записи для decoupling/durability).
- **CP МНК**: `criticalPowerFromEfforts` (P = CP + W'/t по 2+ усилиям, R², W' кДж) +
  `appendFieldTestLog` (кап 24, дедуп) + `responderFromLog` (два последних AeT-замера).
- Остаётся осознанно: ML-VGP обучение на истории (нужен бэкенд/IDB-датасет),
  посекундный FIT-стрим (память 50Мб export.zip), авто-пересборка taper без подтверждения.

## Продолжение — раунд 3 (taper-замыкание в UI)

- **Вкладка «📉 Тапер» в Управлении**: NEW `CardioTaperStep.tsx` — пред-нагрузка 0/10/20%,
  усталость AF/F-OR, сон, неделя шоу (авто: первый старт → пик → конец); план-бейдж
  (дни/срез/τ/прогноз + гигиена сна),   список изменений окна, «✓ Применить» только при непустых changes; прошлое не трогается, повтор идемпотентен.
- **Проводка**: `CardioManageStep` — таб + опциональный `onApplyTaper`;
  `CardioConstructor.applyTaper` — snapshot версии + save + active + flash
  (отмена — «↩ Вернуть версию», как у остальных авто-подстроек).
- **Тесты**: NEW `cardio-taper-step.test.tsx` 6/6 (план/применение/F-OR/overload/пусто/идемпотентность + таб в Manage).

## Продолжение — раунд 4 (журнал замеров в UI)

- **Персистентность**: `FIELD_TEST_LOG_KEY = 'he_cardio_field_tests_v1'` +
  `load/save/remove/clearFieldTestLog` (валидация формы, сортировка, кап 24, quota-тихо).
  `FieldTestLogEntry` += `talkHr` (потолок Z2); ftp20 хранит FTP (= P20×0.95).
- **NEW `CardioFieldTestLog.tsx`** — карточка «🔬 Контрольные замеры» во вкладке «Журнал»
  дневника (`CardioDiaryStep`): виды AeT 60'/LTHR 30'/FTP 20'/talk-test с условными полями,
  inline-валидация (alert), бейдж Responder/Non-responder, удаление, персистентность
  при перемонтировании. Свой state — родитель не тронут.
- **Тесты**: storage 2/2 (roundtrip + битый JSON) в `cardio-pro-level.test.ts` (34/34);
  NEW `cardio-field-test-log.test.tsx` 7/7 (пусто/добавление/Responder/валидация/LTHR/FTP/удаление/ремонт).

## Осознанные остатки (не баги)

- ML VGP responder — lite-эвристика (два теста), не обучение на истории.
- CP — двухточечная модель 3'/12', без 3-параметрической.
- FIT records — сплиты, не посекундный стрим (память).
- Taper-pro — рекомендации, не авто-пересборка цикла (подтверждение пользователем).
