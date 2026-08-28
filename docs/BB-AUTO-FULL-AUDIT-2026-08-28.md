# ББ-авто — полный аудит и план доработки 2026-08-28

> **Цель:** полноценный профессиональный генератор циклов по бодибилдингу. Каждая кнопка UI даёт след в `BBPlan`, отчёт честен, капы соответствуют уровню/фарме/восстановлению, методики evidence-based, 0 `valid=false` на валидных входах.
> **База:** `src/engines/bb/` 37 движков + `src/core/exercise-catalog.ts` 620 записей + `BbAutoConstructor.tsx:5809` (8 шагов) + 144 тест-файла. Предыдущий аудит Aug 27: 1692/80 → 1772/1773 (1 чужой WIP `bb-macrocycle.test.ts`). Текущий прогон Aug 28: **3 регрессии PPL** (`ppl_6/ppl_3/ppl_rest_ppl` 11>10) — десинхрон теста с `sessionLimitsFor` PPL 12/32, валидатор зелёный.

---

## 0. Текущее состояние и инварианты

| Метрика | Значение |
|---|---|
| Движков | 37 (`bb-*.engine.ts`) + `hybrid-plan` + `cycle-to-plan` |
| Сплитов | 25 `SPLIT_PATTERNS` (`src/engines/bb/bb-split-patterns.ts:30`) |
| Путей генерации | 4: `generic buildBBPlan` / `cycle adapt+faithful` / `program adapt+faithful` (`cycle-to-plan.ts:800`) |
| Параметров `BBBuilderInput` | 44 поля (`bb-builder.engine.ts:84`) |
| Каталог | 620 записей, 584 уникальных `id` (36 дублей), `legs 184` перегружен |
| Валидатор кодов | 23 (`bb-validator.engine.ts:76`) |
| Тестов | 144 файла, ~1773 `bb` (до Aug 27) |
| `tsc` | 0 по своим файлам (7 чужих WIP `IndividualPlanContext`) |
| Регрессии сейчас | 3 PPL `expected 11 ≤10` — тест хардкодит 10, `bb-volume.engine.ts:178` даёт PPL 12/32 для non-enhanced |

**Ключевой инвариант:** `validateBBPlan.valid = issues.every(i.level!=='error')`. `effective_mrv_overflow` — warning (×1.15 допуск), не ломает `valid`. `session_exercise_cap` — error (ломает). Нужно синхронизировать тест-ожидания с `sessionLimitsFor`.

---

## 1. Архитектура — что проверено

### 1.1 Ядро генерации `bb-builder.engine.ts:1` (~4261 стр)

`BBBuilderInput` → `landmarksForRotation` (MEV/MAV/MRV по `volume-landmarks.engine`) → `regimeMrvMult` (PED) → `recoveryMult` → `mrvByMuscle` → `scaledVolumeRotation` (цель объёма per-muscle per-rotation) → `computeMuscleSets` → `buildSession` (47 positional → `BuildSessionParams` нужен) → `compensateCrossDayWeakPoints` → `finalizeBBPlan` → `validateBBPlan` + `buildBBPlanReport` + `calcBBPlanMetrics`.

**Критично:** `TAG_MUSCLES` (`bb-day-types.ts:47`) определяет `primary/accessory`, `FORCE_HEAVY_GROUPS` (`bb-day-types.ts:35`), `ROTATION_PAIRS`, `PHASE_CONFIGS` (`bb-goal-types.ts:32`), `distributePhases` (единый источник RIR/фаз/deload).

### 1.2 Объёмная модель `bb-volume.engine.ts:1`

`normalizeBBMuscle` → `IGNORE_BUDGET_MUSCLES` → `computeRegimeMrvMult`/`regimeMrvMultFor` → `computeBBRecoveryScore:78` + `recoveryScoreToMult:111` (score 0–100 → 0.7-1.1) vs `computeBBRecoveryMultiplier:188` (перемножение bodyFat/leanMass/hrv/sleep/stress → 0.6-1.5) vs `bb-builder:2747` inline копия — **тройной источник** (`src/engines/bb/bb-volume.engine.ts:78` vs `:188` vs `bb-builder.engine.ts:2747`).

`computeBBWeeklyBudget:132` (`base 112×regime` магическое), `sessionLimitsFor:149` (natural 24/10, enhanced 1-2г 40/14, enhanced 3+ 60/18, PPL ≥32/12), `perExerciseCap:205` (8 для enhanced+3г+back/chest/quads, иначе 5) vs `normalizeWeekMrv:954` хардкод 5 — рассинхрон.

`buildBBVolumeTarget:265` двойной clamp `0.6-1.1` съедает `1.15-1.5`, `indirectMuscleContributions:300` (bench 0.45 triceps/0.20 shoulders константы), `aggregateBBVolume:367`, `computeMuscleBalance:422`.

### 1.3 Финализация `bb-finalize.engine.ts:1` (~3807 стр)

`WEAK_PATTERN_REQ:26`, `tradeoffDonorsForWeek`, `ensureWeakPatternCoverage`, `allocateExperiencedBackSession`, `ensureBackBalance`, `allocateExperiencedArmSession`, `ensureLegHeavyBlock:500`/`ensureLegPumpBlock`/`ensureGlutesBlock`/`allocateExperiencedLegSession:661`, `diversifyExperiencedChestSession:710`, `ensurePPL*`, `addWarmupActivator:1814`, `repairBackFrequency:1910`, `enforceSessionExerciseLimit:2183`, `markAntagonistSupersets`/`markSameMuscleSupersets`/`markPreExhaustPairs`/`markGiantSets`, `applyVolumeScheme`, `addAdaptiveMEVFeeders:2443`, `applyControlledAccessoryRotation`, `repairAdaptiveSafety`, `enrichExerciseRationale`, `finalizeBBPlan:3784`, `autoAssignIntensityTechniques:3749`, `applySpecializationPass`.

### 1.4 Конвертеры `cycle-to-plan.ts:1` (~2295 стр)

`programToCycleTemplate`, `cycleTemplateToFullProgram:239`, `convertCycleToBBPlan:809` (35 полей), `programToBBPlan:1531` (33 поля), `replacePLForBB:594`, `muscleGroupFromExName:436`, `findReplacementForCycle:764`, `parseWorkSetSpecs:1505`, `classifySessionTag:742`, `calcWorkMaxForEx:516`.

### 1.5 Остальные 33 движка

`bb-day-types`, `bb-split-patterns`, `bb-selector`, `bb-goal-types`, `bb-tempo-rest`, `bb-autocoach`, `bb-dup`, `bb-intensity-techniques`, `bb-rep-schemes`, `bb-specialization`+`registry`+`tradeoff`, `bb-fatigue`, `bb-progression-feedback`, `bb-contest-prep`, `bb-mesocycle-progression`, `bb-exercise-selection`+`tier`+`rotation`+`instructions`, `bb-balance`, `bb-safety-score`, `bb-validator`, `bb-report`, `bb-session-order`, `bb-loading-layer`, `bb-mobility`, `bb-ped-adaptation`, `bb-demographics`, `bb-types`, `hybrid-plan` — см. §2-4.

