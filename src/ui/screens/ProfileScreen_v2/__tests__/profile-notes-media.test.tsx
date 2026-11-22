/**
 * profile-notes-media.test.tsx — фото/аудио и голос в заметках профиля.
 *
 * Проверяем то, что видит пользователь:
 *  • фото прикрепляется, показывается миниатюрой и открывается на весь экран;
 *  • аудиофайл прикрепляется и сохраняется в IndexedDB (а не в localStorage);
 *  • заметка без текста, но с вложением — сохраняется (иначе фото некуда девать);
 *  • удаление заметки убирает и её файлы;
 *  • в WebView без распознавания речи и микрофона UI честно говорит об этом,
 *    а не показывает кнопку-пустышку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { pickPhoto } from '../../../../core/native-bridge';
import { ProfileNotesTab } from '../ProfileNotesTab';
import {
  COACH_NOTES_KEY,
  addCoachNote,
  emptyCoachNotes,
  readCoachNotes,
  writeCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';
import {
  __resetNoteMediaForTests,
  deleteNoteMedia,
  listNoteMedia,
  noteMediaPayload,
  saveNoteMedia,
} from '../../../../engines/note-media-store';

vi.mock('../../../../core/native-bridge', () => ({
  pickPhoto: vi.fn(),
}));

const saveBlobApk = vi.hoisted(() => vi.fn(async (_name: string, _blob: Blob) => 'saved' as const));
vi.mock('../../../../core/apk-share', () => ({
  saveBlobApk: (name: string, blob: Blob) => saveBlobApk(name, blob),
  shareOutcomeLabel: (outcome: string) => (outcome === 'saved' ? 'Сохранено' : 'Не удалось'),
}));

const PHOTO_URI = 'data:image/jpeg;base64,AAAA';

/** jsdom не умеет objectURL — без него файлы из хранилища «не находятся». */
const ensureObjectUrl = () => {
  const u = URL as unknown as {
    createObjectURL?: (b: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  if (typeof u.createObjectURL !== 'function') u.createObjectURL = () => 'blob:test-media';
  if (typeof u.revokeObjectURL !== 'function') u.revokeObjectURL = () => {};
};

const openNew = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="new"]') as HTMLElement);
const save = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="save"]') as HTMLElement);
const items = (c: HTMLElement) => c.querySelectorAll('[data-notes="item"]');

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  ensureObjectUrl();
  __resetNoteMediaForTests();
  vi.mocked(pickPhoto).mockReset();
  saveBlobApk.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
  } catch {
    /* ignore */
  }
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('фото в заметке', () => {
  it('прикрепляется, показывается и открывается на весь экран', async () => {
    vi.mocked(pickPhoto).mockResolvedValue({ uri: PHOTO_URI, format: 'jpeg' });
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.click(container.querySelector('[data-notes="add-photo"]') as HTMLElement);

    await waitFor(() =>
      expect(container.querySelector('[data-notes="attach-item"][data-kind="photo"] img')).not.toBeNull(),
    );

    save(container);
    await waitFor(() => expect(items(container)).toHaveLength(1));

    const saved = readCoachNotes(localStorage);
    expect(saved.items[0].attachments).toHaveLength(1);
    expect(saved.items[0].attachments?.[0]).toMatchObject({ kind: 'photo', mime: 'image/jpeg' });
    // Заголовок пустой — карточка называет себя по вложению, а не пустой строкой.
    expect(items(container)[0].textContent).toContain('Заметка с вложением');

    const media = await listNoteMedia();
    expect(media).toHaveLength(1);
    // Фото лежит байтами, а не base64-строкой: читается только как файл.
    expect(media?.[0].dataUrl).toBeUndefined();
    const photoBlob = await noteMediaPayload(media?.[0] ?? null);
    expect(photoBlob?.size).toBe(3);
    expect(photoBlob?.type).toContain('image/');

    await waitFor(() => expect(container.querySelector('[data-notes="photo"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-notes="photo"]') as HTMLElement);
    expect(container.querySelector('[data-notes="viewer"]')).not.toBeNull();
    // Esc — привычный способ закрыть полноэкранный просмотр.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-notes="viewer"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-notes="photo"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="viewer"]') as HTMLElement);
    expect(container.querySelector('[data-notes="viewer"]')).toBeNull();
  });

  it('отмена редактора не пишет файл в хранилище', async () => {
    vi.mocked(pickPhoto).mockResolvedValue({ uri: PHOTO_URI, format: 'jpeg' });
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.click(container.querySelector('[data-notes="add-photo"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-notes="attach-item"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-notes="cancel"]') as HTMLElement);
    expect(container.querySelector('[data-notes="editor"]')).toBeNull();
    expect(await listNoteMedia()).toHaveLength(0);
    expect(readCoachNotes(localStorage).items).toHaveLength(0);
  });
});

describe('аудио в заметке', () => {
  it('аудиофайл сохраняется как blob, заметка без текста валидна', async () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    const file = new File([new Uint8Array([1, 2, 3])], 'voice.webm', { type: 'audio/webm' });
    fireEvent.change(container.querySelector('[data-notes="audio-input"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(container.querySelector('[data-notes="attach-item"][data-kind="audio"]')).not.toBeNull(),
    );

    save(container);
    await waitFor(() => expect(items(container)).toHaveLength(1));

    const note = readCoachNotes(localStorage).items[0];
    expect(note.attachments?.[0]).toMatchObject({ kind: 'audio', mime: 'audio/webm', size: 3 });
    const media = await listNoteMedia();
    expect(media?.[0]).toMatchObject({ kind: 'audio', noteId: note.id, size: 3 });
    expect(media?.[0].bytes).toBeTruthy();
    expect((await noteMediaPayload(media?.[0] ?? null))?.size).toBe(3);
    // Сводка в карточке называет вложение, а не молчит.
    expect(items(container)[0].textContent).toContain('1 аудио');
  });

  it('в корзину — файлы целы, окончательное удаление убирает и их', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С голосом',
        attachments: [
          {
            id: 'm1',
            kind: 'audio',
            mime: 'audio/webm',
            size: 3,
            durationMs: 5000,
            createdAt: '2026-11-17T09:00:00.000Z',
          },
        ],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({
      id: 'm1',
      noteId: 'n1',
      kind: 'audio',
      mime: 'audio/webm',
      size: 3,
      createdAt: 1,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }),
    });

    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="attachments"]')?.textContent).toContain('1 аудио');

    fireEvent.click(container.querySelector('[data-notes="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="delete"]') as HTMLElement);
    await waitFor(() => expect(items(container)).toHaveLength(0));
    // В корзине заметка ждёт восстановления — файл ещё нужен.
    expect(readCoachNotes(localStorage).items[0].deletedAt).toBeTruthy();
    expect(await listNoteMedia()).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="purge"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="purge"]') as HTMLElement);
    await waitFor(() => expect(readCoachNotes(localStorage).items).toHaveLength(0));
    await waitFor(async () => expect(await listNoteMedia()).toHaveLength(0));
  });
});

