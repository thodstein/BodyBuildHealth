import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { buildArmPrintHtml } from '../arm-export.engine';

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

describe('arm TOP wave-5 deep', () => {
  it('RFD: настоящий протокол 5×3 RPE8 отдых 90', () => {
    const p: any = buildArmPlan({ ...BASE, rfd: true });
    const intens = p.weeks.filter((w: any) => w.phase === 'intensification');
    expect(intens.length).toBeGreaterThan(0);
    const speed = intens.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).filter((e: any) => String(e.comment || '').startsWith('RFD speed 5×3'));
    expect(speed.length).toBeGreaterThan(0);
    for (const e of speed) {
      expect(e.sets).toBeLessThanOrEqual(5);
      expect(e.repsRange).toEqual([3, 3]);
      expect(e.workSets[0].restSeconds).toBe(90);
      expect(e.workSets.length).toBe(e.sets);
    }
  });
  it('Grip-RPE peak режет хват и поднимает RIR', () => {
    const base: any = buildArmPlan({ ...BASE });
    const peak: any = buildArmPlan({ ...BASE, gripPhase: 'peak' });
    expect(weekSets(peak, 1, 'grip_support')).toBeLessThanOrEqual(weekSets(base, 1, 'grip_support'));
    const gripEx = peak.weeks[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.muscle === 'grip_support');
    const gripBase = base.weeks[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.muscle === 'grip_support');
    if (gripEx && gripBase) expect(gripEx.rir).toBeGreaterThanOrEqual(gripBase.rir);
  });
  it('Grip-RPE исполнение: peak → overcrush, intensification → negatives', () => {
    const peak: any = buildArmPlan({ ...BASE, gripPhase: 'peak' });
    const over = peak.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => String(e.comment || '').includes('overcrush'));
    expect(over.length).toBeGreaterThan(0);
    expect(over[0].holdSeconds).toBe(12);
    const inten: any = buildArmPlan({ ...BASE, gripPhase: 'intensification' });
    const neg = inten.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => String(e.comment || '').includes('negatives 5'));
    expect(neg.length).toBeGreaterThan(0);
    expect(neg[0].workSets[0].tempo).toBe('5-1-1-0');
    const base: any = buildArmPlan({ ...BASE });
    const all = base.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
    expect(all.some((e: any) => /overcrush|negatives 5/.test(String(e.comment || '')))).toBe(false);
  });
  it('Table-IQ: фолы режут side, срывы растят containment', () => {
    const base: any = buildArmPlan({ ...BASE });
    const iq: any = buildArmPlan({ ...BASE, bouts: [{ fouls: 2, slip: true, win: false }, { fouls: 1, slip: true, win: true }] });
    expect(weekSets(iq, 1, 'side_pressure')).toBeLessThanOrEqual(weekSets(base, 1, 'side_pressure'));
    expect(weekSets(iq, 1, 'risers')).toBeGreaterThanOrEqual(weekSets(base, 1, 'risers'));
    expect(validateArmPlan(iq, 'intermediate').mrvOverflow || []).toEqual([]);
  });
  it('sim пережил finalize: taper+note+инвариант+валиден', () => {
    const p: any = buildArmPlan({ ...BASE, contestSim: true });
    const f: any = finalizeArmPlan(p, { level: 'intermediate' });
    const last = f.weeks[f.weeks.length - 1];
    expect(last.taper).toBe(true);
    expect(String(last.note || '')).toMatch(/Contest-sim/);
    for (const s of last.sessions) for (const e of s.exercises) expect(e.workSets.length).toBe(e.sets);
    expect(validateArmPlan(f, 'intermediate').valid).toBe(true);
  });
  it('печать показывает TOP: rationale + комментарии', () => {
    const p: any = buildArmPlan({ ...BASE, oppStyle: 'toproll', rfd: true });
    const html = buildArmPrintHtml(p);
    expect(html).toContain('Матчап:');
    expect(html).toContain('RFD speed 5×3');
  });
  it('инвариант sets===workSets после finalize на матрице (балансные добивки)', () => {
    const pats = ['arm_4_upper_lower', 'arm_3_full', 'arm_2_table_support', 'arm_5_specialized'];
    for (const patternId of pats) {
      for (const technique of ['hook', 'toproll', 'press', 'balanced']) {
        for (const level of ['beginner', 'intermediate', 'advanced']) {
          const p: any = buildArmPlan({ discipline: 'armwrestling', patternId, level, goal: 'strength', technique, weeks: 4 });
          const f: any = finalizeArmPlan(p, { level });
          for (const w of f.weeks) for (const s of w.sessions) for (const e of s.exercises) {
            expect(e.workSets.length, `${patternId}/${technique}/${level} ${e.name}`).toBe(e.sets);
          }
        }
      }
    }
  });
});
