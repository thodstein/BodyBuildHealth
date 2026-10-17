# BB-AUTO: полный анализ, реестр дефектов и план исправлений (на утверждение)

> Дата составления: 2026-10-17  
> Область: BB-Auto (BbAutoConstructor + engines `src/engines/bb/*`, в первую очередь `bb-builder`, `bb-finalize`, `bb-autocoach`, `cycle-to-plan`, `bb-progression-feedback`, `bb-mesocycle-progression`, `bb-recovery-relief`, UI `TrainingScreen_parts/bb-*`).  
> Источник базы: `docs/BB-AUTO-MASTER-PLAN.md`, `docs/BB-AUTO-PRO-AUDIT-REPORT.md`, `docs/BB-AUTO-PROFESSIONAL-AUDIT-PLAN.md`, текущий код и тесты.

## 1. Цель

Провести полный аудит BB-Auto: найти все баги, неработающие и неправильные функции, составить утверждаемый план исправлений с приоритетами, зависимостями, DoD и проверками.

## 2. Метод анализа

- Статический анализ кода и импортов по ключевым движкам.
- Сверка с существующими аудитами и мастер-планом.
- Проверка тестового покрытия и попытка запуска `npm test`.
- Проверка `tsc`/APK-маркеров в рамках доступных ресурсов.

Ограничения среды:
- Полный `npm test` упал из-за нехватки памяти (`memory allocation of 959140 bytes failed`).
- `tsc --noEmit` не завершился в отведённое время.
- `git status`/`git diff` местами падали из-за нехватки памяти.

Поэтому план построен на документированном аудите + выборочной проверке кода и должен быть подтверждён targeted-тестами перед каждой волной.

## 3. Текущее состояние

По последнему аудиту (`BB-AUTO-PRO-AUDIT-REPORT.md`, 2026-10-10):
- `src/engines/bb`: 3034 passed / 0 failed.
- UI + manual + annual: 1997 passed / 0 failed.
- `tsc`: 0 ошибок по проекту.
- В репозитории есть незакоммиченный WIP (Android widget, `weakpoint-pl.ts`, `IndividualPlanContext`, `MetabolicHub`, `ArmliftingDiagnosticsHub` и др.). Эти изменения не должны затрагиваться без отдельного решения.

## 4. Классификация дефектов

- **P0**: ломают correctness плана, объём, taper, MRV, безопасность или делают функцию фактически неработающей.
- **P1**: заметные UX/логические дефекты, потеря данных, неправильные расчёты в UI.
- **P2**: мёртвый/дублирующий код, неиспользуемые функции, стилистические и технические долги.
- **PRO**: продвинутые улучшения (авторегуляция, adherence, predicted-vs-actual, recovery relief) — не баги сами по себе, но необходимы для профессионального уровня.

## 5. Реестр дефектов (P0)

| # | Дефект | Где | Суть / риск |
|---|---|---|---|
| P0-1 | `packingV2` opt-in, но `packedSets` не применяется к финальному объёму | `bb-builder.engine.ts:2710-2779`, `bb-finalize.engine.ts:2804/2815` | Упаковка считается, но `enforceSessionRealism` не учитывает её; реальный объём не меняется. |
| P0-2 | Taper не применяется к PPL/cycle/program-путям | `bb-finalize.engine.ts:4907 vs 5208`, `5371`, `5073`, `5141` | `isTaperPrepOrPeakWeek` не учитывает taper для PPL-веток, DC widowmaker, TAG-замены, back-vertical-replacement. |
| P0-3 | Первый тейпер-шаг `×1.0` при флаге `taper:true` | `bb-autocoach.engine.ts:1112-1156` | Объём не снижается, но volume-проходы пропускают неделю; в UI/логах ложь «Taper ×1.0». |
| P0-4 | Cycle/program превышают MRV на ~15% | `cycle-to-plan.ts:1929,3048` | `effectiveSets > cap` допускает `cap * 1.15`, тогда как validator жёстче. |
| P0-5 | `detectGarbageVolume` мёртвое правило | `bb-autocoach.engine.ts:679-692` | IIFE заканчивается безусловным `return true`; проверка недостижима. |
| P0-6 | Возрастная коррекция MRV не применяется к cycle/program | `bb-demographics.ts:51/68`, `bb-builder.engine.ts` | `mastersAdjust`/`adjustVolumeForDemographic` не доходят до финального объёма. |
| P0-7 | Manual constructor занижает объём ~20 сетов и `volumeGoal:'mav'` | `manual-draft.engine.ts:24-70,188` | Планы ручного конструктора не совпадают с BB-Auto по объёму. |
| P0-8 | Rate-limiter ramp скачок объёма 55-67% между неделями | `bb-builder.engine.ts:3564-3600` | Нарушает принцип постепенного прогресса; нужен `lastAppliedWeekMult` + cap 20%. |
| P0-9 | MEV-калибровка не доходит до finalize для cycle/program | finalize/cycle-to-plan | Floor/feeder/repair используют некалиброванные landmarks. |
| P0-10 | Прогрессивный MEV не учитывает prior plans | `bb-mesocycle-progression.engine.ts` | Одинаковый delta для всех мышц; нужен учёт предыдущих планов. |

