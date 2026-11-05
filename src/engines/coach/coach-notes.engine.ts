/**
 * coach-notes.engine.ts — заметки тренера (профиль, общий слой).
 *
 * Зачем: у тренера знания живут не в голове — «колено правое, не грузить больше 100»,
 * «после курса пересдать ферритин», «клиент боится приседа». Дневники для этого не
 * годятся: они про замеры, а не про контекст. Поэтому отдельное хранилище заметок.
 *
 * Правила:
 *  • заметка может быть привязана к атлету (`athleteId`) или быть общей (null);
 *  • закреплённые заметки всегда сверху — это «памятка на виду»;
 *  • лимит 500 заметок и 8000 символов: localStorage не резиновый, а молча
 *    выкидывать старые заметки нельзя (это чужие данные) — при переполнении
 *    возвращаем ошибку `limit` и просим удалить лишнее;
 *  • парсер терпимый, чужая версия/битый JSON → пусто, без исключений.
 */

export const COACH_NOTES_KEY = 'he_coach_notes';
export const COACH_NOTES_MAX = 500;
export const COACH_NOTE_TITLE_MAX = 120;
export const COACH_NOTE_BODY_MAX = 8000;

export interface CoachNote {
  id: string;
  title: string;
  body: string;
  /** Атлет, к которому относится заметка (null — общая заметка тренера). */
  athleteId: string | null;
  /**
   * Неделя, к которой относится заметка (`YYYY-MM-DD`, понедельник), либо null.
   * Так «комментарий к неделе» находит своё место, не превращая заметки в чат.
   */
  week: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachNotesStore {
  version: 1;
  items: CoachNote[];
}

export const COACH_NOTES_HINT =
  'Заметки — это контекст, а не дневник: они не влияют на расчёты планов и не попадают в отчёты автоматически.';

export function emptyCoachNotes(): CoachNotesStore {
  return { version: 1, items: [] };
}

const nowIso = (): string => new Date().toISOString();
const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

/** Неделя — только календарный день `YYYY-MM-DD`; всё остальное → null. */
const weekDay = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

function normalizeNote(raw: unknown): CoachNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<CoachNote> & Record<string, unknown>;
  const id = text(n.id, 80);
  const title = text(n.title, COACH_NOTE_TITLE_MAX);
  const body = text(n.body, COACH_NOTE_BODY_MAX);
  if (!id || (!title && !body)) return null;
  const createdAt = text(n.createdAt, 40) || nowIso();
  return {
    id,
    title,
    body,
    athleteId: text(n.athleteId, 80) || null,
    week: weekDay(n.week),
    pinned: n.pinned === true,
    createdAt,
    updatedAt: text(n.updatedAt, 40) || createdAt,
  };
}

export function parseCoachNotes(raw: string | null | undefined): CoachNotesStore {
  if (!raw) return emptyCoachNotes();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachNotes();
    const obj = parsed as Partial<CoachNotesStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachNotes();
    const seen = new Set<string>();
    const items: CoachNote[] = [];
    for (const row of obj.items) {
      const note = normalizeNote(row);
      if (!note || seen.has(note.id)) continue;
      seen.add(note.id);
      items.push(note);
      if (items.length >= COACH_NOTES_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachNotes();
  }
}

export function serializeCoachNotes(store: CoachNotesStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachNotes(storage: { getItem: (k: string) => string | null } | null | undefined): CoachNotesStore {
  if (!storage) return emptyCoachNotes();
  try {
    return parseCoachNotes(storage.getItem(COACH_NOTES_KEY));
  } catch {
    return emptyCoachNotes();
  }
}

export function writeCoachNotes(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: CoachNotesStore,
): CoachNotesStore {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_NOTES_KEY, serializeCoachNotes(store));
    } catch {
      /* ignore quota */
    }
  }
  return store;
}

export type CoachNoteError = 'limit' | 'empty' | null;

export interface AddCoachNoteResult {
  store: CoachNotesStore;
  note: CoachNote | null;
  error: CoachNoteError;
}

