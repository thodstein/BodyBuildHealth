/**
 * bb-rep-schemes.engine.ts — библиотека схем повторений (канон для ББ-АВТО).
 *
 * Объединяет научные диапазоны + практические методики бодибилдинга в одну таблицу.
 * Ранее repRange брался только из PHASE_CONFIGS (periodization) и был одинаков для
 * всех PED-профилей. Теперь схема выбирается через schemeFor(goal, focus, phase, pedProfile, level).
 *
 * Источники:
 *  - Schoenfeld 2017 meta: 6-30 повт эквивалентны при RIR 0-3, если сеты до отказа ≈
 *  - Helms 2022 EBP, Israetel RP MEV/MAV/MRV
 *  - GVT (Poliquin 10×10), FST-7 (Hany Rambod), Gironda 8×8, Myo-reps (Borge Fagerli)
 *  - DC Training (DoggCrapp) rest-pause 11-15 RP + extreme stretch
 *  - Fortitude Training (Scott Stevenson) Muscle Rounds, BFR (Loenneke 2012) 30-15-15-15
 *  - Cluster (Haff), Lengthened partials (Wolf 2023), Meadows Mountain Dog (pre-exhaust)
 */
import type { BBPhase } from '../periodization';
import type { BBTrainingFocus } from './bb-goal-types';

export type RepSchemeId =
  | 'strength_5x5'
  | 'hypertrophy_8_12'
  | 'pump_15_20'
  | 'myo_reps'
  | 'dc_rp'
  | 'fst7'
  | 'gvt'
  | 'gironda_8x8'
  | 'bfr'
  | 'lengthened_partial'
  | 'cluster'
  | 'fortitude_mr';

export interface RepScheme {
  id: RepSchemeId;
  name: string;
  nameRu: string;
  repRange: [number, number];
  rir: number;
  restSec: number;
  tempo: string;
  techniques: string[];
  description: string;
  evidence: string;
  /** PED-подсказка: для каких профилей схема особенно эффективна. */
  pedHint?: Array<'AAS' | 'GH' | 'insulin' | 'MGF' | 'IGF1'>;
  /** Уровень доступа. */
  minLevel?: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
}

export const REP_SCHEMES: Record<RepSchemeId, RepScheme> = {
  strength_5x5: {
    id: 'strength_5x5',
    name: 'Strength 5×5',
    nameRu: 'Сила 5×5',
    repRange: [3, 6],
    rir: 1,
    restSec: 180,
    tempo: '2-1-1-0',
    techniques: ['rest_pause_cluster'],
    description: 'Тяжёлые 3-6 повт, RIR 1, отдых 180с. База для силы.',
    evidence: 'Schoenfeld 2017 strength 1-6 reps',
  },
  hypertrophy_8_12: {
    id: 'hypertrophy_8_12',
    name: 'Hypertrophy 8-12',
    nameRu: 'Гипертрофия 8-12',
    repRange: [8, 12],
    rir: 2,
    restSec: 90,
    tempo: '3-1-1-0',
    techniques: [],
    description: 'Классика 8-12, RIR 2, 90с. Оптимум для натуралов.',
    evidence: 'Schoenfeld 2017 8-12 optimal',
  },
  pump_15_20: {
    id: 'pump_15_20',
    name: 'Pump 15-20',
    nameRu: 'Памп 15-20',
    repRange: [15, 20],
    rir: 3,
    restSec: 60,
    tempo: '3-2-1-1',
    techniques: ['dropset'],
    description: 'Памп 15-20, RIR 3, 60с. Метаболический стресс.',
    evidence: 'Schoenfeld metabolic stress',
    pedHint: ['GH', 'insulin'],
  },
  myo_reps: {
    id: 'myo_reps',
    name: 'Myo-reps 15+4×4',
    nameRu: 'Myo-reps',
    repRange: [12, 20],
    rir: 1,
    restSec: 15,
    tempo: '2-1-1-0',
    techniques: ['myo_reps'],
    description: 'Активация 12-20 + мини-сеты 4×4 с 15с паузой. Эффективность.',
    evidence: 'Borge Fagerli Myo-reps',
    pedHint: ['MGF', 'IGF1', 'GH'],
  },
  dc_rp: {
    id: 'dc_rp',
    name: 'DC Rest-Pause 11-15',
    nameRu: 'DC Rest-Pause',
    repRange: [11, 15],
    rir: 0,
    restSec: 20,
    tempo: '3-1-1-0',
    techniques: ['rest_pause', 'extreme_stretch'],
    description: 'DC: 1 сет 11-15 RP (7+4+3 с 15с паузами) + extreme stretch 60-90с.',
    evidence: 'DoggCrapp DC Training',
    minLevel: 'advanced',
    pedHint: ['AAS'],
  },
  fst7: {
    id: 'fst7',
    name: 'FST-7 7×12',
    nameRu: 'FST-7',
    repRange: [8, 12],
    rir: 2,
    restSec: 40,
    tempo: '2-1-1-0',
    techniques: ['fst7'],
    description: 'FST-7: 7×12, 40с, памп-изоляция (Hany Rambod).',
    evidence: 'FST-7 Hany Rambod',
  },
  gvt: {
    id: 'gvt',
    name: 'GVT 10×10',
    nameRu: 'GVT 10×10',
    repRange: [10, 10],
    rir: 2,
    restSec: 75,
    tempo: '3-1-1-0',
    techniques: ['gvt'],
    description: 'GVT: 10×10, 75с, 60% 1RM. Объёмный шок.',
    evidence: 'Poliquin GVT',
  },
  gironda_8x8: {
    id: 'gironda_8x8',
    name: 'Gironda 8×8',
    nameRu: 'Gironda 8×8',
    repRange: [8, 8],
    rir: 2,
    restSec: 45,
    tempo: '2-1-1-0',
    techniques: ['gironda'],
    description: 'Gironda 8×8, 45с. Плотность.',
    evidence: 'Vince Gironda',
  },
  bfr: {
    id: 'bfr',
    name: 'BFR 30-15-15-15',
    nameRu: 'BFR окклюзия',
    repRange: [15, 30],
    rir: 2,
    restSec: 30,
    tempo: '2-1-1-0',
    techniques: ['bfr'],
    description: 'BFR 20-30% 1RM, 30/15/15/15, 30с. Гипертрофия без нагрузки на суставы.',
    evidence: 'Loenneke 2012 BFR',
    pedHint: ['GH', 'insulin'],
  },
  lengthened_partial: {
    id: 'lengthened_partial',
    name: 'Lengthened Partials 8-12',
    nameRu: 'Lengthened partials',
    repRange: [8, 12],
    rir: 2,
    restSec: 90,
    tempo: '3-2-1-0',
    techniques: ['lengthened_partials'],
    description: 'Частичные в растянутой позиции 8-12. Растяжение-медиатор.',
    evidence: 'Wolf 2023 long-length partials',
    pedHint: ['GH', 'MGF'],
  },
  cluster: {
    id: 'cluster',
    name: 'Cluster 4×2 87%',
    nameRu: 'Кластер 4×2',
    repRange: [2, 4],
    rir: 1,
    restSec: 15,
    tempo: '2-0-1-0',
    techniques: ['rest_pause_cluster'],
    description: 'Кластер 4×2 на 87% 1RM, 15с. Сила+объём.',
    evidence: 'Haff cluster training',
    minLevel: 'advanced',
    pedHint: ['AAS'],
  },
  fortitude_mr: {
    id: 'fortitude_mr',
    name: 'Fortitude Muscle Round',
    nameRu: 'Fortitude MR',
    repRange: [6, 6],
    rir: 1,
    restSec: 10,
    tempo: '2-1-1-0',
    techniques: ['myo_reps', 'rest_pause'],
    description: 'Fortitude MR: 4×6 с 10с паузами (Stevenson). Плотность+техника.',
    evidence: 'Scott Stevenson Fortitude',
    minLevel: 'advanced',
  },
};

