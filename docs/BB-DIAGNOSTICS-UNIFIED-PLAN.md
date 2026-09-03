# ББ-диагностика PRO — ЕДИНЫЙ инструмент (диагностика + коррекция упражнений → эффект в плане)

> **Статус:** ✅ ВЫПОЛНЕН полностью (Sep 2026) — единый план, заменяет `BB-DIAGNOSTICS-EXERCISE-EFFECT-PLAN.md` + `EXERCISE-LAB-DIAGNOSTICS-CORRECTION-PLAN.md` (было 2 плана — ошибка, оставлен 1). Эпики A+B+C закрыты: 6 движков + таб `🏋️ Упражнения` (5 секций) + мост + скоринг + экспорт + 49 тестов. Правки после ревью: фикс `tempoFor` (character→`.notation`), чинен разрыв хаба (импорты/таб/стейт), deep-link в библиотеке.
> **Где:** `src/ui/screens/TrainingScreen_parts/BBDiagnosticsHub.tsx:1` (6 табов, 380с, `weak`/`symmetry`/`stimulus`/`volume`/`recovery`/`mobility`) становится **единым хабом**. Лаборатория `src/ui/screens/TrainingScreen_parts/ExerciseLabMerged.tsx:1` (4 шага) остаётся общим каталогом, **диагностика ББ — только в ББ-хабе** (без дубля).
> **Цель одним предложением:** `план ББ (he_bb_plan_saved) + дневник + замеры + OHS/VBT → диагноз по мышцам и по конкретным упражнениям → коррекция (чем заменить/дополнить, как изменить) → Δ-эффект → 1 кнопка «Применить в ББ-авто» `BbAutoConstructor.tsx:615``.

---

## 1. Почему один инструмент

Сейчас: `BBDiagnosticsHub.tsx:45` диагностирует **мышцы** (weak/symmetry/stimulus), `ExerciseLabMerged.tsx:18` считает **изолированное упражнение** (`getResistanceProfile` stretch/mid/peak `ExerciseLabShared.tsx:160`, `forceVector`, `canReplace`). Связи `упражнение → эффект в вашем ББ-плане` нет. Два отдельных плана плодили дубль. Решение: **расширить ББ-хаб табом `🏋️ Упражнения` — он же и есть лаборатория для ББ**, общий `ExerciseLab` не трогается.

## 2. Что такое «упражнение → эффект» (в цифрах)

```
Упражнение (EXERCISE_CATALOG + SFR_EXERCISE_DB bb-sfr-db.ts:31 + ANGLE_CLASSES bb-exercise-selection.engine.ts:34 + pattern derivePattern movement-pattern.ts)
  ├─ Объём: direct + effective(indirect 0.25-0.6 bb-volume.engine.ts:324) → MEV/MAV/MRV
  ├─ Стимул: SFR 1-5 + lengthened/mid/short (Maeo 2023) + angleClass + strictGroup bb-exercise-selection.engine.ts:185
  ├─ Баланс: pull/press, quad/ham shift (analyzeBBBalance bb-balance.engine.ts:46)
  ├─ Усталость: fatigueCost + fatigueWeighted = sets*(1+(2-RIR)*0.2) + jointStress cnsDemand exercise-biomechanics-db.ts:29
  ├─ Симметрия: unilateral? → чинит asym≥7% bb-symmetry.engine.ts:61
  └─ Выполнение (ББ-паттерн): pattern (horizontal_push/vertical_pull/squat/hinge) + профиль (stretch/mid/peak ExerciseLabShared.tsx:160) + темп TUT (ECC-PAUSE-CON-PAUSE tempoFor bb-tempo-rest.ts:12) + ROM/пауза в растянутой + техника (локти 75°, лопатки сведены, грудь колесом — из EXERCISE_CATALOG.technique + bb-exercise-instructions.engine.ts:105) + ошибки (getErrorsForExercise genetic-deload-technique.engine.ts)
→ Δ-превью: «bench_bar SFR3/mid/high, темп 2-0-1-0 без паузы, локти 90° → incline_db SFR4/lengthened/med, темп 3-1-1-0 с паузой 1с внизу, локти 75°, лопатки сведены : +SFR, +растянутая, -15% усталости, +верх груди, +2с TUT»
```

