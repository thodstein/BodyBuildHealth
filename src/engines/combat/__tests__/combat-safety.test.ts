import { describe, it, expect } from 'vitest';
import { buildCombatPlan, validateCombatPlan } from '../combat-builder.engine';
import {
  teenCombatGates,
  hasWeightManipulation,
  neckExtensionCutoffKg,
  concussionProtocol,
  sparringSafetyErrors,
  screenCombatRedFlags,
  needsCombatMedicalBlock,
  TEEN_BANNED_EXERCISES,
} from '../combat-safety.engine';

/**
 * combat-safety (P3): teen-гейт + concussion + спарринг-гейты.
 * Чистые функции + проводка в билдере (errors, не warnings).
 */
describe('combat-safety engine', () => {
  it('teen 14–15: banned-лист, изометрия only, без hard/manipulation', () => {
    const t = teenCombatGates(14);
    expect(t.isTeen).toBe(true);
    expect(t.bannedExerciseIds).toContain('neck_bridge_wrestler');
    expect(t.bannedExerciseIds).toContain('depth_jump');
    expect(t.isometricNeckOnly).toBe(true);
    expect(teenCombatGates(16).isTeen).toBe(false);
    expect(teenCombatGates(28).bannedExerciseIds).toEqual([]);
    expect(TEEN_BANNED_EXERCISES).toContain('sled_push');
  });

  it('hasWeightManipulation: stable — нет, load_cut/сауна — да', () => {
    expect(hasWeightManipulation(null)).toBe(false);
    expect(hasWeightManipulation({ waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable' })).toBe(false);
    expect(hasWeightManipulation({ waterMode: 'load_cut', sodiumMode: 'stable', carbMode: 'stable' })).toBe(true);
    expect(hasWeightManipulation({ waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable', heatSessions: true })).toBe(true);
  });

  it('neck cutoff: 80кг → ≈30кг (3.71 N/кг), мусор → null', () => {
    expect(neckExtensionCutoffKg(80)).toBeCloseTo(30.2, 0);
    expect(neckExtensionCutoffKg(null)).toBeNull();
    expect(neckExtensionCutoffKg(20)).toBeNull();
  });

  it('concussion: 0 clear / 1 limited / 2+ blocked', () => {
    expect(concussionProtocol(0).stage).toBe('clear');
    expect(concussionProtocol(undefined).stage).toBe('clear');
    const lim = concussionProtocol(1);
    expect(lim.stage).toBe('limited');
    expect(lim.maxHardSpar).toBe(1);
    expect(lim.flexExtMax).toBe(0.74);
    const blk = concussionProtocol(2);
    expect(blk.stage).toBe('blocked');
    expect(blk.checklist.length).toBeGreaterThan(0);
  });

  it('sparringSafetyErrors: каждый триггер со своей строкой, без hard — тишина', () => {
    const base = { isFightWeek: false, isDeloadWeek: false, isTaperWeek: false, neckBelowMev: false, hasExcludeInjury: false };
    expect(sparringSafetyErrors(0, { ...base, isFightWeek: true })).toEqual([]);
    expect(sparringSafetyErrors(2, { ...base, isFightWeek: true }).some(e => e.includes('fight week'))).toBe(true);
    expect(sparringSafetyErrors(1, { ...base, isDeloadWeek: true }).some(e => e.includes('делод'))).toBe(true);
    expect(sparringSafetyErrors(1, { ...base, acwrZone: 'dangerous' }).some(e => e.includes('ACWR'))).toBe(true);
    expect(sparringSafetyErrors(1, { ...base, hrvGrade: 'dangerous' }).some(e => e.includes('HRV'))).toBe(true);
    expect(sparringSafetyErrors(1, { ...base, neckBelowMev: true }).some(e => e.includes('MEV'))).toBe(true);
    expect(sparringSafetyErrors(1, { ...base, hasExcludeInjury: true }).some(e => e.includes('травме'))).toBe(true);
  });

  it('screenCombatRedFlags: мед-блок только на блокирующих', () => {
    expect(screenCombatRedFlags({ age: 28 }).blocked).toBe(false);
    const teenManip = screenCombatRedFlags({ age: 14, manipulation: true });
    expect(teenManip.blocked).toBe(true);
    expect(teenManip.flags.some(f => f.id === 'teen_cut')).toBe(true);
    expect(screenCombatRedFlags({ age: 14, manipulation: false }).blocked).toBe(false);
    expect(screenCombatRedFlags({ concussionHistory: 2 }).blocked).toBe(true);
    expect(screenCombatRedFlags({ concussionHistory: 1 }).blocked).toBe(false);
    expect(screenCombatRedFlags({ weightCutKg: 8, bodyweightKg: 80 }).blocked).toBe(true);
    expect(needsCombatMedicalBlock({ age: 28 })).toBe(false);
  });
});

describe('combat P3 builder wiring', () => {
  it('подросток + hard spar + load_cut — errors, взрослый тот же план — ok', () => {
    const teen = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'beginner', weeks: 4, daysPerWeek: 2,
      age: 14, bodyweight: 60, weightCutKg: 3,
      weightCutProtocol: { targetLossKg: 3, weeksOut: 6, waterMode: 'load_cut', sodiumMode: 'stable', carbMode: 'stable' } as any,
      sparringLoad: { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    const v = validateCombatPlan(teen);
    expect(v.errors.some(e => e.includes('Подросток') && e.includes('hard spar'))).toBe(true);
    expect(v.errors.some(e => e.includes('Подросток') && e.includes('манипуляции'))).toBe(true);
    // взрослый: те же вводы (кроме возраста) — teen-гейтов нет
    const adult = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'beginner', weeks: 4, daysPerWeek: 2,
      age: 28, bodyweight: 60, weightCutKg: 3,
      weightCutProtocol: { targetLossKg: 3, weeksOut: 6, waterMode: 'load_cut', sodiumMode: 'stable', carbMode: 'stable' } as any,
      sparringLoad: { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(adult).errors.some(e => e.includes('Подросток'))).toBe(false);
  });

  it('подростку не едут мост/динамика шеи/плио даже при уровне advanced', () => {
    const plan = buildCombatPlan({
      discipline: 'wrestling', goal: 'power', level: 'advanced', weeks: 4, daysPerWeek: 3, age: 15,
    } as any);
    const ids = plan.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id)));
    expect(ids).not.toContain('neck_bridge_wrestler');
    expect(ids).not.toContain('depth_jump');
    expect(ids).not.toContain('sled_push');
    // изометрия осталась
    expect(ids.some(id => id.includes('neck_isometric'))).toBe(true);
  });

  it('concussion ×2 — мед-блок; ×1 + hard 2 — error; ×1 + hard 1 — ok', () => {
    const blocked = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, concussionHistory: 2 } as any);
    expect(validateCombatPlan(blocked).errors.some(e => e.includes('до врача'))).toBe(true);
    const over = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, concussionHistory: 1,
      sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(over).errors.some(e => e.includes('сотрясение'))).toBe(true);
    const capped = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, concussionHistory: 1,
      sparringLoad: { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(capped).errors.some(e => e.includes('сотрясение') || e.includes('до врача'))).toBe(false);
  });

  it('flex/ext >0.74 + hard — error; без hard — warning', () => {
    const hard = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, neckFlexExtRatio: 0.85,
      sparringLoad: { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(hard).errors.some(e => e.includes('flex/ext'))).toBe(true);
    const soft = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, neckFlexExtRatio: 0.85 } as any);
    const vs = validateCombatPlan(soft);
    expect(vs.errors.some(e => e.includes('flex/ext'))).toBe(false);
    expect(vs.warnings.some(w => w.includes('flex/ext'))).toBe(true);
  });

  it('экстензия ниже cutoff + hard — error', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3,
      bodyweight: 80, neckExtensionKg: 20,
      sparringLoad: { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any,
    } as any);
    expect(validateCombatPlan(plan).errors.some(e => e.includes('Экстензия'))).toBe(true);
  });

  it('hard spar в делод/ACWR-dangerous/HRV-dangerous/exclude — error', () => {
    const spar = { hardSparSessions: 1, techSparSessions: 1, wrestlingSessions: 0 } as any;
    const deload = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 8, daysPerWeek: 3, sparringLoad: spar } as any);
    // 8нед linear: нед 4 делод → gate ловит
    expect(validateCombatPlan(deload).errors.some(e => e.includes('делод'))).toBe(true);
    const acwr = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, sparringLoad: spar, acwr: { ratio: 1.7, zone: 'dangerous' } } as any);
    expect(validateCombatPlan(acwr).errors.some(e => e.includes('ACWR dangerous'))).toBe(true);
    const excl = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, sparringLoad: spar, injuries: [{ location: 'shoulder', exclude: true }] } as any);
    expect(validateCombatPlan(excl).errors.some(e => e.includes('травме'))).toBe(true);
  });
});