---

## 2. P0 — критические баги (блокер / тихий неверный план / травмоопасно)

### 2.1 Ядро объёма и капов

| # | Файл:строка | Баг | Фикс | Источник |
|---|---|---|---|---|
| P0-V1 | `bb-volume.engine.ts:78` vs `:188` vs `bb-builder.engine.ts:2747` | Тройной recovery-множитель: `computeBBRecoveryScore` (0.7-1.1) vs `computeBBRecoveryMultiplier` (0.6-1.5) vs inline копия builder — один профиль `sleep 5ч stress 9` даст 0.85 vs 0.70, `sessionLimitsFor` берёт первый, builder второй | Единый `computeBBRecoveryMultiplier` из `bb-volume`, удалить дубли | Ядро-аудит |
| P0-V2 | `bb-volume.engine.ts:205` vs `bb-builder.engine.ts:954` vs `bb-finalize.engine.ts:3407` | `perExerciseCap` 8 для enhanced 3+ `back/chest/quads`, но `normalizeWeekMrv` форсит 5 → недобирает 3 сета/упр для enhanced спины | Унифицировать: `perExerciseCap` — единственный источник, убрать хардкод 5 | Ядро-аудит |
| P0-V3 | `bb-builder.engine.ts:482` / `bb-finalize.engine.ts:481` | `heavyQuads \|\| true` — мёртвый код, ветка всегда выполняется, `heavyQuads` не влияет | `if (heavyQuads)` или удалить условие | Ядро-аудит |
| P0-V4 | `bb-builder.engine.ts:3023` vs `:2712` | `planStartWeek` per-week травмы `weekDate = addDays(planStartWeek, (w-1)*7)` vs `excludedMuscles` по `today` — на нед 10 травма «зажила» но `muscleSessionCount` посчитан неверно | Per-week `getExcludedMuscles(weekDate)` везде | Ядро-аудит |
| P0-V5 | `bb-volume.engine.ts:178` vs тесты `bb-generation:33` | PPL лимит 12/32 (`isPPL && level!=='enhanced' → 32/12`) централизовано, но 3 теста хардкодят `≤10` → ложный фейл 11>10, маскирует реальный `valid` | Заменить `expect(≤10)` на `sessionLimitsFor({level,trainingYears,patternId}).maxExercises` | Тест-аудит |
| P0-V6 | `bb-builder.engine.ts:875` `perExerciseCap` | `buildBBPlanWithDUP` не прокидывает? — `finalizeBBPlan` cap 5 vs `computeMuscleSets:1190` enhanced минимумы ×5 кап `max(1,min(5,22))→5` (срез 22→5) — двойное назначение `sets` | `perExerciseCap` до `max(sets,...)` перенести | Ядро-аудит |

### 2.2 Травмы / безопасность / мобильность

| # | Файл:строка | Баг | Фикс |
|---|---|---|---|
| P0-S1 | `cycle-to-plan.ts:859` / `:1640` | Per-week травмы однодневные: `getExcludedMuscles(injuries, today)` для 12-нед программы — ноги исключены все 12 нед вместо 4 | Per-week `addDays(week-1)*7` как в `bb-builder:3023` |
| P0-S2 | `bb-finalize.engine.ts:2183` | `enforceSessionExerciseLimit` режет специализацию: `candidates = working.filter(isoRemovable).sort(by sets)` — `chest_upper incline 3` (цель) vs `chest fly 5` → удалится цель | Приоритет `specializationSchedule` — не удалять `isSpecializationTarget` |
| P0-S3 | `bb-finalize.engine.ts:3784` vs `:3407` | Двойной кап `mrvByMuscle`: builder → `normalizeWeekMrv:3288` (direct) + `CAP_MUSCLES finalize:3407` (effective включая indirect 0.2×bench) → `shoulders direct 12 + indirect 4 =16 >13×1.05` срежет direct до 9 хотя direct в лимите | Единый кап effective, убрать двойной |
| P0-S4 | `bb-finalize.engine.ts:500` | `findCatalog` игнор `excludedExercises` по name: `options.excludedExercises?.includes(x.id)` — UI `['Гакк-приседания']` не сработает | Проверка по `id` и `name` (norm) |
| P0-S5 | `bb-exercise-instructions.engine.ts:220` | Приоритет `hasLabBio \|\| target ? 'exercise-lab' : id \|\| exists ? 'catalog'` — любой `exerciseId='anything'` → `'catalog'` даже если нет в каталоге | `EXERCISE_CATALOG.some(...) ? 'catalog':'generic'` без `id\|\|` |

### 2.3 PED и фармакология

| # | Файл:строка | Баг | Фикс |
|---|---|---|---|
| P0-P1 | `bb-ped-adaptation.engine.ts:174` | `parseDose` не конвертит `г→мг`: `"1.5г"→1.5` вместо 1500 → курс 1г теста =1мг в модели | `г→мг ×1000`, `мкг→мг /1000` |
| P0-P2 | `bb-ped-adaptation.engine.ts:69` | `tEq` не используется для MRV: `PED_META.AAS.tEq=1.0` коммент Tren 2.5×, но `interpolateDose` на сырых mg, `aasTEquiv` только для risk warning → 500мг Tren=500 а не 1250 T-equiv, занижение MRV 10-15% | `mg → T-equiv` перед lookup |
| P0-P3 | `bb-autocoach.engine.ts:271` | `DEFAULT_TECHNIQUE_BY_PHASE` интенсификация `rest_pause` без MRV-капа: `applyIntensityTechniqueToExercise:294` добавляет +2 сета/упр ×5 =+10/нед вне капа | Гейт `MRV/session cap` перед добавлением |
| P0-P4 | `bb-dup.engine.ts:73` | Shallow copy `workSets: [...e.workSets]` → `ws.rir=...` мутирует оригинал plan (нарушение immutability, баг при повторной сборке) | Deep clone `workSets.map(ws=>({...ws}))` |
| P0-P5 | `bb-dup.engine.ts:98` | Вес не пересчитан под новый rep-диапазон: 6→15 без снижения веса → RIR -5 травма | `weight = workMax * PCT_FOR_RIR(rir,reps)` |
| P0-P6 | `bb-tradeoff.engine.ts:71` | `floor = max(1, round(mev*mult))` блокирует `donorFloorMult=0`: донор всегда оставляет 1 сет, `remove_direct_when_indirect_covers_floor` не даёт 0 | `donorFloorMult===0 ? 0 : max(1,...)` |
| P0-P7 | `bb-progression-feedback.engine.ts:170` | Хардкод `phase='intensification'` для `prescribeLoad` — deload неделя пропишет +5% вместо -5% | `phase = wk.phase \|\| lastWeek.phase` |
| P0-P8 | `bb-contest-prep.engine.ts:688` | Water load 9.2л/день classic `w*0.115` → 80кг 9.2л, Helms 2022 minimal 3-4л constant — гипонатриемия, case reports смерти | Дефолт `minimal` 3-4л, `classic` требует `confirmedManipulation` + warning + кап 5л |
| P0-P9 | `bb-contest-prep.engine.ts:719` | Show day water 0.25л (0.5 жен) → острая дегидратация, почечный риск | Минимум 1.0л, `confirmedManipulation` gate |
| P0-P10 | `bb-contest-prep.engine.ts:592` | Кэш `peakWeekCached` ключ без `bodyFat/ghIU/trenMg` → GH 8IU и натурал одинаковая вода | Расширить cache key |
| P0-P11 | `bb-contest-prep.engine.ts:687` | BSA высота фикс 170см `sqrt((w*170)/3600)` — 195см 100кг и 165см 100кг одинаковая вода, ошибка 15% | Брать `personal.height` |

