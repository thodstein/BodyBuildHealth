import { SYRINGE_SPECS } from '../core/constants';
import { DoseRequest, DoseResponse } from '../core/types';

export function calculateDose(req: DoseRequest): DoseResponse {
  const flags: string[] = [];
  let dose = req.targetDoseMg;
  if (req.bodyWeightKg && req.targetDosePerKg) dose = req.targetDosePerKg * req.bodyWeightKg;
  if (dose <= 0 || req.concentrationMgPerMl <= 0) {
    flags.push('invalid_input');
    return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags };
  }
  let vol = dose / req.concentrationMgPerMl;
  if (req.roundingStepMl > 0) vol = Math.round(vol / req.roundingStepMl) * req.roundingStepMl;
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