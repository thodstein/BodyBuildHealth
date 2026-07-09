import { getExercisesByGroup, EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { calcExercisePrescription } from './training.engine';
import { prescribeExercises, forceVector, lengthenedPartials } from './pro/exercise-prescription.engine';
import { generateRepTempo } from './rep-tempo-engine';
import { selectExercisesSmart } from './exercise-selector.engine';

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
      // PRO: интеллектуальный отбор (6 критериев: weakZones, углы, суставы, push/pull, паттерны, оборудование)
      const alreadyChosen = exs.map(e => e.name);
      const selectedIds = alreadyChosen.map(name => EXERCISE_CATALOG.find(ex => ex.name === name)?.id).filter(Boolean) as string[];
      const injuryProfile = injuries.map(i => i.muscle);
      const weakZonesList = isWeak(g) ? [g] : [];
      const isPrimaryGroup = groups.indexOf(g) === 0;
      const smartCompounds = selectExercisesSmart({
        candidates: poolFinal,
        muscleGroup: g,
        count: isPrimaryGroup ? 2 : 1,
        selectedIds,
        equipment,
        weakZones: weakZonesList,
        level,
        injuryProfile,
        type: 'compound',
      });
      const compoundIds = new Set(smartCompounds.map(e => e.id));
      const smartIsolations = selectExercisesSmart({
        candidates: poolFinal,
        muscleGroup: g,
        count: isPrimaryGroup ? 1 : 0,
        selectedIds: [...selectedIds, ...smartCompounds.map(e => e.id)],
        equipment,
        weakZones: weakZonesList,
        level,
        injuryProfile,
        type: 'isolation',
      });
      const chosen = [...smartCompounds, ...smartIsolations];
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
    // Hard cap: максимум 8 упражнений в тренировке
    const cappedExs = exs.slice(0, 8);
    if (exs.length > 8) groupCorrections.push(`День ${di + 1}: ограничено до 8 упражнений (было ${exs.length}).`);
    return { day: di + 1, groups, exercises: cappedExs };
  });

  return { days, weeklySets, groupCorrections };
}