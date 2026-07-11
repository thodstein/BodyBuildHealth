/**
 * Performance Analytics Suite — Ratios, standards, comparisons.
 *
 * Strength Standards: elite/advanced/intermediate/novice by bodyweight
 * Performance Ratios: squat:deadlift, bench:squat, push:pull, symmetry
 * Training Age Calculator: expected progress by experience level
 * Volume Landmarks: MEV, MAV, MRV per muscle group by level (делегируется volume-landmarks.engine.ts)
 * Recovery Metrics: HRV-based readiness, training stress balance
 *
 * @module performance-analytics-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type StrengthLevel = 'untrained' | 'novice' | 'intermediate' | 'advanced' | 'elite' | 'world_class';

export interface StrengthStandard {
  exercise: string;
  bodyWeight: number;
  levels: Record<StrengthLevel, number>;
}

export interface PerformanceRatios {
  squatToDeadlift: number;
  benchToSquat: number;
  overheadToBench: number;
  pushPullRatio: number;
  quadHamstringRatio: number;
  leftRightSymmetry: number;
}

import { getAllVolumeLandmarks as getVL, getVolumeLandmarks as getVLOne, checkVolumeStatus as checkVS, type MuscleVolumeLandmarks } from './volume-landmarks.engine';
/** @deprecated Используйте MuscleVolumeLandmarks из volume-landmarks.engine.ts */
export type VolumeLandmarks = { muscle: string; mev: number; mav: number; mrv: number };