### 2.4 Селекция и каталог

| # | Файл:строка | Баг | Фикс |
|---|---|---|---|
| P0-C1 | `bb-exercise-selection.engine.ts:222` | Strict группы `ham_hack ids ['hack_squat_ham','well_squat']` — если каталог переименует id, `poolMembers 0` → группа тихо не применяется, без ошибки | Валидация `STRICT_EXERCISE_GROUPS` на старте: `id∈catalog` иначе throw |
| P0-C2 | `bb-mesocycle-progression.engine.ts:48` | `peakWeek` вычисляется но не используется: `peakWeights/previousVolume` по всем неделям, deload single тоже попадёт → завышен base | `peakWeek` для `peakWeights` (а не все недели) |
| P0-C3 | `bb-builder.engine.ts:1331` fallback пул | `buildExercisePool` fallback игнор `excludeIds`? Нет, но `equipmentList` пустой при `bodyweight-only` → пул пуст → фейк-упр `{id:muscle, name:muscle}` | Fallback должен проверять `equipmentList` и кидать `ValidationError` если 0 |
| P0-C4 | `src/core/exercise-catalog.ts:1` | 36 дублей `id` (30 уникальных по 2-3 раза: `donkey_calf_raise`, `hack_squat`, `leg_press`, `rdl`, `pulldown`, `face_pull`...), `find(id)` вернёт первую, вторая недостижима, граф замен ломается | Линтер `id` уникальности в pre-commit, дедуп каталога |

---

## 3. P1 — важные (субоптимально / методически неверно)

### 3.1 Объём и периодизация

- `bb-volume.engine.ts:132` `base 112×regime` магическое, сумма MRV enhanced 250-280 ≠224, `weeklyWorkingSets` vs `maxWorkingSets×sessions` противоречивы (`bb-volume.engine.ts:132`)
- `bb-volume.engine.ts:178` PPL-хардкод `split.id.includes('ppl')` раздувает лимит для `ppl_rest_ppl` и `rolling_4_1` одинаково — должен зависеть от числа групп, не подстроки (`bb-volume.engine.ts:178`)
- `bb-volume.engine.ts:265` `buildBBVolumeTarget` clamp `0.6-1.1` съедает PED 1.15-1.5 (builder обходит передавая 1.0) (`bb-volume.engine.ts:265`)
- `bb-volume.engine.ts:300` `indirect` коэфф константы, `aggregateBBVolume` effective vs `normalizeWeekMrv` direct — два определения overflow (`bb-volume.engine.ts:300`)
- `bb-day-types.ts:47` `FullBody` неполный `['chest','back','quads','hamstrings','shoulders','biceps','triceps']` без `traps/calves/abs/glutes` → фикс через `fill` finalize (`bb-day-types.ts:47`)
- `bb-day-types.ts:67` `ROTATION_PAIRS` затенение `shoulders↔delt_mid` недостижим второй `delt_front↔delt_mid` (`bb-day-types.ts:67`)
- `bb-split-patterns.ts:252` `upper_lower_3` id 3 vs name 4× — вводит в заблуждение; `level ['II-KMS']` токен не в `normLevel` (`bb-split-patterns.ts:252`)
- `bb-selector.engine.ts:78` `daysPerWeek` инвертирован `overage = eff - input` → `input 6 eff 3 → overage -3 → +25` рекомендует `fullbody_2` для 6 дней — должен `abs(eff-input)` симметрично (`bb-selector.engine.ts:78`)
- `bb-selector.engine.ts:184` PED-детектор `peds.includes('GH')` точное vs `pedDoses['AAS']>=500` разные источники → 250мг AAS нет бонуса, `тестостерон` без дозы есть (`bb-selector.engine.ts:184`)
- `bb-selector.engine.ts:208` injury-штраф считает `freq['legs']=0` (нет тега `legs`), хотя `ppl_6 Legs 2×` — не штрафует травмированные ноги (`bb-selector.engine.ts:208`)
- `bb-builder.engine.ts:753` `PCT_FOR_RIR` вычисляется но не используется, вес только `brzycki×rirAdj` — расхождение 33% (`bb-builder.engine.ts:753`)
- `bb-builder.engine.ts:890` `gluteBoost ×1.2` только `muscle==='glutes'`, hamstrings синергист нет — дисбаланс задней цепи female (`bb-builder.engine.ts:890`)
- `bb-builder.engine.ts:1190` `max(1,min(5,22))→5` enhanced минимумы срезаются капой (`bb-builder.engine.ts:1190`)
- `bb-autocoach.engine.ts:63` `machine_compound` считается изоляцией → `repCap 15` вместо 12 для жима ногами в Смите (`bb-autocoach.engine.ts:63`)
- `bb-autocoach.engine.ts:661` `distributePhases(totalWeeks,...,'mass')` хардкодит `mass` для `cut/recomp` (`bb-autocoach.engine.ts:661`)
- `cycle-to-plan.ts:594` `stripped` съедает кириллицу неоднозначно, `isBBPosteriorChain` vs `isDeadliftVariantRaw` дубль-логика (`cycle-to-plan.ts:594`)
- `cycle-to-plan.ts:764` `findReplacementForCycle` без `bbExerciseTier>2` → `bench_press_reverse_grip` tier 4 может вернуться (`cycle-to-plan.ts:764`)
- `bb-progression-feedback.engine.ts:529` UTC Monday `toISOString` для MSK сдвигает неделю, ACWR скачет (`bb-progression-feedback.engine.ts:529`)
- `bb-progression-feedback.engine.ts:544` ACWR по `sets` не по `volumeLoad` (Gabbett sRPE×duration) (`bb-progression-feedback.engine.ts:544`)

