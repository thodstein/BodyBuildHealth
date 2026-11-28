/**
 * bb-joint-guard.engine.ts — суставной гард для GH/инсулин/тяжёлых курсов.
 *
 * НЕ ломает тяж/памп дни (не меняет character/rir/reps). Работает на уровне
 * отбора упражнений: штрафует axial/high-stress движения, предпочитает
 * машины/кабели с тем же паттерном.
 */

export interface JointGuardInput {
  hasGH: boolean;
  ghDose?: number;
  hasAAS: boolean;
  aasDose?: number;
  hasInsulin?: boolean;
  labMrvMultiplier?: number;
  mobilityRestrictions?: string[];
  peds?: string[];
  pedDoses?: Record<string, number>;
  /** Эстрадиол (пг/мл) из анализов: <15 пг/мл («высушенные суставы» от ИА/станозолола) включает защиту сухожилий. */
  estradiolPgMl?: number;
}

export function jointGuardActive(input: JointGuardInput): boolean {
  if (input.hasGH && (input.ghDose ?? 0) >= 4) return true;
  if (input.hasGH && input.hasAAS && (input.ghDose ?? 0) >= 2 && (input.aasDose ?? 0) >= 500) return true;
  if ((input.labMrvMultiplier ?? 1) < 0.65) return true;
  const stanRe = /winstrol|stan|stanozolol|станозолол|винстрол/i;
  const hasStanozolol = (input.peds || []).some((p) => stanRe.test(String(p)))
    || Object.entries(input.pedDoses || {}).some(([k, v]) => (Number(v) || 0) > 0 && stanRe.test(k));
  if (hasStanozolol) return true;
  if (input.estradiolPgMl != null && Number.isFinite(input.estradiolPgMl) && input.estradiolPgMl < 15) return true;
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
