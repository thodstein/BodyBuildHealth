/**
 * cardio-constructor.test.tsx — SSR/CSR smoke отдельного кардио-конструктора:
 * сборка цикла, библиотека, подключение к силовому плану (cardio-bridge).
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioConstructor } from '../CardioConstructor';
import { getCardioLink, clearCardioLink } from '../../../../engines/lms/cardio-bridge';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const LINK_KEY = 'he_cardio_link';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LINK_KEY);
    clearCardioLink();
  } catch { /* ignore */ }
});

describe('CardioConstructor — SSR', () => {
  it('рендерит заголовок, кнопки и селектор цели', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Кардио-конструктор');
    expect(html).toContain('Собрать цикл');
    expect(html).toContain('Сушка');
    expect(html).toContain('Подключить к ПЛ-авто');
  });

  it('пустая библиотека показывает подсказку', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Пока пусто');
  });
});

describe('CardioConstructor — CSR', () => {
  it('«Собрать цикл» создаёт цикл, сохраняет в библиотеку и показывает недели', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Собрать цикл/ }));
    expect(screen.getByText(/✅ Кардио-цикл собран/)).toBeTruthy();
    expect(screen.getByText(/нед с HIIT/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Недели/ })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(CYCLES_KEY) ?? '[]');
    expect(saved).toHaveLength(1);
  });

  it('подключение к ПЛ-авто фиксируется в cardio-bridge', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Собрать цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Подключить к ПЛ-авто/ }));
    expect(getCardioLink()?.sport).toBe('pl');
    expect(screen.getByText(/Подключено к ПЛ-авто/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отключить/ }));
    expect(getCardioLink()).toBeNull();
  });

  it('«Из недельного плана» мигрирует план в CardioCycle', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Из недельного плана/ }));
    expect(screen.getByText(/мигрирован/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null');
    expect(saved?.totalWeeks).toBe(1);
  });
});
