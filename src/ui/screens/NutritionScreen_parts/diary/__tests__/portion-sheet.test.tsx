/**
 * portion-sheet.test.tsx — «Сколько грамм?» при добавлении из поиска.
 *
 * Главное, что проверяем: порция по умолчанию 100 г, КБЖУ пересчитывается
 * на выбранные граммы и наружу уходит именно введённое количество.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PortionSheet } from '../PortionSheet';

type Props = Parameters<typeof PortionSheet>[0];

const food = {
  id: 'f1',
  name: 'Творог 5%',
  brand: 'Простоквашино',
  kcal: 121,
  protein: 16,
  fat: 5,
  carbs: 3,
};

const noop = () => {};

function renderSheet(overrides: Partial<Props> = {}) {
  const props = {
    open: true,
    food,
    onClose: vi.fn(),
    onAddToQueue: vi.fn(),
    onAddDirect: vi.fn(),
    onAddToBase: vi.fn(),
    ...overrides,
  };
  const utils = render(<PortionSheet {...props} />);
  return { ...utils, props };
}

afterEach(() => cleanup());

describe('PortionSheet — порция из поиска', () => {
  it('показывает продукт, марку и стартовые 100 г', () => {
    renderSheet();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toContain('Творог 5%');
    const input = screen.getByLabelText('Порция в граммах') as HTMLInputElement;
    expect(input.value).toBe('100');
    expect(document.body.textContent).toContain('Простоквашино');
    expect(document.body.textContent).toContain('121 ккал');
  });

  it('быстрый чип пересчитывает КБЖУ', () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText('250 грамм'));
    // 121 × 2,5 = 302,5 → 303 ккал; белки 16 × 2,5 = 40 г.
    expect(document.body.textContent).toContain('303 ккал');
    expect(document.body.textContent).toContain('Б 40 г');
  });

  it('ввод граммов вручную пересчитывает итог', () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText('Порция в граммах'), { target: { value: '180' } });
    // 121 × 1,8 = 217,8 → 218 ккал.
    expect(document.body.textContent).toContain('218 ккал');
  });

  it('«В очередь» отдаёт продукт и введённые граммы', () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByLabelText('Порция в граммах'), { target: { value: '180' } });
    fireEvent.click(screen.getByLabelText('Добавить в очередь'));
    expect(props.onAddToQueue).toHaveBeenCalledWith(food, 180);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('«В дневник» есть только когда обработчик передан', () => {
    renderSheet({ onAddDirect: undefined });
    expect(screen.queryByLabelText('Сразу в дневник')).toBeNull();
    cleanup();
    renderSheet();
    expect(screen.getByLabelText('Сразу в дневник')).toBeTruthy();
  });

  it('«В дневник» и «в мою базу» получают продукт', () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByLabelText('Сразу в дневник'));
    expect(props.onAddDirect).toHaveBeenCalledWith(food, 100);
    cleanup();
    const second = renderSheet();
    fireEvent.click(screen.getByLabelText('Добавить в мою базу продуктов'));
    expect(second.props.onAddToBase).toHaveBeenCalledWith(food);
  });

  it('Esc закрывает окно', () => {
    const { props } = renderSheet();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('порция с упаковки становится отдельным чипом', () => {
    renderSheet({ food: { ...food, servingSize: '60 г' } });
    const chip = screen.getByLabelText('60 грамм');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    // 121 × 0,6 = 72,6 → 73 ккал.
    expect(document.body.textContent).toContain('73 ккал');
  });

  it('не рендерится без открытия', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('стартует с типовой порции продукта (клетчатка — 10 г, не 100)', () => {
    renderSheet({ food: { ...food, defaultPortion: 10 } });
    const input = screen.getByLabelText('Порция в граммах') as HTMLInputElement;
    expect(input.value).toBe('10');
    // 121 ккал/100 г × 0,1 = 12,1 → 12 ккал.
    expect(document.body.textContent).toContain('12 ккал');
  });

  it('порция «1 ч. л. (4 г)» даёт чип 4 г, а не 1 г', () => {
    renderSheet({ food: { ...food, servingSize: '1 ч. л. (4 г)' } });
    fireEvent.click(screen.getByLabelText('4 грамм'));
    const chip = screen.getByLabelText('4 грамм');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('сухую клетчатку можно ввести меньше 10 г (чайная ложка ~4 г)', () => {
    const { props } = renderSheet({ food: { ...food, kcal: 375, protein: 0, fat: 0, carbs: 100, defaultPortion: 4 } });
    const input = screen.getByLabelText('Порция в граммах') as HTMLInputElement;
    // Стартовая порция — 4 г с этикетки, а не флор 10 г.
    expect(input.value).toBe('4');
    fireEvent.click(screen.getByLabelText('Добавить в очередь'));
    expect(props.onAddToQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }), 4);
  });
});
