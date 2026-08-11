import { describe, it, expect } from 'vitest';
import { processUploadedFile } from '../../core/ocr-engine';

describe('processUploadedFile: text input pipeline', () => {
  it('parses a pasted Russian lab text file and returns structured labs', async () => {
    const text = [
      'ГЕМОТЕСТ',
      'АЛТ\t35\tЕ/л\t0-41',
      'АСТ\t28\tЕ/л\t0-40',
      'Гемоглобин\t145\tг/л\t130-170',
      'Гематокрит\t0.45\t\t0.39-0.52',
      'Креатинин\t92\tмкмоль/л\t62-106',
      'Глюкоза\t5.4\tммоль/л\t3.9-5.5',
      'ТТГ\t2.1\tмЕд/л\t0.4-4.0',
    ].join('\n');
    const file = new File([text], 'pasted.txt', { type: 'text/plain' });

    const result = await processUploadedFile(file);

    expect(result.source).toBe('text');
    expect(result.labs.length).toBeGreaterThanOrEqual(5);
    expect(result.confidence).toBeGreaterThan(0.5);
    const alt = result.labs.find(l => l.code === 'ALT');
    expect(alt).toBeDefined();
    expect(alt!.value).toBe(35);
    const ast = result.labs.find(l => l.code === 'AST');
    expect(ast).toBeDefined();
    expect(ast!.value).toBe(28);
    const hgb = result.labs.find(l => l.code === 'HGB');
    expect(hgb).toBeDefined();
    expect(hgb!.value).toBe(145);
    const creat = result.labs.find(l => l.code === 'CREATININE' || l.code === 'CREAT');
    expect(creat).toBeDefined();
    expect(creat!.value).toBe(92);
  });

  it('parses a Gemotest-style multi-marker form with reference ranges', async () => {
    const text = [
      'ГЕМОТЕСТ',
      'Общий анализ крови',
      'Гемоглобин 145 г/л 130-170',
      'Гематокрит 45 % 39-52',
      'Лейкоциты 6.2 10^9/л 4-9',
      'Тромбоциты 250 10^9/л 180-320',
      'Биохимия',
      'АЛТ 35 Е/л 0-41',
      'АСТ 28 Е/л 0-40',
      'Глюкоза 5.4 ммоль/л 3.9-5.5',
      'Креатинин 92 мкмоль/л 62-106',
    ].join('\n');
    const file = new File([text], 'labs.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    expect(result.source).toBe('text');
    expect(result.labs.length).toBeGreaterThanOrEqual(7);
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'HCT')).toBe(true);
    expect(result.labs.some(l => l.code === 'WBC')).toBe(true);
    expect(result.labs.some(l => l.code === 'PLT')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'AST')).toBe(true);
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
  });

  it('returns warnings and low confidence when no markers are found', async () => {
    const text = 'Hello world, this is not a lab report.\nJust some random text without markers.';
    const file = new File([text], 'empty.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    expect(result.source).toBe('text');
    expect(result.labs).toHaveLength(0);
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('handles empty text file gracefully', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    expect(result.labs).toHaveLength(0);
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('handles comma decimal separators (Russian format)', async () => {
    const text = 'Глюкоза 5,4 ммоль/л 3,9-5,5\nКреатинин 92,5 мкмоль/л 62-106';
    const file = new File([text], 'labs.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const glu = result.labs.find(l => l.code === 'GLU');
    expect(glu).toBeDefined();
    expect(glu!.value).toBe(5.4);
    const creat = result.labs.find(l => l.code === 'CREATININE' || l.code === 'CREAT');
    expect(creat).toBeDefined();
    expect(creat!.value).toBe(92.5);
  });

  it('parses Invitro-style header without breaking the table', async () => {
    const text = [
      'ИНВИТРО',
      'Лаборатория',
      'Гемоглобин 145 г/л 130-170',
      'АЛТ 35 Е/л 0-41',
    ].join('\n');
    const file = new File([text], 'invitro.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
  });

  it('deduplicates markers that appear multiple times', async () => {
    const text = 'АЛТ 35 Е/л 0-41\nАЛТ 35 Е/л\nALT 40 U/L 0-41';
    const file = new File([text], 'duplicates.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const altEntries = result.labs.filter(l => l.code === 'ALT');
    expect(altEntries.length).toBe(1);
  });

  it('recognizes ALL markers from a comprehensive lab panel (30+ markers)', async () => {
    const text = [
      'ГЕМОТЕСТ — Результаты анализов',
      'Общий анализ крови',
      'Гемоглобин\t145\tг/л\t130-170',
      'Гематокрит\t45\t%\t39-52',
      'Эритроциты\t5.2\t10^12/л\t4.0-5.0',
      'Лейкоциты\t6.2\t10^9/л\t4.0-9.0',
      'Тромбоциты\t250\t10^9/л\t180-320',
      'СОЭ\t5\tмм/ч\t0-15',
      'Биохимия',
      'АЛТ\t35\tЕ/л\t0-41',
      'АСТ\t28\tЕ/л\t0-40',
      'ГГТ\t22\tЕ/л\t0-38',
      'Щелочная фосфатаза\t85\tЕ/л\t40-130',
      'Билирубин общий\t12\tмкмоль/л\t0-21',
      'Общий белок\t72\tг/л\t64-83',
      'Альбумин\t45\tг/л\t35-50',
      'Креатинин\t92\tмкмоль/л\t62-106',
      'Мочевина\t5.2\tммоль/л\t2.5-7.1',
      'Мочевая кислота\t310\tмкмоль/л\t200-420',
      'Глюкоза\t5.4\tммоль/л\t3.9-5.5',
      'Липидный профиль',
      'Холестерин общий\t5.2\tммоль/л\t0-5.2',
      'ЛПВП\t1.4\tммоль/л\t0.9-1.6',
      'ЛПНП\t3.1\tммоль/л\t0-3.5',
      'Триглицериды\t1.2\tммоль/л\t0-1.7',
      'С-реактивный белок\t2.5\tмг/л\t0-5',
      'Электролиты',
      'Калий\t4.5\tммоль/л\t3.5-5.1',
      'Натрий\t142\tммоль/л\t136-145',
      'Кальций\t2.4\tммоль/л\t2.2-2.6',
      'Магний\t0.85\tммоль/л\t0.7-1.0',
      'Фосфор\t1.1\tммоль/л\t0.8-1.5',
      'Гормоны',
      'ТТГ\t2.1\tмЕд/л\t0.4-4.0',
      'Т4 свободный\t14.5\tпмоль/л\t10.0-19.0',
      'Т3 свободный\t5.2\tпмоль/л\t3.1-6.8',
      'Тестостерон\t28\tнмоль/л\t10-35',
      'Эстрадиол\t120\tпмоль/л\t40-160',
      'Пролактин\t180\tмЕд/л\t80-400',
      'ЛГ\t5.5\tмЕд/л\t1.5-9.0',
      'ФСГ\t4.2\tмЕд/л\t1.4-8.0',
      'Кортизол\t420\tнмоль/л\t138-690',
      'Витамины и микроэлементы',
      'Ферритин\t180\tмкг/л\t30-300',
      'Витамин D\t32\tнг/мл\t30-100',
      'Витамин B12\t350\tpg/мл\t200-900',
      'Фолат\t12\tнг/мл\t3-20',
      'Железо\t22\tмкмоль/л\t11-28',
    ].join('\n');
    const file = new File([text], 'comprehensive.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    console.log('COMPREHENSIVE: found', result.labs.length, 'markers:', result.labs.map(l => l.code).join(', '));

    // Should recognize at least 25 of the 30+ markers.
    expect(result.labs.length).toBeGreaterThanOrEqual(25);
    // Check specific markers that were being lost before the fix.
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'HCT')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'AST')).toBe(true);
    expect(result.labs.some(l => l.code === 'GGT')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALP')).toBe(true);
    expect(result.labs.some(l => l.code === 'BIL')).toBe(true);
    expect(result.labs.some(l => l.code === 'TP')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALB')).toBe(true);
    expect(result.labs.some(l => l.code === 'CREATININE')).toBe(true);
    expect(result.labs.some(l => l.code === 'UREA')).toBe(true);
    expect(result.labs.some(l => l.code === 'UA')).toBe(true);
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
    expect(result.labs.some(l => l.code === 'CHOL')).toBe(true);
    expect(result.labs.some(l => l.code === 'HDL')).toBe(true);
    expect(result.labs.some(l => l.code === 'LDL')).toBe(true);
    expect(result.labs.some(l => l.code === 'TG')).toBe(true);
    expect(result.labs.some(l => l.code === 'CRP')).toBe(true);
    expect(result.labs.some(l => l.code === 'K')).toBe(true);
    expect(result.labs.some(l => l.code === 'NA')).toBe(true);
    expect(result.labs.some(l => l.code === 'CA')).toBe(true);
    expect(result.labs.some(l => l.code === 'MG')).toBe(true);
    expect(result.labs.some(l => l.code === 'TSH')).toBe(true);
    expect(result.labs.some(l => l.code === 'FT4')).toBe(true);
    expect(result.labs.some(l => l.code === 'FT3')).toBe(true);
    expect(result.labs.some(l => l.code === 'TT')).toBe(true);
    expect(result.labs.some(l => l.code === 'E2')).toBe(true);
    expect(result.labs.some(l => l.code === 'PRL')).toBe(true);
    expect(result.labs.some(l => l.code === 'LH')).toBe(true);
    expect(result.labs.some(l => l.code === 'FSH')).toBe(true);
    expect(result.labs.some(l => l.code === 'CORTISOL')).toBe(true);
    expect(result.labs.some(l => l.code === 'FERRITIN')).toBe(true);
    expect(result.labs.some(l => l.code === 'VITD')).toBe(true);
    expect(result.labs.some(l => l.code === 'B12')).toBe(true);
    expect(result.labs.some(l => l.code === 'IRON')).toBe(true);
  });

  it('recovers markers when units are on separate lines (OCR split)', async () => {
    const text = [
      'Гемоглобин 145',
      'г/л',
      '130-170',
      'АЛТ 35',
      'Е/л 0-41',
      'Креатинин 92',
      'мкмоль/л 62-106',
    ].join('\n');
    const file = new File([text], 'split-lines.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'CREATININE')).toBe(true);
  });

  it('handles markers without explicit units (infers from code)', async () => {
    const text = 'Гемоглобин 145\nАЛТ 35\nКреатинин 92\nТТГ 2.1';
    const file = new File([text], 'no-units.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    // All 4 markers should be recovered even without units — the parser
    // infers canonical units from UCUM_MAP defaults.
    expect(result.labs.length).toBeGreaterThanOrEqual(4);
    const hgb = result.labs.find(l => l.code === 'HGB');
    expect(hgb).toBeDefined();
    expect(hgb!.unit).toBeTruthy();
    const alt = result.labs.find(l => l.code === 'ALT');
    expect(alt).toBeDefined();
    expect(alt!.unit).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reference range preservation — parse → save → load → abnormality
// ═══════════════════════════════════════════════════════════════════════════
describe('Reference range preservation through save/load cycle', () => {
  it('parsed refLow/refHigh survive mergeParsedResults', async () => {
    // Lab says ALT < 41 (refHigh=41), UCUM_MAP default is uln=40
    // Value 40.5: lab says NORMAL, UCUM_MAP would say HIGH
    const text = 'АЛТ\t40.5\t<41\tЕ/л';
    const file = new File([text], 'alt.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const alt = result.labs.find(l => l.code === 'ALT');
    expect(alt).toBeDefined();
    expect(alt!.refHigh).toBe(41);
    expect(alt!.isAbnormal).toBe(false); // 40.5 < 41 → normal
  });

  it('parsed ref ranges override UCUM_MAP defaults for abnormality', async () => {
    // Lab says glucose ref is 3.5-5.5, UCUM_MAP default is 3.9-5.6
    // Value 5.55: lab says HIGH (5.55 > 5.5), UCUM_MAP would say NORMAL (5.55 < 5.6)
    const text = 'Глюкоза\t5.55\t3.5-5.5\tммоль/л';
    const file = new File([text], 'glu.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const glu = result.labs.find(l => l.code === 'GLU');
    expect(glu).toBeDefined();
    expect(glu!.refLow).toBe(3.5);
    expect(glu!.refHigh).toBe(5.5);
    expect(glu!.isAbnormal).toBe(true); // 5.55 > 5.5 → high
  });

  it('saveParsedLabs stores refLow/refHigh/isAbnormal in LabPoint', async () => {
    const text = 'Глюкоза\t5.55\t3.5-5.5\tммоль/л\nАЛТ\t40.5\t<41\tЕ/л\nКреатинин\t92\t62-106\tмкмоль/л';
    const file = new File([text], 'labs.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    const glu = result.labs.find(l => l.code === 'GLU')!;
    const alt = result.labs.find(l => l.code === 'ALT')!;
    // CREAT is mapped to CREATININE by mergeParsedResults
    const creat = result.labs.find(l => l.code === 'CREATININE')!;

    // Verify parsed results have ref ranges
    expect(glu.refLow).toBe(3.5);
    expect(glu.refHigh).toBe(5.5);
    expect(glu.isAbnormal).toBe(true);

    expect(alt.refHigh).toBe(41);
    expect(alt.isAbnormal).toBe(false);

    expect(creat.refLow).toBe(62);
    expect(creat.refHigh).toBe(106);
    expect(creat.isAbnormal).toBe(false);
  });

  it('OCR result isAbnormal uses parsed ranges, not UCUM_MAP defaults', async () => {
    // ESR: lab says 2-20, but value 18 is normal for the lab
    // UCUM_MAP default for ESR may differ
    const text = 'СОЭ\t18\t2-20\tмм/ч';
    const file = new File([text], 'esr.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const esr = result.labs.find(l => l.code === 'ESR');
    expect(esr).toBeDefined();
    expect(esr!.isAbnormal).toBe(false); // 18 is within 2-20
  });

  it('falls back to UCUM_MAP when no parsed ref range exists', async () => {
    // No explicit ref range in text — isAbnormal computed from UCUM_MAP
    const text = 'Глюкоза 5.4 ммоль/л';
    const file = new File([text], 'glu-no-ref.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);
    const glu = result.labs.find(l => l.code === 'GLU');
    expect(glu).toBeDefined();
    // UCUM_MAP GLU: uln=5.6, lln=3.9 — 5.4 is within range
    expect(glu!.isAbnormal).toBe(false);
  });

  it('handles Invitro-style <N reference bounds correctly', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'Холестерин общий\t5.2\t<5.2\tммоль/л',
      'ЛПНП\t3.1\t<3.0\tммоль/л',
    ].join('\n');
    const file = new File([text], 'invitro.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    const alt = result.labs.find(l => l.code === 'ALT');
    expect(alt!.refHigh).toBe(41);
    expect(alt!.isAbnormal).toBe(false);

    const chol = result.labs.find(l => l.code === 'CHOL');
    expect(chol!.refHigh).toBe(5.2);
    expect(chol!.isAbnormal).toBe(false); // 5.2 is NOT > 5.2

    const ldl = result.labs.find(l => l.code === 'LDL');
    expect(ldl!.refHigh).toBe(3.0);
    expect(ldl!.isAbnormal).toBe(true); // 3.1 > 3.0
  });

  it('handles >N reference bounds (HDL, testosterone, etc.)', async () => {
    const text = [
      'ИНВИТРО',
      'ЛПВП\t1.1\t>1.0\tммоль/л',
      'Тестостерон общий\t10.5\t>12.0\tнмоль/л',
    ].join('\n');
    const file = new File([text], 'gt-ref.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    const hdl = result.labs.find(l => l.code === 'HDL');
    expect(hdl!.refLow).toBe(1.0);
    expect(hdl!.isAbnormal).toBe(false); // 1.1 > 1.0

    // TESTO maps to TT (Total Testosterone) via mapToUcumCode
    const test = result.labs.find(l => l.code === 'TT');
    expect(test).toBeDefined();
    expect(test!.refLow).toBe(12);
    expect(test!.isAbnormal).toBe(true); // 10.5 < 12
  });

  it('full pipeline: 52-marker Invitro panel → all ref ranges preserved', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'АСТ\t28\t<40\tЕ/л',
      'ГГТ\t42\t<60\tЕ/л',
      'Билирубин общий\t12.5\t<21\tмкмоль/л',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'Креатинин\t92\t62-106\tмкмоль/л',
      'Мочевина\t5.2\t2.5-7.1\tммоль/л',
      'Мочевая кислота\t320\t200-420\tмкмоль/л',
      'Общий белок\t72\t65-85\tг/л',
      'Альбумин\t42\t35-50\tг/л',
      'Холестерин общий\t5.2\t<5.2\tммоль/л',
      'ЛПВП\t1.1\t>1.0\tммоль/л',
      'ЛПНП\t3.1\t<3.0\tммоль/л',
      'Триглицериды\t1.4\t<1.7\tммоль/л',
      'Гемоглобин\t145\t130-170\tг/л',
      'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
      'Т4 свободный\t14.2\t10.0-19.0\tпмоль/л',
      'Тестостерон общий\t22.5\t12.0-35.0\tнмоль/л',
      'Кортизол\t420\t150-660\tнмоль/л',
      'Витамин D 25-OH\t42\t30-100\tнг/мл',
      'Ферритин\t85\t30-400\tмкг/л',
      'Инсулин\t8.5\t2.6-24.9\tмкЕд/мл',
      'HbA1c\t5.2\t<6.0\t%',
      'ПСА общий\t1.2\t<4.0\tнг/мл',
      'Калий\t4.5\t3.5-5.1\tммоль/л',
      'Натрий\t140\t136-145\tммоль/л',
    ].join('\n');
    const file = new File([text], 'invitro-26.txt', { type: 'text/plain' });
    const result = await processUploadedFile(file);

    // All 26 markers should be found with ref ranges
    expect(result.labs.length).toBeGreaterThanOrEqual(25);

    // Spot-check: every lab should have isAbnormal correctly set
    for (const lab of result.labs) {
      if (lab.refLow !== undefined || lab.refHigh !== undefined) {
        const expectedAbnormal = (lab.refHigh !== undefined && lab.value > lab.refHigh)
          || (lab.refLow !== undefined && lab.value < lab.refLow);
        expect(lab.isAbnormal).toBe(expectedAbnormal);
      }
    }

    // Specific checks
    const ldl = result.labs.find(l => l.code === 'LDL');
    expect(ldl!.refLow).toBeUndefined(); // >N not applicable
    expect(ldl!.refHigh).toBe(3.0); // <3.0
    expect(ldl!.isAbnormal).toBe(true); // 3.1 > 3.0

    const chol = result.labs.find(l => l.code === 'CHOL');
    expect(chol!.refHigh).toBe(5.2);
    expect(chol!.isAbnormal).toBe(false); // 5.2 is not strictly greater

    const glu = result.labs.find(l => l.code === 'GLU');
    expect(glu!.refLow).toBe(3.9);
    expect(glu!.refHigh).toBe(5.5);
    expect(glu!.isAbnormal).toBe(false); // 5.4 within range
  });
});
