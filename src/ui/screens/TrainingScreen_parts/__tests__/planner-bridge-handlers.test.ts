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

describe('planner bridge handlers', () => {
  it('split for a non-BB direction is a safe no-op', () => {
    const ctx = context('pl');
    expect(() => applyBridgePayloadDispatch(payload('split', { cycle: [['chest']] }), ctx)).not.toThrow();
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it('split replaces the stale microcycle template when applied to BB', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
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
});
