import React, { useState, useMemo, useCallback, useRef } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { interpretLabs, computeHOMA_IR, type LabCompositeResult } from '../../engines/lab-analysis.engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { db } from '../../core/db';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsInvestigations } from './LabsScreen_parts/LabsInvestigations';
import { processUploadedFile, saveParsedLabs, type ParsedLabValue, type OCRResult } from '../../core/ocr-engine';
import { getProfile, updateProfile } from '../../core/profile-manager';

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
  course_bridge_course: 'Курс+Мост',
};

const PROFILE_PHASE_TO_LABS_PHASE: Record<string, string> = {
  baseline: 'baseline',
  course: 'on_cycle',
  'course-bridge-course': 'course_bridge_course',
  bridge: 'bridge',
  pct: 'pct',
  post_pct: 'post_pct',
  fertility: 'post_pct',
};

const sysLabels: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кровь',
  reproductive: 'Репродуктивная', musculoskeletal: 'Мышечная', metabolic: 'Метаболизм',
  other: 'Прочее',
};

const LAB_SYSTEM_GROUPS: Record<string, string[]> = {
  hepatic: ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB','LDH','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT'],
  renal: ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR','K','NA','CA','P','MG'],
  endocrine: ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1','TOTAL_T3','TOTAL_T4','TG_AB','TPO_AB','THYROGLOBULIN'],
  hematologic: ['HGB','HCT','PLT','WBC','RBC','MCV','MCH','MCHC','RDW','IRON','TRANSFERRIN','TIBC','IRON_SAT','FERRITIN'],
  cardio: ['LDL','HDL','TG','APOB','APOA1','NON_HDL','LP_A','CRP','hsCRP','FIBRINOGEN','D_DIMER'],
  metabolic: ['GLUCOSE','GLU','HBA1C','INSULIN','HOMA_IR','VITD','VITAMIN_D','CALCIDIOL','B12','VITAMIN_B12','FOLATE'],
  reproductive: ['PSA','DHEA_S','AMH','INHIBIN_B','PROGESTERONE','DHT','FT','TESTOSTERONE','ESTRADIOL'],
  neuro: ['HOMOCYSTEINE','BDNF','SEROTONIN','DOPAMINE','GABA','VITAMIN_B12','FOLATE'],
};

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
  { id: 'investigations', label: 'Обследования', icon: '🩺' },
  { id: 'risks', label: 'Риски и индексы', icon: '⚠️' },
];

type MainLabTab = 'hero' | 'lab' | 'investigations' | 'risks';

const LAB_SUB_TABS: { id: LabSubTab; label: string; icon: string }[] = [
  { id: 'current', label: 'Текущие', icon: '🔬' },
  { id: 'archive', label: 'Архив', icon: '📦' },
  { id: 'catalog', label: 'Каталог', icon: '📖' },
  { id: 'chart', label: 'График', icon: '📈' },
];

