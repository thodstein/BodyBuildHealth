/**
 * cardio-pro-panels.test.tsx — проф-инструменты кардио: авто-режим (подстройка
 * с diff и подтверждением), пульс-зоны, редактор недели по дням, график объёма.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioAutoTunePanel, CARDIO_AUTO_TUNE_KEY } from '../CardioAutoTunePanel';
import { CardioWeekEditor } from '../CardioWeekEditor';
import { CardioVolumeChart } from '../CardioVolumeChart';
import { buildCardioCycle, loadCardioCycles } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const LOG_KEY = 'he_cardio_sessions';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(CARDIO_AUTO_TUNE_KEY);
  } catch { /* ignore */ }
});

describe('CardioAutoTunePanel — SSR', () => {
  it('рендерит авто-режим, подстройку и пульс-зоны', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const html = renderToStaticMarkup(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    expect(html).toContain('Авто-режим');
    expect(html).toContain('Подстроить сейчас');
    expect(html).toContain('Z2 Zone 2');
    expect(html).toContain('Z5 VO2max');
  });
});

describe('CardioAutoTunePanel — CSR', () => {
  it('ACWR опасный → предпросмотр изменений и применение сохраняет цикл', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'tune-1' });
    render(<CardioAutoTunePanel cycle={c} acwr={1.6} />);
    fireEvent.click(screen.getByRole('button', { name: /Подстроить сейчас/ }));
    expect(screen.getByText(/Предпросмотр изменений/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Применить/ }));
    expect(screen.getByText(/Подстройка применена/)).toBeTruthy();
    const saved = loadCardioCycles().find(x => x.id === 'tune-1');
    expect(saved).toBeTruthy();
    const tuned = saved!.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'transition');
    for (const w of tuned) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
  });

  it('соответствие плану → «изменений нет»', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'tune-2' });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    for (let i = 0; i < planned; i++) {
      saveCardioLogEntry({ id: `e${i}`, date: `2026-01-0${5 + i}`, type: 'zone2', durationMin: 30, rpe: 5, completed: true });
    }
    render(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    fireEvent.click(screen.getByRole('button', { name: /Подстроить сейчас/ }));
    expect(screen.getByText(/изменений нет/)).toBeTruthy();
  });

  it('toggle авто-режима пишет флаг в localStorage', () => {
    render(<CardioAutoTunePanel cycle={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Включён|Выключен/ }));
    expect(localStorage.getItem(CARDIO_AUTO_TUNE_KEY)).toBe('1');
  });
});

describe('CardioWeekEditor', () => {
  it('SSR: раскладка по дням Пн-Вс', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioWeekEditor cycle={c} />);
    for (const d of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']) expect(html).toContain(d);
    expect(html).toContain('−10% мин');
    expect(html).toContain('+10% мин');
  });

  it('CSR: +10% минут увеличивает объём недели и сохраняет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'we-1' });
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /\+10% мин/ }));
    expect(screen.getByText(/Неделя обновлена/)).toBeTruthy();
    const saved = loadCardioCycles().find(x => x.id === 'we-1');
    expect(saved!.weeks[0].totalMinutes).toBeGreaterThan(c.weeks[0].totalMinutes);
  });

  it('редактор сессий: добавление HIIT-сессии через селектор типа', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'we-2' });
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    const select = screen.getByRole('combobox', { name: /Тип новой сессии/ });
    fireEvent.change(select, { target: { value: 'hiit' } });
    fireEvent.click(screen.getByRole('button', { name: /Добавить сессию/ }));
    const saved = loadCardioCycles().find(x => x.id === 'we-2');
    expect(saved!.weeks[0].sessions.some(s => s.type === 'hiit')).toBe(true);
  });

  it('редактор сессий: добавление сессии увеличивает число сессий недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'we-3' });
    const before = c.weeks[0].sessions.length;
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByRole('button', { name: /Добавить сессию/ }));
    const saved = loadCardioCycles().find(x => x.id === 'we-3');
    expect(saved!.weeks[0].sessions.length).toBe(before + 1);
  });

  it('редактор сессий: изменение минут пересчитывает итог недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'we-4' });
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    const input = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(input, { target: { value: '50' } });
    const saved = loadCardioCycles().find(x => x.id === 'we-4');
    const week = saved!.weeks[0];
    const expected = week.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    expect(week.totalMinutes).toBe(expected);
    expect(week.sessions[0].durationMin).toBe(50);
  });
});

describe('CardioVolumeChart', () => {
  it('SSR: показывает переключатели мин/ккал и данные недель', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const html = renderToStaticMarkup(<CardioVolumeChart cycle={c} />);
    expect(html).toContain('Объём по неделям');
    expect(html).toContain('Показать');
  });

  it('CSR: разворачивание показывает пик объёма', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    render(<CardioVolumeChart cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Показать/ }));
    expect(screen.getByText(/Пик:/)).toBeTruthy();
  });
});
