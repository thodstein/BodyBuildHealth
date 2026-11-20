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
  { id: 'volume', label: 'Объём' },
  { id: 'muscles', label: 'Мышцы' },
  { id: 'exercises', label: 'Упражнения' },
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
  avgRepsPerSet: number;
  avgRIR: number | null;
  avgRPE: number | null;
  sharePct: number;
  sessions: number;
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
}

export interface SummaryPattern {
  pattern: string;
  label: string;
  sets: number;
  reps: number;
  tonnageKg: number;
  sharePct: number;
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
  prs: number;
  /** Уникальных дней с тренировкой (для «несколько тренировок»). */
  trainingDays: number;
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
export function buildWorkoutSummary(workouts: WorkoutLog[]): WorkoutSummary {
  const list = (Array.isArray(workouts) ? workouts : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  type ExAgg = {
    name: string; muscle: MuscleKey; muscleLabel: string; pattern: string; patternLabel: string;
    sets: number; reps: number; tonnageKg: number; bestWeight: number; bestReps: number; bestE1RM: number;
    rirSum: number; rirN: number; rpeSum: number; rpeN: number; sessions: Set<string>;
  };
  const exMap = new Map<string, ExAgg>();
  const muscleAgg = new Map<MuscleKey, { sets: number; reps: number; tonnageKg: number; ex: Set<string> }>();
  const patternAgg = new Map<string, { sets: number; reps: number; tonnageKg: number }>();
  const sessionRows: SummarySession[] = [];
  const weekAgg = new Map<string, SummaryWeek>();
  const prs: SummaryPR[] = [];
  // Лучший e1RM по упражнению до текущего момента — для честных PR по периоду.
  const bestBefore = new Map<string, number>();

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

      for (const st of setsArr) {
        const weight = setWeight(st);
        const reps = setReps(st);
        if (weight <= 0 && reps <= 0) continue;
        exSets += 1;
        exReps += reps;
        exTonnage += weight * reps;
        exBestWeight = Math.max(exBestWeight, weight);
        exBestReps = Math.max(exBestReps, reps);
        maxLoad = Math.max(maxLoad, weight);
        const rir = num((st as any)?.rir);
        if (rir > 0) { exRirSum += rir; exRirN += 1; }
        const rpe = num((st as any)?.rpe);
        if (rpe > 0) { exRpeSum += rpe; exRpeN += 1; }
        if (weight > 0 && reps > 0) {
          const e1 = epley1RM(weight, reps);
          if (e1 > exBestE1RM) exBestE1RM = e1;
          const prev = bestBefore.get(name) || 0;
          if (e1 > prev + 0.01) {
            sPRs += 1;
            prs.push({
              exercise: name, weight, reps,
              e1rm: Math.round(e1),
              date,
              deltaPct: prev > 0 ? Math.round(((e1 - prev) / prev) * 1000) / 10 : null,
            });
            bestBefore.set(name, e1);
          }
        }
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
      };
      prev.sets += exSets;
      prev.reps += exReps;
      prev.tonnageKg += exTonnage;
      prev.bestWeight = Math.max(prev.bestWeight, exBestWeight);
      prev.bestReps = Math.max(prev.bestReps, exBestReps);
      prev.bestE1RM = Math.max(prev.bestE1RM, exBestE1RM);
      prev.rirSum += exRirSum; prev.rirN += exRirN;
      prev.rpeSum += exRpeSum; prev.rpeN += exRpeN;
      prev.sessions.add(w.id || date);
      exMap.set(key, prev);

      const mPrev = muscleAgg.get(meta.muscle) || { sets: 0, reps: 0, tonnageKg: 0, ex: new Set<string>() };
      mPrev.sets += exSets; mPrev.reps += exReps; mPrev.tonnageKg += exTonnage; mPrev.ex.add(name);
      muscleAgg.set(meta.muscle, mPrev);

      const pPrev = patternAgg.get(meta.pattern) || { sets: 0, reps: 0, tonnageKg: 0 };
      pPrev.sets += exSets; pPrev.reps += exReps; pPrev.tonnageKg += exTonnage;
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

    const wk = weekRangeFor(date);
    if (wk.from) {
      const wPrev = weekAgg.get(wk.from) || { label: wk.label, sessions: 0, sets: 0, tonnageKg: 0 };
      wPrev.sessions += 1; wPrev.sets += sSets; wPrev.tonnageKg += sTonnage;
      weekAgg.set(wk.from, wPrev);
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
      avgRepsPerSet: e.sets > 0 ? Math.round((e.reps / e.sets) * 10) / 10 : 0,
      avgRIR: e.rirN > 0 ? Math.round((e.rirSum / e.rirN) * 10) / 10 : null,
      avgRPE: e.rpeN > 0 ? Math.round((e.rpeSum / e.rpeN) * 10) / 10 : null,
      sharePct: totalTonnage > 0 ? Math.round((e.tonnageKg / totalTonnage) * 1000) / 10 : 0,
      sessions: e.sessions.size,
    }))
    .sort((a, b) => b.tonnageKg - a.tonnageKg || b.sets - a.sets);

  const musclesOut: SummaryMuscle[] = Array.from(muscleAgg.entries())
    .map(([muscle, v]) => ({
      muscle,
      label: MUSCLE_LABELS[muscle],
      color: MUSCLE_COLORS[muscle],
      sets: v.sets,
      reps: v.reps,
      tonnageKg: Math.round(v.tonnageKg),
      exercises: v.ex.size,
      sharePct: totalTonnage > 0 ? Math.round((v.tonnageKg / totalTonnage) * 1000) / 10 : 0,
      setsPerSession: sessions > 0 ? Math.round((v.sets / sessions) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.tonnageKg - a.tonnageKg || b.sets - a.sets);

  const patternsOut: SummaryPattern[] = Array.from(patternAgg.entries())
    .map(([pattern, v]) => ({
      pattern,
      label: PATTERN_LABELS[pattern] || PATTERN_LABELS.other,
      sets: v.sets,
      reps: v.reps,
      tonnageKg: Math.round(v.tonnageKg),
      sharePct: totalTonnage > 0 ? Math.round((v.tonnageKg / totalTonnage) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sets - a.sets || b.tonnageKg - a.tonnageKg);

  const weeksOut: SummaryWeek[] = Array.from(weekAgg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({ ...v, tonnageKg: Math.round(v.tonnageKg) }));

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
      prs: prs.length,
      trainingDays: days.size,
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
