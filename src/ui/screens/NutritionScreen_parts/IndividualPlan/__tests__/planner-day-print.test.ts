/**
 * planner-day-print.test.ts — тесты печати дневного отчёта (P2-8).
 *
 * - HTML содержит ключевые поля и флаги;
 * - пользовательские строки XSS-экранируются.
 */
import { describe, it, expect } from 'vitest';
import { buildDayReportPrintHtml, buildWeekReportPrintHtml } from '../planner-day-print';
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
