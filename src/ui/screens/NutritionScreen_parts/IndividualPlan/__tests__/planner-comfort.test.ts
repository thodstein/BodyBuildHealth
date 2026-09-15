/**
 * planner-comfort.test.ts — E5: проверки «вкусно и комфортно».
 */
import { describe, it, expect } from 'vitest';
import { comfortFindings, comfortSummaryForPlan, COMFORT_PORTION_CAPS } from '../planner-comfort';

const meal = (label: string, items: Array<{ id: string; amount: number; role?: string }>) =>
  ({ label, items: items.map(i => ({ ...i, role: i.role || 'carb' })) });

describe('E5: comfortFindings', () => {
  it('пусто/без элементов — без замечаний', () => {
    expect(comfortFindings([])).toEqual([]);
    expect(comfortFindings([meal('Обед', [])])).toEqual([]);
  });

  it('сладких приёмов >2 → замечание', () => {
    const f = comfortFindings([
      meal('Завтрак', [{ id: 'jam', amount: 30 }]),
      meal('Обед', [{ id: 'honey', amount: 20 }]),
      meal('Ужин', [{ id: 'pryaniki', amount: 40 }]),
    ]);
    expect(f.some(x => x.kind === 'sweets')).toBe(true);
  });

  it('превышение комфорт-капа порции → замечание', () => {
    const cap = COMFORT_PORTION_CAPS.honey;
    const f = comfortFindings([meal('Обед', [{ id: 'honey', amount: Math.round(cap * 1.3) }])]);
    expect(f.some(x => x.kind === 'comfortCap')).toBe(true);
    const ok = comfortFindings([meal('Обед', [{ id: 'honey', amount: cap }])]);
    expect(ok.some(x => x.kind === 'comfortCap')).toBe(false);
  });

  it('повтор семейства-стейпла >2 → замечание', () => {
    const f = comfortFindings([
      meal('Завтрак', [{ id: 'oats_dry', amount: 60 }]),
      meal('Обед', [{ id: 'oats', amount: 200 }]),
      meal('Ужин', [{ id: 'cereal_oat_bran', amount: 50 }]),
    ]);
    expect(f.some(x => x.kind === 'stapleRepeat')).toBe(true);
  });

  it('тяжёлый приём >750 г не-жидкости → замечание (жидкость не считается)', () => {
    const f = comfortFindings([meal('Обед', [
      { id: 'potato', amount: 500 },
      { id: 'chicken_breast', amount: 300 },
    ])]);
    expect(f.some(x => x.kind === 'solid')).toBe(true);
    const ok = comfortFindings([meal('Обед', [
      { id: 'potato', amount: 400 },
      { id: 'whey_protein', amount: 400, role: 'liquid' },
    ])]);
    expect(ok.some(x => x.kind === 'solid')).toBe(false);
  });

  it('comfortSummaryForPlan — то, что показывает UI (и без падений на мусоре)', () => {
    expect(comfortSummaryForPlan(null)).toEqual([]);
    expect(comfortSummaryForPlan({} as any)).toEqual([]);
    expect(comfortSummaryForPlan({ meals: 'nope' } as any)).toEqual([]);
    const plan = { meals: [
      meal('Завтрак', [{ id: 'jam', amount: 30 }]),
      meal('Обед', [{ id: 'honey', amount: 20 }]),
      meal('Ужин', [{ id: 'pryaniki', amount: 40 }]),
    ] };
    const lines = comfortSummaryForPlan(plan as any);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(' ')).toMatch(/Комфорт/);
  });
});
