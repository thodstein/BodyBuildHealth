import { describe, expect, it } from 'vitest';
import { autoAssignIntensityTechniques } from '../bb-finalize.engine';

/**
 * P2 (качество): отказные техники (дропы/rest-pause/myo-reps) не назначаются
 * в пик/тейпер-недели. Реализация силы идёт через RIR-дрифт и топ-сеты;
 * отказная добивка в пик-неделю — мусорная усталость перед тестом.
 * Accumulation — назначается как раньше.
 */

const mkEx = (muscle: string, name: string) => ({
  muscle, name, exerciseName: name, role: 'accessory' as const, character: 'памп' as const,
  sets: 3, repsRange: [12, 15] as [number, number], rir: 3, restSeconds: 60, comment: '',
  workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: 30, restSeconds: 60 })),
});

const curlWeek = (phase: any, extra: any = {}) => ({
  week: 1, phase, ...extra,
  sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Pull', exercises: [
    mkEx('biceps', 'Подъём штанги на бицепс'),
  ] }],
});

const hasTechnique = (plan: any): boolean =>
  plan.weeks[0].sessions[0].exercises[0].workSets.some((ws: any) => ws.technique);

describe('P2: техники не в пик/тейпер', () => {
  it('accumulation — назначается (rest_pause на сгибание)', () => {
    const plan: any = { rationale: [], weeks: [curlWeek('accumulation')] };
    autoAssignIntensityTechniques(plan, 'advanced');
    expect(hasTechnique(plan)).toBe(true);
  });

  it('peaking — скип', () => {
    const plan: any = { rationale: [], weeks: [curlWeek('peaking')] };
    autoAssignIntensityTechniques(plan, 'advanced');
    expect(hasTechnique(plan)).toBe(false);
  });

  it('taper-флаг — скип', () => {
    const plan: any = { rationale: [], weeks: [curlWeek('accumulation', { taper: true })] };
    autoAssignIntensityTechniques(plan, 'advanced');
    expect(hasTechnique(plan)).toBe(false);
  });

  it('contest-prep пик-неделя — скип', () => {
    const plan: any = { rationale: [], weeks: [curlWeek('accumulation', { contestPhase: 'peak_week' })] };
    autoAssignIntensityTechniques(plan, 'advanced');
    expect(hasTechnique(plan)).toBe(false);
  });
});
