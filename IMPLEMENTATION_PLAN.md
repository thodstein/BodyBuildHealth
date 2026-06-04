# BodyBuildHealth v9 — Итоговый план реализации

## Критические баги и проблемы

### 1. RiskScreen — пустая по сути
- **Матрица system×mechanism**: `sysRaw / 7` — равномерное распределение вместо реальных PD-весов (risk.engine.ts:104)
- **Механизмы НЕ работают**: все 7 механизмов внутри системы показывают одинаковое значение
- **Не использует useDataLink()**: дублирует загрузку данных из IndexedDB (6 других экранов используют)
- **Overtraining**: хардкод (loadRatio=1.2, fatigue=0.3, recovery=0.5) → всегда 31%
- **sysNet объявлена но не используется** (line 100 dead variable)
- **SYNERGY_PAIRS не отображаются нигде**

### 2. PlanScreen — неделающий план
- **buildDayPlan() хардкодит сплиты** (lines 81-91) вместо использования selectSplit()
- **exercise selection**: `.slice(0, 2)` в одном и том же порядке → одно и то же на каждой тренировке
- **Макроцикл не связан с недельным планом**: generateMacrocycle() вызывается отдельно
- **Drop/backoff sets** — только badge, нет протокола (% снижения, повторы)

### 3. SupportScreen — не существует
- SYNERGY_PAIRS (34 пары) определены в support.engine.ts, но НЕ имеют UI
- calculateSupport() считает оптимальный стек, но кнопки "авто-назначить" нет
- SUPPLEMENT_DESCRIPTIONS (50 записей) не отображаются

### 4. Auth — сломан
- Хардкод admin кредов в UI: `auth-module.ts:43` — виден всем
- Локальная регистрация: нет Supabase Auth, только SHA-256+salt в IndexedDB
- При сбросе/обновлении — всё теряется, нет облачного бэкапа
- Слабый пароль: минимум 4 символа
- Нет восстановления пароля

### 5. Nutrition — не учитывает предпочтения
- Нет полей: dietType, allergies, intolerances, excludedFoods, dietRestrictions
- `allergies?: string[]` в типах — мертвая (не UI, не engine)
- FOOD_DB: 75 продуктов, нет тегов аллергенов/диет
- `isTrainDay = true` хардкод в meal-plan engine
- Дублирующая FOOD_DB в nutrition-tracker.engine.ts

### 6. Нейротоксичность
- `neuro_toxicity` определена в PD типах (types.ts:228)
- PHARMA_DB имеет `neuro_toxicity` для некоторых веществ
- Risk.engine PD_SYSTEM_MAP НЕ МАППИТ neuro_toxicity ни в одну систему
- RiskInfo SYSTEM_INFO имеет neuro систему, но в матрице она заполнена через sysRaw/7

### 7. 3D модель
- Процедурная геометрия (сферы/цилиндры) вместо GLTF моделей
- Нет OrbitControls — пользователь не может вращать/зумить
- Нет x-ray/прозрачности для просмотра органов внутри тела
- Organ3D.tsx существует, но не используется

---

## План реализации (по приоритету)

### Фаза 1: Критические фиксы (сделать работающим то что есть)

#### 1.1 RiskScreen — реальные данные
**Файлы**: `RiskScreen.tsx`, `risk.engine.ts`, `data-link.ts`

- Переписать `matrixData` useMemo: использовать `mechanismBreakdown` из calculateRisks вместо `sysRaw/7`
- В `risk.engine.ts`: `calculateRisks` уже заполняет `mechanismBreakdown` — использовать его в RiskScreen
- Перевести RiskScreen на `useDataLink()` — убрать дублирующую загрузку из IndexedDB
- Overtraining tab: взять real data из `linked.readiness` и `linked.trainingLoadRatio`
- Добавить отображение SYNERGY_PAIRS (какие пары поддержки снижают конкретные ячейки матрицы)
- Убрать мёртвую переменную `sysNet`
- Добавить heatmap-визуализацию матрицы 8×7 (системы × механизмы)

