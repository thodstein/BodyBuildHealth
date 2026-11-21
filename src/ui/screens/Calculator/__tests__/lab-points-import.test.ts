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
import { labPointsToSlice, labImportNoteLine, sliceMarkerFor } from '../Calc.labs-derived';
import type { LabImportNote } from '../Calc.labs-derived';
import { FULL_PANELS, labUnitHint } from '../Calc.lab';
import { LAB_UNIT_CHOICES, UCUM_MAP, readLabValue } from '../../../../core/constants';
import { MARKER_TO_UCUM, markerReadUnit } from '../Calc.lab-units';

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

/**
 * Проход 112: импорт приводил число, но не единицу. Гемоглобин 15 г/дл из FHIR
 * или дневника ложился как «15» в поле, где норма 130–170 г/л — нормальный бланк
 * читался как тяжёлая анемия. Креатинин 1.0 мг/дл становился 1.0 мкмоль/л, ЛПНП
 * 130 мг/дл — 130 ммоль/л (норма «в 40 раз хуже нормы»), и так далее.
 */
describe('проход 112: единица импорта приводится к единице приложения', () => {
  it('гемоглобин 15 г/дл становится 150 г/л', () => {
    expect(point('HGB', 15, 'g/dL')!.panelHematology!.Hemoglobin).toBe('150');
    expect(point('HEMOGLOBIN', 15, 'г/дл')!.panelHematology!.Hemoglobin).toBe('150');
  });

  it('креатинин, глюкоза, ЛПНП и СРП из мг/дл', () => {
    expect(Number(point('CREATININE', 1, 'mg/dL')!.panelBiochem!.Creatinine)).toBeCloseTo(88.42, 1);
    expect(Number(point('GLU', 90, 'mg/dL')!.panelBiochem!.Glucose)).toBeCloseTo(4.995, 2);
    expect(Number(point('LDL', 130, 'mg/dL')!.panelLipid!.LDL)).toBeCloseTo(3.362, 2);
    expect(Number(point('CRP', 0.5, 'mg/dL')!.panelBiochem!.CRP)).toBeCloseTo(5, 2);
  });

  it('витамин D остаётся в единице бланка: пересчёт делает чтение', () => {
    // проход 121: у витамина D появился выбор единицы, поэтому импорт не
    // пересчитывает число, а несёт единицу бланка (как у гормонов): 62 нмоль/л
    // прочитается как 24.8 нг/мл.
    const d = point('VITD', 62, 'nmol/L')!;
    expect(Number(d.panelVitamin!['Vitamin D (25-OH)'])).toBe(62);
    expect(d.units!.panelVitamin!['Vitamin D (25-OH)']).toBe('нмоль/л');
    expect(Number(point('IRON', 80, 'ug/dL')!.panelIron!.Iron)).toBeCloseTo(14.33, 1);
  });

  it('единица уже та — число не меняется', () => {
    expect(point('HGB', 150, 'g/L')!.panelHematology!.Hemoglobin).toBe('150');
    expect(point('GLU', 5.5, 'mmol/L')!.panelBiochem!.Glucose).toBe('5.5');
    expect(point('HCT', 45, '%')!.panelHematology!.HCT).toBe('45');
  });

  it('гормоны не пересчитываются на импорте: единица бланка остаётся в данных', () => {
    const e = point('E2', 1800, 'pmol/L')!;
    expect(e.panelSex!.E2).toBe('1800');
    expect(e.units!.panelSex.E2).toBe('пмоль/л');
    const p = point('PRL', 318, 'mIU/L')!;
    expect(p.panelSex!.Prolactin).toBe('318');
    expect(p.units!.panelSex.Prolactin).toBe('мМЕ/л');
  });

  it('в таблице пересчёта только настоящие маркеры бланка', () => {
    const markers = new Set(FULL_PANELS.flatMap(p => p.markers));
    for (const marker of Object.keys(MARKER_TO_UCUM)) {
      expect(markers.has(marker), `${marker} нет в форме — опечатка выключит пересчёт`).toBe(true);
      expect(LAB_UNIT_CHOICES[marker], `${marker}: у гормонов с выбором единицы пересчёт делает чтение`).toBeUndefined();
      expect(UCUM_MAP[MARKER_TO_UCUM[marker]]?.prefUnit, `${marker}: кода ${MARKER_TO_UCUM[marker]} нет в каталоге UCUM`).toBeTruthy();
      expect(markerReadUnit(marker), `${marker}: нет подсказки единицы`).toBeTruthy();
    }
  });
});