export function isRepSchemeId(v: string): v is RepSchemeId {
  return v in REP_SCHEMES;
}

export interface SchemeForInput {
  goal?: string;
  focus?: BBTrainingFocus;
  phase?: BBPhase;
  pedProfile?: { hasAAS?: boolean; hasGH?: boolean; hasInsulin?: boolean; hasMGF?: boolean; hasIGF1?: boolean; ghPlusInsulin?: boolean };
  level?: string;
  character?: 'тяж' | 'памп' | 'лёг';
}

/**
 * Выбор схемы повторений по контексту.
 * Приоритет: пед-подсказка > характер дня > фаза > фокус > дефолт.
 */
export function schemeFor(input: SchemeForInput): RepSchemeId {
  const { focus, phase, pedProfile, character, level } = input;
  const isAdv = level === 'advanced' || level === 'enhanced';

  // P0: GH+insulin pump window — приоритетно для памп-дней
  if (pedProfile?.ghPlusInsulin && character === 'памп') return 'pump_15_20';
  if (pedProfile?.ghPlusInsulin && phase === 'intensification' && character === 'памп') return 'bfr';

  // MGF/IGF1 — myo_reps / lengthened для памп
  if ((pedProfile?.hasMGF || pedProfile?.hasIGF1) && character === 'памп') return 'myo_reps';
  if ((pedProfile?.hasMGF || pedProfile?.hasIGF1) && phase === 'accumulation') return 'lengthened_partial';

  // AAS heavy — DC / cluster для тяж
  if (pedProfile?.hasAAS && isAdv && character === 'тяж' && phase === 'intensification') return 'dc_rp';
  if (pedProfile?.hasAAS && character === 'тяж' && phase === 'peaking') return 'cluster';

  // GH solo — BFR / lengthened для суставов
  if (pedProfile?.hasGH && !pedProfile?.hasInsulin && character === 'памп') return 'bfr';

  // Характер дня
  if (character === 'тяж') {
    if (focus === 'strength') return 'strength_5x5';
    if (phase === 'peaking') return 'cluster';
    return 'hypertrophy_8_12';
  }
  if (character === 'памп') {
    if (phase === 'deload') return 'pump_15_20';
    return 'hypertrophy_8_12';
  }
  if (character === 'лёг') return 'pump_15_20';

  // Фаза
  if (phase === 'accumulation') return 'hypertrophy_8_12';
  if (phase === 'intensification') return isAdv ? 'fortitude_mr' : 'hypertrophy_8_12';
  if (phase === 'peaking') return 'strength_5x5';
  if (phase === 'deload') return 'pump_15_20';

  // Фокус
  if (focus === 'strength') return 'strength_5x5';
  if (focus === 'endurance') return 'pump_15_20';
  return 'hypertrophy_8_12';
}

