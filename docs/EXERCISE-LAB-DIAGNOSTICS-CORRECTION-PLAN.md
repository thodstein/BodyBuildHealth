# Лаборатория упражнений — диагностика и коррекция (интеллектуальные тренировки)

> **Статус:** 📋 план на согласование (Sep 03 2026)
> **Где:** `src/ui/screens/TrainingScreen_parts/ExerciseLabMerged.tsx:1` (4 шага: `prescription`→`technique`→`pro_substitute`→`compare`, каталог drawer) + `src/ui/screens/TrainingScreen_parts/ExerciseLabShared.tsx:1` (shared либы) + `src/data/exercise-biomechanics-db.ts:1` + `src/engines/movement-engines.ts:1`
> **Цель:** превратить лабораторию из **каталога/калькулятора** в **диагностико-коррекционный центр**, связанный с ББ-планом: `упражнение → диагноз (что не так) → коррекция (чем заменить/дополнить, как изменить технику/темп/нагрузку) → эффект в плане → применение в `BbAutoConstructor.tsx:615``.
> **Принцип:** без дублей — reuse `EXERCISE_CATALOG`, `EXERCISE_BIOMECHANICS_DB`, `BBDiagnosticsHub` движков (`bb-sfr-db`, `bb-balance`, `bb-audit`), `movement-engines` (safety/jointStress/synergy). Новые движки — только диагноз/коррекция.

---

## 1. Аудит текущего

| Что есть | Файл | Что умеет | Чего нет для диагностики/коррекции |
|---|---|---|---|
| **4 шага мастера** | `ExerciseLabMerged.tsx:18` `MODE_DEFS` | Шаг1 `ExerciseLabPrescription.tsx:1` — подбор+блины `calculatePlates`+тоннаж+1RM `estimate1RMConsensus`+VBT `velocityForPct`+ББ-темп `tempoFor`/`REST_BY_CHARACTER`; Шаг2 `ExerciseLabTechnique.tsx:16` — `TechniqueDetail`+`BodyMapSVG`; Шаг3 `ExerciseLabProSubstitute.tsx:1` — force-векторы `forceVector`+stretch-лидеры `getResistanceProfile`+подрегионы `SUBREGION_DEFS`+синергия+`canReplace`/`getSubstitutes`; Шаг4 сравнение | Нет **диагноза на материале пользователя**: не читает `he_bb_plan_saved`/`he_workout_log_v1`, не знает weakZones `BBDiagnosticsHub.tsx:180`, не оценивает SFR `bb-sfr-db.ts:31`, угол `ANGLE_CLASSES` `bb-exercise-selection.engine.ts:34`, баланс `analyzeBBBalance` `bb-balance.engine.ts:46` |
| **Каталог 90+** | `ExerciseLabCatalog.tsx:36` | фильтры group/type/equipment/difficulty, карточка: `fatigueCost`/`jointStress`/`bio` `BodyMapSVG` `ExerciseLabShared.tsx:411`, `canReplace`/`cannotReplace` | Нет бейджа «диагностический флаг» (низкий SFR/высокая усталость/травмоопасно при OHS fail) |
| **Биомеханика 80+** | `exercise-biomechanics-db.ts:43` `EXERCISE_BIOMECHANICS_DB` | `jointStress`/`torqueProfile`/`cnsDemand`/`primaryMuscles`/`substitutions`/`techniqueCues` | Нет связи с **ББ-эффектом**: SFR+lengthened `bb-sfr-db.ts:154`, `strictGroup` `bb-exercise-selection.engine.ts:185` |
| **Безопасность** | `movement-engines.ts:562` `assessSafety()` | `score 0-100` + `contraindications`/`precautions` по `jointStress`+traвмы | Не учитывает `he_profile_v2.mobilityRestrictions` `BBDiagnosticsHub.tsx:248` + профиль травм |
| **ББ-хаб отдельно** | `BBDiagnosticsHub.tsx:1` 6 табов, `bb-scoring.engine.ts:32` RSS | Диагностирует мышцы/симметрию/стимул, шлёт `weakPoints` в план | Не умеет диагностировать **конкретные упражнения** плана — этим должна заняться лаборатория |

**Вывод:** лаборатория считает изолированное упражнение, но не отвечает «**что в моём ББ-плане не так с упражнениями и чем исправить**».

---

## 2. Интернет-исследование (Sep 03 2026)

