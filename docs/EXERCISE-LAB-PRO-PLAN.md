# Лаборатория упражнений — PRO-план (хаб калькуляторов интеллектуальных тренировок)

> **Статус:** ✅ выполнен полностью кодом (Sep 12 2026, 7 этапных коммитов `ecef2edd`→`10ccbfc12`, без пуша)
> **Проверено:** свои 55/55 (A10+B2+C9+D9+E13+export3+UI7+ctx2); соседи rest-hooks 68/68 + catalog/manual 30/30 + bb-sfr/instructions 18/18; `tsc --noEmit` 0 по проекту. Чужие предсуществующие: `bb-diagnostics-hub` 3 падения, ReportsScreen unhandled-timeout.
> **Отклонение (честно):** движки C/D/E — тонкие адаптеры поверх найденных разведкой `bb-exercise-diagnosis/audit/correction/simulator`, а не с нуля (дублей ноль — что и требовал план); E поймал тестом, что узкий `canReplace` убивает легитимные замены → канон запрета только `cannotReplace`/`forbidden` для substitute/mobilitySwap.
> **Где:** `src/ui/screens/TrainingScreen_parts/ExerciseLabMerged.tsx:1` (4 шага), `ExerciseLabShared.tsx:1` (shared),
> `ExerciseLabPrescription.tsx:1` (656с), `ExerciseLabTechnique.tsx:1` (329с), `ExerciseLabProSubstitute.tsx:1` (186с),
> `ExerciseLabCatalog.tsx:1` (373с), `src/data/exercise-biomechanics-db.ts:1` (908с), `src/engines/movement-engines.ts:1`
> **Цель:** превратить лабораторию из **изолированного калькулятора** в **диагностико-коррекционный центр**:
> `упражнение → диагноз на материале плана атлета → коррекция с Δ-превью → применение в ББ-авто`.
> **Принцип:** без дублей — reuse `EXERCISE_CATALOG` (~600), `EXERCISE_BIOMECHANICS_DB`, `BBDiagnosticsHub`-движков
> (`bb-sfr-db`, `bb-balance`, `bb-volume`, `bb-symmetry`), `movement-engines`, `pro/vbt`, `planner-bridge`.
> Связь с `docs/EXERCISE-LAB-DIAGNOSTICS-CORRECTION-PLAN.md` (Sep 03, на согласовании): настоящий план его
> **расширяет и конкретизирует** (добавлены свежие мета-анализы 2025–2026 + 4 новых аудит-пункта L5–L8),
> при согласии — тот документ считать черновиком, этот — каноном.

---

## 1. Аудит хаба (код прочитат, 7 пунктов)

### 1.1. `getResistanceProfile` — эвристика по ключевым словам, а не данные (P0)

`ExerciseLabShared.tsx:160` классифицирует `stretch_mediated / mid_range / peak_contraction` поиском
подстрок в названии (`'гантеля'` в `midKeywords` — матчит почти все гантельные упражнения;
`'сгибани'` в stretch-списке — матчит и разгибания тоже через `'разгибани'`? нет, но `'leg curl'`
рядом с `'сгибани'` ловит русские сгибания/разгибания вперемешку). Скор `9/10/5/6` — произвольные
константы без источника. Весь Шаг 3 (stretch-лидеры, сортировка таблицы по `rp.score`,
синергия `вариация` по `rp.curve`) стоит на этой эвристике → **ранжир ненадёжен**.
Фикс — эпик A: вынести профиль в данные (`resistanceProfile` в `SFR_EXERCISE_DB`/`bio`),
эвристику оставить только fallback с пометкой `estimated:true`.

### 1.2. Генератор Шага 1 считает вес «с потолка» (P0, честность)

