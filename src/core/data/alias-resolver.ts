import { MASTER_DB } from '../master-db';
import type { AliasMap } from '../types';

const ALIASES: AliasMap = {
  "testosterone enanthate": "TESTOSTERONE", "test e": "TESTOSTERONE", "test": "TESTOSTERONE",
  "bpc157": "BPC157", "bpc-157": "BPC157", "bpc": "BPC157",
  "tb500": "TB500", "tb-500": "TB500", "tb 500": "TB500",
  "mots_c": "MOTS_C", "mots-c": "MOTS_C", "mots c": "MOTS_C",
  "semax": "SEMAX", "семакс": "SEMAX",
  "selank": "SELANK", "селанк": "SELANK",
  "l_theanine": "L_THEANINE", "theanine": "L_THEANINE",
  "l_tyrosine": "L_TYROSINE", "tyrosine": "L_TYROSINE",
  "l_glutamine": "L_GLUTAMINE", "glutamine": "L_GLUTAMINE",
  "acetyl_l_carnitine": "ALCAR", "alc": "ALCAR",
  "omega3": "OMEGA3", "omega 3": "OMEGA3", "fish oil": "OMEGA3",
  "vitamin d": "VITAMIN_D", "vit d": "VITAMIN_D", "cholecalciferol": "VITAMIN_D",
  "ashwagandha": "ASHWAGANDHA", "ksm66": "ASHWAGANDHA",
  "rhodiola": "RHODIOLA", "rhodiola rosea": "RHODIOLA",
  "berberine": "BERBERINE", "метформин": "METFORMIN", "glucophage": "METFORMIN",
  "modafinil": "MODAFINIL", "provigil": "MODAFINIL",
  "caffeine": "CAFFEINE", "кофеин": "CAFFEINE",
  "magnesium": "MAGNESIUM", "mg": "MAGNESIUM",
  "zinc": "ZINC", "цинк": "ZINC",
  "nac": "NAC", "н ацетил цистеин": "NAC",
  "curcumin": "CURCUMIN", "куркумин": "CURCUMIN",
  "coq10": "COQ10", "ubiquinone": "COQ10",
  "melatonin": "MELATONIN", "мелатонин": "MELATONIN",
  "gh": "GH", "growth hormone": "GH",
  "igf1": "IGF1", "игф1": "IGF1",
  "testosterone": "TESTOSTERONE", "тестостерон": "TESTOSTERONE",
  "estradiol": "ESTRADIOL", "эстрадиол": "ESTRADIOL", "e2": "ESTRADIOL",
  "progesterone": "PROGESTERONE", "прогестерон": "PROGESTERONE",
  "dhea": "DHEA", "дгэа": "DHEA",
  "cortisol": "CORTISOL", "кортизол": "CORTISOL",
  "t3": "T3", "liothyronine": "T3",
  "t4": "T4", "levothyroxine": "T4",
  "insulin": "INSULIN", "инсулин": "INSULIN",
  "statins": "STATINS", "atorvastatin": "STATINS",
  "metformin": "METFORMIN", "метформин": "METFORMIN",
  "ssri": "SSRI", "антидепрессанты": "SSRI",
  "nsaids": "NSAIDS", "ибупрофен": "NSAIDS", "напроксен": "NSAIDS",
  "warfarin": "WARFARIN", "варфарин": "WARFARIN",
  "doac": "DOAC", "ксарелто": "DOAC", "эликвис": "DOAC",
  "ppi": "PPI", "омепразол": "PPI",
  "glp1_agonists": "GLP1", "семаглутид": "GLP1", "оземпик": "GLP1"
};

export function resolveAlias(name: string): string {
  const raw = name.trim().toLowerCase();
  return ALIASES[raw] || raw.toUpperCase();
}

export function resolveAliases(names: string[]): string[] {
  return names.map(resolveAlias).filter(Boolean);
}

export function addCustomAlias(alias: string, canonicalId: string) {
  ALIASES[alias.toLowerCase()] = canonicalId;
}