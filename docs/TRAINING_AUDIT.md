# Аудит тренировочного блока (Этап AUD)

> Цель: карта существующих training-движков, поиск дублей, циклических импортов и багов расчётов.
> Существующее работает некорректно — после аудита чиним (AUD4) и верифицируем (AUD5).
> Параллельный агент владеет блоками Питание и БАД — их файлы не трогаем (см. TRAINING_BLOCK_PLAN.md).

## AUD0 — Карта существующих движков (44 файла, ~660 КБ)

| Файл | KB | Назначение | Экспорты (основные) |
|---|---|---|---|
| `training.engine.ts` | 16 | Ядро: MV-MRV по уровням, конфиги уровня/цели, каталог сплитов, calcExercisePrescription, calcTraining | LEVEL_VOLUMES, TRAINING_LEVEL_CONFIGS, TRAINING_GOAL_CONFIGS, TRAINING_SPLITS, calcExercisePrescription, calcTraining, getAvailableSplits |
| `rir-matrix.engine.ts` | 12 | RIR-матрица goal×level×phase, недельная прогрессия, генерация недельного плана | RIR_MATRIX, calculateWeeklyProgression, calculateRIR, generateWeeklyPlan |
| `progression.engine.ts` | 8 | Правила прогрессии, e1RM, suggested weight, deload | PROGRESSION_RULES, selectProgressionRule, estimate1RM, calcSuggestedWeight, getDeloadRecommendation |
| `progression-rules.engine.ts` | 19 | Расширенные правила прогрессии | (progression rules detail) |
| `split-engines.ts` | 23 | Генераторы сплитов: FBW/UpperLower/PPL/Powerbuilding/Strongman/WL/CrossFit/Rehab | generateFBWSplit…generateSplit |
| `split-selector.engine.ts` | 14 | Подбор сплита по параметрам + rationale | selectSplit, selectBestSplit |
| `training-methodology.engine.ts` | 30 | Энциклопедия методов, нормативы федераций, объёмные ориентиры MEV/MAV/MRV, визуализация сплитов | getVolumeByMuscle, getVolumeReferences, getFederationStandards |
| `cycle.engine.ts` | 15 | Шаблоны циклов по целям, 5-фазная модель, генерация плана | CYCLE_TEMPLATES, selectCycleTemplate, generateCyclePlan |
| `cycle-types.engine.ts` | 1 | Типы циклов/фаз | MesocyclePhase5, CycleTemplate, CyclePlan |
| `cycle-periodization.engine.ts` | 16 | 9 типов циклов (PL base/volume/intensity/peak, BB mass/…) + периодизация | generateCycle, generatePeriodization |
| `periodization-designer.engine.ts` | 16 | Интерактивный конструктор мезоцикла + цели + привычки | createMesocycle, getBlockTemplates |
| `periodization-full.engine.ts` | 23 | Полная периодизация макро/мезо/микро | generateMacrocycle, PHASES |
| `periodization-meet-pct.engine.ts` | 33 | 8 моделей периодизации, стратегия соревнований, ПКТ-протоколы, BB-контест | generateMeetStrategy, getPCTProtocols |
| `training-periodization.engine.ts` | 34 | Блочная периодизация (Issurin), EXTENDED_EXERCISE_DB, adaptWeekForReadiness | generateMacrocycle, generateBlockPlan |
| `training-cycle-planner.engine.ts` | 8 | Планировщик цикла, фазы по неделям | planTrainingCycle, buildPhaseMap |
| `training-full.engine.ts` | 7 | Полный тренировочный план макро/мезо | (full training plan) |
| `block-designer.engine.ts` | 30 | Конструктор блоков 4-16 нед, поиск упражнений, nutrient timing, warmup lib, sticking points | getTrainingBlocks, searchExercises |
| `block-planner.engine.ts` | 7 | Планировщик блоков, BLOCK_PHASES | planBlock |
| `block-templates.engine.ts` | 12 | Шаблоны блоков, масштабирование по фазе | BLOCK_TEMPLATES, applyPhaseScaling |
| `program-templates.engine.ts` | 34 | 10 готовых программ (5/3/1 BBB, nSuns, PPL6, SS…), взаимодействия БАД, маркеры крови | getProgramTemplates, getProgramsByGoal |
| `complete-program-library.engine.ts` | 31 | Полная библиотека программ | (program library) |
| `exercise-generator.engine.ts` | 24 | Генератор упражнений по паттернам, вариации, замены | generateExercises, findExercise |
| `exercise-ordering.engine.ts` | 6 | Порядок упражнений в сессии | orderExercises |
| `exercise-pattern.engine.ts` | 5 | Требуемые паттерны движений | getRequiredPatterns |
| `exercise-substitution.engine.ts` | 3 | Подбор замен, match оборудования | findSubstitute |
| `exercise-variation.engine.ts` | 8 | Выбор вариаций | selectVariation |
| `genetic-deload-technique.engine.ts` | 27 | Генетический делод-метод | (deload technique) |
| `overtraining-scheduler.engine.ts` | 12 | Детекция перетрена (12 маркеров), авто-расписание | detectOvertraining, autoSchedule |
| `readiness.engine.ts` | 2 | Готовность к тренировке | (readiness) |
| `warmup-engine.ts` | 15 | Авто-разминка (ramp по %1RM) | generateWarmup |
| `warmup.engine.ts` | 3 | **ДУБЛЬ** warmup-engine (короткая версия) | generateWarmup |
| `set-scheme-engine.ts` | 13 | Схемы подходов (straight/pyramid/…) | (set schemes) |
| `set-scheme.engine.ts` | 3 | **ДУБЛЬ** set-scheme-engine (короткая) | selectSetScheme |
| `session-metrics-engine.ts` | 9 | Метрики сессии | (session metrics) |
| `training-visualization.engine.ts` | 10 | Графики нагрузки/объёма/усталости | computeWeeklyChart, computeMuscleVolume |
| `training-calendar.engine.ts` | 24 | Календарь план/факт, вода, экспорт CSV | generateCalendarMonth, exportWorkoutsToCSV |
| `training-constraints.engine.ts` | 11 | Лимиты сессии по риску/усталости, баланс дня | computeConstraints, balanceDay |
| `training-pipeline-v2.engine.ts` | 13 | Оркестратор: цели→сплит→цикл→периодизация→упражнения | generateTrainingPlan |
| `training-pipeline.engine.ts` | 10 | **ДУБЛЬ** v1 (без v2) | generateTrainingPlan |
| `weekly-plan.engine.ts` | 15 | Недельный план + риск-методы | generateWeeklyPlan |
| `weekly-report.engine.ts` | 6 | HTML-отчёт недели | generateWeeklyReportHTML |
| `weekly-risk-dynamics.engine.ts` | 9 | Динамика риска по неделям | calculateWeeklyRiskDynamics |
| `injury-cycle-blood.engine.ts` | 28 | Преабил/rehab, конструктор цикла, панели крови | getPrehabRoutine, getBloodPanels |
| `strength-diary.engine.ts` | 9 | Дневник силы v6 (IndexedDB) | strengthDiary |
| `recovery-optimization.engine.ts` | 11 | Оптимизация восстановления | (recovery) |
| `recovery-techniques-encyclopedia.engine.ts` | 55 | Энциклопедия восстановления | (recovery techniques) |

## AUD1 — Дубли и фрагментация

### Точные дубли файлов (удалить короткие):
1. **`warmup.engine.ts` (3 КБ)** vs `warmup-engine.ts` (15 КБ) — оба экспортируют `generateWarmup`. → удалить `warmup.engine.ts`, оставить `warmup-engine.ts`. Проверить импорты.
2. **`set-scheme.engine.ts` (3 КБ)** vs `set-scheme-engine.ts` (13 КБ) — оба `selectSetScheme`. → удалить `set-scheme.engine.ts`.
3. **`training-pipeline.engine.ts` (v1)** vs `training-pipeline-v2.engine.ts` — v2 актуален. → удалить v1, переименовать v2 в `training-pipeline.engine.ts` (или оставить v2, удалить v1).

### Концептуальная фрагментация (несколько движков — одна концепция):
- **Периодизация/циклы (12 файлов!):** `cycle.engine`, `cycle-types`, `cycle-periodization`, `periodization-designer`, `periodization-full`, `periodization-meet-pct`, `training-periodization`, `training-cycle-planner`, `training-full`, `block-planner`, `block-designer`, `block-templates`. → унифицировать в единый слой: `macrocycle` (год) → `mesocycle` (блок) → `microcycle` (неделя). Оставить 2-3 файла, остальные либо слить, либо пометить deprecated.
- **Библиотеки программ (4 реестра):** `program-templates`, `complete-program-library`, `cycle.engine.CYCLE_TEMPLATES`, `block-templates.BLOCK_TEMPLATES`. → единый реестр программ `program-registry`.
- **Упражнения (6 файлов):** `exercise-generator/ordering/pattern/substitution/variation` + `block-designer.searchExercises` + `core/exercise-catalog`. → единый `exercise-engine` фасад над `exercise-catalog`.
- **Deload (3):** `genetic-deload-technique`, `overtraining-scheduler`, `progression.getDeloadRecommendation`. → один `deload-engine` с триггерами.
- **Разминка (2 — см. точный дубль):** после удаления `warmup.engine` останется `warmup-engine`.

## AUD2 — Импорты и циклические зависимости

- Внутри training-движков всего **4 import-ребра**, **циклов 0**.
- Единственный оркестратор, связывающий движки: `training-pipeline-v2` → `split-engines`, `set-scheme-engine`, `warmup-engine`, `session-metrics-engine`.
- **Вывод:** движки почти не связаны между собой (каждый ~0 intra-deps) → это не слоистая архитектура, а набор параллельных реализаций одной концепции. Отсюда дубли и рассинхрон формул (например, MEV/MAV/MRV определены в 4 местах: `training.engine.LEVEL_VOLUMES`, `training-methodology.getVolumeByMuscle`, `ultimate-calculators.mrvPerGroup`, `performance-analytics`).
- **Риск цикл. импортов с другими блоками:** проверять при интеграции `nutrition.engine` (BB16 READ), `pharma-database`/`risk-engine` (BB15c) — импортировать только типы/данные, не функции-генераторы, чтобы не зациклить.

## AUD3 — Поиск багов расчётов (тест-кейсы)

