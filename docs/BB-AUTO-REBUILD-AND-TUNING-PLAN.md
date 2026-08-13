# BB-auto: план полной доработки и последующей настройки

Дата фиксации: 2026-08-15
Статус: ВСЕ ЭТАПЫ ВЫПОЛНЕНЫ (870 тестов, 2026-08-13). Этапы 2/4 (подгруппы рук по головкам), 10 (тюнинг коэффициентов), 11 (тестовая матрица), 12 (Definition of Done) завершены. Остаётся только настройка по результатам реальных тренировок.

## РАУНД 2 — специализация, ноги 2x/нед, cap 5 сетов, баланс спины, качество малых групп (2026-08-13)

### A. Специализация и слабые мышцы (структурирование)
- Сейчас weak/focus дают только множитель объёма (x1.2/x1.3) без логики выбора упражнений.
- Реализовать: маппинг слабой подгруппы -> приоритетные паттерны/упражнения (chest_upper -> incline, back_width -> vertical+lat, quads -> squat+leg press и т.д.); гарантированное включение слабой подгруппы в каждую релевантную сессию; приоритет в сортировке; спец-резерв объёма с покрытием паттерна, а не просто больше сетов.
- Учитывать: мезоцикл (фаза), источник (Generic/ПРОФ-цикл/Библиотека), общий объём, PED, стаж, параметры пользователя, методику тренировки.

### B. Ноги 2x/нед (PPL, 8-дневный, UL и др.)
- День 1: тяжёлый quads (compound squat) + памповый hamstrings (leg curl/румынская лёгкая).
- День 2: тяжёлый hamstrings (RDL/гудморнинг) + памповый quads (leg extension/жим ногами лёгкий).
- quads: второй compound-паттерн предпочтительно ЖИМ НОГАМИ (leg press), не второй присед.
- hamstrings: второй паттерн предпочтительно leg curl (если первый RDL) или RDL (если первый leg curl) — без дубля одного движения.

### C. Про-уровень: максимум 5 сетов на упражнение
- 6-8 сетов в одном упражнении недопустимы: max 5, остаток добивается дополнительным упражнением (другой паттерн/угол).

### D. Спина: баланс width/thickness
- Широчайшие (width: vertical pull + lat isolation) и толщина (thickness: heavy/supported/unilateral rows) не должны быть в большом дисбалансе (>2:1 в любую сторону), если не указана слабая подгруппа.
- Распределение: тяжёлая горизонтальная тяга + 1 vertical + 1 лат-изоляция + поддержка толщины.

### B2. ВЕРИФИКАЦИЯ тяж/памп и связок мышц (по реальным про-правилам)

Проверено по источникам проекта (Schoenfeld 2010/2016 — 3 механизма гипертрофии: механическое напряжение, метаболический стресс [памп], повреждение; Israetel RP Strength — heavy/pump дни при частоте 2x/нед; классические Weider-сплиты). ВСЕ правила подтверждены и приняты:

- **Чередование тяж/памп для про**: день A — тяж (compound 4-5 сетов x 6-10, RIR 1-2, механическое напряжение); день B — памп (изоляции 3-4 x 12-18, RIR 3, метаболический стресс). Применяется к груди, спине, плечам и рукам при частоте 2x/нед.
- **Ноги: ведущая группа всегда ТЯЖ**: день A — тяж quads (присед/жим ногами 5x6-10) + памп hams (сгибания 4x12-18); день B — тяж hams (RDL/гудморнинг 5x6-10) + памп quads (разгибания 4x12-18). glutes: тяж hip thrust в день A, памп-отведение в день B.
- **Связки мышц** (подтверждены, уже реализованы): средняя дельта + грудь (Push), задняя дельта + спина (Pull, face pull), бицепс + спина (Pull), трицепс + грудь (Push).
- **quads 2-й паттерн = жим ногами** (не второй присед); hams 2-й паттерн = leg curl (если первый RDL) или RDL (если первый leg curl).

