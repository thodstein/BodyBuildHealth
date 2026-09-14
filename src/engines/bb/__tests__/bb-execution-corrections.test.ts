import { describe, expect, it } from 'vitest';
import { applyExecutionCorrections, type ExecutionCorrection } from '../bb-execution-corrections.engine';

/**
 * 3.10 (план BB-AUTO-EXHAUSTIVE-PRO): PROF-коррекции выполнения (темп/ROM/техника)
 * применяются ТОЛЬКО к выбранному targetId/targetName, а не ко всем упражнениям.
 */

function makePlan() {
  return {
    pattern: {},
    weeks: [
      {
        week: 1,
        sessions: [{
          exercises: [
            { name: 'Жим штанги лёжа', exerciseName: 'bench_bar', workSets: [{ reps: 8, rir: 2, weight: 80 }] },
            { name: 'Приседания со штангой', exerciseName: 'squat_bar', workSets: [{ reps: 5, rir: 2, weight: 120 }] },
          ],
        }],
      },
      {
        week: 2,
        sessions: [{
          exercises: [
            { name: 'Жим штанги лёжа', exerciseName: 'bench_bar', workSets: [{ reps: 8, rir: 2, weight: 82 }] },
            { name: 'Приседания со штангой', exerciseName: 'squat_bar', workSets: [{ reps: 5, rir: 2, weight: 122 }] },
          ],
        }],
      },
    ],
    rotationMuscleVolume: {},
    rationale: [],
  } as never;
}

describe('3.10 applyExecutionCorrections — гейт по targetId/targetName', () => {
  it('modifyTempo меняет только целевое упражнение (во всех неделях), прочие не тронуты', () => {
    const p: any = makePlan();
    const n = applyExecutionCorrections(p, [{ type: 'modifyTempo', tempo: '4-1-1-0', targetId: 'bench_bar' }]);
    expect(n).toBe(2);
    const w1 = p.weeks[0].sessions[0].exercises;
    expect(w1[0].tempo).toBe('4-1-1-0');
    expect(w1[0].tempoSpec).toBe('4-1-1-0');
    expect(w1[0].workSets[0].tempo).toBe('4-1-1-0');
    expect(w1[1].tempo).toBeUndefined();          // присед не тронут
    expect(w1[1].workSets[0].tempo).toBeUndefined();
    expect(w1[1].comment || '').not.toContain('PROF');
    expect(p.weeks[1].sessions[0].exercises[0].tempo).toBe('4-1-1-0');
  });

  it('modifyROM по targetName (кириллица) — только цель', () => {
    const p: any = makePlan();
    applyExecutionCorrections(p, [{ type: 'modifyROM', rom: 'пауза 1с', targetName: 'Приседания со штангой' }]);
    const ex = p.weeks[0].sessions[0].exercises;
    expect(ex[1].pauseSeconds).toBe(1);
    expect(ex[1].stretchPhase).toBe(true);
    expect(ex[0].pauseSeconds).toBeUndefined();
    expect(ex[0].stretchPhase).toBeUndefined();
  });

  it('modifyExecution без цели — legacy: применяется ко всем', () => {
    const p: any = makePlan();
    const n = applyExecutionCorrections(p, [{ type: 'modifyExecution', execCues: ['лопатки вниз', 'локти под 45°'] }]);
    expect(n).toBe(4);
    for (const w of p.weeks) for (const s of w.sessions) for (const ex of s.exercises) {
      expect(ex.comment).toContain('PROF');
    }
  });

  it('цель не найдена — ничего не меняется', () => {
    const p: any = makePlan();
    const n = applyExecutionCorrections(p, [{ type: 'modifyTempo', tempo: '3-1-1-0', targetId: 'nope_bar' }]);
    expect(n).toBe(0);
    for (const w of p.weeks) for (const s of w.sessions) for (const ex of s.exercises) {
      expect(ex.tempo).toBeUndefined();
    }
  });

  it('пустой список и неизвестный тип безопасны', () => {
    const p: any = makePlan();
    expect(applyExecutionCorrections(p, [])).toBe(0);
    expect(applyExecutionCorrections(p, [{ type: 'unknown' } as ExecutionCorrection])).toBe(0);
  });
});
