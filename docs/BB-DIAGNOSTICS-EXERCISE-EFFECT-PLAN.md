# ББ-диагностика PRO — расширение «Упражнения → Эффект в ББ-плане»

> **Статус:** 📋 план на согласование (Sep 03 2026)
> **Цель:** добавить в хаб `src/ui/screens/TrainingScreen_parts/BBDiagnosticsHub.tsx:1` функционал, который связывает **конкретное упражнение → прогнозируемый эффект именно в ББ-плане** (объём, стимул, баланс, усталость, симметрия), а не общую теорию. Пользователь видит *что изменится в его плане*, если заменить/добавить упражнение.
> **Принцип:** тонкий хаб — без дублей, reuse канонов (`exercise-catalog`, `bb-sfr-db`, `bb-volume`, `movement-pattern`, `bb-balance`, `bb-exercise-instructions`). Новые движки — только чистый расчёт эффекта.

---

## 1. Где сейчас пробел

| Что есть в хабе (380с) | Чего нет для «упражнение → эффект» |
|---|---|
| `🎯 Слабые` — выбирает 1–2 зоны `GRANULAR_OPTS` `BBDiagnosticsHub.tsx:54`, кидает `weakPoints` в `BbAutoConstructor.tsx:615` | Нет связи **зона → конкретные упражнения** с ранжиром по SFR/lengthened/углу |
| `💪 Стимул` — читает `analyzeBBStimulus() → analyzeBBBalance` `bb-stimulus.engine.ts:16` (global lengthened/mid/short, patterns) | Нет **поупражненческого аудита**: какое упражнение даёт lengthened, какой SFR 1–5 `bb-sfr-db.ts:30`, какой `fatigueCost` `exercise-catalog.ts:4` |
| `📊 Объём` — чип факта vs MEV/MAV `BBDiagnosticsHub.tsx:392` | Нет **вклада упражнения в effectiveSets** (включая indirect `bb-volume.engine.ts:324` — жим → triceps 0.45) |
| `🦿 Мобильность` — OHS → `he_profile_v2` `BBDiagnosticsHub.tsx:248` → `isMobilityRestricted` | Нет **фильтра упражнений по мобильности/оборудованию** перед рекомендацией |
| `bb-diagnostics-injection.engine.ts:11` — 1 коррекция 3×10 @65% на слабую зону | Нет **песочницы замены** «что-если» и библиотеки high-SFR альтернатив |

Итог: хаб диагностирует *мышцы*, но не отвечает на вопрос «**каким упражнением закрыть слабую зону и что это даст моему плану**».

---

## 2. Интернет-исследование (проверено Sep 03 2026)

