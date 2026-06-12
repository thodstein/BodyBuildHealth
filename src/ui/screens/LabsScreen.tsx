import React, { useState, useMemo, useCallback, useRef } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { interpretLabs, computeHOMA_IR, type LabCompositeResult } from '../../engines/lab-analysis.engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { quickParse, parseLabResults } from '../../engines/biomarker-regex-engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { db } from '../../core/db';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsInvestigations } from './LabsScreen_parts/LabsInvestigations';
import { processUploadedFile, saveParsedLabs, type ParsedLabValue, type OCRResult } from '../../core/ocr-engine';
import { SYSTEM_MECHANISMS } from '../../core/system-mechanisms';
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

// Map profile phase names to REQUIRED_LABS_PER_PHASE keys
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
  cardio: 'Сердце', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кровь',
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
  'HOMAIR': 'HOMA-IR. Инсулин × Глюкоза / 22.5. >2.7 — инсулинорезистентность.',
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
  'INR': 'Международное нормализованное отношение. Контроль свёртываемости.',
  'APTT': 'Активированное частичное тромбопластиновое время. Скрининг свёртывания.',
  'PROG': 'Прогестерон. Стероидный гормон, предшественник кортизола и андрогенов.',
  'FT': 'Свободный тестостерон. Биологически активная фракция тестостерона.',
  'DHT': 'Дигидротестостерон. Мощный андроген, образуется из Т под действием 5α-редуктазы.',
};

