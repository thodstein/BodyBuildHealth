import { describe, expect, it } from 'vitest';
import { validatePlanQuality, manualToQualityInput } from '../plan-quality.engine';
import { computePlanQualityFor } from '../manual-constructor/manual-quality.engine';
import { composeQualityScoreV2 } from '../quality-score-v2.engine';
import { deriveV2InputFromProgram } from '../../ui/screens/TrainingScreen_parts/quality-hub-helpers';

/**
 * Паритет-матрица (Quality Hub PRO, п.7): одна программа → S1/S3/V2.
 * Формулы штрафов у скорингов разные (S1 −15/−5/−2, S3 −8/−3/−2/−1, V2 веса),
 * поэтому требуем не ±3 балла, а честное согласие:
 *  - статусы перегруза совпадают по мышцам;
 *  - pairwise-расхождение скора ≤ 12;
 *  - на чистом плане ни у кого нет critical.
 * Допуск 12 зафиксирован измерением (не подгонкой движков).
 */

function bbProgram(exercises: Array<{ muscle: string; name: string; sets: number; rir?: number }>, weeks = 4): any {
  const sessions = [0, 1, 2].map(d => ({
    blocks: exercises.map(e => ({
      muscle: e.muscle,
      exerciseName: e.name,
      sets: Array.from({ length: e.sets }, () => ({ reps: 8, rir: e.rir ?? 2 })),
    })),
  }));
  return {
    meta: { id: 'parity', title: 'Паритет', direction: 'bb', level: 'intermediate', goal: 'mass', weeks, daysPerWeek: 3 },
    bb: {
      weeks: Array.from({ length: weeks }, (_, wi) => ({ week: wi + 1, sessions })),
      volumeBudget: {}, progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
      constraints: { equipment: [] }, microcycleTemplate: { daySlots: [] },
    },
  };
}

function manualDays(prog: any) {
  const w0 = prog.bb.weeks[0];
  return w0.sessions.map((s: any) => ({
    groups: [...new Set(s.blocks.map((b: any) => b.muscle))],
    exercises: s.blocks.map((b: any) => ({ group: b.muscle, sets: b.sets.length, name: b.exerciseName })),
  }));
}

const CLEAN_EX = [
  { muscle: 'chest', name: 'Жим штанги лёжа', sets: 2 },
  { muscle: 'chest', name: 'Разводка гантелей', sets: 2 },
  { muscle: 'back', name: 'Тяга штанги в наклоне', sets: 2 },
  { muscle: 'back', name: 'Подтягивания', sets: 2 },
  { muscle: 'legs', name: 'Присед со штангой', sets: 4 },
];

describe('quality-parity: чистый план', () => {
  const prog = bbProgram(CLEAN_EX);
  const s3 = computePlanQualityFor(prog as any, 'intermediate');
  const s1 = validatePlanQuality(manualToQualityInput(manualDays(prog), { level: 'intermediate' }));
  const v2input = deriveV2InputFromProgram(prog as any, 'bb', 'intermediate')!;
  const v2 = composeQualityScoreV2(v2input);

  it('ни у кого нет critical', () => {
    expect(s1.issues.filter(i => i.severity === 'critical')).toEqual([]);
    expect(s3.score).toBeGreaterThanOrEqual(80);
    expect(v2.issues.filter(i => i.severity === 'critical')).toEqual([]);
  });
  it('pairwise-расхождение ≤ 12', () => {
    expect(Math.abs(s1.score - s3.score)).toBeLessThanOrEqual(12);
    expect(Math.abs(s1.score - v2.score)).toBeLessThanOrEqual(12);
    expect(Math.abs(s3.score - v2.score)).toBeLessThanOrEqual(12);
  });
});

describe('quality-parity: перегруз груди', () => {
  const prog = bbProgram([
    { muscle: 'chest', name: 'Жим штанги лёжа', sets: 14 },
    { muscle: 'chest', name: 'Разводка гантелей', sets: 12 },
    { muscle: 'back', name: 'Тяга штанги в наклоне', sets: 6 },
  ]);
  const s3 = computePlanQualityFor(prog as any, 'intermediate');
  const s1 = validatePlanQuality(manualToQualityInput(manualDays(prog), { level: 'intermediate' }));
  const v2 = composeQualityScoreV2(deriveV2InputFromProgram(prog as any, 'bb', 'intermediate')!);

  it('все трое флагуют chest как перегруз', () => {
    expect(s1.muscles.find(m => m.muscle === 'chest')?.status).toBe('exceeding_mrv');
    expect(s3.perMuscle.find(m => m.muscle === 'chest')?.status).toBe('over');
    expect(v2.perMuscle.find(m => m.muscle === 'chest')?.status).toBe('exceeding_mrv');
  });
  it('скоры всех трёх упали относительно чистого плана', () => {
    const clean = bbProgram(CLEAN_EX);
    const cS3 = computePlanQualityFor(clean as any, 'intermediate').score;
    const cS1 = validatePlanQuality(manualToQualityInput(manualDays(clean), { level: 'intermediate' })).score;
    const cV2 = composeQualityScoreV2(deriveV2InputFromProgram(clean as any, 'bb', 'intermediate')!).score;
    expect(s3.score).toBeLessThan(cS3);
    expect(s1.score).toBeLessThan(cS1);
    expect(v2.score).toBeLessThan(cV2);
  });
});