## 6. Реестр дефектов (P1)

| # | Дефект | Где | Суть |
|---|---|---|---|
| P1-1 | Contest-prep: `experience`/`glycogenLevel` не влияют на taper | `BbAutoConstructor.tsx:694-742` | `buildTaperModifiers` и `glycogenAdjustedDose` не применяются. |
| P1-2 | Save/restore теряет 12 параметров ввода | `BbAutoConstructor.tsx:2717-2757, 2820-2896` | Не сохраняются trainingYears, injuries, mobility, favorite/excluded, workMax и др. |
| P1-3 | `metrics` использует `mrvMultiplier = 1` | `BbAutoConstructor.tsx:1802` | Игнорирует `plan.mrvMultiplier` и PED-множитель. |
| P1-4 | Диагностика качества: ложные срабатывания + отсутствие action-row | `BbAutoConstructor.tsx:3691-3714` | Нужен фильтр и `renderActionRow`. |
| P1-5 | Programs-конструктор игнорирует `ped`/`split` | `bb-step-adjust.tsx:241` | Разбиение по дням строится неверно. |
| P1-6 | CSV не экранирует формулы; print-HTML не экранирует `& < > " '` | `BbAutoConstructor.tsx:3168,3011` | Риск инъекций/поломки экспорта. |
| P1-7 | `planStartWeek` не учитывается в generic-планах | `bb-builder.engine.ts:4828-4831` | `bb-plan-fact` и `bb-visual` сдвигаются на 1. |
| P1-8 | `autoUpdateWeakPoints` не обновляет `weakPoints` | `bb-builder.engine.ts:4634-4652` | Обновление не доходит до следующего плана. |
| P1-9 | adherence считает по фактическим сессиям, а не elapsed weeks | `bb-progression-feedback.engine.ts:317-360` | Ложные регрессии/прогрессии. |
| P1-10 | e1RM predicted-vs-actual: null-guard | `bb-plan-fact.engine.ts` | Риск `Cannot read properties of null`. |
| P1-11 | Recovery relief: pain/soreness игнорируются | `bb-recovery-relief.engine.ts` | Нет снижения объёма при боли/крепатуре. |
| P1-12 | VBT-пороги захардкожены | `bb-quality-sections.tsx:64-78` | Не зависят от профиля/усталости. |
| P1-13 | `workMax['legs']` unknown muscle key | engines/UI | Падает на 80 вместо 140. |

## 7. P2 / технический долг

- Мёртвый/неиспользуемый код: `computeOverloadTargets`, `ensurePPLMidDeltFinisher`, `ensurePPLRearDeltFinisher`, `explainBBSelection`, `isRepSchemeId`, `BB_RED_FLAGS_EMPTY`, `hasBothPhases`, `idealReevesMap`, `SUBGROUP_LABEL_RU`, `splitForDays`, `jointGuardTempoOverride`, `SPECIALIZATION_MAX_BLOCK_WEEKS`, `cnsFor`, UI-хелперы (`expandedMuscles`, `strategySafe`, `catEx`, `distText`, `past`, `disabled=false`).
- Дублирование `phaseExerciseMix` между `bb-autocoach` и `bb-builder`.
- Catch-блоки с `console.warn` вместо структурированного логирования: `bb-builder.engine.ts:4837,3062,3910`, `bb-diary-feedback.engine.ts:128,132,193`, `bb-contest-prep-sync.ts:94`.
- `bb-insulin-window.engine.ts` помечен `@deprecated`, но всё ещё импортируется.
- `lengthened_partials` и `rest_pause_cluster` объявлены, но не применяются в `applyIntensityTechniqueToExercise`.
- `freqOptResult` вычисляется, но не используется в UI.
- `onGoalChange` ранее был no-op; исправлено, но нужен regression-тест.
- Hardcap 10 упражнений L/R; нужен `sessionLimitsFor`.

## 8. Неработающие/неправильные функции (отдельный список)

