# ББ-Диагностика PRO — план хаба движения бодибилдинга

> **Статус:** ✅ выполнен (Sep 02 2026, 9fcfc471) — хаб без дублей: 3 уникальных движка + RSS + OHS/VBT + 6 табов (3 NEW + 3 composite), 14 файлов, 1720+.
> **Цель:** единый хаб диагностики ББ (не силы): отстающие мышцы → объём → симметрия → качество стимула → восстановление → мобильность/VBT → точечная коррекция в ББ-авто через `planner-bridge kind:weakpoints`.
> **Отличие от ПЛ/ТА:** нет 1ПМ/фаз движения штанги как цели; цель — **гипертрофия через MEV/MAV/MRV + пропорции + качество стимула**. 1ПМ/e1RM — лишь прокси прогрессии, а не соревновательный результат.

---

## 1. Анализ существующих хабов (паттерн проекта)

| Хаб | Файл | Табы/суть | Скоринг | Мост в конструктор |
|-----|------|-----------|---------|-------------------|
| **PL** | `DiagnosticsHub.tsx` + `LiftMasterCard` (9 лифтов) | 9 лифтов × углы/траектория/VBT/видео, срывы из дневника RPE≥8, RIR, мезо | `buildBBQualityReport` + `analyzeBBBalance` | `plWeakPoints` → `injectPLWeakPoints` + `diagnosticExerciseMap/DayMap` |
| **TA** | `WLDiagnosticsHub.tsx` (520с) | 6 табов: рывок5+взятие3+толчок3 × `angleRangeDeg` + bar path Vorobyev/SRD + VBT peak + FvR2 + OHS6 + Kinovea/Enode | `scoreTA` RSS `√Σpen²` + floors + verification 0.35/0.35/0.30 (video/VBT/mobility) | `wlWeakPoints+biomech/fvr/ohs` → `strength-sport-ta-injection 3×5 @intensityPct` |
| **Арм** | `ArmDiagnosticsHub.tsx` | 5 табов: Grip/Wrist/Pressure/Strength(F/t F100/F500)/Recovery, углы РУ/РА/РН, dynamic F/t, ACWR | без score (факты) | `groups → arm_constructor` |
| **Стронг** | `StrongmanDiagnosticsHub.tsx` | 4 ивента (жим/переноски/загрузки/хват) × углы+VBT | simple 0-100 | `smWeakPoints` → strongman |
| **Общий** | `QualityDiagnosticsHub.tsx` → `QualityHub.tsx` | `quality` (0-100 MEV/MAV/MRV) + `diagnostics` → разделены | — | — |

**Вывод паттерна для ББ:**
- Хедер с RSS-гейджем 0-100 + чип-verification + ACWR + лимитер-подсказка
- 5-6 табов с числовыми инпутами + чекбоксами + автоподтяжкой из дневника/профиля
- Кнопка `→ Применить в ББ-авто` (planner-bridge) с сохранением `[score, level, verification, biomech]` и `he_profile_v2` записью
- Персист `localStorage he_bb_diagnostics_hub_v1` + экспорт HTML/CSV + `→ профиль` для мобильности

### 1.1 Аудит дублей — что уже есть и как соединить (без плодить дубли)

> Принцип проекта: **один расчёт — одно место**. ББ-хаб — **тонкий оркестратор** над существующими инструмент-хабами, а не копия таблиц.

