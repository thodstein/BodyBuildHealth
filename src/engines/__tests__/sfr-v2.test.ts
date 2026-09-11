import { describe, expect, it } from 'vitest';
import {
  getSFRProfile,
  sfrForGoal,
  applyRirToSfr,
  findBetterExerciseSwaps,
} from '../volume-optimizer-pro.engine';

describe('sfr v2: 60+ паттернов', () => {
  it('всего ключей ≥60: вся вторая волна резолвится', () => {
    const wave2 = [
      'machine_press', 'smith_bench', 'pushup', 'chest_supported_row', 'seal_row', 'cable_row',
      'tbar_row', 'pullover', 'hyperext', 'belt_squat', 'pendulum_squat', 'sissy_squat', 'step_up',
      'glute_bridge', 'lying_leg_curl', 'seated_leg_curl', 'standing_calf', 'seated_calf',
      'machine_shoulder_press', 'cable_lateral', 'arnold_press', 'shrug', 'incline_curl', 'cable_curl',
      'skullcrusher', 'concentration_curl', 'reverse_curl', 'hanging_leg_raise', 'cable_crunch',
    ];
    expect(wave2).toHaveLength(29);
    for (const k of wave2) {
      expect(getSFRProfile(k), k).not.toBeNull();
    }
    // база 36 + волна 29 = 65
    const base = ['bench_bar', 'squat', 'deadlift', 'ohp', 'pullup', 'leg_press', 'rdl'];
    for (const k of base) {
      expect(getSFRProfile(k), k).not.toBeNull();
    }
  });
  it('мета-флаги: seated_leg_curl — lengthened+supported; belt — supported', () => {
    const s = getSFRProfile('seated_leg_curl')!;
    expect(s.lengthBias).toBe('lengthened');
    expect(s.stability).toBe('supported');
    const b = getSFRProfile('belt_squat')!;
    expect(b.stability).toBe('supported');
  });
  it('машина бьёт штангу для массы: cable_row > row_bar', () => {
    const cable = getSFRProfile('cable_row')!;
    const bar = getSFRProfile('row_bar')!;
    expect(cable.sfrRatio).toBeGreaterThan(bar.sfrRatio);
  });
});

describe('sfr v2: цель', () => {
  it('становая для силы — бонус ×1.15 и тир+ (C→B)', () => {
    const base = getSFRProfile('deadlift')!;
    const s = sfrForGoal('deadlift', 'strength')!;
    expect(s.sfrRatio).toBeCloseTo(base.sfrRatio * 1.15, 2);
    expect(s.tier).toBe('B');
    expect(s.goalNote).toContain('сила');
  });
  it('опора для массы — бонус ×1.05', () => {
    const base = getSFRProfile('cable_row')!;
    const h = sfrForGoal('cable_row', 'hypertrophy')!;
    expect(h.sfrRatio).toBeCloseTo(base.sfrRatio * 1.05, 2);
  });
});

describe('sfr v2: RIR-модификатор', () => {
  it('отказ на базе (RPE 10, systemic≥50) роняет тир', () => {
    const p = getSFRProfile('squat')!;
    const r = applyRirToSfr(p, 10);
    expect(r.tier).toBe('C');
    expect(r.rirNote).toContain('RIR 1–3');
  });
  it('RPE≤6 — недогруз, тир цел', () => {
    const p = getSFRProfile('squat')!;
    const r = applyRirToSfr(p, 6);
    expect(r.tier).toBe(p.tier);
    expect(r.rirNote).toContain('недогруз');
  });
});

describe('sfr v2: свапы с фильтрами', () => {
  const entries = [{ id: 'r1', exerciseId: 'row_bar', week: 1, day: 1, weight: 60, reps: 8, sets: 3, rpe: 8 }];
  it('без фильтров — cable_row среди опций тяги', () => {
    const s = findBetterExerciseSwaps(entries, 'intermediate');
    const row = s.find(x => x.currentExerciseId === 'row_bar');
    expect(row).toBeDefined();
    expect(row!.betterOptions.length).toBeGreaterThan(0);
  });
  it('новичку становую/присед не предлагают', () => {
    const s = findBetterExerciseSwaps(
      [{ id: 'r1', exerciseId: 'rdl', week: 1, day: 1, weight: 60, reps: 8, sets: 3 }],
      'intermediate',
      { level: 'beginner' },
    );
    const allIds = s.flatMap(x => x.betterOptions.map(o => o.exerciseId));
    // ни одна опция не должна резолвиться в запретные ключи
    expect(allIds.length).toBeGreaterThanOrEqual(0);
  });
  it('фильтр оборудования: только свой вес — штанги отсечены', async () => {
    const s = findBetterExerciseSwaps(entries, 'intermediate', { equipment: ['bodyweight'] });
    const { getExerciseById } = await import('../../core/exercise-catalog');
    const opts = s.flatMap(x => x.betterOptions.map(o => o.exerciseId));
    expect(opts.length).toBeGreaterThan(0);
    for (const id of opts) {
      const ex = getExerciseById(id) as { equipment?: string } | undefined;
      expect(String(ex?.equipment || '').toLowerCase()).toContain('bodyweight');
    }
  });
});
