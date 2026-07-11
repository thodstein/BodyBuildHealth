import { getExercisesByGroup, EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { calcExercisePrescription } from './training.engine';
import { prescribeExercises, forceVector, lengthenedPartials } from './pro/exercise-prescription.engine';
import { generateRepTempo } from './rep-tempo-engine';
import { selectExercisesSmart } from './exercise-selector.engine';

/** Множители веса для PRO-мышц (деривация от родительской группы).
 *  Источник: Israetel M., "Hypertrophy Training Guide", RP Strength, 2021.
 *  delt_front — получает нагрузку от жимов (OHP/bench), изолированно ~50% от shoulders.
 *  delt_mid — самая упорная дельта, изолированно ~45% от shoulders.
 *  delt_rear — задняя дельта, ~35% от shoulders.
 *  traps — шраги/тяги, ~55% от back (или 45% от deadlift workMax).
 *  forearms — хват/сгибания, ~40% от arms.
 */
const PRO_WORKMAX_RATIO: Record<string, number> = {
  delt_front: 0.50, delt_mid: 0.45, delt_rear: 0.35,
  traps: 0.55, forearms: 0.40,
};

/** Множитель веса для изоляционных упражнений.
 *  Изоляции используют ~55-60% от workMax группы (жим стоя 80 → махи 44, а не 74). */
const ISO_WEIGHT_FACTOR = 0.55;

/**
 * Вычислить workMax для упражнения с учётом:
 *  1. PRO_WORKMAX_RATIO (трапеции, предплечья)
 *  2. ISO_WEIGHT_FACTOR для изоляций
 *  3. Fallback: workMax[group] или 80 кг
 */
function resolveWorkMax(
  ex: Exercise | any,
  group: string,
  workMax: Record<string, number>,
  manualWorkMax: Record<string, number>,
): number {
  const base = workMax[group] || manualWorkMax[group] || 80;

  // PRO-группы: взять от родителя
  if (PRO_WORKMAX_RATIO[group]) {
    const parent = group === 'traps' ? 'back' : group === 'forearms' ? 'arms' : group.startsWith('delt_') ? 'shoulders' : group;
    return Math.round((workMax[parent] || 80) * PRO_WORKMAX_RATIO[group]);
  }

  // Изоляции: сниженный вес
  if (ex.type === 'isolation') return Math.round(base * ISO_WEIGHT_FACTOR);

  return base;
}

export type PlanEx = { 
  name: string; 
  sets: number; 
  reps: string; 
  rir: number; 
  rest: number; 
  group: string; 
  weight: number; 
  role: 'main' | 'secondary' | 'accessory';
  pattern: string;
  tempo?: string; 
  forceVec?: string; 
  jointStress?: string;
  technique?: string;
  comments?: string;
  rationale?: string;
  fatigueCost?: number;
  substitutions?: string[];
};
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
  targetTonnage?: Record<string, number>; // Целевой тоннаж по группам (кг/нед)
  currentReadiness: number; // 0-100
  sequenceStrategy: 'classic' | 'preexhaust' | 'antagonist';
  preferEquipment?: string[];
}

/**
 * buildPlanDays — чистое ядро генерации плана ручного конструктора.
 * ПРОФ-версия: максимально полный план с учётом цели, уровня, оборудования,
 * слабых групп, MRV. Выдаёт 10-16 упражнений/день, 3-6 упражнений/группу,
 * сеты по зоне адаптации, а не по минимуму.
 *
 * Возвращает дни, недельные сеты по группам и список правок-комментариев.
 */
