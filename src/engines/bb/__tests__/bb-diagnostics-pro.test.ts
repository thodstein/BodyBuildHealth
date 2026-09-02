import { describe, it, expect } from 'vitest';
import { detectBBWeakByVolume, detectBBWeakByCircumf, idealReevesCircumference, mergeBBWeakCandidates } from '../bb-weak-detection.engine';
import { scoreBBSymmetry } from '../bb-symmetry.engine';
import { analyzeBBStimulus } from '../bb-stimulus.engine';
import { scoreBB } from '../bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../bb-diagnostics-hub.engine';

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
