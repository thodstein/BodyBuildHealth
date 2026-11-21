/**
 * lab-index-single-scale.test.ts — проход 194: один набор анализов — одно число.
 *
 * До прохода 194 «воспаление», «стресс печени» и «стресс почек» считались двумя
 * формулами в двух движках: `labs-indices` брал взвешенное среднее долей нормы
 * (СРБ 0.6 + ферритин 0.4; АЛТ 0.3 + АСТ 0.25 + ГГТ 0.2 + билирубин 0.15 + ЩФ 0.1),
 * `lab-analysis` — сумму «СРБ + ферритин/100» и среднее трансаминаз в долях ВГН.
 * Нормальный АЛТ 30 при ВГН 40 читался как «Проблемы» (0.667), а риск-модель по
 * тому же числу ставила ступень 0.
 *
 * Теперь ступень берёт главная модель (`getMiLabStep`), и обе поверхности печатают
 * одну шкалу: 0 / 33 / 67 / 100. Здесь проверяется, что числа совпадают и что
 * правила чтения — модельные, а не свои:
 *  - норма не «немного стресса» (АЛТ 30 → 0, а не 33/67);
 *  - обрезанное число без доказанной стороны не становится ступенью;
 *  - доказанная граница («АЛТ >1000») идёт в расчёт;
 *  - единица бланка главнее догадки (креатинин 2 мг/дл — ступень 2);
 *  - алиас склада читается тем же механизмом;
 *  - серия судится по последней дате, а не по порядку массива;
 *  - в модуле индексов нет своих лестниц чисел.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretLabs } from '../lab-analysis.engine';
import { computeLabIndices, computeLabIndexDetails } from '../labs-indices.engine';
import { labMechanismIndex, miIndexPercent, miIndexShare } from '../lab-index-model';
import { getMiLabStep, MECH_LAB_MARKERS } from '../risk-engine-tz-spec';
import { LFT_ULN } from '../lab-norms.engine';

const point = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${value}-${String(extra.date ?? '')}-${String(extra.bound ?? '')}`,
  code,
  name: code,
  value,
  unit: '',
  date: '2026-11-01',
  ...extra,
}) as any;

describe('проход 194: шкала индекса — ступень модели', () => {
  it('доля и процент: m0 0, m1 33, m2 67, m3 100', () => {
    expect(miIndexShare(0)).toBe(0);
    expect(miIndexShare(1)).toBeCloseTo(1 / 3, 10);
    expect(miIndexShare(2)).toBeCloseTo(2 / 3, 10);
    expect(miIndexShare(3)).toBe(1);
    expect(miIndexPercent(0)).toBe(0);
    expect(miIndexPercent(1)).toBe(33);
    expect(miIndexPercent(2)).toBe(67);
    expect(miIndexPercent(3)).toBe(100);
    expect(miIndexShare(null)).toBeNull();
    expect(miIndexPercent(null)).toBeNull();
  });

  it('оба движка дают одно число на один и тот же набор', () => {
    const sets: ReturnType<typeof point>[][] = [
      [],
      [point('ALT', 30)],
      [point('ALT', 80), point('AST', 40)],
      [point('CRP', 12)],
      [point('GGT', 60), point('BIL', 25)],
      [point('CREATININE', 150), point('UREA', 9)],
    ];
    for (const set of sets) {
      const analysis = interpretLabs(set, 'male');
      const indices = computeLabIndices(set, 'male');
      const pair = (percent: number | null, share: number | null) =>
        percent === null ? expect(share).toBeNull() : expect(Math.round(share! * 100)).toBe(percent);
      pair(analysis.liverStress, indices.hepaticStress);
      pair(analysis.inflammation, indices.inflammation);
      pair(analysis.kidneyStress, indices.renalStress);
    }
  });

  it('норма не «проблема»: АЛТ 30 при ВГН 40 — 0 % и «Отлично»', () => {
    const indices = computeLabIndices([point('ALT', 30)], 'male');
    expect(indices.hepaticStress).toBe(0);
    const detail = computeLabIndexDetails([point('ALT', 30)], 'male').hepaticStress;
    expect(detail.interpretation).toBe('Отлично');
    expect(detail.value).toBe(0);
    expect(interpretLabs([point('ALT', 30)], 'male').liverStress).toBe(0);
  });

  it('базовая ступень препарата в индекс не входит: норма остаётся нулём', () => {
    // `getMiFromLab` поднял бы liv1 до базовой ступени (2) и минимума 1 —
    // это риск курса. Индекс обязан показать бланк.
    const read = labMechanismIndex([point('ALT', 30)], ['liv1'], 'male');
    expect(read.step).toBe(0);
    expect(read.percent).toBe(0);
  });
});

describe('проход 194: правила чтения — модельные', () => {
  it('«СРБ <5» не становится ступенью и называется в skipped', () => {
    const read = labMechanismIndex([point('CRP', 5, { bound: '<' })], ['cns2'], 'male');
    expect(read.step).toBeNull();
    expect(read.percent).toBeNull();
    expect(read.skipped).toEqual([{ code: 'CRP', value: 5, unit: '', reason: 'bound' }]);
    expect(interpretLabs([point('CRP', 5, { bound: '<' })]).inflammation).toBeNull();
    expect(computeLabIndices([point('CRP', 5, { bound: '<' })]).inflammation).toBeNull();
  });

  it('доказанная граница идёт в расчёт: «АЛТ >1000» — ступень 3', () => {
    const read = labMechanismIndex([point('ALT', 1000, { bound: '>' })], ['liv1'], 'male');
    expect(read.step).toBe(3);
    expect(read.percent).toBe(100);
  });

  it('единица бланка главнее догадки: креатинин 2 мг/дл — ступень 2, а не 0', () => {
    const read = labMechanismIndex([point('CREATININE', 2, { unit: 'mg/dL' })], ['ren1'], 'male');
    expect(read.step).toBe(2);
  });

  it('непереводимая единица не выдаёт себя за измерение', () => {
    const read = labMechanismIndex([point('NT_PROBNP', 100, { unit: '%' })], ['cv1'], 'male');
    expect(read.step).toBeNull();
    expect(read.skipped).toEqual([{ code: 'NT_PROBNP', value: 100, unit: '%', reason: 'unit' }]);
  });

  it('алиас склада читается тем же механизмом: BILIRUBIN_TOTAL 25 — ступень 1', () => {
    const read = labMechanismIndex([point('BILIRUBIN_TOTAL', 25, { unit: 'мкмоль/л' })], ['liv2'], 'male');
    expect(read.step).toBe(1);
  });

  it('граница под алиасом судится по норме канона, а не по написанию', () => {
    // `getLabNorm('BILIRUBIN_TOTAL')` записи не знает; код склада (`BIL`) — знает.
    // Иначе доказанная граница молча уходила бы в `skipped` только из-за имени.
    const read = labMechanismIndex([point('BILIRUBIN_TOTAL', 200, { unit: 'мкмоль/л', bound: '>' })], ['liv2'], 'male');
    expect(read.skipped).toEqual([]);
    expect(read.step).toBe(3);
  });

  it('серия читается по последней дате, а не по порядку массива', () => {
    const read = labMechanismIndex([
      point('CRP', 50, { date: '2026-10-01' }),
      point('CRP', 1, { date: '2026-11-01' }),
    ], ['cns2'], 'male');
    expect(read.step).toBe(0);
  });
});

describe('проход 194: источник ступени — один', () => {
  it('индекс повторяет `getMiLabStep`, а не свою лестницу', () => {
    for (const alt of [30, LFT_ULN.ALT.male, 90, 500]) {
      const read = labMechanismIndex([point('ALT', alt)], ['liv1'], 'male');
      expect(read.step).toBe(getMiLabStep('liv1', { ALT: alt }, 'male'));
    }
  });

  it('порог пола — из модели: АЛТ 35 у женщины ступень 1, у мужчины 0', () => {
    expect(computeLabIndices([point('ALT', 35)], 'female').hepaticStress).toBeCloseTo(1 / 3, 10);
    expect(computeLabIndices([point('ALT', 35)], 'male').hepaticStress).toBe(0);
    expect(interpretLabs([point('ALT', 35)], 'female').liverStress).toBe(33);
    expect(interpretLabs([point('ALT', 35)], 'male').liverStress).toBe(0);
  });

  it('таблица маркеров одна: счётчик «учтено» идёт по `MECH_LAB_MARKERS`', () => {
    expect(MECH_LAB_MARKERS.cns2).toEqual(['CRP', 'HOMOCYSTEINE', 'IL6', 'TNF_ALPHA', 'FERRITIN']);
    const read = labMechanismIndex([point('CRP', 5)], ['cns2'], 'male');
    expect(read.measured).toBe(1);
    expect(read.total).toBe(5);
    expect(read.markers).toEqual(MECH_LAB_MARKERS.cns2);
  });

  it('в модуле индексов нет своих порогов', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-index-model.ts'), 'utf8');
    expect(src).toContain('getMiLabStep(');
    for (const literal of ['LFT_ULN', 'GGT_ULN', 'BILIRUBIN_FLAG_STEPS', 'FERRITIN_STEPS', 'CREATININE_STEPS', 'UA_STAGE_ULN']) {
      expect(src, literal).not.toContain(literal);
    }
  });
});
