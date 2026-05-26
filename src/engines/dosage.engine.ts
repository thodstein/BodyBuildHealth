import { SYRINGE_SPECS } from '../core/constants';
import { DoseRequest, DoseResponse } from '../core/types';

export function calculateDose(req: DoseRequest): DoseResponse {
  const flags: string[] = [];
  let absoluteDose = req.targetDoseMg;

  // ТЗ §4.6.1: Пересчёт мг/кг или ЕД/кг
  if (req.bodyWeightKg && req.targetDosePerKg) {
    absoluteDose = req.targetDosePerKg * req.bodyWeightKg;
  }

  if (absoluteDose <= 0) {
    flags.push('invalid_dose');
    return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags };
  }
  if (req.concentrationMgPerMl <= 0) {
    flags.push('invalid_concentration');
    return { volumeMl: 0, divisions: 0, dosesPerVial: 0, flags };
  }

  // Расчёт объёма
  let volumeMl = absoluteDose / req.concentrationMgPerMl;

  // ТЗ §4.7.2: Округление до разумного шага
  if (req.roundingStepMl > 0) {
    volumeMl = Math.round(volumeMl / req.roundingStepMl) * req.roundingStepMl;
  }

  // Проверка физических ограничений
  const syringe = SYRINGE_SPECS[req.syringeVolumeMl];
  if (!syringe) flags.push('unknown_syringe_type');
  else if (volumeMl > syringe.maxVolume) flags.push('exceeds_syringe_volume');
  
  if (req.vialVolumeMl && volumeMl > req.vialVolumeMl) {
    flags.push('exceeds_vial_volume');
  }

  // Деления шприца
  const divisions = Math.round(volumeMl * (syringe?.divisionsPerMl || 100));

  // Доз во флаконе
  const dosesPerVial = req.vialVolumeMl ? Math.floor(req.vialVolumeMl / (volumeMl || 0.001)) : 0;

  return {
    volumeMl: Math.max(0, Number(volumeMl.toFixed(3))),
    divisions: Math.max(0, divisions),
    dosesPerVial,
    flags
  };
}