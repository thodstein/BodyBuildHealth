/**
 * lab-deltas-bound.test.ts — проход 156: динамика калькулятора не выдаёт границу
 * бланка за измерение.
 *
 * Проход 137 научил динамику читать «>1000» числом, но число за границей — не
 * измерение: «>1000 → 2000» называлось «ухудшением», хотя прошлое могло быть и
 * 5000. Теперь сторона изменения берётся из `boundsOrder` (пересекаются ли
 * интервалы записей), а разность/процент и «критическое» — только у двух точных
 * чисел. Не доказано — `unproven`, а не «стабильно» и не зелёная галочка.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calcLabDeltas, type LabDelta } from '../engine-helpers';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

const slice = (panel: string, values: Record<string, string>, units?: Record<string, string>) =>
  ({ [panel]: values, date: '2026-10-01', units: units ? { [panel]: units } : undefined } as any);

const state = (pre: any, mid: any, post?: any) => ({
  ...DEFAULT_STATE,
  labs: { preCourse: pre, midCourse: mid, postPCT: post ?? null, fullPanel: null },
} as any);

const row = (deltas: LabDelta[], marker: string) => deltas.find((d) => d.marker === marker);

describe('проход 156: сторону динамики доказывают сами записи', () => {
  it('«>1000 → 300» — улучшение: прошлое больше 1000, нынешнее ровно 300', () => {
    const d = calcLabDeltas(state(
      slice('panelIron', { Ferritin: '>1000' }),
      slice('panelIron', { Ferritin: '300' }),
    ));
    const f = row(d, 'Ferritin')!;
    expect(f.sliceValues.slice(0, 2)).toEqual(['>1000', '300']);
    expect(f.trend).toBe('improving');
  });

  it('«>1000 → 2000» — без вывода, а не «ухудшение»', () => {
    const d = calcLabDeltas(state(
      slice('panelIron', { Ferritin: '>1000' }),
      slice('panelIron', { Ferritin: '2000' }),
    ));
    const f = row(d, 'Ferritin')!;
    expect(f.trend).toBe('unproven');
    // Ни в «ухудшение», ни в «критические» такая строка не попадает.
    expect(f.trend).not.toBe('worsening');
    expect(f.trend).not.toBe('critical');
  });

  it('«<0.5 → 3» — ухудшение по шкале СРБ, но величина не доказана', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { CRP: '<0.5' }),
      slice('panelBiochem', { CRP: '3' }),
    ));
    const c = row(d, 'CRP')!;
    expect(c.trend).toBe('worsening');
    expect(c.trend).not.toBe('critical');
  });

  it('«<0.5 → <0.6» — без вывода: интервалы пересекаются', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { CRP: '<0.5' }),
      slice('panelBiochem', { CRP: '<0.6' }),
    ));
    expect(row(d, 'CRP')!.trend).toBe('unproven');
  });

  it('«>100 → 40» — улучшение по шкале «выше — хуже»', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { ALT: '>100' }),
      slice('panelBiochem', { ALT: '40' }),
    ));
    expect(row(d, 'ALT')!.trend).toBe('improving');
  });

  it('«>100 → 200» — без вывода: прошлое может быть и 500', () => {
    const d = calcLabDeltas(state(
      slice('panelBiochem', { ALT: '>100' }),
      slice('panelBiochem', { ALT: '200' }),
    ));
    expect(row(d, 'ALT')!.trend).toBe('unproven');
  });

  it('«>300 → 150» у B12 (шкала «ниже — хуже») — ухудшение', () => {
    const d = calcLabDeltas(state(
      slice('panelVitamin', { B12: '>300' }),
      slice('panelVitamin', { B12: '150' }),
    ));
    expect(row(d, 'B12')!.trend).toBe('worsening');
  });

  it('без шкалы доказанное изменение — «изменился», недоказанное — «без вывода»', () => {
    const proven = calcLabDeltas(state(
      slice('panelAdrenal', { Renin: '>5' }),
      slice('panelAdrenal', { Renin: '2' }),
    ));
    expect(row(proven, 'Renin')!.trend).toBe('changed');

    const open = calcLabDeltas(state(
      slice('panelAdrenal', { Renin: '>5' }),
      slice('panelAdrenal', { Renin: '7' }),
    ));
    expect(row(open, 'Renin')!.trend).toBe('unproven');
  });
});

describe('проход 156: знак печатает то же чтение, что и расчёт', () => {
  it('«≥1000» в карточке печатается как «>1000»', () => {
    const d = calcLabDeltas(state(
      slice('panelIron', { Ferritin: '≥1000' }),
      slice('panelIron', { Ferritin: '300' }),
    ));
    expect(row(d, 'Ferritin')!.sliceValues[0]).toBe('>1000');
  });

  it('в движке одно чтение поля и одно правило направления', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine-helpers.ts'), 'utf8');
    expect(src).toContain('labFieldEntry(raw)');
    expect(src).toContain('boundsOrder({ value: first, bound: firstBound }');
    expect(src).toContain('boundsComparable(firstBound, lastBound)');
    // Своего разбора знака из строки больше нет — иначе правило чтения раздвоится.
    expect(src).not.toMatch(/\/\^\[<>≤≥\]\//);
    expect(src).not.toContain("replace('≤', '<')");
  });
});
