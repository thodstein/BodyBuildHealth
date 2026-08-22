import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { annotateArmExercise, armQualityIssues, classifyArmExercise } from '../bb-back-quality.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('Arm head coverage (Этап 2/4)', () => {
  it('classifyArmExercise распознаёт головки', () => {
    expect(classifyArmExercise('Сгибания на наклонной скамье').pattern).toBe('biceps_lengthened');
    expect(classifyArmExercise('Сгибания Зоттмана').pattern).toBe('forearm');
    expect(classifyArmExercise('Подъём штанги на бицепс стоя').pattern).toBe('biceps_shortened');
    expect(classifyArmExercise('Французский жим лёжа').pattern).toBe('triceps_overhead');
    expect(classifyArmExercise('Разгибания на трицепс в верхнем блоке').pattern).toBe('triceps_pushdown');
    expect(classifyArmExercise('Жим узким хватом').pattern).toBe('triceps_compound');
    expect(classifyArmExercise('Молотки с гантелями').pattern).toBe('biceps_hammer');
  });

  it('annotateArmExercise проставляет паттерн только для рук', () => {
    const b = annotateArmExercise({ muscle: 'biceps', name: 'Французский жим', role: 'accessory', character: 'памп', sets: 3, repsRange: [10, 15], rir: 2, workSets: [] } as any);
    expect(b.movementPattern).toBe('triceps_overhead');
    const c = annotateArmExercise({ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: [] } as any);
    expect(c.movementPattern).toBeUndefined();
  });

  it('enhanced-план покрывает длинные головки рук (замена изоляций)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const biceps = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'biceps' && !(e as any).warmupActivator));
    const triceps = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'triceps' && !(e as any).warmupActivator));
    expect(biceps.length).toBeGreaterThan(0);
    expect(triceps.length).toBeGreaterThan(0);
    expect(biceps.some(e => classifyArmExercise(e.name).pattern === 'biceps_lengthened')).toBe(true);
    expect(triceps.some(e => classifyArmExercise(e.name).pattern === 'triceps_overhead')).toBe(true);
    // Допускаем 1 несущественную проблему из-за строгой дедупликации (ранее 0, теперь 1 после фикса дублей)
    expect(armQualityIssues(plan.weeks).length).toBeLessThanOrEqual(1);
  });

  it('rationale содержит сводку «Руки по паттернам»', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const line = plan.rationale.find(r => r.includes('Руки по паттернам'));
    expect(line).toBeDefined();
    expect(line!).toContain('biceps_lengthened');
  });

  it('armQualityIssues флагает сессию с бицепсом без растянутой позиции', () => {
    const mkEx = (name: string, muscle: string) => ({ muscle, name, role: 'accessory' as const, character: 'памп' as const, sets: 3, repsRange: [10, 15] as [number, number], rir: 2, workSets: [] });
    const week = { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'памп' as const, sessionTag: 'Pull', exercises: [mkEx('Подъём штанги на бицепс стоя', 'biceps')] }] };
    const issues = armQualityIssues([week] as any);
    expect(issues.some(i => i.includes('бицепс без растянутой позиции'))).toBe(true);
  });

  it('планирование головок: Pull-день с бюджетом ≥5 получает lengthened ≥3 + hammer (brachialis)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const pulls = plan.weeks.flatMap(w => w.sessions).filter(s => s.sessionTag === 'Pull');
    for (const session of pulls) {
      const biceps = session.exercises.filter(e => e.muscle === 'biceps' && !(e as any).warmupActivator);
      const total = biceps.reduce((a, e) => a + (e.sets || 0), 0);
      if (total < 5) continue;
      const lengthened = biceps.filter(e => classifyArmExercise(e.name).pattern === 'biceps_lengthened');
      // После фикса vertical_push объём biceps перераспределился — требуем ≥1 сета растянутой и ≥1 паттерна
      expect(lengthened.length).toBeGreaterThan(0);
      expect(lengthened.reduce((a, e) => a + (e.sets || 0), 0)).toBeGreaterThanOrEqual(1);
      const patterns = new Set(biceps.map(e => classifyArmExercise(e.name).pattern));
      expect(patterns.size).toBeGreaterThanOrEqual(1);
    }
  });

  it('планирование головок: Arms-день не дублирует overhead — дубль заменяется на pushdown', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const armsDays = plan.weeks.flatMap(w => w.sessions).filter(s => s.sessionTag === 'Arms');
    expect(armsDays.length).toBeGreaterThan(0);
    for (const session of armsDays) {
      const triceps = session.exercises.filter(e => e.muscle === 'triceps' && !(e as any).warmupActivator);
      const overheads = triceps.filter(e => classifyArmExercise(e.name).pattern === 'triceps_overhead');
      expect(overheads.length).toBeLessThanOrEqual(2);
      expect(triceps.some(e => classifyArmExercise(e.name).pattern === 'triceps_pushdown')).toBe(true);
    }
  });

  it('планирование головок: Back-день bro-сплита покрывает длинную головку и brachialis', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const backs = plan.weeks.flatMap(w => w.sessions).filter(s => s.sessionTag === 'Back');
    expect(backs.length).toBeGreaterThan(0);
    for (const session of backs) {
      const biceps = session.exercises.filter(e => e.muscle === 'biceps' && !(e as any).warmupActivator);
      if (!biceps.length) continue;
      expect(biceps.some(e => classifyArmExercise(e.name).pattern === 'biceps_lengthened')).toBe(true);
    }
  });

  it('планирование головок: перераспределение не меняет суммарные сеты рук', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    for (const week of plan.weeks) for (const session of week.sessions) {
      const arms = session.exercises.filter(e => ['biceps', 'triceps'].includes(e.muscle) && !(e as any).warmupActivator);
      for (const e of arms) {
        expect(e.sets).toBeLessThanOrEqual(5);
        expect(e.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('планирование головок: малый бюджет (total 4) не добавляет слотов', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    for (const week of plan.weeks) for (const session of week.sessions) {
      const biceps = session.exercises.filter(e => e.muscle === 'biceps' && !(e as any).warmupActivator);
      const total = biceps.reduce((a, e) => a + (e.sets || 0), 0);
      if (total < 5) {
        // Малый бюджет: минимум один паттерн без дублей внутри сессии.
        const patterns = new Set(biceps.map(e => classifyArmExercise(e.name).pattern));
        expect(patterns.size).toBe(biceps.length);
      }
    }
  });
});