#### 1.2 PlanScreen — работающий план
**Файлы**: `PlanScreen.tsx`, `training.engine.ts`, `exercise-catalog.ts`

- `buildDayPlan()`: использовать `bestSplit.groupsPerDay` из selectSplit() вместо хардкода
- Exercise rotation: `weekNumber mod catalogLength` для вариативности
- Макроцикл: передать `adapted.volumeMultiplier` и `adapted.rirRange` в buildDayPlan
- Drop sets: добавить протокол (снижение на 20-30%, 8-10 повторов в дропе)
- Backoff sets: -10% вес, +2 повтора
- Добавить колонку "Восстановление" в таблицу с readiness индексом

#### 1.3 Auth — Supabase интеграция
**Файлы**: `auth-manager.ts`, `auth-module.ts`, `main.tsx`

- Убрать хардкод admin кредов из `auth-module.ts:43`
- Добавить Supabase Auth: `signIn`, `signUp`, `signOut` через `@supabase/supabase-js`
- Локальный fallback: оставить для offline
- Минимальный пароль: 8 символов
- Восстановление пароля через Supabase (email)
- Sync: при логине через Supabase — синкать локальные данные в облако

#### 1.4 SupportScreen — новый экран
**Новый файл**: `SupportScreen.tsx`

- 3 суб-вкладки: Каталог / Синергии / Рекомендации
- Каталог: SUPPLEMENT_DESCRIPTIONS (50 записей), EC50, дозировки, исследования
- Синергии: SYNERGY_PAIRS визуализация (граф/матрица пар), фильтрация по типу
- Рекомендации: calculateSupport(context) → before/after риски, кнопка "Применить"
- Навигация: заменить текущую 8-ю вкладку "Поддержка"

---

### Фаза 2: Данные пользователя

#### 2.1 Diet preferences — типы и UI
**Файлы**: `types.ts`, `profile-manager.ts`, `ProfileScreen.tsx`

Добавить в `UserProfile.settings`:
```typescript
dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
foodAllergies?: string[];     // ['dairy','gluten','soy','eggs','fish','shellfish','tree_nuts','peanuts']
foodIntolerances?: string[];  // ['lactose','fructose','histamine','sorbitol']
excludedFoods?: string[];     // food IDs from FOOD_DB
preferredFoods?: string[];    // food IDs from FOOD_DB
dietRestrictions?: string[];  // ['halal','kosher','no_pork','no_alcohol']
cookingSkill?: 'none' | 'basic' | 'intermediate' | 'advanced';
mealsPerDay?: number;
```

Добавить в `FoodItem` (nutrition-database.ts):
```typescript
allergens?: string[];         // ['dairy','gluten','soy','eggs','fish','shellfish','tree_nuts','peanuts']
isVegetarian?: boolean;
isVegan?: boolean;
isGlutenFree?: boolean;
isDairyFree?: boolean;
dietTags?: string[];          // ['keto','paleo','halal','kosher']
```

ProfileScreen: новая вкладка "Питание" с:
- Diet type selector (иконки + названия)
- Allergies multi-select (теги)
- Intolerances multi-select
- Exclude/include individual foods (поиск из FOOD_DB)
- Meals per day slider

#### 2.2 Nutrition — preference-aware engine
**Файлы**: `nutrition.engine.ts`, `nutrition-meal-plan.engine.ts`, `nutrition-database.ts`

- `calcNutrition()`: принимать `dietType`, `allergies`, `excludedFoods`
- `generateDayMealPlan()`: фильтровать FOOD_DB по предпочтениям
- `searchFood()`: добавить опции `excludeIds`, `dietType`, `allergens`
- `generateStructuredAdvice()`: исключить аллергены из рекомендаций
- Удалить дублирующую FOOD_DB из `nutrition-tracker.engine.ts`
- `isTrainDay = true` → реальное определение (из макроцикла или календаря)
- `trainingTime` → реальное использование для тайминга приёмов пищи