### 3.2 Цели и темпо

- `bb-goal-types.ts:32` `pumpRir 4-5` мусорный объём, Schoenfeld 2021 RIR 0-3 для гипертрофии (`bb-goal-types.ts:32`)
- `bb-goal-types.ts:31` `strength base 1` в accumulation → W1 1 W3 0, должен 2-3 (Grgic 2021) (`bb-goal-types.ts:31`)
- `bb-goal-types.ts:72` `FOCUS_PHASE_OVERRIDES volumeMultiplier` peaking 0.55/0.65 не едино, Bosquet 40-60% для всех (`bb-goal-types.ts:72`)
- `bb-tempo-rest.ts:8` `тяж 2-1-1-0` и `памп 3-0-1-0` оба 4с TUT нет дифференциации; `REST тяж 180с` мало для 3-6 @RIR1 нужно 240-300с; `лег 90с > памп 60с` инверсия (`bb-tempo-rest.ts:8`)
- `bb-tempo-rest.ts:83` `tempoFor` игнор override в deload — мёртвая ветка (`bb-tempo-rest.ts:83`)
- `bb-specialization.engine.ts:187` `specializationMrvFactor +20-30%` противоречит комменту «внутри капов» (`bb-specialization.engine.ts:187`)
- `bb-specialization.engine.ts:160` `specializationVolumeFactor 0.7` для нецелевых → `biceps MAV8→5.6 <MEV6` атрофия (`bb-specialization.engine.ts:160`)
- `bb-fatigue.engine.ts:39` axial не приоритизируется при обрезке — присед и жим одинаковый score при `axial>16` (`bb-fatigue.engine.ts:39`)
- `bb-contest-prep.engine.ts:273` `shoulders` specialization `delt_mid` mismatch → per-muscle taper не срабатывает (`bb-contest-prep.engine.ts:273`)
- `bb-contest-prep.engine.ts:242` `carbLoad 7-8г/кг` для `mens_bb` 640г — Schoenfeld 4-6г достаточно, 8г залив (`bb-contest-prep.engine.ts:242`)

### 3.3 Селекция и UI

- `bb-exercise-selection.engine.ts:137` `rotationNames` точное `e.name` рус — смена пунктуации мимо; `ensureStrictGroupCoverage:324` same-class gate узкий без fallback (`bb-exercise-selection.engine.ts:137`)
- `bb-exercise-tier.engine.ts:63` `joint high` до `CANONICAL_PATTERNS` → `Тяга в наклоне` tier 3 exotic вместо 1 (`bb-exercise-tier.engine.ts:63`)
- `bb-exercise-rotation.engine.ts:85` `useCount` считает будущие недели >currentWeek (`bb-exercise-rotation.engine.ts:85`)
- `bb-balance.engine.ts:71` `lower_back|traps|abs` считает как upper → искажает pull/press ratio (`bb-balance.engine.ts:71`)
- `bb-safety-score.engine.ts:208` `volumeViolations` per-week-muscle `+12` вместо +1 unique → `15-36=-21→0` (`bb-safety-score.engine.ts:208`)
- `bb-validator.engine.ts:149` `TAG_MUSCLES` leak `ChestBack|ShouldersArms` undefined → leak не ловится (`bb-validator.engine.ts:149`)
- `bb-report.engine.ts:150` `peakWeek` может быть deload → регресс -15% в отчёте (`bb-report.engine.ts:150`)
- `bb-session-order.engine.ts:292` `backCap 4` дефолт срезает enhanced 6+ должен 6 (`bb-session-order.engine.ts:292`)
- `bb-loading-layer.engine.ts:108` `restProgression` `max(60)` даёт 60с для тяж на нед 8 — мало, нужно `max(90, heavy)` (`bb-loading-layer.engine.ts:108`)
- `BbAutoConstructor.tsx:559` `autoRegOn` мёртвый параметр — state без toggle, `autoRegPayload:1575` всегда undefined, ACWR-делод только через `labAdjust` (`BbAutoConstructor.tsx:559`)
- `BbAutoConstructor.tsx:540` `proPreset` не прокидывается в `buildBBPlan`, не сохраняется в `handleSaveVariant:1906` → теряется (`BbAutoConstructor.tsx:540`)
- `BbAutoConstructor.tsx:2961` vs `:2624` `bbEquipment` дублируется два UI-блока один state (`BbAutoConstructor.tsx:2961`)
- `BbAutoConstructor.tsx:1659` `focusGroup ''` хардкод, `rankBBSplits {focusGroup: specTargets[0]}` vs `buildBBPlan {focusGroup:''}` расходятся (`BbAutoConstructor.tsx:1659`)
- `cycle-to-plan.ts:875` `pedAdapt` считается до `mode` чека — `faithful` всё равно `×1.15` хотя ожидает дословно (`cycle-to-plan.ts:875`)

---

## 4. P2 — качество / техдолг / brittleness

- `bb-types.ts:76` `level?: string` вместо `TrainingLevel|BBLevel`, `muscle: string` вместо `Muscle` union — скрывает `legs` vs `quads` баги
- `bb-volume.engine.ts:29` `IGNORE_BUDGET` vs `SECONDARY_FIXED` противоречат builder бюджету
- `bb-split-patterns.ts:468` legacy `ppl_6day→ppl_6` хардкод 2 id, остальные не покрыты
- `bb-selector.engine.ts:73` `avgFreq` считает теги не мышцы, `Push 1.7` бесполезно
- `bb-builder.engine.ts:1875` `primaryBySlot` ключ `phase|tag|muscle` без `phaseWeek` — intensification W1 и W3 делят слот
- `bb-builder.engine.ts:1317` `dedupeMuscles` инжекция `focusGroup` `glutes` в `Chest` день → жим фильтр вырежет но `sets` уже выделен
- `bb-finalize.engine.ts:710` `diversifyExperiencedChestSession` теряет RIR `rearDelt RIR3 → lateral RIR2`
- `bb-autocoach.engine.ts:540` `/push/` матчит `pushdown` compound false
- `bb-rep-schemes.engine.ts:266` `schemeToLoading` midpoint теряет вариативность
- `bb-specialization-registry.ts:154` `matchesAnyZonePattern` без `ё→е` нормализации
- `bb-fatigue.engine.ts:47` `timeSeconds = reps*4+rest` игнор `tempoFor` (3с vs 7с ошибка 2×)
- `bb-exercise-rotation.engine.ts:117` `COOLDOWN_WEEKS 30 / MAX_REPEATS 31` хардкоды несовместимы с 8-нед планом
- `bb-exercise-instructions.engine.ts:39` `EXERCISE_ID_ALIASES` 3 id, 559 via `getMappedBioId` miss → generic шаблон
- `bb-balance.engine.ts:65` `isCompound` без `role` → `pullover_lat_iso` завышает compound
- `bb-safety-score.engine.ts:150` ступенчатый `jointStressScore` скачок 10 баллов на 0.1
- `BbAutoConstructor.tsx:139` `PHASE_TECHNIQUES` мертва, `TAG_LABELS_RU:133` дубликат `bb-labels.sessionTagLabel`
- `BbAutoConstructor.tsx:549` `weakPoints` зеркало `specTargets` лишний ре-рендер, должен `useMemo`

