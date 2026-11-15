# BB-план: исправление P1-находок аудитов 2026-11

**Дата:** 2026-11-15 · **Область:** `src/engines/bb/*` (сборка, валидация, финализация, качество).

Проход 1 — все P1 (§1). Проход 2 — два P2 из того же списка (§3): падение отчёта качества
на плане без `weeks` и `-Infinity` в тексте валидатора.

Документ заменяет три рабочих отчёта аудита (они удалены, суть сохранена здесь):
`BB-CORE-BUILD-AUDIT-2026-11.md`, `BB-FINALIZE-VALIDATION-AUDIT-2026-11.md`,
`bb-auto-constructor-audit-2026-11-15.md`.

Подтверждённых **P0 не найдено** ни в одном из аудитов: штатная сборка плана не падает,
внешние числовые входы клампятся, sync- и worker-путь вызывают один и тот же `buildBBPlan`.

P1 из аудита UI-конструктора (настройки шагов 1–2 не переживали перезагрузку, снимок
затирался дефолтами) уже исправлен ранее — см. `docs/BB-AUTO-NAV-JUMPS-PLAN-2026-11.md`
(N8 + `persistReadyRef`).

---

## 1. Что исправлено (P1, этот проход)

| № | Находка | Файл | Правка |
|---|---|---|---|
| Ядро P1-1 | Тоггл «Авто-разгрузка» не управлял авто-делодом: ACWR из localStorage учащал делоды и слал предупреждения при выключенном флаге | `bb-builder.engine.ts` (~3957) | `const acwrAuto = input.autoDeload !== false`; `acwrCaution`/`acwrDanger` под этим гейтом (`undefined` = прежнее поведение) |
| Ядро P1-2 | Fallback-пул терял политические запреты: эксцентрик-скилл новичку и становая/сумо/жим стоя без явного разрешения | `bb-builder.engine.ts` (~1822, ~1882) | Общий предикат `isPoolPolicyBlocked(ex, opts)` вызывается и в основном фильтре, и в fallback |
| Ядро P1-3 | Пять гардов оборудования сравнивали строку с **массивом** снарядов → упражнения молча выкидывались (добивка рук, auto-MEV-фидер, late top-up, DC-ротация) | `bb-builder.engine.ts` (4 места) | Все копии заменены на `equipmentAllows(eqList, …)` (пустой список = без ограничений, `bodyweight` разрешён, `equipment` массив/строка) |
| Финализация P1-1 | `validateBBPlan` бросал `TypeError` на deload/transition-неделе, если у сессии нет `exercises` (импорт/ручная правка) | `bb-validator.engine.ts` | `sessionsOf`/`exercisesOf` вместо прямых `.flatMap/.reduce`; защищены `meanWeightOf`, `minRirOf`, `rirValues`, `setsOfWeek`, `taperFlags`, `deloadFlags`, `aggregateBBVolume` |
| Финализация P1-2 | `excluded_muscle_present` (error) детектировался, но **никогда** не ремонтировался: `continue` стоял до поиска замены | `bb-finalize.engine.ts` | Новый проход `purgeExcludedMuscleExercises`: упражнения исключённых мышц **удаляются**, `primary` поднимается у первого оставшегося, в rationale — строка «🚫 Исключённые мышцы…». Работает и при `reorder: false` |
| Финализация P1-3 | Пустой план (недели есть, рабочих сетов ноль) — `valid: true` и 95/100 «🟢 Профессионально» | `bb-validator.engine.ts`, `bb-quality-report.engine.ts`, `bb-quality-weekly.engine.ts` | Валидатор: error `no_working_sets`; отчёт качества: `score = 0`, `riskLevel = 'danger'` + замечание; `scoreVolumeWeek`/`scoreProWeek`: 0 при нулевом объёме. Объём берётся из того же источника, что и шкала (`weekVolumeOf` / `weeklyVolume` / `expandedSummary`) |

