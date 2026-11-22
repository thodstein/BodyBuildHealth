/**
 * coach-notes-ticktick.test.ts — расширения заметок «как в TickTick»:
 * теги, корзина, лимит живых заметок, фильтры и сортировка.
 *
 * Ключевое:
 *  • теги терпимы к мусору: `#`, пробелы, регистр, лимиты;
 *  • корзина обратима (trash → restore → purge) и не выедает лимит живых,
 *    не попадает в поиск/неделю/счётчики;
 *  • закреплённые всегда сверху при любой сортировке;
 *  • сериализация сохраняет теги и `deletedAt`.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_NOTES_MAX,
  COACH_NOTE_TAGS_MAX,
  COACH_NOTE_TAG_MAX,
  addCoachNote,
  collectCoachNoteTags,
  countLiveCoachNotes,
  countNotesForAthlete,
  emptyCoachNotes,
  filterCoachNotes,
  isCoachNoteDeleted,
  normalizeNoteTags,
  noteTags,
  parseCoachNotes,
  purgeCoachNote,
  purgeCoachTrash,
  restoreCoachNote,
  serializeCoachNotes,
  sortCoachNotes,
  toggleNoteChecklistItem,
  trashCoachNote,
  updateCoachNote,
  weekNoteFor,
  type CoachNotesStore,
} from '../coach-notes.engine';

const NOW = '2026-11-04T10:00:00.000Z';

/** Три заметки: закреплённая (n2) и две обычные (n3 свежее n1). */
const storeWith = (): CoachNotesStore => {
  let s = addCoachNote(
    emptyCoachNotes(),
    { title: 'Колено', body: 'не грузить больше 100', athleteId: 'a1', tags: ['#Здоровье', 'зал'] },
    { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
  ).store;
  s = addCoachNote(
    s,
    { title: 'Ферритин', body: 'пересдать после курса', pinned: true, tags: ['здоровье'] },
    { id: 'n2', now: '2026-11-02T10:00:00.000Z' },
  ).store;
  s = addCoachNote(
    s,
    { title: 'Снаряды', body: 'список зала', athleteId: 'a2', tags: ['зал', 'инвентарь'] },
    { id: 'n3', now: '2026-11-03T10:00:00.000Z' },
  ).store;
  return s;
};

describe('теги', () => {
  it('снимает #, обрезает пробелы, дедуп без учёта регистра сохраняет первое написание', () => {
    expect(normalizeNoteTags(['#Здоровье', ' здоровье ', 'зал', '', null])).toEqual(['Здоровье', 'зал']);
    // `#` после пробела тоже снимается — иначе панель тегов и редактор разойдутся.
    expect(normalizeNoteTags([' #тег'])).toEqual(['тег']);
  });

  it(`не больше ${COACH_NOTE_TAGS_MAX} тегов, длина тега не больше ${COACH_NOTE_TAG_MAX}`, () => {
    const many = Array.from({ length: COACH_NOTE_TAGS_MAX + 5 }, (_, i) => `#tag${i}`);
    expect(normalizeNoteTags(many)).toHaveLength(COACH_NOTE_TAGS_MAX);
    expect(normalizeNoteTags(many)[0]).toBe('tag0');
    expect(normalizeNoteTags(['х'.repeat(COACH_NOTE_TAG_MAX + 10)])[0]).toHaveLength(COACH_NOTE_TAG_MAX);
  });

  it('add/update сохраняют теги, старая заметка без поля читается как пустой список', () => {
    const r = addCoachNote(emptyCoachNotes(), { title: 'A', tags: ['#колено', 'ЗАЛ'] }, { id: 'n1', now: NOW });
    expect(noteTags(r.note!)).toEqual(['колено', 'ЗАЛ']);

    const upd = updateCoachNote(r.store, 'n1', { tags: ['#Здоровье', 'здоровье'] }, { now: NOW });
    expect(noteTags(upd.items[0])).toEqual(['Здоровье']);

    const legacy = parseCoachNotes(
      JSON.stringify({ version: 1, items: [{ id: 'n1', title: 'A', createdAt: NOW, updatedAt: NOW }] }),
    );
    expect(noteTags(legacy.items[0])).toEqual([]);
  });
});

describe('корзина', () => {
  it('trashCoachNote ставит deletedAt, не трогает теги/вложения, повтор и чужой id — no-op', () => {
    const s = addCoachNote(
      emptyCoachNotes(),
      {
        title: 'A',
        body: 'B',
        athleteId: 'a1',
        tags: ['зал'],
        attachments: [{ id: 'a1', kind: 'photo', mime: 'image/png', size: 10, createdAt: NOW }],
      },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    const trashed = trashCoachNote(s, 'n1', { now: NOW });
    const note = trashed.items[0];
    expect(note.deletedAt).toBe(NOW);
    expect(isCoachNoteDeleted(note)).toBe(true);
    expect(note.title).toBe('A');
    expect(note.athleteId).toBe('a1');
    expect(note.tags).toEqual(['зал']);
    expect(note.attachments).toHaveLength(1);
    expect(trashCoachNote(trashed, 'n1', { now: '2026-11-05T10:00:00.000Z' })).toBe(trashed);
    expect(trashCoachNote(s, 'nope')).toBe(s);
  });

  it('restoreCoachNote очищает deletedAt; живая заметка и чужой id — no-op', () => {
    let s = storeWith();
    s = trashCoachNote(s, 'n1', { now: NOW });
    s = restoreCoachNote(s, 'n1');
    const back = s.items.find((n) => n.id === 'n1')!;
    expect(isCoachNoteDeleted(back)).toBe(false);
    expect(back.deletedAt).toBeNull();
    expect(restoreCoachNote(s, 'n1')).toBe(s);
    expect(restoreCoachNote(s, 'nope')).toBe(s);
  });

  it('purgeCoachNote удаляет одну, purgeCoachTrash — всю корзину, живые остаются', () => {
    let s = storeWith(); // [n3, n2, n1]
    s = trashCoachNote(s, 'n1', { now: NOW });
    s = trashCoachNote(s, 'n3', { now: NOW });

    const one = purgeCoachNote(s, 'n1');
    expect(one.items.map((n) => n.id)).toEqual(['n3', 'n2']);
    expect(purgeCoachNote(s, 'nope')).toBe(s);

    const clean = purgeCoachTrash(s);
    expect(clean.items.map((n) => n.id)).toEqual(['n2']);
    expect(purgeCoachTrash(clean)).toBe(clean);
  });

  it('корзина read-only: правка и чек-лист трэшнутой заметки не проходят', () => {
    let s = addCoachNote(
      emptyCoachNotes(),
      { title: 'A', checklist: [{ id: 'c1', text: 'пункт', done: false }] },
      { id: 'n1', now: NOW },
    ).store;
    s = trashCoachNote(s, 'n1', { now: NOW });
    expect(updateCoachNote(s, 'n1', { title: 'B' })).toBe(s);
    expect(toggleNoteChecklistItem(s, 'n1', 'c1')).toBe(s);
  });

  it('по умолчанию корзина скрыта, deleted: true — только она, includeDeleted — всё', () => {
    let s = storeWith();
    s = trashCoachNote(s, 'n2', { now: NOW });
    expect(filterCoachNotes(s).map((n) => n.id)).toEqual(['n3', 'n1']);
    expect(filterCoachNotes(s, { deleted: true }).map((n) => n.id)).toEqual(['n2']);
    expect(filterCoachNotes(s, { includeDeleted: true }).map((n) => n.id)).toEqual(['n2', 'n3', 'n1']);
    expect(filterCoachNotes(s, { query: 'ферритин' })).toEqual([]);
  });
});

describe('фильтры и сортировка', () => {
  it('тег фильтруется без учёта регистра, поиск идёт по заголовку, тексту и тегам', () => {
    const s = storeWith();
    expect(filterCoachNotes(s, { tag: 'ЗДОРОВЬЕ' }).map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(filterCoachNotes(s, { query: 'ФЕРРИТИН' }).map((n) => n.id)).toEqual(['n2']);
    expect(filterCoachNotes(s, { query: 'после курса' }).map((n) => n.id)).toEqual(['n2']);
    expect(filterCoachNotes(s, { query: 'инвентарь' }).map((n) => n.id)).toEqual(['n3']);
  });

  it('updated (по умолчанию) и created: закреплённые сверху, свежие выше', () => {
    let s = storeWith();
    s = updateCoachNote(s, 'n1', { body: 'не грузить больше 90' }, { now: NOW });
    expect(sortCoachNotes(s.items).map((n) => n.id)).toEqual(['n2', 'n1', 'n3']);
    expect(sortCoachNotes(s.items, 'updated').map((n) => n.id)).toEqual(['n2', 'n1', 'n3']);
    expect(sortCoachNotes(s.items, 'created').map((n) => n.id)).toEqual(['n2', 'n3', 'n1']);
  });

  it('collectCoachNoteTags считает без учёта регистра и по умолчанию не видит корзину', () => {
    let s = storeWith();
    expect(collectCoachNoteTags(s)).toEqual([
      { tag: 'зал', count: 2 },
      { tag: 'здоровье', count: 2 },
      { tag: 'инвентарь', count: 1 },
    ]);
    s = trashCoachNote(s, 'n2', { now: NOW });
    expect(collectCoachNoteTags(s)).toEqual([
      { tag: 'зал', count: 2 },
      { tag: 'Здоровье', count: 1 },
      { tag: 'инвентарь', count: 1 },
    ]);
    expect(collectCoachNoteTags(s, { includeDeleted: true }).find((t) => t.tag === 'здоровье')?.count).toBe(2);
  });

  it('title — по алфавиту (русская локаль), закреплённые всё равно сверху', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Яблоко', pinned: true }, { id: 'p', now: NOW }).store;
    s = addCoachNote(s, { title: 'Банан' }, { id: 'b', now: NOW }).store;
    s = addCoachNote(s, { title: 'Абрикос' }, { id: 'a', now: NOW }).store;
    expect(sortCoachNotes(s.items, 'title').map((n) => n.title)).toEqual(['Яблоко', 'Абрикос', 'Банан']);
    expect(filterCoachNotes(s, { sort: 'title' }).map((n) => n.title)).toEqual(['Яблоко', 'Абрикос', 'Банан']);
  });

  it('заметка без заголовка в title-сортировке идёт по тексту, а не выше «А»', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { body: 'Яблоко в тексте' }, { id: 'body-only', now: NOW }).store;
    s = addCoachNote(s, { title: 'Абрикос' }, { id: 'a', now: NOW }).store;
    expect(sortCoachNotes(s.items, 'title').map((n) => n.id)).toEqual(['a', 'body-only']);
  });
});

