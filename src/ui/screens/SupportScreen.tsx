import React, { useState, useMemo, useEffect } from 'react';
import { SYNERGY_PAIRS, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, searchSupport, getSubstanceInfo, getSupportDatabaseStats, type SupportInput, type SynergyPair, type SupplementTarget } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { INTERACTIONS_DB } from '../../data/interactions';
import { ALL_SUBSTANCES, ALL_INTERACTIONS, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
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
import { optimizeStack as newOptimizeStack, deriveSystemCoverage, getSubstanceName, describeStack, type StackResult as OptimizerStackResult, type StackSynergyInfo } from '../../engines/stack-optimizer.engine';
import { generateStack, selectBestStack, type StackResult } from '../../engines/stack-builder.engine';
import { ReportEngine, type ReportInput } from '../../engines/report-engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../core/types';

type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
type SupportView = 'main' | 'calc' | 'fertility';
type CalcView = 'main' | 'calculator' | 'peptides' | 'info';
type InfoView = 'main' | 'catalog' | 'synergies' | 'stacks' | 'interactions';

const INTERACTION_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  synergy: { label: 'Синергия', emoji: '🔗', color: '#22c55e' },
  conflict: { label: 'Конфликт', emoji: '⚠️', color: '#ef4444' },
  caution: { label: 'Предупреждение', emoji: 'ℹ️', color: '#f59e0b' },
};

const INTERACTION_SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Низкая', color: '#84cc16' },
  MEDIUM: { label: 'Средняя', color: '#f59e0b' },
  HIGH: { label: 'Высокая', color: '#ef4444' },
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  vitamin: { label: 'Витамины', emoji: '🧪' },
  minerals: { label: 'Минералы', emoji: '⚡' },
  mineral: { label: 'Минералы', emoji: '⚡' },
  amino: { label: 'Аминокислоты', emoji: '🧬' },
  aminoacid: { label: 'Аминокислоты', emoji: '🧬' },
  peptide: { label: 'Пептиды', emoji: '🔬' },
  antioxidant: { label: 'Антиоксиданты', emoji: '🛡' },
  immune: { label: 'Иммунитет', emoji: '🛡' },
  hormone: { label: 'Гормоны', emoji: '⚕️' },
  hormonal: { label: 'Гормоны', emoji: '⚕️' },
  fatty_acid: { label: 'Жирные кислоты', emoji: '💧' },
  lipids: { label: 'Липиды', emoji: '💧' },
  nootropic: { label: 'Ноотропы', emoji: '🧠' },
  neuro: { label: 'Нервная система', emoji: '🧠' },
  brain: { label: 'Мозг', emoji: '🧠' },
  cardio: { label: 'Сердечно-сосудистая', emoji: '❤️' },
  heart: { label: 'Сердце', emoji: '❤️' },
  vascular: { label: 'Сосуды', emoji: '🩸' },
  VESSELS: { label: 'Сосуды', emoji: '🩸' },
  GI: { label: 'ЖКТ', emoji: '🫃' },
  liver: { label: 'Печень', emoji: '🍃' },
  kidney: { label: 'Почки', emoji: '🫘' },
  mitochondria: { label: 'Митохондрии', emoji: '🔋' },
  energy: { label: 'Энергия', emoji: '⚡' },
  adaptogen: { label: 'Адаптогены', emoji: '🌿' },
  fungi: { label: 'Грибы', emoji: '🍄' },
  probiotic: { label: 'Пробиотики', emoji: '🦠' },
  prebiotic: { label: 'Пребиотики', emoji: '🦠' },
  postbiotic: { label: 'Постбиотики', emoji: '🦠' },
  skin: { label: 'Кожа', emoji: '✨' },
  bone: { label: 'Кости и суставы', emoji: '🦴' },
  joint: { label: 'Суставы', emoji: '🦴' },
  joints: { label: 'Суставы', emoji: '🦴' },
  blood: { label: 'Кровь', emoji: '💉' },
  detox: { label: 'Детокс', emoji: '🧹' },
  antiaging: { label: 'Антивозрастное', emoji: '⏳' },
  epigenetic: { label: 'Эпигенетика', emoji: '🧬' },
  methylation: { label: 'Метилирование', emoji: '🔄' },
  DNA: { label: 'ДНК', emoji: '🧬' },
  pharma: { label: 'Фармацевтика', emoji: '💊' },
  polyphenol: { label: 'Полифенолы', emoji: '🍃' },
  sleep: { label: 'Сон', emoji: '😴' },
  calming: { label: 'Успокаивающие', emoji: '🧘' },
  anxiolytic: { label: 'Противотревожные', emoji: '🧘' },
  antiinflammatory: { label: 'Противовоспалительные', emoji: '🔥' },
  antiviral: { label: 'Противовирусные', emoji: '🦠' },
  antimicrobial: { label: 'Антимикробные', emoji: '🦠' },
  antibiotic: { label: 'Антибиотики', emoji: '💊' },
  thyroid: { label: 'Щитовидная железа', emoji: '🦋' },
  hair: { label: 'Волосы', emoji: '💇' },
  lung: { label: 'Лёгкие', emoji: '🫁' },
  LUNGS: { label: 'Лёгкие', emoji: '🫁' },
  electrolyte: { label: 'Электролиты', emoji: '⚡' },
  trace: { label: 'Микроэлементы', emoji: '⚡' },
  eye: { label: 'Зрение', emoji: '👁️' },
  vision: { label: 'Зрение', emoji: '👁️' },
  oral: { label: 'Полость рта', emoji: '🦷' },
  male: { label: 'Мужское здоровье', emoji: '♂️' },
  female: { label: 'Женское здоровье', emoji: '♀️' },
  prostate: { label: 'Простата', emoji: '🫘' },
  pain: { label: 'Обезболивающие', emoji: '💊' },
  analgesic: { label: 'Анальгетики', emoji: '💊' },
  insulin: { label: 'Инсулин', emoji: '💉' },
  glucose: { label: 'Глюкоза', emoji: '🍬' },
  metabolism: { label: 'Метаболизм', emoji: '⚡' },
  METABOLIC: { label: 'Метаболизм', emoji: '⚡' },
  repair: { label: 'Регенерация', emoji: '🔄' },
  regeneration: { label: 'Регенерация', emoji: '🔄' },
  cell: { label: 'Клеточное здоровье', emoji: '🧫' },
  hydration: { label: 'Гидратация', emoji: '💧' },
  collagen: { label: 'Коллаген', emoji: '🧶' },
  stress: { label: 'Стресс', emoji: '😰' },
  mood: { label: 'Настроение', emoji: '😊' },
  testosterone: { label: 'Тестостерон', emoji: '💪' },
  HPG: { label: 'Гипоталамус-гипофиз-гонады', emoji: '🧬' },
  HPT: { label: 'Гипоталамус-гипофиз-тиреоид', emoji: '🦋' },
  HPA: { label: 'Гипоталамус-гипофиз-надпочечники', emoji: '🧬' },
  nerve: { label: 'Нервы', emoji: '🧠' },
  tendon: { label: 'Сухожилия', emoji: '🦵' },
  muscle: { label: 'Мышцы', emoji: '💪' },
  anabolic: { label: 'Анаболики', emoji: '💪' },
  fat_loss: { label: 'Жиросжигание', emoji: '🔥' },
  performance: { label: 'Производительность', emoji: '🏃' },
  recovery: { label: 'Восстановление', emoji: '😴' },
  anti_glycation: { label: 'Антигликация', emoji: '🍬' },
  enzyme: { label: 'Ферменты', emoji: '🧪' },
  enzymes: { label: 'Ферменты', emoji: '🧪' },
};

