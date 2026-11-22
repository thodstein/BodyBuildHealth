/**
 * notes-widget-payload.test.ts — что именно уезжает в нативный виджет заметок.
 *
 * Нативная часть (`NotesWidgetProvider`) читает поля по именам: если поле
 * `files` пропадёт, значок «📎» тихо перестанет появляться — без ошибок,
 * и без такого теста это заметить негде.
 */
import { describe, expect, it } from 'vitest';
import {
  addCoachNote,
  emptyCoachNotes,
  toggleCoachNotePin,
  trashCoachNote,
  type CoachNoteAttachment,
} from '../../../engines/coach/coach-notes.engine';
import { notesForWidget } from '../widget-sync';

const photo = (id: string): CoachNoteAttachment => ({
  id,
  kind: 'photo',
  mime: 'image/jpeg',
  size: 1024,
  createdAt: '2026-11-18T09:00:00.000Z',
});

describe('строки заметок для виджета', () => {
  it('несёт счётчик файлов, закреплённые идут первыми', () => {
    let store = emptyCoachNotes();
    store = addCoachNote(
      store,
      { title: 'Обычная', body: 'текст' },
      { id: 'n1', now: '2026-11-18T09:00:00.000Z' },
    ).store;
    store = addCoachNote(
      store,
      { title: 'С фото', attachments: [photo('a1'), photo('a2')] },
      { id: 'n2', now: '2026-11-18T10:00:00.000Z' },
    ).store;
    store = toggleCoachNotePin(store, 'n1');

    const payload = notesForWidget(store);
    expect(payload.total).toBe(2);
    expect(payload.pinned).toBe(1);
    // Закреплённая — первой, даже если она старше.
    expect(payload.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(payload.notes.find((n) => n.id === 'n1')?.files).toBe(0);
    expect(payload.notes.find((n) => n.id === 'n2')?.files).toBe(2);
  });

  it('заметка без текста, но с файлом не подписывается «Без названия»', () => {
    let store = emptyCoachNotes();
    store = addCoachNote(store, { attachments: [photo('a1')] }, { id: 'n9', now: '2026-11-18T09:00:00.000Z' }).store;

    const [row] = notesForWidget(store).notes;
    expect(row.title).toBe('Заметка с фото/аудио');
    expect(row.files).toBe(1);
  });

  it('корзина не попадает в виджет и не считается в итогах', () => {
    let store = emptyCoachNotes();
    store = addCoachNote(store, { title: 'Живая' }, { id: 'n1', now: '2026-11-18T09:00:00.000Z' }).store;
    store = addCoachNote(
      store,
      { title: 'Удалённая', pinned: true },
      { id: 'n2', now: '2026-11-18T10:00:00.000Z' },
    ).store;
    store = trashCoachNote(store, 'n2', { now: '2026-11-18T11:00:00.000Z' });

    const payload = notesForWidget(store);
    expect(payload.notes.map((n) => n.id)).toEqual(['n1']);
    expect(payload.total).toBe(1);
    // Закреплённая в корзине не должна раздувать счётчик закреплённых.
    expect(payload.pinned).toBe(0);
  });
});
