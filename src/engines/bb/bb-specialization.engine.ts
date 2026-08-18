/**
 * bb-specialization.engine.ts — единый резолвер акцентов ББ-авто.
 *
 * Три механизма (focusGroup / weakPoints / specializationMode) сводятся к
 * ОДНОЙ модели «специализация» (методика: 1-2 отстающие мышцы, остальные —
 * поддерживающий объём; Rapid Strength / Metal Strength / T-Nation):
 *   - focusGroup (1 мышца) и weakPoints (N мышц) больше НЕ складываются
 *     (раньше 1.2 × 1.3 = 1.56 — скрытый скачок объёма);
 *   - specializationMode без слабых групп — no-op (раньше generic переводил
 *     ВСЕ мышцы в special-режим, cycle резал все до ×0.7);
 *   - top-2 специализации выбираются ПОСЛЕ канонизации (раньше
 *     ['shoulders','chest'] → ['shoulders','delt_front'] — один регион
 *     занимал оба слота);
 *   - focusGroup при специализации защищён от реза «остальных» (раньше
 *     cycle давал 0.7 × 1.3 = 0.91 — фокус-мышца фактически уменьшалась).
 *
 * Уровень/стаж/PED/recovery/nutrition/lab/goal-множители НЕ трогаются —
 * они применяются в bb-builder/cycle-to-plan ПОВЕРХ факторов этого модуля.
 */

import { WEAK_TO_MUSCLE } from './bb-builder.engine';

/** Каноническая мышца для гранулярной слабой группы (chest_upper → chest). */
export function canonicalMuscle(muscle: string): string {
  return WEAK_TO_MUSCLE[muscle] || muscle;
}

