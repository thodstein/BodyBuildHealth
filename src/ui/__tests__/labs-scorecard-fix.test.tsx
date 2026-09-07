/**
 * labs-scorecard-fix.test.tsx — P0: LabsScoreCard получал 1 маркер вместо всех
 * До фикса: Object.entries(latest LabPoint) → [{id:"value", value:123}]
 * После: currentLabs.map(l => {id: code, value}) → все маркеры фазы
 */
import { describe, it, expect } from 'vitest';
import { analyzeLabs } from '../../engines/score-labs';

describe('LabsScoreCard P0 fix: маркеры фазы', () => {
  const labs = [
    { id: '1', code: 'ALT', value: 120, unit: 'U/L' },
    { id: '2', code: 'HCT', value: 55, unit: '%' },
    { id: '3', code: 'LDL', value: 5.2, unit: 'mmol/L' },
  ] as any[];

  function buggyMarkers(currentLabs: any[]) {
    const latest = currentLabs?.[currentLabs.length - 1];
    if (!latest) return [];
    return Object.entries(latest)
      .filter(([, v]) => typeof v === 'number')
      .map(([id, value]) => ({ id, value: value as number }));
  }

  function fixedMarkers(currentLabs: any[]) {
    return currentLabs
      .map((l: any) => ({ id: (l.code || '').toLowerCase(), value: Number(l.value) }))
      .filter((m: any) => m.id && isFinite(m.value));
  }

  it('баг: Object.entries даёт 1 маркер с id="value", а не коды', () => {
    const buggy = buggyMarkers(labs);
    expect(buggy.length).toBe(1);
    expect(buggy[0].id).toBe('value');
    const fixed = fixedMarkers(labs);
    expect(fixed.length).toBe(3);
    expect(fixed.map((m) => m.id)).toEqual(['alt', 'hct', 'ldl']);
  });

  it('баг: ScoreEngine с багом даёт 0 систем, с фиксом — ≥2', () => {
    const buggy = buggyMarkers(labs);
    const fixed = fixedMarkers(labs);
    const buggyRes = analyzeLabs({ markers: buggy as any, weight: 80, age: 30, sex: 'male' as const });
    const fixedRes = analyzeLabs({ markers: fixed as any, weight: 80, age: 30, sex: 'male' as const });
    const buggyActive = buggyRes.systems.filter((s) => s.weightedScore > 0).length;
    const fixedActive = fixedRes.systems.filter((s) => s.weightedScore > 0).length;
    expect(buggyActive).toBe(0);
    expect(fixedActive).toBeGreaterThanOrEqual(2);
    expect(fixedRes.overallRaw).toBeGreaterThan(buggyRes.overallRaw);
  });

  it('пусто → 0 маркеров, ScoreEngine не падает', () => {
    expect(fixedMarkers([]).length).toBe(0);
    const res = analyzeLabs({ markers: [], weight: 80, age: 30, sex: 'male' as const });
    expect(res.overallRaw).toBe(0);
  });
});
