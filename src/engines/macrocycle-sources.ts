/**
 * macrocycle-sources.ts — Блок A: альтернативные источники макроцикла.
 *   buildMacroFromLMS      — из реальной раскладки СРЦ-цикла (LMS_CYCLES) с прогрессией PM.
 *   buildMacroFromTemplate — из шаблона фаз CYCLE_TEMPLATES (cycle.engine) + генерация дней.
 * Оба возвращают канонический MacrocyclePlan, совместимый с getCurrentWeekPlan / MacrocyclePanel.
 */
import type { SRCycleTemplate, SRExerciseSpec, SRSetSpec } from '../data/lms-cycles/lms-types';
import { EXERCISE_CATALOG } from '../core/exercise-catalog';
import {
  generateWeekDays,
  type MacrocyclePlan,
  type MesocyclePlan,
  type Microcycle,
  type TrainingDayPlan,
  type PlannedExercise,
  type MesocycleType,
} from './training-periodization.engine';
import {
  generateCyclePlanFromTemplate,
  type CycleTemplate,
  type CyclePlan,
} from './cycle.engine';
import { generateCycle, type CycleType, type CycleInput, type CycleOutput, type GoalType } from './cycle-periodization.engine';
import { generateConjugateProgram, type ConjugateMode } from './conjugate.engine';
import { generateMesocycleProgression, type MesocycleConfig, type MesoGoal } from './pro/mesocycle-progression.engine';
import { taperPlan, taperWeeksForFatigue, peakWeekAttempts, type AttemptStrategy, type Lift, type TaperPlan } from './pro/taper.engine';
import { detectMuscleGroup, coarsen } from './muscle-group';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const DEFAULT_WORKMAX: Record<string, number> = {
  chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, full: 80,
};

const GOAL_REPS: Record<string, [number, number]> = {
  bulk: [8, 12],
  cut: [10, 15],
  strength: [3, 6],
  maintenance: [8, 12],
  recomp: [6, 10],
  rehab: [12, 20],
};

const GOAL_REST: Record<string, number> = {
  bulk: 90,
  cut: 60,
  strength: 180,
  maintenance: 90,
  recomp: 90,
  rehab: 60,
};

const GOAL_COMPOUND_PRIORITY: Record<string, number> = {
  strength: 0.85,
  cut: 0.5,
  bulk: 0.35,
  recomp: 0.5,
  maintenance: 0.5,
  rehab: 0.3,
};

function detectGroup(name: string): string {
  return coarsen(detectMuscleGroup(name));
}

function isCompoundName(name: string): boolean {
  const n = name.toLowerCase();
  return /присед|squat|станов|deadlift|жим|bench|press|тяга|row|pull|наклон|выпад|lunge|dip|отжим|arm curl|shoulder press/.test(n);
}

function pctToRir(pct: number): number {
  if (pct >= 0.85) return 1;
  if (pct >= 0.75) return 2;
  if (pct >= 0.65) return 3;
  if (pct >= 0.55) return 4;
  return 5;
}

function pctToIntensity(pct: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (pct >= 0.8) return 'very_high';
  if (pct >= 0.7) return 'high';
  if (pct >= 0.6) return 'medium';
  return 'low';
}

function avgPctOf(exercises: PlannedExercise[]): number {
  const ws = exercises.filter(e => e.weight && e.weight > 0).map(e => e.weight as number);
  if (!ws.length) return 0.6;
  return ws.reduce((s, w) => s + w, 0) / ws.length;
}

function groupMesocycles(micros: Microcycle[]): MesocyclePlan[] {
  const out: MesocyclePlan[] = [];
  for (const m of micros) {
    const last = out[out.length - 1];
    if (last && last.type === m.mesocycleType) {
      last.weeks += 1;
      last.microcycles.push(m);
    } else {
      out.push({ type: m.mesocycleType, weeks: 1, weekStart: m.weekNumber, microcycles: [m] });
    }
  }
  return out;
}

export interface LmsBuildOptions {
  level: string;
  goal: string;
  workMax?: Record<string, number>;
  weeks?: number;
  daysPerWeek?: number;
}

