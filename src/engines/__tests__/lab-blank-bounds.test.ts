/**
 * lab-blank-bounds.test.ts — этап E7: границы бланка доходят до вердикта.
 *
 * Было: `LabPoint.refLow/refHigh` читали только вкладка «Анализы» и HL7-выгрузка,
 * а `interpretLabs` судил по `REFERENCE_RANGES`. Лабораторный верх 600 мЕд/л у
 * пролактина не помогал: разбор печатал «выше нормы» по каталожным 350
 * (`docs/LAB-NORMS-SINGLE-SOURCE.md` §5, `docs/SUPPORT-PRESCRIBING-PRO-AUDIT-PLAN-2026-11.md` E7).
 *
 * Стало: в петле по `REFERENCE_RANGES` пара бланка заменяет каталожные
 * `low`/`high`. Границы пересчитываются из единицы бланка тем же
 * `convertToUnit`, что и значение; `criticalHigh` остаётся каталожным (порог
 * действия, а не норма); женская фаза E2/ЛГ/ФСГ главнее бланка — бланк о фазе
 * не знает.
 *
 * Про PROG: строки `PROGESTERONE` в `REFERENCE_RANGES` нет, разбор судит его
 * только у женщины в лютеиновую фазу (проход 89), а порог действия 1.5 нг/мл
 * живёт в `LAB_TIERS`. Поэтому поведение «бланк шире — high нет / уже — high»
 * проверяется на маркере, который в петле есть (пролактин, мужской верх 350).
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs } from '../lab-analysis.engine';
import { convertToUnit } from '../../core/labs-mapping';

const point = (code: string, value: number, unit: string, extra: Record<string, unknown> = {}) =>
  ({
    id: `${code}-${value}`,
    code,
    name: code,
    value,
    unit,
    phase: 'baseline',
    date: '2026-11-01',
    ...extra,
  }) as any;

const interp = (code: string, labs: any[], sex?: 'male' | 'female', cycle?: any) =>
  interpretLabs(labs, sex, cycle).interpretations.find((i) => i.code === code);

describe('E7: бланк главнее каталога — ложного «выше нормы» нет', () => {
  const prolactin = (refLow?: number, refHigh?: number) => {
    const blank = refLow !== undefined && refHigh !== undefined ? { refLow, refHigh } : {};
    return interp('PROLACTIN', [point('PROLACTIN', 400, 'мЕд/л', blank)]);
  };

  it('каталог: пролактин 400 при верхней 350 — high', () => {
    expect(prolactin()?.status).toBe('high');
  });

  it('бланк 50–600: 400 внутри лабораторной нормы — статуса high нет', () => {
    expect(prolactin(50, 600)).toBeUndefined();
  });

  it('бланк 50–300: 400 выше лабораторной нормы — high, а не critical', () => {
    // Критический порог остался каталожным (500): бланк его не поднимает и не опускает.
    expect(prolactin(50, 300)?.status).toBe('high');
    expect(prolactin(50, 300)?.riskPercent).toBe(25);
  });

  it('бланк шире критического порога не отменяет critical (550 при норме 50–600)', () => {
    // Норма бланка — интервал метода; критическое значение остаётся каталожным.
    const crit = interp('PROLACTIN', [point('PROLACTIN', 550, 'мЕд/л', { refLow: 50, refHigh: 600 })]);
    expect(crit?.status).toBe('critical_high');
    expect(crit?.riskPercent).toBe(40);
  });

  it('без refLow/refHigh вердикт прежний; односторонняя граница бланка не применяется', () => {
    expect(prolactin()?.status).toBe('high');
    expect(prolactin(50)?.status).toBe('high');
    expect(interp('PROLACTIN', [point('PROLACTIN', 300, 'мЕд/л')])).toBeUndefined();
  });
});

describe('E7: границы бланка пересчитываются из единицы бланка', () => {
  // Реальная пара `convertToUnit`: 400 нг/дл общего тестостерона = 13.876 нмоль/л.
  const testosterone = (refLow: number, refHigh: number) =>
    interp('TESTOSTERONE_TOTAL', [point('TESTOSTERONE_TOTAL', 600, 'нг/дл', { refLow, refHigh })]);

  it('600 нг/дл (20.8 нмоль/л) и бланк 200–400 нг/дл (6.9–13.9) — high по бланку', () => {
    // Каталог 10–35 нмоль/л считал бы 20.8 нормой, а подстановка «400 как есть» —
    // низким. High доказывает, что границы пересчитаны, а не взяты сырыми.
    expect(convertToUnit('TESTOSTERONE_TOTAL', 400, 'нг/дл', 'нмоль/л')).toBeCloseTo(13.876, 1);
    expect(testosterone(200, 400)?.status).toBe('high');
  });

  it('600 нг/дл (20.8) и бланк 500–1000 нг/дл (17.3–34.7) — норма', () => {
    // Сырые 500–1000 сделали бы 20.8 «низким»; пересчитанные границы его вмещают.
    expect(convertToUnit('TESTOSTERONE_TOTAL', 500, 'нг/дл', 'нмоль/л')).toBeCloseTo(17.335, 1);
    expect(testosterone(500, 1000)).toBeUndefined();
  });
});

describe('E7: женская фаза главнее бланка', () => {
  const follicular = { phase: 'follicular' as const, cycleDay: 8, cycleLength: 28, label: 'Фолликулярная' };
  const e2 = point('ESTRADIOL', 300, 'пг/мл', { refLow: 40, refHigh: 800 });

  it('E2 300 в фолликулярную при бланке 40–800 — high по фазовому верху 200', () => {
    expect(interp('ESTRADIOL', [e2], 'female', follicular)?.status).toBe('high');
  });

  it('без фазы бланк главнее женского каталога: 300 внутри 40–800 — норма', () => {
    expect(interp('ESTRADIOL', [e2], 'female')).toBeUndefined();
  });
});

describe('E7: обрезанное значение не получает стороны от бланка', () => {
  it('«СРБ <5» с бланком 0–8 — по-прежнему без вывода и в boundUnproven', () => {
    const res = interpretLabs([point('CRP', 5, 'мг/л', { bound: '<', refLow: 0, refHigh: 8 })]);
    expect(res.interpretations.find((i) => i.code === 'CRP')).toBeUndefined();
    expect(res.boundUnproven).toEqual([{ code: 'CRP', value: 5, bound: '<' }]);
  });
});

describe('E7: PROG вне петли REFERENCE_RANGES — бланк вердикта не создаёт', () => {
  // Причина — проход 89: мужской/нефазовый прогестерон в разборе не судится,
  // его порог действия 1.5 нг/мл живёт в LAB_TIERS (`lab-tier-ranges.ts`), а не
  // в `REFERENCE_RANGES`. Тест фиксирует границу, чтобы «бланк → вердикт» не
  // считался сделанным для прогестерона.
  it('1.6 нг/мл с бланком 0.1–1.0 не получает high: мужской шкалы в разборе нет', () => {
    const res = interpretLabs([point('PROGESTERONE', 1.6, 'нг/мл', { refLow: 0.1, refHigh: 1.0 })], 'male');
    expect(res.interpretations).toHaveLength(0);
  });
});
