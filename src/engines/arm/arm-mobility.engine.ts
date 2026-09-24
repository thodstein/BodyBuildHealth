/**
 * arm-mobility.engine.ts — ROM-тест арм-спортсмена (E10 P1).
 * Parity: TA/ BB OHS 6 + knee-to-wall + heel-retest → mobilityRestrictions → фильтр ранжира.
 * 5 чеков + нормы + reverse-grip retest + applyArmMobilityToProfile + fail→точка маппинг.
 */

import { getProfile, updateProfile } from '../../core/profile-manager';

export interface ArmMobilityInput {
  wristFlexOk: boolean; // сгибание кисти ≥80°
  wristExtOk: boolean; // разгибание ≥70°
  pronOk: boolean; // пронация ≥80°
  supOk: boolean; // супинация ≥80°
  elbowExtOk: boolean; // локоть разгибается полностью, без боли
  reverseRetest?: '' | 'better' | 'same'; // reverse-grip retest: стало лучше = кисть, нет = предплечье/локоть
}

export type ArmMobilityFail = 'wrist' | 'forearm' | 'elbow';

export interface ArmMobilityResult {
  fails: ArmMobilityFail[];
  failedCount: number;
  score: number; // 0-100
  retestHint: string | null;
  restrictions: string[]; // для he_profile_v2 mobilityRestrictions
}

export function assessArmMobility(input: ArmMobilityInput): ArmMobilityResult {
  const fails: ArmMobilityFail[] = [];
  if (!input.wristFlexOk || !input.wristExtOk) fails.push('wrist');
  if (!input.pronOk || !input.supOk) fails.push('forearm');
  if (!input.elbowExtOk) fails.push('elbow');
  const uniq = Array.from(new Set(fails));
  const failedCount = uniq.length;
  const score = Math.max(0, 100 - failedCount * 30 - (!input.wristFlexOk && !input.wristExtOk ? 10 : 0));
  let retestHint: string | null = null;
  if (input.reverseRetest === 'better') retestHint = 'Reverse-grip лучше — драйвер кисть: high-rep cup/rising 12-20, RIR≥2';
  else if (input.reverseRetest === 'same') retestHint = 'Без изменений — драйвер предплечье/локоть: pron/sup баланс + изометрия';
  const restrictions = uniq.slice();
  return { fails: uniq, failedCount, score, retestHint, restrictions };
}

/** Провал ROM-теста относится к точке? (для diagnoseArmWeakCause.mobilityFail) */
export function mobilityFailForWeakPoint(fails: ArmMobilityFail[], wp: string): boolean {
  if (!fails || fails.length === 0) return false;
  if (/^cup_|rising_|contain_/.test(wp)) return fails.includes('wrist');
  if (/^pron_|^sup_/.test(wp)) return fails.includes('forearm') || fails.includes('wrist');
  if (/^side_|^back_/.test(wp)) return fails.includes('elbow') || fails.includes('forearm');
  return fails.length > 0;
}

function mergeArmMobility(restrictions: string[], remove = false): string[] {
  const profile = getProfile();
  const settings: any = profile.settings || {};
  const health: any = settings.health || {};
  const training: any = settings.training || {};
  let rawHealth: any = {};
  let rawTraining: any = {};
  try {
    const raw = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    rawHealth = raw?.health || {};
    rawTraining = raw?.training || {};
  } catch {}
  const legacyHealth: any = { ...rawHealth, ...((profile as any).health || {}) };
  const legacyTraining: any = { ...rawTraining, ...((profile as any).training || {}) };
  const keys = new Set(['wrist', 'forearm', 'elbow']);
  const next = new Set<string>();
  const add = (source: unknown) => {
    if (!Array.isArray(source)) return;
    for (const item of source) {
      const value = String(item || '').trim();
      if (value) next.add(value);
    }
  };
  add(health.mobilityRestrictions);
  add(training.mobilityRestrictions);
  add(legacyHealth.mobilityRestrictions);
  add(legacyTraining.mobilityRestrictions);
  if (!remove) for (const value of restrictions) {
    const normalized = String(value || '').trim();
    if (keys.has(normalized)) next.add(normalized);
  }
  const merged = Array.from(next);
  (updateProfile as any)({
    health: { ...legacyHealth, mobilityRestrictions: merged },
    training: { ...legacyTraining, mobilityRestrictions: merged },
    settings: {
      ...settings,
      health: { ...health, mobilityRestrictions: merged },
      training: { ...training, mobilityRestrictions: merged },
    },
  });
  return merged;
}

export function applyArmMobilityToProfile(restrictions: string[]): string {
  try {
    const uniq = Array.from(new Set((restrictions || []).map((s) => String(s)).filter(Boolean)));
    mergeArmMobility(uniq);
    return uniq.join(', ') || 'OK';
  } catch { return 'OK'; }
}

export function clearArmMobilityFromProfile(restrictions: string[] = ['wrist', 'forearm', 'elbow']): void {
  try {
    const profile = getProfile();
    const settings: any = profile.settings || {};
    const health: any = settings.health || {};
    const training: any = settings.training || {};
    let rawHealth: any = {};
    let rawTraining: any = {};
    try {
      const raw = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      rawHealth = raw?.health || {};
      rawTraining = raw?.training || {};
    } catch {}
    const legacyHealth: any = { ...rawHealth, ...((profile as any).health || {}) };
    const legacyTraining: any = { ...rawTraining, ...((profile as any).training || {}) };
    const remove = new Set(restrictions.map((value) => String(value).trim()).filter(Boolean));
    const clean = (source: unknown): string[] => Array.isArray(source) ? source.map(String).filter((value) => !remove.has(value)) : [];
    (updateProfile as any)({
      health: { ...legacyHealth, mobilityRestrictions: clean(legacyHealth.mobilityRestrictions) },
      training: { ...legacyTraining, mobilityRestrictions: clean(legacyTraining.mobilityRestrictions) },
      settings: {
        ...settings,
        health: { ...health, mobilityRestrictions: clean(health.mobilityRestrictions) },
        training: { ...training, mobilityRestrictions: clean(training.mobilityRestrictions) },
      },
    });
  } catch {}
}
