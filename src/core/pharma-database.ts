import { PharmaSubstance } from './types';
import { TESTOSTERONE_SUBS } from './pharma-db/testosterone';
import { TRENBOLONE_SUBS } from './pharma-db/trenbolone';
import { NANDROLONE_SUBS } from './pharma-db/nandrolone';
import { BOLDENONE_SUBS } from './pharma-db/boldenone';
import { PRIMOBOLAN_SUBS } from './pharma-db/primobolan';
import { ORAL_17AA_SUBS } from './pharma-db/oral-17aa';
import { SARM_SUBS } from './pharma-db/sarm';
import { PEPTIDES_GH_SUBS } from './pharma-db/peptides-gh';
import { IGF_MGF_SUBS } from './pharma-db/igf-mgf';
import { INSULIN_SUBS } from './pharma-db/insulin';
import { DROSTANOLONE_SUBS } from './pharma-db/drostanolone';
import { CLASS_DEFAULTS } from './pharma-db/class-defaults';

export const PHARMA_DB: Record<string, PharmaSubstance> = {
  ...TESTOSTERONE_SUBS,
  ...TRENBOLONE_SUBS,
  ...NANDROLONE_SUBS,
  ...BOLDENONE_SUBS,
  ...PRIMOBOLAN_SUBS,
  ...ORAL_17AA_SUBS,
  ...SARM_SUBS,
  ...PEPTIDES_GH_SUBS,
  ...IGF_MGF_SUBS,
  ...INSULIN_SUBS,
  ...DROSTANOLONE_SUBS,
};

export function getPharmaDetail(id: string): PharmaSubstance | null {
  const raw = PHARMA_DB[id];
  if (!raw) return null;
  const defaults = CLASS_DEFAULTS[raw.class];
  if (!defaults) return raw;
  return {
    ...defaults,
    ...raw,
    mechanisms: raw.mechanisms || defaults.mechanisms,
    sideEffects: raw.sideEffects || defaults.sideEffects,
    contraindications: raw.contraindications || defaults.contraindications,
    description: raw.description || defaults.description,
    dosageRange: raw.dosageRange || defaults.dosageRange,
  };
}

export const SUBSTANCE_LIST = Object.values(PHARMA_DB);
export const SUBSTANCES_BY_CLASS: Record<string, PharmaSubstance[]> = {};
SUBSTANCE_LIST.forEach(s => {
  if(!SUBSTANCES_BY_CLASS[s.class]) SUBSTANCES_BY_CLASS[s.class] = [];
  SUBSTANCES_BY_CLASS[s.class].push(s);
});

export const PHARMA_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'glp1', 'insulin',
  'drostanolone', 'dht_inject', 'dht_derivative', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other'
] as const;

type PharmaClass = typeof PHARMA_CLASSES[number];
