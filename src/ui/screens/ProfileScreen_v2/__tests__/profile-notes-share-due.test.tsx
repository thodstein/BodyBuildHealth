/**
 * profile-notes-share-due.test.tsx — быстрый срок и шаринг заметки целиком.
 *
 * Обещания, которые проверяем:
 *  • 📅 в строке открывает «Сегодня» / «На неделю» и переносит заметку туда без
 *    открытия редактора; «Снять срок» убирает срок и говорит об этом;
 *  • срок — локальный календарный день: западнее UTC `toISOString()` дал бы вчера;
 *  • меню срока не переживает переключение «Заметки» → «Корзина»;
 *  • в редакторе те же пресеты заполняют дату, ✕ её снимает;
 *  • одна кнопка «Поделиться» отдаёт текст И файлы заметки, честно сообщая,
 *    сколько файлов ушло (`файлы 1/2`) и что байтов не нашлось.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileNotesTab } from '../ProfileNotesTab';
import {
  addCoachNote,
  emptyCoachNotes,
  readCoachNotesResult,
  trashCoachNote,
  writeCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';
import { __resetNoteMediaForTests, saveNoteMedia } from '../../../../engines/note-media-store';

const copyOrShareText = vi.hoisted(() => vi.fn(async (_text: string, _title?: string) => 'copied' as const));
const saveBlobApk = vi.hoisted(() => vi.fn(async (_name: string, _blob: Blob) => 'saved' as const));

vi.mock('../../../../core/apk-share', () => ({
  copyOrShareText: (text: string, title?: string) => copyOrShareText(text, title),
  saveBlobApk: (name: string, blob: Blob) => saveBlobApk(name, blob),
  shareOutcomeLabel: (o: string) =>
    o === 'saved'
      ? '💾 Сохранено'
      : o === 'copied'
        ? '📋 Скопировано'
        : o === 'shared'
          ? '📤 Отправлено'
          : '⚠ Не удалось',
}));

const PHOTO = {
  id: 'a1',
  kind: 'photo',
  mime: 'image/jpeg',
  size: 3,
  name: 'AAA.jpg',
  createdAt: '2026-11-01T10:00:00.000Z',
} as const;

const AUDIO = {
  id: 'a2',
  kind: 'audio',
  mime: 'audio/mpeg',
  size: 4,
  name: 'voice.mp3',
  createdAt: '2026-11-01T10:00:00.000Z',
} as const;

/**
 * Ожидаемый локальный день считаем независимой реализацией (`Intl`, зона машины),
 * а не копией `localDayISO`: иначе тест согласился бы и с UTC-версией бага.
 */
