/**
 * note-media-store.test.ts — хранилище вложений заметок.
 *
 * В тестовом окружении используется in-memory ветка (как в weight-photo-store),
 * но контракт тот же: сохранили → прочитали → удалили; осиротевшие файлы
 * вычищаются, потому что квота не резиновая.
 *
 * Отдельно проверяем главное изменение 2026-11: файл лежит байтами (Blob
 * отдаётся через `noteMediaPayload`), легаси-запись с dataUrl читается, а при
 * наличии WebCrypto байты шифруются ключом устройства.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  NOTE_MEDIA_KEY_STORAGE,
  __resetNoteMediaForTests,
  base64ToBytes,
  bytesToBase64,
  cleanupNoteMedia,
  deleteNoteMedia,
  deleteNoteMediaForNote,
  getNoteMedia,
  listNoteMedia,
  noteMediaBytes,
  noteMediaPayload,
  noteMediaTotalBytes,
  saveNoteMedia,
  saveNoteMediaMany,
} from '../note-media-store';

const bytesOf = (values: number[]): ArrayBuffer => new Uint8Array(values).buffer as ArrayBuffer;

/** jsdom-овский Blob не умеет arrayBuffer() — читаем через FileReader. */
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const photoRec = (id: string, noteId = 'n1') => ({
  id,
  noteId,
  kind: 'photo' as const,
  mime: 'image/jpeg',
  size: 3,
  createdAt: 1,
  bytes: bytesOf([1, 2, 3]),
});

beforeEach(() => {
  __resetNoteMediaForTests();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('вложения заметок: хранилище', () => {
  it('сохраняет байты и отдаёт их файлом по id', async () => {
    expect(await saveNoteMedia(photoRec('a1'))).toBe(true);
    const rec = await getNoteMedia('a1');
    expect(rec).toMatchObject({ id: 'a1', noteId: 'n1', kind: 'photo', mime: 'image/jpeg' });
    const blob = await noteMediaPayload(rec);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('image/jpeg');
    expect(await blobBytes(blob as Blob)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('легаси-фото с dataUrl читается и переписывается в байты', async () => {
    // data:image/jpeg;base64,AAAA = три нулевых байта.
    await saveNoteMedia({
      id: 'old',
      noteId: 'n1',
      kind: 'photo',
      mime: 'image/jpeg',
      size: 3,
      createdAt: 1,
      dataUrl: 'data:image/jpeg;base64,AAAA',
    });
    const rec = await getNoteMedia('old');
    expect(rec?.dataUrl).toBeUndefined();
    // Байты на месте: при живом WebCrypto они ещё и зашифрованы (длина ≠ 3).
    expect((rec?.bytes as ArrayBuffer)?.byteLength).toBeGreaterThanOrEqual(3);
    const blob = await noteMediaPayload(rec);
    expect(blob?.size).toBe(3);
    expect(await blobBytes(blob as Blob)).toEqual(new Uint8Array([0, 0, 0]));
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
      { ...photoRec('a1'), size: 1500 },
      { ...photoRec('a2'), size: 500 },
      { ...photoRec('a3'), size: Number.NaN as unknown as number },
    ]);
    expect(await noteMediaTotalBytes()).toBe(2000);
  });

  it('пустой id не сохраняется (иначе запись без ключа)', async () => {
    expect(await saveNoteMedia({ ...photoRec(''), id: '' })).toBe(false);
    expect(await listNoteMedia()).toEqual([]);
  });

  it('base64 туда-обратно без потерь', () => {
    const bytes = new Uint8Array(300).map((_, i) => i % 256);
    const b64 = bytesToBase64(bytes);
    expect(base64ToBytes(b64)).toEqual(bytes);
    // dataUrl тоже принимается: префикс отрезается.
    expect(base64ToBytes('data:image/jpeg;base64,' + b64)).toEqual(bytes);
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });
});

describe('шифрование байтов ключом устройства', () => {
  it('с WebCrypto байты закрыты AES-GCM, ключ — на устройстве, файл читается', async () => {
    vi.stubGlobal('crypto', webcrypto);
    __resetNoteMediaForTests();
    await saveNoteMedia(photoRec('secret'));

    const rec = await getNoteMedia('secret');
    expect(rec?.enc).toBe('aes-gcm');
    expect(Array.from(new Uint8Array(rec?.bytes as ArrayBuffer))).not.toEqual([1, 2, 3]);

    // Ключ лежит в localStorage: без него файл не прочитать (это и есть смысл).
    expect(localStorage.getItem(NOTE_MEDIA_KEY_STORAGE)).toMatch(/^[0-9a-f]{64}$/i);

    const payload = await noteMediaPayload(rec);
    expect(await blobBytes(payload as Blob)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('подмена ключа (восстановление копии) не делает новые файлы нечитаемыми', async () => {
    vi.stubGlobal('crypto', webcrypto);
    __resetNoteMediaForTests();
    await saveNoteMedia(photoRec('first'));
    expect((await getNoteMedia('first'))?.enc).toBe('aes-gcm');

    // Имитация импорта копии: ключ в localStorage сменился.
    localStorage.setItem(NOTE_MEDIA_KEY_STORAGE, 'a'.repeat(64));
    await saveNoteMedia(photoRec('second'));

    const second = await getNoteMedia('second');
    const payload = await noteMediaPayload(second);
    expect(await blobBytes(payload as Blob)).toEqual(new Uint8Array([1, 2, 3]));
    // Старый файл этим ключом не читается — так и должно быть, но он остался.
    expect(await noteMediaPayload(await getNoteMedia('first'))).toBeNull();
  });

  it('без WebCrypto пишем открыто, а не теряем файл', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a });
    __resetNoteMediaForTests();
    await saveNoteMedia(photoRec('plain'));
    const rec = await getNoteMedia('plain');
    expect(rec?.enc).toBeUndefined();
    expect(new Uint8Array((await noteMediaBytes(rec)) as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
