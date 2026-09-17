/**
 * planner-wave3-ui.test.tsx — волна-3 UI-смок:
 *  - карточка «🧭 Почему день не сошёлся» рендерится из notes движка (data-bitexplain);
 *  - A/B планов: снапшот в слот A/B (localStorage he_nutrition_ab_v1) и diff-таблица.
 * Сценарий 1: генерируем день (карточка сохранённых планов появляется только на выдаче),
 * затем поднимаем из «Сохранённых планов» день с нотами-причинами движка — детерминированно.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const craftedDayPlan = () => ({
  isTrainingDay: false,
  totals: { kcal: 3000, p: 180, f: 80, c: 400, fiber: 30 },
  meals: [
    {
      label: 'Завтрак', type: 'breakfast', time: '08:00',
      target: { p: 40, f: 20, c: 70 },
      totals: { kcal: 600, p: 40, f: 20, c: 70 },
      items: [
        { id: 'oats_dry', name: 'Овсянка', amount: 80, p: 10, f: 5, c: 48, kcal: 300, role: 'carb_slow' },
        { id: 'egg_whole', name: 'Яйцо', amount: 60, p: 8, f: 7, c: 1, kcal: 96, role: 'protein' },
      ],
    },
    {
      label: 'Обед', type: 'lunch', time: '13:00',
      target: { p: 60, f: 25, c: 110 },
      totals: { kcal: 900, p: 60, f: 25, c: 110 },
      items: [
        { id: 'chicken_breast', name: 'Курица', amount: 150, p: 36, f: 3, c: 0, kcal: 170, role: 'protein' },
        { id: 'rice_white', name: 'Рис', amount: 250, p: 7, f: 1, c: 70, kcal: 325, role: 'carb_slow' },
      ],
    },
  ],
  allergenWarnings: [], supplementTimeline: [], waterTimeline: [], nutritionLogic: [],
  dietDiversity: { uniqueFoods: 4, totalPortions: 0, categories: {}, score: 4, note: '4 уникальных продукта' },
  timingScores: {}, intraWorkout: null,
  mpsSummary: { meals: [], avg_protein_per_meal_g: 50, avg_leucine_g: 2.5, fiberG: 30, fiberTargetG: 35 },
  proNotes: [], microSummary: { coverage: [], topDeficitNutrient: null }, isRefeedDay: false,
  healthScore: { score: 7, issues: [] },
  notes: [
    '⚠ «Не сошлось»: отклонение дня от целей 20% (>8%) — пулы/капы не закрыли цели, итог честный best-effort, а не подгонка мусором',
    '⚠ «Перекус 2»: 36У из цели 120У (<60%) — не сошлось: капы семейств/комната ккал не дали долить, дотяните вручную',
    '➕ Финальный добор сходимости: +142 ккал плотными носителями (Б190/Ж80/У405)',
    '⏰ MPS gap 5.0ч между «Завтрак» и «Обед» — превышено окно 3-4ч (optimal, Areta 20g/3h)',
  ],
});

const seed = () => {
  try {
    localStorage.setItem('he_planner_mode', 'pro');
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80, height: 180, age: 30, sex: 'male', bodyFat: 14 },
        training: { primaryGoal: 'mass' },
        pharma: { phase: 'course' },
        nutrition: {},
      },
    }));
    localStorage.setItem('he_saved_nutrition_plans', JSON.stringify([
      { id: 1, date: '2026-09-17', name: 'Тест-день', dayPlan: craftedDayPlan(), threeDayPlan: null, weekPlan: null, shoppingList: null, waterCalc: null },
    ]));
  } catch {}
};

const clickBtn = (re: RegExp) => {
  const found = Array.from(document.querySelectorAll('button')).filter(b => re.test(b.textContent || ''));
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};

const generate = async () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
  clickBtn(/✨ Сгенерировать план питания/);
  await waitFor(() => { expect(localStorage.getItem('he_day_plan')).toBeTruthy(); }, { timeout: 60000 });
};

describe('Волна-3 UI: разбор дня и A/B планов', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} cleanup(); seed(); });
  afterEach(() => { try { cleanup(); } catch {} });

  it('карточка «почему день не сошёлся» показывает причины и компенсации', async () => {
    await generate();
    const load = await waitFor(() => {
      const b = document.querySelector('[aria-label="Загрузить сохранённый план"]') as HTMLElement | null;
      expect(b).toBeTruthy();
      return b!;
    }, { timeout: 15000 });
    fireEvent.click(load);
    const card = await waitFor(() => {
      const c = document.querySelector('[data-bitexplain="1"]') as HTMLElement | null;
      expect(c).toBeTruthy();
      return c!;
    }, { timeout: 8000 });
    expect(card.textContent || '').toMatch(/Почему день не сошёлся/);
    // причина итога дня, причина по приёму, компенсация движка и проверки — все категории
    expect(card.querySelector('[data-bitexplain-cause="not-converged"]')).toBeTruthy();
    expect(card.querySelector('[data-bitexplain-cause="meal-carb-short"]')).toBeTruthy();
    expect(card.querySelector('[data-bitexplain-fixes="1"]')).toBeTruthy();
    expect(card.querySelector('[data-bitexplain-checks="1"]')).toBeTruthy();
  }, 90000);

  it('A/B планов: слоты A/B, сравнение и diff-таблица', async () => {
    await generate();
    await waitFor(() => expect(document.querySelector('[data-ab="card"]')).toBeTruthy(), { timeout: 15000 });

    fireEvent.click(document.querySelector('[data-ab="save-A"]') as HTMLElement);
    await waitFor(() => {
      expect(localStorage.getItem('he_nutrition_ab_v1') || '').toContain('"A"');
    }, { timeout: 8000 });
    fireEvent.click(document.querySelector('[data-ab="save-B"]') as HTMLElement);
    await waitFor(() => {
      expect(localStorage.getItem('he_nutrition_ab_v1') || '').toContain('"B"');
    }, { timeout: 8000 });
    await waitFor(() => {
      const cmp = document.querySelector('[data-ab="compare"]') as HTMLButtonElement | null;
      expect(cmp && !cmp.disabled).toBe(true);
    }, { timeout: 8000 });
    fireEvent.click(document.querySelector('[data-ab="compare"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-ab="diff"]')).toBeTruthy(), { timeout: 8000 });
    const diff = document.querySelector('[data-ab="diff"]') as HTMLElement;
    // одинаковые снапшоты → честные нули и «макросы совпали»
    expect(diff.textContent || '').toMatch(/B vs A/);
    expect(diff.textContent || '').toMatch(/макросы совпали/);

    // очистка слота B: кнопка ✕ и слот пустеет
    fireEvent.click(document.querySelector('[data-ab="clear-B"]') as HTMLElement);
    await waitFor(() => {
      const raw = localStorage.getItem('he_nutrition_ab_v1') || '';
      expect(raw).not.toContain('"B"');
    }, { timeout: 8000 });
  }, 90000);
});
