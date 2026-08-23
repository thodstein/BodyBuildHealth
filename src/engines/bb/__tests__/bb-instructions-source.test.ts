import { describe, expect, it } from 'vitest';
import { buildExerciseInstructions } from '../bb-exercise-instructions.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { buildBBPlan } from '../bb-builder.engine';

/* ═══════════════════════════════════════════════════════════════════
 * Честный source инструкций: 'exercise-lab' ТОЛЬКО при реальной bio-записи
 * или target-muscle покрытии (без маскировки generic-fallback'ом).
 * ═══════════════════════════════════════════════════════════════════ */

describe('BB instructions — честный источник (lab/catalog/generic)', () => {
  it('все упражнения реальных ББ-планов имеют source exercise-lab', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
      equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
      volumeGoal: 'mav',
    });
    const byName = new Map(EXERCISE_CATALOG.map(e => [e.name, e]));
    let checked = 0;
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (!e.name || e.name === 'Разминка') continue;
      const ex = byName.get(e.name);
      if (!ex) continue;
      const p = buildExerciseInstructions({ exerciseId: ex.id, exerciseName: ex.name, muscle: ex.group });
      expect(p.source, `${ex.id} должен быть exercise-lab`).toBe('exercise-lab');
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('экзотика/кардио без lab-записи честно помечается catalog (не лаборатория)', () => {
    const tgu = EXERCISE_CATALOG.find(e => e.id === 'kb_tgu');
    expect(tgu).toBeDefined();
    const p = buildExerciseInstructions({ exerciseId: tgu!.id, exerciseName: tgu!.name, muscle: tgu!.group });
    expect(p.source).toBe('catalog');
    expect(p.cues.length).toBeGreaterThan(0);
  });

  it('неизвестное упражнение — generic с fallback-подсказками', () => {
    const p = buildExerciseInstructions({ exerciseName: 'Совершенно неизвестное движение', muscle: 'core' });
    expect(p.source).toBe('generic');
    expect(p.cues.length).toBeGreaterThan(0);
    expect(p.tempo).toBeTruthy();
  });

  it('классические ББ-упражнения (жим/тяга/присед) — exercise-lab', () => {
    for (const id of ['bench_bar', 'row_bar', 'squat', 'lateral_raise_v2', 'tricep_pushdown_rope', 'curl_ez']) {
      const ex = EXERCISE_CATALOG.find(e => e.id === id)!;
      const p = buildExerciseInstructions({ exerciseId: ex.id, exerciseName: ex.name, muscle: ex.group });
      expect(p.source, `${id}`).toBe('exercise-lab');
    }
  });
});