`ExerciseLabPrescription.tsx:87` — `fakeRM = 80 + level*20`, вес в выдаче `weight` посчитан от него.
Пользователь видит конкретные кг, которые **ни на чём не основаны** (профиль `strengthBaselines`
читается только для одиночного `exId`, генератор его игнорирует). Нарушает правило «нет данных —
честное «нет данных», а не mock».
Фикс — эпик B: генератор берёт `strengthBaselines[ex.id] ?? workMax[мышца] ?? null`; без базы —
прочерк + подсказка «введи 1RM/рабочий вес в Профиле → Тренировки», веса нет, сеты/повторы/RIR есть.

### 1.3. `regionalCoverage` Шага 3 — мёртвая логика (P0)

`ExerciseLabProSubstitute.tsx:63` ищет ключевые слова подрегионов (`'верх'`, `'lats'`, …)
в `exercise.targetMuscle` — а там короткая строка группы (`«Грудь»`, `«Спина»`), которая этих слов
не содержит → почти все подрегионы всегда `uncovered`, счёт `covered/total` врёт.
Фикс — эпик A: матчить против `bio.primaryMuscles/secondaryMuscles + name + targetMuscle`
(как `muscleToRegion`), покрыть тестом на группу chest (ожидаем covered ≥ 3/6).

### 1.4. Нет связи с планом атлета (P1, главный продуктовый гэп)

Хаб не читает `he_bb_plan_saved`, `he_workout_log_v1`, `he_bb_diagnostics_hub_v1`,
`he_profile_v2` (оборудование/мобильность/травмы). Следствия: замены предлагаются без фильтра
оборудования и `isMobilityRestricted`; `assessSafety(ex.id, [], …)` в Шаге 3 вызывается
**с пустым списком травм всегда** (`ExerciseLabProSubstitute.tsx:29`); weakZones/asym из ББ-хаба
не учитываются. Фикс — эпики C/D/E: контекст атлета + диагноз + коррекция + мост.

### 1.5. `calcTechniqueScore` — произвольные веса без валидации (P1)

`ExerciseLabShared.tsx:213`: `jointScore/2`, `complexity 25/15/8`, `cnsDemand*5`, `difficulty*3/*2` —
ни один порог не привязан к литературе, шкала `low<30<medium<60<high` нигде не проверена.
Не чинить математику (нет данных для калибровки), а **честно подписать**: `estimated`, тултип
«ориентир сложности, не норматив»; гейты безопасности строить только на `JOINT_STRESS_DB` +
профиль травм (эпик D).

### 1.6. Каталог без диагностических бейджей (P1)

`ExerciseLabCatalog.tsx:132` — карточка показывает только тип/инвентарь/bio. Нет бейджей
`SFR`, `lengthened/mid/peak`, `unilateral`, «диагноз по вашему плану». При 600 упражнениях
поиск без ранжира по качеству — листание вслепую. Фикс — эпик E (лень + кэш, бейджи только
при наличии плана/контекста, без плана — статичные SFR/lengthened-бейджи из данных).

### 1.7. Мусор и дубли вокруг хаба (P2)

- `ExerciseLab.tsx` (3 КБ), `ExerciseLabPro.tsx` (9.9 КБ), `ExerciseLabSubstitute.tsx` (7.8 КБ) —
  проверить импортёров; если мёртвые — удалить, если живые (пикер/тулзы) — пометить `@deprecated`
  и перевести вызовы на `ExerciseLabMerged`.
- `TechniqueTab` импортирует `applyToPlanner`, `CompareTab` — условный рендер без пустого стейта
  с CTA; персист `he_elab_fav` есть, а `selectedId`/истории диагнозов — нет (`he_exercise_lab_v1`).
- Имя `lab-*` в `src/engines/` занято медицинскими лабами (`lab-trend`, `lab-diary`) —
  новые движки называть строго `lab-exercise-*` во избежание коллизий.

**Вывод:** хаб хорошо считает изолированное упражнение (блины/VBT/1RM-консенсус/темп — reuse,
не трогаем), но отвечает не на тот вопрос. Нужный вопрос: **«что не так с упражнениями
в моём плане и чем исправить с прогнозом эффекта»**.

