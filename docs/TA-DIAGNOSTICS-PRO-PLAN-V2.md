# ТА-диагностика PRO-v2 — план доведения до уровня ББ-хаба и Мастера движений

Статус: **ВЫПОЛНЕН 100% (Sep 2026)**. База: `docs/TA-PRO-PLAN.md` (A–D, 76054adb + доведение, 421/421 strength-sport).
Этот раунд: P0 (E1–E6) + P1 (E7–E10) + P2 (E11–E14) + P3 (E15–E17) — все эпики закрыты.
Итог: strength-sport область **589/589 (40 файлов)**, hub **21/21**, tsc 0 по своим файлам (1 чужая ошибка `supportProtocolPostCycle.tsx` — не тронута).
Коммиты: faa2117e (E1), d39eb03e (E2), eb03a4f0 (E3), 4e5fb81c (E4), 6a20dcb2 (E5), 75a40bc0 (E6), 45b3a0c7 (E7), 03bdb941 (E8), 8972cab2 (E9), 468668ed (E10), 4c3a20ea (E11), c24a8588 (E12), d2441358 (E13), ba0c5b9f (E14), 1c37bb1d (E15), c8e8fda7 (E16), + E17/финал.

Область: `src/engines/strength-sport/*` + `src/ui/screens/TrainingScreen_parts/WLDiagnosticsHub.tsx` (603с).
Ядро билдера/периодизации ТА — НЕ трогаем, только reuse.

## 0. Что уже есть (не дублировать)

- Хаб 6 табов: рывок 5 фаз + взятие 3 + толчок 3 × `angleRangeDeg`, bar path (Vorobyev типы + SRD 4/6 + Enode-коррекция),
  VBT peak-зоны (PLOS 2026, absolute >1.3) + FvR2 (Sandau, snatchTh ±1.5кг) + LVP ramp, Kinovea CSV + BlazePose stub,
  OHS 6 сегментов + knee-to-wall + heel-retest 2.5см + асимметрия L/R (7/12%), IMTP/ISPP 85%, RSS-скоринг + floors +
  verification 0.35/0.35/0.30, инъекция 3×5 @intensityPct + budget + dedup + dayMap, HTML/CSV экспорт, дневник e1RM + phaseForReps.
- Движки-сироты (написаны, но хаб их НЕ вызывает): `autoValidateAnglesFromPose`, `autoOHSFromPose`,
  `diagnoseJerkDip` (dip см/мс + drivePower), `optimalFvSlopeForPmax`, `vbtEwma` / `vbtHistoryForLift` /
  `diagnoseVelocityLossEwma`, `velocityWeightAdjustFactor`, `extractBfPCAPatterns`, `isRealChange(phase)`,
  `saveBarTracking/loadBarTracking`.

## 1. Интернет-источники (проверены Sep 2026)

**Биомеханика / траектория:**
- Arauz et al. 2024/2025, J Biomech 175:112291 + 183:112625 — elite vs varsity: кинематика суставов, EMG, асимметрии; 3D motion capture + EMG.
- Tunçel et al. 2025, JHSE 20(3) — траектория рывка по весовым: пересечение вертикали во 2-й тяге 24% LWC / 33% MWC / 47% HWC; горизонтальные смещения — ключевой фактор эффективности (Burdett, Garhammer, Vorobyev 1978, Whitehead 2014).
- Kipp et al. 2024, Sports Biomech 23(1):58-68 — bfPCA траекторий: Pattern1 (вперёд/назад) corr +0.42 с результатом, Pattern3 (пересечения) −0.38.
- Torokhtiy (Putsov) 2024, bar-path guide — 4 типа траектории рывка (A — откат назад, B — вперёд, C — «новичок» с ударом, D — идеал); jerk dip 8–12% роста строго вертикально.
- GymAware 2025 — 4 типа траектории (Type4 двойная S, 6%); Type3 у 53% женщин ЧМ (Hiskia) — норма для женщин, warn для мужчин.

