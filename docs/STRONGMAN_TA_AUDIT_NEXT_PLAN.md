# Стронгмен + ТА — аудит существующего конструктора и план PRO Next (Sep 02 2026)

**Область:** `src/engines/strength-sport/*` (47 файлов) + `src/ui/screens/strength-sport/StrengthSportConstructor.tsx` (1200с) + `src/ui/screens/TrainingScreen_parts/WLDiagnosticsHub.tsx` (650с) + `StrongmanDiagnosticsHub.tsx` (720с) + `src/engines/outside-load.engine.ts` · **Статус:** аудит завершён, план на 4 этапа (P0-P3), интернет-проверка 2024-2026

## 1. Что есть сейчас (факт, не домыслы)

**Один конструктор, 3 режима — изоляция от BB/LMS:** `strength-sport.types.ts:7` `mode weightlifting|strongman|hybrid`, `goal 5`, `level 4`, `weeks 2-16`, `days 2-6`, `workMax 19 ключей` (yokeWalk/farmersWalk/atlasStone/axleDeadlift/circusDbPress отдельно, не фоллбэк через deadlift), `StrengthSportSet.distanceM/timeCapS` — carry-метрика, `SS_TAG_MUSCLES` 10 тегов.

**Движок 47 файлов:**
- **Сплиты** `strength-sport-split-patterns.ts:14` 11 паттернов: `wl_3/4/5/6`, `sm_2/3/4`, `hyb_3/4`, `wl_rolling_3_1`, `sm_rolling_3_1` (4д ротация `d%rotationDays`). Level-gates `wl_6 enhanced only`.
- **Отбор** `strength-sport-selection.ts:7` `SS_ANGLE_CLASSES` 10 тегов ×3-4 класса, `SS_STRICT_GROUPS` 12 (snatch_full 6, carry_heavy 8, stone 12…), `filterByTier` beginner без `snatch/clean_and_jerk/deficit_*` без allowExotic, `filterByInjury` только при `hasExclude`, `selectDiverse` 1/класс + lengthenedBonus.
- **Нагрузка** `strength-sport-loading.ts:14` `PCT_BY_PHASE` WL `acc0.75/intens0.82/integ0.85/peaking0.88` vs generic `0.92`, Prilepin `optimalRepsForPct` WL `<70 3-6 / <80 2-4 / <90 1-3 / ≥90 1-2`, `tempoForSS` `X-0-X-0` для oly/pull, `yoke brace 2с — walk`, deload `3-1-1-0`, `restForSS` carry `480/360с` primary ≥90%.
- **Прогрессия** `strength-sport-progression.ts:13` `pmForWeek = pm0*min((1+k)^(w-1),cap)*0.97outside` , `caps 1.25/1.35/1.5`, `intensityK` technique0.002/peaking0.008/PED heavy0.012, **per-lift K** `snatch0.45/clean0.55/squat1.0/dead0.90/log0.70/yoke0.55/atlas0.60/carDead0.88`, `rirForWeek` oly `acc3/peaking1/deload4`, `buildPhaseDistribution` Torokhtiy `3/3/3/1 ≥10w`, Strongman **5-фаз** `GPP25/Str25/Integ20/Peak15/Taper15` ≥12w (Grinder Gym + Winwood 8.6д), `phaseForDate` taper 8-9д перед `competitionDate`.
- **Объём/Budget** `strength-sport-volume.ts:14` `WL_LANDMARKS` snatch `15/30/45 → 30/60/95`, Strong carry `80/180/360 → 150/310/520м`, `computeBudget = 60/85/110/135 × ped1.0-1.7 × lab × nut × rec` (P1.1 parity BB).
- **Pool** `strength-sport-builder.engine.ts:33` `POOL_BY_TAG` 11 тегов 35 PRO ивентов (`conanWheel/shield/duck/truck/arm/viking/atlas_over/natural/stone/keg_over`), `STRONG_FALLBACK` BFS `yoke→farmers→deadlift` с coeff `yoke0.73/stone0.66`, `gentleFactor 0.6-0.7` (knee/back/shoulder/wrist), `contest medley 2+1` (2 carries + stone) + `height/turn/timeCap` per-set + Winwood precise `daysOut vs TAPER_CESSATION_DAYS` (yoke/stone/dead 7д, log/farmers 5д, tire4, sled3) → `vol0.45 int0.50` если cessated.
- **VBT** `strength-sport-vbt.engine.ts:22` 9 LVP `snatch peak1.30@100→2.70@50`, `clean 1.30→2.30`, `squat0.30→1.00`, `yoke0.90→1.90`, `farmers1.00→2.00`, `stone0.35→0.95`, **PLOS 2026 Wood** 7 derivatives `TA_PEAK_VELOCITY_ZONES` `snatch absolute 1.30-1.75`, `TA_VTHRES_NORMS 1.70-2.00 → FvR2 Sandau` `F=m*g+m*v²/2h → Pmax → snatchTh ±1.5кг`, `thresholdForTALift pull15/snatch10`, `VBT_SS_THRESHOLDS` `yoke1.30/1.00 walk`.
- **Биомеханика** `strength-sport-biomechanics.engine.ts:36` `TA_BIOMECH 16` `angleRangeDeg [0,20]/[60,90]/[0,180]` + keyJoint + weakMuscles×3 + reason Gourgoulis129-140°/Garhammer/Ang2023 6 фаз + corrections. `strength-sport-sm-biomechanics.engine.ts:51` `SM_BIOMECH 16` (log 4+carry6+stone3+grip/core/cond) McGill max yoke 3-4×BW / Harris stone > deadlift / Legg stride -0.32.
- **BarPath** `strength-sport-barpath.engine.ts:14` Vorobyev 3 типа (cross-count + allNonNegative), `computeBarPathMetrics 12Hz MA3`, `ENODE_CORRECTION_TABLE intercept-0.45/slope1.08 r²0.82, yT-0.014/1.0 r²0.99` Chavda 2024, `diagnoseBarPathFromMetrics SRD 4см turnover/6см catch` Frontiers 2023, `correctEnodeHorizontal`, `extractBfPCAPatterns 0.42`.
- **Диагностика** `strength-sport-diagnostics.ts:7` `diagnoseBarPath→WLWeakPoint`, `strength-sport-scoring.engine.ts:44` `scoreTA RSS √(Σpen²) weak12/asym14-28/bar10-18/vbt10-20/mob8/imtp15 verification 0.35video+0.35vbt+0.30mob floor≤49` (asym≥12/vbt≥20/ISPP<85), `strength-sport-sm-scoring.engine.ts:44` `scoreSM` weak12/sway10-18/grip12/axial15/cond10 verification 0.30/0.30/0.20/0.20.
- **OHS/Video/Pose** `strength-sport-ohs.engine.ts:14` 6 сегментов FMS/Rabin/PoinT GO `kneeToWall12/9 ankle35-38 hip120 IR35`, heel2.5см retest, `strength-sport-video.engine.ts:14` `parseKinoveaCSV` 30fps MA3 + `ForceProvider/PoseProvider`, `strength-sport-pose.engine.ts:14` `estimateAnglesFromLandmarks law-of-cos + ensurePoseModel CDN mediapipe/pose@0.5 + mock`.
- **Taper/Conditioning** `strength-sport-taper.engine.ts:14` `TAPER_CESSATION_DAYS` + `WINWOOD_TAPER 0.45/0.50 none + 0.55/0.75 reduced`, `strength-sport-conditioning.ts:14` `alactic 8×10/50 (1:5) / lactic 5×60/90 / aerobic Zone2 30`.
- **WeightCut/PED/DUP** `strength-sport-weight-cut.engine.ts:14` ISSN light `carb stable 4-5г, fiber10⨉4д, water load_cut gated confirmed`, `strength-sport-ped-adaptation.ts:14` dose-aware `AAS 300/700/1500/3000 curve1.0→1.7 cap1.70 weightCut1.35 tEq tren2.5`, `strength-sport-dup.ts:14` heavy_light/wave/conjugate max90/dynamic70 X-0-X-0, `strength-sport-intensity.ts:14` cluster 3×1×20с.
- **Годовой** `strength-sport-annual.ts:22` `he_strength_annual_v1` `AnnualSS blocks` `buildAnnualFromSS + buildAnnualWithTaper + buildAnnualMultiPeak GPP4w+trans2w + plan dedup`, `validateAnnualSSPhases 3×peaking warn + taper 1-2нед`, `strength-sport-annual-bridge.ts:14` `syncStrengthAnnualToGeneral → he_annual_training_plan_v1 MANUAL taper split`.
- **Финализация** `strength-sport-finalize.engine.ts:14` `sessionLimits 24/38/55`, `validateSync`, outside highDays, **MRV 7 метрик** `snatch lifts/clean lifts/squat sets/pull sets/overhead/carry м = sets×dist/stone`, deload 50%, axial QL warn `≥12 +300м/18 stones → QL suitcase 2×20м+hammer 3×12 + plank + biceps hammer` + contest `buildStrongmanPoints 10-1 place 1-5 vs ratio`.
- **Дневник/Injection** `strength-sport-diary.engine.ts:14` epley capped5 / brzycki oly cap3, `buildDiaryTrendSS 28vs56д ±2% plateau`, `acwrEwmaSS α0.25`, `strength-sport-sm-diary.engine.ts:14` carry `e1RM=weight`, `strength-sport-diary-integration.engine.ts:14` `phaseForReps ≤2 maxMoment else mid`, `strength-sport-ta-injection.engine.ts:14` `3×5 @intensityPct 70% dedup budget60-135 choice snatch/clean/technique`, `strength-sport-sm-injection.engine.ts:14` `log→overhead yoke→event 3×5/20м brace 2с`.
- **Попытки/Паспорт/Экспорт** `strength-sport-attempts.engine.ts` WL `92/97/102 + warmup 50-90%×3→1 Sinclair2024+Robi IWF 2025 60/65/71/79/88/94/110`, `strength-sport-strongman-attempts.engine.ts` SM `85/92/98→90/97/102 medley 12/28с+5с points`, `strength-sport-passport.engine.ts` `validatePassport weight100-600 height90-180 turn/tacky`, `strength-sport-export.ts:14` CSV16 + HTML+Gantt+medley/header QR + ICS/MSO XLS + shareHash, `strength-sport-storage.ts:14` `v1→v3 migrate velocityHistory/distanceM/taper`.
- **Контест** `strength-sport-contest.types.ts` 3 пресета `uss_105/novice_3/osg_light`, `STRICT12 carry_drag/overhead_medley`, `35 ивентов` `conan/wheel/shield/duck/truck/arm/viking/atlas_over/natural/stone/keg_over`.
- **UI Constructor** 4 шага `params/outside/split/plan`, `planner-bridge weakpoints` merge + contest+turn/platform+velocityHistory, **VBT per-lift snatch/clean/squat 10/15%** (`vbtPerLift`), **WL 6 попыток** `buildWLMeetPlan`, `StrengthUI` Apple glass, diary EWMA 7/28д, годовой, inline `updateEx/updateSet/moveEx`, `he_vbt_ss_v1`.
- **Диагностики** `WLDiagnosticsHub 650с` 6 tabs snatch5/clean3/jerk3 + VBT/FvR2 + video Kinovea/Enode + mobility OHS6/Kinovea + scoring + `applyToPlanner weakPoints+biomech/fvr/ohs → he_profile_v2` + HTML export + `diagnosticLevel critical gate` `×0.85 keep≥2`. `StrongmanDiagnosticsHub 720с` 6 tabs press/carry/load/grip/mobility/video + contest preset+turn/platform/diameter/surface + sway3/5 + VBT15% + grip tri-modal + axial + `apply smWeakPoints+smBiomech+contest+platform+tacky+sway+vbtHistory`.