| Потребность ББ-хаба | Где уже есть (канон) | Решение: соединить, а не дублировать |
|---|---|---|
| **MEV/MAV/MRV per-muscle + SFR + частота** | `VolumeHub.tsx:18` + `VolumeOptimizerTab` + `volume-landmarks.engine.ts:36` (16 мышц ×4 уровня, канон) + `bb-volume.engine.ts` | **Таб `📊 Объём` — embed `VolumeOptimizerTab` (проп `division='bb'`)**, а не своя таблица. ББ-хаб лишь читает `he_bb_plan` + `he_workout_log_v1` → `aggregateBBVolume` и показывает чип-статус + deep-link `→ Объём-хаб: детали`. Движок не копируется. |
| **Тоннаж/КПШ/УОИ, зоны интенсивности** | `VolumeHub.TonnageCalcTab` (Prilepin КПШ, тоннаж) | **Deep-link** из ББ-хаба, не свой расчёт. |
| **Блины/грифа/%1RM** | `VolumeHub.PlateCalcTab` | **Исключить** из ББ-хаба. |
| **Общее качество 0-100 + PED/lab** | `QualityHub.tsx:11` + `CalcQualityTab.tsx:33` (`computePlanQualityFor` + `analyzeProQuality` + PED `adaptForPEDs`) + `bb-quality-report.engine.ts:100` | **ББ-хаб не строит свой quality-UI** — читает `buildBBQualityReport(plan)` и показывает только хедер-чип `score` + `→ Качество: детали`. Полный разбор остаётся в `QualityHub`. |
| **ACWR/monotony/strain/Banister** | `UnifiedIntelligenceHub.tsx:50` секция `load` (`toDailyLoads`/`acuteChronicRatio`/`weeklyMonotony`/`fitnessFatigue`) + `training-load.engine` — **единственный источник** | **Таб `🔋 Восстановление` — reuse snapshot `he_unified_intel_snapshot_v1:75`** (read-only) + `computePerMuscleACWR` (ББ-специфика, которого нет в Unified). Общую ACWR-ленту не копировать — показывать чип + `→ Интеллект → Нагрузка`. |
| **Recovery (сон/HRV/готовность/shouldTrain/deload) + PRI + RPE↔вес + RIR-калибрация** | `UnifiedIntelligenceHub recovery/autoreg` (`analyzeRecovery`, `shouldTrain`, `calculatePRI`, `autoRegulate`) — **канон без дублей** (`TrainingSafetyHub.tsx:3` уже редиректит сюда) | **Не дублировать** 0-100 инпуты готовности/усталости/сна/HRV. ББ-хаб читает `he_unified_intel_snapshot_v1` и показывает verdict-чип + `→ Интеллект → Восстановление/Авторегуляция`. Специфику **per-muscle ACWR** (`bb-progression-feedback`) — оставить тонкой надстройкой. |
| **Прогноз готовности (Хольт) + what-if** | `UnifiedIntelligenceHub forecast` (`generateReadinessForecast`, `runWhatIf`) | **Исключить** из ББ-хаба — deep-link. |
| **Суставы/ортопедия + JSI + FMS + техника упражнения** | `TrainingSafetyHub.tsx:21` (4 секции) → `LoadSafetyCard` + `QualityJointHub` (орто) | **Не копировать** OHS-оценку сустава. ББ-хаб в `🦿 Мобильность` показывает только ББ-чек (knee-to-wall, плечо, hip IR) и кнопку `→ Суставы и ортопедия: полный разбор`. |
| **1RM (7 формул) + VBT скорость + DOTS/Wilks/IPF GL + процентили** | `StrengthAnalysisHub.tsx:22` (4 мода `1rm/vbt/norms/analytics`) + `relative-strength.engine` + snapshot `he_strength_hub_snapshot_v1:32` | **Не дублировать** 1RM/VBT ввод. ББ-хаб в `🦿` использует `bb-vbt.engine.ts:29` (`bbVbtRecommendation` зоны 20-25% гипертрофия) как тонкий фасад над `pro/vbt.engine`, читает `he_strength_hub_snapshot_v1` для `bw/sex/squat/bench/dead/ohp`, показывает VBT-чип + `→ Анализ силы → VBT`. |
| **OHS 6 + knee-to-wall + heel retest + Kinovea/Enode + BlazePose** | `WLDiagnosticsHub.tsx:17` + `strength-sport-ohs.engine`, `strength-sport-video.engine`, `strength-sport-pose.engine` | **Reuse как либу** (0 правок): `assessOHS`, `parseKinoveaCSV`, `estimateAnglesFromLandmarks` — импорт, не копия. Видео-превью — тот же `videoRef` паттерн. |
| **Рекомендации ББ (план/PED/питание/выполнение)** | `UnifiedIntelligenceHub.tsx:198` `generateBBRecommendations` (читает `he_bb_plan_saved` + дневник) | **Не дублировать** — ББ-хаб показывает 2-3 топ-рекомендации + `→ Интеллект → Рекомендации`. |
| **Per-muscle e1RM тренд / плато / adherence → volume correction** | `bb-progression-feedback.engine.ts:236` (`applyFeedbackToBuild`, `autoReplaceOnPlateau`, `computePerMuscleACWR`, `applyDiaryVolumeCorrection`) | **Оставить в ББ-хабе** — этого нет в Унифиц./Volume хабах, это ББ-специфика (тоннаж vs сеты). |

**Итоговая архитектура (грамотные инструмент-хабы):**
```
BBDiagnosticsHub (тонкий, ~380с, не 520с)
 ├─ 🎯 Слабые        → NEW  bb-weak-detection (unique)
 ├─ ⚖️ Симметрия     → NEW  bb-symmetry (unique, Reeves/Adonis/FFMI)
 ├─ 💪 Стимул        → NEW  bb-stimulus (unique, lengthened/pattern/ANGLE_CLASSES) + reuse bb-balance
 ├─ 📊 Объём         → EMBED VolumeOptimizerTab (division=bb) + чип buildBBQualityReport (link → VolumeHub/QualityHub)
 ├─ 🔋 Восстановление→ CHIP  Unified snapshot + per-muscle ACWR тонкая надстройка + link → Интеллект
 └─ 🦿 Мобильность/VBT→ REUSE  strength-sport-ohs/video/pose + bb-vbt + bb-mobility + links → Суставы / Анализ силы
     ────────────────────────────────────────────────────────────────────────────────
     Хедер: RSS scoreBB (6 пенальти) + verification + ACWR-chip (из Unified) + volume-budget chip + link-чипы
     Футер: → Применить в ББ-авто (weakpoints) + 🖨 HTML/CSV + → профиль (he_profile_v2 mobility)
```
**Выигрыш:** −2 таблицы-дубля (объём/quality), −3 блока-дубля (ACWR/recovery/1RM), −1 видео-дубль, **−~200с UI-кода**, единый снапшот `he_unified_intel_snapshot_v1` + `he_strength_hub_snapshot_v1` без рассинхрона ввода.

---

## 2. Интернет-источники (проверено Sep 02 2026)

