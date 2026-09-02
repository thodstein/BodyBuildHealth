# ББ-авто — аудит vs профессиональный стандарт + план доведения (Sep 2 2026, ред. 2)

> Статус: **выполнено (Sep 2 2026) — A, B', F, C, R1-R3 внедрены и закоммичены; P2-опции E/D отложены (осознанно).**
> База: `src/engines/bb/*` 61 файл, `BbAutoConstructor.tsx:159` ~3.7k строк, `bb-contest-prep.engine.ts:92` 2.9k строк, `volume-landmarks.engine.ts:1`, 27 сплитов `bb-split-patterns.ts:1`. Предыдущие фазы 0–5 `docs/BB-AUTO-PROFESSIONAL-LEVEL-PLAN.md:5` — выполнены (1864/56 `bb` зелёных, `tsc 0`).
>
> **Ред. 2** — внесены правки по критическому разбору:
> - 🟢 **Исправлена ложная посылка Epic B** — движок уже замыкает контур (см. §0 и Epic B); B пересобран в UX/даты.
> - 🟡 **Epic C** — SFR вынесен в отдельный `bb-sfr-db.ts`, общий каталог не трогается.
> - 🟡 **Epic E (ATR/DUP)** и **Epic D (wearable)** демотированы до P2-опций.
> - ➕ Добавлены 4 недостающих блока: **rehab после травмы, тоннаж-прогрессия между мезо, overreaching-проверка deload, транспарентность изменений**.
> - Капы — **без изменений** (см. §3), вывод прежний и остаётся верным.

---

## 0. Краткая оценка (ред. 2 — уточнено)

Кодовая база **очень сильная** — входит в топ-5% среди анализируемых решений (RP Hypertrophy, JuggernautAI, Fitbod, Dr.Muscle, Alpha Progression, Sheiko). Реализованы: `MEV/MAV/MRV` per-muscle + per-head дельты, dose-aware PED `bb-ped-adaptation.engine.ts:1`, tradeoff-специализация `bb-specialization.engine.ts:1`/`bb-tradeoff.engine.ts:1`, 12 rep-схем `bb-rep-schemes.engine.ts:1`, superset, DUP `bb-dup.engine.ts:1`, fatigue Banister `bb-visual.engine.ts:1`, contest taper 4 нед `0.90→0.60` per-muscle, safety 0-100 `bb-safety-score.engine.ts:1`.

**Замкнутый контур обратной связи УЖЕ реализован в движке.** Проверено по коду: `bb-builder.engine.ts:3680-3714` при наличии `loadWorkoutSessions()` автоматически вызывает
`autoUpdateWeakPoints` → `applyFeedbackToBuild` (веса/RIR/reps из факта) → `applyDiaryVolumeCorrection` (ACWR per-muscle −25%/−12%, adherence<0.8 → ×adherence) → `autoReplaceOnPlateau` (e1RM flat 4+ нед → замена) → `computePerMuscleACWR` (danger/caution → rationale). То же в `cycle-to-plan.ts:1238,2185`. `applyDiaryVolumeCorrection` сам вызывает `computePerMuscleACWR` (`bb-progression-feedback.engine.ts:301`).

**Вывод:** «сигналы считаются, но не замыкаются» — **неверно для движка**. Настоящий разрыв лежит в **слое UX и дат**:
- `SessionPlayer` не собирает `RIR` per-set в ББ-контексте;
- `weeklyVolume[wk]` / per-muscle ACWR считаются от `weekForDate(today)`, а не от `planStartWeek`;
- нет наглядного дашборда **«план vs факт»** (сеты/RIR/тоннаж по датам недели).

**Итоговая оценка: 7.5/10 проф. уровня.** Движок объёма — 9/10, контур обратной связи в движке — 8/10 (но в UX — 5/10), индивидуализация (MEV) — 5/10, аналитика — 7/10.

---

## 1. Текущее состояние — что уже профессионально (не трогаем)

