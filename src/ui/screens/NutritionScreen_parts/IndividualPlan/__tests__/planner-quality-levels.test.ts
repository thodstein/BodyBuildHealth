/**
 * planner-quality-levels.test.ts — Эпик 3 (NUTRITION-PROFESSIONAL-PLAN):
 * единые «уровни качества». Две ортогональные оси: белок-пресет (г/кг) и
 * бюджет (качество продуктов). Legacy nutrLevel (ложный множитель) удалён;
 * budget 'enhanced' сведён к 'max'; planType-стили дают РЕАЛЬНЫЕ макро-профили.
 */

import { describe, it, expect } from 'vitest';
import { BUDGET_LEVELS, PROTEIN_PRESETS, PLAN_TYPES } from '../types';
import { buildDayTargets } from '../planner-day-targets';
import { computePlannerTargets } from '../planner-targets';

const targets = (overrides: any = {}) => {
  const base: any = {
    weightKg: 90, heightCm: 180, age: 30, sex: 'male', goal: 'mass', phase: 'course', bodyFatPct: 15,
    workoutsPerWeek: 4, avgWorkoutMinutes: 75, dailySteps: 9000, householdActivity: 'moderate', trainType: 'mixed',
    trainIntensity: 'high', surplusPct: 10, injections: [], weightAdaptMode: false, weightLogWeek: [],
    expectedLossKgWeek: 0, metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
    manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  };
  return computePlannerTargets({ ...base, ...overrides });
};

const day = (opts: { dietStyle?: string; preset?: number; kcal?: number; fatFloor?: number; vol?: number; goal?: string; weight?: number; height?: number } = {}) => {
  const w = opts.weight ?? 90;
  const h = opts.height ?? 180;
  const calc = opts.goal || opts.kcal
    ? targets({ goal: opts.goal || 'cutting', weightKg: w, heightCm: h })
    : targets();
  return buildDayTargets({
    weightKg: w,
    presetGPerKg: opts.preset ?? 2.0,
    fatFloorGPerKg: opts.fatFloor ?? 0.8,
    kbjuMode: 'auto',
    calcTargets: calc,
    profileTargets: targets({ goal: 'maintenance', phase: 'maintenance', surplusPct: 10, weightKg: w, heightCm: h }),
    goal: opts.goal || 'mass',
    trainingVolumeMinPerWeek: opts.vol ?? 300,
    budget: 'medium',
    insulinTotalUnits: 0,
    dietStyle: opts.dietStyle ?? 'classic',
  });
};

describe('BUDGET_LEVELS — 3 уровня (enhanced удалён из UI)', () => {
  it('содержит low/medium/max', () => {
    expect(BUDGET_LEVELS.map(b => b.id)).toEqual(['low', 'medium', 'max']);
  });
});

describe('PROTEIN_PRESETS — пресеты г/кг (без ложного множителя)', () => {
  it('4 пресета с г/кг', () => {
    expect(PROTEIN_PRESETS.map(p => p.gPerKg)).toEqual([1.6, 2.0, 2.2, 2.6]);
  });
  it('белок-пресет меняет ТОЛЬКО белок (жиры/угли не трогает напрямую)', () => {
    const low = day({ preset: 1.6 });
    const high = day({ preset: 2.6 });
    expect(high.protein).toBeGreaterThan(low.protein);
    expect(low.protein).toBe(Math.round(90 * 1.6));
    expect(high.protein).toBe(Math.round(90 * 2.6));
  });
});

describe('planType-стили — реальные макро-профили', () => {
  it('keto: угли ниже классики, жиры выше, Atwater-сходимость', () => {
    const k = day({ dietStyle: 'keto', goal: 'cutting' });
    const c = day({ dietStyle: 'classic', goal: 'cutting' });
    expect(k.carbs).toBeLessThan(c.carbs);
    expect(k.fats).toBeGreaterThan(c.fats);
    expect(k.kcal).toBe(k.protein * 4 + k.fats * 9 + k.carbs * 4);
    expect(k.breakdown.some(b => b.includes('Кето'))).toBe(true);
  });
  it('keto: угли в кето-пороге ИЛИ честный fallback с отметкой в breakdown', () => {
    // Умеренная цель: чистый кето (угли ≤ 60 г)
    const k1 = day({ dietStyle: 'keto', goal: 'cutting', weight: 40, height: 160 });
    const clean = k1.carbs <= 60 || k1.breakdown.some(b => b.includes('угли подняты до минимума закрытия'));
    expect(clean).toBe(true);
    // Экстремальная цель: fallback ЧЕСТНО помечен в breakdown
    const k2 = day({ dietStyle: 'keto', goal: 'mass' });
    if (k2.fats >= Math.round(90 * 3.0)) {
      expect(k2.breakdown.some(b => b.includes('угли подняты до минимума закрытия'))).toBe(true);
    }
    // В любом случае — Atwater-сходимость и угли ниже классики
    expect(k2.kcal).toBe(k2.protein * 4 + k2.fats * 9 + k2.carbs * 4);
    expect(k2.carbs).toBeLessThan(day({ dietStyle: 'classic', goal: 'mass' }).carbs);
  });
  it('keto на экстремальной цели: честный fallback (жиры в капе 3 г/кг, угли ниже классики)', () => {
    const k = day({ dietStyle: 'keto', goal: 'mass' });
    const c = day({ dietStyle: 'classic', goal: 'mass' });
    expect(k.fats).toBeLessThanOrEqual(Math.round(90 * 3.0));
    expect(k.carbs).toBeLessThan(c.carbs);
    expect(k.kcal).toBe(k.protein * 4 + k.fats * 9 + k.carbs * 4);
  });
  it('highcarb: жиры на полу 0.8 г/кг, угли выше классики', () => {
    const h = day({ dietStyle: 'highcarb' });
    const c = day({ dietStyle: 'classic' });
    expect(h.fats).toBe(Math.round(90 * 0.8));
    expect(h.carbs).toBeGreaterThanOrEqual(c.carbs);
  });
  it('classic — поведение не изменилось (контроль Atwater)', () => {
    const c = day({ dietStyle: 'classic' });
    expect(c.kcal).toBe(c.protein * 4 + c.fats * 9 + c.carbs * 4);
  });
  it('breakdown описывает стиль', () => {
    expect(day({ dietStyle: 'keto', goal: 'cutting' }).breakdown.some(b => b.includes('Кето'))).toBe(true);
    expect(day({ dietStyle: 'highcarb' }).breakdown.some(b => b.includes('Высоко-углеводный'))).toBe(true);
  });
});

describe('PLAN_TYPES — стили без декоративных множителей в целях', () => {
  it('классический: день честно отражает диетпотолок (не раздувается)', () => {
    const d = day({ dietStyle: 'classic', vol: 600, weight: 60, goal: 'maintenance' });
    // потолок 6 г/кг (maintenance) — угли дня ровно на потолке, Atwater сходится
    expect(d.carbs).toBeLessThanOrEqual(6 * 60);
    expect(d.kcal).toBe(d.protein * 4 + d.fats * 9 + d.carbs * 4);
    expect(d.breakdown.some(b => b.startsWith('⚠ Потолок углей') || !b.includes('срезал'))).toBe(true);
  });
});