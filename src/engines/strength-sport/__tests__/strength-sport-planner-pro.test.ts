/**
 * strength-sport-planner-pro.test.ts — P1–P7 планировщика (каждый эпик со своим триггером).
 */
import { describe, it, expect } from 'vitest';
import {
  weightClassFor, weightToClassBoundary, weightClassLine,
  applyRpeCap, RPE_CAP_DEFAULT,
  deadliftGripWarning, STONE_ARMS_CUE, VIKING_GATE_NOTE, isStoneId, isDeadliftId,
  scoreCheckin, pushCheckin, SS_CHECKIN_CAP,
  deloadWeeksFor, autoDeloadEffective, DELOAD_VS_TAPER_NOTE,
  shouldClearVbt, progHashOf,
  cessationDaysFor, OPENER_SINGLE_NOTE,
} from '../strength-sport-planner-pro.engine';
import { taperMultForWeek } from '../strength-sport-taper.engine';
import { isKvExcludedKey } from '../../../core/cloud-kv';

describe('P1 весовая категория', () => {
  it('граница 105/105.1 → разные классы (М)', () => {
    expect(weightClassFor(105, 'male')).toBe('<105');
    expect(weightClassFor(105.1, 'male')).toBe('105+');
  });
  it('Ж-классы ×0.6-шкала', () => {
    expect(weightClassFor(64, 'female')).toBe('<65');
    expect(weightClassFor(80, 'female')).toBe('75+');
  });
  it('до границы −X кг + перевес + open без границы', () => {
    expect(weightToClassBoundary(104.1, '<105', 'male')).toBeCloseTo(0.9, 1);
    expect(weightToClassBoundary(106, '<105', 'male')).toBeCloseTo(-1, 1);
    expect(weightToClassBoundary(120, 'open', 'male')).toBeNull();
    expect(weightClassLine(104.1, '<105', 'male')).toContain('−0.9');
  });
});

describe('P2 RPE-cap', () => {
  it('дефолт 9.5; RPE 10 → −2.5% + cut', () => {
    expect(RPE_CAP_DEFAULT).toBe(9.5);
    const r = applyRpeCap(200, 10, 9.5);
    expect(r.cut).toBe(true);
    expect(r.weight).toBe(195);
  });
  it('submax не трогаем (RPE < cap)', () => {
    const r = applyRpeCap(200, 8, 9.5);
    expect(r.cut).toBe(false);
    expect(r.weight).toBe(200);
  });
  it('шаг 2.5кг округление', () => {
    const r = applyRpeCap(101, 10, 9.5);
    expect(r.weight % 2.5).toBe(0);
  });
});

describe('P3 хват-безопасность', () => {
  it('mixed 90% → warn, лямки → тихо, 70% → тихо', () => {
    expect(deadliftGripWarning('mixed', 0.9)).toContain('PMC8237209');
    expect(deadliftGripWarning('straps', 0.9)).toBeNull();
    expect(deadliftGripWarning('mixed', 0.7)).toBeNull();
  });
  it('камень/тяга резолв + cue-строки', () => {
    expect(isStoneId('atlas_stone_load')).toBe(true);
    expect(isStoneId('log_press')).toBe(false);
    expect(isDeadliftId('car_deadlift_18')).toBe(true);
    expect(STONE_ARMS_CUE).toContain('канаты');
    expect(VIKING_GATE_NOTE).toContain('no-rep');
  });
});

describe('P4 чекины', () => {
  it('1/5 → делод, 5/5 → тихо', () => {
    expect(scoreCheckin({ eventFatigue: 1, grip: 1, back: 1, sleep: 1, appetite: 1 }).suggestDeload).toBe(true);
    expect(scoreCheckin({ eventFatigue: 5, grip: 5, back: 5, sleep: 5, appetite: 5 }).suggestDeload).toBe(false);
  });
  it('кап 12, кламп 1–5', () => {
    let list: any[] = [];
    for (let i = 0; i < 20; i++) list = pushCheckin(list, { eventFatigue: 9, grip: 0, back: 3, sleep: 3, appetite: 3 });
    expect(list.length).toBe(SS_CHECKIN_CAP);
    expect(scoreCheckin(list[0]).score).toBeLessThanOrEqual(5);
  });
});

describe('P5 block-модель', () => {
  it('toro4 нед.10 → ×0.65; strong5 → null (Winwood у вызывателя)', () => {
    expect(taperMultForWeek('toro4', 1)).toBe(0.65);
    expect(taperMultForWeek('strong5', 1)).toBeNull();
    expect(taperMultForWeek('wave', 1)).toBeNull();
  });
  it('делод 4/7/11 + opt-out', () => {
    expect(deloadWeeksFor(12, true)).toEqual([4, 7, 11]);
    expect(deloadWeeksFor(12, false)).toEqual([]);
    expect(deloadWeeksFor(5, true)).toEqual([4]);
    expect(DELOAD_VS_TAPER_NOTE).toContain('Rogerson');
  });
  it('живой чек-ин: скор ≤2 включает делоды, норма — нет', () => {
    const bad = { eventFatigue: 1, grip: 2, back: 1, sleep: 2, appetite: 1 };
    const good = { eventFatigue: 5, grip: 5, back: 5, sleep: 5, appetite: 5 };
    expect(autoDeloadEffective(false, bad)).toBe(true);
    expect(autoDeloadEffective(false, good)).toBe(false);
    expect(autoDeloadEffective(false, null)).toBe(false);
    expect(autoDeloadEffective(true, good)).toBe(true);
  });
});

describe('P6 гигиена', () => {
  it('смена cycleId/mode чистит vbtMap; тот же → нет', () => {
    expect(shouldClearVbt('a', 'b', 'strongman', 'strongman')).toBe(true);
    expect(shouldClearVbt('a', 'a', 'strongman', 'weightlifting')).toBe(true);
    expect(shouldClearVbt('a', 'a', 'strongman', 'strongman')).toBe(false);
  });
  it('хэш различает контест/diag', () => {
    expect(progHashOf({ contestId: 'a' })).not.toBe(progHashOf({ contestId: 'b' }));
  });
});

describe('P7 cessation + opener', () => {
  it('Ж-cessation короче М; без пола — база', () => {
    expect(cessationDaysFor(7, 'female')).toBe(7);
    expect(cessationDaysFor(7, 'male')).toBe(8);
    expect(cessationDaysFor(7)).toBe(7);
    expect(OPENER_SINGLE_NOTE).toContain('Opener');
  });
});

describe('D5 cloud: PRO-ключи синкаются (he_-автосинк, не в исключениях)', () => {
  it('he_ss_pro_*, he_ss_checkin_v1, he_vbt_ss_v1 — не excluded', () => {
    for (const k of ['he_ss_pro_weightclass', 'he_ss_pro_rpecap', 'he_ss_pro_grip', 'he_ss_pro_block', 'he_ss_pro_autodeload', 'he_ss_pro_condday', 'he_ss_checkin_v1', 'he_vbt_ss_v1']) {
      expect(isKvExcludedKey(k)).toBe(false);
    }
  });
});
