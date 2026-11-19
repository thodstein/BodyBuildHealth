/**
 * lab-value-html.test.ts — проход 143: знак границы в HTML-поверхностях.
 *
 * `labValueLabel` печатает «<0.5» — правильно для текста и React. Но отчёт,
 * PDF и недельная сводка собирают HTML строкой, и там «<» — начало тега:
 * ячейка «СРБ <0.5 мг/л» обрывалась на «<0.5» (браузер искал тег), а «>»
 * переживал молча и выглядел случайным. Теперь у HTML-поверхностей своя
 * функция: тот же текст, но знак — сущностью.
 */
import { describe, it, expect } from 'vitest';
import { labValueLabel, labValueLabelHtml } from '../lab-value-label';

describe('проход 143: значение для HTML', () => {
  it('«<» печатается сущностью, а не тегом', () => {
    expect(labValueLabelHtml(0.5, '<')).toBe('&lt;0.5');
    expect(labValueLabelHtml(0.5, '<').startsWith('<')).toBe(false);
  });

  it('«>» тоже сущностью — чтобы правило было одно', () => {
    expect(labValueLabelHtml(1000, '>')).toBe('&gt;1000');
  });

  it('число без границы печатается как есть', () => {
    expect(labValueLabelHtml(30)).toBe('30');
    expect(labValueLabelHtml('Нет данных')).toBe('Нет данных');
  });

  it('пустое значение — «—», даже если знак есть', () => {
    expect(labValueLabelHtml(undefined, '>')).toBe('—');
    expect(labValueLabelHtml(null, '<')).toBe('—');
    expect(labValueLabelHtml('', '<')).toBe('—');
  });

  it('текстовая версия не изменилась — React-поверхности не задваивают знак', () => {
    expect(labValueLabel(0.5, '<')).toBe('<0.5');
    expect(labValueLabel(1000, '>')).toBe('>1000');
    expect(labValueLabel(30)).toBe('30');
  });
});
