/**
 * strength-sport-vbt-history.test.ts — per-lift VBT-история бьёт в id плана
 * (clean → clean_and_jerk, squat → back_squat) через vbtHistoryForLift,
 * а стратегия попыток ТА реально доходит до раскладки (не всегда 'balanced').
 */
import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';

const base = {
  mode: 'weightlifting',
  goal: 'strength',
  level: 'intermediate',
  weeks: 4,
  daysPerWeek: 3,
  bodyweight: 80,
  sex: 'male',
  age: 30,
  workMax: { backSquat: 120, deadlift: 160, snatch: 70, cleanJerk: 90, overheadPress: 60 },
} as any;

function cleanRirs(plan: any): number[] {
  const out: number[] = [];
  for (const wk of plan.weeksData.slice(0, 2)) {
    for (const s of wk.sessions) {
      for (const e of s.exercises) {
        if (String(e.id).includes('clean')) {
          for (const ws of e.workSets) out.push(ws.rir);
        }
      }
    }
  }
  return out;
}

describe('VBT history per-lift matching', () => {
  it('история clean режет толчок (RIR выше, чем без истории)', () => {
    const plain = buildStrengthSportPlan({ ...base });
    const withHist = buildStrengthSportPlan({
      ...base,
      velocityHistory: { clean: [1.6, 1.15] },
    });
    const baseRirs = cleanRirs(plain);
    const histRirs = cleanRirs(withHist);
    expect(baseRirs.length).toBeGreaterThan(0);
    expect(histRirs.length).toBeGreaterThan(0);
    // 28% потери > порога TA 10% → RIR+1 на толчковых
    expect(Math.max(...histRirs)).toBeGreaterThan(Math.max(...baseRirs));
  });

  it('скаляр 0 и пустая история план не меняют', () => {
    const plain = buildStrengthSportPlan({ ...base });
    const same = buildStrengthSportPlan({ ...base, velocityHistory: {} });
    expect(JSON.stringify(same.weeksData)).toBe(JSON.stringify(plain.weeksData));
  });
});

describe('WL meet strategy threading', () => {
  it('aggressive даёт другую заявку, чем balanced', () => {
    const bal = buildStrengthSportPlan({ ...base });
    const agg = buildStrengthSportPlan({ ...base, contestStrategy: 'aggressive' });
    expect((bal as any).wlMeetPlan).toBeTruthy();
    expect((agg as any).wlMeetPlan.strategy).toBe('aggressive');
    expect((agg as any).wlMeetPlan.snatch.opener).not.toBe((bal as any).wlMeetPlan.snatch.opener);
  });
});
