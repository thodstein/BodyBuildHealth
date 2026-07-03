/**
 * support-plan/types.ts — общие константы и утилиты для единого движка поддержки.
 */

import { SUPPORT_CATALOG_DATA, DEFAULT_DOSAGES } from '../../data/support-database';
import type { RiskSystemId } from '../support-calculator.types';

// ─── Метаданные систем (RU) ───
export const SYSTEM_LABELS_RU: Record<string, { name: string; emoji: string }> = {
  cardio:         { name: 'Сердечно-сосудистая', emoji: '❤️' },
  hepatic:        { name: 'Печень',               emoji: '🫁' },
  renal:          { name: 'Почки',                emoji: '💧' },
  neuro:          { name: 'Нервная система',      emoji: '🧠' },
  endocrine:      { name: 'Эндокринная',          emoji: '⚖️' },
  hematologic:    { name: 'Кроветворная',         emoji: '🩸' },
  reproductive:   { name: 'Репродуктивная',       emoji: '💪' },
  musculoskeletal:{ name: 'ОДА / Мышцы',          emoji: '🦴' },
  cns:            { name: 'Нервная система',      emoji: '🧠' },
};

export const SYS_ORDER: RiskSystemId[] = [
  'cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal',
];

// ─── Утилиты ───
export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sysName(sys: string): string {
  return SYSTEM_LABELS_RU[sys]?.name
    || SYSTEM_LABELS_RU[sys === 'cns' ? 'neuro' : sys]?.name
    || sys;
}

export function sysEmoji(sys: string): string {
  return SYSTEM_LABELS_RU[sys]?.emoji
    || SYSTEM_LABELS_RU[sys === 'cns' ? 'neuro' : sys]?.emoji
    || '📌';
}

/** Канонизация id (учитываем алиасы регистра). */
export function catalogEntry(id: string): any {
  return SUPPORT_CATALOG_DATA[id]
    || SUPPORT_CATALOG_DATA[id.toUpperCase()]
    || SUPPORT_CATALOG_DATA[id.toLowerCase()]
    || null;
}

/** Дозировка по умолчанию для вещества. */
export function defaultDosage(id: string): { mg: number; timing: string } | undefined {
  return DEFAULT_DOSAGES[id];
}
