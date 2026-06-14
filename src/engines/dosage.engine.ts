import { SYRINGE_SPECS } from '../core/constants';
import { DoseRequest, DoseResult } from '../core/types';

export function calculateDose(req: DoseRequest): DoseResult {
  if (!req) return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags: ['invalid_input'] };
  const flags: string[] = [];
  let dose = req.targetDoseMg ?? 0;
  if (req.bodyWeightKg && req.targetDosePerKg) dose = req.targetDosePerKg * req.bodyWeightKg;
  const conc = req.concentrationMgPerMl;
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