| Тема | Источник | Норма для диагностики/коррекции |
|---|---|---|
| **Stretch-mediated** | Maeo 2023, Wolf 2023 meta `ijsc.v3i1.182`, Larsen PeerJ 2025 `PMC11829627` — long-length partials ≈ full ROM, > short | Коррекция: заменить `short/peak` на `lengthened` (RDL/инклайн/пуловер) `ExerciseLabShared.tsx:160` `stretch_mediated` |
| **SFR** | Israetel RP, Outlift 2024 `outlift.com/stimulus-to-fatigue`, FitBudd 2026, Strive 2026 — high-SFR = machines/cables/dumbbells | Коррекция: `deadlift_conventional` (SFR2/high spineLoad) → `romanian_deadlift`/`hip_thrust` (SFR4/low) |
| **Weak-point 5 рычагов** | HyperBody 2026 `hyperbody.fit/blog/weak-point-training` — диагноз фото/замеры/дневник → первым, 2-3×/нед, +4-6 сетов, упражнения где цель — лимитер | Коррекция: прикрыть `uncovered` подрегион `ExerciseLabProSubstitute.tsx:63` `regionalCoverage` + добавить `unilateral` при `asym≥7%` `bb-symmetry.engine.ts:61` |
| **Безопасность/суставы** | Schoenfeld joint stress, `movement-engines.ts:312` `JOINT_STRESS_DB` | Коррекция: при `OHS fail`/`kneeToWall<12` `BBDiagnosticsHub.tsx:440` — убрать `kneeLoad high` (`back_squat`/`sissy_squat`) → `leg_press`/`goblet_squat` |
| **Техника → ошибки** | `ExerciseLabShared.tsx:252` `TechniqueDetail` (cues/errors/progression/regression) | Коррекция: показать `getErrorsForExercise` + `getTechnique` вместо общего текста |

---

## 3. Концепция «диагностика → коррекция» лаборатории

```
he_bb_plan_saved + he_workout_log_v1 + he_profile_v2 (оборудование/мобильность/травмы) + BBDiagnosticsHub.report
        │
        ▼
┌─ Диагностика упражнения (одиночная) ─┐  ┌─ Диагностика портфеля плана (групповая) ─┐
│ calcExerciseDiagnosis(ex) →          │  │ auditPlanExercises(plan) →               │
│  • уровень/цель mismatch (strength  │  │  • avgSFR, lengthenedRatio,              │
│    vs stretch_mediated)              │  │  • angleCoverage `ANGLE_CLASSES`,         │
│  • SFR низкий + fatigue высокий      │  │  • strictCoverage `STRICT_GROUPS`,       │
│  • jointStress high + mobility fail  │  │  • подрегионы `SUBREGION_DEFS` uncovered,│
│  • подрегион uncovered               │  │  • unilateralRatio,                       │
│  • техника score low                 │  │  • баланс `pull/press` `bb-balance`,     │
│  • замена застревает (нет прогресса) │  │  • flags: highFatigueLowSFR,            │
└──────────────────────────────────────┘  │    missingLengthened, singleAngle       │
        │                                 └──────────────────────────────────────────┘
        ▼                                           │
  ┌─ Коррекция ─┐  ← prescribeCorrection(diagnosis, ctx) → приоритизированный список `CorrectionAction`
  │  type:      │     • substitute (SFR+lengthened, `canReplace` фильтр)
  │  - substitute │   • add (закрыть uncovered подрегион / strict группу)
  │  - add      │     • modifyTempo (3-1-1-0 → 3-2-1-1 для stretch)
  │  - modifyTempo│   • modifyLoad (снизить вес `velocityForPct`/повысить RIR)
  │  - modifyLoad │   • addUnilateral (при asym)
  │  - mobility │     • mobilitySwap (high kneeLoad → low при fail)
  │  - unilateral│    confidence 0-1 + reason + deltaPreview
  └──────────────┘
        │
        ▼
  Δ-эффект (что даст в ББ-плане) → `simulateCorrection(plan, action)` → volumeΔ/SFRΔ/fatigueΔ/balanceΔ
        │
        ▼
  Применение → `applyToPlanner({kind:'weakpoints', data:{ preferredExerciseIds, exerciseSwap, corrections }})`
               → `BbAutoConstructor.tsx:615` `BBBuilderInput.preferredExercises`
```

**Одна фраза:** лаборатория отвечает *почему упражнение плохое для вашего плана* и *чем его исправить с прогнозом эффекта*.

