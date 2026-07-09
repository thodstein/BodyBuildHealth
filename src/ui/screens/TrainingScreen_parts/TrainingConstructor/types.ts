import type React from 'react';

export const ACCENT = '#00e68a';
export const DIM = 'rgba(255,255,255,0.5)';
export const CARD_STYLE: React.CSSProperties = { background: 'rgba(24,24,27,0.5)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)' };
export const IN_STYLE: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 8px', fontSize: 11, boxSizing: 'border-box' as const };
export const BTN_STYLE: React.CSSProperties = { padding: '8px 12px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 11 };

export const GOALS = [
  { value: 'bulk', label: '💪 Масса' },
  { value: 'cut', label: '🔥 Сушка' },
  { value: 'strength', label: '🏋️ Сила' },
  { value: 'maintenance', label: '⚖ Поддержание' },
  { value: 'recomp', label: '🔁 Рекомпозиция' },
  { value: 'rehab', label: '🩹 Реабилитация' },
];

export const LEVELS = [
  { value: 'beginner', label: '🌱 Новичок' },
  { value: 'intermediate', label: '📈 Средний' },
  { value: 'advanced', label: '🏆 Опытный' },
  { value: 'enhanced', label: '⚡ Enhanced' },
];

export const PCT_FOR_RIR: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };

export const GROUP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', full: 'Общее',
};

export const LEVEL_VOLUMES: Record<string, { mrv: number }> = {
  beginner: { mrv: 15 }, intermediate: { mrv: 20 }, advanced: { mrv: 24 }, enhanced: { mrv: 28 },
};

export const SET_TEMPLATES: Record<string, { sets: number; reps: string; rir: number; rest: number }> = {
  '5×5': { sets: 5, reps: '5', rir: 1, rest: 180 },
  '3×8': { sets: 3, reps: '8', rir: 2, rest: 90 },
  '4×10': { sets: 4, reps: '10', rir: 2, rest: 90 },
  '3×12': { sets: 3, reps: '12', rir: 2, rest: 75 },
  'AMRAP': { sets: 1, reps: 'AMRAP', rir: 0, rest: 180 },
  'Myo-rep': { sets: 1, reps: '15 + 5×3', rir: 0, rest: 120 },
  '10×10 GVT': { sets: 10, reps: '10', rir: 3, rest: 60 },
  '5/3/1': { sets: 3, reps: '5/3/1+', rir: 1, rest: 180 },
};

export const CONFIG_LABELS: Record<string, string> = {
  split: 'сплит', cycle: 'цикл', program: 'программа',
  periodization: 'периодизация', progression: 'прогрессия',
  intensity: 'интенсивность', technique: 'техника',
  volume: 'объём', frequency: 'частота', specialization: 'специализация',
};

export interface ManualDay {
  day: number;
  groups: string[];
  exercises: ManualExercise[];
}

export interface ManualExercise {
  name: string;
  sets: number;
  reps: string;
  rir: number;
  rest: number;
  group: string;
  weight: number;
}

export interface ManualResult {
  splitName: string;
  corrections: string[];
  days: ManualDay[];
}

export type ConstructorMode = 'macro' | 'manual';

export function detectGroup(name: string): string {
  const n = name.toLowerCase();
  if (/squat|присед|leg|quad|ножн|выпад|lunge/i.test(n)) return 'legs';
  if (/bench|жим|chest|груд|press/.test(n)) return /shoulder|плеч|delt/i.test(n) ? 'shoulders' : 'chest';
  if (/deadlift|станов|тяга|row|pull|спин|back|chin|lat/i.test(n)) return 'back';
  if (/curl|бицеп|bicep/i.test(n)) return 'arms';
  if (/tricep|трицеп|extension/i.test(n)) return /пресс|ab|core/i.test(n) ? 'core' : 'arms';
  return 'full';
}

export function getMrv(level: string, onCourse: boolean, courseIntensity: string, labMultiplier: number): number {
  const baseMrv = LEVEL_VOLUMES[level]?.mrv ?? 20;
  const courseMult = onCourse ? (courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
  return baseMrv * courseMult * labMultiplier;
}
