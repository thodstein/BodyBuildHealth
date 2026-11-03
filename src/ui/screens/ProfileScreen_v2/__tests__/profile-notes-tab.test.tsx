/**
 * profile-notes-tab.test.tsx — UI заметок профиля.
 *
 * Обещания, которые проверяем: пустая заметка не создаётся (и объясняет почему),
 * заметка сохраняется и переживает перерендер, поиск ищет по тексту, закрепление
 * поднимает наверх, удаление — через подтверждение, привязка к атлету видна.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileNotesTab } from '../ProfileNotesTab';
import { addCoachNote, emptyCoachNotes, readCoachNotes, writeCoachNotes } from '../../../../engines/coach/coach-notes.engine';
import { addCoachAthlete, emptyCoachState, setCoachEnabled, writeCoachState } from '../../../../engines/coach/coach-mode.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const items = (c: HTMLElement): NodeListOf<HTMLElement> => c.querySelectorAll('[data-notes="item"]');

const openNew = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="new"]') as HTMLElement);
const save = (c: HTMLElement) => fireEvent.click(c.querySelector('[data-notes="save"]') as HTMLElement);

describe('создание заметки', () => {
  it('пустая заметка не создаётся — есть объяснение', () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    save(container);
    expect(container.querySelector('[data-notes="error"]')?.textContent).toContain('Пустая заметка');
    expect(items(container)).toHaveLength(0);
    expect(readCoachNotes(localStorage).items).toHaveLength(0);
  });

  it('заметка сохраняется, видна в списке и в хранилище', () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, { target: { value: 'Колено' } });
    fireEvent.change(container.querySelector('[data-notes="body"]') as HTMLTextAreaElement, { target: { value: 'Не грузить больше 100 кг' } });
    save(container);

    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Колено');
    expect(items(container)[0].textContent).toContain('Не грузить');
    const saved = readCoachNotes(localStorage);
    expect(saved.items[0]).toMatchObject({ title: 'Колено', body: 'Не грузить больше 100 кг', pinned: false });
    // редактор закрыт после сохранения
    expect(container.querySelector('[data-notes="editor"]')).toBeNull();
  });

  it('правка меняет текст заметки', () => {
    const { container } = render(<ProfileNotesTab />);
    openNew(container);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, { target: { value: 'Старое' } });
    save(container);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, { target: { value: 'Новое' } });
    save(container);
    expect(readCoachNotes(localStorage).items[0].title).toBe('Новое');
    expect(container.querySelector('[data-notes="item"]')?.textContent).toContain('Новое');
  });
});

describe('поиск, закрепление, удаление', () => {
  const seed = () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Колено', body: 'не грузить', athleteId: 'a1' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
    s = addCoachNote(s, { title: 'Ферритин', body: 'пересдать после курса' }, { id: 'n2', now: '2026-11-02T10:00:00.000Z' }).store;
    writeCoachNotes(localStorage, s);
  };

  it('поиск фильтрует по тексту (не только по заголовку)', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    expect(items(container)).toHaveLength(2);
    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, { target: { value: 'после курса' } });
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Ферритин');
    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, { target: { value: 'ничего' } });
    expect(container.querySelector('[data-notes="empty"]')?.textContent).toContain('ничего не найдено');
  });

  it('закрепление поднимает заметку наверх и сохраняется', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    // n2 свежее — оно сверху; закрепляем n1
    const first = container.querySelector('[data-note-id="n1"]') as HTMLElement;
    fireEvent.click(first.querySelector('[data-notes="pin"]') as HTMLElement);
    expect(items(container)[0].getAttribute('data-note-id')).toBe('n1');
    expect(items(container)[0].getAttribute('data-pinned')).toBe('true');
    expect(readCoachNotes(localStorage).items.find(n => n.id === 'n1')?.pinned).toBe(true);
  });

  it('удаление требует подтверждения', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    const del = container.querySelector('[data-note-id="n2"] [data-notes="delete"]') as HTMLElement;
    fireEvent.click(del);
    expect(readCoachNotes(localStorage).items).toHaveLength(2);
    fireEvent.click(container.querySelector('[data-note-id="n2"] [data-notes="delete"]') as HTMLElement);
    expect(readCoachNotes(localStorage).items.map(n => n.id)).toEqual(['n1']);
  });
});

describe('связь с атлетами', () => {
  it('фильтр по атлету и подпись имени в заметке', () => {
    let coach = setCoachEnabled(emptyCoachState(), true);
    coach = addCoachAthlete(coach, { name: 'Иван' }, { id: 'a1' }).state;
    writeCoachState(localStorage, coach);
    let notes = emptyCoachNotes();
    notes = addCoachNote(notes, { title: 'Про Ивана', athleteId: 'a1' }, { id: 'n1' }).store;
    notes = addCoachNote(notes, { title: 'Общая' }, { id: 'n2' }).store;
    writeCoachNotes(localStorage, notes);

    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-note-id="n1"]')?.textContent).toContain('Иван');
    const filter = container.querySelector('[data-notes="filter"]') as HTMLSelectElement;
    expect(filter).not.toBeNull();
    fireEvent.change(filter, { target: { value: 'none' } });
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].getAttribute('data-note-id')).toBe('n2');
  });

  it('без атлетов фильтр по атлету не показывается (не пустой селект-обманка)', () => {
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="filter"]')).toBeNull();
  });
});
