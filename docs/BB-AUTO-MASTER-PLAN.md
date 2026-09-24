# BB-AUTO MASTER PLAN — единый план доводки ББ-авто

> **Статус:** единственный источник правды по ББ-авто (конструктор + конвейер сборки).
> Все прежние BB-auto планы удалены (§1), открытые пункты перенесены сюда.
> **Дата:** 2026-09-23 · **Владелец:** сессия аудита/исполнения.
> **Правила:** только Edit/Write; чужие WIP не трогать; коммит — только по явной команде
> (pathspec своих файлов); **математика планов меняется только по согласованию** (§7);
> после каждой волны — прогоны vitest + `tsc --noEmit`.

---

## §0. Факт-база на старте (проверено прогонами)

| Проверка | Результат |
|---|---|
| Движки `src/engines/bb` | **253 файла, 2826 passed / 0 failed** (20 skipped), 428 с |
| UI ББ (`TrainingScreen_parts/__tests__/bb-*`) | **24 файла, 200 passed / 0 failed**; 1 unhandled-таймер в `bb-diagnostics-pro5` |
| `tsc --noEmit` | **0 по проекту** |
| git worktree | незакоммиченных файлов ББ нет (в worktree — чужой nutrition-WIP) |

Вывод: система зелёная. Остаток — разрывы проводки «показано ≠ применяется», мёртвый код,
несколько незакрытых пунктов прежних планов. Математика капов/MRV/фаз не пересматривается
(кроме явно помеченного §7).

---

## §1. Что удалено и куда перенесено

Удалены (содержимое сведено в §2–§7):
`BB-AUTO-ANALYSIS`, `BB-AUTO-EXHAUSTIVE-PRO-PLAN`, `BB-AUTO-FULL-AUDIT-2026-08-28`,
`BB-AUTO-GENERATION-MAX-PLAN`, `BB-AUTO-MAX-FINAL-PLAN-2026-08-22`,
`BB-AUTO-PROFESSIONAL-AUDIT-2026-09-02`, `BB-AUTO-PROFESSIONAL-LEVEL-PLAN`,
`BB-AUTO-QUALITY-PLAN`, `BB-AUTO-REBUILD-AND-TUNING-PLAN`, `BB-AUTO-STEPS-DEDUP-PLAN`,
`BB-FEMALE-POSTERIOR-QUALITY-PLAN`, `BB-SPECIALIZATION-MULTIBLOCK-PLAN`,
`FEMALE-CONTEXT-BB-PL-AUTO-PLAN`, `BB-CONTEST-PREP-PLAN`, `BB-PREP-PRO-PLAN`,
`BB-TAPER-PRO-PLAN`, `BB-TAPER-PRO-2`, `BB-TAPER-PRO-3-PLAN`, `BB-TAPER-PRO-4-PLAN`.

Не тронуты (другие подсистемы, остаются): `BB-DIAGNOSTICS-*`, `BB-MOVEMENT-DIAGNOSTICS-PRO-PLAN`,
`BB-CORRECTIVE-HUB-PRO-PLAN`, `BB-DIAGNOSTICS-UNIFIED-PLAN`, `BB-DIAGNOSTICS-EXERCISE-EFFECT-PLAN`.

Проверено: ссылки на удалённые доки остались только в комментариях исходников/тестов
(исторический контекст, коду не мешают) — снос документов безопасен.

---

## §2. P0 — Волна 1: мосты и «показано = применяется»

### 2.1. Мост «Библиотека → ББ-авто» доводит программу ✅/❌
- **Корень:** `ProgramsTab.tsx:84` шлёт `kind:'program'` (SRCycleTemplate); приёмник
  `BbAutoConstructor.tsx:1316-1332` делает `setCustomProgram(null)` + `setCustomCycle(cycle)`,
  а сборка (`:2139`) для `bbSource==='program'` использует только `customProgram` → флеш
  «Выберите цикл или программу из библиотеки» (`:2220-2224`).
- **Фикс:** в приёмнике конвертировать SRCycleTemplate → FullProgram
  (`cycleTemplateToFullProgram`) и применять через `applyProgramToBb` (единый путь библиотеки);
  для формы `{program}` (CardioManageStep:133) принимать FullProgram напрямую (без `meta.id`).
