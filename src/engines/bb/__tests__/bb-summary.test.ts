import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { buildBBExpandedSummary, formatBBExpandedSummary, bbExerciseExplanation } from '../bb-summary.engine';

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

describe('§5.2: bbExerciseExplanation для PDF/CSV', () => {
  it('наклонный жим → паттерн по-русски (display-уточнение) и пояснение', () => {
    const x = bbExerciseExplanation({ name: 'Жим штанги на наклонной (30°)', muscle: 'chest' });
    expect(x.pattern).toBe('наклонный жим');
    expect(typeof x.why).toBe('string');
    expect(typeof x.how).toBe('string');
  });

  it('спина с подгруппой → непустая «подмышка»', () => {
    const x = bbExerciseExplanation({ name: 'Тяга верхнего блока широким хватом', muscle: 'back', backSubgroup: 'back_width' });
    expect(x.subgroup.length).toBeGreaterThan(0);
    expect(x.pattern.length).toBeGreaterThan(0);
  });

  it('мышца без SUBGROUP_MAP → подгруппа пустая, паттерн «прочее»', () => {
    const x = bbExerciseExplanation({ name: 'Упражнение без паттерна', muscle: 'neck' });
    expect(x.subgroup).toBe('');
    expect(x.pattern).toBe('прочее');
  });

  it('движковый план: каждое упражнение даёт непустой паттерн', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      const x = bbExerciseExplanation(e);
      expect(x.pattern.length).toBeGreaterThan(0);
    }
  });
});
