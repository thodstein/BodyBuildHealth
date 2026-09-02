# ТА-диагностика PRO — план профессионального уровня

Статус: **выполнено A-D (76054adb + продолжение)**, покрытие `412/412` strength-sport + `23/23` TA + `4/4` WL hub.

## Источники (internet)
- Gourgoulis 2000/2002 — углы колена 129-140° /159-170°
- Garhammer 1985 — рывок vs взятие
- Ang & Kong 2023 Sensors 23:1171 — 6 фаз + Kinovea + loadsol
- Vorobyev 1978 / Hiskia 1997 — 3 типа S-траектории
- Wood et al. 2026 PLOS ONE 7 derivatives Perch peak >1.3 м/с
- Sandau 2023 — FvR2 80/110 + vThres 1.7-2.0 → snatchTh ±1.5кг, Pmax
- Chavda 2024 Enode — r²0.99 вертикаль, bias Intercept+Slope
- Frontiers 2023 — SRD 4см turnover /6см catch, SEM меньше на max
- Rabin 2017 — knee-to-wall ≥12 cut 9 sens1.0
- Cook FMS/NASM — joint-by-joint 35-38° ankle

## Выполнено
- **A1** `strength-sport-biomechanics.engine.ts` — 16 WLWeakPoint числовые `angleRangeDeg`, `diagnoseTAWeakPoint`
- **A2** `strength-sport-barpath.engine.ts` — Vorobyev типы, `computeBarPathMetrics`, SRD, Enode correction
- **A3** `strength-sport-vbt.engine.ts` — `TA_PEAK_VELOCITY_ZONES` absolute 1.3-1.75, `computeFvR2`, `thresholdForTALift 10/15/20` (builder `strength-sport-builder:249` мигрирован)
- **A4** `strength-sport-scoring.engine.ts` — RSS `√Σpen²` + floors + verification 0.35/0.35/0.30
- **B** `strength-sport-ohs.engine.ts` — 6 сегментов, `kneeToWall`, heel 2.5см; `strength-sport-video.engine.ts` — Kinovea CSV + pose/force абстракции; `strength-sport-diary-integration.engine.ts` — e1RM 28д
- **B-injection** `strength-sport-ta-injection.engine.ts` — MRV cap + per-day dedup + intensityPct, проводка в `StrengthSportConstructor:234`
- **D** `WLDiagnosticsHub.tsx` 520с — 6 табов, числовые углы, bar metrics SRD, VBT зоны + FvR2, OHS чекбоксы + `-> профиль` `he_profile_v2` `filterByMobility`, IMTP/ISPP 85%, Kinovea импорт, RSS gauge, limiter подсказки, `applyToPlanner` с biomech
- **Export** `strength-sport-wl-export.engine.ts` — `buildWLDiagnosticsHtml/buildWLPlanHtml` + download
- **Тесты** `ta-diagnostics-pro 23 + ta-injection 5` parity injection

## Остатки на следующий раунд
- MediaPipe BlazePose live-углы (hip/knee/ankle) + loadsol драйвер — сейчас stub
- Годовой мост ТА → `annual-training` гибрид (состав `bb+TA`)
- Печать/ICS для ТА-диагностики из хаба (кнопка)
- Женские траектории Type3 нормирование, parity матрица `strongman 192 + WL 192`

## Критерии PRO
- Все фазы имеют `angleRangeDeg` + `references`, `assistance` в каталоге (0 missing)
- Bar path Type2 optimal vs Type3 требует коррекции, SRD бейдж
- VBT absolute >1.3, FvR2 ±1.5кг, пороги 10% power
- OHS ≥12см, heel retest дифференцирует ankle vs thoracic
- Injection parity с PL (budget + dedup + dayMap) 5 тестов

## Связь
- `WLDiagnosticsHub → planner-bridge weakpoints → StrengthSportConstructor weakPoints → buildStrengthSportPlan weakPoints ×1.15 + injection 3×5 @intensityPct`
- `OHS → he_profile_v2.health.mobilityRestrictions → filterByMobility` (щит от травм)

## Доведение до PRO-final (ababa434e + e3c3d5f7)
- **Injection** strength-sport-ta-injection.engine.ts 3×5 @intensityPct, dedup + Budget cap, dayMap 1-based, technique_day приоритет — parity PL 5 тестов + property 32 combos
- **Hub OHS→профиль** WLDiagnosticsHub: applyMobilityToProfile — he_profile_v2.health.mobilityRestrictions → ilterByMobility в builder, кнопка OHS в профиль
- **VBT builder** strength-sport-builder:247 isTA 10% / isTAPull 15% / carry 15% + hist 10/15/20
- **Pose** strength-sport-pose.engine.ts BlazePose stub estimateAnglesFromLandmarks hip/knee/ankle/shoulder, livePoseStatus, mock stream — рендер в summary + video tab
- **Export** strength-sport-wl-export + WLDiagnosticsHub: handleExport 🖨 HTML + critical gate score≤49 баннер
- **Bar path** Enode table yT -0.014/1.0 r2 0.99, xLoop -0.45/1.08, bfPCA extractBfPCAPatterns Pattern1 backward +0.42 corr (Kipp)
- **Diary** candidateTAWeakPointsFromDiary phaseForReps reps≤2→max moment /3-5→mid — отображение в header 📓 фазы
- **Верификация** itest 421/421 	a-injection 6/6 strength-sport 412/412

## Финал P2 (0754e45b + c19958b85) — parity 192 + pose live
- **Parity 192** 	a-injection.test.ts 48→192 (modes×levels×goals×days) without throw, strength-sport-matrix 192 уже 421/421
- **Pose live** ensurePoseModel CDN mediapipe/pose@0.5 + detectPoseFromVideo + 3 теста estimateAngles/hasPoseSupport/livePoseStatus
- **VBT пик** LOAD_VELOCITY_PROFILE_SS.snatch 0.85→1.30 peak (Wood), phase6-pro.test обновлён