### E. Качество выбора упражнений для малых групп (руки, плечи, трапеции, икры)
- Проверить объёмы по уровням (natural/enhanced x стаж) и PED-тирам; объёмы не сокращать.
- Улучшить качество построения: stretch-позиции (растянутая), pump-нагрузка, разнообразие паттернов, покрытие головок.
- Икры: подъёмы с растянутой позицией (стоя/в наклоне) + сидячие; трапеции: шраги с задержкой (stretch) + Келсо при бюджете.

## РАУНД 3 — MEV-guard по сессиям, 0 overflow, feeder-интеграция (2026-08-14)

- **MEV-guard по СЕССИЯМ** (не упражнениям): sessionsWith считает сессии с мышцей — guard back 7 вместо 2; фит не резал ниже MEV.
- **Глобальный cap 5 сетов/упражнение** в finalize (source-планы несли 8+ сетов из исходника); per-exercise минимум 2.
- **Защита стимула**: последнее упражнение мышцы на повышенном MEV-флоре не удаляется; isFinite-фильтр removable-кандидатов.
- **Повторный MRV-кап ПОСЛЕ fill** (builder-кап был до finalize; fill/ensureSmall добавляли сверх).
- **Малые группы в FullBody**: calves (6+4 при 1 сессии), traps (5-6), forearms, abs (до 5); при лимите упражнений — замена accessory другой мышцы с дублем.
- **Indirect смягчён** (EMG): triceps 0.45, glutes 0.45, shoulders 0.2 — убраны пограничные overflow fullbody/rolling/tpt.
- **Feeder-интеграция** (остаток MAX-PLAN): максимум 2 слота/мышцу (4+3 вместо 2+2+2), скип дублей с builder-feeder.
- **Итог: 0 MRV-overflow / 125 комбинаций (5 профилей x 25 сплитов); 875/875 тестов.**
- Остаточные дефициты — честные info (лимиты natural 24/10: MEV-сумма 62 > 48; осознанное правило).

## Выполненные аудиты (последний раунд)

- **Этапы 2/4 — подгруппы рук**: classifyArmExercise/annotateArmExercise (biceps_lengthened/shortened/hammer, triceps_overhead/pushdown/compound, forearm); ensureArmHeadCoverage заменяет изоляцию на растянутую позицию бицепса / overhead трицепса (уважает equipment); rationale «💪 Руки по паттернам» + armQualityIssues.
- **Этап 10 — тюнинг**: fill добирает calves/abs/traps/forearms во всех сплитах (natural — без дублей, лимиты 10/18 упр и 24/60 сетов соблюдены); допуск MRV-overflow ×1.15 (паритет plan-validator); biceps/triceps в PRO_KEYS; кап-множители рук 3+/6+/8+ = 1.3/1.6/1.8; недельный кап ног × частоту сессий; indirect biceps 0.5→0.4. Итог: 102 комбинации профиль×сплит — 0 ложных overflow.
- **Этап 11 — тестовая матрица**: bb-plan-matrix-coverage (недельный back ≥36, arms indirect, малые группы в 5 сплитах, natural без enhanced-лимитов); bb-arm-quality (5 тестов).
- **Этап 12 — DoD**: все пункты проверены — 4 маршрута через единый finalizer/quality gate; back-сессия не теряется ни в одном из 10 сплитов; руки учитывают indirect; ноги разделены; natural без pro-лимитов; enhanced зависит от стажа/recovery; отчёт/валидация совпадают с фактическими упражнениями; 870 тестов без регрессий.

- **Порядок упражнений**: muscleGroup в rankKey идёт ДО weak-priority — слабые группы/специализация больше не разбивают сессии (quads→hamstrings→quads исправлено). После allocation-функций в finalize выполняется повторная сортировка (только order, без cap).
- **Отчёт качества**: валидатор использует level-aware лимиты (enhanced 3+ = 60/18, natural = 24/10); weeklyVolume пересчитывается ДО валидации (фикс ложных target_volume_deficit); muscle_attribution не срабатывает для изоляций; builder-предвалидация не дублирует deficit-warnings.
- **Мусорный объём**: detectGarbageVolume исключает warmup, использует функциональную back-классификацию (vertical_pull объединяет подтягивания/блоки), не флагает compound-паттерны (разные углы — норма), флагает только повторные изоляции per-muscle; «Гребной тренажёр» классифицируется как supported_row.
- **Разминка**: warmup-активатор (3×10-15 лёгких) в каждой целевой сессии, не входит в объём/бюджет, добавляется после всех проходов.

