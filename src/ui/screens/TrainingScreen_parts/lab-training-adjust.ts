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

export interface SerumLabTrainingSignals {
  hematocritPct?: number | null;
  ferritinNgMl?: number | null;
  glucoseMmol?: number | null;
  homaIr?: number | null;
  sodiumMmol?: number | null;
  potassiumMmol?: number | null;
  estradiolPgMl?: number | null;
}

export function labTrainingAdjust(lab: LabCompositeResult | null, serum?: SerumLabTrainingSignals | null): LabTrainingAdjust {
  if (!lab && !serum) return { mrvMultiplier: 1, intensityNote: '', warnings: [], deloadRecommended: false };
  let mult = 1;
  const warnings: string[] = [];
  let deload = false;
  let note = '';

  if (lab) {
    // Проход 153: неизмеренный индекс (`null`) не снижает объём и не даёт
    // предупреждения — «нет анализов» больше не выглядит как «печень в порядке 75».
    const { liverStress, kidneyStress, inflammation, hormoneScore, cardioRisk } = lab;

    if (liverStress !== null && liverStress > 60) { mult = Math.min(mult, 0.85); warnings.push(`Печёночный стресс ${liverStress}/100: снизить объём на ~15%, меньше отказных подходов.`); deload = true; }
    else if (liverStress !== null && liverStress > 40) { mult = Math.min(mult, 0.93); warnings.push(`Печёночный стресс ${liverStress}/100 (умеренно): избегать избытка объёма.`); }

    if (kidneyStress !== null && kidneyStress > 60) { mult = Math.min(mult, 0.9); warnings.push(`Почечный стресс ${kidneyStress}/100: контролировать белок/объём, снизить интенсивность на ~10%.`); }

    if (inflammation !== null && inflammation > 60) { mult = Math.min(mult, 0.8); warnings.push(`Воспаление (CRP) ${inflammation}/100: рекомендуется разгрузочная неделя, снизить объём на ~20%.`); deload = true; }
    else if (inflammation !== null && inflammation > 40) { mult = Math.min(mult, 0.92); warnings.push(`Воспаление ${inflammation}/100 (умеренно): ограничить объём.`); }

    if (hormoneScore !== null && hormoneScore > 60) { mult = Math.min(mult, 0.85); warnings.push(`Гормональные отклонения (${hormoneScore}/100): снизить объём на ~15%, добавить восстановление.`); note = 'При отклонениях гормонального профиля упор на качество (RIR 2-3), меньше отказов.'; }
    else if (hormoneScore !== null && hormoneScore > 40) { mult = Math.min(mult, 0.93); note = 'Гормональный профиль с отклонениями — умеренный объём, без перегруза.'; }

    if (cardioRisk !== null && cardioRisk > 60) { warnings.push(`Сердечно-сосудистый риск ${cardioRisk}/100: исключить натуживание (Valsalva), контролировать АД, избегать максимальных подходов.`); note = note || 'Ограничить максимальные подходы, контролировать АД.'; }
  }

  if (serum) {
    const hct = serum.hematocritPct;
    if (hct != null && Number.isFinite(hct)) {
      if (hct >= 54) {
        mult = Math.min(mult, 0.85);
        deload = true;
        warnings.push(`Гематокрит ${hct}% (≥54%): высокий риск тромбоза/гипервязкости — снизить объём, исключить обезвоживание и предельные натуживания, обсудить с врачом.`);
      } else if (hct >= 51) {
        mult = Math.min(mult, 0.95);
        warnings.push(`Гематокрит ${hct}% (≥51%): контролировать гидратацию и динамику ОАК.`);
      }
    }
    const ferr = serum.ferritinNgMl;
    if (ferr != null && Number.isFinite(ferr) && ferr < 20) {
      mult = Math.min(mult, 0.9);
      warnings.push(`Ферритин ${ferr} нг/мл (<20): дефицит железа снижает восстановление и выносливость — ограничить объём и кардио-перегруз.`);
    }
    const glu = serum.glucoseMmol;
    const homa = serum.homaIr;
    if ((glu != null && Number.isFinite(glu) && glu >= 7.0) || (homa != null && Number.isFinite(homa) && homa >= 3.5)) {
      warnings.push('Углеводный обмен (глюкоза ≥7.0 / HOMA-IR ≥3.5): осторожность с высокоуглеводными окнами/ГР-инсулином, приоритет низкого ГИ и контроля гликемии.');
    }
    const na = serum.sodiumMmol;
    const k = serum.potassiumMmol;
    if ((na != null && Number.isFinite(na) && (na < 135 || na > 146)) || (k != null && Number.isFinite(k) && (k < 3.5 || k > 5.3))) {
      mult = Math.min(mult, 0.85);
      deload = true;
      warnings.push('Электролитный сдвиг (Na/K вне референса): отказ от диуретиков, солевых/водных манипуляций и предельных сетов до нормализации и осмотра врача.');
    }
  }

  mult = Math.max(0.7, mult);
  if (!note && mult < 1) note = `Объём снижен до ${Math.round(mult * 100)}% по данным лаборатории.`;
  return { mrvMultiplier: mult, intensityNote: note, warnings, deloadRecommended: deload };
}