---

## 2. Интернет-синтез (Sep 2026, свежее)

| # | Тема | Источник | Норма для хаба |
|---|------|----------|----------------|
| S1 | Длина мышцы > ROM | Strey et al. 2026, Sport Sci Health — мета-анализ LL vs SL partials: **ES 0.283 (CI 0.04–0.52, p=0.036)** в пользу длинной длины, эффект стабилен по мышцам | `lengthened`-профиль — главный признак качества для гипертрофии; коррекция `short/peak → lengthened` (эпик C) |
| S2 | Full ROM vs partials | Wolf et al. 2023 IJSC (`ijsc.v3i1.182`): full ROM тривиально лучше partials в целом (SMD 0.12), но **подгруппа long-length partials лучше full (−0.28)**; Spicer 2025 PM&R: LL-partials ≈ full ROM | Формулировка в UI: «длинные частичные ≈ полная амплитуда, короткие — хуже»; не заявлять «partials лучше full» без оговорки |
| S3 | Lengthened partials у тренированных | Larsen 2025 PeerJ/EJSS: lengthened partials ≈ full ROM у тренированных, > short; Wolf 2025 trial — то же | Гейт: новичкам — только full ROM (техника), lengthened-частичные — intermediate+ |
| S4 | Stretch-mediated (пассивный) | Siegel/Sproll 2026 Sci Rep (первые данные по квадрицепсу); Warneke 2024 Sports Med Open meta: эффект малый, нужно **≥15 мин/сессия, ≥3×/нед** | В силовой хаб не тянем; только нота «пассивный стретч — ниша реабилитации/иммобилизации, не замена упражнению» |
| S5 | SFR | Israetel/RP; Mirafit 2025, Hevy Coach, Outlift, RP Guide 2026: high-SFR = тренажёры/блоки/гантели; compounds — якорь объёма, изоляции — углы; ротация **между** мезоциклами | SFR — приоритет выбора, **не множитель объёма** (инвариант `effectiveSets` цел); `deadlift_conventional` (SFR2/spine high) → `romanian/hip_thrust` (SFR4/low) |
| S6 | Региональная гипертрофия предсказуема | Stronger By Science 2023 (EMG+отёк): incline → верх груди, flat → середина; PMC 2020 (5 наклонов): **PMUP макс на 30°**, >45° уходит в дельту; Maeo seated leg curl > Nordic (17% vs 13%); Nunes: preacher vs incline — distal-различия | Подрегионы `SUBREGION_DEFS` — легитимны; угол груди чинить инклайном 30°, а не «ещё жимом» |
| S7 | Безопасность плеча | Kolber: до **36%** RT-травм — плечо; NSCA SCJ: upright row — импиджмент-пик **70–120°** элевации → кап 90°; behind-neck press — только при мобильности; PMC 2025 (обзор RT-травм): плечо/поясница/колено/кисть | `jointRisk`-флаг + кап upright row + behind-neck гейт по мобильности; процедуры/диагнозы не ставим |
| S8 | Механизмы/темп/частота | Schoenfeld 2010 (мех. напряжение — первичное); Schoenfeld 2015 meta: темп **0.5–8с** — гипертрофия одинакова, >10с хуже; Grgic/Schoenfeld: при равном объёме частота не решает | Темп-коррекция — только под профиль (stretch → пауза внизу), не «медленнее = лучше»; частоту чинить объёмом, не перетасовкой |

---

## 3. Концепция «диагностика → коррекция»

