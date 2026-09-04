/**
 * planner-day-print.test.ts — тесты печати дневного отчёта (P2-8).
 *
 * - HTML содержит ключевые поля и флаги;
 * - пользовательские строки XSS-экранируются.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildDayReportPrintHtml, buildWeekReportPrintHtml, printDayReport, printMealTimeline, buildMealTimelinePrintHtml, buildCoachExportHtml, buildRecipePlanPrintHtml } from '../planner-day-print';
import { analyzeDailyDiet, getDefaultProfile } from '../../../../../engines/product-usefulness-v2.engine';

describe('buildDayReportPrintHtml (P2-8)', () => {
  it('содержит дату, калории и флаги', () => {
    const p = getDefaultProfile();
    const r = analyzeDailyDiet([{ products: [{ foodId: 'chicken_breast', weightGrams: 200 }] }], p);
    const html = buildDayReportPrintHtml(r);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Дневной отчёт питания');
    expect(html).toContain('DIAAS');
    expect(html).toContain('HOMA-IR');
    expect(html).toContain('Калорийность');
    expect(html).toContain('ккал');
  });

  it('XSS-экранирует пользовательские строки (warning/deficit)', () => {
    const p = getDefaultProfile();
    const r = analyzeDailyDiet([{ products: [{ foodId: 'chicken_breast', weightGrams: 200 }] }], p);
    const html = buildDayReportPrintHtml(r);
    // предупреждения/дефициты содержат только безопасные подстановки; никакой инъекции
    expect(html).not.toContain('<script>');
  });
});

describe('buildWeekReportPrintHtml (доп. 12)', () => {
  it('пустая неделя → заголовок, без таблицы, без NaN', () => {
    const html = buildWeekReportPrintHtml([]);
    expect(html).toContain('Недельный отчёт питания');
    expect(html).toContain('Нет данных');
  });

  it('неделя из дней → таблица со строками и средними', () => {
    const p = getDefaultProfile();
    const days = ['2026-08-10', '2026-08-11', '2026-08-12'].map(date => ({
      date,
      report: analyzeDailyDiet([{ products: [{ foodId: 'chicken_breast', weightGrams: 200 }] }], p),
    }));
    const html = buildWeekReportPrintHtml(days);
    expect(html).toContain('Дней:');
    expect(html).toContain('2026-08-10');
    expect(html).toContain('</table>');
    expect(html).toContain('Средние');
  });
});

describe('printDayReport / printMealTimeline (D-28 П8: окно печати)', () => {
  it('printDayReport пишет HTML при доступном window.open (print — отложенный, guarded)', () => {
    const written: string[] = [];
    const fakeWin: any = {
      document: { write: (h: string) => written.push(h), close: () => {}, focus: () => {} },
      print: () => {},
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as any);
    expect(() => printDayReport('<p>test</p>')).not.toThrow();
    expect(openSpy).toHaveBeenCalled();
    expect(written[0]).toContain('<p>test</p>');
    openSpy.mockRestore();
  });

  it('printDayReport не падает, когда window.open недоступен (jsdom)', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null as any);
    expect(() => printDayReport('<p>x</p>')).not.toThrow();
    openSpy.mockRestore();
  });

  it('printMealTimeline открывает окно и не падает', () => {
    const fakeWin: any = {
      document: { write: () => {}, close: () => {}, focus: () => {} },
      print: () => {},
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as any);
    expect(() => printMealTimeline(buildMealTimelinePrintHtml([{ time: '08:00', label: 'Завтрак', items: [{ name: 'Яйцо', amount: 100, kcal: 150 }] }], { title: 'День' }))).not.toThrow();
    openSpy.mockRestore();
  });
});

describe('§6.2: бейдж режима веса в печати (сух/гот)', () => {
  const coachArgs = (weightMode?: any) => ({
    dateIso: '2026-09-04',
    totals: { kcal: 3000, p: 200, f: 80, c: 350 },
    meals: [{ time: '08:00', label: 'Завтрак', items: [{ name: 'Рис белый (вареный)', id: 'rice_white', amount: 200 }], totals: { kcal: 260, p: 5, f: 1, c: 56 } }],
    shopping: [],
    ...(weightMode ? { weightMode } : {}),
  });

  it('coach-экспорт по умолчанию — «как на тарелке (гот.)»', () => {
    const html = buildCoachExportHtml(coachArgs() as any);
    expect(html).toContain('как на тарелке (гот.)');
  });

  it('raw-режим — бейдж «сырой (сух.)» + крупа сухим весом', () => {
    const html = buildCoachExportHtml(coachArgs('raw') as any);
    expect(html).toContain('сырой (сух.)');
    // 200 г варёного риса → ~71 г сухого
    expect(html).toContain('сух.');
    expect(html).not.toContain('200г,');
  });

  it('меню с рецептами несёт бейдж в обоих режимах', () => {
    const day = { meals: [], totals: { kcal: 0, p: 0, f: 0, c: 0 } };
    expect(buildRecipePlanPrintHtml(day)).toContain('как на тарелке (гот.)');
    expect(buildRecipePlanPrintHtml(day, 'raw')).toContain('сырой (сух.)');
  });

  it('таймлайн: бейдж + конвертация по id', () => {
    const meals = [{ time: '08:00', label: 'Завтрак', type: 'breakfast', items: [{ name: 'Рис', id: 'rice_white', amount: 200 }], totals: { kcal: 260, p: 5, f: 1, c: 56 } }];
    const html = buildMealTimelinePrintHtml(meals as any, { title: 'День', weightMode: 'raw' });
    expect(html).toContain('сырой (сух.)');
    expect(html).toContain('сух.');
  });
});
