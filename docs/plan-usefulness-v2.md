# ПЛАН РЕАЛИЗАЦИИ: Калькулятор полезности v2 + Единый каталог

**Дата:** 26.06.2026
**Задачи:** 72 | **Файлов:** 13 | **Дней:** ~15

---

## ПРАВИЛО 0: Текущий функционал НЕ ЛОМАЕМ

- `product-usefulness.engine.ts` — не трогаем (старый движок)
- `ProductUsefulnessPlanner.tsx` — структура 4 вкладок не трогаем
- `IndividualPlanContext.tsx` — `generatePlan`, `buildDay`, `renderMealList` не трогаем
- `IndividualPlanResults.tsx` — существующие кнопки/модалки не трогаем
- Новый движок — отдельный файл `product-usefulness-v2.engine.ts`
- Интеграция — аддитивная: добавляем вызовы, не заменяем

---

## АРХИТЕКТУРА

```
nutrition-database.ts ← ЕДИНЫЙ КАТАЛОГ (AdvancedProductCard, 78 полей)
         ↓
product-usefulness-v2.engine.ts ← ЕДИНЫЙ ДВИЖОК (BB Score + Overall Score + Meal Score + 14 модулей)
         ↓
   ┌────┴────┐
   ↓         ↓
IndividualPlan        ProductUsefulnessPlanner.tsx
(основной              (лаборатория — переключается
планировщик)            на v2-движок)
```

---

## ЭТАП 0: Единый каталог + BB Score (2 дня)

| # | Задача | Файл |
|---|--------|------|
| 0.1 | Расширить `FoodItem` → `AdvancedProductCard` (78 полей) | `nutrition-database.ts` |
| 0.2 | macro_100g: +proteins_animal/plant, fats_mono/poly, omega_3/6_mg, mct_oil_g, cholesterol_mg, carbs_sugar | `nutrition-database.ts` |
| 0.3 | amino_acid_profile_100g: leucine—histidine, cysteine (10+ полей) | `nutrition-database.ts` |
| 0.4 | electrolytes_100g: +K, Mg, Ca, P, PRAL | `nutrition-database.ts` |
| 0.5 | vitamins_100g: A, C, D, E, K, B1-B12, B7 (13 полей) | `nutrition-database.ts` |
| 0.6 | trace_elements_100g: Fe общее+гемовое, Zn, Se, Cu, Mn, I, Cr (8 полей) | `nutrition-database.ts` |
| 0.7 | bioactive_compounds_100g: креатин, бета-аланин, таурин, лигнаны, I3C (5 полей) | `nutrition-database.ts` |
| 0.8 | gastro_tags: FODMAP, enzyme_demand, gastric_speed, allergen_flags, gut_irritant (5 полей) | `nutrition-database.ts` |
| 0.9 | metabolic_flags: 13 полей | `nutrition-database.ts` |
| 0.10 | specific_compounds_100g: 11 полей | `nutrition-database.ts` |
| 0.11 | bb_quality_score: предрассчитать для каждого продукта | `nutrition-database.ts` |
| 0.12 | Заполнить ТОП-30 продуктов эталонной матрицы | `nutrition-database.ts` |
| 0.13 | Заполнить остальные ~170 продуктов | `nutrition-database.ts` |

## ЭТАП 1: Движок v2 — интерфейсы + BB Score (1.5 дня)

| # | Задача | Файл |
|---|--------|------|
| 1.1 | `UserDietProfile` (блоки А/Б/В/Г) | `product-usefulness-v2.engine.ts` |
| 1.2 | `calcBBQualityScore(product)` | `product-usefulness-v2.engine.ts` |
| 1.3 | `scoreAllProductsV2(opts, profile)` | `product-usefulness-v2.engine.ts` |
| 1.4 | `compareProductsV2(ids, profile)` | `product-usefulness-v2.engine.ts` |

## ЭТАП 2: Overall Dietary Score — 4 шага (2 дня)

| 2.1-2.5 | applyPhaseModifiers, applyPharmacologyModifiers, applyLabModifiers, applyTimingModifiers, calculateOverallScore | `product-usefulness-v2.engine.ts` |

## ЭТАП 3: Meal Score + DIAAS + Оптимизатор (1.5 дня)

| 3.1-3.5 | calcMealScoreV2, calcDIAAS, calcDIAASForMeal, recommendReplacements, suggestProductsForGoal | `product-usefulness-v2.engine.ts` |

## ЭТАП 4: Суточные модули (1.5 дня)

| 4.1-4.15 | 14 модулей + analyzeDailyDiet | `product-usefulness-v2.engine.ts` |

## ЭТАП 5-6: UI профиля + Каталог + Карточки (2.5 дня)

| 5.1-6.4 | Профиль (Блоки А-Г), Карточка рейтинга (7.1.1), Каталог с BB+Overall, Умный фильтр | `ProductUsefulnessPlanner.tsx` |

## ЭТАП 7: Тарелка дня + IndividualPlan (1.5 дня)

| 7.1-7.7 | DailyDietDashboard, Meal Score в тарелке, Финализатор КБЖУ ±3%/±4% | `IndividualPlanResults.tsx`, `DailyDietDashboard.tsx` |

## ЭТАП 8-10: Аналитика + Трекер + Нутрициолог (3 дня)

| 8-10 | HealthAnalytics, ProgressTracker, NutriAdvisor, Избранное, Свои продукты, Визуализатор, Быстрое прикрепление | 7 новых компонентов |

## ЭТАП 11: Геймификация (опц.)

| 11.1-11.3 | Достижения, квесты, уведомления | 3 компонента |

---

## НОВЫЕ ФАЙЛЫ (8 шт)

```
src/engines/product-usefulness-v2.engine.ts
src/ui/screens/NutritionScreen_parts/DailyDietDashboard.tsx
src/ui/screens/NutritionScreen_parts/HealthAnalytics.tsx
src/ui/screens/NutritionScreen_parts/ProgressTracker.tsx
src/ui/screens/NutritionScreen_parts/NutriAdvisor.tsx
src/ui/screens/NutritionScreen_parts/CustomProducts.tsx
src/ui/screens/NutritionScreen_parts/MealVisualizer.tsx
src/ui/screens/NutritionScreen_parts/Achievements.tsx
```

## ИЗМЕНЯЕМЫЕ ФАЙЛЫ (5 шт)

```
src/core/nutrition-database.ts
src/ui/screens/NutritionScreen_parts/ProductUsefulnessPlanner.tsx
src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanResults.tsx
src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx
src/engines/product-usefulness.engine.ts (пометить как deprecated)
```

## ПРАВИЛА ИНТЕГРАЦИИ КНОПОК

| Кнопка | После v2 |
|--------|----------|
| `✨ Сгенерировать план` | + приоритет продуктам с OverallScore ≥6.0 |
| `🍽️ Заменить приём` | + пересчёт Meal Score v2 после замены |
| `🔄 Заменить` (продукт) | + приоритет продуктам с более высоким Overall Score |
| `📊 Автокоррекция` | + не урезать высокорейтинговые продукты |
| `🍔 Читмил`/`🍚 Загрузка`/`БУЧ` | + пересчёт Meal Score v2 |
| `💡 Рекомендации` | + данные из v2 (ключевые факторы, дефициты) |
| `🛒 В корзину` | + цветовая метка рейтинга |
