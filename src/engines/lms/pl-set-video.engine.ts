/**
 * pl-set-video.engine.ts — видео к подходу (Фаза 6, п.10).
 *
 * ЧТО ЗДЕСЬ ЕСТЬ: учёт ссылок «этот подход → этот видеофайл». Ссылка живёт в
 * localStorage, а сам файл — в памяти приложения (APK: Capacitor Camera +
 * постоянное хранилище). Поэтому здесь НЕТ base64-видео: localStorage под видео
 * не рассчитан, и попытка хранить ролик там кончилась бы переполнением квоты,
 * потерей всей сессии и «планом, который перестал открываться».
 *
 * ЧЕСТНОСТЬ:
 *  • один слот на (дата, упражнение, подход) — перезапись заменяет ссылку, а не
 *    плодит копии; старый URI возвращается вызывающему, чтобы файл удалили;
 *  • битый/чужой JSON не роняет плеер: парсер терпимый и не угадывает версию;
 *  • ссылки старше PL_VIDEO_KEEP_DAYS и сверх PL_VIDEO_MAX_ITEMS вычищаются —
 *    иначе список рос бы вечно, а файлы занимали бы гигабайты;
 *  • в браузере (не APK) запись видео недоступна: UI обязан сказать это прямо,
 *    а не делать вид, что «видео сохранилось».
 */
import { localIsoDate, shiftIsoDate } from '../../core/local-date';

export const PL_SET_VIDEO_KEY = 'he_pl_set_video';

/** Сколько последних записей храним (ссылки, не файлы). */
export const PL_VIDEO_MAX_ITEMS = 200;
/** Сколько дней храним ссылки; файлы старше — мусор в памяти приложения. */
export const PL_VIDEO_KEEP_DAYS = 60;
/** Предельная длина URI и названия упражнения — защита парсера от мусора. */
const MAX_URI_CHARS = 2048;
const MAX_NAME_CHARS = 120;

export type PLSetVideoSource = 'recorded' | 'gallery';

export interface PLSetVideoRef {
  /** Ключ слота: `дата|упражнение|подход`. */
  key: string;
  /** URI файла в памяти приложения (file://…/content://…). */
  uri: string;
  /** Дата тренировки (календарная, локальная). */
  date: string;
  exercise: string;
  setNumber: number;
  /** Откуда видео: снято в приложении или выбрано из галереи. */
  source: PLSetVideoSource;
  /** Момент записи ссылки (UTC-метка события — это не календарная дата). */
  createdAt: string;
}

export interface PLSetVideoStore {
  version: 1;
  items: PLSetVideoRef[];
}

export const PL_VIDEO_NOTES: string[] = [
  'Видео — файл в памяти приложения; в приложении-вебе файл живёт только до перезагрузки страницы.',
  'Ссылки чистятся автоматически: старше 60 дней и сверх 200 записей — чтобы не занимать память телефона.',
  'Запись видео с экрана плеера — для разбора техники тренером. Это не замер и не доказательство выполнения подхода.',
];

export function emptySetVideoStore(): PLSetVideoStore {
  return { version: 1, items: [] };
}

const normName = (v: unknown): string => String(v ?? '').trim().slice(0, MAX_NAME_CHARS);
const normDate = (v: unknown): string => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/** Ключ слота: одно видео на подход. */
export function setVideoKey(date: string, exercise: string, setNumber: number): string {
  return `${normDate(date)}|${normName(exercise)}|${Math.max(1, Math.trunc(setNumber) || 1)}`;
}

/** Терпимый парсер: чужая форма/битый JSON → пустое хранилище, без исключений. */
export function parseSetVideoStore(raw: string | null | undefined): PLSetVideoStore {
  if (!raw) return emptySetVideoStore();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptySetVideoStore();
    const obj = parsed as { version?: unknown; items?: unknown };
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptySetVideoStore();
    const items: PLSetVideoRef[] = [];
    for (const it of obj.items) {
      if (!it || typeof it !== 'object') continue;
      const r = it as Partial<PLSetVideoRef>;
      const uri = typeof r.uri === 'string' ? r.uri.trim() : '';
      const date = normDate(r.date);
      const exercise = normName(r.exercise);
      const setNumber = Math.trunc(Number(r.setNumber) || 0);
      if (!uri || uri.length > MAX_URI_CHARS || !date || !exercise || setNumber < 1) continue;
      const source: PLSetVideoSource = r.source === 'gallery' ? 'gallery' : 'recorded';
      items.push({
        key: setVideoKey(date, exercise, setNumber),
        uri,
        date,
        exercise,
        setNumber,
        source,
        createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : '',
      });
    }
    return { version: 1, items };
  } catch {
    return emptySetVideoStore();
  }
}

