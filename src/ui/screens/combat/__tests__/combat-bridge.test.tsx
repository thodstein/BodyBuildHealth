/**
 * combat-bridge.test.tsx — мост «Библиотека → CombatConstructor» (P2):
 *  - kind combat_cycle ставит discipline/goal/level/weeks/days/patternId (неизвестный id — честная ошибка);
 *  - подхват при монтировании и живьём (уже открыт);
 *  - kind weakpoints с combat-полями (concussion/sparringCap/ortho) применяется с флешем.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { CombatConstructor } from '../CombatConstructor';
import { applyToPlanner, clearPlannerApply } from '../../TrainingScreen_parts/planner-bridge';
import { getCombatCycle } from '../../../../engines/combat/combat-cycle-library';

function seedBridge(kind: string, data: unknown) {
  localStorage.setItem('he_planner_apply', JSON.stringify({ kind, label: 't', data, ts: Date.now() }));
}

describe('Мост combat_cycle → CombatConstructor', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('подхватывает именной цикл при монтировании (сообщение + шаг сплита)', () => {
    seedBridge('combat_cycle', { cycleId: 'cb-box-champion-10' });
    const tpl = getCombatCycle('cb-box-champion-10');
    expect(tpl).not.toBeNull();
    const { container } = render(<CombatConstructor />);
    expect(container.querySelector('.cb-msg')?.textContent).toContain('чемпионский');
  });

  it('честно ругается на неизвестный id', () => {
    seedBridge('combat_cycle', { cycleId: 'nope' });
    render(<CombatConstructor />);
    expect(screen.getByText(/не найден в библиотеке/)).toBeTruthy();
  });

  it('подхватывает цикл живьём (уже открыт)', () => {
    try { localStorage.removeItem('he_planner_apply'); } catch { /* ignore */ }
    const { container } = render(<CombatConstructor />);
    act(() => { applyToPlanner({ kind: 'combat_cycle', label: 'Base', data: { cycleId: 'cb-wrestle-base-6' } }); });
    expect(container.querySelector('.cb-msg')?.textContent).toContain('база');
    clearPlannerApply();
  });

  it('weakpoints с combat-полями применяется с флешем', () => {
    const { container } = render(<CombatConstructor />);
    act(() => {
      applyToPlanner({
        kind: 'weakpoints', label: 'diag',
        data: { combatConcussion: 1, combatSparringCap: 0, combatAsymmetry: 'left' },
      });
    });
    expect(container.querySelector('.cb-msg')?.textContent).toContain('Из диагностики');
    clearPlannerApply();
  });

  it('weakpoints: neckLevel и сторона реально меняют состояние (не только флеш)', () => {
    const { container } = render(<CombatConstructor />);
    act(() => {
      applyToPlanner({
        kind: 'weakpoints', label: 'diag',
        data: { combatNeckLevel: 3, combatAsymmetry: 'right' },
      });
    });
    expect(container.querySelector('.cb-msg')?.textContent).toContain('Из диагностики');
    expect(container.querySelector('.cb-msg')?.textContent).toContain('уровень шеи');
    expect(container.querySelector('.cb-msg')?.textContent).toContain('правая');
    clearPlannerApply();
  });

  it('payload-тип combat_cycle: только cycleId', () => {
    seedBridge('combat_cycle', { cycleId: 'cb-box-base-8' });
    const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(saved.kind).toBe('combat_cycle');
    expect(saved.data.cycleId).toBe('cb-box-base-8');
  });
});
