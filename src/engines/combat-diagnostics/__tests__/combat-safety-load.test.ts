import { describe, it, expect } from 'vitest';
import { screenCombatSafety } from '../combat-safety-screen.engine';
import { combatAcwrZone, combatAsymmetryVerdict, combatWeakCandidates } from '../combat-load-screen.engine';

/** P5+P6: redflag блокирует мост; teen виден; ACWR-зоны; асимметрия 7/12; e1RM-кандидаты. */
describe('combat safety-screen (P5)', () => {
  it('redflag блокирует', () => {
    const s = screenCombatSafety({ concussionsLastYear: 1 });
    expect(s.blocked).toBe(true);
    expect(s.text).toMatch(/Стоп/);
    expect(screenCombatSafety({}).blocked).toBe(false);
  });

  it('teen 14–15 виден, 16+ — нет', () => {
    expect(screenCombatSafety({ age: 14 }).teen).toBe(true);
    expect(screenCombatSafety({ age: 15 }).teen).toBe(true);
    expect(screenCombatSafety({ age: 16 }).teen).toBe(false);
  });

  it('шея: слабее 35% веса — изометрия', () => {
    const s = screenCombatSafety({ neckExtensionKg: 20, bodyWeightKg: 80 });
    expect(s.neckNote).toMatch(/слабее/);
    expect(screenCombatSafety({ neckExtensionKg: 30, bodyWeightKg: 80 }).neckNote).toMatch(/порядке/);
  });
});

describe('combat load-screen (P6)', () => {
  it('ACWR-зоны 0.8/1.3/1.5', () => {
    expect(combatAcwrZone(0.5)).toBe('low');
    expect(combatAcwrZone(1.0)).toBe('ok');
    expect(combatAcwrZone(1.4)).toBe('caution');
    expect(combatAcwrZone(1.8)).toBe('danger');
    expect(combatAcwrZone(null)).toBeNull();
  });

  it('асимметрия: 12%+ → fix +25%, 7%+ → watch +15%', () => {
    const fix = combatAsymmetryVerdict({ left: 7, right: 9 });
    expect(fix.verdict).toBe('fix');
    expect(fix.weakSide).toBe('left');
    expect(fix.topUpPct).toBe(25);
    const watch = combatAsymmetryVerdict({ left: 9, right: 10 });
    expect(watch.verdict).toBe('watch');
    expect(watch.topUpPct).toBe(15);
    expect(combatAsymmetryVerdict({ left: 10, right: 10 }).verdict).toBe('ok');
    expect(combatAsymmetryVerdict({ left: null, right: 10 }).verdict).toBe('ok');
  });

  it('e1RM-тренд: −5% weak, плато — plateau', () => {
    const c = combatWeakCandidates([
      { group: 'cross', prevBest: 100, recentBest: 90 },
      { group: 'double', prevBest: 100, recentBest: 100 },
      { group: 'jab', prevBest: 100, recentBest: 110 },
    ]);
    expect(c.find(x => x.group === 'cross')?.kind).toBe('weak');
    expect(c.find(x => x.group === 'double')?.kind).toBe('plateau');
    expect(c.find(x => x.group === 'jab')).toBeUndefined();
  });
});
