import { describe, it, expect } from 'vitest';
import { ARM_CORRECTIONS } from '../arm-weakpoint-corrections';
import { ARM_WEAK_POINTS, type ArmWeakPoint } from '../arm-biomechanics.engine';
import { rankCorrectionsForArm } from '../arm-correction-rank.engine';
import { doseForCause } from '../arm-correction-dose.engine';
import {
  CORRECTION_ROLE,
  POOL_TOPUP,
  ANTAGONIST_FOR,
  TABLE_DRILLS,
  roleOf,
  poolWithTopup,
  preventiveFor,
  drillsForPhase,
  correctiveWaveForWeek,
  waveSetsFor,
  doseForCauseV2,
  correctiveDetailLine,
} from '../arm-correction-pro2.engine';
import { getArmExercises } from '../../../core/exercise-catalog-arm';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv } from '../arm-diagnostics-export.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';

const CAT = new Set(getArmExercises().map((e) => e.id));

function basePlan(level = 'intermediate') {
  const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level, goal: 'strength', technique: 'toproll', weeks: 4, gripFocus: 'support' } as any);
  return finalizeArmPlan(p, { level });
}

describe('arm-corrective-pro2 C1: роли и пулы', () => {
  it('все id пулов + топапов — из каталога', () => {
    const errs: string[] = [];
    for (const wp of ARM_WEAK_POINTS) {
      for (const id of poolWithTopup(wp)) if (!CAT.has(id)) errs.push(`${wp}: ${id}`);
    }
    expect(errs).toEqual([]);
  });
  it('все id пулов имеют роль', () => {
    const missing: string[] = [];
    for (const wp of ARM_WEAK_POINTS) {
      for (const id of poolWithTopup(wp)) if (!roleOf(id)) missing.push(`${wp}: ${id}`);
    }
    expect(missing).toEqual([]);
  });
  it('топ-ап не дублирует базу и не мутирует ARM_CORRECTIONS', () => {
    const before = ARM_CORRECTIONS.cup_start.exercises.join(',');
    poolWithTopup('cup_start');
    expect(ARM_CORRECTIONS.cup_start.exercises.join(',')).toBe(before);
    expect(ARM_CORRECTIONS.cup_start.exercises).not.toContain('wrist_curl_db');
  });
  it('CORRECTION_ROLE покрывает все ключи без мусора', () => {
    for (const id of Object.keys(CORRECTION_ROLE)) expect(CAT.has(id)).toBe(true);
  });
});

describe('arm-corrective-pro2 C2: ранжир', () => {
  it('без новых входов топ-3 = база первые 3 (байт-в-байт)', () => {
    const top = rankCorrectionsForArm('cup_start', {});
    expect(top.map((t) => t.id)).toEqual(ARM_CORRECTIONS.cup_start.exercises.slice(0, 3));
  });
  it('угол вне диапазона продвигает table/static', () => {
    const plain = rankCorrectionsForArm('pron_open', {});
    const angled = rankCorrectionsForArm('pron_open', { angleOutOfRange: true });
    expect(angled.some((t) => t.reason.includes('угол вне диапазона'))).toBe(true);
    expect(angled[0].score).toBeGreaterThanOrEqual(plain[0].score);
  });
  it('VBT-стоп продвигает статику/пульсы', () => {
    const r = rankCorrectionsForArm('pron_lock', { vbtLossPct: 30 });
    expect(r.some((t) => t.reason.includes('VBT-стоп'))).toBe(true);
  });
  it('VBT без замера — тихо, как раньше', () => {
    const r = rankCorrectionsForArm('pron_lock', {});
    expect(r.some((t) => t.reason.includes('VBT'))).toBe(false);
  });
  it('мало стола — бонус table-роли', () => {
    const r = rankCorrectionsForArm('cup_start', { tableTimeMin: 0 });
    expect(r.some((t) => t.reason.includes('мало стола'))).toBe(true);
  });
  it('новичку — мягкие роли', () => {
    const r = rankCorrectionsForArm('sup_cup', { level: 'beginner' });
    expect(r.some((t) => t.reason.includes('новичку'))).toBe(true);
  });
});

describe('arm-corrective-pro2 C3: доза v2', () => {
  it('без opts — как doseForCause', () => {
    const a = doseForCause('cup_start', 'fatigue')!;
    const b = doseForCauseV2('cup_start', 'fatigue', {})!;
    expect(b).toEqual(a);
  });
  it('side + strength — запрет 5×5 (humerus)', () => {
    const d = doseForCauseV2('side_pin', 'strength', {})!;
    expect(d.sets).toBe(3);
    expect(d.reps).toEqual([6, 6]);
    expect(d.rir).toBeGreaterThanOrEqual(3);
    expect(d.note).toContain('humerus');
  });
  it('tendon — 2 сета high-rep RIR≥3', () => {
    const d = doseForCauseV2('pron_lock', 'volume', { tendonOverload: true })!;
    expect(d.sets).toBe(2);
    expect(d.reps[1]).toBeGreaterThanOrEqual(15);
    expect(d.rir).toBeGreaterThanOrEqual(3);
  });
  it('beginner — RIR≥3 и −5п.п.', () => {
    const base = doseForCause('cup_start', null)!;
    const d = doseForCauseV2('cup_start', null, { level: 'beginner' })!;
    expect(d.rir).toBeGreaterThanOrEqual(3);
    expect(d.intensityPct).toBeLessThan(base.intensityPct);
  });
  it('неизвестная точка → null', () => {
    expect(doseForCauseV2('nope' as any, 'fatigue', {})).toBeNull();
  });
});