**Объёмные ориентиры (MEV/MAV/MRV):**
- Schoenfeld et al. 2017 *Med Sci Sports Exerc* 49(3):661 — мета-анализ 15 исследований: **10+ сетов/нед > <5**, дозо-зависимость до ~12-18, потолок 15-20 (дим returns 24-30).
- Israetel/Hoffmann/Smith *Scientific Principles of Hypertrophy Training* (RP, 2021) — канонизация MEV 6-8 / MAV 12-18 / MRV 20-25 (наш `volume-landmarks.engine.ts` уже канонический: 16 мышц × 4 уровня + enhanced +15%).
- Schoenfeld 2019 (12/18/24/30 сетов квадры) — 12 робастный рост, 18 чуть больше, 24/30 — перегруз/overtraining. Подтверждает MAV-концепцию.
- Helms 2022/2014 — белок 1.6-2.2 г/кг, профицит 250-500 ккал, leanMass/HRV/сон/стресс → MRV ×0.9-1.15 (наш `computeBBRecoveryMultiplier` уже).
- Meeusen 2013 / Kreher 2012 / Halson 2014 — FO 1-2нед >MRV → делод 1нед = суперкомпенсация; NFOR недели-месяцы; resting HR +5-7 бпм 3дн = порог.

**Отстающие мышцы / специализация (6-12нед блок):**
- BarBend 2025, FitnessRec 2025/26, Schoenfeld lab CUNY, Florida Atlantic — специализация: **MAV-верх 18-25 сетов/нед × частота 3-6×/нед**, остальные на MV (4-6), длительность 8-12нед, приоритет — первым в сессии/неделе, сокращение доноров на 50-70%. Генетика: длина брюшка/инсерции, состав волокон (икры 90% slow → 15-30 повт), нейральная эффективность.
- Принцип «train lagging first, sид reduced elsewhere»; ожидаемый прирост 0.25-0.5" за 4-8нед, зрелый рост 9-12нед.

**Симметрия/пропорции:**
- Steve Reeves / Eugene Sandow *Grecian Ideal* — канонические пропорции: шея=бицепс=икры=18" при 5'9" 185lbs, грудь 48" талия 30" (ratio 1.6), бедро 27", golden ratio 1.618 (плечи/талия). Широкая база для `idealBodyMeasurements` калькулятора Bodybuilding.com (Nov 2024).
- Bodybuilding.com Ideal Measurements (Sandow) + DEXA gold-standard ±1-2% vs BIA ±3-5% (WeAreBOD 2025) — сегментный lean mass рук/ног/корпуса для асимметрии.
- Schoenfeld 2016 frequency 2× >1× при равном объёме; Wernbom dose-response — объём > частоты.

**Качество стимула:**
- Schoenfeld 2021 lengthened position (RDL/incline curl/sissy) → гипертрофия `stretch-mediated`; Schoenfeld 2022 partials в растянутой.
- Wackerhage volume vs intensity; Israetel/Meadows — квадры 5 углов, грудь верх/низ, спина width/thickness, дельты 3 пучка (наш ANGLE_CLASSES + STRICT_GROUPS уже).

**VBT для ББ (не сила):**
- Wood et al. 2026 PLOS ONE 7 derivatives — пик-скорости ББ >1.3 м/с недействителен generic threshold; TA snatch 1.30-1.75. Для ББ используем **потерю скорости 20-25% = гипертрофийная зона** (наш `bb-vbt.engine.ts` уже: <10 стабильна, 10-20 сила, 20-25 гипертрофия, 25-40 стресс, >40 отказ).

---

## 3. Концепция ББ-хаба PRO

### 3.1 Принцип отличия от ПЛ
- **Цель ПЛ/ТА:** кг на штанге, фазы движения (bottom/mid/lockout), ACWR по тоннажу.
- **Цель ББ:** **см объёма + визуальная пропорция + отсутствие травм**. Штанга — инструмент, не цель. Поэтому:
  - Нет «слабых точек лифта» (sticking point), есть **слабые мышцы/пучки** (верх груди, средняя дельта, задняя цепь и т.д.) — гранулярные зоны `WEAK_TO_MUSCLE` + `delt_front/mid/rear`, `chest_upper/lower`, `back_width/thickness`.
  - Нет «скорости штанги для 1ПМ», есть **потеря скорости как прокси близости к отказу/RIR** для гипертрофии (VBT-зоны 20-25%).
  - Нет «попытки на помосте», есть **объёмный аудит факта (дневник) vs MEV/MAV/MRV** + симметрия измерений.

### 3.2 Хедер (как в TA)
- RSS-гейдж 0-100 (цвет `scoreColor`), verification `v = 0.35×дневник + 0.35×замеры + 0.30×VBT/фото` (без фото — кап 0.65), чип ACWR (ratio 0.8/1.3/1.5), чип MRV-бюджета `weeklyWorkingSets/112`, чип специализации `focusGroup×1.3 / weak×1.2`, лимитер-подсказка top-2 для слабого пучка.
- Авто-подтяжка: `he_workout_log_v1` (факт объёма + e1RM), `he_profile_v2` (вес/пол/уровень/стаж/PED), `he_body_measurements` (окружности), `he_weight_log`/`he_wearable`.

### 3.3 Табы (6 шт., parity TA) — ревизия после аудита дублей

