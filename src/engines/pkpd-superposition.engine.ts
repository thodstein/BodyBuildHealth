import { CourseEntry, BayesianState, ConcentrationPoint } from '../core/types';
import { PHARMA_DB, PKPD_DEFAULTS } from '../core/constants';
import { injectionsPerWeek } from './pharma-frequency';

interface SubstanceState {
  A1: number; A2: number; A3: number;
  dosePerDay: number; bio: number; ka: number; k10: number; k12: number; k21: number; Vd: number;
  injSchedule: Set<number>; injDose: number;
}

export function calculateMultiSubstancePKPD(
  course: CourseEntry[],
  weeks: number = 52,
  bayesian: BayesianState = { clearanceK: 1, ec50Shift: 1, lastUpdateWeek: 0 }
): ConcentrationPoint[] {
  if (!course || !Array.isArray(course) || !course.length) return [];
  const result: ConcentrationPoint[] = [];
  const dt = PKPD_DEFAULTS.dt_hours;
  const stepsPerWeek = Math.round(7 * 24 / dt);
  const totalTol: number[] = Array(weeks + 1).fill(0);
  const b = bayesian ?? { clearanceK: 1, ec50Shift: 1, lastUpdateWeek: 0 };
  // Allowed values for when PK data is missing
  const FALLBACK_PK = { bioavailability: 0.8, ka: 0.02, k10: 0.03, k12: 0.01, k21: 0.005, Vd: 50 };

  // Группировка и инициализация веществ + расписание болюсов
  // Ключ — уникальный по записи (не по substanceId), чтобы не суммировать дозы разных периодов
  const substances = new Map<string, SubstanceState>();
  course.forEach((c, idx) => {
    if (!c) return;
    const sub = PHARMA_DB[c.substanceId];
    if (!sub || !sub.pk) return;
    const pk = sub.pk;
    const perWeek = injectionsPerWeek(c.frequency as any);
    const weeklyDose = c.doseValue ?? 0;
    const dosePerInjection = perWeek > 0 ? weeklyDose / perWeek : weeklyDose;
    const startW = Number.isFinite(c.startWeek as number) ? (c.startWeek as number) : 0;
    const endW = Number.isFinite(c.endWeek as number) ? (c.endWeek as number) : weeks;
    const durationWeeks = Math.max(0, endW - startW);
    const totalInjections = Math.round(perWeek * durationWeeks);
    const intervalSteps = perWeek > 0 ? stepsPerWeek / perWeek : stepsPerWeek;
    const schedule = new Set<number>();
    const baseStep = Math.round(startW * stepsPerWeek);
    for (let i = 0; i < totalInjections; i++) {
      const step = Math.round(baseStep + i * intervalSteps) + 1;
      if (step >= 1 && step <= weeks * stepsPerWeek + stepsPerWeek) schedule.add(step);
    }
    const key = `${c.substanceId}__${(c as any).id ?? idx}`;
    substances.set(key, {
      A1: 0, A2: 0, A3: 0,
      dosePerDay: dosePerInjection * perWeek / 7,
      bio: pk.bioavailability ?? FALLBACK_PK.bioavailability,
      ka: pk.ka ?? FALLBACK_PK.ka,
      k10: pk.k10 ?? FALLBACK_PK.k10,
      k12: pk.k12 ?? FALLBACK_PK.k12,
      k21: pk.k21 ?? FALLBACK_PK.k21,
      Vd: (pk.Vd && pk.Vd > 0) ? pk.Vd : FALLBACK_PK.Vd,
      injSchedule: schedule,
      injDose: dosePerInjection * (pk.bioavailability ?? FALLBACK_PK.bioavailability),
    });
  });

  const states = Array.from(substances.values());
  const kTol = PKPD_DEFAULTS.kTol;
  let cumulativeTol = 0;

  for (let w = 0; w <= weeks; w++) {
    let weekCpSum = 0;
    let weekIntegralCp = 0;

    const baseStep = w * stepsPerWeek;
    for (let s = 0; s < stepsPerWeek; s++) {
      const step = baseStep + s;
      let stepTotalCp = 0;
      states.forEach(state => {
        // Bolus injection at scheduled steps
        if (state.injSchedule.has(step)) state.A1 += state.injDose;

        // RK4 шаг для каждого вещества
        const f11 = -state.ka * state.A1;
        const f12 = state.ka * state.A1 - (state.k10 + state.k12) * state.A2 + state.k21 * state.A3;
        const f13 = state.k12 * state.A2 - state.k21 * state.A3;
        const f21 = -state.ka * (state.A1 + f11 * dt / 2);
        const f22 = state.ka * (state.A1 + f11 * dt / 2) - (state.k10 + state.k12) * (state.A2 + f12 * dt / 2) + state.k21 * (state.A3 + f13 * dt / 2);
        const f23 = state.k12 * (state.A2 + f12 * dt / 2) - state.k21 * (state.A3 + f13 * dt / 2);
        const f31 = -state.ka * (state.A1 + f21 * dt / 2);
        const f32 = state.ka * (state.A1 + f21 * dt / 2) - (state.k10 + state.k12) * (state.A2 + f22 * dt / 2) + state.k21 * (state.A3 + f23 * dt / 2);
        const f33 = state.k12 * (state.A2 + f22 * dt / 2) - state.k21 * (state.A3 + f23 * dt / 2);
        const f41 = -state.ka * (state.A1 + f31 * dt);
        const f42 = state.ka * (state.A1 + f31 * dt) - (state.k10 + state.k12) * (state.A2 + f32 * dt) + state.k21 * (state.A3 + f33 * dt);
        const f43 = state.k12 * (state.A2 + f32 * dt) - state.k21 * (state.A3 + f33 * dt);

        state.A1 = Math.max(0, state.A1 + (f11 + 2*f21 + 2*f31 + f41) * dt / 6);
        state.A2 = Math.max(0, state.A2 + (f12 + 2*f22 + 2*f32 + f42) * dt / 6);
        state.A3 = Math.max(0, state.A3 + (f13 + 2*f23 + 2*f33 + f43) * dt / 6);

        const vd = (state.Vd > 0) ? state.Vd : FALLBACK_PK.Vd;
        const cp = (state.A2 / vd) * (b.clearanceK ?? 1);
        stepTotalCp += cp;
        weekCpSum += cp;
        weekIntegralCp += cp * dt;
      });
      cumulativeTol = Math.min(PKPD_DEFAULTS.maxTol, cumulativeTol + kTol * stepTotalCp * dt);
      totalTol[w] = cumulativeTol;
    }

    const avgCp = weekCpSum / Math.max(stepsPerWeek, 1);
    const combinedEC50 = 400 * (b.ec50Shift ?? 1) * (1 + 0.01 * (weekIntegralCp || 0));
    const effect = Math.max(0, Math.min(100, (isFinite(avgCp) ? avgCp : 0) ** 2.5 / ((isFinite(combinedEC50) ? combinedEC50 : 400) ** 2.5 + (isFinite(avgCp) ? avgCp : 0) ** 2.5))) * (1 - (totalTol[w] || 0)) * 100;

    result.push({
      week: w,
      cp: parseFloat(avgCp.toFixed(2)),
      tol: parseFloat(totalTol[w].toFixed(3)),
      effect: parseFloat(effect.toFixed(1))
    });
  }

  return result;
}