describe('arm-corrective-pro2 C4/C5/C6', () => {
  it('волна 1-2-3: 0/+1/−1, флор 2', () => {
    expect(correctiveWaveForWeek(1).setsDelta).toBe(0);
    expect(correctiveWaveForWeek(2).setsDelta).toBe(1);
    expect(correctiveWaveForWeek(4).setsDelta).toBe(0);
    expect(waveSetsFor(2, 3)).toBe(2);
    expect(waveSetsFor(3, 2)).toBe(4);
    expect(waveSetsFor(3, null)).toBe(3);
  });
  it('профилактика — все 12 точек', () => {
    for (const wp of ARM_WEAK_POINTS) {
      const p = preventiveFor(wp);
      expect(p).toBeTruthy();
      expect(CAT.has(p!.id)).toBe(true);
    }
    expect(ANTAGONIST_FOR.side_pin.id).toBe('external_rotation_band');
  });
  it('дриллы: фаза фильтрует, пусто — все', () => {
    expect(TABLE_DRILLS.length).toBeGreaterThanOrEqual(3);
    expect(drillsForPhase(null).length).toBe(TABLE_DRILLS.length);
    expect(drillsForPhase('pin').every((d) => d.phases.includes('pin'))).toBe(true);
  });
  it('detail line несёт роль и профилактику', () => {
    const s = correctiveDetailLine('cup_start', 'volume', 'wrist_curl_belt');
    expect(s).toContain('wrist_curl_belt');
    expect(s).toContain('wrist_ext_bb');
  });
  it('POOL_TOPUP — все добавки из каталога', () => {
    for (const ids of Object.values(POOL_TOPUP)) for (const id of ids!) expect(CAT.has(id)).toBe(true);
  });
});

describe('arm-corrective-pro2 C7: инъекция v2', () => {
  it('базовый путь без флагов — как раньше (3 сета)', () => {
    const plan = basePlan();
    const before = plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint]);
    const after = res.plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    expect(after).toBe(before + 3);
  });
  it('волна Н2 даёт +1 сет (нетендонная точка, кап не мешает)', () => {
    const plan = basePlan();
    const before = plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    const res = injectArmCorrections(plan, ['back_start' as ArmWeakPoint], { waveWeek: 2 });
    expect(res.injected).toBe(1);
    const after = res.plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    expect(after).toBe(before + 4);
  });
  it('tendon-флаг режет до 2 сетов', () => {
    const plan = basePlan();
    const before = plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint], { tendonOverload: true });
    const after = res.plan.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((aa, e) => aa + e.sets, 0), 0);
    expect(after).toBe(before + 2);
  });
  it('коммент несёт роль и профилактику (вставленное, не базовое)', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint]);
    expect(res.injected).toBe(1);
    const inserted = res.plan.weeks[0].sessions
      .flatMap((s) => s.exercises)
      .filter((e: any) => String(e.rationale || '').startsWith('Коррекция мёртвой точки'));
    expect(inserted.length).toBe(1);
    expect(String((inserted[0] as any).comment)).toContain('Антагонист:');
    expect(String((inserted[0] as any).comment)).toContain('роль ');
  });
});

describe('arm-corrective-pro2 C8: экспорт', () => {
  const base = {
    date: '2026-09-18', level: 'intermediate', technique: 'toproll',
    points: [{ weakPoint: 'cup_start', label: 'Cup', topCorrections: [{ id: 'wrist_curl_belt', score: 100 }], simDelta: '+3' }],
  } as any;
  it('без новых полей — без довеска', () => {
    const h = buildArmDiagnosticsHtml(base);
    expect(h).toContain('wrist_curl_belt');
    expect(h).not.toContain('профилактика');
    const c = buildArmDiagnosticsCsv(base);
    expect(c).toContain('wrist_curl_belt');
  });
  it('с дозой/ролью — в HTML и CSV', () => {
    const data = { ...base, points: [{ ...base.points[0], doseLabel: '3×6–10 @65%', topRole: 'стол-ремень', preventive: 'wrist_ext_bb' }] } as any;
    expect(buildArmDiagnosticsHtml(data)).toContain('стол-ремень');
    expect(buildArmDiagnosticsCsv(data)).toContain('wrist_ext_bb');
  });
  it('XSS в новых полях экранируется', () => {
    const data = { ...base, points: [{ ...base.points[0], doseLabel: '<script>', topRole: '<b>', preventive: '<img>' }] } as any;
    const h = buildArmDiagnosticsHtml(data);
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });
});
