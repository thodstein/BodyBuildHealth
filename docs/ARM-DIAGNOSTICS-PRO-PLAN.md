# Арм-диагностика PRO — план доведения до уровня ББ-хаба и Мастера 9 лифтов

Статус: **ВЫПОЛНЕН 100% + D-ДОТОЧКА + R1 (bridge-payload обогащён · bilateral из landmarks · график RT · attKg-persist)**. Остаток: полный прогон для протокола (10122/10188, 66 чужих) + вне скоупа §5 (железо/Hands/годовой/ICS/red-flags). База: `docs/ARM-DIAGNOSTICS-EXERCISES-PLAN.md` (IMPLEMENTED: 12 точек `ARM_BIOMECH`, `ARM_CORRECTIONS`, `scoreArm` RSS, `injectArmCorrections`, хаб 5 табов `ArmDiagnosticsHub.tsx`).
Цель — parity с `BBDiagnosticsHub` (7 табов: weak/symmetry/exercise/stimulus/volume/recovery/mobility + причины + топ-3 + симуляция + спец-блок + инъекция во все недели + откат + HTML/CSV) и Мастером движений PL (9 лифтов: фазы по углам + `phaseForReps` + bar-path 5 отклонений + VBT loss→фаза + e1RM-тренд 28д + асимметрия + MRV-бюджет + персистентность + мост в неделю-1).
Ядро арм-билдера/периодизации — НЕ трогаем, только reuse + инъекция.

Область: `src/engines/arm/*` + `src/ui/screens/TrainingScreen_parts/ArmDiagnosticsHub.tsx`. Чужие bb/cardio/nutrition/TA-файлы не трогаем. Коммиты строго pathspec.

## 0. Что уже есть (не дублировать)

- 12 мёртвых точек `arm-biomechanics.engine.ts:32` (`cup_start/hold`, `rising_top`, `pron_open/lock`, `sup_cup/drag`, `side_mid/pin`, `back_start/drag`, `contain_fingers`) → `angleRangeDeg` + `keyJoint` + `weakMuscles` + `biomechanicalReason` + `corrections` + `loadCues` + `intensityPct` + `references` + `workingDirection`/`elbowDeg` + `angleJoint`/`vbtThresholdForWeakPoint`/`phaseForArmAngle`/`autoValidateArmAngles`.
- Оркестратор `arm-diagnostics-hub.engine.ts:226` (`diagnoseArmWeakDetailed` + `estimateForceVector` + `diagnoseVbt` + `tableRatio` + `tendonSets` + `asymmetry` + `checkHumerusGuard`/`checkWristBalance` + biomechCards + corrections + scoring-оверлей).
- Скоринг `arm-scoring.engine.ts:130` RSS √Σpen² (weak12/asym14-28/humerus10-18/tendon10-20/grip8) + floors (asym≥12/side>9/tendon>22 → cap 49) + verification video0.35+VBT0.35+history0.30.
- Инъекция `arm-diagnostics-injection.engine.ts:207` (1 упражнение/точка, dayTags, per-day dedup, budget 60/85/110/135, humerus-cap, tendon hard-cap 26, session-cap 8, `comment`/`rationale`).
- Хаб 5 табов: Grip (RT/Axle/Pinch + ForceVector + VBT-ручник + бенчмарки) / Wrist (слайдеры elbow/forearm/wrist + `estimateArmAngles`/`validateArmAngles` + Hands live + `phaseForArmAngle` авто-хинт + 12 чипов + биомех-карточки) / Pressure (side/back кг + humerus-preview + table 3/2/1) / Strength (4 теста Bezkorovainyi finger/hammer/hook/cup → Fmax/Frel/Ft/F100/F500/t05F/gradient + асимметрия + бенч-автоуровень + история 12нед + F/t→точки) / Recovery (ACWR факт + tendon-ACWR + tendon-load + fatigue).
- Движки-сироты (написаны, но хаб их НЕ вызывает полностью): `arm-video-analysis` (parse/metric/classify/SRD — UI не показывает xLoop/yMax/vMax/тип), `arm-diary-autoreg.autoregArmFromDiary` (хаб не показывает volumeMult/RIR+/замены), `arm-platform` (WR-таблица RT 130.5/77.2 — хаб показывает только refs строкой), `checkUCLGuard`/`checkShoulderGuard`/`checkTendonGuard` (хаб зовёт только 2 из 5), `bilateral.planBilateralVolume` (хаб считает % вручную, без weak/strong sets), `vbtForExercise` vs `vbtThresholdForWeakPoint` (два источника порогов, не сведены).
- Тесты: `arm-diagnostics-hub.test.tsx:144` (14 UI), `arm-diagnostics-hub.test.ts`, `arm-diagnostics-detailed.test.ts`, `arm-diagnostics-injection.test.ts` — зелёные.

