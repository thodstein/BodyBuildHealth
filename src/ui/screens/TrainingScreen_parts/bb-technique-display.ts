/**
 * bb-technique-display.ts — отображение «фишек» ББ-плана (UI-only).
 *
 * Дроп-сеты / rest-pause / myo-reps / 21s / суперсеты / схемы объёма
 * (GVT/FST-7/8×8) / DUP — показываются пользователю как бейджи и по-сетовая
 * разбивка, НО не меняют учёт нагрузки: workSets и e.sets движка не трогаются,
 * инвариант sets === workSets.length (bb-validator) и капы MRV остаются как есть.
 *
 * Цепочки строятся из спеки техники по образцу buildWarmup (render-only).
 */
import type { BBExercise } from '../../../engines/bb/bb-types';

/** Минимальная структурная форма упражнения для отображения (UI-only). */
export type ExLike = {
  workSets?: Array<{ reps: number; rir: number; weight: number; technique?: string }>;
  comment?: string;
  supersetWith?: string;
  rir?: number;
};

/** Метки интенсив-техник (ключи workSets[].technique из bb-autocoach / bb-finalize). Код EN, UI RU. */
export const TECHNIQUE_LABELS: Record<string, string> = {
  drop_set: 'Дроп-сет',
  dropset: 'Дроп-сет',
  rest_pause: 'Отдых-пауза',
  myo_reps: 'Myo-повторы',
  myo_rep: 'Myo-повторы',
  twenty_ones: '21s (7-7-7)',
  negative: 'Негативы (3-4с)',
  pause_rep: 'Пауза-повтор (2-3с)',
  mechanical_drop: 'Механический дроп',
  bfr: 'BFR (окклюзия 30-15-15-15)',
  lengthened_partials: 'Частичные в растянутой',
  slow_eccentric: 'Медленный негатив 4с',
  rest_pause_cluster: 'Кластер (2+2+2)',
  superset: 'Суперсет',
  triset: 'Трисет',
  pre_exhaust: 'Пре-истощение',
  post_exhaust: 'Пост-истощение',
};

/** Схемы объёма памп-дней, детектируемые по comment (applyVolumeScheme). */
export const VOLUME_SCHEME_LABELS: Array<{ re: RegExp; label: string }> = [
  { re: /GVT\s*10×10|GVT\s*10x10/i, label: 'GVT 10×10' },
  { re: /FST-7|FST7/i, label: 'FST-7' },
  { re: /8×8 Gironda|8x8 Gironda/i, label: '8×8 Gironda' },
];

export const DUP_LABEL = 'DUP';

export interface ExerciseBadge {
  icon: string;
  label: string;
  color: string;
}

/** Техника последнего рабочего сета (движок помечает lastSet.technique). */
export function lastSetTechnique(ex: ExLike): string | null {
  const ws = ex?.workSets;
  if (!Array.isArray(ws) || ws.length === 0) return null;
  return ws[ws.length - 1]?.technique || null;
}

export function techniqueLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return TECHNIQUE_LABELS[key] || key.replace(/_/g, ' ');
}

/** Схема объёма (GVT/FST-7/8×8) из comment — проставляет applyVolumeScheme. */
export function volumeSchemeLabel(ex: ExLike): string | null {
  const c = ex?.comment || '';
  for (const s of VOLUME_SCHEME_LABELS) {
    if (s.re.test(c)) return s.label;
  }
  return null;
}

export function supersetLabel(ex: ExLike): string | null {
  return ex?.supersetWith ? ex.supersetWith : null;
}

const round = (v: number): number => Math.round(v * 10) / 10;

export interface ChainResult {
  label: string;
  parts: string[];
}

/**
 * Цепочка подходов для техники последнего сета (render-only, не в учёте).
 * Веса дропа: ×0.8 / ×0.64 от рабочего (паритет applyIntensityTechniqueToExercise).
 */
