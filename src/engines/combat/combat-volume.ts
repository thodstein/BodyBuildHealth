/**
 * combat-volume.ts — зальные ориентиры для единоборств (изолировано).
 * Шея/хват/ротация — свои MEV/MAV/MRV в сетах/нед.
 */

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
export interface Landmarks { mev: number; mav: number; mrv: number; }

export const COMBAT_LANDMARKS: Record<Level, Record<string, Landmarks>> = {
  beginner: {
    neck: { mev: 4, mav: 6, mrv: 10 },
    grip: { mev: 4, mav: 8, mrv: 12 },
    rotational: { mev: 4, mav: 6, mrv: 10 },
    legs: { mev: 6, mav: 10, mrv: 14 },
    push: { mev: 6, mav: 10, mrv: 14 },
    pull: { mev: 6, mav: 10, mrv: 14 },
  },
  intermediate: {
    neck: { mev: 6, mav: 8, mrv: 12 },
    grip: { mev: 6, mav: 10, mrv: 16 },
    rotational: { mev: 6, mav: 10, mrv: 14 },
    legs: { mev: 8, mav: 12, mrv: 18 },
    push: { mev: 8, mav: 12, mrv: 18 },
    pull: { mev: 8, mav: 12, mrv: 18 },
  },
  advanced: {
    neck: { mev: 6, mav: 10, mrv: 14 },
    grip: { mev: 8, mav: 12, mrv: 18 },
    rotational: { mev: 8, mav: 12, mrv: 16 },
    legs: { mev: 10, mav: 14, mrv: 22 },
    push: { mev: 10, mav: 14, mrv: 20 },
    pull: { mev: 10, mav: 14, mrv: 20 },
  },
  enhanced: {
    neck: { mev: 8, mav: 12, mrv: 16 },
    grip: { mev: 10, mav: 14, mrv: 22 },
    rotational: { mev: 10, mav: 14, mrv: 18 },
    legs: { mev: 12, mav: 16, mrv: 24 },
    push: { mev: 12, mav: 16, mrv: 24 },
    pull: { mev: 12, mav: 16, mrv: 24 },
  },
};

export function normLevel(l: string): Level {
  const s=(l||'').toLowerCase();
  if (s==='beginner'||s==='novice') return 'beginner';
  if (s==='intermediate') return 'intermediate';
  if (s==='advanced') return 'advanced';
  if (s==='enhanced') return 'enhanced';
  return 'intermediate';
}
export function getCombat(level: string, key: string): Landmarks | null {
  return COMBAT_LANDMARKS[normLevel(level)]?.[key] || null;
}
export function checkStatus(cur: number, lm: Landmarks): 'below'|'optimal'|'high'|'over' {
  if (cur < lm.mev) return 'below';
  if (cur <= lm.mav) return 'optimal';
  if (cur <= lm.mrv) return 'high';
  return 'over';
}