## 1. Интернет-источники (проверены Sep 2026)

**Техника / цепь / мёртвые точки:**
- Mithril 2026 (cupping/pronation/rising — раздельно + комбо, load path через intended movement, статика в позиции срыва + динамика в комфорте) — обоснование `cup_start vs cup_hold`, `pron_open vs pron_lock`.
- StrengthLog Abelsson 2025 (power chain fingers→wrist→rotation→elbow→shoulder→core; table ≥50%; 3–4 specific drills перед general lifts) — обоснование tableRatio 50% + `isTableExercise`.
- GoldenGrip 2025 (15 best exercises; humerus spiral при side slowly; tight-arm vs open-arm lanes) — обоснование `side_mid 60% gated` + tight/open углы.
- Ezreal 2026 side-pressure guide (система, а не мышца: hand+back сначала, 2 expos/week, isometrics 10–20с, tight сильнее но open чаще проигрывает, sparring снижает accessories) — обоснование волн side + table-бюджета.
- Grokipedia (EMG pronator teres/pec major в hook; torque = force×lever; low-hand vs high-hand; 12-нед targeted forearm/wrist → performance; medial epicondylitis от torsional stress) — обоснование pron/sup баланса 1.5× + high-hand rising.
- Scribd pie-chart (cup/back/pron ≈80% результата; Devon vs Jerry стили) — обоснование приоритетов hook/toproll/press.

**Травмы / безопасность:**
- GoldenGrip 2025 broken-arm (spiral distal humerus 9/10; torsion + bending/valgus + compression; elbow-in, eyes-on-hand, torso square; warmup rice-bucket/band/iso + 30% ready-go) — обоснование humerus-guard + warmup-чек.
- Cureus 2023 / PMC 9592113 / SciDirect 2666639122000670 (spiral fracture bending+axial+torsion; 60 MPa на 115мм выше локтя posteromedial; Holstein-Lewis + radial nerve 22%) — обоснование side-капов 6/9 + прогрессии ≤10%/нед + RIR≥2.
- Gripzilla 2025 (essential-kit векторы; wrist/hammer/towel/gripper stability; bilateral balance) — обоснование containment + bilateral.
- JCDR 2025 case series (surgical vs conservative, union + full ROM) — дисклеймер «скрининг, не диагноз», red-flags → врач.

**Сила / измерения:**
- Bezkorovainyi 2023 ARM1 FB5k (4 теста finger/hammer/hook/cup; F/t, F100, F500, F500/t500, t05F, gradient; асимметрия квалиф 7.16% / элита 12.47%) — уже закодировано в `arm-dynamic-force`, пороги 7/12 — канон.
- IronMind (RT WR M130.5 Tyukalov 2013 / F77.2 Gaiduchenko 2012; Axle Saxon ~133; CoC Trainer100/No1-140/No1.5-167.5/No2-195/No2.5-237) — уже в force-capture/benchmarks, но без %WR-гейджа.
- GripStrength 12-нед (wrist curl lb 0/25/45/70/95; pron hold 0/10/25/45/65с; cup hold 0/15/30/50/70с; 3с эксцентрик F1; tendonCap 1.2× vs muscle 1.7×) — уже в benchmarks/landmarks, но без фазового плана.
- WAF 2025 Rules (категории Senior M11/F8, Master/GM/SGM/SSGM, Junior/Youth23, Para; L/R отдельные зачёты; весогонка M0.5/F0.4 %/нед) — уже в `arm-waf`, но хаб показывает только класс строкой.

## 2. Gap-анализ vs эталоны

