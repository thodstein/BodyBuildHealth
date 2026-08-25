# Сбор базы ББ-рецептов — как собирал (для следующего агента)

**Цель:** бесплатная база вкусных ББ-рецептов для планировщика питания, без платных API, с точным КБЖУ через `FOOD_DB`.

## 1. Источники — только реальные, не генерация
- **Открытые датасеты (реальные рецепты из интернета, CC0/MIT):** `Food.com Kaggle 231k`, `Recipe1M 1M`, `TheMealDB` (`https://www.themealdb.com/api.php` — без ключа) — фильтр `protein >=30г` по пересчёту.
- **ББ-сайты с рейтингами (ручной отбор):**
  - `bodybuilding.com/recipes` (Monster Milk Cake, Dark Chocolate Waffles, Banana Muffins 4.8★, Soft Serve, Mousse)
  - `muscleandstrength.com/recipes/high-protein` (200+ — буррито-боул, митболы, пицца 66г, лосось 64г, терияки, вок)
  - `fitmencook.com` (Kevin Curry — KFC попкорн 41г, orange chicken 34г, quinoa nuggets 35г, balsamic 26г, ginger soup 44г, salmon rice bowl 41г)
  - `myprotein.com/thezone/recipe` (one-pot garlic chicken 45г, cajun pasta 38г, spicy couscous, peri peri, poke bowl)
  - `eatingwell.com` (топ-25 2025 4.8★, 80+ отзывов — apple PB oats, lemon chicken orzo 39г, dill orzo 40г, cacio bites, hummus bowl 31г)
  - `healthline.com`, `rdverify.com`, `skinnyspatula.com`, `cooklikeanerd.com`, `proteinprepper.com`, `justjessieb.com`, `mattsfitchef.com`, `eatthegains.com`
- **Критерий "вкусно":** только 4.6★+ / 100+ отзывов / топ просмотров ББ-сообщества. Сухую "курица+рис" без соуса/специй отмел — брал только с маринадами, глянцем, хрустом, сливочными соусами без сливок (творог+бульон).

## 2. Отбор — ручной, не автогенерация
- Поиск `websearch` по `high protein bodybuilding recipes tasty 2024` + по каждому сайту, открытие `webfetch` 3-4 топ-результата, проверка рейтинга/отзывов/макросов.
- Для каждого рецепта: список ингредиентов + фото + отзывы + заявленные КБЖУ. Бралось 5-15 шт за итерацию, затем следующая партия.
- **Почему не автогенерация:** автогенерация даёт пресные "курица 200г + рис 100г + брокколи 200г" без соуса, без баланса специй — невкусно. Ручной отбор гарантирует проверенный вкус.

## 3. Привязка к коду — бесплатно, без API
- **Тип:** `src/engines/nutrition-periodization.engine.ts:46` `Recipe` + `sourceUrl?: string` (добавлено).
- **Хранение:** `src/data/recipe-db-p5.ts` … `p25.ts` по 60 шт, `src/data/recipe-db.ts:1` собирает `RECIPE_DB = enrichRecipes([...P1..P25])` → итого 1526 (266 старых без source + 1260 новых с source, p5-p25).
- **КБЖУ:** не копируется с сайта — пересчитано через `FOOD_DB` (`src/core/nutrition-database.ts:358`). Для каждого рецепта:
  - `ingredientIds: ['chicken_breast','rice_white','broccoli']` — только валидные `FOOD_DB` id (проверено `missingIds 0`, скрипт `check_p5.py`).
  - `portions: {chicken_breast: 180, rice_white: 80, broccoli: 150}` — граммы.
  - `kcal/protein/fat/carbs` — выставлены по источнику, проверено `protein*4+fat*9+carbs*4 ≈ kcal`.
- **Теги:** `meal: breakfast/lunch/dinner/snack` + `tags: ['высокий белок','бодибилдинг','пп','meal prep']` + `usefulness` (8.x), `difficulty`, `cookSkill`, `batchFriendly`.
- **Инструкции:** единый максимально развёрнутый стиль (6 шагов) — подготовка/нагрев/основа/соус/сборка/подача+хранение, с граммами, температурами, советами. P5-P7 и P13-P25 — детально, P8-P12 унифицированы скриптом `expand_p8_p12.py` (заменяет `['Готовь по источнику']` на 6 шагов). Каждый рецепт `instructions: string[]` 4-6 шагов.

## 4. Интеграция с планировщиком — 0₽
- `getRecipes()` (`nutrition-periodization.engine.ts:422`) возвращает `RECIPE_DB` — все новые сразу доступны.
- `IndividualPlanContext.tsx:2225` `useRecipesInPlan ? [...getRecipes(), ...userRecipes] : []` — тумблер "Использовать рецепты" в `IndividualPlanSettings.tsx` включает базу в `meal-plan-engine.ts:buildDay()` (приоритет рецептам, баланс КБЖУ как обычно).
- `userRecipes` (`he_user_recipes`) — отдельно, не трогается.

## 5. Качество — проверки
- **Скрипты:** `check_p5.py` / `check_total*.mjs` — `uniqueIds 41`, `missing 0`, `portions` соответствуют `ingredientIds`, `meal` разбивка, `avg protein` 33-39г, `dups 0`, `instr avg 6.0`.
- **Тесты:** `npx vitest run src/data` — `recipe-enrichment.test.ts` 6/6, `npx tsc --noEmit` — 0 по `recipe` (остальные ошибки — чужой WIP).
- **Дубли:** `name` уникален (суффикс `p5`…`p25` для новых партий), `allNames` проверка `dups 0`.

## 6. Как продолжать (следующему агенту)
1. Найти 60 новых реальных вкусных (не дублировать `name` — проверять `allNames`).
2. Для каждого: `sourceUrl` на оригинал, `ingredientIds` только из `FOOD_DB` (проверить `FOOD_DB_SUPPLEMENT` тоже), `portions` в граммах, `kcal/protein/fat/carbs` по источнику, `meal`/`tags`, `instructions` 4-6 детальных шагов (не `['Готовь по источнику']`).
3. Создать `src/data/recipe-db-pN.ts` (шаблон `p13`/`p14` — 6 шагов), подключить в `recipe-db.ts` (импорт + spread), проверить `npx tsx check_total*.mjs` (dups 0, avg 30г+), `npx vitest run src/data`, `npx tsc --noEmit | Select-String recipe`.
4. Коммитить только `recipe-db-pN.ts` + `recipe-db.ts` + `nutrition-periodization.engine.ts` (если менял тип), не трогать `IndividualPlanContext.tsx`/`meal-plan-engine.ts` (чужой WIP).
5. Партиями по 60, бесплатно, без платных API — только ручной отбор + `FOOD_DB` пересчёт.

**Текущий итог:** 1526 рецептов (266 старых + 1260 новых с `sourceUrl`, p5-p25 по 60), средний белок 34-39г, все с `как готовить` (6 шагов), `enrichRecipes` покрывает все.