### 2.1 Коррекция паттерна и выполнения — ББ-специфика (где реальная проработка)

**Проблема:** хаб сейчас диагностирует *что качать*, но не *как выполнять* — а в ББ рост даёт именно выполнение.

**Диагностика выполнения (на каждое упражнение плана):**
- **Паттерн-матч:** `derivePattern()` vs мышца — жим лёжа на среднюю дельту → `patternMismatch` (должен быть `vertical_push/lateral`).
- **Профиль сопротивления:** hypertrophy + `peak_contraction` (кроссовер) без `stretch_mediated` → `wrongProfile` → совет добавить инклайн/RDL/пуловер (Wolf 2023).
- **Темп/TUT:** факт `tempo` из плана vs `tempoFor(goal, level)` `bb-tempo-rest.ts:12` + `generateRepTempo rep-tempo-engine` — hypertrophy: `3-1-1-0` (3с эксц, 1с пауза внизу в растянутой), strength: `2-0-1-0`. Флаг `tempoMismatch` + `tutGap` (TUT <30с или >70с на подход).
- **ROM/пауза:** нет `stretchPhase:true` + `pauseSeconds 1-2` `EXERCISE_CATALOG` → `romGap` (нет растяжения). Пример: `bench_db` без паузы внизу → теряется stretch-mediated.
- **Техника/ошибки:** `buildExerciseInstructions()` `bb-exercise-instructions.engine.ts:105` + `getErrorsForExercise()` → `executionGap`: «отбив от груди», «локти 90° → 75°», «ягодицы отрываются», «неполная амплитуда». Источник честный: `exercise-biomechanics-db.ts:57` `techniqueCues` + `ExerciseBio.jointStress` + `hasLabBio` check.
- **Mind-muscle для weakZone:** если `weakZonesGranular` содержит `chest_upper` а упражнение `bench_bar` (центр) → `mindMuscleGap` → подсказка «своди лопатки, веди локтями 75°, гриф к нижней груди, 1с пауза».

**Коррекция выполнения (типы `CorrectionAction`):**
- `modifyPattern` — заменить паттерн: `horizontal_push` → `incline_push` (верх груди), `hinge` → `squat` (квадры), с `reason` «паттерн не грузит целевую».
- `modifyExecution` — оставить упражнение, но дать 2-3 `execCues` из `bb-exercise-instructions` + `techniqueCues`: «лопатки сведены, грудь колесом, локти 75°, гриф к соскам, без отбива».
- `modifyTempo` — `tempo 2-0-1-0 → 3-1-1-0` + `TUT 42с → 58с`, `rest 90с → 120с` `REST_BY_CHARACTER`.
- `modifyROM` — добавить `пауза 1с внизу в растянутой + полная амплитуда` (`stretchPhase:true, pauseSeconds:1`).
- `substitute` уже есть, но теперь с учётом паттерна: `bench_bar` (mid) → `incline_db` (lengthened) для `chest_upper`.

## 3. Новые движки (reuse канонов, без дублей)

