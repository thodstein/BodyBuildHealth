import { describe, expect, it } from 'vitest';
import { parseLabResults } from '../biomarker-regex-engine';
import { parseLabText } from '../pdf-parser.engine';
import { normalizeLabMeasurement, resolveLabMarker, normalizedRatio } from '../../core/labs-mapping';
import { parseLabReference, parseLabText as parseProviderText } from '../../core/lab-auto-parser';

describe('Russian laboratory OCR parsing', () => {
  const text = `ИНВИТРО
АЛТ 35 Е/л 0-41
АСТ 28 Е/л 0-40
Креатинин 92 мкмоль/л 62-106
Гематокрит 49,2 % 40-52`;

  it('parses common laboratory reference bound formats', () => {
    expect(parseLabReference('0-41')).toMatchObject({ low: 0, high: 41 });
    expect(parseLabReference('<41')).toMatchObject({ high: 41 });
    expect(parseLabReference('>1.0')).toMatchObject({ low: 1 });
    expect(parseLabReference('от 0 до 5.5')).toMatchObject({ low: 0, high: 5.5 });
  });

  it('prefers a duplicate row that contains laboratory references', () => {
    const result = parseProviderText('Глюкоза 5,4 ммоль/л\nГлюкоза 5,4 ммоль/л 3,9-5,5');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ value: 5.4, refLow: 3.9, refHigh: 5.5 });
  });

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

  it('canonicalizes duplicate marker aliases to one result', () => {
    const result = parseLabText('Креатинин 92 мкмоль/л 62-106\nCREA 92 umol/L 62-106');
    expect(result.values.filter(v => v.code === 'CREAT').length).toBe(1);
  });

  it('prefers a structured table value with a reference range', () => {
    const result = parseLabText('Глюкоза\t5,4\t3,9-5,5\tммоль/л');
    const glucose = result.values.find(v => v.code === 'GLU');
    expect(glucose).toMatchObject({ value: 5.4, refLow: 3.9, refHigh: 5.5 });
  });

  it('keeps one value when parser candidates disagree', () => {
    const result = parseLabText('Глюкоза\t5,4\t3,9-5,5\tммоль/л');
    expect(result.values.filter(v => v.code === 'GLU')).toHaveLength(1);
  });

  it('keeps the structured result when OCR adds the same marker', () => {
    const result = parseLabText('Креатинин\t92\t62-106\tмкмоль/л\nКреатинин 92 мкмоль/л');
    const values = result.values.filter(v => v.code === 'CREAT');
    expect(values).toHaveLength(1);
    expect(values[0].refHigh).toBe(106);
  });

  it('resolves mixed Cyrillic and Latin OCR abbreviations canonically', () => {
    expect(resolveLabMarker('АLT')).toBe('ALT');
    expect(resolveLabMarker('ТТG')).toBe('TSH');
    expect(resolveLabMarker('HСТ')).toBe('HCT');
  });

  it('uses the selected candidate unit for normalization', () => {
    const result = parseLabText('Креатинин\t1\t0,6-1,2\tмг/дл');
    const creatinine = result.values.find(v => v.code === 'CREAT');
    expect(creatinine?.unit).toBe('мг/дл');
    expect(normalizeLabMeasurement('CREATININE', creatinine!.value, creatinine!.unit).value).toBe(88.42);
  });

  it('normalizes reference limits with the selected value unit', () => {
    const result = parseLabText('Креатинин\t1\t0,6-1,2\tмг/дл');
    const creatinine = result.values.find(v => v.code === 'CREAT');
    expect(creatinine?.refLow).toBe(0.6);
    expect(creatinine?.refHigh).toBe(1.2);
    expect(creatinine?.isAbnormal).toBe(false);
  });

  it('keeps the most informative duplicate row', () => {
    const result = parseLabText('АЛТ 35 Е/л 0-41\nАЛТ 35');
    const alt = result.values.find(v => v.code === 'ALT');
    expect(result.values.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(alt).toMatchObject({ value: 35, refLow: 0, refHigh: 41 });
  });

  it('does not use digits from a marker name as the result', () => {
    const result = parseLabText('25(OH)D\t32\t30-100\tнг/мл\nТ3 свободный\t4,8\t3,1-6,8\tпмоль/л');
    expect(result.values.find(v => v.code === 'VITD')?.value).toBe(32);
    expect(result.values.find(v => v.code === 'FT3')?.value).toBe(4.8);
  });

  it('applies the same numeric OCR correction in the fallback parser', () => {
    const result = parseLabResults('Глюкоза 5,O ммоль/л 3,9-5,5', 'tesseract.js');
    expect(result.extractedMarkers.find(v => v.code === 'Glucose')?.value).toBe(5);
  });

  it('normalizes split Russian units in the fallback parser', () => {
    const result = parseLabResults('Креатинин 92 мк моль / л 62-106', 'tesseract.js');
    const creatinine = result.extractedMarkers.find(v => v.code === 'Creatinine');
    expect(creatinine?.value).toBe(92);
  });

  it('normalizes units split by OCR spaces', () => {
    const result = parseLabText('Креатинин\t1\t0,6-1,2\tмк моль / л');
    const creatinine = result.values.find(v => v.code === 'CREAT');
    expect(creatinine?.unit).toBe('мкмоль/л');
    expect(normalizeLabMeasurement('CREATININE', 1, creatinine!.unit).unit).toBe('umol/L');
  });

  it('rejects empty and non-finite candidates before display', () => {
    expect(parseLabText('АЛТ NaN Е/л').values).toHaveLength(0);
    expect(parseLabText('АЛТ 35 Е/л').values[0].value).toBe(35);
  });

  it('parses common lipid and cardiac markers from Russian forms', () => {
    const result = parseLabText(`ЛПОНП 1,8 ммоль/л 0,3-2,6
Амилаза 68 Е/л 25-100
Липаза 32 Е/л 10-60
MPV 10,5 фл 7-12`);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['VLDL', 'AMY', 'LIP', 'MPV']));
    expect(result.values.find(v => v.code === 'VLDL')?.value).toBe(1.8);
    expect(result.values.find(v => v.code === 'AMY')?.value).toBe(68);
    expect(result.values.find(v => v.code === 'LIP')?.value).toBe(32);
    expect(result.values.find(v => v.code === 'MPV')?.value).toBe(10.5);
  });

  it('parses endocrine and antibody markers from Russian forms', () => {
    const result = parseLabText(`АКТГ 28 пг/мл 7-46
17-ОН-прогестерон 4,5 нмоль/л 1-6
Альдостерон 185 пг/мл 30-300
АТ к ТПО 18 МЕ/мл 0-34
АТ к тиреоглобулину 45 МЕ/мл 0-115`);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['ACTH', 'OH17P', 'ALD', 'TPO_AB', 'TG_AB']));
    expect(result.values.find(v => v.code === 'ACTH')?.value).toBe(28);
    expect(result.values.find(v => v.code === 'TPO_AB')?.value).toBe(18);
  });

  it('parses diabetes and vitamin markers from Russian forms', () => {
    const result = parseLabText(`Проинсулин 1,8 пмоль/л 3-10
Фруктозамин 265 мкмоль/л 205-285
Витамин E 28 мкмоль/л 12-35
Витамин B6 85 нмоль/л 35-180`);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['PROINSULIN', 'FRUCTOSAMINE', 'VITAMIN_E', 'VITAMIN_B6']));
    expect(result.values.find(v => v.code === 'PROINSULIN')?.value).toBe(1.8);
    expect(result.values.find(v => v.code === 'FRUCTOSAMINE')?.value).toBe(265);
    expect(result.values.find(v => v.code === 'VITAMIN_B6')?.value).toBe(85);
  });

  it('handles provider-specific headers without breaking table parsing', () => {
    const gemotest = parseLabText(`ГЕМОТЕСТ
Наименование\tРезультат\tРеференс\tЕд.
АЛТ\t35\t7-40\tЕ/л
Глюкоза\t5,4\t3,9-5,5\tммоль/л`);
    expect(gemotest.values.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'GLU']));

    const helix = parseLabText(`Хеликс
Показатель\tРезультат\tРеференс\tЕдиницы
Креатинин\t92\t62-106\tмкмоль/л
ТТГ\t2,1\t0,4-4,0\tмЕд/л`);
    expect(helix.values.map(v => v.code)).toEqual(expect.arrayContaining(['CREAT', 'TSH']));

    const kdl = parseLabText(`КДЛ
Тест\tЗначение\tНорма\tЕд.
Гемоглобин\t145\t130-170\tг/л
Лейкоциты\t6,8\t4,0-9,0\t10^9/л`);
    expect(kdl.values.map(v => v.code)).toEqual(expect.arrayContaining(['HGB', 'WBC']));
  });

  it('replaces an incomplete provider candidate with a richer generic candidate', () => {
    const result = parseLabText('ИНВИТРО\nГлюкоза 5,4 ммоль/л 3,9-5,5');
    expect(result.values.find(v => v.code === 'GLU')).toMatchObject({ value: 5.4, refLow: 3.9, refHigh: 5.5 });
  });

  it('parses non-numeric reference markers like < and > bounds', () => {
    const result = parseLabText('D-димер < 0,5 мкг/л\nБилирубин прямой < 5 мкмоль/л');
    // Longest-match: "Билирубин прямой" → BILD (билирубин прямой), не BIL (общий)
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['DIMER', 'BILD']));
    expect(result.values.find(v => v.code === 'DIMER')?.value).toBe(0.5);
    expect(result.values.find(v => v.code === 'BILD')?.value).toBe(5);
  });

  it('ignores repeated provider headers across multi-page OCR', () => {
    const text = `ИНВИТРО
Наименование\tРезультат\tРеференс\tЕдиницы
АЛТ\t35\t7-40\tЕ/л
ИНВИТРО
Наименование\tРезультат\tРеференс\tЕдиницы
Креатинин\t92\t62-106\tмкмоль/л`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'CREAT']));
    expect(result.values.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(result.values.filter(v => v.code === 'CREAT')).toHaveLength(1);
  });

  it('deduplicates repeated marker variants in parseLabResults', () => {
    const result = parseLabResults(`АЛТ 35 Е/л 0-41
АЛТ 35 Е/л 0-41
ТТГ 2,1 мЕд/л 0,4-4,0
Гематокрит 49,2 % 40-52`, 'tesseract.js');
    const codes = result.extractedMarkers.map(v => v.code);
    expect(codes).toEqual(expect.arrayContaining(['ALT', 'TSH', 'Hematocrit']));
    expect(result.extractedMarkers.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(result.extractedMarkers.filter(v => v.code === 'TSH')).toHaveLength(1);
    expect(result.extractedMarkers.filter(v => v.code === 'Hematocrit')).toHaveLength(1);
  });

  it('resolvesLabMarker handles mixed Cyrillic/Latin OCR abbreviations', () => {
    expect(resolveLabMarker('АLT')).toBe('ALT');
    expect(resolveLabMarker('ТТG')).toBe('TSH');
    expect(resolveLabMarker('HСТ')).toBe('HCT');
    expect(resolveLabMarker('АСТ')).toBe('AST');
    expect(resolveLabMarker('Креатин')).toBe('CREATININE');
  });

  it('parses values with comma decimal and dot-separated reference ranges', () => {
    const result = parseLabText('Т4 свободный\t12,5\t10,0-19,0\tпмоль/л');
    const ft4 = result.values.find(v => v.code === 'FT4');
    expect(ft4?.value).toBe(12.5);
    expect(ft4?.refLow).toBe(10);
    expect(ft4?.refHigh).toBe(19);
  });

  it('normalizes fractional hematocrit and alternate hormone units', () => {
    expect(normalizeLabMeasurement('HCT', 0.45, '%').value).toBe(45);
    expect(normalizeLabMeasurement('TT', 18, 'нмоль/л').value).toBe(519.1);
  });

  it('keeps parsing after a corrupted/empty line', () => {
    const result = parseLabText('АЛТ 35 Е/л 0-41\n\nКреатинин 92 мкмоль/л 62-106\n   \nГлюкоза 5,4 ммоль/л 3,9-5,5');
    expect(result.values.map(v => v.code)).toEqual(expect.arrayContaining(['ALT', 'CREAT', 'GLU']));
  });

  it('computes confidence scores for parsed candidates', () => {
    const result = parseLabText('Глюкоза\t5,4\t3,9-5,5\tммоль/л');
    const glucose = result.values.find(v => v.code === 'GLU');
    expect(glucose?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('computes confidence scores in the fallback OCR parser', () => {
    const result = parseLabResults('АЛТ 35 Е/л 0-41', 'tesseract.js');
    const alt = result.extractedMarkers.find(v => v.code === 'ALT');
    expect(alt?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('applies age/sex-aware reference ranges in normalizedRatio', () => {
    const maleRatio = normalizedRatio('HCT', 49, '%', 30, 'male');
    const femaleRatio = normalizedRatio('HCT', 49, '%', 30, 'female');
    expect(maleRatio).not.toBeNull();
    expect(femaleRatio).not.toBeNull();
    if (maleRatio !== null && femaleRatio !== null) {
      expect(femaleRatio).toBeGreaterThan(maleRatio);
    }
  });

  it('preserves static ratio behavior when age/sex are omitted', () => {
    const staticRatio = normalizedRatio('HCT', 49, '%');
    const explicitNeutral = normalizedRatio('HCT', 49, '%', undefined, undefined);
    expect(staticRatio).toBe(explicitNeutral);
  });

  it('parses a realistic multi-page Invitro + Gemotest mixed form', () => {
    const text = `ИНВИТРО
Наименование\tРезультат\tРеференс\tЕдиницы
АЛТ\t35\t7-40\tЕ/л
Глюкоза\t5,4\t3,9-5,5\tммоль/л
Креатинин\t92\t62-106\tмкмоль/л
ГЕМОТЕСТ
Тест\tЗначение\tНорма\tЕд.
ТТГ\t2,1\t0,4-4,0\tмЕд/л
Эстрадиол\t28\t10-40\tпг/мл
Прогестерон\t0,8\t0,1-1,2\tнг/мл
ИНВИТРО
Наименование\tРезультат\tРеференс\tЕдиницы
Гемоглобин\t145\t130-170\tг/л
Лейкоциты\t6,8\t4,0-9,0\t10^9/л`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'GLU', 'CREAT', 'TSH', 'ESTR', 'PROG', 'HGB', 'WBC'])
    );
    expect(result.values.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(result.values.filter(v => v.code === 'TSH')).toHaveLength(1);
    expect(result.values.filter(v => v.code === 'ESTR')).toHaveLength(1);
  });

  it('recovers markers from heavily corrupted OCR text', () => {
    const text = `AЛT  35  Е/л   0-41
AСТ  28  U/L  0-40
Глюкоза  5,4  ммоль/л  3,9-5,5
Креатин  92  мкмоль/л  62-106
ТТГ  2,1  мЕд/л  0,4-4,0`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['GLU', 'CREAT', 'TSH'])
    );
    expect(result.values.find(v => v.code === 'GLU')?.value).toBe(5.4);
    expect(result.values.find(v => v.code === 'CREAT')?.value).toBe(92);
    expect(result.values.find(v => v.code === 'TSH')?.value).toBe(2.1);
  });

  it('handles split unit tokens and merged cells from bad PDF extraction', () => {
    const text = `АЛТ 35 Е / л 0-41
Глюкоза 5,4 мм оль / л 3,9-5,5
Креатинин 92 мк моль / л 62-106`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'GLU', 'CREAT'])
    );
    expect(result.values.find(v => v.code === 'GLU')?.unit).toBe('ммоль/л');
    expect(result.values.find(v => v.code === 'CREAT')?.unit).toBe('мкмоль/л');
  });

  it('extracts markers from tab-separated columns with provider headers', () => {
    const text = `ГЕМОТЕСТ
Наименование\tРезультат\tРеференс\tЕд.
АЛТ\t35\t7-40\tЕ/л
Гемоглобин\t145\t130-170\tг/л
Тромбоциты\t210\t150-400\t10^9/л`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'HGB', 'PLT'])
    );
    expect(result.values.find(v => v.code === 'PLT')?.value).toBe(210);
  });

  it('ignores page numbers and footers while preserving valid data rows', () => {
    const text = `ИНВИТРО
Страница 1 из 2
АЛТ 35 Е/л 0-41
Страница 2 из 2
Глюкоза 5,4 ммоль/л 3,9-5,5`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'GLU'])
    );
  });

  it('parses a realistic Gemotest panel with mixed row formats', () => {
    const text = `ГЕМОТЕСТ
Дата: 15.03.2024
Пациент: Иванов И.И.

Биохимия
Глюкоза\t5,4\t3,9-5,5\tммоль/л
Креатинин\t92\t62-106\tмкмоль/л
Мочевина\t5,2\t2,5-7,1\tммоль/л
Мочевая кислота\t320\t200-420\tмкмоль/л

Липиды
Холестерин общий\t5,2\t<5,2\tммоль/л
ЛПВП\t1,1\t>1,0\tммоль/л
ЛПНП\t3,1\t<3,0\tммоль/л
Триглицериды\t1,4\t<1,7\tммоль/л`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['GLU', 'CREAT', 'UREA', 'URIC', 'CHOL', 'HDL', 'LDL', 'TG'])
    );
    const chol = result.values.find(v => v.code === 'CHOL');
    expect(chol).toBeDefined();
    expect(chol?.value).toBe(5.2);
  });

  it('handles Helix-style free-text rows without strict table formatting', () => {
    const text = `Хеликс
Результаты анализов
АЛТ — 35 Е/л (норма 0-40)
Глюкоза — 5,4 ммоль/л (3,9-5,5)
Креатинин — 92 мкмоль/л (62-106)
ТТГ — 2,1 мЕд/л (0,4-4,0)`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'GLU', 'CREAT', 'TSH'])
    );
    expect(result.values.find(v => v.code === 'ALT')?.value).toBe(35);
    expect(result.values.find(v => v.code === 'GLU')?.refHigh).toBe(5.5);
  });

  it('normalizes values with mixed comma/dot decimals across providers', () => {
    const text = `Глюкоза 5,4 ммоль/л 3,9-5,5
Т4 свободный 12,5 пмоль/л 10,0-19,0
Калий 4,5 ммоль/л 3,5-5,1
Гематокрит 49,2 % 40-52`;

    const result = parseLabText(text);
    expect(result.values.find(v => v.code === 'GLU')?.value).toBe(5.4);
    expect(result.values.find(v => v.code === 'FT4')?.value).toBe(12.5);
    expect(result.values.find(v => v.code === 'K')?.value).toBe(4.5);
    expect(result.values.find(v => v.code === 'HCT')?.value).toBe(49.2);
  });

  it('extracts numeric values from OCR-mangled lines with extra symbols', () => {
    const text = `АЛТ 35,0 Е/л [0-40]
Глюкоза 5.40 ммоль/л 3.90-5.50
Креатинин 92,00 мкмоль/л 62-106`;

    const result = parseLabText(text);
    expect(result.values.find(v => v.code === 'ALT')?.value).toBe(35);
    expect(result.values.find(v => v.code === 'GLU')?.value).toBe(5.4);
    expect(result.values.find(v => v.code === 'CREAT')?.value).toBe(92);
  });

  it('parses KDL-style abbreviated marker names', () => {
    const text = `КДЛ
Биохимия
ОБЩ БЕЛОК\t72\t65-85\tг/л
АЛЬБУМИН\t42\t35-50\tг/л
ХОЛЕСТЕРИН\t5,2\t<5,2\tммоль/л
ГЛЮКОЗА\t5,4\t3,9-5,5\tммоль/л`;

    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toEqual(
      expect.arrayContaining(['TP', 'ALB', 'CHOL', 'GLU'])
    );
  });
});
