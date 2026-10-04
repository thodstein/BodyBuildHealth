# ББ-авто: полный аудит, исправления и план до профи-уровня

**Дата:** 2026-10-03
**Область:** `src/engines/bb/**`, `src/engines/movement-pattern.ts`, `src/ui/screens/TrainingScreen_parts/**`, `src/ui/screens/SRCBBScreen_parts/TrainingPopups.tsx`
**Статус:** аудит проведён; **37 дефектов исправлено**; 2 теста пере-базированы осознанно; 8 границ зафиксировано.

---

## 0. Методология

1. **Карта системы**: разобраны точки входа (`buildBBPlan`, `convertCycleToBBPlan`, `programToBBPlan`, `finalizeBBPlan`), 4 маршрута генерации (generic / ПРОФ-цикл adapt / Library adapt / faithful), UI-визард (7 шагов).
2. **Глубокий аудит** 4 подсистем (движковое ядро; отбор/уровни/специализация; периодизация/PED/пик-неделя; UI-проводка) с проверкой каждого вывода чтением кода.
3. **Базлайн тестов** до правок: `src/engines/bb` — **2964 passed / 0 failed / 20 skipped** (268 файлов).
4. **Интернет-исследование** (проведено самостоятельно, авторитетные источники 2024–2026):
   - **Pelland et al. 2024/2025** (Sports Medicine, PMID 41343037) — дозо-зависимость объёма: гипертрофия растёт с объёмом с убывающей отдачей; частота имеет собственную дозо-зависимость.
   - **Refalo et al. 2024** (Sports Medicine) — дозо-зависимость близости к отказу: гипертрофия улучшается ближе к отказу, сила — примерно одинакова в широком диапазоне RIR.
   - **Stretch-mediated hypertrophy / lengthened partials** (2023–2025) + критический разбор Stronger by Science («overhyped») — приоритет растянутой позиции обоснован, но не абсолютен.
   - **Протоколы делода**: объёмный делод ~50% сетов, интенсивность сохраняется, 5–7 дней; плановый делод каждые 4–8 нед (классическая периодизация мезоциклов 3–12 нед + делод).
   - **Schoenfeld 2016** (частота 2×>1×), **Helms 2022** (дефицит: объём поддерживающий, сила сохраняется).
   Вывод: движок уже реализует бóльшую часть доказательной базы (Pelland-объёмы, Refalo-RIR, Schoenfeld-частота, stretch-приоритет, делод-протоколы). Основные находки — **дефекты проводки и несогласованные guard'ы**, а не отсутствие науки.

---

## 1. Исправленные дефекты (37)

### 1.1 Движковое ядро

| # | Файл:строка | Дефект | Severity |
|---|-------------|--------|----------|
| 1 | `bb-validator.engine.ts:471/487/577` | `generateActionableRecommendations` парсил сообщения regex'ом `([\w_]+):.*volume … MEV`, но прод-сообщения на русском («эффективных сетов … MEV») → match всегда падал → рекомендаций нет → **ложный «✅ План сбалансирован»** даже при предупреждениях. Не разобранные коды (`sets_mismatch`, `equipment_*` и др.) тоже не давали рекомендаций. | P1 |
| 2 | `bb-builder.engine.ts` `compensateCrossDayWeakPoints` | Слабая мышца получала feeder **на делод/тапер-неделях** (объём ×0.6 < MEV всегда) — низкий объём разгрузки откатывался. | P1 |
| 3 | `bb-finalize.engine.ts` (`applySpecializationPass`, `applyVolumeScheme`, PPL-гарантия, frequency-guard) | Посты после `applyTaperToFinalWeeks` пропускали только `phase==='deload'`, но **не taper** → специализация/GVT/FST-7/PPL-добивка возвращали объём и RIR 0-1 в уже срезанные недели. | P1 |
| 4 | `bb-loading-layer.engine.ts:114`, `bb-builder.engine.ts:2812` | Делод-отдых для primary = `baseRest + 30 − (−30)` = **+60с** (комментарий обещал +30с). | P2 |
| 5 | `bb-finalize.engine.ts` `ensureSmallMuscleQuality` | `Math.max(2, room)` добавлял 2 сета при `room≤0` → **перебор капа сессии**. | P2 |
| 6 | `bb-finalize.engine.ts:3866` (leg-invariant) | Поиск кандидата проверял только мышцу и имя — игнорировал excluded/equipment/mobility/junk/axial (асимметрия с `findCatalog`). | P2 |
| 7 | `bb-builder.engine.ts:3206/3269` | `hrvBaseline`/`hrvBaselineZ` объявлены, но **не передавались** в `computeBBRecoveryScore`/`computeBBRecoveryMultiplier` — явная HRV-база игнорировалась. | P1 |

