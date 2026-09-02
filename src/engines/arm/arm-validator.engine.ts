/**
 * arm-validator.engine.ts — валидация арм-плана (как bb-validator).
 */
import type { ArmPlan, ArmValidationResult } from './arm-types';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance, checkUCLGuard, checkShoulderGuard, checkTendonGuard } from './arm-injury-guard.engine';

export function validateArmPlan(plan: ArmPlan, level?: string): ArmValidationResult {
  const lvl = level || plan.level || 'intermediate';
  const errors: string[] = [];
  const warnings: string[] = [];
  const mrvOverflow: Array<{ muscle: string; sets: number; mrv: number }> = [];

  for (const wk of plan.weeks) {
    // session cap
    for (const sess of wk.sessions) {
      if (sess.exercises.length > 10) errors.push(`Н${wk.week} ${sess.sessionTag}: упражнений ${sess.exercises.length} >10`);
      for (const ex of sess.exercises) {
        if (ex.sets > 6) warnings.push(`Н${wk.week} ${ex.muscle}: ${ex.sets} сетов >6`);
        if (ex.rir < 0 || ex.rir > 5) errors.push(`Н${wk.week} ${ex.name}: RIR ${ex.rir} вне 0..5`);
      }
    }
    // weekly MRV
    const weekly: Record<string, number> = {};
    for (const sess of wk.sessions) for (const ex of sess.exercises) weekly[ex.muscle] = (weekly[ex.muscle] || 0) + ex.sets;
    for (const [mus, sets] of Object.entries(weekly)) {
      const mrv = plan.mrvByMuscle?.[mus] || getArmLandmarks(lvl, mus).mrv;
      if (sets > mrv) {
        mrvOverflow.push({ muscle: mus, sets, mrv });
        warnings.push(`Н${wk.week} ${mus}: ${sets} > MRV ${mrv}`);
      }
      const mev = getArmLandmarks(lvl, mus).mev;
      if (sets > 0 && sets < mev) warnings.push(`Н${wk.week} ${mus}: ${sets} < MEV ${mev} — мало стимула`);
    }
    // table ratio
    const tableS = wk.sessions.filter(s => s.tableTime).length;
    const ratio = tableS / Math.max(1, wk.sessions.length);
    if (plan.discipline === 'armwrestling' && ratio < 0.3 && wk.sessions.length >= 3) {
      warnings.push(`Н${wk.week}: table time ${(ratio*100).toFixed(0)}% <30% — для армрестлинга мало стола`);
    }
  }

  const humerusWarnings = checkHumerusGuard(plan);
  warnings.push(...humerusWarnings);
  const balanceWarnings = checkWristBalance(plan);
  warnings.push(...balanceWarnings);
  const uclWarnings = checkUCLGuard(plan as any);
  warnings.push(...uclWarnings);
  const shoulderWarnings = checkShoulderGuard(plan as any);
  warnings.push(...shoulderWarnings);
  const tendonWarnings = checkTendonGuard(plan as any);
  warnings.push(...tendonWarnings);
  // valid — как было: только mrvOverflow + errors (tendon/ucl/shoulder — warnings, не invalid, иначе сломаем существующие планы)
  const valid = errors.length === 0 && mrvOverflow.length === 0;
  return { valid, errors, warnings, mrvOverflow, humerusWarnings, balanceWarnings, tendonWarnings: [...tendonWarnings, ...uclWarnings, ...shoulderWarnings] };
}
