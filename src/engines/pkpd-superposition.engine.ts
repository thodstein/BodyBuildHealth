import { CourseEntry, BayesianState, ConcentrationPoint } from '../core/types';
import { PHARMA_DB, PKPD_DEFAULTS } from '../core/constants';

interface SubstanceState {
  A1: number; A2: number; A3: number;
  dosePerDay: number; bio: number; ka: number; k10: number; k12: number; k21: number; Vd: number;
}

export function calculateMultiSubstancePKPD(
  course: CourseEntry[],
  weeks: number = 52,
  bayesian: BayesianState = { clearanceK: 1, ec50Shift: 1, lastUpdateWeek: 0 }
): ConcentrationPoint[] {
  const result: ConcentrationPoint[] = [];
  const dt = PKPD_DEFAULTS.dt_hours;
  const stepsPerWeek = Math.round(7 * 24 / dt);
  const totalTol: number[] = Array(weeks + 1).fill(0);

  // Группировка и инициализация веществ + расписание болюсов
  const substances = new Map<string, SubstanceState & { injSchedule: Set<number>; injDose: number }>();
  course.forEach(c => {
    const sub = PHARMA_DB[c.substanceId];
    if (!sub) return;
    const freqStr = String(c.frequency ?? '');
    const freqMatch = freqStr.match(/(\d+)x\/week/);
    const injectionsPerWeek = freqMatch ? parseInt(freqMatch[1]) : 2;
    const dosePerInjection = c.doseValue / injectionsPerWeek;
    const intervalSteps = Math.round(stepsPerWeek / injectionsPerWeek);
    const totalInjections = injectionsPerWeek * Math.max(0, c.endWeek ?? weeks);
    const schedule = new Set<number>();
    for (let i = 0; i < totalInjections; i++) schedule.add(i * intervalSteps + 1);
    if (!substances.has(c.substanceId)) {
      substances.set(c.substanceId, {
        A1: 0, A2: 0, A3: 0,
        dosePerDay: dosePerInjection * injectionsPerWeek / 7, bio: sub.pk.bioavailability, ka: sub.pk.ka,
        k10: sub.pk.k10, k12: sub.pk.k12, k21: sub.pk.k21, Vd: sub.pk.Vd,
        injSchedule: schedule, injDose: dosePerInjection * sub.pk.bioavailability
      });
    } else {
      const ex = substances.get(c.substanceId)!;
      schedule.forEach(s => ex.injSchedule.add(s));
      ex.injDose += dosePerInjection * sub.pk.bioavailability;
    }
  });

  const states = Array.from(substances.values());
  const kTol = PKPD_DEFAULTS.kTol;

  for (let w = 0; w <= weeks; w++) {
    let weekTotalCp = 0;
    let weekIntegralCp = 0;

    const baseStep = w * stepsPerWeek;
    for (let s = 0; s < stepsPerWeek; s++) {
      const step = baseStep + s;

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

        const cp = (state.A2 / state.Vd) * (bayesian.clearanceK ?? 1);
        weekTotalCp += cp;
        weekIntegralCp += cp * dt;
      });

      totalTol[w] = Math.min(PKPD_DEFAULTS.maxTol, totalTol[w] + kTol * weekTotalCp * dt);
    }

    const avgCp = weekTotalCp / stepsPerWeek;
    const combinedEC50 = 400 * (bayesian.ec50Shift ?? 1) * (1 + 0.01 * weekIntegralCp);
    const effect = Math.max(0, Math.min(100, (avgCp ** 2.5) / (combinedEC50 ** 2.5 + avgCp ** 2.5))) * (1 - totalTol[w]) * 100;

    result.push({
      week: w,
      cp: parseFloat(avgCp.toFixed(2)),
      tol: parseFloat(totalTol[w].toFixed(3)),
      effect: parseFloat(effect.toFixed(1))
    });
  }

  return result;
}