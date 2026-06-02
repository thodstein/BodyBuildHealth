import { CourseEntry, ConcentrationPoint, LabHysteresis, BayesianState } from '../core/types';
import { PHARMA_DB, PKPD_DEFAULTS } from '../core/constants';

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

// ТЗ §9.3: Расчёт концентрации по курсу
export function calculateConcentration(course: CourseEntry[], weeks: number = 52, bayesian: BayesianState = { clearanceK: 1, ec50Shift: 1, lastUpdateWeek: 0 }): ConcentrationPoint[] {
  const result: ConcentrationPoint[] = [];
  const dt = PKPD_DEFAULTS.dt_hours;
  const stepsPerWeek = 7*24/dt;
  let A1=0, A2=0, A3=0, tol=0, integralCp=0;
  const kTol = PKPD_DEFAULTS.kTol;

  for(let w=0; w<=weeks; w++) {
    let weekDose = 0;
    course.forEach(c => {
      if(w >= c.startWeek && w <= c.endWeek) {
        const sub = PHARMA_DB[c.substanceId];
        const bio = sub ? sub.pk.bioavailability : PKPD_DEFAULTS.bioavailability;
        weekDose += c.doseValue * bio * (c.doseUnit.includes('/wk') ? 1/7 : 1);
      }
    });
    if(weekDose > 0) A1 += weekDose;

    let lastCp = 0;
    for(let s=0; s<stepsPerWeek; s++) {
      const [nA1,nA2,nA3] = rk4Step(A1,A2,A3,dt, PKPD_DEFAULTS.ka, PKPD_DEFAULTS.k10, PKPD_DEFAULTS.k12, PKPD_DEFAULTS.k21);
      A1=Math.max(0,nA1); A2=Math.max(0,nA2); A3=Math.max(0,nA3);
      
      const cp = Math.max(0, (A2/PKPD_DEFAULTS.Vd_liters) * (bayesian.clearanceK ?? 1));
      tol = Math.min(PKPD_DEFAULTS.maxTol, tol + kTol * cp * dt);
      integralCp += cp * dt;
      lastCp = cp;
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
  const oralCount = course.filter(c => PHARMA_DB[c.substanceId]?.pd.hepatotoxicity >= 2);
  
  course.forEach(c => {
    if(!PHARMA_DB[c.substanceId]) warnings.push(`Неизвестный препарат: ${c.substanceId}`);
    if(c.endWeek < c.startWeek) warnings.push(`Ошибка недели: ${c.substanceId} (end < start)`);
    if(c.doseValue <= 0) warnings.push(`Доза должна быть >0: ${c.substanceId}`);
  });

  oralCount.forEach(c => {
    if((c.endWeek - c.startWeek) > 8) warnings.push(`${c.substanceId} >8 нед: высокий гепатотоксический риск`);
  });

  return { valid: warnings.length === 0, warnings };
}