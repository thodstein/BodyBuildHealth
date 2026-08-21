/**
 * bb-prep-cycle.engine.ts — «🏁 Prep-цикл»: отдельный режим подготовки к
 * соревнованиям в BB-авто.
 *
 * Строит полный цикл подготовки С НУЛЯ (не оверлей на обычный план):
 *   - prep-сплит под конкретную категорию (мужские + женские);
 *   - мышцы с АКЦЕНТОМ (для формы/баланса) → MAV-цели (bb-specialization);
 *   - мышцы на МИНИМАЛЬНУЮ нагрузку → доноры с MEV-флором (bb-tradeoff);
 *   - длительность 4-26 нед, дата соревнования → фазы;
 *   - встроенный тапер + пик-неделя + питание подготовки (bb-contest-prep).
 *
 * ВАЖНО: переиспользует готовые движки. Объёмная модель (MEV/MAV/MRV, level,
 * стаж, PED, recovery, nutrition, lab, goal) НЕ меняется — здесь только
 * оркестрация: расписание акцента/минимума → buildBBPlan → contest-prep.
 */

import type { BBGoal } from './bb-types';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from './bb-builder.engine';
import { adaptForPEDs, type PED, type PEDAdaptation, type CourseIntensity } from './bb-ped-adaptation.engine';
import {
  buildSpecializationSchedule, normalizeSpecializationTargets, expandDonorMuscles,
  canonicalMuscle, type SpecializationBlock, type SpecializationSchedule,
} from './bb-specialization.engine';
import type { Injury } from '../manual-plan-builder';
import { computeBBNutritionMultiplier } from './bb-volume.engine';
import { autoAssignIntensityTechniques } from './bb-finalize.engine';
import type { BBTrainingFocus } from './bb-goal-types';
import { applyDUPOverlay, type DUPMode } from './bb-dup.engine';
import {
  buildBBContestPrepPlan, applyContestPrepToBBPlan, CATEGORY_PROFILES,
  isoToday, isoDiffDays, isoAddDays, prepPhaseForWeek, prepPhaseForDate, buildPeakWeek, configFromPlan,
  prepWeightAdvice, prepTrainingCompliance,
  type PrepWeightAdvice, type PrepWeightStatus,
  type BBContestCategory, type BBContestPrepConfig, type BBContestPrepPlan,
  type BBPlanWithPrep, type CarbLoadStrategy, type ContestEventEntry,
  type ContestSpecialization, type ExperienceLevel, type SodiumStrategy, type WaterStrategy,
} from './bb-contest-prep.engine';
import {
  prepSplitProfile, PREP_MINIMAL_MODE_LABELS,
  type PrepMinimalMode,
} from './bb-prep-splits';

/** Конфигурация Prep-цикла (всё пользовательское, валидируется). */
export interface PrepCycleConfig {
  category: BBContestCategory;
  sex: 'male' | 'female';

  /** Мышцы с акцентом для формы/баланса (1-2). */
  accentMuscles: string[];
  /** Мышцы на минимальную нагрузку (N; композиты legs/arms/core раскрываются). */
  minimalMuscles: string[];
  /** Режим минимальной нагрузки (рекомендация через recommendMinimalMode). */
  minimalMode?: PrepMinimalMode;

  /** Сплит prep (ид из bb-split-patterns); если нет — рекомендуемый по категории. */
  splitPatternId?: string;
  /** Длительность цикла 4-26 нед (подготовка + тапер + пик-неделя). */
  weeks: number;
  /** Тапер 1-4 нед (последние недели цикла, до пик-недели). */
  taperWeeks: number;
  /** Дата шоу (ISO yyyy-mm-dd) — якорь фаз и тапера. */
  showDate: string;

  // ── Атлет ──
  level: string;
  trainingYears?: number;
  /** Training focus (strength/hypertrophy/endurance); по умолчанию — из профиля категории. */
  trainingFocus?: BBTrainingFocus;
  equipment?: string[];
  injuries?: Injury[];
  mobilityRestrictions?: string[];
  workMax?: Record<string, number>;
  avoidAxialLoad?: boolean;

  // ── Доп. параметры обычного ББ-авто (полный паритет с buildBBPlan) ──
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  intensityTechnique?: BBBuilderInput['intensityTechnique'];
  autoDeload?: boolean;
  deloadType?: BBBuilderInput['deloadType'];
  loadStrategy?: BBBuilderInput['loadStrategy'];
  autoRegResult?: BBBuilderInput['autoRegResult'];
  methodology?: BBBuilderInput['methodology'];
  labWarnings?: string[];
  labIntensityNote?: string;
  eccentricMult?: number;
  previousPlan?: BBPlan;
  supersetMode?: BBBuilderInput['supersetMode'];
  volumeScheme?: BBBuilderInput['volumeScheme'];
  /** DUP-периодизация (применяется overlay поверх плана, как в обычном ББ-авто). */
  dupMode?: DUPMode;

  // ── Восстановление/питание → MRV (как в обычном конструкторе) ──
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
  proteinPerKg?: number;
  calorieSurplus?: number;

  // ── PED ──
  enhanced: boolean;
  pedDoses?: Record<string, number>;
  courseIntensity?: CourseIntensity;

  // ── Prep / питание ──
  weightKg: number;
  bodyFatPct?: number;
  experienceLevel: ExperienceLevel;
  prepCount?: number;
  prepVolumeMult?: number;
  /** Стратегия объёма подготовки (крутизна каскада): gentle/balanced/aggressive. */
  prepVolumeStrategy?: PrepVolumeStrategy;
  /** Prep-делод каждые N недель подготовки (0 = выкл; дефолт 5). */
  prepDeloadEvery?: number;
  currentCalories?: number;
  carbLoadStrategy?: CarbLoadStrategy;
  waterStrategy?: WaterStrategy;
  sodiumStrategy?: SodiumStrategy;
  confirmedManipulation?: boolean;
  contraindications?: string[];
  allergens?: string[];
  preferLowFiberCarbs?: boolean;
  creatineStrategy?: 'continue' | 'stop';
  schedule?: { wake: string; stage: string };

  // ── Соревнования ──
  competitions?: ContestEventEntry[];
  mainCompetitionId?: string;
}

/** Результат сборки Prep-цикла. */
export interface PrepCycleResult {
  config: PrepCycleConfig;
  bbPlan: BBPlanWithPrep;
  prepPlan: BBContestPrepPlan;
  specializationSchedule: SpecializationSchedule;
  accentMuscles: string[];
  minimalMuscles: string[];
  minimalMode: PrepMinimalMode;
  prepWeeks: number;
  taperWeeks: number;
  phases: BBContestPrepPlan['phases'];
  volumePlan: PrepVolumePlan;
  warnings: string[];
  rationale: string[];
}