const getCategoryInfo = (cat: string): { label: string; emoji: string } =>
  CATEGORY_LABELS[cat] || { label: cat, emoji: '📦' };

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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<string>('all');
  const [interactionSeverityFilter, setInteractionSeverityFilter] = useState<string>('all');
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

  // Manual stack builder state
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [manualDoses, setManualDoses] = useState<Record<string, number>>({});
  const [manualSearch, setManualSearch] = useState('');
  const [manualFilter, setManualFilter] = useState<string>('all');
  const [manualResult, setManualResult] = useState<OptimizerStackResult | null>(null);

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
      description: s.description || SUPPORT_CLASS_LABELS[s.class] || s.class,
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
      list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));
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

  // Group ALL_SUBSTANCES by primary category for catalog
  const groupedSubstances = useMemo(() => {
    const groups: Record<string, SupportSubstance[]> = {};
    const filtered = searchQuery
      ? ALL_SUBSTANCES.filter(s =>
          (s.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.id||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.categories||[]).some(c => (c||'').toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.mechanisms||[]).some(m => (m||'').toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : ALL_SUBSTANCES;
    for (const sub of filtered) {
      const primaryCat = (sub.categories||[])[0] || 'other';
      if (!groups[primaryCat]) groups[primaryCat] = [];
      groups[primaryCat].push(sub);
    }
    return Object.entries(groups)
      .map(([cat, items]) => ({ cat, items, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [searchQuery]);

  // Merge ALL_INTERACTIONS + SYNERGY_PAIRS for synergies tab
  const mergedInteractions = useMemo(() => {
    const fromDB = ALL_INTERACTIONS.map(i => ({ ...i, source: 'db' as const }));
    const fromEngine = SYNERGY_PAIRS.map((p, idx) => ({
      interactionId: `synergy_pair_${idx}`,
      substanceA: p.substanceA,
      substanceB: p.substanceB,
      type: 'synergy' as const,
      effect: p.mechanism || `Синергия: ${p.synergyType}`,
      mechanisms: p.affectedSystems || [],
      severity: (p.strength > 0.7 ? 'HIGH' : p.strength > 0.4 ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
      notes: p.clinicalNote || '',
      source: 'engine' as const,
    }));
    return [...fromDB, ...fromEngine];
  }, []);

  const filteredInteractions = useMemo(() => {
    let list = mergedInteractions;
    if (interactionTypeFilter !== 'all') {
      list = list.filter(i => i.type === interactionTypeFilter);
    }
    if (interactionSeverityFilter !== 'all') {
      list = list.filter(i => i.severity === interactionSeverityFilter);
    }
    return list;
  }, [interactionTypeFilter, interactionSeverityFilter, mergedInteractions]);

  // Grouped stacks by size
  const groupedStacks = useMemo(() => {
    const getSizeGroup = (count: number): string => {
      if (count <= 3) return '3';
      if (count <= 5) return '4-5';
      if (count <= 7) return '6-7';
      if (count <= 9) return '8-9';
      return '10+';
    };
    const groups: Record<string, SupportStack[]> = {};
    for (const s of ALL_STACKS) {
      const g = getSizeGroup(s.substances.length);
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    const order = ['3', '4-5', '6-7', '8-9', '10+'];
    const labels: Record<string, string> = {
      '3': 'Мини-стеки (3 вещества)', '4-5': 'Базовые стеки (4-5 веществ)',
      '6-7': 'Расширенные стеки (6-7 веществ)', '8-9': 'Продвинутые стеки (8-9 веществ)',
      '10+': 'Максимальные стеки (10+ веществ)',
    };
    return order.filter(g => groups[g]).map(g => ({ key: g, label: labels[g] || g, stacks: groups[g] }));
  }, []);

  // Filtered stacks by search
  const [stackSearch, setStackSearch] = useState('');
  const filteredStacks = useMemo(() => {
    if (!stackSearch) return ALL_STACKS;
    const q = stackSearch.toLowerCase();
    return ALL_STACKS.filter(s =>
      (s.effects||[]).some(e => ((EFFECT_LABELS_ru[e] || e)||'').toLowerCase().includes(q)) ||
      (s.substances||[]).some(sid => (getStackSubLabel(sid)||'').toLowerCase().includes(q))
    );
  }, [stackSearch]);

  // Resolve substance name from ID (used in interactions)
  const resolveSubName = (id: string): string => {
    const sub = ALL_SUBSTANCES.find(s => s.id === id);
    if (sub) return sub.name;
    const pharma = PHARMA_DB[id];
    if (pharma) return pharma.name;
    return id;
  };

  return (
    <div className="screen support-screen">
      {/* ===== MAIN HERO ===== */}
      {tab === 'main' && supportView === 'main' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/support-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div onClick={() => setSupportView('calc')} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.1)', fontSize:20 }}>🧮</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'var(--accent)' }}>Расчет поддержки</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Калькулятор поддержки, пептидный калькулятор, каталог, синергии и готовые стеки</div>
                </div>
                <span style={{ color:'var(--accent)', fontSize:16, opacity:0.6 }}>→</span>
              </div>
              <div onClick={() => setSupportView('fertility')} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(139,92,246,0.1)', fontSize:20 }}>🧬</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'#8b5cf6' }}>ПКТ и Фертильность</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Анализы, план ПКТ и восстановление фертильности</div>
                </div>
                <span style={{ color:'#8b5cf6', fontSize:16, opacity:0.6 }}>→</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUB-NAVIGATION (calc / fertility menus) ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'main' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/calc-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <button onClick={() => setSupportView('main')} style={{ alignSelf:'flex-start', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'8px 0 2px', textShadow:'0 2px 10px rgba(0,0,0,0.9)' }}>Расчет поддержки</h2>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', textShadow:'0 1px 6px rgba(0,0,0,0.8)' }}>
              Калькулятор поддержки, пептидный калькулятор и общая информация
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { icon:'🧮', title:'Калькулятор поддержки', desc:'Расчёт рисков, покрытия систем и недельного протокола', action:() => { setSupportView('main'); setTab('calculator'); }, color:'var(--accent)' },
                { icon:'🧬', title:'Пептидный калькулятор', desc:'Разведение, дозировки, PK модель и протоколы', action:() => { setSupportView('main'); setTab('peptides'); }, color:'var(--accent)' },
                { icon:'ℹ️', title:'Общая информация', desc:'Каталог, синергии и взаимодействия, готовые стеки', action:() => { setCalcView('info'); setInfoView('catalog'); }, color:'#3b82f6' },
              ].map((card, i) => (
                <div key={i} onClick={card.action} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)',
                }}>
                  <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'main' && supportView === 'calc' && calcView === 'info' && (
        <div style={{ padding:'0 0 70px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, alignSelf:'flex-start' }}>← Назад</button>
          {/* Pills */}
          <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexShrink:0 }}>
            {(['catalog','synergies','stacks','interactions'] as const).map(t => (
              <button key={t} onClick={() => setInfoView(t)} style={{
                padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: infoView === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: infoView === t ? '#000' : 'var(--text-dim)',
                border: `1px solid ${infoView === t ? 'var(--accent)' : 'var(--border)'}`,
              }}>{t === 'catalog' ? '📖 Каталог' : t === 'synergies' ? '🔗 Синергии' : t === 'stacks' ? '📦 Стеки' : '⚡ Взаимодействия'}</button>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            {infoView === 'catalog' && (
              <div>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:12 }} />
                </div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
                  {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${ALL_SUBSTANCES.length}` : `Всего: ${ALL_SUBSTANCES.length} веществ`}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {groupedSubstances.map(group => {
                    const catInfo = getCategoryInfo(group.cat);
                    const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
                    return (
                      <div key={group.cat} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                          <span style={{ fontSize:14 }}>{catInfo.emoji}</span>
                          <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{catInfo.label}</div>
                          <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.count}</span>
                          <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop:'1px solid var(--border)' }}>
                            {group.items.map(sub => (
                              <div key={sub.id}>
                                <div onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub.name}</div>
                                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub.categories||[]).slice(0,2).map(c => <span key={c} style={{ fontSize:7, padding:'1px 3px', borderRadius:2, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{c}</span>)}
                                      {(sub.mechanisms||[]).slice(0,1).map(m => <span key={m} style={{ fontSize:7, padding:'1px 3px', borderRadius:2, background:'rgba(0,230,138,0.06)', color:'var(--accent-green)' }}>{m.slice(0,25)}</span>)}
                                    </div>
                                  </div>
                                  <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                </div>
                                {selectedSub === sub.id && (
                                  <div style={{ padding:'6px 10px 8px 14px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginBottom:4 }}>{sub.description}</div>
                                    {/* Type badge */}
                                    <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                      {sub.type}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,2).join(', ') : ''}
                                    </div>
                                    {/* All mechanisms */}
                                    {sub.mechanisms && sub.mechanisms.length > 0 && (
                                      <div style={{ marginBottom:3 }}>
                                        <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Механизмы действия:</div>
                                        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                          {sub.mechanisms.map((m,i) => (
                                            <span key={i} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.06)', color:'#00e68a' }}>{m}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Organs */}
                                    {sub.organs && sub.organs.length > 0 && (
                                      <div style={{ marginBottom:3 }}>
                                        <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Органы-мишени:</div>
                                        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                          {sub.organs.map(o => <span key={o} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(59,130,246,0.08)', color:'#60a5fa' }}>{o}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {/* Deficiency */}
                                    {sub.deficiency && sub.deficiency !== 'NONE' && (
                                      <div style={{ fontSize:8, color:'#f59e0b', marginTop:2 }}>Дефицит: {sub.deficiency}</div>
                                    )}
                                    {/* Cross-referenced interactions with this substance */}
                                    {(() => {
                                      const subsInteractions = mergedInteractions.filter(i =>
                                        i.substanceA === sub.id || i.substanceB === sub.id
                                      ).slice(0, 5);
                                      return subsInteractions.length > 0 ? (
                                        <div style={{ marginTop:4 }}>
                                          <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Взаимодействия:</div>
                                          {subsInteractions.map(i => {
                                            const isA = i.substanceA === sub.id;
                                            const partner = isA ? i.substanceB : i.substanceA;
                                            const pName = resolveSubName(partner);
                                            const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
                                            return (
                                              <div key={i.interactionId} style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 0', lineHeight:1.3 }}>
                                                <span style={{ color:tColor, fontWeight:600 }}>{i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}</span>
                                                {' '}{pName} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                                                {i.notes && <span style={{ opacity:0.6 }}>: {i.notes.slice(0,40)}</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {groupedSubstances.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
              </div>
            )}
            {infoView === 'synergies' && (
              <div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {(['all','LOW','MEDIUM','HIGH'] as const).map(s => (
                    <button key={s} onClick={() => setInteractionSeverityFilter(s)} style={{
                      padding:'4px 8px', borderRadius:10, fontSize:8, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'transparent',
                      color: interactionSeverityFilter === s ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'var(--border)'}`,
                    }}>{s === 'all' ? '♾️ Все' : `${INTERACTION_SEVERITY_LABELS[s]?.label||s}`}</button>
                  ))}
                  <div style={{ fontSize:9, color:'var(--text-dim)', display:'flex', alignItems:'center', marginLeft:2, whiteSpace:'nowrap' }}>{filteredInteractions.length} из {mergedInteractions.length}</div>
                </div>
                {(() => {
                  const synergies = filteredInteractions.filter(i => i.type === 'synergy');
                  const conflicts = filteredInteractions.filter(i => i.type === 'conflict' || i.type === 'caution');
                  const showEffect = (interaction: typeof mergedInteractions[0]) => {
                    const eff = interaction.effect;
                    if (/^[A-Z0-9_]+$/.test(eff) && interaction.notes) return interaction.notes;
                    return eff;
                  };
                  return (<>
                    {/* ===== СИНЕРГИИ ===== */}
                    <div style={{ marginBottom:10 }}>
                      <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_synergies: !(prev.syn_synergies ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
                        <span style={{ fontSize:13 }}>⊕</span>
                        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#22c55e' }}>Синергии ({synergies.length})</div>
                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:expandedCategories.syn_synergies !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                      {expandedCategories.syn_synergies !== false && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {synergies.slice(0, 30).map((interaction, i) => {
                            const sevInfo = INTERACTION_SEVERITY_LABELS[interaction.severity] || { label:interaction.severity, color:'#888' };
                            const aName = resolveSubName(interaction.substanceA);
                            const bName = resolveSubName(interaction.substanceB);
                            return (
                              <div key={interaction.interactionId} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:'3px solid #22c55e' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                                    <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'40%' }}>{aName}</span>
                                    <span style={{ fontSize:10, color:'#22c55e', fontWeight:700 }}>+</span>
                                    <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'40%' }}>{bName}</span>
                                  </div>
                                  <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color, flexShrink:0 }}>{sevInfo.label}</span>
                                </div>
                                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊕ {showEffect(interaction)}</div>
                                {interaction.mechanisms && interaction.mechanisms.length > 0 && (
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                    {interaction.mechanisms.map((m, mi) => (
                                      <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.15)', fontWeight:500 }}>{m}</span>
                                    ))}
                                  </div>
                                )}
                                {interaction.notes && !(/^[A-Z0-9_]+$/.test(interaction.effect)) && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction.notes}</div>}
                              </div>
                            );
                          })}
                          {synergies.length === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет синергий</div>}
                        </div>
                      )}
                    </div>
                    {/* ===== КОНФЛИКТЫ ===== */}
                    <div>
                      <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_conflicts: !(prev.syn_conflicts ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
                        <span style={{ fontSize:13 }}>⊖</span>
                        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#ef4444' }}>Конфликты и осторожность ({conflicts.length})</div>
                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:expandedCategories.syn_conflicts !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                      {expandedCategories.syn_conflicts !== false && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {conflicts.slice(0, 30).map((interaction, i) => {
                            const typeInfo = INTERACTION_TYPE_LABELS[interaction.type] || { label:interaction.type, emoji:'🔗', color:'#888' };
                            const sevInfo = INTERACTION_SEVERITY_LABELS[interaction.severity] || { label:interaction.severity, color:'#888' };
                            const aName = resolveSubName(interaction.substanceA);
                            const bName = resolveSubName(interaction.substanceB);
                            return (
                              <div key={interaction.interactionId} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:`3px solid ${typeInfo.color}` }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                                    <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                                    <span style={{ fontSize:10, color:typeInfo.color, fontWeight:700 }}>{interaction.type === 'conflict' ? '×' : '?'}</span>
                                    <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                                  </div>
                                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                                    <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:typeInfo.color+'22', color:typeInfo.color, fontWeight:600 }}>{typeInfo.label}</span>
                                    <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color }}>{sevInfo.label}</span>
                                  </div>
                                </div>
                                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊖ {showEffect(interaction)}</div>
                                {interaction.mechanisms && interaction.mechanisms.length > 0 && (
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                    {interaction.mechanisms.map((m, mi) => {
                                      const ms = (m||'');
                                      const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                                        ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                                        ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#8b5cf6';
                                      return <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:mColor+'18', color:mColor, border:`1px solid ${mColor}22`, fontWeight:500 }}>{m}</span>;
                                    })}
                                  </div>
                                )}
                                {interaction.notes && !(/^[A-Z0-9_]+$/.test(interaction.effect)) && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction.notes}</div>}
                              </div>
                            );
                          })}
                          {conflicts.length === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет конфликтов</div>}
                        </div>
                      )}
                    </div>
                  </>);
                })()}
              </div>
            )}
            {infoView === 'stacks' && (
              <div>
                <input value={stackSearch} onChange={e => setStackSearch(e.target.value)} placeholder="🔍 Поиск по эффекту или веществу..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {(stackSearch ? [{ key:'search', label:`Результаты (${filteredStacks.length})`, stacks:filteredStacks }] : groupedStacks).map(group => (
                    <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div onClick={() => setExpandedCategories(prev => ({ ...prev, ['stack_'+group.key]: !(prev['stack_'+group.key] ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                        <span style={{ fontSize:13 }}>📋</span>
                        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                        <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.stacks.length}</span>
                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:expandedCategories['stack_'+group.key] !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                      {expandedCategories['stack_'+group.key] !== false && (
                        <div style={{ borderTop:'1px solid var(--border)' }}>
                          {group.stacks.map(stack => {
                            const synergyColor = stack.synergyScore > 20 ? '#22c55e' : stack.synergyScore > 12 ? '#eab308' : '#f59e0b';
                            return (
                              <div key={stack.id} style={{ padding:'6px 10px 8px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                                onClick={() => setExpandedMed(expandedMed === stack.id ? null : stack.id)}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:2, flex:1 }}>
                                    {stack.effects.map(e => <span key={e} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:500 }}>{EFFECT_LABELS_ru[e]||e}</span>)}
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:800, color:synergyColor, marginLeft:4 }}>{stack.synergyScore.toFixed(1)}</span>
                                </div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:expandedMed === stack.id ? 4 : 0 }}>
                                  {stack.substances.map(sid => <span key={sid} style={{ fontSize:8, padding:'1px 6px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.12)', color:'#a78bfa', fontWeight:600 }}>{getStackSubLabel(sid)}</span>)}
                                </div>
                                <div style={{ fontSize:7, color:'var(--text-dim)' }}>{stack.substances.length} веществ</div>
                                {expandedMed === stack.id && (
                                  <div style={{ marginTop:4, padding:'6px 8px', background:'rgba(0,0,0,0.15)', borderRadius:8 }}>
                                    {/* Positive effects */}
                                    <div style={{ marginBottom:4 }}>
                                      <div style={{ fontSize:8, fontWeight:700, color:'#22c55e', marginBottom:3 }}>⊕ Положительные эффекты</div>
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                                        {stack.effects.map(e => (
                                          <span key={e} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#4ade80', fontWeight:600 }}>
                                            {EFFECT_LABELS_ru[e] || e}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Substance breakdown */}
                                    <div style={{ marginBottom:4 }}>
                                      <div style={{ fontSize:8, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>🧬 Компоненты</div>
                                      {stack.substances.map(sid => {
                                        const subInfo = ALL_SUBSTANCES.find(s => s.id === sid);
                                        const cat = subInfo?.categories?.[0];
                                        return (
                                          <div key={sid} style={{ fontSize:7, color:'var(--text-dim)', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', lineHeight:1.4 }}>
                                            <b style={{ color:'#a78bfa' }}>{getStackSubLabel(sid)}</b>
                                            {cat && <span style={{ marginLeft:4, opacity:0.6 }}>· {getCategoryInfo(cat).label}</span>}
                                            {subInfo?.description && <div style={{ opacity:0.7 }}>{subInfo.description.slice(0, 80)}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* Potential conflicts warning */}
                                    {(() => {
                                      const conflictPairs: string[] = [];
                                      for (let a = 0; a < stack.substances.length; a++) {
                                        for (let b = a + 1; b < stack.substances.length; b++) {
                                          const found = ALL_INTERACTIONS.find(i =>
                                            (i.substanceA === stack.substances[a] && i.substanceB === stack.substances[b]) ||
                                            (i.substanceA === stack.substances[b] && i.substanceB === stack.substances[a])
                                          );
                                          if (found && found.type !== 'synergy') conflictPairs.push(`${getStackSubLabel(stack.substances[a])} + ${getStackSubLabel(stack.substances[b])}: ${found.effect} (${found.severity})`);
                                        }
                                      }
                                      return conflictPairs.length > 0 ? (
                                        <div>
                                          <div style={{ fontSize:8, fontWeight:700, color:'#ef4444', marginBottom:2 }}>⚠ Возможные конфликты</div>
                                          {conflictPairs.map((p, i) => <div key={i} style={{ fontSize:7, color:'#f87171', padding:'1px 0', lineHeight:1.3 }}>{p}</div>)}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize:7, color:'#4ade80', opacity:0.6 }}>✓ Конфликтов между компонентами не обнаружено</div>
                                      );
                                    })()}
                                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:3 }}>Оценка синергии: <b style={{ color: synergyColor }}>{stack.synergyScore.toFixed(1)}</b> · {stack.substances.length} веществ</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {stackSearch && filteredStacks.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
              </div>
            )}
            {infoView === 'interactions' && (
              <div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    {(['support','pharma'] as const).map(t => (
                      <button key={t} onClick={() => setInteractTab(t)} style={{
                        flex:1, padding:'7px 0', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                        background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: interactTab === t ? '#000' : 'var(--text-dim)',
                        border: 'none',
                      }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
                    ))}
                  </div>
                  {interactTab === 'support' ? (
                    <div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                        {interactionIds.map((id, idx) => {
                          const selectedName = id ? (allSupport.find(s => s.id === id)?.name || id) : '';
                          return (
                            <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                <span style={{ fontSize:9, color:'var(--text-dim)' }}>Препарат</span>
                              </div>
                              <div style={{ position:'relative' }}>
                                <input value={interactionSearchIdx===idx ? interactionSearch : selectedName} placeholder="🔍 Поиск..." onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }} onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); if (!e.target.value) updateInteraction(idx, ''); }} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                {interactionSearch && interactionSearchIdx===idx && (
                                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:120, overflowY:'auto', marginTop:1 }}>
                                    {allSupport.filter(s => (s.name||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,8).map(s => (
                                      <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); }} style={{ padding:'5px 8px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                        <span style={{ fontWeight:id===s.id?700:400, color:id===s.id?'var(--accent)':'var(--text)' }}>{s.name}</span>
                                        <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{s.id}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button onClick={addInteraction} style={{ padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a' }}>+ Добавить препарат</button>
                      </div>
                      {validInteractionIds.length<2 && <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>}
                      {validInteractionIds.length>=2 && !hasSupportInteractions && <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>}
                      {hasSupportInteractions && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {[
                            { list: supportSynergiesList, label:'⊕ Синергия — положительное взаимодействие', color:'#22c55e' },
                            { list: supportConflicts, label:'⊖ Конфликт — отрицательное взаимодействие', color:'#ef4444' },
                            { list: supportCautions, label:'⚡ Осторожность — потенциальный риск', color:'#f59e0b' },
                          ].filter(s => s.list.length>0).map(section => (
                            <div key={section.label} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                              <div style={{ fontSize:10, fontWeight:700, color:section.color, marginBottom:4 }}>{section.label} ({section.list.length})</div>
                              {section.list.map(i => {
                                const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                                return (
                                  <div key={i.id} style={{ padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <span style={{ color:section.color, fontWeight:700, fontSize:9 }}>{i.substanceA} + {i.substanceB}</span>
                                      <div style={{ display:'flex', gap:3 }}>
                                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:section.color+'22', color:section.color, fontWeight:600 }}>{i.type === 'synergy' ? 'Синергия' : i.type === 'conflict' ? 'Конфликт' : 'Осторожно'}</span>
                                        {i.severity && <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevColor+'22', color:sevColor }}>{i.severity}</span>}
                                      </div>
                                    </div>
                                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:2 }}>{i.effect || ''}</div>
                                    {i.mechanisms && i.mechanisms.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                        {i.mechanisms.map((m: string, mi: number) => (
                                          <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{m}</span>
                                        ))}
                                      </div>
                                    )}
                                    {i.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:1 }}>{i.notes}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                        {(() => {
                          const PHARMA_CORE_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','pct_serm','pct_aromatase','pct_dopamine','pct_gonadotropin']);
                          const pharmaAll = Object.values(PHARMA_DB).filter((s): s is (typeof PHARMA_DB)[string] => !!s?.name && PHARMA_CORE_FILTER.has(s.class));
                          const pharmaFiltered = pharmaInteractSearch ? pharmaAll.filter(s => (s.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase())) : pharmaAll;
                          const pharmaValid = pharmaInteractIds.filter(Boolean);
                          return (<>
                            {pharmaInteractIds.map((id, idx) => {
                              const selectedName = id ? (PHARMA_DB[id]?.name || '') : '';
                              return (
                                <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                    <span style={{ fontSize:9, color:'var(--text-dim)' }}>Препарат</span>
                                  </div>
                                  <div style={{ position:'relative' }}>
                                    <input value={id ? selectedName : pharmaInteractSearch} onChange={e => { setPharmaInteractSearch(e.target.value); if (!e.target.value) { const next=[...pharmaInteractIds]; next[idx]=''; setPharmaInteractIds(next); }}} placeholder="🔍 Поиск..." style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                    {!id && pharmaInteractSearch && (
                                      <div style={{ position:'absolute', zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:120, overflowY:'auto', marginTop:1, width:'calc(100% - 2px)' }}>
                                        {pharmaFiltered.slice(0,8).map(s => <div key={s.id} onClick={() => { const next=[...pharmaInteractIds]; next[idx]=s.id; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'5px 8px', cursor:'pointer', fontSize:9, borderBottom:'1px solid var(--border)' }}><span style={{ fontWeight:600 }}>{s.name}</span><span style={{ marginLeft:4, color:'var(--text-dim)', fontSize:8 }}>{s.class}</span></div>)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            <button onClick={() => setPharmaInteractIds([...pharmaInteractIds, ''])} style={{ padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a' }}>+ Добавить препарат</button>
                            {pharmaValid.length>=2 && checkDrugInteractions(pharmaValid.map((id,i)=>({id:`${id}-${i}`,substanceId:id,doseValue:300,doseUnit:'mg/wk',frequency:'2x/week',startWeek:0,endWeek:12}))).length===0 && (
                              <div style={{ padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', textAlign:'center' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>
                            )}
                            {pharmaValid.length>=2 && checkDrugInteractions(pharmaValid.map((id,i)=>({id:`${id}-${i}`,substanceId:id,doseValue:300,doseUnit:'mg/wk',frequency:'2x/week',startWeek:0,endWeek:12}))).map((alert,i)=>{
                              const c = alert.type==='critical'?'#ff1744':alert.type==='warning'?'#ff9100':'#2979ff';
                              const icon = alert.type==='critical'?'🚫':alert.type==='warning'?'⚠️':'ℹ️';
                              return <div key={i} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px', marginBottom:4, borderLeft:`3px solid ${c}`, border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}><span style={{ fontSize:12 }}>{icon}</span><span style={{ fontWeight:700, fontSize:9, color:c }}>{alert.type==='critical'?'КРИТИЧЕСКОЕ':alert.type==='warning'?'ПРЕДУПРЕЖДЕНИЕ':'ИНФО'}</span></div>
                                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', marginBottom:2 }}>{alert.drugs.join(' + ')}</div>
                                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}><b>Механизм:</b> {alert.mechanism}</div>
                                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}><b>Рекомендация:</b> {alert.recommendation}</div>
                              </div>;
                            })}
                          </>);
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'main' && supportView === 'fertility' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/fertility-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <button onClick={() => setSupportView('main')} style={{ alignSelf:'flex-start', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'8px 0 2px', textShadow:'0 2px 10px rgba(0,0,0,0.9)' }}>ПКТ и Фертильность</h2>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', textShadow:'0 1px 6px rgba(0,0,0,0.8)' }}>
              Анализы, план ПКТ и восстановление фертильности
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { icon:'🩸', title:'Анализы', desc:'Ингибин B, ФСГ, ЛГ, эстрадиол, тестостерон, прогестерон', action:() => setTab('fertility-pct'), color:'#ef4444' },
                { icon:'📋', title:'План ПКТ', desc:'Протокол послекурсовой терапии и таймер', action:() => setTab('fertility-pct'), color:'var(--accent)' },
                { icon:'🌱', title:'План восстановления Фертильности', desc:'Восстановление сперматогенеза и гормонального фона', action:() => setTab('fertility-pct'), color:'#8b5cf6' },
              ].map((card, i) => (
                <div key={i} onClick={card.action} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)',
                }}>
                  <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== NON-MAIN CONTENT (with back button) ===== */}
      {tab !== 'main' && tab !== 'fertility-pct' && (
        <>
          <button onClick={() => setTab('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную</button>

      {/* ===== CATALOG (ALL_SUBSTANCES — 1881+ записей) ===== */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${ALL_SUBSTANCES.length}` : `Всего: ${ALL_SUBSTANCES.length} веществ`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '68vh', overflowY: 'auto', paddingRight: 2 }}>
            {groupedSubstances.map(group => {
              const catInfo = getCategoryInfo(group.cat);
              const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
              return (
                <div key={group.cat} style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: 16 }}>{catInfo.emoji}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>{catInfo.label}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, marginRight: 4 }}>{group.count}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {group.items.map(sub => (
                        <div key={sub.id}>
                          <div onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 12px 7px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name}</div>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                                {(sub.categories||[]).slice(0, 3).map(c => (
                                  <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{c}</span>
                                ))}
                                {(sub.mechanisms||[]).slice(0, 2).map(m => (
                                  <span key={m} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent-green, #00e68a)' }}>{m.slice(0, 30)}</span>
                                ))}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: selectedSub === sub.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                          </div>
                          {selectedSub === sub.id && (
                            <div style={{ padding: '8px 12px 10px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: 6 }}>{sub.description}</div>
                              {/* Type badge */}
                              <div style={{ fontSize: 8, color: 'var(--accent-green, #00e68a)', marginBottom: 4 }}>
                                {sub.type}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 3).join(', ') : ''}
                              </div>
                              {/* All mechanisms */}
                              {sub.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Механизмы действия:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {sub.mechanisms.map((m, i) => (
                                      <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Organs */}
                              {sub.organs && sub.organs.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Органы-мишени:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {sub.organs.map(o => (
                                      <span key={o} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{o}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {sub.deficiency && sub.deficiency !== 'NONE' && (
                                <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 2, marginBottom: 4 }}>
                                  Дефицит: {sub.deficiency}
                                </div>
                              )}
                              {/* Cross-referenced interactions with this substance */}
                              {(() => {
                                const subsInteractions = mergedInteractions.filter(i =>
                                  i.substanceA === sub.id || i.substanceB === sub.id
                                ).slice(0, 6);
                                return subsInteractions.length > 0 ? (
                                  <div style={{ marginTop: 4 }}>
                                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Взаимодействия:</div>
                                    {subsInteractions.map(i => {
                                      const isA = i.substanceA === sub.id;
                                      const partner = isA ? i.substanceB : i.substanceA;
                                      const pName = resolveSubName(partner);
                                      const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
                                      return (
                                        <div key={i.interactionId} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', lineHeight: 1.3 }}>
                                          <span style={{ color: tColor, fontWeight: 600 }}>
                                            {i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}
                                          </span>
                                          {' '}{pName} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                                          {i.severity && <span style={{ opacity: 0.6 }}> · {i.severity}</span>}
                                          {i.notes && <div style={{ opacity: 0.5 }}>{i.notes.slice(0, 60)}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedSubstances.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Ничего не найдено по запросу "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SYNERGIES (ALL_INTERACTIONS — 138+ пар) ===== */}
      {tab === 'synergies' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'wrap' }}>
            {(['all', 'synergy', 'conflict', 'caution'] as const).map(t => (
              <button key={t} onClick={() => setInteractionTypeFilter(t)} style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: interactionTypeFilter === t ? (INTERACTION_TYPE_LABELS[t]?.color || 'var(--accent)') : 'var(--bg-secondary)',
                color: interactionTypeFilter === t ? '#000' : 'var(--text-dim)',
                border: `1px solid ${interactionTypeFilter === t ? (INTERACTION_TYPE_LABELS[t]?.color || 'var(--accent)') : 'var(--border)'}`,
              }}>
                {t === 'all' ? '🧲 Все' : `${INTERACTION_TYPE_LABELS[t]?.emoji || ''} ${INTERACTION_TYPE_LABELS[t]?.label || t}`}
              </button>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
            {(['all', 'LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
              <button key={s} onClick={() => setInteractionSeverityFilter(s)} style={{
                padding: '5px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'transparent',
                color: interactionSeverityFilter === s ? '#000' : 'var(--text-dim)',
                border: `1px solid ${interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'var(--border)'}`,
              }}>
                {s === 'all' ? 'Любая' : `${INTERACTION_SEVERITY_LABELS[s]?.label || s}`}
              </button>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', marginLeft: 4, whiteSpace: 'nowrap' }}>
              {filteredInteractions.length} из {mergedInteractions.length}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>
            {filteredInteractions.map((interaction, i) => {
              const typeInfo = INTERACTION_TYPE_LABELS[interaction.type] || { label: interaction.type, emoji: '🔗', color: '#888' };
              const sevInfo = INTERACTION_SEVERITY_LABELS[interaction.severity] || { label: interaction.severity, color: '#888' };
              const aName = resolveSubName(interaction.substanceA);
              const bName = resolveSubName(interaction.substanceB);
              return (
                  <div key={interaction.interactionId} style={{
                    background: 'var(--bg-secondary)', borderRadius: 10, padding: '9px 10px',
                    borderLeft: `3px solid ${typeInfo.color}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '35%' }}>{aName}</span>
                        <span style={{ fontSize: 12, color: typeInfo.color, fontWeight: 700 }}>
                          {interaction.type === 'synergy' ? '+' : interaction.type === 'conflict' ? '×' : '?'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '35%' }}>{bName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: typeInfo.color + '22', color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: sevInfo.color + '22', color: sevInfo.color }}>{sevInfo.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: 4 }}>
                      {(() => {
                        const eff = interaction.effect;
                        const displayEff = (/^[A-Z0-9_]+$/.test(eff) && interaction.notes) ? interaction.notes : eff;
                        return <>{interaction.type === 'synergy' ? '⊕ ' : interaction.type === 'conflict' ? '⊖ ' : ''}{displayEff}</>;
                      })()}
                    </div>
                    {interaction.mechanisms && interaction.mechanisms.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 2 }}>
                        {interaction.mechanisms.map(m => {
                          const ms = (m||'');
                          const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                            ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                            ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#a78bfa';
                          return <span key={m} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: mColor + '18', color: mColor, border: `1px solid ${mColor}22`, fontWeight: 500 }}>{m}</span>;
                        })}
                      </div>
                    )}
                    {interaction.notes && (
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.3 }}>{interaction.notes}</div>
                    )}
                  </div>
              );
            })}
            {filteredInteractions.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Нет взаимодействий по выбранным фильтрам
              </div>
            )}
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

          {/* ===== MANUAL STACK BUILDER ===== */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div onClick={() => setShowManualBuilder(!showManualBuilder)} style={{ cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>💊 Ручной подбор стека</h4>
              <span style={{ fontSize:16, color:'var(--accent)', transform: showManualBuilder ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>
            {showManualBuilder && <>
              {/* Search */}
              <input value={manualSearch} onChange={e => setManualSearch(e.target.value)}
                placeholder="Поиск по названию или ID..."
                style={{ width:'100%', padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:11, marginTop:6, boxSizing:'border-box' }} />
              
              {/* Category filter */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:6 }}>
                {[
                  { key:'all', label:'🧲 Все' },
                  { key:'vitamin', label:'Витамины' },
                  { key:'mineral', label:'Минералы' },
                  { key:'amino_acid', label:'Аминокислоты' },
                  { key:'antioxidant', label:'Антиоксиданты' },
                  { key:'adaptogen', label:'Адаптогены' },
                  { key:'peptide', label:'Пептиды' },
                  { key:'fatty_acid', label:'Жирные кислоты' },
                  { key:'prebiotic', label:'Пребиотики' },
                  { key:'probiotic', label:'Пробиотики' },
                  { key:'enzyme', label:'Ферменты' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setManualFilter(key)}
                    style={{ padding:'2px 6px', borderRadius:4, fontSize:9, cursor:'pointer', border:'none',
                      background: manualFilter === key ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: manualFilter === key ? '#000' : 'var(--text-dim)', fontWeight: manualFilter === key ? 700 : 400 }}>{label}</button>
                ))}
              </div>

              {/* Substance list */}
              <div style={{ maxHeight:200, overflowY:'auto', marginTop:6, border:'1px solid var(--border-color)', borderRadius:6 }}>
                {ALL_SUBSTANCES
                  .filter(s => {
                    if (manualFilter === 'all') return true;
                    const filterL = manualFilter.toLowerCase();
                    const catMatch = (s.categories||[]).some(c => (c||'').toLowerCase().includes(filterL));
                    const typeMatch = (s.type||'').toLowerCase().includes(filterL);
                    const aliasMatch = filterL === 'vitamin' && s.type === 'vitamin';
                    const aaMatch = filterL === 'amino_acid' && ['amino','aminoacid'].includes((s.type||'').toLowerCase());
                    if (!catMatch && !typeMatch && !aliasMatch && !aaMatch) return false;
                    if (manualSearch && !(s.name||'').toLowerCase().includes(manualSearch.toLowerCase()) && !(s.id||'').toLowerCase().includes(manualSearch.toLowerCase())) return false;
                    return true;
                  })
                  .slice(0, 40)
                  .map(s => {
                    const sel = manualSubs.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => setManualSubs(prev => sel ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 6px', cursor:'pointer', fontSize:10,
                          background: sel ? 'rgba(0,230,138,0.08)' : 'transparent', borderBottom:'1px solid var(--border-color)',
                          color: sel ? '#00e68a' : 'var(--text-light)' }}>
                        <span style={{ width:14, height:14, borderRadius:3, display:'inline-flex', alignItems:'center', justifyContent:'center',
                          border:`1px solid ${sel ? '#00e68a' : 'var(--border)'}`,
                          background: sel ? '#00e68a' : 'transparent', color:'#000', fontSize:9, fontWeight:700 }}>{sel ? '✓' : ''}</span>
                        <span style={{ fontWeight:500 }}>{s.name}</span>
                        <span style={{ color:'var(--text-dim)', fontSize:8 }}>{s.id}</span>
                        <span style={{ color:'var(--text-dim)', fontSize:8, marginLeft:'auto' }}>{s.type}</span>
                      </div>
                    );
                  })}
                {ALL_SUBSTANCES.filter(s => {
                  if (manualFilter === 'all') return true;
                  const filterL = manualFilter.toLowerCase();
                  const catMatch = (s.categories||[]).some(c => (c||'').toLowerCase().includes(filterL));
                  const typeMatch = (s.type||'').toLowerCase().includes(filterL);
                  const aliasMatch = filterL === 'vitamin' && s.type === 'vitamin';
                  const aaMatch = filterL === 'amino_acid' && ['amino','aminoacid'].includes((s.type||'').toLowerCase());
                  if (!catMatch && !typeMatch && !aliasMatch && !aaMatch) return false;
                  if (manualSearch && !(s.name||'').toLowerCase().includes(manualSearch.toLowerCase()) && !(s.id||'').toLowerCase().includes(manualSearch.toLowerCase())) return false;
                  return true;
                }).length > 40 && <div style={{ fontSize:9, color:'var(--text-dim)', textAlign:'center', padding:6 }}>Показаны 40 из большего числа. Уточните поиск.</div>}
              </div>

              {/* Selected substances with doses */}
              {manualSubs.length > 0 && (
                <div style={{ marginTop:6 }}>
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>Выбрано ({manualSubs.length}):</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map(id => {
                      const sub = ALL_SUBSTANCES.find(s => s.id === id);
                      return (
                        <div key={id} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:6,
                          background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', fontSize:10 }}>
                          <span>{sub?.name || id}</span>
                          <input type="number" min={0} max={5000} step={50} value={manualDoses[id] || ''}
                            onChange={e => setManualDoses(prev => ({...prev, [id]: Number(e.target.value) || 0}))}
                            placeholder="мг"
                            style={{ width:50, padding:'2px 4px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:9 }} />
                          <span onClick={() => setManualSubs(prev => prev.filter(x => x !== id))}
                            style={{ color:'#ef4444', cursor:'pointer', fontSize:12, fontWeight:700 }}>×</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Presets */}
              <div style={{ marginTop:6 }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:3 }}>Быстрые пресеты:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {[
                    { label:'Масса', ids:['AA_NAC','VIT_D3','MIN_MAG_GLYCINATE','MIN_ZINC_PICOLINATE','VIT_Q10','VIT_C','AO_SELENIUM'] },
                    { label:'Сушка', ids:['AA_L_CARNITINE_TARTRATE','AO_EGCG','VIT_B_COMPLEX','VIT_C','AA_NAC','AO_MELATONIN'] },
                    { label:'Печень', ids:['AA_NAC','AO_SILYMARIN','VIT_LIPOIC_R','VIT_CHOLINE'] },
                    { label:'Сердце', ids:['VIT_Q10','MIN_MAG_GLYCINATE','FA_OMEGA3_EPA','AA_L_TAURINE','AO_CURCUMIN','VIT_K2_MK7'] },
                    { label:'Суставы', ids:['MIN_SULFUR_MSM','AA_L_COLLAGEN_AMINO','AO_CURCUMIN','VIT_D3'] },
                    { label:'Мозг', ids:['AA_L_THEANINE','AO_GINKGO_FLAVONES','AD_LIONS_MANE','VIT_B12_METHYL','VIT_D3','FA_OMEGA3_DHA','MIN_MAG_THREONATE'] },
                    { label:'Сон', ids:['AO_MELATONIN','MIN_MAG_GLYCINATE','AA_L_THEANINE','AA_L_GLYCINE','AD_ASHWAGANDHA_KSM','VIT_B6'] },
                    { label:'Иммунитет', ids:['VIT_C','MIN_ZINC_PICOLINATE','VIT_D3','PP_ELDERBERRY_POLYPHENOLS','AO_QUERCETIN','PRE_FOS'] },
                  ].map(p => (
                    <button key={p.label} onClick={() => { setManualSubs(p.ids); setManualResult(null); }}
                      style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', border:'none',
                        background:'rgba(139,92,246,0.1)', color:'#8b5cf6', fontWeight:500 }}>{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Build button */}
              <button onClick={() => {
                if (manualSubs.length === 0) return;
                const result = newOptimizeStack(manualSubs);
                setManualResult(result);
              }} style={{
                width:'100%', padding:'10px', borderRadius:6, border:'none', cursor:'pointer', marginTop:8,
                background: 'linear-gradient(135deg, #00e68a, #00c853)', color:'#000', fontWeight:700, fontSize:13,
                boxShadow: '0 2px 8px rgba(0,230,138,0.3)', opacity: manualSubs.length === 0 ? 0.5 : 1,
              }} disabled={manualSubs.length === 0}>
                🧬 Построить стек ({manualSubs.length} веществ)
              </button>

              {/* Results */}
              {manualResult && (
                <div style={{ marginTop:8 }}>
                  {/* System coverage */}
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>🛡 Покрытие систем</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, marginBottom:6 }}>
                    {Object.entries(manualResult.systemCoverage).map(([sys, cov]) => (
                      <div key={sys} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9 }}>
                        <span style={{ width:70, textTransform:'capitalize' }}>{sys}</span>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${Math.min(100, cov*100)}%`, height:'100%', borderRadius:3,
                            background: cov > 0.6 ? '#22c55e' : cov > 0.3 ? '#eab308' : '#ef4444' }} />
                        </div>
                        <span style={{ width:30, textAlign:'right', color:'var(--text-dim)' }}>{(cov*100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Per-substance breakdown */}
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>📦 Повещественный разбор</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {manualResult.perSubstance.slice(0, 10).map(ps => (
                      <div key={ps.id} style={{ fontSize:9, padding:'3px 6px', background:'rgba(139,92,246,0.04)', borderRadius:4 }}>
                        <div style={{ fontWeight:600 }}>{ps.name}</div>
                        <div style={{ color:'var(--text-dim)', fontSize:8 }}>
                          Системы: {Object.entries(ps.systems).filter(([_,v]) => v > 0).map(([s,v]) => `${s}:${(v*100).toFixed(0)}%`).join(', ') || '—'}
                          <span style={{ marginLeft:6 }}>Категории: {ps.categories.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Synergies */}
                  {manualResult.synergiesInStack.length > 0 && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#22c55e', marginBottom:3 }}>✅ Синергии ({manualResult.synergiesInStack.length})</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {manualResult.synergiesInStack.map((s, i) => (
                          <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(34,197,94,0.08)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>
                            {s.aName} + {s.bName}: {s.mechanism}
                            <span style={{ color:'var(--text-dim)', marginLeft:3 }}>({s.severity})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {manualResult.conflictsInStack.length > 0 && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#ef4444', marginBottom:3 }}>⚠ Конфликты ({manualResult.conflictsInStack.length})</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {manualResult.conflictsInStack.map((c, i) => (
                          <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                            {c.aName} + {c.bName}: {c.mechanism}
                            <span style={{ color:'var(--text-dim)', marginLeft:3 }}>({c.severity})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ranked substances */}
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)', marginBottom:3 }}>📊 Ранжирование (set cover)</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                      {manualResult.rankedSubstances.map((r, i) => (
                        <div key={r.id} style={{ padding:'1px 4px', display:'flex', justifyContent:'space-between' }}>
                          <span>{i+1}. {r.name}</span>
                          <span>+{(r.incrementalCoverage*100).toFixed(0)}% → {(r.totalCoverage*100).toFixed(0)}% [{r.systemsGained.join(', ')}]</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generate weekly plan from manual stack */}
                  <button onClick={() => {
                    const baseWeights: Record<string, number> = {};
                    const drugLoads: Record<string, number> = {};
                    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
                      baseWeights[sys] = 15;
                      drugLoads[sys] = linked.course.length * 2;
                    }
                    const plan = generateWeeklyPlan(manualSubs, riskCalcMethod, baseWeights, drugLoads, {}, manualResult.systemCoverage);
                    setWeeklyPlan(plan);
                  }} style={{
                    width:'100%', padding:'10px', borderRadius:6, border:'none', cursor:'pointer', marginTop:8,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color:'#fff', fontWeight:700, fontSize:13,
                    boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                  }}>
                    📅 Недельный план для этого стека
                  </button>
                </div>
              )}
            </>}
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
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{sub.type}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 2).join(', ') : ''}</span>
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

      {/* ===== INTERACTIONS (Apple-style redesign) ===== */}
      {tab === 'interactions' && (
        <div style={{ padding: '0 0 16px' }}>
          {/* Segmented control */}
          <div style={{ display:'flex', marginBottom:14, background:'var(--bg-secondary)', borderRadius:10, padding:2 }}>
            {(['support','pharma'] as const).map(t => (
              <button key={t} onClick={() => setInteractTab(t)} style={{
                flex:1, padding:'8px 0', borderRadius:8, fontSize:12, fontWeight:700,
                cursor:'pointer', transition:'all 0.15s',
                background: interactTab === t ? 'var(--accent)' : 'transparent',
                color: interactTab === t ? '#000' : 'var(--text-dim)',
                border: 'none',
              }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
            ))}
          </div>

          {interactTab === 'support' ? (
            <div>
              {/* Header */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>⚡ Взаимодействия поддержки</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Проверка синергий и конфликтов между препаратами поддержки и БАДами</div>
              </div>

              {/* Drug selector cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {interactionIds.map((id, idx) => {
                  const selectedName = id ? (allSupport.find(s => s.id === id)?.name || id) : '';
                  return (
                    <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4 }}>#{idx + 1}</span>
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите препарат</span>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <div style={{ position:'relative', flex:1 }}>
                          <input
                            value={interactionSearchIdx === idx ? interactionSearch : selectedName}
                            placeholder="🔍 Поиск..."
                            onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }}
                            onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); if (!e.target.value) updateInteraction(idx, ''); }}
                            style={{ width:'100%', padding:'9px 10px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }}
                          />
                          {interactionSearch && interactionSearchIdx === idx && (
                            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, maxHeight:160, overflowY:'auto', marginTop:2 }}>
                              {allSupport.filter(s => (s.name||'').toLowerCase().includes(interactionSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0, 10).map(s => (
                                <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); }}
                                  style={{ padding:'7px 10px', cursor:'pointer', fontSize:11, borderBottom:'1px solid var(--border)' }}>
                                  <span style={{ fontWeight: id === s.id ? 700 : 400, color: id === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</span>
                                  <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:6 }}>{s.id}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {interactionIds.length > 2 && (
                          <button onClick={() => removeInteraction(idx)} style={{ padding:'6px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', flexShrink:0 }}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={addInteraction} style={{
                  padding:'10px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer',
                  background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a',
                }}>+ Добавить препарат</button>
              </div>

              {/* Empty state */}
              {validInteractionIds.length < 2 && (
                <div style={{ textAlign:'center', padding:'32px 16px', background:'var(--bg-secondary)', borderRadius:12, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>⚡</div>
                  <div style={{ fontSize:11, color:'var(--text-dim)' }}>Выберите минимум 2 препарата для проверки</div>
                </div>
              )}

              {/* No conflicts */}
              {validInteractionIds.length >= 2 && !hasSupportInteractions && (
                <div style={{ textAlign:'center', padding:'14px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}>
                  <span style={{ fontSize:11, color:'#4caf50', fontWeight:600 }}>✓ Критических взаимодействий не обнаружено</span>
                </div>
              )}

              {/* Results */}
              {hasSupportInteractions && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { list: supportSynergiesList, label: '⊕ Синергия — положительное взаимодействие', color: '#22c55e' },
                    { list: supportConflicts, label: '⊖ Конфликт — отрицательное взаимодействие', color: '#ef4444' },
                    { list: supportCautions, label: '⚡ Осторожность — потенциальный риск', color: '#f59e0b' },
                  ].filter(s => s.list.length > 0).map(section => (
                    <div key={section.label} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:section.color, marginBottom:6 }}>{section.label} ({section.list.length})</div>
                      {section.list.map(i => {
                        const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                        return (
                          <div key={i.id} style={{ padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ color:section.color, fontWeight:700, fontSize:10 }}>{i.substanceA} + {i.substanceB}</span>
                              <div style={{ display:'flex', gap:3 }}>
                                {i.severity && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:sevColor+'22', color:sevColor, fontWeight:600 }}>{i.severity}</span>}
                              </div>
                            </div>
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:2 }}>{i.effect || ''}</div>
                            {i.mechanisms && i.mechanisms.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {i.mechanisms.map((m: string, mi: number) => (
                                  <span key={mi} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{m}</span>
                                ))}
                              </div>
                            )}
                            {i.notes && <div style={{ fontSize:9, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:1 }}>{i.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ─── PHARMA INTERACTIONS ─── */
            <div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>💉 Взаимодействия фармы</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Проверка синергий и конфликтов между фармакологическими препаратами</div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {(() => {
                  const PHARMA_CORE_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','pct_serm','pct_aromatase','pct_dopamine','pct_gonadotropin']);
                  const pharmaAll = Object.values(PHARMA_DB).filter((s): s is (typeof PHARMA_DB)[string] => !!s?.name && PHARMA_CORE_FILTER.has(s.class));
                  const pharmaFiltered = pharmaInteractSearch ? pharmaAll.filter(s => (s.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase())) : pharmaAll;
                  const pharmaValid = pharmaInteractIds.filter(Boolean);
                  return (
                    <>
                      {pharmaInteractIds.map((id, idx) => {
                        const selectedName = id ? (PHARMA_DB[id]?.name || '') : '';
                        return (
                          <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                              <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4 }}>#{idx + 1}</span>
                              <span style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите препарат</span>
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <div style={{ flex:1, position:'relative' }}>
                                <input
                                  value={id ? selectedName : pharmaInteractSearch}
                                  onChange={e => { setPharmaInteractSearch(e.target.value); if (!e.target.value) { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }}}
                                  placeholder="🔍 Поиск..." style={{ width:'100%', padding:'9px 10px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
                                {!id && pharmaInteractSearch && (
                                  <div style={{ position:'absolute', zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, maxHeight:140, overflowY:'auto', marginTop:2, width:'calc(100% - 2px)' }}>
                                    {pharmaFiltered.slice(0, 10).map(s => (
                                      <div key={s.id} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = s.id; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:11, borderBottom:'1px solid var(--border)' }}>
                                        <span style={{ fontWeight:600 }}>{s.name}</span>
                                        <span style={{ marginLeft:6, color:'var(--text-dim)', fontSize:9 }}>{s.class}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {pharmaInteractIds.length > 2 && (
                                <button onClick={() => setPharmaInteractIds(pharmaInteractIds.filter((_, ix) => ix !== idx))} style={{ padding:'6px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', flexShrink:0 }}>✕</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => setPharmaInteractIds([...pharmaInteractIds, ''])} style={{
                        padding:'10px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer',
                        background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a',
                      }}>+ Добавить препарат</button>
                      {pharmaValid.length >= 2 && checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).length === 0 && (
                        <div style={{ padding:'14px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', textAlign:'center' }}>
                          <span style={{ fontSize:11, color:'#4caf50', fontWeight:600 }}>✓ Критических взаимодействий не обнаружено</span>
                        </div>
                      )}
                      {pharmaValid.length >= 2 && (
                        <div>
                          {checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).map((alert, i) => {
                            const c = alert.type === 'critical' ? '#ff1744' : alert.type === 'warning' ? '#ff9100' : '#2979ff';
                            const icon = alert.type === 'critical' ? '🚫' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
                            return (
                              <div key={i} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'12px', marginBottom:6, borderLeft:`3px solid ${c}`, border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                  <span style={{ fontSize:14 }}>{icon}</span>
                                  <span style={{ fontWeight:700, fontSize:10, color:c }}>
                                    {alert.type === 'critical' ? 'КРИТИЧЕСКОЕ' : alert.type === 'warning' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'ИНФО'}
                                  </span>
                                </div>
                                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)', marginBottom:4 }}>{alert.drugs.join(' + ')}</div>
                                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4, marginBottom:2 }}>
                                  <b>Механизм:</b> {alert.mechanism}
                                </div>
                                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4 }}>
                                  <b>Рекомендация:</b> {alert.recommendation}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STACKS (ALL_STACKS — 30+ готовых стеков) ===== */}
      {tab === 'stacks' && (
        <div style={{ padding: '0 0 16px' }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--accent)', marginBottom:2 }}>📦 Готовые стеки</div>
            <div style={{ fontSize:10, color:'var(--text-dim)' }}>
              {ALL_STACKS.length} оптимизированных комбинаций добавок с рассчитанной синергией
            </div>
          </div>
          <input value={stackSearch} onChange={e => setStackSearch(e.target.value)} placeholder="🔍 Поиск по эффекту или веществу..." style={{ width:'100%', padding:'9px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box', marginBottom:10 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:'62vh', overflowY:'auto', paddingRight:2 }}>
            {(stackSearch ? [{ key:'search', label:`Результаты поиска (${filteredStacks.length})`, stacks:filteredStacks }] : groupedStacks).map(group => (
              <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div onClick={() => setExpandedCategories(prev => ({ ...prev, ['stack_'+group.key]: !(prev['stack_'+group.key] ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px', cursor:'pointer', userSelect:'none' }}>
                  <span style={{ fontSize:14 }}>📋</span>
                  <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                  <span style={{ fontSize:10, color:'var(--text-dim)', fontWeight:600, marginRight:4 }}>{group.stacks.length}</span>
                  <span style={{ fontSize:10, color:'var(--text-dim)', transform: expandedCategories['stack_'+group.key] !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
                {expandedCategories['stack_'+group.key] !== false && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {group.stacks.map(stack => {
                      const synergyColor = stack.synergyScore > 20 ? '#22c55e' : stack.synergyScore > 12 ? '#eab308' : '#f59e0b';
                      return (
                        <div key={stack.id} style={{ padding:'8px 12px 10px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                          onClick={() => setExpandedMed(expandedMed === stack.id ? null : stack.id)}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, flex:1 }}>
                              {stack.effects.map(e => (
                                <span key={e} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:500 }}>
                                  {EFFECT_LABELS_ru[e] || e}
                                </span>
                              ))}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:synergyColor }}>{stack.synergyScore.toFixed(1)}</span>
                              <span style={{ fontSize:8, color:'var(--text-dim)' }}>syn</span>
                            </div>
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:expandedMed === stack.id ? 6 : 0 }}>
                            {stack.substances.map(sid => (
                              <span key={sid} style={{ fontSize:9, padding:'2px 7px', borderRadius:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', color:'#a78bfa', fontWeight:600 }}>
                                {getStackSubLabel(sid)}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                            {stack.substances.length} веществ
                          </div>
                          {expandedMed === stack.id && (
                            <div style={{ marginTop:6, padding:'6px 8px', background:'rgba(0,0,0,0.15)', borderRadius:8 }}>
                              {/* Positive effects */}
                              <div style={{ marginBottom:4 }}>
                                <div style={{ fontSize:9, fontWeight:700, color:'#22c55e', marginBottom:3 }}>⊕ Положительные эффекты</div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                                  {stack.effects.map(e => (
                                    <span key={e} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#4ade80', fontWeight:600 }}>
                                      {EFFECT_LABELS_ru[e] || e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {/* Substance breakdown */}
                              <div style={{ marginBottom:4 }}>
                                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>🧬 Компоненты</div>
                                {stack.substances.map(sid => {
                                  const subInfo = ALL_SUBSTANCES.find(s => s.id === sid);
                                  const cat = subInfo?.categories?.[0];
                                  return (
                                    <div key={sid} style={{ fontSize:8, color:'var(--text-dim)', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', lineHeight:1.4 }}>
                                      <b style={{ color:'#a78bfa' }}>{getStackSubLabel(sid)}</b>
                                      {cat && <span style={{ marginLeft:4, opacity:0.6 }}>· {getCategoryInfo(cat).label}</span>}
                                      {subInfo?.description && <div style={{ opacity:0.7 }}>{subInfo.description.slice(0, 100)}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Potential conflicts warning */}
                              {(() => {
                                const conflictPairs: string[] = [];
                                for (let a = 0; a < stack.substances.length; a++) {
                                  for (let b = a + 1; b < stack.substances.length; b++) {
                                    const found = ALL_INTERACTIONS.find(i =>
                                      (i.substanceA === stack.substances[a] && i.substanceB === stack.substances[b]) ||
                                      (i.substanceA === stack.substances[b] && i.substanceB === stack.substances[a])
                                    );
                                    if (found && found.type !== 'synergy') conflictPairs.push(`${getStackSubLabel(stack.substances[a])} + ${getStackSubLabel(stack.substances[b])}: ${found.effect} (${found.severity})`);
                                  }
                                }
                                return conflictPairs.length > 0 ? (
                                  <div>
                                    <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:2 }}>⚠ Возможные конфликты</div>
                                    {conflictPairs.map((p, i) => <div key={i} style={{ fontSize:8, color:'#f87171', padding:'1px 0', lineHeight:1.3 }}>{p}</div>)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize:8, color:'#4ade80', opacity:0.6 }}>✓ Конфликтов между компонентами не обнаружено</div>
                                );
                              })()}
                              <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:3 }}>Оценка синергии: <b style={{ color: synergyColor }}>{stack.synergyScore.toFixed(1)}</b> · {stack.substances.length} веществ</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {stackSearch && filteredStacks.length === 0 && (
              <div style={{ padding:30, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>
                Ничего не найдено по запросу "{stackSearch}"
              </div>
            )}
          </div>
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
            {PEPTIDE_DB[peptideId] && PEPTIDE_DB[peptideId].effects && (
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
  const [optResult, setOptResult] = React.useState<OptimizerStackResult | null>(null);
  const run = () => {
    const available = drugs.length > 0 ? drugs : ['AA_NAC'];
    const result = newOptimizeStack(available);
    setOptResult(result);
  };
  React.useEffect(() => { if (drugs.length > 0) run(); }, [drugs]);
  return (<div>
    {optResult && <div style={{ maxHeight:250,overflowY:'auto' }}>
      {optResult.rankedSubstances.length > 0 && (
        <div>
          <div style={{ fontSize:9,fontWeight:600,color:'var(--text-dim)',marginBottom:4 }}>📊 Ранжированные вещества ({optResult.rankedSubstances.length})</div>
          {optResult.rankedSubstances.slice(0,15).map((r,i) => (
            <div key={i} style={{ fontSize:8,padding:'2px 6px',display:'flex',justifyContent:'space-between' }}>
              <span>{r.name}</span>
              <span style={{ color:'var(--text-dim)' }}>+{r.incrementalCoverage.toFixed(2)} ({r.systemsGained.join(', ')})</span>
            </div>
          ))}
        </div>
      )}
      {optResult.synergiesInStack.length > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:9,fontWeight:600,color:'#22c55e' }}>✅ Синергии ({optResult.synergiesInStack.length})</div>
          {optResult.synergiesInStack.slice(0,5).map((s,i) => (
            <div key={i} style={{ fontSize:8,padding:'1px 6px',color:'#22c55e' }}>{s.aName}+{s.bName}: {s.mechanism}</div>
          ))}
        </div>
      )}
      {optResult.conflictsInStack.length > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:9,fontWeight:600,color:'#ef4444' }}>⚠ Конфликты ({optResult.conflictsInStack.length})</div>
          {optResult.conflictsInStack.slice(0,5).map((c,i) => (
            <div key={i} style={{ fontSize:8,padding:'1px 6px',color:'#ef4444' }}>{c.aName}+{c.bName}: {c.mechanism}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize:8,color:'var(--text-dim)',marginTop:4 }}>
        Покрытие: {Object.entries(optResult.systemCoverage).map(([s,v]) => `${s}:${(v*100).toFixed(0)}%`).join(', ')}
      </div>
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
