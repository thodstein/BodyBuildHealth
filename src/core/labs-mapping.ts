import synonyms from '../data/labs-synonyms.json';
import { UCUM_MAP } from './constants';

const SYNONYM_MAP = synonyms as Record<string, string>;

/** Resolve free-text marker name to canonical UCUM code when possible. */
export function resolveLabMarker(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();
  if (UCUM_MAP[upper]) return upper;

  const fromSynonym = SYNONYM_MAP[trimmed.toLowerCase()];
  if (fromSynonym) {
    const code = fromSynonym.toUpperCase();
    if (UCUM_MAP[code]) return code;
    return code;
  }

  return upper;
}

/** 0..1 position within reference range; null if unknown. */
export function normalizedRatio(code: string, value: number, unit: string): number | null {
  const ucum = UCUM_MAP[code];
  if (!ucum) return null;
  const norm = value * ucum.coeff;
  const span = ucum.uln - ucum.lln;
  if (span <= 0) return null;
  const lln = ucum.lln;
  const uln = ucum.uln;
  const midpoint = (lln + uln) / 2;
  if (norm <= midpoint) {
    // Below midpoint: linear 0..0.5
    return Math.max(0, 0.5 * (norm - lln) / Math.max(0.001, midpoint - lln));
  } else if (norm <= uln) {
    // Midpoint to ULN: linear 0.5..1.0
    return 0.5 + 0.5 * (norm - midpoint) / Math.max(0.001, uln - midpoint);
  } else {
    // Above ULN: logarithmic 1.0..~6.0
    const foldAboveUln = norm / uln;
    return 1.0 + Math.log2(Math.max(1, foldAboveUln)) * 1.5;
  }
}

export function interpretRatio(ratio: number | null): string {
  if (ratio == null) return 'Нет данных';
  if (ratio < 0.2) return 'Сильно ниже нормы';
  if (ratio < 0.4) return 'Ниже нормы';
  if (ratio < 0.6) return 'В пределах нормы';
  if (ratio < 0.8) return 'Выше нормы';
  return 'Сильно выше нормы';
}

export function interpretScale(score: number): string {
  if (score < 0.2) return 'Отлично';
  if (score < 0.4) return 'Хорошо';
  if (score < 0.6) return 'Норма';
  if (score < 0.8) return 'Проблемы';
  return 'Высокий риск';
}