1. `packingV2` — включается, но не меняет результат.
2. `detectGarbageVolume` — никогда не срабатывает.
3. `mastersAdjust`/возрастная коррекция — не доходит до финала.
4. `freqOptResult` — вычисляется и не отображается.
5. `bb-insulin-window` — deprecated, не интегрирован.
6. `lengthened_partials` / `rest_pause_cluster` — не применяются.
7. `autoUpdateWeakPoints` — не обновляет `weakPoints`.
8. `suggestFeeders` — игнорирует `equipment`.
9. `cross-meso peakWeights` — не учитывает `peakWeek`.
10. `applyTaperToFinalWeeks` — не идемпотентен.
11. `adherence` — считает по сессиям, а не по прошедшим неделям.
12. `pain010`/soreness — не влияют на объём.
13. `workMax['legs']` — неизвестный ключ мышцы.
14. `planStartWeek` — игнорируется в generic-планах.

## 9. План работ (на утверждение)

### Волна 0 — стабилизация и актуализация (1-2 дня)
- Обновить реестр дефектов по текущему коду (проверить, что P0-1..P0-10 ещё актуальны).
- Запустить targeted-тесты по `bb-auto-*`, `bb-builder`, `bb-finalize`, `cycle-to-plan`, `bb-progression-feedback`.
- Зафиксировать baseline: количество тестов, `tsc`, APK-маркеры.
- Не трогать незакоммиченный WIP.

**DoD:** документ с актуальным статусом каждого дефекта (актуален/исправлен/частично).

### Волна 1 — P0 correctness (3-5 дней)
- P0-1 packingV2: реально применить `packedSets` в finalize.
- P0-2 taper для PPL/cycle/program.
- P0-3 идемпотентный taper (`week.taperApplied`, `taperVolumeMult`).
- P0-4 MRV cap выровнять с validator.
- P0-5 оживить `detectGarbageVolume`.
- P0-6 возрастная коррекция в финале.
- P0-7 manual constructor объём.
- P0-8 rate-limiter cap.
- P0-9 MEV calibration в finalize.
- P0-10 progressive MEV.

**Проверки:** `bb-auto-audit-2026-10-p0`, `bb-builder`, `bb-finalize`, `cycle-to-plan`, `training-focus-and-taper`, targeted UI.

### Волна 2 — P1 UX/данные (3-4 дня)
- P1-1..P1-6: contest-prep, save/restore, metrics multiplier, diagnostics action-row, programs split, CSV/print escaping.
- P1-7..P1-8: planStartWeek, autoUpdateWeakPoints.
- P1-9..P1-11: adherence elapsed-weeks, e1RM null-guard, recovery relief.
- P1-12..P1-13: VBT thresholds, workMax legs.

**Проверки:** UI bb-тесты, `bb-auto-smoke`, `bb-auto-annual-ctx`, `bb-auto-apk-controls`, `bb-prep-cycle`.

### Волна 3 — PRO-уровень (4-6 дней)
- G1 per-muscle MEV..MRV + wave factor + MRV trim.
- G8 MEV calibration cycle/program.
- G10 progressive MEV.
- G9 predicted-vs-actual e1RM + `bbStrengthBadge`.
- G7 replan engine.
- G5 recovery relief интеграция в UI.
- adherence elapsed-weeks.

**Проверки:** новые/расширенные тесты, полный bb-круг (если память позволяет, запускать по частям).

### Волна 4 — P2 cleanup (2-3 дня)
- Удалить мёртвый код (только после source-guard тестов).
- Убрать deprecated `bb-insulin-window` или интегрировать.
- Применить `lengthened_partials`/`rest_pause_cluster` или удалить.
- Заменить `console.warn` на структурированный лог.
- Удалить дубль `phaseExerciseMix`.

**Проверки:** `tsc`, targeted tests, APK-маркеры.

## 10. Риски и зависимости

- Нехватка памяти при полном прогоне тестов → запускать по модулям/папкам.
- Незакоммиченный WIP может конфликтовать → изолировать изменения.
- Большие файлы (`bb-builder.engine.ts` 417k, `bb-finalize.engine.ts` 408k) → высокий риск регрессий; нужны source-guard тесты.
- Некоторые P0 уже могли быть частично исправлены после аудита 2026-10-10 → сначала актуализация.

## 11. Вопросы на утверждение

1. Утверждаем ли приоритет P0 → P1 → PRO → P2?
2. Начинаем с Волны 0 (актуализация) или сразу с P0-1/P0-2?
3. Можно ли трогать незакоммиченный WIP в Android/IndividualPlan?
4. Какой уровень тестирования обязателен перед merge: targeted или полный круг?
5. Нужно ли сохранять deprecated `bb-insulin-window` для совместимости?

## 12. Критерии приёмки итогового результата

- Все P0 закрыты и покрыты тестами.
- `tsc --noEmit` = 0.
- Targeted bb/UI тесты = 0 failed.
- APK-маркеры проходят.
- Документация обновлена (AGENTS/audit archive).
- План исправлений согласован с пользователем.