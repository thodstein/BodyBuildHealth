/**
 * lab-marker-risks.test.ts — проход 147: отклонения маркеров не считают
 * обрезанное число измерением и не выдают неизвестное за норму.
 *
 * Ферритин: норма 30–300 (UCUM_MAP, мужская), единица приложения ug/L.
 */
import { describe, it, expect } from 'vitest';
import { computeMarkerDeviations } from '../lab-marker-risks';

const ferritin = (value: number, extra: Record<string, unknown> = {}) => ({
  code: 'FERRITIN', name: 'Ферритин', value, ...extra,
});

describe('проход 147: точные числа', () => {
  it('выход за верхнюю границу — процент как раньше', () => {
    const r = computeMarkerDeviations([ferritin(600)], 'male');
    expect(r.markerDeviations).toHaveLength(1);
    expect(r.markerDeviations[0]).toMatchObject({ side: 'high', deviation: 100, bound: undefined });
    expect(r.unknownCount).toBe(0);
    expect(r.normalCount).toBe(0);
  });

  it('внутри нормы — норма, без отклонения', () => {
    const r = computeMarkerDeviations([ferritin(200)], 'male');
    expect(r.markerDeviations).toHaveLength(0);
    expect(r.normalCount).toBe(1);
    expect(r.unknownCount).toBe(0);
  });
});

describe('проход 147: граница', () => {
  it('«>1000» при верхней 300 — сторона доказана, процента нет', () => {
    const r = computeMarkerDeviations([ferritin(1000, { bound: '>' })], 'male');
    expect(r.markerDeviations).toHaveLength(1);
    expect(r.markerDeviations[0]).toMatchObject({ side: 'high', deviation: null, bound: '>' });
    // Не «норма» и не «без вывода»: отклонение доказано.
    expect(r.normalCount).toBe(0);
    expect(r.unknownCount).toBe(0);
  });

  it('«>5» при верхней 300 — стороны нет, это «без вывода»', () => {
    const r = computeMarkerDeviations([ferritin(5, { bound: '>' })], 'male');
    expect(r.markerDeviations).toHaveLength(0);
    expect(r.normalCount).toBe(0);
    expect(r.unknownCount).toBe(1);
  });

  it('«<20» при нижней 30 — сторона доказана, процента нет', () => {
    const r = computeMarkerDeviations([ferritin(20, { bound: '<' })], 'male');
    expect(r.markerDeviations[0]).toMatchObject({ side: 'low', deviation: null });
  });

  it('«<500» при верхней 300 — стороны нет', () => {
    const r = computeMarkerDeviations([ferritin(500, { bound: '<' })], 'male');
    expect(r.markerDeviations).toHaveLength(0);
    expect(r.unknownCount).toBe(1);
  });
});

describe('проход 147: порядок и неизвестные маркеры', () => {
  it('точные отклонения раньше обрезанных', () => {
    const r = computeMarkerDeviations([
      ferritin(1000, { bound: '>' }),
      { code: 'ALT', value: 120 },
    ], 'male');
    expect(r.markerDeviations.map(m => m.code)).toEqual(['ALT', 'FERRITIN']);
    expect(r.markerDeviations[0].deviation).toBe(200);
    expect(r.markerDeviations[1].deviation).toBeNull();
  });

  it('маркер без нормы — «без вывода», а не норма', () => {
    const r = computeMarkerDeviations([{ code: 'ZZZ_UNKNOWN', value: 1 }], 'male');
    expect(r.markerDeviations).toHaveLength(0);
    expect(r.normalCount).toBe(0);
    expect(r.unknownCount).toBe(1);
  });
});

describe('проход 154: без вывода называется записью, а не счётчиком', () => {
  it('«<500» при верхней 300 — в списке unknown с причиной «bound»', () => {
    const r = computeMarkerDeviations([ferritin(500, { bound: '<' })], 'male');
    expect(r.unknown).toEqual([{ code: 'FERRITIN', value: 500, bound: '<', reason: 'bound' }]);
    expect(r.unknown).toHaveLength(r.unknownCount);
  });

  it('маркер без нормы — причина «no_norm»', () => {
    const r = computeMarkerDeviations([{ code: 'ZZZ_UNKNOWN', value: 1 }], 'male');
    expect(r.unknown).toEqual([{ code: 'ZZZ_UNKNOWN', value: 1, bound: undefined, reason: 'no_norm' }]);
  });

  it('доказанная норма попадает в normalCodes', () => {
    const r = computeMarkerDeviations([ferritin(200)], 'male');
    expect(r.normalCodes).toEqual(['FERRITIN']);
    expect(r.unknown).toEqual([]);
  });

  it('доказанное отклонение в unknown не попадает', () => {
    const r = computeMarkerDeviations([ferritin(1000, { bound: '>' })], 'male');
    expect(r.unknown).toEqual([]);
    expect(r.normalCodes).toEqual([]);
  });
});
