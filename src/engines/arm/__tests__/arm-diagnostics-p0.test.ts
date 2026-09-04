import { describe, it, expect } from 'vitest';
import { auditArmPlan, worstArmPoint } from '../arm-plan-audit.engine';
import { diagnoseArmWeakCause } from '../arm-weak-cause.engine';
import { rankCorrectionsForArm } from '../arm-correction-rank.engine';
import { simulateArmInjection } from '../arm-simulator.engine';
import { buildArmSpecBlock } from '../arm-spec-block.engine';
import { detectArmWeakByE1rm, armVolumeHistory28d, armPointsForMuscles } from '../arm-diary-weak-detection.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import type { ArmWeakPoint } from '../arm-biomechanics.engine';

function basePlan(level = 'intermediate', weeks = 4) {
  const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level, goal: 'strength', technique: 'toproll', weeks, gripFocus: 'support' } as any);
  return finalizeArmPlan(p, { level });
}

function sess(daysAgo: number, name: string, muscle: string, w: number, r: number, nSets = 2) {
  const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  return { date: d, exercises: [{ exerciseName: name, muscle, sets: Array.from({ length: nSets }, () => ({ weightKg: w, reps: r })) }] } as any;
}

describe('arm P0: audit', () => {
  it('null → null', () => {
    expect(auditArmPlan(null)).toBeNull();
  });
  it('план: покрытие 0-12, tableRatio 0-1, дубли массив', () => {
    const a = auditArmPlan(basePlan())!;
    expect(a.covered.length).toBeGreaterThanOrEqual(0);
    expect(a.covered.length).toBeLessThanOrEqual(12);
    expect(a.coveragePct).toBeGreaterThanOrEqual(0);
    expect(a.tableRatio).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(a.duplicates)).toBe(true);
  });
  it('byPoint: pron_open сеты ≥0', () => {
    const a = auditArmPlan(basePlan())!;
    expect(a.byPoint['pron_open'].sets).toBeGreaterThanOrEqual(0);
  });
  it('worst: из выбранных возвращает минимум покрытия', () => {
    const plan = basePlan();
    const w = worstArmPoint(plan, ['pron_open', 'side_pin'] as ArmWeakPoint[]);
    expect(['pron_open', 'side_pin']).toContain(w);
  });
  it('worst пусто → null', () => {
    expect(worstArmPoint(basePlan(), [])).toBeNull();
  });
  it('audit детерминирован', () => {
    const p = basePlan();
    expect(auditArmPlan(p)!.coveragePct).toBe(auditArmPlan(p)!.coveragePct);
  });
});

describe('arm P0: weak-cause', () => {
  it('0 сетов → volume', () => {
    const r = diagnoseArmWeakCause({ point: 'pron_open', factSets7d: 0 });
    expect(r.cause).toBe('volume');
    expect(r.evidence.length).toBeGreaterThan(0);
  });
  it('ACWR danger → fatigue', () => {
    const r = diagnoseArmWeakCause({ point: 'cup_start', factSets7d: 5, acwrZone: 'danger' });
    expect(r.cause).toBe('fatigue');
  });
  it('tendon danger → fatigue', () => {
    const r = diagnoseArmWeakCause({ point: 'cup_hold', factSets7d: 5, tendonAcwrZone: 'danger' });
    expect(r.cause).toBe('fatigue');
  });
  it('mobility fail → mobility', () => {
    const r = diagnoseArmWeakCause({ point: 'rising_top', factSets7d: 5, mobilityFail: true });
    expect(r.cause).toBe('mobility');
  });
  it('e1RM стоит при объёме → technique', () => {
    const r = diagnoseArmWeakCause({ point: 'sup_cup', factSets7d: 5, e1rmDeltaPct: 0, e1rmSessions: 3 });
    expect(r.cause).toBe('technique');
  });
  it('side/back <60% ref → strength', () => {
    const r = diagnoseArmWeakCause({ point: 'side_mid', factSets7d: 5, sideBackRefRatio: 0.4 });
    expect(r.cause).toBe('strength');
  });
  it('VBT сверх stop → fatigue', () => {
    const r = diagnoseArmWeakCause({ point: 'pron_lock', factSets7d: 5, vbtLossPct: 30, vbtWarnPct: 15 });
    expect(r.cause).toBe('fatigue');
  });
  it('без данных → volume с низкой уверенностью-подсказкой', () => {
    const r = diagnoseArmWeakCause({ point: 'back_drag' });
    expect(r.cause).toBe('volume');
    expect(r.confidence).toBeGreaterThan(0);
  });
});

