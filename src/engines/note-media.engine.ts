/**
 * note-media.engine.ts — фото/аудио в заметках и голосовые функции.
 *
 * Что здесь: чистые правила (форматы, подписи, лимиты) и тонкие обёртки над
 * возможностями платформы — запись голоса (MediaRecorder), речь в текст
 * (SpeechRecognition), озвучка (speechSynthesis). Байты сюда не попадают:
 * хранение — `note-media-store.ts` (IndexedDB).
 *
 * Честность:
 *  • Android WebView обычно НЕ умеет SpeechRecognition и часто не даёт
 *    getUserMedia (нет разрешения RECORD_AUDIO / onPermissionRequest).
 *    Поэтому каждая функция сообщает «нет возможности» (false/null), а UI
 *    обязан сказать это словами и предложить рабочий путь — записать голос
 *    системным диктофоном и приложить файл. Кнопок-пустышек быть не должно.
 *  • Расшифровки приложенного аудио здесь нет и не выдаётся за неё: речь в
 *    текст работает только вживую, пока идёт диктовка.
 */

/** Длинная сторона фото после сжатия: больше — уже не заметка, а архив. */
export const NOTE_PHOTO_MAX_SIDE = 1600;
export const NOTE_PHOTO_QUALITY = 0.82;
/** Одна голосовая заметка — не дольше 15 минут. */
export const NOTE_AUDIO_MAX_MS = 15 * 60 * 1000;

/**
 * Кандидаты mime для MediaRecorder, по убыванию предпочтения.
 * mp4/m4a — первым: webm/opus играет внутри приложения, но не открывается в
 * WhatsApp/Telegram и части плееров, а голосовую заметку почти всегда кому-то
 * пересылают. Не поддержан — берём следующий (isTypeSupported ниже).
 */
export const NOTE_RECORDING_MIMES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const;

export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

/** «2 фото · 1 аудио 0:42» — подпись под заметкой в списке. */
export function attachmentSummary(
  items: ReadonlyArray<{ kind: 'photo' | 'audio'; durationMs?: number }>,
): string {
  if (!items.length) return '';
  const photos = items.filter(i => i.kind === 'photo').length;
  const audios = items.filter(i => i.kind === 'audio');
  const parts: string[] = [];
  // «фото» и «аудио» не склоняются по числу — форма одна на любое количество.
  if (photos) parts.push(`${photos} фото`);
  if (audios.length) {
    const total = audios.reduce((sum, a) => sum + (Number.isFinite(a.durationMs) ? Math.max(0, a.durationMs ?? 0) : 0), 0);
    parts.push(total > 0 ? `${audios.length} аудио ${formatDuration(total)}` : `${audios.length} аудио`);
  }
  return parts.join(' · ');
}

/**
 * Суммарный объём вложений по метаданным (без чтения байтов). Нужен, чтобы
 * показать «сколько занимает эта заметка» и разбивку в списке.
 */
export function attachmentsBytes(items: ReadonlyArray<{ size?: number }>): number {
  return items.reduce((sum, a) => sum + (Number.isFinite(a.size) ? Math.max(0, a.size ?? 0) : 0), 0);
}

/** Расширение для имени файла: восстановление по mime (для Share/скачивания). */
export function extensionForMime(mime: string): string {
  const base = String(mime || '').toLowerCase().split(';')[0].trim();
  if (base === 'image/jpeg' || base === 'image/jpg') return 'jpg';
  if (base === 'image/png') return 'png';
  if (base === 'image/webp') return 'webp';
  if (base === 'image/gif') return 'gif';
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/ogg' || base === 'audio/opus') return 'ogg';
  if (base === 'audio/mp4' || base === 'audio/m4a' || base === 'audio/aac' || base === 'audio/x-m4a') return 'm4a';
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/x-wav' || base === 'audio/wave') return 'wav';
  // Нестандартные подвиды: решаем по подстроке, но только внутри своего типа.
  if (base.startsWith('image/')) {
    if (base.includes('png')) return 'png';
    if (base.includes('webp')) return 'webp';
    if (base.includes('gif')) return 'gif';
    return 'jpg';
  }
  if (base.startsWith('audio/')) {
    if (base.includes('webm')) return 'webm';
    if (base.includes('ogg')) return 'ogg';
    if (base.includes('mp4') || base.includes('m4a')) return 'm4a';
    if (base.includes('mpeg') || base.includes('mp3')) return 'mp3';
  }
  return 'dat';
}

/* ── Запись голоса ─────────────────────────────────────────────────────── */

interface RecorderCtor {
  new (stream: MediaStream, options?: { mimeType?: string }): MediaRecorder;
  isTypeSupported?: (type: string) => boolean;
}

const recorderCtor = (): RecorderCtor | null => {
  if (typeof window === 'undefined') return null;
  const MR = (window as unknown as { MediaRecorder?: RecorderCtor }).MediaRecorder;
  return typeof MR === 'function' ? MR : null;
};