### 1.2 Периодизация / прогрессия / PED / пик-неделя

| # | Файл:строка | Дефект | Severity |
|---|-------------|--------|----------|
| 8 | `bb-contest-prep.engine.ts:1056` | `adjRawBudget` (гликоген-коррекция `glycogenAdjustedDose`) считался и **не использовался** — `glycogenLevel` не влиял на бюджет пик-недели. | P1 |
| 9 | `bb-contest-prep.engine.ts:859` | Кэш-ключ `peakWeekCached` не включал `contraindications`/`glycogenLevel` → конфиг с противопоказаниями получал закэшированный un-gated результат (напр. tapered для пациента с почками). | P1 |
| 10 | `bb-contest-prep.engine.ts:1886` | `applyPeakWeekOverlayToBBPlan` без `force` — смена стратегии/дозы/воды после первого наложения **игнорировалась навсегда**. | P2 |
| 11 | `bb-contest-prep.engine.ts:1992` | Окно фаз считалось от запрошенного `taperWeeks`, а адаптивный тапер (новичок/40+ → 4 нед) режет иначе → одна неделя получала и taper-срез, и final-prep ×0.9 (двойной срез). | P1 |
| 12 | `bb-contest-prep.engine.ts:2687/2744` | `plan.taper.weeks` = запрошенная, а `volumeProfile` — фактическая длина → печать давала «нед 2,1,0,-1». | P2 |
| 13 | `bb-progression-feedback.engine.ts:294` | `applyDiaryVolumeCorrection` не идемпотентна — повторный вызов умножал сеты ещё раз (adherence 0.75² = 0.5625). | P1 |
| 14 | `bb-progression-feedback.engine.ts:236` | `applyFeedbackToBuild` не идемпотентна — дублировала комментарий «↻ из факта:». | P1 |
| 15 | `bb-progression-feedback.engine.ts:607` | `computePerMuscleACWR.weekKey` смешивал UTC-парсинг и локальные `getDay/setDate/toISOString` → в UTC− ключ понедельника уезжал на день. | P2 |
| 16 | `bb-ped-methodology.engine.ts:236` | Rationale-строки PED-методики дублировались при повторном применении. | P2 |
| 17 | `bb-insulin-window.engine.ts:20` | То же для инсулинового окна. | P2 |
| 18 | `bb-ped-adaptation.engine.ts:83` | `AAS_SUBSTANCE_TEQ` без `bold_undec` (канонический id болденона) → доза болденона молча выпадала из T-эквивалента. | P2 |
| 19 | `bb-ped-phasing/methodology.engine.ts` | Локальные парсеры дозы теряли единицы («1,5г» → 1.5 вместо 1500) и расходились с `bb-ped-adaptation.parseDose`. | P2 |
| 20 | `bb-prep-cycle.engine.ts:905` | `applyPrepVolumeCascade` не скипал builder-делоды внутри подготовки → возможный двойной делод. | P2 |

### 1.3 Отбор упражнений / специализация

| # | Файл:строка | Дефект | Severity |
|---|-------------|--------|----------|
| 21 | `movement-pattern.ts:205` | `jm_press` (группа `arms`, трицепс) классифицировался как `horizontal_push` → **chest** (жим по «жим»). | P0 |
| 22 | `bb-exercise-selection.engine.ts:92` | «Французский жим» матчился первым `press_closegrip` → весь french-класс крался у `extension_overhead` (нет overhead-угла). | P2 |
| 23 | `bb-exercise-selection.engine.ts:106` | `lateral_raise_single` не попадал ни в один угол плеч. | P2 |
| 24 | `bb-tradeoff.engine.ts:249` | На делод-неделях composite-доноры (`legs/arms/core`) не разворачивались → не резались. | P2 |
| 25 | `bb-tradeoff.engine.ts:167` | `addToRecipient` не применял excluded/mobility/junk/level-фильтры (асимметрия с пулами). | P2 |

