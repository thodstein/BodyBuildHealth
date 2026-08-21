/**
 * cycle-to-plan.ts — конвертер SRCycleTemplate (BB-цикл) → BBPlan.
 *
 * Позволяет BbAutoConstructor и TrainingConstructor использовать
 * готовые ПРОФ-циклы с конкретными упражнениями вместо generic-генерации.
 */
import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec, SRSetSpec, SRDirection, SRLevel, SRPeriod } from '../../data/lms-cycles/lms-types';
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from './bb-builder.engine';
import { getBBVolumeLandmarks, isWeak, WEAK_TO_MUSCLE } from './bb-builder.engine';
import { isRearDeltExercise, isMobilityRestricted } from './bb-builder.engine';
import { buildExerciseInstructions, formatExerciseInstructions } from './bb-exercise-instructions.engine';
import { PCT_FOR_RIR } from '../rir-table';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { sessionLimitsFor as centralizedSessionLimits } from './bb-volume.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from './bb-ped-adaptation.engine';
import { getExcludedMuscles, getGradedInjuries, type Injury } from '../manual-plan-builder';
import { applyPostPhaseProcessing, applyDeloadToWeek, DELOAD_PROTOCOLS, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { tidySessionExercises, SESSION_TIDY_RATIONALE, isIsolationByName } from './bb-session-order.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { trueMuscleOf } from '../movement-pattern';
import { loadSRPESessions } from '../pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../pro/training-load.engine';
import type { FullProgram, ProgramWeek, ProgramDay } from '../../engines/complete-program-library.engine';
import type { BBTrainingFocus } from './bb-goal-types';
import type { AthleteContext, AthleteMode } from '../athlete-context.engine';
import { FOCUS_RIR_TABLE } from './bb-goal-types';
import { finalizeBBPlan } from './bb-finalize.engine';
import { computeBBRecoveryMultiplier, computeBBNutritionMultiplier } from './bb-volume.engine';
import { applyFeedbackToBuild, autoReplaceOnPlateau } from './bb-progression-feedback.engine';
import { loadSessions as loadWorkoutSessions } from '../workout-logger.engine';
import { extractMesocycleProgression, applyWeightProgression } from './bb-mesocycle-progression.engine';
import { resolveSpecialization, specializationVolumeFactor, specializationEmphasisFactor, specializationMrvFactor, isSpecializationWeak, isSpecializationFocus, canonicalMuscle, buildSpecializationSchedule, specResForWeekSchedule, tradeoffForWeek, specializationScheduleText, type SpecializationBlock } from './bb-specialization.engine';
import { applyTradeoffToPlan } from './bb-tradeoff.engine';

/**
 * Вычислить ACWR из реальных sRPE-сессий пользователя (отдельная функция для cycle/program mode).
 * В cycle/program mode нет своего ACWR-расчёта в bb-builder.engine (computeAcwr приватный);
 * дублируем логику здесь, чтобы MODE 2 (cycle/program) тоже учитывал PED-логику первого режима
 * (autoDeload по ACWR).
 */
function computeAcwrCyclePlan(): { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'dangerous' } {
  try {
    const sessions = loadSRPESessions();
    if (!sessions || sessions.length < 2) return { ratio: 1, zone: 'optimal' };
    const daily = toDailyLoads(sessions as any);
    const r = acuteChronicRatio(daily);
    if (!r || !isFinite(r.ratio)) return { ratio: 1, zone: 'optimal' };
    const zone = r.ratio < 0.8 ? 'undertrained' : r.ratio <= 1.3 ? 'optimal' : r.ratio <= 1.5 ? 'caution' : 'dangerous';
    return { ratio: r.ratio, zone };
  } catch {
    return { ratio: 1, zone: 'optimal' };
  }
}

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
      const bbRep = replacePLForBB(ex.name, exGroupForPLMap(muscle));
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

  // Если есть explicit weeks — используем их дословно вместо сгенерированных из week1.
  // explicit weeks имеют ту же структуру что week1 (SRDaySpec[]), каждая неделя — свой набор дней.
  if (explicitWeeks && explicitWeeks.length > 0) {
    generatedWeeks.length = 0; // очищаем сгенерированные
    for (let w = 0; w < explicitWeeks.length; w++) {
      const weekNumber = w + 1;
      const isDeload = deloadWeeks.has(weekNumber);
      const srDays = explicitWeeks[w];
      // RIR для explicit-недели: берём из прогрессии если есть, иначе из meta
      const rirProgress = explicitWeeks.length > 1 ? w / (explicitWeeks.length - 1) : 0;
      const weekRir = Math.round(rirStart + (rirEnd - rirStart) * rirProgress);
      const volumeMult = isDeload ? 0.5 : 1.0; // explicit — без авто-прогрессии, уважаем источник
      const intensityMult = isDeload ? 0.7 : 1.0;

      const days: ProgramDay[] = srDays.map((srDay, dayIdx) => {
        const dayNum = dayIdx + 1;
        const dayName = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][dayIdx] || `День ${dayIdx + 1}`;
        const exercises = srDay.exercises.map(srEx => {
          const baseSet = srEx.sets?.[0];
          const basePct = baseSet?.pct ?? 0.6;
          const baseReps = baseSet?.reps ?? 10;
          const baseSets = baseSet?.sets ?? 3;
          const rirAdjustment = (3 - weekRir) * 0.025;
          const adjustedPct = Math.min(0.95, basePct + rirAdjustment);
          const finalPct = isDeload ? adjustedPct * 0.7 : adjustedPct;
          return {
            name: srEx.name,
            sets: baseSets,
            reps: String(baseReps),
            rpe: Math.round(10 - weekRir),
            rir: weekRir,
            restSec: srEx.load === 'Тяжелая' ? 180 : srEx.load === 'Средняя' ? 120 : 90,
            notes: srEx.load ? `Нагрузка: ${srEx.load}` : '',
            progression: `Неделя ${weekNumber} (explicit)`,
          };
        });
        return {
          day: dayNum,
          name: `${dayName} (нед ${weekNumber})`,
          focus: srDay.exercises.map(e => e.group).filter(Boolean).join(', ') || 'Полное тело',
          warmup: 'Общая разминка 5-10 мин + специфическая разминка',
          exercises,
          cooldown: 'Растяжение 5 мин',
        };
      });

      generatedWeeks.push({
        week: weekNumber,
        phase: isDeload ? 'deload' : weekNumber <= Math.ceil(explicitWeeks.length * 0.3) ? 'accumulation' :
          weekNumber <= Math.ceil(explicitWeeks.length * 0.7) ? 'intensification' : 'peaking',
        volumeMultiplier: volumeMult,
        intensityMultiplier: intensityMult,
        days,
        deload: isDeload,
      });
    }
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
  /** P1-7 (audit 2026-08): цель мезоцикла — для cross-mesocycle continuity (extractMesocycleProgression). */
  goal?: string;
  specialization?: boolean;
  /** Явное расписание блоков специализации (недели + цели 1-2 мышцы; [] = баланс). */
  specializationSchedule?: SpecializationBlock[];
  /** Фокус-группа (акцент +30% объём). */
  focusGroup?: string;
  /** Уровень атлета (для volume-landmarks валидации). */
  level?: string;
  /** Реальный тренировочный стаж; ограничивает enhanced-объём. */
  trainingYears?: number;
  /** Способность к bodyweight-упражнениям (подтягивания при отсутствии → pulldown). */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
  /** Доступное оборудование — фильтр отбора упражнений. */
  equipment?: string[];
  /** Режим адаптации: 'faithful' = цикл дословно (только safety-фильтры), 'adapt' = + слабые группы/фокус/пост-фаза. */
  mode?: 'faithful' | 'adapt';
  /** Единая методика порядка упражнений для всех BB-источников. */
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  /** Training focus для RIR-корректировки (Schoenfeld 2021, Roberts 2022). */
  trainingFocus?: BBTrainingFocus;
  /** P0-1: Пол атлета — female активирует gluteBoost ×1.2, female_glute_5 split. */
  sex?: 'male' | 'female';
  /** Явный контекст спортсмена (прозрачно, без скрытого изменения pipeline). */
  athleteMode?: AthleteMode;
  athleteContext?: AthleteContext;
  /** Recovery-метрики → MRV soft-cap (Helms 2022, Plews 2022, Watson 2022). */
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  /** Nutrition-метрики → MRV soft-cap (Helms 2022). */
  calorieSurplus?: number;
  proteinPerKg?: number;
  /** Eccentric overload multiplier (1.0=норма, 1.1-1.2=overload). Schoenfeld 2021. */
  eccentricMult?: number;
  /** Меньше многосуставных (кнопка): машина/Смит/поддержанные выше. */
  fewerCompound?: boolean;
  /** Разрешить силовые лифты (становая/жим стоя) — только в силовом цикле по кнопке. */
  allowStrengthLifts?: boolean;
  /** Режим вариативности упражнений (запрет/строгий/разнообразие). */
  rotationMode?: 'forbid' | 'strict' | 'variety';
  /** PRO: ограничения мобильности — фильтр упражнений по биомеханике. */
  mobilityRestrictions?: string[];
  /** Lab-based MRV multiplier. */
  labMrvMultiplier?: number;
  /** P1-7 (audit 2026-08): предыдущий мезоцикл — для cross-mesocycle continuity
   *  (auto-progress весов, ротация упражнений, объёмная прогрессия).
   *  Ранее не передавался в cycle/program пути — continuity работала только для generic split. */
  previousPlan?: BBPlan;
}