---

## 4. Архитектура — reuse vs new

| Нужно | Канон | Использование |
|---|---|---|
| Каталог + canReplace/cannotReplace/substitutionGroup | `src/core/exercise-catalog.ts` | чтение |
| Биомеханика + jointStress/cnsDemand/primaryMuscles | `src/data/exercise-biomechanics-db.ts:19` `ExerciseBio` | чтение |
| Safety score + jointStress DB | `src/engines/movement-engines.ts:562` `assessSafety`/`getJointStress` | чтение |
| SFR 1-5 + lengthened/mid/peak + unilateral | `src/engines/bb/bb-sfr-db.ts:21` `SFR_EXERCISE_DB`, `src/ui/screens/TrainingScreen_parts/ExerciseLabShared.tsx:160` `getResistanceProfile` | чтение |
| Углы + строгие группы | `src/engines/bb/bb-exercise-selection.engine.ts:34,185` `ANGLE_CLASSES`, `STRICT_EXERCISE_GROUPS` | чтение |
| Подрегионы груди/спины/ног | `src/ui/screens/TrainingScreen_parts/ExerciseLabShared.tsx:35` `SUBREGION_DEFS`, `ExerciseLabProSubstitute.tsx:63` `regionalCoverage` | чтение |
| Баланс/стимул/объём плана | `src/engines/bb/bb-balance.engine.ts:46`, `src/engines/bb/bb-sfr-db.ts`, `src/engines/bb/bb-volume.engine.ts` | чтение `he_bb_plan_saved` |
| WeakZones + symmetry asym | `src/engines/bb/bb-diagnostics-hub.engine.ts:40` `BBDiagnosticsReport` | чтение из `BBDiagnosticsHub` snapshot или `he_bb_diagnostics_hub_v1` |
| Мобильность → профиль | `BBDiagnosticsHub.tsx:248` `applyMobilityToProfile` + `isMobilityRestricted` | фильтр |

**Новые движки (только диагноз/коррекция, без мутации плана):**

| Файл | Экспорт | Логика |
|---|---|---|
| `lab-exercise-diagnosis.engine.ts` (80с) | `diagnoseLabExercise(ex, ctx)` | На вход `Exercise` + `ctx{ goal, level, weakZones, planAudit, mobilityFails, asymPct }` → `LabDiagnosis{ flags:[], score 0-100, issues:string[], explain:string }`. Флаги: `lowSFRHighFatigue` (SFR≤3 + fatigueCost≥7 + `Lateral raise` logic `bb-sfr-db.ts`), `wrongProfileForGoal` (hypertrophy + `peak_contraction`/`mid_range` vs `stretch_mediated`), `jointRisk` (knee/spineLoad high + mobility fail), `uncoveredSubregion` (подрегион из `SUBREGION_DEFS` не покрыт), `missingStrictGroup`, `singleAngle` (1 `ANGLE_CLASSES` при ≥6 сетов `bb-stimulus.engine.ts:41`), `unilateralGap` (asym≥7% + не unilateral `exercise-biomechanics-db.ts:37`) |
| `lab-plan-exercise-audit.engine.ts` (80с) | `auditLabPlanExercises(plan)` | Обёртка над `bb-exercise-audit` + `ExerciseLabProSubstitute` логикой: `avgSfr`, `lengthenedRatio`, `angleCoverage`, `strictCoverage`, `regionalCoverage` per group, `unilateralRatio`, `fatigueDensity`, + `labFlags` per exercise через `diagnoseLabExercise` |
| `lab-exercise-correction.engine.ts` (90с) | `prescribeLabCorrections(diagnosis, ex, ctx)` | Для каждого флага → `CorrectionAction{ type, targetId, reason, confidence, deltaPreview }`: `substitute` — топ-1 из `getSubstitutes(ex.id)` `EXERCISE_CATALOG` отфильтрованный по `SFR`↑+`lengthened`+`canReplace`+оборудование+`!isMobilityRestricted`; `add` — закрыть `uncovered` (берёт líder из `stretchLeaders` `ExerciseLabProSubstitute.tsx:40`); `modifyTempo` — `generateRepTempo`/`tempoFor`; `mobilitySwap` — low jointStress альтернатива; `unilateral` — `isUnilateral` true. Приоритет по `confidence` |
| `lab-exercise-simulator.engine.ts` (50с) | `simulateLabCorrection(plan, action)` | Чистый `Δ`: до/после `auditLabPlanExercises` → `sfrΔ/fatigueΔ/lengthenedΔ/balanceΔ/unilateralΔ/issuesResolved` — превью без мутации, как `bb-exercise-simulator` |

