/**
 * cardio-pro-panels.test.tsx — проф-инструменты кардио: авто-режим (подстройка
 * с diff и подтверждением), пульс-зоны, редактор недели по дням, график объёма.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioAutoTunePanel, CARDIO_AUTO_TUNE_KEY, CARDIO_AUTO_APPLY_KEY } from '../CardioAutoTunePanel';
import { CardioWeekEditor } from '../CardioWeekEditor';
import { CardioVolumeChart } from '../CardioVolumeChart';
import { CardioSessionTimer } from '../CardioSessionTimer';
import { CardioProgressCard } from '../CardioProgressCard';
import { CardioDiaryPanel } from '../CardioDiaryPanel';
import { CardioDayCard } from '../CardioDayCard';
import { CardioDiaryStep } from '../CardioDiaryStep';
import { buildCardioCycle, loadCardioCycles } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry, loadCardioLog } from '../../../../engines/lms/cardio-diary.engine';
import { saveSRPESession } from '../../../../engines/pro/srpe-store';

const CYCLES_KEY = 'he_cardio_cycles';
const LOG_KEY = 'he_cardio_sessions';
const SRPE_KEY = 'he_srpe_sessions';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(SRPE_KEY);
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

  it('после применения подстройки доступна отмена версии (undo)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'tune-u1' });
    render(<CardioAutoTunePanel cycle={c} acwr={1.6} />);
    fireEvent.click(screen.getByRole('button', { name: /Подстроить сейчас/ }));
    fireEvent.click(screen.getByRole('button', { name: /Применить/ }));
    expect(screen.getByRole('button', { name: /Вернуть версию/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Вернуть версию/ }));
    expect(screen.getByText(/Версия восстановлена/)).toBeTruthy();
    const restored = loadCardioCycles().find(x => x.id === 'tune-u1')!;
    expect(restored.weeks[0].totalMinutes).toBe(c.weeks[0].totalMinutes);
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

  it('авто-режим: предпросмотр подстройки показывается автоматически', () => {
    localStorage.setItem(CARDIO_AUTO_TUNE_KEY, '1');
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'tune-auto' });
    const { unmount } = render(<CardioAutoTunePanel cycle={c} acwr={1.6} />);
    expect(screen.getByText(/Предпросмотр изменений/)).toBeTruthy();
    unmount();
  });

  it('авто-применение: подстройка применяется сразу и сохраняет undo-версию', () => {
    localStorage.setItem(CARDIO_AUTO_TUNE_KEY, '1');
    localStorage.setItem(CARDIO_AUTO_APPLY_KEY, '1');
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'tune-apply' });
    const { unmount } = render(<CardioAutoTunePanel cycle={c} acwr={1.6} />);
    expect(screen.getByText(/Подстройка применена/)).toBeTruthy();
    const saved = loadCardioCycles().find(x => x.id === 'tune-apply');
    expect(saved).toBeTruthy();
    const tuned = saved!.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'transition');
    for (const w of tuned) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
    const versions = JSON.parse(localStorage.getItem('he_cardio_cycle_history') ?? '[]');
    expect(versions.some((v: any) => v.cycleId === 'tune-apply')).toBe(true);
    unmount();
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

  it('копия недели: «⧉ В след. неделю» переносит сессии', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'we-5' });
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /В след. неделю/ }));
    const saved = loadCardioCycles().find(x => x.id === 'we-5')!;
    const w1 = saved.weeks[0];
    const w2 = saved.weeks[1];
    expect(w2.sessions.map(s => `${s.type}:${s.durationMin}`)).toEqual(w1.sessions.map(s => `${s.type}:${s.durationMin}`));
    expect(w2.totalMinutes).toBe(w1.totalMinutes);
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

describe('CardioVolumeChart — план vs факт', () => {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plusDays = (base: string, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  it('без журнала: факт-сводка не показывается', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'vc-1' });
    const html = renderToStaticMarkup(<CardioVolumeChart cycle={c} />);
    expect(html).not.toContain('план vs факт');
  });

  it('с журналом: сводка план vs факт и выполнение прошедших недель', () => {
    const d = new Date();
    d.setDate(d.getDate() - 8);
    const start = iso(d);
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'vc-2', startDate: start });
    const log = [
      { id: 'f1', date: start, type: 'zone2' as const, durationMin: 25, rpe: 5, completed: true, calories: 180 },
      { id: 'f2', date: plusDays(start, 1), type: 'zone2' as const, durationMin: 25, rpe: 5, completed: true, calories: 180 },
    ];
    render(<CardioVolumeChart cycle={c} log={log} />);
    fireEvent.click(screen.getByRole('button', { name: /Показать/ }));
    expect(screen.getByText(/план vs факт/)).toBeTruthy();
    expect(screen.getByText(/Выполнение прошедших недель/)).toBeTruthy();
    expect(screen.getByText(/факт \(дневник\)/)).toBeTruthy();
  });

  it('будущие недели не штрафуют выполнение (только прошедшие)', () => {
    const d = new Date();
    d.setDate(d.getDate() - 8);
    const start = iso(d);
    // 8 недель: неделя 1 прошедшая, недели 2+ будущие.
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, id: 'vc-3', startDate: start });
    const log = [{ id: 'f1', date: start, type: 'zone2' as const, durationMin: 25, rpe: 5, completed: true }];
    render(<CardioVolumeChart cycle={c} log={log} />);
    fireEvent.click(screen.getByRole('button', { name: /Показать/ }));
    // 1 из 3 сессий недели 1 → ~33% (не 33% от всего цикла).
    expect(screen.getAllByText(/33%/).length).toBeGreaterThan(0);
  });
});

describe('CardioSessionTimer', () => {
  it('SSR: показывает быстрый старт', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 't-1' });
    const html = renderToStaticMarkup(<CardioSessionTimer cycle={c} />);
    expect(html).toContain('Быстрый старт сессии');
  });

  it('CSR: старт → завершить → сохранить записывает сессию в дневник', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 't-2' });
    const { unmount } = render(<CardioSessionTimer cycle={c} />);
    const startBtn = screen.getAllByRole('button', { name: /Старт/ })[0];
    fireEvent.click(startBtn);
    expect(screen.getByRole('button', { name: /Пауза/ })).toBeTruthy();
    // протокол сессии виден (фазы)
    expect(screen.getByText(/Разминка/)).toBeTruthy();
    expect(screen.getByText(/Заминка/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Завершить/ }));
    const rpe = screen.getByRole('textbox', { name: /RPE/ });
    fireEvent.change(rpe, { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить в дневник/ }));
    expect(screen.getByText(/Сессия записана/)).toBeTruthy();
    const log = loadCardioLog();
    expect(log.length).toBe(1);
    expect(log[0].rpe).toBe(6);
    unmount();
  });

  it('«⏭ Пропустить» записывает completed:false', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 't-3' });
    const { unmount } = render(<CardioSessionTimer cycle={c} />);
    const skipBtn = screen.getAllByRole('button', { name: /Пропустить/ })[0];
    fireEvent.click(skipBtn);
    expect(screen.getByText(/отмечена пропущенной/)).toBeTruthy();
    const log = loadCardioLog();
    expect(log.length).toBe(1);
    expect(log[0].completed).toBe(false);
    expect(log[0].notes).toBe('пропущена');
    unmount();
  });

  it('«↗ Перенести» переносит сессию и отдаёт новый цикл наружу', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 't-4', daysAvailable: 2 });
    let next: unknown = null;
    const { unmount } = render(<CardioSessionTimer cycle={c} onReschedule={(n) => { next = n; }} />);
    const btn = screen.getByRole('button', { name: /Перенести на другой день/ });
    fireEvent.click(btn);
    expect(screen.getByText(/перенесена/)).toBeTruthy();
    expect(next).not.toBeNull();
    unmount();
  });
});

describe('CardioProgressCard', () => {
  it('SSR: показывает позицию в цикле', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, id: 'p-1' });
    const html = renderToStaticMarkup(<CardioProgressCard cycle={c} />);
    expect(html).toContain('Прогресс цикла');
    expect(html).toContain('из 12');
  });
});

describe('CardioDiaryPanel — adherence текущей недели', () => {
  it('свежий цикл (startDate=сегодня) → неделя 1', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'dp-1' });
    render(<CardioDiaryPanel cycle={c} />);
    expect(screen.getByText(/Неделя 1: выполнено/)).toBeTruthy();
  });

  it('цикл, начатый 8 дней назад → неделя 2 (не последняя)', () => {
    const d = new Date();
    d.setDate(d.getDate() - 8);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'dp-2', startDate: start });
    render(<CardioDiaryPanel cycle={c} />);
    expect(screen.getByText(/Неделя 2: выполнено/)).toBeTruthy();
  });
});

describe('CardioDayCard — кардио-слой дня', () => {
  it('SSR: заголовок и кнопка дневника', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioDayCard cycle={c} />);
    expect(html).toContain('Кардио и нагрузка дня');
    expect(html).toContain('Дневник');
  });

  it('CSR: план/факт и нагрузка дня (сила+кардио)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'day-1' });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    saveCardioLogEntry({ id: 'd1', date: iso, type: 'zone2', durationMin: 30, rpe: 6, completed: true, calories: 210 });
    saveSRPESession({ date: iso, sRPE: 8, durationMin: 60 });
    render(<CardioDayCard cycle={c} />);
    expect(screen.getByText(/Факт:/)).toBeTruthy();
    expect(screen.getByText(/Нагрузка дня/)).toBeTruthy();
  });

  it('CSR: без факта — «не записано»', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'day-2' });
    render(<CardioDayCard cycle={c} />);
    expect(screen.getByText(/не записано/)).toBeTruthy();
  });
});

describe('CardioDiaryStep — старт-контроль (5C)', () => {
  it('с соревнованием впереди: строка «🏁 Старт через N нед»', () => {
    const d = new Date();
    d.setDate(d.getDate() - 8);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: start, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    const html = renderToStaticMarkup(<CardioDiaryStep cycle={c} recoveryLow={false} onChanged={() => {}} />);
    expect(html).toContain('Старт через');
    expect(html).toContain('HIIT уже убран');
  });

  it('без стартов: строка не показывается', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const html = renderToStaticMarkup(<CardioDiaryStep cycle={c} recoveryLow={false} onChanged={() => {}} />);
    expect(html).not.toContain('Старт через');
  });
});
