import { describe, it, expect } from 'vitest';
import {
  COMBAT_TAKEDOWN_BIOMECH, COMBAT_TAKEDOWN_POINTS,
  diagnoseCombatTakedown, takedownReadiness,
} from '../combat-takedown.engine';

/** P2: 5 точек; элита > неэлиты; пусто — честный no_data. */
describe('combat-takedown engine', () => {
  it('все 5 точек имеют 4 фазы', () => {
    expect(COMBAT_TAKEDOWN_POINTS).toHaveLength(5);
    for (const p of COMBAT_TAKEDOWN_POINTS) {
      expect(COMBAT_TAKEDOWN_BIOMECH[p].phases).toHaveLength(4);
    }
  });

  it('элитный вход лучше неэлитного', () => {
    const elite = diagnoseCombatTakedown('double', { entryTimeS: 0.6, bodyHeightPct: 52, successRate: 0.7 });
    const novice = diagnoseCombatTakedown('double', { entryTimeS: 1.5, bodyHeightPct: 68, successRate: 0.2 });
    expect(elite.level).toBe('ok');
    expect(['warn', 'critical']).toContain(novice.level);
    expect(novice.findings.join(' ')).toMatch(/медленно/);
  });

  it('пустые замеры — честный no_data, не ноль', () => {
    const d = diagnoseCombatTakedown('single', {});
    expect(d.level).toBe('no_data');
  });

  it('проход напоминает про гильотину, боди-лок — нет', () => {
    expect(diagnoseCombatTakedown('double', { entryTimeS: 0.7 }).guillotineNote).toBe(true);
    expect(diagnoseCombatTakedown('body_lock', { entryTimeS: 0.7 }).guillotineNote).toBe(false);
  });

  it('готовность: без спрола проходы рано', () => {
    expect(takedownReadiness({}).ready).toBe(false);
    expect(takedownReadiness({ sprawl_defense: { entryTimeS: 0.7, successRate: 0.8 } }).ready).toBe(true);
  });
});
