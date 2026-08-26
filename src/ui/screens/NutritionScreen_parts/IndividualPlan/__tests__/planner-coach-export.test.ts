/**
 * planner-coach-export.test.ts — 📤 «Файл тренеру»: контент + XSS + download.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildCoachExportHtml, downloadCoachExport } from '../planner-day-print';

const args = {
  dateIso: '2026-08-26',
  totals: { kcal: 3000, p: 180, f: 80, c: 380 },
  goals: { kcal: 3000, p: 180, f: 80, c: 380 },
  isTrainingDay: true,
  meals: [
    {
      label: 'Обед', time: '13:00',
      recipeApplied: 'Курица <script>x</script>',
      recipeAppliedData: {
        name: 'Курица <script>x</script>', kcal: 628, protein: 80.6, fat: 9.5, carbs: 51.7,
        prepTimeMin: 22,
        ingredients: ['Курица & специи'],
        instructions: ['Шаг <b>1</b>'],
      },
      items: [{ name: 'Куриная грудка', amount: 200 }, { name: 'Рис', amount: 150 }],
      totals: { kcal: 628, p: 80, f: 10, c: 52 },
    },
    { label: 'Перекус', time: '16:00', items: [{ name: 'Творог', amount: 150 }], totals: { kcal: 260, p: 26, f: 8, c: 14 } },
  ],
  shopping: [
    { name: 'Куриная грудка', amount: 350, category: 'protein' },
    { name: 'Рис', amount: 250 },
  ],
  notes: ['Заметка <b>с html</b>'],
};

describe('buildCoachExportHtml', () => {
  const html = buildCoachExportHtml(args);

  it('содержит сводку, приёмы-таблицу, рецепты и закупки', () => {
    expect(html).toContain('План питания спортсмена — 2026-08-26');
    expect(html).toContain('Итог: <b>3000</b>');
    expect(html).toContain('Цель дня');
    expect(html).toContain('Приёмы пищи');
    expect(html).toContain('Куриная грудка 200г');
    expect(html).toContain('Выбранные рецепты');
    expect(html).toContain('Ингредиенты');
    expect(html).toContain('Шаг &lt;b&gt;1&lt;/b&gt;'); // теги экранированы, текст сохранён
    expect(html).toContain('Закупки на план');
    expect(html).toContain('350 г');
    expect(html).toContain('• Заметка &lt;b&gt;с html&lt;/b&gt;');
  });

  it('XSS экранируется в названии рецепта', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('без рецептов/закупок/заметок секции не рендерятся', () => {
    const minimal = buildCoachExportHtml({ dateIso: 'd', totals: args.totals, meals: [], shopping: [] });
    expect(minimal).not.toContain('Выбранные рецепты');
    expect(minimal).not.toContain('Закупки на план');
    expect(minimal).not.toContain('📝 Заметки');
  });
});

describe('downloadCoachExport', () => {
  it('создаёт blob-ссылку и кликает (jsdom)', () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const anchorSpy: any = { click: clickSpy, href: '', download: '', style: {} };
    const ce = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return anchorSpy;
      return origCreate(tag);
    }) as any);
    // jsdom не имеет createObjectURL — назначаем напрямую
    (URL as any).createObjectURL = () => 'blob:fake';
    const revokeSpy = vi.fn();
    (URL as any).revokeObjectURL = revokeSpy;
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchorSpy as unknown as Node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchorSpy as unknown as Node);
    const ok = downloadCoachExport('<p>x</p>', 'coach.html');
    expect(ok).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
    expect(anchorSpy.download).toBe('coach.html');
    expect(revokeSpy).not.toHaveBeenCalled(); // revoke отложен на 2с
    ce.mockRestore(); appendSpy.mockRestore(); removeSpy.mockRestore();
    delete (URL as any).createObjectURL; delete (URL as any).revokeObjectURL;
  });
});
