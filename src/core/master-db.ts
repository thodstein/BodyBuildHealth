// ================= INTERFACES =================
export interface SubstanceEntry {
  id: string; name: string; category: string; mechanisms: string; organs: string;
  risks: string; description: string; tags: string;
}
export interface EffectEntry {
  id: string; type: string; description: string; riskId: string;
}
export interface MechanismEntry {
  id: string; name: string; organs_up: string; organs_down: string; effects_positive: string; effects_negative: string;
}
export interface RiskEntry {
  id: string; name: string; system: string; organs: string[]; symptoms: string[]; levels: string[]; description: string;
}
export interface AxisEntry {
  id: string; name: string; organs: string[]; description: string; mechanism_up: string[]; mechanism_down: string[]; risk_up: string[]; risk_down: string[];
}
export interface CategoryEntry {
  id: string; type: string; name: string; description: string;
}
export interface TagEntry {
  id: string; type: string; name: string;
}
export interface BrandEntry {
  id: string; name: string; type: string; country: string; description: string;
}
export interface InteractionEntry {
  id: string; substance_a: string; substance_b: string; type: string; effect: string; mechanisms: string[]; severity: string; notes: string;
}
export interface RecommendationEntry {
  id: string; type: string; risk_id: string; level: string; title: string; text: string;
}
export interface HormonalAxisEntry {
  id: string; name: string; type: string; pathway: string; organs: string; target: string; description: string;
}

