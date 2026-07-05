/**
 * symptom-catalog-bridge.ts — Мост: Симптом-солвер → Каталог поддержки
 *
 * Сопоставляет substanceId из SYMPTOM_DB с ключами SUPPORT_CATALOG_DATA.
 * Позволяет «применять» решение из симптом-анализа к реальному плану поддержки.
 */
import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';

/** Алиасы: symptom-solver substanceId → catalog key (если отличаются) */
export const SYMPTOM_TO_CATALOG_ALIAS: Record<string, string> = {
  // ── Supplement exact matches (already lowercase) ──
  nac: 'nac',
  tudca: 'TUDCA',
  udca: 'udca',
  omega3: 'omega3',
  magnesium: 'magnesium',
  zinc: 'zinc',
  selenium: 'selenium',
  potassium: 'potassium',
  boron: 'boron',
  vitamin_d3: 'vitamin_d3',
  vitamin_c: 'vitamin_c',
  vitamin_b6: 'vitamin_b6',
  vitamin_b12: 'vitamin_b12',
  vitamin_k2: 'vitamin_k2',
  vitamin_e: 'vitamin_e',
  alpha_lipoic: 'alpha_lipoic',
  milk_thistle: 'milk_thistle',
  ashwagandha: 'ashwagandha',
  glutathione: 'glutathione',
  betaine: 'betaine',
  gaba: 'gaba',
  l_dopa: 'l_dopa',
  tyrosine: 'tyrosine',
  x5htp: 'x5htp',
  coq10: 'coq10',
  probiotics: 'probiotics',
  aspirin: 'aspirin',
  nattokinase: 'nattokinase',
  curcumin: 'curcumin',
  berberine: 'berberine',
  l_theanine: 'l_theanine',
  glycine: 'glycine',
  taurine: 'taurine',
  inositol: 'inositol',
  melatonin: 'melatonin',
  artichoke: 'artichoke',
  celery_extract: 'celery_extract',
  red_yeast: 'red_yeast',
  bile_acids: 'bile_acids',
  hyaluronic_acid: 'hyaluronic_acid',
  chondroitin_sulfate: 'chondroitin_sulfate',

  // ── Pharma ──
  telmisartan: 'telmisartan',
  nebivolol: 'nebivolol',
  anastro: 'anastrozole',
  tamox: 'tamoxifen',
  cabergoline: 'cabergoline',
  metformin: 'metformin',
  finasteride: 'finasteride',
  anastrozole: 'anastrozole',

  // ── Lifestyle-only (no catalog entry) ──
  cardio_lifestyle: '__LIFESTYLE__',
  therapeutic_phlebotomy: '__LIFESTYLE__',
  hydration: '__LIFESTYLE__',
  hydration_forced: '__LIFESTYLE__',
  low_sodium: '__LIFESTYLE__',
  sleep_hygiene: '__LIFESTYLE__',
  bp_control: '__LIFESTYLE__',
  hospital: '__LIFESTYLE__',
  more_frequent_inj: '__LIFESTYLE__',
  long_ester: '__LIFESTYLE__',
  meal_spacing: '__LIFESTYLE__',
  reduce_ai: '__LIFESTYLE__',
  topical_retinoid: '__LIFESTYLE__',
  skin_hygiene: '__LIFESTYLE__',
  breath_work: '__LIFESTYLE__',
};

/** Получить catalog-ключ по substanceId из симптом-солвера */
export function resolveCatalogId(symptomSubstanceId: string): string | null {
  const alias = SYMPTOM_TO_CATALOG_ALIAS[symptomSubstanceId];
  if (!alias) return null;
  if (alias === '__LIFESTYLE__') return null; // lifestyle — нет в каталоге
  return alias;
}

/** Получить запись каталога по substanceId из симптом-солвера */
export function getCatalogEntryForSymptomSolution(substanceId: string): Record<string, any> | null {
  const catalogId = resolveCatalogId(substanceId);
  if (!catalogId) return null;
  const entry = SUPPORT_CATALOG_DATA[catalogId];
  if (entry) return entry;
  // fallback с разными регистрами
  return SUPPORT_CATALOG_DATA[catalogId.toUpperCase()]
    || SUPPORT_CATALOG_DATA[catalogId.toLowerCase()]
    || null;
}

/** Является ли решение lifestyle-рекомендацией (не лекарство/БАД) */
export function isLifestyleOnly(substanceId: string): boolean {
  const alias = SYMPTOM_TO_CATALOG_ALIAS[substanceId];
  return alias === '__LIFESTYLE__';
}

/** Получить человекочитаемое название решения */
export function getSymptomSolutionDisplayName(substanceId: string, fallback: string): string {
  if (isLifestyleOnly(substanceId)) return fallback;
  const entry = getCatalogEntryForSymptomSolution(substanceId);
  return entry?.nameRu || entry?.name || fallback;
}
