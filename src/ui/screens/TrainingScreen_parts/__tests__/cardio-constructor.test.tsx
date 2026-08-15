/**
 * cardio-constructor.test.tsx — SSR/CSR smoke пошагового мастера кардио:
 * степпер, сборка, интеграции, библиотека, дневник.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioConstructor } from '../CardioConstructor';
import { getCardioLink, clearCardioLink } from '../../../../engines/lms/cardio-bridge';
import { buildBbMacrocycle, serializeBbMacro, deserializeBbMacro } from '../../../../engines/lms/macrocycle.engine';
import { loadCardioCycles } from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const LINK_KEY = 'he_cardio_link';
const BB_MACRO_KEY = 'he_bb_macro';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LINK_KEY);
    localStorage.removeItem(BB_MACRO_KEY);
    clearCardioLink();
  } catch { /* ignore */ }
});

describe('CardioConstructor — SSR', () => {
  it('рендерит степпер из 5 шагов и навигацию', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Кардио-конструктор');
    expect(html).toContain('1 Параметры');
    expect(html).toContain('2 Старты');
    expect(html).toContain('3 Предпросмотр');
    expect(html).toContain('4 Управление');
    expect(html).toContain('5 Дневник');
    expect(html).toContain('Назад');
  });

  it('шаг 1 показывает цель, горизонт, быстрые старты и живой предпросмотр', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Цель цикла');
    expect(html).toContain('Сушка');
    expect(html).toContain('Горизонт');
    expect(html).toContain('Быстрые старты');
    expect(html).toContain('Структура фаз');
    expect(html).toContain('Предпросмотр цикла');
  });
});

describe('CardioConstructor — CSR', () => {
  it('навигация: Далее → Далее → предпросмотр с CTA сборки', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Соревнования и старты/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Соберите кардио-цикл/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Собрать и сохранить цикл/ })).toBeTruthy();
  });

  it('шаг «Старты»: конструирование taper (недель + пик-неделя) влияет на сборку', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Недель taper/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Больше taper/ }));
    fireEvent.click(screen.getByRole('button', { name: /Пик-неделя: вкл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.weeks.some(w => w.phase === 'peak')).toBe(false);
  });

  it('сборка на предпросмотре сохраняет цикл в библиотеку и показывает метрики', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(screen.getByText(/Мин\/нед/)).toBeTruthy();
    expect(screen.getByText(/Ккал\/нед/)).toBeTruthy();
    expect(loadCardioCycles().length).toBe(1);
    expect(JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null')).toBeTruthy();
  });

  it('пресет «Сушка · 16 нед» применяет параметры и виден в предпросмотре', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Пресет: Сушка · 16 нед/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.totalWeeks).toBe(16);
    expect(saved.goal).toBe('cut');
  });

  it('шаг 4: подключение к ПЛ-авто фиксируется в cardio-bridge', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /К ПЛ-авто/ }));
    expect(getCardioLink()?.sport).toBe('pl');
    expect(screen.getByText(/Подключено к ПЛ-авто/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отключить/ }));
    expect(getCardioLink()).toBeNull();
  });

  it('шаг 4: привязка к годовому плану ББ сохраняет cardioCycleId в макроцикл', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem(BB_MACRO_KEY, serializeBbMacro(macro));
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /К плану ББ/ }));
    expect(screen.getByText(/Привязано к годовому плану ББ/)).toBeTruthy();
    const restored = deserializeBbMacro(localStorage.getItem(BB_MACRO_KEY) ?? '');
    expect(restored?.cardioCycleId).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отвязать/ }));
    expect(deserializeBbMacro(localStorage.getItem(BB_MACRO_KEY) ?? '')?.cardioCycleId).toBeUndefined();
  });

  it('шаг 4: сравнение сценариев показывает дифф', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /⇄ Сравнить/ }));
    expect(screen.getByText(/→/)).toBeTruthy();
  });

  it('шаг 5: доступны авто-режим и дневник', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByRole('button', { name: /Подстроить сейчас/ })).toBeTruthy();
    expect(screen.getByText(/Дневник выполнения кардио/)).toBeTruthy();
  });
});
