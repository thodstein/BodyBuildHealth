/**
 * bb-diag-history.engine.ts — BB-D-39: append-only история ББ-диагностики.
 *
 * Зачем: хаб показывает балл и floor-ы, но не даёт увидеть, стало лучше или хуже.
 * Раньше история хранилась только для скрининга/замеров/L-R, а балл нигде не
 * копился — сравнить «до/после блока» было нечем.
 *
 * Формат: [{ date, score, floors, level, weakZones }] — 60 записей, дедуп по дате
 * (последний замер за день перезаписывает предыдущий: несколько ре-рендеров и
 * повторные заходы в хаб не должны раздувать историю).
 *
 * Чистый модуль: чтение/запись localStorage, никаких сайд-эффектов в UI.
 */

export interface DiagHistoryEntry {
  /** Локальная дата ISO yyyy-mm-dd (одна запись на день). */
  date: string;
  score: number;
  level: string;
  floors: string[];
  weakZones: string[];
}

export const DIAG_HISTORY_KEY = 'he_bb_diag_history';
export const DIAG_HISTORY_MAX = 60;

const isEntry = (v: unknown): v is DiagHistoryEntry => {
  const e = v as DiagHistoryEntry;
  return !!e && typeof e === 'object'
    && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
    && Number.isFinite(Number(e.score));
};

/** Прочитать историю (старые/битые записи отбрасываются, порядок — по дате). */
export function readDiagHistory(): DiagHistoryEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DIAG_HISTORY_KEY) : null;
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return j
      .filter(isEntry)
      .map((e) => ({
        date: e.date,
        score: Math.round(Number(e.score)),
        level: String(e.level || ''),
        floors: Array.isArray(e.floors) ? e.floors.map(String) : [],
        weakZones: Array.isArray(e.weakZones) ? e.weakZones.map(String) : [],
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-DIAG_HISTORY_MAX);
  } catch { return []; }
}

/**
 * Добавить замер. Дедуп по дате: запись за сегодня заменяется (score мог
 * измениться после ввода данных), а не дублируется.
 */
export function appendDiagHistory(
  entry: DiagHistoryEntry | null | undefined,
  max: number = DIAG_HISTORY_MAX,
): DiagHistoryEntry[] {
  const list = readDiagHistory();
  if (!entry || !isEntry(entry)) return list;
  const clean: DiagHistoryEntry = {
    date: entry.date,
    score: Math.round(Number(entry.score)),
    level: String(entry.level || ''),
    floors: (entry.floors || []).map(String),
    weakZones: (entry.weakZones || []).map(String),
  };
  const next = [...list.filter((e) => e.date !== clean.date), clean]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-Math.max(1, max));
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DIAG_HISTORY_KEY, JSON.stringify(next));
  } catch { /* нет места — история не критична, отчёт важнее */ }
  return next;
}

export interface DiagHistoryTrend {
  /** Сколько замеров (дней) в истории. */
  count: number;
  /** Предыдущий балл (день назад по истории) или null. */
  prev: DiagHistoryEntry | null;
  /** Изменение балла к предыдущему замеру (только при наличии обоих). */
  delta: number | null;
  /** Готовая честная строка для UI/экспорта. */
  text: string;
  /** floor-ы, которых не было в прошлом замере (появились = стало хуже по критериям). */
  newFloors: string[];
  /** floor-ы, которые исчезли (закрыли). */
  closedFloors: string[];
}

/**
 * Тренд к предыдущему замеру. Без второго замера — честное «истории мало»,
 * а не «+0» (иначе пользователь думает, что прогресса нет).
 */
export function diagHistoryTrend(list: DiagHistoryEntry[]): DiagHistoryTrend {
  const arr = Array.isArray(list) ? [...list].sort((a, b) => a.date.localeCompare(b.date)) : [];
  if (arr.length === 0) return { count: 0, prev: null, delta: null, text: 'История: пусто — замеров ещё не было', newFloors: [], closedFloors: [] };
  const last = arr[arr.length - 1];
  if (arr.length === 1) {
    return { count: 1, prev: null, delta: null, text: `История: первый замер ${last.date} — ${last.score}/100`, newFloors: [], closedFloors: [] };
  }
  const prev = arr[arr.length - 2];
  const delta = last.score - prev.score;
  const newFloors = last.floors.filter((f) => !prev.floors.includes(f));
  const closedFloors = prev.floors.filter((f) => !last.floors.includes(f));
  const dStr = delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${delta}`;
  const parts = [`История: ${last.score}/100 (${dStr} к ${prev.date})`];
  if (closedFloors.length) parts.push(`закрыто: ${closedFloors.join(', ')}`);
  if (newFloors.length) parts.push(`новые ограничения: ${newFloors.join(', ')}`);
  return { count: arr.length, prev, delta, text: parts.join(' · '), newFloors, closedFloors };
}