/** Итог валидации. */
export interface PrepCycleValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Акцент (гранулярные зоны) → ContestSpecialization (для prep-тапера). */
export function accentToContestSpec(accent: string[]): ContestSpecialization {
  if (!accent || accent.length === 0) return 'none';
  const first = canonicalMuscle(accent[0]);
  if (first === 'chest') return 'chest';
  if (first === 'back') return 'back';
  if (first === 'shoulders') return 'shoulders';
  if (first === 'biceps' || first === 'triceps' || first === 'arms') return 'arms';
  if (first === 'quads') return 'quads';
  if (first === 'hamstrings') return 'hamstrings';
  if (first === 'glutes') return 'glutes';
  if (first === 'calves') return 'calves';
  if (first === 'abs') return 'abs';
  if (first === 'traps') return 'traps';
  return 'none';
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Валидация конфигурации (без throw). */
export function validatePrepCycle(raw: PrepCycleConfig): PrepCycleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') { errors.push('Конфиг отсутствует.'); return { ok: false, errors, warnings }; }

  const profile = CATEGORY_PROFILES[raw.category];
  if (!profile) errors.push(`Неизвестная категория: ${raw.category}`);
  else if (profile.sex !== raw.sex) errors.push(`Категория «${profile.label}» не соответствует полу «${raw.sex}».`);

  if (!Number.isInteger(raw.weeks) || raw.weeks < 4 || raw.weeks > 26) errors.push(`Длительность ${raw.weeks} нед вне диапазона 4-26.`);
  if (!Number.isInteger(raw.taperWeeks) || raw.taperWeeks < 1 || raw.taperWeeks > 4) errors.push(`Тапер ${raw.taperWeeks} нед вне диапазона 1-4.`);
  if (Number.isInteger(raw.weeks) && Number.isInteger(raw.taperWeeks) && raw.weeks - raw.taperWeeks < 2) errors.push('Длительность цикла должна оставлять минимум 1 нед подготовки после тапера и пик-недели.');
  if (!isValidIsoDate(raw.showDate)) errors.push(`Дата шоу «${raw.showDate}» некорректна (ISO yyyy-mm-dd).`);
  if (raw.weightKg == null || !Number.isFinite(raw.weightKg) || raw.weightKg < 30 || raw.weightKg > 250) errors.push(`Вес ${raw.weightKg} кг вне диапазона 30-250.`);
  if (!raw.level) errors.push('Уровень не задан.');

  const accent = normalizeSpecializationTargets(raw.accentMuscles || []);
  if (accent.length === 0) warnings.push('💡 Акцент не задан — цикл будет сбалансированным (без специализации).');
  const minimal = expandDonorMuscles(raw.minimalMuscles || []);
  for (const m of minimal) {
    if (accent.some(a => canonicalMuscle(a) === canonicalMuscle(m))) {
      warnings.push(`⚠ Мышца «${m}» присутствует и в акценте, и в минимальной нагрузке — она будет исключена из минимума.`);
    }
  }
  if (raw.bodyFatPct != null && profile && profile.targetBodyFatPct != null && raw.bodyFatPct - profile.targetBodyFatPct > 2) {
    warnings.push(`⚠ Готовность: %жира ${raw.bodyFatPct} при цели ~${profile.targetBodyFatPct}% — до сухости не дожато; рекомендуйте мягкий карб-загруз и умеренный дефицит.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Рекомендация режима минимальной нагрузки с учётом категории/PED/стажа/уровня. */
export function recommendMinimalMode(
  cfg: Pick<PrepCycleConfig, 'category' | 'enhanced' | 'trainingYears' | 'level' | 'minimalMuscles'>,
): { mode: PrepMinimalMode; reason: string } {
  if (!cfg.minimalMuscles || cfg.minimalMuscles.length === 0) {
    return { mode: 'none', reason: 'Минимальные мышцы не заданы — режим не применяется.' };
  }
  const profile = prepSplitProfile(cfg.category);
  const years = Number.isFinite(cfg.trainingYears) ? (cfg.trainingYears as number) : 0;
  const heavyMass = ['mens_bb', 'bb_212', 'womens_bb', 'womens_physique'].includes(cfg.category);
  // Полное исключение — когда акценту нужен максимум ресурса: массовые дивизионы
  // и/или повышенная восстановительная способность (курс, большой стаж, advanced).
  if (heavyMass && (cfg.enhanced || years >= 3 || cfg.level === 'enhanced' || cfg.level === 'advanced')) {
    return {
      mode: 'remove_direct_when_indirect_covers_floor',
      reason: `Массовый дивизион${cfg.enhanced ? ' + курс' : (years >= 3 ? ' + стаж ≥3 г' : ' + уровень')}: акценту нужен максимум ресурса — минимальная нагрузка убрана полностью (остаётся только косвенная работа).`,
    };
  }
  return {
    mode: profile.minimalModePreference === 'remove_direct_when_indirect_covers_floor' && (cfg.enhanced || years >= 3)
      ? 'remove_direct_when_indirect_covers_floor'
      : 'reduce_direct_to_floor',
    reason: 'Сохранение общей формы и баланса: минимальная нагрузка снижена до MEV-флора, косвенная работа сохраняется.',
  };
}

/** Нормализовать конфиг: клампы, дефолты, раскрытие доноров, акцент. */
export function normalizePrepCycle(raw: PrepCycleConfig): PrepCycleConfig {
  const weeks = clamp(Math.round(raw.weeks || 12), 4, 26);
  const taperWeeks = clamp(Math.round(raw.taperWeeks || 3), 1, Math.min(4, weeks - 1));
  const accent = normalizeSpecializationTargets(raw.accentMuscles || []);
  let minimal = expandDonorMuscles(raw.minimalMuscles || []);
  minimal = minimal.filter(m => !accent.some(a => canonicalMuscle(a) === canonicalMuscle(m)));
  const mode: PrepMinimalMode = raw.minimalMode === 'remove_direct_when_indirect_covers_floor'
    ? 'remove_direct_when_indirect_covers_floor'
    : raw.minimalMode === 'reduce_direct_to_floor'
      ? 'reduce_direct_to_floor'
      : minimal.length > 0 ? 'reduce_direct_to_floor' : 'none';
  return { ...raw, weeks, taperWeeks, accentMuscles: accent, minimalMuscles: minimal, minimalMode: mode };
}

/** Собрать Prep-цикл. */
export function buildPrepCycle(raw: PrepCycleConfig): PrepCycleResult {
  const v = validatePrepCycle(raw);
  if (v.errors.length > 0) throw new Error(`Prep-цикл: ${v.errors.join(' ')}`);
  const cfg = normalizePrepCycle(raw);
  const profile = prepSplitProfile(cfg.category);
  const totalWeeks = cfg.weeks;
  const taperWeeks = cfg.taperWeeks;
  const prepWeeks = Math.max(1, totalWeeks - taperWeeks - 1); // пик-неделя = 1
  const accent = cfg.accentMuscles;
  const minimal = cfg.minimalMuscles;
  const mode: PrepMinimalMode = cfg.minimalMode ?? (minimal.length > 0 ? 'reduce_direct_to_floor' : 'none');

  const patternId = cfg.splitPatternId || profile.recommendedSplits[0] || 'upper_lower_4';

  // Расписание специализации: акцент-блок по prep-неделям, далее баланс (тапер/пик).
  const specBlocks: SpecializationBlock[] = [];
  if (accent.length > 0) {
    const block: SpecializationBlock = {
      id: 'prep-accent',
      weekStart: 1,
      weekEnd: Math.max(1, prepWeeks),
      targets: accent,
    };
    if (minimal.length > 0 && mode !== 'none') {
      // Минимальная нагрузка: режим remove → флор 0 (исключить), reduce → 0.25×MEV (~2-4 сета/нед).
      block.tradeoff = {
        mode,
        donorMuscles: minimal,
        preserveIndirect: true,
        donorFloorMult: mode === 'remove_direct_when_indirect_covers_floor' ? 0 : 0.25,
      };
    }
    specBlocks.push(block);
  }
  const schedule = buildSpecializationSchedule(undefined, undefined, true, totalWeeks, specBlocks);

  const prepStartIso = prepStartDateRaw(cfg.showDate, prepWeeks + taperWeeks);

  const input: BBBuilderInput = {
    patternId,
    level: cfg.level,
    trainingYears: cfg.trainingYears,
    goal: 'maintenance' as BBGoal,
    weeks: totalWeeks,
    bodyweightCapability: cfg.bodyweightCapability,
    workMax: cfg.workMax ?? {},
    weakPoints: accent,
    focusGroup: accent[0],
    specialization: accent.length > 0,
    specializationSchedule: specBlocks.length > 0 ? specBlocks : undefined,
    equipment: cfg.equipment ?? [],
    volumeGoal: 'mav',
    avoidAxialLoad: cfg.avoidAxialLoad,
    injuries: cfg.injuries ?? [],
    favoriteExercises: cfg.favoriteExercises ?? [],
    excludedExercises: cfg.excludedExercises ?? [],
    mobilityRestrictions: cfg.mobilityRestrictions,
    sex: cfg.sex,
    planStartWeek: prepStartIso,
    courseIntensity: cfg.courseIntensity ?? 'moderate',
    pedDoses: cfg.pedDoses,
    trainingFocus: cfg.trainingFocus ?? profile.trainingFocus,
    intensityTechnique: cfg.intensityTechnique,
    autoDeload: cfg.autoDeload,
    deloadType: cfg.deloadType,
    loadStrategy: cfg.loadStrategy,
    autoRegResult: cfg.autoRegResult,
    methodology: cfg.methodology,
    bodyFat: cfg.bodyFat,
    leanMass: cfg.leanMass,
    hrvMs: cfg.hrvMs,
    sleepHours: cfg.sleepHours,
    stressLevel: cfg.stressLevel,
    labMrvMultiplier: cfg.labMrvMultiplier,
    labWarnings: cfg.labWarnings,
    labIntensityNote: cfg.labIntensityNote,
    eccentricMult: cfg.eccentricMult,
    previousPlan: cfg.previousPlan,
    supersetMode: cfg.supersetMode,
    volumeScheme: cfg.volumeScheme,
    // Питание: приоритет явно заданного; prep держит объём на уровне ББ-авто (MAV),
    // лёгкий дефицит — через питание/contest-prep, НЕ через режущий goal='cut'.
    proteinPerKg: cfg.proteinPerKg ?? 2.0,
    calorieSurplus: cfg.calorieSurplus ?? -200,
  };

  let pedAdapt: PEDAdaptation | undefined;
  if (cfg.enhanced) {
    const peds: PED[] = ['AAS'];
    pedAdapt = adaptForPEDs(peds, input.workMax ?? {}, cfg.pedDoses, cfg.courseIntensity ?? 'moderate');
  }
  let bbPlan: BBPlan = buildBBPlan(input, pedAdapt);
  // DUP-периодизация (как в обычном ББ-авто) — поверх базового плана, до prep-overlay.
  if (cfg.dupMode && cfg.dupMode !== 'none') {
    bbPlan = applyDUPOverlay(bbPlan, { mode: cfg.dupMode, cycleDays: cfg.dupMode === 'full_dup' ? 3 : 2 });
  }

  const prepCfg: BBContestPrepConfig = {
    sex: cfg.sex,
    category: cfg.category,
    weightKg: cfg.weightKg,
    bodyFatPct: cfg.bodyFatPct,
    experienceLevel: cfg.experienceLevel,
    enhanced: cfg.enhanced,
    prepCount: cfg.prepCount ?? 0,
    showDate: cfg.showDate,
    weeksOut: taperWeeks,
    competitions: cfg.competitions,
    mainCompetitionId: cfg.mainCompetitionId,
    specialization: accentToContestSpec(accent),
    trainingProtocol: 'bb',
    carbLoadStrategy: cfg.carbLoadStrategy ?? 'moderate',
    waterStrategy: cfg.waterStrategy ?? 'minimal',
    sodiumStrategy: cfg.sodiumStrategy ?? 'constant',
    contraindications: cfg.contraindications,
    allergens: cfg.allergens,
    preferLowFiberCarbs: cfg.preferLowFiberCarbs,
    creatineStrategy: cfg.creatineStrategy,
    schedule: cfg.schedule,
    confirmedManipulation: cfg.confirmedManipulation,
  };

  const prepPlan = buildBBContestPrepPlan(prepCfg, {
    prepWeeks,
    taperWeeks,
    currentCalories: cfg.currentCalories,
    prepVolumeMult: cfg.prepVolumeMult,
    source: 'bb_auto',
  });

  // Тренировочная подготовка: спланированный каскад объёма на ВЕСЬ цикл (не только тапер).
  // applyContestPrepToBBPlan ставит подготовку на плоский объём (prepVolumeMult=1.0),
  // затем applyPrepVolumeCascade накладывает фазовый спуск × атлет-множители (PED/стаж/
  // уровень/восстановление) + дефицит-мод по категории. Тапер ×0.6 остаётся финальным спуском.
  const volumePlan = prepVolumePlan(cfg, prepWeeks);
  const bbPlanPrep = applyPrepPeakReduction(
    applyPrepTaperSparing(
      applyPrepDeloads(
        applyPrepVolumeCascade(
          applyContestPrepToBBPlan(bbPlan, prepCfg, { prepWeeks, taperWeeks, prepVolumeMult: 1.0, force: true }),
          cfg,
          prepWeeks,
          volumePlan,
        ),
        cfg,
        prepWeeks,
      ),
      cfg,
    ),
  );

  // Дроп-техники/суперсеты назначаются ПОСЛЕ prep-оверлеев: каскад/тапер/пик могли
  // срезать сеты, оставив метки техник на урезанных подходах. Пере-назначаем на
  // ФИНАЛЬНЫЕ сеты. В пик-неделю убираем failure-протоколы (negative/RIR 0), но
  // оставляем dropset/rest-pause/21s (гипертрофия допустима в финальной подготовке).
  autoAssignIntensityTechniques(bbPlanPrep, cfg.level || 'intermediate', accent);
  for (const week of bbPlanPrep.weeks) {
    if ((week as any).contestPhase !== 'peak_week') continue;
    for (const session of (week.sessions || [])) for (const ex of (session.exercises || [])) {
      const ws = ex.workSets;
      if (!Array.isArray(ws)) continue;
      for (const s of ws) {
        if (s.technique && /negative|негатив/i.test(String(s.technique))) s.technique = undefined;
        if (Number(s.rir) <= 0) s.rir = 1;
      }
      if (ex.comment && /негатив/i.test(ex.comment)) ex.comment = ex.comment.replace(/[|] 💥[^|]*негатив[^|]*/i, '');
    }
  }

  const warnings = [...v.warnings];
  if (prepWeeks < 4) {
    warnings.push(`⚠ Цикл короткий (${totalWeeks} нед): подготовка всего ${prepWeeks} нед (тапер ${taperWeeks}+пик). Рекомендуем ≥6 нед для осмысленной подготовки.`);
  }

  return {
    config: cfg,
    bbPlan: bbPlanPrep,
    prepPlan,
    specializationSchedule: schedule,
    accentMuscles: accent,
    minimalMuscles: minimal,
    minimalMode: mode,
    prepWeeks,
    taperWeeks,
    phases: prepPlan.phases,
    volumePlan,
    warnings,
    rationale: [
      `🏁 Prep-цикл: категория ${CATEGORY_PROFILES[cfg.category].label} (${cfg.sex}), ${totalWeeks} нед (подготовка ${prepWeeks} + тапер ${taperWeeks} + пик-неделя), шоу ${cfg.showDate}.`,
      `⭐ Акцент: ${accent.length ? accent.join(', ') : 'без акцента'} · минимальная нагрузка: ${minimal.length ? minimal.join(', ') : 'не задана'} (${PREP_MINIMAL_MODE_LABELS[mode]}).`,
      `📐 Сплит: ${patternId} · тренировочный фокус: ${profile.trainingFocus}.`,
      `📉 Объём подготовки (каскад): ${volumePlan.phases.map(p => `×${p.volumeMult.toFixed(2)} [нед ${Math.max(1, Math.ceil(p.fromPct * prepWeeks))}–${Math.min(prepWeeks, Math.ceil(p.toPct * prepWeeks))}]`).join(' → ')} · ${volumePlan.note}.`,
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// План объёма тренировок подготовки (В1+В2): каскад + дефицит-мод + атлет-множители.
// Это «долгий режим»: объём планомерно снижается по prep-неделям (а не только
// финальный тапер). Интенсивность (вес) сохраняется, RIR плавно растёт.
// ═══════════════════════════════════════════════════════════════════════════

/** Стратегия объёма подготовки: крутизна каскада (сохранить массу / сбалансировано / агрессивно). */
export type PrepVolumeStrategy = 'gentle' | 'balanced' | 'aggressive';

export interface PrepVolumePhase {
  /** Доля prep-блока (0..1). */
  fromPct: number;
  toPct: number;
  /** Множитель объёма (сетов) подфазы (уже с учётом дефицит/атлет/восстановление). */
  volumeMult: number;
  rir: [number, number];
}

export interface PrepVolumePlan {
  phases: PrepVolumePhase[];
  /** Множитель дефицита по категории/%жира. */
  deficitMult: number;
  /** Множитель атлета (PED/стаж/уровень) — масштабирует целевой объём вверх/вниз. */
  athleteMult: number;
  /** Множитель восстановления (HRV/сон/стресс). */
  recoveryMult: number;
  /** Базовая цель недельного объёма на группу мышц (для натурала/среднего стажа). */
  targetSetsPerMusclePerWeek: [number, number];
  /** Целевой диапазон с учётом атлет-множителя (PED/стаж/уровень): для атлета со стажем/на курсе — выше. */
  scaledTargetSetsPerMusclePerWeek: [number, number];
  note: string;
}

/** Дефицит-мод по категории и текущему %жира (В2).
 *  Доказательно: при дефиците ОБЪЁМ ДЕРЖИМ ВЫСОКИМ (сохранение мышц; Helms 2017,
 *  Schoenfeld 2021), снижаем лишь слегка — основной спуск происходит в финальном тапере.
 *  Диапазон узкий (0.93–1.0), чтобы подготовка не превращалась в тапер с 1-й недели. */
export function prepDeficitMult(cfg: Pick<PrepCycleConfig, 'category' | 'bodyFatPct'>): number {
  const profile = CATEGORY_PROFILES[cfg.category];
  if (!profile) return 0.97;
  const gap = cfg.bodyFatPct != null && profile.targetBodyFatPct != null ? cfg.bodyFatPct - profile.targetBodyFatPct : 0;
  if (profile.light) return 1.0;                        // bikini/wellness — мягкая сушка, объём полный
  if (cfg.bodyFatPct == null) return 0.97;              // не знаем %жира — чуть умереннее
  if (gap <= 2) return 0.98;                            // близко к цели — объём почти полный
  if (gap <= 5) return 0.96;                            // средний дефицит — лёгкое снижение
  return 0.93;                                          // агрессивный дефицит — но НЕ тапер
}

/** Множитель атлета (PED/стаж/уровень): кто восстанавливается лучше — держит больше объёма. */
export function prepAthleteMult(cfg: Pick<PrepCycleConfig, 'enhanced' | 'trainingYears' | 'level'>): number {
  let m = 1.0;
  const years = Number.isFinite(cfg.trainingYears) ? (cfg.trainingYears as number) : 0;
  if (cfg.enhanced) m *= 1.12;                          // курс — больше объёма под дефицитом
  if (cfg.level === 'enhanced' || cfg.level === 'advanced' || years >= 5) m *= 1.05;
  if (cfg.level === 'beginner' || years < 2) m *= 0.9;  // новичок — консервативнее
  return clamp(m, 0.9, 1.2);
}

/** Множитель восстановления (низкая готовность → чуть меньше объёма подготовки). */
export function prepRecoveryMult(cfg: Pick<PrepCycleConfig, 'hrvMs' | 'sleepHours' | 'stressLevel' | 'bodyFat'>): number {
  let m = 1.0;
  if (cfg.hrvMs != null && cfg.hrvMs < 50) m *= 0.97;
  if (cfg.sleepHours != null && cfg.sleepHours < 6) m *= 0.97;
  if (cfg.stressLevel != null && cfg.stressLevel >= 7) m *= 0.97;
  if (cfg.bodyFat != null && cfg.bodyFat > 25) m *= 0.98;
  return clamp(m, 0.9, 1.05);
}

/** План кардио подготовки (доказательно: в предсоревновательный период кардио растёт;
 *  da Silveira et al. 2025 — увеличение кардио у всех категорий). Zone 2 сохраняет мышцы в дефиците. */
export interface PrepCardioPlan {
  minutesPerWeek: number;
  stepsPerDay: number;
  zone: string;
  note: string;
}

export function prepCardioPlan(cfg: PrepCycleConfig): PrepCardioPlan {
  const profile = CATEGORY_PROFILES[cfg.category];
  // База по категории: лёгкие (bikini/wellness) — меньше, массовые/агрессивные — больше.
  let base = 220;
  if (profile) {
    if (profile.light) base = 170;
    else if (profile.sex === 'female') base = 210;
    else if (profile.targetBodyFatPct <= 5) base = 280; // mens_bb/212/classic — суше
  }
  const gap = cfg.bodyFatPct != null && profile ? Math.max(0, cfg.bodyFatPct - profile.targetBodyFatPct) : 3;
  const deficitBoost = gap > 5 ? 70 : gap > 2 ? 35 : 0; // дальше от цели — больше кардио
  const athleteBoost = cfg.enhanced ? 40 : 0;           // на курсе переносимость кардио выше
  const minutes = clamp(Math.round(base + deficitBoost + athleteBoost), 120, 450);
  const stepsPerDay = Math.min(16000, 8000 + Math.round((minutes - 150) / 25) * 500);
  return {
    minutesPerWeek: minutes,
    stepsPerDay,
    zone: 'Zone 2 (лёгкое, ~60–70% ЧССmax) — расход ккал в дефиците, мышцы сохраняются',
    note: `Кардио в подготовке растёт (da Silveira 2025). Рекомендуем ~${minutes} мин/нед Zone 2 + ~${stepsPerDay} шагов/день. Не заменяет силовую — объём держим на уровне ББ-авто.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// План питания подготовки (направление «Подготовка питание»)
// ═══════════════════════════════════════════════════════════════════════════

/** Категорийная пик-тренировка (направление D): для лёгких категорий (bikini/wellness)
 *  деплеция мягче (меньше объёма, больше отдыха/позирования), для массовых — полный протокол. */
export interface PeakTrainingProfile {
  category: BBContestCategory;
  type: string;
  minutesPerDepleteDay: number;
  pumpBackstageMinutes: number;
  notes: string[];
}

export function peakTrainingProfile(cfg: PrepCycleConfig): PeakTrainingProfile {
  const profile = CATEGORY_PROFILES[cfg.category];
  const light = !!profile?.light;
  const mass = !!profile && profile.targetBodyFatPct <= 5;
  return {
    category: cfg.category,
    type: light ? 'Мягкая деплеция (лёгкие категории)' : mass ? 'Полный протокол деплеции (массовые)' : 'Стандартная деплеция',
    minutesPerDepleteDay: light ? 30 : mass ? 50 : 40,
    pumpBackstageMinutes: light ? 20 : 25,
    notes: [
      light
        ? 'Bikini/Wellness: 2 лёгких круга по 30 мин, мягкая сухость, больше отдыха и позирования — не перетруждать.'
        : mass
          ? 'Bodybuilding/212: 3 круга по 50 мин — полная деплеция гликогена, затем памп-нагрузка backstage.'
          : 'Стандартная деплеция 40 мин: 3 круга верх/низ, затем памп.',
      `Памп-рутинг backstage ~${light ? 20 : 25} мин: резинки, отжимания, лёгкие гантели 15-20 повт × 2-3 круга, без усталости.`,
      'Позирование в пик-неделю растёт к шоу (см. блок «🎭 Позирование»).',
    ],
  };
}

export interface PrepNutritionWeek {
  week: number;
  phase: string;               // preparation / final_preparation / taper / peak_week
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  refeed: boolean;             // неделя с 1 рефид-днём
  note: string;
}

export interface PrepNutritionPlan {
  weeks: PrepNutritionWeek[];
  macros: { proteinPerKg: [number, number]; fatFloorG: number; carbsMinG: number };
  refeedStrategy: string;
  mealTiming: string[];
  micronutrients: string[];
  hydration: string;
  cardioKcalPerWeek: number;
  femaleNotes: string[];
  note: string;
}

/** Полный план питания подготовки: недельная прогрессия калорий, макро-сплит,
 *  рефиды, тайминг белка, микронутриенты, гидратация, кардио-ккал.
 *  Доказательно: белок 2.2–2.5 г/кг (Helms 2017), жир-флор (RED-S), дефицит 0.25–0.75%/нед. */
export function buildPrepNutritionPlan(
  prepPlan: BBContestPrepPlan,
  cfg: PrepCycleConfig,
): PrepNutritionPlan {
  const profile = CATEGORY_PROFILES[cfg.category] ?? CATEGORY_PROFILES.mens_physique;
  const w = prepPlan.preparation.startingWeightKg || cfg.weightKg || 80;
  const sex = cfg.sex;
  const isFemale = sex === 'female';
  const proteinPerKg: [number, number] = profile.light
    ? [2.0, 2.2]                 // bikini/wellness — мягче
    : isFemale ? [2.2, 2.5] : [2.2, 2.5];
  const proteinG = Math.round(w * ((proteinPerKg[0] + proteinPerKg[1]) / 2));
  const fatFloorPerKg = isFemale ? 0.8 : 0.6;
  const fatFloorG = Math.max(isFemale ? 40 : 30, Math.round(w * fatFloorPerKg));
  const carbsMinG = 50;
  const baseKcal = Math.max(isFemale ? 1400 : 1200, Math.round(prepPlan.preparation.currentCalories || w * 31));
  const ratePct = clamp(prepPlan.preparation.targetRatePctPerWeek || 0.5, 0.25, 0.75);

  const prepWeeks = prepPlan.preparation.weeks;
  const taperWeeks = prepPlan.taper.weeks;
  const totalPrep = prepWeeks + taperWeeks;
  const weeks: PrepNutritionWeek[] = [];

  for (let i = 1; i <= totalPrep; i++) {
    const phaseRange = prepPhaseForWeek(prepPlan, i);
    const phaseKey = phaseRange?.key ?? (i <= prepWeeks ? 'preparation' : 'taper');
    let kcal = baseKcal;
    let carbsG: number;
    let note: string;
    let refeed = false;
    if (phaseKey === 'taper') {
      // Тапер: калории стабильны (усталость падает, катаболизм не нужен), карбс чуть выше (гликоген).
      kcal = baseKcal;
      carbsG = Math.max(carbsMinG, Math.round((kcal - proteinG * 4 - fatFloorG * 9) / 4));
      const wna = cfg.confirmedManipulation
        ? ' вода/натрий плавно снижаются к пик-неделе (подтверждено).'
        : ' вода/натрий стабильны.';
      note = `Тапер: калории стабильны, карбс слегка выше — подготовка гликогена к пик-неделе;${wna}`;
    } else if (phaseKey === 'final_preparation') {
      // Финал подготовки: лёгкий дефицит, рефид раз в неделю.
      kcal = Math.max(isFemale ? 1400 : 1200, Math.round(baseKcal * 0.97));
      refeed = true;
      carbsG = Math.max(carbsMinG, Math.round((kcal - proteinG * 4 - fatFloorG * 9) / 4));
      note = 'Финал подготовки: лёгкий дефицит (×0.97), белок и жиры не режутся, 1 рефид-день/нед.';
    } else {
      // Подготовка: ступенчатая прогрессия — каждые 2 недели −120 ккал (поддержание темпа).
      kcal = Math.max(isFemale ? 1400 : 1200, Math.round(baseKcal - Math.floor((i - 1) / 2) * 120));
      refeed = i % 3 === 0; // каждые 3 недели — рефид-день
      carbsG = Math.max(carbsMinG, Math.round((kcal - proteinG * 4 - fatFloorG * 9) / 4));
      note = `Подготовка (нед ${i}): дефицит ~${Math.round(ratePct * 100 * 10) / 10}%/нед${refeed ? ', 1 рефид-день (карбс до ~поддержания)' : ''}, вода/натрий стабильны.`;
    }
    weeks.push({ week: i, phase: phaseKey, kcal, proteinG, fatG: fatFloorG, carbsG, refeed, note });
  }

  // Пик-неделя: представительный день (шоу-день) из buildPeakWeek.
  const peakDay = buildPeakWeek({ ...configFromPlan(prepPlan), weeksOut: 1 })[6];
  if (peakDay) {
    weeks.push({
      week: totalPrep + 1,
      phase: 'peak_week',
      kcal: peakDay.kcal,
      proteinG: peakDay.proteinG,
      fatG: peakDay.fatG,
      carbsG: peakDay.carbsG,
      refeed: false,
      note: 'Пик-неделя: по протоколу buildPeakWeek (деплеция→загрузка→шоу).',
    });
  }

  const cardioKcalPerWeek = Math.round(prepCardioPlan(cfg).minutesPerWeek * 6); // Zone 2 ≈ 6 ккал/мин
  const micronutrients = [
    isFemale ? 'Железо: красное мясо/печень/шпинат 2-3×/нед (дефицит типичен для женской сушки).' : 'Железо: при усталости — красное мясо/печень 1-2×/нед.',
    'Кальций 1000-1200 мг/день (молочные/обогащённые) — кости при низком % жира.',
    'Магний 300-400 мг/день + калий 3500-4000 мг — анти-судороги, не снижать.',
    'Натрий ~2800 мг/день (стабильно) — в пик-неделю по протоколу.',
  ];
  const femaleNotes = isFemale
    ? [
        'RED-S: минимум 1400 ккал/день, энергетическая доступность ≥30 ккал/кг FFM.',
        'Темп ≤0.4%/нед (меньше жировой ткани), анализ по среднему за 7 дней.',
        'Лютеиновая фаза: задержка воды +0.5-1 кг — норма, не усиливайте дефицит.',
      ]
    : [];

  const mealTiming = [
    'Белок 0.4-0.55 г/кг вокруг тренировки (MPS-окно), кап ~50 г за приём.',
    'Распределение: 4-5 приёмов по 25-50 г белка каждый.',
    'Карбс вокруг тренировки (до/после) — гликоген и восстановление.',
  ];

  return {
    weeks,
    macros: { proteinPerKg, fatFloorG, carbsMinG },
    refeedStrategy: refeedWeeksText(weeks),
    mealTiming,
    micronutrients,
    hydration: `Вода ~3 л/день (женщины ≥1.5-2 л, минимум 40 мл/кг), натрий 2800 мг стабильно.`,
    cardioKcalPerWeek,
    femaleNotes,
    note: `План питания подготовки: белок ${proteinG} г (${proteinPerKg[0]}-${proteinPerKg[1]} г/кг), жиры ≥${fatFloorG} г, карбс на остаток (мин ${carbsMinG} г). Дефицит ${Math.round(ratePct * 1000) / 10}%/нед.`,
  };
}

/** Текст стратегии рефидов по неделям плана. */
function refeedWeeksText(weeks: PrepNutritionWeek[]): string {
  const ref = weeks.filter(w => w.refeed).map(w => w.week);
  return ref.length > 0
    ? `Рефид-дни (карбс до ~поддержания, жир ↓): нед ${ref.join(', ')}.`
    : 'Рефидов нет — короткий prep, строгий дефицит.';
}

// ═══════════════════════════════════════════════════════════════════════════
// Прогрессия нагрузки в подготовке (тренировочный прогресс, «прогресс»)
// ═══════════════════════════════════════════════════════════════════════════

export interface PrepProgressionWeek {
  week: number;
  phase: string;
  weightNote: string;
  repsRange: [number, number];
  rir: [number, number];
  intensityGuidance: string;
}

export interface PrepProgressionPlan {
  weeks: PrepProgressionWeek[];
  principle: string;
  note: string;
}

/** План прогрессии нагрузки по неделям (доказательно: в дефиците сохраняем ИНТЕНСИВНОСТЬ
 *  и прогрессируем нагрузку для сохранения мышц — Helms 2017; Schoenfeld 2021).
 *  - Подготовка: double progression (повторы → вес), RIR 1-2, вес базовых +2.5 кг / 2-3 нед.
 *  - Финальная подготовка: интенсивность сохраняется, объём чуть ниже.
 *  - Тапер: вес сохранён, RIR 2-4, без отказа и новых упражнений.
 *  - Пик-неделя: лёгкий памп (40-60% веса), без отказа. */
export function buildPrepProgression(prepPlan: BBContestPrepPlan, cfg: PrepCycleConfig): PrepProgressionPlan {
  const prepWeeks = prepPlan.preparation.weeks;
  const taperWeeks = prepPlan.taper.weeks;
  const total = prepWeeks + taperWeeks + 1;
  const weeks: PrepProgressionWeek[] = [];

  for (let i = 1; i <= total; i++) {
    const phaseRange = prepPhaseForWeek(prepPlan, i);
    const phase = phaseRange?.key ?? (i <= prepWeeks ? 'preparation' : i <= prepWeeks + taperWeeks ? 'taper' : 'peak_week');
    if (phase === 'preparation') {
      // Double progression: в заданном диапазоне повторов добавляем повторы, при верхней
      // границе — +2.5 кг (базовые) / +1 кг (изоляция). Каждые 2-3 нед — ступень веса.
      weeks.push({
        week: i,
        phase,
        weightNote: i % 3 === 1 ? 'Шаг веса: базовые +2.5 кг, изоляция +1 кг (после верхней границы повторов)' : 'Добавляйте повторы в диапазоне (double progression); вес не повышать до верхней границы',
        repsRange: [6, 12],
        rir: [1, 2],
        intensityGuidance: 'Интенсивность (вес) сохраняем/прогрессируем — защита мышц в дефиците (Helms 2017).',
      });
    } else if (phase === 'final_preparation') {
      weeks.push({
        week: i,
        phase,
        weightNote: 'Вес сохраняется, объём чуть ниже (×0.97); без форсирования',
        repsRange: [8, 12],
        rir: [2, 3],
        intensityGuidance: 'Не снижайте вес — только объём; RIR 2-3.',
      });
    } else if (phase === 'taper') {
      const tw = i - prepWeeks; // 1..taperWeeks
      const taperMult = 0.92 - 0.1 * (taperWeeks - tw); // последняя неделя тапера — ниже объём
      weeks.push({
        week: i,
        phase,
        weightNote: `Вес сохранён (~${Math.round(taperMult * 100)}% объёма), без отказа, без новых упражнений`,
        repsRange: [6, 10],
        rir: [2, 4],
        intensityGuidance: 'Интенсивность сохраняется (Bosquet 2005): вес тот же, объём ↓, RIR 2-4.',
      });
    } else {
      weeks.push({
        week: i,
        phase,
        weightNote: 'Пик-неделя: лёгкий памп 40-60% веса, 2-3 сета, без отказа',
        repsRange: [12, 15],
        rir: [3, 5],
        intensityGuidance: 'Деплеция → загрузка; только памп, усталость минимальна.',
      });
    }
  }

  return {
    weeks,
    principle: 'Double progression в дефиците: добавляем повторы, затем вес; интенсивность сохраняем всю подготовку; тапер — вес тот же, объём ↓.',
    note: 'Прогрессия веса в плане уже заложена (buildBBPlan: prescribeLoad + RIR-дрейф + авторегуляция из дневника). Блок — сводка по неделям.',
  };
}

/** План объёма подготовки (доказательный): подготовка ДЕРЖИТ объём на уровне обычного
 *  ББ-авто (MAV, PED/стаж/уровень/восстановление масштабируют вверх через buildBBPlan),
 *  снижение — только в финальном тапере (последние недели). Это НЕ режущий каскад с 1-й недели.
 *  Ориентир: 10–15 сетов/группу/нед × атлет-масштаб (Helms; Schoenfeld 2021; da Silveira 2025). */
export function prepVolumePlan(cfg: PrepCycleConfig, prepWeeks: number): PrepVolumePlan {
  const deficitMult = prepDeficitMult(cfg);
  const athleteMult = prepAthleteMult(cfg);
  const recoveryMult = prepRecoveryMult(cfg);
  // Стратегия пользователя влияет лишь на ФИНАЛЬНУЮ подготовку/переход к таперу (не на основную часть).
  const strategy = cfg.prepVolumeStrategy ?? 'balanced';
  const strategyMult = strategy === 'gentle' ? 1.02 : strategy === 'aggressive' ? 0.97 : 1.0;
  // ВАЖНО: prep держит объём ~MAV (×1.0). Множители почти не режут (нижняя граница 0.92).
  const global = clamp(deficitMult * athleteMult * recoveryMult * strategyMult, 0.92, 1.1);
  const base: Array<Omit<PrepVolumePhase, 'volumeMult'> & { base: number }> = [
    { fromPct: 0, toPct: 0.6, base: 1.0, rir: [1, 2] },     // основная подготовка — полный объём (MAV)
    { fromPct: 0.6, toPct: 0.9, base: 0.98, rir: [1, 2] },  // середина — минимальное снижение
    { fromPct: 0.9, toPct: 1.0, base: 0.95, rir: [2, 3] },  // финал подготовки — лёгкий (НЕ тапер)
  ];
  const phases: PrepVolumePhase[] = base.map(p => ({
    fromPct: p.fromPct,
    toPct: p.toPct,
    volumeMult: clamp(p.base * global, 0.92, 1.0),
    rir: p.rir,
  }));
  const strategyLabel = strategy === 'gentle' ? 'сохранить массу' : strategy === 'aggressive' ? 'агрессивная сушка' : 'сбалансированная';
  // Масштабированный целевой объём: база 10–15 (натурал/средний стаж) × атлет-множитель
  // (PED/стаж/уровень). У продвинутого на курсе целевой объём на группу заметно выше.
  const scaledTargetSetsPerMusclePerWeek: [number, number] = [
    Math.round(10 * athleteMult),
    Math.round(15 * athleteMult),
  ];
  const note = `объём ≈ обычного ББ-авто (MAV) · база 10–15 сетов/группу/нед → с учётом PED/стажа/уровня ×${athleteMult.toFixed(2)} = ~${scaledTargetSetsPerMusclePerWeek[0]}–${scaledTargetSetsPerMusclePerWeek[1]} · стратегия «${strategyLabel}» · дефицит ×${deficitMult.toFixed(2)} · восстановление ×${recoveryMult.toFixed(2)}${cfg.calorieSurplus != null && cfg.calorieSurplus < 0 ? ` · дефицит питания уже учтён в buildBBPlan (nutrition ×${computeBBNutritionMultiplier({ calorieSurplus: cfg.calorieSurplus, proteinPerKg: cfg.proteinPerKg }).toFixed(2)})` : ''}`;
  return {
    phases,
    deficitMult,
    athleteMult,
    recoveryMult,
    targetSetsPerMusclePerWeek: [10, 15] as [number, number],
    scaledTargetSetsPerMusclePerWeek,
    note,
  };
}

/** Подфаза плана для недели (1-index) prep-блока. */
export function prepVolumePhaseForWeek(plan: PrepVolumePlan, week: number, prepWeeks: number): PrepVolumePhase | null {
  if (prepWeeks <= 0) return null;
  const pct = (week - 0.5) / prepWeeks;
  return plan.phases.find(p => pct >= p.fromPct && pct < p.toPct)
    ?? plan.phases[plan.phases.length - 1]
    ?? null;
}

/** Наложить каскад объёма подготовки на готовый план (prep + final_preparation недели),
 *  затем нормализовать тапер-недели, чтобы объём монотонно нисходил к пик-неделе
 *  (base buildBBPlan сам рамп-апит финальные недели — иначе тапер был бы выше prep-финала). */
export function applyPrepVolumeCascade(
  plan: BBPlanWithPrep,
  cfg: PrepCycleConfig,
  prepWeeks: number,
  volumePlan?: PrepVolumePlan,
): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan;
  const vp = volumePlan ?? prepVolumePlan(cfg, prepWeeks);
  // Минимальные мышцы: убираем warmup-активаторы (иначе в UI дубль «разминка + рабочее» той же мышцы).
  const minimalCanonical = new Set((cfg.minimalMuscles || []).map(canonicalMuscle));
  const weeks: any[] = (plan.weeks as any[]).map((wk, idx) => {
    const phaseKey = wk.contestPhase;
    if (phaseKey !== 'preparation' && phaseKey !== 'final_preparation') return wk;
    const pv = prepVolumePhaseForWeek(vp, idx + 1, prepWeeks);
    if (!pv) return wk;
    const mult = pv.volumeMult;
    const rir = pv.rir;
    const sessions = (wk.sessions || []).map((s: any) => ({
      ...s,
      exercises: (s.exercises || [])
        .filter((e: any) => !((e as any).warmupActivator && minimalCanonical.has(canonicalMuscle(e.muscle || ''))))
        .map((e: any) => {
        const baseSets = (e as any)._baseSets ?? e.sets ?? 0;
        const newSets = Math.max(2, Math.round(baseSets * mult));
        const source = e.workSets || [];
        const workSets = source.slice(0, newSets).map((ws: any) => ({ ...ws, rir }));
        return {
          ...e,
          sets: newSets,
          rir: clamp(rir[0], 1, 4),
          workSets: newSets >= workSets.length ? workSets : workSets.slice(0, newSets),
          comment: `${e.comment || ''} 📉 Подготовка: объём ×${Math.round(mult * 100)}% (фаза), RIR ${rir[0]}-${rir[1]}, вес сохраняется.`,
        };
      }),
    }));
    return {
      ...wk,
      sessions,
      prepProtocol: `Подготовка (нед ${idx + 1}/${prepWeeks}): объём ×${Math.round(mult * 100)}%, RIR ${rir[0]}-${rir[1]}, вес сохраняется.`,
    };
  });

  // Если день (сессия) оказался почти пустым из-за исключённых мышц (<6 рабочих сетов) —
  // убираем его в prep-неделях: пустой день → отдых (не тратим время/день впустую).
  const workingSetsOf = (s: any) => (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0);
  for (const wk of weeks) {
    if (wk.contestPhase === 'preparation' || wk.contestPhase === 'final_preparation') {
      wk.sessions = (wk.sessions || []).filter((s: any) => workingSetsOf(s) >= 6);
    }
  }

  // Нормализация prep-кривой: buildBBPlan рамп-апит объём к финалу (×0.85→×1.10),
  // а prep должен ДЕРЖАТЬ и нисходить к таперу. Якорим prep к ПЕРВОЙ prep-неделе
  // и масштабируем последующие вниз по фазовому множителю (монотонная кривая).
  const prepIdx = weeks.map((w, i) => [w, i] as const).filter(([w]) => w.contestPhase === 'preparation' || w.contestPhase === 'final_preparation');
  if (prepIdx.length >= 2) {
    const firstIdx = prepIdx[0][1];
    const firstTotal = weeks[firstIdx].sessions.reduce((a: number, s: any) => a + (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    if (firstTotal > 0) {
      for (const [, i] of prepIdx) {
        if (i === firstIdx) continue;
        const pv = prepVolumePhaseForWeek(vp, i + 1, prepWeeks);
        const firstPv = prepVolumePhaseForWeek(vp, firstIdx + 1, prepWeeks);
        const target = firstTotal * ((pv?.volumeMult ?? 1) / (firstPv?.volumeMult ?? 1));
        const cur = weeks[i].sessions.reduce((a: number, s: any) => a + (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
        if (cur <= 0) continue;
        const scale = target / cur;
        for (const s of weeks[i].sessions) for (const e of (s.exercises || [])) {
          if ((e as any).warmupActivator) continue;
          const newSets = Math.max(2, Math.round((e.sets || 0) * scale));
          e.sets = newSets;
          if (Array.isArray(e.workSets)) e.workSets = e.workSets.slice(0, newSets);
        }
      }
    }
  }

  // Нормализация тапера: якорь = средний объём финала подготовки × нисходящий фактор,
  // чтобы тапер гарантированно был ниже prep-финала (монотонная кривая к пику).
  const prepWk = weeks.filter((w: any) => w.contestPhase === 'preparation' || w.contestPhase === 'final_preparation');
  const setsOf = (w: any) => (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
  if (prepWk.length > 0) {
    const lateCount = Math.max(1, Math.floor(prepWk.length * 0.2));
    const lateAvg = prepWk.slice(-lateCount).reduce((a, w) => a + setsOf(w), 0) / lateCount;
    const taperIdx = weeks.map((w, i) => [w, i] as const).filter(([w]) => w.contestPhase === 'taper').map(([, i]) => i);
    const n = taperIdx.length;
    taperIdx.forEach((idx, k) => {
      // последняя тапер-неделя (перед пиком) — самая низкая
      const factor = clamp(0.92 - 0.1 * (n - 1 - k), 0.55, 1.0);
      weeks[idx] = scaleWeekToTarget(weeks[idx], lateAvg * factor);
    });
  }

  return { ...plan, weeks } as BBPlanWithPrep;
}

/** Prep-делоды в подготовке (микро-периодизация, направление B):
 *  каждые prepDeloadEvery недель подготовки — разгрузка (объём ×0.7, RIR +2),
 *  сброс усталости и сохранение мышц при длительном дефиците (Helms 2017). */
export function applyPrepDeloads(
  plan: BBPlanWithPrep,
  cfg: PrepCycleConfig,
  prepWeeks: number,
): BBPlanWithPrep {
  const every = Math.max(0, Math.round(cfg.prepDeloadEvery ?? 5));
  if (every <= 0 || !plan || !Array.isArray(plan.weeks)) return plan;
  const weeks = (plan.weeks as any[]).map((wk, idx) => {
    if (wk.contestPhase !== 'preparation' && wk.contestPhase !== 'final_preparation') return wk;
    const wk1 = idx + 1;
    if (wk1 % every !== 0) return wk;
    const sessions = (wk.sessions || []).map((s: any) => ({
      ...s,
      exercises: (s.exercises || []).map((e: any) => {
        const newSets = Math.max(2, Math.round((e.sets || 0) * 0.7));
        const rir = clamp((Number(e.rir) || 2) + 2, 2, 5);
        return { ...e, sets: newSets, rir, workSets: (e.workSets || []).slice(0, newSets).map((ws: any) => ({ ...ws, rir })), comment: `${e.comment || ''} 🔄 Prep-делод: объём ×70%, RIR +2 (разгрузка).` };
      }),
    }));
    return {
      ...wk,
      sessions: (sessions || []).filter((s: any) => (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0) >= 6),
      deload: true,
      phase: 'deload',
      prepProtocol: `Prep-делод (нед ${wk1}): объём ×70%, RIR +2 — сброс усталости, мышцы сохраняются.`,
    };
  });
  return { ...plan, weeks } as BBPlanWithPrep;
}

/** Per-muscle тапер (направление C): в тапер-неделях акцент-мышца щадится сильнее
 *  (объём ×1.25 к кривой, ≤ базы), минимальные режутся сильнее (×0.8), RIR 3-4.
 *  Метка «без новых упражнений» — финальный тапер не добавляет новое. */
export function applyPrepTaperSparing(plan: BBPlanWithPrep, cfg: PrepCycleConfig): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks)) return plan;
  const accentCanonical = new Set((cfg.accentMuscles || []).map(canonicalMuscle));
  const minimalCanonical = new Set((cfg.minimalMuscles || []).map(canonicalMuscle));
  const weeks = (plan.weeks as any[]).map((wk) => {
    if (wk.contestPhase !== 'taper') return wk;
    const sessions = (wk.sessions || []).map((s: any) => ({
      ...s,
      exercises: (s.exercises || []).map((e: any) => {
        const m = canonicalMuscle(e.muscle || '');
        let mult = 1.0;
        if (accentCanonical.has(m)) mult = 1.1;      // спец-мышца щадится (без возврата к базе)
        else if (minimalCanonical.has(m)) mult = 0.8; // минимальная — режется сильнее
        const newSets = mult === 1.0 ? e.sets : Math.max(2, Math.round(e.sets * mult));
        return { ...e, sets: newSets, workSets: (e.workSets || []).slice(0, newSets), comment: `${e.comment || ''} ${accentCanonical.has(m) ? '⭐ Спец-тапер: объём щадится.' : minimalCanonical.has(m) ? '⬇ Минимальная: тапер сильнее.' : ''}` };
      }),
    }));
    return { ...wk, sessions, prepProtocol: `${wk.prepProtocol || ''} 📉 Тапер: без новых упражнений, интенсивность сохраняется, RIR 2-4.` };
  });
  // Гарантия монотонного спуска тапера: каждая тапер-неделя ≤ предыдущей (к пику объём только ↓).
  const taperIdx = weeks.map((w, i) => [w, i] as const).filter(([w]) => w.contestPhase === 'taper').map(([, i]) => i);
  for (let k = 1; k < taperIdx.length; k++) {
    const prev = totalSetsOfWeek(weeks[taperIdx[k - 1]]);
    const cur = totalSetsOfWeek(weeks[taperIdx[k]]);
    if (cur > prev) weeks[taperIdx[k]] = scaleWeekToTarget(weeks[taperIdx[k]], prev);
  }
  return { ...plan, weeks } as BBPlanWithPrep;
}

/** Суммарные рабочие сеты недели. */
function totalSetsOfWeek(wk: any): number {
  return (wk.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
}

/** Пик-неделя: свести к лёгкому пампу (~18 сетов, 2 сета × 12-15, лёгкий вес, RIR 4) —
 *  не тяжёлая тренировка, только налить мышцы кровью. */
export function applyPrepPeakReduction(plan: BBPlanWithPrep): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks)) return plan;
  const weeks = (plan.weeks as any[]).map((wk) => {
    if (wk.contestPhase !== 'peak_week') return wk;
    let sessions = (wk.sessions || []).map((s: any) => ({
      ...s,
      // Пик-неделя: максимум 3 упражнения на сессию, 2 сета, лёгкий вес, памп.
      exercises: (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).slice(0, 3).map((e: any) => ({
        ...e,
        sets: 2,
        rir: 4,
        repsRange: [12, 15],
        weight: Math.max(5, Math.round((Number(e.weight) || 0) * 0.5)),
        workSets: (e.workSets || []).slice(0, 2).map((ws: any) => ({ ...ws, rir: 4, reps: 14 })),
        comment: `${e.comment || ''} 🎭 Пик-неделя: памп 2 сета × 12-15, ~50% веса, без отказа.`,
      })),
    }));
    // Свести к ~18 рабочим сетам на всю пик-неделю (памп, не объём).
    const total = sessions.reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    if (total > 18) sessions = scaleWeekToTarget({ sessions }, 18).sessions;
    return { ...wk, sessions, prepProtocol: `${wk.prepProtocol || ''} 🎭 Пик-неделя: лёгкий памп ~18 сетов, без отказа.` };
  });
  return { ...plan, weeks } as BBPlanWithPrep;
}

/** Пропорционально привести суммарные сеты недели к целевому значению (мин 2 сета/упражнение),
 *  при нехватке — отбрасывая хвостовые accessory-упражнения (тапер/подготовка снижают плотность). */
function scaleWeekToTarget(week: any, target: number): any {
  const sessions: any[] = (week.sessions || []).map((s: any) => ({ ...s, exercises: (s.exercises || []).map((e: any) => ({ ...e })) }));
  let total = sessions.reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
  if (total <= 0 || target <= 0) return week;
  // 1) пропорционально снизить сеты (мин 2)
  const ratio = target / total;
  for (const s of sessions) {
    s.exercises = (s.exercises || []).map((e: any) => {
      const sets = Math.max(2, Math.round((e.sets || 0) * ratio));
      return { ...e, sets, workSets: (e.workSets || []).slice(0, sets), comment: `${e.comment || ''} 📉 Тапер (по подготовке): объём ~${Math.round(ratio * 100)}%.` };
    });
  }
  total = sessions.reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
  // 2) если всё ещё выше цели — отбрасываем accessory с конца, пока не влезет
  let guard = 0;
  while (total > target && guard < 400) {
    guard++;
    let dropSi = -1, dropEi = -1;
    for (let si = sessions.length - 1; si >= 0 && dropSi < 0; si--) {
      const exs = sessions[si].exercises || [];
      for (let ei = exs.length - 1; ei >= 0; ei--) {
        if (exs[ei].role === 'accessory') { dropSi = si; dropEi = ei; break; }
      }
    }
    if (dropSi < 0 || dropEi < 0) break;
    total -= sessions[dropSi].exercises[dropEi].sets || 0;
    sessions[dropSi].exercises.splice(dropEi, 1);
  }
  return { ...week, sessions };
}

/** Дата старта подготовки (ISO) от showDate минус N недель. */
function prepStartDateRaw(showDate: string, weeksBack: number): string {
  const [y, m, d] = showDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 7 * weeksBack);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Прогноз сушки к дате шоу (контроль подготовки, P3.2)
// ═══════════════════════════════════════════════════════════════════════════

export interface PrepCutProjection {
  currentWeightKg: number;
  targetBodyFatPct: number;
  currentBodyFatPct: number | null;
  /** Целевой вес для достижения %жира категории (null без текущего %жира). */
  targetWeightKg: number | null;
  /** Реалистичная потеря кг/нед по темпу плана. */
  weeklyRateKg: number;
  weeksToShow: number;
  /** Недель до целевого веса при текущем темпе (null без %жира). */
  weeksToTarget: number | null;
  canReachByShow: boolean;
  /** Прогнозируемый вес на день шоу при текущем темпе. */
  projectedShowWeightKg: number | null;
  note: string;
}

/** Прогноз сушки: до целевого %жира категории и до дня шоу (не подгоняет план). */
export function prepCutProjection(
  prepPlan: BBContestPrepPlan,
  currentWeightKg: number,
  currentBodyFatPct?: number,
): PrepCutProjection {
  const profile = CATEGORY_PROFILES[prepPlan.category] ?? CATEGORY_PROFILES.mens_physique;
  const targetBf = profile.targetBodyFatPct;
  const w = Number.isFinite(currentWeightKg) && currentWeightKg > 30 ? currentWeightKg : prepPlan.preparation.startingWeightKg || 80;
  const ratePct = clamp(prepPlan.preparation.targetRatePctPerWeek || 0.5, 0.1, 1.5);
  const rateKg = (ratePct / 100) * w;
  const weeksToShow = Math.max(0, Math.round(isoDiffDays(isoToday(), prepPlan.showDate) / 7));

  const hasBf = currentBodyFatPct != null && Number.isFinite(currentBodyFatPct) && currentBodyFatPct > 2;
  let targetWeight: number | null = null;
  let weeksToTarget: number | null = null;
  if (hasBf) {
    const lean = w * (1 - (currentBodyFatPct as number) / 100);
    targetWeight = Math.max(30, Math.round((lean / (1 - targetBf / 100)) * 10) / 10);
    weeksToTarget = rateKg > 0 ? Math.max(0, Math.round((w - targetWeight) / rateKg)) : null;
  }
  const canReach = weeksToTarget == null || weeksToTarget <= weeksToShow;
  const projectedShowWeight = weeksToShow >= 0 ? Math.max(30, Math.round((w - rateKg * weeksToShow) * 10) / 10) : w;

  let note: string;
  if (!hasBf) {
    note = 'Укажите текущий %жира, чтобы оценить целевую сухость категории и темп к шоу.';
  } else if (weeksToTarget != null && weeksToTarget <= weeksToShow) {
    note = `Цель ~${targetWeight} кг (${targetBf}%) достижима за ~${weeksToTarget} нед — укладываетесь в ${weeksToShow} нед до шоу. Держите темп ~${rateKg.toFixed(1)} кг/нед.`;
  } else {
    note = `До цели (~${targetWeight} кг) нужно ~${weeksToTarget} нед при темпе ${rateKg.toFixed(1)} кг/нед — к шоу (${weeksToShow} нед) не успеете. Увеличьте дефицит умеренно или скорректируйте цель/дату.`;
  }

  return {
    currentWeightKg: w,
    targetBodyFatPct: targetBf,
    currentBodyFatPct: hasBf ? currentBodyFatPct : null,
    targetWeightKg: targetWeight,
    weeklyRateKg: Math.round(rateKg * 10) / 10,
    weeksToShow,
    weeksToTarget,
    canReachByShow: canReach,
    projectedShowWeightKg: projectedShowWeight,
    note,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Сезон: цепочка prep-циклов под несколько соревнований (P3.3)
// ═══════════════════════════════════════════════════════════════════════════

/** Конфиг сезона: общие параметры спортсмена/акцентов + список стартов. */
export interface PrepSeasonConfig {
  sex: 'male' | 'female';
  category: BBContestCategory;
  accentMuscles: string[];
  minimalMuscles: string[];
  minimalMode?: PrepMinimalMode;
  splitPatternId?: string;
  level: string;
  trainingYears?: number;
  trainingFocus?: BBTrainingFocus;
  equipment?: string[];
  injuries?: Injury[];
  mobilityRestrictions?: string[];
  workMax?: Record<string, number>;
  avoidAxialLoad?: boolean;
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  intensityTechnique?: BBBuilderInput['intensityTechnique'];
  autoDeload?: boolean;
  deloadType?: BBBuilderInput['deloadType'];
  loadStrategy?: BBBuilderInput['loadStrategy'];
  autoRegResult?: BBBuilderInput['autoRegResult'];
  methodology?: BBBuilderInput['methodology'];
  labWarnings?: string[];
  labIntensityNote?: string;
  eccentricMult?: number;
  previousPlan?: BBPlan;
  supersetMode?: BBBuilderInput['supersetMode'];
  volumeScheme?: BBBuilderInput['volumeScheme'];
  /** DUP-периодизация (применяется overlay поверх плана, как в обычном ББ-авто). */
  dupMode?: DUPMode;
  proteinPerKg?: number;
  calorieSurplus?: number;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
  enhanced: boolean;
  pedDoses?: Record<string, number>;
  courseIntensity?: CourseIntensity;
  weightKg: number;
  bodyFatPct?: number;
  experienceLevel: ExperienceLevel;
  prepCount?: number;
  prepVolumeMult?: number;
  /** Стратегия объёма подготовки (крутизна каскада): gentle/balanced/aggressive. */
  prepVolumeStrategy?: PrepVolumeStrategy;
  /** Prep-делод каждые N недель подготовки (0 = выкл; дефолт 5). */
  prepDeloadEvery?: number;
  currentCalories?: number;
  carbLoadStrategy?: CarbLoadStrategy;
  waterStrategy?: WaterStrategy;
  sodiumStrategy?: SodiumStrategy;
  confirmedManipulation?: boolean;
  contraindications?: string[];
  /** Соревнования сезона (сортируются по дате). */
  competitions: ContestEventEntry[];
  /** Длительность одного prep-блока между стартами (4-26; усекается, если не влезает). */
  prepWeeksPerComp?: number;
  taperWeeks?: number;
}

export interface PrepSeasonResult {
  /** Цепочка циклов, по одному на старт (порядок по дате). */
  cycles: PrepCycleResult[];
  /** Сводка «дата → старт → подготовка/тапер/пик». */
  summary: Array<{ date: string; name: string; priority?: 'A' | 'B' | 'C'; prepWeeks: number; taperWeeks: number; totalWeeks: number }>;
  warnings: string[];
}

/** Собрать сезон: для каждого старта отдельный prep-цикл, тапер/пик к его дате. */
export function buildPrepSeason(cfg: PrepSeasonConfig): PrepSeasonResult {
  const comps = (cfg.competitions || [])
    .filter(c => c && c.date && c.name)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));
  if (comps.length === 0) throw new Error('Сезон: укажите хотя бы одно соревнование с датой.');

  const userWeeks = clamp(Math.round(cfg.prepWeeksPerComp ?? 12), 4, 26);
  const taperWeeks = clamp(Math.round(cfg.taperWeeks ?? 3), 1, 4);
  const warnings: string[] = [];
  const cycles: PrepCycleResult[] = [];
  const summary: PrepSeasonResult['summary'] = [];

  let prevDate: string | null = null;
  for (let i = 0; i < comps.length; i++) {
    const comp = comps[i];
    // Подготовка не должна залезать на предыдущий старт.
    let prepWeeks = userWeeks;
    if (prevDate) {
      const gapWeeks = Math.floor(isoDiffDays(prevDate, comp.date!) / 7);
      prepWeeks = Math.min(prepWeeks, Math.max(1, gapWeeks - taperWeeks - 1));
    }
    if (prepWeeks < 3) {
      warnings.push(`⚠ Старт «${comp.name}» (${comp.date}) идёт рано после предыдущего — подготовка усечена до ${prepWeeks} нед (только ${taperWeeks} нед тапера + пик).`);
    }
    const totalWeeks = prepWeeks + taperWeeks + 1;
    const cycleCfg: PrepCycleConfig = {
      category: cfg.category,
      sex: cfg.sex,
      accentMuscles: cfg.accentMuscles,
      minimalMuscles: cfg.minimalMuscles,
      minimalMode: cfg.minimalMode,
      splitPatternId: cfg.splitPatternId,
      weeks: totalWeeks,
      taperWeeks,
      showDate: comp.date!,
      level: cfg.level,
      trainingYears: cfg.trainingYears,
      trainingFocus: cfg.trainingFocus,
      equipment: cfg.equipment,
      injuries: cfg.injuries,
      mobilityRestrictions: cfg.mobilityRestrictions,
      workMax: cfg.workMax,
      avoidAxialLoad: cfg.avoidAxialLoad,
      bodyweightCapability: cfg.bodyweightCapability,
      favoriteExercises: cfg.favoriteExercises,
      excludedExercises: cfg.excludedExercises,
      intensityTechnique: cfg.intensityTechnique,
      autoDeload: cfg.autoDeload,
      deloadType: cfg.deloadType,
      loadStrategy: cfg.loadStrategy,
      autoRegResult: cfg.autoRegResult,
      methodology: cfg.methodology,
      labWarnings: cfg.labWarnings,
      labIntensityNote: cfg.labIntensityNote,
      eccentricMult: cfg.eccentricMult,
      previousPlan: cfg.previousPlan,
      supersetMode: cfg.supersetMode,
      volumeScheme: cfg.volumeScheme,
      dupMode: cfg.dupMode,
      proteinPerKg: cfg.proteinPerKg,
      calorieSurplus: cfg.calorieSurplus,
      bodyFat: cfg.bodyFat,
      leanMass: cfg.leanMass,
      hrvMs: cfg.hrvMs,
      sleepHours: cfg.sleepHours,
      stressLevel: cfg.stressLevel,
      labMrvMultiplier: cfg.labMrvMultiplier,
      enhanced: cfg.enhanced,
      pedDoses: cfg.pedDoses,
      courseIntensity: cfg.courseIntensity,
      weightKg: cfg.weightKg,
      bodyFatPct: cfg.bodyFatPct,
      experienceLevel: cfg.experienceLevel,
      prepCount: cfg.prepCount,
      prepVolumeMult: cfg.prepVolumeMult,
      prepVolumeStrategy: cfg.prepVolumeStrategy,
      currentCalories: cfg.currentCalories,
      carbLoadStrategy: cfg.carbLoadStrategy,
      waterStrategy: cfg.waterStrategy,
      sodiumStrategy: cfg.sodiumStrategy,
      confirmedManipulation: cfg.confirmedManipulation,
      contraindications: cfg.contraindications,
      competitions: comps.map(c => ({ id: c.id, name: c.name, date: c.date, priority: c.priority })),
      mainCompetitionId: comp.id,
    };
    const cycle = buildPrepCycle(cycleCfg);
    cycles.push(cycle);
    summary.push({
      date: comp.date!,
      name: comp.name,
      priority: comp.priority,
      prepWeeks,
      taperWeeks,
      totalWeeks,
    });
    prevDate = comp.date!;
  }

  return { cycles, summary, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// Позирование к шоу (P3.1): обязательные позы по категории + дневной чек-ин
// ═══════════════════════════════════════════════════════════════════════════

export interface PosingProfile {
  category: BBContestCategory;
  /** Обязательные позы для категории. */
  poses: string[];
  /** Рекомендуемые минуты ежедневного позирования. */
  minutesPerDay: number;
  note: string;
}

const BASE_BB_POSES = ['Передний двойной бицепс', 'Передняя широчайшая', 'Боковой грудной', 'Задний двойной бицепс', 'Задняя широчайшая', 'Боковой трицепс', 'Пресс и бедро', 'Мост Геркулеса'];
const BASE_FEMALE_POSES = ['Передний двойной бицепс', 'Передняя широчайшая', 'Боковой', 'Задний двойной бицепс', 'Задняя', 'Пресс и бедро'];

export const POSING_PROFILES: Record<BBContestCategory, PosingProfile> = {
  mens_bb:        { category: 'mens_bb', poses: BASE_BB_POSES, minutesPerDay: 30, note: 'Полный набор обязательных поз, зернистость и сепарация — позы держать по 3-5 сек.' },
  bb_212:         { category: 'bb_212', poses: BASE_BB_POSES, minutesPerDay: 30, note: 'Полный набор поз; следить за шириной спины при вакууме.' },
  classic_physique: { category: 'classic_physique', poses: [...BASE_BB_POSES, 'Вакуум'], minutesPerDay: 25, note: 'Классика: добавить вакуум и удержание классических линий.' },
  mens_physique:  { category: 'mens_physique', poses: ['Передняя стойка', 'Задняя стойка (руки на бёдрах)', 'Четверть поворота'], minutesPerDay: 20, note: 'Позирование в шортах: стойки на расслабленных руках, акцент V-taper.' },
  bikini:         { category: 'bikini', poses: ['Передняя стойка', 'Боковая стойка', 'Задняя стойка'], minutesPerDay: 15, note: 'Плавные повороты и стойки fitness-модели, мягкая подача.' },
  figure:         { category: 'figure', poses: BASE_FEMALE_POSES, minutesPerDay: 20, note: 'Мышечная сепарация верха — чёткие двойные бицепсы и широчайшие.' },
  wellness:       { category: 'wellness', poses: ['Передняя стойка', 'Задний двойной бицепс', 'Задняя стойка', 'Боковая стойка'], minutesPerDay: 18, note: 'Акцент на нижнюю часть тела (ягодицы/бёдра) при мягкой подаче верха.' },
  womens_physique:{ category: 'womens_physique', poses: BASE_FEMALE_POSES, minutesPerDay: 25, note: 'Выраженная мышечность, полный набор женских поз.' },
  womens_bb:      { category: 'womens_bb', poses: BASE_BB_POSES, minutesPerDay: 30, note: 'Полный набор поз, максимум массы и зернистости.' },
};

export function posingPlanForCategory(category: BBContestCategory): PosingProfile {
  return POSING_PROFILES[category] ?? POSING_PROFILES.mens_physique;
}

/** Дневной чек-ин позирования. */
export interface PosingCheckin {
  date: string;
  minutes: number;
  note?: string;
}

const POSING_KEY = 'he_prep_posing_v1';

export function getPosingCheckins(): PosingCheckin[] {
  try {
    const raw = JSON.parse(localStorage.getItem(POSING_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((e: unknown) => e && typeof (e as PosingCheckin).date === 'string' && (e as PosingCheckin).date)
      : [];
  } catch { return []; }
}

/** Сохранить/заменить чек-ин за дату. */
export function savePosingCheckin(entry: PosingCheckin): PosingCheckin[] {
  const list = getPosingCheckins().filter(e => e.date !== entry.date);
  const next = [...list, { date: entry.date, minutes: Math.max(0, Math.round(Number(entry.minutes) || 0)), note: entry.note || undefined }];
  try { localStorage.setItem(POSING_KEY, JSON.stringify(next)); } catch { /* silent */ }
  return next;
}

/** Сводка позирования за последние N дней. */
export function posingWeekStats(checkins: PosingCheckin[], days = 7): { totalMin: number; days: number; avgMin: number } {
  const cutoff = isoAddDays(isoToday(), -(days - 1));
  const recent = checkins.filter(e => e.date >= cutoff);
  const totalMin = recent.reduce((a, e) => a + (e.minutes || 0), 0);
  return { totalMin, days: recent.length, avgMin: recent.length ? Math.round(totalMin / recent.length) : 0 };
}
