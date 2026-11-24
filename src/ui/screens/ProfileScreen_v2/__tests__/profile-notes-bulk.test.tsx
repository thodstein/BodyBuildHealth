/**
 * profile-notes-bulk.test.tsx — групповые операции и «Дублировать» в заметках профиля.
 *
 * Обещания, которые проверяем:
 *  • «Выбрать» показывает чек `row-select` у каждой видимой заметки и снимается повторно;
 *  • выбранное → «В корзину (N)» переносит именно выделенные заметки, а открытый
 *    редактор удалённой заметки закрывается (иначе правка молча терялась бы);
 *  • переключение «Заметки» → «Корзина» сбрасывает выбор (id из другого списка не утекают);
 *  • в корзине «Восстановить (N)» возвращает выделенные, «Удалить навсегда» требует
 *    подтверждения, стирает заметку из стора И её файлы из хранилища;
 *  • «Дублировать» создаёт копию с тем же текстом и копирует байты вложений
 *    под новыми id (иначе копия ссылалась бы на несуществующие файлы).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileNotesTab } from '../ProfileNotesTab';
import {
  addCoachNote,
  emptyCoachNotes,
  readCoachNotesResult,
  trashCoachNote,
  writeCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';
import { __resetNoteMediaForTests, getNoteMedia, saveNoteMedia } from '../../../../engines/note-media-store';

const PHOTO = {
  id: 'a1',
  kind: 'photo',
  mime: 'image/jpeg',
  size: 3,
  name: 'AAA.jpg',
  createdAt: '2026-11-01T10:00:00.000Z',
} as const;

const seed = (): void => {
  let s = emptyCoachNotes();
  s = addCoachNote(s, { title: 'Колено', body: 'не грузить' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
  s = addCoachNote(s, { title: 'Сон', body: '8 часов' }, { id: 'n2', now: '2026-11-02T10:00:00.000Z' }).store;
  s = addCoachNote(s, { title: 'Старая', body: 'в корзине' }, { id: 'n3', now: '2026-11-03T10:00:00.000Z' }).store;
  s = trashCoachNote(s, 'n3', { now: '2026-11-04T10:00:00.000Z' });
  writeCoachNotes(localStorage, s);
};

const seedPhoto = async (noteId: string, trashed: boolean): Promise<void> => {
  let s = emptyCoachNotes();
  s = addCoachNote(
    s,
    { title: 'Фото', body: 'с файлом', attachments: [PHOTO] },
    { id: noteId, now: '2026-11-01T10:00:00.000Z' },
  ).store;
  if (trashed) s = trashCoachNote(s, noteId, { now: '2026-11-04T10:00:00.000Z' });
  writeCoachNotes(localStorage, s);
  await saveNoteMedia({
    id: PHOTO.id,
    noteId,
    kind: 'photo',
    mime: PHOTO.mime,
    size: PHOTO.size,
    name: PHOTO.name,
    createdAt: 1,
    blob: new Blob(['abc'], { type: PHOTO.mime }),
  });
};

const itemIds = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('[data-notes="item"]')).map((el) => el.getAttribute('data-note-id') ?? '');

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  __resetNoteMediaForTests();
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('групповые операции: живые заметки', () => {
  it('«Выбрать» включает чеки строк и снимается повторно', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="row-select"]')).toBeNull();

    const toggle = container.querySelector('[data-notes="select-mode"]') as HTMLElement;
    fireEvent.click(toggle);
    expect(container.querySelectorAll('[data-notes="row-select"]')).toHaveLength(2);

    fireEvent.click(toggle);
    expect(container.querySelector('[data-notes="row-select"]')).toBeNull();
  });

  it('«В корзину (2)» переносит только выделенные заметки', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="row-select"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n2"] [data-notes="row-select"]') as HTMLElement);

    const bar = container.querySelector('[data-notes="batch-bar"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.textContent).toContain('В корзину (2)');
    fireEvent.click(container.querySelector('[data-notes="batch-delete"]') as HTMLElement);

    const store = readCoachNotesResult(localStorage).store;
    const live = store.items.filter((n) => !n.deletedAt).map((n) => n.id);
    expect(live).toEqual([]);
    // Выбор и режим выбора закрылись, бар исчез.
    expect(container.querySelector('[data-notes="batch-bar"]')).toBeNull();
    expect(container.querySelector('[data-notes="row-select"]')).toBeNull();
  });

  it('переключение на «Корзину» сбрасывает выбор активного списка', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="row-select"]') as HTMLElement);
    expect(container.querySelector('[data-notes="batch-bar"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    expect(itemIds(container)).toEqual(['n3']);
    expect(container.querySelector('[data-notes="batch-bar"]')).toBeNull();
    expect(container.querySelector('[data-note-id="n3"] [data-checked="true"]')).toBeNull();
  });

  it('«В корзину» по выделенной заметке закрывает её редактор', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);
    expect(container.querySelector('[data-notes="editor"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="row-select"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="batch-delete"]') as HTMLElement);

    // Редактор удалённой заметки не должен остаться открытым: сохранение из него
    // молча отклонялось бы, а набранный текст терялся.
    expect(container.querySelector('[data-notes="editor"]')).toBeNull();
  });
});

describe('групповые операции: корзина', () => {
  it('«Восстановить (1)» возвращает выделенную заметку', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n3"] [data-notes="row-select"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="batch-restore"]') as HTMLElement);

    const back = readCoachNotesResult(localStorage).store.items.find((n) => n.id === 'n3');
    // Проверяем именно наличие: `?.deletedAt ?? null` прошёл бы и при удалении.
    expect(back).toBeTruthy();
    expect(back?.deletedAt ?? null).toBeNull();
    expect(itemIds(container)).toEqual([]);
  });

  it('«Удалить навсегда» требует подтверждения и стирает заметку', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n3"] [data-notes="row-select"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="batch-purge"]') as HTMLElement);
    // До подтверждения заметка на месте.
    expect(readCoachNotesResult(localStorage).store.items.some((n) => n.id === 'n3')).toBe(true);

    fireEvent.click(container.querySelector('[data-notes="batch-purge-confirm"]') as HTMLElement);
    const store = readCoachNotesResult(localStorage).store;
    expect(store.items.some((n) => n.id === 'n3')).toBe(false);
  });

  it('«Удалить навсегда» стирает и байты файлов', async () => {
    await seedPhoto('n3', true);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="view"][data-view="trash"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="select-mode"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-note-id="n3"] [data-notes="row-select"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="batch-purge"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="batch-purge-confirm"]') as HTMLElement);

    await waitFor(async () => {
      expect(await getNoteMedia(PHOTO.id)).toBeNull();
    });
  });
});

describe('дублирование заметки', () => {
  it('«Дублировать» создаёт копию с тем же текстом, оригинал остаётся', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="note-duplicate"]') as HTMLElement);

    const store = readCoachNotesResult(localStorage).store;
    const live = store.items.filter((n) => !n.deletedAt);
    expect(live).toHaveLength(3);
    const copy = live.find((n) => n.id !== 'n1' && n.title === 'Колено');
    expect(copy).toBeTruthy();
    expect(copy?.body).toBe('не грузить');
    expect(copy?.pinned).toBe(false);
    expect(container.querySelector('[data-notes="notice"]')?.textContent).toContain('копия');
  });

  it('«Дублировать» копирует байты вложений под новыми id', async () => {
    await seedPhoto('n1', false);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="note-duplicate"]') as HTMLElement);

    const store = readCoachNotesResult(localStorage).store;
    const copy = store.items.find((n) => n.id !== 'n1');
    const copied = copy?.attachments?.[0];
    expect(copied?.id).toBeTruthy();
    expect(copied?.id).not.toBe(PHOTO.id);
    // Байты обязаны переехать: иначе копия показывала бы «файл не найден».
    const record = await waitFor(async () => {
      const rec = await getNoteMedia(copied!.id);
      if (!rec) throw new Error('media not copied yet');
      return rec;
    });
    expect(record.noteId).toBe(copy?.id);
    // Оригинал не тронут.
    expect(await getNoteMedia(PHOTO.id)).not.toBeNull();
  });
});
