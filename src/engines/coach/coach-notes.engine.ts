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
 *  • вложения (фото/аудио) живут НЕ здесь: в заметке только метаданные
 *    (`attachments`), сами байты — в IndexedDB (`note-media-store.ts`).
 *    Иначе одно фото в base64 раздуло бы localStorage и убило все заметки;
 *  • парсер терпимый, чужая версия/битый JSON → пусто, без исключений.
 */

export const COACH_NOTES_KEY = 'he_coach_notes';
export const COACH_NOTES_MAX = 500;
export const COACH_NOTE_TITLE_MAX = 120;
export const COACH_NOTE_BODY_MAX = 8000;
export const COACH_NOTE_CHECKLIST_MAX = 100;
export const COACH_NOTE_CHECKLIST_TEXT_MAX = 300;
/** Сколько вложений можно прикрепить к одной заметке. */
export const COACH_NOTE_ATTACHMENTS_MAX = 6;
/** Потолок одного вложения: дальше файл просто не сохраняем (и говорим об этом). */
export const COACH_NOTE_ATTACHMENT_BYTES_MAX = 25 * 1024 * 1024;
export const COACH_NOTE_ATTACHMENT_NAME_MAX = 120;
export const COACH_NOTE_ATTACHMENT_ID_MAX = 80;
/** Аудио длиннее суток — это уже не голосовая заметка, а архив. */
export const COACH_NOTE_AUDIO_MS_MAX = 24 * 60 * 60 * 1000;

export interface CoachNoteChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type CoachNoteAttachmentKind = 'photo' | 'audio';

/**
 * Вложение заметки — только метаданные. `id` — ключ записи в IndexedDB;
 * без самого файла метаданные бесполезны, поэтому UI обязан показать
 * «файл не найден», а не пустую картинку.
 */
export interface CoachNoteAttachment {
  id: string;
  kind: CoachNoteAttachmentKind;
  mime: string;
  /** Размер в байтах (0 — неизвестен, например у старого импорта). */
  size: number;
  /** Длительность аудио в мс (у фото отсутствует). */
  durationMs?: number;
  /** Имя файла или короткая подпись. */
  name?: string;
  createdAt: string;
}

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
  /** Чек-лист (TickTick-подобный): пункты с отметками. Опционален для старых заметок. */
  checklist?: CoachNoteChecklistItem[];
  /** Фото/аудио заметки — только метаданные, байты в IndexedDB. */
  attachments?: CoachNoteAttachment[];
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

/** Терпимый парсер чек-листа: битые/пустые пункты пропускаются, лимит сохраняется. */
export function normalizeChecklist(raw: unknown): CoachNoteChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CoachNoteChecklistItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const item = row as Partial<CoachNoteChecklistItem> & Record<string, unknown>;
    const textValue = text(item.text, COACH_NOTE_CHECKLIST_TEXT_MAX);
    if (!textValue) continue;
    let id = text(item.id, 80) || `c_${i + 1}`;
    if (seen.has(id)) id = `c_${i + 1}_${out.length + 1}`;
    seen.add(id);
    out.push({ id, text: textValue, done: item.done === true });
    if (out.length >= COACH_NOTE_CHECKLIST_MAX) break;
  }
  return out;
}

/**
 * Терпимый парсер вложений: id обязателен, mime — только image/* или audio/*,
 * размер больше потолка выбрасывается (иначе метаданные ссылались бы на файл,
 * которого в хранилище нет). Лимит на заметку сохраняется.
 */
export function normalizeAttachments(raw: unknown): CoachNoteAttachment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CoachNoteAttachment[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const a = row as Partial<CoachNoteAttachment> & Record<string, unknown>;
    const mime = text(a.mime, 60).toLowerCase();
    const kind: CoachNoteAttachmentKind | null =
      a.kind === 'photo' || a.kind === 'audio'
        ? a.kind
        : mime.startsWith('image/')
          ? 'photo'
          : mime.startsWith('audio/')
            ? 'audio'
            : null;
    if (!kind || !/^(image|audio)\/[a-z0-9.+-]+$/i.test(mime)) continue;
    if (kind === 'photo' && !mime.startsWith('image/')) continue;
    if (kind === 'audio' && !mime.startsWith('audio/')) continue;
    const sizeRaw = Number(a.size);
    const size = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.round(sizeRaw) : 0;
    if (size > COACH_NOTE_ATTACHMENT_BYTES_MAX) continue;
    let id = text(a.id, COACH_NOTE_ATTACHMENT_ID_MAX) || `a_${i + 1}`;
    if (seen.has(id)) id = `a_${i + 1}_${out.length + 1}`;
    const durRaw = Number(a.durationMs);
    const durationMs =
      kind === 'audio' && Number.isFinite(durRaw) && durRaw > 0
        ? Math.min(Math.round(durRaw), COACH_NOTE_AUDIO_MS_MAX)
        : undefined;
    const name = text(a.name, COACH_NOTE_ATTACHMENT_NAME_MAX);
    seen.add(id);
    out.push({
      id,
      kind,
      mime,
      size,
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(name ? { name } : {}),
      createdAt: text(a.createdAt, 40) || nowIso(),
    });
    if (out.length >= COACH_NOTE_ATTACHMENTS_MAX) break;
  }
  return out;
}

/** Вложения заметки в нормализованном виде (для UI/виджета). */
export function noteAttachments(note: CoachNote): CoachNoteAttachment[] {
  return normalizeAttachments(note.attachments);
}

/** id вложений заметки — нужно хранилищу, чтобы вычистить осиротевшие файлы. */
export function noteAttachmentIds(note: CoachNote): string[] {
  return noteAttachments(note).map(a => a.id);
}

