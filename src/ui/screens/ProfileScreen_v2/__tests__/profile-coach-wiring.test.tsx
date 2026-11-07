/**
 * profile-coach-wiring.test.tsx — связка «профиль → режим тренера / заметки / планер».
 *
 * Проверяем именно проводку, а не внутренности вкладок: hero-карточки открывают
 * новые вкладки, поднавигация их показывает, диплинк из App (`initialSubTab`)
 * попадает сразу в нужную вкладку, а не на hero.
 *
 * Вкладки профиля грузятся через React.lazy (см. docs/UI-PERF-PASS-2026-11.md),
 * поэтому после клика ждём появления узла, а не читаем DOM сразу.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
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
import { readCoachLog } from '../../../../engines/coach/coach-athlete-log.engine';

const LAZY_MS = 20000;

/** Ждём узел вкладки: чанк в jsdom грузится 2–3 с. */
const waitForSel = async (container: HTMLElement, sel: string) => {
  let el: Element | null = null;
  await waitFor(() => {
    el = container.querySelector(sel);
    expect(el).not.toBeNull();
  }, { timeout: LAZY_MS });
  return el as unknown as HTMLElement;
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('проводка вкладок профиля', () => {
  it('hero-карточка «Тренер» открывает режим тренера', async () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="coach"]') as HTMLElement);
    await waitForSel(container, '[data-coach="root"]');
    expect(container.querySelector('[aria-label="Раздел Тренер"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('hero-карточки «Заметки» и «Планер» открывают свои вкладки', async () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="notes"]') as HTMLElement);
    await waitForSel(container, '[data-notes="root"]');

    fireEvent.click(container.querySelector('[aria-label="Назад к hero"]') as HTMLElement);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="planner"]') as HTMLElement);
    await waitForSel(container, '[data-planner="root"]');
  });

  it('диплинк initialSubTab открывает вкладку сразу, без hero', async () => {
    const { container: coach } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    await waitForSel(coach, '[data-coach="root"]');
    cleanup();
    const { container: notes } = render(<ProfileScreen_v2 initialSubTab="notes" />);
    await waitForSel(notes, '[data-notes="root"]');
    cleanup();
    const { container: planner } = render(<ProfileScreen_v2 initialSubTab="planner" />);
    await waitForSel(planner, '[data-planner="root"]');
  });

  it('NAV_TARGETS ведут в конкретные вкладки профиля, а не на hero', () => {
    expect(NAV_TARGETS['coach']).toMatchObject({ tab: 'profile', subTab: 'coach' });
    expect(NAV_TARGETS['coach-mode']).toMatchObject({ tab: 'profile', subTab: 'coach' });
    expect(NAV_TARGETS['notes']).toMatchObject({ tab: 'profile', subTab: 'notes' });
    expect(NAV_TARGETS['planner']).toMatchObject({ tab: 'profile', subTab: 'planner' });
    expect(NAV_TARGETS['athlete-log']).toMatchObject({ tab: 'profile', subTab: 'log' });
    expect(NAV_TARGETS['coach-log']).toMatchObject({ tab: 'profile', subTab: 'log' });
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

  it('кнопка «Заметки атлета» открывает вкладку заметок с фильтром по этому атлету', async () => {
    seedCoach();
    const { container } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    const card = await waitForSel(container, '[data-coach="athlete"][data-athlete-id="a1"]');
    fireEvent.click(card.querySelector('[data-coach="open-notes"]') as HTMLElement);

    await waitForSel(container, '[data-notes="root"]');
    const filter = await waitForSel(container, '[data-notes="filter"]') as unknown as HTMLSelectElement;
    expect(filter.value).toBe('a1');
    const shown = container.querySelectorAll('[data-notes="item"]');
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute('data-note-id')).toBe('n1');
  });

  it('кнопка «Задачи атлета» открывает планёр с выбранным атлетом в форме', async () => {
    seedCoach();
    const { container } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    const card = await waitForSel(container, '[data-coach="athlete"][data-athlete-id="a2"]');
    fireEvent.click(card.querySelector('[data-coach="open-planner"]') as HTMLElement);

    await waitForSel(container, '[data-planner="root"]');
    const select = await waitForSel(container, '[data-planner="athlete"]') as unknown as HTMLSelectElement;
    expect(select.value).toBe('a2');

    // и новая задача сразу пишется на этого атлета
    fireEvent.change(container.querySelector('[data-planner="title"]') as HTMLInputElement, { target: { value: 'Созвон' } });
    fireEvent.click(container.querySelector('[data-planner="add"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].athleteId).toBe('a2');
  });

  it('кнопка «Журнал атлета» открывает журнал с этим атлетом и пишет запись на него', async () => {
    seedCoach();
    const { container } = render(<ProfileScreen_v2 initialSubTab="coach" />);
    const card = await waitForSel(container, '[data-coach="athlete"][data-athlete-id="a1"]');
    fireEvent.click(card.querySelector('[data-coach="open-log"]') as HTMLElement);

    await waitForSel(container, '[data-log="root"]');
    const athleteSel = await waitForSel(container, '[data-log="athlete"]') as unknown as HTMLSelectElement;
    expect(athleteSel.value).toBe('a1');

    fireEvent.change(container.querySelector('[data-log="exercise"]') as HTMLInputElement, { target: { value: 'Присед' } });
    fireEvent.change(container.querySelector('[data-log="sets"]') as HTMLInputElement, { target: { value: '3' } });
    fireEvent.change(container.querySelector('[data-log="reps"]') as HTMLInputElement, { target: { value: '5' } });
    fireEvent.change(container.querySelector('[data-log="weight"]') as HTMLInputElement, { target: { value: '100' } });
    fireEvent.click(container.querySelector('[data-log="save"]') as HTMLElement);

    expect(readCoachLog(localStorage).items[0]).toMatchObject({ athleteId: 'a1', exercise: 'Присед', weightKg: 100 });
  });
});
