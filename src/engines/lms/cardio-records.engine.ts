/**
 * cardio-records.engine.ts — персональные рекорды и прогноз темпа (P2-2).
 * Аналог попыток 90/96/102 в силовых: рекорды 5к/10к/half/2к-гребля/FTP/CP
 * + прогноз Riegel (t2 = t1×(d2/d1)^1.06) + калибровка Billat 30-30
 * по 6-мин тесту. localStorage, кап 30, битый стор → [].
 */
const KEY = 'he_cardio_records';
const CAP = 30;

export type CardioRecordKind = 'run5k' | 'run10k' | 'runHalf' | 'row2k' | 'ftp' | 'cp20';

export interface CardioRecord {
  id: string;
  kind: CardioRecordKind;
  /** Значение: секунды для дистанций, ватты для FTP/CP. */
  value: number;
  date: string; // YYYY-MM-DD
  note?: string;
}

export const CARDIO_RECORD_LABELS: Record<CardioRecordKind, string> = {
  run5k: 'Бег 5 км',
  run10k: 'Бег 10 км',
  runHalf: 'Полумарафон',
  row2k: 'Гребля 2000 м',
  ftp: 'FTP вело (Вт)',
  cp20: 'CP 20 мин (Вт)',
};

function isRecordShape(v: unknown): v is CardioRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.kind === 'string' && typeof r.value === 'number' && typeof r.date === 'string';
}

export function loadCardioRecords(): CardioRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!Array.isArray(v)) return [];
    return v.filter(isRecordShape).slice(0, CAP);
  } catch { return []; }
}

export function saveCardioRecord(r: CardioRecord): CardioRecord[] {
  const list = [r, ...loadCardioRecords().filter(x => x.id !== r.id)].slice(0, CAP);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

export function removeCardioRecord(id: string): CardioRecord[] {
  const list = loadCardioRecords().filter(x => x.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

/** Лучший рекорд вида (null — нет данных, честно). */
export function bestCardioRecord(kind: CardioRecordKind): CardioRecord | null {
  const list = loadCardioRecords().filter(r => r.kind === kind);
  if (list.length === 0) return null;
  if (kind === 'ftp' || kind === 'cp20') return list.reduce((a, b) => (b.value > a.value ? b : a));
  return list.reduce((a, b) => (b.value < a.value ? b : a));
}

/**
 * Прогноз времени Riegel: t2 = t1 × (d2/d1)^1.06.
 * Возвращает секунды (null при некорректном входе).
 */
export function predictRunningTime(t1Sec: number, d1M: number, d2M: number): number | null {
  if (!(t1Sec > 0) || !(d1M > 0) || !(d2M > 0)) return null;
  return Math.round(t1Sec * Math.pow(d2M / d1M, 1.06));
}

/**
 * Калибровка Billat 30-30: метры жёсткого 30-с отрезка = дистанция
 * 6-мин теста / 12 (null при некорректном входе).
 */
export function billatPaceFrom6Min(distanceM: number): number | null {
  if (!(distanceM > 500) || !(distanceM < 5000)) return null;
  return Math.round(distanceM / 12);
}

export function formatCardioTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
