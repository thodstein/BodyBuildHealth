/**
 * lab-training-adjust.ts — корректировка тренировочного объёма/интенсивности
 * по данным лаборатории (LabCompositeResult). Возвращает множитель MRV,
 * рекомендацию по интенсивности и предупреждения.
 */
import type { LabCompositeResult } from '../../../engines/lab-analysis.engine';

export interface LabTrainingAdjust {
  mrvMultiplier: number;     // 0.7-1.0 — на сколько снижать MRV
  intensityNote: string;     // рекомендация по интенсивности
  warnings: string[];        // предупреждения
  deloadRecommended: boolean;
}

export function labTrainingAdjust(lab: LabCompositeResult | null): LabTrainingAdjust {
  if (!lab) return { mrvMultiplier: 1, intensityNote: '', warnings: [], deloadRecommended: false };
  let mult = 1;
  const warnings: string[] = [];
  let deload = false;
  let note = '';

  if (lab.liverStress > 60) { mult = Math.min(mult, 0.85); warnings.push(`Печёночный стресс ${lab.liverStress}: снизить объём на ~15%, меньше отказных подходов.`); deload = true; }
  else if (lab.liverStress > 40) { mult = Math.min(mult, 0.93); warnings.push(`Печёночный стресс ${lab.liverStress} (умеренно): избегать избытка объёма.`); }

  if (lab.kidneyStress > 60) { mult = Math.min(mult, 0.9); warnings.push(`Почечный стресс ${lab.kidneyStress}: контролировать белок/объём, снизить интенсивность на ~10%.`); }

  if (lab.inflammation > 60) { mult = Math.min(mult, 0.8); warnings.push(`Воспаление (CRP) ${lab.inflammation}: рекомендуется разгрузочная неделя, снизить объём на ~20%.`); deload = true; }
  else if (lab.inflammation > 40) { mult = Math.min(mult, 0.92); warnings.push(`Воспаление ${lab.inflammation} (умеренно): ограничить объём.`); }

  // hormoneScore: низкий тестостерон → меньше объёма/интенсивности
  if (lab.hormoneScore != null && lab.hormoneScore < 40) { mult = Math.min(mult, 0.85); warnings.push(`Низкий гормональный фон (тестостерон): снизить объём на ~15%, добавить восстановление.`); note = 'При низком тестостероне упор на качество (RIR 2-3), меньше отказов.'; }
  else if (lab.hormoneScore != null && lab.hormoneScore < 60) { mult = Math.min(mult, 0.93); note = 'Гормональный фон средний — умеренный объём, без перегруза.'; }

  if (lab.cardioRisk > 60) { warnings.push(`Сердечно-сосудистый риск ${lab.cardioRisk}: исключить натуживание (Valsalva), контролировать АД, избегать максимальных подходов.`); note = note || 'Ограничить максимальные подходы, контролировать АД.'; }

  mult = Math.max(0.7, mult);
  if (!note && mult < 1) note = `Объём снижен до ${Math.round(mult * 100)}% по данным лаборатории.`;
  return { mrvMultiplier: mult, intensityNote: note, warnings, deloadRecommended: deload };
}