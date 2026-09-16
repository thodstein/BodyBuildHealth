# План: коррекция движений армрестлинга

Дата: 2026-09-15. Статус: ПЛАН + выполнение P1–P6 (только арм; ТА — зона другого агента).
Область: `src/engines/arm/*`, `ArmDiagnosticsHub` + `arm-hub-*`. Чужие файлы не трогать.

## 1. Аудит: что есть

Цепочка замкнута кодом: `diagnoseArmWeakDetailed` → `buildArmDiagnosticsReport`
→ `diagnoseArmWeakCause` → `rankCorrectionsForArm` (топ-3) → `buildArmSpecBlock`
→ `injectArmCorrections` (+ `targetSets`) → откат `he_arm_plan_saved_prev`.
Биомеханика: `arm-biomechanics` — 12 точек с угол-диапазоном, ключевым суставом,
слабыми мышцами, `loadCues`, `intensityPct 0.60–0.70`.
Видео: `arm-video-analysis` (xLoop/yMax/vMax, тип inside/outside/straight, SRD=4)
+ `arm-motion-capture` (углы elbow/forearm/wrist, `phaseForArmAngle`).
Отдельная ветка `armlift-correction` (снаряды) — столом не используется.

Разрывы (были): таба «Коррекция» нет; углы ≠ фазы; нет фаз схватки как времени;
`причина → доза` разорвана; `видео → точка` не автоматизировано; симулятор бедный
(только покрытие); стол vs снаряды не дружат.

## 2. Интернет-синтез

Канон 3 техники — toproll (pronation+rising+back pressure), hook (cup+supination+
biceps, угол закрыт), press (shoulder+triceps+side pressure, только с преимущества).
Техника — лёгкие частые повторы + table time 20–30 мин не в отказ; gym кормит стиль;
обе руки (StrengthLog/ArmProgress/Wikipedia). Наши 12 точек покрывают канон 1-в-1 —
дорабатывать связку, не таксономию.

## 3. Упражнения корректировки (канон пулов — единый источник)

### 3.1 Армрестлинг: 12 точек → упражнения + доза
Доза базы: 3 сета, RIR 1–2, tempo указан; корректируется P3 (причина).

| Точка (фаза) | Топ-упражнения (порядок = приоритет) | Доза базы |
|---|---|---|
| cup_start (сгибание кисти, старт) | wrist_curl_belt, cup_to_little, wrist_curl_bb, wrist_roller | 3×6–10 @65%, 2-1-1-0 |
| cup_hold (удержание сгиба) | wrist_curl_belt, wrist_curl_behind, cup_to_thumb, riser_lift | 3×8–12 @65%, холд 10с, 2-1-2-0 |
| rising_top (подъём кисти) | riser_lift, finger_containment_band, plate_pinch_hold, radial_dev_heavy, ulnar_dev_heavy | 3×8–12 @65%, холд 10с |
| pron_open (пронация открытая) | pronation_cable, pronation_sledge, pronation_strap, indian_clubs | 3×8–12 @70% |
| pron_lock (пронация замок) | pronation_cable, pron_high_strap, sledge_choke, lever_top | 3×5–8 @70%, холд 10с, 3-1-1-0 |
| sup_cup (супинация+чашка) | supination_cable, supination_hammer, hammer_curl_thick, sup_high_strap | 3×8–12 @70% |
| sup_drag (супинация тяга) | supination_cable, hook_drag_cable, hammer_belt, sup_high_strap | 3×6–10 @70%, RIR 1 |
| side_mid (бок середина) | side_press_cable, side_belt_table, side_press_table, table_pushdown_iso | 3×3–6 @60%, 3-1-1-0 |
| side_pin (бок дожитие) | side_belt_table, table_pushdown_iso, side_press_table, internal_rotation_band | 3×3–6 @60%, холд 10с |
| back_start (тяга к себе, старт) | lat_drag_belt, row_strap_hip, landmine_row_under, hook_drag_cable | 3×6–10 @70% |
| back_drag (тяга к себе) | lat_drag_belt, row_strap_hip, hook_drag_cable, anti_rotation_hold | 3×6–10 @70% |
| contain_fingers (пальцы/хват) | hub_pinch, plate_pinch_hold, rolling_thunder, apollon_axle, finger_containment_band, coc_gripper | 3×8–12 @60%, холд 15с |

Запрет смешивания: pron ↔ sup только внутри своего substitutionGroup
(cup_iso/rising/pronation/supination/side_press/back_drag/grip_pinch);
dayTags — TableCup/TableTech/Hammer/SidePress/BackPress/GripHeavy и др.
`fixesPhase` (P6): setup/start/mid/pin на точку (contain_fingers — все фазы).