- **Тест:** bridge-тест: payload `program` (SRCycleTemplate и `{program}`) → программа
  становится `customProgram`, сборка проходит (или хотя бы состояние выставляется без флеша).

### 2.2. Pending-мост читается при монтировании + очистка
- **Корень:** у ББ нет `getPlannerApply()`/`clearPlannerApply()` (у Arm/Combat/StrengthSport/PL есть).
- **Фикс:** в mount-эффекте прочитать pending (маршрутизировать через тот же обработчик),
  затем `clearPlannerApply()` (как `SRCBBScreen.tsx:870-881`), чтобы payload не «жил вечно»
  и не подхватывался другими экранами.
- **Тест:** source-guard (импорты `getPlannerApply`/`clearPlannerApply`) + поведенческий SSR:
  payload в `he_planner_apply` до рендера → состояние обновилось, ключ очищен.

### 2.3. Редактор интенсив-техник реально применяется
- **Корень:** `bb-step-adjust.tsx:398-410` пишет `exercise.technique`, потребители читают
  `workSets[last].technique` (`bb-technique-display.ts:57-62`, `bb-report.engine.ts:206`,
  `bb-quality-weekly.engine.ts:682`, `SessionPlayer` через `:2553`); id `myo_rep`/`21s`
  неканоничны (движок: `myo_reps`/`twenty_ones`); подпись `:422` обещает применение.
- **Фикс:** в `applyEditsToPlan` (`BbAutoConstructor.tsx:2599-2604`) писать канонический id
  в **последний workSet** (`lastSet.technique`) и синхронизировать верхнеуровневое поле;
  выбор в селекторе читать из `lastSet`; заменить id в опциях на канон.
- **Тест:** SSR/юнит: правка техники → `workSets[last].technique === 'myo_reps'` (и отображение).

### 2.4. Селект «Направление» в годовом планировщике
- **Корень:** `BbAutoConstructor.tsx:4026` `onGoalChange={() => undefined}`.
- **Фикс:** обработчик принимает только `bodybuilding`; прочие — честный флеш
  «ПЛ-макро строится в ПЛ-авто». Молчаливый no-op убрать.

### 2.5. Лимит 10 упражнений → движковый
- **Корень:** `BbAutoConstructor.tsx:2342` и `:2423` — hardcap 10 глушит L/R-добивку
  (`continue`) и лабораторные предпочтения при капах 15–20 (advanced/enhanced).
- **Фикс:** считать `sessionLimitsFor({level, trainingYears, onCourse, trainingVolumeMode})`
  и использовать `maxExercises` (+фолбэк 10 без данных).
- **Тест:** source-guard на отсутствие `> 10` хардкодов в этих точках.

### 2.6. `freqOptResult` — показать (или убрать)
- **Корень:** считается (`:2544`) и кладётся в state (`:1268`), не читается нигде.
- **Фикс:** компактная карточка в шаге «План»/«Качество» с рекомендациями
  (`optimizeMuscleFrequency` → `rationale[]`, `recommendations[]`), без влияния на сборку.
- **Тест:** SSR: при отсутствии рекомендаций карточка не рисуется; при моке — рисуется.

### 2.7. Тихие `catch` в ключевых путях → честный `console.warn`
- Точки: `bb-builder.engine.ts:4837` (PED-overlay), `:3062` (PED-адаптация),
  `:3910` (автоправка баланса MRV); `bb-diary-feedback.engine.ts:128,132,193`;
  `bb-contest-prep-sync.ts:94`.
- **Фикс:** добавить `console.warn` (без смены поведения). Тесты не затрагиваются.

---

## §3. P1 — Волна 2: движок и честность UI

### 3.1. `bb-insulin-window` подключить (или @deprecated)
- `bb-insulin-window.engine.ts` не подключён: `insulinWindowActive` — import-only
  (`bb-builder.engine.ts:65`), `applyInsulinWindowToPlan` без потребителей.
