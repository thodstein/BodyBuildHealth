/**
 * workout-summary.engine.ts — единый движок сводных отчётов по тренировкам.
 *
 * Один источник правды для трёх мест:
 *  1) экран проведения тренировки (SessionPlayer → «Итог»),
 *  2) дневник → «Отчёт» (сводка по тренировке/нескольким/неделе/месяцу/всему),
 *  3) карточка тренировки в истории дневника.
 *
 * Считает ДВЕ оси аналитики, которые просит продукт:
 *  • движения (sets / reps / КПШ / средний вес / лучший e1RM / паттерн),
 *  • объём (тоннаж кг, доля %, распределение по мышцам, плотность кг/мин).
 *
 * Чистые функции без React и localStorage — легко тестировать.
 */
import { EXERCISE_CATALOG } from '../core/exercise-catalog';
import { epley1RM } from './e1rm';
import { getVolumeLandmarks, checkVolumeStatus, type VolumeStatus } from './volume-landmarks.engine';
import { normalizeExerciseName } from './set-intensity.engine';
import type { WorkoutLog, StrengthLogEntry } from '../core/types';

// ───────────────────────────────────────────────────────────────────────────
// Словари мышц / движений
// ───────────────────────────────────────────────────────────────────────────

export type MuscleKey =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'arms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'legs'
  | 'core' | 'forearms' | 'traps' | 'fullbody' | 'other';

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  arms: 'Руки',
  quads: 'Квадрицепсы',
  hamstrings: 'Бицепс бедра',
  glutes: 'Ягодицы',
  calves: 'Икры',
  legs: 'Ноги',
  core: 'Кор',
  forearms: 'Предплечья',
  traps: 'Трапеции',
  fullbody: 'Всё тело',
  other: 'Прочее',
};

export const MUSCLE_COLORS: Record<MuscleKey, string> = {
  chest: '#00e68a',
  back: '#60a5fa',
  shoulders: '#a855f7',
  biceps: '#f472b6',
  triceps: '#fb923c',
  arms: '#ef4444',
  quads: '#facc15',
  hamstrings: '#3b82f6',
  glutes: '#ec4899',
  calves: '#eab308',
  legs: '#f59e0b',
  core: '#22c55e',
  forearms: '#94a3b8',
  traps: '#8b5cf6',
  fullbody: '#06b6d4',
  other: '#64748b',
};

export const PATTERN_LABELS: Record<string, string> = {
  squat: 'Приседание',
  hinge: 'Тазобедренный шарнир',
  horizontal_push: 'Горизонтальный жим',
  horizontal_pull: 'Горизонтальная тяга',
  vertical_push: 'Вертикальный жим',
  vertical_pull: 'Вертикальная тяга',
  lunge: 'Выпад / одноногие',
  carry: 'Переноска',
  rotation: 'Ротация',
  anti_rotation: 'Антиротация',
  core: 'Кор',
  incline_push: 'Жим под наклоном',
  dip_push: 'Отжимания / брусья',
  decline_push: 'Жим вниз головой',
  isolation_chest: 'Изоляция: грудь',
  isolation_shoulders: 'Изоляция: плечи',
  isolation_back: 'Изоляция: спина',
  isolation_arms: 'Изоляция: руки',
  isolation_legs_quad: 'Изоляция: квадрицепс',
  isolation_legs_ham: 'Изоляция: бицепс бедра',
  isolation_calves: 'Изоляция: икры',
  isolation_glutes: 'Изоляция: ягодицы',
  glute_squat: 'Ягодичный жим',
  adduction: 'Приведение',
  other: 'Прочее',
};

type CatalogEntry = { id: string; name: string; group?: string; movementPattern?: string; targetMuscle?: string };
const CATALOG = EXERCISE_CATALOG as unknown as CatalogEntry[];
const catalogById = new Map<string, CatalogEntry>();
const catalogByName = new Map<string, CatalogEntry>();
for (const c of CATALOG) {
  if (c?.id) catalogById.set(String(c.id).toLowerCase(), c);
  if (c?.name) catalogByName.set(String(c.name).toLowerCase(), c);
}

function norm(text: string): string {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').trim();
}

/** Ключ мышцы по свободному тексту (название/таргет каталога). */
export function muscleFromText(text: string): MuscleKey | null {
  const t = norm(text);
  if (!t) return null;
  // порядок важен: составные («бицепс бедра») раньше простых («бицепс»)
  if (/сгибан[а-яё]*\s+ног|leg\s*curl|legcurl/.test(t)) return 'hamstrings';
  if (/разгибан[а-яё]*\s+ног|leg\s*ext|legext|выпрямление\s+ног/.test(t)) return 'quads';
  if (/румынск|rdl\b|good\s*morning|гудморнинг/.test(t)) return 'hamstrings';
  if (/бицепс\s*бедра|двуглав[а-яё]*\s*бедра|hamstrings?/.test(t)) return 'hamstrings';
  if (/квадрицепс|четырехглав|quads?/.test(t)) return 'quads';
  if (/присед|squat/.test(t)) return 'quads';
  if (/жим\s*ног|leg\s*press/.test(t)) return 'quads';
  if (/подъ[её]м[а-яё]*\s*на\s*нос|носк[а-яё]*|икр|calf|calves/.test(t)) return 'calves';
  if (/станова|deadlift|наклон[а-яё]*\s*со\s*штангой|гиперэкстенз|hyperextension/.test(t)) return 'hamstrings';
  if (/ягодичн|hip\s*thrust|мост\b|ягодиц|glute/.test(t)) return 'glutes';
  if (/подтягив|pull\s*-?\s*up|pullup|pulldown|тяга\s*верхн/.test(t)) return 'back';
  if (/разводк|пек-?дек|pec\s*deck|\bfly\b|бабочка/.test(t)) return 'chest';
  if (/жим.*?\b(лёжа|лежа)|\bbench\b|отжимани|push\s*-?\s*up|брусь|dips?\b/.test(t)) return 'chest';
  if (/жим.*?\b(стоя|сидя|армейск|над\s*головой)|overhead\s*press|\bohp\b|махи|разведени[а-яё]*\s*в\s*стороны|lateral\s*raise|front\s*raise|тяга\s*к\s*подбородку/.test(t)) return 'shoulders';
  if (/шраг|shrug/.test(t)) return 'traps';
  if (/французск|pushdown|push\s*down|skull|кикбэк|kickback/.test(t)) return 'triceps';
  if (/скручиван|подъ[её]м[а-яё]*\s*ног\s*в\s*висе|планк|plank|пресс\b/.test(t)) return 'core';
  if (/предплеч|forearm/.test(t)) return 'forearms';
  if (/трицепс|tricep/.test(t)) return 'triceps';
  if (/бицепс|bicep|brachial/.test(t)) return 'biceps';
  if (/трапец|traps?/i.test(t)) return 'traps';
  if (/пресс|кор\b|core|abs\b|планк|plank/.test(t)) return 'core';
  if (/дельт|плеч|shoulder/.test(t)) return 'shoulders';
  if (/груд|chest|pec/.test(t)) return 'chest';
  if (/широчайш|спин|back|lat\b|row|тяга/.test(t)) return 'back';
  if (/бедр|ног|leg|thigh|squat|присед/.test(t)) return 'legs';
  if (/все тело|fullbody|full body/.test(t)) return 'fullbody';
  return null;
}

const GROUP_TO_MUSCLE: Record<string, MuscleKey> = {
  chest: 'chest', back: 'back', shoulders: 'shoulders', arms: 'arms',
  legs: 'legs', core: 'core', calves: 'calves', triceps: 'triceps',
};

export interface MuscleResolution {
  muscle: MuscleKey;
  pattern: string;
  /** Подпись паттерна для таблиц. */
  patternLabel: string;
}

/** Паттерн движения по названию упражнения (для legacy-записей без каталога). */
export function patternFromText(text: string): string | null {
  const t = norm(text);
  if (!t) return null;
  if (/присед|squat/.test(t)) return 'squat';
  if (/станова|румынск|\brdl\b|good\s*morning|гиперэкстенз|наклон[а-яё]*\s*со\s*штангой/.test(t)) return 'hinge';
  if (/выпад|lunge|болгарск|зашагиван|step\s*-?\s*up/.test(t)) return 'lunge';
  if (/жим\s*ног|leg\s*press/.test(t)) return 'squat';
  if (/жим.*?\b(лёжа|лежа)|\bbench\b|отжимани|push\s*-?\s*up|брусь|dips?\b|разводк|пек-?дек|\bfly\b/.test(t)) return 'horizontal_push';
  if (/жим.*?\b(стоя|сидя|армейск|над\s*головой)|overhead\s*press|\bohp\b|махи|разведени[а-яё]*\s*в\s*стороны|lateral\s*raise|front\s*raise/.test(t)) return 'vertical_push';
  if (/подтягив|pull\s*-?\s*up|pullup|pulldown|тяга\s*верхн/.test(t)) return 'vertical_pull';
  if (/тяга|row|шраг|shrug|face\s*pull|лицом\s*к\s*себе/.test(t)) return 'horizontal_pull';
  if (/переноск|carry|фермер|farmer/.test(t)) return 'carry';
  if (/планк|plank|скручиван|пресс\b|подъ[её]м[а-яё]*\s*ног\s*в\s*висе/.test(t)) return 'core';
  return null;
}

/** Изолирующие паттерны по мышце — когда в названии есть curl/raise/fly и т.п. */
const ISOLATION_BY_MUSCLE: Record<MuscleKey, string> = {
  chest: 'isolation_chest',
  back: 'isolation_back',
  shoulders: 'isolation_shoulders',
  biceps: 'isolation_arms',
  triceps: 'isolation_arms',
  arms: 'isolation_arms',
  quads: 'isolation_legs_quad',
  hamstrings: 'isolation_legs_ham',
  glutes: 'isolation_glutes',
  calves: 'isolation_calves',
  legs: 'isolation_legs_quad',
  core: 'core',
  forearms: 'isolation_arms',
  traps: 'isolation_back',
  fullbody: 'other',
  other: 'other',
};

