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
import {
  addCoachNote,
  emptyCoachNotes,
  readCoachNotes,
  writeCoachNotes,
  COACH_NOTE_ATTACHMENTS_MAX,
  COACH_NOTE_CHECKLIST_MAX,
} from '../../../../engines/coach/coach-notes.engine';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
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
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'Колено' },
    });
    fireEvent.change(container.querySelector('[data-notes="body"]') as HTMLTextAreaElement, {
      target: { value: 'Не грузить больше 100 кг' },
    });
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
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'Старое' },
    });
    save(container);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-notes="title"]') as HTMLInputElement, {
      target: { value: 'Новое' },
    });
    save(container);
    expect(readCoachNotes(localStorage).items[0].title).toBe('Новое');
    expect(container.querySelector('[data-notes="item"]')?.textContent).toContain('Новое');
  });
});

describe('поиск, закрепление, удаление', () => {
  const seed = () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      { title: 'Колено', body: 'не грузить', athleteId: 'a1' },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    s = addCoachNote(
      s,
      { title: 'Ферритин', body: 'пересдать после курса' },
      { id: 'n2', now: '2026-11-02T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
  };

  it('поиск фильтрует по тексту (не только по заголовку)', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    expect(items(container)).toHaveLength(2);
    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, {
      target: { value: 'после курса' },
    });
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Ферритин');
    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, {
      target: { value: 'ничего' },
    });
    expect(container.querySelector('[data-notes="empty"]')?.textContent).toContain('Ничего не найдено');
  });

  it('пустой результат честно объясняет, что именно скрыто, и даёт сброс', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, {
      target: { value: 'нет такого' },
    });
    const empty = container.querySelector('[data-notes="empty"]');
    expect(empty?.textContent).toContain('Поиск идёт по заголовку, тексту и пунктам чек-листа');
    expect(items(container)).toHaveLength(0);

    fireEvent.click(container.querySelector('[data-notes="empty-reset"]') as HTMLElement);
    expect(items(container)).toHaveLength(2);
    expect((container.querySelector('[data-notes="search"]') as HTMLInputElement).value).toBe('');
  });

  it('видно, сколько заметок скрыто фильтром, и сброс возвращает все', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="filter-status"]')).toBeNull();
    expect(container.querySelector('[data-notes="search-scope"]')?.textContent).toContain('имена файлов не ищутся');

    fireEvent.change(container.querySelector('[data-notes="search"]') as HTMLInputElement, {
      target: { value: 'Колено' },
    });
    expect(container.querySelector('[data-notes="filter-status"]')?.textContent).toContain('Показано 1 из 2');
    expect(container.querySelector('[data-notes="search-scope"]')).toBeNull();

    fireEvent.click(container.querySelector('[data-notes="filter-reset"]') as HTMLElement);
    expect(items(container)).toHaveLength(2);
    expect(container.querySelector('[data-notes="filter-status"]')).toBeNull();
  });

  it('закрепление поднимает заметку наверх и сохраняется', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    // n2 свежее — оно сверху; закрепляем n1
    const first = container.querySelector('[data-note-id="n1"]') as HTMLElement;
    fireEvent.click(first.querySelector('[data-notes="pin"]') as HTMLElement);
    expect(items(container)[0].getAttribute('data-note-id')).toBe('n1');
    expect(items(container)[0].getAttribute('data-pinned')).toBe('true');
    expect(readCoachNotes(localStorage).items.find((n) => n.id === 'n1')?.pinned).toBe(true);
  });

  it('удаление требует подтверждения', () => {
    seed();
    const { container } = render(<ProfileNotesTab />);
    const del = container.querySelector('[data-note-id="n2"] [data-notes="delete"]') as HTMLElement;
    fireEvent.click(del);
    expect(readCoachNotes(localStorage).items).toHaveLength(2);
    fireEvent.click(container.querySelector('[data-note-id="n2"] [data-notes="delete"]') as HTMLElement);
    expect(readCoachNotes(localStorage).items.map((n) => n.id)).toEqual(['n1']);
  });

  it('длинный текст в списке свёрнут и раскрывается по кнопке', () => {
    const body = `${'А'.repeat(400)}КОНЕЦ`;
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Длинная', body }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, s);

    const { container } = render(<ProfileNotesTab />);
    const preview = container.querySelector('[data-notes="body-preview"]') as HTMLElement;
    expect(preview.getAttribute('data-expanded')).toBe('false');
    expect(preview.textContent).not.toContain('КОНЕЦ');
    const more = container.querySelector('[data-notes="body-more"]') as HTMLElement;
    expect(more.textContent).toContain('Показать полностью');

    fireEvent.click(more);
    expect(preview.getAttribute('data-expanded')).toBe('true');
    expect(preview.textContent).toContain('КОНЕЦ');
    expect((container.querySelector('[data-notes="body-more"]') as HTMLElement).textContent).toContain('Свернуть');
  });

  it('короткий текст не прячется за кнопкой', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Короткая', body: 'Пара слов' }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="body-preview"]')?.textContent).toContain('Пара слов');
    expect(container.querySelector('[data-notes="body-more"]')).toBeNull();
  });

  it('заметка без заголовка не теряет длинный текст', () => {
    const body = `${'Б'.repeat(400)}ХВОСТ`;
    let s = emptyCoachNotes();
    s = addCoachNote(s, { body }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    const preview = container.querySelector('[data-notes="body-preview"]') as HTMLElement;
    expect(preview.textContent).not.toContain('ХВОСТ');
    fireEvent.click(container.querySelector('[data-notes="body-more"]') as HTMLElement);
    expect(preview.textContent).toContain('ХВОСТ');
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

  it('пришли из карточки атлета — фильтр уже стоит на нём', () => {
    let coach = setCoachEnabled(emptyCoachState(), true);
    coach = addCoachAthlete(coach, { name: 'Иван' }, { id: 'a1' }).state;
    coach = addCoachAthlete(coach, { name: 'Пётр' }, { id: 'a2' }).state;
    writeCoachState(localStorage, coach);
    let notes = emptyCoachNotes();
    notes = addCoachNote(notes, { title: 'Про Ивана', athleteId: 'a1' }, { id: 'n1' }).store;
    notes = addCoachNote(notes, { title: 'Про Петра', athleteId: 'a2' }, { id: 'n2' }).store;
    writeCoachNotes(localStorage, notes);

    const { container } = render(<ProfileNotesTab initialAthleteId="a2" />);
    expect((container.querySelector('[data-notes="filter"]') as HTMLSelectElement).value).toBe('a2');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].getAttribute('data-note-id')).toBe('n2');
  });

  it('удалённого атлета в фильтре не подставляем (показываем всё)', () => {
    let notes = emptyCoachNotes();
    notes = addCoachNote(notes, { title: 'A' }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, notes);
    const { container } = render(<ProfileNotesTab initialAthleteId="ghost" />);
    expect(items(container)).toHaveLength(1);
  });

  it('у атлета без заметок пустота объясняет фильтр, а не поиск', () => {
    let coach = setCoachEnabled(emptyCoachState(), true);
    coach = addCoachAthlete(coach, { name: 'Иван' }, { id: 'a1' }).state;
    coach = addCoachAthlete(coach, { name: 'Пётр' }, { id: 'a2' }).state;
    writeCoachState(localStorage, coach);
    let notes = emptyCoachNotes();
    notes = addCoachNote(notes, { title: 'Про Ивана', athleteId: 'a1' }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, notes);

    const { container } = render(<ProfileNotesTab />);
    fireEvent.change(container.querySelector('[data-notes="filter"]') as HTMLSelectElement, {
      target: { value: 'a2' },
    });
    expect(items(container)).toHaveLength(0);
    expect(container.querySelector('[data-notes="empty"]')?.textContent).toContain(
      'У выбранного атлета заметок пока нет',
    );
    expect(container.querySelector('[data-notes="filter-status"]')?.textContent).toContain('Показано 0 из 1');
    expect(container.querySelector('[data-notes="empty-reset"]')).not.toBeNull();
  });
});