- **Фикс:** применить окно после PED-overlay в builder (только комментарии/rationale, объём
  не меняется), вход из `pedAdapt` (GH/инсулин дозы). Если тесты PED-сценариев залочат
  комментарии — принять осознанный re-baseline с комментарием «было→стало».

### 3.2. `suggestFeeders(weakPoints, equipment)` учитывает оборудование
- `bb-autocoach.engine.ts:473-498` игнорирует `equipment`, хотя UI передаёт его
  (`ProgramEditorView.tsx:1533`).
- **Фикс:** фильтр по оборудованию с фолбэками (свой вес/блок/штанга) + честная нота,
  если подходящего варианта нет. `equipment=[]` — прежнее поведение (паритет тестов).

### 3.3. P0-C2: cross-meso прогрессия не берёт вес из делода/тейпера
- `bb-mesocycle-progression.engine.ts:71-78` `peakWeek` вычисляется, но `peakWeights` (81)
  собирается по ВСЕМ неделям → веса из делода/пика.
- **Фикс:** `peakWeights` — только из `peakWeek`; объём/имена — по всем неделям (как было).
  Re-baseline затронутых тестов с «было→стало».

### 3.4. `lengthened_partials` / `rest_pause_cluster`: реализовать или не предлагать
- Есть в каталоге (`bb-intensity-techniques.ts:35,40`), схемах (`bb-rep-schemes:65,178,191`)
  и отображении, но в `applyIntensityTechniqueToExercise` (`bb-autocoach.engine.ts:377-454`)
  кейсов нет.
- **Фикс:** добавить кейсы: lengthened_partials — мини-сет частичных в растянутой позиции +
  маркер; rest_pause_cluster — кластеры 2+2+2 с 15 с. Дописать тесты.

### 3.5. UI-правда (числа не врут)
- `bb-step-plan.tsx:108` — `sessionLimitsFor` с полными входами (уровень/стаж/курс/объём).
- `bb-step-params.tsx:407` — «60/18» → фактические 40/15 (6+ лет 44/16).
- VBT-ввод (`bb-quality-sections.tsx:64-78`) — либо подключить в сборку (если есть вход),
  либо честно подписать «справочно, в план не идёт».
- Мост «в питание» (`BbAutoConstructor.tsx:2969-2970`) — калории/белок от веса/пола/цели
  (в payload добавить `weightKg/sex/goal`, note — с пометкой «ориентир»), вместо 2800/180.
- `readiness` (`:3527`) — реальный `recovery`, а не константа 65.
- `packingV2` в program-режиме — честная пометка «не применяется (режим источника)».
- FST-7: хинт, когда движок даунгрейдит (`jointGuardActive`) — «будет standard».

### 3.6. `workMax['legs']` — канонизация
- Легаси-композит `legs` даёт `[BB] defaultWorkMax: unknown muscle key` и фолбэк 80 кг
  вместо quads 140.
- **Фикс:** `DEFAULT_WORKMAX.legs = 140` (алиас) + канонизировать вызовы cycle-пути.

---

## §4. P2 — Волна 3: гигиена, тесты, своп

### 4.1. Мёртвый код (безопасные удаления) — ✅
- Удалены (0 потребителей в проде и тестах): `computeOverloadTargets` (+`OverloadTarget`),
  `ensurePPLMidDeltFinisher`, `ensurePPLRearDeltFinisher` (заменены семейством `ensurePPL*`
  в `975772463`), `explainBBSelection`, `explainBBMetrics`, `isRepSchemeId`,
  `BB_RED_FLAGS_EMPTY`, `isAcceptableBB`, `hasBothPhases`, `idealReevesMap`,
  `SUBGROUP_LABEL_RU`, `BB_PREP_CONFIG_KEY`/`BB_PREP_PLAN_KEY`, `BB_CAUSE_RU`,
  `indirectArmVolume`, `TECHNIQUE_ALIAS_TO_ENGINE`/`ENGINE_ALIAS_TO_UI`, `splitForDays`
  (+SPLIT_BY_DAYS), `jointGuardTempoOverride`/`jointGuardRationale`,
  `SPECIALIZATION_MAX_BLOCK_WEEKS`, `cnsFor` (мёртвый `return null`).
