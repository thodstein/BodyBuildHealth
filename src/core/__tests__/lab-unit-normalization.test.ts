import { describe, it, expect, vi, beforeEach } from 'vitest';

// IndexedDB mock для saveParsedLabs
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
vi.mock('../data-link', () => ({ notifyDataChange: vi.fn() }));

import { saveParsedLabs, type ParsedLabValue } from '../ocr-engine';
import { parseLabText as parseProviderAware } from '../lab-auto-parser';
import { parseLabResults, extractUnitFromLine } from '../../engines/biomarker-regex-engine';
import { UCUM_MAP } from '../constants';
import { mapToUcumCode, normalizeLabMeasurement, resolveLabMarker } from '../labs-mapping';

beforeEach(() => {
  vi.clearAllMocks();
  savedLabPoints.length = 0;
  localStorage.clear();
});

describe('Пересчёт единиц: массовые ↔ молярные ↔ активность', () => {
  const cases: Array<[string, string, number, string, number, string]> = [
    // [code, source unit, source value, canonical code, expected value, expected unit]
    // Масса → масса: регрессия «mg/dl» ошибочно матчился как «g/dl».
    ['FIBRINOGEN', 'mg/dL', 300, 'FIBRINOGEN', 3, 'g/L'],
    ['TRANSFERRIN', 'mg/dL', 250, 'TRANSFERRIN', 2.5, 'g/L'],
    ['HGB', 'g/dL', 14, 'HGB', 140, 'g/L'],
    // Масса → молярная (через молярную массу).
    ['CORTISOL', 'ug/dL', 15, 'CORTISOL', 413.8, 'nmol/L'],
    ['FT4', 'ng/dL', 1.2, 'FT4', 15.447, 'pmol/L'],
    ['T3', 'ng/dL', 120, 'T3', 1.843, 'nmol/L'],
    ['T4', 'ug/dL', 8, 'T4', 103, 'nmol/L'],
    ['TIBC', 'ug/dL', 300, 'TIBC', 53.72, 'umol/L'],
    ['UIBC', 'ug/dL', 200, 'UIBC', 35.813, 'umol/L'],
    ['HOMOCYSTEINE', 'mg/L', 1.1, 'HOMOCYSTEINE', 8.137, 'umol/L'],
    ['C_PEPTIDE', 'ng/mL', 2, 'C_PEPTIDE', 662.2, 'pmol/L'],
    ['IRON', 'ug/dL', 100, 'IRON', 17.91, 'umol/L'],
    // Молярная → масса.
    ['VITD', 'nmol/L', 75, 'VITD', 30.048, 'ng/mL'],
    ['B12', 'pmol/L', 400, 'B12', 542, 'pg/mL'],
    // Активность.
    ['PRL', 'mIU/L', 240, 'PRL', 11.321, 'ng/mL'],
    ['PRL', 'mIU/mL', 240, 'PRL', 11320.8, 'ng/mL'],
    ['TSH', 'мЕд/л', 2.1, 'TSH', 2.1, 'mIU/L'],
    ['TG_AB', 'МЕ/мл', 1.8, 'TG_AB', 1.8, 'IU/mL'],
    ['TPO_AB', 'МЕ/мл', 34, 'TPO_AB', 34, 'IU/mL'],
    ['ALT', 'мккат/л', 0.58, 'ALT', 34.8, 'U/L'],
  ];

  for (const [code, unit, value, canonical, expectedValue, expectedUnit] of cases) {
    it(`${code}: ${value} ${unit} → ${expectedValue} ${expectedUnit}`, () => {
      const result = normalizeLabMeasurement(code, value, unit);
      expect(result.value).toBeCloseTo(expectedValue, expectedValue >= 100 ? 1 : 3);
      expect(result.unit).toBe(expectedUnit);
      expect(mapToUcumCode(code)).toBe(canonical);
    });
  }

  it('алиасы парсеров получают пересчёт (APOB → APO_B)', () => {
    expect(normalizeLabMeasurement('APOB', 95, 'mg/dL')).toEqual({ value: 0.95, unit: 'g/L' });
  });

  it('единица, уже совпадающая с каноном, не искажается', () => {
    // 250 мкг/дл — каноничная единица ДГЭА-С, коэффициент не нужен.
    expect(normalizeLabMeasurement('DHEA_S', 250, 'ug/dL')).toEqual({ value: 250, unit: 'ug/dL' });
    expect(normalizeLabMeasurement('PTH', 45, 'pg/mL')).toEqual({ value: 45, unit: 'pg/mL' });
    expect(normalizeLabMeasurement('ALDOSTERONE', 120, 'pg/mL')).toEqual({ value: 120, unit: 'pg/mL' });
  });

  it('непереводимая пара единиц сохраняет единицу бланка, а не переименовывается', () => {
    // Лп(а) mg/dL → nmol/L и КФК-МВ U/L → ng/mL без молярной массы/коэффициента
    // пересчитать нельзя: число нельзя подписывать канонической единицей.
    const lpa = normalizeLabMeasurement('LP_A', 30, 'mg/dL');
    expect(lpa).toEqual({ value: 30, unit: 'mg/dL' });
    const ckmb = normalizeLabMeasurement('CK_MB', 10, 'U/L');
    expect(ckmb).toEqual({ value: 10, unit: 'U/L' });
  });
});