| Файл | Что делает | Reuse |
|---|---|---|
| `bb-exercise-effect.engine.ts` | `calcExerciseEffect(ex, ctx)` → `{sfr, profile, angleClass, strictGroup, direct/effective, fatigueWeighted, jointStress, unilateral, balanceTag, pattern, tempo, executionNote, score}` | `SFR_EXERCISE_DB` `bb-sfr-db.ts`, `ANGLE_CLASSES` `bb-exercise-selection.engine.ts:34`, `JOINT_STRESS_DB` `movement-engines.ts:312`, `bb-exercise-instructions.engine.ts:105` |
| `bb-plan-exercise-audit.engine.ts` | `auditPlanExercises(plan)` → per-muscle `{avgSfr, lengthenedRatio, angleCoverage, strictCoverage, regionalCoverage SUBREGION_DEFS ExerciseLabShared.tsx:35, unilateralRatio, fatigueDensity, patternCoverage, tempoAudit}` + per-exercise `flags[]` | `analyzeBBBalance`, `aggregateBBVolume bb-volume.engine.ts:429`, `ExerciseLabProSubstitute.tsx:63` `regionalCoverage`, `bb-tempo-rest.ts:12` `tempoFor` |
| `bb-exercise-diagnosis.engine.ts` | `diagnoseExercise(ex, ctx{goal,level,weakZones, mobilityFails, asymPct, planTempo})` → **12 флагов**: `lowSFRHighFatigue`, `wrongProfileForGoal`, `jointRisk`, `uncoveredSubregion`, `missingStrict`, `singleAngle` (1 угол при ≥6 сетов `bb-stimulus.engine.ts:41`), `unilateralGap`, **`patternMismatch`** (push/pull/ноги не совпадает с мышцей), **`tempoMismatch`** (темп плана vs `tempoFor` `bb-tempo-rest.ts:12`), **`romGap`** (нет pause в растянутой), **`executionGap`** (ошибки из `bb-exercise-instructions.engine.ts:59` + `ExerciseBio.techniqueCues`), **`mindMuscleGap`** (нет cues для weakZone) | `getResistanceProfile ExerciseLabShared.tsx:160`, `calcTechniqueScore ExerciseLabShared.tsx:213`, `derivePattern movement-pattern.ts`, `isMobilityRestricted bb-mobility.engine.ts`, `getExerciseBio exercise-biomechanics-db.ts:43` |
| `bb-exercise-correction.engine.ts` | `prescribeCorrections(diagnosis, ex, ctx)` → `CorrectionAction{type: substitute|add|modifyPattern|modifyExecution|modifyTempo|modifyROM|modifyLoad|mobilitySwap|unilateral, targetId?, execCues[], tempo?, rom?, reason, confidence, deltaPreview}` | `getSubstitutes EXERCISE_CATALOG`, `stretchLeaders ExerciseLabProSubstitute.tsx:40`, `buildExerciseInstructions bb-exercise-instructions.engine.ts:105`, `generateRepTempo rep-tempo-engine`, `tempoFor bb-tempo-rest.ts`, `ANGLE_CLASSES` |
| `bb-exercise-simulator.engine.ts` | `simulateCorrection(plan, action)` → `Δ {sfrΔ, fatigueΔ, lengthenedΔ, balanceΔ, patternΔ, tempoΔ, issuesResolved[]}` (pure, без мутации) | `auditPlanExercises` до/после |
| `bb-execution-prof.engine.ts` | `getProfExecutionProfile(muscle/subregion) → {angle, elbow, scapula, tempo, rom, cues[], errors[], mindMuscle}` + `diagnoseExecutionProf()` | `EXERCISE_CATALOG.technique`, `EXERCISE_BIOMECHANICS_DB.techniqueCues`, `TARGET_MUSCLE_DB`, `bb-exercise-instructions.engine.ts:105`, `bb-tempo-rest.ts` |

Существующие `bb-weak-detection`, `bb-symmetry`, `bb-stimulus`, `bb-scoring` `bb-scoring.engine.ts:32` — без изменений (в `scoreBB` добавится `penExercise`/`penAngle`).

## 4. UI — один хаб `BBDiagnosticsHub.tsx:45` (380с → ~560с)

**6 → 7 табов:** `weak` `symmetry` **`exercise` ← НОВЫЙ (диагностика+коррекция)** `stimulus` `volume` `recovery` `mobility`. `stimulus` остаётся summary, детали — в `exercise`.

**Хедер** `BBDiagnosticsHub.tsx:296` + чип `SFR` (средний по плану) + `усталость` рядом с `ACWR` `BBDiagnosticsHub.tsx:312`, gauge RSS `bb-scoring.engine.ts:83` остаётся.