| ID | Лейбл | Икона | Тип | Суть (что диагностируем) | Источник истины |
|----|-------|-------|-----|--------------------------|-----------------|
| `weak` | Отстающие | 🎯 | **NEW unique** | Гранулярный выбор 1-2 цели (`delt_mid`, `chest_upper` и т.д.), e1RM-тренд из дневника (падение ≥5% / рост ≥10% за 28д), объём-факт vs MAV, circumf-измерения vs идеал Reeves | `bb-weak-detection.engine` (новый) + diary e1RM |
| `symmetry` | Симметрия | ⚖️ | **NEW unique** | L/R асимметрия + верх/низ + push/pull + chest/back + quad/ham, пропорции Reeves/Sandow/Adonis (плечи/талия 1.618, руки=шея=икры), FFMI, V-taper | `bb-symmetry.engine` (новый) + `bb-balance` |
| `stimulus` | Стимул | 💪 | **NEW unique** | Длина (lengthened/mid/shortened), паттерны (гориз/верт жим/тяга, hinge/squat/lunge), compound/iso ratio, угол-вариативность, tempo/TUT, stretching bonus, BFR-пригодность | `bb-stimulus.engine` (новый) + `bb-balance`, `ANGLE_CLASSES` |
| `volume` | Объём | 📊 | **EMBED** | Per-muscle факт vs MEV/MAV/MRV — **встраиваем `VolumeOptimizerTab` (`division='bb'`)** из `VolumeHub.tsx:88`, чип `buildBBQualityReport` + `→ Объём-хаб: детали`. Свой таблицы нет. | `volume-landmarks` + `VolumeHub` (reuse) |
| `recovery` | Восстановление | 🔋 | **CHIP+LINK** | Per-muscle ACWR (unique тонкая надстройка) + общий ACWR/monotony/Banister/recovery/PRI — **чипы из `he_unified_intel_snapshot_v1:75`** (`UnifiedIntelligenceHub`) + `→ Интеллект → Нагрузка/Восстановление`. Свой 0-100 инпутов нет. | `bb-progression-feedback` (per-muscle) + `UnifiedIntelligenceHub` |
| `mobility` | Техника/VBT | 🦿 | **REUSE+LINK** | OHS 6 + knee-to-wall + heel retest (reuse `strength-sport-ohs`), VBT `bb-vbt` (фасад над `pro/vbt`), Kinovea/BlazePose reuse из `WLDiagnosticsHub`, + links `→ Суставы и ортопедия`, `→ Анализ силы → VBT` | `bb-mobility` + `strength-sport-*` + `StrengthAnalysisHub` + `TrainingSafetyHub` |

**Почему 6, а не 9 как в PL:** ББ не имеет 9 соревновательных лифтов; 6 покрывают весь цикл гипертрофии и зеркалят методологию RP (объём→частота→пропорция→восстановление). **3 таба — уникальные ББ (слабые/симметрия/стимул), 3 — тонкие оболочки над канонами** (объём/восстановление/мобильность) — без дублей.

**Визуально:** в `📊 Объём` и `🔋 Восстановление` — summary-чипы + кнопка-линк (стеклянная карта с `→`), при клике — `window.dispatchEvent('nav-change', 'volume')` / `he_training_planning_track` роутинг (parity TA `planning-track-open`). Детальная таблица/график остаётся в каноне.

---

## 4. Движки (engines)

### 4.1 Переиспользуемые (0 правок, только чтение/композиция)

| Что | Канон (не трогать) | Как соединяет ББ-хаб |
|---|---|---|
| **MEV/MAV/MRV база** | `volume-landmarks.engine.ts:36` `VOLUME_LANDMARKS_DB` (16×4 уровня, канон) | `VolumeOptimizerTab` в `📊 Объём` — embed, не копия |
| **Агрегация факта + бюджет + recovery×** | `bb-volume.engine.ts:429` `aggregateBBVolume`, `computeBBWeeklyBudget`, `sessionLimitsFor`, `perExerciseCap` | чип-статус в `📊`, детальная таблица — в `VolumeHub` |
| **Баланс press/pull + lengthened + patterns** | `bb-balance.engine.ts:46` `analyzeBBBalance` | `💪 Стимул` читает `plan.weeks` → `analyzeBBBalance`, не копирует формулы |
| **Единый quality 0-100** | `bb-quality-report.engine.ts:100` `buildBBQualityReport` + `CalcQualityTab.tsx:33` | хедер-чип + `→ Качество: детали`, полный UI — `QualityHub` |
| **Per-muscle ACWR + e1RM plateau + adherence** | `bb-progression-feedback.engine.ts:236` (`computePerMuscleACWR`, `autoUpdateWeakPoints`, `applyDiaryVolumeCorrection`) | `🔋 Восстановление` тонкая надстройка per-muscle; общая ACWR/monotony — из `UnifiedIntelligenceHub` snapshot |
| **Общая ACWR/monotony/Banister + recovery/PRI/RPE→вес + прогноз** | `UnifiedIntelligenceHub.tsx:50` (`toDailyLoads`/`acuteChronicRatio`/`weeklyMonotony`/`fitnessFatigue` + `analyzeRecovery`/`calculatePRI`/`autoRegulate`) — `he_unified_intel_snapshot_v1:75` | `🔋` чипы read-only + links `→ Интеллект → *`, свои 0-100 инпуты не дублирует |
| **1RM 7 формул + VBT + DOTS/Wilks + процентили** | `StrengthAnalysisHub.tsx:22` + `relative-strength.engine` + `he_strength_hub_snapshot_v1:32` | `🦿` VBT-чип read-only + `→ Анализ силы → VBT/1RM` |
| **Суставы/JSI/FMS/техника упражнения** | `TrainingSafetyHub.tsx:21` + `LoadSafetyCard` + `QualityJointHub` | `🦿` summary-чип + `→ Суставы и ортопедия` |
| **Специализация conflict + ANGLE_CLASSES** | `bb-specialization.engine.ts:63` + `bb-exercise-selection.engine.ts:1342` | `🎯` валидация `isSpecializationTargetConflict` + `WEAK_EXERCISE_BONUS` |
| **VBT-фасад ББ (зоны 20-25% гипертрофия)** | `bb-vbt.engine.ts:29` `bbVbtRecommendation` (фасад над `pro/vbt`) | `🦿` тонкий вызов, либы не копирует |
| **OHS 6 + Kinovea/Enode + BlazePose** | `strength-sport-ohs.engine`, `strength-sport-video.engine`, `strength-sport-pose.engine` (WL канон) | `🦿` импорт как либы, не копия (parity `WLDiagnosticsHub.tsx:17`) |

