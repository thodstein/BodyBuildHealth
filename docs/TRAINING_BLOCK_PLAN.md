# План: Тренировочный блок — MERGE (СРЦ + BB поверх существующего, без дублей)

> Источник требований: `AGENTS.md` (Health Engine v9, Telegram Mini App, browser-only TS + Vite).
> Стратегия: **MERGE, не rebuild**. Существующие хорошие движки оставляем и расширяем;
> СРЦ и уникальные BB-механизмы добавляем; дубли унифицируем. Дебрендинг обязателен.

## Стратегия

1. **Аудит существующего** (Этап AUD) — составить карту «движок → возможности → качество».
2. **REUSE+EXTEND** — для возможностей, что уже есть, расширяем существующий файл, не создаём новый.
3. **NEW** — создаём только то, чего нет: СРЦ-импорт, тяж/памп-расписание+первичная/добивка, PED-адаптация тренировки, session-player, plate-калькулятор, weakpoint-pl, technique-cues, tempo/TUT.
4. **DEDUP** — пересечения (cycle templates, program library, exercise catalog, selectors) унифицируем в один реестр.
5. **Существующее сейчас работает НЕКОРРЕКТНО** — обязателен аудит + починка перед reuse: каждый REUSE-движок проверяется на правильность расчётов и чинится, а не берётся как есть.
6. Финал каждого этапа: `tsc --noEmit` ✓ + `vite build` ✓ + проверка корректности расчётов на тест-кейсах.

## Карта существующего (что оставляем — аудит подтверждён)

| Возможность | Существующий файл(ы) | Решение |
|---|---|---|
| MEV/MAV/MRV по мышцам/уровням | `training-methodology`, `performance-analytics`, `ultimate-calculators.mrvPerGroup`, `training.engine` | REUSE+EXTEND → единый `volume-landmarks` фасад |
| RIR-матрица + недельная прогрессия | `rir-matrix.engine` | REUSE+EXTEND |
| Периодизация макро/мезо/блоки | `periodization-designer`, `training-periodization`, `training-cycle-planner`, `cycle.engine` | REUSE+EXTEND |
| Сплиты FBW/UL/PPL/Powerbuilding/WL/… | `split-engines`, `split-selector` | REUSE; добавить rolling/тяж-памп поверх |
| Готовые программы (5/3/1, nSuns, PPL6, SS) | `program-templates`, `complete-program-library` | KEEP (режим Конструктор) |
| Прогрессия/e1RM/делод | `progression.engine`, `genetic-deload-technique`, `overtraining-scheduler` | REUSE+EXTEND |
| Readiness/авто-регуляция | `readiness.engine`, `adaptWeekForReadiness`, `log-analytics-progression` | REUSE+EXTEND |
| Разминка/преабил | `warmup-engine` | REUSE+EXTEND |
| Recovery-энциклопедия | `recovery-techniques-encyclopedia` | REUSE |
| Каталог упражнений + метаданные | `exercise-catalog`, `comprehensive-exercise-db`, `exercise-biomechanics-db`, `exercise-variation` | REUSE+EXTEND (региональная гипертрофия уже частично есть) |
| Интенс-техники (топ-сет/drop) | `set-scheme-engine`, `advanced-methods` | REUSE+EXTEND (добавить rest-pause/myo/BFR/lengthened) |
| Визуализация/календарь/CSV | `training-visualization`, `training-calendar` | REUSE+EXTEND |
| Пик/тэйпер/блоки | `block-designer`, `advanced-methods`, `complete-program-library` | REUSE+EXTEND |
| PED-данные (ААС/инсулин/MGF/IGF/ГР) | `pharma-database`, `system-mechanisms`, `hormonal-axes`, `support-database` | REUSE данные; NEW — адаптация тренировки |
| Метрики сессии | `session-metrics-engine` | REUSE+EXTEND под LMS-метрики |