**Таб `🏋️ Упражнения` — 5 секций внутри одного таба (без новых страниц):**

1. **Аудит портфеля плана** (читает `he_bb_plan_saved` `BBDiagnosticsHub.tsx:134`): таблица по мышцам — строки упражнений плана с бейджами `SFR 5🟢·lengthened📐·pattern horizontal_push·tempo 3-1-1-0·unilateral↔·fatigue 7·angle horizontal_press·strict chest_fly` + агрегаты `avgSFR 4.2 · lengthened 2/3 · углы 3/5 · подрегионы 3/6 · усталость 1.18 · паттерн-баланс push/pull`. Клик → `buildExerciseInstructions() bb-exercise-instructions.engine.ts:105` тултип (паттерн+темп+пауза+ошибки).

2. **Диагноз упражнения** (выбор из портфеля или каталога `ExerciseLabCatalog.tsx:36` drawer): `diagnoseExercise()` → список `⚠ Низкий SFR+высокая усталость` + `🚫 Риск плеча (shoulderLoad high + OHS fail)` + `⚠ 1 угол при 8 сетах` + `💡 Нет unilateral при asym 9%` + **`🚨 Паттерн-мисматч (жим лёжа на среднюю дельту)` + `⏱ Темп-мисматч (2-0-1-0 vs 3-1-1-0)` + `📏 Нет паузы в растянутой (romGap)` + `🎯 Техника: локти 90°→75°, отбив от груди`**. Оценка `0-100` с breakdown по `суставы/сложность/ЦНС` `calcTechniqueScore ExerciseLabShared.tsx:213`.

3. **Коррекция выполнения (ББ-проработка)** — **новое, центральное:** карточки `modifyExecution`/`modifyTempo`/`modifyROM`/`modifyPattern` (не только замена упражнения):
   - *Пример грудь:* `bench_bar 3×8 2-0-1-0` → `темп 3-1-1-0, пауза 1с внизу в растянутой, локти 75°, лопатки сведены, грудь колесом, гриф к соскам, без отбива, TUT 54с` (из `EXERCISE_CATALOG.technique` + `bb-exercise-instructions`).
   - *Пример ноги:* `squat` без глубины → `глубина ниже параллели, колени наружу, пятки прижаты, пауза 1с внизу`.
   - *Пример спина:* `row_bar` тянет бицепсом → `локти вдоль тела, тяни к поясу, своди лопатки, пауза 1с в пике`.
   Каждая карточка — `execCues[]` + `tempo` + `rom` + `Δ TUT/усталости/стимула` + кнопка `▶ Применить выполнение` (меняет `tempo`/`pauseSeconds`/`comment` в плане, не только id).

### 2.2 PROF-уровень — как дать именно в мышцу (глубокая проработка выполнения)

Слабый уровень — «пауза 1с, локти 75°». PROF — **мышечно-специфичная биомеханика + вектор + акцент подрегиона**.

**Новый движок `bb-execution-prof.engine.ts` (60с) — канон ББ-выполнения (Schoenfeld/Israetel/Contreras):**