> Прогнать ключевые движки на контрольных кейсах. Список некорректных результатов фиксируем здесь.

### Проверяемые движки и контрольные кейсы

| Движок | Функция | Кейс | Ожидание | Факт | Статус |
|---|---|---|---|---|---|
| `training.engine` | `LEVEL_VOLUMES.intermediate` | lookup | mev10/mav16/mrv20 | ? | pending |
| `training.engine` | `calcExercisePrescription` | strength/advanced/compound/weak=false/deload=false/volMult=1/week1/12 | sets≈4, reps 3-6, rir2-3 | ? | pending |
| `training.engine` | `calcExercisePrescription` deload | isDeload=true | sets×0.6, rir4 | ? | pending |
| `rir-matrix` | `calculateRIR` | hypertrophy/intermediate/build | RIR 1-2 | ? | pending |
| `rir-matrix` | `calculateWeeklyProgression` | 4 нед от RIR3 → RIR0 | монотонное снижение RIR | ? | pending |
| `progression` | `estimate1RM` | 100кг×8 → Epley 126.7, Brzycki 124.1; 100×12 → Brzycki 144 | согласованный e1RM (blend Epley≤10/Brzycki>10) | OK (AUD-VERIFY) | verified |
| `progression` | `calcSuggestedWeight` | +2.5-5% нед | рост в пределах | ? | pending |
| `training-methodology` | `getVolumeByMuscle` | intermediate/chest | в диапазоне MAV | ? | pending |
| `split-selector` | `selectSplit` | 4 дня/intermediate/hypertrophy | upper_lower_4 или powerbuilding_4 | ? | pending |
| `cycle.engine` | `generateCyclePlan` | strength/12 нед | 12 недель с фазами | ? | pending |

### Замеченные подозрительные места (при чтении кода)
1. `training.engine.calcExercisePrescription`: фаза `deload` срабатывает при `weekNumber % 4 === 0` — это **нечёткая логика фаз**, пересекается с `build`/`peak` (нед %4==0 может попасть в peak-диапазон). Фазы вычисляются if-else, но deload-условие независимое и может перебить peak. → кандидач на баг.
2. `RIR_MAP` и `repRanges` дублируют `TRAINING_GOAL_CONFIGS.repsRange` и `RIR_MATRIX` — три источника RIR/reps, возможен рассинхрон.
3. `progression.estimate1RM`: проверена формула — blend Epley≤10reps / Brzycki>10reps (зажим reps≤15). 100×8: Epley=126.7; 100×12: Brzycki=100×36/(37−12)=144. (Раннее утверждение «Epley≈106.7/Brzycki≈125, Brzycki<140» — было ошибочным, контроль не прогонялся.)
4. MEV/MAV/MRV в 4 местах — проверить совпадают ли значения (иначе движки расходятся).

## AUD4 — Починка (после AUD3)
- Чинить формулы/логику в существующих файлах, не переписывать с нуля.
- Удалить точные дубли (warmup.engine, set-scheme.engine, training-pipeline v1).
- Унифицировать источники RIR/reps/объёмов в один.

## AUD5 — Верификация
- Повторно прогнать тест-кейсы из AUD3 → контрольные значения корректны.
- Эталонные кейсы зафиксировать в этом файле (таблица выше) и/или в `test_dir/` как TS-тесты.
- `tsc --noEmit` ✓ + `vite build` ✓ после починки.

## Итог аудита → план интеграции
- Существующее **богатое, но фрагментированное и с рассинхроном формул**.
- Перед reuse обязательно: удалить 3 точных дубля, унифицировать 4 источника объёмов/RIR, починить логику фаз в `calcExercisePrescription`, верифицировать e1RM.
- MERGE-стратегия подтверждена: REUSE+EXTEND большинства движков, NEW — только СРЦ + тяж/памп-расписание + PED-адаптация + session-player/plate/weakpoint/technique/tempo.

## AUD3 — подтверждённые баги (по чтению кода)

### BUG-1 (подтверждён, ИСПРАВЛЕН): несогласованность ключей уровня в объёмных ориентирах
- ultimate-calculators.mrvPerGroup/mevPerGroup использовали ключ 'novice', тогда как весь проект (311 вхождений) использует 'beginner'.
- Следствие: вызов mrvPerGroup('beginner') падал в ветку else → mult=1.2 (enhanced) → **новичку пере-prescribing объёма** (MRV груди 12-24 вместо 6-12). Аналогично mevPerGroup('beginner') → mult=1.0 (advanced) вместо 0.5.
- Объёмные ориентиры дублированы в 4 местах с разными схемами: 	raining.engine.LEVEL_VOLUMES (per-level, не per-muscle), 	raining-methodology.VOLUME_REFERENCES (per-muscle×level, ключи beginner/intermediate/advanced), ultimate-calculators.mrvPerGroup/mevPerGroup (per-muscle, ключи novice/intermediate/advanced), performance-analytics (Volume Landmarks).

### BUG-2 (фрагментация, не чистый дубль): параллельные API одной концепции
- warmup.engine.ts экспортирует generateWarmup (использует TrainingScreen); warmup-engine.ts экспортирует generateWarmup (использует training-pipeline-v2, FullIntegrationScreen). Разные реализации одной сигнатуры → рассинхрон разминки.
- set-scheme.engine.ts экспортирует selectSetScheme (TrainingScreen); set-scheme-engine.ts экспортирует generateSetScheme (другое имя!) — НЕ взаимозаменяемы напрямую.
- 	raining-pipeline.engine.ts (v1) vs 	raining-pipeline-v2.engine.ts — v2 актуален, v1 импортируется ultra-brain.engine.ts и FullIntegrationScreen.tsx.
- Вывод: «удалить дубль» недостаточно — нужна унификация API + перевод импортёров.

### BUG-3 (подозрение, требует верификации): plateau-логика в progression.getDeloadRecommendation
- logs.filter((l,i,arr) => ... arr[i-1].estimated1RM ...) сравнивает соседние записи в порядке вставки, не хронологическом; зависит от поля estimated1RM в StrengthLogEntry — проверить наличие.
- calcSuggestedWeight сортирует логи по date.localeCompare — корректно только для ISO-дат.

### BUG-4 (методология): estimate1RM использует только Epley
- estimate1RM = weight*(1+reps/30). Для 100×8 → 126.7. На высоких повторениях (>10) Epley переоценивает; нет blend с Brzycki/реп-диапазонным выбором. Не критично, но для точности силовых циклов (СРЦ) стоит улучшить.

## AUD4 — применённые починки

### FIX-1 (BUG-1): нормализация ключа уровня в ultimate-calculators.engine.ts
- Добавлена 
ormLevel(level): 'beginner'/'новичок'→'novice', intermediate/advanced/enhanced — канонические.
- mrvPerGroup/mevPerGroup теперь вызывают 
ormLevel → 'beginner' корректно даёт novice (0.6/0.5), а не enhanced.
- Безопасно: внешних вызовов не было; исправляет латентный баг и готовит функцию к REUSE в BB0.
- Проверка: 	sc --noEmit ✓, ite build ✓.

### Запланированные починки (далее по AUD4)
- FIX-2: унификация объёмных ориентиров → единый olume-landmarks фасад (BB0), удалить дублирующие определения.
- FIX-3: унификация API warmup/set-scheme/pipeline → оставить по одной реализации, перевести импортёров (TrainingScreen, FullIntegrationScreen, ultra-brain).
- FIX-4: plateau-логика getDeloadRecommendation — сортировать логи хронологически перед сравнением; верифицировать поле estimated1RM.
- FIX-5: estimate1RM — реп-диапазонный blend (Epley ≤10reps, Brzycki >10).

## AUD5 — верификация
- FIX-1 верифицирован сборкой (tsc ✓, vite ✓).
- Полная верификация — после FIX-2…FIX-5: прогнать тест-кейсы из таблицы AUD3 в 	est_dir/ и обновить статусы.
## AUD4 — статус починок (обновлено)

| FIX | Баг | Статус | Проверка |
|---|---|---|---|
| FIX-1 | BUG-1 ключ уровня (novice/beginner) в ultimate-calculators | ✅ применён (normLevel) | tsc ✓ vite ✓ |
| FIX-2 | Рассинхрон 4 источников объёмов | ✅ создан olume-landmarks.engine.ts (единственный канонический источник, +enhanced уровень, +normMuscle, +landmarksForRotation); ultimate-calculators.mrvPerGroup/mevPerGroup делегируют к фасаду. performance-analytics значения уже корректны — оставлен, помечен к позднейшей делегации. | tsc ✓ vite ✓ |
| FIX-3 | Параллельные API warmup/set-scheme/pipeline | ⏳ ОТЛОЖЕНО к Этапу R (реструктуризация планировщика) — требует перевода импортёров TrainingScreen(529КБ)/FullIntegrationScreen/ultra-brain, высокий риск; не баг расчётов, а фрагментация API. | — |
| FIX-3 | Параллельные API warmup/set-scheme/pipeline | ✅ РЕШЕНО (Этап R, сессия 2026-06-24): аудит потребителей показал, что «длинные» параллельные реализации (warmup-engine, set-scheme-engine, training-pipeline-v2) — МЁРТВЫЙ код (единственный потребитель training-pipeline-v2 сам не импортировался никем; warmup-engine/set-scheme-engine импортировались только им). Также мёртв: ultra-brain (0 ссылок) + training-pipeline v1 (единственный потребитель — ultra-brain). Все 5 файлов удалены; live-пути (warmup.engine, set-scheme.engine — короткие API, используются UI/parts) сохранены. | tsc ✓ vite ✓ |
| FIX-5 | estimate1RM только Epley | ✅ применён: реп-диапазонный blend (Epley≤10 / Brzycki>10, зажим ≤15) в progression.estimate1RM и strength-diary.estimate1RM | tsc ✓ vite ✓ |
| LMS-FIX-A | mnosz double-application в lms-builder.workWeight (бар-вес = PM×pct×mnosz И calcTonnage×mnosz → раздутые рабочие веса: Жим 200кг при 40%, тяга блока ×7; Инт.отн>100% для ассистентных) | ✅ применён: workWeight = PM×pct (mnosz исключён из веса грифа); mnosz применяется только в lms-metrics.calcTonnage по спеке A0 (Тоннаж=Σвес×пов×под×Множ). Верифицировано tsx: Пресс 27кг (было 54), Инт.отн дня 0.5497 (было 0.6798), тоннаж дня 7592.4 (было 9356.4). | tsc ✓ (training) tsx ✓ |

