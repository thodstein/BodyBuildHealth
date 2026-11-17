/**
 * note-media.engine.test.ts — подписи и возможности платформы для вложений.
 *
 * Что важно проверить: числа не врут (0:42 — это 42 с), склейка результатов
 * диктовки не теряет куски, а «нет возможности» честно сообщается как false —
 * UI по этому признаку прячет/гасит кнопку, а не показывает пустышку.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachmentSummary,
  dataUrlBytes,
  extensionForMime,
  formatBytes,
  formatDuration,
  isDictationSupported,
  isSpeechOutputSupported,
  isVoiceRecordingSupported,
  readDictationChunk,
  recordingMime,
  voiceRecordingUnavailableReason,
} from '../note-media.engine';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('подписи', () => {
  it('длительность: 0:00 / 0:42 / 12:34', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(42_000)).toBe('0:42');
    expect(formatDuration(754_000)).toBe('12:34');
  });

  it('размер файла читается человеком', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(900)).toBe('900 Б');
    expect(formatBytes(2048)).toBe('2 КБ');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 МБ');
  });

  it('сводка вложений считает фото и суммарное аудио', () => {
    expect(attachmentSummary([])).toBe('');
    expect(attachmentSummary([{ kind: 'photo' }, { kind: 'audio', durationMs: 42_000 }])).toBe('1 фото · 1 аудио 0:42');
    expect(attachmentSummary([{ kind: 'audio', durationMs: 0 }])).toBe('1 аудио');
  });

  it('расширение по mime, а не «dat» по умолчанию для известных типов', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMime('audio/mp4')).toBe('m4a');
    expect(extensionForMime('audio/mpeg')).toBe('mp3');
    expect(extensionForMime('application/octet-stream')).toBe('dat');
  });

  it('dataUrlBytes считает байты base64', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('')).toBe(0);
  });
});

describe('диктовка (речь в текст)', () => {
  it('собирает финальные и промежуточные куски, начиная с resultIndex', () => {
    const event = {
      resultIndex: 1,
      results: [
        [{ transcript: 'старое' }],
        [{ transcript: 'колено' }, {}],
        [{ transcript: ' беречь' }, {}],
      ] as unknown as ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>,
    };
    (event.results as unknown as Array<{ isFinal?: boolean }>)[1] = Object.assign([{ transcript: 'колено' }], { isFinal: true });
    const chunk = readDictationChunk(event);
    expect(chunk.text).toBe('колено беречь');
    expect(chunk.final).toBe(true);
  });

  it('мусор вместо события не роняет разбор', () => {
    expect(readDictationChunk(null)).toEqual({ text: '', final: false });
    expect(readDictationChunk({})).toEqual({ text: '', final: false });
  });

  it('без SpeechRecognition диктовка честно недоступна', () => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    expect(isDictationSupported()).toBe(false);
  });

  it('с webkitSpeechRecognition диктовка доступна', () => {
    class FakeRecognition {}
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    expect(isDictationSupported()).toBe(true);
  });
});

describe('запись голоса', () => {
  it('без MediaRecorder/getUserMedia запись недоступна и причина названа', () => {
    const w = window as unknown as { MediaRecorder?: unknown };
    delete w.MediaRecorder;
    expect(isVoiceRecordingSupported()).toBe(false);
    expect(voiceRecordingUnavailableReason()).toBe('no-recorder');
    expect(recordingMime()).toBeNull();
  });

  it('mime выбирается по isTypeSupported, а не первый из списка', () => {
    class FakeRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/mp4';
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(recordingMime()).toBe('audio/mp4');
  });

  it('если ни один mime не поддержан — null (UI скажет словами)', () => {
    class FakeRecorder {
      static isTypeSupported() {
        return false;
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(recordingMime()).toBeNull();
  });
});

describe('озвучка', () => {
  it('без speechSynthesis — честное false', () => {
    const w = window as unknown as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };
    delete w.speechSynthesis;
    delete w.SpeechSynthesisUtterance;
    expect(isSpeechOutputSupported()).toBe(false);
  });
});