export function techniqueChainParts(ex: ExLike, editedWeight?: number): ChainResult | null {
  const t = lastSetTechnique(ex);
  if (!t) return null;
  const ws = ex.workSets || [];
  const last = ws[ws.length - 1];
  if (!last) return null;
  const w = editedWeight && editedWeight > 0 ? editedWeight : last.weight || 0;
  const reps = last.reps || 8;

  switch (t) {
    case 'drop_set':
    case 'dropset':
      return {
        label: 'Дроп-сет (-20%×2)',
        parts: [`${reps}×${round(w)}`, `6×${round(w * 0.8)}`, `4×${round(w * 0.64)}`],
      };
    case 'rest_pause':
      return {
        label: 'Отдых-пауза',
        parts: [`${reps}×${round(w)}`, '15с', `3-4×${round(w)}`, '15с', `3-4×${round(w)}`],
      };
    case 'myo_reps':
    case 'myo_rep':
      return {
        label: 'Myo-повторы',
        parts: [`${reps}×${round(w)} (активация)`, `4×4×${round(w)} (5с пауза)`],
      };
    case 'twenty_ones':
      return { label: '21s (7-7-7)', parts: ['21 повт: 7 нижних + 7 верхних + 7 полных'] };
    case 'negative':
      return {
        label: 'Негативы (3-4с)',
        parts: [`${reps}×${round(w)}`, 'темп 4-2-1-0, последние 1-2 повтора с контролем'],
      };
    case 'pause_rep':
      return { label: 'Пауза-повтор (2-3с)', parts: [`${reps}×${round(w)}`, 'пауза 2-3с в нижней точке (убирает инерцию)'] };
    case 'mechanical_drop':
      return {
        label: 'Механический дроп',
        parts: [`${reps}×${round(w)}`, `6×${round(w)} (смена угла/хвата)`],
      };
    case 'rest_pause_cluster':
      return {
        label: 'Кластерный rest-pause',
        parts: [`${reps}×${round(w)}`, '2+2+2×87% (10-15с между кластерами)'],
      };
    default:
      return null;
  }
}

/** По-сетовая разбивка базовых рабочих подходов (weight×reps @RIR). */
export function workSetsBreakdown(ex: ExLike, edit?: { sets?: number; reps?: number; weight?: number }): string[] {
  const ws = ex.workSets || [];
  if (edit && edit.sets != null) {
    const sets = Math.max(0, edit.sets);
    const reps = edit.reps || ws[0]?.reps || 10;
    const w = edit.weight || ws[0]?.weight || 0;
    const rir = ws[0]?.rir ?? ex.rir ?? 2;
    return Array.from({ length: sets }, () => `${round(w)}×${reps} @RIR${rir}`);
  }
  return ws.map(s => `${round(s.weight || 0)}×${s.reps} @RIR${s.rir ?? ex.rir ?? 2}`);
}

/**
 * Полная строка подходов для карточки упражнения:
 * базовые подходы + цепочка техники (если есть). Render-only.
 */
export function planSetsBreakdown(
  ex: ExLike,
  edit?: { sets?: number; reps?: number; weight?: number },
): { lines: string[]; chain: ChainResult | null } {
  const lines = workSetsBreakdown(ex, edit);
  const chain = techniqueChainParts(ex, edit?.weight);
  return { lines, chain };
}

/** Все бейджи фишек упражнения: техника · суперсет · схема объёма · DUP. */
export function exerciseFeatureBadges(ex: ExLike, dupMode?: string): ExerciseBadge[] {
  const badges: ExerciseBadge[] = [];
  const t = techniqueLabel(lastSetTechnique(ex));
  if (t) badges.push({ icon: '💥', label: t, color: '#f87171' });
  const ss = supersetLabel(ex);
  if (ss) badges.push({ icon: '🔗', label: `Суперсет с «${ss}»`, color: '#f59e0b' });
  const vs = volumeSchemeLabel(ex);
  if (vs) badges.push({ icon: '📦', label: vs, color: '#60a5fa' });
  if (dupMode && dupMode !== 'none') {
    badges.push({
      icon: '🌊',
      label: dupMode === 'full_dup' ? 'Полный DUP' : 'DUP',
      color: '#a78bfa',
    });
  }
  return badges;
}