- UI: удалены 14 мёртвых «открытостей» + `expandedMuscles` (`BbAutoConstructor`),
  `strategySafe`-заглушка, `catEx`/`distText`/`past` локали, `disabled=false`-заготовка
  пилюль Contest Wizard.
- Осознанно НЕ трогали: `bbProgramPath` (roundtrip-маркер вариантов, читается в снимке
  параметров), `zoneSpec`/`donorsForZone` (самосогласованный реестр, API-запас);
  `applyTaperToFinalWeeks(totalWeeks)` — параметр не читается (задокументировано в §4.4).
- **Дедуп импортов (продолжение)**: read-only анализ + безопасный фиксер
  (`.tmp/find-dead-imports.mjs` / `.tmp/remove-dead-imports.mjs`, удаление только при 0
  вхождений в теле) — снято **146 мёртвых именованных импортов**: UI 95
  (`BbAutoConstructor` 37, `bb-contest-prep-sections` 57, `bb-step-adjust` 1) + движки 51
  (25 файлов: `bb-builder` 12, `bb-prep-cycle` 5, `bb-dup` 4, `bb-loading-layer`/`cycle-to-plan` 3 …).
  **Инцидент и фикс**: первая версия фиксера считала использования «после последнего import» —
  в `bb-finalize.engine.ts` (функция между импортами) это ложно удалило `normalizeBBMuscle`;
  поймано `tsc`, импорт восстановлен, скрипт исправлен (счёт по всему файлу без import-строк),
  повторная проверка — 0 мёртвых; `tsc` 0, bb 253ф/2830, bb-UI 26ф/213.

### 4.2. Своп внутри жёсткой группы — ✅
- `BbExSwapModal` (`bb-step-ex-swap.tsx`) использует `strictGroupMembersOf`: для упражнения
  из `STRICT_EXERCISE_GROUPS` список замен — только однотипные движения + подпись
  «💡 Жёсткая группа»; вне группы — прежний фолбэк по `group`.
- **Тест:** `bb-ex-swap-strict.test.tsx` (жим 30° — без разводок; вне группы — фолбэк).

### 4.3. Тесты — точечные дыры — ✅
- Тавтология `e.sets <= e.sets` заменена сравнением с исходным планом
  (`bb-diary-volume-correction.test.ts`); `changes` — `Array.isArray`.
- Тест идемпотентности `finalizeBBPlan` усилен: повторная финализация не меняет
  `[name, sets, rir, workSets.length]`.
- **Тихие `return`-пропуски заменены на честные precondition-throw** (`bb-pro-quality-phase-b`,
  `bb-audit-2026-08-extended` ×8, `bb-back-quality.integration` ×2): тест больше не может
  «зеленеть» без проверок. **Харднинг сразу нашёл реальную вакуумную проверку** —
  `programToBBPlan с eccentricMult=1.2` искал primary только в первой сессии недели
  (там его нет) и молча проходил; теперь primary ищется по всем сессиям недели и то же
  упражнение сверяется между планами — фича впервые реально покрыта.
- Soft-pass тест `pre_exhaust` получил не-вакуумный минимум (план не пуст; при найденном
  порядке — обязательный primary в сессии).
- Допуск ±16 (`bb-ped-enhancements`) **оставлен осознанно**: root-cause —
  blast-множитель MRV против недельно-инвариантных сессионных капов (план Волны 2 п.2.4
  удалённого аудита). Сужение без root-fix было бы подгонкой. Зафиксировано здесь.

### 4.4. Документация — ✅
- Мастер-план = единственный источник; AGENTS-запись сессии добавлена с расхождениями:
  `applyTaperToFinalWeeks(totalWeeks)` не читает параметр; своп теперь реально
  внутри жёсткой группы; VBT/пик-вес/инсулин-окно — подключены.

### 4.5. Дополнительно закрыто (по ходу)
- Убран дубль-контрол «Цель объёма» на шаге 1 (оставлен один — в карточке «Объём»).
- «Дней/нед» min/max выровнены с клампом состояния (2…7).
- `legs`/`core` в `DEFAULT_WORKMAX` — легаси-композиты WEAK_GROUPS больше не дают
  fallback 80 кг и warning.
