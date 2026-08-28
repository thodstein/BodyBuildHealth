import { describe, it, expect } from 'vitest';
import { buildStrengthReportText, buildStrengthPrintHtml } from '../strength-export.engine';

const base = {
  sex: 'male' as const,
  bw: 83,
  squat: 180,
  bench: 120,
  dead: 220,
  ohp: 60,
  total: 520,
  dots: 388,
  wilks: 352,
  ipfgl: 78,
  relative: 6.27,
  levelLabel: 'Средний',
  lifts: {
    squat: { rs: 2.17, label: 'Средний' },
    bench: { rs: 1.45, label: 'Опытный' },
    deadlift: { rs: 2.65, label: 'Средний' },
  },
};

describe('strength-export', () => {
  it('buildStrengthReportText содержит ключевые поля', () => {
    const t = buildStrengthReportText(base);
    expect(t).toContain('83');
    expect(t).toContain('520');
    expect(t).toContain('388');
    expect(t).toContain('78');
    expect(t).toContain('6.27');
  });

  it('buildStrengthPrintHtml XSS-safe', () => {
    const evil = { ...base, levelLabel: '<script>alert(1)</script>' as any };
    const html = buildStrengthPrintHtml(evil as any);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('buildStrengthPrintHtml содержит таблицу и бейджи', () => {
    const html = buildStrengthPrintHtml(base);
    expect(html).toContain('Присед');
    expect(html).toContain('180');
    expect(html).toContain('DOTS');
    expect(html).toContain('IPF GL');
  });
});
