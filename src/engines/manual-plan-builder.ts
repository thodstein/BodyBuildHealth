import { getExercisesByGroup, EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { calcExercisePrescription } from './training.engine';
import { prescribeExercises, forceVector, lengthenedPartials } from './pro/exercise-prescription.engine';
import { generateRepTempo } from './rep-tempo-engine';

export type PlanEx = { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number; tempo?: string; forceVec?: string; jointStress?: string };
export type PlanDay = { day: number; groups: string[]; exercises: PlanEx[] };
export interface Injury { muscle: string; from: string; to?: string }
export interface BuildPlanInput {
  cycle: string[][];
  mrv: number;
  goal: string;
  level: string;
  mesoLength: number;
  weakPoints: string[];
  equipment: string[];
  workMax: Record<string, number>;
  manualWorkMax: Record<string, number>;
  injuries: Injury[];
  pctForRir: Record<number, number>;
}

/**
 * buildPlanDays — чистое ядро генерации плана ручного конструктора:
 * распределение групп по дням цикла, отбор упражнений (compound/isolation),
 * ограничение по MRV, расчёт весов workMax × %1RM(RIR), учёт травм и оборудования.
 * Возвращает дни, недельные сеты по группам и список правок-комментариев.
 */
export function buildPlanDays(input: BuildPlanInput): { days: PlanDay[]; weeklySets: Record<string, number>; groupCorrections: string[] } {
  const { cycle, mrv, goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir } = input;
  const weeklySets: Record<string, number> = {};
  const groupCorrections: string[] = [];
  const isWeak = (g: string) => weakPoints.includes(g);
  const today = new Date().toISOString().slice(0, 10);

  const days = cycle.map((groups, di) => {
    const exs: PlanEx[] = [];
    groups.forEach(g => {
      const injActive = injuries.some(inj => inj.muscle === g && (inj.from || '') <= today && (!inj.to || inj.to >= today));
      if (injActive) { groupCorrections.push(`🩹 Группа «${g}» пропущена по травме — упражнения не добавлены. При восстановлении верните группу.`); return; }
      const allPool = getExercisesByGroup(g);
      const eqFilter = (e: Exercise) => equipment.length === 0 || equipment.includes(e.equipment);
      const pool = allPool.filter(eqFilter);
      let poolFinal = pool;
      if (equipment.length > 0) {
        if (pool.length === 0) { poolFinal = allPool; groupCorrections.push(`Группа «${g}»: нет упражнений по выбранному оборудованию — взят полный каталог (без фильтра).`); }
        else if (pool.length < allPool.length) groupCorrections.push(`Группа «${g}»: исключено ${allPool.length - pool.length} упражнений без доступного оборудования.`);
      }
      // PRO: биомеханический скоринг через prescribeExercises
      const proRanked = prescribeExercises({ muscle: g, goal: goal as 'strength'|'hypertrophy'|'power', equipment, limit: 10 });
      const proIds = new Set(proRanked.map(r => r.id));
      const rank = (e: Exercise) => (e.type === 'compound' ? 100 : 0) + (e.equipment === 'barbell' ? 10 : e.equipment === 'dumbbell' ? 5 : 0) + (isWeak(g) ? 5 : 0) + (proIds.has(e.id) ? 20 : 0);
      const compounds = [...poolFinal].filter(e => e.type === 'compound').sort((a, b) => rank(b) - rank(a)).slice(0, 2);
      const isolations = [...poolFinal].filter(e => e.type === 'isolation').sort((a, b) => rank(b) - rank(a)).slice(0, 2);
      const chosen = [...compounds, ...isolations];
      let capped = false;
      for (const ex of chosen) {
        const already = weeklySets[g] || 0;
        if (already >= mrv) { capped = true; break; }
        const pr = calcExercisePrescription(ex, goal, level, isWeak(g), false, 1, 1, mesoLength);
        const wm = (workMax[g] || manualWorkMax[g] || 80);
        const pct = pctForRir[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
        const weight = Math.round(wm * pct);
        // PRO: biomechanical force-vector + tempo prescription
        const tGoal = goal === 'mass' ? 'hypertrophy' : goal === 'strength_mass' ? 'strength' : goal;
        const tempoRes = generateRepTempo({
          goal: tGoal as any,
          riskLevel: level === 'beginner' ? 'high' as const : level === 'advanced' ? 'low' as const : 'medium' as const,
          difficultyLevel: level === 'beginner' ? 'low' as const : level === 'advanced' ? 'high' as const : 'medium' as const,
          techniqueIssues: [],
          isMainLift: ex.type === 'compound',
        });
        exs.push({
          name: ex.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: g, weight,
          tempo: tempoRes.tempo.toString,
          forceVec: forceVector(ex.group, ex.type, ex.name),
          jointStress: ex.jointStress,
        });
        weeklySets[g] = already + pr.sets;
      }
      if (capped) groupCorrections.push(`Группа «${g}»: объём достиг MRV (${Math.round(mrv)}) — лишние упражнения убраны (анти-перетрен).`);
    });
    return { day: di + 1, groups, exercises: exs };
  });

  return { days, weeklySets, groupCorrections };
}