/**
 * labs-indices-honest.test.ts — проход 149: индекс здоровья не считает
 * отсутствующее измерение нулём и обрезанное число — точным.
 *
 * Было:
 * — `ratioFrom` возвращал `0`, если маркер не сдан, поэтому один только АЛТ
 *   давал «Воспаление 0%», «Метаболизм 0%», «HOMA 0%» — экран показывал ноль
 *   там, где ничего не измеряли (а при пустом списке все индексы были нулями);
 * — `weighted` суммировал `ratio * вес`, так что отсутствующий ферритин
 *   молча вычитался из знаменателя и занижал индекс (100 ферритина давало
 *   0.4 × его долю вместо его доли);
 * — «СРБ <5» (предел метода) читался как ровно 5 — то есть «Воспаление 100%»;
 * — без инсулина HOMA печатался как `глюкоза*0.7 + HbA1c*0.3` — не HOMA.
 *
 * Стало: индексы строятся только по измеренным точным числам, их отсутствие —
 * `null` («Нет данных»), обрезанный маркер в индекс не идёт и считается в
 * `measured/total`, а HOMA-IR есть только при обеих половинах пары.
 */
import { describe, it, expect } from 'vitest';
import { computeLabIndices, computeLabIndexDetails, interpretLabIndices } from '../labs-indices.engine';

const point = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `${code}-${value}`,
  code,
  name: code,
  value,
  unit: '',
  phase: 'baseline',
  date: '2026-11-01',
  ...extra,
}) as any;

describe('проход 149: пустой склад — «нет данных», а не ноль', () => {
  it('все индексы null', () => {
    const res = computeLabIndices([]);
    for (const [key, value] of Object.entries(res)) {
      expect(value, key).toBeNull();
    }
  });

  it('подписи говорят «Нет данных», а не «Отлично»', () => {
    const labels = interpretLabIndices(computeLabIndices([]));
    for (const [key, text] of Object.entries(labels)) {
      expect(text, key).toBe('Нет данных');
    }
  });
});

describe('проход 149: индекс только из измеренных маркеров', () => {
  it('один АЛТ даёт стресс печени, а остальные индексы — null', () => {
    const res = computeLabIndices([point('ALT', 30)]);
    expect(res.hepaticStress).not.toBeNull();
    expect(res.inflammation).toBeNull();
    expect(res.metabolism).toBeNull();
    expect(res.thyroid).toBeNull();
    expect(res.lipids).toBeNull();
    expect(res.homaIR).toBeNull();
  });

  it('ферритин 350 один — ступень 1 модели (1/3), второй маркер её не размывает', () => {
    const alone = computeLabIndices([point('FERRITIN', 350)]);
    expect(alone.inflammation!).toBeCloseTo(1 / 3, 5);
    // СРБ 1 в норме (ступень 0) не тянет индекс вниз: модель берёт худшую ступень.
    const withCrp = computeLabIndices([point('FERRITIN', 350), point('CRP', 1)]);
    expect(withCrp.inflammation!).toBeCloseTo(1 / 3, 5);
  });

  it('детали несут счётчик учтённых маркеров', () => {
    const details = computeLabIndexDetails([point('FERRITIN', 100)]);
    expect(details.inflammation.measured).toBe(1);
    // cns2 в модели: СРБ, гомоцистеин, ИЛ-6, ФНО-α, ферритин.
    expect(details.inflammation.total).toBe(5);
    expect(details.inflammation.value).not.toBeNull();
    expect(details.inflammation.interpretation).not.toBe('Нет данных');
    expect(details.metabolism.measured).toBe(0);
    expect(details.metabolism.value).toBeNull();
    expect(details.metabolism.interpretation).toBe('Нет данных');
  });
});

describe('проход 149: «СРБ <5» — не «Воспаление 100%»', () => {
  it('обрезанное число в индекс не идёт', () => {
    const cut = computeLabIndices([point('CRP', 5, { bound: '<' })]);
    expect(cut.inflammation).toBeNull();

    const details = computeLabIndexDetails([point('CRP', 5, { bound: '<' })]);
    expect(details.inflammation.measured).toBe(0);
    expect(details.inflammation.value).toBeNull();
  });

  it('то же число без границы — измерение и идёт в индекс', () => {
    const exact = computeLabIndices([point('CRP', 5)]);
    expect(exact.inflammation).not.toBeNull();
    // Проход 194: СРБ 5 — первая ступень модели cns2 → 1/3, а не «доля нормы 1.0».
    expect(exact.inflammation!).toBeCloseTo(1 / 3, 5);
  });

  it('обрезанный HDL не ломает липидный индекс: считается только ЛПНП', () => {
    const res = computeLabIndices([point('HDL', 0.5, { bound: '<' }), point('LDL', 2)]);
    expect(res.lipids).not.toBeNull();
    // Без HDL индекс не может быть «плохим из-за нулевого HDL»: берётся LDL.
    const ldlOnly = computeLabIndices([point('LDL', 2)]);
    expect(res.lipids!).toBeCloseTo(ldlOnly.lipids!, 5);
  });
});

describe('проход 149: HOMA-IR только по измеренной паре', () => {
  it('глюкоза и инсулин — считается', () => {
    const res = computeLabIndices([point('GLU', 5.5), point('INS', 10)]);
    expect(res.homaIR).not.toBeNull();
    expect(res.homaIR!).toBeGreaterThan(0.4);
    const details = computeLabIndexDetails([point('GLU', 5.5), point('INS', 10)]);
    expect(details.homaIR.measured).toBe(2);
    expect(details.homaIR.total).toBe(2);
  });

  it('без инсулина — null, а не «глюкоза*0.7 + HbA1c*0.3»', () => {
    const res = computeLabIndices([point('GLU', 5.5), point('HbA1c', 5.5)]);
    expect(res.homaIR).toBeNull();
    const details = computeLabIndexDetails([point('GLU', 5.5), point('HbA1c', 5.5)]);
    expect(details.homaIR.measured).toBe(1);
    expect(details.homaIR.interpretation).toBe('Нет данных');
  });

  it('обрезанная глюкоза — HOMA не печатается', () => {
    const res = computeLabIndices([point('GLU', 20, { bound: '>' }), point('INS', 10)]);
    expect(res.homaIR).toBeNull();
  });
});
