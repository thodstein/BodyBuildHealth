/**
 * speech-native.ts — нативная диктовка и озвучка для APK (плагин HeSpeech).
 *
 * Зачем: в Android WebView нет `webkitSpeechRecognition`, а `speechSynthesis`
 * часто пуст — то есть «голос в текст» и «озвучить» на целевой платформе
 * умирали бы с сообщением «недоступно». Плагин даёт системные
 * `SpeechRecognizer` и `TextToSpeech`, JS-сторона остаётся прежней.
 *
 * Правила:
 *  • вне нативного APK не грузим Capacitor вообще (web/Telegram не толще);
 *  • плагин может отсутствовать в старой сборке — тогда всё честно false,
 *    и UI остаётся на web-пути или говорит «недоступно»;
 *  • ничего не бросает наружу: сбой моста = false, а не падение экрана.
 */

import { isCapacitorNative } from './app-platform';

const PLUGIN_NAME = 'HeSpeech';

interface ListenerHandle {
  remove: () => Promise<void> | void;
}

interface HeSpeechPlugin {
  capabilities: () => Promise<{ recognition?: boolean; synthesis?: boolean } | null>;
  startRecognition: (opts: { lang?: string }) => Promise<{
    started?: boolean;
    reason?: string;
    error?: string;
  } | null>;
  stopRecognition: () => Promise<void>;
  /** «Настройки → Приложения → это приложение»: путь выдачи микрофона вручную. */
  openAppSettings: () => Promise<{ opened?: boolean } | null>;
  speak: (opts: { text: string; lang?: string; rate?: number }) => Promise<{
    started?: boolean;
    error?: string;
  } | null>;
  stopSpeaking: () => Promise<void>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<ListenerHandle>;
}

export interface NativeSpeechCaps {
  dictation: boolean;
  speak: boolean;
}

const NO_CAPS: NativeSpeechCaps = { dictation: false, speak: false };

/**
 * Ответ моста может не прийти вовсе (окно разрешения не показалось, плагин
 * завис). Без предела ожидания кнопка висела бы на «Запрашиваю доступ».
 */
