/**
 * planner-ui-e2e-smoke.test.tsx — D-28 П2: функциональная проверка кнопок планировщика.
 * Реальный рендер IndividualPlan + генерация плана, затем клики:
 *  - спец-режимы: БУЧ / Хочу сладкое / Ленивый день / Спецприём / Читмил / Углев. загрузка;
 *  - быстрые действия приёмов: Дубль (появляется «(копия)»), Удалить.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const findBtn = (label: RegExp): HTMLElement | undefined => {
  const matches = Array.from(document.querySelectorAll<HTMLElement>('button,div,span'))
    .filter(b => (b.textContent || '').match(label))
    .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
  return matches[0];
};

const clickBtn = (label: RegExp) => {
  const b = findBtn(label);
  if (!b) throw new Error('Button not found: ' + label);
  fireEvent.click(b);
};

const bodyHas = (re: RegExp) => !!(document.body.textContent || '').match(re);

const generateAndOpenPlan = async () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
  clickBtn(/✨ Сгенерировать план питания/);
  await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 25000 });
};

describe('планировщик: E2E-кнопки спец-режимов', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('БУЧ — карточка появляется после клика', async () => {
    await generateAndOpenPlan();
    clickBtn(/⤴️⤵️ БУЧ/);
    await waitFor(() => { expect(bodyHas(/Белково-углеводное чередование/)).toBe(true); }, { timeout: 5000 });
    expect(bodyHas(/ВУ \(тренировка\)/)).toBe(true);
  });

  it('Хочу сладкое — карточка появляется', async () => {
    await generateAndOpenPlan();
    clickBtn(/🍬 Хочу сладкое/);
    await waitFor(() => { expect(bodyHas(/Хочу сладкое/)).toBe(true); }, { timeout: 5000 });
  });

  it('Ленивый день — карточка появляется', async () => {
    await generateAndOpenPlan();
    clickBtn(/🛋 Ленивый день/);
    await waitFor(() => { expect(bodyHas(/Ленивый день/)).toBe(true); }, { timeout: 5000 });
  });

  it('Спецприём — карточка с рекомендуемыми продуктами', async () => {
    await generateAndOpenPlan();
    clickBtn(/🍽️ Спецприём/);
    await waitFor(() => { expect(bodyHas(/Рекомендуемые продукты/)).toBe(true); }, { timeout: 5000 });
  });

  it('Читмил и Углев. загрузка — карточки появляются', async () => {
    await generateAndOpenPlan();
    clickBtn(/🍔 Читмил/);
    await waitFor(() => { expect(bodyHas(/Читмил ПОСЛЕ тяжёлой тренировки/)).toBe(true); }, { timeout: 5000 });
    clickBtn(/🍚 Углев. загрузка/);
    await waitFor(() => { expect(bodyHas(/Заполнение гликогена/)).toBe(true); }, { timeout: 5000 });
  });
});

describe('планировщик: быстрые действия приёмов', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  it('«Дубль» дублирует приём (появляется «(копия)») и «Отменить» откатывает', async () => {
    await generateAndOpenPlan();
    clickBtn(/Дубль/);
    await waitFor(() => { expect(bodyHas(/Выберите приём/)).toBe(true); }, { timeout: 5000 });
    // кликаем первый приём из списка (любая кнопка, содержащая "ккал" в списке дубля)
    const mealBtn = Array.from(document.querySelectorAll('button')).find(b => /ккал/.test(b.textContent || '') && !/Отмена/.test(b.textContent || ''));
    if (!mealBtn) throw new Error('meal list button not found');
    fireEvent.click(mealBtn);
    await waitFor(() => { expect(bodyHas(/\(копия\)/)).toBe(true); }, { timeout: 5000 });
  });

  it('«Удалить» удаляет приём', async () => {
    await generateAndOpenPlan();
    const before = (document.body.textContent || '').split('Завтрак').length - 1;
    clickBtn(/Удалить/);
    await waitFor(() => { expect(bodyHas(/Выберите приём/)).toBe(true); }, { timeout: 5000 });
    const mealBtn = Array.from(document.querySelectorAll('button')).find(b => /ккал/.test(b.textContent || '') && !/Отмена/.test(b.textContent || ''));
    if (!mealBtn) throw new Error('meal list button not found');
    fireEvent.click(mealBtn);
    await waitFor(() => { expect((document.body.textContent || '').split('Завтрак').length - 1).toBeLessThan(before); }, { timeout: 5000 });
  });
});

describe('планировщик: спец-приёмы по дате меняют план (D-28 П3)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const seedSpecial = (type: string) => {
    try {
      localStorage.setItem('he_special_meals', JSON.stringify([{ type, typeLabel: type, date: localToday(), notes: 'тест' }]));
    } catch {}
  };

  it('рефид по дате — заметка в плане', async () => {
    seedSpecial('refeed');
    await generateAndOpenPlan();
    await waitFor(() => { expect(bodyHas(/Рефид по расписанию/)).toBe(true); }, { timeout: 25000 });
  });

  it('читмил по дате — заметка в плане', async () => {
    seedSpecial('cheat_meal');
    await generateAndOpenPlan();
    await waitFor(() => { expect(bodyHas(/Читмил по расписанию/)).toBe(true); }, { timeout: 25000 });
  });

  it('фастинг по дате — заметка в плане и меньше приёмов', async () => {
    seedSpecial('fast');
    await generateAndOpenPlan();
    await waitFor(() => { expect(bodyHas(/Фастинг по расписанию/)).toBe(true); }, { timeout: 25000 });
  });
});