---

## 5. Параметрическая полнота — «кнопка даёт след»

| Параметр UI | В движок? | Проблема | Приоритет |
|---|---|---|---|
| `bbLevel` / `bbTrainingYears` | ✅ | `beginner+10лет` → лимиты advanced, тиры beginner конфликт | P1 — валидация `level` vs `years` |
| `bbGoal` | ✅ | `goal_focus_mismatch` warning only, нет блока `cut+strength>6нед` | P1 |
| `bbDays` (3-6) | ⚠️ косвенно | `rankBBSplits({daysPerWeek:bbDays})` рекомендует, но `buildBBPlan` берёт только `patternId` — пользователь 6 дней + `fullbody_3` → 3× без предупреждения | P1 — warn если `pattern.sessionsPerRotation×7/rotationDays < bbDays-1` |
| `bbWeeks` 4-24 | ✅ | Нет clamp на `ctx.weeks NaN→NaN` (`annualBlockCtxToPrepPatch:251`) | P0 — `clamp(4,24)` + `isFinite` |
| `trainingFocus` | ✅ | `pumpRir 4-5` мусор, `reps` не дифференцирован | P0 |
| `loadStrategy` | ✅ | `linear 1.0→0.5` скачок 2× нефизиологичен (`bb-autocoach:73`), `rpe_based` игнор `FOCUS_RIR_TABLE` (`bb-autocoach:85`) | P1 |
| `autoDeload/deloadType` | ✅ | Deload объём не режется в `macrocycle-to-bb` (только RIR) | P1 — `Math.ceil(sets*0.6)` |
| `intensityTechnique` | ✅ | `autoAssignIntensityTechniques` gated `level!=='beginner'` но `specialization` требует `RIR0` — недонагрузка | P1 |
| `bbMethodology` | ✅ | `post_exhaust` tier 1 isolation перед compound — работает, но `enforceSessionExerciseLimit` может удалить pre-exhaust isolation | P1 — тест 5 weakPoints |
| `dupMode` | ✅ post-overlay | Shallow copy + вес не пересчитан (P0) | P0 |
| `supersetMode` | ✅ | `supersetWith` в `BBExercise` + `bb-finalize` маркирует, но `bb-intensity:superset` дублирован | P1 — унифицировать |
| `volumeScheme` | ✅ effective | `gvt/fst7/gironda/bfr` gate `pattern.id:2507` — не для всех сплитов | P1 — убрать gate |
| `calorieSurplus/proteinPerKg` | ✅ | Нет конфликта `cut +500` warning | P2 |
| `eccentricMult` | ✅ | Увеличивает вес 20% но `mrvByMuscle` не растёт → `effective_mrv_overflow` (`bb-builder:1315`) | P1 — `mrvMult × eccentricMult^0.5` или cap-adjust |
| `fewerCompound` | ✅ | Только на `buildExercisePool`, не на `sessionShareFor` | P2 |
| `allowStrengthLifts` | ✅ | Только 20% тест-покрытия, `strength_mass` only | P1 — добавить тесты |
| `rotationMode` | ✅ | `forbid/strict/variety` 50% покрытия, `strict` без assert 4-нед | P1 |
| `avoidAxialLoad` | ✅ | Fallback пул тоже фильтрует — Legs 8 вместо 12 при `machine+axial` | P1 |
| `intensityLevel` | ✅ | 80% покрытия | OK |
| `peds/pedDoses/courseIntensity` | ✅ | `tEq` и `g→мг` баги (P0) | P0 |
| `proPreset` | ❌ мёртвый | `setDupMode/setSupersetMode/setVolumeScheme` побочно, не пишется в `inputSnapshot`, `handleLoadVariant:1981` теряет | P1 — persist в `params` |
| `bfrMode` | ✅ | 0% тест-покрытия, `tempoFor` не меняет `pct1RM` 20-30% | P1 |
| `blastCruiseEnabled` | ✅ | 0% тестов, `mrvByMuscle` не масштабируется `blastMult` → blast overflow | P1 |
| `workMax` 10 ключей | ✅ | `lower_back` fallback 80кг шум, `workMax 1000` без upper bound | P1 — `DEFAULT_WORKMAX lower_back` + `weight>500 → cap` |
| `specBlocks/specTargets` | ✅ | `spec-block-${length+1}` коллизия после удаления (`BbAutoConstructor:457`), `self-donor` не тестируется | P0+P1 |
| `injuries` | ✅ | Per-week expiry только builder, cycle путь однодневные (P0) | P0 |
| `mobilityRestrictions` | ✅ | 70% покрытия, нет `knee` паттерна | P1 |
| `bbEquipment` | ✅ | Дубль UI-блока, `bodyweight` bypass не тестируется | P1 |
| `bbFavEx/bbExclEx` | ✅ | 40% покрытия, нет `fav+excluded` конфликт | P1 |
| `customProgram/customCycle` | ✅ | `pmMap` русские ключи без нормализации → `fallbackPm 100` вместо 180 (`hybrid-plan:98`) | P1 |
| `usePreviousPlan` | ✅ | Faithful `previousPlan` не влияет на `applyWeightProgression`? Проверено adapt only | P1 |
| `bbVolGoal/trainingVolumeMode` | ✅ | `high` форсит `gvt` неочевидно, нет `beginner+high` блока | P1 |
| `labAdjust` | ✅ | 30% покрытия, нет 0.7 край | P1 |
| `bodyFat/leanMass/hrv/sleep/stress` | ✅ | 30% per-muscle MRV капа | P1 |
| `dupMode` / `gradedMuscles` | ✅ | 40-50% | P1 |
| `autoRegOn` | ❌ мёртвый | `BbAutoConstructor:559` state без toggle, `autoRegPayload:1575` undefined | **P0 — оживить или удалить** |

**Итого мёртвых:** `autoRegOn`, `proPreset` persist, `PHASE_TECHNIQUES`, `TAG_LABELS_RU` дубликат.

---

## 6. Новые методики — что есть, что добавить (evidence-based)

### 6.1 Реализовано и работает (оценка)

