/**
 * planner-recipe-mode-e2e.test.tsx — режим «по рецептам»: сквозной прогон.
 * Генерация в режиме recipes → основные приёмы получают 2–3 варианта,
 * клик «Выбрать» пересобирает рацион без ошибок.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const findBtn = (label: RegExp): HTMLElement | undefined => {
  const matches = Array.from(document.querySelectorAll<HTMLElement>('button,div,span'))
    .filter(b => (b.textContent || '').match(label))
    .sort((a, b) => (a.tagName === 'BUTTON' ? 0 : 1) - (b.tagName === 'BUTTON' ? 0 : 1) || (a.textContent || '').length - (b.textContent || '').length);
  return matches[0];
};

const clickBtn = (label: RegExp) => {
  const b = findBtn(label);
  if (!b) throw new Error('Button not found: ' + label);
  fireEvent.click(b);
};

const bodyHas = (re: RegExp) => !!(document.body.textContent || '').match(re);

describe('режим «по рецептам»: E2E', () => {
  beforeEach(() => { try { localStorage.clear(); localStorage.setItem('he_planner_gen_mode', 'recipes'); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('генерация даёт варианты рецептов у основных приёмов', async () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/🍳 Сгенерировать план по рецептам/);
    await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 30000 });
    await waitFor(() => { expect(bodyHas(/Варианты рецептов/)).toBe(true); }, { timeout: 15000 });
    expect(bodyHas(/Выбрать/)).toBe(true);
    // кнопка «Другие варианты» присутствует
    expect(bodyHas(/Другие варианты/)).toBe(true);
  }, 90000);

  it('клик «Выбрать» отмечает рецепт выбранным и не ломает план', async () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/🍳 Сгенерировать план по рецептам/);
    await waitFor(() => { expect(bodyHas(/Варианты рецептов/)).toBe(true); }, { timeout: 30000 });
    const pick = Array.from(document.querySelectorAll<HTMLElement>('span')).find(s => (s.textContent || '').trim() === 'Выбрать');
    if (!pick) throw new Error('«Выбрать» not found');
    fireEvent.click(pick);
    await waitFor(() => { expect(bodyHas(/✅ Выбрано|выбрано «/)).toBe(true); }, { timeout: 8000 });
    // план жив: завтрак на месте
    expect(bodyHas(/Завтрак/)).toBe(true);
  }, 90000);
});
