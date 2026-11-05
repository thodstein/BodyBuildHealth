/**
 * coach-notes.test.ts — заметки тренера.
 *
 * Ключевое: заметки не теряются молча (лимит → ошибка, а не вытеснение),
 * закреплённые наверху, поиск по смыслу, битые данные не ломают профиль.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_NOTES_MAX,
  addCoachNote,
  countNotesForAthlete,
  emptyCoachNotes,
  filterCoachNotes,
  parseCoachNotes,
  readCoachNotes,
  removeCoachNote,
  serializeCoachNotes,
  sortCoachNotes,
  toggleCoachNotePin,
  updateCoachNote,
  weekNoteFor,
  writeCoachNotes,
} from '../coach-notes.engine';

const NOW = '2026-11-04T10:00:00.000Z';

describe('создание', () => {
  it('без заголовка и текста заметка не создаётся', () => {
    const r = addCoachNote(emptyCoachNotes(), { title: '  ', body: '\n' });
    expect(r.error).toBe('empty');
    expect(r.note).toBeNull();
    expect(r.store.items).toHaveLength(0);
  });

  it('заметка может быть только с текстом (без заголовка)', () => {
    const r = addCoachNote(emptyCoachNotes(), { body: 'Колено: не больше 100 кг' });
    expect(r.error).toBeNull();
    expect(r.note?.body).toContain('Колено');
    expect(r.note?.title).toBe('');
    expect(r.note?.pinned).toBe(false);
    expect(r.note?.athleteId).toBeNull();
  });

  it('новая заметка сверху, привязка к атлету сохраняется', () => {
    let s = addCoachNote(emptyCoachNotes(), { title: 'A' }, { id: 'n1', now: NOW }).store;
    s = addCoachNote(s, { title: 'B', athleteId: 'a1' }, { id: 'n2', now: NOW }).store;
    expect(s.items.map(n => n.id)).toEqual(['n2', 'n1']);
    expect(s.items[0].athleteId).toBe('a1');
    expect(countNotesForAthlete(s, 'a1')).toBe(1);
  });

  it(`лимит ${COACH_NOTES_MAX}: не вытесняем старые заметки, а отказываем`, () => {
    let s = emptyCoachNotes();
    for (let i = 0; i < COACH_NOTES_MAX; i++) {
      s = addCoachNote(s, { title: `N${i}` }, { id: `n${i}`, now: NOW }).store;
    }
    const r = addCoachNote(s, { title: 'Лишняя' }, { id: 'extra', now: NOW });
    expect(r.error).toBe('limit');
    expect(r.store).toBe(s);
    expect(r.store.items).toHaveLength(COACH_NOTES_MAX);
  });
});

describe('правка', () => {
  it('текст обновляется, пустая заметка не сохраняется', () => {
    const s = addCoachNote(emptyCoachNotes(), { title: 'A', body: 'old' }, { id: 'n1', now: NOW }).store;
    const upd = updateCoachNote(s, 'n1', { body: 'new' }, { now: NOW });
    expect(upd.items[0].body).toBe('new');
    expect(updateCoachNote(upd, 'n1', { title: '', body: '  ' }, { now: NOW })).toBe(upd);
  });

  it('неизвестный id — no-op', () => {
    const s = addCoachNote(emptyCoachNotes(), { title: 'A' }, { id: 'n1', now: NOW }).store;
    expect(updateCoachNote(s, 'nope', { title: 'X' })).toBe(s);
    expect(removeCoachNote(s, 'nope')).toBe(s);
    expect(toggleCoachNotePin(s, 'nope')).toBe(s);
  });

  it('удаление и закрепление', () => {
    let s = addCoachNote(emptyCoachNotes(), { title: 'A' }, { id: 'n1', now: NOW }).store;
    s = addCoachNote(s, { title: 'B' }, { id: 'n2', now: NOW }).store;
    s = toggleCoachNotePin(s, 'n1');
    expect(s.items.find(n => n.id === 'n1')?.pinned).toBe(true);
    s = removeCoachNote(s, 'n1');
    expect(s.items.map(n => n.id)).toEqual(['n2']);
  });
});

describe('сортилка и фильтры', () => {
  const store = (() => {
    let s = addCoachNote(emptyCoachNotes(), { title: 'Колено', body: 'не грузить', athleteId: 'a1' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
    s = addCoachNote(s, { title: 'Ферритин', body: 'пересдать после курса', pinned: true }, { id: 'n2', now: '2026-11-02T10:00:00.000Z' }).store;
    s = addCoachNote(s, { title: 'ОБЩАЯ', body: 'список снарядов', athleteId: 'a2' }, { id: 'n3', now: '2026-11-03T10:00:00.000Z' }).store;
    return s;
  })();

  it('закреплённые сверху, внутри — свежие сначала', () => {
    expect(sortCoachNotes(store.items).map(n => n.id)).toEqual(['n2', 'n3', 'n1']);
  });

  it('поиск регистронезависим и ищет в тексте, а не только в заголовке', () => {
    expect(filterCoachNotes(store, { query: 'ФЕРРИТИН' }).map(n => n.id)).toEqual(['n2']);
    expect(filterCoachNotes(store, { query: 'после курса' }).map(n => n.id)).toEqual(['n2']);
    expect(filterCoachNotes(store, { query: 'нет такого' })).toEqual([]);
  });

  it('фильтр по атлету и «только общие»', () => {
    expect(filterCoachNotes(store, { athleteId: 'a1' }).map(n => n.id)).toEqual(['n1']);
    expect(filterCoachNotes(store, { athleteId: 'none' }).map(n => n.id)).toEqual(['n2']);
  });
});

describe('хранение и терпимость', () => {
  it('roundtrip через хранилище', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const s = addCoachNote(emptyCoachNotes(), { title: 'A', body: 'B' }, { id: 'n1', now: NOW }).store;
    writeCoachNotes(storage, s);
    expect(readCoachNotes(storage).items[0].title).toBe('A');
    expect(readCoachNotes(null).items).toEqual([]);
  });

  it('битые данные не роняют: мусор отбрасывается, дубли — тоже', () => {
    expect(parseCoachNotes('{oops').items).toEqual([]);
    expect(parseCoachNotes(JSON.stringify({ version: 3, items: [] })).items).toEqual([]);
    const raw = JSON.stringify({
      version: 1,
      items: [
        { id: 'n1', title: 'A' },
        { id: 'n1', title: 'Дубль' },
        { id: 'n2' }, // нет ни заголовка, ни текста
        { title: 'Без id' },
        'мусор',
      ],
    });
    expect(parseCoachNotes(raw).items.map(n => n.title)).toEqual(['A']);
  });

  it('сериализация не теряет флаг закрепления', () => {
    const s = addCoachNote(emptyCoachNotes(), { title: 'A', pinned: true }, { id: 'n1', now: NOW }).store;
    expect(parseCoachNotes(serializeCoachNotes(s)).items[0].pinned).toBe(true);
  });
});
describe('комментарий к неделе', () => {
  it('заметка хранит неделю и находится по атлету+неделе', () => {
    const r = addCoachNote(
      emptyCoachNotes(),
      { body: 'Неделя тяжёлая: сон 6 ч', athleteId: 'a1', week: '2026-11-02' },
      { id: 'n1', now: NOW },
    );
    expect(r.note?.week).toBe('2026-11-02');
    expect(weekNoteFor(r.store, 'a1', '2026-11-02')?.id).toBe('n1');
    expect(weekNoteFor(r.store, 'a1', '2026-11-09')).toBeNull();
    expect(weekNoteFor(r.store, 'a2', '2026-11-02')).toBeNull();
  });

  it('неделя без атлета и мусор в неделе не создают ложную привязку', () => {
    const r = addCoachNote(emptyCoachNotes(), { body: 'общая', week: 'не дата' }, { id: 'n1', now: NOW });
    expect(r.note?.week).toBeNull();
    expect(weekNoteFor(r.store, '', '2026-11-02')).toBeNull();
  });

  it('старая заметка без поля week читается как «без недели»', () => {
    const legacy = JSON.stringify({
      version: 1,
      items: [{ id: 'n1', title: 'A', body: 'B', athleteId: 'a1', pinned: false, createdAt: NOW, updatedAt: NOW }],
    });
    const s = parseCoachNotes(legacy);
    expect(s.items[0].week).toBeNull();
    expect(weekNoteFor(s, 'a1', '2026-11-02')).toBeNull();
  });

  it('неделю можно снять патчем', () => {
    const s = addCoachNote(emptyCoachNotes(), { body: 'X', athleteId: 'a1', week: '2026-11-02' }, { id: 'n1', now: NOW }).store;
    const upd = updateCoachNote(s, 'n1', { week: null }, { now: NOW });
    expect(upd.items[0].week).toBeNull();
  });
});
