import { describe, it, expect } from 'vitest';
import { rankCorrectionsForArm } from '../arm-correction-rank.engine';
import { suggestWeakPointsForTrack } from '../arm-video-analysis.engine';
import { simulateArmInjection } from '../arm-simulator.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import { ARM_CORRECTIONS } from '../arm-weakpoint-corrections';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';

function testPlan() {
  return finalizeArmPlan(
    buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 4, gripFocus: 'support' } as any),
    { level: 'intermediate' },
  );
}

function planExerciseIds(plan: any): string[] {
  const out: string[] = [];
  for (const w of plan.weeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) if (e.exerciseId) out.push(String(e.exerciseId));
  return out;
}

describe('arm P2 failurePoint', () => {
  it('без фазы — базовый топ-1', () => {
    const top = rankCorrectionsForArm('side_pin', {});
    expect(top[0].id).toBe('side_belt_table');
  });
  it('pin поднимает hold/дожитие', () => {
    const base = rankCorrectionsForArm('side_pin', {});
    const pin = rankCorrectionsForArm('side_pin', { failurePoint: 'pin' });
    const baseScore = base.find((t) => t.id === 'table_pushdown_iso')!.score;
    const pinScore = pin.find((t) => t.id === 'table_pushdown_iso')!.score;
    expect(pinScore - baseScore).toBe(6);
  });
  it('без фазы — те же скоры (no-op)', () => {
    const a = rankCorrectionsForArm('cup_start', {});
    const b = rankCorrectionsForArm('cup_start', { failurePoint: null });
    expect(a.map((t) => t.score)).toEqual(b.map((t) => t.score));
  });
});

describe('arm P4 video→точка', () => {
  it('toproll → rising/pron', () => {
    const s = suggestWeakPointsForTrack('outside_toproll').map((s) => s.point);
    expect(s).toEqual(['rising_top', 'pron_open', 'pron_lock']);
  });
  it('hook → cup/sup', () => {
    const s = suggestWeakPointsForTrack('inside_hook').map((s) => s.point);
    expect(s).toContain('cup_start');
  });
  it('press → side/back', () => {
    const s = suggestWeakPointsForTrack('straight_press').map((s) => s.point);
    expect(s).toContain('side_mid');
  });
  it('null → пусто, confidence всегда low', () => {
    expect(suggestWeakPointsForTrack(null)).toEqual([]);
    expect(suggestWeakPointsForTrack('inside_hook')[0].confidence).toBe('low');
  });
});

describe('arm П.1 ранжир едет в план', () => {
  it('без rankedIds — первый из базы', () => {
    const r = injectArmCorrections(testPlan(), ['pron_open'] as any, { weekIdxs: [0] });
    expect(r.injected).toBeGreaterThan(0);
    expect(planExerciseIds(r.plan)).toContain(ARM_CORRECTIONS.pron_open.exercises[0]);
  });
  it('rankedIds первым — вставляется он, а не база', () => {
    const second = ARM_CORRECTIONS.pron_open.exercises[1];
    const r = injectArmCorrections(testPlan(), ['pron_open'] as any, { weekIdxs: [0], rankedIds: { pron_open: [second] } });
    expect(r.injected).toBeGreaterThan(0);
    expect(planExerciseIds(r.plan)).toContain(second);
  });
});

describe('arm P5 честный симулятор', () => {
  const basePlan = () => testPlan();
  it('на живом плане: не blocked, вес числом', () => {
    const d = simulateArmInjection(basePlan(), 'pron_open')!;
    expect(d.blocked).toBeNull();
    expect(Number.isFinite(d.estWeight)).toBe(true);
    expect(d.summary).toContain('покрытие');
  });
  it('душный бюджет → blocked честно', () => {
    const d = simulateArmInjection(basePlan(), 'pron_open', null, { budget: 1 })!;
    expect(d.blocked).toContain('budget');
    expect(d.summary).toContain('⊘');
  });
  it('без плана — деградация к покрытию', () => {
    const d = simulateArmInjection(null, 'cup_start')!;
    expect(d.blocked).toBeNull();
    expect(d.estWeight).toBeNull();
  });
  it('все сессии полные (8) → blocked честно', () => {
    const p: any = testPlan();
    let n = 0;
    for (const w of p.weeks || []) for (const s of w.sessions || []) {
      while ((s.exercises || []).length < 8) s.exercises.push({ exerciseId: `dummy_${n++}`, muscle: 'chest', sets: 1 });
    }
    const d = simulateArmInjection(p, 'pron_open', null, { budget: 500 })!;
    expect(d.blocked).toContain('переполнены');
  });
});

describe('arm P6 fixesPhase', () => {
  it('все 12 точек имеют непустые fixesPhase', () => {
    for (const [wp, info] of Object.entries(ARM_CORRECTIONS)) {
      expect(Array.isArray(info.fixesPhase) && info.fixesPhase!.length > 0, wp).toBe(true);
    }
  });
  it('pin чинится side_pin, setup — pron_open', () => {
    expect(ARM_CORRECTIONS.side_pin.fixesPhase).toContain('pin');
    expect(ARM_CORRECTIONS.pron_open.fixesPhase).toContain('setup');
  });
});
