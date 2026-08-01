import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB rotation finalization parity', () => {
  it('does not report accessory repetition across a phase boundary', () => {
    const plan: any = {
      pattern: {}, rationale: [], rotationMuscleVolume: {}, weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 2, workSets: [{ reps: 12, rir: 3, weight: 15 }, { reps: 12, rir: 3, weight: 15 }] }] }] },
        { week: 2, phase: 'peaking', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 2, workSets: [{ reps: 12, rir: 3, weight: 15 }, { reps: 12, rir: 3, weight: 15 }] }] }] },
      ],
    };
    const result = finalizeBBPlan(plan, { reorder: false, preserveSource: true, level: 'intermediate' });
    expect(result.rotationReport?.issues.some(issue => issue.code === 'accessory_repeated')).toBe(false);
  });

  it('keeps final report available after repeated finalization', () => {
    const first = buildBBPlan({ patternId: 'fullbody_3', level: 'intermediate', goal: 'mass', weeks: 4, workMax: { chest: 100, back: 120, quads: 140 } });
    const second = finalizeBBPlan(first, { reorder: true, level: 'intermediate' });
    expect(second.report).toBeTruthy();
    expect(second.weeklyVolume).toBeTruthy();
    expect(second.validation).toBeTruthy();
  });
});