---

## 5. UI — `ExerciseLabMerged.tsx:18` (4 шага → 4 шага + диагностическая лента)

**Сохраняем 4 шага**, добавляем **диагностическую ленту + бейджи** (без нового шага в MVP):

- **Глобальная лента диагностики** над шагами (sticky `ExerciseLabMerged.tsx:108`): если есть `he_bb_plan_saved` → `auditLabPlanExercises(plan)` summary: `SFR 3.8 ⚠ · lengthened 40% ⚠ · углы груди 2/4 ⚠ · подрегионы 3/6 · усталость 1.22 ⚠` + чип `weakZones: delt_mid` из `he_bb_diagnostics_hub_v1` + `→ ББ-диагностика` линк. Клик — раскрывает детали.

- **Шаг 1 `PrescriptionTab` `ExerciseLabPrescription.tsx:1`**: после выбора `exId` `ExerciseLabPrescription.tsx:63` — карточка `🔍 Диагноз упражнения` (иконки `✅/⚠/🚫` по флагам из `diagnoseLabExercise`) + `💊 Коррекция` топ-1 `prescribeLabCorrections` с кнопкой `▶ Применить в план` → `applyToPlanner`. Остальные 2–3 коррекции — сворачиваемый список. Сохраняем все существующие графики (TUT/AMRAP/1RM/VBT/тоннаж).

- **Шаг 2 `TechniqueTab`**: под `TechniqueDetail` `ExerciseLabShared.tsx:252` — блок `⚠️ Частые ошибки → исправление` уже есть `ExerciseLabShared.tsx:311`, дополняем блоком `🩺 Коррекция техники под ваш диагноз` (если `jointRisk` → подсказка из `techniqueCues` `exercise-biomechanics-db.ts:57` + регрессия `technique.regression`).

- **Шаг 3 `ProSubstituteTab` `ExerciseLabProSubstitute.tsx:1`**: таблица `ExerciseLabProSubstitute.tsx:140` дополняется колонкой `Диагноз` (бейдж цвета `getRiskColor` `ExerciseLabShared.tsx:244`) + при клике на строку — `prescribeLabCorrections` для этого упражнения. Блок `🔄 Замена` `ExerciseLabProSubstitute.tsx:150` получает ранжир по `Δ SFR/усталость` из `simulateLabCorrection`, а не только `canReplace`.

- **Каталог `ExerciseLabCatalog.tsx:36`**: чип `Диагноз` на карточке упражнения (зелёный/жёлтый/красный) при наличии плана — считается лениво через `diagnoseLabExercise` (кеш).

**Кнопка применения:** `applyLabCorrection(action)` → `applyToPlanner({kind:'weakpoints', label:'Лаб: '+ex.name+' → '+action.targetId, data:{ preferredExerciseIds:[action.targetId], exerciseSwap:{oldId:ex.id,newId:action.targetId}, labDiagnosis:diagnosis }})` → `BbAutoConstructor.tsx:1412` уже принимает `preferredExerciseIds` (план `BB-DIAGNOSTICS-EXERCISE-EFFECT-PLAN.md`).

**Персист:** `he_exercise_lab_v1` + `lastLabDiagnosis` (кэш).

---

## 6. Мост с ББ-диагностикой

`BBDiagnosticsHub.tsx:219` `applyToConstructor` уже шлёт `weakPoints` + `symmetry/asym` + `ohs`. Лаборатория читает тот же `he_bb_diagnostics_hub_v1` + `he_unified_intel_snapshot_v1` — не дублирует ввод окружностей/VBT. Обратно: лаборатория может отправить `labDiagnosis` с `weakSubregion` → ББ-хаб подсветит `weakCandidates`.

---

## 7. План реализации (эпики)

### Эпик A — диагноз-движок (1.5 дн)
- `lab-exercise-diagnosis.engine.ts` — флаги 7 шт + `diagnoseLabExercise()` + `score`. Тесты 8 (lowSFR, wrongProfile, jointRisk+mobility, uncovered, strict, singleAngle, unilateral, score).

