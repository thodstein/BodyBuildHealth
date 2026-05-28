import { registry } from '../core/data/registry';
import type { SubstanceEntry } from '../core/types';

export function calculatePK({ substanceId, doseMg, bioPercent, intervalHours, hours }: { substanceId: string; doseMg: number; bioPercent: number; intervalHours: number; hours: number }): number {
  const sub = registry.get().substances.find(s => s.id.toUpperCase() === substanceId.toUpperCase());
  const tHalf = sub?.tHalfHours || 4;
  const k = 0.693 / tHalf;
  const F = bioPercent / 100;
  const acc = 1 / (1 - Math.exp(-k * intervalHours));
  const cMax = (doseMg * F) * acc;
  return cMax * Math.exp(-k * hours);
}

export function calculateDose({ mgPerKg, weightKg, liverIndex = 0, gfr = 100 }: { mgPerKg: number; weightKg: number; liverIndex?: number; gfr?: number }): { base: number; liverAdj: number; kidneyAdj: number } {
  const base = mgPerKg * weightKg;
  const liverAdj = base * Math.max(0.2, 1 - (liverIndex / 100));
  const kidneyAdj = base * Math.max(0.3, Math.min(1.5, gfr / 100));
  return { base, liverAdj, kidneyAdj };
}