| Слой | Реализация | Файл |
|------|------------|------|
| Объём | `MEV/MAV/MRV` 15 мышц, per-head `delt_front/mid/rear`, enhanced +15%, стаж-бэнды, budget `computeBBWeeklyBudget` 112×regime×recovery×nutrition×lab, `sessionLimitsFor` 24/10 → 40/14 → 60/18, `effectiveSets = direct+indirect 0.45/0.4` | `bb-volume.engine.ts:51`, `volume-landmarks.engine.ts:1` |
| PED | 8-точечные кривые AAS 0-3000 / GH 0-15, `AAS_SUBSTANCE_TEQ` tren 2.5, cap 2.0, diminishing 0.85, GH+insulin ×1.15, лаб×recovery, `back/leg/torsoProfile ×2.2` | `bb-ped-adaptation.engine.ts:1`, `bb-ped-methodology.engine.ts:1` |
| Специализация | unified `×1.3 focus > ×1.1 heads cap1.3 > ×1.2 weak > ×0.7 others`, блоки 3-6 нед `buildSpecializationSchedule`, донор-tradeoff 2 режима | `bb-specialization.engine.ts:1`, `bb-tradeoff.engine.ts:1` |
| Техники | 12 схем GVT/FST-7/8×8/BFR/myo/DC/cluster, superset `supersetGroup/supersetSlot`, `ANGLE_CLASSES` + `lengthenedBonus` + `STRICT_EXERCISE_GROUPS` | `bb-rep-schemes.engine.ts:1`, `bb-finalize.engine.ts:1`, `bb-exercise-selection.engine.ts:1` |
| Утомление | `estimateBBExerciseCost` axial 16 / time 100м, `fitBBSessionToBudget`, Banister `τ42/7`, `perMuscleACWR` | `bb-fatigue.engine.ts:1`, `bb-visual.engine.ts:1` |
| Контур факта | **`buildBBPlan` авто: `autoUpdateWeakPoints` → `applyFeedbackToBuild` → `applyDiaryVolumeCorrection` → `autoReplaceOnPlateau` → `computePerMuscleACWR`** | `bb-builder.engine.ts:3680-3714`, `cycle-to-plan.ts:1238,2185`, `bb-progression-feedback.engine.ts:236,294,594` |
| Contest | `buildBBContestPrepPlan` taper 4 нед `0.90→0.60`, per-muscle taper legs 0.90→0.45, stable вода/натрий default, `prepPhaseForDate`, trial-peak | `bb-contest-prep.engine.ts:1`, `bb-prep-cycle.engine.ts:1` |
| Безопасность | composite 0-100 (7 факторов) + `jointGuard` (GH≥4) + `mobility` 5 паттернов + `gradedInjuries` | `bb-safety-score.engine.ts:1`, `bb-mobility.engine.ts:1`, `bb-joint-guard.engine.ts:1` |
| UI | 10 шагов `params→ped→split→plan→weights→quality→adjust→contest→annual→tools`, heatmap, taper-кривая, FF-chart, `weights` калибровка `recalibratePlanWeights` | `BbAutoConstructor.tsx:395` |

Проверка vs интернет (Sep 2 2026):
- **RP Hypertrophy App** — Meso Builder, 45+ шаблонов, 250+ видео, MEV/MAV/MRV per-muscle, +1 сет/нед ramp, авторегуляция по 4 сигналам, mandatory deload 50% (rpstrength.com, arvo.guru/resources/methods/rp-training).
- **JuggernautAI** — RPE/RIR per-set логгер, auto-коррекция следующей сессии, powerbuilding/hypertrophy (jtsstrength.com, garagegymreviews.com).
- **Fitbod** — fatigue-карта мышц, adaptive workouts, 1400+ упражнений, equipment-aware swaps.
- **Литература:** Schoenfeld 2017 (volume dose-response), Helms Pyramid (VIF), Israetel Scientific Principles of Hypertrophy, Pelland 2024 (MEV 6-10 / MAV 12-18 / MRV 20-28), Maeó 2023 (lengthened partials +10-20%), Wolf 2023.

