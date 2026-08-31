/**
 * planner-meal-targets.test.ts — Эпик 6 (NUTRITION-PROFESSIONAL-PLAN):
 * ручные цели на приём (🎯) — пост-проход масштабирования приёма к Б/Ж/У цели.
 */

import { describe, it, expect } from 'vitest';
import { applyMealTargetOverrides } from '../planner-meal-targets';

const meal = (label: string, items: any[] = []) => {
  const totals = items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.p, f: a.f + it.f, c: a.c + it.c, fiber: a.fiber + (it.fiber || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
  return { label, items, totals };
};

const chickenMeal = () => meal('Обед', [
  { id: 'chicken_breast', name: 'Курица', amount: 150, kcal: 165, p: 31, f: 3.6, c: 0, fiber: 0 },
  { id: 'rice_white', name: 'Рис', amount: 200, kcal: 260, p: 5.4, f: 0.6, c: 58, fiber: 0.6 },
]);

describe('applyMealTargetOverrides', () => {
  it('без оверрайдов — приёмы не меняются', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, []);
    expect(r.meals[0]).toBe(meals[0]);
    expect(r.notes).toEqual([]);
  });
  it('оверрайд белка масштабирует приём (пропорции сохраняются)', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, [{ label: 'Обед', p: 50 }]);
    const m = r.meals[0];
    expect(m.items[0].amount).toBeGreaterThan(150);
    // белок приёма стремится к 50 г (± округление)
    expect(Math.abs(m.totals.p - 50)).toBeLessThanOrEqual(3);
    expect(r.notes.length).toBe(1);
    expect(r.notes[0]).toContain('Обед');
  });
  it('кламп 0.7–1.4: экстремальная цель не раздувает приём', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, [{ label: 'Обед', kcal: 9999 }]);
    const m = r.meals[0];
    expect(m.totals.kcal / 425).toBeLessThanOrEqual(1.4 + 0.02);
    expect(m.items[0].amount).toBeLessThanOrEqual(150 * 1.4 + 2);
  });
  it('белок не режется глубже 0.8× при низкой цели', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, [{ label: 'Обед', p: 10 }]);
    const m = r.meals[0];
    expect(m.totals.p).toBeGreaterThanOrEqual(36.4 * 0.8 - 2);
  });
  it('неизвестный приём — без изменений', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, [{ label: 'Ужин', p: 50 }]);
    expect(r.meals[0].items[0].amount).toBe(150);
    expect(r.notes).toEqual([]);
  });
  it('битый вход — без бросков', () => {
    const meals = [chickenMeal()];
    expect(() => applyMealTargetOverrides(meals as any, null as any)).not.toThrow();
    expect(() => applyMealTargetOverrides(null as any, [{ label: 'Обед', p: 40 }])).not.toThrow();
  });
  it('Atwater-сходимость после масштаба (дрейф округления ≤ ~3%)', () => {
    const meals = [chickenMeal()];
    const r = applyMealTargetOverrides(meals, [{ label: 'Обед', p: 45, c: 80 }]);
    const m = r.meals[0];
    const sum = m.items.reduce((s, it) => s + (it.p * 4 + it.f * 9 + it.c * 4), 0);
    expect(Math.abs(m.totals.kcal - sum) / Math.max(1, m.totals.kcal)).toBeLessThanOrEqual(0.03);
  });
});