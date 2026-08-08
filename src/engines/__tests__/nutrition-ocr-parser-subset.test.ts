import { describe, it, expect } from 'vitest';
import { parseNutritionText, parseFatSecretText, parseNutritionScreenshot } from '../nutrition-ocr-parser';

describe('nutrition-ocr-parser subset', () => {
  describe('parseFatSecretText', () => {
    it('parses basic item line', () => {
      const text = `Завтрак
Яйца 2 шт 150 ккал Б:15 Ж:10 У:2
Овсянка 100 г 350 ккал Б:12 Ж:7 У:60`;
      const meals = parseFatSecretText(text);
      expect(meals.length).toBeGreaterThanOrEqual(1);
      expect(meals[0].items).toHaveLength(2);
    });

    it('deduplicates the same item found by both OCR formats', () => {
      const meals = parseNutritionText('Завтрак\nКурица 200 г 330 ккал Б:35 Ж:7 У:0');
      expect(meals.flatMap(meal => meal.items)).toHaveLength(1);
    });

    it('keeps the same food in separate meals', () => {
      const meals = parseNutritionText('Завтрак\nКурица 100 г 165 ккал Б:20 Ж:5 У:0\nОбед\nКурица 150 г 248 ккал Б:30 Ж:8 У:0');
      expect(meals).toHaveLength(2);
      expect(meals.flatMap(meal => meal.items)).toHaveLength(2);
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
  });
});
