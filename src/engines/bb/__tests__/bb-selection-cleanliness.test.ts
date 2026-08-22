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

  it('отчёт выявляет низкоценные и кросс-мышечные упражнения (decline, пуловер в груди)', () => {
    const plan = buildBBPlan({ patternId: 'fullbody_3', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const issues = checkBBExerciseAppropriateness(plan);
    // либо decline-жим, либо кросс-мышечное несоответствие должно быть отмечено в generic fullbody
    expect(issues.some(i => /негативн|decline/.test(i)) || issues.some(i => /тренирует «/.test(i))).toBe(true);
  });
});