type LabSubTab = 'current' | 'archive' | 'catalog' | 'chart';

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const profilePhase = linked.profile?.settings?.phase || '';
  const initialLabsPhase = PROFILE_PHASE_TO_LABS_PHASE[profilePhase] || 'baseline';
  const [mainTab, setMainTab] = useState<MainLabTab>('hero');
  const [subTab, setSubTab] = useState<LabSubTab>('current');
  const [globalNoLabs, setGlobalNoLabs] = useState(getGlobalNoLabs());
  const [noLabsSystems, setNoLabsSystemsState] = useState<string[]>(getNoLabsSystems());
  const [selectedPhase, setSelectedPhase] = useState(initialLabsPhase);
  const [showLabInput, setShowLabInput] = useState(false);
  const [showNewLabsBatch, setShowNewLabsBatch] = useState(false);
  const [batchValues, setBatchValues] = useState<Record<string, string>>({});
  const [inputCode, setInputCode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [, setTick] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [chartMarkerSearch, setChartMarkerSearch] = useState('');
  const [chartSelectedCode, setChartSelectedCode] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDetail, setCatalogDetail] = useState<{ code: string; name: string; unit: string; uln: number; lln: number; system: string; description: string } | null>(null);

  const hasLabs = linked.labs && linked.labs.length > 0;
  const labs: LabPoint[] = linked.labs || [];

  const handlePhaseChange = (phase: string) => {
    setSelectedPhase(phase);
    try {
      const p = getProfile();
      p.settings.phase = phase === 'on_cycle' ? 'course' : phase === 'course_bridge_course' ? 'course-bridge-course' : phase;
      updateProfile(p);
      notifyDataChange();
    } catch {}
  };

  const requiredLabs = useMemo(() => {
    return (REQUIRED_LABS_PER_PHASE as Record<string, string[]>)[selectedPhase] || [];
  }, [selectedPhase]);

  const handleNewLabs = useCallback(async () => {
    const initial: Record<string, string> = {};
    for (const code of requiredLabs) {
      const existing = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
      initial[code] = existing ? String(existing.value) : '';
    }
    setBatchValues(initial);
    setShowNewLabsBatch(true);
  }, [requiredLabs, labs]);

  const handleBatchSave = useCallback(async () => {
    try {
      await db.init();
      let saved = 0;
      for (const [code, valStr] of Object.entries(batchValues)) {
        const val = parseFloat(valStr);
        if (!valStr || isNaN(val)) continue;
        const info = UCUM_MAP[code.toUpperCase()];
        const lab: LabPoint = {
          id: crypto.randomUUID(),
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
      setShowNewLabsBatch(false);
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
    return new Set(labs.map(l => l.code.toUpperCase()));
  }, [labs]);

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

  const catalogEntries = useMemo(() => {
    const map: Record<string, { code: string; name: string; unit: string; uln: number; lln: number; system: string; description: string }> = {};
    for (const [sys, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
      for (const code of codes) {
        if (map[code]) continue;
        const info = UCUM_MAP[code];
        if (info) {
          map[code] = {
            code, name: info.name, unit: info.prefUnit, uln: info.uln, lln: info.lln, system: sys,
            description: CATALOG_LAB_DESCRIPTIONS[code] || '',
          };
        }
      }
    }
    for (const code of Object.keys(UCUM_MAP)) {
      if (map[code]) continue;
      const info = UCUM_MAP[code];
      map[code] = {
        code, name: info.name, unit: info.prefUnit, uln: info.uln, lln: info.lln, system: 'other',
        description: CATALOG_LAB_DESCRIPTIONS[code] || '',
      };
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCatalogEntries = useMemo(() => {
    if (!catalogSearch) return catalogEntries;
    const q = catalogSearch.toLowerCase();
    return catalogEntries.filter(e => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
  }, [catalogEntries, catalogSearch]);

  const groupedCatalog = useMemo(() => {
    const g: Record<string, typeof filteredCatalogEntries> = {};
    for (const e of filteredCatalogEntries) {
      if (!g[e.system]) g[e.system] = [];
      g[e.system].push(e);
    }
    return g;
  }, [filteredCatalogEntries]);

  const chartData = useMemo(() => {
    if (!chartSelectedCode) return [];
    return labs.filter(l => l.code.toUpperCase() === chartSelectedCode.toUpperCase())
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [labs, chartSelectedCode]);

  const penalty = useMemo(() => {
    return calculatePenaltyCoefficients(selectedPhase, labs, [], 1, linked.course, globalNoLabs);
  }, [selectedPhase, labs, linked.course, globalNoLabs]);

  const labRisks = useMemo<{ overallNet: number; systemBreakdown: Record<string, { raw: number; net: number }>; markerDeviations: { code: string; name: string; value: number; uln: number; lln: number; deviation: number; system: string }[] } | null>(() => {
    if (!hasLabs) return null;
    const labData = labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
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
    for (const lab of labs) {
      const ref = UCUM_MAP[lab.code];
      if (!ref) continue;
      const coeff = ref.coeff || 1;
      const norm = lab.value * coeff;
      let deviation = 0;
      if (norm > ref.uln) deviation = (norm - ref.uln) / ref.uln;
      else if (norm < ref.lln) deviation = -((ref.lln - norm) / ref.lln);
      if (Math.abs(deviation) > 0.01) {
        let sys = 'other';
        for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
          if (codes.includes(lab.code.toUpperCase())) { sys = s; break; }
        }
        markerDeviations.push({
          code: lab.code, name: ref.name || lab.code, value: lab.value,
          uln: ref.uln, lln: ref.lln,
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
    return computeLabIndexDetails(labs);
  }, [hasLabs, labs]);

  const labAnalysisResult = useMemo(() => {
    if (!hasLabs) return null;
    return interpretLabs(labs);
  }, [hasLabs, labs]);

  const labPharmaAlerts = useMemo(() => {
    if (!hasLabs || linked.course.length === 0) return [];
    return analyzeLabDrugCorrelation(labs, linked.course, linked.profile?.settings?.phase || 'on_cycle');
  }, [hasLabs, labs, linked.course]);

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
    if (!inputCode || isNaN(val)) return;
    const info = UCUM_MAP[inputCode.toUpperCase()];
    const lab: LabPoint = {
      id: crypto.randomUUID(),
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
      setTick(t => t + 1);
    } catch (e) { console.error(e); }
  }, [inputCode, inputValue, inputUnit, inputDate, selectedPhase]);

  const handleFileUpload = useCallback(async (file: File) => {
    setOcrLoading(true);
    setOcrResult(null);
    setSelectedLabs(new Set());
    try {
      const result = await processUploadedFile(file);
      setOcrResult(result);
      if (result.labs.length > 0) setSelectedLabs(new Set(result.labs.map(l => l.code)));
    } catch (e: any) {
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['' + (e?.message || String(e))] });
    }
    setOcrLoading(false);
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
    <div className="screen labs" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ─── HERO PAGE ─── */}
      {mainTab === 'hero' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 80px' }}>
          {/* Hero section */}
          <div style={{ textAlign: 'center', padding: '40px 0 30px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧪</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: '0 0 6px' }}>Лаборатория</h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
              Контролируйте своё здоровье — анализы, обследования и оценка рисков
            </p>
          </div>

          {/* 3 cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { id: 'lab', icon: '🔬', title: 'Анализы', desc: 'Ввод, просмотр и динамика лабораторных показателей. Каталог маркеров и графики.', color: 'var(--accent)', bg: 'rgba(0,230,138,0.06)', border: 'rgba(0,230,138,0.2)' },
              { id: 'investigations', icon: '🩺', title: 'Обследования', desc: 'Плановые чекапы, инструментальная диагностика и частота прохождения.', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)' },
              { id: 'risks', icon: '⚠️', title: 'Риски и индексы', desc: 'Агрегированные риски по системам, композитные индексы здоровья и отклонения.', color: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)' },
            ].map(card => (
              <button key={card.id} onClick={() => setMainTab(card.id as MainLabTab)} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '18px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: card.bg, border: `1px solid ${card.border}`, color: 'var(--text)',
                transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: card.color + '18', fontSize: 26,
                }}>
                  {card.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: card.color }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>{card.desc}</div>
                </div>
                <span style={{ color: card.color, fontSize: 18, opacity: 0.6 }}>→</span>
              </button>
            ))}
          </div>

          {/* Quick stats */}
          {linked.labs && linked.labs.length > 0 && (
            <div className="card" style={{ marginTop: 16, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>📊 Краткая сводка</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{linked.labs.length}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Всего записей</div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{new Set(linked.labs.map(l => l.code)).size}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Уникальных тестов</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MAIN TAB BAR (only when not on hero) ─── */}
      {mainTab !== 'hero' && (
        <div style={{ display: 'flex', gap: 2, padding: '8px 12px 0', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setMainTab('hero')} style={{
            padding: '8px 6px', cursor: 'pointer', fontSize: 16, transition: 'all 0.2s',
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>←</button>
          {MAIN_LAB_TABS.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)} style={{
              flex: 1, padding: '10px 4px', cursor: 'pointer', transition: 'all 0.2s',
              color: mainTab === t.id ? 'var(--accent)' : 'var(--text-dim)',
              border: 'none', borderBottom: `2px solid ${mainTab === t.id ? 'var(--accent)' : 'transparent'}`,
              fontWeight: mainTab === t.id ? 700 : 400, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'transparent',
            }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT (only when not on hero) ─── */}
      {mainTab !== 'hero' && (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 80px' }}>

      {/* ≡≡≡ LAB SUB-TABS (only when mainTab === 'lab') ≡≡≡ */}
      {mainTab === 'lab' && (
        <>
          {/* Sub-tab bar */}
          <div style={{ display: 'flex', gap: 2, padding: '6px 0 2px', flexShrink: 0 }}>
            {LAB_SUB_TABS.map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)} style={{
                flex: 1, padding: '7px 4px', cursor: 'pointer', transition: 'all 0.2s',
                color: subTab === t.id ? 'var(--accent)' : 'var(--text-dim)',
                border: 'none', borderBottom: `2px solid ${subTab === t.id ? 'var(--accent)' : 'transparent'}`,
                fontWeight: subTab === t.id ? 700 : 400, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent',
              }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

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

          {/* Import buttons — PDF + Фото */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <button onClick={() => { setShowImport(true); setTimeout(() => fileInputRef.current?.click(), 100); }} style={{
              flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>📄 Загрузить PDF</button>
            <button onClick={() => { setShowImport(true); setTimeout(() => cameraInputRef.current?.click(), 100); }} style={{
              flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>📸 Сфотографировать</button>
          </div>

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
                    const latest = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
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
        </div>
      )}

      {/* ≡≡≡ ARCHIVE TAB ≡≡≡ */}
      {subTab === 'archive' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Архив результатов</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{labs.length} записей • {new Set(labs.map(l => l.code.toUpperCase())).size} тестов</span>
          </div>

          {/* LabsResults — красивые карточки */}
          <LabsResults labs={labs} />
        </div>
      )}

      {/* ≡≡≡ CATALOG TAB — system-chip-based ≡≡≡ */}
      {subTab === 'catalog' && (() => {
        const systemOrder = ['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'];
        const sysIcons: Record<string, string> = {
          hepatic: '🫁', renal: '🫘', endocrine: '🧬', hematologic: '🩸',
          cardio: '❤️', metabolic: '⚡', reproductive: '🧫', neuro: '🧠', other: '📋',
        };
        const [catFilterSys, setCatFilterSys] = useState('all');
        const filteredBySys = catFilterSys === 'all' ? filteredCatalogEntries : filteredCatalogEntries.filter(e => e.system === catFilterSys);
        const groupedFiltered = useMemo(() => {
          const g: Record<string, typeof filteredCatalogEntries> = {};
          for (const e of filteredBySys) {
            if (!g[e.system]) g[e.system] = [];
            g[e.system].push(e);
          }
          return g;
        }, [filteredBySys]);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <span style={{ fontSize: 18 }}>📖</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Каталог маркеров</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{catalogEntries.length}</span>
            </div>

            {/* System filter chips (replaces text search) */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none', paddingBottom: 4 }}>
              <button onClick={() => setCatFilterSys('all')} style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: catFilterSys === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: catFilterSys === 'all' ? '#000' : 'var(--text-dim)',
                border: `1px solid ${catFilterSys === 'all' ? 'var(--accent)' : 'var(--border)'}`,
              }}>Все</button>
              {systemOrder.map(sys => (
                <button key={sys} onClick={() => setCatFilterSys(sys)} style={{
                  padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                  background: catFilterSys === sys ? sysColors[sys] + '22' : 'var(--bg-secondary)',
                  color: catFilterSys === sys ? sysColors[sys] : 'var(--text-dim)',
                  border: `1px solid ${catFilterSys === sys ? sysColors[sys] : 'var(--border)'}`,
                }}>
                  {sysIcons[sys] || ''} {sysLabels[sys] || sys}
                </button>
              ))}
            </div>

            {/* Systems */}
            {systemOrder.map(sys => {
              const entries = groupedFiltered[sys];
              if (!entries || entries.length === 0) return null;
              return (
                <div key={sys} className="card" style={{ marginBottom: 10, padding: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{sysIcons[sys] || '📋'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{sysLabels[sys] || sys}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{entries.length} маркеров</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {entries.map(entry => (
                      <button key={entry.code} onClick={() => setCatalogDetail(entry)} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text)', fontSize: 11, transition: 'all 0.15s',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: sysColors[sys] + '18', color: sysColors[sys], fontWeight: 700, fontSize: 10, flexShrink: 0,
                        }}>
                          {entry.code.slice(0, 3)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 2 }}>{entry.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--accent)' }}>{entry.lln}–{entry.uln} {entry.unit}</div>
                        </div>
                        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredBySys.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
                Нет маркеров в выбранной системе
              </div>
            )}

            {/* Detail Modal */}
            {catalogDetail && (() => {
              const info = UCUM_MAP[catalogDetail.code];
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={() => setCatalogDetail(null)}>
                  <div style={{ width: '100%', maxWidth: 420, zIndex: 201, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '16px 18px 24px', boxShadow: '0 -12px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: sysColors[catalogDetail.system] + '20', color: sysColors[catalogDetail.system], fontWeight: 700, fontSize: 12,
                        }}>
                          {catalogDetail.code.slice(0, 3)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{catalogDetail.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{catalogDetail.code}</div>
                        </div>
                      </div>
                      <button onClick={() => setCatalogDetail(null)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Система</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{sysLabels[catalogDetail.system] || catalogDetail.system}</div>
                      </div>
                      <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Референс</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{catalogDetail.lln}–{catalogDetail.uln}</div>
                      </div>
                      <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Единица</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{catalogDetail.unit || '—'}</div>
                      </div>
                      {info && info.coeff !== 1 && (
                        <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Коэффициент</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{info.coeff}</div>
                        </div>
                      )}
                    </div>
                    {catalogDetail.description && (
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                        {catalogDetail.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ≡≡≡ CHART TAB — chip-based marker selector ≡≡≡ */}
      {subTab === 'chart' && (() => {
        const ref = chartSelectedCode ? UCUM_MAP[chartSelectedCode] : null;
        const vals = chartData.map(d => d.value);
        const minD = vals.length > 0 ? Math.min(...vals, ref ? ref.lln : 0) : 0;
        const maxD = vals.length > 0 ? Math.max(...vals, ref ? ref.uln : 100) : 100;
        const pad = (maxD - minD) * 0.2 || 10;
        const chartMin = Math.max(0, minD - pad);
        const chartMax = maxD + pad;
        const chartRange = chartMax - chartMin;
        const n = chartData.length;
        const barW = Math.max(28, Math.min(60, (320 - 50) / (n || 1)));
        const chartW = Math.max(320, n * barW + 60);
        const chartH = 240;
        const xBase = 50;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <span style={{ fontSize: 18 }}>📈</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Графики маркеров</span>
            </div>

            {/* System filter chips (replaces text search) */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none', paddingBottom: 4 }}>
              <button onClick={() => setChartMarkerSearch('')} style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: !chartMarkerSearch ? 'var(--accent)' : 'var(--bg-secondary)',
                color: !chartMarkerSearch ? '#000' : 'var(--text-dim)',
                border: `1px solid ${!chartMarkerSearch ? 'var(--accent)' : 'var(--border)'}`,
              }}>Все маркеры</button>
              {['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'].map(sys => {
                const hasAny = uniqMarkers.some(m => {
                  for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
                    if (s === sys && codes.includes(m.code)) return true;
                  }
                  return false;
                });
                if (!hasAny) return null;
                return (
                  <button key={sys} onClick={() => {
                    const first = uniqMarkers.find(m => {
                      const c = LAB_SYSTEM_GROUPS[sys];
                      return c && c.includes(m.code);
                    });
                    setChartMarkerSearch(first?.code || '');
                    setChartSelectedCode(first?.code || '');
                  }} style={{
                    padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-dim)',
                    border: '1px solid var(--border)',
                  }}>
                    {sysLabels[sys] || sys}
                  </button>
                );
              })}
            </div>

            {/* Marker grid */}
            {!chartSelectedCode && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                {(chartMarkerSearch
                  ? uniqMarkers.filter(m => m.code.includes(chartMarkerSearch.toUpperCase()) || m.name.toLowerCase().includes(chartMarkerSearch.toLowerCase()))
                  : uniqMarkers
                ).map(m => (
                  <button key={m.code} onClick={() => { setChartSelectedCode(m.code); setChartMarkerSearch(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: 11, transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: 'rgba(0,230,138,0.12)', color: 'var(--accent)', fontSize: 9, fontWeight: 700,
                    }}>
                      {m.code.slice(0, 2)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{m.code}</div>
                    </div>
                  </button>
                ))}
                {uniqMarkers.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 12 }}>
                    Введите анализы во вкладке «Текущие»
                  </div>
                )}
              </div>
            )}

            {chartSelectedCode ? (chartData.length > 0 ? (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{ref?.name || chartSelectedCode}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{chartData.length} записей • Реф: {ref?.lln}–{ref?.uln} {ref?.prefUnit || ''}</div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: chartData[chartData.length - 1].value > (ref?.uln || 999) ? 'rgba(239,68,68,0.12)' :
                      chartData[chartData.length - 1].value < (ref?.lln || 0) ? 'rgba(249,115,22,0.12)' : 'rgba(0,230,138,0.1)',
                    color: chartData[chartData.length - 1].value > (ref?.uln || 999) ? '#ef4444' :
                      chartData[chartData.length - 1].value < (ref?.lln || 0) ? '#f97316' : 'var(--accent)',
                  }}>
                    Последнее: {chartData[chartData.length - 1].value}
                  </div>
                </div>

                {/* Chart */}
                <svg viewBox={`0 0 ${chartW} ${chartH + 40}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0,230,138,0.08)" />
                      <stop offset="100%" stopColor="rgba(0,230,138,0.01)" />
                    </linearGradient>
                  </defs>
                  <rect x={xBase} y={0} width={chartW - xBase - 10} height={chartH} fill="url(#chartBg)" rx={6} />
                  {[0, 0.25, 0.5, 0.75, 1].map(f => {
                    const y = chartH - f * chartH;
                    return (
                      <g key={f}>
                        <line x1={xBase} y1={y} x2={chartW - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                        <text x={xBase - 5} y={y + 3} fill="var(--text-dim)" fontSize={8} textAnchor="end">{(chartMin + f * chartRange).toFixed(1)}</text>
                      </g>
                    );
                  })}
                  {ref && (
                    <line x1={xBase} y1={chartH - ((ref.uln - chartMin) / chartRange) * chartH} x2={chartW - 10} y2={chartH - ((ref.uln - chartMin) / chartRange) * chartH}
                      stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />
                  )}
                  {ref && (
                    <line x1={xBase} y1={chartH - ((ref.lln - chartMin) / chartRange) * chartH} x2={chartW - 10} y2={chartH - ((ref.lln - chartMin) / chartRange) * chartH}
                      stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />
                  )}
                  {/* Area fill under the line */}
                  {chartData.length > 0 && (
                    <path d={`M${xBase + barW / 2},${chartH} ${chartData.map((d, i) => {
                      const x = xBase + i * barW + barW / 2;
                      const barH = Math.max(0, ((d.value - chartMin) / chartRange) * chartH);
                      const y = chartH - barH;
                      return `L${x},${y}`;
                    }).join(' ')} L${xBase + (chartData.length - 1) * barW + barW / 2},${chartH} Z`}
                      fill="rgba(0,230,138,0.06)" />
                  )}
                  {/* Bars with gradient */}
                  {chartData.map((d, i) => {
                    const x = xBase + i * barW;
                    const barH = Math.max(0, ((d.value - chartMin) / chartRange) * chartH);
                    const y = chartH - barH;
                    const color = ref ? (d.value > ref.uln ? '#ef4444' : d.value < ref.lln ? '#f97316' : 'var(--accent)') : 'var(--accent)';
                    return (
                      <g key={`${d.date}_${i}`}>
                        <rect x={x + 2} y={y} width={Math.max(4, barW - 4)} height={barH} fill={color} rx={3} opacity={0.85} />
                        <text x={x + barW / 2} y={y - 5} fill={color} fontSize={8} textAnchor="middle" fontWeight={700}>{d.value}</text>
                        <text x={x + barW / 2} y={chartH + 12} fill="var(--text-dim)" fontSize={7} textAnchor="middle">{d.date.slice(5)}</text>
                        {d.phase && (
                          <rect x={x + barW / 2 - 6} y={chartH + 18} width={12} height={12} rx={3} fill={color + '22'}>
                            <text x={x + barW / 2} y={chartH + 27} fill={color} fontSize={6} textAnchor="middle" fontWeight={700}>
                              {(PHASE_LABELS[d.phase] || d.phase).slice(0, 2)}
                            </text>
                          </rect>
                        )}
                      </g>
                    );
                  })}
                  <line x1={xBase} y1={chartH} x2={chartW - 10} y2={chartH} stroke="var(--border)" strokeWidth={1} />
                </svg>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9, color: 'var(--text-dim)', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#ef4444', verticalAlign: 'middle', marginRight: 4 }} /> Верхняя граница</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#22c55e', verticalAlign: 'middle', marginRight: 4 }} /> Нижняя граница</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: 'var(--accent)', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> Норма</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: '#ef4444', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> Высокий</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: '#f97316', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> Низкий</span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: 20 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>Нет данных для этого маркера</div>
              </div>
            )) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: 20 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                  Выберите маркер для просмотра динамики
                </div>
              </div>
            )}
          </div>
        );
      })()}

        </>
      )}

      {/* ≡≡≡ INVESTIGATIONS TAB ≡≡≡ */}
      {mainTab === 'investigations' && (
        <div style={{ paddingTop: 8 }}>
          <LabsInvestigations />
        </div>
      )}

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
        return (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, padding: '10px 0' }}>⚠️ Риски и индексы здоровья</div>

            {/* Lab-Pharma Risks */}
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>🧬 Лабораторно-фармацевтические риски</div>
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
                      <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>{a.drugCause?.join(', ')} — {a.recommendation}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                  {hasLabs ? 'Связи анализов с препаратами не обнаружены' : 'Введите анализы для расчёта рисков'}
                </div>
              )}
            </div>

            {/* Composite Indices */}
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>📊 Композитные индексы здоровья</div>
              <div style={{ display: 'grid', gap: 6 }}>
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
            </div>

            {/* System Risks */}
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>⚠️ Риски по системам организма</div>
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
            </div>

            {/* Abnormal Markers */}
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>🔬 Маркеры с отклонениями</div>
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
            </div>

            {/* Penalty */}
            {anyNoLabs && (
              <div className="card" style={{ padding: 8, marginBottom: 8, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>⚠️ Штраф за отсутствие анализов</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444' }}>×{penalty.totalMultiplier.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      </div>
      )}

      {/* OCR Import Modal — full screen to bottom */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={() => { setShowImport(false); setOcrResult(null); }}>
          <div style={{ width: '100%', maxWidth: 480, zIndex: 201, background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 48px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>📄 Импорт анализов</span>
              <button onClick={() => { setShowImport(false); setOcrResult(null); }} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>✕</button>
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
                  {ocrResult.labs.map(lab => {
                    const isSelected = selectedLabs.has(lab.code);
                    return (
                      <button key={lab.code} onClick={() => toggleLabSelection(lab.code)} style={{
                        display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                        background: isSelected ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{isSelected ? '✓ ' : '○ '}{lab.name || lab.code}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: lab.isAbnormal ? '#ef4444' : 'var(--accent)' }}>{lab.value} {lab.unit}</span>
                      </button>
                    );
                  })}
                  <button onClick={confirmOcrLabs} disabled={selectedLabs.size === 0} style={{
                    width: '100%', marginTop: 12, padding: 12,
                    background: selectedLabs.size > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: selectedLabs.size > 0 ? '#000' : 'var(--text-dim)',
                    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: selectedLabs.size > 0 ? 'pointer' : 'not-allowed',
                  }}>✓ Сохранить {selectedLabs.size} показателей</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lab Input Modal — full screen to bottom */}
      {showLabInput && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }} onClick={() => setShowLabInput(false)}>
          <div style={{ width: '100%', maxWidth: 420, zIndex: 201, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '16px 18px 24px', boxShadow: '0 -12px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
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
                <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="40" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowLabInput(false)} style={{
                padding: 10, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>✕ Отмена</button>
              <button onClick={addLab} style={{
                padding: 10, borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>✓ Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Labs Input Modal — full screen to bottom */}
      {showNewLabsBatch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={() => setShowNewLabsBatch(false)}>
          <div style={{ width: '100%', maxWidth: 480, zIndex: 201, background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 48px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>📋 Новые анализы — {PHASE_LABELS[selectedPhase]}</span>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Заполните значения для фазы {PHASE_LABELS[selectedPhase].toLowerCase()}</div>
              </div>
              <button onClick={() => setShowNewLabsBatch(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {requiredLabs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 12 }}>
                  Нет анализов для выбранной фазы
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(() => {
                    const bySystem: Record<string, { code: string; name: string }[]> = {};
                    for (const code of requiredLabs) {
                      let sys = 'other';
                      for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
                        if (codes.includes(code.toUpperCase())) { sys = s; break; }
                      }
                      const info = UCUM_MAP[code.toUpperCase()];
                      if (!bySystem[sys]) bySystem[sys] = [];
                      bySystem[sys].push({ code, name: info?.name || code });
                    }
                    const sysOrder = ['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'];
                    return sysOrder.flatMap(sys => {
                      const items = bySystem[sys];
                      if (!items || items.length === 0) return [];
                      return [
                        <div key={`hdr-${sys}`} style={{ fontSize: 10, fontWeight: 700, color: sysColors[sys] || '#6b7280', padding: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sysColors[sys] || '#6b7280' }} />
                          {sysLabels[sys] || sys}
                        </div>,
                        ...items.map(item => (
                          <div key={item.code} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{item.code}</div>
                            </div>
                            <input type="number" step="any" value={batchValues[item.code] ?? ''}
                              onChange={e => setBatchValues(prev => ({ ...prev, [item.code]: e.target.value }))}
                              placeholder="Значение"
                              style={{ width: 100, padding: '6px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, textAlign: 'right' }} />
                          </div>
                        ))
                      ];
                    });
                  })()}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowNewLabsBatch(false); setBatchValues({}); }} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>✕ Отмена</button>
              <button onClick={handleBatchSave} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>✓ Сохранить все</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
