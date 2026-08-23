import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { checkBBExerciseAppropriateness } from '../bb-report.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB: порядок/схемы объёма и адекватность упражнений', () => {
  it('generic-план не содержит PL-лифтов (становая/пендл/рывок/толчок/швунг)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const names = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map(e => e.name);
    expect(names.some(n => /становая|пендл|рывок|толчок|швунг|clean|snatch|power.?clean/.test(n))).toBe(false);
  });

  it('схема объёма FST-7 применяется на памп-сессиях, а не «крадёт» тяж-день', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, volumeScheme: 'fst7' });
    const byTag = (tag: string) => plan.weeks[0].sessions.filter(s => (s.sessionTag || '').toLowerCase().includes(tag));
    const fstOf = (sessions: typeof plan.weeks[0].sessions) => sessions.flatMap(s => s.exercises).filter((e: any) => (e.comment || '').includes('FST-7'));
    const pumpPush = byTag('push').filter(s => s.character === 'памп');
    const heavyPush = byTag('push').filter(s => s.character !== 'памп');
    expect(fstOf(pumpPush).length).toBeGreaterThan(0);
    // тяж-Push НЕ должен нести схему, если она уже размещена на памп-Push
    expect(fstOf(heavyPush).length).toBe(0);
  });

  it('same_muscle суперсет: компаунд+памп-изоляция одной группы («пробить»)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'advanced', goal: 'mass', weeks: 1, workMax: WM, supersetMode: 'same_muscle' });
    const pairs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => e.supersetWith);
    expect(pairs.length).toBeGreaterThan(0);
    // Каждая пара — одна группа: компаунд + изоляция
    for (const p of pairs) {
      expect(p.comment).toMatch(/одна группа/);
    }
  });

  it('pre_exhaust: изоляция → база как пара (пред-истощение)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 1, workMax: WM, methodology: 'pre_exhaust' });
    const pairs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => (e.comment || '').includes('⚡ Пред-истощение'));
    expect(pairs.length).toBeGreaterThan(0);
    // пара существует: изоляция имеет supersetWith на компаунд
    const iso = pairs.find((e: any) => (e.comment || '').includes('без отдыха →'));
    expect(iso).toBeDefined();
    expect(iso.supersetWith).toBeTruthy();
  });

  it('giant superset: 3 упражнения одной группы (гигант-сет)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, supersetMode: 'giant' });
    const giants = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => (e.comment || '').includes('🔄 Гигант-сет'));
    expect(giants.length).toBeGreaterThan(0);
    // гигант-сет — 3 упражнения одной группы (кратно 3)
    expect(giants.length % 3).toBe(0);
  });

  it('разминка: Push начинается с разминки ГРУДИ (не МАХИ-плеч), Pull — спины, Legs — квадрицепса', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const byTag = (tag: string) => plan.weeks[0].sessions.filter(s => (s.sessionTag || '').toLowerCase().includes(tag));
    const firstWarmupMuscle = (sessions: typeof plan.weeks[0].sessions) => {
      const s = sessions.find(ss => (ss.exercises[0] as any).warmupActivator);
      return s ? (s.exercises[0] as any).muscle : null;
    };
    // Push → разминка ГРУДИ, не shoulders
    const pushWarm = firstWarmupMuscle(byTag('push'));
    expect(pushWarm).toBe('chest');
    // Pull → спина
    const pullWarm = firstWarmupMuscle(byTag('pull'));
    expect(pullWarm).toBe('back');
    // Legs → квадрицепс (или другая ножная мышца, но НЕ верх тела)
    const legsWarm = firstWarmupMuscle(byTag('legs'));
    expect(['quads', 'hamstrings', 'glutes', 'calves']).toContain(legsWarm);
  });

  it('decline-жимы отсутствуют в generic-планах', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const names = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map(e => e.name);
    expect(names.some(n => /отриц|decline|отрицательн|негативн/.test(n))).toBe(false);
  });

  it('комментарии содержат читаемый темп (опуск Nс, подъём Nс)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const comments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map((e: any) => e.comment || '');
    const withReadable = comments.filter(c => /опуск \d+с/.test(c));
    expect(withReadable.length).toBeGreaterThan(0);
  });

  it('адекватность: generic-план без decline-флагов', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const issues = checkBBExerciseAppropriateness(plan);
    expect(issues.filter(i => /негативн|decline/.test(i))).toEqual([]);
  });
});