describe('лимиты редактора', () => {
  it('при 100 пунктах чек-листа добавление выключено и объяснено', () => {
    const full = Array.from({ length: COACH_NOTE_CHECKLIST_MAX }, (_, i) => ({
      id: `c${i + 1}`,
      text: `Пункт ${i + 1}`,
      done: false,
    }));
    const notes = addCoachNote(emptyCoachNotes(), { title: 'Длинный', checklist: full }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, notes);

    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    expect(container.querySelector('[data-notes="checklist-count"]')?.textContent).toBe(
      `${COACH_NOTE_CHECKLIST_MAX}/${COACH_NOTE_CHECKLIST_MAX}`,
    );
    const add = container.querySelector('[data-notes="checklist-add"]') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(container.querySelector('[data-notes="checklist-limit"]')?.textContent).toContain('Достигнут лимит');
  });

  it('пустые строки чек-листа не считаются за лимит', () => {
    const notes = addCoachNote(emptyCoachNotes(), { title: 'Обычный' }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, notes);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    expect(container.querySelector('[data-notes="checklist-count"]')?.textContent).toBe(
      `0/${COACH_NOTE_CHECKLIST_MAX}`,
    );
    const add = container.querySelector('[data-notes="checklist-add"]') as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(container.querySelector('[data-notes="checklist-limit"]')).toBeNull();
    expect(add.disabled).toBe(false);
  });

  it('при 6 вложениях кнопки файлов выключены и объяснены', () => {
    const attachments = Array.from({ length: COACH_NOTE_ATTACHMENTS_MAX }, (_, i) => ({
      id: `a${i + 1}`,
      kind: 'photo' as const,
      mime: 'image/jpeg',
      size: 10,
      createdAt: '2026-11-17T09:00:00.000Z',
    }));
    const notes = addCoachNote(emptyCoachNotes(), { title: 'С файлами', attachments }, { id: 'n1' }).store;
    writeCoachNotes(localStorage, notes);

    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-notes="edit"]') as HTMLElement);
    for (const key of ['add-photo', 'add-voice', 'add-audio-file']) {
      expect((container.querySelector(`[data-notes="${key}"]`) as HTMLButtonElement).disabled).toBe(true);
    }
    // Диктовка добавляет текст, а не файл — она остаётся рабочей.
    expect((container.querySelector('[data-notes="dictate"]') as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector('[data-notes="attach-limit"]')?.textContent).toContain('Достигнут лимит');
  });
});
