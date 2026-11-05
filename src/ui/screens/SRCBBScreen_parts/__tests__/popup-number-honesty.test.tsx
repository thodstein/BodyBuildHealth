/**
 * popup-number-honesty.test.tsx — общий PopupNumber (TrainingPopups) на трёх экранах:
 * SRCBBScreen, TrainingScreen, хаб «Метаболика».
 *
 * Зачем отдельный файл: компонент один на ~180 полей, и два его свойства легко сломать
 * незаметно для экранных тестов:
 *  1) 0 — это «не задано» по умолчанию, но осознанный 0 («0 г алкоголя») должен
 *     показываться как 0, иначе поле врёт о том, что пользователь ничего не вводил;
 *  2) ОК обязан клампить min/max: раньше границы были только подсказкой для input,
 *     и в состояние уезжало 999 недель / 99999 кг.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { PopupNumber } from '../TrainingPopups';

afterEach(() => cleanup());

const trigger = () => document.querySelector('button.pl-popupnum') as HTMLButtonElement;
const numberInput = () => document.querySelector('input[type="number"]') as HTMLInputElement;

function openPopup() {
  fireEvent.click(trigger());
  expect(document.querySelector('.pl-popupoverlay'), 'попап не открылся').toBeTruthy();
}

describe('PopupNumber: 0 vs «не задано»', () => {
  it('0 без zeroIsValue — стартовое значение, а не ответ', () => {
    render(<PopupNumber label="Вес" value={0} min={0} max={300} suffix="кг" onChange={() => {}} />);
    expect(trigger().getAttribute('aria-label')).toBe('Вес: не задано');
    expect(trigger().textContent).toContain('— кг');
  });

  it('0 с zeroIsValue — ответ «0» (и в подписи, и для скринридера)', () => {
    render(<PopupNumber label="Алкоголь" value={0} min={0} max={120} suffix="г/сут" zeroIsValue onChange={() => {}} />);
    expect(trigger().getAttribute('aria-label')).toBe('Алкоголь: 0г/сут');
    expect(trigger().textContent).toContain('0г/сут');
  });

  it('undefined — «не задано» даже с zeroIsValue (пусто ≠ 0)', () => {
    render(<PopupNumber label="Кофеин" value={undefined} min={0} max={800} zeroIsValue onChange={() => {}} />);
    expect(trigger().getAttribute('aria-label')).toBe('Кофеин: не задано');
    expect(trigger().textContent).toContain('—');
  });

  it('при открытии подставляет текущее значение, а не пустую строку', () => {
    render(<PopupNumber label="Вес" value={82} min={30} max={300} onChange={() => {}} />);
    openPopup();
    expect(numberInput().value).toBe('82');
  });
});

describe('PopupNumber: ОК клампит к границам', () => {
  it('сверху: 999 при max=250 → 250', () => {
    const onChange = vi.fn();
    render(<PopupNumber label="Рост" value={180} min={80} max={250} onChange={onChange} />);
    openPopup();
    fireEvent.change(numberInput(), { target: { value: '999' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).toHaveBeenCalledWith(250);
    expect(document.querySelector('.pl-popupoverlay')).toBeNull();
  });

  it('снизу: -40 при min=0 → 0', () => {
    const onChange = vi.fn();
    render(<PopupNumber label="Кардио" value={90} min={0} max={600} onChange={onChange} />);
    openPopup();
    fireEvent.change(numberInput(), { target: { value: '-40' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('пустой ввод не пишет NaN и не вызывает onChange', () => {
    const onChange = vi.fn();
    render(<PopupNumber label="Вес" value={80} min={30} max={300} onChange={onChange} />);
    openPopup();
    fireEvent.change(numberInput(), { target: { value: '' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('.pl-popupoverlay')).toBeNull();
  });

  it('«Отмена» закрывает без onChange', () => {
    const onChange = vi.fn();
    render(<PopupNumber label="Вес" value={80} min={30} max={300} onChange={onChange} />);
    openPopup();
    fireEvent.change(numberInput(), { target: { value: '95' } });
    fireEvent.click(screen.getByText('Отмена'));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('.pl-popupoverlay')).toBeNull();
  });
});