/**
 * Проход 114: форма не говорила, в какой единице ждёт число. Человек вписывал
 * 15 г/дл гемоглобина в поле, где норма 130–170 г/л, — и получал анемию из
 * воздуха. Теперь единица стоит подсказкой в самом поле; у гормонов с выбором
 * единицы подсказки нет — рядом `UnitPicker`.
 */
describe('проход 114: подсказка единицы в форме', () => {
  it('подсказка — та же единица, в которую импорт приводит значение', () => {
    expect(labUnitHint('Hemoglobin')).toBe('г/л');
    expect(labUnitHint('Creatinine')).toBe('мкмоль/л');
    expect(labUnitHint('Glucose')).toBe('ммоль/л');
    expect(labUnitHint('LDL')).toBe('ммоль/л');
    expect(labUnitHint('Platelets')).toBe('10⁹/л');
  });

  it('у гормонов с выбором единицы подсказки нет — там UnitPicker', () => {
    expect(labUnitHint('E2')).toBeUndefined();
    expect(labUnitHint('Total T')).toBeUndefined();
    expect(labUnitHint('Prolactin')).toBeUndefined();
  });
});

/**
 * Проход 196: ретикулоциты.
 *
 * Шкала `RETIC_BAND` и советы `TIER_RULES.RETICULOCYTES` были, а ввести число
 * было некуда: поля в бланке нет, код склада не находил маркера. При этом бланк
 * печатает ретикулоциты и в процентах, и в промилле, и в абсолютных 10⁹/л.
 * Первые две — одна величина (1 % = 10 ‰); третья без числа эритроцитов в
 * проценты не переводится, и занимать ею поле процентов нельзя: 50 10⁹/л
 * читались бы как 50 % (риск «лечения» из воздуха).
 */
describe('проход 196: ретикулоциты — проценты и промилле, без абсолютного числа', () => {
  it('код склада находит поле «Гематологии»', () => {
    const s = point('RETICULOCYTES', 1.2, '%')!;
    expect(s.panelHematology!.Reticulocytes).toBe('1.2');
    expect(s.units!.panelHematology.Reticulocytes).toBe('%');
    expect(sliceMarkerFor('RETIC')).toBe('Reticulocytes');
    expect(sliceMarkerFor('Ретикулоциты')).toBe('Reticulocytes');
  });

  it('промилле едут вместе с числом — в проценты их переводит чтение', () => {
    const s = point('RETIC', 6.8, '‰')!;
    expect(s.panelHematology!.Reticulocytes).toBe('6.8');
    expect(s.units!.panelHematology.Reticulocytes).toBe('‰');
    expect(readLabValue('Reticulocytes', 6.8, '‰')).toEqual({ value: 0.68, guessed: false });
    expect(readLabValue('Reticulocytes', 0.68, '%')).toEqual({ value: 0.68, guessed: false });
  });

  it('абсолютное 10⁹/л не становится процентами и называется в отчёте', () => {
    const skipped: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л', date: '2026-11-01' },
    ], skipped);
    expect(s).toBeNull();
    expect(skipped).toEqual([
      { code: 'RETICULOCYTES', label: 'Ретикулоциты', value: '50', unit: '10⁹/л', reason: 'unit' },
    ]);
    expect(labImportNoteLine(skipped)).toBe(
      'не перенесено 1: Ретикулоциты 50 10⁹/л — единица другой величины',
    );
  });

  it('поле есть в форме, единица выбирается рядом (не подсказкой)', () => {
    expect(FULL_PANELS.flatMap(p => p.markers)).toContain('Reticulocytes');
    expect(LAB_UNIT_CHOICES['Reticulocytes']).toEqual(['%', '‰']);
    // У маркеров с выбором единицы подсказки нет — её заменяет UnitPicker.
    expect(labUnitHint('Reticulocytes')).toBeUndefined();
  });

  it('анализ каталога без поля в бланке больше не исчезает молча', () => {
    const skipped: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'MCV', value: 88, unit: 'fL', date: '2026-11-01' },
    ], skipped);
    expect(s).toBeNull();
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('marker');
    expect(skipped[0].label).toBe('Средний объём эритроцита');
    expect(labImportNoteLine(skipped)).toMatch(/нет поля в бланке/);
  });

  it('одна запись из двух источников не задваивает счёт', () => {
    const row = { code: 'MCV', value: 88, unit: 'fL' };
    const skipped: LabImportNote[] = [];
    labPointsToSlice([row], skipped);
    labPointsToSlice([row], skipped);
    expect(labImportNoteLine(skipped)).toMatch(/не перенесено 1:/);
  });
});