| Методика | Источник | Статус | Оценка |
|---|---|---|---|
| Myo-reps (activation 12-20 +3-5×3-5 @5с) | Borge Fagerli | `autocoach:311` 4×4 @5с корректно, но `DEFAULT_TECHNIQUE` никогда не ставит | 6/10 — подключить к `schemeFor MGF/IGF1` |
| Mechanical drop (2 сета @0с смена угла) | — | `autocoach:336` реализован | 8/10 |
| Negatives slow eccentric 4-2-1-0 | Schoenfeld 2021 | `negative` корректно | 8/10 |
| 21s (7-7-7) | — | `twenty_ones` только biceps корректно | 7/10 |
| Суперсеты/антагонисты/гигант | Helms | `supersetWith` + `markAntagonistSupersets` работает, но дублирован `bb-intensity:superset` | 6/10 |

### 6.2 Объявлены как `REP_SCHEMES` но не влияют на план (критично подключить)

| Методика | Источник | Текущий статус | Что делать |
|---|---|---|---|
| **GVT 10×10 @75с RIR2** | Poliquin | Схема `gvt` без реализации, `volumeScheme` gate `pattern.id` | Подключить `schemeFor` → `applyVolumeScheme` 10 сетов (5+5 по изоляциям, cap 5) |
| **FST-7 7×12 @40с** | Hany Rambod | Аналогично, нет `DELOAD_PROTOCOLS` | 7 сетов памп-изоляций, 40с |
| **BFR 30-15-15-15 @30с @20-30%** | Loenneke 2012 | `bfrMode` флаг, но `pct1RM` остаётся 60-70% | `bfrMode` → `0.25×workMax` + `tempo 3-2-1-1` |
| **Lengthened partials** | Wolf 2023 | `lengthenedBonus` бонус выбора, но нет `applyIntensityTechnique` кейса | Частичка в растянутой позиции после отказа `reps 8-12 RIR0` + `isLengthened` |
| **Cluster 4×2 @87% @15с** | Haff | `cluster` + `rest_pause_cluster` без движка | `rest_pause_cluster` кейс в `autocoach` |
| **DC rest-pause 11-15 RP @20с + extreme stretch** | DoggCrapp | `dc_rp` + stretch не реализован | RIR0 + `extreme_stretch` 60с |
| **Pre/post exhaust** | Meadows | Порядок `compound_first/pre_exhaust` есть, метаболика нет | `pre_exhaust` isolation primary RIR1 перед compound |
| **DUP** | Schoenfeld 2017 | Реализован с P0 багами | Починить shallow copy + вес |

**Оценка до:** 7/13 методик имеют движок, 6 — только каталог. После подключения: 13/13.

### 6.3 Новые методики для профессионального уровня (предложение)

| Методика | Применение | Когда |
|---|---|---|
| **Lengthened-biased training** (Schoenfeld 2021, Pedrosa 2022) | Приоритет упражнений в растянутой позиции: RDL, incline curl, sissy, overhead triceps, pullover, deficit push-up — `lengthenedBonus +10` уже есть, усилить до `×1.5` для `hypertrophy` | Всегда для `hypertrophy` |
| **Effective reps модель** (Beardsley) | Последние 5 повторов до отказа дают стимул — RIR 0-2 эффективнее RIR 4-5, обосновать `pumpRir 1-2` вместо 4-5 | Фикс `FOCUS_RIR_TABLE` |
| **Myo-reps для малых мышц** | `biceps/triceps/delts/calves` — activation + mini-sets, экономия времени, высокий MPS | `intensityTechnique='myo_reps'` авто для малых при `enhanced` |
| **Rest-pause для compounds** | `squat/bench/row` — тяжёлые сеты с паузой 20-30с, больше effective reps | `intensification` для `advanced+` |
| **Gironda 8×8 (60с)** | Плотность, уже в `REP_SCHEMES` | `volumeScheme='gironda'` |
| **Fortitude Training** (Scott Stevenson) | Tier-система: muscle rounds + pump sets + loading sets — как `proPreset='fortitude'` уже есть но мёртвый | Оживление `proPreset` |
| **Mountain Dog (John Meadows)** | Pre-exhaust + pump + heavy + stretch | `proPreset='meadows'` |
| **RP (Israetel) MEV/MAV/MRV** | Уже база, усилить per-head `delt_*` + `traps` | В done Aug 27 |
| **ACWR + autoreg** (Gabbett 2016) | `autoRegOn` мёртвый — оживить sRPE×duration workload | Фаза 1 |

---

## 7. Отчёт и соответствие параметрам

### 7.1 Текущие проблемы честности отчёта

- `bb-report.engine.ts:150` `peakVolume` сравнивает нед1 с `peakWeek` которая может быть deload → регресс -15% ложный (`bb-report.engine.ts:150`)
- `bb-report.engine.ts:33` `peakDirectSets` direct а не effective → расходится с `bb-safety-score` effective (`bb-report.engine.ts:33`)
- `bb-safety-score.engine.ts:208` `volumeViolations` double-count per-week-muscle → `15-36=-21→0` (`bb-safety-score.engine.ts:208`)
- `buildBBVolumeTarget:265` clamp `1.1` съедает `1.15-1.5` → отчёт показывает недобирание MAV хотя PED даёт 1.5
- `hybrid-plan.engine.ts:98` `pmMap` русские ключи → `fallbackPm 100` вместо 180 → веса занижены 2× в hybrid (`hybrid-plan.engine.ts:98`)
- `bb-validator.engine.ts:194` `×1.15` скрывает overflow, `acwr||1.0` маскирует null (`bb-safety-score.ts:72`)

### 7.2 Требование «отчёт = план»

Каждый параметр UI должен давать след в `BBPlan` и отражаться в `report`/`metrics`/`validation`/`rationale`:
- `supersetMode/volumeScheme/dupMode` → `report.supersetPairs/volumeSchemeLabel/dupApplied`
- `pedDoses/courseIntensity` → `report.pedAdaptation` + `mrvByMuscle` + `sessionLimitsFor`
- `injuries/mobility/avoidAxial/equipment` → `validation.excluded_*` + `safetyConstraints` + `rationale.enrich`
- `specializationSchedule/tradeoffDonors` → `rationale.specializationScheduleText` + `tradeoffReport`
- `contestPrep` → `weeks[].contestPhase` + `taperApplied/peakApplied`

---

## 8. Тестовая стратегия — дыры