**VBT / FvR:**
- PoinT GO 2026, VBT for Olympic Weightlifting — бенчмарки пиковой скорости: рывок 1RM 1.7–2.0 м/с (M) / 1.5–1.8 (F), взятие 1.5–1.8 / 1.3–1.6; просадка >0.15 м/с на субмаксимальном стандарте = флаг усталости/техники; IMU > тросовых LPT для ТА (3D-траектория).
- Wood et al. 2026, PLOS ONE — LVP 7 деривативов (Perch, peak velocity): generic-зоны Mann НЕвалидны для ТА-деривативов, нужны exercise-specific зоны.
- Suchomel et al. 2025, JSCR 39(2) — barbell vs system velocity по деривативам (JS/HHP/HPC/HCP/CMS).
- Sandau et al. 2021, JFMK 6:35 + 2023, PLoS ONE — FvR2 (two-point snatch pull 80/110 + vThres) → snatchTh; Pmax + vThres — детерминанты; оптимальный FvR-профиль; 1.0% (≈3.7кг) = подиум vs 4-е место на ОИ.
- Vitruve 2024 — Vpeak рывка в конце 2-й тяги: элита 1.68–1.98 м/с; non-elite power clean 1RM 1.35–1.50 peak / 0.95–1.05 mean; velocity-loss пороги для завершения сета.
- Enode/Eleiko — валидированный IMU, bar path из 2 датчиков; Chavda thesis 2024 (MDX): Enode валиден по пиковой скорости и вертикали (r²≈0.99), горизонталь — fixed/proportional bias (коррекция Intercept+Slope), надёжность within/between good–excellent; горизонталь — высокая вариабельность.

**Толчок / сила:**
- Everett / Catalyst Athletics — промахи рывка назад: широкий хват, ранний уход под бар, бёдра вперёд (гиперэкстензия бёдрами вместо плеч за бёдрами), ранний отрыв стоп; лечение: power clean + clean, muscle clean + clean, tall jerk, jerk balance, push press (тайминг dip/drive = как в толчке); Jerk Error Manual: 11 ошибок / 35 причин.
- Bell 2014, jerk dip & drive — подсед НЕ четверть-присед: глубокий dip уводит баланс вперёд («галочка» грифа) + убивает пружину грифа; лечение: back-half push press с пятками на доске.
- Catalyst 2026, jerk dip smooth start — старт без slack (квадры в тонусе, не гиперэкстензия коленей); скорость/глубина индивидуальны (взрывной = мельче/быстрее).
- Science for Sport 2025 (Stone 25+ лет) + Meloq 2025 — IMTP зеркалит 2-ю тягу; профиль peak force + RFD; countermovement инвалидирует тест; 1-с протокол валиден.

**Мобильность:**
- PoinT GO 2026 / NASM / Cook joint-by-joint — OHS 6 сегментов, нормы: голеностоп 35–38°, knee-to-wall ≥12 (cutoff 9, severe 7), таз 120°/IR 35°, торак 40–45°, плечо 180°; heel-elevated retest — быстрейший дифференциал (улучшило = голеностоп, нет = торак/плечо); 73% атлетов NCAA имеют ≥1 компенсацию (Garrison 2019); коррекция 8–10 мин в разминке, +1–2см knee-to-wall / 4 нед, +1–2 сегмента / 6 нед; нет динамики 8 нед = структура → физио.

## 2. Gap-анализ vs эталоны