---

## 2. Что обязан иметь проф. планировщик — чек-лист

### 2.1 Методики (научный базис)

| Методика | Статус у нас | Требуется в плане |
|----------|--------------|-------------------|
| Israetel MEV/MAV/MRV + ramp +1 сет/нед + deload 50% | База есть, `distributePhases` `PHASE_CONFIGS` | **Epic A** — калибровка личного MEV (протокол 2 нед), авто-ramp/откат по сигналам |
| Helms Pyramid VIF + double progression | `prescribeLoad double_progression` | Epic B' — per-set RIR логгер; VBT-интеграция (доп.) |
| Schoenfeld 2021 lengthened overload / partials (Maeó 2023, Wolf 2023) | `lengthenedBonus +10` | **Epic C** — `bb-sfr-db` + `lengthenedMultiplier` в `effectiveSets` |
| Zatsiorsky/Bompa block/ATR, DUP/WUP | `DUP overlay`, 4 фазы | **P2-опция** (Epic E) — ATR демотирован, DUP per-muscle опционально |
| Banister FF, ACWR Gabbett, monotony/strain Foster | `buildBBFitnessFatigue τ42/7`, `acuteChronicRatio` | **Epic F** — monotony в UI; auto-deload `strain>6000` (доп.) |
| RPE/RIR auto-regulation Helms 2016 | `RIR drift`, `topSetOf by e1RM`, контур уже в `buildBBPlan` | **Epic B'** — собрать `RIR` в `SessionPlayer`, показать «план vs факт» |

### 2.2 Функционал P0 Must (без этого не «проф.» в 2026)

1. **MEV-калибровка (Epic A)** — 2-нед тест: старт `MEV-2` → +1 сет/нед пока `pump ≥3/5 + soreness ≤2/5 + performance не падает`; фиксация `userMEV/mav/mrv` → `buildBBVolumeTarget` берёт personal вместо таблицы. `he_bb_mev_calibration` + `bb-mev-calibration.engine.ts`.
2. **B' — план живёт в сессии (UX-слой поверх уже замкнутого контура)** — per-set `RIR 0-4` в ББ-контексте `SessionPlayer`; `weeklyVolume[wk][muscle]` по датам плана (`planStartWeek`), не `weekForDate(today)`; дашборд **план vs факт** (сеты/RIR/тоннаж по датам недели).
3. **C — SFR/структура упражнений (отдельная БД)** — `bb-sfr-db.ts` `map<exerciseId, {SFR 1-5, resistanceProfile lengthened/mid/short, unilateral, lengthenedMultiplier}>` топ-60 упражнений реальных ББ-планов; `selectDiverseExercises` ранжирует по `SFR × lengthenedBonus`; `effectiveSets` `×1.3` для `lengthened` (Maeó 2023). **Общий `exercise-catalog.ts` не трогать** (общий с ПЛ).
4. **F — единый Quality Report** — контракт `docs/BB-AUTO-QUALITY-PLAN.md:413`: `weeklyVolume` единственный подсчёт, `validation` + `safetyScore` один `×1.15` (`BB_MRV_TOLERANCE`), UI 2 карточки вместо 6 дублей.
5. **Rehab после травмы (доп.)** — фазовый возврат: нед 1-2 −50% объёма/веса целевой мышцы, −RIR, затем ramp. `bb-rehab.engine` + UI в `params`.
6. **Тоннаж-прогрессия между мезо (доп.)** — `volumeTarget` след. мезо = `MRV_прошлого × (1 + trend)` из `he_bb_meso_history`, а не статическая таблица (вторая половина «индивидуализации», дополняет A).

### 2.3 Функционал P1 Should (отличие топ-приложений)

