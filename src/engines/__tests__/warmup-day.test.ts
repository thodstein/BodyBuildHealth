/**
 * Тесты разминки под целевые группы дня (warmup-day.engine.ts + generateWarmup targetGroups).
 */
import { describe, expect, it } from 'vitest';
import {
  WARMUP_GROUP_PREP, CANON_GROUP_ORDER, collectGroupPrep, prepGroupLabels,
} from '../warmup-day.engine';
import { generateWarmup, type WarmupInput } from '../warmup.engine';

const baseInput: WarmupInput = {
  sessionFocus: 'push',
  primaryExercises: ['bench_press'],
  riskFlags: {},
  techniqueIssues: [],
  fatigueLevel: 0.3,
  equipmentAvailable: ['barbell'],
};

describe('WARMUP_GROUP_PREP', () => {
  it('покрывает все канонические группы с упражнениями', () => {
    for (const g of CANON_GROUP_ORDER) {
      const prep = WARMUP_GROUP_PREP[g];
      expect(prep, g).toBeTruthy();
      expect(prep.mobility.length).toBeGreaterThan(0);
      expect(prep.activation.length).toBeGreaterThan(0);
    }
  });
});

describe('collectGroupPrep', () => {
  it('одна группа: суставная подготовка + активация', () => {
    const prep = collectGroupPrep(['chest'], true);
    expect(prep.mobility.map(e => e.id)).toEqual(['shoulder_circle', 'thoracic_rotation', 'wall_pec_stretch']);
    expect(prep.activation.map(e => e.id)).toEqual(['pushup_light', 'wall_slide']);
  });

  it('композитные группы раскрываются: legs → квадры/задняя/ягодицы/икры', () => {
    const prep = collectGroupPrep(['legs'], true);
    const mob = prep.mobility.map(e => e.id);
    expect(mob).toContain('hip_circle');
    expect(mob).toContain('ankle_mobility');
    expect(mob).toContain('hip_hinge_prep');
    expect(mob).toContain('calf_stretch');
  });

  it('дедупликация: грудь+плечи делят круги плечами и ротацию', () => {
    const prep = collectGroupPrep(['chest', 'shoulders'], true);
    const mob = prep.mobility.map(e => e.id);
    expect(mob.filter(id => id === 'shoulder_circle').length).toBe(1);
    expect(mob.filter(id => id === 'thoracic_rotation').length).toBe(1);
  });

  it('лимиты: fullbody → ≤7 суставных и ≤5 активационных', () => {
    const prep = collectGroupPrep(['fullbody'], true);
    expect(prep.mobility.length).toBeLessThanOrEqual(7);
    expect(prep.activation.length).toBeLessThanOrEqual(5);
  });

  it('без ленты ленточные упражнения пропускаются', () => {
    const prep = collectGroupPrep(['glutes', 'shoulders'], false);
    const act = prep.activation.map(e => e.id);
    expect(act).not.toContain('banded_clam');
    expect(act).not.toContain('band_pull_apart');
    expect(act).not.toContain('external_rotation');
    expect(act).toContain('glute_bridge'); // bodyweight остаётся
    expect(act).toContain('ytw');
  });

  it('с лентой ленточные включаются', () => {
    const prep = collectGroupPrep(['glutes'], true);
    expect(prep.activation.map(e => e.id)).toContain('banded_clam');
  });

  it('неизвестные группы игнорируются', () => {
    const prep = collectGroupPrep(['неизвестное', ''], true);
    expect(prep.mobility.length).toBe(0);
    expect(prep.activation.length).toBe(0);
  });
});

describe('prepGroupLabels', () => {
  it('русские подписи с дедупликацией', () => {
    expect(prepGroupLabels(['chest', 'back'])).toBe('грудь, спина');
    expect(prepGroupLabels(['legs'])).toBe('квадрицепсы, бицепс бедра, ягодицы, икры');
    expect(prepGroupLabels(['chest', 'ГРУДЬ'])).toBe('грудь');
  });
});

describe('generateWarmup с targetGroups', () => {
  it('грудной день: мобильность груди/плеч + активация отжиманиями', () => {
    const blocks = generateWarmup({ ...baseInput, targetGroups: ['chest'] });
    const mob = blocks.find(b => b.type === 'mobility')!;
    expect(mob.exercises.map(e => e.exerciseId)).toEqual(['shoulder_circle', 'thoracic_rotation', 'wall_pec_stretch']);
    expect(mob.notes).toContain('Суставная подготовка: грудь');
    const act = blocks.find(b => b.type === 'activation')!;
    expect(act.exercises.map(e => e.exerciseId)).toContain('pushup_light');
    expect(act.notes).toContain('Активация: грудь');
  });

  it('нижний день: подготовка бёдер/голеностопа + ягодичный мост', () => {
    const blocks = generateWarmup({ ...baseInput, targetGroups: ['quads', 'hamstrings', 'glutes'] });
    const mob = blocks.find(b => b.type === 'mobility')!;
    const ids = mob.exercises.map(e => e.exerciseId);
    expect(ids).toContain('hip_circle');
    expect(ids).toContain('ankle_mobility');
    const act = blocks.find(b => b.type === 'activation')!;
    expect(act.exercises.map(e => e.exerciseId)).toContain('glute_bridge');
  });

  it('высокий риск + групповой prep: кошка-корова добавляется без дубля', () => {
    const blocks = generateWarmup({ ...baseInput, riskFlags: { back: 'high' }, targetGroups: ['chest'] });
    const mob = blocks.find(b => b.type === 'mobility')!;
    const ids = mob.exercises.map(e => e.exerciseId);
    expect(ids).toContain('cat_camel');
    expect(ids.filter(id => id === 'cat_camel').length).toBe(1);
  });

  it('техника округления спины добавляется к групповой активации', () => {
    const blocks = generateWarmup({ ...baseInput, techniqueIssues: ['rounding_back'], targetGroups: ['chest'] });
    const act = blocks.find(b => b.type === 'activation')!;
    expect(act.exercises.map(e => e.exerciseId)).toContain('bird_dog');
  });

  it('без targetGroups — прежний фокусный путь', () => {
    const blocks = generateWarmup({ ...baseInput, sessionFocus: 'squat' });
    const mob = blocks.find(b => b.type === 'mobility')!;
    expect(mob.exercises.map(e => e.exerciseId)).toEqual(['hip_circle', 'ankle_mobility']);
  });
});
