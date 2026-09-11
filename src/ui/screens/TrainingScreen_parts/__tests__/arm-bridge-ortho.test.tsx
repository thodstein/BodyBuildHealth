import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { applyToPlanner, clearPlannerApply } from '../planner-bridge';

/** J7: приёмник орто-моста — гарды в персист + флеш, teenNote — флеш (сборку не меняем). */
describe('J7 приёмник орто-моста в Арм-конструкторе', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch { /* noop */ }
    clearPlannerApply();
  });

  it('orthoGuards → персист he_arm_ortho_guards + флеш', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Орто-скрининг J1–J7',
      data: {
        groups: [],
        orthoGuards: { pauseOverhead: true, closedChainOnly: true, mobilityAdd: ['wrist', 'elbow'] },
        orthoFlags: [{ id: 'hand_cluster', joint: 'hand', level: 'doctor', label: 'x', action: 'y' }],
      },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    expect(JSON.parse(localStorage.getItem('he_arm_ortho_guards') || '{}').pauseOverhead).toBe(true);
    expect(JSON.parse(localStorage.getItem('he_arm_ortho_flags') || '[]')).toHaveLength(1);
    expect(document.body.textContent).toContain('Орто-гарды');
  });

  it('teenNote → флеш teen-режима', () => {
    applyToPlanner({
      kind: 'weakpoints',
      label: 'Орто-скрининг J1–J7',
      data: { groups: [], teenNote: 'Подросток 14–15 (орто-скрининг): без отказа, без максимумов, RIR≥2.' },
      source: 'intellectual',
    });
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).toContain('Подросток 14–15');
  });

  it('без орто-полей — тихо (персиста и флеша нет)', () => {
    applyToPlanner({ kind: 'weakpoints', label: 'Арм диагностика', data: { groups: ['wrist_flexors'] }, source: 'intellectual' });
    render(<ArmAutoConstructor />);
    expect(localStorage.getItem('he_arm_ortho_guards')).toBeNull();
    expect(document.body.textContent).not.toContain('Орто-гарды');
  });
});