#### 2.3 Расширение FOOD_DB
**Файл**: `nutrition-database.ts`

Добавить 100+ продуктов:
- Мясо: говядина (different cuts), свинина, баранина, курица целиком, утка, индейка
- Рыба: минтай, треска, горбуша, кета, палтус, скумбрия, сельдь, форель
- Крупы: перловка, пшено, кускус, булгур, киноа (extended)
- Молочные: творог 0%/2%/5%/9%, ряженка, простокваша, сыры (чеддер, пармезан, моцарелла)
- Овощи: все виды капусты, тыква, репа, редис, шпинат extended
- Фрукты: дыня, манго, хурма, финики

Каждый с: allergens, isVegetarian, isVegan, isGlutenFree, isDairyFree, dietTags, micros, gi, timing, bestFor

---

### Фаза 3: Тренировки

#### 3.1 Sport-specific splits
**Файлы**: `split-selector.engine.ts`, `exercise-catalog.ts`

Добавить сплиты:
- Армрестлинг: grip/forearm приоритет, специальные упражнения
- Женский бодибилдинг: lower body focus
- Пауэрлифтинг: squat/bench/deadlift специализация (Sheiko-подобный)
- Тяжёлая атлетика: snatch/clean&jerk + accessory
- Кроссфит: WOD-формат

Добавить упражнения (50+):
- Армрестлинг: wrist curl, reverse wrist curl, pronation, supination, farmer's walk, dead hang
- Пауэрлифтинг: pause squat, board press, block pull, SSB squat, banded deadlift
- Олимпийская тяга: overhead squat, snatch pull, clean pull, jerk dip, muscle snatch
- Аксессуары: face pull, Y-raise, Cuban press, Pallof press, landmine press

`Exercise.sport?: string[]` — фильтрация по виду спорта

#### 3.2 Advanced techniques
**Файлы**: `exercise-catalog.ts`, `training.engine.ts`, `PlanScreen.tsx`

Добавить в `Exercise` interface:
```typescript
supersetWith?: string;        // exercise ID to superset with
restPause?: boolean;           // rest-pause technique
forcedReps?: number;           // forced rep count at end
negativeReps?: boolean;        // slow eccentric emphasis
clusterSets?: { repsPerCluster: number; restBetweenClusters: number }; 
myoReps?: { activationReps: number; miniSetReps: number; restSeconds: number };
giantSet?: string[];           // exercise IDs in giant set
mechanicalDropScheme?: string; // 'narrow_to_wide' | 'wide_to_narrow' | 'grip_change'
```

UI: выбор техники в настройках, отображение протокола в плане

---

### Фаза 4: Качество и чистота

#### 4.1 Eliminate duplication
- RiskScreen и LabsScreen → перевести на `useDataLink()`
- Единые `SYSTEM_LABELS` в `risk-info.ts`
- LabsScreen: объединить 3 формы ввода в 2 (OCR/Paste + Structured)
- Единая `createLabPoint()` функция
- Единый `getRatioColor()` helper
- Удалить `risk-calculator.engine.ts` (слишком примитивный, risk.engine.ts авторитетный)
- Удалить дублирующую FOOD_DB из `nutrition-tracker.engine.ts`

#### 4.2 Формулы — проверить и настроить
- `calcNutrition()`: добавить обработку goal='recomp' (+100 kcal) — сейчас fallthrough
- `calcNutrition()`: использовать `NutritionInput.kcal/p/f/c` overrides — объявлены но не используются
- `calcTraining()`: проверить формулу volume — слабые точки получают 1.2x но остальные не перераспределяются корректно
- PAL formula: `1.2 + wpw * 0.075 + bonuses` — проверить clamps
- Readiness formula: проверить все 10+ входных весов
- `generateDayMealPlan()`: убрать хардкод `whey_protein` post-workout, использовать preference-aware selection
- `generateMacroCycle()`: проверить mesocycle progression logic

