/**
 * manual-library-combat.test.tsx — единоборства (13) в библиотеке ручного планировщика.
 * - таб «Единоборства» с живым счётчиком;
 * - мост в combat-конструктор (kind combat_cycle + трек combat + событие + баннер role=status);
 * - избранное с префиксом combat: в общем CYCLE_FAV;
 * - поиск скрывает всё.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import { getAllPrograms } from '../../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { COMBAT_CYCLE_LIBRARY } from '../../../../engines/combat/combat-cycle-library';
import { MANUAL_STORAGE_KEYS } from '../../../../engines/manual-constructor/manual-storage';

function renderGallery() {
  return render(
    <ManualLibraryGallery
      bbPrograms={getAllPrograms().slice(0, 2)}
      plCycles={LMS_CYCLES.slice(0, 2) as any}
      onSelectBB={() => {}}
      onSelectPL={() => {}}
    />,
  );
}

beforeEach(() => {
  try {
    localStorage.removeItem(MANUAL_STORAGE_KEYS.CYCLE_FAV);
    localStorage.removeItem('he_planner_apply');
    localStorage.removeItem('he_training_planning_track');
  } catch { /* ignore */ }
});

describe('Ручная библиотека: единоборства', () => {
  it('таб Единоборства с живым счётчиком', () => {
    renderGallery();
    expect(screen.getByRole('tab', { name: new RegExp(`Единоборства \\(${COMBAT_CYCLE_LIBRARY.length}\\)`) })).toBeInTheDocument();
    expect(COMBAT_CYCLE_LIBRARY.length).toBeGreaterThan(0);
  });

  it('таб Единоборства: карточка + мост (kind + трек + событие + баннер)', () => {
    renderGallery();
    let track = '';
    const h = (e: Event) => { track = (e as CustomEvent).detail as string; };
    window.addEventListener('planning-track-open', h);
    try {
      fireEvent.click(screen.getByRole('tab', { name: /Единоборства \(/ }));
      const first = COMBAT_CYCLE_LIBRARY[0];
      expect(screen.getByText(first.name)).toBeInTheDocument();
      fireEvent.click(screen.getAllByText(/Собрать в конструкторе →/)[0]);
      const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(saved.kind).toBe('combat_cycle');
      expect(saved.data.cycleId).toBe(first.id);
      expect(localStorage.getItem('he_training_planning_track')).toBe('combat');
      expect(track).toBe('combat');
      expect(screen.getByRole('status')).toHaveTextContent(/combat-конструктор/);
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('⭐ combat-карточки пишет combat:<id> в избранное', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Единоборства \(/ }));
    const card = screen.getByText(COMBAT_CYCLE_LIBRARY[0].name).closest('.lib-combat-card')!;
    const star = (card as HTMLElement).querySelector('button[aria-label^="В избранное"]') as HTMLButtonElement;
    fireEvent.click(star);
    const favs = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEYS.CYCLE_FAV) || '[]');
    expect(favs).toContain(`combat:${COMBAT_CYCLE_LIBRARY[0].id}`);
    expect(star).toHaveAttribute('data-fav', 'true');
  });

  it('поиск скрывает combat-список целиком', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Единоборства \(/ }));
    fireEvent.change(screen.getByPlaceholderText(/Поиск по названию/), { target: { value: 'несуществующий_запрос_12345' } });
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
  });
});
