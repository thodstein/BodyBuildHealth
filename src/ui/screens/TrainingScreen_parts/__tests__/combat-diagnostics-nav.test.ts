import { describe, it, expect } from 'vitest';
import { ZONES, zoneForTab } from '../nav';
import { TAB_LABELS } from '../shared';

/** Монтаж combat-хаба: регистрация таба + зона calculators + подпись. */
describe('combat-diagnostics nav', () => {
  it('таб зарегистрирован в зоне calculators', () => {
    expect(ZONES.calculators.tabs).toContain('combat_diagnostics');
    expect(zoneForTab('combat_diagnostics')).toBe('calculators');
    expect(TAB_LABELS['combat_diagnostics']).toContain('единоборств');
  });

  it('таб в категории «Качество и диагностика»', () => {
    const cat = ZONES.calculators.categories.find(c => c.label === 'Качество и диагностика');
    expect(cat?.tabs).toContain('combat_diagnostics');
  });
});
