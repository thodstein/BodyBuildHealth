/**
 * coach-notes-checklist.test.ts — чек-листы заметок (TickTick-подобные).
 */
import { describe, expect, it } from 'vitest';
import {
  addCoachNote,
  emptyCoachNotes,
  noteChecklistProgress,
  readCoachNotes,
  toggleNoteChecklistItem,
  updateCoachNote,
} from '../coach-notes.engine';

const NOW = '2026-11-04T10:00:00.000Z';

describe('чек-лист заметки', () => {
  it('создаётся, читается и не теряется при правке текста', () => {
    const r = addCoachNote(
      emptyCoachNotes(),
      {
        title: 'Подготовка к анализам',
        body: 'Натощак',
        checklist: [
          { id: 'c1', text: 'Не есть 8 часов', done: true },
          { id: 'c2', text: 'Взять направление', done: false },
        ],
      },
      { id: 'n1', now: NOW },
    );
    expect(r.note?.checklist).toHaveLength(2);
    expect(noteChecklistProgress(r.note!)).toEqual({ done: 1, total: 2 });

    // Правка заголовка не должна стирать чек-лист.
    const edited = updateCoachNote(r.store, 'n1', { title: 'Анализы' }, { now: NOW });
    expect(noteChecklistProgress(edited.items[0])).toEqual({ done: 1, total: 2 });
  });

  it('пункт можно отметить и снять', () => {
    const r = addCoachNote(
      emptyCoachNotes(),
      { title: 'X', checklist: [{ id: 'c1', text: 'Шаг', done: false }] },
      { id: 'n1', now: NOW },
    );
    const done = toggleNoteChecklistItem(r.store, 'n1', 'c1', { now: NOW });
    expect(done.items[0].checklist?.[0].done).toBe(true);
    const undone = toggleNoteChecklistItem(done, 'n1', 'c1', { now: NOW });
    expect(undone.items[0].checklist?.[0].done).toBe(false);
  });

  it('пустые пункты выбрасываются, битый JSON не роняет чтение', () => {
    const r = addCoachNote(
      emptyCoachNotes(),
      { title: 'X', checklist: [{ id: 'c1', text: '  ', done: false }, { id: 'c2', text: 'Норма', done: false }] },
      { id: 'n1', now: NOW },
    );
    expect(r.note?.checklist).toHaveLength(1);
    localStorage.setItem('he_coach_notes', '{битый json');
    expect(readCoachNotes(localStorage).items).toEqual([]);
  });
});
