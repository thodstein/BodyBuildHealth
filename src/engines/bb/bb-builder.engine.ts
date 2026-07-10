/**
 * bb-builder.engine.ts — генератор бодибилдинг-плана из раскладки ротации (Этап BB6).
 * Связывает: bb-split-patterns (расписание) + bb-day-types (тяж/памп/первичная-добивка) +
 * volume-landmarks (MEV/MAV/MRV) + rir-matrix (RIR-прогрессия по неделям).
 *
 * Логика:
 *  - MAV мышц берётся из volume-landmarks, масштабируется под длину ротации.
 *  - Каждая мышца в ротации: одна сессия = первичная (тяж, ~65% MAV), другие = добивка (памп, ~35%).
 *    Ноги (forceDayType) — всегда тяж; их «добивка» тоже тяж-лёг, не памп.
 *  - Сеты/репы/RIR по характеру: тяж 5-8/RIR1-2; памп 12-20/RIR3; лёг 10-15/RIR4.
 *  - Вес = workMax × %1RM(RIR, reps). Недели 2..N: RIR ↓ (rir-matrix) → вес ↑.
 */

import { SPLIT_PATTERNS, getPattern, sessionsOf, type SplitPattern, type ScheduleDay } from './bb-split-patterns';
import { FORCE_HEAVY_GROUPS, getPair, resolveCharacter, type DayCharacter, type MuscleSlot } from './bb-day-types';
import { getAllVolumeLandmarks, landmarksForRotation, normLevel, type TrainingLevel } from '../volume-landmarks.engine';
import { tempoFor, REST_BY_CHARACTER, type TempoSpec } from './bb-tempo-rest';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { selectExercisesSmart } from '../exercise-selector.engine';

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface BBBuilderInput {
  patternId: string;
  level: string;                 // beginner/intermediate/advanced/enhanced
  goal: BBGoal;
  weeks: number;                 // длительность мезоцикла
  workMax?: Record<string, number>; // рабочий максимум на мышцу/движение (кг)
  weakPoints?: string[];         // отстающие группы → MAV↑
  focusGroup?: string;           // группа специализации → MAV↑↑
  volumeGoal?: BBVolumeGoal;     // цель по объёму: MEV | MAV | MRV
  mode?: 'natural' | 'on_course' | 'pct';
}

export interface BBSet {
  reps: number;
  rir: number;
  weight: number;   // кг
  technique?: string;
  tempo?: string;       // PRO: нотация темпа (напр. "2-1-1-0")
  restSeconds?: number; // PRO: отдых между подходами
}

export interface BBExercise {
  muscle: string;
  name: string;         // Добавлено: конкретное упражнение из каталога
  role: 'primary' | 'accessory';
  character: DayCharacter;
  sets: number;
  repsRange: [number, number];
  rir: number;
  workSets: BBSet[];
  exerciseName?: string;
  tempoSpec?: string;       // PRO: нотация темпа из bb-tempo-rest
  restSeconds?: number;     // PRO: отдых между подходами
}

export interface BBSession {
  day: number;             // 1-based в ротации
  weekOffset: number;      // абсолютный день с учётом повторов ротации
  character: DayCharacter;
  sessionTag?: string;
  exercises: BBExercise[];
}

export interface BBWeek {
  week: number;
  sessions: BBSession[];
}

export interface BBPlan {
  pattern: SplitPattern;
  weeks: BBWeek[];
  rotationMuscleVolume: Record<string, number>; // MAV×ротация на мышцу
  rationale: string[];
}

// sessionTag -> мышцы (канонические EN-ключи)
const TAG_MUSCLES: Record<string, string[]> = {
  Push: ['chest', 'shoulders', 'triceps'],
  Pull: ['back', 'biceps', 'shoulders'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  Lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  FullBody: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms'],
};
function musclesForTag(tag?: string): string[] {
  if (!tag) return [];
  if (TAG_MUSCLES[tag]) return TAG_MUSCLES[tag];
  return [];
}

// %1RM по RIR (приближённо, для гипертрофийного диапазона 6-12 повт)
const PCT_FOR_RIR: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };

function charReps(c: DayCharacter): [number, number] {
  if (c === 'тяж') return [5, 8];
  if (c === 'памп') return [12, 20];
  return [10, 15];
}
function charRir(c: DayCharacter, week: number): number {
  if (c === 'лёг') return 4;
  const base = c === 'тяж' ? 2 : 3;
  return Math.max(0, base - Math.floor((week - 1) / 2));
}