describe('голос: честные границы платформы', () => {
  it('крестик убирает вложение до сохранения', async () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    const file = new File([new Uint8Array([7])], 'voice.webm', { type: 'audio/webm' });
    fireEvent.change(container.querySelector('[data-notes="audio-input"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await waitFor(() => expect(container.querySelector('[data-notes="attach-item"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-notes="attach-remove"]') as HTMLElement);
    expect(container.querySelector('[data-notes="attach-item"]')).toBeNull();
    expect(await listNoteMedia()).toHaveLength(0);
  });

  it('без распознавания речи — подсказка и явная ошибка, а не тишина', async () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    expect(container.querySelector('[data-notes="dictation-hint"]')?.textContent).toContain('недоступна');
    fireEvent.click(container.querySelector('[data-notes="dictate"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('недоступна'),
    );
  });

  it('«Стоп диктовку» гасит состояние сразу, не дожидаясь движка', async () => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {}
      stop() {
        /* onend намеренно не шлём: нативная остановка тоже может его не прислать */
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    const btn = () => container.querySelector('[data-notes="dictate"]') as HTMLElement;
    fireEvent.click(btn());
    await waitFor(() => expect(btn().getAttribute('data-dictation')).toBe('listening'));
    fireEvent.click(btn());
    await waitFor(() => expect(btn().getAttribute('data-dictation')).toBe('idle'));
    expect(container.querySelector('[data-notes="voice-error"]')).toBeNull();
  });

  it('отказ в микрофоне объясняется, а не подменяется «недоступно»', async () => {
    class Denied {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const err = new Error('denied');
        (err as { name?: string }).name = 'NotAllowedError';
        throw err;
      }
      stop() {}
    }
    vi.stubGlobal('webkitSpeechRecognition', Denied);
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.click(container.querySelector('[data-notes="dictate"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('Микрофон запрещён'),
    );
    expect(container.querySelector('[data-notes="voice-error"]')?.textContent).not.toContain('не подключено');
  });

  it('без микрофона «Записать голос» предлагает диктофон системы', () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.click(container.querySelector('[data-notes="add-voice"]') as HTMLElement);
    expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('диктофон');
    // Скрытый input записи существует и просит именно аудио — путь для АПК.
    const rec = container.querySelector('[data-notes="voice-record-input"]') as HTMLInputElement;
    expect(rec).not.toBeNull();
    expect(rec.getAttribute('accept')).toBe('audio/*');
    expect(rec.hasAttribute('capture')).toBe(true);
  });

  it('без движка озвучки кнопки «Озвучить» нет (не пустышка)', () => {
    let store = emptyCoachNotes();
    store = addCoachNote(store, { title: 'Тихая заметка' }, { id: 'n1', now: '2026-11-17T09:00:00.000Z' }).store;
    writeCoachNotes(localStorage, store);
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="speak"]')).toBeNull();
  });
});

