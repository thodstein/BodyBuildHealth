import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
  glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
  delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
};

describe('G1 attribution probe', () => {
  it('which pass inflates week 1?', () => {
    const p: any = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 4, goal: 'mass',
      weeks: 12, workMax: WM, weakPoints: [], volumeGoal: 'mav',
    } as any);
    const actual = (m: string) => p.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === m && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const target = (p as any).rotationMuscleVolume || (p as any).volumeTargets || {};
    console.log('lm calves: ' + JSON.stringify(getVolumeLandmarks('intermediate', 'calves')));
    console.log('lm chest:  ' + JSON.stringify(getVolumeLandmarks('intermediate', 'chest')));
    console.log('rotationMuscleVolume: ' + JSON.stringify(target));
    console.log('volumeTargets: ' + JSON.stringify(p.volumeTargets));
    console.log('W1 actual: chest=' + actual('chest') + ' calves=' + actual('calves') + ' back=' + actual('back') + ' biceps=' + actual('biceps'));
    console.log('rationale: ' + JSON.stringify((p.rationale || []).slice(0, 14), null, 1));
    expect(true).toBe(true);
  });
});