### Эпик B — аудит портфеля (1 дн)
- `lab-plan-exercise-audit.engine.ts` — `auditLabPlanExercises(plan)` reuse `bb-exercise-audit` + `regionalCoverage`/`angleCoverage`. Тесты 6 (avgSfr, lengthenedRatio, angle, strict, regional, fatigue).

### Эпик C — коррекция (1.5 дн)
- `lab-exercise-correction.engine.ts` — 6 типов `CorrectionAction` + ранжир `confidence` (SFR↑ > lengthened > equipment/mobility). Тесты 8 (substitute highSFR, mobilitySwap, unilateral при asym, add uncovered, modifyTempo, modifyLoad, confidence порядок, фильтр canReplace).

### Эпик D — симулятор Δ (0.5 дн)
- `lab-exercise-simulator.engine.ts` — pure Δ. Тесты 4 (ΔSFR, Δfatigue, Δlengthened, Δbalance).

### Эпик E — UI лаборатория (2.5 дн)
- `ExerciseLabMerged.tsx:108` — лента диагностики + прокидка `selectedId` → `PrescriptionTab:exId` → `diagnoseLabExercise` карточка + `prescribeLabCorrections` список + `applyLabCorrection`.
- `ExerciseLabPrescription.tsx:346` — блок диагноза/коррекции под метриками.
- `ExerciseLabProSubstitute.tsx:134` — колонка диагноза + ранжир замены по Δ.
- `ExerciseLabCatalog.tsx:116` — чип диагноза на карточке.
- Тесты `lab-exercise-ui.test.tsx` 8 (лента с планом/без, диагноз lowSFR, коррекция топ-1, apply в bridge, каталог чип, техника дополнение).

### Эпик F — мост + BbAuto (0.5 дн)
- `planner-bridge` расширение уже есть (`preferredExerciseIds`/`exerciseSwap`) — только прокидка `labDiagnosis` в `rationale`. Тесты 2 (preferred первым, mobility блокирует).

### Эпик G — скоринг лаборатории (0.5 дн)
- Отдельный `labScore 0-100` (не RSS, а средний диагноз портфеля) для ленты + чип в хедере `ExerciseLabMerged.tsx:61`. Тесты 2.

**Оценка:** A 1.5 + B 1 + C 1.5 + D 0.5 + E 2.5 + F 0.5 + G 0.5 = **~8 дн**. MVP (A+C+E лента+Шаг1) = **4 дн**.

---

## 8. Критерии PRO

- Каждое упражнение в плане диагностируется: `diagnoseLabExercise()` возвращает 0–3 флага с объяснением (не «общая теория»).
- Для каждого флага — топ-1 коррекция с `confidence` + `reason` + `Δ-превью` до применения.
- `▶ Применить в план` реально меняет `he_bb_plan_saved` на следующей сборке `BbAutoConstructor` (`preferredExerciseIds` в плане).
- Фильтр коррекций по `equipment` + `mobilityRestrictions` (`he_profile_v2`) — невозможные не предлагаются; `canReplace`/`substitutionGroup` `EXERCISE_CATALOG` соблюдаются.
- Каталог показывает диагностический чип без открытия карточки.
- tsc 0, `vitest lab-exercise` 30+ зелёных (A 8+B 6+C 8+D 4+E 8+F 2+G 2), `bb` без регрессий, `exercise-lab` существующие тесты зелёные.
- 0 дублей: диагноз reuse `SFR_EXERCISE_DB`/`ANGLE_CLASSES`/`SUBREGION_DEFS`/`JOINT_STRESS_DB`, аудит reuse `bb-balance`/`bb-volume`, VBT reuse `pro/vbt`.

---

## 9. Осознанные остатки

- Видео-анализ техники (Kinovea/BlazePose как в `WLDiagnosticsHub`) — отложено, в MVP — `TechniqueDetail` + cues/errors.
- Персональный план коррекции на 4–8 нед (как в `BBDiagnosticsHub`) — отложено, в MVP — одноразовая замена/дополнение.
- Фото-AI пропорций — отложено.

## 10. Риски

- Низкая техника + high difficulty → коррекция предлагает регрессию `technique.regression` `ExerciseLabShared.tsx:328`, а не усложнение.
- `SFR` — только приоритет выбора, не множитель `effectiveSets` (инвариант объёма сохранён, как в `bb-sfr-db.ts:10`).
- `STRICT_GROUPS` `bb-exercise-selection.engine.ts:185` — коррекция не ломает: `substitute` только внутри группы при `strictGroup` present.

