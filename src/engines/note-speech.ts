/**
 * note-speech.ts — один вход для диктовки и озвучки заметок.
 *
 * Порядок выбора честный и предсказуемый:
 *  1. нативный плагин APK (системные SpeechRecognizer/TextToSpeech) — он есть
 *     там, где web-API отсутствует, то есть в WebView;
 *  2. web-API (Chrome/Telegram) — как раньше;
 *  3. ничего — тогда UI говорит словами, что здесь недоступно.
 *
 * UI не должен знать, кто именно отвёл звук: он получает текст кусками и
 * одно поле `source`, чтобы объяснить пользователю разницу (офлайн, сервис
 * системы и т. п.).
 */

import {
  isDictationSupported,
  isSpeechOutputSupported,
  readDictationChunk,
  speakText as webSpeak,
  speechRecognitionCtor,
  stopSpeaking as webStopSpeaking,
  type SpeechRecognitionLike,
} from './note-media.engine';
import {
  nativeSpeak,
  nativeSpeechCaps,
  nativeStartDictation,
  nativeStopDictation,
  nativeStopSpeak,
  openNativeAppSettings,
} from '../core/speech-native';

export type SpeechSource = 'native' | 'web' | 'none';

export interface SpeechSupport {
  dictation: SpeechSource;
  speak: SpeechSource;
}

/** Синхронная оценка по web-API: нужна для первого рендера без мигания. */
export function speechSupportSync(): SpeechSupport {
  return {
    dictation: isDictationSupported() ? 'web' : 'none',
    speak: isSpeechOutputSupported() ? 'web' : 'none',
  };
}

/** Полная оценка (с нативным мостом). Вне APK равна синхронной. */
export async function speechSupport(): Promise<SpeechSupport> {
  const native = await nativeSpeechCaps();
  return {
    dictation: native.dictation ? 'native' : isDictationSupported() ? 'web' : 'none',
    speak: native.speak ? 'native' : isSpeechOutputSupported() ? 'web' : 'none',
  };
}

export interface DictationOptions {
  lang?: string;
  /** Кусок распознанного текста; `final: false` — промежуточная гипотеза. */
  onText: (text: string, final: boolean) => void;
  onError: (message: string) => void;
  /**
   * Код отказа до перевода в текст: UI по нему понимает, что нужны настройки
   * Android, а не «попробуйте ещё раз».
   */
  onErrorCode?: (code: string) => void;
  onEnd: () => void;
}

export interface DictationSession {
  source: SpeechSource;
  stop: () => void;
}

let webRecognition: SpeechRecognitionLike | null = null;

/**
 * Текст ошибки по коду web-распознавания. Коды разные по смыслу: «нет прав»,
 * «нет сети» и «ничего не сказали» лечатся по-разному, поэтому и тексты разные —
 * иначе человек читает «недоступно» там, где нужно просто разрешить микрофон.
 */
export function webDictationError(ev: unknown): string {
  const code = String((ev as { error?: unknown } | null)?.error ?? '');
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Микрофон запрещён. Разрешите доступ к микрофону для этого приложения и попробуйте снова.';
    case 'audio-capture':
      return 'Микрофон не найден или занят другим приложением.';
    case 'network':
      return 'Распознавание идёт через сервис в интернете — проверьте сеть и попробуйте снова.';
    case 'no-speech':
      return 'Ничего не расслышал. Попробуйте ещё раз, ближе к микрофону.';
    case 'aborted':
      return 'Распознавание остановлено.';
    default:
      return 'Распознавание прервалось. Проверьте доступ к микрофону; распознавание идёт через сервис системы и в офлайне не работает.';
  }
}

/**
 * Текст ошибки по коду нативного движка (`no-permission`, `not-available`,
 * `error-N`). Коды SpeechRecognizer: 2 — сеть, 3 — звук, 4/11 — сервер,
 * 6 — тишина, 7 — не расслышал, 8 — движок занят, 10 — слишком часто.
 *
 * Отдельно — коды разрешения: окно могло не появиться вовсе
 * (`permission-timeout`) или Android уже не показывает его (`permission-blocked`).
 * В обоих случаях человеку нужен ручной путь через настройки, и он есть.
 */
