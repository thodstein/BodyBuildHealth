/**
 * hybrid-plan.engine.ts — powerbuilder (сила + масса): ПЛ-цикл (faithful,
 * immutable) + ББ-аксессуары (гипертрофийная добивка мышц-антагонистов
 * после тяжёлого основного движения). Силовая прогрессия цикла не меняется.
 */
import { buildLMSPlan, type LMSBuildOutput, type LMSPlanWeek, type LMSPlanDay } from '../lms/lms-builder.engine';
import { getCycleById } from '../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { selectExercisesSmart } from '../exercise-selector.engine';
import { orderSessionExercises } from './bb-session-order.engine';
import { isInappropriateBB, bbExerciseTier } from './bb-exercise-tier.engine';
import { trueMuscleOf } from '../movement-pattern';
import type { BBExercise, BBSet } from './bb-builder.engine';

export interface HybridDay {
  dayIdx: number;
  mainLift: 'squat' | 'bench' | 'deadlift' | 'other';
  heavy: LMSPlanDay;
  accessories: BBExercise[];
}

export interface HybridPlan {
  cycle: SRCycleTemplate;
  heavyWeeks: LMSPlanWeek[];
  daysByWeek: HybridDay[][];
  rationale: string;
}

function detectMainLift(day: LMSPlanDay): 'squat' | 'bench' | 'deadlift' | 'other' {
  const exs = day.exercises || [];
  const heavy = exs.find(e => e.load === 'Тяжелая') || exs.reduce((a, b) => (b.coef > (a?.coef ?? 0) ? b : a), exs[0]);
  const n = (heavy?.name || '').toLowerCase();
  if (/присед|squat|фронт.*присед|back.?squat/.test(n)) return 'squat';
  if (/станов|deadlift|тяга.*сумо|классич.*тяга|rdl/.test(n)) return 'deadlift';
  if (/жим.*лёж|жим.*леж|bench|жим.*груд/.test(n)) return 'bench';
  return 'other';
}

function accessoryMusclesFor(lift: 'squat' | 'bench' | 'deadlift' | 'other'): { muscle: string; sets: number }[] {
  switch (lift) {
    case 'bench':   return [{ muscle: 'back', sets: 4 }, { muscle: 'shoulders', sets: 3 }, { muscle: 'biceps', sets: 3 }, { muscle: 'chest', sets: 2 }];
    case 'squat':   return [{ muscle: 'hamstrings', sets: 3 }, { muscle: 'calves', sets: 3 }, { muscle: 'abs', sets: 2 }];
    case 'deadlift':return [{ muscle: 'quads', sets: 3 }, { muscle: 'forearms', sets: 2 }, { muscle: 'abs', sets: 2 }];
    default:        return [{ muscle: 'back', sets: 3 }, { muscle: 'chest', sets: 2 }, { muscle: 'shoulders', sets: 2 }, { muscle: 'biceps', sets: 2 }, { muscle: 'triceps', sets: 2 }];
  }
}

function buildAccessories(lift: 'squat' | 'bench' | 'deadlift' | 'other', workMax: Record<string, number>, level: string, equipment: string[]): BBExercise[] {
  const muscles = accessoryMusclesFor(lift);
  const out: BBExercise[] = [];
  const seenNames = new Set<string>();
  for (const { muscle, sets } of muscles) {
    const pool = EXERCISE_CATALOG.filter((ex: any) => {
      const tm = trueMuscleOf(ex);
      if (tm === null || tm !== muscle) return false;
      if (isInappropriateBB(ex)) return false;
      if (bbExerciseTier(ex) === 3 && level !== 'advanced' && level !== 'enhanced') return false;
      if (seenNames.has(ex.name)) return false;
      if (equipment.length > 0) {
        const rawEq = ex.equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        if (exEq.length > 0 && !exEq.some(eq => equipment.includes(eq))) return false;
      }
      return true;
    });
    if (pool.length === 0) continue;
    const sel = selectExercisesSmart({ candidates: pool, muscleGroup: muscle, count: 1, selectedIds: [], selectedNames: [...seenNames], equipment, level, type: 'any', preferBB: true });
    const chosen = sel[0] || pool[0];
    if (!chosen) continue;
    seenNames.add(chosen.name);
    const wm = workMax[muscle] || 60;
    const w = Math.round(wm * 0.65 * 10) / 10;
    const reps = 12, rir = 3;
    const workSets: BBSet[] = Array.from({ length: sets }, () => ({ reps, rir, weight: w, restSeconds: 75 }));
    out.push({
      muscle, name: chosen.name, role: 'accessory', character: 'памп',
      sets, repsRange: [10, 15], rir, workSets, exerciseName: chosen.name, restSeconds: 75,
      comment: `📌 Аксессуар (добивка): ${muscle}. ${sets}×${reps} @${w} кг RIR${rir}.`,
      warmupSets: [],
      rationale: `Гипертрофийная добивка для ${muscle} после ${lift}-дня (антагонист/синергист).`,
    });
  }
  return orderSessionExercises(out, { sessionTag: (lift === 'squat' || lift === 'deadlift') ? 'Legs' : 'Upper', methodology: 'compound_first' });
}

export function buildHybridPlan(input: {
  cycleId: string;
  pmMap: { squat?: number; bench?: number; dead?: number };
  weeks?: number;
  level?: string;
  equipment?: string[];
  workMax?: Record<string, number>;
}): HybridPlan | null {
  const cycle = getCycleById(input.cycleId);
  if (!cycle) return null;
  const workMax = input.workMax || {};
  const pmMap: Record<string, number> = {};
  if (input.pmMap.squat) { pmMap['Приседания'] = input.pmMap.squat; pmMap['Squat'] = input.pmMap.squat; pmMap['присед'] = input.pmMap.squat; }
  if (input.pmMap.bench) { pmMap['Жим лежа'] = input.pmMap.bench; pmMap['Bench'] = input.pmMap.bench; pmMap['жим'] = input.pmMap.bench; }
  if (input.pmMap.dead) { pmMap['Тяга'] = input.pmMap.dead; pmMap['Deadlift'] = input.pmMap.dead; pmMap['тяга'] = input.pmMap.dead; }
  const lms = buildLMSPlan({ template: cycle, pmMap, weeksOverride: input.weeks, fallbackPm: 100 });
  const level = input.level || 'intermediate';
  const equipment = input.equipment || [];
  const daysByWeek: HybridDay[][] = lms.weeks.map(w =>
    w.days.map((d, di) => ({ dayIdx: di, mainLift: detectMainLift(d), heavy: d, accessories: buildAccessories(detectMainLift(d), workMax, level, equipment) }))
  );
  return { cycle, heavyWeeks: lms.weeks, daysByWeek, rationale: `Powerbuilder: ПЛ-цикл «${cycle.meta.title}» (faithful, ${cycle.meta.sessionsPerWeek}д/нед, ${cycle.meta.weeks} нед) + ББ-аксессуары после каждого тяжёлого дня. Силовая прогрессия цикла не меняется.` };
}

export type { LMSBuildOutput, LMSPlanWeek, LMSPlanDay };