export function addCoachNote(
  store: CoachNotesStore,
  input: {
    title?: string;
    body?: string;
    athleteId?: string | null;
    pinned?: boolean;
    /** Неделя `YYYY-MM-DD` (понедельник) — для «комментария к неделе». */
    week?: string | null;
  },
  opts: { id?: string; now?: string } = {},
): AddCoachNoteResult {
  const title = text(input.title, COACH_NOTE_TITLE_MAX);
  const body = text(input.body, COACH_NOTE_BODY_MAX);
  if (!title && !body) return { store, note: null, error: 'empty' };
  if (store.items.length >= COACH_NOTES_MAX) return { store, note: null, error: 'limit' };
  const now = opts.now ?? nowIso();
  const note: CoachNote = {
    id: opts.id ?? `n_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${store.items.length + 1}`,
    title,
    body,
    athleteId: text(input.athleteId, 80) || null,
    week: weekDay(input.week),
    pinned: input.pinned === true,
    createdAt: now,
    updatedAt: now,
  };
  return { store: { version: 1, items: [note, ...store.items] }, note, error: null };
}

export function updateCoachNote(
  store: CoachNotesStore,
  id: string,
  patch: {
    title?: string;
    body?: string;
    athleteId?: string | null;
    pinned?: boolean;
    week?: string | null;
  },
  opts: { now?: string } = {},
): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const title = patch.title === undefined ? prev.title : text(patch.title, COACH_NOTE_TITLE_MAX);
  const body = patch.body === undefined ? prev.body : text(patch.body, COACH_NOTE_BODY_MAX);
  if (!title && !body) return store; // пустая заметка — мусор, не сохраняем
  const items = [...store.items];
  items[idx] = {
    ...prev,
    title,
    body,
    athleteId: patch.athleteId === undefined ? prev.athleteId : (text(patch.athleteId, 80) || null),
    week: patch.week === undefined ? prev.week : weekDay(patch.week),
    pinned: patch.pinned === undefined ? prev.pinned : patch.pinned === true,
    updatedAt: opts.now ?? nowIso(),
  };
  return { version: 1, items };
}

export function removeCoachNote(store: CoachNotesStore, id: string): CoachNotesStore {
  const items = store.items.filter(n => n.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/** Комментарий тренера к неделе атлета (самый свежий), либо null. */
export function weekNoteFor(
  store: CoachNotesStore,
  athleteId: string,
  week: string,
): CoachNote | null {
  const day = weekDay(week);
  if (!day) return null;
  return (
    store.items.find(
      n => n.athleteId === athleteId && n.week === day && !n.pinned,
    ) ?? null
  );
}

export function toggleCoachNotePin(store: CoachNotesStore, id: string): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === id);
  if (idx < 0) return store;
  const items = [...store.items];
  items[idx] = { ...items[idx], pinned: !items[idx].pinned, updatedAt: nowIso() };
  return { version: 1, items };
}

/** Закреплённые сверху, внутри — свежие сначала. */
export function sortCoachNotes(items: CoachNote[]): CoachNote[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

/**
 * Поиск и фильтр. Пустой запрос = все; регистронезависимо по заголовку и тексту.
 * `athleteId: 'none'` — только общие заметки.
 */
export function filterCoachNotes(
  store: CoachNotesStore,
  opts: { query?: string; athleteId?: string | null } = {},
): CoachNote[] {
  const q = text(opts.query, 200).toLowerCase();
  let items = store.items;
  if (opts.athleteId === 'none') items = items.filter(n => !n.athleteId);
  else if (opts.athleteId) items = items.filter(n => n.athleteId === opts.athleteId);
  if (q) {
    items = items.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(q));
  }
  return sortCoachNotes(items);
}

/** Сколько заметок привязано к атлету (для карточки атлета). */
export function countNotesForAthlete(store: CoachNotesStore, athleteId: string): number {
  return store.items.filter(n => n.athleteId === athleteId).length;
}
