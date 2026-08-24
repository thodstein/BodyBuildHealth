/**
 * bb-pro-presets.engine.ts — пресеты методик (DC / Fortitude / Meadows).
 * Каждый пресет = набор rep-схем + техники + сплит-рекомендация.
 * Не форсирует план, а предлагает конфигурацию для BbAutoConstructor.
 */
import type { RepSchemeId } from './bb-rep-schemes.engine';

export type ProPresetId = 'dc' | 'fortitude' | 'meadows' | 'none';

export interface ProPreset {
  id: ProPresetId;
  name: string;
  nameRu: string;
  description: string;
  repSchemeHeavy: RepSchemeId;
  repSchemePump: RepSchemeId;
  techniques: string[];
  splitHint: string[];
  volumeScheme?: 'gvt' | 'fst7' | 'gironda';
  supersetMode?: 'antagonist' | 'same_muscle' | 'giant';
  evidence: string;
}

export const PRO_PRESETS: Record<ProPresetId, ProPreset> = {
  none: {
    id: 'none', name: 'None', nameRu: 'Без пресета', description: 'Стандарт ББ-АВТО',
    repSchemeHeavy: 'hypertrophy_8_12', repSchemePump: 'pump_15_20', techniques: [], splitHint: [], evidence: '',
  },
  dc: {
    id: 'dc', name: 'DC Training', nameRu: 'DC (DoggCrapp)', description: '1 all-out RP 11-15 + extreme stretch 60-90с. Низкий объём, высокая интенсивность.',
    repSchemeHeavy: 'dc_rp', repSchemePump: 'pump_15_20', techniques: ['rest_pause', 'extreme_stretch'], splitHint: ['upper_lower_4', 'ppl_6'], evidence: 'Dante Trudel DC',
  },
  fortitude: {
    id: 'fortitude', name: 'Fortitude Training', nameRu: 'Fortitude', description: 'Muscle Rounds 4×6 с 10с, tier pump/heavy. Плотность.',
    repSchemeHeavy: 'fortitude_mr', repSchemePump: 'myo_reps', techniques: ['myo_reps', 'rest_pause'], splitHint: ['upper_lower_5', 'fullbody_4'], volumeScheme: 'fst7', supersetMode: 'giant', evidence: 'Scott Stevenson Fortitude',
  },
  meadows: {
    id: 'meadows', name: 'Mountain Dog', nameRu: 'Meadows Mountain Dog', description: 'Pre-exhaust + lengthened partials + памп. Акцент ягодичные/спина.',
    repSchemeHeavy: 'hypertrophy_8_12', repSchemePump: 'lengthened_partial', techniques: ['lengthened_partials', 'slow_eccentric'], splitHint: ['ppl_6', 'arnold_6'], evidence: 'John Meadows Mountain Dog',
  },
};

export function presetFor(id: string): ProPreset { return (PRO_PRESETS as any)[id] || PRO_PRESETS.none; }
