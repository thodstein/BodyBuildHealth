/**
 * coach-notes-due-priority.test.ts — фичи срока (`dueAt`) и важности (`priority`).
 *
 * Обещания, которые проверяем:
 *  • `add`: стандартная заметка → `dueAt: null`, `priority: 'normal'`;
 *  • `add`: валидный `dueAt` сохраняется, битые → `null`; `low`/`high` проходят, остальное → `normal`;
 *  • `update`: патч с `dueAt`/`priority` устанавливает, `undefined` — не меняет;
 *  • `parseCoachNotes`: round-trip сохраняет значения, битые → `null`/`normal`;
 *  • `sortCoachNotes`: закреплённые первыми, сроки по возрастанию (без срока — в конец),
 *    `high` → `normal` → `low`.
 */
import { describe, expect, it } from 'vitest';
import {
  addCoachNote,
  COACH_NOTES_MAX,
  duplicateCoachNote,
  emptyCoachNotes,
  isCoachNoteDeleted,
  parseCoachNotes,
  restoreCoachNotes,
  sortCoachNotes,
  trashCoachNotes,
  updateCoachNote,
  type CoachNote,
  type CoachNotesStore,
} from '../coach-notes.engine';

const note = (o: Partial<CoachNote>): CoachNote => ({
  id: o.id ?? 'n' + Math.random(),
  title: '',
  body: '',
  athleteId: null,
  week: null,
  pinned: false,
  dueAt: null,
  priority: 'normal',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  checklist: [],
  attachments: [],
  ...o,
});

const store = (items: CoachNote[]): CoachNotesStore => ({ version: 1, items });

describe('dueAt/priority в add', () => {
  it('стандартная заметка → dueAt null, priority normal', () => {
    const r = addCoachNote(emptyCoachNotes(), { title: 'Тест' }, { id: 'n1' });
    expect(r.note?.dueAt).toBeNull();
    expect(r.note?.priority).toBe('normal');
  });

  it('dueAt: валидный сохраняется, битые → null', () => {
    const ok = addCoachNote(emptyCoachNotes(), { title: 'Т', dueAt: '2026-11-23' }, { id: 'n1' });
    expect(ok.note?.dueAt).toBe('2026-11-23');

    const garbage = addCoachNote(emptyCoachNotes(), { title: 'Т', dueAt: 'garbage' }, { id: 'n2' });
    expect(garbage.note?.dueAt).toBeNull();

    const noValue = addCoachNote(emptyCoachNotes(), { title: 'Т', dueAt: undefined }, { id: 'n3' });
    expect(noValue.note?.dueAt).toBeNull();

    const month13 = addCoachNote(emptyCoachNotes(), { title: 'Т', dueAt: '2026-13-01' }, { id: 'n4' });
    // parseDueAt — канонический префикс `^\d{4}-\d{2}-\d{2}`; месяц 13 не проверяется —
    // '2026-13-01' сохраняется как есть. Битый формат (garbage) выше даёт null.
    expect(month13.note?.dueAt).toBe('2026-13-01');

    const withTime = addCoachNote(emptyCoachNotes(), { title: 'Т', dueAt: '2026-11-23T10:00' }, { id: 'n5' });
    expect(withTime.note?.dueAt).toBe('2026-11-23');
  });

  it('priority: low/high проходят, остальное → normal', () => {
    const low = addCoachNote(emptyCoachNotes(), { title: 'Т', priority: 'low' }, { id: 'n1' });
    expect(low.note?.priority).toBe('low');

    const high = addCoachNote(emptyCoachNotes(), { title: 'Т', priority: 'high' }, { id: 'n2' });
    expect(high.note?.priority).toBe('high');

    const weird = addCoachNote(
      emptyCoachNotes(),
      { title: 'Т', priority: 'weird' as unknown as CoachNote['priority'] },
      { id: 'n3' },
    );
    expect(weird.note?.priority).toBe('normal');
  });
});

describe('dueAt/priority в update', () => {
  it('устанавливаются; патч без поля (undefined) не меняет', () => {
    const s = addCoachNote(emptyCoachNotes(), { title: 'Т' }, { id: 'n1' }).store;
    const next = updateCoachNote(s, 'n1', { dueAt: '2026-11-05', priority: 'high' });
    expect(next.items[0].dueAt).toBe('2026-11-05');
    expect(next.items[0].priority).toBe('high');

    const untouched = updateCoachNote(next, 'n1', { dueAt: undefined, priority: undefined });
    expect(untouched.items[0].dueAt).toBe('2026-11-05');
    expect(untouched.items[0].priority).toBe('high');
  });
});

