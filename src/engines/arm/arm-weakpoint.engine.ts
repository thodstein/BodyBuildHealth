/**
 * arm-weakpoint.engine.ts — диагностика слабых звеньев армрестлинга.
 * Зеркало weakpoint-pl.ts / bb-weakpoint.ts.
 * Расширено: 12 мёртвых точек (ArmWeakPoint) + алиасы старых 8, биомеханика ARM_BIOMECH,
 * коррекции ARM_CORRECTIONS, детальная диагностика diagnoseArmWeakDetailed().
 */
import type { ArmMuscle } from './arm-types';
import { ARM_BIOMECH, type ArmWeakPoint, isArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS, LEGACY_TO_DETAILED } from './arm-weakpoint-corrections';

export type { ArmWeakPoint };
export { ARM_BIOMECH, ARM_CORRECTIONS, LEGACY_TO_DETAILED };

export type ArmWeakTest = {
  gripSupportMaxKg?: number; // Rolling Thunder max
  gripAxleMaxKg?: number; // Apollon Axle max
  pinchHoldSec?: number; // pinch hold
  cupFails?: boolean; // кисть открывается
  risingFails?: boolean; // пальцы уходят
  pronationFails?: boolean;
  supinationFails?: boolean;
  sidePressureFails?: boolean;
  backPressureFails?: boolean;
};

export interface ArmWeakDiagnosis {
  weakMuscles: ArmMuscle[];
  weakPatterns: string[];
  priorities: Array<{ muscle: ArmMuscle; reason: string; exercises: string[] }>;
  rationale: string[];
}

const WEAK_MAP: Record<string, { muscles: ArmMuscle[]; patterns: string[]; exercises: string[] }> = {
  cup: { muscles: ['wrist_flexors','risers'], patterns: ['cupping'], exercises: ['wrist_curl_belt','riser_lift'] },
  rising: { muscles: ['risers','thumb'], patterns: ['rising'], exercises: ['riser_lift','plate_pinch_hold'] },
  pronation: { muscles: ['pronators','brachioradialis'], patterns: ['pronation'], exercises: ['pronation_cable','pronation_sledge'] },
  supination: { muscles: ['supinators','brachialis'], patterns: ['supination'], exercises: ['supination_cable','supination_hammer'] },
  side: { muscles: ['side_pressure','shoulder_stab'], patterns: ['side_press'], exercises: ['side_press_cable','table_pushdown_iso'] },
  back: { muscles: ['back_pressure','brachialis'], patterns: ['back_drag'], exercises: ['lat_drag_belt','row_strap_hip'] },
  pinch: { muscles: ['grip_pinch','thumb'], patterns: ['grip_pinch'], exercises: ['hub_pinch','plate_pinch_hold'] },
  support: { muscles: ['grip_support','wrist_flexors'], patterns: ['grip_support'], exercises: ['rolling_thunder','apollon_axle'] },
};

export const WEAK_MAP_DETAILED: Record<ArmWeakPoint, { muscles: ArmMuscle[]; patterns: string[]; exercises: string[]; intensityPct: number }> = (() => {
  const out: any = {};
  for (const wp of Object.keys(ARM_BIOMECH) as ArmWeakPoint[]) {
    const bio = ARM_BIOMECH[wp];
    const corr = ARM_CORRECTIONS[wp];
    out[wp] = { muscles: bio.weakMuscles as ArmMuscle[], patterns: [wp], exercises: corr?.exercises || bio.corrections, intensityPct: bio.intensityPct };
  }
  return out;
})();

export function weakPointToMuscles(wp: string): ArmMuscle[] {
  if (isArmWeakPoint(wp)) return (ARM_BIOMECH[wp].weakMuscles as ArmMuscle[]);
  return WEAK_MAP[wp]?.muscles || [];
}

export function expandLegacyWeakPoints(legacy: string[]): ArmWeakPoint[] {
  const out: ArmWeakPoint[] = [];
  for (const k of legacy.map(s => s.toLowerCase().trim())) {
    if (isArmWeakPoint(k)) { if (!out.includes(k as ArmWeakPoint)) out.push(k as ArmWeakPoint); continue; }
    const mapped = LEGACY_TO_DETAILED[k] || LEGACY_TO_DETAILED[k.replace('_fails','')] || [];
    for (const wp of mapped) if (!out.includes(wp)) out.push(wp);
    if (WEAK_MAP[k] && mapped.length===0) {
      // fallback — старый ключ без маппинга (не должно)
    }
  }
  return out;
}

