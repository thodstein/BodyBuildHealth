import { getExercisesByGroup } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { calcExercisePrescription } from './training.engine';

export type PlanEx = { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number };
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
      const rank = (e: Exercise) => (e.type === 'compound' ? 100 : 0) + (e.equipment === 'barbell' ? 10 : e.equipment === 'dumbbell' ? 5 : 0) + (isWeak(g) ? 5 : 0);
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
        exs.push({ name: ex.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: g, weight });
        weeklySets[g] = already + pr.sets;
      }
      if (capped) groupCorrections.push(`Группа «${g}»: объём достиг MRV (${Math.round(mrv)}) — лишние упражнения убраны (анти-перетрен).`);
    });
    return { day: di + 1, groups, exercises: exs };
  });

  return { days, weeklySets, groupCorrections };
}