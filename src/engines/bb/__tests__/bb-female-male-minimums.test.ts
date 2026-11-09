import { describe, expect, it } from 'vitest';
import { buildBBPlan, DEFAULT_WORKMAX } from '../bb-builder.engine';
import { isWidowmakerExercise } from '../bb-rep-schemes.engine';

/**
 * Аудит 2026-11: женские/мужские минимумы на рабочем пике и неприкосновенность
 * схемных упражнений (DC 1 слот, widowmaker 20 повторов) после поздних добивок.
 */

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
const YEARS: Record<string, number> = { beginner: 1, intermediate: 3, advanced: 5, enhanced: 8 };

function canon(m: string): string {
  const s = String(m || '').toLowerCase();
  if (s.includes('delt') || s.includes('shoulder')) return 'shoulders';
  return s;
}

function workingExercises(w: any): any[] {
  return (w.sessions || []).flatMap((s: any) => (s.exercises || []).filter((e: any) => !e.warmupActivator));
}

function totalSets(w: any): number {
  return workingExercises(w).reduce((a, e) => a + (e.sets || 0), 0);
}

function directSets(w: any, muscle: string): number {
  return workingExercises(w).filter(e => canon(e.muscle) === muscle)
    .reduce((a, e) => a + (e.sets || 0), 0);
}

/** Лучшая рабочая неделя: без делода/тапера/пика и без последних 2 недель
 *  (там поздние добивки намеренно не работают — зона подводки). */
function bestWorkingWeek(plan: any): any {
  const weeks = plan.weeks.filter((w: any) => !w.deload && w.phase !== 'deload'
    && w.taperApplied !== true && w.taper !== true
    && w.contestPhase !== 'taper' && w.contestPhase !== 'peak_week' && w.peakWeek !== true
    && w.week !== 1 && !(typeof w.rampMult === 'number' && w.rampMult < 0.85)
    && !(plan.weeks.length >= 4 && w.week >= plan.weeks.length - 2));
  return weeks.reduce((best: any, w: any) => (totalSets(w) > totalSets(best) ? w : best), weeks[0]);
}

function build(patternId: string, level: string, sex: 'male' | 'female', weeks = 8): any {
  const enhanced = level === 'enhanced';
  return buildBBPlan({
    patternId, level, sex, goal: 'mass', weeks, workMax: DEFAULT_WORKMAX, equipment: EQ,
    volumeGoal: 'mav', trainingYears: YEARS[level] ?? 3, onCourse: enhanced,
    ...(enhanced ? { peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate' } : {}),
  } as never);
}

describe('BB: минимумы на рабочем пике (женщины)', () => {
  const cases: Array<[string, string, number, number]> = [
    // pattern, level, glutes-min, delts-min
    ['female_glute_3', 'beginner', 9, 5],
    ['female_glute_3', 'intermediate', 16, 5],
    ['female_glute_3', 'advanced', 16, 9],
    ['female_lower_upper_4', 'intermediate', 16, 6],
    ['female_upper_glute_4', 'intermediate', 16, 6],
    ['female_glute_5', 'intermediate', 16, 6],
    ['female_glute_6', 'intermediate', 16, 6],
    ['female_wellness_5', 'intermediate', 16, 7],
    ['female_bikini_5', 'enhanced', 12, 10],
  ];
  for (const [pattern, level, gluteMin, deltMin] of cases) {
    it(`${pattern}/${level}: ягодицы/дельты/бицепс на пике, без дублей и одиночных сетов`, () => {
      const plan = build(pattern, level, 'female');
      const w = bestWorkingWeek(plan);
      expect(w, 'нет рабочей недели').toBeTruthy();
      expect(directSets(w, 'glutes'), `нед ${w.week}: ягодицы`).toBeGreaterThanOrEqual(gluteMin);
      expect(directSets(w, 'shoulders'), `нед ${w.week}: дельты`).toBeGreaterThanOrEqual(deltMin);
      expect(directSets(w, 'biceps'), `нед ${w.week}: бицепс`).toBeGreaterThanOrEqual(3);
      for (const s of w.sessions || []) {
        const names = (s.exercises || []).filter((e: any) => !e.warmupActivator).map((e: any) => String(e.name || ''));
        expect(new Set(names).size, `нед ${w.week}/${s.sessionTag}: дубли упражнений`).toBe(names.length);
      }
      // DC-1-сет — легитимное исключение; обычных одиночных сетов быть не должно.
      const singles = workingExercises(w).filter((e: any) => (e.sets || 0) < 2 && !/DC Rest-Pause/i.test(String(e.comment || '')));
      expect(singles.map((e: any) => `${e.name}:${e.sets}`), `нед ${w.week}: одиночные сеты`).toEqual([]);
    });
  }
});

describe('BB: минимумы на рабочем пике (мужчины)', () => {
  const cases: Array<[string, string]> = [
    ['ppl_6', 'enhanced'],
    ['push_pull_legs_4', 'enhanced'],
    ['upper_lower_4', 'intermediate'],
  ];
  for (const [pattern, level] of cases) {
    it(`${pattern}/${level}: руки/икры/ягодицы/дельты не на нуле`, () => {
      const plan = build(pattern, level, 'male');
      const w = bestWorkingWeek(plan);
      expect(directSets(w, 'biceps'), `нед ${w.week}: бицепс`).toBeGreaterThanOrEqual(4);
      expect(directSets(w, 'triceps'), `нед ${w.week}: трицепс`).toBeGreaterThanOrEqual(4);
      expect(directSets(w, 'calves'), `нед ${w.week}: икры`).toBeGreaterThanOrEqual(4);
      expect(directSets(w, 'glutes'), `нед ${w.week}: ягодицы`).toBeGreaterThanOrEqual(4);
      expect(directSets(w, 'shoulders'), `нед ${w.week}: дельты`).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('BB: поздние добивки не ломают схемы', () => {
  it('DC: каждый primary в intensification остаётся 1 рабочим слотом', () => {
    const plan: any = buildBBPlan({
      patternId: 'upper_lower_6', weeks: 12, level: 'enhanced', trainingYears: 9, goal: 'strength_mass',
      workMax: { chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7, glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7 },
      sex: 'male', peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate',
    } as never);
    for (const w of plan.weeks.filter((x: any) => x.phase === 'intensification')) {
      for (const s of w.sessions) for (const e of s.exercises) {
        if (e.warmupActivator || e.role !== 'primary') continue;
        if (/DC Rest-Pause/i.test(String(e.comment || ''))) {
          expect(e.sets, `W${w.week}: ${e.name} — DC 1 слот`).toBe(1);
        }
      }
    }
  });

  it('widowmaker: host сохраняет 20-повторный сет после поздних добивок', () => {
    const plan: any = buildBBPlan({
      patternId: 'push_pull_legs_4', level: 'enhanced', trainingYears: 4, goal: 'mass', weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50, glutes: 160, hamstrings: 90, quads: 120 },
      equipment: EQ, volumeGoal: 'mav', sex: 'male', onCourse: true, dcMode: true, pedDoses: { AAS: 1000 },
    } as never);
    const hosts = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => isWidowmakerExercise(e));
    expect(hosts.length).toBeGreaterThan(0);
    for (const h of hosts) {
      expect((h.workSets || []).some((ws: any) => Number(ws.reps) === 20), `${h.name}: 20 повторов`).toBe(true);
    }
  });
});
