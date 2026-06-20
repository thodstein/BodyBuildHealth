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
  { id: 'reports', label: 'Отчёты', icon: '📄' },
];

type MainLabTab = 'hero' | 'lab' | 'investigations' | 'risks' | 'reports';

const LAB_SUB_TABS: { id: LabSubTab; label: string; icon: string }[] = [
  { id: 'current', label: 'Текущие', icon: '🔬' },
  { id: 'archive', label: 'Архив', icon: '📦' },
  { id: 'catalog', label: 'Каталог', icon: '📖' },
  { id: 'chart', label: 'Динамика', icon: '📈' },
  { id: 'schedule', label: 'График сдачи', icon: '📅' },
];

type LabSubTab = 'hero' | 'current' | 'archive' | 'catalog' | 'chart' | 'schedule';

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
  const [showNewLabsInline, setShowNewLabsInline] = useState(false);
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
  const [chartSelectedCodes, setChartSelectedCodes] = useState<Set<string>>(new Set());
  const [chartFilterSys, setChartFilterSys] = useState('all');
  const [chartGridOpen, setChartGridOpen] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDetail, setCatalogDetail] = useState<{ code: string; name: string; unit: string; uln: number; lln: number; system: string; description: string } | null>(null);
  const [catFilterSys, setCatFilterSys] = useState('all');
  const [riskSections, setRiskSections] = useState<Record<string, boolean>>({
    pharma: true, indices: true, systems: true, markers: true,
  });
  const [addError, setAddError] = useState('');
  const [labReportGenerated, setLabReportGenerated] = useState(false);
  const [labArchive, setLabArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_lab_reports') || '[]'); } catch { return []; }
  });

  const uid = () => { try { return crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`; } catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; } };

  const labs: LabPoint[] = linked.labs || [];
  const currentLabs = useMemo(() => labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase)), [labs, selectedPhase]);
  const archiveLabs = useMemo(() => labs.filter(l => l.archived || (l.phase && l.phase !== selectedPhase)), [labs, selectedPhase]);
  const hasLabs = currentLabs && currentLabs.length > 0;

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

  const filteredCatalogBySys = useMemo(() => {
    return catFilterSys === 'all' ? catalogEntries : catalogEntries.filter(e => e.system === catFilterSys);
  }, [catalogEntries, catFilterSys]);

  const groupedCatalog = useMemo(() => {
    const g: Record<string, typeof filteredCatalogEntries> = {};
    for (const e of filteredCatalogBySys) {
      if (!g[e.system]) g[e.system] = [];
      g[e.system].push(e);
    }
    return g;
  }, [filteredCatalogBySys]);

  const chartData = useMemo(() => {
    if (chartSelectedCodes.size === 0) return [];
    const codes = Array.from(chartSelectedCodes).map(c => c.toUpperCase());
    return labs.filter(l => codes.includes(l.code.toUpperCase()))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [labs, chartSelectedCodes]);

  const penalty = useMemo(() => {
    return calculatePenaltyCoefficients(selectedPhase, currentLabs, [], 1, linked.course, globalNoLabs);
  }, [selectedPhase, currentLabs, linked.course, globalNoLabs]);

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
    return computeLabIndexDetails(currentLabs);
  }, [hasLabs, currentLabs]);

  const labAnalysisResult = useMemo(() => {
    if (!hasLabs) return null;
    return interpretLabs(currentLabs);
  }, [hasLabs, currentLabs]);

  const labPharmaAlerts = useMemo(() => {
    if (!hasLabs || linked.course.length === 0) return [];
    return analyzeLabDrugCorrelation(currentLabs, linked.course, linked.profile?.settings?.phase || 'on_cycle');
  }, [hasLabs, currentLabs, linked.course]);

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
    <div className="screen labs" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>

      {/* ─── HERO PAGE ─── */}
      {mainTab === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/lab-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Лаборатория</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              Контролируйте своё здоровье — анализы и обследования
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { id: 'lab', icon: '🔬', title: 'Анализы', desc: 'Ввод, просмотр и динамика лабораторных показателей. Каталог маркеров и графики.', color: 'var(--accent)' },
                { id: 'investigations', icon: '🩺', title: 'Обследования', desc: 'Плановые чекапы, инструментальная диагностика и частота прохождения.', color: '#3b82f6' },
                { id: 'risks', icon: '⚠️', title: 'Риски и индексы', desc: 'Агрегированные риски по системам, композитные индексы здоровья и отклонения.', color: '#f97316' },
              ].map(card => (
                <button key={card.id} onClick={() => setMainTab(card.id as MainLabTab)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(20,22,30,0.35)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: card.color + '18', fontSize: 20,
                  }}>
                    {card.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR (only when not on hero) ─── */}
      {mainTab !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setMainTab('hero')} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600,
          }}>← Назад</button>
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT (only when not on hero) ─── */}
      {mainTab !== 'hero' && (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 70px' }}>

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
            }}>📸 Загрузить JPG</button>
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

        </div>
      )}

      {/* ≡≡≡ ARCHIVE TAB ≡≡≡ */}
      {subTab === 'archive' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Архив результатов</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{archiveLabs.length} записей • {new Set(archiveLabs.map(l => l.code.toUpperCase())).size} тестов</span>
          </div>

          {/* LabsResults — красивые карточки */}
          <LabsResults labs={archiveLabs} />
        </div>
      )}

      {/* ≡≡≡ CATALOG TAB — system-chip-based ≡≡≡ */}
      {subTab === 'catalog' && (() => {
        const systemOrder = ['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'];
        const sysIcons: Record<string, string> = {
          hepatic: '🫁', renal: '🫘', endocrine: '🧬', hematologic: '🩸',
          cardio: '❤️', metabolic: '⚡', reproductive: '🧫', neuro: '🧠', other: '📋',
        };
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <span style={{ fontSize: 18 }}>📖</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Каталог маркеров</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{catalogEntries.length}</span>
            </div>

            {/* System filter chips */}
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
              const entries = groupedCatalog[sys];
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
            {catalogEntries.length > 0 && Object.keys(groupedCatalog).length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
                Нет маркеров в выбранной системе
              </div>
            )}

            {/* Detail Modal */}
            {catalogDetail && (() => {
              const info = UCUM_MAP[catalogDetail.code];
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => setCatalogDetail(null)}>
                  <div style={{ width: '100%', maxWidth: 420, zIndex: 201, background: 'var(--bg)', borderRadius: 20, padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
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

      {/* ≡≡≡ CHART TAB — multi-marker selector ≡≡≡ */}
      {subTab === 'chart' && (() => {
        const selCodes = Array.from(chartSelectedCodes);
        const chartPalette = ['var(--accent)','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#14b8a6','#ec4899'];
        // Group labs by code for multi-marker rendering
        const seriesByCode: Record<string, LabPoint[]> = {};
        if (selCodes.length > 0) {
          for (const code of selCodes) {
            seriesByCode[code] = labs.filter(l => l.code.toUpperCase() === code.toUpperCase()).sort((a,b) => a.date.localeCompare(b.date));
          }
        }
        // All unique dates from all series
        const allDatesSet = new Set<string>();
        Object.values(seriesByCode).forEach(pts => pts.forEach(p => allDatesSet.add(p.date)));
        const allDates = Array.from(allDatesSet).sort();
        // Compute global chart bounds
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <span style={{ fontSize: 18 }}>📈</span>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Графики маркеров</span>
              {hasSelection && <span style={{ fontSize: 9, color: 'var(--accent)' }}>{selCodes.length} выбрано</span>}
              <button onClick={() => setChartGridOpen(g => !g)} style={{
                marginLeft: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{chartGridOpen ? '▲ Скрыть' : '▼ Маркеры'}</button>
            </div>

            {/* System filter chips + marker grid (collapsible) */}
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

            {/* Marker grid — always visible for multi-select */}
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
            {/* Chart area */}
            {hasSelection ? (
              <div className="card" style={{ padding: 12 }}>
                {/* Legend */}
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
                {/* SVG Chart */}
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
                  {/* One bar group per date */}
                  {allDates.map((date, di) => {
                    const x = xBase + di * barW;
                    const groupW = Math.max(6, barW - 4);
                    const perBarW = selCodes.length > 1 ? groupW / selCodes.length : groupW;
                    return (
                      <g key={date}>
                        {/* Date label */}
                        <text x={x + barW / 2} y={chartH + 12} fill="var(--text-dim)" fontSize={7} textAnchor="middle">{date.slice(5)}</text>
                        {/* Bars per code */}
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
                {/* Clear selection */}
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

        </>)}
      {/* ≡≡≡ SCHEDULE TAB — график сдачи анализов по фазам ≡≡≡ */}
      {subTab === 'schedule' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 0' }}>
            <span style={{ fontSize:18 }}>📅</span>
            <span style={{ fontSize:15, fontWeight:700 }}>График сдачи анализов</span>
          </div>
          {/* Phase selector */}
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
          {/* Schedule info */}
          <div className="card" style={{ marginBottom:10, padding:12, border:'1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>
              📋 План сдачи: {PHASE_LABELS[selectedPhase]}
            </div>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8, lineHeight:1.5 }}>
              {(() => {
                const phases: Record<string,string> = {
                  baseline:'Перед началом курса — полный базовый скрининг (45 маркеров)',
                  on_cycle:'Каждые 4 недели на курсе — контроль печени, липидов, гормонов (32 маркера)',
                  bridge:'Между курсами — восстановительный мониторинг (17 маркеров)',
                  pct:'Послекурсовая терапия — контроль восстановления оси HPG (19 маркеров)',
                  post_pct:'Через 4-6 недель после ПКТ — финальная проверка (24 маркера)',
                  course_bridge_course:'Между курсами — расширенный контроль (20 маркеров)',
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
                      <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>{a.drugCause?.join(', ')} — {a.recommendation}</div>
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

      {/* ≡≡≡ LAB REPORTS TAB ≡≡≡ */}
      {mainTab === 'reports' && (() => {
        const saveArchive = (report: any) => {
          const updated = [report, ...labArchive].slice(0, 20);
          setLabArchive(updated);
          try { localStorage.setItem('he_lab_reports', JSON.stringify(updated)); } catch {}
        };

        const generateLabReport = () => {
          const labsData = labs || [];
          const report = {
            id: Date.now().toString(),
            date: new Date().toISOString().slice(0, 10),
            generatedAt: new Date().toISOString(),
            labs: labsData.map((l: LabPoint) => ({
              code: l.code, name: l.name || l.code, value: l.value, unit: l.unit,
              ref: UCUM_MAP[l.code] ? `${UCUM_MAP[l.code].lln}–${UCUM_MAP[l.code].uln}` : '—',
              system: Object.entries(LAB_SYSTEM_GROUPS).find(([_,codes]) => codes.includes(l.code))?.[0] || 'other',
              date: l.date,
            })),
            deviations: labRisks?.markerDeviations || [],
            phase: selectedPhase,
            totalMarkers: labs.length,
            abnormalCount: deviationCount,
            timestamp: Date.now(),
          };
          saveArchive(report);
          setLabReportGenerated(true);
        };

        return (
          <div style={{ padding:'0 12px 80px' }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>📄 Отчёты по лаборатории</h3>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Полный отчёт по анализам, отклонениям и динамике</p>

            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              <button onClick={generateLabReport} style={{
                padding:'8px 16px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
                background:'var(--accent)', color:'#000', border:'none', flex:1,
              }}>📄 Сгенерировать отчёт</button>
              <button onClick={() => { try { localStorage.removeItem('he_lab_reports'); setLabArchive([]); setLabReportGenerated(false); } catch {} }}
                style={{ padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:11,
                  background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                🗑 Очистить архив
              </button>
            </div>

            {/* Current report */}
            {labReportGenerated && (
              <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <h4 style={{ margin:0, fontSize:12, fontWeight:700, color:'#00e68a' }}>✅ Отчёт сгенерирован</h4>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{new Date().toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
                  <b>Фаза:</b> {PHASE_LABELS[selectedPhase] || selectedPhase}<br/>
                  <b>Всего маркеров:</b> {labs.length} (из них с отклонениями: {deviationCount})<br/>
                  <b>Систем:</b> {labRisks ? Object.keys(labRisks.systemBreakdown||{}).length : 0} с риском<br/>
                </div>
                {/* Detailed table */}
                <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:2 }}>
                  {labs.map((l: LabPoint,i: number) => {
                    const info = UCUM_MAP[l.code];
                    const dev = labRisks?.markerDeviations?.find(d => d.code === l.code);
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:6, background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9 }}>
                        <span style={{ flex:1, fontWeight:600 }}>{l.name || l.code}</span>
                        <span style={{ color:'rgba(255,255,255,0.5)', marginRight:8 }}>{info ? `${info.lln}–${info.uln}` : '—'}</span>
                        <span style={{ fontWeight:700, color: dev ? '#ef4444' : '#22c55e' }}>{l.value} {l.unit}</span>
                        {dev && <span style={{ color:'#ef4444', marginLeft:4, fontSize:8 }}>{dev.deviation > 0 ? '↑' : '↓'}{Math.abs(dev.deviation)}%</span>}
                        <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginLeft:6 }}>{l.date}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', textAlign:'center', marginTop:8 }}>
                  Отчёт автоматически сохранён в архив. Доступен в Профиле → Отчёты.
                </div>
              </div>
            )}

            {/* Archive */}
            {labArchive.length > 0 && (
              <div>
                <h4 style={{ fontSize:12, fontWeight:700, color:'#fff', margin:'0 0 8px' }}>
                  📦 Архив отчётов ({labArchive.length})
                </h4>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {labArchive.map((r: any) => (
                    <div key={r.id} style={{
                      borderRadius:10, padding:10, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>Отчёт от {r.date}</span>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{r.totalMarkers} маркеров, {r.abnormalCount} откл.</span>
                      </div>
                      <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                        {(r.deviations || []).slice(0, 5).map((d: any, di: number) => (
                          <span key={di} style={{ fontSize:8, padding:'1px 6px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>
                            {d.name} {d.deviation > 0 ? '↑' : '↓'}{Math.abs(d.deviation)}%
                          </span>
                        ))}
                        {r.deviations?.length > 5 && (
                          <span style={{ fontSize:8, padding:'1px 6px', color:'rgba(255,255,255,0.4)' }}>
                            +{r.deviations.length - 5} ещё
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!labReportGenerated && labArchive.length === 0 && (
              <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
                Нажмите «Сгенерировать отчёт» для создания полного отчёта по анализам
              </div>
            )}
          </div>
        );
      })()}

      {/* OCR Import Modal — centered */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setShowImport(false); setOcrResult(null); }}>
          <div style={{ width: '100%', maxWidth: 480, zIndex: 201, background: 'var(--bg)', borderRadius: 20, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
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
