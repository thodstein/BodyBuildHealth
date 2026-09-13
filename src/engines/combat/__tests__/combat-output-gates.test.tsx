/**
 * combat-output-gates.test.tsx — добивка P2/P4/P7:
 *  - weightClassLimitValid (stale-категория после смены дисциплины);
 *  - CombatPlanView показывает красный блок errors (раньше — только warnings).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { buildCombatPlan } from '../combat-builder.engine';
import { isCombatPlanBlocked } from '../combat-finalize.engine';
import { weightClassLimitValid } from '../combat-weight-class.engine';
import { CombatPlanView } from '../../../ui/screens/combat/CombatPlanView';
import { buildAnnualATR } from '../combat-annual';

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

  it('план с errors — все 6 кнопок экспорта disabled + плашка', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    const { container } = render(<CombatPlanView plan={plan} {...baseProps} />);
    expect(container.querySelector('.cb-export-blocked')?.textContent).toContain('Экспорт заблокирован');
    for (const name of ['⎙ Копировать', '🖨 Печать', '✦ В программу', '📊 CSV', '📗 XLSX', '📅 План .ics']) {
      const btn = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(btn.disabled, name).toBe(true);
    }
  });

  it('чистый план — кнопки экспорта активны', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    render(<CombatPlanView plan={plan} {...baseProps} />);
    expect(document.querySelector('.cb-export-blocked')).toBeNull();
    for (const name of ['⎙ Копировать', '🖨 Печать', '✦ В программу', '📊 CSV', '📗 XLSX', '📅 План .ics']) {
      const btn = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(btn.disabled, name).toBe(false);
    }
  });

  it('isCombatPlanBlocked — канон: errors ↔ true, чисто ↔ false, пусто ↔ false', () => {
    const bad = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    expect(isCombatPlanBlocked(bad)).toBe(true);
    const ok = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    expect(isCombatPlanBlocked(ok)).toBe(false);
    expect(isCombatPlanBlocked(null)).toBe(false);
    expect(isCombatPlanBlocked(undefined)).toBe(false);
  });

  it('селект приоритета боя виден при годовом (main/secondary)', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    const ann = buildAnnualATR('mma', 12, null, { cycles: 1 } as any);
    const noop = () => undefined;
    render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={noop}
        onUpdateEx={noop}
        onMoveEx={noop}
        onSwapEx={noop}
        annual={ann}
        onBuildATR={noop}
        onPrintAnnual={noop}
        onDownloadIcs={noop}
        competitionName="Бой"
        setCompetitionName={noop}
        competitionDate="2026-09-01"
        setCompetitionDate={noop}
        competitionPriority="main"
        setCompetitionPriority={noop}
        onAddCompetition={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Приоритет боя/ })).toBeTruthy();
  });

  it('чистый план — блока нет, warnings как раньше', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    expect(plan.validation!.errors).toEqual([]);
    const { container } = render(<CombatPlanView plan={plan} {...baseProps} />);
    expect(container.querySelector('.cb-plan-errors')).toBeNull();
    expect(screen.getByText(/Подробный отчёт/)).toBeTruthy();
  });
});
