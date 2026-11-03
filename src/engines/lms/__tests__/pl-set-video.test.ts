/**
 * pl-set-video.test.ts — Фаза 6, п.10: ссылки «подход → видео».
 *
 * Проверяем обещания, из-за которых фича может навредить:
 *  • один слот на подход: перезапись заменяет, старый URI возвращается для удаления;
 *  • битый/чужой JSON не роняет плеер и не «додумывается»;
 *  • ссылки не растут вечно: старые и лишние вычищаются вместе с URI файлов;
 *  • base64-видео в localStorage не пишется — только ссылка.
 */
import { describe, expect, it } from 'vitest';
import {
  emptySetVideoStore,
  findSetVideo,
  listSetVideosForDate,
  parseSetVideoStore,
  PL_SET_VIDEO_KEY,
  PL_VIDEO_MAX_ITEMS,
  pruneSetVideos,
  readSetVideoStore,
  removeSetVideo,
  serializeSetVideoStore,
  setVideoKey,
  upsertSetVideo,
  writeSetVideoStore,
} from '../pl-set-video.engine';
import { localIsoDateOffset } from '../../../core/local-date';

const D = '2026-11-03';

describe('слоты видео', () => {
  it('ключ один на (дата, упражнение, подход)', () => {
    expect(setVideoKey(D, 'Присед', 2)).toBe('2026-11-03|Присед|2');
    expect(setVideoKey(D, ' Присед ', 0)).toBe('2026-11-03|Присед|1');
  });

  it('upsert добавляет и находит видео подхода', () => {
    const { store } = upsertSetVideo(emptySetVideoStore(), { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///a.mp4' });
    const found = findSetVideo(store, D, 'Присед', 1);
    expect(found?.uri).toBe('file:///a.mp4');
    expect(found?.source).toBe('recorded');
    expect(findSetVideo(store, D, 'Присед', 2)).toBeNull();
  });

  it('перезапись того же подхода заменяет ссылку и возвращает старый URI', () => {
    const a = upsertSetVideo(emptySetVideoStore(), { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///old.mp4' });
    const b = upsertSetVideo(a.store, { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///new.mp4' });
    expect(b.store.items).toHaveLength(1);
    expect(b.replacedUri).toBe('file:///old.mp4');
    expect(findSetVideo(b.store, D, 'Присед', 1)?.uri).toBe('file:///new.mp4');
  });

  it('пустой URI/без даты/без упражнения — не пишем ничего', () => {
    const base = emptySetVideoStore();
    expect(upsertSetVideo(base, { date: D, exercise: 'Присед', setNumber: 1, uri: '   ' }).store).toBe(base);
    expect(upsertSetVideo(base, { date: '', exercise: 'Присед', setNumber: 1, uri: 'file:///a.mp4' }).store).toBe(base);
    expect(upsertSetVideo(base, { date: D, exercise: '', setNumber: 1, uri: 'file:///a.mp4' }).store).toBe(base);
  });

  it('remove отдаёт URI удалённой ссылки', () => {
    const { store } = upsertSetVideo(emptySetVideoStore(), { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///a.mp4' });
    const res = removeSetVideo(store, D, 'Присед', 1);
    expect(res.removedUri).toBe('file:///a.mp4');
    expect(res.store.items).toHaveLength(0);
    expect(removeSetVideo(res.store, D, 'Присед', 1).removedUri).toBeNull();
  });

  it('listSetVideosForDate — только своя дата, в порядке подходов', () => {
    let s = emptySetVideoStore();
    s = upsertSetVideo(s, { date: D, exercise: 'Присед', setNumber: 2, uri: 'file:///2.mp4' }).store;
    s = upsertSetVideo(s, { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///1.mp4' }).store;
    s = upsertSetVideo(s, { date: '2026-11-04', exercise: 'Присед', setNumber: 1, uri: 'file:///другой-день.mp4' }).store;
    const list = listSetVideosForDate(s, D);
    expect(list.map(i => i.setNumber)).toEqual([1, 2]);
  });
});

describe('терпимый парсер', () => {
  it('битый JSON / чужая версия / не массив → пусто, без исключений', () => {
    expect(parseSetVideoStore('{oops').items).toEqual([]);
    expect(parseSetVideoStore(JSON.stringify({ version: 2, items: [] })).items).toEqual([]);
    expect(parseSetVideoStore(JSON.stringify({ version: 1, items: {} })).items).toEqual([]);
    expect(parseSetVideoStore(null).items).toEqual([]);
  });

  it('невалидные записи выбрасываются, валидные остаются', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///ok.mp4' },
        { date: '', exercise: 'Присед', setNumber: 1, uri: 'file:///no-date.mp4' },
        { date: D, exercise: 'Жим', setNumber: 0, uri: 'file:///zero-set.mp4' },
        { date: D, exercise: 'Жим', setNumber: 1, uri: '' },
        'мусор',
      ],
    });
    const store = parseSetVideoStore(raw);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].uri).toBe('file:///ok.mp4');
  });

  it('сериализованная форма читается обратно', () => {
    const { store } = upsertSetVideo(emptySetVideoStore(), { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///a.mp4' });
    const round = parseSetVideoStore(serializeSetVideoStore(store));
    expect(findSetVideo(round, D, 'Присед', 1)?.uri).toBe('file:///a.mp4');
  });

  it('read пишет/читает через хранилище, недоступное хранилище не роняет', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, v); },
    };
    const { store } = upsertSetVideo(emptySetVideoStore(), { date: D, exercise: 'Присед', setNumber: 1, uri: 'file:///a.mp4' });
    writeSetVideoStore(storage, store, { today: D });
    expect(map.has(PL_SET_VIDEO_KEY)).toBe(true);
    expect(findSetVideo(readSetVideoStore(storage), D, 'Присед', 1)?.uri).toBe('file:///a.mp4');
    expect(readSetVideoStore(null).items).toEqual([]);
  });
});

describe('обрезка ссылок (память телефона)', () => {
  it('ссылки старше срока хранения уходят вместе с URI файлов', () => {
    const today = localIsoDateOffset(0);
    const old = localIsoDateOffset(-100);
    let s = emptySetVideoStore();
    s = upsertSetVideo(s, { date: old, exercise: 'Присед', setNumber: 1, uri: 'file:///old.mp4' }).store;
    s = upsertSetVideo(s, { date: today, exercise: 'Присед', setNumber: 1, uri: 'file:///new.mp4' }).store;
    const { store, droppedUris } = pruneSetVideos(s, { today });
    expect(store.items.map(i => i.uri)).toEqual(['file:///new.mp4']);
    expect(droppedUris).toEqual(['file:///old.mp4']);
  });

  it(`держит не больше ${PL_VIDEO_MAX_ITEMS} ссылок`, () => {
    let s = emptySetVideoStore();
    for (let i = 1; i <= PL_VIDEO_MAX_ITEMS + 5; i++) {
      s = upsertSetVideo(s, { date: '2026-11-03', exercise: 'Присед', setNumber: i, uri: `file:///${i}.mp4` }).store;
    }
    const { store, droppedUris } = pruneSetVideos(s, { today: '2026-11-03' });
    expect(store.items).toHaveLength(PL_VIDEO_MAX_ITEMS);
    expect(droppedUris).toHaveLength(5);
  });

  it('в хранилище пишется уже обрезанный список (не растёт вечно)', () => {
    const today = localIsoDateOffset(0);
    const old = localIsoDateOffset(-365);
    let s = emptySetVideoStore();
    s = upsertSetVideo(s, { date: old, exercise: 'Присед', setNumber: 1, uri: 'file:///very-old.mp4' }).store;
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    writeSetVideoStore(storage, s, { today });
    expect(parseSetVideoStore(map.get(PL_SET_VIDEO_KEY)!).items).toHaveLength(0);
  });
});