| Возможность | ББ-хаб | Мастер (LiftMaster) | ТА-хаб сейчас | Вердикт |
|---|---|---|---|---|
| Аудит текущего плана (покрытие фаз/углов) | `auditPlanExercises` + агрегаты | протокол из цикла | нет (хаб план не читает) | ❌ GAP P0 |
| «Худшее в плане → разобрать» | `selectWorstExercise` | — | нет | ❌ GAP P0 |
| Причины слабых (объём/техника/мобильность/VBT/ACWR) | `diagnoseWeakCause` | unified-диагноз | только penalty | ❌ GAP P0 |
| Ранжир коррекций топ-3 (SFR/угол/оборудование) | `rankCorrectionsForWeak` | 5 ассистентов из цикла + 12 BB-изолятов | только corr[0] | ❌ GAP P0 |
| Симуляция Δ «что изменится» | `simulateCorrection` | — | нет | ❌ GAP P0 |
| Спец-блок 4–8 нед | `buildSpecBlock` + dayMap | dayMap + протокол из цикла | только разовая инъекция в нед.1 | ❌ GAP P0 |
| Инъекция во все недели + откат | `injectBBWeakPoints` + `he_bb_plan_saved_prev` | diagnostic/limiter dayMap | нед.1 + нет отката | ❌ GAP P0 |
| Факт-объём 7д + e1RM-тренд 28д по группам | `factVolume` + `volumeHistory28d` + `e1rmTrend28d` | e1RM-подсказки + diaryHint | общий ACWR + фильтр legs/back/shoulders | ⚠️ PARTIAL P0 |
| Замеры/история (McCallum/триада) | `he_bb_measure_history` | антропометрия → профиль | нет | ❌ GAP P1 (ТА: рост/размах/голень) |
| Женские нормы | `femaleSymmetryNotes` | — | нет (Type3/VBT-F в остатках) | ❌ GAP P1 |
| Видео live-углы + гайд | Kinovea reuse + BlazePose preview | `VideoCaptureCard` | stub, движки-сироты не подключены | ❌ GAP P1 |
| Jerk dip метрики | — | — | движок есть, ввода нет | ❌ GAP P1 (дешёвый) |
| VBT-история/EWMA/LVP-график | VBT best/last | VBT best/last/weight | best/last + LVP ramp без графика и истории | ⚠️ PARTIAL P1 |
| FvR-оптимум сравнение | — | — | `optimalFvSlopeForPmax` не показан | ❌ GAP P1 (дешёвый) |
| SRD по фазам | — | — | всегда catch (6см), turnover (4см) не разделён | ❌ GAP P1 (дешёвый) |
| Асимметрия split-jerk (ноги) + динамика | L/R + триада + история | L/R чипы | только L/R макс кг | ⚠️ PARTIAL P2 |
| Attempt selection (соревнования) | — | — | нет (snatchTh ±1.5 не доведён до попыток) | ❌ GAP P2 |
| IMTP/RFD-блок | — | — | только ISPP/IMTP ratio | ❌ GAP P2 |
| Экспорт v2 (biomech/сегменты/коррекции) | HTML+CSV (причины+спец+упражнения) | — | только weakPoints/score | ❌ GAP P2 |
| Печать/ICS | — | — | нет (в остатках) | ❌ GAP P3 |
| Годовой мост | annual-training | annual-training | нет (в остатках) | ❌ GAP P3 |
| Parity-матрица 192 | есть (bb) | есть | ta-injection 192 ✅, хаб — нет | ⚠️ PARTIAL P3 |

## 3. Эпики

### P0 — parity ядра (аудит → причины → ранжир → симуляция → спец-блок → инъекция v2)
- **E1 Аудит плана ТА.** NEW `strength-sport-ta-plan-audit.engine.ts`: `auditTAPlan(plan)` — покрытие 16 фаз (какие фазы уже есть в плане, каких нет), тоннаж/сеты по дням (technique/clean/snatch/strength/pull), дубли. Хаб: секция «Аудит плана» (читает `he_strength_sport_plan` / `he_ss_plan_saved`, как ББ читает `he_bb_plan_saved`) + кнопка «🎯 Худшая фаза плана → разобрать» (parity `selectWorstExercise`). Тесты 6.
- **E2 Причины слабых.** NEW `strength-sport-ta-weak-cause.engine.ts`: `diagnoseTAWeakCause({zone, factSets7d, hist28, e1rmDelta, acwrZone, ohsFailed, vbtLoss, isppRatio})` → cause `volume | technique | mobility | fatigue | strength` + текст (parity `diagnoseWeakCause`, ТА-специфика: mobility через OHS-драйвер фазы, strength через ISPP<85%). Хаб: карточка причины под каждой выбранной фазой. Тесты 8.
- **E3 Ранжир коррекций.** NEW `strength-sport-ta-correction-rank.engine.ts`: `rankCorrectionsForTA(weakPoint, {level, equipment, mobilityRestrictions, cause})` → топ-3 из `WL_WEAKPOINT_CORRECTION` + каталога ТА (`exercise-catalog-ta-supplement`) с фильтром оборудования/мобильности (parity `rankCorrectionsForWeak`, без SFR — у ТА вместо него `intensityPct` + фазовое соответствие). Хаб: карточки топ-3 с кнопками «➕». Тесты 6.
- **E4 Симуляция Δ.** NEW `strength-sport-ta-simulator.engine.ts`: `simulateTAInjection(plan, action)` → Δ сетов/тоннажа/покрытия фаз (parity `simulateCorrection`). Хаб: строка «+3 сета · покрытие 5/11 → 6/11» на карточке коррекции. Тесты 4.
- **E5 Спец-блок 4–8 нед.** NEW `strength-sport-ta-spec-block.engine.ts`: `buildTASpecBlock({weakPoints, level, weeks})` — волна объёма коррекций (нед.1–2 техника 3×5 @65–70%, нед.3–4 объём 4×5, нед.5+ интенсивность), `technique_day` приоритет, dayMap (parity `buildSpecBlock`). Тесты 5.
- **E6 Инъекция v2 + откат.** MOD `strength-sport-ta-injection.engine.ts`: все недели (не только нед.1, deload skip), dayMap все дни, per-week dedup, `targetSets` из спец-блока; снапшот `he_ss_plan_saved_prev` + событие + кнопка «↩ Откат» в хабе (parity `handleInjectToPlan/handleRollbackInject`). Тесты: расширить `ta-injection` до all-weeks + rollback (4).
- DoD P0: хаб показывает «план → аудит → причины → топ-3 → Δ → спец-блок → инъекция → откат», как ББ; vitest +33, tsc 0.

