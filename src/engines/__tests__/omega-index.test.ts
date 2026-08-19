/**
 * omega-index.engine.test.ts — тесты омега-индекса (доп. 6).
 *
 * - жирная рыба даёт ≥250 мг омега-3 → ok;
 * - курица/рис даёт низкий омега-3 → low;
 * - пустой вход → 0/low без NaN.
 */
import { describe, it, expect } from 'vitest';
import { computeOmegaIndex } from '../omega-index.engine';

describe('computeOmegaIndex (доп. 6)', () => {
  it('жирная рыба → ok (омега-3 ≥ 250 мг)', () => {
    const r = computeOmegaIndex({ products: [{ foodId: 'salmon', weightGrams: 150 }] });
    expect(r.status).toBe('ok');
    expect(r.omega3Mg).toBeGreaterThanOrEqual(250);
    expect(r.recommendation).toContain('Достаточно');
  });

  it('курица → low', () => {
    const r = computeOmegaIndex({ products: [{ foodId: 'chicken_breast', weightGrams: 200 }] });
    expect(r.status).toBe('low');
    expect(r.omega3Mg).toBeLessThan(250);
  });

  it('пустой/неверный вход → low без NaN', () => {
    const r = computeOmegaIndex({ products: [{ foodId: 'nonexistent', weightGrams: 100 }] });
    expect(Number.isFinite(r.omega3Mg)).toBe(true);
    expect(r.status).toBe('low');
  });
});
