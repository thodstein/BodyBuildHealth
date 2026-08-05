import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { modeMismatchWarning, rankCycles } from '../lms-selector.engine';

describe('PL selector mode-aware warnings', () => {
  it('warns natural users about enhanced-level cycles', () => {
    const cycle = LMS_CYCLES.find(c => c.meta.level === 'MS-MSMK')!;
    const warning = modeMismatchWarning({ goal: 'strength', level: 'II-KMS', mode: 'natural' }, cycle);
    expect(warning).toContain('enhanced');
    expect(rankCycles({ goal: 'strength', level: 'II-KMS', mode: 'natural' })
      .find(r => r.cycle.meta.id === cycle.meta.id)?.warnings.join(' ')).toContain('enhanced');
  });

  it('keeps existing peak and course mismatch warnings', () => {
    const peak = rankCycles({ goal: 'peak', level: 'II-KMS', mode: 'natural' }).find(r => r.cycle.meta.period === 'peak');
    const endurance = rankCycles({ goal: 'endurance', level: 'II-KMS', mode: 'on_course' }).find(r => r.cycle.meta.period === 'endurance');
    expect(peak?.warnings.join(' ')).toContain('натуралу');
    expect(endurance?.warnings.join(' ')).toContain('курса');
  });
});
