/**
 * bb-split-session-realism.test.ts — аудит 2026-09:
 *  • реализм сессий (per-muscle session caps, плотность, капы упражнений);
 *  • специализация не считается «дисбалансом» (жалоба «выбрал слабую спину —
 *    пишет добавьте жимов»);
 *  • диагностика соответствия сплита параметрам пользователя + ориентир сессии.
 */
import { describe, expect, it } from 'vitest';
import {
  computeMuscleBalance, sessionMuscleRealismCap, sessionDensityExerciseCap,
  sessionMuscleExerciseCap, sessionLimitsFor, sessionMuscleClass,
} from '../bb-volume.engine';
import { rankBBSplits, splitFitWarnings, splitSessionBudget } from '../bb-selector.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { analyzeBBBalance } from '../bb-balance.engine';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 120, back: 140, quads: 180, hamstrings: 100, shoulders: 80, biceps: 60, triceps: 70, glutes: 150, calves: 120, abs: 40, traps: 100, forearms: 50 };

describe('реализм сессии: капы', () => {
  it('per-muscle session cap растёт с уровнем/стажем', () => {
    expect(sessionMuscleRealismCap({ muscle: 'back', level: 'intermediate' })).toBe(12);
    expect(sessionMuscleRealismCap({ muscle: 'back', level: 'advanced' })).toBe(13);
    expect(sessionMuscleRealismCap({ muscle: 'back', level: 'enhanced', trainingYears: 6, onCourse: true })).toBe(16);
    expect(sessionMuscleRealismCap({ muscle: 'biceps', level: 'enhanced', trainingYears: 6, onCourse: true })).toBe(10);
  });

  it('плотность дня ужимает только крупные мышцы (mid/small держат PPL-минимумы)', () => {
    const big5 = sessionMuscleRealismCap({ muscle: 'chest', level: 'enhanced', trainingYears: 6, onCourse: true, groupsInSession: 5 });
    const big4 = sessionMuscleRealismCap({ muscle: 'chest', level: 'enhanced', trainingYears: 6, onCourse: true, groupsInSession: 4 });
    expect(big5).toBeLessThan(big4);
    // средние/малые не ужимаются — иначе ломаются PPL-инварианты (руки 8, икры 9)
    expect(sessionMuscleRealismCap({ muscle: 'biceps', level: 'intermediate', groupsInSession: 5 })).toBe(8);
    expect(sessionMuscleRealismCap({ muscle: 'calves', level: 'intermediate', groupsInSession: 4 })).toBe(9);
  });

  it('кап упражнений: ≥2 сета на упражнение и плотность дня', () => {
    expect(sessionMuscleExerciseCap(10)).toBe(5);
    expect(sessionMuscleExerciseCap(3)).toBe(2);
    expect(sessionDensityExerciseCap(5)).toBe(4);
    expect(sessionDensityExerciseCap(6)).toBe(3);
    expect(sessionDensityExerciseCap(10)).toBe(2);
  });

  it('классы мышц', () => {
    expect(sessionMuscleClass('back')).toBe('big');
    expect(sessionMuscleClass('calves')).toBe('mid');
    expect(sessionMuscleClass('triceps')).toBe('small');
  });

  it('капы сессии enhanced: реалистичные (16 упр / 44 сета макс при стаже 6+)', () => {
    const l = sessionLimitsFor({ level: 'enhanced', trainingYears: 6, onCourse: true, peds: ['AAS'] });
    expect(l.maxExercises).toBeLessThanOrEqual(16);
    expect(l.maxWorkingSets).toBeLessThanOrEqual(44);
  });
});

describe('баланс мышц знает про специализацию', () => {
  const weekly = { chest: { effectiveSets: 10 }, back: { effectiveSets: 22 } };

  it('без целей выдаёт классическую рекомендацию', () => {
    const r = computeMuscleBalance(weekly);
    expect(r.issues.some(i => /добавьте жимов/i.test(i))).toBe(true);
  });

  it('спина-цель: вместо «добавьте жимов» — пометка об акценте', () => {
    const r = computeMuscleBalance(weekly, { specTargets: ['back'] });
    expect(r.issues.some(i => /добавьте жимов/i.test(i))).toBe(false);
    expect(r.issues.some(i => /цель акцента/i.test(i))).toBe(true);
  });

  it('грудь-цель: перекос в грудь не помечается как проблема', () => {
    const r = computeMuscleBalance({ chest: { effectiveSets: 24 }, back: { effectiveSets: 10 } }, { specTargets: ['chest_upper'] });
    expect(r.issues.some(i => /добавьте тяг/i.test(i))).toBe(false);
  });

  it('analyzeBBBalance: перекос тяги vs жимы при спине-цели не флагуется', () => {
    const mkPlan = (setsPerMuscle: Record<string, number>) => ({
      pattern: { id: 'upper_lower_4', name: 'Верх/Низ' },
      weeks: [{
        week: 1, phase: 'accumulation',
        sessions: [{
          sessionTag: 'Upper',
          exercises: Object.entries(setsPerMuscle).map(([muscle, sets]) => ({
            muscle, name: muscle === 'back' ? 'Тяга штанги в наклоне' : muscle === 'chest' ? 'Жим штанги лёжа' : 'Упражнение',
            role: 'primary', sets, rir: 2,
            workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 60 })),
          })),
        }],
      }],
      priorityMuscles: ['back'],
    } as any);
    // Спина 24 против груди 8 → без акцента выдало бы «Перекос: жимы X против тяг Y»
    const withAccent = analyzeBBBalance(mkPlan({ back: 24, chest: 8 }), { specTargets: ['back'] });
    expect(withAccent.issues.some(i => /Перекос верхней части: жимы/.test(i))).toBe(false);
    const without = analyzeBBBalance(mkPlan({ back: 24, chest: 8 }));
    expect(without.issues.some(i => /Перекос верхней части: жимы/.test(i))).toBe(true);
  });
});

