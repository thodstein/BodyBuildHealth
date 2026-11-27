/**
 * macro-summary-fiber.test.tsx — клетчатка в карточке «КБЖУ за день».
 *
 * Норма — 14 г на 1000 ккал дневной цели (Adequate Intake, PMID 26514720),
 * поэтому у цели 2500 ккал норма 35 г, у 1800 ккал — 25 г. Строка обязана
 * показывать и набранное, и норму, а не только факт.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MacroSummary } from '../MacroSummary';

const targets = { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
const dayTotals = { kcal: 2000, p: 120, f: 60, c: 200 };

function fiberRow(): HTMLElement | null {
  return document.querySelector('.nd-fiber') as HTMLElement | null;
}

afterEach(() => cleanup());

describe('MacroSummary — клетчатка', () => {
  it('показывает набранное против нормы 14 г/1000 ккал', () => {
    render(<MacroSummary dayTotals={dayTotals} targets={targets} fiber={17.5} />);
    const row = fiberRow();
    expect(row).toBeTruthy();
    expect(row!.textContent).toContain('17.5 / 35 г');
    expect(row!.textContent).toContain('50%');
    expect(row!.getAttribute('data-met')).toBe('false');
    expect(row!.getAttribute('data-empty')).toBe('false');
  });

  it('отмечает выполненную норму', () => {
    render(<MacroSummary dayTotals={dayTotals} targets={targets} fiber={40} />);
    const row = fiberRow()!;
    expect(row.textContent).toContain('40 / 35 г');
    expect(row.textContent).toContain('114%');
    expect(row.getAttribute('data-met')).toBe('true');
  });

  it('без данных показывает честный 0 и не прячет норму', () => {
    render(<MacroSummary dayTotals={dayTotals} targets={targets} />);
    const row = fiberRow()!;
    expect(row.textContent).toContain('0 / 35 г');
    expect(row.getAttribute('data-empty')).toBe('true');
  });

  it('норма масштабируется под калорийную цель (1800 ккал → 25 г)', () => {
    render(<MacroSummary dayTotals={dayTotals} targets={{ ...targets, kcal: 1800 }} fiber={12} />);
    expect(fiberRow()!.textContent).toContain('12 / 25 г');
    expect(fiberRow()!.textContent).toContain('48%');
  });

  it('не рисует строку, если калорийная цель не задана', () => {
    render(<MacroSummary dayTotals={dayTotals} targets={{ ...targets, kcal: 0 }} fiber={10} />);
    expect(fiberRow()).toBeNull();
  });
});