**Тесты ~389/389 (16 файлов)** matrix 192 combos ×7 метрик 0 overflow/MRV, property `sets≤6` sync, storage v1→v3, print+Gantt+medley, annual taper, dup-wave, phase6-pro.

## 2. Интернет-ресурсы — что требует современность (2024-2026)

**ТА/ВЗ:**
- **PLOS ONE Wood et al. 2026 (07.07.2026):** 7 производных TA `L-V профили peak velocity` (Perch): `starting_strength / speed_strength / strength_speed / accelerative / absolute` — `snatch absolute 1.30-1.75` all >80% >1.3 m/s ⇒ диагноз: generic `startingStrength` порог **невалиден для TA** — уже исправлено `TA_PEAK_VELOCITY_ZONES`, но требуется **индивидуальная калибровка** (paper: between-athlete variability, individual calibration recommended). Наш хардкод population — ок как гайд, но без ramp-теста ошибка ±0.15 m/s → misclass зоны.
- **Suchomel et al. JSCR 2025 (Suchomel+Kissick):** barbell vs system velocity — large diff `g≥1.49` на всех loads, mean velocity неинформативен из-за transition, **рекомендуют peak velocity**. Наш `LOAD_VELOCITY_PROFILE_SS` правильно peak, но squat/deadlift 0.30/0.20 @100% — это MPV, не peak — смешанные единицы (gap #1).
- **Takano/ Torokhtiy (LiftVault 2024-2026, Torokhtiy Strongman 10w 4-phase):** `Accumulation 3w / Transmutation 3w / Realization 3w / Tapering 1w` — почти parity с нашим `GSP 25/25/20/15/15`, но Takano классифицирует CIII/CII/CI/CMS/MS по тотал — у нас level beginner/intermediate/advanced/enhanced — мост классификации отсутствует. Torokhtiy 10w `3 сесс/нед` + deload `65% wk10` — parity.
- **Bar Path Vorobyev 1978 / GymAware 2024-2025 / Shah et al. 2025 CV:** 4 типа `Type1 toward-away-toward (2× cross) / Type2 toward-away-toward no cross / Type3 away-toward-away-toward (53% WWC, 59% PAWC, most top-3) / Type4 6×` — наш 3 типа упрощён (no Type4, Type1/2 слиты), count zero-cross only x без y vel, нет 2D hip-knee синхронизации.
- **Enode Chavda 2024 / PoinT GO 2024:** `r²0.99 vert, 0.82 horiz` — наш `ENODE_CORRECTION_TABLE` верно, но только scalar intercept/slope, нет per-athlete calibr (paper требует `N=14` calibr).
- **SRD Frontiers 2023:** `SRD 4см turnover / 6см catch, SEM меньше на max` — наш `diagnoseBarPathFromMetrics` верно, но `isRealChange` 3/5 для sway и 4/6 для WL — parity ок, нет SEM-перцентиляции по load%.
- **Arauz J Biomech 2024:** elite vs varsity 3D + EMG — varsity больше вальгус/пронация, хуже timing — наш OHS 6 покрывает, но нет EMG-суррогата (traps EMG в mid-snatch).

**Стронгмен:**
- **StrongmanPlan.com / StrongManPlan 12w:** `comp-date anchored, 3 phases base/peaking/comp prep, weak events 2×, deload 4,7,11 + taper 12` — у нас weak 1.15 ok, но **deload только последняя неделя**, нет auto 4/7/11.
- **MyStrengthBook 2026 Strongman Platform:** `%1RM lifts + medleys + event day RPE/RiR cap, Yoke 320kg/20м 11.4с -1.8с, RPE9 RiR1, weight class management, carry time/distance not reps` — у нас `distanceM/timeCapS` ok, но нет **RPE cap per top single**, нет weight class auto-bucket.
- **Cerberus Strength 2025 Block:** `Linear / Undulating / Block` — block: max strength → power/speed → competition — у нас 5-фаз блок, но **undulating DUP vs Block** не выбирается (DUP только heavy_light/wave).
- **Harris 2018 PeerJ / McGill 2009:** stone hip extensor moment > deadlift, yoke 3-4×BW compression — у нас qualitative note, нет **количественной moment = load × horizDist 0.25m** влияющей на axialBudget.
- **Winwood 2014 JSCR 28 n=454:** step taper `52% vol, -45.5% cess 3.9д` — у нас `WINWOOD_TAPER 0.45/0.55 + cess per-event` верно, но **per-event weight 85→100% linear** — требует contest order fatigue (log первая vs stone последняя).
- **Legg et al. 2019 systematic:** carry stride -0.32 rate+0.37 при load, yoke vs farmers spatiotemporal diff — у нас static rest, нет stride/rate модели.
- **Heazlewood 2025 biceps tear:** distal tear 11% при stone/curl with flexed arms — у нас hammer 3×12 only, нет cue `arms-канаты` per-set + mixed grip DL check.

**Общий вывод интернета:** конструктор **сильно впереди рынка** (StrongmanPlan платный $29 без VBT/barpath/OHS; MyStrengthBook без PEAK zones/FvR2/SRD). Gap рынка: VBT/barpath только в дорогих GymAware ($1200), у нас Kinovea бесплатный — конкурентное преимущество. Осталось закрыть **индивидуализацию (LVP калибровка) + реальный CV + contest simulator**.

## 3. Гэпы — матрица (что болит)

| # | Зона | Текущее | Гэп | Влияние | Источник |
|---|------|---------|-----|---------|----------|
| G-TA1 | LVP индивидуализация | Population `LOAD_VELOCITY_PROFILE_SS` | Нет ramp `50/65/75/90% → regression` | Misclass zone ±1 | Wood 2026 |
| G-TA2 | MPV vs Peak смешение | Squat/dead 0.30/0.20 @100% (MPV) vs snatch peak 1.30 | Несравнимость | Mean vs peak путаница | Suchomel 2025 |
| G-TA3 | VBT closed-loop | Builder only `vol×0.90 RIR+1`, не `pmForWeek` | Вес не авто-регулируется | Стагнация/pere-train | Suchomel peak rec |
| G-TA4 | BarPath CV stub | `computeBarPathMetrics` MA3, zero-cross x only, pose mock | Нет live hip/knee/angle auto | Video вручную | Shah 2025 CV/GitHub |
| G-TA5 | Joint-angle неиспользуется | `angleRangeDeg` только в hub display, `isValidAngle` не в pose | OHS boolean, не auto | Мобильность субъективна | Arauz 2024 |
| G-TA6 | Diary e1RM oly | Epley/Brzycki cap3 | Snatch e1RM ±5кг | Тренд врёт | Такаяне Wood |
| G-TA7 | HRV/readiness | Linear `rec×nut` 0.75-1.15, `acwrEwmaSS α0.25` only zone | Нет EWMA HRV, composite | Усталость пропускается | Cerberus block |
| G-TA8 | Jerk detail | Dip 8-12см текст | Нет yDrop vel, drive power | Jerk стагнация | Zhang 2022 dip0.20с |
| G-TA9 | WL taper distinct | `WINWOOD_TAPER` для всех | WL должен `vol-40% int88-92% 10-14д` | Пик смазан | Pritchard IWF |
| G-SM1 | Carry locomotion | Static rest 240-480с | Нет `speed=1.83×rate -k×load/BW` | Medley unreal | Legg 2019 |
| G-SM2 | Stone lap | `lap 2с` note | Нет hold validate, anterior moment | Травма/потеря | Harris 2018 |
| G-SM3 | Grip binary | `gripFails <30/<20/<30` | Нет pinch width 2-4″, CoC lvl, tri-modal calib | Хват гадает | AthleteProfile 30-45% |
| G-SM4 | Conditioning detached | `modalityForWeek` only warn, even-week inject | No separate conditioning day | GPP провал | Jamieson 3 системы |
| G-SM5 | Contest неполный | 3 presets vs 35 events, no Wilks, no order fatigue | Симуляция нет | Тактика слепа | StrongManPlan |
| G-SM6 | Axial single threshold | `axialSets≥12+300м` one | Yoke 350×2 vs farmers140×6 same | Компрессия недоучтена | McGill 3-4×BW |
| G-SM7 | Biceps prevention half | Hammer 3×12 only | Нет mixed grip DL, supination cue | 11% tears | Heazlewood 2025 |
| G-ARH1 | God builder 1046с |
| G-ARH2 | Storage только LS `he_strength_*_v1` cap20 `cloud-kv` нет |
| G-ARH3 | Engines читают LS (`he_workout_log`, `he_vbt_ss_v1`) — impure |
| G-ARH4 | Stringly IDs `includes snatch` — silent typo |
| G-ARH5 | Selection 5 maps — добавление ивента = 5 файлов |
| G-ARH6 | Pose CDN `pose@0.5 legacy` + Kinovea `time,x,y` vs `Frame;Time;X;Y` locale |
| G-ARH7 | Scoring дубликат `scoreTA/SM` 40с |
| G-ARH8 | Mobile perf 4 шага mounted, 500с inline styles + no lazy |

## 4. Предложения — что доработать и новый функционал

### P0 — критично (2 недели, 389→~450 тестов)
- **P0-1 LVP индивидуализация (2 файла):** NEW `strength-sport-lvp-calibration.engine.ts` `calibrateLVP(lift, points: {loadPct, vmax, hAcc}×4) → {slope, intercept, r², profile: 50-100}` linear regression, `he_lv_profile_ss_v1` per-user + `velocityForSS(pct, lift, userId)` priority user → population fallback. UI ramp-тест 50/65/75/85-90% + `Fit` кнопка + graph. Использует в `estimate1RMFromVelocitySS` + `predictSnatchTh`. Критерий: `r²≥0.92`, иначе warn.
- **P0-2 VBT closed-loop (builder):** `velocityHistory EWMA 7/28д` per-lift → `k×0.6` if loss>30% next week, `pmForWeek` adjust -2% if `isTA&&loss>20%`. В `StrengthSportConstructor` `vbtHistory` уже есть — доделать `vbtEwmaForLift` + `acwrEwmaSS` composite `readiness = rec×hrvEwma×acwr`. Тест: loss30% → weight -2% vs baseline.
- **P0-3 BarPath real CV (pose+video):** `strength-sport-barpath.engine.ts` улучшить `classifyTrajectoryType` 2D (`x+y vel peak` + horiz bias per 10% phase), `computeBarPathMetrics` Butterworth 12Hz (из `cardio-physiology` reuse), `strength-sport-pose.engine.ts` migrate CDN `pose@0.5 → @mediapipe/tasks-vision WASM` + `detectPoseFromVideo(file) → Landmark[]` + `estimateAnglesFromLandmarks` auto `isValidAngleForWeakPoint`. UI file dropzone `input[file]` доделать (сейчас textarea). Kinovea `parseKinoveaCSV` fix `Frame;Time;X;Y` comma/semicolon + mm/cm + top-left invert + 30/60fps t.
- **P0-4 Diary e1RM LVP (2 файла):** `strength-sport-diary.engine.ts` для oly использовать `LVP` e1RM `weight / pctForVelocitySS(vel)` при наличии vel, иначе Brzycki fallback; для carry `e1RM=weight` (уже), для stone/log — только если `reps≤3` иначе skip. `candidateTAWeakPointsFromDiary` phase auto уже — добавить `barMetrics` join.
- **P0-5 Contest simulator SM (1 файл + UI):** `strength-sport-contest-simulator.engine.ts` `simulateContest(contest, workMax, orderFatigue: 0.85→1.0 per event idx) → {points, places, weakEvents, recOrder}` using `buildStrongmanPoints + SM_EVENT_STEP`. UI в `StrongmanDiagnosticsHub` + `StrengthSportConstructor Contest` карточка `🏆 Симулятор: 5 место из 10 — слаб камень, поменяй order`. Пресеты 3→8 (добавить `arnold_uk, giants_light`).
- **P0-6 Builder refactor 3 layers (техдолг):** разбить `strength-sport-builder.engine.ts:1046` на `selection → loading → taper/contest` как `bb-loading-layer.ts` (3 файла по ~250с): `strength-sport-selection.ts` уже есть — вынести `filterPool+POOL_BY_TAG` в `strength-sport-pool.ts`, `buildExerciseSets` → `strength-sport-loading.ts`, `contest+medley+taper` → `strength-sport-contest-bridge.ts`. Тест property остаётся зелёным.
- **P0-7 WL taper distinct + deload 4/7/11:** `strength-sport-taper.engine.ts` NEW `WL_TAPER` `vol0.60 int0.90 10-14д` (Pritchard) vs `WINWOOD_TAPER` SM. `builder phaseForDate(mode)` уже — ветвить. Auto-deload `weeks 4,7,11` если `totalWeeks≥8` (StrongmanPlan) — currently only final week.

### P1 — важно (2-3 недели)
- **P1-1 HRV EWMA + readiness:** `combat-hrv → strength-sport-hrv.engine.ts` `hrvEwma α0.3 mean±SD dangerous <mean-1SD` + `combatACWR` parity, composite `readiness = acwr×hrv×sleep×stress`. Вход `he_hrv_log` (как `combat`) + UI line chart. Builder `recoveryMult = rec×hrvEwma`.
- **P1-2 Carry physics:** Legg model `speed = stride0 1.83 × cadence - k×load/BW` (`k=0.015 yoke, 0.010 farmers`), `distanceM` dynamic vs `EVENT_META.default`, `timeCapS` = `dist/speed + 5с turn`, medley `90с transition / 180 cap` → variable `60-120` per contest. Validate vs `swayCm`.
- **P1-3 Stone anterior moment:** `moment = load × (0.25+sleeve) × sin(torsoAngle)` (Harris) → `axialOverload` per-height: `178см vs 190см` platform `140см` diff moment +15%. Suggest `belt/tackyHeight = platform - 10см`.
- **P1-4 Grip tri-modal calib:** pinch `2″/3″/4″ block ×30с`, crush `CoC 1/1.5/2` level, support `fatGripz 50мм` — `he_grip_profile_v1` store → `gripFails` thresholds per-width, не фикс 30/20/30.
- **P1-5 Conditioning day:** `conditioningSessionsForWeek` уже `alactic/lactic/aerobic` — builder добавляет **отдельный conditioning day** `cond_day` если `mode strongman && !outsideMetrics && gppPhase` (сейчас only lightest session). HR zones `Zone2 130-150 <ANT`.
- **P1-6 Cloud + storage:** `strength-sport-storage.ts` migrate `he_strength_*_v1 → cloud-kv` (как `profile he_strength_annual_sync_v1` lightweight → full). `migrateStrengthSportStorage` atomic + `he_lv_profile_ss_v1` sync.
- **P1-7 Block periodization editor:** `AnnualSS` Gantt drag `Gpp 6w + Strength 4w + Peaking 2w + Taper 1w` blocks editable per-block `plan.weeksData` (сейчас stack only). `StrengthSportConstructor Annual Gantt` → DnD `moveBlock` (как `MacrocyclePanel`).
- **P1-8 Scoring объединить:** `scoreBase(rss, verificationFloors)` shared для `scoreTA/SM` (убрать 40с дубль).

### P2 — качество / UX (1-2 недели)
- **P2-1 Jerk dip detail:** `TA_BIOMECH jerk_dip` добавить `dipTime 0.20с, dipVel, drivePower = mass×vel` из barPath `yDrop + t` — UI поле `dip cm + dip ms` → `diagnoseJerkDip`.
- **P2-2 MPV vs Peak cleanup:** `LOAD_VELOCITY_PROFILE_SS` squat/deadlift переименовать в `MPV` vs `PEAK` + UI badge `MPV/PEAK`, док `Suchomel barbell vs system` note.
- **P2-3 Biceps mixed grip check:** finalize `heazlewoodCheck` — если `id includes deadlift && grip==mixed` → warn `mixed → hook/straps`.
- **P2-4 Engine purity:** `diaryEngine/he_vbt_ss_v1` inject через `StrengthSportInput.velocityHistory/acwr` (уже) — убрать `localStorage.getItem` из `diary.engine.ts`, сделать pure `buildDiaryTrendSS(logs)` only arg.
- **P2-5 Selection single source:** `SS_EX_META` + `POOL_BY_TAG + ANGLE_CLASSES + STRICT_GROUPS + EVENT_META + FALLBACK_COEFF` → один `strength-sport-registry.ts` (как `bb-specialization-registry`).
- **P2-6 Mobile perf:** `StrengthSportConstructor` lazy step `params/outside/split/plan` `React.lazy` + `StrengthUI` токены → 600с inline сократить (как `CardioUI`).
- **P2-7 Offline PWA + XLS polish:** `exceljs` XLS форматирование (сейчас HTML-XLS), `bridge MANUAL taper 2 блока` уже — довести 85%→100% `annual-training` hybrid `composeAnnualProgram strength+combat`.
- **P2-8 Tests 192→384:** дублировать `strength-sport-matrix 192` для `strongman` parity `WL 192 + SM 192 = 384` (ensure 0 overflow для обоих).

### P3 — опционально / будущее
- EMG суррогат `traps EMG mid-snatch` via `pose shoulder elevation`, **RPE for TA** `RPE 6-8` для technique, **Female trajectory Type3 нормировка** (paper Hiskia women Type3 more), **AI coaching** `FvR2 + ISPP → auto focus`, **AR measure 40м farmer** (ARKit), **Offline Kinovea mobile** (phone 30fps → xLoop auto).

## 5. План внедрения — 4 спринта (8 недель)

**Спринт 1 (нед 1-2) — P0 core 7 задач → 450 тестов:** `lvp-calibration` + `vbt closed-loop + diary LVP` (P0-1/2/4) + `barPath CV real + Kinovea fix` (P0-3) + `builder 3 layers` (P0-6). DoD: `he_lv_profile_ss_v1` r²≥0.92, loss30% → вес-2%, pose live hip/knee±3°, property 192 green, `vite build` ok, `vitest strength-sport 450`.

**Спринт 2 (нед 3-4) — P0-5/7 + P1-1/5/6:** `contest simulator 8 пресетов + orderFatigue` + `WL taper + deload 4/7/11` + `HRV EWMA readiness + conditioning day + cloud`. DoD: simulate 10 атлетов place 3/10, GPP conditioning day `cond_day` виден, cloud `he_strength_*` sync, `validateAnnualSSPhases` 3×peaking+taper warn.

**Спринт 3 (нед 5-6) — P1-2/3/4 + P1-7/8:** `carry physics Legg` + `stone moment` + `grip tri-modal` + `block editor Gantt DnD` + `scoreBase`. DoD: `distanceM` dynamic 18-22м vs 20 static ±10%, stone moment +15% for 178 vs 190, grip 2″ vs 4″ diff, Gantt moveBlock persist, `scoreTA==scoreSM base` branch.

**Спринт 4 (нед 7-8) — P2 polish:** `jerk dip ms + MPV/PEAK badge + mixed grip + purity + single registry + mobile lazy + XLS + 384 matrix`. DoD: `vitest 500+` (384 matrix + 192 TA), `tsc 0`, `vite build 43с`, hubs CSV/HTML + `buildStrongmanPoints` points preview last non-deload, `he_lv_profile_ss_v1` shared to `WLDiagnosticsHub FvR2`.

**Вне спринтов — P3 бэклог:** EMG, RPE, Type3 female, AR, AI — по сигналам пользователей.

## 6. Критерии приёмки PRO Next

- **VBT:** population LVP vs individual LVP diff ±0.15 m/s visible, `estimate1RM ±1.5кг` (Sandau), `isTA 10% / pull15 / carry15` thresholds trigger `vol×0.90` — property test 192×7 green.
- **BarPath:** `xLoop SRD 4/6 realChange` + `classify 2D + y vel peak` Type1-4 distrib ~30/55% as GymAware paper, Kinovea `Frame;Time;X;Y` + `, vs ;` + mm/cm + 30/60fps all parse.
- **Contest:** `simulateContest` `5 место/10 — слаб камень` reco `order farmers→yoke` + turn/platform in builder `turn height → techniqueNote`.
- **Taper:** WL `vol-40% int88-92%` vs SM Winwood `vol-45%` — Gantt phase `peaking/taper` distinct, `validateAnnualSSPhases` no 3× peaking.
- **Builder:** 3 layers `selection→loading→contest` no god 1046, `he_strength_* + he_lv_profile` cloud sync, `AnnualSS` Gantt DnD persist, `score verification 0.30/0.30/0.20/0.20`.
- **Gaps closed:** G-TA1-5, G-SM1-3, G-ARH1-2 (P0); G-ARH3-5, G-TA6-9 (P1); остальное P2.

## 7. Файлы — что трогать

- NEW: `strength-sport-lvp-calibration.engine.ts`, `strength-sport-contest-simulator.engine.ts`, `strength-sport-hrv.engine.ts`, `strength-sport-pool.ts`, `strength-sport-contest-bridge.ts`, `strength-sport-registry.ts`
- MOD: `strength-sport-vbt.engine.ts` (individual LVP), `strength-sport-builder.engine.ts` (split 1046→3), `strength-sport-barpath.engine.ts` (2D + Butterworth), `strength-sport-pose.engine.ts` (tasks-vision WASM), `strength-sport-video.engine.ts` (Kinovea fix), `strength-sport-diary.engine.ts` (LVP e1RM), `strength-sport-taper.engine.ts` (WL_TAPER + 4/7/11), `strength-sport-conditioning.ts` (separate day), `strength-sport-storage.ts` (cloud-kv), `strength-sport-annual.ts` (Gantt moveBlock), `strength-sport-selection.ts` (registry), `strength-sport-sm-diagnostics` + hubs (file input, dip ms, moment)
- UI: `StrengthSportConstructor.tsx`, `WLDiagnosticsHub.tsx` (file drop + dip ms + LVP graph), `StrongmanDiagnosticsHub.tsx` (simulator + physics + grip calib), `StrengthUI.tsx` (Gantt DnD)
- TESTS: `lvp-calibration.test.ts 8`, `barpath-2d.test.ts 6`, `contest-simulator.test.ts 6`, `matrix 384`, `property full-combo`, `carry-physics.test.ts 4`

## 8. Источники

- Wood et al. PLOS 2026 L-V 7 derivatives peak >1.3
- Suchomel et al. JSCR 2025 barbell vs system velocity g1.49 peak rec
- Shah et al. 2025 CV barbell tracking mobile (camera height invariant)
- Cunanan et al. 2017 Pan-Am bar trajectory Vorobyev 4 types
- GymAware 2025 Type3 53% WWC most top-3, FLEX bar path app
- Arauz J Biomech 2024 elite vs varsity 3D EMG
- Chavda 2024 Enode intercept-0.45 slope1.08 r²0.82
- Frontiers 2023 SRD 4/6
- Torokhtiy/Takano 12w 3/3/3/1 + 4-phase 10w 65% deload
- StrongmanPlan 12w weak2× deload4/7/11 taper12
- Winwood 2014 n=454 step 52% cess3.9
- Legg 2019 carry stride -0.32 rate+0.37
- Harris 2018 stone > deadlift
- McGill QL, Heazlewood 2025 biceps 11%
- Issurin ATR / Jamieson alactic 1:5
