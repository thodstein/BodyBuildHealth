import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProgramManagerPanelWithProvider } from '../ProgramManagerPanel';

/**
 * program-editor-schedule-card.test.tsx — карточка «🗓 Неделя — расписание»
 * в шаге «Недели» ручного конструктора ББ: смена дня сессии через попап,
 * назначение на свободный день, «⟳ По рекомендации».
 */
const DAY_ORDER_RU = ['Пн', 'Ср', 'Пт', 'Вт', 'Чт', 'Сб', 'Вс'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const openWeeksStep = async () => {
  render(<ProgramManagerPanelWithProvider />);
  fireEvent.click(screen.getAllByText('ББ')[0]);
  // unified 3 шага ББ: Профиль → Параметры → Недели
  await waitFor(() => expect(screen.getByText('Далее: Параметры →')).toBeTruthy(), { timeout: 20000 });
  fireEvent.click(screen.getByText('Далее: Параметры →'));
  await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeTruthy(), { timeout: 20000 });
  fireEvent.click(screen.getByText('Далее: Недели →'));
  await waitFor(() => expect(screen.getByText('🗓 Неделя — расписание')).toBeTruthy(), { timeout: 20000 });
};

/** Свободный (не disabled, не текущий) день в попапе выбора дня. */
const pickFreeDayOption = (dialog: HTMLElement) => {
  const option = Array.from(dialog.querySelectorAll('button')).find(b =>
    !b.disabled
    && DAY_NAMES.some(d => (b.textContent ?? '').startsWith(d))
    && !(b.textContent ?? '').includes('✓'));
  return option ?? null;
};

/** Пикеры дня недели сессий недели 1 (редактор ББ, шаг «Недели»). */
const dayPickers = (): HTMLElement[] => {
  return [1, 2, 3, 4, 5, 6, 7]
    .map(n => screen.queryByLabelText(`День недели тренировки ${n}`))
    .filter((el): el is HTMLElement => !!el);
};

describe('Ручной конструктор ББ — карточка «🗓 Неделя — расписание»', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('карточка: рекомендованные дни помечены ⭐, есть «⟳ По рекомендации» и подсказка про клик', async () => {
    await openWeeksStep();
    expect(screen.getByLabelText('Вернуть рекомендованные дни недели')).toBeTruthy();
    // после авто-сборки сессии стоят на рекомендованных днях → ⭐ в ячейках
    expect(screen.getAllByText(/⭐/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Нажмите на день, чтобы перенести тренировку/)).toBeTruthy();
    expect(screen.getAllByLabelText(/Сменить день:/).length).toBeGreaterThan(0);
  }, 60000);

  it('смена дня через попап: свободный день выбирается, сессия переносится во все недели (пикер недели 1 обновился)', async () => {
    await openWeeksStep();
    fireEvent.click(screen.getAllByLabelText(/Сменить день:/)[0]);
    const dialog = await screen.findByRole('dialog');
    // в попапе показана рекомендация ⭐ и текущий день ✓
    expect(within(dialog).getAllByText(/⭐ рекомендованный/).length).toBeGreaterThan(0);
    const option = pickFreeDayOption(dialog);
    expect(option).toBeTruthy();
    const dayName = (option!.textContent ?? '').replace(/ ⭐ рекомендованный.*/, '').trim();
    fireEvent.click(option!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 5000 });
    // хотя бы один пикер дня недели теперь показывает выбранный день
    const pickers = dayPickers();
    expect(pickers.length).toBeGreaterThan(0);
    expect(pickers.some(p => p.textContent === dayName)).toBe(true);
  }, 60000);

  it('назначение на свободный день: попап списка сессий → перенос', async () => {
    await openWeeksStep();
    const assignBtns = screen.getAllByLabelText(/Назначить тренировку на/);
    expect(assignBtns.length).toBeGreaterThan(0);
    const targetDay = (assignBtns[0].getAttribute('aria-label') ?? '').replace(/Назначить тренировку на /, '');
    fireEvent.click(assignBtns[0]);
    const dialog = await screen.findByRole('dialog');
    const rows = within(dialog).getAllByLabelText(/Перенести на /);
    expect(rows.length).toBeGreaterThan(0);
    const before = dayPickers().map(p => p.textContent);
    fireEvent.click(rows[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 5000 });
    // день теперь занят (кнопка «Назначить тренировку на {targetDay}» исчезла), пикер изменился
    await waitFor(() => {
      expect(screen.queryByLabelText(`Назначить тренировку на ${targetDay}`)).toBeNull();
    }, { timeout: 5000 });
    const after = dayPickers().map(p => p.textContent);
    expect(after).not.toEqual(before);
    expect(after.some(t => t === targetDay)).toBe(true);
  }, 60000);

  it('«⟳ По рекомендации» возвращает рекомендованные дни после переноса', async () => {
    await openWeeksStep();
    // переносим первую сессию на свободный день
    fireEvent.click(screen.getAllByLabelText(/Сменить день:/)[0]);
    const dialog = await screen.findByRole('dialog');
    const option = pickFreeDayOption(dialog);
    expect(option).toBeTruthy();
    fireEvent.click(option!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 5000 });
    // сброс по рекомендации
    fireEvent.click(screen.getByLabelText('Вернуть рекомендованные дни недели'));
    await waitFor(() => {
      const pickers = dayPickers();
      pickers.forEach(p => {
        const n = Number((p.getAttribute('aria-label') ?? '').split(' ').pop());
        expect(p.textContent).toBe(DAY_ORDER_RU[n - 1]);
      });
    }, { timeout: 5000 });
  }, 60000);
});