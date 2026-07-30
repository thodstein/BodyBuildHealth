# AGENTS.md - BioStackAIScreen + BB-builder

## Current project state (Jul 29 2026)

### Build status
- `tsc --noEmit` - 0 errors (entire project clean)
- `vite build` - OK (694+ modules)
- `vitest` - 434 passing (excl. `_tmp_*` regression files: 2 pre-existing failures in _tmp_legs_regression, unrelated)

### Git
- `origin/main` - tracked
- uncommitted changes: none (last commit 0fe1624a)

---

## Планировщик питания: error fix (in progress Jul 30 2026)

User reported: "не генерируется рацион - выбивает ошибку при нажатии" with `TypeError: cannot read properties of undefined (reading length)`.

Root cause (most likely): stale localStorage from previous app versions. When the planner's `useState` initializers called `JSON.parse(localStorage.getItem(...))` and the saved value was a string/number instead of an array (or any malformed shape), the state became a non-array, and downstream code that called `.filter/.map/.length` on it crashed.

Fixes applied (Jul 30 + Jul 30 continued):
- `planner-storage.ts`: new `readJSONSafe(key, fallback, validate)` helper + `migratePlannerStorage()` that auto-cleans 16 known planner keys whose JSON shape is expected to be an object/array; **also drops `null` values** (typeof null === 'object was passing through); **expanded migration to 27 keys** covering plan settings, UI prefs, and pharma data
- `IndividualPlanContext.tsx`:
  - runs `migratePlannerStorage()` once on mount (idempotent via `he_planner_schema_version` key, v4)
  - hardens 11 useState initializers (savedPlans, monthPlan, preferredFoods, excludedFoods, dietPrefs, allergens, healthIssues, lockedFoodIds, excludedCategories, takenSupplements, userRecipes) to validate Array.isArray and filter by `typeof === 'string'`
  - wraps "Сгенерировать план питания" click handler in try/catch so any future error shows in `errorMsg` UI
- `planner-preferences.ts:328`: `(f.id || '').toLowerCase()` defensive guard for missing f.id
- `meal-plan-engine.ts` already had `finally` cleanup of `_pickCtx` lock
- Refactored `addMacroTopUp` (was dead-code classic path) into clean helper function
- Added 3 new migration tests: corrupted scalar keys, null value dropping, preserved arrays/objects

Tests: 63/63 in NutritionScreen_parts/IndividualPlan/__tests__/ pass (added planner-storage.test.ts with 6 new tests).

---


### Годовое планирование (macrocycle.engine.ts)
- `buildMacrocycle(input)` — 5 фаз: endurance→strength→peak→competition→transition
- `macrocycleToActiveCycle(macro, week)` — активный cycleId на неделе N
- `rebalanceMacrocycle(macro, edits)` — ручная правка длительности фаз
- `serializeMacro`/`deserializeMacro` — localStorage
- `estimateCompetitionWeek(isoDate, total)` — неделя соревнований из даты
- `MacrocyclePanel.tsx` — UI: таймлайн, выбор недели соревнований, клик→применить цикл
- Вкладка `🗓 Годовой план` в ПЛ-авто (SRCBBScreen)

### Авторегуляция весов — 3 режима (AutoRegMode: 'off'|'auto'|'diary')
- **ВЫКЛ** — плановые веса без корректировки
- **АВТО** — readiness+HRV+ACWR+sleep+fatigue → topSetPctMultiplier/volumeMultiplier/rirShift (autoRegulate)
- **ДНЕВНИК** — per-exercise корректировка из последней сессии дневника (diary-autoreg.engine.ts):
  - fact RPE vs target RPE (10-plannedRir) → вес через loadForRPE(e1RM, targetRPE, reps)
  - factRPE ≥ 9.5 → -1 подход; delta > 2 → RIR +1
  - plateau: 3+ сессии без роста e1RM → plateauWarning + RIR +1
  - fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - нет данных → fallback на плановые веса
- Сегментированный переключатель в ПЛ и ББ секциях SRCBBScreen
- Применяется в: srcDays (SessionPlayer ПЛ), bbDaysArr (SessionPlayer ББ), BB-таблица SessionPlayer

### P0-багфиксы (done Jul 30 2026)
- BUG-1: `injectPLWeakPoints` — двойной `.filter` заменён на один fuzzy match (lms-builder.engine.ts:271)
- BUG-2: MRV soft-cap для light-day — пустой `if (ref) {}` заменён на реальную проверку (lms-builder.engine.ts:343)
- BUG-3: `cycleTemplateToFullProgram` — explicit weeks реализованы дословно вместо игнорирования (cycle-to-plan.ts:227)

### P1: buildLMSPlan интеграции (done Jul 30 2026)
- `LMSBuildInput` расширен: `acwr`, `autoReg`, `peds`, `pedDoses`
- ACWR-авто-делод: zone=caution → объём×0.85, RIR+1; zone=dangerous → объём×0.65, RIR+2, deload
- Авторегуляция: `topSetPctMultiplier` → к весам, `volumeMultiplier` → к объёму, `rirShift` → к RIR
- PED-адаптация: хардкод `pedMrvMult` заменён на `adaptForPEDs` (dose-aware) при передаче `peds`
- UI: `buildSrc()` передаёт `acwrData`, `autoRegResult` (при mode='auto'), `peds`, `pedDoses`
- Тесты: 6 новых в lms-planner.test.ts (ACWR caution/dangerous, autoReg weight/RIR, PEDs, комбо)

### P1: PL Taper (done Jul 30 2026)
- `applyPLTaper(weeks, totalWeeks)` — авто-taper к финальным 2 неделям (peaking phase)
- Финальная неделя N-1: объём ×0.65, RIR +1; неделя N: объём ×0.45, RIR +2
- Интенсивность (вес) сохранена (Bosquet 2005)
- Не применяется при: faithful (explicit weeks), ACWR deload, план < 4 нед
- Тесты: 5 новых (taper объём/RIR/rationale/ACWR-делод/faithful)

### P2: Тесты покрытия (done Jul 30 2026)
- `weakpoint-pl.test.ts` — 11 тестов (7 лифтов × слабые точки, fallback, WEAK_POINTS_BY_LIFT)
- `lms-selector.test.ts` — 10 тестов (rankCycles сортировка, direction/level/days score, selectBestCycle, explainSelection)
- `inject-pl-weakpoints.test.ts` — 6 тестов (инъекция ассистентов, day cap ≤8, weight >0, все недели)
- Удалён мёртвый `macrocycle-sources.ts` (не импортировался нигде)

### P3: Паритет с ББ (done Jul 30 2026)
- **Recovery multiplier**: `LMSBuildInput` расширен (`bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`)
  - Helms 2022, Plews 2022, Watson 2022: композиция тела + HRV + сон + стресс → MRV soft-cap
  - `combinedMrvMult = pedMrvMult × recoveryMult` — применяется к injectPLWeakPoints и weakGroup добивкам
  - UI: `buildSrc()` передаёт метрики из `linked.profile`/`linked.readiness`
  - Тесты: 3 новых (хорошие/плохие метрики, отсутствие меток)
- **sRPE feedback loop**: `lms-progression-feedback.engine.ts` — `computePLPlanFeedback(plan, sessions)`
  - Для каждого упражнения последней недели: последняя запись дневника → e1RM, fact RIR vs planned RIR
  - `prescribeLoad` (double_progression) с plannedRir → success-aware коррекция (RIR≥+2 → +reps, RIR≤-2 → -5% weight)
  - `summarizePLFeedback` — withFact/noData/plateau/avgRirDelta
  - Fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - Тесты: 7 новых (source fact/plan, fuzzy match, rirDelta, summary)
- **Double progression**: реализован через feedback loop (`prescribeLoad` strategy='double_progression')

---

## BB-builder: Priority 1 - RIR by training focus (in progress)

Goal: add `BBTrainingFocus` type (`'strength' | 'hypertrophy' | 'endurance'`) to control RIR/reps/tempo based on evidence 2022+.

Done so far:
- `bb-goal-types.ts` - created with `FOCUS_RIR_TABLE`, `FOCUS_REPS_TABLE`, `PHASE_TEMPO`, `LEVEL_REP_MOD`
- `bb-tempo-rest.ts` - `tempoFor()` accepts optional `phase` param (ACSM 2023: eccentric 2-4s)
- `bb-builder.engine.ts`:
  - Added `trainingFocus` + `bodyFat` + `leanMass` + `hrvMs` + `sleepHours` + `stressLevel` + `eccentricMult` + `calorieSurplus` + `proteinPerKg` to `BBBuilderInput`
  - `charReps()` now takes `focus` param - uses `FOCUS_REPS_TABLE`
  - `bbRir()` now takes `focus` param - uses `FOCUS_RIR_TABLE` (Roberts 2022, Schoenfeld 2021)
  - `buildSession()` now accepts `trainingFocus` and forwards to `bbRir`

Still needed:
- `buildSession()` call site in `buildBBPlan` (line ~1907) - needs `input.trainingFocus` passed
- `tempoFor()` call sites (4) - pass `phase` param
- `charReps()` call sites - pass `focus` param
- Compute recovery multiplier from `bodyFat/leanMass/hrvMs/sleepHours/stressLevel` → MRV adjustment
- Compute protein/calorie multiplier from `proteinPerKg/calorieSurplus` → MRV adjustment

---

## Ручной планировщик: доработка (done Jul 30 2026)

Связал три разрозненные системы фаз через мост + интегрировал годовое планирование + баг-фиксы.

### Баг-фикс: require() в ESM (Jul 30 2026)
- **BUG**: `ProgramManagerPanel` использовал `require('../../../engines/lms/macrocycle.engine')` для `deserializeMacro` — не работает в ESM/browser (vite), `macro` всегда null → годовое планирование не работало в ручном режиме.
- **Fix**: заменён на статический импорт `import { deserializeMacro } from '...';`.

### Баг-фикс: заглушки «Методики» (Jul 30 2026)
- **BUG**: inline-блок в `ProgramManagerPanel` (строки 1622-1686) — упрощённая заглушка с фильтром, без полных карточек.
- **Fix**: заменён на готовый `MethodologyEncyclopedia` компонент (ExpandableCard, категории, caveats, bestFor, ConjugateDesigner для Westside). Удалены неиспользуемые state `methCat`/`methSearch` и импорт `getTrainingMethods`.

### Годовое планирование: несколько соревнований (done Jul 30 2026)
- `macrocycle.engine.ts`:
  - `CompetitionEvent` тип: `{ id, name, week, date?, priority: 'A'|'B'|'C', notes? }`
  - `Macrocycle.competitions?: CompetitionEvent[]` — список соревнований
  - `MacroBlock.competitionId?: string` — связь блока с соревнованием
  - `buildMacrocycleMulti(events, input)` — авто-размещение peak/competition блоков под каждое соревнование
    - A (главное) → 4 нед peak + 1 нед competition
    - B (контрольное) → 2 нед peak + 1 нед competition
    - C (тренировочное) → встроено в подготовку, без отдельного блока
    - Между соревнованиями — strength/endurance (подготовка)
    - После главного (A) — transition 2-4 нед
  - `buildMacrocycle` с `input.competitions` → авто-вызов `buildMacrocycleMulti`
  - `serializeMacro`/`deserializeMacro` — сохранение/восстановление competitions (обратно-совместимо)
- `MacrocyclePanel.tsx`:
  - Менеджер соревнований: добавить/удалить/редактировать (название, неделя, приоритет)
  - Маркеры 🏁 на таймлайне для каждого соревнования (с приоритетом A/B/C)
  - Обзор соревнований под таймлайном
  - Одиночный режим (compWeek) сохранён для обратно-совместимости
- Тесты: 11 (macrocycle-multi.test.ts) — A/B/C приоритеты, сериализация, сортировка, обратно-совместимость

### Phase bridge (`src/engines/periodization/phase-bridge.ts`)
- `DESIGNER_TO_PHASE`: PhaseKey (10) → Phase (4) — коллапс 6 неканонических ключей
- `MACRO_TO_PHASE`: MacroPhase (5) → Phase (4)
- `designerPhaseToUserPhase()`, `macroPhaseToUserPhase()` — функции-мапперы
- `PHASE_TO_DESIGNER`, `PHASE_TO_MACRO` — обратные маппинги
- `isDeloadLikePhaseKey()`, `isDeloadLikeMacroPhase()` — deload-проверки
- Тесты: 12 (phase-bridge.test.ts)

### Designer → UserProgram (`src/engines/periodization/designer-to-program.ts`)
- `designerToUserWeeks(design, opts)` — конвертация MacrocycleDesign → UserWeek[]
  - По умолчанию: `sessions: []` (рендер из microcycleTemplate)
  - При `opts.fillExercises: true` — autodraftBBPlan на totalWeeks → weeks с упражнениями
  - Незакрытые недели → accumulation
- `applyDesignPhasesToWeeks(weeks, design)` — переразметка phase/deload в существующих неделях (сохраняет упражнения)
- `makeEmptySessionsForWeek(days)` — скелет пустых сессий
- Тесты: 11 (designer-to-program.test.ts)

### Macrocycle → BB program (`src/engines/lms/macrocycle-to-bb.ts`)
- `macrocycleToBBProgram(macro, opts)` — макроцикл ПЛ-авто → UserProgram (ББ)
  - autodraftBBPlan ОДИН раз на totalWeeks → createFromBuild → UserProgram
  - Переразметка weeks[i].phase через macrocycleToActiveCycle + macroPhaseToUserPhase
  - Для deload/peaking фаз — корректировка RIR (deload: +3, peaking: 0-1 для compounds)
  - Fallback: скелет с пустыми sessions при ошибке сборки
- Тесты: 6 (macrocycle-to-bb.test.ts)

### Bridge расширение (`planner-bridge.ts`)
- `PlannerApplyKind` += `'design'` | `'macrocycle'`
- PeriodizationDesignerTab: НОВАЯ кнопка «📥 Применить к новой программе» (kind='design')
  + кнопка «🏋️ Применить с упражнениями» (fillExercises=true)
  + sport селектор (powerlifting/bodybuilding/general/weightlifting/crossfit)
- ProgramManagerPanel.applyBridgePayload: новые case 'design' (к новой/текущей программе) и 'macrocycle' (ББ-программа)

### MacrocyclePanel в ручном планировщике
- `MacrocyclePanel.tsx`: снят `disabled` с level/goal селекторов (редактируемые через onLevelChange/onGoalChange)
- Storage migration v1→v2: если `kind` falsy → default 'SRC'
- Маркер текущей недели на таймлайне (вертикальная линия + input)
- ProgramManagerPanel:
  - `editorLibOpen` += `'macro'`
  - Кнопка «🗓 Годовой план» в secondary toolbar (isPro, все направления)
  - Модал с MacrocyclePanel: onApplyCycle для PL (loadCycleIntoEditor), BB (macrocycleToBBProgram), Hybrid (bbWeeks)
  - `mapGoalToMacro()` — маппинг goal UserProgram → goal MacrocyclePanel

### Баг-фиксы (Jul 30 2026)
- **BUG-6.1**: `addWeakToWeek` (`ProgramEditorComponents.tsx:103`) — добавлял слабые группы только в week 0. Исправлено: добавляет во все недели (кроме deload), с уникальными id блоков для каждой недели.
- **BUG-6.2**: `PLSetEditor.calcW` (`ProgramEditorComponents.tsx:714`) — для accessory использовал `workMax['squat']` (абсурдные веса для трицепса). Исправлено: для accessory возвращает `null` (вес вводится вручную).
- **BUG-6.3**: `sendToExecution` (`ProgramManagerPanel.tsx:1204`) — regex `/жим/i`, `/тяг/i` для определения лифта. Заменён на `detectLift(name, group)` из `lms-to-pl.ts`.
- Тесты: 5 (program-editor-bugs.test.ts) + 3 (macrocycle.migration.test.ts)

### Связь с ПЛ-авто (что НЕ ломаем)
- MacrocyclePanel в SRCBBScreen — продолжает работать как вкладка
- buildLMSPlan, lms-builder.engine.ts, lms-to-pl.ts, weakpoint-pl.ts, diary-autoreg.engine.ts — не тронуты
- macrocycle.engine.ts — не тронут (только импортируем deserializeMacro для hybrid-ветки)

---

## Architecture

### BB engine files
| File | Role |
|------|------|
| `bb-builder.engine.ts` | Main BB plan generator |
| `bb-split-patterns.ts` | 16 split definitions |
| `bb-day-types.ts` | Day character, TAG_MUSCLES, ROTATION_PAIRS |
| `bb-tempo-rest.ts` | Tempo/rest specs |
| `bb-autocoach.engine.ts` | Post-phase processing, feeders, deload protocols |
| `bb-metrics.engine.ts` | Plan metrics (heavy%, pump%, MRV checks) |
| `bb-goal-types.ts` | BBTrainingFocus + evidence RIR/reps tables |
| `bb-ped-adaptation.engine.ts` | PED MRV boost |
| `bb-session-order.engine.ts` | Exercise ordering by layer |
| `bb-weakpoint.ts` | Weak-point diagnostics |
| `bb-progression-feedback.engine.ts` | sRPE feedback loop |
| `cycle-to-plan.ts` | Cycle template → BB plan converter |

### ПЛ-авто engine files
| File | Role |
|------|------|
| `lms/macrocycle.engine.ts` | Годовое планирование (5 фаз, СРЦ-циклы) |
| `lms/lms-selector.engine.ts` | Скоринг-подбор СРЦ-цикла |
| `lms/lms-builder.engine.ts` | Генерация плана из шаблона недели 1 + PM-прогрессия |
| `lms/lms-progression.engine.ts` | PM_нед = PM0×(1+k)^нед |
| `lms/weakpoint-pl.ts` | Диагностика слабых точек СРЦ-движений |
| `pro/autoregulation-pro.engine.ts` | Проф-авторегуляция (readiness+HRV+ACWR) |
| `pro/diary-autoreg.engine.ts` | Per-exercise авторегуляция из дневника |
| `lms/lms-progression-feedback.engine.ts` | sRPE feedback loop (дневник → план) |

### SPLIT_PATTERNS (16)
- 3 fullbody variants (2×/3×/4× per week)
- 3 upper/lower variants (3×/4× per week + PHUL)
- PPL 6×, Arnold 6×, Bro 5×, PRO 8-day
- 3 rolling patterns (3/1/3/1, 4/1, ТПТ-О-ТТП)
- Push/Pull 4×, Torso/Limb 4×, Glute Focus 4×