| Тема | Источник | Вывод для ББ-плана |
|---|---|---|
| **SFR (Stimulus-to-Fatigue Ratio)** — термин Israetel (RP). High-SFR = максимум стимула на минимум системной усталости; low-SFR = системная усталость «съедает» объём | Outlift 2024-09-16 `outlift.com/stimulus-to-fatigue-ratio-sfr` — deadlift → RDL, OHP → lateral raise, squat → hack/leg press; FitBudd 2026-05-04 — шкала 1–5, high-SFR = cables/machines/dumbbells; Strive 2026-03 — «anchor high-SFR, use low-SFR sparingly» | В плане: `bb-sfr-db.ts:31` SFR 5 = fly_cable/pec_deck/leg_ext/lateral_raise, SFR 3 = squat/bench_bar/row_bar. High-SFR машины/блоки позволяют набрать `effectiveSets` без превышения `weeklyBudget` `bb-volume.engine.ts:162`. |
| **Lengthened / stretch-mediated hypertrophy** | Larsen et al. 2024 preprint → PeerJ 2025-03-15 `PMC11829627` — lengthened partials ≈ full ROM, superior to shortened; Maeo 2023, Wolf 2023 meta `ijsc.v3i1.182`, Wolf 2024 SportRxiv — тренировка в растянутой позиции → дополнительная гипертрофия; GymNotes 2026-01-12 — «bottom 60% leg extension» | В `bb-sfr-db.ts:159` эвристика `resistanceProfile='lengthened'` (incline/RDL/sissy/pullover), `sfrSelectionBonus` `bb-sfr-db.ts:199` +3 в intensification, `lengthenedBonus` `bb-exercise-selection.engine.ts:105` ×0.5/1.5 по `trainingFocus` |
| **Weak point — 5 рычагов** | HyperBody 2026-08-09 `hyperbody.fit/blog/weak-point-training` — диагноз (фото/замеры/дневник) → 1) первым в сессии, 2) 2–3×/нед, 3) +4–6 сетов постепенно, 4) упражнения где цель — лимитер (chest-supported row), 5) техника/видео; BarBend 2025-04 leg curls before squats | В `bb-specialization.engine.ts:63` focus ×1.3 / weak ×1.2, `STRICT_EXERCISE_GROUPS` `bb-exercise-selection.engine.ts:185`, `WEAK_EXERCISE_BONUS` — уже есть, нужен ранжир |
| **Объём MEV/MAV/MRV** | Schoenfeld 2017 `Med Sci Sports Exerc 49:661` — 10+ vs <5, Isratel RP — MEV 6–8 / MAV 12–18 / MRV 20–25 `volume-landmarks.engine.ts:36` | Факт `aggregateBBVolume` `bb-volume.engine.ts:429`, `sessionLimitsFor` `bb-volume.engine.ts:179` (24/40/60) |
| **Унилатеральность → симметрия** | Schoenfeld 2016 frequency 2× >1×, `bb-sfr-db.ts:165` `isUnilateralExercise` (bulgarian/lunge/single) | Для `symmetryAsymPct ≥7%` `bb-scoring.engine.ts:37` — приоритет unilateral |
| **Техника → инструкции** | `bb-exercise-instructions.engine.ts:59` `hasLabBio` + `TARGET_MUSCLE_DB`, `formatExerciseInstructions` `bb-exercise-instructions.engine.ts:259` | Хаб может показать cues/mistakes для рекомендованного упражнения |

**Вывод концепции:** эффект упражнения в ББ — это **вектор** из 6 компонент: `directSets` + `effectiveSets (indirect)` + `SFR` + `lengthened/mid/short` + `fatigueCost/jointStress` + `angleClass/strictGroup` + `unilateral`. High-SFR + lengthened + нужный angle = максимум роста на минимум бюджета.

---

## 3. Концепция «Упражнение → Эффект»

```
Упражнение (из EXERCISE_CATALOG.id + SFR_EXERCISE_DB + ANGLE_CLASSES)
  │
  ├─ Объёмный эффект ──► directSets + effectiveSets (indirect 0.4–0.6 bb-volume.ts:324) → проверка MEV/MAV/MRV per-muscle
  ├─ Стимульный эффект ─► SFR 1–5 + resistanceProfile lengthened/mid/short (Maeo 2023) + angleClass (chest: horizontal/incline/fly) + strictGroup
  ├─ Балансный эффект ──► сдвиг pull/press, quad/ham, chest/back (analyzeBBBalance.ts:46)
  ├─ Усталостный эффект ► fatigueCost 3–10 + fatigueWeightedSets = sets × (1+(2-RIR)*0.2) + jointStress (high/med/low)
  ├─ Симметрийный эффект ► unilateral ? «чинит L/R ≥7%» : нет
  └─ Специализационный ─► попадает ли в weakZonesGranular → WEAK_EXERCISE_BONUS + focus ×1.3
          │
          ▼
  Δ-отчёт: «Замена bench_bar (SFR3/mid/high fatigue) → incline_db (SFR4/lengthened/med) : +SFR, +растянутая, −усталость 15%, +верх груди, баланс pull/press 0.82→0.91»
```