export function serializeSetVideoStore(store: PLSetVideoStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

/** Ссылка на видео для конкретного подхода (или null). */
export function findSetVideo(store: PLSetVideoStore, date: string, exercise: string, setNumber: number): PLSetVideoRef | null {
  const key = setVideoKey(date, exercise, setNumber);
  return store.items.find(i => i.key === key) ?? null;
}

export interface UpsertSetVideoResult {
  store: PLSetVideoStore;
  /** Предыдущий URI того же слота — файл можно удалить (не копим мусор). */
  replacedUri: string | null;
}

/**
 * Записать (или заменить) ссылку на видео подхода.
 * Один слот на подход: повторная запись заменяет, а не добавляет.
 */
export function upsertSetVideo(
  store: PLSetVideoStore,
  input: {
    date: string;
    exercise: string;
    setNumber: number;
    uri: string;
    source?: PLSetVideoSource;
    createdAt?: string;
  },
): UpsertSetVideoResult {
  const uri = String(input.uri ?? '').trim();
  const date = normDate(input.date);
  const exercise = normName(input.exercise);
  const setNumber = Math.max(1, Math.trunc(input.setNumber) || 1);
  if (!uri || uri.length > MAX_URI_CHARS || !date || !exercise) {
    return { store, replacedUri: null };
  }
  const key = setVideoKey(date, exercise, setNumber);
  const prev = store.items.find(i => i.key === key) ?? null;
  const nextItem: PLSetVideoRef = {
    key,
    uri,
    date,
    exercise,
    setNumber,
    source: input.source === 'gallery' ? 'gallery' : 'recorded',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const items = [nextItem, ...store.items.filter(i => i.key !== key)];
  return { store: { version: 1, items }, replacedUri: prev && prev.uri !== uri ? prev.uri : null };
}

/** Убрать ссылку; возвращает удалённый URI (файл можно стереть) или null. */
export function removeSetVideo(store: PLSetVideoStore, date: string, exercise: string, setNumber: number): { store: PLSetVideoStore; removedUri: string | null } {
  const key = setVideoKey(date, exercise, setNumber);
  const found = store.items.find(i => i.key === key) ?? null;
  if (!found) return { store, removedUri: null };
  return { store: { version: 1, items: store.items.filter(i => i.key !== key) }, removedUri: found.uri };
}

/** Ссылки за конкретную тренировку (в порядке подходов). */
export function listSetVideosForDate(store: PLSetVideoStore, date: string): PLSetVideoRef[] {
  const d = normDate(date);
  return store.items
    .filter(i => i.date === d)
    .sort((a, b) => a.exercise.localeCompare(b.exercise) || a.setNumber - b.setNumber);
}

export interface PruneResult {
  store: PLSetVideoStore;
  /** URI файлов, которые больше не нужны (их стоит удалить из памяти приложения). */
  droppedUris: string[];
}

/**
 * Обрезка списка: только последние PL_VIDEO_KEEP_DAYS дней и не больше
 * PL_VIDEO_MAX_ITEMS записей. Возвращает URI выброшенных — чтобы вызывающий
 * удалил сами файлы, а не только строки.
 */
export function pruneSetVideos(
  store: PLSetVideoStore,
  opts: { today?: string; keepDays?: number; maxItems?: number } = {},
): PruneResult {
  const today = normDate(opts.today) || localIsoDate();
  const keepDays = Math.max(1, Math.trunc(opts.keepDays ?? PL_VIDEO_KEEP_DAYS));
  const maxItems = Math.max(1, Math.trunc(opts.maxItems ?? PL_VIDEO_MAX_ITEMS));
  const cutoff = shiftIsoDate(today, -keepDays);

  const kept: PLSetVideoRef[] = [];
  const droppedUris: string[] = [];
  // Новые сверху (upsert ставит новые в начало) — оставляем первые maxItems по дате.
  const sorted = [...store.items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const item of sorted) {
    const tooOld = (item.date || '') < cutoff;
    if (tooOld || kept.length >= maxItems) { droppedUris.push(item.uri); continue; }
    kept.push(item);
  }
  return { store: { version: 1, items: kept }, droppedUris };
}

/** Прочитать хранилище из localStorage-подобного объекта. */
export function readSetVideoStore(storage: { getItem: (k: string) => string | null } | null | undefined): PLSetVideoStore {
  if (!storage) return emptySetVideoStore();
  let raw: string | null = null;
  try { raw = storage.getItem(PL_SET_VIDEO_KEY); } catch { return emptySetVideoStore(); }
  return parseSetVideoStore(raw);
}

/** Сохранить хранилище (с обрезкой). Возвращает выброшенные URI. */
export function writeSetVideoStore(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: PLSetVideoStore,
  opts: { today?: string } = {},
): { store: PLSetVideoStore; droppedUris: string[] } {
  const pruned = pruneSetVideos(store, opts);
  if (storage && typeof storage.setItem === 'function') {
    try { storage.setItem(PL_SET_VIDEO_KEY, serializeSetVideoStore(pruned.store)); } catch { /* квота — не роняем плеер */ }
  }
  return pruned;
}
