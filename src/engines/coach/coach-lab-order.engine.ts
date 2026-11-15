/**
 * coach-lab-order.engine.ts — «назначить анализы» подопечному.
 *
 * ЗАЧЕМ. До этого тренер мог только написать в планере задачу «сдать анализы»
 * свободным текстом: ни списка маркеров, ни срока, ни связи с результатом.
 * Здесь назначение становится объектом:
 *
 *   • список маркеров (код + имя), срок и комментарий;
 *   • статус «сдано» ставит тренер ИЛИ импорт результата из дневника анализов
 *     (`autoCloseLabOrdersFromImport`) — тогда назначение закрывается само;
 *   • хранится в устройственном ключе `he_coach_lab_orders` (как заметки и
 *     планер): это инструмент тренера, в пространство атлета он не пишется.
 *
 * ГРАНИЦА. Здесь НЕТ медицинских нормативов и «обязательных панелей»: тренер
 * выбирает маркеры из каталога приложения сам. Приложение не назначает лечение.
 */
export const COACH_LAB_ORDERS_KEY = 'he_coach_lab_orders';
export const COACH_LAB_ORDERS_MAX = 300;
export const LAB_ORDER_MARKERS_MAX = 40;
export const LAB_ORDER_COMMENT_MAX = 300;

export interface CoachLabOrderMarker {
  /** Код маркера из каталога (`ALT`, `FERRITIN`, …) — по нему же ищется результат. */
  code: string;
  /** Имя на русском на момент назначения (каталог может поменяться). */
  name: string;
}

export interface CoachLabOrder {
  id: string;
  athleteId: string;
  markers: CoachLabOrderMarker[];
  /** Планируемая дата сдачи `YYYY-MM-DD`; `''` — «без даты». */
  dueDate: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  /** Когда закрыто (ISO) или null. */
  doneAt: string | null;
}

export interface CoachLabOrdersStore {
  version: 1;
  items: CoachLabOrder[];
}

export type CoachLabOrderError = 'athlete' | 'markers' | 'limit' | null;

export interface CoachLabOrderResult {
  store: CoachLabOrdersStore;
  order: CoachLabOrder | null;
  error: CoachLabOrderError;
}