export function buildMacroFromLMS(cycle: SRCycleTemplate, opts: LmsBuildOptions): MacrocyclePlan {
  const totalWeeks = Math.max(2, Math.min(24, opts.weeks || cycle.meta.weeks));
  const sessions = Math.max(2, Math.min(7, opts.daysPerWeek || cycle.meta.sessionsPerWeek || 3));
  const correction = cycle.meta.correctionPct || 0.005;
  const wm = { ...DEFAULT_WORKMAX, ...(opts.workMax || {}) };
  const week1 = cycle.week1 || [];
  const usedDays = week1.slice(0, sessions);

  const accEnd = Math.max(1, Math.floor(totalWeeks * 0.6));
  const intEnd = Math.max(accEnd + 1, Math.floor(totalWeeks * 0.85));

  const micros: Microcycle[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    const prog = Math.pow(1 + correction, w - 1);
    const mesoType: MesocycleType = w <= accEnd ? 'accumulation' : w <= intEnd ? 'intensification' : 'peaking';

    let rirSum = 0;
    let rirCount = 0;
    const days: TrainingDayPlan[] = usedDays.map((daySpec, di) => {
      const exercises: PlannedExercise[] = (daySpec.exercises || []).map((ex: SRExerciseSpec) => {
        const group = detectGroup(ex.name);
        const blocks: SRSetSpec[] = ex.sets && ex.sets.length ? ex.sets : [{ pct: 0.6, reps: 8, sets: 3 }];
        const totalSets = blocks.reduce((s, b) => s + (b.sets || 1), 0);
        const repsVals = blocks.map(b => b.reps || 8);
        const repsStr = repsVals.length > 1 ? (Math.min(...repsVals) + '-' + Math.max(...repsVals)) : String(repsVals[0]);
        const maxPct = Math.max(...blocks.map(b => b.pct || 0.6));
        const baseWm = (wm[group] || wm.full || 80);
        const weight = Math.round(baseWm * maxPct * prog);
        const rir = pctToRir(maxPct);
        rirSum += rir;
        rirCount += 1;
        const exCat = EXERCISE_CATALOG.find(ec => ec.name === ex.name);
        return {
          exerciseId: exCat ? exCat.id : '',
          name: ex.name,
          group,
          sets: totalSets,
          reps: repsStr,
          rir,
          rpe: 10 - rir,
          weight,
          restSeconds: isCompoundName(ex.name) ? 180 : 90,
          isCompound: isCompoundName(ex.name),
          targetMuscle: exCat ? exCat.targetMuscle : undefined,
          substitutionGroup: exCat ? exCat.substitutionGroup : undefined,
          canReplace: exCat ? exCat.canReplace : undefined,
          cannotReplace: exCat ? exCat.cannotReplace : undefined,
          comments: ex.load ? ('Нагрузка: ' + ex.load) : '',
        } as PlannedExercise;
      });

      const avgPct = avgPctOf(exercises);
      const intensity = pctToIntensity(avgPct);
      const duration = Math.max(20, Math.round(exercises.length * 5));
      return {
        day: DAY_NAMES[di % 7],
        isTraining: true,
        split: (cycle.meta.title + ' — День ' + (di + 1)),
        exercises,
        duration,
        intensity,
      } as TrainingDayPlan;
    });

    while (days.length < 7) {
      days.push({
        day: DAY_NAMES[days.length % 7],
        isTraining: false,
        split: 'Отдых',
        exercises: [],
        duration: 0,
        intensity: 'low',
      });
    }

    const avgRir = rirCount ? Math.round(rirSum / rirCount) : 3;
    micros.push({
      weekNumber: w,
      mesocycleType: mesoType,
      isDeload: false,
      days,
      volumeMultiplier: 1.0,
      rirRange: [avgRir, Math.min(5, avgRir + 1)] as [number, number],
      rpeTarget: 10 - avgRir,
      notes: (cycle.meta.title + ': неделя ' + w + '/' + totalWeeks + ' (PM ×' + prog.toFixed(3) + ')'),
    });
  }

  return {
    id: 'lms_' + cycle.meta.id + '_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}

export interface TemplateBuildOptions {
  goal: string;
  level: string;
  weeks: number;
  recovery: number;
  daysPerWeek: number;
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
}

export function buildMacroFromTemplate(template: CycleTemplate, opts: TemplateBuildOptions): MacrocyclePlan {
  const plan: CyclePlan = generateCyclePlanFromTemplate(template, opts.weeks, opts.goal, opts.level, opts.recovery);
  return cyclePlanToMacrocycle(plan, template, opts);
}

function cyclePlanToMacrocycle(plan: CyclePlan, template: CycleTemplate, opts: TemplateBuildOptions): MacrocyclePlan {
  const repsRange = GOAL_REPS[opts.goal] || [8, 12];
  const restSeconds = GOAL_REST[opts.goal] || 90;
  const compoundPriority = GOAL_COMPOUND_PRIORITY[opts.goal] != null ? GOAL_COMPOUND_PRIORITY[opts.goal] : 0.5;

  const micros: Microcycle[] = plan.weekPlans.map(wp => {
    const mesoType: MesocycleType =
      wp.phase === 'deload' ? 'deload' :
      wp.phase === 'peak' ? 'peaking' :
      (wp.phase === 'transmutation' || wp.phase === 'intensification') ? 'intensification' :
      'accumulation';
    const rir = Math.max(0, Math.round(wp.rirBase));
    const days = generateWeekDays(
      opts.daysPerWeek,
      opts.goal,
      opts.level,
      wp.volumeMultiplier,
      rir,
      10 - rir,
      repsRange,
      restSeconds,
      wp.isDeload,
      opts.weakPoints,
      opts.injuries as any,
      compoundPriority
    );
    return {
      weekNumber: wp.week,
      mesocycleType: mesoType,
      isDeload: wp.isDeload,
      days,
      volumeMultiplier: wp.volumeMultiplier,
      rirRange: [rir, Math.min(5, rir + 1)] as [number, number],
      rpeTarget: 10 - rir,
      notes: (template.name + ': фаза ' + wp.phase + ', нед ' + wp.week + ', V×' + wp.volumeMultiplier.toFixed(2) + ' I×' + wp.intensityMultiplier.toFixed(2)),
    } as Microcycle;
  });

  return {
    id: 'tpl_' + plan.templateId + '_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks: plan.totalWeeks,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}
// Блок B: цикл по конкретному типу (13 CycleType из cycle-periodization.engine)
const UI_GOAL_TO_CYCLE_GOAL: Record<string, GoalType> = {
  bulk: 'hypertrophy',
  cut: 'conditioning',
  strength: 'strength',
  maintenance: 'hypertrophy',
  recomp: 'hypertrophy',
  rehab: 'rehab',
};

export interface CycleTypeBuildOptions {
  cycleType: CycleType;
  goal: string;
  level: string;
  weeks: number;
  recovery: number;
  fatigue: number;
  daysPerWeek: number;
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
}

export function buildMacroFromCycleType(opts: CycleTypeBuildOptions): MacrocyclePlan {
  const riskLevel: 'low' | 'medium' | 'high' = opts.fatigue >= 7 ? 'high' : opts.fatigue >= 4 ? 'medium' : 'low';
  const cInput: CycleInput = {
    weeks: opts.weeks,
    goal: UI_GOAL_TO_CYCLE_GOAL[opts.goal] || 'hypertrophy',
    weakPoints: opts.weakPoints,
    riskLevel,
    fatigueLevel: opts.fatigue * 10,
  };
  const out: CycleOutput = generateCycle(opts.cycleType, cInput);
  const repsRange = GOAL_REPS[opts.goal] || [8, 12];
  const restSeconds = GOAL_REST[opts.goal] || 90;
  const compoundPriority = GOAL_COMPOUND_PRIORITY[opts.goal] != null ? GOAL_COMPOUND_PRIORITY[opts.goal] : 0.5;

  const micros: Microcycle[] = out.weeks.map((wk, idx) => {
    const f = wk.focus;
    const mesoType: MesocycleType =
      f === 'deload' ? 'deload' :
      f === 'peaking' ? 'peaking' :
      (f === 'intensity' || f === 'strength') ? 'intensification' :
      'accumulation';
    const rir = Math.max(0, Math.round(10 - wk.rpeRange[0]));
    const isDeload = f === 'deload' || (out.deloadWeek === wk.weekIndex);
    const days = generateWeekDays(
      opts.daysPerWeek, opts.goal, opts.level, wk.volumeMultiplier,
      rir, wk.rpeRange[0], repsRange, restSeconds, isDeload,
      opts.weakPoints, opts.injuries as any, compoundPriority
    );
    return {
      weekNumber: idx + 1,
      mesocycleType: mesoType,
      isDeload,
      days,
      volumeMultiplier: wk.volumeMultiplier,
      rirRange: [rir, Math.min(5, rir + 1)] as [number, number],
      rpeTarget: wk.rpeRange[0],
      notes: out.name + ': ' + wk.notes,
    } as Microcycle;
  });

  return {
    id: 'ct_' + opts.cycleType + '_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks: out.totalWeeks,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}

// Блок B: сопряжённая (conjugate) периодизация — generateConjugateWeek
export interface ConjugateBuildOptions {
  goal: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  workMax?: Record<string, number>;
}

export function buildMacroFromConjugate(opts: ConjugateBuildOptions): MacrocyclePlan {
  const totalWeeks = Math.max(2, Math.min(24, opts.weeks));
  const wm = { ...DEFAULT_WORKMAX, ...(opts.workMax || {}) };
  const lifts: Array<'squat' | 'bench' | 'deadlift'> = ['squat', 'bench', 'deadlift'];
  const program = generateConjugateProgram({ upper: 'bench', lower: 'squat' }, 'powerlifting' as ConjugateMode, [], 'none', totalWeeks);
  const micros: Microcycle[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const mainLift = lifts[(w - 1) % 3];
    const weekData = program.weeks[w - 1];
    const rirBase = w <= Math.floor(totalWeeks * 0.7) ? 2 : w <= Math.floor(totalWeeks * 0.9) ? 1 : 0;
    const isDeload = w === totalWeeks && totalWeeks >= 8;
    const mesoType: MesocycleType = w <= Math.floor(totalWeeks * 0.6) ? 'accumulation' : w <= Math.floor(totalWeeks * 0.85) ? 'intensification' : 'peaking';
    const days: TrainingDayPlan[] = weekData.days.slice(0, Math.min(weekData.days.length, opts.daysPerWeek)).map((d: { exercises: any[]; name: any }, di: number) => {
      const exercises: PlannedExercise[] = d.exercises.map((ex: { name: string; intensity: number; sets: any; reps: any; rir: any; type: string; focus: any }) => {
        const group = detectGroup(ex.name);
        const baseWm = (wm[group] || wm.full || 80);
        const weight = Math.round(baseWm * (ex.intensity || 0.6));
        return {
          exerciseId: '',
          name: ex.name,
          group,
          sets: ex.sets,
          reps: String(ex.reps),
          rir: ex.rir,
          rpe: 10 - ex.rir,
          weight,
          restSeconds: ex.type === 'main' ? 180 : ex.type === 'supplemental' ? 120 : 90,
          isCompound: ex.type === 'main',
          comments: ex.focus,
        } as PlannedExercise;
      });
      const intensity = di === 0 ? 'very_high' : di === 2 ? 'high' : 'medium';
      return {
        day: DAY_NAMES[di % 7],
        isTraining: true,
        split: d.name,
        exercises,
        duration: Math.max(30, Math.round(exercises.length * 5)),
        intensity: intensity as 'low' | 'medium' | 'high' | 'very_high',
      } as TrainingDayPlan;
    });
    while (days.length < 7) {
      days.push({ day: DAY_NAMES[days.length % 7], isTraining: false, split: 'Отдых', exercises: [], duration: 0, intensity: 'low' });
    }
    micros.push({
      weekNumber: w,
      mesocycleType: isDeload ? 'deload' : mesoType,
      isDeload,
      days,
      volumeMultiplier: isDeload ? 0.5 : 1.0,
      rirRange: [rirBase, Math.min(5, rirBase + 1)] as [number, number],
      rpeTarget: 10 - rirBase,
      notes: 'Conjugate: ME ' + mainLift + ' (блок ' + ((w - 1) % 8) + '), неделя ' + w + '/' + totalWeeks,
    });
  }
  return {
    id: 'conjugate_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}

// Блок C: PRO кривые мезоцикла (mesocycle-progression.engine)
export interface MesocycleProgressionBuildOptions {
  goal: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
  startVolumeSets: number;
  startIntensityPct: number;
  startRIR: number;
  mesoGoal: MesoGoal;
  fatigueTrajectory?: number[];
}

export function buildMacroFromMesocycleProgression(opts: MesocycleProgressionBuildOptions): MacrocyclePlan {
  const cfg: MesocycleConfig = {
    weeks: opts.weeks,
    startVolumeSets: opts.startVolumeSets,
    startIntensityPct: opts.startIntensityPct,
    startRIR: opts.startRIR,
    goal: opts.mesoGoal,
    fatigueTrajectory: opts.fatigueTrajectory,
  };
  const weeks = generateMesocycleProgression(cfg);
  const repsRange = GOAL_REPS[opts.goal] || [8, 12];
  const restSeconds = GOAL_REST[opts.goal] || 90;
  const compoundPriority = GOAL_COMPOUND_PRIORITY[opts.goal] != null ? GOAL_COMPOUND_PRIORITY[opts.goal] : 0.5;

  const micros: Microcycle[] = weeks.map(wp => {
    const mesoType: MesocycleType =
      wp.phase === 'deload' ? 'deload' :
      wp.phase === 'peak' ? 'peaking' :
      wp.phase === 'build' ? 'intensification' :
      'accumulation';
    const rir = Math.max(0, wp.rir);
    const days = generateWeekDays(
      opts.daysPerWeek, opts.goal, opts.level, wp.volumeMultiplier,
      rir, 10 - rir, repsRange, restSeconds, wp.phase === 'deload',
      opts.weakPoints, opts.injuries as any, compoundPriority
    );
    return {
      weekNumber: wp.week,
      mesocycleType: mesoType,
      isDeload: wp.phase === 'deload',
      days,
      volumeMultiplier: wp.volumeMultiplier,
      rirRange: [rir, Math.min(5, rir + 1)] as [number, number],
      rpeTarget: 10 - rir,
      notes: wp.rationale + ' | I×' + wp.intensityPct.toFixed(2) + ' V_sets=' + wp.volumeSets + (wp.fatigueAdjusted ? ' (уст→−10%)' : ''),
    } as Microcycle;
  });

  return {
    id: 'mesopro_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks: weeks.length,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}

// Блок E: соревновательный режим / taper (pro/taper.engine)
const LIFT_TO_GROUP: Record<Lift, string> = { squat: 'legs', bench: 'chest', deadlift: 'back' };

export interface CompetitionBuildOptions {
  goal: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
  workMax: Record<string, number>;
  meetDate: string;
  current1RM: Record<Lift, number>;
  fatigue: number;
  strategy: AttemptStrategy;
}

export function buildMacroFromCompetition(opts: CompetitionBuildOptions): MacrocyclePlan {
  const wm = { ...DEFAULT_WORKMAX, ...opts.workMax };
  const taperWeeks = taperWeeksForFatigue(opts.fatigue);
  const tp: TaperPlan = taperPlan(opts.meetDate, opts.current1RM, opts.fatigue, opts.strategy);
  const prepWeeks = Math.max(0, opts.weeks - taperWeeks);
  const micros: Microcycle[] = [];

  // Подготовительные недели (peaking-кривая: объём ↓, RIR ↓ к старту)
  for (let w = 1; w <= prepWeeks; w++) {
    const prog = prepWeeks > 1 ? (w - 1) / (prepWeeks - 1) : 1;
    const volMult = 0.95 - 0.25 * prog;
    const rir = Math.max(0, Math.round(3 - 3 * prog));
    const mesoType: MesocycleType = prog < 0.5 ? 'intensification' : 'peaking';
    const days = generateWeekDays(opts.daysPerWeek, 'strength', opts.level, volMult, rir, 10 - rir, [3, 6], 180, false, opts.weakPoints, opts.injuries as any, 0.85);
    micros.push({
      weekNumber: w,
      mesocycleType: mesoType,
      isDeload: false,
      days,
      volumeMultiplier: volMult,
      rirRange: [rir, Math.min(5, rir + 1)] as [number, number],
      rpeTarget: 10 - rir,
      notes: 'Подготовка к соревнованиям: нед ' + w + '/' + prepWeeks + ', V×' + volMult.toFixed(2) + ', RIR ' + rir,
    });
  }

  // Taper-недели из taperPlan
  tp.weeks.forEach((wk, idx) => {
    const w = prepWeeks + idx + 1;
    const isLast = idx === tp.weeks.length - 1;
    const twVol = isLast ? 0.45 : 0.6;
    const days: TrainingDayPlan[] = wk.sessions.slice(0, Math.min(wk.sessions.length, opts.daysPerWeek)).map((s, di) => {
      const exercises: PlannedExercise[] = s.exercises.map(ex => {
        const group = LIFT_TO_GROUP[ex.lift] || 'legs';
        const baseWm = (wm[group] || wm.full || 80);
        const weight = Math.round(baseWm * ex.percent);
        const rir = pctToRir(ex.percent);
        return {
          exerciseId: '',
          name: ex.lift + ' @' + Math.round(ex.percent * 100) + '% ×' + ex.reps + ' ×' + ex.sets,
          group,
          sets: ex.sets,
          reps: String(ex.reps),
          rir,
          rpe: 10 - rir,
          weight,
          restSeconds: 180,
          isCompound: true,
          comments: ex.note + ' (до старта ' + s.daysUntilMeet + ' дн)',
        } as PlannedExercise;
      });
      const intensity = di === 0 ? 'very_high' : 'high';
      return {
        day: DAY_NAMES[di % 7],
        isTraining: true,
        split: s.focus,
        exercises,
        duration: Math.max(30, Math.round(exercises.length * 6)),
        intensity: intensity as 'low' | 'medium' | 'high' | 'very_high',
      } as TrainingDayPlan;
    });
    while (days.length < 7) {
      days.push({ day: DAY_NAMES[days.length % 7], isTraining: false, split: 'Отдых', exercises: [], duration: 0, intensity: 'low' });
    }
    const rir = isLast ? 0 : 1;
    micros.push({
      weekNumber: w,
      mesocycleType: 'peaking',
      isDeload: isLast,
      days,
      volumeMultiplier: twVol,
      rirRange: [rir, Math.min(5, rir + 1)] as [number, number],
      rpeTarget: 10 - rir,
      notes: 'Taper нед ' + (idx + 1) + '/' + taperWeeks + ': ' + (isLast ? 'ПИК-НЕДЕЛЯ / СТАРТ' : 'удержание интенсивности, объём ↓'),
    });
  });

  // Прикиды соревновательного дня (как инфо в notes последнего микро)
  const att = peakWeekAttempts(opts.current1RM, opts.strategy);
  const attNote = 'ПРИКИДЫ: присед ' + att.squat.opener + '/' + att.squat.second + '/' + att.squat.third + ' (' + att.squat.rpeNote + ') · жим ' + att.bench.opener + '/' + att.bench.second + '/' + att.bench.third + ' · тяга ' + att.deadlift.opener + '/' + att.deadlift.second + '/' + att.deadlift.third + ' · стратегия ' + opts.strategy;
  if (micros.length) micros[micros.length - 1].notes += ' | ' + attNote;

  return {
    id: 'comp_' + Date.now(),
    goal: opts.goal,
    level: opts.level as MacrocyclePlan['level'],
    totalWeeks: micros.length || taperWeeks,
    mesocycles: groupMesocycles(micros),
    currentWeek: 1,
  };
}