describe('вложение можно забрать из приложения', () => {
  it('«Сохранить» отдаёт файл в Документы/шаринг, статус виден', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С голосом',
        attachments: [
          {
            id: 'm1',
            kind: 'audio',
            mime: 'audio/mp4',
            size: 3,
            name: 'voice.m4a',
            durationMs: 3000,
            createdAt: '2026-11-17T09:00:00.000Z',
          },
        ],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({
      id: 'm1',
      noteId: 'n1',
      kind: 'audio',
      mime: 'audio/mp4',
      size: 3,
      createdAt: 1,
      bytes: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
    });

    const { container } = render(<ProfileNotesTab />);
    await waitFor(() => expect(container.querySelector('[data-notes="audio-player"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-notes="share"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="share-status"]')?.textContent).toContain('Сохранено'),
    );
    expect(saveBlobApk).toHaveBeenCalledTimes(1);
    expect(saveBlobApk.mock.calls[0][0]).toBe('voice.m4a');
    expect((saveBlobApk.mock.calls[0][1] as Blob).size).toBe(3);
    // Подсказку можно убрать, не дожидаясь следующего действия.
    fireEvent.click(container.querySelector('[data-notes="share-dismiss"]') as HTMLElement);
    expect(container.querySelector('[data-notes="share-status"]')).toBeNull();
  });

  it('пропавший файл объясняет ошибку прямо в списке, а не молчит', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С голосом',
        attachments: [
          {
            id: 'm1',
            kind: 'audio',
            mime: 'audio/mp4',
            size: 3,
            createdAt: '2026-11-17T09:00:00.000Z',
          },
        ],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({
      id: 'm1',
      noteId: 'n1',
      kind: 'audio',
      mime: 'audio/mp4',
      size: 3,
      createdAt: 1,
      bytes: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
    });

    const { container } = render(<ProfileNotesTab />);
    await waitFor(() => expect(container.querySelector('[data-notes="audio-player"]')).not.toBeNull());
    // Файл исчез уже после отрисовки (квота/ручная уборка): кнопка ещё есть.
    await deleteNoteMedia(['m1']);
    fireEvent.click(container.querySelector('[data-notes="share"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('Файл не найден'),
    );
    expect(container.querySelector('[data-notes="editor"]')).toBeNull();
  });
});

