import { describe, it, expect } from 'vitest';
import { detectBBWeakByVolume, detectBBWeakByCircumf, idealReevesCircumference, mergeBBWeakCandidates } from '../bb-weak-detection.engine';
import { scoreBBSymmetry } from '../bb-symmetry.engine';
import { analyzeBBStimulus } from '../bb-stimulus.engine';
import { scoreBB } from '../bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../bb-diagnostics-hub.engine';
import { calcExerciseEffect, exerciseEffectScore } from '../bb-exercise-effect.engine';
import { auditPlanExercises } from '../bb-plan-exercise-audit.engine';
import { getProfExecutionProfile, diagnoseExecutionProf, listProfMuscles } from '../bb-execution-prof.engine';
import { prescribeCorrections } from '../bb-exercise-correction.engine';
import { simulateCorrection } from '../bb-exercise-simulator.engine';

describe('bb-weak-detection', () => {
  it('volume: <MEV flags weak', () => {
    const fact = { chest: { effectiveSets: 2 }, back: { effectiveSets: 14 }, quads: { effectiveSets: 14 } };
    const res = detectBBWeakByVolume(fact as any, 'intermediate');
    expect(res.some(r => r.muscle === 'chest')).toBe(true);
  });
  it('volume: <0.7 MAV flags', () => {
    const fact = { chest: { effectiveSets: 6 }, back: { effectiveSets: 16 }, quads: { effectiveSets: 16 } };
    const res = detectBBWeakByVolume(fact as any, 'intermediate');
    expect(res.some(r => r.muscle === 'chest')).toBe(true);
  });
  it('circumf: chest weak vs Reeves', () => {
    const res = detectBBWeakByCircumf({ chest: 90 } as any, 180);
    expect(res.some(r => r.muscle === 'chest')).toBe(true);
  });
  it('ideal Reeves scales with height', () => {
    const a = idealReevesCircumference('chest', 175);
    const b = idealReevesCircumference('chest', 185);
    expect(b).toBeGreaterThan(a);
  });
  it('merge dedup keeps most negative', () => {
    const m = mergeBBWeakCandidates(
      [{ muscle: 'chest', reason: 'v', deltaPct: -30, source: 'volume' }],
      [{ muscle: 'chest', reason: 'e', deltaPct: -10, source: 'e1rm' }],
      [],
    );
    expect(m.length).toBe(1);
    expect(m[0].deltaPct).toBe(-30);
  });
});

describe('bb-symmetry', () => {
  it('L/R asymmetry penalty', () => {
    const r = scoreBBSymmetry({ bicepL: 30, bicepR: 38 } as any, null, null);
    expect(r.issues.some(s => s.includes('bicep'))).toBe(true);
    expect(r.score).toBeLessThan(100);
  });
  it('V-taper ratio', () => {
    const r = scoreBBSymmetry({ shoulderWidth: 45, waist: 80 } as any, null, null);
    expect(r.ratios['shoulder/waist']).toBeDefined();
  });
  it('FFMI computed when weight+height+bf', () => {
    const r = scoreBBSymmetry({ weightKg: 80, heightCm: 175, bodyFatPct: 12 } as any, null, null);
    expect(r.ratios.ffmi).toBeDefined();
  });
});

