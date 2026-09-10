/**
 * strength-sport-ta-velocity-guard.engine.ts — BARBELL-ГЕЙТ СКОРОСТЕЙ (W3 PRO-v3)
 *
 * Suchomel et al. 2025, JSCR 39(2): barbell vs system velocity — разные величины
 * (p<0.001, g≥1.49 на всех деривативах/нагрузках), подменять нельзя.
 * Хаб работает только с barbell-скоростью (штанга: Enode/LPT/Kinovea).
 * Подозрительные значения (похоже на system/jump или опечатка) — флагом, не блоком.
 * Чистый движок, без UI/storage.
 */

export type TALiftForVelocity = 'snatch' | 'clean' | 'jerk' | 'squat' | string;

/** Подпись единиц скорости везде в хабе — явно «штанга». */
export const BARBELL_VELOCITY_UNIT = 'м/с (штанга)';

/**
 * Потолок правдоподобной barbell-скорости ТА.
 * Пиковые: рывок ≤2.7 (лёгкие тяги/пустой гриф), взятие/толчок ≤2.5.
 * System (прыжок с весом) легко >3.0 — это и ловим.
 */
const BARBELL_VMAX_HARD_CAP: Record<string, number> = {
  snatch: 2.7,
  clean: 2.5,
  jerk: 2.5,
};

export interface VelocityGuardResult {
  suspect: boolean;
  reason: string | null;
}

/** Проверка одного замера barbell-скорости. null-вход → не suspect (нечего проверять). */
export function isSystemVelocitySuspect(velMs: number | null | undefined, lift?: TALiftForVelocity | null): VelocityGuardResult {
  if (velMs == null || !Number.isFinite(velMs) || velMs <= 0) return { suspect: false, reason: null };
  const key = typeof lift === 'string' && lift.includes('clean') ? 'clean' : typeof lift === 'string' && lift.includes('jerk') ? 'jerk' : 'snatch';
  const cap = BARBELL_VMAX_HARD_CAP[key] ?? 2.7;
  if (velMs > 3.0) {
    return {
      suspect: true,
      reason: `Похоже на system-скорость (прыжок), а не штангу: ${velMs} м/с > 3.0 (Suchomel 2025 — barbell≠system). В LVP/FvR только barbell.`,
    };
  }
  if (velMs > cap) {
    return {
      suspect: true,
      reason: `Выше потолка barbell для ${key} (>${cap} м/с): проверь девайс/единицы — system-замеры сюда нельзя.`,
    };
  }
  if (velMs < 0.3) {
    return {
      suspect: true,
      reason: 'Ниже 0.3 м/с — похоже на опечатку или среднюю вместо пиковой.',
    };
  }
  return { suspect: false, reason: null };
}

/** Проверка пары best/last одним вызовом (для VBT-блока). */
export function guardVbtPair(best: number | null | undefined, last: number | null | undefined, lift?: TALiftForVelocity | null): VelocityGuardResult {
  const b = isSystemVelocitySuspect(best, lift);
  if (b.suspect) return b;
  return isSystemVelocitySuspect(last, lift);
}