### 4.2 Новые (чистые, без мутаций плана) — только ББ-уникальное

| Файл | Экспорт | Логика | Лит-ра | Почему новый (не дубль) |
|------|---------|--------|--------|--------------------------|
| `bb-weak-detection.engine.ts` | `detectBBWeakByVolume`, `detectBBWeakByE1rm`, `detectBBWeakByCircumf` → `BBWeakCandidate` | Объём: `fact < MEV` или `<0.7×MAV` while others ≥MAV. e1RM: окна 28д −5%→weak. Окружность: vs Reeves-идеал ±10%. Merge 3 источников, dedup по `canonicalMuscle`. | Israetel, Schoenfeld 2016, Reeves | **Нет в проекте** — weak-detection есть для PL (`stickingPoint`), не для ББ-пучков. |
| `bb-symmetry.engine.ts` | `scoreBBSymmetry(meas, balance, volume)` | L/R 7/12%, грудь/спина 1.0±0.3, квадр/хам 1.5±0.5, V-taper 1.618, FFMI. RSS (см.§5). | Reeves/Sandow, BarBend | **Нет** — DEXA-симметрии нет, `bb-balance` даёт только pull/press, не окружности/Adonis. |
| `bb-stimulus.engine.ts` | `analyzeBBStimulus(plan)` | Lengthened 0 при >4 сетов→pen, 1 паттерн ≥4→pen, compound<40% при ≥6→pen, 1 угол→pen, tempo vs `tempoFor`, BFR eligibility. | Schoenfeld lengthened, Israetel | **Нет** — `bb-balance` даёт флаги, но не агрегирует стимул-скор и BFR. |
| `bb-scoring.engine.ts` | `scoreBB({ weakCount, volumeIssues, symmetryIssues, stimulusIssues, acwrDanger, mobilityFails, vbtLoss })` | RSS 7 пенальти → `√Σpen²`, floors (асим≥12%→≤49, перегруз≥2→≤59, ACWR danger→≤59, VBT>40%→≤69), verification `0.35*diary+0.35*circumf+0.30*VBT` | Sundaram RSS, TA parity | **Нет** — TA scoring есть, ББ-спец нет. |
| `bb-diagnostics-hub.engine.ts` | `buildBBDiagnosticsReport(input)` | Оркестратор уникальных 3 + чипы канонов (volume/recovery/quality), дедуп, соритровка по `pen`. Сохраняет гранулярные зоны для `applyToPlanner`. | — | Оркестратор — thin, не копирует каноны. |
| `bb-diagnostics-export.engine.ts` | `buildBBDiagnosticsHtml/Csv` | HTML с таблицами слабых/симметрии/стимула + чипы канонов (ACWR/quality из snapshots, не пересчитано), XSS-esc | TA wl-export parity | Только экспорт; расчёты — из канонов. |

**Удалены из первичного плана как дубли:**
- `bb-mobility-diagnostics.engine.ts` — **не нужен отдельно**: `🦿` напрямую импортирует `assessOHS` из `strength-sport-ohs.engine` (канон WL) + `bb-vbt` фасад. Обёртка была бы дублем.
- `bb-diagnostics-injection.engine.ts` — **отложен**: специализация `weakPoints ×1.15` уже в `buildBBPlan`; per-day dedup + Budget cap уже проверены parity `strength-sport-ta-injection` и не требуют отдельного ББ-injection до 2-й итерации. Если понадобится — 40с, но не в MVP.

---

## 5. Скоринг (RSS) — как в TA/механизм-рисков

```
penWeak      = weakCount ≥2 ? 28 : weakCount==1 ? 14 : 0   // 2 слабые = критично (нужна специализация)
penVolume    = exceeding_mrv ≥2 ? 22 : approaching_mrv ≥2 ? 12 : below_mev ≥2 ? 10 : 0
penSymmetry  = L/R≥12% ? 24 : ≥7% ? 12 : chest/back дисбаланс ? 10 : 0
penStimulus  = no lengthened ≥2 мышц ? 16 : single pattern доминирует ? 10 : 0
penACWR      = dangerous ≥1 ? 18 : caution ≥2 ? 10 : 0
penMobility  = OHS failed ≥3 ? 14 : ≥2 ? 8 : 0
penVBT       = loss>40% ? 20 : >25% ? 10 : 0

raw = √(Σ pen²)            // евклидова норма — субаддитивна (как в risk-engine: 7+7+7→12, не 21)
score = clamp(100 - raw, 0, 100)
level: ≥75 ok (🟢), ≥50 warn (🟡), <50 critical (🔴)
floors: per §4.2 (асимметрия/перегруз/ACWR пробивают ceiling)
verification: min(1, 0.35*(hasDiary?1:0) + 0.35*(hasCircumf?1:0) + 0.30*(hasVBT||hasVideo?1:0))
```

