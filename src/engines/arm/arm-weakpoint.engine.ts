/**
 * arm-weakpoint.engine.ts — диагностика слабых звеньев армрестлинга.
 * Зеркало weakpoint-pl.ts / bb-weakpoint.ts.
 */
import type { ArmMuscle } from './arm-types';

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

  // manualWeak
  for (const w of (input.manualWeak || [])) {
    const key = w.toLowerCase();
    const e = WEAK_MAP[key] || WEAK_MAP[key.replace('_fails','')];
    if (e) {
      e.muscles.forEach(m => weakMuscles.add(m));
      e.patterns.forEach(p => weakPatterns.add(p));
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
