/**
 * arm-validator.engine.ts — валидация арм-плана (как bb-validator).
 */
import type { ArmPlan, ArmValidationResult } from './arm-types';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance, checkUCLGuard, checkShoulderGuard, checkTendonGuard } from './arm-injury-guard.engine';
import { checkAntagonistPlan } from './arm-antagonist.engine';
import { getArmCycle } from './arm-cycle-library.engine';
import { getArmPattern } from './arm-split-patterns';

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
    // PRO F: radial/fingers должны встречаться (Praxis топ-3 + containment)
    if (plan.discipline === 'armwrestling') {
      const hasRadial = wk.sessions.some(s => s.exercises.some(e => e.muscle === 'radial_deviators'));
      const hasContain = wk.sessions.some(s => s.exercises.some(e => e.muscle === 'thumb' || e.muscle === 'risers'));
      if (!hasRadial) warnings.push(`Н${wk.week}: нет radial_deviators — добавить лучевое отведение (Praxis топ-3)`);
      if (!hasContain) warnings.push(`Н${wk.week}: нет thumb/risers — добавить containment`);
    }
    // PRO E/H: side в тейпере — только техника минимум
    if (wk.taper) {
      let sideSets = 0;
      for (const sess of wk.sessions) for (const ex of sess.exercises) if (ex.muscle === 'side_pressure') sideSets += ex.sets;
      if (sideSets > 2) warnings.push(`Н${wk.week}: taper + side_pressure ${sideSets} >2 — оставить только технику`);
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
  // Антагонисты (только warnings — valid не меняется, существующие планы целы)
  try {
    const weekly: Record<number, Record<string, number>> = {};
    for (const wk of plan.weeks) {
      const vol: Record<string, number> = {};
      for (const sess of wk.sessions) for (const ex of sess.exercises) vol[ex.muscle] = (vol[ex.muscle] || 0) + ex.sets;
      weekly[wk.week] = vol;
    }
    const ant = checkAntagonistPlan(weekly);
    warnings.push(...ant.warnings);
  } catch { /* опционально */ }
  // Цикл↔сплит (только при cycleId; только warnings — valid не меняется)
  try {
    const cid = String((plan.inputSnapshot as any)?.cycleId || '');
    const pid = String((plan.inputSnapshot as any)?.patternId || '');
    const c = cid ? getArmCycle(cid) : undefined;
    const p = pid ? getArmPattern(pid) : undefined;
    if (c && p) {
      const splitPerWeek = (p.sessionsPerRotation * 7) / Math.max(1, p.rotationDays);
      if (Math.abs(splitPerWeek - c.daysPerWeek) >= 2)
        warnings.push(`Цикл ${c.name} (${c.daysPerWeek}×/нед) vs сплит ${p.name} (~${splitPerWeek.toFixed(1)}×/нед) — частота различается ≥2, проверьте восстановление.`);
      const tableSess = plan.weeks[0]?.sessions.filter((s) => s.tableTime).length || 0;
      if (c.tablePerWeek > 0 && tableSess < c.tablePerWeek)
        warnings.push(`Цикл ${c.name} просит стол ${c.tablePerWeek}×/нед, в плане ${tableSess} — добавьте TableTech (Кузнецов VIII).`);
    }
  } catch { /* опционально */ }
  // valid — как было: только mrvOverflow + errors (tendon/ucl/shoulder — warnings, не invalid, иначе сломаем существующие планы)
  const valid = errors.length === 0 && mrvOverflow.length === 0;
  return { valid, errors, warnings, mrvOverflow, humerusWarnings, balanceWarnings, tendonWarnings: [...tendonWarnings, ...uclWarnings, ...shoulderWarnings] };
}