export interface RecoveryMetrics {
  hrvReadiness: number;
  trainingStressBalance: number;
  recoveryIndex: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Strength Standards (1RM by bodyweight and level)
// ═══════════════════════════════════════════════════════════════════════════

const STRENGTH_STANDARDS: Record<string, Record<StrengthLevel, number[]>> = {
  // [60kg, 67kg, 75kg, 82kg, 90kg, 100kg, 110kg, 125kg, 140kg, 140+kg] bodyweights
  squat: {
    untrained:   [40, 45, 50, 55, 60, 65, 70, 75, 80, 85],
    novice:      [70, 80, 90, 100, 110, 120, 130, 140, 150, 160],
    intermediate: [110, 125, 140, 155, 170, 185, 200, 215, 230, 245],
    advanced:    [150, 170, 190, 210, 230, 250, 270, 290, 310, 330],
    elite:       [190, 215, 240, 265, 290, 315, 340, 365, 390, 415],
    world_class: [230, 260, 290, 320, 350, 380, 410, 440, 470, 500],
  },
  bench: {
    untrained:   [30, 35, 40, 45, 50, 55, 55, 60, 65, 65],
    novice:      [55, 60, 70, 80, 85, 95, 100, 110, 115, 120],
    intermediate: [85, 95, 110, 120, 130, 145, 155, 165, 175, 185],
    advanced:    [120, 135, 150, 170, 185, 200, 215, 230, 245, 260],
    elite:       [150, 170, 190, 210, 230, 250, 270, 290, 310, 330],
    world_class: [180, 205, 230, 255, 280, 305, 330, 355, 380, 400],
  },
  deadlift: {
    untrained:   [55, 60, 70, 75, 85, 90, 100, 105, 110, 115],
    novice:      [90, 105, 115, 130, 140, 155, 165, 180, 190, 200],
    intermediate: [140, 160, 175, 195, 210, 230, 245, 265, 280, 300],
    advanced:    [190, 215, 235, 260, 280, 305, 325, 350, 375, 400],
    elite:       [235, 265, 295, 325, 355, 385, 415, 445, 475, 505],
    world_class: [280, 315, 355, 390, 425, 460, 495, 530, 565, 600],
  },
  overhead_press: {
    untrained:   [20, 22, 25, 27, 30, 32, 35, 37, 40, 42],
    novice:      [35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    intermediate: [50, 57, 65, 72, 80, 87, 95, 102, 110, 117],
    advanced:    [70, 80, 90, 100, 110, 120, 130, 140, 150, 160],
    elite:       [90, 100, 115, 125, 140, 150, 165, 175, 190, 200],
    world_class: [105, 120, 135, 150, 165, 180, 195, 210, 225, 240],
  },
};

const BODYWEIGHT_BRACKETS = [60, 67, 75, 82, 90, 100, 110, 125, 140, 150];

function getClosestBracket(bw: number): number {
  return BODYWEIGHT_BRACKETS.reduce((prev, curr) =>
    Math.abs(curr - bw) < Math.abs(prev - bw) ? curr : prev
  );
}

export function getStrengthLevel(exercise: string, weightKg: number, oneRM: number): StrengthLevel {
  const standards = STRENGTH_STANDARDS[exercise];
  if (!standards) return 'intermediate';

  const bracketIdx = BODYWEIGHT_BRACKETS.indexOf(getClosestBracket(weightKg));
  const levels: StrengthLevel[] = ['world_class', 'elite', 'advanced', 'intermediate', 'novice', 'untrained'];

  for (const level of levels) {
    const threshold = standards[level][Math.min(bracketIdx, standards[level].length - 1)];
    if (oneRM >= threshold) return level;
  }

  return 'untrained';
}

export function getNextLevelTarget(exercise: string, weightKg: number, currentLevel: StrengthLevel): number {
  const standards = STRENGTH_STANDARDS[exercise];
  if (!standards) return 0;

  const bracketIdx = BODYWEIGHT_BRACKETS.indexOf(getClosestBracket(weightKg));
  const levels: StrengthLevel[] = ['untrained', 'novice', 'intermediate', 'advanced', 'elite', 'world_class'];
  const idx = levels.indexOf(currentLevel);

  if (idx < levels.length - 1) {
    const nextLevel = levels[idx + 1];
    return standards[nextLevel][Math.min(bracketIdx, standards[nextLevel].length - 1)];
  }

  return 0; // Already world class
}

export function getStrengthPercentile(exercise: string, weightKg: number, oneRM: number): number {
  const level = getStrengthLevel(exercise, weightKg, oneRM);
  const levels: StrengthLevel[] = ['untrained', 'novice', 'intermediate', 'advanced', 'elite', 'world_class'];
  const idx = levels.indexOf(level);

  const standards = STRENGTH_STANDARDS[exercise];
  if (!standards) return 50;

  const bracketIdx = BODYWEIGHT_BRACKETS.indexOf(getClosestBracket(weightKg));
  const levelMin = standards[level][Math.min(bracketIdx, standards[level].length - 1)];
  const nextLevel = idx < levels.length - 1 ? standards[levels[idx + 1]][Math.min(bracketIdx, standards[levels[idx + 1]].length - 1)] : levelMin * 1.5;

  const withinLevel = (oneRM - levelMin) / (nextLevel - levelMin);
  return Math.round(Math.min(99, (idx / (levels.length - 1) + withinLevel / (levels.length - 1)) * 100));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Performance Ratios
// ═══════════════════════════════════════════════════════════════════════════

export function calculateRatios(squat: number, bench: number, deadlift: number, overhead: number = 0): PerformanceRatios {
  const squatToDeadlift = deadlift > 0 ? Math.round((squat / deadlift) * 100) : 0;
  const benchToSquat = squat > 0 ? Math.round((bench / squat) * 100) : 0;
  const overheadToBench = bench > 0 && overhead > 0 ? Math.round((overhead / bench) * 100) : 0;
  const pushPullRatio = deadlift > 0 ? Math.round(((bench + (overhead || 0)) / deadlift) * 100) : 0;

  // Ideal ratios
  const quadHamstringRatio = 100; // Placeholder

  return {
    squatToDeadlift, benchToSquat, overheadToBench, pushPullRatio,
    quadHamstringRatio, leftRightSymmetry: 100,
  };
}

export function analyzeRatios(ratios: PerformanceRatios): { issue: string; recommendation: string }[] {
  const issues: { issue: string; recommendation: string }[] = [];

  if (ratios.squatToDeadlift > 85) {
    issues.push({ issue: 'Присед близок к тяге', recommendation: 'Тяга — слабое звено. Добавьте specialised deadlift блок.' });
  }
  if (ratios.squatToDeadlift < 65) {
    issues.push({ issue: 'Присед сильно отстаёт от тяги', recommendation: 'Увеличьте частоту приседа. Front squat аксессуары.' });
  }
  if (ratios.benchToSquat < 55) {
    issues.push({ issue: 'Жим отстаёт от приседа', recommendation: 'Увеличьте частоту жима. Добавьте трицепс-фокус.' });
  }
  if (ratios.benchToSquat > 80) {
    issues.push({ issue: 'Жим непропорционально силён', recommendation: 'Возможно, недостаточная глубина приседа. Проверьте технику.' });
  }
  if (ratios.pushPullRatio > 65) {
    issues.push({ issue: 'Push доминирует над Pull', recommendation: 'Дисбаланс → риск плеча. Добавьте тяги, face pulls.' });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Volume Landmarks (MEV/MAV/MRV) — делегировано volume-landmarks.engine.ts
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Используйте getVolumeLandmarks из volume-landmarks.engine.ts */
export function getVolumeLandmarks(level: string, muscle: string): VolumeLandmarks | null {
  const v = getVLOne(level, muscle);
  return v ? { muscle, mev: v.mev, mav: v.mav, mrv: v.mrv } : null;
}

/** @deprecated Используйте getAllVolumeLandmarks из volume-landmarks.engine.ts */
export function getAllVolumeLandmarks(level: string): VolumeLandmarks[] {
  const all = getVL(level);
  return Object.entries(all).map(([muscle, v]) => ({ muscle, mev: v.mev, mav: v.mav, mrv: v.mrv }));
}

/** @deprecated Используйте checkVolumeStatus из volume-landmarks.engine.ts */
export function checkVolumeStatus(currentSets: number, landmarks: VolumeLandmarks): 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv' {
  return checkVS(currentSets, landmarks as MuscleVolumeLandmarks);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Training Age Calculator
// ═══════════════════════════════════════════════════════════════════════════

export function trainingAgeLevel(years: number): { level: StrengthLevel; expectedWeeklyGain: number; expectedPlateau: number } {
  if (years < 0.5) return { level: 'untrained', expectedWeeklyGain: 0.05, expectedPlateau: 0 };
  if (years < 1) return { level: 'novice', expectedWeeklyGain: 0.025, expectedPlateau: 1 };
  if (years < 3) return { level: 'intermediate', expectedWeeklyGain: 0.010, expectedPlateau: 2 };
  if (years < 6) return { level: 'advanced', expectedWeeklyGain: 0.005, expectedPlateau: 3 };
  return { level: 'elite', expectedWeeklyGain: 0.002, expectedPlateau: 4 };
}

export function projectedTimeline(current1RM: number, target1RM: number, weeklyGain: number): number {
  if (weeklyGain <= 0) return 999;
  return Math.ceil(Math.log(target1RM / current1RM) / Math.log(1 + weeklyGain));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Wilks/Dots/IPF for any federation
// ═══════════════════════════════════════════════════════════════════════════

export function dotsScore(total: number, bw: number, sex: 'male' | 'female'): number {
  const a = sex === 'male' ? -0.0000010930 : -0.0000010702;
  const b = sex === 'male' ? 0.0007391293 : 0.0007195833;
  const c = sex === 'male' ? -0.1918759221 : -0.1881243692;
  const d = sex === 'male' ? 24.0900756 : 22.8480074;
  const e = sex === 'male' ? -307.75076 : -281.2251;
  return Math.round((total * 500 / (a * bw**4 + b * bw**3 + c * bw**2 + d * bw + e)) * 100) / 100;
}

export function ipfGLPoints(total: number, bw: number, sex: 'male' | 'female'): number {
  const A = sex === 'male' ? 1236.25115 : 758.63878;
  const B = sex === 'male' ? 1449.21864 : 949.31382;
  const C = sex === 'male' ? 0.01644 : 0.00936;
  return Math.round((100 / (A - B * Math.exp(-C * bw))) * total * 10) / 10;
}

export function relativeStrength(total: number, bw: number): number {
  return Math.round((total / bw) * 100) / 100;
}