const ISOLATION_HINT = /сгибани|разгибани|curl|pushdown|push\s*down|кикбэк|kickback|разводк|\bfly\b|махи|raise|шраг|shrug|подъ[её]м[а-яё]*\s*на\s*нос|бабочка|пек-?дек|французск|трицепс|бицепс/;

/** Мышца + паттерн движения для записи упражнения (каталог → эвристики по имени). */
export function resolveExerciseMeta(ex: { exerciseId?: string; exerciseName?: string; name?: string; muscleGroup?: string; movementPattern?: string }): MuscleResolution {
  const rawName = String(ex?.exerciseName || ex?.name || '').trim();
  const id = norm(ex?.exerciseId || '');
  const cat = (id ? catalogById.get(id) : undefined) || (rawName ? catalogByName.get(rawName.toLowerCase()) : undefined);

  let muscle: MuscleKey | null = null;
  if (rawName) muscle = muscleFromText(rawName);
  if (!muscle && cat?.targetMuscle) muscle = muscleFromText(cat.targetMuscle);
  if (!muscle && ex?.muscleGroup) muscle = muscleFromText(ex.muscleGroup);
  if (!muscle && cat?.group) muscle = GROUP_TO_MUSCLE[cat.group] || muscleFromText(cat.group);
  if (!muscle) muscle = 'other';

  let pattern = String(ex?.movementPattern || cat?.movementPattern || '');
  if (!pattern) pattern = patternFromText(rawName) || '';
  if (!pattern && ISOLATION_HINT.test(norm(rawName))) pattern = ISOLATION_BY_MUSCLE[muscle] || 'other';
  if (!pattern) pattern = 'other';

  return { muscle, pattern, patternLabel: PATTERN_LABELS[pattern] || PATTERN_LABELS.other };
}

// ───────────────────────────────────────────────────────────────────────────
// Типы отчёта
// ───────────────────────────────────────────────────────────────────────────

export const REPORT_BLOCKS = [
  { id: 'totals', label: 'Общее' },
  { id: 'insights', label: 'Выводы' },
  { id: 'compare', label: 'Сравнение' },
  { id: 'volume', label: 'Объём' },
  { id: 'muscles', label: 'Мышцы' },
  { id: 'exercises', label: 'Упражнения' },
  { id: 'plan', label: 'План → факт' },
  { id: 'sets', label: 'Подходы' },
  { id: 'movement', label: 'Движения' },
  { id: 'sessions', label: 'Тренировки' },
  { id: 'prs', label: 'Рекорды' },
] as const;

export type ReportBlockId = typeof REPORT_BLOCKS[number]['id'];

export const ALL_REPORT_BLOCKS: ReportBlockId[] = REPORT_BLOCKS.map(b => b.id);

export interface SummaryExercise {
  name: string;
  muscle: MuscleKey;
  muscleLabel: string;
  pattern: string;
  patternLabel: string;
  sets: number;
  reps: number;
  tonnageKg: number;
  bestWeight: number;
  bestReps: number;
  bestE1RM: number;
  avgLoadKg: number;
  /** Средний вес подхода в % от лучшего e1RM этого упражнения за период. */
  avgIntensityPct: number | null;
  avgRepsPerSet: number;
  avgRIR: number | null;
  avgRPE: number | null;
  sharePct: number;
  sessions: number;
  /** Подходы без внешнего веса (свой вес, резинка) — в тоннаж не входят. */
  weightlessSets: number;
  /** Лучший e1RM по последним (до 12) тренировкам периода — для спарклайна. */
  e1rmSeries: number[];
  /** Прирост e1RM от первой к последней точке серии, % (null — меньше двух точек). */
  progressPct: number | null;
}

export interface SummaryMuscle {
  muscle: MuscleKey;
  label: string;
  color: string;
  sets: number;
  reps: number;
  tonnageKg: number;
  exercises: number;
  sharePct: number;
  /** Подходов на сессию — сравнение с MEV/MAV в уме. */
  setsPerSession: number;
  /** Подходы по неделям периода (по возрастанию) — для мини-графика. */
  weeklySets: number[];
  /** Изменение подходов/нед от первой недели к последней, % (null — нет базы). */
  weeklyTrendPct: number | null;
}

export interface SummaryPattern {
  pattern: string;
  label: string;
  sets: number;
  reps: number;
  tonnageKg: number;
  sharePct: number;
  /** Подходы по неделям периода (по возрастанию) — для тренда. */
  weeklySets: number[];
  /** Изменение подходов/нед первой недели к последней, % (null — нет базы). */
  weeklyTrendPct: number | null;
}

export interface SummarySession {
  id: string;
  date: string;
  split: string;
  durationMin: number;
  exercises: number;
  sets: number;
  reps: number;
  tonnageKg: number;
  prs: number;
  /** кг/мин — плотность тренировки. */
  density: number;
}

export interface SummaryWeek {
  label: string;
  sessions: number;
  sets: number;
  /** КПШ — количество подъёмов за неделю. */
  reps: number;
  tonnageKg: number;
}

export interface SummaryPR {
  exercise: string;
  weight: number;
  reps: number;
  e1rm: number;
  date: string;
  deltaPct: number | null;
}

export interface WorkoutSummaryTotals {
  sessions: number;
  uniqueExercises: number;
  sets: number;
  reps: number;
  tonnageKg: number;
  durationMin: number;
  avgSessionMin: number;
  avgSetsPerSession: number;
  avgRepsPerSession: number;
  avgRepsPerSet: number;
  avgLoadKg: number;
  maxLoadKg: number;
  densityKgPerMin: number;
  avgRIR: number | null;
  avgRPE: number | null;
  /** Средняя нагрузка в % от лучшего e1RM — насколько тяжело шла работа. */
  avgIntensityPct: number | null;
  prs: number;
  /** Уникальных дней с тренировкой (для «несколько тренировок»). */
  trainingDays: number;
  /** Подходы без внешнего веса (свой вес) — тоннаж по ним не считается. */
  weightlessSets: number;
}

export interface WorkoutSummary {
  workouts: number;
  dateFrom: string;
  dateTo: string;
  totals: WorkoutSummaryTotals;
  exercises: SummaryExercise[];
  muscles: SummaryMuscle[];
  patterns: SummaryPattern[];
  sessions: SummarySession[];
  weeks: SummaryWeek[];
  prs: SummaryPR[];
}

type LooseSet = { weight?: number; weightKg?: number; reps?: number; rir?: number; rpe?: number } | null | undefined;
type LooseExercise = Partial<StrengthLogEntry> & { name?: string; totalVolume?: number; sets?: LooseSet[]; muscleGroup?: string; movementPattern?: string };

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const setWeight = (s: LooseSet): number => num((s as any)?.weight ?? (s as any)?.weightKg);
const setReps = (s: LooseSet): number => num((s as any)?.reps);

