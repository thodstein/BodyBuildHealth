/**
 * profile-notes-dictation.test.tsx — нажатие «Голос в текст» не может быть
 * молчаливым.
 *
 * Почему отдельным файлом: здесь движок подменён целиком, чтобы проверить то,
 * что видит человек в двух самых неприятных сценариях:
 *  • нативный старт «завис» (мост не ответил) — тап сразу даёт видимую
 *    реакцию, а через 30 с кнопка честно сдаётся и снова рабочая;
 *  • Android не показывает окно разрешения (`permission-blocked`) — появляется
 *    объяснение и рабочая кнопка «Настройки микрофона» вместо «попробуйте снова».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const h = vi.hoisted(() => ({
  /** hang — старт никогда не отвечает; blocked — Android не покажет окно. */
  mode: 'hang' as 'hang' | 'blocked',
  settingsCalls: 0,
}));

vi.mock('../../../../engines/note-speech', () => ({
  speechSupportSync: () => ({ dictation: 'native', speak: 'none' }),
  speechSupport: async () => ({ dictation: 'native', speak: 'none' }),
  startDictation: (opts: {
    onError?: (message: string) => void;
    onErrorCode?: (code: string) => void;
  }) => {
    if (h.mode === 'hang') return new Promise(() => {});
    opts.onErrorCode?.('permission-blocked');
    opts.onError?.(
      'Микрофон запрещён для приложения: Android больше не показывает окно разрешения. Нажмите «Настройки микрофона» ниже.',
    );
    return Promise.resolve(null);
  },
  stopAllSpeech: () => {},
  stopSpeakingBest: () => {},
  speakTextBest: async () => true,
  openMicrophoneSettings: async () => {
    h.settingsCalls += 1;
    return true;
  },
}));

import { ProfileNotesTab } from '../ProfileNotesTab';

beforeEach(() => {
  h.mode = 'hang';
  h.settingsCalls = 0;
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const btn = (c: HTMLElement) => c.querySelector('[data-notes="dictate"]') as HTMLElement | null;
const openEditor = (c: HTMLElement) =>
  fireEvent.click(c.querySelector('[data-notes="new"]') as HTMLElement);

describe('запуск диктовки', () => {
  it('тап виден сразу, зависший старт через 30 с сдаётся и кнопка оживает', async () => {
    const { container } = render(<ProfileNotesTab />);
    // Дать смонтироваться эффектам на настоящих таймерах, затем включить
    // поддельные — иначе ждать 30 с вживую.
    await act(async () => {});
    openEditor(container);
    expect(btn(container)).not.toBeNull();

    vi.useFakeTimers();
    fireEvent.click(btn(container) as HTMLElement);

    // Никакой тишины: состояние и подпись меняются тем же тапом.
    expect(btn(container)?.getAttribute('data-dictation')).toBe('starting');
    expect(btn(container)?.textContent).toContain('Запускаю');
    expect(container.querySelector('[data-notes="speech-source"]')?.textContent).toContain('Запрашиваю');

    // Движок не ответил вовсе — через 30 с это текст ошибки, а не молчание.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(btn(container)?.getAttribute('data-dictation')).toBe('error');
    expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('30 секунд');
    // Разрешение — самая частая причина: путь к настройкам предлагаем сразу.
    expect(container.querySelector('[data-notes="mic-settings"]')).not.toBeNull();

    // Кнопка не заблокирована навсегда: новый тап начинает новую попытку.
    fireEvent.click(btn(container) as HTMLElement);
    expect(btn(container)?.getAttribute('data-dictation')).toBe('starting');
  });

  it('окно разрешения не показывается — объяснение и кнопка настроек работают', async () => {
    h.mode = 'blocked';
    const { container } = render(<ProfileNotesTab />);
    await act(async () => {});
    openEditor(container);

    fireEvent.click(btn(container) as HTMLElement);
    await act(async () => {});

    expect(btn(container)?.getAttribute('data-dictation')).toBe('error');
    expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('не показывает окно');

    const settings = container.querySelector('[data-notes="mic-settings"]') as HTMLElement | null;
    expect(settings).not.toBeNull();
    expect(settings?.textContent).toContain('Настройки микрофона');
    fireEvent.click(settings as HTMLElement);
    expect(h.settingsCalls).toBe(1);
  });
});