Оценка «эффекта» — число 0–100 на мышцу: `stimulusScore = clamp( (volRatio 0–1)*0.5 + (sfrNorm 0–1)*0.2 + lengthenedBonus 0–0.15 + angleDiversity 0–0.15 ) × rirFactor × freqFactor`. Формула — только для чипа, не меняет MRV-капы.

---

## 4. Архитектура — reuse vs new

| Потребность | Канон (не трогать) | Решение хаба |
|---|---|---|
| Каталог упражнений, group/type/equipment/fatigueCost/jointStress, canReplace | `src/core/exercise-catalog.ts:4` (~90 записей) | Чтение + `findCatalog()` |
| SFR 1–5 + lengthened/mid/short + unilateral + `sfrSelectionBonus` | `src/engines/bb/bb-sfr-db.ts:31` `SFR_EXERCISE_DB` 62 записи | Импорт |
| Углы/паттерны + lengthenedBonus + STRICT_GROUPS + `ensureStrictGroupCoverage` | `src/engines/bb/bb-exercise-selection.engine.ts:34,105,185` | Импорт |
| Баланс/паттерны/lengthened per-muscle | `src/engines/bb/bb-balance.engine.ts:46` `analyzeBBBalance` | Чтение `plan.weeks` |
| Стимул global penalty | `src/engines/bb/bb-stimulus.engine.ts:16` | Чтение |
| Объём direct/effective/indirect, бюджет, perExerciseCap | `src/engines/bb/bb-volume.engine.ts:179,228` | Чтение |
| Инструкции PATTERN_RU, cues, tempo, `source:lab/catalog/generic` | `src/engines/bb/bb-exercise-instructions.engine.ts:59,105` | Импорт для карточки упражнения |
| Мобильность `isMobilityRestricted`, оборудование из `he_profile_v2` | `src/engines/bb/bb-mobility.engine.ts` | Фильтр |
| Существующая инъекция 3×10 @65% | `src/engines/bb/bb-diagnostics-injection.engine.ts:11` | Расширить, не дублировать |

**Новые движки — только чистые расчёты эффекта (без мутации плана):**

| Файл | Экспорт | Логика |
|---|---|---|
| `bb-exercise-effect.engine.ts` (70с) | `calcExerciseEffect(ex, ctx)` | На вход `Exercise` + `ctx{ phase, level, focus, weekBudget }` → `BBExerciseEffect{ sfr, profile, angleClass, strictGroup, direct, effectiveIndirect[], fatigueWeighted, jointStress, unilateral, balanceTag, score, notes }` — единая точка правды для таблицы/песочницы/прескрипшена |
| `bb-exercise-audit.engine.ts` (80с) | `auditBBPlanExercises(plan)` | Читает `plan.weeks` → per-muscle портфель: `exercises[]` + `avgSfr` + `lengthenedRatio` + `angleCoverage` (сколько из `ANGLE_CLASSES[muscle]` покрыто) + `strictCoverage` + `unilateralRatio` `bb-sfr-db.ts:184` + `fatigueDensity` = fatigueWeighted/effective + flags `highFatigueLowSFR`, `missingLengthened`, `singleAngle`, `missingStrict` |
| `bb-exercise-prescription.engine.ts` (90с) | `prescribeExercisesForWeak(weakZones, plan, profile)` | Для каждой `weakZone` из `bb-diagnostics-hub.engine.ts:46` `detectBBWeak*` → ранжир кандидатов из `EXERCISE_CATALOG`: фильтр `equipment` + `!isMobilityRestricted` + `!inPlan` + покрывает missing `angleClass` → скор `sfr*2 + lengthenedBonus + angleGap*3 + unilateralBonus(если asym≥7)` → топ-3 с `reason` |
| `bb-exercise-simulator.engine.ts` (60с) | `simulateSwap(plan, muscle, oldId, newId)` | Чистая копия `auditBefore` → `auditAfter` (замена одного id) → `delta{ sfrΔ, fatigueΔ, lengthenedΔ, balanceΔ, unilateralΔ, volumeΔ, issuesResolved[] }` — без мутации плана, для превью перед `applyToPlanner` |

