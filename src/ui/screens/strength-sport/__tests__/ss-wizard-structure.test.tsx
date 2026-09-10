/**
 * ss-wizard-structure.test.tsx — визард ТА/стронг в стиле комбата:
 * 7 шагов params/athlete/outside/split/plan/quality/export,
 * аккордеоны с саммари, нумерованные пилюли с группами, Далее/Назад.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

beforeEach(() => {
  localStorage.clear();
});

function goToSplit() {
  fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
  fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
  fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
}

function clickStepPill(index: number) {
  const steps = document.querySelector("[data-ss='steps']")!;
  const pills = steps.querySelectorAll('button');
  fireEvent.click(pills[index]);
}

describe('SS wizard structure (combat-style, 7 steps)', () => {
  it('params: режим открыт, методика свернута с живым саммари', () => {
    const { container } = render(<StrengthSportConstructor />);
    const heads = container.querySelectorAll('.ss-sec-head');
    expect(heads.length).toBe(1);
    expect(heads[0].getAttribute('aria-expanded')).toBe('false');
    expect(document.body.textContent).toContain('Подбирает сплит, тоннаж и % зоны');
    expect(document.body.textContent).toContain('База первой · DUP выкл · чисто');
  });

  it('раскрытие аккордеона работает, саммари прячется', () => {
    const { container } = render(<StrengthSportConstructor />);
    const head = container.querySelector('.ss-sec-head')!;
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).not.toContain('База первой · DUP выкл · чисто');
  });

  it('пилюли нумерованы 1-7 с разделителями групп', () => {
    const { container } = render(<StrengthSportConstructor />);
    const steps = container.querySelector("[data-ss='steps']")!;
    expect(steps.textContent).toContain('1 ⚙️ Параметры');
    expect(steps.textContent).toContain('2 👤 Атлет');
    expect(steps.textContent).toContain('4 🧩 Сплит');
    expect(steps.textContent).toContain('7 📤 Экспорт');
    const pills = steps.querySelectorAll('button');
    expect(pills.length).toBe(7);
  });

  it('навигация Далее/Назад по шагам', () => {
    const { container } = render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    expect(document.body.textContent).toContain('Рабочие максимумы');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Режим и цель');
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    expect(document.body.textContent).toContain('Вне зала — поле');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Рабочие максимумы');
    expect(container.querySelector("[data-ss='wizard-nav']")).not.toBeNull();
  });

  it('атлет: профиль, максимумы, VBT и LVP на одном шаге', () => {
    render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    expect(document.body.textContent).toContain('Дата пика');
    expect(document.body.textContent).toContain('Рабочие максимумы');
    expect(document.body.textContent).toContain('VBT per-lift');
    expect(document.body.textContent).toContain('LVP калибровка');
  });

  it('качество: слабые точки и здоровье отдельным шагом', () => {
    render(<StrengthSportConstructor />);
    fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
    fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
    fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
    fireEvent.click(screen.getByText(/Собрать план/));
    return screen.findByText('Сводка плана', {}, { timeout: 8000 }).then(() => {
      clickStepPill(5);
      expect(document.body.textContent).toContain('Слабые точки');
      expect(document.body.textContent).toContain('Доступное оборудование');
    });
  }, 15000);

  it('выдача: сборка ведёт на план, экспорт доступен', async () => {
    render(<StrengthSportConstructor />);
    goToSplit();
    fireEvent.click(screen.getByText(/Собрать план/));
    const card = await screen.findByText('Сводка плана', {}, { timeout: 8000 });
    expect(card).toBeTruthy();
    clickStepPill(6);
    expect(await screen.findByText(/В программу/)).toBeTruthy();
  }, 15000);
});