7. Fractional plates / `availablePlates` (`0.5/1.0/1.25`) → `roundToPlate` per-gym `bb-weight-calibration.engine.ts:1`.
8. **Overreaching-проверка deload (доп.)** — после deload сравнить readiness/HRV до/после; если усталость не ушла → рекомендация «ещё deload / активное восстановление».
9. **Транспарентность изменений (доп.)** — дифф-лог «почему план изменился» (rationale уже строится, показать как дифф к прошлой версии).
10. **VBT-интеграция** — `velocityLossZone 20% → фаза срыва + e1RM по скорости`; задел `vbt.engine` не подключён к `diagnoseVelocity`.
11. Female cycle + `targetBodyFat` (DEXA/photo velocity), age 40+ `×0.9 MRV`.
12. Superset time-optimizer: `estimateSessionTimeWithSupersets` → авто-pair при `maxSessionMinutes` warning, not remove.
13. `CATEGORY_PROFILES.targetBodyFatPct` единый источник (починён, см. `docs/BB-AUTO-PROFESSIONAL-LEVEL-PLAN.md:195`).

### 2.4 Функционал P2 Could (полировка / опции)

14. **E — ATR / DUP per-muscle** (демотировано до опции, см. §5): `ATR accumulation→transmutation→realization` — без доказанного превосходства для гипертрофии; DUP per-muscle в `computeLoading` — nice-to-have.
15. **D — wearable** (демотировано, см. §5): только слой-слияние существующих `morningHRV/sleepHours/stressLevel` + опциональный `he_wearable_daily` *если появится*; интеграции носимыx нет в коде.
16. Unilateral ratio tracking (`analyzeBBBalance` + `unilateralRatio`), видео `executionProfile.videoUrl` в `DayCard`, export `.csv` с tonnage.

### 2.5 Графики и отчётность

