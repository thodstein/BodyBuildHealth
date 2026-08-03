import { SUPPORT_CATALOG_DATA } from './support-database';

export const PRICE_RUB: Record<string, number> = {
  nac: 650, milk_thistle: 400, tudca: 900, omega3: 800, coq10: 1200, magnesium: 350,
  zinc: 200, vitamin_d3: 300, vitamin_c: 250, vitamin_e: 350, selenium: 200,
  berberine: 600, curcumin: 500, alpha_lipoic: 700, collagen: 1200, glucosamine: 800,
  msm: 500, chondroitin: 900, ashwagandha: 600, rhodiola: 550, theanine: 450,
  glycine: 300, creatine: 400, l_carnitine: 700, taurine: 350, inositol: 500,
  probiotics: 1200, glutamine: 500, astragalus: 600, borax: 200, potassium: 250,
  calcium: 300, citicoline: 1200, alpha_gpc: 900, huperzine_a: 400, noopept: 800,
  piracetam: 500, lions_mane: 900, phosphatidylserine: 900, magnesium_l_threonate: 1200,
  serrapeptase: 900, nattokinase: 800, bromelain: 500, vitamin_a: 200,
  zinc_carnosine: 800, l_glutamine: 600, tongkat_ali: 1200, kefir: 300, chia: 400,
  flax_oil: 400, idebenone: 800, pqq: 900, bone_broth: 300, gelatin: 350,
  schisandra: 500, fadogia: 900, shilajit: 800,
};

const TIER_COST_FALLBACK: Record<string, number> = { core: 800, standard: 500, advanced: 300, specialty: 1200 };

export function estCost(id: string): number {
  if (PRICE_RUB[id]) return PRICE_RUB[id];
  const c = SUPPORT_CATALOG_DATA[id];
  if (!c) return 500;
  return TIER_COST_FALLBACK[c.tier as string] || 500;
}