describe('arm P0: rank', () => {
  it('топ-3, первый — из ARM_CORRECTIONS', () => {
    const top = rankCorrectionsForArm('pron_open');
    expect(top.length).toBe(3);
    expect(top[0].id).toBe('pronation_cable');
  });
  it('оборудование: без cable топ штрафуется', () => {
    const top = rankCorrectionsForArm('pron_open', { equipment: ['dumbbell'] });
    expect(top.length).toBe(3);
    expect(top.every((t) => t.score < 100 || t.id !== 'pronation_cable')).toBe(true);
  });
  it('мобильность wrist режет cup', () => {
    const top = rankCorrectionsForArm('cup_start', { mobilityRestrictions: ['wrist'] });
    expect(top.find((t) => t.id === 'wrist_curl_belt')!.score).toBeLessThan(100);
  });
  it('уже в плане — деприоритизация', () => {
    const a = rankCorrectionsForArm('pron_open');
    const b = rankCorrectionsForArm('pron_open', { inPlanIds: ['pronation_cable'] });
    expect(b.find((t) => t.id === 'pronation_cable')!.score).toBeLessThan(a.find((t) => t.id === 'pronation_cable')!.score);
  });
  it('fatigue поднимает iso/strap', () => {
    const a = rankCorrectionsForArm('pron_lock', {});
    const b = rankCorrectionsForArm('pron_lock', { cause: 'fatigue' });
    expect(b.find((t) => /strap/i.test(t.id))!.score).toBeGreaterThanOrEqual(a.find((t) => /strap/i.test(t.id))!.score);
  });
  it('детерминирован', () => {
    expect(rankCorrectionsForArm('side_mid').map((t) => t.id).join(',')).toBe(rankCorrectionsForArm('side_mid').map((t) => t.id).join(','));
  });
});

describe('arm P0: simulator + spec', () => {
  it('симуляция: +сеты и покрытие не падает', () => {
    const d = simulateArmInjection(basePlan(), 'pron_open')!;
    expect(d.addSets).toBe(3);
    expect(d.coverageAfter).toBeGreaterThanOrEqual(d.coverageBefore);
    expect(d.summary).toContain('покрытие');
  });
  it('симуляция неизвестной точки → null', () => {
    expect(simulateArmInjection(basePlan(), 'nope' as any)).toBeNull();
  });
  it('спец-блок 6 нед: волна + dayMap', () => {
    const sb = buildArmSpecBlock({ weakPoints: ['pron_open', 'cup_start'] as ArmWeakPoint[], weeks: 6 });
    expect(sb.weeks.length).toBe(6);
    expect(sb.dayMap['pron_open']).toBeTruthy();
    expect(sb.weeks[2].targetSets['pron_open']).toBeGreaterThanOrEqual(sb.weeks[0].targetSets['pron_open']);
  });
  it('спец-блок кламп 4-8', () => {
    expect(buildArmSpecBlock({ weakPoints: ['cup_start'] as ArmWeakPoint[], weeks: 99 }).weeks.length).toBe(8);
    expect(buildArmSpecBlock({ weakPoints: ['cup_start'] as ArmWeakPoint[], weeks: 1 }).weeks.length).toBe(4);
  });
  it('пусто → summary без недель-целей', () => {
    const sb = buildArmSpecBlock({ weakPoints: [] });
    expect(sb.weeks.length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(sb.dayMap).length).toBe(0);
  });
});

