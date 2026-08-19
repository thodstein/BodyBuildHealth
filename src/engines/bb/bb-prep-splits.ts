/**
 * bb-prep-splits.ts — каталог prep-сплитов и знаний по категориям соревнований.
 *
 * Prep-цикл — это НЕ «просто сушка»: особый режим подготовки, где за длительность
 * цикла (4-26 нед) строится сплит под КОНКРЕТНУЮ категорию, с задаваемыми
 * пользователем мышцами-акцентами (для формы/баланса) и мышцами на минимальную
 * нагрузку, и со встроенным тапером/пик-неделей (переиспользует bb-contest-prep).
 *
 * Здесь — только знания (данные): рекомендуемые сплиты, дефолтные акценты/минимумы,
 * режим минимальной нагрузки по категории, подсказки. Логика сборки — в
 * bb-prep-cycle.engine.ts. Объёмная модель (MEV/MAV/MRV) не меняется.
 */

import type { BBContestCategory } from './bb-contest-prep.engine';
import type { VolumeTradeoffMode } from './bb-specialization.engine';
import type { BBTrainingFocus } from './bb-goal-types';

/** Режим минимальной нагрузки — выбор пользователя (см. bb-specialization). */
export type PrepMinimalMode = VolumeTradeoffMode;

export const PREP_MINIMAL_MODE_LABELS: Record<PrepMinimalMode, string> = {
  none: 'Не применять',
  reduce_direct_to_floor: 'Снизить до MEV-флора',
  remove_direct_when_indirect_covers_floor: 'Полностью исключить прямую',
};

