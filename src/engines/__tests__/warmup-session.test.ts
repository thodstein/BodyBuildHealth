/**
 * Тесты генерации сессионной разминки (warmup.engine.ts generateWarmup):
 * все основные упражнения в «специальной» части, рампа 50/70/90,
 * снижение при усталости, bodyweight-замены активации без ленты.
 */
import { describe, expect, it } from 'vitest';
import { generateWarmup, WARMUP_LABELS, warmupLabel, type WarmupInput } from '../warmup.engine';

const baseInput: WarmupInput = {
  sessionFocus: 'squat',
  primaryExercises: ['squat'],
  riskFlags: {},
  techniqueIssues: [],
  fatigueLevel: 0.3,
  equipmentAvailable: ['barbell', 'squat rack'],
};

describe('generateWarmup', () => {
  it('блоки: общий + мобильность + специальная (активация только при рисках)', () => {
    const blocks = generateWarmup(baseInput);
    expect(blocks.map(b => b.type)).toEqual(['general', 'mobility', 'specific']);
    expect(blocks[0].durationSec).toBe(300);
  });

  it('при рисках добавляется блок активации (4 блока)', () => {
    const blocks = generateWarmup({ ...baseInput, riskFlags: { knee: 'high' } });
    expect(blocks.map(b => b.type)).toEqual(['general', 'mobility', 'activation', 'specific']);
  });

  it('специальная часть: все основные упражнения с рампой 50/70/90 для первого', () => {
    const in3: WarmupInput = { ...baseInput, primaryExercises: ['squat', 'bench_press', 'deadlift'] };
    const specific = generateWarmup(in3).find(b => b.type === 'specific')!;
    expect(specific.exercises).toEqual([
      { exerciseId: 'squat', sets: 1, reps: 5, intensityPct: 50 },
      { exerciseId: 'squat', sets: 1, reps: 3, intensityPct: 70 },
      { exerciseId: 'squat', sets: 1, reps: 1, intensityPct: 90 },
      { exerciseId: 'bench_press', sets: 1, reps: 5, intensityPct: 50 },
      { exerciseId: 'bench_press', sets: 1, reps: 3, intensityPct: 70 },
      { exerciseId: 'deadlift', sets: 1, reps: 5, intensityPct: 50 },
    ]);
  });

  it('пустой список основных → fallback на squat 50%', () => {
    const specific = generateWarmup({ ...baseInput, primaryExercises: [] }).find(b => b.type === 'specific')!;
    expect(specific.exercises).toEqual([{ exerciseId: 'squat', sets: 3, reps: 5, intensityPct: 50 }]);
  });

  it('высокая усталость → сниженный общий блок', () => {
    const blocks = generateWarmup({ ...baseInput, fatigueLevel: 0.8 });
    expect(blocks[0].exercises).toEqual([{ exerciseId: 'light_cardio', sets: 1, reps: 1 }]);
    expect(blocks[0].notes).toContain('усталость');
  });

  it('без ленты: bodyweight-замены для активации коленей/плеч', () => {
    const noBand: WarmupInput = { ...baseInput, riskFlags: { knee: 'high', shoulder: 'high' }, equipmentAvailable: ['barbell'] };
    const act = generateWarmup(noBand).find(b => b.type === 'activation')!;
    expect(act.exercises.some(e => e.exerciseId === 'side_lying_abduction')).toBe(true);
    expect(act.exercises.some(e => e.exerciseId === 'wall_slide')).toBe(true);
    expect(act.exercises.some(e => e.exerciseId === 'banded_clam')).toBe(false);
    expect(act.exercises.some(e => e.exerciseId === 'external_rotation')).toBe(false);
  });

  it('слабые точки: плечи/бёдра/голеностоп/грудь → активация', () => {
    const blocks = generateWarmup({ ...baseInput, techniqueIssues: ['tight_shoulders', 'tight_hips', 'tight_ankles', 'tight_chest'] });
    const act = blocks.find(b => b.type === 'activation')!;
    const ids = act.exercises.map(e => e.exerciseId);
    expect(ids).toContain('wall_slide'); // tight_shoulders без ленты
    expect(ids).toContain('glute_bridge'); // tight_hips
    expect(ids).toContain('air_squat'); // tight_ankles
    expect(ids).toContain('pushup_light'); // tight_chest
  });

  it('длительность мобильности/активации масштабируется по объёму (≥ 90с)', () => {
    const blocks = generateWarmup({ ...baseInput, targetGroups: ['chest'] });
    const mob = blocks.find(b => b.type === 'mobility')!;
    expect(mob.durationSec).toBeGreaterThanOrEqual(90);
    expect(mob.durationSec).toBeLessThanOrEqual(240);
  });

  it('с лентой: ленточная активация', () => {
    const withBand: WarmupInput = { ...baseInput, riskFlags: { knee: 'high' }, equipmentAvailable: ['barbell', 'resistance_band'] };
    const act = generateWarmup(withBand).find(b => b.type === 'activation')!;
    expect(act.exercises.some(e => e.exerciseId === 'banded_clam')).toBe(true);
  });

  it('техника округления спины → bird dog + dead bug', () => {
    const blocks = generateWarmup({ ...baseInput, techniqueIssues: ['rounding_back'] });
    const act = blocks.find(b => b.type === 'activation')!;
    expect(act.exercises.map(e => e.exerciseId)).toContain('bird_dog');
    expect(act.exercises.map(e => e.exerciseId)).toContain('dead_bug');
  });

  it('мобильность по фокусу: ноги → бёдра/голеностоп; жим → плечи/грудной', () => {
    const legs = generateWarmup({ ...baseInput, sessionFocus: 'squat' }).find(b => b.type === 'mobility')!;
    expect(legs.exercises.map(e => e.exerciseId)).toEqual(['hip_circle', 'ankle_mobility']);
    const push = generateWarmup({ ...baseInput, sessionFocus: 'bench' }).find(b => b.type === 'mobility')!;
    expect(push.exercises.map(e => e.exerciseId)).toEqual(['shoulder_circle', 'thoracic_rotation']);
  });

  it('высокий риск → кошка-корова и «Величайшая в мире»', () => {
    const blocks = generateWarmup({ ...baseInput, riskFlags: { back: 'high' } });
    const mob = blocks.find(b => b.type === 'mobility')!;
    expect(mob.exercises.map(e => e.exerciseId)).toContain('cat_camel');
  });
});

describe('Словарь названий', () => {
  it('ключевые id имеют русские названия', () => {
    for (const id of ['jumping_jack', 'arm_circles', 'leg_swings', 'hip_circle', 'ankle_mobility', 'shoulder_circle', 'thoracic_rotation', 'cat_camel', 'worlds_greatest', 'banded_clam', 'external_rotation', 'bird_dog', 'dead_bug', 'side_lying_abduction', 'wall_slide',
      'wall_pec_stretch', 'pushup_light', 'scapular_pull', 'band_pull_apart', 'air_squat', 'lateral_band_walk', 'hip_hinge_prep', 'glute_bridge', 'rdl_light', '90_90_switch', 'ytw', 'band_curl_light', 'band_pushdown_light', 'calf_raise', 'calf_stretch', 'wrist_circles', 'neck_cars', 'wrist_flex_ext',
      'wrist_rocks', 'elbow_circles', 'knee_circles']) {
      expect(WARMUP_LABELS[id], id).toBeTruthy();
    }
  });

  it('warmupLabel: fallback на id', () => {
    expect(warmupLabel('light_cardio')).toContain('кардио');
    expect(warmupLabel('xyz')).toBe('xyz');
  });
});