| Возможность | ББ-хаб | Мастер PL (9 лифтов) | Арм-хаб сейчас | Вердикт |
|---|---|---|---|---|
| Аудит текущего плана (покрытие точек/фаз) | `auditPlanExercises` + агрегаты | протокол из цикла | хаб план не читает (`he_arm_last_plan` только для tendon-оценки) | ❌ GAP P0 |
| «Худшее в плане → разобрать» | `selectWorstExercise` | — | нет | ❌ GAP P0 |
| Причины слабых (объём/техника/мобильность/усталость/сила) | `diagnoseWeakCause` | unified-диагноз | только penalty без причины | ❌ GAP P0 |
| Ранжир коррекций топ-3 (оборудование/мобильность/асимметрия) | `rankCorrectionsForWeak` | 5 ассистентов из цикла | только corr[0] списком | ❌ GAP P0 |
| Симуляция Δ «что изменится» | `simulateCorrection` | — | нет | ❌ GAP P0 |
| Спец-блок 4–8 нед + dayMap | `buildSpecBlock` | dayMap + протокол | только разовая инъекция в нед.1 | ❌ GAP P0 |
| Инъекция во все недели + откат | `injectBBWeakPoints` + `he_bb_plan_saved_prev` | diagnostic dayMap | нед.1 + нет отката | ❌ GAP P0 |
| Факт-объём 7д + e1RM-тренд 28д по мышцам | `factVolume` + `volumeHistory28d` + `e1rmTrend28d` | e1RM-подсказки + diaryHint + weak-detection | только force-trials история, дневник тренировок не читает | ❌ GAP P0 |
| Видео-метрики (xLoop/yMax/vMax + тип + SRD) | Kinovea reuse + preview | `VideoCaptureCard` | движок есть, UI не показывает | ❌ GAP P1 |
| VBT-зоны + loss→фаза + e1RM по скорости | VBT best/last | `diagnoseVelocity` + коррекции фазы + в план | 2-точечный ручник, exerciseId не пробрасывается, пороги двойные | ⚠️ PARTIAL P1 |
| Мобильность (тест + нормы + retest → профиль) | OHS6 + knee-to-wall + heel-retest → `mobilityRestrictions` | чипы асимметрии + VBT-ввод | нет теста, `applyMobilityToProfile` нет | ❌ GAP P1 |
| Per-muscle ACWR + авторегуляция из дневника | per-muscle ACWR + unified | ACWR + autodeload | глобальный факт без зон; `autoregArmFromDiary` не вызывается | ⚠️ PARTIAL P1 |
| Bilateral L/R план (weak/strong sets, MRV-кап) | унилатеральный приоритет | L/R чипы | % считается, sets-плана нет | ⚠️ PARTIAL P1 |
| Grip %WR + attempts + история | — | — | refs строкой, `arm-platform` не вызван | ❌ GAP P2 |
| UCL/shoulder/tendon гварды (5 шт) | joint-guard | MRV-бюджет + notes | вызываются 2 из 5 | ❌ GAP P1 (дешёвый) |
| Экспорт (biomech/углы/коррекции/инъекция) | HTML+CSV | — | нет (только bridge) | ❌ GAP P2 |
| Женские/весовые нормы | `femaleSymmetryNotes` | — | sex только в force (RT 77.2), side-ref линейный | ⚠️ PARTIAL P2 |
| Персистентность + валидация + снапшоты | v1 + measure-history | `he_pl_diagnostic_card_v1` | v4 без валидации формы, снапшотов нет | ❌ GAP P2 |
| Критический гейтинг (score≤49 стоп) | score + floors | лимитер | scoring-оверлей только показ, гейта инъекции нет | ❌ GAP P2 |
| Parity-матрица | есть (bb) | есть | arm-injection property 32 combos ✅, хаб-матрицы нет | ⚠️ PARTIAL P3 |

## 3. Эпики

