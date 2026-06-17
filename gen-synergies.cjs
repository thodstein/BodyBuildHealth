const fs = require("fs");
const catalogSrc = fs.readFileSync("src/data/support-catalog.ts", "utf-8");
const dbSrc = fs.readFileSync("src/data/support-database.ts", "utf-8");
const mapSrc = fs.readFileSync("src/data/canonical-map.ts", "utf-8");

// Parse catalog keys
const catalogRe = /^\s+(\w+):\s*\{/gm;
let m;
const catalogKeys = new Set();
while ((m = catalogRe.exec(catalogSrc)) !== null) {
  const k = m[1];
  if (!["dosage","core","standard","advanced","specialty"].includes(k)) catalogKeys.add(k);
}

// Parse canonical map
const mapRe = /[\x22\x27]([^\x22\x27]+)[\x22\x27]\s*:\s*[\x22\x27]([^\x22\x27]+)[\x22\x27]/g;
let m2;
const variantToCanonical = new Map();
while ((m2 = mapRe.exec(mapSrc)) !== null) {
  variantToCanonical.set(m2[1].toLowerCase().replace(/-/g, "_"), m2[2]);
}

// Mapping from interaction IDs to catalog IDs
const mappings = {
  "VITAMIN_D": "vitamin_d3", "VITAMIN_C": "vitamin_c", "VITAMIN_E": "vitamin_e",
  "VITAMIN_K2": "vitamin_k2", "VITAMIN_B6": "vitamin_b6", "VITAMIN_B12": "vitamin_b12",
  "VITAMIN_A": "vitamin_a", "VITAMIN_B9_FOLIC": "folate", "VITAMIN_B2": "vitamin_b2",
  "VITAMIN_B3": "vitamin_b3", "VITAMIN_B5": "vitamin_b5", "OMEGA3": "omega3",
  "BETA_ALANINE": "beta_alanine", "B_COMPLEX": "vitamin_b_complex",
  "ALPHA_LIPOIC": "alpha_lipoic", "MILK_THISTLE": "milk_thistle", "COQ10": "coq10",
  "L_THEANINE": "theanine", "L_TYROSINE": "tyrosine", "L_CARNITINE": "l_carnitine",
  "L_ARGININE": "arginine", "L_CITRULLINE": "citrulline", "HUPERZINE_A": "huperzine_a",
  "ALCAR": "l_carnitine", "GINKGO": "ginkgo", "BACOPA": "bacopa", "RHODIOLA": "rhodiola",
  "GINSENG": "ginseng", "ASHWAGANDHA": "ashwagandha", "MELATONIN": "melatonin",
  "CHOLINE": "phosphatidylcholine", "PHOSPHATIDYLSERINE": "phosphatidylserine",
  "COLLAGEN": "collagen", "GLUCOSAMINE": "glucosamine", "CHONDROITIN": "chondroitin",
  "HYALURONIC_ACID": "hyaluronic", "MSM": "msm", "BORON": "boron", "CINNAMON": "cinnamon",
  "NAC": "nac", "TUDCA": "tudca", "SELENIUM": "selenium", "ZINC": "zinc",
  "MAGNESIUM": "magnesium", "CALCIUM": "calcium", "POTASSIUM": "potassium",
  "IRON": "iron", "COPPER": "copper", "IODINE": "iodine", "CHROMIUM": "chromium",
  "MOLYBDENUM": "molybdenum", "VANADIUM": "vanadium", "LITHIUM": "lithium",
  "CREATINE": "creatine", "BERBERINE": "berberine", "CURCUMIN": "curcumin",
  "EGCG": "egcg", "QUERCETIN": "quercetin", "RESVERATROL": "resveratrol",
  "ASTAXANTHIN": "astaxanthin", "TAURINE": "taurine", "GARLIC": "garlic",
  "GINGER": "ginger", "CITICOLINE": "citicoline", "ALPHA_GPC": "alpha_gpc",
  "PIRACETAM": "piracetam", "VINPOCETINE": "vinpocetine", "FOLATE": "folate",
  "BIOTIN": "biotin", "INOSITOL": "inositol", "BETAINE": "betaine",
  "PQQ": "pqq", "PTEROSTILBENE": "pterostilbene", "SAW_PALMETTO": "saw_palmetto",
  "HCG": "hcg", "PROBIOTICS": "probiotics", "PREBIOTIC_FIBER": "prebiotics",
  "GLUTAMINE": "glutamine", "ELECTROLYTES": "electrolyte_complex",
  "TELMISARTAN": "telmisartan", "NEBIVOLOL": "nebivolol", "METFORMIN": "metformin",
  "FINASTERIDE": "finasteride", "CABERGOLINE": "cabergoline", "TESTOSTERONE": "testosterone",
  "CAFFEINE": "caffeine", "SILYMARIN": "milk_thistle", "BOSWELLIA": "boswellia",
  "CRANBERRY": "cranberry", "LIONS_MANE": "lions_mane", "CORDYCEPS": "cordyceps",
  "MACA": "maca", "HOLY_BASIL": "holy_basil", "GOTU_KOLA": "gotu_kola",
  "ECDYSTERONE": "ecdysterone", "SHILAJIT": "shilajit", "SCHISANDRA": "schisandra",
  "5HTP": "x5htp", "HGH": "ipamorelin", "IGF1": "igf1",
  "NSAIDS": "nsaid_drugs", "ANTICOAGULANTS": "anticoagulant_drugs",
  "BETA_BLOCKERS": "beta_blocker_drugs", "STATINS": "statin_drugs",
  "ANTIBIOTICS": "antibiotic_drugs", "ANTIDEPRESSANTS": "antidepressant_drugs",
  "BENZODIAZEPINES": "anxiolytic_drugs", "ANTICONVULSANTS": "anticonvulsant_drugs",
  "ANTICHOLINERGICS": "antipsychotic_drugs", "PPI": "ppi_drugs",
  "DIURETICS": "diuretic_drugs", "GLUCOSE_LOWERING_DRUGS": "antidiabetic_drugs",
  "ORAL_DRUGS": "pharma_drugs", "MINERALS": "colloidal_minerals",
  "STIMULANTS": "stimulant_complex", "ANTIHISTAMINES": "antihistamine_drugs",
  "HYPOTENSIVES": "arb_drugs", "LOOP_DIURETICS": "diuretic_drugs",
  "THIAZIDE_DIURETICS": "diuretic_drugs", "SERMS": "tamoxifen",
  "AROMATASE_INHIBITOR": "finasteride", "ACE_INHIBITORS": "ace_inhibitor_drugs",
  "DIGOXIN": "beta_blocker_drugs", "WARFARIN": "anticoagulant_drugs",
  "CYCLOSPORINE": "immunosuppressant_drugs", "METHOTREXATE": "immunosuppressant_drugs",
  "CHEMOTHERAPY": "antibiotic_drugs", "ORAL_CONTRACEPTIVES": "progesterone",
  "ORAL_AAS": "testosterone", "AAS": "testosterone", "AAS_CYCLE": "testosterone",
  "STEROIDS": "corticosteroid_drugs", "SILDENAFIL": "pt141",
  "KETOTIFEN": "antihistamine_drugs", "NANDROLONE": "testosterone",
  "TRENBOLONE": "testosterone", "OXYMETOLONE": "testosterone",
  "ANAVAR": "testosterone", "CLENBUTEROL": "stimulant_complex",
  "EPHEDRINE": "stimulant_complex", "SYNEPHRINE": "stimulant_complex",
  "YOHIMBINE": "stimulant_complex", "NICOTINE": "stimulant_complex",
  "ALCOHOL": "gaba", "GRAPEFRUIT": "citrus_bioflavonoids",
  "ST_JOHNS_WORT": "holy_basil", "NITRATES": "electrolyte_complex",
  "PARACETAMOL": "nsaid_drugs", "SSRIs": "antidepressant_drugs",
  "MAOI": "antidepressant_drugs", "KETO_DIET": "mct",
  "D_MANNOSE": "cranberry", "I3C": "sulforaphane",
  "CALCIUM_D_GLUCARATE": "calcium", "LECITHIN": "phosphatidylcholine",
  "VITEX": "saw_palmetto", "BLACK_COHOSH": "holy_basil",
  "EVENING_PRIMROSE": "omega6", "BORAGE": "omega6",
  "TRIBULUS": "d_aspartic_acid", "DAA": "d_aspartic_acid",
  "RED_CLOVER": "soy_isoflavones", "BETA_SITOSTEROL": "saw_palmetto",
  "PIPERINE": "curcumin", "SODIUM": "sodium", "FOLIC_ACID": "folate",
  "LIPID_COMPLEX": "lipid_complex", "BRILLIANT_SIGHT": "lutein",
  "ANTIOX_COMPLEX": "antioxidant_complex",
};

function toCanonical(subId) {
  if (catalogKeys.has(subId)) return subId;
  const lower = subId.toLowerCase().replace(/-/g, "_");
  if (catalogKeys.has(lower)) return lower;
  if (mappings[subId]) return mappings[subId];
  const mapKey = variantToCanonical.get(lower);
  if (mapKey && catalogKeys.has(mapKey)) return mapKey;
  return null;
}

// Parse ALL interactions
const intRe = /interactionId:\s*'([^']+)',\s*substanceA:\s*'([^']+)',\s*substanceB:\s*'([^']+)',\s*type:\s*'(synergy|conflict|caution)'/g;
let m3;
const interactions = [];
while ((m3 = intRe.exec(dbSrc)) !== null) {
  interactions.push({id: m3[1], a: m3[2], b: m3[3], type: m3[4]});
}

