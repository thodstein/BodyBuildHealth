import { describe, it, expect } from 'vitest';
import { checkHumerusAxis } from '../arm-humerus-axis.engine';
import { checkAntagonistMinimum, checkAntagonistPlan } from '../arm-antagonist.engine';
import { ARM_MEDLEYS, getMedley, simulateMedley, medleyRotationForWeek } from '../arm-medley.engine';
import { buildForWeek, forGate } from '../arm-for.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { applyArmPro } from '../arm-pro-integration.engine';

describe('arm-cycle-safety-medley (P2)', () => {
  it('axis: пусто = low без warnings', () => {
    const r = checkHumerusAxis({});
    expect(r.risk).toBe('low');
    expect(r.warnings.length).toBe(0);
  });
  it('axis: ротация + разрыв + запястье = high', () => {
    const r = checkHumerusAxis({ trunkRotatedTowardAttack: true, wristElbowShoulderAligned: false, wristBehindShoulder: true });
    expect(r.risk).toBe('high');
    expect(r.score).toBe(3);
    expect(r.warnings.length).toBe(3);
  });
  it('axis: защита + макс = красный флаг', () => {
    const r = checkHumerusAxis({ fightingFromDefense: true, sideMaxAttempt: true });
    expect(r.warnings.some((w) => /62%/.test(w))).toBe(true);
  });
  it('antagonist: flex без ext — warning', () => {
    const r = checkAntagonistMinimum({ wristFlex: 8, wristExt: 0, pron: 0, sup: 0, fingerFlexSets: 0, fingerExtSets: 0, shoulderIntSets: 0 }, 1);
    expect(r.warnings.some((w) => /wrist_ext/.test(w))).toBe(true);
  });
  it('antagonist: баланс — чисто', () => {
    const r = checkAntagonistMinimum({ wristFlex: 8, wristExt: 4, pron: 6, sup: 4, fingerFlexSets: 8, fingerExtSets: 3, shoulderIntSets: 4 }, 2);
    expect(r.warnings.length).toBe(0);
  });
  it('antagonist plan: по неделям', () => {
    const r = checkAntagonistPlan({ 1: { wrist_flexors: 8, wrist_extensors: 0 }, 2: { wrist_flexors: 4, wrist_extensors: 4 } });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.notes.length).toBe(2);
  });
  it('medley: 4 шаблона, ротация циклична', () => {
    expect(ARM_MEDLEYS.length).toBe(4);
    expect(getMedley('worlds_2026')?.events.length).toBe(3);
    expect(medleyRotationForWeek('worlds_2026', 1)).toBe('apollon_axle');
    expect(medleyRotationForWeek('worlds_2026', 4)).toBe('apollon_axle');
    expect(getMedley('nope')).toBeUndefined();
  });
  it('medley sim: промах закрывает событие, сумма лучших', () => {
    const r = simulateMedley('rt_saxon_hub', [
      { eventIdx: 0, weightKg: 100, success: true },
      { eventIdx: 0, weightKg: 110, success: false },
      { eventIdx: 0, weightKg: 120, success: true }, // игнор — событие закрыто промахом
      { eventIdx: 1, weightKg: 80, success: true },
    ]);
    expect(r.best[0]).toBe(100);
    expect(r.best[1]).toBe(80);
    expect(r.done[0]).toBe(true);
    expect(r.total).toBe(180);
    expect(r.note).toMatch('Классика');
  });
  it('FOR: 7 дней, rebound + retest', () => {
    const p = buildForWeek('pinch');
    expect(p.days.length).toBe(7);
    expect(p.rebound).toMatch('Rebound');
    expect(p.retest).toMatch('10–14');
  });
  it('FOR gate: новичкам запрет, advanced чисто', () => {
    expect(forGate({ level: 'beginner' }).allowed).toBe(false);
    expect(forGate({ level: 'advanced' }).allowed).toBe(true);
    expect(forGate({ level: 'advanced', cnsHeavyDays: 3 }).allowed).toBe(false);
    expect(forGate({ level: 'advanced', tendonOver: true }).allowed).toBe(false);
  });
  it('pro-integration: axis/medley/for строки', () => {
    const r: any = applyArmPro({
      discipline: 'armlifting', patternId: 'grip_3_support', level: 'advanced', goal: 'strength', technique: 'balanced', weeks: 4,
      axisCheck: { trunkRotatedTowardAttack: true }, medleyId: 'worlds_2026', forMode: true, forSpecialization: 'support',
    } as any);
    expect(r.axisLine).toBeTruthy();
    expect(r.medleyLine).toBeTruthy();
    expect(r.forLine).toBeTruthy();
    expect(r.warnings.some((w: string) => /Ось/.test(w))).toBe(true);
  });
  it('validator: антагонисты — только warnings, valid не ломается', () => {
    const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 2 });
    const v = validateArmPlan(p, 'intermediate');
    expect(Array.isArray(v.warnings)).toBe(true);
    // valid определяется только errors+mrvOverflow — антагонисты его не меняют
    expect(v.valid).toBe(v.errors.length === 0 && (v.mrvOverflow || []).length === 0);
  });
});
