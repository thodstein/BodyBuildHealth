/**
 * strength-sport-ta-attempts.engine.ts — ПОПЫТКИ ТА НА СТАРТ (E12 PRO-v2)
 *
 * Заявка → 90/96/102% (conservative 0.97 / balanced 1.0 / aggressive 1.03 —
 * parity с contest-simulator), readiness-флаг: просадка пика >0.15 м/с
 * на стандарте → −2.5кг к заявке (PoinT GO 2026). SnatchTh из FvR (±1.5кг, Sandau)
 * используется как база заявки рывка.
 * Чистый движок, без UI/storage.
 */

export type TAStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface TAAttemptInput {
  declaredMaxKg?: number | null;
  strategy?: TAStrategy;
  /** Пик на стандарте (база) и сегодня — для readiness-флага. */
  peakVelStandard?: number | null;
  peakVelToday?: number | null;
}

export interface TAAttemptPlan {
  baseKg: number;
  attempts: [number, number, number];
  readinessCut: boolean;
  readinessNote: string | null;
  rationale: string[];
}

const STRAT_MULT: Record<TAStrategy, number> = { conservative: 0.97, balanced: 1.0, aggressive: 1.03 };

/** Округление заявки вниз до 1кг (минимальный блин ТА). */
export function roundDownKg(v: number): number {
  return Math.floor(v);
}

export function planTAAttempts(input: TAAttemptInput): TAAttemptPlan | null {
  const base = input.declaredMaxKg;
  if (base == null || !Number.isFinite(base) || base <= 0) return null;
  const strategy: TAStrategy = input.strategy === 'conservative' || input.strategy === 'aggressive' ? input.strategy : 'balanced';
  const mult = STRAT_MULT[strategy];
  let readinessCut = false;
  let readinessNote: string | null = null;
  const std = input.peakVelStandard, today = input.peakVelToday;
  if (std != null && today != null && Number.isFinite(std) && Number.isFinite(today) && std > 0 && today > 0) {
    if (std - today > 0.15) {
      readinessCut = true;
      readinessNote = `Пик просел на ${Math.round((std - today) * 100) / 100} м/с (>0.15) — готовность низкая, −2.5кг к заявке`;
    }
  }
  const adj = base * mult - (readinessCut ? 2.5 : 0);
  const attempts: [number, number, number] = [
    roundDownKg(adj * 0.9),
    roundDownKg(adj * 0.96),
    roundDownKg(adj * 1.02),
  ];
  const rationale = [
    `Заявка ${base}кг × ${strategy} ${mult} ${readinessCut ? '− 2.5кг readiness' : ''} → ${attempts[0]}/${attempts[1]}/${attempts[2]}`,
    'Опener 90% — гарантированный подход; второй 96% — рабочий; третий 102% — рекорд.',
  ];
  return { baseKg: base, attempts, readinessCut, readinessNote, rationale };
}
