/**
 * bb-taper-fill.test.ts — fill-проход не раздувает generic-taper недели.
 *
 * Баг: applyTaperToFinalWeeks резал последние недели (×0.75/×0.50), а идущий
 * следом fill-проход видел «в сессии нет traps/abs» и добавлял 3–4 сета в те
 * же недели — тейпер частично откатывался. Prep-недели были защищены
 * (isPrepControlled), generic-taper — нет (isGenericTaperWeek не проверялся).
 *
 * Фикс: fill пропускает и prep-, и generic-taper-недели (прецедент — жёсткий
 * leg-инвариант ниже по файлу уже скипает обе категории).
 */
import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

function mkEx(muscle: string, name: string, sets: number, role = 'accessory', character = 'памп') {
  return {
    muscle, name, role, character, sets,
    repsRange: [10, 12], rir: 2,
    workSets: Array.from({ length: sets }, () => ({ reps: 10, rir: 2, weight: 20 })),
  } as any;
}

function mkSession(withTraps: boolean) {
  const exs = [mkEx('chest', 'Жим лёжа', 4, 'primary', 'тяж')];
  if (withTraps) exs.push(mkEx('traps', 'Шраги', 5));
  return { day: 1, sessionTag: 'Upper', character: 'тяж', exercises: exs } as any;
}

function mkPlan() {
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    week: i + 1,
    sessions: [mkSession(true), mkSession(false)],
  }));
  return { pattern: { id: 'upper_lower_4' }, rationale: [], rotationMuscleVolume: {}, weeks } as any;
}

const hasTraps = (s: any) => s.exercises.some((e: any) => e.muscle === 'traps');

describe('fill skips generic taper weeks', () => {
  it('сессии без трапеций в неделях 6–8 НЕ получают fill-добор', () => {
    const out = finalizeBBPlan(mkPlan(), { level: 'intermediate' });
    for (const w of out.weeks.slice(5, 8)) {
      expect(hasTraps(w.sessions[1])).toBe(false);
    }
  });

  it('fill продолжает работать в рабочих неделях 1–5', () => {
    const out = finalizeBBPlan(mkPlan(), { level: 'intermediate' });
    for (const w of out.weeks.slice(0, 5)) {
      expect(hasTraps(w.sessions[1])).toBe(true);
    }
  });
});