```
he_bb_plan_saved + he_workout_log_v1 + he_profile_v2 (оборудование/мобильность/травмы)
 + he_bb_diagnostics_hub_v1 (weakZones/asym) + he_unified_intel_snapshot_v1
        │                                    │
        ▼                                    ▼
 diagnoseLabExercise(ex, ctx)        auditLabPlanExercises(plan)
  7 флагов + score 0–100              avgSFR/lengthenedRatio/углы/
                                      strict/подрегионы/unilateral/
                                      fatigueDensity
        │                                    │
        └──────────────┬─────────────────────┘
                       ▼
         prescribeLabCorrections → CorrectionAction[]
          substitute / add / modifyTempo / modifyLoad /
          mobilitySwap / unilateral + confidence + reason + Δ
                       │
                       ▼
         simulateLabCorrection → sfrΔ/fatigueΔ/lengthenedΔ/
                                 balanceΔ/issuesResolved (без мутации)
                       │
                       ▼
         applyToPlanner({kind:'weakpoints', preferredExerciseIds,
                         exerciseSwap, labDiagnosis})
          → BbAutoConstructor (preferred первым, mobility-фильтр)
```

**Одна фраза:** лаборатория отвечает *почему упражнение плохое для вашего плана*
и *чем его исправить с прогнозом эффекта*.

---

## 4. Архитектура — reuse vs new

| Нужно | Канон | Использование |
|---|---|---|
| Каталог + canReplace/substitutionGroup | `src/core/exercise-catalog.ts` | чтение |
| Биомеханика + bio-записи | `src/data/exercise-biomechanics-db.ts` + `exercise-id-mapping.ts` | чтение |
| SFR 1–5 / fatigueCost | `src/engines/bb/bb-sfr-db.ts` | чтение |
| Углы + строгие группы | `bb-exercise-selection.engine.ts` `ANGLE_CLASSES` / `STRICT_EXERCISE_GROUPS` | чтение |
| Подрегионы | `ExerciseLabShared.tsx:35` `SUBREGION_DEFS` | чтение (матчинг чинить — эпик A) |
| Баланс/стимул/объём плана | `bb-balance` / `bb-sfr-db` / `bb-volume` | чтение `he_bb_plan_saved` |
| WeakZones + asym | `bb-diagnostics-hub.engine.ts` / `bb-symmetry` | чтение `he_bb_diagnostics_hub_v1` |
| Мобильность/травмы | `isMobilityRestricted` + `he_profile_v2` | фильтр коррекций |
| Safety/jointStress | `movement-engines.ts` `assessSafety`/`JOINT_STRESS_DB` | чтение (травмы прокидывать реально — эпик D) |
| VBT/1RM/темп | `pro/vbt` / `pro/estimate1rm` / `bb-tempo-rest` / `rep-tempo-engine` | чтение, не дублировать |

**Новые движки** (`src/engines/lab-exercise-*`, только диагноз/коррекция, план не мутируют):

| Файл | Экспорт | Логика |
|---|---|---|
| `lab-exercise-diagnosis.engine.ts` (~100с) | `diagnoseLabExercise(ex, ctx)` | `ctx{goal, level, weakZones, mobilityFails, asymPct, equipment}` → `LabDiagnosis{flags[], score 0–100, issues[], explain}`. Флаги: `lowSFRHighFatigue` (SFR≤3 + fatigue≥7), `wrongProfileForGoal` (гипертрофия + `peak/mid` вместо `stretch_mediated`), `jointRisk` (jointStress high + mobility fail/травма), `uncoveredSubregion`, `missingStrictGroup`, `singleAngle` (1 класс `ANGLE_CLASSES` при ≥6 сетов), `unilateralGap` (asym≥7% + не-unilateral) |
| `lab-plan-exercise-audit.engine.ts` (~90с) | `auditLabPlanExercises(plan)` | `avgSfr / lengthenedRatio / angleCoverage / strictCoverage / regionalCoverage / unilateralRatio / fatigueDensity` + `labFlags` per exercise через диагноз |
| `lab-exercise-correction.engine.ts` (~110с) | `prescribeLabCorrections(d, ex, ctx)` | `CorrectionAction{type, targetId?, execCues?, tempo?, reason, confidence, deltaPreview}`: `substitute` (SFR↑ + lengthened + `canReplace` + оборудование + `!isMobilityRestricted` + strict-группа цела), `add` (stretch-лидер на `uncovered`), `modifyTempo` (пауза в растянутой для stretch), `modifyLoad` (RIR+/вес− при `jointRisk`), `mobilitySwap` (low jointStress), `unilateral` (при asym). Ранг по `confidence` |
| `lab-exercise-simulator.engine.ts` (~60с) | `simulateLabCorrection(plan, action)` | Чистый Δ: `sfrΔ/fatigueΔ/lengthenedΔ/balanceΔ/unilateralΔ/issuesResolved` до/после |
| `lab-exercise-profile.engine.ts` (~60с) | `getLabResistanceProfile(ex)` | Данные вместо эвристики: `resistanceProfile` из `SFR_EXERCISE_DB`/`bio` → fallback `getResistanceProfile` с `estimated:true` (фиксит 1.1 + честная подпись) |

