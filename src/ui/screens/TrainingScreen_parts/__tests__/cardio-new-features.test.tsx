/**
 * cardio-new-features.test.tsx — smoke для новых фич H/I: календарь, импорт, аналитика, TRIMP, стрик.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCardioCycle } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';
import { CardioCalendar } from '../CardioCalendar';
import { CardioImportPanel } from '../CardioImportPanel';
import { CardioAnalyticsDashboard } from '../CardioAnalyticsDashboard';
import { CardioVolumeChart } from '../CardioVolumeChart';

const CYCLES_KEY = 'he_cardio_cycles';
const LOG_KEY = 'he_cardio_sessions';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(LOG_KEY);
  } catch { /* ignore */ }
});

describe('CardioCalendar — SSR/CSR', () => {
  it('SSR: календарь с циклом рендерит заголовок и кнопку', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioCalendar cycle={c} />);
    expect(html).toContain('Календарь цикла');
    expect(html).toContain('Календарь');
  });
  it('CSR: collapsed по умолчанию, клик открывает сетку', async () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    render(<CardioCalendar cycle={c} />);
    expect(screen.getByRole('button', { name: /Показать календарь/ })).toBeTruthy();
    // без открытия — дней нет
    expect(screen.queryByRole('grid')).toBeNull();
  });
});

describe('CardioImportPanel — SSR', () => {
  it('рендерит импорт GPX/TCX', () => {
    const html = renderToStaticMarkup(<CardioImportPanel />);
    expect(html).toContain('Импорт GPX/TCX');
    expect(html).toContain('Выбрать файл');
  });
});

describe('CardioAnalyticsDashboard — SSR', () => {
  it('рендерит 7д/28д/TRIMP/HR', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioAnalyticsDashboard cycle={c} log={[]} />);
    expect(html).toContain('Аналитика 7д');
    expect(html).toContain('TRIMP');
    expect(html).toContain('HR в зоне');
  });
  it('с логом показывает дельту', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    saveCardioLogEntry({ id: 'a1', date: iso, type: 'zone2', durationMin: 30, completed: true, calories: 210 });
    const log = [{ id: 'a1', date: iso, type: 'zone2' as const, durationMin: 30, completed: true, calories: 210 }];
    const html = renderToStaticMarkup(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(html).toContain('7Д МИН');
  });
});

describe('CardioVolumeChart — TRIMP', () => {
  it('кнопка TRIMP переключает метрику', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioVolumeChart cycle={c} log={[]} />);
    expect(html).toContain('TRIMP');
  });
});
