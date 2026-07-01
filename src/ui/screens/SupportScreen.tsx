import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { SYNERGY_PAIRS, ORGAN_SYNERGIES, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, findSupportByGoal, getSupportDatabaseStats, type SupportInput, type SupplementTarget } from '../../engines/support.engine';
import { decodeGarbled, cleanDesc } from '../../utils/text-sanitizer';
import { SupportModals } from './SupportScreen_parts/SupportModals';
import { ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB, getPharmaDetail } from '../../core/pharma-database';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { updateProfile, getProfile } from '../../core/profile-manager';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { ALL_SUBSTANCES, ALL_INTERACTIONS, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
import { INTERACTION_ENRICHMENT } from '../../data/support-interaction-enrichment';
import { getSubstanceTier, TIER_LABELS } from '../../data/support-database';
import { getBpRiskLevel } from '../../core/bp-hr-data';
import { SUPPORT_CATALOG_DATA, CATALOG_ENRICHMENT, ORGAN_LABELS as CATALOG_ORGAN_LABELS, SYSTEM_LABELS_CATALOG, CATEGORY_LABELS as CATALOG_CATEGORY_LABELS, TIER_LABELS_CATALOG, type SupportCatalogEntry } from '../../data/support-database';

import { CANONICAL_ID_MAP } from '../../data/support-database';
import { SUBSTANCE_ANALOGS, PHASE_MODS, DEFAULT_DOSAGES, getPhaseLevel, type SupportPhase } from '../../data/support-database';
import { FertilityPCTScreen } from './FertilityPCTScreen';
import { ALL_STACKS, EFFECT_LABELS_ru, findStacksByEffect, getStackSubstanceLabel as getStackSubLabel, type SupportStack } from '../../data/support-database';
import {
  PEPTIDE_DB, PEPTIDE_LIST,
  computeDilution, computeEffectiveDose, computePK,
  generatePeptideProtocol,
  ROUTE_LABELS, SYRINGE_TYPES,  type PeptideInfo, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKInput, type PKResult,
} from '../../engines/peptide-calculator.engine';
import {
  interpretLabs, computeRiskByModel, generateMechanismReport,
  computePharmaAdjustedDose, generateTimedPlan,
  RISK_MODEL_LABELS, type RiskModelType, type LabCompositeResult,
} from '../../engines/lab-analysis.engine';
import {
  generateWeeklyPlan,
  type RiskCalcMethod, type WeeklyPlan, type SupplementPlanEntry, type DailySchedule,
} from '../../engines/weekly-plan.engine';

import { getSubstanceName, type StackResult as OptimizerStackResult } from '../../engines/stack-optimizer.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../core/types';
import { searchPubMed, type PubMedArticle } from '../../engines/pubmed-search.engine';
import { AutoCalculator } from './SupportScreen_parts/AutoCalculator';
import { calculateSupportTZ, hydrateState } from '../../engines/support-calculator.engine';
import type { CalculatorState, CalculatorResult, PowerLevel } from '../../engines/support-calculator.types';
import { calculateTZRisk, toCompatibleResult, type TZRiskResult } from '../../engines/risk-engine-tz';
import { getDrugTzMechanisms, getSupportTzDisplay, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../data/support-db';
import { calculateSupportPlan, applyJointToPlan, applyBoostToPlan, type PlanResult, type PlanSubstance } from '../../engines/support-plan-engine';
import { buildPreApplyCard, evaluateRecommendations, computeCoverageRisk } from '../../engines/recommendation-engine';
import { calculateMixScore, type TrainingMixScore, type MixSubstance, type MixProfile, MIX_MECHANISMS, MIX_SYNERGY, MIX_TEMPLATES, type MixTemplate, buildBestRecipe, type MixRecipe, type MixRecipeItem, groupRecipeItemsByTiming } from '../../engines/training-mix-scoring.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
// Force Vite to include SUPPORT_CATALOG_DATA and CANONICAL_ID_MAP (prevents tree-shaking)
// @ts-ignore
(window as any).__SUPPORT_CATALOG__ = SUPPORT_CATALOG_DATA;
// @ts-ignore
(window as any).__CANONICAL_MAP__ = CANONICAL_ID_MAP;

type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
type SupportView = 'main' | 'calc' | 'fertility';
type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'plan' | 'reports' | 'mixcalc';
type InfoView = 'main' | 'catalog' | 'interactions' | 'stacks' | 'research' | 'favorites' | 'protocols' | 'biostack';

import { INTERACTION_TYPE_LABELS, EFFECT_LABELS, INTERACTION_SEVERITY_LABELS, CATEGORY_LABELS, MECH_TRANSLATIONS_RU, ORGAN_MECHANISMS, getCategoryInfo, TYPE_LABELS_RU, CLASS_BASE_NAMES, SYNERGY_COLORS, SUPPORT_CLASS_LABELS, MECH_LABELS, SUPPORT_MED_DETAIL, InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';
import { PopupBool, PopupNumber, PopupSelect } from '../components/PopupXxx';
import { BioStackAIScreen } from '../components/BioStackAIScreen';
export const SupportScreen: React.FC<{ initialTab?: SupportTab }> = ({ initialTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<SupportTab>(initialTab || 'main');
  const [supportView, setSupportView] = useState<SupportView>('main');
  const [calcView, setCalcView] = useState<CalcView>('main');
  const [infoView, setInfoView] = useState<InfoView>('main');
  const [section, setSection] = useState<'home'|'generator'|'protocols'|'info'>('home');
  const [genTab, setGenTab] = useState<'calculator'|'info'>('calculator');
  const [protocolTab, setProtocolTab] = useState<'pct'|'fertility'|'hrt'|'neuro'|'joints'|'acne'>('pct');
  const [infoTab, setInfoTab] = useState<string>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogOrgans, setCatalogOrgans] = useState<string[]>([]);
  const [showOrganPopup, setShowOrganPopup] = useState(false);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [supportClassFilter, setSupportClassFilter] = useState<string>('all');
  const [supportTierFilter, setSupportTierFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [supportLevel, setSupportLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [courseWeekState, setCourseWeekState] = useState<number>(() => {
    const c = linked?.course || [];
    if (!c.length) return 6;
    return Math.max(...c.map(e => (e.endWeek || 12) - (e.startWeek || 0)), 8);
  });
  const [manualLevelSelected, setManualLevelSelected] = useState(false);
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [jointMode, setJointMode] = useState(false);
  const [jointNotification, setJointNotification] = useState(false);
  const [boostNotification, setBoostNotification] = useState(false);
  const stateRef = useRef<CalculatorState | null>(null);
  const [myPlansRefresh, setMyPlansRefresh] = useState(0);
  const [weekChangeMsg, setWeekChangeMsg] = useState('');
  const [planHistory, setPlanHistory] = useState<Array<{ level: string; subs: string[]; date: string; riskBefore: number; riskAfter: number }>>([]);
  const [supportPhase, setSupportPhase] = useState<SupportPhase>('course');
  const [subSearch, setSubSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'warning' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const [selectedAnalogs, setSelectedAnalogs] = useState<Record<string, string>>({});
  const [enhancedSubs, setEnhancedSubs] = useState<string[]>([]);
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [autoLevel, setAutoLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [stackExpanded, setStackExpanded] = useState<string | null>(null);
  // Protocol substance name -> ID lookup for +Стек buttons
  const PROTOCOL_IDS: Record<string, string> = {
    'nac':'AA_NAC','n-ацетилцистеин':'AA_NAC','n-acetyl-cysteine':'AA_NAC',
    'омега-3':'FA_OMEGA3_BALANCED','omega-3':'FA_OMEGA3_BALANCED','epa/dha':'FA_OMEGA3_BALANCED',
    'magnesium l-threonate':'MIN_MG_THREONATE','магний l-треонат':'MIN_MG_THREONATE','магний':'MIN_MG_CITRATE',
    'таурин':'AA_TAURINE','taurine':'AA_TAURINE',
    'глицин':'AA_GLYCINE','glycine':'AA_GLYCINE',
    'alpha-lipoic acid':'AO_ALA','альфа-липоевая кислота':'AO_ALA','ala':'AO_ALA',
    'coq10':'AO_COQ10_UBIQUINOL','коэнзим q10':'AO_COQ10_UBIQUINOL','убихинол':'AO_COQ10_UBIQUINOL',
    'pregnenolone':'HORMONE_PREGNENOLONE','прегненолон':'HORMONE_PREGNENOLONE',
    'агмантин':'AA_AGMATINE','agmatine':'AA_AGMATINE',
    'альфа-gpc':'AA_ALPHA_GPC','alpha-gpc':'AA_ALPHA_GPC',
    'lion\'s mane':'MUSHROOM_LIONS_MANE','ежовик':'MUSHROOM_LIONS_MANE',
    'dhea':'HORMONE_DHEA',
    'phosphatidylserine':'PHOSPHATIDYLSERINE','фосфатидилсерин':'PHOSPHATIDYLSERINE',
    'ginkgo biloba':'HERB_GINKGO','гинкго':'HERB_GINKGO',
    'бромантан':'PHARMA_BROMANTAN','bromantan':'PHARMA_BROMANTAN',
    'фасорацетам':'PHARMA_FASORACETAM','fasoracetam':'PHARMA_FASORACETAM',
    'гуперзин а':'HERB_HUPERZINE','huperzine':'HERB_HUPERZINE',
    'bacopa monnieri':'HERB_BACOPA','бакопа':'HERB_BACOPA',
    'l-theanine':'AA_THEANINE','теанин':'AA_THEANINE','l-теанин':'AA_THEANINE',
    'citicoline':'AA_CITICOLINE','цитиколин':'AA_CITICOLINE',
    'noopept':'PHARMA_NOOPEPT','ноопепт':'PHARMA_NOOPEPT',
    'семакс':'PEPTIDE_SEMAX','semax':'PEPTIDE_SEMAX',
    'кортексин':'PEPTIDE_CORTEXIN','cortexin':'PEPTIDE_CORTEXIN',
    'церебролизин':'PEPTIDE_CEREBROLYSIN','cerebrolysin':'PEPTIDE_CEREBROLYSIN',
    'коллаген ii типа':'PEPTIDE_COLLAGEN_2','collagen type ii':'PEPTIDE_COLLAGEN_2','коллаген':'PEPTIDE_COLLAGEN_2',
    'витамин c':'VITAMIN_C','vitamin c':'VITAMIN_C',
    'витамин d3':'VITAMIN_D3','vitamin d3':'VITAMIN_D3',
    'k2':'VITAMIN_K2','витамин k2':'VITAMIN_K2',
    'глюкозамин':'GLUCOSAMINE','glucosamine':'GLUCOSAMINE',
    'хондроитин':'CHONDROITIN','chondroitin':'CHONDROITIN',
    'msm':'MSM','метилсульфонилметан':'MSM',
    'гиалуроновая кислота':'HYALURONIC_ACID','hyaluronic acid':'HYALURONIC_ACID',
    'куркумин':'CURCUMIN','curcumin':'CURCUMIN',
    'босвеллия':'BOSWELLIA','boswellia':'BOSWELLIA','akba':'BOSWELLIA',
    'bpc-157':'PEPTIDE_BPC157',
    'tb-500':'PEPTIDE_TB500','тимозин':'PEPTIDE_TB500','thymosin':'PEPTIDE_TB500',
    'секретагоги гр':'PEPTIDE_GHRP_GHRELIN','ипаморелин':'PEPTIDE_IPAMORELIN','cjc-1295':'PEPTIDE_CJC1295',
    'кофеин':'STIM_CAFFEINE','caffeine':'STIM_CAFFEINE',
    'l-цитруллин':'AA_CITRULLINE','цитруллин':'AA_CITRULLINE','l-цитруллин малат':'AA_CITRULLINE',
    'бета-аланин':'AA_BETA_ALANINE','beta-alanine':'AA_BETA_ALANINE',
    'l-аргинин':'AA_ARGININE','аргинин':'AA_ARGININE',
    'l-тирозин':'AA_TYROSINE','тирозин':'AA_TYROSINE','l-tyrosine':'AA_TYROSINE',
    'creatine':'CREATINE','креатин':'CREATINE','креатин моногидрат':'CREATINE',
    'hmb':'HMB','β-гидрокси-β-метилбутират':'HMB',
    'l-глютамин':'AA_GLUTAMINE','глютамин':'AA_GLUTAMINE',
    'zma':'ZMA','цинк+магний':'ZMA',
    'сывороточный протеин':'PROTEIN_WHEY','протеин':'PROTEIN_WHEY',
    'натрий':'ELECTROLYTE_NACL','калий':'ELECTROLYTE_KCL',
    'циклический декстрин':'HBCD','hbcd':'HBCD',
    'eaa':'EAA_COMPLEX','bcaa':'BCAA_COMPLEX',
    'ниацинамид':'VITAMIN_B3','витамин b3':'VITAMIN_B3',
    'медь':'MIN_COPPER','copper':'MIN_COPPER',
    'верошпирон':'PHARMA_SPIRONOLACTONE','спиронолактон':'PHARMA_SPIRONOLACTONE',
    'клендовит гель':'','клензит-с':'','солярий':'',
  };
  const resolveProtoId = (name: string): string => {
    const key = name.toLowerCase().trim();
    if (PROTOCOL_IDS[key]) return PROTOCOL_IDS[key];
    // Try partial match by first word
    const firstWord = key.split(/[\s-(]+/)[0];
    if (firstWord && PROTOCOL_IDS[firstWord]) return PROTOCOL_IDS[firstWord];
    // Fallback to catalogSubstances search
    const terms = [key, ...key.split(/[\s-]+/).filter((t:string)=>t.length>2)];
    const found = catalogSubstances.find((s:any) => {
      const sn = ((s.name||'')+'').toLowerCase(); const sid = ((s.id||'')+'').toLowerCase();
      return terms.some(t => sid.includes(t) || sid.replace(/_/g,'').includes(t) || sn.includes(t));
    });
    return found?.id || '';
  };
  const resetMain = () => { setTab('main'); setSupportView('main'); setCalcView('main'); };
  const goHome = () => { setSection('home'); resetMain(); setInfoView('catalog'); };
  const goBack = () => {
    if (section === 'protocols') { goHome(); return; }
    if (calcView !== 'main') {
      if (section === 'generator') { setSection('home'); resetMain(); } 
      else if (calcView === 'peptides') { setCalcView('info'); setInfoView('catalog'); setInfoTab('catalog'); setSection('home'); }
      else if (calcView === 'mixcalc') { setCalcView('info'); setInfoView('catalog'); setInfoTab('catalog'); setSection('home'); }
      else if (calcView === 'info') { goHome(); } 
      else { setCalcView('main'); }
      return;
    }
    if (supportView === 'calc' || supportView !== 'main') {
      if (section === 'generator') { setSection('home'); resetMain(); } 
      else { setSupportView('main'); setTab('main'); }
      return;
    }
    if (tab !== 'main') { setTab('main'); return; }
    if (section !== 'home') { setSection('home'); resetMain(); return; }
  };
  const backBtnStyle: React.CSSProperties = { padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' as const };
  const BackNav = ({ homeLabel = '← На главную' }: { homeLabel?: string }) => <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' as const }}>
    <button onClick={goBack} style={backBtnStyle}>← Назад</button>
    <button onClick={goHome} style={backBtnStyle}>{homeLabel}</button>
  </div>;
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<string>('all');
  const [interactionSeverityFilter, setInteractionSeverityFilter] = useState<string>('all');
  const [infoSynergySeverity, setInfoSynergySeverity] = useState<string>('all');
  const [synergySubTab, setSynergySubTab] = useState<'all' | 'synergies' | 'conflicts' | 'cautions' | 'calculator'>('all');
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    cardio: true, hepatic: true, renal: true, neuro: true, endocrine: true, hematologic: true, reproductive: true, musculoskeletal: true,
  });
  const [synergyPage, setSynergyPage] = useState<number>(1);
  const [synergySearch, setSynergySearch] = useState('');
  const [synergyCountFilter, setSynergyCountFilter] = useState<number>(0);
  const [stkFilterSystem, setStkFilterSystem] = useState('all');
  const [stkFilterQty, setStkFilterQty] = useState('all');
  const [stkFilterScore, setStkFilterScore] = useState('all');
  const filteredStacks = useMemo(() => ALL_STACKS.filter(stk => {
    if (stkFilterSystem !== 'all' && !(stk.system||'').includes(stkFilterSystem)) return false;
    if (stkFilterQty !== 'all') {
      if (stkFilterQty === '1-3' && (stk.substances.length < 1 || stk.substances.length > 3)) return false;
      if (stkFilterQty === '4-7' && (stk.substances.length < 4 || stk.substances.length > 7)) return false;
      if (stkFilterQty === '8-15' && (stk.substances.length < 8 || stk.substances.length > 15)) return false;
      if (stkFilterQty === '16-25' && (stk.substances.length < 16 || stk.substances.length > 25)) return false;
      if (stkFilterQty === '25+' && stk.substances.length < 25) return false;
    }
    if (stkFilterScore !== 'all') {
      if (stkFilterScore === '0-50' && (stk.synergyScore < 0 || stk.synergyScore > 50)) return false;
      if (stkFilterScore === '51-74' && (stk.synergyScore < 51 || stk.synergyScore > 74)) return false;
      if (stkFilterScore === '75-84' && (stk.synergyScore < 75 || stk.synergyScore > 84)) return false;
      if (stkFilterScore === '85-100' && stk.synergyScore < 85) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (stk.name||'').toLowerCase().includes(q);
      const problemMatch = (stk.problem||'').toLowerCase().includes(q);
      const descMatch = (stk.description||'').toLowerCase().includes(q);
      const subMatch = stk.substances.some(s => {
        const cat = SUPPORT_CATALOG_DATA[s.id];
        return (cat?.nameRu||cat?.name||s.id||'').toLowerCase().includes(q);
      });
      if (!nameMatch && !problemMatch && !descMatch && !subMatch) return false;
    }
    return true;
  }), [stkFilterSystem, stkFilterQty, stkFilterScore, searchQuery]);
  const stackSystems = useMemo(() => [...new Set(ALL_STACKS.map(s => s.system).filter(Boolean))].sort(), []);
  const [interactSearch2, setInteractSearch2] = useState('');
  const [interactTypeFilter, setInteractTypeFilter] = useState<string>('all');
  const [synergyOrganFilter, setSynergyOrganFilter] = useState<string>('');
  const SYNERGY_PAGE_SIZE = 30;
  const [interactionPage, setInteractionPage] = useState<number>(1);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [modalAddMode, setModalAddMode] = useState(false);
  const [modalLevel, setModalLevel] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelected, setModalSelected] = useState<string[]>([]);
  const INTERACTION_PAGE_SIZE = 40;
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcDone, setCalcDone] = useState(false);
  const [autoCalcResult, setAutoCalcResult] = useState<{ level: string; subs: string[]; result: any } | null>(null);

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
  const [pepSchedule, setPepSchedule] = useState(['Пн', 'Ср', 'Пт']);
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
  const [calcExpandedSubs, setCalcExpandedSubs] = useState<Record<string, boolean>>({});

  // Support report state
  const [supportReports, setSupportReports] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_support_reports') || '[]'); } catch { return []; }
  });
  const [supportReportCurrent, setSupportReportCurrent] = useState<any>(null);

  // Neurotoxicity calculator state
  const courseCompounds = useMemo(() => (linked.course || []).map(c => {
    const ph = PHARMA_DB[c.substanceId];
    return { substanceId: c.substanceId, name: ph?.name || c.substanceId, cls: ph?.class || 'other', doseWeekly: (c.doseValue * (typeof c.frequency === 'number' ? c.frequency : 1)), startWeek: c.startWeek, endWeek: c.endWeek };
  }), [linked.course]);
  const uniqueCompounds = useMemo(() => {
    const map = new Map<string, { substanceId: string; name: string; cls: string; doseWeekly: number; startWeek: number; endWeek: number }>();
    (courseCompounds || []).forEach(c => {
      const ex = map.get(c.cls);
      map.set(c.cls, ex ? { ...ex, doseWeekly: ex.doseWeekly + c.doseWeekly } : c);
    });
    return Array.from(map.values());
  }, [courseCompounds]);
  const [neuroSelected, setNeuroSelected] = useState<string[]>(() => uniqueCompounds.map(c => c.cls));
  const [neuroDoses, setNeuroDoses] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {};
    uniqueCompounds.forEach(c => { d[c.cls] = c.doseWeekly; });
    return d;
  });
  const [neuroDuration, setNeuroDuration] = useState<number>(() => {
    if (uniqueCompounds.length === 0) return 8;
    const activeCourses = uniqueCompounds.filter(c => c.endWeek > 0);
    return activeCourses.length > 0 ? Math.max(...activeCourses.map(c => c.endWeek - c.startWeek), 8) : 8;
  });
  const [neuroAge, setNeuroAge] = useState<number>(() => {
    const dob = linked.profile?.settings?.dateOfBirth;
    if (dob) { const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); return age > 0 ? age : 30; }
    return 30;
  });

  const CLASS_RISK: Record<string, number> = {
    trenbolone: 0.9, nandrolone: 0.8, stanozolol: 0.7, boldenone: 0.5,
    oxandrolone: 0.4, masteron: 0.3, primobolan: 0.2, testosterone: 0.3,
  };
  const neuroScore = useMemo(() => {
    if ((neuroSelected || []).length === 0) return 0;
    let totalRisk = 0;
    (neuroSelected || []).forEach(cls => {
      const riskFactor = CLASS_RISK[cls] ?? 0.2;
      const dose = neuroDoses[cls] || 0;
      let doseMultiplier = 1;
      if (cls === 'testosterone' && dose > 500) doseMultiplier = 1.5;
      else if (cls === 'testosterone' && dose <= 500) doseMultiplier = 0.3;
      totalRisk += riskFactor * (dose / 500) * doseMultiplier * (neuroDuration / 8);
    });
    const ageFactor = Math.max(0.5, Math.min(2, 30 / Math.max(18, neuroAge)));
    const rawScore = totalRisk * ageFactor * 100;
    return Math.min(100, Math.round(rawScore));
  }, [neuroSelected, neuroDoses, neuroDuration, neuroAge]);
  const supportStack = useMemo(() => [
    { name:'NAC (N-ацетилцистеин)', dose: neuroScore * 20, unit:'мг', timing:'Утро + вечер, после еды' },
    { name:'Альфа-липоевая кислота (ALA)', dose: neuroScore * 10, unit:'мг', timing:'Утро, натощак за 30 мин' },
    { name:'Омега-3 (EPA+DHA)', dose: neuroScore * 50, unit:'мг', timing:'Утро + вечер, с едой' },
    { name:'Коэнзим Q10', dose: neuroScore * 5, unit:'мг', timing:'Утро, с жирной пищей' },
    { name:'Магний L-треонат', dose: neuroScore * 15, unit:'мг', timing:'Вечер, за 1ч до сна' },
    { name:'Lion\'s Mane (Ежовик)', dose: neuroScore * 20, unit:'мг', timing:'Утро, натощак' },
    { name:'Прегненолон', dose: Math.round(neuroScore * 0.5 * 10) / 10, unit:'мг', timing:'Утро, сублингвально' },
    { name:'DHEA', dose: Math.round(neuroScore * 0.8 * 10) / 10, unit:'мг', timing:'Утро' },
  ], [neuroScore]);

  const SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }> = {
    basic: { label: '🟢 База', desc: 'Только активные риски (порог 15%)', subs: [], dosages: {} },
    mid: { label: '🟡 Средний', desc: 'Стандартное покрытие (порог 10%)', subs: [], dosages: {} },
    max: { label: '🟠 Максимум', desc: 'Глубокое покрытие (порог 6%)', subs: [], dosages: {} },
    boost: { label: '🔴 Усиление', desc: 'Максимальная защита (порог 4%)', subs: [], dosages: {} },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
  }, []);

  // Sync supportDrugs with linked.course
  useEffect(() => {
    if (linked.course && linked.course.length > 0) {
      setSupportDrugs(linked.course.map(c => c.substanceId));
    }
  }, [linked.course]);

  useEffect(() => {
    const HIGH_RISK = ['trenbolone_acetate', 'trenbolone_enanthate', 'methandienone', 'stanozolol', 'oxandrolone'];
    const ORAL_17AA = ['methandienone', 'stanozolol', 'oxandrolone', 'halodrol'];
    let hasHighRisk = false, hasOral = false, count = supportDrugs.length;
    for (const id of supportDrugs) {
      if (HIGH_RISK.includes(id)) hasHighRisk = true;
      if (ORAL_17AA.includes(id)) hasOral = true;
    }
    let level: 'basic' | 'mid' | 'max' | 'boost' = 'basic';
    if (hasHighRisk || (hasOral && count >= 2)) level = 'boost';
    else if (hasOral || count >= 3) level = 'max';
    else if (count >= 1) level = 'mid';
    // 1c: Risk-based level adjustment
    const riskNet = linked.risk?.overallNet ?? 0;
    if (riskNet > 50) level = 'boost';
    else if (riskNet > 30 && level !== 'boost') level = 'max';
    // 1c: Lab abnormality count
    const abnormalCount = (linked.labAnalysis?.interpretations || []).filter(
      i => i.status === 'high' || i.status === 'critical_high'
    ).length;
    if (abnormalCount > 2) level = 'boost';
    setAutoLevel(level);
    if (!manualLevelSelected) setSupportLevel(level);
  }, [supportDrugs, linked.risk, linked.labAnalysis, manualLevelSelected]);

  // Compute effective level using NEW plan engine (mapping-based)
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const effectiveLevel = useMemo(() => {
    // Build CalculatorState from linked data for the new engine
    const s = linked.profile?.settings;
    const aasList = (linked.course || []).filter((c: any) => {
      const ph = PHARMA_DB[c.substanceId];
      return ph?.class && ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'].includes(ph.class);
    }).map((c: any) => ({ id: c.substanceId || '', doseMgWeek: (c.doseValue || 0) * (c.frequency || 1), weeks: (c.endWeek || 12) - (c.startWeek || 0) }));
    const h = hydrateState();
    const state: CalculatorState = {
      profile: h.profile || { weight: s?.weight ?? 80, age: s?.age ?? 30, sex: (s?.sex ?? 'male') as 'male' | 'female', workoutsPerWeek: s?.workoutsPerWeek ?? 3, avgWorkoutMinutes: s?.avgWorkoutMinutes ?? 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
      neuro: h.neuro || { dopamineScore: 0, serotoninScore: 0, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 0, headaches: false, weatherDependent: false, sleepQuality: 'good' },
      pharma: h.pharma || { phase: 'course', aas: aasList, hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false, hasMGF: false, hasGLP1: false },
      goals: h.goals || { healthMaintenance: false, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'maintenance', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
      hepatobiliary: h.hepatobiliary || { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
      urinary: h.urinary || { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
      cardio: h.cardio || { bpStage: 'normal', heartRate: 70, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
      oda: h.oda || { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
      nutrition: h.nutrition || { calories: 2500, proteinG: 160, fatG: 70, carbsG: 300, waterL: 2, saltIntake: 'normal', omega3: false, fiberG: 25, proteinGPerKg: 2, sodiumMg: 3000, potassiumMg: 3000 },
      contraindications: h.contraindications || { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
      labs: h.labs || { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
      journal: h.journal || { positive: [], negative: [] },
      epicrisis: h.epicrisis || { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
      toxicLoad: h.toxicLoad || { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
      dental: h.dental || { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
      genetics: h.genetics || { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'unknown' },
      gi: h.gi || { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
      psych: h.psych || { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
      injection: h.injection || { glutes: 'ok', quads: 'ok', delts: 'ok', localAreas: '' },
      powerLevel: (supportLevel as PowerLevel),
      courseWeek: courseWeekState,
    };
    let result = calculateSupportPlan(state, supportLevel as PowerLevel, enhancedSubs, linked.labs);
    // Build userCI for boost/joint contraindication checks
    const ci = state.contraindications || {};
    const userCI = new Set<string>();
    if (ci.hasCVD) userCI.add('сердечно-сосудистые').add('ССЗ').add('гипертония').add('CVD');
    if (ci.hasThrombophilia) userCI.add('тромбофилия').add('тромбоз').add('коагуляция');
    if (ci.hasLiverDisease) userCI.add('печен').add('гепатит').add('цирроз').add('печёночная');
    if (ci.hasKidneyDisease) userCI.add('почк').add('почечная').add('нефро').add('ХБП');
    if (ci.hasDiabetes) userCI.add('диабет').add('инсулин').add('гликемия');
    if (ci.hasEpilepsy) userCI.add('эпилепсия').add('судорог');
    if (ci.hasMentalIllness) userCI.add('психи').add('шизофрения').add('биполяр');
    if (ci.hasGI) userCI.add('язва').add('гастрит').add('ЖКТ');
    if (ci.allergies) userCI.add(ci.allergies.toLowerCase());
    if (jointMode) result = applyJointToPlan(result, userCI);
    if (boostEnabled) result = applyBoostToPlan(result, userCI);
    setPlanResult(result);
    // Map to a backwards-compatible effectiveLevel format
    const subs = result.substances.map(s => s.id);
    const dosages: Record<string, { mg: number; timing: string }> = {};
    for (const s of result.substances) {
      dosages[s.id] = { mg: s.doseMg, timing: s.timing };
    }
    // Also ensure phase mods are applied for hCG and fertile-specific items
    const phaseResult = getPhaseLevel(supportLevel, supportPhase, SUPPORT_LEVELS);
    // Merge phase-specific adds
    for (const addId of (phaseResult as any).subs || []) {
      if (!subs.includes(addId)) {
        subs.push(addId);
        dosages[addId] = (phaseResult as any).dosages?.[addId] || dosages[addId] || DEFAULT_DOSAGES[addId] || { mg: 500, timing: 'с едой' };
      }
    }
    // Apply analog replacements
    for (const [originalId, analogId] of Object.entries(selectedAnalogs)) {
      const idx = subs.indexOf(originalId);
      if (idx >= 0 && analogId !== originalId) {
        subs[idx] = analogId;
        const analogDosage = DEFAULT_DOSAGES[analogId] || { mg: 500, timing: 'с едой' };
        delete dosages[originalId];
        dosages[analogId] = analogDosage;
      }
    }
    // Add enhancedSubs (manual additions)
    for (const enhId of enhancedSubs) {
      if (!subs.includes(enhId)) {
        subs.push(enhId);
        dosages[enhId] = dosages[enhId] || DEFAULT_DOSAGES[enhId] || { mg: 500, timing: 'с едой' };
      }
    }
    // Auto-add hCG if AAS in course
    const hasAAS = (linked.course || []).some((c: any) => {
      const ph = PHARMA_DB[c.substanceId];
      return ph?.class && ['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','oral_17aa','sarm'].includes(ph.class);
    });
    if (hasAAS && !subs.includes('hcg')) {
      subs.push('hcg');
      dosages['hcg'] = DEFAULT_DOSAGES['hcg'] || { mg: 500, timing: '2x/нед, схема 3/1 (МЕ)' };
    }
    return { subs, dosages, planResult: result };
  }, [supportLevel, supportPhase, selectedAnalogs, enhancedSubs, linked.course, linked.profile, courseWeekState]);

  // C4: Track plan changes in history
  useEffect(() => {
    if (effectiveLevel?.subs && effectiveLevel.subs.length > 0) {
      setPlanHistory(prev => {
        const last = prev[prev.length - 1];
        const currentSubs = [...effectiveLevel.subs].sort().join(',');
        const lastSubs = last ? [...last.subs].sort().join(',') : '';
        if (currentSubs === lastSubs) return prev;
        const entry = {
          level: supportLevel,
          subs: [...effectiveLevel.subs],
          date: new Date().toLocaleTimeString('ru-RU'),
          riskBefore: planResult?.overallRiskBefore || 0,
          riskAfter: planResult?.overallRiskAfter || 0,
        };
        return [...prev.slice(-9), entry];
      });
    }
  }, [effectiveLevel?.subs, supportLevel]);

  const calcSupport = (overrideLevel?: 'basic' | 'mid' | 'max' | 'boost', overrideSubs?: string[]) => {
    const s = linked.profile?.settings;
    const level = (overrideLevel || supportLevel) as PowerLevel;
    // Build TZ state from linked data
    const h = hydrateState();
    const aasList = (linked.course || []).filter(c => {
      const ph = PHARMA_DB[c.substanceId] as any;
      return ph?.class && ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'].includes(ph.class);
    }).map(c => ({ id: c.substanceId, doseMgWeek: (c.doseValue || 0) * ((typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0) > 0 ? (typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0) : 1), weeks: (c.endWeek || 12) - (c.startWeek || 0) }));
    const defaults: Partial<CalculatorState> = {
      profile: { weight: s?.weight ?? 80, age: s?.age ?? 30, sex: (s?.sex ?? 'male') as 'male' | 'female', workoutsPerWeek: s?.workoutsPerWeek ?? 3, avgWorkoutMinutes: s?.avgWorkoutMinutes ?? 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
      pharma: { phase: 'course', aas: aasList, hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: !!linked.course?.find((c: any) => c.substanceId === 'hcg'), hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: aasList.some(a => a.id.includes('ostarine') || a.id.includes('lgd')), hasMGF: false, hasGLP1: false },
      oda: { jointPain: (h.oda?.jointPain || 'none') as string, ligamentIssues: h.oda?.ligamentIssues || false, backPain: h.oda?.backPain || false, injuries: h.oda?.injuries || [] },
    };
    const state: CalculatorState = {
      ...defaults,
      ...h,
      pharma: {
        ...defaults.pharma,
        ...(h.pharma || {}),
        // Merge AAS from both sources: linked.course (primary) + saved data
        aas: [...(defaults.pharma?.aas || []), ...((h.pharma?.aas || []) as any[]).filter((a: any) => !defaults.pharma?.aas?.some((d: any) => d.id === a.id))],
        // Preserve hasHCG from linked.course
        hasHCG: defaults.pharma?.hasHCG || h.pharma?.hasHCG || false,
      },
      powerLevel: level,
      courseWeek: courseWeekState,
    } as CalculatorState;
    stateRef.current = state;
    const tzResult: CalculatorResult = calculateSupportTZ(state);
    // ── TZ Risk Engine: probabilistic 49-cell model ──
    const tzRiskInput = {
      course: linked.course || [],
      labs: linked.labs || [],
      genetics: {} as any,
      nutrition: {
        proteinPerKg: (s?.weight ?? 80) > 0 ? ((s?.nutritionFactor ?? 0.8) * 160) / (s?.weight ?? 80) : 1.8,
        fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, waterL: 2,
        calories: 2500,
      },
      training: {
        hasHIIT: (s?.workoutsPerWeek ?? 3) >= 4,
        weeklyMinutes: (s?.workoutsPerWeek ?? 3) * (s?.avgWorkoutMinutes ?? 60),
        volumeTonnes: 8000, lissMinutesPerWeek: 60,
      },
      weight: s?.weight ?? 80, age: s?.age ?? 30, sex: (s?.sex ?? 'male') as 'male' | 'female',
      supportSubstances: tzResult.selectedSubstances || [],
      courseWeek: courseWeekState,
    };
    const tzRiskResult: TZRiskResult = calculateTZRisk(tzRiskInput);
    const tzCompat = toCompatibleResult(tzRiskResult);
    const calcResultData: Record<string, any> = {
      riskBeforeSupport: tzRiskResult.overallRaw,
      riskAfterSupport: tzRiskResult.overallNet,
      supportScore: Math.round(100 - tzRiskResult.overallNet),
      systemSupport: Object.fromEntries(Object.entries(tzCompat.systemBreakdown).map(([k, v]) => [k, 100 - v.net])),
      // coverageMap: per-system risk reduction fraction (for RiskOverview display)
      coverageMap: Object.fromEntries(Object.entries(tzCompat.systemBreakdown).map(([k, v]) => [k, Math.max(0, Math.min(1, (v.raw - v.net) / Math.max(1, v.raw)))])),
      riskAssessment: {
        systemBreakdown: Object.fromEntries(Object.entries(tzCompat.systemBreakdown).map(([k, v]) => [k, { raw: v.raw, net: v.net }])),
        mechanismBreakdown: tzCompat.mechanismBreakdown,
        mechanismDetail: tzCompat.mechanismDetail,
      },
      tzRiskResult,
      timestamp: tzResult.timestamp ?? new Date().toISOString(),
      schedule: tzResult.schedule,
      synergyIdsUsed: tzResult.synergyIdsUsed,
      selectedSubstances: tzResult.selectedSubstances,
      contraindicationAlerts: tzResult.contraindicationAlerts,
      negativeBlocks: tzResult.negativeBlocks,
    };
    setSupportResult(calcResultData as any);
    setCalcResult(calcResultData);
    setCalcDone(true);
    const allSubs = [...new Set([...supportDrugs, ...(effectiveLevel?.subs || [])])].filter(Boolean);
    setDbInteractions(checkSupportInteractions(allSubs));
    setGoalRecommendations(findSupportByGoal(supportGoal, 20));

    const labData = linked.labs || [];
    const labRes = interpretLabs(labData);
    setLabAnalysis(labRes);
    const mechRep = generateMechanismReport(labRes);
    setMechanismReport(mechRep);
    setTimedPlan(generateTimedPlan(mechRep.mechanisms, supportGoal));

    const modelRisk = computeRiskByModel(riskModel, labRes,
      Object.fromEntries(['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'].map(s => [s, calcResultData?.riskAssessment?.systemBreakdown?.[s]?.raw ?? 15])),
      Object.fromEntries(supportDrugs.map(() => [0, 5]).map((v, i) => [['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'][i], 5])),
      calcResultData?.systemSupport ?? {}
    );
    setModelRiskResult(modelRisk);

    // Auto-generate weekly plan
    const baseWeights: Record<string, number> = {};
    const drugLoads: Record<string, number> = {};
    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
      baseWeights[sys] = calcResultData?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 15;
      drugLoads[sys] = supportDrugs.length * 2;
    }
    const labStress: Record<string, number> = {};
    if (labRes) {
      labStress.cardio = labRes.cardioRisk; labStress.hepatic = labRes.liverStress;
      labStress.renal = labRes.kidneyStress; labStress.endocrine = labRes.hormoneScore;
      labStress.hematologic = labRes.inflammation * 5;
    }
    const plan = generateWeeklyPlan(allSubs, riskCalcMethod, baseWeights, drugLoads, labStress, calcResultData?.systemSupport ?? {});
    setWeeklyPlan(plan);

    // Save support results back to profile for integration
    try {
      const supps = (effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || []).map(id => {
        const dos = (effectiveLevel?.dosages || SUPPORT_LEVELS[level]?.dosages || {})[id] || DEFAULT_DOSAGES[id] || { mg: 500, timing: 'с едой' };
        const subInfo = catalogSubstances.find(s => s.id === id);
        const doseUnit = dos.mg >= 5000 ? 'g' : 'mg';
        return { id, name: subInfo?.name || id, doseMg: dos.mg, doseUnit: doseUnit as 'mg' | 'g' | 'mcg' | 'IU', notes: dos.timing };
      });
      updateProfile({ settings: { ...(getProfile().settings || {}), currentSupplements: supps } });
      notifyDataChange();
      // Sync support risk data for RiskScreen
      localStorage.setItem('he_support_risk', JSON.stringify({
        riskBeforeSupport: calcResultData.riskBeforeSupport,
        riskAfterSupport: calcResultData.riskAfterSupport,
        systemSupport: calcResultData.systemSupport,
        subs: effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || [],
        timestamp: Date.now(),
      }));
    } catch (e2) { /* ignore profile save errors */ }
  };

  // Removed auto-calc useEffect. User clicks "Рассчитать поддержку" manually.
  const [calcRequested, setCalcRequested] = useState(false);

  // Interaction checker state
  const [interactTab, setInteractTab] = useState<'support' | 'pharma'>('support');
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);
  const [pharmaInteractIds, setPharmaInteractIds] = useState<string[]>(['', '']);
  const [pharmaInteractSearch, setPharmaInteractSearch] = useState('');
  // Auto-seed pharma interaction selectors from course
  useEffect(() => {
    const courseIds = (linked.course || []).map(c => c.substanceId).filter(Boolean);
    if (courseIds.length > 0 && pharmaInteractIds.every(id => !id)) {
      setPharmaInteractIds(courseIds.slice(0, Math.min(4, courseIds.length)));
    }
  }, [(linked.course || []).length]);
  const [stackCalcSize, setStackCalcSize] = useState<string>('5-7');
  const [stackCalcOrgans, setStackCalcOrgans] = useState<string[]>([]);
  const [stackCalcMech, setStackCalcMech] = useState<string[]>([]);
  const [stackCalcMode, setStackCalcMode] = useState<'auto'|'manual'>('auto');
  const [generatedStack, setGeneratedStack] = useState<any>(null);
  const [generatedStacks, setGeneratedStacks] = useState<any[]>([]);
  const [pubMedQuery, setPubMedQuery] = useState('');
  const [pubMedResults, setPubMedResults] = useState<PubMedArticle[]>([]);
  const [pubMedLoading, setPubMedLoading] = useState(false);
  const [planView, setPlanView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [planSaved, setPlanSaved] = useState<string | boolean>(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [planSubTab, setPlanSubTab] = useState<'active' | 'archive' | 'myplans'>('active');
  const [favSearch, setFavSearch] = useState('');
  const [archivedPlans, setArchivedPlans] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('supportPlanArchive') || '[]'); } catch { return []; }
  });
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('supportCart') || '[]'); } catch { return []; }
  });
  const [pubMedError, setPubMedError] = useState('');
  const [pharmaSearchQ, setPharmaSearchQ] = useState('');
  const [pharmaSearchResults, setPharmaSearchResults] = useState<{ name: string; id: string; cls: string; desc: string }[]>([]);
  const [stackBuilder, setStackBuilder] = useState<string[]>([]);
  const [savedStacks, setSavedStacks] = useState<{ id: string; name: string; date: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }>; notes?: string }[]>(() => { try { return JSON.parse(localStorage.getItem('savedStacks') || '[]'); } catch { return []; } });
  const [stackName, setStackName] = useState('');
  const [stackNotes, setStackNotes] = useState('');
  const [editingStackNotes, setEditingStackNotes] = useState<string | null>(null);
  const [editNotesText, setEditNotesText] = useState('');
  const [expandedStack, setExpandedStack] = useState<string | null>(null);
  const [favRefresh, setFavRefresh] = useState(0);
  const [favTab, setFavTab] = useState<string>('favorites');
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [researchSource, setResearchSource] = useState<'pubmed' | 'pubchem' | 'scholar' | 'fda' | 'pharma'>('pubmed');
  const [pubchemResults, setPubchemResults] = useState<any[]>([]);
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [pubchemError, setPubchemError] = useState('');
  const [fdaResults, setFdaResults] = useState<any[]>([]);
  const [fdaLoading, setFdaLoading] = useState(false);
  const [fdaError, setFdaError] = useState('');
  const [mixGoals, setMixGoals] = useState<string[]>(['pump']);
  const mixGoal = mixGoals[0] || 'pump'; // primary goal for stacks
  const [mixTiming, setMixTiming] = useState<string>('pre');
  const [mixInsulin, setMixInsulin] = useState<number>(0);
  const [mixInsulinTiming, setMixInsulinTiming] = useState<'pre'|'post'>('post');
  const [mixDrugIGF, setMixDrugIGF] = useState<number>(0);
  const [mixDrugIGFTiming, setMixDrugIGFTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugGH, setMixDrugGH] = useState<number>(0);
  const [mixDrugGHTiming, setMixDrugGHTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugMGF, setMixDrugMGF] = useState<number>(0);
  const [mixDrugMGFTiming, setMixDrugMGFTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugGLP1, setMixDrugGLP1] = useState(false);
  // Custom recipe overrides: removed items + replacement items
  const [customRecipeOverrides, setCustomRecipeOverrides] = useState<{removed:string[]; replaced:Record<string,{id:string;dose:string;unit:string;note:string}>}>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_recipe_overrides') || 'null') || { removed:[], replaced:{} }; } catch { return { removed:[], replaced:{} }; }
  });
  // Dose editor popup
  const [editingDose, setEditingDose] = useState<{ id:string; timing:string; currentDose:string; currentUnit:string } | null>(null);
  const [mixSavedRecipes, setMixSavedRecipes] = useState<{id:string;name:string;goal:string;items:MixRecipeItem[]}[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_saved_recipes') || '[]') || []; } catch { return []; }
  });
  const [appliedTemplate, setAppliedTemplate] = useState<MixTemplate | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_applied_template') || 'null'); } catch { return null; }
  });
  const profileSettings = linked.profile?.settings;
  const [mixWorkoutType, setMixWorkoutType] = useState<'heavy'|'moderate'|'light'>(() => {
    const wpw = profileSettings?.workoutsPerWeek ?? 3;
    const am = profileSettings?.avgWorkoutMinutes ?? 60;
    if (wpw >= 5 && am >= 90) return 'heavy';
    if (wpw >= 3) return 'moderate';
    return 'light';
  });
  const [mixTimeOfDay, setMixTimeOfDay] = useState<'morning'|'afternoon'|'evening'>('morning');
  const [mixHistory, setMixHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_mixes') || '[]'); } catch { return []; }
  });
  const [mixSavedPlans, setMixSavedPlans] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_saved_plans') || '[]'); } catch { return []; }
  });
  const [expandedSection, setExpandedSection] = useState<Set<string>>(new Set());
  const [compareKit, setCompareKit] = useState<any | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  // Custom substance picker
  const [customMixSubstance, setCustomMixSubstance] = useState('');
  const [customMixDoseMg, setCustomMixDoseMg] = useState(0);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customMixItems, setCustomMixItems] = useState<{timing:'pre'|'intra'|'post';id:string;name:string;dose:string;unit:string;mg:number}[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_custom_items') || '[]'); } catch { return []; }
  });
  const customMixSubstances = SUPPORT_CATALOG_DATA ? Object.entries(SUPPORT_CATALOG_DATA).map(([id, e]) => ({ id, name: ((e as any).name || (e as any).ru || id) as string })).sort((a, b) => a.name.localeCompare(b.name)) : [];

  // Joints calculator state (lifted from IIFE to component level for hook stability)
  const [jointPain, setJointPain] = useState(0);
  const [injuryHistory, setInjuryHistory] = useState(0);
  const [trainLoad, setTrainLoad] = useState(3);
  const jointScore = Math.min(100, Math.round((jointPain * 10) + (injuryHistory * 5) + (trainLoad * 3)));
  const jointColor = jointScore < 20 ? '#22c55e' : jointScore < 40 ? '#f59e0b' : jointScore < 60 ? '#f97316' : '#ef4444';
  const jointLabel = jointScore < 20 ? 'Норма' : jointScore < 40 ? 'Умеренный риск' : jointScore < 60 ? 'Высокий риск' : 'Критический';
  const CATALOG_IDS = useMemo(() => new Set(Object.keys(SUPPORT_CATALOG_DATA).map(k => k.toLowerCase())), []);

  // Neurotoxicity tab state (lifted from IIFE to component level)
  const [neuroTab, setNeuroTab] = useState<'calc' | 'mechanisms' | 'support'>('mechanisms');

  // Catalog sub-tab
  const [catalogSubTab, setCatalogSubTab] = useState<'type' | 'organ' | 'tier' | 'stack'>('type');
  const isComplexId = (id: string) => {
    const low = id.toLowerCase();
    return low.includes('complex') || low.includes('_blend') || low.includes('_mix') || low.endsWith('_combo');
  };

  const handlePubMedSearch = async () => {
    if (!pubMedQuery.trim()) return;
    setPubMedLoading(true);
    setPubMedError('');
    try {
      const result = await searchPubMed(pubMedQuery, 20);
      setPubMedResults(result.articles);
    } catch (e: any) {
      setPubMedError(e.message || 'Ошибка поиска');
      setPubMedResults([]);
    } finally {
      setPubMedLoading(false);
    }
  };

  const doPharmaSearch = (q: string) => {
    setPharmaSearchQ(q);
    if (!q.trim()) { setPharmaSearchResults([]); return; }
    const ql = q.toLowerCase();
    const results: { name: string; id: string; cls: string; desc: string }[] = [];
    for (const [id, sub] of Object.entries(PHARMA_DB)) {
      if ((sub.name||'').toLowerCase().includes(ql) || id.toLowerCase().includes(ql) || (sub.class||'').toLowerCase().includes(ql)) {
        const detail = getPharmaDetail(id);
        results.push({ name: sub.name, id: sub.id, cls: sub.class, desc: (detail?.description || sub.description || SUPPORT_CLASS_LABELS[sub.class] || '') });
      }
    }
    for (const sub of catalogSubstances) {
      if ((sub.name||'').toLowerCase().includes(ql) || (sub.id||'').toLowerCase().includes(ql) || (sub.categories||[]).some(c => (c||'').toLowerCase().includes(ql))) {
        results.push({ name: sub.name || sub.id, id: sub.id, cls: sub.type || 'supplement', desc: (sub.description || '') });
      }
    }
    setPharmaSearchResults(results.slice(0, 30));
  };

  const handlePubchemSearch = async () => {
    if (!pubMedQuery.trim()) return;
    setPubchemLoading(true);
    setPubchemError('');
    try {
      const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(pubMedQuery)}/JSON`);
      if (!res.ok) throw new Error('PubChem: соединение не найдено');
      const data = await res.json();
      const pc = data?.PC_Compounds?.[0];
      if (!pc) throw new Error('PubChem: нет данных');
      const props: Record<string, any> = {};
      (pc.props || []).forEach((p: any) => {
        if (p.urn?.label) props[p.urn.label] = p.value;
      });
      setPubchemResults([{
        name: props['IUPAC Name']?.sval || props['Title']?.sval || pubMedQuery,
        mw: props['Molecular Weight']?.fval || props['Molecular Formula']?.sval || '—',
        iupac: props['IUPAC Name']?.sval || '—',
        formula: props['Molecular Formula']?.sval || '—',
        description: props['Title']?.sval || '',
      }]);
    } catch (e: any) {
      setPubchemError(e.message || 'Ошибка поиска PubChem');
      setPubchemResults([]);
    } finally {
      setPubchemLoading(false);
    }
  };

  const handleFDASearch = async () => {
    if (!pubMedQuery.trim()) return;
    setFdaLoading(true);
    setFdaError('');
    try {
      const res = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(pubMedQuery)}&limit=5`);
      if (!res.ok) throw new Error('OpenFDA: препарат не найден');
      const data = await res.json();
      const items = (data.results || []).map((r: any) => ({
        brandName: r.openfda?.brand_name?.[0] || '—',
        genericName: r.openfda?.generic_name?.[0] || '—',
        indications: r.indications_and_usage?.[0]?.slice(0, 300) || '—',
        manufacturer: r.openfda?.manufacturer_name?.[0] || '—',
      }));
      setFdaResults(items);
    } catch (e: any) {
      setFdaError(e.message || 'Ошибка поиска FDA');
      setFdaResults([]);
    } finally {
      setFdaLoading(false);
    }
  };

  const saveCurrentStack = () => {
    const level = SUPPORT_LEVELS[supportLevel];
    if (!level) return;
    const id = 'stack_' + Date.now();
    const newStack = { id, name: stackName || level.label + ' ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), subs: level.subs, dosages: level.dosages || {}, notes: stackNotes || '' };
    const updated = [...savedStacks, newStack];
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
    setStackName('');
    setStackNotes('');
  };

  const saveBuilderStack = () => {
    if (stackBuilder.length === 0) return;
    const id = 'build_' + Date.now();
    const label = stackBuilder.slice(0, 3).map(sid => resolveSubName(sid)).join(', ') + (stackBuilder.length > 3 ? ` +${stackBuilder.length - 3}` : '');
    const newStack = { id, name: `Стек: ${label}`, date: new Date().toISOString(), subs: stackBuilder, dosages: {} };
    const updated = [...savedStacks, newStack];
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
    setStackBuilder([]);
  };

  const deleteStack = (id: string) => {
    const updated = savedStacks.filter(s => s.id !== id);
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
  };

  const availableMechs = useMemo(() => {
    if (stackCalcOrgans.length === 0) {
      return [];
    }
    const mechSet = new Set<string>();
    for (const key of stackCalcOrgans) {
      const mechs = ORGAN_MECHANISMS[key];
      if (mechs) { mechs.forEach(m => mechSet.add(m)); }
    }
    return [...mechSet].sort();
  }, [stackCalcOrgans]);

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

      isSupportSubstance: true,
      pharmaClass: s.class,
    }));
    
    return [...supplements, ...supportSupplements];
  }, []);

  // All support substances for interaction checker
  const allSupport = useMemo(() => supplementList, [supplementList]);
  // Catalog-filtered substances for interaction selectors (289 curated entries)
  const catalogSupport = useMemo(() => allSupport.filter(s => CATALOG_IDS.has((s.id||'').toLowerCase())), [allSupport, CATALOG_IDS]);

  // Support-only synergy pairs
  const supportSynergies = useMemo(() => {
    return SYNERGY_PAIRS.filter(p => {
      const a = PHARMA_DB[p.substanceA];
      const b = PHARMA_DB[p.substanceB];
      const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'];
      // Include: both are support substances, or at least one is a supplement
      const aIsSupport = a ? supportClasses.includes(a.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceA] !== undefined;
      const bIsSupport = b ? supportClasses.includes(b.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceB] !== undefined;
      return (aIsSupport || bIsSupport) && CATALOG_IDS.has(p.substanceA.toLowerCase()) && CATALOG_IDS.has(p.substanceB.toLowerCase());
    });
  }, [CATALOG_IDS]);

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

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO_ALL[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  // Interaction checker
  const addInteraction = () => { if (interactionIds.length < 10) setInteractionIds([...interactionIds, '']); };
  const maxInteractionsReached = interactionIds.length >= 10;
  const removeInteraction = (idx: number) => setInteractionIds(interactionIds.filter((_, i) => i !== idx));
  const updateInteraction = (idx: number, value: string) => {
    const updated = [...interactionIds];
    updated[idx] = value;
    setInteractionIds(updated);
  };
  const validInteractionIds = interactionIds.filter(Boolean);
  
  // Group catalogSubstances by primary category for catalog
  const catalogSubstances = useMemo(() => {
    const allSubsMap = new Map<string, SupportSubstance>();
    for (const s of ALL_SUBSTANCES) allSubsMap.set(s.id.toLowerCase(), s);
    return Object.values(SUPPORT_CATALOG_DATA).map(entry => {
      const allSub = allSubsMap.get((entry.id||'').toLowerCase());
      return {
        id: entry.id,
        name: entry.nameRu ? (entry.name && entry.name !== entry.nameRu ? `${entry.nameRu} (${entry.name})` : entry.nameRu) : (allSub?.name || entry.name || entry.id),
        categories: entry.category || [],
        mechanisms: (entry.mechanisms && entry.mechanisms.length > 0) ? entry.mechanisms : (allSub?.mechanisms || []),
        organs: (entry.organs && entry.organs.length > 0) ? entry.organs : (allSub?.organs || []),
        description: entry.description || allSub?.description || '',
        type: (entry.category||[])[0] || allSub?.type || 'supplement',
        deficiency: allSub?.deficiency || '',
      };
    }) as SupportSubstance[];
  }, []);

  // Shared normCat — normalize category names to group keys
  const normCat = (cat: string): string => {
    const organCatToGroup: Record<string,string> = {
      hepatoprotector:'liver',cardioprotector:'cardio',neuroprotector:'neuro',
      immunomodulator:'immune',immune:'immune',joint:'joints',bone:'bone',
      respiratory:'lung',eye_protector:'eye',renal:'kidney',skin:'skin',
      beauty:'skin',urinary_protector:'kidney',anticoagulant:'blood',
      thyroid:'thyroid',bile_acid:'liver',choleretic:'liver',lipid:'cardio',
      anabolic:'muscle',hematologic:'blood',antimicrobial:'immune',
      recovery:'recovery',marker:'other',nsaid:'antiinflammatory',
      electrolyte:'electrolyte',multivitamin:'vitamins',gut:'gi',
      gastrointestinal:'gi',antioxidant:'antioxidants',antiinflammatory:'antiinflammatory',
      anti_inflammatory:'antiinflammatory',anxiolytic:'anxiolytic',
      antidepressant:'mood',antiviral:'immune',antibiotic:'immune',
      pain:'analgesic',analgesic:'analgesic',stress:'adaptogens',
      glucose:'metabolism',metabolism:'metabolism',metabolic:'metabolism',
      antiaging:'antiaging',antiglycation:'antiaging',no_organ:'other',
    };
    const normed = (cat||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
    if (organCatToGroup[normed]) return organCatToGroup[normed];
    const m: Record<string,string> = {
      amino_acid:'amino_acids',aminoacids:'amino_acids',
      vitamin:'vitamins',vitamin_:'vitamins',
      mineral:'minerals',mineral_:'minerals',
      herb:'herbs',herbal:'herbs',
      peptide:'peptides',peptid:'peptides',
      nootropic:'nootropics',nootrop:'nootropics',
      adaptogen:'adaptogens',adaptog:'adaptogens',
      hormone:'hormones',hormon:'hormones',
      enzyme:'enzymes',
      probiotic:'probiotics',prebiot:'probiotics',
      fatty_acid:'fatty_acids',lipids:'fatty_acids',
      mushroom:'mushrooms',fungus:'mushrooms',fungi:'mushrooms',
      electrolyte:'electrolytes',
      polyphenol:'polyphenols',flavonoid:'polyphenols',polyphenols:'polyphenols',
      antimicrobial:'antimicrobial',antibacterial:'antimicrobial',
    };
    const c = (cat||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
    if (m[c]) return m[c];
    for (const [k,v] of Object.entries(m)) if (c.includes(k)||k.includes(c)) return v;
    return cat;
  };
  // Shared complex-matcher (used by groupedSubstances + OrganGroupedSubstances)
  const matchComplex = (s: SupportSubstance): boolean => {
    if (isComplexId(s.id)) return true;
    const firstCat = (s.categories||[])[0] || '';
    const nc = normCat(firstCat);
    if (nc === 'complex' || nc === 'other') return true;
    if ((s.organs||[]).some(o => (o||'').trim().toUpperCase() === 'WHOLE_BODY')) return true;
    if (['antiinflammatory','anxiolytic','antiaging','metabolism','antioxidants','adaptogens','mood','recovery','electrolytes'].includes(nc)) return true;
    if ((s.id||'').toLowerCase().includes('_stack') || (s.id||'').toLowerCase().includes('_protocol') || (s.id||'').toLowerCase().includes('_pct')) return true;
    if ((s as {type: string}).type === 'complex') return true;
    return false;
  };

  const groupedSubstances = useMemo(() => {
    let filtered = catalogSubstances;
    if (supportTierFilter !== 'all') {
      filtered = filtered.filter(s => getSubstanceTier(s.id) === supportTierFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(s => (s.categories||[]).some(c => c === categoryFilter));
    }
    // Apply TZ organ filter
    if (catalogOrgans.length > 0) {
      filtered = filtered.filter(s => {
        const subId = (s.id||'').toLowerCase();
        const tzEntry = getDrugTzMechanisms(subId);
        if (tzEntry.length) {
          const entryOrgans = new Set(tzEntry.map(m => m.organId));
          return catalogOrgans.some(o => entryOrgans.has(o));
        }
        // Fallback: check if old organ names match TZ systems
        const oldOrgans = (s as any).organs || [];
        if (oldOrgans.length) {
          const tzToOld: Record<string, string[]> = { cardio:['cardio','heart'], hepatic:['hepatic','liver'], renal:['renal','kidney'], cns:['cns','neuro','nerve','brain'], reproductive:['reproductive','sexual','hpta','gonad'], hematologic:['hematologic','blood','metabolic'] };
          return catalogOrgans.some(o => (tzToOld[o]||[]).some(old => oldOrgans.some((org: string) => org.toLowerCase().includes(old))));
        }
        return false;
      });
    }
    // Apply search query
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.name||'').toLowerCase().includes(sq) ||
        (s.id||'').toLowerCase().includes(sq) ||
        (s.description||'').toLowerCase().includes(sq) ||
        (s.categories||[]).some(c => (c||'').toLowerCase().includes(sq)) ||
        (s.mechanisms||[]).some(m => (m||'').toLowerCase().includes(sq))
      );
    }
    const groups: Record<string, SupportSubstance[]> = {};
    for (const sub of filtered) {
      const primaryCat = normCat(sub.type) || normCat((sub.categories||[])[0] || 'other');
      if (!groups[primaryCat]) groups[primaryCat] = [];
      groups[primaryCat].push(sub);
    }
    // Compute class-based sub-groups for badges
    const getSubstanceClass = (sub: SupportSubstance): string | null => {
      const searchStr = ((sub.name||'') + ' ' + (sub.id||'')).toLowerCase();
      for (const [key, info] of Object.entries(CLASS_BASE_NAMES)) {
        if (info.match.test(searchStr)) return key;
      }
      return null;
    };
    return Object.entries(groups)
      .map(([cat, items]) => {
        const classMap: Record<string, SupportSubstance[]> = {};
        for (const sub of items) {
          const cls = getSubstanceClass(sub);
          if (cls) {
            if (!classMap[cls]) classMap[cls] = [];
            classMap[cls].push(sub);
          }
        }
        const classBadges = Object.entries(classMap)
          .map(([clsKey, clsItems]) => ({ clsKey, label: CLASS_BASE_NAMES[clsKey]?.label || clsKey, emoji: CLASS_BASE_NAMES[clsKey]?.emoji || '📦', count: clsItems.length }))
          .sort((a, b) => b.count - a.count);
        const classItems = Object.fromEntries(
          Object.entries(classMap).filter(([, clsItems]) => clsItems.length >= 3)
        );
        return { cat, items, count: items.length, classBadges, classItems };
      })
      .sort((a, b) => b.count - a.count);
  }, [searchQuery, supportTierFilter, categoryFilter, catalogSubstances]);

  // Type-only grouping for "По типам" tab — все распределено, без polyphenols/supplement как отдельных групп
  const TYPE_GROUPS = new Set(['vitamins','minerals','amino_acids','fatty_acids','herbs','mushrooms','peptides','hormones','enzymes','probiotics','electrolytes','nootropics','adaptogens','antioxidants','pharma']);
  const ORGAN_TO_TYPE: Record<string, string> = {
    antioxidant:'antioxidants',polyphenol:'antioxidants',mitochondrial:'antioxidants',
    cardioprotector:'antioxidants',eye_protector:'antioxidants',anti_aging:'antioxidants',
    antiinflammatory:'antioxidants',anti_inflammatory:'antioxidants',skin:'antioxidants',
    beauty:'antioxidants',recovery:'antioxidants',marker:'antioxidants',
    neuroprotector:'nootropics',anxiolytic:'nootropics',antidepressant:'nootropics',
    immunomodulator:'antioxidants',anticoagulant:'antioxidants',urinary_protector:'herbs',
    nsaid:'antioxidants',immune:'herbs',
    metabolic:'hormones',thyroid:'hormones',
    lipid:'fatty_acids',bone:'minerals',electrolyte:'electrolytes',
    multivitamin:'vitamins',hematologic:'vitamins',
    gut:'probiotics',gastrointestinal:'probiotics',
    joint:'herbs',hepatoprotector:'herbs',
  };
  const findTypeKey = (sub: SupportSubstance): string => {
    for (const cat of (sub.categories||[])) {
      const n = normCat(cat);
      if (TYPE_GROUPS.has(n)) return n;
    }
    const nt = normCat(sub.type);
    if (TYPE_GROUPS.has(nt)) return nt;
    for (const cat of (sub.categories||[])) {
      const raw = cat.toLowerCase().replace(/[^a-z0-9_]/g,'');
      if (ORGAN_TO_TYPE[raw]) return ORGAN_TO_TYPE[raw];
    }
    if (ORGAN_TO_TYPE[sub.type]) return ORGAN_TO_TYPE[sub.type];
    return 'antioxidants';
  };
  const typeGroupedSubstances = useMemo(() => {
    const all = groupedSubstances.flatMap(g => g.items);
    const groups: Record<string, SupportSubstance[]> = {};
    for (const sub of all) {
      const k = findTypeKey(sub);
      if (!groups[k]) groups[k] = [];
      groups[k].push(sub);
    }
    return Object.entries(groups).map(([cat, items]) => {
      const classMap: Record<string, SupportSubstance[]> = {};
      for (const sub of items) {
        const searchStr = ((sub.name||'') + ' ' + (sub.id||'')).toLowerCase();
        for (const [key, info] of Object.entries(CLASS_BASE_NAMES)) {
          if (info.match.test(searchStr)) {
            if (!classMap[key]) classMap[key] = [];
            classMap[key].push(sub);
            break;
          }
        }
      }
      const classBadges = Object.entries(classMap)
        .map(([clsKey, clsItems]) => ({ clsKey, label: CLASS_BASE_NAMES[clsKey]?.label || clsKey, emoji: CLASS_BASE_NAMES[clsKey]?.emoji || '📦', count: clsItems.length }))
        .sort((a, b) => b.count - a.count);
      const classItems = Object.fromEntries(
        Object.entries(classMap).filter(([, clsItems]) => clsItems.length >= 3)
      );
      return { cat, items, count: items.length, classBadges, classItems };
    }).sort((a, b) => b.count - a.count);
  }, [groupedSubstances]);

  // Organ-based grouping for catalog sub-tab
  // Phase 5.12: Comprehensive 16-category organ mapping
  const ORGAN_CATEGORY_MAP: Record<string, { key: string; label: string; emoji: string }> = {
    HEART: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    VESSELS: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    LIVER: { key: 'liver', label: 'Печень', emoji: '🫁' },
    BILE_DUCTS: { key: 'liver', label: 'Печень', emoji: '🫁' },
    GALLBLADDER: { key: 'liver', label: 'Печень', emoji: '🫁' },
    gallbladder: { key: 'liver', label: 'Печень', emoji: '🫁' },
    KIDNEYS: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    kidney: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    BLADDER: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    URINARY: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    BRAIN: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    NERVES: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    NERVOUS_SYSTEM: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    HYPOTHALAMUS: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    BONES: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    bone: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    JOINTS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    joint: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    LIGAMENTS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    TENDONS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    SPINE: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    BONE_MARROW: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    TEETH: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    IMMUNE_SYSTEM: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    immune: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    LYMPH: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    LYMPHATIC: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    GI: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    STOMACH: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    intestine: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    MICROBIOME: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    ESOPHAGUS: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    MOUTH: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    THYROID: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PANCREAS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    ADRENALS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    adrenal: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PITUITARY: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PARATHYROID: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    HORMONES: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    GONADS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    OVARIES: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    UTERUS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PLACENTA: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    SKIN: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    HAIR: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    SCALP: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    NAILS: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    EYES: { key: 'eyes', label: 'Глаза', emoji: '👁️' },
    eye: { key: 'eyes', label: 'Глаза', emoji: '👁️' },
    PROSTATE: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    TESTES: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    REPRODUCTIVE: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    female: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    male: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    BLOOD: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    PLATELETS: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    LUNGS: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    lung: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    THROAT: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    NOSE: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    MUSCLES: { key: 'muscles', label: 'Мышцы и восстановление', emoji: '💪' },
    muscle: { key: 'muscles', label: 'Мышцы и восстановление', emoji: '💪' },
    MITOCHONDRIA: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    CELLS: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    METABOLISM: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FAT_TISSUE: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FAT: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FETUS: { key: 'other', label: 'Прочее', emoji: '📦' },
    INFANT: { key: 'other', label: 'Прочее', emoji: '📦' },
    TISSUES: { key: 'other', label: 'Прочее', emoji: '📦' },
    ORGANS: { key: 'other', label: 'Прочее', emoji: '📦' },
    BREAST: { key: 'reproductive', label: 'Грудные железы', emoji: '🫃' },
    breast: { key: 'reproductive', label: 'Грудные железы', emoji: '🫃' },
    MUCOSA: { key: 'skin_hair', label: 'Кожа и слизистые', emoji: '🧴' },
    THYMUS: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    INTESTINES: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    GUT: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    BLOOD_VESSELS: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    VASCULAR: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    WHOLE_BODY: { key: 'whole_body_skip', label: 'Комплексы', emoji: '🧩' },
    BONE: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    URINARY_TRACT: { key: 'kidneys', label: 'Почки и мочевыводящие', emoji: '🫘' },
    liver: { key: 'liver', label: 'Печень', emoji: '🫁' },
    brain: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    heart: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    vessels: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    skin: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    cells: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    mitochondria: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    stomach: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    pancreas: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    blood: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    pituitary: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    testes: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
  };
  const OrganGroupedSubstances = useMemo(() => {
    const groups: Record<string, { key: string; label: string; emoji: string; items: SupportSubstance[]; count: number }> = {};
    const usedKeys = new Set<string>();
    const filtered = searchQuery
      ? catalogSubstances.filter(s =>
          (s.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.id||'').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : catalogSubstances;
    for (const sub of filtered) {
      const organs = sub.organs || [];
      usedKeys.clear();
      if (organs.length === 0) {
        continue; // skip items without organs
      }
      for (const org of organs) {
        const normOrg = (org||'').trim();
        const mapping = ORGAN_CATEGORY_MAP[normOrg];
        if (mapping) {
          if (mapping.key === 'whole_body_skip') continue; // skip complexes in organ view
          if (usedKeys.has(mapping.key)) continue;
          usedKeys.add(mapping.key);
          if (!groups[mapping.key]) groups[mapping.key] = { key: mapping.key, label: mapping.label, emoji: mapping.emoji, items: [], count: 0 };
          groups[mapping.key].items.push(sub);
          groups[mapping.key].count++;
        } else {
          const formattedName = normOrg.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const key = `org_${normOrg.toLowerCase()}`;
          if (usedKeys.has(key)) continue;
          usedKeys.add(key);
          if (!groups[key]) groups[key] = { key, label: formattedName || normOrg || 'Прочее', emoji: '🫀', items: [], count: 0 };
          groups[key].items.push(sub);
          groups[key].count++;
        }
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [searchQuery]);

  // Phase 5.12: Auto-classify all substances into 4 tiers
  const classifyTier = (sub: SupportSubstance): 'core' | 'base' | 'boost' | 'max' => {
    const type = (sub.type || '').toLowerCase();
    const cats = (sub.categories || []).map(c => c.toLowerCase());
    const mechs = (sub.mechanisms || []).map(m => m.toLowerCase());
    const id = (sub.id || '').toLowerCase();
    const name = (sub.name || '').toLowerCase();
    const searchStr = type + ' ' + cats.join(' ') + ' ' + mechs.join(' ') + ' ' + id + ' ' + name;

    // MAX: peptides, injection-only, experimental
    if (cats.some(c => c === 'peptide' || c === 'peptides')) return 'max';
    if (type === 'peptide') return 'max';
    if (mechs.some(m => m.includes('peptide') || m.includes('injection'))) return 'max';
    if (['semax', 'selank', 'cerebrolysin', 'cortexin', 'epithalon', 'thymalin', 'bpc_157_inj', 'tb_500'].some(s => searchStr.includes(s))) return 'max';

    // CORE: essential vitamins/minerals that everyone needs always
    const corePatterns = ['vitamin_d3', 'vitamin_d', 'cholecalciferol', 'vitamin_k2', 'mk7', 'menaquinone',
      'vitamin_c', 'ascorbic', 'ascorbate', 'b_complex', 'methylcobalamin', 'cyanocobalamin', 'methylfolate',
      'magnesium', 'zinc', 'zinc_picolinate', 'zinc_bisglycinate', 'selenium', 'selenomethionine',
      'omega_3', 'omega3', 'epa', 'dha', 'fish_oil', 'coq10', 'coenzyme_q10', 'ubiquinone', 'ubiquinol',
      'iodine', 'potassium_citrate', 'vitamin_b1', 'thiamine', 'vitamin_b2', 'riboflavin',
      'vitamin_b6', 'pyridoxine', 'vitamin_b9', 'folate', 'folic_acid', 'vitamin_b12',
      'iron_bisglycinate', 'iron_fumarate', 'calcium_citrate', 'calcium_carbonate',
      'chromium_picolinate', 'manganese', 'copper_bisglycinate', 'molybdenum'];
    if (corePatterns.some(cp => searchStr.includes(cp))) return 'core';

    // Essential vitamins → CORE
    if (type === 'vitamin') {
      const baseVitamins = ['vitamin_e', 'tocopherol', 'vitamin_a', 'retinol', 'beta_carotene'];
      if (baseVitamins.some(bv => searchStr.includes(bv))) return 'base';
      return 'core';
    }
    // Essential minerals → CORE
    if (type === 'mineral') {
      const boostMinerals = ['boron', 'silicon', 'silica', 'vanadium', 'strontium', 'lithium'];
      if (boostMinerals.some(bm => searchStr.includes(bm))) return 'boost';
      return 'core';
    }
    // Electrolytes → BASE
    if (cats.some(c => c === 'electrolyte' || c === 'electrolytes')) return 'base';

    // BOOST: nootropics, advanced cognition, adaptogens, high-dosage liver support
    if (cats.some(c => c === 'nootropic' || c === 'nootropics')) return 'boost';
    if (mechs.some(m => m.includes('nootropic') || m.includes('cognitive'))) return 'boost';
    if (cats.some(c => c === 'adaptogen' || c === 'adaptogens')) return 'boost';
    if (mechs.some(m => m.includes('adaptogen'))) return 'boost';
    if (searchStr.includes('tudca') || searchStr.includes('udca')) return 'boost';

    // BASE: hepatoprotectors, antioxidants, probiotics, joint support, sports basics
    if (mechs.some(m => m.includes('hepatoprotective') || m.includes('liver_protect'))) return 'base';
    if (cats.some(c => c === 'hepatoprotective' || c === 'hepatoprotector' || c === 'detox')) return 'base';
    if (cats.some(c => c === 'antioxidant' || c === 'antioxidants') && type !== 'vitamin' && type !== 'mineral') return 'base';

    const basePatterns = ['nac', 'n_acetyl_cysteine', 'alpha_lipoic_acid', 'r_ala', 'r_lipoic',
      'curcumin', 'turmeric', 'probiotic', 'lactobacillus', 'bifidobacterium', 'saccharomyces',
      'collagen', 'gelatin', 'glucosamine', 'chondroitin', 'msm', 'methylsulfonylmethane',
      'vitamin_e', 'tocopherol', 'creatine', 'beta_alanine', 'l_carnitine', 'acetyl_l_carnitine',
      'hmb', 'beta_hydroxy', 'betaine', 'glutamine', 'milk_thistle', 'silymarin',
      'berberine', 'quercetin', 'resveratrol', 'pterostilbene', 'astaxanthin',
      'pycnogenol', 'grape_seed', 'green_tea', 'egcg', 'sulforaphane', 'dihydroquercetin',
      'digestive_enzymes', 'pancreatin', 'bromelain', 'papain',
      'tyrosine', 'n_acetyl_tyrosine', 'theanine', 'l_theanine',
      'taurine', 'glycine', 'citrulline', 'arginine', 'ornithine'];
    if (basePatterns.some(bp => searchStr.includes(bp))) return 'base';

    // BOOST default for remaining specialized substances
    if (mechs.some(m => m.includes('hormone') || m.includes('testosterone') || m.includes('estrogen'))) return 'boost';
    if (cats.some(c => c === 'hormone' || c === 'hormones' || c === 'peptide_hormone')) return 'max';

    // Default: assign by type
    if (type === 'amino_acid' || type === 'amino_acids') return 'base';
    if (type === 'enzyme' || type === 'enzymes') return 'base';
    if (type === 'fatty_acid' || type === 'fatty_acids') return 'base';
    return 'boost';
  };

  const SUPPORT_TIER_GROUPS = useMemo(() => {
    const tiers: Record<string, { key: string; label: string; emoji: string; color: string; substances: string[] }> = {
      core: { key: 'core', label: 'Ядро (CORE)', emoji: '🟢', color: '#22c55e', substances: [] },
      base: { key: 'base', label: 'База (BASE)', emoji: '🟡', color: '#f59e0b', substances: [] },
      boost: { key: 'boost', label: 'Усиление (BOOST)', emoji: '🟠', color: '#f97316', substances: [] },
      max: { key: 'max', label: 'Максимум (MAX)', emoji: '🔴', color: '#ef4444', substances: [] },
    };
    for (const sub of catalogSubstances) {
      const tier = classifyTier(sub);
      tiers[tier].substances.push(sub.id);
    }
    return [tiers.core, tiers.base, tiers.boost, tiers.max];
  }, []);

  // Pre-build conflict lookup map for O(1) pair checking in stacks (avoid iterating ALL_INTERACTIONS in render)
  const conflictLookup = useMemo(() => {
    const map = new Map<string, { effect: string; severity: string; type: string; mechanisms: string[] }>();
    for (const i of ALL_INTERACTIONS) {
      if (!i || !i.substanceA || !i.substanceB) continue;
      const val = { effect: i.effect||'', severity: i.severity||'', type: i.type||'', mechanisms: i.mechanisms||[] };
      map.set(`${i.substanceA}||${i.substanceB}`, val);
      map.set(`${i.substanceB}||${i.substanceA}`, val);
    }
    return map;
  }, []);

  // Pre-compute mechanisms & synergies for every stack
  const stackDetailMap = useMemo(() => {
    const map = new Map<string, { mechs: string[]; synergies: Array<{a:string;b:string;aName:string;bName:string;effect:string;mechs:string[];notes:string}> }>();
    for (const stack of ALL_STACKS) {
      const allMechs = new Set<string>();
      const synergies: any[] = [];
      for (let a = 0; a < stack.substances.length; a++) {
        const sa = stack.substances[a].id;
        const subA = catalogSubstances.find(s => s.id === sa);
        (subA?.mechanisms || []).forEach(m => allMechs.add(m));
        for (let b = a + 1; b < stack.substances.length; b++) {
          const sb = stack.substances[b].id;
          const key = `${sa}||${sb}`;
          const intx = conflictLookup.get(key);
          if (intx && intx.type === 'synergy') {
            const aName = getStackSubLabel(sa);
            const bName = getStackSubLabel(sb);
            // Get detailed interaction from ALL_INTERACTIONS for mechanisms/notes
            const full = ALL_INTERACTIONS.find(i => 
              (i.substanceA === sa && i.substanceB === sb) || (i.substanceA === sb && i.substanceB === sa)
            );
            synergies.push({ a:sa, b:sb, aName, bName, effect:intx.effect, mechs:full?.mechanisms||[], notes:full?.notes||'' });
          }
        }
      }
      map.set(stack.id, { mechs: [...allMechs].slice(0, 30), synergies: synergies.slice(0, 10) });
    }
    return map;
  }, [conflictLookup]);

  // Merge ALL_INTERACTIONS + SYNERGY_PAIRS for synergies tab (with null filter + dedup + catalog filter)
  // Pre-compute the set of ALL substance IDs from interactions + catalog + catalogSubstances
  const allSubstanceIds = useMemo(() => {
    const s = new Set<string>();
    CATALOG_IDS.forEach(id => s.add(id));
    (catalogSubstances || []).forEach((sub: any) => s.add((sub.id||'').toLowerCase()));
    ALL_INTERACTIONS.forEach((i: any) => {
      ['A','B','C','D','E','F'].forEach(f => {
        const sid = i[`substance${f}`];
        if (sid) s.add(sid.toLowerCase());
      });
    });
    return s;
  }, []);

  const catalogOk = useCallback((id: string) => {
    const lower = id.toLowerCase();
    if (allSubstanceIds.has(lower)) return true;
    if (PHARMA_DB && PHARMA_DB[lower]) return true;
    return false;
  }, [allSubstanceIds]);

  const mergedInteractions = useMemo(() => {
    try {
    const seen = new Set<string>();
    const pairKey = (a: string, b: string, t?: string) => [a.toLowerCase(), b.toLowerCase()].sort().join('||') + (t ? `:${t}` : '');
    const fromDB = ALL_INTERACTIONS
      .filter(i => i && i.interactionId && i.substanceA && i.substanceB && i.substanceA !== i.substanceB && catalogOk(i.substanceA) && catalogOk(i.substanceB))
      .filter(i => {
        const pk = pairKey(i.substanceA, i.substanceB, i.type);
        if (seen.has(pk)) return false;
        seen.add(pk);
        return true;
      })
      .map(i => ({ ...i, source: 'db' as const }));
    seen.clear();
    for (const item of fromDB) {
      seen.add(item.interactionId);
      seen.add(`${item.substanceA}|${item.substanceB}`);
    }
    const fromEngine = SYNERGY_PAIRS
      .filter(p => catalogOk(p.substanceA) && catalogOk(p.substanceB))
      .map((p, idx) => ({
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
    const dedupedEngine = fromEngine.filter(e => !seen.has(`${e.substanceA}|${e.substanceB}`) && !seen.has(e.interactionId));
    // Pharma synergy pairs (AAS + peptides + insulin)
    const PHARMA_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin']);
    const pharmaFromEngine = SYNERGY_PAIRS
      .filter(p => {
        const a = PHARMA_DB[p.substanceA];
        const b = PHARMA_DB[p.substanceB];
        return a && b && PHARMA_CLASSES.has(a.class) && PHARMA_CLASSES.has(b.class) && !catalogOk(p.substanceA) && !catalogOk(p.substanceB);
      })
      .filter(p => !seen.has(`${p.substanceA}|${p.substanceB}`))
      .map((p, idx) => ({
      interactionId: `pharma_synergy_${idx}`,
      substanceA: p.substanceA,
      substanceB: p.substanceB,
      type: 'synergy' as const,
      effect: p.mechanism || `Синергия: ${p.synergyType}`,
      mechanisms: p.affectedSystems || [],
      severity: (p.strength > 0.7 ? 'HIGH' : p.strength > 0.4 ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
      notes: p.clinicalNote || '',
      source: 'pharma' as const,
    }));
    return [...fromDB, ...dedupedEngine, ...pharmaFromEngine];
    } catch { return []; }
  }, [CATALOG_IDS]);

  // Interaction calculator memo (uses mergedInteractions)
  const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    const allSubs = [...allSupport, ...catalogSubstances.filter(x => !allSupport.find(s => s.id === x.id))];
    validInteractionIds.forEach(id => {
      const s = allSubs.find(x => x.id === id);
      if (s) subs[id] = s.name || s.id;
    });
    try {
      const norm = (s: string) => s.replace(/_/g,'').toLowerCase();
      const matchId = (interactKey: string, subId: string, subName: string): boolean => {
        const a = norm(interactKey);
        const b = norm(subId);
        const c = norm(subName);
        return a === b || a.includes(b) || b.includes(a) || a === c || a.includes(c) || c.includes(a);
      };
      return mergedInteractions.filter((i: any) => {
        if (!i || !i.substanceA || !i.substanceB) return false;
        const matched: string[] = [];
        validInteractionIds.forEach(id => {
          const s = allSubs.find(x => x.id === id);
          if (matchId(i.substanceA, id, s?.name || '')) matched.push('a');
          if (matchId(i.substanceB, id, s?.name || '')) matched.push('b');
        });
        return matched.includes('a') && matched.includes('b');
      });
    } catch { return []; }
  }, [interactionIds, allSupport, mergedInteractions]);

  const hasSupportInteractions = supportInteractions && supportInteractions.length > 0;
  const supportSynergiesList = supportInteractions?.filter(i => i.type === 'synergy') ?? [];
  const supportConflicts = supportInteractions?.filter(i => i.type === 'conflict') ?? [];
  const supportCautions = supportInteractions?.filter(i => i.type === 'caution') ?? [];

  // Replacement calculator state
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceSelectedSub, setReplaceSelectedSub] = useState<string | null>(null);
  const [replaceResults, setReplaceResults] = useState<Array<{id:string;score:number;reason:string;pros:string[];cons:string[];mechComparison?:string[];organs?:string[];tier?:string}>>([]);
  const [replaceMode, setReplaceMode] = useState<'substance' | 'organ' | 'mechanism'>('substance');
  const [replaceTargetOrgan, setReplaceTargetOrgan] = useState('');
  const [replaceTargetMech, setReplaceTargetMech] = useState('');

  // Search calculator state
  const [searchOrgan, setSearchOrgan] = useState('');
  const [searchMech, setSearchMech] = useState('');
  const [searchEffect, setSearchEffect] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchTier, setSearchTier] = useState('');
  const [searchExpanded, setSearchExpanded] = useState<Record<string,boolean>>({});
  const [searchResults, setSearchResults] = useState<Array<{id:string;name:string;type:'substance'|'stack'|'complex';score:number;reason:string;pros:string[];cons:string[];substanceCount?:number;description?:string;mechanisms?:string[];organs?:string[]}>>([]);

  // Helper: find substance by ID
  const findSubstance = (id: string): any => catalogSubstances.find(s => s.id === id);

  // Helper: get substance name
  const getSubstanceName = (id: string): string => {
    const sub = findSubstance(id);
    return sub?.name || PHARMA_DB[id]?.name || id.replace(/_/g, ' ');
  };

  // Replacement logic: find substances with similar mechanisms/organs/categories
  // Mode: 'substance' — find analogs of a selected substance; 'organ' — find by target organ; 'mechanism' — find by mechanism
  const findReplacements = (id: string, mode?: string, target?: string) => {
    const source = findSubstance(id);
    const results: Array<{id:string;score:number;reason:string;pros:string[];cons:string[];mechComparison?:string[];organs?:string[];tier?:string}> = [];
    const subs = catalogSubstances.filter(s => s.id !== id);

    if (mode === 'organ' && target) {
      // Find by organ target
      const tNorm = target.toLowerCase().trim();
      for (const sub of subs) {
        const subOrgs = (sub.organs||[]).map((o:string) => o.toLowerCase().trim());
        const matches = subOrgs.some(o => o.includes(tNorm) || tNorm.includes(o));
        if (!matches) continue;
        const score = Math.min(100, 60 + Math.round(Math.random() * 30));
        const pros: string[] = [];
        const cons: string[] = [];
        if (sub.mechanisms && sub.mechanisms.length > 0) pros.push(`${sub.mechanisms.length} механизмов`);
        if (!sub.mechanisms || sub.mechanisms.length === 0) cons.push('нет механизмов');
        results.push({ id: sub.id, score, reason: `действует на ${target}`, pros, cons, organs: sub.organs || [], tier: getSubstanceTier(sub.id) });
      }
      return results.sort((a,b) => b.score - a.score);
    }

    if (mode === 'mechanism' && target) {
      // Find by mechanism target
      const tNorm = target.toLowerCase().trim();
      for (const sub of subs) {
        const subMechs = (sub.mechanisms||[]).map((m:string) => m.toLowerCase().trim());
        const matches = subMechs.some(m => m.includes(tNorm) || tNorm.includes(m));
        if (!matches) continue;
        const score = Math.min(100, 60 + Math.round(Math.random() * 30));
        const pros: string[] = [];
        const cons: string[] = [];
        if (sub.organs && sub.organs.length > 0) pros.push(`действует на ${sub.organs.length} органов`);
        if (!sub.organs || sub.organs.length === 0) cons.push('нет данных по органам');
        results.push({ id: sub.id, score, reason: `механизм: ${target}`, pros, cons, organs: sub.organs || [], tier: getSubstanceTier(sub.id) });
      }
      return results.sort((a,b) => b.score - a.score);
    }

    // Default: find by substance similarity (original logic enhanced)
    if (!source) return [];
    const sourceMechs = new Set((source.mechanisms||[]).map((m:string) => m.toLowerCase()));
    const sourceOrgs = new Set((source.organs||[]).map((o:string) => o.toLowerCase()));
    const sourceCats = new Set((source.categories||[]).map((c:string) => c.toLowerCase()));
    const hasAnyData = sourceMechs.size > 0 || sourceOrgs.size > 0 || sourceCats.size > 0;
    for (const sub of subs) {
      const targetMechs = new Set((sub.mechanisms || []).map((m:string) => m.toLowerCase()));
      const targetOrgs = new Set((sub.organs||[]).map((o:string) => o.toLowerCase()));
      const targetCats = new Set((sub.categories||[]).map((c:string) => c.toLowerCase()));
      if (!hasAnyData) {
        const srcName = (source.name||'').toLowerCase();
        const tgtName = (sub.name||'').toLowerCase();
        if (!tgtName.includes(srcName) && !srcName.includes(tgtName)) continue;
        const score = srcName.length > 0 ? Math.round((tgtName.split(' ').filter(w => srcName.includes(w)).length / Math.max(1, srcName.split(' ').length)) * 50) : 0;
        results.push({ id: sub.id, score, reason: 'совпадение названия', pros: [], cons: [], organs: sub.organs || [], tier: getSubstanceTier(sub.id) });
        continue;
      }
      let mechOverlap = 0, orgOverlap = 0, catOverlap = 0;
      const sourceMechArr = [...sourceMechs] as string[];
      const targetMechArr = [...targetMechs] as string[];
      for (const m of targetMechArr) if (sourceMechArr.includes(m)) mechOverlap++;
      for (const o of [...targetOrgs]) if ([...sourceOrgs].includes(o)) orgOverlap++;
      for (const c of [...targetCats]) if ([...sourceCats].includes(c)) catOverlap++;
      const totalScore = (sourceMechArr.length > 0 ? (mechOverlap / Math.max(1, sourceMechArr.length)) * 50 : 0) +
        (sourceOrgs.size > 0 ? (orgOverlap / Math.max(1, sourceOrgs.size)) * 30 : 0) +
        (sourceCats.size > 0 ? (catOverlap / Math.max(1, sourceCats.size)) * 20 : 0);
      if (totalScore > 15) {
        const reasonParts: string[] = [];
        const pros: string[] = [];
        const cons: string[] = [];
        const mechComparison: string[] = [];
        if (mechOverlap > 0) { reasonParts.push(`совпадает ${mechOverlap} механизм(ов)`); }
        if (orgOverlap > 0) reasonParts.push(`действует на те же органы (${orgOverlap})`);
        if (catOverlap > 0) pros.push(`из категории ${sub.categories?.[0] || '—'}`);
        if ((sub.mechanisms||[]).length > (source.mechanisms||[]).length) pros.push('больше механизмов');
        if ((sub.mechanisms||[]).length < (source.mechanisms||[]).length) cons.push('меньше механизмов');
        if (!sub.organs || sub.organs.length === 0) cons.push('нет данных по органам');
        // Build mechanism comparison
        for (const sm of sourceMechArr) {
          if (targetMechArr.includes(sm)) mechComparison.push(`✓ ${sm}`);
          else mechComparison.push(`✗ ${sm}`);
        }
        results.push({ id: sub.id, score: Math.round(totalScore), reason: reasonParts.join('; ') || 'частичное совпадение', pros, cons, mechComparison: mechComparison.length > 0 ? mechComparison : undefined, organs: sub.organs || [], tier: getSubstanceTier(sub.id) });
      }
    }
    return results.sort((a,b) => b.score - a.score);
  };

  // Search logic: find substances/stacks/complexes by organ+mechanism+effect+category+tier
  const doSearch = (organ: string, mech: string, effect: string, category?: string, tier?: string) => {
    const results: Array<{id:string;name:string;type:'substance'|'stack'|'complex';score:number;reason:string;pros:string[];cons:string[];substanceCount?:number;description?:string;mechanisms?:string[];organs?:string[]}> = [];
    const eq = effect.toLowerCase().trim();
    // Search catalogSubstances
    for (const sub of catalogSubstances) {
      // Category filter
      if (category && !(sub.categories||[]).some((c:string) => c.toLowerCase() === category.toLowerCase())) continue;
      // Tier filter
      if (tier) {
        const subTier = getSubstanceTier(sub.id);
        if (subTier !== tier) continue;
      }
      let score = 0;
      const reasons: string[] = [];
      // Check organ match
      if (organ) {
        const subOrgs = (sub.organs||[]).map((o:string) => { const m = ORGAN_CATEGORY_MAP[o.toUpperCase().trim()]; return m?.key || o.toLowerCase(); });
        if (subOrgs.includes(organ)) { score += 35; reasons.push('совпадает орган'); }
      }
      // Check mechanism match
      if (mech) {
        if ((sub.mechanisms||[]).includes(mech)) { score += 35; reasons.push('совпадает механизм'); }
      }
      // Check effect/description match
      if (eq) {
        const searchText = ((sub.name||'') + ' ' + (sub.description||'') + ' ' + (sub.categories||[]).join(' ')).toLowerCase();
        if (searchText.includes(eq)) { score += 20; reasons.push('совпадает описание/категория'); }
      }
      if (score > 0 || (!organ && !mech && !eq && category)) {
        const pros: string[] = [];
        const cons: string[] = [];
        if (sub.mechanisms && sub.mechanisms.length > 0) pros.push(`${sub.mechanisms.length} механизмов`);
        if (sub.organs && sub.organs.length > 0) pros.push(`действует на ${sub.organs.length} органов`);
        if (!sub.organs || sub.organs.length === 0) cons.push('нет данных по органам');
        if (!score) score = 50;
        results.push({ id: sub.id, name: sub.name || sub.id, type: 'substance', score: Math.min(100, score), reason: reasons.join('; ') || 'соответствует критериям', pros, cons, description: sub.description, mechanisms: sub.mechanisms, organs: sub.organs });
      }
    }
    // Search ALL_STACKS
    for (const stack of ALL_STACKS) {
      // Tier filter not applicable to stacks
      let score = 0;
      const reasons: string[] = [];
      if (eq) {
        const searchText = ((stack.name||'') + ' ' + (stack.description||'') + ' ' + (stack.effects||[]).join(' ')).toLowerCase();
        if (searchText.includes(eq)) { score += 20; reasons.push('совпадает с запросом'); }
      }
      if (score > 0 || (!organ && !mech && eq)) {
        const subNames = (stack.substances||[]).map(sub => getSubstanceName(sub.id)).join(', ');
        if (!organ && !mech && !eq) continue;
        if (!score) score = 30;
        results.push({ id: stack.id, name: getStackDisplayName(stack), type: 'stack', score: Math.min(100, score), reason: reasons.concat([`${stack.substances.length} веществ`]).join('; ') || `стек из ${stack.substances.length} веществ`, pros: [`синергия ${stack.synergyScore}%`, ...(stack.effects||[]).slice(0,3)], cons: [], substanceCount: stack.substances.length });
      }
    }
    return results.sort((a,b) => b.score - a.score);
  };

  // Resolve substance name from ID (used in interactions) — Map for O(1)
  const substanceNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of catalogSubstances) m.set(s.id, s.name);
    return m;
  }, []);
  const resolveSubName = (id: string): string => {
    const fromMap = substanceNameMap.get(id);
    if (fromMap) return fromMap;
    const pharma = PHARMA_DB[id];
    if (pharma) return pharma.name;
    return id;
  };

  // Resolve interaction effect to readable text
  const showEffect = (interaction: any): string => {
    const eff = interaction?.effect;
    if (!eff) return '';
    if (/^[A-Z0-9_]+$/.test(eff)) {
      if (EFFECT_LABELS[eff]) return EFFECT_LABELS[eff];
      return eff.replace(/_/g, ' ');
    }
    return eff || '';
  };

  const getStackDisplayName = (stack: any): string => {
    if (stack.name) return stack.name;
    const effs = (stack.effects||[]).map((e: string) => (EFFECT_LABELS_ru[e]||e).replace(/^[^\s]+\s/,'')).filter(Boolean);
    const prefix = effs.length > 0 ? effs.slice(0,2).join(' + ') : 'Стек';
    const cnt = (stack.substances||[]).length;
    return `${prefix} (${cnt} веществ)`;
  };

  const safeRender = (label: string, fn: () => React.ReactNode): React.ReactNode => {
    try { return fn(); }
    catch (e) { return <div style={{ padding:12, margin:4, borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', textAlign:'center', color:'#f87171', fontSize:9 }}>⚠ {label}: {String(e)}</div>; }
  };

  const renderView = (current: string, target: string, contentFn: () => React.ReactNode): React.ReactNode => {
    if (current !== target) return null;
    return safeRender(target, contentFn);
  };

  const matchesCatId = (interactionId: string, catId: string): boolean => {
    const a = interactionId.toLowerCase();
    const b = catId.toLowerCase();
    if (a === b) return true;
    if (a.startsWith(b) || b.startsWith(a)) return true;
    return false;
  };

  const catDetailInteractions = (sub: SupportSubstance, interactions: any[]): React.ReactNode => {
    try {
      const subId = sub.id;
      const subsInteractions = (interactions||[]).filter(i =>
        i && i.substanceA && i.substanceB && (matchesCatId(i.substanceA, subId) || matchesCatId(i.substanceB, subId))
      ).slice(0, 10);
      return (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Взаимодействия:</div>
          {subsInteractions.length > 0 ? subsInteractions.map(i => {
            if (!i) return null;
            const isA = matchesCatId(i.substanceA, subId);
            const partner = isA ? i.substanceB : i.substanceA;
            const pName = resolveSubName(partner);
            const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
            return (
              <div key={i.interactionId} style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 0', lineHeight:1.3 }}>
                <span style={{ color:tColor, fontWeight:600 }}>{i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}</span>
                {' '}{pName||''} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                {i.notes && <span style={{ opacity:0.6 }}>: {i.notes}</span>}
              </div>
            );
          }) : <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', fontStyle:'italic', padding:'1px 0', lineHeight:1.2 }}>Нет зарегистрированных взаимодействий. Проверьте совместимость индивидуально.</div>}
        </div>
      );
    } catch (e) { return null; }
  }
// Helper to render SUPPORT_CATALOG_DATA for a substance
const renderCatalogDetail = (subId: string): React.ReactNode => {
  const canonicalId = CANONICAL_ID_MAP[subId] || CANONICAL_ID_MAP[subId.toLowerCase()] || subId.toLowerCase();
  const entry = SUPPORT_CATALOG_DATA[canonicalId] || SUPPORT_CATALOG_DATA[subId];
  if (!entry) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {entry.tier && (
        <div style={{ marginBottom: 3 }}>
          <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, fontWeight: 700, color: TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)', background: (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '18', border: '1px solid ' + (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '40' }}>
            {TIER_LABELS_CATALOG[entry.tier]?.emoji || ''} {TIER_LABELS_CATALOG[entry.tier]?.label || entry.tier}
          </span>
          {entry.bestForCourse && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, marginLeft: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>✓ На курсе</span>}
        </div>
      )}
      {entry.dosage && (
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', marginBottom: 3 }}>
          💊 Дозировка: <span style={{ fontWeight: 600 }}>{entry.dosage.mg}{entry.dosage.mg >= 1000 ? ' г' : entry.dosage.mg < 1 ? ' мкг' : ' мг'}</span> · {entry.dosage.timing}{entry.dosage.form ? ' · ' + entry.dosage.form : ''}
        </div>
      )}
      {entry.monitoring && entry.monitoring.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>📊 Мониторинг:</div>
          {entry.monitoring.map((m, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
              {m.what}{m.when ? ' · ' + m.when : ''}{m.targetRange ? ' · ' + m.targetRange : ''}
            </div>
          ))}
        </div>
      )}
      {entry.contraindications && entry.contraindications.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>🚫 Противопоказания:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.contraindications.join(', ')}</div>
        </div>
      )}
      {entry.sideEffects && entry.sideEffects.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>⚠ Побочные:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.sideEffects.join(', ')}</div>
        </div>
      )}
      {entry.organs && entry.organs.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 1 }}>🎯 Органы-мишени:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.organs.map((o, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{CATALOG_ORGAN_LABELS[o] || o}</span>
            ))}
          </div>
        </div>
      )}
      {entry.systems && entry.systems.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#a78bfa', fontWeight: 600, marginBottom: 1 }}>⚡ Системы:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.systems.map((s, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>{SYSTEM_LABELS_CATALOG[s] || s}</span>
            ))}
          </div>
        </div>
      )}

      {entry.targetOrgan && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>🎯 Орган-мишень:</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{entry.targetOrgan}</div>
        </div>
      )}

      {entry.organMechanism && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 1 }}>🔬 Физиология органа:</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{entry.organMechanism}</div>
        </div>
      )}

      {entry.mechanismOfAction && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#a78bfa', fontWeight: 600, marginBottom: 1 }}>🧬 Механизм действия (молекулярный):</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{entry.mechanismOfAction}</div>
        </div>
      )}

      {entry.clinicalEffect && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 600, marginBottom: 1 }}>✅ Клинический эффект:</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{entry.clinicalEffect}</div>
        </div>
      )}

      {/* ── ТЗ механизмы (DRUG_DB + SUPPORT_DB) ── */}
      {(() => {
        const subIdLc = subId.toLowerCase();
        const drugMechs = getDrugTzMechanisms(subIdLc);
        const suppMechs = getSupportTzDisplay(subIdLc);
        if (!drugMechs?.length && !suppMechs?.length) return null;
        const byOrgan: Record<string, { lines: { label: string; source: string; kq: string }[] }> = {};
        for (const m of drugMechs || []) {
          if (!byOrgan[m.organId]) byOrgan[m.organId] = { lines: [] };
          const l = TZ_MECH_LABELS[m.mechId] || m.mechId;
          if (!byOrgan[m.organId].lines.some(x => x.label === l)) byOrgan[m.organId].lines.push({ label: l, source: `w=${m.weight}`, kq: '' });
        }
        for (const s of suppMechs || []) {
          if (!byOrgan[s.organId]) byOrgan[s.organId] = { lines: [] };
          if (!byOrgan[s.organId].lines.some(x => x.label === s.mechLabel)) byOrgan[s.organId].lines.push({ label: s.mechLabel, source: s.source, kq: `k=${s.k} q=${s.q}` });
        }
        return (
          <div style={{ marginTop: 3, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 700, marginBottom: 3 }}>🧬 Механизм-ориентированная модель (ТЗ)</div>
            {Object.entries(byOrgan).map(([orgId, info]) => (
              <details key={orgId} style={{ marginBottom: 2 }}>
                <summary style={{ cursor:'pointer', fontSize:7, color:'rgba(255,255,255,0.8)', fontWeight:600, listStyle:'none', display:'flex', alignItems:'center', gap:4 }}>
                  {TZ_SYSTEM_ICONS[orgId] || '•'} {TZ_SYSTEM_LABELS[orgId] || orgId} <span style={{ color:'#00e68a', fontSize:6 }}>({info.lines.length})</span>
                  <span style={{ marginLeft:'auto', fontSize:6, color:'rgba(255,255,255,0.3)' }}>▼</span>
                </summary>
                <div style={{ padding:'2px 0 0 10px' }}>
                  {info.lines.map((line, i) => (
                    <div key={i} style={{ fontSize:6, color:'rgba(255,255,255,0.7)', marginBottom:2, lineHeight:1.4 }}>
                      <b>{line.label}</b>
                      {line.kq && <span style={{ color:'#00e68a', marginLeft:2 }}>[{line.kq}]</span>}
                      <br/><span style={{ color:'rgba(255,255,255,0.5)' }}>{line.source}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        );
      })()}

      {entry.bestForm && (
        <div style={{ marginTop: 3, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 600, marginBottom: 1 }}>🏆 Лучшая форма:</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{entry.bestForm}</div>
        </div>
      )}
      {entry.analog && entry.analog.length > 0 && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#818cf8', fontWeight: 600, marginBottom: 2 }}>🔗 Аналоги/синергисты:</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {entry.analog.map((a, i) => {
              const analogEntry = SUPPORT_CATALOG_DATA[a];
              const analogName = analogEntry?.nameRu || analogEntry?.name || a;
              return (
                <span key={i} style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                  {analogName}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {entry.specialInstructions && entry.specialInstructions.length > 0 && (
        <div style={{ marginTop: 3, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>📋 Особые указания:</div>
          {entry.specialInstructions.map((si, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, paddingLeft: 8, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#f59e0b' }}>•</span>
              {si}
            </div>
          ))}
        </div>
      )}

      {entry.synergies && entry.synergies.length > 0 && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600, marginBottom: 2 }}>🟢 Синергии:</div>
          {entry.synergies.map((s, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, display: 'flex', gap: 3, marginBottom: 1 }}>
              <span style={{ color: '#22c55e', flexShrink: 0, fontWeight: 700, fontSize: 10 }}>+</span>
              <span style={{ fontWeight: 600 }}>{s.with}</span>
              <span>— {s.effect}</span>
              {s.severity && (
                <span style={{ marginLeft: 'auto', fontSize: 7, padding: '0 4px', borderRadius: 2, background: s.severity === 'HIGH' ? 'rgba(34,197,94,0.15)' : s.severity === 'MEDIUM' ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.08)', color: s.severity === 'HIGH' ? '#22c55e' : s.severity === 'MEDIUM' ? '#eab308' : 'rgba(255,255,255,0.5)' }}>
                  {s.severity === 'HIGH' ? '◉' : s.severity === 'MEDIUM' ? '◐' : '○'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {entry.conflicts && entry.conflicts.length > 0 && (
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>🔴 Конфликты:</div>
          {entry.conflicts.map((c, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, display: 'flex', gap: 3, marginBottom: 1 }}>
              <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700, fontSize: 10 }}>×</span>
              <span style={{ fontWeight: 600 }}>{c.with}</span>
              <span>— {c.effect}</span>
              {c.severity && (
                <span style={{ marginLeft: 'auto', fontSize: 7, padding: '0 4px', borderRadius: 2, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.15)' : c.severity === 'MEDIUM' ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.08)', color: c.severity === 'HIGH' ? '#ef4444' : c.severity === 'MEDIUM' ? '#eab308' : 'rgba(255,255,255,0.5)' }}>
                  {c.severity === 'HIGH' ? '◉' : c.severity === 'MEDIUM' ? '◐' : '○'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Enrichment data */}
      {(() => {
        const enrich = CATALOG_ENRICHMENT[canonicalId] || CATALOG_ENRICHMENT[subId];
        if (!enrich) return null;
        return (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>📋 Дополнительная информация</div>
            {enrich.maxUsageWeeks && (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>
                📆 Макс. длительность: <span style={{ fontWeight: 600 }}>{enrich.maxUsageWeeks} нед{enrich.maxUsageWeeks >= 52 ? ` (~${Math.round(enrich.maxUsageWeeks/52)} г)` : enrich.maxUsageWeeks >= 12 ? ` (~${Math.round(enrich.maxUsageWeeks/4)} мес)` : ''}</span>
              </div>
            )}
            {enrich.labMarkers && enrich.labMarkers.length > 0 && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>🩸 Маркеры контроля: </span>
                <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{enrich.labMarkers.join(' · ')}</span>
              </div>
            )}
            {enrich.restrictions && enrich.restrictions.length > 0 && (
              <div>
                <span style={{ fontSize: 8, color: 'rgba(239,68,68,0.8)' }}>⚠ Ограничения: </span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>{enrich.restrictions.join(' · ')}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== BOTTOM TAB BAR ===== */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, display:'flex', background:'var(--bg-primary)', borderTop:'1px solid var(--border)', padding:'6px 0 calc(env(safe-area-inset-bottom, 0px) + 6px)' }}>
        {[
          { id:'home', label:'Главная', icon:'🏠' },
          { id:'generator', label:'Генератор', icon:'🧩' },
          { id:'info', label:'Инфо', icon:'📚' },
          { id:'hormonal', label:'Гормоны', icon:'⚕️' },
          { id:'protocols', label:'Протоколы', icon:'📋' },
        ].map(item => (
          <button key={item.id} onClick={() => {
            setSection(item.id as any);
            setCalcView('main');
            if (item.id === 'home') { setTab('main'); setSupportView('main'); }
            if (item.id === 'generator') { setTab('calculator'); setSupportView('calc'); }
            if (item.id === 'info') { setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }
            if (item.id === 'hormonal') { setTab('fertility-pct'); setSupportView('calc'); }
            if (item.id === 'protocols') { setProtocolTab('pct'); }
          }} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            padding:'4px 0', background:'transparent', border:'none', cursor:'pointer',
            color: section === item.id ? 'var(--accent)' : 'var(--text-dim)',
            fontSize:9, fontWeight: section === item.id ? 700 : 400,
            transition:'color 0.15s',
          }}>
            <span style={{ fontSize:18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};
;

  const synergiesContent = (filtered: any[], merged: any[], cats: Record<string, boolean>, tab?: string): React.ReactNode => {
    return safeRender('synergies_content', () => {
      const list = filtered || [];
      const currentTab = tab || 'all';
      const synergies = currentTab === 'synergies' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'synergy') : [];
      const conflicts = currentTab === 'conflicts' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'conflict') : [];
      const cautions = currentTab === 'cautions' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'caution') : [];
      const synTotal = synergies.length;
      const confTotal = conflicts.length;
      const cautTotal = cautions.length;
      const maxItems = synergyPage * SYNERGY_PAGE_SIZE;
      const synPage = synergies.slice(0, maxItems);
      const confPage = conflicts.slice(0, maxItems);
      const cautPage = cautions.slice(0, maxItems);
      const safeItem = (fn:()=>React.ReactNode, key:string|number):React.ReactNode => {
          {/* Organ-based synergies */}
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🧬 Синергии по системам</h4>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Научно обоснованные комбинации добавок, организованные по системам организма
            </p>
            {ORGAN_SYNERGIES.map(og => (
              <div key={og.id} style={{ marginBottom: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setExpandedCategories(prev => ({ ...prev, ['organ_'+og.id]: !(prev['organ_'+og.id] ?? false) }))}>
                  <span style={{ fontSize: 13 }}>{og.organLabel.split(' ')[0]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1 }}>{og.organLabel.substring(og.organLabel.indexOf(' ')+1)}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 8 }}>{og.pairs.length}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', transform: expandedCategories['organ_'+og.id] !== false ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>
                {expandedCategories['organ_'+og.id] !== false && og.pairs.map((p, pi) => (
                  <div key={pi} style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', background: pi % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>{p.nameA}</span>
                        <span style={{ fontSize: 10, color: p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                          {p.type === 'synergy' ? '+' : p.type === 'conflict' ? '×' : '⚠'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>{p.nameB}</span>
                      </div>
                      <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                        background: p.severity === 'HIGH' ? (p.type === 'conflict' ? '#ef444422' : '#22c55e22') : p.severity === 'MEDIUM' ? '#f59e0b22' : '#60a5fa22',
                        color: p.severity === 'HIGH' ? (p.type === 'conflict' ? '#ef4444' : '#22c55e') : p.severity === 'MEDIUM' ? '#f59e0b' : '#60a5fa' }}>
                        {p.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: 2 }}>
                      {p.type === 'synergy' ? '⊕' : p.type === 'conflict' ? '⊖' : '⚠'} {p.effect}
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, fontStyle: 'italic' }}>{p.mechanism}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

        try{return fn();}catch(e){return <div key={key} style={{padding:4,color:'#f87171',fontSize:7}}>⚠ Item {key}: {String(e)}</div>;}
      };
      return (<>
        <div style={{ marginBottom:10 }}>
          <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_synergies: !(prev?.syn_synergies ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
            <span style={{ fontSize:13 }}>⊕</span>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#22c55e' }}>Синергии ({synTotal})</div>
            <span style={{ fontSize:9, color:'var(--text-dim)', transform:cats?.syn_synergies !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
          </div>
          {cats?.syn_synergies !== false && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {synPage.map((interaction: any, i: number) => safeItem(() => {
                const sevInfo = INTERACTION_SEVERITY_LABELS[interaction?.severity] || { label:interaction?.severity, color:'#888' };
                const aName = resolveSubName(interaction?.substanceA);
                const bName = resolveSubName(interaction?.substanceB);
                return (
                  <div key={interaction?.interactionId||i} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:'3px solid #22c55e' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceA) ? prev : [...prev, interaction?.substanceA]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                        <span style={{ fontSize:10, color:'#22c55e', fontWeight:700 }}>+</span>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceB) ? prev : [...prev, interaction?.substanceB]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                      </div>
                      <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color, flexShrink:0 }}>{sevInfo.label}</span>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊕ {showEffect(interaction)}</div>
                    {(() => {
                      const subAInfo = catalogSubstances.find(s => s.id === interaction?.substanceA);
                      const subBInfo = catalogSubstances.find(s => s.id === interaction?.substanceB);
                      const aDesc = subAInfo?.description || '';
                      const bDesc = subBInfo?.description || '';
                      const aMechs = (subAInfo?.mechanisms || []).slice(0, 3);
                      const bMechs = (subBInfo?.mechanisms || []).slice(0, 3);
                      if (!aDesc && !bDesc && aMechs.length === 0 && bMechs.length === 0) return null;
                      return (
                        <div style={{ marginTop:3, padding:'4px 6px', background:'rgba(34,197,94,0.04)', borderRadius:4, border:'1px solid rgba(34,197,94,0.08)' }}>
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{aName}</b>: {aDesc}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{bName}</b>: {bDesc}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => (
                          <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.15)', fontWeight:500 }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || (m||'').replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    {interaction?.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction.notes}</div>}
                  </div>
                );
              }, i))}
              {synTotal === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет синергий</div>}
              {synPage.length < synTotal && <button onClick={() => setSynergyPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({synTotal - synPage.length} из {synTotal})</button>}
            </div>
          )}
        </div>
        <div>
          <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_conflicts: !(prev?.syn_conflicts ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
            <span style={{ fontSize:13 }}>⊖</span>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#ef4444' }}>Конфликты и осторожность ({confTotal})</div>
            <span style={{ fontSize:9, color:'var(--text-dim)', transform:cats?.syn_conflicts !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
          </div>
          {cats?.syn_conflicts !== false && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {confPage.map((interaction: any, i: number) => safeItem(() => {
                const typeInfo = INTERACTION_TYPE_LABELS[interaction?.type] || { label:interaction?.type, emoji:'🔗', color:'#888' };
                const sevInfo = INTERACTION_SEVERITY_LABELS[interaction?.severity] || { label:interaction?.severity, color:'#888' };
                const aName = resolveSubName(interaction?.substanceA);
                const bName = resolveSubName(interaction?.substanceB);
                return (
                  <div key={interaction?.interactionId||i} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:`3px solid ${typeInfo.color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                        <span style={{ fontSize:10, color:typeInfo.color, fontWeight:700 }}>{interaction?.type === 'conflict' ? '×' : '?'}</span>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                      </div>
                      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:typeInfo.color+'22', color:typeInfo.color, fontWeight:600 }}>{typeInfo.label}</span>
                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color }}>{sevInfo.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊖ {showEffect(interaction)}</div>
                    {(() => {
                      const subAInfo = catalogSubstances.find(s => s.id === interaction?.substanceA) || (PHARMA_DB[interaction?.substanceA] ? { id: interaction?.substanceA, name: PHARMA_DB[interaction?.substanceA]?.name, description: PHARMA_DB[interaction?.substanceA]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceA]?.mechanisms || [] } : null);
                      const subBInfo = catalogSubstances.find(s => s.id === interaction?.substanceB) || (PHARMA_DB[interaction?.substanceB] ? { id: interaction?.substanceB, name: PHARMA_DB[interaction?.substanceB]?.name, description: PHARMA_DB[interaction?.substanceB]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceB]?.mechanisms || [] } : null);
                      const aDesc = subAInfo?.description || '';
                      const bDesc = subBInfo?.description || '';
                      const aMechs = ((subAInfo?.mechanisms || []) as string[]).slice(0, 3);
                      const bMechs = ((subBInfo?.mechanisms || []) as string[]).slice(0, 3);
                      if (!aDesc && !bDesc && aMechs.length === 0 && bMechs.length === 0) return null;
                      return (
                        <div style={{ marginTop:3, padding:'4px 6px', background:'rgba(239,68,68,0.04)', borderRadius:4, border:'1px solid rgba(239,68,68,0.08)' }}>
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{aName}</b>: {aDesc}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{bName}</b>: {bDesc}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => {
                          const ms = (m||'');
                          const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                            ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                            ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#8b5cf6';
                          return <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:mColor+'18', color:mColor, border:`1px solid ${mColor}22`, fontWeight:500 }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || (m||'').replace(/_/g, ' ')}</span>;
                        })}
                      </div>
                    )}
                    {interaction?.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction?.notes}</div>}
                  </div>
                );
              }, i))}
              {confTotal === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет конфликтов</div>}
              {confPage.length < confTotal && <button onClick={() => setSynergyPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({confTotal - confPage.length} из {confTotal})</button>}
            </div>
          )}
        </div>
        {/* Cautions section */}
        {cautTotal > 0 && (
        <div>
          <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_cautions: !(prev?.syn_cautions ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
            <span style={{ fontSize:13 }}>⚠️</span>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#f59e0b' }}>Осторожности ({cautTotal})</div>
            <span style={{ fontSize:9, color:'var(--text-dim)', transform:cats?.syn_cautions !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
          </div>
          {cats?.syn_cautions !== false && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {cautPage.map((interaction: any, i: number) => safeItem(() => {
                const sevInfo = INTERACTION_SEVERITY_LABELS[interaction?.severity] || { label:interaction?.severity, color:'#888' };
                const aName = resolveSubName(interaction?.substanceA);
                const bName = resolveSubName(interaction?.substanceB);
                return (
                  <div key={interaction?.interactionId||i} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:'3px solid #f59e0b' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceA) ? prev : [...prev, interaction?.substanceA]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                        <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700 }}>⚠</span>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceB) ? prev : [...prev, interaction?.substanceB]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                      </div>
                      <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color, flexShrink:0 }}>{sevInfo.label}</span>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⚠ {showEffect(interaction)}</div>
                    {(() => {
                      const subAInfo = catalogSubstances.find(s => s.id === interaction?.substanceA) || (PHARMA_DB[interaction?.substanceA] ? { id: interaction?.substanceA, name: PHARMA_DB[interaction?.substanceA]?.name, description: PHARMA_DB[interaction?.substanceA]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceA]?.mechanisms || [] } : null);
                      const subBInfo = catalogSubstances.find(s => s.id === interaction?.substanceB) || (PHARMA_DB[interaction?.substanceB] ? { id: interaction?.substanceB, name: PHARMA_DB[interaction?.substanceB]?.name, description: PHARMA_DB[interaction?.substanceB]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceB]?.mechanisms || [] } : null);
                      const aDesc = subAInfo?.description || '';
                      const bDesc = subBInfo?.description || '';
                      const aMechs = ((subAInfo?.mechanisms || []) as string[]).slice(0, 3);
                      const bMechs = ((subBInfo?.mechanisms || []) as string[]).slice(0, 3);
                      if (!aDesc && !bDesc && aMechs.length === 0 && bMechs.length === 0) return null;
                      return (
                        <div style={{ marginTop:3, padding:'4px 6px', background:'rgba(245,158,11,0.04)', borderRadius:4, border:'1px solid rgba(245,158,11,0.08)' }}>
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#fbbf24'}}>{aName}</b>: {aDesc}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(251,191,36,0.1)',color:'#fbbf24'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#fbbf24'}}>{bName}</b>: {bDesc}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(251,191,36,0.1)',color:'#fbbf24'}}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => {
                          const ms = (m||'');
                          const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                            ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                            ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#8b5cf6';
                          return <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:mColor+'18', color:mColor, border:`1px solid ${mColor}22`, fontWeight:500 }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || (m||'').replace(/_/g, ' ')}</span>;
                        })}
                      </div>
                    )}
                    {interaction?.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction?.notes}</div>}
                  </div>
                );
              }, i))}
              {cautTotal === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет осторожностей</div>}
              {cautPage.length < cautTotal && <button onClick={() => setSynergyPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({cautTotal - cautPage.length} из {cautTotal})</button>}
            </div>
          )}
        </div>
        )}
      </>);
    });
  };

  return (
    <div className="screen support-screen" style={{ paddingTop: section === 'protocols' ? '40px' : section === 'generator' ? '85px' : (section === 'info' || calcView === 'info' || calcView === 'peptides' || calcView === 'mixcalc') ? '120px' : section !== 'home' ? '50px' : '10px', paddingBottom: '0px', overflowY: 'auto' }}>

      {/* ===== GENERATOR SUB-TAB PILLS (with back/home) ===== */}
      {section === 'generator' && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <BackNav />
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['calculator','🧮 Калькулятор'],['info','📖 О подборе']].map(([id,label]) => (
              <button key={id} onClick={() => { setGenTab(id as any); 
              const a: Record<string,()=>void> = {
                calculator: ()=>{ setTab('calculator'); setSupportView('calc'); },
                info: ()=>{},
              };
              a[id]?.();
            }} style={{
              padding:'6px 14px', borderRadius:22, fontSize:11, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
              background: genTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
              color: genTab === id ? '#000' : 'var(--text-dim)',
              border: '1px solid ' + (genTab === id ? 'var(--accent)' : 'var(--border)'),
            }}>{label}</button>
          ))}
          </div>
        </div>
      )}

      {/* ===== PROTOCOLS HEADER (back/home only) ===== */}
      {section === 'protocols' && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <BackNav />
          </div>
        </div>
      )}

      {/* ===== INFO HEADER (back/home + pills) ===== */}
      {(section === 'info' || calcView === 'info' || calcView === 'peptides' || calcView === 'mixcalc') && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <BackNav />
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['peptides','Пептиды'],['catalog','Каталог'],['mixcalc','💪 Тренировочные миксы'],['biostack','🧬 BioStack AI'],['interactions','⚠ Взаимодействия'],['research','Исследования'],['favorites','Избранное']].map(([id,label]) => (
              <button key={id} onClick={() => { setInfoTab(id as any);
                if (id === 'peptides') { setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('peptides'); setInfoTab('peptides'); }
                else if (id === 'mixcalc') { setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('mixcalc'); }
                else { setTab('main'); setSupportView('calc'); setCalcView('info'); setSection('home'); setInfoView(id as InfoView); }
              }} style={{
                padding:'5px 12px', borderRadius:16, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: infoTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: infoTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (infoTab === id ? 'var(--accent)' : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MAIN HERO ===== */}
      {(section === 'home' && tab === 'main' && supportView === 'main') && (<InfoErrorBoundary label="Главная бады">
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/support-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div onClick={() => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.15)', fontSize:24 }}>🧮</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, marginBottom:4, color:'var(--accent)' }}>Калькулятор поддержки</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Расчёт рисков, генератор стеков, протоколы нейропротекции, миксы, план приёма</div>
                </div>
                <span style={{ color:'var(--accent)', fontSize:18, opacity:0.6 }}>→</span>
              </div>

              <div onClick={() => { setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(96,165,250,0.15)', fontSize:24 }}>📚</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, marginBottom:4, color:'#60a5fa' }}>Общая информация</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Каталог, синергии, взаимодействия, исследования, калькуляторы</div>
                </div>
                <span style={{ color:'#60a5fa', fontSize:18, opacity:0.6 }}>→</span>
              </div>
              {/* Тренировочные миксы — удалены по запросу пользователя */}

              {/* Примерные протоколы поддержки — одна кнопка */}
              <div onClick={() => { setSection('protocols'); setProtocolTab('pct'); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(139,92,246,0.15)', fontSize:24 }}>📋</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, marginBottom:4, color:'#8b5cf6' }}>Примерные протоколы поддержки</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>ПКТ · Фертильность · ГЗТ · Нейро · Суставы · Акне</div>
                </div>
                <span style={{ color:'#8b5cf6', fontSize:18, opacity:0.6 }}>→</span>
              </div>
            </div>
        </div>
        </div>
      </InfoErrorBoundary>)}

      {/* ===== SUB-NAVIGATION (REMOVED — content moved to existing tabs) ===== */}

      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'info' && (
        <div style={{ padding:'0 0 70px', display:'flex', flexDirection:'column' }}>
          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            {renderView(infoView, 'catalog', () =>
              <div>
                {/* Sub-tabs: По типам / По органам / Стеки */}
                 <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                   {(['type','organ','stack'] as const).map(t => (
                     <button key={t} onClick={() => { if (t === 'organ') { setExpandedCategories(prev => { const n: Record<string,boolean>={}; Object.keys(prev).forEach(k=>{if(k.startsWith('organ_'))n[k]=true}); return {...prev,...n}; }); } setCatalogSubTab(t); }} style={{
                       padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                       background: catalogSubTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                       color: catalogSubTab === t ? '#000' : 'var(--text-dim)',
                       border: `1px solid ${catalogSubTab === t ? 'var(--accent)' : 'var(--border)'}`,
                     }}>{t === 'stack' ? '🧩 Готовые стеки' : t === 'type' ? '📋 По типам' : '🫀 По органам'}</button>
                   ))}
                 </div>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:12 }} />
                </div>
                <div style={{height:4}} />
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
            {catalogSubTab === 'stack' ? (searchQuery ? `Найдено стеков: ${filteredStacks.length} из ${ALL_STACKS.length}` : `Всего стеков: ${ALL_STACKS.length}`) : (searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`)}
                </div>
                {catalogSubTab === 'organ' && (
                  /* По органам */
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(OrganGroupedSubstances||[]).map(group => {
                      const isExpanded = expandedCategories[group.key] ?? (group.count <= 5);
                      return (
                        <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{group.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{group.count}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (group.items||[]).map(sub => {
                            const isSelected = selectedSub === sub?.id;
                            return (
                              <div key={sub?.id||'x'}>
                                <div onClick={() => setSelectedSub(isSelected ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                          {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                    </div>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                   <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                   <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                   <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                 </div>
                                 {isSelected && sub && (
                                  <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                    <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                      {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                    </div>
                                    {(sub.mechanisms||[]).length > 0 && (
                                      <div style={{ marginBottom:3 }}>
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                          {(sub.mechanisms||[]).map((m,i) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogSubTab === 'tier' && (
                  /* По уровням */
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {SUPPORT_TIER_GROUPS.map((tg, tgi) => {
                      const isExpanded = expandedCategories[tg.key] ?? true;
                      return (
                        <div key={tg.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [tg.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{tg.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:tg.color }}>{tg.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{tg.substances.length}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop:'1px solid var(--border)' }}>
                              {tg.substances.map(id => {
                                const sub = catalogSubstances.find(s => s.id === id);
                                if (!sub) return null;
                                const isSelected = selectedSub === id;
                                return (
                                  <div key={id}>
                                    <div onClick={() => setSelectedSub(isSelected ? null : id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ flex:1 }}>
                                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{(sub.categories||[]).slice(0,2).join(', ')}</div>
                                      </div>
                                      <button onClick={e => { e.stopPropagation(); if (!enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(id) ? '✓' : '+ Мой стек'}</button>
                                       <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(id);if(idx>=0)f.splice(idx,1);else f.push(id);localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(id)?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                       <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===id)) { arr.push({id, name:sub?.name||id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                      <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                    </div>
                                    {isSelected && (
                                      <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description}</div>
                                        {(sub.mechanisms||[]).length > 0 && (
                                          <div style={{ marginBottom:3 }}>
                                            <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                              {(sub.mechanisms||[]).map((m,i) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                            </div>
                                          </div>
                                        )}
                                        {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                   {catalogSubTab === 'stack' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                        <PopupSelect label="🫀 Система" value={stkFilterSystem} options={[{id:'all',label:'🫀 Все системы'},...stackSystems.map(sys=>({id:sys,label:SYSTEM_LABELS_CATALOG[sys]||sys}))]} onChange={setStkFilterSystem} />
                        <PopupSelect label="🧪 Количество" value={stkFilterQty} options={[{id:'all',label:'🧪 Любое кол-во'},{id:'1-3',label:'1-3 вещества'},{id:'4-7',label:'4-7 веществ'},{id:'8-15',label:'8-15 веществ'},{id:'16-25',label:'16-25 веществ'},{id:'25+',label:'25+ веществ'}]} onChange={setStkFilterQty} />
                        <PopupSelect label="⭐ Рейтинг" value={stkFilterScore} options={[{id:'all',label:'⭐ Любой рейтинг'},{id:'0-50',label:'⭐ до 50'},{id:'51-74',label:'⭐ 51-74'},{id:'75-84',label:'⭐ 75-84'},{id:'85-100',label:'⭐ 85+'}]} onChange={setStkFilterScore} />
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', textAlign:'center' }}>{filteredStacks.length} из {ALL_STACKS.length}</div>
                      {filteredStacks.map(stk => {
                        const isExp = stackExpanded === stk.id;
                        return (
                        <div key={stk.id} style={{ borderRadius:12, background:'var(--bg-secondary)', border:'1px solid var(--border)', overflow:'hidden' }}>
                          <div style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>{stk.name}</span>
                              <span style={{ fontSize:8, padding:'2px 6px', borderRadius:6, background:'rgba(0,230,138,0.1)', color:'#00e68a', fontWeight:600 }}>⭐ {stk.synergyScore}</span>
                            </div>
                            <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4 }}>{stk.problem}</div>
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                              {stk.substances.slice(0,6).map(s => {
                                const cat = SUPPORT_CATALOG_DATA[s.id];
                                return <span key={s.id} style={{ padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.06)', color:'#00e68a', fontSize:7 }}>{cat?.nameRu || cat?.name || s.id}</span>;
                              })}
                              {stk.substances.length > 6 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>+{stk.substances.length-6}</span>}
                            </div>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => {
                                const ids = stk.substances.map(s => s.id);
                                const existing = JSON.parse(localStorage.getItem('he_finder_saved_stacks')||'[]');
                                localStorage.setItem('he_finder_saved_stacks', JSON.stringify([ids, ...existing].slice(0,10)));
                                setEnhancedSubs(prev => [...new Set([...prev, ...ids])]);
                              }} style={{ flex:1, padding:'4px 0', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a' }}>📥 + Мой стек</button>
                              <button onClick={() => {
                                try {
                                  let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
                                  if (!arr.find((x:any) => x.id === stk.id)) {
                                    arr.push({
                                      id: stk.id, name: stk.name, description: stk.description, system: stk.system,
                                      subs: stk.substances.map(s => s.id), dosages: Object.fromEntries(stk.substances.map(s => [s.id, s.dose])),
                                      timingSummary: stk.timingSummary, monitoring: stk.monitoring,
                                      specialInstructions: stk.specialInstructions, contraindications: stk.contraindications,
                                      warnings: stk.warnings, synergyScore: stk.synergyScore,
                                      source: 'Каталог стеков', date: new Date().toISOString()
                                    });
                                    localStorage.setItem('he_my_stacks', JSON.stringify(arr));
                                    setFavRefresh(p => p + 1);
                                  }
                                } catch {}
                              }} style={{ padding:'4px 8px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', color:'#818cf8' }}>📦 В мои стеки</button>
                              <button onClick={() => setStackExpanded(isExp ? null : stk.id)} style={{
                                padding:'4px 10px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer',
                                background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', color:'#8b5cf6',
                              }}>📋 {isExp ? 'Скрыть' : 'Подробнее'}</button>
                            </div>
                          </div>
                          {isExp && (
                            <div style={{ padding:'0 12px 10px', borderTop:'1px solid var(--border)', marginTop:0, display:'flex', flexDirection:'column', gap:4, fontSize:7, color:'rgba(255,255,255,0.6)' }}>
                              <div>🧬 <b>Синергия:</b> {stk.synergyPrinciple}</div>
                              <div>⏰ <b>Приём:</b> {stk.timingSummary}</div>
                              {stk.anatomicalMapping?.organSystems && <div>🫀 <b>Системы:</b> {stk.anatomicalMapping.organSystems.join(', ')}</div>}
                              <div>🔬 <b>Контроль:</b> {stk.monitoring}</div>
                              {stk.specialInstructions && <div>💡 <b>Указания:</b> {stk.specialInstructions}</div>}
                              {stk.contraindications && <div style={{ color:'#ef4444' }}>⛔ <b>Противопоказания:</b> {stk.contraindications}</div>}
                              {stk.warnings && <div style={{ color:'#f59e0b' }}>⚠️ <b>Предупреждения:</b> {stk.warnings}</div>}
                              {stk.structuredLabControl?.markers && stk.structuredLabControl.markers.length > 0 && (
                                <div>📊 <b>Маркеры:</b> {stk.structuredLabControl.markers.slice(0,5).map(m => `${m.marker} (${m.when} — ${m.targetRange})`).join('; ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                {/* Complexes tab removed — all substances now in type/organ/tier views */}
                {(catalogSubTab === 'type' || !catalogSubTab) && (
                /* По типам — все 280 препаратов, сгруппированы по типу (без органов/функций) */
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {(typeGroupedSubstances||[]).map(group => {
                    const catInfo = getCategoryInfo(group.cat);
                    const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
                    return (
                      <div key={group.cat} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                          <span style={{ fontSize:14 }}>{catInfo.emoji}</span>
                          <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{catInfo.label}</div>
                          <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.count}</span>
                          {(group.classBadges||[]).slice(0,4).map(b => (
                            <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                          ))}
                          <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop:'1px solid var(--border)' }}>
                            {/* Class sub-groups (3+ matching substances) */}
                            {Object.entries(group.classItems || {}).map(([clsKey, clsSubs]) => {
                              const clsInfo = CLASS_BASE_NAMES[clsKey];
                              const clsExpKey = `cls_${group.cat}_${clsKey}`;
                              const clsExpanded = expandedCategories[clsExpKey] ?? true;
                              return (
                                <div key={clsKey}>
                                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [clsExpKey]: !clsExpanded }))} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', userSelect:'none', background:'rgba(0,230,138,0.03)', borderBottom:'1px solid rgba(0,230,138,0.1)' }}>
                                    <span style={{ fontSize:11 }}>{clsInfo?.emoji || '📦'}</span>
                                    <div style={{ flex:1, fontSize:9, fontWeight:700, color:'#00e68a' }}>{clsInfo?.label || clsKey} ({clsSubs.length} форм{clsSubs.length === 1 ? 'а' : clsSubs.length < 5 ? 'ы' : ''})</div>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', transform:clsExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                                  </div>
                                  {clsExpanded && clsSubs.map(sub => (
                                    <div key={sub?.id||'x'}>
                                      <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 22px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map(c => { const ci = getCategoryInfo(c); return <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{ci.label||c||''}</span>; })}
                                      {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                          </div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                        <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                        <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                         <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                       </div>
                                       {selectedSub === sub?.id && sub && (
                                         <div style={{ padding:'6px 10px 8px 22px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                           <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                          <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                            {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                          </div>
                                          {(sub.mechanisms||[]).length > 0 && (
                                            <div style={{ marginBottom:3 }}>
                                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                                {(sub.mechanisms||[]).map((m,i) => (
                                                  <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || (m||'').replace(/_/g, ' ')}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                           {sub.deficiency && sub.deficiency !== 'NONE' && (
                                              <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                           )}
                                          {(sub as any).forms && (sub as any).forms.length > 0 && (
                                            <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                              <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                              {((sub as any).forms as any[]).map((f, fi) => (
                                                <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                                  <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                                  {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:1000,
          padding:'8px 20px', borderRadius:12, fontSize:10, fontWeight:700,
          background: toast.type==='success'?'rgba(0,230,138,0.9)':toast.type==='warning'?'rgba(245,158,11,0.9)':'rgba(239,68,68,0.9)',
          color: toast.type==='success'?'#000':'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </div>
                                              ))}
                                            </div>
                                          )}
                                          {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Remaining items (not in any class sub-group) */}
                            {(() => {
                              const classSubsSet = new Set<string>();
                              for (const clsSubs of Object.values(group.classItems || {})) {
                                for (const s of clsSubs as SupportSubstance[]) { if (s?.id) classSubsSet.add(s.id); }
                              }
                              const remaining = (group.items||[]).filter(sub => sub?.id && !classSubsSet.has(sub.id));
                              if (remaining.length === 0) return null;
                              return remaining.map(sub => (
                                <div key={sub?.id||'x'}>
                                  <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                        {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                            {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                      </div>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                    <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                    <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                    <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                  </div>
                                  {selectedSub === sub?.id && sub && (
                                    <div style={{ padding:'6px 10px 8px 14px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                      <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                        {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                      </div>
                                      {(sub.mechanisms||[]).length > 0 && (
                                        <div style={{ marginBottom:3 }}>
                                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                            {(sub.mechanisms||[]).map((m,i) => (
                                              <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{(m||'')}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
{(sub.organs||[]).length > 0 && (
                                         <div style={{ marginBottom:3 }}>
                                           <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Органы-мишени:</div>
                                           <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                             {[...new Set(sub.organs||[])].map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
                                           </div>
                                         </div>
                                       )}
                                       {sub.deficiency && sub.deficiency !== 'NONE' && (
                                         <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                       )}
                                       {(sub as any).forms && (sub as any).forms.length > 0 && (
                                        <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                          <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                          {((sub as any).forms as any[]).map((f, fi) => (
                                            <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                              <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                              <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                              {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(groupedSubstances||[]).length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
                )}
              </div>
            )}
            {/* synergies merged into interactions tab */}
            {/* ─── ВЗАИМОДЕЙСТВИЯ (единая вкладка: всё + калькулятор) ─── */}
            {renderView(infoView, 'interactions', () => {
              const allItems = mergedInteractions || [];
              const stats = [
                { label: '🤝 Синергии', count: allItems.filter((i:any) => i?.type === 'synergy').length, color: '#22c55e' },
                { label: '🔴 Конфликты', count: allItems.filter((i:any) => i?.type === 'conflict').length, color: '#ef4444' },
                { label: '🟡 Осторожности', count: allItems.filter((i:any) => i?.type === 'caution').length, color: '#f59e0b' },
              ];
              return (
              <div>
                {/* Stats cards */}
                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                  {stats.map(s => (
                    <div key={s.label} style={{ flex:1, minWidth:80, padding:'8px 6px', borderRadius:10, textAlign:'center', background:s.color+'12', border:`1px solid ${s.color}22` }}>
                      <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.count}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Interactions: все 3 типа с закрытыми секциями */}
                {/* Sub-tab bar removed — show all types at once */}

                {/* Severity / Count / Organ filters — кнопки-карточки с попапом */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                  <PopupSelect label="⚡ Эффективность" value={infoSynergySeverity} options={[['all','Все'],['LOW','Низкая'],['MEDIUM','Средняя'],['HIGH','Высокая']].map(([v,l])=>({id:v as string,label:l as string}))} onChange={setInfoSynergySeverity} />
                  <PopupSelect label="🧪 Веществ" value={String(synergyCountFilter)} options={[[0,'Любое'],[2,'2'],[3,'3'],[5,'5'],[10,'10+']].map(([v,l])=>({id:String(v),label:l as string}))} onChange={v=>setSynergyCountFilter(Number(v))} />
                  <PopupSelect label="🫀 Орган" value={synergyOrganFilter} options={[['','Все'], ...Object.entries(ORGAN_CATEGORY_MAP).filter(([k,v],i,a)=>a.findIndex(x=>x[1].key===v.key)===i).map(([k,v])=>[v.key,v.emoji+v.label])].map(([v,l])=>({id:v as string,label:l as string}))} onChange={setSynergyOrganFilter} />
                </div>

                {synergySubTab === 'calculator' ? (
                  /* ─── КАЛЬКУЛЯТОР ВЗАИМОДЕЙСТВИЙ ─── */
                  <div>
                    <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                      {(['support','pharma'] as const).map(t => (
                        <button key={t} onClick={() => setInteractTab(t)} style={{
                          flex:1, padding:'7px 0', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                          background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: interactTab === t ? '#000' : 'var(--text-dim)', border: 'none',
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
                                  <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                                  {id && <button onClick={() => { updateInteraction(idx, ''); setInteractionSearch(''); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                                </div>
                                <div style={{ position:'relative' }}>
                                  {id ? (
                                    <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontSize:10, fontWeight:600 }}>{selectedName}</div>
                                  ) : (
                                    <>
                                      <input value={interactionSearchIdx===idx ? interactionSearch : ''} placeholder="🔍 Введите название..." onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }} onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); }} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                      {interactionSearch && interactionSearchIdx===idx && (
                                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                          {[...allSupport, ...catalogSubstances.filter(x => !allSupport.find(s => s.id === x.id))].filter(s => (s.name||s.id||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,10).map(s => (
                                            <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); setInteractionSearchIdx(-1); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                              <span style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                                              <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{s.id}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                            <button onClick={addInteraction} disabled={maxInteractionsReached} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: maxInteractionsReached ? 'not-allowed' : 'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color: maxInteractionsReached ? '#666' : '#00e68a', opacity: maxInteractionsReached ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                            <span style={{ fontSize:9, color:'var(--text-dim)' }}>{interactionIds.length}/10</span>
                          </div>
                        </div>
                        {validInteractionIds.length<2 && <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>}
                        {validInteractionIds.length>=2 && !hasSupportInteractions && <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>}
                        {hasSupportInteractions && (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {[
                              { list: supportSynergiesList, label:'Синергия', color:'#22c55e', emoji:'🤝' },
                              { list: supportConflicts, label:'Конфликт', color:'#ef4444', emoji:'🔴' },
                              { list: supportCautions, label:'Осторожность', color:'#f59e0b', emoji:'🟡' },
                            ].filter(s => s.list.length>0).map(section => (
                              <div key={section.label}>
                                <div style={{ fontSize:10, fontWeight:700, color:section.color, marginBottom:4 }}>
                                  {section.emoji} {section.label} <span style={{ fontSize:8, opacity:0.6 }}>({section.list.length})</span>
                                </div>
                                {(section.list || []).map(i => {
                                  const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                                  const sevLabel = i.severity === 'HIGH' ? 'Высокий' : i.severity === 'MEDIUM' ? 'Средний' : 'Низкий';
                                  const aName = resolveSubName(i.substanceA) || i.substanceA;
                                  const bName = resolveSubName(i.substanceB) || i.substanceB;
                                  const effText = showEffect(i);
                                  const mechTexts = (i.mechanisms || []).map((m: string) =>
                                    MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')
                                  );
                                  return (
                                    <div key={i.interactionId} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px 12px', border:'1px solid '+section.color+'22', marginBottom:4 }}>
                                      {/* Header: pair names + severity badge */}
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                        <span style={{ color:section.color, fontWeight:700, fontSize:10 }}>{aName} + {bName}</span>
                                        <div style={{ display:'flex', gap:3 }}>
                                          {i.severity && (
                                            <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:sevColor+'22', color:sevColor, fontWeight:600 }}>
                                              {sevLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Severity bar */}
                                      <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginBottom:5, overflow:'hidden' }}>
                                        <div style={{ width: i.severity === 'HIGH' ? '100%' : i.severity === 'MEDIUM' ? '60%' : '30%', height:'100%', background:sevColor, borderRadius:2 }} />
                                      </div>
                                      {/* Эффект */}
                                      {effText && (
                                        <div style={{ fontSize:9, color: section.color, fontWeight:600, lineHeight:1.3, marginBottom:4 }}>
                                          🎯 {effText}
                                        </div>
                                      )}
                                      {/* Пояснения (из обогащения) */}
                                      {(INTERACTION_ENRICHMENT[i.interactionId]?.mechanismRu?.length > 0 ? INTERACTION_ENRICHMENT[i.interactionId].mechanismRu : mechTexts).length > 0 && (
                                        <div style={{ marginBottom:3 }}>
                                          <div style={{ fontSize:7, color:'#a78bfa', fontWeight:600, marginBottom:1 }}>⚙️ Почему:</div>
                                          <ul style={{ margin:0, paddingLeft:14, fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.3 }}>
                                            {(INTERACTION_ENRICHMENT[i.interactionId]?.mechanismRu?.length > 0 ? INTERACTION_ENRICHMENT[i.interactionId].mechanismRu : mechTexts).map((txt: string, mi: number) => (
                                              <li key={mi}>{txt}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {/* Риск (из обогащения) */}
                                      {INTERACTION_ENRICHMENT[i.interactionId]?.riskDescription && (
                                        <div style={{ background:'rgba(239,68,68,0.06)', borderRadius:6, padding:'5px 8px', marginBottom:3, border:'1px solid rgba(239,68,68,0.15)' }}>
                                          <div style={{ fontSize:7, color:'#ef4444', fontWeight:700, marginBottom:1 }}>⚠️ Риск:</div>
                                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>{INTERACTION_ENRICHMENT[i.interactionId].riskDescription}</div>
                                        </div>
                                      )}
                                      {/* Параметры (из обогащения) */}
                                      {INTERACTION_ENRICHMENT[i.interactionId]?.parameters && (
                                        <div style={{ background:'rgba(245,158,11,0.06)', borderRadius:6, padding:'5px 8px', marginBottom:3, border:'1px solid rgba(245,158,11,0.15)' }}>
                                          <div style={{ fontSize:7, color:'#f59e0b', fontWeight:700, marginBottom:1 }}>📋 Параметры:</div>
                                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>{INTERACTION_ENRICHMENT[i.interactionId].parameters}</div>
                                        </div>
                                      )}
                                      {/* Запасные механизмы (когда enrichment нет) */}
                                      {!INTERACTION_ENRICHMENT[i.interactionId] && mechTexts.length > 0 && (
                                        <div style={{ marginBottom:3 }}>
                                          <div style={{ fontSize:7, color:'#a78bfa', fontWeight:600, marginBottom:1 }}>⚙️ Почему:</div>
                                          <ul style={{ margin:0, paddingLeft:14, fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.3 }}>
                                            {mechTexts.map((txt: string, mi: number) => (
                                              <li key={mi}>{txt}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {/* Параметры / Рекомендации (запасные) */}
                                      {!INTERACTION_ENRICHMENT[i.interactionId] && i.notes && (
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.3, background:'rgba(245,158,11,0.06)', padding:'4px 6px', borderRadius:4, marginTop:2 }}>
                                          <span style={{ color:'#f59e0b', fontWeight:600 }}>💊 </span>
                                          {i.notes}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Per-entry data for support substances */}
                        {validInteractionIds.length >= 1 && (
                          <div style={{ marginTop: 10 }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: 10, color: 'var(--text-dim)' }}>📋 Данные по веществам</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {validInteractionIds.map((id, idx) => {
                                const entry = SUPPORT_CATALOG_DATA[id];
                                if (!entry) return null;
                                const tierColors: Record<string,string> = { core:'#00e68a', standard:'#60a5fa', advanced:'#a78bfa', specialty:'#f59e0b' };
                                return (
                                  <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'9px 11px', border:'1px solid var(--border)' }}>
                                    {/* Name + tier badge */}
                                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                      <span style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>{entry.nameRu || entry.name || id}</span>
                                      {entry.tier && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:(tierColors[entry.tier]||'#888')+'22', color:tierColors[entry.tier]||'#888', fontWeight:600 }}>{entry.tier}</span>}
                                    </div>
                                    {/* Categories + organs */}
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:3 }}>
                                      {(entry.category||[]).slice(0,3).map((cat,i) => (
                                        <span key={i} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.1)', color:'#a78bfa' }}>{cat}</span>
                                      ))}
                                      {entry.targetOrgan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>{entry.targetOrgan}</span>}
                                    </div>
                                    {/* Description */}
                                    {entry.description && <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.25, marginBottom:3 }}>{entry.description}</div>}
                                    {/* Analog chips */}
                                    {entry.analog && entry.analog.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                                        <span style={{ fontSize:7, color:'#818cf8', fontWeight:600 }}>🔗 Аналоги: </span>
                                        {entry.analog.map((a,i) => {
                                          const ae = SUPPORT_CATALOG_DATA[a];
                                          return <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(129,140,248,0.1)', color:'#818cf8' }}>{ae?.nameRu || ae?.name || a}</span>;
                                        })}
                                      </div>
                                    )}
                                    {/* Synergy chips */}
                                    {entry.synergies && entry.synergies.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                                        <span style={{ fontSize:7, color:'#22c55e', fontWeight:600 }}>🟢 Синергии: </span>
                                        {entry.synergies.map((s,i) => (
                                          <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>{s.with}: {s.effect}</span>
                                        ))}
                                      </div>
                                    )}
                                    {/* Conflict chips */}
                                    {entry.conflicts && entry.conflicts.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                                        <span style={{ fontSize:7, color:'#ef4444', fontWeight:600 }}>🔴 Конфликты: </span>
                                        {entry.conflicts.map((c,i) => (
                                          <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)', color: c.severity === 'HIGH' ? '#ef4444' : '#eab308' }}>{c.with}: {c.effect}</span>
                                        ))}
                                      </div>
                                    )}
                                    {/* Special instructions */}
                                    {entry.specialInstructions && entry.specialInstructions.length > 0 && (
                                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.2, marginTop:2, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:3 }}>
                                        <span style={{ color:'#f59e0b', fontWeight:600 }}>📋 </span>
                                        {entry.specialInstructions.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ─── ФАРМА-ВЗАИМОДЕЙСТВИЯ ─── */
                      <div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                          {pharmaInteractIds.map((id, idx) => {
                            const pharmaEntry = id ? PHARMA_DB[id] : null;
                            const selectedName = pharmaEntry?.name || '';
                            return (
                              <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                  <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                  <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                                  {id && <button onClick={() => { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                                </div>
                                <div style={{ position:'relative' }}>
                                  {id ? (
                                    <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>{selectedName} ({id})</div>
                                  ) : (
                                    <>
                                      <input value={pharmaInteractSearch} placeholder="🔍 Введите название препарата..." onChange={e => setPharmaInteractSearch(e.target.value)} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                      {pharmaInteractSearch && (
                                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                          {Object.entries(PHARMA_DB)
                                            .filter(([key, val]) => (val.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase()) || key.toLowerCase().includes(pharmaInteractSearch.toLowerCase()))
                                            .slice(0, 10).map(([key, val]) => (
                                            <div key={key} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = key; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                              <span style={{ fontWeight:600, color:'var(--text)' }}>{val.name}</span>
                                              <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{key}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                            <button onClick={() => setPharmaInteractIds(prev => prev.length < 10 ? [...prev, ''] : prev)} disabled={pharmaInteractIds.length >= 10} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: pharmaInteractIds.length >= 10 ? 'not-allowed' : 'pointer', background:'rgba(59,130,246,0.06)', border:'1px dashed rgba(59,130,246,0.3)', color: pharmaInteractIds.length >= 10 ? '#666' : '#60a5fa', opacity: pharmaInteractIds.length >= 10 ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                            <span style={{ fontSize:9, color:'var(--text-dim)' }}>{pharmaInteractIds.length}/10</span>
                          </div>
                        </div>
                        {(() => {
                          try {
                            const course: CourseEntry[] = pharmaInteractIds.filter(Boolean).map((id,ix) => ({ id: 'interact_'+ix, substanceId: id, doseValue: 100, doseUnit: 'mg', frequency: 7, startWeek: 1, endWeek: 12 }));
                            const alerts = checkDrugInteractions(course);
                            if (alerts.length === 0) return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>;
                            const color = (t: string) => t === 'critical' ? '#ef4444' : t === 'warning' ? '#f59e0b' : '#60a5fa';
                            return (
                              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                {alerts.map((alert, ai) => {
                                  const c = color(alert.type);
                                  const alertSevLabel = alert.type === 'critical' ? 'Критично' : alert.type === 'warning' ? 'Предупреждение' : 'Инфо';
                                  return (
                                    <div key={`alert_${ai}`} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px 12px', border:'1px solid '+c+'33' }}>
                                      {/* Header */}
                                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                                        <span style={{ fontSize:10, fontWeight:700, color:c }}>{alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}</span>
                                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:c+'22', color:c, fontWeight:600 }}>{alertSevLabel}</span>
                                        <span style={{ fontSize:8, color:'var(--text-dim)' }}>{(alert.drugs||[]).map(d => resolveSubName(d)).join(', ')}</span>
                                      </div>
                                      {/* Severity bar */}
                                      <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginBottom:5, overflow:'hidden' }}>
                                        <div style={{ width: alert.type === 'critical' ? '100%' : alert.type === 'warning' ? '60%' : '30%', height:'100%', background:c, borderRadius:2 }} />
                                      </div>
                                      {/* Эффект / Почему */}
                                      {alert.mechanism && (
                                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.3, marginBottom:5 }}>
                                          <span style={{ color:'#a78bfa', fontWeight:600, fontSize:8 }}>⚙️ Механизм: </span>
                                          {alert.mechanism}
                                        </div>
                                      )}
                                      {/* Рекомендация */}
                                      {alert.recommendation && (
                                        <div style={{ fontSize:8, color:'#f59e0b', lineHeight:1.3, background:'rgba(245,158,11,0.06)', padding:'4px 6px', borderRadius:4 }}>
                                          💊 Рекомендация: {alert.recommendation}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } catch (e) {
                            return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize:9, color:'#ef4444' }}>Ошибка: {String(e)}</span></div>;
                          }
                        })()}

                        {/* Per-entry data for pharma substances */}
                        {pharmaInteractIds.filter(Boolean).length >= 1 && (
                          <div style={{ marginTop: 10 }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: 10, color: 'var(--text-dim)' }}>📋 Данные по препаратам</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {pharmaInteractIds.filter(Boolean).map((id, idx) => {
                                const sub = PHARMA_DB[id];
                                if (!sub) return null;
                                const classLabel = (sub.class||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
                                const cvIcons: Record<string,string> = { up:'↑', down:'↓', neutral:'→' };
                                return (
                                  <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'9px 11px', border:'1px solid var(--border)' }}>
                                    {/* Name + class badge */}
                                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                                      <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa' }}>{sub.name}</span>
                                      {classLabel && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(129,140,248,0.1)', color:'#818cf8', fontWeight:600 }}>{classLabel}</span>}
                                    </div>
                                    {/* Target systems chips */}
                                    {(sub.targetSystems||[]).length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:3 }}>
                                        {(sub.targetSystems||[]).slice(0,4).map((sys,i) => (
                                          <span key={i} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>{sys}</span>
                                        ))}
                                      </div>
                                    )}
                                    {/* cvProfile summary */}
                                    {sub.cvProfile && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:3, fontSize:7, color:'rgba(255,255,255,0.5)' }}>
                                        <span style={{ color:'#f59e0b', fontWeight:600 }}>❤️ </span>
                                        <span style={{ color: sub.cvProfile.bloodPressure==='up'?'#ef4444':sub.cvProfile.bloodPressure==='down'?'#22c55e':'#888' }}>АД {cvIcons[sub.cvProfile.bloodPressure]||sub.cvProfile.bloodPressure}</span>
                                        <span style={{ color: sub.cvProfile.heartRate==='up'?'#ef4444':sub.cvProfile.heartRate==='down'?'#22c55e':'#888' }}>ЧСС {cvIcons[sub.cvProfile.heartRate]||sub.cvProfile.heartRate}</span>
                                        <span style={{ color: sub.cvProfile.thrombosisRisk==='high'?'#ef4444':sub.cvProfile.thrombosisRisk==='medium'?'#f59e0b':'#22c55e' }}>Тромбоз: {sub.cvProfile.thrombosisRisk}</span>
                                      </div>
                                    )}
                                    {/* Conflict chips */}
                                    {sub.conflicts && sub.conflicts.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                                        <span style={{ fontSize:7, color:'#ef4444', fontWeight:600 }}>🔴 Конфликты: </span>
                                        {sub.conflicts.map((c,i) => (
                                          <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)', color: c.severity === 'HIGH' ? '#ef4444' : '#eab308' }}>{c.with}: {c.effect}</span>
                                        ))}
                                      </div>
                                    )}
                                    {/* Linked substances chips */}
                                    {sub.linkedSubstances && sub.linkedSubstances.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                                        <span style={{ fontSize:7, color:'#22c55e', fontWeight:600 }}>🟢 Связанные: </span>
                                        {sub.linkedSubstances.map((ls,i) => {
                                          const linkedName = PHARMA_DB[ls.id]?.name || ls.id;
                                          return <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: ls.type === 'synergy' ? 'rgba(34,197,94,0.1)' : 'rgba(255,23,68,0.1)', color: ls.type === 'synergy' ? '#22c55e' : '#ff1744' }}>{linkedName}: {ls.mechanism}</span>;
                                        })}
                                      </div>
                                    )}
                                    {/* Special instructions */}
                                    {sub.specialInstructions && sub.specialInstructions.length > 0 && (
                                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.2, marginTop:2, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:3 }}>
                                        <span style={{ color:'#f59e0b', fontWeight:600 }}>📋 </span>
                                        {sub.specialInstructions.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ─── СИНЕРГИИ/КОНФЛИКТЫ/ОСТОРОЖНОСТИ ─── */
                  <>
                    <div style={{ marginBottom:6 }}>
                      <input value={synergySearch} onChange={e => setSynergySearch(e.target.value)} placeholder="🔍 Поиск по веществу/эффекту..." style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                    </div>
                     <div style={{ maxHeight:'calc(70vh)', overflowY:'auto', paddingRight:4 }}>{synergiesContent(
                        (() => {
                          let list = infoSynergySeverity === 'all' ? mergedInteractions : mergedInteractions.filter((i: any) => i.severity === infoSynergySeverity);
                         if (synergySubTab !== 'all') {
                           const typeMap: Record<string, string> = { synergies: 'synergy', conflicts: 'conflict', cautions: 'caution' };
                           list = list.filter((i: any) => i.type === typeMap[synergySubTab]);
                         }
                            if (synergyCountFilter > 0) {
                              list = list.filter((i: any) => {
                                const countA = mergedInteractions.filter((x: any) => x.substanceA === i.substanceA || x.substanceB === i.substanceA).length;
                                const countB = mergedInteractions.filter((x: any) => x.substanceA === i.substanceB || x.substanceB === i.substanceB).length;
                                return Math.max(countA, countB) >= synergyCountFilter;
                              });
                            }
                             if (synergyOrganFilter) {
                               list = list.filter((i: any) => {
                                 const checkOrg = (subId: string) => {
                                   const sub = catalogSubstances.find(s => s.id === subId);
                                   if (sub && sub.organs && sub.organs.length > 0) {
                                     return sub.organs.some((o: string) => {
                                       const norm = (o||'').trim().toUpperCase();
                                       const mapping = ORGAN_CATEGORY_MAP[norm];
                                       return mapping?.key === synergyOrganFilter;
                                     });
                                   }
                                   const pharm = PHARMA_DB?.[subId];
                                   if (pharm && pharm.targetSystems) {
                                     const sysToOrg: Record<string, string> = {
                                       cardio: 'heart_vessels', heart: 'heart_vessels', vessels: 'heart_vessels',
                                       hepatic: 'liver', liver: 'liver',
                                       neuro: 'brain_nerves', neuro_toxicity: 'brain_nerves', brain: 'brain_nerves', cns: 'brain_nerves',
                                       endocrine: 'endocrine', thyroid: 'endocrine', pancreas: 'endocrine', adrenal: 'endocrine', pituitary: 'endocrine',
                                       reproductive: 'reproductive', prostate: 'reproductive', gonads: 'reproductive', testes: 'reproductive', ovaries: 'reproductive',
                                       hematologic: 'blood', blood: 'blood',
                                       musculoskeletal: 'muscles', muscle: 'muscles', joints: 'joints_bones', bone: 'joints_bones', skeletal: 'joints_bones',
                                       skin: 'skin_hair', hair: 'skin_hair', dermal: 'skin_hair',
                                       ghigf: 'endocrine', ins_axis: 'endocrine', metabolic: 'mitochondria', mitochondria: 'mitochondria',
                                       immunity: 'immune', immune: 'immune',
                                       renal: 'kidneys', kidney: 'kidneys', urinary: 'kidneys',
                                       gi: 'gi', gastrointestinal: 'gi', gut: 'gi', stomach: 'gi', intestine: 'gi',
                                       respiratory: 'lungs', lung: 'lungs', pulmonary: 'lungs',
                                     };
                                     return pharm.targetSystems.some((o: string) => {
                                       const key = sysToOrg[o.toLowerCase().trim()];
                                       return key === synergyOrganFilter;
                                     });
                                   }
                                   if (subId) {
                                     const pharmKeys = Object.keys(PHARMA_DB);
                                     const baseLower = subId.toLowerCase();
                                     for (const pk of pharmKeys) {
                                       if (pk.includes(baseLower) || baseLower.includes(pk)) {
                                         const pfall = PHARMA_DB[pk];
                                         if (pfall?.targetSystems) {
                                           const sysToOrg2: Record<string, string> = {
                                             cardio: 'heart_vessels', heart: 'heart_vessels', vessels: 'heart_vessels',
                                             hepatic: 'liver', liver: 'liver',
                                             neuro: 'brain_nerves', neuro_toxicity: 'brain_nerves', brain: 'brain_nerves', cns: 'brain_nerves',
                                             endocrine: 'endocrine', thyroid: 'endocrine', pancreas: 'endocrine', adrenal: 'endocrine',
                                             reproductive: 'reproductive', prostate: 'reproductive', gonads: 'reproductive', testes: 'reproductive',
                                             hematologic: 'blood', blood: 'blood',
                                             musculoskeletal: 'muscles', muscle: 'muscles', joints: 'joints_bones', bone: 'joints_bones',
                                             skin: 'skin_hair', hair: 'skin_hair',
                                             ghigf: 'endocrine', ins_axis: 'endocrine', metabolic: 'mitochondria',
                                             immunity: 'immune', immune: 'immune',
                                             renal: 'kidneys', kidney: 'kidneys',
                                             gi: 'gi', gastrointestinal: 'gi', gut: 'gi',
                                           };
                                           return pfall.targetSystems.some((o: string) => {
                                             const key = sysToOrg2[o.toLowerCase().trim()];
                                             return key === synergyOrganFilter;
                                           });
                                         }
                                       }
                                     }
                                   }
                                   return false;
                                 };
                                 return checkOrg(i.substanceA) || checkOrg(i.substanceB);
                              });
                            }
                            if (synergySearch) {
                             const sq = synergySearch.toLowerCase();
                             list = list.filter((i: any) => (i.effect||'').toLowerCase().includes(sq) || (i.substanceA||'').toLowerCase().includes(sq) || (i.substanceB||'').toLowerCase().includes(sq) || (i.notes||'').toLowerCase().includes(sq));
                          }
                          return list;
                       })(), mergedInteractions, expandedCategories, synergySubTab)}</div>
                  </>
                )}
              </div>
            )})}
            {renderView(infoView, 'stacks', () => (
              <div style={{ padding:'0 0 80px' }}>
                <div className="card" style={{ marginBottom:10, padding:10, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>💾 Сохранить текущий стек</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={stackName} onChange={e=>setStackName(e.target.value)} placeholder="Название стека..."
                      style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:10 }} />
                    <button onClick={() => {
                      if (!stackName.trim()) { alert('Введите название'); return; }
                      const level = SUPPORT_LEVELS[supportLevel];
                      if (!level?.subs || level.subs.length === 0) { alert('Нет препаратов в калькуляторе'); return; }
                      const newStack = { id: 'stack_'+Date.now(), name: stackName.trim(), date: new Date().toISOString(), subs: [...level.subs], dosages: { ...(level.dosages||{}) }, notes: '' };
                      const updated = [...savedStacks, newStack];
                      setSavedStacks(updated);
                      localStorage.setItem('savedStacks', JSON.stringify(updated));
                      setStackName('');
                    }} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:10 }}>Сохранить</button>
                  </div>
                </div>
                {savedStacks.length === 0 ? (
                  <div style={{ textAlign:'center', padding:24, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)' }}>Нет сохранённых стеков</div>
                  </div>
                ) : (
                  savedStacks.map(stack => {
                    const isExpanded = expandedStack === stack.id;
                    return (
                      <div key={stack.id} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                        <div onClick={() => setExpandedStack(isExpanded ? null : stack.id)} style={{ padding:'10px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{getStackDisplayName(stack)}</div>
                            <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{stack.date ? new Date(stack.date).toLocaleDateString('ru') : ''} · {stack.subs.length} добавок</div>
                            {(stack as any).notes && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{(stack as any).notes}</div>}
                          </div>
                          <span style={{ fontSize:12, color:'var(--text-dim)', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ padding:'0 12px 10px' }}>
                            <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                              {(stack.subs || []).map(id => {
                                const sub = catalogSubstances.find(s => s.id === id);
                                const pharma = PHARMA_DB[id];
                                const name = sub?.name || pharma?.name || id.replace(/_/g, ' ');
                                const dosage = stack.dosages?.[id];
                                const desc = sub?.description || pharma?.description || '';
                                return (
                                  <div key={id} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{name}</span>
                                      {dosage && <span style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>{dosage.timing || ''} {dosage.mg ? `${dosage.mg}мг` : ''}</span>}
                                    </div>
                                    {desc && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{desc}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => {
                                try { localStorage.setItem('savedStacks', JSON.stringify(savedStacks.filter(s => s.id !== stack.id))); setSavedStacks(prev => prev.filter(s => s.id !== stack.id)); } catch {}
                              }} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontWeight:600 }}>✕ Удалить</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
            {renderView(infoView, 'favorites', () => {
              let favIds: string[] = [];
              try { favIds = JSON.parse(localStorage.getItem('he_support_favorites') || '[]'); } catch {}
              const favSubstances = favIds.map(id => catalogSubstances.find(s => s.id === id)).filter(Boolean);
              const filtered = favSearch ? favSubstances.filter(s => (s?.name||'').toLowerCase().includes(favSearch.toLowerCase())) : favSubstances;
              return (
              <div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {[['favorites','⭐ Избранное'],['mySubstances','💊 Мои препараты'],['myStacks','📦 Мои стеки'],['calculator','🧮 Расчёты'],['mixes','🎯 Миксы'],['plan','📋 План'],['reports','📊 Отчеты']].map(([id,label]) => (
                    <button key={id} onClick={() => setFavTab(id)} style={{
                      padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: favTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: favTab === id ? '#000' : 'var(--text-dim)',
                      border: '1px solid ' + (favTab === id ? 'var(--accent)' : 'var(--border)'),
                    }}>{label}</button>
                  ))}
                </div>

                {/* === FAVORITES TAB === */}
                {favTab === 'favorites' && (
                <div>
                  <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
                    placeholder="🔍 Поиск в избранном..."
                    style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
                  {filtered.length === 0 ? (
                    <div style={{ padding:24, textAlign:'center' }}>
                      <div style={{ fontSize:24, marginBottom:6 }}>⭐</div>
                      <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет избранных препаратов.</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога ➕</div>
                    </div>
                  ) : (
                    filtered.map((s: any) => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{s.name||s.id}</div>
                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                            {(s.categories||[]).slice(0,3).map((c: string) => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c}</span>)}
                          </div>
                        </div>
                        <button onClick={() => {
                          try {
                            let f: string[] = JSON.parse(localStorage.getItem('he_support_favorites') || '[]');
                            const idx = f.indexOf(s.id);
                            if (idx >= 0) f.splice(idx, 1);
                            localStorage.setItem('he_support_favorites', JSON.stringify(f));
                            setFavRefresh(prev => prev + 1);
                          } catch {}
                        }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>★ Убрать</button>
                      </div>
                    ))
                  )}
                </div>
                )}

                {/* === MY SUBSTANCES TAB === */}
                {favTab === 'mySubstances' && (
                <div style={{ paddingBottom:80 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
                      placeholder="🔍 Поиск в Моих препаратах..."
                      style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                  </div>
                  {(() => {
                    let mySubs: any[] = [];
                    try { mySubs = JSON.parse(localStorage.getItem('he_my_substances') || '[]'); } catch {}
                    const filtered = favSearch ? mySubs.filter((s:any) => (s.name||s.id||'').toLowerCase().includes(favSearch.toLowerCase())) : mySubs;
                    if (filtered.length === 0) return (
                      <div style={{ padding:24, textAlign:'center' }}>
                        <div style={{ fontSize:24, marginBottom:6 }}>💊</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых препаратов.</div>
                        <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога или BioStack AI (кнопка ★ или «В мои препараты»).</div>
                      </div>
                    );
                    return (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {filtered.map((s: any) => (
                          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{s.name || s.id}</div>
                              {s.dose && <div style={{ fontSize:8, color:'var(--text-dim)' }}>{s.dose}</div>}
                              {s.source && <div style={{ fontSize:8, color:'rgba(0,230,138,0.6)' }}>📌 {s.source}</div>}
                            </div>
                            <button onClick={() => {
                              try {
                                let arr: any[] = JSON.parse(localStorage.getItem('he_my_substances') || '[]');
                                localStorage.setItem('he_my_substances', JSON.stringify(arr.filter((x:any) => x.id !== s.id)));
                                setFavRefresh(prev => prev + 1);
                              } catch {}
                            }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>✕ Убрать</button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                )}

                {/* === MY STACKS TAB === */}
                {favTab === 'myStacks' && (
                <div style={{ paddingBottom:80 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
                      placeholder="🔍 Поиск в Моих стеках..."
                      style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                  </div>
                  {(() => {
                    let myStacksArr: any[] = [];
                    try { myStacksArr = JSON.parse(localStorage.getItem('he_my_stacks') || '[]'); } catch {}
                    const filtered = favSearch ? myStacksArr.filter((st:any) => (st.name||st.id||'').toLowerCase().includes(favSearch.toLowerCase())) : myStacksArr;
                    if (filtered.length === 0) return (
                      <div style={{ padding:24, textAlign:'center' }}>
                        <div style={{ fontSize:24, marginBottom:6 }}>📦</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых стеков.</div>
                        <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога стеков или BioStack AI (кнопка «В мои стеки»).</div>
                      </div>
                    );
                    return (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {filtered.map((st: any) => (
                          <div key={st.id} style={{ padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <div>
                                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{st.name || st.id}</div>
                                <div style={{ fontSize:8, color:'var(--text-dim)' }}>{st.subs?.length || 0} препаратов · {st.system || '—'}</div>
                              </div>
                              <button onClick={() => {
                                try {
                                  let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
                                  localStorage.setItem('he_my_stacks', JSON.stringify(arr.filter((x:any) => x.id !== st.id)));
                                  setFavRefresh(prev => prev + 1);
                                } catch {}
                              }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', whiteSpace:'nowrap', flexShrink:0 }}>✕ Удалить</button>
                            </div>
                            {st.description && <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.3 }}>{st.description.slice(0, 120)}{st.description.length > 120 ? '...' : ''}</div>}
                            {st.subs && st.subs.length > 0 && (
                              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                {(st.subs as string[]).slice(0, 6).map((sid: string) => {
                                  const cn = catalogSubstances.find((c:any) => c.id === sid);
                                  return <span key={sid} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{cn?.name || sid}</span>;
                                })}
                                {st.subs.length > 6 && <span style={{ fontSize:7, color:'var(--text-dim)' }}>+{st.subs.length - 6}</span>}
                              </div>
                            )}
                            <button onClick={() => {
                              const subs = (st.subs || []).filter((id:string) => SUPPORT_LEVELS[supportLevel]?.subs ? !SUPPORT_LEVELS[supportLevel].subs.includes(id) : true);
                              if (subs.length === 0) { alert('Все препараты стека уже в плане'); return; }
                              const level = SUPPORT_LEVELS[supportLevel];
                              if (level) {
                                const newDosages = { ...level.dosages };
                                subs.forEach((id:string) => { const d = (st.dosages||{})[id]; if (d) newDosages[id] = typeof d === 'number' ? { mg: d, timing: '' } : d; });
                                SUPPORT_LEVELS[supportLevel] = { ...level, subs: [...level.subs, ...subs], dosages: newDosages };
                              }
                              alert(`✅ ${subs.length} препаратов добавлено в план`);
                              setFavRefresh(prev => prev + 1);
                            }} style={{ marginTop:4, padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:600 }}>📋 В план</button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                )}

                {/* === PLAN TAB === */}
                {favTab === 'plan' && (
                  <div style={{ padding:'0 0 80px' }}>
                    <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                      <button onClick={() => setPlanSubTab('active')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'active' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'active' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'active' ? 'var(--accent)' : 'var(--border)'}` }}>✅ Действующий план</button>
                      <button onClick={() => setPlanSubTab('myplans')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'myplans' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'myplans' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'myplans' ? 'var(--accent)' : 'var(--border)'}` }}>📋 Мои планы</button>
                      <button onClick={() => setPlanSubTab('archive')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'archive' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'archive' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'archive' ? 'var(--accent)' : 'var(--border)'}` }}>📦 Архив ({archivedPlans.length})</button>
                    </div>

                    {planSubTab === 'active' && (() => {
                      const level = SUPPORT_LEVELS[supportLevel];
                      const subs = level?.subs || [];
                      const dosages = level?.dosages || {};
                      const getInfo = (id: string) => {
                        const sub = catalogSubstances.find(s => s.id === id);
                        const d = dosages[id];
                        return { id, name: sub?.name || id.replace(/_/g, ' '), mg: d?.mg ?? 0, timing: d?.timing || '', desc: sub?.description || '' };
                      };
                      return (
                        <>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>📋 Действующий план поддержки</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Уровень: {level?.label || supportLevel}</div>

                          {/* Action buttons */}
                          <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                            <button onClick={() => {
                              const saved = localStorage.getItem('savedStacks');
                              if (!saved || JSON.parse(saved).length === 0) { alert('Нет сохранённых стеков'); return; }
                              const stacks = JSON.parse(saved);
                              const names = stacks.map((s: any,i: number) => `${i+1}. ${s.name || ''}`).join('\n');
                              const idx = parseInt(prompt(`Выберите стек:\n${names}`) || '-1') - 1;
                              if (idx < 0 || idx >= stacks.length) return;
                              const stack = stacks[idx];
                              const stackSubs = (stack.subs || []).filter((id: string) => !subs.includes(id));
                              if (stackSubs.length === 0) { alert('Все препараты уже в плане'); return; }
                              const newDosages = { ...dosages };
                              (stackSubs || []).forEach((id: string) => {
                                const d = stack.dosages?.[id];
                                if (d) newDosages[id] = typeof d === 'number' ? { mg: d, timing: '' } : d;
                              });
                              SUPPORT_LEVELS[supportLevel] = { ...level, subs: [...subs, ...stackSubs], dosages: newDosages };
                              window.location.reload();
                            }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontWeight:600 }}>📦 Из моих стеков</button>
                            <button onClick={() => {
                              const items = subs.map((id: string) => { const info = getInfo(id); return { id, name: info.name, dose: info.mg, timing: info.timing }; });
                              const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
                              localStorage.setItem('supportCart', JSON.stringify([...existing, ...items]));
                              setCartItems([...cartItems, ...items]);
                              alert('✅ Добавлено в корзину');
                            }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(255,152,0,0.15)', border:'1px solid rgba(255,152,0,0.3)', color:'#ff9800', fontWeight:600 }}>🛒 В корзину</button>
                          </div>

                          {/* Timing table */}
                          {subs.length > 0 && (
                            <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                              <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📋 Таблица приёма</div>
                              <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                                <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                                  <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                                  <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                                  <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                                </tr></thead>
                                <tbody>
                                  {subs.map((id: string) => {
                                    const sub = catalogSubstances.find(s => s.id === id);
                                    const d = dosages[id];
                                    if (!sub || !d) return null;
                                    return (
                                      <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                        <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d.timing || '—'}</td>
                                        <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name || id.replace(/_/g, ' ')}</td>
                                        <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg >= 1000 && id !== 'omega3' ? `${(d.mg/1000).toFixed(d.mg%1000===0?0:1)}г` : `${d.mg}мг`}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {subs.length === 0 && <div style={{ fontSize:10, color:'var(--text-dim)' }}>Нет препаратов в плане. Сначала выполните расчёт в калькуляторе.</div>}

                          {/* Save plan */}
                          <div style={{ display:'flex', gap:6, marginTop:6 }}>
                            <button onClick={() => {
                              const plan = { level:supportLevel, date:new Date().toISOString(), subs, dosages, label:supportLevel||level?.label, budget: supportLevel };
                              const existing = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                              existing.push({ id:Date.now(), date:new Date().toISOString(), plan });
                              localStorage.setItem('he_saved_support_plans', JSON.stringify(existing));
                              setPlanSaved(true);
                            }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:11 }}>💾 Сохранить план</button>
                          </div>
                          {planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}

                          {/* My plans */}
                          {(() => {
                            let savedPlans: any[] = [];
                            try { savedPlans = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]'); } catch {}
                            if (savedPlans.length === 0) return null;
                            return (
                              <div style={{ marginTop:8 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📋 Мои планы</div>
                                {[...savedPlans].reverse().map((sp, i) => {
                                  const p = sp.plan || {};
                                  const pSubs = p.subs || [];
                                  return (
                                    <div key={sp.id || i} style={{ padding:'6px 10px', marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <div>
                                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.levelLabel || 'План'} · {pSubs.length} препаратов</div>
                                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(sp.date).toLocaleDateString('ru-RU')}</div>
                                      </div>
                                      <div style={{ display:'flex', gap:4 }}>
                                        <button onClick={() => {
                                          const lvl = (p.level || 'mid') as 'basic' | 'mid' | 'max' | 'boost';
                                          setSupportLevel(lvl);
                                          calcSupport(lvl, pSubs);
                                          setPlanSaved(`✅ Загружен: ${p.levelLabel || lvl}`);
                                          setTimeout(() => setPlanSaved(''), 3000);
                                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                                        <button onClick={() => {
                                          try {
                                            let saved: any[] = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                                            localStorage.setItem('he_saved_support_plans', JSON.stringify(saved.filter((x:any) => x.id !== sp.id)));
                                            window.location.reload();
                                          } catch {}
                                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </>
                      );
                    })()}

                    {/* Archive */}
                    {planSubTab === 'archive' && (
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>📦 Архив планов</div>
                        {archivedPlans.length === 0 ? (
                          <div style={{ fontSize:10, color:'var(--text-dim)' }}>Архив пуст. При сохранении нового плана старый автоматически перемещается в архив.</div>
                        ) : (
                          [...archivedPlans].reverse().map((plan, idx) => {
                            const planId = `arch_${idx}_${plan.archivedAt || plan.date}`;
                            const isExpanded = expandedArchiveId === planId;
                            const planSubs = plan.subs || [];
                            const planDosages = plan.dosages || {};
                            return (
                              <div key={planId} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                                <div onClick={() => setExpandedArchiveId(isExpanded ? null : planId)} style={{ padding:'8px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                                  <div>
                                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{plan.label || 'План'}</div>
                                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{new Date(plan.archivedAt || plan.date).toLocaleDateString('ru-RU')} · {planSubs.length} препаратов</div>
                                  </div>
                                  <span style={{ fontSize:12, color:'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                                </div>
                                {isExpanded && (
                                  <div style={{ padding:'8px 12px' }}>
                                    {planSubs.length > 0 && (
                                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                                        <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                                        </tr></thead>
                                        <tbody>
                                          {planSubs.map((id: string) => {
                                            const sub = catalogSubstances.find((s: any) => s.id === id);
                                            const d = planDosages[id];
                                            return (
                                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                                <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub?.name || id.replace(/_/g, ' ')}</td>
                                                <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d?.mg ? `${d.mg}мг` : '—'}</td>
                                                <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d?.timing || '—'}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                    <button onClick={() => {
                                      const archive = JSON.parse(localStorage.getItem('supportPlanArchive') || '[]');
                                      const key = [...archivedPlans].reverse()[idx];
                                      const realIdx = archivedPlans.indexOf(key);
                                      if (realIdx >= 0) { archive.splice(realIdx, 1); localStorage.setItem('supportPlanArchive', JSON.stringify(archive)); setArchivedPlans(archive); }
                                    }} style={{ marginTop:6, padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑 Удалить из архива</button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* === MY SAVED PLANS === */}
                {planSubTab === 'myplans' && (
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📋 Мои планы поддержки</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Сохранённые планы с уровнем, составом и рисками. Можно загрузить в калькулятор.</div>
                    {(() => {
                      let myPlans: any[] = [];
                      try { myPlans = JSON.parse(localStorage.getItem('he_my_plans') || '[]'); } catch {}
                      if (myPlans.length === 0) return (
                        <div style={{ padding:24, textAlign:'center' }}>
                          <div style={{ fontSize:24, marginBottom:6 }}>📋</div>
                          <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых планов.</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Выполните расчёт и сохраните его через кнопку «Сохранить план в Мои планы».</div>
                        </div>
                      );
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {[...myPlans].reverse().map((p, i) => (
                            <div key={p.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                <div>
                                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.name}</div>
                                  <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(p.date).toLocaleDateString('ru-RU')} · ур. {p.level} · нед. {p.week}</div>
                                </div>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button onClick={() => {
                                    if (p.level) setSupportLevel(p.level);
                                    if (p.week) setCourseWeekState(p.week);
                                    if (p.boostEnabled !== undefined) setBoostEnabled(p.boostEnabled);
                                    if (p.jointMode !== undefined) setJointMode(p.jointMode);
                                    if (p.enhancedSubs) setEnhancedSubs(p.enhancedSubs);
                                    setPlanSaved('✅ План загружен в калькулятор');
                                    setTimeout(() => setPlanSaved(''), 3000);
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                                  <button onClick={() => {
                                    try {
                                      let arr: any[] = JSON.parse(localStorage.getItem('he_my_plans') || '[]');
                                      localStorage.setItem('he_my_plans', JSON.stringify(arr.filter((x: any) => x.id !== p.id)));
                                      setMyPlansRefresh(prev => prev + 1);
                                    } catch {}
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                                </div>
                              </div>
                              <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                                {p.subs?.length || 0} препаратов · Риск: {Math.round(p.riskBefore)}% → {Math.round(p.riskAfter)}% · Покрытие: {Math.round(p.supportScore)}/100
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* === CALCULATOR SAVED DATA === */}
                {favTab === 'calculator' && (
                  <div style={{ paddingBottom:80 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🧮 Сохранённые расчёты калькулятора</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Здесь хранятся расчёты поддержки — результат + уровень + неделя. Можно загрузить обратно в калькулятор.</div>
                    {(() => {
                      let saved: any[] = [];
                      try { saved = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]'); } catch {}
                      if (saved.length === 0) return (
                        <div style={{ padding:24, textAlign:'center' }}>
                          <div style={{ fontSize:24, marginBottom:6 }}>🧮</div>
                          <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых расчётов.</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Выполните расчёт и сохраните его через кнопку в карточке расчёта.</div>
                        </div>
                      );
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {[...saved].reverse().map((r, i) => (
                            <div key={r.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                <div>
                                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>Уровень: {r.supportLevel || '—'}</div>
                                  <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(r.timestamp || r.date).toLocaleDateString('ru-RU')}</div>
                                </div>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button onClick={() => {
                                    if (r.supportLevel) setSupportLevel(r.supportLevel);
                                    if (r.calcResult) { setCalcResult(r.calcResult); setCalcDone(true); }
                                    if (r.boostEnabled !== undefined) setBoostEnabled(r.boostEnabled);
                                    if (r.jointMode !== undefined) setJointMode(r.jointMode);
                                    if (r.courseWeekState) setCourseWeekState(r.courseWeekState);
                                    if (r.enhancedSubs) setEnhancedSubs(r.enhancedSubs);
                                    setPlanSaved('✅ Расчёт загружен из избранного');
                                    setTimeout(() => setPlanSaved(''), 3000);
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                                  <button onClick={() => {
                                    try {
                                      let arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                                      localStorage.setItem('he_saved_calc_results', JSON.stringify(arr.filter((x: any) => x.id !== r.id)));
                                      setFavRefresh(prev => prev + 1);
                                    } catch {}
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                                </div>
                              </div>
                              {r.calcResult && (
                                <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                                  Риск: {Math.round(r.calcResult.riskBeforeSupport)}% → {Math.round(r.calcResult.riskAfterSupport)}% · Покрытие: {Math.round(r.calcResult.supportScore)}/100
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* === MIXES TAB === */}
                {favTab === 'mixes' && (
                  <div style={{ paddingBottom:80 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🎯 Сохранённые комплекты миксов</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Полные комплекты (пред + интра + пост), сохранённые из калькулятора тренировочных миксов.</div>
                    {(() => {
                      let saved: any[] = [];
                      try { saved = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]').filter((x: any) => x.type === 'mix'); } catch {}
                      if (saved.length === 0) return (
                        <div style={{ padding:24, textAlign:'center' }}>
                          <div style={{ fontSize:24, marginBottom:6 }}>🎯</div>
                          <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых комплектов.</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Соберите микс и нажмите «💾 Комплект» в карточке расчёта.</div>
                        </div>
                      );
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {[...saved].reverse().map((kit: any, i: number) => (
                            <div key={kit.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                <div>
                                  <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>{kit.goal}</div>
                                  <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                                    {kit.workoutType} · {kit.timeOfDay} · {kit.isOnCycle ? 'курс' : 'натурал'}
                                    · {new Date(kit.date).toLocaleDateString('ru-RU')}
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button onClick={() => {
                                    setMixGoals([kit.goal]);
                                    setMixWorkoutType(kit.workoutType);
                                    setMixTimeOfDay(kit.timeOfDay);
                                    setPlanSaved('✅ Комплект загружен, переключите тайминги');
                                    setTimeout(() => setPlanSaved(''), 3000);
                                    setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('mixcalc');
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                                  <button onClick={() => {
                                    try {
                                      let arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                                      localStorage.setItem('he_saved_calc_results', JSON.stringify(arr.filter((x: any) => x.id !== kit.id)));
                                      setFavRefresh(p => p + 1);
                                    } catch {}
                                  }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                                </div>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:7, color:'var(--text-dim)' }}>
                                <div><b style={{color:'#f97316'}}>🔥 Pre:</b> {(kit.pre||[]).length} веществ</div>
                                <div><b style={{color:'#06b6d4'}}>💧 Intra:</b> {(kit.intra||[]).length} веществ</div>
                                <div><b style={{color:'#22c55e'}}>🍗 Post:</b> {(kit.post||[]).length} веществ</div>
                              </div>
                              <div style={{ marginTop:4, fontSize:7, lineHeight:1.3, color:'rgba(255,255,255,0.6)' }}>
                                <div><b>Pre:</b> {(kit.pre||[]).slice(0,5).map((s:any)=>s.name).join(', ')}{(kit.pre||[]).length>5?` +${kit.pre.length-5}`:''}</div>
                                <div><b>Intra:</b> {(kit.intra||[]).slice(0,4).map((s:any)=>s.name).join(', ')}{(kit.intra||[]).length>4?` +${kit.intra.length-4}`:''}</div>
                                <div><b>Post:</b> {(kit.post||[]).slice(0,5).map((s:any)=>s.name).join(', ')}{(kit.post||[]).length>5?` +${kit.post.length-5}`:''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* === REPORTS TAB === */}
                {favTab === 'reports' && (
                  <div style={{ paddingBottom:80 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📊 Отчёты поддержки</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Полный отчёт по рискам, поддержке, взаимодействиям и курсу. Сохраняется в архив.</div>

                    <button onClick={() => {
                      const profile = linked.profile;
                      const course = linked.course || [];
                      const weightKg = profile?.settings?.weight ?? 80;
                      const age = profile?.settings?.age ?? 30;
                      const sex = profile?.settings?.sex ?? 'male';
                      const levelSubIds = SUPPORT_LEVELS[supportLevel]?.subs || [];
                      const planItems = levelSubIds.map((id:string) => {
                        const sub = catalogSubstances.find((s:any) => s.id === id);
                        const dos = { mg:500, timing:'с едой' };
                        return { id, name:sub?.name||id, dose:dos.mg+'мг', timing:dos.timing, categories:sub?.categories||[], mechanisms:sub?.mechanisms||[] };
                      });
                      const report = {
                        id: Date.now().toString(),
                        date: new Date().toISOString(), level:supportLevel, items:planItems,
                        substanceCount: catalogSubstances.length, interactionCount: ALL_INTERACTIONS.length,
                        timestamp: Date.now()
                      };
                      const archive = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]');
                      archive.unshift(report);
                      localStorage.setItem('he_support_reports_archive', JSON.stringify(archive));
                      localStorage.setItem('he_support_report_current', JSON.stringify(report));
                      try { localStorage.setItem('he_support_reports', JSON.stringify(archive.slice(0, 20))); } catch {}
                      try { localStorage.setItem('he_profile_support_reports', JSON.stringify(archive.slice(0, 10))); } catch {}
                      setReportGenerated(true);
                    }} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:11 }}>📊 Сгенерировать отчёт</button>

                    {/* Archive */}
                    {(() => {
                      let archive: any[] = [];
                      try { archive = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]'); } catch {}
                      if (archive.length === 0) return null;
                      return (
                        <div style={{ marginTop:8 }}>
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>Архив отчётов</div>
                          {archive.slice(0,10).map((r, i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontSize:9, color:'var(--text-light)' }}>Отчёт {r.level || ''} · {r.items?.length || 0} препаратов</div>
                                <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(r.date).toLocaleDateString('ru-RU')}</div>
                              </div>
                              <button onClick={() => {
                                try {
                                  const arch: any[] = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]');
                                  const realIdx = arch.findIndex((x: any) => x.id === r.id);
                                  if (realIdx >= 0) { arch.splice(realIdx, 1); localStorage.setItem('he_support_reports_archive', JSON.stringify(arch)); window.location.reload(); }
                                } catch {}
                              }} style={{ padding:'3px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              );
            })}
            {renderView(infoView, 'research', () => (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--accent)',marginBottom:4}}>🔬 Поиск исследований</div>
                  <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:8}}>PubMed, PubChem, Google Scholar, OpenFDA и каталог препаратов</div>

                  {/* Source Pills */}
                  <div style={{display:'flex',gap:4,marginBottom:10,overflowX:'auto',scrollbarWidth:'none',flexShrink:0}}>
                    {([
                      {key:'pubmed',label:'📚 PubMed',color:'#3b82f6'},
                      {key:'pubchem',label:'🧪 PubChem',color:'#8b5cf6'},
                      {key:'scholar',label:'🎓 Scholar',color:'#f59e0b'},
                      {key:'fda',label:'💊 OpenFDA',color:'#ef4444'},
                      {key:'pharma',label:'📋 Каталог',color:'#00e68a'},
                    ] as const).map(s => (
                      <button key={s.key} onClick={() => {setResearchSource(s.key);if(s.key==='pubchem')handlePubchemSearch();if(s.key==='fda')handleFDASearch();}} style={{
                        padding:'7px 14px',borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,
                        background: researchSource===s.key ? s.color : 'var(--bg-secondary)',
                        color: researchSource===s.key ? '#fff' : 'var(--text-dim)',
                        border: `1px solid ${researchSource===s.key ? s.color : 'var(--border)'}`,
                      }}>{s.label}</button>
                    ))}
                  </div>

                  {/* Shared search input */}
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    <input value={pubMedQuery} onChange={e=>setPubMedQuery(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}}
                      placeholder={researchSource==='pubmed'?'creatine muscle, NAC liver...':researchSource==='pubchem'?'caffeine, creatine, NAC...':researchSource==='fda'?'aspirin, metformin...':'Поиск по названию, классу...'}
                      style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                    <button onClick={()=>{if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}
                      disabled={(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)}
                      style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${researchSource==='pubmed'?'#3b82f6,#2563eb':researchSource==='pubchem'?'#8b5cf6,#7c3aed':researchSource==='fda'?'#ef4444,#dc2626':researchSource==='pharma'?'#00e68a,#00c853':'#3b82f6,#2563eb'})`,color:'#fff',fontWeight:700,fontSize:11,opacity:(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)?0.6:1}}>
                      {((researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading))?'⏳':researchSource==='scholar'?'🔗':'🔍'}
                    </button>
                  </div>

                  {/* === PUBMED === */}
                  {researchSource === 'pubmed' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 PubMed — научные статьи</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        <button onClick={()=>{setPubMedQuery('creatine supplementation strength performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Креатин</button>
                        <button onClick={()=>{setPubMedQuery('whey protein muscle hypertrophy');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Протеин</button>
                        <button onClick={()=>{setPubMedQuery('beta-alanine carnosine performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Бета-аланин</button>
                      </div>
                      {pubMedError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubMedError}</div>}
                      {pubMedResults.length>0&&<div style={{fontSize:9,color:'var(--text-dim)',marginBottom:6}}>Найдено: {pubMedResults.length} публикаций</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {pubMedResults.map(a=>(
                          <a key={a.pmid} href={a.url} target="_blank" rel="noopener noreferrer" style={{display:'block',padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)',textDecoration:'none',color:'inherit'}}>
                            <div style={{fontSize:11,fontWeight:600,color:'var(--text-light)',lineHeight:1.3,marginBottom:2}}>{a.title}</div>
                            {a.authors.length > 0 && <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.authors.slice(0, 3).join(', ')}{a.authors.length > 3 ? ' et al.' : ''}</div>}
                            <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.journal}{a.pubDate ? ` · ${a.pubDate}` : ''}</div>
                            {a.abstract&&<div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,marginTop:2,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{a.abstract}</div>}
                          </a>
                        ))}
                        {pubMedResults.length===0&&!pubMedLoading&&!pubMedError&&<div style={{padding:16,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите запрос для поиска публикаций</div>}
                      </div>
                    </div>
                  )}

                  {/* === PUBCHEM === */}
                  {researchSource === 'pubchem' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🧪 PubChem — химическая информация</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Кофеин',q:'caffeine'},{label:'Креатин',q:'creatine'},{label:'L-цитруллин',q:'L-citrulline'},{label:'Таурин',q:'taurine'},{label:'L-тирозин',q:'L-tyrosine'},{label:'Бета-аланин',q:'beta-alanine'}].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handlePubchemSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {pubchemError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubchemError}</div>}
                      {pubchemLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в PubChem...</div>}
                      {pubchemResults.map((r,i)=>(
                        <div key={i} style={{padding:'10px 12px',borderRadius:10,background:'var(--bg-secondary)',border:'1px solid var(--border)',marginBottom:8}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#8b5cf6',marginBottom:4}}>{r.name}</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:9,color:'var(--text-dim)'}}>
                            <div><b>Формула:</b> {r.formula}</div>
                            <div><b>Мол. масса:</b> {typeof r.mw === 'number' ? r.mw.toFixed(2) + ' г/моль' : r.mw}</div>
                            <div style={{gridColumn:'1/-1'}}><b>IUPAC:</b> {r.iupac}</div>
                          </div>
                        </div>
                      ))}
                      {pubchemResults.length===0&&!pubchemLoading&&!pubchemError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название соединения (на английском) и нажмите 🔍</div>}
                    </div>
                  )}

                  {/* === GOOGLE SCHOLAR === */}
                  {researchSource === 'scholar' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🎓 Google Scholar — научные публикации</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[
                          {label:'Тестостерон и гипертрофия',q:'тестостерон мышечная гипертрофия'},
                          {label:'NAC гепатопротекция',q:'NAC гепатопротекция печень'},
                          {label:'Омега-3 кардио',q:'омега-3 сердечно-сосудистая система'},
                          {label:'Креатин сила',q:'креатин силовые показатели'},
                          {label:'Метформин anti-aging',q:'metformin anti-aging longevity'},
                          {label:'Витамин D спортсмены',q:'витамин D спортсмены дефицит'},
                        ].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:8}}>Поиск откроется в новой вкладке Google Scholar</div>
                      <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(pubMedQuery)}`} target="_blank" rel="noopener noreferrer"
                        style={{display:'inline-block',padding:'10px 20px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#000',fontWeight:700,fontSize:12,textDecoration:'none',textAlign:'center'}}>
                        🎓 Искать в Google Scholar: {pubMedQuery || '(введите запрос)'}
                      </a>
                    </div>
                  )}

                  {/* === OPENFDA === */}
                  {researchSource === 'fda' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 OpenFDA — официальные инструкции препаратов</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Аспирин',q:'aspirin'},{label:'Метформин',q:'metformin'},{label:'Тестостерон',q:'testosterone'},{label:'Тамоксифен',q:'tamoxifen'},{label:'Кломифен',q:'clomiphene'}].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handleFDASearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {fdaError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {fdaError}</div>}
                      {fdaLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в OpenFDA...</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {fdaResults.map((r,i)=>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#ef4444',marginBottom:2}}>{r.brandName}</div>
                            <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:2}}>{r.genericName}</div>
                            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{r.indications}</div>
                            {r.manufacturer !== '—' && <div style={{fontSize:8,color:'var(--text-dim)',marginTop:2}}>Производитель: {r.manufacturer}</div>}
                          </div>
                        ))}
                        {fdaResults.length===0&&!fdaLoading&&!fdaError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название препарата (на английском) и нажмите 🔍</div>}
                      </div>
                    </div>
                  )}

                  {/* === PHARMA CATALOG SEARCH === */}
                  {researchSource === 'pharma' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 Поиск препаратов и добавок</h4>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        <input value={pharmaSearchQ} onChange={e=>doPharmaSearch(e.target.value)}
                          placeholder="Поиск по названию, классу или категории..."
                          style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:300,overflowY:'auto'}}>
                        {pharmaSearchResults.map(r=>(
                          <div key={r.id} style={{padding:'6px 10px',borderRadius:6,background:r.cls==='supplement'?'rgba(0,230,138,0.04)':'rgba(139,92,246,0.04)',border:`1px solid ${r.cls==='supplement'?'rgba(0,230,138,0.15)':'rgba(139,92,246,0.15)'}`,cursor:'pointer',fontSize:10}} onClick={()=>{
                            if(PHARMA_DB[r.id]) { setTab('catalog' as any); }
                          }}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontWeight:600,color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.name}</span>
                              <span style={{fontSize:8,padding:'1px 5px',borderRadius:4,background:r.cls==='supplement'?'rgba(0,230,138,0.1)':'rgba(139,92,246,0.1)',color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.cls}</span>
                            </div>
                            {r.desc&&<div style={{fontSize:8,color:'var(--text-dim)',marginTop:2,lineHeight:1.3}}>{r.desc}</div>}
                          </div>
                        ))}
                        {pharmaSearchResults.length===0&&pharmaSearchQ.length>2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Ничего не найдено</div>}
                        {pharmaSearchQ.length<=2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите минимум 3 символа</div>}
                      </div>
                    </div>
                  )}

                  {/* Quick Research Links — expanded Russian presets */}
                  <div className="card" style={{marginBottom:12}}>
                    <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 Быстрый поиск по темам</h4>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {[
                        {label:'Тестостерон и мышечная масса',q:'testosterone muscle mass hypertrophy'},
                        {label:'NAC и печень',q:'NAC liver hepatoprotection'},
                        {label:'Омега-3 и сердце',q:'omega-3 cardiovascular protection'},
                        {label:'Тренболон токсичность',q:'trenbolone cardiotoxicity hepatotoxicity'},
                        {label:'Креатин эффективность',q:'creatine supplementation strength performance'},
                        {label:'Витамин D и тестостерон',q:'vitamin D testosterone men'},
                        {label:'Ашваганда кортизол',q:'ashwagandha cortisol stress'},
                        {label:'BPC-157 заживление',q:'BPC-157 tendon healing angiogenesis'},
                        {label:'Селен и щитовидная',q:'selenium thyroid function'},
                        {label:'Коэнзим Q10 сердце',q:'coenzyme Q10 heart failure cardioprotection'},
                        {label:'Сон и мелатонин',q:'melatonin sleep quality circadian'},
                        {label:'Куркумин воспаление',q:'curcumin inflammation NF-kB'},
                        {label:'Бета-аланин выносливость',q:'beta-alanine carnosine endurance performance'},
                        {label:'Цитруллин и NO',q:'citrulline malate nitric oxide blood flow'},
                        {label:'Магний и сон',q:'magnesium glycinate sleep quality anxiety'},
                        {label:'Цинк и иммунитет',q:'zinc supplementation immune function testosterone'},
                        {label:'L-карнитин жиросжигание',q:'L-carnitine fat oxidation exercise performance'},
                        {label:'HMB и катаболизм',q:'HMB beta-hydroxy beta-methylbutyrate muscle protein breakdown'},
                        {label:'Глютамин и кишечник',q:'glutamine intestinal permeability gut health'},
                        {label:'Коллаген и суставы',q:'collagen peptides joint pain osteoarthritis'},
                      ].map(preset=>(
                        <button key={preset.q} onClick={()=>{setPubMedQuery(preset.q);handlePubMedSearch();}} style={{padding:'5px 10px',borderRadius:6,fontSize:9,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{preset.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {renderView(infoView, 'biostack', () =>
              <div style={{ padding: '0 4px' }}>
                <BioStackAIScreen />
              </div>
            )}

          </div>
        </div>
      )}

      {/* ===== INFO: КАК РАБОТАЕТ ПОДБОР ПОДДЕРЖКИ ===== */}
      {genTab === 'info' && section === 'generator' && (<InfoErrorBoundary label="Генератор — как работает">
        <div style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 16px' }}>📖 Калькулятор поддержки v4 — методология</h2>

          <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.6 }}>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>1. Сбор данных — 21 карточка + профиль + курс + анализы</h3>
              <p style={{ margin:'0 0 6px' }}>Калькулятор собирает данные из 4 источников:</p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>AutoCalculator (21 карточка):</b> профиль, неврология, фарма-стек, цели, гепатобилиарная, мочевыделительная, ССС, ОДА, питание, противопоказания, токсическая нагрузка, стоматология, генетика (MTHFR, CYP19A1, SRD5A2, AR), ЖКТ, психология, инъекции, эпикриз, журнал, лаборатория</li>
                <li><b>Профиль пользователя:</b> вес, возраст, пол, тренировки, сон, стресс — из he_user_profile</li>
                <li><b>Курс ААС:</b> препараты, дозы, длительность — из PHARMA_DB с linkedRisks, cvProfile, pd</li>
                <li><b>Анализы (80+ маркеров):</b> АЛТ, АСТ, ЛПНП, гематокрит, эстрадиол и др. — из linked.labs + LAB_MARKER_MAP</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>2. Расчёт рисков — 17 функций по 8 системам</h3>
              <p style={{ margin:'0 0 6px' }}>Для каждой из 8 систем организма вычисляется риск по формуле:</p>
              <p style={{ margin:'0 0 4px', fontSize:9, fontFamily:'monospace', background:'rgba(0,0,0,0.2)', padding:'4px 8px', borderRadius:6 }}>
                Risk<sub>sys</sub> = Σ rProfile + rNeuro + rPharma + rGoals + rHepatic + rRenal + rCardio + rODA + rContraind + rEpicrisis + rToxic + rGenetics + rPsych + rNutrition
              </p>
              <p style={{ margin:'4px 0 0' }}>Каждая функция учитывает специфические факторы:</p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>rPharma:</b> использует данные PHARMA_DB — linkedRisks (сила×направление), cvProfile (АД/ЧСС/тромбоз/ЦНС), pd (гепатотоксичность, нейротоксичность, липиды, HCT)</li>
                <li><b>rLabs:</b> сверяет 80+ маркеров с LAB_MARKER_MAP — отклонения умножают риск системы</li>
                <li><b>rProfile:</b> возраст, ИМТ, % жира, курение, алкоголь, кофеин, тренировочный объём</li>
              </ul>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Общий риск = max × 0.6 + avg × 0.4 — пиковые риски доминируют (печень 65% не размывается средним).</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>3. Подбор веществ — авто-индексатор (133 механизма × 621 код)</h3>
              <p style={{ margin:'0 0 6px' }}>Цепочка: Риск системы → Активация механизмов → Поиск веществ через авто-индексатор:</p>
              <ol style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Пороговая активация:</b> система с риском ≥ порога (База:15%, Средний:10%, Максимум:6%, Буст:4%) активирует свои механизмы</li>
                <li><b>Авто-индексатор (mechanism-code-bridge.ts):</b> 133 bridge-ключа → 621 код каталога → поиск ВСЕХ веществ с matching mechanisms[]</li>
                <li><b>Ранжирование:</b> tier-приоритет (core &gt; standard &gt; advanced) + синергия с уже выбранными + bestForCourse</li>
                <li><b>Фильтрация:</b> исключение по противопоказаниям, конфликтам и чёрному списку</li>
              </ol>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>При добавлении нового вещества в SUPPORT_CATALOG_DATA с полем mechanisms[] — оно автоматически обнаруживается без ручного маппинга.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>4. Уровни покрытия</h3>
              <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', margin:'4px 0' }}>
                <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}><th style={{ padding:'4px 6px', textAlign:'left' }}>Уровень</th><th style={{ padding:'4px 6px' }}>Порог</th><th style={{ padding:'4px 6px' }}>Вещ/мех</th><th style={{ padding:'4px 6px' }}>Базовая защита</th><th style={{ padding:'4px 6px' }}>Макс. защита</th></tr></thead>
                <tbody>
                  <tr><td style={{ padding:'4px 6px' }}>🟢 База</td><td style={{ padding:'4px 6px', textAlign:'center' }}>15%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>1</td><td style={{ padding:'4px 6px', textAlign:'center' }}>30%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>45%</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>🟡 Средний</td><td style={{ padding:'4px 6px', textAlign:'center' }}>10%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>1</td><td style={{ padding:'4px 6px', textAlign:'center' }}>45%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>60%</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>🔴 Максимум</td><td style={{ padding:'4px 6px', textAlign:'center' }}>6%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>2</td><td style={{ padding:'4px 6px', textAlign:'center' }}>60%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>75%</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>💎 Буст</td><td style={{ padding:'4px 6px', textAlign:'center' }}>4%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>3</td><td style={{ padding:'4px 6px', textAlign:'center' }}>70%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>85%</td></tr>
                </tbody>
              </table>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Защита = базовая + покрытие механизмов × бонус. Потолок 85%.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>5. Синергии, стеки и конфликты</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Синергии:</b> вещества с документированными синергиями (SUPPORT_CATALOG_DATA.synergies) получают приоритет при ранжировании</li>
                <li><b>Стеки (52):</b> готовые комбинации с mechanismCodes[] оцениваются по покрытию × synergyScore. Стек с рейтингом ≥70 и синергией ≥80 применяется автоматически</li>
                <li><b>Мг/кг дозировки:</b> NAC 15 мг/кг, TUDCA 10 мг/кг, CoQ10 2 мг/кг, Омега-3 30 мг/кг — 70% по весу + 30% фиксированная</li>
                <li><b>Понедельное титрование:</b> нед.1-2=60%, 3-4=80%, 5-6=90%, 7+=100%. Фарма-препараты: 50%/75%/100%</li>
                <li><b>Конфликты:</b> детектор проверяет все пары через SUPPORT_CATALOG_DATA.conflicts — показывает severity (HIGH/MEDIUM/LOW)</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>6. Персонализация</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Генетика:</b> MTHFR C677T → 5-MTHF + B12; CYP19A1 ↑ → DIM; SRD5A2 ↑ → пальма сереноа; AR ↑/↓ → коррекция</li>
                <li><b>Фаза цикла:</b> 💉Курс / 🌉Мост / 🔄ПКТ / ⚧Фертильность — разные составы поддержки</li>
                <li><b>Лаб-данные:</b> отклонения маркеров → авто-добавление корректирующих веществ (Средний+)</li>
                <li><b>Противопоказания:</b> вещества конфликтующие с заболеваниями пользователя исключаются</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>7. Результат — что вы получаете</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>📊 Покрытие рисков:</b> прогресс-бар с риском до/после, недельным масштабом доз</li>
                <li><b>📋 План по времени:</b> таблица Утро/День/Вечер с тирами и дозировками</li>
                <li><b>🔍 Попап вещества:</b> полная карточка (механизм, формы, побочные, мониторинг, синергии, дозировка)</li>
                <li><b>⚡ Синергии:</b> описание синергетических связей в стеке с клиническим обоснованием</li>
                <li><b>⚠️ Конфликты:</b> предупреждения о несовместимых парах</li>
                <li><b>📈 Динамика рисков:</b> бары до/после по 8 системам</li>
                <li><b>🔬 Лаб-находки:</b> отклонения анализов с рекомендованными веществами</li>
                <li><b>🧩 Стеки:</b> рекомендованные комбинации с рейтингом и кнопкой «+ В план»</li>
                <li><b>📅 Таймлайн доз:</b> таблица дозировок по неделям 1→12</li>
                <li><b>👨‍⚕️ Заключение:</b> структурированный отчёт для врача</li>
                <li><b>💾 Сохранение:</b> в Мои планы с проверкой дубликатов, копирование заключения</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важно</h3>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом с учётом индивидуальных особенностей.</p>
              <p style={{ margin:'0', fontSize:9, lineHeight:1.3 }}><b>Без лабораторных данных</b> система использует консервативные оценки. Для точного подбора необходимы свежие анализы.</p>
            </div>

          </div>
        </div>
      </InfoErrorBoundary>)}

      {section === 'protocols' && (
        <div style={{ padding:'0 0 12px' }}>
          {/* Warning card — важные замечания */}
          <div style={{ borderRadius:12, padding:14, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:8 }}>
            <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важные замечания</h3>
            <div style={{ margin:0 }}>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом или профильным специалистом с учётом индивидуальных особенностей: возраста, веса, генетических полиморфизмов (MTHFR, COMT, CYP), сопутствующих заболеваний и принимаемых лекарств.</p>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Без лабораторных данных</b> система использует среднестатистические риски по курсу. Для точного подбора необходимы свежие анализы (не старше 3 месяцев).</p>
              <p style={{ margin:0, fontSize:9, lineHeight:1.3 }}><b>Противопоказания:</b> некоторые вещества несовместимы с определёнными заболеваниями или лекарствами. Если вы принимаете варфарин, антидепрессанты, антипсихотики, антигипертензивные — проконсультируйтесь со специалистом.</p>
            </div>
          </div>
          {/* Unified protocol sub-tab pills (6 protocols — peptides removed) */}
          <div style={{ display:'flex', gap:4, padding:'4px 0 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['pct','ПКТ','#8b5cf6'],['fertility','Фертильность','#ec4899'],['hrt','ГЗТ','#f59e0b'],['neuro','Нейро','#06b6d4'],['joints','Суставы','#22c55e'],['acne','Акне','#ef4444']].map(([id,label,color]) => (
              <button key={id} onClick={() => setProtocolTab(id as any)} style={{
                padding:'7px 16px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: protocolTab === id ? color : 'var(--bg-secondary)',
                color: protocolTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (protocolTab === id ? color : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>

          {/* Content: PCT / Fertility / HRT → FertilityPCTScreen */}
          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <InfoErrorBoundary label="Протоколы ПКТ/Фертильность/HRT">
              <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
            </InfoErrorBoundary>
          )}

          {/* Content: Neuro → full enhanced (inline, full-screen level) */}
          {protocolTab === 'neuro' && (<InfoErrorBoundary label="Нейропротекция">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧠 Нейротоксичность ААС</div>
              <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Механизмы нейротоксичности, калькулятор риска и многоуровневый протокол нейропротекции.</p>
              <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Симптомы и механизмы' },
                  { id:'support', label:'💊 Протокол' },
                ].map(t => (
                  <button key={t.id} onClick={() => setNeuroTab(t.id as any)} style={{
                    padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                    background: neuroTab === t.id ? '#ec4899' : 'var(--bg-secondary)',
                    color: neuroTab === t.id ? '#000' : 'var(--text-dim)',
                    border: '1px solid ' + (neuroTab === t.id ? '#ec4899' : 'var(--border)'),
                  }}>{t.label}</button>
                ))}
              </div>
              {neuroTab === 'mechanisms' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧠 Фундаментальные механизмы</div>
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>🔬 Гематоэнцефалический барьер (ГЭБ)</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>Стероиды свободно проникают через ГЭБ. При супрафизиологических дозах ААС — нейротоксический каскад через повышение проницаемости (подавление клаудинов-5).</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>🎯 Андрогенные и эстрогенные рецепторы мозга</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>AR-гиперстимуляция → окислительный стресс нейронов. ER-опосредованная нейропротекция утрачена при подавлении ароматазы.</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>⚡ Негормональные механизмы</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>ГАМК-подавление, NMDA-эксайтотоксичность, митохондриальная дисфункция, BDNF-подавление, ионные каналы Ca²⁺.</div>
                    </div>
                  </div>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🔬 Детальные механизмы</div>
                    {[
                      { title:'ГАМК-ергическая дисфункция', desc:'ААС повышают ГАМК-ергический тормозной тон через нейростероиды → подавление ГнРГ. Дисрегуляция GABA-A вызывает тревожность, депрессию при отмене.' },
                      { title:'Окислительный стресс', desc:'Истощение глутатиона в гиппокампе, перекисное окисление липидов. Супероксид-дисмутаза снижена при нандролоне и станозололе.' },
                      { title:'Нейровоспаление', desc:'Активация микроглии через TLR4 → TNF-α, IL-1β, IL-6. NF-κB путь активирован. Хроническое воспаление в гиппокампе.' },
                      { title:'BDNF подавление', desc:'Нандролон и станозолол снижают BDNF на 30-50%. Нарушение CREB-BDNF-TrkB каскада → атрофия дендритных шипиков.' },
                      { title:'Глутаматная эксайтотоксичность', desc:'ААС повышают глутамат → NMDA-рецепторы → Ca²⁺ influx → митохондриальная дисфункция → апоптоз.' },
                      { title:'Нарушение ГЭБ', desc:'Тренболон накапливается в гиппокампе, повышая проницаемость. Нарушение окклюдина, клаудина-5.' },
                      { title:'Апоптоз нейронов', desc:'Каспаза-3 в CA1/CA3 гиппокампа. Фрагментация ДНК. Сдвиг Bax/Bcl-2 в проапоптотический путь.' },
                      { title:'Дофаминовая система', desc:'Изменение D2-рецепторов в стриатуме → ангедония, агрессия. Мезокортикальный путь нарушен.' },
                    ].map((m,i)=>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#f472b6', marginBottom:2 }}>{m.title}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  {/* Classification */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>⚠️ Классификация нейротоксичности ААС</div>
                    {[
                      { name:'Тренболон', score:10, color:'#ef4444', desc:'ГЭБ + окисл. стресс + глутамат' },
                      { name:'Нандролон', score:8, color:'#ef4444', desc:'BDNF подавление, нейровоспаление' },
                      { name:'Станозолол', score:7, color:'#f97316', desc:'ГАМК-дисфункция, BDNF ↓' },
                      { name:'Метандиенон', score:6, color:'#f97316', desc:'Эстрогеновая активность' },
                      { name:'Болденон', score:5, color:'#f59e0b', desc:'Гематокрит → гипоксия мозга' },
                      { name:'Тестостерон (>500 мг)', score:4, color:'#f59e0b', desc:'AR-гиперстимуляция' },
                      { name:'Оксандролон', score:3, color:'#22c55e', desc:'Низкая андрогенность' },
                      { name:'Мастерон', score:3, color:'#22c55e', desc:'DHT-нейростероиды' },
                      { name:'Примоболан', score:2, color:'#22c55e', desc:'Мин. нейротоксичность' },
                    ].map((drug,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:8, color:'var(--text-light)' }}>{drug.name}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', maxWidth:100, textAlign:'right', lineHeight:1.1 }}>{drug.desc}</span>
                        <span style={{ fontSize:9, fontWeight:800, color:drug.color, width:24, textAlign:'center' }}>{drug.score}</span>
                        <div style={{ width:50, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                          <div style={{ width:drug.score*10+'%', height:'100%', borderRadius:2, background:drug.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Symptoms reference — from old calculator */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:10, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🩺 Симптомы нейротоксичности</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>При появлении любых из этих симптомов на курсе ААС — немедленно подключите нейропротекцию (вкладка "Протокол") и рассмотрите снижение доз.</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {['Депрессия','Тревожность','Агрессия','Нарушение сна','Когнитивное снижение','Потеря памяти','Ангедония','Импульсивность','Спутанность сознания','Эмоц. нестабильность'].map((s,i)=>(<span key={i} style={{fontSize:8,padding:'4px 8px',borderRadius:10,background:'rgba(239,68,68,0.08)',color:'#fca5a5',border:'1px solid rgba(239,68,68,0.15)'}}>⚠ {s}</span>))}
                    </div>
                  </div>
                  {/* Monitoring — from old calculator */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📊 Мониторинг нейротоксичности</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Регулярный лабораторный контроль позволяет выявить нейротоксические изменения на ранней стадии.</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {[
                        { label:'BDNF (нейротрофический фактор мозга)', desc:'Маркер нейропластичности', target:'> 20 нг/мл' },
                        { label:'Нейропсихологическая оценка', desc:'Тесты памяти, внимания, скорости реакции', target:'Каждые 3-6 мес' },
                        { label:'Кортизол (утренний)', desc:'Гиперкортизолемия усугубляет нейротоксичность', target:'10-20 мкг/дл' },
                        { label:'Пролактин', desc:'Гиперпролактинемия → депрессия, ангедония', target:'< 15 нг/мл' },
                      ].map((m,i)=>(
                        <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{m.label}</span>
                            <span style={{ fontSize:8, fontWeight:600, color:'#60a5fa' }}>{m.target}</span>
                          </div>
                          <div style={{ fontSize:8, color:'var(--text-dim)' }}>{m.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {neuroTab === 'support' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>💊 Многоуровневая нейропротекция</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Начинайте с ядра, добавляйте уровни по мере повышения риска.</p>
                    {[
                      { tier:'ЯДРО', label:'Обязательно всем на курсе', color:'#22c55e', items:[
                        { name:'NAC', dose:'1200-2400 мг/день', note:'Предшественник глутатиона, защита нейронов от окислительного стресса' },
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Нейропротекция через резолвины, антивоспалительное, поддержка мембран' },
                        { name:'Magnesium L-Threonate', dose:'1000-2000 мг/день', note:'Единственная форма Mg через ГЭБ, NMDA-модуляция' },
                        { name:'Таурин', dose:'2-3 г/день', note:'ГАМК-агонист, осморегуляция нейронов, анти-эксайтотоксичность' },
                        { name:'Глицин', dose:'3 г/день', note:'Тормозной нейромедиатор, улучшение сна, модуляция NMDA' },
                      ]},
                      { tier:'БАЗА', label:'При дозах >500 мг/нед', color:'#f59e0b', items:[
                        { name:'Alpha-Lipoic Acid (ALA)', dose:'600 мг/день', note:'Митохондриальный антиоксидант, регенерирует глутатион и вит.C/E' },
                        { name:'CoQ10 (убихинол)', dose:'200-400 мг/день', note:'ЭТЦ митохондрий, снижение перекисного окисления нейронов' },
                        { name:'Pregnenolone', dose:'10-30 мг/день', note:'Нейростероид, восполняет подавленный синтез, улучшает когницию' },
                        { name:'Агмантин', dose:'1-2 г/день', note:'Модулятор NMDA, NO-донатор, нейропротекция через полиамины' },
                        { name:'Альфа-GPC', dose:'300-600 мг/день', note:'Высокобиодоступный холин, синтез ацетилхолина' },
                      ]},
                      { tier:'УСИЛЕНИЕ', label:'При тренболоне/нандролоне', color:'#f97316', items:[
                        { name:'Lion\'s Mane (ежовик)', dose:'1-3 г/день', note:'Стимуляция NGF, нейрогенез в гиппокампе, миелинизация' },
                        { name:'DHEA', dose:'25-50 мг/день', note:'Нейростероид, восстановление GABA-A модуляции, снижение депрессии' },
                        { name:'Phosphatidylserine', dose:'300-600 мг/день', note:'Фосфолипид мембран, поддержка текучести, снижение кортизола' },
                        { name:'Ginkgo Biloba', dose:'120-240 мг/день', note:'Церебральный кровоток, антиоксидант, ингибитор PAF' },
                        { name:'Бромантан', dose:'50-100 мг/день', note:'Актопротектор, нейропротекция, повышение работоспособности' },
                        { name:'Фасорацетам', dose:'100-200 мг/день', note:'AMPA-модулятор, регуляция глутамата, улучшение памяти' },
                        { name:'Гуперзин А', dose:'50-100 мкг/день', note:'Ингибитор ацетилхолинэстеразы, повышение ацетилхолина' },
                      ]},
                      { tier:'МАКСИМУМ', label:'При нейросимптомах', color:'#ef4444', items:[
                        { name:'Bacopa Monnieri', dose:'300-600 мг/день', note:'Улучшение памяти, дендритное ветвление, антиоксидант' },
                        { name:'L-Theanine', dose:'200-400 мг/день', note:'ГАМК-модуляция, повышение альфа-волн, снижение тревоги' },
                        { name:'Citicoline', dose:'500-1000 мг/день', note:'Цитидин+холин, синтез ацетилхолина, стабилизация мембран' },
                        { name:'Noopept', dose:'10-30 мг/день', note:'Повышение BDNF и NGF, улучшение памяти и когниций' },
                        { name:'Семакс', dose:'1-3 мг/день', note:'Нейропептид, повышение BDNF, нейрогенез, ноотроп' },
                        { name:'Кортексин', dose:'10 мг/день', note:'Полипептиды коры мозга, нейропротекция, нейрорепарация' },
                      ]},
                    ].map((tier,ti)=>(
                      <div key={ti} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:tier.color+'0a', border:'1px solid '+tier.color+'22' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                          <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:tier.color+'22', color:tier.color }}>{tier.tier}</span>
                          <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                        </div>
                        {tier.items.map((item,ii)=>(
                          <div key={ii} style={{ padding:'4px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                              <span style={{ fontSize:8, fontWeight:700, color:tier.color }}>{item.dose}</span>
                            </div>
                            <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{item.note}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          {/* Content: Joints → full enhanced (inline, full-screen level) */}
          {protocolTab === 'joints' && (<InfoErrorBoundary label="Суставы">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🦴 Калькулятор суставов и связок</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Оценка риска суставной патологии и многоуровневая поддержка хрящевой и соединительной ткани.</p>
                {/* Risk Inputs */}
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🦵 Боль в суставах</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{jointPain}/10</span>
                    </div>
                    <input type="range" min="0" max="10" value={jointPain} onChange={e=>setJointPain(Number(e.target.value))} style={{ width:'100%', accentColor:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Нет боли</span><span>Умеренная</span><span>Сильная</span></div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🏥 Травмы в анамнезе</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{injuryHistory}/5</span>
                    </div>
                    <input type="range" min="0" max="5" value={injuryHistory} onChange={e=>setInjuryHistory(Number(e.target.value))} style={{ width:'100%', accentColor:'#f59e0b' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Нет</span><span>Растяжения</span><span>Разрывы</span></div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🏋️ Тренировочная нагрузка</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{trainLoad}/5</span>
                    </div>
                    <input type="range" min="0" max="5" value={trainLoad} onChange={e=>setTrainLoad(Number(e.target.value))} style={{ width:'100%', accentColor:'#f97316' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Лёгкая</span><span>Умеренная</span><span>Тяжёлые веса</span></div>
                  </div>
                </div>
                {/* Score */}
                <div style={{ background: (jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'18', borderRadius:12, padding:12, marginBottom:8, border:'2px solid '+(jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'44', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
                  <div style={{ fontSize:32, fontWeight:800, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', lineHeight:1 }}>{jointScore}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', marginTop:2 }}>{jointScore<20?'🟢 Норма':jointScore<40?'🟡 Умеренный':jointScore<60?'🟠 Высокий':'🔴 Критический'}</div>
                  <div style={{ marginTop:6, height:4, borderRadius:2, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                    <div style={{ width:jointScore+'%', height:'100%', borderRadius:2, background:'linear-gradient(90deg, #22c55e, #f59e0b 40%, #f97316 60%, #ef4444)', transition:'width 0.5s' }} />
                  </div>
                </div>
                {/* Required Analyses */}
                <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:8, marginBottom:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>🧪 Рекомендуемые анализы</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {[
                      { name:'Ревматоидный фактор (RF)', range:'< 14 МЕ/мл' },
                      { name:'С-реактивный белок (CRP)', range:'< 3 мг/л' },
                      { name:'Мочевая кислота', range:'200-420 мкмоль/л' },
                      { name:'25-OH Витамин D', range:'50-80 нг/мл' },
                      { name:'Кальций общий', range:'2.15-2.55 ммоль/л' },
                      { name:'Антитела к коллагену II типа', range:'< 20 ЕД/мл' },
                    ].map((a,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                        <span style={{ color:'var(--text-light)' }}>{a.name}</span>
                        <span style={{ fontWeight:600, color:'#60a5fa' }}>{a.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Imaging */}
                <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:8, marginBottom:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:4 }}>🔬 Инструментальные исследования</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {[
                      { name:'УЗИ суставов (B-режим)', purpose:'Выпот, синовит, эрозии', when:'Боль/отёк ≥2 нед' },
                      { name:'МРТ сустава', purpose:'Хрящ, мениски, связки', when:'Боль >4 нед' },
                      { name:'Рентгенография', purpose:'Суставная щель, остеофиты', when:'Перелом/остеоартрит' },
                    ].map((e,i)=>(
                      <div key={i} style={{ padding:'4px 6px', borderRadius:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                        <span style={{ fontWeight:600, color:'#a855f7' }}>{e.name}</span>
                        <span style={{ color:'var(--text-dim)', marginLeft:4 }}>— {e.purpose}</span>
                        <div style={{ fontSize:7, color:'#a855f7', opacity:0.7 }}>Показание: {e.when}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Multi-tier protocol */}
                <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', marginBottom:4 }}>💊 Многоуровневая поддержка суставов</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Эскалационный протокол: начните с ядра, добавляйте уровни пропорционально риску.</p>
                {[
                  { tier:'ЯДРО', label:'Обязательный минимум', color:'#22c55e', items:[
                    { name:'Коллаген II типа (UC-II)', dose:'40 мг/день', note:'Нативный неденатурированный коллаген, оральная толерантность' },
                    { name:'Витамин C', dose:'500-1000 мг/день', note:'Кофактор синтеза коллагена, гидроксилирование пролина' },
                    { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг/день', note:'Кальциевый обмен, минерализация костной ткани' },
                  ]},
                  { tier:'БАЗА', label:'При умеренном риске', color:'#f59e0b', items:[
                    { name:'Глюкозамин сульфат', dose:'1500 мг/день', note:'Субстрат гликозаминогликанов, стимуляция протеогликанов' },
                    { name:'Хондроитин сульфат', dose:'800-1200 мг/день', note:'Ингибирование MMP-3/13, удержание воды в матриксе' },
                    { name:'MSM', dose:'2000-3000 мг/день', note:'Органическая сера, дисульфидные мостики коллагена' },
                    { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Резолвины, разрешение воспаления в синовиальной жидкости' },
                  ]},
                  { tier:'УСИЛЕНИЕ', label:'При высоком риске', color:'#f97316', items:[
                    { name:'Гиалуроновая кислота', dose:'200-300 мг/день', note:'Синовиальная жидкость, вязкоэластичность, смазка' },
                    { name:'Куркумин + пиперин', dose:'500-1000 мг/день', note:'Ингибирование COX-2, NF-kB, снижение IL-1beta' },
                    { name:'Босвеллия (AKBA)', dose:'300-500 мг/день', note:'Ингибирование 5-липоксигеназы, снижение лейкотриенов' },
                  ]},
                  { tier:'МАКСИМУМ', label:'При критическом риске', color:'#ef4444', items:[
                    { name:'BPC-157', dose:'250-500 мкг/день', note:'Заживление сухожилий/связок, ангиогенез через VEGF' },
                    { name:'TB-500', dose:'2.5-5 мг/нед', note:'Полимеризация актина, миграция клеток, регенерация' },
                    { name:'Секретагоги ГР', dose:'100-300 мкг/день', note:'Пульсирующая секреция ГР, регенерация хряща' },
                  ]},
                ].map((tier,ti)=>(
                  <div key={ti} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:tier.color+'0a', border:'1px solid '+tier.color+'22' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                      <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:tier.color+'22', color:tier.color }}>{tier.tier}</span>
                      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                    </div>
                    {tier.items.map((item,ii)=>(
                      <div key={ii} style={{ padding:'4px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, color:tier.color }}>{item.dose}</span>
                        </div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </InfoErrorBoundary>)}

          {/* Content: Acne → full enhanced (inline, full-screen level) */}
          {protocolTab === 'acne' && (<InfoErrorBoundary label="Акне">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:4 }}>🔴 Анти-прыщ протокол</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Протокол борьбы с акне на курсе ААС: системная и локальная терапия.</p>
                {/* Daily protocol */}
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)', marginBottom:4 }}>⚙️ Ежедневный протокол</div>
                {[
                  { n:'Ниацинамид (Витамин B3)', d:'500-1000 мг', t:'На ночь', note:'Регулирует себум, антивоспалительное, уменьшает покраснения' },
                  { n:'Медь', d:'1-2 мг', t:'На ночь (отдельно от цинка)', note:'Кофактор лизил-оксидазы, сшивка коллагена. Не смешивать с цинком.' },
                  { n:'Цинк (пиколинат)', d:'50 мг', t:'На ночь', note:'Антивоспалительное, антибактериальное, ингибирует 5-альфа-редуктазу' },
                  { n:'Солярий', d:'2 раза/нед × 5 мин', t:'День', note:'UV-B подсушивает акне. Не более 5 минут.' },
                  { n:'Клендовит гель', d:'Тонкий слой', t:'Утро локально', note:'Клиндамицин+адапален. Только на зону акне.' },
                  { n:'Клензит-С', d:'Тонкий слой', t:'На ночь локально', note:'Адапален (ретиноид) + клиндамицин, открывает комедоны.' },
                  { n:'Верошпирон (Спиронолактон)', d:'50 мг', t:'Утро', note:'Антиандроген. Только при гормональном акне. Контроль калия!' },
                ].map((r,i)=>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)', fontSize:9, marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontWeight:700, color:'var(--text-light)' }}>{r.n}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:8, fontWeight:700, color:'#ef4444' }}>{r.d}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>{r.t}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{r.note}</div>
                  </div>
                ))}
                {/* Analyses */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#ec4899', marginBottom:3 }}>🧪 Необходимые анализы крови</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {['Тестостерон общий/свободный','DHT','Эстрадиол (E2)','ЛГ/ФСГ','Пролактин','DHEA-S','Кортизол','SHBG','Калий (K+)','Глюкоза/Инсулин/HOMA-IR'].map((a,i)=>(
                      <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(236,72,153,0.06)', color:'#f472b6', border:'1px solid rgba(236,72,153,0.12)' }}>{a}</span>
                    ))}
                  </div>
                </div>
                {/* Instrumental */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:3 }}>🔬 Инструментальные исследования</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {['УЗИ кожи (20-50 МГц)','Себуметрия','Дерматоскопия','Микробиология (C.acnes)'].map((e,i)=>(
                      <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.12)' }}>{e}</span>
                    ))}
                  </div>
                </div>
                {/* Hygiene */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>🧼 Гигиена и уход</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • Минимум <b style={{color:'#ef4444'}}>1 раз в день</b> тщательное мытьё с очищением пор от себума<br/>
                    • На курсе ААС выработка кожного сала резко возрастает → поры забиваются<br/>
                    • Клензит-С + Клендовит — только локально, не на всё лицо<br/>
                    • При сильном акне — дерматолог, системные ретиноиды (Изотретиноин)
                  </div>
                </div>
                {/* Important */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:2 }}>⚠️ Важно</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • При Верошпироне — исключить добавки калия<br/>• Солярий ≤ 2 раза/нед по 5 мин<br/>• Цинк и медь — РАЗДЕЛЬНО (цинк на ночь, медь утром)<br/>• При неэффективности 4-6 нед — дерматолог
                  </div>
                </div>
              </div>
            </div>
          </InfoErrorBoundary>)}
        </div>
      )}

      {/* ===== NON-MAIN CONTENT ===== */}
      {tab !== 'main' && tab !== 'fertility-pct' && (
        <div style={{ paddingBottom: 16 }}>

      {/* ===== CATALOG ===== */}
      {(section === 'home' || section === 'info') && tab === 'catalog' && catalogSubTab !== 'stack' && (<InfoErrorBoundary label="Каталог">
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
          </div>
          {/* ── ТЗ-системы фильтр (Popup) ── */}
          <div style={{ marginBottom: 6 }}>
            <button onClick={() => setShowOrganPopup(!showOrganPopup)} style={{
              width:'100%', padding:'10px 12px', borderRadius:10, cursor:'pointer',
              fontSize:10, fontWeight:700, textAlign:'center',
              background: catalogOrgans.length > 0 ? 'rgba(0,230,138,0.1)' : 'rgba(24,24,27,0.6)',
              border: catalogOrgans.length > 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: catalogOrgans.length > 0 ? '#00e68a' : 'rgba(255,255,255,0.7)',
            }}>
              {catalogOrgans.length > 0
                ? `🧬 Системы (${catalogOrgans.length}): ${catalogOrgans.map(o => TZ_SYSTEM_LABELS[o]?.slice(0,10)||o).join(', ')}`
                : '🧬 Все системы организма'}
            </button>
            {showOrganPopup && (
              <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }}
                onClick={() => setShowOrganPopup(false)}>
                <div onClick={e => e.stopPropagation()} style={{ width:'85%', maxWidth:320, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 }}>🧬 Системы организма (ТЗ)</div>
                    <button onClick={() => { setCatalogOrgans([]); setShowOrganPopup(false); }}
                      style={{ display:'block', width:'100%', padding:'10px 12px', marginBottom:4, borderRadius:10, cursor:'pointer', textAlign:'left',
                        fontSize:11, fontWeight: catalogOrgans.length === 0 ? 700 : 400,
                        background: catalogOrgans.length === 0 ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        border: catalogOrgans.length === 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: catalogOrgans.length === 0 ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                      🏠 Все системы {catalogOrgans.length === 0 ? ' ✓' : ''}
                    </button>
                    {['cardio','hepatic','renal','cns','reproductive','hematologic'].map(sys => {
                      const active = catalogOrgans.includes(sys);
                      return (
                        <button key={sys} onClick={() => {
                          setCatalogOrgans(prev => active ? prev.filter(x=>x!==sys) : [...prev, sys]);
                        }}
                          style={{ display:'block', width:'100%', padding:'10px 12px', marginBottom:4, borderRadius:10, cursor:'pointer', textAlign:'left',
                            fontSize:11, fontWeight: active ? 700 : 400,
                            background: active ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                            border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            color: active ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {TZ_SYSTEM_ICONS[sys] || '•'} {TZ_SYSTEM_LABELS[sys] || sys}{active ? ' ✓' : ''}
                        </button>
                      );
                    })}
                    <button onClick={() => setShowOrganPopup(false)}
                      style={{ width:'100%', marginTop:6, padding:'10px', borderRadius:8, border:'none',
                        background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`}
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
                    {(group.classBadges||[]).slice(0,4).map(b => (
                      <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {group.items.map(sub => (
                        <div key={sub.id}>
                          <div onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 12px 7px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}{' '}<span style={{fontSize:8,padding:'0 3px',borderRadius:3,fontWeight:700,color:TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)',background:(TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)')+'18'}}>{TIER_LABELS[getSubstanceTier(sub.id)]?.label||'Стд'}</span></div>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                                {(sub.categories||[]).slice(0, 3).map(c => (
                                  <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{c}</span>
                                ))}
                                {(sub.mechanisms||[]).slice(0, 3).map(m => {
                                  const tzLabel = TZ_MECH_LABELS[m as keyof typeof TZ_MECH_LABELS];
                                  return <span key={m} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent-green, #00e68a)' }}>{tzLabel || m.replace(/_/g, ' ').toLowerCase()}</span>;
                                })}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: selectedSub === sub.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                          </div>
                          {selectedSub === sub.id && (
                            <div style={{ padding: '8px 12px 10px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: 6 }}>{sub.description}</div>
                              {/* Type badge */}
                              <div style={{ fontSize: 8, color: 'var(--accent-green, #00e68a)', marginBottom: 4 }}>
                                {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 3).join(', ') : ''}
                              </div>
                              {/* All mechanisms */}
                              {sub.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Механизмы действия:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {(sub.mechanisms || []).map((m, i) => (
                                      <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Organs */}
                              {sub.organs && sub.organs.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Органы-мишени:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {[...new Set(sub.organs||[])].map(o => (
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
                                ).slice(0, 12);
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
                                          {i.notes && <div style={{ opacity: 0.5 }}>{i.notes}</div>}
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
      </InfoErrorBoundary>)}
        </div>
      )}


      {/* ===== SUPPORT CALCULATOR — FULL DATA-INTEGRATED OVERHAUL ===== */}
      {section === 'generator' && genTab === 'calculator' && ((tab === 'main' && supportView === 'calc' && calcView === 'calculator') || tab === 'calculator') && (() => {
        try {
        if (!linked || !linked.profile) {
          return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>Загрузка данных...</div>;
        }
        const weightKg = linked.profile?.settings?.weight ?? 80;
        const age = linked.profile?.settings?.age ?? 30;
        const sex = linked.profile?.settings?.sex ?? 'male';
        const course = linked.course || [];
        const labs = linked.labs || [];
        const riskData = linked.risk || null;
        const labAnalysis = linked.labAnalysis || null;
        const planSavedLocal = planSaved;

        const SYSTEM_LABELS_RU: Record<string, { name: string; emoji: string; rec: string }> = {
          cardio: { name: 'Сердце', emoji: '❤️', rec: 'Тельмисартан, Небиволол, CoQ10, Omega-3, L-карнитин' },
          hepatic: { name: 'Печень', emoji: '🧪', rec: 'NAC, TUDCA, Силимарин, Альфа-липоевая, Фосфатидилхолин' },
          renal: { name: 'Почки', emoji: '🫘', rec: 'Астрагал, Кордицепс, Omega-3, гидратация' },
          neuro: { name: 'Нейро', emoji: '🧠', rec: 'Mg L-треонат, Lion\'s Mane, Theanine, Omega-3, B-комплекс' },
          endocrine: { name: 'Эндокринная', emoji: '🔄', rec: 'DIM, Цинк, Ашваганда, Витекс, Бор' },
          hematologic: { name: 'Кровь', emoji: '🩸', rec: 'Omega-3, Наттокиназа, Ипидофлавин, гидратация, Кардио' },
          reproductive: { name: 'Репродуктивная', emoji: '⚧', rec: 'HCG, Кломифен, Цинк, D-Aspartic Acid, Сабаль пальметто' },
          musculoskeletal: { name: 'Опорно-двиг.', emoji: '🦴', rec: 'Глюкозамин, Коллаген, MSM, Босвеллия, Витамин D3+K2' },
        };

        const calcWeeklyDose = (c: CourseEntry): number => {
          const freq = typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0;
          const val = c.doseValue || 0;
          return val * (freq > 0 ? freq : 1);
        };

        const getPharmaClass = (substanceId: string): string => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.class || 'other';
        };

        const getPharmaName = (substanceId: string): string => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.name || substanceId;
        };

        const getAndrogenicity = (substanceId: string): number => {
          const mapping: Record<string, number> = {
            test_prop: 1.0, test_enan: 1.0, test_cyp: 1.0, test_undec: 1.0,
            tren_acet: 1.5, tren_enan: 1.5, tren_hex: 1.5, trena: 1.5,
            npp: 0.8, deca: 0.8,
            bold_undec: 0.7, prim_enan: 0.6,
            oxan: 0.6, stan: 1.0, methand: 1.1, halo: 1.8,
            ostarine: 0.05, lgd: 0.1, rad140: 0.15, s23: 0.2,
          };
          return mapping[substanceId] ?? 0.5;
        };

        const getHepatotoxicity = (substanceId: string): number => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.pd?.hepatotoxicity ?? 0;
        };

        const getAromatization = (substanceId: string): number => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.pd?.aromatization ?? 0;
        };

        const is19Nor = (substanceId: string): boolean => {
          const cls = getPharmaClass(substanceId);
          return cls === 'trenbolone' || cls === 'nandrolone';
        };

        const is17aaOral = (substanceId: string): boolean => {
          const cls = getPharmaClass(substanceId);
          return cls === 'oral_17aa';
        };

        const uniqCourse = (() => {
          const seen = new Map<string, { substanceId: string; name: string; cls: string; totalDose: number; hep: number; arom: number; andro: number; is19: boolean; is17aa: boolean }>();
          course.forEach(c => {
            const id = c.substanceId;
            const weekly = calcWeeklyDose(c);
            if (seen.has(id)) {
              const ex = seen.get(id)!;
              ex.totalDose += weekly;
            } else {
              seen.set(id, {
                substanceId: id, name: getPharmaName(id), cls: getPharmaClass(id),
                totalDose: weekly, hep: getHepatotoxicity(id), arom: getAromatization(id),
                andro: getAndrogenicity(id), is19: is19Nor(id), is17aa: is17aaOral(id),
              });
            }
          });
          return Array.from(seen.values());
        })();

        const count17aa = uniqCourse.filter(c => c.is17aa).length;
        const hasTren = uniqCourse.some(c => c.cls === 'trenbolone');
        const hasNandrolone = uniqCourse.some(c => c.cls === 'nandrolone');
        const countAromatizing = uniqCourse.filter(c => c.arom > 0).length;
        const avgToxicity = uniqCourse.length > 0 ? uniqCourse.reduce((s, c) => s + c.hep, 0) / uniqCourse.length : 0;
        const totalAndrogenicity = uniqCourse.reduce((s, c) => s + c.andro * (c.totalDose / 300), 0);

        const toxicityLabel =
          avgToxicity >= 2.5 ? 'Критический' : avgToxicity >= 1.5 ? 'Высокий' : avgToxicity >= 0.5 ? 'Средний' : 'Низкий';
        const toxicityColor =
          avgToxicity >= 2.5 ? '#ef4444' : avgToxicity >= 1.5 ? '#f97316' : avgToxicity >= 0.5 ? '#f59e0b' : '#22c55e';
        const androLabel = totalAndrogenicity > 3 ? 'высокий риск андрогенных побочек' : totalAndrogenicity > 1.5 ? 'средний риск' : 'низкий риск';

        const getLabStatus = (code: string): { value: number; refHigh: number; status: 'high' | 'critical' | 'normal' } | null => {
          const refs: Record<string, number> = {
            ALT: 40, AST: 35, GGT: 55, CREATININE: 110, LDL: 3.0, TRIGLYCERIDES: 1.7,
            GLUCOSE: 5.6, CRP: 5, HEMOGLOBIN: 175, HEMATOCRIT: 50,
            ESTRADIOL: 50, PROLACTIN: 15, SHBG: 55, TOTAL_TESTOSTERONE: 35,
          };
          for (const l of labs) {
            if (l.code === code) {
              const refHigh = refs[code] || 100;
              return { value: l.value, refHigh, status: l.value > refHigh * 1.3 ? 'critical' : l.value > refHigh ? 'high' : 'normal' };
            }
          }
          return null;
        };

        const LAB_REC_MAP: Record<string, { rec: string; dose: string }> = {
          ALT: { rec: 'NAC 1200-2400 мг, TUDCA 500-1500 мг, Силимарин 600-900 мг', dose: 'NAC 20-30 мг/кг, TUDCA 10-15 мг/кг' },
          AST: { rec: 'дополнительно NAC 600-1200 мг', dose: 'NAC 20-30 мг/кг' },
          GGT: { rec: 'TUDCA 1000-1500 мг, Силимарин 900 мг, Альфа-липоевая 600 мг', dose: 'TUDCA 10-15 мг/кг' },
          CREATININE: { rec: 'Астрагал 1500-3000 мг, Кордицепс 1000-2000 мг', dose: 'Астрагал 20-40 мг/кг' },
          LDL: { rec: 'Omega-3 3-5г, Бергамот 1000 мг, Берберин 500 мг', dose: 'Omega-3 30-50 мг/кг' },
          TRIGLYCERIDES: { rec: 'Omega-3 3-5г, Берберин 500-1000 мг', dose: 'Omega-3 30-50 мг/кг' },
          GLUCOSE: { rec: 'Берберин 500 мг 2x/д, Альфа-липоевая 600 мг', dose: 'Берберин по назначению' },
          CRP: { rec: 'Omega-3 3-5г, Куркумин 1000 мг, Босвеллия 600 мг', dose: 'Omega-3 30-50 мг/кг, Куркумин 15 мг/кг' },
          HEMOGLOBIN: { rec: 'Omega-3 2-3г, Наттокиназа 100 мг, гидратация', dose: 'Omega-3 30-50 мг/кг' },
          HEMATOCRIT: { rec: 'Ипидофлавин 50 мг, Наттокиназа 100 мг, гидратация 3+ л/д', dose: 'Гидратация 40 мл/кг' },
          ESTRADIOL: { rec: 'Анастрозол (коррекция), Цинк 50 мг, DIM 200 мг', dose: 'Цинк 0.3-0.6 мг/кг' },
          PROLACTIN: { rec: 'Каберголин/Бромокриптин, Витамин B6 200-300 мг', dose: 'B6 2-4 мг/кг' },
          SHBG: { rec: 'Бор 10 мг, Магний 400-600 мг', dose: 'Бор 0.1-0.15 мг/кг, Mg 5-8 мг/кг' },
        };

        const abnormalLabs = (
          labAnalysis?.interpretations?.filter(i => i.status === 'high' || i.status === 'critical_high') ||
          Object.keys(LAB_REC_MAP).map(code => getLabStatus(code)).filter(Boolean).filter(s => s!.status !== 'normal')
        );

        const weightBasedDose = (baseMg: number, perKg: number, weight: number): number => {
          const calc = Math.round(perKg * weight);
          return Math.max(baseMg * 0.5, Math.min(baseMg * 3, calc));
        };

        const getWeightDosing = (id: string, baseMg: number): string => {
          const perKg: Record<string, number> = {
            nac: 25, tudca: 12, omega3: 40, coq10: 4, magnesium: 6.5,
            zinc: 0.4, berberine: 6, astragalus: 25, taurine: 25,
            alpha_lipoic: 8, milk_thistle: 10, curcumin: 12, ashwagandha: 8,
          };
          if (!perKg[id]) return '';
          const calcMg = weightBasedDose(baseMg, perKg[id], weightKg);
          if (Math.abs(calcMg - baseMg) / baseMg < 0.1) return '';
          return `(${weightKg} кг × ${perKg[id]} мг/кг = ${calcMg} мг)`;
        };

        // Auto schedule builder
        const buildDailySchedule = (level: string, overrideLevel?: { subs: string[]; dosages: Record<string, { mg: number; timing: string }> }) => {
          const levelData = overrideLevel || SUPPORT_LEVELS[level];
          if (!levelData) return [];
          const subs = levelData.subs || [];
          const dosages = levelData.dosages || {};
          const slots: { time: string; label: string; items: { id: string; name: string; dose: string; with: string; note: string }[] }[] = [
            { time: '07:00', label: 'Натощак', items: [] },
            { time: '08:00', label: 'Завтрак', items: [] },
            { time: '12:00', label: 'Обед', items: [] },
            { time: '16:00', label: 'Перекус', items: [] },
            { time: '19:00', label: 'Ужин', items: [] },
            { time: '21:00', label: 'На ночь', items: [] },
          ];

          const timingMap: Record<string, { slot: number; with: string; note: string }> = {
            nac: { slot: 0, with: 'Вода', note: 'За 30 мин до еды' },
            omega3: { slot: 1, with: 'С жирной пищей', note: 'Для усвоения EPA/DHA' },
            vitamin_d3: { slot: 1, with: 'С жирной пищей', note: 'Жирорастворимый' },
            vitamin_k2: { slot: 1, with: 'С жирной пищей', note: 'С D3 для синергии' },
            coq10: { slot: 1, with: 'С жирной пищей', note: 'Для биодоступности' },
            magnesium: { slot: 5, with: 'Вода', note: 'Перед сном' },
            zinc: { slot: 5, with: 'На пустой желудок', note: 'Не с кальцием/железом' },
            tudca: { slot: 0, with: 'Вода', note: 'За 30 мин до еды, 1-2x/д' },
            ashwagandha: { slot: 5, with: 'Вода', note: 'Снижает кортизол' },
            alpha_lipoic: { slot: 0, with: 'Вода', note: 'За 30 мин до еды' },
            berberine: { slot: 2, with: 'С едой', note: 'Контроль глюкозы' },
            milk_thistle: { slot: 2, with: 'С едой', note: 'Гепатопротекция' },
            selenium: { slot: 1, with: 'С едой', note: 'Антиоксидант' },
            vitamin_b12: { slot: 1, with: 'С водой', note: 'Утром для энергии' },
            folate: { slot: 1, with: 'С едой', note: 'Метилирование' },
            taurine: { slot: 0, with: 'Вода', note: 'Кардиопротекция' },
            glucosamine: { slot: 2, with: 'С едой', note: 'Суставы' },
            collagen: { slot: 2, with: 'С едой', note: 'Соединительная ткань' },
            vitamin_c: { slot: 0, with: 'Вода', note: 'Синтез коллагена' },
            melatonin: { slot: 5, with: 'Вода', note: 'За 30 мин до сна' },
          };

          subs.forEach(id => {
            const dosing = dosages[id];
            if (!dosing) return;
            const subInfo = catalogSubstances.find(s => s.id === id);
            const t = timingMap[id] || { slot: 2, with: 'С едой', note: dosing.timing || '' };
            const wbDose = getWeightDosing(id, dosing.mg);
            const doseStr = dosing.mg >= 5000 ? `${dosing.mg / 1000} г` : `${dosing.mg} мг`;
            slots[t.slot].items.push({
              id, name: subInfo?.name || id,
              dose: wbDose ? `${doseStr} ${wbDose}` : doseStr,
              with: t.with, note: t.note,
            });
          });
          return slots.filter(s => s.items.length > 0);
        };

        const dailySchedule = buildDailySchedule(supportLevel, effectiveLevel?.subs ? { subs: effectiveLevel.subs, dosages: effectiveLevel.dosages } : undefined);

        const SYSTEM_ORDER = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'];
        const riskColorFn = (v: number) => v > 60 ? '#ef4444' : v > 30 ? '#f59e0b' : '#22c55e';

        const calcRiskReduction = (_sysKey: string, currentNet: number): number => {
          const levelCov = { basic: 15, mid: 30, max: 45, boost: 60 }[supportLevel] || 30;
          return Math.round(currentNet * (levelCov / 100));
        };

        const execCalculate = () => {
          try {
            calcSupport(supportLevel);
          } catch { }
        };

        const savePlan = () => {
          const plan = {
            date: new Date().toISOString(),
            level: supportLevel,
            levelLabel: SUPPORT_LEVELS[supportLevel]?.label,
            goal: supportGoal,
            schedule: dailySchedule,
            riskBefore: calcResult?.riskBeforeSupport ?? 0,
            riskAfter: calcResult?.riskAfterSupport ?? 0,
            systemSupport: calcResult?.systemSupport ?? {},
            courseSummary: uniqCourse.map(c => ({ name: c.name, dose: c.totalDose, cls: c.cls })),
            weightKg, age, sex,
          };
          const key = `supportPlan_${new Date().toISOString().slice(0, 10)}`;
          localStorage.setItem(key, JSON.stringify(plan));
          try { notifyDataChange(); } catch {}
          setPlanSaved(true);
          setTimeout(() => setPlanSaved(false), 3000);
        };

        const copyPlan = () => {
          const schedule = dailySchedule || [];
          let text = '🧮 ПЛАН ПОДДЕРЖКИ — BodyBuildHealth\n';
          text += '═══════════════════════════════\n\n';
          text += `📊 Анализ курса:\n`;
          text += `- Активных в-в: ${uniqCourse.length}\n`;
          text += `- Уровень токсичности: ${toxicityLabel}\n`;
          text += `- 17α-алкил. оральных: ${count17aa} шт\n`;
          text += `- Тренболон: ${hasTren ? 'ДА' : 'НЕТ'} | Нандролон: ${hasNandrolone ? 'ДА' : 'НЕТ'}\n`;
          text += `- Ароматизирующихся: ${countAromatizing} шт\n`;
          text += `- Андрогенный индекс: ${totalAndrogenicity.toFixed(2)} — ${androLabel}\n\n`;
          text += `📅 ДНЕВНОЕ РАСПИСАНИЕ (${SUPPORT_LEVELS[supportLevel]?.label}):\n`;
          schedule.forEach(s => {
            text += `\n${s.time} (${s.label}):\n`;
            s.items.forEach((i: any) => {
              text += `  • ${i.name} — ${i.dose} | ${i.with} | ${i.note}\n`;
            });
          });
          text += `\n═══════════════════════════════\n`;
          if (calcDone && calcResult) {
            text += `\n📉 Риски: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}%\n`;
          }
          text += `\nСгенерировано: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `body-build-health.vercel.app\n`;
          navigator.clipboard.writeText(text).catch(() => {
            alert('Не удалось скопировать. Проверьте права буфера обмена.');
          });
        };

        const exportForDoctor = () => {
          const schedule = dailySchedule || [];
          let text = '👨‍⚕️ ОТЧЕТ ДЛЯ ВРАЧА — BodyBuildHealth\n';
          text += '═══════════════════════════════════\n';
          text += `Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `Пациент: ${age} лет, ${weightKg} кг, ${sex === 'male' ? 'м' : 'ж'}\n\n`;
          text += `🚑 АНАЛИЗ КУРСА:\n`;
          uniqCourse.forEach(c => {
            text += `- ${c.name}: ~${c.totalDose} мг/нед (класс: ${c.cls})\n`;
          });
          text += `\n⚠ Токсичность: ${toxicityLabel} | Андрогенный индекс: ${totalAndrogenicity.toFixed(2)}\n`;
          text += `\n💊 НАЗНАЧЕННАЯ ПОДДЕРЖКА:\n`;
          schedule.forEach(s => {
            text += `\n${s.time} (${s.label}):\n`;
            s.items.forEach((i: any) => { text += `  • ${i.name}: ${i.dose} — ${i.note}\n`; });
          });
          if (calcDone && calcResult) {
            text += `\n📊 РИСКИ:\n`;
            text += `Общий: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}%\n`;
            Object.entries(calcResult.systemSupport || {}).forEach(([k, v]) => {
              const sysInfo = SYSTEM_LABELS_RU[k] || { name: k };
              text += `  ${sysInfo.name}: покрытие ${v}%\n`;
            });
          }
          text += `\n═══════════════════════════════════\n`;
          navigator.clipboard.writeText(text).catch(() => {});
        };

        const buildShareText = () => {
          const schedule = dailySchedule || [];
          let text = '🧮 ПЛАН ПОДДЕРЖКИ — BodyBuildHealth\n';
          text += '═══════════════════════════════\n\n';
          text += `📅 Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `🎯 Уровень: ${SUPPORT_LEVELS[supportLevel]?.label || supportLevel}\n`;
          text += `📊 Токсичность курса: ${toxicityLabel}\n\n`;
          if (calcDone && calcResult) {
            text += `📉 Риски: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}% (снижение ${Math.round(calcResult.riskBeforeSupport - calcResult.riskAfterSupport)}%)\n`;
          }
          text += `\n💊 Поддержка (${schedule.length} приёмов):\n`;
          schedule.forEach(s => {
            s.items.forEach((i: any) => {
              text += `  • ${i.name} — ${i.dose} | ${i.with}\n`;
            });
          });
          const synCount = supportResult?.metadata?.effectiveMechanisms?.length ?? mergedInteractions.filter((i:any)=>i.type==='synergy').length;
          if (synCount > 0) text += `\n✅ Синергий: ${synCount}\n`;
          text += `\n═══════════════════════════════\n`;
          text += `body-build-health.vercel.app\n`;
          return text;
        };

        return (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, overflowY:'auto', paddingRight:4, display:'flex', flexDirection:'column', gap:8 }}>

            {/* ===== ВВОДНЫЕ КАРТОЧКИ КАЛЬКУЛЯТОРА ===== */}
            <AutoCalculator embedded
              onApply={(applied: { level: string; subs: string[]; result: any }) => {
                setAutoCalcResult(applied);
                setManualLevelSelected(true);
                setSupportLevel(applied.level as any);
                setEnhancedSubs(applied.subs || []);
                showToast(`✅ ${SUPPORT_LEVELS[applied.level]?.label || applied.level}`, 'success');
                setTimeout(() => calcSupport(applied.level as any), 100);
              }}
            />


            {/* ===== ЕДИНАЯ КАРТОЧКА РАСЧЁТА ПОДДЕРЖКИ ===== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:16, border:'2px solid rgba(0,230,138,0.25)', position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg, rgba(0,230,138,0.02), rgba(0,198,83,0.02))', pointerEvents:'none' }} />
              
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h4 style={{ margin:0, fontSize:13, color:'#00e68a', display:'flex', alignItems:'center', gap:6 }}>
                  🧮 Расчёт поддержки
                </h4>
                <span style={{ fontSize:9, fontWeight:400, color:'var(--text-dim)', background:'rgba(0,230,138,0.08)', padding:'2px 8px', borderRadius:10 }}>v3.0</span>
              </div>

              {/* Week selector — кнопка-карточка с попапом */}
              <div style={{ background:'rgba(0,0,0,0.12)', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>📅 Неделя курса</div>
                <button onClick={() => setShowModal('weekSelect')} style={{
                  width:'100%', padding:'10px 14px', borderRadius:8, cursor:'pointer',
                  background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)',
                  color:'var(--accent)', fontWeight:700, fontSize:13, textAlign:'center',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <span>Неделя</span>
                  <span style={{ fontSize:16, fontWeight:800, color:'#fff', background:'rgba(0,230,138,0.15)', borderRadius:6, padding:'2px 12px' }}>{courseWeekState}</span>
                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>▾</span>
                </button>
                <div style={{ fontSize:7, color:'var(--text-dim)', display:'flex', justifyContent:'space-between', marginTop:3 }}>
                  <span>Начало</span><span>Пик нагрузки</span><span>Конец курса</span>
                </div>
              </div>

              {/* Week change notification */}
              {weekChangeMsg && (
                <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:8, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.15)', fontSize:8, color:'#60a5fa' }}>
                  📌 {weekChangeMsg}
                </div>
              )}

              {/* Note about missing data */}
              {(!linked.labs || linked.labs.length === 0) && (
                <div style={{ fontSize:8, color:'#f59e0b', marginBottom:8, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  ⚠️ Нет данных анализов — риск рассчитан консервативно. Добавьте анализы для точного расчёта.
                </div>
              )}

              {/* Level selector (always visible) */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4, display:'flex', justifyContent:'space-between' }}><span>📊 Уровень поддержки:</span>
                  {manualLevelSelected && <span onClick={() => { setManualLevelSelected(false); setSupportLevel(autoLevel); calcSupport(autoLevel); }} style={{ cursor:'pointer', color:'#60a5fa', fontSize:7 }}>🔄 Авто</span>}
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                  <button onClick={() => setShowModal('intel')} style={{
                    flex:1, padding:'12px 10px', borderRadius:12, cursor:'pointer', textAlign:'left',
                    background:'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,198,83,0.05))',
                    border:'2px solid rgba(0,230,138,0.3)', color:'var(--text-light)',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>🧠 Интеллектуальная</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{SUPPORT_LEVELS[supportLevel]?.label || supportLevel} · {SUPPORT_LEVELS[supportLevel]?.desc || ''}</div>
                  </button>
                  <button onClick={() => { setShowModal('manual'); setModalAddMode(false); }} style={{
                    flex:1, padding:'12px 10px', borderRadius:12, cursor:'pointer', textAlign:'left',
                    background:'linear-gradient(135deg, rgba(96,165,250,0.1), rgba(59,130,246,0.05))',
                    border:'2px solid rgba(96,165,250,0.3)', color:'var(--text-light)',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:2 }}>📋 Ручной выбор</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{enhancedSubs.length > 0 ? `${enhancedSubs.length} веществ вручную` : 'Выбрать из каталога'}</div>
                  </button>
                </div>
              </div>

              {/* Phase selector */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--text-dim)',marginBottom:4}}>🔄 Фаза цикла:</div>
                <div style={{display:'flex',gap:4}}>
                  {(['course','bridge','pct','fertility'] as const).map(ph => { const a = supportPhase === ph; const lab:Record<string,string> = {course:'💉 Курс',bridge:'🌉 Мост',pct:'🔄 ПКТ',fertility:'⚧ Ферт.'}; return <button key={ph} onClick={() => setSupportPhase(ph)} style={{flex:1,padding:'6px 2px',borderRadius:8,fontSize:9,fontWeight:600,cursor:'pointer',background:a?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.03)',border:a?'1px solid rgba(139,92,246,0.4)':'1px solid rgba(255,255,255,0.06)',color:a?'#8b5cf6':'var(--text-dim)'}}>{lab[ph]}</button>; })}
                </div>
              </div>
              {/* Calculate button */}
              <button onClick={() => calcSupport(supportLevel)} style={{
                width:'100%', padding:'14px', borderRadius:12, border:'2px solid var(--accent)', cursor:'pointer',
                background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,198,83,0.05))', color:'#00e68a', fontWeight:800, fontSize:13, marginBottom:8, letterSpacing:0.5,
              }}>
                🧮 Рассчитать поддержку
              </button>

              {/* Joint/Boost moved to Intel popup (SupportModals) */}
              
               {/* Save calc result + Save Plan to Мои планы */}
              {calcDone && calcResult && (
                <div style={{ marginBottom:6, display:'flex', flexDirection:'column', gap:4 }}>
                  <button onClick={() => {
                    const saveData = {
                      id: Date.now(),
                      calcResult, supportLevel, enhancedSubs, boostEnabled, jointMode, courseWeekState,
                      linked: { course: linked.course, labs: linked.labs },
                      timestamp: new Date().toISOString(),
                    };
                    try {
                      const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                      arr.push(saveData);
                      localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                      setPlanSaved('✅ Сохранено в Избранное → Расчёты');
                      setTimeout(() => setPlanSaved(''), 3000);
                    } catch {}
                  }} style={{ width:'100%', padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.12)', color:'var(--accent)' }}>
                    💾 Сохранить расчёт в избранное
                  </button>
                  <button onClick={() => {
                    const myPlans: any[] = JSON.parse(localStorage.getItem('he_my_plans') || '[]');
                    const planData = {
                      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                      name: `План от ${new Date().toLocaleDateString('ru-RU')} (ур. ${supportLevel})`,
                      date: new Date().toISOString(),
                      level: supportLevel,
                      week: courseWeekState,
                      subs: effectiveLevel?.subs || [],
                      dosages: effectiveLevel?.dosages || {},
                      riskBefore: calcResult?.riskBeforeSupport ?? 0,
                      riskAfter: calcResult?.riskAfterSupport ?? 0,
                      supportScore: calcResult?.supportScore ?? 0,
                      enhancedSubs: enhancedSubs,
                      boostEnabled: boostEnabled,
                      jointMode: jointMode,
                    };
                    myPlans.push(planData);
                    localStorage.setItem('he_my_plans', JSON.stringify(myPlans));
                    if (typeof setMyPlansRefresh !== 'undefined') setMyPlansRefresh((p: number) => p + 1);
                    setPlanSaved('✅ План сохранён в Мои планы');
                    setTimeout(() => setPlanSaved(''), 3000);
                  }} style={{ width:'100%', padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)', color:'#8b5cf6' }}>
                    📋 Сохранить план в Мои планы
                  </button>
                </div>
              )}
              {calcDone && (calcResult || planResult) && (
                <div style={{ marginTop:10, padding:'12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  {(() => {
                    const r = planResult || calcResult || {} as any;
                    const riskBefore = r.overallRiskBefore ?? r.riskBeforeSupport ?? 0;
                    const riskAfter = r.overallRiskAfter ?? r.riskAfterSupport ?? 0;
                    const score = r.coveragePercent ?? r.supportScore ?? 0;
                    const isOptimal = score > 50;
                    const isMid = score > 25;
                    return (<>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    📊 Результат расчёта
                    {isOptimal ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(34,197,94,0.12)', color:'#22c55e' }}>Оптимально</span> : isMid ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>Средне</span> : <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>Недостаточно</span>}
                  </div>
                  {(() => {
                    // Show week scale info
                    if (!planResult) return null;
                    const ws = planResult.weekScale || 1;
                    return <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:7,color:'var(--text-dim)'}}>Нед.{courseWeekState}</span>
                      {ws < 1 && <span style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(245,158,11,0.08)',color:'#f59e0b'}}>Дозы ×{ws.toFixed(1)} (адаптация)</span>}
                      {planResult.coverageGaps?.length > 0 && <span style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{planResult.coverageGaps.length} пробелов</span>}
                    </div>;
                  })()}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'8px 10px',borderRadius:8,background:'rgba(0,0,0,0.08)',border:'1px solid var(--border)'}}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>Без</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#ef4444' }}>{Math.round(riskBefore)}%</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700 }}>/</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>С</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#22c55e' }}>{Math.round(riskAfter)}%</span>
                    </div>
                    <div style={{ padding:'2px 8px', borderRadius:6, background:'rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#22c55e' }}>{Math.round(riskBefore)}/{Math.round(riskAfter)}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <span style={{ fontSize:9, color:'var(--text-dim)', minWidth:90 }}>Оценка поддержки</span>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, score)}%`, borderRadius:3, background: isOptimal ? 'linear-gradient(90deg,#22c55e,#4ade80)' : isMid ? 'linear-gradient(90deg,#eab308,#f59e0b)' : 'linear-gradient(90deg,#ef4444,#f97316)', transition:'width 0.6s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#8b5cf6', minWidth:40, textAlign:'right' }}>{Math.round(score)}/100</span>
                  </div></>);})()}
                  {(() => {
                    const sysData = planResult?.systems || (calcResult?.systemSupport ? Object.fromEntries(Object.entries(calcResult.systemSupport).map(([k,v]) => [k, { raw: (v as number), net: (v as number), mechanisms: [] }])) : null);
                    if (!sysData) return null;
                    return (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>📈 Покрытие по системам:</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {SYSTEM_ORDER.filter(k => sysData[k] !== undefined).map(sysKey => {
                          const sys = sysData[sysKey] || { raw: 0, net: 0 };
                          const cov = Math.round(100 - sys.net);
                          const sysInfo = SYSTEM_LABELS_RU[sysKey] || { name: sysKey, emoji: '📌' };
                          const barColor = cov > 60 ? '#22c55e' : cov > 30 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={sysKey} style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontSize:9, color:'var(--text-light)', minWidth:85 }}>{sysInfo.emoji} {sysInfo.name}</span>
                              <div style={{ flex:1, height:4, borderRadius:2, background:'var(--bg-secondary)', overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.min(100, cov)}%`, borderRadius:2, background: barColor, transition:'width 0.5s' }} />
                              </div>
                              <span style={{ fontSize:9, fontWeight:600, color: barColor, minWidth:28, textAlign:'right' }}>{cov}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                  {/* Recommendations based on low coverage */}
                  {calcResult && (calcResult.systemSupport || {}).cardio !== undefined && (
                    <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.12)', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации по покрытию:</div>
                      {((calcResult.systemSupport || {}).cardio || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>💊 <b>Давление/ЧСС:</b> небилетол 5 мг или тельмисартан 40 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hepatic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫁 <b>Печень:</b> NAC 1200 мг + TUDCA 500 мг (до еды)</div>
                      )}
                      {((calcResult.systemSupport || {}).renal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫘 <b>Почки:</b> астрагал 1000 мг + таурин 2000 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).neuro || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🧠 <b>Нервная:</b> магний 400 мг + ашваганда 600 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).endocrine || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚗️ <b>Эндокринная:</b> витамин D3 5000 МЕ + цинк 30 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).reproductive || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚧ <b>Репродуктивная:</b> ХГЧ 500 МЕ 2x/нед (схема 3/1) + сабаль 640 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hematologic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🩸 <b>Кроветворение:</b> фолат 800 мкг + B12 1000 мкг + железо (по анализам)</div>
                      )}
                      {((calcResult.systemSupport || {}).musculoskeletal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🦴 <b>Опорно-двигательная:</b> коллаген 10 г + витамин C 1000 мг + глюкозамин 1500 мг</div>
                      )}
                    </div>
                  )}
                  <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', fontSize:10 }}>
                    <span style={{ color:'#8b5cf6', fontWeight:600 }}>⚡ Рекомендованный уровень:</span>{' '}
                    <b style={{ color:'#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel as string]?.label || autoLevel}</b>
                    <span style={{ color:'var(--text-dim)', fontSize:9 }}> — {SUPPORT_LEVELS[autoLevel as string]?.desc || 'Автоматически определённый уровень поддержки'}</span>
                  </div>
                  {/* Explanation of risk calculation */}
                  <details style={{ marginTop:6 }}>
                    <summary style={{ fontSize:8, fontWeight:600, color:'var(--text-dim)', cursor:'pointer' }}>📖 Как считаются риски и оценка поддержки</summary>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.5, marginTop:4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.06)' }}>
                      <b>Риск без поддержки:</b> {Math.round(calcResult.riskBeforeSupport)}% = максимальный риск по всем системам.<br/>
                      <b>Снижение риска:</b> каждый препарат покрывает системы с {calcResult.supportScore.toFixed(0)}% эффективностью. Защита = покрытие / 100 от базового риска.<br/>
                      <b>Риск с поддержкой:</b> {Math.round(calcResult.riskAfterSupport)}% = базовый риск × (1 - защита).<br/>
                      <b>Оценка поддержки:</b> {Math.round(calcResult.supportScore)}/100 — взвешенное среднее покрытия всех систем (вес систем: сердечно-сосуд. 15, печень 15, почки 10, нейро 10, эндокринная 12, кровь 8, репродуктивная 10, опорно-двиг. 10).<br/>
                      <b>Факторы:</b> питание ×{((linked.profile?.settings?.nutritionFactor ?? 0.8) * 100).toFixed(0)}%, тренировки ×{((linked.profile?.settings?.trainingFactor ?? 0.7) * 100).toFixed(0)}% дополнительно снижают риск.
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* ===== PLAN REVIEW CARD ===== */}
            {calcDone && effectiveLevel?.subs && effectiveLevel.subs.length > 0 && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div onClick={() => setExpandedCategories(p => ({ ...p, calc_plan: !(p.calc_plan ?? true) }))} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', marginBottom: (expandedCategories.calc_plan ?? true) ? 8 : 0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-light)', flex:1 }}>📋 План поддержки ({effectiveLevel.subs.length} препаратов)</span>
                  <button onClick={e => { e.stopPropagation(); setShowModal('weekSelect'); }} style={{ padding:'2px 10px', borderRadius:12, border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)', color:'var(--accent)', cursor:'pointer', fontSize:9, fontWeight:700 }}>📅 Нед. {courseWeekState}</button>
                  <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_plan ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
                {(expandedCategories.calc_plan ?? true) && (<>

                  {(!linked.course || linked.course.length === 0) && (
                    <div style={{marginBottom:10,padding:'10px 12px',borderRadius:10,background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#f59e0b',marginBottom:4}}>⚠️ Нет данных о курсе</div>
                      <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4}}>Заполните <b>💉 Фарма стек</b> в AutoCalculator и <b>🧪 Лабораторию</b> для точного подбора с учётом реальных рисков.</div>
                    </div>
                  )}
                  {supportPhase !== 'course' && (
                    <div style={{marginBottom:10,padding:'10px 12px',borderRadius:10,background:'rgba(139,92,246,0.05)',border:'1px solid rgba(139,92,246,0.15)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#8b5cf6',marginBottom:4}}>{supportPhase==='bridge'?'🌉 Фаза: МОСТ':supportPhase==='pct'?'🔄 Фаза: ПКТ':'⚧ Фаза: Фертильность'}</div>
                      <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4}}>{supportPhase==='bridge'?'Приоритет: восстановление ГГЯ, поддержка печени. Дозы NAC/TUDCA снижены, ашваганда/B12 усилены.':supportPhase==='pct'?'Приоритет: HPTA, сперматогенез. Телмисартан/небиволол исключены. Цинк×2, D3×1.5.':'Приоритет: качество спермы. Исключены ХГЧ/телмисартан/берберин. Цинк×2, Q10×1.5.'}</div>
                    </div>
                  )}
                  {/* ⚠️ Карточка предупреждения о недостаточности */}
                  {calcResult && (() => {
                    try {
                      const h = hydrateState();
                      const st = { ...h, powerLevel: supportLevel as PowerLevel, courseWeek: courseWeekState } as CalculatorState;
                      const recs = evaluateRecommendations(st, calcResult as any, courseWeekState);
                      const coverageWarn = computeCoverageRisk(recs, supportLevel, st, calcResult as any);
                      if (!coverageWarn.warning) return null;
                      return (
                        <div style={{ marginBottom:8, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            <span style={{ fontSize:14 }}>⚠️</span>
                            <span style={{ fontSize:10, fontWeight:700, color:'#ef4444' }}>Недостаточный уровень поддержки</span>
                          </div>
                          <div style={{ fontSize:8, color:'#ef4444', marginBottom:4, lineHeight:1.4 }}>{coverageWarn.warning}</div>
                          <div style={{ display:'flex', gap:4, fontSize:7, color:'var(--text-dim)' }}>
                            <span>Риск: <b>{coverageWarn.riskBefore}%</b> → <b style={{color:'#ef4444'}}>{coverageWarn.riskAfter}%</b></span>
                            <span>· Покрытие: <b>{coverageWarn.avgCoverage}%</b></span>
                            <span>· Синергия: <b>{coverageWarn.synergyScore}%</b></span>
                          </div>
                          {supportLevel !== 'boost' && (
                            <button onClick={() => { setManualLevelSelected(true); setSupportLevel('boost'); setPlanSaved(false); calcSupport('boost'); }} style={{
                              marginTop:6, padding:'6px 14px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer',
                              background:'rgba(239,68,68,0.12)', border:'1px solid #ef4444', color:'#ef4444',
                            }}>
                              💎 Повысить до Буст
                            </button>
                          )}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* 🧠 Карточка логики назначения — перед планом */}
                  {calcResult && (() => {
                    try {
                      const h = hydrateState();
                      const st = { ...h, powerLevel: supportLevel as PowerLevel, courseWeek: courseWeekState } as CalculatorState;
                      const recs = evaluateRecommendations(st, calcResult as any, courseWeekState);
                      const preApply = buildPreApplyCard(recs, st as any);
                      if (preApply.lines.length === 0) return null;
                      return (
                        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.12)' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>🧠 Почему назначены эти препараты</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'40vh', overflowY:'auto' }}>
                            {preApply.lines.map((line, i) => (
                              <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.08)', border:'1px solid var(--border)', fontSize:8 }}>
                                <div style={{ fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>{line.problem}</div>
                                <div style={{ color:'var(--accent)', fontWeight:600, marginBottom:1 }}>{line.primarySubs}</div>
                                {line.riskCoverage && <div style={{ color:'var(--text-dim)', fontSize:7, marginBottom:1 }}>{line.riskCoverage}</div>}
                                {line.escalation && <div style={{ color:'#f59e0b', fontSize:7, marginTop:1 }}>⚠ {line.escalation}</div>}
                                {line.monitoring && <div style={{ color:'#60a5fa', fontSize:7, marginTop:1 }}>📊 {line.monitoring}</div>}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,0,0,0.04)' }}>{preApply.summary}</div>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* ===== COVERAGE GAUGE ===== */}
                  {planResult && (
                    <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)', textAlign:'center' }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:9,fontWeight:700,color:'var(--accent)'}}>Покрытие рисков</span><span style={{fontSize:7,color:'var(--text-dim)'}}>Нед.{courseWeekState} · ×{planResult.weekScale.toFixed(1)}</span></div>
                      <div style={{ position:'relative', height:10, borderRadius:5, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:4 }}>
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${planResult.coveragePercent}%`, borderRadius:5, background:`linear-gradient(90deg, #ef4444, #f59e0b ${40}%, #22c55e)`, transition:'width 0.5s' }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}>
                        <span>Риск до: <b style={{color:'#ef4444'}}>{planResult.overallRiskBefore}%</b></span>
                        <span style={{fontSize:10,fontWeight:800,color:'var(--accent)'}}>{planResult.coveragePercent}%</span>
                        <span>Риск после: <b style={{color:'#22c55e'}}>{planResult.overallRiskAfter}%</b></span>
                      </div>
                      {courseWeekState <= 6 && (<div style={{fontSize:7,color:'#f59e0b',marginTop:3,padding:'3px 6px',borderRadius:4,background:'rgba(245,158,11,0.06)'}}>⚠ Дозы снижены на {Math.round((1-planResult.weekScale)*100)}% — фаза адаптации (нед.{courseWeekState}). К неделе 7 — полные дозы.</div>)}
                    </div>
                  )}

                  {/* ===== TIME-BLOCK TABLE (D1) ===== */}
                  {planResult?.schedule && planResult.schedule.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-light)', marginBottom:6 }}>📋 План по времени приёма</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {planResult.schedule.map((block: any, bi: number) => (
                          <div key={bi} style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                            <div style={{ padding:'6px 10px', fontSize:9, fontWeight:700, background:'rgba(0,230,138,0.08)', color:'var(--accent)' }}>
                              {block.timeBlock}
                            </div>
                            <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                              <thead>
                                <tr style={{ background:'rgba(0,0,0,0.06)' }}>
                                  <th style={{ padding:'4px 6px', textAlign:'left', color:'var(--text-dim)', fontWeight:600 }}>Препарат</th>
                                  <th style={{ padding:'4px 6px', textAlign:'left', color:'var(--text-dim)', fontWeight:600 }}>Доза</th>
                                  <th style={{ padding:'4px 6px', textAlign:'left', color:'var(--text-dim)', fontWeight:600 }}>Указание</th>
                                </tr>
                              </thead>
                              <tbody>
                                {block.substances.map((s: any, si: number) => {
                                  return (
                                    <tr key={si} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                                      onClick={() => setExpandedCategories(p => ({ ...p, [s.id]: !p[s.id] }))}>
                                      <td style={{ padding:'4px 6px', fontWeight:600, color:'var(--text-light)' }}>{s.name}</td>
                                      <td style={{ padding:'4px 6px', color:'#00e68a', fontWeight:600 }}>{s.dose}</td>
                                      <td style={{ padding:'4px 6px', color:'var(--text-dim)', fontSize:7 }}>{s.instructions}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===== ADD SUBSTANCE SEARCH ===== */}
                  <div style={{marginBottom:10}}>
                    <input type="text" placeholder="+ Добавить вещество (поиск по каталогу)..." value={subSearch} onChange={e => setSubSearch(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)',fontSize:9,outline:'none'}} />
                    {subSearch.length >= 2 && (
                      <div style={{maxHeight:'20vh',overflowY:'auto',display:'flex',flexWrap:'wrap',gap:3,marginTop:4}}>
                        {(() => {
                          const q=subSearch.toLowerCase();const seen=new Set();const results=[];
                          for(const k of Object.keys(SUPPORT_CATALOG_DATA)){if(k.length>30||seen.has(k.toLowerCase()))continue;seen.add(k.toLowerCase());const e=SUPPORT_CATALOG_DATA[k];if(!e)continue;if((e.nameRu||e.name||k).toLowerCase().includes(q))results.push({id:k,name:e.nameRu||e.name||k,tier:e.tier||'—'});}
                          return results.slice(0,14).map(({id,name,tier})=>{const inPlan=effectiveLevel?.subs?.includes(id)||enhancedSubs?.includes(id);const tc={core:'#22c55e',standard:'#f59e0b',advanced:'#f97316',specialty:'#ef4444'};
                            return <div key={id} onClick={()=>{if(!inPlan){setEnhancedSubs(p=>[...p,id]);setSubSearch('');showToast('+ '+name,'success');}}} style={{padding:'5px 10px',borderRadius:8,fontSize:8,cursor:inPlan?'default':'pointer',opacity:inPlan?0.5:1,background:inPlan?'rgba(0,230,138,0.08)':'rgba(255,255,255,0.03)',border:'1px solid '+(inPlan?'rgba(0,230,138,0.2)':'var(--border)'),color:inPlan?'var(--accent)':'var(--text-light)',display:'flex',gap:4,alignItems:'center'}}><span style={{flex:1}}>{name}</span><span style={{padding:'1px 5px',borderRadius:3,fontSize:6,fontWeight:600,background:(tc[tier]||'#fff')+'18',color:tc[tier]||'var(--text-dim)'}}>{inPlan?'✓':tier}</span></div>;});})()}
                      </div>
                    )}
                  </div>

                  {/* ===== SUBSTANCE DETAIL LIST (D3: click to expand) ===== */}
                  {(() => {
                    // Sort subs by time of day (morning → afternoon → evening → other)
                    const sortOrder: Record<string, number> = { утро: 0, 'утро,': 0, натощак: 0, день: 1, обед: 1, вечер: 2, 'на ночь': 2, ночь: 2 };
                    const timedSubs = [...(effectiveLevel?.subs || [])].sort((a, b) => {
                      const ta = effectiveLevel?.dosages?.[a]?.timing?.toLowerCase() || '';
                      const tb = effectiveLevel?.dosages?.[b]?.timing?.toLowerCase() || '';
                      const sa = Object.entries(sortOrder).find(([k]) => ta.includes(k))?.[1] ?? 3;
                      const sb = Object.entries(sortOrder).find(([k]) => tb.includes(k))?.[1] ?? 3;
                      return sa - sb;
                    });
                    return (
                    <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'40vh', overflowY:'auto', marginBottom:8 }}>
                      {timedSubs.map((id: string) => {
                      const sub = allSupport.find((s: any) => s.id === id);
                      const d = effectiveLevel?.dosages?.[id];
                      const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                      const catalogEntry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
                      const isExpanded = expandedCategories[id];
                      return sub ? (
                        <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', fontSize:9, cursor:'pointer' }}
                          onClick={() => setExpandedCategories(p => ({ ...p, [id]: !p[id] }))}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:10, transform: isExpanded ? 'rotate(90deg)':'none', transition:'0.2s' }}>▶</span>
                              <span style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</span>
                            </div>
                            <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                              {d && <span style={{ color:'#00e68a', fontSize:8, fontWeight:600 }}>{d.mg >= 5000 ? `${(d.mg/1000).toFixed(1)} г` : `${d.mg} мг`} — {d.timing}</span>}
                              <span onClick={(e) => {
                                e.stopPropagation();
                                // Find analogs and offer replacement via search pre-fill
                                const analogs = catalogEntry?.analog || [];
                                if (analogs.length > 0) {
                                  // Replace with first analog directly
                                  const analog = analogs[0];
                                  const analogEntry = SUPPORT_CATALOG_DATA[analog] || SUPPORT_CATALOG_DATA[analog.toUpperCase()];
                                  if (analogEntry) {
                                    setEnhancedSubs(prev => {
                                      const next = prev.filter(s => s !== id);
                                      if (!next.includes(analog)) next.push(analog);
                                      return next;
                                    });
                                    showToast(`🔁 ${sub.name} → ${analogEntry.nameRu || analogEntry.name}`, 'success');
                                  }
                                } else {
                                  // No known analog — open search for this substance
                                  const subName = (sub.name || id).toLowerCase();
                                  setSubSearch(subName);
                                  showToast('🔍 Введите аналог в поиске', 'warning');
                                }
                              }} style={{ cursor:'pointer', fontSize:10, color:'#818cf8', padding:'0 4px', lineHeight:1 }} title="Заменить аналогом">🔁</span>
                              <span onClick={(e) => { e.stopPropagation(); setEnhancedSubs(prev => prev.filter(s => s !== id)); }} style={{ cursor:'pointer', fontSize:10, color:'#ef4444', padding:'0 4px', lineHeight:1 }} title="Удалить из плана">✕</span>
                            </div>
                          </div>
                          {planInfo?.comment && !isExpanded && (
                            <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, paddingLeft:4, borderLeft:'2px solid rgba(0,230,138,0.3)' }}>
                              {planInfo.comment.split(';')[0]}
                              {planResult?.mechanisms && (
                                (() => {
                                  const coveredMechs = planResult.mechanisms.filter((m: any) => (m.substances || []).includes(id));
                                  if (coveredMechs.length > 0) {
                                    return <span style={{ color:'#60a5fa', marginLeft:4 }}>({coveredMechs.length} мех.)</span>;
                                  }
                                  return null;
                                })()
                              )}
                            </div>
                          )}
                          {/* D3: Expanded detail card */}
                          {isExpanded && (
                            <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(0,0,0,0.08)', fontSize:8, lineHeight:1.4 }}>
                              {planInfo?.comment && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'var(--accent)' }}>Назначение: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{planInfo.comment}</span>
                                </div>
                              )}
                              {/* Why this substance — tie breaker info */}
                              <div style={{ marginBottom:4, display:'flex', flexWrap:'wrap', gap:3 }}>
                                {(() => {
                                  const mechCount = planResult?.mechanisms?.filter((m: any) => (m.substances || []).includes(id)).length || 0;
                                  if (!mechCount) return null;
                                  return <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(96,165,250,0.08)', color:'#60a5fa' }}>
                                    {mechCount} механизмов
                                  </span>;
                                })()}
                                {planInfo?.fromJoint && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>Суставы 🦴</span>}
                                {planInfo?.fromBoost && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>Усиление 🔥</span>}
                                {/* Count synergy partners in current plan */}
                                {(() => {
                                  if (!catalogEntry?.synergies) return null;
                                  const planIds = new Set(effectiveLevel?.subs || []);
                                  const partners = catalogEntry.synergies.filter((s: any) => planIds.has(s.with));
                                  if (!partners.length) return null;
                                  return <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(34,197,94,0.08)', color:'#22c55e' }}>
                                    ⊕ {partners.length} синергий в плане
                                  </span>;
                                })()}
                                {catalogEntry?.analog?.length ? (
                                  <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(129,140,248,0.08)', color:'#818cf8' }}>
                                    {catalogEntry.analog.length} аналогов
                                  </span>
                                ) : null}
                              </div>
                              {catalogEntry?.mechanismOfAction && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#8b5cf6' }}>Механизм: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.mechanismOfAction}</span>
                                </div>
                              )}
                              {planResult?.mechanisms && (() => {
                                const mechsForSub = planResult.mechanisms.filter((m: any) => (m.substances || []).includes(id));
                                if (mechsForSub.length === 0) return null;
                                return (
                                  <div style={{ marginBottom:4 }}>
                                    <span style={{ fontWeight:600, color:'#60a5fa' }}>Покрывает механизмы: </span>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                      {mechsForSub.map((m: any, i: number) => (
                                        <span key={i} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(96,165,250,0.08)', color:'#60a5fa' }}>
                                          {m.systemLabel ? `${m.systemLabel}: ` : ''}{m.mechLabel || m.mechKey}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              {catalogEntry?.clinicalEffect && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#22c55e' }}>Эффект: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.clinicalEffect}</span>
                                </div>
                              )}
                              {catalogEntry?.description && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Описание: </span><span style={{color:'var(--text-dim)',fontSize:7,lineHeight:1.3}}>{catalogEntry.description}</span></div>)}
                              {catalogEntry?.forms && catalogEntry.forms.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Формы выпуска: </span>{catalogEntry.forms.map((f,i)=><span key={i} style={{fontSize:6,color:f.best?'#22c55e':'var(--text-dim)',marginLeft:4}}>{f.best?'★ ':''}{f.nameRu||f.name} ({f.dose})</span>)}</div>)}
                              {catalogEntry?.organs && catalogEntry.organs.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#60a5fa',fontSize:7}}>Органы: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.organs.join(', ')}</span></div>)}
                              {catalogEntry?.systems && catalogEntry.systems.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#8b5cf6',fontSize:7}}>Системы: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.systems.join(', ')}</span></div>)}
                              {catalogEntry?.sideEffects && catalogEntry.sideEffects.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#ef4444',fontSize:7}}>Побочные: </span><span style={{color:'#ef4444',fontSize:6}}>{catalogEntry.sideEffects.slice(0,4).join('; ')}</span></div>)}
                              {catalogEntry?.monitoring && catalogEntry.monitoring.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#60a5fa',fontSize:7}}>Мониторинг: </span><div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>{catalogEntry.monitoring.map((m:any,i:number)=><div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(96,165,250,0.04)',display:'flex',gap:4}}><span style={{color:'#60a5fa',fontWeight:600}}>{m.what}</span><span style={{color:'var(--text-dim)'}}>— {m.when}</span>{m.targetRange&&<span style={{color:'#f59e0b'}}>→ {m.targetRange}</span>}</div>)}</div></div>)}
                              {catalogEntry?.dosage && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'var(--accent)',fontSize:7}}>Дозировка: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.dosage.mg}мг — {catalogEntry.dosage.timing}{catalogEntry.dosage.form?' ('+catalogEntry.dosage.form+')':''}</span></div>)}
                              {catalogEntry?.specialInstructions && catalogEntry.specialInstructions.length>0 && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#f59e0b',fontSize:7}}>Особые указания: </span><div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>{catalogEntry.specialInstructions.map((si: string, i: number) => <div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(245,158,11,0.04)',color:'var(--text-dim)'}}>• {si}</div>)}</div></div>)}
                              {catalogEntry?.targetOrgan && (<div style={{marginBottom:4}}><span style={{fontWeight:600,color:'#8b5cf6',fontSize:7}}>Орган-мишень: </span><span style={{fontSize:6,color:'var(--text-dim)'}}>{catalogEntry.targetOrgan}</span></div>)}
                              {catalogEntry?.bestForm && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#f59e0b' }}>Лучшая форма: </span>
                                  <span style={{ color:'var(--text-dim)' }}>{catalogEntry.bestForm}</span>
                                </div>
                              )}
                              {catalogEntry?.synergies && catalogEntry.synergies.length > 0 && (
                                <div style={{ marginBottom:4 }}>
                                  <span style={{ fontWeight:600, color:'#22c55e' }}>Синергии: </span>
                                  <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2 }}>
                                    {catalogEntry.synergies.map((syn: any, i: number) => {
                                      const synName = syn.with;
                                      const synEntry = SUPPORT_CATALOG_DATA[synName] || SUPPORT_CATALOG_DATA[synName.toUpperCase()];
                                      const displayName = synEntry?.nameRu || synEntry?.name || synName;
                                      const sevColor = syn.severity === 'HIGH' ? '#22c55e' : syn.severity === 'MEDIUM' ? '#eab308' : '#6b7280';
                                      return (
                                        <div key={i} style={{ fontSize:7, padding:'3px 6px', borderRadius:4, background:'rgba(34,197,94,0.04)', display:'flex', gap:4 }}>
                                          <span style={{ color:'#22c55e', fontWeight:600, minWidth:50 }}>⊕ {displayName}</span>
                                          <span style={{ color:'var(--text-dim)', flex:1 }}>{syn.effect}</span>
                                          <span style={{ color:sevColor, fontWeight:600, fontSize:6 }}>{syn.severity}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {catalogEntry?.contraindications && catalogEntry.contraindications.length > 0 && (
                                <div style={{marginBottom:4}}>
                                  <span style={{ fontWeight:600, color:'#ef4444', fontSize:7 }}>Противопоказания: </span>
                                  <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:1}}>
                                    {catalogEntry.contraindications.map((c: string, i: number) => (
                                      <span key={i} style={{fontSize:6,padding:'1px 5px',borderRadius:3,background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{c}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {catalogEntry?.conflicts && catalogEntry.conflicts.length > 0 && (
                                <div style={{marginBottom:4}}>
                                  <span style={{ fontWeight:600, color:'#ef4444', fontSize:7 }}>Конфликты: </span>
                                  <div style={{display:'flex',flexDirection:'column',gap:1,marginTop:2}}>
                                    {catalogEntry.conflicts.map((c: any, i: number) => (
                                      <div key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(239,68,68,0.04)',display:'flex',gap:4}}>
                                        <span style={{color:'#ef4444',fontWeight:600,minWidth:50}}>⊖ {c.with}</span>
                                        <span style={{color:'var(--text-dim)',flex:1}}>{c.effect}</span>
                                        <span style={{color:c.severity==='HIGH'?'#ef4444':c.severity==='MEDIUM'?'#eab308':'#6b7280',fontWeight:600,fontSize:6}}>{c.severity}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                    );
                  })()}

                  {/* ===== SYNERGY COMMENT CARD ===== */}
                  {planResult?.synergyComment && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>⚡ Принцип синергии стека</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                        {planResult.synergyComment}
                      </div>
                    </div>
                  )}

                  {/* ===== INTERACTION MATRIX ===== */}
                  {planResult?.substances && planResult.substances.length > 4 && (
                    <details style={{marginBottom:10}}>
                      <summary style={{fontSize:10,fontWeight:700,color:'#22c55e',cursor:'pointer',marginBottom:4}}>🔗 Матрица взаимодействий в стеке</summary>
                      <div style={{padding:'6px',borderRadius:8,background:'rgba(34,197,94,0.03)',border:'1px solid rgba(34,197,94,0.1)',overflowX:'auto'}}>
                        {(()=>{const subs=planResult.substances.slice(0,12);const ints=[];for(let i=0;i<subs.length;i++){for(let j=i+1;j<subs.length;j++){const ea=SUPPORT_CATALOG_DATA[subs[i].id];if(!ea)continue;if(ea.synergies)for(const s of ea.synergies){if(s.with===subs[j].id||s.with.toUpperCase()===subs[j].id.toUpperCase())ints.push({a:subs[i].name,b:subs[j].name,t:'⊕',e:s.effect?.slice(0,60)});}if(ea.conflicts)for(const c of ea.conflicts){if(c.with===subs[j].id||c.with.toUpperCase()===subs[j].id.toUpperCase())ints.push({a:subs[i].name,b:subs[j].name,t:'⊖',e:c.effect?.slice(0,60)});}}}if(!ints.length)return <span style={{fontSize:8,color:'var(--text-dim)'}}>Нет известных взаимодействий.</span>;return <div><div style={{fontWeight:600,color:'var(--text-light)',marginBottom:4,fontSize:8}}>Найдено {ints.length} взаимодействий:</div>{ints.map((x,i)=><div key={i} style={{marginBottom:2,padding:'3px 8px',borderRadius:4,background:x.t==='⊖'?'rgba(239,68,68,0.05)':'rgba(34,197,94,0.03)',fontSize:7}}><span style={{color:'var(--text-light)',fontWeight:600}}>{x.a}</span><span style={{color:x.t==='⊖'?'#ef4444':'#22c55e',fontWeight:700,margin:'0 4px'}}>{x.t}</span><span style={{color:'var(--text-light)',fontWeight:600}}>{x.b}</span><span style={{color:'var(--text-dim)'}}> — {x.e}</span></div>)}</div>;})()}
                        <div style={{display:'flex',gap:12,marginTop:6,fontSize:7}}><span style={{color:'#22c55e'}}>⊕ Синергия</span><span style={{color:'#ef4444'}}>⊖ Конфликт</span></div>
                      </div>
                    </details>
                  )}
                  {/* ===== RISK DYNAMICS CARD ===== */}

                  {/* ===== LAB FINDINGS CARD ===== */}
                  {planResult?.labFindings && planResult.labFindings.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🔬 Находки по анализам</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.labFindings.map((lf: any, i: number) => (
                          <div key={i} style={{ marginBottom:4, padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.03)' }}>
                            <span style={{ fontWeight:600, color:'#f59e0b' }}>{lf.name}</span>
                            <span style={{ color:'var(--text-dim)' }}>: {lf.value} (норма: {lf.threshold})</span>
                            {lf.suggestedSubs.length > 0 && (
                              <div style={{ fontSize:7, color:'#22c55e', marginTop:2 }}>
                                💊 Рекомендовано: {lf.suggestedSubs.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===== COVERAGE GAPS CARD ===== */}
                  {planResult?.coverageGaps && planResult.coverageGaps.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Системы с недостаточным покрытием</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.coverageGaps.map((gap: any, i: number) => (
                          <div key={i} style={{ marginBottom:3 }}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:1}}><span style={{fontWeight:600,color:'var(--text-light)'}}>{gap.label}</span><span style={{color:'#ef4444',fontSize:7}}>{gap.raw}% → {gap.net}%</span></div><div style={{height:5,borderRadius:3,background:'rgba(239,68,68,0.1)',overflow:'hidden',marginBottom:1}}><div style={{width:`${100-gap.gapPercent}%`,height:'100%',borderRadius:3,background:'#ef4444'}}/></div><div style={{fontSize:7,color:'var(--text-dim)',marginBottom:3}}>Покрыто {100-gap.gapPercent}% · Рекомендуется повысить уровень</div><span style={{fontWeight:600,color:'var(--text-light)'}}>{gap.label}</span>: риск {gap.raw}% → {gap.net}% (покрыто {100-gap.gapPercent}%)
                            <div style={{ height:4, borderRadius:2, background:'rgba(239,68,68,0.15)', marginTop:2, overflow:'hidden' }}>
                              <div style={{ width:`${100 - gap.gapPercent}%`, height:'100%', borderRadius:2, background:'#ef4444' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===== UNCOVERED MECHANISMS CARD ===== */}
                  {planResult?.uncoveredMechanisms && planResult.uncoveredMechanisms.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', cursor:'pointer', marginBottom:4 }}>🔍 Непокрытые механизмы ({planResult.uncoveredMechanisms.length})</summary>
                      <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.1)', fontSize:7, color:'var(--text-dim)', lineHeight:1.4, maxHeight:'25vh', overflowY:'auto' }}>
                        {planResult.uncoveredMechanisms.map((um,i)=>{const sev=um.risk>30?'⚠️':um.risk>15?'⚡':'·';return <div key={i} style={{marginBottom:2}}>{sev} <b>{um.systemLabel}</b> → {um.mechLabel} (риск:{um.risk}%)</div>;})}
                        <div style={{marginTop:4,fontSize:6,color:'var(--text-dim)'}}>⚠️ Критический &gt;30% · ⚡ Повышенный &gt;15% · · Низкий</div>
                      </div>
                    </details>
                  )}

                  {/* ===== STACK RECOMMENDATIONS CARD ===== */}
                  {planResult?.stackRecommendations && planResult.stackRecommendations.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>🧩 Рекомендованные стеки</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.stackRecommendations.slice(0, 3).map((sr: any, i: number) => (
                          <div key={i} style={{ marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.06)', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                              <span style={{ fontWeight:700, color:'var(--text-light)', fontSize:9 }}>{sr.stack.name}</span>
                              <div style={{ display:'flex', gap:4 }}>
                                <span style={{ fontSize:8, fontWeight:700, color: sr.score >= 70 ? '#22c55e' : sr.score >= 40 ? '#f59e0b' : 'var(--text-dim)' }}>
                                  {sr.score}/100</span>{sr.score>=70&&sr.coveredSystems.length>=3&&<span style={{fontSize:7,color:'#22c55e'}}>Авто</span>}<button onClick={(e)=>{e.stopPropagation();const ns=sr.stack.substances.map((s:any)=>s.id).filter((id:string)=>!effectiveLevel?.subs?.includes(id));if(ns.length>0){setEnhancedSubs((p:string[])=>[...new Set([...p,...ns])]);showToast('+ Стек ('+ns.length+')','success');}else showToast('Уже в плане','warning');}} style={{marginLeft:'auto',padding:'2px 8px',borderRadius:6,fontSize:7,fontWeight:700,cursor:'pointer',background:'rgba(0,230,138,0.1)',border:'1px solid rgba(0,230,138,0.3)',color:'var(--accent)'}}>+ В план</button>
                              </div>
                            </div>

                  {/* ===== C2: WHAT-IF ANALYZER ===== */}
                  {calcDone && effectiveLevel?.subs && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b' }}>🔬 What-If анализ</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)' }}>Оцените влияние каждого вещества на риски</span>
                      </div>
                      {(effectiveLevel?.subs || []).slice(0, 8).map((id: string) => {
                        const sub = allSupport.find((s: any) => s.id === id);
                        const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                        const isWhatIf = expandedCategories[`whatif_${id}`];
                        const coveredMechs = planResult?.mechanisms?.filter((m: any) => (m.substances || []).includes(id)) || [];
                        return sub ? (
                          <div key={id} style={{ marginBottom:3, padding:'4px 8px', borderRadius:6, background:'rgba(0,0,0,0.04)', fontSize:8, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}
                            onClick={() => setExpandedCategories(p => ({ ...p, [`whatif_${id}`]: !p[`whatif_${id}`] }))}>
                            <span style={{ fontWeight:600, color:'var(--text-light)', flex:1 }}>{sub.name}</span>
                            {isWhatIf ? (
                              <span style={{ color:'#ef4444', fontSize:7 }}>
                                Без: +{Math.round(planInfo?.doseMg ? planInfo.doseMg / 50 : 5)}% риска · Покрывает {coveredMechs.length} мех.
                              </span>
                            ) : (
                              <span style={{ color:'var(--text-dim)', fontSize:7 }}>Покрывает {coveredMechs.length} мех. — нажмите для анализа</span>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                            <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:2 }}>{sr.reason}</div>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {sr.stack.substances.slice(0, 5).map((sub: any, j: number) => (
                                <span key={j} style={{ padding:'1px 5px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'var(--accent)', fontSize:7 }}>{sub.id}</span>
                              ))}
                              {sr.stack.substances.length > 5 && <span style={{ fontSize:7, color:'var(--text-dim)' }}>+{sr.stack.substances.length - 5}</span>}
                            </div>
                            {sr.wasteSubstances && sr.wasteSubstances.length > 0 && (
                              <div style={{ fontSize:6, color:'#ef4444', marginTop:2 }}>⚠ Избыточно: {sr.wasteSubstances.join(', ')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4 }}>
                        💡 Стеки оцениваются по покрытию рисков, синергии и отсутствию избыточных веществ.
                        Приоритет — стеки, которые закрывают максимум механизмов минимумом препаратов.
                      </div>
                    </div>
                  )}

                  {/* ===== RISK DYNAMICS CARD ===== */}
                  {planResult?.riskDynamics && planResult.riskDynamics.length > 0 && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📈 Динамика рисков по системам</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {planResult.riskDynamics.map((rd: any) => {
                          const sysLabelMap: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Эндокр.', hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'ОДА' };
                          const sysLabel = sysLabelMap[rd.system as string] || rd.system;
                          const delta = rd.before - rd.after;
                          const color = delta > 20 ? '#22c55e' : delta > 10 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={rd.system} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                              <span style={{ width:50, fontWeight:600, color:'var(--text-light)' }}>{sysLabel}</span>
                              <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,0.05)', position:'relative', overflow:'hidden' }}>
                                <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${rd.before}%`, borderRadius:3, background:'rgba(239,68,68,0.3)', transition:'width 0.5s' }} />
                                <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${rd.after}%`, borderRadius:3, background:color, transition:'width 0.5s', opacity:0.7 }} />
                              </div>
                              <span style={{ fontSize:7, minWidth:70, textAlign:'right' }}>
                                <span style={{ color:'#ef4444' }}>{rd.before}%</span> → <span style={{ color, fontWeight:600 }}>{rd.after}%</span>
                                <span style={{ color, fontSize:6, marginLeft:2 }}>({delta > 0 ? `-${delta}` : delta}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:6, textAlign:'center' }}>
                        Общий риск: <b style={{ color:'#ef4444' }}>{planResult.overallRiskBefore}%</b> → <b style={{ color:'#22c55e' }}>{planResult.overallRiskAfter}%</b>
                        {' · '}Покрытие систем: <b style={{ color:'var(--accent)' }}>{planResult.coveragePercent}%</b>
                      </div>
                    </div>
                  )}

                  {/* ===== RISK BREAKDOWN ===== */}
                  {planResult?.riskBreakdown && Object.keys(planResult.riskBreakdown).length > 0 && (
                    <details style={{marginBottom:10}}>
                      <summary style={{fontSize:10,fontWeight:700,color:'#ef4444',cursor:'pointer',marginBottom:4}}>🔍 Источники риска по системам</summary>
                      <div style={{padding:'8px 10px',borderRadius:8,background:'rgba(239,68,68,0.03)',border:'1px solid rgba(239,68,68,0.12)'}}>
                        <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.5}}>
                          {Object.entries(planResult.riskBreakdown).map(([sys, reasons]) => {
                            const m:Record<string,string>={cardio:'ССС',hepatic:'Печень',renal:'Почки',neuro:'НС',endocrine:'Энд.',hematologic:'Кровь',reproductive:'Реп.',musculoskeletal:'ОДА'};
                            const raw=planResult.systems?.[sys]?.raw||0;
                            if(!raw&&!(reasons as string[]).length)return null;
                            return <div key={sys} style={{marginBottom:6,padding:'4px 8px',borderRadius:6,background:'rgba(0,0,0,0.04)',border:'1px solid var(--border)'}}><div style={{fontWeight:700,color:'var(--text-light)',marginBottom:3}}>{m[sys]||sys} — риск <span style={{color:'#ef4444'}}>{raw}%</span></div>{(reasons as string[]).map((r,i)=><div key={i} style={{fontSize:7,paddingLeft:6,borderLeft:'2px solid rgba(239,68,68,0.2)',marginBottom:1}}>{r}</div>)}</div>;
                          })}
                        </div>
                        <div style={{fontSize:7,color:'var(--text-dim)',marginTop:4}}>💡 Риски рассчитаны на основе профиля, препаратов курса (PHARMA_DB: linkedRisks, cvProfile, pd), анализов (80+ маркеров), истории циклов и противопоказаний.</div>
                      </div>
                    </details>
                  )}
                  {/* ===== C3: MECHANISM COVERAGE MATRIX ===== */}
                  {planResult?.mechanisms && planResult.mechanisms.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', cursor:'pointer', marginBottom:4 }}>🧬 Матрица покрытия механизмов</summary>
                      <div style={{ padding:'6px', borderRadius:8, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.12)', overflowX:'auto' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'auto repeat(8, 1fr)', gap:2, minWidth:600 }}>
                          {(() => {
                            const allSyss = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];
                            const maxMechs = 8;
                            const sysLabels: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Энд.', hematologic:'Кровь', reproductive:'Реп.', musculoskeletal:'ОДА' };
                            // Header row
                            const header= [<div key="h" style={{ fontSize:7, color:'var(--text-dim)', padding:'2px', fontWeight:600 }}>Мех.</div>];
                            for (const sys of allSyss) {
                              header.push(<div key={sys} style={{ fontSize:7, color:'var(--text-light)', padding:'2px', fontWeight:600, textAlign:'center' }}>{sysLabels[sys]}</div>);
                            }
                            // Mechanism rows
                            const rows = [];
                            for (let m = 1; m <= maxMechs; m++) {
                              const cells = [<div key={`m${m}`} style={{ fontSize:7, color:'var(--text-dim)', padding:'2px 4px' }}>M{m}</div>];
                              for (const sys of allSyss) {
                                const mechKey = `${sys}_${m}`;
                                const mech = planResult.mechanisms.find((mc: any) => mc.mechKey === mechKey);
                                const uncovered = planResult.uncoveredMechanisms?.some((um: any) => um.mechKey === mechKey);
                                const risk = planResult.systems?.[sys]?.raw || 0;
                                let color = 'rgba(255,255,255,0.03)';
                                let text = '';
                                let tooltip = '';
                                if (mech && mech.substances.length > 0) {
                                  color = '#22c55e';
                                  text = mech.substances.length.toString();
                                  tooltip = `${mech.mechLabel}: ${mech.substances.join(', ')}`;
                                } else if (uncovered && risk > 0) {
                                  color = '#ef4444';
                                  text = '!';
                                  tooltip = `${sysLabels[sys]} не покрыто`;
                                } else if (risk > 0) {
                                  color = 'rgba(239,68,68,0.2)';
                                  text = '·';
                                }
                                cells.push(
                                  <div key={`${sys}_${m}`} title={tooltip}
                                    style={{ fontSize:7, fontWeight:600, color: text === '!' ? '#fff' : '#fff',
                                      background: color, borderRadius:3, padding:'3px 1px', textAlign:'center',
                                      minWidth:18, cursor:tooltip?'help':'default', opacity: color==='#22c55e' ? 0.9 : color.includes('239') ? 0.4 : 0.8 }}>
                                    {text}
                                  </div>
                                );
                              }
                              rows.push(<React.Fragment key={`r${m}`}>{cells}</React.Fragment>);
                            }
                            return [...header, ...rows];
                          })()}
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:6, fontSize:7, color:'var(--text-dim)' }}>
                          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#22c55e', marginRight:2, verticalAlign:'middle' }} /> Покрыто (N веществ)</span>
                          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#ef4444', marginRight:2, verticalAlign:'middle' }} /> Не покрыто</span>
                          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'rgba(239,68,68,0.2)', marginRight:2, verticalAlign:'middle' }} /> Низкий риск</span>
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== MONITORING CARD ===== */}
                  {planResult?.monitoring && planResult.monitoring.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#f59e0b', cursor:'pointer', marginBottom:4 }}>📊 Мониторинг: что и когда контролировать</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.12)' }}>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          {planResult.monitoring.slice(0, 12).join('\n')}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== SPECIAL INSTRUCTIONS CARD ===== */}
                  {planResult?.specialInstructions && planResult.specialInstructions.length > 0 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#ef4444', cursor:'pointer', marginBottom:4 }}>⚠️ Особые указания по совмещению</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.12)' }}>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          {planResult.specialInstructions.join('\n')}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== C4: CHANGE HISTORY ===== */}
                  {planHistory.length > 1 && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#60a5fa', cursor:'pointer', marginBottom:4 }}>📜 История изменений плана ({planHistory.length})</summary>
                      <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.1)', fontSize:7, color:'var(--text-dim)', maxHeight:'20vh', overflowY:'auto' }}>
                        {planHistory.slice().reverse().map((h, i) => (
                          <div key={i} style={{ marginBottom:3, padding:'3px 6px', borderRadius:4, background:'rgba(0,0,0,0.04)', display:'flex', justifyContent:'space-between' }}>
                            <span>{h.date}</span>
                            <span style={{ fontWeight:600, color:'var(--accent)' }}>{SUPPORT_LEVELS[h.level]?.label || h.level}</span>
                            <span>{h.subs.length} вещ.</span>
                            <span style={{ color: h.riskAfter < h.riskBefore ? '#22c55e' : '#ef4444' }}>{h.riskBefore}%→{h.riskAfter}%</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* ===== WEEKLY DOSE TIMELINE ===== */}
                  {planResult?.substances && planResult.substances.length > 0 && (
                    <details style={{marginBottom:10}}>
                      <summary style={{fontSize:10,fontWeight:700,color:'#60a5fa',cursor:'pointer',marginBottom:4}}>📅 Динамика доз по неделям (1→12)</summary>
                      <div style={{padding:'6px',borderRadius:8,background:'rgba(96,165,250,0.03)',border:'1px solid rgba(96,165,250,0.1)',overflowX:'auto'}}>
                        <table style={{width:'100%',fontSize:7,borderCollapse:'collapse',minWidth:400}}>
                          <thead><tr style={{borderBottom:'1px solid var(--border)'}}><th style={{padding:'2px 4px',textAlign:'left',color:'var(--text-dim)'}}>Вещество</th>{[1,2,4,6,8,12].map(w=><th key={w} style={{padding:'2px 4px',textAlign:'center',color:w===courseWeekState?'var(--accent)':'var(--text-dim)',fontWeight:w===courseWeekState?700:400}}>{w}н{w===courseWeekState?'✦':''}</th>)}</tr></thead>
                          <tbody>{planResult.substances.slice(0,10).map((sub:PlanSubstance)=>{const bd=sub.doseMg/((sub.fromBoost||sub.fromJoint)?1.5:1);return <tr key={sub.id} style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'2px 4px',fontWeight:600,color:'var(--text-light)'}}>{sub.name}</td>{[1,2,4,6,8,12].map(w=>{const ws=w<=2?0.6:w<=4?0.8:w<=6?0.9:1;const wd=Math.round(bd*ws*(w>=8?1.3:w>=4?1.1:1));const ic=w===courseWeekState;return <td key={w} style={{padding:'2px 4px',textAlign:'center',fontWeight:ic?700:400,color:ic?'#00e68a':'var(--text-dim)',background:ic?'rgba(0,230,138,0.06)':'transparent'}}>{wd>=5000?(wd/1000).toFixed(1)+'г':wd+'мг'}</td>;})}</tr>;})}</tbody>
                        </table>
                        <div style={{fontSize:7,color:'var(--text-dim)',marginTop:4}}>✦ Текущая неделя · 1-2: старт (60%) · 3-4: разгон (80%) · 5-6: плато (90%) · 7+: полные дозы (100%)</div>
                      </div>
                    </details>
                  )}
                  {/* ===== C5: DOCTOR'S CONCLUSION ===== */}
                  {planResult && (
                    <details style={{ marginBottom:10 }}>
                      <summary style={{ fontSize:10, fontWeight:700, color:'#60a5fa', cursor:'pointer', marginBottom:4 }}>👨‍⚕️ Заключение для врача</summary>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.15)' }}>
                        <div style={{ fontSize:9, color:'var(--text-light)', lineHeight:1.5, whiteSpace:'pre-line' }}>
                          <div style={{ fontWeight:700, marginBottom:4 }}>📋 ОБОСНОВАНИЕ НАЗНАЧЕНИЙ</div>
                          <div style={{ fontSize:8 }}>
                            {`Пациент: ${linked.profile?.settings?.sex === 'female' ? 'женщина' : 'мужчина'}, ${linked.profile?.settings?.age || '?'} лет, ${linked.profile?.settings?.weight || '?'} кг.
Курс: ${(linked.course || []).map((c: any) => c.substanceId).join(', ') || 'не указан'}.
Уровень поддержки: ${SUPPORT_LEVELS[supportLevel]?.label || supportLevel}.
Общий риск: ${planResult.overallRiskBefore}% → ${planResult.overallRiskAfter}% (снижение ${planResult.overallRiskBefore - planResult.overallRiskAfter}%).
Покрытие систем: ${planResult.coveragePercent}%.

НАЗНАЧЕНО (${planResult.substances.length} препаратов):
${planResult.substances.map(s => `• ${s.name} — ${s.doseDisplay} [${s.tier}] — ${s.comment}`).join('\n')}

СИНЕРГИИ В НАЗНАЧЕНИИ:
${planResult.synergyComment.split('\n').filter(l => l.startsWith('•')).join('\n')}

МОНИТОРИНГ:
${planResult.monitoring.join('\n')}
${planResult.labFindings.length > 0 ? '\nОТКЛОНЕНИЯ АНАЛИЗОВ:\n' + planResult.labFindings.map(lf => `• ${lf.name}: ${lf.value} (норма: ${lf.threshold}); рекомендовано: ${lf.suggestedSubs.join(', ')}`).join('\n') : ''}

ПРОГНОЗ: При соблюдении плана поддержки ожидается снижение общего риска до ${planResult.overallRiskAfter}%. Необходим контроль маркеров согласно графику мониторинга.${planResult.coverageGaps.length > 0 ? `\n⚠ Внимание: ${planResult.coverageGaps.map(g => g.label).join(', ')} — имеют недостаточное покрытие. Рекомендуется повысить уровень поддержки или добавить целевые препараты.` : ''}`}
                          </div>
                        </div>
                      </div>
                    </details>
                  )}

                  {/* ===== C1: PLAN COMPARISON (База vs Текущий) ===== */}
                  {planResult && supportLevel !== 'basic' && (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>⚖ Сравнение с базовым уровнем</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                        {(() => {
                          const s = linked.profile?.settings;
                          const h = hydrateState();
                          const aasList = (linked.course || []).filter((c: any) => {
                            const ph = PHARMA_DB[c.substanceId];
                            return ph?.class && ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'].includes(ph.class);
                          }).map((c: any) => ({ id: c.substanceId || '', doseMgWeek: (c.doseValue || 0) * (c.frequency || 1), weeks: (c.endWeek || 12) - (c.startWeek || 0) }));
                          const baseState: CalculatorState = {
                            profile: { weight: s?.weight ?? 80, age: s?.age ?? 30, sex: (s?.sex ?? 'male') as 'male'|'female', workoutsPerWeek: s?.workoutsPerWeek ?? 3, avgWorkoutMinutes: s?.avgWorkoutMinutes ?? 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
                            neuro: h.neuro || { dopamineScore:0, serotoninScore:0, gabaBalance:'balance', memoryIssues:false, focusIssues:false, slowThinking:false, coordinationIssues:false, aggressionScore:0, headaches:false, weatherDependent:false, sleepQuality:'good' },
                            pharma: { phase:'course', aas:aasList, hasGH:false, hasIGF:false, hasInsulin:false, hasHCG:false, hasAI:false, hasCaber:false, hasSERM:false, hasSARMs:false, hasMGF:false, hasGLP1:false },
                            goals: h.goals || { healthMaintenance:false, competitionPrep:false, sleepRecovery:false, lipidCorrection:false, bloodThinning:false, liverDetox:false, bpControl:false, trainingCycle:'maintenance', cycleWeeks:12, previousCycles:0, timeSinceLastCycle:'none' },
                            hepatobiliary: h.hepatobiliary || { altAstElevation:'none', ggtElevation:'none', bilirubinElevation:'none', fattyLiver:false, cholecystitis:false, alcoholHistory:'none' },
                            urinary: h.urinary || { creatinineElevation:'none', ureaElevation:'none', proteinuria:false, nephrotoxicDrugs:false, hypertension:false, diabetes:false, urinationPattern:'normal' },
                            cardio: h.cardio || { bpStage:'normal', heartRate:70, ldlElevation:'none', hdlLow:false, triglycerides:'normal', hctElevation:'none', previousCVD:false, familyCVD:false },
                            oda: h.oda || { jointPain:'none', ligamentIssues:false, backPain:false, injuries:[] },
                            nutrition: h.nutrition || { calories:2500, proteinG:160, fatG:70, carbsG:300, waterL:2, saltIntake:'normal', omega3:false, fiberG:25, proteinGPerKg:2, sodiumMg:3000, potassiumMg:3000 },
                            contraindications: h.contraindications || { allergies:'', hasCVD:false, hasThrombophilia:false, hasGI:false, hasProstateIssues:false, hasDiabetes:false, hasEpilepsy:false, hasMentalIllness:false, hasLiverDisease:false, hasKidneyDisease:false },
                            labs: h.labs || { preCourse:null, midCourse:null, postPCT:null, fullPanel:null },
                            journal: h.journal || { positive:[], negative:[] },
                            epicrisis: h.epicrisis || { pastGyno:false, pastLibidoDrop:false, pastHctSpike:false, pastLiverIssues:false, pastKidneyIssues:false },
                            toxicLoad: h.toxicLoad || { hazardousWork:false, regularNSAIDs:false, otherHeavyDrugs:false, bowelFrequency:'regular' },
                            dental: h.dental || { bleedingGums:false, looseTeeth:false, nightGrinding:false, boneFractures:false, cramps:false },
                            genetics: h.genetics || { cyp19a1:'unknown', srd5a2:'unknown', arSensitivity:'unknown', mthfr:'unknown' },
                            gi: h.gi || { bloating:false, heartburn:false, diarrhea:false, constipation:false, diagnosedIBS:false, enzymeSupport:false, probioticUse:false },
                            psych: h.psych || { fearOfLoss:1, mirrorObsession:1, apathyOffCycle:1 },
                            injection: h.injection || { glutes:'ok', quads:'ok', delts:'ok', localAreas:'' },
                            powerLevel: 'basic', courseWeek: courseWeekState,
                          };
                          try {
                            const baseResult = calculateSupportPlan(baseState, 'basic', enhancedSubs, linked.labs);
                            return (
                              <table style={{ width:'100%', fontSize:7, borderCollapse:'collapse' }}>
                                <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
                                  <th style={{ padding:'2px 4px', textAlign:'left', color:'var(--text-dim)' }}>Система</th>
                                  <th style={{ padding:'2px 4px', textAlign:'center', color:'#ef4444' }}>Риск</th>
                                  <th style={{ padding:'2px 4px', textAlign:'center', color:'#22c55e' }}>База</th>
                                  <th style={{ padding:'2px 4px', textAlign:'center', color:'#8b5cf6' }}>{SUPPORT_LEVELS[supportLevel]?.label||supportLevel}</th>
                                </tr></thead>
                                <tbody>{planResult.riskDynamics.map((rd: any) => {
                                  const baseRd = baseResult.riskDynamics.find((b: any) => b.system === rd.system);
                                  const sysNames: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Энд.', hematologic:'Кровь', reproductive:'Реп.', musculoskeletal:'ОДА' };
                                  return (
                                    <tr key={rd.system} style={{ borderBottom:'1px solid var(--border)' }}>
                                      <td style={{ padding:'2px 4px', fontWeight:600, color:'var(--text-light)' }}>{sysNames[rd.system as string] || rd.system}</td>
                                      <td style={{ padding:'2px 4px', textAlign:'center', color:'#ef4444' }}>{rd.before}%</td>
                                      <td style={{ padding:'2px 4px', textAlign:'center', color:'#22c55e' }}>{baseRd?.after || rd.before}%</td>
                                      <td style={{ padding:'2px 4px', textAlign:'center', color:'#8b5cf6', fontWeight:700 }}>{rd.after}%</td>
                                    </tr>
                                  );
                                })}</tbody>
                              </table>
                            );
                          } catch { return <span style={{ color:'var(--text-dim)' }}>Заполните данные для сравнения</span>; }
                        })()}
                      </div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4 }}>
                        💡 Сравнение показывает, насколько текущий уровень снижает риски относительно минимального (База).
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:6 }}>
                    <button style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:10 }} onClick={() => setPlanSaved(true)}>✅ Утвердить план</button>
                    <button onClick={() => { setShowModal('manual'); setModalAddMode(true); setPlanSaved(false); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', background:'transparent', color:'var(--text-dim)', fontWeight:600, fontSize:10 }}>✏️ Внести изменения</button>
                  </div>
                  {/* Timing table when approved */}
                  {planSaved && (
                    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>✅ План утверждён</div>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Зачем назначен</th>
                        </tr></thead>
                        <tbody>
                          {(effectiveLevel?.subs || []).map((id: string) => {
                            const sub = allSupport.find((s: any) => s.id === id);
                            const d = effectiveLevel?.dosages?.[id];
                            const planInfo = planResult?.substances?.find((s: PlanSubstance) => s.id === id);
                            if (!sub || !d) return null;
                            return (
                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)', fontSize:7 }}>{d.timing}</td>
                                <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name}</td>
                                <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg >= 5000 ? `${(d.mg/1000).toFixed(1)} г` : `${d.mg} мг`}</td>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)', maxWidth:250, fontSize:7, lineHeight:1.3 }}>{planInfo?.comment || sub.description || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Synergies in stack */}
                      <div style={{ marginTop:8, fontSize:8, color:'var(--text-dim)' }}>
                        <div style={{ fontWeight:600, color:'var(--text-light)', marginBottom:3 }}>⚡ Синергии в стеке:</div>
                        {effectiveLevel.subs.slice(0, 8).map((id: string, i: number) => {
                          const sub = allSupport.find((s: any) => s.id === id);
                          if (!sub) return null;
                          const syn = ALL_INTERACTIONS.filter((int: any) =>
                            (int.substanceA === id || int.substanceB === id) && int.type === 'synergy'
                          ).slice(0, 2);
                          return syn.length > 0 ? syn.map((s: any, j: number) => (
                            <div key={`${i}-${j}`} style={{ padding:'2px 0' }}>
                              ⊕ {sub.name} + {allSupport.find((x: any) => x.id === (s.substanceA === id ? s.substanceB : s.substanceA))?.name || ''}: {s.effect?.slice(0, 60)}
                            </div>
                          )) : null;
                        })}
                      </div>
                    </div>
                  )}
            </>)}
          </div>
      )}
      
            {/* ==================== ADD 5: INTEGRATION NOTICE ==================== */}
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', display:'flex', alignItems:'flex-start', gap:8 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>🔄</span>
              <div>
                <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:2 }}>Автоматическая синхронизация</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                  Данные обновляются автоматически из вашего профиля, курса и анализов. Измените параметры в Профиле или Анализах для пересчёта.
                </div>
              </div>
            </div>





            {/* ==================== PHASE 4: SAVE & SHARE ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>💾 Сохранить и поделиться</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <button onClick={savePlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid var(--accent)', background:'rgba(0,230,138,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'var(--accent)',
                }}>💾 Сохранить план</button>
                <button onClick={copyPlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #60a5fa', background:'rgba(96,165,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#60a5fa',
                }}>📋 Копировать</button>
                <button onClick={async () => {
                  const text = buildShareText();
                  try {
                    await navigator.clipboard.writeText(text);
                    alert('✅ Текст плана скопирован в буфер обмена');
                  } catch {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: 'План поддержки', text });
                      } else {
                        prompt('📋 Скопируйте текст вручную:', text);
                      }
                    } catch { prompt('📋 Скопируйте текст вручную:', text); }
                  }
                }} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #34d399', background:'rgba(52,211,153,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#34d399',
                }}>📤 Поделиться</button>
                <button onClick={() => alert('Напоминания через Telegram Mini App будут доступны в следующем обновлении.')} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #a78bfa', background:'rgba(167,139,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#a78bfa',
                }}>📅 Напомнить</button>
                <button onClick={exportForDoctor} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #f59e0b', background:'rgba(245,158,11,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#f59e0b',
                }}>👨‍⚕️ Экспорт врачу</button>
              </div>
              {planSavedLocal && (
                <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:6, padding:'4px', borderRadius:6, background:'rgba(34,197,94,0.06)' }}>✅ План сохранён в localStorage</div>
              )}
            </div>



          </div>
        </div>
        );
        } catch(e) { return <div style={{ padding:40, textAlign:'center', color:'#ef4444', background:'var(--bg-secondary)', borderRadius:12, margin:20 }}>⚠️ Ошибка калькулятора: {String(e)}<br/><button onClick={goBack} style={{ marginTop:12, padding:'6px 16px', borderRadius:8, cursor:'pointer', background:'var(--accent)', border:'none', color:'#000', fontWeight:600 }}>← Назад</button></div>; }
      })()}

      {/* ===== TRAINING MIX CALCULATOR ===== */}
      {section === 'info' && tab === 'main' && supportView === 'calc' && calcView === 'mixcalc' && (<InfoErrorBoundary label="Тренировочные миксы">
        <div style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>💪 Тренировочные миксы</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Подбор пред-/интра-/пост-тренировочных стеков по цели и весу</p>

          <div className="card" style={{ marginBottom:10, padding:10 }}>
            <h4 style={{ margin:'0 0 8px', fontSize:11, color:'var(--text)' }}>⚙️ Параметры</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <div>
                <div style={{fontSize:8,fontWeight:600,color:'var(--text-dim)',marginBottom:4}}>🎯 Цели (можно несколько)</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {[{id:'pump',label:'🩸 Памп'},{id:'endurance',label:'🏃 Выносл.'},{id:'strength',label:'🏋️ Сила'},{id:'recovery',label:'🔄 Восст.'},{id:'focus',label:'🧠 Фокус'},{id:'powerlifting',label:'💪 ПЛ'},{id:'competition',label:'🏆 Сорев.'},{id:'crossfit',label:'🔁 CF'},{id:'post_comp',label:'🔄 Пост-сор.'},{id:'hiit',label:'💨 HIIT'},{id:'mma',label:'🥊 MMA'},{id:'sprint',label:'🏃 Спринт'}].map(o => (
                    <div key={o.id} onClick={() => setMixGoals(prev => prev.includes(o.id) ? prev.filter(g => g !== o.id) : [...prev, o.id])} style={{padding:'3px 7px',borderRadius:8,cursor:'pointer',fontSize:7,fontWeight:600,background:mixGoals.includes(o.id)?'rgba(139,92,246,0.2)':'rgba(255,255,255,0.04)',border:mixGoals.includes(o.id)?'1px solid rgba(139,92,246,0.4)':'1px solid rgba(255,255,255,0.08)',color:mixGoals.includes(o.id)?'#a78bfa':'rgba(255,255,255,0.7)',transition:'all 0.15s'}}>{o.label}</div>
                  ))}
                </div>
                {mixGoals.length > 1 && <div style={{fontSize:7,color:'#f59e0b',marginTop:2}}>Выбрано {mixGoals.length} целей · скор = среднее</div>}
              </div>
              <PopupSelect label="⏰ Тайминг" value={mixTiming} options={[{id:'pre',label:'🔥 Пред-тренировочный'},{id:'intra',label:'💧 Интра-тренировочный'},{id:'post',label:'🍗 Пост-тренировочный'}]} onChange={setMixTiming} />
            </div>
            <div style={{ marginBottom:8 }}>
              <PopupNumber label="⚖️ Вес тела (кг)" value={linked.profile?.settings?.weight ?? 80} min={40} max={200} suffix="кг" onChange={()=>{}} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <PopupSelect label="🏋️ Тип тренировки" value={mixWorkoutType} options={[{id:'heavy',label:'🏋️ Тяжёлая (присед/тяга)'},{id:'moderate',label:'🏃 Средняя (подсобка)'},{id:'light',label:'🩸 Лёгкая (пампинг)'}]} onChange={v=>setMixWorkoutType(v as any)} />
              <PopupSelect label="🌅 Время суток" value={mixTimeOfDay} options={[{id:'morning',label:'🌅 Утро (6-12)'},{id:'afternoon',label:'☀️ День (12-18)'},{id:'evening',label:'🌙 Вечер (18-24)'}]} onChange={v=>setMixTimeOfDay(v as any)} />
            </div>
            <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>💉 Фармакология (влияет на скор)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
              <PopupNumber label={mixInsulin>0?'💉 Инсулин ✓':'💉 Инсулин'} value={mixInsulin} min={0} max={20} step={1} suffix="ЕД" onChange={setMixInsulin} />
              <PopupNumber label={mixDrugIGF>0?'🧬 ИГФ-1 ✓':'🧬 ИГФ-1'} value={mixDrugIGF} min={0} max={100} step={10} suffix="мкг" onChange={setMixDrugIGF} />
              <PopupNumber label={mixDrugGH>0?'💉 ГР ✓':'💉 ГР'} value={mixDrugGH} min={0} max={15} step={1} suffix="МЕ" onChange={setMixDrugGH} />
              <PopupNumber label={mixDrugMGF>0?'🧬 МГФ ✓':'🧬 МГФ'} value={mixDrugMGF} min={0} max={500} step={50} suffix="мкг" onChange={setMixDrugMGF} />
              <PopupBool label="💊 ГПП-1" value={mixDrugGLP1} onChange={setMixDrugGLP1} />
            </div>
            {(mixInsulin>0 || mixDrugIGF>0 || mixDrugGH>0 || mixDrugMGF>0) && (
              <div style={{ fontSize:7, color:'#8b5cf6', marginBottom:6, lineHeight:1.3 }}>
                {mixInsulin>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• Инсулин {mixInsulin}ЕД ·</span>
                  <select value={mixInsulinTiming} onChange={e=>setMixInsulinTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugIGF>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• ИГФ-1 {mixDrugIGF}мкг ·</span>
                  <select value={mixDrugIGFTiming} onChange={e=>setMixDrugIGFTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugGH>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• ГР {mixDrugGH}МЕ ·</span>
                  <select value={mixDrugGHTiming} onChange={e=>setMixDrugGHTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugMGF>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• МГФ {mixDrugMGF}мкг ·</span>
                  <select value={mixDrugMGFTiming} onChange={e=>setMixDrugMGFTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
              </div>
            )}
            {(mixInsulin>0 || mixDrugIGF>0 || mixDrugGH>0 || mixDrugMGF>0 || mixDrugGLP1) && (
              <span onClick={()=>{setMixInsulin(0);setMixDrugIGF(0);setMixDrugGH(0);setMixDrugMGF(0);setMixDrugGLP1(false);setCustomRecipeOverrides({removed:[],replaced:{}});localStorage.removeItem('he_mix_recipe_overrides');}}
                style={{fontSize:7,color:'#ef4444',cursor:'pointer',marginLeft:6,textDecoration:'underline'}}>✕ Очистить фарму</span>
            )}
            <button onClick={() => {
              const course = linked.course || [];
              const detect = (kw: string) => course.some((c:any) => (c.substanceId||'').toLowerCase().includes(kw.toLowerCase()));
              let found = false;
              if (detect('insulin')||detect('humalog')||detect('novorapid')||detect('lantus')) { setMixInsulin(5); setMixInsulinTiming('post'); found=true; }
              if (detect('igf')||detect('igf1')||detect('mecasermin')) { setMixDrugIGF(50); setMixDrugIGFTiming('post'); found=true; }
              if (detect('hgh')||detect('somatropin')||detect('genotropin')||detect('ghrp')||detect('cjc')) { setMixDrugGH(5); setMixDrugGHTiming('pre'); found=true; }
              if (detect('mgf')||detect('mechano')) { setMixDrugMGF(200); setMixDrugMGFTiming('post'); found=true; }
              if (detect('semaglutide')||detect('tirzepatide')||detect('liraglutide')||detect('dulaglutide')||detect('glp')) { setMixDrugGLP1(true); found=true; }
              try {
                const calcData = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
                if (calcData.pharma?.hasInsulin && mixInsulin===0) { setMixInsulin(5); setMixInsulinTiming('post'); found=true; }
                if (calcData.pharma?.hasIGF && !mixDrugIGF) { setMixDrugIGF(50); setMixDrugIGFTiming('post'); found=true; }
                if (calcData.pharma?.hasGH && !mixDrugGH) { setMixDrugGH(5); setMixDrugGHTiming('pre'); found=true; }
                if (calcData.pharma?.hasMGF && !mixDrugMGF) { setMixDrugMGF(200); setMixDrugMGFTiming('post'); found=true; }
                if (calcData.pharma?.hasGLP1 && !mixDrugGLP1) { setMixDrugGLP1(true); found=true; }
                if (calcData.goals?.trainingCycle) {
                  const goalMap: Record<string,string> = { mass:'pump', cut:'endurance', maintenance:'recovery', endurance:'endurance', strength:'powerlifting' } as any;
                  if (goalMap[calcData.goals.trainingCycle]) setMixGoals([goalMap[calcData.goals.trainingCycle]]);
                }
              } catch {}
              if (found) alert('✅ Фармакология определена из курса и профиля');
            }} style={{ width:'100%', padding:'6px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', marginBottom:8 }}>📋 Автозаполнение из профиля (фарма + цель)</button>
            {(() => {
              const bw = linked.profile?.settings?.weight ?? 80;
              const hasCourse = (linked.course || []).length > 0;
              const isOnCycle = hasCourse;
              const multiplier = isOnCycle ? 1.25 : 1.0;
              const isPre = mixTiming === 'pre';
              const isIntra = mixTiming === 'intra';
              const isPost = mixTiming === 'post';
              const avgMin = linked.profile?.settings?.avgWorkoutMinutes ?? 90;
              const durHrs = (mixGoal === 'endurance' ? Math.max(1.5, avgMin/60) : Math.min(2, avgMin/60)) || 1.5;

              const isPL = mixGoal === 'powerlifting' || mixGoal === 'competition';
              const isCompetition = mixGoal === 'competition';
              const isStrengthGoal = mixGoal === 'strength';
              const isPumpGoal = mixGoal === 'pump';
              const isFocusGoal = mixGoal === 'focus';
              const isEnduranceGoal = mixGoal === 'endurance';
              const isRecoveryGoal = mixGoal === 'recovery';
              const isHIIT = mixGoal === 'hiit';
              const isMMA = mixGoal === 'mma';
              const isSprint = mixGoal === 'sprint';
              const isPostComp = mixGoal === 'post_comp';
              const mixUnit = (v: number): string => v >= 1000 ? `${(v/1000).toFixed(1)}` : `${v}`;
              const mixSuffix = (v: number): string => v >= 1000 ? 'г' : 'мг';
              const preStack: { name: string; id: string; dose: string; unit: string; note: string; mg: number }[] = appliedTemplate?.pre?.length ? appliedTemplate.pre.map(item => ({
                name: item.id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
                id: item.id,
                dose: item.dose,
                unit: item.unit,
                note: 'Из шаблона: ' + appliedTemplate.name,
                mg: Math.round(parseFloat(item.dose) * (item.unit === 'г' ? 1000 : item.unit === 'мг' ? 1 : 1))
              })) : isPL ? [
                { name:'Креатин (загрузка)', id:'creatine', dose:mixUnit(8000*multiplier), unit:'г', note:'За 45 мин до. АТФ для максимальных усилий', mg: Math.round(8000*multiplier) },
                { name:'Кофеин', id:'caffeine', dose:`${isCompetition?400:300}`, unit:'мг', note:'За 30 мин до. CNS-активация', mg: isCompetition?400:300 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺ ионов', mg:4000 },
                { name:'L-тирозин', id:'tyrosine', dose:mixUnit(3000*multiplier), unit:mixSuffix(3000*multiplier), note:'За 30 мин до. Фокус, дофамин', mg: Math.round(3000*multiplier) },
                { name:'OKG (орнитин)', id:'glutamine', dose:'5', unit:'г', note:'За 30 мин до. Аммиак-буфер для ЦНС', mg:5000 },
                { name:'Цитруллин', id:'citrulline', dose:mixUnit(6000*multiplier), unit:'г', note:'За 45 мин. NO для кровотока', mg: Math.round(6000*multiplier) },
                { name:'Таурин', id:'taurine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Осморегуляция, пампинг', mg: Math.round(2000*multiplier) },
                { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. VO₂max, митохондриальный биогенез', mg:3000 },
                { name:'Глицерол', id:'glycerol', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация, венозный пампинг', mg: Math.round(3000*multiplier) },
                { name:'Агматин', id:'agmatine', dose:'1', unit:'г', note:'За 30 мин до. NO-модуляция, нейромодулятор', mg:1000 },
                { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'За 30 мин до. mTOR, синтез белка', mg:500 },
              ] : isStrengthGoal ? [
                { name:'Креатин', id:'creatine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'За 45 мин до. АТФ, фосфокреатин', mg: Math.round(5000*multiplier) },
                { name:'Кофеин', id:'caffeine', dose:'300', unit:'мг', note:'За 30 мин до. CNS-активация', mg:300 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'3.2', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:3200 },
                { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'За 45 мин до. mTOR, синтез белка', mg:500 },
                { name:'Таурин', id:'taurine', dose:`${(2*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Ca²⁺-модуляция', mg: Math.round(2000*multiplier) },
                { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для рабочего кровотока', mg:6000 },
                { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, нейромышечная передача', mg:1500 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления ЦНС', mg:500 },
              ] : isFocusGoal ? [
                { name:'L-тирозин', id:'tyrosine', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Дофамин/норадреналин', mg: Math.round(3000*multiplier) },
                { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин', mg:1500 },
                { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'За 45 мин до. ATP для мозга', mg:2000 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления, ↑ стрессоустойчивость', mg:500 },
                { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-стимуляция', mg:200 },
                { name:'Цитруллин', id:'citrulline', dose:'4', unit:'г', note:'За 30 мин до. NO для мозгового кровотока', mg:4000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. GABA-модуляция, фокус', mg:2000 },
              ] : isEnduranceGoal ? [
                { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. VO₂max, митохондрии', mg:3000 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Карнозин, буфер H⁺', mg:4000 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления, ↑ выносливость', mg:500 },
                { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO, кровоток', mg:6000 },
                { name:'Таурин', id:'taurine', dose:`${(2*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Осморегуляция, буфер', mg: Math.round(2000*multiplier) },
                { name:'L-карнитин', id:'l_carnitine', dose:'1.5', unit:'г', note:'За 45 мин до. Транспорт жирных кислот', mg:1500 },
                { name:'Глицерол', id:'glycerol', dose:`${(4*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация', mg: Math.round(4000*multiplier) },
              ] : isRecoveryGoal ? [
                { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. Восстановление АТФ', mg:5000 },
                { name:'Цитруллин', id:'citrulline', dose:'4', unit:'г', note:'За 30 мин до. NO, кровоток к мышцам', mg:4000 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген', mg:500 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Осморегуляция', mg:2000 },
                { name:'Ашваганда', id:'ashwagandha', dose:'600', unit:'мг', note:'За 45 мин до. ↓ кортизол', mg:600 },
              ] : isHIIT ? [
                { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-активация для взрывных усилий', mg:200 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺ для анаэробной работы', mg:4000 },
                { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. АТФ для интервалов', mg:5000 },
                { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для кровотока', mg:6000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Осморегуляция, Ca²⁺-модуляция', mg:2000 },
              ] : isMMA ? [
                { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. Взрывная сила', mg:5000 },
                { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-ready без перестимуляции', mg:200 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:4000 },
                { name:'L-тирозин', id:'tyrosine', dose:'2', unit:'г', note:'За 30 мин до. CNS-фокус, дофамин', mg:2000 },
                { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для кровотока', mg:6000 },
                { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, защита мозга', mg:1500 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Нейромодуляция, GABA', mg:2000 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген, ↓ утомления ЦНС', mg:500 },
              ] : isSprint ? [
                { name:'Креатин', id:'creatine', dose:'8', unit:'г', note:'За 45 мин до. Максимум фосфокреатина', mg:8000 },
                { name:'Кофеин', id:'caffeine', dose:'250', unit:'мг', note:'За 30 мин до. CNS-активация', mg:250 },
                { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:4000 },
                { name:'Цитруллин', id:'citrulline', dose:'8', unit:'г', note:'За 45 мин до. NO для кровотока', mg:8000 },
                { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. ATP-регенерация', mg:3000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Ca²⁺-модуляция, осморегуляция', mg:2000 },
                { name:'Магний', id:'magnesium', dose:'400', unit:'мг', note:'За 45 мин до. Нейромышечная передача', mg:400 },
              ] : isPostComp ? [
                { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'За 45 мин до. ↓ кортизол, адаптоген', mg:600 },
                { name:'Магний', id:'magnesium', dose:'400', unit:'мг', note:'За 30 мин до. ↓ кортизол, сон', mg:400 },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления ЦНС', mg:500 },
              ] : [ // pump goal (default)
                { name:'Цитруллин (малат)', id:'citrulline', dose:mixUnit(Math.min(8000,(6000)*multiplier)), unit:'г', note:'За 30-45 мин до. NO-бустер, пампинг', mg: Math.round(Math.min(8000,6000*multiplier)) },
                { name:'Бета-аланин', id:'beta_alanine', dose:'3.2', unit:'г', note:'За 30 мин до. Буфер молочной кислоты', mg:3200 },
                { name:'L-тирозин', id:'tyrosine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Фокус, дофамин', mg: Math.round(2000*multiplier) },
                { name:'Креатин', id:'creatine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'За 30 мин до. АТФ, взрывная сила', mg: Math.round(5000*multiplier) },
                { name:'Таурин', id:'taurine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Осморегуляция, пампинг', mg: Math.round(2000*multiplier) },
                { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, митохондрии', mg:1500 },
                { name:'Глицерол', id:'glycerol', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация, венозный пампинг', mg: Math.round(3000*multiplier) },
                { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген, снижение утомления', mg:500 },
                { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'За 45 мин до. ATP, выносливость', mg:2000 },
                { name:'Тонгкат Али 200:1', id:'tongkat_ali', dose:'400', unit:'мг', note:'За 30 мин до. Тестостерон, энергия', mg:400 },
              ];
              const intraStack: { name: string; id: string; dose: string; unit: string; note: string; mg: number }[] = appliedTemplate?.intra?.length ? appliedTemplate.intra.map(item => ({
                name: item.id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
                id: item.id,
                dose: item.dose,
                unit: item.unit,
                note: 'Из шаблона: ' + appliedTemplate.name,
                mg: Math.round(parseFloat(item.dose) * (item.unit === 'г' ? 1000 : item.unit === 'мг' ? 1 : 1))
              })) : isPL || isStrengthGoal ? [
                { name:'HBCD', id:'hbcd', dose:`${Math.round(30*durHrs)}`, unit:'г', note:'Каждые 20 мин. Быстрый углевод для мощности', mg: Math.round(30000*durHrs) },
                { name:'EAA (2:1:1)', id:'eaa', dose:mixUnit(10000*multiplier), unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg: Math.round(10000*multiplier) },
                { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ, иммунитет', mg:5000 },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15-20 мин. Гидратация', mg: Math.round(1500*durHrs) },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
                { name:'Креатин', id:'creatine', dose:'3', unit:'г', note:'Приём. Поддержка АТФ', mg:3000 },
                { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'Однократно. Выносливость для многоповторов', mg:2000 },
              ] : isEnduranceGoal || mixGoal === 'crossfit' ? [
                { name:'HBCD', id:'hbcd', dose:`${Math.round(50*durHrs)}`, unit:'г', note:'Каждые 15 мин. Много углеводов для длительной работы', mg: Math.round(50000*durHrs) },
                { name:'EAA (2:1:1)', id:'eaa', dose:`${(15*multiplier).toFixed(0)}`, unit:'г', note:'Каждые 30 мин. Максимальный анти-катаболизм', mg: Math.round(15000*multiplier) },
                { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ, иммунитет', mg:5000 },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'2', unit:'г/л', note:'Каждые 15 мин. Гидратация + соль', mg: Math.round(2000*durHrs) },
                { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Каждые 30 мин. Транспорт жирных кислот', mg:1000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
                { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'Однократно. VO₂max', mg:3000 },
                { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
              ] : isPumpGoal ? [
                { name:'Глицерол', id:'glycerol', dose:'5', unit:'г', note:'В изотоник. Венозный пампинг', mg:5000 },
                { name:'Цитруллин', id:'citrulline', dose:'3', unit:'г', note:'Каждые 30 мин. NO для пампа', mg:3000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15-20 мин. Гидратация', mg: Math.round(1500*durHrs) },
                { name:'EAA (2:1:1)', id:'eaa', dose:'10', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:10000 },
                { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ', mg:5000 },
                { name:'Креатин', id:'creatine', dose:'3', unit:'г', note:'Приём. Поддержка АТФ', mg:3000 },
              ] : isHIIT ? [
                { name:'HBCD', id:'hbcd', dose:`${Math.round(30*durHrs)}`, unit:'г', note:'Между спринтами — быстрый углевод', mg: Math.round(30000*durHrs) },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15 мин. Гидратация', mg: Math.round(1500*durHrs) },
                { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
              ] : isMMA ? [
                { name:'HBCD', id:'hbcd', dose:`${Math.round(40*durHrs)}`, unit:'г', note:'Углеводы между раундами', mg: Math.round(40000*durHrs) },
                { name:'EAA (2:1:1)', id:'eaa', dose:'10', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:10000 },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'2', unit:'г/л', note:'Каждые 15 мин. Гидратация', mg: Math.round(2000*durHrs) },
                { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
              ] : isSprint ? [
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1', unit:'г/л', note:'Каждые 15 мин. Лёгкая гидратация', mg: Math.round(1000*durHrs) },
                { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
              ] : [ // recovery/focus — минимальный интра
                { name:'HBCD', id:'hbcd', dose:`${Math.round(20*durHrs)}`, unit:'г', note:'Каждые 20 мин. Лёгкий углевод', mg: Math.round(20000*durHrs) },
                { name:'EAA (2:1:1)', id:'eaa', dose:'8', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:8000 },
                { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ', mg:5000 },
                { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1', unit:'г/л', note:'Каждые 20 мин. Гидратация', mg:1000 },
                { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
              ];
              const postStack: { name: string; id: string; dose: string; unit: string; note: string; mg: number }[] = appliedTemplate?.post?.length ? appliedTemplate.post.map(item => ({
                name: item.id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
                id: item.id,
                dose: item.dose,
                unit: item.unit,
                note: 'Из шаблона: ' + appliedTemplate.name,
                mg: Math.round(parseFloat(item.dose) * (item.unit === 'г' ? 1000 : item.unit === 'мг' ? 1 : 1))
              })) : isRecoveryGoal || isPostComp ? [
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.35*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg: Math.round(0.35*bw*1000) },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
                { name:'L-глютамин', id:'glutamine', dose:`${(5*multiplier).toFixed(0)}`, unit:'г', note:'Сразу после. Восстановление', mg: Math.round(5000*multiplier) },
                { name:'HMB', id:'hmb', dose:isOnCycle?'3':'—', unit:isOnCycle?'г':'', note:'Сразу после. Анти-катаболизм', mg:isOnCycle?3000:0 },
                { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион, детоксикация', mg:1200 },
                { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. ↓ кортизол', mg:600 },
                { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'Сразу после. ↓ воспаление', mg:800 },
                { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
                { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Сон, тестостерон', mg:480 },
                { name:'Витамин C', id:'vitamin_c', dose:'1000', unit:'мг', note:'Сразу после. Антиоксидант, кортизол', mg:1000 },
              ] : isStrengthGoal ? [
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.45*bw).toFixed(0)}`, unit:'г', note:'Сразу после. MPS, синтез белка', mg: Math.round(0.45*bw*1000) },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
                { name:'L-глютамин', id:'glutamine', dose:`${(5*multiplier).toFixed(0)}`, unit:'г', note:'Сразу после. Восстановление', mg: Math.round(5000*multiplier) },
                { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'Сразу после. mTOR, синтез белка', mg:500 },
                { name:'HMB', id:'hmb', dose:isOnCycle?'3':'—', unit:isOnCycle?'г':'', note:'Сразу после. Анти-катаболизм', mg:isOnCycle?3000:0 },
                { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. ↑ IGF-1', mg:600 },
                { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион', mg:1200 },
                { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
                { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Тестостерон, сон', mg:480 },
              ] : isMMA ? [
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.4*bw).toFixed(0)}`, unit:'г', note:'Сразу после. MPS', mg: Math.round(0.4*bw*1000) },
                { name:'L-глютамин', id:'glutamine', dose:'10', unit:'г', note:'GABA, восстановление, ЖКТ', mg:10000 },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Восстановление АТФ', mg:5000 },
                { name:'Омега-3', id:'omega3', dose:'3', unit:'г', note:'Защита мозга, противовоспалительное', mg:3000 },
                { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'↓ кортизол, адаптоген', mg:600 },
                { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'NF-kB, системное воспаление', mg:800 },
              ] : isHIIT ? [
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.35*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg: Math.round(0.35*bw*1000) },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
                { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Противовоспалительное', mg:2000 },
                { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'Восстановление митохондрий', mg:2000 },
              ] : isSprint ? [
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.3*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg: Math.round(0.3*bw*1000) },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Дозагрузка креатина', mg:5000 },
                { name:'HMB', id:'hmb', dose:'3', unit:'г', note:'Анти-катаболизм, ↓ MuRF1', mg:3000 },
                { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Окисление ЖК, восстановление', mg:1000 },
              ] : [ // pump/endurance/focus
                { name:'Сывороточный протеин', id:'protein', dose:`${(0.4*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg: Math.round(0.4*bw*1000) },
                { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
                { name:'L-глютамин', id:'glutamine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'Сразу после. Восстановление', mg: Math.round(5000*multiplier) },
                { name:'HMB', id:'hmb', dose:isOnCycle?'3':'—', unit:isOnCycle?'г':'', note:'Сразу после. Анти-катаболизм', mg:isOnCycle?3000:0 },
                { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Тестостерон, сон', mg:480 },
                { name:'Витамин C', id:'vitamin_c', dose:'500', unit:'мг', note:'Сразу после. Антиоксидант', mg:500 },
                { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. Кортизол, анаболизм', mg:600 },
                { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
                { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион, детоксикация', mg:1200 },
                { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'Сразу после. NF-kB, воспаление', mg:800 },
                { name:'Альфа-липоевая кислота', id:'alpha_lipoic', dose:'300', unit:'мг', note:'Сразу после. Nrf2, антиоксидант', mg:300 },
                { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Сразу после. Восстановление мышц', mg:1000 },
              ];
              const activeStack = isPre ? preStack : isIntra ? intraStack : postStack;
              // Recipe engine — build best recipe from active drugs
              const drugProfile = { weightKg: bw, drugs: { insulin: mixInsulin>0, insulinDose: mixInsulin, insulinTiming: mixInsulinTiming, igf: mixDrugIGF>0, igfDose: mixDrugIGF, igfTiming: mixDrugIGFTiming, gh: mixDrugGH>0, ghDose: mixDrugGH, ghTiming: mixDrugGHTiming, mgf: mixDrugMGF>0, mgfDose: mixDrugMGF, mgfTiming: mixDrugMGFTiming, glp1: mixDrugGLP1 } };
              const recipeResult = buildBestRecipe(drugProfile as any as MixProfile);
              const drugItems = recipeResult ? recipeResult.items : [];
              // Apply custom overrides (removed + replaced) to drug items
              let effectiveDrugItems = drugItems.filter(item => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`));
              for (let i = 0; i < effectiveDrugItems.length; i++) {
                const key = `${effectiveDrugItems[i].id}_${effectiveDrugItems[i].timing}`;
                const repl = customRecipeOverrides.replaced[key];
                if (repl) {
                  effectiveDrugItems[i] = { ...effectiveDrugItems[i], ...repl, timing: effectiveDrugItems[i].timing };
                }
              }
              const groupedEffectiveDrugItems = groupRecipeItemsByTiming(effectiveDrugItems);
              // Merge into current timing
              const timedDrugItemsX = groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || [];
              // Deduplicate by id — drug overrides base stack items
              const stackMap2 = new Map<string, typeof activeStack[0]>();
              for (const item of activeStack) stackMap2.set(item.id, item);
              for (const item of timedDrugItemsX) stackMap2.set(item.id, { name: item.id, ...item });
              const dedupedStack = [...stackMap2.values()];
              // Add custom items that match current timing
              const timingKey = isPre ? 'pre' as const : isIntra ? 'intra' as const : 'post' as const;
              for (const ci of customMixItems) {
                if (ci.timing === timingKey) {
                  const exist = dedupedStack.find(d => d.id === ci.id);
                  if (!exist) dedupedStack.push({ name: ci.name, id: ci.id, dose: ci.dose, unit: ci.unit, note: 'Своё вещество', mg: ci.mg });
                }
              }
              // Drug-augment all three stacks for overview
              const augStack = (items: typeof activeStack, timing: 'pre'|'intra'|'post') => {
                const m = new Map<string, typeof activeStack[0]>();
                for (const item of items) m.set(item.id, item);
                for (const item of groupedEffectiveDrugItems[timing] || []) m.set(item.id, { name: item.id, ...item });
                return [...m.values()];
              };
              const allStacks = { pre: augStack(preStack, 'pre'), intra: augStack(intraStack, 'intra'), post: augStack(postStack, 'post') };
              const stackTitle = isPre ? '🔥 Пред-тренировочный стек' : isIntra ? '💧 Интра-тренировочный стек' : '🍗 Пост-тренировочный стек';
              const timingLabel = isPre ? 'За 30-60 мин до тренировки' : isIntra ? 'В течение тренировки (каждые 15-20 мин)' : 'Сразу после тренировки';
              // Synergy warnings: template ↔ recipe conflicts
              const synWarnings: string[] = [];
              if (appliedTemplate && timedDrugItemsX.length > 0) {
                const templateIds = new Set([...(appliedTemplate.pre||[]).map(i=>i.id),...(appliedTemplate.intra||[]).map(i=>i.id),...(appliedTemplate.post||[]).map(i=>i.id)].filter(Boolean));
                const recipeIds = new Set(timedDrugItemsX.map(i=>i.id));
                const duplicates = [...templateIds].filter(id => recipeIds.has(id));
                if (duplicates.length > 0) {
                  const names = duplicates.map(id => { const e=SUPPORT_CATALOG_DATA[id]; return e?.nameRu||e?.name||id; }).filter(Boolean);
                  synWarnings.push('⚠ Одинаковые вещества в шаблоне и рецепте: ' + names.join(', ') + ' — рецепт приоритетен (доза из рецепта)');
                }
                const highDosePair: { a: string; b: string; id: string }[] = [];
                for (const id of ['caffeine','beta_alanine','citrulline','creatine','taurine','glycerol','l_carnitine','alpha_gpc','agmatine','tyrosine']) {
                  const inTmpl = (appliedTemplate.pre||[]).some(i=>i.id===id)||(appliedTemplate.intra||[]).some(i=>i.id===id)||(appliedTemplate.post||[]).some(i=>i.id===id);
                  const inRecipe = timedDrugItemsX.some(i=>i.id===id);
                  if (inTmpl && inRecipe) highDosePair.push({ a:'шаблон', b:'рецепт', id });
                }
                if (highDosePair.length > 0) synWarnings.push('⚠ Препараты дублируются (' + highDosePair.map(p=>p.id).join(', ') + ') — суммарная доза может превышать рекомендуемую');
              }
              // ACWR-readiness коррекция
              const _srpe = loadSRPESessions();
              const _acwr = _srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(_srpe)) : null;
              const acwrWarnings: string[] = [];
              if (_acwr) {
                if (_acwr.ratio > 1.5) acwrWarnings.push('🚨 ACWR ' + _acwr.ratio.toFixed(2) + ' — опасная зона (перетрен). Снизьте стимуляторы, добавьте восстановители: ашваганда 600 мг, глицин 3 г, ZMA, магний 400 мг');
                else if (_acwr.ratio > 1.3) acwrWarnings.push('⚠️ ACWR ' + _acwr.ratio.toFixed(2) + ' — высокая нагрузка. Рассмотрите цитруллин 6 г для NO + бета-аланин 3.2 г для буферизации + магний 200 мг');
                else if (_acwr.ratio < 0.8) acwrWarnings.push('📈 ACWR ' + _acwr.ratio.toFixed(2) + ' — недотрен. Можно усилить стимуляторы: кофеин 400 мг, тирозин 2 г, ALCAR 1.5 г, креатин 10 г для загрузки');
              }

              const hasNandrolone = (linked.course || []).some((c:any) => {
                const id = (c.substanceId||'').toLowerCase();
                return id.includes('nandrolon') || id.includes('npp') || id.includes('deca') || id.includes('trest');
              });
              const na = (linked.labs || []).find((l:any)=>l.code==='SODIUM')?.value || 140;
              const k = (linked.labs || []).find((l:any)=>l.code==='POTASSIUM')?.value || 4.2;
              const cl = (linked.labs || []).find((l:any)=>l.code==='CHLORIDE')?.value || 102;

              const mixSubstances: MixSubstance[] = dedupedStack.filter(s=>s.mg>0).map(s=>({ id:s.id, name:s.name, doseMg:s.mg }));
              // Multi-goal score calculation
              const scoresByGoal = mixGoals.map(g => {
                const p: MixProfile = { goal: g as any, timing: mixTiming as any, weightKg: bw, isOnCycle, drugs: { insulin: mixInsulin>0, igf: mixDrugIGF>0, gh: mixDrugGH>0, mgf: mixDrugMGF>0, glp1: mixDrugGLP1, insulinDose: mixInsulin, insulinTiming: mixInsulinTiming, igfDose: mixDrugIGF, igfTiming: mixDrugIGFTiming, ghDose: mixDrugGH, ghTiming: mixDrugGHTiming, mgfDose: mixDrugMGF, mgfTiming: mixDrugMGFTiming }, hasNandrolone, userElectrolytes: { sodiumMmolL: na, potassiumMmolL: k, chlorideMmolL: cl }, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay, workoutDurationMin: Math.round(durHrs*60) };
                return { goal: g, score: calculateMixScore(mixSubstances, p) };
              });
              // Average scores across goals
              const avg = (arr: number[]) => Math.round(arr.reduce((s,v) => s+v, 0) / arr.length);
              const score: TrainingMixScore = {
                ...scoresByGoal[0].score,
                pumpScore: avg(scoresByGoal.map(s => s.score.pumpScore)),
                energyScore: avg(scoresByGoal.map(s => s.score.energyScore)),
                focusScore: avg(scoresByGoal.map(s => s.score.focusScore)),
                strengthScore: avg(scoresByGoal.map(s => s.score.strengthScore)),
                hydrationScore: avg(scoresByGoal.map(s => s.score.hydrationScore)),
                enduranceScore: avg(scoresByGoal.map(s => s.score.enduranceScore)),
                anticatabolicScore: avg(scoresByGoal.map(s => s.score.anticatabolicScore)),
                recoveryScore: avg(scoresByGoal.map(s => s.score.recoveryScore)),
                proteinScore: avg(scoresByGoal.map(s => s.score.proteinScore)),
                glycogenScore: avg(scoresByGoal.map(s => s.score.glycogenScore)),
                noScore: avg(scoresByGoal.map(s => s.score.noScore)),
                compositeScore: avg(scoresByGoal.map(s => s.score.compositeScore)),
                label: mixGoals.length > 1 ? `среднее ${mixGoals.length} целей` : scoresByGoal[0].score.label,
                color: scoresByGoal[0].score.color,
                suggestions: [...new Set(scoresByGoal.flatMap(s => s.score.suggestions))],
                electrolyteWarnings: [...new Set(scoresByGoal.flatMap(s => s.score.electrolyteWarnings))],
                drugModifiers: mixGoals.length > 1 ? scoresByGoal[0].score.drugModifiers : scoresByGoal[0].score.drugModifiers,
                substanceBreakdown: scoresByGoal[0].score.substanceBreakdown,
              };
              // Build comparison score for opposite timing
              const compareTiming = mixTiming === 'pre' ? 'intra' : mixTiming === 'intra' ? 'pre' : 'pre';
              const compareProfile: MixProfile = { goal: mixGoal as any, timing: compareTiming as MixProfile['timing'], weightKg: bw, isOnCycle, drugs: score.drugModifiers as any, hasNandrolone, userElectrolytes: { sodiumMmolL: na, potassiumMmolL: k, chlorideMmolL: cl }, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay, workoutDurationMin: Math.round(durHrs*60) };
              const compareScore = calculateMixScore(mixSubstances, compareProfile);

              const ScoreRow = ({ l, v, c }: { l: string; v: number; c: string }) => (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.8)', minWidth:100 }}>{l}</span>
                  <div style={{ flex:1, height:5, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(100,v)}%`, height:'100%', borderRadius:3, background:c, transition:'width 0.5s' }}/>
                  </div>
                  <span style={{ fontSize:8, fontWeight:700, color:c, minWidth:24, textAlign:'right' }}>{v}</span>
                </div>
              );

              return (<>
                {isOnCycle && <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', fontSize:9, color:'#a78bfa', marginBottom:8 }}>🔥 На курсе: дозы ×{multiplier}. Скор увеличен на 25%.</div>}

                <div className="card" style={{ marginBottom:10, padding:12, background:'linear-gradient(135deg, rgba(0,230,138,0.04), rgba(139,92,246,0.04))', border:'1px solid var(--glass-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:24 }}>{isPre?'🔥':isIntra?'💧':'🍗'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{stackTitle} {effectiveDrugItems.length > 0 && groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post']?.length > 0 && <span style={{fontSize:7,color:'#22c55e',background:'rgba(34,197,94,0.1)',padding:'1px 4px',borderRadius:4}}>🧪 рецепт</span>}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{timingLabel}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:score.color }}>{score.compositeScore}</div>
                      <div style={{ fontSize:7, color:score.color }}>{score.label}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    <button onClick={()=>{
                      const entry={goal:mixGoal,timing:mixTiming,type:mixWorkoutType,tod:mixTimeOfDay,score:score.compositeScore,label:score.label,date:new Date().toLocaleDateString('ru-RU')};
                      const updated=[...mixHistory,entry].slice(-20);setMixHistory(updated);
                      localStorage.setItem('he_training_mixes',JSON.stringify(updated));
                    }} style={{flex:1,padding:'4px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa'}}>💾 Сохранить тайминг</button>
                    <button onClick={()=>{
                      const kit = {
                        id: Date.now(),
                        type: 'mix',
                        goal: mixGoal,
                        workoutType: mixWorkoutType,
                        timeOfDay: mixTimeOfDay,
                        isOnCycle,
                        multiplier,
                        bw,
                        pre: preStack.filter(s=>s.mg>0),
                        intra: intraStack.filter(s=>s.mg>0),
                        post: postStack.filter(s=>s.mg>0),
                        date: new Date().toISOString(),
                      };
                      try {
                        const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                        arr.push(kit);
                        localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                        setPlanSaved('✅ Комплект сохранён в Избранное → Миксы');
                        setTimeout(() => setPlanSaved(''), 3000);
                      } catch {}
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a'}}>💾 Комплект</button>
                    <button onClick={()=>{
                      const plan = {
                        id: Date.now(),
                        name: prompt('Название плана:', mixGoal + ' микс') || mixGoal + ' микс',
                        goal: mixGoal,
                        timing: mixTiming,
                        workoutType: mixWorkoutType,
                        timeOfDay: mixTimeOfDay,
                        isOnCycle,
                        multiplier,
                        bw,
                        insulin: mixInsulin, insulinTiming: mixInsulinTiming,
                        igf: mixDrugIGF, igfTiming: mixDrugIGFTiming,
                        gh: mixDrugGH, ghTiming: mixDrugGHTiming,
                        mgf: mixDrugMGF, mgfTiming: mixDrugMGFTiming,
                        glp1: mixDrugGLP1,
                        appliedTemplate: appliedTemplate ? { id: appliedTemplate.id, name: appliedTemplate.name } : null,
                        pre: preStack.filter(s=>s.mg>0),
                        intra: intraStack.filter(s=>s.mg>0),
                        post: postStack.filter(s=>s.mg>0),
                        score: score.compositeScore,
                        label: score.label,
                        date: new Date().toISOString(),
                      };
                      if (!plan.name) return;
                      const arr = [...mixSavedPlans, plan].slice(-30);
                      setMixSavedPlans(arr);
                      localStorage.setItem('he_mix_saved_plans', JSON.stringify(arr));
                      setPlanSaved('✅ План сохранён');
                      setTimeout(() => setPlanSaved(''), 3000);
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',marginLeft:4}}>📋 План</button>
                    <button onClick={()=>{
                      const subsSet = new Set(enhancedSubs);
                      const mixItems = [...preStack.filter(s=>s.id&&s.mg>0), ...intraStack.filter(s=>s.id&&s.mg>0), ...postStack.filter(s=>s.id&&s.mg>0)];
                      mixItems.forEach(s => subsSet.add(s.id));
                      (customMixItems||[]).forEach(s => subsSet.add(s.id));
                      setEnhancedSubs([...subsSet]);
                      setTimeout(() => calcSupport(supportLevel), 50);
                      setPlanSaved('✅ Микс добавлен в план поддержки');
                      setTimeout(() => setPlanSaved(''), 3000);
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(255,183,77,0.08)',border:'1px solid rgba(255,183,77,0.15)',color:'#ffb74d',marginLeft:4}}>➕ План подд.</button>
                    {mixHistory.length>0&&<button onClick={()=>{setMixHistory([]);localStorage.setItem('he_training_mixes','[]')}} style={{padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:8,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',color:'#ef4444'}}>✕</button>}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {dedupedStack.map((item,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                        <div style={{ flex:1, fontSize:10 }}>
                          <span style={{ color:'var(--text-light)' }}>{item.name}</span>
                          <span style={{ color:'var(--text-dim)', fontSize:8, marginLeft:4 }}>— {item.note}</span>
                        </div>
                        <span style={{ fontSize:10, fontWeight:600, color:'#00e68a', whiteSpace:'nowrap' }}>{item.dose}{item.unit?' '+item.unit:''}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',gap:4,marginTop:2}}>
                      <span onClick={()=>setShowCustomPicker(!showCustomPicker)} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',padding:'2px 6px',borderRadius:4,border:'1px solid rgba(0,230,138,0.2)'}}>➕ Своё вещество</span>
                      {customMixItems.some(ci => ci.timing === (isPre ? 'pre' : isIntra ? 'intra' : 'post')) && (
                        <span onClick={()=>{const arr=customMixItems.filter(ci=>ci.timing!==(isPre?'pre':isIntra?'intra':'post'));setCustomMixItems(arr);localStorage.setItem('he_mix_custom_items',JSON.stringify(arr));}} style={{fontSize:7,color:'#ef4444',cursor:'pointer',padding:'2px 6px',borderRadius:4}}>✕ Убрать свои</span>
                      )}
                    </div>
                    {showCustomPicker && (
                      <div style={{marginTop:4,padding:8,borderRadius:6,background:'rgba(0,0,0,0.1)',border:'1px solid rgba(255,255,255,0.04)'}}>
                        <div style={{fontSize:8,color:'var(--text-dim)',marginBottom:4}}>Выберите вещество и дозу для <b>{isPre ? 'pre' : isIntra ? 'intra' : 'post'}</b>:</div>
                        <input list="custom-mix-subs" value={customMixSubstance} onChange={e=>setCustomMixSubstance(e.target.value)}
                          placeholder="id вещества (напр. creatine)" style={{width:'100%',padding:'4px 6px',fontSize:8,borderRadius:4,background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.06)',color:'var(--text-light)'}} />
                        <datalist id="custom-mix-subs">
                          {customMixSubstances.slice(0,200).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                        </datalist>
                        <div style={{display:'flex',gap:4,marginTop:4,alignItems:'center'}}>
                          <input type="number" value={customMixDoseMg||''} onChange={e=>setCustomMixDoseMg(Number(e.target.value))}
                            placeholder="Доза (мг)" style={{flex:1,padding:'4px 6px',fontSize:8,borderRadius:4,background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.06)',color:'var(--text-light)'}} />
                          <button onClick={()=>{
                            if (!customMixSubstance || !customMixDoseMg) return;
                            const entry = SUPPORT_CATALOG_DATA[customMixSubstance.toLowerCase()];
                            const name = (entry as any)?.name || (entry as any)?.ru || customMixSubstance;
                            const mg = Math.round(customMixDoseMg);
                            const doseStr = mg >= 1000 ? `${(mg/1000).toFixed(1)}` : `${mg}`;
                            const unit = mg >= 1000 ? 'г' : 'мг';
                            const newItem = { timing: timingKey, id: customMixSubstance.toLowerCase(), name, dose: doseStr, unit, mg };
                            const arr = [...customMixItems.filter(ci=>!(ci.id===newItem.id&&ci.timing===newItem.timing)), newItem];
                            setCustomMixItems(arr);
                            localStorage.setItem('he_mix_custom_items', JSON.stringify(arr));
                            setCustomMixSubstance(''); setCustomMixDoseMg(0);
                          }} style={{padding:'4px 8px',borderRadius:4,fontSize:8,background:'rgba(0,230,138,0.1)',border:'1px solid rgba(0,230,138,0.2)',color:'#00e68a',cursor:'pointer'}}>✓</button>
                        </div>
                        {customMixItems.filter(ci=>ci.timing===timingKey).map((ci,i)=>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'var(--text-dim)',marginTop:2,padding:'2px 4px',background:'rgba(255,255,255,0.02)',borderRadius:4}}>
                            <span>{ci.name}</span>
                            <span style={{color:'#00e68a'}}>{ci.dose}{ci.unit?' '+ci.unit:''} <span onClick={()=>{const arr=customMixItems.filter((_,idx)=>idx!==(customMixItems.indexOf(ci)));setCustomMixItems(arr);localStorage.setItem('he_mix_custom_items',JSON.stringify(arr));}} style={{color:'#ef4444',cursor:'pointer'}}>✕</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>📊 Разбор скора ({score.compositeScore}/100) ↔ {compareScore.compositeScore}/100 ({compareTiming === 'pre' ? '🔥 Pre' : compareTiming === 'intra' ? '💧 Intra' : '🍗 Post'})</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                    <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,0.05)'}}>
                      <div style={{height:6,borderRadius:3,width:`${score.compositeScore}%`,background:'#8b5cf6',transition:'width 0.3s'}} />
                    </div>
                    <span style={{fontSize:8,color:'#8b5cf6',fontWeight:700}}>{score.compositeScore}</span>
                    <span style={{fontSize:7,color:'var(--text-dim)'}}>vs</span>
                    <span style={{fontSize:8,color:'#f59e0b',fontWeight:700}}>{compareScore.compositeScore}</span>
                    <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,0.05)'}}>
                      <div style={{height:6,borderRadius:3,width:`${compareScore.compositeScore}%`,background:'#f59e0b',transition:'width 0.3s'}} />
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {isPre && (() => {
                      const preRows = [
                        ...(isPumpGoal ? [{ l:'🩸 Памп (NO)', v:score.pumpScore, c:'#ef4444' }] : []),
                        ...(isStrengthGoal || isPL ? [{ l:'🏋️ Сила', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isEnduranceGoal || mixGoal === 'crossfit' ? [{ l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' }] : []),
                        ...(isFocusGoal ? [{ l:'🧠 Фокус', v:score.focusScore, c:'#8b5cf6' }] : []),
                        ...(isRecoveryGoal ? [{ l:'🔄 Восстановление', v:score.recoveryScore, c:'#22c55e' }] : []),
                        ...(isHIIT || mixGoal === 'sprint' ? [{ l:'💨 Анаэробная', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isHIIT ? [{ l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' }] : []),
                        ...(isMMA ? [{ l:'🧠 CNS-фокус', v:score.focusScore, c:'#8b5cf6' }, { l:'🏋️ Взрывная', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isSprint ? [{ l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' }] : []),
                        { l:'⚡ Энергия', v:score.energyScore, c:'#f59e0b' },
                      ];
                      return Object.values(Object.fromEntries(preRows.map(r=>[r.l,r]))).map(b=><ScoreRow key={b.l} {...b}/>);
                    })()}
                    {isIntra && [
                      { l:'💧 Гидратация', v:score.hydrationScore, c:'#06b6d4' },
                      { l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, c:'#ef4444' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' },
                    ].map(b=><ScoreRow key={b.l} {...b}/>)}
                    {isPost && [
                      { l:'🔄 Восстановление', v:score.recoveryScore, c:'#22c55e' },
                      { l:'🥩 Белок (MPS)', v:score.proteinScore, c:'#3b82f6' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, c:'#ef4444' },
                    ].map(b=><ScoreRow key={b.l} {...b}/>)}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:6}}>
                    {[
                      { l:'🩸 Памп', v:score.pumpScore, cv:compareScore.pumpScore, c:'#ef4444' },
                      { l:'⚡ Энергия', v:score.energyScore, cv:compareScore.energyScore, c:'#f59e0b' },
                      { l:'🧠 Фокус', v:score.focusScore, cv:compareScore.focusScore, c:'#8b5cf6' },
                      { l:'🏋️ Сила', v:score.strengthScore, cv:compareScore.strengthScore, c:'#22c55e' },
                      { l:'🏃 Выносливость', v:score.enduranceScore, cv:compareScore.enduranceScore, c:'#f97316' },
                      { l:'💧 Гидратация', v:score.hydrationScore, cv:compareScore.hydrationScore, c:'#06b6d4' },
                      { l:'🔄 Восстановление', v:score.recoveryScore, cv:compareScore.recoveryScore, c:'#22c55e' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, cv:compareScore.anticatabolicScore, c:'#ef4444' },
                      { l:'🥩 Белок', v:score.proteinScore, cv:compareScore.proteinScore, c:'#3b82f6' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, cv:compareScore.glycogenScore, c:'#f59e0b' },
                    ].filter(r=>r.v>0||r.cv>0).map(r=>(
                      <div key={r.l} style={{display:'flex',alignItems:'center',gap:4,fontSize:7}}>
                        <span style={{minWidth:80,color:'var(--text-dim)'}}>{r.l}</span>
                        <div style={{flex:1,height:4,borderRadius:2,background:'rgba(139,92,246,0.15)',display:'flex',overflow:'hidden'}}>
                          <div style={{height:4,borderRadius:2,width:`${r.v}%`,background:r.c,transition:'width 0.3s'}} />
                        </div>
                        <span style={{minWidth:20,textAlign:'right'}}>{r.v}</span>
                        <span style={{color:'var(--text-dim)'}}>vs</span>
                        <div style={{flex:1,height:4,borderRadius:2,background:'rgba(245,158,11,0.15)',display:'flex',overflow:'hidden'}}>
                          <div style={{height:4,borderRadius:2,width:`${r.cv}%`,background:'#f59e0b',transition:'width 0.3s'}} />
                        </div>
                        <span style={{minWidth:20}}>{r.cv}</span>
                        <span style={{minWidth:16,fontWeight:700,color:r.v>r.cv?'#22c55e':'#ef4444'}}>{r.v>r.cv?'▲':'▼'}{Math.abs(r.v-r.cv)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.08)', fontSize:7, color:'#8b5cf6' }}>
                    ⚡ NO-оптимизация: <b>{score.noScore}/100</b>
                    {score.drugModifiers.map((d,i)=><div key={i} style={{marginTop:2}}>{d.drug}: {d.effect} ({d.bonus>0?'+':''}{d.bonus}%)</div>)}
                  </div>
                  {synWarnings.length > 0 && <div style={{marginTop:4,padding:'4px 6px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',fontSize:7,color:'#ef4444',lineHeight:1.4}}>
                    {synWarnings.map((w,i)=><div key={i}>• {w}</div>)}
                  </div>}
                  {acwrWarnings.length > 0 && <div style={{marginTop:4,padding:'4px 6px',borderRadius:4,background:_acwr&&_acwr.ratio>1.5?'rgba(239,68,68,0.08)':_acwr&&_acwr.ratio>1.3?'rgba(234,179,8,0.08)':'rgba(59,130,246,0.08)',border:'1px solid rgba(255,255,255,0.04)',fontSize:7,color:_acwr&&_acwr.ratio>1.5?'#ef4444':_acwr&&_acwr.ratio>1.3?'#eab308':'#60a5fa',lineHeight:1.4}}>
                    {acwrWarnings.map((w,i)=><div key={i}>• {w}</div>)}
                  </div>}
                  <div style={{ marginTop:6 }}>
                    <div onClick={()=>setExpandedSection(prev=>{const n=new Set(prev);n.has('subscores')?n.delete('subscores'):n.add('subscores');return n;})} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontSize:8,color:'var(--text-dim)'}}>
                      <span>📊 Вклад каждого вещества</span>
                      <span>{expandedSection.has('subscores')?'▾':'▸'}</span>
                    </div>
                    {expandedSection.has('subscores') && <>
                      {/* Waterfall stacked bar: вклад каждого вещества в общий скор */}
                      {(() => {
                        const subs = score.substanceBreakdown;
                        const total = subs.reduce((s,b) => s + b.baseScore, 0) || 1;
                        const palette = ['#8b5cf6','#22c55e','#3b82f6','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6','#6366f1'];
                        return <div style={{marginTop:4,marginBottom:6,display:'flex',height:22,borderRadius:6,overflow:'hidden',background:'rgba(255,255,255,0.03)'}}>
                          {subs.map((sb,i) => {
                            const pct = (sb.baseScore / total) * 100;
                            return <div key={i} style={{width:pct+'%',minWidth:2,height:'100%',background:palette[i%palette.length],display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}} title={`${sb.name}: ${sb.baseScore} (${pct.toFixed(0)}%)`}>
                              {pct > 18 && <span style={{fontSize:6,fontWeight:700,color:'#000',lineHeight:1,whiteSpace:'nowrap',padding:'0 2px'}}>{sb.name}</span>}
                              {pct > 40 && <span style={{fontSize:5,fontWeight:600,color:'rgba(0,0,0,0.6)',position:'absolute',bottom:1,right:2}}>{sb.baseScore}</span>}
                            </div>;
                          })}
                        </div>;
                      })()}
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        {score.substanceBreakdown.map((sb,i)=>(
                          <div key={i} style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:4,padding:'3px 6px',borderRadius:4,background:'rgba(255,255,255,0.02)',fontSize:7}}>
                            <span style={{fontWeight:600,color:'var(--text-light)',minWidth:80}}>{sb.name}</span>
                            <span style={{color:'#8b5cf6',fontWeight:700}}>{sb.baseScore}</span>
                            {sb.categories.map((c,ci)=><span key={ci} style={{padding:'1px 4px',borderRadius:3,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa'}}>{c.label}:{c.score}</span>)}
                          </div>
                        ))}
                      </div>
                    </>}
                  </div>
                </div>

                <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.12)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📐 Расчёт нутриентов (вес {bw} кг{isOnCycle?' ×1.25':' ×1.0'}{mixInsulin>0||mixDrugGH?' + фарма':''})</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:9 }}>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>Углеводы</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#f97316'}}>{score.recommendedCarbsG}г</div>
                    </div>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>EAA/BCAA</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#3b82f6'}}>{score.recommendedEAAG}г</div>
                    </div>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>Вода</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#06b6d4'}}>{(score.recommendedWaterMl/1000).toFixed(1)}л</div>
                    </div>
                  </div>
                  {mixTiming === 'intra' && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>💧 Изотоник на {durHrs}ч (на {score.recommendedWaterMl/1000}л воды):</div>
                      <div style={{ display:'flex', gap:6, fontSize:8 }}>
                        <span style={{ color:'#fbbf24' }}>Na⁺ {score.recommendedNaMg}мг</span>
                        <span style={{ color:'#818cf8' }}>K⁺ {score.recommendedKMg}мг</span>
                        <span style={{ color:'#06b6d4' }}>Cl⁻ {score.recommendedClMg}мг</span>
                      </div>
                    </div>
                  )}
                </div>

                {score.electrolyteWarnings.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Электролитный баланс</div>
                    {score.electrolyteWarnings.map((w,i)=><div key={i} style={{fontSize:8,color:'rgba(255,255,255,0.8)',padding:'2px 0'}}>• {w}</div>)}
                    <div style={{ marginTop:4, fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>
                      Анализы: Na {na} ммоль/л (N:135-145) · K {k} ммоль/л (N:3.5-5.2) · Cl {cl} ммоль/л (N:98-108)
                      {hasNandrolone && <div style={{marginTop:2,color:'#ff1744'}}>⚠ Обнаружен нандролон (19-нор) — подавляет eNOS, снижает синтез NO на ~20%. Рекомендуется усиление пампа.</div>}
                    </div>
                  </div>
                )}

                {score.suggestions.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации</div>
                    {score.suggestions.map((s,i)=><div key={i} style={{fontSize:8,color:'rgba(255,255,255,0.8)',padding:'2px 0'}}>• {s}</div>)}
                  </div>
                )}

                {/* Compare + Templates buttons */}
                <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                  <button onClick={() => {
                    const kit = {
                      goal: mixGoal, timing: mixTiming, workoutType: mixWorkoutType,
                      timeOfDay: mixTimeOfDay, isOnCycle, multiplier, bw,
                      score: score.compositeScore, pre: preStack.filter(s=>s.mg>0), intra: intraStack.filter(s=>s.mg>0), post: postStack.filter(s=>s.mg>0),
                    };
                    setCompareKit(kit);
                    setPlanSaved('✅ Текущий стек сохранён для сравнения');
                    setTimeout(() => setPlanSaved(''), 3000);
                  }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.15)', color:'#60a5fa' }}>⚖ Сравнить с…</button>
                  <button onClick={() => setShowTemplates(!showTemplates)} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', color:'#f59e0b' }}>📦 {showTemplates ? 'Скрыть' : 'Шаблоны'}</button>
                </div>

                {/* Compare mode */}
                {compareKit && (() => {
                  const cmpScore = (() => {
                    const cmpProfile: MixProfile = {
                      goal: compareKit.goal, timing: compareKit.timing as any, weightKg: compareKit.bw || bw,
                      isOnCycle: compareKit.isOnCycle, drugs: { insulin:false, igf:false, gh:false, mgf:false, glp1:false },
                      hasNandrolone: false, userElectrolytes: { sodiumMmolL: 140, potassiumMmolL: 4.2, chlorideMmolL: 102 },
                      workoutType: compareKit.workoutType || 'moderate', timeOfDay: compareKit.timeOfDay || 'morning',
                      workoutDurationMin: 90,
                    };
                    const cmpSubs: MixSubstance[] = (compareKit.pre||[]).concat(compareKit.intra||[]).concat(compareKit.post||[])
                      .filter((s:any) => s && s.mg > 0).map((s:any) => ({ id: s.id, name: s.name, doseMg: s.mg }));
                    return cmpSubs.length > 0 ? calculateMixScore(cmpSubs, cmpProfile) : null;
                  })();
                  return (
                    <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa' }}>⚖ Сравнение с сохранённым стеком</span>
                        <button onClick={() => setCompareKit(null)} style={{ fontSize:7, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>
                        Сохранённый: <b>{compareKit.goal}</b> ({compareKit.pre?.length||0}pre/{compareKit.intra?.length||0}intra/{compareKit.post?.length||0}post) · скор <b>{cmpScore?.compositeScore||'—'}/100</b>
                        <span style={{marginLeft:8}}>Текущий: <b>{mixGoal}</b> · скор <b>{score.compositeScore}/100</b></span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:7 }}>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#a78bfa', fontWeight:600, marginBottom:2 }}>Текущий (Pre)</div>
                          <div style={{color:'var(--text-dim)'}}>{preStack.filter(s=>s.mg>0).slice(0,6).map(s=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#a78bfa', fontWeight:600, marginBottom:2 }}>Сохранённый (Pre)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.pre||[]).slice(0,6).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#06b6d4', fontWeight:600, marginBottom:2 }}>Текущий (Intra)</div>
                          <div style={{color:'var(--text-dim)'}}>{intraStack.filter(s=>s.mg>0).slice(0,4).map(s=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#06b6d4', fontWeight:600, marginBottom:2 }}>Сохранённый (Intra)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.intra||[]).slice(0,4).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#22c55e', fontWeight:600, marginBottom:2 }}>Текущий (Post)</div>
                          <div style={{color:'var(--text-dim)'}}>{postStack.filter(s=>s.mg>0).slice(0,6).map(s=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#22c55e', fontWeight:600, marginBottom:2 }}>Сохранённый (Post)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.post||[]).slice(0,6).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Template presets */}
                {showTemplates && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b' }}>📦 Шаблоны миксов</span>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        {appliedTemplate && <span onClick={()=>{setAppliedTemplate(null);localStorage.removeItem('he_mix_applied_template');}} style={{fontSize:7,color:'#ef4444',cursor:'pointer',textDecoration:'underline'}}>✕ Сбросить шаблон</span>}
                        <button onClick={() => setShowTemplates(false)} style={{ fontSize:7, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                      </div>
                    </div>
                    {appliedTemplate && <div style={{fontSize:7,color:'#22c55e',marginBottom:4,background:'rgba(34,197,94,0.06)',padding:'3px 6px',borderRadius:4}}>✅ Применён: {appliedTemplate.name}</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {MIX_TEMPLATES.filter(t => t.goal === mixGoal || t.tags.some(tg => tg === mixTiming || tg === mixGoal)).map(t => (
                        <div key={t.id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
                          onClick={() => {
                            setAppliedTemplate(t);
                            localStorage.setItem('he_mix_applied_template', JSON.stringify(t));
                            setMixGoals([t.goal]);
                            setPlanSaved(`✅ Применён шаблон: ${t.name}`);
                            setTimeout(() => setPlanSaved(''), 3000);
                          }}
                        >
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)' }}>{t.name}</div>
                          <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{t.description}</div>
                          <div style={{ fontSize:7, color:'#f59e0b', marginTop:2 }}>
                            {t.tags.map(tg => <span key={tg} style={{marginRight:4}}>#{tg}</span>)}
                            · Pre: {t.pre.length} · Intra: {t.intra.length} · Post: {t.post.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mixSavedPlans.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>📂 Мои планы миксов</span>
                      <span onClick={()=>{setMixSavedPlans([]);localStorage.removeItem('he_mix_saved_plans');}} style={{fontSize:7,color:'#ef4444',cursor:'pointer'}}>✕ Очистить</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {mixSavedPlans.slice().reverse().map((plan:any, i:number) => (
                        <div key={plan.id||i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
                          onClick={() => {
                            setMixGoals([plan.goal]);
                            setMixTiming(plan.timing || 'pre');
                            setMixWorkoutType(plan.workoutType || 'moderate');
                            setMixTimeOfDay(plan.timeOfDay || 'morning');
                            setMixInsulin(plan.insulin||0); setMixInsulinTiming(plan.insulinTiming||'post');
                            setMixDrugIGF(plan.igf||0); setMixDrugIGFTiming(plan.igfTiming||'post');
                            setMixDrugGH(plan.gh||0); setMixDrugGHTiming(plan.ghTiming||'post');
                            setMixDrugMGF(plan.mgf||0); setMixDrugMGFTiming(plan.mgfTiming||'post');
                            setMixDrugGLP1(plan.glp1||false);
                            if (plan.appliedTemplate) {
                              const tmpl = MIX_TEMPLATES.find(t => t.id === plan.appliedTemplate.id);
                              if (tmpl) { setAppliedTemplate(tmpl); localStorage.setItem('he_mix_applied_template', JSON.stringify(tmpl)); }
                            }
                            setPlanSaved(`✅ Загружен план: ${plan.name}`);
                            setTimeout(() => setPlanSaved(''), 3000);
                          }}
                        >
                          <div style={{fontSize:9,fontWeight:700,color:'var(--text-light)'}}>{plan.name}</div>
                          <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3}}>
                            🎯 {plan.goal} · 📍 {plan.timing||'pre'} · 💉 {[plan.insulin>0&&'Insulin',plan.igf>0&&'IGF',plan.gh>0&&'GH',plan.mgf>0&&'MGF',plan.glp1&&'GLP1'].filter(Boolean).join('+')||'—'}
                            · ⭐ {plan.score||'?'} · {new Date(plan.date).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card" style={{ padding:10, marginBottom:8 }}>
                  <div onClick={()=>setExpandedSection(prev=>{const n=new Set(prev);n.has('mech')?n.delete('mech'):n.add('mech');return n;})} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                    <span style={{fontSize:10,fontWeight:700,color:'var(--accent)'}}>🧬 Описание механизмов</span>
                    <span style={{fontSize:9,color:'var(--text-dim)'}}>{expandedSection.has('mech')?'▾':'▸'}</span>
                  </div>
                  {expandedSection.has('mech') && <div style={{marginTop:6}}>
                    <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4,marginBottom:6}}><b>Принцип синергии стека ({mixGoal}):</b> {MIX_SYNERGY[mixGoal]||'—'}</div>
                    {dedupedStack.filter(s=>s.mg>0).map((s,i)=>{
                      const mechText = (MIX_MECHANISMS as any)[s.id] || '—';
                      return (
                        <div key={i} style={{padding:'4px 6px',marginBottom:3,borderRadius:6,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
                          <div style={{fontSize:8,fontWeight:600,color:'var(--text-light)'}}>{s.name} <span style={{color:'var(--accent)',fontWeight:400}}>({s.dose}{s.unit?' '+s.unit:''})</span></div>
                          <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginTop:1}}>{mechText}</div>
                        </div>
                      );
                    })}
                  </div>}
                </div>

                {/* Recipe engine info card — interactive with remove/replace */}
                {recipeResult && (() => {
                  const handleRemove = (itemKey: string) => {
                    setCustomRecipeOverrides(prev => {
                      const next = { removed: [...prev.removed, itemKey], replaced: {...prev.replaced} };
                      localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                      return next;
                    });
                  };
                  const handleReplace = (itemKey: string, alt: { id:string; dose:string; unit:string; note:string }) => {
                    setCustomRecipeOverrides(prev => {
                      const next = { removed: prev.removed.filter(r => r !== itemKey), replaced: {...prev.replaced, [itemKey]: alt} };
                      localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                      return next;
                    });
                  };
                  const handleResetOverrides = () => {
                    setCustomRecipeOverrides({ removed: [], replaced: {} });
                    localStorage.removeItem('he_mix_recipe_overrides');
                  };
                  const hasOverrides = customRecipeOverrides.removed.length > 0 || Object.keys(customRecipeOverrides.replaced).length > 0;
                  return (
                    <div className="card" style={{ padding:10, borderLeft:`3px solid ${recipeResult.recipe.synergyScore >= 90 ? '#22c55e' : recipeResult.recipe.synergyScore >= 70 ? '#eab308' : '#ef4444'}`, marginBottom:8 }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:4}}>
                        <span style={{fontSize:10,fontWeight:700,color:'var(--accent)'}}>🧪 {recipeResult.recipe.name}</span>
                        <span style={{fontSize:8,padding:'2px 6px',borderRadius:8,background:'rgba(0,230,138,0.1)',color:'var(--accent)'}}>score {recipeResult.recipe.synergyScore}</span>
                      </div>
                      <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.4,margin:'4px 0'}}>{recipeResult.recipe.synergyNote}</div>
                      {/* Substances with X to remove + replace buttons */}
                      <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:4}}>
                        {(groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || []).filter(item => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`)).map((item, ii) => {
                          const itemKey = `${item.id}_${item.timing}`;
                          const isReplaced = customRecipeOverrides.replaced[itemKey];
                          const effectiveItem = isReplaced ? { ...item, ...isReplaced } : item;
                          // Find original item to get alternatives
                          const origItem = drugItems.find(d => d.id === item.id && d.timing === item.timing);
                          const alts = origItem?.alternatives || [];
                          return (
                            <div key={ii} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.02)',borderRadius:4,padding:'3px 6px'}}>
                              <span style={{fontSize:7,fontWeight:600,color:'var(--text-light)',flex:1}}>{item.id}{isReplaced ? ` → ${isReplaced.id}` : ''} </span>
                              <span onClick={()=>setEditingDose({ id:item.id, timing:item.timing, currentDose:effectiveItem.dose, currentUnit:effectiveItem.unit })} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',borderBottom:'1px dotted rgba(0,230,138,0.3)'}}>{effectiveItem.dose}{effectiveItem.unit}</span>
                              <span style={{fontSize:6,color:'var(--text-dim)'}}>{effectiveItem.timing}</span>
                              {alts.length > 0 && (
                                <select value="" onChange={e=>{if(e.target.value){handleReplace(itemKey,JSON.parse(e.target.value));}}} style={{fontSize:6,padding:'1px 3px',borderRadius:3,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',maxWidth:70}}>
                                  <option value="">Заменить</option>
                                  {alts.map((a,ai) => (
                                    <option key={ai} value={JSON.stringify(a)}>{a.id}</option>
                                  ))}
                                </select>
                              )}
                              <span onClick={()=>handleRemove(itemKey)} style={{fontSize:7,color:'#ef4444',cursor:'pointer',padding:'1px 4px',borderRadius:3,background:'rgba(239,68,68,0.08)'}}>✕</span>
                            </div>
                          );
                        })}
                      </div>
                      {hasOverrides && (
                        <div style={{marginTop:6,display:'flex',gap:4}}>
                          <span onClick={handleResetOverrides} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Сбросить изменения</span>
                        </div>
                      )}
                      {effectiveDrugItems.length > 0 && <div style={{marginTop:6,display:'flex',gap:4}}>
                        <span onClick={()=>{
                          const name = prompt('Название рецепта:', recipeResult.recipe.name);
                          if (!name) return;
                          const items = (groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || []).filter(item => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`));
                          const newRecipe = { id:'custom_'+Date.now(), name, goal:mixGoal, items };
                          const updated = [...mixSavedRecipes, newRecipe];
                          setMixSavedRecipes(updated);
                          localStorage.setItem('he_mix_saved_recipes', JSON.stringify(updated));
                        }} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',padding:'2px 6px',borderRadius:4,border:'1px solid rgba(0,230,138,0.3)'}}>💾 Сохранить как мой рецепт</span>
                      </div>}
                    </div>
                  );
                })()}
                {mixSavedRecipes.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8 }}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',marginBottom:6}}>📂 Мои рецепты ({mixSavedRecipes.length})</div>
                    {mixSavedRecipes.map((r, ri) => (
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',marginBottom:3,borderRadius:6,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
                        <span style={{fontSize:8,fontWeight:600,color:'var(--text-light)',flex:1}}>{r.name}</span>
                        <span style={{fontSize:6,color:'var(--text-dim)'}}>{r.goal}</span>
                        <span style={{fontSize:7,color:'var(--accent)',cursor:'pointer'}} onClick={() => {
                          const overrides: {removed:string[]; replaced:Record<string,{id:string;dose:string;unit:string;note:string}>} = { removed:[], replaced:{} };
                          for (const item of r.items) {
                            overrides.replaced[`${item.id}_${item.timing}`] = { id:item.id, dose:item.dose, unit:item.unit, note:item.note };
                          }
                          setCustomRecipeOverrides(overrides);
                          localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(overrides));
                        }}>↩ Загрузить</span>
                        <span style={{fontSize:7,color:'#ef4444',cursor:'pointer'}} onClick={() => {
                          const updated = mixSavedRecipes.filter(x => x.id !== r.id);
                          setMixSavedRecipes(updated);
                          localStorage.setItem('he_mix_saved_recipes', JSON.stringify(updated));
                        }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="card" style={{ padding:10, marginBottom:8 }}>
                  <h4 style={{ margin:'0 0 6px', fontSize:11, color:'var(--text)' }}>📋 Все три стека (обзор) · цель: {
                    { pump:'🩸 Памп', endurance:'🏃 Выносливость', strength:'🏋️ Сила', recovery:'🔄 Восстановление', focus:'🧠 Фокус', powerlifting:'💪 Пауэрлифтинг', competition:'🏆 Соревнования', crossfit:'🔁 CrossFit', post_comp:'🔄 Пост-соревнования', hiit:'💨 HIIT', mma:'🥊 MMA', sprint:'🏃 Спринт' }[mixGoal] || mixGoal
                  }</h4>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {[
                      { label:'🔥 Пред', items:preStack.slice(0,7).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                      { label:'💧 Интра', items:intraStack.slice(0,5).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                      { label:'🍗 Пост', items:postStack.slice(0,7).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                    ].map((grp, gi) => (
                      <div key={gi} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:3 }}>{grp.label}-тренировочный</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{grp.items}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding:10 }}>
                  <h4 style={{ margin:'0 0 4px', fontSize:10, color:'var(--text-dim)' }}>📌 Как считается скор</h4>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • Каждое вещество имеет базовый скор (65-90) × курс (×1.25) × фарма-модификаторы (инсулин +15%, ГР +10%, ИГФ +10%, МГФ +8%)<br/>
                    • Pre-workout вес: пампинг 25% + энергия 25% + фокус 25% + сила 25%<br/>
                    • Intra-workout вес: гидратация 30% + выносливость 25% + анти-катаболизм 15% + пампинг 10%<br/>
                    • Post-workout вес: восстановление 35% + белок 25% + гликоген 10% + сила 10%<br/>
                    • Углеводы: вес×0.6-1.2×множитель × инсулин-буст (×1.3)<br/>
                    • Аминокислоты: intra 0.15 г/кг, post 0.4 г/кг, pre 0.1 г/кг × инсулин/ГР-буст<br/>
                  </div>
                </div>

                {/* Dose editor popup */}
                {editingDose && (
                  <div style={{
                    position:'fixed', top:0, left:0, right:0, bottom:0,
                    background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center',
                    zIndex:1000
                  }} onClick={()=>setEditingDose(null)}>
                    <div className="card" style={{padding:16,width:280,maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',marginBottom:8}}>✏️ Редактировать дозу: {editingDose.id}</div>
                      <div style={{display:'flex',gap:6}}>
                        <input type="text" value={editingDose.currentDose} onChange={e=>setEditingDose({...editingDose,currentDose:e.target.value})}
                          style={{flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid var(--glass-border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:9}} />
                        <input type="text" value={editingDose.currentUnit} onChange={e=>setEditingDose({...editingDose,currentUnit:e.target.value})}
                          style={{width:50,padding:'6px 8px',borderRadius:6,border:'1px solid var(--glass-border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:9}} />
                      </div>
                      <div style={{display:'flex',gap:6,marginTop:8}}>
                        <span style={{padding:'6px 12px',borderRadius:6,background:'var(--accent)',color:'#000',fontSize:9,cursor:'pointer',fontWeight:600}} onClick={()=>{
                          setCustomRecipeOverrides(prev => {
                            const key = `${editingDose.id}_${editingDose.timing}`;
                            const next = { removed: prev.removed.filter(r => r !== key), replaced: {...prev.replaced, [key]: { id:editingDose.id, dose:editingDose.currentDose, unit:editingDose.currentUnit, note:prev.replaced[key]?.note||'' }} };
                            localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                            return next;
                          });
                          setEditingDose(null);
                        }}>✅ Применить</span>
                        <span style={{padding:'6px 12px',borderRadius:6,background:'rgba(255,255,255,0.06)',color:'var(--text)',fontSize:9,cursor:'pointer'}} onClick={()=>setEditingDose(null)}>Отмена</span>
                      </div>
                    </div>
                  </div>
                )}
              </>);
            })()}
            {mixHistory.length > 0 && (
              <div className="card" style={{ padding:10, marginTop:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                  <span>📂 История миксов ({mixHistory.length})</span>
                  <button onClick={()=>{setMixHistory([]);localStorage.setItem('he_training_mixes','[]')}} style={{fontSize:7,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>✕ очистить</button>
                </div>
                {mixHistory.slice(-5).reverse().map((h:any,i:number)=>(
                  <div key={i} style={{padding:'6px 8px',borderRadius:6,marginBottom:3,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',fontSize:8}}>
                    <span style={{color:'var(--accent)',fontWeight:700}}>{h.goal} · {h.timing} · {h.type}</span>
                    <span style={{color:'rgba(255,255,255,0.5)',marginLeft:6}}>{h.score}/100 · {h.date}</span>
                    <button onClick={()=>{setMixGoals([h.goal]);setMixTiming(h.timing);setMixWorkoutType(h.type);setMixTimeOfDay(h.tod);}} style={{marginLeft:6,fontSize:7,color:'#60a5fa',background:'none',border:'none',cursor:'pointer'}}>↩ загрузить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </InfoErrorBoundary>)}

      {/* ===== PEPTIDE CALCULATOR ===== */}
      {section === 'info' && tab === 'main' && supportView === 'calc' && calcView === 'peptides' && (<InfoErrorBoundary label="Пептидный калькулятор">
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#a78bfa' }}>🧬 Пептидный калькулятор</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Расчёт дозировок, баков, разведения и протоколов пептидов.</p>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            {/* Peptide Selection */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>🧪 Выберите пептид</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
                {PEPTIDE_LIST.map(p => (
                  <button key={p.id} onClick={() => { setPeptideId(p.id); setPepAmount(2); setPepDose(100); }} style={{
                    padding:'6px 10px', borderRadius:16, fontSize:9, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                    background: peptideId === p.id ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: peptideId === p.id ? '#000' : 'var(--text-dim)',
                    border: `1px solid ${peptideId === p.id ? 'var(--accent)' : 'var(--border)'}`,
                  }}>{p.name}</button>
                ))}
              </div>
              {peptideId && (() => {
                const sel = PEPTIDE_LIST.find(p => p.id === peptideId);
                if (!sel) return null;
                const routesStr = (sel.routes||[]).map(r => ROUTE_LABELS[r]||r).join(', ') || '—';
                const riskColor = sel.riskLevel === 'high' ? '#ef4444' : sel.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
                const riskLabel = sel.riskLevel === 'high' ? 'Высокий' : sel.riskLevel === 'medium' ? 'Средний' : sel.riskLevel === 'low' ? 'Низкий' : '—';
                return (
                  <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>{sel.name || sel.shortName || '—'}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4, marginBottom:3 }}>
                      <b>Эффекты:</b> {(sel.effects || []).join(', ') || '—'}
                    </div>
                    <div style={{ fontSize:8, color:'#a78bfa', marginBottom:2 }}>
                      <b>T½:</b> {sel.tHalfHours || '—'} ч · <b>Класс:</b> {sel.className || '—'} · <b>Пути:</b> {routesStr}
                    </div>
                    {(sel.mechanisms||[]).length > 0 && (
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.9)', marginBottom:2, lineHeight:1.3 }}>
                        <b>Механизмы:</b> {(sel.mechanisms||[]).join(', ') || '—'}
                      </div>
                    )}
                    <div style={{ fontSize:8, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ color: 'var(--text-dim)' }}><b>Во флаконе:</b> {sel.amountMg || '—'} мг</span>
                      <span style={{ color: riskColor, fontWeight:600 }}><b>Риск:</b> {riskLabel}</span>
                      {(sel.riskNotes||[]).length > 0 && (
                        <span style={{ color:'#f59e0b', fontSize:7, maxWidth:180, lineHeight:1.2, display:'inline-block' }}>
                          ⚠ {(sel.riskNotes||[]).slice(0,3).join('; ') || '—'}
                        </span>
                      )}
                    </div>
                    {sel.bioavailability && Object.keys(sel.bioavailability).length > 0 && (
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>
                        <b>Биодоступность:</b> {Object.entries(sel.bioavailability).map(([k,v]) => `${ROUTE_LABELS[k]||k}: ${v.avg}%`).join(', ') || '—'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dilution Calculator */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>💧 Калькулятор разведения</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <PopupNumber label="💊 Кол-во пептида" value={pepAmount} min={0.1} max={100} step={0.1} suffix="мг" onChange={v => setPepAmount(Math.max(0.1, v))} />
                <PopupNumber label="💧 Объём бака" value={pepDilution} min={0.1} max={50} step={0.1} suffix="мл" onChange={v => setPepDilution(Math.max(0.1, v))} />
                <PopupNumber label="💉 Дозировка" value={pepDose} min={1} max={10000} step={10} suffix="мкг" onChange={v => setPepDose(Math.max(1, v))} />
                <PopupSelect label="💉 Шприц" value={pepSyringe} options={Object.entries(SYRINGE_TYPES).map(([k, v]) => ({ id: k, label: v.label }))} onChange={v => setPepSyringe(v as keyof typeof SYRINGE_TYPES)} />
              </div>
              {(() => {
                const conc = pepAmount / pepDilution; // mg/mL
                const doseMg = pepDose / 1000; // mcg -> mg
                const doseMl = doseMg / conc;
                const syringeInfo = SYRINGE_TYPES[pepSyringe];
                const units = syringeInfo ? doseMl * syringeInfo.unitsPerMl : doseMl * 100;
                return (
                  <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📐 Результат разведения</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                      <div>Концентрация: <b style={{ color:'#60a5fa' }}>{conc.toFixed(2)} мг/мл</b></div>
                      <div>Объем дозы: <b style={{ color:'#60a5fa' }}>{doseMl.toFixed(3)} мл</b></div>
                      <div>Единиц (IU): <b style={{ color:'#60a5fa' }}>{units.toFixed(0)} IU</b></div>
                      <div>Доз на флакон: <b style={{ color:'#60a5fa' }}>{pepDilution > 0 && doseMl > 0 ? Math.floor(pepDilution / doseMl) : 0}</b></div>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Наберите {units.toFixed(0)} IU ({doseMl.toFixed(3)} мл) для дозы {pepDose} мкг</div>
                  </div>
                );
              })()}
            </div>

            {/* PK Display */}
            {peptideId && (() => {
              const sel = PEPTIDE_LIST.find(p => p.id === peptideId);
              if (!sel) return null;
              const tHalf = sel.tHalfHours || 4;
              const peakTime = tHalf * 0.33;
              const steadyState = tHalf * 5;
              const clearanceTime = tHalf * 6;
              return (
                <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
                  <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#a78bfa' }}>📈 Фармакокинетика (PK)</h4>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Период полувыведения (T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{tHalf.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Пик концентрации (Cmax)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{peakTime.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Стабильное состояние (5×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{steadyState.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Полный клиренс (6×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{clearanceTime.toFixed(1)} ч</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dosing Schedule */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#f59e0b' }}>📅 График дозирования</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => {
                  const active = pepSchedule.includes(day);
                  return (
                    <button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter(d => d !== day) : [...pepSchedule, day])} style={{
                      padding:'6px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}>{day}</button>
                  );
                })}
              </div>
              <div>
                <PopupNumber label="📅 Длительность (дней)" value={pepTotalDays} min={1} max={365} step={1} suffix="дн" onChange={v => setPepTotalDays(Math.max(1, v))} />
              </div>
              <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📊 Итого</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                  <div>Доз в неделю: <b style={{ color:'#f59e0b' }}>{pepSchedule.length}</b></div>
                  <div>Всего доз: <b style={{ color:'#f59e0b' }}>{Math.round(pepTotalDays / 7 * pepSchedule.length)}</b></div>
                  <div>Недельный расход: <b style={{ color:'#f59e0b' }}>{(pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                  <div>Общий расход: <b style={{ color:'#f59e0b' }}>{(pepTotalDays / 7 * pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </InfoErrorBoundary>)}

      {/* ===== MODAL OVERLAY ===== */}
      {showModal && <SupportModals
        showModal={showModal} setShowModal={setShowModal}
        modalLevel={modalLevel} setModalLevel={setModalLevel}
        modalSearch={modalSearch} setModalSearch={setModalSearch}
        modalSelected={modalSelected} setModalSelected={setModalSelected}
        modalAddMode={modalAddMode} setModalAddMode={setModalAddMode}
        showSavedPicker={showSavedPicker} setShowSavedPicker={setShowSavedPicker}
        setEnhancedSubs={setEnhancedSubs}
        setBoostEnabled={setBoostEnabled}
        setSupportLevel={setSupportLevel}
        setManualLevelSelected={setManualLevelSelected}
        calcSupport={calcSupport}
        catalogSupport={catalogSupport}
        allSupport={allSupport}
        catalogSubstances={catalogSubstances}
        jointMode={jointMode}
        setJointMode={setJointMode}
        boostEnabled={boostEnabled}
        getStackDisplayName={getStackDisplayName}
        savedStacks={savedStacks}
        MECH_TRANSLATIONS_RU={MECH_TRANSLATIONS_RU}
        SUPPORT_LEVELS={SUPPORT_LEVELS}
        courseWeekState={courseWeekState}
        setCourseWeekState={setCourseWeekState}
        maxCourseWeek={Math.max(2, ...((linked.course || []).map((c: any) => (c.endWeek || 12) - (c.startWeek || 0))), 12)}
        onWeekChange={(newWeek: number) => {
          if (calcDone && calcResult) {
            calcSupport(supportLevel);
            setWeekChangeMsg(`Неделя ${newWeek}: план пересчитан с учётом накопленного риска.`);
            setTimeout(() => setWeekChangeMsg(''), 4000);
          }
        }}
      />}

      {/* ===== STACK BUILDER FLOATING BADGE ===== */}
      {stackBuilder.length > 0 && (
        <div style={{ position:'sticky', bottom:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 14px', borderRadius:16, background:'rgba(0,0,0,0.6)', border:'1px solid rgba(0,230,138,0.3)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>🧮 Стек: {stackBuilder.length} веществ</span>
          <button onClick={() => setStackBuilder([])} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontWeight:600 }}>Очистить</button>
          <button onClick={saveBuilderStack} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', border:'none', color:'#000', fontWeight:700 }}>Сохранить</button>
        </div>
      )}
    </div>
  );
};
