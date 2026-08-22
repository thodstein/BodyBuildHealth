import { describe, it, expect } from 'vitest';
import { sessionLimitsFor } from '../bb-volume.engine';
import { buildBBPlan } from '../bb-builder.engine';

describe('F0: sessionLimitsFor капы от уровня (freeze 24/40/60)', () => {
  it('beginner без фармы 24/10 — 60 недоступно', () => {
    const l = sessionLimitsFor({ level: 'beginner', trainingYears: 2 });
    expect(l.maxWorkingSets).toBe(24);
    expect(l.maxExercises).toBe(10);
  });
  it('intermediate без фармы 24/10', () => {
    const l = sessionLimitsFor({ level: 'intermediate', trainingYears: 1 });
    expect(l.maxWorkingSets).toBe(24);
  });
  it('enhanced 0 лет + без onCourse -> 40/14 (а не 60)', () => {
    const l = sessionLimitsFor({ level: 'enhanced', trainingYears: 0 });
    // after fix: enhanced 0 лет должен быть 40, не 60
    expect(l.maxWorkingSets).toBe(40);
    expect(l.maxExercises).toBe(14);
  });
  it('enhanced 1 год -> 40/14', () => {
    const l = sessionLimitsFor({ level: 'enhanced', trainingYears: 1 });
    expect(l.maxWorkingSets).toBe(40);
  });
  it('enhanced 3 года -> 60/18', () => {
    const l = sessionLimitsFor({ level: 'enhanced', trainingYears: 3 });
    expect(l.maxWorkingSets).toBe(60);
    expect(l.maxExercises).toBe(18);
  });
  it('natural 3 года + onCourse -> 60/18', () => {
    const l = sessionLimitsFor({ level: 'intermediate', trainingYears: 3, onCourse: true, peds: ['AAS'] });
    expect(l.maxWorkingSets).toBe(60);
  });
});

describe('F0: onCourse строковые дозы', () => {
  it('500mg строка считается onCourse', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: { chest: 100, back: 100, shoulders: 50, biceps: 40, triceps: 40, quads: 140, hamstrings: 100, glutes: 150 } as any,
      pedDoses: { AAS: '500mg' as any },
    } as any);
    // regimeMult >1 -> mrvByMuscle выше базы; проверим что план не упал и содержит недели
    expect(plan.weeks.length).toBe(4);
    expect(plan.weeks[0].sessions.length).toBeGreaterThan(0);
  });
});

describe('F0: weeks guard 0 -> warn but not throw', () => {
  it('weeks=0 не падает (fallback 8)', () => {
    expect(() => buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 0 as any,
      workMax: {},
    } as any)).not.toThrow();
  });
});

describe('F0: validator NaN guard', () => {
  it('workSet с NaN weight ловится как invalid_work_set', async () => {
    const { validateBBPlan } = await import('../bb-validator.engine');
    const plan: any = {
      weeks: [{
        week: 1, sessions: [{
          day: 1, sessionTag: 'Chest', exercises: [{
            name: 'Жим штанги лёжа',
            muscle: 'chest',
            sets: 1,
            repsRange: [8, 12],
            rir: 2,
            workSets: [{ weight: NaN, reps: 8, rir: 2 }],
          }],
        }],
      }],
      pattern: { id: 'upper_lower_4' },
    };
    const res = validateBBPlan(plan, {});
    expect(res.issues.some(i => i.code === 'invalid_work_set')).toBe(true);
  });
});

describe('Объёмный vs обычный — капы freeze', () => {
  it('beginner high volume still 24 cap via sessionLimits', () => {
    const standard = sessionLimitsFor({ level: 'beginner', trainingYears: 2 });
    const high = sessionLimitsFor({ level: 'beginner', trainingYears: 2, onCourse: false });
    expect(standard.maxWorkingSets).toBe(24);
    expect(high.maxWorkingSets).toBe(24);
  });
  it('buildBBPlan high volume (mrv) vs standard (mav) — high не превышает cap 24 для новичка', () => {
    const base = {
      patternId: 'upper_lower_4', level: 'beginner', goal: 'mass' as const, weeks: 4,
      workMax: { chest: 100, back: 100, shoulders: 50, biceps: 40, triceps: 40, quads: 140, hamstrings: 100, glutes: 150 } as any,
    };
    const standard = buildBBPlan({ ...base, volumeGoal: 'mav' } as any);
    const high = buildBBPlan({ ...base, volumeGoal: 'mrv' } as any);
    // per-session working sets not exceed 24 for beginner (weekly can be up to 96 for 4 sessions)
    for (const ses of high.weeks[0].sessions) {
      const ws = ses.exercises.filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + e.sets, 0);
      expect(ws).toBeLessThanOrEqual(24);
    }
    for (const ses of standard.weeks[0].sessions) {
      const ws = ses.exercises.filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + e.sets, 0);
      expect(ws).toBeLessThanOrEqual(24);
    }
  });
});
