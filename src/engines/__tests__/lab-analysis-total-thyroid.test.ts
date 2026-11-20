/**
 * lab-analysis-total-thyroid.test.ts — проход 170: общий Т3/Т4 судится в своей
 * единице.
 *
 * Было: `REFERENCE_RANGES.T3 = { low: 2.5, high: 6.5, criticalHigh: 8, unit:
 * 'пмоль/л' }` (то же для Т4: 10–24). Числа — шкала свободных гормонов, но
 * подписаны как общие. Склад хранит общий Т3 в нмоль/л (`UCUM_MAP.T3`: 1–2.8),
 * поэтому нормальные 1.8 нмоль/л пересчитывались в 1800 пмоль/л и читались
 * «критически высокими» с механизмом `THYROID_DYSFUNCTION` и риском
 * гипотиреоза. Один анализ (Т3 общий) выдавал совет другого (Т3 свободный).
 *
 * Стало: границы общего Т3/Т4 — из резолвера норм (`getLabNorm` → `UCUM_MAP`),
 * единица — единица склада (нмоль/л). Критического уровня для общих гормонов в
 * репозитории нет ни в одном источнике, поэтому его нет и здесь: высокое
 * значение называется «высоким», а не «критическим» (числа не придумываем).
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs } from '../lab-analysis.engine';
import { getLabNorm } from '../lab-norms.engine';

const point = (code: string, value: number, unit = 'nmol/L') => ({
  id: `${code}-${value}-${unit}`,
  code,
  name: code,
  value,
  unit,
  phase: 'baseline',
  date: '2026-11-01',
}) as any;

const statusOf = (labs: any[], code: string) =>
  interpretLabs(labs).interpretations.find((i) => i.code === code)?.status;

describe('проход 170: общий Т3 в нмоль/л — не критическая гиперфункция', () => {
  it('нормальный общий Т3 (1.8 нмоль/л) не даёт интерпретации', () => {
    expect(statusOf([point('T3', 1.8)], 'T3')).toBeUndefined();
  });

  it('общий Т3 3.5 нмоль/л — «высокий», но не «критический»', () => {
    const res = interpretLabs([point('T3', 3.5)]);
    const t3 = res.interpretations.find((i) => i.code === 'T3');
    expect(t3?.status).toBe('high');
    expect(t3?.riskPercent).toBe(25);
  });

  it('заведомо большое значение остаётся «высоким»: критического уровня нет', () => {
    // Проход 170: раньше 1000 нмоль/л попадало в `critical_high` (порог 8 был
    // взят из шкалы пмоль/л). Источника критического уровня для общего Т3 в
    // репозитории нет — значит, вывод не выше «высоко».
    expect(statusOf([point('T3', 1000)], 'T3')).toBe('high');
  });

  it('граница общего Т3 — из резолвера норм, а не своя', () => {
    const uln = getLabNorm('T3')!.uln;
    expect(statusOf([point('T3', uln)], 'T3')).toBeUndefined();
    expect(statusOf([point('T3', uln + 0.01)], 'T3')).toBe('high');
  });

  it('бланк в пмоль/л приводится к нмоль/л, а не сравнивается как есть', () => {
    expect(statusOf([point('T3', 1800, 'pmol/L')], 'T3')).toBeUndefined();
    expect(statusOf([point('T3', 3500, 'pmol/L')], 'T3')).toBe('high');
  });
});

describe('проход 170: общий Т4 в нмоль/л', () => {
  it('нормальный общий Т4 (100 нмоль/л) не даёт интерпретации', () => {
    expect(statusOf([point('T4', 100)], 'T4')).toBeUndefined();
  });

  it('общий Т4 160 нмоль/л — «высокий», не «критический»', () => {
    expect(statusOf([point('T4', 160)], 'T4')).toBe('high');
  });

  it('низкий общий Т4 остаётся низким', () => {
    expect(statusOf([point('T4', 40)], 'T4')).toBe('low');
  });
});

describe('проход 170: свободные Т3/Т4 не сломаны', () => {
  it('свободный Т3 4.5 пмоль/л — норма, 7.5 — высокий', () => {
    expect(statusOf([point('FT3', 4.5, 'pmol/L')], 'FREE_T3')).toBeUndefined();
    expect(statusOf([point('FT3', 7.5, 'pmol/L')], 'FREE_T3')).toBe('high');
  });

  it('свободный Т4 15 пмоль/л — норма, 25 — высокий', () => {
    expect(statusOf([point('FT4', 15, 'pmol/L')], 'FREE_T4')).toBeUndefined();
    expect(statusOf([point('FT4', 25, 'pmol/L')], 'FREE_T4')).toBe('high');
  });
});