export function diagnoseArmWeakPoint(input: {
  weakTest?: ArmWeakTest;
  manualWeak?: string[]; // cup/rising/pronation/...
  technique?: string; // hook/toproll/press
}): ArmWeakDiagnosis {
  const weakMuscles = new Set<ArmMuscle>();
  const weakPatterns = new Set<string>();
  const priorities: ArmWeakDiagnosis['priorities'] = [];
  const rationale: string[] = [];

  const wt = input.weakTest || {};
  if (wt.cupFails) {
    const e = WEAK_MAP.cup;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'wrist_flexors', reason: 'Кисть открывается (cup слаб)', exercises: e.exercises });
    rationale.push('Cup слабая — добавить wrist_flexors + risers');
  }
  if (wt.risingFails) {
    const e = WEAK_MAP.rising;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'risers', reason: 'Пальцы уходят (rising)', exercises: e.exercises });
    rationale.push('Rising слабая — risers + thumb');
  }
  if (wt.pronationFails) {
    const e = WEAK_MAP.pronation;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'pronators', reason: 'Топролл не держит', exercises: e.exercises });
    rationale.push('Пронация слабая — pronators + brachioradialis');
  }
  if (wt.supinationFails) {
    const e = WEAK_MAP.supination;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'supinators', reason: 'Хук проваливается', exercises: e.exercises });
    rationale.push('Супинация слабая — supinators + brachialis');
  }
  if (wt.sidePressureFails) {
    const e = WEAK_MAP.side;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'side_pressure', reason: 'Не дожимает боком', exercises: e.exercises });
    rationale.push('Side pressure слабая — side + shoulder_stab (с guard)');
  }
  if (wt.backPressureFails) {
    const e = WEAK_MAP.back;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'back_pressure', reason: 'Тяга на себя слабая', exercises: e.exercises });
    rationale.push('Back pressure слабая — back_pressure + brachialis');
  }
  if (wt.gripSupportMaxKg != null && wt.gripSupportMaxKg < 60) {
    const e = WEAK_MAP.support;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'grip_support', reason: `Rolling Thunder ${wt.gripSupportMaxKg}кг <60`, exercises: e.exercises });
    rationale.push('Support grip слаб — Rolling Thunder / Axle');
  }
  if (wt.pinchHoldSec != null && wt.pinchHoldSec < 10) {
    const e = WEAK_MAP.pinch;
    e.muscles.forEach(m => weakMuscles.add(m));
    e.patterns.forEach(p => weakPatterns.add(p));
    priorities.push({ muscle: 'grip_pinch', reason: `Pinch ${wt.pinchHoldSec}с <10с`, exercises: e.exercises });
    rationale.push('Pinch слаб — hub/plate pinch');
  }

  // manualWeak — поддерживает как старые 8, так и новые 12 точек
  for (const w of (input.manualWeak || [])) {
    const key = w.toLowerCase();
    if (isArmWeakPoint(key)) {
      const bio = ARM_BIOMECH[key as ArmWeakPoint];
      (bio.weakMuscles as ArmMuscle[]).forEach(m => weakMuscles.add(m));
      weakPatterns.add(key);
      continue;
    }
    const e = WEAK_MAP[key] || WEAK_MAP[key.replace('_fails','')];
    if (e) {
      e.muscles.forEach(m => weakMuscles.add(m));
      e.patterns.forEach(p => weakPatterns.add(p));
    } else {
      // legacy → detailed expansion
      const expanded = LEGACY_TO_DETAILED[key] || LEGACY_TO_DETAILED[key.replace('_fails','')];
      if (expanded) {
        for (const wp of expanded) {
          (ARM_BIOMECH[wp].weakMuscles as ArmMuscle[]).forEach(m => weakMuscles.add(m));
          weakPatterns.add(wp);
        }
      }
    }
  }

  // technique-specific
  if (input.technique === 'hook') {
    if (!weakMuscles.has('supinators')) {
      // hook needs supination
      weakPatterns.add('supination');
      rationale.push('Hook требует супинацию — проверить supinators');
    }
  } else if (input.technique === 'toproll') {
    if (!weakMuscles.has('pronators')) {
      weakPatterns.add('pronation');
      rationale.push('Toproll требует пронацию — проверить pronators');
    }
  } else if (input.technique === 'press') {
    weakPatterns.add('side_press');
    rationale.push('Press требует side_pressure');
  }

  return {
    weakMuscles: Array.from(weakMuscles),
    weakPatterns: Array.from(weakPatterns),
    priorities,
    rationale: rationale.length > 0 ? rationale : ['Слабые звенья не выявлены — баланс'],
  };
}

