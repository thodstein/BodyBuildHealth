import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { buildBBExpandedSummary, formatBBExpandedSummary } from '../bb-summary.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB расширенная недельная сводка', () => {
  it('считает рабочие и разминочные сеты, паттерны, по сессиям', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    const s = buildBBExpandedSummary(plan);
    expect(s.totalWorkingSets).toBeGreaterThan(0);
    // спина присутствует и имеет sessionsPerWeek ≥ 1
    expect(s.byMuscle.back.sessionsPerWeek).toBeGreaterThanOrEqual(1);
    expect(s.byMuscle.back.workingSets).toBeGreaterThan(0);
    // паттерны спины есть
    expect(Object.keys(s.byMuscle.back.byPattern).length).toBeGreaterThan(0);
  });

  it('форматирует текстовую сводку (для отчёта)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    const text = formatBBExpandedSummary(plan);
    expect(text).toContain('тренировок/нед');
    expect(text).toContain('рабочих');
    expect(text).toContain('Итого рабочих сетов/нед');
  });
});
