/**
 * bb-spec-annual.engine.ts — PRO-3 R7: спец-блок ББ → конфиг BB-блока годового плана.
 *
 * Годовой движок (`annual-training/block-builders.buildBBBlock`) понимает только
 * weakPoints/focusGroup/specialization — длину блока и доноров несёт notes.
 * Чистый маппер: спец-блок + гранулярные зоны → Partial<AnnualBlockConfig>.
 * Применение — официальным `setAnnualBlockConfig` (блок → stale, результат цел).
 */
import type { AnnualBlockConfig } from '../annual-training/annual-training.types';
import { canonicalMuscle } from './bb-specialization.engine';
import type { SpecBlock } from './bb-spec-block.engine';

export interface BbSpecAnnualPatch extends Partial<AnnualBlockConfig> {
  weakPoints: string[];
  focusGroup?: string;
  specialization: boolean;
  notes: string;
}

export function bbSpecToAnnualPatch(
  spec: SpecBlock | null | undefined,
  weakZones: string[],
): BbSpecAnnualPatch | null {
  const zones = [...new Set((weakZones || []).map((z) => String(z).toLowerCase().trim()).filter(Boolean))].slice(0, 2);
  if (!zones.length) return null;
  const weakPoints = [...new Set(zones.map((z) => canonicalMuscle(z)))];
  const donors = spec && Array.isArray(spec.donors) ? spec.donors.map((d) => String(d)).filter(Boolean).slice(0, 2) : [];
  const lengthWeeks = spec && Number.isFinite(spec.lengthWeeks) ? Math.max(3, Math.min(12, Math.round(spec.lengthWeeks))) : 8;
  const ru: Record<string, string> = {
    chest: 'грудь', back: 'спина', quads: 'квадрицепс', hamstrings: 'бицепс бедра', shoulders: 'плечи',
    biceps: 'бицепс', triceps: 'трицепс', calves: 'икры', glutes: 'ягодицы', abs: 'пресс',
    traps: 'трапеции', forearms: 'предплечья',
  };
  const ruOf = (z: string) => ru[canonicalMuscle(z)] || z;
  return {
    weakPoints,
    focusGroup: weakPoints[0],
    specialization: true,
    notes: `ББ-диагностика: спец-блок ${zones.map(ruOf).join(' + ')} ${lengthWeeks} нед${donors.length ? `, доноры ${donors.map(ruOf).join(', ')} (поддержка)` : ''}`,
  };
}