## Цель

Довести все три источника BB-auto и четыре фактических режима до согласованного тренерского pipeline:

1. Generic-сплит.
2. Прямой ПРОФ-цикл.
3. Библиотечная программа в режимах `faithful` и `adapt`.

Главный критерий: программа должна распределять не только количество сетов, а качественный недельный объём по мышцам, функциональным подгруппам, паттернам, частоте, восстановлению и доступному опыту атлета.

## Зафиксированные требования по объёму

Ориентиры относятся к прямым рабочим сетам, а не к сумме всей сессии:

| Профиль | Спина, прямые сеты/неделю |
|---|---:|
| Beginner | 10–16 |
| Intermediate | 16–24 |
| Advanced natural | 22–32 |
| Advanced enhanced | 28–40 |
| Pro/enhanced 6+ лет | 36–50 |
| Специализация спины | 42–60 |

Это диапазоны, а не безусловная выдача верхнего значения. Фактический target определяется стажем, PED-статусом, recovery, калоражем, предыдущей переносимостью и прогрессом.

Для опытного enhanced-профиля с двумя полноценными back-сессиями базовый benchmark:

```text
Back A: 20–24 прямых сета
Back B: 20–24 прямых сета
Итого: 40–48 прямых сетов
```

## Этап 1. Единая модель профиля атлета

Добавить/свести в один нормализованный вход:

- `trainingYears`;
- подтверждённый performance level;
- natural/enhanced status;
- PED и дозы;
- recovery tier: сон, HRV, стресс, fatigue, ACWR;
- bodyWeight/bodyFat/leanMass;
- калораж и белок;
- история предыдущего объёма;
- фактический прогресс по движениям;
- weak points и specialization;
- capability для bodyweight-упражнений.

Правило конфликта:

```text
подтверждённый стаж/результаты ограничивают level;
PED увеличивает потенциальный запас, но не превращает новичка в pro;
recovery ограничивает текущий рабочий target;
специализация перераспределяет объём, а не просто добавляет его сверху.
```

## Этап 2. Единая модель мышечных подгрупп

Сохранить старые агрегаты для совместимости, но планировать по подгруппам.

### Спина

```text
back_width
back_thickness
upper_back
rear_delts
traps
erectors
```

### Ноги

```text
quads
hamstrings
glutes
calves
```

### Грудь/плечи

```text
chest_upper/chest_mid/chest_lengthened
delt_front/delt_mid/delt_rear
```

### Руки — обязательное добавление в пункт 4 и отдельный контроль

```text
biceps_long_head
biceps_short_head
brachialis/forearms
triceps_long_head
triceps_lateral_medial
forearms
```

Для рук обязательно учитывать:

- прямые сеты;
- косвенные сеты от жимов и тяг;
- положение плеча;
- overhead и pushdown-паттерны;
- стабильную прогрессию нагрузки;
- локтевую/сухожильную fatigue cost;
- weak-point приоритет.

Нельзя делать:

```text
много жимов + много тяг
→ полный объём трицепса и бицепса сверху
→ arm-guarantee добавляет ещё фиксированные сеты
```

Нужно:

```text
если overlap уже закрывает target — прямые сеты снижаются;
если руки weak point — выделяется отдельный резерв и он проходит общий fatigue/MRV gate.
```

## Этап 3. Единый weekly volume prescription

Создать единый расчёт target до выбора упражнений.

Для каждой подгруппы хранить:

```ts
{
  mev,
  mavLow,
  mavHigh,
  mrv,
  targetSets,
  directTarget,
  effectiveTarget,
  maxSetsPerSession,
  frequency
}
```

Порядок расчёта:

1. landmarks по подтверждённому опыту;
2. natural/enhanced adjustment;
3. recovery/nutrition/lab adjustment;
4. goal adjustment;
5. weak-point/specialization redistribution;
6. previous-plan progression;
7. распределение по сессиям;
8. контроль indirect/effective volume;
9. только затем выбор упражнений.

