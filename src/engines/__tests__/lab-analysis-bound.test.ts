/**
 * lab-analysis-bound.test.ts — проход 150: разбор анализов не делает вывода,
 * которого граница не доказывает.
 *
 * Было: `findLab` возвращал только число, знак бланка терялся. Поэтому «СРБ <5»
 * (предел метода, самый частый бланк) сравнивался с верхней границей 3 как
 * точное 5 — «системное воспаление 25%» — и заодно поднимал индекс воспаления
 * до 6. HOMA-IR считался и по обрезанной глюкозе («>20»), выдавая нижнюю оценку
 * за измерение.
 *
 * Стало: сторона отклонения — только по `boundProvesSide` (то же правило, что у
 * дневника, трендов и отчёта); недоказанная граница не даёт вывода и называется
 * в `boundUnproven`; составные индексы берут только точное число или доказанную
 * «плохую» сторону; HOMA-IR — только по двум точным числам.
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs, computeHOMA_IR } from '../lab-analysis.engine';

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

const codes = (labs: any[]) => interpretLabs(labs).interpretations.map((i) => i.code);

describe('проход 150: «СРБ <5» — не воспаление', () => {
  it('недоказанная граница не даёт интерпретации и называется в boundUnproven', () => {
    const res = interpretLabs([point('CRP', 5, { bound: '<' })]);
    expect(codes([point('CRP', 5, { bound: '<' })])).not.toContain('CRP');
    expect(res.boundUnproven).toEqual([{ code: 'CRP', value: 5, bound: '<' }]);
  });

  it('то же число без границы — высокое, как раньше', () => {
    const res = interpretLabs([point('CRP', 5)]);
    const crp = res.interpretations.find((i) => i.code === 'CRP');
    expect(crp?.status).toBe('high');
    expect(res.boundUnproven).toEqual([]);
  });

  it('обрезанный СРБ — воспаление неизвестно, а не «норма»', () => {
    const cut = interpretLabs([point('CRP', 5, { bound: '<' })]);
    const exact = interpretLabs([point('CRP', 5)]);
    // Проход 150: обрезанный идёт как «не измерено». Проход 153: вместо
    // подставленной нормы (2.5) индекс воспаления вовсе неизвестен, а точный
    // СРБ 5 даёт 5 + ферритин/100 (ферритина нет — 0).
    expect(cut.inflammation).toBeNull();
    expect(exact.inflammation).toBe(5);
  });
});

describe('проход 150: доказанная граница остаётся выводом', () => {
  it('«АЛТ >1000» — критическое высокое', () => {
    const res = interpretLabs([point('ALT', 1000, { bound: '>' })]);
    const alt = res.interpretations.find((i) => i.code === 'ALT');
    expect(alt?.status).toBe('critical_high');
    expect(alt?.riskPercent).toBe(40);
    expect(res.boundUnproven).toEqual([]);
  });

  it('«Ферритин >500» — критическое, «>300» — высокое, «>100» — без вывода', () => {
    const crit = interpretLabs([point('FERRITIN', 500, { bound: '>' })]).interpretations.find((i) => i.code === 'FERRITIN');
    const high = interpretLabs([point('FERRITIN', 300, { bound: '>' })]).interpretations.find((i) => i.code === 'FERRITIN');
    const lowBound = interpretLabs([point('FERRITIN', 100, { bound: '>' })]);
    expect(crit?.status).toBe('critical_high');
    expect(high?.status).toBe('high');
    // «>100» при верхней 300 не доказывает высокое — это не вывод.
    expect(lowBound.interpretations).toHaveLength(0);
    expect(lowBound.boundUnproven).toEqual([{ code: 'FERRITIN', value: 100, bound: '>' }]);
  });

  it('«АЛТ <10» при нижней 5 — вывода нет (сторона не доказана)', () => {
    const res = interpretLabs([point('ALT', 10, { bound: '<' })]);
    expect(res.interpretations).toHaveLength(0);
    expect(res.boundUnproven).toHaveLength(1);
  });
});

describe('проход 150: HOMA-IR только по двум точным числам', () => {
  it('точные глюкоза и инсулин — считается', () => {
    const res = interpretLabs([point('GLUCOSE', 5.5), point('INSULIN', 10)]);
    expect(res.homaIR).toBeCloseTo(computeHOMA_IR(5.5, 10), 6);
  });

  it('обрезанная глюкоза — HOMA неизвестен', () => {
    expect(interpretLabs([point('GLUCOSE', 20, { bound: '>' }), point('INSULIN', 10)]).homaIR).toBeNull();
  });

  it('обрезанный инсулин — HOMA неизвестен', () => {
    expect(interpretLabs([point('GLUCOSE', 5.5), point('INSULIN', 100, { bound: '>' })]).homaIR).toBeNull();
  });
});

describe('проход 150: индексы не берут обрезанное число', () => {
  it('обрезанный АЛТ не меняет стресс печени', () => {
    const cut = interpretLabs([point('ALT', 40, { bound: '<' })]);
    const none = interpretLabs([]);
    expect(cut.liverStress).toBe(none.liverStress);
  });

  it('обрезанный HDL не считается низким без доказательства', () => {
    const cut = interpretLabs([point('HDL', 1.2, { bound: '<' })]);
    const none = interpretLabs([]);
    expect(cut.cardioRisk).toBe(none.cardioRisk);
  });
});
