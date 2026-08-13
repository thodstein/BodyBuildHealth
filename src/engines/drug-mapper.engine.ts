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
  // Extended pathology labels for new drugs
  cns_aggression: 'Андрогенная агрессия и тревожность (ЦНС)',
  hepatic_necrosis: 'Гепатоцеллюлярный некроз',
  cardiac_necrosis: 'Некроз кардиомиоцитов',
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
  // ── NEW: Added from clinical DB ──
  halotestin: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',   triggerStrength: 2.2, requiredMarkers: ['CK-18', 'GGT', 'Bile_Acids', 'ALP', 'ALT', 'AST', 'Bilirubin'] },
      { id: 'cns_neurotoxicity',     triggerStrength: 2.0, requiredMarkers: ['Cortisol_night', 'HVA', 'Serotonin', 'Dopamine'] },
      { id: 'atherosclerosis',       triggerStrength: 1.2, requiredMarkers: ['ApoB', 'oxLDL', 'HDL'] },
    ],
  },
  methyltrienolone: {
    class: '17aa_androgen',
    pathologies: [
      { id: 'hepatic_cholestasis',   triggerStrength: 2.5, requiredMarkers: ['CK-18', 'GGT', 'Bile_Acids', 'ALP', 'ALT', 'AST', 'Bilirubin'] },
      { id: 'cardiac_fibrosis',      triggerStrength: 1.8, requiredMarkers: ['Galectin-3', 'NT-proBNP', 'Troponin_I'] },
      { id: 'hpta_suppression',      triggerStrength: 2.0, requiredMarkers: ['Prolactin', 'Inhibin_B', 'LH', 'FSH', 'TT'] },
      { id: 'cns_neurotoxicity',     triggerStrength: 2.0, requiredMarkers: ['Cortisol_night', 'HVA', 'Serotonin', 'Dopamine'] },
      { id: 'renal_fsgs',            triggerStrength: 1.2, requiredMarkers: ['KIM-1', 'Cystatin_C'] },
    ],
  },
  primobolan: {
    class: 'dht_derivative',
    pathologies: [
      { id: 'atherosclerosis',       triggerStrength: 1.0, requiredMarkers: ['ApoB', 'HDL'] },
      { id: 'androgenic_alopecia',   triggerStrength: 1.2, requiredMarkers: ['DHT', 'SHBG'] },
    ],
  },
  proviron: {
    class: 'dht_derivative',
    pathologies: [
      { id: 'atherosclerosis',       triggerStrength: 1.2, requiredMarkers: ['ApoB', 'HDL', 'oxLDL'] },
      { id: 'androgenic_alopecia',   triggerStrength: 1.4, requiredMarkers: ['DHT', 'SHBG'] },
    ],
  },
  peptides_ghrp: {
    class: 'peptide',
    pathologies: [
      { id: 'insulin_resistance',    triggerStrength: 0.8, requiredMarkers: ['HOMA-IR', 'Glucose'] },
      { id: 'hpta_suppression',      triggerStrength: 0.5, requiredMarkers: ['Prolactin', 'LH'] },
    ],
  },
  peptides_ghrh: {
    class: 'peptide',
    pathologies: [
      { id: 'insulin_resistance',    triggerStrength: 0.7, requiredMarkers: ['HOMA-IR', 'Glucose', 'IGF-1'] },
      { id: 'acromegalic_remodeling', triggerStrength: 0.5, requiredMarkers: ['IGF-1', 'CTX'] },
    ],
  },
  igf1: {
    class: 'peptide',
    pathologies: [
      { id: 'insulin_resistance',    triggerStrength: 0.6, requiredMarkers: ['HOMA-IR', 'HbA1c', 'Glucose'] },
      { id: 'acromegalic_remodeling', triggerStrength: 1.0, requiredMarkers: ['IGF-1', 'IGFBP-3', 'CTX'] },
    ],
  },
  turinabol: {
    class: 'aas',
    pathologies: [
      { id: 'liver_stress',          triggerStrength: 0.5, requiredMarkers: ['ALT', 'AST', 'GGT'] },
      { id: 'dyslipidemia',          triggerStrength: 0.4, requiredMarkers: ['HDL', 'LDL', 'Triglycerides'] },
      { id: 'hpta_shutdown',         triggerStrength: 0.6, requiredMarkers: ['LH', 'FSH', 'Total Testosterone'] },
    ],
  },
  superdrol: {
    class: 'aas',
    pathologies: [
      { id: 'liver_stress',          triggerStrength: 1.0, requiredMarkers: ['ALT', 'AST', 'GGT', 'Total Bilirubin'] },
      { id: 'dyslipidemia',          triggerStrength: 0.6, requiredMarkers: ['HDL', 'LDL', 'Triglycerides'] },
      { id: 'hpta_shutdown',         triggerStrength: 0.7, requiredMarkers: ['LH', 'FSH', 'Total Testosterone'] },
      { id: 'hyperfiltration',       triggerStrength: 0.5, requiredMarkers: ['Creatinine', 'eGFR', 'Urea'] },
    ],
  },
  glp1: {
    class: 'glp1',
    pathologies: [
      { id: 'insulin_resistance',    triggerStrength: 0.7, requiredMarkers: ['HOMA-IR', 'HbA1c', 'Glucose'] },
      { id: 'pancreatic_stress',     triggerStrength: 0.3, requiredMarkers: ['Lipase', 'Amylase'] },
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
  test_enan: 'testosterone', test_prop: 'testosterone', test_cyp: 'testosterone',
  test_undec: 'testosterone', sustanon: 'testosterone', test_base: 'testosterone',
  test_susp: 'testosterone',
  // Trenbolone esters
  tren_acet: 'trenbolone', tren_enan: 'trenbolone', tren_hex: 'trenbolone',
  tren_base: 'trenbolone', parabolan: 'trenbolone',
  // Nandrolone esters
  npp: 'nandrolone', deca: 'nandrolone', nandrolone_decanoate: 'nandrolone',
  nand_dec: 'nandrolone', nand_pp: 'nandrolone', nand_pheny: 'nandrolone',
  trest_acet: 'nandrolone', trest_enan: 'nandrolone',
  // Boldenone esters
  bold_undec: 'boldenone', boldenone_undecylenate: 'boldenone', eq: 'boldenone', equipoise: 'boldenone',
  dhb: 'boldenone', dihydroboldenone: 'boldenone', bolde_undecy: 'boldenone', dhb_cyp: 'boldenone',
  dhb_acetate: 'boldenone', dhb_propionate: 'boldenone',
  // Drostanolone (Masteron) esters
  drostanolone_prop: 'masteron', drostanolone_enan: 'masteron',
  masteron_propionate: 'masteron', masteron_enanthate: 'masteron',
  // Primobolan / Methenolone
  prim_enan: 'primobolan', methenolone: 'primobolan', prim_oral: 'primobolan', metenolon_oral: 'primobolan',
  // Oral 17-aa
  methand: 'dianabol', methandrostenolone: 'dianabol', dbol: 'dianabol',
  metandienone: 'dianabol', methandriol: 'dianabol',
  oxan: 'oxandrolone', anavar: 'oxandrolone', anavar_dht: 'oxandrolone',
  stan: 'stanozolol', stanozolol_oral: 'stanozolol', winstrol: 'stanozolol', stanoz: 'stanozolol',
  anadrol: 'anadrol', oxymetholone: 'anadrol', oximetholone: 'anadrol',
  trena: 'turinabol', turinabol: 'turinabol',
  halo: 'halotestin', fluoxymesterone: 'halotestin', halotestin_oral: 'halotestin',
  superdrol: 'superdrol', methyldrostanolone: 'superdrol', methyltrienolone: 'methyltrienolone', metribolone: 'methyltrienolone',
  dimethazine: 'dianabol', methyltestosterone: 'testosterone', dimethandrosten: 'dianabol',
  mentbolone: 'nandrolone',
  // DHT derivatives
  mesterolone: 'proviron',
  // Peptides/support
  hgh: 'growth_hormone', somatropin: 'growth_hormone',
  insulin_short: 'insulin', ins_long: 'insulin', insulin_glargine: 'insulin',
  ins_aspart: 'insulin', insulin_aspart: 'insulin', insulin_lispro: 'insulin',
  ins_detemir: 'insulin', insulin_detemir: 'insulin',
  clen: 'clenbuterol', clenbuterol_hydrochloride: 'clenbuterol',
  // Peptides — GHRP
  ghrp6: 'peptides_ghrp', ghrp2: 'peptides_ghrp', ipamorelin: 'peptides_ghrp',
  hexarelin: 'peptides_ghrp',
  // Peptides — GHRH
  cjc1295: 'peptides_ghrh', sermorelin: 'peptides_ghrh', tesamorelin: 'peptides_ghrh',
  mk677: 'peptides_ghrh',
  // IGF-1
  igf1_lr3: 'igf1', igf1_des: 'igf1',
  // SARMs — map to closest known drug
  ostarine: 'oxandrolone', lgd: 'dianabol', rad140: 'dianabol', s23: 'dianabol',
  ligandrol: 'dianabol', andarine: 'oxandrolone', yk11: 'dianabol',
  // PCT / Ancillaries
  clomi: 'clomiphene', enclomiphene: 'clomiphene', tamox: 'tamoxifen',
  anastro: 'anastrozole', letrozole: 'letrozole', hcg: 'hcg',
  caberg: 'cabergoline', pramipex: 'cabergoline', cabergoline: 'cabergoline',
  // Insulin
  humalog: 'insulin', humulin_r: 'insulin', lantus: 'insulin',
  // GLP-1
  liraglutide: 'glp1', semaglutide: 'glp1', dulaglutide: 'glp1', exenatide: 'glp1', lixisenatide: 'glp1', tirzepatide: 'glp1',
  // Thyroid
  liothyronine: 'thyroid', levothyroxine: 'thyroid', thyroid_extract: 'thyroid',
  // Fat burners / CNS
  dnp: 'dnp', albuterol: 'clenbuterol', caffeine: 'caffeine', ephedrine: 'ephedrine', pseudoephedrine: 'ephedrine',
  // Diuretics
  furosemide: 'diuretic', spironolactone: 'diuretic', hydrochlorothiazide: 'diuretic',
  indapamide: 'diuretic', torasemide: 'diuretic',
  // Support pharma
  telmi: 'telmisartan', nebivolol: 'beta_blocker', metformin: 'metformin',
  isotretinoin: 'isotretinoin', lisinopril: 'ace_inhibitor', amlodipine: 'ccb',
  carvedilol: 'beta_blocker', bisoprolol: 'beta_blocker', statin: 'statin',
  ezetimibe: 'ezetimibe', fibrate: 'fibrate', allopurinol: 'allopurinol',
  pde5_inhib: 'pde5', prilosec: 'ppi',
  // Sleeping / Anxiety
  melatonin: 'melatonin', zolpidem: 'z_drug', trazodone: 'antidepressant',
  mirtazapine: 'antidepressant', pregabalin: 'gabapentinoid',
  // CNS Stimulants
  methylphenidate: 'stimulant', modafinil: 'stimulant', atomoxetine: 'stimulant', adderall: 'stimulant',
};

/** Regex patterns for fuzzy matching: startsWith or includes */
const GENERIC_PATTERNS: [RegExp, string][] = [
  [/^test/i, 'testosterone'],
  [/^tren/i, 'trenbolone'],
  [/^nandrolone|^npp|^deca/i, 'nandrolone'],
  [/bold|eq|dhb|dihydrobold/i, 'boldenone'],
  [/masteron|drostanolone/i, 'masteron'],
  [/prim|methenolone/i, 'primobolan'],
  [/proviron|mesterolone/i, 'proviron'],
  [/dbol|methand|dianabol/i, 'dianabol'],
  [/turinabol|^trena/i, 'turinabol'],
  [/anavar|oxan/i, 'oxandrolone'],
  [/winstrol|stan/i, 'stanozolol'],
  [/anadrol|oxymetholone/i, 'anadrol'],
  [/halo|fluoxymesterone/i, 'halotestin'],
  [/superdrol|methyldrostanolone/i, 'superdrol'],
  [/semaglutide|tirzepatide|liraglutide|dulaglutide|glp1/i, 'glp1'],
  [/methyltrien|metribolone/i, 'methyltrienolone'],
  [/hgh|somatropin|growth/i, 'growth_hormone'],
  [/insulin|^ins_/i, 'insulin'],
  [/clen/i, 'clenbuterol'],
  [/ghrp|hexarelin|ipamorelin|^ghrp/i, 'peptides_ghrp'],
  [/cjc|sermorelin|tesamorelin|^mk677/i, 'peptides_ghrh'],
  [/igf/i, 'igf1'],
  [/ostarine|^lgd|rad|^s23/i, 'oxandrolone'],
];

/**
 * Resolve a PHARMA_DB substanceId to a generic drug name in DRUG_DATABASE.
 * Tries exact match first, then ester→generic map, then regex patterns.
 * Returns the original name if no match found.
 */
function resolveDrugName(input: string): string {
  if (input == null) return '';
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
  if (!drugs || !Array.isArray(drugs)) {
    return { activePathologies: [], requiredBiomarkers: [], unknownDrugs: [], totalDrugs: 0, knownDrugs: 0 };
  }
  const pathologyAgg: Record<string, PathologyAgg> = {};
  const allMarkers = new Set<string>();
  const unknownDrugs: string[] = [];

  for (const drug of drugs) {
    if (!drug || !drug.name) {
      unknownDrugs.push(String(drug || 'null'));
      continue;
    }
    const rawName = drug.name.toLowerCase().trim();
    const name = resolveDrugName(rawName);
    const record = DRUG_DATABASE[name];

    if (!record) {
      unknownDrugs.push(rawName);
      continue;
    }

    if (!record.pathologies) continue;
    for (const path of record.pathologies) {
      const pid = path.id;
      const strength = path.triggerStrength || 0;

      // Collect all markers
      if (!path.requiredMarkers) continue;
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