Recovery и nutrition должны менять target, а не только поздний MRV-cap.

## Этап 4. Unified exercise planner: грудь, плечи и руки

После спины отдельно переработать:

### Грудь

- верх/середина/растянутая позиция;
- тяжёлый жим;
- стабильный machine/Smith press;
- fly/cable в растянутой и сокращённой позиции;
- запрет бессмысленных повторов одного жима.

### Плечи

- front delts считать с учётом жимов;
- side delts получать отдельный direct budget;
- rear delts не смешивать с back volume;
- не давать overhead press поверх уже чрезмерного жимового fatigue без причины.

### Руки

#### Biceps

- один movement на длинную головку в растянутой позиции;
- один neutral/hammer movement для brachialis;
- один стабильный curl в сокращённой позиции при наличии бюджета;
- косвенный объём от vertical/horizontal pulls вычитается из direct target.

#### Triceps

- overhead extension для long head;
- pushdown/pressdown для lateral/medial heads;
- close-grip press/dips только при наличии отдельного силового бюджета;
- косвенный объём от bench/OHP учитывается до добавления прямых сетов.

#### Forearms

- не выдавать полноценный объём автоматически после большого объёма тяг и curls;
- хват/предплечья считать как secondary contribution;
- отдельный приоритет только при weak point.

Правило: сначала качественные паттерны, затем сеты, а не «больше упражнений потому что enhanced».

## Этап 5. Распределение по сессиям

Гарантировать, что недельный budget не застревает в первой сессии.

### Спина

Каждая полноценная back/Pull/Upper-сессия experienced enhanced должна иметь:

- минимум 18–22 прямых сета согласно профилю;
- минимум 3–5 функциональных паттернов;
- horizontal row;
- только один основной vertical pull;
- lat isolation/upper-back slot при наличии бюджета.

### Руки

Распределять direct arm volume между Push/Pull/Arms/Upper с учётом косвенной нагрузки:

```text
Push → triceps residual budget
Pull → biceps residual budget
Arms → отдельная direct session при выбранном сплите
```

Не добавлять руки ежедневно только из-за TAG_MUSCLES.

## Этап 6. Fatigue и общий session budget

Разделить:

- `maxSessionSets`;
- `maxMuscleSetsPerSession`;
- `maxDirectSetsPerWeek`;
- `maxEffectiveSetsPerWeek`;
- `maxFatigueWeightedSets`;
- `maxTime`;
- `maxAxial`;
- `maxJoint/elbow/shoulder stress`.

Для experienced enhanced допустим больший общий session cap, но он не должен автоматически разрешать перегруз рук/локтей.

Обрезка должна идти в порядке:

1. дублирующий паттерн;
2. redundant isolation;
3. feeder/finisher;
4. secondary sets;
5. только затем — качественный primary, если превышен muscle-specific cap.

Нельзя просто удалять хвост массива и нельзя защищать все `primary` одинаково.

## Этап 7. Generic, ПРОФ и Library/adapt

### Generic

Полная генерация через единый volume/session/exercise planner.

### ПРОФ faithful

Сохраняет исходную структуру. Делает только явно разрешённые safety-преобразования и выдаёт аудит:

- недобор/перебор объёма;
- дубли паттернов;
- частота;
- bodyweight suitability;
- back/legs/arms coverage.

### ПРОФ adapt

Перестраивает объём, частоту, упражнения, weak points, руки, спину, ноги и recovery под единый planner.

### Library faithful

Не применять скрытые PED/eccentric/volume changes. Все замены записывать в audit trail.

### Library adapt

Использовать единый planner, а не только добавлять fixed finisher sets.

## Этап 8. Bodyweight capability

Добавить:

```ts
pullUpsStrict
chinUpsStrict
dipsStrict
pushUpsStrict
weightedPullUpLoad
assistedPullUpLoad
```

Правила:

- нет capability → не ставить pull-up как primary;
- выбирать assisted pull-up/pulldown;
- масса тела влияет на применимость, а не только на recovery;
- pull-up и близкий pulldown не дублировать в одной сессии без фокуса.

## Этап 9. Quality gate

Проверять финальный план после всех post-processing passes.

### Спина

