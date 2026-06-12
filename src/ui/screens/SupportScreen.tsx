import React, { useState, useMemo, useEffect } from 'react';
import { SYNERGY_PAIRS, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, searchSupport, getSubstanceInfo, getSupportDatabaseStats, type SupportInput, type SynergyPair, type SupplementTarget } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { INTERACTIONS_DB } from '../../data/interactions';
import { generateWeeklyProtocol } from '../../engines/auto-plan.engine';
import { ALL_SUBSTANCES, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
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
import type { CourseEntry } from '../../core/types';

type SupportTab = 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'protocol' | 'stacks' | 'peptides' | 'recs';

const SYNERGY_COLORS: Record<string, string> = {
  synergistic: '#22c55e',
  additive: '#84cc16',
  potentiative: '#3b82f6',
  complementary: '#8b5cf6',
  antagonistic: '#ef4444',
};

const SUPPORT_CLASS_LABELS: Record<string, string> = {
  support: 'СЂСџвЂ™Р‰ Р СџР С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В°',
  peptide_regenerative: 'СЂСџВ§В¬ Р В Р ВµР С–Р ВµР Р…Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ',
  peptide_nootropic: 'СЂСџВ§В  Р СњР С•Р С•РЎвЂљРЎР‚Р С•Р С—РЎвЂ№',
  peptide_immune: 'СЂСџвЂєРЋ Р ВР СР СРЎС“Р Р…Р Р…Р В°РЎРЏ',
  bady: 'СЂСџРЉС— Р вЂР С’Р вЂќРЎвЂ№',
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
      { key: 'cardio', label: '', mechanisms: ['', '', 'NO-Р Р†Р В°Р В·Р С•Р Т‘Р С‘Р В»Р В°РЎвЂљР В°РЎвЂ Р С‘РЎРЏ'] },
    ],
    risks: ['', '', ''],
    contraindications: ['', 'AV-Р В±Р В»Р С•Р С”Р В°Р Т‘Р В° II-III', '', ''],
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
    description: 'N-Р В°РЎвЂ Р ВµРЎвЂљР С‘Р В»РЎвЂ Р С‘РЎРѓРЎвЂљР ВµР С‘Р Р… РІР‚вЂќ Р С—РЎР‚Р ВµР Т‘РЎв‚¬Р ВµРЎРѓРЎвЂљР Р†Р ВµР Р…Р Р…Р С‘Р С” Р С–Р В»РЎС“РЎвЂљР В°РЎвЂљР С‘Р С•Р Р…Р В°, Р С–Р В»Р В°Р Р†Р Р…Р С•Р С–Р С• Р Р†Р Р…РЎС“РЎвЂљРЎР‚Р С‘Р С”Р В»Р ВµРЎвЂљР С•РЎвЂЎР Р…Р С•Р С–Р С• Р В°Р Р…РЎвЂљР С‘Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р Р…РЎвЂљР В°. Р вЂњР ВµР С—Р В°РЎвЂљР С•Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С•РЎР‚, Р Р…Р ВµР в„–РЎР‚Р С•Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С•РЎР‚, Р СРЎС“Р С”Р С•Р В»Р С‘РЎвЂљР С‘Р С”. Р С›РЎРѓР Р…Р С•Р Р†Р В° Р В»РЎР‹Р В±Р С•Р в„– Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘ Р С—Р ВµРЎвЂЎР ВµР Р…Р С‘.',
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
    mechanism: 'EPA РІвЂ вЂ™ РЎР‚Р ВµР В·Р С•Р В»Р Р†Р С‘Р Р…РЎвЂ№/Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С‘Р Р…РЎвЂ№ (SPM) РІвЂ вЂ™ РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘Р Вµ Р Р†Р С•РЎРѓР С—Р В°Р В»Р ВµР Р…Р С‘РЎРЏ; DHA РІвЂ вЂ™ РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂљРЎС“РЎР‚Р Р…РЎвЂ№Р в„– Р С”Р С•Р СР С—Р С•Р Р…Р ВµР Р…РЎвЂљ Р Р…Р ВµР в„–РЎР‚Р С•Р СР ВµР СР В±РЎР‚Р В°Р Р…; Р С”Р С•Р Р…Р С”РЎС“РЎР‚Р ВµР Р…РЎвЂ Р С‘РЎРЏ РЎРѓ AA РІвЂ вЂ™ Р СР ВµР Р…РЎРЉРЎв‚¬Р Вµ PGE2',
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
    contraindications: ['', '', 'AV-Р В±Р В»Р С•Р С”Р В°Р Т‘Р В°'],
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
    risks: ['', 'CYP3A4-Р С•Р С—Р С•РЎРѓРЎР‚Р ВµР Т‘Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Р†Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ', ''],
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
      { key: 'hematologic', label: '', mechanisms: ['Zn-Р В·Р В°Р Р†Р С‘РЎРѓР С‘Р СРЎвЂ№Р в„– Р С‘Р СР СРЎС“Р Р…Р С‘РЎвЂљР ВµРЎвЂљ', ''] },
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
    description: 'Withania somnifera РІР‚вЂќ Р В°Р Т‘Р В°Р С—РЎвЂљР С•Р С–Р ВµР Р…. Р РЋР Р…Р С‘Р В¶Р В°Р ВµРЎвЂљ Р С”Р С•РЎР‚РЎвЂљР С‘Р В·Р С•Р В», Р СР С•Р Т‘РЎС“Р В»Р С‘РЎР‚РЎС“Р ВµРЎвЂљ GABA, Р В·Р В°РЎвЂ°Р С‘РЎвЂ°Р В°Р ВµРЎвЂљ Р Р…Р ВµР в„–РЎР‚Р С•Р Р…РЎвЂ№, Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С‘Р Р†Р В°Р ВµРЎвЂљ РЎвЂљР ВµРЎРѓРЎвЂљР С•РЎРѓРЎвЂљР ВµРЎР‚Р С•Р Р…. Р С’Р Р…Р С”РЎРѓР С‘Р С•Р В»Р С‘РЎвЂљР С‘Р С” + Р Р…Р ВµР в„–РЎР‚Р С•Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С•РЎР‚ + РЎРЊР Р…Р Т‘Р С•Р С”РЎР‚Р С‘Р Р…Р Р…РЎвЂ№Р в„– Р СР С•Р Т‘РЎС“Р В»РЎРЏРЎвЂљР С•РЎР‚.',
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
    description: 'Serenoa repens РІР‚вЂќ Р С‘Р Р…Р С–Р С‘Р В±Р С‘РЎвЂљР С•РЎР‚ 5РћВ±-РЎР‚Р ВµР Т‘РЎС“Р С”РЎвЂљР В°Р В·РЎвЂ№ Р С‘ РћВ±1-Р В°Р Т‘РЎР‚Р ВµР Р…Р С•РЎР‚Р ВµРЎвЂ Р ВµР С—РЎвЂљР С•РЎР‚Р С•Р Р†. Р вЂ”Р В°РЎвЂ°Р С‘РЎвЂљР В° Р С—РЎР‚Р С•РЎРѓРЎвЂљР В°РЎвЂљРЎвЂ№, РЎРѓР Р…Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ DHT-Р С•Р С—Р С•РЎРѓРЎР‚Р ВµР Т‘Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎР‚Р С‘РЎРѓР С”Р С•Р Р†, Р СР С•РЎвЂЎР ВµР С–Р С•Р Р…Р Р…Р С•Р Вµ.',
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
      { key: 'cardio', label: '', mechanisms: ['', 'NO-Р Р†Р В°Р В·Р С•Р Т‘Р С‘Р В»Р В°РЎвЂљР В°РЎвЂ Р С‘РЎРЏ'] },
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
    mechanism: 'P5P РІвЂ вЂ™ РЎвЂљРЎР‚Р В°Р Р…РЎРѓР В°Р СР С‘Р Р…Р В°Р В·РЎвЂ№, Р Т‘Р ВµР С”Р В°РЎР‚Р В±Р С•Р С”РЎРѓР С‘Р В»Р В°Р В·РЎвЂ№; РЎРѓР С‘Р Р…РЎвЂљР ВµР В· РЎРѓР ВµРЎР‚Р С•РЎвЂљР С•Р Р…Р С‘Р Р…Р В°/Р Т‘Р С•РЎвЂћР В°Р СР С‘Р Р…Р В°/GABA; Р С–Р ВµР С-РЎРѓР С‘Р Р…РЎвЂљР ВµР В· РЎвЂЎР ВµРЎР‚Р ВµР В· ALA-РЎРѓР С‘Р Р…РЎвЂљР В°Р В·РЎС“; РЎРѓР Р…Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ Р С–Р С•Р СР С•РЎвЂ Р С‘РЎРѓРЎвЂљР ВµР С‘Р Р…Р В°',
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
    description: '5-Р СР ВµРЎвЂљР С‘Р В»РЎвЂљР ВµРЎвЂљРЎР‚Р В°Р С–Р С‘Р Т‘РЎР‚Р С•РЎвЂћР С•Р В»Р В°РЎвЂљ РІР‚вЂќ Р В°Р С”РЎвЂљР С‘Р Р†Р Р…Р В°РЎРЏ РЎвЂћР С•РЎР‚Р СР В° РЎвЂћР С•Р В»Р С‘Р ВµР Р†Р С•Р в„– Р С”Р С‘РЎРѓР В»Р С•РЎвЂљРЎвЂ№. Р СљР ВµРЎвЂљР С‘Р В»Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р вЂќР СњР С™, РЎРЊРЎР‚Р С‘РЎвЂљРЎР‚Р С•Р С—Р С•РЎРЊР В·, РЎРѓР Р…Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ Р С–Р С•Р СР С•РЎвЂ Р С‘РЎРѓРЎвЂљР ВµР С‘Р Р…Р В°. Р С›Р В±РЎвЂ¦Р С•Р Т‘Р С‘РЎвЂљ MTHFR-Р СРЎС“РЎвЂљР В°РЎвЂ Р С‘Р С‘.',
    mechanism: '5-Р СљР СћР вЂњР В¤ РІвЂ вЂ™ Р СР ВµРЎвЂљР С‘Р В»РЎРЉР Р…РЎвЂ№Р в„– Р Т‘Р С•Р Р…Р С•РЎР‚ Р Т‘Р В»РЎРЏ Р СР ВµРЎвЂљР С‘Р С•Р Р…Р С‘Р Р…РЎРѓР С‘Р Р…РЎвЂљР В°Р В·РЎвЂ№ (РЎРѓ B12) РІвЂ вЂ™ Р СР ВµРЎвЂљР С‘Р В»Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р вЂќР СњР С™; РЎвЂљР С‘Р СР С‘Р Т‘Р С‘Р В»Р В°РЎвЂљ-РЎРѓР С‘Р Р…РЎвЂљР В°Р В· РІвЂ вЂ™ РЎРѓР С‘Р Р…РЎвЂљР ВµР В· Р вЂќР СњР С™; РЎРѓР Р…Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ Р С–Р С•Р СР С•РЎвЂ Р С‘РЎРѓРЎвЂљР ВµР С‘Р Р…Р В°',
    mechanismKeys: ['DNA_METHYLATION_UP', 'THYMIDYLATE_UP', 'HCY_DOWN', 'RBC_UP'],
    systems: [
      { key: 'hematologic', label: '', mechanisms: ['', '', ''] },
      { key: 'cardio', label: '', mechanisms: [''] },
    ],
    risks: ['', ''],
    contraindications: ['', 'B12-Р Т‘Р ВµРЎвЂћР С‘РЎвЂ Р С‘РЎвЂљ Р В±Р ВµР В· Р С•Р Т‘Р Р…Р С•Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…Р С•Р С–Р С• B12'],
  },
  iron: {
    description: '',
    mechanism: 'Fe2+ РІвЂ вЂ™ Р С–Р ВµР С РІвЂ вЂ™ Р С–Р ВµР СР С•Р С–Р В»Р С•Р В±Р С‘Р Р…/Р СР С‘Р С•Р С–Р В»Р С•Р В±Р С‘Р Р…; Fe-S-Р С”Р В»Р В°РЎРѓРЎвЂљР ВµРЎР‚РЎвЂ№ РІвЂ вЂ™ Р С”Р С•Р СР С—Р В»Р ВµР С”РЎРѓРЎвЂ№ I-III Р В­Р СћР С™; Fe РІвЂ вЂ™ Р С”Р В°РЎвЂљР В°Р В»Р В°Р В·Р В°/Р С—Р ВµРЎР‚Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р В·Р В°',
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
    mechanism: 'Cu/Zn-SOD РІвЂ вЂ™ Р В°Р Р…РЎвЂљР С‘Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р Р…РЎвЂљ; РЎвЂ Р С‘РЎвЂљР С•РЎвЂ¦РЎР‚Р С•Р С-c-Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р В·Р В° РІвЂ вЂ™ РЎвЂљР ВµРЎР‚Р СР С‘Р Р…Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р С•Р СР С—Р В»Р ВµР С”РЎРѓ Р В­Р СћР С™; Р В»Р С‘Р В·Р С‘Р В»Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р В·Р В° РІвЂ вЂ™ Р С”РЎР‚Р С•РЎРѓРЎРѓР В»Р С‘Р Р…Р С”Р С‘Р Р…Р С– Р С”Р С•Р В»Р В»Р В°Р С–Р ВµР Р…Р В°/РЎРЊР В»Р В°РЎРѓРЎвЂљР С‘Р Р…Р В°; РЎвЂ Р ВµРЎР‚РЎС“Р В»Р С•Р С—Р В»Р В°Р В·Р СР С‘Р Р… РІвЂ вЂ™ Fe-РЎвЂљРЎР‚Р В°Р Р…РЎРѓР С—Р С•РЎР‚РЎвЂљ',
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
      { key: 'cardio', label: '', mechanisms: ['', 'Inotropic Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В°', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['GABA-Р СР С‘Р СР ВµРЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘Р в„– РЎРЊРЎвЂћРЎвЂћР ВµР С”РЎвЂљ', ''] },
      { key: 'renal', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', ''],
  },
  melatonin: {
    description: '',
    mechanism: 'MT1/MT2 РІвЂ вЂ™ РЎвЂ Р С‘РЎР‚Р С”Р В°Р Т‘Р Р…Р В°РЎРЏ РЎР‚Р ВµР С–РЎС“Р В»РЎРЏРЎвЂ Р С‘РЎРЏ; Р С—РЎР‚Р С•Р Р…Р С‘Р С”Р Р…Р С•Р Р†Р ВµР Р…Р С‘Р Вµ Р Р† Р СР С‘РЎвЂљР С•РЎвЂ¦Р С•Р Р…Р Т‘РЎР‚Р С‘Р С‘ РІвЂ вЂ™ Р В°Р Р…РЎвЂљР С‘Р С•Р С”РЎРѓР С‘Р Т‘Р В°Р Р…РЎвЂљ; РІвЂ вЂњР С”Р С•РЎР‚РЎвЂљР С‘Р В·Р С•Р В»; РІвЂ вЂBDNF; Р С‘Р СР СРЎС“Р Р…Р С•Р СР С•Р Т‘РЎС“Р В»РЎРЏРЎвЂ Р С‘РЎРЏ',
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
      { key: 'cardio', label: '', mechanisms: ['NO-Р Р†Р В°Р В·Р С•Р Т‘Р С‘Р В»Р В°РЎвЂљР В°РЎвЂ Р С‘РЎРЏ'] },
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
      { key: 'hepatic', label: '', mechanisms: ['', 'AMPK-Р В°Р С”РЎвЂљР С‘Р Р†Р В°РЎвЂ Р С‘РЎРЏ'] },
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
      { key: 'neuro', label: '', mechanisms: ['', 'BDNF-РЎРѓРЎвЂљР С‘Р СРЎС“Р В»РЎРЏРЎвЂ Р С‘РЎРЏ'] },
      { key: 'hematologic', label: '', mechanisms: [''] },
    ],
    risks: ['', 'CYP3A4-Р С•Р С—Р С•РЎРѓРЎР‚Р ВµР Т‘Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Р†Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ (Р С—Р С‘Р С—Р ВµРЎР‚Р С‘Р Р…)', ''],
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
    description: 'L-Р С”Р В°РЎР‚Р Р…Р С‘РЎвЂљР С‘Р Р… РІР‚вЂќ РЎвЂљРЎР‚Р В°Р Р…РЎРѓР С—Р С•РЎР‚РЎвЂљРЎвЂРЎР‚ Р В¶Р С‘РЎР‚Р Р…РЎвЂ№РЎвЂ¦ Р С”Р С‘РЎРѓР В»Р С•РЎвЂљ Р Р† Р СР С‘РЎвЂљР С•РЎвЂ¦Р С•Р Р…Р Т‘РЎР‚Р С‘Р С‘. Р С™Р В°РЎР‚Р Т‘Р С‘Р С•Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С•РЎР‚, Р Р…Р ВµР в„–РЎР‚Р С•Р С—РЎР‚Р С•РЎвЂљР ВµР С”РЎвЂљР С•РЎР‚, Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В° Р С—Р ВµРЎвЂЎР ВµР Р…Р С‘. Р Р€Р В»РЎС“РЎвЂЎРЎв‚¬Р В°Р ВµРЎвЂљ РЎРЊР Р…Р ВµРЎР‚Р С–Р ВµРЎвЂљР С‘Р С”РЎС“ Р СР С‘Р С•Р С”Р В°РЎР‚Р Т‘Р В° Р С‘ РЎРѓР С”Р ВµР В»Р ВµРЎвЂљР Р…РЎвЂ№РЎвЂ¦ Р СРЎвЂ№РЎв‚¬РЎвЂ .',
    mechanism: '',
    mechanismKeys: ['FA_OXIDATION_UP', 'ATP_UP', 'ACETYL_COA_UP', 'MITO_UP'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
    ],
    risks: ['TMAO Р С—РЎР‚Р С‘ Р Р†РЎвЂ№РЎРѓР С•Р С”Р С‘РЎвЂ¦ Р Т‘Р С•Р В·Р В°РЎвЂ¦ (Р С”Р С‘РЎв‚¬Р ВµРЎвЂЎР Р…Р В°РЎРЏ РЎвЂћР В»Р С•РЎР‚Р В°)', '', ''],
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
    description: 'BPC-157 (Body Protection Compound) РІР‚вЂќ Р С—Р ВµР С—РЎвЂљР С‘Р Т‘ 15 Р В°.Р С”. Р С‘Р В· Р В¶Р ВµР В»РЎС“Р Т‘Р С•РЎвЂЎР Р…Р С•Р С–Р С• РЎРѓР С•Р С”Р В°. Р СљР С•РЎвЂ°Р Р…Р ВµР в„–РЎв‚¬Р С‘Р в„– РЎР‚Р ВµР С–Р ВµР Р…Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚: РЎРѓР Р†РЎРЏР В·Р С”Р С‘, РЎРѓРЎС“РЎвЂ¦Р С•Р В¶Р С‘Р В»Р С‘РЎРЏ, РЎвЂ¦РЎР‚РЎРЏРЎвЂ°Р С‘, Р вЂ“Р С™Р Сћ, Р Р…Р ВµРЎР‚Р Р†Р Р…Р В°РЎРЏ РЎвЂљР С”Р В°Р Р…РЎРЉ. Р Р€РЎРѓР С”Р С•РЎР‚РЎРЏР ВµРЎвЂљ Р В·Р В°Р В¶Р С‘Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р Р† 2-3 РЎР‚Р В°Р В·Р В°.',
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
    description: 'TB-500 (РЎвЂљР С‘Р СР С•Р В·Р С‘Р Р… РћР†4) РІР‚вЂќ Р С—Р ВµР С—РЎвЂљР С‘Р Т‘ 43 Р В°.Р С”. Р В Р ВµР С–РЎС“Р В»Р С‘РЎР‚РЎС“Р ВµРЎвЂљ Р В°Р С”РЎвЂљР С‘Р Р… РІвЂ вЂ™ Р СР С•Р В±Р С‘Р В»РЎРЉР Р…Р С•РЎРѓРЎвЂљРЎРЉ Р С”Р В»Р ВµРЎвЂљР С•Р С” РІвЂ вЂ™ Р В·Р В°Р В¶Р С‘Р Р†Р В»Р ВµР Р…Р С‘Р Вµ. Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµРЎвЂљ РЎРѓР Р†РЎРЏР В·Р С”Р С‘, РЎРѓРЎС“РЎвЂ¦Р С•Р В¶Р С‘Р В»Р С‘РЎРЏ, Р С”Р С•Р В¶РЎС“, РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР Р…РЎС“РЎР‹ Р СРЎвЂ№РЎв‚¬РЎвЂ РЎС“. Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘РЎРЏ РЎРѓ BPC-157.',
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
  const [tab, setTab] = useState<SupportTab>(initialTab || 'catalog');
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
  const [autoProtocol, setAutoProtocol] = useState<ReturnType<typeof generateWeeklyProtocol> | null>(null);
  const [dbInteractions, setDbInteractions] = useState<ReturnType<typeof checkSupportInteractions> | null>(null);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<SupportSubstance[]>([]);
  const [dbStats] = useState(getSupportDatabaseStats);
  const [goalRecommendations, setGoalRecommendations] = useState<ReturnType<typeof findSupportForGoal> | null>(null);

  // Peptide calculator state
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
    basic: { label: '', desc: '', subs: ['nac', 'omega3', 'vitamin_d3'] },
    standard: { label: '', desc: '', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'vitamin_k2', 'vitamin_b12', 'glucosamine', 'collagen'] },
    enhanced: { label: '', desc: '', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'vitamin_k2', 'selenium', 'milk_thistle', 'vitamin_b12', 'folate', 'taurine', 'glucosamine', 'msm', 'collagen', 'vitamin_c', 'bpc157'] },
    maximum: { label: '', desc: '', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'telmisartan', 'nebivolol', 'saw_palmetto', 'hcg', 'vitamin_k2', 'selenium', 'milk_thistle', 'probiotics', 'vitamin_b12', 'folate', 'iron', 'copper', 'astragalus', 'taurine', 'melatonin', 'ginseng', 'egcg', 'curcumin', 'phosphatidylcholine', 'l_carnitine', 'glucosamine', 'chondroitin', 'msm', 'collagen', 'hyaluronic', 'boswellia', 'vitamin_c', 'bromelain', 'bpc157', 'tb500'] },
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
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);

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
    <div className="screen support-screen">
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['catalog', 'synergies', 'calculator', 'interactions', 'protocol', 'stacks', 'peptides', 'recs'] as SupportTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: tab === t ? 'var(--accent-green, #00e68a)' : 'var(--bg-secondary)',
            color: tab === t ? '#000' : 'var(--text-dim)', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap',
          }}>
            {t === 'catalog' ? 'СЂСџвЂњвЂ“ Р С™Р В°РЎвЂљР В°Р В»Р С•Р С–' : t === 'synergies' ? 'СЂСџвЂќвЂ” Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘' : t === 'calculator' ? 'СЂСџВ§В® Р С™Р В°Р В»РЎРЉР С”РЎС“Р В»РЎРЏРЎвЂљР С•РЎР‚' : t === 'interactions' ? '' : t === 'stacks' ? 'СЂСџвЂњВ¦ Р РЋРЎвЂљР ВµР С”Р С‘' : t === 'peptides' ? 'СЂСџВ§В¬ Р СџР ВµР С—РЎвЂљР С‘Р Т‘РЎвЂ№' : t === 'recs' ? 'СЂСџвЂ™РЋ Р В Р ВµР С”Р С•Р С.' : 'СЂСџвЂњвЂ¦ Р СџРЎР‚Р С•РЎвЂљР С•Р С”Р С•Р В»'}
          </button>
        ))}
      </div>

      {/* ===== CATALOG ===== */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 13 }} />
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}>
              <option value="all">Р вЂ™РЎРѓР Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№</option>
              {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 8px' }}>Р С™Р В»Р В°РЎРѓРЎРѓРЎвЂ№:</span>
            <button onClick={() => setSupportClassFilter('all')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'all' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'all' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Р вЂ™РЎРѓР Вµ</button>
            <button onClick={() => setSupportClassFilter('support')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'support' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'support' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Р СџР С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В°</button>
            <button onClick={() => setSupportClassFilter('peptide_regenerative')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_regenerative' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_regenerative' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Р В Р ВµР С–Р ВµР Р…Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ</button>
            <button onClick={() => setSupportClassFilter('peptide_nootropic')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_nootropic' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_nootropic' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Р СњР С•Р С•РЎвЂљРЎР‚Р С•Р С—РЎвЂ№</button>
            <button onClick={() => setSupportClassFilter('peptide_immune')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_immune' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_immune' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Р ВР СР СРЎС“Р Р…Р Р…Р В°РЎРЏ</button>
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
              {filteredSupplements.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Р СњР С‘РЎвЂЎР ВµР С–Р С• Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•</div>}
            </div>
            {selectedDetail && (
              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{selectedDetail.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 12px 0' }}>{selectedDetail.description}</p>
                {selectedDetail.targets && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Р РЋР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedDetail.targets.systems?.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: 'var(--accent-green, #00e68a)' }}>{systemLabels[s] || s}</span>
                      ))}
                    </div>
                    {selectedDetail.targets.biomarkers && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Р вЂР С‘Р С•Р СР В°РЎР‚Р С”Р ВµРЎР‚РЎвЂ№: {selectedDetail.targets.biomarkers.join(', ')}</div>}
                    {selectedDetail.targets.mechanisms && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Р СљР ВµРЎвЂ¦Р В°Р Р…Р С‘Р В·Р СРЎвЂ№: {selectedDetail.targets.mechanisms.join(', ')}</div>}
                  </div>
                )}
                {SUPPORT_MED_DETAIL[selectedDetail.id] && (SUPPORT_MED_DETAIL[selectedDetail.id].risks.length > 0 || SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.length > 0) && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {SUPPORT_MED_DETAIL[selectedDetail.id].risks.length > 0 && (
                      <div style={{ marginBottom: SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.length > 0 ? 8 : 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#ef4444' }}>Р В Р С‘РЎРѓР С”Р С‘:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SUPPORT_MED_DETAIL[selectedDetail.id].risks.map((r, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#f59e0b' }}>Р СџРЎР‚Р С•РЎвЂљР С‘Р Р†Р С•Р С—Р С•Р С”Р В°Р В·Р В°Р Р…Р С‘РЎРЏ:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SUPPORT_MED_DETAIL[selectedDetail.id].contraindications.map((c, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedDetail.research && selectedDetail.research.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Р ВРЎРѓРЎРѓР В»Р ВµР Т‘Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ:</div>
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
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘:</div>
                {SYNERGY_PAIRS.filter(p => p.substanceA === selectedDetail.id || p.substanceB === selectedDetail.id).map((pair, i) => {
                  const partner = pair.substanceA === selectedDetail.id ? pair.substanceB : pair.substanceA;
                  const partnerName = SUPPLEMENT_DESCRIPTIONS[partner] || (partner as string).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: SYNERGY_COLORS[pair.synergyType] || '#888' }} />
                      <span style={{ fontWeight: 500 }}>{partnerName}</span>
                      <span style={{ color: SYNERGY_COLORS[pair.synergyType] || 'var(--text-dim)', fontSize: 10 }}>{pair.synergyType === 'synergistic' ? '' : pair.synergyType === 'additive' ? '' : pair.synergyType === 'potentiative' ? '' : ''}</span>
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
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>СЂСџвЂќвЂ” Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>
              Р вЂ™Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ Р СР ВµР В¶Р Т‘РЎС“ Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР В°Р СР С‘ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘, Р вЂР С’Р вЂќР В°Р СР С‘ Р С‘ Р Т‘Р С•Р В±Р В°Р Р†Р С”Р В°Р СР С‘
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={synergyFilter} onChange={e => setSynergyFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Р вЂ™РЎРѓР Вµ РЎвЂљР С‘Р С—РЎвЂ№</option>
                <option value="synergistic">Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘РЎРЏ</option>
                <option value="additive">Р С’Р Т‘Р Т‘Р С‘РЎвЂљР С‘Р Р†Р Р…РЎвЂ№Р в„–</option>
                <option value="potentiative">Р СџР С•РЎвЂљР ВµР Р…РЎвЂ Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ</option>
                <option value="complementary">Р С™Р С•Р СР С—Р В»Р ВµР СР ВµР Р…РЎвЂљР В°РЎР‚Р Р…РЎвЂ№Р в„–</option>
              </select>
              <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Р вЂ™РЎРѓР Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№</option>
                {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                {filteredSynergies.length} Р С—Р В°РЎР‚
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
                        {pair.synergyType === 'synergistic' ? '' : pair.synergyType === 'additive' ? '' : pair.synergyType === 'potentiative' ? '' : ''}
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
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>СЂСџВ§В® Р С™Р В°Р В»РЎРЉР С”РЎС“Р В»РЎРЏРЎвЂљР С•РЎР‚ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Р В Р В°РЎРѓРЎвЂЎРЎвЂРЎвЂљ Р С‘Р Р…Р Т‘Р ВµР С”РЎРѓР В° Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘ Р С‘ РЎРѓР Р…Р С‘Р В¶Р ВµР Р…Р С‘РЎРЏ РЎР‚Р С‘РЎРѓР С”Р С•Р Р† Р Р…Р В° Р С•РЎРѓР Р…Р С•Р Р†Р Вµ Р Р†РЎРѓР ВµРЎвЂ¦ Р С‘РЎРѓРЎвЂљР С•РЎвЂЎР Р…Р С‘Р С”Р С•Р Р†: Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљРЎвЂ№, Р В°Р Р…Р В°Р В»Р С‘Р В·РЎвЂ№, Р С—Р С‘РЎвЂљР В°Р Р…Р С‘Р Вµ, РЎвЂљРЎР‚Р ВµР Р…Р С‘РЎР‚Р С•Р Р†Р С”Р С‘, Р С–Р ВµР Р…Р ВµРЎвЂљР С‘Р С”Р В°
            </p>
            <button onClick={calcSupport} style={{
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 15,
              boxShadow: '0 2px 8px rgba(0,230,138,0.3)',
            }}>
              Р В Р В°РЎРѓРЎРѓРЎвЂЎР С‘РЎвЂљР В°РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”РЎС“
            </button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>Р В¦Р ВµР В»РЎРЉ</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[{ v: 'muscle_gain', l: '' }, { v: 'fat_loss', l: '' }, { v: 'strength', l: '' }, { v: 'endurance', l: '' }, { v: 'recomp', l: '' }, { v: 'maintenance', l: '' }].map(g => (
                <button key={g.v} onClick={() => setSupportGoal(g.v)} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: supportGoal === g.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: supportGoal === g.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: supportGoal === g.v ? '#00e68a' : 'var(--text-dim)', fontWeight: supportGoal === g.v ? 700 : 400,
                }}>{g.l}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              Р СџРЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР С•Р Р†: <b style={{ color: 'var(--accent)' }}>{linked.course.length}</b> | Р С’Р Р†РЎвЂљР С•-РЎС“РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ: <b style={{ color: '#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel]?.label || autoLevel}</b>
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
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Р ВР Р…Р Т‘Р ВµР С”РЎРѓ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: (supportResult.supportScore ?? 100) > 70 ? '#22c55e' : (supportResult.supportScore ?? 100) > 40 ? '#eab308' : '#ef4444', lineHeight: 1 }}>
                  {Math.round(supportResult.supportScore ?? 0)}%
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, supportResult.supportScore ?? 0)}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e)', borderRadius: 6 }} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂњР‰ Р В Р С‘РЎРѓР С”Р С‘ РІР‚вЂќ Р Т‘Р С• Р С‘ Р С—Р С•РЎРѓР В»Р Вµ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘</h4>
                {ALL_RISK_SYSTEMS.slice(0, 8).map(sys => {
                  const before = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 0;
                  const after = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.net ?? 0;
                  const reduction = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border-color)', fontSize: 11 }}>
                      <span style={{ fontSize: 13, minWidth: 18 }}>{SYSTEM_INFO_ALL[sys]?.icon || ''}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{systemLabels[sys]}</span>
                      <span style={{ fontSize: 10, color: getRiskColor(before), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(before)}%</span>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>РІвЂ вЂ™</span>
                      <span style={{ fontSize: 10, color: getRiskColor(after), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(after)}%</span>
                      {reduction > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>РІвЂ вЂњ{reduction}%</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂєРЋ Р СџР С•Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР С</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(activeSystems).map(([sys, _]) => {
                    const cov = supportResult?.systemSupport?.[sys] ?? 0;
                    const pct = Math.round(cov * 100);
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
                        <span style={{ fontSize: 10, flex: 1 }}>{sys === 'cardio' ? '' : sys === 'hepatic' ? '' : sys === 'renal' ? '' : sys === 'neuro' ? '' : sys === 'endocrine' ? '' : sys === 'hematologic' ? '' : sys === 'reproductive' ? '' : sys === 'musculoskeletal' ? '' : sys}</span>
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
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂњвЂ№ Р В Р ВµР С”Р С•Р СР ВµР Р…Р Т‘Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р С”Р С‘</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {SUPPORT_LEVELS[supportLevel]?.subs?.slice(0, 15).map(id => (
                    <span key={id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>
                      {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂ™Р‰ Р С›Р С—РЎвЂљР С‘Р СР С‘Р В·Р В°РЎвЂљР С•РЎР‚ РЎРѓРЎвЂљР ВµР С”Р В°</h4>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Р СџР С•Р Т‘Р В±Р С‘РЎР‚Р В°Р ВµРЎвЂљ Р В·Р В°РЎвЂ°Р С‘РЎвЂљРЎС“ Р С•РЎР‚Р С–Р В°Р Р…Р С•Р Р† Р С—Р С•Р Т‘ Р Р†Р В°РЎв‚¬ Р С”РЎС“РЎР‚РЎРѓ Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР С•Р Р†</p>
                <OptimizerSection drugs={supportDrugs} />
              </div>

              {/* ===== RISK MODEL SELECTION ===== */}
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>РІС™в„ў Р СљР С•Р Т‘Р ВµР В»РЎРЉ РЎР‚Р В°РЎРѓРЎвЂЎРЎвЂРЎвЂљР В° РЎР‚Р С‘РЎРѓР С”Р С•Р Р†</h4>
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
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџВ§В® Р СљР ВµРЎвЂљР С•Р Т‘ РЎР‚Р В°РЎРѓРЎвЂЎРЎвЂРЎвЂљР В°</h4>
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
                СЂСџвЂњвЂ¦ Р РЋР С–Р ВµР Р…Р ВµРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р Р…Р ВµР Т‘Р ВµР В»РЎРЉР Р…РЎвЂ№Р в„– Р С—Р В»Р В°Р Р…
              </button>

              {/* ===== WEEKLY PLAN DISPLAY ===== */}
              {weeklyPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>
                    СЂСџвЂњвЂ¦ Р СњР ВµР Т‘Р ВµР В»РЎРЉР Р…РЎвЂ№Р в„– Р С—Р В»Р В°Р Р… ({RISK_METHODS.find(m => m.id === weeklyPlan.riskMethod)?.label || weeklyPlan.riskMethod})
                  </h4>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Р В Р С‘РЎРѓР С” РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.current > 60 ? '#ef4444' : weeklyPlan.overallRisk.current > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.current}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Р СџРЎР‚Р С•Р С–Р Р…Р С•Р В·: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.projected > 60 ? '#ef4444' : weeklyPlan.overallRisk.projected > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.projected}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Р РЋР Р…Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ: </span>
                      <span style={{ fontWeight: 700, color: '#22c55e' }}>РІвЂ вЂњ{weeklyPlan.overallRisk.reduction}%</span>
                    </div>
                  </div>

                  {/* Systems coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>СЂСџвЂєРЋ Р СџР С•Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР С</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {weeklyPlan.coveredSystems.map(cs => (
                        <span key={cs.system} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                          {cs.label}: {cs.coverage}% ({cs.substances.length} Р С—РЎР‚Р ВµР С—.)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Organs coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>СЂСџВ«Р‚ Р СџР С•Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ Р С•РЎР‚Р С–Р В°Р Р…Р С•Р Р†</div>
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
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>СЂСџВ§В¬ Р С™Р В»РЎР‹РЎвЂЎР ВµР Р†РЎвЂ№Р Вµ Р СР ВµРЎвЂ¦Р В°Р Р…Р С‘Р В·Р СРЎвЂ№</div>
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
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>СЂСџвЂќвЂ” Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘ Р Р† РЎРѓРЎвЂљР ВµР С”Р Вµ</div>
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
                      { key: 'emptyStomach', label: 'СЂСџРЉвЂ¦ Р СњР В°РЎвЂљР С•РЎвЂ°Р В°Р С”', color: '#f59e0b', items: day.emptyStomach },
                      { key: 'morning', label: '', color: '#3b82f6', items: day.morning },
                      { key: 'lunch', label: 'СЂСџРЊР… Р С›Р В±Р ВµР Т‘', color: '#22c55e', items: day.lunch },
                      { key: 'evening', label: 'СЂСџРЉвЂ  Р вЂ™Р ВµРЎвЂЎР ВµРЎР‚', color: '#8b5cf6', items: day.evening },
                      { key: 'night', label: 'СЂСџРЉв„ў Р СњР В° Р Р…Р С•РЎвЂЎРЎРЉ', color: '#6366f1', items: day.night },
                    ];
                    return (
                      <div key={di} id={`ws-day-${di}`} style={{ marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{day.dayLabel} РІР‚вЂќ {day.date}</span>
                          <span style={{ color: day.riskLevel > 60 ? '#ef4444' : day.riskLevel > 30 ? '#f59e0b' : '#22c55e', fontSize: 10 }}>Р В Р С‘РЎРѓР С”: {day.riskLevel}%</span>
                        </div>
                        {timeSlots.map(ts => ts.items.length > 0 && (
                          <div key={ts.key} style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: ts.color, fontWeight: 600 }}>{ts.label}</div>
                            {ts.items.map((item, ii) => (
                              <div key={ii} style={{ marginLeft: 8, fontSize: 9, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-light)' }}>{item.name}</span>
                                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>{item.doseSuggestion}</span>
                                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                                  {item.mechanismRu} РІвЂ вЂ™ {item.organLabels.join(', ')} РІвЂ вЂ™ {item.systemLabels.join(', ')}
                                  {item.synergies.length > 0 && <span style={{ color: '#22c55e', marginLeft: 4 }}>РІР‰вЂў {item.synergies.map(s => s.partnerName).join(', ')}</span>}
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџВ§Р„ Р РЋР Р†Р С•Р Т‘Р С”Р В° Р В°Р Р…Р В°Р В»Р С‘Р В·Р С•Р Р†</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 10 }}>
                    {labAnalysis.homaIR !== null && (
                      <>
                        <span style={{ color: 'var(--text-dim)' }}>HOMA-IR:</span>
                        <span style={{ fontWeight: 600, color: labAnalysis.homaIR > 2.5 ? '#ef4444' : labAnalysis.homaIR > 1.5 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.homaIR.toFixed(2)} {labAnalysis.homaIR > 2.5 ? '' : labAnalysis.homaIR > 1.5 ? '' : ''}</span>
                      </>
                    )}
                    <span style={{ color: 'var(--text-dim)' }}>Р СџР ВµРЎвЂЎРЎвЂР Р…Р С•РЎвЂЎР Р…Р В°РЎРЏ Р Р…Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.liverStress > 60 ? '#ef4444' : labAnalysis.liverStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.liverStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Р С™Р В°РЎР‚Р Т‘Р С‘Р С•РЎР‚Р С‘РЎРѓР С”:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.cardioRisk > 60 ? '#ef4444' : labAnalysis.cardioRisk > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.cardioRisk}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Р вЂ™Р С•РЎРѓР С—Р В°Р В»Р ВµР Р…Р С‘Р Вµ:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.inflammation > 6 ? '#ef4444' : labAnalysis.inflammation > 3 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.inflammation.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-dim)' }}>Р СџР С•РЎвЂЎР ВµРЎвЂЎР Р…Р В°РЎРЏ Р Р…Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.kidneyStress > 60 ? '#ef4444' : labAnalysis.kidneyStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.kidneyStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Р вЂњР С•РЎР‚Р СР С•Р Р…Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎРѓРЎвЂЎРЎвЂРЎвЂљ:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.hormoneScore > 60 ? '#ef4444' : labAnalysis.hormoneScore > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.hormoneScore}%</span>
                  </div>
                  {labAnalysis.interpretations.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>Р СњР В°Р в„–Р Т‘Р ВµР Р…РЎвЂ№ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р С‘РЎРЏ ({labAnalysis.interpretations.length}):</div>
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџВ§В¬ Р СљР ВµРЎвЂ¦Р В°Р Р…Р С‘Р В·Р СРЎвЂ№ РІвЂ вЂ™ Р С›РЎР‚Р С–Р В°Р Р…РЎвЂ№ РІвЂ вЂ™ Р В Р С‘РЎРѓР С”Р С‘</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {mechanismReport.mechanisms.slice(0, 6).map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>{m.name.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--text-dim)' }}>РІвЂ вЂ™</span>
                        <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{m.organ}</span>
                        <span style={{ color: 'var(--text-dim)' }}>РІвЂ вЂ™</span>
                        <span style={{ fontSize: 9, background: 'rgba(0,230,138,0.08)', padding: '1px 4px', borderRadius: 3 }}>{m.system}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: m.activation > 80 ? '#ef4444' : '#f59e0b' }}>{m.activation}%</span>
                      </div>
                    ))}
                  </div>
                  {mechanismReport.topRisks.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р СћР С•Р С— РЎР‚Р С‘РЎРѓР С”Р С•Р Р†: </span>
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂњР‰ Р В Р С‘РЎРѓР С”Р С‘ Р С—Р С• Р СР С•Р Т‘Р ВµР В»Р С‘: {RISK_MODEL_LABELS[riskModel].split(' ')[1]}</h4>
                  {Object.entries(modelRiskResult).map(([sys, data]) => (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid var(--border-color)', fontSize: 10 }}>
                      <span style={{ flex: 1 }}>{sys === 'cardio' ? '' : sys === 'hepatic' ? '' : sys === 'renal' ? '' : sys === 'neuro' ? '' : sys === 'endocrine' ? '' : sys === 'hematologic' ? '' : sys === 'reproductive' ? '' : ''}</span>
                      <span style={{ color: getRiskColor(data.raw), fontWeight: 600 }}>{data.raw}%</span>
                      <span style={{ color: 'var(--text-dim)' }}>РІвЂ вЂ™</span>
                      <span style={{ color: getRiskColor(data.net), fontWeight: 600 }}>{data.net}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== TIMED PLAN ===== */}
              {timedPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂўС’ Р СџР В»Р В°Р Р… Р С—Р С• Р Р†РЎР‚Р ВµР СР ВµР Р…Р С‘ РЎРѓРЎС“РЎвЂљР С•Р С”</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>СЂСџРЉвЂ¦ Р Р€РЎвЂљРЎР‚Р С• (РЎРѓРЎвЂљР С‘Р СРЎС“Р В»РЎРЏРЎвЂ Р С‘РЎРЏ)</div>
                      {timedPlan.morning.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>РІР‚Сћ {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600, marginBottom: 3 }}>РІВР‚РїС‘РЏ Р вЂќР ВµР Р…РЎРЉ (Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В°)</div>
                      {timedPlan.day.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>РІР‚Сћ {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 600, marginBottom: 3 }}>СЂСџРЉв„ў Р вЂ™Р ВµРЎвЂЎР ВµРЎР‚ (Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ)</div>
                      {timedPlan.evening.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>РІР‚Сћ {m.replace(/_/g, ' ')}</div>)}
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
                <div style={{ marginBottom: 2 }}>
                  <b>Р С›Р В±РЎвЂ°Р С‘Р в„– РЎР‚Р С‘РЎРѓР С”:</b> Р Т‘Р С• <span style={{ color: getRiskColor(supportResult?.riskBeforeSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskBeforeSupport ?? 0)}%</span>
                  {' РІвЂ вЂ™ '}Р С—Р С•РЎРѓР В»Р Вµ <span style={{ color: getRiskColor(supportResult?.riskAfterSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskAfterSupport ?? 0)}%</span>
                </div>
                <div>Р ВРЎРѓРЎвЂљР С•РЎвЂЎР Р…Р С‘Р С”Р С‘: {linked.course.length} Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР С•Р Р†, {linked.labs.length} Р В°Р Р…Р В°Р В»Р С‘Р В·Р С•Р Р†, Р С—Р С‘РЎвЂљР В°Р Р…Р С‘Р Вµ, РЎвЂљРЎР‚Р ВµР Р…Р С‘РЎР‚Р С•Р Р†Р С”Р С‘{linked.profile?.settings?.genetics ? ', Р С–Р ВµР Р…Р ВµРЎвЂљР С‘Р С”Р В°' : ''}</div>
                <div style={{ marginTop: 4, color: '#8b5cf6', fontSize: 9 }}>Р вЂР В°Р В·Р В°: {dbStats.totalSubstances} Р Р†Р ВµРЎвЂ°Р ВµРЎРѓРЎвЂљР Р†, {dbStats.totalInteractions} Р Р†Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р в„–, {dbStats.totalRisks} РЎР‚Р С‘РЎРѓР С”Р С•Р Р†</div>
              </div>

              {dbInteractions && (dbInteractions.synergies.length > 0 || dbInteractions.conflicts.length > 0 || dbInteractions.cautions.length > 0) && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>РІС™РЋ Р вЂ™Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ Р Р† Р Р†Р В°РЎв‚¬Р ВµР С РЎРѓРЎвЂљР ВµР С”Р Вµ</h4>
                  {dbInteractions.conflicts.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>РІС™В  Р С™Р С•Р Р…РЎвЂћР В»Р С‘Р С”РЎвЂљРЎвЂ№ ({dbInteractions.conflicts.length}):</span>
                      {dbInteractions.conflicts.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#ef4444', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.cautions.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>РІС™РЋ Р С›РЎРѓРЎвЂљР С•РЎР‚Р С•Р В¶Р Р…Р С•РЎРѓРЎвЂљРЎРЉ ({dbInteractions.cautions.length}):</span>
                      {dbInteractions.cautions.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#f59e0b', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.synergies.length > 0 && (
                    <div>
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>РІСљвЂ¦ Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘ ({dbInteractions.synergies.length}):</span>
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџР‹Р‡ Р В Р ВµР С”Р С•Р СР ВµР Р…Р Т‘Р В°РЎвЂ Р С‘Р С‘ Р Т‘Р В»РЎРЏ РЎвЂ Р ВµР В»Р С‘ ({supportGoal === 'muscle_gain' ? '' : supportGoal === 'fat_loss' ? '' : supportGoal === 'strength' ? '' : supportGoal === 'endurance' ? '' : supportGoal === 'recomp' ? '' : ''})</h4>
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
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂќРЊ Р СџР С•Р С‘РЎРѓР С” Р С—Р С• Р В±Р В°Р В·Р Вµ ({dbStats.totalSubstances} Р Р†Р ВµРЎвЂ°Р ВµРЎРѓРЎвЂљР Р†)</h4>
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
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{sub.type} Р’В· {sub.categories.slice(0, 2).join(', ')}</span>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{sub.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {dbSearchQuery.length > 1 && dbSearchResults.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>Р СњР С‘РЎвЂЎР ВµР С–Р С• Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== INTERACTIONS ===== */}
      {tab === 'interactions' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>РІС™РЋ Р вЂ™Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° РЎРѓР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р в„– Р С‘ Р С”Р С•Р Р…РЎвЂћР В»Р С‘Р С”РЎвЂљР С•Р Р† Р СР ВµР В¶Р Т‘РЎС“ Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР В°Р СР С‘ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘ Р С‘ Р вЂР С’Р вЂќР В°Р СР С‘
            </p>
          </div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {interactionIds.map((id, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 18, fontWeight: 600 }}>#{idx + 1}</div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="text" value={interactionSearchIdx === idx ? interactionSearch : id ? (allSupport.find(s => s.id === id)?.name || id) : ''}
                        placeholder="СЂСџвЂќРЊ Р СџР С•Р С‘РЎРѓР С” Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР В°..."
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
                            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>Р СњР С‘РЎвЂЎР ВµР С–Р С• Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•</div>
                          )}
                </div>
              )}

              <ReportSummaryCard supportResult={supportResult} />
                    </div>
                    {interactionIds.length > 2 && (
                      <button onClick={() => removeInteraction(idx)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                      }}>РІСљвЂў</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addInteraction} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a',
            }}>+ Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљ</button>
          </div>

          {validInteractionIds.length < 2 && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>РІС™РЋ</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р СР С‘Р Р…Р С‘Р СРЎС“Р С 2 Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР В° Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р С‘ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С‘ Р Р†Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р в„–</div>
            </div>
          )}

          {validInteractionIds.length >= 2 && !hasSupportInteractions && (
            <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.05)' }}>
              <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>РІСљвЂњ Р С™РЎР‚Р С‘РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘РЎвЂ¦ Р Р†Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р в„– Р Р…Р Вµ Р С•Р В±Р Р…Р В°РЎР‚РЎС“Р В¶Р ВµР Р…Р С•</div>
            </div>
          )}

          {hasSupportInteractions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {supportSynergiesList.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#22c55e' }}>РІР‰вЂў Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘РЎРЏ ({supportSynergiesList.length})</h4>
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
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ef4444' }}>РІС™В  Р С™Р С•Р Р…РЎвЂћР В»Р С‘Р С”РЎвЂљРЎвЂ№ ({supportConflicts.length})</h4>
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
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ff9800' }}>РІС™РЋ Р С›РЎРѓРЎвЂљР С•РЎР‚Р С•Р В¶Р Р…Р С•РЎРѓРЎвЂљРЎРЉ ({supportCautions.length})</h4>
                  {supportCautions.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#ff9800', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== STACKS ===== */}
      {tab === 'stacks' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>СЂСџвЂњВ¦ Р вЂњР С•РЎвЂљР С•Р Р†РЎвЂ№Р Вµ РЎРѓРЎвЂљР ВµР С”Р С‘</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
              {ALL_STACKS.length} Р С•Р С—РЎвЂљР С‘Р СР С‘Р В·Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ Р С”Р С•Р СР В±Р С‘Р Р…Р В°РЎвЂ Р С‘Р в„– Р Т‘Р С•Р В±Р В°Р Р†Р С•Р С” РЎРѓ РЎР‚Р В°РЎРѓРЎРѓРЎвЂЎР С‘РЎвЂљР В°Р Р…Р Р…РЎвЂ№Р С synergy score
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
                  {stack.substances.length} Р Р†Р ВµРЎвЂ°Р ВµРЎРѓРЎвЂљР Р† Р’В· synergy score: {stack.synergyScore.toFixed(1)}
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
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>СЂСџВ§В¬ Р СџР ВµР С—РЎвЂљР С‘Р Т‘Р Р…РЎвЂ№Р в„– Р С”Р В°Р В»РЎРЉР С”РЎС“Р В»РЎРЏРЎвЂљР С•РЎР‚</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Р В Р В°РЎРѓРЎвЂЎРЎвЂРЎвЂљ РЎР‚Р В°Р В·Р Р†Р ВµР Т‘Р ВµР Р…Р С‘РЎРЏ, Р Т‘Р С•Р В·Р С‘РЎР‚Р С•Р Р†Р С”Р С‘, PKРІР‚вЂР СР С•Р Т‘Р ВµР В»Р С‘ Р С‘ РЎР‚Р С‘РЎРѓР С”Р С•Р Р† Р Т‘Р В»РЎРЏ 13 Р С—Р ВµР С—РЎвЂљР С‘Р Т‘Р С•Р Р†</p>
          </div>

          {/* Peptide selector */}
          <div className="card" style={{ marginBottom: 8 }}>
            <select value={peptideId} onChange={e => { setPeptideId(e.target.value); const p = PEPTIDE_DB[e.target.value]; if (p) { setPepAmount(p.amountMg); setPepRoute(p.routes[0]); setPepResult(null); } }} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 13 }}>
              {PEPTIDE_LIST.map(p => <option key={p.id} value={p.id}>{p.shortName} РІР‚вЂќ {p.name} ({p.className})</option>)}
            </select>
            {PEPTIDE_DB[peptideId] && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {PEPTIDE_DB[peptideId].effects.map(e => (
                  <span key={e} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{e}</span>
                ))}
              </div>
            )}
          </div>

          {/* Dilution calculator */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>СЂСџвЂ™В§ Р В Р В°Р В·Р Р†Р ВµР Т‘Р ВµР Р…Р С‘Р Вµ</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р вЂ™Р С• РЎвЂћР В»Р В°Р С”Р С•Р Р…Р Вµ</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepAmount} onChange={e => setPepAmount(Number(e.target.value))} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepAmountUnit} onChange={e => setPepAmountUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mg">Р СР С–</option><option value="mcg">Р СР С”Р С–</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р В Р В°РЎРѓРЎвЂљР Р†Р С•РЎР‚Р С‘РЎвЂљР ВµР В»РЎРЉ (Р СР В»)</label>
                <input type="number" step="0.1" value={pepDilution} onChange={e => setPepDilution(Number(e.target.value))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р вЂќР С•Р В·Р В°</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepDose} onChange={e => setPepDose(Number(e.target.value))} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepDoseUnit} onChange={e => setPepDoseUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mcg">Р СР С”Р С–</option><option value="mg">Р СР С–</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р РЃР С—РЎР‚Р С‘РЎвЂ </label>
                <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as keyof typeof SYRINGE_TYPES)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р РЋР С—Р С•РЎРѓР С•Р В± Р Р†Р Р†Р ВµР Т‘Р ВµР Р…Р С‘РЎРЏ</label>
                <select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Course parameters */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>СЂСџвЂњвЂ¦ Р СџР В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№ Р С”РЎС“РЎР‚РЎРѓР В°</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {WEEK.map(d => (
                <button key={d} onClick={() => setPepSchedule(pepSchedule.includes(d) ? pepSchedule.filter(x => x !== d) : [...pepSchedule, d].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)))} style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
                  background: pepSchedule.includes(d) ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                  border: pepSchedule.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: pepSchedule.includes(d) ? '#00e68a' : 'var(--text-dim)', fontWeight: pepSchedule.includes(d) ? 700 : 400,
                }}>{d === 'Mon' ? '' : d === 'Tue' ? '' : d === 'Wed' ? '' : d === 'Thu' ? '' : d === 'Fri' ? '' : d === 'Sat' ? '' : ''}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р вЂќР В»Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р С•РЎРѓРЎвЂљРЎРЉ (Р Т‘Р Р…Р С‘):</label>
              <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(Number(e.target.value))} style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р ВР Р…РЎР‰Р ВµР С”РЎвЂ Р С‘Р в„–: {pepSchedule.length}/Р Р…Р ВµР Т‘</span>
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
            СЂСџВ§В¬ Р В Р В°РЎРѓРЎРѓРЎвЂЎР С‘РЎвЂљР В°РЎвЂљРЎРЉ
          </button>

          {/* Results */}
          {pepResult && (
            <>
              {/* Dilution results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>СЂСџвЂњР‰ Р В Р ВµР В·РЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂљРЎвЂ№ РЎР‚Р В°Р В·Р Р†Р ВµР Т‘Р ВµР Р…Р С‘РЎРЏ</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Р С™Р С•Р Р…РЎвЂ Р ВµР Р…РЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.concentrationMcgPerMl.toFixed(1)} Р СР С”Р С–/Р СР В»</span>
                  <span style={{ color: 'var(--text-dim)' }}>Р С›Р В±РЎР‰РЎвЂР С Р Т‘Р С•Р В·РЎвЂ№:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.doseVolumeMl.toFixed(3)} Р СР В»</span>
                  <span style={{ color: 'var(--text-dim)' }}>Р вЂќР ВµР В»Р ВµР Р…Р С‘РЎРЏ РЎв‚¬Р С—РЎР‚Р С‘РЎвЂ Р В°:</span><span style={{ fontWeight: 600, color: pepResult.dilution.syringeUnits > SYRINGE_TYPES[pepSyringe].maxUnits ? '#ef4444' : 'var(--text-light)' }}>{pepResult.dilution.syringeUnitsDisplay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Р вЂќР С•Р В· Р Р†Р С• РЎвЂћР В»Р В°Р С”Р С•Р Р…Р Вµ:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.dosesPerVial.toFixed(1)}</span>
                </div>
              </div>

              {/* Bioavailability */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂ™вЂ° Р вЂР С‘Р С•Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р С•РЎРѓРЎвЂљРЎРЉ ({ROUTE_LABELS[pepRoute]})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Р СљР С‘Р Р…</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMinMcg.toFixed(0)} Р СР С”Р С–</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.1)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Р РЋРЎР‚Р ВµР Т‘Р Р…РЎРЏРЎРЏ</div>
                    <div style={{ fontWeight: 700, color: '#00e68a' }}>{pepResult.effective.effectiveAvgMcg.toFixed(0)} Р СР С”Р С–</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Р СљР В°Р С”РЎРѓ</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMaxMcg.toFixed(0)} Р СР С”Р С–</div>
                  </div>
                </div>
              </div>

              {/* PK Results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂњв‚¬ PKРІР‚вЂР СР С•Р Т‘Р ВµР В»РЎРЉ</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Р СљР В°Р С”РЎРѓ. Р С”Р С•Р Р…РЎвЂ Р ВµР Р…РЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.maxConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Р РЋРЎР‚Р ВµР Т‘Р Р…РЎРЏРЎРЏ Р С”Р С•Р Р…РЎвЂ Р ВµР Р…РЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.avgConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Steady-state (Р Т‘Р ВµР Р…РЎРЉ):</span><span style={{ fontWeight: 600 }}>~{pepResult.pk.steadyStateDay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>t<sub>1/2</sub> (Р Т‘Р Р…Р С‘):</span><span style={{ fontWeight: 600 }}>{pepResult.pk.halfLifeDays.toFixed(2)}</span>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '2px 4px', textAlign: 'left' }}>Р вЂќР ВµР Р…РЎРЉ</th>
                        <th style={{ padding: '2px 4px' }}>Р ВР Р…РЎР‰Р ВµР С”РЎвЂ Р С‘РЎРЏ</th>
                        <th style={{ padding: '2px 4px', textAlign: 'right' }}>Р С™Р С•Р Р…РЎвЂ .</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pepResult.pk.days.map(d => (
                        <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: d.inject ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                          <td style={{ padding: '2px 4px' }}>{d.day} ({d.weekday === 'Mon' ? '' : d.weekday === 'Tue' ? '' : d.weekday === 'Wed' ? '' : d.weekday === 'Thu' ? '' : d.weekday === 'Fri' ? '' : d.weekday === 'Sat' ? '' : ''})</td>
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>{d.inject ? 'СЂСџвЂ™вЂ°' : ''}</td>
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>РІС™В  Р В Р С‘РЎРѓР С”Р С‘: {PEPTIDE_DB[peptideId].shortName}</h4>
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
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџвЂќвЂ” Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘ Р С‘ Р С”Р С•Р Р…РЎвЂћР В»Р С‘Р С”РЎвЂљРЎвЂ№</h4>
                {getPeptideSynergiesFor(peptideId).length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Р РЋР С‘Р Р…Р ВµРЎР‚Р С–Р С‘Р С‘:</span>
                    {getPeptideSynergiesFor(peptideId).map(s => (
                      <span key={s.partner} style={{ fontSize: 9, marginLeft: 6, color: '#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                    ))}
                  </div>
                )}
                {getPeptideConflictsFor(peptideId).length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Р С™Р С•Р Р…РЎвЂћР В»Р С‘Р С”РЎвЂљРЎвЂ№:</span>
                    {getPeptideConflictsFor(peptideId).map(c => (
                      <span key={c.partner} style={{ fontSize: 9, marginLeft: 6, color: '#ef4444' }}>{c.partnerName} (severity: {c.severity})</span>
                    ))}
                  </div>
                )}
                {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Р СњР ВµРЎвЂљ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦</span>
                )}
              </div>
            </>
          )}

          {/* Protocol generator */}
          <div className="card">
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>СЂСџР‹Р‡ Р вЂњР ВµР Р…Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚ Р С—РЎР‚Р С•РЎвЂљР С•Р С”Р С•Р В»Р В° Р С—Р С• РЎвЂ Р ВµР В»Р С‘</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
                <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#8b5cf6', fontWeight: 500,
                }}>
                  {goal === 'muscle_growth' ? 'СЂСџвЂ™Р„ Р В Р С•РЎРѓРЎвЂљ Р СРЎвЂ№РЎв‚¬РЎвЂ ' : goal === 'fat_loss' ? 'СЂСџвЂќТђ Р вЂ“Р С‘РЎР‚Р С•РЎРѓР В¶Р С‘Р С–Р В°Р Р…Р С‘Р Вµ' : goal === 'recovery' ? 'СЂСџвЂќвЂћ Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ' : goal === 'gi_healing' ? 'СЂСџВ«С“ Р вЂ“Р С™Р Сћ' : goal === 'mitochondria' ? 'СЂСџВ§В¬ Р СљР С‘РЎвЂљР С•РЎвЂ¦Р С•Р Р…Р Т‘РЎР‚Р С‘Р С‘' : goal === 'focus' ? 'СЂСџР‹Р‡ Р В¤Р С•Р С”РЎС“РЎРѓ' : 'СЂСџВТ‘ Р РЋР С•Р Р…'}
                </button>
              ))}
            </div>
            {pepProtocol && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{pepProtocol.goal === 'muscle_growth' ? '' : pepProtocol.goal}: synergy score <span style={{ color: '#8b5cf6' }}>{pepProtocol.synergyScore.toFixed(1)}</span></div>
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

      {/* ===== PROTOCOL ===== */}
      {tab === 'protocol' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>СЂСџвЂњвЂ¦ Р СњР ВµР Т‘Р ВµР В»РЎРЉР Р…РЎвЂ№Р в„– Р С—РЎР‚Р С•РЎвЂљР С•Р С”Р С•Р В»</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Р В Р В°РЎРѓР С—Р С‘РЎРѓР В°Р Р…Р С‘Р Вµ Р С—РЎР‚Р С‘РЎвЂР СР В° Р С—РЎР‚Р ВµР С—Р В°РЎР‚Р В°РЎвЂљР С•Р Р† Р С‘ Р Т‘Р С•Р В±Р В°Р Р†Р С•Р С” Р С—Р С• Р Т‘Р Р…РЎРЏР С Р Р…Р ВµР Т‘Р ВµР В»Р С‘
            </p>
            {!autoProtocol && (
              <button onClick={() => {
                const courseIds: { substanceId: string; dose: string }[] = linked.course.map(c => ({
                  substanceId: c.substanceId,
                  dose: `${c.doseValue} ${c.doseUnit}`,
                }));
                const goalId = linked.course.some(c => c.substanceId.includes('test')) ? 'mass_gain' : 'health';
                const protocol = generateWeeklyProtocol(goalId, courseIds as any, Object.keys(linked.supportCoverage || {}),
                  undefined, linked.course.some(c => c.substanceId.includes('test')) ? 'course' : 'baseline', []);
                setAutoProtocol(protocol);
              }} style={{
                width: '100%', padding: 12, background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}>
                СЂСџвЂњвЂ¦ Р РЋР С–Р ВµР Р…Р ВµРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎвЂљР С•Р С”Р С•Р В»
              </button>
            )}
          </div>
          {autoProtocol && (
            <div className="card">
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
                Р РЋР С•Р В±Р В»РЎР‹Р Т‘Р ВµР Р…Р С‘Р Вµ: {autoProtocol.overallAdherenceScore}%
              </div>
              {autoProtocol.days.map((day: any, i: number) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 2 }}>{day.date}</div>
                  {day.slots.map((slot: any, j: number) => (
                    <div key={j} style={{ marginLeft: 6, marginBottom: 2 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                        {slot.time === 'morning' ? 'СЂСџРЉвЂ¦ Р Р€РЎвЂљРЎР‚Р С•' : slot.time === 'evening' ? 'СЂСџРЉв„ў Р вЂ™Р ВµРЎвЂЎР ВµРЎР‚' : ''}
                      </div>
                      {slot.substances.map((s: any, k: number) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
                          <span>{s.name}</span><span style={{ color: 'var(--accent)' }}>{s.dose}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={() => setAutoProtocol(null)} style={{
                background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 12px', fontSize: 10, cursor: 'pointer', marginTop: 6,
              }}>РІСљвЂў Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ</button>
            </div>
          )}
        </div>
      )}

      {/* ===== RECS TAB ===== */}
      {tab === 'recs' && <RecsTab profile={linked.profile} labs={labAnalysis} readiness={linked.readiness} course={linked.course} />}
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
    <button onClick={run} style={{ width:'100%', padding:12, borderRadius:8, border:'none', cursor:'pointer', marginBottom:10, background:'linear-gradient(135deg,#8b5cf6,#6366f1)', color:'#fff', fontWeight:700, fontSize:14 }}>СЂСџвЂ™РЋ Р РЋР С–Р ВµР Р…Р ВµРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎР‚Р ВµР С”Р С•Р СР ВµР Р…Р Т‘Р В°РЎвЂ Р С‘Р С‘</button>
    <div className="card" style={{ marginBottom:8 }}><div style={{ fontSize:11, fontWeight:700, color:st.train?'#22c55e':'#ef4444' }}>{st.train ? '' : 'СЂСџвЂќТ‘ Р С›РЎвЂљР Т‘РЎвЂ№РЎвЂ¦'}</div><div style={{ fontSize:9, color:'var(--text-dim)' }}>{st.reason}</div></div>
    {fusion && <div className="card" style={{ marginBottom:8 }}><h4 style={{ margin:'0 0 4px', fontSize:12 }}>СЂСџР‹Р‡ Fusion Decision</h4><div style={{ fontSize:9 }}>{fusion.overallRecommendation}</div></div>}
    {recs.map((r,i) => <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600, fontSize:11, color: r.severity === 'critical' ? '#ef4444' : r.severity === 'high' ? '#f59e0b' : r.severity === 'medium' ? '#f97316' : '#22c55e' }}>{r.title}</div>
      <div style={{ fontSize:9, color:'var(--text-light)' }}>{r.message}</div>
      {r.actionItems?.map((a:any,ai:number)=><div key={ai} style={{ fontSize:8, color:'var(--text-dim)', marginLeft:6 }}>РІР‚Сћ {a}</div>)}
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
      {optResult.essential?.length > 0 && <div style={{ marginBottom:4 }}><div style={{ fontSize:9,fontWeight:600,color:'#ef4444' }}>СЂСџвЂќТ‘ Р С›Р В±РЎРЏР В·Р В°РЎвЂљР ВµР В»РЎРЉР Р…Р С•</div>{optResult.essential.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} РІР‚вЂќ {r.dosage} {r.timing}</div>)}</div>}
      {optResult.recommended?.length > 0 && <div style={{ marginBottom:4 }}><div style={{ fontSize:9,fontWeight:600,color:'#f59e0b' }}>СЂСџСџВ  Р В Р ВµР С”Р С•Р СР ВµР Р…Р Т‘Р С•Р Р†Р В°Р Р…Р С•</div>{optResult.recommended.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} РІР‚вЂќ {r.dosage} {r.timing}</div>)}</div>}
      {optResult.optional?.length > 0 && <div><div style={{ fontSize:9,fontWeight:600,color:'#22c55e' }}>СЂСџСџСћ Р С›Р С—РЎвЂ Р С‘Р С•Р Р…Р В°Р В»РЎРЉР Р…Р С•</div>{optResult.optional.map((r:any,i:number)=><div key={i} style={{ fontSize:8,padding:'2px 6px' }}>{r.name} РІР‚вЂќ {r.dosage} {r.timing}</div>)}</div>}
      {optResult.totalMonthlyCost && <div style={{ fontSize:8,color:'var(--text-dim)',marginTop:4 }}>СЂСџвЂ™В° {optResult.totalMonthlyCost}</div>}
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
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>рџ“‹ РЎРІРѕРґРєР°</h4>
    <div style={{ fontSize:10 }}>Р РёСЃРє: {report.summary.total_risk}% в†’ {report.summary.risk_after_support}% ({report.summary.risk_level})</div>
    <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>РўРѕРї СЃРёСЃС‚РµРј: {(report.summary as any).top_systems?.map((s:any)=>s.name).join(', ')}</div>
  </div>);
};

const StackBuilderSection: React.FC = () => {
  const [sbGoal, setSbGoal] = React.useState('muscle_growth');
  const [sbResult, setSbResult] = React.useState<StackResult | null>(null);
  const goals = ['muscle_growth','fat_loss','recovery','focus','sleep','mitochondria','gi_healing','immune_boost'];
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>СЂСџРЏвЂ” Р СџР С•РЎРѓРЎвЂљРЎР‚Р С•Р С‘РЎвЂљР ВµР В»РЎРЉ РЎРѓРЎвЂљР ВµР С”Р В°</h4>
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