---

## 5. UI — `BBDiagnosticsHub.tsx` (380с → ~520с, parity `WLDiagnosticsHub.tsx:520`)

**Новый таб `🏋️ Упражнения` (7-й), 4 секции:**

1. **Аудит портфеля плана** (read-only из `he_bb_plan_saved` `BBDiagnosticsHub.tsx:134`): таблица по мышцам — упражнения текущего плана с бейджами `SFR 5/5 🟢` / `lengthened 📐` / `unilateral ↔` / `fatigue 7` / `angle horizontal_press` / `strict chest_fly` + агрегаты `avgSFR 4.2 · lengthened 2/3 · углы 3/5 · усталость 1.18`. Клик — `buildExerciseInstructions()` тултип (cues/mistakes/tempo).

2. **Рекомендации на слабую зону** (из `bb-exercise-prescription`): для `report.weakZonesGranular` `BBDiagnosticsHub.tsx:219` — карточки топ-3: «`incline_db` — SFR 4 · lengthened · закрывает угол incline_press (отсутствует) · unilateral нет · эффект +12% стимула, −8% усталости». Кнопка `▶ Применить` → `applyToPlanner({kind:'weakpoints', data:{ groups, preferredExerciseIds:[id], exercisePrescription:{muscle:weak, candidates:[ids]} }})`.

3. **Песочница замены** (`simulateSwap`): селекторы `мышца → старое упр. (из плана) → новое (из каталога+SFR)` → delta-чипы зелёный/красный + `issuesResolved` («уйдёт флаг `missingLengthened` для `chest`») + кнопка `↔ Заменить в плане` (тот же bridge, `exerciseSwap:{oldId,newId}`).

4. **Библиотека SFR** (read-only): фильтр `мышца / SFR≥4 / lengthened / unilateral / оборудование` + сортировка по `sfrSelectionBonus` + бейдж `STRICT_GROUP` `STRICT_EXERCISE_GROUPS` `bb-exercise-selection.engine.ts:185` — подсказка «меняется только внутри группы».

**Остальные 6 табов без изменений** (weak/symmetry/stimulus/volume/recovery/mobility `BBDiagnosticsHub.tsx:45`) — stimulus теперь показывает также `auditBBPlanExercises` summary + линк «→ Упражнения: детали».

**Хедер:** добавляется чип `SFR` (средний по плану, если есть план) и `усталость` (fatigueDensity), рядом с `ACWR` `BBDiagnosticsHub.tsx:312`.

---

## 6. Мост в ББ-авто (`planner-bridge.ts` + `BbAutoConstructor.tsx:227`)

**Расширение существующего `kind:'weakpoints'` (без нового kind в MVP):**

```ts
applyToPlanner({
  kind: 'weakpoints',
  label: `ББ диагностика: ${weakZones.join(', ')} + упражнения`,
  data: {
    groups: weakMusclesCanonical,           // уже есть BbAutoConstructor.tsx:1784
    weakZonesGranular,                      // уже есть
    preferredExerciseIds: ['incline_db'],   // NEW — приоритет в buildSession selectExercisesSmart
    exerciseSwap: { muscle:'chest', oldId:'bench_bar', newId:'incline_db' }, // NEW — для симулятора
    bbExerciseEffect: { avgSfr, lengthenedRatio } // мета для rationale
  }
})
```

**Приём в `BbAutoConstructor` (тонко, без ломки объёмной модели):**
- `preferredExerciseIds` → в `BBBuilderInput.preferredExercises?: string[]` → `selectExercisesSmart` пробует их первыми (если в пуле и проходят `isMobilityRestricted` + оборудование), иначе fallback — объём не ломается.
- `exerciseSwap` → одноразовая замена при `buildBBPlan` (если оба id в каталоге) — мутация `pool` перед `ensureStrictGroupCoverage`.
- `rationale` дополняется строкой `«ББ-диагностика: упражнения ${ids} (SFR/lengthened) — приоритет»`.

