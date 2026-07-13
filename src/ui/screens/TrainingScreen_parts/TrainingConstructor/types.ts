import type React from 'react';
import { getVolumeLandmarks } from '../../../../engines/volume-landmarks.engine';

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
  { value: 'powerlifting', label: '🏆 Пауэрлифтинг' },
];

export const LEVELS = [
  { value: 'beginner', label: '🌱 Новичок' },
  { value: 'intermediate', label: '📈 Средний' },
  { value: 'advanced', label: '🏆 Опытный' },
  { value: 'enhanced', label: '⚡ Enhanced' },
];

export { PCT_FOR_RIR } from '../../../../engines/rir-table';

/* ─── Расширенные группы мышц (15 групп) ─── */
export const ALL_GROUPS = [
  'chest', 'back', 'quads', 'hamstrings', 'glutes', 'calves',
  'shoulders', 'delt_front', 'delt_mid', 'delt_rear',
  'biceps', 'triceps', 'abs', 'traps', 'forearms',
];

export const GROUP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', quads: 'Квадрицепсы',
  hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры',
  shoulders: 'Плечи', delt_front: 'Передняя дельта', delt_mid: 'Средняя дельта',
  delt_rear: 'Задняя дельта', biceps: 'Бицепс', triceps: 'Трицепс',
  arms: 'Руки', core: 'Кор', abs: 'Пресс', traps: 'Трапеции',
  forearms: 'Предплечья', full: 'Общее',
};

/* ─── Per-muscle volume — делегирует в volume-landmarks.engine (канон) ─── */
export const LEVEL_MRV_FLAT: Record<string, number> = {
  beginner: 15, intermediate: 20, advanced: 24, enhanced: 28,
};

export function getMrv(level: string, onCourse: boolean, courseIntensity: string, labMultiplier: number): number {
  const baseMrv = LEVEL_MRV_FLAT[level] ?? 20;
  const courseMult = onCourse ? (courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
  return baseMrv * courseMult * labMultiplier;
}

export function getPerMuscleMrvFromLevel(level: string, muscle: string, onCourse: boolean, courseIntensity: string, labMultiplier: number): { mev: number; mav: number; mrv: number } {
  const lm = getVolumeLandmarks(level, muscle);
  if (!lm) return { mev: 6, mav: 10, mrv: 15 };
  const courseMult = onCourse ? (courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
  return {
    mev: lm.mev,
    mav: lm.mav,
    mrv: Math.round(lm.mrv * courseMult * labMultiplier),
  };
}

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
  generator: 'режим', bbSplit: 'BB-сплит', bbLoad: 'стратегия нагрузки',
  bbCycle: 'BB-цикл', bbFocusGroup: 'фокус-группа', bbAutoDeload: 'авто-делод',
  bbVolGoal: 'цель по объёму', bbDeloadType: 'тип делода', bbSpecialization: 'спец-блок',
};

export interface ManualDay {
  day: number;
  groups: string[];
  exercises: ManualExercise[];
  /** Целевой session RPE (1-10) — ориентир для авторегуляции */
  sRPE?: { rpe: number; label: string };
  /** Оценка длительности сессии в минутах */
  estimatedMin?: number;
}

export interface ManualExercise {
  name: string;
  sets: number;
  reps: string;
  rir: number;
  rest: number;
  group: string;
  weight: number;
  weightNote?: string;
  role?: 'main' | 'secondary' | 'accessory';
  pattern?: string;
  loadMode?: 'weight' | 'velocity';
  targetVelocity?: number;
  note?: string;
  tempo?: string;
  warmupSets?: number;
  backoffSets?: number;
  equipment?: string;
  substitutionGroup?: string;
  jointStress?: string;
  fatigueCost?: number;
  /** Обоснование выбора (почему это упражнение попало в план) */
  rationale?: string;
  /** Возможные замены (имена упражнений из canReplace) */
  substitutions?: string[];
  /** Детальная схема разминки */
  warmupScheme?: { pct: number; reps: number; weight: number }[];
  /** Вес добивочного подхода (-20%) */
  backoffWeight?: number;
  /** BB-специфичные поля (сохраняются при конвертации BBPlan→ManualResult) */
  restSeconds?: number;
  character?: 'тяж' | 'памп' | 'лёг';
  muscleTarget?: string;
  technique?: string;
}

/** Признак того, что ManualResult сгенерирован BB-движком */
export interface ManualResultBBMeta {
  /** Источник генерации: 'manual' | 'bb_split' | 'bb_cycle' | 'program' */
  generator?: string;
  /** ID BB-сплита (если BB-режим) */
  bbPatternId?: string;
  /** Стратегия нагрузки (если BB-режим) */
  bbLoadStrategy?: string;
}

export interface ManualWeek {
  weekNumber: number;
  phase: string;
  phaseLabel: string;
  rir: number;
  days: ManualDay[];
  corrections: string[];
  /** Общий тоннаж недели (кг) */
  totalTonnage?: number;
}

export interface ManualResult {
  splitName: string;
  corrections: string[];
  days: ManualDay[];
  weeks?: ManualWeek[];
  currentWeek?: number;
  mesoLength?: number;
  /** BB-метаданные (источник генерации, стратегия нагрузки) */
  bbMeta?: ManualResultBBMeta;
}

export const DELOAD_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Нет делода' },
  { value: 3, label: 'Каждые 3 нед (продвинутый)' },
  { value: 4, label: 'Каждые 4 нед (стандарт)' },
  { value: 5, label: 'Каждые 5 нед' },
  { value: 6, label: 'Каждые 6 нед (новичок)' },
];