function buildSession(
  sched: ScheduleDay, dayInRotation: number, week: number,
  muscleVolumeRotation: Record<string, number>,
  muscleSessionCount: Record<string, number>,   // сколько сессий в ротации тренируют мышцу
  musclePrimaryAssigned: Set<string>,            // мышцы, которым уже назначена primary в этой ротации
  workMax: Record<string, number>, weakPoints: string[], focusGroup?: string,
): BBSession {
  const character = sched.character as DayCharacter;
  const muscles = musclesForTag(sched.sessionTag);
  const exercises: BBExercise[] = [];
  
  // S-MRV: Дневной бюджет утомления (база 40-60 единиц)
  let dayFatigueBudget = 50;
  
  for (const muscle of muscles) {
    const resolved = resolveCharacter(muscle, character);
    
    // роль: primary если мышца ещё не имела primary в ротации И (это тяж-сессия ИЛИ forced-тяж)
    let role: 'primary' | 'accessory' = 'accessory';
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'тяж')) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }

    // объём на эту мышцу в эту сессию
    const mavRot = muscleVolumeRotation[muscle] || 0;
    const sessionsForMuscle = muscleSessionCount[muscle] || 1;
    
    let sets = Math.max(1, Math.round(mavRot * (role === 'primary' ? 0.65 : 0.35)));
    if (weakPoints.includes(muscle)) sets = Math.round(sets * 1.2);
    if (focusGroup === muscle) sets = Math.round(sets * 1.3);
    
    const [rmin, rmax] = charReps(resolved);
    const rir = charRir(resolved, week);
    const wm = workMax[muscle] || 80;
    const pct = PCT_FOR_RIR[rir] ?? 0.9;
    const reps = Math.round((rmin + rmax) / 2);
    const weight = Math.round(wm * pct * 10) / 10;
    
    // SMART SELECTION: Выбор конкретного упражнения из каталога
    const pool = getExercisesByGroup(muscle);
    const selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: 1,
      selectedIds: exercises.map(e => e.name).map(n => EXERCISE_CATALOG.find(ex => ex.name === n)?.id).filter(Boolean) as string[],
      equipment: [], weakZones: weakPoints, level: 'intermediate', injuryProfile: [], type: role === 'primary' ? 'compound' : 'isolation',
    });
    const exData = selected[0] || pool[0] || { name: muscle, fatigueCost: 5 };
    
    // Проверка S-MRV: если упражнение слишком тяжёлое для остатка бюджета
    const cost = (exData.fatigueCost || 5) * sets;
    if (dayFatigueBudget < cost) {
      // Пытаемся снизить объём, чтобы втиснуть
      sets = Math.floor(dayFatigueBudget / (exData.fatigueCost || 5));
      if (sets < 1) continue; // Пропускаем, если даже 1 сет не лезет
    }
    dayFatigueBudget -= (exData.fatigueCost || 5) * sets;

    const tempoSpec = tempoFor(resolved);
    const restSeconds = REST_BY_CHARACTER[resolved];
    const workSets: BBSet[] = Array.from({ length: sets }, () => ({
      reps, rir, weight,
      tempo: tempoSpec.notation,
      restSeconds,
    }));
    
    exercises.push({
      muscle, name: exData.name, role, character: resolved, sets, repsRange: [rmin, rmax], rir, workSets,
      exerciseName: exData.name,
      tempoSpec: tempoSpec.notation,
      restSeconds,
    });
  }
  return { day: dayInRotation, weekOffset: 0, character, sessionTag: sched.sessionTag, exercises };
}

export function buildBBPlan(input: BBBuilderInput): BBPlan {
  const pattern = getPattern(input.patternId) || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const workMax = input.workMax || {};
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  const sessions = sessionsOf(pattern);

  const muscleSessionCount: Record<string, number> = {};
  for (const s of sessions) for (const m of musclesForTag(s.sessionTag)) muscleSessionCount[m] = (muscleSessionCount[m] || 0) + 1;

  const muscleVolumeRotation: Record<string, number> = {};
  for (const m of Object.keys(muscleSessionCount)) {
    const lm = landmarksForRotation(level, m, pattern.rotationDays);
    if (lm) {
      let v = lm.mav;
      if (input.volumeGoal === 'mev') v = lm.mev;
      else if (input.volumeGoal === 'mrv') v = lm.mrv;
      if (input.goal === 'cut') v = Math.round(v * 0.9);
      if (input.goal === 'mass' || input.goal === 'strength_mass') v = Math.round(v * 1.1);
      muscleVolumeRotation[m] = v;
    }
  }

  const musclePrimaryAssigned = new Set<string>();
  const weeks: BBWeek[] = [];
  for (let w = 1; w <= input.weeks; w++) {
    const weekSessions: BBSession[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const sess = buildSession(s, i + 1, w, muscleVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      weekSessions.push(sess);
    }
    weeks.push({ week: w, sessions: weekSessions });
  }

  const rationale: string[] = [
    `Сплит «${pattern.name}» (${pattern.rotationDays}дн ротация, ${pattern.sessionsPerRotation} сессий)`,
    `Уровень ${level}, цель ${input.goal}, ${input.weeks} нед`,
    `Объём ${input.volumeGoal || 'MAV'}: ` + Object.entries(muscleVolumeRotation).map(([m, v]) => `${m}=${v}`).join(', '),
    `Специализация: ${focusGroup || 'нет'}`,
    `RIR-прогрессия: тяж 2→0, памп 3→2 к пику; вес = workMax×%1RM(RIR)`,
    `S-MRV: автоматический кап объёма на основе бюджета утомления сессии.`,
  ];

  return { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale };
}
