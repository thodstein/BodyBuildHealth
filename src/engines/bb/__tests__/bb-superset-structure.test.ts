/**
 * bb-superset-structure.test.ts — Фаза 2.8: структура суперсета A1/B1.
 *
 * Пары получают supersetGroup (общий), supersetSlot (0/1), rest=0 на первом
 * (сразу на партнёра, отдых после второго) — плеер честно чередует A1/B1/A2/B2.
 */
import { describe, it, expect } from 'vitest';
import { markAntagonistSupersets, markSameMuscleSupersets } from '../bb-finalize.engine';
import type { BBPlan, BBExercise } from '../bb-builder.engine';

function mkPlan(withSupersetMarking: (plan: BBPlan) => void): { plan: BBPlan; pairs: Array<[BBExercise, BBExercise]> } {
  const plan: any = {
    pattern: {} as any,
    rationale: [],
    weeks: [
      {
        week: 1,
        phase: 'accumulation',
        sessions: [
          {
            day: 1, weekOffset: 1, character: 'тяж',
            exercises: [
              { muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4, workSets: [{ reps: 8, rir: 2, weight: 100, restSeconds: 120 }] },
              { muscle: 'back', name: 'Тяга', role: 'primary', character: 'тяж', sets: 4, workSets: [{ reps: 8, rir: 2, weight: 90, restSeconds: 120 }] },
            ],
          },
        ],
      },
    ],
  };
  withSupersetMarking(plan);
  const pair = (plan.weeks[0].sessions[0].exercises as BBExercise[]);
  return { plan, pairs: [[pair[0], pair[1]]] };
}

describe('структура суперсета (Фаза 2.8)', () => {
  it('антагонист: пара получает supersetGroup + supersetSlot + rest=0 на первом', () => {
    const { pairs } = mkPlan(markAntagonistSupersets);
    const [a, b] = pairs[0];
    expect(a.supersetWith).toBe('Тяга');
    expect(b.supersetWith).toBe('Жим лёжа');
    expect(a.supersetGroup).toBeDefined();
    expect(b.supersetGroup).toBe(a.supersetGroup); // общий id
    expect(a.supersetSlot).toBe(0);
    expect(b.supersetSlot).toBe(1);
    // rest=0 на первом (сразу на партнёра), отдых — после второго
    expect((a.workSets as any)[0].restSeconds).toBe(0);
    expect((b.workSets as any)[0].restSeconds).toBe(120);
    // комментарии несут A/B разметку (A→B без отдыха, чередование)
    expect(a.comment).toMatch(/A→B/);
    expect(b.comment).toMatch(/Суперсет с «Жим лёжа»/);
  });

  it('same-muscle: компаунд+изоляция одной группы — тоже структурированы', () => {
    const plan: any = {
      pattern: {} as any, rationale: [],
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [
        { muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4, workSets: [{ reps: 8, rir: 2, weight: 100, restSeconds: 120 }] },
        { muscle: 'chest', name: 'Разводка', role: 'accessory', character: 'памп', sets: 3, workSets: [{ reps: 12, rir: 2, weight: 20, restSeconds: 90 }] },
      ] }] }],
    };
    markSameMuscleSupersets(plan);
    const [c, i] = plan.weeks[0].sessions[0].exercises;
    expect(c.supersetGroup).toBeDefined();
    expect(i.supersetGroup).toBe(c.supersetGroup);
    expect(c.supersetSlot).toBe(0);
    expect(i.supersetSlot).toBe(1);
    expect((c.workSets as any)[0].restSeconds).toBe(0);
  });

  it('детерминизм: одинаковая разметка при повторном вызове', () => {
    const { pairs: p1 } = mkPlan(markAntagonistSupersets);
    const { pairs: p2 } = mkPlan(markAntagonistSupersets);
    expect(p1[0][0].supersetGroup).toBe(p2[0][0].supersetGroup);
  });
});