export const RIR_WAVE_PATTERNS: Record<string, { label: string; desc: string; rirByQuarter: [number, number, number, number] }> = {
  standard: { label: 'Стандартная волна', desc: '3→2→1→2 RIR по четвертям мезоцикла', rirByQuarter: [3, 2, 1, 2] },
  aggressive: { label: 'Агрессивная волна', desc: '2→1→0→1 RIR — для опытных, быстрый прогресс', rirByQuarter: [2, 1, 0, 1] },
  conservative: { label: 'Консервативная волна', desc: '4→3→2→3 RIR — для новичков, запас восстановления', rirByQuarter: [4, 3, 2, 3] },
};

export type ConstructorMode = 'macro' | 'manual';

export function detectGroup(name: string): string {
  const n = name.toLowerCase();
  if (/squat|присед|quad|ножн|выпад|lunge|leg press|жим ног/i.test(n)) return 'quads';
  if (/bench|жим.*леж|chest|груд|pec|push.*up/i.test(n)) return /shoulder|плеч|delt|армей|воен/i.test(n) ? 'shoulders' : 'chest';
  if (/deadlift|станов|тяга|row|pull|спин|back|chin|lat/i.test(n)) return 'back';
  if (/curl|бицеп|bicep|молот/i.test(n)) return 'biceps';
  if (/tricep|трицеп|extension.*бл|kick\s*back/i.test(n)) return 'triceps';
  if (/hamstring|сгиб.*ног|бицеп.*бедр|рум.*dead/i.test(n)) return 'hamstrings';
  if (/glute|ягод|hip.*thrust|таз/i.test(n)) return 'glutes';
  if (/calf|икр|носоч|подъем.*нос/i.test(n)) return 'calves';
  if (/trap|шраг|трап/i.test(n)) return 'traps';
  if (/forearm|предплеч|запясть|кистев/i.test(n)) return 'forearms';
  if (/ohp|shoulder|плеч|армей|жим.*сид|дельт|delt.*raise|махи.*сторон/i.test(n)) return 'shoulders';
  if (/pres|пресс|ab|кранч|скруч|планк|side.*bend|подъем.*ног|corp|core/i.test(n)) return 'abs';
  return 'full';
}