function normalizeNote(raw: unknown): CoachNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<CoachNote> & Record<string, unknown>;
  const id = text(n.id, 80);
  const title = text(n.title, COACH_NOTE_TITLE_MAX);
  const body = text(n.body, COACH_NOTE_BODY_MAX);
  const checklist = normalizeChecklist(n.checklist);
  const attachments = normalizeAttachments(n.attachments);
  if (!id || (!title && !body && checklist.length === 0 && attachments.length === 0)) return null;
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
    checklist,
    attachments,
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
    checklist?: CoachNoteChecklistItem[];
    attachments?: CoachNoteAttachment[];
  },
  opts: { id?: string; now?: string } = {},
): AddCoachNoteResult {
  const title = text(input.title, COACH_NOTE_TITLE_MAX);
  const body = text(input.body, COACH_NOTE_BODY_MAX);
  const checklist = normalizeChecklist(input.checklist);
  const attachments = normalizeAttachments(input.attachments);
  if (!title && !body && checklist.length === 0 && attachments.length === 0) {
    return { store, note: null, error: 'empty' };
  }
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
    checklist,
    attachments,
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
    checklist?: CoachNoteChecklistItem[];
    attachments?: CoachNoteAttachment[];
  },
  opts: { now?: string } = {},
): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const title = patch.title === undefined ? prev.title : text(patch.title, COACH_NOTE_TITLE_MAX);
  const body = patch.body === undefined ? prev.body : text(patch.body, COACH_NOTE_BODY_MAX);
  const checklist = patch.checklist === undefined ? normalizeChecklist(prev.checklist) : normalizeChecklist(patch.checklist);
  const attachments =
    patch.attachments === undefined ? normalizeAttachments(prev.attachments) : normalizeAttachments(patch.attachments);
  // пустая заметка — мусор, не сохраняем (но вложение без текста — валидная заметка)
  if (!title && !body && checklist.length === 0 && attachments.length === 0) return store;
  const items = [...store.items];
  items[idx] = {
    ...prev,
    title,
    body,
    athleteId: patch.athleteId === undefined ? prev.athleteId : (text(patch.athleteId, 80) || null),
    week: patch.week === undefined ? prev.week : weekDay(patch.week),
    pinned: patch.pinned === undefined ? prev.pinned : patch.pinned === true,
    checklist,
    attachments,
    updatedAt: opts.now ?? nowIso(),
  };
  return { version: 1, items };
}

/**
 * Прикрепить вложение к заметке. Возвращает тот же store, если лимит исчерпан
 * или вложение битое — UI обязан сказать «больше 6 не влезет», а не молчать.
 */
export function addNoteAttachment(
  store: CoachNotesStore,
  noteId: string,
  attachment: CoachNoteAttachment,
  opts: { now?: string } = {},
): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === noteId);
  if (idx < 0) return store;
  const note = store.items[idx];
  const current = normalizeAttachments(note.attachments);
  const next = normalizeAttachments([
    ...current,
    { ...attachment, createdAt: attachment.createdAt || (opts.now ?? nowIso()) },
  ]);
  if (next.length === current.length) return store; // лимит/битое вложение
  const items = [...store.items];
  items[idx] = { ...note, attachments: next, updatedAt: opts.now ?? nowIso() };
  return { version: 1, items };
}

/** Убрать вложение из заметки (сам файл из IndexedDB удаляет UI). */
export function removeNoteAttachment(
  store: CoachNotesStore,
  noteId: string,
  attachmentId: string,
  opts: { now?: string } = {},
): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === noteId);
  if (idx < 0) return store;
  const note = store.items[idx];
  const current = normalizeAttachments(note.attachments);
  const next = current.filter(a => a.id !== attachmentId);
  if (next.length === current.length) return store;
  const items = [...store.items];
  items[idx] = { ...note, attachments: next, updatedAt: opts.now ?? nowIso() };
  return { version: 1, items };
}

/** Отметить пункт чек-листа. Прогресс считает UI/виджет. */
export function toggleNoteChecklistItem(
  store: CoachNotesStore,
  noteId: string,
  itemId: string,
  opts: { now?: string } = {},
): CoachNotesStore {
  const idx = store.items.findIndex(n => n.id === noteId);
  if (idx < 0) return store;
  const note = store.items[idx];
  const checklist = normalizeChecklist(note.checklist);
  const itemIdx = checklist.findIndex(c => c.id === itemId);
  if (itemIdx < 0) return store;
  checklist[itemIdx] = { ...checklist[itemIdx], done: !checklist[itemIdx].done };
  const items = [...store.items];
  items[idx] = { ...note, checklist, updatedAt: opts.now ?? nowIso() };
  return { version: 1, items };
}

/** Сколько пунктов чек-листа выполнено: { done, total }. */
export function noteChecklistProgress(note: CoachNote): { done: number; total: number } {
  const checklist = normalizeChecklist(note.checklist);
  return { done: checklist.filter(c => c.done).length, total: checklist.length };
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
    const hay = (n: CoachNote): string => {
      const checkText = normalizeChecklist(n.checklist).map(c => c.text).join(' ');
      return `${n.title} ${n.body} ${checkText}`.toLowerCase();
    };
    items = items.filter(n => hay(n).includes(q));
  }
  return sortCoachNotes(items);
}

/** Сколько заметок привязано к атлету (для карточки атлета). */
export function countNotesForAthlete(store: CoachNotesStore, athleteId: string): number {
  return store.items.filter(n => n.athleteId === athleteId).length;
}
