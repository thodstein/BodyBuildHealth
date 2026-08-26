import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { LabDiaryTab } from './LabsScreen_parts/LabDiaryTab';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { interpretLabs, computeHOMA_IR, type LabCompositeResult } from '../../engines/lab-analysis.engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { getDrugsToNormalizeMarker, getMarkerName } from '../../data/support-lab-effects';
import { PHARMA_DB } from '../../core/pharma-database';
import { LabsScoreCard } from '../components/LabsScoreCard';
import { LABS_ACCENT, LABS_CARD } from './LabsScreen_parts/LabsUI';
// import { LabsTzRiskTab } from './LabsScreen_parts/LabsTzRiskTab'; // удалено — T4 маркеры интегрированы в фазы
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { calculateTzSpecRisk, type TzSpecResult, type TzSpecOrganResult } from '../../engines/risk-engine-tz-spec';
import { db } from '../../core/db';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsOverview } from './LabsScreen_parts/LabsOverview';
import LabsCatalogTab from './LabsScreen_parts/LabsCatalogTab';
import LabsProblemPanelsTab from './LabsScreen_parts/LabsProblemPanelsTab';
import { processUploadedFile, saveParsedLabs, type ParsedLabValue, type OCRResult } from '../../core/ocr-engine';
import { getProfile, updateProfile } from '../../core/profile-manager';
import { PopupNumber, PopupBool, PopupSelect } from '../components/PopupXxx';
import { normalizedRatio } from '../../core/labs-mapping';
import { computeLabTrends, getTrendColor, getTrendIcon, getTrendInsights, exportTrendsToCSV, downloadCSV, type LabTrend } from '../../engines/lab-trend.engine';
import { getCorrectionIds, getMarkerMap } from '../../data/lab-marker-map';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { RiskVerificationList } from './RiskScreen_parts/RiskVerificationList';

const NO_LABS_KEY = 'he_force_no_labs';
const NO_LABS_SYSTEMS_KEY = 'he_no_labs_systems';

export function getGlobalNoLabs(): boolean {
  try { return localStorage.getItem(NO_LABS_KEY) === 'true'; } catch { return false; }
}
export function setGlobalNoLabs(v: boolean) {
  try { localStorage.setItem(NO_LABS_KEY, String(v)); } catch {}
}
export function getNoLabsSystems(): string[] {
  try { return JSON.parse(localStorage.getItem(NO_LABS_SYSTEMS_KEY) || '[]'); } catch { return []; }
}
export function setNoLabsSystems(systems: string[]) {
  try { localStorage.setItem(NO_LABS_SYSTEMS_KEY, JSON.stringify(systems)); } catch {}
}

const PHASE_LABELS: Record<string, string> = {
  baseline: 'Базовый',
  on_cycle: 'На курсе',
  bridge: 'Мост',
  pct: 'ПКТ',
  post_pct: 'После ПКТ',
};

const PROFILE_PHASE_TO_LABS_PHASE: Record<string, string> = {
  baseline: 'baseline',
  course: 'on_cycle',
  bridge: 'bridge',
  pct: 'pct',
  post_pct: 'post_pct',
  fertility: 'post_pct',
};

const sysLabels: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кровь',
  reproductive: 'Репродуктивная', musculoskeletal: 'Мышечная', metabolic: 'Метаболизм',
  urinalysis: 'Моча',
  other: 'Прочее',
};

const LAB_SYSTEM_GROUPS: Record<string, string[]> = {
  hepatic: ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB','LDH','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT'],
  renal: ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR','K','NA','CA','P','MG'],
  endocrine: ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1','TOTAL_T3','TOTAL_T4','TG_AB','TPO_AB','THYROGLOBULIN'],
  hematologic: ['HGB','HCT','PLT','WBC','RBC','MCV','MCH','MCHC','RDW','IRON','TRANSFERRIN','TIBC','IRON_SAT','FERRITIN'],
  cardio: ['LDL','HDL','TG','APOB','APOA1','NON_HDL','LP_A','CRP','hsCRP','FIBRINOGEN','D_DIMER'],
  metabolic: ['GLUCOSE','GLU','HBA1C','INSULIN','HOMA_IR','VITD','VITAMIN_D','CALCIDIOL','B12','VITAMIN_B12','FOLATE'],
  urinalysis: ['URINE_SG','URINE_PH','URINE_PROTEIN_QR','URINE_GLUCOSE_QR','URINE_KETONES_QR','URINE_BILIRUBIN_QR','UROBILINOGEN_QR','URINE_NITRITE_QR','URINE_LEU_QR','URINE_BLOOD_QR','URINE_LEU','URINE_ERY','URINE_EPITHELIAL','URINE_CYLINDERS'],
  reproductive: ['PSA','DHEA_S','AMH','INHIBIN_B','PROGESTERONE','DHT','FT','TESTOSTERONE','ESTRADIOL'],
  neuro: ['HOMOCYSTEINE','BDNF','SEROTONIN','DOPAMINE','GABA','VITAMIN_B12','FOLATE'],
};

function getSystemForCode(code: string): string | undefined {
  const upper = code.toUpperCase();
  for (const [sys, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
    if (codes.includes(upper)) return sys;
  }
  const markerInfo = getMarkerMap(upper);
  if (markerInfo?.system) return markerInfo.system;
  return undefined;
}

const CATALOG_LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': 'Аланинаминотрансфераза. Ключевой маркёр повреждения печени. Повышается при гепатотоксичности ААС.',
  'AST': 'Аспартатаминотрансфераза. Маркёр повреждения печени и мышц. Соотношение AST/ALT — дифференциальная диагностика.',
  'HCT': 'Гематокрит. Объёмная доля эритроцитов. Повышается на ААС — риск тромбоза при >52%.',
  'HGB': 'Гемоглобин. Транспорт кислорода. Повышается на эритропоэтиках и ААС.',
  'PLT': 'Тромбоциты. Участвуют в свёртывании. Снижаются при некоторых ААС и антикоагулянтах.',
  'WBC': 'Лейкоциты. Показатель иммунного статуса и воспаления.',
  'TT': 'Общий тестостерон. Сумма свободного и связанного с SHBG и альбумином тестостерона.',
  'E2': 'Эстрадиол. Основной эстроген. Ароматизируется из тестостерона. Контролировать на курсе.',
  'PRL': 'Пролактин. Может расти на нандролоне, тренболоне и некоторых ААС.',
  'LH': 'Лютеинизирующий гормон. Стимулирует выработку тестостерона в тестикулах. Подавлен на курсе.',
  'FSH': 'Фолликулостимулирующий гормон. Стимулирует сперматогенез. Подавлен на курсе.',
  'SHBG': 'Глобулин, связывающий половые гормоны. Снижается на оральных ААС, повышается при гипертиреозе.',
  'CRP': 'С-реактивный белок. Неспецифический маркёр воспаления. Высокий — фактор сердечно-сосудистого риска.',
  'HBA1C': 'Гликированный гемоглобин. Средний уровень глюкозы за 3 месяца. Скрининг диабета.',
  'LDL': 'Липопротеины низкой плотности. «Плохой» холестерин. Растёт на многих ААС и ГХСБ.',
  'HDL': 'Липопротеины высокой плотности. «Хороший» холестерин. Падает на оральных ААС и некоторых инъекционных.',
  'TG': 'Триглицериды. Растут на ААС, особенно при потреблении простых углеводов.',
  'GLU': 'Глюкоза крови натощак. Скрининг инсулинорезистентности и диабета.',
  'INS': 'Инсулин. Повышен при инсулинорезистентности. Гормон роста и набора массы.',
  'HOMA': 'HOMA-IR. Инсулин × Глюкоза / 22.5. >2.7 — инсулинорезистентность.',
  'CREATININE': 'Креатинин. Продукт распада креатина. Маркёр функции почек.',
  'CORTISOL': 'Кортизол. Гормон стресса. Подавляется некоторыми ААС и ГХСБ.',
  'IGF1': 'Инсулиноподобный фактор роста-1. Опосредует эффекты ГР. Маркёр анаболического статуса.',
  'TSH': 'Тиреотропный гормон. Регулирует функцию щитовидной железы.',
  'FT3': 'Свободный трийодтиронин. Активная форма гормона щитовидной железы.',
  'FT4': 'Свободный тироксин. Предшественник T3. Контроль функции щитовидной железы.',
  'FERRITIN': 'Ферритин. Депозит железа в организме. Повышен при воспалении, гемохроматозе, на курсе.',
  'VITD': '25(OH) витамин D. Влияет на иммунитет, экспрессию генов, уровень тестостерона, здоровье костей.',
  'ALP': 'Щелочная фосфатаза. Маркёр холестаза и костного обмена.',
  'BIL': 'Билирубин общий. Продукт распада гема. Маркёр функции печени и гемолиза.',
  'ALB': 'Альбумин. Белок плазмы, отражает нутритивный статус и функцию печени.',
  'TP': 'Общий белок плазмы. Отражает нутритивный статус и функцию печени.',
  'EGFR': 'Расчётная скорость клубочковой фильтрации. Ключевой маркёр функции почек.',
  'UA': 'Мочевая кислота. Пуриновый обмен. Повышается на ААС — риск подагры.',
  'DHEA_S': 'ДГЭА-С. Надпочечниковый андроген. Предшественник тестостерона.',
  'AMH': 'Антимюллеров гормон. Маркёр овариального резерва и функции тестикул.',
  'PSA': 'Простатический специфический антиген. Скрининг патологии простаты.',
  'K': 'Калий. Основной внутриклеточный катион. Контроль электролитов на курсе.',
  'NA': 'Натрий. Основной внеклеточный катион. Регуляция водного баланса.',
  'CA': 'Кальций. Минерал для костей и мышечного сокращения.',
  'P': 'Фосфор. Участвует в энергетическом обмене и костной ткани.',
  'MG': 'Магний. Кофактор многих ферментов. Влияет на сон и восстановление.',
  'B12': 'Витамин B12. Кобаламин. Участвует в кроветворении и работе нервной системы.',
  'FOL': 'Фолат. Витамин B9. Участвует в синтезе ДНК и гомоцистеиновом обмене.',
  'TIBC': 'Общая железосвязывающая способность. Маркёр метаболизма железа.',
  'D_DIMER': 'D-димер. Продукт распада фибрина. Маркёр тромбообразования.',
  'FIBRINOGEN': 'Фибриноген. Фактор свёртывания. Повышается при воспалении.',
  'TROPONIN': 'Тропонин. Маркёр повреждения миокарда. Высокая специфичность.',
  'BNP': 'Натрийуретический пептид. Маркёр сердечной недостаточности.',
};

const MAIN_LAB_TABS: { id: MainLabTab; label: string; icon: string }[] = [
  { id: 'lab', label: 'Анализы', icon: '🔬' },
  { id: 'risks', label: 'Риски и индексы', icon: '⚠️' },
];

type MainLabTab = 'hero' | 'lab' | 'risks';

const LAB_SUB_TABS: { id: LabSubTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: '📊' },
  { id: 'current', label: 'Текущие', icon: '🔬' },
  { id: 'catalog', label: 'Каталог', icon: '📖' },
  { id: 'journal', label: 'Дневник и архив', icon: '📓' },
  { id: 'trends', label: 'Тренды', icon: '📈' },
];

type LabSubTab = 'hero' | 'overview' | 'current' | 'catalog' | 'journal' | 'trends';

