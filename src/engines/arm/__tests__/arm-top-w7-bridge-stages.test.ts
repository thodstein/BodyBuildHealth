import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { injectTableCorrections } from '../arm-table-inject.engine';
import { buildArmCalendar } from '../arm-calendar.engine';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 6,
};

const SLIP = [{ fouls: 0, slip: true, win: false }, { fouls: 0, slip: true, strap: true, win: false }];

describe('arm TOP wave-7 bridge + stages + inject', () => {
  it('схватка-мост: срывы из журнала дают инъекцию в план', () => {
    const p: any = buildArmPlan({ ...BASE, patternId: 'arm_2_table_support', bouts: SLIP });
    expect(p.rationale.join(' ')).toMatch(/Table-IQ: containment/);
    const has = p.weeks[0].sessions.some((s: any) => s.exercises.some((e: any) => e.exerciseId === 'finger_containment_band'));
    expect(has).toBe(true);
    expect(validateArmPlan(p, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('без журнала — план без инъекции', () => {
    const p: any = buildArmPlan({ ...BASE });
    expect(p.rationale.join(' ')).not.toMatch(/containment/);
  });
  it('дубль пропускается честно', () => {
    const p: any = buildArmPlan({ ...BASE, patternId: 'arm_2_table_support', bouts: SLIP });
    const r = injectTableCorrections(p, SLIP, {});
    expect(r.injected).toBe(0);
    expect(r.notes.join(' ')).toMatch(/дубль/);
  });
  it('только фолы — лифта нет, есть процедура-нота', () => {
    const p: any = buildArmPlan({ ...BASE });
    const r = injectTableCorrections(p, [{ fouls: 2, win: false }], {});
    expect(r.injected).toBe(0);
    expect(r.notes.join(' ')).toMatch(/процедурой/);
  });
  it('MRV-гард режет инъекцию', () => {
    const p: any = buildArmPlan({ ...BASE });
    const r = injectTableCorrections(p, SLIP, { mrvByMuscle: { risers: 1 } });
    expect(r.injected).toBe(0);
    expect(r.notes.join(' ')).toMatch(/MRV/);
  });
  it('countdown несёт stages года', () => {
    const cal = buildArmCalendar({ series: 'waf_worlds' });
    expect(cal.stages.reduce((a, s) => a + s.weeks, 0)).toBe(52);
    expect(cal.stages[cal.stages.length - 1].name).toBe('Пик Worlds');
  });
});
