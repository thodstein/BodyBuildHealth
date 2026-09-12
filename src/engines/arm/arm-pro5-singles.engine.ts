/**
 * arm-pro5-singles.engine.ts — PRO-5 P4 синглы Larratt + RPE-паритет StrengthLog.
 *
 * Источники: Larratt 2025 (3 движения high/low pron + cup, 17–18 синглов,
 * микрошаг +1.25 lb ≈0.57 кг, working max ≈92%), StrengthLog 8-week
 * (W1–4 RPE 7–8, W5–8 RPE 8–9, 4 дня + стол отдельно, сеты базы −1).
 * Без флага heavySingles/rpeParity — модули не вызываются (старые планы целы).
 */

/** RPE↔RIR карта (канонシлов... честно: RIR = 10 − RPE для синглов/малых повторов). */
export const RPE_RIR_MAP: Record<number, number> = {
  10: 0, 9: 1, 8: 2, 7: 3, 6: 4, 5: 5,
};

export function rirForRpe(rpe: number): number {
  const r = Math.round(Number(rpe));
  if (!Number.isFinite(r)) return 2;
  if (r >= 10) return 0;
  if (r <= 5) return 5;
  return RPE_RIR_MAP[r] ?? 2;
}

/** StrengthLog-паритет фаз: W1–4 RPE 7–8 → RIR 2–3; W5–8 RPE 8–9 → RIR 1–2. */
export function strengthLogRir(weekInBlock: number, character: string): number {
  const firstHalf = weekInBlock <= 4;
  if (character === 'тяж') return firstHalf ? 2 : 1;
  if (character === 'техника') return firstHalf ? 3 : 2;
  return 2;
}

/** Схема Larratt-синглов на движение: 5 зачётных синглов в плане + практика строкой. */
export interface LarrattSingles {
  sets: number;
  reps: 1;
  rir: number;
  pctOfMax: number;
  microStepKg: number;
  comment: string;
}

export function larrattSinglesFor(stepKg = 0.57): LarrattSingles {
  return {
    sets: 5,
    reps: 1,
    rir: 1,
    pctOfMax: 0.92,
    microStepKg: stepKg,
    comment:
      'Larratt-синглы 5×1 @92% RIR1 (первые 5 из 17–18; полная лесенка — самостоятельная практика, микрошаг +0.57 кг/нед, только свежими, техника чистая).',
  };
}

/** Кандидат-движения под синглы (high/low pronation + cup). */
const SINGLES_MUSCLES = new Set(['pronators', 'wrist_flexors', 'risers', 'brachioradialis']);

export function isSinglesCandidate(muscle: string): boolean {
  return SINGLES_MUSCLES.has(String(muscle || '').toLowerCase());
}