### P1 — измерения и видео (подключить сирот + live)
- **E7 Дешёвые подключения (1 файл хаба, 0 новых движков).** Ввод dip (см/мс) → `diagnoseJerkDip` + drivePower; `isRealChange(xLoop, turnover|catch)` раздельно (turnover SRD 4, catch 6); `optimalFvSlopeForPmax` vs фактический slope («профиль force-доминантен — приоритет скорость»); `vbtEwma` + `loadBarTracking` мини-тренд (последние 10 замеров); `extractBfPCAPatterns` бейджи P1/P3 (Kipp +0.42/−0.38). Тесты 5.
- **E8 Pose live.** MOD `strength-sport-pose.engine.ts` + хаб: file-drop видео (паттерн `VideoCaptureCard` мастера — reuse, не копия) → покадровые hip/knee/ankle/shoulder → `autoValidateAnglesFromPose` галочки «угол ✅/вне диапазона → cue» + `autoOHSFromPose` предзаполнение OHS. Без железа loadsol (нет в наличии — честный stub остаётся). Тесты 4.
- **E9 Антропометрия ТА.** Поля рост/размах/голень → профиль (`he_profile_v2.personal`, parity мастер) → стартовый угол + ширина хвата (Everett: широкий хват = риск промаха назад; узкий = стабильность). Тесты 3.
- **E10 Женские нормы.** Type3 = норма для женщин (Hiskia 53%, без penalty), VBT-бенчмарки F (рывок 1.5–1.8, взятие 1.3–1.6), `TA_VTHRES_NORMS` split M/F. Тесты 3.
- DoD P1: все движки-сироты §0 вызываются из хаба; vitest +15, tsc 0.

### P2 — соревнования и сила (мосты наружу)
- **E11 Split-jerk асимметрия.** Ввод передняя/задняя нога L/R + динамика (история `he_ta_asymmetry_hist`); пороги 7/12% те же (Bezkorovainyi). Тесты 3.
- **E12 Attempt selection.** `snatchTh ±1.5кг` → попытки 90/96/102% + readiness-флаг (просадка пика >0.15 м/с на стандарте → −2.5кг к заявке, PoinT GO) → мост в `strength-sport-contest-simulator` (существует). Тесты 3.
- **E13 IMTP/RFD-блок.** Ввод peak force + RFD (или 1-с протокол, Meloq) + countermovement-guard («dip перед тягой — тест невалиден», Science for Sport) → профиль «сила vs взрыв» → причина strength. Тесты 4.
- **E14 Экспорт v2.** HTML: фазы + biomech (углы/мышцы/refs) + OHS-сегменты + коррекции + инъекция notes + FvR; CSV те же поля; parity ББ-экспорта. Тесты 3.
- DoD P2: vitest +13, tsc 0.

### P3 — polish
- **E15 Печать/ICS** из хаба (остаток TA-PRO-PLAN, parity годовой панели `buildMacroIcs`). Тесты 2.
- **E16 Годовой мост ТА** → `annual-training` гибрид bb+TA (остаток TA-PRO-PLAN). Тесты 3.
- **E17 Parity-матрица хаба 192** (modes×levels×goals×days без throw, parity `ta-injection 192` + `strength-sport-matrix 192`). Тесты 1 (матричный).
- DoD P3: vitest +6, tsc 0, `vite build` OK.

## 4. Порядок и оценка

1. P0 E1→E2→E3→E4→E5→E6 (ядро, каждый эпик независимо тестируется; E6 последним — меняет план).
2. P1 E7→E10→E9→E8 (дешёвое → дорогое; E8 live-видео самое рискованное — оставить на конец P1).
3. P2 E14→E11→E13→E12 (экспорт разблокирует проверку тренером; attempt selection после IMTP).
4. P3 E17→E15→E16.

