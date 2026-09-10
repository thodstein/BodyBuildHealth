/**
 * combat-switch-sheet.test.tsx — свитчи вместо галочек + шиты вместо селектов.
 *
 * role=switch с aria-checked/data-on; шит открывается диалогом, выбор ставит
 * значение, бэкдроп/«Готово» закрывают; нативных checkbox/select в зоне ноль.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { CombatConstructor } from '../CombatConstructor';
import { CombatPlanView } from '../CombatPlanView';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildAnnualATR, saveAnnualCB } from '../../../../engines/combat/combat-annual';

beforeEach(() => {
  localStorage.clear();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function openSec(re: RegExp) {
  const head = screen.getAllByRole('button', { name: re }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}

describe('Combat switch', () => {
  it('тоггл меняет aria-checked и data-on', () => {
    render(<CombatConstructor />);
    go('3 Вне зала');
    openSec(/Вне зала — спарринг/);
    const sw = screen.getByRole('switch', { name: /Учитывать нагрузку вне зала/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('data-on')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('красный свитч осевой нагрузки тоже тогглится', () => {
    render(<CombatConstructor />);
    go('3 Вне зала');
    openSec(/Стиль боя/);
    const sw = screen.getByRole('switch', { name: /Избегать осевой нагрузки/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('нативных чекбоксов и селектов в конструкторе не осталось', () => {
    const { container } = render(<CombatConstructor />);
    for (const s of ['2 Атлет', '3 Вне зала', '4 Сплит', '7 Экспорт']) go(s);
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(0);
    expect(container.querySelectorAll('select').length).toBe(0);
  });
});

describe('Combat sheet select', () => {
  it('годовые шиты: открытие, выбор, закрытие', () => {
    const ann = buildAnnualATR('mma' as any, 12, null, { cycles: 1 } as any);
    saveAnnualCB(ann);
    render(<CombatConstructor />);
    go('7 Экспорт');
    const trig = screen.getByRole('button', { name: 'Длина года' });
    expect(trig.textContent).toContain('52 нед');
    fireEvent.click(trig);
    const dlg = screen.getByRole('dialog', { name: 'Длина года' });
    fireEvent.click(within(dlg).getByText('24 нед'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Длина года' }).textContent).toContain('24 нед');
  });

  it('бэкдроп закрывает шит без выбора', () => {
    const ann = buildAnnualATR('mma' as any, 12, null, { cycles: 1 } as any);
    saveAnnualCB(ann);
    render(<CombatConstructor />);
    go('7 Экспорт');
    fireEvent.click(screen.getByRole('button', { name: 'Длина года' }));
    expect(screen.getByRole('dialog', { name: 'Длина года' })).toBeTruthy();
    fireEvent.click(document.querySelector('.cb-pop-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Длина года' }).textContent).toContain('52 нед');
  });

  it('замена упражнения через шит зовёт onSwapEx', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3 } as any));
    const onSwapEx = vi.fn();
    render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={() => {}}
        onUpdateEx={() => {}}
        onMoveEx={() => {}}
        onSwapEx={onSwapEx}
      />,
    );
    const triggers = screen.getAllByRole('button', { name: 'Замена' });
    expect(triggers.length).toBeGreaterThan(0);
    let picked: { trig: HTMLElement; target: HTMLElement } | null = null;
    for (const t of triggers) {
      fireEvent.click(t);
      const dlg = screen.queryByRole('dialog', { name: 'Замена' });
      if (!dlg) continue;
      const opts = within(dlg).getAllByRole('button').filter((b) => b.textContent !== 'Готово');
      if (opts.length > 1) {
        const target = opts.find((b) => !b.textContent!.includes('✓')) || opts[opts.length - 1];
        picked = { trig: t, target };
        break;
      }
      fireEvent.click(document.querySelector('.cb-pop-backdrop')!);
    }
    expect(picked).not.toBeNull();
    fireEvent.click(picked!.target);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSwapEx).toHaveBeenCalledTimes(1);
    expect(typeof onSwapEx.mock.calls[0][3]).toBe('string');
  });

  it('в плане нет нативных селектов', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3 } as any));
    const { container } = render(
      <CombatPlanView
        plan={plan}
        historyLen={0}
        onUndo={() => {}}
        onUpdateEx={() => {}}
        onMoveEx={() => {}}
        onSwapEx={() => {}}
      />,
    );
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(0);
  });
});
