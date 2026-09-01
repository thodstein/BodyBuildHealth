import { buildBBPlan } from '../bb-builder.engine';
import { describe, it, expect } from 'vitest';
describe('Фаза 4.28: recoveryMultOverride', () => {
  it('передаётся в buildBBPlan и не ломает план', () => {
    const p = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, recoveryMultOverride: 1.3 } as any);
    expect(p.weeks.length).toBe(4);
  });
  it('по умолчанию (undefined) — прежнее поведение', () => {
    const a = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    expect(a.weeks.length).toBe(4);
  });
});
