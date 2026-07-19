/**
 * cycle-to-plan.ts — конвертер SRCycleTemplate (BB-цикл) → BBPlan.
 *
 * Позволяет BbAutoConstructor и TrainingConstructor использовать
 * готовые ПРОФ-циклы с конкретными упражнениями вместо generic-генерации.
 */
import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec, SRSetSpec, SRDirection, SRLevel, SRPeriod } from '../../data/lms-cycles/lms-types';
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from './bb-builder.engine';
import { getBBVolumeLandmarks } from './bb-builder.engine';
import { isRearDeltExercise } from './bb-builder.engine';
import { PCT_FOR_RIR } from '../rir-table';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from './bb-ped-adaptation.engine';
import { getExcludedMuscles, getGradedInjuries, type Injury } from '../manual-plan-builder';
import { applyPostPhaseProcessing, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { trueMuscleOf } from '../movement-pattern';
import type { FullProgram, ProgramWeek, ProgramDay } from '../../engines/complete-program-library.engine';

export type CycleSourceCycle = SRCycleTemplate;
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

/**
 * Конвертер программы из библиотеки (FullProgram) → SRCycleTemplate.
 * Позволяет загружать программы (Starting Strength, 5/3/1, PPL, Arnold, и др.)
 * в ББ-авто как цикл — с применением всех PRO-фич (PED-дозы, intensity, deload, и т.д.).
 */
export function programToCycleTemplate(program: FullProgram): SRCycleTemplate {
  const goalToDirection: Record<string, SRDirection> = {
    strength: 'powerlifting', hypertrophy: 'bodybuilding', powerlifting: 'powerlifting',
    bodybuilding: 'bodybuilding', athletic: 'bodybuilding', rehab: 'bodybuilding', peaking: 'powerlifting',
  };
  const levelToSRLevel: Record<string, SRLevel> = {
    beginner: 'novice', intermediate: 'intermediate', advanced: 'KMS-MS',
  };
  const goalToPeriod: Record<string, SRPeriod> = {
    strength: 'strength', hypertrophy: 'mass', powerlifting: 'strength',
    bodybuilding: 'mass', athletic: 'mixed', rehab: 'mixed', peaking: 'peak',
  };

  // Берём неделю 1 как шаблон ротации
  const week1 = program.weeks[0];
  const deloadWeeks = program.weeks.filter(w => w.deload).map(w => w.week);

  // Конвертировать день программы → SRDaySpec с BB-фильтрацией и дедупликацией
  const days: SRDaySpec[] = week1.days.map(day => {
    const seenNames = new Set<string>(); // дедупликация по имени
    const exercises: SRExerciseSpec[] = [];
    for (const ex of day.exercises) {
      // BB-фильтр: заменить ПЛ/олимпийские на ББ-альтернативы
      const muscle = muscleGroupFromExName(ex.name, EXERCISE_CATALOG);
      const bbRep = replacePLForBB(ex.name, muscle === 'chest' ? 'Грудь' : muscle === 'back' ? 'Спина' : muscle === 'shoulders' ? 'Плечи' : muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' || muscle === 'calves' ? 'Ноги' : muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms' ? 'Руки' : 'Кор');
      if (!bbRep) continue; // пропустить ПЛ/мусор без ББ-аналога
      // Дедупликация: если упражнение уже есть в дне — пропустить
      if (seenNames.has(bbRep.name)) continue;
      seenNames.add(bbRep.name);
      // Проверка trueMuscleOf — пропустить если null (hinge/carry/junk)
      const cat = EXERCISE_CATALOG.find(e => e.name === bbRep.name);
      if (cat && trueMuscleOf(cat) === null) continue;

      const reps = parseInt(String(ex.reps)) || 10;
      const rir = ex.rir ?? 2;
      const pct = PCT_FOR_RIR[rir] ?? 0.72;
      const group = muscleGroupFromExName(bbRep.name, EXERCISE_CATALOG);
      const spec: SRExerciseSpec = {
        name: bbRep.name,
        group: group === 'chest' ? 'Грудь' : group === 'back' ? 'Спина' : group === 'shoulders' ? 'Плечи'
          : group === 'quads' || group === 'hamstrings' || group === 'glutes' || group === 'calves' ? 'Ноги'
          : group === 'biceps' || group === 'triceps' || group === 'forearms' ? 'Руки'
          : group === 'abs' || group === 'core' ? 'Кор' : 'Грудь',
        coef: 1.0,
        mnosz: 1,
        load: rir <= 1 ? 'Тяжелая' : rir <= 3 ? 'Тяжелая' : 'Средняя',
        sets: [{ pct, reps, sets: ex.sets, rir }] as SRSetSpec[],
      };
      exercises.push(spec);
    }
    return { exercises };
  });

  return {
    meta: {
      id: 'prog_' + program.id,
      title: program.name,
      direction: goalToDirection[program.goal] || 'bodybuilding',
      level: levelToSRLevel[program.level] || 'intermediate',
      period: goalToPeriod[program.goal] || 'mass',
      sessionsPerWeek: program.daysPerWeek,
      weeks: program.durationWeeks,
      correctionPct: 0.005,
      description: program.description,
      howItWorks: `Программа «${program.name}» (${program.author}). ${program.progressionModel}. ${program.deloadProtocol}.`,
      conditions: program.warnings || [],
      tags: ['program'],
      targetFocus: 'mixed',
      deloadWeeks: deloadWeeks.length > 0 ? deloadWeeks : undefined,
      rirProgression: { start: 3, end: 1 },
    },
    week1: days,
};
}
 
// ──────────────────────────────────────────────────────────────────────
// Конвертер: SRCycleTemplate → FullProgram
// Использует week1 + meta для генерации всех недель с прогрессией RIR/нагрузки.
// ──────────────────────────────────────────────────────────────────────

export function cycleTemplateToFullProgram(cycle: SRCycleTemplate): FullProgram {
  const { meta, week1, weeks: explicitWeeks } = cycle;
  const totalWeeks = meta.weeks || explicitWeeks?.length || week1?.length || 12;

  // Реверс level: novice→beginner, intermediate→intermediate, KMS-MS→advanced, elite→advanced
  const srToFullLevel: Record<string, FullProgram['level']> = {
    novice: 'beginner',
    intermediate: 'intermediate',
    'KMS-MS': 'advanced',
    elite: 'advanced',
  };
  const level = srToFullLevel[meta.level] || 'intermediate';

  // Направление программы (FullProgram.direction: 'strength' | 'bodybuilding' | 'both')
  const direction = meta.direction === 'powerlifting' ? 'strength' :
    meta.direction === 'bodybuilding' ? 'bodybuilding' : 'both';

  // Генерация всех недель на основе week1
  const generatedWeeks: ProgramWeek[] = [];

  // RIR-прогрессия: start→end по неделям (линейная интерполяция)
  const rirStart = meta.rirProgression?.start ?? 3;
  const rirEnd = meta.rirProgression?.end ?? 1;

  // Коррекция нагрузки в неделю (correctionPct)
  const correctionPct = meta.correctionPct ?? 0.005;

  // Недели разгрузки
  const deloadWeeks = new Set(meta.deloadWeeks || []);

  // Базовые недели из week1 (SRDaySpec[])
  const baseWeek1 = week1 || [];

  for (let w = 1; w <= totalWeeks; w++) {
    const isDeload = deloadWeeks.has(w);
    // RIR для этой недели: линейно от start к end
    const rirProgress = totalWeeks > 1 ? (w - 1) / (totalWeeks - 1) : 0;
    const weekRir = Math.round(rirStart + (rirEnd - rirStart) * rirProgress);
    // Множитель нагрузки: 1 + correctionPct * (w-1), на разгрузке -50%
    const volumeMult = isDeload ? 0.5 : (1 + correctionPct * (w - 1));
    // Интенсивность: на разгрузке снижаем
    const intensityMult = isDeload ? 0.7 : 1.0;

    const days: ProgramDay[] = baseWeek1.map((srDay, dayIdx) => {
      const dayNum = dayIdx + 1;
      const dayName = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][dayIdx] || `День ${dayIdx + 1}`;

      const exercises = srDay.exercises.map(srEx => {
        // Базовый процент из первого сета
        const baseSet = srEx.sets?.[0];
        const basePct = baseSet?.pct ?? 0.6;
        const baseReps = baseSet?.reps ?? 10;
        const baseSets = baseSet?.sets ?? 3;

        // Адаптируем процент под RIR недели (чем ниже RIR, тем выше %)
        const rirAdjustment = (3 - weekRir) * 0.025; // RIR 3→60%, RIR 2→62.5%, RIR 1→65%, RIR 0→67.5%
        const adjustedPct = Math.min(0.95, basePct + rirAdjustment);

        // На разгрузке снижаем процент
        const finalPct = isDeload ? adjustedPct * 0.7 : adjustedPct;

        return {
          name: srEx.name,
          sets: baseSets,
          reps: String(baseReps),
          rpe: Math.round(10 - weekRir), // RPE = 10 - RIR
          rir: weekRir,
          restSec: srEx.load === 'Тяжелая' ? 180 : srEx.load === 'Средняя' ? 120 : 90,
          notes: srEx.load ? `Нагрузка: ${srEx.load}` : '',
          progression: w < totalWeeks ? `+${Math.round(correctionPct * 100)}% к весу след. неделю` : 'Финальная неделя',
        };
      });

      return {
        day: dayNum,
        name: `${dayName} (нед ${w})`,
        focus: srDay.exercises.map(e => e.group).filter(Boolean).join(', ') || 'Полное тело',
        warmup: 'Общая разминка 5-10 мин + специфическая разминка',
        exercises,
        cooldown: 'Растяжение 5 мин',
      };
    });

    generatedWeeks.push({
      week: w,
      phase: isDeload ? 'deload' : w <= Math.ceil(totalWeeks * 0.3) ? 'accumulation' :
        w <= Math.ceil(totalWeeks * 0.7) ? 'intensification' : 'peaking',
      volumeMultiplier: volumeMult,
      intensityMultiplier: intensityMult,
      days,
      deload: isDeload,
    });
  }

  // Если есть explicit weeks — используем их вместо сгенерированных
  if (explicitWeeks && explicitWeeks.length > 0) {
    // explicit weeks имеют ту же структуру что week1 (SRDaySpec[])
    // конвертируем их аналогично
    // Для простоты пока игнорируем, так как у наших 12 циклов нет explicit weeks
  }

  // FullProgram.goal: 'strength' | 'hypertrophy' | 'powerlifting' | 'bodybuilding' | 'athletic' | 'rehab' | 'peaking'
  const goalMap: Record<string, FullProgram['goal']> = {
    mass: 'hypertrophy',
    strength: 'strength',
    power: 'powerlifting',
    peaking: 'peaking',
    cut: 'bodybuilding',
    mixed: 'athletic',
  };
  const goal = goalMap[meta.period] || 'hypertrophy';

  // FullProgram.type is string, but use convention
  const typeStr = direction === 'strength' ? 'strength' : 'bodybuilding';

  return {
    id: meta.id,
    name: meta.title,
    author: 'LMS/PROF',
    type: typeStr,
    goal,
    direction,
    level,
    durationWeeks: totalWeeks,
    daysPerWeek: meta.sessionsPerWeek,
    sessionTimeMin: '90',
    description: meta.howItWorks || meta.description || '',
    targetAudience: meta.conditions?.join('; ') || '',
    equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'machine'],
    weeks: generatedWeeks,
    progressionModel: `Linear +${Math.round(correctionPct * 100)}%/week, RIR ${rirStart}→${rirEnd}`,
    deloadProtocol: deloadWeeks.size > 0 ? `Deload weeks: ${Array.from(deloadWeeks).join(', ')}` : 'None',
    customization: [],
    warnings: [
      'Программа сгенерирована из ПРОФ-цикла LMS. Проверьте 1RM перед стартом.',
      'RIR-прогрессия рассчитана линейно. Настройте под себя при необходимости.',
    ],
    expectedResults: `Гипертрофия/сила за ${totalWeeks} недель. Целевой RIR ${rirEnd} на пике.`,
  };
}
 
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
  /** Доступное оборудование — фильтр отбора упражнений. */
  equipment?: string[];
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

