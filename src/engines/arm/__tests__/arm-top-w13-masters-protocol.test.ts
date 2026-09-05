import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { injectGripProtocol } from '../arm-grip-protocol.engine';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 8,
};

describe('arm TOP wave-13 masters + protocols', () => {
  it('masters 50+: делоад каждая 3-я', () => {
    const p: any = buildArmPlan({ ...BASE, ageYears: 55 });
    const deloads = p.weeks.filter((w: any) => w.deload).map((w: any) => w.week);
    expect(deloads).toContain(3);
    expect(deloads).toContain(6);
    expect(p.rationale.join(' ')).toMatch(/Masters 50\+/);
    expect(validateArmPlan(p, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('молодые: делоад каждая 4-я', () => {
    const p: any = buildArmPlan({ ...BASE, ageYears: 30 });
    const deloads = p.weeks.filter((w: any) => w.deload).map((w: any) => w.week);
    expect(deloads).toContain(4);
    expect(deloads).not.toContain(3);
    expect(p.rationale.join(' ')).not.toMatch(/Masters 50\+/);
  });
  it('overcrush-протокол в пике (замена, объём недели цел)', () => {
    const p: any = buildArmPlan({ ...BASE, gripPhase: 'peak' });
    const all = p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
    const over = all.filter((e: any) => String(e.comment || '').includes('Overcrush-протокол'));
    expect(over.length).toBe(1);
    expect(over[0].sets).toBeLessThanOrEqual(3);
    expect(over[0].workSets.length).toBe(over[0].sets);
    expect(over[0].holdSeconds).toBe(10);
    // замена не растит недельный объём выше базы без протокола
    const plain: any = buildArmPlan({ ...BASE });
    const tot = (pl: any) => pl.weeks.reduce((a: number, w: any) => a + w.sessions.reduce((x: number, s: any) => x + s.exercises.reduce((y: number, e: any) => y + e.sets, 0), 0), 0);
    expect(tot(p)).toBeLessThanOrEqual(tot(plain));
    expect(validateArmPlan(p, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('negatives-протокол в интенсификации', () => {
    const p: any = buildArmPlan({ ...BASE, gripPhase: 'intensification' });
    const all = p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
    const neg = all.filter((e: any) => String(e.comment || '').includes('Negatives-протокол'));
    expect(neg.length).toBe(1);
    expect(neg[0].workSets[0].tempo).toBe('5-1-1-0');
  });
  it('без фазы — протоколов нет', () => {
    const p: any = buildArmPlan({ ...BASE });
    const all = p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
    expect(all.some((e: any) => /Overcrush-протокол|Negatives-протокол/.test(String(e.comment || '')))).toBe(false);
  });
  it('inject: гарды (нет хоста — пропуск)', () => {
    const p: any = buildArmPlan({ ...BASE });
    const r = injectGripProtocol(p, 'over', { muscle: 'grip_crush' });
    expect(r.injected).toBe(false);
    expect(r.note).toMatch(/Нет grip_crush-упражнения/);
    // вход не мутируется
    expect(JSON.stringify(p)).toBe(JSON.stringify(buildArmPlan({ ...BASE })));
  });
});
