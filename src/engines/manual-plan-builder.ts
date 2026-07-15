import { getExercisesByGroup, EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { calcExercisePrescription } from './training.engine';
import { prescribeExercises, forceVector, lengthenedPartials } from './pro/exercise-prescription.engine';
import { tempoFor } from './bb/bb-tempo-rest';
import { selectExercisesSmart } from './exercise-selector.engine';
import { S_MRV_FACTOR } from './rir-table';
import { findSubstitutions } from './exercise-substitution.engine';
import { isBodyweightExercise, isCarryExercise, derivePattern } from './movement-pattern';
import { getVolumeLandmarks } from './volume-landmarks.engine';

export { derivePattern };

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

/** Маппинг PRO-мышц в group каталога для getExercisesByGroup().
 *  Каталог (exercise-catalog.ts) содержит только 6 групп
 *  (legs/back/arms/chest/shoulders/core), тогда как cycle/weakPoints
 *  могут нести PRO-ключи (delt_front/mid/rear, traps, forearms, quads...).
 *  Без этого пул упражнений для PRO-ключа был бы пустым → день без упражнений. */
const PRO_MUSCLE_TO_GROUP: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  traps: 'back', calves: 'legs', glutes: 'legs', abs: 'core', forearms: 'arms',
  quads: 'legs', hamstrings: 'legs', biceps: 'arms', triceps: 'arms',
  chest: 'chest', back: 'back', shoulders: 'shoulders', legs: 'legs',
  arms: 'arms', core: 'core',
};
function catalogGroupFor(muscle: string): string {
  return PRO_MUSCLE_TO_GROUP[muscle] || muscle;
}

/** Множитель веса для изоляционных упражнений.
 *  Изоляции используют ~55-60% от workMax группы (жим стоя 80 → махи 44, а не 74). */
const ISO_WEIGHT_FACTOR = 0.55;

/** Множитель снаряда: workMax указан для ШТАНГИ (barbell) как эталон.
 *  Гантели/машины/кроссоверы имеют иной переносимый вес.
 *  dumbbell — вес ОДНОЙ гантели (per-hand ≈ 0.47 × barbell 1RM). */
const IMPLEMENT_FACTOR: Record<string, number> = {
  barbell: 1.0,
  dumbbell: 0.47,
  kettlebell: 0.45,
  machine: 0.7,
  cable: 0.7,
  'smith-machine': 0.95,
  band: 0.6,
  'weighted-bodyweight': 1.0,
  bodyweight: 0.0,
};

