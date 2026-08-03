/** support-plan-bridge.ts — канонический канал «внешние добавки → план поддержки».
 *  Единый store для источников: тренировочные миксы (mix), питание (nutrition).
 *  и мержит id веществ в enhancedSubs. Использует localStorage + CustomEvent (как planner-bridge). */

export const SUPPORT_EXTERNAL_KEY = 'he_support_external_subs';
export const SUPPORT_EXTERNAL_EVENT = 'he-support-external-subs';

export type ExternalSubSource = 'mix' | 'nutrition';

export interface ExternalSubEntry {
  ids: string[];
  source: ExternalSubSource;
  label?: string;
  ts: number;
}

/** Вещества, которыми управляет макро-нутрициология (белок/креатин/аминокислоты/углеводы),
 *  а не калькулятор поддержки. Исключаются из передачи в план поддержки. */
const EXCLUDE_IDS = new Set<string>([
  'protein', 'whey', 'whey_protein', 'isolate', 'casein', 'gainer',
  'creatine', 'creatine_mono', 'glutamine', 'l_glutamine',
  'bcaa', 'eaa', 'carbs', 'maltodextrin', 'dextrose', 'cyclic_dextrin',
  'intra_carbs', 'protein_shake',
]);

function normId(id: string): string {
  return String(id || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Фильтрует id: убирает пустые, дубли и макро-вещества питания. */
export function filterExternalSubIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = normId(raw);
    if (!id || EXCLUDE_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(raw);
  }
  return out;
}

function readQueue(): ExternalSubEntry[] {
  try {
    const raw = localStorage.getItem(SUPPORT_EXTERNAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: ExternalSubEntry[]): void {
  try {
    localStorage.setItem(SUPPORT_EXTERNAL_KEY, JSON.stringify(entries));
  } catch { /* ignore quota */ }
}

/** Добавить вещества в очередь передачи в план поддержки. */
export function pushSubsToPlan(ids: string[], source: ExternalSubSource, label?: string): number {
  const clean = filterExternalSubIds(ids);
  if (clean.length === 0) return 0;
  const entries = readQueue();
  entries.push({ ids: clean, source, label, ts: Date.now() });
  writeQueue(entries);
  try {
    window.dispatchEvent(new CustomEvent(SUPPORT_EXTERNAL_EVENT, { detail: { source, count: clean.length } }));
  } catch { /* ignore */ }
  return clean.length;
}

/** Прочитать очередь без очистки. */
export function readExternalSubsQueue(): ExternalSubEntry[] {
  return readQueue();
}

/** Прочитать и очистить очередь (для однократного мержа в enhancedSubs). */
export function drainExternalSubsQueue(): ExternalSubEntry[] {
  const entries = readQueue();
  if (entries.length > 0) {
    try { localStorage.removeItem(SUPPORT_EXTERNAL_KEY); } catch { /* ignore */ }
  }
  return entries;
}

/** Плоский уникальный список всех id из очереди. */
export function getMergedExternalSubIds(): string[] {
  const entries = readQueue();
  return filterExternalSubIds(entries.flatMap(e => e.ids));
}

/** Подписка на добавление внешних веществ. Возвращает функцию отписки. */
export function subscribeExternalSubs(cb: (detail: { source: ExternalSubSource; count: number }) => void): () => void {
  const handler = (e: Event) => {
    const ce = e as CustomEvent;
    cb(ce.detail || { source: 'mix', count: 0 });
  };
  window.addEventListener(SUPPORT_EXTERNAL_EVENT, handler);
  return () => window.removeEventListener(SUPPORT_EXTERNAL_EVENT, handler);
}