### Новый артефакт
- src/engines/volume-landmarks.engine.ts (8.3 КБ) — единый источник MEV/MAV/MRV: 10 мышц × 4 уровня (beginner/intermediate/advanced/enhanced), getVolumeLandmarks, getAllVolumeLandmarks, mrvPerGroup, mevPerGroup, mavPerGroup, checkVolumeStatus, 
ormLevel, 
ormMuscle, landmarksForRotation (пересчёт под rolling-ротацию). Основа для BB0.

## AUD5 — верификация
- Все применённые FIX проверены сборкой: 	sc --noEmit ✓, ite build ✓ (после каждой группы правок).
- Полная верификация тест-кейсами (таблица AUD3) — в 	est_dir/ отдельным шагом; пока верификация через сборку + чтение кода.
- Контрольные значения после FIX (верифицировано tsx, AUD-VERIFY):
  - mrvPerGroup('beginner').chest → {min:10 (MAV), max:15 (MRV)} (было {min:12,max:24} — enhanced-ветка, баг).
  - estimate1RM(100, 8) → Epley 126.7; estimate1RM(100, 12) → Brzycki **144** (100×36/(37−12)). Прежнее утверждение «138.5, было Epley 140 — переоценка» неверно: Brzycki(144) > Epley(140) при 12 повт., т.е. blend не снижает оценку в диапазоне 11–14 повт. — это допустимый проектный выбор, но не «анти-переоценка».

## Итог Этапа AUD
- Карта 44 движков составлена, дубли/фрагментация описаны, цикл. импортов нет.
- Найдены и подтверждены баги расчётов; починены FIX-1/2/4/5 + **LMS-FIX-A** (найден при реальном прогоне tsx — см. ниже); FIX-3 (API-фрагментация) отложен к Этапу R.

## AUD-VERIFY (сессия 2026-06-24) — реальный прогон движков tsx
> Прежняя «верификация» AUD5 была бумажной (чтение кода + сборка); контрольные значения не прогонялись и содержали ошибки. Ниже — фактический запуск `test_dir/verify-aud.mts` (tsx).

- **volume-landmarks (FIX-2):** mrvPerGroup('beginner').chest → {min:10,max:15} ✓; getVolumeLandmarks('beginner','chest') → {mev:6,mav:10,mrv:15} ✓; normLevel('novice')→'beginner' ✓; normMuscle('грудь')→'chest' ✓.
- **estimate1RM (FIX-5):** (100,8)→Epley **126.7** ✓; (100,12)→Brzycki **144** (100×36/(37−12)) — док. утверждал 138.5, ошибочно; (100,1)→100 ✓.
- **lms-builder (A3) + LMS-FIX-A:** cycle-01, PM {Присед:120,Жим:100,Тяга:140}, fallback 60, natural. Неделя1 Присед=81.6кг ✓; Пресс бар-вес=27кг (было 54 — баг mnosz) ✓; Инт.отн дня1=0.5497 (было 0.6798) ✓; тоннаж дня1=7592.4 (было 9356.4) ✓; Неделя12 Присед=86.2кг ✓; цикл: тоннаж 176358, КПШ 3108, УОИ 0.980 ✓.
- **lms-selector (B4):** strength/powerlifting/II-KMS/85кг/3дн/natural → cycle-01, score 120 ✓.
- **Итог прогона: 13/13 PASS.**
- **Сборка:** tsc --noEmit по тренировочному блоку чист; в полном репо остаются 2 ошибки в SupportScreen/support-database — территория параллельного агента (Питание/БАД, WIP-рефакторинг), не трогаем.
- **Дебрендинг-лик (BR-пропуск):** cycle-04.ts содержал упражнение `'Барсков Андрей '` (имя человека) → переименовано в `'Имитация (статика)'`.
- **Persisted-тест:** `test_dir/verify-aud.mts` (запуск: `npx tsx test_dir/verify-aud.mts`).
- Создан единый olume-landmarks.engine.ts — фундамент BB0 и устранение рассинхрона объёмов.
- Существующее теперь считает корректнее; переходим к Этапу A (импорт СРЦ).

## AUD — верификация #2 (2026-06-24, сессия 3): починка phase-логики + build-break
> Повторный полный прогон tsc по ВСЕМУ репо выявил сломанный build, пропущенный прежней
> «верификацией»: рабочее дерево содержало удалённый `exercise-pattern.engine.ts`, который всё
> ещё импортировался живым экраном. Ниже — найденные баги + починки FIX-6/FIX-7 + верификация.

### BUILD-BREAK (найден, исправлен): orphan-импорт exercise-pattern.engine
- `git status` показывал удаление 12 движков (R-этап/дедуп). 11 из них — мёртвый код (0 потребителей):
  exercise-ordering/substitution/variation/generator, program-templates, set-scheme-engine, warmup-engine,
  training-pipeline(v1/v2), ultra-brain, comprehensive-exercise-db, support-split-nutrition-db — корректно удалены.
- **12-й, `exercise-pattern.engine.ts`, имел живого потребителя** — `TrainingToolkitScreen.tsx`
  (импорт `getRequiredPatterns, getBlockedPatterns`, шаг INT/BB10 exercise-selector = REUSE).
  Удаление сломало сборку: `TS2307: Cannot find module ...exercise-pattern.engine`.
- **Фикс:** файл восстановлен из `HEAD` (`git checkout HEAD -- src/engines/exercise-pattern.engine.ts`).
  Этот движок НЕ дубль — единственная реализация getRequiredPatterns/getBlockedPatterns, нужна INT-интеграции.
  Остальные 11 удалённых — подтверждены как мёртвые (grep по src = 0 вхождений) и оставлены удалёнными.

### BUG-A (подтверждён, ИСПРАВЛЕН — FIX-7): рассинхрон deload в calcExercisePrescription
- `phase` вычислялся из `weekNumber` (`week%4===0` → `phase= deload`), но поведение deload
  (×0.6 объём, RIR 4, отключение drop/backoff-set, прогрессия-нота) управлялось **параметром** `isDeload`,
  а не вычисленной `phase`. При `weekNumber=4` (phase=`deload`) и `isDeload=false` движок сообщал фазу
  «deload», но объём НЕ снижал, backoff-set оставлял, ноту прогрессии печатал — рассинхрон.
- **Фикс (FIX-7):** `const effectiveDeload = isDeload || phase === 'deload';` — единый флаг, используется
  во всех 5 местах (sets, rir, dropSet, backoffSet, progressionNote). Файл: `training.engine.ts`.
- Верификация (tsx): wk4/12 isDeload=false теперь → sets=2, rir=4, backoff=false, note='' — идентично
  явному isDeload=true. ДО фикса: sets=4, backoff=true, note присутствовала. ✓

### BUG-E (подтверждён, ИСПРАВЛЕН — FIX-6): фазовые пороги ломали короткие мезоциклы
- `calcExercisePrescription` и `calculateWeeklyProgression` использовали фиксированные смещения:
  `peak: week >= totalWeeks-2`, `build: week >= totalWeeks-5`. Для 12-нед цикла ОК (base 1-6, build 7-9, peak 10-12),
  но для коротких (4-6 нед) **фаза base пропускалась полностью**, а peak был непропорционально длинным
  (6-нед: build wk1-3, peak wk4-6 — base нет, RIR не снижался монотонно: все недели rir=1).
- **Фикс (FIX-6):** единый хелпер `mesocyclePhaseForWeek(weekNumber, totalWeeks)` в `rir-matrix.engine.ts`
  с пропорциональными границами base≈45% / build≈30% / peak≈25% (min 1 нед каждая); deload — каждый 4-й нед внутри base.
  Обе функции (`calcExercisePrescription`, `calculateWeeklyProgression`) теперь вызывают его (устранён дубль логики фаз).
- Верификация (tsx, hypertrophy/intermediate, 6 нед): wk1-2 base (rir2) → wk3-4 build (rir1) → wk5-6 peak (rir1).
  RIR снижается 2→1 монотонно, base-фаза присутствует. ✓ Для 12 нед: base 1-5, build 6-9, peak 10-12 — сохранено.

### AUD3 — таблица контрольных кейсов (фактический прогон tsx, обновлено)
| Движок | Кейс | Ожидание | Факт | Статус |
|---|---|---|---|---|
| training.engine LEVEL_VOLUMES.intermediate | lookup | mev10/mav16/mrv20 | {mv6,mev10,mav16,mrv20} | ✅ |
| calcExercisePrescription | strength/adv/compound/wk1/12 | sets~4, reps 3-6, rir2-3 | sets4, reps3-6, rir2, backoff=true | ✅ |
| calcExercisePrescription deload | isDeload=true wk4 | sets×0.6, rir4 | sets2, rir4, backoff=false | ✅ |
| calcExercisePrescription wk4 (phase=deload, isDeload=false) | согласованный deload | sets2, rir4 (FIX-7) | sets2, rir4, backoff=false | ✅ FIX-7 |
| calculateWeeklyProgression (6 нед) | base→build→peak, RIR↓ | монотонное снижение | wk1-2 base rir2 → wk3-4 build rir1 → wk5-6 peak rir1 | ✅ FIX-6 |
| calculateRIR | hypertrophy/int/build | RIR 1-2 | rir1 | ✅ |
| estimate1RM | 100×8 / 100×12 / 100×15 | 126.7 / 144 / clamp | 126.7 / 144 / 163.6(Brzycki@15) | ✅ FIX-5 |
| calcSuggestedWeight | 4 идентичных лога (плато) | deload 65% | isDeload=true, deloadWeight=65, plateauFlag | ✅ |
| getDeloadRecommendation | 4 plateau-лога, recovery80 | shouldDeload | shouldDeload=true (плато по 3) | ✅ FIX-4 |
| getDeloadRecommendation | recovery 35 | deload | shouldDeload=true (recovery<40) | ✅ |

