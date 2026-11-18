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
  onEnd: () => void;
}

export interface DictationSession {
  source: SpeechSource;
  stop: () => void;
}

let webRecognition: SpeechRecognitionLike | null = null;

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
    recognition.onerror = () => {
      opts.onError(
        'Распознавание прервалось. Проверьте доступ к микрофону; распознавание идёт через сервис системы и в офлайне не работает.',
      );
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
  } catch {
    webRecognition = null;
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
        if (code === 'no-permission') {
          opts.onError('Микрофон запрещён в настройках Android — разрешите доступ и попробуйте снова.');
          return;
        }
        if (code === 'not-available') {
          opts.onError(
            'Распознавание речи на этом телефоне недоступно: в системе нет русского движка. Голос можно записать и приложить к заметке.',
          );
          return;
        }
        opts.onError('Распознавание прервалось. Проверьте доступ к микрофону и интернет.');
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
