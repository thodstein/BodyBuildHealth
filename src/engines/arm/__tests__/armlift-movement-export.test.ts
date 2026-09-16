import { describe, it, expect } from 'vitest';
import {
  buildArmliftingReport,
  buildArmliftingHtml,
  buildArmliftingCsv,
} from '../armlifting-diagnostics.engine';

const base = () => ({
  date: '2026-09-16',
  sex: 'М',
  report: buildArmliftingReport({ rtKg: 100, sex: 'male' }),
});

describe('PRO-6 M9: движение в экспорте', () => {
  it('без diagExtra — блока Движение нет (байт-в-байт)', () => {
    expect(buildArmliftingHtml(base())).not.toContain('Движение:');
    expect(buildArmliftingCsv(base())).not.toContain('movement;');
  });
  it('diagExtra — HTML + CSV строки', () => {
    const data = { ...base(), diagExtra: ['Фаза срыва: Протяжка', 'Рука: скидок нет'] };
    expect(buildArmliftingHtml(data)).toContain('Движение:');
    expect(buildArmliftingHtml(data)).toContain('Фаза срыва');
    expect(buildArmliftingCsv(data)).toContain('movement;');
  });
  it('XSS в diagExtra экранируется', () => {
    const data = { ...base(), diagExtra: ['<script>alert(1)</script>'] };
    expect(buildArmliftingHtml(data)).toContain('&lt;script&gt;');
    expect(buildArmliftingHtml(data)).not.toContain('<script>alert');
  });
});
