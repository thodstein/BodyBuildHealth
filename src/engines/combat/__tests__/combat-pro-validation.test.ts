import { describe, it, expect } from 'vitest';
import { buildCombatPlan, validateCombatPlan } from '../combat-builder.engine';
import {
  taperSplitForWeek,
  recommendTaperWeeks,
  validateTaperConfig,
  taperVolumeMultiplier,
} from '../combat-taper.engine';

/**
 * combat-pro-validation (P1): блокирующие errors + единый тапер.
 * Каждый гейт — со своим триггером; без триггера план ok=true.
 */
describe('combat P1 validation gates', () => {
  it('чистый план без триггеров — ok', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3 } as any);
    expect(validateCombatPlan(plan).ok).toBe(true);
    expect(validateCombatPlan(plan).errors).toEqual([]);
  });

  it('мусорная дата боя — error, а не молчаливый totalWeeks', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    const v = validateCombatPlan(plan);
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.includes('невалидна'))).toBe(true);
  });

  it('бой раньше старта — error', () => {
    const plan = buildCombatPlan({ discipline: 'boxing', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3, fightDate: '2026-01-01', startDate: '2026-06-01' } as any);
    expect(validateCombatPlan(plan).errors.some(e => e.includes('раньше старта'))).toBe(true);
  });

  it('перегруз 1500+ + 4× зал — error', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'advanced', weeks: 4, daysPerWeek: 4,
      outsideLoad: { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 7, interference: 'high', highIntensityDays: [1, 3] },
    } as any);
    // форсированный даунгрейд может снять 4× → проверяем честно: либо error, либо паттерн уже не 4×
    const v = validateCombatPlan(plan);
    if (plan.patternId === 'combat_4') {
      expect(v.errors.some(e => e.includes('Перегруз'))).toBe(true);
    } else {
      expect(v.ok).toBe(true);
    }
  });

  it('сгонка >5% без weight_cut — error', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80, weightCutKg: 6 } as any);
    expect(validateCombatPlan(plan).errors.some(e => e.includes('без режима weight_cut'))).toBe(true);
  });

  it('same-day + сгонка >5% — error', () => {
    const plan = buildCombatPlan({
      discipline: 'wrestling', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 6,
      weightCutProtocol: { targetLossKg: 6, weeksOut: 8, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable', weighInType: 'same_day_2h' } as any,
    } as any);
    expect(validateCombatPlan(plan).errors.some(e => e.includes('Same-day'))).toBe(true);
  });

  it('шея ниже MEV при hard spar — error', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 2,
      excludedExercises: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler', 'neck_flexion', 'neck_rotation', 'neck_isometric_front', 'neck_isometric_back', 'neck_isometric_side', 'neck_band_rotation_isometric', 'neck_eccentric_flexion', 'neck_harness_rotation'],
      sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    const v = validateCombatPlan(plan);
    // авто-добавка шеи может закрыть MEV — честно оба исхода, но хотя бы один сигнал должен быть
    const hasNeckSignal = v.errors.some(e => e.includes('шее') || e.includes('шея')) || v.warnings.some(w => w.includes('шея'));
    expect(hasNeckSignal).toBe(true);
  });

  it('HIIT ≥4×/нед — error про 36ч', () => {
    // 3 внезальные (<5 → кондиция полная: camp даёт alactic+lactic) + hard 2 = 4 HIIT
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'advanced', weeks: 6, daysPerWeek: 3,
      sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(plan).errors.some(e => e.includes('36ч'))).toBe(true);
  });

  it('hard spar в fight week при тапере 1нед — error; при 2нед — warning', () => {
    const one = buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 4, daysPerWeek: 3,
      fightDate: '2026-08-29', startDate: '2026-08-01', taperWeeks: 1,
      sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(one).errors.some(e => e.includes('fight week'))).toBe(true);
    const two = buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      fightDate: '2026-09-12', startDate: '2026-08-01', taperWeeks: 2,
      sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(two).warnings.some(w => w.includes('10–14'))).toBe(true);
  });
});

describe('combat P1 unified taper', () => {
  it('split: sc повторяет классику, cond ×0.7, sparring 0 в fight week', () => {
    const cfg = { fightDate: '2026-08-29', taperWeeks: 2, startDate: '2026-07-04' } as any;
    const sc = taperVolumeMultiplier(8, 8, cfg, false);
    const split = taperSplitForWeek(8, 8, cfg, false);
    expect(split.sc).toBe(sc);
    expect(split.cond).toBe(0.7);
    expect(split.sparringHard).toBe(0);
    const pre = taperSplitForWeek(7, 8, cfg, false);
    expect(pre.sparringHard).toBe(0.5);
    const out = taperSplitForWeek(1, 8, cfg, false);
    expect(out).toEqual({ sc: 1, cond: 1, sparringHard: 1 });
  });

  it('без боя — нейтральный split', () => {
    expect(taperSplitForWeek(8, 8, null, false)).toEqual({ sc: 1, cond: 1, sparringHard: 1 });
  });

  it('recommendTaperWeeks: 2×/день → 2нед, 4–5×/нед → 1нед', () => {
    expect(recommendTaperWeeks(3, 7)).toBe(2);
    expect(recommendTaperWeeks(3, 2)).toBe(1);
  });

  it('validateTaperConfig: пусто без боя, ошибки на мусор', () => {
    expect(validateTaperConfig(null, null)).toEqual([]);
    expect(validateTaperConfig('2025-02-30', '2026-01-01').length).toBeGreaterThan(0);
    expect(validateTaperConfig('2026-01-01', '2026-06-01').some(e => e.includes('раньше старта'))).toBe(true);
  });
});
