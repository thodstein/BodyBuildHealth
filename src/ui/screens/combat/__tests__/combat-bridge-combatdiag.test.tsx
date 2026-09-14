/**
 * combat-bridge-combatdiag.test.tsx — приёмник combat-диагностики в CombatConstructor:
 * groups (strike:/takedown:) + specBlock.dayMap + barPath доходят до сводки,
 * мусор игнорируется, сборка не меняется. Свой файл, чужой combat-bridge.test.tsx не тронут.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { CombatConstructor } from '../CombatConstructor';
import { applyToPlanner, clearPlannerApply } from '../../TrainingScreen_parts/planner-bridge';

const DIAG = {
  groups: ['strike:cross', 'takedown:double'],
  diagnosticWeakSide: 'left',
  barPath: { xLoop: 8, yMax: 110, type: 'loop', text: 'Петля 8.0 см — замах виден' },
  combatNeckLevel: null,
  combatAsymmetry: 'left',
  combatSparringCap: null,
  specBlock: { weeks: 6, focus: ['cross', 'double'], dayMap: { cross: [1, 3] }, rationale: 'combat-diag: скор 70' },
};

describe('Приёмник combat-диагностики', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('группы + дни + bar-path видны в сводке и персисте', () => {
    const { container } = render(<CombatConstructor />);
    act(() => {
      applyToPlanner({ kind: 'weakpoints', label: 'Combat-диагностика', data: DIAG as any, source: 'intellectual' });
    });
    expect(container.querySelector('.cb-msg')?.textContent).toContain('кросс');
    const diag = container.querySelector('[data-combat="bridge-diag"]');
    expect(diag?.textContent).toContain('кросс');
    expect(diag?.textContent).toContain('дабл-лег');
    expect(diag?.textContent).toContain('дни 1+3');
    expect(diag?.textContent).toContain('Петля');
    expect(localStorage.getItem('he_combat_diag_bridge_v1')).toContain('кросс');
    clearPlannerApply();
  });

  it('мусорные группы игнорируются, пустой payload — тишина', () => {
    const { container } = render(<CombatConstructor />);
    act(() => {
      applyToPlanner({ kind: 'weakpoints', label: 'x', data: { groups: ['nonsense', 42, 'strike:unknown_xyz'] } as any });
    });
    expect(container.querySelector('[data-combat="bridge-diag"]')).toBeNull();
    expect(screen.queryByText(/Диагностика: слабейшие/)).toBeNull();
    clearPlannerApply();
  });

  it('сводка переживает ремаунт (персист)', () => {
    const first = render(<CombatConstructor />);
    act(() => {
      applyToPlanner({ kind: 'weakpoints', label: 'Combat-диагностика', data: DIAG as any, source: 'intellectual' });
    });
    first.unmount();
    const second = render(<CombatConstructor />);
    expect(second.container.querySelector('[data-combat="bridge-diag"]')?.textContent).toContain('кросс');
    clearPlannerApply();
  });
});
