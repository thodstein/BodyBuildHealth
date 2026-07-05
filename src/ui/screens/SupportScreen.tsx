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
import { getBpRiskLevel } from '../../core/bp-hr-data';
import { SUPPORT_CATALOG_DATA, CATALOG_ENRICHMENT, ORGAN_LABELS as CATALOG_ORGAN_LABELS, SYSTEM_LABELS_CATALOG, CATEGORY_LABELS as CATALOG_CATEGORY_LABELS, type SupportCatalogEntry } from '../../data/support-database';

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
  computePharmaAdjustedDose,
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
import { calculateSupportTZ, hydrateState } from '../../engines/support-plan';
import type { CalculatorState, CalculatorResult, PowerLevel } from '../../engines/support-plan';
import { getDrugTzMechanisms, getSupportTzDisplay, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../data/support-db';
import { getLabEffectsForDrug, getMarkerName } from '../../data/support-lab-effects';
import { runSupportUnified, runSupportForLevel } from '../../engines/support-plan';
import type { PlanResult, PlanSubstance } from '../../engines/support-plan';
import { writeRiskBridge } from '../../engines/risk-bridge';
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
type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'plan' | 'reports';
type InfoView = 'main' | 'catalog' | 'interactions' | 'stacks' | 'research' | 'favorites' | 'protocols' | 'biostack' | 'diary' | 'bioavailability' | 'symptoms';

import { INTERACTION_TYPE_LABELS, EFFECT_LABELS, INTERACTION_SEVERITY_LABELS, CATEGORY_LABELS, MECH_TRANSLATIONS_RU, ORGAN_MECHANISMS, getCategoryInfo, TYPE_LABELS_RU, CLASS_BASE_NAMES, SYNERGY_COLORS, SUPPORT_CLASS_LABELS, MECH_LABELS, SUPPORT_MED_DETAIL, InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';
import { PopupBool, PopupNumber, PopupSelect } from '../components/PopupXxx';
import { BioStackAIScreen } from '../components/BioStackAIScreen';
import { SupportPeptideCalc } from './SupportScreen_parts/SupportPeptideCalc';
import { SupportResearch } from './SupportScreen_parts/SupportResearch';
import { SupportGeneratorInfo } from './SupportScreen_parts/SupportGeneratorInfo';
import { SupportHomeView } from './SupportScreen_parts/SupportHomeView';
import { SupportCatalogView } from './SupportScreen_parts/SupportCatalogView';
import { SupportInteractionsView } from './SupportScreen_parts/SupportInteractionsView';
import { SupportFavoritesView } from './SupportScreen_parts/SupportFavoritesView';
import { SupportDiaryView } from './SupportScreen_parts/SupportDiaryView';
import { SupportStacksView } from './SupportScreen_parts/SupportStacksView';
import { SupportCalcResult } from './SupportScreen_parts/SupportCalcResult';
import { DosageDatabaseView } from '../components/DosageCalculator';
import { ComplaintsTab } from './SupportScreen_parts/ComplaintsTab';
import { SupportProtocols } from './SupportScreen_parts/SupportProtocols';
import { SupportBioavailability } from './SupportScreen_parts/SupportBioavailability';
import { SymptomSolverTab } from './SupportScreen_parts/SymptomSolverTab';
import { AutoCalculator } from './SupportScreen_parts/AutoCalculator';
export const SupportScreen: React.FC<{ initialTab?: SupportTab }> = ({ initialTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<SupportTab>(initialTab || 'main');
  const [supportView, setSupportView] = useState<SupportView>('main');
  const [calcView, setCalcView] = useState<CalcView>('main');
  const [infoView, setInfoView] = useState<InfoView>('main');
  const [section, setSection] = useState<'home'|'generator'|'protocols'|'info'>('home');
  const [genTab, setGenTab] = useState<'calculator'|'info'|'dosages'|'complaints'>('calculator');
  const [protocolTab, setProtocolTab] = useState<'pct'|'fertility'|'hrt'|'neuro'|'joints'|'acne'|'injections'>('pct');
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
  const [reproMode, setReproMode] = useState(false);
  const [neuroMode, setNeuroMode] = useState(false);
  const stateRef = useRef<CalculatorState | null>(null);
  const [myPlansRefresh, setMyPlansRefresh] = useState(0);
  const [weekChangeMsg, setWeekChangeMsg] = useState('');
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

  const SUPPORT_LEVELS: Record<string, { label: string; desc: string; range: [number, number]; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }> = {
    basic: { label: '🟢 База', desc: 'Риск 55–65%', range: [55, 65], subs: [], dosages: {} },
    mid: { label: '🟡 Средний', desc: 'Риск 45–55%', range: [45, 55], subs: [], dosages: {} },
    max: { label: '🟠 Максимум', desc: 'Риск 30–45%', range: [30, 45], subs: [], dosages: {} },
    boost: { label: '🔴 Буст', desc: 'Риск 15–30%', range: [15, 30], subs: [], dosages: {} },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
    // Проверка флага навигации из ProfileScreen → БАД-дневник
    try {
      if (localStorage.getItem('he_nav_to_diary') === '1') {
        localStorage.removeItem('he_nav_to_diary');
        setTab('main');
        setSupportView('calc');
        setCalcView('info');
        setSection('home');
        setInfoView('diary');
      }
    } catch {}
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
    if (hasHighRisk || (hasOral && count >= 2)) level = 'max';
    else if (hasOral || count >= 3) level = 'mid';
    else if (count >= 1) level = 'basic';
    // Risk-based: recommend level matching target (≤50=база, ≤35=средний, ≤25=макс, ≤15=буст)
    const riskNet = linked.risk?.overallNet ?? 0;
    if (riskNet > 25) level = 'max';
    else if (riskNet > 35) level = 'boost';
    // Lab abnormality count
    const abnormalCount = (linked.labAnalysis?.interpretations || []).filter(
      i => i.status === 'high' || i.status === 'critical_high'
    ).length;
    if (abnormalCount > 3) level = 'boost';
    else if (abnormalCount > 1 && level === 'basic') level = 'mid';
    setAutoLevel(level);
    if (!manualLevelSelected) setSupportLevel(level);
  }, [supportDrugs, linked.risk, linked.labAnalysis, manualLevelSelected]);

  // ── ЕДИНЫЙ ДВИЖОК (один вызов → PlanResult со всем: вещества + риски + display) ──
  // BUG 8: Раньше здесь работали ДВА движка (calculateSupportPlan + calculateSupportTZ) с разной
  // логикой → дубли (3-4 одинаковых), разные цифры риска, «непонятные препараты».
  // Теперь ОДИН вызов `runSupportUnified(state)` из src/engines/support-plan/index.ts.
  // Внутри: calculateSupportTZ (вещества + риск) + генерация display-данных из каталога.
  // Кнопки БАЗОВЫЙ/СРЕДНИЙ/МАКСИМУМ/БУСТ → powerLevel → target риск % (65/55/45/30).
  // Кнопки 🔥Усиление / 🦴Суставы / ♀Репродукт. → флаги boostEnabled/jointMode/reproMode.
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const effectiveLevel = useMemo(() => {
    const s = linked.profile?.settings;
    const aasList = (linked.course || []).filter((c: any) => {
      const ph = PHARMA_DB[c.substanceId];
      return ph?.class && ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'].includes(ph.class);
    }).map((c: any) => ({ id: c.substanceId || '', doseMgWeek: (c.doseValue || 0) * (c.frequency || 1), weeks: (c.endWeek || 12) - (c.startWeek || 0), startWeek: c.startWeek || 1, endWeek: c.endWeek || 12 }));
    const h = hydrateState();
    const state: CalculatorState = {
      profile: h.profile || { weight: s?.weight ?? 80, age: s?.age ?? 30, sex: (s?.sex ?? 'male') as 'male' | 'female', workoutsPerWeek: s?.workoutsPerWeek ?? 3, avgWorkoutMinutes: s?.avgWorkoutMinutes ?? 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
      neuro: h.neuro || { dopamineScore: 0, serotoninScore: 0, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 0, headaches: false, weatherDependent: false, sleepQuality: 'good' },
      pharma: h.pharma || { phase: (supportPhase === 'fertility' ? 'pct' : supportPhase) as any, aas: aasList, hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false, hasMGF: false, hasGLP1: false },
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
      boostEnabled: boostEnabled,
      jointMode: jointMode,
      reproMode: reproMode,
      neuroMode: neuroMode,
    };
    // ── ОДИН ВЫЗОВ ──
    const planRes = runSupportUnified(state);
    setPlanResult(planRes);
    // subs + dosages из единого результата (с dedup)
    const subs: string[] = [...new Set(planRes.substances.map(p => p.id))];
    const dosages: Record<string, { mg: number; timing: string }> = {};
    for (const p of planRes.substances) {
      dosages[p.id] = { mg: p.doseMg, timing: p.timing };
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
    // Add enhancedSubs (manual additions) — с dedup
    for (const enhId of enhancedSubs) {
      if (!subs.includes(enhId)) {
        subs.push(enhId);
        const d = DEFAULT_DOSAGES[enhId];
        dosages[enhId] = d ? { mg: d.mg, timing: d.timing } : { mg: 500, timing: 'с едой' };
      }
    }
    return { subs, dosages };
  }, [supportLevel, supportPhase, selectedAnalogs, enhancedSubs, linked.course, linked.profile, courseWeekState, boostEnabled, jointMode, reproMode, neuroMode]);

  const calcSupport = (overrideLevel?: 'basic' | 'mid' | 'max' | 'boost', overrideSubs?: string[]) => {
    try {
    const s = linked.profile?.settings;
    const level = (overrideLevel || supportLevel) as PowerLevel;
    // Build TZ state from linked data
    const h = hydrateState();
    const aasList = (linked.course || []).filter(c => {
      const ph = PHARMA_DB[c.substanceId] as any;
      return ph?.class && ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'].includes(ph.class);
    }).map(c => ({ id: c.substanceId, doseMgWeek: (c.doseValue || 0) * ((typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0) > 0 ? (typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0) : 1), weeks: (c.endWeek || 12) - (c.startWeek || 0), startWeek: c.startWeek || 1, endWeek: c.endWeek || 12 }));
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
      boostEnabled: boostEnabled,
      jointMode: jointMode,
      reproMode: reproMode,
      neuroMode: neuroMode,
    } as CalculatorState;
    stateRef.current = state;
    const tzResult: CalculatorResult = calculateSupportTZ(state);
    // ── ЕДИНЫЙ ДВИЖОК РИСКА: calculateTzSpecRisk (механизм-ориентированная модель) ──
    // calculateSupportTZ уже использует calculateTzSpecRisk внутри.
    // Никаких вторых движков (calculateTZRisk удалён — был рассинхрон).
    const systemBreakdown: Record<string, { raw: number; net: number }> = {};
    for (const cmp of (tzResult.comparisonBeforeAfter || [])) {
      systemBreakdown[cmp.system] = { raw: cmp.before, net: cmp.after };
    }
    const calcResultData: Record<string, any> = {
      riskBeforeSupport: tzResult.overallRiskBefore,
      riskAfterSupport: tzResult.overallRiskAfter,
      supportScore: Math.round(100 - tzResult.overallRiskAfter),
      systemSupport: Object.fromEntries(
        Object.entries(systemBreakdown).map(([k, v]) => [k, 100 - v.net])
      ),
      coverageMap: Object.fromEntries(
        Object.entries(systemBreakdown).map(([k, v]) => [k, Math.max(0, Math.min(1, (v.raw - v.net) / Math.max(1, v.raw)))])
      ),
      riskAssessment: {
        systemBreakdown,
        mechanismBreakdown: {},
        mechanismDetail: (tzResult.risk?.systems || []).flatMap((sys: any) =>
          (sys.mechanisms || []).map((m: any) => ({ system: sys.id, ...m }))
        ),
      },
      tzRiskResult: tzResult,
      timestamp: tzResult.timestamp ?? new Date().toISOString(),
      schedule: tzResult.schedule,
      synergyIdsUsed: tzResult.synergyIdsUsed,
      selectedSubstances: tzResult.selectedSubstances,
      jointSubs: tzResult.jointSubs || [],
      contraindicationAlerts: tzResult.contraindicationAlerts,
      negativeBlocks: tzResult.negativeBlocks,
      synergyRecommendations: tzResult.synergyRecommendations || [],
      boostAdded: tzResult.boostAdded || [],
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
      const bridgeSubs = effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || [];
      localStorage.setItem('he_support_risk', JSON.stringify({
        riskBeforeSupport: calcResultData.riskBeforeSupport,
        riskAfterSupport: calcResultData.riskAfterSupport,
        systemSupport: calcResultData.systemSupport,
        subs: bridgeSubs,
        timestamp: Date.now(),
      }));
      // Write unified risk bridge (C18: RiskScreen ↔ support engine sync)
      writeRiskBridge({
        riskBefore: calcResultData.riskBeforeSupport,
        riskAfter: calcResultData.riskAfterSupport,
        supportScore: calcResultData.supportScore,
        systemBreakdown: calcResultData.riskAssessment?.systemBreakdown || {},
        mechanismDetail: calcResultData.riskAssessment?.mechanismDetail || [],
        subs: bridgeSubs,
      });
    } catch (e2) { /* ignore profile save errors */ }
    } catch (err: any) {
      console.error('calcSupport error:', err);
      showToast(`Ошибка расчёта: ${err?.message || 'Неизвестная ошибка'}`, 'error');
      setCalcDone(false);
    }
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
  useEffect(() => { try { const saved = localStorage.getItem('he_support_report_current'); if (saved) { setReportGenerated(true); setSupportReportCurrent(JSON.parse(saved)); } } catch {} }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('he_biostack_to_plan');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.stackIds && Array.isArray(data.stackIds) && data.stackIds.length > 0) {
          setEnhancedSubs(prev => [...new Set([...prev, ...data.stackIds])]);
          localStorage.removeItem('he_biostack_to_plan');
          showToast(`BioStack: +${data.stackIds.length} веществ добавлено в план`, 'success');
        }
      }
    } catch {}
  }, []);
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
  const [neuroTab, setNeuroTab] = useState<string>('mechanisms');

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
  const CATALOG_BLACKLIST = new Set([
    'testosterone','insulin','vasopressin','follistatin','endocannabinoid',
    'igf1','mgf','glutamate','histidine','pharma',
    'corticosteroid_drugs','antibiotic_drugs','nsaid_drugs','immunosuppressant_drugs',
    'ppi_drugs','antipsychotic_drugs','antithyroid_drugs',
  ]);
  const catalogSubstances = useMemo(() => {
    const allSubsMap = new Map<string, SupportSubstance>();
    for (const s of ALL_SUBSTANCES) allSubsMap.set(s.id.toLowerCase(), s);
    return Object.values(SUPPORT_CATALOG_DATA)
      .filter(entry => {
        const eid = entry.id || '';
        if (CATALOG_BLACKLIST.has(eid)) return false;
        const cats = entry.category || [];
        if (cats.includes('marker')) return false;
        if (eid.endsWith('_drugs')) return false;
        if (entry.dosage && entry.dosage.mg === 0 && cats.includes('hormonal')) return false;
        return true;
      })
      .map(entry => {
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
      // tier filter removed — no longer filtering by tier
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
      seen.add(item.interactionId.toLowerCase());
      seen.add(`${item.substanceA.toLowerCase()}|${item.substanceB.toLowerCase()}`);
      seen.add([item.substanceA.toLowerCase(), item.substanceB.toLowerCase()].sort().join('||'));
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
    const dedupedEngine = fromEngine.filter(e => {
      const pk1 = `${e.substanceA.toLowerCase()}|${e.substanceB.toLowerCase()}`;
      const pk2 = [e.substanceA.toLowerCase(), e.substanceB.toLowerCase()].sort().join('||');
      return !seen.has(pk1) && !seen.has(pk2) && !seen.has(e.interactionId.toLowerCase());
    });
    // Pharma synergy pairs (AAS + peptides + insulin)
    const PHARMA_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin']);
    const pharmaFromEngine = SYNERGY_PAIRS
      .filter(p => {
        const a = PHARMA_DB[p.substanceA];
        const b = PHARMA_DB[p.substanceB];
        return a && b && PHARMA_CLASSES.has(a.class) && PHARMA_CLASSES.has(b.class) && !catalogOk(p.substanceA) && !catalogOk(p.substanceB);
      })
      .filter(p => {
        const pk1 = `${p.substanceA.toLowerCase()}|${p.substanceB.toLowerCase()}`;
        const pk2 = [p.substanceA.toLowerCase(), p.substanceB.toLowerCase()].sort().join('||');
        return !seen.has(pk1) && !seen.has(pk2);
      })
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
  const _sevRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const supportSynergiesList = (supportInteractions?.filter(i => i.type === 'synergy') ?? []).sort((a: any, b: any) => (_sevRank[b.severity] || 0) - (_sevRank[a.severity] || 0));
  const supportConflicts = (supportInteractions?.filter(i => i.type === 'conflict') ?? []).sort((a: any, b: any) => (_sevRank[b.severity] || 0) - (_sevRank[a.severity] || 0));
  const supportCautions = (supportInteractions?.filter(i => i.type === 'caution') ?? []).sort((a: any, b: any) => (_sevRank[b.severity] || 0) - (_sevRank[a.severity] || 0));

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
        results.push({ id: sub.id, score, reason: `действует на ${target}`, pros, cons, organs: sub.organs || [] });
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
        results.push({ id: sub.id, score, reason: `механизм: ${target}`, pros, cons, organs: sub.organs || [] });
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
        results.push({ id: sub.id, score, reason: 'совпадение названия', pros: [], cons: [], organs: sub.organs || [] });
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
        results.push({ id: sub.id, score: Math.round(totalScore), reason: reasonParts.join('; ') || 'частичное совпадение', pros, cons, mechComparison: mechComparison.length > 0 ? mechComparison : undefined, organs: sub.organs || [] });
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
      // Tier filter — removed (tier system deprecated)
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
{entry.bestForCourse && (
        <div style={{ marginBottom: 3 }}>
          <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>✅ на курс</span>
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

      {(() => {
        const subIdLc = subId.toLowerCase();
        const labInfo = getLabEffectsForDrug(subIdLc);
        if (!labInfo.effects.length) return null;
        const dirColor: Record<string, string> = { up: '#ef4444', down: '#00e68a', normalize: '#60a5fa' };
        const dirArrow: Record<string, string> = { up: '↑', down: '↓', normalize: '↕' };
        return (
          <div style={{ marginTop: 3, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)' }}>
            <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>🩸 Влияние на анализы</div>
            {labInfo.effects.map((eff, i) => (
              <div key={i} style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 2, lineHeight: 1.4 }}>
                <span style={{ color: dirColor[eff.direction], fontWeight: 700 }}>{dirArrow[eff.direction]}</span>{' '}
                <b>{getMarkerName(eff.marker)}</b>
                <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 3 }}>
                  {eff.strength >= 0.4 ? 'значимо' : eff.strength >= 0.2 ? 'умеренно' : 'слабо'} ({(eff.strength * 100).toFixed(0)}%)
                </span>
                <br/><span style={{ color: 'rgba(255,255,255,0.45)' }}>{eff.reason}</span>
              </div>
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

  const buildShareText = (): string => {
    if (!planResult) return '';
    const subs = (effectiveLevel?.subs || []).map((id: string) => {
      const sub = allSupport.find((x: any) => x.id === id);
      const d = effectiveLevel?.dosages?.[id];
      const pi = planResult.substances?.find((s: any) => s.id === id);
      return `${sub?.name || id} — ${d ? (d.mg >= 5000 ? `${(d.mg/1000).toFixed(1)} г` : `${d.mg} мг`) : ''} (${d?.timing || ''})${pi ? ' — ' + pi.comment : ''}`;
    });
    return `ПЛАН ПОДДЕРЖКИ (${SUPPORT_LEVELS[supportLevel]?.label || supportLevel})
Уровень: ${supportLevel} | Неделя: ${courseWeekState}
Риск: ${planResult.overallRiskBefore}% -> ${planResult.overallRiskAfter}%
Покрытие: ${planResult.coveragePercent}%

ПРЕПАРАТЫ (${subs.length}):
${subs.join('\n')}

${planResult.synergyComment || ''}
${planResult.monitoring?.length ? 'МОНИТОРИНГ:\n' + planResult.monitoring.join('\n') : ''}`;
  };

  const savePlan = () => {
    try {
      const data = {
        level: supportLevel,
        subs: effectiveLevel?.subs || [],
        dosages: effectiveLevel?.dosages || {},
        date: new Date().toISOString(),
        riskBefore: planResult?.overallRiskBefore || 0,
        riskAfter: planResult?.overallRiskAfter || 0,
      };
      const existing = JSON.parse(localStorage.getItem('he_my_plans') || '[]');
      existing.push(data);
      localStorage.setItem('he_my_plans', JSON.stringify(existing.slice(-20)));
      setMyPlansRefresh((r: number) => r + 1);
    } catch {}
  };

  const copyPlan = () => {
    const text = buildShareText();
    navigator.clipboard?.writeText(text).then(() => {
      showToast('План скопирован', 'success');
    }).catch(() => {
      prompt('Скопируйте текст:', text);
    });
  };

  const exportForDoctor = () => {
    const text = buildShareText();
    try {
      navigator.clipboard?.writeText(text).then(() => {
        alert('Отчёт скопирован в буфер обмена');
      }).catch(() => {
        prompt('Скопируйте текст:', text);
      });
    } catch {
      prompt('Скопируйте текст:', text);
    }
  };

  const s: Record<string, any> = {
    ALL_INTERACTIONS,
    ALL_RISK_SYSTEMS,
    ALL_STACKS,
    ALL_SUBSTANCES,
    BackNav,
    BioStackAIScreen,
    CANONICAL_ID_MAP,
    CATALOG_IDS,
    CATEGORY_LABELS,
    CLASS_BASE_NAMES,
    DEFAULT_DOSAGES,
    EFFECT_LABELS,
    EFFECT_LABELS_ru,
    INTERACTION_ENRICHMENT,
    INTERACTION_SEVERITY_LABELS,
    INTERACTION_TYPE_LABELS,
    InfoErrorBoundary,
    MECH_LABELS,
    MECH_TRANSLATIONS_RU,
    MIX_MECHANISMS,
    MIX_SYNERGY,
    MIX_TEMPLATES,
    ORGAN_CATEGORY_MAP,
    OrganGroupedSubstances,
    PEPTIDE_DB,
    PEPTIDE_LIST,
    PHARMA_DB,
    PHASE_MODS,
    PopupBool,
    PopupNumber,
    PopupSelect,
    RISK_MODEL_LABELS,
    ROUTE_LABELS,
    SUBSTANCE_ANALOGS,
    SUPPLEMENT_DESCRIPTIONS,
    SUPPLEMENT_TARGETS,
    SUPPORT_CATALOG_DATA,
    SUPPORT_CLASS_LABELS,
    SUPPORT_LEVELS,
    SUPPORT_RESEARCH,
    SUPPORT_TIER_GROUPS,
    SYNERGY_COLORS,
    SYRINGE_TYPES,
    SYSTEM_INFO_ALL,
    SYSTEM_LABELS_CATALOG,
    SupportCalcResult,
    SupportCatalogView,
    SupportFavoritesView,
    SupportGeneratorInfo,
    SupportHomeView,
    SupportInteractionsView,
    SupportModals,
    SupportPeptideCalc,
    SupportProtocols,
    SupportResearch,
    SupportStacksView,
    TYPE_LABELS_RU,
    TZ_MECH_LABELS,
    TZ_SYSTEM_ICONS,
    TZ_SYSTEM_LABELS,
    activeSystems,
    addInteraction,
    allSubstanceIds,
    allSupport,
    appliedTemplate,
    archivedPlans,
    autoCalcResult,
    autoLevel,
    availableMechs,
    boostEnabled,
    buildBestRecipe,
    buildPreApplyCard,
    buildShareText,
    calcDone,
    calcExpandedSubs,
    calcRequested,
    calcResult,
    calcSupport,
    copyPlan,
    calcView,
    calculateMixScore,
    calculateSupportTZ,
    cartItems,
    catDetailInteractions,
    catalogOk,
    catalogOrgans,
    catalogSubTab,
    catalogSubstances,
    catalogSupport,
    categoryFilter,
    checkDrugInteractions,
    classifyTier,
    cleanDesc,
    compareKit,
    computeCoverageRisk,
    computeDilution,
    computeEffectiveDose,
    computePK,
    computePharmaAdjustedDose,
    computeRiskByModel,
    conflictLookup,
    courseCompounds,
    courseWeekState,
    customMixDoseMg,
    customMixItems,
    customMixSubstance,
    customRecipeOverrides,
    dbInteractions,
    dbSearchQuery,
    dbSearchResults,
    dbStats,
    decodeGarbled,
    deleteStack,
    doPharmaSearch,
    doSearch,
    editNotesText,
    editingDose,
    editingStackNotes,
    effectiveLevel,
    enhancedSubs,
    evaluateRecommendations,
    exportForDoctor,
    expandedArchiveId,
    expandedCategories,
    expandedMed,
    expandedSection,
    expandedStack,
    favRefresh,
    favSearch,
    favTab,
    fdaError,
    fdaLoading,
    fdaResults,
    filteredStacks,
    filteredSupplements,
    findReplacements,
    findStacksByEffect,
    findSubstance,
    findTypeKey,
    genTab,
    generateMechanismReport,
    generatePeptideProtocol,
    generateWeeklyPlan,
    generatedStack,
    generatedStacks,
    getBpRiskLevel,
    getCategoryInfo,
    getDrugTzMechanisms,
    getLabEffectsForDrug,
    getMarkerName,
    getPhaseLevel,
    getProfile,
    getStackDisplayName,
    getSubstanceName,
    getSupportTzDisplay,
    goBack,
    goHome,
    goalRecommendations,
    groupRecipeItemsByTiming,
    groupedSubstances,
    growthId,
    handleFDASearch,
    handlePubMedSearch,
    handlePubchemSearch,
    hydrateState,
    infoSynergySeverity,
    infoTab,
    infoView,
    injuryHistory,
    interactSearch2,
    interactTab,
    interactTypeFilter,
    interactionIds,
    interactionPage,
    interactionSearch,
    interactionSearchIdx,
    interactionSeverityFilter,
    interactionTypeFilter,
    interpretLabs,
    isComplexId,
    jointMode,
    jointPain,
    labAnalysis,
    linked,
    manualDoses,
    manualFilter,
    manualLevelSelected,
    manualResult,
    manualSearch,
    manualSubs,
    matchComplex,
    matchesCatId,
    mechanismReport,
    mergedInteractions,
    mixDrugGH,
    mixDrugGHTiming,
    mixDrugGLP1,
    mixDrugIGF,
    mixDrugIGFTiming,
    mixDrugMGF,
    mixDrugMGFTiming,
    mixGoals,
    mixHistory,
    mixInsulin,
    mixInsulinTiming,
    mixSavedPlans,
    mixSavedRecipes,
    mixTimeOfDay,
    mixTiming,
    mixWorkoutType,
    modalAddMode,
    modalLevel,
    modalSearch,
    modalSelected,
    modelRiskResult,
    myPlansRefresh,
    neuroAge,
    neuroDoses,
    neuroDuration,
    neuroScore,
    neuroSelected,
    neuroTab,
    normCat,
    notifyDataChange,
    pepAmount,
    pepAmountUnit,
    pepDilution,
    pepDose,
    pepDoseUnit,
    pepProtocol,
    pepResult,
    pepRoute,
    pepSchedule,
    pepSyringe,
    pepTab,
    pepTotalDays,
    peptideId,
    pharmaInteractIds,
    pharmaInteractSearch,
    pharmaSearchQ,
    pharmaSearchResults,
    planResult,
    planSaved,
    planSubTab,
    planView,
    protocolTab,
    pubMedError,
    pubMedLoading,
    pubMedQuery,
    pubMedResults,
    pubchemError,
    pubchemLoading,
    pubchemResults,
    removeInteraction,
    renderView,
    replaceMode,
    replaceResults,
    replaceSearch,
    replaceSelectedSub,
    replaceTargetMech,
    replaceTargetOrgan,
    reportGenerated,
    reproMode,
    neuroMode,
    researchSource,
    resetMain,
    resolveProtoId,
    resolveSubName,
    riskCalcMethod,
    riskModel,
    runSupportForLevel,
    runSupportUnified,
    safeRender,
    saveBuilderStack,
    saveCurrentStack,
    savePlan,
    savedStacks,
    searchCategory,
    searchEffect,
    searchExpanded,
    searchMech,
    searchOrgan,
    searchPubMed,
    searchQuery,
    searchResults,
    searchTier,
    section,
    selectedAnalogs,
    selectedSub,
    setActiveSystems,
    setAppliedTemplate,
    setArchivedPlans,
    setAutoCalcResult,
    setAutoLevel,
    setBoostEnabled,
    setCalcDone,
    setCalcExpandedSubs,
    setCalcRequested,
    setCalcResult,
    setCalcView,
    setCartItems,
    setCatalogOrgans,
    setCatalogSubTab,
    setCategoryFilter,
    setCompareKit,
    setCourseWeekState,
    setCustomMixDoseMg,
    setCustomMixItems,
    setCustomMixSubstance,
    setCustomRecipeOverrides,
    setDbInteractions,
    setDbSearchQuery,
    setDbSearchResults,
    setEditNotesText,
    setEditingDose,
    setEditingStackNotes,
    setEnhancedSubs,
    setExpandedArchiveId,
    setExpandedCategories,
    setExpandedMed,
    setExpandedSection,
    setExpandedStack,
    setFavRefresh,
    setFavSearch,
    setFavTab,
    setFdaError,
    setFdaLoading,
    setFdaResults,
    setGenTab,
    setGeneratedStack,
    setGeneratedStacks,
    setGoalRecommendations,
    setGrowthId,
    setInfoSynergySeverity,
    setInfoTab,
    setInfoView,
    setInjuryHistory,
    setInteractSearch2,
    setInteractTab,
    setInteractTypeFilter,
    setInteractionIds,
    setInteractionPage,
    setInteractionSearch,
    setInteractionSearchIdx,
    setInteractionSeverityFilter,
    setInteractionTypeFilter,
    setJointMode,
    setJointPain,
    setLabAnalysis,
    setManualDoses,
    setManualFilter,
    setManualLevelSelected,
    setManualResult,
    setManualSearch,
    setManualSubs,
    setMechanismReport,
    setMixDrugGH,
    setMixDrugGHTiming,
    setMixDrugGLP1,
    setMixDrugIGF,
    setMixDrugIGFTiming,
    setMixDrugMGF,
    setMixDrugMGFTiming,
    setMixGoals,
    setMixHistory,
    setMixInsulin,
    setMixInsulinTiming,
    setMixSavedPlans,
    setMixSavedRecipes,
    setMixTimeOfDay,
    setMixTiming,
    setMixWorkoutType,
    setModalAddMode,
    setModalLevel,
    setModalSearch,
    setModalSelected,
    setModelRiskResult,
    setMyPlansRefresh,
    setNeuroAge,
    setNeuroDoses,
    setNeuroDuration,
    setNeuroSelected,
    setNeuroTab,
    setPepAmount,
    setPepAmountUnit,
    setPepDilution,
    setPepDose,
    setPepDoseUnit,
    setPepProtocol,
    setPepResult,
    setPepRoute,
    setPepSchedule,
    setPepSyringe,
    setPepTab,
    setPepTotalDays,
    setPeptideId,
    setPharmaInteractIds,
    setPharmaInteractSearch,
    setPharmaSearchQ,
    setPharmaSearchResults,
    setPlanResult,
    setPlanSaved,
    setPlanSubTab,
    setPlanView,
    setProtocolTab,
    setPubMedError,
    setPubMedLoading,
    setPubMedQuery,
    setPubMedResults,
    setPubchemError,
    setPubchemLoading,
    setPubchemResults,
    setReplaceMode,
    setReplaceResults,
    setReplaceSearch,
    setReplaceSelectedSub,
    setReplaceTargetMech,
    setReplaceTargetOrgan,
    setReportGenerated,
    setReproMode,
    setNeuroMode,
    setResearchSource,
    setRiskCalcMethod,
    setRiskModel,
    setSavedStacks,
    setSearchCategory,
    setSearchEffect,
    setSearchExpanded,
    setSearchMech,
    setSearchOrgan,
    setSearchQuery,
    setSearchResults,
    setSearchTier,
    setSection,
    setSelectedAnalogs,
    setSelectedSub,
    setShowCustomPicker,
    setShowManualBuilder,
    setShowModal,
    setShowOrganPopup,
    setShowSavedPicker,
    setShowTemplates,
    setStackBuilder,
    setStackCalcMech,
    setStackCalcMode,
    setStackCalcOrgans,
    setStackCalcSize,
    setStackExpanded,
    setStackName,
    setStackNotes,
    setStkFilterQty,
    setStkFilterScore,
    setStkFilterSystem,
    setSubSearch,
    setSupportClassFilter,
    setSupportDrugs,
    setSupportGoal,
    setSupportLevel,
    setSupportPhase,
    setSupportReportCurrent,
    setSupportReports,
    setSupportResult,
    setSupportTierFilter,
    setSupportView,
    setSynergyCountFilter,
    setSynergyOrganFilter,
    setSynergyPage,
    setSynergySearch,
    setSynergySubTab,
    setSystemFilter,
    setTab,
    setToast,
    setTrainLoad,
    setWeekChangeMsg,
    setWeeklyPlan,
    showCustomPicker,
    showEffect,
    showManualBuilder,
    showModal,
    showOrganPopup,
    showSavedPicker,
    showTemplates,
    showToast,
    stackBuilder,
    stackCalcMech,
    stackCalcMode,
    stackCalcOrgans,
    stackCalcSize,
    stackDetailMap,
    stackExpanded,
    stackName,
    stackNotes,
    stackSystems,
    stateRef,
    stkFilterQty,
    stkFilterScore,
    stkFilterSystem,
    subSearch,
    substanceNameMap,
    supplementList,
    supportClassFilter,
    supportDrugs,
    supportGoal,
    supportInteractions,
    supportLevel,
    supportPhase,
    supportReportCurrent,
    supportReports,
    supportResult,
    supportStack,
    supportSynergies,
    supportTierFilter,
    supportView,
    synergiesContent,
    synergyCountFilter,
    synergyOrganFilter,
    synergyPage,
    synergySearch,
    synergySubTab,
    systemFilter,
    tab,
    toast,
    trainLoad,
    typeGroupedSubstances,
    uniqueCompounds,
    updateInteraction,
    updateProfile,
    weekChangeMsg,
    weeklyPlan,
  };

  return (
    <div className="screen support-screen" style={{ paddingTop: section === 'protocols' ? '40px' : section === 'generator' ? '85px' : (section === 'info' || calcView === 'info' || calcView === 'peptides') ? '120px' : section !== 'home' ? '50px' : '10px', paddingBottom: '0px', overflowY: 'auto' }}>

      {/* ===== GENERATOR SUB-TAB PILLS (with back/home) ===== */}
      {section === 'generator' && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <BackNav />
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['calculator','🧮 Калькулятор'],['dosages','📋 Дозировки'],['complaints','🩺 Жалобы'],['info','📖 О подборе']].map(([id,label]) => (
              <button key={id} onClick={() => { setGenTab(id as any); 
              const a: Record<string,()=>void> = {
                calculator: ()=>{ setTab('calculator'); setSupportView('calc'); },
                dosages: ()=>{ setTab('main'); setSupportView('calc'); },
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
      {(section === 'info' || calcView === 'info' || calcView === 'peptides') && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <BackNav />
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['peptides','Пептиды'],['catalog','Каталог'],['biostack','🧬 BioStack AI'],['interactions','⚠ Взаимодействия'],['research','Исследования'],['favorites','Избранное'],['diary','📓 Дневник'],['bioavailability','🧬 Биодоступность'],['symptoms','🩺 Симптомы']].map(([id,label]) => (
              <button key={id} onClick={() => { setInfoTab(id as any);
                if (id === 'peptides') { setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('peptides'); setInfoTab('peptides'); }
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
      {section === 'home' && tab === 'main' && supportView === 'main' && (
        <SupportHomeView s={s} />
      )}

      {/* ===== SUB-NAVIGATION (REMOVED — content moved to existing tabs) ===== */}

      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'info' && (
        <div style={{ padding:'0 0 70px', display:'flex', flexDirection:'column' }}>
          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
      {renderView(infoView, 'catalog', () =>
        <SupportCatalogView s={s} />
      )}
            {/* synergies merged into interactions tab */}
            {/* ─── ВЗАИМОДЕЙСТВИЯ (единая вкладка: всё + калькулятор) ─── */}
      {renderView(infoView, 'interactions', () =>
        <SupportInteractionsView s={s} />
      )}
      {renderView(infoView, 'stacks', () =>
        <SupportStacksView s={s} />
      )}
      {renderView(infoView, 'favorites', () =>
        <SupportFavoritesView s={s} />
      )}
      {renderView(infoView, 'research', () =>
        <SupportResearch s={s} />
      )}
            {renderView(infoView, 'biostack', () =>
              <div style={{ padding: '0 4px' }}>
                <BioStackAIScreen />
              </div>
            )}
            {renderView(infoView, 'diary', () =>
              <div style={{ padding: '0 4px' }}>
                <SupportDiaryView s={s} />
              </div>
            )}
            {renderView(infoView, 'bioavailability', () =>
              <div style={{ padding: '0 4px' }}>
                <SupportBioavailability s={s} />
              </div>
            )}
            {renderView(infoView, 'symptoms', () =>
              <div style={{ padding: '0 4px' }}>
                <SymptomSolverTab s={s} />
              </div>
            )}

          </div>
        </div>
      )}

      {/* ===== INFO: КАК РАБОТАЕТ ПОДБОР ПОДДЕРЖКИ ===== */}
      {/* ===== GENERATOR INFO ===== */}
      {genTab === 'info' && section === 'generator' && (
        <SupportGeneratorInfo s={s} />
      )}

      {/* ===== PROTOCOLS ===== */}
      {section === 'protocols' && (
        <SupportProtocols s={s} />
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
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
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


      {/* ===== AUTO CALCULATOR (input card with import-from-labs button) ===== */}
      {section === 'generator' && genTab === 'calculator' && ((tab === 'main' && supportView === 'calc' && calcView === 'calculator') || tab === 'calculator') && (
        <AutoCalculator
          embedded
          courseWeek={courseWeekState}
          courseLinked={linked.course as any}
          onApply={(r) => {
            setAutoCalcResult(r);
            calcSupport(r.level as PowerLevel, r.subs);
          }}
        />
      )}

      {/* ===== SUPPORT CALCULATOR RESULT ===== */}
      {section === 'generator' && genTab === 'calculator' && ((tab === 'main' && supportView === 'calc' && calcView === 'calculator') || tab === 'calculator') && (
        <SupportCalcResult s={s} />
      )}

      {/* ===== DOSAGE DATABASE VIEW ===== */}
      {section === 'generator' && genTab === 'dosages' && (
        <DosageDatabaseView />
      )}

      {/* ===== COMPLAINTS TAB ===== */}
      {genTab === 'complaints' && (
        <div style={{ paddingTop: 80, paddingLeft: 8, paddingRight: 8 }}>
          <ComplaintsTab
            onOpenSolver={() => {
              setGenTab('calculator' as any);
              setTab('calculator');
              setSupportView('calc');
              setInfoView('symptoms' as any);
            }}
          />
        </div>
      )}

      {/* ===== PEPTIDE CALCULATOR ===== */}
      {section === 'info' && tab === 'main' && supportView === 'calc' && calcView === 'peptides' && (
        <SupportPeptideCalc s={s} />
      )}

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
