import { describe, it, expect } from 'vitest';
import { applyDUPOverlay, recommendDUPMode } from '../bb-dup.engine';

function mkPlan(): any {
  return {
    level: 'advanced',
    weeks: [
      { week: 1, phase: 'accumulation', sessions: [
        { character: 'тяж', exercises: [
          { muscle: 'chest', role: 'primary', character: 'тяж', repsRange: [6,10], rir: 2, comment: '', workSets: [{ reps: 8, rir: 2 }] },
          { muscle: 'back', role: 'primary', character: 'тяж', repsRange: [6,10], rir: 2, comment: '', workSets: [{ reps: 8, rir: 2 }] },
          { muscle: 'triceps', role: 'accessory', character: 'памп', repsRange: [12,15], rir: 3, comment: '', workSets: [{ reps: 13, rir: 3 }] },
        ] },
      ] },
    ],
    rationale: [],
  };
}

describe('bb-dup per-muscle', () => {
  it('глобальный DUP (muscles не задан) применяется ко всем primary', () => {
    const plan = mkPlan();
    const out = applyDUPOverlay(plan, { mode: 'heavy_light', cycleDays: 2 });
    // первая сессия → тяж (индекс 0 пресета)
    expect(out.weeks[0].sessions[0].exercises[0].comment).toContain('[DUP:');
    expect(out.weeks[0].sessions[0].exercises[1].comment).toContain('[DUP:');
    // accessory не тронут
    expect(out.weeks[0].sessions[0].exercises[2].comment).not.toContain('[DUP:');
  });

  it('per-muscle DUP применяется только к указанным мышцам', () => {
    const plan = mkPlan();
    const out = applyDUPOverlay(plan, { mode: 'heavy_light', cycleDays: 2, muscles: ['chest'] });
    expect(out.weeks[0].sessions[0].exercises[0].comment).toContain('[DUP:'); // chest
    expect(out.weeks[0].sessions[0].exercises[1].comment).not.toContain('[DUP:'); // back — block
    // session character не переопределён в per-muscle режиме
    expect(out.weeks[0].sessions[0].character).toBe('тяж');
  });

  it('recommendDUPMode', () => {
    expect(recommendDUPMode('mass', 'advanced', 5).mode).toBe('full_dup');
    expect(recommendDUPMode('mass', 'intermediate', 4).mode).toBe('heavy_light');
    expect(recommendDUPMode('mass', 'intermediate', 2).mode).toBe('none');
  });
});
