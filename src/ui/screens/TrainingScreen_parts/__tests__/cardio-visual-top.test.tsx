/**
 * cardio-visual-top.test.tsx — guard TOP-визуала кардио (раунд 2):
 * хуки ck-* живы в прод-разметке, CTA-градиент, tabular-тайлы, flash.
 * Логика/движки не тестируются здесь — только подача.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CardioConstructor } from '../CardioConstructor';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const WIZARD_KEY = 'he_cardio_wizard_state';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(WIZARD_KEY);
  } catch { /* ignore */ }
});

const next = () => fireEvent.click(screen.getByRole('button', { name: /^Далее/ }));

describe('CardioConstructor — TOP-визуал', () => {
  it('оболочка несёт ck-хуки: wizard/hero/nav/пилюли', () => {
    const { container } = render(<CardioConstructor />);
    expect(container.querySelector('.ck-wizard')).not.toBeNull();
    expect(container.querySelector('.ck-hero')).not.toBeNull();
    expect(container.querySelector('.ck-wiznav')).not.toBeNull();
    expect(container.querySelector('.ck-nav')).not.toBeNull();
    expect(container.querySelectorAll('.ck-step-pill').length).toBe(7);
    expect(container.querySelector('.ck-step-pill[data-active="true"]')).not.toBeNull();
  });

  it('шаг 1: hero предпросмотра и тайлы на месте', () => {
    const { container } = render(<CardioConstructor />);
    expect(container.querySelector('#sec-preview')).not.toBeNull();
    expect(screen.getByText(/МИН\/НЕД/)).toBeTruthy();
  });

  it('шаг 2: атлет-секция с профильными кнопками', () => {
    render(<CardioConstructor />);
    next();
    expect(screen.getByText(/Параметры пользователя/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /В профиль/ })).toBeTruthy();
  });

  it('сборка: flash .ck-flash + hero плана .ck-planhero', () => {
    const { container } = render(<CardioConstructor />);
    next(); next(); next(); next();
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(container.querySelector('.ck-flash')).not.toBeNull();
    expect(container.querySelector('.ck-planhero')).not.toBeNull();
  });

  it('шаг 6: карточка библиотеки .ck-libcard после сборки', () => {
    const { container } = render(<CardioConstructor />);
    next(); next(); next(); next();
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    next();
    fireEvent.click(screen.getByRole('button', { name: /📚 Библиотека/ }));
    expect(container.querySelector('.ck-libcard')).not.toBeNull();
    expect(within(container as HTMLElement).getByRole('button', { name: /⧉ Копия/ })).toBeTruthy();
  });

  it('дневник: таймер-хук жив, старт-кнопка с CTA', () => {
    const { container } = render(<CardioConstructor />);
    next(); next(); next(); next();
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    next(); next();
    expect(container.querySelector('.train-cardiotimer')).not.toBeNull();
    expect(screen.getByText(/Быстрый старт сессии/)).toBeTruthy();
  });
});