/**
 * Проход 197: абсолютные ретикулоциты.
 *
 * `RET#` в 10⁹/л — та же величина, что процент, но перевести её можно только по
 * числу эритроцитов того же бланка: `% = RET# / (RBC × 10)`. В 196-м такая
 * запись честно отбрасывалась; теперь она пересчитывается, но не молча — статус
 * говорит «пересчитано по эритроцитам». Эритроциты с другой даты парой не
 * считаются: пересчёт по чужому бланку такой же вымысел, как число без RBC.
 */
describe('проход 197: абсолютные ретикулоциты — только по эритроцитам того же бланка', () => {
  it('50 10⁹/л при RBC 5.0 10¹²/л — это 1 %, и отчёт это называет', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л', date: '2026-11-01' },
      { code: 'RBC', value: 5.0, unit: '10¹²/л', date: '2026-11-01' },
    ], notes)!;
    expect(s.panelHematology!.Reticulocytes).toBe('1');
    expect(s.units!.panelHematology.Reticulocytes).toBe('%');
    expect(s.panelHematology!.RBC).toBe('5');
    expect(notes).toEqual([
      {
        code: 'RETICULOCYTES', label: 'Ретикулоциты', value: '50', unit: '10⁹/л',
        computed: '1', reason: 'derived',
      },
    ]);
    expect(labImportNoteLine(notes)).toBe(
      'пересчитано 1: Ретикулоциты 50 10⁹/л — пересчитано по эритроцитам (1 %)',
    );
  });

  it('латинское 10^9/L читается так же, как надстрочное', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RET', value: 60, unit: '10^9/L', date: '2026-11-01' },
      { code: 'RBC', value: 5.0, unit: '10^12/L', date: '2026-11-01' },
    ], notes)!;
    expect(s.panelHematology!.Reticulocytes).toBe('1.2');
    expect(notes[0].computed).toBe('1.2');
  });

  it('дневник: пара ищется среди маркеров той же записи', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice({
      date: '2026-09-20',
      markers: [
        { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л' },
        { code: 'RBC', value: 5.0, unit: '10¹²/л' },
      ],
    }, notes)!;
    expect(s.panelHematology!.Reticulocytes).toBe('1');
    expect(notes[0].reason).toBe('derived');
  });

  it('без эритроцитов число не превращается в проценты', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л', date: '2026-11-01' },
    ], notes);
    expect(s).toBeNull();
    expect(notes).toEqual([
      { code: 'RETICULOCYTES', label: 'Ретикулоциты', value: '50', unit: '10⁹/л', reason: 'unit' },
    ]);
  });

  it('эритроциты другой даты — не пара', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RETICULOCYTES', value: 50, unit: '10⁹/л', date: '2026-11-01' },
      { code: 'RBC', value: 5.0, unit: '10¹²/л', date: '2026-10-01' },
    ], notes)!;
    expect(s.panelHematology!.Reticulocytes).toBeUndefined();
    expect(notes.map((n) => n.reason)).toEqual(['unit']);
  });

  it('результат вне 0–100 % — не результат анализа: формулы из воздуха нет', () => {
    const notes: LabImportNote[] = [];
    const s = labPointsToSlice([
      { code: 'RETICULOCYTES', value: 6000, unit: '10⁹/л', date: '2026-11-01' },
      { code: 'RBC', value: 5.0, unit: '10¹²/л', date: '2026-11-01' },
    ], notes)!;
    // Эритроциты в бланк легли, ретикулоциты — нет: 120 % не бывает.
    expect(s.panelHematology!.RBC).toBe('5');
    expect(s.panelHematology!.Reticulocytes).toBeUndefined();
    expect(notes).toEqual([
      { code: 'RETICULOCYTES', label: 'Ретикулоциты', value: '6000', unit: '10⁹/л', reason: 'unit' },
    ]);
  });
});
