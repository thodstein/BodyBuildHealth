/**
 * cardio-bridge.ts — канал «Кардио ↔ ПЛ/ББ/ручной конструктор».
 * Кардио-конструктор подключает CardioCycle к силовому плану ссылкой,
 * а не копией недель. localStorage + CustomEvent, без дублей состояния.
 */
const KEY = 'he_cardio_link';
type Listener = (link: CardioLink | null) => void;

export type CardioLinkSport = 'pl' | 'bb' | 'manual';

export interface CardioLink {
  cycleId: string;
  sport: CardioLinkSport;
  linkedAt: string;
}

export function getCardioLink(): CardioLink | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' && typeof v.cycleId === 'string' ? v as CardioLink : null;
  } catch { return null; }
}

export function setCardioLink(link: CardioLink): void {
  try { localStorage.setItem(KEY, JSON.stringify(link)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('cardio-link', { detail: link }));
}

export function clearCardioLink(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('cardio-link', { detail: null }));
}

export function subscribeCardioLink(cb: Listener): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? getCardioLink());
  window.addEventListener('cardio-link', handler);
  return () => window.removeEventListener('cardio-link', handler);
}

export const SPORT_LABELS: Record<CardioLinkSport, string> = {
  pl: 'ПЛ-авто',
  bb: 'ББ-авто',
  manual: 'Ручной конструктор',
};
