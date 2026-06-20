// ============================================================
// Health Engine v7.0 — Inter-Organ Influence Matrix & Stazh Enhancement
// From spec: Section 5 (inter-organ) and Section 3 (stazh)
// ============================================================

// Inter-organ influence matrix: Impact_{orgA → orgB}
// Value = multiplier of State_k applied to Damage_org
export const INTER_ORGAN_MATRIX: Record<string, Record<string, number>> = {
  // Source → Target: how much source organ state affects target damage
  heart:      { vessels: 0.15, kidney: 0.10, metabolic: 0.05 },
  vessels:    { heart: 0.20, kidney: 0.10, neuro_toxicity: 0.05 },
  liver:      { metabolic: 0.20, endocrine: 0.10, hematologic: 0.05 },
  kidney:    { heart: 0.10, vessels: 0.15, endocrine: 0.05 },
  metabolic: { heart: 0.10, liver: 0.10, ins_axis: 0.15 },
  ghigf:      { heart: 0.10, liver: 0.08, kidney: 0.08, metabolic: 0.10 },
  ins_axis:  { metabolic: 0.15, heart: 0.10, vessels: 0.10 },
  neuro_toxicity: { endocrine: 0.10, heart: 0.05, vessels: 0.05 },
  endocrine: { reproductive: 0.20, metabolic: 0.10, hematologic: 0.05 },
  hematologic: { heart: 0.15, vessels: 0.10, kidney: 0.05 },
  reproductive: { endocrine: 0.10, metabolic: 0.05 },
};

// Stazh enhancement: multiplies chronic damage based on lifetime/continuous exposure
export function stazhChronicMultiplier(
  stazhLifeYears: number,    // total lifetime exposure in years
  stazhContMonths: number,    // continuous current cycle in months
  inflammCore: number = 0     // core inflammation index
): number {
  // Tox_life = Tox(Stazh_life), Tox_cont = Tox(Stazh_cont)
  // Stazh_life = T_life / T_life_ref (1 year = 1)
  // Stazh_cont = T_on_cont / T_on_ref (1 month = 1)
  const toxLife = 1 + 0.03 * Math.max(0, stazhLifeYears);  // 3% per year
  const toxCont = 1 + 0.04 * Math.max(0, stazhContMonths); // 4% per month
  const inflameBoost = 1 + 0.1 * Math.max(0, inflammCore);  // inflammation boosts
  return Math.min(3.0, toxLife * toxCont * inflameBoost);
}

// Adaptive sensitivity modulation: kDown increases with toxicity
export function adaptiveKDown(
  kDownBase: number,
  toxLife: number,   // Tox(Stazh_life)
  toxCont: number,   // Tox(Stazh_cont)
  inflameCore: number
): number {
  // α_down = α_down,0 × (1 + κ_life × Tox_life + κ_cont × Tox_cont + κ_infl × Inflamm_core)
  const kappaLife = 0.3;
  const kappaCont = 0.4;
  const kappaInfl = 0.2;
  return kDownBase * (1 + kappaLife * toxLife + kappaCont * toxCont + kappaInfl * inflameCore);
}

// Lifestyle recovery factors (Z-score based)
export function lifestyleRecoveryFactors(
  sleepHours: number,     // actual sleep
  stressLevel: number,    // 0-10
  activityLevel: number, // 0-10
  alcoholPerWeek: number  // standard drinks/week
): { sleep: number; stress: number; activity: number } {
  // Z-scores relative to optimal
  const sleepZ = (sleepHours - 7.5) / 1.0;  // optimal ~7.5h
  const stressZ = (stressLevel - 3) / 2.5;   // optimal ~3 (low stress)
  const activityZ = (activityLevel - 5) / 2.5; // optimal ~5 (moderate)
  return {
    sleep: sleepZ,
    stress: stressZ,
    activity: activityZ,
  };
}

// Stimulant/Depressant core indices
export function computeStimulantCore(concentrations: Record<string, number>): number {
  // Stimulants: caffeine, ephedrine, clenbuterol, nicotine, etc.
  let stim = 0;
  const stimSubstances: Record<string, number> = {
    caffeine: 0.002,
    ephedrine: 0.05,
    clenbuterol: 0.08,
    nicotine: 0.003,
    albuterol: 0.02,
    tirzatide: 0.01,
  };
  for (const [id, conc] of Object.entries(concentrations)) {
    stim += conc * (stimSubstances[id] ?? 0);
  }
  return Math.min(3, stim);
}

