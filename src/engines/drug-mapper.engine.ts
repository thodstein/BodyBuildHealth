/**
 * Drug-to-Pathology Mapper — TypeScript Engine
 *
 * Maps a user's pharmacological stack to active organ pathologies
 * with cumulative synergy scores (stack synergy) and required biomarkers.
 *
 * Runs entirely in-browser (Telegram Mini App / PWA). No server needed.
 * Identical algorithm to Python mdss-api/mapper.py.
 *
 * @module drug-mapper.engine
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrugEntry {
  name: string;      // lowercase, e.g. 'trenbolone'
  dosageMg: number;  // weekly mg
  class?: string;    // auto-filled from DB
}

export interface PathologyMapping {
  id: string;
  triggerStrength: number;
  requiredMarkers: string[];
}

export interface DrugRecord {
  class: string;
  pathologies: PathologyMapping[];
}

export interface StackPathology {
  pathologyId: string;
  pathologyLabel: string;
  cumulativeTriggerStrength: number;
  contributingDrugs: string[];
}

export interface MapperResult {
  activePathologies: StackPathology[];
  requiredBiomarkers: string[];
  unknownDrugs: string[];
  totalDrugs: number;
  knownDrugs: number;
}

// ---------------------------------------------------------------------------
// Pathology Labels (human-readable)
// ---------------------------------------------------------------------------

const PATHOLOGY_LABELS: Record<string, string> = {
  renal_fsgs: 'FSGS / Нефропатия (почки)',
  cardiac_fibrosis: 'Фиброз миокарда / Кардиомиопатия',
  cns_neurotoxicity: 'Нейротоксичность ЦНС',
  hpta_suppression: 'Подавление оси HPTA',
  hepatic_cholestasis: 'Холестаз / Гепатотоксичность',
  atherosclerosis: 'Атеросклероз / Дислипидемия',
  joint_desiccation: 'Десикация суставов / Остеоартроз',
  insulin_resistance: 'Инсулинорезистентность / Диабет',
  vascular_hypertrophy: 'Гипертрофия сосудов / Воспаление',
  erythrocytosis_hyperviscosity: 'Эритроцитоз / Гипервязкость крови',
  androgenic_alopecia: 'Андрогенная алопеция',
  prostate_hyperplasia: 'Гиперплазия простаты',
  acromegalic_remodeling: 'Акромегалическое ремоделирование',
};

// ---------------------------------------------------------------------------
// Pharmacological Knowledge Graph — DRUG_DATABASE
// ---------------------------------------------------------------------------

export const DRUG_DATABASE: Record<string, DrugRecord> = {
  // ---- 19-nor androgens ----
  trenbolone: {
    class: '19-nor_androgen',
    pathologies: [
      { id: 'renal_fsgs',              triggerStrength: 1.5, requiredMarkers: ['KIM-1', 'Cystatin_C'] },
      { id: 'cardiac_fibrosis',        triggerStrength: 1.2, requiredMarkers: ['Galectin-3', 'NT-proBNP'] },
      { id: 'cns_neurotoxicity',       triggerStrength: 1.8, requiredMarkers: ['Cortisol_night', 'HVA'] },
    ],
  },
  nandrolone: {
    class: '19-nor_androgen',
    pathologies: [
      { id: 'cardiac_fibrosis',        triggerStrength: 1.0, requiredMarkers: ['Galectin-3', 'NT-proBNP', 'ADMA'] },
      { id: 'hpta_suppression',        triggerStrength: 1.5, requiredMarkers: ['Prolactin', 'Inhibin_B', 'LH'] },
    ],
  },
  // ---- 17-alpha-alkylated androgens ----
  stanozolol: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',     triggerStrength: 1.5, requiredMarkers: ['CK-18', 'GGT', 'Bile_Acids', 'ALP'] },
      { id: 'atherosclerosis',         triggerStrength: 1.6, requiredMarkers: ['ApoB', 'oxLDL', 'HDL'] },
      { id: 'joint_desiccation',       triggerStrength: 1.4, requiredMarkers: ['CTX', 'COMP'] },
    ],
  },
  // ---- Peptide hormones ----
  insulin: {
    class: 'peptide_hormone',
    pathologies: [
      { id: 'insulin_resistance',      triggerStrength: 1.5, requiredMarkers: ['HOMA-IR', 'C-Peptide', 'HbA1c'] },
      { id: 'vascular_hypertrophy',    triggerStrength: 1.1, requiredMarkers: ['VEGF', 'hs-CRP'] },
    ],
  },
  // ---- Veterinary / aromatase-inhibiting androgen ----
  boldenone: {
    class: 'aromatase_inhibitor_androgen',
    pathologies: [
      { id: 'erythrocytosis_hyperviscosity', triggerStrength: 1.7, requiredMarkers: ['Hematocrit', 'Ferritin', 'EPO'] },
      { id: 'atherosclerosis',               triggerStrength: 1.2, requiredMarkers: ['ApoB', 'oxLDL'] },
      { id: 'renal_fsgs',                    triggerStrength: 0.8, requiredMarkers: ['KIM-1', 'Cystatin_C'] },
    ],
  },
  // ---- Extended database (DHT derivatives) ----
  oxandrolone: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',     triggerStrength: 0.9, requiredMarkers: ['CK-18', 'GGT', 'ALP'] },
      { id: 'atherosclerosis',         triggerStrength: 1.3, requiredMarkers: ['ApoB', 'HDL'] },
    ],
  },
  masteron: {
    class: 'dht_derivative',
    pathologies: [
      { id: 'atherosclerosis',         triggerStrength: 1.4, requiredMarkers: ['ApoB', 'HDL', 'oxLDL'] },
      { id: 'androgenic_alopecia',     triggerStrength: 1.6, requiredMarkers: ['DHT', 'SHBG'] },
      { id: 'prostate_hyperplasia',    triggerStrength: 1.3, requiredMarkers: ['PSA', 'DHT'] },
    ],
  },
  testosterone: {
    class: 'endogenous_androgen',
    pathologies: [
      { id: 'hpta_suppression',            triggerStrength: 1.0, requiredMarkers: ['LH', 'FSH', 'TT', 'SHBG'] },
      { id: 'erythrocytosis_hyperviscosity', triggerStrength: 1.0, requiredMarkers: ['Hematocrit', 'Ferritin'] },
      { id: 'atherosclerosis',             triggerStrength: 0.8, requiredMarkers: ['ApoB', 'HDL'] },
    ],
  },
  dianabol: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',     triggerStrength: 1.7, requiredMarkers: ['CK-18', 'GGT', 'Bile_Acids', 'ALP', 'ALT', 'AST'] },
      { id: 'atherosclerosis',         triggerStrength: 1.5, requiredMarkers: ['ApoB', 'oxLDL', 'HDL'] },
      { id: 'renal_fsgs',              triggerStrength: 0.6, requiredMarkers: ['KIM-1', 'Cystatin_C'] },
    ],
  },
  anadrol: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',           triggerStrength: 2.0, requiredMarkers: ['CK-18', 'GGT', 'Bile_Acids', 'ALP', 'ALT', 'AST', 'Bilirubin'] },
      { id: 'erythrocytosis_hyperviscosity', triggerStrength: 1.8, requiredMarkers: ['Hematocrit', 'Ferritin', 'EPO'] },
      { id: 'atherosclerosis',               triggerStrength: 1.3, requiredMarkers: ['ApoB', 'oxLDL', 'HDL'] },
    ],
  },
  growth_hormone: {
    class: 'peptide_hormone',
    pathologies: [
      { id: 'insulin_resistance',      triggerStrength: 1.2, requiredMarkers: ['HOMA-IR', 'HbA1c', 'IGF-1'] },
      { id: 'cardiac_fibrosis',        triggerStrength: 0.9, requiredMarkers: ['Galectin-3', 'NT-proBNP'] },
      { id: 'acromegalic_remodeling',  triggerStrength: 0.7, requiredMarkers: ['IGF-1', 'CTX'] },
    ],
  },
  clenbuterol: {
    class: 'beta2_agonist',
    pathologies: [
      { id: 'cardiac_fibrosis',        triggerStrength: 1.6, requiredMarkers: ['Galectin-3', 'NT-proBNP', 'Troponin_I'] },
      { id: 'cns_neurotoxicity',       triggerStrength: 0.9, requiredMarkers: ['Cortisol_night'] },
      { id: 'vascular_hypertrophy',    triggerStrength: 1.2, requiredMarkers: ['VEGF', 'hs-CRP'] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Ester → Generic Name Mapping (PHARMA_DB keys → DRUG_DATABASE keys)
// ---------------------------------------------------------------------------

/**
 * Maps PHARMA_DB ester-specific substance IDs to generic drug names
 * used in DRUG_DATABASE. Without this, course entries like 'tren_acet'
 * would always fall into unknownDrugs because DRUG_DATABASE only has
 * generic names like 'trenbolone'.
 */