export function buildPlanDays(input: BuildPlanInput): { days: PlanDay[]; weeklySets: Record<string, number>; groupCorrections: string[]; patternBalance: Record<string, number> } {
  const { cycle, mrv, goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir, currentReadiness = 100, targetTonnage, sequenceStrategy = 'classic', preferEquipment: prefEqOverride } = input;

  // Фазово-зависимое предпочтение оборудования (если не задано явно)
  const preferEquipment = prefEqOverride ?? (
    goal === 'strength' || goal === 'powerlifting' ? ['barbell'] :
    goal === 'mass' || goal === 'bulk' ? ['dumbbell', 'cable', 'machine'] :
    goal === 'cut' ? ['machine', 'cable'] :
    undefined
  );
  const weeklySets: Record<string, number> = {};
  const patternBalance: Record<string, number> = {};
  // dailyMrv — дневной аллоуэшн MRV с учётом частоты группы в цикле
  const freqMap: Record<string, number> = {};
  cycle.forEach(d => d.forEach(g => { freqMap[g] = (freqMap[g] || 0) + 1; }));
  const dailyMrv = (g: string) => {
    const f = freqMap[g] || 1;
    return Math.max(13, Math.ceil(mrv / f));
  };
  const groupCorrections: string[] = [];
  const isWeak = (g: string) => weakPoints.includes(g);
  const today = new Date().toISOString().slice(0, 10);

  const levelVolMap: Record<string, number> = { beginner: 0.9, intermediate: 1.0, advanced: 1.15, enhanced: 1.3 };
  const goalVolMap: Record<string, number> = { mass: 1.1, bulk: 1.1, strength: 1.0, cut: 0.85, maintenance: 0.9, recomp: 1.0 };
  const volMult = (levelVolMap[level] ?? 1.0) * (goalVolMap[goal] ?? 1.0);

  const dailyCap = Math.max(10, Math.min(16, Math.round(8 + groupsInDay(cycle) * 2)));

  const days = cycle.map((groups, di) => {
    const exs: PlanEx[] = [];
    const levelBoost = (level === 'advanced' || level === 'enhanced') ? 1 : 0;
    const daySets: Record<string, number> = {};
    
    // S-MRV: Системный бюджет утомления на день.
    // Формула: dailyCap × S_MRV_FACTOR × (readiness/100)
    // dailyCap = max(10, min(16, 8 + groups × 2)) — см. строку 68
    // S_MRV_FACTOR = 4 (см. engines/rir-table.ts)
    let dayFatigueBudget = dailyCap * 4 * (currentReadiness / 100); 

    groups.forEach(g => {
      const injActive = injuries.some(inj => inj.muscle === g && (inj.from || '') <= today && (!inj.to || inj.to >= today));
      if (injActive) return;

      const allPool = getExercisesByGroup(g);
      const eqFilter = (e: any) => equipment.length === 0 || equipment.includes(e.equipment);
      const pool = allPool.filter(eqFilter);
      let poolFinal = pool;
      if (equipment.length > 0) {
        if (pool.length === 0) { poolFinal = allPool; groupCorrections.push(`Группа «${g}»: нет упражнений по выбранному оборудованию — взят полный каталог.`); }
        else if (pool.length < allPool.length) groupCorrections.push(`Группа «${g}»: исключено ${allPool.length - pool.length} упражнений без оборудования.`);
      }

      const alreadyChosen = exs.map(e => e.name);
      const selectedIds = alreadyChosen.map(name => EXERCISE_CATALOG.find(ex => ex.name === name)?.id).filter(Boolean) as string[];
      const injuryProfile = injuries.map(i => i.muscle);
      const weakZonesList = isWeak(g) ? [g] : [];
      const isPrimaryGroup = groups.indexOf(g) === 0;
      const compoundCount = isPrimaryGroup ? 3 + (isWeak(g) ? 1 : 0) : 2 + (isWeak(g) ? 1 : 0);

      const compounds = selectExercisesSmart({
        candidates: poolFinal, muscleGroup: g,
        count: Math.min(compoundCount, poolFinal.length),
        selectedIds, equipment, weakZones: weakZonesList, level, injuryProfile, type: 'compound',
        preferEquipment,
      });
      const compsSafe = compounds.length === 0 ? poolFinal.slice(0, Math.min(compoundCount, poolFinal.length)) : compounds;

       for (const ex of compsSafe) {
         const ds = daySets[g] || 0;
         const remainingDaily = Math.max(0, dailyMrv(g) - ds);
         if (remainingDaily < 3) break;
         if (dayFatigueBudget < (ex.fatigueCost || 5)) break;
 
         const pr = calcExercisePrescription(ex, goal, level, isWeak(g), false, volMult, 1, mesoLength);
          const wm = resolveWorkMax(ex, g, workMax, manualWorkMax);
          const pct = pctForRir[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          let weight = Math.round(wm * pct);
          
           let sets = pr.sets;
          if (targetTonnage && targetTonnage[g]) {
            const repVal = pr.reps.includes('-') ? (parseInt(pr.reps) + parseInt(pr.reps.split('-')[1]))/2 : parseInt(pr.reps);
            const totalWeightPerSet = weight * repVal;
            if (totalWeightPerSet > 0) {
              const reqWeeklySets = targetTonnage[g] / totalWeightPerSet;
              const reqSetsPerSession = Math.round(reqWeeklySets / (freqMap[g] || 1));
              const MAX_SETS_PER_SESSION = 12;
              if (reqSetsPerSession > MAX_SETS_PER_SESSION) {
                groupCorrections.push(`Группа «${g}»: целевой тоннаж ${targetTonnage[g]} кг/нед даёт ${reqSetsPerSession} сетов/сессию — ограничено до ${MAX_SETS_PER_SESSION}.`);
              }
              sets = Math.max(3, Math.min(pr.sets + 2, reqSetsPerSession, MAX_SETS_PER_SESSION));
            }
          }

          const tGoal = goal === 'mass' || goal === 'bulk' ? 'hypertrophy' : goal === 'strength_mass' ? 'strength' : goal;
          const tempoRes = generateRepTempo({ goal: tGoal as any, riskLevel: level === 'beginner' ? 'high' : level === 'advanced' ? 'low' : 'medium', difficultyLevel: level === 'beginner' ? 'low' : level === 'advanced' ? 'high' : 'medium', techniqueIssues: [], isMainLift: true });
          const cappedSets = Math.min(sets, remainingDaily);
          if (cappedSets < 3) break;
 
          exs.push({
            name: ex.name, sets: cappedSets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: g, weight,
            role: isPrimaryGroup ? 'main' : 'secondary',
            pattern: ex.movementPattern || 'unknown',
            tempo: tempoRes.tempo.toString,
            forceVec: forceVector(ex.group, ex.type, ex.name),
            jointStress: ex.jointStress,
            technique: (ex as any).technique,
            comments: (ex as any).comments,
            rationale: (ex as any).selectionRationale?.join('; '),
            fatigueCost: (ex as any).fatigueCost,
            substitutions: (ex as any).canReplace?.map((id: string) => EXERCISE_CATALOG.find(e => e.id === id)?.name).filter(Boolean),
          });
          weeklySets[g] = (weeklySets[g] || 0) + cappedSets;
          daySets[g] = ds + cappedSets;
          dayFatigueBudget -= (ex.fatigueCost || 5) * cappedSets;
          patternBalance[ex.movementPattern || 'unknown'] = (patternBalance[ex.movementPattern || 'unknown'] || 0) + 1;
        }

    });

    groups.forEach(g => {
      const injActive = injuries.some(inj => inj.muscle === g && (inj.from || '') <= today && (!inj.to || inj.to >= today));
      if (injActive) return;
      const allPool = getExercisesByGroup(g);
      const eqFilter = (e: any) => equipment.length === 0 || equipment.includes(e.equipment);
      const pool = allPool.filter(eqFilter);
      let poolFinal = pool;
      if (equipment.length > 0 && pool.length === 0) poolFinal = allPool;

      const alreadyChosen = exs.map(e => e.name);
      const selectedIds = alreadyChosen.map(name => EXERCISE_CATALOG.find(ex => ex.name === name)?.id).filter(Boolean) as string[];
      const injuryProfile = injuries.map(i => i.muscle);
      const weakZonesList = isWeak(g) ? [g] : [];
      const isPrimaryGroup = groups.indexOf(g) === 0;
      const isoCount = isPrimaryGroup ? 2 + levelBoost + (isWeak(g) ? 1 : 0) : 2 + (level === 'advanced' || level === 'enhanced' ? (isWeak(g) ? 2 : 1) : 0);
      const isolations = selectExercisesSmart({
        candidates: poolFinal, muscleGroup: g,
        count: Math.min(isoCount, poolFinal.length),
        selectedIds, equipment, weakZones: weakZonesList, level, injuryProfile, type: 'isolation',
        preferEquipment,
      });
      const isosSafe = isolations.length === 0 ? poolFinal.filter(e => e.type === 'isolation').slice(0, Math.min(isoCount, poolFinal.length)) : isolations;

       for (const ex of isosSafe) {
         const ds = daySets[g] || 0;
         const remainingDaily = Math.max(0, dailyMrv(g) - ds);
         if (remainingDaily < 3) break;
         if (dayFatigueBudget < (ex.fatigueCost || 3)) break;
 
          const pr = calcExercisePrescription(ex, goal, level, isWeak(g), false, volMult * 0.85, 1, mesoLength);
          const wm = resolveWorkMax(ex, g, workMax, manualWorkMax);
          const pct = pctForRir[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          const weight = Math.round(wm * pct);

          let sets = pr.sets;
          if (targetTonnage && targetTonnage[g]) {
            const repVal = pr.reps.includes('-') ? (parseInt(pr.reps) + parseInt(pr.reps.split('-')[1]))/2 : parseInt(pr.reps);
            const totalWeightPerSet = weight * repVal;
            if (totalWeightPerSet > 0) {
              const reqWeeklySets = targetTonnage[g] / totalWeightPerSet;
              const reqSetsPerSession = Math.round(reqWeeklySets / (freqMap[g] || 1));
              const MAX_SETS_PER_SESSION = 12;
              if (reqSetsPerSession > MAX_SETS_PER_SESSION) {
                groupCorrections.push(`Группа «${g}»: целевой тоннаж ${targetTonnage[g]} кг/нед даёт ${reqSetsPerSession} сетов/сессию — ограничено до ${MAX_SETS_PER_SESSION}.`);
              }
              sets = Math.max(3, Math.min(pr.sets + 2, reqSetsPerSession, MAX_SETS_PER_SESSION));
            }
          }

          const tGoal = goal === 'mass' || goal === 'bulk' ? 'hypertrophy' : goal;
          const tempoRes = generateRepTempo({ goal: tGoal as any, riskLevel: level === 'beginner' ? 'high' : 'medium', difficultyLevel: level === 'beginner' ? 'low' : 'medium', techniqueIssues: [], isMainLift: false });
         const cappedSets = Math.min(sets, remainingDaily);
         if (cappedSets < 3) break;
 
          exs.push({
            name: ex.name, sets: cappedSets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: g, weight,
            role: 'accessory',
            pattern: ex.movementPattern || 'unknown',
            tempo: tempoRes.tempo.toString,
            forceVec: forceVector(ex.group, ex.type, ex.name),
            jointStress: ex.jointStress,
            technique: (ex as any).technique,
            comments: (ex as any).comments,
            rationale: (ex as any).selectionRationale?.join('; '),
            fatigueCost: (ex as any).fatigueCost,
            substitutions: (ex as any).canReplace?.map((id: string) => EXERCISE_CATALOG.find(e => e.id === id)?.name).filter(Boolean),
          });
          weeklySets[g] = (weeklySets[g] || 0) + cappedSets;
          daySets[g] = ds + cappedSets;
          dayFatigueBudget -= (ex.fatigueCost || 3) * cappedSets;
          patternBalance[ex.movementPattern || 'unknown'] = (patternBalance[ex.movementPattern || 'unknown'] || 0) + 1;
        }

    });


    // Оптимизация порядка: базовые по убыванию утомления, изоляции по возрастанию
    exs.sort((a, b) => {
      const roleOrder: Record<string, number> = { main: 0, secondary: 1, accessory: 2 };
      const ra = roleOrder[a.role] ?? 2;
      const rb = roleOrder[b.role] ?? 2;
      if (ra !== rb) return ra - rb;
      const fa = a.jointStress === 'high' ? 10 : a.jointStress === 'med' ? 5 : 0;
      const fb = b.jointStress === 'high' ? 10 : b.jointStress === 'med' ? 5 : 0;
      return a.role === 'accessory' ? fa - fb : fb - fa;
    });

    // Применение стратегии последовательности (Sequence Strategy)
    if (sequenceStrategy === 'preexhaust') {
       exs.sort((a, b) => (a.role === 'accessory' ? -1 : 1));
    } else if (sequenceStrategy === 'antagonist') {
       // Упрощенное чередование: База1, База2, Изо1, Изо2...
       const mainLifts = exs.filter(e => e.role !== 'accessory');
       const accessories = exs.filter(e => e.role === 'accessory');
       const reordered: PlanEx[] = [];
       const maxLen = Math.max(mainLifts.length, accessories.length);
       for(let i=0; i<maxLen; i++) {
         if(mainLifts[i]) reordered.push(mainLifts[i]);
         if(accessories[i]) reordered.push(accessories[i]);
       }
       exs.splice(0, exs.length, ...reordered);
    }

    if (exs.length > dailyCap) {
      const excess = exs.length - dailyCap;
      const trimmed: PlanEx[] = [];
      for (const ex of exs) {
        if (trimmed.length >= dailyCap) break;
        trimmed.push(ex);
      }
      groupCorrections.push(`День ${di + 1}: ограничено до ${dailyCap} упражнений (убрано ${excess} избыточных изоляций).`);
      return { day: di + 1, groups, exercises: trimmed };
    }

    return { day: di + 1, groups, exercises: exs };
  });

  // Проверка баланса тяни/толкай
  const pushPatterns = new Set(['horizontal_push', 'vertical_push', 'incline_push', 'decline_push', 'dip_push', 'vertical_push' as any]);
  const pullPatterns = new Set(['horizontal_pull', 'vertical_pull', 'hinge', 'hip_hinge' as any]);
  let pushCount = 0, pullCount = 0;
  for (const [pat, cnt] of Object.entries(patternBalance)) {
    if (pushPatterns.has(pat)) pushCount += cnt;
    else if (pullPatterns.has(pat)) pullCount += cnt;
  }
  if (pushCount > pullCount * 1.5 && pullCount > 0) {
    groupCorrections.push(`⚠ Баланс: толкающих ${pushCount} > тянущих ${pullCount} (дисбаланс ${Math.round(pushCount/pullCount*100)}% — риск плечевых травм). Добавьте тяг.`);
  }
  if (pullCount > pushCount * 1.8 && pushCount > 0) {
    groupCorrections.push(`⚠ Баланс: тянущих ${pullCount} > толкающих ${pushCount}. Допустимо, но проверьте объём грудных/дельт.`);
  }

  // Гардрейл: минимум 1 compound на группу
  const allGroups = new Set(cycle.flat());
  const compoundsByGroup = new Map<string, number>();
  for (const d of days) {
    for (const ex of d.exercises) {
      if (ex.role !== 'accessory') {
        compoundsByGroup.set(ex.group, (compoundsByGroup.get(ex.group) || 0) + 1);
      }
    }
  }
  for (const g of allGroups) {
    if (!compoundsByGroup.has(g)) {
      groupCorrections.push(`⚠ Группа «${g}»: нет базовых упражнений — добавьте компаунд (бюджет утомления исчерпан?).`);
    }
  }

  return { days, weeklySets, groupCorrections, patternBalance };
}

/** Общее количество групп (для расчёта дневного лимита) */
function groupsInDay(cycle: string[][]): number {
  let max = 0;
  for (const grp of cycle) if (grp.length > max) max = grp.length;
  return max;
}