/** Группы для выбора акцента (1-2) и минимума (N) в UI. */
export const PREP_ACCENT_OPTIONS: string[] = [
  'chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

/** Композиты раскрываются движком (legs/arms/core) — удобно для минимума. */
export const PREP_MINIMAL_OPTIONS: string[] = [
  'legs', 'arms', 'core', 'chest', 'back', 'shoulders',
  'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

export interface PrepSplitProfile {
  category: BBContestCategory;
  sex: 'male' | 'female';
  /** Сплиты, рекомендуемые для prep этой категории (ид из bb-split-patterns). */
  recommendedSplits: string[];
  /** Дефолтный акцент для формы/баланса категории (1-2). */
  defaultAccent: string[];
  /** Дефолтные мышцы на минимальную нагрузку (композиты допустимы). */
  defaultMinimal: string[];
  /** Training focus недель подготовки (Schoenfeld 2021). */
  trainingFocus: BBTrainingFocus;
  /** Какой goal передаётся в buildBBPlan (сохранение массы под дефицитом). */
  prepGoalHint: 'cut' | 'maintenance';
  /** Базовая склонность категории по режиму минимальных мышц. */
  minimalModePreference: PrepMinimalMode;
  /** Почему (текст для UI-подсказки). */
  balanceNote: string;
}

export const PREP_SPLIT_PROFILES: Record<BBContestCategory, PrepSplitProfile> = {
  // ── Мужские ──
  mens_physique: {
    category: 'mens_physique', sex: 'male',
    recommendedSplits: ['push_pull_2', 'upper_lower_4', 'arnold_6'],
    defaultAccent: ['shoulders', 'back'],
    defaultMinimal: ['quads', 'arms'],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'cut',
    minimalModePreference: 'reduce_direct_to_floor',
    balanceNote: 'V-taper: широкие плечи/спина, узкая талия. Ноги и руки — на минимальной нагрузке, чтобы не отвлекать ресурс от верхнего конуса.',
  },
  classic_physique: {
    category: 'classic_physique', sex: 'male',
    recommendedSplits: ['arnold_6', 'bro_5', 'torso_limb_4'],
    defaultAccent: ['chest', 'back'],
    defaultMinimal: ['arms'],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'maintenance',
    minimalModePreference: 'reduce_direct_to_floor',
    balanceNote: 'Классические пропорции: грудь/спина в акценте, руки — вторично. Масса сохраняется, баланс превыше всего.',
  },
  mens_bb: {
    category: 'mens_bb', sex: 'male',
    recommendedSplits: ['ppl_6', 'bro_5', 'arnold_6'],
    defaultAccent: ['back', 'chest'],
    defaultMinimal: [],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'maintenance',
    minimalModePreference: 'remove_direct_when_indirect_covers_floor',
    balanceNote: 'Максимум массы: акцент на главные массивы, минимальная нагрузка не задана — объём держим высоким до тапера.',
  },
  bb_212: {
    category: 'bb_212', sex: 'male',
    recommendedSplits: ['ppl_6', 'bro_5', 'arnold_6'],
    defaultAccent: ['back', 'chest'],
    defaultMinimal: [],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'maintenance',
    minimalModePreference: 'remove_direct_when_indirect_covers_floor',
    balanceNote: '212: масса в весовом лимите. Акцент на массивы, минимум не задан — нужен полный объём.',
  },
  // ── Женские ──
  bikini: {
    category: 'bikini', sex: 'female',
    recommendedSplits: ['glute_focus_4', 'female_glute_5', 'upper_lower_4'],
    defaultAccent: ['glutes'],
    defaultMinimal: ['quads', 'arms'],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'cut',
    minimalModePreference: 'reduce_direct_to_floor',
    balanceNote: 'Bikini: ягодицы в акценте, тяжёлые квадры и руки — минимально (мягкая форма, тон верхнего тела).',
  },
  figure: {
    category: 'figure', sex: 'female',
    recommendedSplits: ['torso_limb_4', 'upper_lower_4', 'push_pull_2'],
    defaultAccent: ['back', 'shoulders'],
    defaultMinimal: ['legs'],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'cut',
    minimalModePreference: 'reduce_direct_to_floor',
    balanceNote: 'Figure: мышечная сепарация и V-taper верха. Ноги — минимальная нагрузка, верх в акценте.',
  },
  wellness: {
    category: 'wellness', sex: 'female',
    recommendedSplits: ['female_glute_5', 'glute_focus_4', 'upper_lower_4'],
    defaultAccent: ['glutes', 'hamstrings'],
    defaultMinimal: ['quads'],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'cut',
    minimalModePreference: 'reduce_direct_to_floor',
    balanceNote: 'Wellness: нижняя часть тела (ягодицы+задняя поверхность бедра) в акценте, квадры — минимально для мягкой линии.',
  },
  womens_physique: {
    category: 'womens_physique', sex: 'female',
    recommendedSplits: ['ppl_6', 'arnold_6', 'torso_limb_4'],
    defaultAccent: ['back', 'chest'],
    defaultMinimal: [],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'maintenance',
    minimalModePreference: 'remove_direct_when_indirect_covers_floor',
    balanceNote: "Women's Physique: выраженная мышечность, полный объём. Акцент на верх, минимум не задан.",
  },
  womens_bb: {
    category: 'womens_bb', sex: 'female',
    recommendedSplits: ['ppl_6', 'arnold_6', 'bro_5'],
    defaultAccent: ['back', 'chest'],
    defaultMinimal: [],
    trainingFocus: 'hypertrophy',
    prepGoalHint: 'maintenance',
    minimalModePreference: 'remove_direct_when_indirect_covers_floor',
    balanceNote: "Women's Bodybuilding: максимум массы и зернистость. Минимум не задан — держим объём.",
  },
};

/** Профиль категории (с fallback на mens_physique/bikini по полу). */
export function prepSplitProfile(category: BBContestCategory): PrepSplitProfile {
  return PREP_SPLIT_PROFILES[category] ?? PREP_SPLIT_PROFILES.mens_physique;
}

/** Список prep-сплитов категории. */
export function prepSplitsForCategory(category: BBContestCategory): string[] {
  return prepSplitProfile(category).recommendedSplits;
}

/** Готов ли профиль (категория известна). */
export function isKnownPrepCategory(category: BBContestCategory): boolean {
  return category in PREP_SPLIT_PROFILES;
}
