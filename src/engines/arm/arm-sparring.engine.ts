/**
 * arm-sparring.engine.ts — спарринг-менеджмент за столом (эпик E PRO-плана).
 *
 * Главный источник травм и перегруза. Правила:
 * - 70% техника / 90% контроль / 100% только heavy-недели, ≤1×/нед;
 * - 100% запрещён в deload/peaking-1 и при tendon-нагрузке >18;
 * - новички: первые 3 месяца только ≤70% (Almazov — без борьбы в полную силу);
 * - партнёр ±5 кг (безопасный подбор).
 */

export type SparringIntensity = 70 | 90 | 100;

export interface SparringSession {
  intensityPct: SparringIntensity;
  rounds: number;
  roundSec: number;
  partnerDeltaKg: number; // партнёр минус атлет
  allowed: boolean;
  warnings: string[];
}

export function sparringAllowed(input: {
  intensityPct: SparringIntensity;
  level?: string;
  phase?: string;
  isDeload?: boolean;
  isPeakingLast?: boolean;
  tendonSets?: number;
  sessionsThisWeek?: number;
}): { allowed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const tendon = Number(input.tendonSets ?? 0);
  // TOP wave-12: новички первые 3 месяца — только ≤70%
  if ((input.level || '').toLowerCase() === 'beginner' && input.intensityPct >= 90) {
    warnings.push('Новичок: первые 3 месяца только 70% техника, без борьбы в полную силу.');
  }
  if (input.intensityPct === 100) {
    if (input.isDeload) warnings.push('100% спарринг запрещён в deload.');
    if (input.isPeakingLast) warnings.push('100% спарринг запрещён в пиковую неделю.');
    if (tendon > 18) warnings.push(`Tendon ${tendon} >18 — только 70% техника.`);
    if ((input.sessionsThisWeek ?? 0) >= 1) warnings.push('100% уже был на неделе — второй только 70%.');
    if ((input.phase || '').toLowerCase() === 'accumulation' && tendon > 14)
      warnings.push('Накопление + tendon>14 — снизить до 90%.');
  }
  if (input.intensityPct === 90 && (input.isDeload || input.isPeakingLast))
    warnings.push('90% в deload/пик — снизить до 70%.');
  return { allowed: warnings.length === 0, warnings };
}

export function planSparring(input: {
  intensityPct: SparringIntensity;
  level?: string;
  partnerDeltaKg?: number;
  phase?: string;
  isDeload?: boolean;
  isPeakingLast?: boolean;
  tendonSets?: number;
  sessionsThisWeek?: number;
}): SparringSession {
  const gate = sparringAllowed(input);
  const lvl = (input.level || '').toLowerCase();
  const rounds = input.intensityPct === 100 ? 3 : input.intensityPct === 90 ? 4 : 5;
  const roundSec = input.intensityPct === 70 ? 20 : 12;
  const d = Number(input.partnerDeltaKg ?? 0);
  const warnings = [...gate.warnings];
  if (Math.abs(d) > 5) warnings.push(`Партнёр ${d > 0 ? '+' : ''}${d} кг — вне ±5 кг, только 70%.`);
  const allowed = gate.allowed && Math.abs(d) <= 5;
  void lvl;
  return { intensityPct: input.intensityPct, rounds, roundSec, partnerDeltaKg: d, allowed, warnings };
}

/** Подбор партнёра: ближайший по весу в пределах ±5 кг. */
export function pickSparringPartner(bwKg: number, candidatesKg: number[]): number | null {
  const inRange = candidatesKg.filter((c) => Math.abs(c - bwKg) <= 5);
  if (inRange.length === 0) return null;
  return inRange.sort((a, b) => Math.abs(a - bwKg) - Math.abs(b - bwKg))[0];
}
