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
import {
  buildBBContestPrepPlan, applyContestPrepToBBPlan, CATEGORY_PROFILES,
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
  equipment?: string[];
  injuries?: Injury[];
  mobilityRestrictions?: string[];
  workMax?: Record<string, number>;
  avoidAxialLoad?: boolean;

  // ── Восстановление/питание → MRV (как в обычном конструкторе) ──
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;

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
      block.tradeoff = { mode, donorMuscles: minimal, preserveIndirect: true };
    }
    specBlocks.push(block);
  }
  const schedule = buildSpecializationSchedule(undefined, undefined, true, totalWeeks, specBlocks);

  const prepStartIso = prepStartDateRaw(cfg.showDate, prepWeeks + taperWeeks);

  const input: BBBuilderInput = {
    patternId,
    level: cfg.level,
    goal: profile.prepGoalHint as BBGoal,
    weeks: totalWeeks,
    workMax: cfg.workMax ?? {},
    weakPoints: accent,
    focusGroup: accent[0],
    specialization: accent.length > 0,
    specializationSchedule: specBlocks.length > 0 ? specBlocks : undefined,
    equipment: cfg.equipment ?? [],
    volumeGoal: 'mav',
    avoidAxialLoad: cfg.avoidAxialLoad,
    injuries: cfg.injuries ?? [],
    mobilityRestrictions: cfg.mobilityRestrictions,
    sex: cfg.sex,
    planStartWeek: prepStartIso,
    courseIntensity: cfg.courseIntensity ?? 'moderate',
    trainingFocus: profile.trainingFocus,
    bodyFat: cfg.bodyFat,
    leanMass: cfg.leanMass,
    hrvMs: cfg.hrvMs,
    sleepHours: cfg.sleepHours,
    stressLevel: cfg.stressLevel,
    labMrvMultiplier: cfg.labMrvMultiplier,
    proteinPerKg: 2.0,
    calorieSurplus: profile.prepGoalHint === 'cut' ? -300 : 0,
  };

  let pedAdapt: PEDAdaptation | undefined;
  if (cfg.enhanced) {
    const peds: PED[] = ['AAS'];
    pedAdapt = adaptForPEDs(peds, input.workMax ?? {}, cfg.pedDoses, cfg.courseIntensity ?? 'moderate');
  }
  const bbPlan: BBPlan = buildBBPlan(input, pedAdapt);

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

  const bbPlanPrep = applyContestPrepToBBPlan(bbPlan, prepCfg, {
    prepWeeks,
    taperWeeks,
    prepVolumeMult: cfg.prepVolumeMult,
    force: true,
  });

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
    warnings,
    rationale: [
      `🏁 Prep-цикл: категория ${CATEGORY_PROFILES[cfg.category].label} (${cfg.sex}), ${totalWeeks} нед (подготовка ${prepWeeks} + тапер ${taperWeeks} + пик-неделя), шоу ${cfg.showDate}.`,
      `⭐ Акцент: ${accent.length ? accent.join(', ') : 'без акцента'} · минимальная нагрузка: ${minimal.length ? minimal.join(', ') : 'не задана'} (${PREP_MINIMAL_MODE_LABELS[mode]}).`,
      `📐 Сплит: ${patternId} · тренировочный фокус: ${profile.trainingFocus}.`,
    ],
  };
}

/** Дата старта подготовки (ISO) от showDate минус N недель. */
function prepStartDateRaw(showDate: string, weeksBack: number): string {
  const [y, m, d] = showDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 7 * weeksBack);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
