/**
 * strength-sport-planner-pro-ui.test.tsx — PRO-карточки конструктора + превью волны.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

beforeEach(() => {
  localStorage.clear();
});

function goToAthlete() {
  fireEvent.click(screen.getByText(/Далее → 2 👤 Атлет/));
}

function goToSplit() {
  goToAthlete();
  fireEvent.click(screen.getByText(/Далее → 3 🏃 Вне зала/));
  fireEvent.click(screen.getByText(/Далее → 4 🧩 Сплит/));
}

describe('Planner PRO UI', () => {
  it('athlete: карточка Стронг-PRO (класс/хват/RPE-cap/модель)', () => {
    render(<StrengthSportConstructor />);
    goToAthlete();
    const t = document.body.textContent || '';
    expect(t).toContain('Стронг-PRO');
    expect(t).toContain('Весовая');
    expect(t).toContain('RPE-cap');
    expect(t).toContain('Хват становой');
  });

  it('quality: карточка Чек-ин недели (после сборки плана)', async () => {
    render(<StrengthSportConstructor />);
    goToSplit();
    fireEvent.click(screen.getByText(/Собрать план/));
    await screen.findByText('Сводка плана', {}, { timeout: 8000 });
    const steps = document.querySelector("[data-ss='steps']")!;
    fireEvent.click(steps.querySelectorAll('button')[5]);
    const t = document.body.textContent || '';
    expect(t).toContain('Слабые точки');
    expect(t).toContain('Чек-ин недели');
    expect(t).toContain('Сохранить чек-ин');
  }, 15000);

  it('split: превью волны при preselect wave (персист he_ss_pro_block)', () => {
    localStorage.setItem('he_ss_pro_block', 'wave');
    render(<StrengthSportConstructor />);
    goToSplit();
    const t = document.body.textContent || '';
    expect(t).toContain('Превью волны');
    expect(t).toContain('Н1·тяж');
  });

  it('split: без wave превью нет', () => {
    render(<StrengthSportConstructor />);
    goToSplit();
    expect(document.body.textContent || '').not.toContain('Превью волны');
  });

  it('export: кнопка В облако (явный синк) кликается без падения', async () => {
    render(<StrengthSportConstructor />);
    goToSplit();
    fireEvent.click(screen.getByText(/Собрать план/));
    await screen.findByText('Сводка плана', {}, { timeout: 8000 });
    const steps = document.querySelector("[data-ss='steps']")!;
    fireEvent.click(steps.querySelectorAll('button')[6]);
    const btn = screen.getByText(/В облако/);
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.body.textContent || '').toContain('В облако');
  }, 15000);
});
