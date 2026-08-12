# BB-auto: план полной доработки и последующей настройки

Дата фиксации: 2026-08-15
Статус: ядро, UI-интеграция, quality-аудит выполнены (848 тестов); осталась финальная настройка коэффициентов по результатам реальных тренировок

## Выполненные аудиты (последний раунд)

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
