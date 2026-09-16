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

describe('sm-corrective-wizard (C3)', () => {
  it('мост СМ: smPreferredCorr/smCorrectiveDetail доходят до taBridge', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({
        kind: 'weakpoints',
        label: 't',
        data: {
          smWeakPoints: ['stone_off_floor'],
          smPreferredCorr: { stone_off_floor: 'sm_stone_off_floor_tech' },
          smCorrectiveDetail: ['Камень — 4×3 @65% · Таз высоко'],
        } as any,
      });
    });
    expect((result.current.taBridge as any).smPrefCorr).toEqual({ stone_off_floor: 'sm_stone_off_floor_tech' });
    expect((result.current.taBridge as any).smCorrectiveDetail).toEqual(['Камень — 4×3 @65% · Таз высоко']);
    expect(result.current.weakPoints).toEqual(['stone_off_floor']);
    expect(result.current.mode).toBe('strongman');
  });
});
