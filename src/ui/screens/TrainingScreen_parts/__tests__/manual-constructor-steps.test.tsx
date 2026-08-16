import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgramManagerPanelWithProvider } from '../ProgramManagerPanel';

/**
 * manual-constructor-steps.test.tsx — последовательные шаги ручного конструктора
 * (как в BB-авто): «1 Выбор» → «2 Редактор» → «3 Итог».
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

  it('создание программы → авто-переход на шаг «Редактор» с кнопкой «Далее: Итог →»', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Итог →')).toBeTruthy(), { timeout: 15000 });
    // Пилюля «2 Редактор» активна
    expect(screen.getByText('2 Редактор')).toBeTruthy();
  });

  it('«Далее: Итог →» открывает шаг «Итог» со сводкой и финальным сохранением', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Итог →')).toBeTruthy(), { timeout: 15000 });
    fireEvent.click(screen.getByText('Далее: Итог →'));
    expect(screen.getByText('💾 Сохранить и завершить')).toBeTruthy();
    expect(screen.getByText('← Назад к редактору')).toBeTruthy();
    expect(screen.getByText('📋 В буфер')).toBeTruthy();
  });

  it('пилюли «Редактор»/«Итог» не переводят без выбранной программы', () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getByText('2 Редактор'));
    expect(screen.queryByText('Далее: Итог →')).toBeNull();
    expect(screen.getByText('🆕 Создать новую')).toBeTruthy();
    fireEvent.click(screen.getByText('3 Итог'));
    expect(screen.queryByText('💾 Сохранить и завершить')).toBeNull();
  });
});
