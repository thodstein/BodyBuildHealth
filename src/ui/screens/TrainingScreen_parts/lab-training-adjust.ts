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

  // Проход 153: неизмеренный индекс (`null`) не снижает объём и не даёт
  // предупреждения — «нет анализов» больше не выглядит как «печень в порядке 75».
  const { liverStress, kidneyStress, inflammation, hormoneScore, cardioRisk } = lab;

  if (liverStress !== null && liverStress > 60) { mult = Math.min(mult, 0.85); warnings.push(`Печёночный стресс ${liverStress}: снизить объём на ~15%, меньше отказных подходов.`); deload = true; }
  else if (liverStress !== null && liverStress > 40) { mult = Math.min(mult, 0.93); warnings.push(`Печёночный стресс ${liverStress} (умеренно): избегать избытка объёма.`); }

  if (kidneyStress !== null && kidneyStress > 60) { mult = Math.min(mult, 0.9); warnings.push(`Почечный стресс ${kidneyStress}: контролировать белок/объём, снизить интенсивность на ~10%.`); }

  if (inflammation !== null && inflammation > 60) { mult = Math.min(mult, 0.8); warnings.push(`Воспаление (CRP) ${inflammation}: рекомендуется разгрузочная неделя, снизить объём на ~20%.`); deload = true; }
  else if (inflammation !== null && inflammation > 40) { mult = Math.min(mult, 0.92); warnings.push(`Воспаление ${inflammation} (умеренно): ограничить объём.`); }

  // hormoneScore: низкий тестостерон → меньше объёма/интенсивности
  if (hormoneScore !== null && hormoneScore < 40) { mult = Math.min(mult, 0.85); warnings.push(`Низкий гормональный фон (тестостерон): снизить объём на ~15%, добавить восстановление.`); note = 'При низком тестостероне упор на качество (RIR 2-3), меньше отказов.'; }
  else if (hormoneScore !== null && hormoneScore < 60) { mult = Math.min(mult, 0.93); note = 'Гормональный фон средний — умеренный объём, без перегруза.'; }

  if (cardioRisk !== null && cardioRisk > 60) { warnings.push(`Сердечно-сосудистый риск ${cardioRisk}: исключить натуживание (Valsalva), контролировать АД, избегать максимальных подходов.`); note = note || 'Ограничить максимальные подходы, контролировать АД.'; }

  mult = Math.max(0.7, mult);
  if (!note && mult < 1) note = `Объём снижен до ${Math.round(mult * 100)}% по данным лаборатории.`;
  return { mrvMultiplier: mult, intensityNote: note, warnings, deloadRecommended: deload };
}