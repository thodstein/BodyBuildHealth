/**
 * pl-norms-bridge.engine.ts — мост «PL-авто → нормативы» (Фаза 6, п.2).
 *
 * Проблема, которую решает файл: нормативы разрядов и очки уже есть в
 * `pl-norms.engine` / `relative-strength.engine`, но в планировании сезона
 * спортсмен их не видел — он не знал, насколько целевой тотал недотягивает
 * до следующего разряда и какой это уровень по очкам.
 *
 * Здесь — единая точка: федерация сезона + пол + вес + целевые ПМ → тотал,
 * разряд, «сколько кг до следующего» и очки IPF GL.
 *
 * ЧЕСТНОСТЬ ДАННЫХ:
 *  • таблицы разрядов берутся ТОЛЬКО из справочника `pl-norms.engine` (ФПР/IPF,
 *    WRPF/СПР), а не выдумываются здесь;
 *  • соответствие «федерация сезона → таблица справочника» — приближение
 *    (`fed` в сезоне — это 'ipf' | 'fpr' | 'wpc' | 'other'), поэтому в результате
 *    всегда есть `note` с предупреждением сверить с официальной таблицей;
 *  • если таблицы нет (незнакомая федерация, женский WRPF) — разряд не
 *    считается, но очки IPF GL показываются как ориентир.
 */
import {
  classifyTotal,
  getNormTable,
  progressToNextRank,
  type ClassificationResult,
  type Discipline,
  type Federation,
  type Sex,
} from '../pl-norms.engine';
import { resolveCompetitionLifts } from './competition-attempts';
import { ipfGLPointsFor } from '../pro/relative-strength.engine';

/**
 * Федерация сезона → таблица нормативов справочника (классика).
 * 'other' намеренно отсутствует: своих нормативов для произвольной федерации
 * у нас нет, и придумывать их нельзя. Для экипировки — `resolveNormsFederation`.
 */
export const PL_FED_TO_NORMS: Record<string, Federation> = {
  ipf: 'fpr_classic',
  fpr: 'fpr_classic',
  wpc: 'wrpf_untested',
};

export const PL_FED_NORMS_LABEL: Record<string, string> = {
  ipf: 'ФПР / IPF — классика',
  fpr: 'ФПР / IPF — классика',
  wpc: 'WRPF / СПР (без ДК)',
};

/**
 * Федерации с РАЗНЫМИ таблицами для классики и экипировки (ФПР ведёт обе).
 * Для остальных выбор экипировки меняет только очки IPF GL — таблица та же.
 */
export function resolveNormsFederation(fed: string, gear: PLGear = 'classic'): Federation | null {
  if (fed === 'ipf' || fed === 'fpr') return gear === 'classic' ? 'fpr_classic' : 'fpr_equipped';
  if (fed === 'wpc') return 'wrpf_untested';
  return null;
}

export function normsFedLabel(fed: string, gear: PLGear = 'classic'): string {
  if (fed === 'ipf' || fed === 'fpr') return gear === 'classic' ? 'ФПР / IPF — классика' : 'ФПР / IPF — экипировка';
  if (fed === 'wpc') return 'WRPF / СПР (без ДК)';
  return 'Ваша федерация';
}

/** Экипировка: классика / однослой / многослой. */
export type PLGear = 'classic' | 'single-ply' | 'multi-ply';

/** В формулу IPF GL обе экипировки идут как «eq» (отдельных коэффициентов для многослоя нет). */
export function gearToGL(gear: PLGear): 'classic' | 'equipped' {
  return gear === 'classic' ? 'classic' : 'equipped';
}

export const PL_GEAR_LABEL: Record<PLGear, string> = {
  classic: 'Классика (raw)',
  'single-ply': 'Однослой (single-ply)',
  'multi-ply': 'Многослой (multi-ply)',
};

export interface PLNormsBridgeInput {
  /** Федерация сезона: 'ipf' | 'fpr' | 'wpc' | 'other'. */
  fed: string;
  sex: Sex;
  /** Вес на взвешивании (для категории). */
  bodyWeight: number;
  /** Целевые ПМ: {'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240}. */
  plannedPm: Record<string, number>;
  discipline?: Discipline;
  /** Экипировка (Фаза 6, п.3): у ФПР своя таблица для экипировки, у GL — свои коэффициенты. */
  gear?: PLGear;
}

export interface PLNormsBridgeResult {
  /** Таблица нормативов справочника (null — нет подходящей). */
  federation: Federation | null;
  fedLabel: string;
  bodyWeight: number;
  /** Проектный тотал по целевым ПМ (сумма найденных соревновательных движений). */
  total: number;
  /** Сколько соревновательных движений найдено (0..3) — тотал может быть неполным. */
  liftsFound: number;
  classification: ClassificationResult | null;
  /** Прогресс до следующего разряда, %. */
  progressPct: number;
  /** IPF GL для проектного тотала (ориентир независимо от таблицы). */
  glPoints: number;
  note: string;
}

const clampBw = (w: number): number => Math.max(30, Math.min(250, Number.isFinite(w) ? w : 0));

export function plNormsSnapshot(input: PLNormsBridgeInput): PLNormsBridgeResult {
  const lifts = resolveCompetitionLifts(input.plannedPm ?? {});
  const total = Math.round(lifts.reduce((sum, l) => sum + l.pm, 0) * 10) / 10;
  const bodyWeight = clampBw(input.bodyWeight);
  const discipline: Discipline = input.discipline ?? 'total';
  const gear: PLGear = input.gear ?? 'classic';
  const federation = resolveNormsFederation(input.fed, gear);
  const fedLabel = normsFedLabel(input.fed, gear);
  const glPoints = total > 0 && bodyWeight > 0
    ? ipfGLPointsFor(total, bodyWeight, input.sex, gearToGL(gear), discipline === 'bench' ? 'bench' : 'total')
    : 0;

  const base = {
    federation, fedLabel, bodyWeight, total, liftsFound: lifts.length, glPoints,
    classification: null as ClassificationResult | null, progressPct: 0,
  };

  if (lifts.length === 0 || total <= 0) {
    return { ...base, note: 'Заполните целевые ПМ (присед/жим/тяга) — тогда посчитаем тотал, разряд и «сколько кг до следующего».' };
  }

  if (!federation) {
    return {
      ...base,
      note: 'Для выбранной федерации таблицы нормативов в справочнике нет — разряд не считаем, сверяйтесь с официальной таблицей. Очки IPF GL ниже — ориентир уровня.',
    };
  }

  const table = getNormTable(federation, discipline, input.sex);
  if (!table) {
    return {
      ...base,
      note: `Для «${fedLabel}» таблицы по этому полу/дисциплине в справочнике нет (например, женские таблицы WRPF не публикуются) — разряд не считаем. Очки IPF GL — ориентир.`,
    };
  }

  const classification = classifyTotal(table, bodyWeight, total);
  const progressPct = Math.round(progressToNextRank(classification, total) * 10) / 10;
  const incomplete = lifts.length < 3
    ? ` Тотал неполный: найдено ${lifts.length} из 3 движений.`
    : '';
  const gearNote = gear === 'classic' ? '' : ` Экипировка: ${PL_GEAR_LABEL[gear]} — другие нормативы и коэффициенты очков.`;
  return {
    ...base,
    classification,
    progressPct,
    note: `Таблица «${fedLabel}», категория ${classification.category.label}.`
      + gearNote
      + incomplete
      + ' Сверяйте с официальной таблицей федерации на сезон — пороги обновляются.',
  };
}