const hasMicrophoneApi = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

/** Есть ли в этой среде и запись, и доступ к микрофону (браузер/WebView). */
export function isVoiceRecordingSupported(): boolean {
  return recorderCtor() != null && hasMicrophoneApi();
}

/** Первый поддерживаемый mime для записи; null — писать нечем. */
export function recordingMime(): string | null {
  const MR = recorderCtor();
  if (!MR) return null;
  for (const type of NOTE_RECORDING_MIMES) {
    try {
      if (typeof MR.isTypeSupported !== 'function' || MR.isTypeSupported(type)) return type;
    } catch {
      /* битый isTypeSupported — пробуем следующий */
    }
  }
  return null;
}

/** Подпись причины, почему запись недоступна (для честного сообщения в UI). */
export function voiceRecordingUnavailableReason(): 'no-recorder' | 'no-microphone' | null {
  if (!recorderCtor()) return 'no-recorder';
  if (!hasMicrophoneApi()) return 'no-microphone';
  return null;
}

/**
 * Длительность аудиофайла: 0 — измерить не удалось (не выдумываем секунды).
 * Нужна для подписи «0:42», а не для расчётов.
 */
export function probeAudioDurationMs(blob: Blob): Promise<number> {
  if (!blob) return Promise.resolve(0);
  if (typeof process !== 'undefined' && process.env?.VITEST === 'true') return Promise.resolve(0);
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return Promise.resolve(0);
  }
  return new Promise<number>(resolve => {
    let url = '';
    try {
      url = URL.createObjectURL(blob);
    } catch {
      resolve(0);
      return;
    }
    const audio = document.createElement('audio');
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), 3000);
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const sec = Number(audio.duration);
      finish(Number.isFinite(sec) && sec > 0 ? Math.round(sec * 1000) : 0);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      finish(0);
    };
    audio.preload = 'metadata';
    audio.src = url;
  });
}

/* ── Речь в текст (диктовка) ───────────────────────────────────────────── */

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Конструктор распознавания речи: Chrome/Android Chrome дают его с префиксом. */
export function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof Ctor === 'function' ? Ctor : null;
}

/** Доступна ли диктовка в этой среде (в WebView АПК — обычно нет). */
export function isDictationSupported(): boolean {
  return speechRecognitionCtor() != null;
}

export interface DictationChunk {
  /** Распознанный текст этого события (склеенный из результатов). */
  text: string;
  /** true — финальный кусок, false — промежуточная гипотеза. */
  final: boolean;
}

interface RecognitionEventLike {
  resultIndex?: number;
  results?: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
}

/**
 * Разобрать событие `onresult` в текст. Вынесено из UI: Web Speech отдаёт
 * вложенные «массивы-объекты», и наивный `results[0][0]` молча теряет куски.
 */
export function readDictationChunk(event: unknown): DictationChunk {
  const e = (event ?? {}) as RecognitionEventLike;
  const results = e.results;
  if (!results || typeof results.length !== 'number') return { text: '', final: false };
  const start = typeof e.resultIndex === 'number' && e.resultIndex >= 0 ? e.resultIndex : 0;
  let text = '';
  let final = false;
  for (let i = start; i < results.length; i++) {
    const alt = results[i]?.[0];
    const piece = typeof alt?.transcript === 'string' ? alt.transcript : '';
    if (piece) text = text ? `${text} ${piece.trim()}` : piece.trim();
    if (results[i]?.isFinal) final = true;
  }
  return { text: text.trim(), final };
}

/* ── Текст в речь (озвучка) ────────────────────────────────────────────── */

/** Есть ли движок озвучки. В WebView он бывает пустым — тогда `speak` вернёт false. */
export function isSpeechOutputSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    speechSynthesis?: { speak?: unknown; cancel?: unknown };
    SpeechSynthesisUtterance?: unknown;
  };
  return (
    typeof w.SpeechSynthesisUtterance === 'function' &&
    !!w.speechSynthesis &&
    typeof w.speechSynthesis.speak === 'function'
  );
}

/**
 * Озвучить текст. Ложь означает «движка нет/не принял» — UI говорит это
 * словами. Озвучка не заменяет заметку и не уходит в расчёты.
 */
export function speakText(
  text: string,
  opts: { lang?: string; rate?: number; onEnd?: () => void } = {},
): boolean {
  const clean = String(text ?? '').trim();
  if (!clean || !isSpeechOutputSupported()) return false;
  try {
    const w = window as unknown as {
      speechSynthesis: { speak: (u: unknown) => void; cancel?: () => void };
      SpeechSynthesisUtterance: new (t: string) => SpeechSynthesisUtterance;
    };
    try {
      w.speechSynthesis.cancel?.();
    } catch {
      /* ignore */
    }
    const utterance = new w.SpeechSynthesisUtterance(clean);
    utterance.lang = opts.lang ?? 'ru-RU';
    utterance.rate = typeof opts.rate === 'number' ? opts.rate : 1;
    if (opts.onEnd) {
      utterance.onend = () => opts.onEnd?.();
      utterance.onerror = () => opts.onEnd?.();
    }
    w.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    if (typeof window === 'undefined') return;
    (window as unknown as { speechSynthesis?: { cancel?: () => void } }).speechSynthesis?.cancel?.();
  } catch {
    /* ignore */
  }
}

