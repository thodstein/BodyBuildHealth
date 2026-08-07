import { describe, expect, it } from 'vitest';
import { buildHistoryContext, generateInsights, createSession, createSet } from '../diary-engine';
import type { DiarySession, DiarySet } from '../diary-engine';

describe('buildHistoryContext', () => {
  const makeSession = (id: string, date: string, completed = true): DiarySession => ({
    sessionId: id, date, focus: 'fullbody', durationMin: 60, completed, terminatedEarly: false,
    sessionVolume: 1000, sessionIntensity: 7, overallRPE: 7, notes: '',
  });

  const makeSet = (sid: string, exId: string, weight: number, reps: number, rpe = 7, rir = 3): DiarySet => ({
    setId: `${sid}_0`, sessionId: sid, exerciseId: exId, exerciseName: exId,
    setIndex: 1, targetReps: reps, targetWeight: weight, actualReps: reps, actualWeight: weight,
    actualRPE: rpe, actualRIR: rir, errors: [], restSeconds: 120, terminatedEarly: false,
  });

  it('computes last weights and 1RMs per exercise', () => {
    const s1 = makeSession('s1', '2026-07-01');
    const s2 = makeSession('s2', '2026-07-08');
    const sets = [
      makeSet('s1', 'squat', 100, 5),
      makeSet('s2', 'squat', 105, 5),
      makeSet('s1', 'bench', 80, 5),
    ];
    const ctx = buildHistoryContext(sets, [s1, s2]);
    expect(ctx.lastWeights['squat']).toBe(105);
    expect(ctx.lastWeights['bench']).toBe(80);
    expect(ctx.last1RMs['squat']).toBeGreaterThan(100);
  });

  it('computes weekly volume from last 7 days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const s1 = makeSession('s1', weekAgo);
    const s2 = makeSession('s2', today);
    const sets = [
      makeSet('s1', 'squat', 100, 5),
      makeSet('s2', 'squat', 100, 5),
    ];
    const ctx = buildHistoryContext(sets, [s1, s2]);
    expect(ctx.weeklyVolume).toBe(1000);
  });

  it('computes streak correctly with date gaps', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const s1 = makeSession('s1', dayBefore);
    const s2 = makeSession('s2', yesterday);
    const s3 = makeSession('s3', today);
    const sets = [makeSet('s1', 'squat', 100, 5), makeSet('s2', 'squat', 100, 5), makeSet('s3', 'squat', 100, 5)];
    const ctx = buildHistoryContext(sets, [s1, s2, s3]);
    expect(ctx.currentStreak).toBe(3);
    expect(ctx.bestStreak).toBe(3);
  });

  it('resets streak when gap > 1.5 days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const s1 = makeSession('s1', threeDaysAgo);
    const s2 = makeSession('s2', today);
    const sets = [makeSet('s1', 'squat', 100, 5), makeSet('s2', 'squat', 100, 5)];
    const ctx = buildHistoryContext(sets, [s1, s2]);
    expect(ctx.currentStreak).toBe(1);
    expect(ctx.bestStreak).toBe(1);
  });
});

describe('generateInsights', () => {
  it('detects strength improvement >5%', () => {
    const oldSession = { sessionId: 's1', date: '2026-07-01', focus: 'fullbody', durationMin: 60, completed: true, terminatedEarly: false, sessionVolume: 1000, sessionIntensity: 7, overallRPE: 7, notes: '' };
    const newSession = { sessionId: 's2', date: '2026-07-08', focus: 'fullbody', durationMin: 60, completed: true, terminatedEarly: false, sessionVolume: 1000, sessionIntensity: 7, overallRPE: 7, notes: '' };
    const oldSets = [{ ...{ setId: 's1_0', sessionId: 's1', exerciseId: 'squat', exerciseName: 'squat', setIndex: 1, targetReps: 5, targetWeight: 100, actualReps: 5, actualWeight: 100, actualRPE: 7, actualRIR: 3, errors: [], restSeconds: 120, terminatedEarly: false } }];
    const newSets = [{ ...{ setId: 's2_0', sessionId: 's2', exerciseId: 'squat', exerciseName: 'squat', setIndex: 1, targetReps: 5, targetWeight: 100, actualReps: 5, actualWeight: 110, actualRPE: 7, actualRIR: 3, errors: [], restSeconds: 120, terminatedEarly: false } }];
    const insights = generateInsights(newSets, [newSession], oldSets);
    expect(insights.some(i => i.type === 'positive' && i.category === 'strength')).toBe(true);
  });

  it('detects 3 heavy sessions in a row', () => {
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      sessionId: `s${i}`, date: `2026-07-0${i + 1}`, focus: 'fullbody', durationMin: 60,
      completed: true, terminatedEarly: false, sessionVolume: 1000, sessionIntensity: 9, overallRPE: 9, notes: '',
    }));
    const sets: DiarySet[] = [];
    const insights = generateInsights(sets, sessions);
    expect(insights.some(i => i.category === 'recovery')).toBe(true);
  });
});

describe('createSession and createSet', () => {
  it('createSession fills defaults', () => {
    const s = createSession({});
    expect(s.date).toBe(new Date().toISOString().slice(0, 10));
    expect(s.focus).toBe('fullbody');
    expect(s.completed).toBe(true);
  });

  it('createSet fills defaults', () => {
    const s = createSet({});
    expect(s.actualRPE).toBe(5);
    expect(s.actualRIR).toBe(3);
    expect(s.restSeconds).toBe(120);
  });
});
