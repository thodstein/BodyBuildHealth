/**
 * lab-athlete-ctx.test.ts — Epic G: контекст атлета (дефолты + legacy-профиль).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readLabAthleteCtx } from '../lab-athlete-ctx';

describe('lab-athlete-ctx', () => {
  beforeEach(() => {
    localStorage.removeItem('he_bb_diagnostics_hub_v1');
    localStorage.removeItem('he_profile_v2');
    localStorage.removeItem('he_training_profile');
  });

  it('дефолты без данных: hypertrophy/intermediate, пустые массивы, asym null', () => {
    const ctx = readLabAthleteCtx();
    expect(ctx.goal).toBe('hypertrophy');
    expect(ctx.level).toBe('intermediate');
    expect(ctx.weakZones).toEqual([]);
    expect(ctx.asymPct).toBeNull();
    expect(ctx.equipment).toEqual([]);
    expect(ctx.mobilityRestrictions).toEqual([]);
    expect(ctx.injuries).toEqual([]);
  });

  it('legacy-профиль: травмы/инвентарь/мобильность прокидываются', () => {
    localStorage.setItem(
      'he_training_profile',
      JSON.stringify({
        injuries: [{ muscle: 'chest', exclude: true }, 'shoulder'],
        equipment: ['dumbbell', 'bodyweight'],
        mobilityRestrictions: ['ankle'],
      }),
    );
    localStorage.setItem(
      'he_bb_diagnostics_hub_v1',
      JSON.stringify({ weakPoints: ['delt_mid'], asymPct: 9 }),
    );
    const ctx = readLabAthleteCtx();
    expect(ctx.injuries).toHaveLength(2);
    expect(ctx.equipment).toContain('dumbbell');
    expect(ctx.mobilityRestrictions).toEqual(['ankle']);
    expect(ctx.weakZones).toEqual(['delt_mid']);
    expect(ctx.asymPct).toBe(9);
  });
});
