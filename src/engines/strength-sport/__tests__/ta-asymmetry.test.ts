import { describe, it, expect } from 'vitest';
import { diagnoseSplitJerkAsymmetry, appendSplitJerkSnapshot, splitJerkTrend } from '../strength-sport-ta-asymmetry.engine';

describe('TA split-jerk asymmetry E11', () => {
  it('норма <7%', () => {
    const r = diagnoseSplitJerkAsymmetry({ leftForwardKg: 100, rightForwardKg: 102 });
    expect(r?.isAsym).toBe(false);
    expect(r?.weaker).toBeNull();
  });
  it('warn ≥7%: слабее левая', () => {
    const r = diagnoseSplitJerkAsymmetry({ leftForwardKg: 90, rightForwardKg: 100 });
    expect(r?.isAsym).toBe(true);
    expect(r?.isCrit).toBe(false);
    expect(r?.weaker).toBe('left');
    expect(r?.diffPct).toBe(10);
  });
  it('crit ≥12%', () => {
    const r = diagnoseSplitJerkAsymmetry({ leftForwardKg: 85, rightForwardKg: 100 });
    expect(r?.isCrit).toBe(true);
    expect(r?.text).toContain('сплит-приседы');
  });
  it('нет данных → null', () => {
    expect(diagnoseSplitJerkAsymmetry({})).toBeNull();
    expect(diagnoseSplitJerkAsymmetry({ leftForwardKg: 0, rightForwardKg: 100 })).toBeNull();
    expect(diagnoseSplitJerkAsymmetry({ leftForwardKg: NaN, rightForwardKg: 100 })).toBeNull();
  });
  it('история: замена по дате + кап 20', () => {
    let h = appendSplitJerkSnapshot([], { date: '2026-01-01', leftKg: 90, rightKg: 100, diffPct: 10 });
    h = appendSplitJerkSnapshot(h, { date: '2026-01-01', leftKg: 92, rightKg: 100, diffPct: 8 });
    expect(h.length).toBe(1);
    expect(h[0].diffPct).toBe(8);
    for (let i = 2; i <= 25; i++) h = appendSplitJerkSnapshot(h, { date: `2026-01-${String(i).padStart(2, '0')}`, leftKg: 90, rightKg: 100, diffPct: 10 });
    expect(h.length).toBe(20);
  });
  it('тренд: выравнивание отрицательное', () => {
    const t = splitJerkTrend([
      { date: '2026-01-01', leftKg: 85, rightKg: 100, diffPct: 15 },
      { date: '2026-02-01', leftKg: 92, rightKg: 100, diffPct: 8 },
    ]);
    expect(t?.deltaPp).toBe(-7);
    expect(splitJerkTrend([{ date: '2026-01-01', leftKg: 90, rightKg: 100, diffPct: 10 }])).toBeNull();
  });
});