const ESTER_TO_GENERIC: Record<string, string> = {
  // Testosterone esters
  test_enan: 'testosterone',
  test_prop: 'testosterone',
  test_cyp: 'testosterone',
  test_undec: 'testosterone',
  sustanon: 'testosterone',
  test_base: 'testosterone',
  test_susp: 'testosterone',
  // Trenbolone esters
  tren_acet: 'trenbolone',
  tren_enan: 'trenbolone',
  tren_hex: 'trenbolone',
  tren_base: 'trenbolone',
  parabolan: 'trenbolone',
  // Nandrolone esters
  npp: 'nandrolone',
  deca: 'nandrolone',
  nandrolone_decanoate: 'nandrolone',
  // Boldenone esters
  bold_undec: 'boldenone',
  boldenone_undecylenate: 'boldenone',
  eq: 'boldenone',
  equipoise: 'boldenone',
  // Drostanolone (Masteron) esters
  drostanolone_prop: 'masteron',
  drostanolone_enan: 'masteron',
  masteron_propionate: 'masteron',
  masteron_enanthate: 'masteron',
  // Oral 17-aa
  methand: 'dianabol',
  methandrostenolone: 'dianabol',
  dbol: 'dianabol',
  oxan: 'oxandrolone',
  anavar: 'oxandrolone',
  stan: 'stanozolol',
  stanozolol_oral: 'stanozolol',
  winstrol: 'stanozolol',
  anadrol: 'anadrol',
  oxymetholone: 'anadrol',
  turinabol: 'dianabol',
  halotestin: 'dianabol',
  superdrol: 'dianabol',
  // Peptides/support — map generics from PHARMA_DB
  hgh: 'growth_hormone',
  somatropin: 'growth_hormone',
  insulin_short: 'insulin',
  insulin_glargine: 'insulin',
  insulin_aspart: 'insulin',
  insulin_lispro: 'insulin',
  insulin_detemir: 'insulin',
  clen: 'clenbuterol',
  clenbuterol_hydrochloride: 'clenbuterol',
  // Finasteride/Dutasteride — interaction-only (no DRUG_DATABASE entry)
  // These won't match anything but that's fine; they interact, not cause pathology directly
};