export const SUBSTANCES_DB: SubstanceEntry[] = [
  { id: "VIT_A", name: "Vitamin A (Retinol)", category: "vitamin;antioxidant;immune", mechanisms: "RETINOID_SIGNALING;EPITHELIAL_REPAIR;IMMUNE_SUPPORT", organs: "EYES;SKIN;IMMUNE_SYSTEM;GI", risks: "LOW_VITA", description: "Жирорастворимый витамин для зрения и кожи", tags: "vitamin" },
  { id: "VIT_A_BETA", name: "Beta-Carotene", category: "vitamin;carotenoid;antioxidant", mechanisms: "CAROTENOID_PATHWAY;OXIDATIVE_STRESS_REDUCTION", organs: "EYES;SKIN;VESSELS", risks: "LOW_CAROTENOIDS", description: "Предшественник витамина A", tags: "vitamin" },
  { id: "VIT_A_PALMITATE", name: "Retinyl Palmitate", category: "vitamin;retinoid", mechanisms: "RETINOID_SIGNALING;COLLAGEN_SUPPORT", organs: "SKIN;EYES;IMMUNE_SYSTEM", risks: "LOW_VITA", description: "Форма ретинола", tags: "vitamin" },
  { id: "VIT_B1", name: "Thiamine (B1)", category: "vitamin;energy", mechanisms: "TPP_PATHWAY;CARB_METABOLISM", organs: "BRAIN;HEART;LIVER", risks: "FATIGUE;LOW_B1", description: "Энергетический витамин", tags: "vitamin" },
  { id: "VIT_B1_BENF", name: "Benfotiamine (B1)", category: "vitamin;anti_glycation", mechanisms: "ANTI_GLYCATION;NERVE_PROTECTION", organs: "BRAIN;NERVES;VESSELS", risks: "DIABETES", description: "Липофильная форма B1", tags: "vitamin" },
  { id: "VIT_B2", name: "Riboflavin (B2)", category: "vitamin;enzyme", mechanisms: "FLAVIN_PATHWAY;MITO_REPAIR", organs: "BRAIN;LIVER;SKIN", risks: "LOW_B2", description: "Кофермент FAD/FMN", tags: "vitamin" },
  { id: "VIT_B2_R5P", name: "Riboflavin-5-Phosphate", category: "vitamin;enzyme", mechanisms: "FLAVIN_PATHWAY;OXIDATIVE_STRESS_REDUCTION", organs: "BRAIN;LIVER", risks: "LOW_B2", description: "Активная форма B2", tags: "vitamin" },
  { id: "VIT_B3_NIACIN", name: "Niacin (B3)", category: "vitamin;energy", mechanisms: "NAD_PATHWAY;LIPID_BALANCE", organs: "BRAIN;HEART;LIVER", risks: "HIGH_LIPIDS", description: "Ниацин", tags: "vitamin" },
  { id: "VIT_B3_NIACINAMIDE", name: "Niacinamide (B3)", category: "vitamin;antiinflammatory", mechanisms: "NAD_PATHWAY;SIRT1_ACTIVATION", organs: "SKIN;BRAIN;LIVER", risks: "INFLAMMATION", description: "Форма без приливов", tags: "vitamin" },
  { id: "VIT_B3_NMN", name: "NMN (Nicotinamide Mononucleotide)", category: "vitamin;antiaging", mechanisms: "NAD_SYNTHESIS;MITO_REPAIR", organs: "BRAIN;HEART;LIVER", risks: "AGING", description: "Предшественник NAD+", tags: "vitamin" },
  { id: "VIT_B3_NR", name: "Nicotinamide Riboside (NR)", category: "vitamin;antiaging", mechanisms: "NAD_SYNTHESIS;MITO_REPAIR", organs: "BRAIN;HEART;LIVER", risks: "AGING", description: "Предшественник NAD+", tags: "vitamin" },
  { id: "VIT_B5", name: "Pantothenic Acid (B5)", category: "vitamin;energy", mechanisms: "COA_PATHWAY;HORMONE_SYNTHESIS", organs: "ADRENALS;LIVER;SKIN", risks: "FATIGUE", description: "Витамин коэнзима A", tags: "vitamin" },
  { id: "VIT_B5_PANTETHINE", name: "Pantethine (B5)", category: "vitamin;lipids", mechanisms: "LIPID_METABOLISM;COA_PATHWAY", organs: "HEART;LIVER", risks: "HIGH_LIPIDS", description: "Активная форма B5", tags: "vitamin" },
  { id: "VIT_B6", name: "Pyridoxine (B6)", category: "vitamin;enzyme", mechanisms: "NEUROTRANSMITTER_SUPPORT;HOMOCYSTEINE_REDUCTION", organs: "BRAIN;LIVER;HORMONES", risks: "LOW_B6", description: "Классическая форма B6", tags: "vitamin" },
  { id: "VIT_B6_P5P", name: "P5P (B6 Active)", category: "vitamin;enzyme", mechanisms: "NEUROTRANSMITTER_SUPPORT;HOMOCYSTEINE_REDUCTION", organs: "BRAIN;LIVER;HORMONES", risks: "LOW_B6", description: "Активная форма B6", tags: "vitamin" },
  { id: "VIT_B7", name: "Biotin (B7)", category: "vitamin;enzyme", mechanisms: "CARBOXYLASE_SUPPORT;SKIN_HEALTH", organs: "SKIN;HAIR;LIVER", risks: "LOW_B7", description: "Витамин кожи и волос", tags: "vitamin" },
  { id: "VIT_B9_FOLIC", name: "Folic Acid (B9)", category: "vitamin;DNA", mechanisms: "METHYLATION;CELL_DIVISION", organs: "BLOOD;LIVER;BRAIN", risks: "LOW_B9", description: "Синтетическая форма B9", tags: "vitamin" },
  { id: "VIT_B9_MTHF", name: "5-MTHF (Active Folate)", category: "vitamin;DNA", mechanisms: "METHYLATION;NEUROTRANSMITTER_SUPPORT", organs: "BRAIN;BLOOD;LIVER", risks: "LOW_B9", description: "Активная форма фолата", tags: "vitamin" },
  { id: "VIT_B9_FOLINIC", name: "Folinic Acid (B9)", category: "vitamin;DNA", mechanisms: "METHYLATION;CELL_REPAIR", organs: "BLOOD;LIVER", risks: "LOW_B9", description: "Фолиновая кислота", tags: "vitamin" },
  { id: "VIT_B12_CYANO", name: "Cyanocobalamin (B12)", category: "vitamin;nerve", mechanisms: "MYELIN_REPAIR;METHYLATION", organs: "NERVES;BLOOD", risks: "LOW_B12", description: "Синтетическая форма B12", tags: "vitamin" },
  { id: "VIT_B12_METHYL", name: "Methylcobalamin (B12)", category: "vitamin;nerve", mechanisms: "MYELIN_REPAIR;METHYLATION", organs: "BRAIN;NERVES;BLOOD", risks: "LOW_B12", description: "Активная форма B12", tags: "vitamin" },
  { id: "VIT_B12_ADENO", name: "Adenosylcobalamin (B12)", category: "vitamin;mitochondria", mechanisms: "MITO_REPAIR;ENERGY", organs: "NERVES;LIVER", risks: "FATIGUE", description: "Митохондриальная форма B12", tags: "vitamin" },
  { id: "VIT_B12_HYDROXO", name: "Hydroxocobalamin (B12)", category: "vitamin;detox", mechanisms: "NITRIC_OXIDE_BINDING;METHYLATION", organs: "BLOOD;LIVER", risks: "LOW_B12", description: "Длительная форма B12", tags: "vitamin" },
  { id: "VIT_C", name: "Vitamin C", category: "vitamin;antioxidant;immune", mechanisms: "OXIDATIVE_STRESS_REDUCTION;COLLAGEN_SUPPORT;IMMUNE_SUPPORT", organs: "SKIN;IMMUNE_SYSTEM;VESSELS", risks: "LOW_VITC", description: "Аскорбиновая кислота", tags: "vitamin" },
  { id: "VIT_C_LIP", name: "Liposomal Vitamin C", category: "vitamin;antioxidant;immune", mechanisms: "LIPOSOMAL_DELIVERY;OXIDATIVE_STRESS_REDUCTION", organs: "IMMUNE_SYSTEM;SKIN;VESSELS", risks: "LOW_VITC", description: "Усиленная биодоступность", tags: "vitamin" },
  { id: "VIT_C_CALCIUM", name: "Calcium Ascorbate", category: "vitamin;antioxidant;alkaline", mechanisms: "OXIDATIVE_STRESS_REDUCTION;COLLAGEN_SUPPORT", organs: "GI;SKIN", risks: "LOW_VITC", description: "Щадящая форма витамина C", tags: "vitamin" },
  { id: "VIT_D3", name: "Vitamin D3 (Cholecalciferol)", category: "vitamin;hormone", mechanisms: "IMMUNE_MODULATION;CALCIUM_HOMEOSTASIS", organs: "BONES;IMMUNE_SYSTEM;HORMONES", risks: "LOW_VITD", description: "Гормоноподобный витамин", tags: "vitamin" },
  { id: "VIT_D2", name: "Vitamin D2 (Ergocalciferol)", category: "vitamin;hormone", mechanisms: "CALCIUM_HOMEOSTASIS;IMMUNE_SUPPORT", organs: "BONES;IMMUNE_SYSTEM", risks: "LOW_VITD", description: "Растительная форма D", tags: "vitamin" },
  { id: "VIT_D3_K2", name: "D3 + K2 Complex", category: "vitamin;vascular;bone", mechanisms: "CALCIUM_DISTRIBUTION;BONE_MINERALIZATION", organs: "BONES;VESSELS", risks: "LOW_VITD", description: "Комбинация D3+K2", tags: "vitamin" },
  { id: "VIT_E_ALPHA", name: "Vitamin E (Alpha-Tocopherol)", category: "vitamin;antioxidant", mechanisms: "MEMBRANE_PROTECTION;OXIDATIVE_STRESS_REDUCTION", organs: "SKIN;VESSELS;HEART", risks: "LOW_VITE", description: "Антиоксидант мембран", tags: "vitamin" },
  { id: "VIT_E_MIXED", name: "Mixed Tocopherols", category: "vitamin;antioxidant", mechanisms: "MEMBRANE_PROTECTION;OXIDATIVE_STRESS_REDUCTION", organs: "SKIN;VESSELS;HEART", risks: "LOW_VITE", description: "Смесь токоферолов", tags: "vitamin" },
  { id: "VIT_E_TOCOTRIENOLS", name: "Tocotrienols", category: "vitamin;antioxidant;antiinflammatory", mechanisms: "SIRT1_ACTIVATION;MEMBRANE_PROTECTION", organs: "BRAIN;HEART;VESSELS", risks: "AGING", description: "Усиленная форма витамина E", tags: "vitamin" },
  { id: "VIT_K1", name: "Vitamin K1 (Phylloquinone)", category: "vitamin;coagulation", mechanisms: "CLOTTING_PATHWAY;CALCIUM_DISTRIBUTION", organs: "BLOOD;BONES", risks: "LOW_VITK", description: "Классическая форма K", tags: "vitamin" },
  { id: "VIT_K2_MK4", name: "Vitamin K2 MK-4", category: "vitamin;bone;vascular", mechanisms: "CALCIUM_DISTRIBUTION;BONE_MINERALIZATION", organs: "BONES;VESSELS", risks: "LOW_VITK", description: "Короткая форма K2", tags: "vitamin" },
  { id: "VIT_K2_MK7", name: "Vitamin K2 MK-7", category: "vitamin;bone;vascular", mechanisms: "CALCIUM_DISTRIBUTION;ANTI_CALCIFICATION", organs: "BONES;VESSELS", risks: "CALCIFICATION", description: "Длительная форма K2", tags: "vitamin" },
  { id: "VIT_B_COMPLEX", name: "B-Complex Full Spectrum", category: "vitamin;energy;enzyme", mechanisms: "NAD_PATHWAY;METHYLATION;NEURO_SUPPORT", organs: "BRAIN;LIVER;BLOOD", risks: "LOW_B_VITAMINS", description: "Полный комплекс витаминов B", tags: "vitamin" },
  { id: "VIT_B_COMPLEX_ACTIVE", name: "B-Complex Active", category: "vitamin;energy;enzyme", mechanisms: "NAD_PATHWAY;METHYLATION;NEURO_SUPPORT", organs: "BRAIN;LIVER;BLOOD", risks: "LOW_B_VITAMINS", description: "Активные формы B‑группы", tags: "vitamin" },
  { id: "VIT_CHOLINE", name: "Choline", category: "vitamin;nootropic", mechanisms: "ACH_SYNTHESIS;LIVER_SUPPORT", organs: "BRAIN;LIVER", risks: "LOW_CHOLINE", description: "Предшественник ацетилхолина", tags: "vitamin" },
  { id: "VIT_CHOLINE_CDP", name: "CDP-Choline (Citicoline)", category: "vitamin;nootropic", mechanisms: "ACH_SYNTHESIS;MITO_REPAIR", organs: "BRAIN;NERVES", risks: "COGNITION", description: "Нейротропная форма холина", tags: "vitamin" },
  { id: "VIT_CHOLINE_ALPHA", name: "Alpha-GPC", category: "vitamin;nootropic", mechanisms: "ACH_SYNTHESIS;GH_STIMULATION", organs: "BRAIN;HORMONES", risks: "COGNITION", description: "Высокая биодоступность холина", tags: "vitamin" },
  { id: "VIT_INOSITOL", name: "Inositol (B8)", category: "vitamin;hormone;neuro", mechanisms: "INSULIN_SIGNALING;SEROTONIN_SUPPORT", organs: "BRAIN;OVARIES", risks: "PCOS;ANXIETY", description: "Витаминоподобное вещество", tags: "vitamin" },
  { id: "VIT_INOSITOL_MYOINO", name: "Myo-Inositol", category: "vitamin;hormone", mechanisms: "INSULIN_SIGNALING;OVARIAN_SUPPORT", organs: "OVARIES;BRAIN", risks: "PCOS", description: "Форма для гормонального баланса", tags: "vitamin" },
  { id: "VIT_INOSITOL_DCHIRO", name: "D-Chiro-Inositol", category: "vitamin;hormone", mechanisms: "INSULIN_SIGNALING;OVARIAN_SUPPORT", organs: "OVARIES", risks: "PCOS", description: "Форма для инсулинорезистентности", tags: "vitamin" },
  { id: "VIT_PABA", name: "PABA (B10)", category: "vitamin;skin", mechanisms: "SKIN_REPAIR;ANTI_INFLAMMATION", organs: "SKIN", risks: "LOW_PABA", description: "Парааминобензойная кислота", tags: "vitamin" },
  { id: "VIT_B15_PANGAMATE", name: "Pangamic Acid (B15)", category: "vitamin;oxygen", mechanisms: "OXYGEN_UTILIZATION;MITO_REPAIR", organs: "HEART;MUSCLES", risks: "FATIGUE", description: "Редкий витаминоподобный фактор", tags: "vitamin" },
  { id: "VIT_TMG", name: "TMG (Trimethylglycine)", category: "vitamin;methylation", mechanisms: "METHYL_DONOR;HOMOCYSTEINE_REDUCTION", organs: "LIVER;BLOOD", risks: "HIGH_HOMOCYSTEINE", description: "Метильная поддержка", tags: "vitamin" },
  { id: "VIT_CARNITINE_LC", name: "L-Carnitine", category: "vitamin;mitochondria", mechanisms: "FATTY_ACID_TRANSPORT;ATP_PRODUCTION", organs: "HEART;MUSCLES;BRAIN", risks: "FATIGUE", description: "Транспорт жирных кислот", tags: "vitamin" },
  { id: "VIT_CARNITINE_ALCAR", name: "Acetyl-L-Carnitine", category: "vitamin;nootropic;mitochondria", mechanisms: "MITO_REPAIR;ACH_SUPPORT", organs: "BRAIN;NERVES", risks: "COGNITION", description: "Нейромитохондриальная форма", tags: "vitamin" },
  { id: "VIT_C_ESTER", name: "Ester-C", category: "vitamin;antioxidant;immune", mechanisms: "OXIDATIVE_STRESS_REDUCTION;COLLAGEN_SUPPORT", organs: "IMMUNE_SYSTEM;SKIN", risks: "LOW_VITC", description: "Буферная форма витамина C", tags: "vitamin" },
  { id: "VIT_C_SODIUM", name: "Sodium Ascorbate", category: "vitamin;antioxidant", mechanisms: "OXIDATIVE_STRESS_REDUCTION;COLLAGEN_SUPPORT", organs: "GI;SKIN", risks: "LOW_VITC", description: "Щадящая форма витамина C", tags: "vitamin" },
  { id: "VIT_C_RALA", name: "R-Lipoic Acid + C", category: "vitamin;antioxidant;synergy", mechanisms: "OXIDATIVE_STRESS_REDUCTION;GLUTATHIONE_RECYCLING", organs: "BRAIN;LIVER;VESSELS", risks: "OXIDATIVE_STRESS", description: "Синергия C+R-ALA", tags: "vitamin" },
  { id: "VIT_D3_LIP", name: "Liposomal D3", category: "vitamin;hormone", mechanisms: "LIPOSOMAL_DELIVERY;IMMUNE_MODULATION", organs: "BONES;IMMUNE_SYSTEM", risks: "LOW_VITD", description: "Усиленная форма D3", tags: "vitamin" },
  { id: "VIT_D3_SOFTGEL", name: "D3 Softgel", category: "vitamin;hormone", mechanisms: "CALCIUM_HOMEOSTASIS;IMMUNE_SUPPORT", organs: "BONES;IMMUNE_SYSTEM", risks: "LOW_VITD", description: "Жирорастворимая форма D3", tags: "vitamin" },
  { id: "VIT_D3_HIGH", name: "D3 High Dose", category: "vitamin;hormone", mechanisms: "IMMUNE_MODULATION;CALCIUM_HOMEOSTASIS", organs: "BONES;IMMUNE_SYSTEM", risks: "LOW_VITD", description: "Высокодозовая форма", tags: "vitamin" },
  { id: "VIT_E_GAMMA", name: "Gamma-Tocopherol", category: "vitamin;antioxidant", mechanisms: "NITROGEN_SCAVENGING;MEMBRANE_PROTECTION", organs: "HEART;VESSELS", risks: "OXIDATIVE_STRESS", description: "Гамма-форма витамина E", tags: "vitamin" },
  { id: "VIT_E_DELTA", name: "Delta-Tocotrienol", category: "vitamin;antioxidant;antiinflammatory", mechanisms: "SIRT1_ACTIVATION;MEMBRANE_PROTECTION", organs: "BRAIN;HEART;VESSELS", risks: "AGING", description: "Мощная форма токотриенолов", tags: "vitamin" },
  { id: "VIT_E_SYNERGY", name: "E + C Synergy", category: "vitamin;antioxidant", mechanisms: "OXIDATIVE_STRESS_REDUCTION;MEMBRANE_PROTECTION", organs: "SKIN;VESSELS", risks: "OXIDATIVE_STRESS", description: "Синергия витаминов E и C", tags: "vitamin" },
  { id: "VIT_K2_LIP", name: "Liposomal K2", category: "vitamin;vascular", mechanisms: "LIPOSOMAL_DELIVERY;CALCIUM_DISTRIBUTION", organs: "VESSELS;BONES", risks: "CALCIFICATION", description: "Усиленная форма K2", tags: "vitamin" },
  { id: "VIT_K2_COMPLEX", name: "K2 Complex MK4+MK7", category: "vitamin;vascular;bone", mechanisms: "CALCIUM_DISTRIBUTION;ANTI_CALCIFICATION", organs: "VESSELS;BONES", risks: "CALCIFICATION", description: "Комбинация форм K2", tags: "vitamin" },
  { id: "VIT_B1_TTFD", name: "TTFD (B1)", category: "vitamin;energy;nootropic", mechanisms: "TPP_PATHWAY;NERVE_REPAIR", organs: "BRAIN;NERVES", risks: "FATIGUE", description: "Липофильная форма B1", tags: "vitamin" },
  { id: "VIT_B2_COMPLEX", name: "B2 Complex", category: "vitamin;enzyme", mechanisms: "FLAVIN_PATHWAY;MITO_REPAIR", organs: "BRAIN;LIVER", risks: "LOW_B2", description: "Комплекс FMN+FAD", tags: "vitamin" },
  { id: "VIT_B3_NICOTINIC", name: "Nicotinic Acid", category: "vitamin;lipids", mechanisms: "NAD_PATHWAY;LIPID_BALANCE", organs: "HEART;LIVER", risks: "HIGH_LIPIDS", description: "Классическая форма ниацина", tags: "vitamin" },
  { id: "VIT_B3_TRIP", name: "Nicotinic Acid TR", category: "vitamin;lipids", mechanisms: "NAD_PATHWAY;LIPID_BALANCE", organs: "HEART;LIVER", risks: "HIGH_LIPIDS", description: "Форма с замедленным высвобождением", tags: "vitamin" },
  { id: "VIT_B5_COA", name: "CoA Precursor", category: "vitamin;energy", mechanisms: "COA_PATHWAY;FATTY_ACID_OXIDATION", organs: "LIVER;ADRENALS", risks: "FATIGUE", description: "Предшественник коэнзима A", tags: "vitamin" },
  { id: "VIT_B6_COMPLEX", name: "B6 Complex", category: "vitamin;enzyme", mechanisms: "NEUROTRANSMITTER_SUPPORT;HOMOCYSTEINE_REDUCTION", organs: "BRAIN;LIVER", risks: "LOW_B6", description: "Смесь пиридоксина и P5P", tags: "vitamin" },
  { id: "VIT_B7_HIGH", name: "Biotin High Dose", category: "vitamin;enzyme", mechanisms: "CARBOXYLASE_SUPPORT;SKIN_HEALTH", organs: "SKIN;HAIR", risks: "LOW_B7", description: "Высокодозовая форма биотина", tags: "vitamin" },
  { id: "VIT_B9_COMPLEX", name: "Folate Complex", category: "vitamin;DNA", mechanisms: "METHYLATION;CELL_REPAIR", organs: "BLOOD;LIVER", risks: "LOW_B9", description: "Смесь MTHF+фолинат", tags: "vitamin" },
  { id: "VIT_B12_COMPLEX", name: "B12 Complex", category: "vitamin;nerve;energy", mechanisms: "MYELIN_REPAIR;MITO_REPAIR", organs: "NERVES;BRAIN;BLOOD", risks: "LOW_B12", description: "Смесь метил+адено+гидроксо", tags: "vitamin" },
  { id: "VIT_C_RUTIN", name: "C + Rutin", category: "vitamin;antioxidant;vascular", mechanisms: "OXIDATIVE_STRESS_REDUCTION;CAPILLARY_STRENGTH", organs: "VESSELS;SKIN", risks: "FRAGILITY", description: "Сосудистая форма витамина C", tags: "vitamin" },
  { id: "VIT_C_BIOFLAV", name: "C + Bioflavonoids", category: "vitamin;antioxidant;vascular", mechanisms: "OXIDATIVE_STRESS_REDUCTION;COLLAGEN_SUPPORT", organs: "VESSELS;SKIN", risks: "LOW_VITC", description: "Синергия C+биофлавоноиды", tags: "vitamin" },
  { id: "VIT_D3_MCT", name: "D3 in MCT Oil", category: "vitamin;hormone", mechanisms: "CALCIUM_HOMEOSTASIS;IMMUNE_SUPPORT", organs: "BONES;IMMUNE_SYSTEM", risks: "LOW_VITD", description: "Форма на MCT масле", tags: "vitamin" },
  { id: "VIT_E_COMPLEX", name: "Full Spectrum E", category: "vitamin;antioxidant", mechanisms: "MEMBRANE_PROTECTION;OXIDATIVE_STRESS_REDUCTION", organs: "HEART;VESSELS;SKIN", risks: "LOW_VITE", description: "Полный спектр токоферолов и токотриенолов", tags: "vitamin" },
  { id: "VIT_K_COMPLEX", name: "K1 + K2", category: "vitamin;vascular;bone", mechanisms: "CALCIUM_DISTRIBUTION;ANTI_CALCIFICATION", organs: "VESSELS;BONES", risks: "CALCIFICATION", description: "Комбинация K1+K2", tags: "vitamin" },
  { id: "VIT_CHOLINE_COMPLEX", name: "Choline Complex", category: "vitamin;nootropic", mechanisms: "ACH_SYNTHESIS;LIVER_SUPPORT", organs: "BRAIN;LIVER", risks: "LOW_CHOLINE", description: "Смесь холиновых форм", tags: "vitamin" },
  { id: "VIT_INOSITOL_COMPLEX", name: "Inositol Complex", category: "vitamin;hormone", mechanisms: "INSULIN_SIGNALING;SEROTONIN_SUPPORT", organs: "BRAIN;OVARIES", risks: "PCOS", description: "Смесь мио+ди-хиро", tags: "vitamin" },
  { id: "VIT_PQQ", name: "PQQ", category: "vitamin;mitochondria", mechanisms: "MITO_BIOGENESIS;MITO_REPAIR", organs: "BRAIN;HEART;LIVER", risks: "AGING", description: "Кофактор митохондрий", tags: "vitamin" },
  { id: "VIT_Q10", name: "CoQ10", category: "vitamin;mitochondria", mechanisms: "ELECTRON_TRANSPORT_CHAIN;ANTIOXIDANT", organs: "HEART;BRAIN;VESSELS", risks: "FATIGUE", description: "Кофермент Q10", tags: "vitamin" },
  { id: "VIT_Q10_UBIQUINOL", name: "Ubiquinol", category: "vitamin;mitochondria", mechanisms: "ELECTRON_TRANSPORT_CHAIN;ANTIOXIDANT", organs: "HEART;BRAIN;VESSELS", risks: "AGING", description: "Активная форма Q10", tags: "vitamin" },
  { id: "VIT_LIPOIC_R", name: "R-Lipoic Acid", category: "vitamin;antioxidant;mitochondria", mechanisms: "GLUTATHIONE_RECYCLING;MITO_REPAIR", organs: "LIVER;BRAIN;VESSELS", risks: "OXIDATIVE_STRESS", description: "Активная форма ALA", tags: "vitamin" },
  { id: "VIT_LIPOIC_S", name: "S-Lipoic Acid", category: "vitamin;antioxidant", mechanisms: "OXIDATIVE_STRESS_REDUCTION;GLUCOSE_REGULATION", organs: "LIVER;VESSELS", risks: "DIABETES", description: "Синтетическая форма ALA", tags: "vitamin" },
  { id: "VIT_LIPOIC_COMPLEX", name: "ALA Complex", category: "vitamin;antioxidant;mitochondria", mechanisms: "GLUTATHIONE_RECYCLING;MITO_REPAIR", organs: "LIVER;BRAIN", risks: "OXIDATIVE_STRESS", description: "Смесь R+S ALA", tags: "vitamin" },
  { id: "VIT_PANTETHEINE", name: "Pantetheine", category: "vitamin;energy", mechanisms: "COA_PATHWAY;FATTY_ACID_OXIDATION", organs: "LIVER;ADRENALS", risks: "FATIGUE", description: "Предшественник коэнзима A", tags: "vitamin" },
  { id: "VIT_MENAQ7", name: "MenaQ7 (K2 MK-7)", category: "vitamin;vascular;bone", mechanisms: "CALCIUM_DISTRIBUTION;ANTI_CALCIFICATION", organs: "VESSELS;BONES", risks: "CALCIFICATION", description: "Биоактивная форма K2", tags: "vitamin" },
  { id: "VIT_MITO_B", name: "Mitotropic B-Complex", category: "vitamin;mitochondria", mechanisms: "NAD_PATHWAY;MITO_REPAIR", organs: "BRAIN;HEART;LIVER", risks: "FATIGUE", description: "Митохондриальный B-комплекс", tags: "vitamin" },
  { id: "VIT_UBIDECARENONE", name: "Ubidecarenone (CoQ10)", category: "vitamin;mitochondria", mechanisms: "ELECTRON_TRANSPORT_CHAIN;ANTIOXIDANT", organs: "HEART;BRAIN", risks: "FATIGUE", description: "Классическая форма Q10", tags: "vitamin" },
  { id: "VIT_PTEROSTILBENE", name: "Pterostilbene + Niacin", category: "vitamin;antioxidant;antiaging", mechanisms: "SIRT1_ACTIVATION;NAD_PATHWAY", organs: "BRAIN;HEART", risks: "AGING", description: "Синергия ниацина и птеростильбена", tags: "vitamin" },
  { id: "VIT_NADH", name: "NADH", category: "vitamin;energy;mitochondria", mechanisms: "NAD_PATHWAY;ATP_PRODUCTION", organs: "BRAIN;HEART", risks: "FATIGUE", description: "Активная форма NAD+", tags: "vitamin" },
  { id: "VIT_FAD", name: "FAD (Riboflavin Cofactor)", category: "vitamin;enzyme", mechanisms: "FLAVIN_PATHWAY;MITO_REPAIR", organs: "BRAIN;LIVER", risks: "LOW_B2", description: "Коферментная форма B2", tags: "vitamin" },
  { id: "VIT_FMN", name: "FMN (Riboflavin Cofactor)", category: "vitamin;enzyme", mechanisms: "FLAVIN_PATHWAY;OXIDATIVE_STRESS_REDUCTION", organs: "BRAIN;LIVER", risks: "LOW_B2", description: "Флавинмононуклеотид", tags: "vitamin" },
  { id: "VIT_THF", name: "Tetrahydrofolate", category: "vitamin;DNA;enzyme", mechanisms: "METHYLATION;CELL_REPAIR", organs: "BLOOD;LIVER", risks: "LOW_B9", description: "Активная форма фолата", tags: "vitamin" },
  { id: "VIT_METHYL_DONOR", name: "Methyl Donor Complex", category: "vitamin;methylation", mechanisms: "METHYL_DONOR;HOMOCYSTEINE_REDUCTION", organs: "LIVER;BLOOD", risks: "HIGH_HOMOCYSTEINE", description: "Комплекс метильных доноров", tags: "vitamin" },
  { id: "VIT_CHROMIUM_PIC", name: "Chromium Picolinate", category: "vitamin;insulin", mechanisms: "INSULIN_SENSITIVITY;GLUCOSE_REGULATION", organs: "PANCREAS;LIVER", risks: "INSULIN_RESISTANCE", description: "Форма хрома для сахара", tags: "vitamin" },
  { id: "VIT_CHROMIUM_NIC", name: "Chromium Nicotinate", category: "vitamin;insulin", mechanisms: "INSULIN_SENSITIVITY;GLUCOSE_REGULATION", organs: "PANCREAS;LIVER", risks: "INSULIN_RESISTANCE", description: "Ниациновая форма хрома", tags: "vitamin" },
  { id: "VIT_MOLYBDENUM", name: "Molybdenum", category: "vitamin;enzyme", mechanisms: "SULFITE_OXIDASE;DETOX", organs: "LIVER;KIDNEYS", risks: "LOW_MOLY", description: "Минерал детоксикации", tags: "vitamin" },
  { id: "VIT_BORON", name: "Boron", category: "vitamin;hormone", mechanisms: "BONE_METABOLISM;TESTOSTERONE_SUPPORT", organs: "BONES;HORMONES", risks: "LOW_BORON", description: "Минерал гормонального баланса", tags: "vitamin" },
  { id: "VIT_SILICON", name: "Silicon (Orthosilicic Acid)", category: "vitamin;skin;bone", mechanisms: "COLLAGEN_SUPPORT;BONE_MINERALIZATION", organs: "SKIN;BONES", risks: "LOW_SILICON", description: "Минерал кожи и костей", tags: "vitamin" },
  { id: "VIT_LITHIUM_OROTATE", name: "Lithium Orotate", category: "vitamin;neuro", mechanisms: "NEUROPROTECTION;MOOD_SUPPORT", organs: "BRAIN", risks: "MOOD_ISSUES", description: "Низкодозовый нейромодулятор", tags: "vitamin" }
];
// ... (Далее MINERALS, AMINO, FATTY_ACIDS, ANTIOXIDANTS, POLYPHENOLS, ADAPTOGENS, FUNGI, PROBIOTICS, PREBIOTICS, POSTBIOTICS, PEPTIDES, HORMONES, PHARMA, COMPLEXES)