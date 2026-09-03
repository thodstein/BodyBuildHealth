# Арм-диагностика — упражнения, слабые и мёртвые точки, коррекции (PRO-план)

> Статус: **IMPLEMENTED (база, коммит 17265b98) + ДОРАБОТКА (этот раунд)**. Изучен интернет (StrengthLog/TAWF/GoldenGrip/Mithril/ImproveYourGrip/Bezkorovainyi/Brismar-Holstein) + аудит кода `src/engines/arm/` и `ArmDiagnosticsHub.tsx:1003`. Цель — довести арм-хаб до parity с `WLDiagnosticsHub`/`BBDiagnosticsHub` по глубине диагностики (углы/биомеханика/мертвые точки/коррекции/инъекция в план). §8 — разбор реализации, найденные баги и решения открытых вопросов §6.

---

## 1. Аудит — что уже есть и чего нет

**Есть (fact-only, без score — осознанно):**

- `arm-weakpoint.engine.ts:26` `WEAK_MAP` 8 ключей (`cup/rising/pronation/supination/side/back/pinch/support` → `wrist_flexors/risers/pronators/...` + `exercises[]` по 2 шт). `diagnoseArmWeakPoint()` маппит `ArmWeakTest` (booleans) + `manualWeak` + `technique` (`hook→supination`, `toproll→pronation`).
- `arm-diagnostics-hub.engine.ts:38` `buildArmDiagnosticsReport()` — оркестратор: `diagnoseArmWeakPoint` + `estimateForceVector` + `diagnoseVbt` + `getArmLandmarks` + `tableRatio` + `tendonSets` + `asymmetry` + `checkHumerusGuard`/`checkWristBalance` → `findings[]` (ok/warn/critical) + `info` «без общего score». Механизм-ориентированная модель.
- `ArmDiagnosticsHub.tsx:29` 5 табов `grip/wrist/pressure/strength/recovery` + `ArmForce` (RT/Axle/Pinch, WAF refs `RT 130.5M/77.2F`, SideRef `bw*0.6`, BackRef `bw*0.8` via `arm-force-capture.engine.ts`), `arm-motion-capture` (РУ/РН `elbow/forearm/wrist/direction`, `validateArmAngles`, `recommendAnglesForTechnique`, `createHandsProcessor` Hands live), `arm-vbt-capture`, `arm-dynamic-force` (Bezkorovainyi 4 теста `finger/hammer/hook/cup` → `Fmax/ftIndex/F100/F500/t05F`), `arm-benchmarks`, `arm-force-history`, tendon ACWR (отфильтрованный `loadSRPESessions`).
- `arm-builder.engine.ts` уже учитывает `weakPoints` через `buildArmSchedule` + `specMrvFactor ×1.3` + `techniqueBoost`; `arm-volume-landmarks` (tendonCap 1.2), `arm-injury-guard` (humerus side ≤3 ранние нед, баланс pron/sup ≤1.5).
- `exercise-catalog-arm.ts:35` упражнений с `substitutionGroup/movementPattern`.

**Нет (gap vs PL/TA/BB хабов — именно «упражнения и мёртвые точки» из запроса):**

| PL/TA/BB есть | Арм нет |
|---|---|
| `weakpoint-pl.ts` 12 lifts × 30 WeakPoint → `DIAGNOSIS[lift][point] {muscles, corrections[], intensityPct, rationale}` (`strength-sport-biomechanics TA_BIOMECH 16 WLWeakPoint → angleRange/keyJoint/reason/loadCues/intensity`)`lms-builder injectPLWeakPoints` + `strength-sport-ta-injection injectTAWeakPoints` 3×5 @intensityPct в `dayMap` с dedup/budget | `WEAK_MAP` — 8 грубых, без разбивки по фазам стола, без углов (`angleRangeDeg`), без `biomechanicalReason`, без `intensityPct`, без списка коррекций из каталога (2 хардкода). Нет `ARM_BIOMECH` мапы. |
| `lift-diagnostics STICKING_POINTS[bench/squat/dead] → angleRangeDeg + weakMuscles`, `BAR_PATH_ISSUES forward_drift/hips_shoot`, `phaseForReps`, `scoreTA RSS √Σpen² + floors + verification` | Нет мёртвых точек армстола (dead zones) как аналога sticking point: где кисть раскрывается, где пронация срывается, где бок умирает. Нет `scoreArm` RSS, нет floors (asym≥12/side>9/tendon>22). |
| Hub 6 табов с конкретикой: снач 5 фаз × чеки + биомех-карточки + бар-метрики (SRD 4/6см, Vorobyev типы, Enode) + VBT FvR2 + OHS 6 + Kinovea CSV + pose | Арм хаб — чекбоксы «проваливается» без привязки к углу/фазе; коррекции не показываются пофазно; нет «мертвой точки» карточки; нет выбора упражнений коррекции из пула; нет инъекции слайсом в план (только спека ×1.3). |