**Почему RSS, а не сумма:** механизмы коррелированы (один перегруз тянет ACWR + volume + symmetry), сумма дважды штрафует одно явление — RSS даёт «вектор повреждения», как в `risk-engine-tz-spec.ts`.

---

## 6. UI — `BBDiagnosticsHub.tsx` (≈380с, не 520с — минус дубли, parity `WLDiagnosticsHub`)

**Хранилище:** `he_bb_diagnostics_hub_v1` (миграция v0). Читает также `he_unified_intel_snapshot_v1:75`, `he_strength_hub_snapshot_v1:32`, `he_profile_v2`, `he_bb_plan`/`he_workout_log_v1`.

**State (минимум, без дублей):**
```ts
type BBTab = 'weak'|'symmetry'|'stimulus'|'volume'|'recovery'|'mobility';
type BBDiagState = {
  weakManual: string[]; // гранулярные, max 2 (валидация conflict shoulders+delt_mid via isSpecializationTargetConflict)
  circ: Record<string,string>; // neck, chest, waist, hips, bicepL/R, thighL/R, calfL/R, shoulderWidth, heightCm, bwKg, bodyFat, sex, level
  // volume — NO own inputs: читает VolumeHub snapshot / aggregateBBVolume напрямую, показывает чип + embed
  // recovery — NO own 0-100 inputs: читает he_unified_intel_snapshot_v1 (readOnly) + per-muscle ACWR надстройка
  // VBT — NO own 1RM inputs: читает he_strength_hub_snapshot_v1 (bw/sex), только best/last для потери
  ohs: OHSState; kneeToWallCm:string; ankleDeg:string; heelRetest:''|'better'|'same';
  vbtBest:string; vbtLast:string; vbtWeight:string; // остальное — из Strength hub
  csvText:string; // Kinovea (reuse либы)
};
```

**Табы (3 unique + 3 composite):**

- **🎯 Слабые (Weak) [NEW]:** чипы гранулярных зон (delt_mid, chest_upper + канонические fallback) с `isSpecializationTargetConflict` валидацией, бейдж `weakExerciseBonus`, блок `📓 Дневник e1RM-тренд` (`e1RM -6% ▼` из `StickingPointAnalysisCard` pattern), блок `📏 Замеры vs идеал Reeves` (дельта %), limiter-подсказки топ-2 из `limiter-calculator`.
- **⚖️ Симметрия (Symmetry) [NEW]:** ввод окружностей + height/weight → авто-идеалы Reeves `ideal*(height/175)`, FFMI, V-taper/Aдonis, рацио-чипы (пуш/пулл, квадр/хам), L/R асимметрия-чипы, DEXA-placeholder. Кнопка `📋 Копировать замеры тренеру`.
- **💪 Стимул (Stimulus) [NEW]:** превью последнего `he_bb_plan` (read-only): lengthened/mid/shortened donut, pattern badges, compound/iso bar, angle-variety checklist, BFR badge. Источник — `analyzeBBBalance` + `bb-stimulus`, не своя таблица. Кнопка `→ Качество: детали` (линк к `QualityHub`).
- **📊 Объём (Volume) [EMBED]:** **не своя таблица** — `<VolumeOptimizerTab division='bb' />` embed (фильтр ББ) + хедер-чип `buildBBQualityReport score` + `weeklyBudget`. Своих MEV-инпутов нет — канон в `VolumeHub`. Кнопка `→ Объём-хаб: детали`.
- **🔋 Восстановление (Recovery) [CHIP+LINK]:** per-muscle ACWR чипы (unique, `computePerMuscleACWR`) + общие чипы **read-only** из `he_unified_intel_snapshot_v1` (ACWR/monotony/Banister/recovery/PRI) + `→ Интеллект → Нагрузка/Восстановление`. Своих readiness/sleep/HRV инпутов нет.
- **🦿 Техника/VBT (Mobility) [REUSE+LINK]:** 6 чекбоксов OHS + knee-to-wall + heel retest (reuse `assessOHS` из `strength-sport-ohs`), VBT best/last → `bbVbtRecommendation` (фасад над `pro/vbt`), Kinovea CSV `parseKinoveaCSV` reuse, BlazePose preview — те же либы что `WLDiagnosticsHub:17`. Плюс links `→ Суставы и ортопедия` / `→ Анализ силы → VBT`. Кнопка `→ профиль` пишет `he_profile_v2.health.mobilityRestrictions` → `filterByMobility` (parity WL).

**Хедер (как TA, но чипы из канонов):** RSS-гейдж `scoreBB` + verification `0.35*дневник+0.35*замеры+0.30*VBT` + чип `ACWR` (из Unified snapshot) + чип `MRV бюджет` + чип `специализация focus×1.3/weak×1.2` + limiter-чип.

**Футер:** `→ Применить в ББ-авто` (disabled если 0 слабых) + `🖨 HTML` / `📄 CSV` (экспорт уникальных 3 табов + чипы канонов, не полный пересчёт) + тосты. Навигация `→` — `dispatchEvent('planner-apply')` / `nav-change` без перезагрузки.

---

## 7. Интеграция с ББ-авто (planner-bridge)

**Канал:** `applyToPlanner({ kind:'weakpoints', label, data:{ groups, armTechnique? }, source:'intellectual' })` — **переиспользуем существующий `weakpoints` kind** (уже обрабатывается `BbAutoConstructor`).