### 1.4 UI-проводка («показано ≠ применяется»)

| # | Файл:строка | Дефект | Severity |
|---|-------------|--------|----------|
| 26 | `bb-step-weights.tsx:37` | `setEntry(i)` использовал индекс **внутри группы** против **глобального** массива → ввод веса во 2-й+ группе писал в упражнение 1-й группы. | P1 |
| 27 | `bb-step-plan.tsx:474`, `bb-step-adjust.tsx:373`, `BbAutoConstructor.tsx:2598` | Ключ правки `${si}-${ei}` без недели → правка одной недели **применялась ко всем неделям** (мезоцикл выравнивался). | P1 |
| 28 | `bb-plans-store.ts:115` | `migrateSavedPlan` выбрасывал `specBlocks`/`dcMode`/`pedPhaseOverride` → multi-block специализация схлопывалась, DC/фаза терялись при перезагрузке. | P1 |
| 29 | `bb-plans-store.ts:168` | Метрики варианта теряли `peakWeek/peakDirectSets/peakEffectiveSets/maxSessionMinutes/maxAxialCost`. | P2 |
| 30 | `bb-step-plan.tsx:471` | autoReg применялся **повторно** в отображении (движок уже применил) → показывал меньше, чем в плане; в faithful — фантомная коррекция. | P1 |
| 31 | `BbAutoConstructor.tsx:2103/2907` | После свопа `exerciseName` оставался старым/становился display-именем → ключ весов/экспорта/SessionPlayer указывал на чужое упражнение. | P1 |
| 32 | `BbAutoConstructor.tsx:2555` | Второй `setBuiltPlan(prev => ({...prev, ...plan}))` перекрывал rationale первого → план терял «📌 Источник/📈 Стратегия/📦 Объём». | P1 |
| 33 | `BbAutoConstructor.tsx:1938` | `volumeScheme` писался в `he_bb_auto_state_v1`, но не восстанавливался → GVT/FST-7 сбрасывался. | P2 |
| 34 | `BbAutoConstructor.tsx:2708` | `dcMode`/`pedPhaseOverride` объявлены и восстанавливаются, но не сохранялись в варианте. | P2 |
| 35 | `TrainingPopups.tsx:68` | `PopupNumber` игнорировал min/max при OK (weeks=999, workMax=99999). | P2 |
| 36 | `bb-step-params.tsx:164` | Мёртвая константа `GRID3`. | P2 |
| 37 | `bb-step-split.tsx:56` | Стрелка «→» в списке фаз считалась по исходной длине, а не по дедуплицированной → хвостовая стрелка. | P2 |

---

## 2. Пере-базированные тесты (осознанно, «было → стало»)

1. `bb-pro-methods-levels.test.ts` — GVT-матрица на 4-нед плане: почти все рабочие недели — taper, и GVT (высокообъёмная схема) их больше не трогает (корректно). Фильтр теста расширен на taper-недели; добавлен отдельный тест на 12-нед плане, подтверждающий полное применение 5×10.
2. `bb-wave-p0-fixes.test.ts` — source-guard, который **закреплял багованный** второй `setBuiltPlan` (перекрытие rationale), переписан на проверку исправленного контракта (калибровка до единственного обогащённого `setBuiltPlan`).

---

## 3. Зафиксированные границы (не менялись, с обоснованием)

