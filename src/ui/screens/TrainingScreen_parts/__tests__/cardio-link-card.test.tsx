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

const CYCLES_KEY = 'he_cardio_cycles';
const LINK_KEY = 'he_cardio_link';
const TRACK_KEY = 'he_training_planning_track';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(LINK_KEY);
    localStorage.removeItem(TRACK_KEY);
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

  it('«Пересчитать под ACWR» адаптирует и сохраняет цикл', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'cc-2', name: 'Сушка-кардио' });
    saveCardioCycle(c);
    setCardioLink({ cycleId: 'cc-2', sport: 'bb', linkedAt: 'x' });
    render(<CardioLinkCard />);
    fireEvent.click(screen.getByRole('button', { name: /Пересчитать под ACWR/ }));
    expect(screen.getByText(/✅ Кардио/)).toBeTruthy();
    expect(loadCardioCycles()).toHaveLength(1);
  });
});
