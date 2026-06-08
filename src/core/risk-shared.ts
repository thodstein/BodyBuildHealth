// ============================================================
// Shared drug mechanism weights and PD system map
// Used by risk.engine.ts and weekly-risk-dynamics.engine.ts
// ============================================================

export const PD_SYSTEM_MAP: Record<string, { pdKey: string; weight: number }> = {
  cardio:          { pdKey: 'lipid_impact',    weight: 0.6 },
  hepatic:         { pdKey: 'hepatotoxicity',  weight: 1.0 },
  renal:           { pdKey: 'hct_impact',      weight: 0.15 },
  neuro:           { pdKey: 'neuro_toxicity',  weight: 1.0 },
  endocrine:       { pdKey: 'aromatization',   weight: 0.5 },
  hematologic:     { pdKey: 'hct_impact',      weight: 0.5 },
  reproductive:    { pdKey: 'progestogenic',    weight: 0.4 },
  musculoskeletal: { pdKey: 'lipid_impact',    weight: 0.1 },
  metabolic:       { pdKey: 'aromatization',   weight: 0.4 },
  ghigf:           { pdKey: 'AR_affinity',     weight: 0.3 },
  ins_axis:        { pdKey: 'lipid_impact',    weight: 0.3 },
  neuro_toxicity:  { pdKey: 'neuro_toxicity',  weight: 1.0 },
  blood:           { pdKey: 'hct_impact',      weight: 0.4 },
  vessels:         { pdKey: 'lipid_impact',    weight: 0.5 },
};

export const DRUG_MECH_WEIGHTS: Record<string, Record<number, number>> = {
  testosterone_enanthate:    { 5: 0.6, 6: 0.4, 7: 0.2 },
  testosterone_cypionate:    { 5: 0.6, 6: 0.4, 7: 0.2 },
  testosterone_propionate:   { 5: 0.6, 6: 0.3, 7: 0.1 },
  test_enan:                 { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_cyp:                  { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_undec:                { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_prop:                 { 5: 0.6, 6: 0.3, 7: 0.1 },
  trenbolone_acetate:        { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  trenbolone_enanthate:      { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  tren_acetate:              { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  tren_enan:                 { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  tren_hex:                  { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  nandrolone_decanoate:      { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  nandrolone_phenylprop:     { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  npp:                       { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  deca:                       { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  boldenone_undecylenate:    { 5: 0.3, 2: 0.3, 7: 0.2, 6: 0.1 },
  bold_undec:                { 5: 0.3, 2: 0.3, 7: 0.2, 6: 0.1 },
  methenolone_enanthate:     { 5: 0.3, 1: 0.1, 7: 0.1 },
  prim_enan:                 { 5: 0.3, 1: 0.1, 7: 0.1 },
  oxandrolone:               { 1: 0.7, 2: 0.3, 5: 0.1 },
  stanozolol:                { 1: 0.8, 2: 0.4, 6: 0.3, 4: 0.1 },
  methandienone:             { 1: 0.7, 2: 0.3, 5: 0.3, 6: 0.2 },
  oxymetholone:              { 1: 0.9, 2: 0.3, 6: 0.2, 4: 0.1 },
  halotestin:                { 1: 0.8, 6: 0.4, 3: 0.2, 5: 0.2 },
  anastrozole:               { 5: 0.2, 2: 0.1, 4: 0.2 },
  letrozole:                 { 5: 0.3, 2: 0.1, 4: 0.3 },
  cabergoline:               { 5: 0.4, 1: 0.2, 4: 0.1 },
  clomid:                    { 5: 0.2, 4: 0.1 },
  hcg:                       { 5: 0.5 },
  tamoxifen:                 { 5: 0.2, 7: 0.1 },
  mk677:                     { 2: 0.2, 5: 0.3, 7: 0.1 },
  ostarine:                  { 5: 0.2, 2: 0.1, 7: 0.1 },
  lgd4033:                   { 5: 0.3, 2: 0.1, 7: 0.1 },
  rad140:                    { 5: 0.3, 2: 0.1, 7: 0.15 },
  gw501516:                  { 2: 0.5, 7: 0.3 },
  sr9009:                    { 2: 0.3 },
  bpc157:                    {},
  semax:                     { 1: 0.1, 3: 0.15 },
  tb500:                     {},
  meloxicam:                 { 1: 0.15, 4: 0.2, 6: 0.1 },
  diclofenac:                { 1: 0.2, 4: 0.15, 6: 0.15 },
};

export function getDrugMechWeight(drugId: string, mech: number): number {
  const normalizedId = drugId.replace(/[-\s]/g, '_').toLowerCase();
  const weights = DRUG_MECH_WEIGHTS[normalizedId] || DRUG_MECH_WEIGHTS[drugId] || {};
  return weights[mech] || 0;
}
