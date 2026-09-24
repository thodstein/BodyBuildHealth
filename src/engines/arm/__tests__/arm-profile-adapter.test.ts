import { describe, expect, it } from 'vitest';
import { getDefaultSettings } from '../../../core/types';
import { armBuilderProfilePatch, armProfileSnapshot } from '../arm-profile.adapter';
import { applyArmMobilityToProfile, clearArmMobilityFromProfile } from '../arm-mobility.engine';

function profileWith(overrides: any) {
  const settings = getDefaultSettings() as any;
  for (const [section, patch] of Object.entries(overrides)) {
    settings[section] = { ...(settings[section] || {}), ...(patch as any) };
  }
  return { id: 'test', name: '', role: 'user' as const, settings } as any;
}

describe('arm profile adapter', () => {
  it('читает canonical settings и сохраняет workMax/equipment', () => {
    const profile = profileWith({
      personal: { age: 31, weight: 82.4, bodyFat: 17, leanMass: 68.4 },
      training: { level: 'advanced', equipment: ['dumbbell', 'band'], workMax: { wrist_flexors: 42 }, workMaxByExercise: { wrist_curl_db: 38 } },
      lifestyle: { morningHRV: 64, sleepHours: 7.5, stressLevel: 4 },
    });
    const snapshot = armProfileSnapshot(profile);
    expect(snapshot).toMatchObject({ ageYears: 31, bodyWeightKg: 82.4, bodyFat: 17, leanMass: 68.4, level: 'advanced', equipment: ['dumbbell', 'band'], hrvMs: 64, sleepHours: 7.5, stressLevel: 4 });
    expect(snapshot.workMax).toEqual({ wrist_flexors: 42, wrist_curl_db: 38 });
    expect(armBuilderProfilePatch(snapshot).equipment).toEqual(['dumbbell', 'band']);
  });

  it('поддерживает flat fallback', () => {
    const snapshot = armProfileSnapshot({ id: 'flat', name: '', role: 'user', age: 40, weight: 90, equipment: ['barbell'], sleepHours: 6, stressLevel: 8, injuries: [] } as any);
    expect(snapshot.ageYears).toBe(40);
    expect(snapshot.bodyWeightKg).toBe(90);
    expect(snapshot.equipment).toEqual(['barbell']);
    expect(snapshot.sleepHours).toBe(6);
  });

  it('переводит запись травмы в ограничения арм-плана', () => {
    const snapshot = armProfileSnapshot(profileWith({ health: { injuries: [{ id: 'i1', type: 'muscle', location: 'правое предплечье', painLevel: 8, movementLimit: 'full_restriction', side: 'right' }] } }));
    expect(snapshot.injuries).toEqual([{ muscle: 'forearm', exclude: true, volumePct: 0, weightPct: 0 }]);
  });

  it('мержит mobility через canonical profile и не теряет другие ключи', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify(profileWith({ health: { mobilityRestrictions: ['shoulder'] }, training: { mobilityRestrictions: ['shoulder'] } })));
    applyArmMobilityToProfile(['wrist']);
    const stored = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(stored.settings.health.mobilityRestrictions).toEqual(['shoulder', 'wrist']);
    clearArmMobilityFromProfile(['wrist']);
    const cleared = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(cleared.settings.health.mobilityRestrictions).toEqual(['shoulder']);
    localStorage.removeItem('he_profile_v2');
  });
});