- Честные `console.warn` вместо тихих catch: PED-адаптация/overlay, автоправка баланса,
  ACWR/per-muscle/validator в дневнике, сохранение prep-плана.

---

## §5. Перенесённые незакрытые пункты прежних планов

1. **target-volume planner ↔ feeder selection** — глубже объединить в один allocation-pass
   (GEN-MAX §12 / MAX-FINAL §7). Архитектурное, non-blocking.
2. **PDF/CSV-колонки «Подмышка | Паттерн | Пояснение»** — ✅ закрыто: NEW
   `bbExerciseExplanation(ex)` в `bb-summary.engine.ts` (display-only: подгруппа/головка,
   паттерн по-русски с уточнением «наклонный жим» для PDF/CSV, why/how), печать плана и
   CSV-экспорт ББ-авто получили колонки «Подмышка»/«Паттерн»/«Пояснение»; тесты
   `bb-summary.test.ts` (+4). `explanation {why/how/patternRu}` больше не display-only-мёртвый.
3. **«Настройка по результатам реальных тренировок»** (REBUILD) — бессрочный бэклог.
4. **FULL-AUDIT-2026-08-28 §9** — чекбоксы не отмечены; фактически закрыто поздними
   коммитами (parseDose, bb-dup clone, heavyQuads, prescribeLoad phase, спец-приоритет,
   BSA-высота), открытыми остались только п.2.4 (закрыт §3.3) и §6.2-Ф4 (§3.4).
5. **QUALITY-PLAN §21** — «обязательный этап 21» без статуса: частично перекрыт
   `bb-summary` explanation (display) и §5.2; колонки — см. п.2 выше.
6. **EXHAUSTIVE §7 [ ] 4.3-часть-3** — фактически закрыт (тонкие обёртки вынесены) —
   пометить закрытым.

---

## §6. Осознанные границы (не делаем без отдельного решения)

- `packingV2` в program-режиме — осознанный гейт (disabled).
- `pedPhaseOverride` в faithful — не применяется (дословность).
- Faithful-режим не переписывает программу (безопасность/derived-метаданные — да).
- Недельные MRV-цели enhanced (×1.3–2.0) сдержаны сессионными капами.
- `stretchPhase/peakContraction/pauseSeconds` — курируемые (109 записей), автозаполнение
  эвристикой запрещено (риск вранья физиологии).
- Packing ног: сбросы хвостов только спине/груди, ногам — нельзя (флиппуют MEV-фидеры).
- P1-слияние дубликатов упражнений — откачено (несовместимо с «0 упр > 5»).
- `bb-bar-path` (@deprecated) — оставлен публичным API канона SRD.
- `meal-plan-generator` merge — вне ББ-авто.
- Дроп/рест-пауз мини-сеты — render-only (цепочка в UI).
- PDF/CSV-полировка — не влияет на план (можно позже).

## §7. Требует согласования (меняет математику/планы)

> **Решение пользователя (Sep 24 2026): ничего из §7/§5.1 не подключать** — пункты ниже
> остаются осознанными границами. При появлении запроса — подключать волной с re-baseline.

1. Подключение `bb-demographics` (`mastersAdjust` 40+/50+, `adjustVolumeForDemographic`) —
   меняет объёмы возрастных планов → отдельная re-baseline-кампания. `splitForDays` удалён:
   при подключении сплит брать из `SPLIT_PATTERNS`/селектора; функции-резервы помечены
   комментарием в `bb-demographics.ts` (не удалять при ревизии экспортов).
2. Подключение «эталонных слоёв» `computeLoading` / `selectDiverseExercises` к builder —
   рефакторинг с риском дрейфа чисел (сейчас parity держат только тесты).
3. `jointGuardTempoOverride` (темпы 4-2-1-0 при guard) — меняет темпы, не объём.
   ВАЖНО: в волне-3 (P2) удалён как мёртвый (0 потребителей) — при согласии реализуется
   заново на живом `jointGuardActive` (`bb-joint-guard.engine.ts`).

