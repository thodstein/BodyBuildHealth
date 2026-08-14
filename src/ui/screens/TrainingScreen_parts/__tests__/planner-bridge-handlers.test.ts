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

  it('MRV recommendation reduces non-deload weekly muscle volume', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = Array.from({ length: 8 }, () => ({ reps: 8, rir: 2, weight: 100, restSec: 120 }));
    applyBridgePayloadDispatch(payload('mrv', { mrv: 4 }), ctx);
    const patch = update.mock.calls[0][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets).toHaveLength(4);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('MRV применён'));
  });

  it('MRV recommendation rejects invalid values without changing the plan', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    applyBridgePayloadDispatch(payload('mrv', { mrv: 0 }), ctx);
    expect(update).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('положительным'));
  });

  it('volume adds one accessory block with the requested set count', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    applyBridgePayloadDispatch(payload('volume', { sets: { shoulders: 4 } }), ctx);
    const patch = update.mock.calls[0][0];
    const blocks = patch.bb.weeks[0].sessions[0].blocks;
    const added = blocks.find((block: any) => block.muscle === 'shoulders');
    expect(added).toBeDefined();
    expect(added.sets).toHaveLength(4);
    expect(blocks.filter((block: any) => block.muscle === 'shoulders')).toHaveLength(1);
  });

  it('peak reduces sets and preserves load while setting peaking RIR', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks.push({ ...ctx.program.bb!.weeks[0], week: 2 });
    ctx.program.bb!.weeks[1].sessions[0].blocks[0].sets = Array.from({ length: 4 }, () => ({
      reps: 3, rir: 2, weight: 140, restSec: 180,
    }));
    applyBridgePayloadDispatch(payload('peak', { volumeMult: 0.5, rirTarget: 1 }), ctx);
    const patch = update.mock.calls[0][0];
    const finalWeek = patch.bb.weeks[1];
    const sets = finalWeek.sessions[0].blocks[0].sets;
    expect(finalWeek.phase).toBe('peaking');
    expect(sets).toHaveLength(2);
    expect(sets.every((set: any) => set.weight === 140 && set.rir === 1)).toBe(true);
    expect(patch.bb.weeks[0].phase).toBe('accumulation');
  });

  it('rir and tempo handlers update all sets without changing unrelated fields', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = [{ reps: 8, rir: 2, weight: 80, restSec: 90 }];
    applyBridgePayloadDispatch(payload('rir', { rirShift: 2 }), ctx);
    let patch = update.mock.calls[0][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets[0]).toMatchObject({ reps: 8, weight: 80, rir: 4 });

    ctx.program = patch;
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0' }), ctx);
    patch = update.mock.calls[1][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets[0]).toMatchObject({ tempo: '3-1-1-0', weight: 80 });
  });

  it('methodology updates progression and malformed payload does not throw', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    expect(() => applyBridgePayloadDispatch(payload('methodology', { methodName: 'double_progression' }), ctx)).not.toThrow();
    expect(update.mock.calls[0][0].bb.progression.loadStrategy).toBe('double_progression');
    expect(() => applyBridgePayloadDispatch(payload('volume', { sets: null as any }), ctx)).not.toThrow();
  });

  it('program handler принимает готовую UserProgram из «Сборки цикла»', () => {
    const ctx = context('bb');
    const built = createBlank('bb');
    built.meta.title = 'Сборка цикла ББ: тест';
    built.bb!.weeks = [{ week: 1, phase: 'accumulation', deload: false, sessions: [] } as any];
    const ok = applyBridgePayloadDispatch(payload('program', { program: built }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).toHaveBeenCalledWith(built);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('Собранный цикл'));
  });

  it('program handler без готовой программы падает на cycleId', () => {
    const ctx = context('bb');
    const ok = applyBridgePayloadDispatch(payload('program', { id: 'cycle-01' }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).toHaveBeenCalled();
  });
});
