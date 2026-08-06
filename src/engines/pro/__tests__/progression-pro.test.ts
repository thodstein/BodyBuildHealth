import { describe, expect, it } from 'vitest';
import { getScheme, listSchemes, generateProgression, PROGRESSION_SCHEMES } from '../progression-pro.engine';

describe('progression-pro', () => {
  it('lists every registered scheme', () => {
    expect(listSchemes()).toHaveLength(Object.keys(PROGRESSION_SCHEMES).length);
    expect(getScheme('531')?.trainingMaxFactor).toBe(0.9);
  });
  it('generates rounded weights from training max', () => {
    const weeks = generateProgression('531', 200);
    expect(weeks).toHaveLength(4);
    expect(weeks![0].trainingMax).toBe(180);
    expect(weeks![0].days[0].sets[0].weight).toBe(117);
  });
  it('returns null for invalid e1RM', () => {
    expect(generateProgression('dup', 0)).toBeNull();
  });

  it('conjugate scheme generates 4 weeks with ME/DE/Rep days', () => {
    const weeks = generateProgression('conjugate', 200);
    expect(weeks).toHaveLength(4);
    expect(weeks![0].days).toHaveLength(3);
    expect(weeks![0].days[0].label).toBe('Max Effort');
    expect(weeks![0].days[1].label).toBe('Dynamic Effort');
    expect(weeks![0].days[2].label).toBe('Repetition');
  });

  it('hepburn scheme generates 4 weeks with Power + Pump days', () => {
    const weeks = generateProgression('hepburn', 150);
    expect(weeks).toHaveLength(4);
    expect(weeks![0].days).toHaveLength(2);
    expect(weeks![0].days[0].label).toBe('Power');
    expect(weeks![0].days[1].label).toBe('Pump');
    expect(weeks![0].days[0].sets[0].reps).toBeGreaterThanOrEqual(2);
    expect(weeks![0].days[0].sets[0].sets).toBe(8);
  });

  it('super_squats scheme generates 6 weeks with 20-rep sets', () => {
    const weeks = generateProgression('super_squats', 120);
    expect(weeks).toHaveLength(6);
    expect(weeks![0].days[0].sets[0].reps).toBe(20);
    expect(weeks![0].days[0].sets[0].sets).toBe(1);
  });

  it('double_progression increases reps week over week', () => {
    const weeks = generateProgression('double_progression', 100);
    expect(weeks).toHaveLength(4);
    const w1Reps = weeks![0].days[0].sets[0].reps;
    const w4Reps = weeks![3].days[0].sets[0].reps;
    expect(w4Reps).toBeGreaterThanOrEqual(w1Reps);
  });

  it('dup scheme generates 3 days per week (heavy/medium/light)', () => {
    const weeks = generateProgression('dup', 180);
    expect(weeks).toHaveLength(4);
    expect(weeks![0].days).toHaveLength(3);
    expect(weeks![0].days[0].label).toBe('Heavy');
  });

  it('531 deload week has reduced percentages', () => {
    const weeks = generateProgression('531', 200);
    const deloadWeek = weeks![3];
    const workWeek = weeks![0];
    const deloadPct = deloadWeek.days[0].sets[0].pct;
    const workPct = workWeek.days[0].sets[0].pct;
    expect(deloadPct).toBeLessThan(workPct);
  });

  it('SQUAT helper accepts custom label parameter', () => {
    const scheme = getScheme('531');
    expect(scheme).toBeDefined();
    expect(scheme!.template[0].days[0].label).toBe('День 1');
  });
});