export function computeDepressantCore(concentrations: Record<string, number>, alcoholPerWeek: number): number {
  // Depressants: alcohol, benzodiazepines, GHB, etc.
  let dep = alcoholPerWeek * 0.05;  // alcohol contribution
  const depSubstances: Record<string, number> = {
    diazepam: 0.1,
    temazepam: 0.08,
    phenobarbital: 0.06,
    ghb: 0.07,
  };
  for (const [id, conc] of Object.entries(concentrations)) {
    dep += conc * (depSubstances[id] ?? 0);
  }
  return Math.min(3, dep);
}

// Inter-organ damage contribution
export function computeInterOrganDamage(
  sourceStates: Record<string, number>, // organKey → composite state
): Record<string, number> {
  const contributions: Record<string, number> = {};
  for (const targetOrg of Object.keys(INTER_ORGAN_MATRIX)) {
    let interDamage = 0;
    const sources = INTER_ORGAN_MATRIX[targetOrg];
    for (const [sourceOrg, weight] of Object.entries(sources)) {
      const sourceState = sourceStates[sourceOrg] ?? 0;
      interDamage += weight * sourceState;
    }
    contributions[targetOrg] = interDamage;
  }
  return contributions;
}

// Reproductive system drug-threshold formulas (from spec File 2, Section 13.3)
export interface ReproductiveDrugInput {
  substanceId: string;
  dosePerWeek: number;      // mg/week
  androgenicity: number;    // relative androgenic potency
  threshold: number;         // reference dose mg/week
  aromatization: number;    // 0-1
  progestogenic: number;     // 0-1
  fiveAlpha: number;         // 0-1
  isHCG: boolean;
  hcgDose: number;           // IU/week, 0 if not HCG
  isSERM: boolean;
  sermFactor: number;        // 0-1 reduction factor
}

export function computeReproductiveRisk(
  drugs: ReproductiveDrugInput[],
  genetics: Record<string, string>
): {
  atrophy: number;
  oligospermia: number;
  morphology: number;
  motility: number;
  bph: number;
  prostateCancer: number;
  erectileDysfunction: number;
} {
  // Drug contributions to androgenic load
  let androgenicLoad = 0;
  let hcgReduction = 0;
  let sermReduction = 0;

  for (const drug of drugs) {
    const doseRatio = drug.threshold > 0 ? (drug.dosePerWeek / drug.threshold) : 0;
    androgenicLoad += Math.pow(doseRatio, 2) * drug.androgenicity;
    if (drug.isHCG && drug.hcgDose > 0) hcgReduction += 0.6;
    if (drug.isSERM) sermReduction += drug.sermFactor;
  }

  hcgReduction = Math.min(0.6, hcgReduction);
  sermReduction = Math.min(0.8, sermReduction);

  // Genetic multipliers
  const srd5a2 = genetics.SRD5A2;
  const esr1 = genetics.ESR1;
  let srd5a2Mult = 1.0;
  let esr1Mult = 1.0;
  if (srd5a2 === 'LL') srd5a2Mult = 1.8;
  else if (srd5a2 === 'LV') srd5a2Mult = 1.4;
  if (esr1 === 'PvuII+') esr1Mult = 1.4;

  // M1: Testicular atrophy
  const atrophy = androgenicLoad * (1 - hcgReduction) * 0.5;
  // M2: Oligospermia
  const oligospermia = androgenicLoad * (1 - hcgReduction) * (1 - sermReduction) * 0.45;
  // M3: Morphology
  const morphology = androgenicLoad * 0.3;
  // M4: Motility
  const motility = androgenicLoad * 0.25;
  // M5: BPH
  const bph = androgenicLoad * srd5a2Mult * 0.4;
  // M6: Prostate cancer risk
  const prostateCancer = androgenicLoad * srd5a2Mult * esr1Mult * 0.2;
  // M7: Erectile dysfunction
  const erectileDysfunction = androgenicLoad * esr1Mult * 0.35;

  return {
    atrophy: Math.min(1, atrophy),
    oligospermia: Math.min(1, oligospermia),
    morphology: Math.min(1, morphology),
    motility: Math.min(1, motility),
    bph: Math.min(1, bph),
    prostateCancer: Math.min(1, prostateCancer),
    erectileDysfunction: Math.min(1, erectileDysfunction),
  };
}