/** Regex patterns for fuzzy matching: startsWith or includes */
const GENERIC_PATTERNS: [RegExp, string][] = [
  [/^test/i, 'testosterone'],
  [/^tren/i, 'trenbolone'],
  [/^nandrolone|^npp|^deca/i, 'nandrolone'],
  [/bold|eq/i, 'boldenone'],
  [/masteron|drostanolone/i, 'masteron'],
  [/dbol|methand|dianabol|turinabol|halotestin|superdrol/i, 'dianabol'],
  [/anavar|oxan/i, 'oxandrolone'],
  [/winstrol|stan/i, 'stanozolol'],
  [/anadrol|oxymetholone/i, 'anadrol'],
  [/hgh|somatropin|growth/i, 'growth_hormone'],
  [/insulin/i, 'insulin'],
  [/clen/i, 'clenbuterol'],
  [/primobolan|metenolone/i, 'masteron'],  // closest match in DB
];

/**
 * Resolve a PHARMA_DB substanceId to a generic drug name in DRUG_DATABASE.
 * Tries exact match first, then ester→generic map, then regex patterns.
 * Returns the original name if no match found.
 */
function resolveDrugName(input: string): string {
  const name = input.toLowerCase().trim();

  // 1. Exact match in DRUG_DATABASE
  if (DRUG_DATABASE[name]) return name;

  // 2. Ester → Generic mapping
  if (ESTER_TO_GENERIC[name]) return ESTER_TO_GENERIC[name];

  // 3. Fuzzy regex matching
  for (const [pattern, generic] of GENERIC_PATTERNS) {
    if (pattern.test(name)) return generic;
  }

  // 4. Partial match — check if any DRUG_DATABASE key is a substring
  for (const key of Object.keys(DRUG_DATABASE)) {
    if (name.includes(key)) return key;
  }

  // 5. No match — return as-is (will become unknown)
  return name;
}

