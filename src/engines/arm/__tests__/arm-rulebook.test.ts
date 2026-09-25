import { describe, expect, it } from 'vitest';
import {
  ARM_RULEBOOK_REGISTRY,
  ARMLIFTING_USA_2026_SNAPSHOT,
  WAF_2025_SNAPSHOT,
  getImplementProtocol,
} from '../arm-rulebook';
import {
  evaluateWafEligibility,
  evaluateWafEntries,
  type WafWeighInRecord,
} from '../arm-rulebook-eligibility.engine';
import {
  buildAttemptStrategy,
  simulateImplementProtocol,
  simulateWafBracket,
} from '../arm-rulebook-simulation.engine';
import {
  ARM_RULEBOOK_STORAGE_KEY,
  clearArmRulebookRegistry,
  loadArmRulebookRegistry,
  saveArmRulebookRegistry,
  type RulebookStorage,
} from '../arm-rulebook-registry.storage';

const competitionAtIso = '2026-10-02T12:00:00Z';

function validWeighIn(overrides: Partial<WafWeighInRecord> = {}): WafWeighInRecord {
  return {
    atIso: '2026-10-01T08:00:00Z',
    bodyWeightKg: 82,
    approvedScale: true,
    clothingKg: 0,
    artificialLimbsIncluded: true,
    ...overrides,
  };
}

describe('arm rulebook registry', () => {
  it('exposes verified WAF and event-specific snapshots', () => {
    expect(ARM_RULEBOOK_REGISTRY.snapshots).toHaveLength(2);
    expect(ARM_RULEBOOK_REGISTRY.snapshots.map((snapshot) => snapshot.id)).toEqual([
      'waf-2025',
      'armlifting-usa-2026-examples',
    ]);
    expect(WAF_2025_SNAPSHOT.rules.kind).toBe('waf');
    expect(WAF_2025_SNAPSHOT.sources[0].url).toContain('waf-armwrestling.com');
    expect(ARMLIFTING_USA_2026_SNAPSHOT.sources).toHaveLength(2);
    expect(Object.isFrozen(ARM_RULEBOOK_REGISTRY)).toBe(true);
    expect(Object.isFrozen(WAF_2025_SNAPSHOT.rules.categories[0].weightClassesBySex.male)).toBe(true);
  });

  it('does not expose an unlisted sex weight class', () => {
    const seniorMale = WAF_2025_SNAPSHOT.rules.kind === 'waf'
      ? WAF_2025_SNAPSHOT.rules.categories.find((category) => category.id === 'senior-male')
      : null;
    const seniorFemale = WAF_2025_SNAPSHOT.rules.kind === 'waf'
      ? WAF_2025_SNAPSHOT.rules.categories.find((category) => category.id === 'senior-female')
      : null;
    expect(seniorMale?.weightClassesBySex.female).toEqual([]);
    expect(seniorFemale?.weightClassesBySex.male).toEqual([]);
  });
});

describe('WAF eligibility', () => {
  it('accepts a valid senior entry and selects the fitted class', () => {
    const result = evaluateWafEligibility(
      { id: 'athlete-1', sex: 'male', ageYears: 30, bodyWeightKg: 82, arm: 'left' },
      { competitionAtIso, weighIn: validWeighIn() },
    );
    expect(result.status).toBe('eligible');
    expect(result.selectedCategory?.id).toBe('senior-male');
    expect(result.weightClass?.label).toBe('85');
    expect(result.weighInHoursBefore).toBe(28);
  });

  it('fails clothing, scale, window, and category violations', () => {
    const result = evaluateWafEligibility(
      { id: 'athlete-2', sex: 'female', ageYears: 45, bodyWeightKg: 70, arm: 'right' },
      {
        competitionAtIso,
        weighIn: validWeighIn({
          atIso: '2026-10-01T20:00:00Z',
          clothingKg: 0.2,
          approvedScale: false,
          artificialLimbsIncluded: false,
        }),
      },
    );
    expect(result.status).toBe('ineligible');
    expect(result.reasons.join(' ')).toMatch(/clothing|scale|window|artificial/i);
    expect(result.selectedCategory?.id).toBe('masters-40-49-female');
  });

  it('requires review for an unknown weigh-in procedure', () => {
    const result = evaluateWafEligibility(
      { id: 'athlete-3', sex: 'male', ageYears: 30, bodyWeightKg: 82, arm: 'left' },
      { competitionAtIso },
    );
    expect(result.status).toBe('needs_review');
    expect(result.reasons.join(' ')).toMatch(/weigh-in|scale|clothing|artificial/i);
  });

  it('evaluates multiple entries without changing their order', () => {
    const results = evaluateWafEntries(
      [
        { id: 'a', sex: 'male', ageYears: 30, bodyWeightKg: 82, arm: 'left' },
        { id: 'b', sex: 'female', ageYears: 20, bodyWeightKg: 50, arm: 'right' },
      ],
      { competitionAtIso, weighIn: validWeighIn() },
    );
    expect(results.map((result) => result.entryId)).toEqual(['a', 'b']);
  });
});