export function schemeToLoading(scheme: RepScheme): { reps: number; rir: number; restSec: number; tempo: string } {
  const reps = Math.round((scheme.repRange[0] + scheme.repRange[1]) / 2);
  return { reps, rir: scheme.rir, restSec: scheme.restSec, tempo: scheme.tempo };
}

/** Короткое описание схемы для UI/rationale. */
export function schemeLabel(id: RepSchemeId): string {
  const s = REP_SCHEMES[id];
  return s ? `${s.nameRu} (${s.repRange[0]}-${s.repRange[1]} · RIR${s.rir} · ${s.restSec}с)` : id;
}

/** Целевой тип упражнения для применения схемы: тяж-primary (сила) или памп-accessory (памп/GVT). */
export type SchemeTarget = 'heavy_primary' | 'pump_accessory';

/**
 * Применяет rep-схему к реальной загрузке упражнений плана.
 * Это закрывает «декоративность» схем: раньше schemeFor давал только строку rationale,
 * теперь repsRange/rir/rest/tempo/workSets перезаписываются выбранной схемой.
 *
 * Ограничения безопасности:
 *  - применяется ТОЛЬКО к целевым упражнениям (тяж-primary / памп-accessory);
 *  - НЕ трогает разминочные (warmupActivator) и делод-недели;
 *  - сохраняется кап 5 сетов (не увеличивает sets — только переписывает loading существующих сетов);
 *  - вес пересчитывается через weightForRepMax от workMax мышцы (Brzycki + RIR-adj + intensityMult);
 *  - deload-фаза и warmup-активаторы исключены.
 */
export function applySchemeToPlan(
  plan: any,
  scheme: RepScheme | null,
  target: SchemeTarget,
  opts: {
    weightForRepMax: (reps: number, workMax: number, rir: number, intensityMult: number) => number;
    workMax: Record<string, number>;
    defaultWorkMax?: (muscle: string) => number;
    proWorkmaxRatio?: (muscle: string) => ((wm: Record<string, number>) => number) | undefined;
    intensityMult?: number;
  },
): number {
  if (!scheme) return 0;
  const { weightForRepMax, workMax, defaultWorkMax, proWorkmaxRatio, intensityMult = 1 } = opts;
  const loading = schemeToLoading(scheme);
  const isHeavyTarget = target === 'heavy_primary';
  let applied = 0;

  for (const week of plan.weeks || []) {
    if (week?.phase === 'deload' || week?.deload) continue;
    for (const sess of week.sessions || []) {
      for (const ex of sess.exercises || []) {
        if (!ex || ex.warmupActivator) continue;
        // Целевой фильтр по character самого УПРАЖНЕНИЯ (не сессии) + роли.
        // Памп-primary внутри тяж-сессии (например hams в Legs D1) НЕ должен
        // получать тяж-схему — он остаётся памп-режимом.
        const exChar = ex.character || sess.character || 'тяж';
        const heavyMatch = isHeavyTarget && exChar === 'тяж' && ex.role === 'primary';
        const pumpMatch = !isHeavyTarget && (exChar === 'памп' || exChar === 'лёг') && ex.role === 'accessory';
        if (!heavyMatch && !pumpMatch) continue;
        // Сохраняем число сетов (кап 5), меняем только loading.
        const setCount = Math.max(1, Math.min(5, ex.workSets?.length || ex.sets || 3));
        // Вес: Brzycki от workMax мышцы (как в buildSession), с intensityMult.
        const wm = workMax[ex.muscle] || proWorkmaxRatio?.(ex.muscle)?.(workMax) || defaultWorkMax?.(ex.muscle) || 50;
        const weight = weightForRepMax(loading.reps, wm, loading.rir, intensityMult);
        ex.repsRange = [scheme.repRange[0], scheme.repRange[1]];
        ex.rir = loading.rir;
        ex.restSeconds = loading.restSec;
        ex.tempoSpec = loading.tempo;
        ex.sets = setCount;
        ex.workSets = Array.from({ length: setCount }, () => ({
          reps: loading.reps,
          rir: loading.rir,
          weight: Math.round(weight * 10) / 10,
          tempo: loading.tempo,
          restSeconds: loading.restSec,
        }));
        if (!ex.comment?.includes(scheme.nameRu)) {
          ex.comment = `${ex.comment || ''} | 📋 ${scheme.nameRu} (${scheme.evidence})`.trim().replace(/^\|\s*/, '');
        }
        applied++;
      }
    }
  }
  return applied;
}
