/**
 * Тесты суставной подготовки (warmup-joints.engine.ts):
 * суставы дня → упражнения, приоритет порядка, дедупликация, капы, подписи.
 */
import { describe, expect, it } from 'vitest';
import {
  JOINT_ORDER, JOINT_PREP, JOINT_BY_GROUP, JOINT_LABELS,
  collectJointPrep, jointPrepLabels,
} from '../warmup-joints.engine';

describe('JOINT_PREP / JOINT_BY_GROUP', () => {
  it('все суставы имеют упражнения и русские подписи', () => {
    for (const j of JOINT_ORDER) {
      expect(JOINT_PREP[j], j).toBeTruthy();
      expect(JOINT_PREP[j].length).toBeGreaterThan(0);
      expect(JOINT_LABELS[j], j).toBeTruthy();
    }
  });

  it('жимовая группа задействует плечи+локти+запястья', () => {
    expect(JOINT_BY_GROUP.chest).toEqual(['shoulders', 'elbows', 'wrists']);
  });

  it('тяговая группа дополнительно — позвоночник; ножная — бёдра/колени/голеностоп', () => {
    expect(JOINT_BY_GROUP.back).toContain('spine');
    expect(JOINT_BY_GROUP.quads).toEqual(['hips', 'knees', 'ankles']);
  });
});

describe('collectJointPrep', () => {
  it('грудной день: круги плечами → локти → запястья (порядок суставов)', () => {
    const exs = collectJointPrep(['chest']);
    const ids = exs.map(e => e.id);
    expect(ids[0]).toBe('shoulder_circle');
    expect(ids).toContain('elbow_circles');
    expect(ids).toContain('wrist_circles');
    expect(ids).toContain('wrist_rocks');
    // суставы без дублей
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ножной день: бёдра + колени + голеностоп, без плеч', () => {
    const ids = collectJointPrep(['quads']).map(e => e.id);
    expect(ids).toContain('hip_circle');
    expect(ids).toContain('knee_circles');
    expect(ids).toContain('ankle_mobility');
    expect(ids).not.toContain('shoulder_circle');
  });

  it('тяговый день: плечи+локти+запястья+позвоночник', () => {
    const ids = collectJointPrep(['back']).map(e => e.id);
    expect(ids).toContain('shoulder_circle');
    expect(ids).toContain('elbow_circles');
    expect(ids).toContain('cat_camel');
  });

  it('дедупликация при нескольких группах (грудь+спина делят плечи/локти/запястья)', () => {
    const exs = collectJointPrep(['chest', 'back']);
    const ids = exs.map(e => e.id);
    expect(ids.filter(id => id === 'shoulder_circle').length).toBe(1);
    expect(ids.filter(id => id === 'elbow_circles').length).toBe(1);
    expect(ids).toContain('cat_camel');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('кап ≤ 7 и неизвестные группы игнорируются', () => {
    expect(collectJointPrep(['fullbody']).length).toBeLessThanOrEqual(7);
    expect(collectJointPrep(['']).length).toBe(0);
    expect(collectJointPrep(['неизвестное']).length).toBe(0);
  });

  it('jointPrepLabels — русские подписи суставов в порядке', () => {
    expect(jointPrepLabels(['chest'])).toBe('плечи, локти, запястья');
    expect(jointPrepLabels(['quads'])).toBe('бёдра, колени, голеностоп');
  });
});
