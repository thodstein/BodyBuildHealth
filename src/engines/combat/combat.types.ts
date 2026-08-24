/**
 * combat.types.ts — типы для конструктора Единоборства (бокс/MMA/борьба/кик).
 * Только силовая часть зала. Внешняя нагрузка (тами/ринг) — через OutsideLoad.
 */

export type CombatDiscipline = 'boxing' | 'mma' | 'wrestling' | 'kickboxing' | 'general';
export type CombatGoal = 'power' | 'endurance' | 'maintenance' | 'camp' | 'weight_cut';
export type CombatLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface CombatInput {
  discipline: CombatDiscipline;
  goal: CombatGoal;
  level: CombatLevel;
  weeks: number;
  daysPerWeek: number; // 2-4 зала (обычно 2-3 при внезальной 4-5×)
  // Профиль
  bodyweight?: number;
  sex?: 'male' | 'female';
  age?: number;
  trainingYears?: number;
  equipment?: string[];
  injuries?: any[];
  mobilityRestrictions?: string[];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  // Весогонка (только camp/weight_cut)
  weightCutKg?: number; // кг к сгонке за цикл
  // Внешняя нагрузка
  outsideLoad?: import('../outside-load.engine').OutsideLoad | null;
  // Методика
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  // Recovery / PED
  peds?: string[];
  pedDoses?: Record<string, number>;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
  calorieSurplus?: number;
  proteinPerKg?: number;
}

export interface CombatSet {
  reps: number;
  rir: number;
  weight: number;
  tempo?: string;
  restSeconds?: number;
}

export interface CombatExercise {
  id: string;
  name: string;
  group: string; // neck/traps/shoulders/chest/back/legs/arms/core/grip
  pattern: string; // horizontal_push/vertical_pull/squat/hinge/neck_flexion/grip etc
  role: 'primary' | 'accessory';
  character: 'тяж' | 'памп' | 'лёг';
  sets: number;
  reps: string;
  rir: number;
  weight: number;
  workSets: CombatSet[];
  warmupSets?: CombatSet[];
  tempo?: string;
  restSeconds?: number;
  comment?: string;
}

export interface CombatSession {
  day: number;
  week: number;
  sessionTag: string; // upper_power / lower_power / full_conditioning / neck_grip etc
  character: 'тяж' | 'памп' | 'лёг';
  exercises: CombatExercise[];
  durationMin?: number;
}

export interface CombatWeek {
  week: number;
  phase: string; // gpp / power / endurance / taper / deload
  deload?: boolean;
  sessions: CombatSession[];
  totalSets?: number;
  outsideLoad?: number;
}

export interface CombatPlan {
  id: string;
  discipline: CombatDiscipline;
  goal: CombatGoal;
  level: CombatLevel;
  weeks: number;
  patternId: string;
  weeksData: CombatWeek[];
  outsideMetrics?: import('../outside-load.engine').OutsideLoadMetrics | null;
  validation?: { ok: boolean; warnings: string[]; errors: string[] };
  rationale: string[];
  report?: any;
  inputSnapshot?: CombatInput;
}

export const COMBAT_LEVELS: CombatLevel[] = ['beginner', 'intermediate', 'advanced', 'enhanced'];
export const COMBAT_DISCIPLINES: { id: CombatDiscipline; label: string; desc: string }[] = [
  { id: 'boxing', label: 'Бокс', desc: 'Удары руками, ноги — лёгкие, шея/кор/ротация' },
  { id: 'mma', label: 'ММА', desc: 'Удары + борьба + клинч, шея/хват/тяга' },
  { id: 'wrestling', label: 'Борьба', desc: 'Тяги/приседы унилатерально, шея/хват/спина' },
  { id: 'kickboxing', label: 'Кикбоксинг', desc: 'Ноги+кор ротация, шея, баланс' },
  { id: 'general', label: 'Общая', desc: 'Универсальная силовая для единоборств' },
];

export const COMBAT_GOALS: { id: CombatGoal; label: string; desc: string }[] = [
  { id: 'power', label: 'Взрывная сила', desc: 'Низкие повторы 3-6, RIR 2-3, взрывной темп' },
  { id: 'endurance', label: 'Силовая выносливость', desc: 'Средние 8-15, RIR 2-3, короткие отдыхи' },
  { id: 'maintenance', label: 'Поддержание', desc: 'Минимум 2×/нед, RIR 3-4, во время высокой внезальной' },
  { id: 'camp', label: 'Кэмп к бою', desc: 'Пик 4-8 нед: объём ↓ к бою, RIR ↑' },
  { id: 'weight_cut', label: 'Весогонка', desc: 'Дефицит + объём ×0.75, RIR 3-4, без отказа' },
];
