import { describe, it, expect } from 'vitest';
import { planLrSplit, lrAsymmetryPct } from '../arm-lr-split.engine';
import { analyzeTableIq } from '../arm-table-iq.engine';

describe('arm TOP T7 L/R + Table-IQ', () => {
  it('асимметрия как у Bezkorovainyi', () => {
    expect(lrAsymmetryPct(90, 100)).toBe(10);
    expect(lrAsymmetryPct(0, 100)).toBeNull();
  });
  it('<7% — симметрия', () => {
    const s = planLrSplit({ leftKg: 96, rightKg: 100, baseSets: 10 });
    expect(s.weakSets).toBe(s.strongSets);
  });
  it('7–12% — слабая +15%', () => {
    const s = planLrSplit({ leftKg: 90, rightKg: 100, baseSets: 10 });
    expect(s.weakArm).toBe('left');
    expect(s.weakSets).toBe(12); // 10×1.15=11.5→12
    expect(s.weakFreq).toBe(1);
  });
  it('≥12% — слабая +25% 2×/нед, кап MRV', () => {
    const s = planLrSplit({ leftKg: 80, rightKg: 100, baseSets: 10, mrvSets: 12 });
    expect(s.weakSets).toBe(12); // 12.5→кап 12
    expect(s.withinMrv).toBe(true);
    expect(s.note).toMatch(/CRITICAL/);
  });
  it('Table-IQ: фолы и срывы дают рычаги', () => {
    const iq = analyzeTableIq({ bouts: [{ fouls: 2, slip: true, strap: true, centerHoldSec: 3, win: false, finishSec: 20 }, { fouls: 1, win: true, centerHoldSec: 8, finishSec: 8 }] });
    expect(iq.bouts).toBe(2);
    expect(iq.levers.length).toBeGreaterThanOrEqual(1);
    expect(iq.levers.join(' ')).toMatch(/Фолы|Срывы/);
  });
  it('Table-IQ пусто — подсказка вести журнал', () => {
    expect(analyzeTableIq({}).levers[0]).toMatch(/журнал/i);
  });
});
