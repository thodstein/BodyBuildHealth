/**
 * arm-specialization.engine.ts — специализация арм-групп (как bb-specialization).
 * 1-2 цели, блоки 3-6 недель, без стэкинга (focus ×1.3 > target ×1.1 > weak ×1.2).
 */
import type { ArmSpecializationBlock, ArmTradeoffPolicy, ArmSpecializationSchedule } from './arm-types';

export const ARM_WEAK_TO_MUSCLE: Record<string, string> = {
  cup_medial: 'wrist_flexors',
  cup_lateral: 'wrist_flexors',
  pronator_teres: 'pronators',
  pronator_quadratus: 'pronators',
  supinator: 'supinators',
  riser_medial: 'risers',
  thumb_adductor: 'thumb',
  grip_support: 'grip_support',
  grip_pinch: 'grip_pinch',
};

export function normalizeArmMuscle(m: string): string {
  const low = m.toLowerCase().trim();
  return ARM_WEAK_TO_MUSCLE[low] || low;
}

export function resolveArmSpecialization(input: {
  focusGroup?: string;
  weakPoints?: string[];
  specialization?: boolean;
}): { targets: string[]; mode: 'none' | 'focus' | 'weak' | 'spec'; } {
  const weak = (input.weakPoints || []).map(normalizeArmMuscle).filter(Boolean);
  const focus = input.focusGroup ? normalizeArmMuscle(input.focusGroup) : null;
  if (focus && weak.includes(focus) === false) weak.unshift(focus);
  const deduped = Array.from(new Set(weak));
  if (!input.specialization || deduped.length === 0) {
    return { targets: deduped.slice(0, 2), mode: deduped.length > 0 ? 'weak' : 'none' };
  }
  if (focus) return { targets: deduped.slice(0, 2), mode: 'focus' };
  return { targets: deduped.slice(0, 2), mode: 'spec' };
}

export function specializationMrvFactor(muscle: string, targets: string[], weakPoints: string[], focusGroup?: string): number {
  const m = normalizeArmMuscle(muscle);
  const tN = targets.map(normalizeArmMuscle);
  const wN = weakPoints.map(normalizeArmMuscle);
  const fN = focusGroup ? normalizeArmMuscle(focusGroup) : null;

  if (fN && m === fN) return 1.3;
  if (tN.includes(m)) return 1.1;
  if (wN.includes(m)) return 1.2;
  // non-target when specialization active — поддерживают (×0.7)
  if (tN.length > 0) return 0.7;
  return 1.0;
}

export function buildArmSchedule(input: {
  focusGroup?: string;
  weakPoints?: string[];
  specialization?: boolean;
  totalWeeks: number;
  explicitBlocks?: ArmSpecializationBlock[];
}): ArmSpecializationSchedule {
  const total = Math.max(1, Math.min(52, Math.round(input.totalWeeks || 8)));
  const { targets } = resolveArmSpecialization({ focusGroup: input.focusGroup, weakPoints: input.weakPoints, specialization: input.specialization });
  const active = !!input.specialization && targets.length > 0;

  if (input.explicitBlocks && input.explicitBlocks.length > 0) {
    const blocks = input.explicitBlocks
      .map(b => ({
        ...b,
        weekStart: Math.max(1, Math.min(total, Math.round(b.weekStart))),
        weekEnd: Math.max(1, Math.min(total, Math.round(b.weekEnd))),
        targets: (b.targets || []).map(normalizeArmMuscle).slice(0, 2),
      }))
      .filter(b => b.weekStart <= b.weekEnd)
      .sort((a, b) => a.weekStart - b.weekStart);
    const rationale = blocks.length > 0 ? blocks.map(b => `нед ${b.weekStart}-${b.weekEnd}: [${b.targets.join(',')}]`).join(' → ') + ' → баланс' : 'баланс';
    return { blocks, rationale, active };
  }

  if (!active) return { blocks: [], rationale: 'баланс (без специализации)', active: false };

  // Legacy: один блок 6 нед + баланс
  const firstEnd = Math.min(total, 6);
  const blocks: ArmSpecializationBlock[] = [
    { id: 'spec-1', weekStart: 1, weekEnd: firstEnd, targets: targets.slice(0, 2) },
  ];
  if (total > firstEnd) {
    blocks.push({ id: 'balance', weekStart: firstEnd + 1, weekEnd: total, targets: [] });
  }
  const rationale = total <= firstEnd
    ? `нед 1-${total}: [${targets.join(',')}]`
    : `нед 1-${firstEnd}: [${targets.join(',')}] → нед ${firstEnd + 1}-${total}: баланс`;
  return { blocks, rationale, active };
}

export function specForWeek(schedule: ArmSpecializationSchedule, week: number): string[] {
  if (!schedule.active) return [];
  for (const b of schedule.blocks) {
    if (week >= b.weekStart && week <= b.weekEnd) return b.targets;
  }
  return [];
}

export function tradeoffForWeek(schedule: ArmSpecializationSchedule, week: number): ArmTradeoffPolicy | null {
  if (!schedule.active) return null;
  for (const b of schedule.blocks) {
    if (week >= b.weekStart && week <= b.weekEnd) return b.tradeoff || null;
  }
  return null;
}