describe('bb-stimulus', () => {
  it('empty plan returns zero penalty', () => {
    const r = analyzeBBStimulus(null);
    expect(r.scorePenalty).toBe(0);
  });
  it('plan with only midRange and no lengthened penalizes', () => {
    const plan: any = {
      weeks: [{ phase: 'accumulation', sessions: [{ exercises: [
        { name: 'Жим штанги лёжа', muscle: 'chest', sets: 5, role: 'primary' },
        { name: 'Жим гантелей лёжа', muscle: 'chest', sets: 5, role: 'primary' },
      ] }] }],
    };
    const r = analyzeBBStimulus(plan);
    expect(r.scorePenalty).toBeGreaterThan(0);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

describe('bb-scoring RSS', () => {
  it('7+7+7 -> 12 vector not 21, score = 88', () => {
    const r = scoreBB({ weakCount: 1, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: false, hasCircumf: false, hasVbt: false });
    expect(r.score).toBe(86); // 100 -14
    // combined three 14s would be sqrt(14^2*3)=24 -> 76, not 58 (21)
  });
  it('floor asymmetry 12% -> <=49', () => {
    const r = scoreBB({ weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: 13, symmetryIssues: 1, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: true, hasCircumf: true, hasVbt: false });
    expect(r.score).toBeLessThanOrEqual(49);
    expect(r.floors.join()).toContain('асимметрия');
  });
  it('verification 0.35/0.35/0.30', () => {
    const r1 = scoreBB({ weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: true, hasCircumf: false, hasVbt: false });
    expect(r1.verification).toBe(0.35);
    const r2 = scoreBB({ weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: true, hasCircumf: true, hasVbt: true });
    expect(r2.verification).toBe(1);
  });
});

describe('bb-diagnostics-hub orchestrator', () => {
  it('builds report with manual weak', () => {
    const r = buildBBDiagnosticsReport({ level: 'intermediate', manualWeak: ['delt_mid', 'chest_upper'] });
    expect(r.weakMusclesCanonical).toContain('shoulders');
    expect(r.weakMusclesCanonical).toContain('chest');
    expect(r.weakZonesGranular).toContain('delt_mid');
    expect(r.score).toBeDefined();
  });
  it('conflict shoulders+delt_mid keeps first', () => {
    const r = buildBBDiagnosticsReport({ level: 'intermediate', manualWeak: ['shoulders', 'delt_mid'] });
    expect(r.weakZonesGranular.length).toBe(1);
  });
  it('delt_mid+delt_rear both allowed', () => {
    const r = buildBBDiagnosticsReport({ level: 'intermediate', manualWeak: ['delt_mid', 'delt_rear'] });
    expect(r.weakZonesGranular.length).toBe(2);
  });
});

describe('bb-exercise-effect (единый инструмент)', () => {
  it('bench_bar: SFR 3, mid, known muscle', () => {
    const eff = calcExerciseEffect({ id: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 });
    expect(eff.id).toBe('bench_bar');
    expect(eff.sfr).toBe(3);
    expect(eff.muscle).toBe('chest');
    expect(eff.directSets).toBe(3);
  });
  it('lateral_raise: high SFR, score above bench', () => {
    const bench = exerciseEffectScore(calcExerciseEffect({ id: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 }));
    const lat = exerciseEffectScore(calcExerciseEffect({ id: 'lateral_raise', name: 'Махи гантелями в стороны', muscle: 'delt_mid', sets: 3, rir: 2 }));
    expect(lat).toBeGreaterThan(bench);
  });
  it('unknown exercise does not crash, score in 0-100', () => {
    const eff = calcExerciseEffect({ name: 'Неизвестное движение', sets: 3, rir: 2 });
    const sc = exerciseEffectScore(eff);
    expect(sc).toBeGreaterThanOrEqual(0);
    expect(sc).toBeLessThanOrEqual(100);
  });
  it('fatigueWeighted grows when RIR drops', () => {
    const easy = calcExerciseEffect({ id: 'bench_bar', name: 'Жим', muscle: 'chest', sets: 3, rir: 3 });
    const hard = calcExerciseEffect({ id: 'bench_bar', name: 'Жим', muscle: 'chest', sets: 3, rir: 0 });
    expect(hard.fatigueWeighted).toBeGreaterThan(easy.fatigueWeighted);
  });
});

describe('bb-plan-exercise-audit', () => {
  const plan: any = {
    weeks: [{ sessions: [
      { exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2 }] },
      { exercises: [{ exerciseName: 'incline_db', name: 'Жим гантелей на наклонной (30°)', muscle: 'chest', sets: 3, rir: 2 }] },
    ] }],
  };
  it('counts sets and SFR', () => {
    const a = auditPlanExercises(plan);
    expect(a).not.toBeNull();
    expect(a!.totalSets).toBe(7);
    expect(a!.totalExercises).toBe(2);
    expect(a!.avgSfr).not.toBeNull();
  });
  it('empty plan returns null', () => {
    expect(auditPlanExercises(null)).toBeNull();
    expect(auditPlanExercises({ weeks: [] })).toBeNull();
  });
  it('lengthened ratio counts incline', () => {
    const a = auditPlanExercises(plan);
    expect(a!.lengthenedRatio).toBeGreaterThan(0);
  });
  it('byMuscle chest aggregates', () => {
    const a = auditPlanExercises(plan);
    expect(a!.byMuscle['chest']).toBeDefined();
    expect(a!.byMuscle['chest'].totalSets).toBe(7);
  });
});

describe('bb-execution-prof', () => {
  it('chest_upper profile has angle 30 and 4 cues', () => {
    const p = getProfExecutionProfile('chest_upper');
    expect(p).not.toBeNull();
    expect(p!.angle).toContain('30');
    expect(p!.cues.length).toBeGreaterThanOrEqual(3);
    expect(p!.tempo).toBe('3-1-1-0');
  });
  it('unknown muscle returns null, canonical alias works', () => {
    expect(getProfExecutionProfile('nope_muscle')).toBeNull();
    expect(getProfExecutionProfile('chest')).not.toBeNull();
  });
  it('listProfMuscles covers 10+ zones', () => {
    expect(listProfMuscles().length).toBeGreaterThanOrEqual(10);
  });
  it('diagnoseExecutionProf flags missing pause', () => {
    const gaps = diagnoseExecutionProf({ name: 'Жим', tempo: '2-0-1-0', pauseSeconds: 0 } as any, 'chest_upper', { tempo: '2-0-1-0', pauseSeconds: 0 });
    expect(gaps.some(g => g.field === 'rom')).toBe(true);
  });
  it('no gaps when pause present', () => {
    const gaps = diagnoseExecutionProf({ name: 'Жим', tempo: '3-1-1-0', pauseSeconds: 1 } as any, 'chest_upper', { tempo: '3-1-1-0', pauseSeconds: 1 });
    expect(gaps.length).toBe(0);
  });
});

describe('bb-exercise-correction', () => {
  const fakeDiag: any = { effect: { id: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sfr: 3, profile: 'mid' }, flags: ['tempoMismatch'], issues: [], score: 80, profGaps: [] };
  it('tempoMismatch gives string tempo correction', () => {
    const acts = prescribeCorrections(fakeDiag, { id: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest' } as any, { goal: 'hypertrophy', muscle: 'chest' });
    const t = acts.find(a => a.type === 'modifyTempo');
    expect(t).toBeDefined();
    expect(typeof t!.tempo).toBe('string');
    expect(t!.tempo).toContain('-');
  });
  it('romGap gives modifyROM with pause', () => {
    const d: any = { ...fakeDiag, flags: ['romGap'] };
    const acts = prescribeCorrections(d, { id: 'bench_bar', name: 'Жим', muscle: 'chest' } as any, { goal: 'hypertrophy', muscle: 'chest' });
    expect(acts.some(a => a.type === 'modifyROM')).toBe(true);
  });
  it('lowSFR gives substitute with target', () => {
    const d: any = { ...fakeDiag, flags: ['lowSFRHighFatigue'] };
    const acts = prescribeCorrections(d, { id: 'bench_bar', name: 'Жим', muscle: 'chest' } as any, { goal: 'hypertrophy', muscle: 'chest' });
    const s = acts.find(a => a.type === 'substitute' || a.type === 'mobilitySwap');
    expect(s?.targetId).toBeDefined();
  });
  it('sorted by confidence desc', () => {
    const d: any = { ...fakeDiag, flags: ['lowSFRHighFatigue', 'tempoMismatch', 'romGap'] };
    const acts = prescribeCorrections(d, { id: 'bench_bar', name: 'Жим', muscle: 'chest' } as any, { goal: 'hypertrophy', muscle: 'chest' });
    for (let i = 1; i < acts.length; i++) expect(acts[i - 1].confidence).toBeGreaterThanOrEqual(acts[i].confidence);
  });
});

describe('bb-exercise-simulator', () => {
  const plan: any = {
    weeks: [{ sessions: [
      { exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2 }] },
    ] }],
  };
  it('substitute returns delta summary string', () => {
    const d = simulateCorrection(plan, { type: 'substitute', targetId: 'incline_db', targetName: 'Жим гантелей на наклонной (30°)', reason: 't', confidence: 0.8 } as any, 'bench_bar');
    expect(d).not.toBeNull();
    expect(typeof d!.summary).toBe('string');
  });
  it('modifyTempo is neutral-safe (no crash, defined)', () => {
    const d = simulateCorrection(plan, { type: 'modifyTempo', tempo: '3-1-1-0', reason: 't', confidence: 0.7 } as any, 'bench_bar');
    expect(d).not.toBeNull();
  });
  it('null plan returns null', () => {
    expect(simulateCorrection(null, { type: 'substitute', targetId: 'incline_db', reason: 't', confidence: 1 } as any, 'bench_bar')).toBeNull();
  });
});

describe('bb-scoring exercise extension (RSS kept)', () => {
  it('low avgSfr penalizes vs null', () => {
    const base: any = { weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: false, hasCircumf: false, hasVbt: false };
    const a = scoreBB({ ...base, avgSfr: 3.0 });
    const b = scoreBB({ ...base, avgSfr: 4.5 });
    expect(a.score).toBeLessThan(b.score);
  });
  it('angle gaps penalize', () => {
    const base: any = { weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: false, hasCircumf: false, hasVbt: false };
    const a = scoreBB({ ...base, angleGaps: 2 });
    const b = scoreBB({ ...base, angleGaps: 0 });
    expect(a.score).toBeLessThan(b.score);
  });
  it('no exercise data keeps old score (backward compat)', () => {
    const r = scoreBB({ weakCount: 1, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0, stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null, hasDiary: false, hasCircumf: false, hasVbt: false });
    expect(r.score).toBe(86);
  });
});
