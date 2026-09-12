/**
 * required-labs-phase.test.ts — REQUIRED_LABS_PER_PHASE содержит маркеры плана
 * (APO_B/LP_A/HOMOCYSTEINE) в нужных фазах. Канон: docs/SUPPORT-PHASE-LABS-PLAN.md §7.
 */
import { describe, it, expect } from 'vitest';
import { REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';

describe('REQUIRED_LABS_PER_PHASE — маркеры плана по фазам', () => {
  it('baseline: APO_B + LP_A (once) + HOMOCYSTEINE', () => {
    const b = REQUIRED_LABS_PER_PHASE.baseline;
    expect(b).toContain('APO_B');
    expect(b).toContain('LP_A');
    expect(b).toContain('HOMOCYSTEINE');
  });
  it('on_cycle и bridge: APO_B + HOMOCYSTEINE, но без LP_A (раз в жизни)', () => {
    for (const phase of ['on_cycle', 'bridge'] as const) {
      const list = REQUIRED_LABS_PER_PHASE[phase];
      expect(list).toContain('APO_B');
      expect(list).toContain('HOMOCYSTEINE');
      expect(list).not.toContain('LP_A');
    }
  });
  it('pct/post_pct: HOMOCYSTEINE (метилирование восстанавливается)', () => {
    expect(REQUIRED_LABS_PER_PHASE.pct).toContain('HOMOCYSTEINE');
    expect(REQUIRED_LABS_PER_PHASE.post_pct).toContain('HOMOCYSTEINE');
  });
  it('новые коды резолвятся в UCUM_MAP (иначе падает coverage и overdue)', () => {
    for (const code of ['APO_B', 'LP_A', 'HOMOCYSTEINE']) {
      expect(UCUM_MAP[code]).toBeDefined();
    }
  });
});