/** Базовое имя без уточнений в скобках — для дедупа near-dup (EZ-гриф vs обычный). */
function baseName(n: string): string {
  return (n || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function implementFactor(ex: any): number {
  const eq = ex.equipment;
  const eqArr = Array.isArray(eq) ? eq : (eq ? [String(eq)] : []);
  for (const e of eqArr) if (IMPLEMENT_FACTOR[e] !== undefined) return IMPLEMENT_FACTOR[e];
  return 1.0;
}

/** Ограничить верх реп-диапазона (травма/возраст), сохранив форму «a-b». */
function clampRepsRange(range: string, cap: number): string {
  if (!range.includes('-')) { const n = parseInt(range); return `${Math.min(n || 0, cap)}`; }
  const [a, b] = range.split('-').map(s => parseInt(s));
  return `${a}-${Math.min(b || a, cap)}`;
}

/**
 * Вычислить workMax для упражнения с учётом:
 *  1. PRO_WORKMAX_RATIO (трапеции, предплечья)
 *  2. IMPLEMENT_FACTOR (гантели/машины — per-hand для гантелей)
 *  3. ISO_WEIGHT_FACTOR для изоляций
 *  4. Собственный вес / загруженные прогулки → 0 (без фейковых kg, выводятся как BW/дистанция)
 *  5. Fallback: workMax[group] или 80 кг
 */
function resolveWorkMax(
  ex: Exercise | any,
  group: string,
  workMax: Record<string, number>,
  manualWorkMax: Record<string, number>,
): number {
  // Собственный вес / прогулки — без kg
  if (isBodyweightExercise(ex) || isCarryExercise(ex)) return 0;

  let base = workMax[group] || manualWorkMax[group] || 80;

  // PRO-группы: взять от родителя
  if (PRO_WORKMAX_RATIO[group]) {
    const parent = group === 'traps' ? 'back' : group === 'forearms' ? 'arms' : group.startsWith('delt_') ? 'shoulders' : group;
    base = (workMax[parent] || 80) * PRO_WORKMAX_RATIO[group];
  }

  let w = base * implementFactor(ex);
  if (ex.type === 'isolation') w *= ISO_WEIGHT_FACTOR;
  return Math.round(Math.max(0, w));
}

export type PlanEx = { 
  name: string; 
  sets: number; 
  reps: string; 
  rir: number; 
  rest: number; 
  group: string; 
  weight: number; 
  weightNote?: string; 
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
export interface Injury { muscle: string; from: string; to?: string; weightPct?: number; volumePct?: number; repsCap?: number; exclude?: boolean }

/** Рассчитать коэффициент объёма для травмы с учётом постинсультной реабилитации.
 *  Если дата `to` прошла — объём растёт 50%→75%→100% за 3 недели после `to`.
 *  Если травма активна — возвращается volumePct (или 0.6 по умолчанию).
 */
export function getInjuryVolumeFactor(inj: Injury, today: string): number {
  if (inj.to && inj.to < today) {
    const weeksPast = Math.max(0, Math.floor((new Date(today).getTime() - new Date(inj.to).getTime()) / (7 * 86400000)));
    if (weeksPast >= 3) return 1.0;
    if (weeksPast >= 1) return 0.75;
    return 0.5;
  }
  return inj.volumePct ?? (inj.exclude ? 0 : 0.6);
}

/** Получить список активных травм на сегодня с градацией. */
export function getActiveInjuries(injuries: Injury[], today: string): Injury[] {
  return injuries.filter(inj =>
    (!inj.from || inj.from <= today) &&
    (!inj.to || inj.to > today)  // active = to ещё не прошло или не указано
  );
}

/** Получить список мышц, которые нужно полностью исключить (exclude=true или без градации). */
export function getExcludedMuscles(injuries: Injury[], today: string): Set<string> {
  return new Set(
    injuries
      .filter(inj => (!inj.from || inj.from <= today) && (!inj.to || inj.to >= today))
      .filter(inj => inj.exclude !== false) // default true for backward compat
      .map(inj => inj.muscle)
  );
}

/** Травмированные мышцы, которые можно нагружать с градацией (exclude=false + gradation fields). */
export function getGradedInjuries(injuries: Injury[], today: string): Injury[] {
  return injuries
    .filter(inj => (!inj.from || inj.from <= today) && (!inj.to || inj.to >= today))
    .filter(inj => inj.exclude === false);
}
export interface BuildPlanInput {
  cycle: string[][];
  mrv: number;
  mrvOverride?: number | null; // Глобальный оверрайд MRV (плоский) — масштабирует per-muscle ландмарки
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
  workMaxOverride?: Record<string, number>; // Полный per-group workMax (ПМ), переопределяет workMax/manualWorkMax
  currentReadiness: number; // 0-100
  sequenceStrategy: 'classic' | 'preexhaust' | 'antagonist';
  preferEquipment?: string[];
  courseIntensity?: 'none' | 'mild' | 'moderate' | 'heavy'; // ААС-интенсивность для ПЕД-коррекции объёма
  addDeloadWeek?: boolean; // Добавить финальную разгрузочную неделю (объём −50%, RIR 3)
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
  const { cycle, mrv, mrvOverride, goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir, currentReadiness = 100, targetTonnage, sequenceStrategy = 'classic', preferEquipment: prefEqOverride, courseIntensity, workMaxOverride } = input;

  // Полный per-group workMax: override (ПМ из калькулятора) > workMax > manualWorkMax
  const workMaxFull = { ...workMax, ...manualWorkMax, ...(workMaxOverride || {}) };

  // Фазово-зависимое предпочтение оборудования (если не задано явно)
  const preferEquipment = prefEqOverride ?? (
    goal === 'strength' || goal === 'powerlifting' ? ['barbell'] :
    goal === 'mass' || goal === 'bulk' ? ['dumbbell', 'cable', 'machine'] :
    goal === 'cut' ? ['machine', 'cable'] :
    undefined
  );
  const weeklySets: Record<string, number> = {};
  const patternBalance: Record<string, number> = {};
  // weeklyMrvOf — недельный объём конкретной группы из volume-landmarks.engine
  // (per-group: chest/back/legs/shoulders/arms/core; композиты arms=bi+tri, legs=qu+ha).
  // P1.2: слабые группы получают MRV (приоритет), остальные — MAV (реаллокация объёма
  //   от сильных групп к слабым в пределах недельного бюджета). P1.3: жёсткий недельный
  //   кап — сумма сетов за все дни недели не превышает weeklyMrvOf(g).
  const weeklyMrvOf = (g: string): number => {
    const lm = getVolumeLandmarks(level, g);
    const levelBaseMrv = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 }[level] ?? 20;
    const mrvScale = mrvOverride != null && levelBaseMrv > 0 ? mrvOverride / levelBaseMrv : 1;
    const base = Math.round((lm?.mrv ?? mrv) * mrvScale);
    if (!isWeak(g)) {
      const mav = lm?.mav ?? Math.round(base * 0.8);
      return Math.min(mav, base);
    }
    return base;
  };
  // freqMap — частота группы в микроцикле (сколько дней в неделю тренируется)
  const freqMap: Record<string, number> = {};
  cycle.forEach(d => d.forEach(g => { freqMap[g] = (freqMap[g] || 0) + 1; }));
  // dailyMrv — дневной аллоуэшн: равномерное распределение недельного MRV по частоте,
  // без искусственного пола 13 (для 3×/нед группы MRV/3 ≈ 6-7 — корректно).
  const dailyMrv = (g: string) => {
    const f = freqMap[g] || 1;
    return Math.max(10, Math.min(16, Math.round(weeklyMrvOf(g) / f)));
  };
  const groupCorrections: string[] = [];
  const isWeak = (g: string) => weakPoints.includes(g);
  const today = new Date().toISOString().slice(0, 10);

  const levelVolMap: Record<string, number> = { beginner: 0.9, intermediate: 1.0, advanced: 1.15, enhanced: 1.3 };
  const goalVolMap: Record<string, number> = { mass: 1.1, bulk: 1.1, strength: 1.0, cut: 0.85, maintenance: 0.9, recomp: 1.0 };
  const volMult = (levelVolMap[level] ?? 1.0) * (goalVolMap[goal] ?? 1.0);
  // Цель для RIR-матрицы/диапазонов повторений: mass/bulk → hypertrophy
  const rxGoal = (g: string) => (g === 'mass' || g === 'bulk') ? 'hypertrophy' : g;

  // P1.1: аккумулятор выбранных id на ВСЮ неделю — исключает повтор одноимённого
  // упражнения в разных днях недели (день1 грудь и день2 грудь не должны давать
  // «Жим штанги» дважды). Внутри дня дедуп уже есть через exs.
  const weekSelectedIds: string[] = [];

  const dailyCap = Math.max(10, Math.min(16, Math.round(8 + groupsInDay(cycle) * 2)));

  const days = cycle.map((groups, di) => {
    const exs: PlanEx[] = [];
    const levelBoost = (level === 'advanced' || level === 'enhanced') ? 1 : 0;
    const daySets: Record<string, number> = {};
    
    // S-MRV: Системный бюджет утомления на день.
    // Формула: dailyCap × S_MRV_FACTOR × (readiness/100) × levelMult × pedMult
    const levelMult = levelVolMap[level] ?? 1.0;
    const pedMult = courseIntensity === 'heavy' ? 1.5 : courseIntensity === 'moderate' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.0;
    const totalFatigueBudget = Math.round(dailyCap * S_MRV_FACTOR * (currentReadiness / 100) * levelMult * pedMult);
    // 75% бюджета на compounds, 25% на isolations
    const compoundBudget = Math.floor(totalFatigueBudget * 0.75);
    const isoBudget = totalFatigueBudget - compoundBudget;

    // Распределяем compoundBudget пропорционально ожидаемым затратам групп
    const groupExpected: Record<string, number> = {};
    const groupCompoundBudget: Record<string, number> = {};
    let totalExpected = 0;
    for (const g of groups) {
      const isPrimary = groups.indexOf(g) === 0;
      const cc = isPrimary ? 3 + (isWeak(g) ? 1 : 0) : 2 + (isWeak(g) ? 1 : 0);
      const poolLen = getExercisesByGroup(catalogGroupFor(g)).filter(e => {
        if (equipment.length === 0) return true;
        const rawEq = (e as any).equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        return exEq.length === 0 || exEq.some((eq: string) => equipment.includes(eq));
      }).length;
      const cCount = Math.min(cc, poolLen);
      const maxSets = Math.max(4, Math.min(16, Math.ceil(mrv / (freqMap[g] || 1))));
      const expected = cCount * maxSets * 5;
      groupExpected[g] = expected;
      totalExpected += expected;
    }
    for (const g of groups) {
      groupCompoundBudget[g] = totalExpected > 0 ? Math.floor(compoundBudget * (groupExpected[g] / totalExpected)) : Math.floor(compoundBudget / groups.length);
    }
    let remainingCompoundFatigue = compoundBudget;

    const gradedInjuries = getGradedInjuries(injuries, today);
    const excludedMuscles = getExcludedMuscles(injuries, today);

    groups.forEach(g => {
      const isExcluded = excludedMuscles.has(g);
      if (isExcluded) return;
      const isGraded = gradedInjuries.some(inj => inj.muscle === g);
      const injuryFactor = gradedInjuries.find(inj => inj.muscle === g);

      // Для градированных травм: проверить постинсультный период восстановления
      const todayObj = new Date(today);
      const postInjuryVolPct = injuryFactor ? getInjuryVolumeFactor(injuryFactor, today) : 1.0;
      const postInjuryWtPct = injuryFactor?.weightPct ?? 1.0;

      const allPool = getExercisesByGroup(catalogGroupFor(g));
      const eqFilter = (e: any) => equipment.length === 0 || equipment.includes(e.equipment);
      const pool = allPool.filter(eqFilter);
      let poolFinal = pool;
      if (equipment.length > 0) {
        if (pool.length === 0) { poolFinal = allPool; groupCorrections.push(`Группа «${g}»: нет упражнений по выбранному оборудованию — взят полный каталог.`); }
        else if (pool.length < allPool.length) groupCorrections.push(`Группа «${g}»: исключено ${allPool.length - pool.length} упражнений без оборудования.`);
      }

      const alreadyChosen = exs.map(e => e.name);
      const selectedIds = Array.from(new Set([...alreadyChosen.map(name => EXERCISE_CATALOG.find(ex => ex.name === name)?.id).filter(Boolean), ...weekSelectedIds])) as string[];
      const injuryProfile = injuries.map(i => i.muscle);
      const weakZonesList = isWeak(g) ? [g] : [];
      const isPrimaryGroup = groups.indexOf(g) === 0;
      const compoundCount = isPrimaryGroup ? 3 + (isWeak(g) ? 1 : 0) : 2 + (isWeak(g) ? 1 : 0);

      const compounds = selectExercisesSmart({
        candidates: poolFinal, muscleGroup: g,
        count: Math.min(compoundCount, poolFinal.length),
        selectedIds, equipment, weakZones: weakZonesList, level, injuryProfile, type: 'compound',
        preferEquipment,
        preferBB: goal === 'mass' || goal === 'bulk' || goal === 'cut',
      });
      const compsSafe = compounds.length === 0 ? poolFinal.slice(0, Math.min(compoundCount, poolFinal.length)) : compounds;

      let groupFatigue = groupCompoundBudget[g] || Math.floor(remainingCompoundFatigue / (groups.length - groups.indexOf(g)));

        for (const ex of compsSafe) {
          const ds = daySets[g] || 0;
          const remainingDaily = Math.max(0, dailyMrv(g) - ds);
          if (remainingDaily < 3) break;
          // P1.3: недельный кап — сумма сетов группы за неделю ≤ MRV группы
          const remainingWeekly = Math.max(0, weeklyMrvOf(g) - (weeklySets[g] || 0));
          if (remainingWeekly < 3) break;
          if (groupFatigue < (ex.fatigueCost || 5)) break;

         // Подстановка для градированной травмы
         let exSub = ex;
         let exSets = Math.min(calcExercisePrescription(ex, goal, level, isWeak(g), false, volMult, 1, mesoLength).sets, 4);
         let exWeightMult = 1.0;
         let exVolMult = 1.0;

         if (isGraded) {
           const subs = findSubstitutions(ex.name, g, new Set([g]));
           if (subs.length > 0) {
             exSub = subs[0].exercise;
             exWeightMult = subs[0].weightPct;
             exVolMult = subs[0].volumePct;
             groupCorrections.push(`Группа «${g}» (травма): ${subs[0].confidence === 'high' ? '✔' : '⚠'} ${subs[0].reason}`);
             if (subs[0].exercise.name !== ex.name) {
               groupCorrections.push(`  → ${ex.name} заменён на ${subs[0].exercise.name}`);
             }
           }
           // Применить градацию травмы поверх замены
           exWeightMult *= postInjuryWtPct;
           exVolMult *= postInjuryVolPct;
         }

          const pr = calcExercisePrescription(exSub, rxGoal(goal), level, isWeak(g), false, volMult, 1, mesoLength);
          const wm = resolveWorkMax(exSub, g, workMaxFull, manualWorkMax);
          const pct = pctForRir[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
           let weight = Math.round(wm * pct * exWeightMult);
           const weightNote = isBodyweightExercise(exSub) ? 'BW' : (isCarryExercise(exSub) ? 'дистанция' : undefined);
          
           let sets = Math.max(1, Math.min(Math.round(exSets * exVolMult), 4));
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
              sets = Math.max(3, Math.min(pr.sets, reqSetsPerSession, MAX_SETS_PER_SESSION));
            }
          }

           const repsCap = injuryFactor?.repsCap ?? 15;
           const repsStr = clampRepsRange(pr.reps, repsCap);
           const tGoal = goal === 'mass' || goal === 'bulk' ? 'hypertrophy' : goal === 'strength_mass' ? 'strength' : goal;
           const cappedSets = Math.min(sets, remainingDaily);
          if (cappedSets < 1) break;

          const fatigueCost = (exSub.fatigueCost || 5) * (isGraded ? 0.75 : 1.0);
          const exFatigue = fatigueCost * cappedSets;
           if (exFatigue > groupFatigue) break;
           if (exs.some(e => baseName(e.name) === baseName(exSub.name))) continue;

            exs.push({
              name: exSub.name, sets: cappedSets, reps: isGraded ? clampRepsRange(pr.reps, Math.min(repsCap, 12)) : repsStr, rir: isGraded ? 3 : pr.rir, rest: pr.rest, group: g, weight, weightNote,
              role: isCarryExercise(exSub) ? 'accessory' : (isPrimaryGroup ? 'main' : 'secondary'),
               pattern: exSub.movementPattern || derivePattern(exSub),
                tempo: tempoFor(isPrimaryGroup ? 'тяж' : 'памп').notation,
               forceVec: forceVector(exSub.group, exSub.type, exSub.name),
               jointStress: exSub.jointStress,
              technique: (exSub as any).technique,
              comments: (exSub as any).comments,
              rationale: (exSub as any).selectionRationale?.join('; '),
              progressionNote: pr.progressionNote,
              fatigueCost: exSub.fatigueCost,
              substitutions: (exSub as any).canReplace?.map((id: string) => EXERCISE_CATALOG.find(e => e.id === id)?.name).filter(Boolean),
            });
           weekSelectedIds.push((exSub as any).id);
           weeklySets[g] = (weeklySets[g] || 0) + cappedSets;
          daySets[g] = ds + cappedSets;
          groupFatigue -= exFatigue;
          remainingCompoundFatigue -= exFatigue;
          patternBalance[exSub.movementPattern || derivePattern(exSub)] = (patternBalance[exSub.movementPattern || derivePattern(exSub)] || 0) + 1;
        }

    });

    // Isolation фаза: пропорциональный остаток isoBudget
    const groupIsoBudget: Record<string, number> = {};
    const groupIsoExpected: Record<string, number> = {};
    let totalIsoExpected = 0;
    for (const g of groups) {
      const isoCount = (groups.indexOf(g) === 0 ? 2 + levelBoost + (isWeak(g) ? 1 : 0) : 2 + (level === 'advanced' || level === 'enhanced' ? (isWeak(g) ? 2 : 1) : 0));
      const poolLen = getExercisesByGroup(catalogGroupFor(g)).filter(e => {
        if (e.type !== 'isolation') return false;
        if (equipment.length === 0) return true;
        const rawEq = (e as any).equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        return exEq.length === 0 || exEq.some((eq: string) => equipment.includes(eq));
      }).length;
      const iCount = Math.min(isoCount, poolLen);
      const expected = iCount * 3 * 3;
      groupIsoExpected[g] = expected;
      totalIsoExpected += expected;
    }
    for (const g of groups) {
      groupIsoBudget[g] = totalIsoExpected > 0 ? Math.floor(isoBudget * (groupIsoExpected[g] / totalIsoExpected)) : Math.floor(isoBudget / groups.length);
    }
    let remainingIsoFatigue = isoBudget;

    groups.forEach(g => {
      const isExcluded = excludedMuscles.has(g);
      if (isExcluded) return;
      const isGraded = gradedInjuries.some(inj => inj.muscle === g);
      const injuryFactor = gradedInjuries.find(inj => inj.muscle === g);
      const postInjuryVolPct = injuryFactor ? getInjuryVolumeFactor(injuryFactor, today) : 1.0;
      const postInjuryWtPct = injuryFactor?.weightPct ?? 1.0;

      const allPool = getExercisesByGroup(catalogGroupFor(g));
      const eqFilter = (e: any) => equipment.length === 0 || equipment.includes(e.equipment);
      const pool = allPool.filter(eqFilter);
      let poolFinal = pool;
      if (equipment.length > 0 && pool.length === 0) poolFinal = allPool;

      const alreadyChosen = exs.map(e => e.name);
      const selectedIds = Array.from(new Set([...alreadyChosen.map(name => EXERCISE_CATALOG.find(ex => ex.name === name)?.id).filter(Boolean), ...weekSelectedIds])) as string[];
      const injuryProfile = injuries.map(i => i.muscle);
      const weakZonesList = isWeak(g) ? [g] : [];
      const isPrimaryGroup = groups.indexOf(g) === 0;
      const isoCount = isPrimaryGroup ? 2 + levelBoost + (isWeak(g) ? 1 : 0) : 2 + (level === 'advanced' || level === 'enhanced' ? (isWeak(g) ? 2 : 1) : 0);
      const isolations = selectExercisesSmart({
        candidates: poolFinal, muscleGroup: g,
        count: Math.min(isoCount, poolFinal.length),
        selectedIds, equipment, weakZones: weakZonesList, level, injuryProfile, type: 'isolation',
        preferEquipment,
        preferBB: goal === 'mass' || goal === 'bulk' || goal === 'cut',
      });
      const isosSafe = isolations.length === 0 ? poolFinal.filter(e => e.type === 'isolation').slice(0, Math.min(isoCount, poolFinal.length)) : isolations;

      let groupIsoFatigue = groupIsoBudget[g] || Math.floor(remainingIsoFatigue / (groups.length - groups.indexOf(g)));

       for (const ex of isosSafe) {
          const ds = daySets[g] || 0;
          const remainingDaily = Math.max(0, dailyMrv(g) - ds);
          if (remainingDaily < 3) break;
          // P1.3: недельный кап — сумма сетов группы за неделю ≤ MRV группы
          const remainingWeekly = Math.max(0, weeklyMrvOf(g) - (weeklySets[g] || 0));
          if (remainingWeekly < 3) break;
          if (groupIsoFatigue < (ex.fatigueCost || 3)) break;

         // Подстановка для градированной травмы
          let exSub = ex;
          let exWeightMult = 1.0;
          let exVolMult = 1.0;
          weekSelectedIds.push((exSub as any).id);

         if (isGraded) {
           const subs = findSubstitutions(ex.name, g, new Set([g]));
           if (subs.length > 0) {
             exSub = subs[0].exercise;
             exWeightMult = subs[0].weightPct;
             exVolMult = subs[0].volumePct;
             if (subs[0].exercise.name !== ex.name && !groupCorrections.some(c => c.includes(subs[0].exercise.name))) {
               groupCorrections.push(`  → изоляция: ${ex.name} → ${subs[0].exercise.name}`);
             }
           }
           exWeightMult *= postInjuryWtPct;
           exVolMult *= postInjuryVolPct;
         }

          const pr = calcExercisePrescription(exSub, goal, level, isWeak(g), false, volMult * 0.85, 1, mesoLength);
          const wm = resolveWorkMax(exSub, g, workMaxFull, manualWorkMax);
          const pct = pctForRir[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
           const weight = Math.round(wm * pct * exWeightMult);
           const weightNote = isBodyweightExercise(exSub) ? 'BW' : (isCarryExercise(exSub) ? 'дистанция' : undefined);

          let sets = Math.max(1, Math.min(Math.round(pr.sets * exVolMult), 3));
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
              sets = Math.max(3, Math.min(pr.sets, reqSetsPerSession, MAX_SETS_PER_SESSION));
            }
          }

           const repsCap = injuryFactor?.repsCap ?? 15;
           const repsStr = clampRepsRange(pr.reps, repsCap);
           const tGoal = rxGoal(goal);
          const cappedSets = Math.min(sets, remainingDaily);
         if (cappedSets < 1) break;

          const fatigueCost = (exSub.fatigueCost || 3) * (isGraded ? 0.75 : 1.0);
          const exFatigue = fatigueCost * cappedSets;
           if (exFatigue > groupIsoFatigue) break;
           if (exs.some(e => baseName(e.name) === baseName(exSub.name))) continue;

            exs.push({
             name: exSub.name, sets: cappedSets, reps: isGraded ? clampRepsRange(pr.reps, Math.min(repsCap, 12)) : repsStr, rir: isGraded ? 3 : pr.rir, rest: pr.rest, group: g, weight, weightNote,
              role: 'accessory',
               pattern: exSub.movementPattern || derivePattern(exSub),
               tempo: tempoFor('памп').notation,
               forceVec: forceVector(exSub.group, exSub.type, exSub.name),
             jointStress: exSub.jointStress,
             technique: (exSub as any).technique,
             comments: (exSub as any).comments,
             rationale: (exSub as any).selectionRationale?.join('; '),
             progressionNote: pr.progressionNote,
             fatigueCost: exSub.fatigueCost,
             substitutions: (exSub as any).canReplace?.map((id: string) => EXERCISE_CATALOG.find(e => e.id === id)?.name).filter(Boolean),
           });
          weeklySets[g] = (weeklySets[g] || 0) + cappedSets;
          daySets[g] = ds + cappedSets;
          groupIsoFatigue -= exFatigue;
          remainingIsoFatigue -= exFatigue;
          patternBalance[exSub.movementPattern || derivePattern(exSub)] = (patternBalance[exSub.movementPattern || derivePattern(exSub)] || 0) + 1;
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