---

## §8. Протокол верификации

```powershell
npx vitest run src/engines/bb --reporter=dot                    # ожидаем 0 падений
npx vitest run "src/ui/screens/TrainingScreen_parts/__tests__/bb-"  # ожидаем 0 падений
$env:NODE_OPTIONS='--max-old-space-size=12288'; npx tsc --noEmit   # ожидаем 0
# опционально тяжёлая матрица:
$env:BB_CYCLE_AUDIT_FULL='1'; npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts
```
Re-baseline тестов — только с комментарием «было→стало» и числом.

---

## §9. Журнал выполнения

| Волна | Пункты | Статус | Проверка |
|---|---|---|---|
| 1 (P0) | 2.1–2.7 | ✅ | tsc 0; bb engines 2826/0; bb UI — финальный прогон ниже |
| 2 (P1) | 3.1–3.6 | ✅ | tsc 0; те же круги |
| 3 (P2) | 4.1–4.4 (+4.5) | ✅ | tsc 0; те же круги |
| 4 (гигиена) | §3-остатки + ревизия экспортов | ✅ | bb 253ф/2830/0; bb-UI 26ф/213/0; матрица 5ф/24/0; tsc 0 по своим |

**Что сделано по волнам (кратко):**
- **2.1–2.2**: чтение pending `he_planner_apply` при монтировании (≤5 мин, только
  program/weakpoints/pm, не pl-auto), `clearPlannerApply()` после; program-ветка конвертирует
  `SRCycleTemplate → FullProgram` через `cycleTemplateToFullProgram` → `applyProgramToBb`
  (больше нет флеша «Выберите программу»), форма `{program}` принята, TypeError закрыт.
- **2.3**: техника пишется в `workSets[last].technique` каноном (`canonTechniqueId`,
  myo_rep→myo_reps, 21s→twenty_ones); `intensityTechUsed` удалён; селектор читает last-set.
- **2.4**: `onGoalChange` — честный флеш вместо no-op.
- **2.5**: вставки ограничены `sessionLimitsFor(...).maxExercises` (15–20 у advanced/enhanced).
- **2.6**: карточка `data-bb="freq-opt"` выводит per-muscle рекомендации (справочно).
- **2.7**: 6 тихих catch → `console.warn`.
- **3.1**: `bb-insulin-window` подключён в builder (пометки памп-дней + rationale; объём не
  меняется) — движок перестал быть мёртвым.
- **3.2**: `suggestFeeders` учитывает оборудование (варианты: dumbbell/barbell/cable/band/
  machine/bodyweight; без данных — прежний первый вариант).
- **3.3**: peak weights cross-meso берутся ТОЛЬКО из peak-недели (P0-C2).
- **3.4**: `lengthened_partials` (мини-сет 8 частичных) и `rest_pause_cluster` (2+2+2×15с)
  реализованы в `applyIntensityTechniqueToExercise`.
- **3.5**: лимиты сессии в «Проверке плана» — с полными входами; текст 60/18→40/15(44/16);
  VBT-ввод едет в сборку generic (в источнике — честная подпись «справочно»); мост в питание
  считает ккал/белок от веса/пола/цели (+`weightKg/sex/goal` в payload/ноте); `readiness` —
  реальный, без константы 65; packing в источнике — честная плашка; FST-7 гейт = движковый
  `jointGuardActive` (GH≥2+AAS≥500, lab<0.65) с хинтом.
- **3.6**: `legs:140`/`core:80` в DEFAULT_WORKMAX.
- **4.x** — см. §4.

**Осознанно отложено (не блокирует):** §5.1 (target-volume↔feeders — allocation-pass),
§5.3 («реальные тренировки» — бессрочный бэклог), §7 (демография/эталонные слои/темп-оверрайд
гарда — только по согласованию), допуск ±16 blast/cruise.

**Продолжение после коммита `ce96a4d8` (Sep 23 2026):**
- §5.2 закрыт: `bbExerciseExplanation` + колонки «Подмышка | Паттерн | Пояснение» в печати
  и CSV (display-only; `derivePattern`/валидатор не тронуты), +4 теста.