- **Payload ББ-диагностики:**
  ```ts
  data: {
    groups: string[]; // канонические 1-2 (weakMusclesCanonical)
    weakZonesGranular: string[]; // гранулярные 1-2 (delt_mid, chest_upper) — для WEAK_EXERCISE_BONUS
    weakPoints: string[]; // alias groups (совместимость со старым BbAutoConstructor)
    // доп. мета (не ломают старый обработчик, читаются новым):
    bbDiagScore: number; bbDiagLevel: string; verification: number;
    volumeAdvice: string[]; symmetryRatios: Record<string,number>;
    recoveryACWR: Record<string,{ratio:number,zone:string}>;
    ohs: { totalScore:number, failed:number };
    vbt: { lossPct:number, zone:string } | null;
    symmetry: { score:number, issues:string[] };
  }
  ```
- **Приём в `BbAutoConstructor`:** без правок конструктора — `groups` уже маппится в `weakPoints` + `focusGroup` (первый → focus). Гранулярные зоны — `WEAK_EXERCISE_BONUS[zone]` уже применяется в `buildSession` (махи/наклоны получают +20 к скору). ACWR корректировка уже в `applyDiaryVolumeCorrection` (danger −25%). OHS → `mobilityRestrictions` уже фильтрует пул `isMobilityRestricted`. Дополнительный injection `bb-diagnostics-injection` — опциональный тонкий слой (parity TA) на 2-й итерации.

**Маршрутизация:** `window.dispatchEvent('planning-track-open', {detail:'bb'})` + `localStorage he_training_planning_track='bb'` — как у TA/Arm.

---

## 8. Хранение и diary

| Ключ | Что | Кто пишет/читает |
|------|-----|------------------|
| `he_bb_diagnostics_hub_v1` | state хаба (weakManual, circ, ohs, vbt) | хаб |
| `he_profile_v2` | вес/рост/пол/уровень/стаж/PED/goal/bf% | `getProfile()` — хаб читает, OHS пишет `mobilityRestrictions` |
| `he_workout_log_v1` / `he_training_log` | `WorkoutSession[]` — факт объёма + e1RM | хаб читает `aggregateBBVolume` + `e1RM trend` |
| `he_bb_plan` / `he_bb_last_plan` | последний BB-план — превью stimulus | хаб читает `analyzeBBBalance` |
| `he_body_measurements` (новый, опционально) | окружности + дата | хаб пишет при вводе, future DEXA |
| `he_planner_apply` | мост в ББ-авто | `applyToPlanner` |
| `he_bb_mobility` | OHS результат | хаб → профиль |

**Diary-интеграция (как в TA `candidateTAWeakPointsFromDiary`):** `detectBBWeakByE1rm` — окна 28д (old: 4нед назад, recent: 7д), `max e1RM` per muscle через `trueMuscleOf`, diff% → weak/plateau. `detectBBWeakByVolume` — `aggregateBBVolume(sessions последнюю неделю)` vs landmarks.

---

## 9. ББ-фичи и методики (чек-лист покрытия)

- [ ] **Специализация 1-2 мышцы** (Is: focus ×1.3 / weak ×1.2, top-2 канонические, гранулярные зоны, блоки 3-6нед, доноры) — уже в `bb-specialization`, хаб лишь выявляет.
- [ ] **MEV/MAV/MRV per-muscle** (16 мышц × 4 уровня + enhanced +15%, PED/recovery/lab множители) — уже в объём-движках, хаб визуализирует.
- [ ] **Частота 2× оптимальна** (Schoenfeld 2016) — частота из `muscleFrequency` в `BBPlan`, хаб показывает.
- [ ] **Lengthened bias** (Schoenfeld 2021, incline/rdl/sissy) — `lengthenedBonus` + `ANGLE_CLASSES`, хаб проверяет per-muscle.
- [ ] **Angle/pattern variety** (Meadows, Israetel) — 5 углов квадр, 3 дельты, width/thickness спины, STRICT_GROUPS — хаб проверяет.
- [ ] **Интенсив-техники** (drop/rest-pause/myo/21s/негативы по уровню + слабым) — уже в `bb-finalize`, хаб рекомендует по VBT-зоне.
- [ ] **GVT/FST-7/8×8** — `volumeScheme` в конструкторе, хаб бейджит.
- [ ] **BFR 20-30% 30-15-15-15 30с** — `bfrMode`, хаб eligibility.
- [ ] **PED-aware MRV ×2.0 (2.15 cap)** + `regimeMrvMultFor` — хаб учитывает.
- [ ] **Женский glute focus ×1.2** + `female_glute_5` — хаб учитывает `sex`.
- [ ] **Blast/Cruise, intensityLevel, rotationMode** — хаб показывает режим.
- [ ] **ACWR per-muscle + adherence + tonnage** — `bb-progression-feedback`, хаб визуализирует.
- [ ] **RIR drift по фазам** (`FOCUS_RIR_TABLE`) + `trainingFocus` — хаб показывает drift.
- [ ] **Мобильность joint-by-joint + isMobilityRestricted** — хаб диагностирует и пишет в профиль.
- [ ] **Пропорции Reeves/Adonis/FFMI/V-taper** — новый `bb-symmetry`.

---

## 10. План реализации (эпики A–F, parity TA: 76054adb 9 файлов 1465с) — ревизия без дублей

