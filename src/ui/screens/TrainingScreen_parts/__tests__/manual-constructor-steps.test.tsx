import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgramManagerPanelWithProvider } from '../ProgramManagerPanel';

/**
 * manual-constructor-steps.test.tsx — последовательные шаги ручного конструктора
 * (как в BB-авто): «1 Выбор» → «2 Редактор» → «3 Итог».
 * Внутри «2 Редактор» — внутренние шаги редактора:
 *   standard: Параметры → Недели; pro: Профиль → Параметры → Недели → Анализ → Обратная связь → Инструменты.
 */
describe('Ручной конструктор — последовательные шаги', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('шаг 1 «Выбор»: навигационные пилюли видны', () => {
    render(<ProgramManagerPanelWithProvider />);
    expect(screen.getByText('1 Выбор')).toBeTruthy();
    expect(screen.getByText('2 Редактор')).toBeTruthy();
    expect(screen.getByText('3 Итог')).toBeTruthy();
    expect(screen.getByText('🆕 Создать новую')).toBeTruthy();
  });

  it('standard: создание → «Далее: Недели →» (первый шаг Параметры), затем «Далее: Итог →»', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeTruthy(), { timeout: 15000 });
    // Пилюля «2 Редактор» активна, внутренние пилюли standard видны
    expect(screen.getByText('2 Редактор')).toBeTruthy();
    expect(screen.getByText('🎛 Параметры')).toBeTruthy();
    expect(screen.getByText('🗓 Недели')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Недели →'));
    expect(screen.getByText('Далее: Итог →')).toBeTruthy();
  });

  it('standard: «Далее: Недели →» → «Далее: Итог →» открывает шаг «Итог»', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeTruthy(), { timeout: 15000 });
    fireEvent.click(screen.getByText('Далее: Недели →'));
    fireEvent.click(screen.getByText('Далее: Итог →'));
    expect(screen.getByText('💾 Сохранить и завершить')).toBeTruthy();
    expect(screen.getByText('← Назад к редактору')).toBeTruthy();
    expect(screen.getByText('📋 В буфер')).toBeTruthy();
  });

  it('pro: внутренние шаги редактора (Профиль → Параметры → Недели → Анализ → Обратная связь → Инструменты → Итог)', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getByText('Профессиональный'));
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Параметры →')).toBeTruthy(), { timeout: 15000 });
    // Все 6 внутренних пилюль видны
    expect(screen.getByText('👤 Профиль')).toBeTruthy();
    expect(screen.getByText('🎛 Параметры')).toBeTruthy();
    expect(screen.getByText('🗓 Недели')).toBeTruthy();
    expect(screen.getByText('📊 Анализ')).toBeTruthy();
    expect(screen.getByText('🔄 Обратная связь')).toBeTruthy();
    expect(screen.getByText('🔧 Инструменты')).toBeTruthy();
    // «Далее» ведёт по шагам pro
    fireEvent.click(screen.getByText('Далее: Параметры →'));
    expect(screen.getByText('Далее: Недели →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Недели →'));
    expect(screen.getByText('Далее: Анализ →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Анализ →'));
    expect(screen.getByText('Далее: Обратная связь →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Обратная связь →'));
    expect(screen.getByText('Далее: Инструменты →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Инструменты →'));
    expect(screen.getByText('Далее: Итог →')).toBeTruthy();
  });

  it('пилюли «Редактор»/«Итог» не переводят без выбранной программы', () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getByText('2 Редактор'));
    expect(screen.queryByText('Далее: Недели →')).toBeNull();
    expect(screen.getByText('🆕 Создать новую')).toBeTruthy();
    fireEvent.click(screen.getByText('3 Итог'));
    expect(screen.queryByText('💾 Сохранить и завершить')).toBeNull();
  });
});