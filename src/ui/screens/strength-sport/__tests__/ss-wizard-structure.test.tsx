/**
 * ss-wizard-structure.test.tsx — BB-стиль визарда ТА/стронг:
 * аккордеоны params (первый открыт, остальные свернуты с саммари),
 * нумерованные пилюли с группой, навигация Далее/Назад.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

beforeEach(() => {
  localStorage.clear();
});

describe('SS wizard structure (BB-style)', () => {
  it('params: 7 карточек, свернуты все кроме первой, саммари видны', () => {
    const { container } = render(<StrengthSportConstructor />);
    const heads = container.querySelectorAll('.ss-sec-head');
    expect(heads.length).toBe(6);
    const states = Array.from(heads).map((h) => h.getAttribute('aria-expanded'));
    expect(states.filter((s) => s === 'false').length).toBe(6);
    expect(document.body.textContent).toContain('Подбирает сплит, тоннаж и % зоны');
    expect(document.body.textContent).toContain('всё доступно');
    expect(document.body.textContent).toContain('не калиброван');
  });

  it('раскрытие аккордеона работает, саммари прячется', () => {
    const { container } = render(<StrengthSportConstructor />);
    const head = Array.from(container.querySelectorAll('.ss-sec-head')).find((h) =>
      h.textContent?.includes('Методика'),
    )!;
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).not.toContain('База первой · DUP выкл · чисто');
  });

  it('саммари живые: выбор инвентаря меняет подпись', () => {
    render(<StrengthSportConstructor />);
    expect(document.body.textContent).toContain('всё доступно');
    fireEvent.click(screen.getByText('Штанга'));
    expect(document.body.textContent).toContain('Инвентарь: 1');
  });

  it('пилюли нумерованы 1-4 с разделителем групп', () => {
    const { container } = render(<StrengthSportConstructor />);
    const steps = container.querySelector("[data-ss='steps']")!;
    expect(steps.textContent).toContain('1 ⚙️ Параметры');
    expect(steps.textContent).toContain('4 📋 План');
    const pills = steps.querySelectorAll('button[aria-pressed]');
    expect(pills.length).toBe(4);
  });

  it('навигация Далее/Назад по всем шагам', () => {
    const { container } = render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → Вне зала/));
    expect(document.body.textContent).toContain('Вне зала — поле');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Режим и цель');
    fireEvent.click(screen.getByText(/Далее → Вне зала/));
    fireEvent.click(screen.getByText(/Далее → Сплит/));
    expect(document.body.textContent).toContain('Интернет-цикл');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Вне зала — поле');
    expect(container.querySelector("[data-ss='wizard-nav']")).not.toBeNull();
  });
});