function muscleGroupFromExName(exName: string, catalog: typeof EXERCISE_CATALOG): string {
  const _l = (exName || '').toLowerCase();
  // Name-based overrides for cycle/SRC2 naming not matched exactly by the catalog.
  if (_l.includes("шраг")) return 'traps';
  if (_l.includes("француз") || _l.includes("узким хватом")) return 'triceps';
  if (_l.includes("разгиб") && _l.includes("головы")) return 'triceps';
  if (_l.includes("разгиб") && _l.includes("блок") && !_l.includes("ног")) return 'triceps';
  if (_l.includes("на прямых ногах")) return 'hamstrings';
  // ★ Legs granular: каталог использует композитную группу 'legs' для всех ног-упражнений.
  // Для профессионального порядка (quads compound первым, затем hamstrings, затем calves)
  // нужно различать: присед/жим ногами/выпад = quads, RDL/мёртвая = hamstrings, мост = glutes.
  if (/присед|squat|жим.*ног|leg.?press|выпад|lunge|болгар|разгибан.*ног|leg.?ext/i.test(_l) && !/румын|rdl|мёртв|stiff/i.test(_l)) return 'quads';
  if (/румын|rdl|мёртв|merтв|stiff|сгибан.*ног|leg.?curl|на прямых ногах|тяга.*прям/i.test(_l)) return 'hamstrings';
  if (/ягодичн|hip.?thrust|glute|мост/i.test(_l)) return 'glutes';
  if (/икры|подъём.*носк|подъем.*носк|calf/i.test(_l)) return 'calves';
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
  // P0-fix (критично): приоритетные проверки ДО broad-pattern, чтобы PL-движения
  // и triceps-доминантные жимы не попадали в chest/back-пулы ББ-плана.
  // 1. Close-grip / узкий хват → triceps (не chest; трицепс-доминантный жим)
  if (l.includes('узк') || l.includes('close') || l.includes('средн') && l.includes('хват')) return 'triceps';
  // 2. Overhead triceps extension / из-за головы → triceps (не chest)
  if (l.includes('из-за голов') || l.includes('overhead') && l.includes('tricep')) return 'triceps';
  // 3. PL-движения → null-маркер не подходит (функция возвращает string).
  //    Sumo/deficit/rack pull/pause DL — не для ББ; возвращаем 'back' как наименее
  //    плохой вариант (trueMuscleOf бы вернул null, но сигнатура не позволяет).
  //    Лучше: вызывающий код должен использовать trueMuscleOf напрямую.
  // 4. Становая (classic) — НЕ hamstrings в BB-контексте (PL-движение, trueMuscleOf=null).
  //    Раньше: l.includes('становая') → 'hamstrings' — включало deadlift в BB hamstrings-дни.
  //    Исправление: только Румынская/мёртвая на прямых ногах = hamstrings (см. ниже).
  // Плечи: махи, подъёмы перед собой / в стороны
  if (l.includes('махи') || l.includes('перед собой') || l.includes('в стороны') || l.includes('в сторону')) return 'shoulders';
  // Жимы на плечи
  if (l.includes('жим') && (l.includes('standing') || l.includes('сидя') || l.includes('армей') || l.includes('швунг') || l.includes('ohp') || l.includes('overhead'))) return 'shoulders';
  // Грудь: жимы + разведения (close-grip уже отловлен выше → triceps)
  if (l.includes('жим') || l.includes('bench') || l.includes('кроссовер') || l.includes('развод') || l.includes('сведен') || l.includes('press')) return 'chest';
  if (l.includes('пуловер')) return 'chest';
  // Спина: тяги + подтягивания (но не становая — она не растит широчайшие)
  // P0-fix: добавлены английские имена (row, pull-up, pulldown) — программы используют их.
  if ((l.includes('тяга') || l.includes('подтяг') || l.includes('шраг') || l.includes('row') || l.includes('pull') || l.includes('pulldown') || l.includes('chin')) && !l.includes('станов') && !l.includes('deadlift')) return 'back';
  if (l.includes('гиперэкстенз') || l.includes('наклон') && l.includes('штанг')) return 'back';
  // Ноги — квадрицепс (добавлены англ: squat, lunge)
  if (l.includes('присед') || l.includes('выпад') || l.includes('фронт') || l.includes('squat') || l.includes('lunge')) return 'quads';
  if (l.includes('разгиб') && !l.includes('трицепс') && !l.includes('француз')) return 'quads';
  // Ноги — бицепс бедра (только BB posterior chain: румынская, мёртвая на прямых ногах)
  if (l.includes('румын') || l.includes('мёртв') || l.includes('мертв') || l.includes('rdl')) return 'hamstrings';
  if (l.includes('на прямых ногах') || l.includes('stiff')) return 'hamstrings';
  // P0-fix: deadlift (англ.) — PL-движение. В BB-контексте конвертации лучше legs
  // (задняя цепь), чем default 'chest' (L412). trueMuscleOf бы вернул null, но
  // сигнатура возвращает string.
  if (l.includes('deadlift') || l.includes('станов')) return 'legs';
  if (l.includes('сгибан') && !l.includes('бицепс') && !l.includes('молотк') && !l.includes('запяст') && !l.includes('wrist') && !l.includes('предплеч') && !l.includes('ez') && !l.includes('ног') && !l.includes('leg')) return 'hamstrings';
  // Предплечья (ДО сгибан-проверки, иначе "Сгибания запястий" → hamstrings)
  if (l.includes('запяст') || l.includes('wrist') || l.includes('предплеч') || l.includes('forearm')) return 'forearms';
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
  // P2-fix: default was 'chest' which incorrectly applied chest MRV to unknown exercises.
  // 'core' is a safer neutral default — core MRV is high and rarely overflows.
  return 'core';
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

/**
 * P0-4 (audit 2026-08): применить eccentricMult к primary-упражнениям плана.
 * Ранее eccentricMult был объявлен в интерфейсах cycle-to-plan, но НИГДЕ не применялся —
 * UI передавал его, но движок игнорировал. eccentric overload (Schoenfeld 2021) требует
 * повышенного веса для primary compounds (1.1-1.2× от концентрического).
 * Паритет с bb-builder.engine.ts:1124-1125. */
function applyEccentricOverloadToPlan(plan: BBPlan, eccentricMult?: number): BBPlan {
  if (!eccentricMult || eccentricMult <= 1.0 || !Number.isFinite(eccentricMult)) return plan;
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        if (ex.role !== 'primary') continue;
        // Skip deload weeks (eccentric overload unsafe при разгрузке)
        if (w.phase === 'deload' || w.deload) continue;
        ex.workSets = (ex.workSets || []).map(ws => ({
          ...ws,
          weight: Math.round((ws.weight || 0) * eccentricMult * 10) / 10,
        }));
      }
    }
  }
  return plan;
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

  // L8 (Jul 21 update): нормализация имени — снимаем программные суффиксы ("5/3/1", "BBB",
  // "AMRAP", "(warm-up)", "(тяжелая)" и т.д.) для попадания в базовый regex-маппинг.
  // Без нормализации: "Жим стоя 5/3/1" / "Становая тяга BBB" остаются как ПЛ в ББ-плане.
  const stripped = n
    .replace(/\s+(5\s*\/\s*3\s*\/\s*1|bbb|amrap|размин|warm[- ]?up|тяжел|тяжёл|тяжёлая|тяжелая|средняя|лёгкая|лёг|легк|легкая)(?=\s|$)/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')    // удаляем parens "(...)"
    .replace(/\s+/g, ' ')
    .trim();
  const s = stripped || n; // fallback на оригинальное имя, если нормализация съела всё

  // Хингеры (RDL / Гудморнинг / наклон со штангой / обратная гипер) →
  // Румынская тяга (или Смита / одной ноге). ПЛ-классику (становую классику/сумо/дефицит/трап)
  // отдельно обрабатываем ниже.
  // Становая тяга → Тяга штанги в наклоне (если спина) или Румынская (если бицепс бедра).
  // Также покрывает варианты с суффиксами: "Становая тяга 5/3/1" → "станов" срабатывает,
  // а нормализация очищает имя до "Становая тяга" — основной regex ловит.
  // FIX legs-leak: `классич` совпадал с прилагательным «классические» (Отжимания классические,
  // Приседания классические) → они заменялись на «Румынская тяга» (ноги). Теперь требуем
  // «станов» в имени для классич/сумо/дефицит-вариаций становой. «трап» сужаем до «трап.?гриф»,
  // иначе совпадает с «трапеции» (shrugs помечены как traps).
  // P0-fix: BB posterior chain (RDL/румынская/мёртвая на прямых ногах/гудморнинг) —
  // это уже ББ-упражнения (trueMuscleOf=hamstrings), НЕ PL. Не заменяем их.
  // Раньше "Румынская становая тяга" ловилась как "станов" → заменялась на саму себя
  // или на "Тяга штанги в наклоне", теряя hamstrings-стимул.
  const isBBPosteriorChain = /румынск|rdl|мёртв.*найк|мёртв.*прям|stiff.?leg|гудмор|good.?morning|гиперэкстенз|обратн.*гипер|reverse.?hyper/i.test(s);
  const isDeadliftVariant = !isBBPosteriorChain && (/станова|станов/i.test(s) || /^станов/.test(s)
    || (/^(классич|сумо|дефицит|рывков|толчков)/.test(s) && /станова|станов|тяга|deadlift/i.test(s))
    || /трап.?гриф|trap.?bar/i.test(s)
    || /pendlay/i.test(s));
  if (isDeadliftVariant) {
    const g = (group || '').toLowerCase();
    if (g.includes('спин') || g === 'back' || g === 'спина') {
      return { name: 'Тяга штанги в наклоне', group: 'Спина' };
    }
    if (g.includes('бедр') || g.includes('ног') || g === 'legs' || g === 'хамст') {
      // Сумо/дефицит для ног → Румынская (более безопасная альтернатива).
      return { name: 'Румынская тяга', group: 'Ноги' };
    }
    if (g.includes('верх спины') || g.includes('трапец')) {
      // Snatch-grip DL → Тяга штанги в наклоне (больше широчайших).
      return { name: 'Тяга штанги в наклоне', group: 'Спина' };
    }
    // Дефолт: Румынская (hamstrings — задняя цепь).
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  // Жим стоя / армейский / OHP / швунг / push press → Жим гантелей сидя (не осевая, для ББ).
  // Покрывает варианты: "Жим стоя 5/3/1", "Жим стоя BBB", "Жим стоя (армейский)" и др.
  if (/жим стоя|армейск|ohp|жим над голов|швунг|push.?press|жимовой.?швунг/i.test(s)) {
    return { name: 'Жим гантелей сидя', group: 'Плечи' };
  }
  // Олимпийские: рывок/толчок/взятие — пропустить (нет ББ-аналога в шаблоне).
  if (n.includes('рывок') || n.includes('толчок') || n.includes('взятие на грудь')
      || n.includes('подъём на грудь') || n.includes('подъем на грудь')
      || n.includes('power clean') || n.includes('hang clean') || n.includes('power snatch')
      || n.includes('clean pull') || n.includes('muscle snatch')
      || n.includes('power jerk') || n.includes('split jerk') || n.includes('push jerk')
      || n.includes('clean and jerk') || n.includes('clean & jerk') || n.includes('jerk')) {
    return null;
  }
  // Пендл → Тяга штанги в наклоне.
  if (/пендл|pendlay/i.test(s)) {
    return { name: 'Тяга штанги в наклоне', group: 'Спина' };
  }
  // Good morning / Наклоны со штангой / Гудморнинг → Румынская тяга.
  // L8.1: "Наклоны" (без "со штангой") и "Нагруженные наклоны" → тоже GM → Румынская.
  // ВАЖНО: regex `наклон` совпадал с прилагательным «наклонной/наклонная/наклонные»
  // (Incline DB Press, Жим на наклонной, Сведение на наклонной, Сгибания на наклонной скамье)
  // → они ошибочно становились «Румынская тяга» (ноги), и нога-упражнения попадали в
  // Push/Chest-дни. Ограничиваем: совпадаем только с существительным «наклоны» (множ. число,
  // окончание -ы — не совпадает с прилагательными -ой/-ая/-ые/-ом/-ую) либо «наклон»
  // (единств.) с предлогом «со/с резин/с гант/с штанг» (= Good morning). Прилагательные
  // наклонной/наклонная/наклонные НЕ совпадают → наклонные жимы/разводки/сгибания остаются.
  if (/гудмор|good.?morning|наклоны|наклон\s+(?:со|с\s+(?:резин|гант|штанг))/i.test(s)) {
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  // Rack pull / тяга с плинт → Тяга штанги в наклоне.
  if (/rack.?pull|тяга с плинт/i.test(s)) {
    return { name: 'Тяга штанги в наклоне', group: 'Спина' };
  }
  // L8.2: Close-grip bench / жим средним хватом → Жим штанги лёжа узким хватом (трицепс-focus).
  // (Программы иногда пишут "Жим средним хватом" без "лёжа").
  // P0-fix: group 'Трицепс' (не 'Грудь') — close-grip это трицепс-доминантный жим,
  // trueMuscleOf возвращает triceps. Раньше 'Грудь' → попадал в chest MRV-кап.
  if (/средним хватом|узк|close.?grip|narrow.?grip/i.test(s)) {
    return { name: 'Жим штанги лёжа узким хватом', group: 'Трицепс' };
  }
  // L8.3: "Жим гантелей" без уточнения → каталог не содержит точное имя → DB bench press (грудь).
  // "Жим гантелей лёжа" / "Жим гантелей на наклонной" / "Жим гантелей сидя" — прямые имена,
  // найдутся в каталоге и пройдут как ББ (не требуют замены). Эвристика только для "голого" имени.
  if (s === 'жим гантелей' || s === 'жим с гантелями') {
    return { name: 'Жим гантелей лёжа', group: 'Грудь' };
  }
  // Фермерская прогулка / переноска → пропустить (не ББ).
  if (n.includes('фермерск') || n.includes('прогулка фермер') || n.includes('farmer walk')
      || n.includes('прогулка официант') || n.includes('waiter walk')
      || n.includes('yoke walk') || n.includes('прогулка с коромысл')) {
    return null;
  }
  // Паллоф / bird dog / планка (изометрика) → пропустить.
  if (n.includes('паллоф') || n.includes('pallof') || n.includes('bird dog') || n.includes('птица-собака')
      || n.includes('планк') && !n.includes('боков') || n.includes('plank') && !n.includes('side')) {
    return null;
  }
  // L8.4: Deficit DL / Pendlay / Snatch-grip / Paused / Trap-bar ещё раз по
  // ОРИГИНАЛЬНОМУ имени (на случай если нормализатор исказил).
  // FIX legs-leak: сужаем `классич`/`трап` как выше (требуется «станов»/«тяга» контекст).
  const rawN = (exName || '').toLowerCase().trim();
  // P0-fix: симметрично с основным блоком — пропускаем BB posterior chain.
  const isBBPosteriorChainRaw = /румынск|rdl|мёртв.*найк|мёртв.*прям|stiff.?leg|гудмор|good.?morning|гиперэкстенз|обратн.*гипер|reverse.?hyper/i.test(rawN);
  const isDeadliftVariantRaw = !isBBPosteriorChainRaw && (/станова|станов/i.test(rawN) || /^станов/.test(rawN)
    || (/^(классич|сумо|дефицит|рывков|толчков)/.test(rawN) && /станова|станов|тяга|deadlift/i.test(rawN))
    || /трап.?гриф|trap.?bar/i.test(rawN)
    || /pendlay/i.test(rawN));
  if (isDeadliftVariantRaw) {
    const g = (group || '').toLowerCase();
    if (g.includes('спин') || g === 'back' || g === 'спина') {
      return { name: 'Тяга штанги в наклоне', group: 'Спина' };
    }
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  if (/жим стоя|армейск|ohp/i.test(rawN)) {
    return { name: 'Жим гантелей сидя', group: 'Плечи' };
  }
  if (/гудмор|good.?morning|наклоны|наклон\s+(?:со|с\s+(?:резин|гант|штанг))/i.test(rawN)) {
    return { name: 'Румынская тяга', group: 'Ноги' };
  }
  return { name: exName, group };
}

/** Маппинг из канонического EN-ключа мышцы (chest/back/...) в человеко-читаемую группу,
 *  которую ожидает `replacePLForBB` (Грудь/Спина/Плечи/Ноги/Руки/Кор). */
function exGroupForPLMap(muscle: string): string {
  const m = (muscle || '').toLowerCase();
  if (m === 'chest') return 'Грудь';
  if (m === 'back') return 'Спина';
  if (m === 'shoulders') return 'Плечи';
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(m)) return 'Ноги';
  if (['biceps', 'triceps', 'forearms', 'arms'].includes(m)) return 'Руки';
  if (['abs', 'core'].includes(m)) return 'Кор';
  return 'Кор';
}

/** P2-7: Единая функция классификации sessionTag по составу мышц дня.
 *  Ранее дублировалась в 3 местах (lines ~975, ~1395, ~1705) с вариациями.
 *  Теперь — единый источник правды. */
function classifySessionTag(muscles: string[]): string {
  const s = new Set(muscles);
  const hasChest = s.has('chest'), hasBack = s.has('back'), hasShoulders = s.has('shoulders');
  const hasQuads = s.has('quads'), hasHams = s.has('hamstrings'), hasGlutes = s.has('glutes');
  const hasLegs = s.has('legs') || s.has('calves');
  const isLegs = hasQuads || hasHams || hasGlutes || hasLegs;
  const hasBi = s.has('biceps'), hasTri = s.has('triceps');
  if (hasChest && hasBack && !isLegs) return 'ChestBack';
  if (hasChest && hasTri && !hasBack && !isLegs) return 'Push';
  if (hasBack && hasBi && !hasChest && !isLegs) return 'Pull';
  if (hasShoulders && (hasBi || hasTri) && !hasChest && !hasBack && !isLegs) return 'ShouldersArms';
  if (hasChest && !hasBack && !isLegs) return 'Chest';
  if (hasBack && !hasChest && !isLegs) return 'Back';
  if (hasShoulders && !hasChest && !hasBack && !isLegs) return 'Shoulders';
  if ((hasBi || hasTri) && !hasChest && !hasBack && !isLegs && !hasShoulders) return 'Arms';
  if (isLegs && !hasChest && !hasBack) return 'Legs';
  if (hasChest && hasBack && isLegs) return 'FullBody';
  return 'FullBody';
}

/** Найти замену для исключённого/осевого упражнения из той же группы, с учётом угла.
 *  Пытается выбрать упражнение с ДРУГИМ углом, чем уже есть в дне (diversity). */
function findReplacementForCycle(exName: string, muscle: string, favNames: Set<string>, favIdSet: Set<string>, alreadyInDay: Set<string>): { name: string; group: string } | null {
  const cat = EXERCISE_CATALOG.find(e => e.name === exName);
  const group = cat?.group || 'chest';
  // Пул упражнений той же группы, не в дне
  const pool = EXERCISE_CATALOG.filter(e => e.group === group && e.name !== exName && !alreadyInDay.has(e.name));
  if (pool.length === 0) return null;
  // Приоритет 1: любимое (из той же группы)
  const favMatch = pool.find(e => favNames.has(e.name) || favIdSet.has(e.id));
  if (favMatch) return { name: favMatch.name, group };
  // Приоритет 2: тот же тип (compound→compound, isolation→isolation) — сохраняет характер упражнения
  const exType = cat?.type;
  if (exType) {
    const sameType = pool.find(e => e.type === exType);
    if (sameType) return { name: sameType.name, group };
  }
  // Приоритет 3: compound с ДРУГИМ углом/паттерном (разнообразие для базовых)
  const exAngle = classifyAngle(exName);
  const diffAngle = pool.find(e => e.type === 'compound' && classifyAngle(e.name) !== exAngle);
  if (diffAngle) return { name: diffAngle.name, group };
  // Приоритет 4: compound
  const compound = pool.find(e => e.type === 'compound');
  if (compound) return { name: compound.name, group };
  // Приоритет 5: любое
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
    cycle, workMax: inputWorkMax, peds = [], pedDoses, courseIntensity,
    loadStrategy = 'double_progression', injuries = [],
    intensityTechnique, autoDeload, deloadType, autoRegResult,
    favoriteExercises = [], excludedExercises = [], avoidAxialLoad = false,
    volumeGoal = 'mav', level = 'advanced', equipment = [],
  } = input;
  const mode = input.mode || 'adapt';
  const weakPoints = mode === 'faithful' ? [] : (input.weakPoints || []);
  const focusGroup = mode === 'faithful' ? '' : (input.focusGroup || '');
  const specialization = mode === 'faithful' ? false : (input.specialization || false);
  // Единый резолвер акцентов: focus/weak/specialization без стэкинга,
  // канонический top-2, specialization без слабых групп — no-op.
  const specRes = resolveSpecialization(focusGroup, weakPoints, specialization);
  const meta = cycle.meta;
  const totalWeeks = meta.weeks;
  // Расписание блоков специализации (методика: блок 6-10 нед → баланс/другие цели).
  const specSchedule = buildSpecializationSchedule(
    focusGroup, weakPoints, specialization, totalWeeks, input.specializationSchedule,
  );
  // P1-7 (audit 2026-08): cross-mesocycle continuity — auto-progress весов из предыдущего плана.
  // Применяется только в adapt режиме (faithful сохраняет цикл дословно).
  let workMax = inputWorkMax;
  if (mode === 'adapt' && input.previousPlan) {
    const progression = extractMesocycleProgression(input.previousPlan, level, input.goal || 'mass');
    workMax = applyWeightProgression(workMax, progression);
  }
  const daysPerWeek = meta.sessionsPerWeek;
  // L7: src2-* циклы имеют явную много-недельную разкладку (cycle.weeks[][]).
  // Если она есть и совпадает по длине с totalWeeks — используем каждую неделю дословно (multi-week faithful).
  const hasExplicitWeeks = !!(cycle as any).weeks && Array.isArray((cycle as any).weeks) && (cycle as any).weeks.length > 0;
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
  // Recovery multiplier from body composition + recovery metrics (Helms 2022, Plews 2022, Watson 2022).
  const recoveryMult = computeBBRecoveryMultiplier(input);
  const nutritionMult = computeBBNutritionMultiplier(input);
  const labMult = input.labMrvMultiplier ?? 1.0;
  const mrvMult = (pedAdapt.combinedMrvMultiplier || 1.0) * recoveryMult * nutritionMult * labMult;

  // volumeGoal scaling: MEV=0.7, MAV=1.0, MRV=1.15 (поверх шаблона).
  // Faithful: всегда 1.0 — не меняем объём программы.
  const volGoalMult = mode === 'faithful' ? 1.0 : (volumeGoal === 'mev' ? 0.70 : volumeGoal === 'mrv' ? 1.15 : 1.0);

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
  if (specSchedule.active) rationale.push(`🎯 Специализация (блоки): ${specializationScheduleText(specSchedule)}`);
  if (focusGroup) rationale.push(`⭐ Фокус-группа: ${focusGroup} (+30% объём)`);
  if (excludedExercises.length > 0) rationale.push(`🚫 Исключённые упражнения: ${excludedExercises.length} шт. — заменены на альтернативы`);
  if (favoriteExercises.length > 0) rationale.push(`⭐ Любимые упражнения: ${favoriteExercises.length} шт. — приоритет при замене`);
  rationale.push(`🎯 Источник упражнений: ПРОФ-цикл с фиксированными упражнениями (не автоподбор)`);
  rationale.push(`🛡 BB-фильтр: ПЛ/олимпийские упражнения автозаменены на ББ-альтернативы (становая→тяга в наклоне, жим стоя→жим сидя)`);

  // Build weeks
  const weeks: BBWeek[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    // Акценты НЕДЕЛИ по расписанию блоков специализации.
    const weekSpec = specResForWeekSchedule(specSchedule, w);
    // L7: для каждой недели берём дословный набор дней из tpl.weeks[w-1], если есть.
    const currentWeekDays = (hasExplicitWeeks && (cycle as any).weeks[w - 1]) ? (cycle as any).weeks[w - 1] : week1Days;
    const sessions: BBSession[] = currentWeekDays.map((daySpec: any, dayIdx: number) => {
      const seenNames = new Set<string>(); // дедупликация по имени внутри дня
      const exercises: BBExercise[] = (daySpec.exercises || []).map((exSpec: any) => {
        // ★ JUNK-фильтр: выбрасываем нерабочие «упражнения» (кардио, МФР, растяжка, etc.)
        const CYCLE_JUNK = /кардио|cardio|liss|hiit|мфр|foam.?roll|растяжк|stretch|мобильн|mobility|кошк.*корова|cat.?cow|практика|practice|стойк.*рук|handstand|выход.*сил|muscle.?up|вис.*полотен|вис.*гриф|вис.*турник|l.?сит|l.?sit|йога|yoga|отдых|rest|med.?ball|медбол|ходьб|walking|колесо|ab.?wheel|dead.?bug|мертв.*жук|русск.*твист|russian.*twist|горн.*ключ|mountain.*climb|супермен|superman|гусениц|inchworm|аллигатор|gator|птиц.*собак|bird.?dog|планк|plank|поворот|rotation|рубк|chop|wood/i;
        if (CYCLE_JUNK.test((exSpec.name || '').toLowerCase())) return null as any;
        const exGroup = exSpec.group || muscleGroupFromExName(exSpec.name, EXERCISE_CATALOG);
        // PL→BB замена — safety-фильтр, применяется в ОБИХ режимах (faithful/adapt).
        // ПЛ-упражнения (становая, жим стоя, рывок и др.) несовместимы с ББ-гипертрофией.
        const bbReplaced = replacePLForBB(exSpec.name, exGroup);
        if (bbReplaced === null) {
          // Пропустить упражнение (ПЛ/мусор без ББ-аналога)
          return null as any;
        }
        const bbExName = bbReplaced.name;
        // Дедупликация: если упражнение уже есть в этом дне — пропустить
        if (seenNames.has(bbExName)) return null as any;
        // JUNK-фильтр: проверить trueMuscleOf — пропустить если null (hinge/carry/junk).
        // L8: после replacePLForBB дополнительно фильтруем выжившие ПЛ-импонанты по trueMuscleOf
        // (def DL/sumo/deficit/Oly lift → null после фикса в movement-pattern.ts).
        const catCheck = EXERCISE_CATALOG.find(e => e.name === bbExName);
        if (catCheck && trueMuscleOf(catCheck) === null) return null as any;
        // Rear delt фильтр: не ставить rear delt в Push/Chest/Shoulders-дни
        const _tag = (daySpec as any)._sessionTag || '';
        const sessionTagLower = _tag.toLowerCase() || muscleGroupFromExName(bbExName, EXERCISE_CATALOG).toLowerCase();
        // Определить тип дня по упражнениям в дне
        const dayMuscles = (daySpec.exercises as any[]).map((ex: any) => muscleGroupFromExName(ex.name, EXERCISE_CATALOG));
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
        // Проверка: силовые лифты (становая/жим стоя) — только при allowStrengthLifts
        if (input.allowStrengthLifts !== true && /становая|сумо|армейск|жим стоя|швунг/.test(bbExName.toLowerCase())) {
          const rep = findReplacementForCycle(bbExName, muscleGroupFromExName(bbExName, EXERCISE_CATALOG), favNames, favIdSet, seenNames);
          if (rep) { finalExName = rep.name; } else { return null as any; }
        }
        // Проверка: меньше многосуставных (fewerCompound) → сместить к машинам/Смит/поддержанным
        if (input.fewerCompound) {
          const cat = EXERCISE_CATALOG.find(e => e.name === finalExName);
          const n = (finalExName || '').toLowerCase();
          if (cat && (/присед|squat|тяга.*штанг|тяга.*наклон|жим.*штанг/.test(n))) {
            const rep = findReplacementForCycle(finalExName, muscleGroupFromExName(finalExName, EXERCISE_CATALOG), favNames, favIdSet, seenNames);
            if (rep && /гакк|смит|жим ногами|тренаж|поддержан|на лавке|chest.?supported/.test(rep.name.toLowerCase())) finalExName = rep.name;
          }
        }
        // PRO: mobility restrictions — замена упражнений по биомеханике
        if (input.mobilityRestrictions && catEntry && isMobilityRestricted(catEntry, input.mobilityRestrictions)) {
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
        const exRir0 = computeRirForEx(w, totalWeeks, rirProg, phases);
        // Training focus RIR shift (Schoenfeld 2021, Roberts 2022): strength → harder (−1), endurance → easier (+1).
        const focusShift = input.trainingFocus
          ? (FOCUS_RIR_TABLE[input.trainingFocus].base - FOCUS_RIR_TABLE.hypertrophy.base)
          : 0;
        const exRir = Math.max(0, Math.min(5, exRir0 + focusShift));
        let isPrimary = isPrimaryByLoad(exSpec.load);
        if (isPrimary && isIsolationByName(finalExName)) { isPrimary = false; }
        let character: 'тяж' | 'памп' = exSpec.load === 'Тяжелая' ? 'тяж' : 'памп';
        if (!isPrimary && character === 'тяж') { character = 'памп'; }
        const workMaxVal = calcWorkMaxForEx(finalExName, workMax);
        const muscle = muscleGroupFromExName(finalExName, EXERCISE_CATALOG);
        // Пропускаем упражнения на исключённые мышцы (травмы)
        if (excludedMuscles.has(muscle)) return null as any;
        // Добавить в seen (дедупликация)
        seenNames.add(finalExName);
        // P0-3 (audit 2026-08): используем isWeak из bb-builder для маппинга гранулярных групп
        const isWeakMuscle = isSpecializationWeak(muscle, weekSpec);
        const isFocus = isSpecializationFocus(muscle, weekSpec);
        const isSubstituted = finalExName !== exSpec.name;

        // Volume boost: weak groups + PED adaptation + volumeGoal + specialization + focusGroup.
        // PED: primary × mrvMult, accessory × max(1, mrvMult×0.8) — как в buildBBPlan.
        // Faithful: pedFactor=1.0 — не меняем объём программы.
        const pedFactor = (mode === 'adapt' && peds.length > 0) ? (isPrimary ? mrvMult : Math.max(1.0, mrvMult * 0.8)) : 1.0;
        // Единый фактор акцентов НЕДЕЛИ (блок специализации или баланс):
        // focus ×1.3 / цель блока ×1.1 / weak ×1.2 / остальные ×0.7 — без
        // стэкинга (1.2×1.3) и без реза фокус-мышцы (0.7×1.3).
        const specFactor = specializationVolumeFactor(muscle, weekSpec);
        // focusGroup: +30% (входит в specFactor)
        const focusFactor = 1.0;
        // P0-1: female glute boost ×1.2 (как в buildBBPlan:590) —女性 glutes требуют большего объёма
        const femaleGluteBoost = (input.sex === 'female' && muscle === 'glutes') ? 1.2 : 1.0;
        // volumeGoal: MEV×0.7 / MAV×1.0 / MRV×1.15
        const setMult = specFactor * pedFactor * volGoalMult * focusFactor * femaleGluteBoost;
        const baseSets = exSpec.sets[0]?.sets || 3;
        let targetSets = Math.max(1, Math.round(baseSets * setMult));
        // Минимум 2 сета для любого упражнения (ББ-практика)
        if (targetSets < 2) targetSets = 2;
        // PED arm boost (как в buildBBPlan): arms/shoulders ×1.4 при mrvMult≥1.3
        if (mode === 'adapt' && mrvMult >= 1.3 && ['triceps', 'biceps', 'shoulders', 'forearms'].includes(muscle)) {
          targetSets = Math.round(targetSets * 1.4);
        }
        // MRV cap (как в buildBBPlan normalizeWeekMrv): не превышать MRV×mrvMult.
        // Parity с generic: кап цели специализации поднимается specMrv (weak ×1.2,
        // focus ×1.3), иначе буст акцента недели стирается капом.
        if (mode === 'adapt') {
          const lm = (allLandmarks as any)[muscle];
          if (lm && lm.mrv) {
            const mrvCap = Math.round(lm.mrv * mrvMult * specializationMrvFactor(muscle, weekSpec));
            targetSets = Math.min(targetSets, mrvCap);
          }
        }

        // RIR: weak groups get 0.5 harder
        const effectiveRir = isWeakMuscle ? Math.max(0, exRir - 1) : exRir;
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
          comment: `${isPrimary ? '🎯 Основное' : '📌 Добивочное'}: ${muscle}. ${targetSets}×${targetReps} @${Math.round(workMaxVal * pct)}кг, RIR ${effectiveRir}.${isSubstituted ? ' ⚠ Замена (было: ' + exSpec.name + ').' : ''}${isFocus ? ' ⭐ Фокус.' : ''} ${formatExerciseInstructions({ exerciseName: finalExName, muscle, role: isPrimary ? 'primary' : 'accessory', trainingFocus: input.trainingFocus, restSeconds })}`,
          executionProfile: buildExerciseInstructions({ exerciseName: finalExName, muscle, role: isPrimary ? 'primary' : 'accessory', trainingFocus: input.trainingFocus, restSeconds }),
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
      // Determine session tag from actual exercises (BEFORE tidy, so tidy can use it)
      const dayMuscles = [...new Set(exercises.map(e => e.muscle))];
      const sessionTag = classifySessionTag(dayMuscles);
      // Determine session character from exercises
      const hasHeavy = exercises.some(e => e.character === 'тяж');
      // Faithful: сохраняем оригинальный порядок программы (не переупорядочиваем).
      // Adapt: tidy с sessionTag → orderSessionExercises ставит lead-muscle compound первым.
      if (mode !== 'faithful') {
        const _tidy = tidySessionExercises(exercises, undefined, sessionTag);
        exercises.length = 0; exercises.push(..._tidy);
      }
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
      const protocol = DELOAD_PROTOCOLS[deloadType || 'pump'];
      const deloadWeek = applyDeloadToWeek({ week: w, sessions }, protocol);
      sessions.splice(0, sessions.length, ...deloadWeek.sessions);
      rationale.push(`🔋 Разгрузка нед ${w}: ${protocol.description} — ${protocol.instructions}`);
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

  rationale.push(SESSION_TIDY_RATIONALE);
  let finalPlan: BBPlan = { pattern, weeks, rotationMuscleVolume, rationale };

  // L8: ACWR из реальных sRPE-сессий пользователя (PED-логика первого режима):
  // mode 1 (buildBBPlan) рассчитывает acwrRatio = computeAcwr() и подаёт в
  // applyPostPhaseProcessing → авто-делод при >1.5. Mode 2 раньше передавал acwrRatio=1
  // (хардкод) → авто-делод никогда не срабатывал. Теперь — единый расчёт.
  const acwrInfo = computeAcwrCyclePlan();
  const acwrRatio = acwrInfo.ratio;
  if (acwrRatio > 1.3) {
    rationale.push(`⚠ ACWR=${acwrRatio.toFixed(2)} (${acwrInfo.zone}) → план может потребовать разгрузочной недели`);
  }

  // Применяем пост-обработку (техники/авто-делод/загрузка/авторег) — как в buildBBPlan.
  // Только в adapt: faithful сохраняет программу как есть (без изменения объёма/RIR/делода).
  // ACWR-warning показывается в обоих режимах (см. выше).
  if (mode === 'adapt' && ((intensityTechnique && intensityTechnique !== 'none') || weakPoints.length > 0 || loadStrategy || autoDeload || autoRegResult)) {
    finalPlan = applyPostPhaseProcessing({
      plan: finalPlan,
      totalWeeks,
      workMax,
      loadStrategy: loadStrategy as LoadStrategy,
      autoDeload,
      deloadType,
      acwrRatio, // ← теперь единый расчёт ACWR с mode 1
      autoRegResult,
      skipPhaseRedistribution: true,
      intensityTechnique: intensityTechnique && intensityTechnique !== 'none' ? intensityTechnique : undefined,
      weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
    });
  }

  // Plan-vs-fact feedback is shared with generic BB generation. Faithful
  // intentionally remains source-preserving; adapt consumes the same diary
  // data and double-progression strategy as the generic path.
  if (mode === 'adapt') {
    const workoutSessions = loadWorkoutSessions();
    if (workoutSessions.length > 0) {
      finalPlan = applyFeedbackToBuild(finalPlan, workoutSessions, workMax, loadStrategy as LoadStrategy);
      const plateau = autoReplaceOnPlateau(finalPlan, workoutSessions);
      if (plateau.changes.length > 0) {
        finalPlan = plateau.plan;
        rationale.push(...plateau.changes);
      }
    }
  }

  // Volume-landmarks (единый источник, как в generic split)
  const pedMrvMult = pedAdapt.combinedMrvMultiplier ?? 1;
  // P0-4 (audit 2026-08): применяем eccentricMult к primary-упражнениям
  finalPlan = applyEccentricOverloadToPlan(finalPlan, input.eccentricMult);
  // 🔁 Донорское перераспределение специализации (adapt): слой поверх
  // рассчитанного объёма, базовые коэффициенты не меняются.
  if (mode === 'adapt' && specSchedule.active) {
    const tradeoffMrvByMuscle: Record<string, number> = {};
    // Parity с generic (bb-builder mrvByMuscle): капы целей специализации
    // поднимаются specMrv (weak ×1.2 / focus ×1.3) — иначе перенос объёма
    // в цель упирался бы в базовый MRV и «съедался» капом переноса.
    const tradeoffTargets = Array.from(new Set(specSchedule.blocks.flatMap(b => b.targets)));
    const tradeoffSpecRes = { targets: tradeoffTargets, focus: specSchedule.focus, weak: tradeoffTargets, active: tradeoffTargets.length > 0 };
    for (const [m, lm] of Object.entries(allLandmarks)) {
      tradeoffMrvByMuscle[m] = Math.round((lm as any).mrv * mrvMult * specializationMrvFactor(m, tradeoffSpecRes));
    }
    const capLevel = String(level);
    const tradeoffReports = applyTradeoffToPlan(
      finalPlan,
      w => tradeoffForWeek(specSchedule, w),
      w => specResForWeekSchedule(specSchedule, w).targets,
      {
        level,
        mrvByMuscle: tradeoffMrvByMuscle,
        workMax,
        equipment,
        maxExercisesPerSession: centralizedSessionLimits({ level: capLevel, trainingYears: input.trainingYears }).maxExercises,
        maxWorkingSetsPerSession: centralizedSessionLimits({ level: capLevel, trainingYears: input.trainingYears }).maxWorkingSets,
      },
    );
    for (const report of tradeoffReports) {
      if (report.removedSets > 0 || report.transferredSets > 0) {
        rationale.push(`🔁 Донорское перераспределение (нед ${report.week}): доноры [${report.donors.join(', ')}] — снято ${report.removedSets} сетов, перенесено ${report.transferredSets}, не использовано ${report.unusedSets}${report.notes.length ? ` (${report.notes.join('; ')})` : ''}.`);
      }
    }
  }
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

  const finalized = finalizeBBPlan({
    ...finalPlan,
    volumeLandmarks,
    muscleFrequency,
    // Контекст специализации/лимитов сохраняется для повторной финализации.
    specializationSchedule: specSchedule,
    priorityMuscles: [...new Set([...weakPoints, ...specSchedule.blocks.flatMap(b => b.targets), ...(focusGroup ? [focusGroup] : [])])],
    mrvMultiplier: mrvMult,
    maxWorkingSets: centralizedSessionLimits({ level, trainingYears: input.trainingYears }).maxWorkingSets,
    maxExercises: centralizedSessionLimits({ level, trainingYears: input.trainingYears }).maxExercises,
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    mobilityRestrictions: input.mobilityRestrictions,
  }, {
    reorder: mode !== 'faithful',
    priorityMuscles: [...new Set([...weakPoints, ...specSchedule.blocks.flatMap(b => b.targets), ...(focusGroup ? [focusGroup] : [])])],
    specializationSchedule: specSchedule,
    methodology: input.methodology,
    level,
    volumeGoal,
    // Phase invariants are safety checks, not an adaptive rewrite. Faithful
    // keeps exercise selection/order but still receives deload validation.
    phaseSafety: true,
    controlledRotation: mode !== 'faithful',
    equipment,
    excludedExercises,
    avoidAxialLoad,
    excludedMuscles: [...excludedMuscles],
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    mobilityRestrictions: input.mobilityRestrictions,
    ensureMinimumVolume: mode !== 'faithful',
    workMax,
    mrvMultiplier: mrvMult,
    checkOrder: mode !== 'faithful',
    preserveSource: mode === 'faithful',
    trainingYears: input.trainingYears,
    bodyweightCapability: input.bodyweightCapability,
  });
  if (input.athleteContext) {
    finalized.athleteMode = input.athleteMode ?? 'standard';
    finalized.athleteContext = input.athleteContext;
  }
  return finalized;
}

// ──────────────────────────────────────────────────────────────────────
// DIRECT CONVERTER: FullProgram → BBPlan (FAITHFUL MODE).
// Использует ВСЕ недели из program.weeks[], сохраняя реальную прогрессию,
// RIR/множители/фазы (!), warmup/rest/reps/notes/progression каждого упражнения.
// Не пересоздаёт недели из week1 — это устраняет искажение готовых программ.
// ──────────────────────────────────────────────────────────────────────

export interface ProgramToBBPlanOpts {
  workMax: Record<string, number>;
  weakPoints?: string[];
  focusGroup?: string;
  injuries?: Injury[];
  intTechnique?: IntensityTechnique;
  autoDeload?: boolean;
  deloadType?: DeloadType;
  loadStrategy?: LoadStrategy;
  autoRegResult?: { volumeMultiplier: number; topSetPctMultiplier: number; rirShift: number };
  favoriteExercises?: string[];
  excludedExercises?: string[];
  avoidAxialLoad?: boolean;
  equipment?: string[];
  peds?: PED[];
  pedDoses?: Record<string, number>;
  courseIntensity?: CourseIntensity;
  level?: string;
  trainingYears?: number;
  /** Способность к bodyweight-упражнениям (подтягивания при отсутствии → pulldown). */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
  volumeGoal?: BBVolumeGoal;
  specialization?: boolean;
  /** Явное расписание блоков специализации (недели + цели 1-2 мышцы; [] = баланс). */
  specializationSchedule?: SpecializationBlock[];
  /** Режим адаптации: 'faithful' = программа дословно (только safety-фильтры), 'adapt' = + добивка слабых групп */
  mode?: 'faithful' | 'adapt';
  /** Единая методика порядка упражнений для всех BB-источников. */
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  trainingFocus?: BBTrainingFocus;
  /** P0-1: Пол атлета — female активирует gluteBoost ×1.2, female_glute_5 split. */
  sex?: 'male' | 'female';
  /** Явный контекст спортсмена (прозрачно, без скрытого изменения pipeline). */
  athleteMode?: AthleteMode;
  athleteContext?: AthleteContext;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  /** Nutrition-метрики → MRV soft-cap (Helms 2022). */
  calorieSurplus?: number;
  proteinPerKg?: number;
  /** Eccentric overload multiplier (1.0=норма, 1.1-1.2=overload). Schoenfeld 2021. */
  eccentricMult?: number;
  /** Меньше многосуставных (кнопка): машина/Смит/поддержанные выше. */
  fewerCompound?: boolean;
  /** Разрешить силовые лифты (становая/жим стоя) — только в силовом цикле по кнопке. */
  allowStrengthLifts?: boolean;
  /** Режим вариативности упражнений (запрет/строгий/разнообразие). */
  rotationMode?: 'forbid' | 'strict' | 'variety';
  /** PRO: ограничения мобильности — фильтр упражнений по биомеханике. */
  mobilityRestrictions?: string[];
  labMrvMultiplier?: number;
  /** P1-7 (audit 2026-08): предыдущий мезоцикл — для cross-mesocycle continuity. */
  previousPlan?: BBPlan;
}

function parseReps(repsStr: string | undefined): number {
  if (!repsStr) return 8;
  const s = String(repsStr).trim();
  if (/^(amrap|max|\d\+)$/i.test(s)) return 5;
  const slash = s.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  if (slash) return parseInt(slash[1], 10); // For 5/3/1 — primary rep = first (5)
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
  // L10: суперсет reps '12+12' → берём максимум (12), иначе теряем 2-ю часть
  // L11: '15+AMRAP' / '5+AMRAP' / '5+BP' → AMRAP (5 reps, маркер /i)
  if (/^\d+\+\s*amrap$/i.test(s)) return parseInt(s, 10);
  if (/^\d+\+\d+$/.test(s)) return parseInt(s.split('+')[1], 10); // '12+12' → 12
  const first = s.match(/(\d+)/);
  if (first) return parseInt(first[1], 10);
  return 8;
}

function parseRepsRange(repsStr: string | undefined): [number, number] {
  if (!repsStr) return [8, 12];
  const s = String(repsStr).trim();
  if (/^(amrap|max|\d\+)$/i.test(s)) return [4, 10];
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  const slash = s.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  if (slash) return [parseInt(slash[3], 10), parseInt(slash[1], 10)];
  const first = s.match(/(\d+)/);
  if (first) { const v = parseInt(first[1], 10); return [v, v]; }
  return [8, 12];
}

/**
 * FAITHFUL-PARSER: парсит notes/reps/sets/rir/rpe упражнений из FullProgram
 * и возвращает массив work-sets с явным pct (если найдено в notes) или fallback (PCT_FOR_RIR).
 *
 * Поддерживаемые форматы notes:
 *   "65%×5, 75%×5, 85%×5+ (AMRAP)" — 3 разных подхода с разными pct/reps (5/3/1 style)
 *   "50-60% TM", "40-60% TM"        — диапазон pct для BBB подсобки
 *   "70% 1RM"                       — единый pct
 * Если pct не найден — fallback к PCT_FOR_RIR[rir] × intMult недели.
 *
 * Возвращает work-sets массив (1-to-N) для прогрессивной或多-set одной схемой.
 */
interface WorkSetSpec {
  pct: number;   // доля 1RM (0..1)
  reps: number;  // повторения в сете
  rir: number;   // RIR (если не указан — берём из упражнения)
  amrap?: boolean;
  restSec?: number;
}

function parseWorkSetSpecs(
  ex: { name: string; sets: number; reps: string; rpe?: number; rir?: number; restSec?: number; notes?: string; progression?: string },
  totalSets: number,
  rirDefault: number,
  intMultWeek: number,
): WorkSetSpec[] {
  const notes = (ex.notes || '') + ' ' + (ex.progression || '');
  const result: WorkSetSpec[] = [];

  // 1) Найти в notes явные pct-схемы: "65%×5", "75% × 5", "65% x 5", "65% 5,"
  //    Поддерживаем "+AMRAP" / "5+" / "max" для финального подхода.
  const pattern = /(\d+(?:\.\d+)?)\s*%\s*[×x*\-]\s*(\d+)(\+)?/gi;
  const matches: { pct: number; reps: number; amrap: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(notes)) !== null) {
    matches.push({
      pct: parseFloat(m[1]) / 100,
      reps: parseInt(m[2], 10),
      amrap: !!m[3] || /amrap|max/i.test(notes.slice(m.index, m.index + 40)),
    });
  }
  if (matches.length > 0) {
    // Использовать pct-схему напрямую; если matches.length === totalSets — отлично.
    // Если matches.length < totalSets — добить последним pct дополнительно.
    for (let i = 0; i < totalSets; i++) {
      const spec = matches[Math.min(i, matches.length - 1)];
      result.push({
        pct: spec.pct,
        reps: spec.reps,
        rir: ex.rir ?? Math.max(0, 10 - (ex.rpe ?? 8)) ?? rirDefault,
        amrap: spec.amrap,
        restSec: ex.restSec,
      });
    }
    return result;
  }

  // 2) Диапазон pct в notes: "50-60% TM" → несколько подходов одинаковым pct (max из диапазона)
  const rangePattern = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*%[^×x*\-]/i;
  const rm = notes.match(rangePattern);
  if (rm) {
    const pctMax = parseFloat(rm[2]) / 100;
    const reps = parseReps(ex.reps);
    for (let i = 0; i < totalSets; i++) {
      result.push({
        pct: pctMax,
        reps,
        rir: ex.rir ?? Math.max(0, 10 - (ex.rpe ?? 7)) ?? rirDefault,
        restSec: ex.restSec,
      });
    }
    return result;
  }

  // 3) Простой pct: "70% 1RM", "60% TM"
  const simplePct = notes.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tm|1rm|1rm)?\b/i);
  if (simplePct) {
    const pct = parseFloat(simplePct[1]) / 100;
    const reps = parseReps(ex.reps);
    for (let i = 0; i < totalSets; i++) {
      result.push({
        pct,
        reps,
        rir: ex.rir ?? Math.max(0, 10 - (ex.rpe ?? 7)) ?? rirDefault,
        restSec: ex.restSec,
      });
    }
    return result;
  }

  // 4) Reps как схема: "5/3/1" → три подхода 5/3/1 с pct из rir (RIR-based)
  const repsStr = String(ex.reps || '').trim();
  const slashScheme = repsStr.match(/^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/);
  if (slashScheme && totalSets === 3) {
    const repsArr = [parseInt(slashScheme[1], 10), parseInt(slashScheme[2], 10), parseInt(slashScheme[3], 10)];
    // 5/3/1: RIR для схем — обычно RIR 1-2; веса же ~65/75/85/95% (используем прогрессию RIR-based)
    const rirFor5 = ex.rir ?? 2;
    const pctFor5 = PCT_FOR_RIR[rirFor5] ?? 0.90;
    const pctProgress = [pctFor5 * 0.78, pctFor5 * 0.86, pctFor5 * 0.94]; // ≈ 70/77/85%
    for (let i = 0; i < 3; i++) {
      result.push({
        pct: pctProgress[i],
        reps: repsArr[i],
        rir: Math.max(0, rirFor5 - (i === 2 ? 1 : 0)), // финальный подход — RIR 1
        amrap: i === 2,
        restSec: ex.restSec,
      });
    }
    return result;
  }

  // 5) Fallback: единый pct из RIR (PCT_FOR_RIR[rir]) × intMult недели
  const rir = ex.rir ?? Math.max(0, 10 - (ex.rpe ?? 8)) ?? rirDefault;
  const pctBase = PCT_FOR_RIR[rir] ?? 0.82;
  const pctFinal = Math.max(0.3, Math.min(1.0, pctBase * intMultWeek));
  const reps = parseReps(ex.reps);
  for (let i = 0; i < totalSets; i++) {
    result.push({ pct: pctFinal, reps, rir, restSec: ex.restSec });
  }
  return result;
}

/** warmup parsing: "3 ramp-up sets per exercise" → ramp 30/60/80% */
function parseWarmup(workWeight: number, dayWarmup: string | undefined): { load: number; reps: number }[] {
  const wu: { load: number; reps: number }[] = [];
  if (!dayWarmup || workWeight <= 0) return wu;
  // Если heat weight указан — строим ramp по % рабочего веса
  const steps = workWeight <= 60 ? 2 : workWeight <= 100 ? 3 : 4;
  for (let i = 1; i <= steps; i++) {
    const pct = 0.30 + 0.55 * (i / steps);
    wu.push({ load: Math.round(workWeight * pct), reps: Math.min(8, 5 + i) });
  }
  return wu;
}

export function programToBBPlan(program: FullProgram, opts: ProgramToBBPlanOpts): BBPlan {
  const mode = opts.mode || 'adapt';
  const totalWeeks = program.weeks.length;
  const daysPerWeek = program.daysPerWeek;
  const level = opts.level || 'intermediate';
  // P1-7 (audit 2026-08): cross-mesocycle continuity — auto-progress весов из предыдущего плана.
  // Применяется только в adapt режиме (faithful сохраняет программу дословно).
  let workMax = opts.workMax || {};
  if (mode === 'adapt' && opts.previousPlan) {
    const progression = extractMesocycleProgression(opts.previousPlan, level, 'mass');
    workMax = applyWeightProgression(workMax, progression);
  }
  const weakPoints = mode === 'faithful' ? [] : (opts.weakPoints || []);
  const focusGroup = mode === 'faithful' ? undefined : opts.focusGroup;
  // Единый резолвер акцентов (program-путь): без стэкинга, канонический top-2.
  const specRes = resolveSpecialization(focusGroup, weakPoints, opts.specialization);
  // Расписание блоков специализации (методика: блок 6-10 нед → баланс/другие цели).
  const specSchedule = buildSpecializationSchedule(
    focusGroup, weakPoints, opts.specialization, totalWeeks, opts.specializationSchedule,
  );
  const excludedMuscles = getExcludedMuscles(opts.injuries || [], new Date().toISOString().slice(0, 10));
  const gradedInjuries = getGradedInjuries(opts.injuries || [], new Date().toISOString().slice(0, 10));
  const exclIds = new Set(opts.excludedExercises || []);
  const favIds = new Set(opts.favoriteExercises || []);
  // favoriteExercises могут быть id или именами — строим множество имён для приоритета при замене.
  const favNames = new Set<string>((opts.favoriteExercises || []).flatMap(id => { const cat = EXERCISE_CATALOG.find(e => e.id === id); return cat ? [cat.name] : [id]; }));
  const eqList = opts.equipment || [];
  const avAxial = opts.avoidAxialLoad || false;

  // PED adaptation для MRV-кап (добивка слабых групп не превышает MRV)
  const levelForLandmarks = (['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'intermediate') as 'beginner' | 'intermediate' | 'advanced';
  const allLandmarks = getAllVolumeLandmarks(levelForLandmarks);
  const landmarks = Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]));
  const pedAdapt = adaptForPEDs(opts.peds || [], landmarks, opts.pedDoses, opts.courseIntensity);
  const mrvMult = pedAdapt.combinedMrvMultiplier || 1.0;
  const recoveryMult = computeBBRecoveryMultiplier(opts);
  const nutritionMult = computeBBNutritionMultiplier(opts);
  const effectiveMrvMult = mrvMult * recoveryMult * nutritionMult * (opts.labMrvMultiplier ?? 1);
  const pedMrvMult = effectiveMrvMult;

  const rationale: string[] = [];
  rationale.push(`📚 Программа: ${program.name} (${program.author})`);
  rationale.push(`📅 ${totalWeeks} нед, ${daysPerWeek}×/нед, уровень ${program.level}`);
  rationale.push(`🎯 Цель: ${program.goal}${program.direction && program.direction !== program.goal ? ` (${program.direction})` : ''}`);
  if (program.progressionModel) rationale.push(`📈 Прогрессия: ${program.progressionModel}`);
  if (program.deloadProtocol) rationale.push(`🔋 Разгрузка: ${program.deloadProtocol}`);
  if (mode === 'faithful') rationale.push(`🔒 Режим: Точно по программе (прогрессия/RIR/warmup сохранены дословно)`);
  else rationale.push(`🔧 Режим: Адаптация (структура программы сохранена + добивка слабых групп)`);
  if (weakPoints.length > 0) rationale.push(`🔥 Слабые группы (+accessory добивка): ${weakPoints.join(', ')}`);
  if (specSchedule.active) rationale.push(`🎯 Специализация (блоки): ${specializationScheduleText(specSchedule)}`);
  if (focusGroup) rationale.push(`⭐ Фокус-группа (+30% объём): ${focusGroup}`);
  if (excludedMuscles.size > 0) rationale.push(`⚠ Исключены мышцы (травма): ${[...excludedMuscles].join(', ')}`);
  if (opts.peds && opts.peds.length > 0) rationale.push(`💉 PED: MRV ×${mrvMult.toFixed(2)}`);
  if (opts.avoidAxialLoad) rationale.push(`🦴 Без осевой нагрузки`);

  // Build weeks — все недели из program.weeks[] напрямую (faithful)
  const weeks: BBWeek[] = [];
  for (let wIdx = 0; wIdx < program.weeks.length; wIdx++) {
    const pw = program.weeks[wIdx];
    const weekNum = pw.week || (wIdx + 1);
    // Акценты НЕДЕЛИ по расписанию блоков специализации.
    const weekSpec = specResForWeekSchedule(specSchedule, weekNum);
    const isDeload = !!pw.deload;
    const volMult = pw.volumeMultiplier ?? 1.0;
    const intMult = pw.intensityMultiplier ?? 1.0;

    const sessions: BBSession[] = [];
    for (let dIdx = 0; dIdx < pw.days.length; dIdx++) {
      const pd = pw.days[dIdx];
      if (!pd.exercises || pd.exercises.length === 0) continue;
      const musclesInDay = pd.exercises.map(e => muscleGroupFromExName(e.name, EXERCISE_CATALOG));
      // Determine primary muscle of day (first muscle appearing with RPE >= 8 or just first exercise)
      const firstExerciseMuscle = musclesInDay[0] || 'chest';
      let sessionTag = classifySessionTag(musclesInDay);
      const hasHeavy = pd.exercises.some(e => (e.rpe || 7) >= 8);

      // Track per-muscle первичного упражнения — для primary/accessory роли
      const seenMusclesPrimary = new Set<string>();
      const exercises: BBExercise[] = [];
      // L12: очередь суперсет-пар для добавления в конец дня (чтобы не сломать порядок)
      const pendingSupersets: { rightName: string; leftName: string; exIdx: number }[] = [];

      // ★ JUNK-фильтр: выбрасываем нерабочие «упражнения» — кардио, МФР, растяжка, мобильность,
      // практика стоек/выходов, висы, йога, кошка-корова, колесо пресса, dead bug,
      // русский твист, горный ключ, медбол и т.д. Скручивания на пресс (crunches) — НЕ мусор,
      // это легитимное ab-упражнение, оставляем.
      const BB_JUNK_NAME = /кардио|cardio|liss|hiit|мфр|foam.?roll|растяжк|stretch|мобильн|mobility|кошк.*корова|cat.?cow|практика|practice|стойк.*рук|handstand|выход.*сил|muscle.?up|вис.*полотен|вис.*гриф|вис.*турник|l.?сит|l.?sit|йога|yoga|отдых|rest|med.?ball|медбол|ходьб|walking|скольжен.*стен|wall.?slide|медицинск|колесо|ab.?wheel|dead.?bug|мертв.*жук|русск.*твист|russian.*twist|горн.*ключ|mountain.*climb|супермен|superman|гусениц|inchworm|аллигатор|gator|птиц.*собак|bird.?dog|планк|plank|поворот|rotation|рубк|chop|wood/i;
      const bbFiltered = pd.exercises.filter(e => !BB_JUNK_NAME.test((e.name || '').toLowerCase()));

      for (let eIdx = 0; eIdx < bbFiltered.length; eIdx++) {
        let ex = bbFiltered[eIdx];
        let muscle = muscleGroupFromExName(ex.name, EXERCISE_CATALOG);
        if (excludedMuscles.has(muscle)) continue;

        // L12: парсить `+` notation в суперсетах. Исходная запись `Суперсет: Жим + Тяга` —
        // ищется в EXERCISE_CATALOG целиком, не находится, выкидывается. Здесь:
        // если name содержит `+` или `Суперсет:` — разбиваем на 2 упражнения.
        const isSupersetName = /суперсет|superset/i.test(ex.name) || (ex.name.includes(' + ') && ex.name.length > 12);
        if (isSupersetName) {
          // L12.1 (legs-leak): раньше sepIdx считался на исходной строке, а slice(0, sepIdx)
          // применялся к строке ПОСЛЕ replace("Суперсет: " удалён) — sepIdx не совпадал,
          // leftName обрезался (например "Молотки + Разгиба" вместо "Молотки"). Теперь
          // сначала replace, потом ищем ' + ' в уже очищенной строке.
          const cleaned = ex.name.replace(/^.*?суперсет\s*[:—\-]?\s*/i, '').trim();
          const sepIdx = cleaned.indexOf(' + ');
          if (sepIdx > 0) {
            const leftName = cleaned.slice(0, sepIdx).trim();
            const rightName = cleaned.slice(sepIdx + 3).trim();
            if (leftName && rightName) {
              // Заменяем ex на первое упражнение, потом добавим второе в конец дня.
              ex = { ...ex, name: leftName, notes: (ex.notes || '') + ' [Суперсет с: ' + rightName + ']' };
              muscle = muscleGroupFromExName(leftName, EXERCISE_CATALOG);
              // Запоминаем в sessionTags для добавления после
              pendingSupersets.push({ rightName, leftName, exIdx: exercises.length });
            }
          }
        }

        // L8: PL→BB-замена (стандартизация для BB-auto). Покрывает "Жим стоя 5/3/1",
        // "Становая тяга BBB", "Наклоны", "Жим гантелей" (без уточнения) и др.
        // Раньше программы сохраняли ПЛ-имена дословно → в BB-плане появлялись жимы стоя,
        // становые тяги без альтернативы. Теперь — единая замена через replacePLForBB.
        {
          const exGroup = exGroupForPLMap(muscle);
          const bbRep = replacePLForBB(ex.name, exGroup);
          if (!bbRep) continue; // ПЛ/олимпийский/мусор без ББ-аналога — пропускаем
          if (bbRep.name !== ex.name) {
            const originalName = ex.name;
            ex = { ...ex, name: bbRep.name };
            muscle = muscleGroupFromExName(bbRep.name, EXERCISE_CATALOG);
            ex = { ...ex, notes: (ex.notes ? ex.notes + '. ' : '') + '⚠ Замена ПЛ→ББ: ' + originalName + ' → ' + bbRep.name };
          }
        }

        // Find catalog entry (for safety filters)
        const catEntry = EXERCISE_CATALOG.find(e => e.name === ex.name);
        const catId = catEntry?.id || '';

        // excluded exercise (user prefs) — заменить на альтернативу
        let finalExName = ex.name;
        if (exclIds.has(catId) || exclIds.has(ex.name)) {
          const rep = findReplacementForCycle(ex.name, muscleGroupFromExName(ex.name, EXERCISE_CATALOG), favNames, favIds, new Set(exercises.map(e => e.name)));
          if (rep) finalExName = rep.name;
          else continue;
        }
        // avoidAxialLoad filter
        if (avAxial && catEntry && isAxialLoadExercise(catEntry)) {
          const rep = findReplacementForCycle(ex.name, muscleGroupFromExName(ex.name, EXERCISE_CATALOG), favNames, favIds, new Set(exercises.map(e => e.name)));
          if (rep) finalExName = rep.name;
        }
        // PRO: mobility restrictions filter
        if (opts.mobilityRestrictions && catEntry && isMobilityRestricted(catEntry, opts.mobilityRestrictions)) {
          const rep = findReplacementForCycle(ex.name, muscleGroupFromExName(ex.name, EXERCISE_CATALOG), favNames, favIds, new Set(exercises.map(e => e.name)));
          if (rep) finalExName = rep.name;
        }
        // equipment filter
        if (eqList.length > 0 && catEntry) {
          const rawEq = (catEntry as any).equipment;
          const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
          if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) {
            const rep = findReplacementForCycle(ex.name, muscleGroupFromExName(ex.name, EXERCISE_CATALOG), favNames, favIds, new Set(exercises.map(e => e.name)));
            if (rep) finalExName = rep.name;
          }
        }

        // JUNK-фильтр: проверить trueMuscleOf → skip ПЛ-движения (ПЛ-становая, overs/deficit
        // трап-гриф, ол. snatch — все они дают trueMuscleOf === null после моего предыдущего фикса).
        if (catEntry && trueMuscleOf(catEntry) === null) {
          // Через replacePLForBB должно быть уже обработано, но для страховки если name
          // прошёл (например, unclassified день), дублируем фильтр.
          continue;
        }

        const rir = ex.rir ?? (ex.rpe !== undefined ? Math.max(0, 10 - ex.rpe) : 2);
        const reps = parseReps(ex.reps);
        const [repMin, repMax] = parseRepsRange(ex.reps);
        const sets = ex.sets || 3;
        const restSec = ex.restSec || (rir <= 2 ? 150 : 90);

        // Primary/accessory role by load label OR first muscle in day
        const isMainLoad = /тяж|heavy/i.test((ex as any).notes || '') || (ex.rpe || 0) >= 8;
        let role: 'primary' | 'accessory' = 'accessory';
        if (!seenMusclesPrimary.has(muscle) && (isMainLoad || (eIdx === 0)) && !isIsolationByName(finalExName)) {
          role = 'primary';
          seenMusclesPrimary.add(muscle);
        }

        // Weight calculation — faithful:_pct honour program's notes (5/3/1, BBB 50-60% TM), then RIR fallback.
        const workMaxVal = (function () {
          if (workMax[muscle]) return workMax[muscle];
          if (muscle === 'quads' && workMax['legs']) return workMax['legs'];
          if (muscle === 'hamstrings' && workMax['legs']) return Math.round(workMax['legs'] * 0.65);
          if (workMax['chest']) return workMax['chest'];
          return 80;
        })();

        // 📌 FAITHFUL: work set specs парсят notes/reps/sets/rpe/rir → конкретные pct/reps/amrap/rest
        const wsSpecs = parseWorkSetSpecs(ex as any, sets, rir, intMult);
        const workSets: BBSet[] = wsSpecs.map(spec => ({
          reps: spec.reps,
          rir: spec.rir,
          weight: Math.round(workMaxVal * spec.pct * 10) / 10, // вес = workMax × pct (точные %)
          restSeconds: spec.restSec || restSec,
          tempo: undefined,
        }));

        // Adapt mode: weak/focus/PED boost — добираем добавочные сеты (НЕ меняем faithfull %
        // основной прогрессии). Apply к RIR слабой группы (стимул упорнее), увеличиваем sets.
        let adjSets = sets;
        let adjRir = rir;
        let usedSets = workSets;
        if (mode === 'adapt') {
          // Единый резолвер акцентов НЕДЕЛИ: focus ×1.3 / weak ×1.15 — без стэкинга.
          const isWeakMuscle = isSpecializationWeak(muscle, weekSpec);
          const isFocus = isSpecializationFocus(muscle, weekSpec);
          if (isWeakMuscle) adjSets = Math.round(adjSets * 1.15);
          if (isFocus) adjSets = Math.round(adjSets * 1.30);
          if (isWeakMuscle) adjRir = Math.max(0, rir - 1);
          // P0-1: female glute boost ×1.2 (как в buildBBPlan:590)
          if (opts.sex === 'female' && muscle === 'glutes') adjSets = Math.round(adjSets * 1.2);
          // PED volume boost (как в buildBBPlan): primary × mrvMult, accessory × max(1, mrvMult×0.8)
          if (opts.peds && opts.peds.length > 0) {
            const pedFactor = role === 'primary' ? mrvMult : Math.max(1.0, mrvMult * 0.8);
            adjSets = Math.round(adjSets * pedFactor);
          }
          // PED arm boost (как в buildBBPlan): arms/shoulders ×1.4 при mrvMult≥1.3
          if (opts.peds && opts.peds.length > 0 && mrvMult >= 1.3 && ['triceps', 'biceps', 'shoulders', 'forearms'].includes(muscle)) {
            adjSets = Math.round(adjSets * 1.4);
          }
          // MRV cap (как в buildBBPlan normalizeWeekMrv): не превышать MRV×mrvMult.
          // Parity с generic: кап цели специализации поднимается specMrv (weak ×1.2,
          // focus ×1.3), иначе буст акцента недели стирается капом.
          const lm = (allLandmarks as any)[muscle];
          if (lm && lm.mrv) {
            const mrvCap = Math.round(lm.mrv * mrvMult * specializationMrvFactor(muscle, weekSpec));
            adjSets = Math.min(adjSets, mrvCap);
          }
          if (adjSets !== sets) {
            // Доп-сеты берут pct и rir последнего сета
            usedSets = Array.from({ length: Math.max(1, adjSets) }, (_, si) => {
              const spec = wsSpecs[Math.min(si, wsSpecs.length - 1)];
              return {
                reps: spec.reps,
                rir: adjRir,
                weight: Math.round(workMaxVal * spec.pct * 10) / 10,
                restSeconds: spec.restSec || restSec,
              };
            });
          }
        }

        // Graded injury adaptation
        const gradedInj = gradedInjuries.find(i => muscleGroupFromExName((i as any).muscle || i.muscle, EXERCISE_CATALOG) === muscle);
        if (gradedInj) {
          const volPct = (gradedInj as any).volumePct ?? 1.0;
          const wtPct = (gradedInj as any).weightPct ?? 1.0;
          const reduced = Math.max(1, Math.round(adjSets * volPct));
          usedSets.forEach((ws, i) => { if (i >= reduced) usedSets.splice(i); });
          usedSets.forEach(ws => { ws.weight = Math.round(ws.weight * wtPct * 10) / 10; ws.rir = Math.min(5, ws.rir + 1); });
        }

        const workWeight = usedSets[0]?.weight || Math.round(workMaxVal * 0.80 * 10) / 10;
        exercises.push({
          name: finalExName,
          muscle,
          role,
          character: (role === 'primary' && (ex.rpe || 7) >= 8) ? 'тяж' : 'памп',
          sets: usedSets.length,
          repsRange: [Math.min(repMin, reps), Math.max(repMax, reps)],
          rir: adjRir,
          workSets: usedSets,
          restSeconds: restSec,
          exerciseName: finalExName,
          comment: `${role === 'primary' ? '🎯 Основное' : '📌 Добивочное'}: ${muscle}. ${usedSets.length}×${reps} @${Math.round(workWeight)} кг, RIR ${adjRir}.${ex.notes ? ' ' + ex.notes : ''}${ex.progression ? ' ' + ex.progression : ''}${mode === 'adapt' && isSpecializationWeak(muscle, specRes) ? ' 🔥 Слабая группа.' : ''}${mode === 'adapt' && isSpecializationFocus(muscle, specRes) ? ' ⭐ Фокус.' : ''} ${formatExerciseInstructions({ exerciseName: finalExName, muscle, role, trainingFocus: opts.trainingFocus, restSeconds: restSec })}`,
          executionProfile: buildExerciseInstructions({ exerciseName: finalExName, muscle, role, trainingFocus: opts.trainingFocus, restSeconds: restSec }),
          warmupSets: role === 'primary' ? parseWarmup(workWeight, pd.warmup) : [],
          rationale: `${finalExName} (${muscle}) из программы «${program.name}» недели ${weekNum}`,
        });
      }

      // ▓▓ ADAPT MODE: добивка слабых групп accessory упражнениями в конце дня ▓▓
      const adaptWeakPoints = [...new Set([...weakPoints, ...weekSpec.weak])];
      if (mode === 'adapt' && adaptWeakPoints.length > 0 && exercises.length > 0) {
        const allDayMuscles = new Set(exercises.map(e => e.muscle));
        const seenNames = new Set(exercises.map(e => e.name));
        // 1. Слабая группа, уже представленная в дне (но не primary) → +1 isolation добивка
        for (const wp of adaptWeakPoints) {
          if (allDayMuscles.has(wp)) {
            const candidates = EXERCISE_CATALOG.filter(e => (e.group || '').toLowerCase() === wp && !seenNames.has(e.name) && trueMuscleOf(e) !== null);
            if (candidates.length > 0) {
              const iso = candidates.find(c => c.type === 'isolation') || candidates[0];
              const wm = workMax[wp] || workMax['chest'] || 60;
              const w = Math.round(wm * 0.55 * 10) / 10; // 55% 1RM — памп-добивка
              exercises.push({
                name: iso.name, muscle: wp, role: 'accessory', character: 'памп',
                sets: 3, repsRange: [12, 15], rir: 3,
                workSets: Array.from({ length: 3 }, () => ({ reps: 12, rir: 3, weight: w, restSeconds: 60 })),
                restSeconds: 60, exerciseName: iso.name,
                comment: `🔥 Слабая группа — памп-добивка: ${iso.name}, 3×12 @${w} кг, RIR 3.`,
                warmupSets: [],
                rationale: `Pump finisher для слабой группы ${wp}`,
              });
              seenNames.add(iso.name);
              allDayMuscles.add(wp);
            }
          }
        }
        // 2. Слабая группа НЕ представлена в дне, но день совместим (Push/Pull/Legs/Shoulders/Arms):
        // добивка в дни-антагонисты или synergist (Push-день + biceps/triceps weak → ok)
        const isLegsDay = sessionTag === 'Legs' || String(sessionTag).startsWith('Lower');
        const isUpperDay = !isLegsDay;
        for (const wp of adaptWeakPoints) {
          if (allDayMuscles.has(wp)) continue;
          // совместимость: arms/shoulders/calves/abs → в upper day; legs group → в legs day; иначе skip
          const isWpLegs = ['quads', 'hamstrings', 'glutes', 'calves'].includes(wp);
          const isWpUpper = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'arms'].includes(wp);
          const isWpAbs = wp === 'abs';
          if (isWpLegs && !isLegsDay) continue;
          if (isWpUpper && !isUpperDay && !isWpAbs) continue;
          // MRV soft-cap
          const lm = (allLandmarks as any)[wp];
          if (lm && lm.mrv) {
            // посчитать weekly объём этой мышцы — на недельном уровне кап тяжело, проверим session cap
            const sessionSetsThisMuscle = exercises.filter(e => e.muscle === wp).reduce((a, e) => a + e.sets, 0);
            const sessionMrvCap = Math.round(lm.mrv * pedMrvMult / Math.max(1, daysPerWeek));
            if (sessionSetsThisMuscle >= sessionMrvCap) continue;
          }
          const candidates = EXERCISE_CATALOG.filter(e => (e.group || '').toLowerCase() === wp && !seenNames.has(e.name) && trueMuscleOf(e) !== null);
          if (candidates.length === 0) continue;
          const cat = candidates.find(c => c.type === 'compound') || candidates.find(c => c.type === 'isolation') || candidates[0];
          const wm = workMax[wp] || 70;
          const w = Math.round(wm * 0.65 * 10) / 10;
          exercises.push({
            name: cat.name, muscle: wp, role: 'accessory', character: 'памп',
            sets: 3, repsRange: [10, 12], rir: 3,
            workSets: Array.from({ length: 3 }, () => ({ reps: 10, rir: 3, weight: w, restSeconds: 60 })),
            restSeconds: 60, exerciseName: cat.name,
            comment: `🔥 Слабая группа ${wp} — accessory добивка: ${cat.name}, 3×10 @${w} кг, RIR 3.`,
            warmupSets: [],
            rationale: `Weak-group accessory для ${wp} (.DTO день-совместим)`,
          });
          seenNames.add(cat.name);
          allDayMuscles.add(wp);
        }
      }

      // Sort: primary first, then compound → isolation → pump finisher; faithful: respect original order
      // Adapt: tidy с sessionTag → orderSessionExercises ставит lead-muscle compound первым.
      if (mode !== 'faithful') {
        const _tidy = tidySessionExercises(exercises, undefined, sessionTag);
        exercises.length = 0; exercises.push(..._tidy);
      }

      // ★ DUPE-дедупликация: удаляем упражнения с одинаковым именем (оставляем первое).
      // Дубликаты появляются когда программа содержит то же упражнение в разных ролях
      // (Deadlift → Row + Barbell Row → оба становятся "Тяга штанги в наклоне").
      {
        const seen = new Set<string>();
        for (let i = exercises.length - 1; i >= 0; i--) {
          const name = exercises[i].exerciseName || exercises[i].name || '';
          if (seen.has(name)) { exercises.splice(i, 1); }
          else seen.add(name);
        }
      }

      // ★ Пересчёт sessionTag ПОСЛЕ всех преобразований (JUNK-фильтр, замены, дедупликация).
      // Раньше sessionTag вычислялся из исходных pd.exercises — после фильтрации состав
      // менялся (chest отфильтрован → остался только back → tag=ChestBack, но должен быть Back).
      // Теперь пересчитываем из финального состава упражлений → корректный tag для tidy.
      {
        const finalMuscles = exercises.map(e => e.muscle);
        sessionTag = classifySessionTag(finalMuscles);
      }

      // L12: добавить суперсет-пары в конец дня (как отдельные упражнения)
      for (const ss of pendingSupersets) {
        const rMuscle = muscleGroupFromExName(ss.rightName, EXERCISE_CATALOG);
        if (excludedMuscles.has(rMuscle)) continue;
        const rCat = EXERCISE_CATALOG.find(e => e.name === ss.rightName);
        if (!rCat) continue;
        exercises.push({
          muscle: rMuscle,
          name: rCat.name,
          role: 'accessory',
          character: 'памп' as any,
          sets: 3,
          repsRange: [10, 15],
          rir: 2,
          workSets: Array.from({ length: 3 }, () => ({ reps: 12, rir: 2, weight: 30, restSeconds: 30 })),
          exerciseName: rCat.name,
          comment: `[Суперсет с: ${ss.leftName}] Без отдыха между упражнениями.`,
          warmupSets: [],
          rationale: 'Суперсет: повышение плотности тренировки.',
        });
      }

      sessions.push({
        day: dIdx + 1,
        weekOffset: (wIdx) * daysPerWeek + dIdx + 1,
        character: hasHeavy ? 'тяж' : 'памп',
        sessionTag,
        exercises,
      });
    }

    // Deload: в adapt — дополнительное снижение (поверх volumeMultiplier программы).
    // Faithful: НЕ применяется — программа уже учитывает deload через volumeMultiplier/intensityMultiplier.
    if (isDeload && mode !== 'faithful') {
      for (const sess of sessions) {
        for (const ex of sess.exercises) {
          ex.sets = Math.max(1, Math.round(ex.sets * 0.5 / Math.max(0.5, volMult)));
          ex.rir = Math.min(5, ex.rir + 1);
          for (const ws of ex.workSets) {
            ws.weight = Math.round(ws.weight * 0.85 * 10) / 10;
            ws.rir = Math.min(5, ws.rir + 1);
          }
        }
      }
      rationale.push(`🔋 Разгрузка нед ${weekNum}: объём -50%, RIR +1, вес -15%`);
    }

    weeks.push({ week: weekNum, sessions });
  }

  // Compute rotationMuscleVolume from week 1
  const rotationMuscleVolume: Record<string, number> = {};
  if (weeks.length > 0) {
    for (const sess of weeks[0].sessions) {
      for (const ex of sess.exercises) {
        rotationMuscleVolume[ex.muscle] = (rotationMuscleVolume[ex.muscle] || 0) + ex.sets;
      }
    }
  }

  // muscleFrequency — calculate from all weeks (avg per week)
  const muscleFrequency: Record<string, number> = {};
  if (weeks.length > 0) {
    for (const wk of weeks) {
      const weekMuscles = new Set<string>();
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          if (!excludedMuscles.has(ex.muscle)) weekMuscles.add(ex.muscle);
        }
      }
      for (const m of weekMuscles) muscleFrequency[m] = (muscleFrequency[m] || 0) + 1;
    }
    // normalize to per-week average
    for (const m of Object.keys(muscleFrequency)) {
      muscleFrequency[m] = Math.round(muscleFrequency[m] / weeks.length * 10) / 10;
    }
  }

  // Pattern info for BBPlan
  const pattern = {
    id: program.id, name: program.name, description: program.description || '',
    rotationDays: 7, sessionsPerRotation: daysPerWeek,
    level: [program.level],
    schedule: (weeks[0]?.sessions || []).map((s, i) => ({
      kind: 'тренировка' as const, character: null,
      sessionTag: s.sessionTag || ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'FullBody'][i % 6],
    })),
  };

  rationale.push(SESSION_TIDY_RATIONALE);
  let finalPlan: BBPlan = { pattern, weeks, rotationMuscleVolume, rationale };

  // L8: ACWR из реальных sRPE-сессий (PED-логика первого режима) — единый расчёт
  // с mode 1 (buildBBPlan). Раньше mode 2 передавал acwrRatio: 1 (хардкод) → авто-делод
  // и ACWR-warning никогда не срабатывали.
  const acwrInfo = computeAcwrCyclePlan();
  const acwrRatio = acwrInfo.ratio;
  if (acwrRatio > 1.3) {
    rationale.push(`⚠ ACWR=${acwrRatio.toFixed(2)} (${acwrInfo.zone}) → план может потребовать разгрузочной недели`);
  }

  // Apply post-processing (интенс-техники/авто-делод/загрузка/авторег) — только adapt.
  // Faithful: программа сохраняется как есть (без изменения объёма/RIR/делода).
  // ACWR-warning показывается в обоих режимах (см. выше).
  if (mode === 'adapt' && ((opts.intTechnique && opts.intTechnique !== 'none') || weakPoints.length > 0 || opts.loadStrategy || opts.autoDeload || opts.autoRegResult)) {
    finalPlan = applyPostPhaseProcessing({
      plan: finalPlan,
      totalWeeks,
      workMax,
      loadStrategy: opts.loadStrategy as LoadStrategy,
      autoDeload: opts.autoDeload,
      deloadType: opts.deloadType,
      acwrRatio,
      autoRegResult: opts.autoRegResult,
      skipPhaseRedistribution: true,
      intensityTechnique: opts.intTechnique && opts.intTechnique !== 'none' ? opts.intTechnique : undefined,
      weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
    });
  }

  if (mode === 'adapt') {
    const workoutSessions = loadWorkoutSessions();
    if (workoutSessions.length > 0) {
      finalPlan = applyFeedbackToBuild(finalPlan, workoutSessions, workMax, opts.loadStrategy as LoadStrategy);
      const plateau = autoReplaceOnPlateau(finalPlan, workoutSessions);
      if (plateau.changes.length > 0) {
        finalPlan = plateau.plan;
        rationale.push(...plateau.changes);
      }
    }
  }

  // Volume-landmarks
  // P0-4 (audit 2026-08): применяем eccentricMult к primary-упражнениям
  finalPlan = applyEccentricOverloadToPlan(finalPlan, opts.eccentricMult);
  // 🔁 Донорское перераспределение специализации (adapt): слой поверх
  // рассчитанного объёма, базовые коэффициенты не меняются.
  if (mode === 'adapt' && specSchedule.active) {
    const tradeoffMrvByMuscle: Record<string, number> = {};
    // Пара с finalizeBBPlan (mrvMultiplier: pedMrvMult — ПОЛНЫЙ множитель):
    // floor донора и капы переноса масштабируются тем же effective
    // (PED × recovery × nutrition × lab), иначе recovery/lab занижали
    // floor донора в program-пути (mrvMult здесь — только PED).
    // + Parity с generic: капы целей поднимаются specMrv (weak ×1.2 / focus ×1.3).
    const tradeoffTargets = Array.from(new Set(specSchedule.blocks.flatMap(b => b.targets)));
    const tradeoffSpecRes = { targets: tradeoffTargets, focus: specSchedule.focus, weak: tradeoffTargets, active: tradeoffTargets.length > 0 };
    for (const [m, lm] of Object.entries(allLandmarks)) {
      tradeoffMrvByMuscle[m] = Math.round((lm as any).mrv * pedMrvMult * specializationMrvFactor(m, tradeoffSpecRes));
    }
    const capLevel = String(opts.level ?? levelForLandmarks);
    const tradeoffReports = applyTradeoffToPlan(
      finalPlan,
      w => tradeoffForWeek(specSchedule, w),
      w => specResForWeekSchedule(specSchedule, w).targets,
      {
        level: levelForLandmarks,
        mrvByMuscle: tradeoffMrvByMuscle,
        workMax,
        equipment: eqList,
        maxExercisesPerSession: centralizedSessionLimits({ level: capLevel, trainingYears: opts.trainingYears }).maxExercises,
        maxWorkingSetsPerSession: centralizedSessionLimits({ level: capLevel, trainingYears: opts.trainingYears }).maxWorkingSets,
      },
    );
    for (const report of tradeoffReports) {
      if (report.removedSets > 0 || report.transferredSets > 0) {
        rationale.push(`🔁 Донорское перераспределение (нед ${report.week}): доноры [${report.donors.join(', ')}] — снято ${report.removedSets} сетов, перенесено ${report.transferredSets}, не использовано ${report.unusedSets}${report.notes.length ? ` (${report.notes.join('; ')})` : ''}.`);
      }
    }
  }
  const volumeLandmarks = getBBVolumeLandmarks(finalPlan, levelForLandmarks, pedMrvMult);
  const finalized = finalizeBBPlan({
    ...finalPlan,
    volumeLandmarks,
    muscleFrequency,
    // Контекст специализации/лимитов сохраняется для повторной финализации.
    specializationSchedule: specSchedule,
    priorityMuscles: [...new Set([...weakPoints, ...specSchedule.blocks.flatMap(b => b.targets), ...(focusGroup ? [focusGroup] : [])])],
    mrvMultiplier: pedMrvMult,
    maxWorkingSets: centralizedSessionLimits({ level: String(opts.level ?? levelForLandmarks), trainingYears: opts.trainingYears }).maxWorkingSets,
    maxExercises: centralizedSessionLimits({ level: String(opts.level ?? levelForLandmarks), trainingYears: opts.trainingYears }).maxExercises,
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    mobilityRestrictions: opts.mobilityRestrictions,
  }, {
    reorder: mode !== 'faithful',
    priorityMuscles: [...new Set([...weakPoints, ...specSchedule.blocks.flatMap(b => b.targets), ...(focusGroup ? [focusGroup] : [])])],
    specializationSchedule: specSchedule,
    methodology: opts.methodology,
    level: opts.level ?? levelForLandmarks,
    volumeGoal: opts.volumeGoal,
    phaseSafety: true,
    controlledRotation: mode !== 'faithful',
    equipment: eqList,
    excludedExercises: opts.excludedExercises,
    avoidAxialLoad: avAxial,
    excludedMuscles: [...excludedMuscles],
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    mobilityRestrictions: opts.mobilityRestrictions,
    ensureMinimumVolume: mode !== 'faithful',
    workMax,
    mrvMultiplier: pedMrvMult,
    checkOrder: mode !== 'faithful',
    preserveSource: mode === 'faithful',
    trainingYears: opts.trainingYears,
    bodyweightCapability: opts.bodyweightCapability,
  });
  if (opts.athleteContext) {
    finalized.athleteMode = opts.athleteMode ?? 'standard';
    finalized.athleteContext = opts.athleteContext;
  }
  return finalized;
}

// helper: get volume landmarks wrapper (used in adapt mode)
function _getLandmarksForMuscle(level: 'beginner' | 'intermediate' | 'advanced', muscle: string): { mev: number; mav: number; mrv: number } | null {
  try {
    const all = getAllVolumeLandmarks(level);
    return (all as any)[muscle] || null;
  } catch { return null; }
}