export const LabsScreen: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const linked = useDataLink();
  const profilePhase = (linked.profile?.settings as any)?.pharma?.phase || '';
  const initialLabsPhase = PROFILE_PHASE_TO_LABS_PHASE[profilePhase] || 'baseline';
  const profileAge = (linked.profile?.settings as any)?.personal?.age || 30;
  const profileSex = (linked.profile?.settings as any)?.personal?.sex || 'male';
  const [mainTab, setMainTab] = useState<MainLabTab>('hero');
  const [subTab, setSubTab] = useState<LabSubTab>('current');
  const [globalNoLabs, setGlobalNoLabs] = useState(getGlobalNoLabs());
  const [noLabsSystems, setNoLabsSystemsState] = useState<string[]>(getNoLabsSystems());
  const [selectedPhase, setSelectedPhase] = useState(initialLabsPhase);
  const [showLabInput, setShowLabInput] = useState(false);
  const [showNewLabsInline, setShowNewLabsInline] = useState(false);
  const [batchValues, setBatchValues] = useState<Record<string, string>>({});
  const [inputCode, setInputCode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [tick, setTick] = useState(0);
  const [catalogView, setCatalogView] = useState<'catalog' | 'schedule' | 'problems'>('catalog');
  const [journalSubView, setJournalSubView] = useState<'diary' | 'reports' | 'archive'>('diary');
  const [trendFilter, setTrendFilter] = useState<'all' | 'significant' | 'critical' | 'worsened' | 'improved'>('all');
  const [trendSystemFilter, setTrendSystemFilter] = useState('all');
  const [visibleTrends, setVisibleTrends] = useState<Set<string>>(new Set());
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<{ code: string; date: string; value: number; x: number; y: number } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const ocrRequestRef = useRef(0);
  const cancelOcr = useCallback(() => {
    ocrRequestRef.current += 1;
    setOcrLoading(false);
    setOcrResult(null);
    setSelectedLabs(new Set());
    setShowImport(false);
  }, []);
  // Backdrop click should NOT cancel an in-flight OCR: on mobile, a "ghost click"
  // can fire on the backdrop after the native file picker closes, which would
  // invalidate the request via cancelOcr and leave the user with no result.
  const backdropClick = useCallback(() => {
    if (ocrLoading) return;
    cancelOcr();
  }, [ocrLoading, cancelOcr]);
  const [chartMarkerSearch, setChartMarkerSearch] = useState('');
  const [chartSelectedCodes, setChartSelectedCodes] = useState<Set<string>>(new Set());
  const [chartFilterSys, setChartFilterSys] = useState('all');
  const [chartGridOpen, setChartGridOpen] = useState(true);
  const [riskSections, setRiskSections] = useState<Record<string, boolean>>({
    pharma: true, indices: true, systems: true, markers: true, tz: true, requiredLabs: false, normalizeDrugs: false,
  });
  const [risksView, setRisksView] = useState<'risks' | 'verification'>('risks');
  const [addError, setAddError] = useState('');
  const [labReportGenerated, setLabReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_labs_report_current')) setLabReportGenerated(true); } catch {} }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem('he_nav_to_lab_diary') === '1') {
        localStorage.removeItem('he_nav_to_lab_diary');
        setMainTab('lab');
        setSubTab('journal'); setJournalSubView('diary');
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (initialSubTab === 'diary') {
      setMainTab('lab'); setSubTab('journal'); setJournalSubView('diary');
    } else if (initialSubTab === 'reports') {
      setMainTab('lab'); setSubTab('journal'); setJournalSubView('reports');
    }
  }, [initialSubTab]);
  const [selectedArchivedLabReport, setSelectedArchivedLabReport] = useState<any>(null);
  const [labArchive, setLabArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_lab_reports') || '[]'); } catch { return []; }
  });

  const [fertSperm, setFertSperm] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('he_fert_sperm_' + selectedPhase) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem('he_fert_sperm_' + selectedPhase);
      if (saved) setFertSperm(JSON.parse(saved));
    } catch {}
  }, [selectedPhase]);
  const updateFert = useCallback((key: string, value: string) => {
    setFertSperm(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('he_fert_sperm_' + selectedPhase, JSON.stringify(next));
      return next;
    });
  }, [selectedPhase]);
  const updateFertBool = useCallback((key: string, value: boolean) => {
    setFertSperm(prev => {
      const next = { ...prev, [key]: value ? '1' : '0' };
      localStorage.setItem('he_fert_sperm_' + selectedPhase, JSON.stringify(next));
      return next;
    });
  }, [selectedPhase]);

  const uid = () => { try { return crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`; } catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; } };

  const labs: LabPoint[] = linked.labs || [];
  const currentLabs = useMemo(() => labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase)), [labs, selectedPhase]);
  const archiveLabs = useMemo(() => labs.filter(l => l.archived || (l.phase && l.phase !== selectedPhase)), [labs, selectedPhase]);
  const hasLabs = currentLabs && currentLabs.length > 0;

  const handlePhaseChange = (phase: string) => {
    setSelectedPhase(phase);
    try {
      const p = getProfile();
      (p.settings as any).pharma.phase = phase === 'on_cycle' ? 'course' : phase;
      updateProfile(p);
      notifyDataChange();
    } catch {}
  };

  const requiredLabs = useMemo(() => {
    return (REQUIRED_LABS_PER_PHASE as Record<string, string[]>)[selectedPhase] || [];
  }, [selectedPhase]);

  const handleNewLabs = useCallback(async () => {
    // Archive all current-phase labs, then show empty batch form
    const toArchive = labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase));
    try {
      await db.init();
      for (const lab of toArchive) {
        await db.put('labs_log', { ...lab, archived: true });
      }
      if (toArchive.length > 0) notifyDataChange();
    } catch (e) { console.error(e); }
    const empty: Record<string, string> = {};
    for (const code of requiredLabs) { empty[code] = ''; }
    setBatchValues(empty);
    setShowNewLabsInline(true);
  }, [requiredLabs, labs, selectedPhase, setBatchValues, setShowNewLabsInline]);

  const handleBatchSave = useCallback(async () => {
    try {
      await db.init();
      let saved = 0;
      for (const [code, valStr] of Object.entries(batchValues)) {
        const val = parseFloat(valStr);
        if (!valStr || isNaN(val)) continue;
        const info = UCUM_MAP[code.toUpperCase()];
        const lab: LabPoint = {
          id: uid(),
          code: code.toUpperCase(),
          name: info?.name || code,
          value: val,
          unit: info?.prefUnit || '',
          date: new Date().toISOString().split('T')[0],
          phase: selectedPhase,
        };
        await db.put('labs_log', lab);
        saved++;
      }
      if (saved > 0) notifyDataChange();
      setShowNewLabsInline(false);
      setBatchValues({});
      setTick(t => t + 1);
    } catch (e) { console.error(e); }
  }, [batchValues, selectedPhase]);

  const labsBySystem = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const code of requiredLabs) {
      let found = false;
      for (const [sys, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
        if (codes.includes(code.toUpperCase())) {
          if (!groups[sys]) groups[sys] = [];
          groups[sys].push(code);
          found = true;
          break;
        }
      }
      if (!found) {
        if (!groups['other']) groups['other'] = [];
        groups['other'].push(code);
      }
    }
    return groups;
  }, [requiredLabs]);

  const submittedCodes = useMemo(() => {
    return new Set(currentLabs.map(l => l.code.toUpperCase()));
  }, [currentLabs]);

  const missingLabs = useMemo(() => {
    return requiredLabs.filter(code => !submittedCodes.has(code.toUpperCase()));
  }, [requiredLabs, submittedCodes]);

  const submittedCount = requiredLabs.length - missingLabs.length;
  const completionPct = requiredLabs.length > 0 ? Math.round(submittedCount / requiredLabs.length * 100) : 0;

  const uniqMarkers = useMemo(() => {
    const seen = new Set<string>();
    return labs.filter(l => { const k = l.code.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(l => ({ code: l.code.toUpperCase(), name: UCUM_MAP[l.code.toUpperCase()]?.name || l.name || l.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [labs]);

  const chartData = useMemo(() => {
    if (chartSelectedCodes.size === 0) return [];
    const codes = Array.from(chartSelectedCodes).map(c => c.toUpperCase());
    return labs.filter(l => codes.includes(l.code.toUpperCase()))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [labs, chartSelectedCodes]);

  const penalty = useMemo(() => {
    return calculatePenaltyCoefficients(selectedPhase, currentLabs, [], 1, linked.course, globalNoLabs);
  }, [selectedPhase, currentLabs, linked.course, globalNoLabs]);

  const trendAlertList = useMemo(() => {
    const report = computeLabTrends(labs);
    return report.worsened
      .filter(t => t.significance === 'critical' || t.significance === 'significant')
      .map(t => ({
        code: t.code,
        name: t.name,
        significance: t.significance,
        direction: t.direction,
      }));
  }, [labs]);

  const labRisks = useMemo<{ overallNet: number; systemBreakdown: Record<string, { raw: number; net: number }>; markerDeviations: { code: string; name: string; value: number; uln: number; lln: number; deviation: number; system: string }[] } | null>(() => {
    if (!hasLabs) return null;
    const labData = currentLabs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    const contribs = calculateRiskFromAnalyses(labData) as any;
    const systemBreakdown: Record<string, { raw: number; net: number }> = {};
    let maxNet = 0;
    for (const sys of ALL_RISK_SYSTEMS) {
      const c = contribs.systemContributions?.[sys] || 0;
      systemBreakdown[sys] = { raw: c, net: c };
      if (c > maxNet) maxNet = c;
    }
    const nonZero = Object.values(systemBreakdown).filter(v => v.net > 0);
    const overallNet = nonZero.length > 0
      ? Math.round(nonZero.reduce((s, v) => s + v.net, 0) / nonZero.length)
      : 0;
    const markerDeviations: { code: string; name: string; value: number; uln: number; lln: number; deviation: number; system: string }[] = [];
    for (const lab of currentLabs) {
      const ref = UCUM_MAP[lab.code] || UCUM_MAP[lab.code.toUpperCase()];
      if (!ref) continue;
      const coeff = ref.coeff || 1;
      const norm = lab.value * coeff;
      // Prefer stored reference ranges from parsed lab forms;
      // fall back to UCUM_MAP defaults when not available.
      const uln = lab.refHigh !== undefined ? lab.refHigh * coeff : ref.uln;
      const lln = lab.refLow !== undefined ? lab.refLow * coeff : ref.lln;
      let deviation = 0;
      if (norm > uln) deviation = (norm - uln) / uln;
      else if (norm < lln) deviation = -((lln - norm) / lln);
      if (Math.abs(deviation) > 0.01) {
        let sys = 'other';
        for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
          if (codes.includes(lab.code.toUpperCase())) { sys = s; break; }
        }
        markerDeviations.push({
          code: lab.code, name: ref.name || lab.code, value: lab.value,
          uln, lln,
          deviation: Math.round(deviation * 100),
          system: sys,
        });
      }
    }
    markerDeviations.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    return { overallNet, systemBreakdown, markerDeviations };
  }, [hasLabs, labs]);

  const labIndexDetails = useMemo(() => {
    if (!hasLabs) return {} as Record<string, LabIndexDetail>;
    return computeLabIndexDetails(currentLabs);
  }, [hasLabs, currentLabs]);

  const labAnalysisResult = useMemo(() => {
    if (!hasLabs) return null;
    return interpretLabs(currentLabs);
  }, [hasLabs, currentLabs]);

  const labPharmaAlerts = useMemo(() => {
    if (!hasLabs || linked.course.length === 0) return [];
    return analyzeLabDrugCorrelation(currentLabs, linked.course, (linked.profile?.settings as any)?.pharma?.phase || 'on_cycle');
  }, [hasLabs, currentLabs, linked.course]);

  // ── Механизм-ориентированная модель (ТЗ) — данные из фазы ──
  // лаб. значения: code → number (единый источник для движка и вкладки верификации,
  // чтобы «верифицировано анализами» в карточке и во вкладке считались от ОДНОГО набора)
  const tzLabValues = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const l of currentLabs) {
      const c = l.code?.toUpperCase();
      if (c && typeof l.value === 'number' && isFinite(l.value)) m[c] = l.value;
    }
    // алиасы для движка
    if (m['EGFR'] !== undefined) m['eGFR'] = m['EGFR'];
    if (m['CREATININE'] !== undefined) m['CREAT'] = m['CREATININE'];
    if (m['BILIRUBIN'] !== undefined) m['BIL'] = m['BILIRUBIN'];
    return m;
  }, [currentLabs]);

  const tzSpecResult = useMemo<TzSpecResult | null>(() => {
    if (!hasLabs) return null;
    const m = tzLabValues;
    // покрытие T4
    const t4 = ['LDL','HDL','TG','HCT','HGB','ALT','AST','GGT','ALP','BIL','BILIRUBIN','EGFR','UACR','K','NA','GLU','HBA1C','LH','FSH','TT','E2','PRL'];
    const p = t4.filter(c => m[c] !== undefined || m[c.toUpperCase()] !== undefined).length;
    const cov = t4.length > 0 ? p / t4.length : 0.1;
    // курс
    const course = linked.course || [];
    const fd = course[0];
    let dc: 'aas'|'gh'|'insulin' = 'aas';
    if (fd) {
      const s = (fd.substanceId||'').toLowerCase();
      if (s.includes('gh')||s.includes('somatr')||s.includes('hgh')) dc = 'gh';
      else if (s.includes('insulin')||s.includes('ins_')) dc = 'insulin';
    }
    const totalDose = course.length ? course.reduce((s:number,c:any)=>s+(typeof c.doseValue==='number'?c.doseValue:parseFloat(c.doseValue)||0)*(typeof c.frequency==='number'?c.frequency:parseFloat(String(c.frequency))||7),0) : 500;
    const dur = course.length ? Math.max(4,...course.map((c:any)=>Math.max(0,(c.endWeek??12)-(c.startWeek??0))+1)) : 12;
    const oral = course.some((c:any)=>{const s=(c.substanceId||'').toLowerCase();return s.includes('oral')||s.includes('oxy')||s.includes('dbol')||s.includes('anadrol')||s.includes('winstrol')||s.includes('stanozo')||s.includes('turinabol');});
    let sup: string[] = [];
    try { const sr = JSON.parse(localStorage.getItem('he_support_risk')||'null'); if(sr?.subs) sup = sr.subs.map((id:string)=>id.toLowerCase()); } catch {}
    return calculateTzSpecRisk({ drugClass:dc, drugName:fd?.substanceId||'custom', dose:Math.max(50,Math.round(totalDose)), duration:dur, form:oral?'oral':'inject', combinations:Math.max(1,course.length), labCoverage:cov, labValues:m, supportSubstances:sup });
  }, [hasLabs, tzLabValues, linked.course]);

  const toggleGlobalNoLabs = useCallback(() => {
    const next = !globalNoLabs;
    setGlobalNoLabs(next);
    if (next) setNoLabsSystemsState([]);
    notifyDataChange();
    setTick(t => t + 1);
  }, [globalNoLabs]);

  const toggleSystemNoLabs = useCallback((sys: string) => {
    let next = [...noLabsSystems];
    if (next.includes(sys)) next = next.filter(s => s !== sys);
    else next.push(sys);
    setNoLabsSystems(next);
    setNoLabsSystemsState(next);
    if (next.length >= RISK_SYSTEMS.length) {
      setGlobalNoLabs(true);
      next = [];
      setNoLabsSystems(next);
      setNoLabsSystemsState(next);
    }
    notifyDataChange();
    setTick(t => t + 1);
  }, [noLabsSystems]);

  const addLab = useCallback(async () => {
    const val = parseFloat(inputValue);
    if (!inputCode || isNaN(val)) { setAddError('Введите код и значение'); return; }
    const info = UCUM_MAP[inputCode.toUpperCase()];
    const lab: LabPoint = {
      id: uid(),
      code: inputCode.toUpperCase(),
      name: info?.name || inputCode,
      value: val,
      unit: inputUnit || info?.prefUnit || '',
      date: inputDate,
      phase: selectedPhase,
    };
    try {
      await db.init();
      await db.put('labs_log', lab);
      notifyDataChange();
      setInputCode('');
      setInputValue('');
      setInputUnit('');
      setShowLabInput(false);
      setAddError('');
      setTick(t => t + 1);
    } catch (e) { setAddError('Ошибка сохранения: ' + (e instanceof Error ? e.message : String(e))); console.error(e); }
  }, [inputCode, inputValue, inputUnit, inputDate, selectedPhase]);

  const handleFileUpload = useCallback(async (file: File) => {
    const requestId = ++ocrRequestRef.current;
    setOcrLoading(true);
    setOcrResult(null);
    setSelectedLabs(new Set());
    try {
      const result = await processUploadedFile(file);
      if (requestId !== ocrRequestRef.current) return;
      setOcrResult(result);
      if (result.labs.length > 0) setSelectedLabs(new Set(result.labs.map(l => l.code)));
    } catch (e: any) {
      if (requestId !== ocrRequestRef.current) return;
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['' + (e?.message || String(e))] });
    }
    if (requestId === ocrRequestRef.current) setOcrLoading(false);
  }, []);

  const confirmOcrLabs = useCallback(async () => {
    if (!ocrResult) return;
    const labsToSave = ocrResult.labs.filter(l => selectedLabs.has(l.code));
    if (labsToSave.length === 0) return;
    const saved = await saveParsedLabs(labsToSave, selectedPhase);
    if (saved > 0) { notifyDataChange(); setTick(t => t + 1); }
    setShowImport(false);
    setOcrResult(null);
    setSelectedLabs(new Set());
  }, [ocrResult, selectedLabs, selectedPhase]);

  const toggleLabSelection = useCallback((code: string) => {
    setSelectedLabs(prev => { const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next; });
  }, []);

  const anyNoLabs = globalNoLabs || noLabsSystems.length > 0;
  const deviationCount = labRisks?.markerDeviations?.length ?? 0;

  const sysColors: Record<string, string> = {
    hepatic: '#22c55e', renal: '#3b82f6', endocrine: '#a855f7',
    hematologic: '#ef4444', cardio: '#f97316', metabolic: '#eab308',
    reproductive: '#ec4899', neuro: '#14b8a6', other: '#6b7280',
  };

  return (
    <div className="screen labs" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>

      {/* ─── HERO PAGE — glass + KPI, фикс перекрытия ─── */}
      {mainTab === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column', overflowY:'auto', WebkitOverflowScrolling:'touch', background:'#070a12' }}>
          <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
            <img src="/lab-hero.png" alt="" onError={e=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:0.92 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(7,10,18,0.22) 0%, rgba(7,10,18,0.58) 42%, rgba(7,10,18,0.94) 78%, #070a12 100%)' }} />
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(560px 380px at 18% 14%, rgba(0,230,138,0.16), transparent 68%), radial-gradient(600px 420px at 92% 88%, rgba(59,130,246,0.11), transparent 65%)' }} />
          </div>
          <div style={{ position:'relative', zIndex:1, flex:'0 0 auto', display:'flex', flexDirection:'column', justifyContent:'flex-start', padding:'26px 16px calc(18px + 72px + env(safe-area-inset-bottom,0px))', maxWidth:560, margin:'0 auto', width:'100%', boxSizing:'border-box', minHeight:'100dvh' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ padding:'4px 9px', borderRadius:999, background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.24)', color:LABS_ACCENT, fontSize:9, fontWeight:800, letterSpacing:0.6 }}>LABS • HEALTH OS</span>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>{hasLabs ? `${currentLabs.length} маркеров • ${PHASE_LABELS[selectedPhase]}` : 'Нет данных — начните с ввода'}</span>
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, color:'#fff', margin:'0 0 6px', letterSpacing:-0.6, lineHeight:1, textShadow:'0 6px 24px rgba(0,0,0,0.45)' }}>Лаборатория</h1>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.78)', margin:'0 0 12px', lineHeight:1.45, maxWidth:440 }}>
              Механизм-ориентированная модель ТЗ, тренды и обследования — без потери логики, с премиальной визуализацией.
            </p>
            {hasLabs && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                <div style={{ ...LABS_CARD, padding:'10px 8px', textAlign:'center', background:'rgba(20,22,30,0.52)', backdropFilter:'blur(10px)' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:700 }}>Покрытие фазы</div>
                  <div style={{ fontSize:20, fontWeight:900, color: completionPct===100?LABS_ACCENT: completionPct>50?'#eab308':'#ef4444', lineHeight:1, marginTop:4 }}>{completionPct}%</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:2 }}>{submittedCount}/{requiredLabs.length} сдано</div>
                  <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden', marginTop:8 }}><div style={{ width:`${completionPct}%`, height:'100%', background: completionPct===100?LABS_ACCENT:'#eab308', transition:'width 0.5s' }} /></div>
                </div>
                <div style={{ ...LABS_CARD, padding:'10px 8px', textAlign:'center', background:'rgba(20,22,30,0.52)', backdropFilter:'blur(10px)' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:700 }}>Отклонений</div>
                  <div style={{ fontSize:20, fontWeight:900, color: deviationCount? '#ef4444':'#22c55e', lineHeight:1, marginTop:4 }}>{deviationCount}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:2 }}>{deviationCount? 'требуют внимания' : 'все в норме'}</div>
                  <div style={{ fontSize:8, marginTop:8, padding:'3px 6px', borderRadius:999, background: deviationCount?'rgba(239,68,68,0.12)':'rgba(34,197,94,0.12)', color: deviationCount?'#ef4444':'#22c55e', border:`1px solid ${deviationCount?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)'}`, display:'inline-block' }}>{deviationCount? '⚠ проверить':'✓ стабильно'}</div>
                </div>
                <div style={{ ...LABS_CARD, padding:'10px 8px', textAlign:'center', background:'rgba(20,22,30,0.52)', backdropFilter:'blur(10px)' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:700 }}>Тренд-сигналы</div>
                  <div style={{ fontSize:20, fontWeight:900, color: trendAlertList.length?'#f97316':'#94a3b8', lineHeight:1, marginTop:4 }}>{trendAlertList.length}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:2 }}>{trendAlertList.length? 'критических' : 'без сигналов'}</div>
                  <div style={{ fontSize:8, marginTop:8, color:'rgba(255,255,255,0.35)' }}>{labs.length} всего • {new Set(labs.map(l=>l.code)).size} уник.</div>
                </div>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { id: 'lab', icon: '🔬', title: 'Анализы', badge: `${hasLabs? submittedCount + '/' + requiredLabs.length : 'старт'}`, desc: 'Ввод, каталог, динамика, дневник и графики. Единый ввод по фазе, импорт PDF/фото.', color: LABS_ACCENT, accentBg:'rgba(0,230,138,0.14)', hint:'→ открыть' },
                { id: 'risks', icon: '⚠️', title: 'Риски и индексы', badge: labRisks ? `${labRisks.overallNet}%` : '—', desc: 'ASI/HMI/CR, риски по системам, механизм-модель ТЗ и верификация.', color: '#f97316', accentBg:'rgba(249,115,22,0.12)', hint:'→ оценить' },
              ].map(card => (
                <button key={card.id} onClick={() => setMainTab(card.id as MainLabTab)} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 14px', borderRadius:18, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'rgba(20,22,30,0.48)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff',
                  backdropFilter:'blur(14px)', boxShadow:'0 12px 30px rgba(0,0,0,0.22)', transition:'transform 0.18s, border-color 0.18s', transform:'translateZ(0)',
                }} onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor = card.color+'55'; (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'; }} onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)'; }}>
                  <div style={{ width:46, height:46, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: card.accentBg, border:`1px solid ${card.color}22`, fontSize:18 }}>{card.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{card.title}</span>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:999, background:card.accentBg, border:`1px solid ${card.color}22`, color:card.color }}>{card.badge}</span>
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.72)', lineHeight:1.35 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
              {trendAlertList.length > 0 && (
                <button onClick={() => { setMainTab('lab'); setSubTab('trends'); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#fff',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: 'rgba(239,68,68,0.25)', fontSize: 18,
                  }}>
                    ⚠️
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: '#ef4444' }}>Критические тренды ({trendAlertList.length})</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
                      {trendAlertList.slice(0, 2).map(a => `${a.name} ${a.direction === 'up' ? '↑' : '↓'}`).join(', ')}
                      {trendAlertList.length > 2 && ` +${trendAlertList.length - 2}`}
                    </div>
                  </div>
                  <span style={{ color: '#ef4444', fontSize: 14, opacity: 0.8 }}>→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR — glass, sticky ─── */}
      {mainTab !== 'hero' && (
        <div style={{ position:'sticky', top:0, zIndex:20, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', background:'rgba(10,12,18,0.72)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8, padding:'8px 12px', flexShrink:0 }}>
          <button onClick={() => setMainTab('hero')} style={{
            padding:'7px 12px', cursor:'pointer', fontSize:11, fontWeight:800, color:'#fff', border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', borderRadius:999, display:'flex', alignItems:'center', gap:6,
          }}>← Назад</button>
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT — увеличен нижний отступ чтобы дашборд не перекрывал ─── */}
      {mainTab !== 'hero' && (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px calc(20px + 72px + env(safe-area-inset-bottom,0px))' }}>

      {/* ≡≡≡ LAB SUB-TABS (only when mainTab === 'lab') ≡≡≡ */}
      {mainTab === 'lab' && (
        <>
          {/* Sub-tab segmented control */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none' }}>
            {LAB_SUB_TABS.filter(t => t.id !== 'hero').map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)} style={{
                padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                background: subTab === t.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: subTab === t.id ? '#000' : 'var(--text-dim)',
                border: `1px solid ${subTab === t.id ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ≡≡≡ OVERVIEW TAB ≡≡≡ */}
      {subTab === 'overview' && (
        <div style={{ padding: '10px 0' }}>
          <LabsOverview
            labs={currentLabs}
            hasLabs={!!hasLabs}
            forceNoLabs={globalNoLabs}
            setForceNoLabs={(v: boolean) => { setGlobalNoLabs(v); if (v) setNoLabsSystemsState([]); notifyDataChange(); }}
          />
          {/* Динамика маркеров (перенесено из вкладки chart) */}
          {(() => {
            const selCodes = Array.from(chartSelectedCodes);
            const chartPalette = ['var(--accent)','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
            const seriesByCode: Record<string, LabPoint[]> = {};
            if (selCodes.length > 0) {
              for (const code of selCodes) {
                seriesByCode[code] = labs.filter(l => l.code.toUpperCase() === code.toUpperCase()).sort((a,b) => a.date.localeCompare(b.date));
              }
            }
            const allDatesSet = new Set<string>();
            Object.values(seriesByCode).forEach(pts => pts.forEach(p => allDatesSet.add(p.date)));
            const allDates = Array.from(allDatesSet).sort();
            const globalVals = Object.values(seriesByCode).flat().map(d => d.value);
            const globalMin = globalVals.length > 0 ? Math.min(...globalVals) : 0;
            const globalMax = globalVals.length > 0 ? Math.max(...globalVals) : 100;
            const pad = (globalMax - globalMin) * 0.2 || 10;
            const chartMin = Math.max(0, globalMin - pad);
            const chartMax = globalMax + pad;
            const chartRange = chartMax - chartMin;
            const n = allDates.length;
            const barW = Math.max(28, Math.min(60, (320 - 50) / (n || 1)));
            const chartW = Math.max(320, n * barW + 60 + 120);
            const chartH = 220;
            const xBase = 50;
            const hasSelection = selCodes.length > 0;
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                  <span style={{ fontSize: 18 }}>📈</span>
                  <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Динамика маркеров</span>
                  {hasSelection && <span style={{ fontSize: 9, color: 'var(--accent)' }}>{selCodes.length} выбрано</span>}
                  <button onClick={() => setChartGridOpen(g => !g)} style={{
                    marginLeft: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{chartGridOpen ? '▲ Скрыть' : '▼ Маркеры'}</button>
                </div>
                {chartGridOpen && (<>
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8, scrollbarWidth: 'none', paddingBottom: 4 }}>
                  <button onClick={() => { setChartMarkerSearch(''); setChartFilterSys('all'); }} style={{
                    padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                    background: chartFilterSys === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: chartFilterSys === 'all' ? '#000' : 'var(--text-dim)',
                    border: `1px solid ${chartFilterSys === 'all' ? 'var(--accent)' : 'var(--border)'}`,
                  }}>Все</button>
                  {['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'].map(sys => {
                    const sysMarkers = uniqMarkers.filter(m => {
                      const codes = LAB_SYSTEM_GROUPS[sys];
                      return codes ? codes.includes(m.code) : false;
                    });
                    if (sysMarkers.length === 0) return null;
                    return (
                      <button key={sys} onClick={() => setChartFilterSys(prev => prev === sys ? 'all' : sys)} style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                        background: chartFilterSys === sys ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: chartFilterSys === sys ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${chartFilterSys === sys ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        {sysLabels[sys] || sys}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  {(chartFilterSys !== 'all'
                    ? uniqMarkers.filter(m => { const codes = LAB_SYSTEM_GROUPS[chartFilterSys]; return codes ? codes.includes(m.code) : false; })
                    : uniqMarkers
                  ).map(m => {
                    const isSelected = chartSelectedCodes.has(m.code);
                    return (
                      <button key={m.code} onClick={() => {
                        setChartSelectedCodes(prev => { const next = new Set(prev); if (next.has(m.code)) next.delete(m.code); else next.add(m.code); return next; });
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: isSelected ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? 'rgba(0,230,138,0.3)' : 'var(--border)'}`,
                        color: 'var(--text)', fontSize: 11, transition: 'all 0.15s',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: isSelected ? 'var(--accent)' : 'rgba(0,230,138,0.12)',
                          color: isSelected ? '#000' : 'var(--accent)', fontSize: 9, fontWeight: 700,
                        }}>
                          {isSelected ? '✓' : m.code.slice(0, 2)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{m.code}</div>
                        </div>
                      </button>
                    );
                  })}
                  {uniqMarkers.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 12 }}>
                      Введите анализы во вкладке «Текущие»
                    </div>
                  )}
                </div>
                </>)}
                {hasSelection ? (
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', fontSize: 9 }}>
                      {selCodes.map((code, i) => {
                        const info = UCUM_MAP[code];
                        return (
                          <span key={code} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: chartPalette[i % chartPalette.length], flexShrink: 0 }} />
                            {info?.name || code}
                          </span>
                        );
                      })}
                    </div>
                    <svg viewBox={`0 0 ${chartW} ${chartH + 40}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                      <rect x={xBase} y={0} width={chartW - xBase - 10} height={chartH} fill="rgba(255,255,255,0.02)" rx={6} />
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const y = chartH - f * chartH;
                        return (
                          <g key={f}>
                            <line x1={xBase} y1={y} x2={chartW - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                            <text x={xBase - 5} y={y + 3} fill="var(--text-dim)" fontSize={8} textAnchor="end">{(chartMin + f * chartRange).toFixed(1)}</text>
                          </g>
                        );
                      })}
                      {allDates.map((date, di) => {
                        const x = xBase + di * barW;
                        const groupW = Math.max(6, barW - 4);
                        const perBarW = selCodes.length > 1 ? groupW / selCodes.length : groupW;
                        return (
                          <g key={date}>
                            <text x={x + barW / 2} y={chartH + 12} fill="var(--text-dim)" fontSize={7} textAnchor="middle">{date.slice(5)}</text>
                            {selCodes.map((code, ci) => {
                              const pts = seriesByCode[code] || [];
                              const pt = pts.find(p => p.date === date);
                              if (!pt) return null;
                              const barH = Math.max(2, ((pt.value - chartMin) / chartRange) * chartH);
                              const y = chartH - barH;
                              const color = chartPalette[ci % chartPalette.length];
                              return (
                                <g key={`${date}_${code}`}>
                                  <rect x={x + 2 + ci * perBarW} y={y} width={Math.max(3, perBarW - 2)} height={barH} fill={color} rx={2} opacity={0.85} />
                                  {selCodes.length <= 2 && (
                                    <text x={x + 2 + ci * perBarW + perBarW / 2} y={y - 3} fill={color} fontSize={7} textAnchor="middle" fontWeight={700}>{pt.value}</text>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                      <line x1={xBase} y1={chartH} x2={chartW - 10} y2={chartH} stroke="var(--border)" strokeWidth={1} />
                    </svg>
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <button onClick={() => setChartSelectedCodes(new Set())} style={{
                        fontSize: 9, color: 'var(--text-dim)', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                      }}>✕ Сбросить выбор</button>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, padding: 20 }}>
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
                      Выберите 1+ маркеров для сравнения
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

          {/* ≡≡≡ CURRENT LABS TAB ≡≡≡ */}
      {subTab === 'current' && (
        <div>
          {/* Phase selector */}
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', margin: '10px 0', scrollbarWidth: 'none' }}>
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => handlePhaseChange(key)} style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s',
                background: selectedPhase === key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedPhase === key ? '#000' : 'var(--text-dim)',
                border: `1px solid ${selectedPhase === key ? 'var(--accent)' : 'var(--border)'}`,
                flexShrink: 0,
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Trend alerts */}
          {trendAlertList.length > 0 && (
            <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:10 }}>
              <div style={{ fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Критические изменения трендов ({trendAlertList.length})</div>
              {trendAlertList.slice(0,5).map(a => (
                <div key={a.code} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', color:'var(--text)' }}>
                  <span>{a.name}</span>
                  <span style={{ color: a.direction === 'up' ? '#ef4444' : '#22c55e', fontWeight:600 }}>
                    {a.direction === 'up' ? '↑' : '↓'} {a.significance}
                  </span>
                </div>
              ))}
              {trendAlertList.length > 5 && (
                <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:4 }}>
                  +{trendAlertList.length - 5} дополнительных — перейдите во вкладку «Тренды»
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setShowLabInput(true)} style={{
              padding: '12px 10px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'linear-gradient(135deg, rgba(0,230,138,0.12) 0%, rgba(0,230,138,0.04) 100%)',
              border: '1px solid rgba(0,230,138,0.25)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>➕</span> Добавить анализы
            </button>
              <button onClick={handleNewLabs} style={{
              padding: '12px 10px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
              border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>📋</span> Новые анализы (фаза)
            </button>
          </div>

          {/* Import button — opens modal with file/camera/paste options */}
          <div style={{ marginBottom: 10 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.csv,text/plain,application/pdf,image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleFileUpload(f); }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleFileUpload(f); }} />
            <button onClick={() => setShowImport(true)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.25)',
              background: 'linear-gradient(135deg, rgba(0,230,138,0.12) 0%, rgba(0,230,138,0.04) 100%)',
              color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>📄</span> Импорт анализов (PDF / фото / текст)
            </button>
          </div>

          {/* Inline batch form — same layout as progress card chips */}
          {showNewLabsInline && (
            <div className="card" style={{ marginBottom: 10, padding: 10, border: '1px solid rgba(0,230,138,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>📋 Новые анализы — {PHASE_LABELS[selectedPhase]}</span>
                <button onClick={() => { setShowNewLabsInline(false); setBatchValues({}); }} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)',
                  borderRadius: 8, padding: '3px 10px', fontSize: 10, cursor: 'pointer',
                }}>✕</button>
              </div>
              {Object.entries(labsBySystem).map(([system, codes]) => (
                <div key={system} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sysColors[system] || '#6b7280', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>{sysLabels[system] || system}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {codes.map(code => {
                      const info = UCUM_MAP[code.toUpperCase()];
                      const filled = batchValues[code] && batchValues[code].trim() !== '';
                      return (
                        <div key={code} style={{
                          display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px', borderRadius: 6,
                          background: filled ? 'rgba(0,230,138,0.10)' : 'var(--bg-secondary)',
                          border: `1px solid ${filled ? 'rgba(0,230,138,0.25)' : 'var(--border)'}`,
                          transition: 'all 0.15s',
                        }}>
                          <span style={{ fontSize: 10, fontWeight: filled ? 600 : 400, color: filled ? 'var(--accent)' : 'var(--text-dim)' }}>
                            {filled ? '✓' : '○'} {info?.name || code}
                          </span>
                          <input
                            value={batchValues[code] || ''}
                            onChange={e => setBatchValues(prev => ({ ...prev, [code]: e.target.value }))}
                            placeholder="0"
                            type="number"
                            style={{
                              width: 48, padding: '2px 4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                              borderRadius: 3, color: 'var(--accent)', fontSize: 10, fontWeight: 600, textAlign: 'right',
                            }}
                          />
                          <span style={{ fontSize: 7, color: 'var(--text-dim)', minWidth: 16 }}>{info?.prefUnit || ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowNewLabsInline(false); setBatchValues({}); }} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
                }}>✕ Отмена</button>
                <button onClick={handleBatchSave} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                }}>✓ Сохранить все</button>
              </div>
            </div>
          )}

          {/* Penalty card */}
          <div className="card" style={{ marginBottom: 10, padding: 10, background: anyNoLabs ? 'rgba(239,68,68,0.08)' : 'var(--glass-bg)', borderColor: anyNoLabs ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>⚠️ Штраф за отсутствие анализов</span>
              <button onClick={toggleGlobalNoLabs} style={{
                padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                background: globalNoLabs ? 'var(--accent)' : '#ef4444', color: globalNoLabs ? '#000' : '#fff', border: 'none',
              }}>
                {globalNoLabs ? '✅ Применён' : '🚫 Без анализов'}
              </button>
            </div>
            {anyNoLabs ? (
              <div style={{ fontSize: 10, color: '#ef4444' }}>Штраф ×{penalty.totalMultiplier.toFixed(2)} — коэффициент на все риски</div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нажмите чтобы применить штраф или введите анализы</div>
            )}
          </div>

          {/* Required labs progress */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{PHASE_LABELS[selectedPhase]}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444' }}>
                Готово {submittedCount}/{requiredLabs.length}
              </span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            {Object.entries(labsBySystem).map(([system, codes]) => (
              <div key={system} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sysColors[system] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>{sysLabels[system] || system}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {codes.map(code => {
                    const info = UCUM_MAP[code.toUpperCase()];
                    const isSubmitted = submittedCodes.has(code.toUpperCase());
                    const latest = currentLabs.find(l => l.code.toUpperCase() === code.toUpperCase());
                    const isHigh = latest && info ? (latest.value * (info.coeff || 1)) > info.uln : false;
                    const isLow = latest && info ? (latest.value * (info.coeff || 1)) < info.lln : false;
                    return (
                      <button key={code} onClick={() => { setInputCode(code); setInputUnit(info?.prefUnit || ''); setShowLabInput(true); }} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
                        background: isSubmitted ? (isHigh ? 'rgba(239,68,68,0.12)' : isLow ? 'rgba(249,115,22,0.12)' : 'rgba(0,230,138,0.08)') : 'var(--bg-secondary)',
                        border: `1px solid ${isSubmitted ? (isHigh ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(249,115,22,0.3)' : 'rgba(0,230,138,0.15)') : 'var(--border)'}`,
                        color: isSubmitted ? (isHigh ? '#ef4444' : isLow ? '#f97316' : 'var(--accent)') : 'var(--text-dim)',
                        fontWeight: isSubmitted ? 600 : 400,
                      }}>
                        {isSubmitted ? (isHigh ? '↑' : isLow ? '↓' : '✓') : '○'} {info?.name || code}
                        {latest && <span style={{ marginLeft: 3, fontWeight: 700 }}>{latest.value}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missingLabs.length > 0 && missingLabs.length < requiredLabs.length && (
              <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, fontSize: 9, color: 'var(--text-dim)' }}>
                Не сдано: {missingLabs.slice(0, 8).join(', ')}{missingLabs.length > 8 ? ` +${missingLabs.length - 8}` : ''}
              </div>
            )}
          </div>

          {/* Показать текущие результаты */}
          {currentLabs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>📋 Результаты текущей фазы</div>
              <LabsResults labs={currentLabs} />
            </div>
          )}

          {/* ─── Расширенная спермограмма (ПКТ / после ПКТ / базовый) ─── */}
          {['baseline','pct','post_pct'].includes(selectedPhase) && (
            <div style={{ marginTop: 10 }}>
              <div className="card" style={{ marginBottom: 10, padding: 10 }}>
                <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ec4899' }}>🧬 Фертильность — расширенная спермограмма</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
                  Фаза: <b>{PHASE_LABELS[selectedPhase] || selectedPhase}</b>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <PopupNumber label="Объём (мл)" value={parseFloat(fertSperm.vol||'')||0} min={0} max={15} step={0.1} suffix="мл" onChange={v => updateFert('vol', String(v))} />
                  <PopupNumber label="Концентрация (млн/мл)" value={parseFloat(fertSperm.conc||'')||0} min={0} max={500} step={0.1} suffix="млн/мл" onChange={v => updateFert('conc', String(v))} />
                  <PopupNumber label="Общее кол-во (млн)" value={parseFloat(fertSperm.total||'')||0} min={0} max={1500} step={1} suffix="млн" onChange={v => updateFert('total', String(v))} />
                  <PopupNumber label="PR (активно-подв.) %" value={parseFloat(fertSperm.pr||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('pr', String(v))} />
                  <PopupNumber label="NP (непрогрессивно) %" value={parseFloat(fertSperm.np||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('np', String(v))} />
                  <PopupNumber label="Неподвижные %" value={parseFloat(fertSperm.imm||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('imm', String(v))} />
                  <PopupNumber label="Морфология (норма) %" value={parseFloat(fertSperm.morph||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('morph', String(v))} />
                  <PopupNumber label="Жизнеспособность %" value={parseFloat(fertSperm.viab||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('viab', String(v))} />
                  <PopupNumber label="pH" value={parseFloat(fertSperm.ph||'7.4')} min={6} max={9} step={0.1} onChange={v => updateFert('ph', String(v))} />
                  <PopupNumber label="MAR-тест (% MAR+)" value={parseFloat(fertSperm.mar||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('mar', String(v))} />
                  <PopupNumber label="Лейкоциты (млн/мл)" value={parseFloat(fertSperm.leuk||'')||0} min={0} max={20} step={0.1} suffix="млн/мл" onChange={v => updateFert('leuk', String(v))} />
                  <PopupNumber label="Фруктоза (мкмоль/эяк)" value={parseFloat(fertSperm.fruc||'')||0} min={0} max={100} step={1} suffix="мкмоль" onChange={v => updateFert('fruc', String(v))} />
                  <PopupNumber label="Цинк (ммоль/эяк)" value={parseFloat(fertSperm.zinc||'')||0} min={0} max={20} step={0.1} suffix="ммоль" onChange={v => updateFert('zinc', String(v))} />
                  <PopupNumber label="DFI (фрагм. ДНК) %" value={parseFloat(fertSperm.dfi||'')||0} min={0} max={100} step={1} suffix="%" onChange={v => updateFert('dfi', String(v))} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                  <PopupBool label={fertSperm.visc==='1'?'Вязкость: повышена':'Вязкость: норма'} value={fertSperm.visc==='1'} onChange={v => updateFertBool('visc', v)} />
                  <PopupBool label={fertSperm.aggl==='1'?'Агглютинация: есть':'Агглютинация: нет'} value={fertSperm.aggl==='1'} onChange={v => updateFertBool('aggl', v)} />
                  <PopupSelect label="Варикоцеле" value={fertSperm.var||'none'} options={[
                    { id:'none', label:'Нет' }, { id:'grade1', label:'1 степень' },
                    { id:'grade2', label:'2 степень' }, { id:'grade3', label:'3 степень' },
                  ]} onChange={v => updateFert('var', v)} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 10, padding: 10 }}>
                <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#8b5cf6' }}>🧬 Ингибин B и гормональный профиль</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <PopupNumber label="Ингибин B (pg/mL)" value={parseFloat(fertSperm.inhb||'')||0} min={0} max={500} step={1} suffix="pg/mL" onChange={v => updateFert('inhb', String(v))} />
                  <PopupNumber label="АМГ (ng/mL)" value={parseFloat(fertSperm.amh||'')||0} min={0} max={20} step={0.1} suffix="ng/mL" onChange={v => updateFert('amh', String(v))} />
                  <PopupNumber label="ЛГ (mIU/mL)" value={parseFloat(fertSperm.lh||'')||0} min={0} max={50} step={0.1} suffix="mIU/mL" onChange={v => updateFert('lh', String(v))} />
                  <PopupNumber label="ФСГ (mIU/mL)" value={parseFloat(fertSperm.fsh||'')||0} min={0} max={50} step={0.1} suffix="mIU/mL" onChange={v => updateFert('fsh', String(v))} />
                  <PopupNumber label="ТТ (ng/dL)" value={parseFloat(fertSperm.tt||'')||0} min={0} max={2000} step={1} suffix="ng/dL" onChange={v => updateFert('tt', String(v))} />
                  <PopupNumber label="FT (pg/mL)" value={parseFloat(fertSperm.ft||'')||0} min={0} max={100} step={0.1} suffix="pg/mL" onChange={v => updateFert('ft', String(v))} />
                  <PopupNumber label="E2 (pg/mL)" value={parseFloat(fertSperm.e2||'')||0} min={0} max={200} step={1} suffix="pg/mL" onChange={v => updateFert('e2', String(v))} />
                  <PopupNumber label="Пролактин (ng/mL)" value={parseFloat(fertSperm.prl||'')||0} min={0} max={100} step={0.1} suffix="ng/mL" onChange={v => updateFert('prl', String(v))} />
                  <PopupNumber label="SHBG (nmol/L)" value={parseFloat(fertSperm.shbg||'')||0} min={0} max={100} step={1} suffix="nmol/L" onChange={v => updateFert('shbg', String(v))} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 10, padding: 10 }}>
                <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#22c55e' }}>📋 Нормы ВОЗ 2021</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'3px 12px', fontSize:9, color:'var(--text-dim)' }}>
                  <span>Объём эякулята</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥1.4 мл</span>
                  <span>Концентрация</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥16 млн/мл</span>
                  <span>Подвижность (PR+NP)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥42%</span>
                  <span>Прогрессивная (PR)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥30%</span>
                  <span>Морфология (Крюгер)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥4%</span>
                  <span>MAR-тест</span><span style={{ fontWeight:600, color:'#f59e0b' }}>{'<'}50% (норма), {'<'}10% (идеал)</span>
                  <span>Лейкоциты</span><span style={{ fontWeight:600, color:'#22c55e' }}>{'<'}1 млн/мл</span>
                  <span>DFI</span><span style={{ fontWeight:600, color:'#f59e0b' }}>{'<'}30% (идеал {'<'}15%)</span>
                  <span>Ингибин B</span><span style={{ fontWeight:600, color:'#22c55e' }}>{'>'}80 pg/mL</span>
                  <span>pH</span><span style={{ fontWeight:600, color:'#22c55e' }}>7.2-8.0</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ≡≡≡ COMBINED JOURNAL TAB (diary + reports + archive) ≡≡≡ */}
      {subTab === 'journal' && (
        <div style={{ paddingBottom: 80 }}>
          {/* Internal sub-tab segmented control */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none' }}>
            {([
              { id: 'diary' as const, label: 'Дневник', icon: '📓' },
              { id: 'reports' as const, label: 'Отчёты', icon: '📄' },
              { id: 'archive' as const, label: 'Архив', icon: '📦' },
            ]).map(v => (
              <button key={v.id} onClick={() => setJournalSubView(v.id)} style={{
                padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                background: journalSubView === v.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: journalSubView === v.id ? '#000' : 'var(--text-dim)',
                border: `1px solid ${journalSubView === v.id ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* ≡≡≡ DIARY SUB-VIEW ≡≡≡ */}
          {journalSubView === 'diary' && (
            <LabDiaryTab labs={labs} />
          )}

          {/* ≡≡≡ REPORTS SUB-VIEW ≡≡≡ */}
          {journalSubView === 'reports' && (
            <div>
              <div style={{ display:'flex', gap:6, marginTop:4, marginBottom:12 }}>
                <button onClick={() => {
                  const report = computeLabTrends(labs);
                  const insights = getTrendInsights(report.trends);
                  const r = {
                    id: Date.now().toString(),
                    date: new Date().toISOString().slice(0, 10),
                    labs: (labs || []).map((l: any) => ({ code: l.code, name: l.name || l.code, value: l.value, unit: l.unit, date: l.date })),
                    totalMarkers: labs.length,
                    abnormalCount: deviationCount,
                    timestamp: Date.now(),
                    trends: {
                      summary: report.summary,
                      insights,
                      worsened: report.worsened.slice(0, 5).map(t => ({ code: t.code, name: t.name, direction: t.direction, significance: t.significance, change: t.absoluteChange })),
                      improved: report.improved.slice(0, 5).map(t => ({ code: t.code, name: t.name, direction: t.direction, significance: t.significance, change: t.absoluteChange })),
                    }
                  };
                  const u = [r, ...labArchive].slice(0, 20);
                  setLabArchive(u);
                  try { localStorage.setItem('he_lab_reports', JSON.stringify(u)); localStorage.setItem('he_labs_report_current', JSON.stringify(r)); } catch { }
                  setLabReportGenerated(true);
                }} style={{ padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'var(--accent)', color: '#000', border: 'none', flex: 1 }}>📄 Сгенерировать отчёт</button>
                <button onClick={() => { try { localStorage.removeItem('he_lab_reports'); localStorage.removeItem('he_labs_report_current'); setLabArchive([]); setLabReportGenerated(false); } catch {} }} style={{ padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:11, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>🗑 Очистить</button>
              </div>
              {labReportGenerated && (
                <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#00e68a' }}>✅ Отчёт сгенерирован</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{new Date().toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)' }}><b>Маркеров:</b> {labs.length} ({deviationCount} с откл.)</div>
                  <div style={{ maxHeight:160, overflowY:'auto', marginTop:4 }}>
                    {labs.map((l:any,i:number) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4, background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9 }}>
                        <span>{l.name||l.code}</span><span style={{ fontWeight:700 }}>{l.value} {l.unit}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', textAlign:'center', marginTop:6 }}>Сохранено в архив. Доступно в Профиле → Отчёты.</div>
                </div>
              )}
              {labArchive.length > 0 && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>📦 Архив ({labArchive.length})</div>
                  {labArchive.slice(0,20).map((r:any) => (
                    <div key={r.id} onClick={() => setSelectedArchivedLabReport(selectedArchivedLabReport?.id === r.id ? null : r)} style={{ borderRadius:8, padding:8, marginBottom:4, background: selectedArchivedLabReport?.id === r.id ? 'rgba(0,230,138,0.08)' : 'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)', fontSize:9, cursor:'pointer' }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color:'#00e68a', fontWeight:700 }}>{r.date}</span>
                        <span style={{ color:'rgba(255,255,255,0.5)' }}>{r.totalMarkers} марк. · {r.abnormalCount || 0} откл.</span>
                      </div>
                      {selectedArchivedLabReport?.id === r.id && (
                        <div style={{ marginTop:6, padding:6, background:'rgba(0,0,0,0.15)', borderRadius:6 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:'#00e68a', marginBottom:4 }}>📋 Отчёт от {r.date}</div>
                          {(r.labs||[]).map((l:any, i:number) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:8, padding:'1px 0', color:'rgba(255,255,255,0.85)' }}>
                              <span>{l.name || l.code}</span>
                              <span>{l.value} {l.unit}</span>
                            </div>
                          ))}
                          {r.trends && (
                            <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize:8, fontWeight:700, color:'var(--accent)', marginBottom:3 }}>📈 Тренды</div>
                              <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:3 }}>{r.trends.summary}</div>
                              {r.trends.insights?.map((insight: string, i: number) => (
                                <div key={i} style={{ fontSize:8, color:'var(--text)', padding:'1px 0' }}>{insight}</div>
                              ))}
                              {r.trends.worsened?.length > 0 && (
                                <div style={{ fontSize:8, color:'#ef4444', marginTop:2 }}>⚠️ Ухудшения: {r.trends.worsened.map((w: any) => `${w.name} ${w.direction === 'up' ? '↑' : '↓'}`).join(', ')}</div>
                              )}
                              {r.trends.improved?.length > 0 && (
                                <div style={{ fontSize:8, color:'#22c55e', marginTop:2 }}>✅ Улучшения: {r.trends.improved.map((im: any) => `${im.name} ${im.direction === 'up' ? '↑' : '↓'}`).join(', ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!labReportGenerated && labArchive.length === 0 && (
                <div style={{ textAlign:'center', padding:30, fontSize:10, color:'rgba(255,255,255,0.4)' }}>Нажмите «Сгенерировать отчёт»</div>
              )}
            </div>
          )}

          {/* ≡≡≡ ARCHIVE SUB-VIEW ≡≡≡ */}
          {journalSubView === 'archive' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <span style={{ fontSize: 18 }}>📦</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Архив результатов</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{archiveLabs.length} записей • {new Set(archiveLabs.map(l => l.code.toUpperCase())).size} тестов</span>
              </div>
              <LabsResults labs={archiveLabs} />
            </div>
          )}
        </div>
      )}

      {/* ≡≡≡ TRENDS TAB ≡≡≡ */}
      {subTab === 'trends' && (() => {
        const report = computeLabTrends(labs);
        const insights = getTrendInsights(report.trends);
        const filtered = (() => {
          let base = report.trends;
          if (trendFilter === 'worsened') base = report.worsened;
          else if (trendFilter === 'improved') base = report.improved;
          else if (trendFilter !== 'all') base = base.filter(t => t.significance === trendFilter);
          if (trendSystemFilter !== 'all') {
            const sysCodes = LAB_SYSTEM_GROUPS[trendSystemFilter] || [];
            base = base.filter(t => sysCodes.includes(t.code.toUpperCase()));
          }
          return base;
        })();
        const recommendations = (() => {
          const recs: { trend: LabTrend; corrections: string[] }[] = [];
          for (const t of report.worsened) {
            if (t.significance === 'normal') continue;
            const ids = getCorrectionIds(t.code);
            if (ids.length > 0) {
              recs.push({ trend: t, corrections: ids.slice(0, 5) });
            }
          }
          return recs;
        })();
        const chartTrends = (() => {
          const withPoints = filtered.filter(t => t.points.length >= 2);
          if (visibleTrends.size === 0) return withPoints;
          return withPoints.filter(t => visibleTrends.has(t.code));
        })();
        const toggleTrend = (code: string) => {
          setVisibleTrends(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
          });
        };
        return (
          <div style={{ padding: '10px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>📈 Динамика маркеров ({report.trends.length})</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>{report.summary}</div>
              </div>
              {report.trends.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {(['all','significant','critical','worsened','improved'] as const).map(f => (
                    <button key={f} onClick={() => setTrendFilter(f)} style={{
                      padding:'4px 10px', borderRadius:6, fontSize:9, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                       background: trendFilter === f ? 'var(--accent)' : 'var(--bg-secondary)',
                       color: trendFilter === f ? '#000' : 'var(--text-dim)',
                       border: `1px solid ${trendFilter === f ? 'var(--accent)' : 'var(--border)'}`,
                    }}>
                      {f === 'all' ? 'Все' : f === 'significant' ? 'Значимые' : f === 'critical' ? 'Критические' : f === 'worsened' ? 'Ухудшения' : 'Улучшения'}
                    </button>
                   ))}
                   <button onClick={() => { setTrendSystemFilter('all'); }} style={{
                     padding:'3px 8px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                     background: trendSystemFilter === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
                     color: trendSystemFilter === 'all' ? '#000' : 'var(--text-dim)',
                     border: `1px solid ${trendSystemFilter === 'all' ? 'var(--accent)' : 'var(--border)'}`,
                   }}>Все системы</button>
                   {Object.entries(LAB_SYSTEM_GROUPS).slice(0, 6).map(([sys, codes]) => {
                     const info = SYSTEM_INFO_ALL[sys];
                     return (
                       <button key={sys} onClick={() => setTrendSystemFilter(trendSystemFilter === sys ? 'all' : sys)} style={{
                         padding:'3px 8px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                         background: trendSystemFilter === sys ? (info?.icon || '') + ' var(--accent)' : 'var(--bg-secondary)',
                         color: trendSystemFilter === sys ? '#000' : 'var(--text-dim)',
                         border: `1px solid ${trendSystemFilter === sys ? 'var(--accent)' : 'var(--border)'}`,
                       }}>
                         {info?.icon || ''} {info?.label || sys}
                       </button>
                     );
                   })}
                   <button onClick={() => {
                    const csv = exportTrendsToCSV(report);
                    downloadCSV(csv, `lab-trends-${new Date().toISOString().slice(0,10)}.csv`);
                  }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--accent)', fontWeight:600, fontSize:9, cursor:'pointer', whiteSpace:'nowrap' }}>
                    📥 CSV
                  </button>
                  <button onClick={() => {
                    const win = window.open('', '_blank');
                    if (!win) return;
                    const insightsHtml = insights.map(i => `<li>${i.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!))}</li>`).join('');
                    const rowsHtml = report.trends.map(t => `
                      <tr style="border-bottom:1px solid #eee">
                        <td style="padding:6px">${t.name}</td>
                        <td style="padding:6px">${t.previousDate || '—'}</td>
                        <td style="padding:6px">${t.previousValue ?? '—'}</td>
                        <td style="padding:6px">${t.currentDate}</td>
                        <td style="padding:6px">${t.currentValue} ${t.unit}</td>
                        <td style="padding:6px">${t.absoluteChange !== null ? (t.absoluteChange > 0 ? '+' : '') + t.absoluteChange.toFixed(1) : '—'}</td>
                        <td style="padding:6px">${t.percentChange !== null ? (t.percentChange > 0 ? '+' : '') + t.percentChange.toFixed(0) + '%' : '—'}</td>
                        <td style="padding:6px">${t.direction}</td>
                        <td style="padding:6px">${t.significance}</td>
                      </tr>
                    `).join('');
                    win.document.write(`<!DOCTYPE html><html><head><title>Lab Trends ${new Date().toISOString().slice(0,10)}</title>
                      <style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{color:#00c97f}table{border-collapse:collapse;width:100%;margin-top:12px}th{background:#00c97f;color:#fff;padding:8px;text-align:left}ul{margin-top:8px;padding-left:20px}li{margin:4px 0}</style>
                      </head><body>
                      <h1>📈 Lab Trends Report</h1>
                      <p><b>Date:</b> ${new Date().toLocaleDateString()} · <b>Markers:</b> ${report.trends.length} · <b>Summary:</b> ${report.summary}</p>
                      <h2>Insights</h2><ul>${insightsHtml}</ul>
                      <h2>Details</h2>
                      <table><thead><tr><th>Marker</th><th>Prev Date</th><th>Prev Value</th><th>Current Date</th><th>Current Value</th><th>Δ Abs</th><th>Δ %</th><th>Dir</th><th>Significance</th></tr></thead>
                      <tbody>${rowsHtml}</tbody></table>
                      <p style="margin-top:24px;font-size:11;color:#888">Generated by BioStackAI · ${new Date().toLocaleString()}</p>
                      </body></html>`);
                    win.document.close();
                    win.print();
                  }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--accent)', fontWeight:600, fontSize:9, cursor:'pointer', whiteSpace:'nowrap' }}>
                    🖨 Print
                  </button>
                </div>
              )}
            </div>
            {insights.length > 0 && (
              <div style={{ marginBottom:12, display:'grid', gap:4 }}>
                {insights.map((insight, i) => (
                  <div key={i} style={{ padding:'6px 10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.12)', fontSize:10, color:'var(--text)', lineHeight:1.4 }}>
                    {insight}
                  </div>
                ))}
              </div>
              )}
              {recommendations.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>💊 Рекомендации по коррекции</div>
                  {recommendations.map(({ trend, corrections }) => (
                    <div key={trend.code} style={{ padding:'4px 8px', borderRadius:6, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.12)', fontSize:9, color:'var(--text)', marginBottom:3, lineHeight:1.4 }}>
                      <b>{trend.name}</b> {trend.direction === 'up' ? '↑' : '↓'} {trend.absoluteChange?.toFixed(1)} — поддержать: {corrections.join(', ')}
                    </div>
                  ))}
                </div>
              )}
              {chartTrends.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📉 График изменений</div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                  {filtered.filter(t => t.points.length >= 2).map(t => {
                    const palette = ['#00e68a','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
                    const color = palette[report.trends.indexOf(t) % palette.length];
                    const isVisible = visibleTrends.size === 0 || visibleTrends.has(t.code);
                    return (
                      <button key={t.code} onClick={() => toggleTrend(t.code)} style={{
                        padding:'2px 8px', borderRadius:4, fontSize:8, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                        background: isVisible ? color + '22' : 'transparent',
                        color: isVisible ? color : 'var(--text-dim)',
                        border: `1px solid ${isVisible ? color + '44' : 'var(--border)'}`,
                        opacity: isVisible ? 1 : 0.5,
                      }}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ overflowX:'auto', paddingBottom:4 }}>
                  <svg width={Math.max(320, chartTrends.length * 90)} height={180} viewBox={`0 0 ${Math.max(320, chartTrends.length * 90)} 180`} style={{ width:'100%', height:'auto', display:'block' }}>
                    <rect x="0" y="0" width="100%" height="100%" fill="rgba(255,255,255,0.02)" rx="6" />
                    {(() => {
                      if (chartTrends.length === 0) return null;
                      const allDates = new Set<string>();
                      chartTrends.forEach(t => t.points.forEach(p => allDates.add(p.date)));
                      const dates = Array.from(allDates).sort();
                      const pad = { left: 40, right: 10, top: 10, bottom: 24 };
                      const w = Math.max(320, chartTrends.length * 90) - pad.left - pad.right;
                      const h = 180 - pad.top - pad.bottom;
                      const xStep = w / Math.max(1, dates.length - 1);
                      const palette = ['#00e68a','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
                      return (
                        <g transform={`translate(${pad.left},${pad.top})`}>
                          {[0, 0.25, 0.5, 0.75, 1].map(f => {
                            const y = h - f * h;
                            return <g key={f}><line x1="0" y1={y} x2={w} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" /></g>;
                          })}
                          {chartTrends.map((trend, ti) => {
                            const vals = trend.points.map(p => p.value);
                            const min = Math.min(...vals);
                            const max = Math.max(...vals);
                            const range = max - min || 1;
                            const points = trend.points.map((p, i) => {
                              const dateIdx = dates.indexOf(p.date);
                              const x = dateIdx * xStep;
                              const y = h - ((p.value - min) / range) * (h - 4) - 2;
                              return `${x},${y}`;
                            }).join(' ');
                            const color = palette[report.trends.indexOf(trend) % palette.length];
                            return (
                              <g key={trend.code}>
                                <polyline fill="none" stroke={color} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" opacity="0.9" />
                                 {trend.points.map((p, i) => {
                                   const dateIdx = dates.indexOf(p.date);
                                   const x = dateIdx * xStep;
                                   const y = h - ((p.value - min) / range) * (h - 4) - 2;
                                   return (
                                     <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="1"
                                        onMouseEnter={() => setHoveredTrendPoint({ code: trend.code, date: p.date, value: p.value, x: pad.left + x, y: pad.top + y })}
                                        onMouseLeave={() => setHoveredTrendPoint(null)}
                                       style={{ cursor: 'pointer' }}
                                     />
                                   );
                                 })}
                              </g>
                            );
                          })}
                          {dates.map((d, i) => (
                            <text key={i} x={i * xStep} y={h + 14} fill="var(--text-dim)" fontSize="7" textAnchor="middle">{d.slice(5)}</text>
                          ))}
                        </g>
                      );
                    })()}
                   </svg>
                    {hoveredTrendPoint && (
                     <div style={{
                        position: 'fixed', left: hoveredTrendPoint.x + 8, top: hoveredTrendPoint.y - 28,
                       background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '3px 8px', borderRadius: 4,
                       fontSize: 10, fontWeight: 600, pointerEvents: 'none', zIndex: 1000,
                       border: '1px solid rgba(255,255,255,0.15)',
                     }}>
                        {hoveredTrendPoint.date.slice(5)}: {hoveredTrendPoint.value.toFixed(1)}
                     </div>
                   )}
                 </div>
               </div>
             )}
             {report.worsened.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Ухудшения</div>
                {report.worsened.slice(0,10).map(t => (
                  <TrendRow key={t.code} trend={t} />
                ))}
              </div>
            )}
            {report.improved.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>✅ Улучшения</div>
                {report.improved.slice(0,10).map(t => (
                  <TrendRow key={t.code} trend={t} />
                ))}
              </div>
            )}
            {report.trends.length === 0 && (
              <div style={{ textAlign:'center', padding:30, fontSize:10, color:'var(--text-dim)' }}>Загрузите 2+ анализа для сравнения</div>
            )}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📋 Все маркеры</div>
              {report.trends.map(t => (
                <TrendRow key={t.code} trend={t} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* ≡≡≡ CATALOG TAB — unified: system groups + input + save + investigations ≡≡≡ */}
      {/* ≡≡≡ CATALOG TAB — unified: catalog + schedule + problem panels ≡≡≡ */}
      {mainTab === 'lab' && subTab === 'catalog' && (
        <div>
          {/* Catalog sub-view switcher */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none' }}>
            {([
              { id: 'catalog' as const, label: 'Каталог', icon: '📖' },
              { id: 'schedule' as const, label: 'График сдачи', icon: '📅' },
              { id: 'problems' as const, label: 'По проблеме', icon: '🔍' },
            ]).map(v => (
              <button key={v.id} onClick={() => setCatalogView(v.id)} style={{
                padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                background: catalogView === v.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: catalogView === v.id ? '#000' : 'var(--text-dim)',
                border: `1px solid ${catalogView === v.id ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {catalogView === 'catalog' && (
            <LabsCatalogTab
              labs={labs}
              selectedPhase={selectedPhase}
              onPhaseChange={handlePhaseChange}
              tick={tick}
            />
          )}

          {catalogView === 'schedule' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 0' }}>
                <span style={{ fontSize:18 }}>📅</span>
                <span style={{ fontSize:15, fontWeight:700 }}>График сдачи анализов</span>
              </div>
              <div style={{ display:'flex', gap:3, overflowX:'auto', marginBottom:10, scrollbarWidth:'none' }}>
                {Object.entries(PHASE_LABELS).map(([key,label]) => (
                  <button key={key} onClick={() => handlePhaseChange(key)} style={{
                    padding:'6px 12px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                    background: selectedPhase===key?'var(--accent)':'var(--bg-secondary)',
                    color: selectedPhase===key?'#000':'var(--text-dim)',
                    border:`1px solid ${selectedPhase===key?'var(--accent)':'var(--border)'}`,
                  }}>{label}</button>
                ))}
              </div>
              <div className="card" style={{ marginBottom:10, padding:12, border:'1px solid rgba(0,230,138,0.2)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>
                  📋 План сдачи: {PHASE_LABELS[selectedPhase]}
                </div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8, lineHeight:1.5 }}>
                  {(() => {
                    const phases: Record<string,string> = {
                       baseline:`Перед началом курса — полный базовый скрининг (${requiredLabs.length} маркеров, включая ОАМ)`,
                       on_cycle:`Каждые 4 недели на курсе — контроль печени, липидов, гормонов и ОАМ (${requiredLabs.length} маркеров)`,
                      bridge:'Между курсами — восстановительный мониторинг (30 маркеров)',
                      pct:'Послекурсовая терапия — контроль восстановления оси HPG (29 маркеров)',
                      post_pct:'Через 4-6 недель после ПКТ — финальная проверка (32 маркера)',
                    };
                    return phases[selectedPhase] || 'Следуйте рекомендованному графику';
                  })()}
                </div>
                <div style={{ display:'grid', gap:6 }}>
                  {Object.entries(labsBySystem).map(([system, codes]) => {
                    const submitted = codes.filter(c => submittedCodes.has(c.toUpperCase())).length;
                    const total = codes.length;
                    const pct = total > 0 ? Math.round(submitted/total*100) : 0;
                    return (
                      <div key={system} style={{ padding:8, borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background: sysColors[system]||'#6b7280' }}/>
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--accent)' }}>{sysLabels[system]||system}</span>
                          <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:'auto' }}>{submitted}/{total} · {pct}%</span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:pct===100?'var(--accent)':pct>50?'#eab308':'#f97316', borderRadius:3, transition:'width 0.4s' }}/>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
                          {codes.map(code => {
                            const info = UCUM_MAP[code.toUpperCase()];
                            const done = submittedCodes.has(code.toUpperCase());
                            return (
                              <span key={code} style={{
                                fontSize:8, padding:'1px 5px', borderRadius:3,
                                background: done ? 'rgba(0,230,138,0.12)' : 'rgba(239,68,68,0.08)',
                                color: done ? 'var(--accent)' : '#ef4444',
                                border:`1px solid ${done?'rgba(0,230,138,0.2)':'rgba(239,68,68,0.15)'}`,
                              }}>
                                {done ? '✓' : '○'} {info?.name||code}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {missingLabs.length > 0 && (
                  <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#ef4444', marginBottom:4 }}>⚠️ Не сдано ({missingLabs.length})</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>{missingLabs.slice(0,15).join(', ')}{missingLabs.length>15?` +${missingLabs.length-15}`:''}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {catalogView === 'problems' && (
            <LabsProblemPanelsTab />
          )}

          {catalogView !== 'catalog' && catalogView !== 'schedule' && catalogView !== 'problems' && (
            <LabsCatalogTab
              labs={labs}
              selectedPhase={selectedPhase}
              onPhaseChange={handlePhaseChange}
              tick={tick}
            />
          )}
        </div>
      )}

        </>)}
      {/* ≡≡≡ RISKS & INDICES TAB ≡≡≡ */}
      {mainTab === 'risks' && (() => {
        const r = labAnalysisResult;
        const rawASI = r ? Math.max(0, Math.round(100 - (
          (r.hormoneScore || 0) * 0.4 + Math.min(100, (r.inflammation || 0) / 6 * 50) * 0.3 + (r.kidneyStress || 0) * 0.3
        ))) : null;
        const ASI = rawASI !== null ? Math.min(100, rawASI) : null;
        const HMI = r ? Math.round(Math.min(100, r.liverStress || 0)) : null;
        const CR = r ? Math.round(Math.min(100, r.cardioRisk || 0)) : null;
        const statusColor = (val: number, invert: boolean) => {
          if (!invert) { if (val <= 30) return '#22c55e'; if (val <= 60) return '#eab308'; return '#ef4444'; }
          if (val >= 70) return '#22c55e'; if (val >= 40) return '#eab308'; return '#ef4444';
        };
        const statusLabel = (val: number, invert: boolean) => {
          if (!invert) { if (val <= 30) return 'Норма'; if (val <= 60) return 'Внимание'; return 'Опасность'; }
          if (val >= 70) return 'Хорошо'; if (val >= 40) return 'Умеренно'; return 'Низкий';
        };
        const indexEntries = Object.entries(labIndexDetails).map(([key, detail]) => ({
          key, label: detail.label, value: Math.round(detail.value * 100),
        }));
        const verifLabMap: Record<string, number> = tzLabValues;
        return (
          <div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none', alignItems: 'center' }}>
              {(['risks', 'verification'] as const).map(v => (
                <button key={v} onClick={() => setRisksView(v)} style={{
                  padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                  whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                  background: risksView === v ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: risksView === v ? '#000' : 'var(--text-dim)',
                  border: `1px solid ${risksView === v ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  {v === 'risks' ? '⚠️ Риски и индексы' : '🔬 Верификация рисков'}
                </button>
              ))}
            </div>
            {risksView === 'verification' ? (
              <RiskVerificationList labMap={verifLabMap} result={tzSpecResult} />
            ) : (
            <div>
            <div style={{ fontSize: 16, fontWeight: 700, padding: '10px 0' }}>⚠️ Риски и индексы здоровья</div>

            {/* Labs Score Card (TZ Pipeline) */}
            <LabsScoreCard
              markers={(() => {
                const latest = currentLabs?.[currentLabs.length - 1];
                if (!latest) return [];
                return Object.entries(latest).filter(([k, v]) => typeof v === 'number').map(([id, value]) => ({ id, value: value as number }));
              })()}
              weight={(linked.profile?.settings as any)?.personal?.weight || 80}
              age={(linked.profile?.settings as any)?.personal?.age || 30}
              sex={(linked.profile?.settings as any)?.personal?.sex || 'male'}
            />

            {/* Lab-Pharma Risks */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, pharma: !s.pharma }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.pharma ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🧬 Лабораторно-фармацевтические риски
              </button>
              {riskSections.pharma && (<div style={{ padding: '0 12px 12px' }}>
              {labPharmaAlerts.length > 0 ? (
                <div style={{ display: 'grid', gap: 3 }}>
                  {labPharmaAlerts.map((a, i) => (
                    <div key={i} style={{
                      fontSize: 9, padding: '4px 6px', borderRadius: 6,
                      background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : a.severity === 'high' ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
                      border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.2)' : a.severity === 'high' ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : 'var(--text)' }}>
                          {a.marker} {a.actualStatus === 'high' ? '↑' : a.actualStatus === 'low' ? '↓' : ''} {a.value}{a.unit}
                        </span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, fontWeight: 600, background: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#22c55e', color: a.severity === 'critical' || a.severity === 'high' ? '#fff' : '#000' }}>
                          {a.severity === 'critical' ? 'КРИТ' : a.severity === 'high' ? 'ВЫСОК' : 'МОНИТ'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>{(a.drugCause || []).map((id: string) => { const p = PHARMA_DB[id]; return p?.name || id.replace(/_/g, ' '); }).join(', ')} — {a.recommendation}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Связи анализов с препаратами не обнаружены' : 'Введите анализы для расчёта рисков'}
                </div>
              )}
              </div>)}</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, indices: !s.indices }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.indices ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                📊 Композитные индексы здоровья
              </button>
              {riskSections.indices && (<div style={{ padding: '0 12px 12px' }}><div style={{ display: 'grid', gap: 6 }}>
                {[
                  { label: 'ASI (Анаболический синтез)', desc: 'Способность к анаболизму', val: ASI, inv: true },
                  { label: 'HMI (Гепатический метаболизм)', desc: 'Стресс печени', val: HMI, inv: false },
                  { label: 'CR (Кардиориск)', desc: 'Липиды + воспаление', val: CR, inv: false },
                ].map(item => (
                  <div key={item.label} style={{
                    padding: 8, borderRadius: 8,
                    background: item.val !== null ? `rgba(${item.inv ? (item.val >= 70 ? '34,197,94' : item.val >= 40 ? '234,179,8' : '239,68,68') : (item.val <= 30 ? '34,197,94' : item.val <= 60 ? '234,179,8' : '239,68,68')},0.06)` : 'var(--bg-secondary)',
                    border: item.val !== null ? `1px solid rgba(${item.inv ? (item.val >= 70 ? '34,197,94' : item.val >= 40 ? '234,179,8' : '239,68,68') : (item.val <= 30 ? '34,197,94' : item.val <= 60 ? '234,179,8' : '239,68,68')},0.2)` : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>{item.desc}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {item.val !== null ? (
                          <><div style={{ fontSize: 18, fontWeight: 700, color: statusColor(item.val, item.inv) }}>{item.val}%</div>
                            <div style={{ fontSize: 8, color: statusColor(item.val, item.inv), fontWeight: 600 }}>{statusLabel(item.val, item.inv)}</div></>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {indexEntries.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 4 }}>
                    {indexEntries.map(d => (
                      <div key={d.key} style={{ padding: '4px 6px', borderRadius: 5, background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9 }}>{d.label}</span>
                        <span style={{ fontWeight: 700, fontSize: 10, color: getRiskColor(d.value), minWidth: 24, textAlign: 'right' }}>{d.value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>)}</div>

            {/* System Risks */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, systems: !s.systems }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.systems ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                ⚠️ Риски по системам организма
              </button>
              {riskSections.systems && (<div style={{ padding: '0 12px 12px' }}>
              {labRisks && Object.values(labRisks.systemBreakdown).some(v => v.net > 0) ? (
                <div style={{ display: 'grid', gap: 3 }}>
                  {Object.entries(labRisks.systemBreakdown).filter(([_, v]) => v.net > 0).sort(([_, a], [__, b]) => b.net - a.net).map(([sys, val]) => {
                    const level = val.net <= 25 ? 'low' : val.net <= 50 ? 'medium' : val.net <= 75 ? 'high' : 'critical';
                    const lc: Record<string, { bg: string; text: string; bar: string }> = {
                      low: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e', bar: '#22c55e' },
                      medium: { bg: 'rgba(234,179,8,0.08)', text: '#eab308', bar: '#eab308' },
                      high: { bg: 'rgba(249,115,22,0.08)', text: '#f97316', bar: '#f97316' },
                      critical: { bg: 'rgba(239,68,68,0.08)', text: '#ef4444', bar: '#ef4444' },
                    };
                    const c = lc[level];
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: c.bg, border: `1px solid ${c.bg.replace('0.08', '0.15')}` }}>
                        <span style={{ fontSize: 9, fontWeight: 600, minWidth: 60, color: c.text }}>{sysLabels[sys] || sys}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, val.net)}%`, height: '100%', background: c.bar, borderRadius: 3, transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.text, minWidth: 28, textAlign: 'right' }}>{Math.round(val.net)}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Все системы в норме' : 'Введите анализы для расчёта рисков'}
                </div>
              )}
              </div>)}</div>

            {/* Abnormal Markers */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, markers: !s.markers }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.markers ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🔬 Маркеры с отклонениями
              </button>
              {riskSections.markers && (<div style={{ padding: '0 12px 12px' }}>
              {deviationCount > 0 && labRisks ? (
                <div style={{ display: 'grid', gap: 3 }}>
                  {labRisks.markerDeviations.map(m => {
                    const isHigh = m.deviation > 0;
                    const absDev = Math.abs(m.deviation);
                    const devLevel = absDev <= 20 ? 'low' : absDev <= 50 ? 'medium' : absDev <= 100 ? 'high' : 'critical';
                    const devColors: Record<string, { bg: string; text: string }> = {
                      low: { bg: 'rgba(34,197,94,0.06)', text: '#22c55e' }, medium: { bg: 'rgba(234,179,8,0.06)', text: '#eab308' },
                      high: { bg: 'rgba(249,115,22,0.06)', text: '#f97316' }, critical: { bg: 'rgba(239,68,68,0.06)', text: '#ef4444' },
                    };
                    const dc = devColors[devLevel];
                    return (
                      <div key={m.code + m.value} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 6, background: dc.bg, border: `1px solid ${dc.bg.replace('0.06', '0.12')}` }}>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 46 }}>{sysLabels[m.system] || m.system}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, flex: 1, color: 'var(--text)' }}>{m.name}</span>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{m.lln}–{m.uln}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: dc.text }}>{m.value} <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, fontWeight: 600, background: dc.text + '22', color: dc.text }}>{isHigh ? '↑' : '↓'}{absDev}%</span></span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Все маркеры в норме' : 'Введите анализы для просмотра отклонений'}
                </div>
              )}
              </div>)}</div>

            {/* Drugs to Normalize */}
            {deviationCount > 0 && labRisks && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                <button onClick={() => setRiskSections(s => ({ ...s, normalizeDrugs: !s.normalizeDrugs }))} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
                }}>
                  <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.normalizeDrugs ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  💊 Препараты для нормализации маркеров
                </button>
                {riskSections.normalizeDrugs && (<div style={{ padding: '0 12px 12px' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {labRisks.markerDeviations.slice(0, 8).map(m => {
                      const isHigh = m.deviation > 0;
                      const drugs = getDrugsToNormalizeMarker(m.code, isHigh).slice(0, 5);
                      if (!drugs.length) return null;
                      return (
                        <div key={m.code} style={{ padding: '6px 8px', borderRadius: 8, background: isHigh ? 'rgba(239,68,68,0.04)' : 'rgba(59,130,246,0.04)', border: `1px solid ${isHigh ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)'}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: isHigh ? '#ef4444' : '#3b82f6' }}>
                            {m.name} {isHigh ? '↑' : '↓'} {Math.abs(m.deviation)}% → нормализация
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {drugs.map((d, i) => (
                              <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontWeight: 600, border: '1px solid rgba(0,230,138,0.15)' }}>
                                {d.drugId} ({(d.effect.strength * 100).toFixed(0)}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>)}
              </div>
            )}

            {/* ── Механизм-ориентированная модель (ТЗ) ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, tz: !s.tz }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.tz ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🧮 Риски (механизм-ориентированная модель ТЗ)
              </button>
              {riskSections.tz && (<div style={{ padding: '0 12px 12px' }}>
                {tzSpecResult ? (
                  <>
                    <div style={{ textAlign: 'center', padding: '8px 0', borderRadius: 10, marginBottom: 6,
                      background: 'linear-gradient(135deg, rgba(0,230,138,0.06) 0%, rgba(0,230,138,0.02) 100%)',
                      border: '1px solid rgba(0,230,138,0.15)' }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Общий риск</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: tzSpecResult.overallRaw < 25 ? '#22c55e' : tzSpecResult.overallRaw < 50 ? '#eab308' : '#f97316' }}>{tzSpecResult.overallRaw}%</span>
                        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>→</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: tzSpecResult.overallAfter < 25 ? '#22c55e' : tzSpecResult.overallAfter < 50 ? '#eab308' : '#f97316' }}>{tzSpecResult.overallAfter}%</span>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                        {tzSpecResult.overallCategory} · K_protect {tzSpecResult.k_protect_overall}%
                      </div>
                      {tzSpecResult.overallVerification !== undefined && (
                        <div style={{ fontSize: 8, marginTop: 2, color: tzSpecResult.overallVerification >= 0.5 ? '#4ade80' : '#fbbf24' }}>
                          {tzSpecResult.overallVerification >= 0.5 ? '🔬' : '⚠'} Индекс риска · верифицировано анализами: {Math.round(tzSpecResult.overallVerification * 100)}% систем
                          {tzSpecResult.overallVerification < 0.5 && ' — оценка по фармакологии'}
                        </div>
                      )}
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, margin: '4px 10px 0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, tzSpecResult.overallAfter)}%`, borderRadius: 2,
                          background: tzSpecResult.overallAfter < 25 ? '#22c55e' : tzSpecResult.overallAfter < 50 ? '#eab308' : '#f97316' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      {tzSpecResult.organs.map((organ: TzSpecOrganResult) => {
                        const cc = (v: number) => v < 25 ? '#22c55e' : v < 50 ? '#eab308' : v < 75 ? '#f97316' : '#ef4444';
                        return (
                          <div key={organ.id} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 9, fontWeight: 600 }}>
                                {organ.icon} {organ.name}
                                {organ.verification !== undefined && organ.verification < 0.5 && (
                                  <span style={{ color: '#fbbf24', marginLeft: 3 }}>⚠</span>
                                )}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: cc(organ.afterPercent) }}>
                                {organ.rawPercent}% → {organ.afterPercent}%
                              </span>
                            </div>
                            {organ.floors && organ.floors.length > 0 && (
                              <div style={{ marginTop: 1 }}>
                                {organ.floors.map((f, i) => (
                                  <div key={i} style={{ fontSize: 7, color: '#fca5a5', lineHeight: 1.4 }}>⚓ {f.label}</div>
                                ))}
                              </div>
                            )}
                            <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, marginTop: 1, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, organ.afterPercent)}%`, background: cc(organ.afterPercent), borderRadius: 1 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4 }}>
                      Из фазы «{PHASE_LABELS[selectedPhase]}» · покрытие {Math.round(tzSpecResult.d_cov * 100)}%
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: '10px 0' }}>
                    {hasLabs ? 'Недостаточно данных' : 'Введите анализы в текущей фазе'}
                  </div>
                )}
              </div>)}</div>

            {/* Penalty */}
            {anyNoLabs && (
              <div className="card" style={{ padding: 8, marginBottom: 8, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>⚠️ Штраф за отсутствие анализов</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444' }}>×{penalty.totalMultiplier.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Required Lab Markers for MDSS + Support Calculator */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, requiredLabs: !s.requiredLabs }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.requiredLabs ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                📋 Требуемые анализы (MDSS + Калькулятор поддержки)
              </button>
              {riskSections.requiredLabs && (<div style={{ padding: '0 12px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Сводка маркеров, необходимых для полного расчёта рисков MDSS, подбора поддержки и лабораторных индексов.
                </div>
                {[
                  { title: '🧬 MDSS — 14 систем', icon: '🧬', markers: [
                    'Почки: KIM-1, Cystatin C, Nephrin, UACR, Creatinine, eGFR, Microalbumin',
                    'Печень: CK-18, GLDH, GGT, Bile Acids, ALT, AST, ALP, Bilirubin',
                    'Сердце: Galectin-3, NT-proBNP, Troponin I/T, ADMA, CK-MB',
                    'Сосуды: ApoB, oxLDL, HDL, LDL, Lp(a), TC, TG, ApoA1',
                    'ЦНС: Cortisol, HVA, Prolactin, BDNF, Serotonin, Dopamine',
                    'HPTA: LH, FSH, TT, FT, Prolactin, SHBG, Inhibin B, DHEA-S',
                    'Кровь: HCT, HGB, Ferritin, EPO, RBC, PLT',
                    'Воспаление: hsCRP, CRP, Homocysteine, ESR, WBC, Fibrinogen',
                    'Метаболизм: HOMA-IR, HbA1c, C-Peptide, Glucose, Insulin, TG',
                    'GH/IGF: IGF-1, Glucose, Insulin, Cortisol',
                    'Кости: CTX, COMP, P1NP, Osteocalcin, Ca, Vit D, PTH',
                    'Щитовидная: TSH, FT3, FT4',
                    'Простата: PSA, PSA Free, DHT, TT',
                    'Кожа: DHT, TT, SHBG, Zn, Vit D',
                  ]},
                  { title: '💊 Калькулятор поддержки', icon: '💊', markers: [
                    'Гормоны: TT, FT, E2, LH, FSH, PRL, SHBG, DHEA-S, Cortisol, Progesterone',
                    'Биохимия: ALT, AST, GGT, ALP, Bilirubin, Creatinine, Urea, UA, GLU, TP, ALB, K, Na',
                    'Гематология: HGB, HCT, RBC, WBC, PLT, Ferritin, Iron, TIBC',
                    'Липиды: LDL, HDL, TG, TC, ApoA1, ApoB, Lp(a)',
                    'Щитовидная: TSH, FT3, FT4',
                    'Метаболизм: HOMA-IR, HbA1c, Insulin, Glucose, C-Peptide',
                    'Воспаление: hsCRP, CRP, ESR, Fibrinogen, Homocysteine',
                    'Маркеры: IGF-1, PSA, Vitamin D, B12, Folate, Mg, Zn, Se',
                  ]},
                  { title: '📊 Базовый минимум (8 маркеров)', icon: '📊', markers: [
                    'ALT, AST, GGT (печень), Creatinine, eGFR (почки)',
                    'LDL, HDL, TG (липиды), HCT, HGB (кровь)',
                    'TT, E2, LH (гормоны), TSH (щитовидная)',
                    'CRP (воспаление), GLU (метаболизм)',
                  ]},
                ].map(group => (
                  <div key={group.title} style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{group.icon} {group.title}</div>
                    {group.markers.map((m, i) => (
                      <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.5, paddingLeft: 6 }}>• {m}</div>
                    ))}
                  </div>
                ))}
              </div>)}</div>
            </div>
            )}
          </div>
        );
      })()}

      </div>
       )}
      {/* ─── BOTTOM TABS — зеро, внизу ─── */}
      {mainTab === 'lab' && mainTab !== 'hero' && (
        <div style={{ position:'fixed', bottom:'calc(var(--nav-height,56px) + env(safe-area-inset-bottom,0px))', left:0, right:0, zIndex:25, display:'flex', gap:6, overflowX:'auto', padding:'8px 10px calc(8px + env(safe-area-inset-bottom,0px))', background:'rgba(10,12,18,0.84)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', borderTop:'1px solid rgba(255,255,255,0.06)', scrollbarWidth:'none' }}>
          {LAB_SUB_TABS.filter(t => t.id !== 'hero').map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              flex:'0 0 auto', padding:'8px 14px', borderRadius:999, fontSize:11, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer',
              background: subTab===t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: subTab===t.id ? '#000' : 'rgba(255,255,255,0.72)', border: subTab===t.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: subTab===t.id ? '0 4px 12px rgba(0,230,138,0.18)' : 'none',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      )}

        {/* OCR Import Modal — centered */}
      {showImport && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={backdropClick}>
          <div style={{ width: '100%', maxWidth: 480, zIndex: 201, background: 'var(--bg)', borderRadius: 20, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>📄 Импорт анализов</span>
               <button onClick={cancelOcr} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', maxHeight: '70vh' }}>
              {ocrLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Распознаю документ...</div>
                </div>
              )}
              {!ocrLoading && !ocrResult && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Загрузите PDF, фото или вставьте текст результатов анализов.</p>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding: 16, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      📄 Выбрать PDF или фото
                    </button>
                    <button onClick={() => { if (cameraInputRef.current) cameraInputRef.current.click(); }} style={{ padding: 16, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      📸 Сфотографировать
                    </button>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <textarea
                        placeholder="Вставьте текст анализов..."
                        rows={5}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box', resize: 'vertical', marginBottom: 6 }}
                        id="lab-text-paste"
                      />
                      <button onClick={async () => {
                        const ta = document.getElementById('lab-text-paste') as HTMLTextAreaElement;
                        if (!ta?.value?.trim()) return;
                        setOcrLoading(true);
                        try {
                          const res = await processUploadedFile(new File([ta.value], 'pasted.txt', { type: 'text/plain' }));
                          setOcrResult(res);
                          if (res.labs.length > 0) setSelectedLabs(new Set(res.labs.map(l => l.code)));
                        } catch (e: any) {
                          setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['' + (e?.message || String(e))] });
                        }
                        setOcrLoading(false);
                      }} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                        📋 Разобрать вставленный текст
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {ocrResult && !ocrLoading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{ocrResult.labs.length > 0 ? `✅ Найдено: ${ocrResult.labs.length}` : '⚠️ Не найдено'}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{Math.round(ocrResult.confidence * 100)}%</span>
                  </div>
                  {ocrResult.warnings.length > 0 && (
                    <div role="alert" style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', color: '#f59e0b', fontSize: 11, lineHeight: 1.4 }}>
                      {ocrResult.warnings.map((warning, index) => <div key={`${index}-${warning}`}>⚠ {warning}</div>)}
                    </div>
                  )}
                  {ocrResult.labs.map(lab => {
                    const isSelected = selectedLabs.has(lab.code);
                    const confidence = typeof lab.confidence === 'number' ? lab.confidence : 0.8;
                    const confidencePct = Math.round(confidence * 100);
                    const confidenceColor = confidencePct >= 90 ? '#22c55e' : confidencePct >= 70 ? '#eab308' : '#ef4444';
                    const dynamicRatio = normalizedRatio(lab.code, lab.value, lab.unit, profileAge, profileSex as 'male' | 'female');
                    const ratioLabel = dynamicRatio != null ? ` (${Math.round(dynamicRatio * 100)}%)` : '';
                    const existing = labs.find(l => l.code.toUpperCase() === lab.code.toUpperCase());
                    const compareLabel = existing ? (() => {
                      const delta = lab.value - existing.value;
                      const pct = existing.value !== 0 ? Math.round((delta / Math.abs(existing.value)) * 100) : null;
                      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
                      const color = delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : 'var(--text-dim)';
                      return <span style={{ fontSize:8, color, fontWeight:600, marginLeft:4 }}>{arrow} {existing.value} → {lab.value} {pct !== null ? `(${pct > 0 ? '+' : ''}${pct}%)` : ''}</span>;
                    })() : null;
                    return (
                      <React.Fragment key={lab.code}>
                        <button onClick={() => toggleLabSelection(lab.code)} style={{
                          display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                          background: isSelected ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{isSelected ? '✓ ' : '○ '}{lab.name || lab.code}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {compareLabel}
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: confidenceColor + '22', color: confidenceColor }}>
                              {confidencePct}%
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: lab.isAbnormal ? '#ef4444' : 'var(--accent)' }}>{lab.value} {lab.unit}{ratioLabel}</span>
                          </span>
                        </button>
                        {lab.raw && !/^(?:error|warning|invalid pdf|pdf parsing)/i.test(lab.raw.trim()) && (
                          <div style={{ margin: '-2px 4px 6px', fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                            {lab.refLow !== undefined || lab.refHigh !== undefined ? `Норма: ${lab.refLow ?? '—'}–${lab.refHigh ?? '—'} · ` : ''}Источник: {lab.raw}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <button onClick={confirmOcrLabs} disabled={selectedLabs.size === 0} style={{
                    width: '100%', marginTop: 12, padding: 12,
                    background: selectedLabs.size > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: selectedLabs.size > 0 ? '#000' : 'var(--text-dim)',
                    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: selectedLabs.size > 0 ? 'pointer' : 'not-allowed',
                  }}>✓ Сохранить {selectedLabs.size} показателей</button>
                  {ocrResult.labs.length === 0 && (
                    <button onClick={() => { setOcrResult(null); setSelectedLabs(new Set()); }} style={{
                      width: '100%', marginTop: 6, padding: 10,
                      background: 'var(--bg-secondary)', color: 'var(--text-dim)',
                      border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}>🔄 Попробовать другой файл или вставить текст</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lab Input Modal — full screen to bottom */}
      {showLabInput && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => setShowLabInput(false)}>
          <div style={{ width: '100%', maxWidth: 420, zIndex: 201, background: 'var(--bg)', borderRadius: 20, padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🧪</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Ввести результат</span>
              </div>
              <button onClick={() => setShowLabInput(false)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
            {(() => { const info = UCUM_MAP[inputCode.toUpperCase()]; return info ? (
              <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 8, padding: '6px 10px', background: 'rgba(0,230,138,0.06)', borderRadius: 8 }}>
                {info.name} • Норма: {info.lln}–{info.uln} {info.prefUnit}
              </div>
            ) : null; })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>Код маркера</label>
                <input value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="ALT" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>Значение</label>
                <input type="number" value={inputValue || ''} onChange={e => setInputValue(e.target.value)} placeholder="40" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>Единица</label>
                <input value={inputUnit} onChange={e => setInputUnit(e.target.value)} placeholder="U/L" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>Дата</label>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>
            {addError && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', marginTop: 8 }}>{addError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowLabInput(false)} style={{
                padding: 10, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>✕ Отмена</button>
              <button onClick={() => { setAddError(''); addLab(); }} style={{
                padding: 10, borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>✓ Сохранить</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function TrendRow({ trend }: { trend: LabTrend }) {
  const color = getTrendColor(trend.significance);
  const icon = getTrendIcon(trend.direction, trend.significance);
  const sparkW = 64;
  const sparkH = 24;
  const pts = trend.points;
  let sparkPath = '';
  if (pts.length >= 2) {
    const vals = pts.map(p => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const step = sparkW / Math.max(1, pts.length - 1);
    const points = pts.map((p, i) => {
      const x = i * step;
      const y = sparkH - ((p.value - min) / range) * (sparkH - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
    sparkPath = points;
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', marginBottom:4, borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', fontSize:10 }}>
      <span style={{ fontSize:14, minWidth:20, textAlign:'center', color }}>{icon}</span>
      {pts.length >= 2 && (
        <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ flexShrink:0, opacity:0.9 }}>
          <polyline fill="none" stroke={color} strokeWidth="2" points={sparkPath} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trend.name}</div>
        <div style={{ fontSize:8, color:'var(--text-dim)' }}>
          {trend.previousDate && <span>{trend.previousDate.slice(5)}: {trend.previousValue}</span>}
          {trend.previousDate && <span> → </span>}
          <span>{trend.currentDate.slice(5)}: {trend.currentValue} {trend.unit}</span>
          {trend.absoluteChange !== null && (
            <span style={{ marginLeft:4, color, fontWeight:700 }}>
              {trend.absoluteChange > 0 ? '+' : ''}{trend.absoluteChange.toFixed(1)}
              {trend.percentChange !== null && <span style={{ fontSize:8 }}> ({trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(0)}%)</span>}
            </span>
          )}
          {trend.predictedValue !== undefined && (
            <span style={{ marginLeft:4, color:'#a855f7', fontWeight:600, fontSize:8 }}>
              → {trend.predictedValue} {trend.unit} ({Math.round((trend.predictionConfidence || 0) * 100)}%)
            </span>
          )}
        </div>
      </div>
      {trend.refLow !== undefined && trend.refHigh !== undefined && (
        <span style={{ fontSize:8, color:'var(--text-dim)', whiteSpace:'nowrap' }}>Норма: {trend.refLow}–{trend.refHigh}</span>
      )}
    </div>
  );
}