### P0 — parity ядра (аудит → причины → ранжир → симуляция → спец-блок → инъекция v2 + дневник)
- **E1 Аудит плана.** NEW `src/engines/arm/arm-plan-audit.engine.ts`: `auditArmPlan(plan)` — покрытие 12 точек (какие точки уже есть в плане, каких нет), table/gym сплит, static/dynamic сплит, дубли; `worstArmPoint(plan, weakPoints)` — parity `selectWorstExercise`. Хаб: секция «Аудит плана» (читает `he_arm_last_plan` / `he_arm_plan_saved`, как ББ читает `he_bb_plan_saved`) + кнопка «🎯 Худшую точку плана → разобрать». Тесты 6.
- **E2 Причины слабых.** NEW `src/engines/arm/arm-weak-cause.engine.ts`: `diagnoseArmWeakCause({point, factSets7d, hist28, e1rmDelta, acwrZone, mobilityFail, vbtLoss, benchLevel, sleepHours})` → cause `volume | technique | mobility | fatigue | strength` + текст (parity `diagnoseWeakCause`; арм-специфика: mobility через E10-тест фазы, strength через ISPP-аналог = side/back vs bw-ref, fatigue через tendon-ACWR). Хаб: карточка причины под каждой выбранной точкой. Тесты 8.
- **E3 Ранжир коррекций.** NEW `src/engines/arm/arm-correction-rank.engine.ts`: `rankCorrectionsForArm(point, {level, equipment, mobilityRestrictions, cause, asymPct})` → топ-3 из `ARM_CORRECTIONS` + каталога (`exercise-catalog-arm`, фильтр оборудования/мобильности; при asym≥7 — унилатеральный приоритет слабой). Parity `rankCorrectionsForWeak` (без SFR — вместо него `intensityPct` + table/static соответствие). Хаб: карточки топ-3 с кнопками «➕». Тесты 6.
- **E4 Симуляция Δ.** NEW `src/engines/arm/arm-simulator.engine.ts`: `simulateArmInjection(plan, action)` → Δ сетов/покрытия точек (parity `simulateCorrection`). Хаб: строка «+3 сета · покрытие 5/12 → 6/12» на карточке коррекции. Тесты 4.
- **E5 Спец-блок 4–8 нед.** NEW `src/engines/arm/arm-spec-block.engine.ts`: `buildArmSpecBlock({weakPoints, level, weeks, technique})` — волна (нед.1–2 техника 3×8-12 @60-65%, нед.3–4 объём, нед.5+ интенсивность @70%), `dayMap` по `ARM_CORRECTIONS.dayTags`, table-периодизация 3/2/1 внутрь (parity `buildSpecBlock` + `tableWeekKind`). Тесты 5.
- **E6 Инъекция v2 + откат.** MOD `arm-diagnostics-injection.engine.ts`: все недели (не только нед.1, deload-skip), dayMap все дни, per-week dedup, `targetSets` из спец-блока; снапшот `he_arm_plan_saved_prev` + событие + кнопка «↩ Откат» в хабе (parity `handleInjectToPlan/handleRollbackInject` ББ). Тесты: расширить до all-weeks + rollback (4).
- **E7 Дневник → слабые (дешёвый parity мастера).** NEW `src/engines/arm/arm-diary-weak-detection.engine.ts`: `volumeHistory28d` + `e1rmTrend28d` по арм-мышцам из `he_workout_log_v1`/`he_training_log` (parity BB/PL `detectWeakMusclesByE1rm`: −5% → weak, ≤+1% при ≥2 сессиях → plateau) → авто-подсказка «дневник: pronators −8% → pron_open». Хаб: блок «📊 Дневник: e1RM-тренд» + кнопка «➕ в слабые» (подсказка, не авто-выбор — как у PL). Тесты 6.
- DoD P0: хаб показывает «план → аудит → причины → топ-3 → Δ → спец-блок → инъекция → откат → дневник», vitest +39, tsc 0.

### P1 — измерения и безопасность (подключить сирот, 1 файл хаба где возможно)
- **E8 Видео PRO (подключение сироты).** MOD хаб + `arm-video-analysis.engine.ts`: показать xLoop/yMax/vMax + тип (`inside_hook/outside_toproll/straight_press`) + SRD-бейдж (`isArmRealChange`, SRD 4) + textarea/file Kinovea-CSV (паттерн мастера `VideoCaptureCard` — reuse идеи, не копия) + file-drop landmarks (уже есть) в одну «Видео»-секцию таба Wrist. Тесты 4.
- **E9 VBT PRO (свести пороги).** MOD `arm-vbt-capture.engine.ts`: `vbtForExercise` делегирует в `vbtThresholdForWeakPoint` по точке (убрать двойной источник: cup/rising 12/20, pron/sup 15/25, side 10/20, back 15/25, grip 15/25); пробросить `exerciseId` из хаба (сейчас всегда `wrist_curl_belt`); loss→точка хинт + e1RM по скорости (parity PL `diagnoseVelocity`); показать warn/stop бейдж на биомех-карточке (уже есть текстом — сделать цветом). Тесты 4.
- **E10 Мобильность (parity OHS).** NEW `src/engines/arm/arm-mobility.engine.ts`: 5 чеков (wrist flex ≥80° / ext ≥70° / pron ≥80° / sup ≥80° / elbow ext полный) + нормы + retest (reverse-grip retest — аналог heel-raise) + `applyArmMobilityToProfile` → `he_profile_v2.health+training.mobilityRestrictions` → фильтр ранжира (parity WL `applyMobilityToProfile`). Хаб: таб Recovery += «Мобильность» секция. Тесты 5.
- **E11 ACWR per-muscle + авторегуляция (подключение сирот).** MOD хаб: `computePerMuscleACWR`-фильтр по арм-мышцам (как сейчас tendon-фильтр, но на все 12 мышц + зоны caution/danger + совет «−10%/−25%», parity BB/PL); вызвать `autoregArmFromDiary` из sRPE/дней боли и показать `volumeMult/RIR+/Side→iso/Pron→pulses/+дни` превью + кнопку «применить в конструктор» (данные уже есть в payload — показать явно). Подключить `checkUCLGuard/checkShoulderGuard/checkTendonGuard` к превью (сейчас 2/5). Тесты 5.
- **E12 Bilateral-план (подключение сироты).** MOD хаб Strength: вызвать `planBilateralVolume({leftKg, rightKg, baseSets, mrvSets})` → показать weak/strong sets + withinMrv + note; L/R-ввод расширить на 4 теста (не только hook-дубли), история `he_arm_asymmetry_hist` (parity TA E11). Тесты 3.
- DoD P1: сирот не осталось (все движки §0 вызываются), vitest +21, tsc 0.