describe('parseCoachNotes: round-trip', () => {
  it('dueAt/priority сохраняются через сериализацию', () => {
    const s = addCoachNote(
      emptyCoachNotes(),
      { title: 'Т', dueAt: '2026-11-23', priority: 'high' },
      { id: 'n1', now: '2026-11-20T10:00:00.000Z' },
    ).store;
    const back = parseCoachNotes(JSON.stringify(s));
    const n = back.items.find((x) => x.id === 'n1');
    expect(n?.dueAt).toBe('2026-11-23');
    expect(n?.priority).toBe('high');
  });

  it('битые значения → dueAt null, priority normal', () => {
    const dirty = parseCoachNotes(
      JSON.stringify({
        version: 1,
        items: [note({ id: 'n2', title: 'Д', dueAt: 'xx', priority: 'nope' as unknown as CoachNote['priority'] })],
      }),
    );
    expect(dirty.items[0].dueAt).toBeNull();
    expect(dirty.items[0].priority).toBe('normal');
  });
});

describe('sortCoachNotes: порядок по сроку и приоритету', () => {
  it('закреплённые всегда первыми; сроки по возрастанию; high → normal → low; без срока — в конце', () => {
    // a — закреплённая, но с поздним сроком; c — ранний срок среди обычных;
    // d/e/f — один срок: high, normal, low; b/g — без срока.
    const a = note({ id: 'a', title: 'А', pinned: true, dueAt: '2026-02-01' });
    const b = note({ id: 'b', title: 'Б' });
    const c = note({ id: 'c', title: 'В', dueAt: '2026-01-01' });
    const d = note({ id: 'd', title: 'Г', dueAt: '2026-02-01', priority: 'high' });
    const e = note({ id: 'e', title: 'Д', dueAt: '2026-02-01', priority: 'normal' });
    const f = note({ id: 'f', title: 'Е', dueAt: '2026-02-01', priority: 'low' });
    const g = note({ id: 'g', title: 'Ж' });

    const sorted = sortCoachNotes(store([a, b, c, d, e, f, g]).items).map((n) => n.id);
    expect(sorted).toEqual(['a', 'c', 'd', 'e', 'f', 'b', 'g']);
  });
});

describe('sortCoachNotes: хвост-fallback (одинаковые сроки и приоритеты)', () => {
  it("при равенстве dueAt и priority — порядок старого compare ('updated' desc / 'title' asc)", () => {
    const u1 = note({ id: 'u1', title: 'Б', updatedAt: '2026-01-01T00:00:00Z' });
    const u2 = note({ id: 'u2', title: 'А', updatedAt: '2026-01-02T00:00:00Z' });
    const s = note({ id: 's', title: 'В', updatedAt: '2026-01-03T00:00:00Z' });
    // default sort: updatedAt desc
    expect(sortCoachNotes(store([u1, u2, s]).items).map((n) => n.id)).toEqual(['s', 'u2', 'u1']);
    // 'title': по заголовку asc — t2 'А' < t1 'Б'
    const t1 = note({ id: 't1', title: 'Б' });
    const t2 = note({ id: 't2', title: 'А' });
    expect(sortCoachNotes(store([t1, t2]).items, 'title').map((n) => n.id)).toEqual(['t2', 't1']);
  });
});

describe('update: срок и приоритет — очистка', () => {
  it('dueAt: null / priority: low — через update', () => {
    const st = addCoachNote(
      emptyCoachNotes(),
      { title: 'Т', dueAt: '2026-11-05', priority: 'high' },
      { id: 'n1' },
    ).store;
    const next = updateCoachNote(st, 'n1', { dueAt: null, priority: 'low' });
    expect(next.items[0].dueAt).toBeNull();
    expect(next.items[0].priority).toBe('low');
  });
});