describe('уборка ресурсов', () => {
  it('уход с вкладки отпускает blob-URL вложений', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С фото',
        attachments: [
          {
            id: 'p1',
            kind: 'photo',
            mime: 'image/jpeg',
            size: 3,
            createdAt: '2026-11-17T09:00:00.000Z',
          },
        ],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({
      id: 'p1',
      noteId: 'n1',
      kind: 'photo',
      mime: 'image/jpeg',
      size: 3,
      createdAt: 1,
      bytes: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
    });

    const u = URL as unknown as {
      createObjectURL: (b: Blob) => string;
      revokeObjectURL: (url: string) => void;
    };
    const createdBefore = u.createObjectURL;
    const revokedBefore = u.revokeObjectURL;
    const created: string[] = [];
    const revoked: string[] = [];
    u.createObjectURL = () => {
      const url = `blob:test-${created.length + 1}`;
      created.push(url);
      return url;
    };
    u.revokeObjectURL = (url: string) => revoked.push(url);
    try {
      const { container, unmount } = render(<ProfileNotesTab />);
      await waitFor(() => expect(container.querySelector('[data-notes="photo"] img')).not.toBeNull());
      expect(created.length).toBeGreaterThan(0);
      unmount();
      expect(revoked).toEqual(created);
    } finally {
      u.createObjectURL = createdBefore;
      u.revokeObjectURL = revokedBefore;
    }
  });
});

describe('запись голоса через MediaRecorder', () => {
  it('запись становится вложением и сохраняется в хранилище файлом', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
    const chunk = new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mp4' });
    class FakeRecorder {
      static isTypeSupported = () => true;
      mimeType = 'audio/mp4';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.ondataavailable?.({ data: chunk });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);

    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    const voice = container.querySelector('[data-notes="add-voice"]') as HTMLElement;
    fireEvent.click(voice);
    await waitFor(() => expect(voice.getAttribute('data-recording')).toBe('true'));

    fireEvent.click(voice);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="attach-item"][data-kind="audio"]')).not.toBeNull(),
    );

    save(container);
    await waitFor(() => expect(items(container)).toHaveLength(1));

    const media = await listNoteMedia();
    expect(media?.[0]).toMatchObject({ kind: 'audio', size: 3 });
    expect((await noteMediaPayload(media?.[0] ?? null))?.size).toBe(3);
    // Микрофон отпущен: иначе индикатор записи горел бы после сохранения.
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('значок «есть вложение» в списке', () => {
  it('у заметки с файлами виден значок и её объём, у пустой — нет', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С файлами',
        attachments: [
          { id: 'p1', kind: 'photo', mime: 'image/jpeg', size: 1024, createdAt: '2026-11-17T09:00:00.000Z' },
          { id: 'a1', kind: 'audio', mime: 'audio/webm', size: 2048, createdAt: '2026-11-17T09:00:00.000Z' },
        ],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    store = addCoachNote(store, { title: 'Просто текст' }, { id: 'n2', now: '2026-11-17T10:00:00.000Z' }).store;
    writeCoachNotes(localStorage, store);

    const { container } = render(<ProfileNotesTab />);
    const badges = container.querySelectorAll('[data-notes="attach-badge"]');
    // Только у заметки с файлами: значок — это факт, а не украшение.
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toContain('📎 2');
    // Разбивка по заметкам: в значке — сколько занимают именно её файлы (1 + 2 КБ).
    expect(badges[0].textContent).toContain('3 КБ');
  });
});

