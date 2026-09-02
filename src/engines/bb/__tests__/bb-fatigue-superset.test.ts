import { describe, it, expect } from 'vitest';
import { suggestSupersetPairs } from '../bb-fatigue.engine';

function mkSession(byMuscle: Record<string, { name: string; sets: number; rest?: number }>): any {
  const exercises: any[] = [];
  for (const [m, cfg] of Object.entries(byMuscle)) {
    exercises.push({ muscle: m, name: cfg.name, character: 'тяж', sets: cfg.sets, restSeconds: cfg.rest ?? 180, workSets: Array.from({ length: cfg.sets }, () => ({ reps: 8 })) });
  }
  return { exercises };
}

describe('bb-fatigue suggestSupersetPairs', () => {
  it('сессия в лимите → нет предложений', () => {
    const s = mkSession({ chest: { name: 'Жим', sets: 4 } });
    const r = suggestSupersetPairs(s, 60);
    expect(r.pairs).toHaveLength(0);
    expect(r.totalSavedSeconds).toBe(0);
  });

  it('длинная сессия → предложить антагонистскую пару и экономию', () => {
    // chest 6 сетов + back 6 сетов + quads 6 сетов, отдых 180 → база ~ (6*(32+180)+60)*... много
    const s = mkSession({ chest: { name: 'Жим', sets: 6 }, back: { name: 'Тяга', sets: 6 }, quads: { name: 'Присед', sets: 6 } });
    const r = suggestSupersetPairs(s, 30); // лимит 30 мин, база явно больше
    expect(r.pairs.length).toBeGreaterThan(0);
    expect(r.pairs[0].a).toBe('chest');
    expect(r.pairs[0].b).toBe('back');
    expect(r.totalSavedSeconds).toBeGreaterThan(0);
    expect(r.estimatedMinutes).toBeLessThanOrEqual(30 + 30);
  });

  it('не предлагает пары если сессия короткая', () => {
    const s = mkSession({ chest: { name: 'Жим', sets: 2 } });
    expect(suggestSupersetPairs(s, 60).pairs).toHaveLength(0);
  });
});