// ---------------------------------------------------------------------------
// Core Engine — mapStackToPathologies
// ---------------------------------------------------------------------------

/** Aggregation record while iterating */
interface PathologyAgg {
  cumulativeTriggerStrength: number;
  contributingDrugs: string[];
}

/**
 * Maps a pharmacological stack to active organ pathologies.
 *
 * Algorithm:
 *  1. For each drug, look up in DRUG_DATABASE.
 *  2. Collect all pathologies with trigger_strength.
 *  3. If a pathology is triggered by multiple drugs → SUM strengths (stack synergy).
 *  4. Collect all required markers into a unique set (no duplicates).
 *  5. Flag unknown drugs.
 *
 * @param drugs - Array of drug entries from the user's stack.
 * @returns MapperResult with sorted pathologies, unique biomarkers, and unknown drugs.
 */
export function mapStackToPathologies(drugs: DrugEntry[]): MapperResult {
  const pathologyAgg: Record<string, PathologyAgg> = {};
  const allMarkers = new Set<string>();
  const unknownDrugs: string[] = [];

  for (const drug of drugs) {
    const rawName = drug.name.toLowerCase().trim();
    const name = resolveDrugName(rawName);
    const record = DRUG_DATABASE[name];

    if (!record) {
      unknownDrugs.push(rawName);
      continue;
    }

    for (const path of record.pathologies) {
      const pid = path.id;
      const strength = path.triggerStrength || 0;

      // Collect all markers
      for (const m of path.requiredMarkers) {
        allMarkers.add(m);
      }

      // Aggregate pathology (stack synergy)
      if (!pathologyAgg[pid]) {
        pathologyAgg[pid] = { cumulativeTriggerStrength: 0, contributingDrugs: [] };
      }
      pathologyAgg[pid].cumulativeTriggerStrength += strength;
      pathologyAgg[pid].contributingDrugs.push(rawName);
    }
  }

  // Sort by cumulative strength descending
  const activePathologies: StackPathology[] = Object.entries(pathologyAgg)
    .sort((a, b) => b[1].cumulativeTriggerStrength - a[1].cumulativeTriggerStrength)
    .map(([pid, agg]) => ({
      pathologyId: pid,
      pathologyLabel: PATHOLOGY_LABELS[pid] || pid,
      cumulativeTriggerStrength: Math.round(agg.cumulativeTriggerStrength * 100) / 100,
      contributingDrugs: [...new Set(agg.contributingDrugs)].sort(),
    }));

  const requiredBiomarkers = [...allMarkers].sort();

  return {
    activePathologies,
    requiredBiomarkers,
    unknownDrugs,
    totalDrugs: drugs.length,
    knownDrugs: drugs.length - unknownDrugs.length,
  };
}

/**
 * Get the list of all known drug names in the database.
 */
export function getKnownDrugNames(): string[] {
  return Object.keys(DRUG_DATABASE).sort();
}

/**
 * Get all drug names by class.
 */
export function getDrugsByClass(): Record<string, string[]> {
  const byClass: Record<string, string[]> = {};
  for (const [name, record] of Object.entries(DRUG_DATABASE)) {
    if (!byClass[record.class]) byClass[record.class] = [];
    byClass[record.class].push(name);
  }
  return byClass;
}
