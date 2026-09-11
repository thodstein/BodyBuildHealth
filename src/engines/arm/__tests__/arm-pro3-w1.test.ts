import { describe, it, expect } from 'vitest';
import { diagnoseVbt, vbtMeasureCount } from '../arm-vbt-capture.engine';
import { estimateForceVector } from '../arm-force-capture.engine';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';

/**
 * PRO-3 W1: честность — P1 (VBT два замера), P2 (Force ≥2 + нет mock-плана), P6 (движковая часть: топ-3 как был).
 */
describe('PRO-3 W1 P1: VBT двухзамерный', () => {
  it('0 замеров — хинт про два подхода', () => {
    const v = diagnoseVbt([]);
    expect(v.velocityLossPct).toBeNull();
    expect(v.zone).toBe('ok');
    expect(v.advice).toContain('двух подходов');
  });
  it('1 замер — хинт про 2-й подход (не тот же текст, что 0)', () => {
    const v = diagnoseVbt([{ weight: 50, reps: 5, velocityMs: 0.8 }]);
    expect(v.velocityLossPct).toBeNull();
    expect(v.zone).toBe('ok');
    expect(v.advice).toContain('2-й подход');
    expect(v.advice).not.toBe(diagnoseVbt([]).advice);
  });
  it('2 замера — loss считается', () => {
    const v = diagnoseVbt([
      { weight: 50, reps: 5, velocityMs: 1.0 },
      { weight: 50, reps: 5, velocityMs: 0.8 },
    ]);
    expect(v.velocityLossPct).toBe(20);
  });
  it('vbtMeasureCount: 0/1/2', () => {
    expect(vbtMeasureCount([])).toBe(0);
    expect(vbtMeasureCount([{ weight: 1, reps: 1, velocityMs: 0.8 }])).toBe(1);
    expect(vbtMeasureCount([
      { weight: 1, reps: 1, velocityMs: 0.8 },
      { weight: 1, reps: 1 },
    ])).toBe(1);
  });
  it('W5b: legacy vbtForExercise пинится числами, канон — через thresholdsFor', async () => {
    const { vbtForExercise, thresholdsFor } = await import('../arm-vbt-capture.engine');
    expect(vbtForExercise('wrist_curl_belt')).toEqual({ warnPct: 20, stopPct: 30 });
    expect(vbtForExercise('rolling_thunder')).toEqual({ warnPct: 15, stopPct: 25 });
    // с weakPoint всегда побеждает канон точки, а не legacy exerciseId
    expect(thresholdsFor('wrist_curl_belt', 'cup_start')).toEqual(
      thresholdsFor('rolling_thunder', 'cup_start'),
    );
  });
});

describe('PRO-3 W1 P2: Force честный', () => {
  it('1 вектор — total есть, но scoreReliable=false, filledCount=1', () => {
    const v = estimateForceVector({ rtKg: 130.5 } as any);
    expect(v.totalScore).toBe(100);
    expect(v.filledCount).toBe(1);
    expect(v.scoreReliable).toBe(false);
  });
  it('2 вектора — reliable', () => {
    const v = estimateForceVector({ rtKg: 60, sideKg: 40, bodyWeightKg: 80 } as any);
    expect(v.filledCount).toBe(2);
    expect(v.scoreReliable).toBe(true);
  });
  it('пусто — filledCount 0, total 0', () => {
    const v = estimateForceVector({} as any);
    expect(v.filledCount).toBe(0);
    expect(v.scoreReliable).toBe(false);
    expect(v.totalScore).toBe(0);
  });
  it('без плана и side-точки — humerus пуст + честная info (без mock-8)', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: {}, grip: {}, level: 'intermediate', technique: 'balanced',
      tableSessions: 2, totalSessions: 4, tendonSets: 8,
    });
    expect(r.humerusWarnings.length).toBe(0);
    expect(r.info.some((t) => t.includes('План не подключён') === false)).toBe(true); // без точек — тишина
  });
  it('без плана + side-точка — честное humerus-предупреждение (не псевдо-гейт)', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: { sidePressureFails: true }, grip: {}, level: 'intermediate', technique: 'press',
      tableSessions: 2, totalSessions: 4, tendonSets: 8,
    });
    expect(r.humerusWarnings.length).toBeGreaterThan(0);
    expect(r.humerusWarnings[0]).toContain('side_pressure');
    expect(r.humerusWarnings[0]).toContain('план не подключён');
    expect(r.humerusWarnings[0]).not.toContain('8 сетов');
  });
  it('без плана scoring не ставит side=8 (sideSetsWeek1=0)', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: { sidePressureFails: true }, grip: {},
      vbtRecords: [{ weight: 50, reps: 5, velocityMs: 1.0 }, { weight: 50, reps: 5, velocityMs: 0.5 }],
      level: 'intermediate', technique: 'press', tableSessions: 2, totalSessions: 4, tendonSets: 8,
    });
    const sideFinding = r.scoring?.findings.find((f) => f.text.startsWith('Side'));
    expect(sideFinding?.text).toContain('Side 0');
  });
});