**Альтернатива (отложено):** новый `kind:'bbExerciseSwap'` — если понадобится изоляция от weakpoints. В MVP — расширение weakpoints.

---

## 7. Скоринг — тонкая надстройка

`bb-scoring.engine.ts:32` `scoreBB` — добавить 2 мягких пенальти (не ломая RSS, как в `bb-contest-prep`):

- `penExercise = avgSFR <3.5 ? 8 : avgSFR <4.0 ? 4 : 0` + `lowSFRHighFatigueCount ≥2 ? +6`
- `penAngle = missingAngleMuscles ≥2 ? 8 : ≥1 ? 4 : 0` (из `auditBBPlanExercises`)

В `bb-diagnostics-hub.engine.ts:82` `scoreBBSymmetry/scoreBB` — передать `avgSfr` и `angleGaps` из `auditBBPlanExercises(plan)`. Floors не добавлять — только пенальти.

---

## 8. Хранение

| Ключ | Что | Кто |
|---|---|---|
| `he_bb_diagnostics_hub_v1` | `BBState` + `preferredExerciseIds?: string[]` + `lastSwap?: {oldId,newId}` | хаб |
| `he_bb_plan_saved` | план (читает хаб `BBDiagnosticsHub.tsx:134`) | `BbAutoConstructor` |
| `he_profile_v2` | `training.equipment`, `mobilityRestrictions`, `level`, `sex` | `getProfile()` — фильтр кандидатов |
| `he_planner_apply` | weakpoints+exercise payload | `applyToPlanner` |
| `he_workout_log_v1` | e1RM / volume факт | `detectBBWeak*` — уже есть |

---

## 9. План реализации (эпики, parity TA 76054adb 9 файлов ~1465с)

### Эпик A — эффект-движок (1 день)
- `bb-exercise-effect.engine.ts` — `calcExerciseEffect()` (SFR + profile + angle + strict + fatigueWeighted + indirect + unilateral + balanceTag), `exerciseEffectScore()`. Тесты 6 (SFR lookup, lengthened, unilateral, indirect, jointStress, score).

### Эпик B — аудит-движок (1 день)
- `bb-exercise-audit.engine.ts` — `auditBBPlanExercises(plan)` → per-muscle агрегаты + флаги. Reuse `analyzeBBBalance`, `aggregateBBVolume`. Тесты 6 (avgSFR, lengthenedRatio, angleCoverage, strict, unilateral, fatigueDensity).

### Эпик C — прескрипшен (1.5 дня)
- `bb-exercise-prescription.engine.ts` — фильтр по `equipment`/`mobilityRestrictions`, ранжир `sfr*2+lengthened+angleGap*3+unilateralBonus`. Тесты 6 (фильтр мобильности, оборудование, SFR-порядок, angle-gap, unilateral при asym, дедуп с планом).

### Эпик D — симулятор (0.5 дня)
- `bb-exercise-simulator.engine.ts` — `simulateSwap()` pure delta. Тесты 4 (Δ SFR, Δ fatigue, Δ lengthened, Δ balance).

### Эпик E — UI хаба (2–3 дня)
- `BBDiagnosticsHub.tsx` +380с → ~520с: новый `BBTab='exercise'` `BBDiagnosticsHub.tsx:25`, секция аудита (таблица), секция рекомендаций (карточки топ-3 на зону + `preferredExerciseIds`), секция песочницы (селекторы + delta-чипы + `exerciseSwap`), секция библиотеки (фильтры + сортировка). Персист `he_bb_diagnostics_hub_v1`. Deep-link `→ Качество/Объём` сохранён. Тесты `bb-diagnostics-hub.test.tsx` 8 (таб рендер, аудит пустой план, топ-3 прескрипшен, симΔ unilateral, apply weak+exercise, mobility→фильтр, swap delta).