// Build per-substance synergy/conflict data
const substanceData = {};
for (const key of catalogKeys) {
  substanceData[key] = { synergies: [], conflicts: [] };
}

for (const int of interactions) {
  const a = toCanonical(int.a);
  const b = toCanonical(int.b);
  if (!a || !b) continue;
  
  // Add synergy/conflict entry with effect description
  const entry = { with: b, effect: int.id, severity: "MEDIUM" };
  const entryA = { with: a, effect: int.id, severity: "MEDIUM" };
  
  if (int.type === "synergy") {
    if (substanceData[a]) substanceData[a].synergies.push({ with: b, effect: "", mechanism: "", severity: "MEDIUM" });
    if (substanceData[b]) substanceData[b].synergies.push({ with: a, effect: "", mechanism: "", severity: "MEDIUM" });
  } else if (int.type === "conflict") {
    if (substanceData[a]) substanceData[a].conflicts.push({ with: b, effect: "", mechanism: "", severity: "HIGH" });
    if (substanceData[b]) substanceData[b].conflicts.push({ with: a, effect: "", mechanism: "", severity: "HIGH" });
  } else { // caution
    if (substanceData[a]) substanceData[a].conflicts.push({ with: b, effect: "", mechanism: "", severity: "LOW" });
    if (substanceData[b]) substanceData[b].conflicts.push({ with: a, effect: "", mechanism: "", severity: "LOW" });
  }
}

