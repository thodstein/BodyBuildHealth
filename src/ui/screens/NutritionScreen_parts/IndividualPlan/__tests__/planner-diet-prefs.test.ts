/**
 * planner-diet-prefs.test.ts — B21 (аудит 2026-10).
 *
 * Находка: при сохранении в профиль писалось только `dietType = dietPrefs[0]`,
 * поэтому пользователь с ['vegetarian','halal'] терял второй пункт — а профиль
 * читают другие экраны (диета/ограничения).
 *
 * Замок: в профиль уходит ВЕСЬ набор, `dietType` остаётся первым (совместимость).
 */
import { describe, it, expect } from 'vitest';
import { dietPrefsToNutritionPatch, dietPrefsFromNutrition } from '../planner-diet-prefs';

describe('B21: все диетические предпочтения сохраняются в профиль', () => {
  it('два предпочтения не схлопываются в одно', () => {
    const patch = dietPrefsToNutritionPatch(['vegetarian', 'halal']);
    expect(patch.dietTypes).toEqual(['vegetarian', 'halal']);
    // обратная совместимость: dietType — первый элемент
    expect(patch.dietType).toBe('vegetarian');
  });

  it('три и более предпочтения сохраняются полностью', () => {
    const patch = dietPrefsToNutritionPatch(['vegan', 'keto', 'mediterranean']);
    expect(patch.dietTypes).toHaveLength(3);
    expect(patch.dietTypes).toEqual(['vegan', 'keto', 'mediterranean']);
  });

  it('пустой набор НЕ затирает профиль (пустой патч)', () => {
    expect(dietPrefsToNutritionPatch([])).toEqual({});
    expect(dietPrefsToNutritionPatch(undefined)).toEqual({});
    expect(dietPrefsToNutritionPatch(null)).toEqual({});
  });

  it('мусор и пустые строки отфильтровываются', () => {
    const patch = dietPrefsToNutritionPatch(['vegetarian', '', '   ', null, 42, 'halal'] as any);
    expect(patch.dietTypes).toEqual(['vegetarian', 'halal']);
    expect(patch.dietType).toBe('vegetarian');
  });

  it('чтение: полный набор из dietTypes', () => {
    expect(dietPrefsFromNutrition({ dietType: 'vegetarian', dietTypes: ['vegetarian', 'halal'] }))
      .toEqual(['vegetarian', 'halal']);
  });

  it('чтение: старый профиль без dietTypes — одиночное значение', () => {
    expect(dietPrefsFromNutrition({ dietType: 'vegan' })).toEqual(['vegan']);
  });

  it('чтение: omnivore = «предпочтений нет»', () => {
    expect(dietPrefsFromNutrition({ dietType: 'omnivore' })).toEqual([]);
    expect(dietPrefsFromNutrition({})).toEqual([]);
    expect(dietPrefsFromNutrition(null)).toEqual([]);
  });

  it('round-trip: сохранение → чтение возвращает тот же набор', () => {
    const prefs = ['pescatarian', 'paleo'];
    const patch = dietPrefsToNutritionPatch(prefs);
    expect(dietPrefsFromNutrition({ dietType: 'omnivore', ...patch })).toEqual(prefs);
  });
});
