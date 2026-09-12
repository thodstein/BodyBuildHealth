// Peptide PRO helpers — реверс, шприц, недельная сетка. Формулы — паритет dosagepeptide/healius/precision.
// conc(mcg/ml) = mg*1000/ml; vol(ml) = dose/conc; units(U-100) = vol*100.
export function concentrationMcgPerMl(amountMg: number, waterMl: number): number {
  if (!(amountMg > 0) || !(waterMl > 0)) return 0;
  return (amountMg * 1000) / waterMl;
}

export function drawForDose(amountMg: number, waterMl: number, doseMcg: number): { volMl: number; units: number; dosesPerVial: number } {
  const conc = concentrationMcgPerMl(amountMg, waterMl);
  if (!(conc > 0) || !(doseMcg > 0)) return { volMl: 0, units: 0, dosesPerVial: 0 };
  const volMl = doseMcg / conc;
  return {
    volMl: Math.round(volMl * 1000) / 1000,
    units: Math.round(volMl * 100 * 10) / 10,
    dosesPerVial: Math.floor((amountMg * 1000) / doseMcg),
  };
}

// Реверс (паритет glp1.app): хочу doseMcg = targetUnits (U-100) → сколько воды.
export function waterForTargetUnits(amountMg: number, doseMcg: number, targetUnits: number): number {
  if (!(amountMg > 0) || !(doseMcg > 0) || !(targetUnits > 0)) return 0;
  const volMl = targetUnits / 100;
  const conc = doseMcg / volMl;
  const waterMl = (amountMg * 1000) / conc;
  return Math.round(waterMl * 100) / 100;
}

export function recommendPeptideSyringe(units: number): string {
  if (!(units > 0)) return '—';
  if (units <= 15) return 'U-100 0.3 мл — точнее для малых доз';
  if (units <= 50) return 'U-100 0.5 мл';
  return 'U-100 1 мл';
}

// Недельная сетка: частота → дни (дважды в нед — Пн/Чт, еженедельно — Пн).
export function weeklySchedule(peptideId: string, freqPerWeek: number): string[] {
  const n = Math.max(0, Math.min(7, Math.round(freqPerWeek || 0)));
  if (n <= 0) return [];
  if (n >= 7) return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  if (n === 1) return ['Пн'];
  if (n === 2) return ['Пн', 'Чт'];
  if (n === 3) return ['Пн', 'Ср', 'Пт'];
  const all = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(all[Math.round((i * 7) / n) % 7]);
  return [...new Set(out)];
}

// Справочник стартовых доз (паритет precision-таблице).
export const PEPTIDE_DOSE_REF: { id: string; vialMg: number; waterMl: number; doseMcg: number; units: number }[] = [
  { id: 'BPC-157 5мг', vialMg: 5, waterMl: 2, doseMcg: 250, units: 10 },
  { id: 'TB-500 10мг', vialMg: 10, waterMl: 2, doseMcg: 2500, units: 50 },
  { id: 'GHK-Cu 50мг', vialMg: 50, waterMl: 5, doseMcg: 2000, units: 20 },
  { id: 'Semax 10мг', vialMg: 10, waterMl: 2, doseMcg: 500, units: 10 },
];
