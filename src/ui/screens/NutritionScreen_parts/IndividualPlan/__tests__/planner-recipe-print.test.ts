/**
 * planner-recipe-print.test.ts — B6: печатное «Меню с рецептами».
 * Контент (ингредиенты/шаги) + XSS-экранирование пользовательских строк.
 */
import { describe, it, expect } from 'vitest';
import { buildRecipePlanPrintHtml } from '../planner-day-print';

const day = {
  totals: { kcal: 1000, p: 90, f: 30, c: 100 },
  meals: [
    {
      label: 'Обед',
      recipeApplied: 'Курица <script>alert(1)</script>',
      recipeAppliedData: {
        name: 'Курица <script>alert(1)</script>',
        kcal: 628, protein: 80.6, fat: 9.5, carbs: 51.7,
        prepTimeMin: 22,
        description: 'Соус "<img src=x onerror=alert(2)>"',
        ingredients: ['Куриная грудка & соус', 'Рис "жасмин"'],
        instructions: ['Шаг первый <b>важно</b>', 'Шаг второй'],
      },
      items: [],
    },
    {
      label: 'Перекус',
      items: [{ name: 'Творог', amount: 150 }],
      totals: { kcal: 260, p: 26, f: 8, c: 14 },
    },
  ],
};

describe('buildRecipePlanPrintHtml', () => {
  const html = buildRecipePlanPrintHtml(day);

  it('содержит сводку дня, ингредиенты и шаги рецепта', () => {
    expect(html).toContain('Меню дня по рецептам');
    expect(html).toContain('Ингредиенты');
    expect(html).toContain('Как готовить');
    expect(html).toContain('Шаг второй');
    expect(html).toContain('Куриная грудка &amp; соус');
    // остальные приёмы перечислены как продукты
    expect(html).toContain('Остальные приёмы');
    expect(html).toContain('Творог 150г');
  });

  it('экранирует XSS в названии и описании рецепта', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('пустой план → заглушка без рецептов', () => {
    const empty = buildRecipePlanPrintHtml({ meals: [], totals: {} });
    expect(empty).toContain('Выбранных рецептов нет');
  });
});
