import { describe, it, expect } from 'vitest';
import {
  wafAgeGroupFor,
  wafClassesFor,
  wafClassFor,
  wafCutTargetFor,
  buildWafStartCard,
  wafEntriesCount,
} from '../arm-waf.engine';

describe('arm-waf (эпик A)', () => {
  it('возрастные зачёты по границам', () => {
    expect(wafAgeGroupFor(14)).toBe('subjunior');
    expect(wafAgeGroupFor(16)).toBe('junior');
    expect(wafAgeGroupFor(20)).toBe('youth23');
    expect(wafAgeGroupFor(30)).toBe('senior');
    expect(wafAgeGroupFor(45)).toBe('master40');
    expect(wafAgeGroupFor(55)).toBe('grandmaster50');
    expect(wafAgeGroupFor(65)).toBe('sgrandmaster60');
    expect(wafAgeGroupFor(75)).toBe('ssgrandmaster70');
  });
  it('senior M11 / F8', () => {
    expect(wafClassesFor('male', 'senior')).toEqual([55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 'open']);
    expect(wafClassesFor('female', 'senior')).toEqual([50, 55, 60, 65, 70, 80, 90, 'open']);
  });
  it('текущая весовая сверху', () => {
    expect(wafClassFor(84, 'male', 'senior').label).toBe('85');
    expect(wafClassFor(85, 'male', 'senior').label).toBe('85');
    expect(wafClassFor(85.1, 'male', 'senior').label).toBe('90');
    expect(wafClassFor(200, 'male', 'senior').label).toBe('Open');
  });
  it('юниоры и мастера отличаются', () => {
    expect(wafClassesFor('male', 'junior')).toContain(75);
    expect(wafClassesFor('male', 'master40')[0]).toBe(60);
    expect(wafClassesFor('male', 'ssgrandmaster70')).toEqual(['open']);
  });
  it('сгонка — ближайший потолок ниже', () => {
    const t = wafCutTargetFor(86, 'male', 'senior')!;
    expect(t.label).toBe('85');
    expect(t.deltaKg).toBeCloseTo(-1, 5);
    expect(wafCutTargetFor(50, 'male', 'senior')).toBeNull();
  });
  it('карточка старта: обе руки = 2 зачёта', () => {
    const card = buildWafStartCard({ sex: 'male', ageYears: 30, bodyWeightKg: 84, arm: 'both' });
    expect(card.weightClass.label).toBe('85');
    expect(card.entriesCount).toBe(2);
    expect(card.arms).toEqual(['left', 'right']);
    expect(card.weighInNote).toMatch(/85/);
    expect(wafEntriesCount('both')).toBe(2);
    expect(wafEntriesCount('left')).toBe(1);
  });
  it('para-классы упрощённо', () => {
    expect(wafClassesFor('male', 'senior', 'PID')).toEqual([55, 65, 75, 100, 'open']);
    const c = wafClassFor(70, 'male', 'senior', 'PID');
    expect(c.label).toBe('75');
  });
});
