import { describe, expect, it, vi } from 'vitest';
import { createBlank } from '../../../../engines/user-program/program-store';
import {
  applyBridgePayloadDispatch,
  type BridgeCtx,
} from '../planner-bridge-handlers';
import type { PlannerApply } from '../planner-bridge';

function payload(kind: PlannerApply['kind'], data: Record<string, unknown>): PlannerApply {
  return { kind, label: 'test', data, ts: 1 };
}

function context(dir: string, update = vi.fn()): BridgeCtx {
  return {
    program: createBlank('bb'),
    dir,
    update,
    onChange: vi.fn(),
    showToast: vi.fn(),
    tprofile: {} as BridgeCtx['tprofile'],
  };
}

function seedBlock(ctx: BridgeCtx): void {
  ctx.program.bb!.weeks = [{
    week: 1,
    phase: 'accumulation',
    deload: false,
    sessions: [{
      id: 'session-1', name: 'День 1', focus: '',
      blocks: [{ id: 'block-1', type: 'compound', exerciseName: 'Жим', muscle: 'chest', role: 'primary', sets: [] }],
    }],
  } as any];
}

describe('planner bridge handlers', () => {
  it('split for a non-BB direction is a safe no-op', () => {
    const ctx = context('pl');
    expect(() => applyBridgePayloadDispatch(payload('split', { cycle: [['chest']] }), ctx)).not.toThrow();
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it('split replaces the stale microcycle template when applied to BB', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    expect(applyBridgePayloadDispatch(payload('split', { cycle: [['chest'], ['back']] }), ctx)).toBe(true);
    const patch = update.mock.calls[0][0];
    expect(patch.bb.microcycleTemplate).toEqual({ daySlots: [] });
    expect(patch.bb.weeks).toHaveLength(ctx.program.meta.weeks);
    expect(ctx.showToast).toHaveBeenCalled();
  });

  it('unknown kind returns false and reports a toast', () => {
    const ctx = context('bb');
    const unknown = payload('split', {});
    unknown.kind = 'unknown-kind' as PlannerApply['kind'];
    expect(applyBridgePayloadDispatch(unknown, ctx)).toBe(false);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('не применима'));
  });

  it('readiness volume multiplier changes set count, not load', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    const program = ctx.program;
    program.bb!.weeks[0].sessions[0].blocks[0].sets = [
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
    ];
    ctx.program = program;
    applyBridgePayloadDispatch(payload('pri', { volumeMult: 0.5, rirShift: 1 }), ctx);
    const patch = update.mock.calls[0][0];
    const sets = patch.bb.weeks[0].sessions[0].blocks[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].weight).toBe(100);
    expect(sets[0].rir).toBe(3);
  });

  it('deload applies both volume and intensity reduction', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = [
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
    ];
    applyBridgePayloadDispatch(payload('deload', { weeks: [1] }), ctx);
    const patch = update.mock.calls[0][0];
    const week = patch.bb.weeks[0];
    expect(week.deload).toBe(true);
    expect(week.sessions[0].blocks[0].sets).toHaveLength(3);
    expect(week.sessions[0].blocks[0].sets[0].weight).toBe(60);
    expect(week.sessions[0].blocks[0].sets[0].rir).toBe(4);
  });
});