/** Найти замену для исключённого/осевого упражнения из той же группы, с учётом угла.
 *  Пытается выбрать упражнение с ДРУГИМ углом, чем уже есть в дне (diversity). */
function findReplacementForCycle(exName: string, muscle: string, favNames: Set<string>, favIdSet: Set<string>, alreadyInDay: Set<string>): { name: string; group: string } | null {
  const cat = EXERCISE_CATALOG.find(e => e.name === exName);
  const group = cat?.group || 'chest';
  // Пул упражнений той же группы, не в дне
  const pool = EXERCISE_CATALOG.filter(e => e.group === group && e.name !== exName && !alreadyInDay.has(e.name));
  if (pool.length === 0) return null;
  // Приоритет 1: любимое
  const favMatch = pool.find(e => favNames.has(e.name) || favIdSet.has(e.id));
  if (favMatch) return { name: favMatch.name, group };
  // Приоритет 2: compound с ДРУГИМ углом/паттерном
  const exAngle = classifyAngle(exName);
  const diffAngle = pool.find(e => e.type === 'compound' && classifyAngle(e.name) !== exAngle);
  if (diffAngle) return { name: diffAngle.name, group };
  // Приоритет 3: compound
  const compound = pool.find(e => e.type === 'compound');
  if (compound) return { name: compound.name, group };
  // Приоритет 4: любое
  return { name: pool[0].name, group };
}

