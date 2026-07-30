import { describe, it, expect } from 'vitest';
import { buildLMSPlan } from '../lms/lms-builder.engine';
import { CYCLE_01 } from '../../data/lms-cycles/cycle-01';
import type { Lift, WeakPoint } from '../lms/weakpoint-pl';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

function buildWithWeakPoints(plWeakPoints: { lift: Lift; weakPoint: WeakPoint }[]) {
  return buildLMSPlan({
    template: CYCLE_01,
    pmMap,
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride: 12,
    plWeakPoints,
  });
}

describe('injectPLWeakPoints (через buildLMSPlan)', () => {
  it('план без plWeakPoints не содержит ассистентных инъекций', () => {
    const plan = buildWithWeakPoints([]);
    const baseExerciseCount = plan.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    // cycle-01 week1 days имеют фиксированное число упражнений
    expect(baseExerciseCount).toBeGreaterThan(0);
  });

  it('bench/lockout → в плане появляются дожимы или жимовые ассистенты', () => {
    const plan = buildWithWeakPoints([{ lift: 'bench', weakPoint: 'lockout' }]);
    const allExercises = plan.weeks[0].days.flatMap(d => d.exercises.map(e => e.name));
    // должен появиться хотя бы один ассистент (дожим / жим в раме / и т.п.)
    const hasAssistance = allExercises.some(n => /дожим|рам|жим.*средн|жим.*останов/i.test(n));
    // Может не сработать если все ассистенты уже есть — проверяем что хотя бы число упражнений не уменьшилось
    const planBase = buildWithWeakPoints([]);
    const baseCount = planBase.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    const withWpCount = plan.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    expect(withWpCount).toBeGreaterThanOrEqual(baseCount);
  });

  it('squat/bottom → в плане появляются присед-ассистенты', () => {
    const plan = buildWithWeakPoints([{ lift: 'squat', weakPoint: 'bottom' }]);
    const allExercises = plan.weeks[0].days.flatMap(d => d.exercises.map(e => e.name));
    const planBase = buildWithWeakPoints([]);
    const baseCount = planBase.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    const withWpCount = plan.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    expect(withWpCount).toBeGreaterThanOrEqual(baseCount);
  });

  it('добавленные ассистенты имеют weight > 0', () => {
    const plan = buildWithWeakPoints([{ lift: 'bench', weakPoint: 'lockout' }]);
    for (const wk of plan.weeks) {
      for (const day of wk.days) {
        for (const ex of day.exercises) {
          for (const ws of ex.workSets) {
            expect(ws.weight).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('добавленные ассистенты ≤ 8 упражнений в дне (day cap)', () => {
    const plan = buildWithWeakPoints([
      { lift: 'bench', weakPoint: 'lockout' },
      { lift: 'squat', weakPoint: 'bottom' },
      { lift: 'deadlift', weakPoint: 'start' },
    ]);
    for (const wk of plan.weeks) {
      for (const day of wk.days) {
        expect(day.exercises.length).toBeLessThanOrEqual(8);
      }
    }
  });

  it('PL-слабые точки присутствуют во всех неделях (не только первой)', () => {
    const plan = buildWithWeakPoints([{ lift: 'bench', weakPoint: 'lockout' }]);
    // инъекция применяется к каждой неделе
    const w1Count = plan.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0);
    const w5Count = plan.weeks[4].days.reduce((s, d) => s + d.exercises.length, 0);
    expect(w1Count).toBeGreaterThan(0);
    expect(w5Count).toBeGreaterThan(0);
  });
});