- direct/effective/fatigue sets по подгруппам;
- width/thickness/upper-back coverage;
- vertical/horizontal ratio;
- одинаковые паттерны;
- frequency и recovery interval;
- bodyweight suitability.

### Руки

- direct/effective biceps;
- direct/effective triceps;
- long/short head coverage;
- indirect overlap от жимов/тяг;
- локтевой fatigue;
- отсутствие ежедневного arm-volume без специализации.

### Общие проверки

- дни и недели;
- MEV/MAV/MRV;
- volume target vs actual;
- fatigue/time/axial;
- equipment/injury;
- порядок;
- faithful/adapt contract;
- сохранность метаданных после export/save.

## Этап 10. Последующая настройка после завершения ядра

Настройка выполняется только после прохождения всех baseline-тестов. Иначе коэффициенты будут конфликтовать.

### Порядок настройки

1. Зафиксировать zero-state snapshots для всех четырёх маршрутов.
2. Проверить natural beginner/intermediate/advanced.
3. Проверить enhanced 1–3, 3–6 и 6+ лет.
4. Проверить recovery high/medium/low.
5. Проверить mass/cut/recomp/maintenance.
6. Проверить обычную группу и specialization.
7. Проверить PED dose tiers.
8. Проверить 1/2/3 back-сессии.
9. Проверить руки с высоким indirect overlap.
10. Только после этого менять диапазоны и коэффициенты.

### Правило изменения коэффициентов

За один tuning pass менять только одну группу параметров:

```text
volume → tests → review;
frequency → tests → review;
fatigue → tests → review;
exercise slots → tests → review.
```

Не менять одновременно PED multiplier, session cap, exercise count и MRV cap: невозможно определить источник регрессии.

### Приоритеты конфликтов

Приоритеты должны быть фиксированными:

1. injury/equipment/bodyweight safety;
2. структура обязательных паттернов;
3. minimum viable volume;
4. target volume;
5. specialization/weak-point reserve;
6. PED expansion;
7. optional intensity techniques;
8. rotation/variety.

Если два правила конфликтуют, применяется правило с более высоким приоритетом, а причина записывается в rationale.

### Запреты против конфликтов

- faithful не вызывает adaptive volume allocation;
- PED не меняет exercise count до закрытия обязательных паттернов;
- feeder не добавляется после финального MRV без повторной проверки;
- arm-guarantee не обходится вокруг effective-volume бюджета;
- taper/deload не применяются дважды;
- high-volume cap не применяется к natural;
- bodyweight replacement не меняет значение `weight` как внешний вес без явной семантики.

## Этап 11. Тестовая матрица готовности

Обязательно покрыть:

- все 24 Generic split patterns;
- PPL/Pull/Upper/FullBody;
- ПРОФ-cycle faithful/adapt;
- Library faithful/adapt;
- natural и enhanced по стажу;
- спина, ноги, грудь, плечи и руки;
- PED dose tiers;
- recovery/nutrition/goal;
- weak/focus/specialization;
- injuries/equipment/avoid axial;
- bodyweight capability;
- deload/taper;
- save/load/export/runtime.

Минимальные quality assertions:

```text
experienced enhanced, 2 back sessions:
  каждая сессия >= 18 direct back sets;
  минимум 3 функциональных back patterns;
  не больше 1 vertical_pull в сессии;
  недельный back budget >= 36;

arms:
  indirect overlap учитывается;
  arm guarantee не превышает target/fatigue;

faithful:
  нет adaptive additions;
  source changes только через audit trail.
```

## Этап 12. Definition of Done

Работа завершена только когда:

- все четыре маршрута используют одинаковую модель объёма и quality gate;
- Generic/PPL/Upper/FullBody не теряют back-сессию;
- руки учитывают indirect overlap;
- ноги разделены на quads/hamstrings/glutes/calves;
- грудь и плечи не создают duplicate volume;
- faithful не переписывается скрыто;
- adapt действительно адаптирует структуру;
- natural не получает pro/high-volume лимиты;
- enhanced-объём зависит от стажа и recovery;
- финальные metrics/report/validation совпадают с фактическими упражнениями;
- после всех tuning passes полный test suite проходит без регрессий.