### Поведение, на которое опираются правки

- **Где ищется «есть объём».** `directSets` ∪ `effectiveSets` (берётся максимум) — иначе
  план-производная с одной косвенной работой считался бы пустым.
- **`autoDeload: undefined`** (старые вызовы, `cycle-to-plan`) = «включено», чтобы правка не
  меняла поведение тех, кто флаг не передаёт.
- **Кросс-проверка на `no_working_sets`:** план, у которого пустые сессии, но заполнен
  `weeklyVolume`/`expandedSummary`, ошибкой не считается — это план-производная, а не провал
  генерации.

### Тесты

`src/engines/bb/__tests__/bb-audit-p1-fixes.test.ts` — 12 тестов:

1. `autoDeload=false` не перестраивает план по скрытой sRPE-истории (и сравнивается с
   baseline без данных; отдельно проверяется, что данные реально дают «опасную» зону).
2. Fallback не возвращает «армейский жим»/жим стоя/становую; нордик не возвращается новичку.
3. Source-guard: в билдере не осталось `eqList.includes(x.equipment)`, все копии через
   `equipmentAllows` (≥4).
4. Повреждённая deload-неделя (`{ day: 1 }` без `exercises`) → `malformed_session`, без
   исключения.
5. `finalizeBBPlan(..., { excludedMuscles: ['chest'] })` в обоих режимах (`reorder` true/false):
   жим уходит из плана, `excluded_muscle_present` в `validation` нет, день не остаётся без
   `primary`.
6. Пустой план: `no_working_sets` (error), отчёт качества `score 0`/`danger`, недельные шкалы `0`.

## 2. Проверка (факт)

```powershell
node --max-old-space-size=3200 ./node_modules/typescript/bin/tsc --noEmit
# exit 0

# весь движок BB (312 файлов — с учётом bb-audit-p2-fixes.test.ts)
node --max-old-space-size=3600 ./node_modules/vitest/vitest.mjs run "src/engines/bb/__tests__" --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# Test Files: 308 passed | 4 skipped (312)
# Tests:      3577 passed | 20 skipped (3597)   exit 0
```

Единственное падение первого прогона — `bb-controlled-rotation.test.ts > does not rotate
into an excluded injury muscle`: тест утверждал, что упражнение исключённой мышцы остаётся в
плане (то есть фиксировал именно тот дефект, который чинит P1-2). Тест переписан на новый
инвариант: после `finalizeBBPlan(..., { excludedMuscles: ['chest'] })` в плане нет ни одного
упражнения грудной мышцы, а `excluded_muscle_present` в `validation` отсутствует. Повторный
полный прогон после правки — зелёный (числа выше).

Кроме этого, профильный набор из 25 файлов (валидатор/качество/финализация/селекция) —
passed, exit 0.

## 3. P2 — сделано следом (отдельный коммит)

| № | Находка | Файл | Правка |
|---|---|---|---|
| P2-6 | `buildBBQualityReport` падал `TypeError` на плане без `weeks` (импорт/частичный снапшот) — весь экран «Качество» вместо оценки | `bb-safety-score.engine.ts`, `bb-injury-prevention.engine.ts` | Общий нормализатор `planWeeks` (массив или пусто), проходы по частоте/объёму/MRV и `weeklySessions` больше не трогают `plan.weeks` напрямую; `calculateWeeklyStress`/`calculateSessionStress` терпят неделю без `sessions` и сессию без `exercises` |
| P2-5 | `-Infinity` в пользовательском тексте `target_volume_deficit` | `bb-validator.engine.ts` | `Math.max(...[])` заменён на «есть строки объёма? max : 0» — при пустом (но существующем) `weeklyVolume` сообщение остаётся читаемым |

