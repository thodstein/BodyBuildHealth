// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE SUPPORT DATABASE — Auto-generated from CSV data
// Source: support-calculator/modules/support/data/
// Generated: 2026-06-11T14:03:04.109Z
// ═══════════════════════════════════════════════════════════════════════════


// === TYPE DEFINITIONS ===
export interface SupportSubstance {
  id: string;
  name: string;
  categories: string[];
  mechanisms: string[];
  organs: string[];
  deficiency: string;
  description: string;
  type: string;
}

export interface SupportInteraction {
  interactionId: string;
  substanceA: string;
  substanceB: string;
  type: 'synergy' | 'conflict' | 'caution';
  effect: string;
  mechanisms: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
}

export interface SupportRisk {
  riskId: string;
  name: string;
  system: string;
  organs: string[];
  symptoms: string[];
  levels: string;
  description: string;
}

export interface SupportMechanism {
  mechId: string;
  description: string;
  helpsOrgans: string[];
  harmsOrgans: string[];
  helpsRisks: string;
  harmsRisks: string;
}

export interface SupportRecommendation {
  recId: string;
  type: string;
  relatedId: string;
  level: string;
  label: string;
  text: string;
}

export interface SupportBrand {
  brandId: string;
  name: string;
  type: string;
  country: string;
  description: string;
}

export interface SupportCategory {
  catId: string;
  type: string;
  name: string;
  description: string;
}

export interface SupportTag {
  tagId: string;
  type: string;
  name: string;
}

export interface SupportEffect {
  effectId: string;
  type: string;
  description: string;
  category: string;
}

export interface SupportAxis {
  axisId: string;
  name: string;
  organs: string;
  description: string;
  mechUp: string;
  mechDown: string;
  highRisks: string;
  lowRisks: string;
}

export interface HormonalAxis {
  axisId: string;
  name: string;
  type: string;
  path: string;
  organs: string;
  func: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBSTANCES
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_SUBSTANCES: SupportSubstance[] = [
  {
    id: 'VIT_A_BETA',
    name: 'Beta-Carotene',
    categories: ['vitamin', 'carotenoid', 'antioxidant'],
    mechanisms: ['CAROTENOID_PATHWAY', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['EYES', 'SKIN', 'VESSELS'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Витамин (carotenoid, antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_A_PALMITATE',
    name: 'Retinyl Palmitate',
    categories: ['vitamin', 'retinoid'],
    mechanisms: ['RETINOID_SIGNALING', 'COLLAGEN_SUPPORT'],
    organs: ['SKIN', 'EYES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITA',
    description: 'Витамин (retinoid), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B1',
    name: 'Thiamine (B1)',
    categories: ['vitamin', 'energy'],
    mechanisms: ['TPP_PATHWAY', 'CARB_METABOLISM'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'FATIGUE;LOW_B1',
    description: 'Витамин (energy), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_B1_BENF',
    name: 'Benfotiamine (B1)',
    categories: ['vitamin', 'anti_glycation'],
    mechanisms: ['ANTI_GLYCATION', 'NERVE_PROTECTION'],
    organs: ['BRAIN', 'NERVES', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Витамин (anti_glycation), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B2',
    name: 'Riboflavin (B2)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['FLAVIN_PATHWAY', 'MITO_REPAIR'],
    organs: ['BRAIN', 'LIVER', 'SKIN'],
    deficiency: 'LOW_B2',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B2_R5P',
    name: 'Riboflavin-5-Phosphate',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['FLAVIN_PATHWAY', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_B2',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_NIACIN',
    name: 'Niacin (B3)',
    categories: ['vitamin', 'energy'],
    mechanisms: ['NAD_PATHWAY', 'LIPID_BALANCE'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Витамин (energy), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_NIACINAMIDE',
    name: 'Niacinamide (B3)',
    categories: ['vitamin', 'antiinflammatory'],
    mechanisms: ['NAD_PATHWAY', 'SIRT1_ACTIVATION'],
    organs: ['SKIN', 'BRAIN', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Витамин (antiinflammatory), необходимый для противовоспалительной защиты',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_NMN',
    name: 'NMN (Nicotinamide Mononucleotide)',
    categories: ['vitamin', 'antiaging'],
    mechanisms: ['NAD_SYNTHESIS', 'MITO_REPAIR'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'AGING',
    description: 'Витамин (antiaging), необходимый для антивозрастных процессов',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_NR',
    name: 'Nicotinamide Riboside (NR)',
    categories: ['vitamin', 'antiaging'],
    mechanisms: ['NAD_SYNTHESIS', 'MITO_REPAIR'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'AGING',
    description: 'Витамин (antiaging), необходимый для антивозрастных процессов',
    type: 'vitamin'
  },
  {
    id: 'VIT_B5',
    name: 'Pantothenic Acid (B5)',
    categories: ['vitamin', 'energy'],
    mechanisms: ['COA_PATHWAY', 'HORMONE_SYNTHESIS'],
    organs: ['ADRENALS', 'LIVER', 'SKIN'],
    deficiency: 'FATIGUE',
    description: 'Витамин (energy), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_B5_PANTETHINE',
    name: 'Pantethine (B5)',
    categories: ['vitamin', 'lipids'],
    mechanisms: ['LIPID_METABOLISM', 'COA_PATHWAY'],
    organs: ['HEART', 'LIVER'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Витамин (lipids), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B6',
    name: 'Pyridoxine (B6)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['NEUROTRANSMITTER_SUPPORT', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['BRAIN', 'LIVER', 'HORMONES'],
    deficiency: 'LOW_B6',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B6_P5P',
    name: 'P5P (B6 Active)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['NEUROTRANSMITTER_SUPPORT', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['BRAIN', 'LIVER', 'HORMONES'],
    deficiency: 'LOW_B6',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B7',
    name: 'Biotin (B7)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['CARBOXYLASE_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'HAIR', 'LIVER'],
    deficiency: 'LOW_B7',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B9_FOLIC',
    name: 'Folic Acid (B9)',
    categories: ['vitamin', 'DNA'],
    mechanisms: ['METHYLATION', 'CELL_DIVISION'],
    organs: ['BLOOD', 'LIVER', 'BRAIN'],
    deficiency: 'LOW_B9',
    description: 'Витамин (DNA), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B9_MTHF',
    name: '5-MTHF (Active Folate)',
    categories: ['vitamin', 'DNA'],
    mechanisms: ['METHYLATION', 'NEUROTRANSMITTER_SUPPORT'],
    organs: ['BRAIN', 'BLOOD', 'LIVER'],
    deficiency: 'LOW_B9',
    description: 'Витамин (DNA), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B9_FOLINIC',
    name: 'Folinic Acid (B9)',
    categories: ['vitamin', 'DNA'],
    mechanisms: ['METHYLATION', 'CELL_REPAIR'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_B9',
    description: 'Витамин (DNA), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B12_CYANO',
    name: 'Cyanocobalamin (B12)',
    categories: ['vitamin', 'nerve'],
    mechanisms: ['MYELIN_REPAIR', 'METHYLATION'],
    organs: ['NERVES', 'BLOOD'],
    deficiency: 'LOW_B12',
    description: 'Витамин (nerve), необходимый для нервной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_B12_METHYL',
    name: 'Methylcobalamin (B12)',
    categories: ['vitamin', 'nerve'],
    mechanisms: ['MYELIN_REPAIR', 'METHYLATION'],
    organs: ['BRAIN', 'NERVES', 'BLOOD'],
    deficiency: 'LOW_B12',
    description: 'Витамин (nerve), необходимый для нервной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_B12_ADENO',
    name: 'Adenosylcobalamin (B12)',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ENERGY'],
    organs: ['NERVES', 'LIVER'],
    deficiency: 'FATIGUE',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_B12_HYDROXO',
    name: 'Hydroxocobalamin (B12)',
    categories: ['vitamin', 'detox'],
    mechanisms: ['NITRIC_OXIDE_BINDING', 'METHYLATION'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_B12',
    description: 'Витамин (detox), необходимый для детоксикации',
    type: 'vitamin'
  },
  {
    id: 'VIT_C',
    name: 'Vitamin C',
    categories: ['vitamin', 'antioxidant', 'immune'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'COLLAGEN_SUPPORT', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant, immune), необходимый для защиты клеток от окислительного стресса, иммунной системы',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_LIP',
    name: 'Liposomal Vitamin C',
    categories: ['vitamin', 'antioxidant', 'immune'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['IMMUNE_SYSTEM', 'SKIN', 'VESSELS'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant, immune), необходимый для защиты клеток от окислительного стресса, иммунной системы',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_CALCIUM',
    name: 'Calcium Ascorbate',
    categories: ['vitamin', 'antioxidant', 'alkaline'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'COLLAGEN_SUPPORT'],
    organs: ['GI', 'SKIN'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant, alkaline), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3',
    name: 'Vitamin D3 (Cholecalciferol)',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['IMMUNE_MODULATION', 'CALCIUM_HOMEOSTASIS'],
    organs: ['BONES', 'IMMUNE_SYSTEM', 'HORMONES'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D2',
    name: 'Vitamin D2 (Ergocalciferol)',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['CALCIUM_HOMEOSTASIS', 'IMMUNE_SUPPORT'],
    organs: ['BONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3_K2',
    name: 'D3 + K2 Complex',
    categories: ['vitamin', 'vascular', 'bone'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'BONE_MINERALIZATION'],
    organs: ['BONES', 'VESSELS'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (vascular, bone), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_ALPHA',
    name: 'Vitamin E (Alpha-Tocopherol)',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['MEMBRANE_PROTECTION', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['SKIN', 'VESSELS', 'HEART'],
    deficiency: 'LOW_VITE',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_MIXED',
    name: 'Mixed Tocopherols',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['MEMBRANE_PROTECTION', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['SKIN', 'VESSELS', 'HEART'],
    deficiency: 'LOW_VITE',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_TOCOTRIENOLS',
    name: 'Tocotrienols',
    categories: ['vitamin', 'antioxidant', 'antiinflammatory'],
    mechanisms: ['SIRT1_ACTIVATION', 'MEMBRANE_PROTECTION'],
    organs: ['BRAIN', 'HEART', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Витамин (antioxidant, antiinflammatory), необходимый для защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'vitamin'
  },
  {
    id: 'VIT_K1',
    name: 'Vitamin K1 (Phylloquinone)',
    categories: ['vitamin', 'coagulation'],
    mechanisms: ['CLOTTING_PATHWAY', 'CALCIUM_DISTRIBUTION'],
    organs: ['BLOOD', 'BONES'],
    deficiency: 'LOW_VITK',
    description: 'Витамин (coagulation), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_K2_MK4',
    name: 'Vitamin K2 MK-4',
    categories: ['vitamin', 'bone', 'vascular'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'BONE_MINERALIZATION'],
    organs: ['BONES', 'VESSELS'],
    deficiency: 'LOW_VITK',
    description: 'Витамин (bone, vascular), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_K2_MK7',
    name: 'Vitamin K2 MK-7',
    categories: ['vitamin', 'bone', 'vascular'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'ANTI_CALCIFICATION'],
    organs: ['BONES', 'VESSELS'],
    deficiency: 'CALCIFICATION',
    description: 'Витамин (bone, vascular), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_B_COMPLEX',
    name: 'B-Complex Full Spectrum',
    categories: ['vitamin', 'energy', 'enzyme'],
    mechanisms: ['NAD_PATHWAY', 'METHYLATION', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'LIVER', 'BLOOD'],
    deficiency: 'LOW_B_VITAMINS',
    description: 'Витамин (energy, enzyme), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_B_COMPLEX_ACTIVE',
    name: 'B-Complex Active',
    categories: ['vitamin', 'energy', 'enzyme'],
    mechanisms: ['NAD_PATHWAY', 'METHYLATION', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'LIVER', 'BLOOD'],
    deficiency: 'LOW_B_VITAMINS',
    description: 'Витамин (energy, enzyme), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHOLINE',
    name: 'Choline',
    categories: ['vitamin', 'nootropic'],
    mechanisms: ['ACH_SYNTHESIS', 'LIVER_SUPPORT'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_CHOLINE',
    description: 'Витамин (nootropic), необходимый для когнитивных функций',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHOLINE_CDP',
    name: 'CDP-Choline (Citicoline)',
    categories: ['vitamin', 'nootropic'],
    mechanisms: ['ACH_SYNTHESIS', 'MITO_REPAIR'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Витамин (nootropic), необходимый для когнитивных функций',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHOLINE_ALPHA',
    name: 'Alpha-GPC',
    categories: ['vitamin', 'nootropic'],
    mechanisms: ['ACH_SYNTHESIS', 'GH_STIMULATION'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'COGNITION',
    description: 'Витамин (nootropic), необходимый для когнитивных функций',
    type: 'vitamin'
  },
  {
    id: 'VIT_INOSITOL',
    name: 'Inositol (B8)',
    categories: ['vitamin', 'hormone', 'neuro'],
    mechanisms: ['INSULIN_SIGNALING', 'SEROTONIN_SUPPORT'],
    organs: ['BRAIN', 'OVARIES'],
    deficiency: 'PCOS;ANXIETY',
    description: 'Витамин (hormone, neuro), необходимый для гормонального баланса, нервной системы',
    type: 'vitamin'
  },
  {
    id: 'VIT_INOSITOL_MYOINO',
    name: 'Myo-Inositol',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['INSULIN_SIGNALING', 'OVARIAN_SUPPORT'],
    organs: ['OVARIES', 'BRAIN'],
    deficiency: 'PCOS',
    description: 'Форма для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_INOSITOL_DCHIRO',
    name: 'D-Chiro-Inositol',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['INSULIN_SIGNALING', 'OVARIAN_SUPPORT'],
    organs: ['OVARIES'],
    deficiency: 'PCOS',
    description: 'Форма для инсулинорезистентности',
    type: 'vitamin'
  },
  {
    id: 'VIT_PABA',
    name: 'PABA (B10)',
    categories: ['vitamin', 'skin'],
    mechanisms: ['SKIN_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['SKIN'],
    deficiency: 'LOW_PABA',
    description: 'Витамин (skin), необходимый для здоровья кожи',
    type: 'vitamin'
  },
  {
    id: 'VIT_B15_PANGAMATE',
    name: 'Pangamic Acid (B15)',
    categories: ['vitamin', 'oxygen'],
    mechanisms: ['OXYGEN_UTILIZATION', 'MITO_REPAIR'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Редкий витаминоподобный фактор',
    type: 'vitamin'
  },
  {
    id: 'VIT_TMG',
    name: 'TMG (Trimethylglycine)',
    categories: ['vitamin', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Витамин (methylation), необходимый для метилирования',
    type: 'vitamin'
  },
  {
    id: 'VIT_CARNITINE_LC',
    name: 'L-Carnitine',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['FATTY_ACID_TRANSPORT', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MUSCLES', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_CARNITINE_ALCAR',
    name: 'Acetyl-L-Carnitine',
    categories: ['vitamin', 'nootropic', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ACH_SUPPORT'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Витамин (nootropic, mitochondria), необходимый для когнитивных функций, работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_ESTER',
    name: 'Ester-C',
    categories: ['vitamin', 'antioxidant', 'immune'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'COLLAGEN_SUPPORT'],
    organs: ['IMMUNE_SYSTEM', 'SKIN'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant, immune), необходимый для защиты клеток от окислительного стресса, иммунной системы',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_SODIUM',
    name: 'Sodium Ascorbate',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'COLLAGEN_SUPPORT'],
    organs: ['GI', 'SKIN'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_RALA',
    name: 'R-Lipoic Acid + C',
    categories: ['vitamin', 'antioxidant', 'synergy'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'GLUTATHIONE_RECYCLING'],
    organs: ['BRAIN', 'LIVER', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Витамин (antioxidant, synergy), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3_LIP',
    name: 'Liposomal D3',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'IMMUNE_MODULATION'],
    organs: ['BONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3_SOFTGEL',
    name: 'D3 Softgel',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['CALCIUM_HOMEOSTASIS', 'IMMUNE_SUPPORT'],
    organs: ['BONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3_HIGH',
    name: 'D3 High Dose',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['IMMUNE_MODULATION', 'CALCIUM_HOMEOSTASIS'],
    organs: ['BONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_GAMMA',
    name: 'Gamma-Tocopherol',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['NITROGEN_SCAVENGING', 'MEMBRANE_PROTECTION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_DELTA',
    name: 'Delta-Tocotrienol',
    categories: ['vitamin', 'antioxidant', 'antiinflammatory'],
    mechanisms: ['SIRT1_ACTIVATION', 'MEMBRANE_PROTECTION'],
    organs: ['BRAIN', 'HEART', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Витамин (antioxidant, antiinflammatory), необходимый для защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_SYNERGY',
    name: 'E + C Synergy',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'MEMBRANE_PROTECTION'],
    organs: ['SKIN', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_K2_LIP',
    name: 'Liposomal K2',
    categories: ['vitamin', 'vascular'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'CALCIUM_DISTRIBUTION'],
    organs: ['VESSELS', 'BONES'],
    deficiency: 'CALCIFICATION',
    description: 'Витамин (vascular), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_K2_COMPLEX',
    name: 'K2 Complex MK4+MK7',
    categories: ['vitamin', 'vascular', 'bone'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'ANTI_CALCIFICATION'],
    organs: ['VESSELS', 'BONES'],
    deficiency: 'CALCIFICATION',
    description: 'Витамин (vascular, bone), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_B1_TTFD',
    name: 'TTFD (B1)',
    categories: ['vitamin', 'energy', 'nootropic'],
    mechanisms: ['TPP_PATHWAY', 'NERVE_REPAIR'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'FATIGUE',
    description: 'Витамин (energy, nootropic), необходимый для энергетического обмена, когнитивных функций',
    type: 'vitamin'
  },
  {
    id: 'VIT_B2_COMPLEX',
    name: 'B2 Complex',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['FLAVIN_PATHWAY', 'MITO_REPAIR'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_B2',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_NICOTINIC',
    name: 'Nicotinic Acid',
    categories: ['vitamin', 'lipids'],
    mechanisms: ['NAD_PATHWAY', 'LIPID_BALANCE'],
    organs: ['HEART', 'LIVER'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Витамин (lipids), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B3_TRIP',
    name: 'Nicotinic Acid TR',
    categories: ['vitamin', 'lipids'],
    mechanisms: ['NAD_PATHWAY', 'LIPID_BALANCE'],
    organs: ['HEART', 'LIVER'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Форма с замедленным высвобождением',
    type: 'vitamin'
  },
  {
    id: 'VIT_B5_COA',
    name: 'CoA Precursor',
    categories: ['vitamin', 'energy'],
    mechanisms: ['COA_PATHWAY', 'FATTY_ACID_OXIDATION'],
    organs: ['LIVER', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Витамин (energy), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_B6_COMPLEX',
    name: 'B6 Complex',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['NEUROTRANSMITTER_SUPPORT', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_B6',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B7_HIGH',
    name: 'Biotin High Dose',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['CARBOXYLASE_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'HAIR'],
    deficiency: 'LOW_B7',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B9_COMPLEX',
    name: 'Folate Complex',
    categories: ['vitamin', 'DNA'],
    mechanisms: ['METHYLATION', 'CELL_REPAIR'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_B9',
    description: 'Витамин (DNA), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_B12_COMPLEX',
    name: 'B12 Complex',
    categories: ['vitamin', 'nerve', 'energy'],
    mechanisms: ['MYELIN_REPAIR', 'MITO_REPAIR'],
    organs: ['NERVES', 'BRAIN', 'BLOOD'],
    deficiency: 'LOW_B12',
    description: 'Витамин (nerve, energy), необходимый для нервной ткани, энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_RUTIN',
    name: 'C + Rutin',
    categories: ['vitamin', 'antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'FRAGILITY',
    description: 'Витамин (antioxidant, vascular), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_C_BIOFLAV',
    name: 'C + Bioflavonoids',
    categories: ['vitamin', 'antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'COLLAGEN_SUPPORT'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'LOW_VITC',
    description: 'Витамин (antioxidant, vascular), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_D3_MCT',
    name: 'D3 in MCT Oil',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['CALCIUM_HOMEOSTASIS', 'IMMUNE_SUPPORT'],
    organs: ['BONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_VITD',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_E_COMPLEX',
    name: 'Full Spectrum E',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['MEMBRANE_PROTECTION', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['HEART', 'VESSELS', 'SKIN'],
    deficiency: 'LOW_VITE',
    description: 'Полный спектр токоферолов и токотриенолов',
    type: 'vitamin'
  },
  {
    id: 'VIT_K_COMPLEX',
    name: 'K1 + K2',
    categories: ['vitamin', 'vascular', 'bone'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'ANTI_CALCIFICATION'],
    organs: ['VESSELS', 'BONES'],
    deficiency: 'CALCIFICATION',
    description: 'Витамин (vascular, bone), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHOLINE_COMPLEX',
    name: 'Choline Complex',
    categories: ['vitamin', 'nootropic'],
    mechanisms: ['ACH_SYNTHESIS', 'LIVER_SUPPORT'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_CHOLINE',
    description: 'Витамин (nootropic), необходимый для когнитивных функций',
    type: 'vitamin'
  },
  {
    id: 'VIT_INOSITOL_COMPLEX',
    name: 'Inositol Complex',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['INSULIN_SIGNALING', 'SEROTONIN_SUPPORT'],
    organs: ['BRAIN', 'OVARIES'],
    deficiency: 'PCOS',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_PQQ',
    name: 'PQQ',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['MITO_BIOGENESIS', 'MITO_REPAIR'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'AGING',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_Q10',
    name: 'CoQ10',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    deficiency: 'FATIGUE',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_Q10_UBIQUINOL',
    name: 'Ubiquinol',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_LIPOIC_R',
    name: 'R-Lipoic Acid',
    categories: ['vitamin', 'antioxidant', 'mitochondria'],
    mechanisms: ['GLUTATHIONE_RECYCLING', 'MITO_REPAIR'],
    organs: ['LIVER', 'BRAIN', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Витамин (antioxidant, mitochondria), необходимый для защиты клеток от окислительного стресса, работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_LIPOIC_S',
    name: 'S-Lipoic Acid',
    categories: ['vitamin', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Витамин (antioxidant), необходимый для защиты клеток от окислительного стресса',
    type: 'vitamin'
  },
  {
    id: 'VIT_LIPOIC_COMPLEX',
    name: 'ALA Complex',
    categories: ['vitamin', 'antioxidant', 'mitochondria'],
    mechanisms: ['GLUTATHIONE_RECYCLING', 'MITO_REPAIR'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Витамин (antioxidant, mitochondria), необходимый для защиты клеток от окислительного стресса, работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_PANTETHEINE',
    name: 'Pantetheine',
    categories: ['vitamin', 'energy'],
    mechanisms: ['COA_PATHWAY', 'FATTY_ACID_OXIDATION'],
    organs: ['LIVER', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Витамин (energy), необходимый для энергетического обмена',
    type: 'vitamin'
  },
  {
    id: 'VIT_MENAQ7',
    name: 'MenaQ7 (K2 MK-7)',
    categories: ['vitamin', 'vascular', 'bone'],
    mechanisms: ['CALCIUM_DISTRIBUTION', 'ANTI_CALCIFICATION'],
    organs: ['VESSELS', 'BONES'],
    deficiency: 'CALCIFICATION',
    description: 'Витамин (vascular, bone), необходимый для костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_MITO_B',
    name: 'Mitotropic B-Complex',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['NAD_PATHWAY', 'MITO_REPAIR'],
    organs: ['BRAIN', 'HEART', 'LIVER'],
    deficiency: 'FATIGUE',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_UBIDECARENONE',
    name: 'Ubidecarenone (CoQ10)',
    categories: ['vitamin', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Витамин (mitochondria), необходимый для работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_PTEROSTILBENE',
    name: 'Pterostilbene + Niacin',
    categories: ['vitamin', 'antioxidant', 'antiaging'],
    mechanisms: ['SIRT1_ACTIVATION', 'NAD_PATHWAY'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Синергия ниацина и птеростильбена',
    type: 'vitamin'
  },
  {
    id: 'VIT_NADH',
    name: 'NADH',
    categories: ['vitamin', 'energy', 'mitochondria'],
    mechanisms: ['NAD_PATHWAY', 'ATP_PRODUCTION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Витамин (energy, mitochondria), необходимый для энергетического обмена, работы митохондрий',
    type: 'vitamin'
  },
  {
    id: 'VIT_FAD',
    name: 'FAD (Riboflavin Cofactor)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['FLAVIN_PATHWAY', 'MITO_REPAIR'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_B2',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_FMN',
    name: 'FMN (Riboflavin Cofactor)',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['FLAVIN_PATHWAY', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'LOW_B2',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_THF',
    name: 'Tetrahydrofolate',
    categories: ['vitamin', 'DNA', 'enzyme'],
    mechanisms: ['METHYLATION', 'CELL_REPAIR'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_B9',
    description: 'Витамин (DNA, enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_METHYL_DONOR',
    name: 'Methyl Donor Complex',
    categories: ['vitamin', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Витамин (methylation), необходимый для метилирования',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHROMIUM_PIC',
    name: 'Chromium Picolinate',
    categories: ['vitamin', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Витамин (insulin), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_CHROMIUM_NIC',
    name: 'Chromium Nicotinate',
    categories: ['vitamin', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Витамин (insulin), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_MOLYBDENUM',
    name: 'Molybdenum',
    categories: ['vitamin', 'enzyme'],
    mechanisms: ['SULFITE_OXIDASE', 'DETOX'],
    organs: ['LIVER', 'KIDNEYS'],
    deficiency: 'LOW_MOLY',
    description: 'Витамин (enzyme), необходимый для обменных процессов и общего здоровья',
    type: 'vitamin'
  },
  {
    id: 'VIT_BORON',
    name: 'Boron',
    categories: ['vitamin', 'hormone'],
    mechanisms: ['BONE_METABOLISM', 'TESTOSTERONE_SUPPORT'],
    organs: ['BONES', 'HORMONES'],
    deficiency: 'LOW_BORON',
    description: 'Витамин (hormone), необходимый для гормонального баланса',
    type: 'vitamin'
  },
  {
    id: 'VIT_SILICON',
    name: 'Silicon (Orthosilicic Acid)',
    categories: ['vitamin', 'skin', 'bone'],
    mechanisms: ['COLLAGEN_SUPPORT', 'BONE_MINERALIZATION'],
    organs: ['SKIN', 'BONES'],
    deficiency: 'LOW_SILICON',
    description: 'Витамин (skin, bone), необходимый для здоровья кожи, костной ткани',
    type: 'vitamin'
  },
  {
    id: 'VIT_LITHIUM_OROTATE',
    name: 'Lithium Orotate',
    categories: ['vitamin', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Витамин (neuro), необходимый для нервной системы',
    type: 'vitamin'
  },
  {
    id: 'MIN_MAG_CITRATE',
    name: 'Magnesium Citrate',
    categories: ['minerals', 'relax', 'energy'],
    mechanisms: ['VASCULAR_RELAXATION', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MUSCLES', 'BRAIN'],
    deficiency: 'LOW_MAG',
    description: 'Минерал (relax, energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_GLYCINATE',
    name: 'Magnesium Glycinate',
    categories: ['minerals', 'calming', 'relax'],
    mechanisms: ['GABA_SUPPORT', 'VASCULAR_RELAXATION'],
    organs: ['BRAIN', 'HEART', 'MUSCLES'],
    deficiency: 'ANXIETY',
    description: 'Минерал (calming, relax), участвующий в успокоения',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_MALATE',
    name: 'Magnesium Malate',
    categories: ['minerals', 'energy'],
    mechanisms: ['ATP_PRODUCTION', 'MITO_REPAIR'],
    organs: ['MUSCLES', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_TAURATE',
    name: 'Magnesium Taurate',
    categories: ['minerals', 'cardio'],
    mechanisms: ['VASCULAR_RELAXATION', 'CALCIUM_REGULATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HYPERTENSION',
    description: 'Минерал (cardio), участвующий в ССС',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_THREONATE',
    name: 'Magnesium L-Threonate',
    categories: ['minerals', 'nootropic'],
    mechanisms: ['SYNAPTIC_PLASTICITY', 'NMDA_MODULATION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Минерал (nootropic), участвующий в когнитивных функций',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_OXIDE',
    name: 'Magnesium Oxide',
    categories: ['minerals', 'GI'],
    mechanisms: ['GI_MOTILITY', 'ALKALINE'],
    organs: ['GI'],
    deficiency: 'CONSTIPATION',
    description: 'Минерал (GI), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_SULFATE',
    name: 'Magnesium Sulfate',
    categories: ['minerals', 'detox'],
    mechanisms: ['SULFATE_PATHWAY', 'RELAXATION'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'LOW_MAG',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_CHLORIDE',
    name: 'Magnesium Chloride',
    categories: ['minerals', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['GI', 'MUSCLES'],
    deficiency: 'LOW_MAG',
    description: 'Минерал (electrolyte), участвующий в электролитного баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_PICOLINATE',
    name: 'Zinc Picolinate',
    categories: ['minerals', 'immune', 'hormone'],
    mechanisms: ['IMMUNE_SUPPORT', 'TESTOSTERONE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM', 'HORMONES'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune, hormone), участвующий в иммунной системы, гормонального баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_GLUCONATE',
    name: 'Zinc Gluconate',
    categories: ['minerals', 'immune'],
    mechanisms: ['IMMUNE_SUPPORT', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune), участвующий в иммунной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_CITRATE',
    name: 'Zinc Citrate',
    categories: ['minerals', 'immune'],
    mechanisms: ['IMMUNE_SUPPORT', 'ANTIOXIDANT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune), участвующий в иммунной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_METHIONINE',
    name: 'Zinc Methionine',
    categories: ['minerals', 'hormone', 'immune'],
    mechanisms: ['TESTOSTERONE_SUPPORT', 'IMMUNE_SUPPORT'],
    organs: ['HORMONES', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (hormone, immune), участвующий в гормонального баланса, иммунной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_SELEN_METHIONINE',
    name: 'Selenium Methionine',
    categories: ['minerals', 'antioxidant'],
    mechanisms: ['GPX_ACTIVITY', 'THYROID_SUPPORT'],
    organs: ['THYROID', 'LIVER'],
    deficiency: 'LOW_SELEN',
    description: 'Минерал (antioxidant), участвующий в защиты клеток от окислительного стресса',
    type: 'minerals'
  },
  {
    id: 'MIN_SELEN_SODIUM',
    name: 'Sodium Selenite',
    categories: ['minerals', 'antioxidant'],
    mechanisms: ['GPX_ACTIVITY', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_SELEN',
    description: 'Минерал (antioxidant), участвующий в защиты клеток от окислительного стресса',
    type: 'minerals'
  },
  {
    id: 'MIN_SELEN_YEAST',
    name: 'Selenium Yeast',
    categories: ['minerals', 'antioxidant'],
    mechanisms: ['GPX_ACTIVITY', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_SELEN',
    description: 'Минерал (antioxidant), участвующий в защиты клеток от окислительного стресса',
    type: 'minerals'
  },
  {
    id: 'MIN_CALCIUM_CITRATE',
    name: 'Calcium Citrate',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'CALCIUM_HOMEOSTASIS'],
    organs: ['BONES'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_CALCIUM_CARBONATE',
    name: 'Calcium Carbonate',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'ALKALINE'],
    organs: ['BONES'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_CALCIUM_HYDROXY',
    name: 'Hydroxyapatite',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'COLLAGEN_SUPPORT'],
    organs: ['BONES'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_POTASSIUM_CITRATE',
    name: 'Potassium Citrate',
    categories: ['minerals', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'BLOOD_PRESSURE'],
    organs: ['HEART', 'KIDNEYS'],
    deficiency: 'HYPERTENSION',
    description: 'Минерал (electrolyte), участвующий в электролитного баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_POTASSIUM_CHLORIDE',
    name: 'Potassium Chloride',
    categories: ['minerals', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'LOW_POTASSIUM',
    description: 'Минерал (electrolyte), участвующий в электролитного баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_SODIUM_BICARB',
    name: 'Sodium Bicarbonate',
    categories: ['minerals', 'alkaline'],
    mechanisms: ['PH_BALANCE', 'HYDRATION'],
    organs: ['GI', 'KIDNEYS'],
    deficiency: 'ACIDOSIS',
    description: 'Минерал (alkaline), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_SODIUM_CHLORIDE',
    name: 'Sodium Chloride',
    categories: ['minerals', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['GI', 'MUSCLES'],
    deficiency: 'DEHYDRATION',
    description: 'Минерал (electrolyte), участвующий в электролитного баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_COPPER_GLUCONATE',
    name: 'Copper Gluconate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['CUPROENZYME_SUPPORT', 'COLLAGEN_SUPPORT'],
    organs: ['BLOOD', 'SKIN'],
    deficiency: 'LOW_COPPER',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_COPPER_BISGLY',
    name: 'Copper Bisglycinate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['CUPROENZYME_SUPPORT', 'IRON_METABOLISM'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_COPPER',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MANGANESE_SULFATE',
    name: 'Manganese Sulfate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['SOD_SUPPORT', 'BONE_METABOLISM'],
    organs: ['BONES', 'LIVER'],
    deficiency: 'LOW_MANGANESE',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MANGANESE_BISGLY',
    name: 'Manganese Bisglycinate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['SOD_SUPPORT', 'CARTILAGE_SUPPORT'],
    organs: ['BONES', 'JOINTS'],
    deficiency: 'LOW_MANGANESE',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_CHROMIUM_PICOLINATE',
    name: 'Chromium Picolinate',
    categories: ['minerals', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Минерал (insulin), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_CHROMIUM_NICOTINATE',
    name: 'Chromium Nicotinate',
    categories: ['minerals', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Минерал (insulin), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MOLYBDENUM_GLYC',
    name: 'Molybdenum Glycinate',
    categories: ['minerals', 'detox'],
    mechanisms: ['SULFITE_OXIDASE', 'DETOX'],
    organs: ['LIVER', 'KIDNEYS'],
    deficiency: 'LOW_MOLY',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_MOLYBDENUM_SODIUM',
    name: 'Sodium Molybdate',
    categories: ['minerals', 'detox'],
    mechanisms: ['SULFITE_OXIDASE', 'DETOX'],
    organs: ['LIVER'],
    deficiency: 'LOW_MOLY',
    description: 'Неорганическая форма молибдена',
    type: 'minerals'
  },
  {
    id: 'MIN_IODINE_KI',
    name: 'Potassium Iodide',
    categories: ['minerals', 'thyroid'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS', 'IODINE_UPTAKE'],
    organs: ['THYROID'],
    deficiency: 'LOW_IODINE',
    description: 'Минерал (thyroid), участвующий в щитовидной железы',
    type: 'minerals'
  },
  {
    id: 'MIN_IODINE_KELP',
    name: 'Kelp Iodine',
    categories: ['minerals', 'thyroid'],
    mechanisms: ['THYROID_SUPPORT', 'IODINE_UPTAKE'],
    organs: ['THYROID'],
    deficiency: 'LOW_IODINE',
    description: 'Минерал (thyroid), участвующий в щитовидной железы',
    type: 'minerals'
  },
  {
    id: 'MIN_IODINE_LUGOL',
    name: 'Lugol’s Iodine',
    categories: ['minerals', 'thyroid'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS', 'ANTIMICROBIAL'],
    organs: ['THYROID'],
    deficiency: 'LOW_IODINE',
    description: 'Минерал (thyroid), участвующий в щитовидной железы',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_BISGLY',
    name: 'Iron Bisglycinate',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_FERROUS',
    name: 'Ferrous Sulfate',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_FERRIC',
    name: 'Ferric Citrate',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_POLYSAC',
    name: 'Polysaccharide Iron',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_LITHIUM_OROTATE',
    name: 'Lithium Orotate',
    categories: ['minerals', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Минерал (neuro), участвующий в нервной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_BORON_CHELATE',
    name: 'Boron Chelate',
    categories: ['minerals', 'hormone'],
    mechanisms: ['BONE_METABOLISM', 'TESTOSTERONE_SUPPORT'],
    organs: ['BONES', 'HORMONES'],
    deficiency: 'LOW_BORON',
    description: 'Минерал (hormone), участвующий в гормонального баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_BORON_GLYCINATE',
    name: 'Boron Glycinate',
    categories: ['minerals', 'hormone'],
    mechanisms: ['BONE_METABOLIZATION', 'ESTROGEN_BALANCE'],
    organs: ['BONES', 'HORMONES'],
    deficiency: 'LOW_BORON',
    description: 'Минерал (hormone), участвующий в гормонального баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_SILICON_CHOLINE',
    name: 'Choline-Stabilized Orthosilicic Acid',
    categories: ['minerals', 'skin', 'bone'],
    mechanisms: ['COLLAGEN_SUPPORT', 'BONE_MINERALIZATION'],
    organs: ['SKIN', 'BONES'],
    deficiency: 'LOW_SILICON',
    description: 'Минерал (skin, bone), участвующий в здоровья кожи, костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_SILICON_HORS',
    name: 'Silica (Horsetail)',
    categories: ['minerals', 'skin', 'hair'],
    mechanisms: ['COLLAGEN_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'HAIR'],
    deficiency: 'LOW_SILICON',
    description: 'Минерал (skin, hair), участвующий в здоровья кожи, здоровья волос',
    type: 'minerals'
  },
  {
    id: 'MIN_VANADIUM_SULFATE',
    name: 'Vanadium Sulfate',
    categories: ['minerals', 'insulin'],
    mechanisms: ['INSULIN_MIMETIC', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Минерал (insulin), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_PHOSPHORUS',
    name: 'Phosphorus',
    categories: ['minerals', 'energy'],
    mechanisms: ['ATP_PRODUCTION', 'BONE_MINERALIZATION'],
    organs: ['BONES', 'MUSCLES'],
    deficiency: 'LOW_PHOSPHORUS',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_SULFUR_MSM',
    name: 'MSM (Sulfur)',
    categories: ['minerals', 'joints', 'detox'],
    mechanisms: ['SULFUR_PATHWAY', 'COLLAGEN_SUPPORT'],
    organs: ['JOINTS', 'SKIN'],
    deficiency: 'INFLAMMATION',
    description: 'Минерал (joints, detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_ELECTROLYTE_COMPLEX',
    name: 'Electrolyte Complex',
    categories: ['minerals', 'hydration'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'DEHYDRATION',
    description: 'Минерал (hydration), участвующий в гидратации',
    type: 'minerals'
  },
  {
    id: 'MIN_TRACE_COMPLEX',
    name: 'Trace Mineral Complex',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['MICRONUTRIENT_SUPPORT', 'ANTIOXIDANT'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_LACTATE',
    name: 'Magnesium Lactate',
    categories: ['minerals', 'energy', 'relax'],
    mechanisms: ['ATP_PRODUCTION', 'VASCULAR_RELAXATION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Минерал (energy, relax), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_ASPARTATE',
    name: 'Magnesium Aspartate',
    categories: ['minerals', 'energy'],
    mechanisms: ['ATP_PRODUCTION', 'NMDA_MODULATION'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_FUMARATE',
    name: 'Magnesium Fumarate',
    categories: ['minerals', 'energy'],
    mechanisms: ['FUMARATE_CYCLE', 'ATP_PRODUCTION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_SUCCINATE',
    name: 'Magnesium Succinate',
    categories: ['minerals', 'energy'],
    mechanisms: ['SUCCINATE_PATHWAY', 'ATP_PRODUCTION'],
    organs: ['MUSCLES', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_OROTATE',
    name: 'Magnesium Orotate',
    categories: ['minerals', 'cardio', 'energy'],
    mechanisms: ['OROTATE_PATHWAY', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'HEART_STRESS',
    description: 'Минерал (cardio, energy), участвующий в ССС, энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_MAG_PHOSPHATE',
    name: 'Magnesium Phosphate',
    categories: ['minerals', 'energy'],
    mechanisms: ['ATP_SYNTHESIS', 'ELECTROLYTE_BALANCE'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'LOW_MAG',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_ACETATE',
    name: 'Zinc Acetate',
    categories: ['minerals', 'immune', 'antiviral'],
    mechanisms: ['IMMUNE_SUPPORT', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune, antiviral), участвующий в иммунной системы, противовирусной защиты',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_SULFATE',
    name: 'Zinc Sulfate',
    categories: ['minerals', 'immune'],
    mechanisms: ['IMMUNE_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune), участвующий в иммунной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_ZINC_LIPOSOMAL',
    name: 'Liposomal Zinc',
    categories: ['minerals', 'immune', 'absorption'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Минерал (immune, absorption), участвующий в иммунной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_SELEN_LIPOSOMAL',
    name: 'Liposomal Selenium',
    categories: ['minerals', 'antioxidant'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'GPX_ACTIVITY'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_SELEN',
    description: 'Минерал (antioxidant), участвующий в защиты клеток от окислительного стресса',
    type: 'minerals'
  },
  {
    id: 'MIN_SELEN_ENHANCED',
    name: 'Enhanced Selenium Complex',
    categories: ['minerals', 'antioxidant'],
    mechanisms: ['GPX_ACTIVITY', 'THYROID_SUPPORT'],
    organs: ['THYROID', 'LIVER'],
    deficiency: 'LOW_SELEN',
    description: 'Минерал (antioxidant), участвующий в защиты клеток от окислительного стресса',
    type: 'minerals'
  },
  {
    id: 'MIN_CALCIUM_LACTATE',
    name: 'Calcium Lactate',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'ALKALINE'],
    organs: ['BONES'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_CALCIUM_AA',
    name: 'Calcium Amino Acid Chelate',
    categories: ['minerals', 'bone', 'absorption'],
    mechanisms: ['BONE_MINERALIZATION', 'COLLAGEN_SUPPORT'],
    organs: ['BONES'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone, absorption), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_POTASSIUM_BICARB',
    name: 'Potassium Bicarbonate',
    categories: ['minerals', 'alkaline'],
    mechanisms: ['PH_BALANCE', 'ELECTROLYTE_BALANCE'],
    organs: ['HEART', 'KIDNEYS'],
    deficiency: 'ACIDOSIS',
    description: 'Минерал (alkaline), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_POTASSIUM_OROTATE',
    name: 'Potassium Orotate',
    categories: ['minerals', 'cardio', 'energy'],
    mechanisms: ['OROTATE_PATHWAY', 'ELECTROLYTE_BALANCE'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'HYPERTENSION',
    description: 'Минерал (cardio, energy), участвующий в ССС, энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_SODIUM_OROTATE',
    name: 'Sodium Orotate',
    categories: ['minerals', 'energy'],
    mechanisms: ['OROTATE_PATHWAY', 'HYDRATION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'DEHYDRATION',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_COPPER_CHELATE',
    name: 'Copper Chelate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['CUPROENZYME_SUPPORT', 'IRON_METABOLISM'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_COPPER',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_COPPER_LIPOSOMAL',
    name: 'Liposomal Copper',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'CUPROENZYME_SUPPORT'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'LOW_COPPER',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MANGANESE_CHELATE',
    name: 'Manganese Chelate',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['SOD_SUPPORT', 'CARTILAGE_SUPPORT'],
    organs: ['JOINTS', 'BONES'],
    deficiency: 'LOW_MANGANESE',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_CHROMIUM_GTF',
    name: 'GTF Chromium',
    categories: ['minerals', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Минерал (insulin), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_MOLYBDENUM_COMPLEX',
    name: 'Molybdenum Complex',
    categories: ['minerals', 'detox'],
    mechanisms: ['SULFITE_OXIDASE', 'DETOX'],
    organs: ['LIVER', 'KIDNEYS'],
    deficiency: 'LOW_MOLY',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_IODINE_ATOMIC',
    name: 'Atomic Iodine',
    categories: ['minerals', 'thyroid'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS', 'IODINE_UPTAKE'],
    organs: ['THYROID'],
    deficiency: 'LOW_IODINE',
    description: 'Минерал (thyroid), участвующий в щитовидной железы',
    type: 'minerals'
  },
  {
    id: 'MIN_IODINE_NAScent',
    name: 'Nascent Iodine',
    categories: ['minerals', 'thyroid'],
    mechanisms: ['THYROID_SUPPORT', 'IODINE_UPTAKE'],
    organs: ['THYROID'],
    deficiency: 'LOW_IODINE',
    description: 'Минерал (thyroid), участвующий в щитовидной железы',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_HEME',
    name: 'Heme Iron',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_LIPOSOMAL',
    name: 'Liposomal Iron',
    categories: ['minerals', 'blood'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_IRON_FUMARATE',
    name: 'Ferrous Fumarate',
    categories: ['minerals', 'blood'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'IRON_UPTAKE'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Минерал (blood), участвующий в кроветворения',
    type: 'minerals'
  },
  {
    id: 'MIN_LITHIUM_ASPARTATE',
    name: 'Lithium Aspartate',
    categories: ['minerals', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Минерал (neuro), участвующий в нервной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_BORON_CALCIUM',
    name: 'Boron Calcium Fructoborate',
    categories: ['minerals', 'hormone'],
    mechanisms: ['BONE_METABOLISM', 'TESTOSTERONE_SUPPORT'],
    organs: ['BONES', 'HORMONES'],
    deficiency: 'LOW_BORON',
    description: 'Минерал (hormone), участвующий в гормонального баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_SILICON_BAMBOO',
    name: 'Bamboo Silica',
    categories: ['minerals', 'skin', 'hair'],
    mechanisms: ['COLLAGEN_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'HAIR'],
    deficiency: 'LOW_SILICON',
    description: 'Минерал (skin, hair), участвующий в здоровья кожи, здоровья волос',
    type: 'minerals'
  },
  {
    id: 'MIN_VANADIUM_OROTATE',
    name: 'Vanadium Orotate',
    categories: ['minerals', 'insulin'],
    mechanisms: ['INSULIN_MIMETIC', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Минерал (insulin), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_PHOSPHORUS_ORGANIC',
    name: 'Organic Phosphorus',
    categories: ['minerals', 'energy'],
    mechanisms: ['ATP_PRODUCTION', 'BONE_MINERALIZATION'],
    organs: ['BONES', 'MUSCLES'],
    deficiency: 'LOW_PHOSPHORUS',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_SULFUR_DMSO',
    name: 'DMSO (Sulfur)',
    categories: ['minerals', 'detox', 'antiinflammatory'],
    mechanisms: ['SULFUR_PATHWAY', 'ANTI_INFLAMMATION'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'INFLAMMATION',
    description: 'Минерал (detox, antiinflammatory), участвующий в детоксикации, противовоспалительной защиты',
    type: 'minerals'
  },
  {
    id: 'MIN_ELECTROLYTE_SEA',
    name: 'Sea Electrolytes',
    categories: ['minerals', 'hydration'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'DEHYDRATION',
    description: 'Минерал (hydration), участвующий в гидратации',
    type: 'minerals'
  },
  {
    id: 'MIN_ELECTROLYTE_IONIC',
    name: 'Ionic Electrolytes',
    categories: ['minerals', 'hydration'],
    mechanisms: ['IONIC_ABSORPTION', 'ELECTROLYTE_BALANCE'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'DEHYDRATION',
    description: 'Минерал (hydration), участвующий в гидратации',
    type: 'minerals'
  },
  {
    id: 'MIN_TRACE_FULVIC',
    name: 'Fulvic Trace Minerals',
    categories: ['minerals', 'enzyme'],
    mechanisms: ['FULVIC_TRANSPORT', 'MICRONUTRIENT_SUPPORT'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал (enzyme), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_TRACE_HUMIC',
    name: 'Humic Trace Minerals',
    categories: ['minerals', 'detox'],
    mechanisms: ['HUMIC_BINDING', 'MICRONUTRIENT_SUPPORT'],
    organs: ['GI', 'LIVER'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_SILVER_COLLOID',
    name: 'Colloidal Silver',
    categories: ['minerals', 'antimicrobial'],
    mechanisms: ['SILVER_ION_ACTION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Минерал (antimicrobial), участвующий в противомикробной защиты',
    type: 'minerals'
  },
  {
    id: 'MIN_GOLD_COLLOID',
    name: 'Colloidal Gold',
    categories: ['minerals', 'neuro'],
    mechanisms: ['NEURO_MODULATION', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Минерал (neuro), участвующий в нервной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_PLATINUM_COLLOID',
    name: 'Colloidal Platinum',
    categories: ['minerals', 'neuro'],
    mechanisms: ['NEURO_ENHANCEMENT', 'CELL_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Минерал (neuro), участвующий в нервной системы',
    type: 'minerals'
  },
  {
    id: 'MIN_GERMANIUM_ORG',
    name: 'Organic Germanium',
    categories: ['minerals', 'oxygen'],
    mechanisms: ['OXYGEN_UTILIZATION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM', 'HEART'],
    deficiency: 'LOW_OXYGEN',
    description: 'Минерал (oxygen), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_GERMANIUM_SEMI',
    name: 'Semiconductor Germanium',
    categories: ['minerals', 'energy'],
    mechanisms: ['SEMICONDUCTOR_EFFECT', 'CELL_SIGNALING'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_OXYGEN',
    description: 'Минерал (energy), участвующий в энергетического обмена',
    type: 'minerals'
  },
  {
    id: 'MIN_RUBIDIUM',
    name: 'Rubidium',
    categories: ['minerals', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'NEURO_MODULATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_RUBIDIUM',
    description: 'Минерал (electrolyte), участвующий в электролитного баланса',
    type: 'minerals'
  },
  {
    id: 'MIN_CESIUM',
    name: 'Cesium',
    categories: ['minerals', 'alkaline'],
    mechanisms: ['PH_BALANCE', 'CELL_REGULATION'],
    organs: ['CELLS'],
    deficiency: 'ACIDOSIS',
    description: 'Минерал (alkaline), участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_STRONTIUM',
    name: 'Strontium',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'OSTEOBLAST_STIMULATION'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_STRONTIUM_CITRATE',
    name: 'Strontium Citrate',
    categories: ['minerals', 'bone'],
    mechanisms: ['BONE_MINERALIZATION', 'OSTEOBLAST_STIMULATION'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Минерал (bone), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_ZEOLITE',
    name: 'Zeolite',
    categories: ['minerals', 'detox'],
    mechanisms: ['ION_EXCHANGE', 'HEAVY_METAL_BINDING'],
    organs: ['GI', 'LIVER'],
    deficiency: 'TOXINS',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_BENTONITE',
    name: 'Bentonite Clay',
    categories: ['minerals', 'detox'],
    mechanisms: ['ADSORPTION', 'GI_BINDING'],
    organs: ['GI', 'LIVER'],
    deficiency: 'TOXINS',
    description: 'Минерал (detox), участвующий в детоксикации',
    type: 'minerals'
  },
  {
    id: 'MIN_CORAL_CALCIUM',
    name: 'Coral Calcium',
    categories: ['minerals', 'bone', 'alkaline'],
    mechanisms: ['BONE_MINERALIZATION', 'PH_BALANCE'],
    organs: ['BONES', 'GI'],
    deficiency: 'LOW_CALCIUM',
    description: 'Минерал (bone, alkaline), участвующий в костной ткани',
    type: 'minerals'
  },
  {
    id: 'MIN_RED_MINERAL',
    name: 'Red Mineral Complex',
    categories: ['minerals', 'trace'],
    mechanisms: ['MICRONUTRIENT_SUPPORT', 'ANTIOXIDANT'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал, участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_BLACK_MINERAL',
    name: 'Black Mineral Complex',
    categories: ['minerals', 'trace'],
    mechanisms: ['FULVIC_TRANSPORT', 'ANTIOXIDANT'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал, участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'MIN_BLUE_MINERAL',
    name: 'Blue Mineral Complex',
    categories: ['minerals', 'trace'],
    mechanisms: ['IONIC_ABSORPTION', 'MICRONUTRIENT_SUPPORT'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'DEFICIENCY',
    description: 'Минерал, участвующий в обменных процессах и поддержании здоровья',
    type: 'minerals'
  },
  {
    id: 'AA_L_GLUTAMINE',
    name: 'L-Glutamine',
    categories: ['amino', 'GI', 'immune'],
    mechanisms: ['GI_REPAIR', 'IMMUNE_SUPPORT'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE',
    name: 'Glycine',
    categories: ['amino', 'calming', 'detox'],
    mechanisms: ['GABA_SUPPORT', 'COLLAGEN_SUPPORT'],
    organs: ['BRAIN', 'SKIN', 'LIVER'],
    deficiency: 'INSOMNIA',
    description: 'Аминокислота, участвующая в успокоения, детоксикации',
    type: 'amino'
  },
  {
    id: 'AA_L_TAURINE',
    name: 'Taurine',
    categories: ['amino', 'cardio', 'neuro'],
    mechanisms: ['CALCIUM_REGULATION', 'GABA_SUPPORT'],
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    deficiency: 'HYPERTENSION',
    description: 'Аминокислота, участвующая в ССС, нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_THEANINE',
    name: 'L-Theanine',
    categories: ['amino', 'nootropic', 'calming'],
    mechanisms: ['ALPHA_WAVE_UP', 'GABA_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в когнитивных функций, успокоения',
    type: 'amino'
  },
  {
    id: 'AA_L_TYROSINE',
    name: 'L-Tyrosine',
    categories: ['amino', 'nootropic', 'hormone'],
    mechanisms: ['DOPAMINE_SYNTHESIS', 'THYROID_SUPPORT'],
    organs: ['BRAIN', 'THYROID'],
    deficiency: 'LOW_DOPAMINE',
    description: 'Аминокислота, участвующая в когнитивных функций, гормонального баланса',
    type: 'amino'
  },
  {
    id: 'AA_L_DOPA',
    name: 'Mucuna L-DOPA',
    categories: ['amino', 'nootropic'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'PARKINSON',
    description: 'Аминокислота, участвующая в когнитивных функций',
    type: 'amino'
  },
  {
    id: 'AA_L_TRYPTOPHAN',
    name: 'L-Tryptophan',
    categories: ['amino', 'neuro'],
    mechanisms: ['SEROTONIN_SYNTHESIS', 'MELATONIN_PATHWAY'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_5HTP',
    name: '5-HTP',
    categories: ['amino', 'neuro'],
    mechanisms: ['SEROTONIN_UP', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNITINE',
    name: 'L-Carnitine',
    categories: ['amino', 'mitochondria'],
    mechanisms: ['FATTY_ACID_TRANSPORT', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_ALCAR',
    name: 'Acetyl-L-Carnitine',
    categories: ['amino', 'nootropic', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ACH_SUPPORT'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в когнитивных функций, работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNITINE_TARTRATE',
    name: 'L-Carnitine Tartrate',
    categories: ['amino', 'performance'],
    mechanisms: ['FATTY_ACID_TRANSPORT', 'ATP_PRODUCTION'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Аминокислота, участвующая в производительности',
    type: 'amino'
  },
  {
    id: 'AA_L_CITRULLINE',
    name: 'L-Citrulline',
    categories: ['amino', 'vascular'],
    mechanisms: ['NO_PRODUCTION', 'VASCULAR_DILATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_ARGININE',
    name: 'L-Arginine',
    categories: ['amino', 'vascular'],
    mechanisms: ['NO_PRODUCTION', 'VASCULAR_DILATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_AGMATINE',
    name: 'Agmatine',
    categories: ['amino', 'nootropic', 'vascular'],
    mechanisms: ['NMDA_MODULATION', 'NO_MODULATION'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в когнитивных функций',
    type: 'amino'
  },
  {
    id: 'AA_L_HISTIDINE',
    name: 'L-Histidine',
    categories: ['amino', 'blood', 'immune'],
    mechanisms: ['HISTAMINE_PATHWAY', 'HEMOGLOBIN_SUPPORT'],
    organs: ['BLOOD', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_HISTIDINE',
    description: 'Аминокислота, участвующая в кроветворения, иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_METHIONINE',
    name: 'L-Methionine',
    categories: ['amino', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'LIVER_SUPPORT'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_CYSTEINE',
    name: 'L-Cysteine',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['GLUTATHIONE_SYNTHESIS', 'DETOX'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_GSH',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_NAC',
    name: 'N-Acetyl-Cysteine',
    categories: ['amino', 'antioxidant', 'lung'],
    mechanisms: ['GLUTATHIONE_UP', 'MUCUS_BREAKDOWN'],
    organs: ['LUNGS', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса, легких',
    type: 'amino'
  },
  {
    id: 'AA_L_SERINE',
    name: 'L-Serine',
    categories: ['amino', 'neuro'],
    mechanisms: ['PHOSPHOLIPID_SYNTHESIS', 'NMDA_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_PHOSPHO_SERINE',
    name: 'Phospho-L-Serine',
    categories: ['amino', 'nootropic'],
    mechanisms: ['PHOSPHOLIPID_SUPPORT', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фосфорилированная форма серина',
    type: 'amino'
  },
  {
    id: 'AA_L_ALANINE',
    name: 'L-Alanine',
    categories: ['amino', 'energy'],
    mechanisms: ['GLUCOSE_CYCLE', 'MUSCLE_SUPPORT'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'amino'
  },
  {
    id: 'AA_BETA_ALANINE',
    name: 'Beta-Alanine',
    categories: ['amino', 'performance'],
    mechanisms: ['CARNOSINE_SYNTHESIS', 'LACTATE_BUFFER'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Аминокислота, участвующая в производительности',
    type: 'amino'
  },
  {
    id: 'AA_L_PROLINE',
    name: 'L-Proline',
    categories: ['amino', 'skin', 'collagen'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'LOW_COLLAGEN',
    description: 'Аминокислота, участвующая в здоровья кожи, соединительной ткани',
    type: 'amino'
  },
  {
    id: 'AA_L_HYDROXYPROLINE',
    name: 'Hydroxyproline',
    categories: ['amino', 'skin', 'collagen'],
    mechanisms: ['COLLAGEN_SUPPORT', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'LOW_COLLAGEN',
    description: 'Аминокислота, участвующая в здоровья кожи, соединительной ткани',
    type: 'amino'
  },
  {
    id: 'AA_L_VALINE',
    name: 'L-Valine',
    categories: ['amino', 'BCAA'],
    mechanisms: ['MUSCLE_ENERGY', 'RECOVERY'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_LEUCINE',
    name: 'L-Leucine',
    categories: ['amino', 'BCAA', 'anabolic'],
    mechanisms: ['MTOR_ACTIVATION', 'MUSCLE_GROWTH'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_ISOLEUCINE',
    name: 'L-Isoleucine',
    categories: ['amino', 'BCAA'],
    mechanisms: ['GLUCOSE_UPTAKE', 'RECOVERY'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_BCAA_COMPLEX',
    name: 'BCAA Complex',
    categories: ['amino', 'performance', 'anabolic'],
    mechanisms: ['MTOR_ACTIVATION', 'MUSCLE_ENERGY'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Аминокислота, участвующая в производительности',
    type: 'amino'
  },
  {
    id: 'AA_L_GLUTAMIC',
    name: 'L-Glutamic Acid',
    categories: ['amino', 'neuro'],
    mechanisms: ['NMDA_SUPPORT', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'LOW_GLU',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_ASPARTIC',
    name: 'L-Aspartic Acid',
    categories: ['amino', 'energy'],
    mechanisms: ['ATP_PRODUCTION', 'HORMONE_SUPPORT'],
    organs: ['MUSCLES', 'HORMONES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'amino'
  },
  {
    id: 'AA_L_ORNITHINE',
    name: 'L-Ornithine',
    categories: ['amino', 'detox'],
    mechanisms: ['UREA_CYCLE', 'AMMONIA_CLEARANCE'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'AMMONIA',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'amino'
  },
  {
    id: 'AA_L_CITRULLINE_DL',
    name: 'DL-Citrulline',
    categories: ['amino', 'vascular'],
    mechanisms: ['NO_PRODUCTION', 'VASCULAR_DILATION'],
    organs: ['VESSELS'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_ASPARAGINE',
    name: 'L-Asparagine',
    categories: ['amino', 'cell'],
    mechanisms: ['CELL_GROWTH', 'PROTEIN_SYNTHESIS'],
    organs: ['CELLS'],
    deficiency: 'LOW_PROTEIN',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'amino'
  },
  {
    id: 'AA_L_THREONINE',
    name: 'L-Threonine',
    categories: ['amino', 'GI', 'immune'],
    mechanisms: ['GI_MUCUS_SUPPORT', 'IMMUNE_SUPPORT'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_THREONINE',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_LYSINE',
    name: 'L-Lysine',
    categories: ['amino', 'immune', 'skin'],
    mechanisms: ['COLLAGEN_SUPPORT', 'ANTIVIRAL'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'HERPES',
    description: 'Аминокислота, участвующая в иммунной системы, здоровья кожи',
    type: 'amino'
  },
  {
    id: 'AA_L_HYDROXYLYSINE',
    name: 'Hydroxylysine',
    categories: ['amino', 'collagen'],
    mechanisms: ['COLLAGEN_SUPPORT', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'LOW_COLLAGEN',
    description: 'Аминокислота, участвующая в соединительной ткани',
    type: 'amino'
  },
  {
    id: 'AA_L_PHENYLALANINE',
    name: 'L-Phenylalanine',
    categories: ['amino', 'neuro'],
    mechanisms: ['DOPAMINE_SYNTHESIS', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'LOW_DOPAMINE',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_D_PHE',
    name: 'D-Phenylalanine',
    categories: ['amino', 'pain'],
    mechanisms: ['ENDORPHIN_UP', 'PAIN_MODULATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'PAIN',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_DL_PHE',
    name: 'DL-Phenylalanine',
    categories: ['amino', 'neuro', 'pain'],
    mechanisms: ['DOPAMINE_UP', 'ENDORPHIN_UP'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'PAIN',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_HOMOCYSTEINE',
    name: 'Homocysteine (Regulated)',
    categories: ['amino', 'methylation'],
    mechanisms: ['HOMOCYSTEINE_PATHWAY', 'METHYLATION'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_GABA',
    name: 'GABA (Amino Form)',
    categories: ['amino', 'calming'],
    mechanisms: ['GABA_UP', 'STRESS_REDUCTION'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'amino'
  },
  {
    id: 'AA_PHENIBUT',
    name: 'Phenibut (Amino Derivative)',
    categories: ['amino', 'calming', 'nootropic'],
    mechanisms: ['GABA_B_AGONIST', 'ANXIOLYTIC'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения, когнитивных функций',
    type: 'amino'
  },
  {
    id: 'AA_L_BETAINE',
    name: 'Betaine (TMG)',
    categories: ['amino', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNOSINE',
    name: 'Carnosine',
    categories: ['amino', 'antioxidant', 'anti_glycation'],
    mechanisms: ['ANTI_GLYCATION', 'ANTIOXIDANT'],
    organs: ['MUSCLES', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_ANserine',
    name: 'Anserine',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['ANTIOXIDANT', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_SARCOSINE',
    name: 'Sarcosine',
    categories: ['amino', 'nootropic'],
    mechanisms: ['NMDA_COAGONIST', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в когнитивных функций',
    type: 'amino'
  },
  {
    id: 'AA_L_D_SERINE',
    name: 'D-Serine',
    categories: ['amino', 'nootropic'],
    mechanisms: ['NMDA_COAGONIST', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в когнитивных функций',
    type: 'amino'
  },
  {
    id: 'AA_L_BETAINE_HCL',
    name: 'Betaine HCL',
    categories: ['amino', 'GI'],
    mechanisms: ['STOMACH_ACID_UP', 'DIGESTION'],
    organs: ['GI'],
    deficiency: 'LOW_STOMACH_ACID',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLUCONIC',
    name: 'Glutamine Peptides',
    categories: ['amino', 'GI', 'recovery'],
    mechanisms: ['GI_REPAIR', 'PROTEIN_SYNTHESIS'],
    organs: ['GI', 'MUSCLES'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в восстановления',
    type: 'amino'
  },
  {
    id: 'AA_L_COLLAGEN_AMINO',
    name: 'Collagen Amino Blend',
    categories: ['amino', 'skin', 'joint'],
    mechanisms: ['COLLAGEN_SUPPORT', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'LOW_COLLAGEN',
    description: 'Аминокислота, участвующая в здоровья кожи, суставов',
    type: 'amino'
  },
  {
    id: 'AA_L_NORVALINE',
    name: 'L-Norvaline',
    categories: ['amino', 'vascular'],
    mechanisms: ['ARGINASE_INHIBITION', 'NO_UP'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_NORLEUCINE',
    name: 'L-Norleucine',
    categories: ['amino', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'PROTEIN_SYNTHESIS'],
    organs: ['CELLS'],
    deficiency: 'LOW_PROTEIN',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'amino'
  },
  {
    id: 'AA_L_CITRAPEAK',
    name: 'CitraPeak (Citrulline Derivative)',
    categories: ['amino', 'vascular'],
    mechanisms: ['NO_UP', 'VASCULAR_DILATION'],
    organs: ['VESSELS'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_ARG_KETO',
    name: 'Arginine Alpha-Ketoglutarate',
    categories: ['amino', 'vascular', 'performance'],
    mechanisms: ['NO_UP', 'ATP_PRODUCTION'],
    organs: ['VESSELS', 'MUSCLES'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в производительности',
    type: 'amino'
  },
  {
    id: 'AA_L_HMB',
    name: 'HMB (Beta-Hydroxy Beta-Methylbutyrate)',
    categories: ['amino', 'anabolic'],
    mechanisms: ['MTOR_UP', 'MUSCLE_PRESERVATION'],
    organs: ['MUSCLES'],
    deficiency: 'CATABOLISM',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_HICA',
    name: 'HICA (Leucic Acid)',
    categories: ['amino', 'anabolic'],
    mechanisms: ['ANTI_CATABOLIC', 'MTOR_UP'],
    organs: ['MUSCLES'],
    deficiency: 'CATABOLISM',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLUCONATE',
    name: 'Glutamine AKG',
    categories: ['amino', 'GI', 'energy'],
    mechanisms: ['GI_REPAIR', 'ATP_PRODUCTION'],
    organs: ['GI', 'MUSCLES'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'amino'
  },
  {
    id: 'AA_L_GLUTATHIONE',
    name: 'Reduced Glutathione',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['GLUTATHIONE_UP', 'DETOX'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_GSH_LIP',
    name: 'Liposomal Glutathione',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'GLUTATHIONE_UP'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_PROPIONYL',
    name: 'Propionyl-L-Carnitine',
    categories: ['amino', 'vascular', 'mitochondria'],
    mechanisms: ['ATP_PRODUCTION', 'NO_UP'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_ACETYL',
    name: 'Acetyl-Glycine',
    categories: ['amino', 'neuro'],
    mechanisms: ['GABA_SUPPORT', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_METHYLHISTIDINE',
    name: '1-Methylhistidine',
    categories: ['amino', 'muscle'],
    mechanisms: ['MUSCLE_RECOVERY', 'ANTIOXIDANT'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в мышц',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNITINE_FUMARATE',
    name: 'L-Carnitine Fumarate',
    categories: ['amino', 'mitochondria'],
    mechanisms: ['FUMARATE_CYCLE', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_L_GAMMA_BUTYROBETAINE',
    name: 'Gamma-Butyrobetaine',
    categories: ['amino', 'mitochondria'],
    mechanisms: ['CARNITINE_PRECURSOR', 'FAT_OXIDATION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'LOW_CARNITINE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_L_ARGININE_NITRATE',
    name: 'Arginine Nitrate',
    categories: ['amino', 'vascular'],
    mechanisms: ['NITRATE_PATHWAY', 'NO_UP'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_CITRULLINE_NITRATE',
    name: 'Citrulline Nitrate',
    categories: ['amino', 'vascular'],
    mechanisms: ['NITRATE_PATHWAY', 'NO_UP'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_HISTAMINE_REG',
    name: 'Histamine-Regulated AA Blend',
    categories: ['amino', 'immune'],
    mechanisms: ['HISTAMINE_MODULATION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCOCARN',
    name: 'GlycoCarn (Glycine Propionyl-L-Carnitine)',
    categories: ['amino', 'vascular', 'mitochondria'],
    mechanisms: ['NO_UP', 'ATP_PRODUCTION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'amino'
  },
  {
    id: 'AA_L_TMG_BETAINE',
    name: 'TMG Betaine Anhydrous',
    categories: ['amino', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_REDUCTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_CYSTEINE_BOND',
    name: 'NACET (N-Acetylcysteine Ethyl Ester)',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_GABA_PHARMA',
    name: 'GABA Pharma-Grade',
    categories: ['amino', 'calming'],
    mechanisms: ['GABA_UP', 'STRESS_REDUCTION'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_MAG',
    name: 'Glycine Magnesium Chelate',
    categories: ['amino', 'relax', 'mineral'],
    mechanisms: ['GABA_SUPPORT', 'VASCULAR_RELAXATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_TAURINE_MAG',
    name: 'Taurine Magnesium Chelate',
    categories: ['amino', 'cardio', 'mineral'],
    mechanisms: ['CALCIUM_REGULATION', 'VASCULAR_RELAXATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HYPERTENSION',
    description: 'Аминокислота, участвующая в ССС',
    type: 'amino'
  },
  {
    id: 'AA_L_TAURINE_ZINC',
    name: 'Taurine Zinc Chelate',
    categories: ['amino', 'immune', 'mineral'],
    mechanisms: ['IMMUNE_SUPPORT', 'ANTIOXIDANT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_ZINC',
    name: 'Glycine Zinc Chelate',
    categories: ['amino', 'immune', 'mineral'],
    mechanisms: ['IMMUNE_SUPPORT', 'SKIN_HEALTH'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_METHIONINE_SAMe',
    name: 'SAM-e (S-Adenosyl Methionine)',
    categories: ['amino', 'mood', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'SEROTONIN_SUPPORT'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'DEPRESSION',
    description: 'Аминокислота, участвующая в нормализации настроения, метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_CYSTATHIONINE',
    name: 'Cystathionine',
    categories: ['amino', 'methylation'],
    mechanisms: ['HOMOCYSTEINE_PATHWAY', 'DETOX'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'amino'
  },
  {
    id: 'AA_L_HOMOSERINE',
    name: 'Homoserine',
    categories: ['amino', 'cell'],
    mechanisms: ['CELL_GROWTH', 'PROTEIN_SYNTHESIS'],
    organs: ['CELLS'],
    deficiency: 'LOW_PROTEIN',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'amino'
  },
  {
    id: 'AA_L_SELENOCYSTEINE',
    name: 'Selenocysteine',
    categories: ['amino', 'antioxidant'],
    mechanisms: ['GPX_ACTIVITY', 'THYROID_SUPPORT'],
    organs: ['THYROID', 'LIVER'],
    deficiency: 'LOW_SELEN',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'amino'
  },
  {
    id: 'AA_L_PYRROLYSINE',
    name: 'Pyrrolysine',
    categories: ['amino', 'cell'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'CELL_REGULATION'],
    organs: ['CELLS'],
    deficiency: 'LOW_PROTEIN',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'amino'
  },
  {
    id: 'AA_L_ORNITHINE_AKG',
    name: 'Ornithine AKG',
    categories: ['amino', 'detox', 'performance'],
    mechanisms: ['UREA_CYCLE', 'ATP_PRODUCTION'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'AMMONIA',
    description: 'Аминокислота, участвующая в детоксикации, производительности',
    type: 'amino'
  },
  {
    id: 'AA_L_ARGININE_SILICON',
    name: 'Arginine Silicate',
    categories: ['amino', 'vascular', 'skin'],
    mechanisms: ['NO_UP', 'COLLAGEN_SUPPORT'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'LOW_NO',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_SILICON',
    name: 'Glycine Silicate',
    categories: ['amino', 'skin', 'bone'],
    mechanisms: ['COLLAGEN_SUPPORT', 'BONE_MINERALIZATION'],
    organs: ['SKIN', 'BONES'],
    deficiency: 'LOW_SILICON',
    description: 'Аминокислота, участвующая в здоровья кожи, костной ткани',
    type: 'amino'
  },
  {
    id: 'AA_L_HISTIDINE_ZINC',
    name: 'Histidine Zinc Chelate',
    categories: ['amino', 'immune', 'skin'],
    mechanisms: ['ANTIOXIDANT', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Аминокислота, участвующая в иммунной системы, здоровья кожи',
    type: 'amino'
  },
  {
    id: 'AA_L_CYSTEINE_ZINC',
    name: 'Cysteine Zinc Chelate',
    categories: ['amino', 'antioxidant', 'immune'],
    mechanisms: ['GLUTATHIONE_UP', 'IMMUNE_SUPPORT'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'LOW_ZINC',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса, иммунной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_IRON',
    name: 'Glycine Iron Chelate',
    categories: ['amino', 'blood'],
    mechanisms: ['IRON_UPTAKE', 'HEMOGLOBIN_SUPPORT'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Аминокислота, участвующая в кроветворения',
    type: 'amino'
  },
  {
    id: 'AA_L_HISTIDINE_IRON',
    name: 'Histidine Iron Chelate',
    categories: ['amino', 'blood'],
    mechanisms: ['IRON_UPTAKE', 'HEMOGLOBIN_SUPPORT'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Аминокислота, участвующая в кроветворения',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNITINE_ZINC',
    name: 'Carnitine Zinc Chelate',
    categories: ['amino', 'hormone', 'energy'],
    mechanisms: ['TESTOSTERONE_SUPPORT', 'ATP_PRODUCTION'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Аминокислота, участвующая в гормонального баланса, энергетического обмена',
    type: 'amino'
  },
  {
    id: 'AA_L_CARNITINE_MAG',
    name: 'Carnitine Magnesium Chelate',
    categories: ['amino', 'energy', 'mineral'],
    mechanisms: ['ATP_PRODUCTION', 'VASCULAR_RELAXATION'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_CALCIUM',
    name: 'Glycine Calcium Chelate',
    categories: ['amino', 'bone', 'skin'],
    mechanisms: ['COLLAGEN_SUPPORT', 'BONE_MINERALIZATION'],
    organs: ['BONES', 'SKIN'],
    deficiency: 'LOW_CALCIUM',
    description: 'Аминокислота, участвующая в костной ткани, здоровья кожи',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_POTASSIUM',
    name: 'Glycine Potassium Chelate',
    categories: ['amino', 'electrolyte'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'HYDRATION'],
    organs: ['HEART', 'MUSCLES'],
    deficiency: 'LOW_POTASSIUM',
    description: 'Аминокислота, участвующая в электролитного баланса',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_MANGANESE',
    name: 'Glycine Manganese Chelate',
    categories: ['amino', 'enzyme'],
    mechanisms: ['SOD_SUPPORT', 'CARTILAGE_SUPPORT'],
    organs: ['JOINTS', 'BONES'],
    deficiency: 'LOW_MANGANESE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_COPPER',
    name: 'Glycine Copper Chelate',
    categories: ['amino', 'enzyme'],
    mechanisms: ['CUPROENZYME_SUPPORT', 'IRON_METABOLISM'],
    organs: ['BLOOD', 'LIVER'],
    deficiency: 'LOW_COPPER',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_MOLYBDENUM',
    name: 'Glycine Molybdenum Chelate',
    categories: ['amino', 'detox'],
    mechanisms: ['SULFITE_OXIDASE', 'DETOX'],
    organs: ['LIVER', 'KIDNEYS'],
    deficiency: 'LOW_MOLY',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_CHROMIUM',
    name: 'Glycine Chromium Chelate',
    categories: ['amino', 'insulin'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_BORON',
    name: 'Glycine Boron Chelate',
    categories: ['amino', 'hormone'],
    mechanisms: ['BONE_METABOLISM', 'TESTOSTERONE_SUPPORT'],
    organs: ['BONES', 'HORMONES'],
    deficiency: 'LOW_BORON',
    description: 'Аминокислота, участвующая в гормонального баланса',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_SILVER',
    name: 'Glycine Silver Chelate',
    categories: ['amino', 'antimicrobial'],
    mechanisms: ['SILVER_ION_ACTION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Аминокислота, участвующая в противомикробной защиты',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_GOLD',
    name: 'Glycine Gold Chelate',
    categories: ['amino', 'neuro'],
    mechanisms: ['NEURO_MODULATION', 'MOOD_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_PLATINUM',
    name: 'Glycine Platinum Chelate',
    categories: ['amino', 'neuro'],
    mechanisms: ['NEURO_ENHANCEMENT', 'CELL_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_GERMANIUM',
    name: 'Glycine Germanium Chelate',
    categories: ['amino', 'oxygen'],
    mechanisms: ['OXYGEN_UTILIZATION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM', 'HEART'],
    deficiency: 'LOW_OXYGEN',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'AA_L_GLYCINE_VANADIUM',
    name: 'Glycine Vanadium Chelate',
    categories: ['amino', 'insulin'],
    mechanisms: ['INSULIN_MIMETIC', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'amino'
  },
  {
    id: 'FA_OMEGA3_EPA',
    name: 'EPA (Eicosapentaenoic Acid)',
    categories: ['fatty_acid', 'antiinflammatory', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'TRIGLYCERIDE_REDUCTION'],
    organs: ['HEART', 'VESSELS', 'BRAIN'],
    deficiency: 'HIGH_TG',
    description: 'Основная противовоспалительная омега‑3',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_DHA',
    name: 'DHA (Docosahexaenoic Acid)',
    categories: ['fatty_acid', 'brain', 'vision'],
    mechanisms: ['NEUROPROTECTION', 'MEMBRANE_FLUIDITY'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для работы мозга, зрения',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_DPA',
    name: 'DPA (Docosapentaenoic Acid)',
    categories: ['fatty_acid', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ALA',
    name: 'ALA (Alpha-Linolenic Acid)',
    categories: ['fatty_acid', 'plant', 'antiinflammatory'],
    mechanisms: ['OMEGA3_CONVERSION', 'ANTIOXIDANT'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для противовоспалительной защиты',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_SDA',
    name: 'SDA (Stearidonic Acid)',
    categories: ['fatty_acid', 'plant'],
    mechanisms: ['OMEGA3_CONVERSION', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Усиленная растительная омега‑3',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ETA',
    name: 'ETA (Eicosatetraenoic Acid)',
    categories: ['fatty_acid', 'antiinflammatory'],
    mechanisms: ['COX_INHIBITION', 'LOX_INHIBITION'],
    organs: ['VESSELS', 'JOINTS'],
    deficiency: 'INFLAMMATION',
    description: 'Редкая противовоспалительная омега‑3',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_TG',
    name: 'Omega-3 Triglyceride Form',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['TRIGLYCERIDE_FORM', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_EE',
    name: 'Omega-3 Ethyl Ester',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['TRIGLYCERIDE_REDUCTION', 'VASCULAR_HEALTH'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_TG',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_PHOSPHO',
    name: 'Omega-3 Phospholipid',
    categories: ['fatty_acid', 'brain', 'absorption'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ALGAE_DHA',
    name: 'Algae DHA',
    categories: ['fatty_acid', 'vegan', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'MEMBRANE_FLUIDITY'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ALGAE_EPA',
    name: 'Algae EPA',
    categories: ['fatty_acid', 'vegan', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для противовоспалительной защиты',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_GLA',
    name: 'GLA (Gamma-Linolenic Acid)',
    categories: ['fatty_acid', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'HORMONE_BALANCE'],
    organs: ['SKIN', 'HORMONES'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для противовоспалительной защиты',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_LA',
    name: 'LA (Linoleic Acid)',
    categories: ['fatty_acid', 'skin', 'cell'],
    mechanisms: ['CELL_MEMBRANE_SUPPORT', 'SKIN_HEALTH'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'LOW_LA',
    description: 'Жирная кислота, необходимая для здоровья кожи, клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_ARACHIDONIC',
    name: 'Arachidonic Acid (AA)',
    categories: ['fatty_acid', 'performance'],
    mechanisms: ['ANABOLIC_SIGNALING', 'CELL_GROWTH'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'ATHLETES',
    description: 'Жирная кислота, необходимая для производительности',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA7_PALMITOLEIC',
    name: 'Omega-7 Palmitoleic Acid',
    categories: ['fatty_acid', 'skin', 'metabolism'],
    mechanisms: ['INSULIN_SENSITIVITY', 'SKIN_REPAIR'],
    organs: ['SKIN', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Жирная кислота, необходимая для здоровья кожи, метаболизма',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA9_OLEIC',
    name: 'Oleic Acid (Omega-9)',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_CLA',
    name: 'CLA (Conjugated Linoleic Acid)',
    categories: ['fatty_acid', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'METABOLISM_UP'],
    organs: ['MUSCLES', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Конъюгированная линолевая кислота',
    type: 'fatty_acid'
  },
  {
    id: 'FA_MCT_C8',
    name: 'MCT C8 (Caprylic Acid)',
    categories: ['fatty_acid', 'energy'],
    mechanisms: ['KETONE_PRODUCTION', 'ATP_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для энергетического обмена',
    type: 'fatty_acid'
  },
  {
    id: 'FA_MCT_C10',
    name: 'MCT C10 (Capric Acid)',
    categories: ['fatty_acid', 'energy'],
    mechanisms: ['KETONE_PRODUCTION', 'ATP_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для энергетического обмена',
    type: 'fatty_acid'
  },
  {
    id: 'FA_MCT_COMPLEX',
    name: 'MCT Oil Complex',
    categories: ['fatty_acid', 'energy'],
    mechanisms: ['KETONE_PRODUCTION', 'FAT_OXIDATION'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для энергетического обмена',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PHOSPHO_PC',
    name: 'Phosphatidylcholine (PC)',
    categories: ['fatty_acid', 'liver', 'cell'],
    mechanisms: ['PHOSPHOLIPID_SUPPORT', 'LIVER_REPAIR'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'FATTY_LIVER',
    description: 'Жирная кислота, необходимая для функции печени, клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PHOSPHO_PS',
    name: 'Phosphatidylserine (PS)',
    categories: ['fatty_acid', 'nootropic'],
    mechanisms: ['NEUROPROTECTION', 'CORTISOL_REDUCTION'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Жирная кислота, необходимая для когнитивных функций',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PHOSPHO_PE',
    name: 'Phosphatidylethanolamine (PE)',
    categories: ['fatty_acid', 'cell'],
    mechanisms: ['CELL_MEMBRANE_SUPPORT', 'MITO_REPAIR'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'LOW_PE',
    description: 'Жирная кислота, необходимая для клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PHOSPHO_PI',
    name: 'Phosphatidylinositol (PI)',
    categories: ['fatty_acid', 'cell'],
    mechanisms: ['SIGNALING_PATHWAYS', 'MEMBRANE_SUPPORT'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'LOW_PI',
    description: 'Жирная кислота, необходимая для клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_SPHINGOLIPIDS',
    name: 'Sphingolipids',
    categories: ['fatty_acid', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'MEMBRANE_STABILITY'],
    organs: ['BRAIN', 'SKIN'],
    deficiency: 'AGING',
    description: 'Жирная кислота, необходимая для клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_CERAMIDES',
    name: 'Ceramides',
    categories: ['fatty_acid', 'skin'],
    mechanisms: ['SKIN_BARRIER', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Жирная кислота, необходимая для здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_DHA_LIPOSOMAL',
    name: 'Liposomal DHA',
    categories: ['fatty_acid', 'brain'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_EPA_LIPOSOMAL',
    name: 'Liposomal EPA',
    categories: ['fatty_acid', 'vascular'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_KRILL',
    name: 'Krill Phospholipid Omega-3',
    categories: ['fatty_acid', 'brain', 'vascular'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_SQUID',
    name: 'Squid Omega-3',
    categories: ['fatty_acid', 'brain', 'cardio'],
    mechanisms: ['NEUROPROTECTION', 'VASCULAR_HEALTH'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для работы мозга, ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_SALMON',
    name: 'Salmon Omega-3',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_TUNA',
    name: 'Tuna Omega-3',
    categories: ['fatty_acid', 'brain', 'cardio'],
    mechanisms: ['NEUROPROTECTION', 'VASCULAR_HEALTH'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для работы мозга, ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_MOLLUSK',
    name: 'Mollusk Omega-3',
    categories: ['fatty_acid', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_PLANT_COMPLEX',
    name: 'Plant Omega-3 Complex',
    categories: ['fatty_acid', 'vegan'],
    mechanisms: ['OMEGA3_CONVERSION', 'ANTI_INFLAMMATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_EPO',
    name: 'Evening Primrose Oil (GLA)',
    categories: ['fatty_acid', 'hormone', 'skin'],
    mechanisms: ['ANTI_INFLAMMATION', 'HORMONE_BALANCE'],
    organs: ['SKIN', 'HORMONES'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для гормонального баланса, здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_BORAGE',
    name: 'Borage Oil (GLA)',
    categories: ['fatty_acid', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'SKIN_HEALTH'],
    organs: ['SKIN', 'HORMONES'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для противовоспалительной защиты',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA6_BLACKCURRANT',
    name: 'Black Currant Oil (GLA)',
    categories: ['fatty_acid', 'immune', 'skin'],
    mechanisms: ['ANTI_INFLAMMATION', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для иммунной системы, здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA9_AVOCADO',
    name: 'Avocado Oil (Omega-9)',
    categories: ['fatty_acid', 'skin', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['SKIN', 'HEART'],
    deficiency: 'DRY_SKIN',
    description: 'Жирная кислота, необходимая для здоровья кожи, ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA9_OLIVE',
    name: 'Olive Oil (Oleic Acid)',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_CLA_TONALIN',
    name: 'Tonalin CLA',
    categories: ['fatty_acid', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'METABOLISM_UP'],
    organs: ['MUSCLES', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Жирная кислота, необходимая для жиросжигания',
    type: 'fatty_acid'
  },
  {
    id: 'FA_MUFA_COMPLEX',
    name: 'Monounsaturated Fat Complex',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PUFA_COMPLEX',
    name: 'PUFA Complex',
    categories: ['fatty_acid', 'cell', 'vascular'],
    mechanisms: ['MEMBRANE_SUPPORT', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'VESSELS'],
    deficiency: 'LOW_PUFA',
    description: 'Жирная кислота, необходимая для клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_KETONE_ESTERS',
    name: 'Ketone Esters',
    categories: ['fatty_acid', 'energy'],
    mechanisms: ['KETONE_PRODUCTION', 'ATP_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для энергетического обмена',
    type: 'fatty_acid'
  },
  {
    id: 'FA_SHORT_CHAIN_BUTYRATE',
    name: 'Butyrate (SCFA)',
    categories: ['fatty_acid', 'GI', 'immune'],
    mechanisms: ['GUT_HEALTH', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Жирная кислота, необходимая для иммунной системы',
    type: 'fatty_acid'
  },
  {
    id: 'FA_SHORT_CHAIN_PROPIONATE',
    name: 'Propionate (SCFA)',
    categories: ['fatty_acid', 'GI', 'metabolism'],
    mechanisms: ['GUT_HEALTH', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'INSULIN_RESISTANCE',
    description: 'Жирная кислота, необходимая для метаболизма',
    type: 'fatty_acid'
  },
  {
    id: 'FA_SHORT_CHAIN_ACETATE',
    name: 'Acetate (SCFA)',
    categories: ['fatty_acid', 'GI', 'cell'],
    mechanisms: ['GUT_HEALTH', 'CELL_SIGNALING'],
    organs: ['GI', 'CELLS'],
    deficiency: 'LOW_SCFA',
    description: 'Жирная кислота, необходимая для клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PLASMALEGENS',
    name: 'Plasmalogens',
    categories: ['fatty_acid', 'brain', 'antiaging'],
    mechanisms: ['MEMBRANE_REPAIR', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'AGING',
    description: 'Жирная кислота, необходимая для работы мозга, антивозрастных процессов',
    type: 'fatty_acid'
  },
  {
    id: 'FA_PLASMALEGENS_OCEAN',
    name: 'Ocean Plasmalogens',
    categories: ['fatty_acid', 'brain', 'vascular'],
    mechanisms: ['MEMBRANE_REPAIR', 'VASCULAR_HEALTH'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_CARDIOLIPIN',
    name: 'Cardiolipin',
    categories: ['fatty_acid', 'mitochondria'],
    mechanisms: ['MITO_MEMBRANE_SUPPORT', 'ATP_PRODUCTION'],
    organs: ['HEART', 'MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для работы митохондрий',
    type: 'fatty_acid'
  },
  {
    id: 'FA_CARDIOLIPIN_REPAIR',
    name: 'Cardiolipin Repair Complex',
    categories: ['fatty_acid', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'MEMBRANE_REGEN'],
    organs: ['MITOCHONDRIA', 'HEART'],
    deficiency: 'AGING',
    description: 'Комплекс восстановления кардиолипина',
    type: 'fatty_acid'
  },
  {
    id: 'FA_SPHINGOMYELIN',
    name: 'Sphingomyelin',
    categories: ['fatty_acid', 'brain', 'cell'],
    mechanisms: ['MYELIN_SUPPORT', 'CELL_SIGNALING'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'NEURO_DEGEN',
    description: 'Жирная кислота, необходимая для работы мозга, клеточного здоровья',
    type: 'fatty_acid'
  },
  {
    id: 'FA_DHA_PHOSPHO',
    name: 'Phospholipid DHA',
    categories: ['fatty_acid', 'brain', 'absorption'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_EPA_PHOSPHO',
    name: 'Phospholipid EPA',
    categories: ['fatty_acid', 'vascular', 'absorption'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_MONOGLYCERIDE',
    name: 'Monoglyceride Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['MONOGLYCERIDE_FORM', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_DIGLYCERIDE',
    name: 'Diglyceride Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['DIGLYCERIDE_FORM', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_TG',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_LYSO_PC',
    name: 'Lyso-PC Omega-3',
    categories: ['fatty_acid', 'brain'],
    mechanisms: ['LYSO_PC_TRANSPORT', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Лизофосфатидилхолиновая форма DHA',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ASTAX',
    name: 'Astaxanthin Omega-3 Complex',
    categories: ['fatty_acid', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'MEMBRANE_PROTECTION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Жирная кислота, необходимая для защиты клеток от окислительного стресса',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_CERAMIDE',
    name: 'Ceramide Omega-3',
    categories: ['fatty_acid', 'skin'],
    mechanisms: ['SKIN_BARRIER', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Жирная кислота, необходимая для здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_STEARIDONIC',
    name: 'Stearidonic Omega-3',
    categories: ['fatty_acid', 'plant'],
    mechanisms: ['OMEGA3_CONVERSION', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_HARPAG',
    name: 'Omega-3 Harpagoside',
    categories: ['fatty_acid', 'joint'],
    mechanisms: ['ANTI_INFLAMMATION', 'CARTILAGE_SUPPORT'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Жирная кислота, необходимая для суставов',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_NEURO',
    name: 'Neuro Omega-3',
    categories: ['fatty_acid', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'MEMBRANE_FLUIDITY'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_HEART',
    name: 'Cardio Omega-3',
    categories: ['fatty_acid', 'cardio'],
    mechanisms: ['ANTI_INFLAMMATION', 'TRIGLYCERIDE_REDUCTION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_TG',
    description: 'Жирная кислота, необходимая для ССС',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_LIVER',
    name: 'Liver Omega-3',
    categories: ['fatty_acid', 'liver'],
    mechanisms: ['FAT_METABOLISM', 'ANTI_INFLAMMATION'],
    organs: ['LIVER'],
    deficiency: 'FATTY_LIVER',
    description: 'Жирная кислота, необходимая для функции печени',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_IMMUNE',
    name: 'Immune Omega-3',
    categories: ['fatty_acid', 'immune'],
    mechanisms: ['ANTI_INFLAMMATION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для иммунной системы',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_SKIN',
    name: 'Skin Omega-3',
    categories: ['fatty_acid', 'skin'],
    mechanisms: ['SKIN_REPAIR', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Жирная кислота, необходимая для здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_EYE',
    name: 'Eye Omega-3',
    categories: ['fatty_acid', 'vision'],
    mechanisms: ['RETINA_SUPPORT', 'NEUROPROTECTION'],
    organs: ['EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для зрения',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_PREG',
    name: 'Pregnancy Omega-3',
    categories: ['fatty_acid', 'prenatal'],
    mechanisms: ['NEURODEVELOPMENT', 'MEMBRANE_SUPPORT'],
    organs: ['BRAIN', 'FETUS'],
    deficiency: 'PREGNANCY',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_CHILD',
    name: 'Child Omega-3',
    categories: ['fatty_acid', 'child'],
    mechanisms: ['NEURODEVELOPMENT', 'MEMBRANE_SUPPORT'],
    organs: ['BRAIN', 'NERVOUS_SYSTEM'],
    deficiency: 'CHILD_DEV',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_HIGH_EPA',
    name: 'High EPA Omega-3',
    categories: ['fatty_acid', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'TRIGLYCERIDE_REDUCTION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_TG',
    description: 'Жирная кислота, необходимая для противовоспалительной защиты',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_HIGH_DHA',
    name: 'High DHA Omega-3',
    categories: ['fatty_acid', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'MEMBRANE_FLUIDITY'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'LOW_DHA',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_BALANCED',
    name: 'Balanced EPA/DHA',
    categories: ['fatty_acid', 'cardio', 'brain'],
    mechanisms: ['ANTI_INFLAMMATION', 'NEUROPROTECTION'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для ССС, работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ANTARCTIC',
    name: 'Antarctic Omega-3',
    categories: ['fatty_acid', 'premium'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_GREENLAND',
    name: 'Greenland Omega-3',
    categories: ['fatty_acid', 'premium'],
    mechanisms: ['ANTI_INFLAMMATION', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_DEEPSEA',
    name: 'Deep Sea Omega-3',
    categories: ['fatty_acid', 'premium'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_MICROALGAE',
    name: 'Microalgae Omega-3',
    categories: ['fatty_acid', 'vegan'],
    mechanisms: ['NEUROPROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_POLAR',
    name: 'Polar Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['POLAR_LIPID_FORM', 'MEMBRANE_SUPPORT'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_LIPOCOMPLEX',
    name: 'Liposomal Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_NANO',
    name: 'Nano Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['NANO_DELIVERY', 'MEMBRANE_SUPPORT'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_EMULSIFIED',
    name: 'Emulsified Omega-3',
    categories: ['fatty_acid', 'absorption'],
    mechanisms: ['EMULSION_TECH', 'VASCULAR_HEALTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_KETO',
    name: 'Keto Omega-3',
    categories: ['fatty_acid', 'energy'],
    mechanisms: ['KETONE_PRODUCTION', 'FAT_OXIDATION'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'KETO',
    description: 'Жирная кислота, необходимая для энергетического обмена',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_MITO',
    name: 'Mito Omega-3',
    categories: ['fatty_acid', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'MEMBRANE_SUPPORT'],
    organs: ['MITOCHONDRIA', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Жирная кислота, необходимая для работы митохондрий',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ANTIAGING',
    name: 'Anti-Aging Omega-3',
    categories: ['fatty_acid', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'MEMBRANE_REPAIR'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Жирная кислота, необходимая для антивозрастных процессов',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_JOINT',
    name: 'Joint Omega-3',
    categories: ['fatty_acid', 'joint'],
    mechanisms: ['ANTI_INFLAMMATION', 'CARTILAGE_SUPPORT'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Жирная кислота, необходимая для суставов',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_SKIN_CERAMIDE',
    name: 'Skin Ceramide Omega-3',
    categories: ['fatty_acid', 'skin'],
    mechanisms: ['SKIN_BARRIER', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Жирная кислота, необходимая для здоровья кожи',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_HAIR',
    name: 'Hair Omega-3',
    categories: ['fatty_acid', 'hair'],
    mechanisms: ['HAIR_FOLLICLE_SUPPORT', 'ANTI_INFLAMMATION'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Жирная кислота, необходимая для здоровья волос',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_BRAIN_PC',
    name: 'Brain PC Omega-3',
    categories: ['fatty_acid', 'brain'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Жирная кислота, необходимая для работы мозга',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_LIVER_PC',
    name: 'Liver PC Omega-3',
    categories: ['fatty_acid', 'liver'],
    mechanisms: ['PHOSPHOLIPID_SUPPORT', 'FAT_METABOLISM'],
    organs: ['LIVER'],
    deficiency: 'FATTY_LIVER',
    description: 'Жирная кислота, необходимая для функции печени',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_IMMUNE_PC',
    name: 'Immune PC Omega-3',
    categories: ['fatty_acid', 'immune'],
    mechanisms: ['PHOSPHOLIPID_DELIVERY', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Жирная кислота, необходимая для иммунной системы',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_VESSEL_PC',
    name: 'Vessel PC Omega-3',
    categories: ['fatty_acid', 'vascular'],
    mechanisms: ['PHOSPHOLIPID_SUPPORT', 'VASCULAR_HEALTH'],
    organs: ['VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_COMPLEX_FULL',
    name: 'Full Spectrum Omega-3',
    categories: ['fatty_acid', 'multi'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ADVANCED',
    name: 'Advanced Omega-3',
    categories: ['fatty_acid', 'premium'],
    mechanisms: ['ANTI_INFLAMMATION', 'NEUROPROTECTION'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'FA_OMEGA3_ULTRA',
    name: 'Ultra Omega-3',
    categories: ['fatty_acid', 'premium'],
    mechanisms: ['ANTI_INFLAMMATION', 'MEMBRANE_SUPPORT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'LOW_OMEGA3',
    description: 'Жирная кислота, необходимая для здоровья сердца, мозга и клеточных мембран',
    type: 'fatty_acid'
  },
  {
    id: 'AO_GSH',
    name: 'Glutathione (Reduced)',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Главный антиоксидант организма',
    type: 'antioxidant'
  },
  {
    id: 'AO_GSH_LIP',
    name: 'Liposomal Glutathione',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'GLUTATHIONE_UP'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Липосомальная форма глутатиона',
    type: 'antioxidant'
  },
  {
    id: 'AO_GSH_SAC',
    name: 'S-Acetyl Glutathione',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_NAC',
    name: 'N-Acetyl Cysteine',
    categories: ['antioxidant', 'lung'],
    mechanisms: ['GLUTATHIONE_SYNTHESIS', 'MUCUS_BREAKDOWN'],
    organs: ['LUNGS', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, легких',
    type: 'antioxidant'
  },
  {
    id: 'AO_NACET',
    name: 'NACET (Ethyl NAC)',
    categories: ['antioxidant', 'premium'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_RALA',
    name: 'R-Lipoic Acid',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['GLUTATHIONE_RECYCLING', 'MITO_REPAIR'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_ALA',
    name: 'Alpha-Lipoic Acid',
    categories: ['antioxidant', 'glucose'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_COQ10',
    name: 'CoQ10 (Ubiquinone)',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_UBIQUINOL',
    name: 'Ubiquinol',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_PQQ',
    name: 'PQQ',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_BIOGENESIS', 'MITO_REPAIR'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_SELENIUM',
    name: 'Selenium',
    categories: ['antioxidant', 'enzyme'],
    mechanisms: ['GPX_ACTIVITY', 'THYROID_SUPPORT'],
    organs: ['LIVER', 'THYROID'],
    deficiency: 'LOW_SELEN',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_CATALASE',
    name: 'Catalase Enzyme',
    categories: ['antioxidant', 'enzyme'],
    mechanisms: ['CATALASE_ACTIVITY', 'H2O2_BREAKDOWN'],
    organs: ['CELLS', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_SOD',
    name: 'Superoxide Dismutase (SOD)',
    categories: ['antioxidant', 'enzyme'],
    mechanisms: ['SOD_ACTIVITY', 'FREE_RADICAL_NEUTRALIZATION'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_ASTAX',
    name: 'Astaxanthin',
    categories: ['antioxidant', 'skin', 'mitochondria'],
    mechanisms: ['MEMBRANE_PROTECTION', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['SKIN', 'EYES', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, здоровья кожи, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_LUTEIN',
    name: 'Lutein',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['RETINA_PROTECTION', 'BLUE_LIGHT_FILTER'],
    organs: ['EYES'],
    deficiency: 'LOW_LUTEIN',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_ZEAXANTHIN',
    name: 'Zeaxanthin',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['RETINA_PROTECTION', 'MACULA_SUPPORT'],
    organs: ['EYES'],
    deficiency: 'LOW_ZEAX',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_LYCOPENE',
    name: 'Lycopene',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'PROSTATE'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_BETA_CAROTENE',
    name: 'Beta-Carotene',
    categories: ['antioxidant', 'vitamin_A'],
    mechanisms: ['CAROTENOID_PATHWAY', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['EYES', 'SKIN'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_RESVERATROL',
    name: 'Resveratrol',
    categories: ['antioxidant', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, антивозрастных процессов',
    type: 'antioxidant'
  },
  {
    id: 'AO_PTEROSTILBENE',
    name: 'Pterostilbene',
    categories: ['antioxidant', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, антивозрастных процессов',
    type: 'antioxidant'
  },
  {
    id: 'AO_QUERCETIN',
    name: 'Quercetin',
    categories: ['antioxidant', 'immune'],
    mechanisms: ['MAST_CELL_STABILIZATION', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM', 'LUNGS'],
    deficiency: 'ALLERGY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, иммунной системы',
    type: 'antioxidant'
  },
  {
    id: 'AO_RUTIN',
    name: 'Rutin',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'FRAGILITY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_CURCUMIN',
    name: 'Curcumin',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'COX2_INHIBITION'],
    organs: ['LIVER', 'BRAIN', 'JOINTS'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_CURCUMIN_BC',
    name: 'Curcumin BCM-95',
    categories: ['antioxidant', 'premium'],
    mechanisms: ['NF_KB_BLOCK', 'BIOAVAILABILITY_UP'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_EGCG',
    name: 'EGCG (Green Tea Extract)',
    categories: ['antioxidant', 'metabolism'],
    mechanisms: ['AMPK_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, метаболизма',
    type: 'antioxidant'
  },
  {
    id: 'AO_CATECHINS',
    name: 'Green Tea Catechins',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_ANTHOCYANINS',
    name: 'Anthocyanins',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['VESSELS', 'EYES'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_BILBERRY',
    name: 'Bilberry Extract',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['RETINA_SUPPORT', 'CAPILLARY_STRENGTH'],
    organs: ['EYES', 'VESSELS'],
    deficiency: 'LOW_VISION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_GRAPESEED',
    name: 'Grape Seed Extract (OPC)',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['OPC_ACTIVITY', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_PYCNOGENOL',
    name: 'Pycnogenol',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['NO_UP', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_COCOA_FLAVANOLS',
    name: 'Cocoa Flavanols',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['NO_UP', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'BRAIN'],
    deficiency: 'LOW_NO',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_SULFORAPHANE',
    name: 'Sulforaphane',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['Nrf2_UP', 'PHASE2_DETOX'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'TOXINS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_BROCCOLI_SPROUT',
    name: 'Broccoli Sprout Extract',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['Nrf2_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'TOXINS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_MELATONIN',
    name: 'Melatonin',
    categories: ['antioxidant', 'neuro'],
    mechanisms: ['SLEEP_REGULATION', 'ANTIOXIDANT'],
    organs: ['BRAIN', 'MITOCHONDRIA'],
    deficiency: 'INSOMNIA',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, нервной системы',
    type: 'antioxidant'
  },
  {
    id: 'AO_MELATONIN_LIP',
    name: 'Liposomal Melatonin',
    categories: ['antioxidant', 'neuro'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'ANTIOXIDANT'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Липосомальная форма мелатонина',
    type: 'antioxidant'
  },
  {
    id: 'AO_CAROTENOID_COMPLEX',
    name: 'Carotenoid Complex',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['CAROTENOID_PATHWAY', 'RETINA_SUPPORT'],
    organs: ['EYES'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_TOCOTRIENOLS',
    name: 'Tocotrienols',
    categories: ['antioxidant', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'MEMBRANE_PROTECTION'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, антивозрастных процессов',
    type: 'antioxidant'
  },
  {
    id: 'AO_TOCOPHEROLS',
    name: 'Mixed Tocopherols',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['MEMBRANE_PROTECTION', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'LOW_VITE',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_ALPHA_LIPOAMIDE',
    name: 'Alpha-Lipoamide',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_C60',
    name: 'Carbon 60 (C60)',
    categories: ['antioxidant', 'antiaging'],
    mechanisms: ['SUPEROXIDE_SCAVENGING', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, антивозрастных процессов',
    type: 'antioxidant'
  },
  {
    id: 'AO_MITOQ',
    name: 'MitoQ',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_TARGETED', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['MITOCHONDRIA', 'HEART'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_SKQ1',
    name: 'SkQ1',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_TARGETED', 'MEMBRANE_PROTECTION'],
    organs: ['EYES', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_GLUTATHIONE_PRECURSOR',
    name: 'Glutathione Precursor Blend',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['GLUTATHIONE_SYNTHESIS', 'CELL_PROTECTION'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_NRF2_COMPLEX',
    name: 'Nrf2 Activator Complex',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['Nrf2_UP', 'PHASE2_DETOX'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'TOXINS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_HYDROXYTYROSOL',
    name: 'Hydroxytyrosol',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_OLEUROPEIN',
    name: 'Oleuropein',
    categories: ['antioxidant', 'immune'],
    mechanisms: ['ANTI_INFLAMMATION', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'INFECTION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, иммунной системы',
    type: 'antioxidant'
  },
  {
    id: 'AO_FERULIC',
    name: 'Ferulic Acid',
    categories: ['antioxidant', 'skin'],
    mechanisms: ['UV_PROTECTION', 'COLLAGEN_SUPPORT'],
    organs: ['SKIN'],
    deficiency: 'UV_DAMAGE',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, здоровья кожи',
    type: 'antioxidant'
  },
  {
    id: 'AO_CAFFEIC',
    name: 'Caffeic Acid',
    categories: ['antioxidant', 'cell'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, клеточного здоровья',
    type: 'antioxidant'
  },
  {
    id: 'AO_CHLOROGENIC',
    name: 'Chlorogenic Acid',
    categories: ['antioxidant', 'metabolism'],
    mechanisms: ['GLUCOSE_REGULATION', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, метаболизма',
    type: 'antioxidant'
  },
  {
    id: 'AO_HESPERIDIN',
    name: 'Hesperidin',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'FRAGILITY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_NARINGIN',
    name: 'Naringin',
    categories: ['antioxidant', 'metabolism'],
    mechanisms: ['AMPK_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'OBESITY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, метаболизма',
    type: 'antioxidant'
  },
  {
    id: 'AO_APIGENIN',
    name: 'Apigenin',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_LUTEOLIN',
    name: 'Luteolin',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['MAST_CELL_STABILIZATION', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'ALLERGY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_MYRICETIN',
    name: 'Myricetin',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_KAEMPFEROL',
    name: 'Kaempferol',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['CELLS', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_ELLAGIC',
    name: 'Ellagic Acid',
    categories: ['antioxidant', 'detox'],
    mechanisms: ['PHASE2_DETOX', 'CELL_PROTECTION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'TOXINS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, детоксикации',
    type: 'antioxidant'
  },
  {
    id: 'AO_ELLAGITANNINS',
    name: 'Ellagitannins',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_UBIQUINONE_QH',
    name: 'QH Ubiquinone',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_MITO_PQQ',
    name: 'PQQ + CoQ10 Complex',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_BIOGENESIS', 'ELECTRON_TRANSPORT_CHAIN'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_MITO_TEMPO',
    name: 'Mito-TEMPO',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_TARGETED', 'SUPEROXIDE_SCAVENGING'],
    organs: ['MITOCHONDRIA', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_CAROTENE_COMPLEX',
    name: 'Carotene Complex',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['CAROTENOID_PATHWAY', 'RETINA_SUPPORT'],
    organs: ['EYES'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_BETAINE_ANTIOX',
    name: 'Betaine Antioxidant Blend',
    categories: ['antioxidant', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Антиоксидантная метильная смесь',
    type: 'antioxidant'
  },
  {
    id: 'AO_TANNINS',
    name: 'Tannins',
    categories: ['antioxidant', 'GI'],
    mechanisms: ['GI_PROTECTION', 'ANTIMICROBIAL'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_URSOLIC',
    name: 'Ursolic Acid',
    categories: ['antioxidant', 'muscle'],
    mechanisms: ['ANTI_INFLAMMATION', 'ANABOLIC_SIGNALING'],
    organs: ['MUSCLES', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, мышц',
    type: 'antioxidant'
  },
  {
    id: 'AO_OLEANOLIC',
    name: 'Oleanolic Acid',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIVER_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_HYDROXYCINNAMIC',
    name: 'Hydroxycinnamic Acids',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_GINKGO_FLAVONES',
    name: 'Ginkgo Flavones',
    categories: ['antioxidant', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'CIRCULATION_UP'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'COGNITION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы мозга',
    type: 'antioxidant'
  },
  {
    id: 'AO_GINSENOSIDES',
    name: 'Ginsenosides',
    categories: ['antioxidant', 'adaptogen'],
    mechanisms: ['ANTI_INFLAMMATION', 'ENERGY_UP'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, адаптации к стрессу',
    type: 'antioxidant'
  },
  {
    id: 'AO_SCHISANDRIN',
    name: 'Schisandrin',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['MITO_REPAIR', 'LIVER_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_SCHISANDRIN_B',
    name: 'Schisandrin B',
    categories: ['antioxidant', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ANTIOXIDANT'],
    organs: ['MITOCHONDRIA', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы митохондрий',
    type: 'antioxidant'
  },
  {
    id: 'AO_BERBERINE_ANTIOX',
    name: 'Berberine Antioxidant Form',
    categories: ['antioxidant', 'metabolism'],
    mechanisms: ['AMPK_UP', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Антиоксидантная форма берберина',
    type: 'antioxidant'
  },
  {
    id: 'AO_HONOKIOL',
    name: 'Honokiol',
    categories: ['antioxidant', 'neuro'],
    mechanisms: ['GABA_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'ANXIETY',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, нервной системы',
    type: 'antioxidant'
  },
  {
    id: 'AO_MAGNOLIN',
    name: 'Magnolin',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LUNGS'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_PICRO',
    name: 'Picrorhiza Extract',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['LIVER_PROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_SILYMARIN',
    name: 'Silymarin',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['LIVER_REGEN', 'ANTI_INFLAMMATION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_SILIBININ',
    name: 'Silibinin',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['LIVER_REGEN', 'CELL_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_ARTICHOKE',
    name: 'Artichoke Extract',
    categories: ['antioxidant', 'liver'],
    mechanisms: ['BILE_FLOW_UP', 'LIVER_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, функции печени',
    type: 'antioxidant'
  },
  {
    id: 'AO_TURMERONES',
    name: 'Turmerones',
    categories: ['antioxidant', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, работы мозга',
    type: 'antioxidant'
  },
  {
    id: 'AO_GARLIC_SULFUR',
    name: 'Garlic Sulfur Compounds',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['NO_UP', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'HIGH_BP',
    description: 'Серосодержащие соединения чеснока',
    type: 'antioxidant'
  },
  {
    id: 'AO_ALPHA_CAROTENE',
    name: 'Alpha-Carotene',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['CAROTENOID_PATHWAY', 'RETINA_SUPPORT'],
    organs: ['EYES'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_GAMMA_CAROTENE',
    name: 'Gamma-Carotene',
    categories: ['antioxidant', 'vision'],
    mechanisms: ['CAROTENOID_PATHWAY', 'RETINA_SUPPORT'],
    organs: ['EYES'],
    deficiency: 'LOW_CAROTENOIDS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, зрения',
    type: 'antioxidant'
  },
  {
    id: 'AO_TOMATO_LYCOPENE',
    name: 'Tomato Lycopene Complex',
    categories: ['antioxidant', 'prostate'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['PROSTATE', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, простаты',
    type: 'antioxidant'
  },
  {
    id: 'AO_PUNICALAGIN',
    name: 'Punicalagin',
    categories: ['antioxidant', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'AO_MANGO_XANTHONES',
    name: 'Mango Xanthones',
    categories: ['antioxidant', 'immune'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, иммунной системы',
    type: 'antioxidant'
  },
  {
    id: 'AO_MANGOSTEEN_XANTHONES',
    name: 'Mangosteen Xanthones',
    categories: ['antioxidant', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса, противовоспалительной защиты',
    type: 'antioxidant'
  },
  {
    id: 'AO_BETAINE_POLYPHENOL',
    name: 'Betaine Polyphenol Complex',
    categories: ['antioxidant', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Полифенольный метильный комплекс',
    type: 'antioxidant'
  },
  {
    id: 'AO_ANTIOX_COMPLEX_FULL',
    name: 'Full Spectrum Antioxidant Complex',
    categories: ['antioxidant', 'multi'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Антиоксидант, защищающий клетки от окислительного стресса и защиты клеток от окислительного стресса',
    type: 'antioxidant'
  },
  {
    id: 'PP_QUERCETIN',
    name: 'Quercetin',
    categories: ['polyphenol', 'immune', 'vascular'],
    mechanisms: ['MAST_CELL_STABILIZATION', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'ALLERGY',
    description: 'Полифенол с антиоксидантными свойствами для иммунной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_RUTIN',
    name: 'Rutin',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'FRAGILITY',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_HESPERIDIN',
    name: 'Hesperidin',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'FRAGILITY',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_NARINGIN',
    name: 'Naringin',
    categories: ['polyphenol', 'metabolism'],
    mechanisms: ['AMPK_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'OBESITY',
    description: 'Полифенол с антиоксидантными свойствами для метаболизма',
    type: 'polyphenol'
  },
  {
    id: 'PP_APIGENIN',
    name: 'Apigenin',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_LUTEOLIN',
    name: 'Luteolin',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['MAST_CELL_STABILIZATION', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'ALLERGY',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_MYRICETIN',
    name: 'Myricetin',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_KAEMPFEROL',
    name: 'Kaempferol',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['CELLS', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_ELLAGIC',
    name: 'Ellagic Acid',
    categories: ['polyphenol', 'detox'],
    mechanisms: ['PHASE2_DETOX', 'CELL_PROTECTION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'TOXINS',
    description: 'Полифенол с антиоксидантными свойствами для детоксикации',
    type: 'polyphenol'
  },
  {
    id: 'PP_GALLIC',
    name: 'Gallic Acid',
    categories: ['polyphenol', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для защиты клеток от окислительного стресса',
    type: 'polyphenol'
  },
  {
    id: 'PP_CAFFEIC',
    name: 'Caffeic Acid',
    categories: ['polyphenol', 'cell'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для клеточного здоровья',
    type: 'polyphenol'
  },
  {
    id: 'PP_CHLOROGENIC',
    name: 'Chlorogenic Acid',
    categories: ['polyphenol', 'metabolism'],
    mechanisms: ['GLUCOSE_REGULATION', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'VESSELS'],
    deficiency: 'DIABETES',
    description: 'Полифенол с антиоксидантными свойствами для метаболизма',
    type: 'polyphenol'
  },
  {
    id: 'PP_TANNINS',
    name: 'Tannins',
    categories: ['polyphenol', 'GI'],
    mechanisms: ['GI_PROTECTION', 'ANTIMICROBIAL'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_ELLAGITANNINS',
    name: 'Ellagitannins',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_OPC',
    name: 'Grape Seed OPC',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['OPC_ACTIVITY', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_PYCNOGENOL',
    name: 'Pycnogenol',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['NO_UP', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_RESVERATROL',
    name: 'Resveratrol',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_PTEROSTILBENE',
    name: 'Pterostilbene',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_POLYGONUM',
    name: 'Polygonum Cuspidatum Extract',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_EGCG',
    name: 'EGCG',
    categories: ['polyphenol', 'metabolism'],
    mechanisms: ['AMPK_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'OBESITY',
    description: 'Полифенол с антиоксидантными свойствами для метаболизма',
    type: 'polyphenol'
  },
  {
    id: 'PP_CATECHINS',
    name: 'Catechins',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_ANTHOCYANINS',
    name: 'Anthocyanins',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['VESSELS', 'EYES'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_BILBERRY',
    name: 'Bilberry Extract',
    categories: ['polyphenol', 'vision'],
    mechanisms: ['RETINA_SUPPORT', 'CAPILLARY_STRENGTH'],
    organs: ['EYES', 'VESSELS'],
    deficiency: 'LOW_VISION',
    description: 'Полифенол с антиоксидантными свойствами для зрения',
    type: 'polyphenol'
  },
  {
    id: 'PP_CRANBERRY',
    name: 'Cranberry Polyphenols',
    categories: ['polyphenol', 'urinary'],
    mechanisms: ['ANTI_ADHESION', 'ANTIMICROBIAL'],
    organs: ['URINARY'],
    deficiency: 'UTI',
    description: 'Полифенол с антиоксидантными свойствами для мочевыводящей системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_POMEGRANATE',
    name: 'Pomegranate Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_PUNICALAGIN',
    name: 'Punicalagin',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_MANGO_XANTHONES',
    name: 'Mango Xanthones',
    categories: ['polyphenol', 'immune'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для иммунной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_MANGOSTEEN_XANTHONES',
    name: 'Mangosteen Xanthones',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_HONOKIOL',
    name: 'Honokiol',
    categories: ['polyphenol', 'neuro'],
    mechanisms: ['GABA_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'ANXIETY',
    description: 'Полифенол с антиоксидантными свойствами для нервной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_MAGNOLIN',
    name: 'Magnolin',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LUNGS'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_SCHISANDRIN',
    name: 'Schisandrin',
    categories: ['polyphenol', 'liver'],
    mechanisms: ['MITO_REPAIR', 'LIVER_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для функции печени',
    type: 'polyphenol'
  },
  {
    id: 'PP_SCHISANDRIN_B',
    name: 'Schisandrin B',
    categories: ['polyphenol', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ANTIOXIDANT'],
    organs: ['MITOCHONDRIA', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для работы митохондрий',
    type: 'polyphenol'
  },
  {
    id: 'PP_GINSENOSIDES',
    name: 'Ginsenosides',
    categories: ['polyphenol', 'adaptogen'],
    mechanisms: ['ANTI_INFLAMMATION', 'ENERGY_UP'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Полифенол с антиоксидантными свойствами для адаптации к стрессу',
    type: 'polyphenol'
  },
  {
    id: 'PP_GINKGO_FLAVONES',
    name: 'Ginkgo Flavones',
    categories: ['polyphenol', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'CIRCULATION_UP'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'COGNITION',
    description: 'Полифенол с антиоксидантными свойствами для работы мозга',
    type: 'polyphenol'
  },
  {
    id: 'PP_ARTICHOKE',
    name: 'Artichoke Polyphenols',
    categories: ['polyphenol', 'liver'],
    mechanisms: ['BILE_FLOW_UP', 'LIVER_PROTECTION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для функции печени',
    type: 'polyphenol'
  },
  {
    id: 'PP_TURMERONES',
    name: 'Turmerones',
    categories: ['polyphenol', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Полифенол с антиоксидантными свойствами для работы мозга',
    type: 'polyphenol'
  },
  {
    id: 'PP_GARLIC_SULFUR',
    name: 'Garlic Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['NO_UP', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'HIGH_BP',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_CINNAMON_POLYPHENOLS',
    name: 'Cinnamon Polyphenols',
    categories: ['polyphenol', 'metabolism'],
    mechanisms: ['GLUCOSE_REGULATION', 'INSULIN_SENSITIVITY'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Полифенол с антиоксидантными свойствами для метаболизма',
    type: 'polyphenol'
  },
  {
    id: 'PP_CLOVES_POLYPHENOLS',
    name: 'Clove Polyphenols',
    categories: ['polyphenol', 'antimicrobial'],
    mechanisms: ['ANTIMICROBIAL', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для противомикробной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_ROSEMARY_CARNOSIC',
    name: 'Carnosic Acid',
    categories: ['polyphenol', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'ANTIOXIDANT'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для работы мозга',
    type: 'polyphenol'
  },
  {
    id: 'PP_ROSEMARY_CARNOSOL',
    name: 'Carnosol',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_THYME_POLYPHENOLS',
    name: 'Thyme Polyphenols',
    categories: ['polyphenol', 'antimicrobial'],
    mechanisms: ['ANTIMICROBIAL', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для противомикробной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_OREGANO_POLYPHENOLS',
    name: 'Oregano Polyphenols',
    categories: ['polyphenol', 'antimicrobial'],
    mechanisms: ['ANTIMICROBIAL', 'IMMUNE_SUPPORT'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для противомикробной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_SAGE_POLYPHENOLS',
    name: 'Sage Polyphenols',
    categories: ['polyphenol', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Полифенол с антиоксидантными свойствами для работы мозга',
    type: 'polyphenol'
  },
  {
    id: 'PP_MINT_POLYPHENOLS',
    name: 'Mint Polyphenols',
    categories: ['polyphenol', 'GI'],
    mechanisms: ['GI_SOOTHING', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'GI_IRRITATION',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_FULL_POLYPHENOL_COMPLEX',
    name: 'Full Spectrum Polyphenol Complex',
    categories: ['polyphenol', 'multi'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_FISETIN',
    name: 'Fisetin',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['SENOLYTIC', 'SIRT1_UP'],
    organs: ['BRAIN', 'CELLS'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_QUERCETIN_PH',
    name: 'Quercetin Phytosome',
    categories: ['polyphenol', 'immune', 'vascular'],
    mechanisms: ['MAST_CELL_STABILIZATION', 'BIOAVAILABILITY_UP'],
    organs: ['IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'ALLERGY',
    description: 'Полифенол с антиоксидантными свойствами для иммунной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_RESVERATROL_TRANS',
    name: 'Trans-Resveratrol',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_PTERO_LIPOSOMAL',
    name: 'Liposomal Pterostilbene',
    categories: ['polyphenol', 'antiaging'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'SIRT1_UP'],
    organs: ['BRAIN', 'HEART'],
    deficiency: 'AGING',
    description: 'Полифенол с антиоксидантными свойствами для антивозрастных процессов',
    type: 'polyphenol'
  },
  {
    id: 'PP_BAICALEIN',
    name: 'Baicalein',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'NEUROPROTECTION'],
    organs: ['BRAIN', 'LUNGS'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_BAICALIN',
    name: 'Baicalin',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_WOGONIN',
    name: 'Wogonin',
    categories: ['polyphenol', 'neuro'],
    mechanisms: ['GABA_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'ANXIETY',
    description: 'Полифенол с антиоксидантными свойствами для нервной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_SCUTELLARIN',
    name: 'Scutellarin',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'BRAIN'],
    deficiency: 'LOW_NO',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_HONOKIOL_PREMIUM',
    name: 'Honokiol Premium',
    categories: ['polyphenol', 'neuro'],
    mechanisms: ['GABA_UP', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'ANXIETY',
    description: 'Полифенол с антиоксидантными свойствами для нервной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_MAGNOLONE',
    name: 'Magnolone',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LUNGS'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_TAXIFOLIN',
    name: 'Taxifolin (Dihydroquercetin)',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_DIHYDROQUERCETIN',
    name: 'DHQ (Dihydroquercetin)',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTIOXIDANT', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_GARCINOL',
    name: 'Garcinol',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'CELL_PROTECTION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_GAMBOGIC',
    name: 'Gambogic Acid',
    categories: ['polyphenol', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'ANTI_INFLAMMATION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для клеточного здоровья',
    type: 'polyphenol'
  },
  {
    id: 'PP_TANNIC_ACID',
    name: 'Tannic Acid',
    categories: ['polyphenol', 'GI'],
    mechanisms: ['GI_PROTECTION', 'ANTIMICROBIAL'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_PROANTHOCYANIDINS',
    name: 'Proanthocyanidins',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['OPC_ACTIVITY', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'SKIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_CATECHIN_EPI',
    name: 'Epicatechin',
    categories: ['polyphenol', 'muscle'],
    mechanisms: ['NO_UP', 'MITO_REPAIR'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Полифенол с антиоксидантными свойствами для мышц',
    type: 'polyphenol'
  },
  {
    id: 'PP_EPICATECHIN_GAL',
    name: 'Epicatechin Gallate',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_THEAFLAVINS',
    name: 'Theaflavins',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_THEARUBIGINS',
    name: 'Thearubigins',
    categories: ['polyphenol', 'GI'],
    mechanisms: ['GI_SUPPORT', 'ANTIOXIDANT'],
    organs: ['GI'],
    deficiency: 'GI_IRRITATION',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_ANTHOCYANIN_COMPLEX',
    name: 'Anthocyanin Complex',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['CAPILLARY_STRENGTH', 'OXIDATIVE_STRESS_REDUCTION'],
    organs: ['VESSELS', 'EYES'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_BLUEBERRY_POLYPHENOLS',
    name: 'Blueberry Polyphenols',
    categories: ['polyphenol', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'ANTIOXIDANT'],
    organs: ['BRAIN', 'EYES'],
    deficiency: 'COGNITION',
    description: 'Полифенол с антиоксидантными свойствами для работы мозга',
    type: 'polyphenol'
  },
  {
    id: 'PP_BLACKCURRANT_POLYPHENOLS',
    name: 'Blackcurrant Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'EYES'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_GRAPE_SKIN',
    name: 'Red Grape Skin Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_GRAPE_POMACE',
    name: 'Grape Pomace Extract',
    categories: ['polyphenol', 'detox'],
    mechanisms: ['PHASE2_DETOX', 'CELL_PROTECTION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'TOXINS',
    description: 'Полифенолы виноградных выжимок',
    type: 'polyphenol'
  },
  {
    id: 'PP_CACAO_POLYPHENOLS',
    name: 'Cacao Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['NO_UP', 'ANTI_INFLAMMATION'],
    organs: ['VESSELS', 'BRAIN'],
    deficiency: 'LOW_NO',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_OLIVE_POLYPHENOLS',
    name: 'Olive Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_COFFEE_POLYPHENOLS',
    name: 'Coffee Polyphenols',
    categories: ['polyphenol', 'metabolism'],
    mechanisms: ['AMPK_UP', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Полифенол с антиоксидантными свойствами для метаболизма',
    type: 'polyphenol'
  },
  {
    id: 'PP_TEA_POLYPHENOLS',
    name: 'Tea Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'LIPID_BALANCE'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_HIBISCUS_POLYPHENOLS',
    name: 'Hibiscus Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['BP_REDUCTION', 'ANTI_INFLAMMATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_ELDERBERRY_POLYPHENOLS',
    name: 'Elderberry Polyphenols',
    categories: ['polyphenol', 'immune'],
    mechanisms: ['ANTIVIRAL', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Полифенол с антиоксидантными свойствами для иммунной системы',
    type: 'polyphenol'
  },
  {
    id: 'PP_ARONIA_POLYPHENOLS',
    name: 'Aronia Polyphenols',
    categories: ['polyphenol', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'CAPILLARY_STRENGTH'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_ROSEHIP_POLYPHENOLS',
    name: 'Rosehip Polyphenols',
    categories: ['polyphenol', 'joint'],
    mechanisms: ['ANTI_INFLAMMATION', 'CARTILAGE_SUPPORT'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Полифенол с антиоксидантными свойствами для суставов',
    type: 'polyphenol'
  },
  {
    id: 'PP_SEABUCKTHORN_POLYPHENOLS',
    name: 'Sea Buckthorn Polyphenols',
    categories: ['polyphenol', 'skin'],
    mechanisms: ['SKIN_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Полифенол с антиоксидантными свойствами для здоровья кожи',
    type: 'polyphenol'
  },
  {
    id: 'PP_TURMERIC_POLYPHENOLS',
    name: 'Turmeric Polyphenols',
    categories: ['polyphenol', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'INFLAMMATION',
    description: 'Полифенол с антиоксидантными свойствами для противовоспалительной защиты',
    type: 'polyphenol'
  },
  {
    id: 'PP_GINGER_POLYPHENOLS',
    name: 'Ginger Polyphenols',
    categories: ['polyphenol', 'GI'],
    mechanisms: ['GI_SOOTHING', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'GI_IRRITATION',
    description: 'Полифенол с антиоксидантными свойствами для поддержки ССС и обмена веществ',
    type: 'polyphenol'
  },
  {
    id: 'PP_CLOVER_POLYPHENOLS',
    name: 'Red Clover Polyphenols',
    categories: ['polyphenol', 'hormone'],
    mechanisms: ['ESTROGEN_MODULATION', 'ANTI_INFLAMMATION'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Полифенол с антиоксидантными свойствами для гормонального баланса',
    type: 'polyphenol'
  },
  {
    id: 'PP_SOY_ISOFLAVONES',
    name: 'Soy Isoflavones',
    categories: ['polyphenol', 'hormone'],
    mechanisms: ['ESTROGEN_MODULATION', 'BONE_SUPPORT'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Полифенол с антиоксидантными свойствами для гормонального баланса',
    type: 'polyphenol'
  },
  {
    id: 'PP_GENISTEIN',
    name: 'Genistein',
    categories: ['polyphenol', 'hormone'],
    mechanisms: ['ESTROGEN_MODULATION', 'CELL_PROTECTION'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Полифенол с антиоксидантными свойствами для гормонального баланса',
    type: 'polyphenol'
  },
  {
    id: 'PP_DAIDZEIN',
    name: 'Daidzein',
    categories: ['polyphenol', 'hormone'],
    mechanisms: ['ESTROGEN_MODULATION', 'CELL_PROTECTION'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Полифенол с антиоксидантными свойствами для гормонального баланса',
    type: 'polyphenol'
  },
  {
    id: 'PP_FULL_POLYPHENOL_PREMIUM',
    name: 'Full Spectrum Polyphenol Premium',
    categories: ['polyphenol', 'multi'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_PROTECTION'],
    organs: ['CELLS', 'BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Премиальный спектр полифенолов',
    type: 'polyphenol'
  },
  {
    id: 'AD_GINSENG_PANAX',
    name: 'Panax Ginseng',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'ATP_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_RED',
    name: 'Red Ginseng',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['ADRENAL_STIMULATION', 'NO_UP'],
    organs: ['ADRENALS', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_SIBERIAN',
    name: 'Eleuthero (Siberian Ginseng)',
    categories: ['adaptogen', 'energy'],
    mechanisms: ['ADRENAL_TONIC', 'IMMUNE_UP'],
    organs: ['ADRENALS', 'IMMUNE_SYSTEM'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_AMERICAN',
    name: 'American Ginseng',
    categories: ['adaptogen', 'calming'],
    mechanisms: ['ADRENAL_BALANCE', 'CORTISOL_MOD'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, успокоения',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHODIOLA_ROSEA',
    name: 'Rhodiola Rosea',
    categories: ['adaptogen', 'stress', 'energy'],
    mechanisms: ['CORTISOL_MOD', 'ATP_UP'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHODIOLA_SALIDROSIDE',
    name: 'Salidroside Extract',
    categories: ['adaptogen', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'CORTISOL_MOD'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, нервной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHODIOLA_ROSAVINS',
    name: 'Rosavins Extract',
    categories: ['adaptogen', 'energy'],
    mechanisms: ['ATP_UP', 'CORTISOL_MOD'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASHWAGANDHA_KSM',
    name: 'KSM-66 Ashwagandha',
    categories: ['adaptogen', 'hormone', 'stress'],
    mechanisms: ['CORTISOL_REDUCTION', 'TESTOSTERONE_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, гормонального баланса, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASHWAGANDHA_SENSORIL',
    name: 'Sensoril Ashwagandha',
    categories: ['adaptogen', 'calming'],
    mechanisms: ['CORTISOL_REDUCTION', 'GABA_UP'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'ANXIETY',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, успокоения',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASHWAGANDHA_ROOT',
    name: 'Ashwagandha Root Extract',
    categories: ['adaptogen', 'stress'],
    mechanisms: ['CORTISOL_MOD', 'IMMUNE_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_SCHISANDRA',
    name: 'Schisandra Chinensis',
    categories: ['adaptogen', 'liver', 'energy'],
    mechanisms: ['LIVER_PROTECTION', 'MITO_UP'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, функции печени, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_SCHISANDRIN',
    name: 'Schisandrin',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'LIVER_REGEN'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPS_CS4',
    name: 'Cordyceps CS-4',
    categories: ['adaptogen', 'energy', 'lung'],
    mechanisms: ['ATP_UP', 'OXYGEN_UP'],
    organs: ['LUNGS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, легких',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPS_MILITARIS',
    name: 'Cordyceps Militaris',
    categories: ['adaptogen', 'energy', 'testosterone'],
    mechanisms: ['ATP_UP', 'TESTOSTERONE_UP'],
    organs: ['MUSCLES', 'HORMONES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, тестостерона',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPIN',
    name: 'Cordycepin',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['ATP_UP', 'ANTI_INFLAMMATION'],
    organs: ['MUSCLES', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_REISHI',
    name: 'Reishi Mushroom',
    categories: ['adaptogen', 'immune', 'calming'],
    mechanisms: ['IMMUNE_MOD', 'CORTISOL_MOD'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы, успокоения',
    type: 'adaptogen'
  },
  {
    id: 'AD_REISHI_TRITERPENES',
    name: 'Reishi Triterpenes',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_CHAGA',
    name: 'Chaga Mushroom',
    categories: ['adaptogen', 'antioxidant', 'immune'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, защиты клеток от окислительного стресса, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_CHAGA_BETA',
    name: 'Chaga Beta-Glucans',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE',
    name: 'Lion’s Mane',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REGEN'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE_ERINACINES',
    name: 'Erinacines',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REPAIR'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'NEURO_DEGEN',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE_HERICENONES',
    name: 'Hericenones',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_MAITAKE',
    name: 'Maitake Mushroom',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHIITAKE',
    name: 'Shiitake Mushroom',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['LENTINAN_UP', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_TULSI',
    name: 'Tulsi (Holy Basil)',
    categories: ['adaptogen', 'stress', 'immune'],
    mechanisms: ['CORTISOL_MOD', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'IMMUNE_SYSTEM'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_GOTU_KOLA',
    name: 'Gotu Kola',
    categories: ['adaptogen', 'brain', 'vascular'],
    mechanisms: ['NEUROPROTECTION', 'COLLAGEN_UP'],
    organs: ['BRAIN', 'VESSELS'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы мозга',
    type: 'adaptogen'
  },
  {
    id: 'AD_BACOPA',
    name: 'Bacopa Monnieri',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['SYNAPSE_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_BACOSIDES',
    name: 'Bacosides',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NEURO_REPAIR', 'ANTIOXIDANT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_MACA',
    name: 'Maca Root',
    categories: ['adaptogen', 'hormone', 'energy'],
    mechanisms: ['HORMONE_BALANCE', 'ATP_UP'],
    organs: ['HORMONES', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, гормонального баланса, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_MACA_BLACK',
    name: 'Black Maca',
    categories: ['adaptogen', 'male', 'energy'],
    mechanisms: ['TESTOSTERONE_UP', 'ATP_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, мужского здоровья, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_MACA_RED',
    name: 'Red Maca',
    categories: ['adaptogen', 'female', 'hormone'],
    mechanisms: ['ESTROGEN_BALANCE', 'HORMONE_SUPPORT'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, женского здоровья, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_SUMA',
    name: 'Sumа Root',
    categories: ['adaptogen', 'energy', 'anabolic'],
    mechanisms: ['ATP_UP', 'ANABOLIC_SIGNALING'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHAPONTICUM',
    name: 'Rhaponticum Carthamoides',
    categories: ['adaptogen', 'anabolic'],
    mechanisms: ['ECdYSTERONE_UP', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_ECDYSTERONE',
    name: 'Ecdysterone',
    categories: ['adaptogen', 'anabolic'],
    mechanisms: ['MTOR_UP', 'PROTEIN_SYNTHESIS'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHILAJIT',
    name: 'Shilajit',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['MITO_UP', 'MINERAL_UP'],
    organs: ['MITOCHONDRIA', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_FULVIC',
    name: 'Fulvic Acid',
    categories: ['adaptogen', 'detox'],
    mechanisms: ['FULVIC_TRANSPORT', 'CELL_PROTECTION'],
    organs: ['CELLS', 'LIVER'],
    deficiency: 'TOXINS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, детоксикации',
    type: 'adaptogen'
  },
  {
    id: 'AD_SAFFRON',
    name: 'Saffron Extract',
    categories: ['adaptogen', 'mood'],
    mechanisms: ['SEROTONIN_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, нормализации настроения',
    type: 'adaptogen'
  },
  {
    id: 'AD_CROCIN',
    name: 'Crocin',
    categories: ['adaptogen', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, нервной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_SAFRANAL',
    name: 'Safranal',
    categories: ['adaptogen', 'mood'],
    mechanisms: ['SEROTONIN_UP', 'GABA_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, нормализации настроения',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASTRAGALUS',
    name: 'Astragalus Root',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'TELOMERASE_UP'],
    organs: ['IMMUNE_SYSTEM', 'CELLS'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASTRAGALOSIDE',
    name: 'Astragaloside IV',
    categories: ['adaptogen', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_PROTECTION'],
    organs: ['CELLS', 'HEART'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, антивозрастных процессов',
    type: 'adaptogen'
  },
  {
    id: 'AD_MORINGA',
    name: 'Moringa Extract',
    categories: ['adaptogen', 'multi'],
    mechanisms: ['ANTI_INFLAMMATION', 'NUTRIENT_UP'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'DEFICIENCY',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_AMLA',
    name: 'Amla (Indian Gooseberry)',
    categories: ['adaptogen', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, защиты клеток от окислительного стресса',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINGER',
    name: 'Ginger Extract',
    categories: ['adaptogen', 'GI', 'antiinflammatory'],
    mechanisms: ['GI_SOOTHING', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'GI_IRRITATION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, противовоспалительной защиты',
    type: 'adaptogen'
  },
  {
    id: 'AD_TURMERIC',
    name: 'Turmeric Extract',
    categories: ['adaptogen', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'BRAIN'],
    deficiency: 'INFLAMMATION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, противовоспалительной защиты',
    type: 'adaptogen'
  },
  {
    id: 'AD_HOLY_BASIL',
    name: 'Holy Basil (Tulsi)',
    categories: ['adaptogen', 'stress'],
    mechanisms: ['CORTISOL_MOD', 'IMMUNE_UP'],
    organs: ['BRAIN', 'IMMUNE_SYSTEM'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_FULL_ADAPTOGEN_COMPLEX',
    name: 'Full Spectrum Adaptogen Complex',
    categories: ['adaptogen', 'multi'],
    mechanisms: ['CORTISOL_MOD', 'ENERGY_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHODIOLA_ARCTIC',
    name: 'Rhodiola Arctic Extract',
    categories: ['adaptogen', 'energy', 'stress'],
    mechanisms: ['CORTISOL_MOD', 'ATP_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHODIOLA_PREMIUM',
    name: 'Rhodiola Premium Complex',
    categories: ['adaptogen', 'stress', 'energy'],
    mechanisms: ['CORTISOL_REDUCTION', 'MITO_UP'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASHWAGANDHA_FULLSPEC',
    name: 'Ashwagandha Full Spectrum',
    categories: ['adaptogen', 'hormone', 'stress'],
    mechanisms: ['CORTISOL_MOD', 'TESTOSTERONE_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, гормонального баланса, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASHWAGANDHA_LIPOSOMAL',
    name: 'Liposomal Ashwagandha',
    categories: ['adaptogen', 'stress'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'CORTISOL_REDUCTION'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_WILD',
    name: 'Wild Panax Ginseng',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['ADRENAL_STIMULATION', 'ATP_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_FERMENTED',
    name: 'Fermented Ginseng',
    categories: ['adaptogen', 'energy', 'absorption'],
    mechanisms: ['ATP_UP', 'BIOAVAILABILITY_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPS_HIMALAYAN',
    name: 'Himalayan Cordyceps',
    categories: ['adaptogen', 'energy', 'lung'],
    mechanisms: ['OXYGEN_UP', 'ATP_UP'],
    organs: ['LUNGS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, легких',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPS_BIOACTIVE',
    name: 'Bioactive Cordyceps',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_REISHI_RED',
    name: 'Red Reishi',
    categories: ['adaptogen', 'immune', 'calming'],
    mechanisms: ['IMMUNE_MOD', 'CORTISOL_MOD'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы, успокоения',
    type: 'adaptogen'
  },
  {
    id: 'AD_REISHI_BLACK',
    name: 'Black Reishi',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_CHAGA_PREMIUM',
    name: 'Premium Chaga Extract',
    categories: ['adaptogen', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, защиты клеток от окислительного стресса',
    type: 'adaptogen'
  },
  {
    id: 'AD_CHAGA_MELANIN',
    name: 'Chaga Melanin Complex',
    categories: ['adaptogen', 'skin', 'immune'],
    mechanisms: ['MELANIN_UP', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, здоровья кожи, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE_LIPOSOMAL',
    name: 'Liposomal Lion’s Mane',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'NGF_UP'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE_FULLSPEC',
    name: 'Lion’s Mane Full Spectrum',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REGEN'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'NEURO_DEGEN',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHIITAKE_LENTINAN',
    name: 'Lentinan Extract',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_MAITAKE_D_FRACTION',
    name: 'Maitake D-Fraction',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'NK_CELL_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_TULSI_PREMIUM',
    name: 'Premium Tulsi Extract',
    categories: ['adaptogen', 'stress'],
    mechanisms: ['CORTISOL_MOD', 'ANTI_INFLAMMATION'],
    organs: ['BRAIN', 'IMMUNE_SYSTEM'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_GOTU_KOLA_ASIATICOSIDE',
    name: 'Asiaticoside',
    categories: ['adaptogen', 'vascular', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'VESSEL_REPAIR'],
    organs: ['SKIN', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, здоровья кожи',
    type: 'adaptogen'
  },
  {
    id: 'AD_GOTU_KOLA_MADECA',
    name: 'Madecassoside',
    categories: ['adaptogen', 'skin', 'vascular'],
    mechanisms: ['COLLAGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['SKIN', 'VESSELS'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, здоровья кожи',
    type: 'adaptogen'
  },
  {
    id: 'AD_BACOPA_LIPOSOMAL',
    name: 'Liposomal Bacopa',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'NEURO_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_BACOPA_SYNAPSE',
    name: 'Bacopa Synapse Complex',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['SYNAPSE_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_MACA_GELATINIZED',
    name: 'Gelatinized Maca',
    categories: ['adaptogen', 'hormone', 'energy'],
    mechanisms: ['HORMONE_BALANCE', 'ATP_UP'],
    organs: ['HORMONES', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, гормонального баланса, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_MACA_YELLOW',
    name: 'Yellow Maca',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['HORMONE_BALANCE', 'ATP_UP'],
    organs: ['HORMONES', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHILAJIT_PURIFIED',
    name: 'Purified Shilajit',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['MITO_UP', 'MINERAL_UP'],
    organs: ['MITOCHONDRIA', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHILAJIT_GOLD',
    name: 'Gold Shilajit',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['ATP_UP', 'TESTOSTERONE_UP'],
    organs: ['HORMONES', 'ADRENALS'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASTRAGALUS_MEMBRANE',
    name: 'Astragalus Membrane Extract',
    categories: ['adaptogen', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_PROTECTION'],
    organs: ['CELLS', 'HEART'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, антивозрастных процессов',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASTRAGALUS_CYCLO',
    name: 'Astragalus Cycloastragenol',
    categories: ['adaptogen', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, антивозрастных процессов',
    type: 'adaptogen'
  },
  {
    id: 'AD_SUMA_PREMIUM',
    name: 'Premium Suma Extract',
    categories: ['adaptogen', 'anabolic'],
    mechanisms: ['ANABOLIC_SIGNALING', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_RHAPONTICUM_ECDY',
    name: 'Rhaponticum Ecdysteroid Complex',
    categories: ['adaptogen', 'anabolic'],
    mechanisms: ['MTOR_UP', 'PROTEIN_SYNTHESIS'],
    organs: ['MUSCLES'],
    deficiency: 'ATHLETES',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_GINSENG_GINSENOSIDES',
    name: 'Ginsenoside Complex',
    categories: ['adaptogen', 'energy', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'ATP_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена, гормонального баланса',
    type: 'adaptogen'
  },
  {
    id: 'AD_SCHISANDRA_LIGNANS',
    name: 'Schisandra Lignans',
    categories: ['adaptogen', 'liver'],
    mechanisms: ['LIVER_REGEN', 'MITO_REPAIR'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, функции печени',
    type: 'adaptogen'
  },
  {
    id: 'AD_CORDYCEPS_ADENOSINE',
    name: 'Adenosine-Rich Cordyceps',
    categories: ['adaptogen', 'energy'],
    mechanisms: ['ATP_UP', 'OXYGEN_UP'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, энергетического обмена',
    type: 'adaptogen'
  },
  {
    id: 'AD_REISHI_SPORE_OIL',
    name: 'Reishi Spore Oil',
    categories: ['adaptogen', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'SIRT1_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы, антивозрастных процессов',
    type: 'adaptogen'
  },
  {
    id: 'AD_CHAGA_POLYPHENOL',
    name: 'Chaga Polyphenol Extract',
    categories: ['adaptogen', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, защиты клеток от окислительного стресса',
    type: 'adaptogen'
  },
  {
    id: 'AD_LIONS_MANE_MYCO',
    name: 'Lion’s Mane Mycelium',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHIITAKE_POLYSAC',
    name: 'Shiitake Polysaccharides',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_MAITAKE_POLYSAC',
    name: 'Maitake Polysaccharides',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_TULSI_URTICA',
    name: 'Tulsi + Nettle Adaptogen',
    categories: ['adaptogen', 'immune', 'stress'],
    mechanisms: ['IMMUNE_UP', 'CORTISOL_MOD'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы, адаптации к стрессу',
    type: 'adaptogen'
  },
  {
    id: 'AD_GOTU_KOLA_NEURO',
    name: 'Gotu Kola Neuro Extract',
    categories: ['adaptogen', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'CIRCULATION_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы мозга',
    type: 'adaptogen'
  },
  {
    id: 'AD_BACOPA_MEMORY',
    name: 'Bacopa Memory Extract',
    categories: ['adaptogen', 'nootropic'],
    mechanisms: ['SYNAPSE_UP', 'NEURO_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, когнитивных функций',
    type: 'adaptogen'
  },
  {
    id: 'AD_ASTRAGALUS_IMMUNE',
    name: 'Astragalus Immune Extract',
    categories: ['adaptogen', 'immune'],
    mechanisms: ['IMMUNE_UP', 'NK_CELL_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, иммунной системы',
    type: 'adaptogen'
  },
  {
    id: 'AD_SHILAJIT_MITO',
    name: 'Shilajit Mito Complex',
    categories: ['adaptogen', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Адаптоген, помогающий адаптироваться к стрессу и поддерживающий адаптации к стрессу, работы митохондрий',
    type: 'adaptogen'
  },
  {
    id: 'AD_FULL_ADAPTOGEN_PREMIUM',
    name: 'Full Spectrum Adaptogen Premium',
    categories: ['adaptogen', 'multi'],
    mechanisms: ['CORTISOL_MOD', 'ENERGY_UP'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Премиальный комплекс адаптогенов',
    type: 'adaptogen'
  },
  {
    id: 'FUNG_REISHI',
    name: 'Reishi Mushroom',
    categories: ['fungi', 'immune', 'calming'],
    mechanisms: ['IMMUNE_MOD', 'CORTISOL_MOD'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Функциональный гриб для иммунной системы, успокоения',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_TRITERPENES',
    name: 'Reishi Triterpenes',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_POLYSAC',
    name: 'Reishi Polysaccharides',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS',
    name: 'Cordyceps Sinensis',
    categories: ['fungi', 'energy', 'lung'],
    mechanisms: ['ATP_UP', 'OXYGEN_UP'],
    organs: ['LUNGS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, легких',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_MILITARIS',
    name: 'Cordyceps Militaris',
    categories: ['fungi', 'energy', 'hormone'],
    mechanisms: ['ATP_UP', 'TESTOSTERONE_UP'],
    organs: ['MUSCLES', 'HORMONES'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, гормонального баланса',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPIN',
    name: 'Cordycepin',
    categories: ['fungi', 'mitochondria'],
    mechanisms: ['ATP_UP', 'ANTI_INFLAMMATION'],
    organs: ['MUSCLES', 'BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE',
    name: 'Lion’s Mane',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REGEN'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_ERINACINES',
    name: 'Erinacines',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REPAIR'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'NEURO_DEGEN',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_HERICENONES',
    name: 'Hericenones',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA',
    name: 'Chaga Mushroom',
    categories: ['fungi', 'antioxidant', 'immune'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_MELANIN',
    name: 'Chaga Melanin',
    categories: ['fungi', 'skin', 'immune'],
    mechanisms: ['MELANIN_UP', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для здоровья кожи, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_POLYPHENOLS',
    name: 'Chaga Polyphenols',
    categories: ['fungi', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIITAKE',
    name: 'Shiitake Mushroom',
    categories: ['fungi', 'immune'],
    mechanisms: ['LENTINAN_UP', 'IMMUNE_SUPPORT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIITAKE_LENTINAN',
    name: 'Lentinan',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIITAKE_POLYSAC',
    name: 'Shiitake Polysaccharides',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MAITAKE',
    name: 'Maitake Mushroom',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MAITAKE_D_FRACTION',
    name: 'Maitake D-Fraction',
    categories: ['fungi', 'immune'],
    mechanisms: ['NK_CELL_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MAITAKE_POLYSAC',
    name: 'Maitake Polysaccharides',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_AGARICUS',
    name: 'Agaricus Blazei',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_AGARICUS_POLYSAC',
    name: 'Agaricus Polysaccharides',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_TURKEY_TAIL',
    name: 'Turkey Tail (Trametes)',
    categories: ['fungi', 'immune'],
    mechanisms: ['PSK_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_TURKEY_TAIL_PSK',
    name: 'PSK (Polysaccharide-K)',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_TURKEY_TAIL_PSP',
    name: 'PSP (Polysaccharopeptide)',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_PORIA',
    name: 'Poria Cocos',
    categories: ['fungi', 'calming', 'immune'],
    mechanisms: ['GABA_UP', 'IMMUNE_MOD'],
    organs: ['BRAIN', 'IMMUNE_SYSTEM'],
    deficiency: 'ANXIETY',
    description: 'Функциональный гриб для успокоения, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_PORIA_POLYSAC',
    name: 'Poria Polysaccharides',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_BLACK',
    name: 'Black Cordyceps',
    categories: ['fungi', 'energy', 'lung'],
    mechanisms: ['OXYGEN_UP', 'ATP_UP'],
    organs: ['LUNGS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, легких',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_SPORE',
    name: 'Reishi Spores',
    categories: ['fungi', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'SIRT1_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для иммунной системы, антивозрастных процессов',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_SPORE_OIL',
    name: 'Reishi Spore Oil',
    categories: ['fungi', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'MEMBRANE_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для иммунной системы, антивозрастных процессов',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_ADENOSINE',
    name: 'Adenosine-Rich Cordyceps',
    categories: ['fungi', 'energy'],
    mechanisms: ['ATP_UP', 'OXYGEN_UP'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_MYCELIUM',
    name: 'Lion’s Mane Mycelium',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_BETA',
    name: 'Chaga Beta-Glucans',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_POLYPHENOL',
    name: 'Reishi Polyphenols',
    categories: ['fungi', 'immune', 'vascular'],
    mechanisms: ['ANTI_INFLAMMATION', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MORCHELLA',
    name: 'Morchella (Morel)',
    categories: ['fungi', 'immune', 'GI'],
    mechanisms: ['GI_SUPPORT', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'GI_IRRITATION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_ENOKI',
    name: 'Enoki Mushroom',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIOXIDANT'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIMEJI',
    name: 'Shimeji Mushroom',
    categories: ['fungi', 'immune'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_OYSTER',
    name: 'Oyster Mushroom',
    categories: ['fungi', 'cholesterol'],
    mechanisms: ['LIPID_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_OYSTER_ERGOTHIONEINE',
    name: 'Ergothioneine',
    categories: ['fungi', 'antioxidant', 'mitochondria'],
    mechanisms: ['ERGOTHIONEINE_UP', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса, работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_COPRINUS',
    name: 'Coprinus',
    categories: ['fungi', 'glucose'],
    mechanisms: ['GLUCOSE_REGULATION', 'INSULIN_SENSITIVITY'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_POLYPORUS',
    name: 'Polyporus Umbellatus',
    categories: ['fungi', 'lymph', 'diuretic'],
    mechanisms: ['LYMPH_FLOW_UP', 'ANTI_INFLAMMATION'],
    organs: ['KIDNEYS', 'LYMPH'],
    deficiency: 'LYMPH_STASIS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_ANTRODIA',
    name: 'Antrodia Camphorata',
    categories: ['fungi', 'liver', 'antiinflammatory'],
    mechanisms: ['LIVER_REGEN', 'ANTI_INFLAMMATION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Функциональный гриб для функции печени, противовоспалительной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_TREMELLA',
    name: 'Tremella Fuciformis',
    categories: ['fungi', 'skin', 'hydration'],
    mechanisms: ['HYALURONIC_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Функциональный гриб для здоровья кожи, гидратации',
    type: 'fungi'
  },
  {
    id: 'FUNG_TREMELLA_POLYSAC',
    name: 'Tremella Polysaccharides',
    categories: ['fungi', 'skin', 'immune'],
    mechanisms: ['HYDRATION_UP', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'DRY_SKIN',
    description: 'Функциональный гриб для здоровья кожи, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_AURICULARIA',
    name: 'Auricularia (Wood Ear)',
    categories: ['fungi', 'vascular'],
    mechanisms: ['ANTICOAGULATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'CLOTTING',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_PHELLINUS',
    name: 'Phellinus Linteus',
    categories: ['fungi', 'immune', 'antiinflammatory'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, противовоспалительной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_PREMIUM',
    name: 'Cordyceps Premium Complex',
    categories: ['fungi', 'energy', 'mitochondria'],
    mechanisms: ['ATP_UP', 'MITO_REPAIR'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_FULL_FUNGI_COMPLEX',
    name: 'Full Spectrum Fungi Complex',
    categories: ['fungi', 'multi'],
    mechanisms: ['IMMUNE_UP', 'MITO_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_PREMIUM',
    name: 'Reishi Premium Extract',
    categories: ['fungi', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'SIRT1_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для иммунной системы, антивозрастных процессов',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_GANODERMA',
    name: 'Reishi Ganoderma Lucidum',
    categories: ['fungi', 'immune', 'calming'],
    mechanisms: ['IMMUNE_MOD', 'CORTISOL_MOD'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Функциональный гриб для иммунной системы, успокоения',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_CRACKED_SPORE',
    name: 'Reishi Cracked Spores',
    categories: ['fungi', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'MEMBRANE_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для иммунной системы, антивозрастных процессов',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_ELITE',
    name: 'Cordyceps Elite',
    categories: ['fungi', 'energy', 'lung'],
    mechanisms: ['OXYGEN_UP', 'ATP_UP'],
    organs: ['LUNGS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, легких',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_POLYSAC',
    name: 'Cordyceps Polysaccharides',
    categories: ['fungi', 'immune', 'energy'],
    mechanisms: ['IMMUNE_UP', 'ATP_UP'],
    organs: ['IMMUNE_SYSTEM', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для иммунной системы, энергетического обмена',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_MYCO',
    name: 'Cordyceps Mycelium',
    categories: ['fungi', 'energy', 'mitochondria'],
    mechanisms: ['ATP_UP', 'MITO_REPAIR'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_PREMIUM',
    name: 'Lion’s Mane Premium',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_REGEN'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'COGNITION',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_FULLSPEC',
    name: 'Lion’s Mane Full Spectrum',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['NGF_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'NERVES'],
    deficiency: 'NEURO_DEGEN',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_LIONS_MANE_LIPOSOMAL',
    name: 'Lion’s Mane Liposomal',
    categories: ['fungi', 'nootropic'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'NGF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Функциональный гриб для когнитивных функций',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_PREMIUM',
    name: 'Chaga Premium',
    categories: ['fungi', 'antioxidant', 'immune'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_FULLSPEC',
    name: 'Chaga Full Spectrum',
    categories: ['fungi', 'immune', 'antioxidant'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для иммунной системы, защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_CHAGA_CHROMOGEN',
    name: 'Chaga Chromogenic Complex',
    categories: ['fungi', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIITAKE_PREMIUM',
    name: 'Shiitake Premium',
    categories: ['fungi', 'immune'],
    mechanisms: ['LENTINAN_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIITAKE_FULLSPEC',
    name: 'Shiitake Full Spectrum',
    categories: ['fungi', 'immune', 'antiviral'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, противовирусной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_MAITAKE_PREMIUM',
    name: 'Maitake Premium',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MAITAKE_SYNERGY',
    name: 'Maitake Synergy',
    categories: ['fungi', 'immune', 'metabolism'],
    mechanisms: ['IMMUNE_UP', 'GLUCOSE_REGULATION'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Функциональный гриб для иммунной системы, метаболизма',
    type: 'fungi'
  },
  {
    id: 'FUNG_TURKEY_TAIL_PREMIUM',
    name: 'Turkey Tail Premium',
    categories: ['fungi', 'immune'],
    mechanisms: ['PSK_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_TURKEY_TAIL_FULLSPEC',
    name: 'Turkey Tail Full Spectrum',
    categories: ['fungi', 'immune', 'antioxidant'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_AGARICUS_PREMIUM',
    name: 'Agaricus Premium',
    categories: ['fungi', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_AGARICUS_FULLSPEC',
    name: 'Agaricus Full Spectrum',
    categories: ['fungi', 'immune', 'antiviral'],
    mechanisms: ['IMMUNE_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, противовирусной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_TREMELLA_PREMIUM',
    name: 'Tremella Premium',
    categories: ['fungi', 'skin', 'hydration'],
    mechanisms: ['HYALURONIC_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Функциональный гриб для здоровья кожи, гидратации',
    type: 'fungi'
  },
  {
    id: 'FUNG_TREMELLA_FULLSPEC',
    name: 'Tremella Full Spectrum',
    categories: ['fungi', 'skin', 'immune'],
    mechanisms: ['HYDRATION_UP', 'IMMUNE_SUPPORT'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'DRY_SKIN',
    description: 'Функциональный гриб для здоровья кожи, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_ANTRODIA_PREMIUM',
    name: 'Antrodia Premium',
    categories: ['fungi', 'liver', 'antiinflammatory'],
    mechanisms: ['LIVER_REGEN', 'ANTI_INFLAMMATION'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Функциональный гриб для функции печени, противовоспалительной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_ANTRODIA_FULLSPEC',
    name: 'Antrodia Full Spectrum',
    categories: ['fungi', 'liver', 'immune'],
    mechanisms: ['LIVER_REGEN', 'IMMUNE_UP'],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Функциональный гриб для функции печени, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_POLYPORUS_PREMIUM',
    name: 'Polyporus Premium',
    categories: ['fungi', 'lymph', 'diuretic'],
    mechanisms: ['LYMPH_FLOW_UP', 'ANTI_INFLAMMATION'],
    organs: ['LYMPH', 'KIDNEYS'],
    deficiency: 'LYMPH_STASIS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_POLYPORUS_FULLSPEC',
    name: 'Polyporus Full Spectrum',
    categories: ['fungi', 'lymph', 'immune'],
    mechanisms: ['LYMPH_FLOW_UP', 'IMMUNE_UP'],
    organs: ['LYMPH', 'IMMUNE_SYSTEM'],
    deficiency: 'LYMPH_STASIS',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MORCHELLA_PREMIUM',
    name: 'Morchella Premium',
    categories: ['fungi', 'GI', 'immune'],
    mechanisms: ['GI_SUPPORT', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'GI_IRRITATION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_MORCHELLA_FULLSPEC',
    name: 'Morchella Full Spectrum',
    categories: ['fungi', 'GI', 'immune'],
    mechanisms: ['GI_SUPPORT', 'CELL_PROTECTION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'GI_IRRITATION',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_ENOKI_PREMIUM',
    name: 'Enoki Premium',
    categories: ['fungi', 'immune', 'antioxidant'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_SHIMEJI_PREMIUM',
    name: 'Shimeji Premium',
    categories: ['fungi', 'immune', 'cell'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, клеточного здоровья',
    type: 'fungi'
  },
  {
    id: 'FUNG_OYSTER_PREMIUM',
    name: 'Oyster Mushroom Premium',
    categories: ['fungi', 'cholesterol'],
    mechanisms: ['LIPID_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['HEART', 'VESSELS'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_OYSTER_ERGO_PREMIUM',
    name: 'Ergothioneine Premium',
    categories: ['fungi', 'antioxidant', 'mitochondria'],
    mechanisms: ['ERGOTHIONEINE_UP', 'CELL_PROTECTION'],
    organs: ['BRAIN', 'LIVER'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса, работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_COPRINUS_PREMIUM',
    name: 'Coprinus Premium',
    categories: ['fungi', 'glucose'],
    mechanisms: ['GLUCOSE_REGULATION', 'INSULIN_SENSITIVITY'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_AURICULARIA_PREMIUM',
    name: 'Auricularia Premium',
    categories: ['fungi', 'vascular'],
    mechanisms: ['ANTICOAGULATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'CLOTTING',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'FUNG_AURICULARIA_FULLSPEC',
    name: 'Auricularia Full Spectrum',
    categories: ['fungi', 'vascular', 'immune'],
    mechanisms: ['ANTICOAGULATION', 'IMMUNE_UP'],
    organs: ['VESSELS', 'IMMUNE_SYSTEM'],
    deficiency: 'CLOTTING',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_PHELLINUS_PREMIUM',
    name: 'Phellinus Premium',
    categories: ['fungi', 'immune', 'antiinflammatory'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, противовоспалительной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_PHELLINUS_FULLSPEC',
    name: 'Phellinus Full Spectrum',
    categories: ['fungi', 'immune', 'antioxidant'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_GANODERMA_APPLANATUM',
    name: 'Ganoderma Applanatum',
    categories: ['fungi', 'immune', 'antiinflammatory'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Функциональный гриб для иммунной системы, противовоспалительной защиты',
    type: 'fungi'
  },
  {
    id: 'FUNG_GANODERMA_TSUGAE',
    name: 'Ganoderma Tsugae',
    categories: ['fungi', 'immune', 'vascular'],
    mechanisms: ['IMMUNE_UP', 'VESSEL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'VESSELS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_INONOTUS_OBLIQUUS',
    name: 'Inonotus Obliquus',
    categories: ['fungi', 'antioxidant', 'immune'],
    mechanisms: ['Nrf2_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для защиты клеток от окислительного стресса, иммунной системы',
    type: 'fungi'
  },
  {
    id: 'FUNG_INONOTUS_FULLSPEC',
    name: 'Inonotus Full Spectrum',
    categories: ['fungi', 'immune', 'antioxidant'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для иммунной системы, защиты клеток от окислительного стресса',
    type: 'fungi'
  },
  {
    id: 'FUNG_CORDYCEPS_SYNERGY',
    name: 'Cordyceps Synergy Complex',
    categories: ['fungi', 'energy', 'mitochondria'],
    mechanisms: ['ATP_UP', 'MITO_REPAIR'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Функциональный гриб для энергетического обмена, работы митохондрий',
    type: 'fungi'
  },
  {
    id: 'FUNG_REISHI_SYNERGY',
    name: 'Reishi Synergy Complex',
    categories: ['fungi', 'immune', 'antiaging'],
    mechanisms: ['IMMUNE_UP', 'SIRT1_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN'],
    deficiency: 'AGING',
    description: 'Функциональный гриб для иммунной системы, антивозрастных процессов',
    type: 'fungi'
  },
  {
    id: 'FUNG_FULL_FUNGI_PREMIUM',
    name: 'Full Spectrum Fungi Premium',
    categories: ['fungi', 'multi'],
    mechanisms: ['IMMUNE_UP', 'MITO_UP'],
    organs: ['IMMUNE_SYSTEM', 'BRAIN', 'LIVER'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Функциональный гриб для поддержки иммунитета и энергии',
    type: 'fungi'
  },
  {
    id: 'PRO_L_ACIDOPHILUS',
    name: 'Lactobacillus acidophilus',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['LACTIC_ACID_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_RHAMNOSUS',
    name: 'Lactobacillus rhamnosus GG',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PLANTARUM',
    name: 'Lactobacillus plantarum',
    categories: ['probiotic', 'GI', 'antiinflammatory'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, противовоспалительной защиты',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_REUTERI',
    name: 'Lactobacillus reuteri',
    categories: ['probiotic', 'hormone', 'GI'],
    mechanisms: ['REUTERIN_UP', 'GI_BALANCE'],
    organs: ['GI', 'HORMONES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Пробиотик, поддерживающий микробиома, гормонального баланса',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_CASEI',
    name: 'Lactobacillus casei',
    categories: ['probiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_HELVETICUS',
    name: 'Lactobacillus helveticus',
    categories: ['probiotic', 'stress', 'brain'],
    mechanisms: ['GABA_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Пробиотик, поддерживающий микробиома, адаптации к стрессу, работы мозга',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_SALIVARIUS',
    name: 'Lactobacillus salivarius',
    categories: ['probiotic', 'oral', 'immune'],
    mechanisms: ['ORAL_MICROBIOME_UP', 'IMMUNE_UP'],
    organs: ['MOUTH', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_GASSERI',
    name: 'Lactobacillus gasseri',
    categories: ['probiotic', 'fat_loss', 'GI'],
    mechanisms: ['FAT_METABOLISM', 'GI_BALANCE'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пробиотик, поддерживающий микробиома, жиросжигания',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_FERMENTUM',
    name: 'Lactobacillus fermentum',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PARACASEI',
    name: 'Lactobacillus paracasei',
    categories: ['probiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LONGUM',
    name: 'Bifidobacterium longum',
    categories: ['probiotic', 'GI', 'brain'],
    mechanisms: ['GI_BARRIER_UP', 'NEURO_SUPPORT'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, работы мозга',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_BIFIDUM',
    name: 'Bifidobacterium bifidum',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LACTIS',
    name: 'Bifidobacterium lactis',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_BREVE',
    name: 'Bifidobacterium breve',
    categories: ['probiotic', 'skin', 'GI'],
    mechanisms: ['SKIN_IMMUNE_UP', 'GI_BALANCE'],
    organs: ['SKIN', 'GI'],
    deficiency: 'ECZEMA',
    description: 'Пробиотик, поддерживающий микробиома, здоровья кожи',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_INFANTIS',
    name: 'Bifidobacterium infantis',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_ANIMALIS',
    name: 'Bifidobacterium animalis',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_BOULARDII',
    name: 'Saccharomyces boulardii',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DIARRHEA',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_CEREVISIAE',
    name: 'Saccharomyces cerevisiae',
    categories: ['probiotic', 'GI'],
    mechanisms: ['GI_BALANCE', 'ANTI_PATHOGEN'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_COAG',
    name: 'Bacillus coagulans',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['SPORE_FORM', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_SUBTILIS',
    name: 'Bacillus subtilis',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['SPORE_FORM', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_CLAUSII',
    name: 'Bacillus clausii',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'ANTI_PATHOGEN'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_LICHEN',
    name: 'Bacillus licheniformis',
    categories: ['probiotic', 'GI', 'enzyme'],
    mechanisms: ['ENZYME_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_ACIDOPHILUS_NCFM',
    name: 'Lactobacillus acidophilus NCFM',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_RHAMNOSUS_HN001',
    name: 'Lactobacillus rhamnosus HN001',
    categories: ['probiotic', 'immune', 'skin'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM', 'SKIN'],
    deficiency: 'ALLERGY',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы, здоровья кожи',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PLANTARUM_299V',
    name: 'Lactobacillus plantarum 299v',
    categories: ['probiotic', 'GI', 'brain'],
    mechanisms: ['GI_BARRIER_UP', 'GI_BRAIN_AXIS'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, работы мозга',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_REUTERI_ATCC',
    name: 'Lactobacillus reuteri ATCC 55730',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['REUTERIN_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LONGUM_35624',
    name: 'Bifidobacterium longum 35624',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['ANTI_INFLAMMATION', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LACTIS_HN019',
    name: 'Bifidobacterium lactis HN019',
    categories: ['probiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_BREVE_M16V',
    name: 'Bifidobacterium breve M-16V',
    categories: ['probiotic', 'infant', 'skin'],
    mechanisms: ['SKIN_IMMUNE_UP', 'GI_BALANCE'],
    organs: ['SKIN', 'GI'],
    deficiency: 'ECZEMA',
    description: 'Пробиотик, поддерживающий микробиома, здоровья кожи',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_BOULARDII_CNCM',
    name: 'Saccharomyces boulardii CNCM I-745',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DIARRHEA',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_KEFIRI',
    name: 'Lactobacillus kefiri',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_JOHNSONII',
    name: 'Lactobacillus johnsonii',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_PATHOGEN'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_DELBRUECKII',
    name: 'Lactobacillus delbrueckii',
    categories: ['probiotic', 'GI'],
    mechanisms: ['LACTIC_ACID_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_ADOLESCENTIS',
    name: 'Bifidobacterium adolescentis',
    categories: ['probiotic', 'GI', 'metabolism'],
    mechanisms: ['GI_BALANCE', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Пробиотик, поддерживающий микробиома, метаболизма',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_PSEUDOCATENULATUM',
    name: 'Bifidobacterium pseudocatenulatum',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_INDICUS',
    name: 'Bacillus indicus',
    categories: ['probiotic', 'antioxidant'],
    mechanisms: ['CAROTENOID_PRODUCTION', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пробиотик, поддерживающий микробиома, защиты клеток от окислительного стресса',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_MEGATERIUM',
    name: 'Bacillus megaterium',
    categories: ['probiotic', 'GI', 'enzyme'],
    mechanisms: ['ENZYME_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_HAMMOSUS_GR1',
    name: 'Lactobacillus rhamnosus GR-1',
    categories: ['probiotic', 'urogenital'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['URINARY', 'GI'],
    deficiency: 'UTI',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_REUTERI_RC14',
    name: 'Lactobacillus reuteri RC-14',
    categories: ['probiotic', 'urogenital'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_BALANCE'],
    organs: ['URINARY', 'GI'],
    deficiency: 'UTI',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PARACASEI_LPC37',
    name: 'Lactobacillus paracasei LPC-37',
    categories: ['probiotic', 'stress', 'immune'],
    mechanisms: ['CORTISOL_MOD', 'IMMUNE_UP'],
    organs: ['BRAIN', 'IMMUNE_SYSTEM'],
    deficiency: 'STRESS',
    description: 'Пробиотик, поддерживающий микробиома, адаптации к стрессу, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_HELVETICUS_R0052',
    name: 'Lactobacillus helveticus R0052',
    categories: ['probiotic', 'stress', 'brain'],
    mechanisms: ['GABA_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Пробиотик, поддерживающий микробиома, адаптации к стрессу, работы мозга',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LONGUM_R0175',
    name: 'Bifidobacterium longum R0175',
    categories: ['probiotic', 'stress', 'brain'],
    mechanisms: ['GI_BRAIN_AXIS', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Пробиотик, поддерживающий микробиома, адаптации к стрессу, работы мозга',
    type: 'probiotic'
  },
  {
    id: 'PRO_SYMBIO_COMPLEX',
    name: 'Symbiotic Probiotic Complex',
    categories: ['probiotic', 'multi'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_SCFA',
    name: 'Postbiotic SCFA Complex',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Комплекс короткоцепочечных кислот',
    type: 'postbiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_BUTYRATE',
    name: 'Sodium Butyrate',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['BUTYRATE_UP', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_CALCIUM_BUTYRATE',
    name: 'Calcium Butyrate',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['BUTYRATE_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_PROPIONATE',
    name: 'Propionate Postbiotic',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['SCFA_UP', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'DIABETES',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_ACETATE',
    name: 'Acetate Postbiotic',
    categories: ['postbiotic', 'GI', 'cell'],
    mechanisms: ['SCFA_UP', 'CELL_SIGNALING'],
    organs: ['GI', 'CELLS'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для клеточного здоровья',
    type: 'postbiotic'
  },
  {
    id: 'PRO_PARAPROBIOTIC_L_RHAMNOSUS',
    name: 'Paraprobiotic L. rhamnosus',
    categories: ['paraprobiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_PATHOGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_PARAPROBIOTIC_L_PLANTARUM',
    name: 'Paraprobiotic L. plantarum',
    categories: ['paraprobiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_PARAPROBIOTIC_B_LACTIS',
    name: 'Paraprobiotic B. lactis',
    categories: ['paraprobiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_PARAPROBIOTIC_S_BOULARDII',
    name: 'Paraprobiotic S. boulardii',
    categories: ['paraprobiotic', 'GI'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'DIARRHEA',
    description: 'Парапробиотик для поддержки обменных процессов и здоровья',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_METABIOTIC_L_RHAMNOSUS',
    name: 'Metabiotic L. rhamnosus',
    categories: ['metabiotic', 'immune'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Метабиотик для иммунной системы',
    type: 'metabiotic'
  },
  {
    id: 'PRO_METABIOTIC_L_REUTERI',
    name: 'Metabiotic L. reuteri',
    categories: ['metabiotic', 'hormone', 'GI'],
    mechanisms: ['REUTERIN_UP', 'GI_BALANCE'],
    organs: ['GI', 'HORMONES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Метабиотик для гормонального баланса',
    type: 'metabiotic'
  },
  {
    id: 'PRO_METABIOTIC_B_LONGUM',
    name: 'Metabiotic B. longum',
    categories: ['metabiotic', 'brain', 'GI'],
    mechanisms: ['GI_BRAIN_AXIS', 'NEURO_SUPPORT'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Метабиотик для работы мозга',
    type: 'metabiotic'
  },
  {
    id: 'PRO_METABIOTIC_S_BOULARDII',
    name: 'Metabiotic S. boulardii',
    categories: ['metabiotic', 'GI'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'DIARRHEA',
    description: 'Метабиотик для поддержки обменных процессов и здоровья',
    type: 'metabiotic'
  },
  {
    id: 'PRO_L_CRISPATUS',
    name: 'Lactobacillus crispatus',
    categories: ['probiotic', 'urogenital'],
    mechanisms: ['ANTI_PATHOGEN', 'PH_BALANCE'],
    organs: ['URINARY', 'GI'],
    deficiency: 'UTI',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_JENSENII',
    name: 'Lactobacillus jensenii',
    categories: ['probiotic', 'urogenital'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['URINARY'],
    deficiency: 'UTI',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_MUCOSA',
    name: 'Lactobacillus mucosae',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_AMYLOVORUS',
    name: 'Lactobacillus amylovorus',
    categories: ['probiotic', 'fat_loss'],
    mechanisms: ['FAT_METABOLISM', 'GI_BALANCE'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пробиотик, поддерживающий микробиома, жиросжигания',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_KURASHIGE',
    name: 'Lactobacillus kurashige',
    categories: ['probiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_PATHOGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PENTOSUS',
    name: 'Lactobacillus pentosus',
    categories: ['probiotic', 'GI'],
    mechanisms: ['GI_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_THERMOPHILUM',
    name: 'Bifidobacterium thermophilum',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_CETTI',
    name: 'Bifidobacterium catenulatum',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_VELES',
    name: 'Bacillus velezensis',
    categories: ['probiotic', 'GI', 'enzyme'],
    mechanisms: ['ENZYME_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_PUMILUS',
    name: 'Bacillus pumilus',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['SPORE_FORM', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_BACILLUS_FLEXUS',
    name: 'Bacillus flexus',
    categories: ['probiotic', 'GI', 'enzyme'],
    mechanisms: ['ENZYME_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_THERMOPHILUS',
    name: 'Streptococcus thermophilus',
    categories: ['probiotic', 'GI'],
    mechanisms: ['LACTIC_ACID_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_SALIVARIUS_K12',
    name: 'Streptococcus salivarius K12',
    categories: ['probiotic', 'oral', 'immune'],
    mechanisms: ['ORAL_IMMUNE_UP', 'ANTI_PATHOGEN'],
    organs: ['MOUTH', 'THROAT'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_SALIVARIUS_M18',
    name: 'Streptococcus salivarius M18',
    categories: ['probiotic', 'oral'],
    mechanisms: ['ORAL_MICROBIOME_UP', 'ANTI_PATHOGEN'],
    organs: ['MOUTH', 'TEETH'],
    deficiency: 'CARIES',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_HAMMOSUS_GG2',
    name: 'Lactobacillus rhamnosus GG2',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_PLANTARUM_HEATKILLED',
    name: 'Heat-Killed L. plantarum',
    categories: ['paraprobiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_L_REUTERI_DSM',
    name: 'Lactobacillus reuteri DSM 17938',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['REUTERIN_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_REUTERI_PROTECTIS',
    name: 'L. reuteri Protectis',
    categories: ['probiotic', 'GI', 'infant'],
    mechanisms: ['GI_REPAIR', 'ANTI_PATHOGEN'],
    organs: ['GI', 'INFANT'],
    deficiency: 'DIARRHEA',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_LONGUM_BB536',
    name: 'Bifidobacterium longum BB536',
    categories: ['probiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_B_BIFIDUM_BGN4',
    name: 'Bifidobacterium bifidum BGN4',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_S_BOULARDII_ULTRA',
    name: 'Saccharomyces boulardii Ultra',
    categories: ['probiotic', 'GI', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DIARRHEA',
    description: 'Пробиотик, поддерживающий микробиома, иммунной системы',
    type: 'probiotic'
  },
  {
    id: 'PRO_L_ACIDOPHILUS_HEATKILLED',
    name: 'Heat-Killed L. acidophilus',
    categories: ['paraprobiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_PATHOGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_B_LACTIS_HEATKILLED',
    name: 'Heat-Killed B. lactis',
    categories: ['paraprobiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Парапробиотик для иммунной системы',
    type: 'paraprobiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_AMINO',
    name: 'Postbiotic Amino Acids',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_REPAIR', 'IMMUNE_SIGNALING_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'PRO_POSTBIOTIC_PEPTIDES',
    name: 'Postbiotic Peptides',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'PRO_METABIOTIC_SCFA',
    name: 'Metabiotic SCFA Complex',
    categories: ['metabiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Метабиотик для иммунной системы',
    type: 'metabiotic'
  },
  {
    id: 'PRO_METABIOTIC_POLYPHENOL',
    name: 'Metabiotic Polyphenol Complex',
    categories: ['metabiotic', 'immune', 'antiinflammatory'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Метабиотик для иммунной системы, противовоспалительной защиты',
    type: 'metabiotic'
  },
  {
    id: 'PRO_UBIOME_DIVERSITY',
    name: 'Microbiome Diversity Booster',
    categories: ['probiotic', 'multi'],
    mechanisms: ['GI_DIVERSITY_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Бустер микробного разнообразия',
    type: 'probiotic'
  },
  {
    id: 'PRO_UBIOME_BUTYRATE',
    name: 'Microbiome Butyrate Booster',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['BUTYRATE_UP', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'PRO_UBIOME_MUCIN',
    name: 'Microbiome Mucin Booster',
    categories: ['probiotic', 'GI'],
    mechanisms: ['MUCIN_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пробиотик, поддерживающий микробиома',
    type: 'probiotic'
  },
  {
    id: 'PRO_SYMBIOTIC_PREMIUM',
    name: 'Premium Symbiotic Complex',
    categories: ['symbiotic', 'multi'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Симбиотик для поддержки обменных процессов и здоровья',
    type: 'symbiotic'
  },
  {
    id: 'PRO_SYMBIOTIC_FULLSPEC',
    name: 'Full Spectrum Symbiotic',
    categories: ['symbiotic', 'multi'],
    mechanisms: ['GI_DIVERSITY_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Симбиотик для поддержки обменных процессов и здоровья',
    type: 'symbiotic'
  },
  {
    id: 'PRE_INULIN',
    name: 'Inulin',
    categories: ['prebiotic', 'fiber', 'GI'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'MICROBIOME'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FOS',
    name: 'Fructooligosaccharides (FOS)',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'BIFIDO_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GOS',
    name: 'Galactooligosaccharides (GOS)',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['BIFIDO_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_XOS',
    name: 'Xylooligosaccharides (XOS)',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_AXOS',
    name: 'Arabinoxylans (AXOS)',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['SCFA_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_RESISTANT_STARCH_RS2',
    name: 'Resistant Starch RS2',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['BUTYRATE_UP', 'GI_REPAIR'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_RESISTANT_STARCH_RS3',
    name: 'Resistant Starch RS3',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_RESISTANT_STARCH_RS4',
    name: 'Resistant Starch RS4',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['SCFA_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ARABINOGALACTAN',
    name: 'Arabinogalactan',
    categories: ['prebiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BETA_GLUCANS',
    name: 'Beta-Glucans',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['BETA_GLU_CAN_UP', 'IMMUNE_STIM'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_PECTIN',
    name: 'Pectin',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_APPLE_PECTIN',
    name: 'Apple Pectin',
    categories: ['prebiotic', 'GI', 'detox'],
    mechanisms: ['GI_BINDING', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'TOXINS',
    description: 'Пребиотик, поддерживающий микробиома, детоксикации',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CITRUS_PECTIN',
    name: 'Citrus Pectin',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_MODIFIED_CITRUS_PECTIN',
    name: 'Modified Citrus Pectin (MCP)',
    categories: ['prebiotic', 'detox', 'immune'],
    mechanisms: ['DETOX_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'TOXINS',
    description: 'Пребиотик, поддерживающий микробиома, детоксикации, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_LARCH_FIBER',
    name: 'Larch Fiber',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['SCFA_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ISOMALTOOLIGOSACCHARIDES',
    name: 'IMO (Isomaltooligosaccharides)',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FERMENTATION', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_POLYDEXTROSE',
    name: 'Polydextrose',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_LACTULOSE',
    name: 'Lactulose',
    categories: ['prebiotic', 'GI', 'detox'],
    mechanisms: ['FERMENTATION', 'AMMONIA_CLEARANCE'],
    organs: ['GI', 'LIVER'],
    deficiency: 'CONSTIPATION',
    description: 'Пребиотик, поддерживающий микробиома, детоксикации',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_2FL',
    name: '2’-Fucosyllactose (2’-FL)',
    categories: ['prebiotic', 'infant', 'immune'],
    mechanisms: ['BIFIDO_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_3GL',
    name: '3’-Galactosyllactose (3’-GL)',
    categories: ['prebiotic', 'infant'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IBS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_LNNT',
    name: 'Lacto-N-Neotetraose (LNnT)',
    categories: ['prebiotic', 'infant', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'SCFA_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GLUCOMANNAN',
    name: 'Glucomannan (Konjac Fiber)',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ACACIA_FIBER',
    name: 'Acacia Fiber',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GUAR_FIBER',
    name: 'Partially Hydrolyzed Guar Gum (PHGG)',
    categories: ['prebiotic', 'GI', 'antiinflammatory'],
    mechanisms: ['GI_BARRIER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBS',
    description: 'Пребиотик, поддерживающий микробиома, противовоспалительной защиты',
    type: 'prebiotic'
  },
  {
    id: 'PRE_INULIN_HP',
    name: 'High-Performance Inulin',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FOS_SHORTCHAIN',
    name: 'Short-Chain FOS',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FERMENTATION', 'BIFIDO_UP'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FOS_LONGCHAIN',
    name: 'Long-Chain FOS',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GOS_SYNERGY',
    name: 'GOS Synergy Complex',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['BIFIDO_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_XOS_SYNERGY',
    name: 'XOS Synergy Complex',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_AXOS_SYNERGY',
    name: 'AXOS Synergy Complex',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_RESISTANT_DEXTRIN',
    name: 'Resistant Dextrin',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_YACON_SYRUP',
    name: 'Yacon Root FOS',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FOS_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BANANA_FIBER',
    name: 'Green Banana Resistant Starch',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['RS_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_PSYLLIUM',
    name: 'Psyllium Husk',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'GI_REPAIR'],
    organs: ['GI', 'LIVER'],
    deficiency: 'CONSTIPATION',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_OAT_BETA_GLUCAN',
    name: 'Oat Beta-Glucan',
    categories: ['prebiotic', 'cholesterol', 'GI'],
    mechanisms: ['BETA_GLU_CAN_UP', 'LIPID_BALANCE'],
    organs: ['HEART', 'GI'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BARLEY_BETA_GLUCAN',
    name: 'Barley Beta-Glucan',
    categories: ['prebiotic', 'GI', 'cholesterol'],
    mechanisms: ['BETA_GLU_CAN_UP', 'SCFA_UP'],
    organs: ['HEART', 'GI'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_POLYPHENOL_PREBIOTIC',
    name: 'Polyphenol Prebiotic Complex',
    categories: ['prebiotic', 'immune', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_SEAWEED_FIBER',
    name: 'Seaweed Fiber',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ALGINATE',
    name: 'Sodium Alginate',
    categories: ['prebiotic', 'GI', 'barrier'],
    mechanisms: ['GI_GEL_FORM', 'GI_PROTECTION'],
    organs: ['GI'],
    deficiency: 'GI_IRRITATION',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CHITOSAN_OLIGO',
    name: 'Chitosan Oligosaccharides',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GLUCOOLIGOSACCHARIDES',
    name: 'Gluco-Oligosaccharides',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_COMPLEX',
    name: 'Human Milk Oligosaccharide Complex',
    categories: ['prebiotic', 'infant', 'immune'],
    mechanisms: ['BIFIDO_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_SYNERGY_FIBER',
    name: 'Full Spectrum Fiber Complex',
    categories: ['prebiotic', 'multi'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_INULIN_PREMIUM',
    name: 'Premium Inulin',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_INULIN_LC',
    name: 'Long-Chain Inulin',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_INULIN_SC',
    name: 'Short-Chain Inulin',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FERMENTATION', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FOS_PREMIUM',
    name: 'Premium FOS',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['BIFIDO_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GOS_PREMIUM',
    name: 'Premium GOS',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'BIFIDO_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_XOS_PREMIUM',
    name: 'Premium XOS',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_AXOS_PREMIUM',
    name: 'Premium AXOS',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_2FL_PREMIUM',
    name: 'Premium 2’-FL',
    categories: ['prebiotic', 'infant', 'immune'],
    mechanisms: ['BIFIDO_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_3GL_PREMIUM',
    name: 'Premium 3’-GL',
    categories: ['prebiotic', 'infant'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IBS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_LNNT_PREMIUM',
    name: 'Premium LNnT',
    categories: ['prebiotic', 'infant', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'SCFA_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_6SL',
    name: '6’-Sialyllactose (6’-SL)',
    categories: ['prebiotic', 'infant', 'immune'],
    mechanisms: ['IMMUNE_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_3SL',
    name: '3’-Sialyllactose (3’-SL)',
    categories: ['prebiotic', 'infant', 'GI'],
    mechanisms: ['GI_BALANCE', 'SCFA_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_HMO_FDSL',
    name: 'Fucosylated Disialyllactose',
    categories: ['prebiotic', 'infant', 'immune'],
    mechanisms: ['BIFIDO_UP', 'IMMUNE_UP'],
    organs: ['GI', 'INFANT'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GALACTOMANNAN',
    name: 'Galactomannan',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_MANNAN_OLIGO',
    name: 'Mannan-Oligosaccharides (MOS)',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FRUCTAN_COMPLEX',
    name: 'Fructan Complex',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FERMENTATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GLUCO_OLIGO',
    name: 'Gluco-Oligosaccharides',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_POLYPHENOL_FIBER',
    name: 'Polyphenol Fiber Complex',
    categories: ['prebiotic', 'immune', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_SEAWEED_OLIGO',
    name: 'Seaweed Oligosaccharides',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ALGINATE_PREMIUM',
    name: 'Premium Alginate',
    categories: ['prebiotic', 'GI', 'barrier'],
    mechanisms: ['GI_GEL_FORM', 'GI_PROTECTION'],
    organs: ['GI'],
    deficiency: 'GI_IRRITATION',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CHITOSAN_PREMIUM',
    name: 'Premium Chitosan Fiber',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GLUCOMANNAN_PREMIUM',
    name: 'Premium Glucomannan',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_PSYLLIUM_PREMIUM',
    name: 'Premium Psyllium',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'GI_REPAIR'],
    organs: ['GI', 'LIVER'],
    deficiency: 'CONSTIPATION',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_OAT_FIBER_PREMIUM',
    name: 'Premium Oat Fiber',
    categories: ['prebiotic', 'cholesterol', 'GI'],
    mechanisms: ['FIBER_UP', 'LIPID_BALANCE'],
    organs: ['HEART', 'GI'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BARLEY_FIBER_PREMIUM',
    name: 'Premium Barley Fiber',
    categories: ['prebiotic', 'GI', 'cholesterol'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['HEART', 'GI'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CORN_FIBER',
    name: 'Resistant Corn Fiber',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Кукурузное резистентное волокно',
    type: 'prebiotic'
  },
  {
    id: 'PRE_WHEAT_ARABINOXYLAN',
    name: 'Wheat Arabinoxylan',
    categories: ['prebiotic', 'immune'],
    mechanisms: ['SCFA_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_RICE_FIBER',
    name: 'Rice Fiber',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FIBER_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CASSAVA_RESISTANT',
    name: 'Cassava Resistant Starch',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['RS_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_TAPIOCA_RESISTANT',
    name: 'Tapioca Resistant Starch',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['RS_UP', 'GI_REPAIR'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GREEN_PLANTAIN_RS',
    name: 'Green Plantain RS',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['RS_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_JERUSALEM_ARTICHOKE',
    name: 'Jerusalem Artichoke Fiber',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FOS_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CARROT_FIBER',
    name: 'Carrot Fiber',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FIBER_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BEET_FIBER',
    name: 'Beet Fiber',
    categories: ['prebiotic', 'GI', 'detox'],
    mechanisms: ['FIBER_UP', 'GI_BINDING'],
    organs: ['GI', 'LIVER'],
    deficiency: 'TOXINS',
    description: 'Пребиотик, поддерживающий микробиома, детоксикации',
    type: 'prebiotic'
  },
  {
    id: 'PRE_POTATO_RESISTANT',
    name: 'Potato Resistant Starch',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['RS_UP', 'SCFA_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_CITRUS_FIBER',
    name: 'Citrus Fiber',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_BAMBOO_FIBER',
    name: 'Bamboo Fiber',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['FIBER_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_KONJAC_FIBER',
    name: 'Konjac Fiber Premium',
    categories: ['prebiotic', 'GI', 'metabolism'],
    mechanisms: ['FIBER_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пребиотик, поддерживающий микробиома, метаболизма',
    type: 'prebiotic'
  },
  {
    id: 'PRE_FULL_FIBER_PREMIUM',
    name: 'Full Spectrum Fiber Premium',
    categories: ['prebiotic', 'multi'],
    mechanisms: ['FIBER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_GI_BARRIER_COMPLEX',
    name: 'GI Barrier Prebiotic Complex',
    categories: ['prebiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_MUCIN_PREBIOTIC',
    name: 'Mucin‑Stimulating Prebiotic',
    categories: ['prebiotic', 'GI'],
    mechanisms: ['MUCIN_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'PRE_ANTIINFLAMMATORY_FIBER',
    name: 'Anti‑Inflammatory Fiber Complex',
    categories: ['prebiotic', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION', 'SCFA_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пребиотик, поддерживающий микробиома, иммунной системы',
    type: 'prebiotic'
  },
  {
    id: 'PRE_SYNERGY_PREBIOTIC',
    name: 'Full Spectrum Prebiotic Synergy',
    categories: ['prebiotic', 'multi'],
    mechanisms: ['SCFA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Пребиотик, поддерживающий микробиома',
    type: 'prebiotic'
  },
  {
    id: 'POST_SCFA_BUTYRATE',
    name: 'Sodium Butyrate',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['BUTYRATE_UP', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_CALCIUM_BUTYRATE',
    name: 'Calcium Butyrate',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['BUTYRATE_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_MAGNESIUM_BUTYRATE',
    name: 'Magnesium Butyrate',
    categories: ['postbiotic', 'GI', 'calming'],
    mechanisms: ['BUTYRATE_UP', 'GI_REPAIR'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'GI_IRRITATION',
    description: 'Постбиотик для успокоения',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_PROPIONATE',
    name: 'Propionate',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['SCFA_UP', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'DIABETES',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_ACETATE',
    name: 'Acetate',
    categories: ['postbiotic', 'GI', 'cell'],
    mechanisms: ['SCFA_UP', 'CELL_SIGNALING'],
    organs: ['GI', 'CELLS'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для клеточного здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_ISOBUTYRATE',
    name: 'Isobutyrate',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['SCFA_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_SCFA_VALERATE',
    name: 'Valerate',
    categories: ['postbiotic', 'GI', 'neuro'],
    mechanisms: ['SCFA_UP', 'GUT_BRAIN_AXIS'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_LACTATE',
    name: 'Lactate',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['LACTATE_UP', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_LACTATE_D',
    name: 'L‑Lactate',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['GI_BALANCE', 'SCFA_UP'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_LACTATE_L',
    name: 'D‑Lactate',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['GI_BALANCE', 'CELL_SIGNALING'],
    organs: ['GI'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_REUTERIN',
    name: 'Reuterin',
    categories: ['postbiotic', 'antimicrobial'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для противомикробной защиты',
    type: 'postbiotic'
  },
  {
    id: 'POST_BACTERIOCINS',
    name: 'Bacteriocins',
    categories: ['postbiotic', 'antimicrobial'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для противомикробной защиты',
    type: 'postbiotic'
  },
  {
    id: 'POST_MURAMYL_DIPEPTIDE',
    name: 'Muramyl Dipeptide',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['INNATE_IMMUNE_UP', 'CELL_SIGNALING'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_LTA',
    name: 'Lipoteichoic Acid',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Липотейхоевый кислотный комплекс',
    type: 'postbiotic'
  },
  {
    id: 'POST_PEPTIDOGLYCAN',
    name: 'Peptidoglycan Fragments',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_EXOPOLYSACCHARIDES',
    name: 'Exopolysaccharides (EPS)',
    categories: ['postbiotic', 'immune', 'GI'],
    mechanisms: ['EPS_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_GAMMA_AMINOBUTYRATE',
    name: 'GABA (Microbial)',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['GABA_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_SEROTONIN_MICROBIAL',
    name: 'Microbial Serotonin',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['SEROTONIN_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_DOPAMINE_MICROBIAL',
    name: 'Microbial Dopamine',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_INDOL_3_PROPIONATE',
    name: 'Indole‑3‑Propionate (IPA)',
    categories: ['postbiotic', 'antioxidant', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'GI_BARRIER_UP'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Постбиотик для защиты клеток от окислительного стресса, нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_INDOL_3_LACTATE',
    name: 'Indole‑3‑Lactate',
    categories: ['postbiotic', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION', 'GI_BALANCE'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_INDOL_3_ACETATE',
    name: 'Indole‑3‑Acetate',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_BARRIER_UP', 'IMMUNE_SIGNALING_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_UROLITHIN_A',
    name: 'Urolithin A',
    categories: ['postbiotic', 'mitochondria'],
    mechanisms: ['MITOPHAGY_UP', 'CELL_REPAIR'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'AGING',
    description: 'Постбиотик для работы митохондрий',
    type: 'postbiotic'
  },
  {
    id: 'POST_UROLITHIN_B',
    name: 'Urolithin B',
    categories: ['postbiotic', 'muscle'],
    mechanisms: ['ANABOLIC_SIGNALING', 'CELL_PROTECTION'],
    organs: ['MUSCLES'],
    deficiency: 'AGING',
    description: 'Постбиотик для мышц',
    type: 'postbiotic'
  },
  {
    id: 'POST_PSCFA',
    name: 'Propionate‑Succinate Complex',
    categories: ['postbiotic', 'GI', 'metabolism'],
    mechanisms: ['SCFA_UP', 'GLUCOSE_REGULATION'],
    organs: ['GI', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_SUCCINATE',
    name: 'Succinate',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['ENERGY_SIGNALING', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'DIABETES',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_PYRUVATE',
    name: 'Pyruvate',
    categories: ['postbiotic', 'energy'],
    mechanisms: ['ATP_UP', 'CELL_SIGNALING'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Постбиотик для энергетического обмена',
    type: 'postbiotic'
  },
  {
    id: 'POST_ACETOIN',
    name: 'Acetoin',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_DIACETYL',
    name: 'Diacetyl',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'ANTI_PATHOGEN'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_HYDROXYFATTY_ACIDS',
    name: 'Hydroxy Fatty Acids',
    categories: ['postbiotic', 'immune', 'skin'],
    mechanisms: ['ANTI_INFLAMMATION', 'SKIN_BARRIER'],
    organs: ['SKIN', 'IMMUNE_SYSTEM'],
    deficiency: 'ECZEMA',
    description: 'Постбиотик для иммунной системы, здоровья кожи',
    type: 'postbiotic'
  },
  {
    id: 'POST_CONJUGATED_LINOLEIC',
    name: 'Microbial CLA',
    categories: ['postbiotic', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'METABOLISM_UP'],
    organs: ['MUSCLES', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Постбиотик для жиросжигания',
    type: 'postbiotic'
  },
  {
    id: 'POST_SPHINGOLIPIDS',
    name: 'Sphingolipids (Microbial)',
    categories: ['postbiotic', 'skin', 'cell'],
    mechanisms: ['SKIN_BARRIER', 'CELL_SIGNALING'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'DRY_SKIN',
    description: 'Постбиотик для здоровья кожи, клеточного здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_BILE_ACID_DCA',
    name: 'Deoxycholic Acid (DCA)',
    categories: ['postbiotic', 'GI', 'metabolism'],
    mechanisms: ['BILE_ACID_SIGNALING', 'FAT_METABOLISM'],
    organs: ['LIVER', 'GI'],
    deficiency: 'IBD',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_BILE_ACID_LCA',
    name: 'Lithocholic Acid (LCA)',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['BILE_ACID_SIGNALING', 'IMMUNE_MOD'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_BILE_ACID_UDCA',
    name: 'Microbial UDCA',
    categories: ['postbiotic', 'liver', 'GI'],
    mechanisms: ['BILE_FLOW_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'GI'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Постбиотик для функции печени',
    type: 'postbiotic'
  },
  {
    id: 'POST_POLYPHENOL_METABOLITES',
    name: 'Polyphenol Metabolites',
    categories: ['postbiotic', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_SHORTCHAIN_AMINES',
    name: 'Short‑Chain Amines',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_SIGNALING', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_PEPTIDES_ANTIMICROBIAL',
    name: 'Antimicrobial Peptides',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_PEPTIDES_IMMUNE',
    name: 'Immune‑Modulating Peptides',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IMMUNE_SIGNALING_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_PEPTIDES_GI_REPAIR',
    name: 'GI‑Repair Peptides',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['GI_REPAIR', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_AMINO_ACID_DERIVATIVES',
    name: 'Amino Acid Derivatives',
    categories: ['postbiotic', 'GI', 'immune'],
    mechanisms: ['GI_BALANCE', 'CELL_SIGNALING'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_NUCLEOTIDES',
    name: 'Nucleotides (Microbial)',
    categories: ['postbiotic', 'immune', 'GI'],
    mechanisms: ['IMMUNE_UP', 'GI_REPAIR'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_POLYSACCHARIDE_FRACTIONS',
    name: 'Polysaccharide Fractions',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IMMUNE_UP', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_FULL_POSTBIOTIC_COMPLEX',
    name: 'Full Spectrum Postbiotic Complex',
    categories: ['postbiotic', 'multi'],
    mechanisms: ['SCFA_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_GABA',
    name: 'Microbial GABA Complex',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['GABA_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'ANXIETY',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_SEROTONIN',
    name: 'Microbial Serotonin Complex',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['SEROTONIN_UP', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Комплекс микробного серотонина',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_DOPAMINE',
    name: 'Microbial Dopamine Complex',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_TRYPTAMINE',
    name: 'Microbial Tryptamine',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'GI_BRAIN_AXIS'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_PHENETHYLAMINE',
    name: 'Microbial PEA',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['PEA_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'MOOD_ISSUES',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_IMMUNE_IL10',
    name: 'IL‑10 Inducing Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IL10_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_IMMUNE_IFN',
    name: 'Interferon‑Modulating Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IFN_MOD', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_IMMUNE_TREG',
    name: 'T‑Reg Activating Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['TREG_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_ANTIINFLAMMATORY_NF_KB',
    name: 'NF‑κB Blocking Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['NF_KB_BLOCK', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_ANTIINFLAMMATORY_COX2',
    name: 'COX‑2 Modulating Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['COX2_MOD', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_MUCIN_UP',
    name: 'Mucin‑Stimulating Metabolites',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['MUCIN_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_TIGHT_JUNCTION',
    name: 'Tight‑Junction Activators',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['TJ_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_ANTI_PATHOGEN',
    name: 'Anti‑Pathogen Metabolites',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['ANTI_PATHOGEN', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_UREASE_BLOCK',
    name: 'Urease‑Blocking Metabolites',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['UREASE_INHIBITION', 'ANTI_PATHOGEN'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_METABOLIC_AMPK',
    name: 'AMPK‑Activating Metabolites',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['AMPK_UP', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'DIABETES',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_METABOLIC_PPAR',
    name: 'PPAR‑Activating Metabolites',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['PPAR_UP', 'FAT_METABOLISM'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'OBESITY',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_METABOLIC_FGF21',
    name: 'FGF21‑Modulating Metabolites',
    categories: ['postbiotic', 'metabolism'],
    mechanisms: ['FGF21_UP', 'ENERGY_SIGNALING'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'OBESITY',
    description: 'Постбиотик для метаболизма',
    type: 'postbiotic'
  },
  {
    id: 'POST_ANTIOXIDANT_NRF2',
    name: 'Nrf2‑Activating Metabolites',
    categories: ['postbiotic', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Постбиотик для защиты клеток от окислительного стресса',
    type: 'postbiotic'
  },
  {
    id: 'POST_ANTIOXIDANT_GSH',
    name: 'Glutathione‑Boosting Metabolites',
    categories: ['postbiotic', 'antioxidant'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Постбиотик для защиты клеток от окислительного стресса',
    type: 'postbiotic'
  },
  {
    id: 'POST_LIVER_BILE_FLOW',
    name: 'Bile‑Flow Metabolites',
    categories: ['postbiotic', 'liver'],
    mechanisms: ['BILE_FLOW_UP', 'LIVER_REPAIR'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Постбиотик для функции печени',
    type: 'postbiotic'
  },
  {
    id: 'POST_LIVER_ANTI_FIBROSIS',
    name: 'Anti‑Fibrosis Metabolites',
    categories: ['postbiotic', 'liver'],
    mechanisms: ['FIBROSIS_DOWN', 'LIVER_REGEN'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Постбиотик для функции печени',
    type: 'postbiotic'
  },
  {
    id: 'POST_VESSEL_NO',
    name: 'NO‑Boosting Metabolites',
    categories: ['postbiotic', 'vascular'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'HIGH_BP',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_VESSEL_ANTI_CLOT',
    name: 'Anti‑Clotting Metabolites',
    categories: ['postbiotic', 'vascular'],
    mechanisms: ['ANTICOAGULATION', 'VESSEL_PROTECTION'],
    organs: ['VESSELS', 'HEART'],
    deficiency: 'CLOTTING',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_SKIN_CERAMIDE_UP',
    name: 'Ceramide‑Boosting Metabolites',
    categories: ['postbiotic', 'skin'],
    mechanisms: ['SKIN_BARRIER', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Постбиотик для здоровья кожи',
    type: 'postbiotic'
  },
  {
    id: 'POST_SKIN_COLLAGEN_UP',
    name: 'Collagen‑Stimulating Metabolites',
    categories: ['postbiotic', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Постбиотик для здоровья кожи',
    type: 'postbiotic'
  },
  {
    id: 'POST_SKIN_MELANIN_BALANCE',
    name: 'Melanin‑Balancing Metabolites',
    categories: ['postbiotic', 'skin'],
    mechanisms: ['MELANIN_MOD', 'SKIN_PROTECTION'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Постбиотик для здоровья кожи',
    type: 'postbiotic'
  },
  {
    id: 'POST_HORMONE_ESTROGEN_MOD',
    name: 'Estrogen‑Modulating Metabolites',
    categories: ['postbiotic', 'hormone'],
    mechanisms: ['ESTROGEN_MOD', 'CELL_SIGNALING'],
    organs: ['HORMONES', 'BONES'],
    deficiency: 'MENOPAUSE',
    description: 'Эстроген‑модулирующие метаболиты',
    type: 'postbiotic'
  },
  {
    id: 'POST_HORMONE_ANDROGEN_MOD',
    name: 'Androgen‑Modulating Metabolites',
    categories: ['postbiotic', 'hormone'],
    mechanisms: ['ANDROGEN_MOD', 'CELL_SIGNALING'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Андроген‑модулирующие метаболиты',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_BDNF_UP',
    name: 'BDNF‑Boosting Metabolites',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEURO_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_NEURO_NGF_UP',
    name: 'NGF‑Boosting Metabolites',
    categories: ['postbiotic', 'neuro'],
    mechanisms: ['NGF_UP', 'NEURO_REGEN'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Постбиотик для нервной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_IMMUNE_IGA',
    name: 'IgA‑Boosting Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['IGA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_IMMUNE_ANTIVIRAL',
    name: 'Antiviral Metabolites',
    categories: ['postbiotic', 'immune'],
    mechanisms: ['ANTIVIRAL', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Постбиотик для иммунной системы',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_MOTILITY_UP',
    name: 'GI‑Motility Metabolites',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['MOTILITY_UP', 'GI_BALANCE'],
    organs: ['GI'],
    deficiency: 'CONSTIPATION',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_GI_ANTI_SPASM',
    name: 'Anti‑Spasm Metabolites',
    categories: ['postbiotic', 'GI'],
    mechanisms: ['SMOOTH_MUSCLE_MOD', 'GI_SOOTHING'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Постбиотик для поддержки обменных процессов и здоровья',
    type: 'postbiotic'
  },
  {
    id: 'POST_METABOLIC_KETONE',
    name: 'Ketone‑Producing Metabolites',
    categories: ['postbiotic', 'energy'],
    mechanisms: ['KETONE_UP', 'ATP_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'KETO',
    description: 'Постбиотик для энергетического обмена',
    type: 'postbiotic'
  },
  {
    id: 'POST_UREMIC_TOXIN_BLOCK',
    name: 'Uremic‑Toxin Blocking Metabolites',
    categories: ['postbiotic', 'detox'],
    mechanisms: ['TOXIN_BINDING', 'CELL_PROTECTION'],
    organs: ['KIDNEYS', 'GI'],
    deficiency: 'UREMIC_RISK',
    description: 'Блокаторы уремических токсинов',
    type: 'postbiotic'
  },
  {
    id: 'POST_AMINO_ACID_SIGNAL',
    name: 'Amino‑Acid Signaling Metabolites',
    categories: ['postbiotic', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'ANABOLIC_SIGNALING'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислотные сигнальные метаболиты',
    type: 'postbiotic'
  },
  {
    id: 'POST_POLYPHENOL_SYNERGY',
    name: 'Polyphenol‑Microbiome Synergy Metabolites',
    categories: ['postbiotic', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Синергия полифенолов и микробиоты',
    type: 'postbiotic'
  },
  {
    id: 'POST_FULL_POSTBIOTIC_PREMIUM',
    name: 'Full Spectrum Postbiotic Premium',
    categories: ['postbiotic', 'multi'],
    mechanisms: ['SCFA_UP', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'DYSBIOSIS',
    description: 'Премиальный комплекс постбиотиков',
    type: 'postbiotic'
  },
  {
    id: 'AA_LEUCINE',
    name: 'Leucine',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'PROTEIN_SYNTHESIS'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_ISOLEUCINE',
    name: 'Isoleucine',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['GLUCOSE_UP', 'MUSCLE_FUEL'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_VALINE',
    name: 'Valine',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['MUSCLE_FUEL', 'ANTI_FATIGUE'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_LYSINE',
    name: 'Lysine',
    categories: ['aminoacid', 'immune'],
    mechanisms: ['COLLAGEN_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_LYSINE',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_METHIONINE',
    name: 'Methionine',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'LIVER_SUPPORT'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'LOW_METHIONINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_PHENYLALANINE',
    name: 'Phenylalanine',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'LOW_DOPA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_THREONINE',
    name: 'Threonine',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['MUCIN_UP', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_TRYPTOPHAN',
    name: 'Tryptophan',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['SEROTONIN_UP', 'SLEEP_UP'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_HISTIDINE',
    name: 'Histidine',
    categories: ['aminoacid', 'blood'],
    mechanisms: ['HEME_UP', 'CELL_PROTECTION'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Аминокислота, участвующая в кроветворения',
    type: 'aminoacid'
  },
  {
    id: 'AA_TAURINE',
    name: 'Taurine',
    categories: ['aminoacid', 'cardio', 'neuro'],
    mechanisms: ['CALMING', 'ELECTROLYTE_BALANCE'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в ССС, нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_CARNITINE',
    name: 'Carnitine',
    categories: ['aminoacid', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'MITO_UP'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в жиросжигания',
    type: 'aminoacid'
  },
  {
    id: 'AA_ACETYL_CARNITINE',
    name: 'Acetyl‑L‑Carnitine (ALCAR)',
    categories: ['aminoacid', 'neuro', 'mitochondria'],
    mechanisms: ['MITO_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в нервной системы, работы митохондрий',
    type: 'aminoacid'
  },
  {
    id: 'AA_PROPIONYL_CARNITINE',
    name: 'Propionyl‑L‑Carnitine',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'VESSEL_HEALTH'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_CITRULLINE',
    name: 'Citrulline',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'BLOOD_FLOW'],
    organs: ['MUSCLES', 'HEART'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_CITRULLINE_MALATE',
    name: 'Citrulline Malate',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['ATP_UP', 'NO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_ARGININE',
    name: 'Arginine',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'GROWTH_HORMONE_UP'],
    organs: ['VESSELS', 'MUSCLES'],
    deficiency: 'HIGH_BP',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_BETA_ALANINE',
    name: 'Beta‑Alanine',
    categories: ['aminoacid', 'performance'],
    mechanisms: ['CARNOSINE_UP', 'ANTI_FATIGUE'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в производительности',
    type: 'aminoacid'
  },
  {
    id: 'AA_CARNOSINE',
    name: 'Carnosine',
    categories: ['aminoacid', 'antiaging', 'muscle'],
    mechanisms: ['CELL_PROTECTION', 'GLYCATION_DOWN'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в антивозрастных процессов, мышц',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLYCINE',
    name: 'Glycine',
    categories: ['aminoacid', 'calming', 'GI'],
    mechanisms: ['GABA_UP', 'COLLAGEN_UP'],
    organs: ['BRAIN', 'SKIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_SERINE',
    name: 'Serine',
    categories: ['aminoacid', 'brain', 'cell'],
    mechanisms: ['PHOSPHOLIPID_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в работы мозга, клеточного здоровья',
    type: 'aminoacid'
  },
  {
    id: 'AA_PROLINE',
    name: 'Proline',
    categories: ['aminoacid', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_ALANINE',
    name: 'Alanine',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['GLUCOSE_REGULATION', 'MUSCLE_FUEL'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_ASPARAGINE',
    name: 'Asparagine',
    categories: ['aminoacid', 'cell'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'aminoacid'
  },
  {
    id: 'AA_ASPARTATE',
    name: 'Aspartate',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['ATP_UP', 'CELL_SIGNALING'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUTAMATE',
    name: 'Glutamate',
    categories: ['aminoacid', 'brain'],
    mechanisms: ['NEURO_SIGNALING', 'ENERGY_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в работы мозга',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUAMINE',
    name: 'Glutamine',
    categories: ['aminoacid', 'GI', 'immune'],
    mechanisms: ['GI_REPAIR', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUAMINE_PEPTIDE',
    name: 'Glutamine Peptides',
    categories: ['aminoacid', 'GI', 'muscle'],
    mechanisms: ['GI_REPAIR', 'PROTEIN_SYNTHESIS'],
    organs: ['GI', 'MUSCLES'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в мышц',
    type: 'aminoacid'
  },
  {
    id: 'AA_HMB',
    name: 'HMB (β‑Hydroxy‑β‑Methylbutyrate)',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['ANTI_CATABOLIC', 'MTOR_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HICA',
    name: 'HICA (Leucic Acid)',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['ANTI_CATABOLIC', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_BCAA_COMPLEX',
    name: 'BCAA Complex',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'ANTI_FATIGUE'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_EAA_COMPLEX',
    name: 'EAA Complex',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_CYSTEINE',
    name: 'Cysteine',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_NAC',
    name: 'N‑Acetyl‑Cysteine',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'LUNGS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_TYROSINE',
    name: 'Tyrosine',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'THYROID_SUPPORT'],
    organs: ['BRAIN', 'THYROID'],
    deficiency: 'LOW_DOPA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_L_DOPA',
    name: 'L‑DOPA (Mucuna)',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'PARKINSON',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_BETAINE',
    name: 'Betaine (TMG)',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_DOWN'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_HOMOCYSTEINE_MOD',
    name: 'Homocysteine Modulators',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['HOMOCYSTEINE_DOWN', 'METHYL_UP'],
    organs: ['BLOOD', 'HEART'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_ORNITHINE',
    name: 'Ornithine',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['UREA_CYCLE_UP', 'AMMONIA_CLEARANCE'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_CITRULLINE_ORNITHINE',
    name: 'Citrulline + Ornithine',
    categories: ['aminoacid', 'detox', 'energy'],
    mechanisms: ['UREA_CYCLE_UP', 'ATP_UP'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в детоксикации, энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_THEANINE',
    name: 'L‑Theanine',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['GABA_UP', 'ALPHA_WAVES_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_HISTIDINE_BETA',
    name: 'Histidine Beta‑Complex',
    categories: ['aminoacid', 'blood'],
    mechanisms: ['HEME_UP', 'CELL_PROTECTION'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Аминокислота, участвующая в кроветворения',
    type: 'aminoacid'
  },
  {
    id: 'AA_SULFUR_AMINO',
    name: 'Sulfur Amino Acids',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'METHYLATION_UP'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_COLLAGEN_AMINOS',
    name: 'Collagen Amino Complex',
    categories: ['aminoacid', 'skin', 'joint'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи, суставов',
    type: 'aminoacid'
  },
  {
    id: 'AA_NEURO_AMINO',
    name: 'Neuro Amino Complex',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'NEURO_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_FULL_AMINO_PREMIUM',
    name: 'Full Spectrum Amino Premium',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'RECOVERY_UP'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Премиальный спектр аминокислот',
    type: 'aminoacid'
  },
  {
    id: 'AA_D_ASPARTIC_ACID',
    name: 'D-Aspartic Acid',
    categories: ['aminoacid', 'hormone'],
    mechanisms: ['TESTOSTERONE_UP', 'LH_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Аминокислота, участвующая в гормонального баланса',
    type: 'aminoacid'
  },
  {
    id: 'AA_D_SERINE',
    name: 'D-Serine',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NMDA_MOD', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_D_ALANINE',
    name: 'D-Alanine',
    categories: ['aminoacid', 'cell'],
    mechanisms: ['ENERGY_UP', 'CELL_SIGNALING'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в клеточного здоровья',
    type: 'aminoacid'
  },
  {
    id: 'AA_GABA',
    name: 'GABA (Amino Acid)',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['GABA_UP', 'RELAXATION'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_GABA_ENHANCED',
    name: 'GABA Enhanced Complex',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['GABA_UP', 'ALPHA_WAVES_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_L_DOPA_PRECURSOR',
    name: 'L-DOPA Precursor Blend',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'PARKINSON',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_HYDROXYPROLINE',
    name: 'Hydroxyproline',
    categories: ['aminoacid', 'skin', 'joint'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи, суставов',
    type: 'aminoacid'
  },
  {
    id: 'AA_HYDROXYLYSINE',
    name: 'Hydroxylysine',
    categories: ['aminoacid', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_SARCOSINE',
    name: 'Sarcosine',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NMDA_MOD', 'COGNITION_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_BETAINE_HCL',
    name: 'Betaine HCl',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['STOMACH_ACID_UP', 'DIGESTION_UP'],
    organs: ['GI'],
    deficiency: 'LOW_ACID',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_ORNITHINE_ASPARTATE',
    name: 'Ornithine Aspartate',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['AMMONIA_CLEARANCE', 'LIVER_SUPPORT'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_ARGININE_AKG',
    name: 'Arginine AKG',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_CITRULLINE_PEPTIDE',
    name: 'Citrulline Peptides',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLYCINE_BETAINE',
    name: 'Glycine Betaine Complex',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_DOWN'],
    organs: ['BLOOD', 'HEART'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLYCINE_MAGNESIUM',
    name: 'Glycine Magnesium Chelate',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['MAGNESIUM_UP', 'GABA_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_TAURINE_PREMIUM',
    name: 'Taurine Premium',
    categories: ['aminoacid', 'cardio', 'neuro'],
    mechanisms: ['CALMING', 'ELECTROLYTE_BALANCE'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в ССС, нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_CARNITINE_L_TARTRATE',
    name: 'L-Carnitine L-Tartrate',
    categories: ['aminoacid', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в жиросжигания',
    type: 'aminoacid'
  },
  {
    id: 'AA_CARNITINE_FUMARATE',
    name: 'L-Carnitine Fumarate',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_ALCAR_ARG',
    name: 'ALCAR + Arginine',
    categories: ['aminoacid', 'neuro', 'vascular'],
    mechanisms: ['MITO_UP', 'NO_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUAMINE_SYNERGY',
    name: 'Glutamine Synergy Complex',
    categories: ['aminoacid', 'GI', 'immune'],
    mechanisms: ['GI_REPAIR', 'IMMUNE_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUAMIC_ACID',
    name: 'Glutamic Acid',
    categories: ['aminoacid', 'brain'],
    mechanisms: ['NEURO_SIGNALING', 'ENERGY_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в работы мозга',
    type: 'aminoacid'
  },
  {
    id: 'AA_ASPARTIC_ACID',
    name: 'Aspartic Acid',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['ATP_UP', 'CELL_SIGNALING'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_HISTAMINE_PRECURSOR',
    name: 'Histamine Precursor Complex',
    categories: ['aminoacid', 'immune'],
    mechanisms: ['HISTAMINE_UP', 'IMMUNE_SIGNALING'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_CYSTINE',
    name: 'Cystine',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_SELENOMETHIONINE',
    name: 'Selenomethionine',
    categories: ['aminoacid', 'antioxidant'],
    mechanisms: ['GPX_UP', 'THYROID_SUPPORT'],
    organs: ['THYROID', 'LIVER'],
    deficiency: 'LOW_SELEN',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'aminoacid'
  },
  {
    id: 'AA_METHYL_METHIONINE',
    name: 'Methyl-Methionine (Vitamin U)',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['GI_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'ULCER',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HOMOCYSTEINE_BLOCK',
    name: 'Homocysteine Block Complex',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['HOMOCYSTEINE_DOWN', 'METHYL_UP'],
    organs: ['BLOOD', 'HEART'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUCOSE_AMINO',
    name: 'Glucose-Regulating Aminos',
    categories: ['aminoacid', 'metabolism'],
    mechanisms: ['GLUCOSE_REGULATION', 'INSULIN_SENSITIVITY'],
    organs: ['LIVER', 'PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Аминокислота, участвующая в метаболизма',
    type: 'aminoacid'
  },
  {
    id: 'AA_NEURO_TRANSMITTER_AMINOS',
    name: 'Neurotransmitter Amino Complex',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'NEURO_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Нейротрансмиттерные аминокислоты',
    type: 'aminoacid'
  },
  {
    id: 'AA_THYROID_AMINO',
    name: 'Thyroid Amino Complex',
    categories: ['aminoacid', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID', 'CELLS'],
    deficiency: 'HYPOTHYROID',
    description: 'Аминокислота, участвующая в гормонального баланса',
    type: 'aminoacid'
  },
  {
    id: 'AA_ADRENAL_AMINO',
    name: 'Adrenal Amino Complex',
    categories: ['aminoacid', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'CORTISOL_MOD'],
    organs: ['ADRENALS'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в гормонального баланса',
    type: 'aminoacid'
  },
  {
    id: 'AA_LIVER_AMINO',
    name: 'Liver Amino Complex',
    categories: ['aminoacid', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Аминокислота, участвующая в функции печени',
    type: 'aminoacid'
  },
  {
    id: 'AA_KIDNEY_AMINO',
    name: 'Kidney Amino Complex',
    categories: ['aminoacid', 'kidney'],
    mechanisms: ['UREA_CYCLE_UP', 'CELL_PROTECTION'],
    organs: ['KIDNEYS'],
    deficiency: 'UREMIC_RISK',
    description: 'Аминокислота, участвующая в почек',
    type: 'aminoacid'
  },
  {
    id: 'AA_HEART_AMINO',
    name: 'Heart Amino Complex',
    categories: ['aminoacid', 'cardio'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Аминокислота, участвующая в ССС',
    type: 'aminoacid'
  },
  {
    id: 'AA_BRAIN_AMINO',
    name: 'Brain Amino Complex',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_SKIN_AMINO',
    name: 'Skin Amino Complex',
    categories: ['aminoacid', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_JOINT_AMINO',
    name: 'Joint Amino Complex',
    categories: ['aminoacid', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Аминокислота, участвующая в суставов',
    type: 'aminoacid'
  },
  {
    id: 'AA_GUT_AMINO',
    name: 'Gut Amino Complex',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['GI_REPAIR', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_MITO_AMINO',
    name: 'Mitochondrial Amino Complex',
    categories: ['aminoacid', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'aminoacid'
  },
  {
    id: 'AA_ANTIAGING_AMINO',
    name: 'Anti-Aging Amino Complex',
    categories: ['aminoacid', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в антивозрастных процессов',
    type: 'aminoacid'
  },
  {
    id: 'AA_ANTIOX_AMINO',
    name: 'Antioxidant Amino Complex',
    categories: ['aminoacid', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'aminoacid'
  },
  {
    id: 'AA_IMMUNE_AMINO',
    name: 'Immune Amino Complex',
    categories: ['aminoacid', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_HORMONE_AMINO',
    name: 'Hormone Amino Complex',
    categories: ['aminoacid', 'hormone'],
    mechanisms: ['HORMONE_BALANCE', 'CELL_SIGNALING'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Аминокислота, участвующая в гормонального баланса',
    type: 'aminoacid'
  },
  {
    id: 'AA_FULL_AMINO_COMPLEX',
    name: 'Full Spectrum Amino Complex',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'RECOVERY_UP'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_FULL_AMINO_PREMIUM2',
    name: 'Full Spectrum Amino Premium II',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'CELL_REPAIR'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_ALPHA_KETOGLUTARATE',
    name: 'Alpha-Ketoglutarate',
    categories: ['aminoacid', 'mitochondria'],
    mechanisms: ['ATP_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в работы митохондрий',
    type: 'aminoacid'
  },
  {
    id: 'AA_CALCIUM_AKG',
    name: 'Calcium AKG',
    categories: ['aminoacid', 'antiaging'],
    mechanisms: ['MTOR_MOD', 'MITO_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в антивозрастных процессов',
    type: 'aminoacid'
  },
  {
    id: 'AA_ARG_AKG',
    name: 'Arginine Alpha-Ketoglutarate',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLYCINE_AKG',
    name: 'Glycine AKG',
    categories: ['aminoacid', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'MITO_UP'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в антивозрастных процессов',
    type: 'aminoacid'
  },
  {
    id: 'AA_LYSINE_AKG',
    name: 'Lysine AKG',
    categories: ['aminoacid', 'bone'],
    mechanisms: ['COLLAGEN_UP', 'BONE_STRENGTH'],
    organs: ['BONES'],
    deficiency: 'OSTEOPENIA',
    description: 'Аминокислота, участвующая в костной ткани',
    type: 'aminoacid'
  },
  {
    id: 'AA_HMB_FREE',
    name: 'HMB Free Acid',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'ANTI_CATABOLIC'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HMB_CA',
    name: 'HMB Calcium Salt',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_EAA_PREMIUM',
    name: 'EAA Premium Complex',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'DEFICIENCY',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_BCAA_411',
    name: 'BCAA 4:1:1',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'ANTI_FATIGUE'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_BCAA_811',
    name: 'BCAA 8:1:1',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HISTIDINE_PREMIUM',
    name: 'Histidine Premium',
    categories: ['aminoacid', 'blood'],
    mechanisms: ['HEME_UP', 'CELL_PROTECTION'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Аминокислота, участвующая в кроветворения',
    type: 'aminoacid'
  },
  {
    id: 'AA_TYROSINE_PREMIUM',
    name: 'Tyrosine Premium',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'THYROID_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'LOW_DOPA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_TRYPTOPHAN_PREMIUM',
    name: 'Tryptophan Premium',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['SEROTONIN_UP', 'SLEEP_UP'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_THEANINE_PREMIUM',
    name: 'Theanine Premium',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['GABA_UP', 'ALPHA_WAVES_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_GABA_PURE',
    name: 'Pure GABA',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['GABA_UP', 'RELAXATION'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_GABA_LIPOSOMAL',
    name: 'Liposomal GABA',
    categories: ['aminoacid', 'calming'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'GABA_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения',
    type: 'aminoacid'
  },
  {
    id: 'AA_CARNITINE_SYNERGY',
    name: 'Carnitine Synergy Complex',
    categories: ['aminoacid', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'MITO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в жиросжигания',
    type: 'aminoacid'
  },
  {
    id: 'AA_TAURINE_SYNERGY',
    name: 'Taurine Synergy Complex',
    categories: ['aminoacid', 'cardio', 'neuro'],
    mechanisms: ['CALMING', 'ELECTROLYTE_BALANCE'],
    organs: ['HEART', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в ССС, нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_CYSTEINE_PREMIUM',
    name: 'Cysteine Premium',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'CELL_PROTECTION'],
    organs: ['LIVER', 'CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_NAC_PREMIUM',
    name: 'NAC Premium',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['GLUTATHIONE_UP', 'ANTI_INFLAMMATION'],
    organs: ['LIVER', 'LUNGS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_METHIONINE_PREMIUM',
    name: 'Methionine Premium',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_DOWN'],
    organs: ['LIVER', 'BLOOD'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_BETAINE_PREMIUM',
    name: 'Betaine TMG Premium',
    categories: ['aminoacid', 'methylation'],
    mechanisms: ['METHYL_DONOR', 'HOMOCYSTEINE_DOWN'],
    organs: ['BLOOD', 'HEART'],
    deficiency: 'HIGH_HOMOCYSTEINE',
    description: 'Аминокислота, участвующая в метилирования',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLYCINE_PREMIUM',
    name: 'Glycine Premium',
    categories: ['aminoacid', 'calming', 'skin'],
    mechanisms: ['GABA_UP', 'COLLAGEN_UP'],
    organs: ['BRAIN', 'SKIN'],
    deficiency: 'STRESS',
    description: 'Аминокислота, участвующая в успокоения, здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_PROLINE_PREMIUM',
    name: 'Proline Premium',
    categories: ['aminoacid', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_SERINE_PREMIUM',
    name: 'Serine Premium',
    categories: ['aminoacid', 'brain'],
    mechanisms: ['PHOSPHOLIPID_UP', 'NEURO_SUPPORT'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в работы мозга',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUTAMINE_LIPOSOMAL',
    name: 'Liposomal Glutamine',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['LIPOSOMAL_DELIVERY', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_GLUTAMINE_PREMIUM',
    name: 'Glutamine Premium',
    categories: ['aminoacid', 'GI', 'immune'],
    mechanisms: ['GI_REPAIR', 'IMMUNE_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_ASPARTATE_PREMIUM',
    name: 'Aspartate Premium',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['ATP_UP', 'CELL_SIGNALING'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_ALANINE_PREMIUM',
    name: 'Alanine Premium',
    categories: ['aminoacid', 'energy'],
    mechanisms: ['GLUCOSE_REGULATION', 'MUSCLE_FUEL'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в энергетического обмена',
    type: 'aminoacid'
  },
  {
    id: 'AA_ORNITHINE_PREMIUM',
    name: 'Ornithine Premium',
    categories: ['aminoacid', 'detox'],
    mechanisms: ['UREA_CYCLE_UP', 'AMMONIA_CLEARANCE'],
    organs: ['LIVER'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в детоксикации',
    type: 'aminoacid'
  },
  {
    id: 'AA_ARGININE_PREMIUM',
    name: 'Arginine Premium',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'BLOOD_FLOW'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_CITRULLINE_PREMIUM',
    name: 'Citrulline Premium',
    categories: ['aminoacid', 'vascular'],
    mechanisms: ['NO_UP', 'ATP_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HICA_PREMIUM',
    name: 'HICA Premium',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['ANTI_CATABOLIC', 'RECOVERY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_HMB_SYNERGY',
    name: 'HMB Synergy Complex',
    categories: ['aminoacid', 'anabolic'],
    mechanisms: ['MTOR_UP', 'ANTI_CATABOLIC'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_NEURO_AMINO_PREMIUM',
    name: 'Neuro Amino Premium',
    categories: ['aminoacid', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Аминокислота, участвующая в нервной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_MITO_AMINO_PREMIUM',
    name: 'Mito Amino Premium',
    categories: ['aminoacid', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Премиальный митохондриальный комплекс',
    type: 'aminoacid'
  },
  {
    id: 'AA_ANTIAGING_AMINO_PREMIUM',
    name: 'Anti-Aging Amino Premium',
    categories: ['aminoacid', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в антивозрастных процессов',
    type: 'aminoacid'
  },
  {
    id: 'AA_ANTIOX_AMINO_PREMIUM',
    name: 'Antioxidant Amino Premium',
    categories: ['aminoacid', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Аминокислота, участвующая в защиты клеток от окислительного стресса',
    type: 'aminoacid'
  },
  {
    id: 'AA_IMMUNE_AMINO_PREMIUM',
    name: 'Immune Amino Premium',
    categories: ['aminoacid', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Аминокислота, участвующая в иммунной системы',
    type: 'aminoacid'
  },
  {
    id: 'AA_HORMONE_AMINO_PREMIUM',
    name: 'Hormone Amino Premium',
    categories: ['aminoacid', 'hormone'],
    mechanisms: ['HORMONE_BALANCE', 'CELL_SIGNALING'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Премиальный гормональный комплекс',
    type: 'aminoacid'
  },
  {
    id: 'AA_GUT_AMINO_PREMIUM',
    name: 'Gut Amino Premium',
    categories: ['aminoacid', 'GI'],
    mechanisms: ['GI_REPAIR', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_JOINT_AMINO_PREMIUM',
    name: 'Joint Amino Premium',
    categories: ['aminoacid', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Премиальный суставной комплекс',
    type: 'aminoacid'
  },
  {
    id: 'AA_SKIN_AMINO_PREMIUM',
    name: 'Skin Amino Premium',
    categories: ['aminoacid', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Аминокислота, участвующая в здоровья кожи',
    type: 'aminoacid'
  },
  {
    id: 'AA_FULL_AMINO_ULTRA',
    name: 'Full Spectrum Amino Ultra',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'CELL_REPAIR'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Аминокислота, участвующая в синтезе белка и метаболических процессах',
    type: 'aminoacid'
  },
  {
    id: 'AA_FULL_AMINO_SYNERGY',
    name: 'Full Spectrum Amino Synergy',
    categories: ['aminoacid', 'multi'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'RECOVERY_UP'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'DEFICIENCY',
    description: 'Синергия полного спектра аминокислот',
    type: 'aminoacid'
  },
  {
    id: 'PEP_COLLAGEN_TYPE1',
    name: 'Collagen Peptide Type I',
    categories: ['peptide', 'skin', 'joint'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_COLLAGEN_TYPE2',
    name: 'Collagen Peptide Type II',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_COLLAGEN_TYPE3',
    name: 'Collagen Peptide Type III',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_ELASTICITY'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ELASTIN',
    name: 'Elastin Peptides',
    categories: ['peptide', 'skin'],
    mechanisms: ['ELASTIN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_KERATIN',
    name: 'Keratine Peptides',
    categories: ['peptide', 'hair', 'skin'],
    mechanisms: ['HAIR_STRENGTH', 'SKIN_BARRIER'],
    organs: ['HAIR', 'SKIN'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос, здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_SILK',
    name: 'Silk Peptides',
    categories: ['peptide', 'skin', 'hair'],
    mechanisms: ['SKIN_REPAIR', 'HAIR_STRENGTH'],
    organs: ['SKIN', 'HAIR'],
    deficiency: 'DRY_SKIN',
    description: 'Пептид для здоровья кожи, здоровья волос',
    type: 'peptide'
  },
  {
    id: 'PEP_BIOACTIVE_COLLAGEN',
    name: 'Bioactive Collagen Peptides',
    categories: ['peptide', 'skin', 'joint'],
    mechanisms: ['COLLAGEN_UP', 'CARTILAGE_UP'],
    organs: ['SKIN', 'JOINTS'],
    deficiency: 'AGING',
    description: 'Биоактивные коллагеновые пептиды',
    type: 'peptide'
  },
  {
    id: 'PEP_GHK_CU',
    name: 'GHK‑Cu',
    categories: ['peptide', 'skin', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'WOUND_HEALING'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_GHK',
    name: 'GHK Peptide',
    categories: ['peptide', 'skin', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_ACETYL_HEXAPEPTIDE8',
    name: 'Acetyl Hexapeptide‑8',
    categories: ['peptide', 'skin'],
    mechanisms: ['WRINKLE_REDUCTION', 'MUSCLE_RELAX'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_PALMITOYL_PENTAPEPTIDE4',
    name: 'Palmitoyl Pentapeptide‑4',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_PALMITOYL_TRIPEPTIDE1',
    name: 'Palmitoyl Tripeptide‑1',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REGEN'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_PALMITOYL_TETRAPEPTIDE7',
    name: 'Palmitoyl Tetrapeptide‑7',
    categories: ['peptide', 'skin'],
    mechanisms: ['ANTI_INFLAMMATION', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_COPPER_TRIPEPTIDE',
    name: 'Copper Tripeptide‑1',
    categories: ['peptide', 'skin', 'wound'],
    mechanisms: ['COLLAGEN_UP', 'WOUND_HEALING'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, заживления ран',
    type: 'peptide'
  },
  {
    id: 'PEP_BPC157',
    name: 'BPC‑157',
    categories: ['peptide', 'GI', 'joint'],
    mechanisms: ['GI_REPAIR', 'TENDON_HEALING'],
    organs: ['GI', 'JOINTS'],
    deficiency: 'INJURY',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_TB500',
    name: 'TB‑500 (Thymosin Beta‑4)',
    categories: ['peptide', 'repair', 'muscle'],
    mechanisms: ['REGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['MUSCLES', 'TENDONS'],
    deficiency: 'INJURY',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOSIN_ALPHA1',
    name: 'Thymosin Alpha‑1',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOSIN_BETA4',
    name: 'Thymosin Beta‑4',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MOTILIN',
    name: 'Pro-Motilin Peptide',
    categories: ['peptide', 'GI'],
    mechanisms: ['MOTILITY_UP', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'CONSTIPATION',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_GASTRIN',
    name: 'Gastrin Peptide',
    categories: ['peptide', 'GI'],
    mechanisms: ['STOMACH_ACID_UP', 'DIGESTION_UP'],
    organs: ['GI'],
    deficiency: 'LOW_ACID',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CCK',
    name: 'Cholecystokinin Peptide',
    categories: ['peptide', 'GI', 'metabolism'],
    mechanisms: ['BILE_FLOW_UP', 'SATIETY_UP'],
    organs: ['GI', 'LIVER'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_NEUROTENSIN',
    name: 'Neurotensin Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'PAIN_MOD'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SUBSTANCE_P',
    name: 'Substance P',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'PAIN_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_VIP',
    name: 'Vasoactive Intestinal Peptide (VIP)',
    categories: ['peptide', 'vascular', 'GI'],
    mechanisms: ['NO_UP', 'GI_REPAIR'],
    organs: ['VESSELS', 'GI'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_OXYTOCIN',
    name: 'Oxitocin Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['SOCIAL_BOND', 'STRESS_DOWN'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'STRESS',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANOTAN1',
    name: 'Melanotan‑1',
    categories: ['peptide', 'skin'],
    mechanisms: ['MELANIN_UP', 'SKIN_PROTECTION'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANOTAN2',
    name: 'Melanotan‑2',
    categories: ['peptide', 'skin', 'hormone'],
    mechanisms: ['MELANIN_UP', 'LIBIDO_UP'],
    organs: ['SKIN', 'HORMONES'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи, гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_PT141',
    name: 'PT‑141 (Bremelanotide)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['LIBIDO_UP', 'NEURO_SIGNALING'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_LIBIDO',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_CJC1295',
    name: 'CJC‑1295 (No DAC)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'IGF1_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_CJC1295_DAC',
    name: 'CJC‑1295 DAC',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'IGF1_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_IPAMORELIN',
    name: 'Ipamorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'GH_PULSE_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GHRP2',
    name: 'GHRP‑2',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'HUNGER_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GHRP6',
    name: 'GHRP‑6',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'HUNGER_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_FOLLISTATIN344',
    name: 'Follistatin‑344',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['MYOSTATIN_DOWN', 'MUSCLE_GROWTH'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FOLLISTATIN315',
    name: 'Follistatin‑315',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['MYOSTATIN_DOWN', 'CELL_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_KPV',
    name: 'KPV Tripeptide',
    categories: ['peptide', 'antiinflammatory'],
    mechanisms: ['NF_KB_BLOCK', 'ANTI_INFLAMMATION'],
    organs: ['GI', 'SKIN'],
    deficiency: 'INFLAMMATION',
    description: 'Пептид для противовоспалительной защиты',
    type: 'peptide'
  },
  {
    id: 'PEP_THYROID_TRH',
    name: 'TRH (Thyrotropin-Releasing Hormone)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROID',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_ADH',
    name: 'ADH (Vasopressin)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['WATER_BALANCE', 'BP_UP'],
    organs: ['KIDNEYS', 'VESSELS'],
    deficiency: 'LOW_BP',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_ANGIOTENSIN',
    name: 'Angiotensin Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['BP_UP', 'VASOCONSTRICTION'],
    organs: ['VESSELS'],
    deficiency: 'LOW_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_BRADYKININ',
    name: 'Bradykinin',
    categories: ['peptide', 'vascular'],
    mechanisms: ['NO_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_NEUROPEPTIDE_Y',
    name: 'Neuropeptide Y',
    categories: ['peptide', 'neuro'],
    mechanisms: ['APPETITE_UP', 'STRESS_UP'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_PACAP',
    name: 'PACAP Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_MOTIVATION_PEPTIDE',
    name: 'Motivation Peptide Complex',
    categories: ['peptide', 'neuro'],
    mechanisms: ['DOPAMINE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'LOW_MOTIVATION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SLEEP_PEPTIDE',
    name: 'Sleep Peptide Complex',
    categories: ['peptide', 'neuro'],
    mechanisms: ['SLEEP_UP', 'MELATONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PEPTIDE',
    name: 'Mitochondrial Peptide Complex',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Митохондриальный пептидный комплекс',
    type: 'peptide'
  },
  {
    id: 'PEP_IMMUNE_PEPTIDE',
    name: 'Immune Peptide Complex',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_PEPTIDE_COMPLEX',
    name: 'Full Spectrum Peptide Complex',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SEMAX',
    name: 'Semax',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SELANK',
    name: 'Selank',
    categories: ['peptide', 'neuro', 'anxiolytic'],
    mechanisms: ['GABA_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Пептид для нервной системы, снижения тревоги',
    type: 'peptide'
  },
  {
    id: 'PEP_DSIP',
    name: 'DSIP (Delta Sleep Peptide)',
    categories: ['peptide', 'sleep'],
    mechanisms: ['SLEEP_UP', 'CORTISOL_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Пептид для сна',
    type: 'peptide'
  },
  {
    id: 'PEP_P21',
    name: 'P21 Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_CELERGEN',
    name: 'Celergen Marine Peptides',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['CELL_REPAIR', 'COLLAGEN_UP'],
    organs: ['CELLS', 'SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MOTS_C',
    name: 'MOTS‑c',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'GLUCOSE_REGULATION'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_HUMANIN',
    name: 'Humanin',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['ANTI_APOPTOSIS', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_SS31',
    name: 'SS‑31 (Elamipretide)',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMULIN',
    name: 'Thymulin',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOPENTIN',
    name: 'Thymopentin',
    categories: ['peptide', 'immune'],
    mechanisms: ['T_CELL_UP', 'IMMUNE_REGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_LR3_IGF1',
    name: 'IGF‑1 LR3',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['IGF1_UP', 'MUSCLE_GROWTH'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_DES_IGF1',
    name: 'Des(1‑3) IGF‑1',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['IGF1_UP', 'CELL_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FOLLISTATIN_SYNERGY',
    name: 'Follistatin Synergy',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['MYOSTATIN_DOWN', 'MUSCLE_GROWTH'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MGF',
    name: 'MGF (Mechano Growth Factor)',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['MUSCLE_REPAIR', 'IGF1_UP'],
    organs: ['MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MGF_C',
    name: 'MGF C‑Terminal',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['MUSCLE_REPAIR', 'CELL_SIGNALING'],
    organs: ['MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_GONADORELIN',
    name: 'Gonadorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['LH_UP', 'FSH_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_KISSPEPTIN10',
    name: 'Kisspeptin‑10',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GNRH_UP', 'LH_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_LIBIDO',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_TRIPTORELIN',
    name: 'Triptorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GNRH_MOD', 'HORMONE_RESET'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GLP1',
    name: 'GLP‑1 Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['INSULIN_UP', 'APPETITE_DOWN'],
    organs: ['PANCREAS', 'BRAIN'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_GIP',
    name: 'GIP Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['INSULIN_MOD', 'GLUCOSE_REGULATION'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_OXYNTOMODULIN',
    name: 'Oxyntomodulin',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['APPETITE_DOWN', 'ENERGY_UP'],
    organs: ['BRAIN', 'GI'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_PYY',
    name: 'PYY Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['APPETITE_DOWN', 'GI_SIGNALING'],
    organs: ['GI', 'BRAIN'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_LEPTIN',
    name: 'Leptin Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['APPETITE_DOWN', 'ENERGY_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_ADIPONECTIN',
    name: 'Adiponectin Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['FAT_OXIDATION', 'INSULIN_SENSITIVITY'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANOCORTIN',
    name: 'Melanocortin Peptide',
    categories: ['peptide', 'hormone', 'neuro'],
    mechanisms: ['MELANIN_UP', 'LIBIDO_UP'],
    organs: ['BRAIN', 'SKIN'],
    deficiency: 'LOW_LIBIDO',
    description: 'Пептид для гормонального баланса, нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_GASTROINTESTINAL_REPAIR',
    name: 'GI Repair Peptide Complex',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIINFLAMMATORY_PEPTIDE',
    name: 'Anti‑Inflammatory Peptide Complex',
    categories: ['peptide', 'immune'],
    mechanisms: ['NF_KB_BLOCK', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Противовоспалительный пептидный комплекс',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIOXIDANT_PEPTIDE',
    name: 'Antioxidant Peptide Complex',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PEPTIDE_PREMIUM',
    name: 'Mito Peptide Premium',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_PEPTIDE_PREMIUM',
    name: 'Neuro Peptide Premium',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_PEPTIDE_PREMIUM',
    name: 'Skin Peptide Premium',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_JOINT_PEPTIDE_PREMIUM',
    name: 'Joint Peptide Premium',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_LIVER_PEPTIDE_PREMIUM',
    name: 'Liver Peptide Premium',
    categories: ['peptide', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Пептид для функции печени',
    type: 'peptide'
  },
  {
    id: 'PEP_HEART_PEPTIDE_PREMIUM',
    name: 'Heart Peptide Premium',
    categories: ['peptide', 'cardio'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для ССС',
    type: 'peptide'
  },
  {
    id: 'PEP_KIDNEY_PEPTIDE_PREMIUM',
    name: 'Kidney Peptide Premium',
    categories: ['peptide', 'kidney'],
    mechanisms: ['CELL_PROTECTION', 'UREA_CYCLE_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'UREMIC_RISK',
    description: 'Пептид для почек',
    type: 'peptide'
  },
  {
    id: 'PEP_ADRENAL_PEPTIDE_PREMIUM',
    name: 'Adrenal Peptide Premium',
    categories: ['peptide', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'CORTISOL_MOD'],
    organs: ['ADRENALS'],
    deficiency: 'STRESS',
    description: 'Премиальный надпочечниковый пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_THYROID_PEPTIDE_PREMIUM',
    name: 'Thyroid Peptide Premium',
    categories: ['peptide', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROID',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_BRAIN_PEPTIDE_COMPLEX',
    name: 'Brain Peptide Complex',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_PEPTIDE_PREMIUM',
    name: 'Full Spectrum Peptide Premium',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CIRCULATION_PEPTIDE',
    name: 'Circulation Peptide Complex',
    categories: ['peptide', 'vascular'],
    mechanisms: ['NO_UP', 'VESSEL_REPAIR'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_ELASTIN_COMPLEX',
    name: 'Skin Elastin Complex',
    categories: ['peptide', 'skin'],
    mechanisms: ['ELASTIN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_CARTILAGE_REPAIR_PEPTIDE',
    name: 'Cartilage Repair Peptide',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_TENDON_REPAIR_PEPTIDE',
    name: 'Tendon Repair Peptide',
    categories: ['peptide', 'tendon'],
    mechanisms: ['TENDON_HEALING', 'COLLAGEN_UP'],
    organs: ['TENDONS'],
    deficiency: 'INJURY',
    description: 'Пептид восстановления сухожилий',
    type: 'peptide'
  },
  {
    id: 'PEP_MUSCLE_REPAIR_PEPTIDE',
    name: 'Muscle Repair Peptide',
    categories: ['peptide', 'muscle'],
    mechanisms: ['MUSCLE_REPAIR', 'IGF1_UP'],
    organs: ['MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN_PEPTIDE',
    name: 'Full Regeneration Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CELLEX_GHK',
    name: 'CellEx GHK Complex',
    categories: ['peptide', 'skin', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'CELL_REPAIR'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_CELLEX_CU',
    name: 'CellEx Copper Peptide',
    categories: ['peptide', 'skin', 'repair'],
    mechanisms: ['COLLAGEN_UP', 'WOUND_HEALING'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_EYELASH_PEPTIDE',
    name: 'Eyelash Growth Peptide',
    categories: ['peptide', 'hair'],
    mechanisms: ['HAIR_FOLLICLE_UP', 'KERATIN_UP'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос',
    type: 'peptide'
  },
  {
    id: 'PEP_HAIR_GROWTH_PEPTIDE',
    name: 'Hair Growth Peptide',
    categories: ['peptide', 'hair'],
    mechanisms: ['HAIR_FOLLICLE_UP', 'ANTI_INFLAMMATION'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос',
    type: 'peptide'
  },
  {
    id: 'PEP_BIOTIN_PEPTIDE',
    name: 'Biotin Peptide Complex',
    categories: ['peptide', 'hair', 'skin'],
    mechanisms: ['HAIR_STRENGTH', 'SKIN_REPAIR'],
    organs: ['HAIR', 'SKIN'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос, здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_CARTILAGE_PEPTIDE',
    name: 'Cartilage Matrix Peptide',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_TENDON_MATRIX_PEPTIDE',
    name: 'Tendon Matrix Peptide',
    categories: ['peptide', 'tendon'],
    mechanisms: ['TENDON_HEALING', 'COLLAGEN_UP'],
    organs: ['TENDONS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_BONE_PEPTIDE',
    name: 'Bone Peptide Complex',
    categories: ['peptide', 'bone'],
    mechanisms: ['BONE_REGEN', 'COLLAGEN_UP'],
    organs: ['BONES'],
    deficiency: 'OSTEOPENIA',
    description: 'Пептид для костной ткани',
    type: 'peptide'
  },
  {
    id: 'PEP_CARTILAGE_SYNERGY',
    name: 'Cartilage Synergy Peptide',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMUS_PEPTIDE',
    name: 'Thymus Peptide Complex',
    categories: ['peptide', 'immune'],
    mechanisms: ['T_CELL_UP', 'IMMUNE_REGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SPLEEN_PEPTIDE',
    name: 'Spleen Peptide Complex',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_LIVER_PEPTIDE',
    name: 'Liver Peptide Complex',
    categories: ['peptide', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Пептид для функции печени',
    type: 'peptide'
  },
  {
    id: 'PEP_PANCREAS_PEPTIDE',
    name: 'Pancreas Peptide Complex',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['INSULIN_MOD', 'CELL_REPAIR'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_HEART_PEPTIDE',
    name: 'Heart Peptide Complex',
    categories: ['peptide', 'cardio'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для ССС',
    type: 'peptide'
  },
  {
    id: 'PEP_VESSEL_PEPTIDE',
    name: 'Vessel Peptide Complex',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VESSEL_REPAIR', 'NO_UP'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_LUNG_PEPTIDE',
    name: 'Lung Peptide Complex',
    categories: ['peptide', 'lung'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_REPAIR'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Пептид для легких',
    type: 'peptide'
  },
  {
    id: 'PEP_KIDNEY_PEPTIDE',
    name: 'Kidney Peptide Complex',
    categories: ['peptide', 'kidney'],
    mechanisms: ['CELL_PROTECTION', 'UREA_CYCLE_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'UREMIC_RISK',
    description: 'Пептид для почек',
    type: 'peptide'
  },
  {
    id: 'PEP_STOMACH_PEPTIDE',
    name: 'Stomach Peptide Complex',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_REPAIR', 'MUCIN_UP'],
    organs: ['GI'],
    deficiency: 'ULCER',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_INTESTINE_PEPTIDE',
    name: 'Intestine Peptide Complex',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_BRAIN_PEPTIDE',
    name: 'Brain Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_REPAIR_PEPTIDE',
    name: 'Neuro Repair Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'CELL_REPAIR'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_RETINA_PEPTIDE',
    name: 'Retina Peptide Complex',
    categories: ['peptide', 'eye'],
    mechanisms: ['RETINA_REPAIR', 'ANTIOXIDANT'],
    organs: ['EYES'],
    deficiency: 'VISION_LOSS',
    description: 'Пептид для зрения',
    type: 'peptide'
  },
  {
    id: 'PEP_PINEAL_PEPTIDE',
    name: 'Pineal Peptide Complex',
    categories: ['peptide', 'neuro', 'hormone'],
    mechanisms: ['MELATONIN_UP', 'SLEEP_UP'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'INSOMNIA',
    description: 'Пептид для нервной системы, гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_PITUITARY_PEPTIDE',
    name: 'Pituitary Peptide Complex',
    categories: ['peptide', 'hormone'],
    mechanisms: ['PITUITARY_UP', 'HORMONE_BALANCE'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_ADRENAL_PEPTIDE',
    name: 'Adrenal Cortex Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'CORTISOL_MOD'],
    organs: ['ADRENALS'],
    deficiency: 'STRESS',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_THYROID_PEPTIDE',
    name: 'Thyroid Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROID',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_OVARY_PEPTIDE',
    name: 'Ovary Peptide Complex',
    categories: ['peptide', 'hormone'],
    mechanisms: ['ESTROGEN_MOD', 'CELL_REPAIR'],
    organs: ['OVARIES'],
    deficiency: 'MENOPAUSE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_TESTIS_PEPTIDE',
    name: 'Testis Peptide Complex',
    categories: ['peptide', 'hormone'],
    mechanisms: ['TESTOSTERONE_UP', 'LH_UP'],
    organs: ['TESTES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_PROSTATE_PEPTIDE',
    name: 'Prostate Peptide Complex',
    categories: ['peptide', 'male'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_REPAIR'],
    organs: ['PROSTATE'],
    deficiency: 'BPH',
    description: 'Пептид для мужского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_UTERUS_PEPTIDE',
    name: 'Uterus Peptide Complex',
    categories: ['peptide', 'female'],
    mechanisms: ['ENDOMETRIUM_REPAIR', 'HORMONE_BALANCE'],
    organs: ['UTERUS'],
    deficiency: 'ENDOMETRIOSIS',
    description: 'Пептид для женского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_WHITENING_PEPTIDE',
    name: 'Skin Whitening Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['MELANIN_DOWN', 'SKIN_TONE'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_SCAR_PEPTIDE',
    name: 'Anti‑Scar Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['SCAR_REPAIR', 'COLLAGEN_MOD'],
    organs: ['SKIN'],
    deficiency: 'SCARS',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_WOUND_HEALING_PEPTIDE',
    name: 'Wound Healing Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['WOUND_HEALING', 'CELL_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'INJURY',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_ACNE_PEPTIDE',
    name: 'Anti‑Acne Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['ANTI_PATHOGEN', 'ANTI_INFLAMMATION'],
    organs: ['SKIN'],
    deficiency: 'ACNE',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_WRINKLE_PEPTIDE',
    name: 'Anti‑Wrinkle Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_PIGMENT_PEPTIDE',
    name: 'Anti‑Pigment Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['MELANIN_MOD', 'SKIN_TONE'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_REDNESS_PEPTIDE',
    name: 'Anti‑Redness Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['ANTI_INFLAMMATION', 'SKIN_BARRIER'],
    organs: ['SKIN'],
    deficiency: 'ROSACEA',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_GLYCATION_PEPTIDE',
    name: 'Anti‑Glycation Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['GLYCATION_DOWN', 'COLLAGEN_PROTECT'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_CELLULITE_PEPTIDE',
    name: 'Anti‑Cellulite Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['FAT_BREAKDOWN', 'CIRCULATION_UP'],
    organs: ['SKIN'],
    deficiency: 'CELLULITE',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_MUSCLE_GROWTH_PEPTIDE',
    name: 'Muscle Growth Peptide',
    categories: ['peptide', 'muscle'],
    mechanisms: ['IGF1_UP', 'MUSCLE_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_MUSCLE_ENDURANCE_PEPTIDE',
    name: 'Muscle Endurance Peptide',
    categories: ['peptide', 'muscle'],
    mechanisms: ['ATP_UP', 'MITO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_MUSCLE_FATLOSS_PEPTIDE',
    name: 'Muscle Fat‑Loss Peptide',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['FAT_OXIDATION', 'MITO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_ORGAN_PEPTIDE',
    name: 'Full Organ Peptide Complex',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REPAIR_PEPTIDE',
    name: 'Full Repair Peptide Complex',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_SIGNAL_PEPTIDE',
    name: 'Full Signal Peptide Complex',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'REGEN_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CEREBROLYSIN',
    name: 'Cerebrolysin Peptide Complex',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REPAIR', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_CORTEXIN',
    name: 'Cortexin Peptide Complex',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'NEURO_REGEN'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_RETINOLIN',
    name: 'Retinol Peptide Complex',
    categories: ['peptide', 'eye'],
    mechanisms: ['RETINA_REPAIR', 'ANTIOXIDANT'],
    organs: ['EYES'],
    deficiency: 'VISION_LOSS',
    description: 'Пептид для зрения',
    type: 'peptide'
  },
  {
    id: 'PEP_VENTFORT',
    name: 'Vein Peptide Complex',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VESSEL_REPAIR', 'NO_UP'],
    organs: ['VESSELS'],
    deficiency: 'VARICOSE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CARDIOGEN',
    name: 'Cardio Peptide Complex',
    categories: ['peptide', 'heart'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для здоровья сердца',
    type: 'peptide'
  },
  {
    id: 'PEP_ENDOLUTEN',
    name: 'Endoluten Peptide Complex',
    categories: ['peptide', 'pineal'],
    mechanisms: ['MELATONIN_UP', 'ANTIAGING'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SIGUMIR',
    name: 'Cartilage Peptide (Sigumir)',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_SUPREFORT',
    name: 'Pancreas Peptide (Suprefort)',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['INSULIN_MOD', 'CELL_REPAIR'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_VENTRAMIN',
    name: 'Stomach Peptide (Ventramin)',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_REPAIR', 'MUCIN_UP'],
    organs: ['GI'],
    deficiency: 'ULCER',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_TAXOREN',
    name: 'Liver Peptide (Taxoren)',
    categories: ['peptide', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Пептид для функции печени',
    type: 'peptide'
  },
  {
    id: 'PEP_CRYSTAGEN',
    name: 'Immune Peptide (Crystagen)',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYREOGEN',
    name: 'Thyroid Peptide (Thyreogen)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROID',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_BRONCHOGEN',
    name: 'Lung Peptide (Bronchogen)',
    categories: ['peptide', 'lung'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_REPAIR'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Пептид для легких',
    type: 'peptide'
  },
  {
    id: 'PEP_CHONDRAMIN',
    name: 'Joint Peptide (Chondramin)',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_GASTROGEN',
    name: 'GI Peptide (Gastrogen)',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_REPAIR', 'GI_BARRIER_UP'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_HEPATOGEN',
    name: 'Hepato Peptide',
    categories: ['peptide', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Пептид для функции печени',
    type: 'peptide'
  },
  {
    id: 'PEP_NEUROGEN',
    name: 'Neurogen Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_CARDIOGEN_PREMIUM',
    name: 'Cardiogen Premium',
    categories: ['peptide', 'heart'],
    mechanisms: ['NO_UP', 'VESSEL_REPAIR'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для здоровья сердца',
    type: 'peptide'
  },
  {
    id: 'PEP_VESSEL_PREMIUM',
    name: 'Vessel Peptide Premium',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VESSEL_REPAIR', 'NO_UP'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITOCHONDRIAL_SIGNAL',
    name: 'Mitochondrial Signaling Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_SIGNAL', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITOCHONDRIAL_REPAIR',
    name: 'Mitochondrial Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_CYTOKINE_BLOCKER',
    name: 'Cytokine Blocker Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['NF_KB_BLOCK', 'IL6_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_IL10_UP',
    name: 'IL‑10 Up Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['IL10_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_IGF1_SIGNAL',
    name: 'IGF‑1 Signaling Peptide',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['IGF1_UP', 'MUSCLE_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_GH_SIGNAL',
    name: 'Growth Hormone Signal Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'IGF1_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_ANGIOGENESIS_UP',
    name: 'Angiogenesis Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VEGF_UP', 'VESSEL_REPAIR'],
    organs: ['VESSELS'],
    deficiency: 'ISCHEMIA',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ANGIOGENESIS_DOWN',
    name: 'Anti‑Angiogenesis Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VEGF_DOWN', 'CELL_PROTECTION'],
    organs: ['VESSELS'],
    deficiency: 'CANCER_RISK',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_REGEN_PREMIUM',
    name: 'Skin Regen Premium',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_BARRIER_UP',
    name: 'Skin Barrier Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['SKIN_BARRIER', 'HYDRATION'],
    organs: ['SKIN'],
    deficiency: 'DRY_SKIN',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_HAIR_FOLLICLE_PREMIUM',
    name: 'Hair Follicle Premium',
    categories: ['peptide', 'hair'],
    mechanisms: ['HAIR_FOLLICLE_UP', 'KERATIN_UP'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Премиальный фолликулярный пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_NAIL_REPAIR_PEPTIDE',
    name: 'Nail Repair Peptide',
    categories: ['peptide', 'nails'],
    mechanisms: ['KERATIN_UP', 'CELL_REPAIR'],
    organs: ['NAILS'],
    deficiency: 'BRITTLE_NAILS',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CARTILAGE_PREMIUM',
    name: 'Cartilage Premium Peptide',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_TENDON_PREMIUM',
    name: 'Tendon Premium Peptide',
    categories: ['peptide', 'tendon'],
    mechanisms: ['TENDON_HEALING', 'COLLAGEN_UP'],
    organs: ['TENDONS'],
    deficiency: 'INJURY',
    description: 'Премиальный сухожильный пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_BONE_PREMIUM',
    name: 'Bone Premium Peptide',
    categories: ['peptide', 'bone'],
    mechanisms: ['BONE_REGEN', 'COLLAGEN_UP'],
    organs: ['BONES'],
    deficiency: 'OSTEOPENIA',
    description: 'Пептид для костной ткани',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_FULL',
    name: 'Full Organ Peptide Matrix',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SIGNALING_PREMIUM',
    name: 'Premium Signaling Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'REGEN_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_REGEN_PREMIUM',
    name: 'Premium Regeneration Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Премиальный регенеративный пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_PEPTIDE_ULTRA',
    name: 'Full Spectrum Peptide Ultra',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_PEPTIDE_SYNERGY',
    name: 'Full Peptide Synergy',
    categories: ['peptide', 'multi'],
    mechanisms: ['REGEN_UP', 'CELL_SIGNALING'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Синергия полного спектра пептидов',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_SYNERGY',
    name: 'Organ Peptide Synergy',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SYNERGY',
    name: 'Mito Peptide Synergy',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_SYNERGY',
    name: 'Neuro Peptide Synergy',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_IMMUNE_SYNERGY',
    name: 'Immune Peptide Synergy',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_HORMONE_SYNERGY',
    name: 'Hormone Peptide Synergy',
    categories: ['peptide', 'hormone'],
    mechanisms: ['HORMONE_BALANCE', 'CELL_SIGNALING'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Синергия гормональных пептидов',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REPAIR_ULTRA',
    name: 'Full Repair Ultra Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MELC',
    name: 'MelC Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'MOOD_UP'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NRF2_PEPTIDE',
    name: 'Nrf2 Activator Peptide',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['Nrf2_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_SIRT1_PEPTIDE',
    name: 'SIRT1 Activator Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_SIRT6_PEPTIDE',
    name: 'SIRT6 Activator Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SIRT6_UP', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_TELOMERASE_UP',
    name: 'Telomerase Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_DNA_REPAIR_PEPTIDE',
    name: 'DNA Repair Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['DNA_REPAIR', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_DYNAMICS',
    name: 'Mito Dynamics Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_FISSION', 'MITO_FUSION'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIOX',
    name: 'Mito Antioxidant Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_PROTECTION', 'ROS_DOWN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_ATP_SYNTHASE_UP',
    name: 'ATP Synthase Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['ATP_UP', 'MITO_UP'],
    organs: ['MUSCLES', 'CELLS'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_NAD_UP',
    name: 'NAD+ Booster Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['NAD_UP', 'MITO_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_NMN_SIGNAL',
    name: 'NMN Signaling Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['NAD_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_AMPK_UP',
    name: 'AMPK Activator Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['AMPK_UP', 'GLUCOSE_REGULATION'],
    organs: ['LIVER', 'MUSCLES'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_PPAR_DELTA',
    name: 'PPAR‑δ Peptide',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['PPAR_DELTA_UP', 'FAT_OXIDATION'],
    organs: ['MUSCLES'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_PPAR_GAMMA',
    name: 'PPAR‑γ Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['PPAR_GAMMA_MOD', 'INSULIN_SENSITIVITY'],
    organs: ['LIVER', 'PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_LEPTIN_SIGNAL',
    name: 'Leptin Signaling Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['LEPTIN_UP', 'APPETITE_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_ADIPONECTIN_SIGNAL',
    name: 'Adiponectin Signal Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['FAT_OXIDATION', 'INSULIN_SENSITIVITY'],
    organs: ['LIVER'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_GLUCOSE_SENSOR',
    name: 'Glucose Sensor Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['GLUCOSE_REGULATION', 'INSULIN_MOD'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_KETONE_UP',
    name: 'Endogenous Ketone Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['KETONE_UP', 'ATP_UP'],
    organs: ['BRAIN', 'MUSCLES'],
    deficiency: 'KETO',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_LIPOLYSIS_UP',
    name: 'Lipolysis Peptide',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['FAT_BREAKDOWN', 'MITO_UP'],
    organs: ['FAT'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_BROWN_FAT_UP',
    name: 'Brown Fat Activation Peptide',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['BAT_UP', 'THERMOGENESIS'],
    organs: ['FAT'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_APPETITE_BLOCK',
    name: 'Appetite Block Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['APPETITE_DOWN', 'GLUCOSE_REGULATION'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_GUT_BARRIER_UP',
    name: 'Gut Barrier Peptide',
    categories: ['peptide', 'GI'],
    mechanisms: ['GI_BARRIER_UP', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'LEAKY_GUT',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_GUT_MUCIN_UP',
    name: 'Gut Mucin Peptide',
    categories: ['peptide', 'GI'],
    mechanisms: ['MUCIN_UP', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'ULCER',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTI_PATHOGEN_PEPTIDE',
    name: 'Anti‑Pathogen Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_IGA_UP',
    name: 'IgA Boost Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['IGA_UP', 'GI_BARRIER_UP'],
    organs: ['GI', 'IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_TREG_UP',
    name: 'T‑Reg Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['TREG_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_IL6_BLOCK',
    name: 'IL‑6 Block Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['IL6_DOWN', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_TNF_BLOCK',
    name: 'TNF‑α Block Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['TNF_DOWN', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIVIRAL_PEPTIDE',
    name: 'Antiviral Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['ANTIVIRAL', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIBACTERIAL_PEPTIDE',
    name: 'Antibacterial Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['ANTI_PATHOGEN', 'CELL_PROTECTION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIFUNGAL_PEPTIDE',
    name: 'Antifungal Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['ANTI_FUNGAL', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ANTIPARASITIC_PEPTIDE',
    name: 'Antiparasitic Peptide',
    categories: ['peptide', 'immune'],
    mechanisms: ['ANTI_PARASITE', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_STEMCELL_UP',
    name: 'Skin Stem‑Cell Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['STEMCELL_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид кожных стволовых клеток',
    type: 'peptide'
  },
  {
    id: 'PEP_HAIR_STEMCELL_UP',
    name: 'Hair Stem‑Cell Peptide',
    categories: ['peptide', 'hair'],
    mechanisms: ['STEMCELL_UP', 'HAIR_REGEN'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANIN_RESET',
    name: 'Melanin Reset Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['MELANIN_MOD', 'SKIN_TONE'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_SCAR_DISSOLVE',
    name: 'Scar Dissolving Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['SCAR_REPAIR', 'COLLAGEN_MOD'],
    organs: ['SKIN'],
    deficiency: 'SCARS',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_CAPILLARY_REPAIR',
    name: 'Capillary Repair Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['CAPILLARY_UP', 'VESSEL_PROTECTION'],
    organs: ['VESSELS'],
    deficiency: 'ROSACEA',
    description: 'Пептид капиллярного восстановления',
    type: 'peptide'
  },
  {
    id: 'PEP_LYMPH_FLOW_UP',
    name: 'Lymph Flow Peptide',
    categories: ['peptide', 'lymph'],
    mechanisms: ['LYMPH_FLOW_UP', 'ANTI_INFLAMMATION'],
    organs: ['LYMPH'],
    deficiency: 'LYMPH_STASIS',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REPAIR_MASTER',
    name: 'Master Organ Repair Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_SIGNAL_ULTRA',
    name: 'Full Signal Ultra Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'REGEN_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN_ULTRA',
    name: 'Full Regeneration Ultra Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_PEPTIDE_INFINITY',
    name: 'Full Peptide Infinity',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_NRF1',
    name: 'NRF1 Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['NRF1_UP', 'MITO_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_NRF2',
    name: 'NRF2 Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['Nrf2_UP', 'ROS_DOWN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PGC1A',
    name: 'PGC‑1α Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['PGC1A_UP', 'MITO_BIOGENESIS'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_UCP1',
    name: 'UCP‑1 Activation Peptide',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['UCP1_UP', 'THERMOGENESIS'],
    organs: ['FAT'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_CARDIOLIPIN',
    name: 'Cardiolipin Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['CARDIOLIPIN_REPAIR', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_MEMBRANE',
    name: 'Mito Membrane Stabilizer',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MEMBRANE_STABILITY', 'ROS_DOWN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_AUTOPHAGY',
    name: 'Autophagy Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['AUTOPHAGY_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_MITOPHAGY',
    name: 'Mitophagy Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITOPHAGY_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_DNA_METHYLATION',
    name: 'DNA Methylation Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['METHYLATION_MOD', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_DNA_ACETYLATION',
    name: 'DNA Acetylation Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['ACETYLATION_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CHROMATIN_REMODEL',
    name: 'Chromatin Remodeling Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_OPEN', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид хроматиновой перестройки',
    type: 'peptide'
  },
  {
    id: 'PEP_STEMCELL_MASTER',
    name: 'Stem‑Cell Master Peptide',
    categories: ['peptide', 'regeneration'],
    mechanisms: ['STEMCELL_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Мастер‑пептид стволовых клеток',
    type: 'peptide'
  },
  {
    id: 'PEP_STEMCELL_SKIN',
    name: 'Skin Stem‑Cell Activator',
    categories: ['peptide', 'skin'],
    mechanisms: ['STEMCELL_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_STEMCELL_MUSCLE',
    name: 'Muscle Stem‑Cell Activator',
    categories: ['peptide', 'muscle'],
    mechanisms: ['SATELLITE_CELL_UP', 'MUSCLE_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид мышечных стволовых клеток',
    type: 'peptide'
  },
  {
    id: 'PEP_STEMCELL_NEURO',
    name: 'Neural Stem‑Cell Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_STEMCELL_UP', 'NEURO_REGEN'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ANGIO_MASTER',
    name: 'Master Angiogenesis Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VEGF_UP', 'VESSEL_REPAIR'],
    organs: ['VESSELS'],
    deficiency: 'ISCHEMIA',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ANGIO_BALANCE',
    name: 'Angiogenesis Balance Peptide',
    categories: ['peptide', 'vascular'],
    mechanisms: ['VEGF_MOD', 'VESSEL_PROTECTION'],
    organs: ['VESSELS'],
    deficiency: 'VARICOSE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_CARTILAGE_MASTER',
    name: 'Master Cartilage Peptide',
    categories: ['peptide', 'joint'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Пептид для суставов',
    type: 'peptide'
  },
  {
    id: 'PEP_TENDON_MASTER',
    name: 'Master Tendon Peptide',
    categories: ['peptide', 'tendon'],
    mechanisms: ['TENDON_HEALING', 'COLLAGEN_UP'],
    organs: ['TENDONS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_BONE_MASTER',
    name: 'Master Bone Peptide',
    categories: ['peptide', 'bone'],
    mechanisms: ['BONE_REGEN', 'COLLAGEN_UP'],
    organs: ['BONES'],
    deficiency: 'OSTEOPENIA',
    description: 'Пептид для костной ткани',
    type: 'peptide'
  },
  {
    id: 'PEP_SKIN_MASTER',
    name: 'Master Skin Peptide',
    categories: ['peptide', 'skin'],
    mechanisms: ['COLLAGEN_UP', 'SKIN_REPAIR'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_HAIR_MASTER',
    name: 'Master Hair Peptide',
    categories: ['peptide', 'hair'],
    mechanisms: ['HAIR_FOLLICLE_UP', 'KERATIN_UP'],
    organs: ['HAIR'],
    deficiency: 'HAIR_LOSS',
    description: 'Пептид для здоровья волос',
    type: 'peptide'
  },
  {
    id: 'PEP_LIVER_MASTER',
    name: 'Master Liver Peptide',
    categories: ['peptide', 'liver'],
    mechanisms: ['LIVER_REPAIR', 'DETOX_UP'],
    organs: ['LIVER'],
    deficiency: 'HEPATIC_STRESS',
    description: 'Пептид для функции печени',
    type: 'peptide'
  },
  {
    id: 'PEP_PANCREAS_MASTER',
    name: 'Master Pancreas Peptide',
    categories: ['peptide', 'metabolism'],
    mechanisms: ['INSULIN_MOD', 'CELL_REPAIR'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Пептид для метаболизма',
    type: 'peptide'
  },
  {
    id: 'PEP_HEART_MASTER',
    name: 'Master Heart Peptide',
    categories: ['peptide', 'cardio'],
    mechanisms: ['NO_UP', 'VESSEL_PROTECTION'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для ССС',
    type: 'peptide'
  },
  {
    id: 'PEP_LUNG_MASTER',
    name: 'Master Lung Peptide',
    categories: ['peptide', 'lung'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_REPAIR'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Пептид для легких',
    type: 'peptide'
  },
  {
    id: 'PEP_KIDNEY_MASTER',
    name: 'Master Kidney Peptide',
    categories: ['peptide', 'kidney'],
    mechanisms: ['CELL_PROTECTION', 'UREA_CYCLE_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'UREMIC_RISK',
    description: 'Пептид для почек',
    type: 'peptide'
  },
  {
    id: 'PEP_BRAIN_MASTER',
    name: 'Master Brain Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYROID_MASTER',
    name: 'Master Thyroid Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['THYROID_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROID',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_ADRENAL_MASTER',
    name: 'Master Adrenal Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['ADRENAL_SUPPORT', 'CORTISOL_MOD'],
    organs: ['ADRENALS'],
    deficiency: 'STRESS',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_OVARY_MASTER',
    name: 'Master Ovary Peptide',
    categories: ['peptide', 'female'],
    mechanisms: ['ESTROGEN_MOD', 'CELL_REPAIR'],
    organs: ['OVARIES'],
    deficiency: 'MENOPAUSE',
    description: 'Пептид для женского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_TESTIS_MASTER',
    name: 'Master Testis Peptide',
    categories: ['peptide', 'male'],
    mechanisms: ['TESTOSTERONE_UP', 'LH_UP'],
    organs: ['TESTES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Пептид для мужского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_PROSTATE_MASTER',
    name: 'Master Prostate Peptide',
    categories: ['peptide', 'male'],
    mechanisms: ['ANTI_INFLAMMATION', 'CELL_REPAIR'],
    organs: ['PROSTATE'],
    deficiency: 'BPH',
    description: 'Пептид для мужского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_UTERUS_MASTER',
    name: 'Master Uterus Peptide',
    categories: ['peptide', 'female'],
    mechanisms: ['ENDOMETRIUM_REPAIR', 'HORMONE_BALANCE'],
    organs: ['UTERUS'],
    deficiency: 'ENDOMETRIOSIS',
    description: 'Пептид для женского здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_RETINA_MASTER',
    name: 'Master Retina Peptide',
    categories: ['peptide', 'eye'],
    mechanisms: ['RETINA_REPAIR', 'ANTIOXIDANT'],
    organs: ['EYES'],
    deficiency: 'VISION_LOSS',
    description: 'Пептид для зрения',
    type: 'peptide'
  },
  {
    id: 'PEP_PINEAL_MASTER',
    name: 'Master Pineal Peptide',
    categories: ['peptide', 'neuro', 'hormone'],
    mechanisms: ['MELATONIN_UP', 'SLEEP_UP'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'INSOMNIA',
    description: 'Пептид для нервной системы, гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_PITUITARY_MASTER',
    name: 'Master Pituitary Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['PITUITARY_UP', 'HORMONE_BALANCE'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_ORGAN_ULTRA',
    name: 'Full Organ Ultra Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_SIGNAL_MASTER',
    name: 'Full Signal Master Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'REGEN_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN_MASTER',
    name: 'Full Regeneration Master Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_PEPTIDE',
    name: 'Infinity Peptide Complex',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид бесконечной регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COQ10',
    name: 'CoQ10 Peptide Activator',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COQ10_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ETC',
    name: 'Electron Transport Chain Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['ETC_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COMPLEX1',
    name: 'Complex I Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COMPLEX1_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COMPLEX2',
    name: 'Complex II Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COMPLEX2_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COMPLEX3',
    name: 'Complex III Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COMPLEX3_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COMPLEX4',
    name: 'Complex IV Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COMPLEX4_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COMPLEX5',
    name: 'Complex V Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['COMPLEX5_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SUPEROXIDE',
    name: 'Superoxide Detox Peptide',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['SOD_UP', 'ROS_DOWN'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_GPX',
    name: 'GPx Peptide Activator',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['GPX_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_CATALASE',
    name: 'Catalase Peptide',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['CATALASE_UP', 'ROS_DOWN'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_MEMBRANE_REPAIR',
    name: 'Mito Membrane Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MEMBRANE_REPAIR', 'ROS_DOWN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SHIELD',
    name: 'Mito Shield Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_PROTECTION', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_FUSION',
    name: 'Fusion Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_FUSION', 'MITO_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_FISSION',
    name: 'Fission Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_FISSION', 'MITO_CLEANUP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_BIOGENESIS',
    name: 'Biogenesis Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_BIOGENESIS', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_STABILITY',
    name: 'Mito Stability Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MEMBRANE_STABILITY', 'ROS_DOWN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид стабильности митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_CYTOCHROME',
    name: 'Cytochrome Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['CYTOCHROME_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ATPASE',
    name: 'ATPase Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['ATP_UP', 'MITO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_NADH',
    name: 'NADH Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['NADH_UP', 'ATP_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_FAD',
    name: 'FAD Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['FAD_UP', 'ATP_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QC',
    name: 'Mito Quality Control Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_QC_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид контроля качества митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_STRESS_RESIST',
    name: 'Stress‑Resistance Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['STRESS_RESIST_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_LONGEVITY',
    name: 'Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_TELOMERE',
    name: 'Telomere Mito Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_PROTECT', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_DNA_REPAIR',
    name: 'Mito DNA Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_DNA_REPAIR', 'CELL_PROTECTION'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид восстановления мито‑ДНК',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_RNA_REPAIR',
    name: 'Mito RNA Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_RNA_REPAIR', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид восстановления мито‑РНК',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PROTEOSTASIS',
    name: 'Proteostasis Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['PROTEOSTASIS_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_HEAT_SHOCK',
    name: 'Heat‑Shock Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['HSP_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'STRESS',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_COLD_SHOCK',
    name: 'Cold‑Shock Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CSP_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'STRESS',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIGLYCATION',
    name: 'Anti‑Glycation Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['GLYCATION_DOWN', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIFIBROSIS',
    name: 'Anti‑Fibrosis Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['FIBROSIS_DOWN', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'FIBROSIS',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIAPOPTOSIS',
    name: 'Anti‑Apoptosis Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['APOPTOSIS_DOWN', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTISENESCENCE',
    name: 'Anti‑Senescence Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SENESCENCE_DOWN', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_CLEANUP',
    name: 'Mito Cleanup Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_CLEARANCE', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REBOOT',
    name: 'Mito Reboot Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_RESET', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид перезагрузки митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SUPERCHARGE',
    name: 'Mito Supercharge Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['ATP_UP', 'MITO_UP'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_HYPERCHARGE',
    name: 'Mito Hypercharge Peptide',
    categories: ['peptide', 'energy'],
    mechanisms: ['ATP_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Пептид для энергетического обмена',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ULTRA',
    name: 'Ultra Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_INFINITY',
    name: 'Infinity Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид бесконечной миторегенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_OMEGA',
    name: 'Omega Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_PROTECTION', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PRIME',
    name: 'Prime Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_CORE',
    name: 'Core Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_CORE_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_MATRIX',
    name: 'Mito Matrix Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MATRIX_REPAIR', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SIGNAL_ULTRA',
    name: 'Ultra Mito Signal Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_SIGNAL', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REGEN_ULTRA',
    name: 'Ultra Mito Regen Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REGEN', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_FULL_SPECTRUM',
    name: 'Full Spectrum Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_RESET',
    name: 'Epigenetic Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид эпигенетического сброса',
    type: 'peptide'
  },
  {
    id: 'PEP_HDAC_INHIBITOR',
    name: 'HDAC‑Inhibitor Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HDAC_DOWN', 'CHROMATIN_OPEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_HAT_UP',
    name: 'HAT‑Activator Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HAT_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_METHYLATION_BALANCE',
    name: 'Methylation Balance Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['METHYLATION_MOD', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_DNMT_BLOCK',
    name: 'DNMT‑Block Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNMT_DOWN', 'GENE_REACTIVATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_TELOMERE_EXTEND',
    name: 'Telomere Extension Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_TELOMERE_SHIELD',
    name: 'Telomere Shield Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_PROTECT', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_SENOLYTIC',
    name: 'SENOLYTIC Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SENESCENT_CELL_CLEAR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_SENOMOD',
    name: 'SENOMOD Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SASP_DOWN', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_LONGEVITY_PATHWAY',
    name: 'Pathway Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_FOXO_UP',
    name: 'FOXO‑Activator Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['FOXO_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_SIRT3_UP',
    name: 'SIRT3 Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['SIRT3_UP', 'MITO_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_SIRT5_UP',
    name: 'SIRT5 Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['SIRT5_UP', 'ENERGY_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_P53_RESTORE',
    name: 'p53 Restore Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['P53_RESTORE', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'CANCER_RISK',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_P21_RESTORE',
    name: 'p21 Restore Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['P21_UP', 'CELL_CYCLE_CONTROL'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_AUTOPHAGY_MASTER',
    name: 'Autophagy Master Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['AUTOPHAGY_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_LYSOSOME_UP',
    name: 'Lysosome Boost Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['LYSOSOME_UP', 'CELL_CLEANUP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_PROTEIN_FOLDING',
    name: 'Protein Folding Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CHAPERONE_UP', 'PROTEOSTASIS'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ER_STRESS_DOWN',
    name: 'ER‑Stress Reduction Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['ER_STRESS_DOWN', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'STRESS',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_NUCLEAR_SYNC',
    name: 'Mito‑Nuclear Sync Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_NUCLEAR_SYNC', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид синхронизации митонуклеуса',
    type: 'peptide'
  },
  {
    id: 'PEP_DOPAMINE_RESET',
    name: 'Dopamine Reset Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['DOPAMINE_MOD', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SEROTONIN_RESET',
    name: 'Serotonin Reset Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['SEROTONIN_MOD', 'MOOD_UP'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_ISSUES',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_GABA_RESET',
    name: 'GABA Reset Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['GABA_MOD', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NEUROPLASTICITY_UP',
    name: 'Neuroplasticity Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEUROPLASTICITY_UP', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_AXON_REPAIR',
    name: 'Axon Repair Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['AXON_REPAIR', 'NEURO_REGEN'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_MYELIN_UP',
    name: 'Myelin Repair Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['MYELIN_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'MS',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SYNAPSE_UP',
    name: 'Synapse Repair Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['SYNAPSE_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид синаптического восстановления',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_SHIELD',
    name: 'Neuro Shield Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_PROTECTION', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_REBOOT',
    name: 'Neuro Reboot Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_RESET', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NEURO_ULTRA',
    name: 'Neuro Ultra Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REBOOT',
    name: 'Organ Reboot Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_RESET', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_STEMCELL',
    name: 'Organ Stem‑Cell Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['STEMCELL_UP', 'ORGAN_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид органных стволовых клеток',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_MATRIX',
    name: 'Organ Matrix Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['EXTRACELLULAR_MATRIX_UP', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_SIGNAL',
    name: 'Organ Signal Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_SIGNALING', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_ULTRA',
    name: 'Organ Ultra Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_EPIGENETIC',
    name: 'Full Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_MOD', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_LONGEVITY',
    name: 'Full Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_NEURO',
    name: 'Full Neuro Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_MITO',
    name: 'Full Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN',
    name: 'Full Regeneration Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_SIGNAL',
    name: 'Infinity Signal Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'REGEN_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_REGEN',
    name: 'Infinity Regeneration Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид бесконечной регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_ORGAN',
    name: 'Infinity Organ Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид бесконечного органного восстановления',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SIGNAL_CORE',
    name: 'Mito Signal Core Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_SIGNAL', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SIGNAL_PRIME',
    name: 'Mito Signal Prime Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_SIGNAL', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REPAIR_CORE',
    name: 'Mito Repair Core Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REPAIR_PRIME',
    name: 'Mito Repair Prime Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIOX_CORE',
    name: 'Mito Antioxidant Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['ROS_DOWN', 'CELL_PROTECTION'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIOX_PRIME',
    name: 'Mito Antioxidant Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['ANTIOX_UP', 'MITO_PROTECTION'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_DYNAMICS_CORE',
    name: 'Mito Dynamics Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_FUSION', 'MITO_FISSION'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_DYNAMICS_PRIME',
    name: 'Mito Dynamics Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_FUSION', 'MITO_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QC_CORE',
    name: 'Mito QC Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_QC_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QC_PRIME',
    name: 'Mito QC Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_QC_UP', 'MITO_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_TELOMERE_CORE',
    name: 'Mito Telomere Core',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_PROTECT', 'MITO_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_TELOMERE_PRIME',
    name: 'Mito Telomere Prime',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_STEMCELL_CORE',
    name: 'Mito Stem‑Cell Core',
    categories: ['peptide', 'regeneration'],
    mechanisms: ['STEMCELL_UP', 'MITO_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_STEMCELL_PRIME',
    name: 'Mito Stem‑Cell Prime',
    categories: ['peptide', 'regeneration'],
    mechanisms: ['STEMCELL_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_LONGEVITY_CORE',
    name: 'Mito Longevity Core',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_LONGEVITY_PRIME',
    name: 'Mito Longevity Prime',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'MITO_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REBOOT_CORE',
    name: 'Mito Reboot Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_RESET', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REBOOT_PRIME',
    name: 'Mito Reboot Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_RESET', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ULTRA_CORE',
    name: 'Mito Ultra Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ULTRA_PRIME',
    name: 'Mito Ultra Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_UP', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_INFINITY_CORE',
    name: 'Mito Infinity Core',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REPAIR', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_INFINITY_PRIME',
    name: 'Mito Infinity Prime',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_REGEN', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_SIGNAL_CORE',
    name: 'Organ Signal Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_SIGNALING', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_SIGNAL_PRIME',
    name: 'Organ Signal Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_SIGNALING', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REPAIR_CORE',
    name: 'Organ Repair Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REPAIR_PRIME',
    name: 'Organ Repair Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_STEMCELL_CORE',
    name: 'Organ Stem‑Cell Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['STEMCELL_UP', 'ORGAN_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_STEMCELL_PRIME',
    name: 'Organ Stem‑Cell Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['STEMCELL_UP', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_MATRIX_CORE',
    name: 'Organ Matrix Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['EXTRACELLULAR_MATRIX_UP', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_MATRIX_PRIME',
    name: 'Organ Matrix Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ECM_UP', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_LONGEVITY_CORE',
    name: 'Organ Longevity Core',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_LONGEVITY_PRIME',
    name: 'Organ Longevity Prime',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REBOOT_CORE',
    name: 'Organ Reboot Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_RESET', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_REBOOT_PRIME',
    name: 'Organ Reboot Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_RESET', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_ULTRA_CORE',
    name: 'Organ Ultra Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_ULTRA_PRIME',
    name: 'Organ Ultra Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_INFINITY_CORE',
    name: 'Organ Infinity Core',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_INFINITY_PRIME',
    name: 'Organ Infinity Prime',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_SIGNAL_CORE',
    name: 'Full Signal Core',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_SIGNAL_PRIME',
    name: 'Full Signal Prime',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN_CORE',
    name: 'Full Regen Core',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_REGEN_PRIME',
    name: 'Full Regen Prime',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_LONGEVITY_CORE',
    name: 'Full Longevity Core',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_LONGEVITY_PRIME',
    name: 'Full Longevity Prime',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_CORE',
    name: 'Infinity Core Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_INFINITY_PRIME',
    name: 'Infinity Prime Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM',
    name: 'Quantum Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['MITO_QUANTUM_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PHOTON',
    name: 'Photon Mito Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['PHOTON_TRANSFER_UP', 'ENERGY_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ELECTRON_FLOW',
    name: 'Electron Flow Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['ELECTRON_FLOW_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_PROTON_GRADIENT',
    name: 'Proton Gradient Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['PROTON_GRADIENT_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_OXPHOS',
    name: 'OXP-HOS Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['OXPHOS_UP', 'ATP_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_RESP_CHAIN',
    name: 'Respiratory Chain Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['RESP_CHAIN_UP', 'ENERGY_UP'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'FATIGUE',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIOX_SUPER',
    name: 'Super Antioxidant Peptide',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['ROS_DOWN', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'OXIDATIVE_STRESS',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_ANTIOX_NANO',
    name: 'Nano Antioxidant Peptide',
    categories: ['peptide', 'antioxidant'],
    mechanisms: ['NANO_ANTIOX_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для защиты клеток от окислительного стресса',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_REPAIR_NANO',
    name: 'Nano Repair Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['NANO_REPAIR_UP', 'CELL_REGEN'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_SIGNAL_NANO',
    name: 'Nano Signal Peptide',
    categories: ['peptide', 'mitochondria'],
    mechanisms: ['NANO_SIGNAL_UP', 'CELL_REPAIR'],
    organs: ['MITOCHONDRIA'],
    deficiency: 'AGING',
    description: 'Пептид для работы митохондрий',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_STEMCELL_NANO',
    name: 'Nano Stem‑Cell Peptide',
    categories: ['peptide', 'regeneration'],
    mechanisms: ['NANO_STEMCELL_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_LONGEVITY_NANO',
    name: 'Nano Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['NANO_LONGEVITY_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_TELOMERE_NANO',
    name: 'Nano Telomere Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['NANO_TELOMERE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM_REPAIR',
    name: 'Quantum Repair Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['QUANTUM_REPAIR_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM_SIGNAL',
    name: 'Quantum Signal Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['QUANTUM_SIGNAL_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM_LONGEVITY',
    name: 'Quantum Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['QUANTUM_LONGEVITY_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM_STEMCELL',
    name: 'Quantum Stem‑Cell Peptide',
    categories: ['peptide', 'regeneration'],
    mechanisms: ['QUANTUM_STEMCELL_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для регенерации',
    type: 'peptide'
  },
  {
    id: 'PEP_MITO_QUANTUM_TELOMERE',
    name: 'Quantum Telomere Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['QUANTUM_TELOMERE_UP', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM',
    name: 'Quantum Organ Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_SIGNAL',
    name: 'Quantum Organ Signal Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_SIGNALING', 'CELL_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_STEMCELL',
    name: 'Quantum Organ Stem‑Cell Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['STEMCELL_UP', 'ORGAN_REPAIR'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Квантовый органный стволовой пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_LONGEVITY',
    name: 'Quantum Organ Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Квантовый органный долголетний пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_REBOOT',
    name: 'Quantum Organ Reboot Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_RESET', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_ULTRA',
    name: 'Quantum Organ Ultra Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_ORGAN_QUANTUM_INFINITY',
    name: 'Quantum Organ Infinity Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['ORGAN_REPAIR', 'CELL_REGEN'],
    organs: ['ORGANS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_QUANTUM',
    name: 'Quantum Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Квантовый эпигенетический пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_PRIME',
    name: 'Prime Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_MOD', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_CORE',
    name: 'Core Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_OPEN', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_ULTRA',
    name: 'Ultra Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPIGENETIC_INFINITY',
    name: 'Infinity Epigenetic Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Инфинити-эпигенетический пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_SIGNAL_QUANTUM',
    name: 'Quantum Signal Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SIGNAL_ULTRA',
    name: 'Ultra Signal Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_SIGNAL_INFINITY',
    name: 'Infinity Signal Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CELL_SIGNALING', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_REGEN_QUANTUM',
    name: 'Quantum Regen Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Квантовый регенеративный пептид',
    type: 'peptide'
  },
  {
    id: 'PEP_REGEN_ULTRA',
    name: 'Ultra Regen Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_REGEN_INFINITY',
    name: 'Infinity Regen Peptide',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_LONGEVITY_QUANTUM',
    name: 'Quantum Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_LONGEVITY_ULTRA',
    name: 'Ultra Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_LONGEVITY_INFINITY',
    name: 'Infinity Longevity Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_QUANTUM',
    name: 'Full Quantum Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_ULTRA',
    name: 'Full Ultra Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'ANTI_INFLAMMATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_FULL_INFINITY',
    name: 'Full Infinity Peptide',
    categories: ['peptide', 'multi'],
    mechanisms: ['CELL_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CHROMATIN_OPEN',
    name: 'Chromatin Opening Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_OPEN', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CHROMATIN_CLOSE',
    name: 'Chromatin Closing Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_CLOSE', 'GENE_SILENCING'],
    organs: ['CELLS'],
    deficiency: 'CANCER_RISK',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HDAC_SUPPRESS',
    name: 'HDAC Suppressor Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HDAC_DOWN', 'CHROMATIN_OPEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HDAC_BALANCE',
    name: 'HDAC Balance Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HDAC_MOD', 'GENE_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HAT_SUPER',
    name: 'HAT Super‑Activator Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HAT_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HAT_BALANCE',
    name: 'HAT Balance Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HAT_MOD', 'GENE_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNMT_SUPPRESS',
    name: 'DNMT Suppressor Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNMT_DOWN', 'GENE_REACTIVATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNMT_BALANCE',
    name: 'DNMT Balance Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNMT_MOD', 'METHYLATION_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_METHYLATION_RESET',
    name: 'Methylation Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['METHYLATION_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_METHYLATION_STABILIZE',
    name: 'Methylation Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['METHYLATION_STABLE', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации метилирования',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_ACETYLATION_UP',
    name: 'Acetylation Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['ACETYLATION_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_ACETYLATION_RESET',
    name: 'Acetylation Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['ACETYLATION_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HISTONE_REPAIR',
    name: 'Histone Repair Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HISTONE_REPAIR', 'CHROMATIN_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления гистонов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HISTONE_MOD',
    name: 'Histone Modulation Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HISTONE_MOD', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TELOMERE_REPAIR',
    name: 'Telomere Repair Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_REPAIR', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TELOMERE_EXPAND',
    name: 'Telomere Expansion Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERASE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TELOMERE_SHIELD2',
    name: 'Telomere Shield 2.0',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['TELOMERE_PROTECT', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SENESCENCE_CLEAR',
    name: 'Senescence Clearing Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SENESCENT_CELL_CLEAR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид очистки сенесцентных клеток',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SENESCENCE_REVERSE',
    name: 'Senescence Reversal Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SENESCENCE_DOWN', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SASP_BLOCK',
    name: 'SASP Block Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SASP_DOWN', 'ANTI_INFLAMMATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_P53_RESTORE2',
    name: 'p53 Restore 2.0',
    categories: ['peptide', 'cell'],
    mechanisms: ['P53_RESTORE', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'CANCER_RISK',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_P21_RESTORE2',
    name: 'p21 Restore 2.0',
    categories: ['peptide', 'cell'],
    mechanisms: ['P21_UP', 'CELL_CYCLE_CONTROL'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FOXO_MASTER',
    name: 'FOXO Master Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['FOXO_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FOXO_BALANCE',
    name: 'FOXO Balance Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['FOXO_MOD', 'CELL_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SIRT1_MASTER',
    name: 'SIRT1 Master Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SIRT1_UP', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SIRT6_MASTER',
    name: 'SIRT6 Master Peptide',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['SIRT6_UP', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SIRT7_UP',
    name: 'SIRT7 Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['SIRT7_UP', 'CHROMATIN_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CHROMATIN_REMODEL2',
    name: 'Chromatin Remodel 2.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_REMODEL', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид ремоделинга хроматина 2.0',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_REPAIR',
    name: 'Nuclear Repair Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['NUCLEAR_REPAIR', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид ядерного восстановления',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_STABILITY',
    name: 'Nuclear Stability Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['NUCLEAR_STABILITY', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_MITO_NUCLEAR_SYNC2',
    name: 'Mito‑Nuclear Sync 2.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['MITO_NUCLEAR_SYNC', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид синхронизации митонуклеуса 2.0',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNA_UNFOLD',
    name: 'DNA Unfolding Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNA_UNFOLD', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNA_REFOLD',
    name: 'DNA Refolding Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNA_REFOLD', 'GENE_SILENCING'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_RNA_REPAIR',
    name: 'RNA Repair Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['RNA_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_RNA_STABILITY',
    name: 'RNA Stability Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['RNA_STABILITY', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TRANSCRIPTION_UP',
    name: 'Transcription Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['TRANSCRIPTION_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TRANSCRIPTION_RESET',
    name: 'Transcription Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['TRANSCRIPTION_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TRANSLATION_UP',
    name: 'Translation Up Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['TRANSLATION_UP', 'PROTEIN_SYNTHESIS'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TRANSLATION_RESET',
    name: 'Translation Reset Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['TRANSLATION_RESET', 'CELL_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CHROMOSOME_REPAIR',
    name: 'Chromosome Repair Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CHROMOSOME_REPAIR', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления хромосом',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CHROMOSOME_STABILITY',
    name: 'Chromosome Stability Peptide',
    categories: ['peptide', 'cell'],
    mechanisms: ['CHROMOSOME_STABILITY', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для клеточного здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_GENE_REBOOT',
    name: 'Gene Reboot Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['GENE_REBOOT', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_GENE_SHIELD',
    name: 'Gene Shield Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['GENE_PROTECTION', 'DNA_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FULL_RESET',
    name: 'Full Epigenetic Reset',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FULL_REPAIR',
    name: 'Full Epigenetic Repair',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FULL_LONGEVITY',
    name: 'Full Epigenetic Longevity',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Полное эпигенетическое долголетие',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INFINITY_RESET',
    name: 'Infinity Epigenetic Reset',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Инфинити эпигенетический сброс',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INFINITY_REPAIR',
    name: 'Infinity Epigenetic Repair',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_REPAIR', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Инфинити эпигенетический ремонт',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INFINITY_LONGEVITY',
    name: 'Infinity Epigenetic Longevity',
    categories: ['peptide', 'antiaging'],
    mechanisms: ['LONGEVITY_GENES_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Инфинити эпигенетическое долголетие',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LAMIN_A_REBUILD',
    name: 'Lamin‑A Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LAMIN_A_REBUILD', 'NUCLEAR_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления ламина A',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LAMIN_B_REBUILD',
    name: 'Lamin‑B Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LAMIN_B_REBUILD', 'NUCLEAR_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления ламина B',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LAMIN_NETWORK_UP',
    name: 'Lamin Network Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LAMIN_NETWORK_UP', 'CHROMATIN_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид усиления ламинарной сети',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LAMIN_NETWORK_RESET',
    name: 'Lamin Network Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LAMIN_NETWORK_RESET', 'CELL_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_SCAFFOLD_UP',
    name: 'Nuclear Scaffold Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEAR_SCAFFOLD_UP', 'GENOME_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_SCAFFOLD_REPAIR',
    name: 'Nuclear Scaffold Repair Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEAR_SCAFFOLD_REPAIR', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления ядерного каркаса',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TAD_BOUNDARY_UP',
    name: 'TAD Boundary Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['TAD_BOUNDARY_UP', 'GENE_BOUNDARY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_TAD_BOUNDARY_REPAIR',
    name: 'TAD Boundary Repair Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['TAD_BOUNDARY_REPAIR', 'CHROMATIN_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления границ TAD',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LOOP_EXTRUSION_UP',
    name: 'Loop Extrusion Up Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LOOP_EXTRUSION_UP', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_LOOP_EXTRUSION_RESET',
    name: 'Loop Extrusion Reset Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['LOOP_EXTRUSION_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид сброса экструзии петель',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CTCF_STABILIZE',
    name: 'CTCF Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CTCF_STABLE', 'CHROMATIN_ORGANIZATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_CTCF_REBUILD',
    name: 'CTCF Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CTCF_REBUILD', 'GENE_BOUNDARY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_COHESIN_STABILIZE',
    name: 'Cohesin Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['COHESIN_STABLE', 'CHROMATIN_LOOPING'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_COHESIN_REBUILD',
    name: 'Cohesin Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['COHESIN_REBUILD', 'CHROMATIN_STRUCTURE'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления когезина',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SMC_COMPLEX_STABILIZE',
    name: 'SMC Complex Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['SMC_STABLE', 'CHROMATIN_STRUCTURE'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SMC_COMPLEX_REBUILD',
    name: 'SMC Complex Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['SMC_REBUILD', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SUPERENHANCER_STABILIZE',
    name: 'Super‑Enhancer Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['SUPERENHANCER_STABLE', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации суперэнхансеров',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_SUPERENHANCER_REBUILD',
    name: 'Super‑Enhancer Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['SUPERENHANCER_REBUILD', 'GENE_CONTROL'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления суперэнхансеров',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INSULATOR_STABILIZE',
    name: 'Insulator Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['INSULATOR_STABLE', 'GENE_BOUNDARY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации изоляторов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INSULATOR_REBUILD',
    name: 'Insulator Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['INSULATOR_REBUILD', 'CHROMATIN_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления изоляторов',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_BODY_STABILIZE',
    name: 'Nuclear Body Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEAR_BODY_STABLE', 'GENE_REGULATION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации ядерных телец',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEAR_BODY_REBUILD',
    name: 'Nuclear Body Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEAR_BODY_REBUILD', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления ядерных телец',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEOLUS_STABILIZE',
    name: 'Nucleolus Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEOLUS_STABLE', 'RIBOSOME_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации нуклеолуса',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_NUCLEOLUS_REBUILD',
    name: 'Nucleolus Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['NUCLEOLUS_REBUILD', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления нуклеолуса',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HETEROCHROMATIN_STABILIZE',
    name: 'Heterochromatin Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HETEROCHROMATIN_STABLE', 'GENE_SILENCING'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации гетерохроматина',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_HETEROCHROMATIN_REBUILD',
    name: 'Heterochromatin Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['HETEROCHROMATIN_REBUILD', 'DNA_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления гетерохроматина',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_EUCHROMATIN_STABILIZE',
    name: 'Euchromatin Stabilizer Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EUCHROMATIN_STABLE', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации эухроматина',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_EUCHROMATIN_REBUILD',
    name: 'Euchromatin Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EUCHROMATIN_REBUILD', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления эухроматина',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNA_LOOPING_STABILIZE',
    name: 'DNA Looping Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNA_LOOPING_STABLE', 'GENE_EXPRESSION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации ДНК‑лупинга',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_DNA_LOOPING_REBUILD',
    name: 'DNA Looping Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['DNA_LOOPING_REBUILD', 'GENE_CONTROL'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления ДНК‑лупинга',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_3D_ARCHITECTURE_STABILIZE',
    name: '3D Architecture Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['3D_ARCHITECTURE_STABLE', 'GENOME_STABILITY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации 3D‑архитектуры',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_3D_ARCHITECTURE_REBUILD',
    name: '3D Architecture Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['3D_ARCHITECTURE_REBUILD', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления 3D‑архитектуры',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_GENOME_INSULATION_STABILIZE',
    name: 'Genome Insulation Stabilizer',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['GENOME_INSULATION_STABLE', 'GENE_BOUNDARY'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид стабилизации геномной изоляции',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_GENOME_INSULATION_REBUILD',
    name: 'Genome Insulation Rebuild Peptide',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['GENOME_INSULATION_REBUILD', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид восстановления геномной изоляции',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FULL_STRUCTURE2',
    name: 'Full Chromatin Structure 2.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_STRUCTURE_UP', 'CELL_PROTECTION'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Полный структурный эпиген‑пептид 2.0',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_FULL_RESET3',
    name: 'Full Epigenetic Reset 3.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'GENE_REBOOT'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INFINITY_STRUCTURE2',
    name: 'Infinity Chromatin Structure 2.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['CHROMATIN_STRUCTURE_UP', 'CELL_REGEN'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_EPI_INFINITY_RESET3',
    name: 'Infinity Epigenetic Reset 3.0',
    categories: ['peptide', 'epigenetic'],
    mechanisms: ['EPIGENETIC_RESET', 'CELL_REPAIR'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_BPC157',
    name: 'BPC‑157',
    categories: ['peptide', 'repair', 'GI', 'muscle'],
    mechanisms: ['GI_REPAIR', 'TENDON_HEALING'],
    organs: ['GI', 'TENDONS', 'MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_TB500',
    name: 'TB‑500 (Thymosin Beta‑4)',
    categories: ['peptide', 'repair', 'muscle'],
    mechanisms: ['REGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['MUSCLES', 'TENDONS'],
    deficiency: 'INJURY',
    description: 'Пептид для мышц',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOSIN_BETA4',
    name: 'Thymosin Beta‑4',
    categories: ['peptide', 'repair'],
    mechanisms: ['REGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['CELLS', 'MUSCLES'],
    deficiency: 'INJURY',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOSIN_ALPHA1',
    name: 'Thymosin Alpha‑1',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMULIN',
    name: 'Thymulin',
    categories: ['peptide', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_THYMOPENTIN',
    name: 'Thymopentin',
    categories: ['peptide', 'immune'],
    mechanisms: ['T_CELL_UP', 'IMMUNE_REGEN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Пептид для иммунной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_GHK_CU',
    name: 'GHK‑Cu',
    categories: ['peptide', 'skin', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'WOUND_HEALING'],
    organs: ['SKIN', 'CELLS'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_GHK',
    name: 'GHK Peptide',
    categories: ['peptide', 'skin', 'antiaging'],
    mechanisms: ['COLLAGEN_UP', 'ANTI_INFLAMMATION'],
    organs: ['SKIN'],
    deficiency: 'AGING',
    description: 'Пептид для здоровья кожи, антивозрастных процессов',
    type: 'peptide'
  },
  {
    id: 'PEP_CJC1295',
    name: 'CJC‑1295 (No DAC)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'IGF1_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_CJC1295_DAC',
    name: 'CJC‑1295 DAC',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'IGF1_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_IPAMORELIN',
    name: 'Ipamorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GROWTH_HORMONE_UP', 'GH_PULSE_UP'],
    organs: ['HORMONES', 'MUSCLES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GHRP2',
    name: 'GHRP‑2',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'HUNGER_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GHRP6',
    name: 'GHRP‑6',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'HUNGER_UP'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_HEXARELIN',
    name: 'Hexarelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GH_UP', 'GH_PULSE_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_GH',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_IGF1_LR3',
    name: 'IGF‑1 LR3',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['IGF1_UP', 'MUSCLE_GROWTH'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_DES_IGF1',
    name: 'Des(1‑3) IGF‑1',
    categories: ['peptide', 'anabolic'],
    mechanisms: ['IGF1_UP', 'CELL_REPAIR'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_PT141',
    name: 'PT‑141 (Bremelanotide)',
    categories: ['peptide', 'hormone'],
    mechanisms: ['LIBIDO_UP', 'NEURO_SIGNALING'],
    organs: ['HORMONES', 'BRAIN'],
    deficiency: 'LOW_LIBIDO',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANOTAN1',
    name: 'Melanotan‑1',
    categories: ['peptide', 'skin'],
    mechanisms: ['MELANIN_UP', 'SKIN_PROTECTION'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи',
    type: 'peptide'
  },
  {
    id: 'PEP_MELANOTAN2',
    name: 'Melanotan‑2',
    categories: ['peptide', 'skin', 'hormone'],
    mechanisms: ['MELANIN_UP', 'LIBIDO_UP'],
    organs: ['SKIN', 'HORMONES'],
    deficiency: 'PIGMENTATION',
    description: 'Пептид для здоровья кожи, гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_KISSPEPTIN10',
    name: 'Kisspeptin‑10',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GNRH_UP', 'LH_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_LIBIDO',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_GONADORELIN',
    name: 'Gonadorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['LH_UP', 'FSH_UP'],
    organs: ['HORMONES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_TRIPTORELIN',
    name: 'Triptorelin',
    categories: ['peptide', 'hormone'],
    mechanisms: ['GNRH_MOD', 'HORMONE_RESET'],
    organs: ['HORMONES'],
    deficiency: 'IMBALANCE',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_SEMAX',
    name: 'Semax',
    categories: ['peptide', 'neuro'],
    mechanisms: ['BDNF_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SELANK',
    name: 'Selank',
    categories: ['peptide', 'neuro', 'anxiolytic'],
    mechanisms: ['GABA_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Пептид для нервной системы, снижения тревоги',
    type: 'peptide'
  },
  {
    id: 'PEP_DSIP',
    name: 'DSIP',
    categories: ['peptide', 'sleep'],
    mechanisms: ['SLEEP_UP', 'CORTISOL_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Пептид для сна',
    type: 'peptide'
  },
  {
    id: 'PEP_P21',
    name: 'P21 Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_REGEN', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_AOD9604',
    name: 'AOD‑9604',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['FAT_BREAKDOWN', 'GH_FRAGMENT'],
    organs: ['METABOLISM'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_HGH_FRAG176',
    name: 'HGH Frag 176‑191',
    categories: ['peptide', 'fat_loss'],
    mechanisms: ['FAT_BREAKDOWN', 'GH_FRAGMENT'],
    organs: ['METABOLISM'],
    deficiency: 'OBESITY',
    description: 'Пептид для жиросжигания',
    type: 'peptide'
  },
  {
    id: 'PEP_OXYTOCIN',
    name: 'Oxytocin Peptide',
    categories: ['peptide', 'hormone'],
    mechanisms: ['SOCIAL_BOND', 'STRESS_DOWN'],
    organs: ['BRAIN', 'HORMONES'],
    deficiency: 'STRESS',
    description: 'Пептид для гормонального баланса',
    type: 'peptide'
  },
  {
    id: 'PEP_VIP',
    name: 'Vasoactive Intestinal Peptide (VIP)',
    categories: ['peptide', 'vascular', 'GI'],
    mechanisms: ['NO_UP', 'GI_REPAIR'],
    organs: ['VESSELS', 'GI'],
    deficiency: 'HIGH_BP',
    description: 'Пептид для поддержки обменных процессов и здоровья',
    type: 'peptide'
  },
  {
    id: 'PEP_PACAP',
    name: 'PACAP Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEUROPROTECTION', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_NEUROTENSIN',
    name: 'Neurotensin Peptide',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'PAIN_MOD'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'PEP_SUBSTANCE_P',
    name: 'Substance P',
    categories: ['peptide', 'neuro'],
    mechanisms: ['NEURO_SIGNALING', 'PAIN_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Пептид для нервной системы',
    type: 'peptide'
  },
  {
    id: 'HORM_CORTISOL',
    name: 'Cortisol',
    categories: ['hormone', 'HPA'],
    mechanisms: ['CORTISOL_UP', 'STRESS_RESPONSE'],
    organs: ['ADRENALS'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CORTISONE',
    name: 'Cortisone',
    categories: ['hormone', 'HPA'],
    mechanisms: ['CORTISONE_UP', 'ANTI_INFLAMMATION'],
    organs: ['ADRENALS'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADRENALINE',
    name: 'Adrenaline (Epinephrine)',
    categories: ['hormone', 'HPA'],
    mechanisms: ['ADRENALINE_UP', 'ALERTNESS'],
    organs: ['ADRENALS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NORADRENALINE',
    name: 'Noradrenaline (Norepinephrine)',
    categories: ['hormone', 'HPA'],
    mechanisms: ['NORADRENALINE_UP', 'FOCUS'],
    organs: ['BRAIN', 'ADRENALS'],
    deficiency: 'FOCUS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_DHEA',
    name: 'DHEA',
    categories: ['hormone', 'HPA', 'HPG'],
    mechanisms: ['DHEA_UP', 'ANDROGEN_UP'],
    organs: ['ADRENALS'],
    deficiency: 'LOW_DHEA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_DHEA_S',
    name: 'DHEA‑S',
    categories: ['hormone', 'HPA', 'HPG'],
    mechanisms: ['DHEAS_UP', 'ANDROGEN_UP'],
    organs: ['ADRENALS'],
    deficiency: 'LOW_DHEA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CRH',
    name: 'CRH (Corticotropin‑Releasing Hormone)',
    categories: ['hormone', 'HPA'],
    mechanisms: ['CRH_UP', 'ACTH_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ACTH',
    name: 'ACTH',
    categories: ['hormone', 'HPA'],
    mechanisms: ['ACTH_UP', 'CORTISOL_UP'],
    organs: ['PITUITARY'],
    deficiency: 'ADRENAL_FATIGUE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TSH',
    name: 'TSH',
    categories: ['hormone', 'HPT'],
    mechanisms: ['TSH_UP', 'T3_T4_UP'],
    organs: ['PITUITARY'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_T3',
    name: 'T3 (Triiodothyronine)',
    categories: ['hormone', 'HPT'],
    mechanisms: ['T3_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_T4',
    name: 'T4 (Thyroxine)',
    categories: ['hormone', 'HPT'],
    mechanisms: ['T4_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RT3',
    name: 'Reverse T3',
    categories: ['hormone', 'HPT'],
    mechanisms: ['RT3_UP', 'METABOLISM_DOWN'],
    organs: ['THYROID'],
    deficiency: 'LOW_ENERGY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TRH',
    name: 'TRH (Thyrotropin‑Releasing Hormone)',
    categories: ['hormone', 'HPT'],
    mechanisms: ['TRH_UP', 'TSH_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LH',
    name: 'LH',
    categories: ['hormone', 'HPG'],
    mechanisms: ['LH_UP', 'TESTOSTERONE_UP'],
    organs: ['PITUITARY'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_FSH',
    name: 'FSH',
    categories: ['hormone', 'HPG'],
    mechanisms: ['FSH_UP', 'SPERM_UP'],
    organs: ['PITUITARY'],
    deficiency: 'INFERTILITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TESTOSTERONE',
    name: 'Testosterone',
    categories: ['hormone', 'HPG'],
    mechanisms: ['TESTOSTERONE_UP', 'ANABOLISM'],
    organs: ['TESTES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_DHT',
    name: 'DHT',
    categories: ['hormone', 'HPG'],
    mechanisms: ['DHT_UP', 'ANDROGENIC_EFFECTS'],
    organs: ['SKIN', 'PROSTATE'],
    deficiency: 'HAIR_LOSS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ESTRADIOL',
    name: 'Estradiol (E2)',
    categories: ['hormone', 'HPG'],
    mechanisms: ['E2_UP', 'FERTILITY'],
    organs: ['OVARIES', 'BRAIN'],
    deficiency: 'HORMONAL_IMBALANCE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROGESTERONE',
    name: 'Progesterone',
    categories: ['hormone', 'HPG'],
    mechanisms: ['PROGESTERONE_UP', 'CALMING'],
    organs: ['OVARIES', 'BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GNRH',
    name: 'GnRH',
    categories: ['hormone', 'HPG'],
    mechanisms: ['GNRH_UP', 'LH_FSH_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'LOW_LIBIDO',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_INSULIN',
    name: 'Insulin',
    categories: ['hormone', 'PANCREAS'],
    mechanisms: ['INSULIN_UP', 'GLUCOSE_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GLUCAGON',
    name: 'Glucagon',
    categories: ['hormone', 'PANCREAS'],
    mechanisms: ['GLUCAGON_UP', 'GLUCOSE_UP'],
    organs: ['PANCREAS'],
    deficiency: 'HYPOGLYCEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GH',
    name: 'Growth Hormone (GH)',
    categories: ['hormone', 'HPTA'],
    mechanisms: ['GH_UP', 'IGF1_UP'],
    organs: ['PITUITARY'],
    deficiency: 'LOW_GH',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IGF1',
    name: 'IGF‑1',
    categories: ['hormone', 'HPTA'],
    mechanisms: ['IGF1_UP', 'ANABOLISM'],
    organs: ['LIVER'],
    deficiency: 'LOW_IGF1',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROLACTIN',
    name: 'Prolactin',
    categories: ['hormone', 'PITUITARY'],
    mechanisms: ['PROLACTIN_UP', 'MILK_UP'],
    organs: ['PITUITARY'],
    deficiency: 'HYPERPROLACTINEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_OXYTOCIN',
    name: 'Oxytocin',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['OXYTOCIN_UP', 'BONDING'],
    organs: ['HYPOTHALAMUS', 'BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VASOPRESSIN',
    name: 'Vasopressin (ADH)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['ADH_UP', 'WATER_RETAIN'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'KIDNEY_ISSUES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MELATONIN',
    name: 'Melatonin',
    categories: ['hormone', 'PINEAL'],
    mechanisms: ['MELATONIN_UP', 'SLEEP_UP'],
    organs: ['PINEAL_GLAND'],
    deficiency: 'INSOMNIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LEPTIN',
    name: 'Leptin',
    categories: ['hormone', 'METABOLIC'],
    mechanisms: ['LEPTIN_UP', 'SATIETY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADIPONECTIN',
    name: 'Adiponectin',
    categories: ['hormone', 'METABOLIC'],
    mechanisms: ['ADIPONECTIN_UP', 'INSULIN_SENSITIVITY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'METABOLIC_SYNDROME',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RESISTIN',
    name: 'Resistin',
    categories: ['hormone', 'METABOLIC'],
    mechanisms: ['RESISTIN_UP', 'INSULIN_RESISTANCE'],
    organs: ['FAT_TISSUE'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GHRELIN',
    name: 'Ghrelin',
    categories: ['hormone', 'GI'],
    mechanisms: ['GHRELIN_UP', 'HUNGER_UP'],
    organs: ['STOMACH'],
    deficiency: 'HUNGER',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PYY',
    name: 'PYY (Peptide YY)',
    categories: ['hormone', 'GI'],
    mechanisms: ['PYY_UP', 'HUNGER_DOWN'],
    organs: ['GI'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GLP1',
    name: 'GLP‑1',
    categories: ['hormone', 'GI'],
    mechanisms: ['GLP1_UP', 'INSULIN_UP'],
    organs: ['GI'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GIP',
    name: 'GIP',
    categories: ['hormone', 'GI'],
    mechanisms: ['GIP_UP', 'INSULIN_UP'],
    organs: ['GI'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CCK',
    name: 'CCK',
    categories: ['hormone', 'GI'],
    mechanisms: ['CCK_UP', 'DIGESTION_UP'],
    organs: ['GI'],
    deficiency: 'DIGESTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SECRETIN',
    name: 'Secretin',
    categories: ['hormone', 'GI'],
    mechanisms: ['SECRETIN_UP', 'DIGESTION_UP'],
    organs: ['GI'],
    deficiency: 'DIGESTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MOTILIN',
    name: 'Motilin',
    categories: ['hormone', 'GI'],
    mechanisms: ['MOTILIN_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ERITHROPOIETIN',
    name: 'EPO',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['EPO_UP', 'RBC_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'ANEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CALCITONIN',
    name: 'Calcitonin',
    categories: ['hormone', 'THYROID'],
    mechanisms: ['CALCIUM_DOWN', 'BONE_PROTECT'],
    organs: ['THYROID'],
    deficiency: 'HIGH_CALCIUM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PTH',
    name: 'Parathyroid Hormone (PTH)',
    categories: ['hormone', 'PARATHYROID'],
    mechanisms: ['CALCIUM_UP', 'BONE_RESORB'],
    organs: ['PARATHYROID'],
    deficiency: 'LOW_CALCIUM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VITD_ACTIVE',
    name: 'Calcitriol (Active Vitamin D)',
    categories: ['hormone', 'PARATHYROID'],
    mechanisms: ['CALCITRIOL_UP', 'CALCIUM_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'LOW_VITD',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ALDOSTERONE',
    name: 'Aldosterone',
    categories: ['hormone', 'HPA'],
    mechanisms: ['ALDOSTERONE_UP', 'SODIUM_RETAIN'],
    organs: ['ADRENALS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANP',
    name: 'Atrial Natriuretic Peptide (ANP)',
    categories: ['hormone', 'HEART'],
    mechanisms: ['ANP_UP', 'SODIUM_DOWN'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BNP',
    name: 'BNP',
    categories: ['hormone', 'HEART'],
    mechanisms: ['BNP_UP', 'HEART_STRESS'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_KISSPEPTIN',
    name: 'Kisspeptin',
    categories: ['hormone', 'HPG'],
    mechanisms: ['KISSPEPTIN_UP', 'GNRH_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'LOW_LIBIDO',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROPEPTIDE_Y',
    name: 'Neuropeptide Y (NPY)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['NPY_UP', 'HUNGER_UP'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_AGRP',
    name: 'AgRP (Agouti‑related peptide)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['AGRP_UP', 'HUNGER_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_POMC',
    name: 'POMC Peptides',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['POMC_UP', 'SATIETY_UP'],
    organs: ['HYPOTHALAMUS'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BETA_ENDORPHIN',
    name: 'Beta‑Endorphin',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['ENDORPHIN_UP', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENKEPHALIN',
    name: 'Enkephalin',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['ENKEPHALIN_UP', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_DYNORPHIN',
    name: 'Dynorphin',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['DYNORPHIN_UP', 'STRESS_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SOMATOSTATIN',
    name: 'Somatostatin',
    categories: ['hormone', 'GI', 'NEURO'],
    mechanisms: ['SOMATOSTATIN_UP', 'DIGESTION_DOWN'],
    organs: ['PANCREAS', 'GI'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GASTRIN',
    name: 'Gastrin',
    categories: ['hormone', 'GI'],
    mechanisms: ['GASTRIN_UP', 'ACID_UP'],
    organs: ['STOMACH'],
    deficiency: 'DIGESTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROTENSIN_HORM',
    name: 'Neurotensin (hormonal)',
    categories: ['hormone', 'GI'],
    mechanisms: ['NEUROTENSIN_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SCT',
    name: 'Secretin',
    categories: ['hormone', 'GI'],
    mechanisms: ['SECRETIN_UP', 'BICARB_UP'],
    organs: ['GI'],
    deficiency: 'DIGESTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GLP2',
    name: 'GLP‑2',
    categories: ['hormone', 'GI'],
    mechanisms: ['GLP2_UP', 'GI_REPAIR'],
    organs: ['GI'],
    deficiency: 'IBD',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_INCRETIN_GIP',
    name: 'GIP (Incretin)',
    categories: ['hormone', 'GI'],
    mechanisms: ['GIP_UP', 'INSULIN_UP'],
    organs: ['GI'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MSH_ALPHA',
    name: 'Alpha‑MSH',
    categories: ['hormone', 'PITUITARY'],
    mechanisms: ['MSH_UP', 'MELANIN_UP'],
    organs: ['PITUITARY'],
    deficiency: 'PIGMENTATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MSH_BETA',
    name: 'Beta‑MSH',
    categories: ['hormone', 'PITUITARY'],
    mechanisms: ['MSH_UP', 'ENERGY_UP'],
    organs: ['PITUITARY'],
    deficiency: 'METABOLISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MSH_GAMMA',
    name: 'Gamma‑MSH',
    categories: ['hormone', 'PITUITARY'],
    mechanisms: ['MSH_UP', 'BP_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_INHIBIN',
    name: 'Inhibin',
    categories: ['hormone', 'HPG'],
    mechanisms: ['INHIBIN_UP', 'FSH_DOWN'],
    organs: ['GONADS'],
    deficiency: 'INFERTILITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ACTIVIN',
    name: 'Activin',
    categories: ['hormone', 'HPG'],
    mechanisms: ['ACTIVIN_UP', 'FSH_UP'],
    organs: ['GONADS'],
    deficiency: 'INFERTILITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RELAXIN',
    name: 'Relaxin',
    categories: ['hormone', 'REPRODUCTIVE'],
    mechanisms: ['RELAXIN_UP', 'LIGAMENT_LOOSEN'],
    organs: ['OVARIES'],
    deficiency: 'PREGNANCY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HCG',
    name: 'hCG',
    categories: ['hormone', 'REPRODUCTIVE'],
    mechanisms: ['HCG_UP', 'PROGESTERONE_UP'],
    organs: ['PLACENTA'],
    deficiency: 'PREGNANCY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PLACENTAL_LACTOGEN',
    name: 'Placental Lactogen',
    categories: ['hormone', 'REPRODUCTIVE'],
    mechanisms: ['PL_UP', 'MILK_UP'],
    organs: ['PLACENTA'],
    deficiency: 'PREGNANCY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPCIDIN',
    name: 'Hepcidin',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['HEPCIDIN_UP', 'IRON_DOWN'],
    organs: ['LIVER'],
    deficiency: 'ANEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANGIOTENSIN2',
    name: 'Angiotensin II',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['ANG2_UP', 'BP_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RENIN',
    name: 'Renin',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['RENIN_UP', 'ANG2_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_FGF21',
    name: 'FGF‑21',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['FGF21_UP', 'METABOLISM_UP'],
    organs: ['LIVER'],
    deficiency: 'METABOLIC_SYNDROME',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_FGF23',
    name: 'FGF‑23',
    categories: ['hormone', 'BONE'],
    mechanisms: ['FGF23_UP', 'PHOSPHATE_DOWN'],
    organs: ['BONES'],
    deficiency: 'KIDNEY_ISSUES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_OSTEOCALCIN',
    name: 'Osteocalcin',
    categories: ['hormone', 'BONE'],
    mechanisms: ['OSTEOCALCIN_UP', 'INSULIN_SENSITIVITY'],
    organs: ['BONES'],
    deficiency: 'METABOLIC_SYNDROME',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_OSTEOPROTEGERIN',
    name: 'Osteoprotegerin',
    categories: ['hormone', 'BONE'],
    mechanisms: ['OPG_UP', 'BONE_PROTECT'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GDF15',
    name: 'GDF‑15',
    categories: ['hormone', 'STRESS'],
    mechanisms: ['GDF15_UP', 'APPETITE_DOWN'],
    organs: ['CELLS'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL6',
    name: 'IL‑6 (hormonal)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL6_UP', 'INFLAMMATION_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL1B',
    name: 'IL‑1β (hormonal)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL1B_UP', 'INFLAMMATION_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TNF',
    name: 'TNF‑α (hormonal)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['TNF_UP', 'INFLAMMATION_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IFN_GAMMA',
    name: 'Interferon‑γ',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IFNG_UP', 'IMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL10',
    name: 'IL‑10',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL10_UP', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NT_PROBNP',
    name: 'NT‑proBNP',
    categories: ['hormone', 'HEART'],
    mechanisms: ['NT_PROBNP_UP', 'HEART_STRESS'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENDOTHELIN',
    name: 'Endothelin‑1',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ENDOTHELIN_UP', 'VASOCONSTRICTION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NO',
    name: 'Nitric Oxide (NO)',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['NO_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'ERECTILE_DYSFUNCTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROSTAGLANDIN_E2',
    name: 'PGE2',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['PGE2_UP', 'PAIN_UP'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROSTAGLANDIN_F2',
    name: 'PGF2α',
    categories: ['hormone', 'REPRODUCTIVE'],
    mechanisms: ['PGF2A_UP', 'UTERUS_CONTRACT'],
    organs: ['UTERUS'],
    deficiency: 'PMS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SEROTONIN_GUT',
    name: 'Serotonin (GI)',
    categories: ['hormone', 'GI'],
    mechanisms: ['SEROTONIN_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_DOPAMINE_PIT',
    name: 'Dopamine (Pituitary)',
    categories: ['hormone', 'PITUITARY'],
    mechanisms: ['DOPAMINE_UP', 'PROLACTIN_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'HYPERPROLACTINEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HISTAMINE',
    name: 'Histamine',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['HISTAMINE_UP', 'ALLERGY_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRADYKININ',
    name: 'Bradykinin',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['BRADYKININ_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROPEPTIDE_B',
    name: 'Neuropeptide B',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['NPB_UP', 'STRESS_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROPEPTIDE_W',
    name: 'Neuropeptide W',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['NPW_UP', 'ENERGY_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GALANIN',
    name: 'Galanin',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['GALANIN_UP', 'APPETITE_UP'],
    organs: ['BRAIN'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_OREXIN_A',
    name: 'Orexin‑A',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['OREXIN_UP', 'WAKE_UP'],
    organs: ['BRAIN'],
    deficiency: 'SLEEPINESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_OREXIN_B',
    name: 'Orexin‑B',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['OREXIN_UP', 'ENERGY_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LIPOCALIN2',
    name: 'Lipocalin‑2',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['LIPOCALIN2_UP', 'INFLAMMATION_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LEUKOTRIENE_B4',
    name: 'Leukotriene B4',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['LTB4_UP', 'INFLAMMATION_UP'],
    organs: ['TISSUES'],
    deficiency: 'ASTHMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LEUKOTRIENE_C4',
    name: 'Leukotriene C4',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['LTC4_UP', 'BRONCHO_CONSTRICT'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROSTACYCLIN',
    name: 'Prostacyclin (PGI2)',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['PGI2_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'CLOT_RISK',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_THROMBOXANE_A2',
    name: 'Thromboxane A2',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['TXA2_UP', 'CLOT_UP'],
    organs: ['PLATELETS'],
    deficiency: 'THROMBOSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENDOCANNABINOID_AEA',
    name: 'Anandamide (AEA)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['AEA_UP', 'RELAX'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENDOCANNABINOID_2AG',
    name: '2‑AG',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['2AG_UP', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROSTEROID_ALLOPREG',
    name: 'Allopregnanolone',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['ALLOPREG_UP', 'GABA_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NEUROSTEROID_PREG',
    name: 'Pregnenolone',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['PREGNENOLONE_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GABA_GUT',
    name: 'GABA (GI)',
    categories: ['hormone', 'GI'],
    mechanisms: ['GABA_UP', 'MOTILITY_DOWN'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ACETYLCHOLINE_GUT',
    name: 'Acetylcholine (GI)',
    categories: ['hormone', 'GI'],
    mechanisms: ['ACH_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SEROTONIN_PLATELETS',
    name: 'Serotonin (Platelets)',
    categories: ['hormone', 'BLOOD'],
    mechanisms: ['SEROTONIN_UP', 'CLOT_UP'],
    organs: ['PLATELETS'],
    deficiency: 'MIGRAINE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_NO_SYNTHASE',
    name: 'NOS‑derived NO',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['NO_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADRENOMEDULLIN',
    name: 'Adrenomedullin',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ADM_UP', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'HEART_FAILURE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VISFATIN',
    name: 'Visfatin',
    categories: ['hormone', 'FAT'],
    mechanisms: ['VISFATIN_UP', 'INSULIN_MIMETIC'],
    organs: ['FAT_TISSUE'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_APELIN',
    name: 'Apelin',
    categories: ['hormone', 'HEART'],
    mechanisms: ['APELIN_UP', 'CARDIO_PROTECT'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IRISIN',
    name: 'Irisin',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['IRISIN_UP', 'BROWN_FAT_UP'],
    organs: ['MUSCLES'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MYOSTATIN',
    name: 'Myostatin',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['MYOSTATIN_UP', 'MUSCLE_DOWN'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_FOLLISTATIN',
    name: 'Follistatin (endogenous)',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['FOLLISTATIN_UP', 'MYOSTATIN_DOWN'],
    organs: ['MUSCLES'],
    deficiency: 'MUSCLE_GROWTH',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANGIOTENSIN_1_7',
    name: 'Angiotensin 1‑7',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['ANG1_7_UP', 'VASODILATION'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANGIOTENSIN_III',
    name: 'Angiotensin III',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['ANG3_UP', 'BP_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GHRELIN_DESAC',
    name: 'Des‑acyl Ghrelin',
    categories: ['hormone', 'GI'],
    mechanisms: ['DES_GHRELIN_UP', 'HUNGER_MOD'],
    organs: ['GI'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPATOKINE_ANGPTL4',
    name: 'ANGPTL4',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['ANGPTL4_UP', 'LIPOLYSIS'],
    organs: ['LIVER'],
    deficiency: 'FAT_METABOLISM',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPATOKINE_FETUIN_A',
    name: 'Fetuin‑A',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['FETUIN_A_UP', 'INSULIN_RESISTANCE'],
    organs: ['LIVER'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPATOKINE_FETUIN_B',
    name: 'Fetuin‑B',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['FETUIN_B_UP', 'INSULIN_RESISTANCE'],
    organs: ['LIVER'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPATOKINE_SEXHBG',
    name: 'SHBG',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['SHBG_UP', 'SEX_HORM_BIND'],
    organs: ['LIVER'],
    deficiency: 'HORMONAL_IMBALANCE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPATOKINE_HGF',
    name: 'HGF (Hepatocyte Growth Factor)',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['HGF_UP', 'REGEN_UP'],
    organs: ['LIVER'],
    deficiency: 'LIVER_DAMAGE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BONE_SCLEROSTIN',
    name: 'Sclerostin',
    categories: ['hormone', 'BONE'],
    mechanisms: ['SCLEROSTIN_UP', 'BONE_DOWN'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BONE_RANKL',
    name: 'RANKL',
    categories: ['hormone', 'BONE'],
    mechanisms: ['RANKL_UP', 'BONE_RESORB'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BONE_OPN',
    name: 'Osteopontin',
    categories: ['hormone', 'BONE'],
    mechanisms: ['OPN_UP', 'INFLAMMATION_UP'],
    organs: ['BONES'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_MSH',
    name: 'MSH (Skin)',
    categories: ['hormone', 'SKIN'],
    mechanisms: ['MSH_UP', 'PIGMENT_UP'],
    organs: ['SKIN'],
    deficiency: 'PIGMENTATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_VEGF',
    name: 'VEGF (Skin)',
    categories: ['hormone', 'SKIN'],
    mechanisms: ['VEGF_UP', 'ANGIOGENESIS'],
    organs: ['SKIN'],
    deficiency: 'WOUND_HEALING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_TGF_BETA',
    name: 'TGF‑β (Skin)',
    categories: ['hormone', 'SKIN'],
    mechanisms: ['TGFb_UP', 'SCAR_UP'],
    organs: ['SKIN'],
    deficiency: 'FIBROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_IL33',
    name: 'IL‑33 (Skin)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL33_UP', 'INFLAMMATION_UP'],
    organs: ['SKIN'],
    deficiency: 'DERMATITIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LUNG_SURFACTANT',
    name: 'Surfactant Proteins',
    categories: ['hormone', 'LUNGS'],
    mechanisms: ['SURFACTANT_UP', 'BREATHING_UP'],
    organs: ['LUNGS'],
    deficiency: 'ARDS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LUNG_ENDOTHELIN_LUNG',
    name: 'Endothelin (Lung)',
    categories: ['hormone', 'LUNGS'],
    mechanisms: ['ENDOTHELIN_UP', 'BRONCHO_CONSTRICT'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_SOMATOSTATIN',
    name: 'Somatostatin (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['SST_UP', 'DIGESTION_DOWN'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_NEUROTENSIN',
    name: 'Neurotensin (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['NT_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_OXYNTOMODULIN',
    name: 'Oxyntomodulin',
    categories: ['hormone', 'GI'],
    mechanisms: ['OXYNTOMODULIN_UP', 'HUNGER_DOWN'],
    organs: ['GI'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_GASTRIC_INHIBITORY_POLYPEPTIDE',
    name: 'GIP (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['GIP_UP', 'INSULIN_UP'],
    organs: ['GI'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_NEUROMEDIN_U',
    name: 'Neuromedin‑U',
    categories: ['hormone', 'GI'],
    mechanisms: ['NMU_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_NEUROMEDIN_B',
    name: 'Neuromedin‑B',
    categories: ['hormone', 'GI'],
    mechanisms: ['NMB_UP', 'DIGESTION_UP'],
    organs: ['GI'],
    deficiency: 'DIGESTION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_PACAP',
    name: 'PACAP (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['PACAP_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'SLOW_GUT',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEART_ADRENOMEDULLIN',
    name: 'Adrenomedullin (Heart)',
    categories: ['hormone', 'HEART'],
    mechanisms: ['ADM_UP', 'VASODILATION'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEART_NP_C',
    name: 'NP‑C',
    categories: ['hormone', 'HEART'],
    mechanisms: ['NPC_UP', 'SODIUM_DOWN'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_KIDNEY_KLOTHO',
    name: 'Klotho',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['KLOTHO_UP', 'ANTIAGING'],
    organs: ['KIDNEYS'],
    deficiency: 'AGING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_KIDNEY_ERITROPOIETIN',
    name: 'EPO (Kidney)',
    categories: ['hormone', 'KIDNEY'],
    mechanisms: ['EPO_UP', 'RBC_UP'],
    organs: ['KIDNEYS'],
    deficiency: 'ANEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IMMUNE_TSLP',
    name: 'TSLP',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['TSLP_UP', 'ALLERGY_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ASTHMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IMMUNE_IL17',
    name: 'IL‑17',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL17_UP', 'AUTOIMMUNE_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LIPOXIN_A4',
    name: 'Lipoxin A4',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['LXA4_UP', 'RESOLUTION_UP'],
    organs: ['TISSUES'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LIPOXIN_B4',
    name: 'Lipoxin B4',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['LXB4_UP', 'ANTI_INFLAMMATION'],
    organs: ['TISSUES'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RESOLVIN_D1',
    name: 'Resolvin D1',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['RVD1_UP', 'RESOLUTION_UP'],
    organs: ['TISSUES'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_RESOLVIN_E1',
    name: 'Resolvin E1',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['RVE1_UP', 'ANTI_INFLAMMATION'],
    organs: ['TISSUES'],
    deficiency: 'INFLAMМATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PROTECTIN_D1',
    name: 'Protectin D1',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['PD1_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MARESIN_1',
    name: 'Maresin‑1',
    categories: ['hormone', 'INFLAMMATION'],
    mechanisms: ['MARESIN1_UP', 'RESOLUTION_UP'],
    organs: ['TISSUES'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_S1P',
    name: 'Sphingosine‑1‑phosphate (S1P)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['S1P_UP', 'LYMPH_FLOW'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CERAMIDE',
    name: 'Ceramide',
    categories: ['hormone', 'CELL'],
    mechanisms: ['CERAMIDE_UP', 'APOPTOSIS'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LPA',
    name: 'Lysophosphatidic Acid (LPA)',
    categories: ['hormone', 'CELL'],
    mechanisms: ['LPA_UP', 'CELL_GROWTH'],
    organs: ['TISSUES'],
    deficiency: 'FIBROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PAF',
    name: 'Platelet‑Activating Factor (PAF)',
    categories: ['hormone', 'BLOOD'],
    mechanisms: ['PAF_UP', 'CLOT_UP'],
    organs: ['BLOOD'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENDOTHELIN_2',
    name: 'Endothelin‑2',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ET2_UP', 'VASOCONSTRICTION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ENDOTHELIN_3',
    name: 'Endothelin‑3',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ET3_UP', 'NEURO_MOD'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VEGF_B',
    name: 'VEGF‑B',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['VEGFB_UP', 'ANGIOGENESIS'],
    organs: ['VESSELS'],
    deficiency: 'ISCHEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VEGF_C',
    name: 'VEGF‑C',
    categories: ['hormone', 'LYMPH'],
    mechanisms: ['VEGFC_UP', 'LYMPH_FLOW'],
    organs: ['LYMPHATIC'],
    deficiency: 'LYMPHEDEMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_VEGF_D',
    name: 'VEGF‑D',
    categories: ['hormone', 'LYMPH'],
    mechanisms: ['VEGFD_UP', 'LYMPH_FLOW'],
    organs: ['LYMPHATIC'],
    deficiency: 'LYMPHEDEMA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PDGF_A',
    name: 'PDGF‑A',
    categories: ['hormone', 'TISSUE'],
    mechanisms: ['PDGFA_UP', 'FIBROBLAST_UP'],
    organs: ['TISSUES'],
    deficiency: 'SCARRING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_PDGF_B',
    name: 'PDGF‑B',
    categories: ['hormone', 'TISSUE'],
    mechanisms: ['PDGFB_UP', 'ANGIOGENESIS'],
    organs: ['TISSUES'],
    deficiency: 'WOUND_HEALING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TGF_B1',
    name: 'TGF‑β1',
    categories: ['hormone', 'TISSUE'],
    mechanisms: ['TGFb1_UP', 'FIBROSIS'],
    organs: ['TISSUES'],
    deficiency: 'FIBROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TGF_B2',
    name: 'TGF‑β2',
    categories: ['hormone', 'TISSUE'],
    mechanisms: ['TGFb2_UP', 'IMMUNE_MOD'],
    organs: ['TISSUES'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_TGF_B3',
    name: 'TGF‑β3',
    categories: ['hormone', 'TISSUE'],
    mechanisms: ['TGFb3_UP', 'SCAR_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'SCARRING',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL18',
    name: 'IL‑18',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL18_UP', 'INFLAMMATION_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL22',
    name: 'IL‑22',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL22_UP', 'BARRIER_UP'],
    organs: ['SKIN', 'GI'],
    deficiency: 'DERMATITIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_IL23',
    name: 'IL‑23',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['IL23_UP', 'TH17_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_CSF1',
    name: 'CSF‑1 (M‑CSF)',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['CSF1_UP', 'MACROPHAGE_UP'],
    organs: ['BONE_MARROW'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_G_CSF',
    name: 'G‑CSF',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['GCSF_UP', 'NEUTROPHIL_UP'],
    organs: ['BONE_MARROW'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GM_CSF',
    name: 'GM‑CSF',
    categories: ['hormone', 'IMMUNE'],
    mechanisms: ['GMCSF_UP', 'WBC_UP'],
    organs: ['BONE_MARROW'],
    deficiency: 'IMMUNE_WEAK',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ERITROFERRONE',
    name: 'Erythroferrone',
    categories: ['hormone', 'BLOOD'],
    mechanisms: ['ERFE_UP', 'IRON_UP'],
    organs: ['BONE_MARROW'],
    deficiency: 'ANEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_HEPCIDIN_LIVER',
    name: 'Hepcidin (Liver)',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['HEPCIDIN_UP', 'IRON_DOWN'],
    organs: ['LIVER'],
    deficiency: 'ANEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANGPT1',
    name: 'Angiopoietin‑1',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ANGPT1_UP', 'VESSEL_STABILITY'],
    organs: ['VESSELS'],
    deficiency: 'ISCHEMIA',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ANGPT2',
    name: 'Angiopoietin‑2',
    categories: ['hormone', 'VESSELS'],
    mechanisms: ['ANGPT2_UP', 'VESSEL_LEAK'],
    organs: ['VESSELS'],
    deficiency: 'INFLAMMATION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LEPTIN_RECEPTOR',
    name: 'Leptin‑Receptor Signal',
    categories: ['hormone', 'FAT'],
    mechanisms: ['LEPTIN_SIGNAL', 'SATIETY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADIPOKINE_RETNLB',
    name: 'Resistin‑Like Beta',
    categories: ['hormone', 'FAT'],
    mechanisms: ['RETNLB_UP', 'INFLAMMATION_UP'],
    organs: ['FAT_TISSUE'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADIPOKINE_CHEMERIN',
    name: 'Chemerin',
    categories: ['hormone', 'FAT'],
    mechanisms: ['CHEMERIN_UP', 'INFLAMMATION_UP'],
    organs: ['FAT_TISSUE'],
    deficiency: 'METABOLIC_SYNDROME',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADIPOKINE_OMENTIN',
    name: 'Omentin',
    categories: ['hormone', 'FAT'],
    mechanisms: ['OMENTIN_UP', 'INSULIN_SENSITIVITY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'DIABETES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_ADIPOKINE_ZAG',
    name: 'ZAG (Zinc‑alpha2‑glycoprotein)',
    categories: ['hormone', 'FAT'],
    mechanisms: ['ZAG_UP', 'LIPOLYSIS'],
    organs: ['FAT_TISSUE'],
    deficiency: 'OBESITY',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MYOKINE_IL6',
    name: 'IL‑6 (Muscle)',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['IL6_UP', 'ENERGY_UP'],
    organs: ['MUSCLES'],
    deficiency: 'EXERCISE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MYOKINE_IL15',
    name: 'IL‑15',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['IL15_UP', 'MUSCLE_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_MUSCLE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_MYOKINE_BDNF',
    name: 'BDNF (Muscle)',
    categories: ['hormone', 'MUSCLE'],
    mechanisms: ['BDNF_UP', 'FAT_BURN'],
    organs: ['MUSCLES'],
    deficiency: 'FATIGUE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRAIN_NGF',
    name: 'NGF (Brain)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['NGF_UP', 'NEUROREGEN'],
    organs: ['BRAIN'],
    deficiency: 'NEURO_DEGEN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRAIN_BDNF',
    name: 'BDNF (Brain)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['BDNF_UP', 'NEUROPLASTICITY'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRAIN_GDNF',
    name: 'GDNF',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['GDNF_UP', 'DOPAMINE_UP'],
    organs: ['BRAIN'],
    deficiency: 'PARKINSON',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRAIN_NTS',
    name: 'Neurotensin (Brain)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['NTS_UP', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BRAIN_CRF',
    name: 'CRF (Brain)',
    categories: ['hormone', 'NEURO'],
    mechanisms: ['CRF_UP', 'STRESS_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_ENDORPHIN',
    name: 'β‑Endorphin (Skin)',
    categories: ['hormone', 'SKIN'],
    mechanisms: ['ENDORPHIN_UP', 'PAIN_DOWN'],
    organs: ['SKIN'],
    deficiency: 'DERMATITIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_SKIN_CGRP',
    name: 'CGRP (Skin)',
    categories: ['hormone', 'SKIN'],
    mechanisms: ['CGRP_UP', 'VASODILATION'],
    organs: ['SKIN'],
    deficiency: 'MIGRAINE',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_GALANIN',
    name: 'Galanin (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['GALANIN_UP', 'MOTILITY_DOWN'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_GUT_SUBSTANCE_P',
    name: 'Substance P (Gut)',
    categories: ['hormone', 'GI'],
    mechanisms: ['SP_UP', 'PAIN_UP'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LIVER_ANGPTL8',
    name: 'ANGPTL8',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['ANGPTL8_UP', 'LIPID_MOD'],
    organs: ['LIVER'],
    deficiency: 'FATTY_LIVER',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_LIVER_FGF19',
    name: 'FGF‑19',
    categories: ['hormone', 'LIVER'],
    mechanisms: ['FGF19_UP', 'BILE_FLOW'],
    organs: ['LIVER'],
    deficiency: 'GI_ISSUES',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BONE_DKK1',
    name: 'DKK‑1',
    categories: ['hormone', 'BONE'],
    mechanisms: ['DKK1_UP', 'BONE_DOWN'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'HORM_BONE_WNT',
    name: 'WNT‑Signal',
    categories: ['hormone', 'BONE'],
    mechanisms: ['WNT_UP', 'BONE_UP'],
    organs: ['BONES'],
    deficiency: 'OSTEOPOROSIS',
    description: 'Гормон для гормонального баланса',
    type: 'hormone'
  },
  {
    id: 'PHARMA_PIRACETAM',
    name: 'Piracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_UP', 'NEUROPLASTICITY'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ANIRACETAM',
    name: 'Aniracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['AMPA_UP', 'ANXIOLYTIC'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_OXIRACETAM',
    name: 'Oxiracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GLUTAMATE_UP', 'MEMORY_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PRAMIRACETAM',
    name: 'Pramiracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_UP', 'FOCUS_UP'],
    organs: ['BRAIN'],
    deficiency: 'FOCUS',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FASORACETAM',
    name: 'Fasoracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GABA_UP', 'AMPA_MOD'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_COLURACETAM',
    name: 'Coluracetam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_SYNTHESIS_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NOOPEPT',
    name: 'Noopept',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BDNF_UP', 'NGF_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SEMAX',
    name: 'Semax (pharma)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BDNF_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SELANK',
    name: 'Selank (pharma)',
    categories: ['pharma', 'nootropic', 'anxiolytic'],
    mechanisms: ['GABA_UP', 'NEURO_SIGNALING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций, снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CITICOLINE',
    name: 'Citicoline (CDP‑Choline)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_UP', 'PHOSPHOLIPIDS_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ALPHA_GPC',
    name: 'Alpha‑GPC',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_UP', 'GH_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VINPOCETINE',
    name: 'Vinpocetine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BLOOD_FLOW_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'HEADACHE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VINCAMINE',
    name: 'Vincamine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'VERTIGO',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NICERGOLINE',
    name: 'Nicergoline',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ALPHA_BLOCK', 'BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'MIGRAINE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CINNARIZINE',
    name: 'Cinnarizine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['CALCIUM_BLOCK', 'VESTIBULAR_MOD'],
    organs: ['BRAIN'],
    deficiency: 'VERTIGO',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FLUNARIZINE',
    name: 'Flunarizine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['CALCIUM_BLOCK', 'MIGRAINE_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'MIGRAINE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MODAFINIL',
    name: 'Modafinil',
    categories: ['pharma', 'stimulant', 'nootropic'],
    mechanisms: ['DOPAMINE_UP', 'OREXIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ADRAFINIL',
    name: 'Adrafinil',
    categories: ['pharma', 'stimulant', 'nootropic'],
    mechanisms: ['DOPAMINE_UP', 'WAKE_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SELEGILINE',
    name: 'Selegiline',
    categories: ['pharma', 'nootropic', 'MAO_B_INHIBITOR'],
    mechanisms: ['DOPAMINE_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'LOW_MOOD',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RASAGILINE',
    name: 'Rasagiline',
    categories: ['pharma', 'nootropic', 'MAO_B_INHIBITOR'],
    mechanisms: ['DOPAMINE_UP'],
    organs: ['BRAIN'],
    deficiency: 'PARKINSON',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MEMANTINE',
    name: 'Memantine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NMDA_BLOCK', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMANTADINE',
    name: 'Amantadine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NMDA_BLOCK', 'DOPAMINE_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BROMANTANE',
    name: 'Bromantane',
    categories: ['pharma', 'nootropic', 'adaptogen'],
    mechanisms: ['DOPAMINE_UP', 'IMMUNE_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций, адаптации к стрессу',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TIANEPTINE',
    name: 'Tianeptine',
    categories: ['pharma', 'nootropic', 'anxiolytic'],
    mechanisms: ['GLUTAMATE_MOD', 'MOOD_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций, снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_HUPERZINE_A',
    name: 'Huperzine‑A',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ACH_INHIBITOR', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMPAKINE_SUN',
    name: 'SUN‑11602 (Ampakine)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['AMPA_UP', 'NEUROPLASTICITY'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMPAKINE_FAR',
    name: 'FAR‑AMPAKINE',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['AMPA_UP', 'MEMORY_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PROGLUMETACIN',
    name: 'Proglumetacin',
    categories: ['pharma', 'nootropic', 'antiinflammatory'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'HEADACHE',
    description: 'Фармсредство для когнитивных функций, противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CEREBROLYSIN',
    name: 'Cerebrolysin',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NEUROTROPHIC_UP', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'STROKE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CORTEXIN',
    name: 'Cortexin',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NEUROPEPTIDE_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ACTOVEGIN',
    name: 'Actovegin',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BLOOD_FLOW_UP', 'CELL_METABOLISM_UP'],
    organs: ['BRAIN'],
    deficiency: 'STROKE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MEXIDOL',
    name: 'Mexidol',
    categories: ['pharma', 'nootropic', 'antioxidant'],
    mechanisms: ['ANTIOX_UP', 'GABA_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Фармсредство для когнитивных функций, защиты клеток от окислительного стресса',
    type: 'pharma'
  },
  {
    id: 'PHARMA_EMOXYPINE',
    name: 'Emoxypine',
    categories: ['pharma', 'nootropic', 'antioxidant'],
    mechanisms: ['ANTIOX_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Фармсредство для когнитивных функций, защиты клеток от окислительного стресса',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PICAMILON',
    name: 'Picamilon',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GABA_UP', 'BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PANTOGAM',
    name: 'Pantogam',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GABA_UP', 'NEUROPROTECTION'],
    organs: ['BRAIN'],
    deficiency: 'ADHD',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PANTOCALCIN',
    name: 'Pantocalcin',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GABA_UP', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FENIBUT',
    name: 'Phenibut',
    categories: ['pharma', 'nootropic', 'anxiolytic'],
    mechanisms: ['GABA_UP', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций, снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BACLOFEN',
    name: 'Baclofen',
    categories: ['pharma', 'nootropic', 'GABA_B'],
    mechanisms: ['GABA_B_UP', 'SPASM_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'SPASTICITY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CYTOFLAVIN',
    name: 'Cytoflavin',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['ATP_UP', 'BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MELDONIUM',
    name: 'Meldonium',
    categories: ['pharma', 'nootropic', 'metabolic'],
    mechanisms: ['CARNITINE_MOD', 'ENERGY_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TRIMETAZIDINE',
    name: 'Trimetazidine',
    categories: ['pharma', 'nootropic', 'cardio'],
    mechanisms: ['METABOLISM_SHIFT', 'ATP_UP'],
    organs: ['HEART'],
    deficiency: 'ANGINA',
    description: 'Фармсредство для когнитивных функций, ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NICOTINAMIDE',
    name: 'Nicotinamide (B3)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NAD_UP', 'ENERGY_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NMN',
    name: 'NMN (pharma)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NAD_UP', 'MITO_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NR',
    name: 'Nicotinamide Riboside',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['NAD_UP', 'MITO_UP'],
    organs: ['CELLS'],
    deficiency: 'AGING',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LYTHIUM_OROTATE',
    name: 'Lithium Orotate',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['BDNF_UP', 'MOOD_STABILIZE'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_SWINGS',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_THEANINE',
    name: 'L‑Theanine (pharma)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['GABA_UP', 'ALPHA_WAVES_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CAFFEINE',
    name: 'Caffeine (pharma)',
    categories: ['pharma', 'stimulant'],
    mechanisms: ['ADENOSINE_BLOCK', 'WAKE_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_THEOBROMINE',
    name: 'Theobromine',
    categories: ['pharma', 'stimulant'],
    mechanisms: ['ADENOSINE_BLOCK', 'BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SULBUTIAMINE',
    name: 'Sulbutiamine',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['DOPAMINE_UP', 'ENERGY_UP'],
    organs: ['BRAIN'],
    deficiency: 'FATIGUE',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TYROSINE',
    name: 'Tyrosine (pharma)',
    categories: ['pharma', 'nootropic'],
    mechanisms: ['DOPAMINE_UP', 'NEUROTRANSMITTER_UP'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Фармсредство для когнитивных функций',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SERTRALINE',
    name: 'Sertraline',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FLUOXETINE',
    name: 'Fluoxetine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PAROXETINE',
    name: 'Paroxetine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ESCITALOPRAM',
    name: 'Escitalopram',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CITALOPRAM',
    name: 'Citalopram',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SERTRALINE',
    name: 'Sertraline',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FLUVOXAMINE',
    name: 'Fluvoxamine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SSRI', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'OCD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VENLAFAXINE',
    name: 'Venlafaxine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SNRI', 'SEROTONIN_UP', 'NE_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DESVENLAFAXINE',
    name: 'Desvenlafaxine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SNRI', 'NE_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DULOXETINE',
    name: 'Duloxetine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SNRI', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MILNACIPRAN',
    name: 'Milnacipran',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SNRI', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'FIBROMYALGIA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BUPROPION',
    name: 'Bupropion',
    categories: ['pharma', 'antidepressant', 'stimulant'],
    mechanisms: ['DOPAMINE_UP', 'NE_UP'],
    organs: ['BRAIN'],
    deficiency: 'LOW_MOTIVATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MIRTAZAPINE',
    name: 'Mirtazapine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['ALPHA2_BLOCK', 'SEROTONIN_UP', 'HUNGER_UP'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TRAZODONE',
    name: 'Trazodone',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SEROTONIN_MOD', 'SLEEP_UP'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AGOMELATINE',
    name: 'Agomelatine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['MELATONIN_AGONIST', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VORTIOXETINE',
    name: 'Vortioxetine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['SEROTONIN_MOD', 'COGNITION_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TIANEPTINE',
    name: 'Tianeptine (pharma)',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['GLUTAMATE_MOD', 'MOOD_UP'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMITRIPTYLINE',
    name: 'Amitriptyline',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['TCA', 'SEROTONIN_UP', 'NE_UP'],
    organs: ['BRAIN'],
    deficiency: 'PAIN',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_IMIPRAMINE',
    name: 'Imipramine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['TCA', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CLOMIPRAMINE',
    name: 'Clomipramine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['TCA', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'OCD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MAOI_SELEGILINE',
    name: 'Selegiline (MAOI)',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['MAO_B_INHIBITOR', 'DOPAMINE_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MAOI_TRANYLCYPROMINE',
    name: 'Tranylcypromine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['MAO_INHIBITOR', 'MONOAMINES_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BUSPIRONE',
    name: 'Buspirone',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['5HT1A_AGONIST', 'ANXIETY_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_HYDROXYZINE',
    name: 'Hydroxyzine',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['H1_BLOCK', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PREGABALIN',
    name: 'Pregabalin',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['CALCIUM_MOD', 'ANXIETY_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GABAPENTIN',
    name: 'Gabapentin',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['CALCIUM_MOD', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DIAZEPAM',
    name: 'Diazepam',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_A_UP', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LORAZEPAM',
    name: 'Lorazepam',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_A_UP', 'SEDATION'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ALPRAZOLAM',
    name: 'Alprazolam',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_A_UP', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'PANIC',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CLONAZEPAM',
    name: 'Clonazepam',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_A_UP', 'SEIZURE_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ETIZOLAM',
    name: 'Etizolam',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_A_UP', 'CALMING'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PROPRANOLOL',
    name: 'Propranolol (anxiety)',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['BETA_BLOCK', 'ADRENALINE_DOWN'],
    organs: ['HEART'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_QUETIAPINE_LOW',
    name: 'Quetiapine (low dose)',
    categories: ['pharma', 'anxiolytic', 'sedative'],
    mechanisms: ['H1_BLOCK', 'SEROTONIN_MOD'],
    organs: ['BRAIN'],
    deficiency: 'INSOMNIA',
    description: 'Фармсредство для снижения тревоги, успокоения',
    type: 'pharma'
  },
  {
    id: 'PHARMA_OLANZAPINE',
    name: 'Olanzapine',
    categories: ['pharma', 'antipsychotic', 'anxiolytic'],
    mechanisms: ['D2_BLOCK', 'SEROTONIN_BLOCK'],
    organs: ['BRAIN'],
    deficiency: 'AGITATION',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RISPERIDONE',
    name: 'Risperidone',
    categories: ['pharma', 'antipsychotic'],
    mechanisms: ['D2_BLOCK', 'SEROTONIN_BLOCK'],
    organs: ['BRAIN'],
    deficiency: 'AGITATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ARIPIPRAZOLE',
    name: 'Aripiprazole',
    categories: ['pharma', 'antipsychotic', 'antidepressant'],
    mechanisms: ['D2_PARTIAL', 'SEROTONIN_MOD'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LAMOTRIGINE',
    name: 'Lamotrigine',
    categories: ['pharma', 'mood_stabilizer'],
    mechanisms: ['GLUTAMATE_DOWN', 'MOOD_STABILIZE'],
    organs: ['BRAIN'],
    deficiency: 'BIPOLAR',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VALPROATE',
    name: 'Valproate',
    categories: ['pharma', 'mood_stabilizer'],
    mechanisms: ['GABA_UP', 'MOOD_STABILIZE'],
    organs: ['BRAIN'],
    deficiency: 'BIPOLAR',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LITHIUM',
    name: 'Lithium Carbonate',
    categories: ['pharma', 'mood_stabilizer'],
    mechanisms: ['BDNF_UP', 'MOOD_STABILIZE'],
    organs: ['BRAIN'],
    deficiency: 'BIPOLAR',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_KETAMINE',
    name: 'Ketamine (low dose)',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['NMDA_BLOCK', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ESKETAMINE',
    name: 'EsKetamine',
    categories: ['pharma', 'antidepressant'],
    mechanisms: ['NMDA_BLOCK', 'RAPID_ANTIDEPRESSANT'],
    organs: ['BRAIN'],
    deficiency: 'DEPRESSION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CARBAMAZEPINE',
    name: 'Carbamazepine',
    categories: ['pharma', 'mood_stabilizer'],
    mechanisms: ['SODIUM_BLOCK', 'MOOD_STABILIZE'],
    organs: ['BRAIN'],
    deficiency: 'BIPOLAR',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TOPIRAMATE',
    name: 'Topiramate',
    categories: ['pharma', 'mood_stabilizer'],
    mechanisms: ['GABA_UP', 'GLUTAMATE_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'MOOD_SWINGS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PROCHLORPERAZINE',
    name: 'Prochlorperazine',
    categories: ['pharma', 'antipsychotic'],
    mechanisms: ['D2_BLOCK', 'ANTI_NAUSEA'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CYPROHEPTADINE',
    name: 'Cyproheptadine',
    categories: ['pharma', 'serotonin_block'],
    mechanisms: ['SEROTONIN_BLOCK', 'HISTAMINE_UP'],
    organs: ['BRAIN'],
    deficiency: 'SEROTONIN_SYNDROME',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BETAHISTINE',
    name: 'Betahistine',
    categories: ['pharma', 'vestibular'],
    mechanisms: ['HISTAMINE_MOD', 'BLOOD_FLOW_UP'],
    organs: ['BRAIN'],
    deficiency: 'VERTIGO',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MIANESIN',
    name: 'Mianesin',
    categories: ['pharma', 'anxiolytic'],
    mechanisms: ['GABA_UP', 'MUSCLE_RELAX'],
    organs: ['BRAIN'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TIZANIDINE',
    name: 'Tizanidine',
    categories: ['pharma', 'anxiolytic', 'muscle_relax'],
    mechanisms: ['ALPHA2_AGONIST', 'SPASM_DOWN'],
    organs: ['SPINE'],
    deficiency: 'SPASTICITY',
    description: 'Фармсредство для снижения тревоги',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METFORMIN',
    name: 'Metformin',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['AMPK_UP', 'GLUCOSE_DOWN'],
    organs: ['PANCREAS', 'LIVER'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GLUCOBAY',
    name: 'Acarbose',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['ALPHA_GLUCO_INHIBIT', 'GLUCOSE_DOWN'],
    organs: ['GI'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PIOGLITAZONE',
    name: 'Pioglitazone',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['PPAR_GAMMA_UP', 'INSULIN_SENSITIVITY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ROSIGLITAZONE',
    name: 'Rosiglitazone',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['PPAR_GAMMA_UP', 'INSULIN_SENSITIVITY'],
    organs: ['FAT_TISSUE'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SITAGLIPTIN',
    name: 'Sitagliptin',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['DPP4_INHIBIT', 'GLP1_UP'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VILDAGLIPTIN',
    name: 'Vildagliptin',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['DPP4_INHIBIT', 'GLP1_UP'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LINAGLIPTIN',
    name: 'Linagliptin',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['DPP4_INHIBIT', 'GLP1_UP'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_EXENATIDE',
    name: 'Exenatide',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['GLP1_AGONIST', 'INSULIN_UP'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LIRAGLUTIDE',
    name: 'Liraglutide',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['GLP1_AGONIST', 'HUNGER_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'OBESITY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SEMAGLUTIDE',
    name: 'Semaglutide',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['GLP1_AGONIST', 'HUNGER_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'OBESITY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INSULIN_HUMAN',
    name: 'Insulin Human',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['INSULIN_UP', 'GLUCOSE_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INSULIN_ANALOG_FAST',
    name: 'Insulin Aspart',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['INSULIN_UP', 'GLUCOSE_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INSULIN_ANALOG_LONG',
    name: 'Insulin Glargine',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['INSULIN_UP', 'GLUCOSE_DOWN'],
    organs: ['PANCREAS'],
    deficiency: 'DIABETES',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LEVOTHYROXINE',
    name: 'Levothyroxine (T4)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['T4_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LIOTHYRONINE',
    name: 'Liothyronine (T3)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['T3_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PTU',
    name: 'Propylthiouracil',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['T4_BLOCK', 'T3_BLOCK'],
    organs: ['THYROID'],
    deficiency: 'HYPERTHYROIDISM',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METHIMAZOLE',
    name: 'Methimazole',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['T4_BLOCK', 'T3_BLOCK'],
    organs: ['THYROID'],
    deficiency: 'HYPERTHYROIDISM',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_HYDROCORTISONE',
    name: 'Hydrocortisone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['CORTISOL_UP', 'ANTI_INFLAMMATION'],
    organs: ['ADRENALS'],
    deficiency: 'ADRENAL_INSUFF',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PREDNISOLONE',
    name: 'Prednisolone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['CORTISOL_ANALOG', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DEXAMETHASONE',
    name: 'Dexamethasone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['CORTISOL_ANALOG', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FLUDROCORTISONE',
    name: 'Fludrocortisone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['ALDOSTERONE_UP', 'SODIUM_RETAIN'],
    organs: ['ADRENALS'],
    deficiency: 'ADDISON',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TESTOSTERONE',
    name: 'Testosterone (pharma)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['TESTOSTERONE_UP', 'ANABOLISM'],
    organs: ['TESTES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TESTOSTERONE_GEL',
    name: 'Testosterone Gel',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['TESTOSTERONE_UP', 'ANABOLISM'],
    organs: ['SKIN'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TESTOSTERONE_UNDECANOATE',
    name: 'Testosterone Undecanoate',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['TESTOSTERONE_UP', 'ANABOLISM'],
    organs: ['TESTES'],
    deficiency: 'LOW_TESTOSTERONE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DHT_GEL',
    name: 'DHT Gel',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['DHT_UP', 'ANDROGENIC_EFFECTS'],
    organs: ['SKIN'],
    deficiency: 'LOW_LIBIDO',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ESTRADIOL',
    name: 'Estradiol (pharma)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['E2_UP', 'FERTILITY'],
    organs: ['OVARIES'],
    deficiency: 'LOW_E2',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ESTRADIOL_PATCH',
    name: 'Estradiol Patch',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['E2_UP', 'MENOPAUSE'],
    organs: ['SKIN'],
    deficiency: 'MENOPAUSE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PROGESTERONE',
    name: 'Progesterone (pharma)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['PROGESTERONE_UP', 'CALMING'],
    organs: ['OVARIES'],
    deficiency: 'ANXIETY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DYDROGESTERONE',
    name: 'Dydrogesterone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['PROGESTERONE_UP', 'UTERUS_SUPPORT'],
    organs: ['UTERUS'],
    deficiency: 'PMS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CABERGOLINE',
    name: 'Cabergoline',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['DOPAMINE_UP', 'PROLACTIN_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'HYPERPROLACTINEMIA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BROMOCRIPTINE',
    name: 'Bromocriptine',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['DOPAMINE_UP', 'PROLACTIN_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'HYPERPROLACTINEMIA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_HCG',
    name: 'hCG (pharma)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['HCG_UP', 'TESTOSTERONE_UP'],
    organs: ['TESTES'],
    deficiency: 'INFERTILITY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GNRH_AGONIST',
    name: 'Leuprorelin',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['GNRH_AGONIST', 'LH_FSH_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'PCOS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GNRH_ANTAGONIST',
    name: 'Cetrorelix',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['GNRH_BLOCK', 'LH_FSH_DOWN'],
    organs: ['PITUITARY'],
    deficiency: 'IVF',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GH',
    name: 'Somatropin (GH)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['GH_UP', 'IGF1_UP'],
    organs: ['PITUITARY'],
    deficiency: 'LOW_GH',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_IGF1',
    name: 'IGF‑1 (pharma)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['IGF1_UP', 'ANABOLISM'],
    organs: ['LIVER'],
    deficiency: 'LOW_IGF1',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DESMOPRESSIN',
    name: 'Desmopressin',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['ADH_UP', 'WATER_RETAIN'],
    organs: ['KIDNEYS'],
    deficiency: 'DIABETES_INSIPIDUS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SPIRONOLACTONE',
    name: 'Spironolactone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['ALDOSTERONE_BLOCK', 'ANDROGEN_BLOCK'],
    organs: ['KIDNEYS'],
    deficiency: 'ACNE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FINASTERIDE',
    name: 'Finasteride',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['DHT_BLOCK', 'HAIR_PROTECT'],
    organs: ['SKIN'],
    deficiency: 'HAIR_LOSS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DUTASTERIDE',
    name: 'Dutasteride',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['DHT_BLOCK', 'PROSTATE_PROTECT'],
    organs: ['PROSTATE'],
    deficiency: 'BPH',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ORLISTAT',
    name: 'Orlistat',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['LIPASE_BLOCK', 'FAT_ABSORB_DOWN'],
    organs: ['GI'],
    deficiency: 'OBESITY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ACETAZOLAMIDE',
    name: 'Acetazolamide',
    categories: ['pharma', 'metabolic'],
    mechanisms: ['CARBONIC_ANHYDRASE_BLOCK', 'PH_MOD'],
    organs: ['KIDNEYS'],
    deficiency: 'ALTITUDE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_THYROID_DESICCATED',
    name: 'Desiccated Thyroid',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['T3_T4_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MIFEPRISTONE',
    name: 'Mifepristone',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['PROGESTERONE_BLOCK', 'CORTISOL_BLOCK'],
    organs: ['UTERUS'],
    deficiency: 'CUSHING',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_KETOCONAZOLE_HORM',
    name: 'Ketoconazole (hormonal)',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['CORTISOL_BLOCK', 'ANDROGEN_BLOCK'],
    organs: ['ADRENALS'],
    deficiency: 'CUSHING',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MITOTANE',
    name: 'Mitotane',
    categories: ['pharma', 'hormonal'],
    mechanisms: ['ADRENAL_SUPPRESS', 'CORTISOL_DOWN'],
    organs: ['ADRENALS'],
    deficiency: 'CUSHING',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ATORVASTATIN',
    name: 'Atorvastatin',
    categories: ['pharma', 'cardio'],
    mechanisms: ['HMGCR_BLOCK', 'LDL_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_LDL',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ROSUVASTATIN',
    name: 'Rosuvastatin',
    categories: ['pharma', 'cardio'],
    mechanisms: ['HMGCR_BLOCK', 'LDL_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_LDL',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SIMVASTATIN',
    name: 'Simvastatin',
    categories: ['pharma', 'cardio'],
    mechanisms: ['HMGCR_BLOCK', 'LDL_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_LDL',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_EZETIMIBE',
    name: 'Ezetimibe',
    categories: ['pharma', 'cardio'],
    mechanisms: ['CHOLESTEROL_ABSORB_BLOCK', 'LDL_DOWN'],
    organs: ['GI'],
    deficiency: 'HIGH_LDL',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FENOFIBRATE',
    name: 'Fenofibrate',
    categories: ['pharma', 'cardio'],
    mechanisms: ['PPAR_ALPHA_UP', 'TRIGLYCERIDES_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_TG',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_GEMFIBROZIL',
    name: 'Gemfibrozil',
    categories: ['pharma', 'cardio'],
    mechanisms: ['PPAR_ALPHA_UP', 'TRIGLYCERIDES_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_TG',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NIACIN',
    name: 'Niacin (B3 pharma)',
    categories: ['pharma', 'cardio'],
    mechanisms: ['HDL_UP', 'LDL_DOWN'],
    organs: ['LIVER'],
    deficiency: 'HIGH_LIPIDS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_OMEGA3_RX',
    name: 'Omega‑3 Rx',
    categories: ['pharma', 'cardio'],
    mechanisms: ['TRIGLYCERIDES_DOWN', 'ANTI_INFLAMMATION'],
    organs: ['BLOOD'],
    deficiency: 'HIGH_TG',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CLOPIDOGREL',
    name: 'Clopidogrel',
    categories: ['pharma', 'cardio'],
    mechanisms: ['PLATELET_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TICAGRELOR',
    name: 'Ticagrelor',
    categories: ['pharma', 'cardio'],
    mechanisms: ['PLATELET_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PRASUGREL',
    name: 'Prasugrel',
    categories: ['pharma', 'cardio'],
    mechanisms: ['PLATELET_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_WARFARIN',
    name: 'Warfarin',
    categories: ['pharma', 'cardio'],
    mechanisms: ['VITK_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_APIXABAN',
    name: 'Apixaban',
    categories: ['pharma', 'cardio'],
    mechanisms: ['FACTOR_XA_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RIVAROXABAN',
    name: 'Rivaroxaban',
    categories: ['pharma', 'cardio'],
    mechanisms: ['FACTOR_XA_BLOCK', 'CLOT_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'THROMBOSIS',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ENALAPRIL',
    name: 'Enalapril',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ACE_BLOCK', 'BP_DOWN'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LISINOPRIL',
    name: 'Lisinopril',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ACE_BLOCK', 'BP_DOWN'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RAMIPRIL',
    name: 'Ramipril',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ACE_BLOCK', 'BP_DOWN'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LOSARTAN',
    name: 'Losartan',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ANG2_BLOCK', 'BP_DOWN'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VALSARTAN',
    name: 'Valsartan',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ANG2_BLOCK', 'BP_DOWN'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TELMISARTAN',
    name: 'Telmisartan',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ANG2_BLOCK', 'PPAR_UP'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMLODIPINE',
    name: 'Amlodipine',
    categories: ['pharma', 'cardio'],
    mechanisms: ['CALCIUM_BLOCK', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NIFEDIPINE',
    name: 'Nifedipine',
    categories: ['pharma', 'cardio'],
    mechanisms: ['CALCIUM_BLOCK', 'VASODILATION'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VERAPAMIL',
    name: 'Verapamil',
    categories: ['pharma', 'cardio'],
    mechanisms: ['CALCIUM_BLOCK', 'HEART_RATE_DOWN'],
    organs: ['HEART'],
    deficiency: 'ARRHYTHMIA',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METOPROLOL',
    name: 'Metoprolol',
    categories: ['pharma', 'cardio'],
    mechanisms: ['BETA1_BLOCK', 'BP_DOWN'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BISOPROLOL',
    name: 'Bisoprolol',
    categories: ['pharma', 'cardio'],
    mechanisms: ['BETA1_BLOCK', 'BP_DOWN'],
    organs: ['HEART'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CARVEDILOL',
    name: 'Carvedilol',
    categories: ['pharma', 'cardio'],
    mechanisms: ['BETA_BLOCK', 'ALPHA_BLOCK'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DIGOXIN',
    name: 'Digoxin',
    categories: ['pharma', 'cardio'],
    mechanisms: ['NAK_ATPASE_BLOCK', 'HEART_FORCE_UP'],
    organs: ['HEART'],
    deficiency: 'HEART_FAILURE',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FUROSEMIDE',
    name: 'Furosemide',
    categories: ['pharma', 'cardio'],
    mechanisms: ['LOOP_DIURETIC', 'SODIUM_DOWN'],
    organs: ['KIDNEYS'],
    deficiency: 'EDEMA',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_HYDROCHLOROTHIAZIDE',
    name: 'HCTZ',
    categories: ['pharma', 'cardio'],
    mechanisms: ['THIAZIDE', 'BP_DOWN'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SPIRONOLACTONE_CARDIO',
    name: 'Spironolactone (cardio)',
    categories: ['pharma', 'cardio'],
    mechanisms: ['ALDOSTERONE_BLOCK', 'BP_DOWN'],
    organs: ['KIDNEYS'],
    deficiency: 'HIGH_BP',
    description: 'Фармсредство для ССС',
    type: 'pharma'
  },
  {
    id: 'PHARMA_OMEPRAZOLE',
    name: 'Omeprazole',
    categories: ['pharma', 'GI'],
    mechanisms: ['PPI', 'ACID_DOWN'],
    organs: ['STOMACH'],
    deficiency: 'GERD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ESOMEPRAZOLE',
    name: 'Esomeprazole',
    categories: ['pharma', 'GI'],
    mechanisms: ['PPI', 'ACID_DOWN'],
    organs: ['STOMACH'],
    deficiency: 'GERD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PANTOPRAZOLE',
    name: 'Pantoprazole',
    categories: ['pharma', 'GI'],
    mechanisms: ['PPI', 'ACID_DOWN'],
    organs: ['STOMACH'],
    deficiency: 'GERD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RANITIDINE',
    name: 'Ranitidine',
    categories: ['pharma', 'GI'],
    mechanisms: ['H2_BLOCK', 'ACID_DOWN'],
    organs: ['STOMACH'],
    deficiency: 'GERD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FAMOTIDINE',
    name: 'Famotidine',
    categories: ['pharma', 'GI'],
    mechanisms: ['H2_BLOCK', 'ACID_DOWN'],
    organs: ['STOMACH'],
    deficiency: 'GERD',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DOMPERIDONE',
    name: 'Domperidone',
    categories: ['pharma', 'GI'],
    mechanisms: ['D2_BLOCK', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'NAUSEA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METOCLOPRAMIDE',
    name: 'Metoclopramide',
    categories: ['pharma', 'GI'],
    mechanisms: ['D2_BLOCK', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'NAUSEA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ITOPRIDE',
    name: 'Itopride',
    categories: ['pharma', 'GI'],
    mechanisms: ['ACH_UP', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'NAUSEA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TRIMEBUTINE',
    name: 'Trimebutine',
    categories: ['pharma', 'GI'],
    mechanisms: ['OPIOID_MOD', 'MOTILITY_BALANCE'],
    organs: ['GI'],
    deficiency: 'IBS',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LACTULOSE',
    name: 'Lactulose',
    categories: ['pharma', 'GI'],
    mechanisms: ['OSMOTIC_LAX', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'CONSTIPATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MACROGOL',
    name: 'Macrogol',
    categories: ['pharma', 'GI'],
    mechanisms: ['OSMOTIC_LAX', 'MOTILITY_UP'],
    organs: ['GI'],
    deficiency: 'CONSTIPATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MESALAZINE',
    name: 'Mesalazine',
    categories: ['pharma', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'IBD',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_SULFASALAZINE',
    name: 'Sulfasalazine',
    categories: ['pharma', 'immune', 'GI'],
    mechanisms: ['ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'IBD',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PREDNISONE_GI',
    name: 'Prednisone (GI)',
    categories: ['pharma', 'immune'],
    mechanisms: ['CORTISOL_ANALOG', 'ANTI_INFLAMMATION'],
    organs: ['GI'],
    deficiency: 'IBD',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AZATHIOPRINE',
    name: 'Azathioprine',
    categories: ['pharma', 'immune'],
    mechanisms: ['IMMUNE_SUPPRESS', 'AUTOIMMUNE_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'IBD',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METHOTREXATE',
    name: 'Methotrexate',
    categories: ['pharma', 'immune'],
    mechanisms: ['IMMUNE_SUPPRESS', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CYCLOSPORINE',
    name: 'Cyclosporine',
    categories: ['pharma', 'immune'],
    mechanisms: ['CALCINEURIN_BLOCK', 'IMMUNE_SUPPRESS'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TACROLIMUS',
    name: 'Tacrolimus',
    categories: ['pharma', 'immune'],
    mechanisms: ['CALCINEURIN_BLOCK', 'IMMUNE_SUPPRESS'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ADALIMUMAB',
    name: 'Adalimumab',
    categories: ['pharma', 'immune'],
    mechanisms: ['TNF_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INFLIXIMAB',
    name: 'Infliximab',
    categories: ['pharma', 'immune'],
    mechanisms: ['TNF_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ETANERCEPT',
    name: 'Etanercept',
    categories: ['pharma', 'immune'],
    mechanisms: ['TNF_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TOFACITINIB',
    name: 'Tofacitinib',
    categories: ['pharma', 'immune'],
    mechanisms: ['JAK_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_BARICITINIB',
    name: 'Baricitinib',
    categories: ['pharma', 'immune'],
    mechanisms: ['JAK_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CETIRIZINE',
    name: 'Cetirizine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'ALLERGY_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LEVOCETIRIZINE',
    name: 'Levocetirizine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'ALLERGY_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LORATADINE',
    name: 'Loratadine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'ALLERGY_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DESLORATADINE',
    name: 'Desloratadine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'ALLERGY_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_FEXOFENADINE',
    name: 'Fexofenadine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'ALLERGY_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RUPATADINE',
    name: 'Rupatadine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'PAF_BLOCK'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_KETOTIFEN',
    name: 'Ketotifen',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'MAST_CELL_STABILIZE'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'ASTHMA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AZELASTINE',
    name: 'Azelastine',
    categories: ['pharma', 'antihistamine'],
    mechanisms: ['H1_BLOCK', 'LOCAL_EFFECT'],
    organs: ['NOSE'],
    deficiency: 'ALLERGY',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MONTELUKAST',
    name: 'Montelukast',
    categories: ['pharma', 'antileukotriene'],
    mechanisms: ['LT_BLOCK', 'BRONCHO_RELAX'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ZAFIRLUKAST',
    name: 'Zafirlukast',
    categories: ['pharma', 'antileukotriene'],
    mechanisms: ['LT_BLOCK', 'INFLAMMATION_DOWN'],
    organs: ['LUNGS'],
    deficiency: 'ASTHMA',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_IBUPROFEN',
    name: 'Ibuprofen',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NAPROXEN',
    name: 'Naproxen',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_KETOPROFEN',
    name: 'Ketoprofen',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DICLOFENAC',
    name: 'Diclofenac',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MELOXICAM',
    name: 'Meloxicam',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX2_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'ARTHRITIS',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CELECOXIB',
    name: 'Celecoxib',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX2_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'ARTHRITIS',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ETORICOXIB',
    name: 'Etoricoxib',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX2_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'ARTHRITIS',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_NIMESULIDE',
    name: 'Nimesulide',
    categories: ['pharma', 'antiinflammatory'],
    mechanisms: ['COX2_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для противовоспалительной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PARACETAMOL',
    name: 'Paracetamol',
    categories: ['pharma', 'analgesic'],
    mechanisms: ['COX_CNS_BLOCK', 'PAIN_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'FEVER',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METAMIZOLE',
    name: 'Metamizole',
    categories: ['pharma', 'analgesic'],
    mechanisms: ['SPASMOLYTIC', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_KETOROLAC',
    name: 'Ketorolac',
    categories: ['pharma', 'analgesic'],
    mechanisms: ['COX_BLOCK', 'PAIN_DOWN'],
    organs: ['TISSUES'],
    deficiency: 'PAIN',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_PREDNISONE',
    name: 'Prednisone',
    categories: ['pharma', 'steroid'],
    mechanisms: ['CORTISOL_ANALOG', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METHYLPREDNISOLONE',
    name: 'Methylprednisolone',
    categories: ['pharma', 'steroid'],
    mechanisms: ['CORTISOL_ANALOG', 'ANTI_INFLAMMATION'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFLAMMATION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CYCLOFOSPHAMIDE',
    name: 'Cyclophosphamide',
    categories: ['pharma', 'immune'],
    mechanisms: ['IMMUNE_SUPPRESS', 'AUTOIMMUNE_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MYCOFENOLATE',
    name: 'Mycophenolate',
    categories: ['pharma', 'immune'],
    mechanisms: ['IMMUNE_SUPPRESS', 'AUTOIMMUNE_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'AUTOIMMUNE',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INTERFERON_ALPHA',
    name: 'Interferon‑α',
    categories: ['pharma', 'immune'],
    mechanisms: ['IFN_UP', 'ANTIVIRAL'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_INTERFERON_BETA',
    name: 'Interferon‑β',
    categories: ['pharma', 'immune'],
    mechanisms: ['IFN_UP', 'IMMUNE_MOD'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'MS',
    description: 'Фармсредство для иммунной системы',
    type: 'pharma'
  },
  {
    id: 'PHARMA_OSeltamivir',
    name: 'Oseltamivir',
    categories: ['pharma', 'antiviral'],
    mechanisms: ['NEURAMINIDASE_BLOCK', 'VIRUS_REPLICATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'FLU',
    description: 'Фармсредство для противовирусной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ZANAMIVIR',
    name: 'Zanamivir',
    categories: ['pharma', 'antiviral'],
    mechanisms: ['NEURAMINIDASE_BLOCK', 'VIRUS_REPLICATION_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'FLU',
    description: 'Фармсредство для противовирусной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ACYCLOVIR',
    name: 'Acyclovir',
    categories: ['pharma', 'antiviral'],
    mechanisms: ['DNA_POL_BLOCK', 'VIRUS_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'HERPES',
    description: 'Фармсредство для противовирусной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VALACYCLOVIR',
    name: 'Valacyclovir',
    categories: ['pharma', 'antiviral'],
    mechanisms: ['DNA_POL_BLOCK', 'VIRUS_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'HERPES',
    description: 'Фармсредство для противовирусной защиты',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMOXICILLIN',
    name: 'Amoxicillin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['BETA_LACTAM', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AUGMENTIN',
    name: 'Amoxicillin/Clavulanate',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['BETA_LACTAM', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AMPICILLIN',
    name: 'Ampicillin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['BETA_LACTAM', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CEFTRIAXONE',
    name: 'Ceftriaxone',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['CEPHALOSPORIN', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CEFIXIME',
    name: 'Cefixime',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['CEPHALOSPORIN', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CEFUROXIME',
    name: 'Cefuroxime',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['CEPHALOSPORIN', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_AZITHROMYCIN',
    name: 'Azithromycin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['MACROLIDE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CLARITHROMYCIN',
    name: 'Clarithromycin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['MACROLIDE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_DOXYCYCLINE',
    name: 'Doxycycline',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['TETRACYCLINE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TETRACYCLINE',
    name: 'Tetracycline',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['TETRACYCLINE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_CIPROFLOXACIN',
    name: 'Ciprofloxacin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['FLUOROQUINOLONE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LEVOFLOXACIN',
    name: 'Levofloxacin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['FLUOROQUINOLONE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_MOXIFLOXACIN',
    name: 'Moxifloxacin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['FLUOROQUINOLONE', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_METRONIDAZOLE',
    name: 'Metronidazole',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['NITROIMIDAZOLE', 'ANAEROBES_DOWN'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_TINIDAZOLE',
    name: 'Tinidazole',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['NITROIMIDAZOLE', 'ANAEROBES_DOWN'],
    organs: ['GI'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_LINEZOLID',
    name: 'Linezolid',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['OXAZOLIDINONE', 'GRAM_POS_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_VANCOMYCIN',
    name: 'Vancomycin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['GLYCOPEPTIDE', 'GRAM_POS_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'INFECTION',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_RIFAMPICIN',
    name: 'Rifampicin',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['RNA_POL_BLOCK', 'BACTERIA_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'TB',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'PHARMA_ISONIAZID',
    name: 'Isoniazid',
    categories: ['pharma', 'antibiotic_info'],
    mechanisms: ['MYCOLIC_ACID_BLOCK', 'TB_DOWN'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'TB',
    description: 'Фармсредство для поддержки обменных процессов и здоровья',
    type: 'pharma'
  },
  {
    id: 'HF_IRON_GUARD',
    name: 'Iron Guard',
    categories: ['complex', 'iron'],
    mechanisms: ['IRON_UP', 'RBC_UP'],
    organs: ['BLOOD'],
    deficiency: 'ANEMIA',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_JOIN_HEALTH',
    name: 'Join Health',
    categories: ['complex', 'joints'],
    mechanisms: ['CARTILAGE_UP', 'ANTI_INFLAMMATION'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_ATP_OPTIMIZER',
    name: 'ATP Optimizer',
    categories: ['complex', 'energy'],
    mechanisms: ['MITO_UP', 'ATP_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Комплекс для энергетического обмена',
    type: 'complex'
  },
  {
    id: 'HF_DIO_MAX',
    name: 'Dio Max',
    categories: ['complex', 'thyroid'],
    mechanisms: ['T3_T4_UP', 'METABOLISM_UP'],
    organs: ['THYROID'],
    deficiency: 'HYPOTHYROIDISM',
    description: 'Комплекс для щитовидной железы',
    type: 'complex'
  },
  {
    id: 'HF_ZENKAI_BOOST',
    name: 'Zenkai Boost',
    categories: ['complex', 'energy'],
    mechanisms: ['ADRENAL_UP', 'CORTISOL_BALANCE'],
    organs: ['ADRENALS'],
    deficiency: 'LOW_ENERGY',
    description: 'Комплекс для энергетического обмена',
    type: 'complex'
  },
  {
    id: 'HF_K_ELEMENT',
    name: 'K‑Element',
    categories: ['complex', 'minerals'],
    mechanisms: ['POTASSIUM_UP', 'ELECTROLYTES_UP'],
    organs: ['CELLS'],
    deficiency: 'CRAMPS',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_HERCULES_POTION',
    name: 'Hercules Potion',
    categories: ['complex', 'performance'],
    mechanisms: ['NO_UP', 'STRENGTH_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_STRENGTH',
    description: 'Комплекс для производительности',
    type: 'complex'
  },
  {
    id: 'HF_FIRE_FUZE',
    name: 'Fire Fuze',
    categories: ['complex', 'metabolic'],
    mechanisms: ['FAT_BURN_UP', 'THERMOGENESIS'],
    organs: ['FAT_TISSUE'],
    deficiency: 'OBESITY',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_PUSSY_BOY_ANTIDOTE',
    name: 'Pussy Boy Antidote',
    categories: ['complex', 'men'],
    mechanisms: ['TESTOSTERONE_UP', 'DRIVE_UP'],
    organs: ['TESTES'],
    deficiency: 'LOW_LIBIDO',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_BP_OPTIMIZER',
    name: 'Blood Pressure Optimizer',
    categories: ['complex', 'cardio'],
    mechanisms: ['BP_DOWN', 'VESSELS_UP'],
    organs: ['VESSELS'],
    deficiency: 'HIGH_BP',
    description: 'Комплекс для ССС',
    type: 'complex'
  },
  {
    id: 'HF_B_REAL',
    name: 'B‑Real',
    categories: ['complex', 'vitamins'],
    mechanisms: ['B_VITAMINS_UP', 'ENERGY_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'HF_FALCON_VISION',
    name: 'Falcon Vision',
    categories: ['complex', 'vision'],
    mechanisms: ['LUTEIN_UP', 'ANTIOX_UP'],
    organs: ['EYES'],
    deficiency: 'VISION_LOSS',
    description: 'Комплекс для зрения',
    type: 'complex'
  },
  {
    id: 'HF_PROCESS_REMEDY',
    name: 'Process Remedy',
    categories: ['complex', 'detox'],
    mechanisms: ['LIVER_UP', 'GI_UP'],
    organs: ['LIVER'],
    deficiency: 'TOXINS',
    description: 'Комплекс для детоксикации',
    type: 'complex'
  },
  {
    id: 'HF_CARB_LOADER',
    name: 'Carb Loader',
    categories: ['complex', 'performance'],
    mechanisms: ['GLYCOGEN_UP', 'ENDURANCE_UP'],
    organs: ['MUSCLES'],
    deficiency: 'LOW_ENDURANCE',
    description: 'Комплекс для производительности',
    type: 'complex'
  },
  {
    id: 'HF_JOINT_HEALTH_OPTIMIZER',
    name: 'Joint Health Optimizer',
    categories: ['complex', 'joints'],
    mechanisms: ['CARTILAGE_UP', 'INFLAMMATION_DOWN'],
    organs: ['JOINTS'],
    deficiency: 'ARTHRITIS',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'MM_ST_JOHNS_WORT',
    name: 'St. John\'s Wort',
    categories: ['complex', 'mood'],
    mechanisms: ['SEROTONIN_UP', 'MOOD_UP'],
    organs: ['BRAIN'],
    deficiency: 'LOW_MOOD',
    description: 'Комплекс для нормализации настроения',
    type: 'complex'
  },
  {
    id: 'MM_FAST_BLOOD',
    name: 'Fast Blood',
    categories: ['complex', 'circulation'],
    mechanisms: ['BLOOD_FLOW_UP', 'OXYGEN_UP'],
    organs: ['BLOOD'],
    deficiency: 'FATIGUE',
    description: 'Комплекс для кровообращения',
    type: 'complex'
  },
  {
    id: 'MM_BRILLIANT_SIGHT',
    name: 'Brilliant Sight',
    categories: ['complex', 'vision'],
    mechanisms: ['LUTEIN_UP', 'ANTIOX_UP'],
    organs: ['EYES'],
    deficiency: 'VISION_LOSS',
    description: 'Комплекс для зрения',
    type: 'complex'
  },
  {
    id: 'MM_CRAZY_BRAIN',
    name: 'Crazy Brain',
    categories: ['complex', 'nootropic'],
    mechanisms: ['ACH_UP', 'BDNF_UP'],
    organs: ['BRAIN'],
    deficiency: 'FOCUS',
    description: 'Комплекс для когнитивных функций',
    type: 'complex'
  },
  {
    id: 'MM_DANGEROUS',
    name: 'Dangerous',
    categories: ['complex', 'stimulant'],
    mechanisms: ['DOPAMINE_UP', 'NE_UP'],
    organs: ['BRAIN'],
    deficiency: 'ENERGY',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'MM_BLAZE_BRAIN',
    name: 'Blaze Brain',
    categories: ['complex', 'nootropic'],
    mechanisms: ['MITO_UP', 'NEURO_UP'],
    organs: ['BRAIN'],
    deficiency: 'FOCUS',
    description: 'Комплекс для когнитивных функций',
    type: 'complex'
  },
  {
    id: 'MM_SALVUS',
    name: 'Salvus',
    categories: ['complex', 'immune'],
    mechanisms: ['IMMUNE_UP', 'ANTIOX_UP'],
    organs: ['IMMUNE_SYSTEM'],
    deficiency: 'LOW_IMMUNITY',
    description: 'Комплекс для иммунной системы',
    type: 'complex'
  },
  {
    id: 'MM_ENERGY_RAPE',
    name: 'Energy Rape',
    categories: ['complex', 'energy'],
    mechanisms: ['ATP_UP', 'MITO_UP'],
    organs: ['CELLS'],
    deficiency: 'FATIGUE',
    description: 'Комплекс для энергетического обмена',
    type: 'complex'
  },
  {
    id: 'MM_I_AM_LIBIDO',
    name: 'I Am Libido',
    categories: ['complex', 'men'],
    mechanisms: ['TESTOSTERONE_UP', 'DRIVE_UP'],
    organs: ['TESTES'],
    deficiency: 'LOW_LIBIDO',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'MM_GET_HIGH',
    name: 'Get High',
    categories: ['complex', 'mood'],
    mechanisms: ['DOPAMINE_UP', 'SEROTONIN_UP'],
    organs: ['BRAIN'],
    deficiency: 'LOW_MOOD',
    description: 'Комплекс для нормализации настроения',
    type: 'complex'
  },
  {
    id: 'MM_TIME_RELEASE',
    name: 'Time Release',
    categories: ['complex', 'adaptogen'],
    mechanisms: ['CORTISOL_BALANCE', 'STRESS_DOWN'],
    organs: ['BRAIN'],
    deficiency: 'STRESS',
    description: 'Комплекс для адаптации к стрессу',
    type: 'complex'
  },
  {
    id: 'MM_SERRANATTO',
    name: 'Serrapeptase + Nattokinase',
    categories: ['complex', 'enzymes'],
    mechanisms: ['FIBRIN_DOWN', 'INFLAMMATION_DOWN'],
    organs: ['BLOOD'],
    deficiency: 'CLOTS',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
  {
    id: 'ASMD_PSD_UMC_PC',
    name: 'Phosphatidylserine + UMC + PC',
    categories: ['complex', 'brain'],
    mechanisms: ['NEUROPROTECTION', 'MEMBRANE_UP'],
    organs: ['BRAIN'],
    deficiency: 'COGNITION',
    description: 'Комплекс для работы мозга',
    type: 'complex'
  },
  {
    id: 'ASMD_ALPHA_GPC_STACK',
    name: 'Alpha GPC + CDP Choline + Huperzine A',
    categories: ['complex', 'choline'],
    mechanisms: ['ACH_UP', 'MEMORY_UP'],
    organs: ['BRAIN'],
    deficiency: 'FOCUS',
    description: 'Комплекс для поддержки обменных процессов и здоровья',
    type: 'complex'
  },
];

export const SUPPORT_SUBSTANCE_MAP: Record<string, SupportSubstance> = {};
ALL_SUBSTANCES.forEach(s => { SUPPORT_SUBSTANCE_MAP[s.id] = s; });

// ═══════════════════════════════════════════════════════════════════════════
// BRANDS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_BRANDS: SupportBrand[] = [
  { brandId: 'BRAND_HEALTH_FACTOR', name: 'Health Factor', type: 'brand', country: 'Россия', description: 'Производитель БАДов и нутра' },
  { brandId: 'BRAND_DR_BADY', name: 'DR.BADY', type: 'brand', country: 'Россия', description: 'Российский бренд нутра' },
  { brandId: 'BRAND_EASY_MAGIC', name: 'Easy Magic', type: 'brand', country: 'Россия', description: 'Российский бренд функциональных комплексов' },
  { brandId: 'BRAND_MENTOR_MIND', name: 'Mentor Mind', type: 'brand', country: 'Россия', description: 'Нейро‑нутра и когнитивные комплексы' },
  { brandId: 'BRAND_ASMD', name: 'ASMD', type: 'brand', country: 'Россия', description: 'Российский бренд спортивной и функциональной нутра' },
  { brandId: 'BRAND_LIFE_EXTENSION', name: 'Life Extension', type: 'brand', country: 'США', description: 'Премиальная нутра и научные формулы' },
  { brandId: 'BRAND_THORNE', name: 'Thorne Research', type: 'brand', country: 'США', description: 'Профессиональная нутра высокого уровня' },
  { brandId: 'BRAND_PURE_ENCAPS', name: 'Pure Encapsulations', type: 'brand', country: 'США', description: 'Гипоаллергенные премиальные комплексы' },
  { brandId: 'BRAND_NOW_FOODS', name: 'Now Foods', type: 'brand', country: 'США', description: 'Один из крупнейших мировых производителей БАДов' },
  { brandId: 'BRAND_JARROW', name: 'Jarrow Formulas', type: 'brand', country: 'США', description: 'Научно ориентированный бренд нутра' },
  { brandId: 'BRAND_SOLGAR', name: 'Solgar', type: 'brand', country: 'США', description: 'Один из старейших брендов витаминов и минералов' },
  { brandId: 'BRAND_CALIFORNIA_GOLD', name: 'California Gold Nutrition', type: 'brand', country: 'США', description: 'Популярный бренд iHerb' },
  { brandId: 'BRAND_NUTRICOST', name: 'Nutricost', type: 'brand', country: 'USA', description: 'Один из крупнейших производителей монокомпонентной нутры' },
  { brandId: 'BRAND_KAGED', name: 'Kaged', type: 'brand', country: 'USA', description: 'Премиальная спортивная нутра' },
  { brandId: 'BRAND_OPTIMUM', name: 'Optimum Nutrition', type: 'brand', country: 'USA', description: 'Мировой лидер спортивного питания' },
  { brandId: 'BRAND_BULK', name: 'Bulk Supplements', type: 'brand', country: 'USA', description: 'Чистые порошковые ингредиенты' },
  { brandId: 'BRAND_GARDEN_OF_LIFE', name: 'Garden of Life', type: 'brand', country: 'USA', description: 'Органическая нутра' },
  { brandId: 'BRAND_SPORTS_RESEARCH', name: 'Sports Research', type: 'brand', country: 'USA', description: 'Популярный бренд витаминов и омега‑3' },
  { brandId: 'BRAND_MUSCLETECH', name: 'MuscleTech', type: 'brand', country: 'USA', description: 'Спортивная нутра' },
  { brandId: 'BRAND_MYPROTEIN', name: 'MyProtein', type: 'brand', country: 'UK', description: 'Европейский гигант спортивного питания' },
  { brandId: 'BRAND_SWANSON', name: 'Swanson', type: 'brand', country: 'USA', description: 'Бюджетная нутра' },
  { brandId: 'BRAND_BLUEBONNET', name: 'Bluebonnet Nutrition', type: 'brand', country: 'USA', description: 'Премиальная нутра' },
  { brandId: 'BRAND_DOCTORS_BEST', name: 'Doctor\'s Best', type: 'brand', country: 'USA', description: 'Научно ориентированные формулы' },
];

export const BRAND_MAP: Record<string, SupportBrand> = {};
ALL_BRANDS.forEach(b => { BRAND_MAP[b.brandId] = b; });

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_CATEGORIES: SupportCategory[] = [
  { catId: 'CAT_SUB_VITAMINS', type: 'SUBSTANCE', name: 'Витамины', description: 'Микронутриенты для метаболизма и иммунитета.' },
  { catId: 'CAT_SUB_MINERALS', type: 'SUBSTANCE', name: 'Минералы', description: 'Электролиты и кофакторы ферментов.' },
  { catId: 'CAT_SUB_AMINO', type: 'SUBSTANCE', name: 'Аминокислоты', description: 'Строительный материал и нейромедиаторы.' },
  { catId: 'CAT_SUB_ADAPTOGENS', type: 'SUBSTANCE', name: 'Адаптогены', description: 'Регуляция стресса и кортизола.' },
  { catId: 'CAT_SUB_STIMULANTS', type: 'SUBSTANCE', name: 'Стимуляторы', description: 'Повышение энергии и концентрации.' },
  { catId: 'CAT_SUB_NOOTROPICS', type: 'SUBSTANCE', name: 'Ноотропы', description: 'Когнитивная поддержка.' },
  { catId: 'CAT_SUB_FATTYACIDS', type: 'SUBSTANCE', name: 'Жирные кислоты', description: 'Противовоспалительные и структурные функции.' },
  { catId: 'CAT_SUB_HERBS', type: 'SUBSTANCE', name: 'Травы', description: 'Фитотерапия и модуляция систем.' },
  { catId: 'CAT_SUB_PROBIOTICS', type: 'SUBSTANCE', name: 'Пробиотики', description: 'Микробиота и ЖКТ.' },
  { catId: 'CAT_SUB_ENZYMES', type: 'SUBSTANCE', name: 'Ферменты', description: 'Улучшение пищеварения.' },
  { catId: 'CAT_SUB_HORMONAL', type: 'SUBSTANCE', name: 'Гормональные вещества', description: 'Регуляция эндокринной системы.' },
  { catId: 'CAT_SUB_DETOX', type: 'SUBSTANCE', name: 'Детокс‑вещества', description: 'Поддержка печени и антиоксидантов.' },
  { catId: 'CAT_RISK_LIVER', type: 'RISK', name: 'Печень', description: 'Риски' },
  { catId: 'CAT_RISK_KIDNEYS', type: 'RISK', name: 'Почки', description: 'Риски почечной функции.' },
  { catId: 'CAT_RISK_HEART', type: 'RISK', name: 'Сердце', description: 'Кардио‑риски.' },
  { catId: 'CAT_RISK_LUNGS', type: 'RISK', name: 'Лёгкие', description: 'Риски дыхательной системы.' },
  { catId: 'CAT_RISK_GUT', type: 'RISK', name: 'ЖКТ', description: 'Риски пищеварения.' },
  { catId: 'CAT_RISK_HORMONES', type: 'RISK', name: 'Гормоны', description: 'Эндокринные риски.' },
  { catId: 'CAT_RISK_BRAIN', type: 'RISK', name: 'Мозг', description: 'Когнитивные и нервные риски.' },
  { catId: 'CAT_RISK_BLOOD', type: 'RISK', name: 'Кровь', description: 'Гематологические риски.' },
  { catId: 'CAT_RISK_JOINTS', type: 'RISK', name: 'Суставы', description: 'Опорно‑двигательные риски.' },
  { catId: 'CAT_RISK_SKIN', type: 'RISK', name: 'Кожа', description: 'Дерматологические риски.' },
  { catId: 'CAT_RISK_VISION', type: 'RISK', name: 'Зрение', description: 'Офтальмологические риски.' },
  { catId: 'CAT_RISK_IMMUNE', type: 'RISK', name: 'Иммунитет', description: 'Иммунные риски.' },
  { catId: 'CAT_MECH_INFLAMMATION', type: 'MECHANISM', name: 'Воспаление', description: 'Уровень системного воспаления.' },
  { catId: 'CAT_MECH_CORTISOL', type: 'MECHANISM', name: 'Кортизол', description: 'Стресс‑ось.' },
  { catId: 'CAT_MECH_THYROID', type: 'MECHANISM', name: 'Щитовидка', description: 'Гормоны T3/T4.' },
  { catId: 'CAT_MECH_GABA', type: 'MECHANISM', name: 'GABA', description: 'Тормозная система мозга.' },
  { catId: 'CAT_MECH_DOPAMINE', type: 'MECHANISM', name: 'Дофамин', description: 'Мотивация и энергия.' },
  { catId: 'CAT_MECH_SEROTONIN', type: 'MECHANISM', name: 'Серотонин', description: 'Настроение и сон.' },
  { catId: 'CAT_MECH_LIPIDS', type: 'MECHANISM', name: 'Липиды', description: 'Жировой обмен.' },
  { catId: 'CAT_MECH_GLUCOSE', type: 'MECHANISM', name: 'Глюкоза', description: 'Углеводный обмен.' },
  { catId: 'CAT_MECH_OXIDATIVE', type: 'MECHANISM', name: 'Окисление', description: 'Антиоксидантный статус.' },
  { catId: 'CAT_MECH_DETOX', type: 'MECHANISM', name: 'Детокс', description: 'Функция печени.' },
  { catId: 'CAT_ORGAN_LIVER', type: 'ORGAN', name: 'Печень', description: 'Метаболизм и детокс.' },
  { catId: 'CAT_ORGAN_KIDNEYS', type: 'ORGAN', name: 'Почки', description: 'Фильтрация и электролиты.' },
  { catId: 'CAT_ORGAN_HEART', type: 'ORGAN', name: 'Сердце', description: 'Кровообращение.' },
  { catId: 'CAT_ORGAN_LUNGS', type: 'ORGAN', name: 'Лёгкие', description: 'Дыхание.' },
  { catId: 'CAT_ORGAN_GUT', type: 'ORGAN', name: 'ЖКТ', description: 'Пищеварение и микробиота.' },
  { catId: 'CAT_ORGAN_BRAIN', type: 'ORGAN', name: 'Мозг', description: 'ЦНС и когнитивные функции.' },
  { catId: 'CAT_ORGAN_HORMONES', type: 'ORGAN', name: 'Гормоны', description: 'Эндокринная система.' },
  { catId: 'CAT_ORGAN_IMMUNE', type: 'ORGAN', name: 'Иммунитет', description: 'Защитные функции.' },
  { catId: 'CAT_ORGAN_BLOOD', type: 'ORGAN', name: 'Кровь', description: 'Гемостаз и перенос кислорода.' },
  { catId: 'CAT_ORGAN_JOINTS', type: 'ORGAN', name: 'Суставы', description: 'Опорно‑двигательная система.' },
  { catId: 'CAT_ORGAN_SKIN', type: 'ORGAN', name: 'Кожа', description: 'Барьер и воспаление.' },
  { catId: 'CAT_ORGAN_EYES', type: 'ORGAN', name: 'Глаза', description: 'Зрение.' },
  { catId: 'CAT_AXIS_LIVER_THYROID', type: 'AXIS', name: 'Печень–Щитовидка', description: 'Конверсия T4→T3.' },
  { catId: 'CAT_AXIS_GUT_BRAIN', type: 'AXIS', name: 'Кишечник–Мозг', description: 'Серотонин и воспаление.' },
  { catId: 'CAT_AXIS_ADRENAL_GONAD', type: 'AXIS', name: 'Надпочечники–Гонады', description: 'Кортизол и половые гормоны.' },
  { catId: 'CAT_AXIS_HEART_KIDNEY', type: 'AXIS', name: 'Сердце–Почки', description: 'Давление и фильтрация.' },
  { catId: 'CAT_AXIS_LIVER_GUT', type: 'AXIS', name: 'Печень–ЖКТ', description: 'Желчь и микробиота.' },
  { catId: 'CAT_AXIS_GUT_IMMUNE', type: 'AXIS', name: 'ЖКТ–Иммунитет', description: 'Барьер и воспаление.' },
  { catId: 'CAT_AXIS_BRAIN_ADRENAL', type: 'AXIS', name: 'Мозг–Надпочечники', description: 'Стресс‑ось.' },
  { catId: 'CAT_AXIS_LIVER_SKIN', type: 'AXIS', name: 'Печень–Кожа', description: 'Детокс и воспаление.' },
  { catId: 'CAT_AXIS_EYES_BRAIN', type: 'AXIS', name: 'Глаза–Мозг', description: 'Нагрузка и когнитивная связь.' },
  { catId: 'CAT_SYSTEM_LIVER', type: 'SYSTEM', name: 'Печень', description: 'Состояние печени.' },
  { catId: 'CAT_SYSTEM_KIDNEYS', type: 'SYSTEM', name: 'Почки', description: 'Состояние почек.' },
  { catId: 'CAT_SYSTEM_HEART', type: 'SYSTEM', name: 'Сердце', description: 'Состояние сердца.' },
  { catId: 'CAT_SYSTEM_GUT', type: 'SYSTEM', name: 'ЖКТ', description: 'Состояние пищеварения.' },
  { catId: 'CAT_SYSTEM_BRAIN', type: 'SYSTEM', name: 'Мозг', description: 'Состояние ЦНС.' },
  { catId: 'CAT_SYSTEM_HORMONES', type: 'SYSTEM', name: 'Гормоны', description: 'Состояние эндокринной системы.' },
  { catId: 'CAT_SYSTEM_IMMUNE', type: 'SYSTEM', name: 'Иммунитет', description: 'Состояние иммунной системы.' },
  { catId: 'CAT_GLOBAL_SLEEP', type: 'GLOBAL', name: 'Сон', description: 'Гигиена сна.' },
  { catId: 'CAT_GLOBAL_STRESS', type: 'GLOBAL', name: 'Стресс', description: 'Уровень стресса.' },
  { catId: 'CAT_GLOBAL_DIET', type: 'GLOBAL', name: 'Питание', description: 'Качество рациона.' },
  { catId: 'CAT_GLOBAL_ACTIVITY', type: 'GLOBAL', name: 'Активность', description: 'Физическая нагрузка.' },
  { catId: 'CAT_GLOBAL_WATER', type: 'GLOBAL', name: 'Вода', description: 'Гидратация.' },
  { catId: 'CAT_GLOBAL_CAFFEINE', type: 'GLOBAL', name: 'Кофеин', description: 'Стимуляторы.' },
  { catId: 'CAT_GLOBAL_ALCOHOL', type: 'GLOBAL', name: 'Алкоголь', description: 'Нагрузка алкоголем.' },
  { catId: 'CAT_GLOBAL_SUGAR', type: 'GLOBAL', name: 'Сахар', description: 'Углеводная нагрузка.' },
  { catId: 'CAT_GLOBAL_SCREENS', type: 'GLOBAL', name: 'Экраны', description: 'Цифровая нагрузка.' },
  { catId: 'CAT_GLOBAL_RECOVERY', type: 'GLOBAL', name: 'Восстановление', description: 'Регенерация.' },
  { catId: 'CAT_GLOBAL_CIRCADIAN', type: 'GLOBAL', name: 'Циркадные ритмы', description: 'Режим дня.' },
];

export const CATEGORY_MAP: Record<string, SupportCategory> = {};
ALL_CATEGORIES.forEach(c => { CATEGORY_MAP[c.catId] = c; });

// ═══════════════════════════════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_TAGS: SupportTag[] = [
  { tagId: 'TAG_ANTIINFLAMMATORY', type: 'SUBSTANCE', name: 'Противовоспалительное' },
  { tagId: 'TAG_ANTIOXIDANT', type: 'SUBSTANCE', name: 'Антиоксидант' },
  { tagId: 'TAG_LIVER_SUPPORT', type: 'SUBSTANCE', name: 'Печень' },
  { tagId: 'TAG_KIDNEY_SUPPORT', type: 'SUBSTANCE', name: 'Почки' },
  { tagId: 'TAG_HEART_SUPPORT', type: 'SUBSTANCE', name: 'Сердце' },
  { tagId: 'TAG_GUT_SUPPORT', type: 'SUBSTANCE', name: 'ЖКТ' },
  { tagId: 'TAG_BRAIN_SUPPORT', type: 'SUBSTANCE', name: 'Мозг' },
  { tagId: 'TAG_HORMONE_SUPPORT', type: 'SUBSTANCE', name: 'Гормоны' },
  { tagId: 'TAG_IMMUNE_SUPPORT', type: 'SUBSTANCE', name: 'Иммунитет' },
  { tagId: 'TAG_SLEEP', type: 'SUBSTANCE', name: 'Сон' },
  { tagId: 'TAG_STRESS', type: 'SUBSTANCE', name: 'Стресс' },
  { tagId: 'TAG_ENERGY', type: 'SUBSTANCE', name: 'Энергия' },
  { tagId: 'TAG_FOCUS', type: 'SUBSTANCE', name: 'Фокус' },
  { tagId: 'TAG_METABOLISM', type: 'SUBSTANCE', name: 'Метаболизм' },
  { tagId: 'TAG_LIPIDS', type: 'SUBSTANCE', name: 'Липиды' },
  { tagId: 'TAG_GLUCOSE', type: 'SUBSTANCE', name: 'Глюкоза' },
  { tagId: 'TAG_MOOD', type: 'SUBSTANCE', name: 'Настроение' },
  { tagId: 'TAG_DIGESTION', type: 'SUBSTANCE', name: 'Пищеварение' },
  { tagId: 'TAG_MICROBIOME', type: 'SUBSTANCE', name: 'Микробиота' },
  { tagId: 'TAG_ANTIMICROBIAL', type: 'SUBSTANCE', name: 'Антимикробное' },
  { tagId: 'TAG_HORMONAL_BALANCE', type: 'SUBSTANCE', name: 'Гормональный баланс' },
  { tagId: 'TAG_DETOX', type: 'SUBSTANCE', name: 'Детокс' },
  { tagId: 'TAG_ANTISTRESS', type: 'SUBSTANCE', name: 'Антистресс' },
  { tagId: 'TAG_NOOTROPIC', type: 'SUBSTANCE', name: 'Ноотроп' },
  { tagId: 'TAG_STIMULANT', type: 'SUBSTANCE', name: 'Стимулятор' },
  { tagId: 'TAG_ADAPTOGEN', type: 'SUBSTANCE', name: 'Адаптоген' },
  { tagId: 'TAG_MINERAL', type: 'SUBSTANCE', name: 'Минерал' },
  { tagId: 'TAG_VITAMIN', type: 'SUBSTANCE', name: 'Витамин' },
  { tagId: 'TAG_AMINO', type: 'SUBSTANCE', name: 'Аминокислота' },
  { tagId: 'TAG_FATTY_ACID', type: 'SUBSTANCE', name: 'Жирная кислота' },
  { tagId: 'TAG_HERB', type: 'SUBSTANCE', name: 'Трава' },
  { tagId: 'TAG_PROBIOTIC', type: 'SUBSTANCE', name: 'Пробиотик' },
  { tagId: 'TAG_ENZYME', type: 'SUBSTANCE', name: 'Фермент' },
  { tagId: 'TAG_RISK_METABOLIC', type: 'RISK', name: 'Метаболический' },
  { tagId: 'TAG_RISK_INFLAMMATORY', type: 'RISK', name: 'Воспалительный' },
  { tagId: 'TAG_RISK_HORMONAL', type: 'RISK', name: 'Гормональный' },
  { tagId: 'TAG_RISK_CARDIO', type: 'RISK', name: 'Кардио' },
  { tagId: 'TAG_RISK_NEURO', type: 'RISK', name: 'Нейро' },
  { tagId: 'TAG_RISK_GUT', type: 'RISK', name: 'ЖКТ' },
  { tagId: 'TAG_RISK_IMMUNE', type: 'RISK', name: 'Иммунный' },
  { tagId: 'TAG_RISK_DETOX', type: 'RISK', name: 'Детокс' },
  { tagId: 'TAG_RISK_LIPIDS', type: 'RISK', name: 'Липиды' },
  { tagId: 'TAG_RISK_GLUCOSE', type: 'RISK', name: 'Глюкоза' },
  { tagId: 'TAG_MECH_UP', type: 'MECHANISM', name: 'Повышение' },
  { tagId: 'TAG_MECH_DOWN', type: 'MECHANISM', name: 'Снижение' },
  { tagId: 'TAG_MECH_BALANCE', type: 'MECHANISM', name: 'Баланс' },
  { tagId: 'TAG_ORGAN_CORE', type: 'ORGAN', name: 'Основной орган' },
  { tagId: 'TAG_ORGAN_SUPPORT', type: 'ORGAN', name: 'Поддержка органа' },
  { tagId: 'TAG_AXIS_BIDIRECTIONAL', type: 'AXIS', name: 'Двусторонняя связь' },
  { tagId: 'TAG_AXIS_HORMONAL', type: 'AXIS', name: 'Гормональная ось' },
  { tagId: 'TAG_AXIS_NEURO', type: 'AXIS', name: 'Нейро‑ось' },
  { tagId: 'TAG_AXIS_METABOLIC', type: 'AXIS', name: 'Метаболическая ось' },
  { tagId: 'TAG_SYSTEM_HIGH', type: 'SYSTEM', name: 'Высокая нагрузка' },
  { tagId: 'TAG_SYSTEM_MED', type: 'SYSTEM', name: 'Средняя нагрузка' },
  { tagId: 'TAG_SYSTEM_LOW', type: 'SYSTEM', name: 'Низкая нагрузка' },
  { tagId: 'TAG_GLOBAL_LIFESTYLE', type: 'GLOBAL', name: 'Образ жизни' },
  { tagId: 'TAG_GLOBAL_RECOVERY', type: 'GLOBAL', name: 'Восстановление' },
  { tagId: 'TAG_GLOBAL_RHYTHM', type: 'GLOBAL', name: 'Режим' },
  { tagId: 'TAG_GLOBAL_NUTRITION', type: 'GLOBAL', name: 'Питание' },
  { tagId: 'TAG_GLOBAL_STIMULANTS', type: 'GLOBAL', name: 'Стимуляторы' },
  { tagId: 'TAG_GLOBAL_HYDRATION', type: 'GLOBAL', name: 'Гидратация' },
];

export const TAG_MAP: Record<string, SupportTag> = {};
ALL_TAGS.forEach(t => { TAG_MAP[t.tagId] = t; });

// ═══════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_EFFECTS: SupportEffect[] = [
  { effectId: 'GABA_UP', type: 'DIRECT', description: 'Повышает активность GABA-рецепторов', category: 'GABA_UP' },
  { effectId: 'GABA_DOWN', type: 'DIRECT', description: 'Снижает активность GABA-рецепторов', category: 'GABA_DOWN' },
  { effectId: 'SEROTONIN_UP', type: 'DIRECT', description: 'Повышает уровень серотонина', category: 'SEROTONIN_UP' },
  { effectId: 'SEROTONIN_DOWN', type: 'DIRECT', description: 'Снижает уровень серотонина', category: 'SEROTONIN_DOWN' },
  { effectId: 'DOPAMINE_UP', type: 'DIRECT', description: 'Повышает уровень дофамина', category: 'DOPAMINE_UP' },
  { effectId: 'DOPAMINE_DOWN', type: 'DIRECT', description: 'Снижает уровень дофамина', category: 'DOPAMINE_DOWN' },
  { effectId: 'NE_UP', type: 'DIRECT', description: 'Повышает норадреналин', category: 'NE_UP' },
  { effectId: 'NE_DOWN', type: 'DIRECT', description: 'Снижает норадреналин', category: 'NE_DOWN' },
  { effectId: 'CORTISOL_UP', type: 'SYSTEMIC', description: 'Повышает кортизол', category: 'CORTISOL_UP' },
  { effectId: 'CORTISOL_DOWN', type: 'SYSTEMIC', description: 'Снижает кортизол', category: 'CORTISOL_DOWN' },
  { effectId: 'ADRENALINE_UP', type: 'DIRECT', description: 'Повышает адреналин', category: 'ADRENALINE_UP' },
  { effectId: 'ADRENALINE_DOWN', type: 'DIRECT', description: 'Снижает адреналин', category: 'ADRENALINE_DOWN' },
  { effectId: 'T3_T4_UP', type: 'DIRECT', description: 'Повышает активность щитовидных гормонов', category: 'T3_T4_UP' },
  { effectId: 'T3_T4_DOWN', type: 'DIRECT', description: 'Снижает активность щитовидных гормонов', category: 'T3_T4_DOWN' },
  { effectId: 'IODINE_UP', type: 'DIRECT', description: 'Повышает доступность йода', category: 'T3_T4_UP' },
  { effectId: 'INSULIN_SENS_UP', type: 'SYSTEMIC', description: 'Повышает чувствительность к инсулину', category: 'GLUCOSE_UP' },
  { effectId: 'INSULIN_SENS_DOWN', type: 'SYSTEMIC', description: 'Снижает чувствительность к инсулину', category: 'GLUCOSE_DOWN' },
  { effectId: 'GLUCOSE_UP', type: 'DIRECT', description: 'Повышает глюкозу', category: 'GLUCOSE_UP' },
  { effectId: 'GLUCOSE_DOWN', type: 'DIRECT', description: 'Снижает глюкозу', category: 'GLUCOSE_DOWN' },
  { effectId: 'LIPIDS_UP', type: 'SYSTEMIC', description: 'Повышает липиды', category: 'LIPIDS_UP' },
  { effectId: 'LIPIDS_DOWN', type: 'SYSTEMIC', description: 'Снижает липиды', category: 'LIPIDS_DOWN' },
  { effectId: 'LDL_UP', type: 'DIRECT', description: 'Повышает ЛПНП', category: 'LIPIDS_UP' },
  { effectId: 'LDL_DOWN', type: 'DIRECT', description: 'Снижает ЛПНП', category: 'LIPIDS_DOWN' },
  { effectId: 'HDL_UP', type: 'DIRECT', description: 'Повышает ЛПВП', category: 'LIPIDS_DOWN' },
  { effectId: 'TG_UP', type: 'DIRECT', description: 'Повышает триглицериды', category: 'LIPIDS_UP' },
  { effectId: 'TG_DOWN', type: 'DIRECT', description: 'Снижает триглицериды', category: 'LIPIDS_DOWN' },
  { effectId: 'INFLAMMATION_UP', type: 'SYSTEMIC', description: 'Повышает воспаление', category: 'INFLAMMATION_UP' },
  { effectId: 'INFLAMMATION_DOWN', type: 'SYSTEMIC', description: 'Снижает воспаление', category: 'INFLAMMATION_DOWN' },
  { effectId: 'NFkB_DOWN', type: 'DIRECT', description: 'Снижает NF-kB', category: 'INFLAMMATION_DOWN' },
  { effectId: 'COX_DOWN', type: 'DIRECT', description: 'Снижает COX', category: 'INFLAMMATION_DOWN' },
  { effectId: 'OXIDATIVE_STRESS_UP', type: 'SYSTEMIC', description: 'Повышает оксидативный стресс', category: 'OXIDATIVE_UP' },
  { effectId: 'OXIDATIVE_STRESS_DOWN', type: 'SYSTEMIC', description: 'Снижает оксидативный стресс', category: 'OXIDATIVE_DOWN' },
  { effectId: 'ANTIOX_UP', type: 'DIRECT', description: 'Повышает антиоксидантную защиту', category: 'OXIDATIVE_DOWN' },
  { effectId: 'BILE_FLOW_UP', type: 'DIRECT', description: 'Улучшает отток желчи', category: 'BILE_FLOW_UP' },
  { effectId: 'BILE_FLOW_DOWN', type: 'DIRECT', description: 'Снижает отток желчи', category: 'BILE_FLOW_DOWN' },
  { effectId: 'DETOX_UP', type: 'SYSTEMIC', description: 'Ускоряет детокс печени', category: 'DETOX_UP' },
  { effectId: 'DETOX_DOWN', type: 'SYSTEMIC', description: 'Замедляет детокс печени', category: 'DETOX_DOWN' },
  { effectId: 'MICROBIOME_UP', type: 'SYSTEMIC', description: 'Улучшает микробиоту', category: 'MICROBIOME_UP' },
  { effectId: 'MICROBIOME_DOWN', type: 'SYSTEMIC', description: 'Ухудшает микробиоту', category: 'MICROBIOME_DOWN' },
  { effectId: 'LPS_UP', type: 'SYSTEMIC', description: 'Повышает эндотоксины', category: 'LPS_UP' },
  { effectId: 'LPS_DOWN', type: 'SYSTEMIC', description: 'Снижает эндотоксины', category: 'LPS_DOWN' },
  { effectId: 'NO_UP', type: 'DIRECT', description: 'Повышает оксид азота', category: 'NO_UP' },
  { effectId: 'NO_DOWN', type: 'DIRECT', description: 'Снижает оксид азота', category: 'NO_DOWN' },
  { effectId: 'HR_UP', type: 'DIRECT', description: 'Повышает ЧСС', category: 'CARDIO_UP' },
  { effectId: 'HR_DOWN', type: 'DIRECT', description: 'Снижает ЧСС', category: 'CARDIO_DOWN' },
  { effectId: 'BP_UP', type: 'DIRECT', description: 'Повышает давление', category: 'CARDIO_UP' },
  { effectId: 'BP_DOWN', type: 'DIRECT', description: 'Снижает давление', category: 'CARDIO_DOWN' },
  { effectId: 'PLATELETS_UP', type: 'DIRECT', description: 'Повышает тромбоциты', category: 'COAG_UP' },
  { effectId: 'PLATELETS_DOWN', type: 'DIRECT', description: 'Снижает тромбоциты', category: 'COAG_DOWN' },
  { effectId: 'COAG_UP', type: 'SYSTEMIC', description: 'Повышает свёртываемость', category: 'COAG_UP' },
  { effectId: 'COAG_DOWN', type: 'SYSTEMIC', description: 'Снижает свёртываемость', category: 'COAG_DOWN' },
  { effectId: 'MOTILITY_UP', type: 'DIRECT', description: 'Ускоряет моторику ЖКТ', category: 'GUT_UP' },
  { effectId: 'MOTILITY_DOWN', type: 'DIRECT', description: 'Замедляет моторику ЖКТ', category: 'GUT_DOWN' },
  { effectId: 'ACID_UP', type: 'DIRECT', description: 'Повышает кислотность желудка', category: 'GUT_UP' },
  { effectId: 'ACID_DOWN', type: 'DIRECT', description: 'Снижает кислотность желудка', category: 'GUT_DOWN' },
  { effectId: 'IMMUNE_UP', type: 'SYSTEMIC', description: 'Повышает иммунитет', category: 'IMMUNE_UP' },
  { effectId: 'IMMUNE_DOWN', type: 'SYSTEMIC', description: 'Снижает иммунитет', category: 'IMMUNE_DOWN' },
  { effectId: 'AUTOIMMUNE_UP', type: 'SYSTEMIC', description: 'Повышает аутоиммунную активность', category: 'IMMUNE_UP' },
  { effectId: 'MITO_UP', type: 'DIRECT', description: 'Улучшает митохондрии', category: 'ENERGY_UP' },
  { effectId: 'MITO_DOWN', type: 'DIRECT', description: 'Снижает митохондриальную функцию', category: 'ENERGY_DOWN' },
  { effectId: 'ATP_UP', type: 'DIRECT', description: 'Повышает энергию', category: 'ENERGY_UP' },
  { effectId: 'ATP_DOWN', type: 'DIRECT', description: 'Снижает энергию', category: 'ENERGY_DOWN' },
];

export const EFFECT_MAP: Record<string, SupportEffect> = {};
ALL_EFFECTS.forEach(e => { EFFECT_MAP[e.effectId] = e; });

// ═══════════════════════════════════════════════════════════════════════════
// BIOLOGICAL AXES
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_AXES: SupportAxis[] = [
  { axisId: 'AXIS_LIVER_THYROID', name: 'Liver → Thyroid Axis', organs: 'LIVER;THYROID', description: 'Печень активирует T4→T3', mechUp: 'DETOX_UP;T3_T4_UP', mechDown: 'TOXIC_LOAD;INFLAMMATION', highRisks: 'LIVER_FATTY;LIVER_NASH;LIVER_CHOLESTASIS', lowRisks: 'HORMONE_HYPO' },
  { axisId: 'AXIS_THYROID_LIVER', name: 'Thyroid → Liver Axis', organs: 'THYROID;LIVER', description: 'Тиреоидные гормоны регулируют липиды и желчь', mechUp: 'T3_T4_UP', mechDown: 'LIPID_DISORDER;BILE_STASIS', highRisks: 'HORMONE_HYPO;HORMONE_HYPER', lowRisks: 'LIVER_FATTY' },
  { axisId: 'AXIS_GUT_BRAIN', name: 'Gut → Brain Axis', organs: 'GI;BRAIN', description: 'Микробиота управляет серотонином и воспалением', mechUp: 'SCFA_UP;SEROTONIN_UP', mechDown: 'DYSBIOSIS;INFLAMMATION', highRisks: 'GI_DYSBIOSIS;GI_IBS', lowRisks: 'BRAIN_ANXIETY;BRAIN_DEPRESSION' },
  { axisId: 'AXIS_BRAIN_GUT', name: 'Brain → Gut Axis', organs: 'BRAIN;GI', description: 'Стресс влияет на моторику и кислотность', mechUp: 'CORTISOL_UP;NE_UP', mechDown: 'MOTILITY_DOWN;ACID_DOWN', highRisks: 'BRAIN_ANXIETY;BRAIN_BURNOUT', lowRisks: 'GI_IBS;GI_REFLUX' },
  { axisId: 'AXIS_ADRENAL_GONAD', name: 'Adrenals → Gonads Axis', organs: 'ADRENALS;TESTES;OVARIES', description: 'Кортизол подавляет половые гормоны', mechUp: 'CORTISOL_UP', mechDown: 'TESTOSTERONE_DOWN;ESTROGEN_DOWN', highRisks: 'HORMONE_HIGH_CORTISOL', lowRisks: 'HORMONE_LOW_T;HORMONE_LOW_E2' },
  { axisId: 'AXIS_GONAD_ADRENAL', name: 'Gonads → Adrenals Axis', organs: 'TESTES;OVARIES;ADRENALS', description: 'Половые гормоны регулируют стресс‑ответ', mechUp: 'TESTOSTERONE_UP;ESTROGEN_UP', mechDown: 'CORTISOL_UP', highRisks: 'HORMONE_LOW_T;HORMONE_LOW_E2', lowRisks: 'HORMONE_HIGH_CORTISOL' },
  { axisId: 'AXIS_LIVER_GUT', name: 'Liver → Gut Axis', organs: 'LIVER;GI', description: 'Желчь регулирует микробиоту и переваривание', mechUp: 'BILE_FLOW_UP', mechDown: 'STASIS;DYSBIOSIS', highRisks: 'LIVER_CHOLESTASIS;LIVER_BILE_SLUDGE', lowRisks: 'GI_DYSBIOSIS' },
  { axisId: 'AXIS_GUT_LIVER', name: 'Gut → Liver Axis', organs: 'GI;LIVER', description: 'Эндотоксины → воспаление печени', mechUp: 'LPS_DOWN;SCFA_UP', mechDown: 'INFLAMMATION_UP', highRisks: 'GI_DYSBIOSIS', lowRisks: 'LIVER_NASH;LIVER_FATTY' },
  { axisId: 'AXIS_HEART_KIDNEY', name: 'Heart → Kidney Axis', organs: 'HEART;KIDNEYS', description: 'Сердечный выброс регулирует фильтрацию', mechUp: 'GFR_UP', mechDown: 'GFR_DOWN;EDEMA', highRisks: 'HEART_FAILURE', lowRisks: 'KIDNEY_CKD' },
  { axisId: 'AXIS_KIDNEY_HEART', name: 'Kidney → Heart Axis', organs: 'KIDNEYS;HEART', description: 'Электролиты управляют ритмом сердца', mechUp: 'ELECTROLYTES_UP', mechDown: 'ELECTROLYTES_DOWN', highRisks: 'KIDNEY_CKD;KIDNEY_ELECTROLYTE_IMBALANCE', lowRisks: 'HEART_ARRHYTHMIA' },
  { axisId: 'AXIS_LIVER_HORMONES', name: 'Liver → Hormones Axis', organs: 'LIVER;HORMONES', description: 'Печень очищает эстрогены и гормоны', mechUp: 'DETOX_UP', mechDown: 'CLEARANCE_DOWN', highRisks: 'LIVER_FATTY;LIVER_CHOLESTASIS', lowRisks: 'HORMONE_HIGH_E2' },
  { axisId: 'AXIS_HORMONES_LIVER', name: 'Hormones → Liver Axis', organs: 'HORMONES;LIVER', description: 'Эстрогены влияют на желчь и липиды', mechUp: 'ESTROGEN_UP', mechDown: 'BILE_STASIS', highRisks: 'HORMONE_HIGH_E2', lowRisks: 'LIVER_CHOLESTASIS' },
  { axisId: 'AXIS_IMMUNE_GUT', name: 'Immune → Gut Axis', organs: 'IMMUNE_SYSTEM;GI', description: 'Иммунитет управляет барьером кишечника', mechUp: 'IMMUNE_UP', mechDown: 'INFLAMMATION_UP', highRisks: 'IMMUNE_AUTOIMMUNE', lowRisks: 'GI_IBD' },
  { axisId: 'AXIS_GUT_IMMUNE', name: 'Gut → Immune Axis', organs: 'GI;IMMUNE_SYSTEM', description: 'Микробиота регулирует иммунитет', mechUp: 'SCFA_UP', mechDown: 'DYSBIOSIS', highRisks: 'GI_DYSBIOSIS', lowRisks: 'IMMUNE_LOW;IMMUNE_ALLERGY' },
  { axisId: 'AXIS_BRAIN_ADRENAL', name: 'Brain → Adrenal Axis', organs: 'BRAIN;ADRENALS', description: 'Стресс → кортизол', mechUp: 'CORTISOL_UP', mechDown: 'HPA_DYSREGULATION', highRisks: 'BRAIN_ANXIETY;BRAIN_BURNOUT', lowRisks: 'HORMONE_HIGH_CORTISOL' },
  { axisId: 'AXIS_ADRENAL_BRAIN', name: 'Adrenal → Brain Axis', organs: 'ADRENALS;BRAIN', description: 'Кортизол влияет на настроение', mechUp: 'CORTISOL_UP', mechDown: 'SEROTONIN_DOWN', highRisks: 'HORMONE_HIGH_CORTISOL', lowRisks: 'BRAIN_DEPRESSION;BRAIN_BRAIN_FOG' },
  { axisId: 'AXIS_HEART_LIVER', name: 'Heart → Liver Axis', organs: 'HEART;LIVER', description: 'Кровоток влияет на детокс', mechUp: 'CO_UP', mechDown: 'DETOX_DOWN', highRisks: 'HEART_FAILURE', lowRisks: 'LIVER_CONGESTION' },
  { axisId: 'AXIS_LIVER_HEART', name: 'Liver → Heart Axis', organs: 'LIVER;HEART', description: 'Липиды → сосуды', mechUp: 'LIPIDS_UP', mechDown: 'INFLAMMATION_UP', highRisks: 'LIVER_FATTY;LIVER_NASH', lowRisks: 'HEART_ATHEROSCLEROSIS' },
  { axisId: 'AXIS_KIDNEY_ELECTROLYTES', name: 'Kidney → Electrolytes Axis', organs: 'KIDNEYS;CELLS', description: 'Почки регулируют натрий/калий', mechUp: 'ELECTROLYTES_UP', mechDown: 'ELECTROLYTES_DOWN', highRisks: 'KIDNEY_CKD', lowRisks: 'HEART_ARRHYTHMIA' },
  { axisId: 'AXIS_ELECTROLYTES_HEART', name: 'Electrolytes → Heart Axis', organs: 'CELLS;HEART', description: 'Электролиты управляют ритмом сердца', mechUp: 'K_UP;MG_UP', mechDown: 'K_DOWN;MG_DOWN', highRisks: 'KIDNEY_ELECTROLYTE_IMBALANCE', lowRisks: 'HEART_ARRHYTHMIA' },
  { axisId: 'AXIS_LIVER_SKIN', name: 'Liver → Skin Axis', organs: 'LIVER;SKIN', description: 'Токсины → кожа', mechUp: 'DETOX_UP', mechDown: 'TOXIC_LOAD_UP', highRisks: 'LIVER_DETOX_OVERLOAD', lowRisks: 'SKIN_ACNE;SKIN_ECZEMA' },
  { axisId: 'AXIS_SKIN_IMMUNE', name: 'Skin → Immune Axis', organs: 'SKIN;IMMUNE_SYSTEM', description: 'Кожа отражает иммунный статус', mechUp: 'INFLAMMATION_UP', mechDown: 'BARRIER_DOWN', highRisks: 'SKIN_ECZEMA;SKIN_PSORIASIS', lowRisks: 'IMMUNE_AUTOIMMUNE' },
  { axisId: 'AXIS_EYES_BRAIN', name: 'Eyes → Brain Axis', organs: 'EYES;BRAIN', description: 'Зрение связано с когнитивной нагрузкой', mechUp: 'RETINA_UP', mechDown: 'NEUROFATIGUE_UP', highRisks: 'VISION_AGE', lowRisks: 'BRAIN_BRAIN_FOG' },
  { axisId: 'AXIS_BRAIN_EYES', name: 'Brain → Eyes Axis', organs: 'BRAIN;EYES', description: 'Стресс влияет на аккомодацию', mechUp: 'CORTISOL_UP', mechDown: 'ACCOMMODATION_DOWN', highRisks: 'BRAIN_ANXIETY', lowRisks: 'VISION_MYOPIA' },
];

export const AXIS_MAP: Record<string, SupportAxis> = {};
ALL_AXES.forEach(a => { AXIS_MAP[a.axisId] = a; });

// ═══════════════════════════════════════════════════════════════════════════
// HORMONAL AXES
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_HORMONAL_AXES: HormonalAxis[] = [
  { axisId: 'AXIS_HPA', name: 'HPA Axis', type: 'hormonal_axis', path: 'CRH>ACTH>CORTISOL', organs: 'HYPOTHALAMUS>PITUITARY>ADRENALS', func: 'STRESS_RESPONSE', description: 'Ось стресс-реакции' },
  { axisId: 'AXIS_HPT', name: 'HPT Axis', type: 'hormonal_axis', path: 'TRH>TSH>T4/T3', organs: 'HYPOTHALAMUS>PITUITARY>THYROID', func: 'METABOLISM', description: 'Ось щитовидки' },
  { axisId: 'AXIS_HPG', name: 'HPG Axis', type: 'hormonal_axis', path: 'GnRH>LH/FSH>SEX_HORMONES', organs: 'HYPOTHALAMUS>PITUITARY>GONADS', func: 'REPRODUCTION', description: 'Ось половых гормонов' },
  { axisId: 'AXIS_HPTA', name: 'HPTA Axis', type: 'hormonal_axis', path: 'GHRH>GH>IGF1', organs: 'HYPOTHALAMUS>PITUITARY>LIVER', func: 'GROWTH_REPAIR', description: 'Ось роста' },
  { axisId: 'AXIS_METABOLIC', name: 'Metabolic Axis', type: 'hormonal_axis', path: 'INSULIN>LEPTIN>ADIPONECTIN', organs: 'PANCREAS>FAT_TISSUE', func: 'ENERGY_BALANCE', description: 'Метаболическая ось' },
  { axisId: 'AXIS_GI', name: 'GI Endocrine Axis', type: 'hormonal_axis', path: 'GLP1>GIP>PYY>CCK', organs: 'GI_TRACT', func: 'APPETITE_DIGESTION', description: 'Кишечная эндокринная ось' },
  { axisId: 'AXIS_BONE', name: 'Bone Endocrine Axis', type: 'hormonal_axis', path: 'PTH>CALCITONIN>FGF23', organs: 'BONE>THYROID>KIDNEY', func: 'CALCIUM_BALANCE', description: 'Костная эндокринная ось' },
];

export const HORMONAL_AXIS_MAP: Record<string, HormonalAxis> = {};
ALL_HORMONAL_AXES.forEach(a => { HORMONAL_AXIS_MAP[a.axisId] = a; });

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_INTERACTIONS = ([
  { interactionId: 'INT_CAFFEINE_LTHEANINE', substanceA: 'CAFFEINE', substanceB: 'L_THEANINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SMOOTH_FOCUS', mechanisms: ['ADENOSINE_BLOCK', 'GABA_MOD'], severity: 'LOW', notes: 'Теанин сглаживает стимуляцию кофеина и уменьшает тревожность' },
  { interactionId: 'INT_CAFFEINE_NICOTINE', substanceA: 'CAFFEINE', substanceB: 'NICOTINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['ADRENALINE_UP', 'DA_UP'], severity: 'MEDIUM', notes: 'Суммарная стимуляция ЦНС и сердечно-сосудистой системы' },
  { interactionId: 'INT_CAFFEINE_SYNEPHRINE', substanceA: 'CAFFEINE', substanceB: 'SYNEPHRINE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'HEART_STRAIN', mechanisms: ['HR_UP', 'BP_UP'], severity: 'HIGH', notes: 'Риск тахикардии и повышения давления' },
  { interactionId: 'INT_CAFFEINE_YOHIMBINE', substanceA: 'CAFFEINE', substanceB: 'YOHIMBINE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ANXIETY_SPIKE', mechanisms: ['NE_UP', 'ADRENALINE_UP'], severity: 'HIGH', notes: 'Резкая тревога' },
  { interactionId: 'INT_IRON_VITC', substanceA: 'IRON', substanceB: 'VITAMIN_C', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'IRON_ABSORB_UP', mechanisms: ['IRON_UP', 'ACIDITY_UP'], severity: 'LOW', notes: 'Витамин C усиливает всасывание железа' },
  { interactionId: 'INT_IRON_CALCIUM', substanceA: 'IRON', substanceB: 'CALCIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'IRON_ABSORB_DOWN', mechanisms: ['COMPETE_ABSORB'], severity: 'MEDIUM', notes: 'Кальций мешает всасыванию железа при совместном приёме' },
  { interactionId: 'INT_IRON_ZINC', substanceA: 'IRON', substanceB: 'ZINC', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'MINERAL_COMPETE', mechanisms: ['COMPETE_ABSORB'], severity: 'MEDIUM', notes: 'Конкуренция за транспорт и всасывание' },
  { interactionId: 'INT_ZINC_COPPER', substanceA: 'ZINC', substanceB: 'COPPER', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'COPPER_DEPLETION', mechanisms: ['METAL_COMPETE'], severity: 'MEDIUM', notes: 'Длительный высокий цинк снижает медь' },
  { interactionId: 'INT_CALCIUM_MAGNESIUM', substanceA: 'CALCIUM', substanceB: 'MAGNESIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_COMPETE', mechanisms: ['COMPETE_ABSORB'], severity: 'LOW', notes: 'Высокие дозы вместе снижают взаимное всасывание' },
  { interactionId: 'INT_CALCIUM_VITD', substanceA: 'CALCIUM', substanceB: 'VITAMIN_D', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'BONE_SUPPORT', mechanisms: ['CALCIUM_UP', 'VITD_UP'], severity: 'LOW', notes: 'Витамин D улучшает усвоение кальция' },
  { interactionId: 'INT_VITD_K2', substanceA: 'VITAMIN_D', substanceB: 'VITAMIN_K2', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'CALCIUM_TARGETING', mechanisms: ['VITD_UP', 'K2_UP'], severity: 'LOW', notes: 'К2 направляет кальций в кости' },
  { interactionId: 'INT_VITD_MAGNESIUM', substanceA: 'VITAMIN_D', substanceB: 'MAGNESIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'VITD_ACTIVATION', mechanisms: ['VDR_UP', 'MAG_UP'], severity: 'LOW', notes: 'Магний нужен для активации витамина D' },
  { interactionId: 'INT_VITD_A', substanceA: 'VITAMIN_D', substanceB: 'VITAMIN_A', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'IMMUNE_BALANCE', mechanisms: ['NUCLEAR_RECEPTORS'], severity: 'MEDIUM', notes: 'Избыток A+D может смещать иммунный баланс' },
  { interactionId: 'INT_VITK_ANTICOAG', substanceA: 'VITAMIN_K2', substanceB: 'ANTICOAGULANTS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'COAGULATION_SHIFT', mechanisms: ['COAGULATION_UP'], severity: 'HIGH', notes: 'К2 может ослаблять эффект антикоагулянтов' },
  { interactionId: 'INT_OMEGA3_ANTICOAG', substanceA: 'OMEGA3', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Высокие дозы омега‑3 усиливают риск кровотечений' },
  { interactionId: 'INT_OMEGA3_NSAIDS', substanceA: 'OMEGA3', substanceB: 'NSAIDS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIINFLAMMATION_UP', mechanisms: ['COX_DOWN'], severity: 'LOW', notes: 'Суммарный противовоспалительный эффект' },
  { interactionId: 'INT_OMEGA3_VITD', substanceA: 'OMEGA3', substanceB: 'VITAMIN_D', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'IMMUNE_MOD', mechanisms: ['ANTIINFLAMMATION', 'IMMUNE_MOD'], severity: 'LOW', notes: 'Комбо для иммунки и воспаления' },
  { interactionId: 'INT_MG_MELATONIN', substanceA: 'MAGNESIUM', substanceB: 'MELATONIN', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SLEEP_UP', mechanisms: ['GABA_UP', 'MELATONIN_UP'], severity: 'LOW', notes: 'Улучшение качества сна' },
  { interactionId: 'INT_MG_GABA', substanceA: 'MAGNESIUM', substanceB: 'GABA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'CALMING', mechanisms: ['GABA_UP', 'NMDA_DOWN'], severity: 'LOW', notes: 'Суммарный анксиолитический эффект' },
  { interactionId: 'INT_MG_STIMULANTS', substanceA: 'MAGNESIUM', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'HEART_MOD', mechanisms: ['HR_MOD', 'ELECTROLYTES'], severity: 'LOW', notes: 'Магний частично смягчает стимуляторы' },
  { interactionId: 'INT_5HTP_SSRIS', substanceA: '5HTP', substanceB: 'SSRIs', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_SYNDROME', mechanisms: ['SEROTONIN_UP'], severity: 'HIGH', notes: 'Риск серотонинового синдрома' },
  { interactionId: 'INT_5HTP_TRYPTOPHAN', substanceA: '5HTP', substanceB: 'TRYPTOPHAN', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_EXCESS', mechanisms: ['SEROTONIN_UP'], severity: 'MEDIUM', notes: 'Избыточная серотонинергическая нагрузка' },
  { interactionId: 'INT_TRYPTOPHAN_MAOI', substanceA: 'TRYPTOPHAN', substanceB: 'MAOI', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_CRISIS', mechanisms: ['SEROTONIN_UP'], severity: 'HIGH', notes: 'Опасное повышение серотонина' },
  { interactionId: 'INT_STJOHNSWORT_SSRIS', substanceA: 'ST_JOHNS_WORT', substanceB: 'SSRIs', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_SYNDROME', mechanisms: ['SERT_INHIBIT', 'SEROTONIN_UP'], severity: 'HIGH', notes: 'Комбо с СИОЗС опасно' },
  { interactionId: 'INT_STJOHNSWORT_OCP', substanceA: 'ST_JOHNS_WORT', substanceB: 'ORAL_CONTRACEPTIVES', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_CLEARANCE_UP', mechanisms: ['CYP3A4_UP'], severity: 'MEDIUM', notes: 'Может снижать эффективность ОК' },
  { interactionId: 'INT_STJOHNSWORT_WARFARIN', substanceA: 'ST_JOHNS_WORT', substanceB: 'WARFARIN', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ANTICOAG_DOWN', mechanisms: ['CYP_UP'], severity: 'MEDIUM', notes: 'Ускоряет метаболизм варфарина' },
  { interactionId: 'INT_NAC_PARACETAMOL', substanceA: 'NAC', substanceB: 'PARACETAMOL', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'LIVER_PROTECT', mechanisms: ['GLUTATHIONE_UP'], severity: 'MEDIUM', notes: 'NAC снижает гепатотоксичность парацетамола' },
  { interactionId: 'INT_NAC_CHEMO', substanceA: 'NAC', substanceB: 'CHEMOTHERAPY', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIOX_INTERFERE', mechanisms: ['ROS_MOD'], severity: 'MEDIUM', notes: 'Антиоксиданты могут мешать части схем химиотерапии' },
  { interactionId: 'INT_NAC_NITROGLYCERIN', substanceA: 'NAC', substanceB: 'NITRATES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'NO_UP', mechanisms: ['NO_UP'], severity: 'MEDIUM', notes: 'NAC усиливает вазодилатацию' },
  { interactionId: 'INT_CURCUMIN_NSAIDS', substanceA: 'CURCUMIN', substanceB: 'NSAIDS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIINFLAMMATION_UP', mechanisms: ['COX_DOWN', 'NFkB_DOWN'], severity: 'MEDIUM', notes: 'Суммарный противовоспалительный эффект' },
  { interactionId: 'INT_CURCUMIN_ANTICOAG', substanceA: 'CURCUMIN', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Повышение риска кровотечений' },
  { interactionId: 'INT_CURCUMIN_PPI', substanceA: 'CURCUMIN', substanceB: 'PPI', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_MOD', mechanisms: ['PH_MOD'], severity: 'LOW', notes: 'Изменение pH и всасывания' },
  { interactionId: 'INT_RESVERATROL_STATINS', substanceA: 'RESVERATROL', substanceB: 'STATINS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'LIPIDS_UP;ENDOTHELIUM_UP', mechanisms: ['AMPK_UP', 'SIRT1_UP'], severity: 'LOW', notes: 'Потенциальная синергия по липидам и сосудам' },
  { interactionId: 'INT_RESVERATROL_WARFARIN', substanceA: 'RESVERATROL', substanceB: 'WARFARIN', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Усиление антикоагуляции' },
  { interactionId: 'INT_PROBIOTICS_ANTIBIOTICS', substanceA: 'PROBIOTICS', substanceB: 'ANTIBIOTICS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'BUGS_KILLED', mechanisms: ['ABX_KILL', 'MICROBIOME'], severity: 'HIGH', notes: 'Антибиотики убивают пробиотические штаммы' },
  { interactionId: 'INT_PROBIOTICS_FIBER', substanceA: 'PROBIOTICS', substanceB: 'PREBIOTIC_FIBER', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'MICROBIOME_UP', mechanisms: ['SCFA_UP'], severity: 'LOW', notes: 'Клетчатка кормит пробиотики' },
  { interactionId: 'INT_PROBIOTICS_PPI', substanceA: 'PROBIOTICS', substanceB: 'PPI', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SURVIVAL_UP', mechanisms: ['PH_UP'], severity: 'LOW', notes: 'Снижение кислотности повышает выживаемость бактерий' },
  { interactionId: 'INT_FIBER_DRUGS', substanceA: 'PREBIOTIC_FIBER', substanceB: 'ORAL_DRUGS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_DOWN', mechanisms: ['BINDING'], severity: 'MEDIUM', notes: 'Клетчатка может снижать всасывание лекарств' },
  { interactionId: 'INT_FIBER_MINERALS', substanceA: 'PREBIOTIC_FIBER', substanceB: 'MINERALS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_DOWN', mechanisms: ['BINDING'], severity: 'MEDIUM', notes: 'Связывание минералов в ЖКТ' },
  { interactionId: 'INT_MELATONIN_BENZOS', substanceA: 'MELATONIN', substanceB: 'BENZODIAZEPINES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SEDATION_UP', mechanisms: ['GABA_UP', 'SLEEP_UP'], severity: 'MEDIUM', notes: 'Суммарная седация' },
  { interactionId: 'INT_MELATONIN_ALCOHOL', substanceA: 'MELATONIN', substanceB: 'ALCOHOL', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'SLEEP_ARCH_DISRUPT', mechanisms: ['GABA_MOD', 'CNS_DEPRESS'], severity: 'HIGH', notes: 'Нарушение структуры сна и ЦНС' },
  { interactionId: 'INT_ALCOHOL_PARACETAMOL', substanceA: 'ALCOHOL', substanceB: 'PARACETAMOL', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'LIVER_TOX', mechanisms: ['TOXIC_METABOLITES'], severity: 'HIGH', notes: 'Сильная нагрузка на печень' },
  { interactionId: 'INT_ALCOHOL_BENZOS', substanceA: 'ALCOHOL', substanceB: 'BENZODIAZEPINES', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'CNS_DEPRESSION', mechanisms: ['CNS_DOWN'], severity: 'HIGH', notes: 'Риск угнетения дыхания' },
  { interactionId: 'INT_ALCOHOL_ANTIDEPRESSANTS', substanceA: 'ALCOHOL', substanceB: 'ANTIDEPRESSANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'MOOD_INSTABILITY', mechanisms: ['CNS_MOD'], severity: 'MEDIUM', notes: 'Непредсказуемый эффект на настроение и ЦНС' },
  { interactionId: 'INT_NICOTINE_STIMULANTS', substanceA: 'NICOTINE', substanceB: 'STIMULANTS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['NE_UP', 'DA_UP'], severity: 'MEDIUM', notes: 'Суммарная нагрузка на сердце и ЦНС' },
  { interactionId: 'INT_NICOTINE_BETA_BLOCKERS', substanceA: 'NICOTINE', substanceB: 'BETA_BLOCKERS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_EFFECT_DOWN', mechanisms: ['RECEPTOR_COMPETE'], severity: 'MEDIUM', notes: 'Ослабление эффекта бета‑блокаторов' },
  { interactionId: 'INT_GINSENG_STIMULANTS', substanceA: 'GINSENG', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['ADRENAL_UP'], severity: 'MEDIUM', notes: 'Риск тревоги и тахикардии' },
  { interactionId: 'INT_GINSENG_ANTICOAG', substanceA: 'GINSENG', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_MOD'], severity: 'MEDIUM', notes: 'Возможное усиление кровоточивости' },
  { interactionId: 'INT_ASHWAGANDHA_BENZOS', substanceA: 'ASHWAGANDHA', substanceB: 'BENZODIAZEPINES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SEDATION_UP', mechanisms: ['GABA_MOD'], severity: 'MEDIUM', notes: 'Суммарная седация и расслабление' },
  { interactionId: 'INT_ASHWAGANDHA_THYROID', substanceA: 'ASHWAGANDHA', substanceB: 'THYROID_DRUGS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'THYROID_MOD', mechanisms: ['T3_T4_MOD'], severity: 'MEDIUM', notes: 'Может усиливать или менять эффект тиреоидных препаратов' },
  { interactionId: 'INT_RHODIOLA_STIMULANTS', substanceA: 'RHODIOLA', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['NE_UP', 'DA_UP'], severity: 'MEDIUM', notes: 'Риск тревоги и тахикардии' },
  { interactionId: 'INT_RHODIOLA_SSRIS', substanceA: 'RHODIOLA', substanceB: 'SSRIs', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_UP', mechanisms: ['SEROTONIN_MOD'], severity: 'MEDIUM', notes: 'Потенциальное усиление серотонинергики' },
  { interactionId: 'INT_LITHIUM_SODIUM', substanceA: 'LITHIUM', substanceB: 'SODIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'LITHIUM_LEVEL_SHIFT', mechanisms: ['RENAL_CLEARANCE'], severity: 'HIGH', notes: 'Изменение натрия меняет уровень лития' },
  { interactionId: 'INT_LITHIUM_NSAIDS', substanceA: 'LITHIUM', substanceB: 'NSAIDS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'LITHIUM_UP', mechanisms: ['RENAL_CLEARANCE_DOWN'], severity: 'HIGH', notes: 'НПВС могут повышать концентрацию лития' },
  { interactionId: 'INT_STATINS_GRAPEFRUIT', substanceA: 'STATINS', substanceB: 'GRAPEFRUIT', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_LEVEL_UP', mechanisms: ['CYP3A4_INHIBIT'], severity: 'HIGH', notes: 'Грейпфрут повышает уровень статинов' },
  { interactionId: 'INT_STATINS_COQ10', substanceA: 'STATINS', substanceB: 'COQ10', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'MUSCLE_PROTECT', mechanisms: ['MITO_UP'], severity: 'LOW', notes: 'КоQ10 снижает риск миопатии' },
  { interactionId: 'INT_METFORMIN_B12', substanceA: 'METFORMIN', substanceB: 'VITAMIN_B12', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'B12_DOWN', mechanisms: ['ABSORB_DOWN'], severity: 'MEDIUM', notes: 'Метформин снижает всасывание B12' },
  { interactionId: 'INT_METFORMIN_BERBERINE', substanceA: 'METFORMIN', substanceB: 'BERBERINE', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'GLUCOSE_DOWN', mechanisms: ['AMPK_UP', 'GLUCOSE_DOWN'], severity: 'MEDIUM', notes: 'Суммарное снижение глюкозы' },
  { interactionId: 'INT_DIURETICS_ELECTROLYTES', substanceA: 'DIURETICS', substanceB: 'ELECTROLYTES', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ELECTROLYTE_SHIFT', mechanisms: ['NA_K_MOD'], severity: 'HIGH', notes: 'Риск нарушений калия/натрия' },
  { interactionId: 'INT_DIURETICS_MG', substanceA: 'DIURETICS', substanceB: 'MAGNESIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'MG_DOWN', mechanisms: ['RENAL_LOSS'], severity: 'MEDIUM', notes: 'Диуретики вымывают магний' },
  { interactionId: 'INT_PPI_MINERALS', substanceA: 'PPI', substanceB: 'MINERALS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_DOWN', mechanisms: ['PH_UP'], severity: 'MEDIUM', notes: 'Снижение кислотности ухудшает всасывание минералов' },
  { interactionId: 'INT_PPI_B12', substanceA: 'PPI', substanceB: 'VITAMIN_B12', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'B12_DOWN', mechanisms: ['PH_UP'], severity: 'MEDIUM', notes: 'Длительный приём PPI снижает B12' },
  { interactionId: 'INT_FOLATE_METHOTREXATE', substanceA: 'FOLATE', substanceB: 'METHOTREXATE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_EFFECT_DOWN', mechanisms: ['FOLATE_PATH'], severity: 'HIGH', notes: 'Фолаты могут ослаблять эффект метотрексата' },
  { interactionId: 'INT_FOLATE_ANTICONVULSANTS', substanceA: 'FOLATE', substanceB: 'ANTICONVULSANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_LEVEL_MOD', mechanisms: ['CYP_MOD'], severity: 'MEDIUM', notes: 'Возможное изменение эффективности противосудорожных' },
  { interactionId: 'INT_KETOGENIC_CARB_DRUGS', substanceA: 'KETO_DIET', substanceB: 'GLUCOSE_LOWERING_DRUGS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'HYPOGLYCEMIA', mechanisms: ['GLUCOSE_DOWN'], severity: 'MEDIUM', notes: 'Риск гипогликемии на кето + сахароснижающие' },
  { interactionId: 'INT_KETO_ELECTROLYTES', substanceA: 'KETO_DIET', substanceB: 'ELECTROLYTES', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ELECTROLYTE_SHIFT', mechanisms: ['NA_K_MOD'], severity: 'LOW', notes: 'Нужна коррекция электролитов' },
  { interactionId: 'INT_HYPERZINE_CHOLINE', substanceA: 'HUPERZINE_A', substanceB: 'CHOLINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ACH_UP', mechanisms: ['ACHE_INHIBIT', 'ACH_UP'], severity: 'MEDIUM', notes: 'Сильная холинергическая нагрузка' },
  { interactionId: 'INT_HYPERZINE_STIMULANTS', substanceA: 'HUPERZINE_A', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'CNS_OVERLOAD', mechanisms: ['ACH_UP', 'NE_UP'], severity: 'MEDIUM', notes: 'Риск перегруза ЦНС' },
  { interactionId: 'INT_PSYCHOSTIM_BENZOS', substanceA: 'STIMULANTS', substanceB: 'BENZODIAZEPINES', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'COUNTERACT', mechanisms: ['CNS_UP', 'CNS_DOWN'], severity: 'LOW', notes: 'Взаимное частичное нивелирование эффектов' },
  { interactionId: 'INT_PSYCHOSTIM_ANTIPSYCH', substanceA: 'STIMULANTS', substanceB: 'ANTIPSYCHOTICS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OPPOSITE_EFFECTS', mechanisms: ['DA_UP', 'DA_BLOCK'], severity: 'MEDIUM', notes: 'Противонаправленные эффекты по дофамину' },
  { interactionId: 'INT_GABA_BENZOS', substanceA: 'GABA', substanceB: 'BENZODIAZEPINES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'SEDATION_UP', mechanisms: ['GABA_UP'], severity: 'MEDIUM', notes: 'Сильная седация при совместном приёме' },
  { interactionId: 'INT_GABA_ALCOHOL', substanceA: 'GABA', substanceB: 'ALCOHOL', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'CNS_DEPRESSION', mechanisms: ['CNS_DOWN'], severity: 'HIGH', notes: 'Опасное угнетение ЦНС' },
  { interactionId: 'INT_GABA_ASHWAGANDHA', substanceA: 'GABA', substanceB: 'ASHWAGANDHA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'CALMING_UP', mechanisms: ['GABA_MOD'], severity: 'LOW', notes: 'Усиление расслабления' },
  { interactionId: 'INT_TYROSINE_STIMULANTS', substanceA: 'TYROSINE', substanceB: 'STIMULANTS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'DA_NE_UP', mechanisms: ['DA_UP', 'NE_UP'], severity: 'MEDIUM', notes: 'Усиление стимуляции' },
  { interactionId: 'INT_TYROSINE_MAOI', substanceA: 'TYROSINE', substanceB: 'MAOI', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'HYPERTENSIVE_CRISIS', mechanisms: ['NE_UP'], severity: 'HIGH', notes: 'Риск гипертонического криза' },
  { interactionId: 'INT_TYROSINE_LDOPA', substanceA: 'TYROSINE', substanceB: 'L_DOPA', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'DA_EXCESS', mechanisms: ['DA_UP'], severity: 'MEDIUM', notes: 'Избыток дофамина' },
  { interactionId: 'INT_CHOLINE_RACETAMS', substanceA: 'CHOLINE', substanceB: 'RACETAMS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ACH_UP', mechanisms: ['ACH_UP'], severity: 'LOW', notes: 'Холин усиливает эффект рацетамов' },
  { interactionId: 'INT_CHOLINE_HUPERZINE', substanceA: 'CHOLINE', substanceB: 'HUPERZINE_A', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ACH_OVERLOAD', mechanisms: ['ACH_UP', 'ACHE_INHIBIT'], severity: 'MEDIUM', notes: 'Сильная холинергическая нагрузка' },
  { interactionId: 'INT_CHOLINE_ANTICHOLINERGICS', substanceA: 'CHOLINE', substanceB: 'ANTICHOLINERGICS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OPPOSITE_EFFECTS', mechanisms: ['ACH_UP', 'ACH_BLOCK'], severity: 'MEDIUM', notes: 'Противонаправленные эффекты' },
  { interactionId: 'INT_RACETAMS_STIMULANTS', substanceA: 'RACETAMS', substanceB: 'STIMULANTS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'FOCUS_UP', mechanisms: ['NEURO_UP'], severity: 'LOW', notes: 'Усиление концентрации' },
  { interactionId: 'INT_RACETAMS_GABA', substanceA: 'RACETAMS', substanceB: 'GABA', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'MOOD_SHIFT', mechanisms: ['GABA_MOD'], severity: 'LOW', notes: 'Непредсказуемый эффект на настроение' },
  { interactionId: 'INT_RACETAMS_PIRACETAM_CAFFEINE', substanceA: 'PIRACETAM', substanceB: 'CAFFEINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'FOCUS_UP', mechanisms: ['NEURO_UP'], severity: 'LOW', notes: 'Лёгкая стимуляция + когнитивный буст' },
  { interactionId: 'INT_LCARNITINE_CAFFEINE', substanceA: 'L_CARNITINE', substanceB: 'CAFFEINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'FAT_BURN_UP', mechanisms: ['FAT_OX_UP'], severity: 'LOW', notes: 'Усиление липолиза' },
  { interactionId: 'INT_LCARNITINE_THYROID', substanceA: 'L_CARNITINE', substanceB: 'THYROID_DRUGS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'THYROID_MOD', mechanisms: ['T3_T4_MOD'], severity: 'MEDIUM', notes: 'Может снижать действие тиреоидных гормонов' },
  { interactionId: 'INT_COQ10_STATINS', substanceA: 'COQ10', substanceB: 'STATINS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'MUSCLE_PROTECT', mechanisms: ['MITO_UP'], severity: 'LOW', notes: 'Снижение риска миопатии' },
  { interactionId: 'INT_COQ10_WARFARIN', substanceA: 'COQ10', substanceB: 'WARFARIN', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ANTICOAG_MOD', mechanisms: ['COAGULATION_MOD'], severity: 'MEDIUM', notes: 'Может ослаблять антикоагуляцию' },
  { interactionId: 'INT_BERBERINE_METFORMIN', substanceA: 'BERBERINE', substanceB: 'METFORMIN', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'GLUCOSE_DOWN', mechanisms: ['AMPK_UP'], severity: 'MEDIUM', notes: 'Сильное снижение сахара' },
  { interactionId: 'INT_BERBERINE_ANTIBIOTICS', substanceA: 'BERBERINE', substanceB: 'ANTIBIOTICS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'GUT_MOD', mechanisms: ['ANTIMICROBIAL'], severity: 'LOW', notes: 'Может менять микробиоту' },
  { interactionId: 'INT_BERBERINE_CYCLOSPORINE', substanceA: 'BERBERINE', substanceB: 'CYCLOSPORINE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_LEVEL_UP', mechanisms: ['CYP3A4_INHIBIT'], severity: 'HIGH', notes: 'Опасное повышение уровня препарата' },
  { interactionId: 'INT_QUERCETIN_ANTIHISTAMINES', substanceA: 'QUERCETIN', substanceB: 'ANTIHISTAMINES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ALLERGY_DOWN', mechanisms: ['H1_BLOCK'], severity: 'LOW', notes: 'Усиление антигистаминного эффекта' },
  { interactionId: 'INT_QUERCETIN_CHEMO', substanceA: 'QUERCETIN', substanceB: 'CHEMOTHERAPY', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIOX_INTERFERE', mechanisms: ['ROS_MOD'], severity: 'MEDIUM', notes: 'Антиоксиданты могут мешать терапии' },
  { interactionId: 'INT_QUERCETIN_CYCLOSPORINE', substanceA: 'QUERCETIN', substanceB: 'CYCLOSPORINE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_LEVEL_UP', mechanisms: ['CYP3A4_INHIBIT'], severity: 'HIGH', notes: 'Повышение уровня циклоспорина' },
  { interactionId: 'INT_MELATONIN_SSRI', substanceA: 'MELATONIN', substanceB: 'SSRIs', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_MOD', mechanisms: ['SEROTONIN_UP'], severity: 'LOW', notes: 'Может усиливать сонливость' },
  { interactionId: 'INT_MELATONIN_STIMULANTS', substanceA: 'MELATONIN', substanceB: 'STIMULANTS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OPPOSITE_EFFECTS', mechanisms: ['CNS_DOWN', 'CNS_UP'], severity: 'LOW', notes: 'Противонаправленные эффекты' },
  { interactionId: 'INT_MELATONIN_CORTISOL', substanceA: 'MELATONIN', substanceB: 'CORTISOL_DRUGS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'HORMONE_SHIFT', mechanisms: ['CIRCADIAN_MOD'], severity: 'MEDIUM', notes: 'Сдвиг циркадных ритмов' },
  { interactionId: 'INT_YOHIMBINE_STIMULANTS', substanceA: 'YOHIMBINE', substanceB: 'STIMULANTS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['NE_UP', 'ADRENALINE_UP'], severity: 'HIGH', notes: 'Риск паники и тахикардии' },
  { interactionId: 'INT_YOHIMBINE_ANTIHYPERTENSIVES', substanceA: 'YOHIMBINE', substanceB: 'ANTIHYPERTENSIVES', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'BP_UP', mechanisms: ['ALPHA2_BLOCK'], severity: 'HIGH', notes: 'Повышает давление' },
  { interactionId: 'INT_YOHIMBINE_SILDENAFIL', substanceA: 'YOHIMBINE', substanceB: 'SILDENAFIL', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BP_SHIFT', mechanisms: ['NO_UP', 'NE_UP'], severity: 'MEDIUM', notes: 'Непредсказуемое влияние на давление' },
  { interactionId: 'INT_SYNEPHRINE_CAFFEINE', substanceA: 'SYNEPHRINE', substanceB: 'CAFFEINE', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'HEART_STRAIN', mechanisms: ['HR_UP', 'BP_UP'], severity: 'HIGH', notes: 'Сильная нагрузка на сердце' },
  { interactionId: 'INT_SYNEPHRINE_STIMULANTS', substanceA: 'SYNEPHRINE', substanceB: 'STIMULANTS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OVERSTIMULATION', mechanisms: ['NE_UP'], severity: 'HIGH', notes: 'Опасная стимуляция' },
  { interactionId: 'INT_SYNEPHRINE_BETA_BLOCKERS', substanceA: 'SYNEPHRINE', substanceB: 'BETA_BLOCKERS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_EFFECT_DOWN', mechanisms: ['RECEPTOR_COMPETE'], severity: 'MEDIUM', notes: 'Ослабляет действие бета‑блокаторов' },
  { interactionId: 'INT_GREEN_TEA_CAFFEINE', substanceA: 'GREEN_TEA_EXTRACT', substanceB: 'CAFFEINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'FAT_BURN_UP', mechanisms: ['EGCG_UP'], severity: 'LOW', notes: 'Усиление термогенеза' },
  { interactionId: 'INT_GREEN_TEA_IRON', substanceA: 'GREEN_TEA_EXTRACT', substanceB: 'IRON', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'IRON_ABSORB_DOWN', mechanisms: ['TANNINS_BIND'], severity: 'MEDIUM', notes: 'Снижает всасывание железа' },
  { interactionId: 'INT_GREEN_TEA_WARFARIN', substanceA: 'GREEN_TEA_EXTRACT', substanceB: 'WARFARIN', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'COAGULATION_SHIFT', mechanisms: ['VITK_MOD'], severity: 'MEDIUM', notes: 'Может снижать эффект варфарина' },
  { interactionId: 'INT_GINGER_ANTICOAG', substanceA: 'GINGER', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Повышение риска кровотечений' },
  { interactionId: 'INT_GINGER_NSAIDS', substanceA: 'GINGER', substanceB: 'NSAIDS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIINFLAMMATION_UP', mechanisms: ['COX_DOWN'], severity: 'LOW', notes: 'Суммарный противовоспалительный эффект' },
  { interactionId: 'INT_GINGER_HYPOTENSIVES', substanceA: 'GINGER', substanceB: 'HYPOTENSIVES', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'BP_DOWN', mechanisms: ['VESSEL_RELAX'], severity: 'LOW', notes: 'Усиление гипотензивного эффекта' },
  { interactionId: 'INT_TURMERIC_PIPERINE', substanceA: 'CURCUMIN', substanceB: 'PIPERINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'BIOAVAIL_UP', mechanisms: ['CYP_INHIBIT'], severity: 'LOW', notes: 'Пиперин усиливает всасывание куркумина' },
  { interactionId: 'INT_TURMERIC_ANTICOAG', substanceA: 'CURCUMIN', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Повышение риска кровотечений' },
  { interactionId: 'INT_TURMERIC_STEROIDS', substanceA: 'CURCUMIN', substanceB: 'STEROIDS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIINFLAMMATION_UP', mechanisms: ['NFkB_DOWN'], severity: 'LOW', notes: 'Усиление противовоспалительного эффекта' },
  { interactionId: 'INT_GARLIC_ANTICOAG', substanceA: 'GARLIC', substanceB: 'ANTICOAGULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'BLEED_RISK', mechanisms: ['PLATELETS_DOWN'], severity: 'MEDIUM', notes: 'Чеснок усиливает антикоагуляцию' },
  { interactionId: 'INT_GARLIC_HIV_DRUGS', substanceA: 'GARLIC', substanceB: 'HIV_DRUGS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_LEVEL_DOWN', mechanisms: ['CYP3A4_UP'], severity: 'MEDIUM', notes: 'Снижает концентрацию препаратов' },
  { interactionId: 'INT_GARLIC_BP_DRUGS', substanceA: 'GARLIC', substanceB: 'BP_DRUGS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'BP_DOWN', mechanisms: ['VESSEL_RELAX'], severity: 'LOW', notes: 'Усиление гипотензивного эффекта' },
  { interactionId: 'INT_VITC_IRON', substanceA: 'VITAMIN_C', substanceB: 'IRON', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'IRON_ABSORB_UP', mechanisms: ['ACIDITY_UP'], severity: 'LOW', notes: 'Усиление всасывания железа' },
  { interactionId: 'INT_VITC_COPPER', substanceA: 'VITAMIN_C', substanceB: 'COPPER', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'COPPER_DOWN', mechanisms: ['REDOX_MOD'], severity: 'MEDIUM', notes: 'Высокие дозы C снижают медь' },
  { interactionId: 'INT_VITC_CHEMO', substanceA: 'VITAMIN_C', substanceB: 'CHEMOTHERAPY', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'ANTIOX_INTERFERE', mechanisms: ['ROS_MOD'], severity: 'MEDIUM', notes: 'Антиоксиданты могут мешать терапии' },
  { interactionId: 'INT_ZINC_COPPER', substanceA: 'ZINC', substanceB: 'COPPER', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'COPPER_DEPLETION', mechanisms: ['METAL_COMPETE'], severity: 'MEDIUM', notes: 'Цинк снижает медь' },
  { interactionId: 'INT_ZINC_IRON', substanceA: 'ZINC', substanceB: 'IRON', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_COMPETE', mechanisms: ['COMPETE_ABSORB'], severity: 'MEDIUM', notes: 'Конкуренция минералов' },
  { interactionId: 'INT_ZINC_MAGNESIUM', substanceA: 'ZINC', substanceB: 'MAGNESIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_COMPETE', mechanisms: ['COMPETE_ABSORB'], severity: 'LOW', notes: 'Снижение всасывания при одновременном приёме' },
  { interactionId: 'INT_MAGNESIUM_VITD', substanceA: 'MAGNESIUM', substanceB: 'VITAMIN_D', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'VITD_ACTIVATION', mechanisms: ['VDR_UP'], severity: 'LOW', notes: 'Магний активирует витамин D' },
  { interactionId: 'INT_MAGNESIUM_CALCIUM', substanceA: 'MAGNESIUM', substanceB: 'CALCIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_COMPETE', mechanisms: ['COMPETE_ABSORB'], severity: 'LOW', notes: 'Минералы конкурируют' },
  { interactionId: 'INT_MAGNESIUM_STIMULANTS', substanceA: 'MAGNESIUM', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'HEART_MOD', mechanisms: ['ELECTROLYTES'], severity: 'LOW', notes: 'Смягчает стимуляцию' },
  { interactionId: 'INT_POTASSIUM_DIURETICS', substanceA: 'POTASSIUM', substanceB: 'DIURETICS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'K_SHIFT', mechanisms: ['RENAL_MOD'], severity: 'MEDIUM', notes: 'Риск гиперкалиемии' },
  { interactionId: 'INT_POTASSIUM_ACEI', substanceA: 'POTASSIUM', substanceB: 'ACE_INHIBITORS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'K_UP', mechanisms: ['RENAL_MOD'], severity: 'HIGH', notes: 'Опасное повышение калия' },
  { interactionId: 'INT_POTASSIUM_DIGOXIN', substanceA: 'POTASSIUM', substanceB: 'DIGOXIN', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'DRUG_EFFECT_MOD', mechanisms: ['ELECTROLYTES'], severity: 'HIGH', notes: 'Нарушение работы сердца' },
  { interactionId: 'INT_CALCIUM_VITK2', substanceA: 'CALCIUM', substanceB: 'VITAMIN_K2', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'BONE_UP', mechanisms: ['K2_UP'], severity: 'LOW', notes: 'К2 направляет кальций в кости' },
  { interactionId: 'INT_CALCIUM_PPI', substanceA: 'CALCIUM', substanceB: 'PPI', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_DOWN', mechanisms: ['PH_UP'], severity: 'MEDIUM', notes: 'Снижение всасывания кальция' },
  { interactionId: 'INT_CALCIUM_IRON', substanceA: 'CALCIUM', substanceB: 'IRON', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'ABSORB_DOWN', mechanisms: ['COMPETE_ABSORB'], severity: 'MEDIUM', notes: 'Кальций мешает железу' },
  { interactionId: 'INT_SELENIUM_VITC', substanceA: 'SELENIUM', substanceB: 'VITAMIN_C', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'REDOX_SHIFT', mechanisms: ['ANTIOX_MOD'], severity: 'LOW', notes: 'Изменение антиоксидантного баланса' },
  { interactionId: 'INT_SELENIUM_THYROID', substanceA: 'SELENIUM', substanceB: 'THYROID_DRUGS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'THYROID_UP', mechanisms: ['T3_T4_UP'], severity: 'LOW', notes: 'Поддержка щитовидки' },
  { interactionId: 'INT_SELENIUM_ZINC', substanceA: 'SELENIUM', substanceB: 'ZINC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'IMMUNE_UP', mechanisms: ['ANTIOX_UP'], severity: 'LOW', notes: 'Иммунная синергия' },
  { interactionId: 'INT_IODINE_THYROID', substanceA: 'IODINE', substanceB: 'THYROID_DRUGS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'THYROID_SHIFT', mechanisms: ['T3_T4_MOD'], severity: 'MEDIUM', notes: 'Может менять дозировку гормонов' },
  { interactionId: 'INT_IODINE_LITHIUM', substanceA: 'IODINE', substanceB: 'LITHIUM', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'THYROID_MOD', mechanisms: ['THYROID_UP'], severity: 'MEDIUM', notes: 'Йод влияет на щитовидку при литии' },
  { interactionId: 'INT_IODINE_ANTITHYROID', substanceA: 'IODINE', substanceB: 'ANTITHYROID_DRUGS', type: 'conflict' as 'synergy' | 'conflict' | 'caution', effect: 'OPPOSITE_EFFECTS', mechanisms: ['T3_T4_UP', 'T3_T4_DOWN'], severity: 'MEDIUM', notes: 'Противонаправленные эффекты' },
  { interactionId: 'INT_ADAPTOGENS_STIMULANTS', substanceA: 'ADAPTOGENS', substanceB: 'STIMULANTS', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'STRESS_AXIS_MOD', mechanisms: ['HPA_MOD'], severity: 'LOW', notes: 'Может менять реакцию на стимуляторы' },
  { interactionId: 'INT_ADAPTOGENS_BENZOS', substanceA: 'ADAPTOGENS', substanceB: 'BENZODIAZEPINES', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'SEDATION_MOD', mechanisms: ['GABA_MOD'], severity: 'LOW', notes: 'Суммарная релаксация' },
  { interactionId: 'INT_ADAPTOGENS_SSRI', substanceA: 'ADAPTOGENS', substanceB: 'SSRIs', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'SEROTONIN_MOD', mechanisms: ['SEROTONIN_UP'], severity: 'LOW', notes: 'Мягкая серотонинергическая модуляция' },

  { interactionId: 'SYNERGY_AUTO_001', substanceA: 'VITAMIN_D', substanceB: 'CALCIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Vitamin D усиливает всасывание кальция в кишечнике, направляя его в костную ткань', mechanisms: ['Усиление абсорбции кальция', 'Активация кальций-связывающих белков'], severity: 'HIGH', notes: 'Без D3 кальций усваивается на 10-15% хуже; дефицит ведет к остеопорозу' },
  { interactionId: 'SYNERGY_AUTO_002', substanceA: 'MAGNESIUM', substanceB: 'VITAMIN_B6', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Магний и витамин B6 синергично поддерживают нервную систему: B6 улучшает внутриклеточный транспорт магния', mechanisms: ['Усиление транспорта магния', 'Коферментная активация B6'], severity: 'HIGH', notes: 'Магний B6 - классическая комбинация для снижения тревоги и улучшения сна' },
  { interactionId: 'SYNERGY_AUTO_003', substanceA: 'B_COMPLEX', substanceB: 'METHYLATION_CYCLE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'B-витамины работают как команда коферментов, усиливая метаболизм энергии и работу нервной системы', mechanisms: ['Коферментное взаимодействие', 'Цикл Кребса', 'Синергия метилирования'], severity: 'HIGH', notes: 'Комплекс B-витаминов эффективнее чем прием по отдельности' },
  { interactionId: 'SYNERGY_AUTO_004', substanceA: 'VITAMIN_C', substanceB: 'IRON', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Vitamin C увеличивает всасывание негемового железа в 2-3 раза за счет восстановления Fe3+ до Fe2+', mechanisms: ['Восстановление Fe3+ до Fe2+', 'Хелатирование железа'], severity: 'HIGH', notes: 'Принимать витамин C вместе с железом при анемии' },
  { interactionId: 'SYNERGY_AUTO_005', substanceA: 'CURCUMIN', substanceB: 'PIPERINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Пиперин (черный перец) увеличивает биодоступность куркумина на 2000% через ингибирование глюкуронизации', mechanisms: ['Ингибирование глюкуронизации', 'Усиление абсорбции'], severity: 'HIGH', notes: 'Куркумин без пиперина практически не усваивается организмом' },
  { interactionId: 'SYNERGY_AUTO_006', substanceA: 'VITAMIN_D', substanceB: 'VITAMIN_K2', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Vitamin K2 направляет кальций в костную ткань, предотвращая его отложение в сосудах при приеме D3', mechanisms: ['Активация остеокальцина', 'Регуляция кальциевого гомеостаза', 'Сосудистая защита'], severity: 'HIGH', notes: 'Критическая комбинация при приеме высоких доз витамина D3' },
  { interactionId: 'SYNERGY_AUTO_007', substanceA: 'VITAMIN_B12', substanceB: 'VITAMIN_B9_FOLIC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'B12 и фолат (B9) работают вместе в цикле метилирования: фолат передает метильные группы, B12 их акцептирует', mechanisms: ['Цикл метионина', 'Синтез SAMe', 'Эритропоэз'], severity: 'HIGH', notes: 'Дефицит B12 маскирует фолатодефицитную анемию' },
  { interactionId: 'SYNERGY_AUTO_008', substanceA: 'PREBIOTIC_FIBER', substanceB: 'PROBIOTICS', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Пребиотики (клетчатка, инулин) служат пищей для пробиотиков, увеличивая их выживаемость в 10 раз', mechanisms: ['Синбиотическое действие', 'Продукция КЦЖК', 'Поддержка микробиома'], severity: 'HIGH', notes: 'Синбиотики - комбинация про- и пребиотиков' },
  { interactionId: 'SYNERGY_AUTO_009', substanceA: 'SELENIUM', substanceB: 'IODINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Селен и йод синергично поддерживают щитовидную железу: селен защищает тиреоциты, йод - субстрат для гормонов', mechanisms: ['Синтез дейодиназ', 'Антиоксидантная защита тиреоцитов', 'Йодирование тиреоглобулина'], severity: 'HIGH', notes: 'Для синтеза T3 и T4 необходимы оба микроэлемента' },
  { interactionId: 'SYNERGY_AUTO_010', substanceA: 'GLUCOSAMINE', substanceB: 'CHONDROITIN', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Глюкозамин и хондроитин восстанавливают хрящевую ткань: хондроитин удерживает воду, глюкозамин стимулирует синтез протеогликанов', mechanisms: ['Синтез протеогликанов', 'Гидратация хряща', 'Ингибирование разрушения матрикса'], severity: 'HIGH', notes: 'Классическая комбинация для суставов, эффект через 2-3 месяца' },
  { interactionId: 'SYNERGY_AUTO_011', substanceA: 'ZINC', substanceB: 'MAGNESIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ZMA (цинк + магний + B6): тройная синергия для анаболизма, сна и восстановления', mechanisms: ['Андрогенная поддержка', 'ГАМК-ергическая передача', 'Коферментная активация'], severity: 'HIGH', notes: 'Оптимально принимать перед сном натощак' },
  { interactionId: 'SYNERGY_AUTO_012', substanceA: 'OMEGA3', substanceB: 'COQ10', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Омега-3 жирные кислоты улучшают транспорт CoQ10 в митохондрии через липидный матрикс', mechanisms: ['Липидный транспорт', 'Митохондриальная синергия', 'Мембранная интеграция'], severity: 'MEDIUM', notes: 'CoQ10 на омега-3 основе имеет в 2 раза лучшую биодоступность' },
  { interactionId: 'SYNERGY_AUTO_013', substanceA: 'CREATINE', substanceB: 'BETA_ALANINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Креатин и бета-аланин синергично усиливают силовые показатели и выносливость', mechanisms: ['Буферизация pH мышц', 'Увеличение фосфокреатина', 'Анаэробный метаболизм'], severity: 'MEDIUM', notes: 'Принимать 3-5 г креатина + 2-4 г бета-аланина в день' },
  { interactionId: 'SYNERGY_AUTO_014', substanceA: 'CURCUMIN', substanceB: 'GINGER', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Куркумин и имбирь синергично подавляют воспаление через ингибирование NF-kB и COX/LOX путей', mechanisms: ['Ингибирование NF-kB', 'Блокировка COX-2', 'Синергия антиоксидантов'], severity: 'MEDIUM', notes: 'Усиливает противовоспалительный эффект в 2-3 раза' },
  { interactionId: 'SYNERGY_AUTO_015', substanceA: 'L_THEANINE', substanceB: 'GABA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'L-теанин усиливает ГАМК-ергическую передачу, потенцируя расслабляющий эффект магния и GABA', mechanisms: ['Увеличение альфа-волн', 'Синергия ГАМК', 'Модуляция глутамата'], severity: 'MEDIUM', notes: 'Безопасная комбинация для релаксации без сонливости' },
  { interactionId: 'SYNERGY_AUTO_016', substanceA: 'ZINC', substanceB: 'VITAMIN_A', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Цинк необходим для синтеза ретинол-связывающего белка, транспортирующего витамин A', mechanisms: ['Активация RBP', 'Синергия зрения', 'Кофактор ретинол-дегидрогеназы'], severity: 'MEDIUM', notes: 'Цинк + витамин A особенно важны для ночного зрения' },
  { interactionId: 'SYNERGY_AUTO_017', substanceA: 'SILYMARIN', substanceB: 'ARTICHOKE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Расторопша и артишок синергично усиливают детоксикацию печени: фаза I + фаза II', mechanisms: ['Усиление фазы I детоксикации', 'Активация фазы II', 'Желчегонное действие', 'Антиоксидантная защита'], severity: 'MEDIUM', notes: 'Комбинация для восстановления печени после нагрузок' },
  { interactionId: 'SYNERGY_AUTO_018', substanceA: 'ZINC', substanceB: 'VITAMIN_C', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Цинк и витамин C синергично поддерживают иммунитет: стимулируют фагоцитоз и синтез коллагена', mechanisms: ['Иммуномодуляция', 'Стимуляция фагоцитоза', 'Коллагеногенез'], severity: 'MEDIUM', notes: 'Базовая комбинация для профилактики ОРВИ' },
  { interactionId: 'SYNERGY_AUTO_019', substanceA: 'TAURINE', substanceB: 'MAGNESIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Таурин и магний синергично защищают сердце: стабилизируют мембраны кардиомиоцитов и ритм', mechanisms: ['Кардиопротекция', 'Стабилизация мембран', 'Антиаритмическое действие'], severity: 'MEDIUM', notes: 'Полезна при гипертонии, аритмиях, сердечной недостаточности' },
  { interactionId: 'SYNERGY_AUTO_020', substanceA: 'OMEGA3', substanceB: 'VITAMIN_D', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Омега-3 улучшает всасывание витамина D и усиливает его связывание с рецепторами VDR', mechanisms: ['Улучшение мембранной текучести', 'Рецепторная синергия', 'Липидный транспорт'], severity: 'MEDIUM', notes: 'D3+K2 с омега-3 для максимального усвоения' },
  { interactionId: 'SYNERGY_AUTO_021', substanceA: 'GINKGO', substanceB: 'BACOPA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Гинкго билоба и бакопа монье синергично улучшают память и когнитивные функции', mechanisms: ['Усиление мозгового кровотока', 'Ацетилхолиновая модуляция', 'Нейропротекция'], severity: 'MEDIUM', notes: 'Ноотропная комбинация с накопительным эффектом' },
  { interactionId: 'SYNERGY_AUTO_022', substanceA: 'ASHWAGANDHA', substanceB: 'RHODIOLA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Ашваганда и родиола розовая синергично модулируют ось HPA: родиола стимулирует, ашваганда восстанавливает', mechanisms: ['Модуляция кортизола', 'Адаптация HPA', 'Синергия адаптогенов'], severity: 'MEDIUM', notes: 'Родиола утром для энергии, ашваганда вечером для восстановления' },
  { interactionId: 'SYNERGY_AUTO_023', substanceA: 'ECHINACEA', substanceB: 'ELDERBERRY', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Эхинацея и бузина синергично стимулируют иммунный ответ: активируют макрофаги и NK-клетки', mechanisms: ['Стимуляция фагоцитоза', 'Активация NK-клеток', 'Синтез цитокинов'], severity: 'MEDIUM', notes: 'Профилактический прием снижает риск ОРВИ на 30-40%' },
  { interactionId: 'SYNERGY_AUTO_024', substanceA: 'IRON', substanceB: 'COPPER', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Железо и медь синергично участвуют в кроветворении: медь необходима для транспорта железа', mechanisms: ['Церулоплазминовый транспорт', 'Синтез гема', 'Синергия гемопоэза'], severity: 'MEDIUM', notes: 'При анемии проверять также уровень меди и ферритина' },
  { interactionId: 'SYNERGY_AUTO_025', substanceA: 'ZINC', substanceB: 'COPPER', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'Цинк и медь конкурируют за всасывание: высокие дозы цинка (>30 мг) подавляют абсорбцию меди', mechanisms: ['Конкуренция за транспортеры MT1/2', 'Антагонизм металлов'], severity: 'MEDIUM', notes: 'При длительном приеме цинка добавлять 1-2 мг меди' },
  { interactionId: 'SYNERGY_AUTO_026', substanceA: 'CALCIUM', substanceB: 'MAGNESIUM', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'Кальций и магний конкурируют за общие транспортеры в тонком кишечнике', mechanisms: ['Конкуренция за каналы TRPV6/TRPM6', 'Антагонизм ионов'], severity: 'MEDIUM', notes: 'Принимать кальций и магний в разное время дня (4-6 ч интервал)' },
  { interactionId: 'SYNERGY_AUTO_027', substanceA: 'CALCIUM', substanceB: 'IRON', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'Кальций снижает всасывание железа на 50% при совместном приеме', mechanisms: ['Конкуренция за DMT1', 'Антагонизм двухвалентных катионов'], severity: 'MEDIUM', notes: 'Не принимать железо с молочными продуктами или кальцием' },
  { interactionId: 'SYNERGY_AUTO_028', substanceA: 'ST_JOHNS_WORT', substanceB: 'CYP450_INDUCER', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'Зверобой индуцирует CYP3A4, снижая эффективность многих лекарств', mechanisms: ['Индукция цитохрома P450', 'Ускорение метаболизма ксенобиотиков'], severity: 'LOW', notes: 'Избегать с гормональными препаратами и антидепрессантами' },
  { interactionId: 'SYNERGY_AUTO_029', substanceA: 'VITAMIN_E', substanceB: 'ANTICOAGULANT_WARNING', type: 'caution' as 'synergy' | 'conflict' | 'caution', effect: 'Высокие дозы витамина E (>400 МЕ) могут снижать свертываемость крови', mechanisms: ['Антивитамин K', 'Ингибирование агрегации тромбоцитов'], severity: 'LOW', notes: 'Осторожно при приеме антикоагулянтов' },
  { interactionId: 'SYNERGY_AUTO_030', substanceA: 'GINKGO', substanceB: 'GINSENG', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Гинкго + женьшень синергично улучшают память, концентрацию и мозговой кровоток', mechanisms: ['Вазодилатация', 'Ацетилхолиновая поддержка', 'Нейропротекция'], severity: 'MEDIUM', notes: 'Ноотропный эффект через 2-4 недели регулярного приема' },
  { interactionId: 'SYNERGY_AUTO_031', substanceA: '5HTP', substanceB: 'MAGNESIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: '5-HTP и магний синергично улучшают качество сна: 5-HTP - предшественник мелатонина, магний - ГАМК-агонист', mechanisms: ['Серотониновый путь', 'ГАМК-ергическая седация', 'Синергия сна'], severity: 'MEDIUM', notes: 'За 30-60 мин до сна; не сочетать с антидепрессантами' },
  { interactionId: 'SYNERGY_AUTO_032', substanceA: 'ALCAR', substanceB: 'ALPHA_LIPOIC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Ацетил-L-карнитин и альфа-липоевая кислота синергично защищают митохондрии и улучшают энергообмен', mechanisms: ['Митохондриальная защита', 'Антиоксидантная синергия', 'Энергетический метаболизм'], severity: 'MEDIUM', notes: 'Антивозрастная и нейропротективная комбинация' },
  { interactionId: 'SYNERGY_AUTO_033', substanceA: 'BERBERINE', substanceB: 'CINNAMON', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Берберин и корица синергично улучшают чувствительность к инсулину и метаболизм глюкозы', mechanisms: ['Активация AMPK', 'Улучшение утилизации глюкозы', 'Ингибирование альфа-глюкозидазы'], severity: 'MEDIUM', notes: 'Для контроля сахара крови и метаболического здоровья' },
  { interactionId: 'SYNERGY_AUTO_034', substanceA: 'COLLAGEN', substanceB: 'VITAMIN_C', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Коллаген и витамин C необходимы для синтеза коллагеновых волокон: C - кофактор гидроксилирования пролина', mechanisms: ['Гидроксилирование пролина', 'Синтез тропоколлагена', 'Формирование фибрилл'], severity: 'MEDIUM', notes: 'Витамин C обязателен для синтеза коллагена' },
  { interactionId: 'SYNERGY_AUTO_035', substanceA: 'MSM', substanceB: 'GLUCOSAMINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'МСМ и глюкозамин синергично уменьшают боль и воспаление в суставах', mechanisms: ['Синтез соединительной ткани', 'Противовоспалительное действие', 'Серный обмен'], severity: 'MEDIUM', notes: 'МСМ усиливает действие глюкозамина на 40-60%' },
  { interactionId: 'SYNERGY_AUTO_036', substanceA: 'LYCOPENE', substanceB: 'BETA_CAROTENE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Ликопин и бета-каротин синергично защищают простату и ССС от окислительного стресса', mechanisms: ['Каротиноидная синергия', 'Антиоксидантная защита', 'Простато-протекция'], severity: 'MEDIUM', notes: 'Ликопин лучше усваивается с жирами (оливковое масло)' },
  { interactionId: 'SYNERGY_AUTO_037', substanceA: 'SILYMARIN', substanceB: 'NAC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Силимарин и N-ацетилцистеин синергично защищают печень и повышают глутатион', mechanisms: ['Увеличение GSH', 'Антиоксидантная синергия', 'Гепатопротекция'], severity: 'MEDIUM', notes: 'Эффективны при токсических нагрузках на печень' },
  { interactionId: 'SYNERGY_AUTO_038', substanceA: 'CALCIUM_D_GLUCARATE', substanceB: 'I3C', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Кальций D-глюкарат и индол-3-карбинол синергично поддерживают эстрогеновый метаболизм', mechanisms: ['Бета-глюкуронидазная модуляция', 'CYP-регуляция', 'Детоксикация эстрогенов'], severity: 'MEDIUM', notes: 'Для профилактики эстроген-зависимых состояний' },
  { interactionId: 'SYNERGY_AUTO_039', substanceA: 'LECITHIN', substanceB: 'OMEGA3', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Лецитин и омега-3 синергично поддерживают когнитивные функции и мембранную структуру', mechanisms: ['Мембранная интеграция', 'Холинергическая поддержка', 'Липидный обмен'], severity: 'MEDIUM', notes: 'Фосфолипиды + омега-3 = строительный материал для мозга' },
  { interactionId: 'SYNERGY_AUTO_040', substanceA: 'ZINC', substanceB: 'SELENIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Цинк и селен синергично усиливают антиоксидантную защиту (СОД + глутатионпероксидаза)', mechanisms: ['Кофактор СОД', 'Кофактор GPX', 'Антиоксидантная синергия'], severity: 'MEDIUM', notes: 'Важны для тиреоидного и репродуктивного здоровья' },
  { interactionId: 'SYNERGY_AUTO_041', substanceA: 'EGCG', substanceB: 'VITAMIN_D', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Экстракт зеленого чая (EGCG) и витамин D синергично модулируют иммунный ответ', mechanisms: ['Иммуномодуляция', 'Антиоксидантная синергия', 'Эпигенетическая регуляция'], severity: 'MEDIUM', notes: 'EGCG усиливает рецепцию витамина D' },
  { interactionId: 'SYNERGY_AUTO_042', substanceA: 'GLYCINE', substanceB: 'MAGNESIUM', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Глицин и магний синергично улучшают качество сна через ГАМК-ергическую систему', mechanisms: ['ГАМК-модуляция', 'Синергия нейротрансмиттеров', 'Расслабление мышц'], severity: 'LOW', notes: 'Мягкая седативная комбинация без привыкания' },
  { interactionId: 'SYNERGY_AUTO_043', substanceA: 'MIN_ZINC_PICOLINATE', substanceB: 'MIN_MAGNESIUM_CHELATE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Пиколинат цинка и хелат магния - наиболее биодоступные формы для синергии минералов', mechanisms: ['Максимальная абсорбция', 'Минеральная синергия', 'Аминокислотный транспорт'], severity: 'HIGH', notes: 'Хелатные формы усваиваются на 40-60% лучше оксидов' },
  { interactionId: 'SYNERGY_AUTO_044', substanceA: 'NMN', substanceB: 'RESVERATROL', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'NMN и ресвератрол синергично активируют SIRT1 и повышают уровень NAD+, замедляя клеточное старение', mechanisms: ['Активация SIRT1', 'Повышение NAD+', 'Аутофагия', 'Митохондриальный биогенез'], severity: 'LOW', notes: 'Оптимально утром натощак; NMN 250-500 мг + ресвератрол 200-500 мг' },
  { interactionId: 'SYNERGY_AUTO_045', substanceA: 'COQ10', substanceB: 'PQQ', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'CoQ10 и PQQ синергично стимулируют митохондриальный биогенез и энергопродукцию', mechanisms: ['Митохондриальный биогенез', 'Электрон-транспортная цепь', 'Антиоксидантная защита митохондрий'], severity: 'LOW', notes: 'PQQ 10-20 мг + CoQ10 100-200 мг; принимать с жирами' },
  { interactionId: 'SYNERGY_AUTO_046', substanceA: 'ASTAXANTHIN', substanceB: 'LYCOPENE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Астаксантин и ликопин синергично защищают кожу от фотостарения и нейтрализуют АФК', mechanisms: ['Нейтрализация синглетного кислорода', 'Фотопротекция', 'Антиоксидантный каскад'], severity: 'LOW', notes: 'Астаксантин 4-12 мг + ликопин 10-30 мг; с жирами для усвоения' },
  { interactionId: 'SYNERGY_AUTO_047', substanceA: 'COLLAGEN', substanceB: 'HYALURONIC_ACID', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Коллаген и гиалуроновая кислота синергично улучшают гидратацию кожи и антивозрастной эффект', mechanisms: ['Синтез внеклеточного матрикса', 'Гидратация дермы', 'Стимуляция фибробластов'], severity: 'LOW', notes: 'Гидролизованный коллаген 10 г + гиалуроновая к-та 100-200 мг; эффект через 4-8 недель' },
  { interactionId: 'SYNERGY_AUTO_048', substanceA: 'SPERMIDINE', substanceB: 'RESVERATROL', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Спермидин и ресвератрол синергично индуцируют аутофагию и продлевают клеточную жизнь', mechanisms: ['Индукция аутофагии', 'Активация SIRT1', 'Эпигенетическая модуляция', 'Ингибирование mTOR'], severity: 'LOW', notes: 'Спермидин 5-10 мг + ресвератрол 200-500 мг; курсами 3-6 месяцев' },
  { interactionId: 'SYNERGY_AUTO_049', substanceA: 'GLUTATHIONE', substanceB: 'ALPHA_LIPOIC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Глутатион и альфа-липоевая кислота рециклируют друг друга, усиливая общий антиоксидантный потенциал', mechanisms: ['Рециклинг глутатиона', 'Антиоксидантный каскад', 'Хелатирование тяжелых металлов', 'Регенерация витаминов C и E'], severity: 'LOW', notes: 'АЛК 300-600 мг + глутатион 250-500 мг; натощак' },
  { interactionId: 'SYNERGY_AUTO_050', substanceA: 'NR', substanceB: 'PTEROSTILBENE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Никотинамидрибозид (NR) и птеростильбен синергично повышают NAD+ и активируют сиртуины', mechanisms: ['Повышение NAD+', 'Активация SIRT1/SIRT3', 'Митохондриальное дыхание', 'Метилирование'], severity: 'LOW', notes: 'NR 300 мг + птеростильбен 50-100 мг; утром с жирной пищей' },
  { interactionId: 'SYNERGY_AUTO_051', substanceA: 'VITEX', substanceB: 'VITAMIN_B6', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'ВИТЕКС (прутняк) и витамин B6 синергично модулируют пролактин и облегчают симптомы ПМС', mechanisms: ['Дофаминовая модуляция D2', 'Снижение пролактина', 'Синтез нейротрансмиттеров', 'Баланс прогестерона'], severity: 'LOW', notes: 'Витекс 400-600 мг (циклом) + B6 50-100 мг; эффект через 2-3 цикла' },
  { interactionId: 'SYNERGY_AUTO_052', substanceA: 'EVENING_PRIMROSE', substanceB: 'BORAGE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Масло примулы вечерней и масло бурачника синергично обеспечивают GLA для гормонального баланса', mechanisms: ['Источник GLA', 'Метаболизм простагландинов', 'Противовоспалительная модуляция'], severity: 'LOW', notes: 'Примула 1000-2000 мг + бурачник 500-1000 мг; 1-3 месяца' },
  { interactionId: 'SYNERGY_AUTO_053', substanceA: 'BLACK_COHOSH', substanceB: 'RED_CLOVER', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Цимицифуга (воронец) и красный клевер синергично облегчают симптомы менопаузы и приливы', mechanisms: ['Фитоэстрогенная активность', 'Серотониновая модуляция', 'Терморегуляция гипоталамуса', 'Баланс эстрадиола'], severity: 'LOW', notes: 'Воронец 80-160 мг + клевер 40-80 мг; принимать вечером' },
  { interactionId: 'SYNERGY_AUTO_054', substanceA: 'CRANBERRY', substanceB: 'D_MANNOSE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Клюква и D-манноза синергично предотвращают ИМП: манноза блокирует адгезию E.coli, проантоцианидины - бактерицидны', mechanisms: ['Блокация адгезии FimH', 'Антибактериальный барьер', 'Подкисление мочи', 'Синерическое подавление'], severity: 'LOW', notes: 'D-манноза 1000 мг + клюква 500-1000 мг; профилактика 1-2 капс/день' },
  { interactionId: 'SYNERGY_AUTO_055', substanceA: 'PROBIOTICS', substanceB: 'CRANBERRY', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Пробиотики (Lactobacillus) и клюква синергично поддерживают вагинальный микробиом', mechanisms: ['Поддержка лактофлоры', 'Антиадгезия патогенов', 'Снижение pH', 'Иммунная модуляция слизистой'], severity: 'LOW', notes: 'Пробиотики 10-30 млрд КОЕ + клюква 500 мг; вагинальный/пероральный приём' },
  { interactionId: 'SYNERGY_AUTO_056', substanceA: 'VITAMIN_B9_FOLIC', substanceB: 'VITAMIN_B12', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Фолат (B9), метилкобаламин (B12) и пиридоксин (B6) синергично необходимы для метилирования и здоровья беременности', mechanisms: ['Цикл метилирования', 'Снижение гомоцистеина', 'Синтез нейротрансмиттеров', 'Формирование нервной трубки плода'], severity: 'HIGH', notes: 'Фолат 400-800 мкг + B12 200-500 мкг + B6 25-50 мг; за 3 мес до зачатия' },
  { interactionId: 'SYNERGY_AUTO_057', substanceA: 'DAA', substanceB: 'ZINC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'D-аспарагиновая кислота и цинк синергично стимулируют эндогенную выработку тестостерона', mechanisms: ['Стимуляция LH', 'Кофактор 5-альфа-редуктазы', 'Ингибирование ароматазы', 'Синтез стероидов'], severity: 'LOW', notes: 'DAA 2000-3000 мг + цинк 15-30 мг; 4-6 недель, затем перерыв' },
  { interactionId: 'SYNERGY_AUTO_058', substanceA: 'SAW_PALMETTO', substanceB: 'BETA_SITOSTEROL', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Пальма сабаль (Serenoa), бета-ситостерин и тыква синергично блокируют DHT и поддерживают простату', mechanisms: ['Ингибирование 5-альфа-редуктазы', 'Антагонизм андрогенных рецепторов', 'Противовоспалительное действие', 'Улучшение уродинамики'], severity: 'LOW', notes: 'Сабаль 320 мг + ситостерин 60-130 мг + тыква 500 мг; 3-6 месяцев' },
  { interactionId: 'SYNERGY_AUTO_059', substanceA: 'L_CITRULLINE', substanceB: 'L_ARGININE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'L-цитруллин и L-аргинин синергично повышают оксид азота (NO) и улучшают кровоток и эректильную функцию', mechanisms: ['Цикл NO-синтазы', 'Вазодилатация', 'Повышение cGMP', 'Снижение ADMA'], severity: 'LOW', notes: 'Цитруллин 3000-6000 мг + аргинин 1000-2000 мг; натощак за 30-45 мин до тренировки' },
  { interactionId: 'SYNERGY_AUTO_060', substanceA: 'TRIBULUS', substanceB: 'MACA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Трибулус и мака перуанская синергично повышают либидо и общую витальность у мужчин', mechanisms: ['Стимуляция LH/FSH', 'Адаптогенная поддержка HPA', 'Повышение энергии', 'Нейромедиаторная модуляция'], severity: 'LOW', notes: 'Трибулус 500-1500 мг + мака 2000-3000 мг; курсами 8-12 недель' },
  { interactionId: 'SYNERGY_AUTO_061', substanceA: 'BORON', substanceB: 'ZINC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Бор, витамин D и цинк синергично повышают свободный тестостерон через SHBG и ароматазу', mechanisms: ['Снижение SHBG', 'Ингибирование ароматазы', 'Кофактор стероидогенеза', 'Рецепция витамина D'], severity: 'LOW', notes: 'Бор 3-10 мг + D3 2000-5000 МЕ + цинк 15-30 мг; 3 месяца' },
  { interactionId: 'SYNERGY_AUTO_062', substanceA: 'LIONS_MANE', substanceB: 'ALCAR', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Ежовик гребенчатый (Lion s Mane) и ацетил-L-карнитин синергично стимулируют NGF и нейропластичность', mechanisms: ['Стимуляция NGF', 'Митохондриальная энергия', 'Нейрогенез гиппокампа', 'Миелинизация'], severity: 'LOW', notes: 'Ежовик 500-1000 мг + ALCAR 500-1000 мг; утром до еды' },
  { interactionId: 'SYNERGY_AUTO_063', substanceA: 'GINKGO', substanceB: 'VINPOCETINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Гинкго билоба и винпоцетин синергично улучшают церебральный кровоток и когнитивные функции', mechanisms: ['Вазодилатация сосудов мозга', 'Ингибирование ФДЭ', 'Антиагрегация тромбоцитов', 'Повышение захвата глюкозы'], severity: 'LOW', notes: 'Гинкго 120-240 мг + винпоцетин 10-20 мг; 2-3 месяца' },
  { interactionId: 'SYNERGY_AUTO_064', substanceA: 'CITICOLINE', substanceB: 'ALPHA_GPC', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Цитиколин (CDP-холин) и альфа-GPC синергично повышают ацетилхолин и фосфолипиды мозга', mechanisms: ['Синтез ацетилхолина', 'Фосфолипидный синтез', 'Доставка холина через ГЭБ', 'Синаптическая пластичность'], severity: 'LOW', notes: 'CDP-холин 500-1000 мг + альфа-GPC 300-600 мг; раздельно утром и днем' },
  { interactionId: 'SYNERGY_AUTO_065', substanceA: 'RHODIOLA', substanceB: 'L_TYROSINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Родиола розовая и L-тирозин синергично повышают стрессоустойчивость и когнитивную фокусировку', mechanisms: ['Ингибирование КОМТ', 'Повышение дофамина/норадреналина', 'Модуляция HPA оси', 'Антиадаптогенный эффект'], severity: 'LOW', notes: 'Родиола 200-400 мг + тирозин 500-1000 мг; утром в стрессовые дни' },
  { interactionId: 'SYNERGY_AUTO_066', substanceA: 'NOOPEPT', substanceB: 'CITICOLINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Ноопепт и цитиколин синергично улучшают память, обучение и вербальную беглость', mechanisms: ['Модуляция AMPA/BDNF', 'Ацетилхолиновая поддержка', 'Нейропептидная регуляция', 'Усиление синаптической передачи'], severity: 'LOW', notes: 'Ноопепт 10-20 мг + CDP-холин 500-1000 мг; цикл 4-8 недель' },
  { interactionId: 'SYNERGY_AUTO_067', substanceA: 'MAGNESIUM_L_THREONATE', substanceB: 'L_THEANINE', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Магний L-треонат и L-теанин синергично улучшают качество сна и когнитивные функции через ГАМК', mechanisms: ['Повышение магния в мозге', 'ГАМК-модуляция', 'Снижение глутамата', 'Улучшение синаптической пластичности'], severity: 'LOW', notes: 'Магний-треонат 2000 мг + теанин 100-200 мг; за 30-60 мин до сна' },
  { interactionId: 'SYNERGY_AUTO_068', substanceA: 'PHOSPHATIDYLSERINE', substanceB: 'BACOPA', type: 'synergy' as 'synergy' | 'conflict' | 'caution', effect: 'Фосфатидилсерин и бакопа монье синергично снижают кортизол и улучшают память у пожилых', mechanisms: ['Снижение кортизола', 'Ацетилхолиновая модуляция', 'Синаптическая защита', 'Улучшение межполушарной связи'], severity: 'LOW', notes: 'Фосфатидилсерин 200-400 мг + бакопа 300-600 мг; утром и днем' },
] as SupportInteraction[]);

export const INTERACTION_MAP: Record<string, SupportInteraction> = {};
ALL_INTERACTIONS.forEach(i => { INTERACTION_MAP[i.interactionId] = i; });

// ═══════════════════════════════════════════════════════════════════════════
// RISKS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_RISKS: SupportRisk[] = [
  { riskId: 'LIVER_FATTY', name: 'Fatty Liver', system: 'metabolic', organs: ['LIVER'], symptoms: ['FATIGUE', 'RIGHT_SIDE_HEAVINESS', 'BLOATING'], levels: 'LOW;MEDIUM;HIGH', description: 'Жировой гепатоз' },
  { riskId: 'LIVER_NASH', name: 'NASH', system: 'metabolic', organs: ['LIVER'], symptoms: ['FATIGUE', 'RIGHT_SIDE_PAIN', 'INSULIN_RESISTANCE'], levels: 'LOW;MEDIUM;HIGH', description: 'Немалкогольный стеатогепатит' },
  { riskId: 'LIVER_CIRRHOSIS', name: 'Cirrhosis', system: 'structural', organs: ['LIVER'], symptoms: ['ASCITES', 'SPIDER_VEINS', 'WEIGHT_LOSS'], levels: 'LOW;MEDIUM;HIGH', description: 'Цирроз печени' },
  { riskId: 'LIVER_CHOLESTASIS', name: 'Cholestasis', system: 'bile', organs: ['LIVER', 'BILE_DUCTS'], symptoms: ['ITCHING', 'JAUNDICE', 'DARK_URINE'], levels: 'LOW;MEDIUM;HIGH', description: 'Холестаз' },
  { riskId: 'LIVER_ENZYMES_HIGH', name: 'Elevated Liver Enzymes', system: 'lab', organs: ['LIVER'], symptoms: ['FATIGUE', 'NAUSEA', 'RIGHT_SIDE_DISCOMFORT'], levels: 'LOW;MEDIUM;HIGH', description: 'Повышенные АЛТ/АСТ' },
  { riskId: 'LIVER_DRUG_TOXICITY', name: 'Drug-Induced Hepatotoxicity', system: 'toxic', organs: ['LIVER'], symptoms: ['NAUSEA', 'VOMITING', 'JAUNDICE'], levels: 'LOW;MEDIUM;HIGH', description: 'Гепатотоксичность' },
  { riskId: 'LIVER_ALCOHOLIC', name: 'Alcoholic Liver Disease', system: 'toxic', organs: ['LIVER'], symptoms: ['FATIGUE', 'RIGHT_SIDE_PAIN', 'HANGOVER'], levels: 'LOW;MEDIUM;HIGH', description: 'Алкогольное поражение печени' },
  { riskId: 'LIVER_VIRAL', name: 'Viral Hepatitis', system: 'infectious', organs: ['LIVER'], symptoms: ['FATIGUE', 'LOW_FEVER', 'JOINT_PAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Вирусный гепатит' },
  { riskId: 'LIVER_AUTOIMMUNE', name: 'Autoimmune Hepatitis', system: 'autoimmune', organs: ['LIVER'], symptoms: ['FATIGUE', 'RASH', 'JOINT_PAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Аутоиммунный гепатит' },
  { riskId: 'LIVER_DETOX_OVERLOAD', name: 'Detox Overload', system: 'functional', organs: ['LIVER'], symptoms: ['FATIGUE', 'HEADACHE', 'CHEMICAL_SENSITIVITY'], levels: 'LOW;MEDIUM;HIGH', description: 'Перегрузка детокс-систем' },
  { riskId: 'LIVER_BILE_SLUDGE', name: 'Bile Sludge', system: 'bile', organs: ['LIVER', 'GALLBLADDER'], symptoms: ['NAUSEA', 'BITTER_TASTE', 'BLOATING'], levels: 'LOW;MEDIUM;HIGH', description: 'Застой желчи (сладж)' },
  { riskId: 'LIVER_GALLSTONES', name: 'Gallstones', system: 'bile', organs: ['GALLBLADDER'], symptoms: ['PAIN_RIGHT', 'NAUSEA', 'VOMITING'], levels: 'LOW;MEDIUM;HIGH', description: 'Камни в желчном' },
  { riskId: 'LIVER_FIBROSIS', name: 'Fibrosis', system: 'structural', organs: ['LIVER'], symptoms: ['FATIGUE', 'RIGHT_SIDE_PAIN', 'WEAKNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Фиброз печени' },
  { riskId: 'KIDNEY_CKD', name: 'Chronic Kidney Disease', system: 'structural', organs: ['KIDNEYS'], symptoms: ['EDEMA', 'FATIGUE', 'FOAMY_URINE'], levels: 'LOW;MEDIUM;HIGH', description: 'ХБП' },
  { riskId: 'KIDNEY_STONES', name: 'Nephrolithiasis', system: 'structural', organs: ['KIDNEYS'], symptoms: ['FLANK_PAIN', 'BLOOD_URINE', 'NAUSEA'], levels: 'LOW;MEDIUM;HIGH', description: 'Камни в почках' },
  { riskId: 'KIDNEY_INFECTION', name: 'Pyelonephritis', system: 'infectious', organs: ['KIDNEYS'], symptoms: ['FEVER', 'BACK_PAIN', 'CHILLS'], levels: 'LOW;MEDIUM;HIGH', description: 'Пиелонефрит' },
  { riskId: 'KIDNEY_PROTEINURIA', name: 'Proteinuria', system: 'lab', organs: ['KIDNEYS'], symptoms: ['FOAMY_URINE', 'EDEMA', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Протеинурия' },
  { riskId: 'KIDNEY_HYPERTENSION', name: 'Renal Hypertension', system: 'vascular', organs: ['KIDNEYS'], symptoms: ['HIGH_BP', 'HEADACHE', 'NOCTURIA'], levels: 'LOW;MEDIUM;HIGH', description: 'Почечная гипертензия' },
  { riskId: 'KIDNEY_DRUG_TOXICITY', name: 'Drug-Induced Nephrotoxicity', system: 'toxic', organs: ['KIDNEYS'], symptoms: ['LOW_URINE', 'EDEMA', 'NAUSEA'], levels: 'LOW;MEDIUM;HIGH', description: 'Нефротоксичность' },
  { riskId: 'KIDNEY_DEHYDRATION', name: 'Dehydration', system: 'functional', organs: ['KIDNEYS'], symptoms: ['THIRST', 'DARK_URINE', 'CRAMPS'], levels: 'LOW;MEDIUM;HIGH', description: 'Обезвоживание' },
  { riskId: 'KIDNEY_UTI', name: 'UTI', system: 'infectious', organs: ['BLADDER'], symptoms: ['PAIN_URINATION', 'FREQUENCY', 'BURNING'], levels: 'LOW;MEDIUM;HIGH', description: 'Инфекция мочевых путей' },
  { riskId: 'KIDNEY_GFR_LOW', name: 'Low GFR', system: 'lab', organs: ['KIDNEYS'], symptoms: ['FATIGUE', 'EDEMA', 'LOW_URINE'], levels: 'LOW;MEDIUM;HIGH', description: 'Снижение СКФ' },
  { riskId: 'KIDNEY_ELECTROLYTE_IMBALANCE', name: 'Electrolyte Imbalance', system: 'lab', organs: ['KIDNEYS'], symptoms: ['CRAMPS', 'WEAKNESS', 'ARRHYTHMIA'], levels: 'LOW;MEDIUM;HIGH', description: 'Дисбаланс электролитов' },
  { riskId: 'HEART_HYPERTENSION', name: 'Hypertension', system: 'vascular', organs: ['HEART', 'VESSELS'], symptoms: ['HIGH_BP', 'HEADACHE', 'NOSEBLEEDS'], levels: 'LOW;MEDIUM;HIGH', description: 'Гипертония' },
  { riskId: 'HEART_ATHEROSCLEROSIS', name: 'Atherosclerosis', system: 'vascular', organs: ['VESSELS'], symptoms: ['CHEST_TIGHTNESS', 'COLD_EXTREMITIES', 'LOW_ENDURANCE'], levels: 'LOW;MEDIUM;HIGH', description: 'Атеросклероз' },
  { riskId: 'HEART_ARRHYTHMIA', name: 'Arrhythmia', system: 'electrical', organs: ['HEART'], symptoms: ['PALPITATIONS', 'DIZZINESS', 'ANXIETY'], levels: 'LOW;MEDIUM;HIGH', description: 'Аритмия' },
  { riskId: 'HEART_FAILURE', name: 'Heart Failure', system: 'pump', organs: ['HEART'], symptoms: ['EDEMA', 'SHORTNESS_BREATH', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Сердечная недостаточность' },
  { riskId: 'HEART_MI_RISK', name: 'MI Risk', system: 'ischemic', organs: ['HEART'], symptoms: ['CHEST_PAIN', 'LEFT_ARM_PAIN', 'SWEATING'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск инфаркта' },
  { riskId: 'HEART_VALVE', name: 'Valve Disorders', system: 'structural', organs: ['HEART'], symptoms: ['MURMUR', 'DIZZINESS', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Пороки клапанов' },
  { riskId: 'HEART_TACHYCARDIA', name: 'Tachycardia', system: 'electrical', organs: ['HEART'], symptoms: ['PALPITATIONS', 'ANXIETY', 'CHEST_TIGHTNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Тахикардия' },
  { riskId: 'HEART_BRADYCARDIA', name: 'Bradycardia', system: 'electrical', organs: ['HEART'], symptoms: ['DIZZINESS', 'FAINTING', 'WEAKNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Брадикардия' },
  { riskId: 'HEART_PERICARDITIS', name: 'Pericarditis', system: 'inflammatory', organs: ['HEART'], symptoms: ['CHEST_PAIN', 'FEVER', 'WEAKNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Перикардит' },
  { riskId: 'HEART_CARDIOMYOPATHY', name: 'Cardiomyopathy', system: 'structural', organs: ['HEART'], symptoms: ['FATIGUE', 'SWELLING', 'SHORTNESS_BREATH'], levels: 'LOW;MEDIUM;HIGH', description: 'Кардиомиопатия' },
  { riskId: 'LUNGS_ASTHMA', name: 'Asthma', system: 'airway', organs: ['LUNGS'], symptoms: ['WHEEZING', 'COUGH', 'CHEST_TIGHTNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Астма' },
  { riskId: 'LUNGS_COPD', name: 'COPD', system: 'airway', organs: ['LUNGS'], symptoms: ['COUGH', 'SHORTNESS_BREATH', 'WHEEZING'], levels: 'LOW;MEDIUM;HIGH', description: 'ХОБЛ' },
  { riskId: 'LUNGS_FIBROSIS', name: 'Fibrosis', system: 'structural', organs: ['LUNGS'], symptoms: ['SHORTNESS_BREATH', 'DRY_COUGH', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Фиброз лёгких' },
  { riskId: 'LUNGS_PNEUMONIA', name: 'Pneumonia', system: 'infectious', organs: ['LUNGS'], symptoms: ['FEVER', 'COUGH', 'CHEST_PAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Пневмония' },
  { riskId: 'LUNGS_BRONCHITIS', name: 'Bronchitis', system: 'inflammatory', organs: ['LUNGS'], symptoms: ['COUGH', 'MUCUS', 'CHEST_TIGHTNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Бронхит' },
  { riskId: 'LUNGS_EMPHYSEMA', name: 'Emphysema', system: 'structural', organs: ['LUNGS'], symptoms: ['SHORTNESS_BREATH', 'LOW_ENDURANCE', 'COUGH'], levels: 'LOW;MEDIUM;HIGH', description: 'Эмфизема' },
  { riskId: 'LUNGS_PULMONARY_HYPERTENSION', name: 'Pulmonary Hypertension', system: 'vascular', organs: ['LUNGS'], symptoms: ['SHORTNESS_BREATH', 'CHEST_PAIN', 'DIZZINESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Лёгочная гипертензия' },
  { riskId: 'LUNGS_ALLERGY', name: 'Allergic Bronchitis', system: 'immune', organs: ['LUNGS'], symptoms: ['COUGH', 'WHEEZING', 'ITCHY_EYES'], levels: 'LOW;MEDIUM;HIGH', description: 'Аллергический бронхит' },
  { riskId: 'LUNGS_SLEEP_APNEA', name: 'Sleep Apnea', system: 'sleep', organs: ['LUNGS'], symptoms: ['SNORING', 'DAY_SLEEPINESS', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Апноэ сна' },
  { riskId: 'GI_GASTRITIS', name: 'Gastritis', system: 'inflammatory', organs: ['STOMACH'], symptoms: ['NAUSEA', 'BLOATING', 'PAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Гастрит' },
  { riskId: 'GI_ULCER', name: 'Ulcer', system: 'structural', organs: ['STOMACH'], symptoms: ['PAIN', 'BURNING', 'NAUSEA'], levels: 'LOW;MEDIUM;HIGH', description: 'Язва' },
  { riskId: 'GI_IBS', name: 'IBS', system: 'functional', organs: ['GI'], symptoms: ['BLOATING', 'CRAMPS', 'DIARRHEA'], levels: 'LOW;MEDIUM;HIGH', description: 'СРК' },
  { riskId: 'GI_IBD', name: 'IBD', system: 'inflammatory', organs: ['GI'], symptoms: ['DIARRHEA', 'BLOOD_STOOL', 'FEVER'], levels: 'LOW;MEDIUM;HIGH', description: 'ВЗК' },
  { riskId: 'GI_REFLUX', name: 'GERD', system: 'functional', organs: ['ESOPHAGUS'], symptoms: ['HEARTBURN', 'COUGH', 'BITTER_TASTE'], levels: 'LOW;MEDIUM;HIGH', description: 'Рефлюкс' },
  { riskId: 'GI_DYSBIOSIS', name: 'Dysbiosis', system: 'microbiome', organs: ['GI'], symptoms: ['BLOATING', 'GAS', 'CONSTIPATION'], levels: 'LOW;MEDIUM;HIGH', description: 'Дисбиоз' },
  { riskId: 'GI_PANCREATITIS', name: 'Pancreatitis', system: 'inflammatory', organs: ['PANCREAS'], symptoms: ['PAIN_LEFT', 'NAUSEA', 'VOMITING'], levels: 'LOW;MEDIUM;HIGH', description: 'Панкреатит' },
  { riskId: 'GI_GALLBLADDER_DYSKINESIA', name: 'Dyskinesia', system: 'bile', organs: ['GALLBLADDER'], symptoms: ['PAIN_RIGHT', 'BITTER_TASTE', 'BLOATING'], levels: 'LOW;MEDIUM;HIGH', description: 'Дискинезия желчевыводящих путей' },
  { riskId: 'GI_CELIAC', name: 'Celiac Disease', system: 'autoimmune', organs: ['GI'], symptoms: ['DIARRHEA', 'BLOATING', 'WEIGHT_LOSS'], levels: 'LOW;MEDIUM;HIGH', description: 'Целиакия' },
  { riskId: 'GI_LACTOSE_INTOL', name: 'Lactose Intolerance', system: 'functional', organs: ['GI'], symptoms: ['GAS', 'BLOATING', 'DIARRHEA'], levels: 'LOW;MEDIUM;HIGH', description: 'Непереносимость лактозы' },
  { riskId: 'HORMONE_HYPO', name: 'Hypothyroidism', system: 'thyroid', organs: ['THYROID'], symptoms: ['FATIGUE', 'COLD', 'WEIGHT_GAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Гипотиреоз' },
  { riskId: 'HORMONE_HYPER', name: 'Hyperthyroidism', system: 'thyroid', organs: ['THYROID'], symptoms: ['ANXIETY', 'HEAT', 'WEIGHT_LOSS'], levels: 'LOW;MEDIUM;HIGH', description: 'Гипертиреоз' },
  { riskId: 'HORMONE_LOW_T', name: 'Low Testosterone', system: 'men', organs: ['TESTES'], symptoms: ['LOW_LIBIDO', 'LOW_ENERGY', 'DEPRESSED'], levels: 'LOW;MEDIUM;HIGH', description: 'Низкий тестостерон' },
  { riskId: 'HORMONE_HIGH_T', name: 'High Testosterone', system: 'men', organs: ['TESTES'], symptoms: ['ACNE', 'AGGRESSION', 'HAIR_LOSS'], levels: 'LOW;MEDIUM;HIGH', description: 'Высокий тестостерон' },
  { riskId: 'HORMONE_LOW_E2', name: 'Low Estrogen', system: 'women', organs: ['OVARIES'], symptoms: ['DRYNESS', 'HOT_FLASHES', 'LOW_LIBIDO'], levels: 'LOW;MEDIUM;HIGH', description: 'Низкий эстроген' },
  { riskId: 'HORMONE_HIGH_E2', name: 'High Estrogen', system: 'women', organs: ['OVARIES'], symptoms: ['BLOATING', 'MOOD_SWINGS', 'BREAST_TENDERNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Высокий эстроген' },
  { riskId: 'HORMONE_PMS', name: 'PMS', system: 'women', organs: ['OVARIES'], symptoms: ['CRAMPS', 'MOOD_SWINGS', 'BLOATING'], levels: 'LOW;MEDIUM;HIGH', description: 'ПМС' },
  { riskId: 'HORMONE_PCOS', name: 'PCOS', system: 'women', organs: ['OVARIES'], symptoms: ['ACNE', 'IRREGULAR_PERIODS', 'WEIGHT_GAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'СПКЯ' },
  { riskId: 'HORMONE_HIGH_CORTISOL', name: 'High Cortisol', system: 'stress', organs: ['ADRENALS'], symptoms: ['ANXIETY', 'INSOMNIA', 'BELLY_FAT'], levels: 'LOW;MEDIUM;HIGH', description: 'Высокий кортизол' },
  { riskId: 'HORMONE_LOW_CORTISOL', name: 'Low Cortisol', system: 'stress', organs: ['ADRENALS'], symptoms: ['FATIGUE', 'LOW_BP', 'WEAKNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Низкий кортизол' },
  { riskId: 'HORMONE_INSULIN_RESISTANCE', name: 'Insulin Resistance', system: 'metabolic', organs: ['PANCREAS'], symptoms: ['FATIGUE', 'CRAVINGS', 'WEIGHT_GAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Инсулинорезистентность' },
  { riskId: 'HORMONE_DIABETES2', name: 'Type 2 Diabetes', system: 'metabolic', organs: ['PANCREAS'], symptoms: ['THIRST', 'FREQUENT_URINATION', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Диабет 2 типа' },
  { riskId: 'IMMUNE_LOW', name: 'Low Immunity', system: 'immune', organs: ['IMMUNE_SYSTEM'], symptoms: ['FREQUENT_ILLNESS', 'FATIGUE', 'SORE_THROAT'], levels: 'LOW;MEDIUM;HIGH', description: 'Сниженный иммунитет' },
  { riskId: 'IMMUNE_AUTOIMMUNE', name: 'Autoimmune Risk', system: 'autoimmune', organs: ['IMMUNE_SYSTEM'], symptoms: ['RASH', 'JOINT_PAIN', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Аутоиммунные риски' },
  { riskId: 'IMMUNE_ALLERGY', name: 'Allergy', system: 'immune', organs: ['IMMUNE_SYSTEM'], symptoms: ['ITCHING', 'SNEEZE', 'RED_EYES'], levels: 'LOW;MEDIUM;HIGH', description: 'Аллергия' },
  { riskId: 'IMMUNE_CHRONIC_INFLAMMATION', name: 'Chronic Inflammation', system: 'inflammatory', organs: ['IMMUNE_SYSTEM'], symptoms: ['FATIGUE', 'PAIN', 'BRAIN_FOG'], levels: 'LOW;MEDIUM;HIGH', description: 'Хроническое воспаление' },
  { riskId: 'IMMUNE_HISTAMINE', name: 'Histamine Intolerance', system: 'immune', organs: ['IMMUNE_SYSTEM'], symptoms: ['FLUSHING', 'HEADACHE', 'ITCHING'], levels: 'LOW;MEDIUM;HIGH', description: 'Непереносимость гистамина' },
  { riskId: 'IMMUNE_FOOD_INTOL', name: 'Food Intolerance', system: 'immune', organs: ['GI'], symptoms: ['BLOATING', 'RASH', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Пищевая непереносимость' },
  { riskId: 'IMMUNE_COLD_FREQUENT', name: 'Frequent Colds', system: 'immune', organs: ['IMMUNE_SYSTEM'], symptoms: ['SORE_THROAT', 'COUGH', 'LOW_ENERGY'], levels: 'LOW;MEDIUM;HIGH', description: 'Частые простуды' },
  { riskId: 'BRAIN_ANXIETY', name: 'Anxiety', system: 'mental', organs: ['BRAIN'], symptoms: ['RESTLESS', 'PALPITATIONS', 'INSOMNIA'], levels: 'LOW;MEDIUM;HIGH', description: 'Тревожность' },
  { riskId: 'BRAIN_DEPRESSION', name: 'Depression', system: 'mental', organs: ['BRAIN'], symptoms: ['LOW_MOOD', 'FATIGUE', 'ANHEDONIA'], levels: 'LOW;MEDIUM;HIGH', description: 'Депрессия' },
  { riskId: 'BRAIN_BRAIN_FOG', name: 'Brain Fog', system: 'cognitive', organs: ['BRAIN'], symptoms: ['CONFUSION', 'LOW_FOCUS', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Мозговой туман' },
  { riskId: 'BRAIN_MIGRAINE', name: 'Migraine', system: 'neurological', organs: ['BRAIN'], symptoms: ['HEADACHE', 'NAUSEA', 'LIGHT_SENSITIVITY'], levels: 'LOW;MEDIUM;HIGH', description: 'Мигрень' },
  { riskId: 'BRAIN_SLEEP_DISORDER', name: 'Sleep Disorder', system: 'sleep', organs: ['BRAIN'], symptoms: ['INSOMNIA', 'DAY_SLEEPINESS', 'IRRITABILITY'], levels: 'LOW;MEDIUM;HIGH', description: 'Нарушения сна' },
  { riskId: 'BRAIN_ADHD', name: 'ADHD', system: 'cognitive', organs: ['BRAIN'], symptoms: ['LOW_FOCUS', 'RESTLESS', 'IMPULSIVITY'], levels: 'LOW;MEDIUM;HIGH', description: 'СДВГ' },
  { riskId: 'BRAIN_BURNOUT', name: 'Burnout', system: 'stress', organs: ['BRAIN'], symptoms: ['FATIGUE', 'APATHY', 'LOW_MOTIVATION'], levels: 'LOW;MEDIUM;HIGH', description: 'Выгорание' },
  { riskId: 'BRAIN_NEUROINFLAMMATION', name: 'Neuroinflammation', system: 'inflammatory', organs: ['BRAIN'], symptoms: ['HEADACHE', 'BRAIN_FOG', 'LOW_FOCUS'], levels: 'LOW;MEDIUM;HIGH', description: 'Нейровоспаление' },
  { riskId: 'BRAIN_STROKE_RISK', name: 'Stroke Risk', system: 'vascular', organs: ['BRAIN'], symptoms: ['NUMBNESS', 'SPEECH_ISSUES', 'DIZZINESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск инсульта' },
  { riskId: 'BRAIN_SEIZURE_RISK', name: 'Seizure Risk', system: 'neurological', organs: ['BRAIN'], symptoms: ['TWITCHING', 'CONFUSION', 'LOSS_OF_CONSCIOUSNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск судорог' },
  { riskId: 'BRAIN_OXYGEN_LOW', name: 'Low Brain Oxygen', system: 'vascular', organs: ['BRAIN'], symptoms: ['DIZZINESS', 'LOW_FOCUS', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Гипоксия мозга' },
  { riskId: 'BRAIN_MEMORY_DECLINE', name: 'Memory Decline', system: 'cognitive', organs: ['BRAIN'], symptoms: ['FORGETFULNESS', 'LOW_FOCUS', 'CONFUSION'], levels: 'LOW;MEDIUM;HIGH', description: 'Снижение памяти' },
  { riskId: 'BLOOD_ANEMIA', name: 'Anemia', system: 'blood', organs: ['BLOOD'], symptoms: ['FATIGUE', 'PALE_SKIN', 'DIZZINESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Анемия' },
  { riskId: 'BLOOD_IRON_DEFICIENCY', name: 'Iron Deficiency', system: 'blood', organs: ['BLOOD'], symptoms: ['FATIGUE', 'HAIR_LOSS', 'PALE_SKIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Дефицит железа' },
  { riskId: 'BLOOD_B12_DEFICIENCY', name: 'B12 Deficiency', system: 'blood', organs: ['BLOOD'], symptoms: ['NUMBNESS', 'FATIGUE', 'MEMORY_ISSUES'], levels: 'LOW;MEDIUM;HIGH', description: 'Дефицит B12' },
  { riskId: 'BLOOD_FOLATE_DEFICIENCY', name: 'Folate Deficiency', system: 'blood', organs: ['BLOOD'], symptoms: ['FATIGUE', 'IRRITABILITY', 'PALE_SKIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Дефицит фолатов' },
  { riskId: 'BLOOD_HIGH_TG', name: 'High Triglycerides', system: 'lipids', organs: ['BLOOD'], symptoms: ['HIGH_TG', 'FATIGUE', 'WEIGHT_GAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Высокие триглицериды' },
  { riskId: 'BLOOD_HIGH_LDL', name: 'High LDL', system: 'lipids', organs: ['BLOOD'], symptoms: ['HIGH_LDL', 'CHEST_TIGHTNESS', 'LOW_ENDURANCE'], levels: 'LOW;MEDIUM;HIGH', description: 'Высокий ЛПНП' },
  { riskId: 'BLOOD_LOW_HDL', name: 'Low HDL', system: 'lipids', organs: ['BLOOD'], symptoms: ['LOW_HDL', 'LOW_ENDURANCE', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Низкий ЛПВП' },
  { riskId: 'BLOOD_THICK', name: 'Blood Thickening', system: 'viscosity', organs: ['BLOOD'], symptoms: ['HEADACHE', 'RED_FACE', 'LOW_ENDURANCE'], levels: 'LOW;MEDIUM;HIGH', description: 'Густая кровь' },
  { riskId: 'BLOOD_CLOTS', name: 'Clotting Risk', system: 'vascular', organs: ['BLOOD'], symptoms: ['SWELLING', 'PAIN', 'REDNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск тромбов' },
  { riskId: 'BLOOD_LOW_RBC', name: 'Low RBC', system: 'blood', organs: ['BLOOD'], symptoms: ['FATIGUE', 'WEAKNESS', 'PALE_SKIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Низкие эритроциты' },
  { riskId: 'BLOOD_LOW_PLATELETS', name: 'Low Platelets', system: 'blood', organs: ['BLOOD'], symptoms: ['BRUISING', 'BLEEDING', 'WEAKNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Тромбоцитопения' },
  { riskId: 'BLOOD_HIGH_PLATELETS', name: 'High Platelets', system: 'blood', organs: ['BLOOD'], symptoms: ['HEADACHE', 'CLOTS', 'REDNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Тромбоцитоз' },
  { riskId: 'JOINT_ARTHRITIS', name: 'Arthritis', system: 'inflammatory', organs: ['JOINTS'], symptoms: ['PAIN', 'STIFFNESS', 'SWELLING'], levels: 'LOW;MEDIUM;HIGH', description: 'Артрит' },
  { riskId: 'JOINT_ARTHROSIS', name: 'Arthrosis', system: 'degenerative', organs: ['JOINTS'], symptoms: ['PAIN', 'CRUNCH', 'LIMITED_MOTION'], levels: 'LOW;MEDIUM;HIGH', description: 'Артроз' },
  { riskId: 'JOINT_GOUT', name: 'Gout', system: 'metabolic', organs: ['JOINTS'], symptoms: ['PAIN', 'REDNESS', 'SWELLING'], levels: 'LOW;MEDIUM;HIGH', description: 'Подагра' },
  { riskId: 'JOINT_TENDON', name: 'Tendonitis', system: 'inflammatory', organs: ['TENDONS'], symptoms: ['PAIN', 'SWELLING', 'LIMITED_MOTION'], levels: 'LOW;MEDIUM;HIGH', description: 'Тендинит' },
  { riskId: 'JOINT_BURSITIS', name: 'Bursitis', system: 'inflammatory', organs: ['JOINTS'], symptoms: ['PAIN', 'SWELLING', 'HEAT'], levels: 'LOW;MEDIUM;HIGH', description: 'Бурсит' },
  { riskId: 'JOINT_CARTILAGE_LOSS', name: 'Cartilage Loss', system: 'degenerative', organs: ['JOINTS'], symptoms: ['PAIN', 'CRUNCH', 'LIMITED_MOTION'], levels: 'LOW;MEDIUM;HIGH', description: 'Потеря хряща' },
  { riskId: 'JOINT_LIGAMENT_WEAK', name: 'Ligament Weakness', system: 'structural', organs: ['LIGAMENTS'], symptoms: ['INSTABILITY', 'PAIN', 'CRACKING'], levels: 'LOW;MEDIUM;HIGH', description: 'Слабость связок' },
  { riskId: 'JOINT_AUTOIMMUNE', name: 'Autoimmune Joint Risk', system: 'autoimmune', organs: ['JOINTS'], symptoms: ['PAIN', 'STIFFNESS', 'MORNING_PAIN'], levels: 'LOW;MEDIUM;HIGH', description: 'Аутоиммунные поражения суставов' },
  { riskId: 'SKIN_ACNE', name: 'Acne', system: 'skin', organs: ['SKIN'], symptoms: ['ACNE', 'OILINESS', 'INFLAMMATION'], levels: 'LOW;MEDIUM;HIGH', description: 'Акне' },
  { riskId: 'SKIN_ECZEMA', name: 'Eczema', system: 'skin', organs: ['SKIN'], symptoms: ['ITCHING', 'REDNESS', 'DRYNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Экзема' },
  { riskId: 'SKIN_PSORIASIS', name: 'Psoriasis', system: 'autoimmune', organs: ['SKIN'], symptoms: ['PLAQUES', 'ITCHING', 'REDNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Псориаз' },
  { riskId: 'SKIN_DERMATITIS', name: 'Dermatitis', system: 'skin', organs: ['SKIN'], symptoms: ['REDNESS', 'ITCHING', 'BURNING'], levels: 'LOW;MEDIUM;HIGH', description: 'Дерматит' },
  { riskId: 'SKIN_DRYNESS', name: 'Dry Skin', system: 'skin', organs: ['SKIN'], symptoms: ['DRYNESS', 'FLAKING', 'ITCHING'], levels: 'LOW;MEDIUM;HIGH', description: 'Сухость кожи' },
  { riskId: 'SKIN_OILY', name: 'Oily Skin', system: 'skin', organs: ['SKIN'], symptoms: ['OILINESS', 'ACNE', 'SHINE'], levels: 'LOW;MEDIUM;HIGH', description: 'Жирная кожа' },
  { riskId: 'SKIN_ROSACEA', name: 'Rosacea', system: 'vascular', organs: ['SKIN'], symptoms: ['REDNESS', 'FLUSHING', 'BURNING'], levels: 'LOW;MEDIUM;HIGH', description: 'Розацеа' },
  { riskId: 'SKIN_HAIR_LOSS', name: 'Hair Loss', system: 'skin', organs: ['SCALP'], symptoms: ['HAIR_LOSS', 'ITCHING', 'THINNING'], levels: 'LOW;MEDIUM;HIGH', description: 'Выпадение волос' },
  { riskId: 'VISION_MYOPIA', name: 'Myopia', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'EYE_STRAIN', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Близорукость' },
  { riskId: 'VISION_HYPEROPIA', name: 'Hyperopia', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'FATIGUE', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Дальнозоркость' },
  { riskId: 'VISION_ASTIGMATISM', name: 'Astigmatism', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'DOUBLE_VISION', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Астигматизм' },
  { riskId: 'VISION_DRY_EYE', name: 'Dry Eye', system: 'vision', organs: ['EYES'], symptoms: ['DRYNESS', 'BURNING', 'REDNESS'], levels: 'LOW;MEDIUM;HIGH', description: 'Сухой глаз' },
  { riskId: 'VISION_AGE', name: 'Age Decline', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'LOW_NIGHT_VISION', 'FATIGUE'], levels: 'LOW;MEDIUM;HIGH', description: 'Возрастные изменения' },
  { riskId: 'VISION_GLAUCOMA_RISK', name: 'Glaucoma Risk', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'HALOS', 'HEADACHE'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск глаукомы' },
  { riskId: 'VISION_CATARACT_RISK', name: 'Cataract Risk', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY', 'GLARE', 'LOW_CONTRAST'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск катаракты' },
  { riskId: 'VISION_MACULA_RISK', name: 'Macular Degeneration Risk', system: 'vision', organs: ['EYES'], symptoms: ['BLURRY_CENTER', 'LOW_CONTRAST', 'DISTORTION'], levels: 'LOW;MEDIUM;HIGH', description: 'Риск макулодистрофии' },
];

export const RISK_MAP: Record<string, SupportRisk> = {};
ALL_RISKS.forEach(r => { RISK_MAP[r.riskId] = r; });

// ═══════════════════════════════════════════════════════════════════════════
// MECHANISMS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_MECHANISMS: SupportMechanism[] = [
  { mechId: 'GABA_UP', description: 'Повышение GABA', helpsOrgans: ['BRAIN'], harmsOrgans: [], helpsRisks: 'BRAIN_ANXIETY_DOWN', harmsRisks: 'BRAIN_ANXIETY' },
  { mechId: 'GABA_DOWN', description: 'Снижение GABA', helpsOrgans: [], harmsOrgans: ['BRAIN'], helpsRisks: 'BRAIN_ANXIETY', harmsRisks: 'BRAIN_SLEEP_ISSUES' },
  { mechId: 'SEROTONIN_UP', description: 'Повышение серотонина', helpsOrgans: ['BRAIN'], harmsOrgans: ['GUT'], helpsRisks: 'BRAIN_DEPRESSION_DOWN', harmsRisks: 'BRAIN_DEPRESSION' },
  { mechId: 'SEROTONIN_DOWN', description: 'Снижение серотонина', helpsOrgans: [], harmsOrgans: ['BRAIN'], helpsRisks: 'BRAIN_DEPRESSION', harmsRisks: 'BRAIN_SLEEP_ISSUES' },
  { mechId: 'DOPAMINE_UP', description: 'Повышение дофамина', helpsOrgans: ['BRAIN'], harmsOrgans: [], helpsRisks: 'BRAIN_FOG_DOWN', harmsRisks: 'BRAIN_FOG' },
  { mechId: 'DOPAMINE_DOWN', description: 'Снижение дофамина', helpsOrgans: [], harmsOrgans: ['BRAIN'], helpsRisks: 'BRAIN_FOG', harmsRisks: 'BRAIN_MOTIVATION_LOW' },
  { mechId: 'CORTISOL_UP', description: 'Повышение кортизола', helpsOrgans: ['ADRENALS'], harmsOrgans: ['BRAIN', 'GUT'], helpsRisks: 'HORMONE_HIGH_CORTISOL', harmsRisks: 'HORMONE_LOW_T' },
  { mechId: 'CORTISOL_DOWN', description: 'Снижение кортизола', helpsOrgans: ['BRAIN', 'ADRENALS'], harmsOrgans: [], helpsRisks: 'HORMONE_HIGH_CORTISOL_DOWN', harmsRisks: '' },
  { mechId: 'T3_T4_UP', description: 'Повышение щитовидных гормонов', helpsOrgans: ['THYROID', 'LIVER'], harmsOrgans: [], helpsRisks: 'HORMONE_HYPO_DOWN', harmsRisks: 'HORMONE_HYPER' },
  { mechId: 'T3_T4_DOWN', description: 'Снижение щитовидных гормонов', helpsOrgans: [], harmsOrgans: ['THYROID'], helpsRisks: 'HORMONE_HYPO', harmsRisks: 'HORMONE_HYPER_DOWN' },
  { mechId: 'GLUCOSE_UP', description: 'Повышение глюкозы', helpsOrgans: [], harmsOrgans: ['PANCREAS'], helpsRisks: 'DIABETES_RISK', harmsRisks: 'INSULIN_RESISTANCE' },
  { mechId: 'GLUCOSE_DOWN', description: 'Снижение глюкозы', helpsOrgans: ['PANCREAS'], harmsOrgans: [], helpsRisks: 'DIABETES_RISK_DOWN', harmsRisks: '' },
  { mechId: 'LIPIDS_UP', description: 'Повышение липидов', helpsOrgans: [], harmsOrgans: ['HEART'], helpsRisks: 'BLOOD_HIGH_LDL', harmsRisks: 'HEART_ATHEROSCLEROSIS' },
  { mechId: 'LIPIDS_DOWN', description: 'Снижение липидов', helpsOrgans: ['HEART'], harmsOrgans: [], helpsRisks: 'BLOOD_HIGH_LDL_DOWN', harmsRisks: '' },
  { mechId: 'INFLAMMATION_UP', description: 'Повышение воспаления', helpsOrgans: [], harmsOrgans: ['ALL'], helpsRisks: 'ALL_INFLAMMATION', harmsRisks: 'ALL_DISEASE' },
  { mechId: 'INFLAMMATION_DOWN', description: 'Снижение воспаления', helpsOrgans: ['ALL'], harmsOrgans: [], helpsRisks: 'ALL_INFLAMMATION_DOWN', harmsRisks: '' },
  { mechId: 'OXIDATIVE_UP', description: 'Повышение оксидативного стресса', helpsOrgans: [], harmsOrgans: ['ALL'], helpsRisks: 'OXIDATIVE_STRESS', harmsRisks: 'AGING' },
  { mechId: 'OXIDATIVE_DOWN', description: 'Снижение оксидативного стресса', helpsOrgans: ['ALL'], harmsOrgans: [], helpsRisks: 'OXIDATIVE_STRESS_DOWN', harmsRisks: '' },
  { mechId: 'DETOX_UP', description: 'Ускорение детокса', helpsOrgans: ['LIVER'], harmsOrgans: [], helpsRisks: 'LIVER_FATTY_DOWN', harmsRisks: 'LIVER_TOXICITY' },
  { mechId: 'DETOX_DOWN', description: 'Замедление детокса', helpsOrgans: [], harmsOrgans: ['LIVER'], helpsRisks: 'LIVER_TOXICITY', harmsRisks: 'LIVER_FATTY_DOWN' },
  { mechId: 'BILE_FLOW_UP', description: 'Улучшение желчи', helpsOrgans: ['LIVER', 'GI'], harmsOrgans: [], helpsRisks: 'GI_DYSBIOSIS_DOWN', harmsRisks: 'LIVER_CHOLESTASIS' },
  { mechId: 'BILE_FLOW_DOWN', description: 'Снижение желчи', helpsOrgans: [], harmsOrgans: ['GI'], helpsRisks: 'LIVER_CHOLESTASIS', harmsRisks: 'GI_DYSBIOSIS' },
  { mechId: 'MICROBIOME_UP', description: 'Улучшение микробиоты', helpsOrgans: ['GI'], harmsOrgans: [], helpsRisks: 'GI_DYSBIOSIS_DOWN', harmsRisks: 'IMMUNE_AUTOIMMUNE' },
  { mechId: 'MICROBIOME_DOWN', description: 'Ухудшение микробиоты', helpsOrgans: [], harmsOrgans: ['GI'], helpsRisks: 'GI_DYSBIOSIS', harmsRisks: 'IMMUNE_AUTOIMMUNE' },
  { mechId: 'NO_UP', description: 'Повышение NO', helpsOrgans: ['HEART'], harmsOrgans: [], helpsRisks: 'BP_DOWN', harmsRisks: 'ERECTION_UP' },
  { mechId: 'NO_DOWN', description: 'Снижение NO', helpsOrgans: [], harmsOrgans: ['HEART'], helpsRisks: 'BP_UP', harmsRisks: 'ERECTION_DOWN' },
  { mechId: 'CARDIO_UP', description: 'Повышение нагрузки на сердце', helpsOrgans: [], harmsOrgans: ['HEART'], helpsRisks: 'HEART_STRAIN', harmsRisks: 'HEART_FAILURE' },
  { mechId: 'CARDIO_DOWN', description: 'Снижение нагрузки на сердце', helpsOrgans: ['HEART'], harmsOrgans: [], helpsRisks: 'HEART_STRAIN_DOWN', harmsRisks: '' },
  { mechId: 'COAG_UP', description: 'Повышение свёртываемости', helpsOrgans: [], harmsOrgans: ['BLOOD'], helpsRisks: 'BLOOD_CLOTS', harmsRisks: 'BLOOD_THICK' },
  { mechId: 'COAG_DOWN', description: 'Снижение свёртываемости', helpsOrgans: ['BLOOD'], harmsOrgans: [], helpsRisks: 'BLEED_RISK', harmsRisks: 'BLOOD_CLOTS_DOWN' },
  { mechId: 'GUT_UP', description: 'Улучшение ЖКТ', helpsOrgans: ['GI'], harmsOrgans: [], helpsRisks: 'GI_REFLUX_DOWN', harmsRisks: 'GI_REFLUX' },
  { mechId: 'GUT_DOWN', description: 'Снижение функции ЖКТ', helpsOrgans: [], harmsOrgans: ['GI'], helpsRisks: 'GI_REFLUX', harmsRisks: 'GI_DYSBIOSIS' },
  { mechId: 'IMMUNE_UP', description: 'Повышение иммунитета', helpsOrgans: ['IMMUNE_SYSTEM'], harmsOrgans: [], helpsRisks: 'IMMUNE_LOW_DOWN', harmsRisks: 'AUTOIMMUNE_UP' },
  { mechId: 'IMMUNE_DOWN', description: 'Снижение иммунитета', helpsOrgans: [], harmsOrgans: ['IMMUNE_SYSTEM'], helpsRisks: 'IMMUNE_LOW', harmsRisks: 'INFECTION_RISK' },
  { mechId: 'ENERGY_UP', description: 'Повышение энергии', helpsOrgans: ['ALL'], harmsOrgans: [], helpsRisks: 'FATIGUE_DOWN', harmsRisks: 'FATIGUE' },
  { mechId: 'ENERGY_DOWN', description: 'Снижение энергии', helpsOrgans: [], harmsOrgans: ['ALL'], helpsRisks: 'FATIGUE', harmsRisks: 'LOW_ENERGY' },
];

export const MECHANISM_MAP: Record<string, SupportMechanism> = {};
ALL_MECHANISMS.forEach(m => { MECHANISM_MAP[m.mechId] = m; });

// ═══════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_RECOMMENDATIONS: SupportRecommendation[] = [
  { recId: 'REC_LIVER_FATTY_LOW', type: 'RISK', relatedId: 'LIVER_FATTY', level: 'LOW', label: 'Лёгкий стеатоз', text: 'Уменьши сахар и фастфуд' },
  { recId: 'REC_LIVER_FATTY_MED', type: 'RISK', relatedId: 'LIVER_FATTY', level: 'MEDIUM', label: 'Стеатоз средней степени', text: 'Убери сахар' },
  { recId: 'REC_LIVER_FATTY_HIGH', type: 'RISK', relatedId: 'LIVER_FATTY', level: 'HIGH', label: 'Выраженный стеатоз', text: 'Срочно снижать углеводы' },
  { recId: 'REC_LIVER_NASH_LOW', type: 'RISK', relatedId: 'LIVER_NASH', level: 'LOW', label: 'Начало воспаления печени', text: 'Убери алкоголь' },
  { recId: 'REC_LIVER_NASH_MED', type: 'RISK', relatedId: 'LIVER_NASH', level: 'MEDIUM', label: 'НАСГ средней тяжести', text: 'Добавь NAC' },
  { recId: 'REC_LIVER_NASH_HIGH', type: 'RISK', relatedId: 'LIVER_NASH', level: 'HIGH', label: 'Выраженный НАСГ', text: 'Требуется агрессивное снижение веса и антиоксиданты.' },
  { recId: 'REC_LIVER_CHOLESTASIS_LOW', type: 'RISK', relatedId: 'LIVER_CHOLESTASIS', level: 'LOW', label: 'Лёгкий холестаз', text: 'Добавь таурин и артишок.' },
  { recId: 'REC_LIVER_CHOLESTASIS_MED', type: 'RISK', relatedId: 'LIVER_CHOLESTASIS', level: 'MEDIUM', label: 'Холестаз', text: 'Убери жирное' },
  { recId: 'REC_LIVER_CHOLESTASIS_HIGH', type: 'RISK', relatedId: 'LIVER_CHOLESTASIS', level: 'HIGH', label: 'Выраженный холестаз', text: 'Нужна медикаментозная терапия и контроль ферментов.' },
  { recId: 'REC_KIDNEY_CKD_LOW', type: 'RISK', relatedId: 'KIDNEY_CKD', level: 'LOW', label: 'Снижение функции почек', text: 'Пей воду' },
  { recId: 'REC_KIDNEY_CKD_MED', type: 'RISK', relatedId: 'KIDNEY_CKD', level: 'MEDIUM', label: 'ХБП средней степени', text: 'Контроль давления' },
  { recId: 'REC_KIDNEY_CKD_HIGH', type: 'RISK', relatedId: 'KIDNEY_CKD', level: 'HIGH', label: 'Выраженная ХБП', text: 'Срочно к нефрологу' },
  { recId: 'REC_KIDNEY_STONES_LOW', type: 'RISK', relatedId: 'KIDNEY_STONES', level: 'LOW', label: 'Риск камней', text: 'Пей воду' },
  { recId: 'REC_KIDNEY_STONES_MED', type: 'RISK', relatedId: 'KIDNEY_STONES', level: 'MEDIUM', label: 'Камни', text: 'Убери оксалаты' },
  { recId: 'REC_KIDNEY_STONES_HIGH', type: 'RISK', relatedId: 'KIDNEY_STONES', level: 'HIGH', label: 'Крупные камни', text: 'Требуется УЗИ и терапия.' },
  { recId: 'REC_HEART_HYPERTENSION_LOW', type: 'RISK', relatedId: 'HEART_HYPERTENSION', level: 'LOW', label: 'Повышенное давление', text: 'Уменьши соль' },
  { recId: 'REC_HEART_HYPERTENSION_MED', type: 'RISK', relatedId: 'HEART_HYPERTENSION', level: 'MEDIUM', label: 'Гипертензия', text: 'Добавь калий' },
  { recId: 'REC_HEART_HYPERTENSION_HIGH', type: 'RISK', relatedId: 'HEART_HYPERTENSION', level: 'HIGH', label: 'Высокое давление', text: 'Требуется медикаментозная терапия.' },
  { recId: 'REC_HEART_ATHEROSCLEROSIS_LOW', type: 'RISK', relatedId: 'HEART_ATHEROSCLEROSIS', level: 'LOW', label: 'Риск атеросклероза', text: 'Добавь омега‑3 и витамин K2.' },
  { recId: 'REC_HEART_ATHEROSCLEROSIS_MED', type: 'RISK', relatedId: 'HEART_ATHEROSCLEROSIS', level: 'MEDIUM', label: 'Атеросклероз', text: 'Контроль липидов' },
  { recId: 'REC_HEART_ATHEROSCLEROSIS_HIGH', type: 'RISK', relatedId: 'HEART_ATHEROSCLEROSIS', level: 'HIGH', label: 'Выраженный атеросклероз', text: 'Требуется терапия статинами.' },
  { recId: 'REC_LUNGS_ASTHMA_LOW', type: 'RISK', relatedId: 'LUNGS_ASTHMA', level: 'LOW', label: 'Лёгкая астма', text: 'Убери аллергены' },
  { recId: 'REC_LUNGS_ASTHMA_MED', type: 'RISK', relatedId: 'LUNGS_ASTHMA', level: 'MEDIUM', label: 'Астма', text: 'Контроль воспаления' },
  { recId: 'REC_LUNGS_ASTHMA_HIGH', type: 'RISK', relatedId: 'LUNGS_ASTHMA', level: 'HIGH', label: 'Тяжёлая астма', text: 'Требуется терапия.' },
  { recId: 'REC_LUNGS_COPD_LOW', type: 'RISK', relatedId: 'LUNGS_COPD', level: 'LOW', label: 'Риск ХОБЛ', text: 'Убери курение' },
  { recId: 'REC_LUNGS_COPD_MED', type: 'RISK', relatedId: 'LUNGS_COPD', level: 'MEDIUM', label: 'ХОБЛ', text: 'Добавь антиоксиданты.' },
  { recId: 'REC_LUNGS_COPD_HIGH', type: 'RISK', relatedId: 'LUNGS_COPD', level: 'HIGH', label: 'Выраженная ХОБЛ', text: 'Требуется лечение.' },
  { recId: 'REC_GI_GASTRITIS_LOW', type: 'RISK', relatedId: 'GI_GASTRITIS', level: 'LOW', label: 'Лёгкий гастрит', text: 'Убери кофе' },
  { recId: 'REC_GI_GASTRITIS_MED', type: 'RISK', relatedId: 'GI_GASTRITIS', level: 'MEDIUM', label: 'Гастрит', text: 'Добавь пробиотики.' },
  { recId: 'REC_GI_GASTRITIS_HIGH', type: 'RISK', relatedId: 'GI_GASTRITIS', level: 'HIGH', label: 'Выраженный гастрит', text: 'Требуется терапия.' },
  { recId: 'REC_GI_DYSBIOSIS_LOW', type: 'RISK', relatedId: 'GI_DYSBIOSIS', level: 'LOW', label: 'Лёгкий дисбиоз', text: 'Добавь клетчатку.' },
  { recId: 'REC_GI_DYSBIOSIS_MED', type: 'RISK', relatedId: 'GI_DYSBIOSIS', level: 'MEDIUM', label: 'Дисбиоз', text: 'Пробиотики + пребиотики.' },
  { recId: 'REC_GI_DYSBIOSIS_HIGH', type: 'RISK', relatedId: 'GI_DYSBIOSIS', level: 'HIGH', label: 'Выраженный дисбиоз', text: 'Нужна коррекция питания.' },
  { recId: 'REC_HORMONE_LOW_T_LOW', type: 'RISK', relatedId: 'HORMONE_LOW_T', level: 'LOW', label: 'Низкий тестостерон', text: 'Добавь цинк и витамин D.' },
  { recId: 'REC_HORMONE_LOW_T_MED', type: 'RISK', relatedId: 'HORMONE_LOW_T', level: 'MEDIUM', label: 'Тестостерон снижен', text: 'Добавь ашвагандху.' },
  { recId: 'REC_HORMONE_LOW_T_HIGH', type: 'RISK', relatedId: 'HORMONE_LOW_T', level: 'HIGH', label: 'Выраженный дефицит', text: 'Требуется анализы.' },
  { recId: 'REC_HORMONE_HIGH_CORTISOL_LOW', type: 'RISK', relatedId: 'HORMONE_HIGH_CORTISOL', level: 'LOW', label: 'Высокий кортизол', text: 'Добавь магний.' },
  { recId: 'REC_HORMONE_HIGH_CORTISOL_MED', type: 'RISK', relatedId: 'HORMONE_HIGH_CORTISOL', level: 'MEDIUM', label: 'Кортизол повышен', text: 'Добавь родиолу.' },
  { recId: 'REC_HORMONE_HIGH_CORTISOL_HIGH', type: 'RISK', relatedId: 'HORMONE_HIGH_CORTISOL', level: 'HIGH', label: 'Выраженный стресс', text: 'Требуется восстановление сна.' },
  { recId: 'REC_BRAIN_ANXIETY_LOW', type: 'RISK', relatedId: 'BRAIN_ANXIETY', level: 'LOW', label: 'Лёгкая тревожность', text: 'Добавь теанин.' },
  { recId: 'REC_BRAIN_ANXIETY_MED', type: 'RISK', relatedId: 'BRAIN_ANXIETY', level: 'MEDIUM', label: 'Тревожность', text: 'Добавь магний + GABA.' },
  { recId: 'REC_BRAIN_ANXIETY_HIGH', type: 'RISK', relatedId: 'BRAIN_ANXIETY', level: 'HIGH', label: 'Выраженная тревога', text: 'Требуется терапия.' },
  { recId: 'REC_BRAIN_FOG_LOW', type: 'RISK', relatedId: 'BRAIN_BRAIN_FOG', level: 'LOW', label: 'Лёгкий туман', text: 'Добавь омега‑3.' },
  { recId: 'REC_BRAIN_FOG_MED', type: 'RISK', relatedId: 'BRAIN_BRAIN_FOG', level: 'MEDIUM', label: 'Туман', text: 'Добавь ацетил-L-карнитин.' },
  { recId: 'REC_BRAIN_FOG_HIGH', type: 'RISK', relatedId: 'BRAIN_BRAIN_FOG', level: 'HIGH', label: 'Выраженный туман', text: 'Проверь щитовидку.' },
  { recId: 'REC_BLOOD_ANEMIA_LOW', type: 'RISK', relatedId: 'BLOOD_ANEMIA', level: 'LOW', label: 'Лёгкая анемия', text: 'Добавь железо + витамин C.' },
  { recId: 'REC_BLOOD_ANEMIA_MED', type: 'RISK', relatedId: 'BLOOD_ANEMIA', level: 'MEDIUM', label: 'Анемия', text: 'Добавь B12.' },
  { recId: 'REC_BLOOD_ANEMIA_HIGH', type: 'RISK', relatedId: 'BLOOD_ANEMIA', level: 'HIGH', label: 'Выраженная анемия', text: 'Требуется диагностика.' },
  { recId: 'REC_BLOOD_HIGH_LDL_LOW', type: 'RISK', relatedId: 'BLOOD_HIGH_LDL', level: 'LOW', label: 'Повышен ЛПНП', text: 'Добавь омега‑3.' },
  { recId: 'REC_BLOOD_HIGH_LDL_MED', type: 'RISK', relatedId: 'BLOOD_HIGH_LDL', level: 'MEDIUM', label: 'Высокий ЛПНП', text: 'Добавь K2.' },
  { recId: 'REC_BLOOD_HIGH_LDL_HIGH', type: 'RISK', relatedId: 'BLOOD_HIGH_LDL', level: 'HIGH', label: 'Очень высокий ЛПНП', text: 'Требуются статины.' },
  { recId: 'REC_JOINT_ARTHRITIS_LOW', type: 'RISK', relatedId: 'JOINT_ARTHRITIS', level: 'LOW', label: 'Лёгкое воспаление', text: 'Добавь омега‑3.' },
  { recId: 'REC_JOINT_ARTHRITIS_MED', type: 'RISK', relatedId: 'JOINT_ARTHRITIS', level: 'MEDIUM', label: 'Артрит', text: 'Добавь куркумин.' },
  { recId: 'REC_JOINT_ARTHRITIS_HIGH', type: 'RISK', relatedId: 'JOINT_ARTHRITIS', level: 'HIGH', label: 'Выраженный артрит', text: 'Требуется терапия.' },
  { recId: 'REC_SKIN_ACNE_LOW', type: 'RISK', relatedId: 'SKIN_ACNE', level: 'LOW', label: 'Лёгкое акне', text: 'Добавь цинк.' },
  { recId: 'REC_SKIN_ACNE_MED', type: 'RISK', relatedId: 'SKIN_ACNE', level: 'MEDIUM', label: 'Акне', text: 'Добавь витамин A.' },
  { recId: 'REC_SKIN_ACNE_HIGH', type: 'RISK', relatedId: 'SKIN_ACNE', level: 'HIGH', label: 'Выраженное акне', text: 'Проверь гормоны.' },
  { recId: 'REC_VISION_DRY_LOW', type: 'RISK', relatedId: 'VISION_DRY_EYE', level: 'LOW', label: 'Сухость глаз', text: 'Добавь омега‑3.' },
  { recId: 'REC_VISION_DRY_MED', type: 'RISK', relatedId: 'VISION_DRY_EYE', level: 'MEDIUM', label: 'Сухой глаз', text: 'Добавь витамин A.' },
  { recId: 'REC_VISION_DRY_HIGH', type: 'RISK', relatedId: 'VISION_DRY_EYE', level: 'HIGH', label: 'Выраженная сухость', text: 'Проверь слёзную плёнку.' },
  { recId: 'REC_MECH_INFLAMMATION_UP', type: 'MECHANISM', relatedId: 'INFLAMMATION_UP', level: 'MEDIUM', label: 'Повышено воспаление', text: 'Добавь омега‑3' },
  { recId: 'REC_MECH_INFLAMMATION_DOWN', type: 'MECHANISM', relatedId: 'INFLAMMATION_DOWN', level: 'LOW', label: 'Снижение воспаления', text: 'Продолжай текущий режим.' },
  { recId: 'REC_MECH_CORTISOL_UP', type: 'MECHANISM', relatedId: 'CORTISOL_UP', level: 'MEDIUM', label: 'Кортизол повышен', text: 'Добавь магний и адаптогены.' },
  { recId: 'REC_MECH_CORTISOL_DOWN', type: 'MECHANISM', relatedId: 'CORTISOL_DOWN', level: 'LOW', label: 'Кортизол снижен', text: 'Добавь витамин C и сон.' },
  { recId: 'REC_MECH_T3_T4_UP', type: 'MECHANISM', relatedId: 'T3_T4_UP', level: 'LOW', label: 'Щитовидка активна', text: 'Контролируй пульс и сон.' },
  { recId: 'REC_MECH_T3_T4_DOWN', type: 'MECHANISM', relatedId: 'T3_T4_DOWN', level: 'MEDIUM', label: 'Щитовидка снижена', text: 'Добавь йод' },
  { recId: 'REC_MECH_GABA_UP', type: 'MECHANISM', relatedId: 'GABA_UP', level: 'LOW', label: 'Улучшение расслабления', text: 'Поддерживай режим сна.' },
  { recId: 'REC_MECH_GABA_DOWN', type: 'MECHANISM', relatedId: 'GABA_DOWN', level: 'MEDIUM', label: 'Снижение GABA', text: 'Добавь магний и теанин.' },
  { recId: 'REC_ORGAN_LIVER', type: 'ORGAN', relatedId: 'LIVER', level: 'MEDIUM', label: 'Печень нагружена', text: 'Убери алкоголь' },
  { recId: 'REC_ORGAN_KIDNEYS', type: 'ORGAN', relatedId: 'KIDNEYS', level: 'MEDIUM', label: 'Почки нагружены', text: 'Пей воду' },
  { recId: 'REC_ORGAN_HEART', type: 'ORGAN', relatedId: 'HEART', level: 'MEDIUM', label: 'Сердце нагружено', text: 'Добавь омега‑3.' },
  { recId: 'REC_ORGAN_GUT', type: 'ORGAN', relatedId: 'GI', level: 'MEDIUM', label: 'ЖКТ раздражён', text: 'Добавь пробиотики.' },
  { recId: 'REC_ORGAN_BRAIN', type: 'ORGAN', relatedId: 'BRAIN', level: 'MEDIUM', label: 'ЦНС перегружена', text: 'Добавь магний и сон.' },
  { recId: 'REC_AXIS_LIVER_THYROID', type: 'AXIS', relatedId: 'AXIS_LIVER_THYROID', level: 'MEDIUM', label: 'Печень → щитовидка', text: 'Улучшай детокс' },
  { recId: 'REC_AXIS_GUT_BRAIN', type: 'AXIS', relatedId: 'AXIS_GUT_BRAIN', level: 'MEDIUM', label: 'Кишечник → мозг', text: 'Добавь пробиотики и клетчатку.' },
  { recId: 'REC_AXIS_ADRENAL_GONAD', type: 'AXIS', relatedId: 'AXIS_ADRENAL_GONAD', level: 'MEDIUM', label: 'Стресс → гормоны', text: 'Снизь кортизол' },
  { recId: 'REC_AXIS_HEART_KIDNEY', type: 'AXIS', relatedId: 'AXIS_HEART_KIDNEY', level: 'MEDIUM', label: 'Сердце → почки', text: 'Контролируй давление.' },
  { recId: 'REC_AXIS_LIVER_GUT', type: 'AXIS', relatedId: 'AXIS_LIVER_GUT', level: 'MEDIUM', label: 'Печень → ЖКТ', text: 'Добавь желчегонные.' },
  { recId: 'REC_AXIS_GUT_IMMUNE', type: 'AXIS', relatedId: 'AXIS_GUT_IMMUNE', level: 'MEDIUM', label: 'Кишечник → иммунитет', text: 'Добавь пробиотики.' },
  { recId: 'REC_AXIS_BRAIN_ADRENAL', type: 'AXIS', relatedId: 'AXIS_BRAIN_ADRENAL', level: 'MEDIUM', label: 'Стресс → надпочечники', text: 'Нормализуй сон.' },
  { recId: 'REC_AXIS_LIVER_SKIN', type: 'AXIS', relatedId: 'AXIS_LIVER_SKIN', level: 'MEDIUM', label: 'Печень → кожа', text: 'Улучшай детокс.' },
  { recId: 'REC_AXIS_EYES_BRAIN', type: 'AXIS', relatedId: 'AXIS_EYES_BRAIN', level: 'MEDIUM', label: 'Глаза → мозг', text: 'Снизь нагрузку на зрение.' },
  { recId: 'REC_INT_CAFFEINE_LTHEANINE', type: 'INTERACTION', relatedId: 'INT_CAFFEINE_LTHEANINE', level: 'LOW', label: 'Кофеин + Теанин', text: 'Хорошая синергия: мягкая стимуляция без тревоги.' },
  { recId: 'REC_INT_CAFFEINE_NICOTINE', type: 'INTERACTION', relatedId: 'INT_CAFFEINE_NICOTINE', level: 'MEDIUM', label: 'Кофеин + Никотин', text: 'Сильная стимуляция' },
  { recId: 'REC_INT_CAFFEINE_SYNEPHRINE', type: 'INTERACTION', relatedId: 'INT_CAFFEINE_SYNEPHRINE', level: 'HIGH', label: 'Кофеин + Синефрин', text: 'Опасная нагрузка на сердце.' },
  { recId: 'REC_INT_CAFFEINE_YOHIMBINE', type: 'INTERACTION', relatedId: 'INT_CAFFEINE_YOHIMBINE', level: 'HIGH', label: 'Кофеин + Йохимбин', text: 'Резкая тревога' },
  { recId: 'REC_INT_IRON_VITC', type: 'INTERACTION', relatedId: 'INT_IRON_VITC', level: 'LOW', label: 'Железо + Витамин C', text: 'Улучшает всасывание железа.' },
  { recId: 'REC_INT_IRON_CALCIUM', type: 'INTERACTION', relatedId: 'INT_IRON_CALCIUM', level: 'MEDIUM', label: 'Железо + Кальций', text: 'Не принимай вместе — конкурируют.' },
  { recId: 'REC_INT_IRON_ZINC', type: 'INTERACTION', relatedId: 'INT_IRON_ZINC', level: 'MEDIUM', label: 'Железо + Цинк', text: 'Снижают всасывание друг друга.' },
  { recId: 'REC_INT_ZINC_COPPER', type: 'INTERACTION', relatedId: 'INT_ZINC_COPPER', level: 'MEDIUM', label: 'Цинк + Медь', text: 'Длительный цинк снижает медь.' },
  { recId: 'REC_INT_CALCIUM_MAGNESIUM', type: 'INTERACTION', relatedId: 'INT_CALCIUM_MAGNESIUM', level: 'LOW', label: 'Кальций + Магний', text: 'Лучше разнести по времени.' },
  { recId: 'REC_INT_VITD_K2', type: 'INTERACTION', relatedId: 'INT_VITD_K2', level: 'LOW', label: 'Витамин D + K2', text: 'Идеальная пара для костей.' },
  { recId: 'REC_INT_OMEGA3_ANTICOAG', type: 'INTERACTION', relatedId: 'INT_OMEGA3_ANTICOAG', level: 'MEDIUM', label: 'Омега‑3 + Антикоагулянты', text: 'Риск кровотечений.' },
  { recId: 'REC_INT_OMEGA3_NSAIDS', type: 'INTERACTION', relatedId: 'INT_OMEGA3_NSAIDS', level: 'LOW', label: 'Омега‑3 + НПВС', text: 'Сильный противовоспалительный эффект.' },
  { recId: 'REC_INT_5HTP_SSRIS', type: 'INTERACTION', relatedId: 'INT_5HTP_SSRIS', level: 'HIGH', label: '5-HTP + СИОЗС', text: 'Риск серотонинового синдрома.' },
  { recId: 'REC_INT_5HTP_TRYPTOPHAN', type: 'INTERACTION', relatedId: 'INT_5HTP_TRYPTOPHAN', level: 'MEDIUM', label: '5-HTP + Триптофан', text: 'Избыток серотонина.' },
  { recId: 'REC_INT_STJOHNSWORT_SSRIS', type: 'INTERACTION', relatedId: 'INT_STJOHNSWORT_SSRIS', level: 'HIGH', label: 'Зверобой + СИОЗС', text: 'Опасная комбинация.' },
  { recId: 'REC_INT_STJOHNSWORT_OCP', type: 'INTERACTION', relatedId: 'INT_STJOHNSWORT_OCP', level: 'MEDIUM', label: 'Зверобой + ОК', text: 'Снижает эффективность контрацепции.' },
  { recId: 'REC_INT_NAC_PARACETAMOL', type: 'INTERACTION', relatedId: 'INT_NAC_PARACETAMOL', level: 'MEDIUM', label: 'NAC + Парацетамол', text: 'Защищает печень.' },
  { recId: 'REC_INT_NAC_CHEMO', type: 'INTERACTION', relatedId: 'INT_NAC_CHEMO', level: 'MEDIUM', label: 'NAC + Химиотерапия', text: 'Может мешать лечению.' },
  { recId: 'REC_INT_CURCUMIN_ANTICOAG', type: 'INTERACTION', relatedId: 'INT_CURCUMIN_ANTICOAG', level: 'MEDIUM', label: 'Куркумин + Антикоагулянты', text: 'Риск кровотечений.' },
  { recId: 'REC_INT_CURCUMIN_NSAIDS', type: 'INTERACTION', relatedId: 'INT_CURCUMIN_NSAIDS', level: 'LOW', label: 'Куркумин + НПВС', text: 'Сильный противовоспалительный эффект.' },
  { recId: 'REC_INT_PROBIOTICS_ANTIBIOTICS', type: 'INTERACTION', relatedId: 'INT_PROBIOTICS_ANTIBIOTICS', level: 'HIGH', label: 'Пробиотики + Антибиотики', text: 'Принимай раздельно.' },
  { recId: 'REC_INT_PROBIOTICS_FIBER', type: 'INTERACTION', relatedId: 'INT_PROBIOTICS_FIBER', level: 'LOW', label: 'Пробиотики + Клетчатка', text: 'Идеальная синергия.' },
  { recId: 'REC_SYSTEM_LIVER_HIGH', type: 'SYSTEM', relatedId: 'LIVER', level: 'HIGH', label: 'Печень перегружена', text: 'Убери алкоголь' },
  { recId: 'REC_SYSTEM_LIVER_MED', type: 'SYSTEM', relatedId: 'LIVER', level: 'MEDIUM', label: 'Печень под нагрузкой', text: 'Снизь жирное' },
  { recId: 'REC_SYSTEM_LIVER_LOW', type: 'SYSTEM', relatedId: 'LIVER', level: 'LOW', label: 'Печень стабильна', text: 'Поддерживай режим питания.' },
  { recId: 'REC_SYSTEM_KIDNEYS_HIGH', type: 'SYSTEM', relatedId: 'KIDNEYS', level: 'HIGH', label: 'Почки перегружены', text: 'Пей воду' },
  { recId: 'REC_SYSTEM_KIDNEYS_MED', type: 'SYSTEM', relatedId: 'KIDNEYS', level: 'MEDIUM', label: 'Почки под нагрузкой', text: 'Увеличь воду' },
  { recId: 'REC_SYSTEM_KIDNEYS_LOW', type: 'SYSTEM', relatedId: 'KIDNEYS', level: 'LOW', label: 'Почки стабильны', text: 'Поддерживай водный режим.' },
  { recId: 'REC_SYSTEM_HEART_HIGH', type: 'SYSTEM', relatedId: 'HEART', level: 'HIGH', label: 'Сердце перегружено', text: 'Снизь стресс' },
  { recId: 'REC_SYSTEM_HEART_MED', type: 'SYSTEM', relatedId: 'HEART', level: 'MEDIUM', label: 'Сердце под нагрузкой', text: 'Добавь лёгкую кардио‑нагрузку.' },
  { recId: 'REC_SYSTEM_HEART_LOW', type: 'SYSTEM', relatedId: 'HEART', level: 'LOW', label: 'Сердце стабильно', text: 'Поддерживай активность.' },
  { recId: 'REC_SYSTEM_GUT_HIGH', type: 'SYSTEM', relatedId: 'GI', level: 'HIGH', label: 'ЖКТ раздражён', text: 'Убери жареное' },
  { recId: 'REC_SYSTEM_GUT_MED', type: 'SYSTEM', relatedId: 'GI', level: 'MEDIUM', label: 'ЖКТ под нагрузкой', text: 'Добавь ферменты и клетчатку.' },
  { recId: 'REC_SYSTEM_GUT_LOW', type: 'SYSTEM', relatedId: 'GI', level: 'LOW', label: 'ЖКТ стабилен', text: 'Поддерживай разнообразное питание.' },
  { recId: 'REC_SYSTEM_BRAIN_HIGH', type: 'SYSTEM', relatedId: 'BRAIN', level: 'HIGH', label: 'ЦНС перегружена', text: 'Снизь стимуляторы' },
  { recId: 'REC_SYSTEM_BRAIN_MED', type: 'SYSTEM', relatedId: 'BRAIN', level: 'MEDIUM', label: 'ЦНС под нагрузкой', text: 'Сделай паузы' },
  { recId: 'REC_SYSTEM_BRAIN_LOW', type: 'SYSTEM', relatedId: 'BRAIN', level: 'LOW', label: 'ЦНС стабильна', text: 'Поддерживай режим сна.' },
  { recId: 'REC_SYSTEM_HORMONES_HIGH', type: 'SYSTEM', relatedId: 'HORMONES', level: 'HIGH', label: 'Гормональная система перегружена', text: 'Снизь стресс' },
  { recId: 'REC_SYSTEM_HORMONES_MED', type: 'SYSTEM', relatedId: 'HORMONES', level: 'MEDIUM', label: 'Гормоны под нагрузкой', text: 'Добавь адаптогены.' },
  { recId: 'REC_SYSTEM_HORMONES_LOW', type: 'SYSTEM', relatedId: 'HORMONES', level: 'LOW', label: 'Гормоны стабильны', text: 'Поддерживай баланс питания.' },
  { recId: 'REC_SYSTEM_IMMUNE_HIGH', type: 'SYSTEM', relatedId: 'IMMUNE_SYSTEM', level: 'HIGH', label: 'Иммунитет перегружен', text: 'Снизь стресс' },
  { recId: 'REC_SYSTEM_IMMUNE_MED', type: 'SYSTEM', relatedId: 'IMMUNE_SYSTEM', level: 'MEDIUM', label: 'Иммунитет под нагрузкой', text: 'Добавь цинк и пробиотики.' },
  { recId: 'REC_SYSTEM_IMMUNE_LOW', type: 'SYSTEM', relatedId: 'IMMUNE_SYSTEM', level: 'LOW', label: 'Иммунитет стабилен', text: 'Поддерживай режим.' },
  { recId: 'REC_GLOBAL_SLEEP_LOW', type: 'GLOBAL', relatedId: 'SLEEP', level: 'LOW', label: 'Недостаток сна', text: 'Ложись раньше' },
  { recId: 'REC_GLOBAL_SLEEP_MED', type: 'GLOBAL', relatedId: 'SLEEP', level: 'MEDIUM', label: 'Хронический недосып', text: 'Добавь магний и режим.' },
  { recId: 'REC_GLOBAL_SLEEP_HIGH', type: 'GLOBAL', relatedId: 'SLEEP', level: 'HIGH', label: 'Сильная бессонница', text: 'Снизь стимуляторы' },
  { recId: 'REC_GLOBAL_STRESS_LOW', type: 'GLOBAL', relatedId: 'STRESS', level: 'LOW', label: 'Лёгкий стресс', text: 'Добавь прогулки.' },
  { recId: 'REC_GLOBAL_STRESS_MED', type: 'GLOBAL', relatedId: 'STRESS', level: 'MEDIUM', label: 'Стресс', text: 'Добавь дыхательные практики.' },
  { recId: 'REC_GLOBAL_STRESS_HIGH', type: 'GLOBAL', relatedId: 'STRESS', level: 'HIGH', label: 'Сильный стресс', text: 'Снизь нагрузки' },
  { recId: 'REC_GLOBAL_DIET_LOW', type: 'GLOBAL', relatedId: 'DIET', level: 'LOW', label: 'Питание слегка нарушено', text: 'Уменьши сахар.' },
  { recId: 'REC_GLOBAL_DIET_MED', type: 'GLOBAL', relatedId: 'DIET', level: 'MEDIUM', label: 'Питание под нагрузкой', text: 'Добавь белок и клетчатку.' },
  { recId: 'REC_GLOBAL_DIET_HIGH', type: 'GLOBAL', relatedId: 'DIET', level: 'HIGH', label: 'Питание сильно нарушено', text: 'Убери фастфуд' },
  { recId: 'REC_GLOBAL_ACTIVITY_LOW', type: 'GLOBAL', relatedId: 'ACTIVITY', level: 'LOW', label: 'Мало движения', text: 'Добавь 20 минут ходьбы.' },
  { recId: 'REC_GLOBAL_ACTIVITY_MED', type: 'GLOBAL', relatedId: 'ACTIVITY', level: 'MEDIUM', label: 'Недостаток активности', text: 'Добавь 30–40 минут кардио.' },
  { recId: 'REC_GLOBAL_ACTIVITY_HIGH', type: 'GLOBAL', relatedId: 'ACTIVITY', level: 'HIGH', label: 'Переутомление', text: 'Снизь нагрузку' },
  { recId: 'REC_GLOBAL_WATER_LOW', type: 'GLOBAL', relatedId: 'WATER', level: 'LOW', label: 'Недостаток воды', text: 'Пей чаще.' },
  { recId: 'REC_GLOBAL_WATER_MED', type: 'GLOBAL', relatedId: 'WATER', level: 'MEDIUM', label: 'Обезвоживание', text: 'Увеличь воду и электролиты.' },
  { recId: 'REC_GLOBAL_WATER_HIGH', type: 'GLOBAL', relatedId: 'WATER', level: 'HIGH', label: 'Сильный дефицит жидкости', text: 'Срочно восстанови водный баланс.' },
  { recId: 'REC_GLOBAL_CAFFEINE_LOW', type: 'GLOBAL', relatedId: 'CAFFEINE', level: 'LOW', label: 'Чуть много кофеина', text: 'Уменьши после 16:00.' },
  { recId: 'REC_GLOBAL_CAFFEINE_MED', type: 'GLOBAL', relatedId: 'CAFFEINE', level: 'MEDIUM', label: 'Переизбыток кофеина', text: 'Снизь дозу' },
  { recId: 'REC_GLOBAL_CAFFEINE_HIGH', type: 'GLOBAL', relatedId: 'CAFFEINE', level: 'HIGH', label: 'Сильная перегрузка кофеином', text: 'Сделай детокс 48 часов.' },
  { recId: 'REC_GLOBAL_ALCOHOL_LOW', type: 'GLOBAL', relatedId: 'ALCOHOL', level: 'LOW', label: 'Алкоголь в норме', text: 'Сохраняй умеренность.' },
  { recId: 'REC_GLOBAL_ALCOHOL_MED', type: 'GLOBAL', relatedId: 'ALCOHOL', level: 'MEDIUM', label: 'Алкоголь повышен', text: 'Снизь частоту.' },
  { recId: 'REC_GLOBAL_ALCOHOL_HIGH', type: 'GLOBAL', relatedId: 'ALCOHOL', level: 'HIGH', label: 'Сильная алкогольная нагрузка', text: 'Сделай паузу минимум неделю.' },
  { recId: 'REC_GLOBAL_SUGAR_LOW', type: 'GLOBAL', relatedId: 'SUGAR', level: 'LOW', label: 'Сахара чуть много', text: 'Уменьши сладкое.' },
  { recId: 'REC_GLOBAL_SUGAR_MED', type: 'GLOBAL', relatedId: 'SUGAR', level: 'MEDIUM', label: 'Сахар повышен', text: 'Убери сладкое 7 дней.' },
  { recId: 'REC_GLOBAL_SUGAR_HIGH', type: 'GLOBAL', relatedId: 'SUGAR', level: 'HIGH', label: 'Сильная сахарная нагрузка', text: 'Полный отказ 14 дней.' },
  { recId: 'REC_GLOBAL_SCREEN_LOW', type: 'GLOBAL', relatedId: 'SCREENS', level: 'LOW', label: 'Много экранов', text: 'Делай паузы 20–20–20.' },
  { recId: 'REC_GLOBAL_SCREEN_MED', type: 'GLOBAL', relatedId: 'SCREENS', level: 'MEDIUM', label: 'Перегрузка экранами', text: 'Уменьши вечерний экран.' },
  { recId: 'REC_GLOBAL_SCREEN_HIGH', type: 'GLOBAL', relatedId: 'SCREENS', level: 'HIGH', label: 'Сильная цифровая усталость', text: 'Сделай цифровой детокс.' },
  { recId: 'REC_GLOBAL_SLEEP_HYGIENE', type: 'GLOBAL', relatedId: 'SLEEP_HYGIENE', level: 'LOW', label: 'Гигиена сна нарушена', text: 'Проветривай комнату' },
  { recId: 'REC_GLOBAL_CIRCADIAN', type: 'GLOBAL', relatedId: 'CIRCADIAN', level: 'MEDIUM', label: 'Сбитые ритмы', text: 'Ложись и вставай в одно время.' },
  { recId: 'REC_GLOBAL_RECOVERY', type: 'GLOBAL', relatedId: 'RECOVERY', level: 'MEDIUM', label: 'Недостаток восстановления', text: 'Добавь растяжку и сон.' },
];

export const RECOMMENDATION_MAP: Record<string, SupportRecommendation> = {};
ALL_RECOMMENDATIONS.forEach(r => { RECOMMENDATION_MAP[r.recId] = r; });

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Find substances by organ */
export function findSubstancesByOrgan(organ: string): SupportSubstance[] {
  const upper = organ.toUpperCase();
  return ALL_SUBSTANCES.filter(s => s.organs.some(o => o.toUpperCase() === upper));
}

/** Find substances by category */
export function findSubstancesByCategory(category: string): SupportSubstance[] {
  return ALL_SUBSTANCES.filter(s => s.categories.includes(category));
}

/** Find substances by type */
export function findSubstancesByType(type: string): SupportSubstance[] {
  return ALL_SUBSTANCES.filter(s => s.type === type);
}

/** Get all interactions for a substance */
export function findInteractionsForSubstance(substanceId: string): SupportInteraction[] {
  return ALL_INTERACTIONS.filter(i => i.substanceA === substanceId || i.substanceB === substanceId);
}

/** Find risks for a specific organ */
export function findRisksForOrgan(organ: string): SupportRisk[] {
  const upper = organ.toUpperCase();
  return ALL_RISKS.filter(r => r.organs.some(o => o.toUpperCase() === upper));
}

/** Find risks for a system */
export function findRisksForSystem(system: string): SupportRisk[] {
  return ALL_RISKS.filter(r => r.system.toLowerCase() === system.toLowerCase());
}

/** Find recommendations for a risk */
export function findRecommendationsForRisk(riskId: string, level?: string): SupportRecommendation[] {
  return ALL_RECOMMENDATIONS.filter(r => r.relatedId === riskId && (!level || r.level === level));
}

/** Find recommendations by type */
export function findRecommendationsByType(type: string): SupportRecommendation[] {
  return ALL_RECOMMENDATIONS.filter(r => r.type === type);
}

/** Find synergies between given substance IDs */
export function findSynergies(substanceIds: string[]): { interaction: SupportInteraction; substances: [string, string] }[] {
  const result: { interaction: SupportInteraction; substances: [string, string] }[] = [];
  for (const interaction of ALL_INTERACTIONS) {
    if (interaction.type === 'synergy' && substanceIds.includes(interaction.substanceA) && substanceIds.includes(interaction.substanceB)) {
      result.push({ interaction, substances: [interaction.substanceA, interaction.substanceB] });
    }
  }
  return result;
}

/** Find conflicts between given substance IDs */
export function findConflicts(substanceIds: string[]): { interaction: SupportInteraction; substances: [string, string] }[] {
  const result: { interaction: SupportInteraction; substances: [string, string] }[] = [];
  for (const interaction of ALL_INTERACTIONS) {
    if ((interaction.type === 'conflict' || interaction.type === 'caution') && substanceIds.includes(interaction.substanceA) && substanceIds.includes(interaction.substanceB)) {
      result.push({ interaction, substances: [interaction.substanceA, interaction.substanceB] });
    }
  }
  return result;
}

/** Get substance by ID */
export function getSubstance(id: string): SupportSubstance | undefined {
  return SUPPORT_SUBSTANCE_MAP[id];
}

/** Get all substances grouped by type */
export function getSubstancesByType(): Record<string, SupportSubstance[]> {
  const groups: Record<string, SupportSubstance[]> = {};
  for (const s of ALL_SUBSTANCES) {
    if (!groups[s.type]) groups[s.type] = [];
    groups[s.type].push(s);
  }
  return groups;
}

/** Search substances by name (case-insensitive partial match) */
export function searchSubstances(query: string): SupportSubstance[] {
  const lower = query.toLowerCase();
  return ALL_SUBSTANCES.filter(s => s.name.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower));
}

/** Get all brands by country */
export function getBrandsByCountry(): Record<string, SupportBrand[]> {
  const groups: Record<string, SupportBrand[]> = {};
  for (const b of ALL_BRANDS) {
    if (!groups[b.country]) groups[b.country] = [];
    groups[b.country].push(b);
  }
  return groups;
}

/** Get recommendations for a system by severity level */
export function getSystemRecommendations(system: string, level?: string): SupportRecommendation[] {
  return ALL_RECOMMENDATIONS.filter(r => r.type === 'SYSTEM' && r.relatedId === system && (!level || r.level === level));
}

