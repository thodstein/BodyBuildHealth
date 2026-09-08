import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { HeroImg } from '../HeroImg';
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
import { LABS_ACCENT, LABS_CARD, LABS_SYSTEM_GROUPS } from './LabsScreen_parts/LabsUI';
import { labsWithAlpha } from './LabsScreen_parts/LabsUI';
import { NativeIcon, type NativeIconName } from '../native/NativeIcons';
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
import { isNativeApp } from '../../core/app-platform';
import { ensureLabsApkStyles } from './LabsScreen_parts/labs-apk-loader';

ensureLabsApkStyles();

/** LabsHeroStats — сводка hero, ТОЛЬКО APK (isNativeApp гейт). Telegram не рендерит. */
const LabsHeroStats: React.FC<{
  markers: number;
  completionPct: number;
  alerts: number;
}> = ({ markers, completionPct, alerts }) => (
  <div className="labs-hero-stats" aria-label="Сводка анализов">
    <div className="labs-hero-stat">
      <span className="labs-hero-stat-v">{markers}</span>
      <span className="labs-hero-stat-l">маркеров</span>
    </div>
    <div className="labs-hero-stat">
      <span className="labs-hero-stat-v">{completionPct}%</span>
      <span className="labs-hero-stat-l">панель готова</span>
    </div>
    <div className="labs-hero-stat">
      <span className="labs-hero-stat-v">{alerts}</span>
      <span className="labs-hero-stat-l">тревог</span>
    </div>
  </div>
);
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

// LABS_SYSTEM_GROUPS теперь единый из LabsUI (дедуп, было 3 копии)

