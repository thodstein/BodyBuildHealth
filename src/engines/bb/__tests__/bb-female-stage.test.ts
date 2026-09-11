import { describe, it, expect } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { validateBBPlan } from '../bb-validator.engine';

/**
 * Сцена: бикини ×2 + бодифитнес + дельты + wellness.
 * Источники: Traisha Martin 12w prep (M&S) + Mikolo core + M&S Women Trainer
 * + критерии Manion/NPC/IFBB (bikini мягкость / figure плотность / wellness низ-доминанта).
 * Инварианты как в bb-female-cycles: форма, female-тег, сборка female/adapt,
 * спина ≥ 0.8×груди, quads > 2, валидатор без error, RIR ≥ 1 на подводке.
 */

const STAGE_IDS = [
  'cycle-bb-f-bikini-base-12',
  'cycle-bb-f-bikini-prep-12',
  'cycle-bb-f-bodyfitness-12',
  'cycle-bb-f-delt-8',
  'cycle-bb-f-wellness-12',
];

const workMax = { chest: 60, back: 70, shoulders: 40, arms: 35, quads: 90, hamstrings: 65, glutes: 80, calves: 50, abs: 40, traps: 45, forearms: 30 };

const byId = (id: string) => LMS_CYCLES.find(c => c.meta.id === id)!;
const build = (c: any) => convertCycleToBBPlan({ cycle: c, workMax, level: 'intermediate', mode: 'adapt', sex: 'female' });

const weekly = (plan: any, muscle: string) => {
  let v = 0;
  for (const w of plan.weeks)
    for (const s of w.sessions)
      for (const e of s.exercises)
        if ((e.muscle || '') === muscle) v += (e.workSets || []).length || e.sets || 0;
  return v / Math.max(1, plan.weeks.length);
};

const namesOf = (plan: any) =>
  plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => String(e.name))));

describe('stage: 5 сценических циклов в реестре', () => {
  it('все 5 присутствуют, direction bodybuilding, сессии = week1, female-тег', () => {
    for (const id of STAGE_IDS) {
      const c = byId(id);
      expect(c, id).toBeDefined();
      expect(c.meta.direction).toBe('bodybuilding');
      expect(c.week1.length, id).toBe(c.meta.sessionsPerWeek);
      expect(c.meta.tags, id).toContain('female');
    }
  });

  it('bikini-подводка 12н: 5 сессий, contest-тег, RIR нигде не 0', () => {
    const c = byId('cycle-bb-f-bikini-prep-12');
    expect(c.meta.sessionsPerWeek).toBe(5);
    expect(c.meta.tags).toContain('contest');
    const plan = build(c);
    for (const w of plan.weeks)
      for (const s of w.sessions)
        for (const e of s.exercises)
          for (const ws of e.workSets) expect(ws.rir ?? 2).toBeGreaterThanOrEqual(1);
  });

  it('bikini-база: hip thrust присутствует, верх лёгкий (спина ≥ 0.8×груди)', () => {
    const plan = build(byId('cycle-bb-f-bikini-base-12'));
    expect(namesOf(plan).some(n => /мост|hip/i.test(n))).toBe(true);
    expect(weekly(plan, 'back')).toBeGreaterThanOrEqual(0.8 * weekly(plan, 'chest'));
  });

  it('бодифитнес: квадр-свип (присед + leg press + разгибания) в выдаче', () => {
    const plan = build(byId('cycle-bb-f-bodyfitness-12'));
    const names = namesOf(plan);
    expect(names.some(n => /присед/i.test(n))).toBe(true);
    expect(names.some(n => /жим ногами/i.test(n))).toBe(true);
    expect(names.some(n => /разгибания ног/i.test(n))).toBe(true);
    expect(weekly(plan, 'back')).toBeGreaterThanOrEqual(0.8 * weekly(plan, 'chest'));
  });

  it('дельты: махи в стороны + задняя в наклоне в выдаче, в шаблоне без шрагов', () => {
    const c = byId('cycle-bb-f-delt-8');
    const plan = build(c);
    const names = namesOf(plan);
    expect(names.some(n => /в стороны/i.test(n))).toBe(true);
    expect(names.some(n => /в наклоне/i.test(n))).toBe(true);
    // финализатор вправе добить трапы малой группой — шаблон сам шрагов не несёт
    const tplNames = c.week1.flatMap(d => d.exercises.map(e => String(e.name)));
    expect(tplNames.some(n => /шраги/i.test(n))).toBe(false);
  });

  it('wellness: низ-доминанта — в шаблоне ≥3 дня с 2+ упражнениями на ноги', () => {
    const c = byId('cycle-bb-f-wellness-12');
    const legDays = c.week1.filter(d => d.exercises.filter(e => e.group === 'Ноги').length >= 2).length;
    expect(legDays).toBeGreaterThanOrEqual(3);
    const plan = build(c);
    expect(weekly(plan, 'back')).toBeGreaterThanOrEqual(0.8 * weekly(plan, 'chest'));
  });

  it('нижние сценические циклы несут прямой объём квадр (>2/нед)', () => {
    for (const id of ['cycle-bb-f-bikini-base-12', 'cycle-bb-f-bikini-prep-12', 'cycle-bb-f-bodyfitness-12', 'cycle-bb-f-wellness-12']) {
      expect(weekly(build(byId(id)), 'quads'), id).toBeGreaterThan(2);
    }
  });

  it('все 5 проходят валидатор без error-уровня', () => {
    for (const id of STAGE_IDS) {
      const plan = build(byId(id));
      const r = validateBBPlan(plan, { level: 'intermediate' });
      const errors = r.issues.filter((i: any) => i.level === 'error');
      expect(errors.map((e: any) => e.message), `${id}: ${errors.map((e: any) => e.message).join('; ')}`).toHaveLength(0);
    }
  });
});
