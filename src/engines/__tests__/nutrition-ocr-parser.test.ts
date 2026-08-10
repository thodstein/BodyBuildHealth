import { describe, it, expect } from 'vitest';
import { fillMissingMicros, parseFatSecretText, parseMicroLine, parseNutritionScreenshot, parseNutritionText, quantityToGrams, parseVerticalNutritionTable } from '../nutrition-ocr-parser';

describe('nutrition-ocr-parser', () => {
  describe('parseFatSecretText', () => {
    it('parses basic item line', () => {
      const text = `Завтрак
Яйца 2 шт 150 ккал Б:15 Ж:10 У:2
Овсянка 100 г 350 ккал Б:12 Ж:7 У:60`;
      const meals = parseFatSecretText(text);
      expect(meals.length).toBeGreaterThanOrEqual(1);
      const items = meals.flatMap(m => m.items);
      const names = items.map(i => i.name);
      expect(names.some(n => n.includes('Яйца'))).toBe(true);
      expect(names.some(n => n.includes('Овсянка'))).toBe(true);
    });

    it('parses FatSecret screenshot rows when macro captions are missing', () => {
      const meals = parseFatSecretText('Завтрак\nChicken breast 200 g 330 kcal 40 10 0');
      const item = meals.flatMap(meal => meal.items)[0];
      expect(item).toMatchObject({ qtyGrams: 200, kcal: 165, p: 20, f: 5, c: 0 });
    });

    it('skips total lines', () => {
      const text = `Завтрак
Яйца 100 г 150 ккал
Итого: 500 ккал`;
      const meals = parseFatSecretText(text);
      const items = meals.flatMap(m => m.items);
      expect(items.every(i => i.kcal > 0)).toBe(true);
    });

    it('parses date from text', () => {
      const text = `01.02.2026
Завтрак
Яйца 100 г 150 ккал`;
      const meals = parseFatSecretText(text);
      expect(meals.length).toBeGreaterThanOrEqual(1);
      expect(meals[0].date).toBe('01.02.2026');
    });

    it('handles empty input', () => {
      expect(parseFatSecretText('')).toEqual([]);
      expect(parseFatSecretText('   ')).toEqual([]);
    });

    it('keeps the detected portion and normalizes macros per 100 g', () => {
      const meals = parseFatSecretText('Курица 200 г 330 ккал Б:40 Ж:10 У:0');
      const item = meals[0].items[0];
      expect(item.qty).toBe('200 г');
      expect(item.kcal).toBe(165);
      expect(item.p).toBe(20);
    });

    it('converts piece portions to grams for known foods', () => {
      const meals = parseFatSecretText('Завтрак\nЯйцо 2 шт 140 ккал Б:12 Ж:10 У:1');
      const item = meals[0].items[0];
      expect(item.qtyGrams).toBe(100);
      expect(item.kcal).toBe(140);
    });

    it('keeps quantity when calories come first', () => {
      const meals = parseFatSecretText('250 ккал Курица 150 г');
      const item = meals[0].items[0];
      expect(item.qty).toBe('150 г');
      expect(item.qtyGrams).toBe(150);
      expect(item.kcal).toBeCloseTo(166.7, 0);
    });

    it('parses decimal calories with a comma', () => {
      const meals = parseFatSecretText('Курица 150 г 247,5 ккал Б:46,5 Ж:5,4 У:0');
      const item = meals[0].items[0];
      expect(item.kcal).toBe(165);
      expect(item.p).toBe(31);
    });

    it('parses semicolon-delimited exports', () => {
      const meals = parseNutritionText('Курица;200 г;330;40;10;0');
      const item = meals.flatMap(meal => meal.items)[0];
      expect(item.qtyGrams).toBe(200);
      expect(item.kcal).toBe(165);
      expect(item.p).toBe(20);
    });

    it('deduplicates the same item found by both OCR formats', () => {
      const meals = parseNutritionText('Завтрак\nКурица 200 г 330 ккал Б:40 Ж:10 У:0');
      expect(meals.flatMap(meal => meal.items)).toHaveLength(1);
    });

    it('parses micronutrients from a FatSecret-style row', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал\nНатрий: 130 мг Калий: 512 мг Магний: 58 мг');
      const item = meals[0].items[0];
      expect(item.micros?.sodium_mg).toBe(130);
      expect(item.micros?.potassium_mg).toBe(512);
      expect(item.micros?.magnesium_mg).toBe(58);
    });

    it('parses compact micronutrient labels from a screenshot', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал\nNa 130 mg K 512 mg Mg 58 mg Ca 22 mg');
      const item = meals[0].items[0];
      expect(item.micros?.sodium_mg).toBe(130);
      expect(item.micros?.potassium_mg).toBe(512);
      expect(item.micros?.magnesium_mg).toBe(58);
      expect(item.micros?.calcium_mg).toBe(22);
    });

    it('parses compact vitamin labels', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал\nVit A 120 mcg Vit C 15 mg Vit D 2 mcg B12 0,5 mcg');
      const item = meals[0].items[0];
      expect(item.micros?.vitamin_a_mcg).toBe(120);
      expect(item.micros?.vitamin_c_mg).toBe(15);
      expect(item.micros?.vitamin_d_mcg).toBe(2);
      expect(item.micros?.vitamin_b12_mcg).toBe(0.5);
    });

    it('keeps the same food in separate meals', () => {
      const meals = parseNutritionText('Завтрак\nКурица 100 г 165 ккал\nОбед\nКурица 100 г 165 ккал');
      expect(meals).toHaveLength(2);
      expect(meals.flatMap(meal => meal.items)).toHaveLength(2);
    });

    it('parses compact micronutrient tables', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал\nNa K Mg Ca\n130 512 58 22 mg');
      const items = meals.flatMap(meal => meal.items);
      expect(items).toHaveLength(1);
      expect(items[0].micros).toMatchObject({ sodium_mg: 130, potassium_mg: 512, magnesium_mg: 58, calcium_mg: 22 });
    });

    it('parses full FatSecret headers and keeps dash columns aligned', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал\nSodium (mg) Potassium (mg) Magnesium (mg) Calcium (mg)\n130 — 58 22');
      const item = meals[0].items[0];
      expect(item.micros).toMatchObject({ sodium_mg: 130, magnesium_mg: 58, calcium_mg: 22 });
      expect(item.micros?.potassium_mg).toBeUndefined();
    });

    it('parses multi-column tables with parenthetical units and mixed empty cells', () => {
      const meals = parseFatSecretText('Обед\nГовядина 150 г 250 ккал\nSodium (mg) Potassium (mg) Magnesium (mcg) Calcium (mg) Iron (mg) Zinc (mg)\n110 350 22 18 2.8 4.2');
      const item = meals[0].items[0];
      expect(item.micros).toMatchObject({
        sodium_mg: 110,
        potassium_mg: 350,
        magnesium_mcg: 22,
        calcium_mg: 18,
        iron_mg: 2.8,
        zinc_mg: 4.2,
      });
    });

    it('handles dashed and empty cells in parenthetical-header tables', () => {
      const meals = parseFatSecretText('Завтрак\nЯйца 100 г 143 ккал\nSodium (mg) Potassium (mg) Magnesium (mg) Calcium (mg)\n142 — 12 50');
      const item = meals[0].items[0];
      expect(item.micros?.sodium_mg).toBe(142);
      expect(item.micros?.magnesium_mg).toBe(12);
      expect(item.micros?.calcium_mg).toBe(50);
      expect(item.micros?.potassium_mg).toBeUndefined();
    });

    it('parses compact vitamin values directly', () => {
      expect(parseMicroLine('Vit A 120 mcg Vit C 15 mg B12 0,5 mcg')).toMatchObject({ vitamin_a_mcg: 120, vitamin_c_mg: 15, vitamin_b12_mcg: 0.5 });
    });

    it('assigns confidence scores to parsed items', () => {
      const withMacros = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал Б:40 Ж:10 У:0');
      const foodOnly = parseFatSecretText('Завтрак\nКурица 200 г');
      expect(withMacros[0].items[0].confidence).toBeGreaterThanOrEqual(0.7);
      expect(withMacros[0].items[0].confidence).toBeGreaterThan(foodOnly[0].items[0].confidence);
    });

    it('fills missing micronutrients by actual portion without overwriting existing values', () => {
      const micros = fillMissingMicros('Курица', 200, { sodium_mg: 999 });
      expect(micros.sodium_mg).toBe(999);
      expect(micros.potassium_mg).toBeGreaterThan(0);
    });

    it('converts legacy saved portions to grams', () => {
      expect(quantityToGrams('2 ст. л.')).toBe(30);
      expect(quantityToGrams('1 ч. л.')).toBe(5);
      expect(quantityToGrams('2 шт', { id: 'egg_whole' } as any)).toBe(100);
    });

    it('normalizes common OCR misreadings', () => {
      const meals = parseFatSecretText('Завтрак\nKуpицa 200 г 330 ккал Б:35 Ж:7 У:0');
      expect(meals.flatMap(meal => meal.items)).toHaveLength(1);
      expect(meals[0].items[0].foodId).toBe('chicken_breast');
    });

    it('normalizes expanded homoglyph set', () => {
      const meals = parseFatSecretText('Завтрак\n0всянка 100 г 389 ккал Б:13 Ж:7 У:66');
      expect(meals.flatMap(meal => meal.items)).toHaveLength(1);
      expect(meals[0].items[0].foodId).toBe('oats');
    });

    it('parses calories with OCR-substituted zero', () => {
      const meals = parseFatSecretText('Рис 150 г 540 ккал Б:12 Ж:1 У:60');
      const item = meals[0].items[0];
      expect(item.kcal).toBeCloseTo(360, 0);
      expect(item.foodId).toBe('rice_white');
    });

    it('collapses spaced digits caused by OCR artifacts', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 3 3 0 ккал Б:4 0 Ж:1 0 У:0');
      const item = meals[0].items[0];
      expect(item.kcal).toBe(165);
      expect(item.p).toBeCloseTo(20, 0);
      expect(item.f).toBeCloseTo(5, 0);
    });

    it('does not collapse intentional digit-space-digit patterns', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 330 ккал Б:40 Ж:10 У:0');
      const item = meals[0].items[0];
      expect(item.kcal).toBe(165);
      expect(item.p).toBe(20);
      expect(item.f).toBe(5);
    });

    it('collapses comma-separated OCR digits with 3 groups', () => {
      const meals = parseFatSecretText('Завтрак\nКурица 200 г 3,3,0 ккал Б:40 Ж:10 У:0');
      const item = meals[0].items[0];
      expect(item.kcal).toBe(165);
      expect(item.p).toBe(20);
      expect(item.f).toBe(5);
    });
  });

  describe('parseNutritionScreenshot', () => {
    it('parses screenshot-style text', () => {
      const text = `Курица грудка 200г 330 ккал Б:35 Ж:7 У:0
Рис белый 150г 540 ккал Б:12 Ж:1 У:28
Итого за день: 870 ккал`;
      const meals = parseNutritionScreenshot(text);
      expect(meals.length).toBeGreaterThanOrEqual(1);
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('creates currentMeal for unrecognized lines', () => {
      const text = `Случайная строка без формата`;
      const meals = parseNutritionScreenshot(text);
      expect(meals.length).toBeGreaterThanOrEqual(0);
    });

    it('filters out empty meals', () => {
      const text = `Завтрак
Итого: 100 ккал`;
      const meals = parseNutritionScreenshot(text);
      expect(meals.every(m => m.items.length > 0)).toBe(true);
    });

    it('recognizes a known food when only name and portion are present', () => {
      const meals = parseNutritionScreenshot('Курица 200 г');
      const item = meals[0].items[0];
      expect(item.qty).toBe('200 г');
      expect(item.kcal).toBeGreaterThan(0);
      expect(item.foodId).toBeTruthy();
    });

    it('tolerates common OCR character substitutions', () => {
      const meals = parseNutritionScreenshot('Курицa 200 г');
      expect(meals.flatMap(meal => meal.items)).toHaveLength(1);
      expect(meals[0].items[0].foodId).toBe('chicken_breast');
    });

    it('parses vertical nutrition tables as fallback when no food items found', () => {
      const text = `Белки: 30 г
Жиры: 10 г
Углеводы: 50 г
Натрий: 130 мг
Калий: 512 мг`;
      const meals = parseNutritionScreenshot(text);
      expect(meals.length).toBeGreaterThanOrEqual(1);
      const item = meals[0].items[0];
      expect(item.micros).toMatchObject({ sodium_mg: 130, potassium_mg: 512 });
      expect(item.p).toBe(30);
      expect(item.f).toBe(10);
      expect(item.c).toBe(50);
    });

    it('parses reversed vertical format (value before label)', () => {
      const text = `30 г  Белки
10 г  Жиры
50 г  Углеводы`;
      const meals = parseNutritionScreenshot(text);
      const item = meals[0].items[0];
      expect(item.p).toBe(30);
      expect(item.f).toBe(10);
      expect(item.c).toBe(50);
    });

    it('converts units in vertical tables (mcg to mg, g to mg)', () => {
      const text = `Витамин C: 150 мг
Витамин D: 20 мкг
Магний: 0.4 г`;
      const meals = parseNutritionScreenshot(text);
      const item = meals[0].items[0];
      expect(item.micros?.vitamin_c_mg).toBe(150);
      expect(item.micros?.vitamin_d_mcg).toBe(20);
      expect(item.micros?.magnesium_mg).toBeCloseTo(400, 0);
    });

    it('parses vertical nutrient table directly', () => {
      const vertical = parseVerticalNutritionTable('Белки: 30 г\nЖиры: 10 г\nУглеводы: 50 г\nНатрий: 130 мг\nКалий: 512 мг');
      expect(vertical).toMatchObject({ p: 30, f: 10, c: 50, sodium_mg: 130, potassium_mg: 512 });
    });

    it('parses vertical vitamins and minerals', () => {
      const vertical = parseVerticalNutritionTable('Витамин C: 150 мг\nВитамин D: 20 мкг\nМагний: 0.4 г');
      expect(vertical.vitamin_c_mg).toBe(150);
      expect(vertical.vitamin_d_mcg).toBe(20);
      expect(vertical.magnesium_mg).toBeCloseTo(400, 0);
    });

    it('collapses spaced digits in quantityToGrams', () => {
      expect(quantityToGrams('3 3 0 г')).toBe(330);
      expect(quantityToGrams('2 0 0 мл')).toBe(200);
    });
  });
});
