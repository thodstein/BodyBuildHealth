/**
 * lab-points-import.test.ts — проход 111: импорт анализов говорит на языке бланка.
 *
 * Раньше `labPointsToSlice` писал значение под тем кодом, который пришёл
 * (`PRL`, `HEMOGLOBIN`, `DHEA_S`), а форма и движок читают имена бланка
 * (`Prolactin`, `Hemoglobin`, `DHEA-S`). Часть кодов вообще не находилась —
 * пролактин и тестостерон из дневника или OCR пропадали целиком, а «анализы
 * подставлены» всё равно показывалось. Единицу бланка импорт тоже выбрасывал,
 * хотя она была в данных.
 */
import { describe, it, expect } from 'vitest';
import { labPointsToSlice, sliceMarkerFor } from '../Calc.labs-derived';

const point = (code: string, value: number | string, unit?: string) =>
  labPointsToSlice([{ code, value, unit, date: '2026-11-01' }]);

describe('проход 111: код анализа → имя маркера бланка', () => {
  it('пролактин и тестостерон больше не теряются', () => {
    const s = point('PRL', 15, 'ng/mL')!;
    expect(s, 'импорт вернул null').not.toBeNull();
    expect(s.panelSex!.Prolactin).toBe('15');
    expect(s.units!.panelSex.Prolactin).toBe('нг/мл');

    const t = point('TT', 600, 'ng/dL')!;
    expect(t.panelSex!['Total T']).toBe('600');
    expect(t.units!.panelSex['Total T']).toBe('нг/дл');
  });

  it('гемоглобин, ДГЭА-С и Е2 ложатся под имена бланка', () => {
    expect(point('HGB', 150, 'g/L')!.panelHematology!.Hemoglobin).toBe('150');
    expect(point('HEMOGLOBIN', 150)!.panelHematology!.Hemoglobin).toBe('150');

    const d = point('DHEA_S', 250, 'ug/dL')!;
    expect(d.panelAdrenal!['DHEA-S']).toBe('250');
    expect(d.units!.panelAdrenal['DHEA-S']).toBe('мкг/дл');

    // Русское название из бланка — через общий резолвер, а не по таблице кодов.
    const e = point('Эстрадиол', 500, 'pg/mL')!;
    expect(e.panelSex!.E2).toBe('500');
    expect(e.units!.panelSex.E2).toBe('пг/мл');
  });

  it('глюкоза — биохимия, а не анализ мочи', () => {
    const s = point('GLU', 5.6)!;
    expect(s.panelBiochem!.Glucose).toBe('5.6');
    expect(s.panelUrinalysis!.Glucose).toBeUndefined();
  });

  it('моча остаётся мочой: GLUCOSE_URINE не занимает место кровяной', () => {
    const s = point('GLUCOSE_URINE', 2.8)!;
    expect(s.panelUrinalysis!.Glucose).toBe('2.8');
    expect(s.panelBiochem!.Glucose).toBeUndefined();
  });

  it('незнакомая единица не подменяется', () => {
    const s = point('E2', 500, 'г/л')!;
    expect(s.panelSex!.E2).toBe('500');
    expect(s.units?.panelSex?.E2).toBeUndefined();
  });

  it('нераспознанные коды не делают вид, что бланк заполнен', () => {
    expect(labPointsToSlice([{ code: 'НЕИЗВЕСТНО', value: 1, date: '2026-11-01' }])).toBeNull();
    const mixed = labPointsToSlice([{ code: 'НЕИЗВЕСТНО', value: 1 }, { code: 'ALT', value: 45 }])!;
    expect(mixed.panelBiochem!.ALT).toBe('45');
  });

  it('дневник лаборатории: те же коды и единицы', () => {
    const s = labPointsToSlice({
      date: '2026-09-20',
      markers: [
        { code: 'PRL', name: 'Пролактин', value: 318, unit: 'mIU/L', inRange: false },
        { code: 'HCT', value: 52, unit: '%' },
      ],
    })!;
    expect(s.panelSex!.Prolactin).toBe('318');
    expect(s.units!.panelSex.Prolactin).toBe('мМЕ/л');
    expect(s.panelHematology!.HCT).toBe('52');
  });

  it('sliceMarkerFor узнаёт имена бланка без таблицы кодов', () => {
    expect(sliceMarkerFor('Total T')).toBe('Total T');
    expect(sliceMarkerFor('prolactin')).toBe('Prolactin');
    expect(sliceMarkerFor('TSH')).toBe('TSH');
    expect(sliceMarkerFor('')).toBeNull();
  });
});