Тесты: `src/engines/bb/__tests__/bb-audit-p2-fixes.test.ts` (4 теста) — `{}` и
`{ weeks: [{ week: 1 }] }` не роняют отчёт/safety-скор/анализ стресса; сообщение дефицита
не содержит `Infinity`/`NaN`.

Кроме этого исправлено в том же проходе, но вне исходного списка аудита: пустые
`weeklyVolume`-строки в валидаторе больше не дают `-Infinity` в проценте выполнения MEV.

## 4. Осталось (P2/P3 — зафиксировано, не в этом проходе)

### Ядро сборки (`bb-builder.engine.ts`)

- P2-1. Auto-MEV-feeder добавляет сеты в делод-недели (у его cross-day аналога такой гейт есть).
- P2-2. `schemeActive` читает сырой `input.volumeScheme` вместо `effVolumeScheme`.
- P2-3. `eccentricMult` умножает вес primary без клампа по `workMax`.
- P2-4. `applyBbMacroToBBPlan`: из диапазона RIR берётся только минимум, `phase` недели не
  обновляется.
- P2-5. SFR-тай-брейк strict-покрытия жёстко зашит на `'accumulation'`.
- P2-6. `labWarnings`/`labIntensityNote` выбрасываются, если лаборатория не снизила MRV.
- P2-7. Auto-MEV-feeder систематически перебирает цель на 1 сет.
- P3-1. `splitSessionBudget` объявляет `pedDoses`/`mode`, но не читает их; стаж жёстко = 0.
- P3-2. Три разных определения «высокого объёма» в одном решении о сплите.
- P3-3. `dupMode` нет в `BBBuilderInput`: UI применяет DUP снаружи → снапшот плана пустой.
- P3-4. Подполя `bodyweightCapability` объявлены, но не читаются.
- P3-5. `computeAcwr` глушит любые ошибки и возвращает «здоровые» 1.

### Валидация/финализация/качество

- P2-1. Кап упражнений на мышцу не канонизирует мышцу (`delt_*` обходят кап «плечи»).
- P2-2. Добивка дельт добавляет второе упражнение без повторной проверки `roomEx`
  (`session_exercise_cap`).
- P2-3. Единственный ремонт safety-ограничений включён флагом `reorder` — в `faithful`-режиме
  error-коды валидатора остаются. (Исключённые мышцы из этого пункта уже выведены — см. §1.)
- P2-4. Гейт «существенный объём» в `scoreProWeek` — тавтология (`>= 0 ||`).
- P2-7. Финальный кап/порядок упражнений — только для сессий с `warmupActivator`.
- P3-1. Финальный снимок не пересобирает строки `⚠/🚫 Валидация:` → устаревшие строки в
  rationale.
- P3-2. `exAvgRir` выбрасывает RIR 0 (отказ) и превращает его в «нет данных».
- P3-3. `TRANSIENT_VALIDATION_CODES` скрывает реальные предупреждения из rationale.
- P3-4. `single_work_set` финализатор не ремонтирует (только билдер).
- P3-5. `capExercisesPerMuscle` — мёртвый экспорт; комментарий в финализаторе утверждает обратное.

### UI-конструктор (`BbAutoConstructor` и step-компоненты)

- P2. Пакетное редактирование недели обнуляет вес/сеты всей недели.
- P2. Карточка «Фаза (факт)» всегда показывает «Разгрузка».
- P2. Два независимых prep-контура пишут в одно хранилище: дата шоу и старты одного не
  доходят до другого.
- P2. «Подготовка сокращена»: тренировочный план не сокращается.
- P2. Перенос даты шоу / ±неделя теряет персональную trial-дозу углеводов пик-недели.
- P2. Inline-правка: очистка поля пишет 0 сетов, дробный вес обрезается `parseInt`.
- P3. После замены/перестановки/подстановки упражнения суперсет применяется повторно
  (ложное «партнёр не найден»).
- P3. `readiness` и `spillRisk` не пересчитываются при смене даты шоу, противопоказаний и
  специализации.