/** Классифицировать угол/паттерн упражнения (для diversity). */
function classifyAngle(exName: string): string {
  const n = (exName || '').toLowerCase();
  // Грудь
  if (/жим.*(лёжа|лежа|гориз)|bench.*press/i.test(n) && !/наклон|incline|decline/i.test(n)) return 'hor_press';
  if (/жим.*(наклон|incline|верх)/i.test(n) || /incline.*press/i.test(n)) return 'inc_press';
  if (/развод|fly|crossover|кроссов/i.test(n)) return 'fly';
  // Спина
  if (/подтяг|pull.?up|тяга.*верх|lat.?pull|пуллдаун/i.test(n)) return 'vert_pull';
  if (/тяга.*(наклон|блок|гантел|штанг|к пояс)/i.test(n) && !/верх/i.test(n)) return 'hor_row';
  // Ноги
  if (/присед.*штанг|squat/i.test(n) && !/гантел|фронт|гоблет|болгар/i.test(n)) return 'bb_squat';
  if (/жим.*ног|leg.?press|хак/i.test(n)) return 'leg_press';
  if (/сгибан.*ног|leg.?curl/i.test(n)) return 'leg_curl';
  if (/ягодичн.*мост|hip.?thrust/i.test(n)) return 'hip_thrust';
  // Плечи
  if (/жим.*(стоя|сидя|армей)/i.test(n)) return 'ohp';
  if (/мах|подъём.*стороны|lateral|raise/i.test(n)) return 'lateral';
  if (/наклон.*дельт|rear|лиц.*тяга|face.?pull/i.test(n)) return 'rear_delt';
  // Руки
  if (/сгибан.*штанг|barbell.*curl/i.test(n)) return 'bb_curl';
  if (/сгибан.*гантел|dumbbell.*curl/i.test(n) && !/молот/i.test(n)) return 'db_curl';
  if (/молот|hammer/i.test(n)) return 'hammer';
  if (/разгибан.*блок|pushdown/i.test(n)) return 'pushdown';
  if (/француз|french|overhead.*triceps/i.test(n)) return 'french';
  return 'other';
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
    level = 'advanced', equipment = [],
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
      const seenNames = new Set<string>(); // дедупликация по имени внутри дня
      const exercises: BBExercise[] = daySpec.exercises.map((exSpec) => {
        // BB-ФИЛЬТР: заменить ПЛ/олимпийские упражнения на ББ-альтернативы
        const exGroup = exSpec.group || muscleGroupFromExName(exSpec.name, EXERCISE_CATALOG);
        const bbReplaced = replacePLForBB(exSpec.name, exGroup);
        if (bbReplaced === null) {
          // Пропустить упражнение (ПЛ/мусор без ББ-аналога)
          return null as any;
        }
        const bbExName = bbReplaced.name;
        // Дедупликация: если упражнение уже есть в этом дне — пропустить
        if (seenNames.has(bbExName)) return null as any;
        // JUNK-фильтр: проверить trueMuscleOf — пропустить если null (hinge/carry/junk)
        const catCheck = EXERCISE_CATALOG.find(e => e.name === bbExName);
        if (catCheck && trueMuscleOf(catCheck) === null) return null as any;
        // Rear delt фильтр: не ставить rear delt в Push/Chest/Shoulders-дни
        const _tag = (daySpec as any)._sessionTag || '';
        const sessionTagLower = _tag.toLowerCase() || muscleGroupFromExName(bbExName, EXERCISE_CATALOG).toLowerCase();
        // Определить тип дня по упражнениям в дне
        const dayMuscles = daySpec.exercises.map(ex => muscleGroupFromExName(ex.name, EXERCISE_CATALOG));
        const isPushDay = dayMuscles.includes('chest') && !dayMuscles.includes('back');
        if (isPushDay && isRearDeltExercise(bbExName)) return null as any;
        const bbExGroup = bbReplaced.group;
        // Проверка: исключённое упражнение (по ID, имени или partial-match) → замена
        let finalExName = bbExName;
        const catEntry = EXERCISE_CATALOG.find(e => e.name === bbExName);
        const catId = catEntry?.id || '';
        const isExcluded = exclNameSet.has(bbExName) || exclIdSet.has(catId)
          || exclPartial.some(n => n.includes(bbExName) || bbExName.includes(n));
        if (isExcluded) {
          const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet, seenNames);
          if (rep) { finalExName = rep.name; } else { return null as any; }
        }
        // Проверка: осевая нагрузка (если avoidAxialLoad) → замена на не-осевую
        if (avoidAxialLoad && catEntry && isAxialLoadExercise(catEntry)) {
          const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet, seenNames);
          if (rep) { finalExName = rep.name; }
        }
        // Проверка: оборудование (если указано) → замена если упражнение требует недоступного оборудования
        if (equipment.length > 0 && catEntry) {
          const rawEq = (catEntry as any).equipment;
          const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
          if (exEq.length > 0 && !exEq.some(eq => equipment.includes(eq))) {
            const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet, seenNames);
            if (rep) { finalExName = rep.name; }
          }
        }
        const exRir = computeRirForEx(w, totalWeeks, rirProg, phases);
        const isPrimary = isPrimaryByLoad(exSpec.load);
        const character = exSpec.load === 'Тяжелая' ? 'тяж' : 'памп';
        const workMaxVal = calcWorkMaxForEx(finalExName, workMax);
        const muscle = muscleGroupFromExName(finalExName, EXERCISE_CATALOG);
        // Пропускаем упражнения на исключённые мышцы (травмы)
        if (excludedMuscles.has(muscle)) return null as any;
        // Добавить в seen (дедупликация)
        seenNames.add(finalExName);
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
      // Сортировка: primary первыми, accessory после.
      // Внутри каждой группы — по strengthRank (barbell > dumbbell > machine > cable > one-arm).
      const cycleStrengthRank = (ex: BBExercise): number => {
        const cat = EXERCISE_CATALOG.find(e => e.name === ex.name);
        if (!cat) return 5;
        const n = (ex.name || '').toLowerCase();
        const eq = String(cat.equipment || '').toLowerCase();
        if (/одной рукой|одной руке|single.?arm|unilateral/i.test(n)) return 7;
        if (cat.type !== 'compound') return 6;
        if (eq.includes('barbell') || eq.includes('smith')) return 1;
        if (eq.includes('dumbbell')) return 2;
        if (eq.includes('machine')) return 3;
        if (eq.includes('cable')) return 4;
        if (eq.includes('bodyweight') || eq.includes('suspension')) return 5;
        return 5;
      };
      exercises.sort((a, b) => {
        const roleDiff = (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1);
        if (roleDiff !== 0) return roleDiff;
        return cycleStrengthRank(a) - cycleStrengthRank(b);
      });

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

  // muscleFrequency: вычислить из дней недели 1 — сколько раз каждая мышца тренируется
  const muscleFrequency: Record<string, number> = {};
  for (const day of week1Days) {
    const dayMuscles = new Set<string>();
    for (const exSpec of day.exercises) {
      const bbRep = replacePLForBB(exSpec.name, exSpec.group || muscleGroupFromExName(exSpec.name, EXERCISE_CATALOG));
      if (!bbRep) continue;
      const muscle = muscleGroupFromExName(bbRep.name, EXERCISE_CATALOG);
      if (!excludedMuscles.has(muscle)) dayMuscles.add(muscle);
    }
    for (const m of dayMuscles) {
      muscleFrequency[m] = (muscleFrequency[m] || 0) + 1;
    }
  }

  return { ...finalPlan, volumeLandmarks, muscleFrequency };
}