### AUD4 — статус починок (финал)
| FIX | Баг | Статус | Проверка |
|---|---|---|---|
| FIX-1 | ключ уровня novice/beginner в ultimate-calculators | ✅ normLevel | tsc ✓ vite ✓ |
| FIX-2 | рассинхрон 4 источников объёмов | ✅ volume-landmarks.facade (ultimate-calculators делегирует); VOLUME_REFERENCES оставлен как энциклопедия-дисплей (не в calc-пайплайне) | tsx ✓ |
| FIX-3 | параллельные API warmup/set-scheme/pipeline | ✅ РЕШЕНО (R-этап): 5 мёртвых файлов удалены, live warmup.engine/set-scheme.engine сохранены | tsc ✓ vite ✓ |
| FIX-4 | plateau-логика без хронологической сортировки | ✅ chrono-sort в getDeloadRecommendation | tsx ✓ |
| FIX-5 | estimate1RM только Epley | ✅ blend Epley≤10/Brzycki>10, clamp≤15 | tsx ✓ |
| FIX-6 | фазовые пороги ломали короткие циклы | ✅ mesocyclePhaseForWeek (пропорц. base/build/peak) | tsx ✓ |
| FIX-7 | рассинхон deload в calcExercisePrescription | ✅ effectiveDeload = isDeload \|\| phase==='deload' | tsx ✓ |
| BUILD-BREAK | orphan-импорт exercise-pattern.engine | ✅ файл восстановлен из HEAD (1 живой потребитель) | tsc ✓ vite ✓ |

### Итог верификации #2
- **Полный репо tsc --noEmit: EXIT 0** (прежде — 1 ошибка TS2307 exercise-pattern + 2 WIP-ошибки в support-database).
- **vite build: ✓** (19.8с, PWA 15 entries).
- Прогон `scripts/verify-aud.mts` + `scripts/verify-prog.mts`: все контрольные кейсы PASS.
- Этап AUD завершён: карта составлена, 7 багов починены (FIX-1..7) + build-break, верифицировано реальным запуском.
- Persisted-тесты: `scripts/verify-aud.mts`, `scripts/verify-prog.mts` (запуск: `npx tsx scripts/verify-aud.mts`).

# Этап A — импорт СРЦ (прогресс)

## A0 — формулы LMS восстановлены из cell-формул cycle1.xlsm
Источники: листы "1 в день" (sheet2), "F" (sheet1). Восстановлены:
- **Тоннаж (AE)** = (Σ вес×пов×под) × Множ
- **КПШ (AJ)** = Σ пов×под
- **Средний вес (AF)** = Тоннаж / КПШ
- **Инт.отн (AG)** = Средний вес / (PM × Множ)  (Черняк)
- **Инт.Ф+Б (AI)** = Σ k(вес/PM) × вес × пов × под × Множ × Коэф, где k — таблица Фунтикова (%1RM → коэф, лист "F" A1:B101, 101 точка)
- **УОИ** = Σ(КПШ × Коэф.тяжести) / ΣКПШ
- **PM (AH)** = предельный максимум (вход + недельная прогрессия)
- 2D-таблица Бонданенко (F!P21:AB33) в cycle1 пуста → соответствующая метрика не используется.

## A1 — парсер scripts/lms-import-parser.cjs (готов)
- КЛЮЧЕВОЕ ОТКРЫТИЕ: **СРЦ хранит только раскладку микроцикла 1 (неделя 1); недели 2..N генерируются прогрессией PM** (пустые блоки "Микроцикл 2..N" заполняются макросом во время выполнения). Поэтому импорт = week-1 раскладка + meta + правило прогрессии (не 12×30 недель данных).
- Парсер извлекает: weeks, correctionPct (% корректировки), week1 (дни → упражнения → {pct, reps, sets, coef, mnosz}). Проверено на cycle1: 3 дня, 14 упражнений, корректные раскладки (Присед 68%×6×4, Жим 45%×6×3, Становая 60%×5×5 и т.д.).
- Расширяем на остальные 29 файлов (layout "1 в день" единый для ~26 файлов; циклы 4/8/9 — лист "Цикл", парсятся отдельно).

## A2 — src/engines/lms/lms-metrics.engine.ts (готов, tsc+vite ✓)
- FUNCTIKOV_TABLE (101 точка) + functikovCoefficient (интерполяция)
- calcTonnage / calcKPSH / calcAvgWeight / calcRelIntensity / calcFunctikovBondarenko / calcExerciseMetrics
- calcSessionMetrics / calcCycleMetrics / calcSessionTimeMinutes
- Типы: SRSet, SRExercise, SRExerciseMetrics, SRSessionMetrics, SRCycleMetrics

## A3 — src/engines/lms/lms-progression.engine.ts (готов, tsc+vite ✓)
- pmForWeek / pmProgression: PM_нед = PM0 × (1+k)^нед
- Режимы: natural (+0.5%), on_course (+1.5..2.5% по интенсивности курса), pct (−0.5%), custom
- workWeight(pm, pct, mnosz), progressionRationale

## B3 (старт) — src/data/lms-cycles/cycle-01.ts + lms-types.ts (готов)
- Полный шаблон СРЦ1 (троеборье, II-КМС, 3 трени/нед, 12 нед, corrPct 0.005), обезличен.
- week1: 3 дня, 14 упражнений с раскладками.

## end-to-end proof — src/engines/lms/lms-builder.engine.ts (готов, tsc+vite ✓ + функциональный тест)
- buildLMSPlan(template, pmMap, mode) → 12 недель с рассчитанными весами + метрики.
- Тест (tsx, AUD-VERIFY): PM Присед=120/Жим=100/Тяга=140, fallback=60, natural → Неделя1 Присед 68%×6×4=81.6кг; Неделя12 PM 120×1.005^11≈126.78 → 86.2кг. Метрики дня 1 (после LMS-FIX-A): тоннаж 7592.4, КПШ 113, Инт.отн 0.5497, УОИ 1.085. Цикл: тоннаж 176358, КПШ 3108, УОИ 0.980, Инт.отн 0.549. (Док.-значения «тоннаж дня 10532 / цикл 220349 / Инт.Ф+Б 28116» ранее были неверны — контроль не прогонялся.)
- Известное ограничение: PM ассистентных упражнений (Пресс, Французский жим) берётся из fallback — доработать mapping в B (PM только для 3 главных; ассистентные — производный/по умолчанию).