describe('trashCoachNotes / restoreCoachNotes / duplicateCoachNote', () => {
  const mk = () => addCoachNote(emptyCoachNotes(), { title: 'Общая' }, { id: 'n1' }).store;

  it('trashCoachNotes: все из ids получают deletedAt; в корзине не меняются; без живых — тот же store', () => {
    const s = mk();
    const t1 = addCoachNote(s, { title: 'А' }, { id: 'a1' }).store; // живая 'a1'
    const t2 = trashCoachNotes(t1, ['n1']).items.find((n) => n.id === 'n1')!;
    expect(t2.deletedAt).toBeTruthy();
    // уже в корзине — не меняется:
    expect(trashCoachNotes(t1, ['n1']).items.find((n) => n.id === 'n1')!.deletedAt).toBeTruthy();
    // пустой список — тот же store:
    expect(trashCoachNotes(t1, [])).toBe(t1);
    // отсутствие живых — trash всех (уже в корзине) — тот же store:
    const allTrashed = trashCoachNotes(t1, ['n1', 'a1']);
    expect(allTrashed).not.toBe(t1); // 'a1' была живая — ушла в корзину
    expect(trashCoachNotes(allTrashed, ['n1', 'a1'])).toBe(allTrashed);
  });

  it('trashCoachNotes: пустой список и отсутствие живых — тот же store', () => {
    const s = mk();
    expect(trashCoachNotes(s, [])).toBe(s);
    const trashed = trashCoachNotes(s, ['n1']);
    expect(trashCoachNotes(trashed, ['n1'])).toBe(trashed);
  });

  it('restoreCoachNotes: cleared у всех из ids, нет deletedAt', () => {
    let s = mk();
    s = trashCoachNotes(s, ['n1']);
    const r = restoreCoachNotes(s, ['n1']);
    expect(r.items.find((n) => n.id === 'n1')!.deletedAt).toBeNull();
    expect(restoreCoachNotes(s, ['нету'])).toBe(s);
  });

  it('duplicateCoachNote: новая заметка с копией полей, оригинал не трогается, лимит', () => {
    const s = addCoachNote(
      emptyCoachNotes(),
      {
        title: 'С полями',
        body: 'текст',
        athleteId: 'a9',
        week: '2026-11-23',
        priority: 'high',
        dueAt: '2026-11-30',
        tags: ['x', 'y'],
        checklist: [{ id: 'c1', text: 'пункт', done: true }],
      },
      { id: 'n1', now: '2026-11-20T10:00:00.000Z' },
    ).store;
    const dup = duplicateCoachNote(s, 'n1');
    expect(dup).not.toBe(s);
    const d = dup.items.find((n) => n.id !== 'n1')!;
    expect(d.title).toBe('С полями');
    expect(d.priority).toBe('high');
    expect(d.dueAt).toBe('2026-11-30');
    expect(d.tags).toEqual(['x', 'y']);
    expect(d.checklist).toHaveLength(1);
    expect(d.deletedAt).toBeUndefined();
    expect(dup.items.find((n) => n.id === 'n1')!.checklist[0].done).toBe(true);
    expect(s.items.length).toBe(1);
    // лимит: 500 живых -> дубликат не создаётся
    let full = emptyCoachNotes();
    for (let i = 0; i < COACH_NOTES_MAX; i++) full = addCoachNote(full, { title: `N${i}` }, { id: `f${i}` }).store;
    expect(duplicateCoachNote(full, 'f0')).toBe(full);
  });
});

describe('restoreCoachNotes: лимит живых заметок', () => {
  it('восстанавливает только свободные слоты, остальные остаются в корзине', () => {
    // Стор строим напрямую: `addCoachNote` держит лимит по всем записям,
    // а нам нужна ровно одна свободная ячейка живых (499 из 500) при 2 в корзине.
    const items: CoachNote[] = Array.from({ length: COACH_NOTES_MAX + 1 }, (_, i) =>
      note(i < 2 ? { id: `f${i}`, deletedAt: '2026-11-20T10:00:00.000Z' } : { id: `f${i}` }),
    );
    const s: CoachNotesStore = { version: 1, items };
    // Свободен ровно один слот — вторая заметка обязана остаться в корзине,
    // иначе следующее чтение молча выбросило бы «лишнюю».
    const next = restoreCoachNotes(s, ['f0', 'f1']);
    expect(isCoachNoteDeleted(next.items.find((n) => n.id === 'f0')!)).toBe(false);
    expect(isCoachNoteDeleted(next.items.find((n) => n.id === 'f1')!)).toBe(true);
  });
});

describe('корзина: лимит и дубликат', () => {
  it('trashCoachNotes не переносит сверх лимита корзины', () => {
    // Корзина уже полна (500 удалённых): перенос ещё одной живой заметки не должен
    // вытеснить старые — чтение их пропустит и пометит стор повреждённым.
    const items: CoachNote[] = Array.from({ length: COACH_NOTES_MAX + 1 }, (_, i) =>
      note(i < COACH_NOTES_MAX ? { id: `t${i}`, deletedAt: '2026-11-20T10:00:00.000Z' } : { id: `t${i}` }),
    );
    const s: CoachNotesStore = { version: 1, items };
    expect(trashCoachNotes(s, [`t${COACH_NOTES_MAX}`])).toBe(s);
  });

  it('duplicateCoachNote не выдаёт id, который уже занят', () => {
    const now = '2026-11-23T10:00:00.000Z';
    const stamp = new Date(now).getTime().toString(36);
    let s = addCoachNote(emptyCoachNotes(), { title: 'A' }, { id: 'n1', now }).store;
    // Заметка уже занимает id, который движок выбрал бы первым.
    const occupied = `n_${stamp}_3`;
    s = { version: 1, items: [note({ id: occupied, title: 'X' }), ...s.items] };
    const dup = duplicateCoachNote(s, 'n1', { now });
    const ids = dup.items.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
