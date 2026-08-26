import { describe, it, expect } from 'vitest';
import { computeEnergyAvailability, getCalciumTarget, calciumDoseSplitNote, getMenstrualPhaseNutrition } from '../planner-female-cycle';
import { getBBCategory, getCombinedDeficitMod, getCategoryDeficitMod, getTargetBFDeficitMod } from '../planner-categories';
import { detectMealInteractions, cookMethodGuidance } from '../planner-food-interactions';
import { getMicro } from '../../../../../core/nutrition-micros';
import { FOOD_DB } from '../../../../../core/nutrition-database';

describe('computeEnergyAvailability (#1 RED-S)', () => {
  it('EA risk when deep deficit + heavy training (female)', () => {
    const r = computeEnergyAvailability(1500, 58, 49, true, 90, 'high', 'female');
    expect(r.status).toBe('risk');
    expect(r.ea).toBeLessThan(30);
    expect(r.note).toContain('RED-S');
  });
  it('EA optimal at maintenance', () => {
    const r = computeEnergyAvailability(2900, 80, 68, true, 75, 'medium', 'male');
    expect(r.ea).toBeGreaterThanOrEqual(30);
    expect(r.status).not.toBe('risk');
  });
  it('rest day -> exerciseKcal 0', () => {
    const r = computeEnergyAvailability(2000, 70, 58, false, 60, 'high', 'female');
    expect(r.exerciseKcal).toBe(0);
    expect(r.ea).toBe(Math.round(2000 / 58));
  });
});

describe('getCalciumTarget (#2 bones)', () => {
  it('female low-bf -> 1200 + boneRisk', () => {
    const r = getCalciumTarget('female', 14, 'follicular', 25);
    expect(r.target).toBe(1200);
    expect(r.boneRisk).toBe(true);
  });
  it('female amenorrhea (none + low bf) -> 1500', () => {
    const r = getCalciumTarget('female', 15, 'none', 24);
    expect(r.target).toBe(1500);
  });
  it('female menopause (age 52) -> 1500', () => {
    const r = getCalciumTarget('female', 25, 'none', 52);
    expect(r.target).toBe(1500);
  });
  it('male -> 1000, no risk', () => {
    const r = getCalciumTarget('male', 12, 'none', 30);
    expect(r.target).toBe(1000);
    expect(r.boneRisk).toBe(false);
  });
  it('calciumDoseSplitNote mentions <=500mg', () => {
    expect(calciumDoseSplitNote()).toContain('500');
  });
});

describe('menstrual phase nutrition (#1)', () => {
  it('luteal: lower carbMod, low GI', () => {
    const n = getMenstrualPhaseNutrition('luteal');
    expect(n).not.toBeNull();
    expect(n!.carbMod).toBeLessThan(1);
    expect(n!.carbGiPref).toBe('low');
    expect(n!.microFocus).toContain('Mg');
  });
  it('none -> null', () => {
    expect(getMenstrualPhaseNutrition('none')).toBeNull();
  });
});

describe('category deficit + target-BF (#3, #7)', () => {
  it('BB category (4% bf) more aggressive than bikini (11%)', () => {
    expect(getCategoryDeficitMod(4, true)).toBeLessThan(getCategoryDeficitMod(11, true));
  });
  it('not cutting -> 1.0', () => {
    expect(getCategoryDeficitMod(4, false)).toBe(1.0);
  });
  it('already at target -> maintenance (1.0)', () => {
    expect(getTargetBFDeficitMod(4, 4, true)).toBe(1.0);
  });
  it('far from target -> more deficit', () => {
    expect(getTargetBFDeficitMod(20, 4, true)).toBeLessThan(getTargetBFDeficitMod(5, 4, true));
  });
  it('combined mod is the more conservative (higher kcal)', () => {
    const cat = getCategoryDeficitMod(4, true);
    const tbf = getTargetBFDeficitMod(20, 4, true);
    const combined = getCombinedDeficitMod(20, 4, true);
    expect(combined).toBe(Math.max(cat, tbf));
  });
  it('getBBCategory respects sex', () => {
    expect(getBBCategory('bikini', 'male')).toBeNull();
    expect(getBBCategory('mens_bb', 'male')).not.toBeNull();
  });
});

describe('food interactions (#3) + cooking (#9)', () => {
  it('oxalate + calcium conflict detected', () => {
    const w = detectMealInteractions([{ id: 'spinach' }, { id: 'cheese_hard' }]);
    expect(w.some(x => x.type === 'conflict' && x.text.includes('Оксалаты'))).toBe(true);
  });
  it('vitC + plant-iron synergy detected', () => {
    const w = detectMealInteractions([{ id: 'pepper' }, { id: 'lentils' }]);
    expect(w.some(x => x.type === 'synergy')).toBe(true);
  });
  it('tea does NOT false-match steak (token matching)', () => {
    const w = detectMealInteractions([{ id: 'tuna_steak' }, { id: 'lentils' }]);
    // tuna_steak contains 'tea' substring but should NOT be treated as tannin
    expect(w.some(x => x.type === 'conflict' && x.text.includes('Танины') && x.text.includes('Тунец'))).toBe(false);
  });
  it('cookMethodGuidance for spinach mentions blanching', () => {
    const n = cookMethodGuidance([{ id: 'spinach' }]);
    expect(n.some(x => x.includes('бланшир') || x.includes('Оксалаты'))).toBe(true);
  });
  it('cookMethodGuidance caps at 2 notes', () => {
    const n = cookMethodGuidance([{ id: 'spinach' }, { id: 'carrot' }, { id: 'garlic' }, { id: 'broccoli' }, { id: 'potato_boiled' }]);
    expect(n.length).toBeLessThanOrEqual(2);
  });
});

describe('getMicro (shared helper, bug #4 fix)', () => {
  it('reads K from micros (not electrolytes_100g)', () => {
    const chicken = FOOD_DB.find(f => f.id === 'chicken_breast');
    if (!chicken) return; // skip if absent
    const k = getMicro(chicken, 'K');
    expect(k).toBeGreaterThan(0); // chicken_breast has micros.K:256
  });
  it('returns 0 for missing nutrient (no fake fallback)', () => {
    const chicken = FOOD_DB.find(f => f.id === 'chicken_breast');
    if (!chicken) return;
    expect(getMicro(chicken, 'Omega3')).toBe(0); // chicken has no omega3
  });
  it('salmon has Omega3 via micros', () => {
    const salmon = FOOD_DB.find(f => f.id === 'salmon' || f.id === 'red_fish');
    if (!salmon) return;
    expect(getMicro(salmon, 'Omega3')).toBeGreaterThan(0);
  });
});
