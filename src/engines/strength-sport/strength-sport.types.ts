/**
 * strength-sport.types.ts — типы для конструктора Силовой экстрим / Тяжёлая атлетика.
 * Один конструктор, три режима: weightlifting (ТА-двоеборье), strongman, hybrid.
 * Только силовая часть зала — техника помоста/ивента вне фокуса, но объём учитываем.
 */

export type StrengthSportMode = 'weightlifting' | 'strongman' | 'hybrid';
export type StrengthSportGoal = 'strength' | 'hypertrophy' | 'peaking' | 'technique' | 'maintenance';
export type StrengthSportLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
export type StrengthSportPhase = 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'transition';

export interface StrengthSportWorkMax {
  snatch?: number;
  cleanJerk?: number;
  clean?: number;
  jerk?: number;
  frontSquat?: number;
  backSquat?: number;
  deadlift?: number;
  overheadPress?: number;
  logPress?: number;
  bench?: number;
}

export interface StrengthSportInput {
  mode: StrengthSportMode;
  goal: StrengthSportGoal;
  level: StrengthSportLevel;
  weeks: number;
  daysPerWeek: number; // 2-6
  workMax: StrengthSportWorkMax;
  // Профиль
  bodyweight?: number;
  sex?: 'male' | 'female';
  age?: number;
  trainingYears?: number;
  equipment?: string[]; // barbell/dumbbell/machine/cable/specialty (yoke/log/stone/sandbag)
  injuries?: any[];
  mobilityRestrictions?: string[];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  // Внешняя нагрузка (вне зала)
  outsideLoad?: import('../outside-load.engine').OutsideLoad | null;
  // Доп
  allowExotic?: boolean;
  avoidAxialLoad?: boolean;
  bodyweightCapability?: { pullUpsStrict?: number; dipsStrict?: number };
  weakPoints?: string[];
  focus?: 'snatch' | 'clean' | 'squat' | 'overhead' | 'carry' | 'stone' | null;
  dupMode?: 'off' | 'heavy_light' | 'wave';
  intensityTech?: 'none' | 'cluster';
  // Методика
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  // PED / recovery
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
  // P0-1 + P0-7: соревнование и авторегуляция
  competitionDate?: string;
  startDate?: string;
  acwr?: { ratio: number; zone: 'undertrained'|'optimal'|'caution'|'dangerous' } | null;
}

export interface StrengthSportSet {
  reps: number;
  rir: number;
  weight: number;
  pct?: number; // % от ПМ движения
  tempo?: string;
  restSeconds?: number;
}

export interface StrengthSportExercise {
  id: string;
  name: string;
  group: string; // olympic/legs/back/shoulders/strongman
  pattern: string; // snatch/clean/jerk/squat/hinge/vertical_push/carry etc
  role: 'primary' | 'accessory';
  character: 'тяж' | 'памп' | 'лёг';
  sets: number;
  reps: string; // "3x3" или "5"
  rir: number;
  weight: number;
  workSets: StrengthSportSet[];
  warmupSets?: StrengthSportSet[];
  tempo?: string;
  restSeconds?: number;
  comment?: string;
  isCompetitionLift?: boolean;
}

export interface StrengthSportSession {
  day: number; // 1-индекс в неделе
  week: number;
  sessionTag: string; // snatch_day / clean_day / strength_day / overhead_day / event_day etc
  character: 'тяж' | 'памп' | 'лёг';
  focus?: string;
  exercises: StrengthSportExercise[];
  durationMin?: number;
  loadScore?: number;
}

export interface StrengthSportWeek {
  week: number;
  phase: StrengthSportPhase;
  deload?: boolean;
  taper?: boolean;
  sessions: StrengthSportSession[];
  totalSets?: number;
  totalTonnage?: number;
}

export interface StrengthSportPlan {
  id: string;
  mode: StrengthSportMode;
  goal: StrengthSportGoal;
  level: StrengthSportLevel;
  weeks: number;
  patternId: string;
  weeksData: StrengthSportWeek[];
  workMax: StrengthSportWorkMax;
  outsideMetrics?: import('../outside-load.engine').OutsideLoadMetrics | null;
  validation?: { ok: boolean; warnings: string[]; errors: string[] };
  rationale: string[];
  volumeLandmarks?: any[];
  report?: any;
  inputSnapshot?: StrengthSportInput;
}

export const STRENGTH_SPORT_LEVELS: StrengthSportLevel[] = ['beginner', 'intermediate', 'advanced', 'enhanced'];
export const STRENGTH_SPORT_MODES: { id: StrengthSportMode; label: string; desc: string }[] = [
  { id: 'weightlifting', label: 'Тяжёлая атлетика', desc: 'Рывок / Толчок / Тяги / Приседы — классическое двоеборье' },
  { id: 'strongman', label: 'Силовой экстрим', desc: 'Лог / Фермер / Йок / Камни / Тяги — ивент-дни' },
  { id: 'hybrid', label: 'Гибрид', desc: 'Штанга + стронг-ивенты в зале (без спец. снарядов — замены)' },
];

export const STRENGTH_SPORT_GOALS: { id: StrengthSportGoal; label: string; desc: string }[] = [
  { id: 'strength', label: 'Сила', desc: 'Низкие повторы, высокий % ПМ, RIR 0-2' },
  { id: 'hypertrophy', label: 'Масса', desc: 'Средние повторы 6-12, RIR 1-3' },
  { id: 'technique', label: 'Техника', desc: 'Малые веса 50-70%, много подходов 1-3 повт, паузы' },
  { id: 'peaking', label: 'Пик', desc: 'Подводка к старту — объём ↓, интенсивность ↑' },
  { id: 'maintenance', label: 'Поддержание', desc: 'Минимум для сохранения при высокой внешней нагрузке' },
];
