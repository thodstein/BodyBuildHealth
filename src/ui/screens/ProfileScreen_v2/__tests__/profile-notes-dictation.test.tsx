/**
 * profile-notes-dictation.test.tsx — нажатие «Голос в текст» не может быть
 * молчаливым.
 *
 * Почему отдельным файлом: здесь нативный старт подменён «зависшим» промисом
 * (мост ответил не сразу или не ответил вовсе). Проверяем то, что видит человек:
 *  • тап сразу даёт видимую реакцию, а не тишину;
 *  • зависший старт через 30 с честно сдаётся с текстом, а не оставляет кнопку
 *    навсегда в «запускается»;
 *  • после сдачи кнопка снова рабочая — второй тап запускает новую попытку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

vi.mock('../../../../engines/note-speech', () => ({
  speechSupportSync: () => ({ dictation: 'native', speak: 'none' }),
  speechSupport: async () => ({ dictation: 'native', speak: 'none' }),
  // Старт «висит»: именно так выглядел баг «нажимаю — ничего не происходит».
  startDictation: () => new Promise(() => {}),
  stopAllSpeech: () => {},
  stopSpeakingBest: () => {},
  speakTextBest: async () => true,
}));

import { ProfileNotesTab } from '../ProfileNotesTab';

beforeEach(() => {
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

describe('запуск диктовки', () => {
  it('тап виден сразу, зависший старт через 30 с сдаётся и кнопка оживает', async () => {
    const { container } = render(<ProfileNotesTab />);
    // Дать смонтироваться эффектам на настоящих таймерах, затем включить
    // поддельные — иначе ждать 30 с вживую.
    await act(async () => {});
    fireEvent.click(container.querySelector('[data-notes="new"]') as HTMLElement);
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

    // Кнопка не заблокирована навсегда: новый тап начинает новую попытку.
    fireEvent.click(btn(container) as HTMLElement);
    expect(btn(container)?.getAttribute('data-dictation')).toBe('starting');
  });
});
