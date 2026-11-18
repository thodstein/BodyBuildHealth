/**
 * note-speech.test.ts — единый вход диктовки и озвучки.
 *
 * Проверяем порядок выбора: нативный мост APK → web-API → «недоступно».
 * Особенно важен третий случай: там, где ничего нет, функции обязаны вернуть
 * false/null, чтобы UI сказал словами, а не показал кнопку-пустышку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  native: false,
  recognition: false,
  synthesis: false,
  subs: {} as Record<string, Array<(data: unknown) => void>>,
  started: 0,
  stopped: 0,
  spoken: [] as string[],
  speakStarts: 0,
}));

vi.mock('../../core/app-platform', () => ({
  isCapacitorNative: () => h.native,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => true },
  registerPlugin: () => ({
    capabilities: async () => ({ recognition: h.recognition, synthesis: h.synthesis }),
    startRecognition: async () => {
      h.started += 1;
      return { started: true };
    },
    stopRecognition: async () => {
      h.stopped += 1;
    },
    speak: async (opts: { text: string }) => {
      h.spoken.push(opts.text);
      h.speakStarts += 1;
      return { started: true };
    },
    stopSpeaking: async () => {},
    addListener: async (event: string, cb: (data: unknown) => void) => {
      const list = h.subs[event] ?? (h.subs[event] = []);
      list.push(cb);
      return {
        remove: () => {
          h.subs[event] = (h.subs[event] ?? []).filter(x => x !== cb);
        },
      };
    },
  }),
}));

import {
  speakTextBest,
  speechSupport,
  speechSupportSync,
  startDictation,
  stopAllSpeech,
} from '../note-speech';
import { __resetNativeSpeechForTests } from '../../core/speech-native';

const emit = (event: string, data: unknown) => {
  for (const cb of [...(h.subs[event] ?? [])]) cb(data);
};

beforeEach(() => {
  h.native = false;
  h.recognition = false;
  h.synthesis = false;
  h.subs = {};
  h.started = 0;
  h.stopped = 0;
  h.spoken = [];
  h.speakStarts = 0;
  __resetNativeSpeechForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetNativeSpeechForTests();
});

describe('выбор движка', () => {
  it('ничего нет — честное «недоступно» без исключений', async () => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    expect(speechSupportSync()).toEqual({ dictation: 'none', speak: 'none' });
    expect(await speechSupport()).toEqual({ dictation: 'none', speak: 'none' });
    expect(await startDictation({ onText: () => {}, onError: () => {}, onEnd: () => {} })).toBeNull();
    expect(await speakTextBest('привет')).toBe(false);
  });

  it('web-API: диктовка идёт кусками и отдаёт финальный текст', async () => {
    type Fake = {
      emit: (text: string, final: boolean) => void;
      stop: () => void;
    };
    const created: Fake[] = [];
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        created.push(this as unknown as Fake);
      }
      start() {}
      stop() {
        this.onend?.();
      }
      emit(text: string, final: boolean) {
        const item = Object.assign([{ transcript: text }], { isFinal: final });
        this.onresult?.({ resultIndex: 0, results: [item] });
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const seen: Array<{ text: string; final: boolean }> = [];
    const ended: number[] = [];
    const session = await startDictation({
      onText: (text, final) => seen.push({ text, final }),
      onError: () => {},
      onEnd: () => ended.push(1),
    });
    expect(session?.source).toBe('web');
    expect(created).toHaveLength(1);
    created[0].emit('колено', false);
    created[0].emit('колено беречь', true);
    expect(seen).toEqual([
      { text: 'колено', final: false },
      { text: 'колено беречь', final: true },
    ]);
    session?.stop();
    expect(ended).toHaveLength(1);
  });

  it('нативный мост важнее web-API и умеет озвучку', async () => {
    h.native = true;
    h.recognition = true;
    h.synthesis = true;
    __resetNativeSpeechForTests();
    expect(await speechSupport()).toEqual({ dictation: 'native', speak: 'native' });

    const seen: Array<{ text: string; final: boolean }> = [];
    const ended: number[] = [];
    const session = await startDictation({
      onText: (text, final) => seen.push({ text, final }),
      onError: () => {},
      onEnd: () => ended.push(1),
    });
    expect(session?.source).toBe('native');
    expect(h.started).toBe(1);

    emit('recognitionText', { text: 'колено', final: false });
    emit('recognitionText', { text: 'колено беречь', final: true });
    expect(seen).toEqual([
      { text: 'колено', final: false },
      { text: 'колено беречь', final: true },
    ]);

    emit('recognitionEnd', {});
    expect(ended).toHaveLength(1);

    expect(await speakTextBest('Заметка вслух')).toBe(true);
    expect(h.spoken).toEqual(['Заметка вслух']);

    stopAllSpeech();
    // Нативная остановка идёт через мост (async) — даём ей тик.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(h.stopped).toBeGreaterThan(0);
  });

  it('нативный движок молчит, а web есть — уходим на web, а не сдаёмся', async () => {
    h.native = true;
    h.recognition = false;
    h.synthesis = false;
    __resetNativeSpeechForTests();
    const w = window as unknown as { SpeechSynthesisUtterance?: unknown; speechSynthesis?: unknown };
    // speechSynthesis без движка: isSpeechOutputSupported смотрит на наличие speak.
    w.speechSynthesis = { speak: () => {}, cancel: () => {} };
    w.SpeechSynthesisUtterance = function Utterance() {};
    const support = await speechSupport();
    expect(support.speak).toBe('web');
    expect(support.dictation).toBe('none');
  });

  it('нативный отказ микрофона объясняется словами', async () => {
    h.native = true;
    h.recognition = true;
    __resetNativeSpeechForTests();
    const errors: string[] = [];
    await startDictation({
      onText: () => {},
      onError: message => errors.push(message),
      onEnd: () => {},
    });
    emit('recognitionError', { code: 'no-permission' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Микрофон');
  });
});