---

## 5. UI (`ExerciseLabMerged.tsx`, 4 шага сохраняем, +лента)

- **Лента диагностики** (sticky над шагами): при `he_bb_plan_saved` → `auditLabPlanExercises` summary
  `SFR 3.8 ⚠ · lengthened 40% ⚠ · углы груди 2/4 · подрегионы 3/6 · усталость ⚠` + чип weakZones +
  линк `→ ББ-диагностика`. Клик — детали. Без плана — честная плашка «подключи ББ-план — будет диагноз».
- **Шаг 1**: карточка `🔍 Диагноз упражнения` под выбором (`✅/⚠/🚫` по флагам) + `💊 Коррекция` топ-1
  с кнопкой `▶ Применить в план` + сворачиваемый список остальных + Δ-превью. Графики (TUT/1RM/VBT/тоннаж) целы.
- **Шаг 2**: блок `🩺 Коррекция техники под диагноз` (`jointRisk` → cues + `technique.regression`,
  не усложнение); upright-row кап 90° + behind-neck гейт — нота безопасности (S7).
- **Шаг 3**: колонка `Диагноз` в таблице (цвет `getRiskColor`) + ранжир замен по Δ, не только `canReplace`;
  stretch-лидеры — из данных (эпик A), счёт `covered/total` — честный (фикс 1.3).
- **Шаг 4**: Δ-колонка в сравнении (`sfrΔ/fatigue/lengthened` для A vs B) — маленькая, reuse симулятора.
- **Каталог**: чипы `SFR n` + `lengthened/mid/peak` (статика из данных) + чип `Диагноз` (лень + кэш,
  только при плане). Генератор Шага 1 — честные веса (эпик B).
- **Мост:** `applyLabCorrection` → `kind:'weakpoints'` + `labDiagnosis` в `rationale`; персист
  `he_exercise_lab_v1` (selectedId/история диагнозов кап 10) + экспорт HTML/CSV/XSS (как QS/BB-хабы).

---

## 6. План реализации (эпики)

### Эпик A — профиль из данных + честный regionalCoverage (1 дн)
- `lab-exercise-profile.engine.ts`: `getLabResistanceProfile` (данные → fallback `estimated:true`);
  подпись `estimated` в Шаге 3; матчинг подрегионов по `bio.primary/secondary + name + targetMuscle`.
- Тесты 6: lengthened из данных, fallback estimated, chest covered ≥3/6, uncovered честно, скор-порядок, кэш.

### Эпик B — честные веса генератора (0.5 дн)
- Шаг 1: `strengthBaselines[ex.id] ?? workMax[мышца] ?? null`; без базы — прочерк + CTA в Профиль.
- Тесты 3: baseline приоритет, workMax fallback, null без базы (мока нет — мутация ловит `fakeRM`).

### Эпик C — диагноз-движок (1.5 дн)
- `lab-exercise-diagnosis.engine.ts`: 7 флагов + score. Тесты 8 (по флагу + score-монотонность).

