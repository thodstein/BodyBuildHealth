# Армрестлинг + Армлифтинг — PRO MAX Execution Report (Sep 2026)

> Полное выполнение 10 эпиков, 7 коммитов pathspec, 183 теста (было 147), tsc 0 по arm*, без трогания чужих файлов.

## Коммиты

1. `661699d` A tendon — tendonCap 1.2, seeded RNG, technique RUB, table 3/2/1
2. `4874336` B catalog 60 — towel/fatbar/pinch80/CoC 4 lvls/containment/RN
3. `26704b2` G+H — 4 trauma guards, table swap, VBT per-exercise, force bw-norm, motion video
4. `21dd257` I WAF — A/B/C priority, weightClass, annual taper A 3н B 2н
5. `845c194` J UI — workMax 7 полей, heatmap 12, technique 9, grip 5
6. `5f65f3a` cross-meso + annual ARM source fix + manual-draft previousPlan
7. `7d47bea` storage ARM kind + PRO max 29 tests

## Что закрыто по эпикам

- **A Физиология сухожилия**: TENDON_CAP 1.2 vs MUSCLE_CAP 1.7, tendonWeeklyLimit 12/16/18/22, isTendonMuscle, tendonBudgetForLevel, TENDON_MUSCLES 8 групп, Helms 2022/Schoenfeld/Kemp, GripStrength F1 3с eccentric
- **B Каталог 60**: 40→60, towel pullup, fat bar 50мм, pinch8 80мм, excalibur, little big horn, CoC Trainer/No1/No1.5/No2, finger containment band, wrist curl behind, hammer rope, reverse cable, side belt table safe, cup to_little/thumb, pron/sup high torque, ulnar/radial heavy
- **C Углы РУ/РА/РН**: ARM_ANGLE_CLASSES 13, workingAngleFor hook/toproll/press + history dedupe, seededRng/hashString детерминизм, pickExerciseForMuscle строгий маппинг exactMap
- **D Table 3/2/1**: tableWeekKind moderate 1.0 heavy 0.85 stress 0.55, tableWeekParams hold 1-3мин/10с-1мин/5-10с, weekMult, Кузнецов VIII ≥50% swap Support→TableTech
- **E Техника ×1.3**: specializationMrvFactor + techFactor hook(toproll/press) dom muscles ×1.3, selector boost
- **F Хват раздельно**: GRIP_IMPLEMENTS 8→12, perExerciseCap grip 5/4, gripFocus 1.15/0.85, discipline filter armlifting skip pron/side
- **G 4 гейта**: Humerus ≤10%/нед, UCL hook n00b, Shoulder high-rep 12-20 RIR≥2, Tendon 12/18/22 critical, validate warnings
- **H VBT/Motion/Force**: vbtZone per exercise, vbtForExercise grip 15/25, diagnoseVbt e1RM, force bw-norm side bw*0.6 back bw*0.8, motion hasVideoSupport, validate 2 доп проверки, diagnostics verification 3 фактора
- **I WAF**: ArmMacroBlock weightClass/priority, buildArmMacrocycle A≥3н B2н C встроен, buildArmBlock taper A3 B2, annual types pl|bb|arm, storage ARM kind fix, direction mixed/arm
- **J UI**: ArmAutoConstructor Step +weights, workMaxEdit 7 полей, handleBuild workMax, heatmap 9→12, technique 6→9, grip 3→5 полей + side/back

## Тесты

- 21 файл / 183 теста (engines/arm 18 + UI 2 + pro-max 29)
- Новые 29 в arm-pro-max.test.ts покрывают все эпики: tendon, catalog, angles, table, technique, grip, guards, VBT, WAF, cross-meso
- Фиксы: PED test_e fallback doseSum, verification 0.5 backward-compat, validator valid только mrvOverflow

## Интеграции

- annual-training-storage isAnnualTrainingPlanShape ARM
- block-builders directionFromKinds arm/mixed уже был, теперь storage консистентен
- manual-draft-arm previousPlan
- nav.ts PLANNER_MODES arm уже был, TrainingScreen arm уже был

## Остатки осознанные (не делаем)

- BlazePose full pose — только Hands stub + hasVideoSupport, full canvas+model отдельный эпик 2д
- EMG hardware — не софт
- Nutrition отдельный арм-рацион — reuse IndividualPlan 2.2г/кг

## Проверка

- `npx vitest run src/engines/arm src/ui/.../arm` 183/183
- `tsc --noEmit --skipLibCheck` по arm* 0
- `git log --oneline -7` 7 наших коммитов pathspec, push 5f65..7d47 ok
- Чужие M файлы (95 шт) не тронуты, не закоммичены
