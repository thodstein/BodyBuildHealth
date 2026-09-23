/**
 * planner-allergen-report.test.ts — P1-fix: отчёт «⚠ Аллергены» больше не ложный.
 *
 * Раньше planner-reports сравнивал РУССКИЕ id аллергенов пользователя (ALLERGEN_LIST:
 * 'рыба', 'глютен', 'лактоза') с ЛАТИНСКИМИ тегами FOOD_DB ('fish', 'gluten', 'dairy')
 * наивным substring'ом — совпадений нет, отчёт всегда показывал «всех аллергенов нет»,
 * противореча соседнему блоку «🚫 Исключено N продуктов по вашим аллергенам».
 * Теперь отчёт использует канонический матчер planner-restrictions (теги + текст).
 */
import { describe, it, expect } from 'vitest';
import { generateAllergenReportPure } from '../planner-reports';
import { resolveAllergenFoodIds } from '../planner-restrictions';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { ALLERGEN_LIST } from '../types';

const dayWith = (id: string, name: string, amount = 150) => ({
  meals: [{ label: 'Обед', items: [{ id, name, amount, kcal: 200, p: 20, f: 10, c: 0, fiber: 0 }] }],
});

describe('planner-reports: аллерген-отчёт (канонический матчер)', () => {
  it('русский id «рыба» ловит продукт с тегом fish (было всегда 0 конфликтов)', () => {
    const report = generateAllergenReportPure(dayWith('red_fish', 'Красная рыба'), ['рыба'], FOOD_DB);
    expect(report.riskLevel).toBe('medium');
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(report.conflicts[0].allergens).toContain('рыба');
    expect(report.summary).toContain('найдено');
  });

  it('паритет с резолвером исключений (генерация/отчёт видят одно и то же)', () => {
    const excluded = resolveAllergenFoodIds(FOOD_DB, ['рыба']);
    expect(excluded.has('red_fish')).toBe(true);
    const report = generateAllergenReportPure(dayWith('red_fish', 'Красная рыба'), ['рыба'], FOOD_DB);
    expect(report.conflicts.some(c => c.food === 'Красная рыба')).toBe(true);
  });

  it('текстовый фолбэк: продукт без тегов («Сыр») ловится аллергеном «лактоза»', () => {
    const customDb: any[] = [{ id: 'x_cheese', name: 'Сыр полутвёрдый', kcal: 350, p: 25, f: 27, c: 0, allergens: [] }];
    const report = generateAllergenReportPure(dayWith('x_cheese', 'Сыр полутвёрдый'), ['лактоза'], customDb as any);
    expect(report.conflicts.length).toBe(1);
    expect(report.summary).toContain('найдено');
  });

  it('без аллергенов/чужой аллерген — план чистый (✅)', () => {
    const plan = dayWith('red_fish', 'Красная рыба');
    expect(generateAllergenReportPure(plan, [], FOOD_DB).riskLevel).toBe('low');
    expect(generateAllergenReportPure(plan, ['орехи'], FOOD_DB).conflicts).toEqual([]);
    expect(generateAllergenReportPure(plan, ['орехи'], FOOD_DB).summary).toContain('✅');
  });

  it('каждый id ALLERGEN_LIST не крашит матчер (канон-словарь)', () => {
    for (const a of ALLERGEN_LIST) {
      expect(() => generateAllergenReportPure(dayWith('red_fish', 'Красная рыба'), [a.id], FOOD_DB)).not.toThrow();
    }
  });

  it('null-гард allergens сохранён (P0-4)', () => {
    expect(() => generateAllergenReportPure(dayWith('red_fish', 'Красная рыба'), null as any, FOOD_DB)).not.toThrow();
    expect(() => generateAllergenReportPure(dayWith('red_fish', 'Красная рыба'), undefined as any, FOOD_DB)).not.toThrow();
  });
});
