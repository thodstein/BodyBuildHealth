/**
 * lab-titration-factors.test.ts — E2: множители лаб-ступеней не перемножаются.
 *
 * До прохода 211 произведение жило только в тексте причины. После E2 оно стало
 * умножать дозу, и ALT+AST+GGT (три маркера одного органа, каждый «×2») давали
 * TUDCA ×8 = 8 г. Клинически это одна ступень, поэтому берётся максимум.
 */
import { describe, expect, it } from 'vitest';
import { accumulateTitrationFactors } from '../tz-mapper-engine';

const factorOf = (entries: Array<{ id: string; factor: number }>, id: string) =>
  accumulateTitrationFactors(entries).get(id);

describe('множители лаб-ступеней: максимум, а не произведение', () => {
  it('две «×2» на один орган дают ×2, не ×4', () => {
    expect(
      factorOf(
        [
          { id: 'tudca', factor: 2 },
          { id: 'tudca', factor: 2 },
        ],
        'tudca',
      ),
    ).toBe(2);
  });

  it('разные маркеры и алиасы канонизируются', () => {
    const f = factorOf(
      [
        { id: 'udca', factor: 1.5 },
        { id: 'tudca', factor: 2 },
      ],
      'tudca',
    );
    expect(f).toBe(2);
  });

  it('разные вещества не смешиваются', () => {
    const f = accumulateTitrationFactors([
      { id: 'tudca', factor: 2 },
      { id: 'milk_thistle', factor: 1.5 },
    ]);
    expect(f.get('tudca')).toBe(2);
    expect(f.get('milk_thistle')).toBe(1.5);
  });

  it('одна ступень сохраняется как есть', () => {
    expect(factorOf([{ id: 'curcumin', factor: 1.5 }], 'curcumin')).toBe(1.5);
  });
});
