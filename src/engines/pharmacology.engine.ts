import { CourseEntry, ConcentrationPoint, LabHysteresis, BayesianState } from '../core/types';
import { PHARMA_DB, PKPD_DEFAULTS } from '../core/constants';
import { weeklyDose } from './pharma-frequency';

// ТЗ §9.3: RK4 шаг для 2-компартментной модели
function rk4Step(A1:number,A2:number,A3:number, dt:number, ka:number, k10:number, k12:number, k21:number): [number,number,number] {
  const f11=-ka*A1, f12=ka*A1-(k10+k12)*A2+k21*A3, f13=k12*A2-k21*A3;
  const f21=-ka*(A1+f11*dt/2), f22=ka*(A1+f11*dt/2)-(k10+k12)*(A2+f12*dt/2)+k21*(A3+f13*dt/2), f23=k12*(A2+f12*dt/2)-k21*(A3+f13*dt/2);
  const f31=-ka*(A1+f21*dt/2), f32=ka*(A1+f21*dt/2)-(k10+k12)*(A2+f22*dt/2)+k21*(A3+f23*dt/2), f33=k12*(A2+f22*dt/2)-k21*(A3+f23*dt/2);
  const f41=-ka*(A1+f31*dt), f42=ka*(A1+f31*dt)-(k10+k12)*(A2+f32*dt)+k21*(A3+f33*dt), f43=k12*(A2+f32*dt)-k21*(A3+f33*dt);
  return [
    A1+(f11+2*f21+2*f31+f41)*dt/6,
    A2+(f12+2*f22+2*f32+f42)*dt/6,
    A3+(f13+2*f23+2*f33+f43)*dt/6
  ];
}

// ТЗ §9.3: Расчёт концентрации по курсу — per-substance PK (каждый препарат со своими ka/k10/k12/k21/Vd)
export function calculateConcentration(course: CourseEntry[], weeks: number = 52, bayesian: BayesianState = { clearanceK: 1, ec50Shift: 1, lastUpdateWeek: 0 }): ConcentrationPoint[] {
  const result: ConcentrationPoint[] = [];
  const dt = PKPD_DEFAULTS.dt_hours;
  const stepsPerWeek = 7*24/dt;
  const kTol = PKPD_DEFAULTS.kTol;
  type SubState = { A1:number; A2:number; A3:number; ka:number; k10:number; k12:number; k21:number; Vd:number; bio:number; startWeek:number; endWeek:number; wkDose:number };
  const states: SubState[] = (Array.isArray(course) ? course : []).map((c, idx) => {
    const sub = (c && PHARMA_DB[c.substanceId]) || null;
    const pk = sub?.pk as any;
    const ka = Number.isFinite(pk?.ka) ? pk.ka : PKPD_DEFAULTS.ka;
    const k10 = Number.isFinite(pk?.k10) ? pk.k10 : PKPD_DEFAULTS.k10;
    const k12 = Number.isFinite(pk?.k12) ? pk.k12 : PKPD_DEFAULTS.k12;
    const k21 = Number.isFinite(pk?.k21) ? pk.k21 : PKPD_DEFAULTS.k21;
    const Vd = Number.isFinite(pk?.Vd) && pk.Vd > 0 ? pk.Vd : (Number.isFinite(PKPD_DEFAULTS.Vd_liters) ? PKPD_DEFAULTS.Vd_liters : 35);
    const bio = Number.isFinite(pk?.bioavailability) ? pk.bioavailability : PKPD_DEFAULTS.bioavailability;
    const wk = weeklyDose((c as any).doseValue ?? 0, (c as any).doseUnit, (c as any).frequency);
    return {
      A1:0, A2:0, A3:0, ka, k10, k12, k21, Vd, bio,
      startWeek: Number.isFinite((c as any).startWeek) ? (c as any).startWeek : 0,
      endWeek: Number.isFinite((c as any).endWeek) ? (c as any).endWeek : weeks,
      wkDose: Number.isFinite(wk) ? wk : 0,
    };
  }).filter(s => s.wkDose > 0);
  let tol=0, integralCp=0;
  for(let w=0; w<=weeks; w++) {
    // Болус в начале недели для активных веществ
    for(const st of states) {
      if(w >= st.startWeek && w <= st.endWeek) {
        // weekly bolus (bioavailable)
        st.A1 += st.wkDose * st.bio;
      }
    }
    let lastCp = 0;
    for(let s=0; s<stepsPerWeek; s++) {
      let stepTotalCp = 0;
      for(const st of states) {
        const [nA1,nA2,nA3] = rk4Step(st.A1, st.A2, st.A3, dt, st.ka, st.k10, st.k12, st.k21);
        st.A1=Math.max(0,nA1); st.A2=Math.max(0,nA2); st.A3=Math.max(0,nA3);
        const cp = Math.max(0, (st.A2 / (st.Vd || PKPD_DEFAULTS.Vd_liters)) * (bayesian.clearanceK ?? 1));
        stepTotalCp += cp;
      }
      tol = Math.min(PKPD_DEFAULTS.maxTol, tol + kTol * stepTotalCp * dt);
      integralCp += stepTotalCp * dt;
      lastCp = stepTotalCp;
    }
    const ec50 = 400 * (bayesian.ec50Shift ?? 1) * (1 + 0.01 * integralCp);
    const effect = Math.max(0, Math.min(1, (lastCp ** 2.5) / (ec50 ** 2.5 + lastCp ** 2.5))) * (1 - tol);
    result.push({ week: w, cp: parseFloat(lastCp.toFixed(2)), tol: parseFloat(tol.toFixed(3)), effect: parseFloat((effect*100).toFixed(1)) });
  }
  return result;
}

// ТЗ §9.3: Гистерезис лаб. маркеров (задержка реакции на концентрацию)
export function updateHysteresis(history: LabHysteresis, effectWeek: number): number {
  if(!history.history.length) return history.baseline;
  const tauWeeks = history.tauDays/7;
  const last = history.history[history.history.length-1];
  return last + (effectWeek - last)/tauWeeks;
}

// ТЗ §9.3: Байесовское обновление при вводе фактических лаб.
export function bayesianUpdate(state: BayesianState, labPredicted: number, labActual: number): BayesianState {
  const K = 0.15, err = labActual - labPredicted;
  return {
    clearanceK: Math.max(0.5, (state.clearanceK ?? 1) + K * err * 0.01),
    ec50Shift: Math.max(0.5, (state.ec50Shift ?? 1) + K * err * 0.005),
    lastUpdateWeek: state.lastUpdateWeek
  };
}

// ТЗ §4.6: Валидация введённого курса
export function validateCourse(course: CourseEntry[]): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const oralCount = course.filter(c => (PHARMA_DB[c.substanceId]?.pd?.hepatotoxicity ?? 0) >= 2);
  
  course.forEach(c => {
    if(!PHARMA_DB[c.substanceId]) warnings.push(`Неизвестный препарат: ${c.substanceId}`);
    if(c.endWeek < c.startWeek) warnings.push(`Ошибка недели: ${c.substanceId} (end < start)`);
    if(c.doseValue <= 0) warnings.push(`Доза должна быть >0: ${c.substanceId}`);
  });

  oralCount.forEach(c => {
    const dur = (c.endWeek ?? 0) - (c.startWeek ?? 0) + 1;
    if(dur > 8) warnings.push(`${c.substanceId} >8 нед: высокий гепатотоксический риск`);
  });

  return { valid: warnings.length === 0, warnings };
}