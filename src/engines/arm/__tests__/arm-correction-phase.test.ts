import { describe, it, expect } from 'vitest';
import { bridgeDoseFromPayload } from '../arm-correction-dose.engine';
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

const findInjected = (plan: any, ids: string[]) => {
  for (const w of plan.weeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) {
    if (e.exerciseId && ids.includes(String(e.exerciseId)) && String(e.rationale || '').startsWith('Коррекция мёртвой точки')) return e;
  }
  return null;
};

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

describe('arm мост дозы в конструктор', () => {
  it('валидный payload → causes + rankedIds', () => {
    const bd = bridgeDoseFromPayload({
      armWeakCauses: { cup_hold: { cause: 'fatigue', confidence: 0.7, fix: 'x' } },
      armRankedIds: { cup_hold: ['wrist_curl_belt', 'riser_lift'] },
    })!;
    expect(bd.causes).toEqual({ cup_hold: 'fatigue' });
    expect(bd.rankedIds).toEqual({ cup_hold: ['wrist_curl_belt', 'riser_lift'] });
  });
  it('мусор отбрасывается, пусто → null', () => {
    expect(bridgeDoseFromPayload(null)).toBeNull();
    expect(bridgeDoseFromPayload({})).toBeNull();
    const bd = bridgeDoseFromPayload({
      armWeakCauses: { cup_hold: { cause: 'nope' }, side_mid: { cause: 'strength' } },
      armRankedIds: { cup_hold: ['a', 42, ''], side_mid: 'oops' },
    })!;
    expect(bd.causes).toEqual({ side_mid: 'strength' });
    expect(bd.rankedIds).toEqual({ cup_hold: ['a'] });
  });
  it('доза из моста применяется в план (сквозной)', () => {
    const bd = bridgeDoseFromPayload({
      armWeakCauses: { cup_hold: { cause: 'fatigue', confidence: 0.7, fix: 'x' } },
      armRankedIds: { cup_hold: ['wrist_curl_behind'] },
    })!;
    const r = injectArmCorrections(testPlan(), ['cup_hold'] as any, { weekIdxs: [0], ...bd });
    const ex = findInjected(r.plan, ARM_CORRECTIONS.cup_hold.exercises)!;
    expect(ex.exerciseId).toBe('wrist_curl_behind');
    expect(ex.sets).toBe(2);
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

describe('arm доза по причине применяется в план', () => {
  it('без causes — база (3×, RIR базы)', () => {
    const r = injectArmCorrections(testPlan(), ['cup_hold'] as any, { weekIdxs: [0] });
    const ex = findInjected(r.plan, ARM_CORRECTIONS.cup_hold.exercises)!;
    expect(ex).toBeTruthy();
    expect(ex.sets).toBe(3);
    expect(ex.rir).toBe(2);
  });
  it('fatigue — меньше сетов, выше RIR, легче вес', () => {
    const base = injectArmCorrections(testPlan(), ['cup_hold'] as any, { weekIdxs: [0] });
    const tired = injectArmCorrections(testPlan(), ['cup_hold'] as any, { weekIdxs: [0], causes: { cup_hold: 'fatigue' } });
    const b = findInjected(base.plan, ARM_CORRECTIONS.cup_hold.exercises)!;
    const t = findInjected(tired.plan, ARM_CORRECTIONS.cup_hold.exercises)!;
    expect(t.sets).toBe(b.sets - 1);
    expect(t.rir).toBeGreaterThan(b.rir);
    expect(t.workSets[0].weight).toBeLessThan(b.workSets[0].weight);
    expect(String(t.comment)).toContain('доза:');
  });
  it('strength — 5×5, вес не ниже базы', () => {
    const r = injectArmCorrections(testPlan(), ['back_start'] as any, { weekIdxs: [0], causes: { back_start: 'strength' } });
    const ex = findInjected(r.plan, ARM_CORRECTIONS.back_start.exercises)!;
    expect(ex.sets).toBe(5);
    expect(ex.workSets[0].reps).toBe(5);
    expect(ex.rir).toBe(2);
  });
  it('симулятор с causes сходится с инъекцией по сетам', () => {
    const plan = testPlan();
    const sim = simulateArmInjection(plan, 'cup_hold', null, { causes: { cup_hold: 'fatigue' } })!;
    const r = injectArmCorrections(plan, ['cup_hold'] as any, { weekIdxs: [0], causes: { cup_hold: 'fatigue' } });
    expect(sim.addSets).toBe(2);
    const ex = findInjected(r.plan, ARM_CORRECTIONS.cup_hold.exercises)!;
    expect(ex.sets).toBe(sim.addSets);
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
