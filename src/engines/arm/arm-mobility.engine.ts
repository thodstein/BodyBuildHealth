/**
 * arm-mobility.engine.ts — ROM-тест арм-спортсмена (E10 P1).
 * Parity: TA/ BB OHS 6 + knee-to-wall + heel-retest → mobilityRestrictions → фильтр ранжира.
 * 5 чеков + нормы + reverse-grip retest + applyArmMobilityToProfile + fail→точка маппинг.
 */

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

export function applyArmMobilityToProfile(restrictions: string[]): string {
  const uniq = Array.from(new Set((restrictions || []).map((s) => String(s)).filter(Boolean)));
  try {
    const raw = localStorage.getItem('he_profile_v2');
    const p = raw ? JSON.parse(raw) : {};
    p.health = p.health || {};
    p.training = p.training || {};
    const prevH = Array.isArray((p.health as any).mobilityRestrictions) ? (p.health as any).mobilityRestrictions : [];
    const prevT = Array.isArray((p.training as any).mobilityRestrictions) ? (p.training as any).mobilityRestrictions : [];
    (p.health as any).mobilityRestrictions = Array.from(new Set([...prevH.filter((x: string) => !['wrist', 'forearm', 'elbow'].includes(x)), ...uniq]));
    (p.training as any).mobilityRestrictions = Array.from(new Set([...prevT.filter((x: string) => !['wrist', 'forearm', 'elbow'].includes(x)), ...uniq]));
    localStorage.setItem('he_profile_v2', JSON.stringify(p));
    try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch { /* noop */ }
  } catch { /* noop */ }
  return uniq.join(', ') || 'OK';
}
