/**
 * cardio-link-card.test.tsx — SSR/CSR smoke интеграционной карточки кардио:
 * статус подключения (cardio-bridge), «Открыть кардио-конструктор»,
 * пересчёт под ACWR, отключение.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioLinkCard } from '../CardioLinkCard';
import { setCardioLink, clearCardioLink, getCardioLink } from '../../../../engines/lms/cardio-bridge';
import { buildCardioCycle, saveCardioCycle, loadCardioCycles } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';
import { saveSRPESession } from '../../../../engines/pro/srpe-store';

const CYCLES_KEY = 'he_cardio_cycles';
const LINK_KEY = 'he_cardio_link';
const TRACK_KEY = 'he_training_planning_track';
const LOG_KEY = 'he_cardio_sessions';
const SRPE_KEY = 'he_srpe_sessions';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(LINK_KEY);
    localStorage.removeItem(TRACK_KEY);
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(SRPE_KEY);
    clearCardioLink();
  } catch { /* ignore */ }
});

describe('CardioLinkCard — SSR', () => {
  it('рендерит заголовок и кнопку открытия конструктора', () => {
    const html = renderToStaticMarkup(<CardioLinkCard />);
    expect(html).toContain('❤️ Кардио');
    expect(html).toContain('Открыть кардио-конструктор');
  });
});

describe('CardioLinkCard — CSR', () => {
  it('без связи показывает «Не подключено»', () => {
    render(<CardioLinkCard />);
    expect(screen.getByText('Не подключено')).toBeTruthy();
  });

  it('с связью показывает имя цикла и кнопки пересчёта/отключения', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-1', name: 'Мой кардио' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-1', sport: 'pl', linkedAt: 'x' });
    render(<CardioLinkCard />);
    expect(screen.getByText(/Мой кардио/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Пересчитать под ACWR/ })).toBeTruthy();
  });

  it('со связью и циклом показывает «🔔 Сегодня» с сессией дня', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-today' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-today', sport: 'bb', linkedAt: 'x' });
    render(<CardioLinkCard />);
    expect(screen.getByText(/Сегодня:/)).toBeTruthy();
  });

  it('«Сегодня» показывает целевую ЧСС-зону сессии (цикл с возрастом)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-zone', age: 40 });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-zone', sport: 'bb', linkedAt: 'x' });
    render(<CardioLinkCard />);
    expect(screen.getByText(/ЧСС \d+-\d+/)).toBeTruthy();
  });

  it('«Открыть кардио-конструктор» пишет track=cardio и шлёт событие', () => {
    let detail: string | null = null;
    window.addEventListener('planning-track-open', (e) => { detail = (e as CustomEvent).detail as string; });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Открыть кардио-конструктор/ }));
    expect(localStorage.getItem(TRACK_KEY)).toBe('cardio');
    expect(detail).toBe('cardio');
  });

  it('«Отключить» очищает связь', () => {
    setCardioLink({ cycleId: 'x', sport: 'bb', linkedAt: 'x' });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Отключить/ }));
    expect(getCardioLink()).toBeNull();
    expect(screen.getByText('Не подключено')).toBeTruthy();
  });

  it('«Пересчитать под ACWR»: дифф-подтверждение, «✅ Применить» сохраняет цикл (E4)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'cc-2', name: 'Сушка-кардио' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-2', sport: 'bb', linkedAt: 'x' });
    // 2 тяжёлые sRPE-сессии за последние 2 дня → ACWR dangerous (ratio≈4) → цикл изменится.
    const iso = (off: number) => { const d = new Date(); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    saveSRPESession({ date: iso(0), sRPE: 10, durationMin: 60 });
    saveSRPESession({ date: iso(1), sRPE: 10, durationMin: 60 });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Пересчитать под ACWR/ }));
    // Дифф показан, цикл НЕ изменён до подтверждения.
    expect(screen.getByText(/что изменится/i)).toBeTruthy();
    const before = loadCardioCycles()[0].weeks;
    fireEvent.click(screen.getByRole('button', { name: /Применить пересчёт кардио/ }));
    expect(screen.getByText(/✅ Кардио адаптировано под ACWR/)).toBeTruthy();
    expect(loadCardioCycles()[0].weeks).not.toEqual(before);
  });

  it('«✕ Отмена» не сохраняет пересчёт (E4)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'cc-cancel' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-cancel', sport: 'bb', linkedAt: 'x' });
    const iso = (off: number) => { const d = new Date(); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    saveSRPESession({ date: iso(0), sRPE: 10, durationMin: 60 });
    saveSRPESession({ date: iso(1), sRPE: 10, durationMin: 60 });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Пересчитать под ACWR/ }));
    expect(screen.getByText(/что изменится/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отменить пересчёт кардио/ }));
    expect(screen.queryByText(/что изменится/i)).toBeNull();
    expect(loadCardioCycles()[0].weeks).toEqual(c.weeks);
  });

  it('сценарий без изменений: сообщение без блока подтверждения (E4)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-ok' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-ok', sport: 'pl', linkedAt: 'x' });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Пересчитать под ACWR/ }));
    expect(screen.getByText(/уже оптимально|изменений нет/)).toBeTruthy();
    expect(screen.queryByText(/что изменится/i)).toBeNull();
    expect(loadCardioCycles()[0].weeks).toEqual(c.weeks);
  });

  it('«Сегодня» учитывает startDate: цикл, начатый 2 недели назад, показывает неделю 3 (не 1)', () => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // cut 6 нед: неделя 3 = build (zone2 40×1 при daysAvailable=1, с прогрессией ~43 мин),
    // неделя 1 = base (30×1).
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'cc-start', startDate: start, daysAvailable: 1 });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-start', sport: 'pl', linkedAt: 'x' });
    render(<CardioLinkCard />);
    // «Сегодня» и «Следующая сессия» обе показывают неделю 3 (build ~43 мин), не неделю 1 (30 мин).
    expect(screen.getAllByText(/43 мин/).length).toBeGreaterThan(0);
  });

  it('показывает «⏭ Следующая сессия» и кнопку «▶ Старт»', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-next' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-next', sport: 'pl', linkedAt: 'x' });
    render(<CardioLinkCard />);
    expect(screen.getByText(/Следующая сессия/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Начать сессию в дневнике/ })).toBeTruthy();
  });

  it('факт дня: выполненные сессии и нагрузка (сила+кардио)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-fact' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-fact', sport: 'bb', linkedAt: 'x' });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    saveCardioLogEntry({ id: 'x1', date: iso, type: 'zone2', durationMin: 30, rpe: 6, completed: true, calories: 210 });
    saveSRPESession({ date: iso, sRPE: 8, durationMin: 60 });
    render(<CardioLinkCard />);
    expect(screen.getByText(/Нагрузка дня/)).toBeTruthy();
    expect(screen.getByText(/кардио 30 мин/)).toBeTruthy();
  });
});