const localDay = (offset = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const seed = (): void => {
  let s = emptyCoachNotes();
  s = addCoachNote(s, { title: 'Колено', body: 'не грузить' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
  s = addCoachNote(s, { title: 'Сон', body: '8 часов' }, { id: 'n2', now: '2026-11-02T10:00:00.000Z' }).store;
  s = addCoachNote(s, { title: 'Старая' }, { id: 'n3', now: '2026-11-03T10:00:00.000Z' }).store;
  s = trashCoachNote(s, 'n3', { now: '2026-11-04T10:00:00.000Z' });
  writeCoachNotes(localStorage, s);
};

const seedWithFiles = async (): Promise<void> => {
  let s = emptyCoachNotes();
  s = addCoachNote(
    s,
    { title: 'Осмотр', body: 'фото и голос', attachments: [PHOTO, AUDIO] },
    { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
  ).store;
  writeCoachNotes(localStorage, s);
  await saveNoteMedia({
    id: PHOTO.id,
    noteId: 'n1',
    kind: 'photo',
    mime: PHOTO.mime,
    size: PHOTO.size,
    name: PHOTO.name,
    createdAt: 1,
    blob: new Blob(['abc'], { type: PHOTO.mime }),
  });
};

const seedWithPhotosOnly = async (): Promise<void> => {
  let s = emptyCoachNotes();
  s = addCoachNote(s, { title: 'Осмотр', attachments: [PHOTO] }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
  writeCoachNotes(localStorage, s);
  await saveNoteMedia({
    id: PHOTO.id,
    noteId: 'n1',
    kind: 'photo',
    mime: PHOTO.mime,
    size: PHOTO.size,
    name: PHOTO.name,
    createdAt: 1,
    blob: new Blob(['abc'], { type: PHOTO.mime }),
  });
};

const note = (id: string) => readCoachNotesResult(localStorage).store.items.find((n) => n.id === id);

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  __resetNoteMediaForTests();
  copyOrShareText.mockClear();
  saveBlobApk.mockClear();
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('быстрый срок в списке', () => {
  it('«Сегодня» ставит сегодняшний календарный день', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="due-menu"]')).toBeNull();

    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="due-quick"]') as HTMLElement);
    const menu = container.querySelector('[data-notes="due-menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    // Срок снимать нечего — кнопки «Снять срок» нет.
    expect(container.querySelector('[data-notes="due-quick-clear"]')).toBeNull();

    fireEvent.click(container.querySelector('[data-notes="due-quick-today"]') as HTMLElement);
    expect(note('n1')?.dueAt).toBe(localDay(0));
    expect(container.querySelector('[data-notes="due-menu"]')).toBeNull();
    expect(container.querySelector('[data-notes="notice"]')?.textContent).toContain('сегодня');
    expect(container.querySelector('[data-note-id="n1"] [data-notes="due"]')?.textContent).toContain('До');
  });

  it('«На неделю» ставит срок через семь дней', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n2"] [data-notes="due-quick"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="due-quick-week"]') as HTMLElement);

    expect(note('n2')?.dueAt).toBe(localDay(7));
    // Вторая заметка не тронута.
    expect(note('n1')?.dueAt ?? null).toBeNull();
  });

  it('«Снять срок» убирает срок и говорит об этом', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Колено', dueAt: '2026-11-30' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
    writeCoachNotes(localStorage, s);

    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="due-quick"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="due-quick-clear"]') as HTMLElement);

    expect(note('n1')?.dueAt ?? null).toBeNull();
    expect(container.querySelector('[data-notes="notice"]')?.textContent).toContain('Срок снят');
  });

  it('меню срока закрывается при переходе в корзину', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="due-quick"]') as HTMLElement);
    expect(container.querySelector('[data-notes="due-menu"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    expect(container.querySelector('[data-notes="due-menu"]')).toBeNull();
  });

  it('пресеты редактора заполняют и снимают дату', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);
    const input = () => container.querySelector('[data-notes="editor"] [data-notes="due"]') as HTMLInputElement;

    fireEvent.click(container.querySelector('[data-notes="editor-due-week"]') as HTMLElement);
    expect(input().value).toBe(localDay(7));

    fireEvent.click(container.querySelector('[data-notes="editor-due-today"]') as HTMLElement);
    expect(input().value).toBe(localDay(0));

    fireEvent.click(container.querySelector('[data-notes="editor-due-clear"]') as HTMLElement);
    expect(input().value).toBe('');
  });

  it('у заметки в редакторе и в корзине быстрого срока нет', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    // Открытый редактор держит свою копию dueAt: быстрый срок под ним перетёрся бы при сохранении.
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);
    expect(container.querySelector('[data-note-id="n1"] [data-notes="due-quick"]')).toBeNull();
    expect(container.querySelector('[data-note-id="n2"] [data-notes="due-quick"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    expect(container.querySelectorAll('[data-notes="item"]')).toHaveLength(1);
    expect(container.querySelector('[data-notes="due-quick"]')).toBeNull();
  });

  it('у полуночи UTC срок — всё равно локальный день', () => {
    seed();
    // Момент у границы суток: в UTC уже 24-е, а локально может быть 25-е.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-24T22:30:00.000Z'));
      const { container } = render(<ProfileNotesTab />);
      fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="due-quick"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-notes="due-quick-today"]') as HTMLElement);
      const local = localDay(0);
      const utc = new Date().toISOString().slice(0, 10);
      expect(note('n1')?.dueAt).toBe(local);
      // Если зона машины отличается от UTC, UTC-версия обязана не совпасть.
      if (local !== utc) expect(note('n1')?.dueAt).not.toBe(utc);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('шаринг заметки целиком', () => {
  it('одна кнопка отдаёт текст и файлы, статус честный', async () => {
    await seedWithFiles();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="share-note"]') as HTMLElement);

    await waitFor(() => {
      const status = container.querySelector('[data-notes="share-status"]');
      expect(status).not.toBeNull();
      expect(status!.textContent).toContain('файлы 1/2');
    });
    const text = String(copyOrShareText.mock.calls[0]?.[0] ?? '');
    expect(text).toContain('Осмотр');
    expect(text).toContain('фото и голос');
    // Байты есть только у фото; у аудио записи в хранилище нет — так и говорим.
    expect(saveBlobApk).toHaveBeenCalledTimes(1);
    expect(String(saveBlobApk.mock.calls[0]?.[0] ?? '')).toMatch(/^AAA\.jpe?g$/);
  });

  it('текст не ушёл, а файлы ушли — в статусе сказано именно это', async () => {
    await seedWithPhotosOnly();
    copyOrShareText.mockResolvedValueOnce('failed' as never);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="share-note"]') as HTMLElement);

    await waitFor(() => {
      const status = container.querySelector('[data-notes="share-status"]')?.textContent ?? '';
      expect(status).toContain('⚠ Не удалось');
      expect(status).toContain('файлы 1/1');
      // Провал файлов не приписываем: они как раз ушли.
      expect(status).not.toContain('(не удалось');
    });
  });

  it('без вложений шаринг сообщает только статус текста', async () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="share-note"]') as HTMLElement);

    await waitFor(() => {
      const status = container.querySelector('[data-notes="share-status"]')?.textContent ?? '';
      // В статусе ещё кнопка закрытия ✕ — проверяем текст, а не равенство.
      expect(status).toContain('📋 Скопировано');
      expect(status).not.toContain('файлы');
    });
    expect(saveBlobApk).not.toHaveBeenCalled();
  });
});
