import React, { useState, useMemo, useEffect } from 'react';
import { SYNERGY_PAIRS, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, searchSupport, getSubstanceInfo, getSupportDatabaseStats, type SupportInput, type SynergyPair, type SupplementTarget } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { INTERACTIONS_DB } from '../../data/interactions';
import { ALL_SUBSTANCES, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
import { FertilityPCTScreen } from './FertilityPCTScreen';
import { ALL_STACKS, EFFECT_LABELS_ru, findStacksByEffect, getSubstanceLabel as getStackSubLabel, type SupportStack } from '../../data/support-stacks';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_SYNERGY, PEPTIDE_CONFLICTS, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  scorePeptideStack, generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES, type PeptideInfo, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKResult,
} from '../../engines/peptide-calculator.engine';
import {
  interpretLabs, computeRiskByModel, generateMechanismReport,
  computePharmaAdjustedDose, generateTimedPlan,
  RISK_MODEL_LABELS, type RiskModelType, type LabCompositeResult,
} from '../../engines/lab-analysis.engine';
import {
  generateWeeklyPlan, RISK_METHODS, computeBasicRisk, computeOverallRisk,
  type RiskCalcMethod, type WeeklyPlan, type SupplementPlanEntry, type DailySchedule,
} from '../../engines/weekly-plan.engine';
import { generateRecommendations, quickRec, type Recommendation, type RecInput } from '../../engines/recommendation-engine-v2';
import { fuseDecisions, shouldTrainToday, type FusedDecision } from '../../engines/decision-fusion.engine';
import { optimizeStack, type StackInput as OptStackInput } from '../../engines/supplement-optimizer.engine';
import { generateStack, selectBestStack, type StackResult } from '../../engines/stack-builder.engine';
import { ReportEngine, type ReportInput } from '../../engines/report-engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../core/types';

type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
type SupportView = 'main' | 'calc' | 'fertility';
type CalcView = 'main' | 'calculator' | 'peptides' | 'info';
type InfoView = 'main' | 'catalog' | 'synergies' | 'stacks';

const SYNERGY_COLORS: Record<string, string> = {
  synergistic: '#22c55e',
  additive: '#84cc16',
  potentiative: '#3b82f6',
  complementary: '#8b5cf6',
  antagonistic: '#ef4444',
};