/** ISO-неделя (пн–вс) для даты 'YYYY-MM-DD'. */
export function weekRangeFor(dateIso: string): { from: string; to: string; label: string } {
  const d = new Date(`${String(dateIso || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { from: '', to: '', label: '' };
  const dow = (d.getDay() + 6) % 7;
  const from = new Date(d);
  from.setDate(d.getDate() - dow);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const fmt = (x: Date) => x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  return { from: iso(from), to: iso(to), label: `${fmt(from)}–${fmt(to)}` };
}

/** Диапазон месяца 'YYYY-MM'. */
export function monthRange(ym: string): { from: string; to: string; label: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return { from: '', to: '', label: '' };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  const label = new Date(`${from}T00:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

export function filterWorkoutsByRange(workouts: WorkoutLog[], from: string, to: string): WorkoutLog[] {
  if (!from && !to) return workouts.slice();
  return (workouts || []).filter(w => {
    const d = String(w?.date || '').slice(0, 10);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

/**
 * Сводка по набору тренировок (1..N). Одна тренировка → отчёт по тренировке,
 * несколько/неделя/месяц → агрегированный отчёт по периоду.
 */
export function buildWorkoutSummary(workouts: WorkoutLog[], baselineWorkouts?: WorkoutLog[]): WorkoutSummary {
  const list = (Array.isArray(workouts) ? workouts : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  type ExAgg = {
    name: string; muscle: MuscleKey; muscleLabel: string; pattern: string; patternLabel: string;
    sets: number; reps: number; tonnageKg: number; bestWeight: number; bestReps: number; bestE1RM: number;
    rirSum: number; rirN: number; rpeSum: number; rpeN: number; sessions: Set<string>;
    /** Лучший e1RM по тренировкам периода (по возрастанию даты). */
    e1rmSeries: number[];
    /** Метка последней тренировки в серии — чтобы не дублировать одну и ту же. */
    seriesStamp: string;
    /** Подходы без внешнего веса (свой вес). */
    wlSets: number;
  };
  const exMap = new Map<string, ExAgg>();
  const muscleAgg = new Map<MuscleKey, { sets: number; reps: number; tonnageKg: number; ex: Set<string>; byWeek: Map<string, number> }>();
  const patternAgg = new Map<string, { sets: number; reps: number; tonnageKg: number; byWeek: Map<string, number> }>();
  const sessionRows: SummarySession[] = [];
  const weekAgg = new Map<string, SummaryWeek>();
  const prs: SummaryPR[] = [];
  // Лучший e1RM по упражнению до текущего момента — для честных PR по периоду.
  const bestBefore = new Map<string, number>();
  // Внешняя база (история до периода): иначе одиночная тренировка не знает,
  // что было раньше, и «рекорды» либо пропадают, либо выдумываются.
  for (const bw of (Array.isArray(baselineWorkouts) ? baselineWorkouts : [])) {
    const baseExercises = (Array.isArray(bw?.exercises) ? bw.exercises : []) as LooseExercise[];
    for (const ex of baseExercises) {
      if (!ex) continue;
      const baseName = String(ex.exerciseName || ex.name || ex.exerciseId || '').trim();
      if (!baseName) continue;
      let baseBest = 0;
      for (const st of (Array.isArray(ex.sets) ? ex.sets : []) as LooseSet[]) {
        const w = setWeight(st);
        const r = setReps(st);
        if (w > 0 && r > 0) baseBest = Math.max(baseBest, epley1RM(w, r));
      }
      if (baseBest > 0) bestBefore.set(baseName, Math.max(bestBefore.get(baseName) || 0, baseBest));
    }
  }

  let totalSets = 0;
  let totalReps = 0;
  let totalTonnage = 0;
  let totalDuration = 0;
  let totalRir = 0;
  let totalRirN = 0;
  let totalRpe = 0;
  let totalRpeN = 0;
  let maxLoad = 0;
  const days = new Set<string>();
  const uniqueExercises = new Set<string>();

  for (const w of list) {
    const date = String(w.date || '').slice(0, 10);
    const wk = weekRangeFor(date);
    if (date) days.add(date);
    const duration = num(w.duration);
    totalDuration += duration;
    const exercises = (Array.isArray(w.exercises) ? w.exercises : []) as LooseExercise[];
    let sSets = 0;
    let sReps = 0;
    let sTonnage = 0;
    let sPRs = 0;

    for (const ex of exercises) {
      if (!ex) continue;
      const name = String(ex.exerciseName || ex.name || ex.exerciseId || 'Упражнение').trim();
      if (!name) continue;
      const meta = resolveExerciseMeta(ex as any);
      const setsArr = (Array.isArray(ex.sets) ? ex.sets : []) as LooseSet[];
      let exSets = 0;
      let exReps = 0;
      let exTonnage = 0;
      let exBestWeight = 0;
      let exBestReps = 0;
      let exBestE1RM = 0;
      let exRirSum = 0;
      let exRirN = 0;
      let exRpeSum = 0;
      let exRpeN = 0;
      let exWl = 0;
      // Лучший подход по e1RM — именно он идёт в рекорд (вес и повторы из одного сета).
      let exBestSetWeight = 0;
      let exBestSetReps = 0;

      for (const st of setsArr) {
        const weight = setWeight(st);
        const reps = setReps(st);
        if (weight <= 0 && reps <= 0) continue;
        exSets += 1;
        exReps += reps;
        exTonnage += weight * reps;
        if (weight <= 0) exWl += 1;
        exBestWeight = Math.max(exBestWeight, weight);
        exBestReps = Math.max(exBestReps, reps);
        maxLoad = Math.max(maxLoad, weight);
        const rirRaw = (st as any)?.rir;
        if (rirRaw != null && Number.isFinite(Number(rirRaw))) { exRirSum += Number(rirRaw); exRirN += 1; }
        const rpeRaw = (st as any)?.rpe;
        if (rpeRaw != null && Number.isFinite(Number(rpeRaw))) { exRpeSum += Number(rpeRaw); exRpeN += 1; }
        if (weight > 0 && reps > 0) {
          const e1 = epley1RM(weight, reps);
          if (e1 > exBestE1RM) {
            exBestE1RM = e1;
            exBestSetWeight = weight;
            exBestSetReps = reps;
          }
        }
      }

      // Рекорд — рост над лучшим e1RM до этой сессии. Первая сессия периода —
      // базовая точка, а не рекорд: иначе «рекордами» становится всё подряд.
      if (exBestE1RM > 0) {
        const prevBest = bestBefore.get(name) || 0;
        if (prevBest > 0 && exBestE1RM > prevBest + 0.01) {
          sPRs += 1;
          prs.push({
            exercise: name,
            weight: exBestSetWeight,
            reps: exBestSetReps,
            e1rm: Math.round(exBestE1RM),
            date,
            deltaPct: Math.round(((exBestE1RM - prevBest) / prevBest) * 1000) / 10,
          });
        }
        if (exBestE1RM > prevBest) bestBefore.set(name, exBestE1RM);
      }

      if (exSets === 0) continue;
      uniqueExercises.add(name);
      sSets += exSets;
      sReps += exReps;
      sTonnage += exTonnage;
      totalRir += exRirSum; totalRirN += exRirN;
      totalRpe += exRpeSum; totalRpeN += exRpeN;

      const key = `${name}|${meta.muscle}`;
      const prev = exMap.get(key) || {
        name, muscle: meta.muscle, muscleLabel: MUSCLE_LABELS[meta.muscle],
        pattern: meta.pattern, patternLabel: meta.patternLabel,
        sets: 0, reps: 0, tonnageKg: 0, bestWeight: 0, bestReps: 0, bestE1RM: 0,
        rirSum: 0, rirN: 0, rpeSum: 0, rpeN: 0, sessions: new Set<string>(),
        e1rmSeries: [],
        seriesStamp: '',
        wlSets: 0,
      };
      prev.sets += exSets;
      prev.reps += exReps;
      prev.tonnageKg += exTonnage;
      prev.bestWeight = Math.max(prev.bestWeight, exBestWeight);
      prev.bestReps = Math.max(prev.bestReps, exBestReps);
      prev.bestE1RM = Math.max(prev.bestE1RM, exBestE1RM);
      if (exBestE1RM > 0) {
        const stamp = String(w.id || date);
        const rounded = Math.round(exBestE1RM);
        if (prev.seriesStamp === stamp && prev.e1rmSeries.length > 0) {
          const lastIdx = prev.e1rmSeries.length - 1;
          prev.e1rmSeries[lastIdx] = Math.max(prev.e1rmSeries[lastIdx], rounded);
        } else {
          prev.e1rmSeries.push(rounded);
          prev.seriesStamp = stamp;
        }
      }
      prev.rirSum += exRirSum; prev.rirN += exRirN;
      prev.rpeSum += exRpeSum; prev.rpeN += exRpeN;
      prev.wlSets += exWl;
      prev.sessions.add(w.id || date);
      exMap.set(key, prev);

      const mPrev = muscleAgg.get(meta.muscle) || { sets: 0, reps: 0, tonnageKg: 0, ex: new Set<string>(), byWeek: new Map<string, number>() };
      mPrev.sets += exSets; mPrev.reps += exReps; mPrev.tonnageKg += exTonnage; mPrev.ex.add(name);
      if (wk.from) mPrev.byWeek.set(wk.from, (mPrev.byWeek.get(wk.from) || 0) + exSets);
      muscleAgg.set(meta.muscle, mPrev);

      const pPrev = patternAgg.get(meta.pattern) || { sets: 0, reps: 0, tonnageKg: 0, byWeek: new Map<string, number>() };
      pPrev.sets += exSets; pPrev.reps += exReps; pPrev.tonnageKg += exTonnage;
      if (wk.from) pPrev.byWeek.set(wk.from, (pPrev.byWeek.get(wk.from) || 0) + exSets);
      patternAgg.set(meta.pattern, pPrev);
    }

    totalSets += sSets;
    totalReps += sReps;
    totalTonnage += sTonnage;

    sessionRows.push({
      id: String(w.id || `${date}_${sessionRows.length}`),
      date,
      split: String(w.split || 'Тренировка'),
      durationMin: Math.round(duration),
      exercises: exercises.filter(e => Array.isArray(e?.sets) && e!.sets!.some(s => setReps(s) > 0 || setWeight(s) > 0)).length,
      sets: sSets,
      reps: sReps,
      tonnageKg: Math.round(sTonnage),
      prs: sPRs,
      density: duration > 0 ? Math.round((sTonnage / duration) * 10) / 10 : 0,
    });

    const wkRange = weekRangeFor(date);
    if (wkRange.from) {
      const wPrev = weekAgg.get(wkRange.from) || { label: wkRange.label, sessions: 0, sets: 0, reps: 0, tonnageKg: 0 };
      wPrev.sessions += 1; wPrev.sets += sSets; wPrev.reps += sReps; wPrev.tonnageKg += sTonnage;
      weekAgg.set(wkRange.from, wPrev);
    }
  }

  const dateValues = list.map(w => String(w.date || '').slice(0, 10)).filter(Boolean).sort();
  const sessions = list.length;

  const exercisesOut: SummaryExercise[] = Array.from(exMap.values())
    .map(e => ({
      name: e.name,
      muscle: e.muscle,
      muscleLabel: e.muscleLabel,
      pattern: e.pattern,
      patternLabel: e.patternLabel,
      sets: e.sets,
      reps: e.reps,
      tonnageKg: Math.round(e.tonnageKg),
      bestWeight: Math.round(e.bestWeight * 10) / 10,
      bestReps: e.bestReps,
      bestE1RM: Math.round(e.bestE1RM),
      avgLoadKg: e.sets > 0 ? Math.round((e.tonnageKg / Math.max(1, e.reps)) * 10) / 10 : 0,
      avgIntensityPct: e.bestE1RM > 0 && e.reps > 0
        ? Math.round(((e.tonnageKg / e.reps) / e.bestE1RM) * 1000) / 10
        : null,
      avgRepsPerSet: e.sets > 0 ? Math.round((e.reps / e.sets) * 10) / 10 : 0,
      avgRIR: e.rirN > 0 ? Math.round((e.rirSum / e.rirN) * 10) / 10 : null,
      avgRPE: e.rpeN > 0 ? Math.round((e.rpeSum / e.rpeN) * 10) / 10 : null,
      sharePct: totalTonnage > 0 ? Math.round((e.tonnageKg / totalTonnage) * 1000) / 10 : 0,
      sessions: e.sessions.size,
      weightlessSets: e.wlSets,
      e1rmSeries: e.e1rmSeries.slice(-12),
      progressPct: (() => {
        const s = e.e1rmSeries.slice(-12);
        if (s.length < 2) return null;
        const first = s[0];
        const last = s[s.length - 1];
        if (first <= 0) return null;
        return Math.round(((last - first) / first) * 1000) / 10;
      })(),
    }))
    .sort((a, b) => b.tonnageKg - a.tonnageKg || b.sets - a.sets);

  const activeWeekKeys = Array.from(weekAgg.keys()).sort();
  // Для динамики мышц нужна сплошная шкала недель: пропущенная неделя — это
  // ноль, а не отсутствие точки, иначе график склеивает перерыв.
  const muscleWeekKeys: string[] = (() => {
    const first = dateValues[0] ? weekRangeFor(dateValues[0]).from : '';
    const last = dateValues[dateValues.length - 1] ? weekRangeFor(dateValues[dateValues.length - 1]).from : '';
    if (!first || !last) return activeWeekKeys;
    const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const cur = new Date(`${first}T00:00:00`);
    const end = new Date(`${last}T00:00:00`);
    const keys: string[] = [];
    while (cur.getTime() <= end.getTime() && keys.length < 104) {
      keys.push(fmt(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return keys.length > 0 ? keys : activeWeekKeys;
  })();

  // Тренд по активным неделям: перерыв не считается «ростом с нуля», а
  // единственная неделя базы не даёт — сравнивать не с чем.
  const weeklyTrendFrom = (series: number[]): number | null => {
    const active = series.filter(x => x > 0);
    if (active.length < 2 || active[0] <= 0) return null;
    return Math.round(((active[active.length - 1] - active[0]) / active[0]) * 1000) / 10;
  };

  const musclesOut: SummaryMuscle[] = Array.from(muscleAgg.entries())
    .map(([muscle, v]) => {
      const weeklySets = muscleWeekKeys.map(k => v.byWeek.get(k) || 0);
      const weeklyTrendPct = weeklyTrendFrom(weeklySets);
      return {
        muscle,
        label: MUSCLE_LABELS[muscle],
        color: MUSCLE_COLORS[muscle],
        sets: v.sets,
        reps: v.reps,
        tonnageKg: Math.round(v.tonnageKg),
        exercises: v.ex.size,
        sharePct: totalTonnage > 0 ? Math.round((v.tonnageKg / totalTonnage) * 1000) / 10 : 0,
        setsPerSession: sessions > 0 ? Math.round((v.sets / sessions) * 10) / 10 : 0,
        weeklySets,
        weeklyTrendPct,
      };
    })
    .sort((a, b) => b.tonnageKg - a.tonnageKg || b.sets - a.sets);

  const patternsOut: SummaryPattern[] = Array.from(patternAgg.entries())
    .map(([pattern, v]) => {
      const weeklySets = muscleWeekKeys.map(k => v.byWeek.get(k) || 0);
      return {
        pattern,
        label: PATTERN_LABELS[pattern] || PATTERN_LABELS.other,
        sets: v.sets,
        reps: v.reps,
        tonnageKg: Math.round(v.tonnageKg),
        sharePct: totalTonnage > 0 ? Math.round((v.tonnageKg / totalTonnage) * 1000) / 10 : 0,
        weeklySets,
        weeklyTrendPct: weeklyTrendFrom(weeklySets),
      };
    })
    .sort((a, b) => b.sets - a.sets || b.tonnageKg - a.tonnageKg);

  const weeksOut: SummaryWeek[] = activeWeekKeys.map(k => {
    const v = weekAgg.get(k)!;
    return { label: v.label, sessions: v.sessions, sets: v.sets, reps: v.reps, tonnageKg: Math.round(v.tonnageKg) };
  });

  return {
    workouts: sessions,
    dateFrom: dateValues[0] || '',
    dateTo: dateValues[dateValues.length - 1] || '',
    totals: {
      sessions,
      uniqueExercises: uniqueExercises.size,
      sets: totalSets,
      reps: totalReps,
      tonnageKg: Math.round(totalTonnage),
      durationMin: Math.round(totalDuration),
      avgSessionMin: sessions > 0 ? Math.round(totalDuration / sessions) : 0,
      avgSetsPerSession: sessions > 0 ? Math.round((totalSets / sessions) * 10) / 10 : 0,
      avgRepsPerSession: sessions > 0 ? Math.round(totalReps / sessions) : 0,
      avgRepsPerSet: totalSets > 0 ? Math.round((totalReps / totalSets) * 10) / 10 : 0,
      avgLoadKg: totalReps > 0 ? Math.round((totalTonnage / totalReps) * 10) / 10 : 0,
      maxLoadKg: Math.round(maxLoad * 10) / 10,
      densityKgPerMin: totalDuration > 0 ? Math.round((totalTonnage / totalDuration) * 10) / 10 : 0,
      avgRIR: totalRirN > 0 ? Math.round((totalRir / totalRirN) * 10) / 10 : null,
      avgRPE: totalRpeN > 0 ? Math.round((totalRpe / totalRpeN) * 10) / 10 : null,
      avgIntensityPct: (() => {
        let weighted = 0;
        let base = 0;
        for (const e of exercisesOut) {
          if (!(e.bestE1RM > 0) || e.sets <= 0 || e.reps <= 0) continue;
          weighted += ((e.tonnageKg / e.reps) / e.bestE1RM) * e.sets;
          base += e.sets;
        }
        return base > 0 ? Math.round((weighted / base) * 1000) / 10 : null;
      })(),
      prs: prs.length,
      trainingDays: days.size,
      weightlessSets: exercisesOut.reduce((a, e) => a + e.weightlessSets, 0),
    },
    exercises: exercisesOut,
    muscles: musclesOut,
    patterns: patternsOut,
    sessions: sessionRows,
    weeks: weeksOut,
    // свежие рекорды сверху, но не больше 20 — этого достаточно для UI
    prs: prs.slice(-20).reverse(),
  };
}

/** Адаптер живой сессии (SessionPlayer) → WorkoutLog для отчёта «Итог». */
export function sessionToWorkoutLog(session: any): WorkoutLog {
  const exercises: StrengthLogEntry[] = (Array.isArray(session?.exercises) ? session.exercises : []).map((ex: any, i: number) => {
    const sets: StrengthLogEntry['sets'] = (Array.isArray(ex?.sets) ? ex.sets : []).map((st: any) => ({
      weight: num(st?.weightKg ?? st?.weight),
      reps: num(st?.reps),
      rir: num(st?.rir),
      rpe: num(st?.rpe),
    }));
    return {
      id: `${session?.sessionId || 'sess'}_${i}`,
      date: String(session?.date || '').slice(0, 10),
      exerciseId: String(ex?.exerciseId || ex?.exerciseName || ''),
      exerciseName: String(ex?.exerciseName || ex?.name || 'Упражнение'),
      sets,
      totalVolume: sets.reduce((s, x) => s + x.weight * x.reps, 0),
      estimated1RM: Math.max(0, ...sets.map(x => epley1RM(x.weight, x.reps))),
      isCompound: String(ex?.pattern || '').includes('compound'),
      muscleGroup: ex?.muscleGroup,
      weekNumber: session?.weekNumber,
    } as StrengthLogEntry;
  });
  return {
    id: String(session?.sessionId || 'session'),
    date: String(session?.date || '').slice(0, 10),
    duration: num(session?.durationMin),
    exercises,
    overallRPE: num(session?.avgIntensity),
    recoveryBefore: 0,
    split: String(session?.focus || 'Тренировка'),
    weekNumber: session?.weekNumber,
    notes: String(session?.notes || ''),
  };
}

/** Удобные подписи периодов для шапки отчёта. */
export function formatSummaryPeriod(summary: WorkoutSummary): string {
  if (!summary.dateFrom) return 'Нет данных';
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  if (summary.dateFrom === summary.dateTo) return fmt(summary.dateFrom);
  return `${fmt(summary.dateFrom)} — ${fmt(summary.dateTo)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Сравнение с предыдущим периодом
// ───────────────────────────────────────────────────────────────────────────

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  /** Изменение в %, null — сравнивать не с чем. */
  pct: number | null;
}

export interface SummaryComparison {
  /** true — предыдущий период пуст, дельт нет. */
  empty: boolean;
  metrics: {
    sessions: MetricDelta;
    sets: MetricDelta;
    reps: MetricDelta;
    tonnage: MetricDelta;
    duration: MetricDelta;
    density: MetricDelta;
    prs: MetricDelta;
    /** Средний RIR: null — в одном из периодов RIR не записан. */
    rir: MetricDelta | null;
  };
  muscles: Array<{ muscle: MuscleKey; label: string; sets: MetricDelta; tonnage: MetricDelta }>;
  patterns: Array<{ pattern: string; label: string; sets: MetricDelta; tonnage: MetricDelta }>;
  exercises: Array<{ name: string; e1rm: MetricDelta; tonnage: MetricDelta }>;
}

const mkDelta = (current: number, previous: number): MetricDelta => {
  const delta = Math.round((current - previous) * 10) / 10;
  return { current, previous, delta, pct: previous > 0 ? Math.round((delta / previous) * 1000) / 10 : null };
};

/**
 * Сравнение двух сводок (текущий период vs предыдущий равный). Считает дельты
 * по объёму и движениям: тоннаж, подходы, повторы, плотность, рекорды, а также
 * по мышцам, паттернам и e1RM упражнений. Мышцы/упражнения, которых не было в
 * предыдущем периоде, показываются как новые (pct = null).
 */
export function compareWorkoutSummaries(current: WorkoutSummary, previous?: WorkoutSummary | null): SummaryComparison {
  const empty = !previous || previous.workouts === 0;
  const cur = current?.totals;
  const prev = previous?.totals;

  const curRIR = cur?.avgRIR;
  const prevRIR = prev?.avgRIR;
  const metrics = {
    sessions: mkDelta(cur?.sessions || 0, prev?.sessions || 0),
    sets: mkDelta(cur?.sets || 0, prev?.sets || 0),
    reps: mkDelta(cur?.reps || 0, prev?.reps || 0),
    tonnage: mkDelta(cur?.tonnageKg || 0, prev?.tonnageKg || 0),
    duration: mkDelta(cur?.durationMin || 0, prev?.durationMin || 0),
    density: mkDelta(cur?.densityKgPerMin || 0, prev?.densityKgPerMin || 0),
    prs: mkDelta(cur?.prs || 0, prev?.prs || 0),
    // RIR — не объём: без записи хотя бы в одном периоде дельту не выдумываем.
    rir: curRIR != null && prevRIR != null ? mkDelta(curRIR, prevRIR) : null,
  };

  const prevMuscles = new Map<MuscleKey, SummaryMuscle>((previous?.muscles || []).map(m => [m.muscle, m]));
  const muscleKeys = new Set<MuscleKey>([
    ...(current?.muscles || []).map(m => m.muscle),
    ...(previous?.muscles || []).map(m => m.muscle),
  ]);
  const muscles = Array.from(muscleKeys)
    .map(muscle => {
      const c = (current?.muscles || []).find(m => m.muscle === muscle);
      const p = prevMuscles.get(muscle);
      return {
        muscle,
        label: MUSCLE_LABELS[muscle] || muscle,
        sets: mkDelta(c?.sets || 0, p?.sets || 0),
        tonnage: mkDelta(c?.tonnageKg || 0, p?.tonnageKg || 0),
      };
    })
    .filter(m => m.sets.current > 0 || m.sets.previous > 0)
    .sort((a, b) => (b.sets.current + b.sets.previous) - (a.sets.current + a.sets.previous));

  const prevPatterns = new Map<string, SummaryPattern>((previous?.patterns || []).map(p => [p.pattern, p]));
  const patternKeys = new Set<string>([
    ...(current?.patterns || []).map(p => p.pattern),
    ...(previous?.patterns || []).map(p => p.pattern),
  ]);
  const patterns = Array.from(patternKeys)
    .map(pattern => {
      const c = (current?.patterns || []).find(p => p.pattern === pattern);
      const p = prevPatterns.get(pattern);
      return {
        pattern,
        label: PATTERN_LABELS[pattern] || PATTERN_LABELS.other,
        sets: mkDelta(c?.sets || 0, p?.sets || 0),
        tonnage: mkDelta(c?.tonnageKg || 0, p?.tonnageKg || 0),
      };
    })
    .filter(p => p.sets.current > 0 || p.sets.previous > 0)
    .sort((a, b) => (b.sets.current + b.sets.previous) - (a.sets.current + a.sets.previous));

  const prevExercises = new Map<string, SummaryExercise>((previous?.exercises || []).map(e => [e.name, e]));
  const exerciseNames = new Set<string>([
    ...(current?.exercises || []).map(e => e.name),
    ...(previous?.exercises || []).map(e => e.name),
  ]);
  const exercises = Array.from(exerciseNames)
    .map(name => {
      const c = (current?.exercises || []).find(e => e.name === name);
      const p = prevExercises.get(name);
      return {
        name,
        e1rm: mkDelta(c?.bestE1RM || 0, p?.bestE1RM || 0),
        tonnage: mkDelta(c?.tonnageKg || 0, p?.tonnageKg || 0),
      };
    })
    .filter(e => e.e1rm.current > 0 || e.e1rm.previous > 0)
    .sort((a, b) => (b.e1rm.current + b.e1rm.previous) - (a.e1rm.current + a.e1rm.previous));

  return { empty, metrics, muscles, patterns, exercises };
}

// ───────────────────────────────────────────────────────────────────────────
// Выводы: короткие автоматические наблюдения по сводке
// ───────────────────────────────────────────────────────────────────────────

export interface SummaryInsight {
  id: string;
  tone: 'good' | 'warn' | 'info';
  icon: string;
  title: string;
  detail: string;
}

const PUSH_PATTERNS = ['horizontal_push', 'vertical_push', 'incline_push', 'dip_push', 'decline_push'];
const PULL_PATTERNS = ['horizontal_pull', 'vertical_pull'];
const KNEE_PATTERNS = ['squat', 'lunge', 'glute_squat'];

const signedPct = (pct: number): string => `${pct > 0 ? '+' : ''}${pct}%`;

/**
 * Выводы по сводке: баланс жимы/тяги и колено/таз, динамика тоннажа,
 * выход за MEV/MRV по мышцам, плотность, RIR и рекорды. Правила молчат,
 * если данных мало — лучше пусто, чем выдуманный совет.
 */
export function buildWorkoutInsights(s: WorkoutSummary, level = 'intermediate', comparison?: SummaryComparison | null, plan?: PlanVsActual | null): SummaryInsight[] {
  const out: SummaryInsight[] = [];
  if (!s || !s.workouts) return out;

  const setsBy = (ids: string[]) => (s.patterns || [])
    .filter(p => ids.includes(p.pattern))
    .reduce((acc, p) => acc + p.sets, 0);

  const pushSets = setsBy(PUSH_PATTERNS);
  const pullSets = setsBy(PULL_PATTERNS);
  if (pushSets + pullSets >= 6) {
    const balance = pullSets > 0 ? pushSets / pullSets : 99;
    if (balance >= 1.35) {
      out.push({ id: 'pushpull', tone: 'warn', icon: '↔', title: `Жимы перевешивают: ${pushSets} / ${pullSets} подходов`, detail: 'Добавьте горизонтальную или вертикальную тягу — иначе страдают плечи и осанка.' });
    } else if (balance <= 0.7) {
      out.push({ id: 'pushpull', tone: 'warn', icon: '↔', title: `Тяги перевешивают: ${pushSets} / ${pullSets} подходов`, detail: 'Добавьте жимовые подходы, чтобы грудь и дельты не отставали.' });
    } else {
      out.push({ id: 'pushpull', tone: 'good', icon: '✓', title: `Баланс жимы/тяги ${pushSets} / ${pullSets}`, detail: 'Плечевой пояс нагружается равномерно — хорошая база для прогресса.' });
    }
  }

  const kneeSets = setsBy(KNEE_PATTERNS);
  const hingeSets = setsBy(['hinge']);
  if (kneeSets + hingeSets >= 6) {
    const balance = hingeSets > 0 ? kneeSets / hingeSets : 99;
    if (balance >= 1.8) {
      out.push({ id: 'kneehip', tone: 'warn', icon: '🦵', title: `Колено доминирует над тазом: ${kneeSets} / ${hingeSets}`, detail: 'Добавьте румынскую тягу или сгибания ног — бицепс бедра и ягодицы недогружены.' });
    } else if (balance <= 0.5) {
      out.push({ id: 'kneehip', tone: 'warn', icon: '🦵', title: `Таз доминирует над коленом: ${kneeSets} / ${hingeSets}`, detail: 'Добавьте приседания или жим ногами — квадрицепс получает мало объёма.' });
    } else {
      out.push({ id: 'kneehip', tone: 'good', icon: '🦵', title: `Баланс колено/таз ${kneeSets} / ${hingeSets}`, detail: 'Нижняя часть тела нагружается без перекосов.' });
    }
  }

  if (s.weeks.length >= 2) {
    const last = s.weeks[s.weeks.length - 1];
    const prev = s.weeks[s.weeks.length - 2];
    if (prev.tonnageKg > 0 && last.tonnageKg > 0) {
      const pct = Math.round(((last.tonnageKg - prev.tonnageKg) / prev.tonnageKg) * 100);
      if (pct >= 15) {
        out.push({ id: 'trend', tone: 'info', icon: '📈', title: `Тоннаж недели ${signedPct(pct)} к прошлой`, detail: 'Резкий скачок объёма — следите за восстановлением и техникой.' });
      } else if (pct <= -15) {
        out.push({ id: 'trend', tone: 'warn', icon: '📉', title: `Тоннаж недели ${signedPct(pct)} к прошлой`, detail: 'Объём заметно просел: проверьте пропуски или запланируйте разгрузку.' });
      } else {
        out.push({ id: 'trend', tone: 'good', icon: '📊', title: `Тоннаж недели ${signedPct(pct)} к прошлой`, detail: 'Объём держится стабильно — хороший темп для прогрессии.' });
      }
    }
  }

  if (s.workouts >= 3) {
    const weeks = summaryWeeksCount(s);
    const under: string[] = [];
    const over: string[] = [];
    for (const m of s.muscles) {
      if (m.muscle === 'other' || m.sets <= 0) continue;
      const weekly = Math.round(m.sets / weeks);
      const lm = muscleLandmarksFor(m.muscle, weekly, level);
      if (!lm) continue;
      if (lm.status === 'below_mev') under.push(`${m.label} (${weekly} из ${lm.mev})`);
      else if (lm.status === 'exceeding_mrv') over.push(`${m.label} (${weekly} при MRV ${lm.mrv})`);
    }
    if (under.length > 0) {
      out.push({
        id: 'under-mev', tone: 'info', icon: '🎯',
        title: `Ниже MEV: ${under.slice(0, 3).join(', ')}`,
        detail: 'Подходов в неделю меньше минимального объёма для роста — добавьте 2–4 подхода, если мышца в приоритете.',
      });
    }
    if (over.length > 0) {
      out.push({
        id: 'over-mrv', tone: 'warn', icon: '🚧',
        title: `Выше MRV: ${over.slice(0, 3).join(', ')}`,
        detail: 'Объём за пределом восстановления — распределите подходы или запланируйте разгрузку.',
      });
    }
  }

  // Мышца вне коридора несколько недель подряд — это уже не разовая неделя,
  // а тренд, который стоит показать отдельно.
  if ((s.weeks || []).length >= 2) {
    for (const kind of ['exceeding_mrv', 'below_mev'] as const) {
      let best: { label: string; weeks: number } | null = null;
      for (const m of s.muscles || []) {
        if (m.muscle === 'other' || !Array.isArray(m.weeklySets) || m.weeklySets.length < 2) continue;
        // берём только хвост без пропусков: неделя отдыха сбрасывает серию
        const run: number[] = [];
        for (let i = m.weeklySets.length - 1; i >= 0 && m.weeklySets[i] > 0; i -= 1) run.unshift(m.weeklySets[i]);
        if (run.length < 2) continue;
        const statuses = run.map(v => muscleLandmarksFor(m.muscle, v, level)?.status || null);
        if (statuses[statuses.length - 1] !== kind) continue;
        let n = 1;
        for (let k = statuses.length - 2; k >= 0 && statuses[k] === kind; k -= 1) n += 1;
        if (n >= 2 && (!best || n > best.weeks)) best = { label: m.label, weeks: n };
      }
      if (!best) continue;
      if (kind === 'exceeding_mrv') {
        out.push({
          id: 'mrv-streak', tone: 'warn', icon: '🚧',
          title: `${best.label} выше MRV ${best.weeks} нед. подряд`,
          detail: 'Объём копится быстрее восстановления — запланируйте разгрузку или уберите 2–4 подхода в неделю.',
        });
      } else {
        out.push({
          id: 'mev-streak', tone: 'info', icon: '🎯',
          title: `${best.label} ниже MEV ${best.weeks} нед. подряд`,
          detail: 'Мышца недополучает минимальный объём — добавьте подходы, если она в приоритете.',
        });
      }
    }
  }

  if (s.totals.durationMin >= 20 && s.totals.tonnageKg > 0) {
    const density = s.totals.densityKgPerMin;
    if (density > 0 && density < 8) {
      out.push({ id: 'density', tone: 'info', icon: '⏱', title: `Плотность ${density} кг/мин`, detail: 'Много простоя: сократите отдых или объедините упражнения в суперсет.' });
    } else if (density >= 25) {
      out.push({ id: 'density', tone: 'good', icon: '⚡', title: `Высокая плотность: ${density} кг/мин`, detail: 'Тренировка насыщенная — следите, чтобы отдыха хватало на целевые повторы.' });
    }
  }

  const rir = s.totals.avgRIR;
  if (rir != null) {
    if (rir < 1) {
      out.push({ id: 'rir', tone: 'warn', icon: '🔥', title: `Средний RIR ${rir}`, detail: 'Почти все подходы в отказ — копится усталость. Оставьте 1–2 повтора в запасе.' });
    } else if (rir > 4) {
      out.push({ id: 'rir', tone: 'info', icon: '🫧', title: `Средний RIR ${rir}`, detail: 'Запас велик: можно поднять вес или добавить повтор для стимула.' });
    }
  }

  const intensity = s.totals.avgIntensityPct;
  if (intensity != null && s.totals.sessions >= 2) {
    if (intensity < 60) {
      out.push({ id: 'intensity', tone: 'info', icon: '🪶', title: `Средняя интенсивность ${intensity}% от e1RM`, detail: 'Подходы далеки от максимума — если цель сила, добавьте вес; если выносливость, так и задумано.' });
    } else if (intensity >= 85) {
      out.push({ id: 'intensity', tone: 'info', icon: '🏋️', title: `Средняя интенсивность ${intensity}% от e1RM`, detail: 'Работа идёт близко к максимуму — следите за восстановлением и техникой.' });
    }
  }

  if (s.weeks.length >= 2) {
    const moved = (s.muscles || [])
      .filter(m => m.weeklyTrendPct != null && Math.abs(m.weeklyTrendPct) >= 20)
      .sort((a, b) => Math.abs(b.weeklyTrendPct as number) - Math.abs(a.weeklyTrendPct as number))[0];
    if (moved && moved.weeklyTrendPct != null) {
      const active = moved.weeklySets.filter(x => x > 0);
      const up = moved.weeklyTrendPct > 0;
      out.push({
        id: 'muscle-trend',
        tone: up ? 'good' : 'info',
        icon: up ? '📈' : '📉',
        title: `${moved.label}: ${signedPct(moved.weeklyTrendPct)} подходов по неделям`,
        detail: `Было ${active[0]} → стало ${active[active.length - 1]} в неделю. ${up ? 'Объём растёт — проверьте, успевает ли мышца восстанавливаться.' : 'Объём снижается — нормально для разгрузки, но не для прогресса.'}`,
      });
    }
  }

  // План против факта. Блок «По упражнениям» показывает это построчно, но
  // итог читают в «Выводах»: сколько подходов не добито и что пропущено.
  if (plan && !plan.empty && plan.setsPct != null && plan.setsPct < 80) {
    const under = plan.rows
      .filter(r => r.status === 'under')
      .slice(0, 3)
      .map(r => `${r.name} ${r.actualSets}/${r.plannedSets}`);
    const parts: string[] = [];
    if (under.length) parts.push(`не добито: ${under.join(', ')}`);
    if (plan.skipped.length) parts.push(`пропущено: ${plan.skipped.slice(0, 3).join(', ')}`);
    // Худшее движение говорит, что просело: не «мало подходов вообще», а
    // конкретный паттерн, который стоит добрать в первую очередь.
    const weakest = plan.patterns
      .filter(p => p.setsDelta < 0 && p.setsPct != null)
      .sort((a, b) => (a.setsPct as number) - (b.setsPct as number))[0];
    out.push({
      id: 'plan-gap',
      tone: 'warn',
      icon: '📋',
      title: `План по подходам выполнен на ${plan.setsPct}%`,
      detail: `${parts.join('; ') || 'часть подходов не сделана'}${weakest ? `; слабее всего — ${weakest.label} ${weakest.actualSets}/${weakest.plannedSets}` : ''}. По плану ${plan.plannedSets} подх, по факту ${plan.actualSets}.`,
    });
  }

  // Сравнение с прошлым равным периодом: объём упал не у одной мышцы, а у
  // большинства — это либо плановая разгрузка, либо потерянные подходы.
  if (comparison && !comparison.empty && comparison.metrics.sets.pct != null) {
    const setsPct = comparison.metrics.sets.pct;
    const tonnagePct = comparison.metrics.tonnage.pct;
    const dropped = (comparison.muscles || [])
      .filter(m => m.sets.previous >= 4 && m.sets.pct != null && m.sets.pct <= -20);
    if (setsPct <= -20 && (tonnagePct == null || tonnagePct <= -20) && dropped.length >= 2) {
      const worst = dropped
        .slice()
        .sort((a, b) => (a.sets.pct as number) - (b.sets.pct as number))
        .slice(0, 3);
      out.push({
        id: 'deload',
        tone: 'info',
        icon: '🌙',
        title: `Похоже на разгрузку: подходов ${signedPct(setsPct)}, просели ${dropped.length} мышц`,
        detail: `${worst.map(m => `${m.label} ${signedPct(m.sets.pct as number)}`).join(', ')}. Если разгрузка плановая — так и надо; если нет, проверьте пропущенные подходы и урезанное время.`,
      });
    }
  }

  if (s.totals.prs > 0) {
    // Не только «сколько рекордов», но и в чём: имя упражнения и новый e1RM.
    const named = (s.prs || []).slice(0, 3).map(p => `${p.exercise} ${Math.round(p.e1rm)} кг`);
    out.push({
      id: 'prs',
      tone: 'good',
      icon: '🏆',
      title: `Рекордов: ${s.totals.prs}`,
      detail: `${named.length ? `${named.join(', ')}. ` : ''}Расчётный 1RM вырос — прогрессия идёт.`,
    });
  }

  return out.slice(0, 7);
}

// ───────────────────────────────────────────────────────────────────────────
// Детализация подходов (для «самой подробной» карточки тренировки)
// ───────────────────────────────────────────────────────────────────────────

export interface SetDetailRow {
  weight: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
}

export interface SetDetailExercise {
  name: string;
  muscle: MuscleKey;
  muscleLabel: string;
  sets: SetDetailRow[];
  tonnageKg: number;
  bestE1RM: number;
}

export interface SetDetailSession {
  id: string;
  date: string;
  split: string;
  durationMin: number;
  tonnageKg: number;
  exercises: SetDetailExercise[];
}

/** Подходы как есть: вес × повторы × RIR/RPE, по тренировкам (свежие первыми). */
export function buildSetDetails(workouts: WorkoutLog[]): SetDetailSession[] {
  const list = (Array.isArray(workouts) ? workouts : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return list.map(w => {
    const exercises: SetDetailExercise[] = [];
    const raw = (Array.isArray(w.exercises) ? w.exercises : []) as LooseExercise[];
    for (const ex of raw) {
      if (!ex) continue;
      const name = String(ex.exerciseName || ex.name || ex.exerciseId || 'Упражнение').trim();
      if (!name) continue;
      const sets: SetDetailRow[] = [];
      let tonnage = 0;
      let best = 0;
      for (const st of (Array.isArray(ex.sets) ? ex.sets : []) as LooseSet[]) {
        const weight = setWeight(st);
        const reps = setReps(st);
        if (weight <= 0 && reps <= 0) continue;
        const rirRaw = (st as any)?.rir;
        const rpeRaw = (st as any)?.rpe;
        sets.push({
          weight,
          reps,
          rir: rirRaw != null && Number.isFinite(Number(rirRaw)) ? Number(rirRaw) : null,
          rpe: rpeRaw != null && Number.isFinite(Number(rpeRaw)) ? Number(rpeRaw) : null,
        });
        tonnage += weight * reps;
        if (weight > 0 && reps > 0) best = Math.max(best, epley1RM(weight, reps));
      }
      if (sets.length === 0) continue;
      const meta = resolveExerciseMeta(ex as any);
      exercises.push({
        name,
        muscle: meta.muscle,
        muscleLabel: MUSCLE_LABELS[meta.muscle],
        sets,
        tonnageKg: Math.round(tonnage),
        bestE1RM: Math.round(best),
      });
    }
    return {
      id: String(w.id || `${w.date}_detail`),
      date: String(w.date || '').slice(0, 10),
      split: String(w.split || 'Тренировка'),
      durationMin: num(w.duration),
      tonnageKg: Math.round(exercises.reduce((acc, e) => acc + e.tonnageKg, 0)),
      exercises,
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Ориентиры объёма (MEV/MAV/MRV) для мышц отчёта
// ───────────────────────────────────────────────────────────────────────────

/** Ключи канонического движка ориентиров для наших мышц. */
const LANDMARK_KEY: Partial<Record<MuscleKey, string>> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  arms: 'arms',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  legs: 'legs',
  core: 'abs',
  forearms: 'forearms',
  traps: 'traps',
};

export interface MuscleLandmarkInfo {
  /** Средние подходы в неделю за период отчёта. */
  weeklySets: number;
  mev: number;
  mav: number;
  mrv: number;
  status: VolumeStatus;
}

/** Сколько недель покрывает отчёт (только недели с тренировками). */
export function summaryWeeksCount(s: WorkoutSummary): number {
  return Math.max(1, (s.weeks || []).length);
}

/** Ориентиры MEV/MAV/MRV для мышцы отчёта с учётом уровня. */
export function muscleLandmarksFor(muscle: MuscleKey, weeklySets: number, level: string): MuscleLandmarkInfo | null {
  const key = LANDMARK_KEY[muscle];
  if (!key) return null;
  const lm = getVolumeLandmarks(level || 'intermediate', key);
  if (!lm) return null;
  return { weeklySets, mev: lm.mev, mav: lm.mav, mrv: lm.mrv, status: checkVolumeStatus(weeklySets, lm) };
}

export interface VolumeAdvice {
  /** Сколько подходов в неделю добавить (+) или убрать (−). */
  delta: number;
  /** Короткий ярлык для строки мышцы: «+4/нед до MEV». */
  chip: string;
  hint: string;
}

/**
 * Что делать с объёмом мышцы: числа MEV/MAV/MRV сами по себе не подсказывают
 * действие. Возвращает одну конкретную правку — сколько подходов добавить или
 * убрать и зачем.
 *
 * `perWeek = false` — отчёт по одной тренировке: ориентиры недельные, поэтому
 * обещать «+6/нед» по одному занятию нельзя, только «+6 до MEV».
 */
export function volumeAdvice(lm: MuscleLandmarkInfo | null, perWeek = true): VolumeAdvice | null {
  if (!lm || !Number.isFinite(lm.weeklySets)) return null;
  const sets = Math.round(lm.weeklySets);
  const unit = perWeek ? '/нед' : '';
  if (lm.status === 'below_mev') {
    const delta = Math.max(1, Math.round(lm.mev - sets));
    return {
      delta,
      chip: `+${delta}${unit} до MEV`,
      hint: perWeek
        ? `До минимального эффективного объёма не хватает ${delta} подходов в неделю.`
        : `До минимального эффективного объёма не хватает ${delta} подходов в неделю. Показана одна тренировка — если мышца тренируется чаще, недельный объём выше.`,
    };
  }
  if (lm.status === 'exceeding_mrv') {
    const over = Math.max(1, Math.round(sets - lm.mrv));
    return {
      delta: -over,
      chip: `−${over}${unit}`,
      hint: perWeek
        ? `На ${over} подходов в неделю выше предела восстановления — уберите их или запланируйте разгрузку.`
        : `На ${over} подходов выше недельного предела восстановления, если это единственная тренировка мышцы за неделю.`,
    };
  }
  const delta = Math.max(0, Math.round(lm.mrv - sets));
  if (lm.status === 'approaching_mrv') {
    return {
      delta,
      chip: delta > 0 ? `+${delta} до предела` : 'у предела',
      hint: 'Объём близок к предельному — расти дальше только при хорошем восстановлении.',
    };
  }
  return {
    delta,
    chip: `запас +${delta} до MRV`,
    hint: 'В рабочем коридоре: держите темп или постепенно растите к MAV.',
  };
}

/** План одного упражнения: название и подходы из сессии (вес/повторы). */
export interface PlannedExerciseInput {
  name: string;
  sets: Array<{ weight?: number; reps?: number }>;
}

export type PlanRowStatus = 'done' | 'under' | 'over' | 'skipped' | 'unplanned';

export interface PlanVsActualRow {
  /** Нормализованное имя — ключ для склейки плана и факта. */
  key: string;
  name: string;
  plannedSets: number;
  actualSets: number;
  plannedTonnageKg: number;
  actualTonnageKg: number;
  /** Факт минус план по подходам: «−2» значит два подхода не добиты. */
  setsDelta: number;
  /** Доля подходов от плана, % (null — упражнения не было в плане). */
  setsPct: number | null;
  status: PlanRowStatus;
}

export interface PlanPatternRow {
  pattern: string;
  label: string;
  plannedSets: number;
  actualSets: number;
  /** Факт минус план по подходам этого движения. */
  setsDelta: number;
  /** Доля от плана, % (null — движения не было в плане). */
  setsPct: number | null;
}

export interface PlanVsActual {
  rows: PlanVsActualRow[];
  /** План → факт, свёрнутый по движениям (паттернам). */
  patterns: PlanPatternRow[];
  plannedSets: number;
  actualSets: number;
  plannedTonnageKg: number;
  actualTonnageKg: number;
  /** Выполнение плана по подходам, % (null — плана нет). */
  setsPct: number | null;
  /** Выполнение плана по тоннажу, % (null — плана или тоннажа нет). */
  tonnagePct: number | null;
  /** Планировались, но ни одного подхода не сделано. */
  skipped: string[];
  /** Сделаны, но в плане их не было. */
  unplanned: string[];
  /**
   * Плана нет — сравнивать не с чем. Строки неплановых упражнений при этом
   * могут быть построены, но `empty` говорит: план не передан.
   */
  empty: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pctOf = (actual: number, planned: number): number | null =>
  planned > 0 ? Math.round((actual / planned) * 1000) / 10 : null;

/**
 * Факт против плана по каждому упражнению. План — это подходы сессии из
 * плеера (targetSets), факт — агрегаты уже посчитанной сводки, поэтому
 * сравнение не зависит от того, как хранится сессия.
 *
 * Одноимённые упражнения склеиваются (регистр, ё/е, пунктуация), чтобы
 * «Жим штанги лёжа» из плана совпал с «жим штанги лежа» из факта.
 */
export function comparePlanVsActual(
  plan: PlannedExerciseInput[] | null | undefined,
  summary: WorkoutSummary,
): PlanVsActual {
  const planned = new Map<string, { name: string; sets: number; tonnage: number }>();
  (Array.isArray(plan) ? plan : []).forEach(ex => {
    const name = String(ex?.name || '').trim();
    if (!name) return;
    const key = normalizeExerciseName(name);
    const acc = planned.get(key) || { name, sets: 0, tonnage: 0 };
    (Array.isArray(ex.sets) ? ex.sets : []).forEach(st => {
      const weight = num((st as any)?.weight ?? (st as any)?.weightKg);
      const reps = num(st?.reps);
      if (weight <= 0 && reps <= 0) return;
      acc.sets += 1;
      acc.tonnage += weight > 0 ? weight * reps : 0;
    });
    planned.set(key, acc);
  });

  const actual = new Map<string, { name: string; sets: number; tonnage: number }>();
  (summary?.exercises || []).forEach(ex => {
    const key = normalizeExerciseName(ex.name);
    const acc = actual.get(key) || { name: ex.name, sets: 0, tonnage: 0 };
    acc.sets += ex.sets;
    acc.tonnage += ex.tonnageKg;
    actual.set(key, acc);
  });

  const rows: PlanVsActualRow[] = [];
  const skipped: string[] = [];
  const unplanned: string[] = [];

  planned.forEach((p, key) => {
    const a = actual.get(key);
    const actualSets = a?.sets ?? 0;
    const actualTonnage = a?.tonnage ?? 0;
    let status: PlanRowStatus = 'done';
    if (actualSets === 0) {
      status = 'skipped';
      skipped.push(p.name);
    } else if (actualSets < p.sets) status = 'under';
    else if (actualSets > p.sets) status = 'over';
    rows.push({
      key,
      name: p.name,
      plannedSets: p.sets,
      actualSets,
      plannedTonnageKg: Math.round(p.tonnage),
      actualTonnageKg: Math.round(actualTonnage),
      setsDelta: actualSets - p.sets,
      setsPct: pctOf(actualSets, p.sets),
      status,
    });
  });

  actual.forEach((a, key) => {
    if (planned.has(key)) return;
    unplanned.push(a.name);
    rows.push({
      key,
      name: a.name,
      plannedSets: 0,
      actualSets: a.sets,
      plannedTonnageKg: 0,
      actualTonnageKg: Math.round(a.tonnage),
      setsDelta: a.sets,
      setsPct: null,
      status: 'unplanned',
    });
  });

  // Свод по движениям: 3 подхода жима лёжа и 2 жима гантелей — это один
  // «горизонтальный жим», и недобор по нему виден сразу, без чтения строк.
  const byPattern = new Map<string, { label: string; planned: number; actual: number }>();
  rows.forEach(r => {
    const meta = resolveExerciseMeta({ name: r.name });
    const acc = byPattern.get(meta.pattern) || { label: meta.patternLabel, planned: 0, actual: 0 };
    acc.planned += r.plannedSets;
    acc.actual += r.actualSets;
    byPattern.set(meta.pattern, acc);
  });
  const patterns: PlanPatternRow[] = Array.from(byPattern.entries())
    .map(([pattern, v]) => ({
      pattern,
      label: v.label,
      plannedSets: v.planned,
      actualSets: v.actual,
      setsDelta: v.actual - v.planned,
      setsPct: pctOf(v.actual, v.planned),
    }))
    .sort((a, b) => b.plannedSets - a.plannedSets || b.actualSets - a.actualSets);

  const plannedSets = rows.reduce((s, r) => s + r.plannedSets, 0);
  const actualSets = rows.reduce((s, r) => s + r.actualSets, 0);
  const plannedTonnageKg = rows.reduce((s, r) => s + r.plannedTonnageKg, 0);
  const actualTonnageKg = rows.reduce((s, r) => s + r.actualTonnageKg, 0);
  return {
    rows,
    patterns,
    plannedSets,
    actualSets,
    plannedTonnageKg,
    actualTonnageKg,
    setsPct: pctOf(actualSets, plannedSets),
    tonnagePct: pctOf(actualTonnageKg, plannedTonnageKg),
    skipped,
    unplanned,
    empty: plannedSets === 0,
  };
}

export const PLAN_ROW_LABEL: Record<PlanRowStatus, string> = {
  done: 'по плану',
  under: 'не добито',
  over: 'сверх плана',
  skipped: 'пропущено',
  unplanned: 'не по плану',
};

export const PLAN_ROW_COLOR: Record<PlanRowStatus, string> = {
  done: '#22c55e',
  under: '#f59e0b',
  over: '#60a5fa',
  skipped: '#ef4444',
  unplanned: '#a78bfa',
};

// ─── Текстовый отчёт (копирование) ─────────────────────────────────────────

const textInt = (n: number): string => Math.round(n || 0).toLocaleString('ru-RU');
const textTon = (kg: number): string => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} т` : `${textInt(kg)} кг`);

export interface WorkoutReportTextOptions {
  /** Уровень спортсмена — для ориентиров MEV/MAV/MRV. */
  level?: string;
  /** Сравнение с прошлым периодом. */
  comparison?: SummaryComparison | null;
  /** Как назвать предыдущий период: «прошлой тренировкой». */
  comparisonLabel?: string;
  /** План против факта (плеер). */
  plan?: PlanVsActual | null;
  /** Подходы «как есть» — переданы только для короткого периода. */
  details?: SetDetailSession[] | null;
  /** Своя первая строка (например, «📊 Итог: FullBody — 62 мин»). */
  header?: string;
  /** Дополнительные строки в конце (например, прогрессия к следующей сессии). */
  footer?: string[];
}

/**
 * Текст отчёта для «Копировать»: одна и та же сборка для дневника и «Итога»
 * плеера, чтобы цифры и формулировки не расходились между экранами.
 * Текст самодостаточен: объём с правкой по MEV, сравнение, план и подходы.
 */
export function buildWorkoutReportText(s: WorkoutSummary, opts: WorkoutReportTextOptions = {}): string {
  const level = opts.level || 'intermediate';
  const lines: string[] = [];
  lines.push(opts.header || `📊 Отчёт: ${formatSummaryPeriod(s)}`);
  lines.push(`Тренировок: ${s.totals.sessions} · подходов: ${s.totals.sets} · повторов: ${s.totals.reps}`);
  lines.push(`Тоннаж: ${textTon(s.totals.tonnageKg)} · время: ${s.totals.durationMin} мин · плотность: ${s.totals.densityKgPerMin} кг/мин`);
  if (s.totals.avgIntensityPct != null) {
    lines.push(`Средняя интенсивность: ${s.totals.avgIntensityPct}% от e1RM`);
  }

  const weeksCount = summaryWeeksCount(s);
  const perWeek = s.totals.sessions > 1;
  const weeklyUnit = perWeek ? 'подх/нед' : 'подх за сессию';
  const totalSetsForShare = s.totals.sets > 0 ? s.totals.sets : 1;
  lines.push('');
  lines.push('По мышцам:');
  s.muscles.forEach(m => {
    const weekly = Math.round(m.sets / weeksCount);
    const trend = m.weeklyTrendPct != null ? ` (${signedPct(m.weeklyTrendPct)} к первой неделе)` : '';
    const adv = volumeAdvice(muscleLandmarksFor(m.muscle, weekly, level), perWeek);
    // Доля подходов честнее тоннажа: тяжёлые ноги забирают тоннаж, но объём
    // для гипертрофии — это подходы.
    const setsShare = Math.round((m.sets / totalSetsForShare) * 100);
    lines.push(`  ${m.label}: ${m.sets} подх · ${weekly} ${weeklyUnit}${trend}${adv ? ` · ${adv.chip}` : ''} · ${textTon(m.tonnageKg)} · доля ${m.sharePct}% тоннажа · ${setsShare}% подходов`);
  });

  lines.push('');
  lines.push('По упражнениям:');
  s.exercises.forEach(e => lines.push(
    `  ${e.name}: ${e.sets}×${e.avgRepsPerSet} · ${textTon(e.tonnageKg)} · лучший ${e.bestWeight}кг (e1RM ${e.bestE1RM})${e.avgIntensityPct != null ? ` · инт. ${e.avgIntensityPct}%` : ''}`,
  ));

  if (s.patterns.length) {
    lines.push('');
    lines.push('Движения:');
    s.patterns.forEach(p => {
      const trend = p.weeklyTrendPct != null ? ` (${signedPct(p.weeklyTrendPct)} к первой неделе)` : '';
      lines.push(`  ${p.label}: ${p.sets} подх · ${p.reps} повт · ${textTon(p.tonnageKg)}${trend}`);
    });
  }

  if (opts.plan && !opts.plan.empty) {
    const pva = opts.plan;
    lines.push('');
    lines.push(`План: ${pva.plannedSets} подх · факт: ${pva.actualSets} подх${pva.setsPct != null ? ` (${pva.setsPct}%)` : ''} · ${textTon(pva.plannedTonnageKg)} → ${textTon(pva.actualTonnageKg)}`);
    pva.rows.forEach(r => {
      if (r.status === 'done') return;
      const tone = r.status === 'unplanned' ? 'не по плану' : r.status === 'skipped' ? 'пропущено' : r.status === 'over' ? 'сверх плана' : 'не добито';
      lines.push(`  ${r.name}: план ${r.plannedSets} → факт ${r.actualSets} (${tone})`);
    });
    const movedPatterns = pva.patterns.filter(p => p.setsDelta !== 0).slice(0, 5);
    if (movedPatterns.length) {
      lines.push('  По движениям:');
      movedPatterns.forEach(p => lines.push(
        `    ${p.label}: ${p.plannedSets} → ${p.actualSets} подх${p.setsPct != null ? ` (${p.setsPct}%)` : ' (не по плану)'}`,
      ));
    }
  }

  const insights = buildWorkoutInsights(s, level, opts.comparison, opts.plan);
  if (insights.length) {
    lines.push('');
    lines.push('Выводы:');
    insights.forEach(ins => lines.push(`  ${ins.icon} ${ins.title} — ${ins.detail}`));
  }

  const cmp = opts.comparison;
  if (cmp && !cmp.empty) {
    const fmtDelta = (d: MetricDelta) =>
      `${d.delta > 0 ? '+' : ''}${textInt(d.delta)}${d.pct != null ? ` (${d.pct > 0 ? '+' : ''}${d.pct}%)` : ''}`;
    const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
    lines.push('');
    lines.push(`Сравнение с ${opts.comparisonLabel || 'прошлым периодом'}:`);
    lines.push(`  Тоннаж: ${textInt(cmp.metrics.tonnage.current)} кг, ${fmtDelta(cmp.metrics.tonnage)}`);
    lines.push(`  Подходы: ${cmp.metrics.sets.current}, ${fmtDelta(cmp.metrics.sets)}`);
    lines.push(`  Повторы: ${cmp.metrics.reps.current}, ${fmtDelta(cmp.metrics.reps)}`);
    if (cmp.metrics.duration.previous > 0) {
      lines.push(`  Время: ${textInt(cmp.metrics.duration.current)} мин, ${fmtDelta(cmp.metrics.duration)}`);
    }
    if (cmp.metrics.rir) {
      const r = cmp.metrics.rir;
      const fmtRir = (n: number) => String(Math.round(n * 10) / 10);
      lines.push(`  Средний RIR: ${fmtRir(r.current)}, ${r.delta > 0 ? '+' : ''}${fmtRir(r.delta)}`);
    }
    const movedMuscles = cmp.muscles.filter(m => m.sets.delta !== 0).slice(0, 5);
    if (movedMuscles.length) {
      lines.push('  Мышцы:');
      movedMuscles.forEach(m => lines.push(`    ${m.label}: ${m.sets.previous} → ${m.sets.current} подх. (${signed(m.sets.delta)})`));
    }
    const movedPatterns = cmp.patterns.filter(p => p.sets.delta !== 0).slice(0, 5);
    if (movedPatterns.length) {
      lines.push('  Движения:');
      movedPatterns.forEach(p => lines.push(`    ${p.label}: ${p.sets.previous} → ${p.sets.current} подх. (${signed(p.sets.delta)})`));
    }
    const movedE1rm = cmp.exercises.filter(e => e.e1rm.current > 0 && e.e1rm.delta !== 0).slice(0, 5);
    if (movedE1rm.length) {
      lines.push('  e1RM по упражнениям:');
      movedE1rm.forEach(e => lines.push(
        e.e1rm.previous > 0
          ? `    ${e.name}: ${e.e1rm.previous} → ${e.e1rm.current} кг (${signed(e.e1rm.delta)})`
          : `    ${e.name}: новое · ${e.e1rm.current} кг`,
      ));
    }
  }

  if (s.totals.weightlessSets > 0) {
    lines.push(`Без веса (свой вес/резинка, вне тоннажа): ${s.totals.weightlessSets} подх.`);
  }

  const details = opts.details || [];
  if (details.length) {
    lines.push('');
    lines.push('Подходы:');
    details.forEach(session => {
      lines.push(`  ${session.date} · ${session.split} · ${textTon(session.tonnageKg)}`);
      session.exercises.forEach(ex => {
        const sets = ex.sets
          .map(st => `${st.weight > 0 ? `${st.weight}×${st.reps}` : `×${st.reps}`}${st.rir != null ? `@${st.rir}` : st.rpe != null ? `@${st.rpe}RPE` : ''}`)
          .join(', ');
        lines.push(`    ${ex.name}: ${sets}`);
      });
    });
  }

  if (opts.footer && opts.footer.length > 0) {
    lines.push('');
    lines.push(...opts.footer);
  }

  return lines.join('\n');
}

export const VOLUME_STATUS_LABEL: Record<VolumeStatus, string> = {
  below_mev: 'ниже MEV',
  optimal: 'в норме',
  approaching_mrv: 'близко к MRV',
  exceeding_mrv: 'выше MRV',
};

export const VOLUME_STATUS_COLOR: Record<VolumeStatus, string> = {
  below_mev: '#60a5fa',
  optimal: '#22c55e',
  approaching_mrv: '#f59e0b',
  exceeding_mrv: '#ef4444',
};
