/**
 * profile-notes-overdue.test.tsx — просроченный срок заметки виден в списке.
 *
 * Раньше срок рисовался нейтральным цветом и для прошедшей, и для будущей даты, поэтому
 * сорванный дедлайн нельзя было отличить от завтрашнего. Теперь строка срока получает
 * `data-overdue="true"`, цвет `colors.danger` и хвост «· просрочено».
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProfileNotesTab } from '../ProfileNotesTab';
import { addCoachNote, emptyCoachNotes, writeCoachNotes } from '../../../../engines/coach/coach-notes.engine';

/** Локальный календарный день со сдвигом (тот же приём, что в компоненте). */
const localDayISO = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const seedNote = (id: string, dueAt: string) => {
  const store = addCoachNote(
    emptyCoachNotes(),
    { title: `Заметка ${id}`, body: 'тело', dueAt },
    { id, now: '2026-01-01T10:00:00.000Z' },
  ).store;
  writeCoachNotes(localStorage, store);
};

const dueOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-note-id="${id}"] [data-notes="due"]`) as HTMLElement | null;

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

describe('список заметок: просроченный срок', () => {
  it('вчерашний срок помечен как просроченный', () => {
    seedNote('overdue', localDayISO(-1));
    const { container } = render(<ProfileNotesTab />);
    const due = dueOf(container, 'overdue');
    expect(due).not.toBeNull();
    expect(due?.getAttribute('data-overdue')).toBe('true');
    expect(due?.textContent).toContain('просрочено');
    expect(due?.style.color).toBe('rgb(239, 68, 68)');
  });

  it('завтрашний срок не просрочен', () => {
    seedNote('future', localDayISO(1));
    const { container } = render(<ProfileNotesTab />);
    const due = dueOf(container, 'future');
    expect(due).not.toBeNull();
    expect(due?.getAttribute('data-overdue')).toBeNull();
    expect(due?.textContent).not.toContain('просрочено');
    expect(due?.textContent).toContain('До');
  });

  it('срок на сегодня ещё не просрочен', () => {
    seedNote('today', localDayISO(0));
    const { container } = render(<ProfileNotesTab />);
    const due = dueOf(container, 'today');
    expect(due).not.toBeNull();
    expect(due?.getAttribute('data-overdue')).toBeNull();
  });
});