| Мышца/подрегион | Идеальное выполнение (чек-лист из `EXERCISE_CATALOG.technique` + `EXERCISE_BIOMECHANICS_DB.techniqueCues` + `TARGET_MUSCLE_DB`) | Диагноз слабого выполнения | PROF-коррекция `execCues` |
|---|---|---|---|
| **chest_upper** (ключичная) | Угол 30° (не 45° `incline_bar` `EXERCISE_CATALOG`), лопатки сведены+опущены, грудь колесом, локти 75° к корпусу, гриф к подбородку/верх груди, сведение гантелей с супинацией вверху, пауза 1с внизу в растянутой | Угол 45° → передняя дельта забирает; локти 90° → плечо; без паузы → нет stretch | `«Скамья 30°, лопатки сведены вниз, локти 75°, гриф к подбородку, пауза 1с внизу, своди гантели с разворотом ладоней»` |
| **chest_mid/lower** | Локти 75°, касание сосков/низа груди, без отбива, мост естественный, гантели — больше ROM + сведение, брусья — наклон 30° вперёд + локти в стороны + глубокое растяжение | Отбив/мост чрезмерный/локти в стороны → трицепс/дельта | `«Плечи вниз-назад, локти 75°, гриф к соскам, 1с пауза, без отбива, выдох на жиме»` |
| **back_width** (широчайшие) | Локти вдоль тела к поясу/тазу, тяга локтями не кистями, сведение лопаток вниз (не к ушам), грудь вперёд, пауза 1с в сокращении, растяжение внизу 1с | Локти в стороны → ромбовидные; тяга кистями → бицепс; нет паузы → нет пика | `«Тяни локтями к карманам, лопатки вниз-назад, грудь вперёд, 1с пауза в пике, 2с негатив»` |
| **back_thickness** (центр/ромбы) | Локти в стороны 60-90°, тяга к низу живота/груди, сведение лопаток к позвоночнику, упор груди (`row_tbar`/`chest_supported`), без читинга корпусом | Корпус раскачивается/локти узко → широчайшие | `«Локти в стороны, тяга к животу, сведи лопатки на 1с, корпус фиксирован»` |
| **delt_mid** (средняя) | Чуть наклон вперёд, махи до уровня плеч (не выше — трапеция), локти чуть согнуты, мизинец выше большого (наружная ротация), пауза 1с вверху, без раскачки | Выше плеч/раскачка/кисти ведут → трапеция | `«Наклон 15°, веди локтями, мизинец вверх, до плеч, пауза 1с, 2с вниз»` |
| **delt_rear** | Наклон 60-70°, локти вверх (не назад), мизинец вверх, сведение лопаток, не круглить спину | Локти назад → широчайшие | `«Наклон 70°, локти вверх, мизинец ведёт, своди лопатки, 1с пауза»` |
| **quads** | Стопы ширина плеч, носки чуть наружу, колени по линии носков, глубина бёдра ниже параллели, пятки прижаты, таз не подкручивается, пауза 1с внизу | Колени внутрь/пятки отрыв/неглубоко → ягодицы/поясница | `«Колени по носкам, глубина ниже параллели, пятки в пол, пауза 1с внизу, подъём пятками»` |
| **hamstrings/glutes** | Таз назад (шарнир), штанга по ногам, колени мягкие 15-20°, спина нейтраль, растяжение бицепса бедра внизу 1с, сокращение ягодицами вперёд (hip thrust: подбородок прижат, таз до прямой, пауза 2с) | Кругление поясницы/колени прямые → поясница | `«Таз назад, штанга скользит по ногам, почувствуй растяжение сзади, таз вперёд ягодицами, 1с пауза»` |
| **biceps** | Локти прижаты к корпусу, без раскачки, супинация вверху (длинная головка) / молот нейтрально (брахиалис), растяжение внизу 1с, пауза в пике 1с | Раскачка/локти вперёд → передняя дельта | `«Локти прижаты, супинация вверху, 2с негатив, 1с растяжение внизу, 1с пик»` |
| **triceps** | Локти неподвижны у корпуса, разгибание до выпрямления с паузой 1с, без читинга корпусом | Локти гуляют/корпус помогает | `«Локти фиксированы, разогни до конца с паузой 1с, 2с негатив»` |

**Диагностика PROF:** `diagnoseExecutionProf(ex, muscle, weakZone)` сверяет `plan.tempo`/`pauseSeconds`/`technique` с этим каноном + `EXERCISE_BIOMECHANICS_DB.torqueProfile` (bottom_peak → пауза внизу обязательна) + `getJointStress` → флаг `profGap: chest_upper — угол 45° вместо 30°, нет паузы, локти 90°`.

