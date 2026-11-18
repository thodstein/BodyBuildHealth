/**
 * data-backup-note-media.test.ts — вложения заметок в резервной копии.
 *
 * Почему это важно: заметки живут в localStorage, а их фото/голос — в отдельной
 * базе IndexedDB. Пока вложения не попадали в файл, перенос на новый телефон
 * давал заметку с метаданными и «Фото не найдено» на месте каждого файла.
 *
 * База подменена (как в data-backup-spaces), а хранилище вложений — настоящее:
 * в тестовом окружении оно живёт в памяти.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  STORES: ['diary'],
  db: { init: vi.fn(async () => {}), clear: vi.fn(async () => {}), put: vi.fn(async () => {}) },
  deleteSpaceDatabases: vi.fn(async () => {}),
  deleteWeightPhotoDatabase: vi.fn(async () => {}),
  readSpaceStores: vi.fn(async () => ({ diary: [] })),
  writeSpaceStores: vi.fn(async () => {}),
}));

vi.mock('../../engines/weight-photo-store', () => ({
  listWeightPhotosFor: async () => [],
  saveWeightPhotosFor: async () => {},
}));

import { backupFile, collectBackup, describeBackup, importBackup, type AppBackup } from '../data-backup';
import {
  __resetNoteMediaForTests,
  listNoteMedia,
  noteMediaPayload,
  saveNoteMedia,
} from '../../engines/note-media-store';

const bytesOf = (values: number[]): ArrayBuffer => new Uint8Array(values).buffer as ArrayBuffer;

/** jsdom-овский Blob не умеет arrayBuffer() — читаем через FileReader. */
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const savePhoto = (id: string, noteId = 'n1') =>
  saveNoteMedia({
    id,
    noteId,
    kind: 'photo',
    mime: 'image/jpeg',
    size: 3,
    createdAt: 1,
    bytes: bytesOf([1, 2, 3]),
  });

beforeEach(() => {
  localStorage.clear();
  __resetNoteMediaForTests();
});

describe('вложения заметок в копии', () => {
  it('копия уносит байты, а восстановление кладёт их обратно', async () => {
    await savePhoto('m1');

    const backup = await collectBackup();
    expect(backup.noteMedia).toHaveLength(1);
    expect(backup.noteMedia?.[0]).toMatchObject({ id: 'm1', noteId: 'n1', kind: 'photo' });
    expect(typeof backup.noteMedia?.[0].data).toBe('string');
    expect(describeBackup(backup)).toMatchObject({ noteMedia: 1, noteMediaOmitted: false });

    // «Новое устройство»: хранилище пустое, восстанавливаем из файла.
    __resetNoteMediaForTests();
    expect(await listNoteMedia()).toHaveLength(0);
    await importBackup(backup);

    const rows = await listNoteMedia();
    expect(rows).toHaveLength(1);
    const blob = await noteMediaPayload(rows?.[0] ?? null);
    expect(await blobBytes(blob as Blob)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('слишком большой объём не притворяется пустым — файл честно говорит «не вошло»', async () => {
    await savePhoto('m1');
    const backup = await collectBackup({ maxNoteMediaBytes: 1 });
    expect(backup.noteMedia).toBeUndefined();
    expect(backup.noteMediaOmitted).toBe(true);
    expect(describeBackup(backup).noteMediaOmitted).toBe(true);
  });

  it('восстановление заменяет прежние вложения, а не смешивает их', async () => {
    await savePhoto('old-file');
    const backup: AppBackup = {
      app: 'health-engine',
      version: '3.0',
      createdAt: '2026-11-17T00:00:00.000Z',
      stores: {},
      localStorage: {},
      noteMedia: [
        { id: 'new-file', noteId: 'n9', kind: 'audio', mime: 'audio/mp4', size: 2, createdAt: 2, data: 'AAAA' },
      ],
    };
    await importBackup(backup);
    expect((await listNoteMedia())?.map(r => r.id)).toEqual(['new-file']);
  });

  it('битая запись вложения не срывает восстановление остальных', async () => {
    const backup: AppBackup = {
      app: 'health-engine',
      version: '3.0',
      createdAt: '2026-11-17T00:00:00.000Z',
      stores: {},
      localStorage: {},
      noteMedia: [
        { id: '', noteId: '', kind: 'photo', mime: '', size: 0, createdAt: 0, data: '' },
        { id: 'good', noteId: 'n1', kind: 'photo', mime: 'image/png', size: 1, createdAt: 1, data: 'AAAA' },
      ],
    };
    await importBackup(backup);
    expect((await listNoteMedia())?.map(r => r.id)).toEqual(['good']);
  });

  it('готовый файл сам сообщает, сколько вложений в нём', async () => {
    await savePhoto('m1');
    await savePhoto('m2', 'n2');
    const file = await backupFile();
    expect(file.name).toMatch(/^health-engine-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(file.text).toContain('"noteMedia"');
    // Сводка нужна UI: экспорт говорит, что файл реально взял вложения.
    expect(file.info).toMatchObject({ noteMedia: 2, noteMediaOmitted: false });
  });
});
