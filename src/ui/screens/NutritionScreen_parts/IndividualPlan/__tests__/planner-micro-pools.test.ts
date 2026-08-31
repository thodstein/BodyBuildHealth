/**
 * planner-micro-pools.test.ts — Эпик 4 (NUTRITION-PROFESSIONAL-PLAN):
 * микро-дефициты дня → prefer-пулы следующего дня (4б) и DIAAS-слабое звено
 * → полные белки (4в). Плюс единый health-score отчёта «Качество» (4а).
 */

import { describe, it, expect } from 'vitest';
import { microDeficitToPreferIds, diaasWeakLinkToPreferIds, repairDiaasWeakLinks, MICRO_SOURCE_POOLS, COMPLETE_PROTEIN_IDS, VEG_PROTEIN_IDS } from '../planner-micro-pools';
import { generateQualityReportPure } from '../planner-reports';
import { FOOD_DB } from '../../../../../core/nutrition-database';

describe('MICRO_SOURCE_POOLS — все id существуют в FOOD_DB', () => {
  it('все источники валидны (животные и вег)', () => {
    for (const [nutrient, pool] of Object.entries(MICRO_SOURCE_POOLS)) {
      for (const id of [...pool.ids, ...(pool.vegIds || [])]) {
        expect(FOOD_DB.some(f => f.id === id), `${nutrient}: ${id} не найден в FOOD_DB`).toBe(true);
      }
    }
  });
  it('COMPLETE_PROTEIN_IDS валидны', () => {
    for (const id of COMPLETE_PROTEIN_IDS) {
      expect(FOOD_DB.some(f => f.id === id), `${id} не найден в FOOD_DB`).toBe(true);
    }
  });
});

describe('microDeficitToPreferIds (4б)', () => {
  it('дефициты → топ-2 источника (Zn, Mg)', () => {
    const r = microDeficitToPreferIds([
      { nutrient: 'Zn', pct: 45, status: 'deficit' },
      { nutrient: 'Mg', pct: 55, status: 'deficit' },
      { nutrient: 'Ca', pct: 90, status: 'ok' },
    ], false);
    expect(r.preferIds.length).toBeGreaterThan(0);
    expect(r.preferIds.length).toBeLessThanOrEqual(2);
    expect(r.note).toContain('Zn');
    expect(r.note).toContain('Mg');
  });
  it('дефициты с учётом исключённых продуктов пропускаются', () => {
    const r = microDeficitToPreferIds(
      [{ nutrient: 'Zn', pct: 30, status: 'deficit' }],
      false,
      new Set(['oysters', 'beef_lean', 'pumpkin_seeds', 'beef_minced']),
    );
    expect(r.preferIds).toEqual([]);
    expect(r.note).toBeNull();
  });
  it('вегетарианский режим — вег-фолбэк (Zn → семечки/бобовые)', () => {
    const r = microDeficitToPreferIds([{ nutrient: 'Zn', pct: 40, status: 'deficit' }], true);
    expect(r.preferIds[0]).toBe('pumpkin_seeds');
  });
  it('без дефицитов — пусто', () => {
    const r = microDeficitToPreferIds([{ nutrient: 'Zn', pct: 95, status: 'ok' }, { nutrient: 'Ca', pct: 88, status: 'ok' }], false);
    expect(r.preferIds).toEqual([]);
    expect(r.note).toBeNull();
  });
  it('пустой/битый coverage — пусто без бросков', () => {
    expect(microDeficitToPreferIds(undefined, false).preferIds).toEqual([]);
    expect(microDeficitToPreferIds([], false).preferIds).toEqual([]);
  });
  it('Na/VitA не считаются дефицитами (электролиты/жирорастворимые — отдельно)', () => {
    const r = microDeficitToPreferIds([
      { nutrient: 'Na', pct: 10, status: 'deficit' },
      { nutrient: 'VitA', pct: 15, status: 'deficit' },
    ], false);
    expect(r.preferIds).toEqual([]);
  });
});

