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
});
