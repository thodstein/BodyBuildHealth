import { describe, it, expect, beforeEach } from 'vitest';
import {
  CB_ANNUAL_SYNC_KEY, buildCBAnnualOverlay, loadCBAnnualOverlay, saveCBAnnualOverlay,
} from '../combat-annual-bridge.engine';
import { buildCombatSpecBlock } from '../combat-correction.engine';

/** P9: overlay спец-блока на год; пусто — null; персист roundtrip; мусор — null. */
describe('combat annual-bridge (P9 overlay)', () => {
  beforeEach(() => {
    try { localStorage.removeItem(CB_ANNUAL_SYNC_KEY); } catch { /* ignore */ }
  });

  it('спец-блок ложится на недели старта, хвост — поддержание', () => {
    const spec = buildCombatSpecBlock(['cross', 'double'], 6);
    const weeks = buildCBAnnualOverlay(spec, { startWeek: 5, totalYearWeeks: 52 });
    expect(weeks).not.toBeNull();
    expect(weeks?.[0]).toMatchObject({ week: 5, focus: ['cross', 'double'] });
    expect(weeks?.[0]?.note).toContain('Combat спец');
    expect(weeks?.[0]?.note).toContain('дни 1+3');
    expect(weeks?.[5]).toMatchObject({ week: 10, focus: ['cross', 'double'] });
    expect(weeks?.[6]).toMatchObject({ week: 11, focus: [] });
    expect(weeks?.[6]?.note).toContain('поддержание');
    expect(weeks).toHaveLength(48);
  });

  it('пустой фокус — null (не пишем мусор в год)', () => {
    expect(buildCBAnnualOverlay(null)).toBeNull();
    expect(buildCBAnnualOverlay({ weeks: 6, focus: [], dayMap: {}, rationale: '' })).toBeNull();
  });

  it('персист roundtrip + битый стор — null', () => {
    const spec = buildCombatSpecBlock(['jab'], 4);
    const weeks = buildCBAnnualOverlay(spec) ?? [];
    saveCBAnnualOverlay(weeks, 1);
    const loaded = loadCBAnnualOverlay();
    expect(loaded?.weeks).toHaveLength(weeks.length);
    expect(loaded?.weeks[0].note).toContain('jab');
    localStorage.setItem(CB_ANNUAL_SYNC_KEY, 'not-json{{{');
    expect(loadCBAnnualOverlay()).toBeNull();
  });
});
