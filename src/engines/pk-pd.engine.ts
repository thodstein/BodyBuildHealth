export interface PKParams {
  dose: number; bioavailability?: number; Vd: number; tHalfHours: number; intervalHours: number;
}

export interface PKResult { cMax: number; cMin: number; acc: number; steadyStateDays: number; }

export function eliminationConstant(tHalfHours: number): number {
  if (tHalfHours <= 0) return 0;
  return 0.693 / tHalfHours;
}

export function steadyStatePeak({ dose, bioavailability = 100, Vd, intervalHours, tHalfHours }: PKParams): number {
  const k = eliminationConstant(tHalfHours);
  const F = bioavailability / 100;
  if (Vd <= 0 || tHalfHours <= 0) return 0;
  const acc = 1 / (1 - Math.exp(-k * intervalHours));
  return (dose * F / Vd) * acc;
}

export function steadyStateTrough(params: PKParams): number {
  const k = eliminationConstant(params.tHalfHours);
  const cMax = steadyStatePeak(params);
  return cMax * Math.exp(-k * params.intervalHours);
}

export function concentrationAtTime({ dose, bioavailability = 100, Vd, tHalfHours, timeSinceDose }: PKParams & { timeSinceDose: number }): number {
  const k = eliminationConstant(tHalfHours);
  const F = bioavailability / 100;
  if (Vd <= 0) return 0;
  return (dose * F / Vd) * Math.exp(-k * timeSinceDose);
}

export function simulateCourse(params: { dose: number; bio: number; tHalfHours: number; scheduleDays?: number[]; totalDays: number }) {
  if (!params) return [];
  const kDay = eliminationConstant(params.tHalfHours) * 24;
  const F = params.bio / 100;
  const D = params.dose * F;
  const scheduleDays = params.scheduleDays || [];
  let C = 0;
  const days: Array<{ day: number; inject: boolean; concentration: number }> = [];

  for (let day = 1; day <= (params.totalDays || 0); day++) {
    const inject = scheduleDays.includes(day);
    C = C * Math.exp(-kDay * 1);
    if (inject) C += D;
    days.push({ day, inject, concentration: C });
  }
  return days;
}