const LAB_ICONS: Record<string, string> = {
  'risks-indices': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  schedule: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`,
  catalog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>`,
  investigations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M8 11h6"/><path d="M11 8v6"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
};
type LabSubTab = 'chart' | 'archive' | 'schedule' | 'catalog' | 'investigations' | 'risks-indices';
const LAB_NAV_CARDS: { id: LabSubTab; label: string; desc: string }[] = [
  { id: 'archive', label: 'Архив', desc: 'Просмотр и анализ показателей, история сдачи' },
  { id: 'chart', label: 'Графики', desc: 'Динамика маркеров по датам' },
  { id: 'schedule', label: 'График', desc: 'Календарь сдачи анализов по фазам' },
  { id: 'catalog', label: 'Каталог', desc: 'Справочник маркеров и референсных значений' },
  { id: 'investigations', label: 'Обследования', desc: 'Дополнительные инструментальные исследования' },
  { id: 'risks-indices', label: 'Риски и индексы', desc: 'Расчёт рисков и композитных индексов' },
];

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const profilePhase = linked.profile?.settings?.phase || '';
  const initialLabsPhase = PROFILE_PHASE_TO_LABS_PHASE[profilePhase] || 'baseline';
  const [view, setView] = useState<'main' | 'detail'>('main');
  const [tab, setTab] = useState<LabSubTab>('archive');
  const [globalNoLabs, setGlobalNoLabs] = useState(getGlobalNoLabs());
  const [noLabsSystems, setNoLabsSystemsState] = useState<string[]>(getNoLabsSystems());
  const [selectedPhase, setSelectedPhase] = useState(initialLabsPhase);
  const [showLabInput, setShowLabInput] = useState(false);
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

  // Save phase to profile when user changes it
  const handlePhaseChange = (phase: string) => {
    setSelectedPhase(phase);
    // Also update profile so phase syncs across screens
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

  // Lab risks — compute contributions per marker for detailed display
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

    // Per-marker deviations
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
        // Find which system this marker belongs to
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

  const indexEntries = useMemo(() => {
    return Object.entries(labIndexDetails).map(([key, detail]) => ({
      key, label: detail.label, value: Math.round(detail.value * 100),
      interpretation: detail.interpretation,
    }));
  }, [labIndexDetails]);

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

  const goToSub = (subTab: typeof tab) => {
    setTab(subTab);
    setView('detail');
  };

  const goBack = () => setView('main');

  return (
    <div className="screen labs" style={{ padding: view === 'main' ? 0 : undefined, overflow: view === 'main' ? 'hidden' : undefined, height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ≡≡≡ MAIN VIEW: HERO + CARDS ≡≡≡ */}
      {view === 'main' && (
        <>
          <div style={{ position: 'relative', width: '100%', height: '38vh', minHeight: 200, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/hero-image.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, var(--bg) 0%, transparent 100%)', pointerEvents: 'none' }} />
          </div>

          <div style={{ padding: '8px 12px 16px', position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, textAlign: 'center' }}>
              {hasLabs ? `${labs.length} показателей • фаза: ${PHASE_LABELS[selectedPhase] || selectedPhase}` : 'Нет данных анализов'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {LAB_NAV_CARDS.map(card => (
                <div key={card.id} onClick={() => goToSub(card.id)} style={{
                  position: 'relative', borderRadius: 18, padding: '16px 12px', cursor: 'pointer',
                  transition: 'all 0.35s cubic-bezier(0.22, 0.68, 0, 1)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(200,245,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(200,245,96,0.7)', flexShrink: 0,
                  }} dangerouslySetInnerHTML={{ __html: LAB_ICONS[card.id] }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#FFFFFF', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.3)', lineHeight: 1.3, fontWeight: 400 }}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>


          </div>
        </>
      )}

      {/* ≡≡≡ DETAIL VIEW ≡≡≡ */}
      {view === 'detail' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {/* Back button + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)' }}>
            <button onClick={goBack} style={{
              width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>←</button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{LAB_NAV_CARDS.find(c => c.id === tab)?.label || tab}</span>
          </div>

      {/* ≡≡≡ ARCHIVE TAB (results + history) ≡≡≡ */}
      {tab === 'archive' && (
        <div>
          {/* Phase selector (archive only) */}
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 8, scrollbarWidth: 'none' }}>
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => handlePhaseChange(key)} style={{
                padding: '5px 9px', borderRadius: 14, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
                background: selectedPhase === key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedPhase === key ? '#000' : 'var(--text-dim)',
                border: `1px solid ${selectedPhase === key ? 'var(--accent)' : 'var(--border)'}`,
                flexShrink: 0,
              }}>
                {label}
              </button>
            ))}
          </div>
          {/* Summary stat */}
          <div className="card" style={{ marginBottom: 8, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Всего записей: {labs.length}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Тестов: {new Set(labs.map(l => l.code.toUpperCase())).size}</span>
            </div>
          </div>

          {/* Penalty card — always visible */}
          <div className="card" style={{ marginBottom: 8, padding: 10, background: anyNoLabs ? 'rgba(239,68,68,0.08)' : 'var(--glass-bg)', borderColor: anyNoLabs ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)' }}>
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

          {/* Import buttons — PDF + Фото (без Вручную) */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <button onClick={() => { setShowImport(true); setTimeout(() => fileInputRef.current?.click(), 100); }} style={{
              flex: 1, padding: 7, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>📄 PDF</button>
            <button onClick={() => { setShowImport(true); setTimeout(() => cameraInputRef.current?.click(), 100); }} style={{
              flex: 1, padding: 7, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>📸 Фото</button>
          </div>

          {/* Required labs progress */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{PHASE_LABELS[selectedPhase]}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444' }}>
                {submittedCount}/{requiredLabs.length}
              </span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
            {Object.entries(labsBySystem).map(([system, codes]) => (
              <div key={system} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>{sysLabels[system] || system}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {codes.map(code => {
                    const info = UCUM_MAP[code.toUpperCase()];
                    const isSubmitted = submittedCodes.has(code.toUpperCase());
                    const latest = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
                    const isHigh = latest && info ? (latest.value * (info.coeff || 1)) > info.uln : false;
                    const isLow = latest && info ? (latest.value * (info.coeff || 1)) < info.lln : false;
                    return (
                      <button key={code} onClick={() => { setInputCode(code); setInputUnit(info?.prefUnit || ''); setShowLabInput(true); }} style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                        background: isSubmitted ? (isHigh ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.1)') : 'var(--bg-secondary)',
                        border: `1px solid ${isSubmitted ? (isHigh ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(249,115,22,0.3)' : 'rgba(0,230,138,0.2)') : 'var(--border)'}`,
                        color: isSubmitted ? (isHigh ? '#ef4444' : isLow ? '#f97316' : 'var(--accent)') : 'var(--text-dim)',
                        fontWeight: isSubmitted ? 600 : 400,
                      }}>
                        {isSubmitted ? (isHigh ? '↑' : isLow ? '↓' : '✓') : '○'} {info?.name || code}
                        {latest && <span style={{ marginLeft: 2, fontWeight: 700 }}>{latest.value}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missingLabs.length > 0 && missingLabs.length < requiredLabs.length && (
              <div style={{ marginTop: 4, padding: '3px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                Не сдано: {missingLabs.slice(0, 6).join(', ')}{missingLabs.length > 6 ? ` +${missingLabs.length - 6}` : ''}
              </div>
            )}
          </div>

          {/* Entered results */}
          <LabsResults labs={labs} />
        </div>
      )}

      {/* ≡≡≡ CHART TAB ≡≡≡ */}
      {tab === 'chart' && (() => {
        const ref = chartSelectedCode ? UCUM_MAP[chartSelectedCode] : null;
        const vals = chartData.map(d => d.value);
        const minD = vals.length > 0 ? Math.min(...vals, ref ? ref.lln : 0) : 0;
        const maxD = vals.length > 0 ? Math.max(...vals, ref ? ref.uln : 100) : 100;
        const pad = (maxD - minD) * 0.15 || 5;
        const chartMin = Math.max(0, minD - pad);
        const chartMax = maxD + pad;
        const chartRange = chartMax - chartMin;
        const n = chartData.length;
        const barW = Math.max(20, Math.min(55, (300 - 50) / (n || 1)));
        const chartW = Math.max(300, n * barW + 55);
        const chartH = 200;
        const xBase = 45;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
            <div style={{ fontSize: 16, fontWeight: 700, padding: '8px 0', flexShrink: 0 }}>Графики маркеров</div>
            <div style={{ position: 'relative', marginBottom: 8, flexShrink: 0 }}>
              <input value={chartMarkerSearch} onChange={e => setChartMarkerSearch(e.target.value)}
                placeholder="🔍 Поиск маркера..."
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              {chartMarkerSearch && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', marginTop: 2 }}>
                  {uniqMarkers.filter(m => m.code.includes(chartMarkerSearch.toUpperCase()) || m.name.toLowerCase().includes(chartMarkerSearch.toLowerCase())).map(m => (
                    <button key={m.code} onClick={() => { setChartSelectedCode(m.code); setChartMarkerSearch(''); }} style={{
                      display: 'block', width: '100%', padding: '6px 10px', fontSize: 12, textAlign: 'left', cursor: 'pointer',
                      background: chartSelectedCode === m.code ? 'rgba(0,230,138,0.1)' : 'transparent',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text)',
                    }}>{m.name} <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>({m.code})</span></button>
                  ))}
                  {uniqMarkers.filter(m => m.code.includes(chartMarkerSearch.toUpperCase()) || m.name.toLowerCase().includes(chartMarkerSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>Нет совпадений</div>
                  )}
                </div>
              )}
            </div>
            {chartSelectedCode ? (chartData.length > 0 ? (
              <div className="card" style={{ flex: 1, padding: 10, overflow: 'auto', minHeight: 200 }}>
                <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                  {ref?.name || chartSelectedCode} — <span style={{ color: 'var(--accent)' }}>{chartData.length} записей</span>
                </div>
                <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(f => { const y = chartH - f * chartH; return (
                    <g key={f}>
                      <line x1={xBase} y1={y} x2={chartW - 10} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
                      <text x={xBase - 4} y={y + 3} fill="var(--text-dim)" fontSize={8} textAnchor="end">{(chartMin + f * chartRange).toFixed(1)}</text>
                    </g>
                  );})}
                  {ref && (<>
                    <line x1={xBase} y1={chartH - ((ref.uln - chartMin) / chartRange) * chartH} x2={chartW - 10} y2={chartH - ((ref.uln - chartMin) / chartRange) * chartH} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={chartW - 10} y={chartH - ((ref.uln - chartMin) / chartRange) * chartH - 3} fill="#ef4444" fontSize={7} textAnchor="end">ULN {ref.uln}{ref.prefUnit ? ' ' + ref.prefUnit : ''}</text>
                  </>)}
                  {ref && (<>
                    <line x1={xBase} y1={chartH - ((ref.lln - chartMin) / chartRange) * chartH} x2={chartW - 10} y2={chartH - ((ref.lln - chartMin) / chartRange) * chartH} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={chartW - 10} y={chartH - ((ref.lln - chartMin) / chartRange) * chartH - 3} fill="#22c55e" fontSize={7} textAnchor="end">LLN {ref.lln}{ref.prefUnit ? ' ' + ref.prefUnit : ''}</text>
                  </>)}
                  {chartData.map((d, i) => {
                    const x = xBase + i * barW;
                    const barH = Math.max(0, ((d.value - chartMin) / chartRange) * chartH);
                    const y = chartH - barH;
                    const color = ref ? (d.value > ref.uln ? '#ef4444' : d.value < ref.lln ? '#f97316' : 'var(--accent)') : 'var(--accent)';
                    return (
                      <g key={`${d.date}_${i}`}>
                        <rect x={x + 1} y={y} width={Math.max(3, barW - 2)} height={barH} fill={color} rx={2} opacity={0.85} />
                        <text x={x + barW / 2} y={y - 3} fill={color} fontSize={7} textAnchor="middle" fontWeight={600}>{d.value}</text>
                        <text x={x + barW / 2} y={chartH + 10} fill="var(--text-dim)" fontSize={6} textAnchor="middle">{d.date.slice(5)}</text>
                        {d.phase && <text x={x + barW / 2} y={chartH + 20} fill="var(--accent)" fontSize={5} textAnchor="middle">{(PHASE_LABELS[d.phase] || d.phase)[0]}</text>}
                      </g>
                    );
                  })}
                  <line x1={xBase} y1={chartH} x2={chartW - 10} y2={chartH} stroke="var(--border)" strokeWidth={1} />
                </svg>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 2, background: '#ef4444', verticalAlign: 'middle', marginRight: 4 }} /> ULN</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 2, background: '#22c55e', verticalAlign: 'middle', marginRight: 4 }} /> LLN</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: 'var(--accent)', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> В норме</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: '#ef4444', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> Выше нормы</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 8, background: '#f97316', verticalAlign: 'middle', marginRight: 4, borderRadius: 2 }} /> Ниже нормы</span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>Нет данных для этого маркера</div>
              </div>
            )) : (
              <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>Выберите маркер для просмотра динамики</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ≡≡≡ SCHEDULE TAB ≡≡≡ */}
      {tab === 'schedule' && (
        <div>
          <LabsSchedule />
        </div>
      )}

      {/* ≡≡≡ INVESTIGATIONS TAB ≡≡≡ */}
      {tab === 'investigations' && (
        <div>
          <LabsInvestigations />
        </div>
      )}

      {/* ≡≡≡ CATALOG TAB ≡≡≡ */}
      {tab === 'catalog' && (() => {
        const systemOrder = ['hepatic','renal','endocrine','hematologic','cardio','metabolic','reproductive','neuro','other'];
        return (
          <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: 16, fontWeight: 700, padding: '8px 0', flexShrink: 0 }}>Каталог маркеров</div>
            <div style={{ position: 'relative', marginBottom: 8, flexShrink: 0 }}>
              <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                placeholder="🔍 Поиск маркера по названию или коду..."
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
              {systemOrder.map(sys => {
                const entries = groupedCatalog[sys];
                if (!entries || entries.length === 0) return null;
                return (
                  <div key={sys} className="card" style={{ marginBottom: 8, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                      {sysLabels[sys] || sys} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>({entries.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {entries.map(entry => (
                        <button key={entry.code} onClick={() => setCatalogDetail(entry)} style={{
                          padding: '6px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                          color: 'var(--text)', fontSize: 11, minWidth: 140, flex: '1 0 auto', maxWidth: '100%',
                          transition: 'all 0.15s',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{entry.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--accent)' }}>
                            {entry.lln}–{entry.uln} {entry.unit}
                          </div>
                          {entry.description && (
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {entry.description}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredCatalogEntries.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
                  Нет маркеров по запросу «{catalogSearch}»
                </div>
              )}
            </div>

            {/* Detail Modal */}
            {catalogDetail && (() => {
              const info = UCUM_MAP[catalogDetail.code];
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCatalogDetail(null)}>
                  <div style={{ width: '92%', maxWidth: 400, zIndex: 201, background: 'var(--bg)', borderRadius: 16, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{catalogDetail.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{catalogDetail.code}</div>
                      </div>
                      <button onClick={() => setCatalogDetail(null)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-dim)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Система</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{sysLabels[catalogDetail.system] || catalogDetail.system}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Референс</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{catalogDetail.lln} – {catalogDetail.uln} {catalogDetail.unit}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Единица</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{catalogDetail.unit || '—'}</span>
                      </div>
                      {info && info.coeff !== 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Коэффициент</span>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{info.coeff}</span>
                        </div>
                      )}
                    </div>
                    {catalogDetail.description && (
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
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

      {/* ≡≡≡ RISKS & INDICES TAB — redesigned: 4 sections, no phase selector ≡≡≡ */}
      {tab === 'risks-indices' && (
        <div style={{ height: 'calc(100vh - 110px)', overflowY: 'auto', paddingBottom: 24 }}>

          {/* ─── Section 1: Lab-Pharma Risks ─── */}
          <div className="card" style={{ padding: 10, marginTop: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              🧬 Лабораторно-фармацевтические риски
            </h4>
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
                      <span style={{
                        fontSize: 8, padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                        background: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#22c55e',
                        color: a.severity === 'critical' || a.severity === 'high' ? '#fff' : '#000',
                      }}>
                        {a.severity === 'critical' ? 'КРИТ' : a.severity === 'high' ? 'ВЫСОК' : 'МОНИТ'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>
                      {a.drugCause?.join(', ')} — {a.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                {hasLabs
                  ? 'Связи анализов с препаратами не обнаружены'
                  : 'Введите анализы для расчёта лабораторно-фармацевтических рисков'}
              </div>
            )}
          </div>

          {/* ─── Section 2: Composite Indices ─── */}
          <div className="card" style={{ padding: 10, marginTop: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              📊 Композитные индексы здоровья
            </h4>
            {(() => {
              const r = labAnalysisResult;
              // ASI (Anabolic Synthesis Index) — higher = better, computed from inverse of disruptions
              const rawASI = r ? Math.max(0, Math.round(100 - (
                (r.hormoneScore || 0) * 0.4 +
                Math.min(100, (r.inflammation || 0) / 6 * 50) * 0.3 +
                (r.kidneyStress || 0) * 0.3
              ))) : null;
              const ASI = rawASI !== null ? Math.min(100, rawASI) : null;
              // HMI (Hepatic Metabolic Index) — from liverStress
              const HMI = r ? Math.round(Math.min(100, r.liverStress || 0)) : null;
              // CR (Cardiac Risk) — from cardioRisk
              const CR = r ? Math.round(Math.min(100, r.cardioRisk || 0)) : null;

              const statusColor = (val: number, invert: boolean) => {
                if (!invert) {
                  if (val <= 30) return '#22c55e';
                  if (val <= 60) return '#eab308';
                  return '#ef4444';
                }
                // inverted: higher = better
                if (val >= 70) return '#22c55e';
                if (val >= 40) return '#eab308';
                return '#ef4444';
              };
              const statusLabel = (val: number, invert: boolean) => {
                if (!invert) {
                  if (val <= 30) return 'Норма';
                  if (val <= 60) return 'Внимание';
                  return 'Опасность';
                }
                if (val >= 70) return 'Хорошо';
                if (val >= 40) return 'Умеренно';
                return 'Низкий';
              };

              return (
                <div style={{ display: 'grid', gap: 6 }}>
                  {/* ASI card */}
                  <div style={{
                    padding: 8, borderRadius: 8,
                    background: ASI !== null ? `rgba(${ASI >= 70 ? '34,197,94' : ASI >= 40 ? '234,179,8' : '239,68,68'},0.06)` : 'var(--bg-secondary)',
                    border: ASI !== null ? `1px solid rgba(${ASI >= 70 ? '34,197,94' : ASI >= 40 ? '234,179,8' : '239,68,68'},0.2)` : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>ASI (Анаболический синтез)</div>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                          Отражает способность организма к анаболизму на основе гормонального фона, воспаления и почечной функции
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {ASI !== null ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor(ASI, true) }}>{ASI}%</div>
                            <div style={{ fontSize: 8, color: statusColor(ASI, true), fontWeight: 600 }}>{statusLabel(ASI, true)}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* HMI card */}
                  <div style={{
                    padding: 8, borderRadius: 8,
                    background: HMI !== null ? `rgba(${HMI <= 30 ? '34,197,94' : HMI <= 60 ? '234,179,8' : '239,68,68'},0.06)` : 'var(--bg-secondary)',
                    border: HMI !== null ? `1px solid rgba(${HMI <= 30 ? '34,197,94' : HMI <= 60 ? '234,179,8' : '239,68,68'},0.2)` : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>HMI (Гепатический метаболизм)</div>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                          Стресс печени по трансаминазам, GGT, билирубину, ЩФ
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {HMI !== null ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor(HMI, false) }}>{HMI}%</div>
                            <div style={{ fontSize: 8, color: statusColor(HMI, false), fontWeight: 600 }}>{statusLabel(HMI, false)}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CR card */}
                  <div style={{
                    padding: 8, borderRadius: 8,
                    background: CR !== null ? `rgba(${CR <= 30 ? '34,197,94' : CR <= 60 ? '234,179,8' : '239,68,68'},0.06)` : 'var(--bg-secondary)',
                    border: CR !== null ? `1px solid rgba(${CR <= 30 ? '34,197,94' : CR <= 60 ? '234,179,8' : '239,68,68'},0.2)` : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>CR (Кардиориск)</div>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                          Липидный профиль, воспаление, гомоцистеин
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {CR !== null ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor(CR, false) }}>{CR}%</div>
                            <div style={{ fontSize: 8, color: statusColor(CR, false), fontWeight: 600 }}>{statusLabel(CR, false)}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider + computed indices from labIndexDetails */}
                  {indexEntries.length > 0 && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Детальные индексы:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                        {indexEntries.map(d => (
                          <div key={d.key} style={{
                            padding: '4px 6px', borderRadius: 5,
                            background: 'var(--bg-secondary)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 9 }}>{d.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 30, height: 4, borderRadius: 2,
                                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${Math.min(100, d.value)}%`, height: '100%',
                                  background: getRiskColor(d.value), borderRadius: 2,
                                }} />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 10, color: getRiskColor(d.value), minWidth: 24, textAlign: 'right' }}>
                                {d.value}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ─── Section 3: All System Risks ─── */}
          <div className="card" style={{ padding: 10, marginTop: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              ⚠️ Риски по системам организма
            </h4>
            {labRisks && Object.values(labRisks.systemBreakdown).some(v => v.net > 0) ? (
              <div>
                {/* Summary header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Общий риск</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: getRiskColor(labRisks.overallNet) }}>{Math.round(labRisks.overallNet)}%</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Отклонения</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: deviationCount > 0 ? '#ef4444' : 'var(--text-dim)' }}>
                      {deviationCount}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>маркеров</div>
                  </div>
                </div>

                {/* System breakdown */}
                <div style={{ display: 'grid', gap: 3 }}>
                  {Object.entries(labRisks.systemBreakdown)
                    .filter(([_, v]) => v.net > 0)
                    .sort(([_, a], [__, b]) => b.net - a.net)
                    .map(([sys, val]) => {
                      const level = val.net <= 25 ? 'low' : val.net <= 50 ? 'medium' : val.net <= 75 ? 'high' : 'critical';
                      const levelColors: Record<string, { bg: string; text: string; bar: string }> = {
                        low: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e', bar: '#22c55e' },
                        medium: { bg: 'rgba(234,179,8,0.08)', text: '#eab308', bar: '#eab308' },
                        high: { bg: 'rgba(249,115,22,0.08)', text: '#f97316', bar: '#f97316' },
                        critical: { bg: 'rgba(239,68,68,0.08)', text: '#ef4444', bar: '#ef4444' },
                      };
                      const c = levelColors[level];
                      return (
                        <div key={sys} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', borderRadius: 6,
                          background: c.bg,
                          border: `1px solid ${c.bg.replace('0.08', '0.15')}`,
                        }}>
                          <span style={{
                            fontSize: 9, fontWeight: 600, minWidth: 60, color: c.text,
                          }}>
                            {sysLabels[sys] || sys}
                          </span>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, val.net)}%`, height: '100%',
                              background: c.bar, borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: c.text, minWidth: 28, textAlign: 'right' }}>
                            {Math.round(val.net)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                {hasLabs
                  ? 'Все системы в норме — отклонений не обнаружено'
                  : 'Введите анализы для расчёта системных рисков'}
              </div>
            )}
          </div>

          {/* ─── Section 4: Abnormal Markers ─── */}
          <div className="card" style={{ padding: 10, marginTop: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              🔬 Маркеры с отклонениями
            </h4>
            {deviationCount > 0 && labRisks ? (
              <div style={{ display: 'grid', gap: 3 }}>
                {labRisks.markerDeviations.map(m => {
                  const isHigh = m.deviation > 0;
                  const absDev = Math.abs(m.deviation);
                  const devLevel = absDev <= 20 ? 'low' : absDev <= 50 ? 'medium' : absDev <= 100 ? 'high' : 'critical';
                  const devColors: Record<string, { bg: string; text: string }> = {
                    low: { bg: 'rgba(34,197,94,0.06)', text: '#22c55e' },
                    medium: { bg: 'rgba(234,179,8,0.06)', text: '#eab308' },
                    high: { bg: 'rgba(249,115,22,0.06)', text: '#f97316' },
                    critical: { bg: 'rgba(239,68,68,0.06)', text: '#ef4444' },
                  };
                  const dc = devColors[devLevel];
                  return (
                    <div key={m.code + m.value} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 8px', borderRadius: 6,
                      background: dc.bg,
                      border: `1px solid ${dc.bg.replace('0.06', '0.12')}`,
                    }}>
                      <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 46 }}>{sysLabels[m.system] || m.system}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, flex: 1, color: 'var(--text)' }}>{m.name}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{m.lln}–{m.uln}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: dc.text }}>{m.value}</span>
                        <span style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 3, fontWeight: 600,
                          background: dc.text + '22', color: dc.text,
                        }}>
                          {isHigh ? '↑' : '↓'}{absDev}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                {hasLabs
                  ? 'Все маркеры в пределах нормы'
                  : 'Введите анализы для просмотра отклонений'}
              </div>
            )}
          </div>

          {/* Penalty info footer */}
          {anyNoLabs && (
            <div className="card" style={{ padding: 8, marginTop: 8, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>⚠️ Штраф за отсутствие анализов</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444' }}>×{penalty.totalMultiplier.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                Коэффициент применяется ко всем системным рискам
              </div>
            </div>
          )}
        </div>
      )}

      </div>
      )}

      {/* OCR Import Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => { setShowImport(false); setOcrResult(null); }}>
          <div style={{ position: 'fixed', top: '8%', left: '4%', right: '4%', zIndex: 201, background: 'var(--bg)', borderRadius: 20, maxHeight: '84vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>📄 Импорт анализов</span>
              <button onClick={() => { setShowImport(false); setOcrResult(null); }} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
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
                        placeholder=""
                        rows={5}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box', resize: 'vertical', marginBottom: 6 }}
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

      {/* Lab Input Modal */}
      {showLabInput && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLabInput(false)}>
          <div style={{ width: '92%', maxWidth: 400, zIndex: 201, background: 'var(--bg)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🧪 Ввести результат</span>
              <button onClick={() => setShowLabInput(false)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-dim)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
            {(() => { const info = UCUM_MAP[inputCode.toUpperCase()]; return info ? (
              <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>{info.name} • Норма: {info.lln}–{info.uln} {info.prefUnit}</div>
            ) : null; })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Код</label><input value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="ALT" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} /></div>
              <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Значение</label><input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="40" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} /></div>
              <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Единица</label><input value={inputUnit} onChange={e => setInputUnit(e.target.value)} placeholder="U/L" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} /></div>
              <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Дата</label><input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} /></div>
            </div>
            <button onClick={addLab} style={{ width: '100%', marginTop: 8, padding: 10, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ Сохранить</button>
          </div>
        </div>
      )}
    </div>
  );
};

