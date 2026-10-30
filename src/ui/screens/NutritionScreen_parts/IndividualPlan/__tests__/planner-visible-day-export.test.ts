/**
 * planner-visible-day-export.test.ts — B25 (аудит 2026-10).
 *
 * Находка: блок «Печать/Файл тренеру» (а) был заперт за `recipeApplied` — без
 * применённых рецептов его не было вовсе; (б) всегда экспортировал `dayPlan`, то есть
 * в 3/7-дневном виде — первый день, а не выбранный.
 *
 * Замок: экспорт берёт ВИДИМЫЙ день (selectedDayIndex) для каждого режима плана.
 */
import { describe, it, expect } from 'vitest';
import { resolveVisibleDayPlan } from '../IndividualPlanResults';

const day = (tag: string) => ({ tag, meals: [{ label: tag, items: [{ id: 'x', name: 'X', amount: 100 }] }] });

const weekPlan = { days: [day('d0'), day('d1'), day('d2'), day('d3'), day('d4'), day('d5'), day('d6')] };
const threeDayPlan = { days: [day('t0'), day('t1'), day('t2')] };
const dayPlan = day('mirror');

describe('B25: экспорт берёт видимый день, а не первый', () => {
  it('7-дневный план: выбранный день 4 → экспортируется день 4', () => {
    const r = resolveVisibleDayPlan({ planDays: 7, selectedDayIndex: 4, dayPlan, weekPlan, threeDayPlan });
    expect(r.day.tag).toBe('d4');
    expect(r.index).toBe(4);
    expect(r.total).toBe(7);
    // РАНЬШЕ всегда уходил dayPlan (первый день / зеркало) — это и был баг.
    expect(r.day.tag).not.toBe('mirror');
  });

  it('3-дневный план: выбранный день 2 → экспортируется день 2', () => {
    const r = resolveVisibleDayPlan({ planDays: 3, selectedDayIndex: 2, dayPlan, threeDayPlan, weekPlan });
    expect(r.day.tag).toBe('t2');
    expect(r.index).toBe(2);
    expect(r.total).toBe(3);
  });

  it('1-дневный план: экспортируется dayPlan', () => {
    const r = resolveVisibleDayPlan({ planDays: 1, selectedDayIndex: 0, dayPlan, threeDayPlan, weekPlan });
    expect(r.day.tag).toBe('mirror');
    expect(r.total).toBe(1);
  });

  it('индекс вне диапазона зажимается (нет undefined в экспорте)', () => {
    expect(resolveVisibleDayPlan({ planDays: 7, selectedDayIndex: 99, dayPlan, weekPlan }).day.tag).toBe('d6');
    expect(resolveVisibleDayPlan({ planDays: 7, selectedDayIndex: -5, dayPlan, weekPlan }).day.tag).toBe('d0');
    expect(resolveVisibleDayPlan({ planDays: 3, selectedDayIndex: 99, dayPlan, threeDayPlan }).day.tag).toBe('t2');
  });

  it('если мультидневный план ещё не собран — честный fallback на dayPlan', () => {
    const r = resolveVisibleDayPlan({ planDays: 7, selectedDayIndex: 3, dayPlan, weekPlan: undefined });
    expect(r.day.tag).toBe('mirror');
  });
});
