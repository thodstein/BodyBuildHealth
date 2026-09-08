/**
 * labs-legacy-phase.test.tsx — P0: legacy без phase показывался во всех фазах
 * До: !l.phase || phase===selected → во всех фазах
 * После: !l.phase ? selected==='baseline' : phase===selected → только baseline
 */
import { describe, it, expect } from 'vitest';

function oldCurrent(labs: any[], selected: string) {
  return labs.filter((l) => !l.archived && (!l.phase || l.phase === selected));
}
function fixedCurrent(labs: any[], selected: string) {
  return labs.filter((l) => !l.archived && (!l.phase ? selected === 'baseline' : l.phase === selected));
}

describe('Labs legacy phase P0', () => {
  const labs = [
    { id: '1', code: 'ALT', phase: undefined, archived: false },
    { id: '2', code: 'HCT', phase: 'on_cycle', archived: false },
  ] as any[];

  it('баг: legacy во всех фазах', () => {
    expect(oldCurrent(labs, 'baseline').length).toBe(1);
    expect(oldCurrent(labs, 'on_cycle').length).toBe(2); // legacy + on_cycle → 2, баг
  });

  it('фикс: legacy только в baseline', () => {
    expect(fixedCurrent(labs, 'baseline').length).toBe(1);
    expect(fixedCurrent(labs, 'on_cycle').length).toBe(1);
    expect(fixedCurrent(labs, 'on_cycle')[0].id).toBe('2');
  });
});