export function nativeDictationError(code: string): string {
  switch (code) {
    case 'no-permission':
      return 'Микрофон запрещён в настройках Android. Нажмите «Настройки микрофона» ниже, включите доступ и попробуйте снова.';
    case 'permission-blocked':
      return 'Микрофон запрещён для приложения: Android больше не показывает окно разрешения. Нажмите «Настройки микрофона» ниже → «Разрешения» → «Микрофон» → «Разрешить».';
    case 'permission-timeout':
      return 'Android не показал окно разрешения на микрофон. Нажмите «Настройки микрофона» ниже и включите доступ вручную.';
    case 'permission-request-failed':
    case 'no-activity':
      return 'Не удалось запросить доступ к микрофону. Откройте «Настройки микрофона» ниже и выдайте разрешение вручную.';
    case 'bridge-timeout':
    case 'bridge-error':
      return 'Системное распознавание не ответило. Закройте и снова откройте приложение, затем попробуйте ещё раз.';
    case 'cancelled':
    case 'superseded':
      return 'Распознавание остановлено.';
    case 'not-available':
      return 'Распознавание речи на этом телефоне недоступно: в системе нет русского движка. Голос можно записать и приложить к заметке.';
    case 'error-6':
    case 'error-7':
      return 'Ничего не расслышал. Попробуйте ещё раз, ближе к микрофону.';
    case 'error-2':
      return 'Сервису распознавания нужен интернет — проверьте сеть.';
    case 'error-4':
    case 'error-11':
      return 'Сервис распознавания не отвечает. Попробуйте позже или проверьте интернет.';
    case 'error-3':
      return 'Не удалось получить звук с микрофона: он занят другим приложением.';
    case 'error-8':
      return 'Движок распознавания ещё занят прошлой попыткой — подождите секунду и нажмите снова.';
    case 'error-10':
      return 'Слишком много запросов к распознаванию подряд — подождите немного.';
    case 'start-failed':
    case 'not-started':
      return 'Не удалось запустить распознавание на этом телефоне. Голос можно записать и приложить к заметке.';
    default:
      return 'Распознавание прервалось. Проверьте доступ к микрофону и интернет.';
  }
}

function startWebDictation(opts: DictationOptions): DictationSession | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;
  try {
    const recognition = new Ctor();
    recognition.lang = opts.lang ?? 'ru-RU';
    recognition.continuous = true;
    // Промежуточные гипотезы нужны, чтобы человек видел, что его слышат.
    recognition.interimResults = true;
    recognition.onresult = event => {
      const chunk = readDictationChunk(event);
      if (!chunk.text) return;
      opts.onText(chunk.text, chunk.final);
    };
    recognition.onerror = event => {
      opts.onError(webDictationError(event));
    };
    recognition.onend = () => {
      webRecognition = null;
      opts.onEnd();
    };
    webRecognition = recognition;
    recognition.start();
    return {
      source: 'web',
      stop: () => {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      },
    };
  } catch (err) {
    webRecognition = null;
    // start() бросает при отказе в микрофоне и когда движок ещё занят прошлой
    // попыткой. Молчать нельзя: иначе UI скажет «недоступно» вместо причины.
    const name = String((err as { name?: unknown } | null)?.name ?? '');
    opts.onError(
      name === 'NotAllowedError'
        ? 'Микрофон запрещён. Разрешите доступ к микрофону для этого приложения и попробуйте снова.'
        : 'Распознавание не запустилось: возможно, прошлая попытка ещё не завершилась. Попробуйте ещё раз.',
    );
    return null;
  }
}

/**
 * Начать диктовку. null — нет ни нативного движка, ни web-API (UI скажет
 * «недоступно» и предложит приложить файл).
 */
export async function startDictation(opts: DictationOptions): Promise<DictationSession | null> {
  const support = await speechSupport();
  if (support.dictation === 'native') {
    let stopped = false;
    const started = await nativeStartDictation(opts.lang ?? 'ru-RU', {
      onText: opts.onText,
      onError: code => {
        opts.onErrorCode?.(code);
        opts.onError(nativeDictationError(code));
      },
      onEnd: opts.onEnd,
    });
    if (!started) return null;
    return {
      source: 'native',
      stop: () => {
        if (stopped) return;
        stopped = true;
        void nativeStopDictation();
      },
    };
  }
  if (support.dictation === 'web') {
    const session = startWebDictation(opts);
    if (session) return session;
  }
  return null;
}

/** Остановить всё, что говорит или слушает (уход с вкладки, закрытие редактора). */
export function stopAllSpeech(): void {
  try {
    if (webRecognition) {
      webRecognition.stop();
      webRecognition = null;
    }
  } catch {
    /* ignore */
  }
  try {
    webStopSpeaking();
  } catch {
    /* ignore */
  }
  void nativeStopDictation();
  void nativeStopSpeak();
}

/**
 * Озвучить заметку. false — движка нет или он отказал (UI скажет словами).
 * Озвучка ничего не сохраняет и не меняет: это чтение вслух.
 */
export async function speakTextBest(
  text: string,
  opts: { onEnd?: () => void } = {},
): Promise<boolean> {
  const support = await speechSupport();
  if (support.speak === 'native') {
    return nativeSpeak(text, { onEnd: opts.onEnd });
  }
  if (support.speak === 'web') {
    return webSpeak(text, { onEnd: opts.onEnd });
  }
  return false;
}

export function stopSpeakingBest(): void {
  try {
    webStopSpeaking();
  } catch {
    /* ignore */
  }
  void nativeStopSpeak();
}

/**
 * Открыть системные настройки приложения. Нужны, когда Android больше не
 * показывает окно разрешения на микрофон: выдать доступ можно только руками.
 * false — не APK или система не приняла запрос (тогда UI просто не обещает).
 */
export async function openMicrophoneSettings(): Promise<boolean> {
  return openNativeAppSettings();
}
