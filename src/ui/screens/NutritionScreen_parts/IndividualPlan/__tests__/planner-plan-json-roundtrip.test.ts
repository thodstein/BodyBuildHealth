/**
 * planner-plan-json-roundtrip.test.ts — B23 (аудит 2026-10).
 *
 * Находка: «Копировать» кладёт в буфер человекочитаемый текст, а «Импорт» ожидает
 * JSON — и подсказка в модалке прямо отсылала к «Копировать». Пара функций была
 * нефункциональна по замыслу: скопировал → вставил → «неверный формат».
 *
 * Замок: машинный формат («⧉ JSON») обязан проходить импорт БЕЗ ПОТЕРЬ, а
 * человекочитаемый текст обязан давать понятную ошибку с отсылкой к JSON-кнопке,
 * а не к «Копировать».
 */
import { describe, it, expect } from 'vitest';
import { buildPlanExportJson, importPlanFromText, _validateImportedPlan } from '../IndividualPlanResults';

const samplePlan = () => ({
  meals: [
    {
      type: 'breakfast', label: 'Завтрак', time: '07:30',
      items: [
        { id: 'oats_dry', name: 'Овсянка', amount: 80, kcal: 300, p: 10, f: 6, c: 50, fiber: 8 },
        { id: 'whey_protein', name: 'Протеин', amount: 30, kcal: 120, p: 24, f: 1, c: 2, fiber: 0 },
      ],
      totals: { kcal: 999, p: 99, f: 99, c: 99 }, // намеренно «врущие» — должны пересчитаться
    },
    {
      type: 'lunch', label: 'Обед', time: '13:00',
      items: [{ id: 'chicken_breast', name: 'Курица', amount: 180, kcal: 200, p: 40, f: 4, c: 0, fiber: 0 }],
      totals: { kcal: 0, p: 0, f: 0, c: 0 },
    },
  ],
  totals: { kcal: 0, p: 0, f: 0, c: 0 },
});

const humanText = (p: any) =>
  `🍽 План питания\n${p.meals.map((m: any) => `${m.time} ${m.label}: ${m.items.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}`).join('\n')}\n\n📊 Итого: 620 ккал`;

describe('B23: «JSON» и «Импорт» совместимы', () => {
  it('buildPlanExportJson даёт разбираемый JSON со схемой и планом', () => {
    const json = buildPlanExportJson(samplePlan());
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('he_plan_v1');
    expect(parsed.plan.meals).toHaveLength(2);
  });

  it('экспорт → импорт возвращает план без потерь (дни, приёмы, продукты, граммовки)', () => {
    const src = samplePlan();
    const res = importPlanFromText(buildPlanExportJson(src));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.meals).toHaveLength(2);
    expect(res.plan.meals[0].items).toHaveLength(2);
    expect(res.plan.meals[0].items[0].id).toBe('oats_dry');
    expect(res.plan.meals[0].items[0].amount).toBe(80);
    expect(res.plan.meals[1].items[0].name).toBe('Курица');
  });

  it('импорт пересчитывает totals из items, а не доверяет файлу', () => {
    const res = importPlanFromText(buildPlanExportJson(samplePlan()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 300+120 = 420 ккал в завтраке (в файле было 999)
    expect(res.plan.meals[0].totals.kcal).toBe(420);
    expect(res.plan.totals.kcal).toBe(620);
  });

  it('импорт принимает «голый» план без обёртки (обратная совместимость)', () => {
    const res = importPlanFromText(JSON.stringify(samplePlan()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.meals).toHaveLength(2);
  });

  it('человекочитаемый текст «Копировать» даёт ошибку с отсылкой к JSON-кнопке', () => {
    const res = importPlanFromText(humanText(samplePlan()));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    // РАНЬШЕ подсказка отсылала к «Копировать» — то есть к тому же тексту, который не парсится.
    expect(res.reason).toContain('JSON');
    expect(res.reason).not.toContain('Копировать');
  });

  it('пустая строка и мусор дают понятную ошибку, а не исключение', () => {
    expect(importPlanFromText('').ok).toBe(false);
    expect(importPlanFromText('   ').ok).toBe(false);
    expect(importPlanFromText('не json').ok).toBe(false);
    expect(importPlanFromText('{"meals":[]}').ok).toBe(false);
  });

  it('структурно неверный план отклоняется с причиной', () => {
    const bad = { meals: [{ items: [{ name: 'Продукт', amount: -5 }] }] };
    const res = importPlanFromText(JSON.stringify(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('структура');
    // валидатор тоже должен это ловить (единый источник правды)
    expect(_validateImportedPlan(bad).ok).toBe(false);
  });
});
