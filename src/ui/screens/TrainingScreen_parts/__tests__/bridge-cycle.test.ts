/**
 * bridge-cycle.test.ts — Фаза 2: мост «Периодизация → ПЛ-авто» (kind 'cycle').
 *
 * Было: PeriodizationDesignerTab отправлял `kind:'cycle'` через `as any`, а
 * обработчика не существовало — кнопка «Применить» заканчивалась общим тостом
 * «не применима». Стало: типизированный kind, переключение трека ПЛ и живой
 * приём в SRCBBScreen (свежий payload ≤5 мин применяется при монтировании).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyToPlanner, getPlannerApply, clearPlannerApply } from '../planner-bridge';

const readSrc = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), 'utf8');

beforeEach(() => {
  try { localStorage.clear(); window.dispatchEvent(new CustomEvent('planner-apply', { detail: null })); } catch { /* ignore */ }
});

describe('мост kind cycle', () => {
  it('applyToPlanner пишет типизированный payload (cycleId/source/target/ts)', () => {
    applyToPlanner({ kind: 'cycle', label: 'Цикл ПЛ: Силовой цикл 1', data: { cycleId: 'cycle-01' }, source: 'intellectual', targetCycleId: 'cycle-01' });
    const p = getPlannerApply();
    expect(p).toBeTruthy();
    expect(p!.kind).toBe('cycle');
    expect((p!.data as { cycleId: string }).cycleId).toBe('cycle-01');
    expect(p!.source).toBe('intellectual');
    expect(p!.targetCycleId).toBe('cycle-01');
    expect(Date.now() - (p!.ts ?? 0)).toBeLessThan(10_000);
    clearPlannerApply();
    expect(getPlannerApply()).toBeNull();
  });

  it('дизайнер отправляет cycle + переключает трек ПЛ (вместо as any)', () => {
    const designer = readSrc('src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx');
    expect(designer).toContain("kind: 'cycle'");
    expect(designer).not.toContain("kind: 'cycle', label: 'Цикл ПЛ: '+r.cycle.meta.title, data: { cycleId: r.cycle.meta.id } } as any");
    expect(designer).toContain("setPlanningTrack('pl')");
    expect(designer).toContain("new CustomEvent('planning-track-open', { detail: 'pl' })");
  });

  it('SRCBBScreen принимает cycle (включая свежий payload при монтировании)', () => {
    const screen = readSrc('src/ui/screens/SRCBBScreen.tsx');
    expect(screen).toContain("p.kind === 'cycle'");
    expect(screen).toContain("pending.kind === 'cycle'");
    expect(screen).toContain('buildSrc(cid)');
  });

  it('kind зарегистрирован в типе канала (без as any)', () => {
    const bridge = readSrc('src/ui/screens/TrainingScreen_parts/planner-bridge.ts');
    expect(bridge).toContain("'combat_cycle' | 'cycle'");
    expect(bridge).toContain('cycle: CyclePayload');
  });
});
