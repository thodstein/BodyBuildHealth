import { describe, it, expect } from 'vitest';
import { calcIPFGL, calcDOTS, calcWilks, calcGlossbrenner, calcAllPoints } from '../pl-points.engine';

describe('pl-points.engine (мужчины, коэффициенты 2026)', () => {
  it('Wilks 93кг/600 → ~377', () => {
    expect(calcWilks(93, 600)).toBeCloseTo(377, 0);
  });
  it('DOTS 80кг/500 → ~384', () => {
    expect(calcDOTS(80, 500)).toBeCloseTo(384, 0);
  });
  it('IPF GL 93кг/600 (total, raw) → ~78.5 (шкала 0-120)', () => {
    expect(calcIPFGL(93, 600, 'total', 'raw')).toBeCloseTo(78.5, 0);
  });
  it('Glossbrenner 93кг/600 → > 200', () => {
    expect(calcGlossbrenner(93, 600)).toBeGreaterThan(200);
  });
  it('calcAllPoints возвращает 4 формулы', () => {
    const all = calcAllPoints(80, 500);
    expect(all.length).toBe(4);
    expect(all.some(p => p.formula === 'dots')).toBe(true);
  });
  it('валидация: total=0 → 0 очков', () => {
    expect(calcDOTS(80, 0)).toBe(0);
    expect(calcWilks(80, 0)).toBe(0);
  });
  it('IPF GL жим (bench, raw) отличается от троеборья', () => {
    expect(calcIPFGL(80, 200, 'bench', 'raw')).not.toBe(calcIPFGL(80, 200, 'total', 'raw'));
  });
});