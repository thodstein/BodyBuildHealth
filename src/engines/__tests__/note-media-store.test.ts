/**
 * note-media-store.test.ts — хранилище вложений заметок.
 *
 * В тестовом окружении используется in-memory ветка (как в weight-photo-store),
 * но контракт тот же: сохранили → прочитали → удалили; осиротевшие файлы
 * вычищаются, потому что квота не резиновая.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetNoteMediaForTests,
  cleanupNoteMedia,
  deleteNoteMedia,
  deleteNoteMediaForNote,
  getNoteMedia,
  listNoteMedia,
  noteMediaTotalBytes,
  saveNoteMedia,
  saveNoteMediaMany,
} from '../note-media-store';

const photoRec = (id: string, noteId = 'n1') => ({
  id,
  noteId,
  kind: 'photo' as const,
  mime: 'image/jpeg',
  size: 1500,
  createdAt: 1,
  dataUrl: 'data:image/jpeg;base64,AAAA',
});

beforeEach(() => {
  __resetNoteMediaForTests();
});

describe('вложения заметок: хранилище', () => {
  it('сохраняет фото и отдаёт по id', async () => {
    expect(await saveNoteMedia(photoRec('a1'))).toBe(true);
    const rec = await getNoteMedia('a1');
    expect(rec).toMatchObject({ id: 'a1', noteId: 'n1', kind: 'photo', mime: 'image/jpeg' });
    expect(rec?.dataUrl).toContain('data:image/jpeg');
  });

  it('пачка пишется одной операцией, неизвестный id — null', async () => {
    const ok = await saveNoteMediaMany([photoRec('a1'), photoRec('a2')]);
    expect(ok).toBe(true);
    expect((await listNoteMedia())?.map(r => r.id).sort()).toEqual(['a1', 'a2']);
    expect(await getNoteMedia('нет')).toBeNull();
  });

  it('удаление по id и по заметке', async () => {
    await saveNoteMediaMany([photoRec('a1', 'n1'), photoRec('a2', 'n1'), photoRec('a3', 'n2')]);
    await deleteNoteMedia(['a1']);
    expect((await listNoteMedia())?.map(r => r.id).sort()).toEqual(['a2', 'a3']);
    await deleteNoteMediaForNote('n1');
    expect((await listNoteMedia())?.map(r => r.id)).toEqual(['a3']);
  });

  it('cleanup убирает только сирот', async () => {
    await saveNoteMediaMany([photoRec('a1'), photoRec('a2'), photoRec('a3')]);
    const removed = await cleanupNoteMedia(new Set(['a1', 'a3']));
    expect(removed).toBe(1);
    expect((await listNoteMedia())?.map(r => r.id).sort()).toEqual(['a1', 'a3']);
  });

  it('суммарный размер считается по size, а мусорный size не ломает', async () => {
    await saveNoteMediaMany([
      photoRec('a1'),
      { ...photoRec('a2'), size: 500 },
      { ...photoRec('a3'), size: Number.NaN as unknown as number },
    ]);
    expect(await noteMediaTotalBytes()).toBe(2000);
  });

  it('пустой id не сохраняется (иначе запись без ключа)', async () => {
    expect(await saveNoteMedia({ ...photoRec(''), id: '' })).toBe(false);
    expect(await listNoteMedia()).toEqual([]);
  });
});