| Домен | Покрытие | Дыра | Фикс |
|---|---|---|---|
| 25 сплитов × generic | 100% сплитов но только `intermediate/mass/4нед` | Нет уровней/целей полного кроссовера (13.5M комбо) | Property-тест 25×4×5×3 методики `weeks=1` |
| 4 пути | Generic полный, cycle/program по 1-2 шаблона | Нет `faithful` vs `adapt` diff, нет `faithful` safety | Добавить `faithful` P0 из safety |
| Валидатор 23 кода | 9/23 прямо | `empty_plan`, `invalid_work_set (NaN/RIR6)`, `session_duration`, `axial_fatigue` нет | Прямые тесты каждого кода |
| Safety | Machine-only PPL падает 33 ошибки | `tradeoffDonorsForWeek` пропускает safety | `isMobilityRestricted` + `equipment` + `axial` в `ensureWeakPatternCoverage` |
| PPL 6 инвариантов | 95% | `isolation_calves` дубль Legs PPL | `limit=2` для `isolation_calves` в Legs |
| PED | 70% | Нет `10000мг`, `insulin+GH` synergy | Граничные тесты |
| Pro-методики | 60% | `bfrMode` 0%, `blastCruise` 0% | Smoke `bfr:true` valid |
| Детерминизм | 90% | Нет cross-process | `structuralSnapshot` double-build уже есть |
| Zero-state | 4 плана hard snapshot | `shoulders:0` + `delt_*` brittle | Sum assert `delt_front+mid+rear ≈ shoulders indirect` |
| Каталог | 620 записей | 30 дублей id | Линтер + `DEFAULT_WORKMAX lower_back` |
| Edge | low | `weeks 0/NaN`, `workMax {}`, `equipment []` vs `undefined`, `8 excluded` | Edge сьют |

---

## 9. План фаз (капы frozen ≈ как сейчас, 6 фаз, ~10 раб.дней)

### Ф0 — гарды и регрессии (1д) — P0 блокеры без изменения методики

- [ ] Синхрон `≤10` → `sessionLimitsFor` в 3 тестах (`bb-generation:33`, `bb-deterministic-properties:43`, `bb-exercise-count-benchmark:17`) — PPL 12/32.
- [ ] `heavyQuads || true` удалить (`bb-builder:482`, `bb-finalize:481`).
- [ ] Per-week травмы в `cycle-to-plan:859,1640` → `weekDate`.
- [ ] `spec-block-${maxId+1}` (`BbAutoConstructor:457`), `ctx.weeks clamp 4-24` (`annualBlockCtxToPrepPatch:251`), `isFinite` guard `workMax`, `QuotaExceeded` toast.
- [ ] `DEFAULT_WORKMAX lower_back` fallback тишина → 80кг без warn.
- [ ] Каталог дедуп линтер `id` уникальности (pre-commit).

**Приёмка Ф0:** `npx vitest run bb` зелёный на `bb-generation`/`audit_full_matrix`/`bb-safety.integration`, `tsc 0`.

### Ф1 — объёмная модель single source (1д)

- [ ] Унификация recovery: удалить `bb-builder:2747` inline и `computeBBRecoveryScore:78` vs `computeBBRecoveryMultiplier:188` → единый `computeBBRecoveryMultiplier` в `bb-volume`.
- [ ] Унификация `perExerciseCap:205` — убрать хардкод 5 в `normalizeWeekMrv:954`/`bb-finalize:3407`.
- [ ] `buildBBVolumeTarget:265` clamp `1.1→1.5` или убрать второй clamp.
- [ ] `INDIRECT_COEFF` константа единая `0.45` (`bb-builder:1946` vs `bb-volume:284`).
- [ ] `FullBody` → добавить `traps/calves/abs/glutes` или документировать `fill` как источник (`bb-day-types:47`).

**Приёмка Ф1:** один `grep recoveryMult` в `bb-volume`, `perExerciseCap` один `grep`, PPL caps проходят.

### Ф2 — безопасность и травмы (1д)

- [ ] `enforceSessionExerciseLimit:2183` приоритет специализации (не удалять `isSpecializationTarget`).
- [ ] Двойной кап `mrvByMuscle` → единый effective (`bb-finalize:3407` + `bb-builder:3288`).
- [ ] `findCatalog` по `id`+`name` norm, bodyweight bypass тест, `equipment []` vs `undefined` различие (`bb-validator:134`).
- [ ] `TAG_MUSCLES` leak для `ChestBack`/`PushPull` (`bb-validator:149`), `equipment_restriction` + `axial` + `mobility` в `ensureWeakPatternCoverage`/`allocateExperienced*`.
- [ ] `isPrepControlled:2744` guard `peaking` без `contestPhase` → добавить.

**Приёмка Ф2:** `bb-safety.integration` machine+axial PPL зелёный, `bb-injury-gentle` + `bb-mobility` зелёные, 8 excluded перебор даёт `target_volume_deficit` а не краш.

### Ф3 — PED и фармакология (1д)

- [ ] `parseDose г→мг` ×1000, `мкг→мг` (`bb-ped-adaptation:174`).
- [ ] `tEq` для MRV AAS (`bb-ped-adaptation:69`).
- [ ] `COURSE_INTENSITY_MULT` обосновать или убрать магию `1.04/1.08` (`bb-ped-adaptation:185`).
- [ ] `GH+insulin 0.15` в конфиг с источником (`bb-ped-adaptation:262`).
- [ ] `blastCruise` `mrvByMuscle × blastMult` (`bb-builder:2954`).
- [ ] `eccentricMult` → `mrvMult × sqrt(eccentric)` или cap-adjust.

**Приёмка Ф3:** `cycle/program` PED `AAS 1000` vs `GH+insulin` synergy тесты зелёные, `parseDose "1.5г"→1500`.

### Ф4 — методики и DUP (2д)

- [ ] Починить `bb-dup:73` deep clone + `:98` пересчёт веса по `PCT_FOR_RIR`.
- [ ] Гейт `DEFAULT_TECHNIQUE rest_pause` по MRV/session cap (`bb-autocoach:271`).
- [ ] `prescribeLoad` `machine` isolation fix (`bb-autocoach:63`), `linear` плавная `1 - phaseProgress*0.5`, `rpe_based` через `FOCUS_RIR_TABLE` (`bb-autocoach:73,85`).
- [ ] `FOCUS_RIR_TABLE pumpRir 4-5→1-2` (Schoenfeld) + `strength base 1→2` accumulation (`bb-goal-types:32,31`).
- [ ] `tempoFor` TUT дифференциация `тяж 3с vs памп 5с`, `REST тяж 240-300с` (`bb-tempo-rest:8`).
- [ ] Подключить `REP_SCHEMES` к `applyVolumeScheme`: GVT 10×10, FST-7 7×12, BFR 30-15-15-15 @25%, Gironda 8×8 (`bb-rep-schemes:42`).
- [ ] Реализовать `lengthened_partials` (Wolf 2023), `cluster`, `dc_rp+stretch` (`bb-intensity-techniques:29`).
- [ ] Унифицировать `Technique` таксономию alias map (`bb-intensity-techniques` vs `bb-autocoach`).