const START_CALL_TIMEOUT_MS = 12_000;
const LISTENER_TIMEOUT_MS = 4_000;
const PERMISSION_CALL_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, ms);
    promise.then(
      value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

let pluginPromise: Promise<HeSpeechPlugin | null> | null = null;
let capsPromise: Promise<NativeSpeechCaps> | null = null;
let dictationCleanup: (() => void) | null = null;
/** Слушатель `speakEnd` текущей озвучки: без него подписки копились бы. */
let speakCleanup: (() => void) | null = null;

/** Плагин или null. Вне APK даже не пытаемся импортировать Capacitor. */
function heSpeech(): Promise<HeSpeechPlugin | null> {
  if (!isCapacitorNative()) return Promise.resolve(null);
  if (pluginPromise) return pluginPromise;
  pluginPromise = (async () => {
    try {
      const { registerPlugin, Capacitor } = await import('@capacitor/core');
      if (typeof Capacitor?.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable(PLUGIN_NAME)) {
        return null;
      }
      return registerPlugin(PLUGIN_NAME) as unknown as HeSpeechPlugin;
    } catch {
      return null;
    }
  })();
  return pluginPromise;
}

/** Есть ли нативные распознавание/озвучка. Кэшируется: мост не меняется. */
export function nativeSpeechCaps(): Promise<NativeSpeechCaps> {
  if (capsPromise) return capsPromise;
  capsPromise = (async () => {
    const p = await heSpeech();
    if (!p) return NO_CAPS;
    try {
      const c = await p.capabilities();
      const caps: NativeSpeechCaps = {
        dictation: c?.recognition === true,
        speak: c?.synthesis === true,
      };
      // Оба «нет» — не приговор на всю сессию: нативный движок TTS поднимается
      // асинхронно, и первый ответ мог прийти до его готовности. Положительный
      // ответ кэшируем, отрицательный — проверяем заново.
      if (!caps.dictation && !caps.speak) capsPromise = null;
      return caps;
    } catch {
      return NO_CAPS;
    }
  })();
  return capsPromise;
}

export interface NativeDictationHandlers {
  onText: (text: string, final: boolean) => void;
  /** Код ошибки движка (`no-permission`, `not-available`, `error-N`). */
  onError: (code: string) => void;
  onEnd: () => void;
}

/**
 * Старт нативной диктовки. false — плагина нет или движок отказал
 * (причина уходит в onError).
 */
export async function nativeStartDictation(
  lang: string,
  handlers: NativeDictationHandlers,
): Promise<boolean> {
  const p = await heSpeech();
  if (!p) return false;
  let subs: ListenerHandle[] = [];
  const cleanup = () => {
    const list = subs;
    subs = [];
    dictationCleanup = null;
    for (const s of list) {
      try {
        void s.remove();
      } catch {
        /* ignore */
      }
    }
  };
  try {
    subs.push(
      await withTimeout(
        p.addListener('recognitionText', data => {
          const d = (data ?? {}) as { text?: unknown; final?: unknown };
          const text = typeof d.text === 'string' ? d.text : '';
          if (text) handlers.onText(text, d.final === true);
        }),
        LISTENER_TIMEOUT_MS,
      ),
    );
    subs.push(
      await withTimeout(
        p.addListener('recognitionError', data => {
          const d = (data ?? {}) as { code?: unknown };
          const code = typeof d.code === 'string' ? d.code : String(d.code ?? 'error');
          handlers.onError(code);
        }),
        LISTENER_TIMEOUT_MS,
      ),
    );
    subs.push(
      await withTimeout(
        p.addListener('recognitionEnd', () => {
          cleanup();
          handlers.onEnd();
        }),
        LISTENER_TIMEOUT_MS,
      ),
    );
    dictationCleanup = cleanup;
    const res = await withTimeout(p.startRecognition({ lang }), START_CALL_TIMEOUT_MS);
    if (!res?.started) {
      handlers.onError(res?.reason || res?.error || 'not-started');
      cleanup();
      return false;
    }
    return true;
  } catch (err) {
    // Раньше здесь стоял молчаливый catch: сбой моста оставлял UI в
    // «Запрашиваю доступ…» без единого слова. Теперь причина уходит наверх.
    handlers.onError(
      String((err as { message?: unknown } | null)?.message ?? '') === 'timeout'
        ? 'bridge-timeout'
        : 'bridge-error',
    );
    cleanup();
    return false;
  }
}

export async function nativeStopDictation(): Promise<void> {
  const p = await heSpeech();
  try {
    await p?.stopRecognition();
  } catch {
    /* ignore */
  }
  dictationCleanup?.();
  dictationCleanup = null;
}

/** Озвучить текст системным TTS. false — движка нет/не принял. */
export async function nativeSpeak(
  text: string,
  opts: { lang?: string; rate?: number; onEnd?: () => void } = {},
): Promise<boolean> {
  const clean = String(text ?? '').trim();
  if (!clean) return false;
  const p = await heSpeech();
  if (!p) return false;
  // Предыдущая озвучка могла не прислать speakEnd (движок умер) — снимаем подписку.
  speakCleanup?.();
  speakCleanup = null;
  let sub: ListenerHandle | null = null;
  const release = () => {
    const s = sub;
    sub = null;
    if (speakCleanup === release) speakCleanup = null;
    if (s) {
      try {
        void s.remove();
      } catch {
        /* ignore */
      }
    }
  };
  try {
    sub = await p.addListener('speakEnd', () => {
      release();
      opts.onEnd?.();
    });
    speakCleanup = release;
  } catch {
    sub = null;
  }
  try {
    const res = await p.speak({ text: clean, lang: opts.lang ?? 'ru-RU', rate: opts.rate ?? 1 });
    if (!res?.started) {
      release();
      return false;
    }
    return true;
  } catch {
    release();
    return false;
  }
}

export async function nativeStopSpeak(): Promise<void> {
  speakCleanup?.();
  speakCleanup = null;
  const p = await heSpeech();
  try {
    await p?.stopSpeaking();
  } catch {
    /* ignore */
  }
}

/**
 * Открыть системные настройки приложения. Нужны, когда Android больше не
 * показывает окно разрешения: снаружи это выглядит как «кнопка молчит», а
 * выдать микрофон можно только руками.
 */
export async function openNativeAppSettings(): Promise<boolean> {
  const p = await heSpeech();
  if (!p) return false;
  try {
    const res = await withTimeout(p.openAppSettings(), PERMISSION_CALL_TIMEOUT_MS);
    return res?.opened === true;
  } catch {
    return false;
  }
}

/** Только для тестов: сбросить кэш плагина/возможностей. */
export function __resetNativeSpeechForTests(): void {
  pluginPromise = null;
  capsPromise = null;
  dictationCleanup = null;
  speakCleanup = null;
}