**Коррекция PROF:** `prescribeExecutionProf()` выдаёт 3-4 пункта чек-листа именно для `weakZone` (не общие «контролируй негатив»), с `videoCue` (ссылка на `TECHNIQUE_CUES`) + `tempo 3-1-1-0 → 3-2-1-1 для stretch` + `TUT` пересчёт + `mindMuscle` фраза («думай локтями к карманам — спина, не бицепс» `bb-exercise-instructions.engine.ts:204`).

4. **Коррекция упражнением (замена/дополнение)** (`prescribeCorrections`): топ-3 `substitute`/`add` карточки `«incline_db — SFR4 lengthened закрывает incline_press + strict chest_incline, -8% усталости, +12% стимула»` + кнопка `▶ Применить в план` + сворачиваемый список. Каждая — `confidence` и `Δ-превью` из `simulateCorrection`.

5. **Библиотека SFR+паттернов** (reuse каталога): фильтр `мышца/SFR≥4/lengthened/unilateral/паттерн/оборудование` + сортировка по `sfrSelectionBonus bb-sfr-db.ts:199`, чип `STRICT_GROUP` `STRICT_EXERCISE_GROUPS` + бейдж `профиль stretch/mid/peak` `ExerciseLabShared.tsx:160`.

**Остальные 6 табов без дублей:** `weak` уже шлёт `weakZonesGranular` `BBDiagnosticsHub.tsx:230`, `symmetry` — `asymPct`, `mobility` `BBDiagnosticsHub.tsx:436` OHS — всё читается `exercise` табом как `ctx`, не дублируется ввод.

**Применение:** одна кнопка `applyExerciseCorrections()` → `applyToPlanner({kind:'weakpoints', label:'ББ: '+weakZones+'+упражнения', data:{ groups: weakMusclesCanonical BBDiagnosticsHub.tsx:219, weakZonesGranular, preferredExerciseIds:[targetId], exerciseSwap:{oldId, newId}, labDiagnosis, bbDiagScore:score BBDiagnosticsHub.tsx:197 }})` → `BbAutoConstructor.tsx:1412` `BBBuilderInput.preferredExercises?: string[]` → `selectExercisesSmart` пробует первыми, `ensureStrictGroupCoverage bb-exercise-selection.engine.ts:291` не ломается, `rationale` строка.

## 5. План реализации (один инструмент)

**Эпик A — движки ядра (3.5 дн, ✅ ВЫПОЛНЕН):** `bb-exercise-effect` + `bb-plan-exercise-audit` + `bb-exercise-diagnosis` + `bb-execution-prof` (PROF чек-листы по 10 мышцам) + `bb-exercise-correction` + `bb-exercise-simulator` — чистые, без UI. Тесты 28 (в `bb-diagnostics-pro.test.ts`).

**Эпик B — таб `exercise` в хабе (3 дн, ✅ ВЫПОЛНЕН):** `BBDiagnosticsHub.tsx` новый `BBTab='exercise'` `BBDiagnosticsHub.tsx:25`, 5 секций (лента + аудит + диагноз + PROF + коррекции + библиотека), персист `he_bb_diagnostics_hub_v1:exerciseState`, deep-link `→ Качество/Объём`. Тесты 8 (в `bb-diagnostics-hub.test.tsx`).

**Эпик C — мост + BbAuto + скоринг (1 дн, ✅ ВЫПОЛНЕН):** `planner-bridge` расширение `weakpoints` (`preferredExerciseIds`/`exerciseSwap`/`labDiagnosis`/`labCorrection`/`labDelta`), `BbAutoConstructor.tsx:616,1343,1958` приём (preferred + swaps + executionCorrections с persist `he_bb_preferred_exercises`/`he_bb_exercise_swaps`/`he_bb_execution_corrections`), `bb-scoring.engine.ts:21,51` `penExercise`/`penAngle`/`penLengthened` (мягко, RSS сохранён), `bb-diagnostics-export.engine.ts:13,75` таблица «Упражнение→эффект» (HTML+CSV). Тесты 8.