**Приёмка Ф4:** `myo_reps`/`drop_set`/`rest_pause` + новые `gvt/fst7/bfr/lengthened_partials` дают след в плане, `dupCheck` не мутирует оригинал, вес пересчитан.

### Ф5 — специализация и tradeoff (1д)

- [ ] `specializationVolumeFactor 0.7 → max(MEV, MAV*0.7)` защита `biceps 5.6` (`bb-specialization:160`).
- [ ] `specializationMrvFactor` доку «внутри капов» или убрать рост MRV (`bb-specialization:187`).
- [ ] `tradeoff` `addToRecipient` scoring (а не `find` первый), `baseWeight 0.55→0.45-0.55` по repRange, `unusedSets` доку испарения (`bb-tradeoff:167,178,222`).
- [ ] `strictGroup` fallback на любой член если same-class gate пуст (`bb-exercise-selection:324`).
- [ ] `specializationSchedule` `len<3` растягивание → не наезжать на следующий блок (`bb-specialization:314`).

**Приёмка Ф5:** `specializationSchedule` 12нед 1-5/6-10/11-12 e2e, `biceps` не падает <MEV, `back` в Legs/Push не leak.

### Ф6 — селекция, баланс, отчёт, UI проводка (2д)

- [ ] `bb-exercise-tier:63` canonical перед `high-joint` (тяга в наклоне tier 1).
- [ ] `bb-balance:71` исключить `lower_back|traps|abs` из upper, `isCompound` по `role`.
- [ ] `bb-safety-score:208` `Set` unique мышц, `bb-validator:149` `TAG_MUSCLES` для гибридных, `bb-report:150` peakWeek не deload, `hybrid-plan:98` `pmMap` нормализация.
- [ ] `BbAutoConstructor` оживить `autoRegOn` (toggle + `autoRegulate` + ACWR deload) или удалить мертвяк (`BbAutoConstructor:559`); persist `proPreset` в `params` (`:540`); убрать дубль `bbEquipment` (`:2961`); `focusGroup` проброс консистентно (`:1659`); `bbDays` vs `pattern` warn.
- [ ] `contest-prep` BSA высота из профиля, water/Na дефолт minimal, cache key расширить (`bb-contest-prep:687,688,592`).
- [ ] Контест `PHASES_BY_STRATEGY` back peak порядок, `carbLoad 8→6г/кг` (`bb-contest-prep:308,242`).

**Приёмка Ф6:** каждая кнопка UI (autoReg, proPreset, equipment, focusGroup, bbDays, bfr, blast, favorite, rotation, methodology) даёт след в `BBPlan.inputSnapshot` и `report`/`rationale`, `tsc 0`, `vite build OK`.

### Ф7 — тесты и приёмка (1д)

- [ ] Property-тест 25 сплитов ×4 уровня ×5 целей ×3 методики `weeks=1` (расширение `audit_full_matrix` с 5 до 25).
- [ ] Инвариант прогрессии `weight non-decreasing при RIR drift`, `reps non-increasing`.
- [ ] Валидатор 23 кода — прямые тесты `empty_plan`, `invalid_work_set NaN/RIR6`, `session_duration`, `axial_fatigue`.
- [ ] `bfrMode`/`blastCruise` smoke `valid:true`, `equipment []` vs `undefined` edge, `8 excluded` deficit.
- [ ] Обновить `bb-zero-state-snapshots` sum assert `delt_* ≈ shoulders`, `BB-AUTO-IMPROVEMENT-PLAN.md` → DONE или удалить.
- [ ] SSR `bb-auto-smoke` → RTL E2E `render→split→specBlock donor→Build→assert weeks12 + he_bb_plans+1`.

**Приёмка Ф7:** `npx vitest run bb` 1773+ новые зелёные, полный 7851 зелёных кроме 40 чужих (stash-тест), `tsc 0` по своим файлам.

---

## 10. Риски и зависимости

- **Капы frozen:** меняем только проводку, не уровни капов (как в Ф0-Ф1) — иначе `bb-zero-state-snapshots` + 60 тестов поедут.
- **Каталог дубли:** дедуп `id` — breaking для `FOCUS_REPS_TABLE` ссылок, делать первым.
- **Contest prep вода:** classic 9л — оставить только за `confirmedManipulation`, иначе гипонатриемия.
- **Цикличность `bb-selector→bb-builder`:** `WEAK_TO_MUSCLE` вынести в `bb-types`/`bb-volume` до Ф1.
- **Годовой план `he_bb_macro` vs `he_bb_plan_saved_ctx`:** Ф6 не должен ломать `annual-training` контракт.

---

## 11. Связь с предыдущими планами

- Исходные этапы 0-12 (`docs/BB-AUTO-GENERATION-MAX-PLAN.md`) — DONE, база.
- Максимальный финальный 2026-08-22 (`docs/BB-AUTO-MAX-FINAL-PLAN-2026-08-22.md`) — P0 гарды частично done (clamp weeks, busy, QuotaExceeded), остальное вошло в Ф0-Ф1.
- Aug 27 ББ-авто 80→1 (`AGENTS.md`) — P0 баги движка починены (PPL финишеры, травмы, mobility, fill, muscle-leaks, beginner гейт), но тест-десинхрон 10 vs 12 остался — Ф0.
- Этот план наследует все DONE-результаты и доводит до «каждая кнопка работает, отчёт честен, методики evidence-based».

---

## 12. Чеклист «профессиональный генератор»

- [ ] Любая комбинация `level×goal×split×weeks×methodology×superset×volumeScheme×equipment×injuries×PED×contest` → `valid` или честный `warning` (не `error` без причины)
- [ ] `volumeTargets`/`weeklyVolume`/`mrvByMuscle`/`sessionLimitsFor`/`fatigue budget` консистентны, один источник
- [ ] Специализация 1-2 зоны + donor 1-2 + tradeoff `TAG_MUSCLES` гейт + `per-head` дельты, без leak
- [ ] PED dose-aware `tEq` + `g→мг` + `GH+insulin` synergy + курс `blast/cruise`
- [ ] Методики 13/13 подключены, `beginner` гейт `proMethodsAllowed`, кап 5 соблюдён, DUP не мутирует
- [ ] Contest prep minimal дефолт, BSA из профиля, 7-дневная пик-неделя привязана к шоу, `taper ×0.45/×0.65` Bosquet
- [ ] Отчёт `peakVolume` effective, `balanceReport` без double-count, `rationale` с `position/equipment/progression`
- [ ] Детерминизм `structuralSnapshot` double-build, `primaryBySlot` stable, ротация `forbid/strict/variety`
- [ ] Каталог 562 уникальных, `movementPattern` 23, `isolation_*` дубли лимит 1 ( calves Legs 2 by design)
- [ ] `BBPlan.inputSnapshot` содержит все 44 поля, round-trip `he_bb_plans` cap 8

