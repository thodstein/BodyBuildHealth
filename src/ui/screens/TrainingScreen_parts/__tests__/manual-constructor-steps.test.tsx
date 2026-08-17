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
    sessionStorage.clear();
  });

  it('шаг 1 «Выбор»: навигационные пилюли видны', () => {
    render(<ProgramManagerPanelWithProvider />);
    expect(screen.getByText('1 Выбор')).toBeTruthy();
    expect(screen.getByText('2 Редактор')).toBeTruthy();
    expect(screen.getByText('3 Итог')).toBeTruthy();
    expect(screen.getByText('🆕 Создать новую')).toBeTruthy();
  });

  it('онбординг: баннер «Как работает конструктор» при первом запуске, скрывается навсегда по кнопке', () => {
    render(<ProgramManagerPanelWithProvider />);
    expect(screen.getByText('👋 Как работает ручной конструктор')).toBeTruthy();
    fireEvent.click(screen.getByText('Понятно, поехали →'));
    expect(screen.queryByText('👋 Как работает ручной конструктор')).toBeNull();
    expect(localStorage.getItem('he_manual_onboarding_done')).toBe('1');
  });

  it('standard: создание → «Далее: Недели →» (первый шаг Параметры), затем «Далее: Итог →» + «← Назад»', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeTruthy(), { timeout: 15000 });
    // Пилюля «2 Редактор» активна, внутренние пилюли standard видны, счётчик шага
    expect(screen.getByText('2 Редактор')).toBeTruthy();
    expect(screen.getByText('🎛 Параметры')).toBeTruthy();
    expect(screen.getByText('🗓 Недели')).toBeTruthy();
    expect(screen.getByText('шаг 1 из 2')).toBeTruthy();
    // Заголовок активного шага с описанием
    expect(screen.getByText('Параметры программы')).toBeTruthy();
    expect(screen.getByText('Название, цель, уровень, дни и недели + заметки тренера')).toBeTruthy();
    // На первом шаге кнопки «← Назад» нет, галочек на пройденных шагах нет
    expect(screen.queryByText('← Назад: Параметры')).toBeNull();
    expect(screen.queryByText('✓ 🎛 Параметры')).toBeNull();
    fireEvent.click(screen.getByText('Далее: Недели →'));
    expect(screen.getByText('Далее: Итог →')).toBeTruthy();
    expect(screen.getByText('шаг 2 из 2')).toBeTruthy();
    expect(screen.getByText('Недели и упражнения')).toBeTruthy();
    // Пройденный шаг «Параметры» получает галочку
    expect(screen.getByText('✓ 🎛 Параметры')).toBeTruthy();
    // На втором шаге появляется «← Назад: Параметры» — возврат на первый шаг
    expect(screen.getByText('← Назад: Параметры')).toBeTruthy();
    fireEvent.click(screen.getByText('← Назад: Параметры'));
    expect(screen.getByText('Далее: Недели →')).toBeTruthy();
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

  it('pro: внутренние шаги редактора (Профиль → Параметры → Недели → Анализ → Обратная связь → Инструменты → Итог) с «← Назад»', async () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getByText('Профессиональный'));
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Параметры →')).toBeTruthy(), { timeout: 15000 });
    // Все 6 внутренних пилюль видны + счётчик
    expect(screen.getByText('👤 Профиль')).toBeTruthy();
    expect(screen.getByText('🎛 Параметры')).toBeTruthy();
    expect(screen.getByText('🗓 Недели')).toBeTruthy();
    expect(screen.getByText('📊 Анализ')).toBeTruthy();
    expect(screen.getByText('🔄 Обратная связь')).toBeTruthy();
    expect(screen.getByText('🔧 Инструменты')).toBeTruthy();
    expect(screen.getByText('шаг 1 из 6')).toBeTruthy();
    // Заголовок активного шага (профиль)
    expect(screen.getByText('Данные атлета')).toBeTruthy();
    // «Далее» ведёт по шагам pro
    fireEvent.click(screen.getByText('Далее: Параметры →'));
    expect(screen.getByText('Далее: Недели →')).toBeTruthy();
    expect(screen.getByText('шаг 2 из 6')).toBeTruthy();
    // «← Назад: Профиль» возвращает на первый шаг
    expect(screen.getByText('← Назад: Профиль')).toBeTruthy();
    fireEvent.click(screen.getByText('← Назад: Профиль'));
    expect(screen.getByText('Далее: Параметры →')).toBeTruthy();
    // Проходим до конца
    fireEvent.click(screen.getByText('Далее: Параметры →'));
    fireEvent.click(screen.getByText('Далее: Недели →'));
    expect(screen.getByText('Далее: Анализ →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Анализ →'));
    expect(screen.getByText('Далее: Обратная связь →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Обратная связь →'));
    expect(screen.getByText('Далее: Инструменты →')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее: Инструменты →'));
    expect(screen.getByText('Далее: Итог →')).toBeTruthy();
    expect(screen.getByText('шаг 6 из 6')).toBeTruthy();
  });

  it('пилюли «Редактор»/«Итог» не переводят без выбранной программы', () => {
    render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getByText('2 Редактор'));
    expect(screen.queryByText('Далее: Недели →')).toBeNull();
    expect(screen.getByText('🆕 Создать новую')).toBeTruthy();
    fireEvent.click(screen.getByText('3 Итог'));
    expect(screen.queryByText('💾 Сохранить и завершить')).toBeNull();
  });

  it('клавиатура: ArrowRight → следующий шаг, ArrowLeft → предыдущий (вне полей ввода)', async () => {
    const { container } = render(<ProgramManagerPanelWithProvider />);
    fireEvent.click(screen.getAllByText('ББ')[0]);
    await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeTruthy(), { timeout: 15000 });
    const editor = container.querySelector('.manual-constructor--editor');
    expect(editor).toBeTruthy();
    // ArrowLeft на первом шаге — ничего не меняет
    fireEvent.keyDown(editor!, { key: 'ArrowLeft' });
    expect(screen.getByText('Далее: Недели →')).toBeTruthy();
    // ArrowRight → шаг «Недели»
    fireEvent.keyDown(editor!, { key: 'ArrowRight' });
    expect(screen.getByText('Далее: Итог →')).toBeTruthy();
    expect(screen.getByText('шаг 2 из 2')).toBeTruthy();
    // ArrowLeft → назад на «Параметры»
    fireEvent.keyDown(editor!, { key: 'ArrowLeft' });
    expect(screen.getByText('Далее: Недели →')).toBeTruthy();
  });
});