/** Уникальные канонические мышцы с сохранением порядка ввода. */
export function canonicalizeMuscles(muscles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of muscles) {
    const c = canonicalMuscle(m);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Дедуп ТОЛЬКО точных дублей (без канонизации): delt_mid и delt_rear —
 *  РАЗНЫЕ цели специализации (две зоны одной мышцы = больше объёма). */
export function dedupeExactMuscles(muscles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of muscles) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/** Гранулярные зоны, которые можно сочетать внутри одного региона:
 *  delt_mid+delt_rear, chest_upper+chest_lower и т.п. */
const GRANULAR_SPECIALIZATION_ZONES = new Set([
  'chest_upper', 'chest_lower', 'back_width', 'back_thickness',
  'delt_front', 'delt_mid', 'delt_rear',
]);

/** Проверка конфликтующего выбора parent + zone: shoulders+delt_mid нельзя,
 *  но две разные зоны (delt_mid+delt_rear) допустимы. */
export function isSpecializationTargetConflict(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  if (canonicalMuscle(a) !== canonicalMuscle(b)) return false;
  return !(GRANULAR_SPECIALIZATION_ZONES.has(a) && GRANULAR_SPECIALIZATION_ZONES.has(b));
}

/** Нормализовать две цели блока: точный дедуп, parent/zone-конфликты,
 *  максимум 2 цели. Канонизация здесь НЕ выполняется, чтобы сохранить зоны. */
export function normalizeSpecializationTargets(targets: string[]): string[] {
  const out: string[] = [];
  for (const target of dedupeExactMuscles(targets)) {
    if (out.length >= 2) break;
    if (out.some(existing => isSpecializationTargetConflict(existing, target))) continue;
    out.push(target);
  }
  return out;
}

export interface SpecializationResolution {
  /** Цели специализации (топ-2 из слабых, порядок ввода). ГРАНУЛЯРНЫЕ:
   *  delt_mid/delt_rear/chest_upper — разные зоны одной мышцы. */
  targets: string[];
  /** Каноническая фокус-мышца (если задана). */
  focus: string;
  /** Все слабые мышцы (гранулярные; для weak-логики: feeders/приоритет). */
  weak: string[];
  /** Специализация активна (только при наличии слабых групп). */
  active: boolean;
}

/**
 * Единый резолвер акцентов для всех путей (generic/cycle/program).
 * focusGroup и weakPoints больше не складываются: фокус-мышца получает
 * только свой множитель, слабые — только свой.
 */
export function resolveSpecialization(
  focusGroup: string | undefined,
  weakPoints: string[] | undefined,
  specialization: boolean | undefined,
): SpecializationResolution {
  const focus = focusGroup ? canonicalMuscle(focusGroup) : '';
  const weak = dedupeExactMuscles(weakPoints || []);
  const active = !!specialization && weak.length > 0;
  const targets = active ? normalizeSpecializationTargets(weak) : [];
  return { targets, focus, weak, active };
}

/** Сколько целей специализации попадают в каноническую мышцу m
 *  (delt_mid + delt_rear → shoulders = 2 зоны). */
export function targetHeadsFor(
  muscle: string,
  res: SpecializationResolution,
): number {
  const m = canonicalMuscle(muscle);
  return res.targets.filter(t => canonicalMuscle(t) === m).length;
}

/** Мышца входит в список (с учётом гранулярных зон: delt_mid ∈ shoulders). */
function listHasMuscle(muscle: string, list: string[]): boolean {
  const m = canonicalMuscle(muscle);
  return list.some(t => canonicalMuscle(t) === m);
}

/**
 * Множитель объёма мышцы (per-session и целевой расчёт).
 * Приоритет: focus (×1.3) > specialization target (×1.1 за зону, до ×1.3)
 * > weak (×1.2) > 1. Две зоны одной мышцы (delt_mid+delt_rear) = ×1.2 —
 *  специализация на 2 головки даёт БОЛЬШЕ объёма, чем одна.
 * Специализация: не-целевые мышцы — поддерживающий объём (×0.7).
 * Фокус-мышца при специализации НЕ режется (защита от 0.7 × 1.3 = 0.91).
 */
export function specializationVolumeFactor(
  muscle: string,
  res: SpecializationResolution,
): number {
  const m = canonicalMuscle(muscle);
  if (res.focus && m === res.focus) return 1.3;
  if (res.active) {
    const heads = targetHeadsFor(m, res);
    if (heads > 0) return Math.min(1.3, 1.0 + 0.1 * heads);
    return 0.7;
  }
  if (listHasMuscle(m, res.weak)) return 1.2;
  return 1.0;
}

/**
 * Per-session множитель акцента БЕЗ перераспределения специализации.
 * Для generic-пути: перераспределение (топ-2 MAV×1.1, остальные MEV) уже
 * заложено в целевой объём — per-session применяется только emphasis
 * (focus ×1.3 / weak ×1.2), иначе 0.7/1.1 применились бы дважды.
 */
export function specializationEmphasisFactor(
  muscle: string,
  res: SpecializationResolution,
): number {
  const m = canonicalMuscle(muscle);
  if (res.focus && m === res.focus) return 1.3;
  if (listHasMuscle(m, res.weak)) return 1.2;
  return 1.0;
}

/**
 * Множитель MRV-капа мышцы (потолок растёт только для акцентов).
 * Специализация отдельного MRV-множителя не добавляет — перераспределение
 * объёма идёт внутри существующих капов.
 */
export function specializationMrvFactor(
  muscle: string,
  res: SpecializationResolution,
): number {
  const m = canonicalMuscle(muscle);
  if (res.focus && m === res.focus) return 1.3;
  if (listHasMuscle(m, res.weak)) return 1.2;
  return 1.0;
}

/** Мышца — слабая (для weak-логики: feeders, приоритет, RIR). */
export function isSpecializationWeak(
  muscle: string,
  res: SpecializationResolution,
): boolean {
  return listHasMuscle(muscle, res.weak);
}

/** Мышца — фокус (для primary-гарантии и бейджей). */
export function isSpecializationFocus(
  muscle: string,
  res: SpecializationResolution,
): boolean {
  return !!res.focus && canonicalMuscle(muscle) === res.focus;
}

/** Длина блока специализации по методике (T-Nation: 3-6 недель;
 *  дефолт 5 — классический 5-недельный специализированный блок). */
export const SPECIALIZATION_BLOCK_WEEKS = 5;
export const SPECIALIZATION_MIN_BLOCK_WEEKS = 3;
export const SPECIALIZATION_MAX_BLOCK_WEEKS = 6;

/** Режим перераспределения ресурса: цель специализации за счёт доноров. */
export type VolumeTradeoffMode =
  | 'none'
  | 'reduce_direct_to_floor'
  | 'remove_direct_when_indirect_covers_floor';

/** Политика доноров блока: прямые упражнения донора снижаются/убираются,
 *  косвенная нагрузка всегда сохраняется, effective volume не ниже MEV. */
export interface VolumeTradeoffPolicy {
  mode: VolumeTradeoffMode;
  /** Мышцы-доноры (гранулярные или канонические). */
  donorMuscles: string[];
  /** Косвенную нагрузку донора не трогаем никогда. */
  preserveIndirect: true;
}

/** Один блок плана: недели [weekStart..weekEnd] с целями специализации.
 *  targets: 1-2 цели (гранулярные зоны сохраняются); пустой массив =
 *  сбалансированный блок (возврат к MAV для всех). */
export interface SpecializationBlock {
  /** Стабильный id блока (для UI-редактора). */
  id?: string;
  /** Первая неделя блока (1-индекс, включительно). */
  weekStart: number;
  /** Последняя неделя блока (1-индекс, включительно). */
  weekEnd: number;
  /** Цели блока (1-2 гранулярные или обычные цели); [] = баланс. */
  targets: string[];
  /** Донорская политика блока (перераспределение ресурса). */
  tradeoff?: VolumeTradeoffPolicy;
}

/** Расписание специализации на весь план: цепочка блоков без пропусков. */
export interface SpecializationSchedule {
  blocks: SpecializationBlock[];
  /** Есть хоть один блок с непустыми целями. */
  active: boolean;
  /** Цели первого непустого блока (для MRV-капов и volumeTargets). */
  primaryTargets: string[];
  /** Каноническая фокус-мышца (эмфазис всего плана, не перераспределение). */
  focus: string;
  /** Legacy weak-список (весь план) — для неактивных расписаний. */
  weak: string[];
}

/** Собрать расписание из явных блоков ИЛИ из legacy-параметров
 *  (focusGroup/weakPoints/specialization → один блок SPECIALIZATION_BLOCK_WEEKS
 *  нед + баланс). Явные блоки нормализуются: кламп, сортировка, пропуски и
 *  пересечения, дедуп целей и доноров, длина блока 3-6 нед. */
export function buildSpecializationSchedule(
  focusGroup: string | undefined,
  weakPoints: string[] | undefined,
  specialization: boolean | undefined,
  totalWeeks: number,
  explicit?: SpecializationBlock[],
): SpecializationSchedule {
  const base = resolveSpecialization(focusGroup, weakPoints, specialization);
  const focus = base.focus;
  const safeTotalWeeks = Math.max(1, Math.round(totalWeeks || 1));
  let blocks: SpecializationBlock[] = [];
  if (explicit && explicit.length > 0) {
    blocks = explicit
      .map((b, idx) => {
        const start = Math.max(1, Math.min(safeTotalWeeks, Math.round(b.weekStart || 1)));
        const end = Math.max(start, Math.min(safeTotalWeeks, Math.round(b.weekEnd || start)));
        const targets = normalizeSpecializationTargets(b.targets || []);
        const tradeoff = targets.length > 0 && b.tradeoff && b.tradeoff.mode !== 'none' && b.tradeoff.donorMuscles.length > 0
          ? {
              mode: b.tradeoff.mode,
              donorMuscles: dedupeExactMuscles(b.tradeoff.donorMuscles),
              preserveIndirect: true as const,
            }
          : undefined;
        return {
          id: b.id || `spec-block-${idx + 1}`,
          weekStart: start,
          weekEnd: end,
          targets,
          ...(tradeoff ? { tradeoff } : {}),
        };
      })
      .filter(b => b.weekStart <= b.weekEnd)
      .sort((a, b) => a.weekStart - b.weekStart);
  } else if (base.active) {
    const end = Math.min(SPECIALIZATION_BLOCK_WEEKS, safeTotalWeeks);
    blocks = [{ id: 'spec-block-1', weekStart: 1, weekEnd: end, targets: base.targets }];
  }
  // Заполняем пропуски балансом и обрезаем пересечения: следующий блок
  // начинается после фактического конца предыдущего, а не поверх него.
  const filled: SpecializationBlock[] = [];
  let cursor = 1;
  for (const b of blocks) {
    const start = Math.max(cursor, b.weekStart);
    if (start > b.weekEnd) continue;
    if (start > cursor) filled.push({ id: `balance-${cursor}`, weekStart: cursor, weekEnd: start - 1, targets: [] });
    filled.push({ ...b, weekStart: start });
    cursor = start > cursor ? b.weekEnd + 1 : Math.max(cursor, b.weekEnd + 1);
  }
  if (cursor <= safeTotalWeeks) filled.push({ id: `balance-${cursor}`, weekStart: cursor, weekEnd: safeTotalWeeks, targets: [] });
  const primary = filled.find(b => b.targets.length > 0);
  return {
    blocks: filled.length > 0 ? filled : [{ id: 'balance-1', weekStart: 1, weekEnd: safeTotalWeeks, targets: [] }],
    active: filled.some(b => b.targets.length > 0),
    primaryTargets: primary ? primary.targets : [],
    focus,
    weak: base.weak,
  };
}

/** Донорская политика недели по расписанию (null = нет tradeoff в этой неделе). */
export function tradeoffForWeek(
  schedule: SpecializationSchedule,
  week: number,
): VolumeTradeoffPolicy | null {
  const block = schedule.blocks.find(b => week >= b.weekStart && week <= b.weekEnd);
  return block && block.tradeoff && block.tradeoff.mode !== 'none'
    ? block.tradeoff
    : null;
}

/** Резолвер акцентов для конкретной недели плана по расписанию блоков.
 *  Активное расписание: цели блока (или баланс — без перераспределения и
 *  weak-эмфазиса). НЕактивное расписание (legacy weak без специализации):
 *  weak-эмфазис всего плана сохраняется, перераспределения нет. */
export function specResForWeekSchedule(
  schedule: SpecializationSchedule,
  week: number,
): SpecializationResolution {
  if (!schedule.active) {
    return { targets: [], focus: schedule.focus, weak: schedule.weak, active: false };
  }
  const block = schedule.blocks.find(b => week >= b.weekStart && week <= b.weekEnd);
  const targets = block && block.targets.length > 0 ? block.targets : [];
  return { targets, focus: schedule.focus, weak: targets, active: targets.length > 0 };
}

/** Текст расписания для rationale: «нед 1-5 [chest, biceps] → нед 6-12 баланс». */
export function specializationScheduleText(schedule: SpecializationSchedule): string {
  return schedule.blocks
    .map(b => {
      const base = `нед ${b.weekStart}-${b.weekEnd}${b.targets.length > 0 ? ` [${b.targets.join(', ')}]` : ' баланс'}`;
      if (b.tradeoff && b.tradeoff.mode !== 'none' && b.tradeoff.donorMuscles.length > 0) {
        const modeText = b.tradeoff.mode === 'remove_direct_when_indirect_covers_floor'
          ? 'прямая работа убрана'
          : 'прямая работа снижена';
        return `${base} (доноры: ${b.tradeoff.donorMuscles.join(', ')} — ${modeText})`;
      }
      return base;
    })
    .join(' → ');
}