describe('лимит живых заметок', () => {
  it('корзина не выедает лимит: max-1 живых + 1 в корзине → добавить можно', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'В корзине' }, { id: 't0', now: NOW }).store;
    s = trashCoachNote(s, 't0', { now: NOW });
    for (let i = 0; i < COACH_NOTES_MAX - 1; i++) {
      s = addCoachNote(s, { title: `N${i}` }, { id: `n${i}`, now: NOW }).store;
    }
    expect(countLiveCoachNotes(s)).toBe(COACH_NOTES_MAX - 1);
    const r = addCoachNote(s, { title: 'Ещё' }, { id: 'extra', now: NOW });
    expect(r.error).toBeNull();
    expect(countLiveCoachNotes(r.store)).toBe(COACH_NOTES_MAX);
  });

  it(`${COACH_NOTES_MAX} живых + корзина → ошибка limit, старые не вытесняются`, () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'В корзине' }, { id: 't0', now: NOW }).store;
    s = trashCoachNote(s, 't0', { now: NOW });
    for (let i = 0; i < COACH_NOTES_MAX; i++) {
      s = addCoachNote(s, { title: `N${i}` }, { id: `n${i}`, now: NOW }).store;
    }
    const r = addCoachNote(s, { title: 'Лишняя' }, { id: 'extra', now: NOW });
    expect(r.error).toBe('limit');
    expect(r.store).toBe(s);
    expect(r.store.items).toHaveLength(COACH_NOTES_MAX + 1);
  });

  it('countNotesForAthlete и weekNoteFor корзину не видят', () => {
    let s = addCoachNote(
      emptyCoachNotes(),
      { body: 'Неделя тяжёлая', athleteId: 'a1', week: '2026-11-02' },
      { id: 'n1', now: NOW },
    ).store;
    expect(countNotesForAthlete(s, 'a1')).toBe(1);
    expect(weekNoteFor(s, 'a1', '2026-11-02')?.id).toBe('n1');

    s = trashCoachNote(s, 'n1', { now: NOW });
    expect(countNotesForAthlete(s, 'a1')).toBe(0);
    expect(weekNoteFor(s, 'a1', '2026-11-02')).toBeNull();
    expect(countLiveCoachNotes(s)).toBe(0);
  });

  it('на лимите живых восстановление из корзины не проходит (иначе чтение потеряло бы заметку)', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'В корзине' }, { id: 't0', now: NOW }).store;
    s = trashCoachNote(s, 't0', { now: NOW });
    for (let i = 0; i < COACH_NOTES_MAX; i++) {
      s = addCoachNote(s, { title: `N${i}` }, { id: `n${i}`, now: NOW }).store;
    }
    expect(countLiveCoachNotes(s)).toBe(COACH_NOTES_MAX);
    // Восстанавливать некуда: движок не превышает лимит и не теряет данные.
    expect(restoreCoachNote(s, 't0')).toBe(s);
    // Освободили живое место (в корзину) — возврат снова работает.
    s = trashCoachNote(s, 'n0', { now: NOW });
    const back = restoreCoachNote(s, 't0');
    expect(countLiveCoachNotes(back)).toBe(COACH_NOTES_MAX);
    expect(isCoachNoteDeleted(back.items.find((n) => n.id === 't0')!)).toBe(false);
  });

  it('переполненная корзина при чтении не обрезает живые заметки', () => {
    const items: Array<Record<string, unknown>> = [];
    // Сначала две порции корзины (вторая — сверх лимита), затем живые:
    // раньше чтение обрывалось на 1000-й строке и живые терялись.
    for (let i = 0; i < COACH_NOTES_MAX; i++) items.push({ id: `t${i}`, title: `T${i}`, deletedAt: NOW });
    for (let i = 0; i < COACH_NOTES_MAX; i++) items.push({ id: `d${i}`, title: `D${i}`, deletedAt: NOW });
    for (let i = 0; i < COACH_NOTES_MAX; i++) items.push({ id: `n${i}`, title: `N${i}` });

    const s = parseCoachNotes(JSON.stringify({ version: 1, items }));
    expect(countLiveCoachNotes(s)).toBe(COACH_NOTES_MAX);
    expect(s.items.filter((n) => isCoachNoteDeleted(n))).toHaveLength(COACH_NOTES_MAX);
  });
});

