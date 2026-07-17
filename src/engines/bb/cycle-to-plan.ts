/**
 * cycle-to-plan.ts — конвертер SRCycleTemplate (BB-цикл) → BBPlan.
 *
 * Позволяет BbAutoConstructor и TrainingConstructor использовать
 * готовые ПРОФ-циклы с конкретными упражнениями вместо generic-генерации.
 */
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from './bb-builder.engine';
import { getBBVolumeLandmarks } from './bb-builder.engine';
import { PCT_FOR_RIR } from '../rir-table';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from './bb-ped-adaptation.engine';
import { getExcludedMuscles, getGradedInjuries, type Injury } from '../manual-plan-builder';
import { applyPostPhaseProcessing, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';

export type CycleSourceCycle = SRCycleTemplate;
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface CycleToPlanInput {
  cycle: SRCycleTemplate;
  workMax: Record<string, number>;
  weakPoints?: string[];
  peds?: PED[];
  /** Дозы PED (мг/нед, МЕ/день, мкг) — dose-aware адаптация MRV. */
  pedDoses?: Record<string, number>;
  /** Интенсивность курса — доп. MRV boost (mild/moderate/heavy). */
  courseIntensity?: CourseIntensity;
  loadStrategy?: LoadStrategy;
  autoRegVolumeMult?: number;
  autoRegRirShift?: number;
  injuries?: Injury[];
  /** Техника интенсивности (rest_pause/drop_set/myo_reps/pause_rep/mechanical_drop/none). */
  intensityTechnique?: IntensityTechnique;
  /** Авто-делод по ACWR. */
  autoDeload?: boolean;
  /** Тип делода (pump/neural/full_rest). */
  deloadType?: DeloadType;
  /** Результат авторегуляции (объём/вес/RIR shift). */
  autoRegResult?: { volumeMultiplier: number; topSetPctMultiplier: number; rirShift: number };
  /** Любимые упражнения (ID) — приоритет при замене. */
  favoriteExercises?: string[];
  /** Исключённые упражнения (ID) — замена на альтернативу. */
  excludedExercises?: string[];
  /** Убрать осевую нагрузку (присед/становая/жим стоя/гудморнинг). */
  avoidAxialLoad?: boolean;
  /** Цель по объёму: MEV (минимум) | MAV (оптимум) | MRV (максимум). */
  volumeGoal?: BBVolumeGoal;
  /** Режим специализации: топ-2 слабые на MAV+10%, остальные на MEV. */
  specialization?: boolean;
  /** Фокус-группа (акцент +30% объём). */
  focusGroup?: string;
  /** Уровень атлета (для volume-landmarks валидации). */
  level?: string;
}

function muscleGroupFromExName(exName: string, catalog: typeof EXERCISE_CATALOG): string {
  const found = catalog.find(e => e.name === exName);
  if (found?.group) {
    const mg = found.group.toLowerCase();
    const MAP: Record<string, string> = {
      chest: 'chest', back: 'back', shoulders: 'shoulders', legs: 'legs',
      quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves',
      biceps: 'biceps', triceps: 'triceps', abs: 'abs', core: 'core',
      forearms: 'forearms', traps: 'traps', neck: 'neck',
    };
    return MAP[mg] || mg;
  }
  // fallback by name keywords
  const l = exName.toLowerCase();
  // Плечи: махи, подъёмы перед собой / в стороны
  if (l.includes('махи') || l.includes('перед собой') || l.includes('в стороны') || l.includes('в сторону')) return 'shoulders';
  // Жимы на плечи
  if (l.includes('жим') && (l.includes('стоя') || l.includes('сидя') || l.includes('армей') || l.includes('швунг'))) return 'shoulders';
  // Грудь: жимы + разведения
  if (l.includes('жим') || l.includes('кроссовер') || l.includes('развод') || l.includes('сведен')) return 'chest';
  if (l.includes('пуловер')) return 'chest';
  // Спина: тяги + подтягивания
  if (l.includes('тяга') || l.includes('подтяг') || l.includes('шраг')) return 'back';
  if (l.includes('гиперэкстенз') || l.includes('наклон') && l.includes('штанг')) return 'back';
  // Ноги — квадрицепс
  if (l.includes('присед') || l.includes('выпад') || l.includes('фронт')) return 'quads';
  if (l.includes('разгиб') && !l.includes('трицепс') && !l.includes('француз')) return 'quads';
  // Ноги — бицепс бедра
  if (l.includes('румын') || l.includes('мёртв') || l.includes('мертв') || l.includes('становая')) return 'hamstrings';
  if (l.includes('сгибан') && !l.includes('бицепс') && !l.includes('молотк')) return 'hamstrings';
  // Икры
  if (l.includes('икры') || l.includes('подъем на носки') || l.includes('подъём на носки')) return 'calves';
  // Бицепс
  if (l.includes('бицепс') || l.includes('молотк')) return 'biceps';
  if (l.includes('сгиб') && l.includes('штанги') && !l.includes('ног')) return 'biceps';
  // Трицепс
  if (l.includes('трицепс') || l.includes('француз')) return 'triceps';
  if (l.includes('разгиб') && l.includes('блок') && !l.includes('ног')) return 'triceps';
  // Пресс
  if (l.includes('пресс') || l.includes('скручив') || l.includes('планк')) return 'abs';
  return 'chest';
}

function calcWorkMaxForEx(exName: string, workMax: Record<string, number>): number {
  const l = exName.toLowerCase();
  // Map exercise name to workMax key by catalog group
  const found = EXERCISE_CATALOG.find(e => e.name === exName);
  const muscle = found?.group ? muscleGroupFromExName(exName, EXERCISE_CATALOG) : 'chest';
  if (workMax[muscle]) return workMax[muscle];
  if (muscle === 'quads' && workMax['legs']) return workMax['legs'];
  if (muscle === 'hamstrings' && workMax['legs']) return Math.round(workMax['legs'] * 0.65);
  if (workMax['chest']) return workMax['chest'];
  return 80;
}

function createBBSet(pct: number, targetReps: number, rir: number, workMaxVal: number): BBSet {
  const basePct = PCT_FOR_RIR[rir] ?? 0.85;
  const adjustedPct = pct * (0.95 / basePct); // normalize: SR cycle pct is typically at rir 3, adjust for target rir
  const weight = Math.round(workMaxVal * Math.min(adjustedPct, 1.0) * 10) / 10;
  return { reps: targetReps, rir, weight, restSeconds: 90 };
}

function computeRirForEx(
  week: number, totalWeeks: number,
  rirProgression: { start: number; end: number } | undefined,
  phases: { weekStart: number; weekEnd: number; rirProgression?: { start: number; end: number } }[] | undefined,
): number {
  if (phases && phases.length > 0) {
    const activePhase = phases.find(p => week >= p.weekStart && week <= p.weekEnd);
    if (activePhase?.rirProgression) {
      const { start, end } = activePhase.rirProgression;
      const phaseLen = activePhase.weekEnd - activePhase.weekStart + 1;
      const weekInPhase = week - activePhase.weekStart + 1;
      const progress = phaseLen > 1 ? (weekInPhase - 1) / (phaseLen - 1) : 0;
      return Math.round(start + (end - start) * progress);
    }
  }
  if (rirProgression) {
    const { start, end } = rirProgression;
    const progress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;
    return Math.round(start + (end - start) * progress);
  }
  return 2;
}

function isPrimaryByLoad(load: string | undefined): boolean {
  return load === 'Тяжелая' || !load;
}

/**
 * BB-ФИЛЬТР: заменить ПЛ/олимпийские упражнения на ББ-альтернативы.
 * Становая тяга (классическая/сумо) — ПЛ движение, не для ББ гипертрофии.
 * Жим стоя/армейский/швунг — осевая, заменить на жим сидя.
 * Рывок/толчок/взятие — олимпийские, заменить или пропустить.
 *
 * @returns { name, group } — новое имя + группа, или null если упражнение пропускается
 */
function replacePLForBB(exName: string, group: string): { name: string; group: string } | null {
  const n = (exName || '').toLowerCase().trim();

  // Становая тяга → Тяга штанги в наклоне (если спина) или Румынская (если бицепс бедра)
  if (n === 'становая тяга' || n === 'становая тяга (классика)' || n === 'становая тяга сумо' || n === 'становая тяга классическая') {
    const g = (group || '').toLowerCase();
    if (g.includes('спин') || g === 'back') {
      return { name: 'Тяга штанги в наклоне', group: 'Спина' };
    }
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  // Жим стоя / армейский / OHP → Жим гантелей сидя (не осевая)
  if (n === 'жим стоя' || n === 'армейский жим' || n === 'жим над головой' || n === 'ohp'
      || n.includes('швунг') || n.includes('push press') || n.includes('жимовой швунг')) {
    return { name: 'Жим гантелей сидя', group: 'Плечи' };
  }
  // Олимпийские: рывок/толчок/взятие — пропустить (нет ББ-аналога в шаблоне)
  if (n.includes('рывок') || n.includes('толчок') || n.includes('взятие на грудь')
      || n.includes('подъём на грудь') || n.includes('подъем на грудь')
      || n.includes('power clean') || n.includes('hang clean') || n.includes('power snatch')
      || n.includes('clean pull') || n.includes('muscle snatch')) {
    return null;
  }
  // Пендл → Тяга штанги в наклоне
  if (n.includes('пендл') || n.includes('pendlay')) {
    return { name: 'Тяга штанги в наклоне', group: 'Спина' };
  }
  // Good morning → Румынская тяга
  if (n.includes('гудмор') || n.includes('good morning') || n.includes('наклоны со штангой')) {
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  // Rack pull / тяга с плинт → Тяга штанги в наклоне
  if (n.includes('rack pull') || n.includes('тяга с плинт') || n.includes('тяга с плинта')) {
    return { name: 'Тяга штанги в наклоне', group: 'Спина' };
  }
  // Фермерская прогулка / переноска → пропустить (не ББ)
  if (n.includes('фермерск') || n.includes('прогулка фермер') || n.includes('farmer walk')
      || n.includes('прогулка официант') || n.includes('waiter walk')
      || n.includes('yoke walk') || n.includes('прогулка с коромысл')) {
    return null;
  }
  // Паллоф / bird dog / планка (изометрика) → пропустить
  if (n.includes('паллоф') || n.includes('pallof') || n.includes('bird dog') || n.includes('птица-собака')
      || n.includes('планк') && !n.includes('боков') || n.includes('plank') && !n.includes('side')) {
    return null;
  }
  return { name: exName, group };
}

/** Проверить, что заменённое упражнение существует в каталоге (fallback). */
function validateReplacement(rep: { name: string; group: string }): { name: string; group: string } {
  const found = EXERCISE_CATALOG.find(e => e.name === rep.name);
  if (found) return rep;
  // Fallback: Тяга штанги в наклоне (всегда есть в каталоге)
  return { name: 'Тяга штанги в наклоне', group: 'Спина' };
}

/** Найти замену для исключённого/осевого упражнения из той же группы. */
function findReplacementForCycle(exName: string, muscle: string, favNames: Set<string>, favIdSet: Set<string>): { name: string; group: string } | null {
  const cat = EXERCISE_CATALOG.find(e => e.name === exName);
  const group = cat?.group || 'chest';
  // Пул упражнений той же группы
  const pool = EXERCISE_CATALOG.filter(e => e.group === group && e.name !== exName);
  if (pool.length === 0) return null;
  // Приоритет: любимые → compound → isolation
  const favMatch = pool.find(e => favNames.has(e.name) || favIdSet.has(e.id));
  if (favMatch) return { name: favMatch.name, group };
  const compound = pool.find(e => e.type === 'compound');
  if (compound) return { name: compound.name, group };
  return { name: pool[0].name, group };
}

/**
 * Convert an SRCycleTemplate (BB cycle with concrete exercises) to a full BBPlan.
 */
export function convertCycleToBBPlan(input: CycleToPlanInput): BBPlan {
  const {
    cycle, workMax, weakPoints = [], peds = [], pedDoses, courseIntensity,
    loadStrategy = 'double_progression', injuries = [],
    intensityTechnique, autoDeload, deloadType, autoRegResult,
    favoriteExercises = [], excludedExercises = [], avoidAxialLoad = false,
    volumeGoal = 'mav', specialization = false, focusGroup = '',
    level = 'advanced',
  } = input;
  const meta = cycle.meta;
  const totalWeeks = meta.weeks;
  const daysPerWeek = meta.sessionsPerWeek;
  const week1Days = cycle.week1;
  const rirProg = meta.rirProgression;
  const phases = meta.phases && meta.phases.length > 0 ? meta.phases : undefined;

  // Injury exclusions
  const today = new Date().toISOString().slice(0, 10);
  const excludedMuscles = getExcludedMuscles(injuries, today);
  const gradedInjuries = getGradedInjuries(injuries, today);

  // PED adaptation — DOSE-AWARE (передаёт pedDoses + courseIntensity)
  const allLandmarks = getAllVolumeLandmarks(level);
  const landmarks = Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]));
  const pedAdapt = adaptForPEDs(peds, landmarks, pedDoses, courseIntensity);
  const mrvMult = pedAdapt.combinedMrvMultiplier || 1.0;

  // volumeGoal scaling: MEV=0.7, MAV=1.0, MRV=1.15 (поверх шаблона)
  const volGoalMult = volumeGoal === 'mev' ? 0.70 : volumeGoal === 'mrv' ? 1.15 : 1.0;
  // specialization: weak groups +10%, others на MEV (×0.7)
  const specWeak = specialization ? weakPoints.slice(0, 2) : [];

  // excludedExercises — Set для быстрого lookup по ID и имени
  const exclIdSet = new Set(excludedExercises);
  const exclNameSet = new Set(excludedExercises.map(id => {
    const cat = EXERCISE_CATALOG.find(e => e.id === id);
    return cat?.name || id;
  }).filter(Boolean));
  // partial-name matching: цикл-имена могут быть короче каталог-имён ("Жим лёжа" vs "Жим штанги лёжа")
  const exclPartial = excludedExercises.map(id => {
    const cat = EXERCISE_CATALOG.find(e => e.id === id);
    return cat?.name || id;
  }).filter(Boolean);
  // favoriteExercises — Set для приоритета при замене
  const favIdSet = new Set(favoriteExercises);
  const favNames = new Set(favoriteExercises.map(id => {
    const cat = EXERCISE_CATALOG.find(e => e.id === id);
    return cat?.name || '';
  }).filter(Boolean));

  const rationale: string[] = [];
  rationale.push(`📋 Цикл: ${meta.title}`);
  rationale.push(`🎯 Фокус: ${meta.targetFocus || meta.direction}`);
  rationale.push(`📅 ${totalWeeks} нед, ${daysPerWeek}×/нед`);
  if (rirProg) rationale.push(`📊 RIR-прогрессия: ${rirProg.start}→${rirProg.end}`);
  if (phases && phases.length > 0) {
    for (const ph of phases) {
      const r = ph.rirProgression ? `RIR ${ph.rirProgression.start}→${ph.rirProgression.end}` : '';
      rationale.push(`🔄 Фаза «${ph.title || ''}»: нед ${ph.weekStart}-${ph.weekEnd} ${r}`);
    }
  }
  if (weakPoints.length > 0) rationale.push(`🔥 Слабые группы (акцент объёма): ${weakPoints.join(', ')}`);
  if (peds.length > 0) rationale.push(`💉 PED-адаптация (dose-aware): MRV ×${mrvMult.toFixed(2)}, восст ×${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}${pedDoses ? ' (' + peds.map(p => `${p}${pedDoses[p] ? ' ' + pedDoses[p] : ''}`).join(' + ') + (courseIntensity && courseIntensity !== 'moderate' ? ', ' + courseIntensity : '') + ')' : ''}`);
  if (excludedMuscles.size > 0) rationale.push(`⚠ Травмы: исключены мышцы ${[...excludedMuscles].join(', ')}`);
  if (gradedInjuries.length > 0) rationale.push(`⚠ Градированные травмы: ${gradedInjuries.map(i => i.muscle).join(', ')} — сниженный объём`);
  rationale.push(`📈 Стратегия прогрессии: ${loadStrategy.replace(/_/g, ' ')}`);
  if (intensityTechnique && intensityTechnique !== 'none') rationale.push(`⚡ Техника интенсивности: ${intensityTechnique.replace(/_/g, ' ')} (применяется к primary)`);
  if (autoDeload) rationale.push(`🔋 Авто-делод: ${deloadType || 'pump'} (по ACWR)`);
  if (avoidAxialLoad) rationale.push(`🦴 Осевая нагрузка убрана (присед/становая/жим стоя → безопасные альтернативы)`);
  if (volumeGoal !== 'mav') rationale.push(`📊 Цель объёма: ${volumeGoal.toUpperCase()} (×${volGoalMult})`);
  if (specialization) rationale.push(`🎯 Специализация: ${specWeak.join(', ')} на MAV+10%, остальные на MEV`);
  if (focusGroup) rationale.push(`⭐ Фокус-группа: ${focusGroup} (+30% объём)`);
  if (excludedExercises.length > 0) rationale.push(`🚫 Исключённые упражнения: ${excludedExercises.length} шт. — заменены на альтернативы`);
  if (favoriteExercises.length > 0) rationale.push(`⭐ Любимые упражнения: ${favoriteExercises.length} шт. — приоритет при замене`);
  rationale.push(`🎯 Источник упражнений: ПРОФ-цикл с фиксированными упражнениями (не автоподбор)`);
  rationale.push(`🛡 BB-фильтр: ПЛ/олимпийские упражнения автозаменены на ББ-альтернативы (становая→тяга в наклоне, жим стоя→жим сидя)`);

  // Build weeks
  const weeks: BBWeek[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const sessions: BBSession[] = week1Days.map((daySpec, dayIdx) => {
      const exercises: BBExercise[] = daySpec.exercises.map((exSpec) => {
        // BB-ФИЛЬТР: заменить ПЛ/олимпийские упражнения на ББ-альтернативы
        const exGroup = exSpec.group || muscleGroupFromExName(exSpec.name, EXERCISE_CATALOG);
        const bbReplaced = replacePLForBB(exSpec.name, exGroup);
        if (bbReplaced === null) {
          // Пропустить упражнение (ПЛ/мусор без ББ-аналога)
          return null as any;
        }
        const bbExName = bbReplaced.name;
        const bbExGroup = bbReplaced.group;
        // Проверка: исключённое упражнение (по ID, имени или partial-match) → замена
        let finalExName = bbExName;
        const catEntry = EXERCISE_CATALOG.find(e => e.name === bbExName);
        const catId = catEntry?.id || '';
        const isExcluded = exclNameSet.has(bbExName) || exclIdSet.has(catId)
          || exclPartial.some(n => n.includes(bbExName) || bbExName.includes(n));
        if (isExcluded) {
          const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet);
          if (rep) { finalExName = rep.name; } else { return null as any; }
        }
        // Проверка: осевая нагрузка (если avoidAxialLoad) → замена на не-осевую
        if (avoidAxialLoad && catEntry && isAxialLoadExercise(catEntry)) {
          const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet);
          if (rep) { finalExName = rep.name; }
        }
        const exRir = computeRirForEx(w, totalWeeks, rirProg, phases);
        const isPrimary = isPrimaryByLoad(exSpec.load);
        const character = exSpec.load === 'Тяжелая' ? 'тяж' : 'памп';
        const workMaxVal = calcWorkMaxForEx(finalExName, workMax);
        const muscle = muscleGroupFromExName(finalExName, EXERCISE_CATALOG);
        // Пропускаем упражнения на исключённые мышцы (травмы)
        if (excludedMuscles.has(muscle)) return null as any;
        const isWeak = weakPoints.includes(muscle);
        const isFocus = focusGroup === muscle || (focusGroup && isWeak && weakPoints.includes(focusGroup));
        const isSubstituted = finalExName !== exSpec.name;

        // Volume boost: weak groups + PED adaptation + volumeGoal + specialization + focusGroup.
        // При активных PED: primary получает полный множитель, accessory — 80% множителя, минимум 2 сета.
        const pedFactor = peds.length > 0 ? (isPrimary ? mrvMult : Math.max(1.0, mrvMult * 0.8)) : 1.0;
        // specialization: слабые (топ-2) на +10%, остальные на MEV (×0.7)
        const specFactor = specialization ? (specWeak.includes(muscle) ? 1.10 : 0.70) : 1.0;
        // focusGroup: +30%
        const focusFactor = isFocus ? 1.30 : 1.0;
        // volumeGoal: MEV×0.7 / MAV×1.0 / MRV×1.15
        const setMult = (isWeak ? 1.2 : 1.0) * pedFactor * volGoalMult * specFactor * focusFactor;
        const baseSets = exSpec.sets[0]?.sets || 3;
        let targetSets = Math.max(1, Math.round(baseSets * setMult));
        // Минимум 2 сета для любого упражнения (ББ-практика)
        if (targetSets < 2) targetSets = 2;

        // RIR: weak groups get 0.5 harder
        const effectiveRir = isWeak ? Math.max(0, exRir - 1) : exRir;
        const targetReps = exSpec.sets[0]?.reps || 10;
        const pct = exSpec.sets[0]?.pct || 0.65;

        // Create work sets
        const workSets: BBSet[] = [];
        for (let si = 0; si < targetSets; si++) {
          // Small weight drift across sets (last set heaviest)
          const setDrift = 1 + si * 0.02;
          const pctAdjusted = pct * setDrift;
          const ws = createBBSet(pctAdjusted, targetReps, effectiveRir, workMaxVal);
          workSets.push(ws);
        }

        // Rest seconds by exercise type
        const restSeconds = isPrimary ? 90 : 60;
        if (workSets.length > 0) workSets[workSets.length - 1].restSeconds = restSeconds;

        const ex: BBExercise = {
          name: finalExName,
          muscle,
          role: isPrimary ? 'primary' : 'accessory',
          character,
          sets: targetSets,
          repsRange: [targetReps, targetReps + 2],
          rir: effectiveRir,
          workSets,
          restSeconds,
          comment: `${isPrimary ? '🎯 Основное' : '📌 Добивочное'}: ${muscle}. ${targetSets}×${targetReps} @${Math.round(workMaxVal * pct)}кг, RIR ${effectiveRir}.${isSubstituted ? ' ⚠ Замена (было: ' + exSpec.name + ').' : ''}${isFocus ? ' ⭐ Фокус.' : ''}`,
          warmupSets: isPrimary ? (() => {
            const w = Math.round(workMaxVal * pct);
            if (w <= 0) return [];
            const steps = w <= 60 ? 2 : w <= 100 ? 3 : 4;
            const wu: { load: number; reps: number }[] = [];
            for (let i = 1; i <= steps; i++) wu.push({ load: Math.round(w * (0.3+0.55/steps*i)), reps: Math.min(8,5+i) });
            return wu;
          })() : [],
        };
        return ex;
      }).filter(Boolean) as BBExercise[];
      // Сортировка: primary первыми, accessory после
      exercises.sort((a, b) => (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1));

      // Determine session character from exercises
      const hasHeavy = exercises.some(e => e.character === 'тяж');
      // Determine session tag from actual exercises (not day index)
      const dayMuscles = [...new Set(exercises.map(e => e.muscle))];
      let sessionTag = 'FullBody';
      const isChest = dayMuscles.some(m => m === 'chest');
      const isBack = dayMuscles.some(m => m === 'back');
      const isQuads = dayMuscles.some(m => m === 'quads');
      const isHams = dayMuscles.some(m => m === 'hamstrings');
      const isShoulders = dayMuscles.some(m => m === 'shoulders');
      const isBi = dayMuscles.some(m => m === 'biceps');
      const isTri = dayMuscles.some(m => m === 'triceps');
      const isLegs = isQuads || isHams;
      if (isChest && isBack && !isLegs) sessionTag = 'ChestBack';
      else if (isChest && isTri && !isBack && !isLegs) sessionTag = 'Push';
      else if (isBack && isBi && !isChest && !isLegs) sessionTag = 'Pull';
      else if (isShoulders && (isBi || isTri) && !isChest && !isBack && !isLegs) sessionTag = 'ShouldersArms';
      else if (isChest && !isBack && !isLegs) sessionTag = 'Chest';
      else if (isBack && !isChest && !isLegs) sessionTag = 'Back';
      else if (isShoulders && !isChest && !isBack && !isLegs) sessionTag = 'Shoulders';
      else if ((isBi || isTri) && !isChest && !isBack && !isLegs && !isShoulders) sessionTag = 'Arms';
      else if (isLegs && !isChest && !isBack) sessionTag = 'Legs';
      else if (isChest && isBack && isLegs) sessionTag = 'FullBody';
      const session: BBSession = {
        day: dayIdx + 1,
        weekOffset: (w - 1) * daysPerWeek + dayIdx + 1,
        character: hasHeavy ? 'тяж' : 'памп',
        sessionTag,
        exercises,
      };
      return session;
    });

    // Apply deload if this week is a deload week
    const isDeload = meta.deloadWeeks?.includes(w);
    if (isDeload) {
      for (const sess of sessions) {
        for (const ex of sess.exercises) {
          ex.sets = Math.max(1, Math.round(ex.sets * 0.5));
          ex.rir = Math.min(5, ex.rir + 1);
          ex.repsRange = [ex.repsRange[0] + 2, ex.repsRange[1] + 2];
          for (const ws of ex.workSets) {
            ws.rir = Math.min(5, ws.rir + 1);
            ws.weight = Math.round(ws.weight * 0.85 * 10) / 10;
            ws.reps = ws.reps + 2;
          }
        }
      }
      rationale.push(`🔋 Разгрузка нед ${w}: объём -50%, RIR+1, вес -15%`);
    }

    weeks.push({ week: w, sessions });
  }

  // Compute rotationMuscleVolume
  const rotationMuscleVolume: Record<string, number> = {};
  for (const w of weeks) {
    for (const sess of w.sessions) {
      for (const ex of sess.exercises) {
        rotationMuscleVolume[ex.muscle] = (rotationMuscleVolume[ex.muscle] || 0) + ex.sets;
      }
    }
  }

  // Build pattern info from cycle metadata
  const pattern = {
    id: meta.id,
    name: meta.title,
    description: meta.description || '',
    rotationDays: 7,
    sessionsPerRotation: daysPerWeek,
    level: [meta.level || 'advanced'],
    schedule: week1Days.map((_, i) => ({ kind: 'тренировка' as const, character: null, sessionTag: ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'FullBody', 'Arms', 'Shoulders', 'ChestBack', 'ShouldersArms'][i % 10] })),
  };

  let finalPlan: BBPlan = { pattern, weeks, rotationMuscleVolume, rationale };

  // Применяем пост-обработку (техники/авто-делод/загрузка/авторег) — как в buildBBPlan.
  // Условие покрывает ВСЕ признаки, а не только technique/weakPoints — иначе loadStrategy
  // и autoDeload теряются (баг: dfa8842fb убрал дубль-вызов, но не расширил guard).
  const acwrRatio = 1; // cycle mode не вычисляет ACWR (нет sRPE-интеграции); autoDeload работает по meta.deloadWeeks
  if ((intensityTechnique && intensityTechnique !== 'none') || weakPoints.length > 0 || loadStrategy || autoDeload || autoRegResult) {
    finalPlan = applyPostPhaseProcessing({
      plan: finalPlan,
      totalWeeks,
      workMax,
      loadStrategy: loadStrategy as LoadStrategy,
      autoDeload,
      deloadType,
      acwrRatio,
      autoRegResult,
      skipPhaseRedistribution: true,
      intensityTechnique: intensityTechnique && intensityTechnique !== 'none' ? intensityTechnique : undefined,
      weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
    });
  }

  // Volume-landmarks (единый источник, как в generic split)
  const pedMrvMult = pedAdapt.combinedMrvMultiplier ?? 1;
  const volumeLandmarks = getBBVolumeLandmarks(finalPlan, level, pedMrvMult);

  return { ...finalPlan, volumeLandmarks };
}
