/**
 * profile-notes-due-priority.test.tsx — срок (`dueAt`) и приоритет (`priority`)
 * в заметках профиля.
 *
 * Обещания, которые проверяем (по мотивам profile-notes-tab.test.tsx):
 *  • редактор открывается по клику «Изменить» и показывает поле срока
 *    (`[data-notes="due"]`, тип INPUT с `type="date"`) и 3 кнопки приоритета
 *    (`[data-notes="priority-row"] [data-notes="priority"]` с `data-priority`
 *    low/normal/high) с выставленными значениями;
 *  • сохранение из редактора (due + high, клик «Сохранить») запоминает
 *    `dueAt`/`priority` в хранилище;
 *  • в списке заметка со сроком показывает «До …», а `priority: 'high'` — звездку;
 *  • кнопки `attach-swap` в редакторе меняют порядок вложений;
 *  • кнопка «Поделиться» заметкой (`share-note`) меняет DOM-статус
 *    (`share-status`) — `copyOrShareText` в jsdom возвращает «failed».
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileNotesTab } from '../ProfileNotesTab';
import {
  addCoachNote,
  emptyCoachNotes,
  readCoachNotesResult,
  writeCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';

/** Тот же формат, что показывает компонент (`fmtDate` в нём не экспортный). */
const fmtDate = (iso: string): string => {
  // Календарный день — локально: `new Date('2026-11-23')` даёт UTC-полночь.
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dayOnly ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

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

describe('редактор: срок и приоритет', () => {
  it('открытие: поле срока и 3 кнопки приоритета с выставленными значениями', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      { title: 'Колено', body: 'не грузить', dueAt: '2026-11-23', priority: 'high' },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);

    const due = container.querySelector('[data-notes="due"]') as HTMLInputElement;
    expect(due.tagName).toBe('INPUT');
    expect(due.type).toBe('date');
    expect(due.value).toBe('2026-11-23');

    const row = container.querySelector('[data-notes="priority-row"]') as HTMLElement;
    const btns = row.querySelectorAll('[data-notes="priority"]');
    expect(btns).toHaveLength(3);
    expect(Array.from(btns).map((b) => b.getAttribute('data-priority'))).toEqual(['low', 'normal', 'high']);

    const created = container.querySelector('[data-notes="editor-created"]');
    expect(created?.textContent).toContain('Создано');
    expect(created?.textContent).toContain(fmtDate('2026-11-01T10:00:00.000Z'));
  });

  it('сохранение: dueAt/priority из редактора попадают в хранилище', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(s, { title: 'Колено', body: 'не грузить' }, { id: 'n1', now: '2026-11-01T10:00:00.000Z' }).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-notes="due"]') as HTMLInputElement, {
      target: { value: '2026-11-23' },
    });
    fireEvent.click(container.querySelector('[data-notes="priority-row"] [data-priority="high"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-notes="save"]') as HTMLElement);

    const saved = readCoachNotesResult(localStorage).store.items.find((n) => n.id === 'n1');
    expect(saved?.dueAt).toBe('2026-11-23');
    expect(saved?.priority).toBe('high');
  });
});

describe('список: срок и звездка', () => {
  it('заметка со сроком показывает «До …», а high — звездку', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      { title: 'Колено', body: 'не грузить', dueAt: '2026-06-01', priority: 'high' },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    const due = container.querySelector('[data-notes="due"]') as HTMLElement;
    expect(due).not.toBeNull();
    expect(due.textContent).toContain('До');
    expect(due.textContent).toContain(fmtDate('2026-06-01'));
    expect(container.querySelector('[data-notes="star"]')).not.toBeNull();
  });

  it('без приоритета — звездки нет', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      { title: 'Колено', body: 'не грузить', dueAt: '2026-06-01' },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    expect(container.querySelector('[data-notes="due"]')?.textContent).toContain(fmtDate('2026-06-01'));
    expect(container.querySelector('[data-notes="star"]')).toBeNull();
  });
});

describe('редактор: перестановка вложений', () => {
  it('кнопки attach-swap меняют порядок файлов', () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      {
        title: 'С файлами',
        attachments: [
          {
            id: 'a1',
            kind: 'photo',
            mime: 'image/jpeg',
            size: 10,
            name: 'AAA.jpg',
            createdAt: '2026-11-17T09:00:00.000Z',
          },
          {
            id: 'a2',
            kind: 'photo',
            mime: 'image/jpeg',
            size: 20,
            name: 'BBB.jpg',
            createdAt: '2026-11-17T09:00:00.000Z',
          },
        ],
      },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="edit"]') as HTMLElement);

    const metas = () =>
      Array.from(container.querySelectorAll('[data-notes="attach-item"]')).map(
        (el) => el.querySelector('[data-notes="attach-meta"]')?.textContent ?? '',
      );
    expect(metas()[0]).toContain('AAA.jpg');
    expect(metas()[1]).toContain('BBB.jpg');

    const firstSwap = container.querySelector('[data-notes="attach-swap"][data-dir="down"]') as HTMLElement;
    expect(firstSwap).not.toBeNull();
    fireEvent.click(firstSwap);

    const after = Array.from(container.querySelectorAll('[data-notes="attach-item"]'));
    expect(after[0].querySelector('[data-notes="attach-meta"]')?.textContent).toContain('BBB.jpg');
    expect(after[1].querySelector('[data-notes="attach-meta"]')?.textContent).toContain('AAA.jpg');
  });
});

describe('заметка: поделиться', () => {
  it('клик по share-note меняет DOM-статус', async () => {
    let s = emptyCoachNotes();
    s = addCoachNote(
      s,
      { title: 'Колено', body: 'не грузить', dueAt: '2026-06-01', priority: 'high' },
      { id: 'n1', now: '2026-11-01T10:00:00.000Z' },
    ).store;
    writeCoachNotes(localStorage, s);
    const { container } = render(<ProfileNotesTab />);
    fireEvent.click(container.querySelector('[data-note-id="n1"] [data-notes="share-note"]') as HTMLElement);
    await waitFor(() => {
      expect(container.querySelector('[data-notes="share-status"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-notes="share-status"]')?.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