describe('удаление всех вложений', () => {
  it('просит подтверждение, стирает файлы, но оставляет заметки и текст', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С голосом',
        body: 'Текст остаётся',
        attachments: [{ id: 'm1', kind: 'audio', mime: 'audio/webm', size: 3, createdAt: '2026-11-17T09:00:00.000Z' }],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({
      id: 'm1',
      noteId: 'n1',
      kind: 'audio',
      mime: 'audio/webm',
      size: 3,
      createdAt: 1,
      bytes: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
    });

    const { container } = render(<ProfileNotesTab />);
    const clear = () => container.querySelector('[data-notes="clear-media"]') as HTMLElement;
    await waitFor(() => expect(clear()).not.toBeNull());

    // Первый тап ничего не удаляет — только просит подтверждение.
    fireEvent.click(clear());
    expect(clear().textContent).toContain('Точно удалить');
    expect(container.querySelector('[data-notes="clear-media-hint"]')?.textContent).toContain('останутся');
    expect(await listNoteMedia()).toHaveLength(1);

    // Второй тап — файлы стёрты, заметка на месте.
    fireEvent.click(clear());
    await waitFor(async () => expect(await listNoteMedia()).toHaveLength(0));
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Текст остаётся');
    expect(container.querySelector('[data-notes="attach-badge"]')).toBeNull();
    // Файлов нет — и кнопка «удалить все вложения» больше не нужна.
    await waitFor(() => expect(container.querySelector('[data-notes="clear-media"]')).toBeNull());
    expect(readCoachNotes(localStorage).items[0].attachments ?? []).toHaveLength(0);
  });
});

describe('расшифровка записанного аудио', () => {
  it('у приложенного аудио UI прямо говорит, что расшифровки нет', async () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    const file = new File([new Uint8Array([1, 2, 3])], 'voice.webm', { type: 'audio/webm' });
    fireEvent.change(container.querySelector('[data-notes="audio-input"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(container.querySelector('[data-notes="attach-item"][data-kind="audio"]')).not.toBeNull(),
    );
    expect(container.querySelector('[data-notes="audio-no-transcript"]')?.textContent).toContain('надиктовывается');
  });
});

