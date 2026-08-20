/**
 * cardio-diary.test.tsx — встроенный «❤️ Кардио-дневник» Профиля:
 * запись сессии, статистика 7/28д, журнал с удалением, план vs факт активного цикла.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioDiary } from '../CardioDiary';
import { buildCardioCycle, saveCardioCycle, setActiveCardioCycle } from '../../../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry, loadCardioLog } from '../../../../../../engines/lms/cardio-diary.engine';

const LOG_KEY = 'he_cardio_sessions';
const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';

const GOALS: Record<string, unknown> = {};

beforeEach(() => {
  try {
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
});

describe('CardioDiary — SSR', () => {
  it('рендерит заголовок, форму записи и пустой журнал', () => {
    const html = renderToStaticMarkup(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    expect(html).toContain('Кардио-дневник');
    expect(html).toContain('Записать сессию');
    expect(html).toContain('Zone 2');
    expect(html).toContain('HIIT');
  });
});

describe('CardioDiary — CSR', () => {
  it('запись сессии появляется в журнале и статистике', () => {
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.change(screen.getByLabelText('Минуты сессии'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('RPE сессии'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Записать сессию/ }));
    expect(screen.getAllByText(/45 мин/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RPE 6/).length).toBeGreaterThan(0);
    expect(loadCardioLog().length).toBe(1);
  });

  it('запись в профильном дневнике видна в общей кардио-журнале (единый источник)', () => {
    saveCardioLogEntry({ id: 'x1', date: '2026-08-17', type: 'hiit', durationMin: 20, rpe: 8, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    expect(screen.getAllByText(/HIIT/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20 мин/).length).toBeGreaterThan(0);
  });

  it('удаление записи убирает её из журнала и хранилища', () => {
    saveCardioLogEntry({ id: 'x2', date: '2026-08-17', type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.click(screen.getByRole('button', { name: /Удалить 2026-08-17/ }));
    expect(loadCardioLog().length).toBe(0);
  });

  it('редактирование: ✎ заполняет форму, «Обновить» меняет запись (та же id)', () => {
    saveCardioLogEntry({ id: 'x5', date: '2026-08-17', type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать 2026-08-17/ }));
    fireEvent.change(screen.getByLabelText('Минуты сессии'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Обновить/ }));
    expect(loadCardioLog().length).toBe(1);
    expect(loadCardioLog()[0].durationMin).toBe(40);
    expect(loadCardioLog()[0].id).toBe('x5');
    expect(screen.getAllByText(/40 мин/).length).toBeGreaterThan(0);
  });

  it('меню «••• Ещё» показывает экспорт (CSV/PDF) и очистку', () => {
    saveCardioLogEntry({ id: 'x6', date: '2026-08-17', type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.click(screen.getByRole('button', { name: /••• Ещё/ }));
    expect(screen.getByRole('menuitem', { name: /CSV-файл/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Печать \/ PDF/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Очистить дневник/ })).toBeTruthy();
  });

  it('undo: после записи кнопка «↩ Отменить запись» восстанавливает предыдущее состояние', () => {
    saveCardioLogEntry({ id: 'x7', date: '2026-08-17', type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.click(screen.getByRole('button', { name: /Записать сессию/ }));
    expect(loadCardioLog().length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /Отменить запись/ }));
    expect(loadCardioLog().length).toBe(1);
    expect(loadCardioLog()[0].id).toBe('x7');
  });

  it('undo после удаления возвращает запись', () => {
    saveCardioLogEntry({ id: 'x8', date: '2026-08-17', type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    fireEvent.click(screen.getByRole('button', { name: /Удалить 2026-08-17/ }));
    expect(loadCardioLog().length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Отменить запись/ }));
    expect(loadCardioLog().length).toBe(1);
    expect(loadCardioLog()[0].id).toBe('x8');
  });

  it('активный цикл: блок «план vs факт» показывает выполнение текущей недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cd-1' });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    saveCardioLogEntry({ id: 'x3', date: new Date().toISOString().slice(0, 10), type: 'zone2', durationMin: 30, completed: true });
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    expect(screen.getByText(/план vs факт/)).toBeTruthy();
    expect(screen.getByText(/Активный цикл/)).toBeTruthy();
  });

  it('без активного цикла блок «план vs факт» не показывается', () => {
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    expect(screen.queryByText(/план vs факт/)).toBeNull();
  });

  it('активный цикл, идущий 3 недели (cut): тренерская подсказка текущей недели видна', () => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, id: 'cd-h', startDate: start, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    render(<CardioDiary open onClose={() => {}} diaryKey="cardio" goals={GOALS} />);
    // Неделя 4 в cut-цикле — делод → подсказка «Нед 4: …Делод…».
    expect(screen.getByText(/Нед 4:/)).toBeTruthy();
  });
});
