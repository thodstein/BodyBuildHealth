// ════════════════════════════════════════════════════════════
//  PHARMA DRUG → LAB MARKERS mapping
//  Каждый препарат фармы → какие маркеры он меняет в анализах
//  Используется: DrugDetailCard, support-calculator.engine,
//                lab-pharma-correlation.engine, RiskScreen
// ════════════════════════════════════════════════════════════

import { resolvePedAlias } from './ped-alias-map';

export const PHARMA_LAB_MARKERS: Record<string, string[]> = {
  // ── AAS: Bases ──
  test_enan: ['TT','FT','E2','LH','FSH','SHBG','DHT','HCT','HGB','RBC','LDL','HDL','PSA','BP_SYSTOLIC','BP_DIASTOLIC','NT_PROBNP','D_DIMER'],
  test_cyp:  ['TT','FT','E2','LH','FSH','SHBG','DHT','HCT','HGB','RBC','LDL','HDL','PSA','NT_PROBNP'],
  test_prop: ['TT','FT','E2','LH','FSH','SHBG','DHT','HCT','RBC','LDL','HDL'],
  test_undec: ['TT','FT','E2','LH','FSH','SHBG','DHT','HCT','HGB','RBC','LDL','HDL','PSA','NT_PROBNP'],
  test_suspension: ['TT','FT','E2','LH','FSH','DHT','HCT'],
  test_mix:  ['TT','FT','E2','LH','FSH','SHBG','HCT','LDL','HDL','PSA','NT_PROBNP'],

  // ── AAS: 19-Nor ──
  tren_a:   ['LDL','HDL','PRL','ALT','AST','GGT','LH','FSH','HCT','CORTISOL','SHBG','NT_PROBNP','D_DIMER','K','SODIUM'],
  tren_acet:['LDL','HDL','PRL','ALT','AST','GGT','LH','FSH','HCT','CORTISOL','SHBG','NT_PROBNP','D_DIMER','K','SODIUM'],
  tren_e:   ['LDL','HDL','PRL','ALT','AST','GGT','LH','FSH','HCT','CORTISOL','SHBG','NT_PROBNP','D_DIMER','K','SODIUM'],
  tren_enan:['LDL','HDL','PRL','ALT','AST','GGT','LH','FSH','HCT','CORTISOL','SHBG','NT_PROBNP','D_DIMER','K','SODIUM'],
  tren_hex: ['LDL','HDL','PRL','ALT','AST','GGT','LH','FSH','HCT','CORTISOL','SHBG','NT_PROBNP','D_DIMER','K','SODIUM'],
  nand_dec: ['HCT','LDL','HDL','PRL','LH','FSH','SHBG','E2','NT_PROBNP'],
  deca:     ['HCT','LDL','HDL','PRL','LH','FSH','SHBG','E2','NT_PROBNP'],
  nand_pp:  ['HCT','LDL','HDL','PRL','LH','FSH','SHBG','E2','NT_PROBNP'],
  npp:      ['HCT','LDL','HDL','PRL','LH','FSH','SHBG','E2','NT_PROBNP'],
  nand_pheny:['HCT','LDL','HDL','PRL','LH','FSH','SHBG','E2','NT_PROBNP'],
  trest_acet: ['HCT','LDL','HDL','PRL','LH','FSH','E2','CORTISOL','ALT','AST'],
  trest_enan: ['HCT','LDL','HDL','PRL','LH','FSH','E2','CORTISOL','ALT','AST'],
  trestolone: ['HCT','LDL','HDL','PRL','LH','FSH','E2','CORTISOL','ALT','AST'],

  // ── AAS: DHT derivatives ──
  oxan:     ['ALT','AST','GGT','HDL','LDL','SHBG','TT','FT','NT_PROBNP'],
  stanoz:   ['ALT','AST','GGT','ALP','HDL','LDL','SHBG','NT_PROBNP'],
  stan:     ['ALT','AST','GGT','ALP','HDL','LDL','SHBG','NT_PROBNP'],
  drostanolone_prop: ['HDL','LDL','SHBG','DHT','E2'],
  drostanolone_enan: ['HDL','LDL','SHBG','DHT','E2','NT_PROBNP'],
  mesterolone: ['SHBG','DHT','PSA','FT'],
  proviron: ['SHBG','DHT','PSA','FT'],
  anavar_dht:['ALT','AST','HDL','LDL','SHBG'],

  // ── AAS: Boldenone ──
  bolde_undecy: ['HCT','RBC','HGB','HDL','TT','E2','CREATININE','NT_PROBNP'],
  bold_undec: ['HCT','RBC','HGB','HDL','TT','E2','CREATININE','NT_PROBNP'],
  dhb:      ['HCT','RBC','HGB','HDL','ALT','AST','NT_PROBNP'],
  dhb_cyp:  ['HCT','RBC','HGB','HDL','ALT','AST','NT_PROBNP'],
  dhb_acetate: ['HCT','RBC','HGB','HDL','ALT','AST','NT_PROBNP'],
  dhb_propionate: ['HCT','RBC','HGB','HDL','ALT','AST','NT_PROBNP'],
  dihydroboldenone: ['HCT','RBC','HGB','HDL','ALT','AST','NT_PROBNP'],
  boldenone_undecylenate: ['HCT','RBC','HGB','HDL','TT','E2','CREATININE','NT_PROBNP'],

  // ── AAS: Orals ──
  metandienone: ['ALT','AST','GGT','HDL','LDL','E2','SHBG','BP_SYSTOLIC','NT_PROBNP','D_DIMER'],
  methand:  ['ALT','AST','GGT','HDL','LDL','E2','SHBG','BP_SYSTOLIC','NT_PROBNP','D_DIMER'],
  methandriol:  ['ALT','AST','HDL','E2'],
  oximetholone:  ['ALT','AST','GGT','HDL','LDL','HCT','BP_SYSTOLIC','NT_PROBNP','D_DIMER'],
  oxymetholone:  ['ALT','AST','GGT','HDL','LDL','HCT','BP_SYSTOLIC','NT_PROBNP','D_DIMER'],
  anadrol:  ['ALT','AST','GGT','HDL','LDL','HCT','BP_SYSTOLIC','NT_PROBNP','D_DIMER'],
  turinabol:   ['ALT','AST','HDL','LDL','SHBG'],
  trena:    ['ALT','AST','HDL','LDL','SHBG'],
  halotestin:  ['ALT','AST','HDL','LDL'],
  halo:     ['ALT','AST','HDL','LDL'],
  metenolon_oral: ['ALT','AST','HDL'],
  dimethazine: ['ALT','AST','GGT','HDL','LDL'],
  methyltestosterone: ['ALT','AST','HDL','E2'],
  methyltest: ['ALT','AST','HDL','E2'],

  // ── AAS: Others ──
  mentbolone: ['HDL','LDL','LH','FSH'],
  prim_oral: ['ALT','AST','HDL','LDL'],
  prim_enan: ['ALT','AST','HDL','LDL'],
  superdrol: ['ALT','AST','GGT','HDL','LDL','HCT','LH','FSH'],
  dimethandrosten: ['ALT','AST','GGT','HDL','LDL','HCT'],

  // ── PCT / Ancillaries ──
  clomi:    ['LH','FSH','TT','E2','CORTISOL'],
  enclomiphene: ['LH','FSH','TT','E2','SHBG'],
  tamox:    ['LH','FSH','TT','E2','HDL','DHT'],
  anastro:  ['E2','TT','LH','FSH','HDL'],
  letrozole: ['E2','TT','LH','FSH','HDL'],
  hcg:      ['TT','E2','LH','FSH'],
  caberg:   ['PRL','LH','FSH','TT'],
  pramipex: ['PRL','LH','FSH'],
  cabergoline: ['PRL','LH','FSH'],

  // ── SARMs ──
  ostarine:  ['HDL','LDL','SHBG','LH','FSH','TT'],
  ligandrol:  ['HDL','LDL','SHBG','LH','FSH','TT'],
  lgd:       ['HDL','LDL','SHBG','LH','FSH','TT'],
  rad140:    ['HDL','LDL','SHBG','LH','FSH','TT'],
  andarine:   ['HDL','LDL','SHBG'],
  yk11:     ['HDL','LDL','SHBG','LH','FSH','TT'],
  s23:      ['HDL','LDL','SHBG','LH','FSH','TT'],

  // ── Peptides / GH / Insulin ──
  hgh:      ['IGF1','IGFBP3','GLU','INS','HCT','FT4','TSH','NT_PROBNP'],
  somatropin: ['IGF1','IGFBP3','GLU','INS','HCT','FT4','TSH','NT_PROBNP'],
  igf1lr3:  ['GLU','INS','IGF1','IGFBP3','Creatinine','NT_PROBNP'],
  igf1_lr3: ['GLU','INS','IGF1','IGFBP3','Creatinine','NT_PROBNP'],
  igf1_des: ['GLU','INS','IGF1','IGFBP3','Creatinine'],
  mgf:      ['IGF1','IGFBP3','GLU','INS'],
  humalog:  ['GLU','INS','HbA1c','K','MAGNESIUM','PHOSPHORUS'],
  humulin_r:['GLU','INS','HbA1c','K'],
  lantus:   ['GLU','INS','HbA1c'],
  ins_short:['GLU','INS','HbA1c','K'],
  ins_long: ['GLU','INS','HbA1c'],
  ins_aspart:['GLU','INS','HbA1c','K'],
  ins_detemir:['GLU','INS','HbA1c'],
  mk677:    ['IGF1','IGFBP3','GLU','INS','PRL','CORTISOL','FT4'],
  cjc1295:  ['IGF1','IGFBP3','GLU','INS'],
  ipamorelin: ['IGF1','GH','CORTISOL'],
  ghrp2:    ['IGF1','GH','CORTISOL','PRL'],
  ghrp6:    ['IGF1','GH','CORTISOL','PRL','GLU'],
  hexarelin: ['IGF1','GH','CORTISOL','PRL'],

  // ── GLP-1 ──
  liraglutide: ['GLU','HbA1c','INS','HOMAIR','TRIGLYCERIDES','ALT'],
  semaglutide: ['GLU','HbA1c','INS','HOMAIR','TRIGLYCERIDES'],
  tirzepatide: ['GLU','HbA1c','INS','HOMAIR','TRIGLYCERIDES'],
  dulaglutide: ['GLU','HbA1c','INS','HOMAIR'],
  exenatide:   ['GLU','HbA1c','INS','HOMAIR'],
  lixisenatide: ['GLU','HbA1c','INS'],

  // ── Thyroid ──
  liothyronine: ['TSH','FT3','FT4','HR','GLU'],
  levothyroxine: ['TSH','FT4','FT3','HR'],
  thyroid_extract: ['TSH','FT3','FT4','HR'],

  // ── DNP / Fat Burners ──
  dnp:      ['HCT','RBC','ALT','AST','K','SODIUM','Creatinine','GLU','HR','TEMP_ORAL'],
  clenbuterol: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','K','GLU','TROPONIN_I'],
  albuterol: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','K','GLU'],
  caffeine:  ['HR','CORTISOL'],
  ephedrine: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','CORTISOL'],
  pseudoephedrine: ['HR','BP_SYSTOLIC','BP_DIASTOLIC'],

  // ── Diuretics ──
  furosemide:  ['K','SODIUM','MAGNESIUM','Creatinine','Urea','URIC_ACID','BP_DIASTOLIC'],
  spironolactone: ['K','SODIUM','E2','TT','Progesterone'],
  hydrochlorothiazide: ['K','SODIUM','MAGNESIUM','URIC_ACID','GLU'],
  indapamide:  ['K','SODIUM','MAGNESIUM','URIC_ACID','GLU'],
  torasemide:  ['K','SODIUM','MAGNESIUM','Creatinine'],

  // ── Support Pharma ──
  telmi:    ['BP_SYSTOLIC','BP_DIASTOLIC','K','URIC_ACID','ALT','AST','HOMAIR','Creatinine'],
  nebivolol: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','TROPONIN_I','NO_MARKER'],
  metformin: ['GLU','HbA1c','INS','HOMAIR','TRIGLYCERIDES','ALT','CREATININE','B12'],
  isotretinoin: ['ALT','AST','GGT','TRIGLYCERIDES','LDL','HDL'],
  lisinopril: ['BP_SYSTOLIC','BP_DIASTOLIC','K','Creatinine'],
  amlodipine: ['BP_SYSTOLIC','BP_DIASTOLIC','HR'],
  carvedilol: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','TRIGLYCERIDES'],
  bisoprolol: ['HR','BP_SYSTOLIC','BP_DIASTOLIC'],
  statin:   ['LDL','TRIGLYCERIDES','ALT','AST','CK','GLU'],
  ezetimibe: ['LDL','TRIGLYCERIDES','APO_B'],
  fibrate:  ['TRIGLYCERIDES','LDL','HDL','ALT','AST','CREATININE'],
  allopurinol: ['URIC_ACID','ALT','AST','CREATININE'],
  pde5_inhib: ['BP_SYSTOLIC','BP_DIASTOLIC'],
  prilosec: ['ALT','AST','B12','MAGNESIUM','CREATININE'],

  // ── Sleeping / Anxiety ──
  melatonin: ['CORTISOL','TSH','PRL','INS','GLU'],
  zolpidem: ['CORTISOL'],
  trazodone: ['PRL','CORTISOL','BP_SYSTOLIC'],
  mirtazapine: ['TRIGLYCERIDES','HDL','LDL','GLU','PRL','CORTISOL'],
  pregabalin: ['CREATININE'],

  // ── CNS Stimulants ──
  methylphenidate: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','PRL','TSH'],
  modafinil: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','CORTISOL','TSH'],
  atomoxetine: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','ALT','AST'],
  adderall: ['HR','BP_SYSTOLIC','BP_DIASTOLIC','CORTISOL','TSH'],
};

/** Получить маркеры анализов для препарата (резолвер алиасов: trenbolone_acetate → tren_acet → маркеры). */
export function getPharmaLabMarkers(drugId: string): string[] {
  return PHARMA_LAB_MARKERS[resolvePedAlias(drugId)] || PHARMA_LAB_MARKERS[drugId] || [];
}

/** Проверить, влияет ли препарат на конкретный маркер */
export function doesDrugAffectMarker(drugId: string, marker: string): boolean {
  return PHARMA_LAB_MARKERS[drugId]?.includes(marker) ?? false;
}

/** Получить все препараты, влияющие на маркер */
export function getDrugsByMarker(marker: string): string[] {
  const ids: string[] = [];
  for (const [id, markers] of Object.entries(PHARMA_LAB_MARKERS)) {
    if (markers.includes(marker)) ids.push(id);
  }
  return ids;
}
