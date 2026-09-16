import { describe, it, expect } from 'vitest';
import {
  injectSMWeakPoints,
  injectSMWeakPointsPreferred,
} from '../strength-sport-sm-injection.engine';

const WM = { yokeWalk: 300, farmersWalk: 140, atlasStone: 120, logPress: 100, backSquat: 160, deadlift: 200, overheadPress: 70 };

function fakePlan() {
  return {
    level: 'intermediate',
    rationale: [],
    workMax: WM,
    weeksData: [{ deload: false, totalSets: 0, sessions: [{ sessionTag: 'event_day', exercises: [] }] }],
  } as any;
}

describe('sm-injection-preferred (C3, паритет TA-C8)', () => {
  it('⭐ вставляется честно: библиотечное id + доза карточки', () => {
    const r = injectSMWeakPoints(fakePlan(), ['stone_off_floor'] as any, {
      workMax: WM,
      preferredCorr: { stone_off_floor: 'sm_stone_off_floor_tech' },
      protocols: { stone_off_floor: { sets: 4, reps: 3, pct: 65 } },
    });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeksData[0].sessions[0].exercises[0];
    expect(ex.id).toBe('deadlift');
    expect(ex.sets).toBe(4);
    expect(ex.name).toContain('High-hips');
    expect(r.notes[0]).toContain('⭐');
    expect(r.notes[0]).toContain('4×3 @65%');
  });
  it('⭐ без protocols — канон записи', () => {
    const r = injectSMWeakPoints(fakePlan(), ['yoke_walk'] as any, {
      workMax: WM,
      preferredCorr: { yoke_walk: 'sm_yoke_walk_tech' },
    });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeksData[0].sessions[0].exercises[0];
    expect(ex.id).toBe('yoke_walk');
    expect(r.notes[0]).toContain('⭐');
  });
  it('чужой ⭐ → legacy fallback без звезды', () => {
    const r = injectSMWeakPoints(fakePlan(), ['stone_off_floor'] as any, {
      workMax: WM,
      preferredCorr: { stone_off_floor: 'sm_yoke_walk_tech' },
    });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeksData[0].sessions[0].exercises[0];
    expect(ex.id).toBe('deficit_pull');
    expect(r.notes[0]).not.toContain('⭐');
  });
  it('без ⭐ — legacy-форма (yoke_walk → sandbag_carry 3×20м)', () => {
    const r = injectSMWeakPoints(fakePlan(), ['yoke_walk'] as any, { workMax: WM });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeksData[0].sessions[0].exercises[0];
    expect(ex.id).toBe('sandbag_carry');
    expect(ex.sets).toBe(3);
    expect(ex.reps).toBe('20м');
    expect(r.notes[0]).not.toContain('⭐');
  });
  it('Preferred-обёртка больше не заглушка: вставляет ⭐', () => {
    const r = injectSMWeakPointsPreferred(fakePlan(), ['farmers_grip'] as any, {
      workMax: WM,
      preferredCorr: { farmers_grip: 'sm_farmers_grip_strength' },
    });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeksData[0].sessions[0].exercises[0];
    expect(ex.id).toBe('hammer_curl');
    expect(r.notes.some((n) => n.includes('выбери вручную'))).toBe(false);
  });
  it('дедуп и бюджет целы со ⭐', () => {
    const p = fakePlan();
    const r1 = injectSMWeakPoints(p, ['stone_off_floor'] as any, {
      workMax: WM,
      preferredCorr: { stone_off_floor: 'sm_stone_off_floor_tech' },
    });
    expect(r1.injected).toBe(1);
    const r2 = injectSMWeakPoints(r1.plan, ['stone_off_floor'] as any, {
      workMax: WM,
      preferredCorr: { stone_off_floor: 'sm_stone_off_floor_tech' },
    });
    expect(r2.injected).toBe(0);
    expect(r2.skippedDup).toBe(1);
  });
});
