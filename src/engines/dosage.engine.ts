import { SYRINGE_SPECS } from '../core/constants';
import { DoseRequest, DoseResult } from '../core/types';

export function calculateDose(req: DoseRequest): DoseResult {
  if (!req) return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags: ['invalid_input'] };
  const flags: string[] = [];
  let dose = req.targetDoseMg ?? 0;
  if (req.bodyWeightKg && req.targetDosePerKg) dose = req.targetDosePerKg * req.bodyWeightKg;
  // Unit conversion: doseUnit vs concentrationUnit (mg vs mcg vs IU)
  const doseUnit = String((req as any).targetDoseUnit || 'mg').toLowerCase();
  const concUnit = String((req as any).concentrationUnit || 'mg/ml').toLowerCase();
  let doseMg = dose;
  const subId = String((req as any).substanceId || '').toLowerCase();
  const isInsulin = subId.includes('ins_') || subId === 'insulin' || subId.includes('insulin');
  if (doseUnit.includes('mcg') || doseUnit.includes('µg') || doseUnit.includes('ug')) doseMg = dose / 1000;
  else if (doseUnit === 'g' || doseUnit.includes('g/')) doseMg = dose * 1000;
  else if (doseUnit.includes('iu')) {
    if (concUnit.includes('mg')) {
      // GH: 1 mg ≈ 3 IU, инсулин: 1 IU ≈ 0.0347 mg
      const iuToMg = isInsulin ? 0.0347 : 0.333;
      doseMg = dose * iuToMg;
    } else if (concUnit.includes('iu')) {
      // both IU → no conversion, keep IU as is (volume = IU / IU/ml)
      doseMg = dose;
    } else {
      flags.push('unit_mismatch_iu_vs_mg');
    }
  }
  let concMgMl = req.concentrationMgPerMl;
  if (concUnit.includes('mcg')) concMgMl = concMgMl / 1000;
  else if (concUnit.includes('g/') && !concUnit.includes('mg')) concMgMl = concMgMl * 1000;
  else if (concUnit.includes('iu') && doseUnit.includes('mg')) {
    // mg dose vs IU/ml conc → convert conc IU/ml to mg/ml
    const iuToMg = isInsulin ? 0.0347 : 0.333;
    concMgMl = concMgMl * iuToMg;
  }
  dose = doseMg;
  const conc = concMgMl;
  if (dose <= 0 || !conc || typeof conc !== 'number' || conc <= 0) {
    flags.push('invalid_input');
    return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags };
  }
  let vol = dose / conc;
  if ((req.roundingStepMl ?? 0) > 0) vol = Math.round(vol / req.roundingStepMl!) * req.roundingStepMl!;
  const syr = SYRINGE_SPECS[req.syringeVolumeMl];
  if (!syr) flags.push('unknown_syringe');
  else if (vol > syr.maxVolume) flags.push('exceeds_syringe_volume');
  if (req.vialVolumeMl && vol > req.vialVolumeMl) flags.push('exceeds_vial_volume');
  return {
    volumeMl: Math.max(0, Number(vol.toFixed(3))),
    divisions: Math.round(vol * (syr?.divisionsPerMl || 100)),
    dosesPerVial: req.vialVolumeMl ? Math.floor(req.vialVolumeMl / (vol || 0.001)) : 0,
    flags
  };
}