export function emptyCoachLabOrders(): CoachLabOrdersStore {
  return { version: 1, items: [] };
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

function nextId(items: CoachLabOrder[], now: string): string {
  const base = `l_${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
  let id = base;
  let i = 1;
  while (items.some(t => t.id === id)) id = `${base}_${++i}`;
  return id;
}

function cleanMarkers(raw: unknown): CoachLabOrderMarker[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachLabOrderMarker[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const code = clean(r.code, 40).toUpperCase();
    const name = clean(r.name, 80);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: name || code });
    if (out.length >= LAB_ORDER_MARKERS_MAX) break;
  }
  return out;
}

export function parseCoachLabOrders(raw: string | null | undefined): CoachLabOrdersStore {
  if (!raw) return emptyCoachLabOrders();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachLabOrders();
    const obj = parsed as Partial<CoachLabOrdersStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachLabOrders();
    const seen = new Set<string>();
    const items: CoachLabOrder[] = [];
    // В хранилище может лежать что угодно: типизируем строки как `unknown`,
    // а не доверяем форме `CoachLabOrdersStore` из JSON.
    for (const row of obj.items as unknown[]) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = clean(r.id, 80);
      const athleteId = clean(r.athleteId, 80);
      const markers = cleanMarkers(r.markers);
      if (!id || !athleteId || !markers.length || seen.has(id)) continue;
      seen.add(id);
      const dueDate = typeof r.dueDate === 'string' && isIsoDate(r.dueDate) ? r.dueDate : '';
      items.push({
        id,
        athleteId,
        markers,
        dueDate,
        comment: clean(r.comment, LAB_ORDER_COMMENT_MAX),
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
        doneAt: typeof r.doneAt === 'string' && r.doneAt ? r.doneAt : null,
      });
      if (items.length >= COACH_LAB_ORDERS_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachLabOrders();
  }
}

export function serializeCoachLabOrders(store: CoachLabOrdersStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachLabOrders(
  storage: { getItem: (k: string) => string | null } | null | undefined,
): CoachLabOrdersStore {
  if (!storage) return emptyCoachLabOrders();
  try {
    return parseCoachLabOrders(storage.getItem(COACH_LAB_ORDERS_KEY));
  } catch {
    return emptyCoachLabOrders();
  }
}

export function writeCoachLabOrders(
  storage: { setItem: (k: string, v: string) => void } | null | undefined,
  store: CoachLabOrdersStore,
): void {
  if (!storage) return;
  try {
    storage.setItem(COACH_LAB_ORDERS_KEY, serializeCoachLabOrders(store));
  } catch {
    /* квота: вызывающий увидит неизменённый store по факту перечитывания */
  }
}

/** Назначить анализы. Открытые назначения не схлопываем: два раза — два срока. */
export function addCoachLabOrder(
  store: CoachLabOrdersStore,
  input: { athleteId: string; markers: unknown; dueDate?: string; comment?: string },
  opts: { id?: string; now?: string } = {},
): CoachLabOrderResult {
  const athleteId = clean(input.athleteId, 80);
  if (!athleteId) return { store, order: null, error: 'athlete' };
  const markers = cleanMarkers(input.markers);
  if (!markers.length) return { store, order: null, error: 'markers' };
  if (store.items.length >= COACH_LAB_ORDERS_MAX) return { store, order: null, error: 'limit' };
  const now = opts.now ?? new Date().toISOString();
  const dueDate = typeof input.dueDate === 'string' && isIsoDate(input.dueDate) ? input.dueDate : '';
  const order: CoachLabOrder = {
    id: opts.id ?? nextId(store.items, now),
    athleteId,
    markers,
    dueDate,
    comment: clean(input.comment, LAB_ORDER_COMMENT_MAX),
    createdAt: now,
    updatedAt: now,
    doneAt: null,
  };
  return { store: { version: 1, items: [...store.items, order] }, order, error: null };
}

export function updateCoachLabOrder(
  store: CoachLabOrdersStore,
  id: string,
  patch: { markers?: unknown; dueDate?: string; comment?: string },
  opts: { now?: string } = {},
): CoachLabOrderResult {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return { store, order: null, error: 'markers' };
  const prev = store.items[idx];
  const markers = patch.markers === undefined ? prev.markers : cleanMarkers(patch.markers);
  if (!markers.length) return { store, order: null, error: 'markers' };
  const dueDate = patch.dueDate === undefined
    ? prev.dueDate
    : (isIsoDate(patch.dueDate) ? patch.dueDate : '');
  const items = [...store.items];
  const order: CoachLabOrder = {
    ...prev,
    markers,
    dueDate,
    comment: patch.comment === undefined ? prev.comment : clean(patch.comment, LAB_ORDER_COMMENT_MAX),
    updatedAt: opts.now ?? new Date().toISOString(),
  };
  items[idx] = order;
  return { store: { version: 1, items }, order, error: null };
}

/** Отметить «сдано» / снять отметку. */
export function toggleCoachLabOrderDone(
  store: CoachLabOrdersStore,
  id: string,
  opts: { now?: string } = {},
): CoachLabOrdersStore {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return store;
  const now = opts.now ?? new Date().toISOString();
  const items = [...store.items];
  items[idx] = { ...items[idx], doneAt: items[idx].doneAt ? null : now, updatedAt: now };
  return { version: 1, items };
}

export function removeCoachLabOrder(store: CoachLabOrdersStore, id: string): CoachLabOrdersStore {
  const items = store.items.filter(t => t.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/** Открытые — первыми и по сроку; без даты — после них. */
export function listCoachLabOrders(store: CoachLabOrdersStore, athleteId: string): CoachLabOrder[] {
  return store.items
    .filter(o => o.athleteId === athleteId)
    .sort((a, b) => {
      if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1;
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function countOpenLabOrders(store: CoachLabOrdersStore, athleteId: string): number {
  return store.items.filter(o => o.athleteId === athleteId && !o.doneAt).length;
}

/** Коды маркеров, которые ещё ждут результата (для подсветки в дневнике анализов). */
export function pendingLabMarkerCodes(store: CoachLabOrdersStore, athleteId: string): string[] {
  const out = new Set<string>();
  for (const o of store.items) {
    if (o.athleteId !== athleteId || o.doneAt) continue;
    for (const m of o.markers) out.add(m.code);
  }
  return [...out];
}

export type CoachLabOrderState = 'done' | 'overdue' | 'open';

/** Состояние назначения на дату: срок прошёл — «просрочено», иначе «ждём». */
export function labOrderState(order: CoachLabOrder, today: string): CoachLabOrderState {
  if (order.doneAt) return 'done';
  if (order.dueDate && order.dueDate < today) return 'overdue';
  return 'open';
}

/**
 * Импорт результата закрывает назначение.
 *
 * Правило простое и проверяемое: назначение закрывается, если ВСЕ его маркеры
 * уже есть в импортированном результате. Частичный результат оставляет
 * назначение открытым — иначе тренер не увидит, чего ещё ждёт. Регистр кода
 * не важен: лаборатории пишут по-разному.
 */
export function autoCloseLabOrdersFromImport(
  store: CoachLabOrdersStore,
  athleteId: string,
  importedCodes: Iterable<string>,
  opts: { now?: string } = {},
): CoachLabOrdersStore {
  const codes = new Set<string>();
  for (const c of importedCodes) {
    const code = clean(String(c ?? ''), 40).toUpperCase();
    if (code) codes.add(code);
  }
  if (!codes.size) return store;
  const now = opts.now ?? new Date().toISOString();
  let changed = false;
  const items = store.items.map(o => {
    if (o.athleteId !== athleteId || o.doneAt) return o;
    const all = o.markers.every(m => codes.has(m.code.toUpperCase()));
    if (!all) return o;
    changed = true;
    return { ...o, doneAt: now, updatedAt: now };
  });
  return changed ? { version: 1, items } : store;
}

export function coachLabOrderErrorText(error: CoachLabOrderError): string {
  switch (error) {
    case 'athlete':
      return 'Выберите атлета.';
    case 'markers':
      return 'Выберите хотя бы один маркер.';
    case 'limit':
      return `Уже ${COACH_LAB_ORDERS_MAX} назначений — удалите старые.`;
    default:
      return '';
  }
}
