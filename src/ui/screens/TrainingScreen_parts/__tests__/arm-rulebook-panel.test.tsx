/**
 * arm-rulebook-panel.test.tsx — PRO-7 P2: правила соревнований в UI.
 *
 * Армрестлинг: WAF-категория/весовая по весу+возрасту, честный needs_review
 * без взвешивания. Армлифтинг: попытки по снаряду (3 возрастающих / unlimited)
 * и симуляция с последствием промаха.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { ArmRulebookPanel } from '../arm-rulebook-panel';

function lift() {
  return render(<ArmRulebookPanel discipline="armlifting" />);
}

function wrist() {
  return render(<ArmRulebookPanel discipline="armwrestling" />);
}

describe('ArmRulebookPanel — армлифтинг', () => {
  it('показывает протокол снаряда и лимиты из снапшота', () => {
    const { container } = lift();
    const sec = container.querySelector("[data-arm='rulebook-lift']")!;
    expect(sec).not.toBeNull();
    expect(sec.textContent).toMatch(/Axle|аполлон/i);
    expect(sec.textContent).toMatch(/60 с/);
    expect(sec.textContent).toMatch(/выбывание|не указан/);
  });

  it('Grandfather Clock: три возрастающих веса от опенера и цели', () => {
    const { container } = lift();
    fireEvent.click(screen.getByText('Grandfather Clock'));
    fireEvent.change(screen.getByLabelText('Опенер кг'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Цель попыток кг'), { target: { value: '107.5' } });
    const strategy = container.querySelector("[data-arm='rulebook-strategy']")!;
    expect(strategy.textContent).toContain('100');
    expect(strategy.textContent).toContain('102.5');
    expect(strategy.textContent).toContain('107.5');
  });

  it('симуляция: промах на Axle = выбывание, все взяты = завершено', () => {
    const { container } = lift();
    fireEvent.change(screen.getByLabelText('Опенер кг'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Цель попыток кг'), { target: { value: '105' } });
    fireEvent.change(screen.getByLabelText('Результат попыток'), { target: { value: '1,0' } });
    const sim = container.querySelector("[data-arm='rulebook-sim']")!;
    expect(sim.textContent).toMatch(/выбывание/);

    fireEvent.change(screen.getByLabelText('Результат попыток'), { target: { value: '1,1,1' } });
    const sim2 = container.querySelector("[data-arm='rulebook-sim']")!;
    expect(sim2.textContent).toMatch(/завершено/);
    expect(sim2.textContent).toContain('105');
  });
});

describe('ArmRulebookPanel — армрестлинг', () => {
  it('без веса/возраста — честная подсказка вместо выдуманной категории', () => {
    const { container } = wrist();
    const sec = container.querySelector("[data-arm='rulebook-waf']")!;
    expect(sec.textContent).toMatch(/Введи вес и возраст/);
  });

  it('вес+возраст дают категорию и весовую, статус «нужна проверка» без взвешивания', () => {
    const { container } = wrist();
    fireEvent.change(screen.getByLabelText('Вес тела кг'), { target: { value: '78' } });
    fireEvent.change(screen.getByLabelText('Возраст лет'), { target: { value: '28' } });
    const sec = container.querySelector("[data-arm='rulebook-waf']")!;
    expect(sec.textContent).toMatch(/Senior Men/);
    expect(sec.textContent).toMatch(/\b80\b/);
    expect(sec.textContent).toMatch(/проверка/);
    const checks = container.querySelector("[data-arm='rulebook-checks']")!;
    expect(checks.textContent).toMatch(/взвешивани|weigh/i);
  });

  it('женщина 45 кг / 28 лет → Senior Women 45', () => {
    const { container } = wrist();
    fireEvent.change(screen.getByLabelText('Вес тела кг'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Возраст лет'), { target: { value: '28' } });
    fireEvent.click(screen.getByText('Ж'));
    const sec = container.querySelector("[data-arm='rulebook-waf']")!;
    expect(sec.textContent).toMatch(/Senior Women/);
  });
});
