/**
 * cycle-catalog-combat.test.tsx — combat-раздел общего каталога циклов:
 *  - сегмент «Единоборства» с живым счётчиком;
 *  - карточка + мост combat_cycle (payload + трек combat + событие + баннер role=status);
 *  - избранное с префиксом combat:.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';
import { COMBAT_CYCLE_LIBRARY } from '../../../../engines/combat/combat-cycle-library';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

describe('Каталог циклов: combat-раздел', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('сегмент Единоборства со счётчиком библиотеки', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Единоборства'));
    expect(screen.getByText(COMBAT_CYCLE_LIBRARY[0].name)).toBeTruthy();
  });

  it('combat-карточка отправляет combat_cycle + трек + событие + баннер', () => {
    let detail: unknown = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener('planning-track-open', h);
    try {
      render(<CycleCatalog {...PROPS} />);
      fireEvent.click(screen.getByText('Единоборства'));
      fireEvent.click(screen.getByText(COMBAT_CYCLE_LIBRARY[0].name));
      fireEvent.click(screen.getByText('🥋 Собрать в combat-конструкторе →'));
      const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(saved.kind).toBe('combat_cycle');
      expect(saved.data.cycleId).toBe(COMBAT_CYCLE_LIBRARY[0].id);
      expect(localStorage.getItem('he_training_planning_track')).toBe('combat');
      expect(detail).toBe('combat');
      expect(screen.getByRole('status').textContent).toContain('combat-конструктор');
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('⭐ combat-карточки пишет combat:<id> в избранное', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Единоборства'));
    fireEvent.click(screen.getByText(COMBAT_CYCLE_LIBRARY[0].name));
    const star = screen.getByRole('button', { name: new RegExp(`В избранное ${COMBAT_CYCLE_LIBRARY[0].name}`) });
    fireEvent.click(star);
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain(`combat:${COMBAT_CYCLE_LIBRARY[0].id}`);
  });
});
