/**
 * tempo-bridge.test.ts — TEMPO-REP PRO, эпик D (5 тестов).
 * Мост темпа: валидация, режимы, снапшот + откат.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createBlank } from '../../../../engines/user-program/program-store';
import {
  applyBridgePayloadDispatch,
  loadTempoPrevSnapshot,
  TEMPO_PREV_KEY,
  type BridgeCtx,
} from '../planner-bridge-handlers';
import type { PlannerApply } from '../planner-bridge';

function payload(kind: string, data: Record<string, unknown>): PlannerApply {
  return { kind: kind as PlannerApply['kind'], label: 'test-tempo', data, ts: 1 };
}

function context(update = vi.fn()): BridgeCtx {
  return {
    program: createBlank('bb'),
    dir: 'bb',
    update,
    onChange: vi.fn(),
    showToast: vi.fn(),
    tprofile: {} as BridgeCtx['tprofile'],
  };
}

function seedTwoBlocks(ctx: BridgeCtx): void {
  ctx.program.bb!.weeks = [{
    week: 1,
    phase: 'accumulation',
    deload: false,
    sessions: [{
      id: 's1', name: 'День 1', focus: '',
      blocks: [
        { id: 'b1', type: 'compound', exerciseName: 'Жим', muscle: 'chest', role: 'primary', sets: [{ reps: 8, rir: 2, weight: 80, restSec: 90 }] },
        { id: 'b2', type: 'isolation', exerciseName: 'Махи', muscle: 'shoulders', role: 'accessory', sets: [{ reps: 12, rir: 2, weight: 10, restSec: 60 }] },
      ],
    }],
  } as any];
}

beforeEach(() => {
  try { localStorage.removeItem(TEMPO_PREV_KEY); } catch { /* ignore */ }
});

describe('tempo bridge (эпик D)', () => {
  it('битый payload не мутирует план', () => {
    const update = vi.fn();
    const ctx = context(update);
    seedTwoBlocks(ctx);
    applyBridgePayloadDispatch(payload('tempo', { label: 'быстро-медленно' }), ctx);
    expect(update).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('битая нотация'));
  });

  it('compound-only не трогает изоляцию', () => {
    const update = vi.fn();
    const ctx = context(update);
    seedTwoBlocks(ctx);
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0', mode: 'compound' }), ctx);
    const patch = update.mock.calls[0][0];
    const [base, iso] = patch.bb.weeks[0].sessions[0].blocks;
    expect(base.sets[0].tempo).toBe('3-1-1-0');
    expect(iso.sets[0].tempo).toBeUndefined();
  });

  it('skip_deload не трогает делоад-неделю', () => {
    const update = vi.fn();
    const ctx = context(update);
    seedTwoBlocks(ctx);
    ctx.program.bb!.weeks[0] = { ...ctx.program.bb!.weeks[0], deload: true } as any;
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0', mode: 'skip_deload' }), ctx);
    const patch = update.mock.calls[0][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets[0].tempo).toBeUndefined();
  });

  it('снимок пишется, откат восстанавливает побайтово', () => {
    const update = vi.fn();
    const ctx = context(update);
    seedTwoBlocks(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = [{ reps: 8, rir: 2, weight: 80, restSec: 90, tempo: '2-0-X-0' }];
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0' }), ctx);
    const snap = loadTempoPrevSnapshot();
    expect(snap?.count).toBe(2);
    expect(JSON.stringify(snap?.weeks)).toContain('2-0-X-0');
    // Откат поверх изменённого плана
    ctx.program = update.mock.calls[0][0];
    applyBridgePayloadDispatch(payload('tempo_rollback', {}), ctx);
    const restored = update.mock.calls[1][0];
    expect(restored.bb.weeks[0].sessions[0].blocks[0].sets[0].tempo).toBe('2-0-X-0');
    expect(restored.bb.weeks[0].sessions[0].blocks[1].sets[0].tempo).toBeUndefined();
  });

  it('без ББ-плана — честный тост без мутации; откат без снимка — предупреждение', () => {
    const update = vi.fn();
    const ctx = context(update);
    ctx.program = createBlank('pl');
    (ctx.program as any).bb = undefined;
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0' }), ctx);
    expect(update).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('только для ББ-плана'));
    applyBridgePayloadDispatch(payload('tempo_rollback', {}), ctx);
    expect(update).not.toHaveBeenCalled();
  });
});
