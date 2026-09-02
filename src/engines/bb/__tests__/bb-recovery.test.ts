import { describe, it, expect } from 'vitest';
import {
  rehabProtocol, rehabWeekForWeek, rehabExerciseAdjustment, rehabNotes,
  extractPlanTonnage, tonnageProgression, nextMesoVolumeTarget, overreachingCheck,
  applyRehabToPlan,
} from '../bb-recovery.engine';

const plan = {
  weeks: [{ sessions: [{ exercises: [
    { muscle: 'chest', workSets: [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }] }, // 1600
    { muscle: 'back', workSets: [{ weight: 80, reps: 10 }] }, // 800
  ] }] }],
};

describe('bb-recovery (R1-R3)', () => {
  it('R1 rehabProtocol: фазы возврата', () => {
    const p = rehabProtocol(1);
    expect(p).toHaveLength(6);
    expect(p[0].volumePct).toBe(0.5);
    expect(p[0].rirShift).toBe(2);
    expect(p[4].volumePct).toBe(0.85);
    expect(rehabWeekForWeek(1)).not.toBeNull();
    expect(rehabWeekForWeek(10)).toBeNull(); // после 6 недель — полный объём
  });

  it('R1 rehabExerciseAdjustment только для травмированной мышцы', () => {
    const adj = rehabExerciseAdjustment({ muscle: 'chest' }, 1, ['chest']);
    expect(adj).not.toBeNull();
    expect(adj!.volumeMult).toBe(0.5);
    expect(rehabExerciseAdjustment({ muscle: 'back' }, 1, ['chest'])).toBeNull();
  });

  it('R1 rehabNotes содержит протокол', () => {
    expect(rehabNotes('chest')).toContain('нед 1 ×50%');
    expect(rehabNotes('chest')).toContain('RIR+2');
  });

  it('R2 extractPlanTonnage', () => {
    const t = extractPlanTonnage(plan);
    expect(t.byMuscle.chest).toBe(1600);
    expect(t.byMuscle.back).toBe(800);
    expect(t.total).toBe(2400);
  });

  it('R2 tonnageProgression: рост между мезо', () => {
    const p1 = { weeks: [{ sessions: [{ exercises: [{ muscle: 'chest', workSets: [{ weight: 100, reps: 8 }] }] }] }] }; // 800
    const p2 = { weeks: [{ sessions: [{ exercises: [{ muscle: 'chest', workSets: [{ weight: 110, reps: 8 }] }] }] }] }; // 880 → рост 1.1
    expect(tonnageProgression([p1, p2])).toBeCloseTo(1.1);
    expect(tonnageProgression([p1])).toBe(1.0);
    expect(tonnageProgression([])).toBe(1.0);
  });

  it('R2 nextMesoVolumeTarget применяет прогрессию с капом', () => {
    const p1 = { weeks: [{ sessions: [{ exercises: [{ muscle: 'chest', workSets: [{ weight: 100, reps: 8 }] }] }] }] };
    const p3 = { weeks: [{ sessions: [{ exercises: [{ muscle: 'chest', workSets: [{ weight: 130, reps: 8 }] }] }] }] }; // рост 1.3 → кап 1.15
    expect(nextMesoVolumeTarget([p1, p3], 20)).toBe(Math.round(20 * 1.15));
  });

  it('R3 overreachingCheck', () => {
    expect(overreachingCheck(60, 75).cleared).toBe(true);
    expect(overreachingCheck(60, 62).cleared).toBe(false);
    expect(overreachingCheck(60, 75, { muscleSoreness: 4 }).cleared).toBe(false);
    expect(overreachingCheck(80, 80).cleared).toBe(true); // высокая после
    const r = overreachingCheck(55, 55);
    expect(r.recommendation).toContain('overreaching');
  });

  it('R1 applyRehabToPlan: снижает объём/вес/RIR травмированной мышцы по неделям', () => {
    const plan = { weeks: [
      { week: 1, sessions: [{ exercises: [
        { muscle: 'chest', sets: 4, workSets: [{ weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }], rir: 2 },
        { muscle: 'back', sets: 3, workSets: [{ weight: 80, reps: 10, rir: 3 }, { weight: 80, reps: 10, rir: 3 }, { weight: 80, reps: 10, rir: 3 }], rir: 3 },
      ] }] },
      { week: 2, sessions: [{ exercises: [
        { muscle: 'chest', sets: 4, workSets: [{ weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }], rir: 2 },
      ] }] },
    ] };
    const r = applyRehabToPlan(plan as any, ['chest'], 1);
    expect(r.changes.length).toBeGreaterThan(0);
    // нед1: chest 4 → 2 сета (×0.5), вес 100→70 (×0.7), RIR 2→4 (+2)
    const w1chest = plan.weeks[0].sessions[0].exercises[0];
    expect(w1chest.workSets!.length).toBe(2);
    expect(w1chest.workSets![0].weight).toBeCloseTo(70);
    expect(w1chest.workSets![0].rir).toBeCloseTo(4);
    // back не тронут
    expect(plan.weeks[0].sessions[0].exercises[1].workSets!.length).toBe(3);
    // нед2: chest 4 → 2 сета (×0.5)
    expect(plan.weeks[1].sessions[0].exercises[0].workSets!.length).toBe(2);
  });

  it('R1 applyRehabToPlan: no-op без травмированных мышц', () => {
    const plan = { weeks: [{ week: 1, sessions: [{ exercises: [{ muscle: 'chest', sets: 4, workSets: [{ weight: 100, reps: 8, rir: 2 }] }] }] }] };
    const r = applyRehabToPlan(plan as any, [], 1);
    expect(r.changes).toHaveLength(0);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets!.length).toBe(1);
  });
});