describe('хранение', () => {
  it('roundtrip сохраняет теги и deletedAt', () => {
    let s = storeWith();
    s = trashCoachNote(s, 'n1', { now: NOW });
    const parsed = parseCoachNotes(serializeCoachNotes(s));
    const trashed = parsed.items.find((n) => n.id === 'n1')!;
    expect(noteTags(trashed)).toEqual(['Здоровье', 'зал']);
    expect(trashed.deletedAt).toBe(NOW);
    expect(isCoachNoteDeleted(trashed)).toBe(true);
    expect(noteTags(parsed.items.find((n) => n.id === 'n3')!)).toEqual(['зал', 'инвентарь']);
  });

  it(`parseCoachNotes не даёт корзине выесть лимит ${COACH_NOTES_MAX} живых`, () => {
    const items: Array<Record<string, unknown>> = Array.from({ length: COACH_NOTES_MAX }, (_, i) => ({
      id: `n${i}`,
      title: `N${i}`,
    }));
    items.push({ id: 'trash', title: 'В корзине', deletedAt: NOW });
    const s = parseCoachNotes(JSON.stringify({ version: 1, items }));
    expect(s.items).toHaveLength(COACH_NOTES_MAX + 1);
    expect(countLiveCoachNotes(s)).toBe(COACH_NOTES_MAX);
    expect(s.items.find((n) => n.id === 'trash')?.deletedAt).toBe(NOW);
  });
});
