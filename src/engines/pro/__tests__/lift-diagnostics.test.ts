import { describe, expect, it } from 'vitest';
import {
  diagnoseLift, stickingPhases, barPathAnalysis, barPathIssuesForLift, barPathIssuesForPhase,
  diagnoseMovement, BAR_PATH_ISSUES, phaseForReps,
} from '../lift-diagnostics.engine';

describe('lift-diagnostics', () => {
  it('returns detailed diagnosis for supported sticking point', () => {
    const result = diagnoseLift('bench', 'lockout');
    expect(result).not.toBeNull();
    expect(result!.angleRangeDeg).toEqual([90, 180]);
    expect(result!.corrections.length).toBeGreaterThan(0);
    expect(result!.assistance.length).toBeGreaterThan(0);
  });
  it('returns diagnosis for all 7 lifts (A3: углы для ohp/row/pulldown/incline)', () => {
    expect(diagnoseLift('ohp', 'ohp_mid')).not.toBeNull();
    expect(diagnoseLift('row', 'row_start')).not.toBeNull();
    expect(diagnoseLift('pulldown', 'pd_squeeze')).not.toBeNull();
    expect(diagnoseLift('incline_press', 'inc_lockout')).not.toBeNull();
    expect(diagnoseLift('ohp', 'mid')).toBeNull();
  });
  it('P1: углы для triceps/calf/shrug (все 3 фазы, diagnoseLift не null)', () => {
    const t = diagnoseLift('triceps', 'triceps_mid');
    expect(t).not.toBeNull();
    expect(t!.angleRangeDeg).toEqual([30, 100]);
    expect(t!.weakMuscles.join(' ')).toContain('Трицепс');
    const c = diagnoseLift('calf', 'calf_bottom');
    expect(c).not.toBeNull();
    expect(c!.keyJoint).toContain('голеностоп');
    const s = diagnoseLift('shrug', 'shrug_top');
    expect(s).not.toBeNull();
    expect(s!.corrections.length).toBeGreaterThan(0);
    expect(stickingPhases('triceps')).toEqual(['triceps_start', 'triceps_mid', 'triceps_lockout']);
    expect(stickingPhases('calf')).toEqual(['calf_bottom', 'calf_mid', 'calf_top']);
    expect(stickingPhases('shrug')).toEqual(['shrug_start', 'shrug_mid', 'shrug_top']);
  });
  it('P1: сумо-ссылки едины (deadlift и sumo делят объекты)', () => {
    expect(diagnoseLift('deadlift', 'sumo_start')).not.toBeNull();
    expect(diagnoseLift('sumo', 'sumo_start')).not.toBeNull();
    expect(diagnoseLift('deadlift', 'sumo_start')!.angleRangeDeg).toEqual(diagnoseLift('sumo', 'sumo_start')!.angleRangeDeg);
    expect(diagnoseLift('deadlift', 'sumo_lockout')!.corrections).toEqual(diagnoseLift('sumo', 'sumo_lockout')!.corrections);
  });
  it('sumo-тяга: отдельные фазы с углами (сумо-старт и замыкание)', () => {
    const start = diagnoseLift('deadlift', 'sumo_start');
    expect(start).not.toBeNull();
    expect(start!.angleRangeDeg).toEqual([0, 20]);
    expect(start!.weakMuscles.join(' ')).toContain('Приводящие');
    const lockout = diagnoseLift('deadlift', 'sumo_lockout');
    expect(lockout).not.toBeNull();
    expect(lockout!.keyJoint).toContain('таз');
    expect(lockout!.corrections.length).toBeGreaterThan(0);
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

describe('phaseForReps — каноническая эвристика фазы срыва по повторениям', () => {
  it('reps ≤ 2 → фаза максимального момента для каждого движения', () => {
    expect(phaseForReps(2, 'squat')).toBe('bottom');
    expect(phaseForReps(1, 'bench')).toBe('off_chest');
    expect(phaseForReps(2, 'deadlift')).toBe('start');
    expect(phaseForReps(1, 'ohp')).toBe('ohp_start');
    expect(phaseForReps(2, 'row')).toBe('row_start');
    expect(phaseForReps(1, 'pulldown')).toBe('pd_top');
    expect(phaseForReps(2, 'incline_press')).toBe('inc_off');
    expect(phaseForReps(1, 'triceps')).toBe('triceps_start');
    expect(phaseForReps(2, 'calf')).toBe('calf_bottom');
    expect(phaseForReps(1, 'shrug')).toBe('shrug_start');
  });

  it('reps 3–5 → середина амплитуды (mid), если фаза есть у движения', () => {
    expect(phaseForReps(3, 'squat')).toBe('mid');
    expect(phaseForReps(5, 'bench')).toBe('mid');
    expect(phaseForReps(4, 'deadlift')).toBe('mid');
    expect(phaseForReps(3, 'ohp')).toBe('ohp_mid');
  });

  it('reps ≥ 6 → null (фаза не определяется)', () => {
    expect(phaseForReps(6, 'squat')).toBeNull();
    expect(phaseForReps(10, 'bench')).toBeNull();
    expect(phaseForReps(12, 'deadlift')).toBeNull();
  });

  it('некорректные повторения → null', () => {
    expect(phaseForReps(0, 'squat')).toBeNull();
    expect(phaseForReps(-1, 'bench')).toBeNull();
    expect(phaseForReps(NaN, 'deadlift')).toBeNull();
  });

  it('неизвестное движение → null', () => {
    expect(phaseForReps(3, 'sticking_mid' as any)).toBeNull();
  });
});
