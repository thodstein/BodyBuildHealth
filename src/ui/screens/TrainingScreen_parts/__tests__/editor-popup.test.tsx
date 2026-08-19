/**
 * editor-popup.test.tsx — EditorPopupSelect/EditorPopupNumber (общий попап-выбор
 * ручного конструктора). Кнопка-триггер → тёмный sheet в portal на body.
 */
import React from 'react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditorPopupSelect, EditorPopupNumber } from '../EditorPopup';

const OPTIONS = [
  { id: 'hypertrophy', label: '💪 Мышечная масса', desc: 'Фазы набора' },
  { id: 'cut', label: '✂️ Сушка' },
  { id: 'maintenance', label: '⚖ Поддержание' },
];

afterEach(() => cleanup());

describe('EditorPopupSelect', () => {
  it('показывает выбранную опцию на кнопке-триггере', () => {
    render(<EditorPopupSelect value="cut" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByText('✂️ Сушка')).toBeTruthy();
  });

  it('без выбранного значения показывает placeholder', () => {
    render(<EditorPopupSelect value="" options={OPTIONS} onChange={() => {}} placeholder="Выбрать" />);
    expect(screen.getByText('Выбрать')).toBeTruthy();
  });

  it('открывает попап по клику и выбирает опцию с onChange', () => {
    let picked = '';
    render(<EditorPopupSelect value="hypertrophy" options={OPTIONS} onChange={v => (picked = v)} title="Цель" />);
    fireEvent.click(screen.getByRole('button', { name: '💪 Мышечная масса' }));
    fireEvent.click(screen.getByText('⚖ Поддержание'));
    expect(picked).toBe('maintenance');
  });

  it('показывает desc выбранной/доступных опций в попапе', () => {
    render(<EditorPopupSelect value="hypertrophy" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Фазы набора')).toBeTruthy();
  });

  it('закрывается по клику на подложку', () => {
    render(<EditorPopupSelect value="cut" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Закрыть')).toBeTruthy();
    fireEvent.click(screen.getByTestId('editor-popup-overlay'));
    expect(screen.queryByText('Закрыть')).toBeNull();
  });

  it('disabled блокирует открытие', () => {
    render(<EditorPopupSelect value="cut" options={OPTIONS} onChange={() => {}} disabled />);
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(screen.queryByText('Закрыть')).toBeNull();
  });

  it('aria-label передаётся на триггер', () => {
    render(<EditorPopupSelect value="cut" options={OPTIONS} onChange={() => {}} ariaLabel="Цель программы" />);
    expect(screen.getByRole('button', { name: 'Цель программы' })).toBeTruthy();
  });
});

describe('EditorPopupNumber', () => {
  it('показывает текущее число на кнопке-триггере', () => {
    render(<EditorPopupNumber value={3} min={1} max={7} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
  });

  it('открывает диапазон и выбирает число', () => {
    let picked = 0;
    render(<EditorPopupNumber value={3} min={1} max={4} onChange={v => (picked = v)} title="Тренировок в неделе" />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText('Тренировок в неделе')).toBeTruthy();
    fireEvent.click(screen.getByText('2'));
    expect(picked).toBe(2);
  });

  it('format применяется к отображению и опциям', () => {
    render(<EditorPopupNumber value={2} min={1} max={3} onChange={() => {}} format={v => `${v} дн`} />);
    expect(screen.getByRole('button', { name: '2 дн' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2 дн' }));
    expect(screen.getByText('1 дн')).toBeTruthy();
    expect(screen.getByText('3 дн')).toBeTruthy();
  });
});