#### 4.3 Нейротоксичность
- Проверить `PHARMA_DB` записи: у каких веществ заполнен `neuro_toxicity`
- В `risk.engine.ts` PD_SYSTEM_MAP: добавить маппинг `neuro_toxicity` → `neuro` систему
- В `SUPPORT_BASE_COVERAGE`: проверить есть ли нейропротективные покрытия (semax, selank, noopept)
- В RiskScreen mechanisms tab: убедиться что neuro показывается с реальными данными

#### 4.4 3D модель улучшения
- Добавить `OrbitControls` из Three.js (import from 'three/examples/jsm/controls/OrbitControls')
- Auto-rotation становится опциональной (вкл/выкл кнопка)
- X-ray режим: прозрачность тела увеличивается до 0.15 при наведении на систему
- Zoom: scroll wheel
- Улучшить формы органов (использовать LatheGeometry для более точных форм)
- Добавить подписи при наведении organ tooltip с риском%

---

### Фаза 5: Полноценная детализация рисков

#### 5.1 Details tab в RiskScreen
**Файлы**: `RiskScreen.tsx`

- Добавить вкладку "Детализация" для демонстрации прозрачности расчета рисков
- Показать как числа рассчитываются, какие штрафные коэффициенты применяются и как агрегируются все источники рисков
- Использовать только существующие state variables (без helper functions)
- Все UI тексты на русском языке
- Темная тема с зеленым акцентом (#00e68a)

**Структура:**
1. **Общий риск** - сравнение сырого и нетто риска с показателем снижения
2. **Штрафные коэффициенты** - детализация лабораторных анализов и исследований
3. **Вклад анализов** - 4x4 grid с рисками по системам
4. **Вклад препаратов** - топ-4 препаратов по вкладу в риск
5. **Покрытие поддержкой** - прогресс-бар и процент покрытия

**Технические детали:**
- Использован React Fragment для обертки JSX элементов
- Исправлены типы: RiskTab расширен для 'details'
- Исправлена ошибка с type coercion (labPct: number вместо string)
- Исправлен символ × (использован {\'×\'})

**Валидация:**
- ✅ TypeScript проверка: `npx tsc --noEmit` (ошибки только в других файлах)
- ✅ Vite сборка: `npx vite build` (успешно)
- ✅ Локальный сервер: `http://localhost:3000` (работает)

---

## Порядок выполнения

| # | Задача | Приоритет | Файлов |
|---|--------|-----------|--------|
| 1 | **RIR Matrix Engine + Weekly Progression** | **P0** | **rir-matrix.engine, training.engine** |
| 2 | RiskScreen: реальные механизмы + useDataLink | P0 | RiskScreen, risk.engine, data-link |
| 3 | PlanScreen: selectSplit + rotation + macrocycle sync | P0 | PlanScreen, training.engine, exercise-catalog |
| 4 | Auth: убрать хардкод, Supabase auth | P0 | auth-manager, auth-module, main |
| 5 | SupportScreen: каталог + синергии + рекомендах | P0 | SupportScreen (new), data-link, App |
| 6 | Diet preferences: типы + UI + движок | P1 | types, profile-manager, ProfileScreen, nutrition |
| 7 | FOOD_DB: расширение + аллергены | P1 | nutrition-database |
| 8 | Nutrition: preference-aware selection + cycling | P1 | nutrition.engine, nutrition-meal-plan |
| 9 | Нейротоксичность: маппинг + данные | P1 | risk.engine, pharma-database, constants |
| 10 | Устранение дубляжей | P2 | все экраны |
| 11 | 3D модель: OrbitControls + x-ray | P2 | HumanBody3D |
| 12 | Sport splits + exercise catalog | P2 | split-selector, exercise-catalog |
| 13 | Advanced training techniques | P2 | types, exercise-catalog, PlanScreen |
| 14 | **RiskScreen: Details tab** | **P0** | **RiskScreen** |