export function weakMusclesToSpecTargets(weakMuscles: ArmMuscle[]): string[] {
  // для arm-specialization — маппим на канонические
  return weakMuscles.slice(0, 2).map(m => m.toString());
}

export interface ArmWeakDetailedDiagnosis extends ArmWeakDiagnosis {
  weakPoints: ArmWeakPoint[];
  biomechCards: Array<{
    weakPoint: ArmWeakPoint;
    label: string;
    angleRangeDeg: [number, number];
    keyJoint: string;
    weakMuscles: string[];
    reason: string;
    corrections: string[];
    intensityPct: number;
    loadCues: string;
    technique: string[];
  }>;
}

export function diagnoseArmWeakDetailed(input: {
  weakTest?: ArmWeakTest;
  manualWeak?: string[];
  weakPoints?: ArmWeakPoint[];
  technique?: string;
}): ArmWeakDetailedDiagnosis {
  const base = diagnoseArmWeakPoint({ weakTest: input.weakTest, manualWeak: input.manualWeak, technique: input.technique });
  const explicit = (input.weakPoints || []).filter(isArmWeakPoint);
  const fromPatterns = Array.from(base.weakPatterns).filter(isArmWeakPoint) as ArmWeakPoint[];
  const legacyExpanded = expandLegacyWeakPoints(input.manualWeak || []);
  // также развернём legacy weakPatterns от weakTest (cup→cup_start+hold и т.д.)
  const weakTestExpanded: ArmWeakPoint[] = [];
  if (input.weakTest) {
    if (input.weakTest.cupFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['cup']||[]));
    if (input.weakTest.risingFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['rising']||[]));
    if (input.weakTest.pronationFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['pronation']||[]));
    if (input.weakTest.supinationFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['supination']||[]));
    if (input.weakTest.sidePressureFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['side']||[]));
    if (input.weakTest.backPressureFails) weakTestExpanded.push(...(LEGACY_TO_DETAILED['back']||[]));
    if (input.weakTest.pinchHoldSec != null && input.weakTest.pinchHoldSec < 10) weakTestExpanded.push(...(LEGACY_TO_DETAILED['pinch']||[]));
    if (input.weakTest.gripSupportMaxKg != null && input.weakTest.gripSupportMaxKg < 60) weakTestExpanded.push(...(LEGACY_TO_DETAILED['support']||[]));
  }
  const mergedRaw = [...explicit, ...fromPatterns, ...legacyExpanded, ...weakTestExpanded];
  const uniqPoints = Array.from(new Set(mergedRaw)).slice(0, 3) as ArmWeakPoint[];
  // техника-специфичные дополнения уже в base rationale — точки не форсим, чтобы не раздувать лимит 3
  const biomechCards = uniqPoints.map(wp => {
    const bio = ARM_BIOMECH[wp];
    const corr = ARM_CORRECTIONS[wp];
    return {
      weakPoint: wp,
      label: bio.label,
      angleRangeDeg: bio.angleRangeDeg,
      keyJoint: bio.keyJoint,
      weakMuscles: bio.weakMuscles,
      reason: bio.biomechanicalReason,
      corrections: corr?.exercises || bio.corrections,
      intensityPct: bio.intensityPct,
      loadCues: bio.loadCues,
      technique: bio.technique,
    };
  });
  // обогатим rationale биомеханикой
  const extraRationale = biomechCards.map(c => `${c.label}: ${c.angleRangeDeg[0]}-${c.angleRangeDeg[1]}° ${c.keyJoint} → ${c.corrections[0]} @${Math.round(c.intensityPct*100)}%`);
  return {
    ...base,
    weakPoints: uniqPoints,
    biomechCards,
    rationale: [...base.rationale, ...extraRationale].slice(0, 8),
  };
}
