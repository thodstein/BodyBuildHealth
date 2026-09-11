/**
 * use-strength-sport-wizard.test.tsx — паритет декомпозиции: хук несёт тот же
 * стейт и тот же bridge-приём, что инлайн-версия конструктора до разреза.
 */
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

describe('useStrengthSportWizard', () => {
  it('дефолты как у конструктора: params/weightlifting/8нед/3дня, план пуст', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    expect(result.current.step).toBe('params');
    expect(result.current.mode).toBe('weightlifting');
    expect(result.current.goal).toBe('strength');
    expect(result.current.level).toBe('intermediate');
    expect(result.current.weeks).toBe(8);
    expect(result.current.days).toBe(3);
    expect(result.current.plan).toBeNull();
    expect(result.current.building).toBe(false);
    expect(result.current.expandedWeek).toBe(0);
    expect(result.current.taperWeeks).toBe(1);
    expect(result.current.contestStrategy).toBe('balanced');
    expect(typeof result.current.tick).toBe('function');
  });

  it('мост ss_cycle: валидный цикл ставит id/сроки и ведёт на сплит', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({ kind: 'ss_cycle', label: 't', data: { cycleId: 'ss-ta-general-8' } as any });
    });
    expect(result.current.cycleId).toBe('ss-ta-general-8');
    expect(result.current.step).toBe('split');
    expect(result.current.weeks).toBe(8);
    expect(result.current.msg).toMatch(/библиотеки/);
  });

  it('мост ss_cycle: битый id — честное предупреждение, шаг не меняется', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({ kind: 'ss_cycle', label: 't', data: { cycleId: 'no-such-cycle' } as any });
    });
    expect(result.current.cycleId).toBe('');
    expect(result.current.step).toBe('params');
    expect(result.current.msg).toMatch(/не найден/);
  });

  it('мост weakpoints: контест/стратегия/VBT/sway из хаба доходят до стейта', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({
        kind: 'weakpoints',
        label: 't',
        data: {
          smWeakPoints: ['farmers_grip', 'core_brace'],
          groups: [],
          wlWeakPoints: [],
          weakPoints: [],
          contest: { name: 'test', events: [{ id: 'yoke_walk', format: 'max', weight: 200 }] },
          velocityLossPct: 18,
          velocityHistory: { yoke_walk: [1.5, 1.2] },
          swayCm: 4.2,
          strategy: 'aggressive',
          level: 'warn',
        } as any,
      });
    });
    expect(result.current.mode).toBe('strongman');
    expect(result.current.contest).not.toBeNull();
    expect(result.current.contestStrategy).toBe('aggressive');
    expect(result.current.velocityLoss).toBe(18);
    expect(result.current.swayCmBridge).toBe(4.2);
    expect(result.current.hubVelocity).toEqual({ yoke_walk: [1.5, 1.2] });
    expect(result.current.weakPoints.length).toBeGreaterThan(0);
  });

  it('мост VBT-only без слабых: скорость и sway доходят до стейта', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({
        kind: 'weakpoints',
        label: 't',
        data: {
          velocityLossPct: 22,
          velocityHistory: { snatch: [1.6, 1.2] },
          swayCm: 3.5,
          level: 'warn',
        } as any,
      });
    });
    expect(result.current.velocityLoss).toBe(22);
    expect(result.current.hubVelocity).toEqual({ snatch: [1.6, 1.2] });
    expect(result.current.swayCmBridge).toBe(3.5);
    expect(result.current.diagnosticLevel).toBe('warn');
    expect(result.current.weakPoints).toEqual([]);
    expect(result.current.mode).toBe('weightlifting');
  });

  it('мост ТА: заявки/Sinclair/спец-блок доходят до taBridge вне гейта слабых', () => {
    const { result } = renderHook(() => useStrengthSportWizard());
    act(() => {
      applyToPlanner({
        kind: 'weakpoints',
        label: 't',
        data: {
          wlWeakPoints: [],
          taAttempts: { snatch: [90, 96, 102], cj: [112, 120, 127] },
          taSinclair: { total: 229, value: 260.5, cycle: '2025-2028', q: 281.3 },
          taSpecBlock: { totalWeeks: 6 },
        } as any,
      });
    });
    expect(result.current.taBridge.attempts).toEqual({ snatch: [90, 96, 102], cj: [112, 120, 127] });
    expect(result.current.taBridge.sinclair?.value).toBe(260.5);
    expect(result.current.taBridge.sinclair?.q).toBe(281.3);
    expect(result.current.taBridge.specWeeks).toBe(6);
    expect(result.current.weakPoints).toEqual([]);
  });

  it('персист: cycleId/cycleMode переживают перемонтирование', () => {
    const h1 = renderHook(() => useStrengthSportWizard());
    act(() => { h1.result.current.setCycleId('ss-ta-general-8'); });
    act(() => { h1.result.current.setCycleMode('adapt'); });
    expect(localStorage.getItem('he_ss_cycle_v1')).toBe('ss-ta-general-8');
    expect(localStorage.getItem('he_ss_cycle_mode_v1')).toBe('adapt');
    h1.unmount();
    const h2 = renderHook(() => useStrengthSportWizard());
    expect(h2.result.current.cycleId).toBe('ss-ta-general-8');
    expect(h2.result.current.cycleMode).toBe('adapt');
  });
});
