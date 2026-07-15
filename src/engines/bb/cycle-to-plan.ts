/**
 * cycle-to-plan.ts — конвертер SRCycleTemplate (BB-цикл) → BBPlan.
 *
 * Позволяет BbAutoConstructor и TrainingConstructor использовать
 * готовые ПРОФ-циклы с конкретными упражнениями вместо generic-генерации.
 */
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from './bb-builder.engine';
import { PCT_FOR_RIR } from '../rir-table';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { adaptForPEDs, type PED } from './bb-ped-adaptation.engine';
import { getExcludedMuscles, getGradedInjuries, type Injury } from '../manual-plan-builder';

export type CycleSourceCycle = SRCycleTemplate;

export interface CycleToPlanInput {
  cycle: SRCycleTemplate;
  workMax: Record<string, number>;
  weakPoints?: string[];
  peds?: PED[];
  loadStrategy?: string;
  autoRegVolumeMult?: number;
  autoRegRirShift?: number;
  injuries?: Injury[];
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
 * Convert an SRCycleTemplate (BB cycle with concrete exercises) to a full BBPlan.
 */
export function convertCycleToBBPlan(input: CycleToPlanInput): BBPlan {
  const { cycle, workMax, weakPoints = [], peds = [], loadStrategy = 'double_progression', injuries = [] } = input;
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

  // PED adaptation
  const allLandmarks = getAllVolumeLandmarks('advanced');
  const landmarks = Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]));
  const pedAdapt = adaptForPEDs(peds, landmarks);
  const mrvMult = pedAdapt.combinedMrvMultiplier || 1.0;

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
  if (peds.length > 0) rationale.push(`💉 PED-адаптация: MRV ×${mrvMult.toFixed(2)}`);
  if (excludedMuscles.size > 0) rationale.push(`⚠ Травмы: исключены мышцы ${[...excludedMuscles].join(', ')}`);
  if (gradedInjuries.length > 0) rationale.push(`⚠ Градированные травмы: ${gradedInjuries.map(i => i.muscle).join(', ')} — сниженный объём`);
  rationale.push(`📈 Стратегия прогрессии: ${loadStrategy.replace(/_/g, ' ')}`);
  rationale.push(`🎯 Источник упражнений: ПРОФ-цикл с фиксированными упражнениями (не автоподбор)`);

  // Build weeks
  const weeks: BBWeek[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const sessions: BBSession[] = week1Days.map((daySpec, dayIdx) => {
      const exercises: BBExercise[] = daySpec.exercises.map((exSpec) => {
        const exRir = computeRirForEx(w, totalWeeks, rirProg, phases);
        const isPrimary = isPrimaryByLoad(exSpec.load);
        const character = exSpec.load === 'Тяжелая' ? 'тяж' : 'памп';
        const workMaxVal = calcWorkMaxForEx(exSpec.name, workMax);
        const muscle = muscleGroupFromExName(exSpec.name, EXERCISE_CATALOG);
        // Пропускаем упражнения на исключённые мышцы (травмы)
        if (excludedMuscles.has(muscle)) return null as any;
        const isWeak = weakPoints.includes(muscle);

        // Volume boost: weak groups + PED adaptation.
        // При активных PED: primary получает полный множитель, accessory — 80% множителя, минимум 2 сета.
        const pedFactor = peds.length > 0 ? (isPrimary ? mrvMult : Math.max(1.0, mrvMult * 0.8)) : 1.0;
        const setMult = (isWeak ? 1.2 : 1.0) * pedFactor;
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
          name: exSpec.name,
          muscle,
          role: isPrimary ? 'primary' : 'accessory',
          character,
          sets: targetSets,
          repsRange: [targetReps, targetReps + 2],
          rir: effectiveRir,
          workSets,
          restSeconds,
          comment: `${isPrimary ? '🎯 Основное' : '📌 Добивочное'}: ${muscle}. ${targetSets}×${targetReps} @${Math.round(workMaxVal * pct)}кг, RIR ${effectiveRir}.`,
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

  return {
    pattern,
    weeks,
    rotationMuscleVolume,
    rationale,
  };
}
