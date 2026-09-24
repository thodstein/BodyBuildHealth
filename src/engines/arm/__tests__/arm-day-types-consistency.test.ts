import { describe, expect, it } from 'vitest';
import { ARM_MUSCLES } from '../arm-types';
import { TAG_MUSCLES_ARM } from '../arm-day-types';

describe('arm day type canonical muscles', () => {
  it('не пропускает неканонические muscle tokens', () => {
    for (const [tag, muscles] of Object.entries(TAG_MUSCLES_ARM)) {
      for (const muscle of muscles) expect(ARM_MUSCLES).toContain(muscle as any);
    }
  });
});
