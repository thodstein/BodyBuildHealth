import { describe, expect, it } from 'vitest';
import {
  wilksScore,
  dotsScore,
  ipfGLPoints,
  allometricScore,
  relativeStrength,
  liftRelativeStrength,
  classifyByDots,
} from '../relative-strength.engine';

describe('wilksScore', () => {
  it('returns 0 for invalid inputs', () => {
    expect(wilksScore(0, 83, 'male')).toBe(0);
    expect(wilksScore(600, 0, 'male')).toBe(0);
  });
  it('male 83kg, 700kg total → reasonable Wilks', () => {
    const w = wilksScore(700, 83, 'male');
    expect(w).toBeGreaterThan(300);
    expect(w).toBeLessThan(700);
  });
  it('female 63kg, 400kg total → reasonable Wilks', () => {
    const w = wilksScore(400, 63, 'female');
    expect(w).toBeGreaterThan(200);
  });
});

describe('dotsScore', () => {
  it('returns 0 for invalid', () => {
    expect(dotsScore(0, 83, 'male')).toBe(0);
  });
  it('male 83kg, 700kg total → DOTS > 300', () => {
    expect(dotsScore(700, 83, 'male')).toBeGreaterThan(300);
  });
  it('heavier lifter with same total gets lower DOTS', () => {
    const light = dotsScore(600, 75, 'male');
    const heavy = dotsScore(600, 120, 'male');
    expect(light).toBeGreaterThan(heavy);
  });
});

describe('ipfGLPoints', () => {
  it('returns 0 for invalid', () => {
    expect(ipfGLPoints(0, 83, 'male')).toBe(0);
  });
  it('male 83kg, 700kg total → GL points', () => {
    const gl = ipfGLPoints(700, 83, 'male');
    expect(gl).toBeGreaterThan(50);
    expect(gl).toBeLessThan(200);
  });
});

describe('allometricScore', () => {
  it('scales with total and bodyweight^2/3', () => {
    const a = allometricScore(600, 83);
    const b = allometricScore(600, 100);
    expect(a).toBeGreaterThan(b); // lighter lifter → higher score
  });
});

describe('relativeStrength', () => {
  it('total / bw', () => {
    expect(relativeStrength(600, 83)).toBeCloseTo(7.23, 0);
  });
  it('returns 0 for 0 bw', () => {
    expect(relativeStrength(600, 0)).toBe(0);
  });
});

describe('liftRelativeStrength', () => {
  it('lift / bw', () => {
    expect(liftRelativeStrength(200, 83)).toBeCloseTo(2.41, 0);
  });
});

describe('classifyByDots', () => {
  it('returns novice for 0', () => {
    expect(classifyByDots(0).class).toBe('novice');
  });
  it('returns intermediate for 350', () => {
    expect(classifyByDots(350).class).toBe('intermediate');
  });
  it('returns advanced for 400', () => {
    expect(classifyByDots(400).class).toBe('advanced');
  });
  it('returns elite for 460', () => {
    expect(classifyByDots(460).class).toBe('elite');
  });
  it('returns world_class for 530', () => {
    expect(classifyByDots(530).class).toBe('world_class');
  });
});
