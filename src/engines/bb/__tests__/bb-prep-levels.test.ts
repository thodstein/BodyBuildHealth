/**
 * bb-prep-levels.test.ts — prep-план не увозит HARD-движения мимо гейта уровней.
 *
 * Дыра: prep early-return в finalizeBBPlan (одна prep-размеченная неделя —
 * весь план мимо всех проходов) пропускал и safety-backstop enforceExerciseLevels
 * (он стоит в конце пайплайна). Итог: новичок с prep-разметкой после revalidate
 * оставался со штанговым приседом/становой.
 *
 * Фикс: levels-gate выполняется и в prep-ветке до return (только имена/вес,
 * объём инвариантен — prep-кривой не касается).
 */
import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

function mkEx(name: string, muscle: string, sets: number) {
  return {
    muscle, name, role: 'primary', character: 'тяж', sets,
    repsRange: [6, 8], rir: 2,
    workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 60 })),
  } as any;
}

function mkPlan() {
  return {
    pattern: { id: 'upper_lower_4' },
    rationale: [],
    rotationMuscleVolume: {},
    weeks: [
      { week: 1, prepProtocol: 'Подготовка: RIR 1–3', sessions: [{ day: 1, sessionTag: 'Lower', exercises: [mkEx('Приседания со штангой на спине', 'quads', 4)] }] },
      { week: 2, sessions: [{ day: 1, sessionTag: 'Lower', exercises: [mkEx('Приседания со штангой на спине', 'quads', 4)] }] },
    ],
  } as any;
}

describe('prep-ветка не скипает гейт уровней', () => {
  it('новичок + prep-разметка: присед → регрессия с пометкой', () => {
    const out = finalizeBBPlan(mkPlan(), { level: 'beginner' });
    const names = out.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.name)));
    expect(names.some(n => n === 'Приседания со штангой на спине')).toBe(false);
    const rationale = out.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => String(e.rationale || ''))));
    expect(rationale.some(r => r.includes('Замена по уровню'))).toBe(true);
  });

  it('объём prep-плана гейтом не меняется (только имена)', () => {
    const out = finalizeBBPlan(mkPlan(), { level: 'beginner' });
    const total = out.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).reduce((a, e) => a + e.sets, 0);
    expect(total).toBe(8);
  });
});
