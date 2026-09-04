import { describe, it, expect, beforeEach } from 'vitest';
import { computeArmPerMuscleACWR, worstArmAcwrZone, armAcwrSummary, armAcwrZoneFor } from '../arm-acwr.engine';
import { loadPlatformLog, savePlatformLogEntry } from '../arm-platform.engine';
import { diagnoseArmWeakCause } from '../arm-weak-cause.engine';

function dSess(daysAgo: number, muscle: string, nSets: number) {
  const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  return { date: d, exercises: [{ muscle, sets: Array.from({ length: nSets }, () => ({ weightKg: 30, reps: 8 })) }] } as any;
}

describe('arm D2: per-muscle ACWR', () => {
  it('spike → danger (10 vs 2)', () => {
    const m = computeArmPerMuscleACWR([dSess(1, 'pronators', 10), dSess(20, 'pronators', 2)]);
    expect(m['pronators'].zone).toBe('danger');
    expect(m['pronators'].ratio).toBeGreaterThanOrEqual(1.5);
  });
  it('умеренный рост → caution (4 vs 8 фоном)', () => {
    const m = computeArmPerMuscleACWR([dSess(1, 'pronators', 4), dSess(10, 'pronators', 4), dSess(20, 'pronators', 4)]);
    expect(m['pronators'].zone).toBe('caution');
  });
  it('ровно → ok; пусто → {}', () => {
    const m = computeArmPerMuscleACWR([dSess(1, 'pronators', 4), dSess(10, 'pronators', 4), dSess(20, 'pronators', 4), dSess(27, 'pronators', 16)]);
    expect(m['pronators'].zone).toBe('ok');
    expect(computeArmPerMuscleACWR([])).toEqual({});
  });
  it('worst + summary', () => {
    const m = computeArmPerMuscleACWR([dSess(1, 'pronators', 10), dSess(20, 'pronators', 2), dSess(1, 'supinators', 4), dSess(10, 'supinators', 4), dSess(20, 'supinators', 4)]);
    expect(worstArmAcwrZone(m, ['supinators', 'pronators'])).toBe('danger');
    expect(worstArmAcwrZone(m, ['nope'])).toBeNull();
    const s = armAcwrSummary(m);
    expect(s.danger).toContain('pronators');
    expect(armAcwrZoneFor(null)).toBe('ok');
  });
});

describe('arm D4: platform log', () => {
  beforeEach(() => { localStorage.clear(); });
  it('roundtrip + %WR', () => {
    savePlatformLogEntry({ implement: 'rolling_thunder', sex: 'male', weightKg: 68, success: true });
    const h = loadPlatformLog();
    expect(h.length).toBe(1);
    expect(h[0].wrPct).toBe(52.1);
    expect(h[0].success).toBe(true);
  });
  it('мусор игнорируется', () => {
    savePlatformLogEntry({ weightKg: 0, success: true });
    savePlatformLogEntry({ weightKg: NaN, success: false });
    expect(loadPlatformLog()).toEqual([]);
    localStorage.setItem('he_arm_platform_log', 'битое');
    expect(loadPlatformLog()).toEqual([]);
  });
  it('копит историю', () => {
    savePlatformLogEntry({ weightKg: 60, success: true, dateIso: '2026-08-01' });
    savePlatformLogEntry({ weightKg: 65, success: false, dateIso: '2026-09-01' });
    expect(loadPlatformLog().map((e) => e.weightKg)).toEqual([60, 65]);
  });
});

describe('arm D1/D3: причины с сон/бенч/ref', () => {
  it('сон <6.5 → fatigue', () => {
    const r = diagnoseArmWeakCause({ point: 'cup_start', factSets7d: 5, sleepHours: 5 });
    expect(r.cause).toBe('fatigue');
  });
  it('ref 40% сильнее сна → strength', () => {
    const r = diagnoseArmWeakCause({ point: 'side_mid', factSets7d: 5, sleepHours: 5, sideBackRefRatio: 0.4 });
    expect(r.cause).toBe('strength');
  });
  it('бенч intermediate при объёме → strength', () => {
    const r = diagnoseArmWeakCause({ point: 'back_start', factSets7d: 5, benchLevel: 'intermediate' });
    expect(r.cause).toBe('strength');
  });
});
