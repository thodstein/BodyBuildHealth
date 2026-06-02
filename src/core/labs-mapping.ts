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
  return Math.max(0, Math.min(1, (norm - ucum.lln) / span));
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
