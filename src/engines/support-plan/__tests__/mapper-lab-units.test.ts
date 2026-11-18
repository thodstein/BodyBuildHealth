/**
 * mapper-lab-units.test.ts — проход 135: единица бланка доходит до плана поддержки.
 *
 * `labSliceToValues` — единственный переход «бланк → MapperCtx» (мост механизмов,
 * ступени, синергии, противопоказания). В нём стоял `parseFloat`, то есть число
 * приходило в той единице, которую человек выбрал в форме: пролактин 300 мМЕ/л
 * (14.2 нг/мл) читался как 300 нг/мл — «экстренно»; кортизол 15 мкг/дл
 * (414 нмоль/л, норма) — как 15 нмоль/л, то есть «лечение»; витамин D 62 нмоль/л
 * (24.8 нг/мл, недостаточность) — как 62 нг/мл, «норма». Риск-модель при этом
 * читала те же поля правильно (`readLabValue`), потому что там единица учтена.
 */
import { describe, it, expect } from 'vitest';
import { labSliceToValues } from '../mapper-ctx';
import { deriveTier } from '../../../data/lab-tier-ranges';

const slice = (panel: string, values: Record<string, string>, units?: Record<string, string>) =>
  ({ [panel]: values, units: units ? { [panel]: units } : undefined } as any);

describe('проход 135: единицы бланка в MapperCtx', () => {
  it('пролактин 300 мМЕ/л — это 14.2 нг/мл, и ступень норма (а не «экстренно»)', () => {
    const labs = labSliceToValues(slice('panelSex', { Prolactin: '300' }, { Prolactin: 'мМЕ/л' }));
    expect(labs['PROLACTIN']).toBeCloseTo(14.2, 1);
    expect(deriveTier('PROLACTIN', labs['PROLACTIN']!)).toBe(0);
    // Сырое число давало высшую ступень: 300 «нг/мл» — это emergencyHigh 50.
    expect(deriveTier('PROLACTIN', 300)).toBe(3);
  });

  it('эстрадиол 150 пмоль/л — это 40.9 пг/мл', () => {
    const labs = labSliceToValues(slice('panelSex', { E2: '150' }, { E2: 'пмоль/л' }));
    expect(labs['ESTRADIOL']).toBeCloseTo(40.9, 1);
  });

  it('тестостерон 550 нг/дл — это 19.1 нмоль/л (шкала ступеней — нмоль/л)', () => {
    const labs = labSliceToValues(slice('panelSex', { 'Total T': '550' }, { 'Total T': 'нг/дл' }));
    expect(labs['TESTOSTERONE']).toBeCloseTo(19.1, 1);
    // Low-ступень работает: 250 нг/дл = 8.7 нмоль/л — «лечение» (5–10), а не норма.
    const lowLabs = labSliceToValues(slice('panelSex', { 'Total T': '250' }, { 'Total T': 'нг/дл' }));
    expect(deriveTier('TESTOSTERONE', lowLabs['TESTOSTERONE']!)).toBe(2);
  });

  it('кортизол 15 мкг/дл — это 413.9 нмоль/л', () => {
    const labs = labSliceToValues(slice('panelSex', { Cortisol: '15' }, { Cortisol: 'мкг/дл' }));
    expect(labs['CORTISOL']).toBeCloseTo(413.9, 1);
    // Без пересчёта те же 15 — это уровень Аддисона, а не «норма с низу шкалы»:
    // мост механизмов (`cns4`) считает кортизол от 100 нмоль/л.
  });

  it('витамин D 62 нмоль/л — это 24.8 нг/мл (недостаточность, а не норма)', () => {
    const labs = labSliceToValues(
      slice('panelVitamin', { 'Vitamin D (25-OH)': '62' }, { 'Vitamin D (25-OH)': 'нмоль/л' }),
    );
    expect(labs['VITAMIN_D']).toBeCloseTo(24.8, 1);
    expect(deriveTier('VITAMIN_D', labs['VITAMIN_D']!)).toBe(1);
    expect(deriveTier('VITAMIN_D', 62)).toBe(0);
  });

  it('Т3 свободный 3.0 пг/мл — это 4.6 пмоль/л', () => {
    const labs = labSliceToValues(slice('panelThyroid', { 'T3 free': '3.0' }, { 'T3 free': 'пг/мл' }));
    expect(labs['T3_FREE']).toBeCloseTo(4.6, 1);
  });

  it('B12 300 пмоль/л — это 406.6 пг/мл', () => {
    const labs = labSliceToValues(slice('panelVitamin', { B12: '300' }, { B12: 'пмоль/л' }));
    expect(labs['B12']).toBeCloseTo(406.6, 1);
  });

  it('белок мочи 300 мг/л — это 0.3 г/л, ступень «внимание», а не «экстренно»', () => {
    const labs = labSliceToValues(slice('panelUrinalysis', { Protein: '300' }, { Protein: 'мг/л' }));
    expect(labs['PROTEIN']).toBeCloseTo(0.3, 3);
    expect(deriveTier('PROTEIN_URINE', 300)).toBe(3);
    expect(deriveTier('PROTEIN_URINE', labs['PROTEIN']!)).toBe(1);
  });

  it('без единицы — прежняя догадка по величине, а не сырое число', () => {
    const labs = labSliceToValues(slice('panelSex', { Prolactin: '300', 'Total T': '550' }));
    expect(labs['PROLACTIN']).toBeCloseTo(14.2, 1);
    expect(labs['TESTOSTERONE']).toBeCloseTo(19.1, 1);
    // А значение, которое уже в каноне, не трогается.
    const plain = labSliceToValues(slice('panelSex', { Prolactin: '12', 'Total T': '20' }));
    expect(plain['PROLACTIN']).toBe(12);
    expect(plain['TESTOSTERONE']).toBe(20);
  });

  it('граница «>1000» остаётся числом, полоска «1+» — нет', () => {
    const labs = labSliceToValues(slice('panelSex', { 'Total T': '>1000' }, { 'Total T': 'нг/дл' }));
    expect(labs['TESTOSTERONE']).toBeCloseTo(34.7, 1);
    const strip = labSliceToValues(slice('panelUrinalysis', { Protein: '1+' }));
    expect(strip['PROTEIN']).toBeUndefined();
  });

  it('у маркеров без выбора единицы число не меняется', () => {
    const labs = labSliceToValues(slice('panelHematology', { HCT: '52', Hemoglobin: '175' }));
    expect(labs['HEMATOCRIT']).toBe(52);
    expect(labs['HEMOGLOBIN']).toBe(175);
  });
});
