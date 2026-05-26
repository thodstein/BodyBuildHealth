// Web Worker: PK/PD интегрирование методом Рунге-Кутты 4-го порядка
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;
  
  if (type === 'PKPD_RK4') {
    const { doseMg, intervalDays, weeks, ka, k10, k12, k21, Vd } = payload;
    const dt = 0.1; // шаг интегрирования (часы)
    const totalHours = weeks * 7 * 24;
    const steps = Math.ceil(totalHours / dt);
    
    let A1 = 0, A2 = 0, A3 = 0; // компартменты: депо, центральный, периферический
    const conc: number[] = [];
    let tol = 0; // толерантность
    const kTol = 0.00005; // скорость развития толерантности

    for (let step = 0; step <= steps; step++) {
      const t = step * dt;
      // Инъекция в депо
      if (t > 0 && Math.abs(t % (intervalDays * 24)) < dt) {
        A1 += doseMg;
      }

      // RK4
      const f1_1 = -ka * A1;
      const f1_2 = ka * A1 - (k10 + k12) * A2 + k21 * A3;
      const f1_3 = k12 * A2 - k21 * A3;

      const f2_1 = -ka * (A1 + f1_1 * dt / 2);
      const f2_2 = ka * (A1 + f1_1 * dt / 2) - (k10 + k12) * (A2 + f1_2 * dt / 2) + k21 * (A3 + f1_3 * dt / 2);
      const f2_3 = k12 * (A2 + f1_2 * dt / 2) - k21 * (A3 + f1_3 * dt / 2);

      const f3_1 = -ka * (A1 + f2_1 * dt / 2);
      const f3_2 = ka * (A1 + f2_1 * dt / 2) - (k10 + k12) * (A2 + f2_2 * dt / 2) + k21 * (A3 + f2_3 * dt / 2);
      const f3_3 = k12 * (A2 + f2_2 * dt / 2) - k21 * (A3 + f2_3 * dt / 2);

      const f4_1 = -ka * (A1 + f3_1 * dt);
      const f4_2 = ka * (A1 + f3_1 * dt) - (k10 + k12) * (A2 + f3_2 * dt) + k21 * (A3 + f3_3 * dt);
      const f4_3 = k12 * (A2 + f3_2 * dt) - k21 * (A3 + f3_3 * dt);

      A1 += (f1_1 + 2*f2_1 + 2*f3_1 + f4_1) * dt / 6;
      A2 += (f1_2 + 2*f2_2 + 2*f3_2 + f4_2) * dt / 6;
      A3 += (f1_3 + 2*f2_3 + 2*f3_3 + f4_3) * dt / 6;

      // Толерантность (накапливается пропорционально AUC)
      tol += kTol * (A2 / Vd) * dt;
      if (step % 240 === 0) { // сэмплим раз в сутки
        const cp = Math.max(0, (A2 / Vd) *