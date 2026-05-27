export function eliminationConstant(tHalfHours: number): number {
  if (!tHalfHours || tHalfHours <= 0) return 0;
  return 0.693 / tHalfHours;
}

export function concentrationSingleDose({
  dose, bioavailability = 100, Vd, tHours, tHalfHours
}: {
  dose: number; bioavailability?: number; Vd: number; tHours: number; tHalfHours: number;
}): number {
  const k = eliminationConstant(tHalfHours);
  const F = bioavailability / 100;
  if (!Vd || Vd <= 0) return 0;
  return (dose * F / Vd) * Math.exp(-k * tHours);
}

export function steadyStatePeak({
  dose, bioavailability = 100, Vd, tauHours, tHalfHours
}: {
  dose: number; bioavailability?: number; Vd: number; tauHours: number; tHalfHours: number;
}): number {
  const k = eliminationConstant(tHalfHours);
  const F = bioavailability / 100;
  const acc = 1 / (1 - Math.exp(-k * tauHours));
  return (dose * F / Vd) * acc;
}

export function steadyStateTrough({
  dose, bioavailability = 100, Vd, tauHours, tHalfHours
}: {
  dose: number; bioavailability?: number; Vd: number; tauHours: number; tHalfHours: number;
}): number {
  const cMax = steadyStatePeak({ dose, bioavailability, Vd, tauHours, tHalfHours });
  const k = eliminationConstant(tHalfHours);
  return cMax * Math.exp(-k * tauHours);
}

export function doseByWeight(mgPerKg: number, weightKg: number): number {
  return mgPerKg * weightKg;
}

export function adjustByLiver(doseMg: number, liverStressIndex: number = 0): number {
  const stress = Math.max(0, Math.min(100, liverStressIndex));
  return Math.max(0, doseMg * (1 - stress / 100));
}

export function adjustByKidney(doseMg: number, gfr: number = 100): number {
  const renalFunc = Math.max(15, Math.min(130, gfr));
  return Math.max(0, doseMg * (renalFunc / 100));
}