### Эпик A — движки-ядро (чистые, без UI, 2-3 дня) — только уникальное
- `bb-weak-detection.engine.ts` (60с) — volume + e1RM + circumf.
- `bb-symmetry.engine.ts` (80с) — рацио + идеалы Reeves + FFMI + V-taper.
- `bb-stimulus.engine.ts` (70с) — lengthened/pattern/compound/angle/BFR.
- `bb-scoring.engine.ts` (60с) — RSS 7 пенальти + floors + verification.
- **Критерий:** `vitest bb-diagnostics-core 24 теста` (слабые 3 ист., симметрия 5 рацио, stimulus 3, scoring RSS св-ва + floors).

### Эпик B — оркестратор (1 день)
- `bb-diagnostics-hub.engine.ts` (60с) — вызывает 3 уникальных + чипы канонов (`buildBBQualityReport`, `acuteChronicRatio` read-only), дедуп, гранулярные зоны для `applyToPlanner`.
- **Без** `bb-diagnostics-injection` в MVP (отложен — специализация уже в `buildBBPlan`).
- **Тесты:** `bb-diagnostics-hub 8`.

### Эпик C — хаб UI (3-4 дня, не 5-6 — минус дубли)
- `BBDiagnosticsHub.tsx` **380с** (не 520с): 3 unique таба (🎯/⚖️/💪) + 3 composite (📊 embed `VolumeOptimizerTab`, 🔋 chip `Unified` snapshot, 🦿 reuse `strength-sport-*`).
- Стили `CARD/DIM/ACCENT` из `training-ui` (parity WL).
- Персист `he_bb_diagnostics_hub_v1` (читает также `he_unified_intel_snapshot_v1`, `he_strength_hub_snapshot_v1`), `applyToPlanner weakpoints`, `applyMobilityToProfile` (`he_profile_v2` → `filterByMobility`), `handleExport` (уникальные 3 таба + чипы канонов).
- Deep-links: `→ Объём-хаб`, `→ Интеллект`, `→ Суставы`, `→ Анализ силы` (без дубля ввода).
- **Тесты:** `bb-diagnostics-hub.test.tsx` 8 (табы unique 3, embed Volume, chip Unified, конфликт shoulders+delt_mid, apply weak, OHS→профиль).

### Эпик D — экспорт (0.5 дня)
- `bb-diagnostics-export.engine.ts` (HTML/CSV, XSS-esc) — экспортирует уникальные 3 таба + чипы канонов (не пересчитывает ACWR/quality, берёт из snapshots).
- **Тесты:** 3.

### Эпик E — видео/VBT тонкая полировка (опционально, 1 день, reuse)
- Kinovea/BlazePose уже reuse из `strength-sport-*` в `🦿` — доп. `detectPoseFromVideo` live (CDN) только если нужен live в ББ (parity TA уже).
- **Тесты:** reuse, новых 0.

### Эпик F — интеграция и годовой мост (отложено, как в TA)
- `annual-training` гибрид `bb+TA` — не в MVP.

**Оценка ревизии:** A 2.5д + B 1д + C 3.5д + D 0.5д = **~7.5 рабочих дней** (было 12) — экономия 4.5д за счёт композиции. Порог PRO — A+C (хаб работает, каноны уже PRO).

---

## 11. Критерии PRO (как в TA §Критерии PRO) — с учётом композиции

- Все 16 мышц имеют MEV/MAV/MRV + PED/recovery/lab — **канон `VolumeHub`**, ББ-хаб лишь чипует, 0 missing в каноне (не дублирует).
- Гранулярные слабые зоны (delt_mid vs delt_rear) различаются чипами и попадают в `WEAK_EXERCISE_BONUS` (проверка 1 vs 2 зоны ×1.1/×1.2).
- Bar path не нужен — вместо него **симметрия L/R + Reeves/Adonis** с порогом 7%/12% (unique).
- VBT absolute >1.3 не применяется — **20-25% потеря = гипертрофия** (wood) via `bb-vbt` фасад, данные из `StrengthAnalysisHub` snapshot (не дубль ввода).
- OHS ≥12см + heel retest — reuse `strength-sport-ohs` (канон WL), `→ Суставы` link.
- **Без дублей:** ACWR/monotony/Banister/recovery/PRI/1RM — **чипы read-only** из `UnifiedIntelligenceHub`/`StrengthAnalysisHub` snapshots, свои формулы не дублируются (проверка: `he_unified_intel_snapshot_v1` read-only).
- RSS-скор 0-100 (7 пенальти) + floors + verification `0.35*дневник+0.35*замеры+0.30*VBT` (unique).
- `→ Применить` отправляет 1-2 канонич. + гранулярные в `BbAutoConstructor` via `planner-bridge weakpoints` и реально меняет план (×1.15 + bonus + ACWR per-muscle).
- Экспорт HTML/CSV (уникальные 3 таба + чипы канонов), tsc 0, vitest ББ-диагностики **30+ зелёные** (unique 24 + hub 8 + UI 8), полный bb 1400+ без регрессий.
- **Нет новых 0-100 инпутов** готовности/сна/HRV/веса — единый снапшот (проверка: отсутствие `PopupNumber` для readiness в `BBDiagnosticsHub`).

---

## 12. Риски и осознанные остатки

- **Фото-AI пропорции (Aesthetics AI / Physique AI)** — отложено: требует бэкенд/ML, в 1-й итерации — ручные окружности + DEXA импорт (BOD).
- **DEXA vs лента:** DEXA gold ±1-2%, лента ±3-5% — показываем оба, помечаем источник.
- **Cross-meso continuity** уже в `previousPlan` — хаб не дублирует.
- **Название хаба в нави:** `Интеллектуальные тренировки → ББ-диагностика PRO` рядом с `ТА-диагностика PRO` (parity).
