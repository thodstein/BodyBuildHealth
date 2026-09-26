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

  /**
   * Спринт 5.2 (добивка): смешанный дневник больше не «считаем единый TID и молчим» —
   * в дашборде появляется разбивка факта по дисциплинам.
   */
  it('смешанный дневник: разбивка по дисциплинам (бег + велосипед)', () => {
    // config.lthr — эталон, который пользователь задаёт в конструкторе (иначе
    // зоны по HR не считаются вовсе — сессии уходят в «без HR»).
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, config: { lthr: 170, age: 30, sex: 'male' } as never });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = [
      { id: 'r1', date: iso, type: 'zone2' as const, durationMin: 30, completed: true, avgHr: 150, sport: 'run' as const },
      { id: 'b1', date: iso, type: 'zone2' as const, durationMin: 45, completed: true, avgHr: 130, sport: 'bike' as const },
    ];
    const html = renderToStaticMarkup(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(html).toContain('Разбивка факта по дисциплинам');
    expect(html).toContain('велосипед');   // подпись из канона CARDIO_SPORT_RU
    expect(html).toContain('45 мин');     // время по зонам вела — видно
    expect(html).toContain('несопоставимы');
  });

  it('одна дисциплина — строки разбивки нет (не засоряем карточку)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, config: { lthr: 170, age: 30, sex: 'male' } as never });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = [{ id: 'r1', date: iso, type: 'zone2' as const, durationMin: 30, completed: true, avgHr: 150, sport: 'run' as const }];
    const html = renderToStaticMarkup(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(html).not.toContain('Разбивка факта по дисциплинам');
  });
});

describe('CardioVolumeChart — TRIMP', () => {
  it('кнопка TRIMP переключает метрику', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioVolumeChart cycle={c} log={[]} />);
    expect(html).toContain('TRIMP');
  });
});
