/**
 * macrocycle-competition-adapt.test.ts — хелперы «подстройки под соревнования»
 * (Раунд E): даты недель от «сегодня», обратный отсчёт, прогрессия ПМ к старту,
 * тапер к старту в блоке.
 */
import { describe, it, expect } from 'vitest';
import {
  macroWeekStartDate, macroWeekEndDate, weeksUntilWeek, formatMacroDate,
  projectPmGrowthMultiplier, taperWeeksForBlock,
} from '../lms/macrocycle.engine';
import { getCycleById } from '../../data/lms-cycles/lms-cycle-index';

describe('macroWeekStartDate / macroWeekEndDate', () => {
  const ref = '2026-01-05T00:00:00Z'; // понедельник

  it('неделя 1 = reference', () => {
    const d = macroWeekStartDate(1, ref)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-01-05');
  });

  it('неделя 2 = +7 дней; конец недели = +6 дней', () => {
    const start = macroWeekStartDate(2, ref)!;
    const end = macroWeekEndDate(2, ref)!;
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-12');
    expect(end.toISOString().slice(0, 10)).toBe('2026-01-18');
  });

  it('невалидные входы → null', () => {
    expect(macroWeekStartDate(0)).toBeNull();
    expect(macroWeekStartDate(1.5)).toBeNull();
    expect(macroWeekStartDate(1, 'broken')).toBeNull();
  });
});

describe('weeksUntilWeek / formatMacroDate', () => {
  it('считает недели до старта от текущей', () => {
    expect(weeksUntilWeek(44, 1)).toBe(43);
    expect(weeksUntilWeek(1, 1)).toBe(0);
    expect(weeksUntilWeek(30, 40)).toBe(-10);
  });

  it('форматирует дату dd.mm.yy', () => {
    expect(formatMacroDate(new Date(2026, 0, 5))).toBe('05.01.26');
    expect(formatMacroDate(null)).toBe('—');
  });
});

describe('projectPmGrowthMultiplier', () => {
  it('cycle-01: correctionPct 0.005 за 4 недели → 1.005^4', () => {
    const cyc = getCycleById('cycle-01');
    expect(cyc).toBeTruthy();
    const m = projectPmGrowthMultiplier(cyc, 4);
    expect(m).toBeCloseTo(Math.pow(1.005, 4), 6);
  });

  it('без цикла — дефолт 0.5%/нед; weeks ≤ 0 → 1', () => {
    expect(projectPmGrowthMultiplier(undefined, 10)).toBeCloseTo(Math.pow(1.005, 10), 6);
    expect(projectPmGrowthMultiplier(undefined, 0)).toBe(1);
    expect(projectPmGrowthMultiplier(undefined, -3)).toBe(1);
  });

  it('защита от экстремальных correctionPct (кап 2%/нед)', () => {
    const weird = { meta: { correctionPct: 0.5 } } as any;
    expect(projectPmGrowthMultiplier(weird, 4)).toBeCloseTo(Math.pow(1.02, 4), 6);
  });
});

describe('taperWeeksForBlock', () => {
  it('блок 5 нед → две финальные недели с объёмом/RIR (Bosquet 2005)', () => {
    const taper = taperWeeksForBlock({ phase: 'peak', weeks: 5, weekOffset: 10 });
    expect(taper).toEqual([
      { week: 13, weekInBlock: 4, volumeMult: 0.65, rirShift: 1, label: 'предпоследняя' },
      { week: 14, weekInBlock: 5, volumeMult: 0.45, rirShift: 2, label: 'финальная' },
    ]);
  });

  it('блок ≤ 2 нед — тапера нет', () => {
    expect(taperWeeksForBlock({ phase: 'peak', weeks: 2, weekOffset: 5 })).toEqual([]);
    expect(taperWeeksForBlock({ phase: 'competition', weeks: 1, weekOffset: 5 })).toEqual([]);
  });

  it('блок ровно 3 нед → тапер на последних 2', () => {
    const taper = taperWeeksForBlock({ phase: 'strength', weeks: 3, weekOffset: 1 });
    expect(taper.map(t => t.week)).toEqual([2, 3]);
    expect(taper[1].label).toBe('финальная');
  });
});
