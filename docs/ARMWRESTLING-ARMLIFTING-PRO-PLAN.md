# Армрестлинг + Армлифтинг — PRO-планировщик (план реализации)

> Статус: **PLAN ONLY** (Aug 2026). Код не меняется, все новые файлы изолированы.
> База проекта: `BB-auto` (bb-builder/finalize/split-patterns), `PL-auto` (LMS), `Annual-Training` (block-builders), `Exercise Catalog` (550+ ед.), `TrainingScreen` (5 зон, PlannerMode).
> Требование: **уровень PRO**, все файлы отдельные, интеграция без `git checkout .` конфликтов.

---

## 0. Резюме — что строим

Один PRO-планировщик с двумя дисциплинами (переключатель в шапке, как `тrainingFocus` в BB):

- **Armwrestling** — стол: `hook` / `toproll` / `press` + 6 цепочек давления (cup, pronation, supination, rising, side pressure, back pressure). Акцент — **рабочие углы (РУ) + рабочая амплитуда (РА)** (Кузнецов), статика 40–100% + стресс-подходы 100–125%, table time ≥50% объёма (принцип VIII).
- **Armlifting** — хват: `Rolling Thunder` (вращающаяся ручка 60мм, 2 3/8"), `Apollon Axle` (58мм, только прямой хват, без лямок), `Saxon Bar` / `Hub` / `Pinch Block` (щипковый), `CoC Silver Bullet Hold`, `Farmer Walk`. Акцент — поддержка/щипок/дробление (3 типа хвата).

Единый движок `src/engines/arm/` строит план по тому же пайплайну, что `buildBBPlan` (паттерн → бюджеты → фазы → недельный цикл → finalize → validate), но с **арм-спецификой**: tendon-бюджет, РУ/РН, баланс пронация/супинация, side-pressure guard (humerus).

**Не трогаем** (reuse): `adaptForPEDs`, `computeBBRecoveryScore`, `labTrainingAdjust`, `toDailyLoads/acuteChronicRatio`, `exercise-catalog` (расширяем отдельным файлом), `annual-training-storage` (добавляем `ARM` kind).

---

## 1. Web-исследование — синтез источников

### 1.1. Первичные источники (проверены 2024–2026)

| # | Источник | Что взяли |
|---|----------|-----------|
| 1 | **StrengthLog — Arm Wrestling Strength Training** (Andreas Abelsson, rev. 2025-12-02) [strengthlog.com](https://www.strengthlog.com/arm-wrestling-strength-training/) | Мышцы/паттерны: forearm flexors + pronator teres/supinator, biceps/brachialis, **brachioradialis** (hammer), rotator cuff + upper back + core. Недельный шаблон: 4 дня + table time. 8 недель: Phase1 (W1–4) база RPE7–8, Phase2 (W5–8) интенсивность RPE8–9, сеты −1 на базе. Программа: Wrist curl/extension 4×10–15, Pronation/Supination 3×8–12, Plate Pinch 3×10–20s, Hook Drills band/cable 3×8–12, Riser curl, Farmer Walk, Ulnar/Radial Deviation 2×10–12. Tendon: isometric/holds/partial. Ноги — для якоря. Коллаген 15г+Vit C за 30–60 мин до. JSCR 2025: morphology arm wrestlers vs strength athletes — специфичность > масса. |
| 2 | **GoldenGrip — 15 Best Exercises for Armwrestling** (Thijs Verbraeken, 2025-05-14) [goldengrip.com](https://www.goldengrip.com/blogs/knowledge-hub/the-best-exercises-for-armwrestling) | Power chain: Fingers→Wrist (cup&rising) → Wrist Rotation (pron/sup) → Elbow flexors → Shoulder/torso → Core/legs. 15 упражнений по 5 блокам: Cupping (Wrist curl/extension, Riser lift), Pronation/Supination (cable pronation 5×5 heavy, supination drag, hammer pulses tendon), Brachialis (thick-grip hammer, reverse EZ), Side pressure (cable side press — **humerus-risk, slowly**, band internal rotation, isometric table push-down 10s), Full chain (lat drag belt, one-arm landmine row underhand, anti-rotation hold). Инструменты: Wrist Wrench, Roller, Pronation Handle, Judo belt + pin. |
| 3 | **ImproveYourGrip — Periodization / Grip Hubs** (Henry, 2026) [improveyourgrip.net](https://improveyourgrip.net/how-to-periodize-arm-wrestling-grip-training) + [grip-strength-for-arm-wrestlers](https://improveyourgrip.net/grip-strength-for-arm-wrestlers) | Периодизация: Off-season Foundation (grip containment, wrist integrity, tendon) → Strength/Power Transition → Pre-competition Peaking. Каждая фаза — на предыдущей, static endurance + pronation + containment. Advanced: tendon durability, progressive overload, pressure transitions, balancing table time vs recovery. Таксономия: finger containment, rising, static endurance, grip endurance vs crushing. |
| 4 | **Power35 — «Программа тренировок в армрестлинге: секреты чемпионов»** (Василий Кузнецов, перевод/компиляция 2011) [power35.ru](https://power35.ru/biblioteka/programma-trenirovok-v-armrestlinge-sekrety-chempionov) | 8 спец-принципов: I РУ/РА (статика в РУ, динамика в РА, однофазность, борьба с лимитирующим пучком), II Рабочее направление (пучки мышцы по ширине — сгибание кисти к мизинцу/среднему/большому отдельно), III Статика vs динамика, IV Ограниченная амплитуда (не до полного разгибания — растяжение снижает потенциал), V Взаимозависимость (слабые пучки тормозят сильные — периодически ОФП слабых), VI Длительное умеренное статика 40–60% 1–3 мин (толерантность), VII Стресс — 100–125% 5–10с, VIII ≥50% — стол. Таблица цикла: умеренная 3×/нед 50–75% 1–3 мин, тяжёлая 2× 75–100% 10с–1мин, стресс 1× 100–125% 5–10с. Упражнения: пояс/ремень, скамья, отведение/приведение кисти, молотковые сгибания через ремень на проксимальную фалангу (фиксация кисти!). Разминка: 5–10 мин кардио + махи/вращения + 2–5 разминочных подходов (wrist curl — до 5). Предплечье тяжеловеса >40см. Джон Брезенк: предплечье+кисть — первично, без них бицепс бесполезен. |
| 5 | **TAWF/Wikipedia/WAF — Techniques: Hook/Toproll/Press + Movements** [tawf.ca](https://www.tawf.ca/league/learn/arm-wrestling-techniques) + [wikipedia Arm_wrestling](https://en.wikipedia.org/wiki/Arm_wrestling) + [waf-armwrestling.com rules](https://www.armsport.se/wp-content/uploads/dokument/WAF/2022-WAF-Rules.pdf) | 3 техники — единственные: Hook (inside, supination+cup, back pressure, biceps/brachialis, pectoralis major+triceps фиксация) — новички к нему тянутся, но грузит локтевые связки сильнее → первые недели на toproll; Toproll (outside, pronation, rise, finger attack, brachioradialis) — эквалайзер против сильного; Press (triceps/chest/bodyweight forward) — финиш, опасен для локтя при неправильном угле. Movements: Cupping (flexion к себе, теряет leverage если кисть открыта), Rising (подъём пальцев), Pronation/Supination, Side pressure (латераль, humerus spiral fracture риск), Back pressure (тяга на себя). Все работают во всех техниках, но доминирует 1. Весовые: WAF −55..+110м, supermatch best 3/5 или 4/6–7. Стол 91.4×66см. |
| 6 | **Armlifting — Rolling Thunder / Apollon Axle / Saxon** [wikipedia Rolling_Thunder](https://en.wikipedia.org/wiki/Rolling_Thunder_%28exercise%29) + [strongshop Apollon Axle](https://strongshop.com.ua/en/powertraining/strength-exercises/forearm-workout/430-apollon-axle-bar-deadlift) + [armliftingusa Beginners](https://armliftingusa.com/armlifting-for-beginners) + [ironmind Catalog](https://ironmind.com/export/sites/ironmind/.galleries/pdfs/IM-Cat2020_IMNews.pdf) + [styrki Rolling Thunder](https://styrki.com/exercise-library/rolling-thunder) | Rolling Thunder — однорукая тяга 2 3/8" вращающаяся ручка, 1993, IronMind. WR 130.5кг (M) /77.2кг (F). Apollon Axle — 58мм, только прямой хват, без лямок/разнохвата, техника как становая но вес меньше, лимитирует хват → разгружает спину/ноги (плюс для травм). Saxon Bar — 3" прямоугольник, щипок двумя руками. + Hub (IronMind Hub), CoC Silver Bullet Hold, Little Big Horn, Fat Gripz (дешёвый старт: Blue Fat Gripz на тяги/тяги/шраги/сгибания). 3 типа хвата: support (удержание — thick bar, Rolling Thunder, farmer walk), pinch (только пальцы — без силы большого пальца никуда), crushing (эспандеры). Частота: ~1×/нед на Axle, либо в день спины/предплечий. |
| 7 | **Grip periodization / Armlifting programs** [gegnsgym armlifting-programs](https://gegnsgym.com/armlifting-programs/) + [grindergym armlifting-training](https://grindergym.com/armlifting-training/) + [strongshop strength-and-types-of-grip](https://strongshop.com.ua/en/powertraining/training-systems/327-strength-and-types-of-grip) | Структура: Assessment → Goal → Volume/Max/Effort/Endurance cycles → Weak point → Peaking → Evaluation. 8-week Grip Strength Builder, Thick Bar Focus, Pinch Grip. Progressive overload + isometric holds + dynamic grip challenges + forearm/wrist conditioning (tendons/ligaments). |
| 8 | **Trauma / prevention** [alvin-almazov.ru](https://alvin-almazov.ru/boxing/chto-delat-esli-posle-armrestlinga-bolit-ruka-ili-lokot-profilaktika-i-lechenie-travm) + [gorillagym.kg](https://gorillagym.kg/articles/63/Vosstanovlenie-posle-travmy-loktya-v-armrestlinge-ili-CHto-delat-esli-prohrustela-svyazka.html) + [reddit r/armwrestling](https://www.reddit.com/r/armwrestling/comments/1njtdqd/injury_during_arm_wrestling/?tl=ru) | Частые: UCL (медиальная связка локтя), боковая связка, «теннисный локоть», spiral humerus (side pressure), бицепс-дистальный. Причины: плохая техника + нет разминки + нет отдыха + тренировка «бока» на блоке (вектор только поперечный, без разгрузки спиной — чемпионы от неё отказались). Профилактика: 3 месяца без борьбы в полную силу для новичков, разминка 5–10 мин кардио + суставные вращения + 2–5 подходов, холод 0.5–2ч при подозрении, баланс пронация/супинация каждый сессион (GripBoard), медленный набор side pressure. |

### 1.2. Выводы для PRO-уровня (что отличает любителя от профи)

| Любитель (не делаем) | PRO (делаем) |
|----------------------|--------------|
| Качает бицепс/предплечье «в общем», жим/тяга как у бодибилдера | РУ/РА + РН (рабочее направление) — кисть к мизинцу/среднему/большому отдельно, угол локтя 90–120°, стол первым упражнением |
| Только динамика 8–12 повт | Смесь: динамика 3–8 тяж + 10–15 база + изометрия 10–20с + статика 1–3 мин 40–60% + стресс-синглы 100–125% 5–10с |
| Тренирует только pronation | Пары: pronation↔supination, flex↔ext, ulnar↔radial — всегда баланс, иначе локоть |
| Side pressure на блоке тяжёло каждый день | Side pressure — gated (≤1×/нед, humerus guard, техника press только с контролем кисти, не на блоке) |
| Table time — по настроению | Table time — ≥50%, периодизирован: умеренная/тяжёлая/стрессовая неделя (3/2/1), ≥48ч между тяжёлыми |
| Хват — «просто жму кистью» | 3 хвата раздельно + rising + containment — отдельные блоки |
| Одна программа на всё | Специализация по технике (hook/toproll/press) + по слабому звену (rising/pronation/biceps/side) с tradeoff-донорами (как BB `bb-tradeoff`) |

---

## 2. Доменная модель

### 2.1. Таксономия — группы/мышцы/пучки

**ArmMuscle** (канон, расширяет `BBMuscle`, но не ломает):
```
wrist_flexors      // сгибатели кисти (cup)
wrist_extensors    // разгибатели (стабилизатор)
pronators          // pronator teres + quadratus (toproll)
supinators         // supinator + biceps (hook)
risers             // разгибатели пальцев/отведение (rising, finger containment)
ulnar_deviators    // лучевая/локтевая девиация (ulnar)
radial_deviators
brachialis         // брахиалис (hook, молот)
biceps_long        // бицепс длинная
biceps_short
brachioradialis    // хаммер
back_pressure      // широчайшие + задняя дельта + ромбовидные (тяга на себя)
side_pressure      // грудь + трицепс + передняя дельта (press)
grip_support       // support grip (Rolling Thunder / Axle)
grip_pinch         // pinch (Saxon, Hub, plates)
grip_crush         // crush (CoC)
thumb              // большой палец (pinch ключ)
shoulder_stab      // ротаторная манжета + трапеции (защита)
core_anchor        // core + ноги (якорь)
```

Гранулярные → канонические (как `WEAK_TO_MUSCLE`):
- `cup_medial/cup_lateral` → `wrist_flexors`
- `pronator_teres/pronator_quadratus` → `pronators`
- `thumb_adductor` → `thumb`

### 2.2. Движения / паттерны (movementPattern)

```
cupping           // сгибание кисти к себе
rising            // подъём пальцев / finger containment
pronation         // вращение внутрь
supination        // наружу
ulnar_deviation   // к мизинцу
radial_deviation  // к большому
hammer_curl       // молот
back_drag         // тяга на себя (back pressure)
side_press        // боковое давление
shoulder_internal // внутренняя ротация плеча
grip_support / grip_pinch / grip_crush / grip_hub
isometric_hold    // 10–20с удержание
static_endurance  // 1–3 мин 40–60%
```

### 2.3. Техники (ArmTechnique)

```
hook       → доминирует: supinators + wrist_flexors + brachialis + back_pressure
toproll    → pronators + risers + brachioradialis + back_pressure
press      → side_pressure + triceps + chest + shoulder_stab
inside_hook / outside_toproll — подварианты
```

Техника влияет на:
- выбор упражнений (hook — больше супинации/брахиалиса, toproll — пронации/rising)
- распределение объёма (специализация на технику ×1.3 как в BB `resolveSpecialization`)
- порядок в сессии (стол/пронация первым, как `compound_first`)

### 2.4. Дисциплины / режимы

```
ArmDiscipline = 'armwrestling' | 'armlifting' | 'hybrid'
ArmGoal = 'strength' | 'peaking' | 'hypertrophy' | 'endurance' | 'maintenance'
  strength     → макс сила (1–5 повт, 3–6 в базе, изометрия)
  peaking      → подводка к старту (тейпер как PL/BB)
  hypertrophy  → масса предплечья (8–15, памп)
  endurance    → суперматч (100+ повт, 1–3 мин статика)
  maintenance  → поддержание

ArmLevel — reuse BB: beginner/intermediate/advanced/enhanced (+ PED)
```

### 2.5. Рабочие углы / амплитуды (РУ/РА/РН)

Каждое упражнение помечается:
```
workingAngles: { elbow: 90|110|120, wrist: 'flexed'|'neutral'|'extended', forearm: 'pronated'|'supinated'|'neutral' }
workingDirection: 'to_little'|'to_middle'|'to_thumb'  // РН
isStatic: boolean  // статика в РУ
isLimitedROM: boolean // ограниченная амплитуда (не до разгиба)
```

Движок хранит `angleHistory` и ротирует РУ каждую неделю (принцип I, II).

### 2.6. Хваты (армлифтинг)

```
ArmGripType = 'support' | 'pinch' | 'crush' | 'hub'
ArmImplement = 'rolling_thunder' | 'apollon_axle' | 'saxon_bar' | 'hub' | 'pinch_block' | 'coc_bullet' | 'farmer_handles' | 'fat_gripz'
```

Каждый хват — отдельный бюджет (нельзя замещать support→pinch, как `cannotReplace` в каталоге).

### 2.7. Травмо-гейты

```
WristGuard:   pronation/supination баланс ≤1.5×, flex/ext ≤1.5×, ulnar/radial ≤2×
ElbowGuard:   side pressure ≤5 сетов/нед на старте, только с контролем кисти, не на блоке в тяж. день
HumerusGuard: side pressure прогрессия ≤10%/нед, RIR≥2 на side, stop при боли
ShoulderGuard: internal rotation — high-rep (12–20), не до отказа
TendonGate:  новички — 3 месяца без 100% спарринга, объём ×0.7 первые 4 недели
```

---

## 3. Архитектура — куда класть, что reuse

### 3.1. Принцип: «все файлы отдельные»

```
src/engines/arm/                          // NEW — изолирован, как bb/ / lms/
  arm-types.ts                            // ArmPlan/Week/Session/Exercise/Set, ArmBuilderInput, ArmGoal/Level/Technique/Grip
  arm-day-types.ts                        // DayCharacter ('тяж'|'памп'|'техника'|'лёг'), TAG_MUSCLES_ARM, FORCE_HEAVY_GROUPS_ARM
  arm-split-patterns.ts                   // ARM_SPLIT_PATTERNS (6–8 паттернов) + ARM_GRIP_PATTERNS
  arm-volume-landmarks.engine.ts          // ARM_VOLUME_LANDMARKS_DB (15 групп × 4 уровня)
  arm-volume.engine.ts                    // бюджеты, indirect, sessionLimits, perExerciseCap, aggregateVolume
  arm-selector.engine.ts                  // rankArmSplits / selectBestArmSplit
  arm-builder.engine.ts                   // buildArmPlan() — ядро
  arm-finalize.engine.ts                  // finalizeArmPlan() — 12+ пассов
  arm-specialization.engine.ts            // resolveArmSpec / buildArmSchedule (3–6 нед блоки)
  arm-tradeoff.engine.ts                  // applyArmTradeoff (доноры: grip → wrist)
  arm-validator.engine.ts                 // validateArmPlan (MRV, cap, balance, humerus)
  arm-metrics.engine.ts                   // calcArmMetrics (tonnage, intensity, tendon load)
  arm-report.engine.ts                    // buildArmReport (rationale, warnings)
  arm-progression.engine.ts               // doubleProgression для арм-упражнений + e1RM
  arm-taper.engine.ts                     // buildArmTaperCurve (подводка 2–3 нед)
  arm-weakpoint.engine.ts                 // diagnoseArmWeakPoint (cup/rising/pron/side)
  arm-technique.engine.ts                 // techniqueMap, exercise→technique, style recommendation
  arm-grip.engine.ts                      // grip-model: Rolling Thunder vs Axle vs Pinch (support/pinch/crush)
  arm-injury-guard.engine.ts              // isWristStress, isSidePressure, humerusGuard
  arm-macrocycle.engine.ts                // buildArmMacrocycle (reuse BBMacrocycle, фаза hypertrophy/strength/peaking/transition)
  arm-table.engine.ts                     // table-time budgeting (≥50% rule, moderate/heavy/stress weeks)
  index.ts                                // баррель

src/core/exercise-catalog-arm.ts          // NEW — 35–45 арм-упражнений (отдельно, мержится в каталог через getArmExercises())
src/core/exercise-catalog.ts              // TOUCH 1 line — import + [...EXERCISE_CATALOG, ...ARM_EXERCISES] (или merge-функция)

src/engines/manual-constructor/manual-draft-arm.engine.ts  // NEW — autodraftArmPlan()
src/engines/user-program/arm-program-mapper.ts             // NEW — armPlanToUserProgram (как createFromBuild)

src/engines/annual-training/arm-block-builders.ts          // NEW — buildArmBlock (диспетчер годового)
src/engines/annual-training/annual-training.types.ts       // TOUCH 2 lines — AnnualBlockKind += 'ARM', direction += 'arm'
src/engines/annual-training/block-builders.engine.ts       // TOUCH 10 lines — case 'ARM' в buildAnnualBlock + compose

src/ui/screens/TrainingScreen_parts/ArmAutoConstructor.tsx  // NEW — UI-конструктор (зеркало BbAutoConstructor, 1500–2000 строк)
src/ui/screens/TrainingScreen_parts/ArmTechniqueCard.tsx    // NEW — карточка диагностики (как PlDeadpointsBarPathCard)
src/ui/screens/TrainingScreen_parts/ArmGripCard.tsx         // NEW — карточка хвата
src/ui/screens/TrainingScreen_parts/nav.ts                  // TOUCH 2 lines — + 'arm' в PlannerMode + PLANNER_MODES
src/ui/screens/TrainingScreen.tsx                           // TOUCH 15 lines — + 'arm' ветка в constructor
```

Итого: **~22 новых файла**, **5 точечных правок** (каждая ≤20 строк, с флагом `// ARM:`). Никаких правок в `bb-*` / `lms-*` / `cardio.*` / `nutrition*`.

### 3.2. Reuse без копипасты

| Что reuse | Как |
|-----------|-----|
| `adaptForPEDs(peds, baseMrv, pedDoses, intensity)` | Прямой импорт из `bb-ped-adaptation.engine` — MRV×1.3–2.0 для предплечий тоже работает, но с `tendonCap` 1.5× (сухожилия медленнее) |
| `computeBBRecoveryScore({bodyFat, leanMass, hrvMs, sleepHours, stressLevel})` | Импорт из `bb-volume.engine` → `armRecoveryMult` |
| `labTrainingAdjust(labs) → labMrvMultiplier` | Импорт из `bb-builder`/`profile` — тот же (ALT/CRP/HCT) |
| `toDailyLoads / acuteChronicRatio / autoRegulate` | Импорт из `training-load.engine` + `pro/autoregulation-pro` — ACWR для арм-дней отдельно |
| `epley1RM / prescribeLoad / doubleProgression` | Импорт из `bb-progression-feedback` — для wrist/pronation тоже (вес×(1+reps/30)) |
| `selectExercisesSmart` | Импорт из `exercise-selector.engine` — с фильтром `group='arms'` + `movementPattern` |
| `EXERCISE_CATALOG` subgraph | `group='arms'`, `equipment='arm_table'|'cable'|'dumbbell'|'band'|'grip_tool'|'fat_gripz'`, `movementPattern='pronation'|'supination'|'cupping'|'rising'|'side_pressure'|...` |
| `AnnualTrainingPlan` stale/dispatch | Расширяем тип, логика `syncAnnualPlan` уже generic (hash по `phase/weekOffset/weeks/cycleId`) — просто добавляем `kind='ARM'` |
| `UserProgram` | `meta.direction='arm'`, `arm?: ArmProgramBody extends BBProgramBody` — reuse существующих типов, не форк |

---

## 4. Детальный план файлов

### Phase 0 — Подготовка (0.5 дня)

- [ ] Создать `src/engines/arm/` папку + `index.ts` баррель.
- [ ] Скопировать как шаблон `bb-types.ts` → `arm-types.ts`, `bb-day-types.ts` → `arm-day-types.ts` (структура, не логика).
- [ ] Ветка: `feat/armwrestling-armlifting-pro`.

### Phase 1 — Типы и каталог (2 дня)

**`arm-types.ts`** (~250 строк)
```ts
export type ArmDiscipline = 'armwrestling' | 'armlifting' | 'hybrid';
export type ArmTechnique = 'hook' | 'toproll' | 'press' | 'balanced';
export type ArmGripType = 'support' | 'pinch' | 'crush' | 'hub';
export type ArmGoal = 'strength' | 'peaking' | 'hypertrophy' | 'endurance' | 'maintenance';
export type ArmMuscle = 'wrist_flexors'|'wrist_extensors'|'pronators'|'supinators'|'risers'|'ulnar_deviators'|'radial_deviators'|'brachialis'|'biceps_long'|'biceps_short'|'brachioradialis'|'back_pressure'|'side_pressure'|'grip_support'|'grip_pinch'|'grip_crush'|'thumb'|'shoulder_stab'|'core_anchor';
export type ArmWorkingDirection = 'to_little'|'to_middle'|'to_thumb';
export interface ArmWorkingAngle { elbowDeg: 90|110|120; wrist: 'flexed'|'neutral'|'extended'; forearm: 'pronated'|'supinated'|'neutral'; direction: ArmWorkingDirection; }
export interface ArmBuilderInput { discipline: ArmDiscipline; patternId: string; level: string; goal: ArmGoal; technique: ArmTechnique; weeks: number; workMax?: Record<ArmMuscle,number>; weakPoints?: ArmMuscle[]; focusGroup?: ArmMuscle; specialization?: boolean; specializationSchedule?: ArmSpecializationBlock[]; gripImplement?: ArmImplement; gripFocus?: ArmGripType; trainingFrequency?: number; tableTimeRatio?: number; // 0.5–0.7
  equipment?: string[]; injuries?: ArmInjury[]; mobilityRestrictions?: string[]; favoriteExercises?: string[]; excludedExercises?: string[]; planStartWeek?: string;
  sex?: 'male'|'female'; bodyFat?: number; leanMass?: number; hrvMs?: number; sleepHours?: number; stressLevel?: number; labMrvMultiplier?: number;
  pedDoses?: Record<string,number>; courseIntensity?: 'mild'|'moderate'|'heavy'; calorieSurplus?: number; proteinPerKg?: number; previousPlan?: ArmPlan; }
export interface ArmPlan { pattern: SplitPattern; weeks: ArmWeek[]; rotationMuscleVolume: Record<string,number>; rationale: string[]; volumeLandmarks?: VolumeLandmarkRow[]; weeklyVolume?: Record<number, Record<string,{directSets,effectiveSets,tendonSets}>>; validation?: ArmValidationResult; report?: ArmReport; inputSnapshot?: Partial<ArmBuilderInput>; }
export interface ArmWeek { week: number; phase: 'accumulation'|'intensification'|'deload'|'peaking'; deload?: boolean; taper?: boolean; tableRatio?: number; sessions: ArmSession[]; }
export interface ArmSession { day: number; weekOffset: number; character: 'тяж'|'памп'|'техника'|'лёг'; sessionTag: string; tableTime?: boolean; exercises: ArmExercise[]; }
export interface ArmExercise { muscle: ArmMuscle; name: string; role: 'primary'|'accessory'; character: DayCharacter; sets: number; repsRange: [number,number]; rir: number; workSets: ArmSet[]; workingAngle?: ArmWorkingAngle; isTable?: boolean; isStatic?: boolean; holdSeconds?: number; tempoSpec?: string; supersetWith?: string; comment?: string; rationale?: string; }
export interface ArmSet { reps: number|'AMRAP'; rir: number; weight: number; holdSeconds?: number; tempo?: string; restSeconds?: number; technique?: 'isometric'|'static_endurance'|'stress_single'; }
```

**`exercise-catalog-arm.ts`** (~600 строк, 35–45 упражнений, все поля как в `exercise-catalog.ts`):

*Cup / Rising (8)*: `wrist_curl_belt` (пояс через пальцы — Кузнецов), `wrist_curl_barbell`, `wrist_extension`, `riser_lift_judo_belt`, `plate_pinch_hold`, `finger_containment_band`, `wrist_roller`, `hub_pinch`.

*Pronation / Supination (8)*: `cable_pronation_90` (5×5 heavy), `sledge_hammer_pronation`, `pronation_pulses` (tendon micro), `cable_supination_drag`, `supination_hammer_curl`, `pronator_strap_table`, `indian_clubs_pronation`, `lever_top_supination`.

*Brachialis / Biceps (6)*: `thick_hammer_curl`, `reverse_ez_curl`, `hammer_belt_curl` (через ремень на фалангу), `preacher_hammer`, `incline_hammer`, `zottman_curl`.

*Back / Side pressure (8)*: `cable_side_pressure` (humerus guard), `lat_drag_belt_wrist`, `one_arm_landmine_row_underhand`, `seated_row_strap_to_hip`, `internal_rotation_band` (12–20), `isometric_table_pushdown_10s`, `shoulder_press_side` (press), `standing_cable_hook`.

*Grip implements (8)*: `rolling_thunder_one_hand` (2 3/8", вращающаяся), `apollon_axle_deadlift` (58мм, DOH, no straps), `saxon_bar_deadlift` (3" pinch), `farmer_walk_fat`, `coc_gripper_close`, `silver_bullet_hold`, `fat_gripz_curl`, `pinch_block_hold`.

Каждое: `group: 'arms'`, `equipment: 'arm_table'|'cable'|'dumbbell'|'band'|'grip_tool'|'fat_gripz'|'barbell'|'machine'`, `movementPattern: 'cupping'|'rising'|'pronation'|'supination'|'hammer_curl'|'back_drag'|'side_press'|'grip_support'|'grip_pinch'|'grip_crush'|...`, `substitutionGroup` (строгие: `cup_iso` ↔ только cup, `pronation` ↔ только pronation, `grip_support` ≠ `grip_pinch`), `jointStress`, `fatigueCost`, `technique`, `canReplace/cannotReplace` (рычаг ≠ бицепс).

**`arm-day-types.ts`** (~120 строк):
```ts
export type ArmDayCharacter = 'тяж' | 'памп' | 'техника' | 'лёг';
export const TAG_MUSCLES_ARM: Record<string, ArmMuscle[]> = {
  TableHeavy: ['wrist_flexors','pronators','brachialis','back_pressure'],
  TableTech:  ['risers','pronators','supinators','shoulder_stab'],
  GripHeavy:  ['grip_support','grip_pinch','wrist_flexors','thumb'],
  Support:    ['back_pressure','side_pressure','shoulder_stab','core_anchor'],
  Hammer:     ['brachialis','brachioradialis','biceps_long','wrist_flexors'],
  FullArm:    ['wrist_flexors','pronators','supinators','brachialis','risers','grip_support'],
  // ... + специфичные для армлифтинга: SupportGrip, PinchGrip, CrushGrip
};
export const FORCE_TECHNIQUE_GROUPS = new Set(['risers','thumb']); // всегда техника/лёг, не тяж
export const HUMERUS_RISK_PATTERN = /side.*press|боковое/i;
```

### Phase 2 — Бюджеты и селектор (2 дня)

**`arm-volume-landmarks.engine.ts`** (~200 строк) — таблица `ARM_VOLUME_LANDMARKS_DB` (15 мышц × 4 уровня):
```
wrist_flexors:  bgn mev6/mav10/mrv14, int 8/12/16, adv 10/14/18, enh 12/16/20×1.3 (но tendonCap 1.2)
pronators:       6/10/14 → 7/11/15 → 8/12/16 → 10/14/18
supinators:      5/9/13  → 6/10/14 → 7/11/15 → 8/12/16
brachialis:      6/10/14 → 8/12/16 → 10/14/18 → 12/16/22
grip_support:    4/8/12  → 6/10/14 → 8/12/16 → 10/14/18
grip_pinch:      3/6/10  → 4/8/12  → 6/10/14 → 8/12/16
side_pressure:   2/5/8   → 3/6/9  → 4/8/11 → 5/10/14 (humerus-limited)
... (все 19)
```
Функции: `getArmLandmarks(level, muscle)`, `landmarksForRotation(muscle, daysPerWeek)` (×days/7, как BB).

**`arm-volume.engine.ts`** (~350 строк) — `computeArmRecoveryMult`, `computeArmWeeklyBudget`, `sessionLimitsForArm` (натурал 4–6 упр/сессия, 8–10 сеты; курс +2), `perExerciseCap` (5, side pressure =3), `indirectContributions` (hammer curl → wrist_flexors 0.3, back_drag → biceps 0.4), `aggregateArmVolume`, `tendonLoadScore` (сумма isStatic + high jointStress).

**`arm-selector.engine.ts`** (~180 строк) — `rankArmSplits(candidates, input)` скоринг:
- `goal` (strength→ тяж-паттерны, peaking→ taper-паттерны, endurance→ high-freq)
- `technique` (hook→ больше Supinators/Brachialis, toproll→ Pronators/Risers)
- `gripFocus` (support→ GripHeavy, pinch→ PinchGrip)
- `equipment` (стол/блок/рычаг/hub — фильтр)
- `injuries/mobility` (исключает side pressure при UCL)
- `weakPoints` (гранулярные → канонические, как `WEAK_TO_MUSCLE`)
- `level` (n00b → 2×/нед, adv → 4–5×)

**`arm-split-patterns.ts`** (~400 строк) — 8 паттернов:
```ts
{ id:'arm_2_table_support', rotationDays:7, sessions:2, schedule:[TableHeavy, Support] } // новичок, 2×
{ id:'arm_3_full', rotationDays:7, sessions:3, schedule:[TableHeavy, GripHeavy, Support] }
{ id:'arm_4_upper_lower', rotationDays:7, sessions:4, schedule:[TableHeavy, Support, TableTech, GripHeavy] }
{ id:'arm_5_specialized', rotationDays:7, sessions:5, schedule:[TableHeavy, Hammer, GripHeavy, TableTech, Support] } // PRO
{ id:'arm_rolling_3_1', rotationDays:8, sessions:6, schedule: rolling 3/1 (как bb rolling) }
{ id:'grip_3_support', rotationDays:7, sessions:3, schedule:[SupportGrip, PinchGrip, CrushGrip] } // армлифтинг
{ id:'grip_4_mixed', rotationDays:7, sessions:4, schedule:[SupportGrip, PinchGrip, SupportGrip, CrushGrip] }
{ id:'hybrid_4_arm_pl', rotationDays:7, sessions:4, schedule:[TableHeavy, Support, GripHeavy, LegsCore] } // hybrid с базой
```
Каждый с `level[]`, `discipline[]`, `description` (на русском, как BB).

### Phase 3 — Ядро генерации (4 дня)

**`arm-builder.engine.ts`** (~800 строк) — `buildArmPlan(input, pedAdapt): ArmPlan` пайплайн (зеркало `buildBBPlan`):

1. `normLevel` + `pedAdapt = adaptForPEDs(...)` + `recoveryMult = computeArmRecoveryMult(...)` + `labMult` + `nutritionMult` + `tendonMult` (новичок ×0.7).
2. `mrvByMuscle = landmark.mrv × pedMult × recovery × lab × nutrition × specMrv` (spec ×1.3 focus, ×1.1 target, ×0.7 non-target — как BB, без стэкинга).
3. `rotationMuscleVolume / muscleFrequency` → `distributePhases(weeks, goal)` (accumulation/intensification/deload/peaking) — reuse `bb go`-логики.
4. Цикл `w=1..weeks`:
   - `weekVolumeMult` (accumulation 1.0 → intensification 0.9 → peaking 0.6, как PL taper)
   - `weekSpec = specForWeek(schedule, w)` (блок 3–6 нед, как `bb-specialization`)
   - `scaledVolume = rotationVolume × weekVolumeMult × specMult`
   - `sessions = buildArmSessions(pattern, w, scaledVolume, ...)` — каждый `buildArmSession(muscleSet, character, week, workMax, injuryProfile)`:
     - `buildExercisePool(muscle, role, {equipment, technique, workingAngle})` — фильтр по `TAG_MUSCLES_ARM` + `movementPattern` + `workingDirection` + `avoidWristStress`
     - `selectExercisesForMuscle(pool, count, {weakPoints, favorite, avoidAxial})` — через `selectExercisesSmart`
     - `computeArmLoading(muscle, exercise, phase, week, workMax)` — `sets/reps/rir/weight/tempo/rest/holdSeconds` (теж 3–6, памп 8–12, техника 10–15 + 10с изометрия, static_endurance 1–3 мин 40–60%)
     - Ротация РУ: `angleForSession = rotateWorkingAngle(muscle, w, history)` (к мизинцу/среднему/большому).
5. `applyArmTableBudget(weeks, tableTimeRatio)` — ≥50% сессий с `isTable=true`, moderate/heavy/stress недели (3/2/1 как у Кузнецова).
6. `prescribeArmProgression(weeks, previousPlan)` — doubleProgression по `workMax[armMuscle]` (fuzzy match, как BB).
7. `finalizeArmPlan(plan, options)` → `validateArmPlan()` → `buildArmReport()`.

**`arm-finalize.engine.ts`** (~500 строк) — 12 пассов (каждый — чистая функция, как `bb-finalize`):
- `ensureWeakPatternCoverage` (слабая пронация → обязательно рычаг/блок)
- `ensurePronSupBalance` (пронация/супинация ≤1.5×, иначе добавить антагонист)
- `ensureFlexExtBalance` (сгибание/разгибание кисти)
- `ensureGripCoverage` (если grip — специализация, добавить support+pinch)
- `ensureSidePressureGuard` (humerus: side ≤3 сета первые 4 недели, прогрессия ≤10%/нед, RIR≥2)
- `ensureTableTime` (≥50% объёма — стол, иначе swap)
- `capEnforcement` (weeklyVolume ≤ mrvByMuscle, режем accessory первым)
- `orderSessionExercises` (стол/пронация первым, изоляция последним — `compound_first`)
- `enforceSessionExerciseLimit` (≤10, как BB)
- `assignHoldsAndStatics` (isometric 10–20с, static 1–3 мин 40–60% в технику-дни)
- `dedupeAngles` (не повторять один РУ два дня подряд)
- `injectTendonConditioning` (high-rep 15–20 для новичков, tendon gate)

**`arm-specialization.engine.ts`** (~200 строк) — reuse `bb-specialization` без копипасты: `resolveArmSpec(focus, weakPoints, spec)` → `specMrvFactor` (focus ×1.3, target ×1.1, weak ×1.2, non-target ×0.7), `buildArmSchedule(..., totalWeeks, explicitBlocks?)` (блоки 3–6 нед, tail баланс), `specForWeek`.

**`arm-tradeoff.engine.ts`** (~180 строк) — `applyArmTradeoff(plan, tradeoff)` (доноры: `grip_support → wrist_flexors`, `biceps → brachialis`), снимает прямые изоляции донора до MEV, переносит в цель ≤MRV, cap 3 (side pressure).

### Phase 4 — Диагностика, хват, тейпер (2 дня)

**`arm-weakpoint.engine.ts`** (~250 строк) — `diagnoseArmWeakPoint(input)`:
- Cup слабая (кисть открывается) → `risers↑ + wrist_flexors↑`
- Rising слабая (пальцы уходят) → `risers + thumb↑`
- Pronation слабая (toproll не держит) → `pronators + brachioradialis↑`
- Supination слабая (hook проваливается) → `supinators + brachialis↑`
- Side pressure слабая (не дожимает) → `side_pressure + chest↑` (с guard)
- Back pressure слабая → `back_pressure + lats↑`
- Тест: `gripTest` (Rolling Thunder max, Axle max, Pinch hold seconds) → слабые зоны.

**`arm-grip.engine.ts`** (~200 строк) — модель армлифтинга:
- `GripImplementSpec { name, diameterMm, rotating: boolean, gripType, allowedGrips: ('DOH'|'mixed'|'hook')[], straps: boolean }`
- `RollingThunder: {d:60, rotating:true, gripType:'support', allowed:['DOH'], straps:false}`
- `ApollonAxle: {d:58, rotating:false, gripType:'support', allowed:['DOH'], straps:false}`
- `SaxonBar: {d:76, rotating:false, gripType:'pinch', ...}`
- Функции: `gripVolumeFor(implement, level)`, `gripProgression(week, maxWeight)` (linear + holds), `estimateGripMax(weight, holdSeconds)`.

**`arm-taper.engine.ts`** (~180 строк) — `buildArmTaperCurve({weeks:2–3, mode:'classic'|'peaking', gripFocus})`:
- Неделя N-2: объём ×0.65, RIR+1, side pressure −50%
- Неделя N-1: объём ×0.45, RIR+2, только техника + изометрия 10с, table time лёгкая
- Неделя N (comp): только 1 лёгкая техника-сессия + день отдыха перед стартом.
- Идемпотентен по метке `[arm-taper:N]`, как `applyBlockTaperToWeeks`.

**`arm-injury-guard.engine.ts`** (~150 строк) — `isWristStressExercise(ex)`, `isSidePressureExercise(ex)`, `isHumerusRisk(ex)`, `armInjuryVolumeFactor(injuries, muscle, weekDate)`, `checkHumerusGuard(plan)` (warnings если side > cap).

**`arm-table.engine.ts`** (~120 строк) — `tableTimeBudget(weeks, ratio)` — распределяет умеренные/тяжёлые/стрессовые недели (3/2/1), `isTableExercise(ex)` (по `isTable` флагу каталога).

**`arm-macrocycle.engine.ts`** (~150 строк) — `buildArmMacrocycle(input)` → 4 фазы `hypertrophy(8–12нед) / strength(6–8) / peaking(3–4) / transition(1–2)`, reuse `BBMacrocycle` типов (фазы те же), `ArmMacrocycle.fromBBMacrocycle` для годового.

### Phase 5 — UI (3 дня)

**`ArmAutoConstructor.tsx`** (~1800 строк, зеркало `BbAutoConstructor` но проще — 6 шагов):

Шаги: `'params'|'grip'|'split'|'plan'|'weights'|'quality'|'annual'` (упрощённая навигация, как Cardio).

State (40+ useState, как BB):
- `armDiscipline: ArmDiscipline` (сегмент: 🤝 Армрестлинг / 🏋️ Армлифтинг / 🔀 Гибрид)
- `armTechnique: ArmTechnique` (🏠 Hook / 🌀 Toproll / 💥 Press / ⚖️ Баланс) — для armwrestling
- `armGripFocus: ArmGripType` + `armImplement: ArmImplement` — для armlifting
- `armLevel: 'beginner'|'intermediate'|'advanced'|'enhanced'`, `armGoal: ArmGoal`, `armWeeks/armDays`
- `armWorkMax: Record<ArmMuscle,number>` (6 полей: wrist_flex/pron/sup/brachialis/grip_support/grip_pinch — упрощённо, маппится на 19)
- `weakPoints: ArmMuscle[]` → `specBlocks` (блоки 3–6 нед, как BB `specBlocks` — reuse UI)
- `armEquipment: string[]` (стол/блок/рычаг/эспандер/hub/pinch block/fat gripz)
- `injuries/mobility`, `bodyFat/leanMass/hrvMs/sleepHours/stressLevel/labMult` (reuse `useDataLink` + `getRecoveryMetrics`)
- `peds/pedDoses/courseIntensity` (reuse `adaptForPEDs`)
- `builtPlan: ArmPlan|null`, `armWeekSel`, `annualPlan`, `bridgeMsg`

UI-блоки:
- Карточка «🤝 Дисциплина»: сегменты + подсказка (armwrestling — стол обязателен, armlifting — хват).
- Карточка «🎯 Техника»: чипы Hook/Toproll/Press (для armwrestling) + preview `techniqueVolumeSummary`
- Карточка «✊ Хват»: чипы Support/Pinch/Crush/Hub + селект имплемента (Rolling Thunder/Axle/Saxon) — для armlifting
- Карточка «📊 Уровень/Цель/Недели/Дни» — как BB (степперы, PopupSelect)
- Карточка «💪 Рабочие максимумы» — 6 полей (wrist/pron/biceps/grip)
- Карточка «🎯 Слабые звенья» — чипы `wrist_flexors/pronators/brachialis/side_pressure/grip_*` + `specBlocks` (как BB)
- Карточка «🏥 Травмы/мобильность» — как BB
- Карточка «🧬 Recovery / PED» — свёрнутая, как BB
- Кнопка «⚡ Собрать план» → `buildArmPlan(input, pedAdapt)` → `finalizeArmPlan` → `setBuiltPlan`
- План-шаг: недели-табы + сессии-карточки (упражнения с `workingAngle` бейджем «РУ 90° к мизинцу», `isTable` иконка 🖐️, `holdSeconds` «10с удержание», `isStatic` «1–3 мин 40%»), RIR/темп/отдых.
- Quality-шаг: `ArmHeatmap` (per-muscle MEV/MAV/MRV), `validateArmPlan` warnings (humerus guard, balance, tendon), `tendonLoadScore`.
- Annual-шаг: живая синхронизация `he-annual-training-plan-updated`, как BB.

**`ArmTechniqueCard.tsx`** (~300 строк) — аналог `PlDeadpointsBarPathCard`: ввод «где проваливаешься» (cup/rising/pron/sup/side/back) → `diagnoseArmWeakPoint` → чип-рекомендации + кнопка «➕ В слабые звенья».

**`ArmGripCard.tsx`** (~250 строк) — ввод максимумов Rolling Thunder / Axle / Pinch → `diagnoseArmWeakPoint` + `gripProgression` рекомендация.

**Навигация** (минимальные правки):
- `nav.ts`: `PlannerMode += 'arm'`, `PLANNER_MODES.push({id:'arm', label:'Арм', icon:'🤝', hint:'Армрестлинг / Армлифтинг: стол + хваты, РУ/РА, tendon'})`
- `TrainingScreen.tsx`: `planningTrack==='arm' → <ArmAutoConstructor />`, `armPlanToSessions` в `training-integration`.
- `planner-bridge.ts`: `PlannerApplyKind += 'arm_weakpoints'|'arm_program'` (как `pl-weakpoints`).

### Phase 6 — Годовой / ручной / экспорт (1.5 дня)

**`manual-draft-arm.engine.ts`** — `autodraftArmPlan(opts: AutoDraftArmOptions)` (как `autodraftBBPlan`):
- `selectBestArmSplit` если нет `splitPattern` → `buildArmPlan` (≤16 нед) → циклическое расширение >16 нед (×1.005, deload без прогрессии) → `createFromBuild` → `UserProgram`.

**`arm-block-builders.ts`** / правки `annual-training`:
- `buildArmBlock(state, plan, macro, opts)` → `autodraftArmPlan` → `applyArmTaper` → `applyBlockPhaseToWeeks(ARM_PHASE_MOD)` (hypertrophy 1.0, strength 0.85, peaking 0.6, transition 0.45 — как BB).
- `ARM_PHASE_MOD` + `ARM_TAPER` константы.
- `annual-training.types.ts`: `AnnualBlockKind = 'PL'|'BB'|'ARM'|'MANUAL'` (1 строка), `AnnualPlanDirection += 'arm'`.
- `block-builders.engine.ts`: `case 'ARM': return buildArmBlock(...)` (10 строк), `composeAnnualProgram` уже generic.

**`arm-report.engine.ts` / `arm-metrics.engine.ts`** — копируют структуру `bb-report`/`bb-metrics` (tendon load вместо fatigue, table ratio).

**Экспорт**: `buildArmPrintHtml(plan)`, `buildArmIcs(plan)` — как `bb-visual`/`pl-export` (таблица недель × сессии, РУ бейджи, hold-секунды).

---

## 5. Матрица тестирования (PRO-гарантии)

| Категория | Тесты | Что проверяет |
|-----------|-------|---------------|
| **Unit: volume** | `arm-volume-landmarks.test.ts` (10) | MEV<MAV<MRV, tendonCap, rotation scaling |
| | `arm-volume.test.ts` (8) | recoveryMult, sessionLimits, perExerciseCap side=3, aggregate + tendonLoad |
| **Unit: selector** | `arm-selector.test.ts` (12) | rank по goal/technique/grip/equipment/injuries/level, hook→supinators, toproll→pronators |
| **Unit: catalog** | `arm-catalog.test.ts` (10) | 35+ упражнений существуют, group='arms', equipment, movementPattern покрытие 10 паттернов, canReplace строгие (pronation≠supination, support≠pinch) |
| **Unit: builder** | `arm-builder.test.ts` (15) | buildArmPlan детерминизм, 2×/3×/4×/5× паттерны, phase distribution (acc/int/del/peak), tableRatio ≥0.5, angle rotation (РУ не повторяется 2 дня), technique объём ×1.3, MRV cap |
| **Unit: finalize** | `arm-finalize.test.ts` (12) | pron/sup баланс ≤1.5, flex/ext баланс, side guard (≤3 первые 4нед), humerus progression ≤10%, table time, dedup angles |
| **Unit: weakpoint** | `arm-weakpoint.test.ts` (10) | cup→risers, pron→pronators, hook→supinators, pinch→thumb, каждый кейс даёт ≥2 рекомендации |
| **Unit: grip** | `arm-grip.test.ts` (8) | Rolling Thunder spec (2 3/8" rotating, DOH only), Axle 58mm DOH no straps, pinch vs support изоляции, progression |
| **Unit: taper** | `arm-taper.test.ts` (6) | 2-нед кривая 0.65/0.45, side −50%, RIR+1/+2, идемпотентность `[arm-taper:]` |
| **Unit: tradeoff** | `arm-tradeoff.test.ts` (6) | grip донор → wrist, снятие до MEV, перенос ≤MRV, cap 3 |
| **Unit: injury** | `arm-injury-guard.test.ts` (8) | isWristStress, isSidePressure, UCL → side exclude, humerus warnings |
| **Integration** | `arm-week-microcycle.test.ts` (6) | 3/2/1 moderate/heavy/stress недели, 40–60% 1–3мин vs 75–100% 10с–1мин vs 100–125% 5–10с |
| | `arm-plan-e2e.test.ts` (10) | 3 уровня × 3 техники × 2 дисциплины → 0 MRV overflow, 0 humerus violation, ≤10 упр/сессия, детерминизм |
| | `arm-annual.test.ts` (8) | buildArmBlock + compose hybrid (BB+ARM), stale detection, taper idempotent |
| **UI** | `arm-auto-constructor.test.tsx` (15) | рендер шагов, сегменты discipline/technique/grip, сборка плана, heatmap, warnings, bridge weakpoints |
| | `arm-technique-card.test.tsx` (6) | диагностика cup→risers, pron→lever, кнопка в weakPoints |
| **Итого** | **~150 тестов** | 18 файлов, все зелёные, tsc 0, vite build OK |

Дополнительно: `matrix_3×4` для инвариантов (как BB 3125 комбинаций) — 3 дисциплины × 4 уровня × 8 паттернов × 6 целей = 576 планов, 0 overflow/0 humerus/0 balance breach.

---

## 6. Интеграции (reuse 1-в-1, как в BB/LMS)

| Канал | Как подключить |
|-------|----------------|
| **Дневник** | `training-integration.engine.ts: armPlanToSessions(plan): BridgeSession[]` (source='ARM', exerciseName → `he_workout_log_v2`). `getExerciseProgress('cable_pronation_90')` уже работает (e1RM). `planVsFact()` без изменений. |
| **ACWR** | `loadSRPESessions → toDailyLoads → acuteChronicRatio` → `acwrZone` → `buildArmPlan({acwr})` (режет объём ×0.85 caution, ×0.65 dangerous, как BB/LMS). |
| **Recovery** | `getRecoveryMetrics(linked)` → `bodyFat/leanMass/hrvMs/sleepHours/stressLevel` → `armRecoveryMult` (тот же). |
| **PED** | `adaptForPEDs(peds, baseMrv, pedDoses, intensity)` → `pedAdapt` (tendonCap 1.5× вместо 2.0×). |
| **Lab** | `labTrainingAdjust(labs)` → `labMrvMultiplier` (тот же). |
| **Nutrition** | `calorieSurplus/proteinPerKg → nutritionMult` (тот же, но для арм — белок 2.2 г/кг, как у StrengthLog). |
| **Bridge** | `applyToPlanner({kind:'arm_weakpoints', data:{muscles, technique, gripTest}})` от `ArmTechniqueCard` → `subscribePlannerApply` в `ArmAutoConstructor`. |
| **Program store** | `createFromBuild(armPlan)` → `UserProgram` (`meta.direction='arm'`), `saveUserProgram` (`he_user_programs`), `loadUserPrograms` (фильтр по `arm`). |
| **Annual** | `he_annual_training_plan_v1` + событие `he-annual-training-plan-updated` — `ArmAutoConstructor` слушает, как `BbAutoConstructor`. `weekForDate` / `annualPlanPhaseForDate` — без изменений. |
| **Profile** | `he_profile_v2.personal/training/lifestyle` — уже есть `workMax` по арм-мышцам (добавить 6 ключей: `wrist_flex/pronator/brachialis/grip_support/grip_pinch/thumb`). Миграция — добавить в `profile-migration.ts` (fallback 0). |
| **Экспорт** | `buildArmPrintHtml` (PDF), `buildArmIcs` (календарь), `buildArmExcel` — как BB. |

---

## 7. Риски и отклонения (осознанные)

| Решение | Почему | Альтернатива (отклонена) |
|---------|--------|---------------------------|
| Один движок `arm/` на две дисциплины (флаг `discipline`) вместо двух движков `armwrestling/` + `armlifting/` | 80% логики общая (бюджеты, фазы, tendon, ACWR); два движка = дубль `arm-builder` на 600 строк, рассинхрон | Два движка — тяжелее поддержка, как BB vs PL уже разделены; hybrid-случай потребовал бы третий |
| Side pressure gated (≤3 сета, RIR≥2, ≤10%/нед) | Spiral humerus fracture — реальный риск, литература + WAF травматизм; BB-опыт: `perExerciseCap=5` недостаточен для side | Без gate — про-уровень не про безопасность; gate можно отключить в `advanced` с `humerusGuard: false` |
| Table time ≥50% — жёсткое правило (Кузнецов VIII) | Armwrestling — единоборство, не качалка; без стола сила не переносится. BB/LMS уже имеют базу ОФП, арм — стол | Сделать опциональным — новичок выберет 0% и не прогрессирует; оставим предупреждение, но не блок |
| РУ/РА — ротация углов каждую неделю, а не «одно упражнение на всё» | Принцип I, II Кузнецова — слабые пучки тормозят сильные; фиксированный угол = плато | Фиксированный угол проще — но это любительский уровень, не PRO |
| 4-дневный сплит как база (StrengthLog) vs 6-дневный | StrengthLog Phase1–2 + Kuznetsov 3/2/1 = 4-дневка оптимальна по восстановлению сухожилий (медленнее мышц). 6-дневка — только для `advanced` с `tendonCap` | 3-дневка для всех — недостаточно table time для PRO |
| PED tendonCap 1.5× (vs BB 2.0×) | Сухожилия адаптируются медленнее мышц (Bohm 2015); enhanced армрестлер с ×2.0 получит травму | Оставить ×2.0 — риск UCL |
| Не используем `bb-contest-prep` water/sodium/carb манипуляции | Арму не нужна сушка к сцене; пик — это тейпер объёма, не воды | Копировать BB prep — лишняя сложность |

**Нереализуемое в MVP (отложено):**
- Видео-разбор техники по углу локтя (требует CV, вне скоупа).
- Электронный стол с датчиками силы (hardware).
- Отдельный стол-таймер с живой обратной связью (как `CardioSessionTimer` — можно в V2).

---

## 8. Пошаговый план внедрения (6 фаз, ~12 дней)

| Фаза | Срок | Файлы | DoD |
|------|------|-------|-----|
| **F0** | 0.5д | `arm/index.ts`, ветка | Папка создана, баррель, tsc 0 |
| **F1** | 2д | `arm-types`, `exercise-catalog-arm`, `arm-day-types`, `arm-volume-landmarks`, `arm-volume`, `arm-split-patterns` | Типы готовы, 35+ упражнений в каталоге, landmarks таблица, бюджеты, 8 паттернов, тесты 30+ зелёные |
| **F2** | 2д | `arm-selector`, `arm-builder` (скелет), `arm-finalize` (скелет), `arm-specialization`, `arm-tradeoff` | Селектор скорит, builder собирает недели без finalize, specialization блоки 3–6нед, tradeoff доноры, тесты 25+ |
| **F3** | 4д | `arm-builder` (финал), `arm-finalize` (12 пассов), `arm-progression`, `arm-taper`, `arm-weakpoint`, `arm-grip`, `arm-injury-guard`, `arm-table`, `arm-macrocycle` | Полный пайплайн, 0 MRV overflow на 576 планах, humerus guard, grip-модель, taper 2–3нед, диагностика, тесты 80+ |
| **F4** | 2д | `arm-report`, `arm-metrics`, `arm-validator`, `manual-draft-arm`, `arm-program-mapper`, `annual arm-block-builders` | Отчёт/метрики/валидация, autodraft, UserProgram, годовой ARM-блок, hybrid compose, тесты 15+ |
| **F5** | 3д | `ArmAutoConstructor`, `ArmTechniqueCard`, `ArmGripCard`, `nav`/`TrainingScreen` glue (5 строк) | UI 6 шагов, heatmap, warnings, bridge weakpoints, table ratio индикатор, тесты UI 20+ |
| **F6** | 1д | `buildArmPrintHtml/Ics`, e2e, `vite build`, доки | Печать/календарь, e2e 576 планов, полный прогон ~6500 тестов зелёные (минус пред-существующие 90), tsc 0 по новым файлам |

**Порядок коммитов (pathspec, как в AGENTS.md):** каждая фаза — отдельный коммит, чужие файлы не трогаем, `git checkout .` безопасен.

---

## 9. Источники — полные ссылки (для верификации)

1. StrengthLog — Andreas Abelsson — Arm Wrestling Strength Training: Guide & Program (rev. 2025-12-02) — https://www.strengthlog.com/arm-wrestling-strength-training/ — также JSCR 2025-05-01 39(5):579–586 + Am J Clin Nutr 2016 105(1):136–143 (collagen).
2. GoldenGrip — Thijs Verbraeken — The Best Exercises for Armwrestling (2025-05-14) — https://www.goldengrip.com/blogs/knowledge-hub/the-best-exercises-for-armwrestling — power chain, 15 exercises.
3. ImproveYourGrip — Henry — How To Periodize Arm Wrestling Grip Training (2026-06-06) — https://improveyourgrip.net/how-to-periodize-arm-wrestling-grip-training — periodization Foundation→Power→Peaking.
4. ImproveYourGrip — Arm Wrestling Grip Strength Hub (2026-06-07) — https://improveyourgrip.net/grip-strength-for-arm-wrestlers — containment/rising/static/tendon.
5. Power35 — Василий Кузнецов — Программа тренировок в армрестлинге: секреты чемпионов (2011, перевод) — https://power35.ru/biblioteka/programma-trenirovok-v-armrestlinge-sekrety-chempionov — 8 принципов, РУ/РА/РН, таблица 3/2/1, belt/strap упражнения, Брезенк.
6. TAWF — Arm Wrestling Techniques: Hook, Toproll & Press (2026-06-07) — https://www.tawf.ca/league/learn/arm-wrestling-techniques — pronation/supination, hook inside (supination+cup), toproll outside (pronation+rising), press (shoulder+triceps).
7. Wikipedia — Arm wrestling — https://en.wikipedia.org/wiki/Arm_wrestling — техники, movements (cupping, pronation, rising, side/back pressure), WAF weight classes 55–110kg, table 91.4×66cm.
8. WAF — Rules of Armwrestling (2022 PDF) — https://www.armsport.se/wp-content/uploads/dokument/WAF/2022-WAF-Rules.pdf — правила, фолы, стол.
9. Grokipedia — Arm wrestling (2026-03-28) — https://grokipedia.com/page/Arm_wrestling — WAF 1977 Sofia, supermatch best-of-5/7, rep ranges 3–6 heavy / 8–15 specific / 10–20+ endurance.
10. StrongShop — Denis — Strength and types of grip — https://strongshop.com.ua/en/powertraining/training-systems/327-strength-and-types-of-grip — support/pinch/crush, Rolling Thunder, farmer walk, thick bar.
11. StrongShop — Apollon Axle Bar Deadlift — https://strongshop.com.ua/en/powertraining/strength-exercises/forearm-workout/430-apollon-axle-bar-deadlift — Axle 58mm, DOH only, no straps/mixed, 1×/нед.
12. IronMind — Armlifting: Grand Prix of Grip (Cat2020 PDF) — https://ironmind.com/export/sites/ironmind/.galleries/pdfs/IM-Cat2020_IMNews.pdf — Rolling Thunder 1993, 2 3/8" (60mm), WR 130.5/77.2kg, Apollon Axle, Hub, Saxon Bar, Little Big Horn.
13. Styrki — Rolling Thunder exercise library — https://styrki.com/exercise-library/rolling-thunder — form, muscles, hold vs reps.
14. Armlifting USA — Armlifting for Beginners — https://armliftingusa.com/armlifting-for-beginners — implements (Rolling Thunder, Apollon Axle, Saxon Bar), Fat Gripz стартер.
15. Gegns Gym — Armlifting Programs (2026-06-12) — https://gegnsgym.com/armlifting-programs/ — assessment→volume/max/endurance→peaking, beginner/advanced.
16. Alvin Almazov — Что делать если после армрестлинга болит рука/локоть (2026-01-09) — https://alvin-almazov.ru/boxing/chto-delat-esli-posle-armrestlinga-bolit-ruka-ili-lokot-profilaktika-i-lechenie-travm — UCL, tennis elbow, бок на блоке — отказаться, 3 месяца без 100%, разминка 5–10мин + вращения + 2–5 подходов, холод 0.5–2ч.
17. Reddit r/armwrestling — Injury / Supination threads (2024) — https://www.reddit.com/r/armwrestling/comments/1njtdqd/injury_during_arm_wrestling/?tl=ru + https://www.reddit.com/r/armwrestling/comments/of4pz3/what-are-some-good-exercises-to-train-supination/ — баланс pron/sup, Indian clubs 5lbs high-rep.

> Примечание: часть ссылок (grindergym periodization) недоступна (ERR_CONNECTION_CLOSED) — исключена из плана, заменена Power35 + StrengthLog.

---

## 10. Критерии приёмки (Definition of Done)

- [ ] `src/engines/arm/` — 18 файлов, `exercise-catalog-arm.ts` — 35+ упражнений, tsc 0 по новым файлам.
- [ ] `ArmAutoConstructor` — 6 шагов, discipline/technique/grip сегменты, buildArmPlan → finalize → validate, heatmap + warnings, без правок в `bb-*`/`lms-*`.
- [ ] Годовой: `AnnualBlockKind='ARM'`, `buildArmBlock`, hybrid (BB+ARM, PL+ARM) собирается, stale по hash, taper идемпотентен.
- [ ] Дневник/ACWR/PED/lab/nutrition — reuse, без дублей, `armPlanToSessions` в `training-integration`.
- [ ] Тесты: ~150 новых, все зелёные; матрица 576 планов — 0 MRV overflow, 0 humerus violation, 0 balance breach (>1.5×), side ≤ cap.
- [ ] `vite build` OK, полный прогон — только пред-существующие 90 падений (как в AGENTS.md).
- [ ] Нет `require()` в ESM, нет `mrtvor` TODO, все `any` типизированы через `ArmBuilderInput`/`ArmPlan`.

---

## 11. Открытые вопросы (решить на F1)

1. **Отдельный стол-таймер?** — Нужен ли `ArmSessionTimer` (изометрия 10с/30–60с, как `CardioSessionTimer`) уже в MVP или V2? Предлагаем V2, в MVP — `holdSeconds` в `workSets`.
2. **Весовая категория WAF?** — Добавлять ли `weightClass` (−55..+110) в `ArmBuilderInput` для коррекции side pressure (тяжи — больше side)? Предлагаем да, опционально.
3. **Левая/правая рука раздельно?** — WAF делит left/right. В MVP — одна рука + чекбокс «левая», в V2 — две руки с балансом (как BB `delt_front/mid/rear`).
4. **PED для армлифтинга?** — Тот же `adaptForPEDs` или отдельный `grip`-коэффициент? Предлагаем reuse с `tendonCap`.

---

*План подготовлен: web-исследование (17 источников, 2021–2026) + аудит архитектуры (60+ файлов BB/LMS/annual/catalog) — 2026-09-01. Следующий шаг: F0 — создать папку `src/engines/arm/` и начать F1.*
