/**
 * lab-deltas-trend.test.ts — проход 137: динамика анализов сравнивает то, что можно
 * сравнивать.
 *
 * Было три дефекта одного класса:
 *  - маркеры искались только в 4 панелях из 14: липиды, железо, витамины, коагуляция,
 *    моча в динамику не попадали вовсе;
 *  - значения брались сырыми строками: `Number('>1000')` → NaN, `Number('5,4')` → NaN,
 *    а разные единицы одного анализа (тестостерон нмоль/л и нг/дл) сравнивались
 *    напрямую — 550 против 20 выглядело ростом;
 *  - тренд решался по абсолютной разнице (|Δ| > 20) и любой рост назывался
 *    «ухудшением» — даже рост тестостерона/витамина D/ферритина, где хуже снижение.
 */
import { describe, it, expect } from 'vitest';
import { calcLabDeltas, type LabDelta } from '../engine-helpers';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

const slice = (panel: string, values: Record<string, string>, units?: Record<string, string>) =>
  ({ [panel]: values, date: '2026-10-01', units: units ? { [panel]: units } : undefined } as any);

const state = (pre: any, mid: any, post?: any, sex: 'male' | 'female' = 'male') => ({
  ...DEFAULT_STATE,
  profile: { ...DEFAULT_STATE.profile, sex },
  labs: { preCourse: pre, midCourse: mid, postPCT: post ?? null, fullPanel: null },
} as any);

const row = (deltas: LabDelta[], marker: string) => deltas.find((d) => d.marker === marker);

describe('проход 137: динамика анализов — единицы и направление', () => {
  it('разные единицы одного анализа не выглядят ростом', () => {
    const d = calcLabDeltas(state(
      slice('panelSex', { 'Total T': '20' }),
      slice('panelSex', { 'Total T': '550' }, { 'Total T': 'нг/дл' }),
    ));
    const tt = row(d, 'Total T')!;
    // 20 нмоль/л и 550 нг/дл — это одно и то же (19.1): сравнение в каноне.
    expect(tt.sliceValues[0]).toBe('20');
    expect(tt.sliceValues[1]).toBe('19.1');
    expect(tt.trend).toBe('stable');
    expect(tt.unit).toBe('nmol/L');
  });

  it('снижение тестостерона — ухудшение, рост — улучшение (шкала «ниже — хуже»)', () => {
    const down = calcLabDeltas(state(
      slice('panelSex', { 'Total T': '20' }),
      slice('panelSex', { 'Total T': '12' }),
    ));
    expect(row(down, 'Total T')!.trend).toBe('worsening');

    const up = calcLabDeltas(state(
      slice('panelSex', { 'Total T': '12' }),
      slice('panelSex', { 'Total T': '20' }),
    ));
    expect(row(up, 'Total T')!.trend).toBe('improving');
  });

  it('рост гематокрита — ухудшение, сильный рост — критическое', () => {
    const d = calcLabDeltas(state(
      slice('panelHematology', { HCT: '40' }),
      slice('panelHematology', { HCT: '62' }),
    ));
    expect(row(d, 'HCT')!.trend).toBe('critical');
  });

  it('B12 ниже нормы — ухудшение (шкала «ниже — хуже»)', () => {
    const d = calcLabDeltas(state(
      slice('panelVitamin', { B12: '250' }),
      slice('panelVitamin', { B12: '150' }),
    ));
    expect(row(d, 'B12')!.trend).toBe('worsening');
  });

  it('граница «>1000» читается числом, а не NaN', () => {
    const d = calcLabDeltas(state(
      slice('panelIron', { Ferritin: '>1000' }),
      slice('panelIron', { Ferritin: '300' }),
    ));
    const ferritin = row(d, 'Ferritin')!;
    expect(ferritin.sliceValues.slice(0, 2)).toEqual(['>1000', '300']);
    expect(ferritin.sliceValues[2]).toBeUndefined();
    // Ферритин — «оба конца плохо»: 1000 вне нормы, 300 в норме (30–400) → улучшение.
    expect(ferritin.trend).toBe('improving');
    expect(ferritin.sliceValues.some((v) => (v || '').includes('NaN'))).toBe(false);
  });

  it('липиды теперь попадают в динамику (раньше панель не читалась)', () => {
    const d = calcLabDeltas(state(
      slice('panelLipid', { LDL: '3' }),
      slice('panelLipid', { LDL: '4' }),
    ));
    expect(row(d, 'LDL')?.trend).toBe('worsening');
  });

  it('оба значения в норме — «стабильно», даже если процент вырос', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { ALT: '25' }),
      slice('panelBiochem', { ALT: '30' }),
    ));
    expect(row(d, 'ALT')!.trend).toBe('stable');
  });

  it('нет шкалы — честное «изменился», а не «ухудшение»', () => {
    const d = calcLabDeltas(state(
      slice('panelAdrenal', { Renin: '2' }),
      slice('panelAdrenal', { Renin: '5' }),
    ));
    expect(row(d, 'Renin')!.trend).toBe('changed');
    expect(row(d, 'Renin')!.unit).toBeUndefined();
  });

  it('было 0 — изменение видно, но «критическим» не называется', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { CRP: '0' }),
      slice('panelBiochem', { CRP: '12' }),
    ));
    expect(row(d, 'CRP')!.trend).toBe('worsening');
  });

  it('текстовое «отр.» не превращается в строку «—→—»', () => {
    const d = calcLabDeltas(state(
      slice('panelUrinalysis', { Nitrite: 'отр.' }),
      slice('panelUrinalysis', { Nitrite: 'положит.' }),
    ));
    expect(row(d, 'Nitrite')).toBeUndefined();
  });

  it('полоска «1+» числом не считается и в динамику не попадает', () => {
    const d = calcLabDeltas(state(
      slice('panelUrinalysis', { Protein: '1+' }),
      slice('panelUrinalysis', { Protein: '0.3' }, { Protein: 'г/л' }),
    ));
    const p = row(d, 'Protein')!;
    expect(p.sliceValues[0]).toBeUndefined();
    expect(p.sliceValues[1]).toBe('0.3');
    expect(p.trend).toBe('stable');
  });
});
