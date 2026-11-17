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
import { addCoachNote, emptyCoachNotes, readCoachNotes, writeCoachNotes } from '../../../../engines/coach/coach-notes.engine';
import { __resetNoteMediaForTests, listNoteMedia, saveNoteMedia } from '../../../../engines/note-media-store';

vi.mock('../../../../core/native-bridge', () => ({
  pickPhoto: vi.fn(),
}));

const PHOTO_URI = 'data:image/jpeg;base64,AAAA';

const openNew = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="new"]') as HTMLElement);
const save = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="save"]') as HTMLElement);
const items = (c: HTMLElement) => c.querySelectorAll('[data-notes="item"]');

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  __resetNoteMediaForTests();
  vi.mocked(pickPhoto).mockReset();
});

afterEach(() => {
  cleanup();
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
    expect(media?.[0].dataUrl).toContain('data:image/jpeg');

    await waitFor(() => expect(container.querySelector('[data-notes="photo"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-notes="photo"]') as HTMLElement);
    expect(container.querySelector('[data-notes="viewer"]')).not.toBeNull();
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
    expect(media?.[0].blob).toBeInstanceOf(Blob);
    // Сводка в карточке называет вложение, а не молчит.
    expect(items(container)[0].textContent).toContain('1 аудио');
  });

  it('удаление заметки убирает её файлы из хранилища', async () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      {
        title: 'С голосом',
        attachments: [{ id: 'm1', kind: 'audio', mime: 'audio/webm', size: 3, durationMs: 5000, createdAt: '2026-11-17T09:00:00.000Z' }],
      },
      { id: 'n1', now: '2026-11-17T09:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, store);
    await saveNoteMedia({ id: 'm1', noteId: 'n1', kind: 'audio', mime: 'audio/webm', size: 3, createdAt: 1, blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }) });

    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="attachments"]')?.textContent).toContain('1 аудио');

    fireEvent.click(container.querySelector('[data-notes="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="delete"]') as HTMLElement);
    await waitFor(() => expect(items(container)).toHaveLength(0));
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

  it('без распознавания речи — подсказка и явная ошибка, а не тишина', () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    expect(container.querySelector('[data-notes="dictation-hint"]')?.textContent).toContain('недоступна');
    fireEvent.click(container.querySelector('[data-notes="dictate"]') as HTMLElement);
    expect(container.querySelector('[data-notes="voice-error"]')?.textContent).toContain('недоступна');
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