### P2 — соревнования, сила хвата и экспорт
- **E13 Grip %WR + attempts (подключение сироты).** MOD хаб Grip: вызвать `arm-platform.engine` (WR M130.5/F77.2, попытки 90/96/102%, %WR-скоринг) → гейдж «RT 68кг = 52% WR» + история trials-графика (уже есть avg/max/min — добавить %WR-линию). Тесты 3.
- **E14 Экспорт v2.** NEW `src/engines/arm/arm-diagnostics-export.engine.ts`: HTML (точки + biomech углы/мышцы/references + коррекции + инъекция notes + F/t + ACWR) + CSV те же поля; XSS-esc; кнопки «🖨 HTML / 📥 CSV» (parity `bb-diagnostics-export`). Тесты 3.
- **E15 Нормы пол/вес + валидация.** MOD хаб: female side-ref (0.55×→0.65× уже есть — добавить female-кап и UCL-предупреждение новичкам hook≤3нед уже в guard — показать в UI); `wafWeightClassFor` чип уже есть — добавить весогонку M0.5/F0.4 %/нед хинт (parity `arm-competition-prep`); персистентность: валидация формы v4→v5 (битые → дефолт, как PL `he_pl_diagnostic_card_v1`), снапшоты замеров RT/side/back (`he_arm_measure_history`, parity `he_bb_measure_history`). Тесты 4.
- **E16 Критический гейтинг.** MOD `arm-diagnostics-hub.engine.ts` + хаб: при score≤49 (floors: asym≥12/side>9/tendon>22) — инъекция side gated (только iso/ремень, как TA critical-gating), бейдж «🔴 критично — сначала техника/мобильность» (parity TA). Тесты 2.
- DoD P2: vitest +12, tsc 0.

### P3 — polish и матрица
- **E17 Parity-матрица + доки.** NEW `arm-diagnostics-parity.test.ts`: 12 точек × 3 техники × 4 уровня = 144 комбинации: weak→biomech→corrections→inject (injected ≥1 или честный skip с note), humerus-guard никогда не пропускает side>9 в нед.1–4, scoring floors кап 49. Печать/ICS и годовой мост — осознанно НЕ делаем (нет годового арм-плана как у TA/BB; ICS у BB тоже нет). DoD: матрица зелёная, доки (этот файл) помечены выполненными эпиками.
- DoD P3: vitest +1 файл, tsc 0, коммит строго pathspec `src/engines/arm/*` + `ArmDiagnosticsHub.tsx` + тесты.

## 4. Порядок и оценка

P0 (ядро parity) → P1 (сироты+безопасность) → P2 (экспорт+гейтинг) → P3 (матрица). Каждый эпик — отдельный коммит pathspec, тесты рядом с движком (`src/engines/arm/__tests__/arm-<name>.test.ts`), UI-тесты в `__tests__/arm-diagnostics-hub.test.tsx`.
Суммарно ≈ +73 теста к текущим (~308 arm-область → ~380). tsc 0 по своим файлам; чужие bb/cardio/nutrition/TA не трогаем.

## 5. Что осознанно НЕ делаем

- Железо ARM1 FB5k / loadsol / динамометр — нет в наличии; F/t ввод ручной (кг+мс) остаётся, как VBT-ручник у PL.
- MediaPipe Hands live остаётся best-effort (CDN, офлайн-APK fallback ползунки уже есть) — полноценный Pose-трекинг как у TA (BlazePose-углы hip/knee/ankle) для армстола не нужен: достаточно кисть/предплечье/локоть.
- Годовой мост / ICS-календарь — нет годового арм-плана; table 3/2/1-превью уже есть.
- Диагнозы/рентген/red-flags — только скрининг + «к врачу» (Cureus/JCDR дисклеймер в экспорте).
