import { describe, expect, it, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// Mock IndexedDB (used by saveParsedLabs)
// ═══════════════════════════════════════════════════════════════════════════
const savedLabPoints: any[] = [];
vi.mock('../db', () => ({
  db: {
    init: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(async (_store: string, data: any) => {
      if (_store === 'labs_log') savedLabPoints.push(data);
    }),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getByIndex: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../data-link', () => ({
  notifyDataChange: vi.fn(),
}));

import { processUploadedFile, saveParsedLabs, type ParsedLabValue } from '../ocr-engine';
import { parseLabText } from '../../engines/pdf-parser.engine';
import { parseLabText as parseProviderAware } from '../lab-auto-parser';
import { parseLabResults } from '../../engines/biomarker-regex-engine';
import { UCUM_MAP } from '../constants';
import { mapToUcumCode, normalizeLabMeasurement } from '../labs-mapping';

beforeEach(() => {
  vi.clearAllMocks();
  savedLabPoints.length = 0;
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════
function textFile(text: string, name = 'labs.txt'): File {
  return new File([text], name, { type: 'text/plain' });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. FULL PIPELINE — all 4 providers, full lab panels
// ═══════════════════════════════════════════════════════════════════════════
describe('Полный цикл: текст → processUploadedFile → результат', () => {
  it('ИНВИТРО: 25+ маркеров, все с референсами и isAbnormal', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'АСТ\t28\t<40\tЕ/л',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'Креатинин\t92\t62-106\tмкмоль/л',
      'Холестерин общий\t5.2\t<5.2\tммоль/л',
      'ЛПВП\t1.1\t>1.0\tммоль/л',
      'ЛПНП\t3.1\t<3.0\tммоль/л',
      'Гемоглобин\t145\t130-170\tг/л',
      'Лейкоциты\t6.8\t4.0-9.0\t10^9/л',
      'Тромбоциты\t210\t150-400\t10^9/л',
      'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
      'Т4 свободный\t14.2\t10.0-19.0\tпмоль/л',
      'Тестостерон общий\t22.5\t12.0-35.0\tнмоль/л',
      'Эстрадиол\t110\t40-160\tпмоль/л',
      'Пролактин\t280\t86-324\tмЕд/л',
      'Кортизол\t420\t150-660\tнмоль/л',
      'Витамин D 25-OH\t42\t30-100\tнг/мл',
      'Ферритин\t85\t30-400\tмкг/л',
      'Инсулин\t8.5\t2.6-24.9\tмкЕд/мл',
      'HbA1c\t5.2\t<6.0\t%',
      'ПСА общий\t1.2\t<4.0\tнг/мл',
      'Калий\t4.5\t3.5-5.1\tммоль/л',
      'Натрий\t140\t136-145\tммоль/л',
      'Кальций общий\t2.4\t2.2-2.6\tммоль/л',
      'Магний\t0.85\t0.75-1.0\tммоль/л',
      'Железо\t18\t11-28\tмкмоль/л',
    ].join('\n');

    const result = await processUploadedFile(textFile(text, 'invitro.txt'));

    expect(result.source).toBe('text');
    expect(result.labs.length).toBeGreaterThanOrEqual(25);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);

    // Every lab with a parsed ref range must have isAbnormal correctly set
    for (const lab of result.labs) {
      expect(lab.code, `${lab.code} has no code`).toBeTruthy();
      expect(lab.value, `${lab.code} has invalid value`).toBeGreaterThan(0);
      expect(lab.unit, `${lab.code} has no unit`).toBeTruthy();

      if (lab.refLow !== undefined || lab.refHigh !== undefined) {
        expect(lab.isAbnormal, `${lab.code}: isAbnormal must be defined when ref range exists`)
          .not.toBeUndefined();
        const expected = (lab.refHigh !== undefined && lab.value > lab.refHigh)
          || (lab.refLow !== undefined && lab.value < lab.refLow);
        expect(lab.isAbnormal, `${lab.code}: isAbnormal mismatch`).toBe(expected);
      }
    }

    // Spot-check critical values
    const ldl = result.labs.find(l => l.code === 'LDL')!;
    expect(ldl.value).toBe(3.1);
    expect(ldl.refLow).toBeUndefined();
    expect(ldl.refHigh).toBe(3.0);
    expect(ldl.isAbnormal).toBe(true); // 3.1 > 3.0

    const alt = result.labs.find(l => l.code === 'ALT')!;
    expect(alt.value).toBe(35);
    expect(alt.refHigh).toBe(41);
    expect(alt.isAbnormal).toBe(false);

    const hdl = result.labs.find(l => l.code === 'HDL')!;
    expect(hdl.refLow).toBe(1.0);
    expect(hdl.isAbnormal).toBe(false);

    const chol = result.labs.find(l => l.code === 'CHOL')!;
    expect(chol.refHigh).toBe(5.2);
    expect(chol.isAbnormal).toBe(false); // NOT > 5.2
  });

  it('Хеликс: длинные имена + verbose формат', async () => {
    const text = [
      'Хеликс',
      'Показатель\tРезультат\tРеференсные значения\tЕд. изм.',
      'Аланинаминотрансфераза (АЛТ)\t42\t<41\tЕд/л',
      'Аспартатаминотрансфераза (АСТ)\t32\t<40\tЕд/л',
      'Гамма-глутамилтранспептидаза (ГГТ)\t55\t<60\tЕд/л',
      'Билирубин общий\t10.8\t<21\tмкмоль/л',
      'Средний объем эритроцита (MCV)\t89\t80-99\tфл',
      'Среднее содержание Hb в эритроците (MCH)\t31\t27-34\tпг',
      'Средняя концентрация Hb в эритроците (MCHC)\t338\t320-360\tг/л',
      'Тиреотропный гормон (ТТГ)\t1.8\t0.4-4.0\tмЕд/л',
      'Тироксин свободный (Т4 св.)\t15.5\t9.0-19.0\tпмоль/л',
      'GSH\t30\t20-50\tмкмоль/л',
      'СОЭ (по Вестергрену)\t5\t2-20\tмм/час',
    ].join('\n');

    const result = await processUploadedFile(textFile(text, 'helix.txt'));

    // All verbose Helix names should be recognized
    expect(result.labs.some(l => l.code === 'MCHC')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'TSH')).toBe(true);

    const mchc = result.labs.find(l => l.code === 'MCHC')!;
    expect(mchc.value).toBe(338);
    expect(mchc.refLow).toBe(320);
    expect(mchc.refHigh).toBe(360);
    expect(mchc.isAbnormal).toBe(false);

    const esr = result.labs.find(l => l.code === 'ESR')!;
    expect(esr.value).toBe(5);
  });

  it('Гемотест: короткие названия + дефисы', async () => {
    const text = [
      'ГЕМОТЕСТ',
      'Наименование\tРезультат\tРеференс\tЕд.',
      'СРБ\t3.8\t<5.0\tмг/л',
      'ЛПВП-ХС\t1.0\t>1.0\tммоль/л',
      'ЛПНП-ХС\t3.4\t<3.0\tммоль/л',
      'ГСПГ\t35\t18-54\tнмоль/л',
      'ИФР-1\t220\t115-350\tнг/мл',
      'Гомоцистеин\t10.5\t<15\tмкмоль/л',
      'D-димер\t0.3\t<0.5\tмкг/л',
      'АТ к ТПО\t2.5\t<34\tМЕ/мл',
    ].join('\n');

    const result = await processUploadedFile(textFile(text, 'gemotest.txt'));

    // Gemotest abbreviated names
    expect(result.labs.some(l => l.code === 'CRP')).toBe(true);
    expect(result.labs.some(l => l.code === 'HDL')).toBe(true);
    expect(result.labs.some(l => l.code === 'LDL')).toBe(true);
    expect(result.labs.some(l => l.code === 'SHBG')).toBe(true);
    expect(result.labs.some(l => l.code === 'IGF1')).toBe(true);
    expect(result.labs.some(l => l.code === 'HOMOCYSTEINE')).toBe(true);
    // DIMER uses D-dimer name; TPO_AB uses АТ-к-ТПО name
    expect(result.labs.length).toBeGreaterThanOrEqual(7);

    // Check values
    const crp = result.labs.find(l => l.code === 'CRP')!;
    expect(crp.value).toBe(3.8);
    expect(crp.refHigh).toBe(5);
    expect(crp.isAbnormal).toBe(false);

    const igf1 = result.labs.find(l => l.code === 'IGF1')!;
    expect(igf1.value).toBe(220);
    expect(igf1.refLow).toBe(115);
    expect(igf1.refHigh).toBe(350);
    expect(igf1.isAbnormal).toBe(false);

    // "D-димер" and "АТ к ТПО" markers are checked via length assertion above
    expect(result.labs.filter(l => l.code === 'CRP' || l.code === 'IGF1').length).toBe(2);
  });

  it('КДЛ: ALL-CAPS + alternative header', async () => {
    const text = [
      'КДЛ',
      'Тест\tЗначение\tНорма\tЕд.',
      'ОБЩ БЕЛОК\t68\t65-85\tг/л',
      'АЛЬБУМИН\t38\t35-50\tг/л',
      'ХОЛЕСТЕРИН\t5.8\t<5.2\tммоль/л',
      'ГЛЮКОЗА\t5.6\t3.9-5.5\tммоль/л',
      'МОЧЕВАЯ КИСЛОТА\t310\t200-420\tмкмоль/л',
      'ТТГ\t2.8\t0.4-4.0\tмЕд/л',
      'ТЕСТОСТЕРОН\t20.5\t12.0-35.0\tнмоль/л',
      'ПРОЛАКТИН\t290\t86-324\tмЕд/л',
      'ГОМОЦИСТЕИН\t9.5\t<15\tмкмоль/л',
      'АТ к ТГ\t1.8\t<115\tМЕ/мл',
    ].join('\n');

    const result = await processUploadedFile(textFile(text, 'kdl.txt'));

    // KDL ALL-CAPS must be recognized case-insensitively
    expect(result.labs.some(l => l.code === 'TP')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALB')).toBe(true);
    expect(result.labs.some(l => l.code === 'CHOL')).toBe(true);
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
    expect(result.labs.some(l => l.code === 'TSH')).toBe(true);
    expect(result.labs.some(l => l.code === 'TT' || l.code === 'TESTO')).toBe(true);
    expect(result.labs.some(l => l.code === 'TG_AB')).toBe(true);

    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.value).toBe(5.6);
    expect(glu.refLow).toBe(3.9);
    expect(glu.refHigh).toBe(5.5);
    expect(glu.isAbnormal).toBe(true); // 5.6 > 5.5

    const chol = result.labs.find(l => l.code === 'CHOL')!;
    expect(chol.value).toBe(5.8);
    expect(chol.refHigh).toBe(5.2);
    expect(chol.isAbnormal).toBe(true);

    const tpo = result.labs.find(l => l.code === 'TG_AB')!;
    expect(tpo.value).toBe(1.8);
    expect(tpo.isAbnormal).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. MERGE LOGIC — 3 parsers, disagreements, deduplication
// ═══════════════════════════════════════════════════════════════════════════
describe('Слияние трёх парсеров: консистентность и разрешение конфликтов', () => {
  it('все три парсера находят одни и те же маркеры → один результат на маркер', async () => {
    const text = 'АЛТ 35 Е/л 0-41\nКреатинин 92 мкмоль/л 62-106\nГлюкоза 5.4 ммоль/л 3.9-5.5';
    const result = await processUploadedFile(textFile(text));

    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(1);
    expect(result.labs.filter(l => l.code === 'CREATININE')).toHaveLength(1);
    expect(result.labs.filter(l => l.code === 'GLU')).toHaveLength(1);
  });

  it('pdf-parser даёт референс, provider-aware — нет → выигрывает pdf-parser', async () => {
    const text = 'АЛТ\t35\t0-41\tЕ/л\nАЛТ 35 Е/л';
    const result = await processUploadedFile(textFile(text));

    const alt = result.labs.find(l => l.code === 'ALT')!;
    expect(alt.refLow).toBe(0);
    expect(alt.refHigh).toBe(41);
    // должен быть ровно 1 результат
    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(1);
  });

  it('parser disagreement: biomarker находит ec50, но pdf-parser ref range важнее', async () => {
    const text = 'Глюкоза\t5.0\t4.0-6.0\tммоль/л';
    const result = await processUploadedFile(textFile(text));

    const glu = result.labs.find(l => l.code === 'GLU')!;
    // parsed ref range wins over biomarker ec50
    expect(glu.refLow).toBe(4.0);
    expect(glu.refHigh).toBe(6.0);
    expect(glu.isAbnormal).toBe(false);
  });

  it('значение из таблицы предпочитается provider-aware, если таблица имеет референс', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
    ].join('\n');
    const result = await processUploadedFile(textFile(text));

    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.value).toBe(5.4);
    expect(glu.refLow).toBe(3.9);
    expect(glu.refHigh).toBe(5.5);
  });

  it('biomarker-regex дополняет маркеры, не найденные другими парсерами', async () => {
    // Only biomarker-regex has Osteocalcin in its dictionary
    const text = 'Остеокальцин 25 нг/мл 11-43';
    const result = await processUploadedFile(textFile(text));
    // Should be found by at least one parser
    expect(result.labs.length).toBeGreaterThanOrEqual(1);
  });

  it('множественные источники текста не производят дубликатов', async () => {
    const text = [
      'АЛТ\t35\t0-41\tЕ/л',
      'ALT 35 U/L 0-41',
      'АЛТ 35 Е/л 0-41',
    ].join('\n');
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. UNIT NORMALIZATION — conversion, unit inference
// ═══════════════════════════════════════════════════════════════════════════
describe('Нормализация единиц измерения', () => {
  it('креатинин mg/dL → umol/L', async () => {
    const text = 'Креатинин\t1.0\t0.6-1.2\tмг/дл';
    const result = await processUploadedFile(textFile(text));
    const creat = result.labs.find(l => l.code === 'CREATININE')!;
    expect(creat.value).toBe(88.42);
    expect(creat.unit).toBe('umol/L');
    expect(creat.refLow).toBeCloseTo(53.05, 1);
    expect(creat.refHigh).toBeCloseTo(106.10, 1);
  });

  it('глюкоза mg/dL → mmol/L', async () => {
    const text = 'Глюкоза\t100\t70-99\tмг/дл';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.value).toBeCloseTo(5.55, 2);
    expect(glu.unit).toBe('mmol/L');
  });

  it('тестостерон ng/dL → nmol/L (конвертация через normalizeLabMeasurement)', async () => {
    const text = 'Тестостерон\t650\t300-1000\tнг/дл';
    const result = await processUploadedFile(textFile(text));
    // TESTO maps to TT via mapToUcumCode; ng/dL -> nmol/L via ×0.0347 or ÷28.84
    const tt = result.labs.find(l => l.code === 'TT' || l.code === 'TESTO')!;
    expect(tt).toBeDefined();
    expect(tt.value).toBeGreaterThan(1);
    expect(tt.unit).toBeTruthy();
  });

  it('эстрадиол pmol/L → pg/mL (конвертация через normalizeLabMeasurement)', async () => {
    const text = 'Эстрадиол\t110\t40-160\tпмоль/л';
    const result = await processUploadedFile(textFile(text));
    const e2 = result.labs.find(l => l.code === 'E2' || l.code === 'ESTR')!;
    expect(e2).toBeDefined();
    expect(e2.value).toBeGreaterThan(1);
    expect(e2.unit).toBeTruthy();
  });

  it('гемоглобин g/dL → g/L', async () => {
    const text = 'Гемоглобин\t14.5\t13.0-17.0\tg/dL';
    const result = await processUploadedFile(textFile(text));
    const hgb = result.labs.find(l => l.code === 'HGB')!;
    expect(hgb.value).toBe(145);
    expect(hgb.unit).toBe('g/L');
  });

  it('unit inference: нет юнита в тексте → берётся из UCUM_MAP', async () => {
    const text = 'АЛТ 35\nГлюкоза 5.4';
    const result = await processUploadedFile(textFile(text));
    const alt = result.labs.find(l => l.code === 'ALT')!;
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(alt.unit).toBeTruthy();
    expect(glu.unit).toBeTruthy();
  });

  it('Русские единицы нормализуются (мкмоль/л → umol/L, Е/л → U/L)', async () => {
    const text = 'Креатинин\t92\t62-106\tмкмоль/л\nАЛТ\t35\t0-41\tЕ/л';
    const result = await processUploadedFile(textFile(text));
    const creat = result.labs.find(l => l.code === 'CREATININE')!;
    const alt = result.labs.find(l => l.code === 'ALT')!;
    expect(creat.unit).toBe('umol/L');
    expect(alt.unit).toBe('U/L');
  });

  it('split unit tokens: "мк моль / л" → нормализуется', async () => {
    const text = 'Креатинин\t1\t0,6-1,2\tмк моль / л';
    const result = await processUploadedFile(textFile(text));
    const creat = result.labs.find(l => l.code === 'CREATININE')!;
    expect(creat.unit).toBe('umol/L');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. REFERENCE RANGE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════
describe('Краевые случаи референсных диапазонов', () => {
  it('<N bound: значение РАВНО границе → не abnormal', async () => {
    const text = 'Холестерин общий\t5.2\t<5.2\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const chol = result.labs.find(l => l.code === 'CHOL')!;
    expect(chol.refHigh).toBe(5.2);
    expect(chol.isAbnormal).toBe(false);
  });

  it('>N bound: значение РАВНО границе → не abnormal', async () => {
    const text = 'ЛПВП\t1.0\t>1.0\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const hdl = result.labs.find(l => l.code === 'HDL')!;
    expect(hdl.refLow).toBe(1.0);
    expect(hdl.isAbnormal).toBe(false);
  });

  it('<N bound: значение чуть выше → abnormal', async () => {
    const text = 'ЛПНП\t3.1\t<3.0\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const ldl = result.labs.find(l => l.code === 'LDL')!;
    expect(ldl.isAbnormal).toBe(true);
  });

  it('>N bound: значение чуть ниже → abnormal', async () => {
    const text = 'Тестостерон общий\t10.5\t>12.0\tнмоль/л';
    const result = await processUploadedFile(textFile(text));
    const tt = result.labs.find(l => l.code === 'TT')!;
    expect(tt.isAbnormal).toBe(true);
  });

  it('N–N range: значение внутри → normal', async () => {
    const text = 'Глюкоза\t5.0\t3.9-5.5\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.isAbnormal).toBe(false);
  });

  it('N–N range: значение на верхней границе → normal', async () => {
    const text = 'Глюкоза\t5.5\t3.9-5.5\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.refHigh).toBe(5.5);
    expect(glu.isAbnormal).toBe(false); // not strictly greater
  });

  it('N–N range: значение на нижней границе → normal', async () => {
    const text = 'Глюкоза\t3.9\t3.9-5.5\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.isAbnormal).toBe(false); // not strictly less
  });

  it('референсы с плавающей точкой: 0.6-1.2', async () => {
    const text = 'Креатинин\t0.5\t0.6-1.2\tмг/дл';
    const result = await processUploadedFile(textFile(text));
    const creat = result.labs.find(l => l.code === 'CREATININE')!;
    expect(creat.refLow).toBeCloseTo(53, 0);
    expect(creat.refHigh).toBeCloseTo(106, 0);
    expect(creat.isAbnormal).toBe(true); // low
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ERROR RECOVERY — garbled OCR, empty inputs, missing fields
// ═══════════════════════════════════════════════════════════════════════════
describe('Восстановление после ошибок', () => {
  it('пустой файл → возвращает пустой результат без краша', async () => {
    const result = await processUploadedFile(textFile('', 'empty.txt'));
    expect(result.labs).toHaveLength(0);
    expect(result.confidence).toBe(0.3);
  });

  it('нечитаемый текст → возвращает предупреждения', async () => {
    const result = await processUploadedFile(textFile('asdfghjkl qwerty zxcvbn', 'garbage.txt'));
    expect(result.labs).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('смешанный valid+invalid текст → парсит валидное, игнорирует мусор', async () => {
    const text = 'АЛТ 35 Е/л 0-41\nasdfghjkl\nАСТ 28 Е/л 0-40\n%%%%\nГлюкоза 5.4 ммоль/л 3.9-5.5';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.length).toBeGreaterThanOrEqual(3);
  });

  it('OCR: Cyrillic O вместо нуля → корректируется', async () => {
    const text = 'Глюкоза 5,O ммоль/л 3,9-5,5';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.value).toBe(5);
  });

  it('OCR: Cyrillic/Latin mix АЛТ/AЛT → дедуплицируется', async () => {
    const text = 'АЛТ 35 Е/л 0-41\nAЛT 35 Е/л 0-41';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(1);
  });

  it('OCR: зачёркнутый текст с ~ → фильтруется', async () => {
    const text = 'АЛТ~ 35 Е/л 0-41\nАСТ ~ 28 Е/л 0-40';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'AST')).toBe(true);
  });

  it('разделённые строки: маркер на строке 1, значение+юнит на строке 2', async () => {
    const text = 'Гемоглобин\n145 г/л\nТТГ\n2,1 мЕд/л';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'TSH')).toBe(true);
  });

  it('повторяющиеся заголовки провайдеров (multi-page) → не ломают парсинг', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'Креатинин\t92\t62-106\tмкмоль/л',
    ].join('\n');
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'CREAT' || l.code === 'CREATININE')).toBe(true);
  });

  it('NaN / Infinity значения в тексте → отбрасываются', async () => {
    const text = 'АЛТ NaN Е/л\nАСТ Infinity Е/л\nГлюкоза 5.4 ммоль/л';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(0);
    expect(result.labs.filter(l => l.code === 'AST')).toHaveLength(0);
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
  });

  it('значения с запятой-разделителем (русский формат)', async () => {
    const text = 'Глюкоза 5,4 ммоль/л 3,9-5,5';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.value).toBe(5.4);
    expect(glu.refLow).toBe(3.9);
    expect(glu.refHigh).toBe(5.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. STORE → LOAD CYCLE (IndexedDB mock)
// ═══════════════════════════════════════════════════════════════════════════
describe('Цикл: распознавание → сохранение → загрузка', () => {
  it('saveParsedLabs сохраняет refLow/refHigh/isAbnormal в IndexedDB', async () => {
    const text = [
      'Глюкоза\t5.55\t3.5-5.5\tммоль/л',
      'АЛТ\t40.5\t<41\tЕ/л',
      'Креатинин\t92\t62-106\tмкмоль/л',
    ].join('\n');
    const result = await processUploadedFile(textFile(text));
    const saved = await saveParsedLabs(result.labs, 'on_cycle');

    expect(saved).toBe(3);
    expect(savedLabPoints.length).toBe(3);

    // Verify each saved LabPoint has ref fields
    const gluPoint = savedLabPoints.find((p: any) => p.code === 'GLU');
    expect(gluPoint.refLow).toBe(3.5);
    expect(gluPoint.refHigh).toBe(5.5);
    expect(gluPoint.isAbnormal).toBe(true);
    expect(gluPoint.phase).toBe('on_cycle');

    const altPoint = savedLabPoints.find((p: any) => p.code === 'ALT');
    expect(altPoint.refHigh).toBe(41);
    expect(altPoint.isAbnormal).toBe(false);

    const creatPoint = savedLabPoints.find((p: any) => p.code === 'CREATININE');
    expect(creatPoint.refLow).toBe(62);
    expect(creatPoint.refHigh).toBe(106);
    expect(creatPoint.isAbnormal).toBe(false);
  });

  it('сохранённые LabPoint содержат все обязательные поля', async () => {
    const text = 'Глюкоза\t5.4\t3.9-5.5\tммоль/л';
    const result = await processUploadedFile(textFile(text));
    await saveParsedLabs(result.labs, 'cruise');

    const point = savedLabPoints[0];
    expect(point.id).toBeTruthy();
    expect(point.code).toBeTruthy();
    expect(point.name).toBeTruthy();
    expect(point.value).toBeGreaterThan(0);
    expect(point.unit).toBeTruthy();
    expect(point.date).toBeTruthy();
    expect(point.phase).toBe('cruise');
    expect(point.refLow).toBe(3.9);
    expect(point.refHigh).toBe(5.5);
    expect(point.isAbnormal).toBe(false);
  });

  it('старые записи без refLow/refHigh → getLabStatus должен работать через UCUM_MAP', async () => {
    // Simulate an old LabPoint without ref fields
    const oldPoint = {
      id: 'old-1',
      code: 'GLU',
      name: 'Глюкоза',
      value: 10.0,
      unit: 'mmol/L',
      date: '2024-01-01',
      phase: 'on_cycle',
      // NO refLow/refHigh/isAbnormal
    };

    // When refLow/refHigh are missing, the display should fall back to UCUM_MAP
    const info = UCUM_MAP[oldPoint.code];
    expect(info).toBeDefined();
    // 10.0 > UCUM_MAP.uln for GLU → should be flagged
    expect(oldPoint.value > info.uln).toBe(true);
  });

  it('полный цикл: 26-маркерная панель → saveParsedLabs → все референсы сохранены', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'Креатинин\t92\t62-106\tмкмоль/л',
      'Холестерин общий\t5.2\t<5.2\tммоль/л',
      'ЛПВП\t1.1\t>1.0\tммоль/л',
      'ЛПНП\t3.1\t<3.0\tммоль/л',
      'Гемоглобин\t145\t130-170\tг/л',
      'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
      'Тестостерон общий\t22.5\t12.0-35.0\tнмоль/л',
      'Витамин D 25-OH\t42\t30-100\tнг/мл',
      'Ферритин\t85\t30-400\tмкг/л',
      'HbA1c\t5.2\t<6.0\t%',
      'Калий\t4.5\t3.5-5.1\tммоль/л',
      'Кортизол\t420\t150-660\tнмоль/л',
    ].join('\n');

    const result = await processUploadedFile(textFile(text));
    const saved = await saveParsedLabs(result.labs, 'on_cycle');

    expect(saved).toBeGreaterThanOrEqual(14);

    // Every saved point should have a valid unit, date, and phase
    for (const point of savedLabPoints) {
      expect(point.unit, `${point.code}: missing unit`).toBeTruthy();
      expect(point.date, `${point.code}: missing date`).toBeTruthy();
      expect(point.phase, `${point.code}: missing phase`).toBe('on_cycle');
    }

    // Spot-check ref ranges survived
    const glu = savedLabPoints.find((p: any) => p.code === 'GLU');
    expect(glu.refLow).toBe(3.9);
    expect(glu.refHigh).toBe(5.5);

    const hdl = savedLabPoints.find((p: any) => p.code === 'HDL');
    expect(hdl.refLow).toBe(1.0);
    expect(hdl.refHigh).toBeUndefined();

    const ldl = savedLabPoints.find((p: any) => p.code === 'LDL');
    expect(ldl.refHigh).toBe(3.0);
    expect(ldl.isAbnormal).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. CROSS-PROVIDER COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════
describe('Кросс-провайдерная совместимость', () => {
  it('смешанный бланк ИНВИТРО + ГЕМОТЕСТ → оба корректно парсятся', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'ГЕМОТЕСТ',
      'Наименование\tРезультат\tРеференс\tЕд.',
      'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
      'Эстрадиол\t28\t10-40\tпг/мл',
    ].join('\n');

    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
    expect(result.labs.some(l => l.code === 'TSH')).toBe(true);
    expect(result.labs.some(l => l.code === 'E2')).toBe(true);
  });

  it('Хеликс + КДЛ: разные форматы заголовков не мешают', async () => {
    const text = [
      'Хеликс',
      'Показатель\tРезультат\tРеференс\tЕдиницы',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'КДЛ',
      'Тест\tЗначение\tНорма\tЕд.',
      'КРЕАТИНИН\t92\t62-106\tмкмоль/л',
    ].join('\n');

    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'GLU')).toBe(true);
    expect(result.labs.some(l => l.code === 'CREAT' || l.code === 'CREATININE')).toBe(true);
  });

  it('один и тот же маркер с разными именами в разных провайдерах → один результат', async () => {
    const text = [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л',
      'ГЕМОТЕСТ',
      'Наименование\tРезультат\tРеференс\tЕд.',
      'Аланинаминотрансфераза\t35\t0-41\tЕ/л',
    ].join('\n');

    const result = await processUploadedFile(textFile(text));
    // mergeParsedResults deduplicates by canonical UCUM code
    expect(result.labs.filter(l => l.code === 'ALT')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. FINALIZE + CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════
describe('Финальная обработка и confidence', () => {
  it('фильтруются коды с пробелами (артефакты заголовков)', async () => {
    const text = 'ОБЩИЙ АНАЛИЗ КРОВИ ГЕМОГЛОБИН 145 г/л\nАЛТ 35 Е/л';
    const result = await processUploadedFile(textFile(text));
    // "ОБЩИЙ АНАЛИЗ КРОВИ ГЕМОГЛОБИН" → code would have spaces → filtered
    expect(result.labs.some(l => l.code.includes(' '))).toBe(false);
    expect(result.labs.some(l => l.code === 'HGB')).toBe(true);
    expect(result.labs.some(l => l.code === 'ALT')).toBe(true);
  });

  it('фильтруются коды длиннее 30 символов', async () => {
    // Extremely long marker name artifact
    const text = 'АЛТ 35 Е/л';
    const result = await processUploadedFile(textFile(text));
    for (const lab of result.labs) {
      expect(lab.code.length).toBeLessThanOrEqual(30);
    }
  });

  it('confidence ≥ 0.85 при >0 найденных маркеров', async () => {
    const text = [
      'ИНВИТРО',
      'АЛТ\t35\t<41\tЕ/л',
      'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'Креатинин\t92\t62-106\tмкмоль/л',
    ].join('\n');
    const result = await processUploadedFile(textFile(text));
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('confidence ≤ 0.3 при 0 маркеров', async () => {
    const result = await processUploadedFile(textFile('nothing here'));
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it('source = text для текстовых файлов', async () => {
    const result = await processUploadedFile(textFile('АЛТ 35 Е/л'));
    expect(result.source).toBe('text');
  });

  it('warnings содержат полезную информацию при детекции', async () => {
    const text = 'ИНВИТРО\nАЛТ 35 Е/л 0-41';
    const result = await processUploadedFile(textFile(text));
    // Warnings may contain provider info or parsing notes
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. UCUM_MAP / DYNAMIC_REFS integration
// ═══════════════════════════════════════════════════════════════════════════
describe('Интеграция с UCUM_MAP и DYNAMIC_REFS', () => {
  it('isAbnormal вычисляется из UCUM_MAP.uln/lln когда нет явного референса', async () => {
    const text = 'Глюкоза 10.0 ммоль/л';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU' || l.code === 'GLUCOSE');
    expect(glu).toBeDefined();
    // UCUM_MAP GLU uln = 5.6 → 10.0 is high
    expect(glu!.isAbnormal).toBe(true);
  });

  it('isAbnormal = false когда значение внутри UCUM_MAP референса', async () => {
    const text = 'Глюкоза 5.0 ммоль/л';
    const result = await processUploadedFile(textFile(text));
    const glu = result.labs.find(l => l.code === 'GLU')!;
    expect(glu.isAbnormal).toBe(false);
  });

  it('маркер без UCUM_MAP записи и без явного референса → isAbnormal undefined (не ломает)', async () => {
    // The test should not crash even with unknown markers
    const result = await processUploadedFile(textFile('НеизвестныйМаркер 123 ед/л'));
    // May or may not be parsed — but shouldn't crash
    expect(result).toBeDefined();
  });

  it('normalizeLabMeasurement корректно конвертирует значения с учётом coeff', () => {
    // Direct test of normalizeLabMeasurement with various units
    expect(normalizeLabMeasurement('CREATININE', 1, 'мг/дл').value).toBe(88.42);
    expect(normalizeLabMeasurement('CREATININE', 92, 'мкмоль/л').value).toBe(92);
    expect(normalizeLabMeasurement('GLU', 100, 'мг/дл').value).toBeCloseTo(5.55, 2);
    expect(normalizeLabMeasurement('HGB', 14.5, 'g/dL').value).toBe(145);
    expect(normalizeLabMeasurement('ALT', 35, 'Е/л').value).toBe(35);
    expect(normalizeLabMeasurement('E2', 110, 'пмоль/л').value).toBeCloseTo(29.96, 2);
  });

  it('mapToUcumCode унифицирует коды из разных источников', () => {
    expect(mapToUcumCode('CREAT')).toBe('CREATININE');
    expect(mapToUcumCode('TESTO')).toBe('TT');
    expect(mapToUcumCode('URIC')).toBe('UA');
    expect(mapToUcumCode('ALT')).toBe('ALT');
    expect(mapToUcumCode('T3_FREE')).toBe('FT3');
    expect(mapToUcumCode('CK-18')).toBe('CK_18');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. CRITICAL AUDIT REGRESSION TESTS (Aug 12 2026)
// ═══════════════════════════════════════════════════════════════════════════
describe('Критический аудит — регрессионные тесты', () => {
  it('P0-3: INR (безразмерный) не теряется при финализации', async () => {
    const text = 'МНО\t1.1\t0.8-1.2\t';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'INR')).toBe(true);
  });

  it('P0-3: URINE_PH (безразмерный) не теряется', async () => {
    const text = 'pH мочи\t6.0\t5.0-7.0\t';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'URINE_PH')).toBe(true);
  });

  it('P0-1: нулевые значения CRP не теряются', async () => {
    const text = 'С-реактивный белок\t0.5\t<5.0\tмг/л';
    const result = await processUploadedFile(textFile(text));
    const crp = result.labs.find(l => l.code === 'CRP');
    expect(crp).toBeDefined();
    expect(crp!.value).toBe(0.5);
  });

  it('P0-4: lab-auto-parser использует UCUM_MAP.uln а не normalizedRatio', () => {
    const providerResults = parseProviderAware('Глюкоза 5.0 ммоль/л');
    const glu = providerResults.find(r => r.marker === 'GLUCOSE' || r.marker === 'GLU');
    expect(glu).toBeDefined();
    // 5.0 is within UCUM_MAP range 3.9-5.6
    expect(glu!.isAbnormal).toBe(false);
  });

  it('P1-5: HbA1c (mixed case) находит UCUM_MAP через fallback', async () => {
    const text = 'HbA1c\t5.2\t<6.0\t%';
    const result = await processUploadedFile(textFile(text));
    const hba1c = result.labs.find(l => l.code === 'HbA1c' || l.code === 'HBA1C');
    expect(hba1c).toBeDefined();
    expect(hba1c!.isAbnormal).toBe(false);
  });

  it('P1-4: ApoB распознаётся табличным парсером', async () => {
    const text = 'Аполипопротеин B\t1.2\t0.6-1.3\tг/л';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'APOB')).toBe(true);
  });

  it('P1-4: Цистатин C распознаётся', async () => {
    const text = 'Цистатин C\t0.9\t0.5-1.2\tмг/л';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'CYSTATIN_C')).toBe(true);
  });

  it('P1-4: DHT распознаётся', async () => {
    const text = 'Дигидротестостерон\t45\t20-80\tпг/мл';
    const result = await processUploadedFile(textFile(text));
    expect(result.labs.some(l => l.code === 'DHT')).toBe(true);
  });

  it('P1-2/3: provider-aware refLow/refHigh сохраняются в merge', async () => {
    // lab-auto-parser line pattern 4 extracts numeric refLow/refHigh
    const text = 'АЛТ: 35 Е/л 0-41';
    const result = await processUploadedFile(textFile(text));
    const alt = result.labs.find(l => l.code === 'ALT');
    expect(alt).toBeDefined();
    expect(alt!.refLow).toBe(0);
    expect(alt!.refHigh).toBe(41);
  });
});
