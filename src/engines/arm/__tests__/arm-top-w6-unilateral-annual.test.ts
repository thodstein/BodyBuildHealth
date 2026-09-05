import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { buildArmBlock, buildArmYearBlocks } from '../arm-annual';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 6,
};

const totalSets = (pl: any) =>
  pl.weeks.reduce((a: number, w: any) => a + w.sessions.reduce((aa: number, s: any) => aa + s.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0), 0);

const allComments = (pl: any): string[] =>
  pl.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).map((e: any) => String(e.comment || ''));

describe('arm TOP wave-6 unilateral + meso-ladder + annual', () => {
  it('унилатеральная добивка слабой без изменения объёма', () => {
    const base: any = buildArmPlan({ ...BASE });
    const asym: any = buildArmPlan({ ...BASE, leftKg: 80, rightKg: 100 });
    expect(allComments(asym).some((c) => c.includes('унилатерально слабой (left)'))).toBe(true);
    expect(allComments(base).some((c) => c.includes('унилатерально'))).toBe(false);
    expect(totalSets(asym)).toBe(totalSets(base));
    expect(validateArmPlan(asym, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('симметрия — без унилатеральных пометок', () => {
    const p: any = buildArmPlan({ ...BASE, leftKg: 97, rightKg: 100 });
    expect(allComments(p).some((c) => c.includes('унилатерально'))).toBe(false);
  });
  it('лестница кросс-мезо: рост → готов, стагнация → держать', () => {
    const prev: any = buildArmPlan({ ...BASE, ladderFrom: 'rolling_thunder', ladderValue: 60 });
    const up: any = buildArmPlan({ ...BASE, ladderFrom: 'rolling_thunder', ladderValue: 75, previousPlan: prev });
    expect(up.rationale.join(' ')).toMatch(/Лестница rolling_thunder: \+25%.*готов/);
    const flat: any = buildArmPlan({ ...BASE, ladderFrom: 'rolling_thunder', ladderValue: 62, previousPlan: prev });
    expect(flat.rationale.join(' ')).toMatch(/держать базу/);
  });
  it('годовой блок пропускает TOP-поля', () => {
    const res = buildArmBlock({ blockKey: 'top', weeks: 4, phase: 'strength' }, { level: 'intermediate', oppStyle: 'toproll', contestSim: true } as any);
    expect(res.armPlan.rationale.join(' ')).toMatch(/Матчап:/);
    expect(res.armPlan.weeks[res.armPlan.weeks.length - 1].taper).toBe(true);
  });
  it('год из шаблона: сумма недель и фазы', () => {
    const year = buildArmYearBlocks('waf_worlds', 52, { level: 'intermediate' });
    expect(year.reduce((a, b) => a + b.weeks, 0)).toBe(52);
    expect(year[year.length - 1].phase).toBe('peaking');
    const ss = buildArmYearBlocks('super_series', 24, {});
    expect(ss.reduce((a, b) => a + b.weeks, 0)).toBe(24);
    expect(ss.some((b) => b.phase === 'peaking')).toBe(true);
  });
});
