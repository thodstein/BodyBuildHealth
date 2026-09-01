/**
 * arm-grip.engine.ts — модель хватов армлифтинга (как bb-grip).
 * Rolling Thunder / Apollon Axle / Saxon Bar / Hub / Pinch / CoC.
 */
export type ArmGripType = 'support' | 'pinch' | 'crush' | 'hub';
export type ArmImplement = 'rolling_thunder' | 'apollon_axle' | 'saxon_bar' | 'hub' | 'pinch_block' | 'coc_bullet' | 'farmer_handles' | 'fat_gripz';

export interface GripImplementSpec {
  id: ArmImplement;
  name: string;
  diameterMm: number;
  rotating: boolean;
  gripType: ArmGripType;
  allowedGrips: Array<'DOH' | 'mixed' | 'hook'>;
  strapsAllowed: boolean;
  description: string;
}

export const GRIP_IMPLEMENTS: Record<ArmImplement, GripImplementSpec> = {
  rolling_thunder: { id: 'rolling_thunder', name: 'Rolling Thunder', diameterMm: 60, rotating: true, gripType: 'support', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Вращающаяся ручка 60мм (2 3/8"), DOH без лямок. WR 130.5кг' },
  apollon_axle: { id: 'apollon_axle', name: 'Apollon Axle', diameterMm: 58, rotating: false, gripType: 'support', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Толстый гриф 58мм, DOH без лямок/разнохвата' },
  saxon_bar: { id: 'saxon_bar', name: 'Saxon Bar', diameterMm: 76, rotating: false, gripType: 'pinch', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Прямоугольник 3" (76мм), щипок двумя руками' },
  hub: { id: 'hub', name: 'IronMind Hub', diameterMm: 70, rotating: false, gripType: 'hub', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Хаб щипок' },
  pinch_block: { id: 'pinch_block', name: 'Pinch Block', diameterMm: 60, rotating: false, gripType: 'pinch', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Блок щипок' },
  coc_bullet: { id: 'coc_bullet', name: 'CoC Silver Bullet', diameterMm: 30, rotating: false, gripType: 'crush', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Эспандер + патрон' },
  farmer_handles: { id: 'farmer_handles', name: 'Farmer Handles', diameterMm: 35, rotating: false, gripType: 'support', allowedGrips: ['DOH'], strapsAllowed: false, description: 'Фермер 20-30м' },
  fat_gripz: { id: 'fat_gripz', name: 'Fat Gripz', diameterMm: 50, rotating: false, gripType: 'support', allowedGrips: ['DOH','mixed'], strapsAllowed: true, description: 'Накладки 50мм' },
};

export function getGripSpec(id: string): GripImplementSpec | undefined {
  return (GRIP_IMPLEMENTS as any)[id];
}

export function gripVolumeFor(implement: ArmImplement, level: string): { sets: number; reps: string; restSec: number } {
  const lvl = (level || '').toLowerCase();
  const isEnhanced = lvl === 'enhanced';
  if (implement === 'rolling_thunder' || implement === 'apollon_axle') {
    return { sets: isEnhanced ? 5 : 4, reps: '3-5 тяж / 8-12 объём', restSec: 180 };
  }
  if (implement === 'saxon_bar' || implement === 'hub' || implement === 'pinch_block') {
    return { sets: isEnhanced ? 4 : 3, reps: 'hold 10-20с', restSec: 120 };
  }
  if (implement === 'coc_bullet') {
    return { sets: 4, reps: '5-8 / hold', restSec: 90 };
  }
  return { sets: 3, reps: '8-12', restSec: 90 };
}

export function gripProgression(week: number, maxWeight: number, implement: ArmImplement): number {
  // linear ~2.5% /нед первые 6 нед, затем 1%
  const pct = week <= 6 ? 1 + (week - 1) * 0.025 : 1.15 + (week - 7) * 0.01;
  return Math.round(maxWeight * pct * 2) / 2;
}

export function estimateGripMax(weight: number, holdSeconds: number, implement: ArmImplement): number {
  // упрощённо: hold 10с = 100%, 20с = 90%
  if (holdSeconds <= 10) return weight;
  const factor = Math.max(0.85, 1 - (holdSeconds - 10) * 0.01);
  return Math.round(weight / factor);
}
