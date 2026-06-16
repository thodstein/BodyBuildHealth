// Substance tier classification: core (essential), standard (recommended), advanced (specific), specialty (pharma/peptide)
export const SUBSTANCE_TIER: Record<string, 'core' | 'standard' | 'advanced' | 'specialty'> = {
  // CORE — essential for any AAS support stack
  nac: 'core', tudca: 'core', magnesium: 'core', vitamin_d3: 'core', vitamin_k2: 'core',
  omega3: 'core', selenium: 'core', taurine: 'core', coq10: 'core', zinc: 'core',
  folate: 'core', vitamin_b12: 'core', vitamin_c: 'core', milk_thistle: 'core',
  alpha_lipoic: 'core', curcumin: 'core', ashwagandha: 'core', berberine: 'core',
  probiotics: 'core', vitamin_e: 'core', phosphatidylcholine: 'core',
  iron: 'core', copper: 'core', glucosamine: 'core', collagen: 'core',

  // SPECIALTY — pharma, peptides, prescription-only
  telmisartan: 'specialty', nebivolol: 'specialty', saw_palmetto: 'specialty', hcg: 'specialty',
  bpc157: 'specialty', tb500: 'specialty', meloxicam: 'specialty', diclofenac: 'specialty',

  // ADVANCED — specific goals/conditions
  astragalus: 'advanced', melatonin: 'advanced', ginseng: 'advanced', egcg: 'advanced',
  l_carnitine: 'advanced', boswellia: 'advanced', bromelain: 'advanced', msm: 'advanced',
  hyaluronic: 'advanced', chondroitin: 'advanced',
  creatine: 'advanced', beta_alanine: 'advanced', citrulline: 'advanced', arginine: 'advanced',
  d_aspartic_acid: 'advanced', tribulus: 'advanced', maca: 'advanced',
  stinging_nettle: 'advanced', pygeum: 'advanced', dimm: 'advanced',
  grape_seed_extract: 'advanced', quercetin: 'advanced', resveratrol: 'advanced', nmn: 'advanced',
  pqq: 'advanced', lions_mane: 'advanced', reishi: 'advanced', cordyceps: 'advanced',
  chaga: 'advanced', bacopa: 'advanced', ginkgo: 'advanced', rhodiola: 'advanced',
  theanine: 'advanced', '5htp': 'advanced',
};
// Default tier for substances not in this map: 'standard'

export function getSubstanceTier(id: string): 'core' | 'standard' | 'advanced' | 'specialty' {
  return SUBSTANCE_TIER[id] || 'standard';
}

export const TIER_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  core: { label: 'Ядро', emoji: '🟢', color: '#22c55e' },
  standard: { label: 'Стандарт', emoji: '🟡', color: '#eab308' },
  advanced: { label: 'Продвинутый', emoji: '🟠', color: '#f97316' },
  specialty: { label: 'Специальный', emoji: '🔴', color: '#ef4444' },
};
