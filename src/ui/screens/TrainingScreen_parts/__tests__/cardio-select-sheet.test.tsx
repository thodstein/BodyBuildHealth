/**
 * cardio-select-sheet.test.tsx — контракт попап-шита вместо нативных <select>.
 *
 * Спринт 5/P2: нативный select в TG/Android WebView неуправляем (крошечный,
 * системный стиль, ломает 44px-тач-норму). Все 9 мест кардио-UI переведены
 * на CardioSelectSheet. Здесь держим РЕАЛЬНЫЙ путь: открыть → выбрать →
 * значение применено, закрыто; Escape/Готово закрывают без выбора.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SelectInput, CardioSelectSheet } from '../CardioUI';

const OPTS = [
  { value: 'a', label: 'А · главный' },
  { value: 'b', label: 'Б · контрольный' },
  { value: 'c', label: 'В · тренировочный' },
];

describe('CardioSelectSheet — вместо нативного select', () => {
  it('нативного <select> в разметке нет вообще', () => {
    const { container } = render(<SelectInput value="b" onChange={() => {}} options={OPTS} ariaLabel="Приоритет" />);
    expect(container.querySelector('select')).toBeNull();
  });

  it('показывает текущее значение и открывает шит по триггеру', () => {
    render(<SelectInput value="b" onChange={() => {}} options={OPTS} ariaLabel="Приоритет" />);
    const trigger = screen.getByRole('button', { name: 'Приоритет' });
    expect(trigger.textContent).toContain('Б · контрольный');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('выбор опции отдаёт значение и закрывает шит', () => {
    const onChange = vi.fn();
    render(<CardioSelectSheet value="b" onChange={onChange} options={OPTS} label="Приоритет" />);
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /А · главный/ }));
    expect(onChange).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Готово» закрывает БЕЗ выбора (значение не меняется)', () => {
    const onChange = vi.fn();
    render(<SelectInput value="b" onChange={onChange} options={OPTS} ariaLabel="Приоритет" />);
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Готово' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('клик по подложке закрывает без выбора', () => {
    const onChange = vi.fn();
    const { baseElement } = render(<SelectInput value="b" onChange={onChange} options={OPTS} ariaLabel="Приоритет" />);
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    const backdrop = baseElement.querySelector('[data-cardio="select-backdrop"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape закрывает шит', () => {
    render(<SelectInput value="b" onChange={() => {}} options={OPTS} ariaLabel="Приоритет" />);
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('выбранная опция помечена галочкой и aria-pressed', () => {
    render(<SelectInput value="b" onChange={() => {}} options={OPTS} ariaLabel="Приоритет" />);
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByRole('button', { name: /Б · контрольный/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dlg).getByRole('button', { name: /А · главный/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('опции и «Готово» — тач-норма (≥52px), триггер ≥48px', () => {
    render(<SelectInput value="b" onChange={() => {}} options={OPTS} ariaLabel="Приоритет" />);
    expect(screen.getByRole('button', { name: 'Приоритет' }).style.minHeight).toBe('48px');
    fireEvent.click(screen.getByRole('button', { name: 'Приоритет' }));
    const dlg = screen.getByRole('dialog');
    for (const b of within(dlg).getAllByRole('button')) {
      expect(Number.parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(52);
    }
  });

  it('disabled-триггер не открывает шит', () => {
    const onChange = vi.fn();
    render(<SelectInput value="b" onChange={onChange} options={OPTS} ariaLabel="Приоритет" disabled />);
    const trigger = screen.getByRole('button', { name: 'Приоритет' });
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