- Коммит-2 `4569dc1a` (§5.2, 5 файлов).
- §4.3-добивка: 11 тихих `return`-пропусков → precondition-throw; найдена и починена
  вакуумная проверка `programToBBPlan × eccentricMult` (теперь реально тестирует фичу);
  `pre_exhaust` — не-вакуумный минимум. Тесты 3 файлов 76/76.
- Дедуп импортов: 95 мёртвых именованных импортов снято (37+57+1) через read-only
  анализ + фиксер с проверкой 0 вхождений; tsc 0, bb-UI 213/213.
- Дедуп импортов движков: +51 (25 файлов); инцидент ложного удаления `normalizeBBMuscle`
  (фиксер считал «после последнего import») пойман tsc и закрыт, скрипт исправлен;
  повторная проверка 0 мёртвых, bb 253ф/2830, bb-UI 26ф/213, tsc 0.

**Продолжение (волна-4, гигиена/ревизия, Sep 24 2026, без коммита):**
- `applyTaperToFinalWeeks(plan, _totalWeeks)` — параметр не читался: переименован с честным
  комментарием (длина берётся из `plan.weeks.length`; позиция сохранена для API).
- `bbProgramPath` — решение: **удалён**. Состояние всегда было `'library'` (cycle-путь
  резолвится из `selectedCycleId` через `getCycleById`); с ним удалены мёртвый `customCycle`
  (state всегда null после §2.1) и legacy-поле `programPath` в `SavedBBPlan` (старые варианты
  читаются — поле опционально, миграция игнорирует отсутствие).
- Реестр специализации: `zoneSpec`/`donorsForZone` удалены (0 потребителей/0 тестов),
  `patternsForZones` снят с экспорта (внутренний хелпер), `donorRecommendations` — данные-резерв;
  шапка файла приведена к фактам.
- Мёртвые типы (`ExerciseCategory`, `BBDay`, `BBVolumeKind`, `CycleSourceCycle`) и
  `insulinWindowRationale` удалены; §7-резервы (`mastersAdjust`/`adjustVolumeForDemographic`)
  НЕ удалены — помечены комментарием «зарезервировано под согласование».
- **Ревизия 1147 экспортов движков** (read-only `.tmp/find-dead-exports.mjs`: использования в
  других файлах + отдельно в тестах): dead=322 (pure 9 / exportOnly 313), testOnly=171.
  - pure dead: 6 удалено, 2 §7-резерва оставлены, `insulinWindowRationale` удалён (текст жив
    в `applyInsulinWindowToPlan`).
  - exportOnly 313 (используются только внутри своих файлов) — оставлены осознанно: политика
    «API сохранён»; массовое снятие `export` = churn без функциональной ценности.
  - testOnly 171 — потребители-тесты: API сохранён по политике.
- **Проверено**: bb engines **253ф/2830/0** (20 skipped), bb-UI **26ф/213/0** (1 известный
  чужой unhandled `revokeObjectURL`), тяжёлая матрица `BB_CYCLE_AUDIT_FULL=1` **5ф/24/0**,
  `tsc` 0 по своим файлам (6 ошибок — чужой незакоммиченный WIP `nutrition-ocr-parser.ts`,
  не тронут, доказано `git status`). НЕ КОММИТИЛ.
- **Открыто (ждёт согласия/отдельной кампании)**: §7.1 demographics, §7.2 эталонные слои,
  §7.3 `jointGuardTempoOverride` (удалён в волне-3 — при согласии реализуется заново),
  §5.1 allocation-pass, ±16 blast/cruise root-fix, jsdom-виснет `BbAutoConstructor`
  (кандидат на сквозной e2e).

---

## §10. Готовый промт продолжения (скопировать целиком в новую сессию)

