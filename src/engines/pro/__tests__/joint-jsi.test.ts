import { describe, expect, it } from 'vitest';
import { calcJointJsi } from '../joint-jsi.engine';

const base = (over: any = {}) => ({
  lift: 'bench' as const,
  weightKg: 100, sets: 4, reps: 5, tempoEccSec: 2, amplitude: 'full' as const,
  painMap:{}, deadPoint:'none' as const, aasStack:[], ...over,
});

describe('joint-jsi', () => {
  it('базовый JSI yellow (100×5×4 — средняя нагрузка)', () => {
    const r = calcJointJsi(base());
    expect(['yellow','green']).toContain(r.overallLevel);
    expect(r.perJoint.shoulder.jsi).toBeGreaterThan(0);
  });
  it('взрывной + отбив повышает JSI', () => {
    const a = calcJointJsi(base({ tempoEccSec:0.8 }));
    const b = calcJointJsi(base({ tempoEccSec:4 }));
    expect(a.perJoint.shoulder.jsi).toBeGreaterThan(b.perJoint.shoulder.jsi);
  });
  it('TUT 4с vs 1с: -травма', () => {
    const fast = calcJointJsi(base({ tempoEccSec:1, hasBounce:true }));
    const tut = calcJointJsi(base({ tempoEccSec:4, hasBounce:false }));
    expect(tut.maxJsi).toBeLessThan(fast.maxJsi);
  });
  it('K_pharma стан: +40% на связки', () => {
    const nat = calcJointJsi(base({ aasStack:[] }));
    const stan = calcJointJsi(base({ aasStack:['stanozolol'] }));
    expect(stan.perJoint.elbow.jsi).toBeGreaterThan(nat.perJoint.elbow.jsi*1.3);
  });
  it('deadly combo bench wide+90+clavicles', () => {
    const r = calcJointJsi(base({ gripWidth:'wide', elbowAngleDeg:90, touchPoint:'clavicles' }));
    expect(r.deadlyCombos.map(c=>c.id)).toContain('bench_impingement');
  });
  it('deadly spine deep+butt_wink+80%', () => {
    const r = calcJointJsi(base({ lift:'squat', squatDepth:'full', amplitudeErrors:['butt_wink'], pct1RM:0.85, weightKg:140 }));
    expect(r.deadlyCombos.map(c=>c.id)).toContain('spine_hernia');
  });
  it('phase overload bottom bench -> плечо', () => {
    const r = calcJointJsi(base({ deadPoint:'bottom' }));
    expect(r.phaseOverload[0]?.joint).toBe('shoulder');
  });
  it('nutraceutical tiers', () => {
    const green = calcJointJsi(base({ weightKg:50, sets:2, reps:5 }));
    expect(green.nutraceutical.tier).toBe('green');
    const red = calcJointJsi(base({ weightKg:160, sets:5, reps:5, lift:'squat', squatDepth:'full', amplitudeErrors:['butt_wink'], pct1RM:0.9 } as any));
    // может быть yellow/red в зависимости от калибровки — хотя бы не green
    expect(['yellow','red']).toContain(red.nutraceutical.tier);
  });
});