const SUPPORT_CLASS_LABELS: Record<string, string> = {
  support: '💊 Поддержка',
  peptide_regenerative: '🧬 Регенерация',
  peptide_nootropic: '🧠 Ноотропы',
  peptide_immune: '🛡 Иммунная',
  bady: '🌿 БАДы',
};

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SUPPORT_MED_DETAIL: Record<string, {
  description: string;
  mechanism: string;
  mechanismKeys: string[];
  systems: { key: string; label: string; mechanisms: string[] }[];
  risks: string[];
  contraindications: string[];
}> = {
  telmisartan: {
    description: '',
    mechanism: '',
    mechanismKeys: ['AT1_BLOCK', 'ALDOSTERONE_DOWN', 'BP_DOWN'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'renal', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  nebivolol: {
    description: '',
    mechanism: '',
    mechanismKeys: ['BETA1_BLOCK', 'NO_UP', 'HR_DOWN'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', '', 'NO-вазодилатация'] },
    ],
    risks: ['', '', ''],
    contraindications: ['', 'AV-блокада II-III', '', ''],
  },
  hcg: {
    description: '',
    mechanism: '',
    mechanismKeys: ['LH_MIMETIC', 'TESTOSTERONE_UP', 'HPTA_SUPPORT'],
    systems: [
      { key: 'reproductive', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  nac: {
    description: 'N-ацетилцистеин — предшественник глутатиона, главного внутриклеточного антиоксиданта. Гепатопротектор, нейропротектор, муколитик. Основа любой поддержки печени.',
    mechanism: '',
    mechanismKeys: ['GSH_UP', 'ROS_DOWN', 'DETOX_UP', 'NFkB_DOWN'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
      { key: 'neuro', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  tudca: {
    description: '',
    mechanism: '',
    mechanismKeys: ['MITO_STABILIZE', 'BILE_FLOW_UP', 'APOPTOSIS_DOWN'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', ''],
    contraindications: ['', ''],
  },
  omega3: {
    description: '',
    mechanism: 'EPA → резолвины/протектины (SPM) → разрешение воспаления; DHA → структурный компонент нейромембран; конкуренция с AA → меньше PGE2',
    mechanismKeys: ['SPM_UP', 'TG_DOWN', 'NFkB_DOWN', 'NEURO_MEMBRANE'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', '', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  magnesium: {
    description: '',
    mechanism: '',
    mechanismKeys: ['NMDA_DOWN', 'GABA_UP', 'ATPASE_UP', 'CA_CHANNELS_DOWN'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', 'AV-блокада'],
  },
  berberine: {
    description: '',
    mechanism: '',
    mechanismKeys: ['AMPK_UP', 'INSULIN_SENSITIVITY_UP', 'CYP3A4_INHIBIT', 'LDL_DOWN'],
    systems: [
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: [''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', 'CYP3A4-опосредованные взаимодействия', ''],
    contraindications: ['', '', ''],
  },
  coq10: {
    description: '',
    mechanism: '',
    mechanismKeys: ['ETC_UP', 'ATP_UP', 'ANTIOXIDANT', 'VITE_REGEN'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', '', ''] },
      { key: 'neuro', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: [''],
  },
  vitamin_d3: {
    description: '',
    mechanism: '',
    mechanismKeys: ['VDR_UP', 'CALCIUM_UP', 'IMMUNE_MOD', 'AR_UP'],
    systems: [
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  zinc: {
    description: '',
    mechanism: '',
    mechanismKeys: ['5AR_UP', 'AR_UP', 'SOD_UP', 'IMMUNE_UP'],
    systems: [
      { key: 'reproductive', label: '', mechanisms: ['', ''] },
      { key: 'hematologic', label: '', mechanisms: ['Zn-зависимый иммунитет', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  alpha_lipoic: {
    description: '',
    mechanism: '',
    mechanismKeys: ['ROS_SCAVENGE', 'GSH_REGEN', 'PDH_UP', 'MITO_UP'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', '', ''] },
      { key: 'cardio', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  ashwagandha: {
    description: 'Withania somnifera — адаптоген. Снижает кортизол, модулирует GABA, защищает нейроны, поддерживает тестостерон. Анксиолитик + нейропротектор + эндокринный модулятор.',
    mechanism: '',
    mechanismKeys: ['GABA_MOD', 'CORTISOL_DOWN', 'HPA_MOD', 'LH_UP'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', '', ''] },
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'reproductive', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  saw_palmetto: {
    description: 'Serenoa repens — ингибитор 5α-редуктазы и α1-адренорецепторов. Защита простаты, снижение DHT-опосредованных рисков, мочегонное.',
    mechanism: '',
    mechanismKeys: ['5AR_INHIBIT', 'DHT_DOWN', 'ALPHA1_BLOCK'],
    systems: [
      { key: 'reproductive', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  celery_extract: {
    description: '',
    mechanism: '',
    mechanismKeys: ['DIURESIS_UP', 'URIC_DOWN', 'NO_UP', 'KIDNEY_PROTECT'],
    systems: [
      { key: 'renal', label: '', mechanisms: ['', '', ''] },
      { key: 'cardio', label: '', mechanisms: ['', 'NO-вазодилатация'] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  vitamin_k2: {
    description: '',
    mechanism: '',
    mechanismKeys: ['GLA_UP', 'CALCIUM_TARGETING', 'BONE_UP', 'VASCULAR_PROTECT'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'endocrine', label: '', mechanisms: [''] },
      { key: 'hepatic', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: ['', ''],
  },
  selenium: {
    description: '',
    mechanism: '',
    mechanismKeys: ['GPX_UP', 'T3_UP', 'IMMUNE_UP', 'ANTIOXIDANT'],
    systems: [
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
      { key: 'neuro', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: ['', ''],
  },
  milk_thistle: {
    description: '',
    mechanism: '',
    mechanismKeys: ['MEMBRANE_STABILIZE', 'PROTEIN_SYNTHESIS_UP', 'GST_UP', 'NFkB_DOWN'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', '', '', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  probiotics: {
    description: '',
    mechanism: '',
    mechanismKeys: ['MICROBIOME_UP', 'SCFA_UP', 'IMMUNE_MOD', 'GUT_BARRIER_UP'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'hematologic', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  vitamin_b12: {
    description: '',
    mechanism: '',
    mechanismKeys: ['METHIONINE_UP', 'HCY_DOWN', 'MYELIN_UP', 'ERYTHROPOIESIS_UP'],
    systems: [
      { key: 'hematologic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', ''],
    contraindications: ['', ''],
  },
  vitamin_b6: {
    description: '',
    mechanism: 'P5P → трансаминазы, декарбоксилазы; синтез серотонина/дофамина/GABA; гем-синтез через ALA-синтазу; снижение гомоцистеина',
    mechanismKeys: ['AAT_UP', 'SEROTONIN_UP', 'GABA_UP', 'HCY_DOWN', 'HEM_UP'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'hematologic', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: ['', ''],
  },
  folate: {
    description: '5-метилтетрагидрофолат — активная форма фолиевой кислоты. Метилирование ДНК, эритропоэз, снижение гомоцистеина. Обходит MTHFR-мутации.',
    mechanism: '5-МТГФ → метильный донор для метионинсинтазы (с B12) → метилирование ДНК; тимидилат-синтаз → синтез ДНК; снижение гомоцистеина',
    mechanismKeys: ['DNA_METHYLATION_UP', 'THYMIDYLATE_UP', 'HCY_DOWN', 'RBC_UP'],
    systems: [
      { key: 'hematologic', label: '', mechanisms: ['', '', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: ['', 'B12-дефицит без одновременного B12'],
  },
  iron: {
    description: '',
    mechanism: 'Fe2+ → гем → гемоглобин/миоглобин; Fe-S-кластеры → комплексы I-III ЭТК; Fe → каталаза/пероксидаза',
    mechanismKeys: ['HEM_UP', 'O2_TRANSPORT', 'ETC_UP', 'OXYGEN_UP'],
    systems: [
      { key: 'hematologic', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', '', ''],
    contraindications: ['', '', '', ''],
  },
  copper: {
    description: '',
    mechanism: 'Cu/Zn-SOD → антиоксидант; цитохром-c-оксидаза → терминальный комплекс ЭТК; лизилоксидаза → кросслинкинг коллагена/эластина; церулоплазмин → Fe-транспорт',
    mechanismKeys: ['SOD_UP', 'ETC_UP', 'COLLAGEN_UP', 'FE_TRANSPORT'],
    systems: [
      { key: 'hematologic', label: '', mechanisms: ['', 'Cu/Zn-SOD'] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  astragalus: {
    description: '',
    mechanism: '',
    mechanismKeys: ['PODOCYTE_PROTECT', 'NFkB_DOWN', 'TGF_B1_DOWN', 'IMMUNE_UP'],
    systems: [
      { key: 'renal', label: '', mechanisms: ['', '', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  taurine: {
    description: '',
    mechanism: '',
    mechanismKeys: ['BILE_ACID_CONJUGATE', 'OSMOLYTE', 'GABA_AGONIST', 'CA_MOD', 'ANTIOXIDANT'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', 'Inotropic поддержка', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['GABA-миметический эффект', ''] },
      { key: 'renal', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  melatonin: {
    description: '',
    mechanism: 'MT1/MT2 → циркадная регуляция; проникновение в митохондрии → антиоксидант; ↓кортизол; ↑BDNF; иммуномодуляция',
    mechanismKeys: ['CIRCADIAN_UP', 'MITO_ANTIOX', 'CORTISOL_DOWN', 'BDNF_UP', 'SLEEP_UP'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', '', ''] },
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  ginseng: {
    description: '',
    mechanism: '',
    mechanismKeys: ['HPA_MOD', 'NO_UP', 'BDNF_UP', 'LH_UP', 'IMMUNE_MOD'],
    systems: [
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: ['NO-вазодилатация'] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', '', '', ''],
    contraindications: ['', '', ''],
  },
  egcg: {
    description: '',
    mechanism: '',
    mechanismKeys: ['ROS_SCAVENGE', 'FE_CHELATE', 'AMPK_UP', 'NFkB_DOWN', 'LDL_OX_DOWN'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', 'AMPK-активация'] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  curcumin: {
    description: '',
    mechanism: '',
    mechanismKeys: ['NFkB_DOWN', 'COX2_DOWN', 'AMPK_UP', 'FE_CHELATE', 'CYP3A4_INHIBIT'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
      { key: 'neuro', label: '', mechanisms: ['', 'BDNF-стимуляция'] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', 'CYP3A4-опосредованные взаимодействия (пиперин)', ''],
    contraindications: ['', '', '', ''],
  },
  phosphatidylcholine: {
    description: '',
    mechanism: '',
    mechanismKeys: ['MEMBRANE_REPAIR', 'BILE_UP', 'ACH_UP', 'VLDL_UP'],
    systems: [
      { key: 'hepatic', label: '', mechanisms: ['', '', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  l_carnitine: {
    description: 'L-карнитин — транспортёр жирных кислот в митохондрии. Кардиопротектор, нейропротектор, поддержка печени. Улучшает энергетику миокарда и скелетных мышц.',
    mechanism: '',
    mechanismKeys: ['FA_OXIDATION_UP', 'ATP_UP', 'ACETYL_COA_UP', 'MITO_UP'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
    ],
    risks: ['TMAO при высоких дозах (кишечная флора)', '', ''],
    contraindications: ['', '', ''],
  },
  glucosamine: {
    description: '',
    mechanism: '',
    mechanismKeys: ['GAG_UP', 'PROTEOGLYCAN_UP', 'HYALURONAN_UP', 'MMP_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  chondroitin: {
    description: '',
    mechanism: '',
    mechanismKeys: ['CARTILAGE_HYDRATION', 'ELASTASE_DOWN', 'COLLAGEN2_UP', 'PROTEOGLYCAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  msm: {
    description: '',
    mechanism: '',
    mechanismKeys: ['SULFUR_DONOR', 'DISULFIDE_UP', 'NFkB_DOWN', 'PGE2_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  collagen: {
    description: '',
    mechanism: '',
    mechanismKeys: ['COLLAGEN_PEPTIDES_UP', 'FIBROBLAST_UP', 'MMP13_DOWN', 'PROTEOGLYCAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', '', ''] },
    ],
    risks: ['', ''],
    contraindications: [''],
  },
  hyaluronic: {
    description: '',
    mechanism: '',
    mechanismKeys: ['WATER_BINDING', 'SYNOVIAL_UP', 'MMP_DOWN', 'HYALURONAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', ''],
    contraindications: [''],
  },
  boswellia: {
    description: '',
    mechanism: '',
    mechanismKeys: ['5LOX_DOWN', 'LEUKOTRIENE_DOWN', 'NFkB_DOWN', 'MMP_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
      { key: 'neuro', label: '', mechanisms: [''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  vitamin_c: {
    description: '',
    mechanism: '',
    mechanismKeys: ['COLLAGEN_SYNTHESIS_UP', 'ANTIOXIDANT', 'VITE_REGEN', 'CARNITINE_UP', 'IMMUNE_UP'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
      { key: 'hematologic', label: '', mechanisms: ['', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
      { key: 'neuro', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  bromelain: {
    description: '',
    mechanism: '',
    mechanismKeys: ['FIBRINOLYSIS_UP', 'PGE2_DOWN', 'NFkB_DOWN', 'CYTOKINE_MOD', 'EDEMA_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
      { key: 'cardio', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', '', ''],
    contraindications: ['', '', '', ''],
  },
  bpc157: {
    description: 'BPC-157 (Body Protection Compound) — пептид 15 а.к. из желудочного сока. Мощнейший регенератор: связки, сухожилия, хрящи, ЖКТ, нервная ткань. Ускоряет заживление в 2-3 раза.',
    mechanism: '',
    mechanismKeys: ['VEGF_UP', 'ANGIOGENESIS_UP', 'FGF_UP', 'COLLAGEN_UP', 'PI3K_AKT_UP', 'GASTRO_PROTECT'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', '', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  tb500: {
    description: 'TB-500 (тимозин β4) — пептид 43 а.к. Регулирует актин → мобильность клеток → заживление. Восстанавливает связки, сухожилия, кожу, сердечную мышцу. Синергия с BPC-157.',
    mechanism: '',
    mechanismKeys: ['ACTIN_POLYMERIZE', 'CELL_MIGRATION_UP', 'VEGF_UP', 'TGF_B1_DOWN', 'NFkB_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', '', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  meloxicam: {
    description: '',
    mechanism: '',
    mechanismKeys: ['COX2_SELECTIVE', 'PGE2_DOWN', 'ANALGESIC', 'ANTIINFLAMMATORY'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', '', ''],
    contraindications: ['', '', '', '', ''],
  },
  diclofenac: {
    description: '',
    mechanism: '',
    mechanismKeys: ['COX1_2_INHIBIT', 'PGE2_DOWN', 'ANALGESIC', 'ANTIINFLAMMATORY', 'PLATELET_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', '', '', '', ''],
    contraindications: ['', '', 'ClCr<30', '', '', '', ''],
  },
};

export const SupportScreen: React.FC<{ initialTab?: SupportTab }> = ({ initialTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<SupportTab>(initialTab || 'main');
  const [supportView, setSupportView] = useState<SupportView>('main');
  const [calcView, setCalcView] = useState<CalcView>('main');
  const [infoView, setInfoView] = useState<InfoView>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [synergyFilter, setSynergyFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [supportClassFilter, setSupportClassFilter] = useState<string>('all');
  const [supportLevel, setSupportLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [autoLevel, setAutoLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    cardio: true, hepatic: true, renal: true, neuro: true, endocrine: true, hematologic: true, reproductive: true, musculoskeletal: true,
  });
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);

  const [dbInteractions, setDbInteractions] = useState<ReturnType<typeof checkSupportInteractions> | null>(null);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<SupportSubstance[]>([]);
  const [dbStats] = useState(getSupportDatabaseStats);
  const [goalRecommendations, setGoalRecommendations] = useState<ReturnType<typeof findSupportForGoal> | null>(null);

  // Peptide calculator state
  const [pepTab, setPepTab] = useState<'peptides' | 'growth'>('peptides');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [pepAmount, setPepAmount] = useState(2);
  const [pepAmountUnit, setPepAmountUnit] = useState<'mg' | 'mcg'>('mg');
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepDoseUnit, setPepDoseUnit] = useState<'mg' | 'mcg'>('mcg');
  const [pepSyringe, setPepSyringe] = useState<string>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Mon', 'Wed', 'Fri']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepResult, setPepResult] = useState<{ dilution: DilutionResult; effective: BioavailabilityResult; pk: PKResult } | null>(null);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  // Enhanced support: risk model selection + lab analysis
  const [riskModel, setRiskModel] = useState<RiskModelType>('standard');
  const [labAnalysis, setLabAnalysis] = useState<LabCompositeResult | null>(null);
  const [mechanismReport, setMechanismReport] = useState<ReturnType<typeof generateMechanismReport> | null>(null);
  const [timedPlan, setTimedPlan] = useState<ReturnType<typeof generateTimedPlan> | null>(null);
  const [modelRiskResult, setModelRiskResult] = useState<Record<string, { raw: number; net: number }> | null>(null);
  const [riskCalcMethod, setRiskCalcMethod] = useState<RiskCalcMethod>('basic');
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);

  const SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[] }> = {
    basic: { label: 'Базовый', desc: 'Минимум для здоровья', subs: ['nac', 'omega3', 'vitamin_d3'] },
    standard: { label: 'Стандартный', desc: 'Стандартная поддержка курса', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'vitamin_k2', 'vitamin_b12', 'glucosamine', 'collagen'] },
    enhanced: { label: 'Расширенный', desc: 'Полная поддержка курса', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'vitamin_k2', 'selenium', 'milk_thistle', 'vitamin_b12', 'folate', 'taurine', 'glucosamine', 'msm', 'collagen', 'vitamin_c', 'bpc157'] },
    maximum: { label: 'Максимальный', desc: 'Максимальная защита и регенерация', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'telmisartan', 'nebivolol', 'saw_palmetto', 'hcg', 'vitamin_k2', 'selenium', 'milk_thistle', 'probiotics', 'vitamin_b12', 'folate', 'iron', 'copper', 'astragalus', 'taurine', 'melatonin', 'ginseng', 'egcg', 'curcumin', 'phosphatidylcholine', 'l_carnitine', 'glucosamine', 'chondroitin', 'msm', 'collagen', 'hyaluronic', 'boswellia', 'vitamin_c', 'bromelain', 'bpc157', 'tb500'] },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
    if (linked.course.length > 0) setSupportDrugs(linked.course.map(c => c.substanceId));
  }, []);

  useEffect(() => {
    const HIGH_RISK = ['trenbolone_acetate', 'trenbolone_enanthate', 'methandienone', 'stanozolol', 'oxandrolone'];
    const ORAL_17AA = ['methandienone', 'stanozolol', 'oxandrolone', 'halodrol'];
    let hasHighRisk = false, hasOral = false, count = supportDrugs.length;
    for (const id of supportDrugs) {
      if (HIGH_RISK.includes(id)) hasHighRisk = true;
      if (ORAL_17AA.includes(id)) hasOral = true;
    }
    let level: 'basic' | 'standard' | 'enhanced' | 'maximum' = 'basic';
    if (hasHighRisk || (hasOral && count >= 2)) level = 'maximum';
    else if (hasOral || count >= 3) level = 'enhanced';
    else if (count >= 1) level = 'standard';
    setAutoLevel(level);
    setSupportLevel(level);
  }, [supportDrugs]);

  const calcSupport = () => {
    const s = linked.profile?.settings;
    const input: SupportInput = {
      userId: linked.profile?.id || 'current',
      substances: supportDrugs.length > 0 ? supportDrugs : (linked.course?.map(c => c.substanceId) || []),
      goals: [supportGoal],
      labs: (linked.labs || []).map(l => ({ code: l.code, value: l.value })),
      demographics: { age: s?.age ?? 30, weight: s?.weight ?? 80, sex: (s?.sex ?? 'male') as 'male' | 'female' },
      genetics: s?.genetics,
      nutritionFactor: s?.nutritionFactor ?? 0.8,
      trainingFactor: s?.trainingFactor ?? 0.7,
      drugDoses: Object.fromEntries((linked.course || []).map(c => [c.substanceId, c.doseValue])),
    };
    const supportResult = calculateSupport(input);
    setSupportResult(supportResult);
    const allSubs = [...supportDrugs, ...SUPPORT_LEVELS[supportLevel]?.subs || []].filter(Boolean);
    setDbInteractions(checkSupportInteractions(allSubs));
    const goalRisks = supportGoal === 'muscle_gain' ? ['muscle', 'protein', 'testosterone'] : supportGoal === 'fat_loss' ? ['fat', 'metabolism', 'insulin'] : supportGoal === 'strength' ? ['strength', 'power', 'testosterone'] : supportGoal === 'endurance' ? ['endurance', 'oxygen', 'atp'] : supportGoal === 'recomp' ? ['muscle', 'fat', 'metabolism'] : ['health', 'vitamin', 'mineral'];
    setGoalRecommendations(findSupportForGoal(goalRisks, 20));

    const labData = linked.labs || [];
    const labRes = interpretLabs(labData);
    setLabAnalysis(labRes);
    const mechRep = generateMechanismReport(labRes);
    setMechanismReport(mechRep);
    setTimedPlan(generateTimedPlan(mechRep.mechanisms, supportGoal));

    const modelRisk = computeRiskByModel(riskModel, labRes,
      Object.fromEntries(['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'].map(s => [s, supportResult?.riskAssessment?.systemBreakdown?.[s]?.raw ?? 15])),
      Object.fromEntries(supportDrugs.map(() => [0, 5]).map((v, i) => [['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'][i], 5])),
      supportResult?.systemSupport ?? {}
    );
    setModelRiskResult(modelRisk);

    // Auto-generate weekly plan
    const baseWeights: Record<string, number> = {};
    const drugLoads: Record<string, number> = {};
    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
      baseWeights[sys] = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 15;
      drugLoads[sys] = supportDrugs.length * 2;
    }
    const labStress: Record<string, number> = {};
    if (labRes) {
      labStress.cardio = labRes.cardioRisk; labStress.hepatic = labRes.liverStress;
      labStress.renal = labRes.kidneyStress; labStress.endocrine = labRes.hormoneScore;
      labStress.hematologic = labRes.inflammation * 5;
    }
    const plan = generateWeeklyPlan(allSubs, riskCalcMethod, baseWeights, drugLoads, labStress, supportResult?.systemSupport ?? {});
    setWeeklyPlan(plan);
  };

  useEffect(() => { if (supportDrugs.length > 0) calcSupport(); }, [supportDrugs, supportGoal, supportLevel]);

  // Interaction checker state
  const [interactTab, setInteractTab] = useState<'support' | 'pharma'>('support');
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);
  const [pharmaInteractIds, setPharmaInteractIds] = useState<string[]>(['', '']);
  const [pharmaInteractSearch, setPharmaInteractSearch] = useState('');

  // Combine SUPPLEMENT_DESCRIPTIONS with support substances from PHARMA_DB
  const supplementList = useMemo(() => {
    const supplements = Object.entries(SUPPLEMENT_DESCRIPTIONS).map(([id, desc]) => ({
      id,
      name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: desc,
      targets: SUPPLEMENT_TARGETS[id] as SupplementTarget | undefined,
      research: SUPPORT_RESEARCH[id],
      isSupportSubstance: false,
    }));
    
    const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'] as const;
    const supportSubstances = Object.values(PHARMA_DB).filter(s => 
      supportClasses.includes(s.class as typeof supportClasses[number])
    );
    
    const supportSupplements = supportSubstances.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '' + SUPPORT_CLASS_LABELS[s.class] || s.class,
      targets: undefined,
      research: s.research || [],
      isSupportSubstance: true,
      pharmaClass: s.class,
    }));
    
    return [...supplements, ...supportSupplements];
  }, []);

  // All support substances for interaction checker
  const allSupport = useMemo(() => supplementList, [supplementList]);

  // Support-only synergy pairs
  const supportSynergies = useMemo(() => {
    return SYNERGY_PAIRS.filter(p => {
      const a = PHARMA_DB[p.substanceA];
      const b = PHARMA_DB[p.substanceB];
      const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'];
      // Include: both are support substances, or at least one is a supplement
      const aIsSupport = a ? supportClasses.includes(a.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceA] !== undefined;
      const bIsSupport = b ? supportClasses.includes(b.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceB] !== undefined;
      return aIsSupport || bIsSupport;
    });
  }, []);

  const filteredSupplements = useMemo(() => {
    let list = supplementList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (systemFilter !== 'all') {
      list = list.filter(s => s.targets?.systems?.includes(systemFilter));
    }
    if (supportClassFilter !== 'all') {
      list = list.filter(s => {
        if (s.isSupportSubstance) {
          const substance = Object.values(PHARMA_DB).find(sub => sub.id === s.id);
          return substance?.class === supportClassFilter;
        } else {
          return true;
        }
      });
    }
    return list;
  }, [supplementList, searchQuery, systemFilter, supportClassFilter]);

  const filteredSynergies = useMemo(() => {
    let pairs = supportSynergies;
    if (synergyFilter !== 'all') {
      pairs = pairs.filter(p => p.synergyType === synergyFilter);
    }
    if (systemFilter !== 'all') {
      pairs = pairs.filter(p => p.affectedSystems?.includes(systemFilter));
    }
    return pairs;
  }, [synergyFilter, systemFilter, supportSynergies]);

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO_ALL[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  // Interaction checker
  const addInteraction = () => setInteractionIds([...interactionIds, '']);
  const removeInteraction = (idx: number) => setInteractionIds(interactionIds.filter((_, i) => i !== idx));
  const updateInteraction = (idx: number, value: string) => {
    const updated = [...interactionIds];
    updated[idx] = value;
    setInteractionIds(updated);
  };
  const validInteractionIds = interactionIds.filter(Boolean);
  
  const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    try {
      return INTERACTIONS_DB.filter(i => {
        const a = i.substanceA.toUpperCase();
        const b = i.substanceB.toUpperCase();
        return validInteractionIds.some(id => {
          const up = id.toUpperCase();
          return a === up || a.includes(up) || up.includes(a);
        }) && validInteractionIds.some(id => {
          const up = id.toUpperCase();
          return b === up || b.includes(up) || up.includes(b);
        });
      });
    } catch { return []; }
  }, [interactionIds, allSupport]);

  const hasSupportInteractions = supportInteractions && supportInteractions.length > 0;
  const supportSynergiesList = supportInteractions?.filter(i => i.type === 'synergy') ?? [];
  const supportConflicts = supportInteractions?.filter(i => i.type === 'conflict') ?? [];
  const supportCautions = supportInteractions?.filter(i => i.type === 'caution') ?? [];

  return (
    <div className="screen support-screen" style={tab === 'main' ? { flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden', padding:0 } : undefined}>
      {/* ===== MAIN HERO (like LabsScreen) ===== */}
      {tab === 'main' && supportView === 'main' && (
        <div style={{ flex: 1, minHeight: 0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:'0 0 42vh', position:'relative', maxHeight:'50vh' }}>
            <img src="/support-hero.png" alt="" style={{ width:'100%', height:'100%', display:'block', objectFit:'cover', objectPosition:'center top' }} />
            <div style={{ position: 'absolute', bottom: 14, left: 20, right: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
                Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
              </p>
            </div>
          </div>
          <div style={{ flex:1, padding:'10px 16px 80px', display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>
            <div onClick={() => setSupportView('calc')} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
              background:'var(--glass-bg)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
            }}>
              <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.1)', fontSize:20 }}>🧮</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'var(--accent)' }}>Расчет поддержки</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.3 }}>Калькулятор поддержки, пептидный калькулятор, каталог, синергии и готовые стеки</div>
              </div>
              <span style={{ color:'var(--accent)', fontSize:16, opacity:0.6 }}>→</span>
            </div>
            <div onClick={() => setSupportView('fertility')} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
              background:'var(--glass-bg)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
            }}>
              <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(139,92,246,0.1)', fontSize:20 }}>🧬</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'#8b5cf6' }}>ПКТ и Фертильность</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.3 }}>Анализы, план ПКТ и восстановление фертильности</div>
              </div>
              <span style={{ color:'#8b5cf6', fontSize:16, opacity:0.6 }}>→</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUB-NAVIGATION (calc / fertility menus) ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'main' && (
        <div>
          <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:'🧮', title:'Калькулятор поддержки', desc:'Расчёт рисков, покрытия систем и недельного протокола', action:() => { setSupportView('main'); setTab('calculator'); }, color:'var(--accent)' },
              { icon:'🧬', title:'Пептидный калькулятор', desc:'Разведение, дозировки, PK модель и протоколы', action:() => { setSupportView('main'); setTab('peptides'); }, color:'var(--accent)' },
              { icon:'ℹ️', title:'Общая информация', desc:'Каталог, синергии и взаимодействия, готовые стеки', action:() => setCalcView('info'), color:'#3b82f6' },
            ].map((card, i) => (
              <div key={i} onClick={card.action} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.3 }}>{card.desc}</div>
                </div>
                <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'main' && supportView === 'calc' && calcView === 'info' && infoView === 'main' && (
        <div>
          <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:'📖', title:'Каталог', desc:'Справочник препаратов поддержки и БАДов', action:() => { setSupportView('main'); setTab('catalog'); }, color:'var(--accent)' },
              { icon:'🔗', title:'Синергии и взаимодействия', desc:'Синергии поддержки и проверка взаимодействий', action:() => { setSupportView('main'); setTab('interactions'); }, color:'#3b82f6' },
              { icon:'📦', title:'Готовые стеки', desc:'Готовые протоколы и комбинации поддержки', action:() => { setSupportView('main'); setTab('stacks'); }, color:'#8b5cf6' },
            ].map((card, i) => (
              <div key={i} onClick={card.action} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.3 }}>{card.desc}</div>
                </div>
                <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'main' && supportView === 'fertility' && (
        <div>
          <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:'🩸', title:'Анализы', desc:'Ингибин B, ФСГ, ЛГ, эстрадиол, тестостерон, прогестерон', action:() => setTab('fertility-pct'), color:'#ef4444' },
              { icon:'📋', title:'План ПКТ', desc:'Протокол послекурсовой терапии и таймер', action:() => setTab('fertility-pct'), color:'var(--accent)' },
              { icon:'🌱', title:'План восстановления Фертильности', desc:'Восстановление сперматогенеза и гормонального фона', action:() => setTab('fertility-pct'), color:'#8b5cf6' },
            ].map((card, i) => (
              <div key={i} onClick={card.action} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.3 }}>{card.desc}</div>
                </div>
                <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== NON-MAIN CONTENT (with back button) ===== */}
      {tab !== 'main' && tab !== 'fertility-pct' && (
        <>
          <button onClick={() => setTab('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную</button>

      {/* ===== CATALOG ===== */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск добавок и БАДов" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 13 }} />
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}>
              <option value="all">Все системы</option>
              {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 8px' }}>Классы:</span>
            <button onClick={() => setSupportClassFilter('all')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'all' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'all' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Все</button>
            <button onClick={() => setSupportClassFilter('support')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'support' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'support' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Поддержка</button>
            <button onClick={() => setSupportClassFilter('peptide_regenerative')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_regenerative' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_regenerative' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Регенерация</button>
            <button onClick={() => setSupportClassFilter('peptide_nootropic')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_nootropic' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_nootropic' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Ноотропы</button>
            <button onClick={() => setSupportClassFilter('peptide_immune')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_immune' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_immune' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Иммунная</button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: selectedDetail ? '0 0 280px' : 1, maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredSupplements.map(sub => (
                <div key={sub.id} onClick={() => setSelectedSub(sub.id)} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selectedSub === sub.id ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                  border: selectedSub === sub.id ? '1px solid var(--accent-green, #00e68a)' : '1px solid transparent',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {sub.targets?.systems?.slice(0, 3).map(s => systemLabels[s] || s).join(', ')}{(sub.targets?.systems?.length ?? 0) > 3 ? ' +' + (sub.targets!.systems!.length - 3) : ''}
                  </div>
                </div>
              ))}
              {filteredSupplements.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Ничего не найдено</div>}
            </div>
            {selectedDetail && (
              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{selectedDetail.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 12px 0' }}>{selectedDetail.description}</p>
                {selectedDetail.targets && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Системы:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedDetail.targets.systems?.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: 'var(--accent-green, #00e68a)' }}>{systemLabels[s] || s}</span>
                      ))}
                    </div>
                    {selectedDetail.targets.biomarkers && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Биомаркеры: {selectedDetail.targets.biomarkers.join(', ')}</div>}
                    {selectedDetail.targets.mechanisms && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Механизмы: {selectedDetail.targets.mechanisms.join(', ')}</div>}
                  </div>
                )}
                {SUPPORT_MED_DETAIL[selectedDetail.id] && (SUPPORT_MED_DETAIL[selectedDetail.id].risks.some(Boolean) || SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.some(Boolean)) && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {SUPPORT_MED_DETAIL[selectedDetail.id].risks.some(Boolean) && (
                      <div style={{ marginBottom: SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.some(Boolean) ? 8 : 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#ef4444' }}>Риски:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SUPPORT_MED_DETAIL[selectedDetail.id].risks.filter(Boolean).map((r, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.some(Boolean) && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#f59e0b' }}>Противопоказания:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.filter(Boolean).map((c, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedDetail.research && selectedDetail.research.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Исследования:</div>
                    {selectedDetail.research.map((r, ri) => (
                      <div key={ri} style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{r.conclusion}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.study} ({r.year})</div>
                      </div>
                    ))}
                  </div>
                )}
                {SYNERGY_PAIRS.filter(p => p.substanceA === selectedDetail.id || p.substanceB === selectedDetail.id).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Синергии:</div>
                {SYNERGY_PAIRS.filter(p => p.substanceA === selectedDetail.id || p.substanceB === selectedDetail.id).map((pair, i) => {
                  const partner = pair.substanceA === selectedDetail.id ? pair.substanceB : pair.substanceA;
                  const partnerName = SUPPLEMENT_DESCRIPTIONS[partner] || (partner as string).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: SYNERGY_COLORS[pair.synergyType] || '#888' }} />
                      <span style={{ fontWeight: 500 }}>{partnerName}</span>
                      <span style={{ color: SYNERGY_COLORS[pair.synergyType] || 'var(--text-dim)', fontSize: 10 }}>{pair.synergyType === 'synergistic' ? 'синергия' : pair.synergyType === 'additive' ? 'аддитивно' : pair.synergyType === 'potentiative' ? 'потенцирование' : pair.synergyType === 'complementary' ? 'дополнение' : 'антагонизм'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{(pair.strength * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SYNERGIES ===== */}
      {tab === 'synergies' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🔗 Синергии поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>
              Взаимодействия между препаратами поддержки, БАДами и добавками
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={synergyFilter} onChange={e => setSynergyFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Все типы</option>
                <option value="synergistic">Синергия</option>
                <option value="additive">Аддитивный</option>
                <option value="potentiative">Потенцирование</option>
                <option value="complementary">Комплементарный</option>
              </select>
              <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Все системы</option>
                {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                {filteredSynergies.length} пар
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredSynergies.map((pair, i) => {
              const aName = SUPPLEMENT_DESCRIPTIONS[pair.substanceA] || PHARMA_DB[pair.substanceA]?.name || pair.substanceA;
              const bName = SUPPLEMENT_DESCRIPTIONS[pair.substanceB] || PHARMA_DB[pair.substanceB]?.name || pair.substanceB;
              return (
                <div key={i} className="card" style={{ padding: 12, marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{aName}</span>
                      <span style={{ fontSize: 16, color: SYNERGY_COLORS[pair.synergyType] || '#888' }}>
                        {pair.synergyType === 'synergistic' ? '\u2295' : pair.synergyType === 'additive' ? '+' : pair.synergyType === 'potentiative' ? '\u21D1' : '\u2192'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{bName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: SYNERGY_COLORS[pair.synergyType] + '22', color: SYNERGY_COLORS[pair.synergyType] }}>
                        {pair.synergyType === 'synergistic' ? 'Синергия' : pair.synergyType === 'additive' ? 'Аддитивно' : pair.synergyType === 'potentiative' ? 'Потенцирование' : 'Дополнение'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: SYNERGY_COLORS[pair.synergyType] }}>{(pair.strength * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>{pair.mechanism}</div>
                  {pair.affectedSystems && pair.affectedSystems.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {pair.affectedSystems.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.08)', color: 'var(--accent-green, #00e68a)' }}>{systemLabels[s] || s}</span>
                      ))}
                    </div>
                  )}
                  {pair.clinicalNote && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>{pair.clinicalNote}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CALCULATOR ===== */}
      {tab === 'calculator' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🧮 Калькулятор поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Расчёт индекса поддержки и снижения рисков на основе всех источников: препараты, анализы, питание, тренировки, генетика
            </p>
            <button onClick={calcSupport} style={{
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 15,
              boxShadow: '0 2px 8px rgba(0,230,138,0.3)',
            }}>
              Рассчитать поддержку
            </button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>Цель</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[{ v: 'muscle_gain', l: 'Масса' }, { v: 'fat_loss', l: 'Сушка' }, { v: 'strength', l: 'Сила' }, { v: 'endurance', l: 'Выносливость' }, { v: 'recomp', l: 'Рекомпозиция' }, { v: 'maintenance', l: 'Поддержание' }].map(g => (
                <button key={g.v} onClick={() => setSupportGoal(g.v)} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: supportGoal === g.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: supportGoal === g.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: supportGoal === g.v ? '#00e68a' : 'var(--text-dim)', fontWeight: supportGoal === g.v ? 700 : 400,
                }}>{g.l}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              Препаратов: <b style={{ color: 'var(--accent)' }}>{linked.course.length}</b> | Авто-уровень: <b style={{ color: '#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel]?.label || autoLevel}</b>
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {(['basic', 'standard', 'enhanced', 'maximum'] as const).map(l => (
                  <button key={l} onClick={() => setSupportLevel(l)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                    background: supportLevel === l ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                    border: supportLevel === l ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: supportLevel === l ? '#00e68a' : 'var(--text-dim)', fontWeight: supportLevel === l ? 700 : 400,
                  }}>{SUPPORT_LEVELS[l]?.label}</button>
                ))}
              </div>
            </div>
          </div>

          {supportResult && (
            <>
              <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Индекс поддержки</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: (supportResult.supportScore ?? 100) > 70 ? '#22c55e' : (supportResult.supportScore ?? 100) > 40 ? '#eab308' : '#ef4444', lineHeight: 1 }}>
                  {Math.round(supportResult.supportScore ?? 0)}%
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, supportResult.supportScore ?? 0)}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e)', borderRadius: 6 }} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📊 Риски — до и после поддержки</h4>
                {ALL_RISK_SYSTEMS.slice(0, 8).map(sys => {
                  const before = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 0;
                  const after = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.net ?? 0;
                  const reduction = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border-color)', fontSize: 11 }}>
                      <span style={{ fontSize: 13, minWidth: 18 }}>{SYSTEM_INFO_ALL[sys]?.icon || ''}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{systemLabels[sys]}</span>
                      <span style={{ fontSize: 10, color: getRiskColor(before), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(before)}%</span>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>→</span>
                      <span style={{ fontSize: 10, color: getRiskColor(after), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(after)}%</span>
                      {reduction > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>↓{reduction}%</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🛡 Покрытие систем</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(activeSystems).map(([sys, _]) => {
                    const cov = supportResult?.systemSupport?.[sys] ?? 0;
                    const pct = Math.round(cov * 100);
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
                        <span style={{ fontSize: 10, flex: 1 }}>{systemLabels[sys] || sys}</span>
                        <div style={{ width: 35, background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📋 Рекомендованные добавки</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {SUPPORT_LEVELS[supportLevel]?.subs?.slice(0, 15).map(id => (
                    <span key={id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>
                      {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>💊 Оптимизатор стека</h4>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Подбирает защиту органов под ваш курс препаратов</p>
                <OptimizerSection drugs={supportDrugs} />
              </div>

              {/* ===== RISK MODEL SELECTION ===== */}
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚙ Модель расчёта рисков</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {(Object.entries(RISK_MODEL_LABELS) as [RiskModelType, string][]).map(([k, v]) => (
                    <button key={k} onClick={() => { setRiskModel(k); if (supportResult) calcSupport(); }} style={{
                      padding: '6px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', textAlign: 'left',
                      background: riskModel === k ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: riskModel === k ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: riskModel === k ? '#00e68a' : 'var(--text-dim)', fontWeight: riskModel === k ? 700 : 400,
                    }}>{v}</button>
                  ))}
                </div>
              </div>

              {/* ===== RISK CALCULATION METHOD ===== */}
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧮 Метод расчёта</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {RISK_METHODS.map(m => (
                    <button key={m.id} onClick={() => setRiskCalcMethod(m.id)} style={{
                      padding: '8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', textAlign: 'left',
                      background: riskCalcMethod === m.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                      border: riskCalcMethod === m.id ? '1px solid #8b5cf6' : '1px solid var(--border)',
                      color: riskCalcMethod === m.id ? '#8b5cf6' : 'var(--text-dim)', fontWeight: riskCalcMethod === m.id ? 700 : 400,
                    }}>
                      <span style={{ fontSize: 16 }}>{m.emoji}</span> {m.label}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== GENERATE WEEKLY PLAN ===== */}
              <button onClick={calcSupport} style={{
                width: '100%', padding: 14, borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 12,
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 700, fontSize: 15,
                boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
              }}>
                📅 Сгенерировать недельный план
              </button>

              {/* ===== WEEKLY PLAN DISPLAY ===== */}
              {weeklyPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>
                    📅 Недельный план ({RISK_METHODS.find(m => m.id === weeklyPlan.riskMethod)?.label || weeklyPlan.riskMethod})
                  </h4>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Риск сейчас: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.current > 60 ? '#ef4444' : weeklyPlan.overallRisk.current > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.current}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Прогноз: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.projected > 60 ? '#ef4444' : weeklyPlan.overallRisk.projected > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.projected}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Снижение: </span>
                      <span style={{ fontWeight: 700, color: '#22c55e' }}>↓{weeklyPlan.overallRisk.reduction}%</span>
                    </div>
                  </div>

                  {/* Systems coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🛡 Покрытие систем</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {weeklyPlan.coveredSystems.map(cs => (
                        <span key={cs.system} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                          {cs.label}: {cs.coverage}% ({cs.substances.length} преп.)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Organs coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🫀 Покрытие органов</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {weeklyPlan.coveredOrgans.slice(0, 10).map(co => (
                        <span key={co.organ} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                          {co.label}: {co.coverage}%
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mechanisms */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🧬 Ключевые механизмы</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {weeklyPlan.keyMechanisms.map(km => (
                        <span key={km.name} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                          {km.label} ({km.substances.length})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Synergies */}
                  {weeklyPlan.synergyPairs.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🔗 Синергии в стеке</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {weeklyPlan.synergyPairs.map((pair, i) => (
                          <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            {pair.a}+{pair.b} (+{pair.score})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Daily schedule tabs */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto' }}>
                    {weeklyPlan.schedules.map((day, di) => (
                      <button key={di} onClick={() => {
                        const el = document.getElementById(`ws-day-${di}`);
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }} style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: day.riskLevel > 60 ? 'rgba(239,68,68,0.1)' : day.riskLevel > 30 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${day.riskLevel > 60 ? 'rgba(239,68,68,0.3)' : day.riskLevel > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        color: day.riskLevel > 60 ? '#ef4444' : day.riskLevel > 30 ? '#f59e0b' : '#22c55e',
                      }}>
                        {day.dayLabel} {day.riskLevel}%
                      </button>
                    ))}
                  </div>

                  {/* Daily details */}
                  {weeklyPlan.schedules.map((day, di) => {
                    const timeSlots: { key: string; label: string; color: string; items: SupplementPlanEntry[] }[] = [
                      { key: 'emptyStomach', label: '🌅 Натощак', color: '#f59e0b', items: day.emptyStomach },
                      { key: 'morning', label: '☀️ Утро', color: '#3b82f6', items: day.morning },
                      { key: 'lunch', label: '🍽 Обед', color: '#22c55e', items: day.lunch },
                      { key: 'evening', label: '🌆 Вечер', color: '#8b5cf6', items: day.evening },
                      { key: 'night', label: '🌙 На ночь', color: '#6366f1', items: day.night },
                    ];
                    return (
                      <div key={di} id={`ws-day-${di}`} style={{ marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{day.dayLabel} — {day.date}</span>
                          <span style={{ color: day.riskLevel > 60 ? '#ef4444' : day.riskLevel > 30 ? '#f59e0b' : '#22c55e', fontSize: 10 }}>Риск: {day.riskLevel}%</span>
                        </div>
                        {timeSlots.map(ts => ts.items.length > 0 && (
                          <div key={ts.key} style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: ts.color, fontWeight: 600 }}>{ts.label}</div>
                            {ts.items.map((item, ii) => (
                              <div key={ii} style={{ marginLeft: 8, fontSize: 9, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-light)' }}>{item.name}</span>
                                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>{item.doseSuggestion}</span>
                                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                                  {item.mechanismRu} → {item.organLabels.join(', ')} → {item.systemLabels.join(', ')}
                                  {item.synergies.length > 0 && <span style={{ color: '#22c55e', marginLeft: 4 }}>⊕ {item.synergies.map(s => s.partnerName).join(', ')}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===== LAB ANALYSIS SUMMARY ===== */}
              {labAnalysis && (linked.labs?.length ?? 0) > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧪 Сводка анализов</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 10 }}>
                    {labAnalysis.homaIR !== null && (
                      <>
                        <span style={{ color: 'var(--text-dim)' }}>HOMA-IR:</span>
                        <span style={{ fontWeight: 600, color: labAnalysis.homaIR > 2.5 ? '#ef4444' : labAnalysis.homaIR > 1.5 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.homaIR.toFixed(2)} {labAnalysis.homaIR > 2.5 ? '⚠️ Инсулинорезистентность' : labAnalysis.homaIR > 1.5 ? '⚡ Пограничный' : '✅ Норма'}</span>
                      </>
                    )}
                    <span style={{ color: 'var(--text-dim)' }}>Печёночная нагрузка:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.liverStress > 60 ? '#ef4444' : labAnalysis.liverStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.liverStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Кардиориск:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.cardioRisk > 60 ? '#ef4444' : labAnalysis.cardioRisk > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.cardioRisk}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Воспаление:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.inflammation > 6 ? '#ef4444' : labAnalysis.inflammation > 3 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.inflammation.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-dim)' }}>Почечная нагрузка:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.kidneyStress > 60 ? '#ef4444' : labAnalysis.kidneyStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.kidneyStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Гормональный счёт:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.hormoneScore > 60 ? '#ef4444' : labAnalysis.hormoneScore > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.hormoneScore}%</span>
                  </div>
                  {labAnalysis.interpretations.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>Найдены отклонения ({labAnalysis.interpretations.length}):</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {labAnalysis.interpretations.slice(0, 8).map((interp, i) => (
                          <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3,
                            background: interp.status === 'critical_high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)',
                            color: interp.status === 'critical_high' ? '#ef4444' : '#f59e0b',
                          }}>{interp.mechanism.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== MECHANISM REPORT ===== */}
              {mechanismReport && mechanismReport.mechanisms.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧬 Механизмы → Органы → Риски</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {mechanismReport.mechanisms.slice(0, 6).map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>{m.name.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--text-dim)' }}>→</span>
                        <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{m.organ}</span>
                        <span style={{ color: 'var(--text-dim)' }}>→</span>
                        <span style={{ fontSize: 9, background: 'rgba(0,230,138,0.08)', padding: '1px 4px', borderRadius: 3 }}>{m.system}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: m.activation > 80 ? '#ef4444' : '#f59e0b' }}>{m.activation}%</span>
                      </div>
                    ))}
                  </div>
                  {mechanismReport.topRisks.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Топ рисков: </span>
                      {mechanismReport.topRisks.map((r, i) => (
                        <span key={i} style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, marginLeft: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r.system}:{r.risk} {r.percent}%</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===== MODEL-BASED RISK (when not standard) ===== */}
              {modelRiskResult && riskModel !== 'standard' && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📊 Риски по модели: {RISK_MODEL_LABELS[riskModel].split(' ')[1]}</h4>
                  {Object.entries(modelRiskResult).map(([sys, data]) => (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid var(--border-color)', fontSize: 10 }}>
                      <span style={{ flex: 1 }}>{systemLabels[sys] || sys}</span>
                      <span style={{ color: getRiskColor(data.raw), fontWeight: 600 }}>{data.raw}%</span>
                      <span style={{ color: 'var(--text-dim)' }}>→</span>
                      <span style={{ color: getRiskColor(data.net), fontWeight: 600 }}>{data.net}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== TIMED PLAN ===== */}
              {timedPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🕐 План по времени суток</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>🌅 Утро (стимуляция)</div>
                      {timedPlan.morning.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600, marginBottom: 3 }}>☀️ День (поддержка)</div>
                      {timedPlan.day.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 600, marginBottom: 3 }}>🌙 Вечер (восстановление)</div>
                      {timedPlan.evening.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
                <div style={{ marginBottom: 2 }}>
                  <b>Общий риск:</b> до <span style={{ color: getRiskColor(supportResult?.riskBeforeSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskBeforeSupport ?? 0)}%</span>
                  {' → '}после <span style={{ color: getRiskColor(supportResult?.riskAfterSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskAfterSupport ?? 0)}%</span>
                </div>
                <div>Источники: {linked.course.length} препаратов, {linked.labs.length} анализов, питание, тренировки{linked.profile?.settings?.genetics ? ', генетика' : ''}</div>
                <div style={{ marginTop: 4, color: '#8b5cf6', fontSize: 9 }}>База: {dbStats.totalSubstances} веществ, {dbStats.totalInteractions} взаимодействий, {dbStats.totalRisks} рисков</div>
              </div>

              {dbInteractions && (dbInteractions.synergies.length > 0 || dbInteractions.conflicts.length > 0 || dbInteractions.cautions.length > 0) && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚡ Взаимодействия в вашем стеке</h4>
                  {dbInteractions.conflicts.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ Конфликты ({dbInteractions.conflicts.length}):</span>
                      {dbInteractions.conflicts.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#ef4444', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.cautions.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>⚡ Осторожность ({dbInteractions.cautions.length}):</span>
                      {dbInteractions.cautions.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#f59e0b', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.synergies.length > 0 && (
                    <div>
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>✅ Синергии ({dbInteractions.synergies.length}):</span>
                      {dbInteractions.synergies.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#22c55e', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {goalRecommendations && goalRecommendations.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🎯 Рекомендации для цели ({supportGoal === 'muscle_gain' ? 'масса' : supportGoal === 'fat_loss' ? 'сушка' : supportGoal === 'strength' ? 'сила' : supportGoal === 'endurance' ? 'выносливость' : supportGoal === 'recomp' ? 'рекомпозиция' : 'поддержание'})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {goalRecommendations.slice(0, 15).map(({ substance, relevanceScore }) => (
                      <div key={substance.id} style={{
                        padding: '4px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600,
                        background: relevanceScore > 2 ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
                        border: relevanceScore > 2 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(139,92,246,0.3)',
                        color: relevanceScore > 2 ? '#00e68a' : '#8b5cf6',
                        cursor: 'pointer',
                      }} title={`${substance.name}: ${substance.description}`}>
                        {substance.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🔍 Поиск по базе ({dbStats.totalSubstances} веществ)</h4>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={dbSearchQuery}
                    onChange={e => { setDbSearchQuery(e.target.value); setDbSearchResults(e.target.value.length > 1 ? searchSupport(e.target.value) : []); }}
                    placeholder=""
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
                  />
                </div>
                {dbSearchResults.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dbSearchResults.slice(0, 20).map(sub => (
                      <div key={sub.id} style={{
                        padding: '6px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      }}>
                        <span style={{ fontWeight: 600 }}>{sub.name}</span>
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{sub.type} · {sub.categories.slice(0, 2).join(', ')}</span>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{sub.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {dbSearchQuery.length > 1 && dbSearchResults.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>Ничего не найдено</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== INTERACTIONS ===== */}
      {tab === 'interactions' && (
        <div>
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            {(['support','pharma'] as const).map(t => (
              <button key={t} onClick={() => setInteractTab(t)} style={{
                padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                cursor:'pointer',
                background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: interactTab === t ? '#000' : 'var(--text-dim)',
                border: `1px solid ${interactTab === t ? 'var(--accent)' : 'var(--border)'}`,
              }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
            ))}
          </div>

          {interactTab === 'support' ? (<>
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 12,
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>⚡ Взаимодействия поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Проверка синергий и конфликтов между препаратами поддержки и БАДами
            </p>
          </div>
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {interactionIds.map((id, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 18, fontWeight: 600 }}>#{idx + 1}</div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="text" value={interactionSearchIdx === idx ? interactionSearch : id ? (allSupport.find(s => s.id === id)?.name || id) : ''}
                        placeholder="🔍 Поиск препарата..."
                        onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }}
                        onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); if (!e.target.value) updateInteraction(idx, ''); }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                      {interactionSearch && interactionSearchIdx === idx && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', marginTop: 2 }}>
                          {allSupport.filter(s => s.name.toLowerCase().includes(interactionSearch.toLowerCase()) || s.id.toLowerCase().includes(interactionSearch.toLowerCase())).map(s => (
                            <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); }}
                              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: id === s.id ? 700 : 400, color: id === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{s.id}</span>
                            </div>
                          ))}
                          {allSupport.filter(s => s.name.toLowerCase().includes(interactionSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>Ничего не найдено</div>
                          )}
                </div>
              )}

                    </div>
                    {interactionIds.length > 2 && (
                      <button onClick={() => removeInteraction(idx)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                      }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {supportResult && <ReportSummaryCard supportResult={supportResult} />}
            <button onClick={addInteraction} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a',
            }}>+ Добавить препарат</button>
          </div>

          {validInteractionIds.length < 2 && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Выберите минимум 2 препарата поддержки для проверки взаимодействий</div>
            </div>
          )}

          {validInteractionIds.length >= 2 && !hasSupportInteractions && (
            <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.05)' }}>
              <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>✓ Критических взаимодействий не обнаружено</div>
            </div>
          )}

          {hasSupportInteractions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {supportSynergiesList.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#22c55e' }}>⊕ Синергия ({supportSynergiesList.length})</h4>
                  {supportSynergiesList.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
              {supportConflicts.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ef4444' }}>⚠ Конфликты ({supportConflicts.length})</h4>
                  {supportConflicts.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
              {supportCautions.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ff9800' }}>⚡ Осторожность ({supportCautions.length})</h4>
              {supportCautions.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#ff9800', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}</>) : (
          /* ─── PHARMA INTERACTIONS ─── */
          <div>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>💉 Взаимодействия фармы</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Проверка синергий и конфликтов между фармакологическими препаратами</p>
            </div>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {(() => {
                  const PHARMA_CORE_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','pct_serm','pct_aromatase','pct_dopamine','pct_gonadotropin']);
                  const pharmaAll = Object.values(PHARMA_DB).filter((s): s is (typeof PHARMA_DB)[string] => !!s?.name && PHARMA_CORE_FILTER.has(s.class));
                  const pharmaFiltered = pharmaInteractSearch ? pharmaAll.filter(s => s.name.toLowerCase().includes(pharmaInteractSearch.toLowerCase())) : pharmaAll;
                  const pharmaValid = pharmaInteractIds.filter(Boolean);
                  return (
                    <>
                      {pharmaInteractIds.map((id, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 18, fontWeight: 600, marginTop: 8 }}>#{idx + 1}</div>
                          <div style={{ flex: 1, position:'relative' }}>
                            <input type="text" value={id ? (PHARMA_DB[id]?.name || '') : pharmaInteractSearch} onChange={e => { setPharmaInteractSearch(e.target.value); if (!e.target.value) { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }}} placeholder="🔍 Поиск..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
                            {!id && pharmaInteractSearch && (
                              <div style={{ position:'absolute', zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, maxHeight:140, overflowY:'auto', marginTop:2, width:'calc(100% - 2px)' }}>
                                {pharmaFiltered.map(s => (
                                  <div key={s.id} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = s.id; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'6px 10px', cursor:'pointer', fontSize:11, borderBottom:'1px solid var(--border)' }}>
                                    <span style={{ fontWeight:600 }}>{s.name}</span>
                                    <span style={{ marginLeft:6, color:'var(--text-dim)', fontSize:9 }}>{s.class}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {pharmaInteractIds.length > 2 && <button onClick={() => setPharmaInteractIds(pharmaInteractIds.filter((_, ix) => ix !== idx))} style={{ padding:'4px 8px', borderRadius:6, fontSize:11, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', marginTop:4 }}>✕</button>}
                        </div>
                      ))}
                      <button onClick={() => setPharmaInteractIds([...pharmaInteractIds, ''])} style={{ padding:'8px 16px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>+ Добавить препарат</button>
                      {pharmaValid.length >= 2 && (
                        <div style={{ marginTop: 8 }}>
                          {checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).map((alert, i) => {
                            const c = alert.type === 'critical' ? '#ff1744' : alert.type === 'warning' ? '#ff9100' : '#2979ff';
                            return <div key={i} style={{ borderLeft:`4px solid ${c}`, borderRadius:8, padding:'10px 12px', marginBottom:6, background:`${c}18`, border:`1px solid ${c}40` }}>
                              <div style={{ fontWeight:700, fontSize:10, color:c, marginBottom:4 }}>{alert.type === 'critical' ? '⚠ КРИТИЧЕСКОЕ' : alert.type === 'warning' ? '⚠ ПРЕДУПРЕЖДЕНИЕ' : 'ℹ ИНФО'}</div>
                              <div style={{ fontSize:11, color:'var(--text)', marginBottom:4 }}>{alert.drugs.join(' + ')}</div>
                              <div style={{ fontSize:10, color:'var(--text-dim)' }}><b>Механизм:</b> {alert.mechanism}</div>
                              <div style={{ fontSize:10, color:'var(--text-dim)' }}><b>Рекомендация:</b> {alert.recommendation}</div>
                            </div>;
                          })}
                        </div>
                      )}
                      {pharmaValid.length >= 2 && checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).length === 0 && (
                        <div style={{ marginTop:8, padding:'12px', borderRadius:8, background:'rgba(0,230,138,0.08)', textAlign:'center' }}>
                          <span style={{ fontSize:11, color:'#4caf50', fontWeight:600 }}>✓ Критических взаимодействий не обнаружено</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* ===== STACKS ===== */}
      {tab === 'stacks' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>📦 Готовые стеки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
              {ALL_STACKS.length} оптимизированных комбинаций добавок с рассчитанной оценкой синергии
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
            {ALL_STACKS.map(stack => (
              <div key={stack.id} className="card" style={{ padding: 12, marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {stack.effects.map(e => (
                      <span key={e} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontWeight: 500 }}>
                        {EFFECT_LABELS_ru[e] || e}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: stack.synergyScore > 20 ? '#22c55e' : stack.synergyScore > 12 ? '#eab308' : '#f59e0b' }}>
                    {stack.synergyScore.toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {stack.substances.map(sid => (
                    <span key={sid} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', fontWeight: 600 }}>
                      {getStackSubLabel(sid)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {stack.substances.length} веществ · оценка синергии: {stack.synergyScore.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
          <StackBuilderSection />
        </div>
      )}

      {/* ===== PEPTIDES ===== */}
      {tab === 'peptides' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🧬 Пептидный калькулятор</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Расчёт разведения, дозировки, PK‑модели и рисков для пептидов и факторов роста</p>
          </div>

          {/* Unified peptide + growth factor selector */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxHeight:160, overflowY:'auto' }}>
              {PEPTIDE_LIST.map(p => {
                const sel = peptideId === p.id;
                return <div key={p.id} onClick={() => { setPeptideId(p.id); const pd = PEPTIDE_DB[p.id]; if (pd) { setPepAmount(pd.amountMg); setPepRoute(pd.routes[0]); setPepResult(null); setGrowthId(null); }}} style={{
                  padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
                  background: sel ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: sel ? '1.5px solid #00e68a' : '1px solid var(--border)',
                  color: sel ? '#00e68a' : 'var(--text)', fontWeight: sel ? 700 : 400,
                }}>{p.shortName}</div>;
              })}
              {(() => {
                const GROWTH_CLASSES = new Set(['peptide_ghrh','peptide_ghrp','igf1','mgf','insulin','peptide_gnrh','peptide_fat_loss','peptide_other','peptide_regenerative','peptide_immune','peptide_nootropic','pct_gonadotropin']);
                const inPeptideDb = new Set(PEPTIDE_LIST.map(p => PEPTIDE_DB[p.id]?.name.toLowerCase()));
                return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has(s.name.toLowerCase())).map(s => {
                  const sel = growthId === s.id;
                  return <div key={s.id} onClick={() => { setGrowthId(s.id); setPepResult(null); }} style={{
                    padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
                    background: sel ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                    border: sel ? '1.5px solid #8b5cf6' : '1px solid var(--border)',
                    color: sel ? '#8b5cf6' : 'var(--text)', fontWeight: sel ? 700 : 400,
                  }}>{s.name}</div>;
                });
              })()}
            </div>
            {PEPTIDE_DB[peptideId] && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                {PEPTIDE_DB[peptideId].effects.map(e => (
                  <span key={e} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{e}</span>
                ))}
              </div>
            )}
            {growthId && PHARMA_DB[growthId] && (
              <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(139,92,246,0.06)', borderRadius:8, fontSize:10, color:'var(--text-dim)', lineHeight:1.6 }}>
                <b>{PHARMA_DB[growthId].name}</b> — T½ {(PHARMA_DB[growthId].pk?.halfLifeHours ?? 0).toFixed(0)}ч, био {(PHARMA_DB[growthId].pk?.bioavailability ?? 0) * 100}%
              </div>
            )}
          </div>

          {/* Dilution calculator */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>💧 Разведение</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Во флаконе</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepAmount} onChange={e => setPepAmount(Number(e.target.value))} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepAmountUnit} onChange={e => setPepAmountUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mg">мг</option><option value="mcg">мкг</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Растворитель (мл)</label>
                <input type="number" step="0.1" value={pepDilution} onChange={e => setPepDilution(Number(e.target.value))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Доза</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepDose} onChange={e => setPepDose(Number(e.target.value))} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepDoseUnit} onChange={e => setPepDoseUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mcg">мкг</option><option value="mg">мг</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Шприц</label>
                <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as keyof typeof SYRINGE_TYPES)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Способ введения</label>
                <select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Course parameters */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>📅 Параметры курса</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {WEEK.map(d => (
                <button key={d} onClick={() => setPepSchedule(pepSchedule.includes(d) ? pepSchedule.filter(x => x !== d) : [...pepSchedule, d].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)))} style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
                  background: pepSchedule.includes(d) ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                  border: pepSchedule.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: pepSchedule.includes(d) ? '#00e68a' : 'var(--text-dim)', fontWeight: pepSchedule.includes(d) ? 700 : 400,
                }}>{d === 'Mon' ? 'Пн' : d === 'Tue' ? 'Вт' : d === 'Wed' ? 'Ср' : d === 'Thu' ? 'Чт' : d === 'Fri' ? 'Пт' : d === 'Sat' ? 'Сб' : 'Вс'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длительность (дни):</label>
              <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(Number(e.target.value))} style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Инъекций: {pepSchedule.length}/нед</span>
            </div>
          </div>

          {/* Calculate button */}
          <button onClick={() => {
            const pep = PEPTIDE_DB[peptideId];
            if (!pep) return;
            const bio = pep.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
            const dilInput: DilutionInput = {
              amountValue: pepAmount, amountUnit: pepAmountUnit,
              dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: pepDoseUnit,
              syringeType: pepSyringe as DilutionInput['syringeType'],
            };
            const dilution = computeDilution(dilInput);
            const effective = computeEffectiveDose(dilution.doseMcg, bio);
            const pk = computePK({
              doseMcg: dilution.doseMcg, bioAvg: bio.avg,
              tHalfHours: pep.tHalfHours, scheduleDays: pepSchedule, totalDays: pepTotalDays,
            });
            setPepResult({ dilution, effective, pk });
          }} style={{
            width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 12,
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 700, fontSize: 15,
            boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
          }}>
            🧬 Рассчитать
          </button>

          {/* Results */}
          {pepResult && (
            <>
              {/* Dilution results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>📊 Результаты разведения</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</span>
                  <span style={{ color: 'var(--text-dim)' }}>Объём дозы:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.doseVolumeMl.toFixed(3)} мл</span>
                  <span style={{ color: 'var(--text-dim)' }}>Деления шприца:</span><span style={{ fontWeight: 600, color: pepResult.dilution.syringeUnits > SYRINGE_TYPES[pepSyringe].maxUnits ? '#ef4444' : 'var(--text-light)' }}>{pepResult.dilution.syringeUnitsDisplay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Доз во флаконе:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.dosesPerVial.toFixed(1)}</span>
                </div>
              </div>

              {/* Bioavailability */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>💉 Биодоступность ({ROUTE_LABELS[pepRoute]})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Мин</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMinMcg.toFixed(0)} мкг</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.1)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Средняя</div>
                    <div style={{ fontWeight: 700, color: '#00e68a' }}>{pepResult.effective.effectiveAvgMcg.toFixed(0)} мкг</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Макс</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMaxMcg.toFixed(0)} мкг</div>
                  </div>
                </div>
              </div>

              {/* PK Results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📈 PK‑модель</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Макс. концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.maxConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Средняя концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.avgConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Steady-state (день):</span><span style={{ fontWeight: 600 }}>~{pepResult.pk.steadyStateDay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>t<sub>1/2</sub> (дни):</span><span style={{ fontWeight: 600 }}>{pepResult.pk.halfLifeDays.toFixed(2)}</span>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '2px 4px', textAlign: 'left' }}>День</th>
                        <th style={{ padding: '2px 4px' }}>Инъекция</th>
                        <th style={{ padding: '2px 4px', textAlign: 'right' }}>Конц.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pepResult.pk.days.map(d => (
                        <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: d.inject ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                          <td style={{ padding: '2px 4px' }}>{d.day} ({d.weekday === 'Mon' ? 'Пн' : d.weekday === 'Tue' ? 'Вт' : d.weekday === 'Wed' ? 'Ср' : d.weekday === 'Thu' ? 'Чт' : d.weekday === 'Fri' ? 'Пт' : d.weekday === 'Sat' ? 'Сб' : 'Вс'})</td>
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>{d.inject ? '💉' : ''}</td>
                          <td style={{ padding: '2px 4px', textAlign: 'right', fontFamily: 'monospace', color: d.concentration > pepResult.pk.avgConcentration * 1.5 ? '#22c55e' : 'var(--text-light)' }}>{d.concentration.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Risks */}
              {PEPTIDE_DB[peptideId] && (
                <div className="card" style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚠ Риски: {PEPTIDE_DB[peptideId].shortName}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {computePeptideRisks(PEPTIDE_DB[peptideId]).map((r, i) => (
                      <div key={i} style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 10,
                        background: r.riskPercent > 25 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${r.riskPercent > 25 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        color: r.riskPercent > 25 ? '#ef4444' : '#f59e0b',
                      }}>
                        {r.label}: {r.riskPercent}%
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Synergies & Conflicts */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🔗 Синергии и конфликты</h4>
                {getPeptideSynergiesFor(peptideId).length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Синергии:</span>
                    {getPeptideSynergiesFor(peptideId).map(s => (
                      <span key={s.partner} style={{ fontSize: 9, marginLeft: 6, color: '#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                    ))}
                  </div>
                )}
                {getPeptideConflictsFor(peptideId).length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Конфликты:</span>
                    {getPeptideConflictsFor(peptideId).map(c => (
                      <span key={c.partner} style={{ fontSize: 9, marginLeft: 6, color: '#ef4444' }}>{c.partnerName} (severity: {c.severity})</span>
                    ))}
                  </div>
                )}
                {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</span>
                )}
              </div>
            </>
          )}

          {/* Protocol generator */}
          <div className="card">
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🎯 Генератор протокола по цели</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
                <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#8b5cf6', fontWeight: 500,
                }}>
                  {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
                </button>
              ))}
            </div>
            {pepProtocol && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{pepProtocol.goal === 'muscle_growth' ? 'Рост мышц' : pepProtocol.goal === 'fat_loss' ? 'Жиросжигание' : pepProtocol.goal === 'recovery' ? 'Восстановление' : pepProtocol.goal}: оценка синергии <span style={{ color: '#8b5cf6' }}>{pepProtocol.synergyScore.toFixed(1)}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {pepProtocol.peptides.map(p => (
                    <span key={p.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', fontWeight: 600 }}>
                      {p.shortName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* ===== FERTILITY/PCT TAB (with back button) ===== */}
      {tab === 'fertility-pct' && (
        <div>
          <button onClick={() => setTab('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную</button>
          <FertilityPCTScreen />
        </div>
      )}
    </div>
  );
};

const RecsTab: React.FC<{ profile: any; labs: any; readiness: any; course: any }> = ({ profile, labs, readiness, course }) => {
  const [recs, setRecs] = React.useState<Recommendation[]>([]);
  const [fusion, setFusion] = React.useState<FusedDecision | null>(null);
  const run = () => {
    const input: RecInput = {
      performance: { recentPR: false, strengthTrend: 5, plateauWeeks: 0, velocityLoss: 10 },
      technique: { score: 80, errors: [], romStability: 90 },
      fatigue: { acute: 8000, chronic: 7000, acwr: 1.14, monotony: 0.5, strain: 12000, cnsLoad: 5 },
      recovery: { sleepScore: 70, hrvScore: 70, subjectiveReadiness: 70, hydrationScore: 70, nutritionScore: 70 },
      body: { weightTrend: 0, bfTrend: 0, ffmi: 22 },
      training: { frequency: 4, avgIntensity: 7, volumeTrend: 5, phase: 'strength', weeksInCycle: 4 },
      risk: { overall: 30, jointFlags: [], systemicFlags: [] },
      goals: { type: 'strength', progress: 80, weeksRemaining: 8 },
      equipment: ['barbell', 'dumbbell'] as any,
      injuries: [],
      weakPoints: [],
    };
    const result = generateRecommendations(input);
    setRecs(result.recommendations.slice(0, 10));
    const fusionInput: any = { priScore: 70, riskLevel: 'moderate', riskFlags: [], techniqueScore: 80, techniqueErrors: [], fatigueScore: 30, recoveryScore: 70, acwr: 1.14, monotony: 0.5, volumeCapacity: 80, intensityCapacity: 70, trainingAge: 24, goal: 'strength', upcomingCompetition: false, injuryHistory: [], recentPR: false };
    setFusion(fuseDecisions(fusionInput));
  };
  const st = shouldTrainToday(70, 'moderate', 30, 70);
  return (<div>
    <button onClick={run} style={{ width:'100%', padding:12, borderRadius:8, border:'none', cursor:'pointer', marginBottom:10, background:'linear-gradient(135deg,#8b5cf6,#6366f1)', color:'#fff', fontWeight:700, fontSize:14 }}>💡 Сгенерировать рекомендации</button>
    <div className="card" style={{ marginBottom:8 }}><div style={{ fontSize:11, fontWeight:700, color:st.train?'#22c55e':'#ef4444' }}>{st.train ? '✅ Тренировка' : '🔴 Отдых'}</div><div style={{ fontSize:9, color:'var(--text-dim)' }}>{st.reason}</div></div>
    {fusion && <div className="card" style={{ marginBottom:8 }}><h4 style={{ margin:'0 0 4px', fontSize:12 }}>🎯 Fusion Decision</h4><div style={{ fontSize:9 }}>{fusion.overallRecommendation}</div></div>}
    {recs.map((r,i) => <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600, fontSize:11, color: r.severity === 'critical' ? '#ef4444' : r.severity === 'high' ? '#f59e0b' : r.severity === 'medium' ? '#f97316' : '#22c55e' }}>{r.title}</div>
      <div style={{ fontSize:9, color:'var(--text-light)' }}>{r.message}</div>
      {r.actionItems?.map((a:any,ai:number)=><div key={ai} style={{ fontSize:8, color:'var(--text-dim)', marginLeft:6 }}>• {a}</div>)}
    </div>)}
  </div>);
};

const OptimizerSection: React.FC<{ drugs: string[] }> = ({ drugs }) => {
  const [optResult, setOptResult] = React.useState<any>(null);
  const run = () => {
    const input: OptStackInput = { compounds: drugs.length > 0 ? drugs : ['testosterone'], riskLevels: { hepatic:'medium',renal:'low',cardiac:'low',lipids:'medium',bp:'low',prostate:'low',cns:'low',blood:'low',joints:'low' }, hasOrals: false, has19nor: false, hasTren: false, hasGH: false, hasInsulin: false, goal: 'strength' };
    setOptResult(optimizeStack(input));
  };
  React.useEffect(() => { if (drugs.length > 0) run(); }, [drugs]);
  return (<div>
    {optResult && <div style={{ maxHeight:250,overflowY:'auto' }}>
      {optResult.essential?.length > 0 && <div style={{ marginBottom:4 }}><div style={{ fontSize:9,fontWeight:600,color:'#ef4444' }}>🔴 Обязательно</div>{optResult.essential.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} — {r.dosage} {r.timing}</div>)}</div>}
      {optResult.recommended?.length > 0 && <div style={{ marginBottom:4 }}><div style={{ fontSize:9,fontWeight:600,color:'#f59e0b' }}>🟠 Рекомендовано</div>{optResult.recommended.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} — {r.dosage} {r.timing}</div>)}</div>}
      {optResult.optional?.length > 0 && <div><div style={{ fontSize:9,fontWeight:600,color:'#22c55e' }}>🟢 Опционально</div>{optResult.optional.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} — {r.dosage} {r.timing}</div>)}</div>}
      {optResult.totalMonthlyCost && <div style={{ fontSize:8,color:'var(--text-dim)',marginTop:4 }}>💰 {optResult.totalMonthlyCost}</div>}
    </div>}
  </div>);
};

const ReportSummaryCard: React.FC<{ supportResult: any }> = ({ supportResult }) => {
  if (!supportResult) return null;
  const report = ReportEngine.generateReport({
    total_risk: Math.round(supportResult?.riskBeforeSupport || 0),
    risk_after_support: Math.round(supportResult?.riskAfterSupport || 0),
    risks: [], systems: Object.entries(supportResult?.systemSupport || {}).map(([k,v])=>({name:k,value:v})),
    organs: [], mechanisms: [], interactions: [], recommendations: [],
  });
  return (<div className="card" style={{ padding:10, marginTop:8 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 Сводка</h4>
    <div style={{ fontSize:10 }}>Риск: {report.summary.total_risk}% → {report.summary.risk_after_support}% ({report.summary.risk_level})</div>
    <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>Топ систем: {(report.summary as any).top_systems?.map((s:any)=>s.name).join(', ')}</div>
  </div>);
};

const StackBuilderSection: React.FC = () => {
  const [sbGoal, setSbGoal] = React.useState('muscle_growth');
  const [sbResult, setSbResult] = React.useState<StackResult | null>(null);
  const goals = ['muscle_growth','fat_loss','recovery','focus','sleep','mitochondria','gi_healing','immune_boost'];
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🏗 Построитель стека</h4>
    <div style={{ display:'flex',flexWrap:'wrap',gap:3,marginBottom:6 }}>
      {goals.map(g => <button key={g} onClick={()=>{setSbGoal(g);setSbResult(generateStack([g]));}} style={{ padding:'4px 8px',borderRadius:4,fontSize:9,cursor:'pointer',background:sbGoal===g?'var(--accent)':'var(--bg-secondary)',color:sbGoal===g?'#000':'var(--text-dim)',border:'none' }}>{g.replace(/_/g,' ')}</button>)}
    </div>
    {sbResult && <div>
      <div style={{ fontSize:9,color:'var(--text-dim)',marginBottom:4 }}>Score: {sbResult.score?.toFixed(1)} | Substances: {sbResult.substances.length}</div>
      <div style={{ display:'flex',flexWrap:'wrap',gap:3 }}>
        {sbResult.substances.map((s:any,i:number) => <span key={i} style={{ fontSize:8,padding:'2px 6px',borderRadius:3,background:'rgba(139,92,246,0.1)',color:'#8b5cf6' }}>{s.name || s.id}</span>)}
      </div>
    </div>}
  </div>);
};