// Count
let totalSynergies = 0;
let totalConflicts = 0;
let substancesWithSynergies = 0;
for (const [key, data] of Object.entries(substanceData)) {
  totalSynergies += data.synergies.length;
  totalConflicts += data.conflicts.length;
  if (data.synergies.length > 0 || data.conflicts.length > 0) substancesWithSynergies++;
}
console.log("Total synergies:", totalSynergies);
console.log("Total conflicts:", totalConflicts);
console.log("Substances with data:", substancesWithSynergies, "/", Object.keys(substanceData).length);

// Now generate code to fill in the catalog
let output = "";
for (const [key, data] of Object.entries(substanceData)) {
  if (data.synergies.length === 0 && data.conflicts.length === 0) continue;
  
  const synStr = data.synergies.map(s => 
    `        { with: "${s.with}", effect: "", mechanism: "", severity: "${s.severity}" }`
  ).join(",\n");
  
  const confStr = data.conflicts.map(c => 
    `        { with: "${c.with}", effect: "", mechanism: "", severity: "${c.severity}" }`
  ).join(",\n");
  
  output += `    // ${key}: ${data.synergies.length} synergies, ${data.conflicts.length} conflicts\n`;
  output += `    "${key}": { synergies: [\n${synStr}\n    ], conflicts: [\n${confStr}\n    ] },\n`;
}

fs.writeFileSync("src/data/synergy-map-generated.ts", "// AUTO-GENERATED: synergy/conflict mapping for catalog substances\nexport const SYNERGY_MAP: Record<string, { synergies: { with: string; effect: string; mechanism: string; severity: string }[]; conflicts: { with: string; effect: string; mechanism: string; severity: string }[] }> = {\n" + output + "};\n", "utf-8");
console.log("Written synergy-map-generated.ts");