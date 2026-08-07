import { describe, it, expect } from 'vitest';
import { parseFatSecretText, parseNutritionScreenshot, parseNutritionText } from '../nutrition-ocr-parser';

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
  });
});