### Эпик D — аудит портфеля + травмы в safety (1 дн)
- `lab-plan-exercise-audit.engine.ts` (6 тестов) + прокидка травм профиля в `assessSafety` вызовы хаба
  (2 теста: травма плеча режет high-shoulderLoad, без травм — тишина).

### Эпик E — коррекция + симулятор (1.5 дн)
- `lab-exercise-correction.engine.ts` (8 тестов) + `lab-exercise-simulator.engine.ts` (4 теста).
  Инварианты: substitute внутри strict-группы; `canReplace` соблюдён; mobility/equipment-фильтр
  (мутация: вернуть `fakeRM`/снять фильтр — тесты падают).

### Эпик F — UI: лента + шаги + каталог + мост (2.5 дн)
- Лента + Шаг 1 (диагноз/коррекция/применить) + Шаг 2 (регрессия-блок) + Шаг 3 (колонка Δ) +
  Шаг 4 (Δ-колонка) + каталог-чипы + `he_exercise_lab_v1` + HTML/CSV-экспорт.
- Тесты UI 8: лента с/без плана, диагноз lowSFR, топ-1 + apply в bridge, каталог-чип, техника-блок, персист, экспорт XSS.

### Эпик G — гигиена: дубли + нейминг + скоринг (0.5 дн)
- Аудит `ExerciseLab.tsx / ExerciseLabPro.tsx / ExerciseLabSubstitute.tsx` → удалить мёртвое /
  `@deprecated` + перевод вызовов; `labScore 0–100` (средний диагноз портфеля, не RSS) + чип в хедере.
- Тесты 2.

**Оценка:** A 1 + B 0.5 + C 1.5 + D 1 + E 1.5 + F 2.5 + G 0.5 = **~8 дн**. MVP (A+B+C+F-шаг1+лента) = **~4 дн**.

---

## 7. Критерии PRO

- Каждое упражнение плана диагностируется: 0–3 флага с объяснением (не общая теория).
- Каждый флаг → топ-1 коррекция с `confidence + reason + Δ-превью` до применения.
- `▶ Применить в план` реально меняет следующую сборку (`preferredExerciseIds` в плане).
- Коррекции отфильтрованы по `equipment + mobilityRestrictions + травмы`; `canReplace` /
  `substitutionGroup` / strict-группы соблюдены; lengthened-частичные — только intermediate+.
- Каталог показывает SFR/профиль без открытия карточки; диагноз-чип — при плане.
- `tsc 0`, `vitest lab-exercise` **35+** зелёных (A 6 + B 3 + C 8 + D 8 + E 12 + F 8 + G 2),
  `bb` без регрессий, существующие `exercise-lab` тесты целы.
- 0 дублей: диагноз reuse SFR/ANGLE/SUBREGION/JOINT_STRESS/bb-balance/VBT; файлы движков —
  строго `lab-exercise-*`.

---

## 8. Осознанно НЕ делаем

- Видео-анализ техники (Kinovea/BlazePose как в WL-хабе) — в MVP только cues/errors/regression.
- Персональный план коррекции на 4–8 нед — в MVP одноразовая замена/дополнение.
- Фото-AI пропорций; диагнозы/процедуры (только скрининг + «к врачу» при боли).
- Своя математика SFR/скоринга вместо канона; множитель объёма из SFR (инвариант цел).
- Пассивный стретч-протокол как «упражнение» (S4 — ниша реабилитации, одна нота).

---

## 9. Риски

- Эвристика `getResistanceProfile` живёт в 4 местах (Shared + Prescription + ProSubstitute + bb-диагноз) —
  менять только через новый движок-адаптер, иначе рассинхрон.
- `SFR` — экспертная шкала Israetel/RP, не измерение: в UI подпись «ориентир», споров с kcal-точностью нет.
- Низкая техника + high difficulty → только регрессия, не усложнение.
- Хвост `he_bb_plan_saved` может быть чужой сборкой — диагноз помечать датой плана.
