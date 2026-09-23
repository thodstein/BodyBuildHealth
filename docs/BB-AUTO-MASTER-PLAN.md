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
  параметров), `zoneSpec`/`donorsForZone` (самосогласованный реестр, API-запас),
  широкий дедуп импортов в `bb-contest-prep-sections` (риск без выгоды);
  `applyTaperToFinalWeeks(totalWeeks)` — параметр не читается (задокументировано в §4.4).

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
2. **PDF/CSV-колонки «Подмышка | Паттерн | Пояснение»** (QUALITY-PLAN §21.2) — в коде нет;
   `explanation {why/how/patternRu}` живёт display-only в `bb-summary.engine.ts:45,143`.
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

1. Подключение `bb-demographics` (`mastersAdjust` 40+/50+, `adjustVolumeForDemographic`,
   `splitForDays`) — меняет объёмы возрастных планов → отдельная re-baseline-кампания.
2. Подключение «эталонных слоёв» `computeLoading` / `selectDiverseExercises` к builder —
   рефакторинг с риском дрейфа чисел (сейчас parity держат только тесты).
3. `jointGuardTempoOverride` (темпы 4-2-1-0 при guard) — меняет темпы, не объём.

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

**Осознанно отложено (не блокирует):** §5 (target-volume↔feeders, PDF/CSV-колонки,
«реальные тренировки»), §7 (демография/эталонные слои/темп-оверрайд гарда — только по
согласованию), допуск ±16 blast/cruise.