**Итого ~7.5 дн, MVP (A + B секции 1-3) ~4 дн.** tsc 0, `vitest bb-diagnostics` 44+ зелёных, `bb` без регрессий, 0 дублей (reuse `SFR_EXERCISE_DB`/`ANGLE_CLASSES`/`SUBREGION_DEFS`/`JOINT_STRESS_DB`/`EXERCISE_BIOMECHANICS_DB`).

## 7. Интернет-доработка (Sep 2026, сверено с сетью)

- **SFR (Israetel/RP; Outlift 16.09.2024; RP Complete Hypertrophy Guide 2024; Hevy Coach 2024; Mirafit 2025; Barbell Physio 2026):** SFR = стимул целевой мышцы / системная усталость. High-SFR: тросы/машины/гантели (наш SFR 4-5: `incline_db`, `lateral_raise*`, `leg_ext`, `row_chest_supported`), изоляция у отказа дешевле базы у отказа (failure≈тот же рост, больше усталости — тренировать базу RPE 7-8, изоляцию ближе к отказу). RSM (raw stimulus magnitude): высокостимульные `row_bar`/становая — первыми в сессии, остальное добивать low-fatigue. Замены-канон: deadlift→RDL, OHP→lateral raise, bench→dips, squat→leg press/hack — наш `rankSubstituteCandidates` так и скорит (SFR + stretchPhase + jointStress low + `canReplace`).
- **Lengthened (Wolf et al. 2023 meta; Wolf/PeerJ 2025 trained upper-body LP≈full ROM; Strey et al. 2026 meta LL>SL ES=0.283; Kassiano gastrocnemius lengthened>full; lengthened supersets beyond failure 2024):** итог — растить в растянутой позиции: полный ROM ИЛИ lengthened partials; LP — не замена базе, а добивка после отказа full ROM (lengthened superset). Наш `wrongProfile`/`romGap` + `modifyROM` (пауза 1с внизу) так и работают; PROF-темпы с паузой внизу — канон.
- **Темп (Schoenfeld 2017 meta: eccentric-преимущество исчезает при равном объёме; Wilk 2021: эксцентрик 2-4с оптимум, >6с хуже; Kojic/Frontiers 2024: 4/0/1/0 > 1/0/1/0 для VL, регион-специфично; Schoenfeld 2015: 0.5-8с/повт эффективно, >10с хуже):** наш PROF-канон (гипертрофия `3-1-1-0`, тяж `2-0-1-0`, эксцентрик 2-4с + пауза 1с + взрывная концентрика) в норме. Фикс в этом раунде: `bb-exercise-correction` больше не зовёт `tempoFor(goal, level)` (сигнатура — character/technique/phase/exerciseName, возвращает `TempoSpec`), а маппит goal→character (`памп`/`тяж`/`лёг`) и берёт `.notation`.
- **Вариация (Kassiano 2022 systematic review; Baz-Valle 2019; Kassiano 2024 RQES):** систематическая вариация = региональная гипертрофия+, рандомная еженедельная = вред. Наш `STRICT_GROUPS` + `angleCoverage` + ротация по мезоциклам (не хоппинг) — так и задумано; песочница показывает Δ до применения.

## 6. Критерий готовности

- Одно место — `BBDiagnosticsHub.tsx` таб `🏋️ Упражнения` — диагностирует и каждое упражнение, и весь портфель плана.
- Для слабых зон `delt_mid`/`chest_upper` топ-3 коррекции с `почему` (SFR, lengthened, угол-гэп, unilateral) и `Δ` до применения.
- `▶ Применить` меняет `he_bb_plan_saved` на следующей сборке (preferred реально в `BBPlan.weeks[0].sessions[].exercises[].exerciseName`).
- Фильтр `оборудование`+`mobilityRestrictions he_profile_v2` `BBDiagnosticsHub.tsx:248` — невозможные не предлагаются, `canReplace` соблюдается.
- Каталог показывает диагност. чип без открытия карточки.
