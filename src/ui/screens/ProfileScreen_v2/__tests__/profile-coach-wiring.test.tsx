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
