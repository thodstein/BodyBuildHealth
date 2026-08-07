import { describe, expect, it } from 'vitest';
import { parseLabResults } from '../biomarker-regex-engine';
import { parseLabText } from '../pdf-parser.engine';
import { normalizeLabMeasurement } from '../../core/labs-mapping';

describe('Russian laboratory OCR parsing', () => {
  const text = `ИНВИТРО
АЛТ 35 Е/л 0-41
АСТ 28 Е/л 0-40
Креатинин 92 мкмоль/л 62-106
Гематокрит 49,2 % 40-52`;

  it('parses Russian provider rows with decimal comma', () => {
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'AST', 'CREAT', 'HCT']));
    expect(result.values.find(v => v.code === 'HCT')?.value).toBe(49.2);
  });

  it('recognizes Russian markers in the enhanced fallback parser', () => {
    const result = parseLabResults(text, 'tesseract.js');
    expect(result.extractedMarkers.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'AST', 'Creatinine', 'Hematocrit']));
  });

  it('handles OCR split across adjacent lines', () => {
    const result = parseLabText('Гемоглобин\n145 г/л\nТТГ\n2,1 мЕд/л');
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['HGB', 'TSH']));
  });

  it('converts explicit source units without guessing from the value', () => {
    expect(normalizeLabMeasurement('CREATININE', 1, 'мг/дл')).toEqual({ value: 88.42, unit: 'umol/L' });
    expect(normalizeLabMeasurement('CREATININE', 92, 'мкмоль/л')).toEqual({ value: 92, unit: 'umol/L' });
    expect(normalizeLabMeasurement('E2', 110, 'пмоль/л')).toEqual({ value: 29.965, unit: 'pg/mL' });
    expect(normalizeLabMeasurement('GLU', 100, 'мг/дл')).toEqual({ value: 5.55, unit: 'mmol/L' });
  });

  it('does not apply a coefficient to a spelling-only unit difference', () => {
    expect(normalizeLabMeasurement('HGB', 145, 'г/л')).toEqual({ value: 145, unit: 'g/L' });
    expect(normalizeLabMeasurement('ALT', 35, 'Е/л')).toEqual({ value: 35, unit: 'U/L' });
  });

  it('keeps parsing rows after a provider-specific row was recognized', () => {
    const result = parseLabText(`ИНВИТРО
Наименование Результат Референс Единицы
АЛТ 35 0-41 Е/л
Глюкоза: 5,4 ммоль/л 3,9-5,5
ТТГ
2,1 мЕд/л`);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'GLU', 'TSH']));
    expect(result.values.find(v => v.code === 'GLU')?.value).toBe(5.4);
  });

  it('does not treat short markers as substrings of unrelated words', () => {
    const result = parseLabText('Калий 4,5 ммоль/л 3,5-5,1\nКреатинин 90 мкмоль/л 62-106');
    expect(result.values.filter(v => v.code === 'K')).toHaveLength(1);
    expect(result.values.filter(v => v.code === 'CREAT')).toHaveLength(1);
  });

  it('takes the result column, not the reference range', () => {
    const result = parseLabText('Глюкоза 5,4 ммоль/л 3,9 - 5,5');
    const glucose = result.values.find(v => v.code === 'GLU');
    expect(glucose?.value).toBe(5.4);
    expect(glucose?.refLow).toBe(3.9);
    expect(glucose?.refHigh).toBe(5.5);
  });

  it('repairs a zero misread as Cyrillic O in a numeric cell', () => {
    const result = parseLabText('Глюкоза 5,O ммоль/л 3,9-5,5');
    expect(result.values.find(v => v.code === 'GLU')?.value).toBe(5);
  });

  it('extracts units placed in a separate table column', () => {
    const result = parseLabText('Глюкоза\t5,4\t3,9-5,5\tммоль/л');
    const glucose = result.values.find(v => v.code === 'GLU');
    expect(glucose?.value).toBe(5.4);
    expect(glucose?.unit).toBe('ммоль/л');
    expect(normalizeLabMeasurement('GLU', glucose!.value, glucose!.unit)).toEqual({ value: 5.4, unit: 'mmol/L' });
  });

  it('preserves PDF columns when a provider header and tabs are present', () => {
    const result = parseLabText([
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'Креатинин\t92\t62-106\tмкмоль/л',
      'Глюкоза\t100\t70-99\tмг/дл',
    ].join('\n'));
    const creatinine = result.values.find(v => v.code === 'CREAT');
    expect(creatinine?.value).toBe(92);
    expect(creatinine?.refLow).toBe(62);
    expect(creatinine?.refHigh).toBe(106);
    expect(creatinine?.unit).toBe('мкмоль/л');
  });
});
