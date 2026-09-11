import { describe, expect, it } from 'vitest';
import { planVolumeProgression, deloadDepthOk } from '../volume-optimizer-pro.engine';

const ENTRIES = [
  { id: 'r1', exerciseId: 'bench_bar', week: 1, day: 1, weight: 80, reps: 8, sets: 4, rpe: 8 },
  { id: 'r2', exerciseId: 'row_bar', week: 1, day: 2, weight: 60, reps: 8, sets: 3, rpe: 7 },
];

describe('deloadDepthOk: канон RP −40…−60%', () => {
  it('20→10 (−50%) — ok', () => {
    const d = deloadDepthOk(20, 10);
    expect(d.ok).toBe(true);
    expect(d.cutPct).toBe(50);
  });
  it('20→16 (−20%) — недожат', () => {
    const d = deloadDepthOk(20, 16);
    expect(d.ok).toBe(false);
    expect(d.message).toContain('недожат');
  });
  it('20→4 (−80%) — пережат', () => {
    const d = deloadDepthOk(20, 4);
    expect(d.ok).toBe(false);
    expect(d.message).toContain('пережат');
  });
  it('0→0 — ok без требований', () => {
    expect(deloadDepthOk(0, 0).ok).toBe(true);
  });
});

describe('planVolumeProgression: делод ×0.5 от пика с MV-флором', () => {
  it('4 недели: последняя — делод ≈50% недели 3 и ≥ MV', () => {
    const p = planVolumeProgression(ENTRIES, 'intermediate', 4);
    expect(p.weeks).toHaveLength(4);
    const peak = p.weeks[2];
    const deload = p.weeks[3];
    expect(peak.phase).toBe('accumulation');
    expect(deload.phase).toBe('deload');
    expect(deload.rirTarget).toBe(4);
    for (const [label, peakSets] of Object.entries(peak.setsByMuscle)) {
      const d = deload.setsByMuscle[label];
      expect(d).toBeLessThanOrEqual(Math.ceil(peakSets * 0.5));
      expect(d).toBeGreaterThanOrEqual(0);
      const depth = deloadDepthOk(peakSets, d);
      expect(depth.ok).toBe(true);
    }
  });
  it('старый баг не вернулся: делод ниже MAV (пик 20 → 10, а не ~13 как раньше)', () => {
    const p = planVolumeProgression(ENTRIES, 'intermediate', 4);
    const peak = p.weeks[2];
    const deload = p.weeks[3];
    expect(peak.setsByMuscle['Грудь']).toBe(20);
    expect(deload.setsByMuscle['Грудь']).toBe(10);
    expect(deload.setsByMuscle['Грудь']).toBeLessThan(14); // MAV груди intermediate
  });
});