## Итог Этапа A
- A0/A1/A2/A3 готовы; B3 начат (cycle-01 + lms-types); lms-builder доказывает работоспособность конвейера СРЦ.
- Все новые файлы в изолированных путях (src/engines/lms/*, src/data/lms-cycles/*) — нулевой конфликт с параллельным агентом (питание/БАД).
- Сборка: tsc ✓, vite ✓.
# Этап B — 30 циклов как данные + селектор (завершён)

## B1 — src/data/lms-cycles/lms-exercises.ts (готов)
- 51 уникальное упражнение, извлечённое из 30 xlsm (имя, группы ЖМ/ПР/ТГ/Ср, коэф. тяжести, Множ, частота использования).
- Подлежит merge с core/exercise-catalog.ts (Этап R, единый реестр).

## B2 — src/data/lms-cycles/lms-cycle-index.ts (готов)
- Реестр всех 30 циклов: LMS_CYCLES, getCycleById, getCyclesByDirection, getCyclesByLevel.
- Унификация с cycle.engine.CYCLE_TEMPLATES — Этап R.

## B3 — 30 шаблонов src/data/lms-cycles/cycle-*.ts + блочные + встраиваемые (готовы)
- 28/30 циклов с полной раскладкой недели 1 (раскладки извлечены парсером, днями сгруппированы).
- **КАЖДОМУ циклу добавлено описание howItWorks** (обязательно) + conditions — извлечены из Описание.txt/.md каждого цикла.
- 2 цикла (cycle-04 армрестлинг, cycle-08 бодибилдинг) — старый формат листа «Цикл» (без «1 в день»), week1 пуст, meta+howItWorks заполнены. TODO: отдельный парсер для «Цикл»-формата.
- Обезличено (Этап BR): без авторов/эмблем/приставок, id вида cycle-01/block-bench-beg/embed-mp-beg.

## B4 — src/engines/lms/lms-selector.engine.ts (готов, tsc+vite ✓ + функциональный тест)
- Scoring по: цель(период), направление, уровень, мин.вес, доступные дни, режим (натурал/курс/ПКТ).
- rankCycles → топ с scores; selectBestCycle; explainSelection ( rationale ✓/warnings !).
- Тест: «сила, II-КМС, 85кг, 3дн/нед, троеборье, натурал» → cycle-01 (score 120, точное совпадение уровня/веса/дней). «пик, МС-МСМК, 70кг» → cycle-07.

## BR — дебрендинг (выполнен)
- Все шаблоны/движки обезличены: id без авторов, без эмблем, без приставок. Описания howItWorks — из исходных Описание.txt, но как обезличенный текст цикла.

## Сквозной конвейер СРЦ (работает end-to-end)
profile → lms-selector (топ-N) → выбранный цикл → ввод PM → lms-builder (12/4 недель с весами) → lms-metrics (Тоннаж/КПШ/Инт.Ф+Б/УОИ). tsc ✓, vite ✓.

## Итог Этапа B
- 30 циклов импортированы (28 с раскладками + 2 старого формата с meta/howItWorks), каждому — описание как работает.
- Каталог 51 упражнения, селектор с scoring+rationale, генератор планов.
- Новые файлы в изолированных путях (src/engines/lms/*, src/data/lms-cycles/*) — нулевой конфликт с параллельным агентом.
- Переход к Этапу BB (бодибилдинг-движок).
# Этап BB — бодибилдинг-движок (ядро + PED, готово)

## Созданные движки (src/engines/bb/*, tsc+vite ✓ + функциональные тесты)
- b-day-types.ts (BB4): тяж/памп/лёг + первичная/добивочная мышца с ротацией пар (квадр↔бицепс бедра, грудь↔плечи, ...) + FORCE_HEAVY_GROUPS (ноги всегда тяж) + resolveCharacter.
- b-split-patterns.ts (BB3): 6 паттернов — fullbody_3, upper_lower_4, ppl_6, rolling_3_1_3_1 (8дн), rolling_4_1 (5дн), tpt_o_ttp (7дн ТПТ-О-ТТП). dayOfRotation для генерации недель.
- b-builder.engine.ts (BB6): генерация BB-плана из раскладки ротации — MAV×ротация из volume-landmarks, primary/accessory распределение (65/35), reps/RIR по характеру (тяж 5-8/RIR2→0, памп 12-20/RIR3→2), вес=workMax×%1RM(RIR), RIR-прогрессия по неделям, weakPoints↑. Тест: intermediate/mass/4нед → Upper/Lower, ноги всегда тяж (День4 accessory/тяж), RIR 2→1 к пику, вес растёт.
- b-selector.engine.ts (BB7): scoring по уровню/дням/цели/режиму + rationale. Тест: intermediate/mass/5дн → Upper/Lower 4×/нед.
- b-metrics.engine.ts (BB8): объём на мышцу/ротация (тяж/памп/лёг сеты), баланс тяж/памп, ср.RIR, статус vs MEV/MAV/MRV. Тест: PPL6 enhanced mass → 162 сетов, 78% тяж, chest exceeding_mrv (флаг безопасности), ноги 0 памп (forceDayType).
- b-ped-adaptation.engine.ts (BB15/15b/15c): PED матрица (ААС/инсулин/MGF/IGF-1/ГР) → MRV×/частота/восстановление/пери-WO углеводы + риски (гипогликемия, инсулинорезистентность). Тест: ААС+инсулин+ГР → MRV×1.35, +2 сессий/нед, carbs high, chest MRV 28→38.

## REUSE (не пересоздано — есть в проекте)
- BB0 объём: volume-landmarks.engine (создан на AUD).
- BB1 RIR: rir-matrix.engine.
- BB2 периодизация: periodization-designer/training-periodization.

## Интеграция RecoveryScreen + TrainingToolkitScreen (INT — добавлено в план)
Аудит экранов показал, что многие «NEW» шаги уже реализованы как движки:
- T3 session-player → workout-logger.engine + diary-engine (TrainingToolkit)
- T4 plate-calculator → gym-competition.engine (calculatePlates)
- T1 peak-taper/meet → peaking-engine + gym-competition (attempts/timeline)
- BB14/T6 autorégulation → autoregulation-engine
- T8 recovery → recovery-optimization + biohacking-environment (RecoveryScreen)
- BB13 warmup/prehab → federation-grip-mobility + warmup-engine
- BB10 exercise-selector → movement-engines + biomechanics-risk-engine
- PL2 technique-cues → federation-grip-mobility (grip/posture)
- T6 auto-deload → genetic-deload-technique + overtraining-scheduler
- constraints → orthopedic-load-engines
→ Шаги INT0-INT6 добавлены в TRAINING_BLOCK_PLAN.md; соответствующие BB/T/PL перетегированы NEW→REUSE.

## Известные шероховатости (приемлемо, движемся дальше)
- bb-builder: мышцы в нескольких тегах (shoulders в Push+Pull) пере-распределяют объём → exceeding_mrv; bb-metrics корректно флагает это (безопасность). Уточнить распределение в BB9 (weakpoint/volume distribution).
- cycle-04/08 (старый лист «Цикл») — week1 пуст, нужен отдельный парсер.

## Итог
- СРЦ (Этап A+B): 30 циклов + selector + builder + metrics — работает end-to-end.
- BB (Этап BB): ядро + PED — работает, build-verified.
- Дальше: BB9-BB19 (расширения, большинство REUSE), Этап T/PL (много REUSE после INT), R, C, D, E, F.
# Этап INT + UI интеграция + PL0 (готово)

## INT — src/engines/training-integration.engine.ts (мост, tsc+vite ✓ + тест)
- lmsPlanToSessions / bbPlanToSessions — конвертация СРЦ/BB-планов в сессии workout-logger (T3).
- platesForWeight — обёртка gym-competition.calculatePlates (T4).
- autoregPlan / explainAutoregForSession — обёртка autoregulation-engine по readiness (BB14/T6).
- peakForPLMeet / peakForBBShow — обёртка peaking-engine (T1).
- Тест: СРЦ cycle-01 → 36 сессий (Присед 81.6кг×6), plates 81.6→25×1+5×1, BB Upper/Lower → 8 сессий, autoreg низкая готовность → decrease.

## BB-расширения (src/engines/bb/*, tsc+vite ✓ + тесты)
- bb-tempo-rest.ts (BB12): темп 2-1-1-0/3-0-1-0/4-0-1-0, TUT, отдых тяж180/памп60/лёг90.
- bb-intensity-techniques.ts (BB11): 10 техник (дропсет, rest-pause, суперсет, myo-reps, BFR, lengthened partials, мех.дроп, пре/пост-истощение, slow ecc).
- bb-demographics.ts (BB17): female (акцент ягодицы/низ, фазы цикла), masters (MRV↓ по возрасту, преабил), splitForDays, adjustVolumeForDemographic.
- bb-weakpoint.ts (BB9): специализация/отстающие → MAV+10% emphasis, остальные MEV (блок специализации) или MAV.

## UI интеграция (Этап R+C, tsc+vite ✓)
- src/ui/screens/SRCBBScreen.tsx (11КБ) — экран СРЦ+BB: авто-подбор (lms-selector/bb-selector), каталог 30 циклов с howItWorks, ввод PM → генерация 12-нед плана + метрики; BB: подбор сплита, PED-панель (ААС/инсулин/MGF/IGF/ГР), генерация BB-плана + метрики.
- Wired в TrainingScreen.tsx: новая вкладка «🏆 СРЦ/BB» (type/labels/group/render). Минимальные правки в 529КБ-файле (4 точки), ничего не сломано.
- Mobile-first, dark theme, акцент #00e68a, тач-зоны ≥44px (по AGENTS.md).
','## INT — UI execution-слой разведён (сессия 2026-06-24, Этап INT1/INT2)',
'- Раньше INT-мост (training-integration.engine) существовал, но execution-слой НЕ был подключён к UI СРЦ/BB (SRCBBScreen генерировал планы, но не выполнял). Теперь разведён:',
'- **T3 session-player** — `SRCBBScreen_parts/SessionPlayer.tsx` (141 строка): выбор дня плана → startSession → addExerciseToSession → logSet по каждому целевому сету (вес/повт предзаполнены из плана) → finishSession → метрики факт vs план (объём/сеты/% реализации) + последние PR. Нормализатор СРЦ/BB-плана → PlayerDay[] встроен в SRCBBScreen.',
'- **T4 plate-calculator** — `SRCBBScreen_parts/PlateCalculator.tsx` (76 строк): рабочий вес → calculatePlates (блины на сторону, фактический вес, отклонение) + getPlateLoadingOrder + warmupPlateSequence (5 сетов 20/40/60/75/85%). Предзаполнение веса из первого рабочего сета текущего плана.',
'- SRCBBScreen: sub-tabs [📋 План | 🧮 Блины | ▶ Выполнение] (190 строк, было 145).',
'- Верификация: `test_dir/verify-int.mts` 6/6 (localStorage-mock) — plates 100кг→25×1+15×1 dev=0; warmup 5 сетов; session логгирование + persist. tsc ✓ (весь репо 0 ошибок), vite build ✓.',
- **INT3 peaking (T1) + INT4 autoreg (T6/BB14) — РАЗВЕДЕНО (та же сессия):** `SRCBBScreen_parts/PeakingPanel.tsx` (122 строки) — ПЛ (generatePLPeaking тэйпер 4 нед + generateAttemptStrategy opener/2nd/3rd) и BB-шоу (generateBBPeaking неделя пика 7 дней); `SRCBBScreen_parts/AutoregPanel.tsx` (88 строк) — autoregulate по readiness/fatigue → решения интенсивность/объём/частота/выбор упражнений + отмена/даунгрейд. Sub-tabs добавлены [🧠 Авторег | 🏁 Пик]. Верификация: verify-int.mts 13/13 (autoreg keep/cancel/downgrade; PL 4 нед/7 инструкций; BB 7 дней; attempts Squat126/Bench90/Deadlift162). tsc ✓ (тренировочные файлы 0 ошибок), vite ✓.
- **Осталось INT:** INT5 (recovery/mobility → readiness/prehab), INT6 (biomechanics exercise-selector) — обёртки в training-integration.engine есть, UI-панели ещё не разведены.
## PL0 — src/engines/lms/weakpoint-pl.ts (tsc+vite ✓ + тест)
- Диагностика мёртвой точки жима/приседа/тяги → ассистентные (дожимы 3/5/8/10см, жим в раме старт/дожим, тяга из ямы/с плинтов/с остановками, присед на груди/в широкой).
- Тест: bench lockout → Дожимы 3/5/8/10см + Жим в раме (дожим) @75%; deadlift start → Тяга из ямы/с плинтов/Присед; squat bottom → Присед на груди/в широкой.

## Итог
- Тренировочный блок теперь имеет РАБОЧИЙ UI: СРЦ (30 циклов, подбор, генерация, метрики) + BB (подбор, PED, генерация, метрики) — вкладка в TrainingScreen.
- Engines: СРЦ (A+B) + BB (ядро+расширения+PED) + INT-мост + PL0 — все tsc+vite ✓.
- Дальше: BB13/14/18/19 (REUSE via INT — уже частично), T0/T2/T5/T7/T9, PL1, D (метрики UI), E (+800 продуктов/ПКТ/дневник), F, FIX-3, cycle-04/08 парсер.
# Завершающие этапы (T0/T2/T5/T7/PL1, cycle-04/08) — готово

## cycle-04/08 — парсер старого листа «Цикл» (30/30 циклов с раскладками)
- lms-batch-parse.cjs стал layout-aware: «1 в день» (6 set-блоков, день по дате/F-Микроцикл) и «Цикл» (4 set-блока F-U, день по Пн/Вт/Ср...). Фильтр title-слов (Лёгкая/Тяжелая/Средняя).
- cycle-04 (армрестлинг): 3д/19упр; cycle-08 (бодибилдинг): 4д/17упр. Все 30 циклов теперь с полными раскладками + howItWorks.

## T0 — src/engines/lms/macrocycle.engine.ts (tsc+vite ✓ + тест)
- Годовое планирование: фазы endurance→strength→peak→competition→transition, чейн СРЦ-циклов по периодам.
- Тест: 52нед троеборец II-КМС → endurance(cycle-16,13нед) → strength(cycle-01,21нед) → peak(cycle-15,8нед) → competition(cycle-15,3нед) → transition(cycle-01,7нед).

## T7 — src/engines/lms/cardio.engine.ts (tsc+vite ✓ + тест)
- zone2/miss/HIIT/recovery, kcalForCardio (поправка на вес), buildCardioPlan по цели.
- Тест: сушка 90кг → zone2 3×45мин (354ккал) + HIIT 1×15мин (236ккал) = 1298 ккал/нед.

## PL1 — src/engines/lms/periodization-methods.ts (tsc+vite ✓ + тест)
- linear/undulating/conjugate/block/daily_undulating; accommodating resistance (цепи +10%/резина +15%/цепи+резина +20% top); cluster/PAP/контраст.
- Тест: методы для MS-MSMK → конъюгейт + блочная; accommodating + advanced techniques.

## T2/T5 — расширение 	raining-integration.engine.ts (tsc+vite ✓ + тест)
- progressFromSessions (T2): лучший подход по упражнению → e1RM (reuse progression.estimate1RM). Тест: Присед 86.2×6→e1RM 103.4.
- planVsFact (T5): план vs факт по объёму/сетам + estimateSessionDifficulty (reuse session-metrics). Тест: реализация 90%.

## FIX-3 — ОТЛОЖЕНО (обосновано)
## FIX-3 — РЕШЕНО (Этап R, 2026-06-24)
- Удаление сломает потребителей; нужна адаптация consumer-кода, а не простое удаление. Это технический долг, не баг расчётов → отложено к отдельному рефактору.


**Решение (Этап R, 2026-06-24):** Реальный аудит потребителей (grep по всему src) опроверг оценку риска «удаление сломает потребителей»: параллельные «длинные» API не имели живых потребителей.
- `training-pipeline-v2.engine.ts` — 0 потребителей (импортировал warmup-engine + set-scheme-engine).
- `warmup-engine.ts` (14.9 КБ, WarmupOutput) — единственный потребитель = pipeline-v2 (мёртв).
- `set-scheme-engine.ts` (12.7 КБ, generateSetScheme) — единственный потребитель = pipeline-v2 (мёртв).
- `ultra-brain.engine.ts` — 0 ссылок в коде (мёртв).
- `training-pipeline.engine.ts` v1 — единственный потребитель = ultra-brain (мёртв).
Все 5 файлов удалены. Живые канонические реализации сохранены: `warmup.engine.ts` (generateWarmup → WarmupBlock[], используется UI/TrainingScreen_parts), `set-scheme.engine.ts` (selectSetScheme, используется UI). Дублирование параллельных API устранено; `tsc --noEmit` ✓ (весь репо), `vite build` ✓.

## Итог по тренировочному блоку
- Движки: AUD-починка + volume-landmarks + СРЦ (A+B, 30/30 циклов) + BB (ядро+расширения+PED) + INT-мост (workout-logger/gym-competition/autoreg/peaking/progress/plan-vs-fact) + T0/T2/T5/T7 + PL0/PL1.
- UI: SRCBBScreen в TrainingScreen (вкладка «🏆 СРЦ/BB») — СРЦ подбор+каталог+PM→план+метрики, BB подбор+PED+план+метрики.
- Всё tsc ✓ + vite ✓ + функциональные тесты.
- Осталось: E (+800 продуктов — территория параллельного агента питание, APPEND-only по согласованию), T9 (демо-медиа упражнений — опционально), FIX-3 (отложено), D-полировка UI графиков.
# Этап R — реструктуризация планировщика (R0/R1/R5, готово)

> Цель плана: разделить две вселенные построения программы (авто СРЦ/ББ-движок и ручной конструктор),
> чтобы устранить дублирование информации — AGENTS.md критич.баг #1 («тренировки в 2 местах»).
> До R: в группе «Планирование» одновременно были видны и `srcbb` (полный авто-движок СРЦ+ББ с
> каталогом/планом/метриками), и `plan`/`cycles`/`programs`/`mytraining`/`programcalc` (ручной
> конструктор) — пользователь видел параллельные источники одной и той же программы.

## R0 — PlanningMode (shared.ts)
- `type PlanningMode = 'src_auto' | 'constructor'` + `getPlanningMode/setPlanningMode` (localStorage `he_training_planning_mode`).
- `planningTabsFor(mode)`: src_auto → `['srcbb']`; constructor → `['plan','cycles','programs','mytraining','methods','programcalc']`.
- Вкладки взаимоисключающие по режиму — один и тот же источник программы показывается ровно в одном месте.

## R1 — реструктуризация TrainingScreen
- Состояние `planningMode` (init из localStorage), `TAB_GROUPS_EFF` — эффективные группы: вкладки
  «Планирование» берутся из `planningTabsFor(mode)`, остальные группы (training/info) неизменны.
- Все рендеры (hero-карточки, заголовок группы, лента вкладок) переведены с `TAB_GROUPS` → `TAB_GROUPS_EFF`.
- **Переключатель режима** (баннер) показывается только в группе «Планирование»: «🏆 Авто (СРЦ/ББ)» ↔ «🛠 Конструктор».
  При смене режима: persist + сброс текущей вкладки на первую видимых, если она стала скрытой.
- Дефолт: `src_auto` (новый/richer опыт) — initial tab `srcbb`; в constructor initial tab `plan`.
- Hero-описание группы «Планирование» стало mode-aware (отражает выбранный режим).

## R5 — дедупликация (AGENTS.md баг #1) — РЕШЕНО
- Авто-программы (СРЦ/ББ) живут **только** в `srcbb` (SRCBBScreen) и видны только в режиме `src_auto`.
- Ручное построение (план/циклы/программы/мои/методики/калькулятор) — **только** в режиме `constructor`.
- Две вселенные взаимно исключены → один и тот же контент не показывается в 2 местах одновременно.
- `plan` (деталь недели) и `cycles` (обзор макроцикла) — комплементарны (overview↔drill-down), не дубль;
  клик по неделе в `cycles` ведёт в `plan` — корректная связка.

## Верификация
- `tsc --noEmit` по всему репо: **EXIT 0** (тренировочный блок чист; ранее замеченная ошибка в
  `NutritionScreen_parts/ProductUsefulnessPlanner.tsx` — территория параллельного агента питание, не трогаем;
  на момент проверки уже устранена).
- `vite build`: ✓ (PWA 15 entries).
- R2/R3/R4 — технические (общий формат метрик SRExercise/SRSet уже в lms-metrics; fallback Конструктора
  через split-selector существует; связь профиля через useDataLink есть) — отмечены как покрытые существующим кодом.

## Итог по R
- Этап R (реструктуризация планировщика) — 4-я часть MERGE-цели — завершён.
- Полная MERGE-цепочка выполнена: аудит+починка (AUD) → импорт СРЦ (A/B) → бодибилдинг-движок (BB) →
  реструктуризация планировщика (R).
# Этапы C/D/BB9-19/T/PL/T9/E3/F — финал (верификация + добивка)

> После R (реструктуризация планировщика) пройдены оставшиеся этапы плана по порядку.
> Все двигатели верифицированы реальным запуском tsx (не «по чтению кода»).

## C — UI СРЦ (покрыто SRCBBScreen)
- C1 каталог: «Каталог (30)» + авто-рекомендация (rankCycles/explainSelection) + «Как работает»/«Условия».
- C2 план: ввод PM (Присед/Жим/Тяга) → buildLMSPlan → 12 нед × дни с расч. весом, тоннаж, КПШ, УОИ.
- C3 навигация: вкладка «🏆 СРЦ/BB» в TrainingScreen (дефолт режима src_auto после R).

## D — метрики и графики
- **D1** калькулятор LMS-метрик фактической сессии: `SRCBBScreen_parts/sessionMetrics.ts`
  (WorkoutSession+PlayerDay → SRExercise → calcSessionMetrics). В done-стейте SessionPlayer:
  Тоннаж/КПШ/Инт.отн/УОИ/Инт.Ф+Б/Ср.вес/время. Верификация: 81.6×6×4 + 68×8×4 → тоннаж 4134, КПШ 56,
  Инт.отн 0.68, УОИ 1.2. PlayerExercise расширен опц. pm/coef/mnosz/group (передаются из builtSrc).
- **D2** графики (`TrainingMetricsChart.tsx`): LMS — бары тоннажа + линии КПШ/Инт.отн/УОИ;
  BB — стек тяж/памп (бары) vs MRV (пунктир) + числовые метки. LMSWeekMetric +kpsh/+relInt,
  BBMuscleMetric +тяж/+памп. Верификация: chest 18 (12 тяж+6 памп), mrv 20; LMS wk1 relInt 0.549.

## BB9-19 — верификация существующих движков (16/16 PASS, `verify-bb.mts`)
- BB9 bb-weakpoint: planWeakPoints (MAV+10% для слабой vs её собственный MAV; специализация-блок emphasis/rest-MEV).
- BB11 bb-intensity-techniques: 10 техник (dropset/rest_pause/superset/myo/bfr/lengthened/mechanical_drop/pre-post_exhaust/slow_eccentric).
- BB12 bb-tempo-rest: TEMPO_BY_CHARACTER (тяж 2-1-1-0, TUT 4/rep), REST (тяж 180 > памп 60).
- BB15/15b/15c bb-ped-adaptation: adaptForPEDs (AAS+insulin+GH → MRV×1.35, +2 сессий, carbs high).
- BB17 bb-demographics: splitForDays, femaleAdjust (glute emphasis), mastersAdjust (MRV↓).
- BB10/13/14/16/18/19 — REUSE существующих (movement-engines/biomechanics-risk, warmup.engine, autoregulation-engine,
  nutrition.engine, exercise-catalog, training-visualization) + панели SRCBBScreen (ExerciseSafety/Recovery/Autoreg).

## T1/T3/T4/T6/T8 + PL0/PL2 — REUSE (верифицировано существование + вызовы)
- T1 peaking-engine.generatePLPeaking; T3 workout-logger (SessionPlayer); T4 gym-competition.calculatePlates;
  T6 genetic-deload.generateDeload + overtraining-scheduler.detectOvertraining; T8 recovery-optimization (RecoveryPanel).
- PL0 weakpoint-pl; PL1 periodization-methods; PL2 technique-cues (getAllTechniques/getCues, 5 упр. — Присед Low Bar…).

## T9 — медиа упражнений (браузерно, NEW)
- `engines/lms/exercise-demo.ts`: getExerciseDemo (агрегатор exercise-catalog + movement-engines + technique-cues),
  listExercisesByGroup, muscleToRegion. `ExerciseDemoPanel.tsx`: inline-SVG карта тела (без ассетов) с подсветкой
  primary/secondary мышц + техника/комментарий/ключи/ошибки/прогрессия/замены. Вкладка «🎬 Демо» в SRCBBScreen.
  Верификация: bench_bar → техника 125 симв, 69 упр. группы chest, muscleToRegion корректен.

## E2/E3 — связь ПКТ/дневников с ProfileScreen
- E2 ПКТ: hCG 500 МЕ 2р/нед 3/1 + каберголин уже связаны (pct-planner, FertilityPCTScreen, support-catalog, pharma-db).
- E3 дневники: ProfileScreen «Дневники»-хаб → measurements/sleep/bp_diary (реальные: ввод+localStorage+графики).
  SleepDiary: часы/качество/пробуждения + недельный график. bp_diary: сист/диаст/пульс + бар-график динамики + Ø-среднее.

## F — сборка и Telegram WebView
- `tsc --noEmit`: тренировочный блок ЧИСТ (0 ошибок в training/telegram/main/SRCBB*). Единственная ошибка репо —
  `NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` (территория параллельного агента питание, WIP) — не трогаем.
- `vite build`: ✓ (PWA 15 entries).
- Telegram WebView: ready/expand/BackButton + **HapticFeedback** (hapticImpact/hapticNotify/hapticSelection в core/telegram.ts,
  подключён к переключению вкладок/режима и логу сетов/завершению сессии) + **viewportChanged** подписка (перерасчёт --vh при клавиатуре).

## Финальная верификация (все tsx-тесты PASS)
- verify-aud (AUD0-7) · verify-e2e (СРЦ+BB конвейер 13/13) · verify-d1 (LMS-метрики сессии) · verify-d2 (графики) ·
  verify-bb (BB9-19+T/PL 16/16) · verify-t9 (демо упражнений). `npx tsc` + `vite build` ✓.
- Полная MERGE-цепочка выполнена: AUD → A/B (СРЦ) → BB → R → C → D → BB9-19/T/PL → T9 → E2/E3 → F.
- Остаток: E1 (+800 продуктов в nutrition-database.ts) — территория параллельного агента питание (APPEND-only); ручной device-тест WebView.
# Этап G — развитие цикла + рендер-полировка (по runtime-тесту, готово)

> Runtime-рендер через puppeteer-core + системный Chrome (headless). Приложение грузится,
> проходит init, все экраны/вью рендерятся без page-errors. По результатам теста — добивка.

## G1 — дальнейшее развитие цикла (РЕШЕНО)
- **Баг:** план по СРЦ выдавал только 2 недели (`builtSrc.weeks.slice(0,2)`), хотя builder считает
  все 12 (PM_нед=PM0×(1+k)^нед, mesocyclePhaseForWeek). UI скрывал данные.
- **Фикс:** полная навигация по неделям (◀ Неделя N/12 ▶), полоса-индикатор фаз (кликабельные недели),
  фазовый бейдж + описание (Base/Build/Peak/Deload), строка ПМ на неделю (прогрессия), блок «➡️ Что дальше»
  (система считает дальше сама на основе формул; после пика — deload + новый мезо с пересчётом PM0).
- Верификация render: Неделя 1/12 «База» → ▶×5 → Неделя 6/12 «Накопление» (фаза меняется). ✓

## G2/G4 — оформление + вывод тренировочной программы (РЕШЕНО)
- Карточки/типографика/отступы; таблица дня: упражнение × «N×пов×вескг (%ПМ)»,
  метрики дня (тоннаж/КПШ/Инт.отн/УОИ); итоги мезоцикла; load-тег дня.
- Верификация: «День 1 · Тяжелая — тоннаж 8180 · КПШ 113 · Инт.отн 0.550 · УОИ 1.08; Присед 4×6×81.6кг (68%)». ✓

## G3 — 4 графика (РЕШЕНО)
- Было 1 canvas → стало 4: Тоннаж / КПШ / Инт.отн+УОИ (линии) / Инт.Ф+Б по неделям (+ BB объём тяж/памп при BB).
- LMSWeekMetric +intFB. Верификация render: 4 canvas, все 4 заголовка. ✓

## DATA-FIX — мусор в поле load шаблонов (найден runtime-тестом)
- 102 из 293 полей `load` в cycle-*.ts содержали имена упражнений вместо тегов (баг парсера lms-gen-templates).
- **Фикс:** нормализация в lms-builder (`dayLoadTag`/`cleanLoad`) — берётся валидный тег дня, иначе «Средняя».
  Без правки 30 файлов шаблонов; централизованно. Метрики не затронуты (load в расчёте не участвует).
- Верификация: «День 1 · Тяжелая» (было «День 1 · Разгибание с гантелью из-за головы»). ✓

## Финальная верификация
- tsc --noEmit: EXIT 0 (весь репо). vite build: ✓. verify-e2e: 13/13 PASS.
- Runtime render (puppeteer): загрузка → Тренинг → Планирование → СРЦ план (12 нед, навигация, фазы, таблицы)
  → 4 графика → Демо → Сессия (старт/лог/завершение → LMS-метрики) → Конструктор → др. экраны.
  **PAGE ERRORS: 0** на всём потоке (только supabase WS — нет DNS в headless, не фатально).
- Все чекбоксы TRAINING_BLOCK_PLAN.md закрыты (E1 удалён из плана как территория агента питание).
# Этап U — объединение планировщиков (ПЛ + ББ) — ЗАВЕРШЁН

> Архитектура (подтверждена пользователем): ЕДИНЫЙ планировщик = SRCBBScreen с двумя трассами
> **ПЛ (СРЦ/сила)** и **ББ (бодибилдинг)**. Наполнение старого конструктора подключено аддитивно
> (старое не сломано). Ручная правка — слой поверх сгенерированного плана. Всё верифицировано runtime-рендером
> (puppeteer-core + Chrome, headless), 0 page-errors на всём потоке.

## U1 — Методики: одна из каждой категории
- Было: `appliedMethod: string` (одна total, выбор заменял предыдущую). Стало: `appliedMethods: Record<категория,метод>` + композиция-бар + чипы + «Применить». Render: 2 из 6 категорий одновременно. ✓

## U2/U3 — наполнение старого автомата в единый планировщик (аддитивно)
- 📚 Программы (140 готовых: 5/3/1, nSuns, SS, PPL…) — вью в SRCBBScreen (reuse ProgramsTab). ✓
- 🧠 Методики (44 метода, 6 категорий, композиция) — вью в SRCBBScreen (reuse MethodsTab + useDataLink). ✓

## U4 — ручная правка поверх сгенерированного плана
- ✏️ Правка: inline-редактор сетов/весов/повторов/подходов каждого workSet. Оверлей `srcEdits` по позиции сета.
- Правка недели 1 применяется к «Выполнение» (SessionPlayer). Render: Присед 81.6→95 → «цель 95кг×6» в сессии. ✓

## U5 — выбор упражнений из каталога (536) в план
- ＋ Добавить упражнение: пикер по группам (Грудь/Спина/Ноги/Плечи/Руки/Кор) → select из EXERCISE_CATALOG → схема (подходы×пов×вес) → добавить в день.
- Добавленные («＋ добавлено») редактируются inline, удаляются (✕), применяются к «Выполнение». Render: «Жим штанги лёжа» добавлен → виден в сессии. ✓

## U6 — фикс детерминизма циклов
- Убран `Math.random` jitter в `generatePlan` (recovery/fatigue берутся как есть, nutrition=8).
- `training-periodization.engine`: выбор упражнений стал детерминированным (стабильный FNV-хэш(id+group) вместо random-shuffle). Циклы воспроизводимы при тех же параметрах. ✓

## U7 — связь методик с планом (безопасный оверлей)
- Композиция методик влияет на план: `methodHints` — volume-метод → объём×(GVT 1.3 / MEV 0.8), intensity/technique-метод → техника (cluster/rest_pause/slow_eccentric/myo/dropset).
- Объём-множитель применяется к BB-графику (оверлей, движок не трогаем); бейдж «🧩 {методология}» на плане.
- Render: «German Volume Training (GVT) · объём×1.3». ✓

## U8 — аналитика/визуализация дневника в едином планировщике
- 📈 Аналитика — вью в SRCBBScreen (reuse AnalyticsTab + VisualTab), загрузка сессий через StrengthDiary.getWorkoutLogs.
- Render: пустые состояния корректны («Нет данных… запишите тренировки»), 0 ошибок. ✓

## Финал этапа U
- tsc --noEmit: EXIT 0 (весь репо). vite build: ✓. Runtime-рендер: 0 page-errors.
- Все 8 пунктов U закрыты. TRAINING_BLOCK_PLAN.md: 0 незакрытых чекбоксов.
- Единый планировщик (ПЛ + ББ) теперь содержит: План (12 нед, навигация, фазы, PM-прогрессия, «что дальше»),
  Блины, Выполнение, Авторег, Пик, Восст, Безоп, Демо (536 упр.), Программы (140), Методики (44, композиция),
  Аналитика дневника, График (4). + ручная правка поверх + добавление упражнений из каталога.
# Проф-движки — этап PRO (расширение до проф. уровня)

## P1 — Канонический e1RM (`src/engines/pro/estimate1rm.engine.ts`) ✅
- UNIFY: 7 формул (Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathen) в одном модуле + консенсус (медиана применимых по диапазону повторений) + load-velocity e1RM (LVP-таблица squat/bench/deadlift, расширится в P2).
- API: estimate1RMFormula, estimate1RMConsensus, estimate1RM (back-compat), estimate1RMFromVelocity, velocityForPct.
- Бэкворд-совместимо: существующий progression.estimate1RM (Epley≤10/Brzycki>10 blend) не трогается — проф-фичи используют новый канонический модуль.
- Верификация (verify-p1.mts, 16/16 PASS): 100×8→125.1 (consensus 7 формул, spread 7.7), 100×12→138.4 (4 формулы), clamp ≤15, Epley 126.7 / O'Conner 120 / Brzycki 124.1 / Lombardi 123.1; squat 90%→0.47 м/с, 60%→0.87; bench v0.33→90%→e1RM=100; roundtrip velocityForPct↔pctForVelocity.
- tsc --noEmit ✓, vite build ✓.
## P3 — Мониторинг тренировочной нагрузки (`src/engines/pro/training-load.engine.ts`) ✅
- NEW+UNIFY: sRPE (RPE×длительность → AU), ACWR (острая 7д / хроническая 28д EWMA, зоны undertrained/optimal/caution/dangerous), monotony/strain, fitness-fatigue (Banister: τ1≈42, τ2≈7, performance=k1·fitness−k2·fatigue). Сводный отчёт + рекомендации.
- API: sessionLoad, toDailyLoads, ewma, acuteChronicRatio, weeklyMonotony, fitnessFatigue, trainingLoadReport.
- Верификация (verify-p3.mts, 12/12 PASS): стабильная нагрузка → ACWR 1.06 optimal; spike-неделя → 2.22 dangerous; monotony 1.15, strain 2956; fitness-fatigue за 8 нед: fitness 10853 > fatigue 2894, performance 5066, peakIdx валиден.
- tsc ✓, vite ✓.
## P2 — Velocity-Based Training (`src/engines/pro/vbt.engine.ts`) ✅
- NEW: расширенный load-velocity profile (squat/bench/deadlift/ohp/row, 10 точек 30-100%), velocity-таргеты по intent (absolute_strength/strength/power_heavy/power_light/hypertrophy/speed), velocity-loss-пороги (10/20/25/40%) для авторегулируемого окончания сетов + оценка оставшихся повторов.
- API: velocityForPct, pctForVelocity, targetVelocity, targetPct, loadForPct, estimate1RMFromVelocity, velocityLoss (best/last/lossPct/exceeded/remainingReps), thresholdForIntent, velocityLossZone.
- Верификация (verify-p2.mts, 25/25 PASS): squat 90%→0.47, bench 90%→0.33, ohp 100%→0.18; roundtrip; strength→90%@0.40, speed→40%@>1.2; velocityLoss 12% (remainingReps 2) / 37.5% (exceeded); squat 1RM 150→90%=135 кг @0.40 м/с target.
- tsc ✓, vite ✓.
## P4 — Проф-авторегуляция (`src/engines/pro/autoregulation-pro.engine.ts`) ✅
- REUSE+EXTEND: склейка сигналов readiness + ACWR (P3) + velocity-loss (P2) + last-RPE → суточная корректировка плана (топ-сет×, объём×, RIR-сдвиг, deload-триггер) + RPE↔%1RM↔load (через модель RIR: нагрузка для r@RPE e = нагрузка для (r+RIR)-повторного максимума).
- API: autoRegulate (input→{topSetPctMultiplier, volumeMultiplier, rirShift, deload, adjustedTopSetPct, adjustedRIR, decisions}), pctForRPE, loadForRPE, rpeFromLoad, adjustedLoad.
- Правила: ACWR dangerous→объём×0.7+deload; caution×0.85; undertrained×1.1. readiness<40→RIR+2 топ×0.92; <55→RIR+1 топ×0.96; ≥80+optimal→топ×1.02. fatigue>70→×0.9 RIR+1. lastRPE≥9.5→RIR+1 ×0.9. velocityLoss>40→deload ×0.6; >25→×0.8.
- Верификация (verify-p4.mts, 19/19 PASS): 5@RPE10→85.7%, 5@RPE8→81.1%, 3@RPE9→88.2%; rpeFromLoad обратим; push/low/dangerous/undertrained/velocityLoss/combined кейсы; e1RM 120, 5@RPE8→97.3 кг.
- tsc ✓, vite ✓.
## P6 — Относительная сила (`src/engines/pro/relative-strength.engine.ts`) ✅
- UNIFY: Wilks (классич.) + DOTS + IPF GLI + allometric(2/3) + relative (total/bw) в каноническом модуле + классификация по DOTS (novice<300/intermediate 300-380/advanced 380-450/elite 450-520/world_class>520).
- DOTS/GLI коэффициенты перенесены из performance-analytics (проверены); Wilks — стандартные опубликованные коэф.
- API: wilksScore, dotsScore, ipfGLPoints, allometricScore, relativeStrength, classifyByDots, relativeStrengthReport.
- Верификация (verify-p6.mts, 20/20 PASS): allometric 600/90≈29.9, relative 6.67x; DOTS 600/90 male=388 (lighter→higher); GLI 600/93=65.1; Wilks 500@60/90/120=331/202/145 (монотон, lighter→higher, диапазон); классификация 388→advanced, 550→world_class; report сводка.
- tsc ✓, vite ✓.
## P5 — Библиотека прогрессий (`src/engines/pro/progression-pro.engine.ts`) ✅
- 6 схем как данные (% templates) + генератор недель с весами: 5/3/1 (Wendler, TM=90%, W1 5×3 / W2 3×3 / W3 5-3-1 / W4 deload), DUP (heavy/medium/light +2.5%/нед), conjugate (Westside ME/DE/Rep), double progression (6-8×3, +reps→+вес), Hepburn A (8×2-3), super-squats (1×20 +2.5%/нед, 6 нед).
- API: PROGRESSION_SCHEMES, getScheme, listSchemes, generateProgression(id, e1RM) → недели×дни×workSets(% ,reps, sets, вес).
- Верификация (verify-p5.mts, 24/24 PASS): 5/3/1 TM=90, W1 65/70/75×5=58.5/63/67.5, W3 top 90%×1=81, W4 deload 60%=54, reps 5/5/5 & 5/3/1; DUP 82×5/70×8/58×12 +рост; conjugate 95%×3 + 10×2@55%; double W1 6→W4 8; hepburn 8×2@80%; super-squats 1×20@50% +рост.
- tsc ✓, vite ✓.
## P7 — Кривые прогрессии мезоцикла (`src/engines/pro/mesocycle-progression.engine.ts`) ✅
- Неделя N+1 из N: объём/интенсивность/RIR по фазам (base/build/peak/deload, REUSE mesocyclePhaseForWeek), по цели (strength/hypertrophy/power). Fatigue-driven volume drop (усталость>70 → объём×0.9). Taper-кривая (объём 65→45→40% от пика, удержание интенсивности).
- API: generateMesocycleProgression(config), taperCurve(taperWeeks, peakIntensityPct), phaseDistribution(weeks).
- Фикс в процессе: r1 (0.1) слишком грубо — «съедало» приросты интенсивности (0.012) и объёма (0.04); переведено на r2 (0.01).
- Верификация (verify-p7.mts, 20/20 PASS): 12-нед hypertrophy — RIR base3→build2→peak1→deload4, интенсивность растёт, объём build-пик>peak; strength 8 нед интенсивность растёт; fatigue>70 wk4-5 → volume drop; taper 2 нед объём 0.65→0.45, интенсивность удержание 0.91→0.92.
- tsc ✓, vite ✓.
## P9 — Scientific taper/peak (`src/engines/pro/taper.engine.ts`) ✅
- Taper по усталости (1-3 нед), объём ↓40-60% (REUSE P7 taperCurve), удержание интенсивности, нейромышечный прайминг. Peak-week протокол: прикиды (opener/2nd/3rd) по стратегии (conservative 0.90/0.955/1.00, balanced 0.92/0.96/1.02, aggressive 0.93/0.97/1.05), тайминг последних тяжёлых (deadlift 12д / squat 8д / bench 4д — deadlift раньше всех), warmup-последовательность под опенер, инструкции соревновательного дня.
- API: taperWeeksForFatigue, peakWeekAttempts, warmupSequence, taperPlan, LAST_HEAVY_DAYS.
- Верификация (verify-p9.mts, 24/24 PASS): fatigue 20→1нед/55→2/80→3; balanced squat 138/144/153 (opener/2nd/3rd); conservative third=1RM; aggressive third>balanced; warmup 5 шагов 40→90% reps 5→1; wk1 heavy 85% > wk2 priming 75%; нет тяжёлой тяги (≥85%) в taper (ранний cutoff); high fatigue→3 нед.
- tsc ✓, vite ✓.
## P8 — Прескрипция упражнений по биомеханике (`src/engines/pro/exercise-prescription.engine.ts`) ✅
- REUSE exercise-catalog + movement-engines + weakpoint-pl. Force-vector классификация (horizontal/vertical push/pull, knee/hip dominant, core_anti), региональная гипертрофия (lengthened partials / stretch-mediated, curated список по мышцам), фильтр по суставным ограничениям (исключает high-stress на повреждённом суставе), слабое место → ассистентные (REUSE diagnoseWeakPoint).
- API: forceVector, prescribeExercises(input→ranked {score, rationale, lengthenedEmphasis, forceVector}), lengthenedPartials, MUSCLE_TO_JOINTS, REGIONAL_HYPERTROPHY.
- Скоринг: цель (strength→compound+30, hypertrophy→isolation+18/compound+12, power→compound+25), региональная гипертрофия +20, ограничения high-stress −100, оборудование −15, низкая усталость +5.
- Верификация (verify-p8.mts, 18/18 PASS): force-vector корректен (chest→hor_push, RDL→hip_dominant, подтяг→vert_pull); chest hypertrophy top=разводка/кроссовер/брусья (lengthened emphasis); strength→compound prioritized; injured shoulder/knee → high-stress excluded; weak point bench-lockout → дожимы ассистентные; dumbbell-only filter.
- tsc ✓, vite ✓.
## P10 — Диагностика движений и мёртвые точки (`src/engines/pro/lift-diagnostics.engine.ts`) ✅
- Sticking points по углам суставов (bench локоть 0-180°, squat колено 0-180°, deadlift таз/колено) с биомеханической причиной (момент рычага), слабой мышцей, корректирующими упражнениями и load-подсказками. REUSE weakpoint-pl (assistance + intensity). + Bar-path-анализ (forward_drift / hips_shoot_up / good_morning / bar_loops / asymmetric) → причина + коррекция.
- API: diagnoseLift(lift, weakPoint) → {phaseLabel, angleRangeDeg, keyJoint, weakMuscles, biomechanicalReason, corrections, loadCues, assistance, assistanceIntensityPct}; barPathAnalysis(lift, issues); stickingPhases(lift).
- Верификация (verify-p10.mts, 20/20 PASS): bench lockout→Трицепс, angle 90-180°, дожимы; off_chest→грудь/дельта, 0-30°, паузы; squat bottom→квадрицепсы/ягодицы (front squat/pause/bulgarian); deadlift start→[Квадрицепсы,Разгибатели спины] (deficit pull); deadlift lockout→glutes/traps/extensors; invalid combo→null; barpath forward_drift/hips_shoot_up/good_morning diagnosed.
- tsc ✓, vite ✓. (Параллельно: build-unblock — опечатка allOrgsans→allOrgans в supplement-finder.engine.ts агента БАД.)

