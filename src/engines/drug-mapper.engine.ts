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
    const name = drug.name.toLowerCase().trim();
    const record = DRUG_DATABASE[name];

    if (!record) {
      unknownDrugs.push(name);
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
      pathologyAgg[pid].contributingDrugs.push(name);
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
