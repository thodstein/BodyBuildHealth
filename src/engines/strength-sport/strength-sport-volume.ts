/**
 * strength-sport-volume.ts — зальные объёмные ориентиры для ТА/стронга (изолировано).
 * WL-лифты считаем в подъёмах/нед, сила — в сетах/нед. База: Stone 2006, Takano, Israetel адаптация.
 */

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
export interface Landmarks { mev: number; mav: number; mrv: number; unit: 'lifts' | 'sets' | 'meters'; }

export const WL_LANDMARKS: Record<Level, Record<string, Landmarks>> = {
  beginner: {
    snatch: { mev: 15, mav: 30, mrv: 45, unit: 'lifts' },
    cleanJerk: { mev: 12, mav: 25, mrv: 40, unit: 'lifts' },
    squat: { mev: 6, mav: 10, mrv: 15, unit: 'sets' },
    pull: { mev: 6, mav: 10, mrv: 16, unit: 'sets' },
    press: { mev: 4, mav: 8, mrv: 12, unit: 'sets' },
  },
  intermediate: {
    snatch: { mev: 20, mav: 40, mrv: 65, unit: 'lifts' },
    cleanJerk: { mev: 18, mav: 35, mrv: 55, unit: 'lifts' },
    squat: { mev: 8, mav: 14, mrv: 20, unit: 'sets' },
    pull: { mev: 8, mav: 12, mrv: 18, unit: 'sets' },
    press: { mev: 6, mav: 10, mrv: 16, unit: 'sets' },
  },
  advanced: {
    snatch: { mev: 25, mav: 50, mrv: 80, unit: 'lifts' },
    cleanJerk: { mev: 22, mav: 45, mrv: 70, unit: 'lifts' },
    squat: { mev: 10, mav: 16, mrv: 24, unit: 'sets' },
    pull: { mev: 10, mav: 16, mrv: 24, unit: 'sets' },
    press: { mev: 8, mav: 12, mrv: 18, unit: 'sets' },
  },
  enhanced: {
    snatch: { mev: 30, mav: 60, mrv: 95, unit: 'lifts' },
    cleanJerk: { mev: 28, mav: 55, mrv: 85, unit: 'lifts' },
    squat: { mev: 12, mav: 18, mrv: 28, unit: 'sets' },
    pull: { mev: 12, mav: 18, mrv: 28, unit: 'sets' },
    press: { mev: 10, mav: 14, mrv: 22, unit: 'sets' },
  },
};

export const STRONG_LANDMARKS: Record<Level, Record<string, Landmarks>> = {
  beginner: {
    overhead: { mev: 6, mav: 10, mrv: 15, unit: 'sets' },
    deadlift: { mev: 4, mav: 8, mrv: 12, unit: 'sets' },
    squat: { mev: 6, mav: 10, mrv: 15, unit: 'sets' },
    carry: { mev: 80, mav: 150, mrv: 250, unit: 'meters' },
    stone: { mev: 6, mav: 10, mrv: 16, unit: 'lifts' },
  },
  intermediate: {
    overhead: { mev: 8, mav: 14, mrv: 20, unit: 'sets' },
    deadlift: { mev: 6, mav: 10, mrv: 16, unit: 'sets' },
    squat: { mev: 8, mav: 14, mrv: 20, unit: 'sets' },
    carry: { mev: 100, mav: 200, mrv: 350, unit: 'meters' },
    stone: { mev: 8, mav: 12, mrv: 20, unit: 'lifts' },
  },
  advanced: {
    overhead: { mev: 10, mav: 16, mrv: 24, unit: 'sets' },
    deadlift: { mev: 8, mav: 12, mrv: 18, unit: 'sets' },
    squat: { mev: 10, mav: 16, mrv: 24, unit: 'sets' },
    carry: { mev: 120, mav: 250, mrv: 400, unit: 'meters' },
    stone: { mev: 10, mav: 16, mrv: 24, unit: 'lifts' },
  },
  enhanced: {
    overhead: { mev: 12, mav: 18, mrv: 28, unit: 'sets' },
    deadlift: { mev: 10, mav: 14, mrv: 22, unit: 'sets' },
    squat: { mev: 12, mav: 18, mrv: 28, unit: 'sets' },
    carry: { mev: 150, mav: 300, mrv: 500, unit: 'meters' },
    stone: { mev: 12, mav: 18, mrv: 28, unit: 'lifts' },
  },
};

export function normLevel(l: string): Level {
  const s = (l||'').toLowerCase();
  if (s==='beginner'||s==='novice') return 'beginner';
  if (s==='intermediate') return 'intermediate';
  if (s==='advanced') return 'advanced';
  if (s==='enhanced') return 'enhanced';
  return 'intermediate';
}

export function getWL( level: string, key: string): Landmarks | null {
  const lvl = normLevel(level);
  return WL_LANDMARKS[lvl]?.[key] || null;
}
export function getStrong(level: string, key: string): Landmarks | null {
  const lvl = normLevel(level);
  return STRONG_LANDMARKS[lvl]?.[key] || null;
}

export function checkStatus( cur: number, lm: Landmarks): 'below'|'optimal'|'high'|'over' {
  if (cur < lm.mev) return 'below';
  if (cur <= lm.mav) return 'optimal';
  if (cur <= lm.mrv) return 'high';
  return 'over';
}
