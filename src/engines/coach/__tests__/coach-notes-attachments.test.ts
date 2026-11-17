/**
 * coach-notes-attachments.test.ts — фото/аудио в заметках.
 *
 * Обещания:
 *  • заметка с одним вложением и без текста — валидная (иначе фото нельзя
 *    сохранить, а «Пустая заметка» врёт);
 *  • мусорные вложения (чужой mime, гигантский размер, дубли id) не проходят
 *    в хранилище — метаданные не должны ссылаться на несуществующие файлы;
 *  • вложений не больше лимита, старые при этом не теряются;
 *  • правка текста не стирает вложения, удаление — стирает только выбранное.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_NOTE_ATTACHMENTS_MAX,
  COACH_NOTE_ATTACHMENT_BYTES_MAX,
  addCoachNote,
  addNoteAttachment,
  emptyCoachNotes,
  filterCoachNotes,
  normalizeAttachments,
  noteAttachments,
  noteAttachmentIds,
  parseCoachNotes,
  removeNoteAttachment,
  updateCoachNote,
  type CoachNoteAttachment,
  type CoachNotesStore,
} from '../coach-notes.engine';

const NOW = '2026-11-17T09:00:00.000Z';

const photo = (id: string, over: Partial<CoachNoteAttachment> = {}): CoachNoteAttachment => ({
  id,
  kind: 'photo',
  mime: 'image/jpeg',
  size: 1024,
  createdAt: NOW,
  ...over,
});

const audio = (id: string, over: Partial<CoachNoteAttachment> = {}): CoachNoteAttachment => ({
  id,
  kind: 'audio',
  mime: 'audio/webm',
  size: 2048,
  durationMs: 42000,
  createdAt: NOW,
  ...over,
});

const seed = (input: Parameters<typeof addCoachNote>[1]): CoachNotesStore =>
  addCoachNote(emptyCoachNotes(), { title: 'Заметка', ...input }, { id: 'n1', now: NOW }).store;

describe('вложения в модели заметки', () => {
  it('заметка без текста, но с фото — валидная и не считается пустой', () => {
    const res = addCoachNote(emptyCoachNotes(), { attachments: [photo('a1')] }, { id: 'n1', now: NOW });
    expect(res.error).toBeNull();
    expect(res.note?.attachments).toHaveLength(1);
    expect(res.note?.title).toBe('');
    // Правка заголовка не стирает вложение.
    const edited = updateCoachNote(res.store, 'n1', { title: 'Фото колена' }, { now: NOW });
    expect(edited.items[0].attachments).toHaveLength(1);
  });

  it('битые вложения выбрасываются: чужой mime, гигантский размер, дубли id', () => {
    const parsed = normalizeAttachments([
      { id: 'a1', kind: 'photo', mime: 'video/mp4', size: 10 },
      { id: 'a2', kind: 'photo', mime: 'image/jpeg', size: COACH_NOTE_ATTACHMENT_BYTES_MAX + 1 },
      { id: 'a3', mime: 'image/png', size: 5 },
      { id: 'a3', mime: 'image/png', size: 6 },
      'мусор',
      null,
    ]);
    expect(parsed.map(a => a.id)).toEqual(['a3', 'a_4_2']);
    expect(parsed[0]).toMatchObject({ kind: 'photo', mime: 'image/png', size: 5 });
  });

  it('аудио без mime но с kind — восстанавливается по kind', () => {
    const parsed = normalizeAttachments([{ id: 'x', kind: 'audio', mime: 'audio/ogg', durationMs: 1200 }]);
    expect(parsed[0]).toMatchObject({ kind: 'audio', mime: 'audio/ogg', durationMs: 1200 });
  });

  it('лимит вложений не даёт уронить существующие', () => {
    let store = seed({ attachments: [photo('a0')] });
    for (let i = 1; i < COACH_NOTE_ATTACHMENTS_MAX + 3; i++) {
      store = addNoteAttachment(store, 'n1', photo(`a${i}`), { now: NOW });
    }
    expect(store.items[0].attachments).toHaveLength(COACH_NOTE_ATTACHMENTS_MAX);
    expect(noteAttachmentIds(store.items[0])).toContain('a0');
  });

  it('удаление вложения не трогает остальные и текст', () => {
    const store = seed({ body: 'не грузить', attachments: [photo('a1'), audio('a2')] });
    const next = removeNoteAttachment(store, 'n1', 'a1', { now: NOW });
    expect(next.items[0].body).toBe('не грузить');
    expect(noteAttachments(next.items[0]).map(a => a.id)).toEqual(['a2']);
    // Несуществующий id — store не меняется (UI не должен «делать вид», что удалил).
    expect(removeNoteAttachment(next, 'n1', 'ghost')).toBe(next);
  });

  it('вложения переживают запись/чтение localStorage (version 1)', () => {
    const store = seed({ attachments: [photo('a1'), audio('a2', { name: 'диктофон.m4a', mime: 'audio/mp4' })] });
    const raw = JSON.stringify(store);
    const parsed = parseCoachNotes(raw);
    expect(parsed.items[0].attachments).toEqual(store.items[0].attachments);
    expect(parsed.items[0].attachments?.[1]).toMatchObject({ name: 'диктофон.m4a', mime: 'audio/mp4' });
  });

  it('вложения не ломают поиск по тексту', () => {
    const store = seed({ body: 'колено', attachments: [photo('a1')] });
    expect(filterCoachNotes(store, { query: 'колено' })).toHaveLength(1);
    expect(filterCoachNotes(store, { query: 'локоть' })).toHaveLength(0);
  });
});
