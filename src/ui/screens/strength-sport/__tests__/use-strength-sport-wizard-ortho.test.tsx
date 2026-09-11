import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useStrengthSportWizard } from '../useStrengthSportWizard';
import { applyToPlanner, clearPlannerApply } from '../../TrainingScreen_parts/planner-bridge';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  try { clearPlannerApply(); } catch {}
});

/** J7/П1–П3: применение орто-моста в визарде — mobility-merge, стратегия, rationale. */
describe('useStrengthSportWizard ortho-intake', () => {
  it('mobility-merge + yoke downgrade aggressive→balanced + orthoNote', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => { result.current.setContestStrategy('aggressive'); });
    act(() => {
      applyToPlanner({
        kind: 'weakpoints', label: 'Орто-скрининг',
        data: {
          groups: [],
          orthoGuards: { yokeGate: true, mobilityAdd: ['shoulder', 'knee'] },
          orthopedic: { blockedPatterns: ['vertical_push'] },
          orthoSummary: 'Флагов: 2',
        },
        source: 'intellectual',
      } as any);
    });
    expect(result.current.mobility).toContain('shoulder');
    expect(result.current.mobility).toContain('knee');
    expect(result.current.contestStrategy).toBe('balanced');
    expect(result.current.orthoNote).toMatch(/йок\/фермер-гейт/);
    expect(result.current.orthoNote).toMatch(/блок: vertical_push/);
  });

  it('teen и closedChain форсят conservative', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({
        kind: 'weakpoints', label: 'Орто-скрининг',
        data: { groups: [], teenNote: 'Подросток 14–15', orthoGuards: { closedChainOnly: true } },
        source: 'intellectual',
      } as any);
    });
    expect(result.current.contestStrategy).toBe('conservative');
    expect(result.current.orthoNote).toMatch(/teen 14–15/);
    expect(result.current.orthoNote).toMatch(/Beighton/);
  });

  it('без орто-полей — тихо (стратегия и mobility не тронуты)', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    const mobBefore = result.current.mobility;
    act(() => {
      applyToPlanner({ kind: 'weakpoints', label: 't', data: { groups: [] }, source: 'intellectual' } as any);
    });
    expect(result.current.contestStrategy).toBe('balanced');
    expect(result.current.mobility).toEqual(mobBefore);
    expect(result.current.orthoNote).toBeNull();
  });
});