describe('диагностика сплита под параметры', () => {
  it('splitFitWarnings: уровень/дни/пол', () => {
    expect(splitFitWarnings({ level: 'beginner', goal: 'mass', daysPerWeek: 3 }, 'ppl_6').length).toBeGreaterThan(0);
    expect(splitFitWarnings({ level: 'advanced', goal: 'mass', daysPerWeek: 3 }, 'ppl_6').some(w => /сессий\/нед/.test(w))).toBe(true);
    expect(splitFitWarnings({ level: 'intermediate', goal: 'mass', daysPerWeek: 4, sex: 'male' }, 'female_glute_5').some(w => /женск/i.test(w))).toBe(true);
    // 6 дней + высокий объём → PPL подходит без замечаний; фулбоди — замечание о плотности дня
    expect(splitFitWarnings({ level: 'advanced', goal: 'mass', daysPerWeek: 6, peds: ['AAS'] }, 'ppl_6').length).toBe(0);
    expect(splitFitWarnings({ level: 'advanced', goal: 'mass', daysPerWeek: 3, peds: ['AAS'] }, 'fullbody_3').some(w => /групп/.test(w))).toBe(true);
  });

  it('splitSessionBudget: фулбоди — плотный день и реалистичный ориентир', () => {
    const fullbody = SPLIT_PATTERNS.find(p => p.id === 'fullbody_3')!;
    const ulPattern = SPLIT_PATTERNS.find(p => p.id === 'upper_lower_4')!;
    const fb = splitSessionBudget(fullbody, { level: 'enhanced', peds: ['AAS'] });
    expect(fb.maxGroups).toBeGreaterThanOrEqual(8);
    expect(fb.maxExercises).toBeLessThanOrEqual(16);
    const ul = splitSessionBudget(ulPattern, { level: 'enhanced', peds: ['AAS'] });
    expect(ul.maxGroups).toBe(5);
  });

  it('rankBBSplits отдаёт sessionBudget и наказывает фулбоди при высоком объёме', () => {
    const ranked = rankBBSplits({ level: 'enhanced', goal: 'mass', daysPerWeek: 5, peds: ['AAS'], pedDoses: { AAS: 500 } as any });
    const fb = ranked.find(r => r.pattern.id === 'fullbody_4') || ranked.find(r => r.pattern.id === 'fullbody_5');
    if (fb) expect(fb.warnings.some(w => /групп|мин/.test(w))).toBe(true);
    expect(ranked[0].sessionBudget).toBeTruthy();
    expect(ranked[0].sessionBudget!.maxExercises).toBeLessThanOrEqual(16);
  });
});

describe('E2E: план с акцентом не ругает базу', () => {
  it('weakPoints=[back] → rationale с пометкой акцента, без «добавьте жимов»', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'advanced', trainingYears: 4, goal: 'mass', weeks: 1, workMax: WM,
      weakPoints: ['back'],
    } as any);
    const rationale = (plan.rationale || []).join(' | ');
    expect(rationale).not.toMatch(/добавьте жимов/i);
    expect(rationale).toMatch(/цель акцента/i);
  });

  it('сессии плана в реалистичных рамках (≤16 упр, ≤44 сета working)', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 2, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    } as any);
    for (const w of plan.weeks) for (const s of w.sessions) {
      const working = s.exercises.filter((e: any) => !e.warmupActivator && !e.optional);
      expect(working.length, `${w.week} ${s.sessionTag}`).toBeLessThanOrEqual(16);
      const sets = working.reduce((a: number, e: any) => a + e.sets, 0);
      expect(sets, `${w.week} ${s.sessionTag}`).toBeLessThanOrEqual(44);
    }
  });
});
