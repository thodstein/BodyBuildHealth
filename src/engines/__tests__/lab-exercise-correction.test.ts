/**
 * lab-exercise-correction.test.ts — Epic E: ранжир reuse + жёсткие фильтры + симулятор + мост.
 */
import { describe, it, expect } from 'vitest';
import {
  prescribeLabCorrections,
  simulateLabCorrection,
  buildLabBridgeData,
} from '../lab-exercise-correction.engine';
import { diagnoseLabExercise } from '../lab-exercise-diagnosis.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { isForbiddenReplacement } from '../lab-exercise-correction.engine';

function cat(id: string) {
  const found = EXERCISE_CATALOG.find((c) => c.id === id);
  if (!found) throw new Error(`no catalog ${id}`);
  return { id: found.id, name: found.name, muscle: found.group };
}

function planWith(ids: string[]) {
  return {
    weeks: [
      {
        sessions: [
          {
            exercises: ids.map((id) => {
              const c = EXERCISE_CATALOG.find((x) => x.id === id);
              return { exerciseName: id, name: c?.name || id, muscle: c?.group || 'chest', sets: 3, rir: 2 };
            }),
          },
        ],
      },
    ],
  };
}

describe('lab-exercise-correction', () => {
  it('substitute при lowSFR: bench_bar → цель с именем', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const actions = prescribeLabCorrections(d, cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const sub = actions.find((a) => a.type === 'substitute' && a.targetId);
    expect(sub).toBeTruthy();
    expect(sub!.confidence).toBeGreaterThan(0.5);
  });

  it('mobilitySwap при jointRisk: травма плеча на dips_chest', () => {
    const d = diagnoseLabExercise(cat('dips_chest'), {
      goal: 'strength',
      muscle: 'chest',
      injuries: ['shoulder'],
    });
    expect(d.flags).toContain('jointRisk');
    const actions = prescribeLabCorrections(d, cat('dips_chest'), {
      goal: 'strength',
      muscle: 'chest',
      injuries: ['shoulder'],
    });
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].confidence).toBeGreaterThanOrEqual(actions[actions.length - 1].confidence);
  });

  it('unilateral при asym 9%: действие есть (цель или инструкция)', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      asymPct: 9,
    });
    expect(d.flags).toContain('unilateralGap');
    const actions = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      asymPct: 9,
    });
    expect(actions.some((a) => a.type === 'unilateral')).toBe(true);
  });

  it('add при uncoveredSubregion', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      uncoveredSubregions: ['chest_upper'],
    });
    const actions = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
    });
    expect(actions.some((a) => a.type === 'add' && a.targetId)).toBe(true);
  });

  it('modifyTempo при tempoMismatch', () => {
    const d = diagnoseLabExercise(cat('incline_db'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      planTempo: '2-0-2-0',
    });
    expect(d.flags).toContain('tempoMismatch');
    const actions = prescribeLabCorrections(d, cat('incline_db'), {
      goal: 'hypertrophy',
      muscle: 'chest',
    });
    expect(actions.some((a) => a.type === 'modifyTempo' && !!a.tempo)).toBe(true);
  });

  it('confidence строго по убыванию', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      asymPct: 9,
      singleAngleMuscle: 'chest',
      strictMissing: ['chest_fly'],
    });
    const actions = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      asymPct: 9,
    });
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].confidence).toBeGreaterThanOrEqual(actions[i].confidence);
    }
  });

  it('оборудование: при bodyweight-only все цели — bodyweight', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const actions = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      equipment: ['bodyweight'],
    });
    const targets = actions.filter((a) => a.targetId);
    for (const a of targets) {
      const t = EXERCISE_CATALOG.find((c) => c.id === a.targetId);
      expect(t?.equipment).toBe('bodyweight');
    }
  });

  it('канон запрета: substitute/mobilitySwap не предлагают forbidden-цели', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const actions = prescribeLabCorrections(d, cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    expect(actions.some((a) => a.targetId)).toBe(true);
    for (const a of actions) {
      if ((a.type === 'substitute' || a.type === 'mobilitySwap') && a.targetId) {
        expect(isForbiddenReplacement('bench_bar', a.targetId)).toBe(false);
      }
    }
  });

  it('beginnerNote на modifyROM для новичка', () => {
    const d = diagnoseLabExercise(cat('incline_db'), { goal: 'hypertrophy', muscle: 'chest' });
    const actions = prescribeLabCorrections(d, cat('incline_db'), {
      goal: 'hypertrophy',
      muscle: 'chest',
      level: 'beginner',
    });
    const rom = actions.find((a) => a.type === 'modifyROM');
    if (rom) expect(rom.beginnerNote).toMatch(/полная амплитуда/);
  });

  it('симулятор: Δ-превью замены без мутации плана', () => {
    const plan = planWith(['bench_bar']);
    const before = JSON.stringify(plan);
    const d = diagnoseLabExercise(cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const sub = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
    }).find((a) => a.type === 'substitute' && a.targetId);
    expect(sub).toBeTruthy();
    const delta = simulateLabCorrection(plan, sub!, 'bench_bar');
    expect(delta).not.toBeNull();
    expect(typeof delta!.summary).toBe('string');
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('симулятор: fatigue/lengthened Δ определены или null, но не throw', () => {
    const delta = simulateLabCorrection(planWith(['bench_bar']), {
      type: 'modifyTempo',
      tempo: '3-1-1-0',
      reason: 't',
      confidence: 0.5,
    } as never, 'bench_bar');
    expect(delta).not.toBeNull();
  });

  it('симулятор: null без плана', () => {
    expect(
      simulateLabCorrection(null, { type: 'add', reason: 'x', confidence: 1 } as never),
    ).toBeNull();
  });

  it('мост: форма WeakpointsPayload (preferred/swap/labDiagnosis/labCorrection/labDelta)', () => {
    const d = diagnoseLabExercise(cat('bench_bar'), { goal: 'hypertrophy', muscle: 'chest' });
    const sub = prescribeLabCorrections(d, cat('bench_bar'), {
      goal: 'hypertrophy',
      muscle: 'chest',
    }).find((a) => a.type === 'substitute' && a.targetId)!;
    const data = buildLabBridgeData({
      action: sub,
      exId: 'bench_bar',
      exName: 'Жим',
      diagnosis: d,
      delta: null,
    });
    expect(data.preferredExerciseIds).toEqual([sub.targetId]);
    expect(data.exerciseSwap).toEqual({ oldId: 'bench_bar', newId: sub.targetId });
    expect(data.labDiagnosis.flags).toEqual(d.flags);
    expect(data.labDiagnosis.score).toBe(d.score);
    expect(data.labCorrection.type).toBe('substitute');
    expect(data.labDelta).toBeNull();
  });
});