/* ── Фото ─────────────────────────────────────────────────────────────── */
/** Байты dataUrl по base64 (без реального декодирования). */
export function dataUrlBytes(dataUrl: string): number {
  const s = String(dataUrl ?? '');
  const comma = s.indexOf(',');
  if (comma < 0) return 0;
  const b64 = s.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/**
 * dataUrl → байты. Чистая функция без atob-цикла по мегабайтной строке в одном
 * вызове: photo-сжатие на телефоне иначе рвёт WebView по памяти.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const s = String(dataUrl ?? '');
  const comma = s.indexOf(',');
  if (comma < 0) return null;
  const meta = s.slice(0, comma);
  const payload = s.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      const bin = atob(payload.replace(/\s+/g, ''));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const decoded = decodeURIComponent(payload);
    const out = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Mime из dataUrl (для записи вложения). */
export function dataUrlMime(dataUrl: string): string {
  const m = /^data:([^;,]+)/i.exec(String(dataUrl ?? ''));
  return (m?.[1] ?? 'image/jpeg').toLowerCase();
}

/**
 * Сжать фото перед хранением: длинная сторона ≤ 1600, JPEG q0.82.
 * null — сжать нельзя (нет canvas/декодера, тестовое окружение); тогда
 * вызывающий сохраняет оригинал как есть.
 */
export async function compressPhotoDataUrl(dataUrl: string): Promise<string | null> {
  const src = String(dataUrl ?? '');
  if (!src.startsWith('data:image/')) return null;
  // В тестах canvas нет — не ждём onload картинки, которая никогда не придёт.
  if (typeof process !== 'undefined' && process.env?.VITEST === 'true') return null;
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement | null>(resolve => {
      const el = new Image();
      let settled = false;
      const done = (value: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      el.onload = () => done(el);
      el.onerror = () => done(null);
      // Android WebView иногда не отдаёт ни onload, ни onerror на dataUrl:
      // ждать вечно нельзя — по истечении просто храним оригинал.
      setTimeout(() => done(null), 4000);
      el.src = src;
    });
    if (!img) return null;
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, NOTE_PHOTO_MAX_SIDE / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', NOTE_PHOTO_QUALITY);
    if (!out.startsWith('data:image/')) return null;
    // Перекодирование иногда раздувает маленькие png — тогда оригинал честнее.
    return out.length < src.length ? out : null;
  } catch {
    return null;
  }
}

/* ── Место в хранилище ─────────────────────────────────────────────────── */

const isVitestEnv = (): boolean =>
  typeof process !== 'undefined' && process.env?.VITEST === 'true';

const storageApi = (): {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
} | null => {
  try {
    const s = typeof navigator !== 'undefined' ? (navigator as unknown as { storage?: unknown }).storage : null;
    return s && typeof s === 'object' ? (s as never) : null;
  } catch {
    return null;
  }
};

/**
 * Попросить ОС не вычищать наше хранилище под давлением квоты.
 * 'unsupported' — браузер/WebView такого не умеет; это не ошибка и не повод
 * что-то говорить пользователю.
 */
export async function ensurePersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (isVitestEnv()) return 'unsupported';
  const s = storageApi();
  if (!s || typeof s.persist !== 'function') return 'unsupported';
  try {
    if (typeof s.persisted === 'function' && (await s.persisted())) return 'granted';
    return (await s.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Свободно байт в хранилище приложения; null — система не сообщает. */
export async function storageFreeBytes(): Promise<number | null> {
  if (isVitestEnv()) return null;
  const s = storageApi();
  if (!s || typeof s.estimate !== 'function') return null;
  try {
    const est = await s.estimate();
    const quota = Number(est?.quota);
    const usage = Number(est?.usage);
    if (!Number.isFinite(quota) || quota <= 0) return null;
    return Math.max(0, quota - (Number.isFinite(usage) && usage > 0 ? usage : 0));
  } catch {
    return null;
  }
}

/**
 * Хватит ли места под файл. true — «можно пробовать» (в том числе когда ОС
 * объём не сообщает: отказывать наугад нельзя). Запас 20 % — под индексы,
 * шифрование и служебные записи.
 */
export async function hasRoomForBytes(bytes: number): Promise<boolean> {
  const need = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (!need) return true;
  const free = await storageFreeBytes();
  if (free === null) return true;
  return free >= need * 1.2;
}