### 3.2 Армлифтинг: звено → пул + протокол
| Звено | Пул (топ-3 из ранжира) | Протокол/доза |
|---|---|---|
| thumb (щипок) | plate_pinch_hold, hub_pinch, pinch_block_80 (+saxon/anvil/country_crush) | 3×20–30с / 3×5, 2–3×/нед, разминка пальцев |
| fingers (опора) | rolling_thunder 5×3+холд, apollon_axle до 85%, fat_bar_deadlift 4×5, inch 3×1 | 1–2×/нед, DOH без лямок |
| wrist_ext (разгибатели) | wrist_ext_bb 3×15–25, wrist_roller, reverse_ez_curl 3×12, lever_top холд 12с | 2–4×/нед, баланс flex/ext |
| support_endurance (вис) | farmer_walk_fat 3×20–40м, towel_pullup 3×8, fat_gripz_curl 3×10 | 1–2×/нед |
| crush (сдавливание) | CoC-лесенка рабочий 3×5–7 + целевой негативы + silver_bullet_hold 3×макс | 2–3×/нед, разминка 1×10–12 не в отказ |
| technique/asymmetry | практика своим снарядом первой (IMPLEMENT_TO_EX) + opener 85%×3 | 1×/нед |
| conditioning (боль) | wrist_ext_bb 2×15 + wrist_roller 2 подъёма + plate_pinch 2×15с @50% | ежедневно/по готовности, без боли |

## 4. План доработки (P1–P6)

- P1 Таб «Коррекция»: NEW `arm-hub-correction-tab.tsx` — сквозной блок на точку
  (угол + причина + топ-3 §3.1 с дозами + Δ + 💉/↩). Без новой математики.
- P2 Фаза схватки: `failurePoint: setup/start/mid/pin` в `rankCorrectionsForArm`
  (+6 чинящей фазе через `fixesPhase`); чипсы в табе, поле в стейте хаба.
- P3 Причина → доза: `doseForCause` (fatigue: −1 сет/RIR+1/−5п.п.;
  mobility: high-rep/RIR≥2/−5п.п.; strength: 5×5/+5п.п. кап 85;
  volume/technique: база) + lock-тест; строка «📐 Доза по причине» в табе.
- P4 Видео → точка: `suggestWeakPointsForTrack` (toproll→rising/pron, hook→cup/sup,
  press→side/back; всегда low + кнопка «+ точка», weakPoints не выставляем автоматом).
- P5 Симулятор честный: те же гейты, что инъекция (budget/dup/tendon-26/humerus,
  вес через `estimateArmCorrectionWeight`, `blocked` в summary).
- P6 Мост стол↔снаряды: опциональный `fixesPhase` в ARM_CORRECTIONS, общий тип дозы
  `ArmDose`; хабы не сливаются.

## 5. Критерии приёмки
- Топ-3/дозы/инъекция — старые тесты + новые lock (доза по причине, фаза, видео→точка).
- Упражнения §3 — все ids валидны в каталогах (validateArmCorrections).
- `tsc` 0 по своим; чужие WIP не тронуты; коммиты pathspec.

## 6. Выполнение
- P1 ✅: 6-й таб, hub-тест 45→49/49.
- P3 ✅: NEW `arm-correction-dose.engine.ts`, тест 6/6.
- P2 ✅ + P4 ✅: ранжир + `suggestWeakPointsForTrack`, тест 15/15.
- P2/P4 UI ✅: `failurePoint` в стейте + ранжире хаба, чипсы (и в пустом состоянии),
  видео- и угловая (`autoPoint`) подсказки в табе.
- P5 ✅: честный симулятор (гейты 1-в-1 как инъекция: budget/dup/humerus/tendon/session);
  P6 ✅: `fixesPhase` во всех 12 точках.
- Добивка «всё полностью» ✅:
  1. `rankedIds` в инъекцию + проводка топ-3 из хаба (ранжир едет в план);
  2. кап сессии (8) в симулятор; 3. `autoPoint` в таб; 4. чипсы фазы в пустом состоянии.
- Полное применение дозы ✅: `causes` в `injectArmCorrections` — сеты/повторы/RIR/вес
  из `doseForCause` (targetSets спец-блока приоритетнее dose.sets; без causes — база);
  пометка «доза: …» в comment/notes; паритет в симуляторе; проводка causes из хаба
  и таба; lock-тесты (база/fatigue/strength/сим-инъекция).
- Доза в мост конструктора ✅: хаб аттачит `armRankedIds` в payload (прецедент armMatchup;
  `armWeakCauses` уже нес мост); NEW `bridgeDoseFromPayload` (валидация, мусор → null);
  приёмник `ArmAutoConstructor` — персист `he_arm_last_causes/rankedids` только на свежий
  мост точек + чтение в инъекцию + чистка на «✕ Сбросить»; без ключей — базовый путь.
  Lock-тесты (валидный/мусор/сквозной мост→план).
- Паритет Δ во всех панелях ✅: P0-панель и экспорт считают симуляцию с causes —
  одна цифра с табом (было: таб с дозой, остальные с базой).
- Проверено: hub 49/49 + p0 35/35 + injection 7/7 + parity 147/147 + dose 6/6 + phase 22/22
  + bridge/discipline/ortho/wizard/top 29/29; движки `src/engines/arm` 948/948 (79 файлов);
  арм-UI 160/160 (22 файла); `verify:apk-design` OK; `tsc` 0 по своим
  (ошибки — чужие активные WIP bb/sm, не тронуты).