Вывод: диагностику нужно поднять с «опросника провалов» до «12-15 мёртвых точек по углам с коррекциями и инъекцией», как `WLDiagnosticsHub.tsx:650` сделал для ТА.

---

## 2. Интернет-синтез — что считаем «мертвой точкой» в армрестлинге

Источники (проверены Aug-Sep 2026): StrengthLog Abelsson [strengthlog.com](https://www.strengthlog.com/arm-wrestling-strength-training/), GoldenGrip 15 Best [goldengrip.com](https://www.goldengrip.com/blogs/knowledge-hub/the-best-exercises-for-armwrestling), Mithril Cup/Pron/Rising [mithrilarmwrestling.com](https://mithrilarmwrestling.com/blogs/training-guides/how-to-train-cupping-pronation-and-rising), ImproveYourGrip pron/sup hub [improveyourgrip.net](https://improveyourgrip.net/pronation-vs-supination-arm-wrestling), TAWF Techniques [tawf.ca](https://www.tawf.ca/league/learn/arm-wrestling-techniques), Grokipedia Arm wrestling (EMG pectoralis/pronator, torque=force×lever), PMC/SciDirect humerus spiral fracture (Holstein-Lewis, Brismar 1975 — торсия + изгиб при internal rotation плеча, radial nerve 22%) [pmc.ncbi.nlm.nih.gov](https://pmc.ncbi.nlm.nih.gov/articles/PMC10315927/) [sciencedirect.com](https://www.sciencedirect.com/science/article/pii/S2666639122000670).

**Силовая цепь армстолa (GoldenGrip §2):** `Fingers → Wrist (cup&rise) → Rotation (pron/sup) → Elbow flexors (brachialis/biceps/brachioradialis) → Shoulder/back (side/back pressure) → Core/legs (якорь)`. Слабое звено рвёт цепь.

**Техники = 3 «лифта» (аналог bench/squat/dead):**

- **Hook (inside):** запястье согнуто к себе (`cup` 0–20°), супинация 90° + `brachialis/back_pressure`, широчайшие/pectoralis тянут к себе. Новички к нему тянутся, но грузит UCL сильнее — StrengthLog советует первые недели toproll.
- **Toproll (outside/high hand):** кисть выше, давят на пальцы соперника, `pronation + rising + brachioradialis`, атака на пальцы + back pressure.
- **Press (shoulder press/flop):** плечо за руку, `side_pressure + triceps/chest`, толчок вперёд — финиш, риск humerus при раннем side без контроля кисти.

**Где «мертвец» (фаза → угол → сустав → что отказывает):**

| Канал | Фаза стола | Угол-классика | Ключевой сустав | Что ломается | Риск |
|---|---|---|---|---|---|
| **Cup** | Старт/удержание центра | запястье -10..+40°, локоть 90–110° | лучезапястный | `wrist_flexors` не держат сгибание, кисть открывается назад → теряется leverage | UCL, flexor strain |
| **Rising** | Высота костяшек | radial deviation + разгибание пальцев | кисть/пальцы | `risers/thumb` — высота падает, соперник накрывает | finger extensors |
| **Pronation** | Toproll lock | pronation 120–160° (к мизинцу) | предплечье (pronator teres/quadratus) | `pronators/brachioradialis` — кисть супинируется назад | medial epicondyle |
| **Supination** | Hook lock | supination 80–100° | предплечье/biceps | `supinators/brachialis` — хук разворачивает | biceps distal |
| **Side** | Середина → дожимание | плечо adduction 30–45°, локоть 90° | плечо/humerus | `side_pressure/shoulder_stab/pec` — бок глохнет, корпус отваливается | **spiral humerus 90% травм**, radial nerve |
| **Back** | Тяга на себя | локоть флексия 90–120° + лат-аддукция | локоть/спина | `back_pressure/brachialis/biceps` — не затягивает | biceps tendon |
| **Contain** | Старт (пальцы/большой) | пальцы согнуты, thumb аддукция | пальцы/thumb | `grip_pinch/thumb` — пальцы разгибаются | thumb UCL |

Это прямой аналог `STICKING_POINTS: bench bottom/mid/lockout` — только для армстола. Литература даёт норму углов: `elbow 90/110/120` + `wrist -10..40` + `pron/sup` — уже в `arm-motion-capture.engine.ts:validateArmAngles`, но без привязки к dead-зоне.

**Инсайт Кузнецова (принципы I–VIII):** `РУ (рабочие углы)` — статика в РУ, динамика в РА, `РН` (направление к мизинцу/среднему/большому) — отдельно. Это и есть «мертвая точка» в русском смысле: РУ где держим, РН куда тянем.

---

## 3. Предложение — домейн-модель «12 мёртвых точек»

### 3.1 Новый тип `ArmWeakPoint` (12, как `WLWeakPoint` 15)

```ts
export type ArmWeakPoint =
  | 'cup_start'       // 0–15° запястья на старте — кисть открывается
  | 'cup_hold'        // удержание cup под тягой (mid)
  | 'rising_top'      // высота костяшек падает
  | 'pron_open'       // пронация не открывается (вход в toproll)
  | 'pron_lock'       // пронация не держит под нагрузкой (lock)
  | 'sup_cup'         // супинация+cup хук-старт
  | 'sup_drag'        // супинация+drag середина
  | 'side_mid'        // бок середина стола (плечо 30°)
  | 'side_pin'        // дожимание к подушке (humerus риск)
  | 'back_start'      // старт back pressure
  | 'back_drag'       // тяга середина
  | 'contain_fingers' // пальцы/пинч (thumb containment)
```

Каждая точка принадлежит 1–2 техникам (как `WL_WEAKPOINT_BY_LIFT`):

```
HOOK: cup_start, sup_cup, sup_drag, back_drag, contain_fingers
TOPROLL: cup_hold, rising_top, pron_open, pron_lock, back_start
PRESS: side_mid, side_pin, rising_top (опционально)
ALL: cup_*, contain
```

Это сохраняет 8 старых `WEAK_MAP` ключей как алиасы (`cup→cup_start+cup_hold`, `rising→rising_top` и т.д.) — миграция без лома.

### 3.2 `arm-biomechanics.engine.ts` — канон (аналог `strength-sport-biomechanics.engine.ts:16`)

```ts
export const ARM_BIOMECH: Record<ArmWeakPoint, ArmBiomechInfo> = {
  cup_start: {
    technique: 'hook/toproll',
    angleRangeDeg: [0, 20], keyJoint: 'лучезапястный (flexion)',
    weakMuscles: ['wrist_flexors','risers'],
    biomechanicalReason: 'Потеря флексии кисти → leverage -30% (GoldenGrip chain); запястье уходит в extension',
    loadCues: ['кисть к себе до 10°', 'ремень на фалангу (Кузнецов)', 'не тянуть локтем'],
    intensityPct: 0.65, references: ['StrengthLog 2025', 'Mithril cupping']
  },
  pron_lock: {
    technique: 'toproll',
    angleRangeDeg: [130, 160], keyJoint: 'пронация (pronator teres)',
    weakMuscles: ['pronators','brachioradialis'],
    biomechanicalReason: 'Супинация соперника перекручивает; EMG pronator teres падает',
    loadCues: ['кабель 5×5 heavy pronation', 'ремень+блок к мизинцу (РН)'],
    intensityPct: 0.70,
  },
  side_pin: {
    technique: 'press',
    angleRangeDeg: [30, 45], keyJoint: 'плечо (adduction/internal rotation)',
    weakMuscles: ['side_pressure','shoulder_stab','pectoralis'],
    biomechanicalReason: 'Торсия + изгиб humerus (Brismar 1975, Holstein-Lewis); ранний side без кисти → spiral fracture',
    loadCues: ['side только с контролем кисти', 'прогрессия ≤10%/нед', 'RIR≥2'],
    intensityPct: 0.60,
  },
  // ... остальные 9 по той же схеме
}
export function diagnoseArmWeakPointDetailed(lift: ArmTechnique, point: ArmWeakPoint): ArmDiagnosis
export function isValidAngleForWeakPoint(point: ArmWeakPoint, angleDeg: number): boolean
```

Источники в `references` — внутри кода, как в `TA_BIOMECH` (Gourgoulis/Garhammer).

### 3.3 `arm-weakpoint-corrections.ts` — мост «точка → упражнения» (аналог `WEAK_POINTS_BY_LIFT` + `DIAGNOSIS.assistanceFromCatalog`)

Каждая точка → 3–5 упражнений из `exercise-catalog-arm.ts` (проверка `id` существует — тест `planner-id-safety`):

- `cup_start/hold`: `wrist_curl_belt` (Кузнецов пояс), `wrist_curl_barbell`, `cup_static_hold_10s`, `riser_lift_judo_belt`, `wrist_roller`
- `rising_top`: `riser_lift_judo_belt`, `plate_pinch_hold`, `hub_pinch`, `finger_containment_band`, `wrist_roller`
- `pron_open/lock`: `cable_pronation_90` (5×5), `sledge_hammer_pronation`, `pronation_pulses` (tendon micro), `pronator_strap_table`, `brachioradialis_hammer`
- `sup_cup/drag`: `cable_supination_drag`, `supination_hammer_curl`, `thick_hammer_curl`, `standing_cable_hook`
- `side_mid/pin`: `cable_side_pressure` (gated ≤3 сета ранние нед), `isometric_table_pushdown_10s`, `internal_rotation_band` (12–20), `one_arm_landmine_row_underhand`
- `back_start/drag`: `lat_drag_belt_wrist`, `seated_row_strap_to_hip`, `one_arm_landmine_row_underhand`, `hammer_belt_curl` (фиксация кисти)
- `contain_fingers`: `coc_gripper_close`, `pinch_block_hold`, `saxon_bar_deadlift`, `fat_gripz_curl`

Каждая запись: `intensityPct 0.60–0.75`, `rationale` (1 строка), `substitutionGroup` для `arm-finalize` (не смешивать pron↔sup, support≠pinch).

### 3.4 Логика выбора — расширяем `arm-weakpoint.engine.ts`

- Оставить `diagnoseArmWeakPoint({weakTest, manualWeak, technique})` для backwards compat (старые 8 чекбоксов маппятся на 12 точек: `cup→cup_start+cup_hold`).
- Новый `diagnoseArmWeakDetailed({technique, weakPoints: ArmWeakPoint[], angles, grip, dynamicReport}) → ArmWeakDiagnosisDetailed { weakMuscles, weakPatterns, weakPoints, priorities, biomechCards[] }` — собирает `ARM_BIOMECH` карточки + `angleRange` проверку (если локоть 90° а точка `side_pin` требует 30° adduction — подсвечивает).
- `phaseForArmAngle(angle, technique)` — аналог `phaseForReps` в PL: по `elbowDeg/forearmDeg/wristDeg/direction` относит к мертвой зоне (как `StickingPointAnalysisCard` делает reps→фаза).

### 3.5 Мертвые точки в плане — инъекция

Новый `arm-diagnostics-injection.engine.ts` (параллель `strength-sport-ta-injection` / `bb-diagnostics-injection`):

```ts
export function injectArmCorrections(plan: ArmPlan, weakPoints: ArmWeakPoint[], opts: {
  dayMap?: Record<ArmWeakPoint,string>, // куда класть: pron_lock→TablePronation, side_pin→SidePress, sup→Hammer и т.д.
  budget?: number,  // weekly cap из getArmLandmarks(level, muscle).mrv
  workMax?: Record<string,number>,
  technique?: ArmTechnique,
}): { plan: ArmPlan, injected: number, skippedByBudget: number, notes: string[] }
```

- 1 точка → 1 коррекция 3×8–12 @ `ARM_BIOMECH.intensityPct` (60–70%) в свой день (`Hammer` для brachialis, `TableTech` для pron/sup, `SidePress` для side, `GripHeavy` для contain) — как у ТА `3×5 @intensityPct`.
- Per-day dedup (`Set<id@day>`), `dayCap ≤8` (как `injectPLWeakPoints`), MRV-бюджет по `getArmLandmarks` (новичок tendonCap 1.2).
- Вызов в `ArmAutoConstructor.tsx:buildArmPlan` после `finalizeArmPlan` (как `StrengthSportConstructor:234 injectTAWeakPoints`) и в `arm-builder` как опция `injectedCorrections`.

Через `planner-bridge` (`kind:'weakpoints'`) уже уходит `groups: weakMuscles.slice(0,2)` → `ArmAutoConstructor` ловит `weakPoints` → ×1.3 spec. Расширить payload: `armWeakPoints: ArmWeakPoint[]`, `armDiagDetailed`, `armBiomechCards`, `armDayMap` — handler `weakpointsHandler` уже умеет `diagnosticExerciseMap/DayMap`.

### 3.6 Скоринг — опциональный RSS (выключить по умолчанию, как у арм-хаба «без рисков»)

Текущий арм-хаб сознательно без общего score (`arm-diagnostics-hub.engine.ts:1` «без общего score/verification»). Для parity добавить `arm-scoring.engine.ts` **не как обязательный гейт**, а как «PRO-оверлей» (как у B `scoreBB`):

- Пенальти: `weak12, asym14/28 (cap 12.47% элита), sideHumerus18, tendon10/20 (>18/22), grip20, ohs-подобный riser8`.
- Floors: `asym≥12% → cap 49`, `side Sets>9 → cap 49`, `tendon>22 → cap 49`.
- Verification: `video 0.35 (Hands live) + vbt 0.35 + gripHistory 0.30` (аналог `scoreTA verification`).

Показывать как conic gauge в шапке только если `?proScore=1` или все 3 верификации есть — не ломает «механизм-ориентированную» философию.

---

## 4. UX — как это ляжет в `ArmDiagnosticsHub.tsx`

**Не ломаем 5 табов**, добавляем слой «Мёртвые точки» внутри существующих (как `WLDiagnosticsHub` показывает snatch 5 фаз чекбоксами):

**Grip таб:** остаётся RT/Axle/Pinch + ForceVector. Добавить чип «Слабое звено по хвату → коррекция» (pinch<10с → `pinch_block_hold 3×15с @60%`).

**Wrist/Ротация таб:** сейчас 4 чекбокса `cup/rising/pron/sup` + ползунки РУ/РН. Расширить до **12 точек-чипов** с группировкой:

```
Кисть:   [cup_start] [cup_hold] [rising_top] [contain_fingers]
Ротация: [pron_open] [pron_lock] [sup_cup] [sup_drag]
Давление:[side_mid] [side_pin] [back_start] [back_drag]
```

Клик → подсвечивается карточка `ARM_BIOMECH` (угол-диапазон + сустав + reason + loadCues + intensity + refs) + список коррекций (3 упражнения с `%` и `workingDirection` бейджем «к мизинцу»). Реюз `strength-sport-biomechanics` карточки дословно.

Под ползунками — бейдж `isValidAngleForWeakPoint(point, wristDeg)` «твой 10° в допуске 0–20° / вне → совет: согни сильнее».

**Pressure таб:** уже `side/back` + `Humerus` + `table 3/2/1`. Добавить мёртвые `side_mid/pin` и `back_*` с **humerus-gated предупреждением** (side_pin жёлтый «только с кистью, ≤3 сета до 4 нед»).

**Strength таб:** Bezkorovainyi 4 теста остаются. Добавить маппинг `F/t` → слабая точка: `finger flex низкая → contain_fingers`, `hammer низкая → sup_drag/back_drag`, `hook низкая → sup_*`, `cup низкая → cup_*` — автоподсветка чипов + кнопка «Добавить в диагностику» (как у `StickingPointAnalysisCard` «➕ в слабые мышцы»).

**Recovery таб:** без изменений (tendon/ACWR), плюс бейдж скор-оверлея если включён.

**Кнопка «→ Применить в Арм-конструктор»** отправляет `armWeakPoints` (до 2–3) + `armDayMap` (техника→день) + `armBiomechCards` + `diagnosticExerciseMap`. Конструктор кладёт коррекции в 1-ю неделю (как ТА) и помечает `isDiag`.

**Персистентность:** `he_arm_diagnostics_hub_v3` → `v4` с миграцией (8 booleans → 12 `weakPoints[]`), как `WLDiagnosticsHub he_wl_diagnostics_hub_v1`.

**Видео/BlazePose:** уже есть `createHandsProcessor` live — добавить `isArmAnglesVerified` бейдж зелёный когда Hands тречит, как `isAnglesVerified` в `strength-sport-pose`.

---

## 5. Фаза внедрения

**Phase 0 — Типы и биомеханика (0.5д, без UI):**

- [ ] `src/engines/arm/arm-biomechanics.engine.ts` — `ARM_BIOMECH` 12 точек + `diagnoseArmWeakPointDetailed` + `isValidAngleForWeakPoint` + `phaseForArmAngle` (~250 строк, зеркало `strength-sport-biomechanics`).
- [ ] `src/engines/arm/arm-weakpoint-corrections.ts` — мапа точка→упражнения (id проверены по `exercise-catalog-arm.ts`, intensity 0.60–0.75).
- [ ] Расширить `arm-weakpoint.engine.ts` — экспорт 12 `ArmWeakPoint` + алиасы старых 8, `weakMusclesToSpecTargets` без лома.

**Phase 1 — Диагностика + инъекция (1д):**

- [ ] `src/engines/arm/arm-diagnostics-hub.engine.ts` — добавить поля `weakPoints: ArmWeakPoint[]`, `biomechCards`, `angleChecks` в `ArmDiagnosticsReport`; функция `buildArmDiagnosticsReportDetailed` (старая остаётся обёрткой).
- [ ] `src/engines/arm/arm-diagnostics-injection.engine.ts` — `injectArmCorrections` (dedup, budget, dayCap, note trail).
- [ ] `src/engines/arm/arm-scoring.engine.ts` (опционально) — RSS `scoreArm` + floors + verification (выключен по умолчанию).

**Phase 2 — Хаб UI (1.5д):**

- [ ] `ArmDiagnosticsHub.tsx` — Wrist таб: 12 чипов (+ группировка) + биомех-карточки + angle-бейдж; Pressure — side/back dead точки; Strength — F/t→dead-point автоподсветка; Grip — pinch-коррекция. `applyToConstructor` шлёт `armWeakPoints+dayMap+biomech`. Миграция `v3→v4` (localStorage). Сохранить дизайн (CARD/DIM/ACCENT).
- [ ] `planner-bridge-handlers.ts` — расширить `weakpointsHandler` приёмом `armWeakPoints/armDayMap` (если нет — fallback на `groups`).

**Phase 3 — Конструктор + годовой (0.5д):**

- [ ] `ArmAutoConstructor.tsx` — после `finalizeArmPlan` вызвать `injectArmCorrections` если `armWeakPoints` пришли по bridge (как `StrengthSportConstructor:234`). Прокинуть `armTechnique` → `ARM_BIOMECH.intensity`.
- [ ] Тест `arm-annual` — гибрид с арм-блоком не ломается.

**Phase 4 — Тесты и доки (0.5д):**

- [ ] `arm-biomechanics.test.ts` (10) — 12 точек имеют `angleRange/keyJoint/reason/intensity 0.60–0.75`, алиасы старых 8 не ломаются.
- [ ] `arm-weakpoint-injection.test.ts` (8) — dedup, бюджет (новичок side>3 skip), dayCap 8, dayMap (pron→TableTech).
- [ ] `arm-diagnostics-hub-detailed.test.ts` (6) — 12 точек → 2 группы в план, humerus floor на side_pin.
- [ ] `ArmDiagnosticsHub.test.tsx` (6) — рендер 12 чипов, клик → биомех-карточка, «Применить» → bridge payload с `armWeakPoints`.
- [ ] Обновить `docs/ARMWRESTLING-ARMLIFTING-PRO-PLAN.md` §3.5 (weakpoint → 12) + этот план пометить `Status: APPROVED`.

Итого: **~4 дня**, ~7 новых/расширенных файлов (+400 строк движков, +120 строк UI), 30 тестов, `tsc 0`, parity с PL/TA по мёртвым точкам без ломки текущего «без-риск» дизайна.

---

## 6. Открытые вопросы (нужно решение до старта)

1. **Score — включать?** Текущий арм-хаб без общего балла — фича. Предлагаю RSS оверлей выключенным по умолчанию (показывать только в `?dev` или при полной верификации). Оставляем механизм-уровни как основные?
2. **Сколько точек показывать сразу?** 12 чипов много — группировать в аккордеоны (Кисть/Ротация/Давление) или показывать только точки своей `technique` (hook 5, toproll 5, press 2)? Рекомендую аккордеоны + фильтр по технике.
3. **VBT для арм — порог?** TA 10%, carry 15%, hypertrophy 20–25%. Для арм предлагаем `pron/sup 15%`, `cup/rising 12%`, `side 10%` (как у ТА pull/carry) — подтвердить?
4. **Humerus hard-cap — 3 сета side первые 4 нед уже есть (`arm-injury-guard`), но UI не блокирует. Делать hard-cap в инъекции (skip если >3) или только warn?

---

## 8. Доработка — разбор реализации + решения §6 (раунд 2)

### 8.1 Что реализовано из плана (факт)
- `arm-biomechanics.engine.ts` — 12 точек + `angleRangeDeg/keyJoint/reason/corrections/intensity 0.60–0.70` + `phaseForArmAngle/autoValidateArmAngles`.
- `arm-weakpoint-corrections.ts` — 12→упражнения (все id проверены по `exercise-catalog-arm.ts:72`), `LEGACY_TO_DETAILED` 8→12.
- `arm-weakpoint.engine.ts` — `diagnoseArmWeakDetailed` (merge weakTest+weakPoints, max 3, `biomechCards`), алиасы целы.
- `arm-diagnostics-hub.engine.ts` — detailed-отчёт (`weakPoints/biomechCards/corrections/scoring` + angle validation), механизм-уровни сохранены.
- `arm-diagnostics-injection.engine.ts` — `injectArmCorrections` 3× @%, per-day dedup, budget, tendon-cap, humerus guard, dayTags.
- `arm-scoring.engine.ts` — RSS-оверлей (не гейт), floors asym≥12/side>9/tendon>22 cap 49.
- `ArmDiagnosticsHub.tsx` (v4, 5 табов целы) — Wrist: 12 чипов группами + карточки + angle-бейдж; Pressure: 4 точки + humerus; Strength: F/t→точки; header RSS gauge; `v3→v4` миграция.
- Тесты: 4 новых файла (24) + hub 7 — зелёные на момент базы.

### 8.2 Найденные баги и исправления (только свои файлы)
1. **Support-путь потерян (критично).** `LEGACY_TO_DETAILED.support → contain_fingers`, но коррекции `contain_fingers` были pinch-only (`hub/plate/coc/saxon`) — RT<60 вёл в пинч-тупик, `rolling_thunder/apollon_axle` вообще не встречались ни в одной коррекции. Интернет (GoldenGrip/Mithril/ImproveYourGrip STAGE 3–5) требует разделять support/pinch/crush. **Фикс:** `contain_fingers.weakMuscles += grip_support`, corrections `+= rolling_thunder, apollon_axle` (оба есть в каталоге), `weightForExercise` — явная ветка `grip_support` (было default 30). Тест: RT 50 → `grip_support` в мышцах + `rolling_thunder` в коррекциях.
2. **Ложный ⚠ для side/back/contain (углы).** Хаб валидировал side/back (`angleRange` плеча 20–50°) значением `forearmDeg` 90° и contain (`пальцы`, слайдера нет) значением локтя 110° — всегда «вне диапазона». Движок (`autoValidateArmAngles`) такие точки уже пропускал (av undefined → skip) — расхождение движок/UI. **Фикс:** `ArmBiomechInfo.angleJoint?: wrist|elbow|forearm|none` + `angleJointForWeakPoint()` (`side/back/contain → none`, `sup_drag → elbow`, `cup/rising → wrist`, остальное `forearm`); `autoValidate` пропускает `none`; хаб показывает `• угол н/п — контроль по технике` вместо ложного ⚠. Явное поле проставлено side/back/contain, остальные — через хелпер (без ломки 12 записей).
3. **Ulnar/radial без покрытия.** В каталоге есть `ulnar_dev/radial_dev(_heavy)` (StrengthLog включает их 2×10–12), но ни одна точка на них не ссылалась. **Фикс:** `rising_top += radial_dev_heavy, ulnar_dev_heavy` (и в `ARM_BIOMECH`, и в `ARM_CORRECTIONS`).
4. **Мёртвый код.** `legacyDiag` в `arm-diagnostics-hub.engine.ts` считался и не использовался; в `arm-diagnostics-injection.engine.ts` `targetSession → actualTarget → finalSession` пересчитывался 3× через `findSessionForWeakPoint` мимо уже проверенного dedup. **Фикс:** удалено/упрощено (поведение то же, `finalSession = targetSession`).
5. **План §4 Grip-таб не доделан.** Чип «слабое звено хвата → коррекция» из плана отсутствовал. **Фикс:** блок в Grip-табе (pinch<10с → hub/plate 3×15с @60%; RT<60 → RT/Axle DOH 3×5 @60%; кнопка `+ contain_fingers`).
6. **`phaseForArmAngle` не использовался в UI.** План §3.4 требовал аналог `phaseForReps`, движок есть, хаб не звал. **Фикс:** `autoPoint` useMemo + блок «Авто по углам» во Wrist-табе с кнопкой добавления.

### 8.3 Решения открытых вопросов §6
1. **Score — оставлен оверлеем, не гейтом** (механизм-уровни основные). Показ только при `verification>0 || floors>0` — как предложено. Дополнительно RSS-бейдж продублирован в Recovery-таб.
2. **12 чипов — группы + ●-фильтр по технике** (без аккордеонов, лимит 3) — как предложено. Плюс авто-подсказка не даёт утонуть в 12.
3. **VBT-пороги — приняты, но БЕЗ ломки чужого `arm-vbt-capture.engine.ts`** (там wrist 20/30, rotation 25/35 — lax для мелких сухожилий). Решение: `vbtThresholdForWeakPoint()` в своём `arm-biomechanics` (cup/rising 12/20, pron/sup 15/25, side 10/20, back/contain 15/25) — показывается хинтом в карточках (`VBT warn/stop`), глобальные пороги не тронуты, чужие тесты целы. Основание: Mithril «lower fatigue, higher control for technical work».
4. **Humerus — warn + мягкий skip, не hard-блок.** Инъекция скипает side при `sideSets≥6` первые 4 нед (эквивалент ≤3/сессия при 2 сессиях), валидатор/гварды продолжают варнить (RIR≥2, ≤10%/нед). Hard-cap на 3 сета в UI не блокируем — иначе новичку с 2 столовыми сессиями нельзя добрать даже норму.

### 8.4 Что осознанно НЕ тронуто
- `exercise-catalog-arm.ts`, `arm-vbt-capture.engine.ts`, `planner-bridge-handlers.ts`, `ArmAutoConstructor.tsx`, чужие `arm-*` движки/тесты (bilateral/competition-prep/video/waf и т.д.) — границы по `git status`, кодировка только через edit-инструмент.

### 8.5 Раунд 3 — чистка и безопасность хинтов
- Хаб: удалён мёртвый `forceVec` memo (использовался только `forceVecPro`) и неиспользуемые импорты (`diagnoseArmWeakPoint`, `calcDynamicMetrics`, `ARM_BENCHMARKS`, `buildArmAcwr`, `weakPointsForTechnique`, `angleBetween`, `recordGripForce`) — все были только в import-строках, рендер не менялся.
- `phaseForArmAngle`: press+120° теперь хинтит `side_mid`, а не `side_pin` — авто-подсказка не должна первой предлагать humerus-рискованное дожимание (`side_pin` — только ручной выбор). Тест добавлен.
- Проверено: вся arm-область 37 файлов / 320 тестов зелёные (включая чужие PRO A-J), свои 7 файлов — 68/68.

## 7. Источники (для ссылок в коде)

- Brismar 1975 + Holstein-Lewis — торсия humerus при internal rotation плеча → spiral fracture (PMC 10315927, SciDirect S2666639).
- StrengthLog Abelsson rev 2025-12-02 — цепь мышц, 4-дневный шаблон, tendon holds.
- GoldenGrip 2025-05-14 — power chain 5 звеньев, 15 упражнений, humerus «slowly».
- Mithril 2026-07-14 — cup/pron/rising раздельно + комбинировать.
- ImproveYourGrip pron vs sup — pronator teres vs supinator+biceps, torque элиты > нормы.
- TAWF 2026-06-07 — train movements not muscles + table time > gym.
- Kuznetsov VIII — РН (к мизинцу/среднему/большому отдельно), 3/2/1 недели (moderate 50–75% 1–3мин / heavy 75–100% 10с–1мин / stress 100–125% 5–10с).