## Этап AUD — аудит + ПОЧИНКА существующего (первый, обязателен)
> Существующий тренировочный блок работает некорректно. Цель: найти что есть, найти что сломано, починить, и только потом reuse.
- [x] **AUD0** Карта: каждый training-engine → экспорты/назначение/качество/пробелы → `docs/TRAINING_AUDIT.md`.
- [x] **AUD1** Найти дубли (cycle templates vs program library vs exercise catalog vs selectors) → план унификации реестров.
- [x] **AUD2** Проверить cross-dependencies и циклические импорты (аналог ТЗ-пункта 18).
- [x] **AUD3** **Поиск багов расчётов**: прогнать каждый движок на тест-кейсах (RIR/прогрессия/e1RM/объём MEV-MAV-MRV/делод/интенсивность/сплит-генерация/периодизация) → список некорректных результатов.
- [x] **AUD4** **Починка**: исправить некорректные формулы/логику в существующих движках (не переписывать с нуля — чинить).
- [x] **AUD5** **Верификация**: повторно прогнать тест-кейсы → контрольные значения корректны; зафиксировать эталонные кейсы в `docs/TRAINING_AUDIT.md`.

## Этап A — СРЦ-движок (NEW: формулы + данные)
- [x] **A0** [NEW] Декомпилировать `vbaProject.bin` (cycle1) → формулы/константы (Инт.Ф, Инт.Отн, Ф+Б, УОИ, коэф.тяжести, время).
- [x] **A1** [NEW] node-парсер 30 xlsm → каталог ~250 упражнений, раскладки в TS, база ~800 продуктов, ПКТ-протоколы.
- [x] **A2** [NEW] `lms-metrics.engine.ts` — формулы LMS; **интеграция в `session-metrics-engine`** (не параллельный движок).
- [x] **A3** [NEW] `lms-progression.engine.ts` — PM_нед=PM0*(1+k)^нед; связка с `progression.engine` (estimate1RM уже есть).

## Этап B — 30 циклов как данные + селектор
- [x] **B1** [NEW] `lms-exercises.ts` — каталог СРЦ-упражнений; **merge с `exercise-catalog`** (дедуп по именам).
- [x] **B2** [NEW] `lms-cycle-index.ts` — мета 30 циклов; **унификация с `cycle.engine.CYCLE_TEMPLATES`** (единый реестр шаблонов).
- [x] **B3** [NEW] Шаблоны раскладок: cycle-01..16 + 6 блочных + 6 встраиваемых — обезличенные.
- [x] **B4** [REUSE+EXTEND `split-selector`] `lms-selector` — авто-подбор по параметрам + rationale (паттерн selector уже есть).
- [x] **BR** ДЕБРЕНДИНГ — убрать авторов/эмблемы/приставки из кода/комментариев/имён/UI.

