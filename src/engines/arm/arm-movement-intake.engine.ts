/**
 * arm-movement-intake.engine.ts — приёмник движения схватки в Арм-конструкторе.
 *
 * Мост шлёт 6 movement-полей (matchPhase/start/vector/foul/tableStrength/
 * humerusDanger) + failPhase в схватках — приёмник их молча ронял.
 * Здесь чистая функция без сайд-эффектов: санитизация + строки для flash.
 * Сборку плана НЕ меняем (инфо-слой, прецедент armLifting-моста выше).
 */

export const ARM_MOVEMENT_KEY = 'he_arm_last_movement';

export interface ArmMovementBridgeData {
  armMatchPhase?: unknown;
  armStartNote?: unknown;
  armVectorNote?: unknown;
  armFoulNote?: unknown;
  armTableStrengthNote?: unknown;
  armHumerusDangerNote?: unknown;
  armBouts?: unknown;
}

export interface ArmMovementIntake {
  /** null — мост пустой, приёмнику нечего делать (байт-в-байт). */
  persist: { key: string; value: Record<string, string> } | null;
  flashes: string[];
  /** Мода фазы срыва в журнале (для строки Table-IQ). */
  phaseMode: string | null;
}

const VALID_PHASES = ['setup', 'readygo', 'start', 'mid', 'pin'] as const;

function cleanStr(v: unknown, cap = 300): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, cap);
  return t ? t : null;
}

function cleanPhase(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return (VALID_PHASES as readonly string[]).includes(t) ? t : null;
}

export function resolveArmMovementIntake(data: ArmMovementBridgeData | null | undefined): ArmMovementIntake {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const phase = cleanPhase(d['armMatchPhase']);
  const start = cleanStr(d['armStartNote']);
  const vector = cleanStr(d['armVectorNote']);
  const foul = cleanStr(d['armFoulNote']);
  const strength = cleanStr(d['armTableStrengthNote']);
  const danger = cleanStr(d['armHumerusDangerNote']);
  // Мода failPhase из журнала схваток (только валидные фазы).
  let phaseMode: string | null = null;
  try {
    const bouts = (d as any).armBouts;
    if (Array.isArray(bouts) && bouts.length) {
      const counts = new Map<string, number>();
      for (const b of bouts) {
        const ph = typeof (b as any)?.failPhase === 'string' ? (b as any).failPhase.trim().toLowerCase() : '';
        if ((VALID_PHASES as readonly string[]).includes(ph)) counts.set(ph, (counts.get(ph) || 0) + 1);
      }
      if (counts.size) {
        const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
        phaseMode = `${top[0]} (${top[1]}/${(bouts as unknown[]).length})`;
      }
    }
  } catch { /* noop */ }
  const hasNotes = phase != null || start != null || vector != null || foul != null || strength != null || danger != null || phaseMode != null;
  if (!hasNotes) return { persist: null, flashes: [], phaseMode };
  const value: Record<string, string> = {};
  if (phase) value['matchPhase'] = phase;
  if (start) value['startNote'] = start;
  if (vector) value['vectorNote'] = vector;
  if (foul) value['foulNote'] = foul;
  if (strength) value['tableStrengthNote'] = strength;
  if (danger) value['humerusDangerNote'] = danger;
  if (phaseMode) value['phaseMode'] = phaseMode;
  const flashes: string[] = [];
  const bits: string[] = [];
  if (phase) bits.push(`фаза ${phase}`);
  if (start) bits.push('старт');
  if (vector) bits.push('векторы');
  if (strength) bits.push('сила стола');
  if (foul) bits.push('фолы');
  if (phaseMode) bits.push(`мода журнала: ${phaseMode}`);
  if (bits.length) flashes.push(`🥋 Движение схватки: ${bits.join(' · ')}`);
  if (danger) flashes.push(`⛔ ${danger}`);
  return { persist: { key: ARM_MOVEMENT_KEY, value }, flashes, phaseMode };
}