describe('diaasWeakLinkToPreferIds (4в)', () => {
  it('слабое звено (DIAAS < 0.85) → полные белки в следующий день', () => {
    const r = diaasWeakLinkToPreferIds([
      { label: 'Завтрак', diaas: 0.71 },
      { label: 'Обед', diaas: 1.02 },
    ]);
    expect(r.preferIds.length).toBeGreaterThan(0);
    expect(r.preferIds.length).toBeLessThanOrEqual(3);
    expect(r.preferIds).toContain('egg_whole');
    expect(r.note).toContain('Завтрак');
  });
  it('все приёмы с полным звеном — пусто', () => {
    const r = diaasWeakLinkToPreferIds([
      { label: 'Завтрак', diaas: 1.05 },
      { label: 'Обед', diaas: 0.98 },
    ]);
    expect(r.preferIds).toEqual([]);
    expect(r.note).toBeNull();
  });
  it('null-значения (нет аминопрофиля) не считаются слабым звеном', () => {
    const r = diaasWeakLinkToPreferIds([{ label: 'Перекус', diaas: null }]);
    expect(r.preferIds).toEqual([]);
  });
});

describe('repairDiaasWeakLinks (4в, внутридневной комплиментарный белок)', () => {
  const vegMeal = (label: string) => ({
    label,
    items: [{ id: 'tofu', name: 'Тофу', amount: 200, kcal: 152, p: 16, f: 9, c: 4, fiber: 1, role: 'protein' }],
    totals: { kcal: 152, p: 16, f: 9, c: 4, fiber: 1 },
  });
  it('растительный белок заменяется полным (комплиментарность)', () => {
    const meals = [vegMeal('Обед')];
    const r = repairDiaasWeakLinks(meals as any);
    const m = r.meals[0];
    const names = m.items.map((it: any) => it.id);
    expect(names).toContain('tofu');
    expect(names.some((id: string) => COMPLETE_PROTEIN_IDS.includes(id))).toBe(true);
    expect(m.totals.p).toBeGreaterThan(16);
    expect(r.notes.length).toBe(1);
    expect(r.notes[0]).toContain('DIAAS-ремонт');
  });
  it('без растительного белка — без изменений', () => {
    const meals = [{ label: 'Обед', items: [{ id: 'chicken_breast', name: 'Курица', amount: 150, kcal: 165, p: 31, f: 3.6, c: 0, fiber: 0 }], totals: { kcal: 165, p: 31, f: 3.6, c: 0, fiber: 0 } }];
    const r = repairDiaasWeakLinks(meals as any);
    expect(r.meals[0].items[0].id).toBe('chicken_breast');
    expect(r.notes).toEqual([]);
  });
  it('исключённые полные белки не используются', () => {
    const excluded = new Set<string>(COMPLETE_PROTEIN_IDS);
    const meals = [vegMeal('Обед')];
    const r = repairDiaasWeakLinks(meals as any, excluded);
    expect(r.meals[0].items.length).toBe(1); // нечем заменить — приём не тронут
    expect(r.notes).toEqual([]);
  });
  it('VEG_PROTEIN_IDS валидны в FOOD_DB', () => {
    for (const id of VEG_PROTEIN_IDS) {
      expect(FOOD_DB.some(f => f.id === id), `${id} не найден`).toBe(true);
    }
  });
});

describe('generateQualityReportPure (4а) — единый bb_quality_score', () => {
  const day = {
    meals: [
      { label: 'Завтрак', items: [{ id: 'egg_whole', name: 'Яйца', amount: 100 }, { id: 'salmon', name: 'Лосось', amount: 100 }] },
      { label: 'Обед', items: [{ id: 'chicken_breast', name: 'Курица', amount: 150 }] },
    ],
  };
  it('avgScore = средний bb_quality_score (единый источник с V2)', () => {
    const r = generateQualityReportPure(day, 'medium', FOOD_DB);
    expect(r.avgScore).toBe(r.bbsAvg);
    const items = FOOD_DB.filter(f => ['egg_whole', 'salmon', 'chicken_breast'].includes(f.id));
    const expected = Math.round(items.reduce((s, f) => s + (f.bb_quality_score || 0), 0) / items.length * 10) / 10;
    expect(r.avgScore).toBe(expected);
  });
  it('bestItems/weakItems по той же шкале', () => {
    const r = generateQualityReportPure(day, 'medium', FOOD_DB);
    expect(Array.isArray(r.bestItems)).toBe(true);
    expect(Array.isArray(r.weakItems)).toBe(true);
  });
  it('null-план — дефолт без бросков', () => {
    const r = generateQualityReportPure(null, 'low', FOOD_DB);
    expect(r.avgScore).toBe(0);
    expect(r.budgetOk).toBe(true);
  });
});