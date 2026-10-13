import { describe, it, expect } from 'vitest';
import { longevityTrackFor, buildLongevityPlan } from '../arm-longevity.engine';
import { buildRehabPlan } from '../arm-rehab.engine';

describe('arm TOP T5 longevity + rehab', () => {
  it('треки по возрасту', () => {
    expect(longevityTrackFor(25)).toBe('open');
    expect(longevityTrackFor(45)).toBe('master');
    expect(longevityTrackFor(55)).toBe('grandmaster');
    expect(longevityTrackFor(75)).toBe('supergrand');
  });
  it('open без ограничений, master режет объём', () => {
    expect(buildLongevityPlan({ ageYears: 25 }).volumeMult).toBe(1);
    const m = buildLongevityPlan({ ageYears: 52 });
    expect(m.volumeMult).toBeLessThan(1);
    expect(m.maxHeavyPerWeek).toBeLessThanOrEqual(1);
    expect(m.mobilityMinPerSession).toBeGreaterThanOrEqual(12);
  });
  it('боль ужесточает', () => {
    const a = buildLongevityPlan({ ageYears: 45, elbowPain: 0 });
    const b = buildLongevityPlan({ ageYears: 45, elbowPain: 6 });
    expect(b.volumeMult).toBeLessThan(a.volumeMult);
    expect(b.maxSinglesPerWeek).toBe(0);
  });
  it('rehab фазы по неделям', () => {
    expect(buildRehabPlan({ injury: 'humerus', weeksSince: 1 }).phase).toBe(0);
    // аудит 2026-10 было→стало: humerus на 8-й неделе получал фазу 2 (условие капа
    // `w<6 && phase>1` было невыполнимо) — теперь консолидация держит фазу 1 до 10 нед.
    expect(buildRehabPlan({ injury: 'humerus', weeksSince: 8 }).phase).toBe(1);
    expect(buildRehabPlan({ injury: 'humerus', weeksSince: 16 }).phase).toBeGreaterThan(1);
    expect(buildRehabPlan({ injury: 'ucl', weeksSince: 15 }).phase).toBe(4);
  });
  it('боль откатывает фазу', () => {
    expect(buildRehabPlan({ injury: 'ucl', weeksSince: 12, pain: 6 }).phase).toBeLessThan(3);
  });
  it('red-flags всегда есть', () => {
    expect(buildRehabPlan({}).redFlags.join(' ')).toMatch(/врач|рентген/i);
  });
});
