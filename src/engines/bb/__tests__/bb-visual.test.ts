/**
 * bb-visual.test.ts — Фаза 4: наглядность/экспорт ББ-плана (чистые data-билдеры).
 */
import { describe, it, expect } from 'vitest';
import { buildBBMuscleHeatmap, buildBBTaperCurve, buildBBMesocycleTable, bbWeekDateRanges, buildBBPlanPrintHtml, buildBBPlanIcs, compareBBVariants, buildBBFitnessFatigue } from '../bb-visual.engine';
import { buildBBPlan } from '../bb-builder.engine';

describe('Фаза 4.19: heatmap мышца×неделя', () => {
  it('строит клетки по мышцам/неделям', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const hm = buildBBMuscleHeatmap(plan);
    expect(hm.length).toBeGreaterThan(0);
    expect(hm[0]).toHaveProperty('week');
    expect(hm[0]).toHaveProperty('muscle');
    expect(hm[0]).toHaveProperty('sets');
  });
});

describe('Фаза 4.21: кривая тапера', () => {
  it('возвращает массив (может быть пустым без taper-недель)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    expect(Array.isArray(buildBBTaperCurve(plan))).toBe(true);
  });
});

describe('Фаза 4.22: таблица мезоцикла', () => {
  it('содержит недели×дни×упражнения', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const rows = buildBBMesocycleTable(plan);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].exercises.length).toBeGreaterThan(0);
    expect(rows[0].exercises[0]).toHaveProperty('weight');
  });
});

describe('Фаза 4.23: календарные диапазоны недель', () => {
  it('считает даты от старта', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ranges = bbWeekDateRanges(plan, { startDate: '2026-01-05', referenceDate: '2026-01-09' });
    expect(ranges.length).toBe(2);
    expect(ranges[0].start).toBe('2026-01-05');
    expect(ranges[0].isCurrent).toBe(true);
    expect(ranges[1].start).toBe('2026-01-12');
  });
  it('без даты — пустые диапазоны', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ranges = bbWeekDateRanges(plan);
    expect(ranges[0].start).toBe('');
  });
});

describe('Фаза 4.24: print HTML + ics', () => {
  it('buildBBPlanPrintHtml — стилизованный HTML с таблицей и heatmap', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const html = buildBBPlanPrintHtml(plan);
    expect(html).toMatch(/<html/i);
    expect(html).toMatch(/Таблица мезоцикла/);
    expect(html).toMatch(/Нед/i); // heatmap секция
  });
  it('buildBBPlanIcs — валидный VCALENDAR', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ics = buildBBPlanIcs(plan, { startDate: '2026-01-05' });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});

describe('Фаза 4.27: сравнение вариантов', () => {
  it('считает по-недельный дифф', () => {
    const a = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const b = buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 3 } as any);
    const diff = compareBBVariants(a, b);
    expect(diff.length).toBe(3);
    expect(diff.every(d => typeof d.changes === 'number')).toBe(true);
  });
  it('пустой план → []', () => {
    expect(compareBBVariants({ weeks: [] } as any, { weeks: [] } as any)).toEqual([]);
  });
});

describe('Фаза 4.20: fitness-fatigue (Banister)', () => {
  it('прогноз по неделям плана от даты старта', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 6 } as any);
    const ff = buildBBFitnessFatigue(plan, { startDate: '2026-01-05' });
    expect(ff.length).toBe(6);
    expect(ff[0].date).toBe('2026-01-05');
    expect(ff.every(p => typeof p.performance === 'number')).toBe(true);
  });
  it('пустой план → []', () => {
    expect(buildBBFitnessFatigue({ weeks: [] } as any)).toEqual([]);
  });
});
