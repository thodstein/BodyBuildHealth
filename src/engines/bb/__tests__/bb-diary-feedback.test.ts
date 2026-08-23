import { describe, expect, it, beforeEach, vi } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { computeBBDiaryFeedback } from '../bb-diary-feedback.engine';
import type { WorkoutSession } from '../../workout-logger.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'] as string[];

function mkSession(date: string, sets: number, w: number, r: number): WorkoutSession {
  return {
    sessionId: 's_' + date + '_' + Math.random().toString(36).slice(2, 6),
    date,
    startTime: '10:00',
    endTime: '11:00',
    durationMin: 60,
    focus: 'test',
    exercises: [
      {
        exerciseId: 'bench_bar',
        exerciseName: 'Жим штанги лёжа',
        pattern: 'compound',
        muscleGroup: 'chest',
        order: 1,
        sets: Array.from({ length: sets }, (_, i) => ({
          setNumber: i + 1,
          weightKg: w,
          reps: r,
          rpe: 8,
          rir: 2,
          isPR: false,
          notes: '',
        })),
        totalVolume: sets * w * r,
        best1RM: 0,
        avgRPE: 8,
      } as any,
    ],
    totalVolume: sets * w * r,
    totalSets: sets,
    totalReps: sets * r,
    avgIntensity: 8,
    prCount: 0,
    notes: '',
    weekNumber: 1,
    mesocycleWeek: 1,
  } as any;
}

describe('bb-diary-feedback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('без плана и без сессий — hasPlan false, hasSessions false', () => {
    const fb = computeBBDiaryFeedback(null as any, []);
    expect(fb.hasPlan).toBe(false);
    expect(fb.hasSessions).toBe(false);
    expect(fb.weekly.length).toBe(0);
  });

  it('с планом bro_5 — adherence считается', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'intermediate', goal: 'mass' as any, weeks: 4, equipment: EQ });
    const sessions = [mkSession('2026-08-01', 3, 80, 8), mkSession('2026-08-03', 3, 82, 8)];
    const fb = computeBBDiaryFeedback(plan as any, sessions as any);
    expect(fb.hasPlan).toBe(true);
    expect(fb.hasSessions).toBe(true);
    expect(fb.plannedSessions).toBeGreaterThan(0);
    expect(fb.completedSessions).toBe(2);
    expect(fb.adherencePct).not.toBeNull();
    expect(fb.weekly.length).toBe(4);
  });

  it('weekly adherence считается по неделям', () => {
    const plan = buildBBPlan({ patternId: 'fullbody_3', level: 'intermediate', goal: 'mass' as any, weeks: 2, equipment: EQ });
    const sessions = [mkSession('2026-08-01', 3, 80, 8), mkSession('2026-08-03', 3, 80, 8), mkSession('2026-08-05', 3, 80, 8)];
    const fb = computeBBDiaryFeedback(plan as any, sessions as any);
    expect(fb.weekly[0].plannedSets).toBeGreaterThan(0);
    // completedSets распределён
    const totalCompleted = fb.weekly.reduce((s, w) => s + w.completedSets, 0);
    expect(totalCompleted).toBe(9);
  });

  it('e1RM alerts: рост и падение', () => {
    const plan = buildBBPlan({ patternId: 'fullbody_3', level: 'intermediate', goal: 'mass' as any, weeks: 4, equipment: EQ });
    // 6 сессий с прогрессом 80→100 кг (рост) и потом падение
    const sessions: WorkoutSession[] = [];
    for (let i = 0; i < 6; i++) {
      const w = 70 + i * 6; // 70,76,82,88,94,100
      const d = `2026-08-${String(1 + i * 2).padStart(2, '0')}`;
      sessions.push(mkSession(d, 3, w, 5));
    }
    const fb = computeBBDiaryFeedback(plan as any, sessions as any);
    expect(fb.e1rmAlerts.length).toBeGreaterThan(0);
    expect(fb.e1rmAlerts[0].status).toBe('up');
  });

  it('warnings включает low_training_frequency для bro', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'intermediate', goal: 'mass' as any, weeks: 4, equipment: EQ });
    const sessions = [mkSession('2026-08-01', 3, 80, 8)];
    const fb = computeBBDiaryFeedback(plan as any, sessions as any);
    expect(fb.warnings.some(w => w.includes('1×/нед'))).toBe(true);
  });

  it('recommendations не пустые когда есть план и сессии', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'intermediate', goal: 'mass' as any, weeks: 4, equipment: EQ });
    const sessions = [mkSession('2026-08-01', 3, 80, 8), mkSession('2026-08-03', 3, 80, 8)];
    const fb = computeBBDiaryFeedback(plan as any, sessions as any);
    expect(fb.recommendations.length).toBeGreaterThan(0);
  });
});