1. **Полный minLevel-гейт пула отбора** — в коде явно задокументировано (`bb-exercise-levels.engine.ts:143-149`), что полный гейт пула «душил отбор и рвал объёмы (доказано матрицей)»; intermediate-движения разрешены всем (ACSM 2009), опасное чистит swap-backstop. Изменение → каскад калиброванных падений. Рекомендация: точечно расширять HARD-список.
2. **`postShowRecoveryProgress.targetRegainPct`** = `min(12, weeksElapsed)×1` — приближение траектории «10–15% за 1–6 мес»; при 1%/нед цель 12% достигается к ~3 мес (внутри окна). Информационное поле; менять = пере-базлайн без функциональной ценности.
3. **`bb-constants.ts`** — мёртвый файл (0 импортёров), дублирует `BB_MRV_TOLERANCE`/`BB_TAPER_CURVE`. Оставлен (удаление — churn вне текущей цели).
4. **HRV-база в cycle/program-путях** — `CycleToPlanInput`/`ProgramToBBPlanOpts` не объявляют `hrvBaseline` (паритет-пробел); generic-путь исправлен, остальные — кандидат следующего раунда.
5. **`sessionLimitsFor` в UI-карточке** не передаёт `courseIntensity` (лимиты в UI отличаются от builder на heavy/mild курсе) — кандидат.
6. **Пресет пластин «Машины/блоки»** — no-op (`availablePlates: undefined`); противоречие подписи/движка — кандидат.
7. **Редактор интенсив-техник** не содержит `pause_rep`/`mechanical_drop` (движок их назначает) — «применено, но не показано».
8. **Мелкие dead-переменные** (`verticalSessionsSeen`, `canUseExercise`, `bb-constants`, `GRID3` уже убран) и **годовой макроцикл, который нельзя очистить** в конструкторе — кандидаты.

---

## 4. Что ещё стоит добавить для «профи-инструмента» (roadmap)

Приоритизировано; движок уже покрывает большинство доказательных практик, поэтому пункты — уточнения:

**P1 (влияет на результат):**
1. **Управляемая авторегуляция делода** — сейчас ACWR + readiness; добавить тренд e1RM/самочувствие за 2 недели (Rogerson Delphi: делод по накоплению усталости).
2. **Полный паритет recovery-метрик во всех 4 маршрутах** (HRV-база, bodyFat, leanMass, sleep, stress) — сейчас generic полный, cycle/program частичный.
3. **`sessionLimitsFor` courseIntensity** в UI-карточке (лимиты «показано = применено»).

**P2 (качество/удобство):**
4. **Volume-ramp по ответу**: автотитрование недельного объёма по тренду e1RM/приверженности (частично есть через feedback; вынести в явную опцию).
5. **Редактор техник**: добавить `pause_rep`/`mechanical_drop` в селект (иначе нельзя пере-выбрать назначенное).
6. **Пресет пластин «Машины»**: либо реализовать округление, либо убрать подпись.
7. **Очистка годового макроцикла** в ББ-конструкторе (кнопка «сбросить контекст года»).
8. **Привязка `exerciseName` к id каталога** во всех точках создания (после свопов уже исправлено; провести аудит прочих).

**P3 (гигиена):**
9. Удалить `bb-constants.ts` или сделать его единственным источником (сейчас дубль).
10. Устранить dead-переменные/опции (`verticalSessionsSeen`, `BBSelectorInput.mode`, `BBExerciseEffectCtx.phase/level/goal`, `analyzeRotation.recommendations`).
11. Исправить `fullbody_2`/`upper_lower_3` label↔`sessionsPerRotation` дрейф.
12. Удалить несуществующие id из `STRICT_EXERCISE_GROUPS`.

---

## 5. Верификация

| Проверка | Результат |
|----------|-----------|
| `src/engines/bb` (268 файлов) | **2965 passed / 0 failed / 20 skipped** (базлайн 2964 + 1 новый тест) |
| `src/ui/screens/TrainingScreen_parts` (176 файлов) | **176 passed / 0 failed** (1 source-guard пере-базирован) |
| `npx tsc --noEmit` (весь проект) | **EXIT=0** |
| `npm run build` (vite + PWA) | **OK** (35.3с, 71 precache) |
| `node scripts/check-apk-markers.mjs` | **OK** |

Изменённые файлы — только движки ББ, `movement-pattern.ts`, ББ-UI и 2 теста. Чужие WIP (`.tmp-dbg3.txt` и др.) не тронуты. Коммит не делался.