## Этап BB — бодибилдинг (преимущественно REUSE+EXTEND + немного NEW)
- [x] **BB0** [REUSE+EXTEND `training-methodology`+`performance-analytics`] Единый фасад volume-landmarks с пересчётом под длину ротации; объём = тяж(первичная)+памп(добивка).
- [x] **BB1** [REUSE `rir-matrix.engine`] RIR-прогрессия нед1 RIR3→нед4 RIR0→deload.
- [x] **BB2** [REUSE `periodization-designer`+`training-periodization`] accumulation→intensification→deload.
- [x] **BB3** [NEW] `bb-split-patterns.ts` — rolling (3/1/3/1, 4/1, 2/1/2/1, 6/1, PPLx2) И 7-дн тяж/памп/отдых РАСПИСАНИЯ (ТПТ-О-ТТП). Поверх существующих `split-engines`.
- [x] **BB4** [NEW] `bb-day-types.ts` — тяж/памп/лёг + первичная/добивочная мышца с ротацией пар (квадр↔бицепс бедра, грудь↔плечи) + `forceDayType` (НОГИ=всегда тяж).
- [x] **BB5** [NEW] `bb-cycles` библиотека — уровень×цель × (FullBody/UL/PPL/Push-Pull + продвинутые 3/1/3/1, 4/1, ТПТ-О-ТТП); **добавить в `program-templates`/`complete-program-library`** (не отдельный реестр).
- [x] **BB6** [NEW] `bb-builder.engine.ts` — генерация ротации: расписание→день→группы(forceDayType)→[первичная(тяж,MAV-тяж)]+[добивка(памп,MEV)]; RIR→репы/сеты; вес через RIR; контроль тяж+добивка=MAV.
- [x] **BB7** [REUSE+EXTEND `split-selector`] `bb-selector` — подбор по уровню/цели/частоте/оборудованию/курсу/дням + rationale.
- [x] **BB8** [REUSE `session-metrics-engine`] + гипертрофо-метрики (объём первич/добивка, ср.RIR, proximity-to-failure, баланс тяж/памп, число тяж/памп-сессий).
- [x] **BB9** [REUSE+EXTEND `training-methodology.getVolumeByMuscle`] `bb-weakpoint` — отстающие группы→MAV↑/частота↑; блоки специализации.
- [x] **BB10** [REUSE `exercise-biomechanics-db`+`exercise-variation`] `bb-exercise-selector` — региональная гипертрофия (уже частично есть) + подбор по оборудованию/биомеханике + замены под суставы.
- [x] **BB11** [REUSE+EXTEND `set-scheme-engine`+`advanced-methods`] `bb-intensity-techniques` — дропсеты(rest-pause/myo/BFR/lengthened partials/мех.дроп/пре-пост-истощение).
- [x] **BB12** [NEW] `bb-tempo-rest.ts` — темп (3-1-1-0), TUT, интервалы отдыха (тяж 2-4 мин / памп 45-90 с).
- [x] **BB13** [REUSE `warmup-engine`] + мобилити/преабилити плеч/бёдер/низа спины.
- [x] **BB14** [REUSE `readiness.engine`+`log-analytics-progression`+`adaptWeekForReadiness`] авто-регуляция между мезоциклами.
- [x] **BB15** [NEW] `bb-ped-adaptation.ts` — адаптация цикла под курс: ААС+ИНСУЛИН+MGF+IGF-1+ГР; читает состав из `pharma-database`/`course` (данные есть, логики NEW).
- [x] **BB15b** [NEW] `bb-ped-effects.ts` — матрица эффектов PED на MRV/частоту/объём/пери-WO питание.
- [x] **BB15c** [REUSE `risk-engine`+`pharma-interactions`] `bb-ped-risk` — инсулин гипогликемия, ГР инсулинорез., IGF/MGF совместимость.
- [x] **BB16** [REUSE `nutrition.engine`+`nutrition-periodization`] связь массонабор/рельеф + ТDEE/PAL; пери-WO углеводы при инсулине.
- [x] **BB17** [NEW] `bb-demographics.ts` — женский (ягодицы/низ, фазы цикла), мастера (MRV↓, преабил), авто-подбор сплита по доступным дням (2→FullBody…6→PPLx2) — поверх `split-selector`.
- [x] **BB18** [REUSE+EXTEND `exercise-catalog`+`comprehensive-exercise-db`] изоляция/кабель/машины + метаданные (первичная/вторичная, подраздел, оборудование, биомеханика, риск).
- [x] **BB19** [REUSE `training-visualization`+`training-calendar`] тепловая карта мышц, объём на группу, тяж/памп-календарь; лог факт vs план, реализованный RIR, авто-корректировка.

## Этап T — кросс-режимный (преимущественно REUSE+EXTEND)
- [x] **T0** [REUSE+EXTEND `training-cycle-planner`+`cycle.engine`] `macrocycle` — годовое планирование, авто-чекейнг фаз.
- [x] **T1** [REUSE+EXTEND `block-designer`+`advanced-methods`] `peak-taper` — пик/тэйпер, mock meet, соревновательный день.
- [x] **T2** [REUSE `progression.estimate1RM`+`log-analytics-progression`] `progress-tracking` — e1RM, трек, прогноз на дату соревнований.
- [x] **T3** [NEW] `session-player.tsx` — экран выполнения: упражнение/сет, таймер+Haptic, RPE/RIR ввод, переход.
- [x] **T4** [NEW] `plate-calculator.ts` — блины на штангу под рабочий вес.
- [x] **T5** [REUSE `session-metrics-engine`+`training-calendar`] `plan-vs-fact` — сравнение метрик план/факт.
- [x] **T6** [REUSE `genetic-deload-technique`+`overtraining-scheduler`+`progression.getDeloadRecommendation`] `auto-deload` — триггеры разгрузки (MRV/спад/readiness/пик).
- [x] **T7** [NEW] `cardio.engine.ts` — zone2/HIIT; интеграция с PAL и `nutrition.engine`.
- [x] **T8** [REUSE `readiness.engine`+`recovery-techniques-encyclopedia`] `recovery-tracker` — сон/ЧСС/DOMS/HRV → capacity.
- [x] **T9** [NEW] `exercise-demo.ts` — медиа упражнений (изображения/ссылки), браузерно.