```
Продолжи работу по ББ-авто. Сначала прочитай AGENTS.md (раздел «ББ-авто: единый мастер-план»)
и docs/BB-AUTO-MASTER-PLAN.md — это единственный источник правды (все прежние BB-auto планы
удалены). Состояние на сейчас: bb-движки 253 файла / 2830 тестов passed / 0 failed,
bb-UI 26 файлов / 213 passed, tsc --noEmit 0 по проекту (по своим файлам; чужие WIP могут
давать ошибки). Коммиты ce96a4d8, 4569dc1a, c291a7d6, d1008a8d, 8742b204 (+ этот) — без пуша.
Волна-4 (гигиена/ревизия экспортов, §9) закрыта.

Правила: только Edit/Write (никакого PowerShell-перезаписывания контента);
чужие WIP не трогать; коммит — только по явной команде, строго pathspec своих файлов;
МАТЕМАТИКА ПЛАНОВ (капы/MRV/фазы/веса) меняется только с согласия пользователя —
при re-baseline комментировать «было→стало» с числами; временные пробы удалять до коммита.

Что уже сделано: волны P0/P1/P2 мастер-плана (мосты библиотека→авто и pending, техника в
workSets, движковые лимиты, freq-карточка, инсулин-окно, feeders×оборудование, peakWeights
из peak-недели, lengthened_partials/cluster, UI-правда, снос мёртвого кода, своп в жёсткой
группе), §5.2 (bbExerciseExplanation + колонки PDF/CSV), §4.3-добивка (precondition-throw
вместо тихих return; найдена вакуумная проверка programToBBPlan×eccentricMult), дедуп
импортов (146 имён: UI 95 + движки 51).

Осталось (по приоритету):
1) §7 мастер-плана — ТРЕБУЕТ СОГЛАСИЯ (меняет планы): подключить `bb-demographics`
   (mastersAdjust 40+/50+, adjustVolumeForDemographic — `splitForDays` удалён, для сплита
   использовать SPLIT_PATTERNS/селектор), «эталонные слои» `computeLoading`
   (bb-loading-layer) и `selectDiverseExercises` (bb-exercise-selection) к builder,
   `jointGuardTempoOverride` (темпы 4-2-1-0 при guard). Без явного ОК пользователя —
   НЕ подключать, только держать parity-тесты.
2) §5.1 — target-volume planner ↔ feeder selection: один allocation-pass (архитектура;
   тоже после согласия, т.к. меняет распределение объёма).
3) Гигиена/остатки — ✅ закрыта волной-4 (см. §9): `applyTaperToFinalWeeks` → `_totalWeeks`
   с комментарием; удалены `bbProgramPath` (state+поле), мёртвый `customCycle`,
   `zoneSpec`/`donorsForZone`, мёртвые типы; ревизия 1147 экспортов (pure-dead удалены,
   exportOnly 313 и test-only 171 оставлены по политике «API сохранён»).
4) Тесты: периодически гонять тяжёлую матрицу `$env:BB_CYCLE_AUDIT_FULL='1';
   npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts` (24 теста скрыты env-гейтом;
   после правок каталога/циклов — обязательно). Допуск ±16 blast/cruise
   (bb-ped-enhancements) — root-fix = отдельная кампания (blast-множитель vs сессионные капы).
   Интерактивного e2e ББ-авто нет: jsdom-рендер BbAutoConstructor виснет (задокументировано
   в bb-hub-payload-consume.test.ts) — кандидат на отдельное расследование (таймеры/эффекты),
   при успехе — сквозной тест «шаги → Собрать план → план».

Полезное: `.tmp/find-dead-imports.mjs` и `.tmp/remove-dead-imports.mjs` (read-only анализ и
безопасное удаление мёртвых именованных импортов; ВАЖНО: счёт идёт по всему файлу без
import-строк — первая версия теряла функции между импортами и ложно снесла normalizeBBMuscle
в bb-finalize; уже исправлено, но при переписывании скрипта это правило сохранить).
Верификация после каждой правки: npx vitest run src/engines/bb --reporter=dot;
npx vitest run "src/ui/screens/TrainingScreen_parts/__tests__/bb-";
$env:NODE_OPTIONS='--max-old-space-size=12288'; npx tsc --noEmit.

Начни с ревизии «осталось» выше, выбери безопасный пункт (3/4) или запроси у пользователя
согласие на §7/§5.1, затем выполняй волной с прогонами и обновлением §9 журнала и AGENTS.
```