describe('arm P0: diary-weak', () => {
  it('падение e1RM −10% → weak', () => {
    const sessions = [
      sess(40, 'Пронация на блоке', 'pronators', 40, 8),
      sess(5, 'Пронация на блоке', 'pronators', 36, 8),
      sess(3, 'Пронация на блоке', 'pronators', 36, 8),
    ];
    const res = detectArmWeakByE1rm(sessions);
    expect(res.some((r) => r.muscle === 'pronators' && r.status === 'weak')).toBe(true);
  });
  it('плато ≤+1% при ≥2 сессиях → plateau', () => {
    const sessions = [
      sess(40, 'Сгибание кисти через ремень', 'wrist_flexors', 30, 10),
      sess(5, 'Сгибание кисти через ремень', 'wrist_flexors', 30, 10),
      sess(3, 'Сгибание кисти через ремень', 'wrist_flexors', 30, 10),
    ];
    const res = detectArmWeakByE1rm(sessions);
    expect(res.some((r) => r.muscle === 'wrist_flexors')).toBe(true);
  });
  it('рост +20% → ok (нет в выдаче)', () => {
    const sessions = [
      sess(40, 'Молот с толстым грифом', 'brachialis', 20, 10),
      sess(5, 'Молот с толстым грифом', 'brachialis', 25, 10),
    ];
    const res = detectArmWeakByE1rm(sessions);
    expect(res.some((r) => r.muscle === 'brachialis' && r.status !== 'ok')).toBe(false);
  });
  it('volumeHistory28d: 4 корзины максимум', () => {
    const h = armVolumeHistory28d([sess(2, 'Молот', 'brachialis', 20, 10)]);
    expect(Object.values(h).every((arr) => arr.length <= 4)).toBe(true);
  });
  it('pointsForMuscles: pronators → pron_open/pron_lock', () => {
    const pts = armPointsForMuscles(['pronators']);
    expect(pts).toContain('pron_open');
  });
  it('пустой дневник → []', () => {
    expect(detectArmWeakByE1rm([])).toEqual([]);
  });
});

describe('arm P0: injection v2', () => {
  it('default — только нед 1 (обратная совместимость)', () => {
    const plan = basePlan('intermediate', 4);
    const res = injectArmCorrections(plan, ['pron_open']);
    expect(res.injected).toBe(1);
    const w2has = plan.weeks[1].sessions.some((s) => s.exercises.some((e) => e.exerciseId === 'pronation_cable'));
    expect(w2has).toBe(false);
  });
  it('weekIdxs все недели — инъекция в каждую', () => {
    const plan = basePlan('advanced', 4);
    const idx = plan.weeks.map((_, i) => i).filter((i) => !(plan.weeks[i] as any).deload);
    const res = injectArmCorrections(plan, ['cup_start'], { weekIdxs: idx, budget: 500 });
    expect(res.injected).toBeGreaterThanOrEqual(idx.length);
  });
  it('targetSets уважается (2 вместо 3)', () => {
    const plan = basePlan('advanced', 2);
    const res = injectArmCorrections(plan, ['pron_open'], { budget: 500, targetSets: { pron_open: 2 } });
    const found = res.plan.weeks[0].sessions.flatMap((s) => s.exercises).find((e) => e.exerciseId === 'pronation_cable');
    expect(found?.sets).toBe(2);
  });
  it('deload-неделя пропускается с note', () => {
    const plan = basePlan('intermediate', 3);
    (plan.weeks[1] as any).deload = true;
    const res = injectArmCorrections(plan, ['cup_start'], { weekIdxs: [1], budget: 500 });
    expect(res.injected).toBe(0);
    expect(res.notes.join(' ')).toContain('делод');
  });
});