### Эпик F — мост + BbAuto (1 день)
- `planner-bridge` расширение `weakpoints` payload (`preferredExerciseIds`, `exerciseSwap`), `BbAutoConstructor.tsx:1412` `BBBuilderInput.preferredExercises`, `selectExercisesSmart` приоритет, `rationale` строка. Тесты `bb-auto-exercise-bridge` 4 (preferred первым, fallback если не в пуле, swap одноразовый, mobility блокирует).

### Эпик G — скоринг + экспорт (0.5 дня)
- `bb-scoring.engine.ts` + `bb-diagnostics-hub.engine.ts` — `penExercise` + `penAngle`, `bb-diagnostics-export.engine.ts` — таблица «Упражнения → эффект» в HTML/CSV (XSS-esc). Тесты 3.

**Оценка:** A 1д + B 1д + C 1.5д + D 0.5д + E 2.5д + F 1д + G 0.5д = **~8 рабочих дней**. MVP (A+B+E аудит+прескрипшен) = **4 дня** — хаб уже полезен без симулятора.

---

## 10. Критерии PRO

- Все упражнения плана имеют SFR + profile + angleClass + fatigueCost (0 missing в аудите).
- Для каждой `weakZonesGranular` (1–2) — топ-3 упражнения с объяснением «почему» (SFR, lengthened, angle-гэп, unilateral при asym≥7%).
- `→ Применить` отправляет `preferredExerciseIds` + `weakPoints` в `BbAutoConstructor` и реально меняет выбор в `buildSession` (проверка: `preferredExerciseIds` присутствует в `BBPlan.weeks[0].sessions[].exercises[].exerciseName` после пересборки).
- Песочница показывает delta (SFR↑/fatigue↓) до применения — pure, без мутации.
- Скоринг учитывает `avgSFR` и `angleGaps` (7→9 пенальти, RSS сохранён).
- Читает только каноны (`EXERCISE_CATALOG`, `SFR_EXERCISE_DB`, `ANGLE_CLASSES`, `STRICT_EXERCISE_GROUPS`, `volume-landmarks`, `bb-balance`) — 0 дублей объёма/MRV/ACWR.
- Фильтр по `equipment` + `isMobilityRestricted` (`he_profile_v2`) — невозможные упражнения не рекомендуются.
- tsc 0, `vitest bb-diagnostics` **40+ зелёных** (эффект 6 + аудит 6 + прескрипшен 6 + симулятор 4 + hub UI 8 + bridge 4 + export 3), полный `bb` без регрессий.
- Экспорт HTML/CSV содержит таблицу «Упражнение → SFR/lengthened/эффект».

---

## 11. Осознанные остатки

- **Фото-AI оценка пропорций** — отложено (бэкенд/ML), в MVP — ручные окружности + DEXA импорт.
- **Видео-проверка техники упражнения** (Kinovea/BlazePose как в TA) — отложено; в MVP — линк `→ Суставы и ортопедия` + `buildExerciseInstructions` cues.
- **VBT per-exercise** (`bb-vbt.engine.ts:29`) — не на каждое упражнение, только global `lossPct` как в WL (достаточно для гипертрофии 20–25%).
- **Новый kind `bbExerciseSwap`** — отложен; в MVP — расширение `weakpoints`.

---

## 12. Риски

- **Перегруз низкоподготовленного** high-SFR изоляцией: прескрипшен ограничен `level` (beginner — меньше exotic, `bbExerciseTier`).
- **Нарушение STRICT_GROUPS**: `ensureStrictGroupCoverage` `bb-exercise-selection.engine.ts:291` уже гарантирует — прескрипшен не предлагает замену вне группы (фильтр `strictGroupForExercise`).
- **Объёмная модель**: `SFR`/`lengthened` — только приоритет выбора, не множитель `effectiveSets`/`Mrv` (инвариант сохранён, как в `bb-sfr-db.ts:10`).
