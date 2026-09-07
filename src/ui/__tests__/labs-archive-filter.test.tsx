/**
 * labs-archive-filter.test.tsx — P0: archiveLabs смешивал архив + чужие фазы
 * До: labs.filter(l => archived || phase !== selected) → on_cycle попадает в архив при baseline
 * После: только archived
 */
import { describe, it, expect } from 'vitest';

function oldArchive(labs: any[], selectedPhase: string) {
  return labs.filter((l) => l.archived || (l.phase && l.phase !== selectedPhase));
}
function fixedArchive(labs: any[]) {
  return labs.filter((l) => !!l.archived);
}
function currentLabsFn(labs: any[], selectedPhase: string) {
  return labs.filter((l) => !l.archived && (!l.phase || l.phase === selectedPhase));
}

describe('Labs archive P0 fix', () => {
  const labs = [
    { id: '1', code: 'ALT', value: 30, phase: 'baseline', archived: false },
    { id: '2', code: 'HCT', value: 45, phase: 'on_cycle', archived: false },
    { id: '3', code: 'LDL', value: 3, phase: 'baseline', archived: true },
  ] as any[];

  it('текущие baseline: только baseline неархив', () => {
    expect(currentLabsFn(labs, 'baseline').map((l) => l.id)).toEqual(['1']);
    expect(currentLabsFn(labs, 'on_cycle').map((l) => l.id)).toEqual(['2']);
  });

  it('баг: архив содержал on_cycle при baseline (1 лишний)', () => {
    expect(oldArchive(labs, 'baseline').map((l) => l.id).sort()).toEqual(['2', '3']);
    expect(oldArchive(labs, 'on_cycle').map((l) => l.id).sort()).toEqual(['1', '3']);
  });

  it('фикс: архив только archived', () => {
    expect(fixedArchive(labs).map((l) => l.id)).toEqual(['3']);
    // чужая фаза не попадает
    expect(fixedArchive(labs).some((l) => l.id === '2')).toBe(false);
  });

  it('легаси без phase: в текущих любой фазы, не в архиве', () => {
    const legacy = [{ id: '9', code: 'ALT', value: 30, archived: false }] as any[];
    expect(currentLabsFn(legacy, 'baseline').length).toBe(1);
    expect(currentLabsFn(legacy, 'on_cycle').length).toBe(1);
    expect(fixedArchive(legacy).length).toBe(0);
    expect(oldArchive(legacy, 'baseline').length).toBe(0);
  });
});
