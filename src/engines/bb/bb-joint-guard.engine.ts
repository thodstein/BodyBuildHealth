/**
 * bb-joint-guard.engine.ts — суставной гард для GH/инсулин/тяжёлых курсов.
 *
 * НЕ ломает тяж/памп дни (не меняет character/rir/reps). Работает на уровне
 * отбора упражнений: штрафует axial/high-stress движения, предпочитает
 * машины/кабели с тем же паттерном.
 */
import { isMobilityRestricted } from './bb-mobility.engine';

export interface JointGuardInput {
  hasGH: boolean;
  ghDose?: number;
  hasAAS: boolean;
  aasDose?: number;
  hasInsulin?: boolean;
  labMrvMultiplier?: number;
  mobilityRestrictions?: string[];
}

export function jointGuardActive(input: JointGuardInput): boolean {
  if (input.hasGH && (input.ghDose ?? 0) >= 4) return true;
  if (input.hasGH && input.hasAAS && (input.ghDose ?? 0) >= 2 && (input.aasDose ?? 0) >= 500) return true;
  if ((input.labMrvMultiplier ?? 1) < 0.65) return true;
  return false;
}

/**
 * Штраф к _score упражнения при активном guard.
 * Возвращает 0 (нет штрафа) или -50/-30.
 * Тяж-дни остаются тяж-днями, но получают машинный аналог.
 */
export function jointGuardScorePenalty(ex: { equipment?: string; jointStress?: string; name?: string }, input: JointGuardInput): number {
  if (!jointGuardActive(input)) return 0;
  const eq = String(ex.equipment || '').toLowerCase();
  const stress = String(ex.jointStress || '').toLowerCase();
  const name = String(ex.name || '').toLowerCase();

  // Axial load: штанга стоя/присед/становая
  const isAxial = eq.includes('barbell') && /присед|squat|тяга.*стоя|deadlift|армейск|overhead/i.test(name);
  if (isAxial) return -50;
  if (stress === 'high') return -40;
  if (eq.includes('barbell') && /жим.*штанги/i.test(name)) return -20; // жим лёжа — мягче, но всё равно штраф
  return 0;
}

export function jointGuardTempoOverride(input: JointGuardInput): string | null {
  if (!jointGuardActive(input)) return null;
  return '4-2-1-0'; // эксцентрик 4с, пауза 2с — бережно
}

export function jointGuardRationale(input: JointGuardInput): string | null {
  if (!jointGuardActive(input)) return null;
  if ((input.labMrvMultiplier ?? 1) < 0.65) return '🛡 Joint guard (лаб): axial/high-stress заменены на машины/кабели';
  if (input.hasGH && (input.ghDose ?? 0) >= 4) return `🛡 Joint guard GH ${input.ghDose}МЕ: связки отстают — машины/кабели приоритет`;
  return '🛡 Joint guard: тяж-дни сохранены, но с машинными аналогами';
}
