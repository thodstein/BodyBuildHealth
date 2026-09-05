/**
 * cardio-diary-open.test.tsx — «🏃 Кардио-дневник» открывается из вкладки «Дневники»:
 * клик по карточке и по «+ Добавить» показывает дневник как главный контент,
 * даже при наличии активного кардио-цикла и записей журнала.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileDiariesTab } from '../ProfileDiariesTab';
import { buildCardioCycle, saveCardioCycle, setActiveCardioCycle } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('ProfileDiariesTab — Кардио-дневник открывается', () => {
  it('клик по карточке «Кардио» показывает дневник как главный контент', () => {
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /Открыть дневник Кардио/ })[0]);
    expect(screen.getByText(/Кардио-дневник/)).toBeTruthy();
    expect(screen.getAllByText(/Записать сессию/).length).toBeGreaterThan(0);
  });

  it('кнопка «+ Добавить» на карточке кардио открывает дневник (быстрое добавление)', () => {
    render(<ProfileDiariesTab />);
    const addBtn = screen.getAllByRole('button', { name: /Добавить запись в дневник Кардио/ })[0];
    fireEvent.click(addBtn);
    expect(screen.getByText(/Кардио-дневник/)).toBeTruthy();
  });

  it('открывается при активном цикле и записях журнала (план vs факт виден)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, id: 'cd-x' });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    saveCardioLogEntry({ id: 'l1', date: new Date().toISOString().slice(0, 10), type: 'zone2', durationMin: 40, rpe: 6, completed: true });
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /Открыть дневник Кардио/ })[0]);
    expect(screen.getByText(/Кардио-дневник/)).toBeTruthy();
    expect(screen.getByText(/план vs факт/)).toBeTruthy();
  });

  it('при открытом дневнике grid дневников скрыт (дневник — главный контент)', () => {
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /Открыть дневник Кардио/ })[0]);
    expect(screen.getByText(/Кардио-дневник/)).toBeTruthy();
    expect(screen.queryByText('📓 Встроенные дневники')).toBeNull();
  });
});