describe('файлы не теряются из-за служебных путей', () => {
  const photo = (id: string) => ({
    id,
    kind: 'photo' as const,
    mime: 'image/jpeg',
    size: 3,
    createdAt: '2026-11-17T09:00:00.000Z',
  });
  const bytes = () => new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;

  it('снятое из заметки вложение убирается из хранилища и при обычном сохранении', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      { title: 'Два файла', attachments: [photo('m1'), photo('m2')] },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    for (const id of ['m1', 'm2']) {
      await saveNoteMedia({
        id,
        noteId: 'n1',
        kind: 'photo',
        mime: 'image/jpeg',
        size: 3,
        createdAt: 1,
        bytes: bytes(),
      });
    }

    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    const remove = container.querySelectorAll('[data-notes="attach-remove"]');
    expect(remove).toHaveLength(2);
    fireEvent.click(remove[0] as HTMLElement);

    // Новых файлов нет — сохранение идёт синхронным путём.
    save(container);
    await waitFor(() => expect(readCoachNotes(localStorage).items[0].attachments).toHaveLength(1));
    const kept = readCoachNotes(localStorage).items[0].attachments?.[0]?.id;
    expect(kept).toBe('m2');
    // Байты снятого файла не должны остаться в квоте до следующего открытия вкладки.
    await waitFor(async () => expect((await listNoteMedia())?.map((m) => m.id)).toEqual(['m2']));
  });

  it('повреждённые данные заметок не стирают файлы, и это сказано пользователю', async () => {
    await saveNoteMedia({
      id: 'orphan',
      noteId: 'gone',
      kind: 'photo',
      mime: 'image/jpeg',
      size: 3,
      createdAt: 1,
      bytes: bytes(),
    });
    // Битый JSON: прочитать заметки нельзя, но это не доказывает, что файлов нет.
    localStorage.setItem(COACH_NOTES_KEY, '{ это не json');

    const { container } = render(<ProfileNotesTab />);
    await waitFor(() =>
      expect(container.querySelector('[data-notes="notice"]')?.textContent).toContain('не читаются'),
    );
    // Даём уборке шанс сработать (если бы она запускалась) — файл должен быть цел.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await listNoteMedia()).toHaveLength(1);
  });

  it('сохранение на повреждённом сторе не стирает старые файлы', async () => {
    await saveNoteMedia({
      id: 'old',
      noteId: 'gone',
      kind: 'photo',
      mime: 'image/jpeg',
      size: 3,
      createdAt: 1,
      bytes: bytes(),
    });
    const damagedRaw = '{ битые данные';
    localStorage.setItem(COACH_NOTES_KEY, damagedRaw);

    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'Новая' },
    });
    save(container);
    await waitFor(() => expect(items(container)).toHaveLength(1));

    // Стор вылечен записью, но сессия началась с повреждения: «лишних» файлов
    // для неё не существует, поэтому старый файл обязан остаться на месте.
    expect(localStorage.getItem('he_coach_notes_damaged')).toBe(damagedRaw);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await listNoteMedia())?.map((item) => item.id)).toContain('old');
  });

  it('файл из резервной копии не считается сиротой при открытии вкладки', async () => {
    await saveNoteMedia({
      id: 'keepme',
      noteId: 'old-note',
      kind: 'photo',
      mime: 'image/jpeg',
      size: 3,
      createdAt: 1,
      bytes: bytes(),
    });
    // Стор вылечен, а резервная копия ссылается на файл старой заметки.
    const store = addCoachNote(emptyCoachNotes(), { title: 'Новая' }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, store);
    localStorage.setItem(
      'he_coach_notes_damaged',
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'old-note',
            title: 'Старая',
            attachments: [{ id: 'keepme', kind: 'photo', mime: 'image/jpeg', size: 3, createdAt: '2026-11-17T09:00:00.000Z' }],
          },
        ],
      }),
    );

    const { container } = render(<ProfileNotesTab />);
    await waitFor(() => expect(items(container)).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await listNoteMedia())?.map((item) => item.id)).toContain('keepme');
  });
});

describe('сохранение и чужие действия', () => {
  const seedOther = () => {
    const store = addCoachNote(
      emptyCoachNotes(),
      { title: 'Другая заметка' },
      { id: 'n1', now: '2026-11-17T08:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
  };

  it('пока пишется файл, закрепление другой заметки не откатывается', async () => {
    seedOther();
    vi.mocked(pickPhoto).mockResolvedValue({ uri: PHOTO_URI, format: 'jpeg' });
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'С фото' },
    });
    fireEvent.click(container.querySelector('[data-notes="add-photo"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-notes="attach-item"]')).not.toBeNull());

    // Асинхронный путь: тап по «Сохранить» уходит в await, и до его завершения
    // успевает прийти чужое действие — закрепление соседней заметки.
    save(container);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="pin"]') as HTMLElement);

    await waitFor(() => expect(items(container)).toHaveLength(2));
    const saved = readCoachNotes(localStorage).items;
    expect(saved.find((n) => n.id === 'n1')?.pinned).toBe(true);
    expect(saved.find((n) => n.title === 'С фото')).toBeTruthy();
  });

  it('двойной тап по «Сохранить» не создаёт вторую заметку', async () => {
    vi.mocked(pickPhoto).mockResolvedValue({ uri: PHOTO_URI, format: 'jpeg' });
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'Одна' },
    });
    fireEvent.click(container.querySelector('[data-notes="add-photo"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-notes="attach-item"]')).not.toBeNull());

    save(container);
    save(container);
    await waitFor(() => expect(items(container)).toHaveLength(1));
    await waitFor(() => expect(readCoachNotes(localStorage).items).toHaveLength(1));
  });
});
