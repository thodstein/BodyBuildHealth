/**
 * profile-coach-wiring.test.tsx — связка «профиль → режим тренера / заметки / планер».
 *
 * Проверяем именно проводку, а не внутренности вкладок: hero-карточки открывают
 * новые вкладки, поднавигация их показывает, диплинк из App (`initialSubTab`)
 * попадает сразу в нужную вкладку, а не на hero.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileScreen_v2 } from '../ProfileScreen_v2';
import { NAV_TARGETS } from '../../../../App';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import {
  addCoachNote,
  emptyCoachNotes,
  writeCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';
import { readCoachPlanner } from '../../../../engines/coach/coach-planner.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('проводка вкладок профиля', () => {
  it('hero-карточка «Тренер» открывает режим тренера', () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="coach"]') as HTMLElement);
    expect(container.querySelector('[data-coach="root"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Раздел Тренер"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('hero-карточки «Заметки» и «Планер» открывают свои вкладки', () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="notes"]') as HTMLElement);
    expect(container.querySelector('[data-notes="root"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[aria-label="Назад к hero"]') as HTMLElement);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="planner"]') as HTMLElement);
    expect(container.querySelector('[data-planner="root"]')).not.toBeNull();
  });

  it('диплинк initialSubTab открывает вкладку сразу, без hero', () => {
    const { container: coach } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    expect(coach.querySelector('[data-coach="root"]')).not.toBeNull();
    cleanup();
    const { container: notes } = render(<ProfileScreen_v2 initialSubTab="notes" />);
    expect(notes.querySelector('[data-notes="root"]')).not.toBeNull();
    cleanup();
    const { container: planner } = render(<ProfileScreen_v2 initialSubTab="planner" />);
    expect(planner.querySelector('[data-planner="root"]')).not.toBeNull();
  });

  it('NAV_TARGETS ведут в конкретные вкладки профиля, а не на hero', () => {
    expect(NAV_TARGETS['coach']).toMatchObject({ tab: 'profile', subTab: 'coach' });
    expect(NAV_TARGETS['coach-mode']).toMatchObject({ tab: 'profile', subTab: 'coach' });
    expect(NAV_TARGETS['notes']).toMatchObject({ tab: 'profile', subTab: 'notes' });
    expect(NAV_TARGETS['planner']).toMatchObject({ tab: 'profile', subTab: 'planner' });
  });
});

describe('атлет → его заметки и задачи', () => {
  const seedCoach = () => {
    let s = setCoachEnabled(emptyCoachState(), true);
    s = addCoachAthlete(s, { name: 'Иван' }, { id: 'a1' }).state;
    s = addCoachAthlete(s, { name: 'Пётр' }, { id: 'a2' }).state;
    writeCoachState(localStorage, s);
    let notes = addCoachNote(emptyCoachNotes(), { title: 'Про Ивана', athleteId: 'a1' }, { id: 'n1' }).store;
    notes = addCoachNote(notes, { title: 'Про Петра', athleteId: 'a2' }, { id: 'n2' }).store;
    writeCoachNotes(localStorage, notes);
  };

  it('кнопка «Заметки атлета» открывает вкладку заметок с фильтром по этому атлету', () => {
    seedCoach();
    const { container } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    const card = container.querySelector('[data-coach="athlete"][data-athlete-id="a1"]') as HTMLElement;
    fireEvent.click(card.querySelector('[data-coach="open-notes"]') as HTMLElement);

    expect(container.querySelector('[data-notes="root"]')).not.toBeNull();
    const filter = container.querySelector('[data-notes="filter"]') as HTMLSelectElement;
    expect(filter.value).toBe('a1');
    const shown = container.querySelectorAll('[data-notes="item"]');
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute('data-note-id')).toBe('n1');
  });

  it('кнопка «Задачи атлета» открывает планёр с выбранным атлетом в форме', () => {
    seedCoach();
    const { container } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    const card = container.querySelector('[data-coach="athlete"][data-athlete-id="a2"]') as HTMLElement;
    fireEvent.click(card.querySelector('[data-coach="open-planner"]') as HTMLElement);

    expect(container.querySelector('[data-planner="root"]')).not.toBeNull();
    const select = container.querySelector('[data-planner="athlete"]') as HTMLSelectElement;
    expect(select.value).toBe('a2');

    // и новая задача сразу пишется на этого атлета
    fireEvent.change(container.querySelector('[data-planner="title"]') as HTMLInputElement, { target: { value: 'Созвон' } });
    fireEvent.click(container.querySelector('[data-planner="add"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].athleteId).toBe('a2');
  });
});