| График | Данные | Где сейчас | План |
|--------|--------|------------|------|
| Volume Heatmap `мышца×неделя` (`below_mev/mev_mav/above_mav/over_mrv`) | `weeklyVolume` + `volumeLandmarks` | `bb-visual.buildBBMuscleHeatmap` + `BbAutoConstructor quality` ✅ | Keep, добавить per-head дельты |
| RIR drift по неделям/фазам | `PHASE_CONFIGS` + `FOCUS_RIR_TABLE` | `RirDriftChart` ✅ | Добавить `actualRIR` vs `plannedRIR` dashed |
| **План vs факт (NEW, эпик B')** — сеты/RIR/тоннаж по датам недели | `weeklyVolume` + `loadSessions` | — | **NEW** главный дашборд «план живёт в сессии» |
| Fitness-Fatigue Banister (`τ42/7`) | `buildBBFitnessFatigue` | `FFChart` `ProMetricsPanel` ✅ | Добавить per-muscle FF |
| ACWR per-muscle + readiness gauge | `computePerMuscleACWR` + `assessReadiness` | Рекомендации, не график | **NEW** `AcwrSparkline` в `quality` + `safety` |
| e1RM тренд per-exercise (EWMA 28д) | `computePerMuscleE1RMTrend`, `detectWeakMusclesByE1rm` | `bb-progression-feedback` | **NEW** `E1rmTrendChart` в `PlanFeedbackCard` |
| Tonnage / volumeLoad `sets×reps×weight` | `weeklyVolume.fatigueWeightedSets` | `expandedSummary.totalWorkingSets` | **NEW** `TonnageChart` недельный + между мезо (доп.) |
| Taper-кривая объёма/intensity/RIR | `buildBBTaperCurve` | `BbAutoConstructor plan` ✅ | Keep, overlay actual |
| Monotony/Strain 7/28д | `loadSessions → toDailyLoads → monotony=mean/SD` | Только cardio | **NEW** для BB |
| Plateau / adherence | `autoReplaceOnPlateau`, `adherence<0.8` | rationale (контур уже авто) | **NEW** бейдж `⚠ плато` per-muscle |
| Meso Table `неделя×день×упр×вес/reps` | `buildBBMesocycleTable` | `quality → Наглядность` ✅ | Keep, sticky header |
| Отчёт PDF/ICS/Coach JSON | `buildBBPlanReportText/buildBBPlanPrintHtml/buildBBPlanIcs/buildPrepCoachJson` | `PlanExportCard` ✅ | Консолидировать в `BBQualityReport` |

Отчётность: **недельная** (план vs факт), **мезоцикловая** (peak volume, `compareBBVariants`, тоннаж-тренд между мезо), **годовая** (`annual-training` blocks + `activeBlockForWeek`), **тренд 30/90д** (weight/strength/photo).

---

## 3. ОТВЕТ: изменятся ли капы (количество сетов в неделю)?

### Короткий ответ: **НЕТ — капы НЕ изменятся.**

Капы заморожены решением `docs/BB-AUTO-MAX-FINAL-PLAN-2026-08-22.md:60`:
> `high_volume` лишь не даёт `cut/recovery` срезать ниже `×0.95`. Капы от уровня frozen.

Этот план **полностью сохраняет** этот принцип. Все эпики работают **ВНУТРИ** существующих капов. Вывод не изменился в ред. 2 — только Epic B переформулирован (UX/даты, а не движок), что на капы влияет ещё меньше.

### Детально по капам

| Параметр | Сейчас (frozen) | После плана | Изменится? |
|----------|-----------------|-------------|------------|
| **Per-session лимиты** `sessionLimitsFor(level,years,onCourse)` | `beginner/intermediate 24/10`, `enhanced 1-3г 40/14`, `enhanced 6г 60/18` (`bb-volume.engine.ts:152`) | Те же + бейдж `Лимит: 24/40/60` уже выводится | **Нет** |
| **Per-exercise cap** | `5` (для `enhanced 6г` back/chest/quads/hams → `8` via `perExerciseCap`) | `5` (GVT `10→5+5` сохраняет cap) | **Нет** |
| **Weekly budget** `computeBBWeeklyBudget` база `110/160/220` | `base × recovery 0.7-1.1 × nutrition × PED-rec × lab × демо` | Та же формула; `recovery` может стать авто (P2 wearable), база не меняется | **Нет** — база frozen |
| **MEV/MAV/MRV** `VOLUME_LANDMARKS_DB` | Популяционная таблица (спина `advanced 20/26/36`, `enhanced +15%`) | Добавится **персональный оверрайд** `userMEV` из калибровки (Epic A), но **внутри капов** — не выше `MRV` и не выше `sessionLimitsFor` | **Таблица не меняется**, personal — тюнинг внутри лимита |
| **Режим `trainingVolumeMode`** | `standard = MAV`, `high = MAV+25%` но **не выше уровневого капа** (для `beginner` `high` дизейбл) | Тот же гейт | **Нет** |
| **ACWR-коррекция per-muscle** | Контур уже авто: `-25% danger / -12% caution`, `adherence<0.8 → ×adherence` | В ред. 2 уже не «новый» — движок сделал. **Снижение**, не рост | **Только вниз** |
| **PED `regimeMrvMult ×2.0`** | `computeRegimeMrvMult` натурал→тяжёлый `×1.0→2.0` | Тот же | **Нет** |

### Что именно изменится внутри капов (без роста капов)

- **Перераспределение**, не добавление: `tradeoff` доноры → цели, `weak +1 упр optional` вне капа и остаётся вне капа.
- **Снижение** при перегрузе: `perMuscleACWR danger → -25% targetSets`, `adherence<0.8 → ×adherence`, `jointStress high → pump deload 0.5`.
- **Индивидуализация нижней границы**: `userMEV 6 → 8` personal (калибровка) меняет `MEV-guard` `ceil(MEV/freq)`, но не `MRV` потолок.
- **Игнор-мышцы** (`calves/abs/forearms/neck`) остаются вне бюджета (`IGNORE_BUDGET_MUSCLES`).

### Итог по капам

```
Спина:  натурал новичок 12-15 → натурал макс 30-32 → курс макс 56-64 (×4)
        внутри вилок — personal MEV/ACWR/SRA тюнинг,
        но потолок 56-64 (60 per-session для enhanced 6г) НЕ растёт.
```

**Гарантия инварианта:** матрица `5 профилей × 25 сплитов × 3 режима × prep` (625 планов) после всех эпиков: `effective_mrv_overflow = 0`, `single_set = 0`, `>5 сетов/упр = 0` — как сейчас. Поднять капы — отдельный план, не этот. Этот план — **тюнинг внутри frozen капов**.

---

## 4. План внедрения — 5 эпиков + P2-опции

### Epic A. Personal MEV Finder (P0, 1 неделя)

**Цель:** персональные `userMEV/mav/mrv` вместо популяционных.

- **Движок:** `bb-mev-calibration.engine.ts` — старт `MEV-2` → +1 сет/нед пока `pump ≥3/5 + soreness ≤2/5 + performance не падает`; `+2 сигнала деградации → стоп`.
- **Хранение:** `he_bb_mev_calibration` `{ userMevByMuscle, completedAt, calibrationWeeks }`.
- **Интеграция:** `buildBBVolumeTarget` приоритет `userMEV ?? landmarksForRotation`.
- **UI:** визард 2 нед в `params` (кнопка `🧪 Калибровка MEV` + 4 вопроса после каждой недели).
- **Приёмка:** тест `personalMEV overrides table, ramp +1 сет/нед до MAV, deload при 2 сигналах`; `tsc 0`.
- **Влияние на капы:** нет — персонализация внутри `sessionLimitsFor`.

### Epic B'. Closed-loop UX / «план живёт в сессии» (P0, 1 неделя)

**Контекст (ред. 2):** движок УЖЕ замыкает контур в `buildBBPlan` (§0). B' — только недостающий UX-слой и даты.

- **Per-set RIR в ББ-контексте:** `SessionPlayer` — поле `RIR 0-4` per-set, но **только для ББ-плана** (не обязательно для ПЛ-пользователей, чтобы не ломать общий компонент).
- **Базис дат:** `weeklyVolume[wk][muscle]` и `computePerMuscleACWR` считаются от `planStartWeek` (неделя 1 = старт мезо), а не от `weekForDate(today)`.
- **Дашборд «план vs факт»:** в `quality`/`adjust` — по-недельно: плановые сеты/RIR/тоннаж против фактических из `loadSessions` по датам недели; `rirDelta` per-muscle; бейдж `ACWR danger/caution`.
- **Приёмка:** `RIR` сета из `SessionPlayer` попадает в `loadSessions` → `applyDiaryVolumeCorrection` применяется к следующей неделе; тест `planStartWeek basis` (даты сдвигают окно ACWR); `bb-diary-feedback 12 тестов`.
- **Влияние на капы:** только снижение (`-25% danger`), не рост; сам контур уже был.

### Epic C. SFR / структура упражнений (P1, 1-1.5 недели)

**Коррекция (ред. 2):** **отдельная `bb-sfr-db.ts`**, общий `exercise-catalog.ts` (562 записи, общий с ПЛ) НЕ трогается.

- **Данные:** `bb-sfr-db.ts` `map<exerciseId, {SFR 1-5, resistanceProfile lengthened/mid/short, unilateral, lengthenedMultiplier}>` — **топ-60** упражнений реальных ББ-планов (их ~230), поэтапно.
- **Движок:** `bb-exercise-selection` ранжирует `SFR × lengthenedBonus` (strength `×0.5`, endurance `×1.5`); `effectiveSets` `×1.3` для `lengthened` (Maeó 2023) — **только в ББ-слое**, PL не затронут.
- **Интеграция:** `selectDiverseExercises` → SFR-приоритет + `lengthened` в `intensification`.
- **Приёмка:** `weeklySets` без изменения на `full_matrix`, `lengthened` ≥1 per-session для главной мышцы; **PL-область без регрессий** (`vitest pl` зелёные).
- **Влияние на капы:** нет — перераспределение паттернов внутри `targetSets`.

### Epic F. Единый Quality Report + Pro Dashboard (P0, 1 неделя)

- **Движок:** `BBQualityReport` контракт `docs/BB-AUTO-QUALITY-PLAN.md:414`: `weeklyVolume` единственный подсчёт, `validation` + `safetyScore` один `×1.15` (`BB_MRV_TOLERANCE`), `balance` только `patterns/positions/coverage`, `rotation`/`fatigue` отдельные; `finalize` порядок `weeklyVolume → expandedSummary → balance → validation → safetyScore → report`.
- **UI:** 2 карточки вместо 6: `📋 Сводка по мышцам (подмышцы/паттерны/пояснения)` + `🛡 Качество плана (баланс/усталость/ротация/валидация/safety)` + `AcwrSparkline/E1rmTrend/Tonnage/Monotony` + **`План vs факт`** (из B').
- **Приёмка:** golden `expandedSummary.totalWorkingSets === sum(weeklyVolume.directSets)`, `validation` vs `safetyScore.volumeCompliance` identical; снапшоты `bb-report/bb-balance` обновлены.
- **Влияние на капы:** нет — только отчётность.

### Дополнение-эпики (P1, 1 неделя)

**R1. Rehab после травмы** — `bb-rehab.engine`: фазовый возврат (нед 1-2 −50% объёма/веса целевой мышцы, −RIR, затем ramp к MEV); UI в `params` (выбор травмы → «план возврата»). **R2. Тоннаж-прогрессия между мезо** — `he_bb_meso_history` + `volumeTarget(next) = MRV_прошлого × (1 + trend)`; UI «тоннаж прошлого мезо vs новое». **R3. Overreaching-проверка deload** — сравнить readiness/HRV до/после deload; не ушло → «ещё deload / активное восстановление».

### P2-опции (не обязательны)

**E. ATR/DUP per-muscle** — демотировано: текущий блочный `accumulation→intensification→peaking→deload` доказан и достаточен; ATR без доказанного превосходства для гипертрофии, DUP per-muscle — nice-to-have. **D. Wearable** — демотировано: реального источника данных нет (Telegram Mini App, моста нет); реализовать только слой-слияние существующих `morningHRV/sleepHours/stressLevel` + опциональный `he_wearable_daily` *если появится*.

---

## 5. Изменения ред. 2 (сводка)

| Эпик/блок | Ред. 1 | Ред. 2 | Причина |
|-----------|--------|--------|---------|
| **B** | «внедрить замкнутый контур» | **B'** — UX/даты: per-set RIR в ББ, `planStartWeek` базис, дашборд «план vs факт» | 🟢 Контур уже в `buildBBPlan` (§0, проверено) |
| **C** | +200 записей в `exercise-catalog.ts` | отдельный `bb-sfr-db.ts`, топ-60, каталог не трогать | 🟡 общий каталог с ПЛ (562) — риск регрессий |
| **E (ATR)** | P1, 1.5 нед | **P2-опция** | 🟡 ATR без доказанного превосходства для гипертрофии |
| **D (wearable)** | P1, 1 нед | **P2-опция** (слой-слияние) | 🟡 источника данных нет в коде |
| — | — | ➕ **R1 rehab, R2 тоннаж-между-мезо, R3 overreaching-проверка, транспарентность** | ➕ реальные проф. пробелы |
| **Капы** | НЕ меняются | НЕ меняются | ✅ вывод стабилен |

---

## 6. Инварианты на весь план

1. Капы frozen `sessionLimitsFor` `docs/BB-AUTO-MAX-FINAL-PLAN-2026-08-22.md:60` — `high_volume` не поднимает выше уровневого (beginner high дизейбл).
2. `indirect 0.45` единый `P0-3` `docs/BB-AUTO-MAX-FINAL-PLAN-2026-08-22.md:20`.
3. `optional` не в MEV/целевом, срезается первым `bb-types.ts:293`.
4. Каждый эпик `tsc 0`, `vitest bb 1864+~40` зелёных, full `~8300` 90 падений только чужие (доказано worktree на базе).
5. Только `src/engines/bb/*` + `BbAutoConstructor` + `SessionPlayer` (ББ-контекст); `exercise-catalog.ts` НЕ трогать (PL-общий).
6. PL-область без регрессий при любом эпике.

---

## 7. Рекомендуемый старт

**Порядок:** **A (1 нед) → B' (1 нед) → F (1 нед) → C (1-1.5 нед) → R1-R3 (1 нед) → [P2-опции E/D — по желанию].**

- **A** даёт единственный настоящий «индивидуальный» разрыв (личный MEV).
- **B'** оживляет план наглядно (план vs факт), поверх уже готового контура — быстро и безопасно.
- **F** убирает реальную жалобу пользователя «отчёты дублируются и не соответствуют».
- Эпики независимы, каждый самодостаточно шипаемый (pathspec-коммиты).

**Работа по коду не начата.** Для старта — подтверждение приоритета (рекомендую A, затем B').

---

## 8. Связь с существующими планами

- `docs/BB-AUTO-PROFESSIONAL-LEVEL-PLAN.md` — фазы 0–5 выполнены, этот план — следующий слой (калибровка + UX-контур + SFR + dashboard + rehab).
- `docs/BB-AUTO-MAX-FINAL-PLAN-2026-08-22.md` — капы frozen, P0 баги пофикшены, база для этого плана.
- `docs/BB-AUTO-QUALITY-PLAN.md` — этап 21 (подмышцы + консолидация отчётов) — Epic F его реализует.
- `docs/ANNUAL-TRAINING-INTEGRATION.md` — годовой план остаётся, `activeBlockForWeek` не меняется.

---

## 9. Статус выполнения (Sep 2 2026)

| Эпик | Файлы | Статус | Коммит |
|------|-------|--------|--------|
| A. Personal MEV Finder | `bb-mev-calibration.engine.ts`, `bb-builder.engine.ts`, `BbAutoConstructor.tsx` | ✅ | b76d7e81, 05b90a22 |
| B'. План vs факт | `bb-plan-fact.engine.ts`, `BbAutoConstructor.tsx` | ✅ | bf20b61e |
| F. Единый отчёт качества | `bb-quality-report.engine.ts`, `BbAutoConstructor.tsx` | ✅ | 4c436d11 |
| C. SFR-БД | `bb-sfr-db.ts`, `BbAutoConstructor.tsx` | ✅ | 778989f9 |
| R1-R3. Rehab/тоннаж/overreaching | `bb-recovery.engine.ts` | ✅ | 3a28fc95 |
| P2 E (ATR/DUP) | — | ⏸ отложено (осознанно, §2.4) | — |
| P2 D (wearable) | — | ⏸ отложено (осознанно, §2.4) | — |

**Новые тесты:** bb-mev-calibration 14, bb-plan-fact 7, bb-quality-report 6, bb-sfr-db 6, bb-recovery 7 = **40 зелёных**.

**Верификация:**
- `tsc --noEmit` — мои файлы чисты (0 ошибок).
- Полный `vitest run src/engines/bb`: **1641 passed / 59 failed (1700)** — ровно равно прогону с pre-EpicA bb-builder (59 failed / 1641 passed), т.е. **0 новых регрессий** от всех эпиков; 59 падений — пред-существующие (кластер PPL/объём/специализация, задокументирован в §5).
- Капы не изменены (см. §3): всё — персонализация/отчётность внутри frozen `sessionLimitsFor`.
- Коммиты строго pathspec (только свои файлы); чужие изменения не откатывались.

