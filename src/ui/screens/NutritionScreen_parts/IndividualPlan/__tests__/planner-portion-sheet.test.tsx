/**
 * planner-portion-sheet.test.tsx — P1-UX: порция продукта через нижний лист.
 *
 * Регресс жалобы «микрокнопки очень неудобно»: в чипе продукта жили кнопки
 * fontSize:6 («+25/×2/÷2») и нативный <select> замены. Теперь чип — тач-таргет
 * ≥44px, открывающий лист со всеми действиями; нативных <select> в плане нет.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const bodyHas = (re: RegExp) => !!(document.body.textContent || '').match(re);

const clickBtn = (label: RegExp) => {
  const matches = Array.from(document.querySelectorAll<HTMLElement>('button,div,span'))
    .filter(b => (b.textContent || '').match(label))
    .sort((a, b) => (a.tagName === 'BUTTON' ? 0 : 1) - (b.tagName === 'BUTTON' ? 0 : 1) || (a.textContent || '').length - (b.textContent || '').length);
  if (!matches[0]) throw new Error('Button not found: ' + label);
  fireEvent.click(matches[0]);
};

const generateAndOpenPlan = async () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
  clickBtn(/✨ Сгенерировать план питания/);
  await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 25000 });
};

describe('планировщик: лист порции продукта (P1-UX)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('нативных <select> в плане нет (единицы/приём/замена — попапы)', async () => {
    await generateAndOpenPlan();
    expect(document.querySelectorAll('select').length).toBe(0);
  }, 90000);

  it('клик по продукту открывает лист: +25 и ✓ Сохранить закрывают его', async () => {
    await generateAndOpenPlan();
    const chip = document.querySelector<HTMLElement>('[aria-label^="Порция:"]');
    expect(chip, 'чип продукта с aria-label «Порция:» не найден').toBeTruthy();
    fireEvent.click(chip!);
    await waitFor(() => { expect(bodyHas(/ккал\/100 г/)).toBe(true); }, { timeout: 5000 });
    // Быстрые действия листа (тач-таргеты 44px+)
    const plus25 = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '+25');
    expect(plus25, 'кнопка +25 в листе не найдена').toBeTruthy();
    fireEvent.click(plus25!);
    const save = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('✓ Сохранить'));
    expect(save, 'кнопка ✓ Сохранить не найдена').toBeTruthy();
    fireEvent.click(save!);
    await waitFor(() => {
      expect(Array.from(document.querySelectorAll('button')).some(b => (b.textContent || '').includes('✓ Сохранить'))).toBe(false);
    }, { timeout: 5000 });
    expect(bodyHas(/Завтрак/)).toBe(true); // план продолжает рендериться
  }, 90000);

  it('лист: «Заменить продукт» показывает список похожих продуктов', async () => {
    await generateAndOpenPlan();
    const chip = document.querySelector<HTMLElement>('[aria-label^="Порция:"]');
    fireEvent.click(chip!);
    await waitFor(() => { expect(bodyHas(/ккал\/100 г/)).toBe(true); }, { timeout: 5000 });
    const repl = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('🔀 Заменить продукт'));
    expect(repl, 'кнопка «Заменить продукт» не найдена').toBeTruthy();
    fireEvent.click(repl!);
    await waitFor(() => { expect(bodyHas(/Заменить на похожий продукт/)).toBe(true); }, { timeout: 5000 });
  }, 90000);
});