describe('Канонизация кодов маркеров (один анализ — одна строка)', () => {
  const aliases: Array<[string, string]> = [
    ['APOB', 'APO_B'],
    ['APOA1', 'APO_A1'],
    ['PTH', 'PARATHYROID'],
    ['EPO', 'ERYTHROPOIETIN'],
    ['ALD', 'ALDOSTERONE'],
    ['ANDRO', 'ANDROSTENEDIONE'],
    ['CL', 'CHLORIDE'],
    ['TRANSF', 'TRANSFERRIN'],
    ['CKMB', 'CK_MB'],
    ['AMY', 'AMYLASE'],
    ['CT', 'CALCITONIN'],
    ['PSAF', 'PSA_FREE'],
  ];

  for (const [from, to] of aliases) {
    it(`${from} → ${to}`, () => {
      expect(mapToUcumCode(from)).toBe(to);
      expect(UCUM_MAP[to as keyof typeof UCUM_MAP]).toBeDefined();
    });
  }

  it('свободный ПСА — отдельный показатель, не сливается с общим', () => {
    expect(mapToUcumCode('PSA_FREE')).toBe('PSA_FREE');
    expect(mapToUcumCode('PSA')).toBe('PSA');
  });
});

describe('Русские синонимы анализов', () => {
  const synonyms: Array<[string, string]> = [
    ['Тиреотропный гормон', 'TSH'],
    ['ЩФ', 'ALP'],
    ['ЛЖСС', 'UIBC'],
    ['Хлориды', 'CHLORIDE'],
    ['АпоБ', 'APO_B'],
    ['АпоА1', 'APO_A1'],
    ['Кортизол утренний', 'CORTISOL'],
    ['Альфа-амилаза', 'AMYLASE'],
    ['КФК-МБ', 'CK_MB'],
    ['Т3 Total', 'T3'],
    ['T4 total', 'T4'],
    ['СРБ высокочувствительный', 'CRP'],
    ['Антитела к тиреопероксидазе', 'TPO_AB'],
    ['Антитела к тиреоглобулину', 'TG_AB'],
    ['Инсулиноподобный фактор роста 1', 'IGF1'],
  ];

  for (const [name, code] of synonyms) {
    it(`«${name}» → ${code}`, () => {
      expect(resolveLabMarker(name)).toBe(code);
    });
  }
});

describe('Regex-движок берёт единицу из бланка', () => {
  it('DHEA-S: «S» в названии не становится единицей', () => {
    expect(extractUnitFromLine('DHEA-S 250 80-560 ug/dL')).toBe('ug/dL');
  });

  it('протромбиновое время в секундах по-прежнему распознаётся', () => {
    expect(extractUnitFromLine('PT 12 s')).toBe('s');
  });

  it('не отрезает префикс у «нмоль/л» и «ммоль/л»', () => {
    expect(extractUnitFromLine('Андростендион 3.0 1.0-6.0 нмоль/л')).toBe('нмоль/л');
    expect(extractUnitFromLine('Глюкоза 5.2 3.9-5.5 ммоль/л')).toBe('ммоль/л');
  });

  it('при отсутствии единицы единица берётся из UNIT_MAP, а не из названия', () => {
    const res = parseLabResults('Гомоцистеин 1.1 mg/L', 'text');
    const marker = res.extractedMarkers.find(m => m.code === 'Homocysteine');
    expect(marker?.unit).toBe('mg/L');
    expect(marker?.value).toBe(1.1);
  });
});

describe('Автопарсер не создаёт маркеры из единиц измерения', () => {
  it('«Apolipoprotein B 95 60-120 mg/dL» не даёт ложный магний', () => {
    const results = parseProviderAware('Apolipoprotein B 95 60-120 mg/dL');
    expect(results.some(r => r.marker === 'MG')).toBe(false);
  });

  it('настоящий магний «Mg 0.85 0.7-1.0 ммоль/л» остаётся распознанным', () => {
    const results = parseProviderAware('Mg 0.85 0.7-1.0 ммоль/л');
    expect(results.some(r => r.marker === 'MG')).toBe(true);
  });

  it('магний в американских единицах «Mg 1.8 1.7-2.2 mg/dL» не отбрасывается', () => {
    const results = parseProviderAware('Mg 1.8 1.7-2.2 mg/dL');
    expect(results.some(r => r.marker === 'MG')).toBe(true);
  });
});

describe('saveParsedLabs: референс бланка важнее половых норм', () => {
  const lab = (over: Partial<ParsedLabValue>): ParsedLabValue => ({
    code: 'HGB',
    name: 'Гемоглобин',
    value: 140,
    unit: 'g/L',
    ...over,
  });

  it('женская норма проверяет обе границы (раньше — только верхнюю)', async () => {
    await saveParsedLabs([lab({ value: 110 })], 'on_cycle', { sex: 'female' });
    expect(savedLabPoints[0]?.isAbnormal).toBe(true);
  });

  it('значение в пределах женской нормы — норма', async () => {
    await saveParsedLabs([lab({ value: 140 })], 'on_cycle', { sex: 'female' });
    expect(savedLabPoints[0]?.isAbnormal).toBe(false);
  });

  it('диапазон из бланка приоритетнее половой нормы приложения', async () => {
    // 155 г/л выше женского порога 150, но в диапазоне бланка 100–160:
    // импорт обязан сохранить вердикт по диапазону лаборатории.
    await saveParsedLabs([lab({ value: 155, refLow: 100, refHigh: 160, isAbnormal: false })], 'on_cycle', { sex: 'female' });
    expect(savedLabPoints[0]?.isAbnormal).toBe(false);
    expect(savedLabPoints[0]?.refLow).toBe(100);
    expect(savedLabPoints[0]?.refHigh).toBe(160);
  });
});