function getSystemForCode(code: string): string | undefined {
  const upper = code.toUpperCase();
  for (const [sys, codes] of Object.entries(LABS_SYSTEM_GROUPS)) {
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

const MAIN_LAB_TABS: { id: MainLabTab; label: string; icon: NativeIconName }[] = [
  { id: 'lab', label: 'Анализы', icon: 'flask' },
  { id: 'risks', label: 'Риски и индексы', icon: 'alertTriangle' },
];

type MainLabTab = 'hero' | 'lab' | 'risks';

const LAB_SUB_TABS: { id: LabSubTab; label: string; icon: NativeIconName }[] = [
  { id: 'overview', label: 'Обзор', icon: 'chart' },
  { id: 'current', label: 'Текущие', icon: 'flask' },
  { id: 'catalog', label: 'Каталог', icon: 'bookOpen' },
  { id: 'journal', label: 'Дневник и архив', icon: 'notebook' },
  { id: 'trends', label: 'Тренды', icon: 'trendingDown' },
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
  // P0 fix: фаза из профиля может подтянуться асинхронно (useDataLink) — синкаем без сброса ручного выбора, если фаза реально сменилась
  useEffect(() => {
    const cur = PROFILE_PHASE_TO_LABS_PHASE[profilePhase] || 'baseline';
    setSelectedPhase(prev => (prev === cur ? prev : cur));
  }, [profilePhase]);
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
  // P0 fix: legacy без phase — только baseline, иначе completion врёт во всех фазах
  const currentLabs = useMemo(() => labs.filter(l => !l.archived && (!l.phase ? selectedPhase === 'baseline' : l.phase === selectedPhase)), [labs, selectedPhase]);
  // P0 fix: архив — только archived, а не «все чужие фазы» (иначе архив всегда полон, а переключение фазы теряет данные)
  const archiveLabs = useMemo(() => labs.filter(l => !!l.archived), [labs]);
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
      for (const [sys, codes] of Object.entries(LABS_SYSTEM_GROUPS)) {
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
      // P0 fix: HbA1c кейс — HBA1C vs HbA1c
      const ref = (UCUM_MAP as any)[lab.code] || (UCUM_MAP as any)[lab.code.toUpperCase()] || (UCUM_MAP as any)[lab.code.toLowerCase()] || (Object.entries(UCUM_MAP as any).find(([k]) => k.toLowerCase() === String(lab.code).toLowerCase())?.[1] as any);
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
        for (const [s, codes] of Object.entries(LABS_SYSTEM_GROUPS)) {
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

  // P0 fix: MIME-гейт + 15МБ + 30с таймаут
  const handleFileUpload = useCallback(async (file: File) => {
    const requestId = ++ocrRequestRef.current;
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    const okType = type.includes('pdf') || type.startsWith('image/') || type.includes('text') || type.includes('csv') || /\.(pdf|png|jpe?g|webp|bmp|gif|txt|csv)$/.test(name);
    if (!okType) {
      setOcrLoading(false);
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['Неподдерживаемый тип файла'] });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setOcrLoading(false);
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['Файл слишком большой (>15 МБ)'] });
      return;
    }
    setOcrLoading(true);
    setOcrResult(null);
    setSelectedLabs(new Set());
    try {
      const result: any = await Promise.race([
        processUploadedFile(file),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Таймаут обработки файла (30с)')), 30000)),
      ]);
      if (requestId !== ocrRequestRef.current) return;
      setOcrResult(result);
      if (result.labs.length > 0) setSelectedLabs(new Set(result.labs.map((l: any) => l.code)));
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

      {/* ─── HERO PAGE — на весь экран, fixed overlay, glass не перекрывает ─── */}
      {mainTab === 'hero' && (
        <div className="labs-hero" style={{ position:'fixed', inset:0, zIndex:80, display:'flex', flexDirection:'column', overflow:'hidden', background:'#050508' }}>
          <HeroImg webp="/lab-hero.webp" src="/lab-hero.png" alt="" onError={e=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:1 }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 0%, transparent 62%, rgba(0,0,0,0.10) 88%, rgba(0,0,0,0.18) 100%)' }} />
          <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px calc(20px + var(--nav-height,68px) + env(safe-area-inset-bottom,0px))', maxWidth:560, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
            <div style={{ marginBottom:14 }}>
            <h1 className="labs-hero-title" style={{ fontSize:26, fontWeight:900, color:'#fff', margin:'0 0 6px', letterSpacing:-0.8, lineHeight:1, textShadow:'0 2px 20px rgba(0,0,0,0.9)' }}>Лаборатория</h1>
            <p className="labs-hero-sub" style={{ fontSize:12.5, color:'#fff', margin:'0 0 12px', lineHeight:1.45, maxWidth:360, textShadow:'0 1px 12px rgba(0,0,0,0.85)' }}>
              Механизм-ориентированная модель ТЗ, тренды и обследования — всё в одном хабе
            </p>
            </div>
            {isNativeApp() && (
              <LabsHeroStats
                markers={uniqMarkers.length}
                completionPct={completionPct}
                alerts={trendAlertList.length}
              />
            )}
<div className="labs-hero-cards" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { id: 'lab', icon: 'flask', title: 'Анализы', desc: 'Ввод, каталог, динамика, дневник и графики. Единый ввод по фазе, импорт PDF/фото.', color: LABS_ACCENT },
                { id: 'risks', icon: 'alertTriangle', title: 'Риски и индексы', desc: 'ASI/HMI/CR, риски по системам, механизм-модель ТЗ и верификация.', color: '#f97316' },
              ].map(card => (
                <button key={card.id} onClick={() => setMainTab(card.id as MainLabTab)} className="labs-hero-card" data-id={card.id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'transparent', border:'1px solid rgba(255,255,255,0.14)', backdropFilter:'none', WebkitBackdropFilter:'none', boxShadow:'none', color:'#fff', transition:'transform 0.16s ease, border-color 0.16s ease, background 0.16s ease',
                }} onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.22)'; (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)'; }} onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.14)'; (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}>
                  <div style={{ width:40, height:40, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: labsWithAlpha(card.color, '18'), border:`1px solid ${labsWithAlpha(card.color, '22')}`, color: card.color }}><NativeIcon name={card.icon as NativeIconName} size={19} /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, marginBottom:1, color:'#fff', letterSpacing:-0.2, display:'flex', alignItems:'center', gap:6, textShadow:'0 1px 10px rgba(0,0,0,0.7)' }}>
                      {card.title}
                      <span style={{ width:5, height:5, borderRadius:'50%', background:card.color }} />
                    </div>
                    <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 8px rgba(0,0,0,0.6)' }}>{card.desc}</div>
                  </div>
                  <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.14)', color:'#fff', fontSize:12, flexShrink:0 }}>→</span>
                </button>
              ))}
              {trendAlertList.length > 0 && (
                <button onClick={() => { setMainTab('lab'); setSubTab('trends'); }} className="labs-hero-card labs-hero-alert" style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#fff',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: 'rgba(239,68,68,0.25)', color: '#f87171',
                  }}>
                    <NativeIcon name="alertTriangle" size={18} />
                  </div>
          <div style={{ flex: 1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, marginBottom:3, color:'#ef4444' }}>Критические тренды ({trendAlertList.length})</div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.5 }}>
              {trendAlertList.slice(0, 2).map(a => `${a.name} ${a.direction === 'up' ? '↑' : '↓'}`).join(', ')}
              {trendAlertList.length > 2 && ` +${trendAlertList.length - 2}`}
            </div>
          </div>
          <span style={{ color:'#ef4444', fontSize:15, opacity:0.9, flexShrink:0 }}>→</span>
        </button>
      )}
      <div style={{ marginTop:12, textAlign:'center', fontSize:12, color:'#fff', textShadow:'0 1px 8px rgba(0,0,0,0.6)', fontWeight:600 }}>Нажми на раздел — откроются инструменты и данные</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR — FIX: sticky с учётом safe-area, не перекрывает сабтабы ─── */}
      {mainTab !== 'hero' && (
        <div className="labs-topnav" style={{ position:'sticky', top:'env(safe-area-inset-top, 0px)', zIndex:30, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', background:'linear-gradient(180deg, rgba(21,38,66,0.92), rgba(12,23,40,0.92))', borderBottom:'1px solid rgba(140,190,255,0.14)', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', paddingTop:'calc(10px + env(safe-area-inset-top, 0px))', flexShrink:0, boxShadow:'0 8px 24px rgba(0,0,0,0.35)', minHeight:56 }}>
          <button onClick={() => setMainTab('hero')} aria-label="Назад в Лабораторию" style={{
            minHeight:44, minWidth:44, padding:'10px 14px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', border:'1px solid rgba(140,190,255,0.16)', background:'rgba(21,38,66,0.70)', borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', gap:6, flexShrink:0,
          }}>←</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', lineHeight:1.1, letterSpacing:-0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {mainTab === 'risks' ? 'Риски и индексы' : (LAB_SUB_TABS.find(t => t.id === subTab)?.label || 'Анализы')}
            </div>
            <div style={{ fontSize:12, color:'#fff', marginTop:2, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {mainTab === 'risks' ? 'ASI · HMI · CR · механизм-модель ТЗ' : `${currentLabs.length} маркеров · ${PHASE_LABELS[selectedPhase] || selectedPhase}`}
            </div>
          </div>
          <div style={{ width:38, height:38, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(var(--labs-accent-rgb, 0,230,138),0.14)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)', color:LABS_ACCENT, flexShrink:0 }}>
            <NativeIcon name={mainTab === 'risks' ? 'alertTriangle' : 'flask'} size={18} />
          </div>
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT — один скролл-контейнер (outer), без вложенного */}
      {mainTab !== 'hero' && (
      <div className="labs-body" style={{ flex: 1, minHeight: 0, overflowY: 'visible', padding: '0 12px calc(var(--nav-height, 76px) + 84px + env(safe-area-inset-bottom,0px))' }}>

      {/* ≡≡≡ LAB SUB-TABS (only when mainTab === 'lab') ≡≡≡ */}
      {mainTab === 'lab' && (
        <>
          {/* Sub-tab pills — FIX: липкая под шапкой (56px + safe-area), без перекрытия */}
          <div className="labs-subtabs" style={{ display:'flex', gap:8, overflowX:'auto', overflowY:'hidden', padding:'12px 2px 10px', scrollbarWidth:'none', flexWrap:'nowrap' as const, position:'sticky', top:'calc(env(safe-area-inset-top, 0px) + 56px)', zIndex:19, background:'linear-gradient(180deg, rgba(5,11,22,0.92), rgba(5,11,22,0.75))', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', margin:'0 -12px', paddingLeft:12, paddingRight:12, scrollSnapType:'x proximity' }}>
            {LAB_SUB_TABS.filter(t => t.id !== 'hero').map(t => {
              const active = subTab === t.id;
              return (
                <button key={t.id} onClick={() => setSubTab(t.id)} className="labs-subtab" data-active={active} aria-pressed={active} style={{
                  padding:'10px 16px', fontSize:12, fontWeight:800, whiteSpace:'nowrap',
                  cursor:'pointer', flexShrink:0, transition:'all 0.18s ease', scrollSnapAlign:'start',
                  background: active ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(21,38,66,0.70)',
                  border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                  borderRadius:999, minHeight:44,
                  color: active ? '#0a1a08' : '#fff',
                  boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                  display:'inline-flex', alignItems:'center', gap:7,
                }}>
                  <NativeIcon name={t.icon} size={14} /> {t.label}
                </button>
              );
            })}
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
              <div style={{ ...LABS_CARD, marginTop:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, borderLeft:`3px solid ${LABS_ACCENT}`, paddingLeft:10, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>📈</span>
                  <span style={{ fontSize:15, fontWeight:800, color:'#fff', flex:1 }}>Динамика маркеров</span>
                  {hasSelection && <span style={{ fontSize:11, color:LABS_ACCENT, fontWeight:800 }}>{selCodes.length} выбрано</span>}
                  <button onClick={() => setChartGridOpen(g => !g)} aria-expanded={chartGridOpen} style={{
                    marginLeft:'auto', background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)',
                    borderRadius:999, padding:'10px 14px', fontSize:12, fontWeight:800, color:'#fff', cursor:'pointer', whiteSpace:'nowrap', minHeight:44,
                  }}>{chartGridOpen ? '▲ Скрыть' : '▼ Маркеры'}</button>
                </div>
                {chartGridOpen && (<>
                <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:10, scrollbarWidth:'none', padding:'6px 2px' }}>
                  <button onClick={() => { setChartMarkerSearch(''); setChartFilterSys('all'); }} style={{
                    padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, minHeight:44,
                    background: chartFilterSys === 'all' ? `linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))` : 'rgba(21,38,66,0.60)',
                    color: chartFilterSys === 'all' ? '#0a1a08' : '#fff',
                    border: chartFilterSys === 'all' ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                    boxShadow: chartFilterSys==='all' ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                  }}>Все</button>
                  {['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'].map(sys => {
                    const sysMarkers = uniqMarkers.filter(m => {
                      const codes = LABS_SYSTEM_GROUPS[sys];
                      return codes ? codes.includes(m.code) : false;
                    });
                    if (sysMarkers.length === 0) return null;
                    const active = chartFilterSys === sys;
                    return (
                      <button key={sys} onClick={() => setChartFilterSys(prev => prev === sys ? 'all' : sys)} aria-pressed={active} style={{
                        padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, minHeight:44,
                        background: active ? 'var(--accent)' : 'rgba(21,38,66,0.60)',
                        color: active ? '#000' : '#fff',
                        border: active ? '1px solid var(--accent)' : '1px solid rgba(140,190,255,0.14)',
                      }}>
                        {sysLabels[sys] || sys}
                      </button>
                    );
                  })}
                </div>
                <div className="labs-sys-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:10 }}>
                  {(chartFilterSys !== 'all'
                    ? uniqMarkers.filter(m => { const codes = LABS_SYSTEM_GROUPS[chartFilterSys]; return codes ? codes.includes(m.code) : false; })
                    : uniqMarkers
                  ).map(m => {
                    const isSelected = chartSelectedCodes.has(m.code);
                    return (
                      <button key={m.code} onClick={() => {
                        setChartSelectedCodes(prev => { const next = new Set(prev); if (next.has(m.code)) next.delete(m.code); else next.add(m.code); return next; });
                      }} style={{
                        display:'flex', alignItems:'center', gap:10, padding:'12px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', minHeight:60,
                        background: isSelected ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.14)' : 'rgba(21,38,66,0.60)',
                        border: isSelected ? '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : '1px solid rgba(140,190,255,0.14)',
                        boxShadow: isSelected ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.25)' : 'none',
                        color:'#fff', fontSize:12, transition:'all 0.15s',
                      }}>
                        <div style={{
                          width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          background: isSelected ? 'var(--accent)' : 'rgba(var(--labs-accent-rgb, 0,230,138),0.12)',
                          color: isSelected ? '#000' : 'var(--accent)', fontSize:11, fontWeight:800,
                        }}>
                          {isSelected ? '✓' : m.code.slice(0, 2)}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:800, fontSize:13, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                          <div style={{ fontSize:11, color:'#fff', marginTop:1 }}>{m.code}</div>
                        </div>
                      </button>
                    );
                  })}
                  {uniqMarkers.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: '#fff', fontSize: 12 }}>
                      Введите анализы во вкладке «Текущие»
                    </div>
                  )}
                </div>
                </>)}
                {hasSelection ? (
                  <div className="card" style={{ ...LABS_CARD }}>
                    <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                      {selCodes.map((code, i) => {
                        const info = UCUM_MAP[code];
                        return (
                          <span key={code} style={{ display:'flex', alignItems:'center', gap:6, color:'#fff', fontSize:12, fontWeight:700, padding:'6px 10px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(140,190,255,0.10)' }}>
                            <span style={{ width:10, height:10, borderRadius:3, background:chartPalette[i % chartPalette.length], flexShrink:0 }} />
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
                            <text x={xBase - 5} y={y + 3} fill="#fff" fontSize={8} textAnchor="end">{(chartMin + f * chartRange).toFixed(1)}</text>
                          </g>
                        );
                      })}
                      {allDates.map((date, di) => {
                        const x = xBase + di * barW;
                        const groupW = Math.max(6, barW - 4);
                        const perBarW = selCodes.length > 1 ? groupW / selCodes.length : groupW;
                        return (
                          <g key={date}>
                            <text x={x + barW / 2} y={chartH + 12} fill="#fff" fontSize={8} textAnchor="middle">{date.slice(5)}</text>
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
                    <div style={{ marginTop:10, textAlign:'center' }}>
                      <button onClick={() => setChartSelectedCodes(new Set())} style={{
                        fontSize:12, fontWeight:800, color:'#fff', background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)',
                        borderRadius:999, padding:'10px 18px', cursor:'pointer', minHeight:44,
                      }}>✕ Сбросить выбор</button>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, padding: 20 }}>
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#fff' }}>
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
          {/* Phase selector — КАПИТАЛ: опшн-карточки 56px с радио и градиентом active */}
          <div className="labs-phase-row" style={{ display:'flex', gap:10, overflowX:'auto', margin:'14px 0 12px', scrollbarWidth:'none', padding:'2px 2px 6px', scrollSnapType:'x proximity' }}>
            {Object.entries(PHASE_LABELS).map(([key, label]) => {
              const active = selectedPhase === key;
              return (
                <button key={key} onClick={() => handlePhaseChange(key)} aria-pressed={active} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:14, minHeight:56, flexShrink:0, scrollSnapAlign:'start',
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.18s ease',
                  background: active ? 'linear-gradient(135deg, rgba(var(--labs-accent-rgb, 0,230,138),0.18) 0%, rgba(var(--labs-accent-rgb, 0,230,138),0.06) 100%)' : 'rgba(21,38,66,0.60)',
                  border: active ? '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : '1px solid rgba(140,190,255,0.14)',
                  boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.28)' : 'none',
                  color: '#fff',
                }}>
                  <span style={{
                    width:18, height:18, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                    border: active ? '2px solid var(--labs-accent, #00e68a)' : '2px solid rgba(255,255,255,0.22)',
                    background: active ? 'var(--labs-accent, #00e68a)' : 'transparent',
                  }}>
                    {active && <span style={{ width:8, height:8, borderRadius:'50%', background:'#0a1a08' }} />}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color: active ? 'var(--labs-accent, #00e68a)' : '#fff' }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Trend alerts */}
          {trendAlertList.length > 0 && (
            <div style={{ marginBottom:10, padding:'12px 12px', borderRadius:14, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)', borderLeft:'3px solid #ef4444' }}>
              <div style={{ fontWeight:800, fontSize:13, color:'#ef4444', marginBottom:6 }}>⚠️ Критические изменения трендов ({trendAlertList.length})</div>
              {trendAlertList.slice(0,5).map(a => (
                <div key={a.code} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 0', color:'#fff', fontSize:12 }}>
                  <span style={{ fontWeight:600 }}>{a.name}</span>
                  <span style={{ color: a.direction === 'up' ? '#ef4444' : '#22c55e', fontWeight:800, whiteSpace:'nowrap' }}>
                    {a.direction === 'up' ? '↑' : '↓'} {a.significance}
                  </span>
                </div>
              ))}
              {trendAlertList.length > 5 && (
                <div style={{ fontSize:11, color:'#fff', marginTop:6 }}>
                  +{trendAlertList.length - 5} дополнительных — перейдите во вкладку «Тренды»
                </div>
              )}
            </div>
          )}

          {/* Action buttons — TOP APK: 52px CTA, стекло + левая кромка, auto-fit */}
          <div className="labs-actions" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:10 }}>
            <button onClick={() => setShowLabInput(true)} style={{
              padding:'14px 12px', borderRadius:16, cursor:'pointer', fontWeight:800, fontSize:13, minHeight:52,
              background:'linear-gradient(180deg, rgba(21,38,66,0.78), rgba(12,23,40,0.78))',
              border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.30)', borderLeft:'3px solid var(--labs-accent, #00e68a)', color:'#fff',
              boxShadow:'0 8px 22px rgba(0,0,0,0.40)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(var(--labs-accent-rgb, 0,230,138),0.14)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)', fontSize:15, flexShrink:0 }}>➕</span> Добавить анализы
            </button>
            <button onClick={handleNewLabs} style={{
              padding:'14px 12px', borderRadius:16, cursor:'pointer', fontWeight:800, fontSize:13, minHeight:52,
              background:'linear-gradient(180deg, rgba(21,38,66,0.78), rgba(12,23,40,0.78))',
              border:'1px solid rgba(59,130,246,0.30)', borderLeft:'3px solid #3b82f6', color:'#fff',
              boxShadow:'0 8px 22px rgba(0,0,0,0.40)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.14)', border:'1px solid rgba(59,130,246,0.22)', fontSize:15, flexShrink:0 }}>📋</span> Новые анализы (фаза)
            </button>
          </div>

          {/* Import button — TOP APK primary CTA 52px */}
          <div style={{ marginBottom:10 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.csv,text/plain,application/pdf,image/*" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleFileUpload(f); }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleFileUpload(f); }} />
            <button onClick={() => setShowImport(true)} style={{
              width:'100%', padding:'14px 14px', borderRadius:16, border:'1px solid transparent',
              background:'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))',
              color:'#0a1a08', fontWeight:800, fontSize:14, cursor:'pointer', minHeight:52,
              boxShadow:'0 8px 24px rgba(var(--labs-accent-rgb, 0,230,138),0.35)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              <span style={{ fontSize:17 }}>📄</span> Импорт анализов (PDF / фото / текст)
            </button>
          </div>

          {/* Inline batch form — same layout as progress card chips */}
          {showNewLabsInline && (
            <div className="card" style={{ marginBottom: 10, padding: 10, border: '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.25)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontWeight:800, fontSize:14, color:'#fff' }}>📋 Новые анализы — {PHASE_LABELS[selectedPhase]}</span>
                <button onClick={() => { setShowNewLabsInline(false); setBatchValues({}); }} aria-label="Закрыть ввод" style={{
                  background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff',
                  borderRadius:999, minWidth:44, minHeight:44, padding:'10px 14px', fontSize:13, fontWeight:800, cursor:'pointer', flexShrink:0,
                }}>✕</button>
              </div>
              {Object.entries(labsBySystem).map(([system, codes]) => (
                <div key={system} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background: sysColors[system] || '#6b7280', flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{sysLabels[system] || system}</span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {codes.map(code => {
                      const info = UCUM_MAP[code.toUpperCase()];
                      const filled = batchValues[code] && batchValues[code].trim() !== '';
                      return (
                        <div key={code} style={{
                          display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:12, minHeight:48,
                          background: filled ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.12)' : 'rgba(21,38,66,0.60)',
                          border: filled ? '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.30)' : '1px solid rgba(140,190,255,0.14)',
                          transition:'all 0.15s',
                        }}>
                          <span style={{ fontSize:12, fontWeight: filled ? 800 : 600, color: filled ? 'var(--accent)' : '#fff' }}>
                            {filled ? '✓' : '○'} {info?.name || code}
                          </span>
                          <input
                            value={batchValues[code] || ''}
                            onChange={e => setBatchValues(prev => ({ ...prev, [code]: e.target.value }))}
                            placeholder="0"
                            type="number"
                            aria-label={info?.name || code}
                            style={{
                              width:64, padding:'8px 8px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', minHeight:40,
                              borderRadius:10, color:'var(--accent)', fontSize:13, fontWeight:800, textAlign:'right',
                            }}
                          />
                          <span style={{ fontSize:10, color:'#fff', minWidth:20, fontWeight:700 }}>{info?.prefUnit || ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button onClick={() => { setShowNewLabsInline(false); setBatchValues({}); }} style={{
                  flex:1, padding:'12px 14px', borderRadius:14, border:'1px solid rgba(140,190,255,0.14)', minHeight:48,
                  background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer',
                }}>✕ Отмена</button>
                <button onClick={handleBatchSave} style={{
                  flex:1, padding:'12px 14px', borderRadius:14, border:'none', minHeight:48,
                  background:'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))', color:'#0a1a08', fontWeight:800, fontSize:13, cursor:'pointer',
                  boxShadow:'0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)',
                }}>✓ Сохранить все</button>
              </div>
            </div>
          )}

          {/* Penalty card — TOP APK 44px */}
          <div className="card" style={{ marginBottom:10, padding:14, borderRadius:16, background: anyNoLabs ? 'rgba(239,68,68,0.10)' : 'linear-gradient(180deg, rgba(21,38,66,0.72), rgba(12,23,40,0.72))', border: anyNoLabs ? '1px solid rgba(239,68,68,0.30)' : '1px solid rgba(140,190,255,0.14)', borderLeft:`3px solid ${anyNoLabs ? '#ef4444' : LABS_ACCENT}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>⚠️ Штраф за отсутствие анализов</span>
              <button onClick={toggleGlobalNoLabs} aria-pressed={globalNoLabs} style={{
                padding:'10px 16px', borderRadius:999, cursor:'pointer', fontWeight:800, fontSize:12, minHeight:44, flexShrink:0,
                background: globalNoLabs ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : '#ef4444', color: globalNoLabs ? '#0a1a08' : '#fff', border:'none',
                boxShadow: globalNoLabs ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
              }}>
                {globalNoLabs ? '✅ Применён' : '🚫 Без анализов'}
              </button>
            </div>
            {anyNoLabs ? (
              <div style={{ fontSize:12, color:'#fff', fontWeight:600 }}>Штраф ×{penalty.totalMultiplier.toFixed(2)} — коэффициент на все риски</div>
            ) : (
              <div style={{ fontSize:12, color:'#fff' }}>Нажмите чтобы применить штраф или введите анализы</div>
            )}
          </div>

          {/* Required labs progress — TOP APK чипы 44px */}
          <div className="card" style={{ marginBottom:10, padding:14, borderRadius:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{PHASE_LABELS[selectedPhase]}</span>
              <span style={{ fontSize:12, fontWeight:800, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444', fontVariantNumeric:'tabular-nums' }}>
                Готово {submittedCount}/{requiredLabs.length}
              </span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:999, height:8, overflow:'hidden', marginBottom:10 }}>
              <div style={{ width:`${completionPct}%`, height:'100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius:999, transition:'width 0.4s ease' }} />
            </div>
            {Object.entries(labsBySystem).map(([system, codes]) => (
              <div key={system} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: sysColors[system] || '#6b7280', flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{sysLabels[system] || system}</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {codes.map(code => {
                    const info = UCUM_MAP[code.toUpperCase()];
                    const isSubmitted = submittedCodes.has(code.toUpperCase());
                    const latest = currentLabs.find(l => l.code.toUpperCase() === code.toUpperCase());
                    const isHigh = latest && info ? (latest.value * (info.coeff || 1)) > info.uln : false;
                    const isLow = latest && info ? (latest.value * (info.coeff || 1)) < info.lln : false;
                    return (
                      <button key={code} onClick={() => { setInputCode(code); setInputUnit(info?.prefUnit || ''); setShowLabInput(true); }} style={{
                        padding:'8px 12px', borderRadius:12, fontSize:12, cursor:'pointer', transition:'all 0.15s', minHeight:40,
                        background: isSubmitted ? (isHigh ? 'rgba(239,68,68,0.14)' : isLow ? 'rgba(249,115,22,0.14)' : 'rgba(var(--labs-accent-rgb, 0,230,138),0.10)') : 'rgba(21,38,66,0.60)',
                        border: isSubmitted ? (isHigh ? '1px solid rgba(239,68,68,0.35)' : isLow ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)') : '1px solid rgba(140,190,255,0.14)',
                        color: isSubmitted ? (isHigh ? '#ef4444' : isLow ? '#f97316' : 'var(--accent)') : '#fff',
                        fontWeight: isSubmitted ? 800 : 600,
                      }}>
                        {isSubmitted ? (isHigh ? '↑' : isLow ? '↓' : '✓') : '○'} {info?.name || code}
                        {latest && <span style={{ marginLeft:4, fontWeight:800 }}>{latest.value}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missingLabs.length > 0 && missingLabs.length < requiredLabs.length && (
              <div style={{ marginTop:6, padding:'10px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.16)', borderRadius:12, fontSize:12, color:'#fff', lineHeight:1.5 }}>
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
            <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
              <div className="card" style={{ ...LABS_CARD, borderLeft:'3px solid #ec4899' }}>
                <h4 style={{ margin:'0 0 8px', fontSize:15, fontWeight:800, color:'#fff', borderLeft:'3px solid #ec4899', paddingLeft:10 }}>🧬 Фертильность — расширенная спермограмма</h4>
                <div style={{ fontSize:12, color:'#fff', marginBottom:8 }}>
                  Фаза: <b>{PHASE_LABELS[selectedPhase] || selectedPhase}</b>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
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
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginTop:8 }}>
                  <PopupBool label={fertSperm.visc==='1'?'Вязкость: повышена':'Вязкость: норма'} value={fertSperm.visc==='1'} onChange={v => updateFertBool('visc', v)} />
                  <PopupBool label={fertSperm.aggl==='1'?'Агглютинация: есть':'Агглютинация: нет'} value={fertSperm.aggl==='1'} onChange={v => updateFertBool('aggl', v)} />
                  <PopupSelect label="Варикоцеле" value={fertSperm.var||'none'} options={[
                    { id:'none', label:'Нет' }, { id:'grade1', label:'1 степень' },
                    { id:'grade2', label:'2 степень' }, { id:'grade3', label:'3 степень' },
                  ]} onChange={v => updateFert('var', v)} />
                </div>
              </div>

              <div className="card" style={{ ...LABS_CARD, borderLeft:'3px solid #8b5cf6' }}>
                <h4 style={{ margin:'0 0 8px', fontSize:15, fontWeight:800, color:'#fff', borderLeft:'3px solid #8b5cf6', paddingLeft:10 }}>🧬 Ингибин B и гормональный профиль</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
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

              <div className="card" style={{ ...LABS_CARD, borderLeft:'3px solid #22c55e' }}>
                <h4 style={{ margin:'0 0 10px', fontSize:15, fontWeight:800, color:'#fff', borderLeft:'3px solid #22c55e', paddingLeft:10 }}>📋 Нормы ВОЗ 2021</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12, color:'#fff' }}>
                  {([
                    ['Объём эякулята','≥1.4 мл','#22c55e'],['Концентрация','≥16 млн/мл','#22c55e'],
                    ['Подвижность (PR+NP)','≥42%','#22c55e'],['Прогрессивная (PR)','≥30%','#22c55e'],
                    ['Морфология (Крюгер)','≥4%','#22c55e'],['MAR-тест','<50% (норма), <10% (идеал)','#f59e0b'],
                    ['Лейкоциты','<1 млн/мл','#22c55e'],['DFI','<30% (идеал <15%)','#f59e0b'],
                    ['Ингибин B','>80 pg/mL','#22c55e'],['pH','7.2-8.0','#22c55e'],
                  ] as [string,string,string][]).map(([k,v,c]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(140,190,255,0.10)', minHeight:44 }}>
                      <span style={{ fontWeight:600 }}>{k}</span><span style={{ fontWeight:800, color:c, textAlign:'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ≡≡≡ COMBINED JOURNAL TAB (diary + reports + archive) ≡≡≡ */}
      {subTab === 'journal' && (
        <div style={{ paddingBottom: 80 }}>
          {/* Internal sub-tab — TOP APK 44px */}
          <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 8px', scrollbarWidth:'none' }}>
            {([
              { id: 'diary' as const, label: 'Дневник', icon: '📓' },
              { id: 'reports' as const, label: 'Отчёты', icon: '📄' },
              { id: 'archive' as const, label: 'Архив', icon: '📦' },
            ]).map(v => {
              const active = journalSubView === v.id;
              return (
                <button key={v.id} onClick={() => setJournalSubView(v.id)} aria-pressed={active} style={{
                  padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s', flexShrink:0, minHeight:44,
                  background: active ? `linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))` : 'rgba(21,38,66,0.60)',
                  color: active ? '#0a1a08' : '#fff',
                  border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                  boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                }}>
                  {v.icon} {v.label}
                </button>
              );
            })}
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
                }} style={{ padding:'14px 16px', borderRadius:16, cursor:'pointer', fontWeight:800, fontSize:14, minHeight:52, background:'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))', color:'#0a1a08', border:'none', flex:1, boxShadow:'0 8px 24px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' }}>📄 Сгенерировать отчёт</button>
                <button onClick={() => { try { localStorage.removeItem('he_lab_reports'); localStorage.removeItem('he_labs_report_current'); setLabArchive([]); setLabReportGenerated(false); } catch {} }} style={{ padding:'14px 14px', borderRadius:16, cursor:'pointer', fontWeight:800, fontSize:13, minHeight:52, background:'rgba(239,68,68,0.10)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)' }}>🗑</button>
              </div>
              {labReportGenerated && (
                <div style={{ ...LABS_CARD, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:LABS_ACCENT }}>✅ Отчёт сгенерирован</span>
                    <span style={{ fontSize:11, color:'#fff' }}>{new Date().toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#fff' }}><b>Маркеров:</b> {labs.length} ({deviationCount} с откл.)</div>
                  <div style={{ maxHeight:200, overflowY:'auto', marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                    {labs.map((l:any,i:number) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(140,190,255,0.10)', fontSize:12, color:'#fff', minHeight:44 }}>
                        <span style={{ fontWeight:600 }}>{l.name||l.code}</span><span style={{ fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{l.value} {l.unit}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:'#fff', textAlign:'center', marginTop:8 }}>Сохранено в архив. Доступно в Профиле → Отчёты.</div>
                </div>
              )}
              {labArchive.length > 0 && (
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:8, borderLeft:`3px solid ${LABS_ACCENT}`, paddingLeft:10 }}>📦 Архив ({labArchive.length})</div>
                  {labArchive.slice(0,20).map((r:any) => (
                    <div key={r.id} onClick={() => setSelectedArchivedLabReport(selectedArchivedLabReport?.id === r.id ? null : r)} style={{ borderRadius:14, padding:'12px 12px', marginBottom:8, background: selectedArchivedLabReport?.id === r.id ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.10)' : 'linear-gradient(180deg, rgba(21,38,66,0.60), rgba(12,23,40,0.60))', border:'1px solid rgba(140,190,255,0.12)', borderLeft:`3px solid ${LABS_ACCENT}`, fontSize:12, cursor:'pointer', minHeight:52 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <span style={{ color:LABS_ACCENT, fontWeight:800, fontSize:13 }}>{r.date}</span>
                        <span style={{ color:'#fff', fontSize:12 }}>{r.totalMarkers} марк. · {r.abnormalCount || 0} откл.</span>
                      </div>
                      {selectedArchivedLabReport?.id === r.id && (
                        <div style={{ marginTop:8, padding:10, background:'rgba(0,0,0,0.20)', borderRadius:10 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:LABS_ACCENT, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><NativeIcon name="file" size={12} /> Отчёт от {r.date}</div>
                          {(r.labs||[]).map((l:any, i:number) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:12, padding:'4px 0', color:'#fff' }}>
                              <span>{l.name || l.code}</span>
                              <span style={{ fontWeight:700 }}>{l.value} {l.unit}</span>
                            </div>
                          ))}
                          {r.trends && (
                            <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ fontSize:12, fontWeight:800, color:'var(--accent)', marginBottom:4 }}>📈 Тренды</div>
                              <div style={{ fontSize:12, color:'#fff', marginBottom:4, lineHeight:1.5 }}>{r.trends.summary}</div>
                              {r.trends.insights?.map((insight: string, i: number) => (
                                <div key={i} style={{ fontSize:12, color:'#fff', padding:'2px 0', lineHeight:1.5 }}>{insight}</div>
                              ))}
                              {r.trends.worsened?.length > 0 && (
                                <div style={{ fontSize:12, color:'#ef4444', marginTop:4 }}>⚠️ Ухудшения: {r.trends.worsened.map((w: any) => `${w.name} ${w.direction === 'up' ? '↑' : '↓'}`).join(', ')}</div>
                              )}
                              {r.trends.improved?.length > 0 && (
                                <div style={{ fontSize:12, color:'#22c55e', marginTop:4 }}>✅ Улучшения: {r.trends.improved.map((im: any) => `${im.name} ${im.direction === 'up' ? '↑' : '↓'}`).join(', ')}</div>
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
                <div style={{ ...LABS_CARD, textAlign:'center', padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:4 }}>Нет отчётов</div>
                  <div style={{ fontSize:12, color:'#fff' }}>Нажмите «Сгенерировать отчёт»</div>
                </div>
              )}
            </div>
          )}

          {/* ≡≡≡ ARCHIVE SUB-VIEW ≡≡≡ */}
          {journalSubView === 'archive' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <span style={{ fontSize: 18 }}>📦</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Архив результатов</span>
                <span style={{ fontSize: 11, color: '#fff', marginLeft: 'auto' }}>{archiveLabs.length} записей • {new Set(archiveLabs.map(l => l.code.toUpperCase())).size} тестов</span>
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
            const sysCodes = LABS_SYSTEM_GROUPS[trendSystemFilter] || [];
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
          <div style={{ padding:'12px 0' }}>
            <div style={{ ...LABS_CARD, marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, borderLeft:`3px solid ${LABS_ACCENT}`, paddingLeft:10, marginBottom:4 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>📈 Динамика маркеров ({report.trends.length})</div>
              </div>
              <div style={{ fontSize:12, color:'#fff', lineHeight:1.5 }}>{report.summary}</div>
            </div>
            {report.trends.length > 0 && (
              <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 8px', scrollbarWidth:'none', marginBottom:4 }}>
                  {(['all','significant','critical','worsened','improved'] as const).map(f => {
                    const active = trendFilter === f;
                    return (
                      <button key={f} onClick={() => setTrendFilter(f)} aria-pressed={active} style={{
                        padding:'10px 14px', borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', minHeight:44, flexShrink:0,
                        background: active ? `linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))` : 'rgba(21,38,66,0.60)',
                        color: active ? '#0a1a08' : '#fff',
                        border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                        boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                      }}>
                        {f === 'all' ? 'Все' : f === 'significant' ? 'Значимые' : f === 'critical' ? 'Критические' : f === 'worsened' ? 'Ухудшения' : 'Улучшения'}
                      </button>
                    );
                  })}
                  <button onClick={() => { setTrendSystemFilter('all'); }} style={{
                    padding:'10px 14px', borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', minHeight:44, flexShrink:0,
                    background: trendSystemFilter === 'all' ? 'var(--accent)' : 'rgba(21,38,66,0.60)',
                    color: trendSystemFilter === 'all' ? '#000' : '#fff',
                    border: trendSystemFilter === 'all' ? '1px solid var(--accent)' : '1px solid rgba(140,190,255,0.14)',
                  }}>Все системы</button>
                  {Object.entries(LABS_SYSTEM_GROUPS).slice(0, 6).map(([sys, codes]) => {
                    const info = SYSTEM_INFO_ALL[sys];
                    const active = trendSystemFilter === sys;
                    return (
                      <button key={sys} onClick={() => setTrendSystemFilter(active ? 'all' : sys)} aria-pressed={active} style={{
                        padding:'10px 14px', borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', minHeight:44, flexShrink:0,
                        background: active ? 'var(--accent)' : 'rgba(21,38,66,0.60)',
                        color: active ? '#000' : '#fff',
                        border: active ? '1px solid var(--accent)' : '1px solid rgba(140,190,255,0.14)',
                      }}>
                        {info?.icon || ''} {info?.label || sys}
                      </button>
                    );
                  })}
                  <button onClick={() => {
                    const csv = exportTrendsToCSV(report);
                    downloadCSV(csv, `lab-trends-${new Date().toISOString().slice(0,10)}.csv`);
                  }} style={{ padding:'10px 14px', borderRadius:999, border:'1px solid rgba(140,190,255,0.14)', background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', minHeight:44, flexShrink:0 }}>
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
                  }} style={{ padding:'10px 14px', borderRadius:999, border:'1px solid rgba(140,190,255,0.14)', background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', minHeight:44, flexShrink:0 }}>
                    🖨 Print
                  </button>
                </div>
              )}
            {insights.length > 0 && (
              <div style={{ marginBottom:12, display:'grid', gap:4 }}>
                {insights.map((insight, i) => (
                  <div key={i} style={{ padding:'6px 10px', borderRadius:8, background:'rgba(var(--labs-accent-rgb, 0,230,138),0.06)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.12)', fontSize:10, color:'var(--text)', lineHeight:1.4 }}>
                    {insight}
                  </div>
                ))}
              </div>
              )}
              {recommendations.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>💊 Рекомендации по коррекции</div>
                  {recommendations.map(({ trend, corrections }) => (
                    <div key={trend.code} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.16)', fontSize:11, color:'#fff', marginBottom:6, lineHeight:1.5 }}>
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
                    const palette = ['var(--labs-accent, #00e68a)','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
                    const color = palette[report.trends.indexOf(t) % palette.length];
                    const isVisible = visibleTrends.size === 0 || visibleTrends.has(t.code);
                    return (
                      <button key={t.code} onClick={() => toggleTrend(t.code)} aria-pressed={isVisible} style={{
                        padding:'8px 12px', borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', minHeight:40, flexShrink:0,
                        background: isVisible ? color + '26' : 'rgba(21,38,66,0.60)',
                        color: isVisible ? color : '#fff',
                        border: isVisible ? `1px solid ${color + '55'}` : '1px solid rgba(140,190,255,0.14)',
                        opacity: isVisible ? 1 : 0.6,
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
                      const palette = ['var(--labs-accent, #00e68a)','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
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
                            <text key={i} x={i * xStep} y={h + 14} fill="#fff" fontSize="7" textAnchor="middle">{d.slice(5)}</text>
                          ))}
                        </g>
                      );
                    })()}
                   </svg>
                    {hoveredTrendPoint && (
                     <div style={{
                        position:'fixed', left: Math.min(hoveredTrendPoint.x + 8, Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 360) - 132)), top: Math.max(8, hoveredTrendPoint.y - 32),
                        maxWidth:'70vw', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                       background:'rgba(0,0,0,0.88)', color:'#fff', padding:'6px 10px', borderRadius:8,
                       fontSize:12, fontWeight:700, pointerEvents:'none', zIndex:1000,
                       border:'1px solid rgba(255,255,255,0.15)',
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
              <div style={{ textAlign:'center', padding:30, fontSize:10, color:'#fff' }}>Загрузите 2+ анализа для сравнения</div>
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
          {/* Catalog sub-view switcher — TOP APK 44px */}
          <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 8px', scrollbarWidth:'none' }}>
            {([
              { id: 'catalog' as const, label: 'Каталог', icon: '📖' },
              { id: 'schedule' as const, label: 'График сдачи', icon: '📅' },
              { id: 'problems' as const, label: 'По проблеме', icon: '🔍' },
            ]).map(v => {
              const active = catalogView === v.id;
              return (
                <button key={v.id} onClick={() => setCatalogView(v.id)} aria-pressed={active} style={{
                  padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s', flexShrink:0, minHeight:44,
                  background: active ? `linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))` : 'rgba(21,38,66,0.60)',
                  color: active ? '#0a1a08' : '#fff',
                  border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                  boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                }}>
                  {v.icon} {v.label}
                </button>
              );
            })}
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
                  <button key={key} onClick={() => handlePhaseChange(key)} aria-pressed={selectedPhase===key} style={{
                    padding:'10px 14px', borderRadius:999, fontSize:12, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', minHeight:44,
                    background: selectedPhase===key ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(21,38,66,0.60)',
                    color: selectedPhase===key ? '#0a1a08' : '#fff',
                    border: selectedPhase===key ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                    boxShadow: selectedPhase===key ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                  }}>{label}</button>
                ))}
              </div>
              <div className="card" style={{ ...LABS_CARD, borderLeft:`3px solid ${LABS_ACCENT}` }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:6, borderLeft:`3px solid ${LABS_ACCENT}`, paddingLeft:10 }}>
                  📋 План сдачи: {PHASE_LABELS[selectedPhase]}
                </div>
                <div style={{ fontSize:12, color:'#fff', marginBottom:10, lineHeight:1.6 }}>
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
                <div style={{ display:'grid', gap:8 }}>
                  {Object.entries(labsBySystem).map(([system, codes]) => {
                    const submitted = codes.filter(c => submittedCodes.has(c.toUpperCase())).length;
                    const total = codes.length;
                    const pct = total > 0 ? Math.round(submitted/total*100) : 0;
                    return (
                      <div key={system} style={{ padding:12, borderRadius:14, border:'1px solid rgba(140,190,255,0.12)', background:'rgba(255,255,255,0.02)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background: sysColors[system]||'#6b7280', flexShrink:0 }}/>
                          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{sysLabels[system]||system}</span>
                          <span style={{ fontSize:11, color:'#fff', marginLeft:'auto', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{submitted}/{total} · {pct}%</span>
                        </div>
                        <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:pct===100?'var(--accent)':pct>50?'#eab308':'#f97316', borderRadius:999, transition:'width 0.4s' }}/>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                          {codes.map(code => {
                            const info = UCUM_MAP[code.toUpperCase()];
                            const done = submittedCodes.has(code.toUpperCase());
                            return (
                              <span key={code} style={{
                                fontSize:11, fontWeight:700, padding:'6px 10px', borderRadius:999,
                                background: done ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.12)' : 'rgba(239,68,68,0.10)',
                                color: done ? 'var(--accent)' : '#ef4444',
                                border:`1px solid ${done?'rgba(var(--labs-accent-rgb, 0,230,138),0.22)':'rgba(239,68,68,0.20)'}`,
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
                  <div style={{ marginTop:10, padding:'12px 12px', borderRadius:14, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.20)' }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:4 }}>⚠️ Не сдано ({missingLabs.length})</div>
                    <div style={{ fontSize:12, color:'#fff', lineHeight:1.6 }}>{missingLabs.slice(0,15).join(', ')}{missingLabs.length>15?` +${missingLabs.length-15}`:''}</div>
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
            <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 8px', scrollbarWidth:'none', alignItems:'center' }}>
              {(['risks', 'verification'] as const).map(v => {
                const active = risksView === v;
                return (
                  <button key={v} onClick={() => setRisksView(v)} aria-pressed={active} style={{
                    padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
                    whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s', flexShrink:0, minHeight:44,
                    background: active ? `linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))` : 'rgba(21,38,66,0.60)',
                    color: active ? '#0a1a08' : '#fff',
                    border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                    boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                  }}>
                    {v === 'risks' ? '⚠️ Риски и индексы' : '🔬 Верификация рисков'}
                  </button>
                );
              })}
            </div>
            {risksView === 'verification' ? (
              <RiskVerificationList labMap={verifLabMap} result={tzSpecResult} />
            ) : (
            <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, borderLeft:`3px solid ${LABS_ACCENT}`, paddingLeft:10, margin:'12px 0 10px' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>⚠️ Риски и индексы здоровья</div>
            </div>

            {/* Labs Score Card (TZ Pipeline) — P0 fix: все маркеры фазы (lowercase id), а не поля 1 точки */}
            <LabsScoreCard
              markers={currentLabs.map(l => ({ id: (l.code || '').toLowerCase(), value: Number(l.value) })).filter(m => m.id && isFinite(m.value))}
              weight={(linked.profile?.settings as any)?.personal?.weight || 80}
              age={(linked.profile?.settings as any)?.personal?.age || 30}
              sex={(linked.profile?.settings as any)?.personal?.sex || 'male'}
            />

            {/* Lab-Pharma Risks */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, pharma: !s.pharma }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.pharma ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🧬 Лабораторно-фармацевтические риски
              </button>
              {riskSections.pharma && (<div style={{ padding: '0 12px 12px' }}>
              {labPharmaAlerts.length > 0 ? (
                <div style={{ display:'grid', gap:8 }}>
                  {labPharmaAlerts.map((a, i) => (
                    <div key={i} style={{
                      fontSize:12, padding:'12px 12px', borderRadius:14, minHeight:64,
                      background: a.severity === 'critical' ? 'rgba(239,68,68,0.10)' : a.severity === 'high' ? 'rgba(245,158,11,0.10)' : 'rgba(21,38,66,0.60)',
                      border: a.severity === 'critical' ? '1px solid rgba(239,68,68,0.30)' : a.severity === 'high' ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(140,190,255,0.14)',
                      borderLeft: `3px solid ${a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : LABS_ACCENT}`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:13, color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#fff' }}>
                          {a.marker} {a.actualStatus === 'high' ? '↑' : a.actualStatus === 'low' ? '↓' : ''} {a.value}{a.unit}
                        </span>
                        <span style={{ fontSize:10, padding:'3px 8px', borderRadius:999, fontWeight:800, background: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#22c55e', color: a.severity === 'critical' || a.severity === 'high' ? '#fff' : '#000', flexShrink:0 }}>
                          {a.severity === 'critical' ? 'КРИТ' : a.severity === 'high' ? 'ВЫСОК' : 'МОНИТ'}
                        </span>
                      </div>
                      <div style={{ color:'#fff', fontSize:12, lineHeight:1.5 }}>{(a.drugCause || []).map((id: string) => { const p = PHARMA_DB[id]; return p?.name || id.replace(/_/g, ' '); }).join(', ')} — {a.recommendation}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Связи анализов с препаратами не обнаружены' : 'Введите анализы для расчёта рисков'}
                </div>
              )}
              </div>)}</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, indices: !s.indices }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.indices ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                📊 Композитные индексы здоровья
              </button>
              {riskSections.indices && (<div style={{ padding:'0 12px 12px' }}><div style={{ display:'grid', gap:8 }}>
                {[
                  { label: 'ASI (Анаболический синтез)', desc: 'Способность к анаболизму', val: ASI, inv: true },
                  { label: 'HMI (Гепатический метаболизм)', desc: 'Стресс печени', val: HMI, inv: false },
                  { label: 'CR (Кардиориск)', desc: 'Липиды + воспаление', val: CR, inv: false },
                ].map(item => (
                  <div key={item.label} style={{
                    padding:12, borderRadius:14, minHeight:72,
                    background: item.val !== null ? `rgba(${item.inv ? (item.val >= 70 ? '34,197,94' : item.val >= 40 ? '234,179,8' : '239,68,68') : (item.val <= 30 ? '34,197,94' : item.val <= 60 ? '234,179,8' : '239,68,68')},0.08)` : 'rgba(21,38,66,0.60)',
                    border: item.val !== null ? `1px solid rgba(${item.inv ? (item.val >= 70 ? '34,197,94' : item.val >= 40 ? '234,179,8' : '239,68,68') : (item.val <= 30 ? '34,197,94' : item.val <= 60 ? '234,179,8' : '239,68,68')},0.25)` : '1px solid rgba(140,190,255,0.14)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{item.label}</div>
                        <div style={{ fontSize:12, color:'#fff', marginTop:2, lineHeight:1.4 }}>{item.desc}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0, minWidth:64 }}>
                        {item.val !== null ? (
                          <><div style={{ fontSize:24, fontWeight:900, color: statusColor(item.val, item.inv), fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{item.val}%</div>
                            <div style={{ fontSize:11, color: statusColor(item.val, item.inv), fontWeight:800, marginTop:2 }}>{statusLabel(item.val, item.inv)}</div></>
                        ) : (
                          <div style={{ fontSize:12, color:'#fff' }}>Нет данных</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {indexEntries.length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:4 }}>
                    {indexEntries.map(d => (
                      <div key={d.key} style={{ padding:'10px 10px', borderRadius:12, background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.12)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, minHeight:48 }}>
                        <span style={{ fontSize:12, color:'#fff', fontWeight:600 }}>{d.label}</span>
                        <span style={{ fontWeight:800, fontSize:13, color: getRiskColor(d.value), minWidth:28, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{d.value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>)}</div>

            {/* System Risks */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, systems: !s.systems }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.systems ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                ⚠️ Риски по системам организма
              </button>
              {riskSections.systems && (<div style={{ padding: '0 12px 12px' }}>
              {labRisks && Object.values(labRisks.systemBreakdown).some(v => v.net > 0) ? (
                <div style={{ display:'grid', gap:8 }}>
                  {Object.entries(labRisks.systemBreakdown).filter(([_, v]) => v.net > 0).sort(([_, a], [__, b]) => b.net - a.net).map(([sys, val]) => {
                    const level = val.net <= 25 ? 'low' : val.net <= 50 ? 'medium' : val.net <= 75 ? 'high' : 'critical';
                    const lc: Record<string, { bg: string; text: string; bar: string }> = {
                      low: { bg: 'rgba(34,197,94,0.10)', text: '#22c55e', bar: '#22c55e' },
                      medium: { bg: 'rgba(234,179,8,0.10)', text: '#eab308', bar: '#eab308' },
                      high: { bg: 'rgba(249,115,22,0.10)', text: '#f97316', bar: '#f97316' },
                      critical: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', bar: '#ef4444' },
                    };
                    const c = lc[level];
                    return (
                      <div key={sys} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 12px', borderRadius:14, background: c.bg, border:`1px solid ${c.bg.replace('0.10', '0.22')}`, borderLeft:`3px solid ${c.bar}`, minHeight:56 }}>
                        <span style={{ fontSize:12, fontWeight:800, minWidth:72, color:'#fff' }}>{sysLabels[sys] || sys}</span>
                        <div style={{ flex:1, height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden' }}>
                          <div style={{ width:`${Math.min(100, val.net)}%`, height:'100%', background: c.bar, borderRadius:999, transition:'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize:14, fontWeight:900, color: c.text, minWidth:36, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{Math.round(val.net)}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Все системы в норме' : 'Введите анализы для расчёта рисков'}
                </div>
              )}
              </div>)}</div>

            {/* Abnormal Markers */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, markers: !s.markers }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.markers ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🔬 Маркеры с отклонениями
              </button>
              {riskSections.markers && (<div style={{ padding:'0 12px 12px' }}>
              {deviationCount > 0 && labRisks ? (
                <div style={{ display:'grid', gap:8 }}>
                  {labRisks.markerDeviations.map(m => {
                    const isHigh = m.deviation > 0;
                    const absDev = Math.abs(m.deviation);
                    const devLevel = absDev <= 20 ? 'low' : absDev <= 50 ? 'medium' : absDev <= 100 ? 'high' : 'critical';
                    const devColors: Record<string, { bg: string; text: string }> = {
                      low: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e' }, medium: { bg: 'rgba(234,179,8,0.08)', text: '#eab308' },
                      high: { bg: 'rgba(249,115,22,0.08)', text: '#f97316' }, critical: { bg: 'rgba(239,68,68,0.08)', text: '#ef4444' },
                    };
                    const dc = devColors[devLevel];
                    return (
                      <div key={m.code + m.value} style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 12px', borderRadius:14, background: dc.bg, border:`1px solid ${dc.bg.replace('0.08', '0.20')}`, borderLeft:`3px solid ${dc.text}`, minHeight:56 }}>
                        <span style={{ fontSize:10, color:'#fff', minWidth:52, fontWeight:700 }}>{sysLabels[m.system] || m.system}</span>
                        <span style={{ fontSize:13, fontWeight:800, flex:1, color:'#fff', minWidth:0 }}>{m.name}</span>
                        <span style={{ fontSize:10, color:'#fff', whiteSpace:'nowrap' }}>{m.lln}–{m.uln}</span>
                        <span style={{ fontSize:13, fontWeight:800, color: dc.text, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{m.value} <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, fontWeight:800, background: dc.text + '26', color: dc.text }}>{isHigh ? '↑' : '↓'}{absDev}%</span></span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Все маркеры в норме' : 'Введите анализы для просмотра отклонений'}
                </div>
              )}
              </div>)}</div>

            {/* Drugs to Normalize */}
            {deviationCount > 0 && labRisks && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                <button onClick={() => setRiskSections(s => ({ ...s, normalizeDrugs: !s.normalizeDrugs }))} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
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
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                            {drugs.map((d, i) => (
                              <span key={i} style={{ fontSize:11, padding:'6px 10px', borderRadius:999, background:'rgba(var(--labs-accent-rgb, 0,230,138),0.10)', color:LABS_ACCENT, fontWeight:800, border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)' }}>
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
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.tz ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                🧮 Риски (механизм-ориентированная модель ТЗ)
              </button>
              {riskSections.tz && (<div style={{ padding:'0 12px 12px' }}>
                {tzSpecResult ? (
                  <>
                    <div style={{ textAlign:'center', padding:'14px 12px', borderRadius:16, marginBottom:8,
                      background:'linear-gradient(135deg, rgba(var(--labs-accent-rgb, 0,230,138),0.10) 0%, rgba(var(--labs-accent-rgb, 0,230,138),0.04) 100%)',
                      border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)' }}>
                      <div style={{ fontSize:12, color:'#fff', marginBottom:6, fontWeight:700 }}>Общий риск</div>
                      <div style={{ display:'flex', justifyContent:'center', gap:12, alignItems:'center' }}>
                        <span style={{ fontSize:28, fontWeight:900, color: tzSpecResult.overallRaw < 25 ? '#22c55e' : tzSpecResult.overallRaw < 50 ? '#eab308' : '#f97316', fontVariantNumeric:'tabular-nums' }}>{tzSpecResult.overallRaw}%</span>
                        <span style={{ fontSize:18, color:'#fff' }}>→</span>
                        <span style={{ fontSize:28, fontWeight:900, color: tzSpecResult.overallAfter < 25 ? '#22c55e' : tzSpecResult.overallAfter < 50 ? '#eab308' : '#f97316', fontVariantNumeric:'tabular-nums' }}>{tzSpecResult.overallAfter}%</span>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginTop:4 }}>
                        {tzSpecResult.overallCategory} · K_protect {tzSpecResult.k_protect_overall}%
                      </div>
                      {tzSpecResult.overallVerification !== undefined && (
                        <div style={{ fontSize:11, marginTop:4, color: tzSpecResult.overallVerification >= 0.5 ? '#4ade80' : '#fbbf24', lineHeight:1.5 }}>
                          {tzSpecResult.overallVerification >= 0.5 ? '🔬' : '⚠'} Индекс риска · верифицировано анализами: {Math.round(tzSpecResult.overallVerification * 100)}% систем
                          {tzSpecResult.overallVerification < 0.5 && ' — оценка по фармакологии'}
                        </div>
                      )}
                      <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, margin:'8px 4px 0', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100, tzSpecResult.overallAfter)}%`, borderRadius:999,
                          background: tzSpecResult.overallAfter < 25 ? '#22c55e' : tzSpecResult.overallAfter < 50 ? '#eab308' : '#f97316' }} />
                      </div>
                    </div>
                    <div style={{ display:'grid', gap:8 }}>
                      {tzSpecResult.organs.map((organ: TzSpecOrganResult) => {
                        const cc = (v: number) => v < 25 ? '#22c55e' : v < 50 ? '#eab308' : v < 75 ? '#f97316' : '#ef4444';
                        return (
                          <div key={organ.id} style={{ padding:'12px 12px', borderRadius:14, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(140,190,255,0.12)', borderLeft:`3px solid ${cc(organ.afterPercent)}`, minHeight:56 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>
                                {organ.icon} {organ.name}
                                {organ.verification !== undefined && organ.verification < 0.5 && (
                                  <span style={{ color:'#fbbf24', marginLeft:4 }}>⚠</span>
                                )}
                              </span>
                              <span style={{ fontSize:13, fontWeight:900, color: cc(organ.afterPercent), fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                                {organ.rawPercent}% → {organ.afterPercent}%
                              </span>
                            </div>
                            {organ.floors && organ.floors.length > 0 && (
                              <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:2 }}>
                                {organ.floors.map((f, i) => (
                                  <div key={i} style={{ fontSize:11, color:'#fca5a5', lineHeight:1.5 }}>⚓ {f.label}</div>
                                ))}
                              </div>
                            )}
                            <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:999, marginTop:6, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(100, organ.afterPercent)}%`, background: cc(organ.afterPercent), borderRadius:999 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize:11, color:'#fff', textAlign:'center', marginTop:8 }}>
                      Из фазы «{PHASE_LABELS[selectedPhase]}» · покрытие {Math.round(tzSpecResult.d_cov * 100)}%
                    </div>
                  </>
                ) : (
                  <div style={{ ...LABS_CARD, textAlign:'center', padding:20 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{hasLabs ? 'Недостаточно данных' : 'Введите анализы в текущей фазе'}</div>
                  </div>
                )}
              </div>)}</div>

            {/* Penalty — TOP APK */}
            {anyNoLabs && (
              <div className="card" style={{ padding:'12px 14px', marginBottom:8, borderRadius:14, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.30)', borderLeft:'3px solid #ef4444' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, color:'#fff', fontWeight:800 }}>⚠️ Штраф за отсутствие анализов</span>
                  <span style={{ fontSize:14, fontWeight:900, color:'#ef4444', fontVariantNumeric:'tabular-nums' }}>×{penalty.totalMultiplier.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Required Lab Markers for MDSS + Support Calculator */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => setRiskSections(s => ({ ...s, requiredLabs: !s.requiredLabs }))} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections.requiredLabs ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                📋 Требуемые анализы (MDSS + Калькулятор поддержки)
              </button>
              {riskSections.requiredLabs && (<div style={{ padding: '0 12px 12px' }}>
                <div style={{ fontSize:11, color:'#fff', marginBottom:8, lineHeight:1.5 }}>
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
                  <div key={group.title} style={{ marginBottom:8, padding:'12px 12px', borderRadius:14, background:'rgba(21,38,66,0.45)', border:'1px solid rgba(140,190,255,0.12)', borderLeft:`3px solid ${LABS_ACCENT}` }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:6 }}>{group.icon} {group.title}</div>
                    {group.markers.map((m, i) => (
                      <div key={i} style={{ fontSize:12, color:'#fff', lineHeight:1.6, paddingLeft:8 }}>• {m}</div>
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
      {/* ─── BOTTOM TABS — TOP APK: липкая CTA-панель 52px, safe-area, nowrap ─── */}
      {mainTab === 'lab' && (
        <div className="labs-bottomtabs" style={{ position:'fixed', bottom:'calc(var(--nav-height,56px) + env(safe-area-inset-bottom,0px))', left:0, right:0, zIndex:25, display:'flex', gap:10, overflowX:'auto', padding:'12px 12px calc(12px + env(safe-area-inset-bottom,0px))', background:'linear-gradient(180deg, rgba(21,38,66,0.90), rgba(12,23,40,0.92))', backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)', borderTop:'1px solid rgba(140,190,255,0.16)', scrollbarWidth:'none', boxShadow:'0 -12px 32px rgba(0,0,0,0.40)' }}>
          {LAB_SUB_TABS.filter(t => t.id !== 'hero').map(t => {
            const active = subTab===t.id;
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)} aria-pressed={active} style={{
                flex:'0 0 auto', padding:'12px 18px', borderRadius:999, fontSize:13, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', minHeight:48,
                background: active ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(21,38,66,0.65)', color: active ? '#0a1a08' : '#fff', border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.16)',
                boxShadow: active ? '0 8px 22px rgba(var(--labs-accent-rgb, 0,230,138),0.38)' : 'none',
                display:'inline-flex', alignItems:'center', gap:7,
              }}><NativeIcon name={t.icon} size={14} /> {t.label}</button>
            );
          })}
        </div>
      )}

        {/* OCR Import — TOP APK bottom-sheet */}
      {showImport && (
         <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.70)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={backdropClick}>
          <div style={{ width:'100%', maxWidth:560, zIndex:201, background:'linear-gradient(180deg, rgba(21,38,66,0.96), rgba(12,23,40,0.96))', border:'1px solid rgba(140,190,255,0.16)', borderRadius:'22px 22px 0 0', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.60)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:999, background:'rgba(255,255,255,0.20)', margin:'10px auto 2px', flexShrink:0 }} />
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(140,190,255,0.12)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexShrink:0 }}>
              <span style={{ fontWeight:800, fontSize:15, color:'#fff', display:'inline-flex', alignItems:'center', gap:8 }}><NativeIcon name="file" size={16} /> Импорт анализов</span>
               <button onClick={cancelOcr} aria-label="Закрыть импорт" style={{ background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff', borderRadius:999, minWidth:44, minHeight:44, padding:'10px 14px', fontSize:14, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'14px 16px calc(16px + env(safe-area-inset-bottom,0px))', maxHeight:'72vh' }}>
              {ocrLoading && (
                <div style={{ textAlign:'center', padding:40 }}>
                  <div className="loading-spinner" style={{ margin:'0 auto 16px' }} />
                  <div style={{ fontSize:13, color:'#fff' }}>Распознаю документ...</div>
                </div>
              )}
              {!ocrLoading && !ocrResult && (
                <div>
                  <p style={{ fontSize:13, color:'#fff', marginBottom:12, lineHeight:1.5 }}>Загрузите PDF, фото или вставьте текст результатов анализов.</p>
                  <div style={{ display:'grid', gap:8 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding:16, borderRadius:16, border:'1px dashed rgba(140,190,255,0.25)', background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', minHeight:56 }}>
                      📄 Выбрать PDF или фото
                    </button>
                    <button onClick={() => { if (cameraInputRef.current) cameraInputRef.current.click(); }} style={{ padding:16, borderRadius:16, border:'1px dashed rgba(140,190,255,0.25)', background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', minHeight:56 }}>
                      📸 Сфотографировать
                    </button>
                    <div style={{ borderTop:'1px solid rgba(140,190,255,0.12)', paddingTop:10 }}>
                      <textarea
                        placeholder="Вставьте текст анализов..."
                        rows={5}
                        style={{ width:'100%', padding:'12px 14px', borderRadius:14, background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', color:'#fff', fontSize:13, boxSizing:'border-box', resize:'vertical', marginBottom:8, minHeight:96 }}
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
                      }} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(var(--labs-accent-rgb, 0,230,138),0.1)', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>
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
                    <span style={{ fontSize: 10, color: '#fff' }}>{Math.round(ocrResult.confidence * 100)}%</span>
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
                      const color = delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : '#fff';
                      return <span style={{ fontSize:11, color, fontWeight:700, marginLeft:6, whiteSpace:'nowrap' }}>{arrow} {existing.value} → {lab.value} {pct !== null ? `(${pct > 0 ? '+' : ''}${pct}%)` : ''}</span>;
                    })() : null;
                    return (
                      <React.Fragment key={lab.code}>
                        <button onClick={() => toggleLabSelection(lab.code)} aria-pressed={isSelected} style={{
                          display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, width:'100%', padding:'12px 12px', marginBottom:8, borderRadius:14, cursor:'pointer', minHeight:60,
                          background: isSelected ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.12)' : 'rgba(21,38,66,0.60)',
                          border: isSelected ? '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : '1px solid rgba(140,190,255,0.14)',
                          borderLeft:`3px solid ${isSelected ? LABS_ACCENT : 'rgba(140,190,255,0.20)'}`,
                        }}>
                          <span style={{ fontWeight:800, fontSize:13, color:'#fff', flex:1, textAlign:'left', minWidth:0 }}>{isSelected ? '✓ ' : '○ '}{lab.name || lab.code}</span>
                          <span style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'flex-end', flexShrink:0 }}>
                            {compareLabel}
                            <span style={{ fontSize:10, padding:'3px 8px', borderRadius:999, fontWeight:800, background:confidenceColor + '22', color:confidenceColor, border:`1px solid ${confidenceColor}30` }}>
                              {confidencePct}%
                            </span>
                            <span style={{ fontWeight:900, fontSize:14, color: lab.isAbnormal ? '#ef4444' : 'var(--accent)', fontVariantNumeric:'tabular-nums' }}>{lab.value} {lab.unit}{ratioLabel}</span>
                          </span>
                        </button>
                        {lab.raw && !/^(?:error|warning|invalid pdf|pdf parsing)/i.test(lab.raw.trim()) && (
                          <div style={{ margin:'-4px 4px 8px', fontSize:11, color:'#fff', lineHeight:1.5 }}>
                            {lab.refLow !== undefined || lab.refHigh !== undefined ? `Норма: ${lab.refLow ?? '—'}–${lab.refHigh ?? '—'} · ` : ''}Источник: {lab.raw}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <button onClick={confirmOcrLabs} disabled={selectedLabs.size === 0} style={{
                    width:'100%', marginTop:12, padding:'14px', minHeight:52,
                    background: selectedLabs.size > 0 ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(255,255,255,0.06)',
                    color: selectedLabs.size > 0 ? '#0a1a08' : '#fff',
                    border:'none', borderRadius:14, fontWeight:800, fontSize:14, cursor: selectedLabs.size > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: selectedLabs.size > 0 ? '0 8px 24px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                  }}>✓ Сохранить {selectedLabs.size} показателей</button>
                  {ocrResult.labs.length === 0 && (
                    <button onClick={() => { setOcrResult(null); setSelectedLabs(new Set()); }} style={{
                      width:'100%', marginTop:8, padding:'14px', minHeight:52,
                      background:'rgba(21,38,66,0.60)', color:'#fff',
                      border:'1px solid rgba(140,190,255,0.14)', borderRadius:14, fontWeight:800, fontSize:13, cursor:'pointer',
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
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.70)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setShowLabInput(false)}>
          <div style={{ width:'100%', maxWidth:560, zIndex:201, background:'linear-gradient(180deg, rgba(21,38,66,0.96), rgba(12,23,40,0.96))', border:'1px solid rgba(140,190,255,0.16)', borderRadius:'22px 22px 0 0', boxShadow:'0 24px 64px rgba(0,0,0,0.60)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', maxHeight:'92dvh', overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:999, background:'rgba(255,255,255,0.20)', margin:'10px auto 4px', flexShrink:0 }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'0 18px 12px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:36, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(var(--labs-accent-rgb, 0,230,138),0.14)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.22)', fontSize:17 }}>🧪</span>
                <span style={{ fontWeight:800, fontSize:15, color:'#fff' }}>Ввести результат</span>
              </div>
              <button onClick={() => setShowLabInput(false)} aria-label="Закрыть" style={{ background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff', borderRadius:999, minWidth:44, minHeight:44, padding:'10px 14px', fontSize:14, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'0 18px 12px', WebkitOverflowScrolling:'touch' as any, minHeight:0 }}>
            {(() => { const info = UCUM_MAP[inputCode.toUpperCase()]; return info ? (
              <div style={{ fontSize:12, color:'#fff', marginBottom:10, padding:'10px 12px', background:'rgba(var(--labs-accent-rgb, 0,230,138),0.08)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.18)', borderRadius:12, lineHeight:1.5 }}>
                {info.name} • Норма: {info.lln}–{info.uln} {info.prefUnit}
              </div>
            ) : null; })()}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Код маркера</label>
                <input value={inputCode} onChange={e => setInputCode(e.target.value)} onFocus={e => { try { e.currentTarget.scrollIntoView({ block:'center' }); } catch {} }} placeholder="ALT" style={{ width:'100%', padding:'12px 12px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', borderRadius:12, color:'#fff', fontSize:16, minHeight:48, boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Значение</label>
                <input type="number" value={inputValue || ''} onChange={e => setInputValue(e.target.value)} onFocus={e => { try { e.currentTarget.scrollIntoView({ block:'center' }); } catch {} }} placeholder="40" style={{ width:'100%', padding:'12px 12px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', borderRadius:12, color:'#fff', fontSize:16, minHeight:48, boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Единица</label>
                <input value={inputUnit} onChange={e => setInputUnit(e.target.value)} onFocus={e => { try { e.currentTarget.scrollIntoView({ block:'center' }); } catch {} }} placeholder="U/L" style={{ width:'100%', padding:'12px 12px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', borderRadius:12, color:'#fff', fontSize:16, minHeight:48, boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Дата</label>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} onFocus={e => { try { e.currentTarget.scrollIntoView({ block:'center' }); } catch {} }} style={{ width:'100%', padding:'12px 12px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', borderRadius:12, color:'#fff', fontSize:16, minHeight:48, boxSizing:'border-box' }} />
              </div>
            </div>
            {addError && <div style={{ fontSize:12, color:'#ef4444', textAlign:'center', marginTop:10, fontWeight:700 }}>{addError}</div>}
            </div>
            <div style={{ flexShrink:0, padding:'12px 18px calc(18px + env(safe-area-inset-bottom,0px))', borderTop:'1px solid rgba(140,190,255,0.12)', background:'linear-gradient(0deg, rgba(12,23,40,0.98), rgba(12,23,40,0.92))' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
              <button onClick={() => setShowLabInput(false)} style={{
                padding:'14px', borderRadius:14, border:'1px solid rgba(140,190,255,0.14)', minHeight:52,
                background:'rgba(21,38,66,0.60)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer',
              }}>✕ Отмена</button>
              <button onClick={() => { setAddError(''); addLab(); }} style={{
                padding:'14px', borderRadius:14, border:'none', minHeight:52,
                background:'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))', color:'#0a1a08', fontWeight:800, fontSize:14, cursor:'pointer',
                boxShadow:'0 8px 24px rgba(var(--labs-accent-rgb, 0,230,138),0.35)',
              }}>✓ Сохранить</button>
            </div>
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
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 12px', marginBottom:8, borderRadius:14, background:'linear-gradient(180deg, rgba(21,38,66,0.60), rgba(12,23,40,0.60))', border:'1px solid rgba(140,190,255,0.12)', borderLeft:`3px solid ${color}`, fontSize:11, minHeight:64, boxShadow:'0 6px 18px rgba(0,0,0,0.30)' }}>
      <span style={{ fontSize:16, minWidth:24, textAlign:'center', color }}>{icon}</span>
      {pts.length >= 2 && (
        <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ flexShrink:0, opacity:0.9 }}>
          <polyline fill="none" stroke={color} strokeWidth="2" points={sparkPath} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:13, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trend.name}</div>
        <div style={{ fontSize:11, color:'#fff', marginTop:2 }}>
          {trend.previousDate && <span>{trend.previousDate.slice(5)}: {trend.previousValue}</span>}
          {trend.previousDate && <span> → </span>}
          <span>{trend.currentDate.slice(5)}: {trend.currentValue} {trend.unit}</span>
          {trend.absoluteChange !== null && (
            <span style={{ marginLeft:6, color, fontWeight:800 }}>
              {trend.absoluteChange > 0 ? '+' : ''}{trend.absoluteChange.toFixed(1)}
              {trend.percentChange !== null && <span style={{ fontSize:10 }}> ({trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(0)}%)</span>}
            </span>
          )}
          {trend.predictedValue !== undefined && (
            <span style={{ marginLeft:6, color:'#a855f7', fontWeight:700, fontSize:10 }}>
              → {trend.predictedValue} {trend.unit} ({Math.round((trend.predictionConfidence || 0) * 100)}%)
            </span>
          )}
        </div>
      </div>
      {trend.refLow !== undefined && trend.refHigh !== undefined && (
        <span style={{ fontSize:10, color:'#fff', whiteSpace:'nowrap', fontWeight:600 }}>Норма: {trend.refLow}–{trend.refHigh}</span>
      )}
    </div>
  );
}
