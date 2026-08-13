import { describe, expect, it } from 'vitest';
import {
  diagnoseLift, stickingPhases, barPathAnalysis, barPathIssuesForLift, barPathIssuesForPhase,
  diagnoseMovement, BAR_PATH_ISSUES,
} from '../lift-diagnostics.engine';

describe('lift-diagnostics', () => {
  it('returns detailed diagnosis for supported sticking point', () => {
    const result = diagnoseLift('bench', 'lockout');
    expect(result).not.toBeNull();
    expect(result!.angleRangeDeg).toEqual([90, 180]);
    expect(result!.corrections.length).toBeGreaterThan(0);
    expect(result!.assistance.length).toBeGreaterThan(0);
  });
  it('returns no detailed diagnosis for unsupported phase', () => {
    expect(diagnoseLift('ohp', 'mid')).toBeNull();
  });
  it('lists phases and maps bar path issues', () => {
    expect(stickingPhases('squat')).toContain('bottom');
    const result = barPathAnalysis('deadlift', ['forward_drift', 'asymmetric']);
    expect(result.diagnoses).toHaveLength(2);
    expect(result.diagnoses[0].correction).toContain('RDL');
  });
});

describe('bar-path расширение (движение-специфичность + связь с фазой)', () => {
  it('barPathAnalysis фильтрует issues по движению', () => {
    // hips_shoot_up применим только к squat — для bench отбрасывается
    const result = barPathAnalysis('bench', ['hips_shoot_up', 'bar_loops']);
    expect(result.issues).toEqual(['bar_loops']);
    expect(result.diagnoses).toHaveLength(1);
    expect(result.diagnoses[0].issue).toBe('bar_loops');
  });

  it('каждый issue содержит ассистенты и связанную фазу', () => {
    const result = barPathAnalysis('squat', ['hips_shoot_up']);
    expect(result.diagnoses[0].assistance.length).toBeGreaterThan(0);
    expect(result.diagnoses[0].relatedPhase).toBe('bottom');
  });

  it('hips_shoot_up недоступен для bench (нет в lifts)', () => {
    expect(BAR_PATH_ISSUES.hips_shoot_up.lifts).not.toContain('bench');
    expect(barPathIssuesForLift('bench')).not.toContain('hips_shoot_up');
  });

  it('barPathIssuesForPhase связывает фазу с отклонением', () => {
    expect(barPathIssuesForPhase('squat', 'bottom')).toContain('hips_shoot_up');
    expect(barPathIssuesForPhase('squat', 'bottom')).toContain('forward_drift');
    expect(barPathIssuesForPhase('squat', 'lockout')).toContain('good_morning');
    expect(barPathIssuesForPhase('bench', 'mid')).toContain('bar_loops');
  });

  it('diagnoseMovement возвращает три ракурса по якорю (фаза)', () => {
    const m = diagnoseMovement('squat', 'bottom');
    expect(m.weakPoint.assistance.length).toBeGreaterThan(0);
    expect(m.sticking).not.toBeNull();
    expect(m.sticking!.angleRangeDeg).toEqual([0, 90]);
    expect(m.barPathRelated).toContain('hips_shoot_up');
    expect(m.barPathAll.length).toBeGreaterThanOrEqual(3);
  });

  it('diagnoseMovement для bench.mid связывает bar_loops', () => {
    const m = diagnoseMovement('bench', 'mid');
    expect(m.barPathRelated).toContain('bar_loops');
  });

  it('barPathAnalysis пустой список issues → пустые диагнозы', () => {
    const result = barPathAnalysis('squat', []);
    expect(result.diagnoses).toHaveLength(0);
  });
});
