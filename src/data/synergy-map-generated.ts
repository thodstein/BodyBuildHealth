// AUTO-GENERATED: synergy/conflict mapping for catalog substances
export const SYNERGY_MAP: Record<string, { synergies: { with: string; effect: string; mechanism: string; severity: string }[]; conflicts: { with: string; effect: string; mechanism: string; severity: string }[] }> = {
    // nac: 4 synergies, 1 conflicts
    "nac": { synergies: [
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "electrolyte_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "milk_thistle", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // tudca: 0 synergies, 1 conflicts
    "tudca": { synergies: [

    ], conflicts: [
        { with: "testosterone", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // magnesium: 8 synergies, 12 conflicts
    "magnesium": { synergies: [
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "melatonin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_b6", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "taurine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "x5htp", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "calcium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" },
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "zinc", effect: "", mechanism: "", severity: "HIGH" },
        { with: "calcium", effect: "", mechanism: "", severity: "LOW" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
        { with: "potassium", effect: "", mechanism: "", severity: "LOW" },
        { with: "sodium", effect: "", mechanism: "", severity: "LOW" },
        { with: "lithium", effect: "", mechanism: "", severity: "LOW" },
        { with: "phosphorus", effect: "", mechanism: "", severity: "LOW" },
        { with: "electrolyte_complex", effect: "", mechanism: "", severity: "LOW" },
        { with: "colloidal_minerals", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // coq10: 3 synergies, 2 conflicts
    "coq10": { synergies: [
        { with: "statin_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "pqq", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "statin_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // vitamin_d3: 5 synergies, 1 conflicts
    "vitamin_d3": { synergies: [
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_k2", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "vitamin_a", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // zinc: 7 synergies, 5 conflicts
    "zinc": { synergies: [
        { with: "selenium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "d_aspartic_acid", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "boron", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "iron", effect: "", mechanism: "", severity: "HIGH" },
        { with: "copper", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "copper", effect: "", mechanism: "", severity: "LOW" },
        { with: "ace_inhibitor_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // selenium: 3 synergies, 1 conflicts
    "selenium": { synergies: [
        { with: "thyroid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "iodine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "vitamin_c", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // milk_thistle: 2 synergies, 0 conflicts
    "milk_thistle": { synergies: [
        { with: "artichoke", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // curcumin: 4 synergies, 2 conflicts
    "curcumin": { synergies: [
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "corticosteroid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ginger", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "ppi_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // ashwagandha: 3 synergies, 1 conflicts
    "ashwagandha": { synergies: [
        { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "rhodiola", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "thyroid_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // vitamin_c: 6 synergies, 3 conflicts
    "vitamin_c": { synergies: [
        { with: "iron", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "collagen", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "quercetin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "copper", effect: "", mechanism: "", severity: "HIGH" },
        { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "selenium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // taurine: 1 synergies, 0 conflicts
    "taurine": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // alpha_lipoic: 3 synergies, 0 conflicts
    "alpha_lipoic": { synergies: [
        { with: "l_carnitine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glutathione", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "alpha_lipoic", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // berberine: 2 synergies, 3 conflicts
    "berberine": { synergies: [
        { with: "metformin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "cinnamon", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "metformin", effect: "", mechanism: "", severity: "LOW" },
        { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "immunosuppressant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // vitamin_k2: 2 synergies, 1 conflicts
    "vitamin_k2": { synergies: [
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // probiotics: 3 synergies, 1 conflicts
    "probiotics": { synergies: [
        { with: "prebiotics", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ppi_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "cranberry", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // collagen: 4 synergies, 0 conflicts
    "collagen": { synergies: [
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "hyaluronic", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "proline", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lysine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // glucosamine: 2 synergies, 0 conflicts
    "glucosamine": { synergies: [
        { with: "chondroitin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "msm", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // telmisartan: 1 synergies, 0 conflicts
    "telmisartan": { synergies: [
        { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // iron: 2 synergies, 3 conflicts
    "iron": { synergies: [
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "copper", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "calcium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "zinc", effect: "", mechanism: "", severity: "HIGH" },
        { with: "calcium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // copper: 1 synergies, 3 conflicts
    "copper": { synergies: [
        { with: "iron", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "zinc", effect: "", mechanism: "", severity: "HIGH" },
        { with: "vitamin_c", effect: "", mechanism: "", severity: "HIGH" },
        { with: "zinc", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // vitamin_b12: 1 synergies, 2 conflicts
    "vitamin_b12": { synergies: [
        { with: "folate", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "metformin", effect: "", mechanism: "", severity: "HIGH" },
        { with: "ppi_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // potassium: 0 synergies, 5 conflicts
    "potassium": { synergies: [

    ], conflicts: [
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "ace_inhibitor_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "beta_blocker_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // electrolyte_complex: 1 synergies, 3 conflicts
    "electrolyte_complex": { synergies: [
        { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "mct", effect: "", mechanism: "", severity: "LOW" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // vitamin_b6: 3 synergies, 0 conflicts
    "vitamin_b6": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "saw_palmetto", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_b6", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vitamin_a: 9 synergies, 1 conflicts
    "vitamin_a": { synergies: [
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lutein", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "antioxidant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "brand_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // vitamin_b1: 1 synergies, 0 conflicts
    "vitamin_b1": { synergies: [
        { with: "vitamin_b1", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vitamin_b2: 1 synergies, 0 conflicts
    "vitamin_b2": { synergies: [
        { with: "vitamin_b2", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vitamin_b3: 2 synergies, 0 conflicts
    "vitamin_b3": { synergies: [
        { with: "vitamin_b3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "pterostilbene", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vitamin_b5: 1 synergies, 0 conflicts
    "vitamin_b5": { synergies: [
        { with: "vitamin_b5", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // biotin: 1 synergies, 0 conflicts
    "biotin": { synergies: [
        { with: "biotin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // folate: 3 synergies, 2 conflicts
    "folate": { synergies: [
        { with: "vitamin_b12", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "betaine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "folate", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "immunosuppressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "anticonvulsant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // vitamin_e: 3 synergies, 0 conflicts
    "vitamin_e": { synergies: [
        { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vitamin_b_complex: 1 synergies, 0 conflicts
    "vitamin_b_complex": { synergies: [
        { with: "vitamin_b_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // betaine: 2 synergies, 0 conflicts
    "betaine": { synergies: [
        { with: "folate", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "betaine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // pqq: 1 synergies, 0 conflicts
    "pqq": { synergies: [
        { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // pterostilbene: 1 synergies, 0 conflicts
    "pterostilbene": { synergies: [
        { with: "vitamin_b3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // saw_palmetto: 2 synergies, 0 conflicts
    "saw_palmetto": { synergies: [
        { with: "vitamin_b6", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "saw_palmetto", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // hcg: 1 synergies, 0 conflicts
    "hcg": { synergies: [
        { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // l_carnitine: 3 synergies, 1 conflicts
    "l_carnitine": { synergies: [
        { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "alpha_lipoic", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lions_mane", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "thyroid_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // phosphatidylcholine: 2 synergies, 1 conflicts
    "phosphatidylcholine": { synergies: [
        { with: "huperzine_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antipsychotic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // prebiotics: 1 synergies, 2 conflicts
    "prebiotics": { synergies: [
        { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "pharma_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "colloidal_minerals", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // boron: 1 synergies, 0 conflicts
    "boron": { synergies: [
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // silicon: 3 synergies, 0 conflicts
    "silicon": { synergies: [
        { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // calcium: 7 synergies, 6 conflicts
    "calcium": { synergies: [
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_k2", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "sulforaphane", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "iron", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "ppi_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
        { with: "iron", effect: "", mechanism: "", severity: "LOW" },
        { with: "diuretic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // sodium: 0 synergies, 2 conflicts
    "sodium": { synergies: [

    ], conflicts: [
        { with: "lithium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // iodine: 1 synergies, 3 conflicts
    "iodine": { synergies: [
        { with: "selenium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "thyroid_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "lithium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "antithyroid_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // lithium: 0 synergies, 4 conflicts
    "lithium": { synergies: [

    ], conflicts: [
        { with: "sodium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "iodine", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // phosphorus: 0 synergies, 1 conflicts
    "phosphorus": { synergies: [

    ], conflicts: [
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // msm: 1 synergies, 0 conflicts
    "msm": { synergies: [
        { with: "glucosamine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // colloidal_minerals: 0 synergies, 3 conflicts
    "colloidal_minerals": { synergies: [

    ], conflicts: [
        { with: "prebiotics", effect: "", mechanism: "", severity: "LOW" },
        { with: "ppi_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // omega6: 1 synergies, 0 conflicts
    "omega6": { synergies: [
        { with: "omega6", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // omega9: 5 synergies, 0 conflicts
    "omega9": { synergies: [
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // mct: 0 synergies, 2 conflicts
    "mct": { synergies: [

    ], conflicts: [
        { with: "antidiabetic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "electrolyte_complex", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // glycine: 5 synergies, 0 conflicts
    "glycine": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // theanine: 2 synergies, 0 conflicts
    "theanine": { synergies: [
        { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // tyrosine: 2 synergies, 2 conflicts
    "tyrosine": { synergies: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "rhodiola", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "l_dopa", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // tryptophan: 0 synergies, 2 conflicts
    "tryptophan": { synergies: [

    ], conflicts: [
        { with: "x5htp", effect: "", mechanism: "", severity: "LOW" },
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // x5htp: 1 synergies, 2 conflicts
    "x5htp": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "tryptophan", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // gaba: 4 synergies, 5 conflicts
    "gaba": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "theanine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "melatonin", effect: "", mechanism: "", severity: "HIGH" },
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "gaba", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // creatine: 1 synergies, 0 conflicts
    "creatine": { synergies: [
        { with: "beta_alanine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // beta_alanine: 1 synergies, 0 conflicts
    "beta_alanine": { synergies: [
        { with: "creatine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // citrulline: 1 synergies, 0 conflicts
    "citrulline": { synergies: [
        { with: "arginine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // arginine: 1 synergies, 0 conflicts
    "arginine": { synergies: [
        { with: "citrulline", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // glutathione: 1 synergies, 0 conflicts
    "glutathione": { synergies: [
        { with: "alpha_lipoic", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // d_aspartic_acid: 2 synergies, 0 conflicts
    "d_aspartic_acid": { synergies: [
        { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "maca", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // l_dopa: 0 synergies, 1 conflicts
    "l_dopa": { synergies: [

    ], conflicts: [
        { with: "tyrosine", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // phosphatidylserine: 1 synergies, 0 conflicts
    "phosphatidylserine": { synergies: [
        { with: "bacopa", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // ginseng: 1 synergies, 2 conflicts
    "ginseng": { synergies: [
        { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" },
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // rhodiola: 2 synergies, 2 conflicts
    "rhodiola": { synergies: [
        { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "tyrosine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" },
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // bacopa: 2 synergies, 0 conflicts
    "bacopa": { synergies: [
        { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "phosphatidylserine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // lions_mane: 1 synergies, 0 conflicts
    "lions_mane": { synergies: [
        { with: "l_carnitine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // cordyceps: 3 synergies, 0 conflicts
    "cordyceps": { synergies: [
        { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ss31", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // maca: 1 synergies, 0 conflicts
    "maca": { synergies: [
        { with: "d_aspartic_acid", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // holy_basil: 1 synergies, 3 conflicts
    "holy_basil": { synergies: [
        { with: "soy_isoflavones", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "progesterone", effect: "", mechanism: "", severity: "HIGH" },
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // schisandra: 1 synergies, 0 conflicts
    "schisandra": { synergies: [
        { with: "adaptogen_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // ginger: 3 synergies, 1 conflicts
    "ginger": { synergies: [
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "arb_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // astaxanthin: 4 synergies, 0 conflicts
    "astaxanthin": { synergies: [
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // resveratrol: 2 synergies, 1 conflicts
    "resveratrol": { synergies: [
        { with: "statin_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "nmn", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // quercetin: 3 synergies, 2 conflicts
    "quercetin": { synergies: [
        { with: "antihistamine_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "immunosuppressant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // egcg: 5 synergies, 0 conflicts
    "egcg": { synergies: [
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // sulforaphane: 1 synergies, 0 conflicts
    "sulforaphane": { synergies: [
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // melatonin: 2 synergies, 3 conflicts
    "melatonin": { synergies: [
        { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
        { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // ginkgo: 3 synergies, 0 conflicts
    "ginkgo": { synergies: [
        { with: "bacopa", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ginseng", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vinpocetine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // ipamorelin: 1 synergies, 0 conflicts
    "ipamorelin": { synergies: [
        { with: "insulin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // ss31: 2 synergies, 0 conflicts
    "ss31": { synergies: [
        { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // pt141: 0 synergies, 1 conflicts
    "pt141": { synergies: [

    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // peptide_complex: 10 synergies, 0 conflicts
    "peptide_complex": { synergies: [
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ss31", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "alpha_ketoglutarate", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // proline: 2 synergies, 0 conflicts
    "proline": { synergies: [
        { with: "lysine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "collagen", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // aspartate: 1 synergies, 0 conflicts
    "aspartate": { synergies: [
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // lysine: 2 synergies, 0 conflicts
    "lysine": { synergies: [
        { with: "proline", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "collagen", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // amino_complex: 6 synergies, 0 conflicts
    "amino_complex": { synergies: [
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "aspartate", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // alpha_ketoglutarate: 1 synergies, 0 conflicts
    "alpha_ketoglutarate": { synergies: [
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // chaga: 4 synergies, 0 conflicts
    "chaga": { synergies: [
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // mushroom_complex: 5 synergies, 0 conflicts
    "mushroom_complex": { synergies: [
        { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // lutein: 2 synergies, 0 conflicts
    "lutein": { synergies: [
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // lycopene: 7 synergies, 0 conflicts
    "lycopene": { synergies: [
        { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // anthocyanins: 5 synergies, 0 conflicts
    "anthocyanins": { synergies: [
        { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "quercetin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // antioxidant_complex: 2 synergies, 0 conflicts
    "antioxidant_complex": { synergies: [
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // olive_extract: 4 synergies, 0 conflicts
    "olive_extract": { synergies: [
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // polyphenol_complex: 11 synergies, 0 conflicts
    "polyphenol_complex": { synergies: [
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // citrus_bioflavonoids: 0 synergies, 1 conflicts
    "citrus_bioflavonoids": { synergies: [

    ], conflicts: [
        { with: "statin_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // flavonoids: 3 synergies, 0 conflicts
    "flavonoids": { synergies: [
        { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // artichoke: 1 synergies, 0 conflicts
    "artichoke": { synergies: [
        { with: "milk_thistle", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // garlic: 0 synergies, 1 conflicts
    "garlic": { synergies: [

    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // soy_isoflavones: 1 synergies, 0 conflicts
    "soy_isoflavones": { synergies: [
        { with: "holy_basil", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // cinnamon: 1 synergies, 0 conflicts
    "cinnamon": { synergies: [
        { with: "berberine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // cranberry: 2 synergies, 0 conflicts
    "cranberry": { synergies: [
        { with: "cranberry", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // piracetam: 1 synergies, 0 conflicts
    "piracetam": { synergies: [
        { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // noopept: 1 synergies, 0 conflicts
    "noopept": { synergies: [
        { with: "citicoline", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // citicoline: 2 synergies, 0 conflicts
    "citicoline": { synergies: [
        { with: "alpha_gpc", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "noopept", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // alpha_gpc: 1 synergies, 0 conflicts
    "alpha_gpc": { synergies: [
        { with: "citicoline", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // vinpocetine: 1 synergies, 0 conflicts
    "vinpocetine": { synergies: [
        { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // huperzine_a: 1 synergies, 1 conflicts
    "huperzine_a": { synergies: [
        { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // metformin: 1 synergies, 2 conflicts
    "metformin": { synergies: [
        { with: "berberine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "vitamin_b12", effect: "", mechanism: "", severity: "HIGH" },
        { with: "berberine", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // finasteride: 1 synergies, 1 conflicts
    "finasteride": { synergies: [
        { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "testosterone", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // cabergoline: 0 synergies, 1 conflicts
    "cabergoline": { synergies: [

    ], conflicts: [
        { with: "testosterone", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // testosterone: 4 synergies, 3 conflicts
    "testosterone": { synergies: [
        { with: "finasteride", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "telmisartan", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "hcg", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "cabergoline", effect: "", mechanism: "", severity: "LOW" },
        { with: "finasteride", effect: "", mechanism: "", severity: "LOW" },
        { with: "tudca", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // caffeine: 4 synergies, 1 conflicts
    "caffeine": { synergies: [
        { with: "theanine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "piracetam", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "l_carnitine", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // ppi_drugs: 1 synergies, 4 conflicts
    "ppi_drugs": { synergies: [
        { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "curcumin", effect: "", mechanism: "", severity: "LOW" },
        { with: "colloidal_minerals", effect: "", mechanism: "", severity: "HIGH" },
        { with: "vitamin_b12", effect: "", mechanism: "", severity: "HIGH" },
        { with: "calcium", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // pharma_drugs: 0 synergies, 1 conflicts
    "pharma_drugs": { synergies: [

    ], conflicts: [
        { with: "prebiotics", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // antidepressant_drugs: 0 synergies, 7 conflicts
    "antidepressant_drugs": { synergies: [

    ], conflicts: [
        { with: "x5htp", effect: "", mechanism: "", severity: "HIGH" },
        { with: "tryptophan", effect: "", mechanism: "", severity: "HIGH" },
        { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" },
        { with: "gaba", effect: "", mechanism: "", severity: "LOW" },
        { with: "rhodiola", effect: "", mechanism: "", severity: "LOW" },
        { with: "tyrosine", effect: "", mechanism: "", severity: "HIGH" },
        { with: "melatonin", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // anxiolytic_drugs: 3 synergies, 2 conflicts
    "anxiolytic_drugs": { synergies: [
        { with: "melatonin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // antipsychotic_drugs: 0 synergies, 1 conflicts
    "antipsychotic_drugs": { synergies: [

    ], conflicts: [
        { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // anticonvulsant_drugs: 0 synergies, 1 conflicts
    "anticonvulsant_drugs": { synergies: [

    ], conflicts: [
        { with: "folate", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // antidiabetic_drugs: 0 synergies, 1 conflicts
    "antidiabetic_drugs": { synergies: [

    ], conflicts: [
        { with: "mct", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // thyroid_drugs: 1 synergies, 3 conflicts
    "thyroid_drugs": { synergies: [
        { with: "selenium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "ashwagandha", effect: "", mechanism: "", severity: "LOW" },
        { with: "l_carnitine", effect: "", mechanism: "", severity: "HIGH" },
        { with: "iodine", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // corticosteroid_drugs: 1 synergies, 0 conflicts
    "corticosteroid_drugs": { synergies: [
        { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // statin_drugs: 2 synergies, 2 conflicts
    "statin_drugs": { synergies: [
        { with: "resveratrol", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "citrus_bioflavonoids", effect: "", mechanism: "", severity: "HIGH" },
        { with: "coq10", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // anticoagulant_drugs: 0 synergies, 9 conflicts
    "anticoagulant_drugs": { synergies: [

    ], conflicts: [
        { with: "vitamin_k2", effect: "", mechanism: "", severity: "HIGH" },
        { with: "omega3", effect: "", mechanism: "", severity: "LOW" },
        { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" },
        { with: "curcumin", effect: "", mechanism: "", severity: "LOW" },
        { with: "resveratrol", effect: "", mechanism: "", severity: "LOW" },
        { with: "ginseng", effect: "", mechanism: "", severity: "LOW" },
        { with: "coq10", effect: "", mechanism: "", severity: "LOW" },
        { with: "ginger", effect: "", mechanism: "", severity: "LOW" },
        { with: "garlic", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // ace_inhibitor_drugs: 0 synergies, 2 conflicts
    "ace_inhibitor_drugs": { synergies: [

    ], conflicts: [
        { with: "potassium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "zinc", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // arb_drugs: 1 synergies, 0 conflicts
    "arb_drugs": { synergies: [
        { with: "ginger", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // beta_blocker_drugs: 0 synergies, 2 conflicts
    "beta_blocker_drugs": { synergies: [

    ], conflicts: [
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" },
        { with: "potassium", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // diuretic_drugs: 1 synergies, 5 conflicts
    "diuretic_drugs": { synergies: [
        { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "electrolyte_complex", effect: "", mechanism: "", severity: "LOW" },
        { with: "magnesium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "potassium", effect: "", mechanism: "", severity: "LOW" },
        { with: "potassium", effect: "", mechanism: "", severity: "HIGH" },
        { with: "calcium", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // immunosuppressant_drugs: 0 synergies, 3 conflicts
    "immunosuppressant_drugs": { synergies: [

    ], conflicts: [
        { with: "folate", effect: "", mechanism: "", severity: "HIGH" },
        { with: "berberine", effect: "", mechanism: "", severity: "HIGH" },
        { with: "quercetin", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // antibiotic_drugs: 0 synergies, 5 conflicts
    "antibiotic_drugs": { synergies: [

    ], conflicts: [
        { with: "nac", effect: "", mechanism: "", severity: "LOW" },
        { with: "probiotics", effect: "", mechanism: "", severity: "HIGH" },
        { with: "berberine", effect: "", mechanism: "", severity: "LOW" },
        { with: "quercetin", effect: "", mechanism: "", severity: "LOW" },
        { with: "vitamin_c", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // antihistamine_drugs: 2 synergies, 0 conflicts
    "antihistamine_drugs": { synergies: [
        { with: "quercetin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // nsaid_drugs: 4 synergies, 2 conflicts
    "nsaid_drugs": { synergies: [
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "ginger", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
        { with: "lithium", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // antithyroid_drugs: 0 synergies, 1 conflicts
    "antithyroid_drugs": { synergies: [

    ], conflicts: [
        { with: "iodine", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // nmn: 2 synergies, 0 conflicts
    "nmn": { synergies: [
        { with: "resveratrol", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "nmn", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // omega3: 17 synergies, 1 conflicts
    "omega3": { synergies: [
        { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "lutein", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "antioxidant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "brand_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // adaptogen_complex: 1 synergies, 0 conflicts
    "adaptogen_complex": { synergies: [
        { with: "schisandra", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // progesterone: 0 synergies, 1 conflicts
    "progesterone": { synergies: [

    ], conflicts: [
        { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" }
    ] },
    // insulin: 1 synergies, 0 conflicts
    "insulin": { synergies: [
        { with: "ipamorelin", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
    // stimulant_complex: 4 synergies, 10 conflicts
    "stimulant_complex": { synergies: [
        { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "tyrosine", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "antihistamine_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [
        { with: "caffeine", effect: "", mechanism: "", severity: "HIGH" },
        { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
        { with: "beta_blocker_drugs", effect: "", mechanism: "", severity: "HIGH" },
        { with: "ginseng", effect: "", mechanism: "", severity: "LOW" },
        { with: "rhodiola", effect: "", mechanism: "", severity: "LOW" },
        { with: "huperzine_a", effect: "", mechanism: "", severity: "LOW" },
        { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "LOW" },
        { with: "melatonin", effect: "", mechanism: "", severity: "HIGH" },
        { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" },
        { with: "pt141", effect: "", mechanism: "", severity: "LOW" }
    ] },
    // brand_complex: 2 synergies, 0 conflicts
    "brand_complex": { synergies: [
        { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
        { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ], conflicts: [

    ] },
};
