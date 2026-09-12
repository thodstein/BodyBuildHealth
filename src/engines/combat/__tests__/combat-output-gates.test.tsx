/**
 * combat-output-gates.test.tsx — добивка P2/P4/P7:
 *  - weightClassLimitValid (stale-категория после смены дисциплины);
 *  - CombatPlanView показывает красный блок errors (раньше — только warnings).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { buildCombatPlan } from '../combat-builder.engine';
import { weightClassLimitValid } from '../combat-weight-class.engine';
import { CombatPlanView } from '../../../ui/screens/combat/CombatPlanView';

describe('weightClassLimitValid', () => {
  it('пусто — валидно; свой лимит — валиден; чужой — нет', () => {
    expect(weightClassLimitValid('mma', 'male', 0)).toBe(true);
    expect(weightClassLimitValid('mma', 'male', null)).toBe(true);
    expect(weightClassLimitValid('boxing', 'male', 80)).toBe(true);
    expect(weightClassLimitValid('mma', 'male', 80)).toBe(false);
    expect(weightClassLimitValid('mma', 'male', 77.1)).toBe(true);
    expect(weightClassLimitValid('boxing', 'female', 75)).toBe(true);
    expect(weightClassLimitValid('boxing', 'female', 77.1)).toBe(false);
  });
});

describe('CombatPlanView errors block', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } cleanup(); });
  const noop = () => undefined;
  const baseProps = {
    historyLen: 0, onUndo: noop, onUpdateEx: noop, onMoveEx: noop, onSwapEx: noop,
  } as any;

  it('план с errors — красный блок виден', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    expect(plan.validation!.errors.length).toBeGreaterThan(0);
    const { container } = render(<CombatPlanView plan={plan} {...baseProps} />);
    expect(container.querySelector('.cb-plan-errors')?.textContent).toContain('Сборка заблокирована');
  });

  it('чистый план — блока нет, warnings как раньше', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    expect(plan.validation!.errors).toEqual([]);
    const { container } = render(<CombatPlanView plan={plan} {...baseProps} />);
    expect(container.querySelector('.cb-plan-errors')).toBeNull();
    expect(screen.getByText(/Подробный отчёт/)).toBeTruthy();
  });
});
