/**
 * symptom-mechanism-bridge.ts — Мост: Симптом → Механизм риска
 *
 * Связывает категории симптомов (SymptomCategory) с:
 *   - bridge-ключами (cardio_1..8, hepatic_1..8, etc.) для подбора веществ
 *   - TZ-механизмами (cv1-cv5, liv1-liv3, ren1-ren4, cns1-cns6, rep1-rep5, hem1-hem5)
 *
 * Позволяет symptom-driven подбору использовать тот же движок, что и lab-driven.
 */
import type { SymptomCategory } from './symptom-solver.types';

/** Bridge-ключи для каждой категории симптомов */
export const SYMPTOM_CATEGORY_TO_BRIDGE: Record<SymptomCategory, string[]> = {
  cardiovascular: [
    'cardio_1', 'cardio_2', 'cardio_4', 'cardio_5', 'cardio_6', 'cardio_7',
  ],
  hepatic: [
    'hepatic_1', 'hepatic_2', 'hepatic_5', 'hepatic_6', 'hepatic_7', 'hepatic_8',
  ],
  renal: [
    'renal_1', 'renal_2', 'renal_3', 'renal_4', 'renal_5', 'renal_7',
  ],
  cns: [
    'neuro_1', 'neuro_2', 'neuro_3', 'neuro_5', 'neuro_6',
    'neuro_tox_1', 'neuro_tox_2', 'neuro_tox_4', 'neuro_tox_5', 'neuro_tox_6', 'neuro_tox_7',
  ],
  endocrine: [
    'endocrine_1', 'endocrine_2', 'endocrine_3', 'endocrine_4', 'endocrine_5',
    'endocrine_6', 'endocrine_7',
  ],
  gastrointestinal: [
    'gastro_1', 'gastro_2', 'gastro_3', 'gastro_4', 'gastro_5',
  ],
  musculoskeletal: [
    'musculoskeletal_1', 'musculoskeletal_2', 'musculoskeletal_4', 'musculoskeletal_5', 'musculoskeletal_7',
  ],
  hematologic: [
    'blood_1', 'blood_2', 'blood_3', 'blood_4',
  ],
  dermatologic: [
    'skin_1', 'skin_2', 'skin_3',
  ],
  psychological: [
    'neuro_2', 'neuro_tox_1', 'neuro_tox_2', 'neuro_tox_5', 'neuro_tox_6', 'neuro_tox_7',
  ],
};

/** TZ-механизмы для каждой категории симптомов */
export const SYMPTOM_CATEGORY_TO_TZ_MECH: Record<SymptomCategory, string[]> = {
  cardiovascular: ['cv1', 'cv2', 'cv3', 'cv4', 'cv5'],
  hepatic: ['liv1', 'liv2', 'liv3'],
  renal: ['ren1', 'ren2', 'ren3', 'ren4'],
  cns: ['cns1', 'cns2', 'cns3', 'cns4', 'cns5', 'cns6'],
  endocrine: ['rep1', 'rep2', 'rep3', 'rep4', 'rep5'],
  gastrointestinal: ['liv1', 'liv2', 'ren2'],
  musculoskeletal: ['hem2', 'cns3'],
  hematologic: ['hem1', 'hem2', 'hem3', 'hem4', 'hem5'],
  dermatologic: ['rep4', 'liv1'],
  psychological: ['cns1', 'cns2', 'cns3', 'cns4'],
};

/** Получить bridge-ключи для категории симптомов */
export function getBridgeKeysForCategory(cat: SymptomCategory): string[] {
  return SYMPTOM_CATEGORY_TO_BRIDGE[cat] || [];
}

/** Получить TZ-механизмы для категории симптомов */
export function getTzMechIdsForCategory(cat: SymptomCategory): string[] {
  return SYMPTOM_CATEGORY_TO_TZ_MECH[cat] || [];
}

/** Оценка severity симптома на основе числа проблем и их probability */
export function getSymptomSeverityScore(
  problems: Array<{ probability: 'high' | 'medium' | 'low' }>
): number {
  if (!problems.length) return 0;
  let score = 0;
  for (const p of problems) {
    if (p.probability === 'high') score += 3;
    else if (p.probability === 'medium') score += 2;
    else score += 1;
  }
  return Math.min(100, Math.round((score / (problems.length * 3)) * 100));
}

/** Приоритет решения (0-100) на основе evidenceLevel */
export function getSolutionPriority(
  solutions: Array<{ evidenceLevel: 'A' | 'B' | 'C' }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of solutions) {
    if (s.evidenceLevel === 'A') map[s.evidenceLevel] = 90;
    else if (s.evidenceLevel === 'B') map[s.evidenceLevel] = 60;
    else map[s.evidenceLevel] = 30;
  }
  return map;
}
