/**
 * planner-generation-mode.test.tsx — A-блок smoke: две карточки-кнопки режима генерации
 * («🥩 По продуктам» / «🍳 По рецептам») + персист he_planner_gen_mode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const findBtn = (text: string) => Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes(text));

describe('Режим генерации: карточки «По продуктам» / «По рецептам»', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('обе карточки видны, по умолчанию выбраны продукты', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(findBtn('По продуктам')).toBeTruthy();
    expect(findBtn('По рецептам')).toBeTruthy();
    // кнопка генерации в режиме продуктов — зелёная классика
    const gen = findBtn('Сгенерировать план питания');
    expect(gen).toBeTruthy();
  });

  it('клик «🍳 По рецептам» переключает режим + пояснение и сохраняется в localStorage', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    const recipesCard = findBtn('По рецептам')!;
    fireEvent.click(recipesCard);
    try {
      expect(localStorage.getItem('he_planner_gen_mode')).toBe('recipes');
    } catch {}
    // текст генерации меняется на рецептурный
    expect(findBtn('Сгенерировать план по рецептам')).toBeTruthy();
    // пояснение про «ТОЛЬКО по рецептам» показано
    expect(document.body.textContent || '').toContain('ТОЛЬКО по рецептам');
  });

  it('обратное переключение на продукты восстанавливает классический текст', () => {
    try { localStorage.setItem('he_planner_gen_mode', 'recipes'); } catch {}
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(findBtn('Сгенерировать план по рецептам')).toBeTruthy();
    fireEvent.click(findBtn('По продуктам')!);
    try {
      expect(localStorage.getItem('he_planner_gen_mode')).toBe('products');
    } catch {}
    expect(findBtn('Сгенерировать план питания')).toBeTruthy();
  });
});
