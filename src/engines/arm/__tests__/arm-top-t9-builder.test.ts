import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 8,
};

const weekSets = (pl: any, week: number, muscle: string) =>
  pl.weeks[week - 1].sessions.reduce((a: number, s: any) => a + s.exercises.filter((e: any) => e.muscle === muscle).reduce((aa: number, e: any) => aa + e.sets, 0), 0);

describe('arm TOP T9 встройка в билдер', () => {
  it('без TOP-входов — нет TOP-строк', () => {
    const p: any = buildArmPlan({ ...BASE });
    const all = p.rationale.join(' ');
    expect(all).not.toMatch(/Матчап:/);
    expect(all).not.toMatch(/RFD:/);
    expect(all).not.toMatch(/L\/R сплит:/);
  });
  it('матчап toproll растит пронаторы, валидатор чист', () => {
    const base: any = buildArmPlan({ ...BASE });
    const mp: any = buildArmPlan({ ...BASE, oppStyle: 'toproll' });
    expect(weekSets(mp, 1, 'pronators')).toBeGreaterThanOrEqual(weekSets(base, 1, 'pronators'));
    expect(mp.rationale.join(' ')).toMatch(/Матчап:/);
    expect(validateArmPlan(mp, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('RFD-метка только в intensification и только с флагом', () => {
    const plain: any = buildArmPlan({ ...BASE });
    const rfd: any = buildArmPlan({ ...BASE, rfd: true });
    const hasRfd = (pl: any) => pl.weeks.some((w: any) => w.sessions.some((s: any) => s.exercises.some((e: any) => String(e.comment || '').includes('RFD speed'))));
    expect(hasRfd(plain)).toBe(false);
    expect(hasRfd(rfd)).toBe(true);
    // метка не в делоаде/пике
    for (const w of rfd.weeks) {
      if (w.deload || w.phase === 'peaking') {
        for (const s of w.sessions) for (const e of s.exercises) expect(String(e.comment || '')).not.toMatch(/RFD speed/);
      }
    }
    expect(rfd.rationale.join(' ')).toMatch(/RFD:/);
  });
  it('L/R 80/100 даёт сплит-строку, симметрия — нет', () => {
    const asym: any = buildArmPlan({ ...BASE, leftKg: 80, rightKg: 100 });
    expect(asym.rationale.join(' ')).toMatch(/L\/R сплит:/);
    const sym: any = buildArmPlan({ ...BASE, leftKg: 97, rightKg: 100 });
    expect(sym.rationale.join(' ')).not.toMatch(/L\/R сплит:/);
  });
});