Оценка: P0 ~6 эпиков (≈33 теста), P1 ~4 (≈15), P2 ~4 (≈13), P3 ~3 (≈6). Итого ≈67 новых тестов к текущим 421+.

## 5. Правила (из AGENTS.md, учтены)

- Только edit-инструмент для контента; commit строго pathspec (чужие strength-sport/pro/lms/docs-файлы не трогать).
- Reuse, не копии: `VideoCaptureCard`-паттерн, `filterByMobility`, `phaseForReps`, диагностика дневника — импортом.
- `LMS_CYCLES`-аналог: стор ТА-плана не мутировать — инъекция возвращает копию.
- Диагностика dump-тестами через `__tests__/_tmp_*.test.ts` с удалением до коммита.
- Dumps: `npx vitest run strength-sport` после каждого эпика; полный прогон перед P3.

## 6. Что НЕ делаем (осознанно)

- loadsol/force-plate драйвер — железа нет, stub честно остаётся.
- Своя видеотрекинг-модель — только Kinovea/CSV + BlazePose CDN, как сейчас.
- Перестройка ядра билдера/периодизации ТА — только инъекция поверх.
- SFR для ТА-упражнений — нет данных; вместо него `intensityPct` + фазовое соответствие.
- Дублирование BB-движков (weak-cause/rank/simulator/spec) — новые ТА-файлы reuse-паттерн, не копия.

## 7. V3-круг (продолжение, ✅ ВЫПОЛНЕН)

Сертификация V2 полным прогоном: **9697 passed / 61 failed — все падения чужие**
(21 bb-файл + bb-macrocycle + MesocycleProgressionCard + ресурсный флейк rest-hooks, изолированно 60/60).
Доказательство непричастности: `src/engines/bb` не импортирует strength-sport вообще;
падающие bb-сюиты недавно менялись BB-агентами (stimulus-target rounds, BB-авто остатки).

- **V3-A прогресс двоеборья + Sinclair** (`strength-sport-ta-progress.engine.ts`):
  IWF 2021–2024 (M A=0.722762521 B=193.609; F A=0.787004341 B=153.757, официальный PDF;
  найдена и задокументирована опечатка PDF 67.8/67.9 — формула сверена мужским примером 81/305→387.07 ✓).
  История замеров (кап 60) + тренд (сумма/вес/Sinclair/лучший). Тесты 7/7.
- **V3-B хаб**: блок «📈 Прогресс + Sinclair» в Summary (вес из профиля, пол M/F, снимок, тренд)
  + «📡 Проверить MediaPipe» в видео (честный live-check наличия модели, без фейковых углов). Тесты 2.
- Проверено: strength-sport + hub зелёные, **tsc 0 по всему проекту**, коммит pathspec, push.

## 8. V4-круг «честная полнота» (✅ ВЫПОЛНЕН)

Добивка мест, где хаб обещал больше, чем делал:
- **V4-A история трекинга**: `saveBarTracking` при парсе Kinovea (раньше только `load` — тренд был мёртв)
  + `trackNonce` (одинаковый CSV даёт те же метрики — memo иначе не обновляется). Тест: 2 парса → «История трекинга (2)».
- **V4-B экспорт замкнут**: ноты последней инъекции + Sinclair прогресса в HTML/CSV.
- **V4-C наглядность**: coverage-strip 11 фаз в аудите, LVP-sparkline SVG, история OHS (снимки + тренд),
  кнопка «🖨 Печать» сводки (честный фолбэк при блокировке popup).
- Проверено: область **608/608 (42 файла)**, tsc 0, коммит pathspec, push.

## 9. V5-круг (✅ ВЫПОЛНЕН)

- **V5-A bridge замкнут**: попытки (`taAttempts`) и Sinclair (`taSinclair`) едут в `applyToPlanner`-пейлоад
  (конструктор игнорирует неизвестные поля — safe, задел владельцу). Тест по `he_planner_apply`.
- **V5-B стартовая неделя синка**: ввод «с нед N» в спец-блоке (кламп 1–52) → overlay и синк с N-й недели.
- **V5-C гигиена**: дублирующие импорты модуля (biomechanics/vbt/video ×2–3) сведены к одному на модуль.
- Проверено: hub **31/31**, область зелёная, **tsc 0 по всему проекту**, коммит pathspec, push.