describe('event attempt simulation', () => {
  it('builds an unlimited strategy without inventing a global order', () => {
    const protocol = getImplementProtocol(ARMLIFTING_USA_2026_SNAPSHOT, 'axle-unlimited-2026');
    expect(protocol).not.toBeNull();
    const result = buildAttemptStrategy(protocol!, { startWeightKg: 80, stepKg: 5, attemptCount: 3 });
    expect(result.valid).toBe(true);
    expect(result.strategy?.maxAttempts).toBe('unlimited');
    expect(result.strategy?.weightsKg).toEqual([80, 85, 90]);
    expect(result.warnings.join(' ')).toMatch(/not specified/i);
  });

  it('builds and simulates three increasing clock attempts', () => {
    const protocol = getImplementProtocol(ARMLIFTING_USA_2026_SNAPSHOT, 'grandfather-clock-three-2026');
    const strategy = buildAttemptStrategy(protocol!, { startWeightKg: 80, stepKg: 5 });
    expect(strategy.strategy?.weightsKg).toEqual([80, 85, 90]);
    const simulation = simulateImplementProtocol(protocol!, [
      { weightKg: 80, success: true, durationSeconds: 30 },
      { weightKg: 85, success: true, durationSeconds: 30 },
      { weightKg: 90, success: true, durationSeconds: 30 },
    ]);
    expect(simulation.status).toBe('completed');
    expect(simulation.bestWeightKg).toBe(90);
  });

  it('stops an event after a miss only when the scoped policy says so', () => {
    const protocol = getImplementProtocol(ARMLIFTING_USA_2026_SNAPSHOT, 'saxon-unlimited-2026');
    const simulation = simulateImplementProtocol(protocol!, [
      { weightKg: 80, success: true },
      { weightKg: 85, success: false },
      { weightKg: 90, success: true },
    ]);
    expect(simulation.status).toBe('eliminated');
    expect(simulation.ignoredAttempts).toBe(1);
    expect(simulation.bestWeightKg).toBe(80);
  });

  it('rejects invalid clock order and over-limit durations', () => {
    const protocol = getImplementProtocol(ARMLIFTING_USA_2026_SNAPSHOT, 'grandfather-clock-three-2026');
    expect(simulateImplementProtocol(protocol!, [
      { weightKg: 90, success: true },
      { weightKg: 85, success: true },
      { weightKg: 95, success: true },
    ]).status).toBe('invalid');
    expect(simulateImplementProtocol(protocol!, [
      { weightKg: 80, success: true, durationSeconds: 61 },
    ]).status).toBe('invalid');
  });
});

describe('WAF bracket simulation', () => {
  it('tracks two losses, country avoidance, and explicit rematch warnings', () => {
    const result = simulateWafBracket(
      [
        { id: 'a', country: 'RU' },
        { id: 'b', country: 'RU' },
        { id: 'c', country: 'US' },
      ],
      [
        { round: 1, bracket: 'upper', leftId: 'a', rightId: 'b', winnerId: 'a' },
        { round: 1, bracket: 'upper', leftId: 'c', rightId: 'a', winnerId: 'c' },
        { round: 2, bracket: 'lower', leftId: 'b', rightId: 'c', winnerId: 'b' },
        { round: 3, bracket: 'lower', leftId: 'a', rightId: 'b', winnerId: 'b' },
        { round: 4, bracket: 'lower', leftId: 'b', rightId: 'c', winnerId: 'c' },
      ],
    );
    expect(result.status).toBe('complete');
    expect(result.championId).toBe('c');
    expect(result.eliminated.map((standing) => standing.id)).toEqual(['a', 'b']);
    expect(result.warnings.join(' ')).toMatch(/same-country|rematch/i);
  });

  it('rejects an unknown winner without mutating the result', () => {
    const result = simulateWafBracket(
      [{ id: 'a' }, { id: 'b' }],
      [{ round: 1, bracket: 'upper', leftId: 'a', rightId: 'b', winnerId: 'missing' }],
    );
    expect(result.status).toBe('invalid');
    expect(result.championId).toBeNull();
    expect(result.errors.join(' ')).toMatch(/winner|unknown/i);
  });
});

describe('arm rulebook storage', () => {
  function memoryStorage(): RulebookStorage & { values: Map<string, string> } {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
  }

  it('round-trips a registry and falls back on corrupt data', () => {
    const storage = memoryStorage();
    expect(saveArmRulebookRegistry(ARM_RULEBOOK_REGISTRY, storage)).toBe(true);
    expect(loadArmRulebookRegistry(storage).snapshots).toHaveLength(2);
    storage.setItem(ARM_RULEBOOK_STORAGE_KEY, '{broken');
    expect(loadArmRulebookRegistry(storage)).toBe(ARM_RULEBOOK_REGISTRY);
    expect(clearArmRulebookRegistry(storage)).toBe(true);
    expect(loadArmRulebookRegistry(storage)).toBe(ARM_RULEBOOK_REGISTRY);
  });
});
