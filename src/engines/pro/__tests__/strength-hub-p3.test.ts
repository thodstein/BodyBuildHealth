import { describe, expect, it } from 'vitest';
import { getNormTable, classifyTotal, findCategory } from '../../pl-norms.engine';
import {
  wilksScore,
  dotsScore,
  ipfGLPoints,
  ipfGLPointsFor,
  mccullochCoeff,
  ageAdjustedScore,
} from '../relative-strength.engine';

describe('P3 ЕВСК-якоря (frs24/fprz, 2022-2025)', () => {
  it('классика М83: КМС 500 / МС 640 / МСМК 750', () => {
    const t = getNormTable('fpr_classic', 'total')!;
    expect(classifyTotal(t, 83, 500).achievedLabel).toBe('КМС');
    expect(classifyTotal(t, 83, 640).achievedLabel).toBe('МС');
    expect(classifyTotal(t, 83, 750).achievedLabel).toBe('МСМК');
  });
  it('классика Ж63: КМС 305 / МС 350 / МСМК 422.5', () => {
    const t = getNormTable('fpr_classic', 'total', 'female')!;
    expect(classifyTotal(t, 63, 305).achievedLabel).toBe('КМС');
    expect(classifyTotal(t, 63, 350).achievedLabel).toBe('МС');
    expect(classifyTotal(t, 63, 422.5).achievedLabel).toBe('МСМК');
  });
  it('I/II/III лесенка: М83 455→I, 400→II, 350→III', () => {
    const t = getNormTable('fpr_classic', 'total')!;
    expect(classifyTotal(t, 83, 455).achievedLabel).toBe('I');
    expect(classifyTotal(t, 83, 400).achievedLabel).toBe('II');
    expect(classifyTotal(t, 83, 350).achievedLabel).toBe('III');
  });
  it('юношеские: М83 320→I(ю), 290→II(ю)', () => {
    const t = getNormTable('fpr_classic', 'total')!;
    expect(classifyTotal(t, 83, 320).achievedLabel).toBe('I(ю)');
    expect(classifyTotal(t, 83, 290).achievedLabel).toBe('II(ю)');
  });
  it('жим М100/195 → КМС (ФПР-жим)', () => {
    const t = getNormTable('fpr_classic', 'bench')!;
    expect(findCategory(t, 100).label).toBe('до 105 кг');
    expect(classifyTotal(t, 100, 210).achievedLabel).toBe('КМС');
  });
});

describe('P3 очки — верификация по реальным протоколам', () => {
  it('Wilks М 90/600 → 383.0 (LiftVault-якорь)', () => {
    expect(wilksScore(600, 90, 'male')).toBeCloseTo(383.0, 0);
  });
  it('DOTS М 73.9/682.5 → ~494.1 (факт USAPL 494.11)', () => {
    expect(dotsScore(682.5, 73.9, 'male')).toBeCloseTo(494.1, 0);
  });
  it('DOTS Ж 72.9/305 → ~301.5 (факт 301.50)', () => {
    expect(dotsScore(305, 72.9, 'female')).toBeCloseTo(301.5, 0);
  });
  it('IPF GL классика Ж 46.8/435 → ~121.0 (факт ЧМ-2025 120.97)', () => {
    expect(ipfGLPoints(435, 46.8, 'female')).toBeCloseTo(121.0, 0);
  });
  it('IPF GL классика М 90/600 → ~79.8 (факт 79.8)', () => {
    expect(ipfGLPoints(600, 90, 'male')).toBeCloseTo(79.8, 0);
  });
  it('IPF GL экип ниже классики при том же тотале (пороги выше)', () => {
    expect(ipfGLPointsFor(600, 90, 'male', 'equipped')).toBeLessThan(ipfGLPointsFor(600, 90, 'male', 'classic'));
  });
  it('IPF GL жим считается отдельно от тотала', () => {
    const bench = ipfGLPointsFor(150, 83, 'male', 'classic', 'bench');
    const total = ipfGLPointsFor(150, 83, 'male', 'classic', 'total');
    expect(bench).toBeGreaterThan(0);
    expect(bench).not.toBeCloseTo(total, 0);
  });
});

describe('P3 McCulloch', () => {
  it('якоря: 40→1.0, 50→~1.13, 60→~1.305, 80→1.961', () => {
    expect(mccullochCoeff(40)).toBe(1.0);
    expect(mccullochCoeff(50)).toBeCloseTo(1.13, 2);
    expect(mccullochCoeff(60)).toBeCloseTo(1.305, 2);
    expect(mccullochCoeff(80)).toBeCloseTo(1.961, 3);
  });
  it('моложе 40 — 1.0; монотонность 40–80', () => {
    expect(mccullochCoeff(30)).toBe(1.0);
    expect(mccullochCoeff(55)).toBeGreaterThan(mccullochCoeff(45));
    expect(ageAdjustedScore(350, 55)).toBeCloseTo(350 * mccullochCoeff(55), 0);
    expect(ageAdjustedScore(350, 30)).toBe(350);
  });
});