## Этап PL — пауэрлифтинг-специфика (для СРЦ-режима)
- [x] **PL0** [NEW] `weakpoint-pl.ts` — мёртвая точка жима/приседа/тяги → ассистентные (дожимы 3/5/8/10, жим в раме, тяга из ямы/с плинтов, присед в широкой/на груди).
- [x] **PL1** [REUSE+EXTEND `training-methodology`+`advanced-methods`] `periodization-methods` — linear/undulating/conjugate/block, цепи/резина, cluster, PAP.
- [x] **PL2** [NEW] `technique-cues.ts` — ключи техники + замены под антропометрию/травмы; мобилити-скрининг.

## Этап R — реструктуризация планировщика
- [x] **R0** [REUSE `training.engine`] `enum PlanningMode { SRC_AUTO, CONSTRUCTOR }`.
- [x] **R1** Реструктуризация `TrainingScreen` — переключатель; СРЦ=[Каталог,Мой план,Графики], Конструктор=[План,Упражнения,Калькуляторы,Дневник,Циклы]; без дублей.
- [x] **R2** [REUSE `session-metrics-engine`] унификация метрик для обоих режимов; общий формат `SRExercise/SRSet`.
- [x] **R3** [REUSE `split-selector`] fallback Конструктора; авто-подбор = `lms-selector`(сила)/`bb-selector`(гипертрофия).
- [x] **R4** Связь профиля — planningMode + цель → routing.
- [x] **R5** Дедупликация — программа в одном месте (AGENTS.md критич.баг #1).

## Этап C — UI СРЦ
- [x] **C1** `SRCCyclesScreen` — каталог карточек + фильтры + условия соответствия.
- [x] **C2** `SRCPlanScreen` — ввод PM → 12(4) недель × дни с расч. весом, тоннаж, КПШ, интенсивность.
- [x] **C3** Интеграция в навигацию — раздел СРЦ в TrainingScreen.

## Этап D — метрики и графики
- [x] **D1** [REUSE `session-metrics-engine`] калькулятор LMS-показателей в дневник.
- [x] **D2** [REUSE `training-visualization`] графики КПШ/тоннаж/инт/УОИ + BB объём первич/добивка, баланс тяж/памп, тепловая карта, прогресс 1RM.

## Этап E — merge контента
- [x] **E2** [REUSE `pct-planner`+`FertilityPCTScreen`] связать ПКТ-протоколы (ХГЧ 500 МЕ 2р/нед 3/1, каберголин).
- [x] **E3** Дневник вес/сон/питание/курс → связать с ProfileScreen (замеры/сон/давление).

## Этап F — проверка и сборка
- [x] **F** `tsc --noEmit` ✓, `vite build` ✓, тест на Telegram WebView.

## Рекомендуемый порядок
AUD0→AUD1→AUD2 → A0→A1→A2→A3 → B1→B2→B3→B4→BR → BB0..BB8 (ядро, REUSE) → R0..R5 → C1..C3→D1..D2 → BB9..BB19, T0..T9, PL0..PL2 → E1..E3 → F.

## Правила выполнения (из AGENTS.md)
- После каждого этапа: `tsc --noEmit` + `vite build` (`$env:NODE_OPTIONS='--max-old-space-size=2048'`).
- Mobile-First: относительные единицы, Flexbox/Grid, тач-зоны ≥44×44px, без десктопных hover.
- Telegram WebView: `WebApp.expand()`/`viewportChanged`/`ready()`/`BackButton`/`Haptic`.
- Изображения без `object-fit: cover` для фото.
- Glass (`backdropFilter`) не использовать — `rgba(24,24,27,0.15)` + тонкая граница.
- Дебрендинг (BR): без авторов/эмблем/приставок.
- Данные: IndexedDB + `useDataLink`; типы в `core/types.ts`; миграции `core/db.ts` (v7+).
- **MERGE-дисциплина:** ПРИОРИТЕТ — REUSE существующего файла; NEW — только для отсутствующих возможностей; DEDUP — единый реестр (cycles/programs/exercises/selectors).
- **REUSE ≠ доверие как есть:** каждый reused движок проходит AUD3→AUD5 (найти баг → починить → верифицировать) — существующее сейчас некорректно и требует настройки.



## Координация с параллельным агентом (питание + БАД/поддержка)

> Параллельно работает второй агент над блоками **Питание** и **БАД (поддержка)**.

**Границы владения (во избежание конфликтов):**

| Ресурс | Владелец | Наше действие |
|---|---|---|
| src/core/nutrition-database.ts (база продуктов) | **Совместно** | Только APPEND новых продуктов (Этап E1: +800 из СРЦ). Не реструктурировать файл, не трогать чужие правки. Добавлять в отдельную секцию в конце. |
| src/ui/screens/NutritionScreen.tsx, nutrition UI | Второй агент | НЕ трогать |
| src/engines/nutrition*.engine.ts, 
utrition-ocr-parser, 
utrition-v2-data, contraindications | Второй агент | НЕ трогать (только READ: TDEE/PAL/макросы из 
utrition.engine) |
| src/engines/support.engine.ts, src/data/support-database.ts, SupportScreen.tsx | Второй агент | НЕ трогать (READ для PED-взаимодействий через pharma-interactions) |
| src/core/pharma-database.ts, pct-planner, FertilityPCTScreen, isk-engine | Совместно (фарма) | Координировать; PED-адаптация (BB15) только READ данных, не править структуру без согласования |

**Правила для нашего блока:**
1. b-nutrition-integration (BB16) — только ЧИТАЕТ 
utrition.engine (TDEE/PAL/макросы), не модифицирует.
2. E1 (+800 продуктов) — APPEND-only в 
utrition-database.ts, в отдельную секцию «// === SRC IMPORT ===», не пересортируем существующие записи.
3. b-ped-risk (BB15c) — READ isk-engine/pharma-interactions, не правим их внутренности.
4. Перед любым изменением shared-файла проверять свежие правки второго агента (git status / pull) чтобы не затереть.
5. Все наши новые файлы — в src/engines/lms/, src/data/lms-cycles/, src/ui/screens/SRC*.tsx (изолированные пути, нулевой конфликт).
## Интеграция RecoveryScreen + TrainingToolkitScreen (существующие движки → план)

> Аудит показал: RecoveryScreen.tsx (11 вкладок) и TrainingToolkitScreen.tsx (10 вкладок) уже
> подключают богатые движки, которые покрывают часть шагов BB/T/PL. Эти движки СТОЯЩИЕ и содержат
> полезную информацию — интегрируем их в единый тренировочный блок вместо пересоздания.

### Карта: шаг плана → существующий движок (REUSE, не NEW)

| Шаг плана | Существующий движок (экран) | Экспорты | Решение |
|---|---|---|---|
| **T3 session-player** | workout-logger.engine + diary-engine (TrainingToolkit) | startSession/logSet/finishSession, createSession/generateInsights | REUSE — экран выполнения СРЦ/BB-плана поверх workout-logger |
| **T4 plate-calculator** | gym-competition.engine (TrainingToolkit) | calculatePlates, warmupPlateSequence, getPlateLoadingOrder | REUSE |
| **T1 peak-taper / meet** | peaking-engine + gym-competition.engine | generatePLPeaking/BBPeaking, generateAttemptStrategy, generateCompetitionTimeline, selectWeightClass | REUSE |
| **BB14 / T6 autorégulation** | utoregulation-engine (TrainingToolkit) | autoregulate (Volume/Intensity/Frequency/Exercise decisions) | REUSE |
| **T8 recovery-tracker** | ecovery-optimization.engine + iohacking-environment.engine (RecoveryScreen) | analyzeRecovery, shouldTrain, getBiohackingProtocols | REUSE |
| **BB13 warmup/prehab** | ederation-grip-mobility.engine + warmup-engine (RecoveryScreen) | getMobilityFlows, getPostureAssessments, getAllCorrectives | REUSE |
| **BB10 exercise-selector** | movement-engines + iomechanics-risk-engine (TrainingToolkit/RecoveryScreen) | getMuscleSynergy, getJointStress, assessSafety, analyzeBiomechanics | REUSE |
| **PL2 technique-cues** | ederation-grip-mobility.engine | getGripProtocols, getPostureByDeviation, getAllCorrectives | REUSE |
| **constraints/orthopedic** | orthopedic-load-engines (TrainingToolkit) | computeOrthopedicConstraints, distributeWeeklyLoad | REUSE (лимиты сессии, распределение недельной нагрузки) |
| **rep-pattern** | ep-pattern.engine (TrainingToolkit) | selectRepPattern | REUSE (схемы повторений) |
| **deload techniques** | genetic-deload-technique.engine (RecoveryScreen) | generateDeload, getAllTechniques, getCues | REUSE (T6/FIX deload) |
| **overtraining** | overtraining-scheduler.engine (RecoveryScreen) | detectOvertraining | REUSE (T6 триггеры) |
| **prehab/blood** | injury-cycle-blood.engine (RecoveryScreen) | getAllPrehabRoutines, getBloodPanels | REUSE (BB13 prehab + E2 кровь) |

### Новый шаг плана: INT — интеграция экранов
- [x] **INT0** Аудит RecoveryScreen (11 вкладок: восстановление/детренинг/перегрузка/протоколы/...) и TrainingToolkitScreen (10 вкладок: движение/пикинг/авторегуляция/блоки/...) → карта «вкладка → движок → данные» в docs/TRAINING_AUDIT.md.
- [x] **INT1** Подключить workout-logger + diary-engine как экран выполнения (T3) для СРЦ- и BB-планов: загрузить план → startSession → logSet по каждому workSet → finishSession → метрики факт vs план.
- [x] **INT2** Подключить gym-competition.engine (calculatePlates) в UI СРЦ/BB-плана (T4) — блины под рабочий вес.
- [x] **INT3** Связать peaking-engine + gym-competition (attempts/timeline) с lms-selector/bb-selector для соревновательной подготовки (T1) — выход на пик + план подходов.
- [x] **INT4** autoregulation-engine → корректировка BB/СРЦ-плана по readiness/log (BB14/T6): volume/intensity/frequency/exercise decisions.
- [x] **INT5** recovery-optimization + biohacking → RecoveryScreen как источник readiness для auto-deload (T8); federation-grip-mobility → warmup/prehab/technique (BB13/PL2).
- [x] **INT6** movement-engines + biomechanics-risk + orthopedic-load → BB10 exercise-selector и лимиты сессии (constraints) для СРЦ/BB.

### Перетегировка шагов (NEW → REUSE)
- T3 session-player: **NEW → REUSE** workout-logger + diary-engine
- T4 plate-calculator: **NEW → REUSE** gym-competition.engine
- T1 peak-taper: REUSE peaking-engine (+ block-designer)
- BB14/T6 autorégulation: REUSE autoregulation-engine (+ readiness/log-analytics)
- T8 recovery: REUSE recovery-optimization + biohacking-environment
- BB13 warmup/prehab: REUSE federation-grip-mobility + warmup-engine
- BB10 exercise-selector: REUSE movement-engines + biomechanics-risk-engine
- PL2 technique-cues: REUSE federation-grip-mobility
- T6 auto-deload: REUSE genetic-deload-technique + overtraining-scheduler + autoregulation-engine
- genuinely NEW осталось: BB3 split-patterns, BB4 day-types, BB6 bb-builder, BB11 intensity-techniques (расширить set-scheme), BB12 tempo/TUT, BB15 PED-adaptation, BB17 demographics, T0 macrocycle, T7 cardio, T9 exercise-demo, PL0 weakpoint-pl, PL1 periodization-methods (расширить), C-UI.
## Этап G — развитие цикла + UI/рендер-полировка (после F, по результатам runtime-теста)

> Runtime-рендер (puppeteer-core + Chrome) подтвердил: приложение грузится, SRCBBScreen рендерится,
> план/демо/графики/сессия работают без page-errors. Но вскрылись пробелы наполнения и оформления.

- [x] **G1** Дальнейшее развитие цикла: в плане по СРЦ выдаются только 2 недели (`builtSrc.weeks.slice(0,2)`) —
  показать ВСЕ 12 недель с навигацией по неделям; описания «как и что дальше» по фазам (base→build→peak→deload);
  система считает весь цикл сама на основе формул из исходных файлов (lms-builder: PM_нед=PM0×(1+k)^нед,
  mesocyclePhaseForWeek, workWeight) — данные уже есть, UI их скрывал. + блок «что после цикла» (переход/следующий мезо).
- [x] **G2** Оформление: карточки/типографика/отступы SRCBBScreen; таблица дня (упражнение × сет: вес×пов×%×RIR);
  читаемые подписи вместо «81.6кг/81.6кг/...». Mobile-first, тёмная тема, акцент #00e68a.
- [x] **G3** Графики: 4 раздельных визуализации (Тоннаж / КПШ / Инт.отн+УОИ / BB объём тяж-памп) вместо 1 canvas.
- [x] **G4** Вывод тренировочной программы: полноценная неделя-таблица с раскладкой подходов, %ПМ, КПШ/тоннаж на день,
  итоги по неделе и по циклу; кнопки «◀ Неделя N / Неделя N ▶».

