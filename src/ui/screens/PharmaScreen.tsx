import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS, getPharmaDetail } from '../../core/pharma-database';
import { db } from '../../core/db';
import { calculateDose } from '../../engines/dosage.engine';
import { simulateCourse, steadyStatePeak, steadyStateTrough, eliminationConstant } from '../../engines/pk-pd.engine';
import { PharmaScoreCard } from '../components/PharmaScoreCard';
import { calculateMultiSubstancePKPD } from '../../engines/pkpd-superposition.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import { PHARMA_DETAILS, type PharmaDetail } from '../../data/support-database';
import type { PharmaSubstance, CourseEntry, PD } from '../../core/types';
import { SYRINGE_SPECS, DRUG_THRESHOLDS } from '../../core/constants';
import { SYNERGY_PAIRS, type SynergyPair } from '../../engines/support.engine';
import { ALL_INTERACTIONS, findInteractionsForSubstance, type SupportInteraction } from '../../data/support-database';
import { decodeGarbled } from '../../utils/text-sanitizer';
import { getDrugTzMechanisms, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../data/support-db';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_SYNERGY, PEPTIDE_CONFLICTS, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  scorePeptideStack, generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES, type PeptideInfo, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKResult,
} from '../../engines/peptide-calculator.engine';
import { SYSTEM_INFO, SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getPharmaLabMarkers } from '../../data/pharma-lab-marker-map';
import { PharmaCourseScreen } from './PharmaCourseScreen';
import { useDataLink } from '../../core/data-link';
import { mapStackToPathologies, getKnownDrugNames, DRUG_DATABASE } from '../../engines/drug-mapper.engine';
import type { DrugEntry, MapperResult } from '../../engines/drug-mapper.engine';
import { runAdvancedDiagnostics, ESTER_HALF_LIFE_DAYS } from '../../engines/advanced-diagnostics.engine';
import type { DrugDoseInput, VitalsInput, AdvancedDiagnosticsResult, PKPDOutput, InteractionOutput, VitalsOutput, BioAgeOutput, PCTRebootOutput } from '../../engines/advanced-diagnostics.engine';

type Tab = 'catalog' | 'pkpd' | 'dosage' | 'interactions' | 'course' | 'mapper' | 'diagnostics';

const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO_ALL).map(([k, v]) => [k, v.label.split(' ').slice(0, 2).join(' ')])
);

const INJECTABLE_WITH_ESTERS = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone']);

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон',
  trenbolone: 'Тренболон',
  nandrolone: 'Нандролон',
  boldenone: 'Болденон',
  primobolan: 'Примоболан',
  oral_17aa: 'Оральные 17-α',
  sarm: 'SARMs',
  peptide_ghrh: 'GHRH',
  peptide_ghrp: 'GHRP',
  igf1: 'IGF-1',
  mgf: 'МГФ',
  insulin: 'Инсулин',
  drostanolone: 'Дростанолон',
  peptide_gnrh: 'GnRH',
  peptide_fat_loss: 'Жиросжигающие',
  peptide_other: 'Прочие',
  dht_derivative: 'DHT производные',
};

const PD_LABELS: Record<keyof PD, string> = {
  AR_affinity: 'Андрогенность',
  aromatization: 'Ароматизация',
  five_alpha_reduction: '5α-редукция',
  progestogenic: 'Прогестагенность',
  hepatotoxicity: 'Гепатотоксичность',
  lipid_impact: 'Влияние на липиды',
  hct_impact: 'Гематокрит',
  neuro_toxicity: 'Нейротоксичность',
};

const PD_MECHANISMS: Record<keyof PD, string> = {
  AR_affinity: 'Сродство к андрогенному рецептору — определяет анаболическую/андрогенную силу',
  aromatization: 'Скорость ароматизации в эстрадиол — риск эстрогенных побочных эффектов',
  five_alpha_reduction: 'Восстановление до DHT — влияет на андрогенные эффекты (кожа, простата)',
  progestogenic: 'Прогестагенная активность — может подавлять ГнРГ/ЛГ, влиять на либидо',
  hepatotoxicity: 'Гепатотоксичность — нагрузка на печень, риск повреждения гепатоцитов',
  lipid_impact: 'Влияние на липидный профиль — снижение ЛПВП, повышение ЛПНП',
  hct_impact: 'Влияние на гематокрит — риск полицитемии при длительном приёме',
  neuro_toxicity: 'Нейротоксичность — риск когнитивных/неврологических побочных эффектов',
};

const PHARMA_MECH_LABELS: Record<string, string> = {
  'AR_AGONISM': 'Агонист AR', 'AR_SELECTIVE_AGONISM': 'Селективный агонист AR',
  'mTOR_UP': 'Активация mTOR', 'PROTEIN_SYNTHESIS': 'Синтез белка',
  'NITROGEN_RETENTION': 'Задержка азота', 'ERYTHROPOIESIS': 'Эритропоэз',
  'IGF1_UPREGULATION': '↑ IGF-1', 'IGF1_UP': '↑ IGF-1',
  '5AR_REDUCTION': '5α-редукция', 'AROMATIZATION': 'Ароматизация',
  'AROMATASE_INHIBITION': 'Ингибитор ароматазы', 'E2_SUPPRESSION': '↓ E2',
  'PR_AGONISM': 'Агонист PR', 'GR_ANTAGONISM': 'Антагонист GR',
  'CORTISOL_SUPPRESSION': '↓ Кортизол', 'DOPAMINE_MODULATION': 'Модуляция дофамина',
  'GABA_MODULATION': 'Модуляция ГАМК', 'CYP3A4_METABOLISM': 'Через CYP3A4',
  'COLLAGEN_SYNTHESIS': 'Синтез коллагена', 'BONE_MINERALIZATION': 'Минерализация костей',
  'PROGESTIN_ACTIVITY': 'Прогестиновая активность',
  'ANTI_CATABOLIC': 'Антикатаболическое', 'GLYCOGEN_SYNTHESIS': 'Синтез гликогена',
  'ANTI_ESTROGENIC': 'Антиэстрогенное', 'SHBG_BINDING': 'Связывание SHBG',
  'GHSR_AGONISM': 'Агонист GHS-R', 'GH_RELEASE': 'Выброс ГР',
  'NEUROPEPTIDE_MOD': 'Модуляция нейропептидов',
  'LIPOLYSIS_ACTIVATION': 'Липолиз', 'HSL_STIMULATION': 'Стимуляция HSL',
  'PEPTIDE_MOD': 'Пептидная модуляция', 'TISSUE_REPAIR': 'Репарация тканей',
  'ER_ANTAGONISM': 'Антагонист ER', 'GNRH_UP': '↑ ГнРГ',
  'GNRH_AGONISM': 'Агонист GnRH', 'LH_UP': '↑ ЛГ',
  'FSH_UP': '↑ ФСГ', 'LH_MIMETIC': 'Миметик ЛГ',
  'TESTOSTERONE_PRODUCTION': 'Продукция тестостерона',
  'TESTOSTERONE_UP': '↑ Тестостерон', 'D2_AGONISM': 'Агонист D2',
  'PROLACTIN_SUPPRESSION': '↓ Пролактин', 'IGF1R_AGONISM': 'Агонист IGF-1R',
  'CELL_PROLIFERATION': 'Пролиферация клеток',
  'SATELLITE_CELL_ACTIVATION': 'Активация сателлитов',
  'GLUCOSE_TRANSPORT': 'Транспорт глюкозы', 'AMINO_ACID_UPTAKE': 'Захват аминокислот',
  'NUTRITIONAL_SUPPORT': 'Нутрицевтическая поддержка',
  'ANTI_INFLAMMATORY': 'Противовоспалительное', 'IMMUNE_SUPPORT': 'Иммунная поддержка',
  'ANABOLIC': 'Анаболическое', 'STRESS_RESPONSE': 'Адаптоген',
  'DETOX_UP': '↑ Детоксикация', 'GSH_UP': 'Синтез глутатиона',
  'ROS_DOWN': '↓ ROS', 'NFkB_DOWN': '↓ NF-κB',
  'MITO_STABILIZE': 'Стабилизация митохондрий',
  'APOPTOSIS_DOWN': '↓ Апоптоз', 'BILE_FLOW_UP': '↑ Желчеотток',
  'SPM_UP': 'Специализированные про-резольвные медиаторы',
  'TG_DOWN': '↓ Триглицериды', 'NEURO_MEMBRANE': 'Структура нейромембран',
  'AT1_BLOCK': 'Блокада AT1', 'ALDOSTERONE_DOWN': '↓ Альдостерон',
  'BP_DOWN': '↓ АД', 'BETA1_BLOCK': 'Блокада β1',
  'NO_UP': '↑ NO', 'HR_DOWN': '↓ ЧСС',
  'HPTA_SUPPORT': 'Поддержка HPTA',
  'AR_AGONISM (3-5x stronger)': 'Агонист AR (×3-5)',
  'AROMATIZATION (20%)': 'Ароматизация (20%)',
};

const CV_LABELS: Record<string, string> = {
  bloodPressure: 'АД', heartRate: 'ЧСС', vascularTone: 'Тонус', thrombosisRisk: 'Тромбоз', cnsLoad: 'ЦНС',
};
const CV_VALUE_LABELS: Record<string, Record<string, string>> = {
  bloodPressure: { up: '↑', down: '↓', neutral: '=' },
  heartRate: { up: '↑', down: '↓', neutral: '=' },
  vascularTone: { constrict: 'спазм', dilate: 'расш', neutral: '=' },
  thrombosisRisk: { low: 'низкий', medium: 'средний', high: 'высокий' },
  cnsLoad: { low: 'низкая', medium: 'средняя', high: 'высокая' },
};
const CV_VALUE_COLORS: Record<string, Record<string, string>> = {
  bloodPressure: { up: '#f44336', down: '#2196f3', neutral: '#9e9e9e' },
  heartRate: { up: '#f44336', down: '#2196f3', neutral: '#9e9e9e' },
  vascularTone: { constrict: '#f44336', dilate: '#2196f3', neutral: '#9e9e9e' },
  thrombosisRisk: { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
  cnsLoad: { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744',
  warning: '#ff9100',
  info: '#2979ff',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  synergy: '',
  conflict: '',
  danger: '',
  caution: '',
};

const pdBarColor = (key: keyof PD, val: number): string => {
  if (key === 'hepatotoxicity') return val >= 2.5 ? '#ff1744' : val >= 1.5 ? '#ff9100' : '#4caf50';
  if (key === 'aromatization') return val >= 0.7 ? '#ff5252' : '#4caf50';
  if (key === 'progestogenic') return val >= 0.3 ? '#ff9100' : '#4caf50';
  if (key === 'neuro_toxicity') return val >= 0.3 ? '#ff1744' : val >= 0.1 ? '#ff9100' : '#4caf50';
  if (key === 'lipid_impact') return val <= -0.5 ? '#ff1744' : '#4caf50';
  if (key === 'hct_impact') return val >= 4 ? '#ff1744' : '#4caf50';
  return '#2979ff';
};

const formatHalfLife = (hours: number): string => {
  if (hours >= 168) return `${(hours / 168).toFixed(1)} нед`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} дн`;
  return `${hours.toFixed(1)} ч`;
};

const PHARMA_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin',
  'drostanolone', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other', 'dht_derivative'
] as const;

// Core pharma classes for synergies (exclude support/vitamins)
const PHARMA_CORE_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin',
  'drostanolone', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other', 'dht_derivative'
] as const;

type PharmaClass = typeof PHARMA_CLASSES[number];

type PharmaPage = 'main' | 'course' | 'calculators' | 'info';
type SubTab = 'catalog' | 'pkpd' | 'dosage' | 'interactions';

export const PharmaScreen: React.FC = () => {
  const [page, setPage] = useState<PharmaPage>('main');
  const [subTab, setSubTab] = useState<SubTab>('catalog');
  const [courseSub, setCourseSub] = useState<'course' | 'mapper' | 'diagnostics' | 'reports'>('course');
  const linked = useDataLink();
  const [courseReportGenerated, setCourseReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_pharma_report_current')) setCourseReportGenerated(true); } catch {} }, []);
  const [courseArchive, setCourseArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_pharma_reports') || '[]'); } catch { return []; }
  });

  // Filter to show only pharma substances (exclude support classes)
  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  if (page === 'main') {
    const cards = [
      { key:'course' as const, icon:'📋', title:'Курс', desc:'Управление курсом, маппинг препаратов, диагностика', color:'#8b5cf6' },
      { key:'calculators' as const, icon:'⚙️', title:'Калькуляторы', desc:'PK/PD симуляция, расчёт дозировок', color:'#3b82f6' },
      { key:'info' as const, icon:'📖', title:'Общая информация', desc:'Каталог веществ и проверка взаимодействий', color:'#22c55e' },
    ];
    return (
      <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
        <img src="/pharma-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Фармакология</h1>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            Курс, PK/PD симуляция, каталог веществ и проверка взаимодействий
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cards.map(c => (
              <button key={c.key} onClick={() => setPage(c.key)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:14,
                cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)',
              }}>
                <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, background:c.color+'18', fontSize:22 }}>{c.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:2, color:c.color }}>{c.title}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{c.desc}</div>
                </div>
                <span style={{ color:c.color, fontSize:18, opacity:0.6 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen pharma">
      <button onClick={() => setPage('main')} style={{
        padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', flexShrink:0, marginBottom:6,
        background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600,
      }}>← Назад</button>

      {/* ─── INFO: calculation summary dashboard ─── */}
      {page === 'info' && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12,
          background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>📊 Сводка расчётов</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            <div style={{ flex:'1 1 45%', minWidth:90, padding:'8px 6px', borderRadius:8, textAlign:'center',
              background:'rgba(0,230,138,0.08)',
            }}>
              <div style={{ fontSize:8, color:'var(--text-dim)' }}>Препаратов в курсе</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{linked.course.length}</div>
            </div>
            <div style={{ flex:'1 1 45%', minWidth:90, padding:'8px 6px', borderRadius:8, textAlign:'center',
              background:'rgba(0,230,138,0.08)',
            }}>
              <div style={{ fontSize:8, color:'var(--text-dim)' }}>Общий риск</div>
              <div style={{ fontSize:18, fontWeight:800, color: (linked.risk?.overallNet ?? 0) >= 60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >= 30 ? '#f59e0b' : '#00e68a' }}>
                {linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}
              </div>
            </div>
          </div>
          {Object.keys(linked.activeDrugs).length > 0 && (
            <div style={{ marginTop:6, fontSize:10, color:'var(--text-dim)' }}>
              Активные вещества: {Object.keys(linked.activeDrugs).map(d => PHARMA_DB[d]?.name || d).join(', ')}
            </div>
          )}
          <PharmaScoreCard
            course={(linked.course || []).map((c: any) => ({ substanceId: c.substanceId || '', dose: c.doseValue || 0, unit: c.doseUnit || 'мг', weeks: (c.endWeek || 12) - (c.startWeek || 0) }))}
            weight={linked.profile?.settings?.weight || 80}
            age={linked.profile?.settings?.age || 30}
            sex={linked.profile?.settings?.sex || 'male'}
          />
        </div>
      )}
      <div style={{ display:'flex', gap:4, overflowX:'auto', marginBottom:8, scrollbarWidth:'none' }}>
{page === 'course' && (['course','mapper','diagnostics','reports'] as const).map(t => (
  <button key={t} onClick={() => setCourseSub(t)} style={{
    padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
    cursor:'pointer', flexShrink:0,
    background: courseSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
    color: courseSub === t ? '#000' : 'var(--text-dim)',
    border: `1px solid ${courseSub === t ? 'var(--accent)' : 'var(--border)'}`,
  }}>{t === 'course' ? '📋 Курс' : t === 'mapper' ? '🗺 Маппер' : t === 'diagnostics' ? '🩺 Диагностика' : '📄 Отчёты'}</button>
))}
        {page === 'calculators' && (['pkpd','dosage'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: subTab === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'pkpd' ? '⚙️ PK/PD' : '💊 Дозировки'}</button>
        ))}
        {page === 'info' && (['catalog','interactions'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: subTab === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'catalog' ? '📖 Каталог' : '⚡ Взаимодействия'}</button>
        ))}
      </div>
      {page === 'course' && courseSub === 'course' && <PharmaCourseScreen />}
      {page === 'course' && courseSub === 'mapper' && <MapperTab />}
      {page === 'course' && courseSub === 'diagnostics' && <DiagnosticsTab />}
      {page === 'course' && courseSub === 'reports' && (() => {
        const saveArchive = (report: any) => {
          const updated = [report, ...courseArchive].slice(0, 20);
          setCourseArchive(updated);
          try { localStorage.setItem('he_pharma_reports', JSON.stringify(updated)); } catch {}
        };
        const generateReport = () => {
          const course = linked.course || [];
          const compounds = course.map((c: any) => {
            const ph = PHARMA_DB[c.substanceId];
            return { id: c.substanceId, name: ph?.name || c.substanceId, cls: ph?.class || 'other', dose: c.doseValue, freq: c.frequency, start: c.startWeek, end: c.endWeek, unit: c.doseUnit };
          });
          const report = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), generatedAt: new Date().toISOString(), compounds, compoundCount: compounds.length, totalWeeks: compounds.length ? Math.max(...compounds.map((c:any) => c.end || c.endWeek || 0)) : 0, totalDoseMg: compounds.reduce((s: number, c: any) => s + (c.dose || 0) * ((c.end || c.endWeek || 0) - (c.start || c.startWeek || 0) + 1), 0), risk: linked.risk?.overallRaw || 0, pctPlanned: compounds.some((c: any) => c.cls === 'serm' || c.cls === 'pct_gonadotropin'), timestamp: Date.now() };
          saveArchive(report);
          try { localStorage.setItem('he_pharma_report_current', JSON.stringify(report)); } catch {}
          setCourseReportGenerated(true);
        };
        return (
          <div style={{ padding:'0 12px 80px' }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>📄 Отчёты по курсу</h3>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Полный отчёт по препаратам, дозам, фазам и рискам</p>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              <button onClick={generateReport} style={{ padding:'8px 16px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12, background:'var(--accent)', color:'#000', border:'none', flex:1 }}>📄 Сгенерировать отчёт</button>
              <button onClick={() => { try { localStorage.removeItem('he_pharma_reports'); localStorage.removeItem('he_pharma_report_current'); setCourseArchive([]); setCourseReportGenerated(false); } catch {} }} style={{ padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:11, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>🗑 Очистить архив</button>
            </div>
            {courseReportGenerated && (
              <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <h4 style={{ margin:0, fontSize:12, fontWeight:700, color:'#00e68a' }}>✅ Отчёт сгенерирован</h4>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{new Date().toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
                  {(linked.course || []).map((c: any, i: number) => {
                    const ph = PHARMA_DB[c.substanceId];
                    return <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 8px', borderRadius:4, background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9 }}>
                      <span style={{ fontWeight:600 }}>{ph?.name || c.substanceId}</span>
                      <span style={{ color:'rgba(255,255,255,0.6)' }}>{c.doseValue}{c.doseUnit} · {c.frequency} · нед {c.startWeek}-{c.endWeek}</span>
                    </div>;
                  })}
                  <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <b>Всего препаратов:</b> {(linked.course||[]).length} · <b>Риск:</b> {Math.round(linked.risk?.overallRaw||0)}%
                  </div>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', textAlign:'center', marginTop:8 }}>Отчёт сохранён в архив. Доступен в Профиле → Отчёты.</div>
              </div>
            )}
            {courseArchive.length > 0 && (
              <div>
                <h4 style={{ fontSize:12, fontWeight:700, color:'#fff', margin:'0 0 8px' }}>📦 Архив отчётов ({courseArchive.length})</h4>
                {courseArchive.map((r: any) => (
                  <div key={r.id} style={{ borderRadius:10, padding:10, marginBottom:4, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>Отчёт от {r.date}</span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{r.compoundCount} препаратов</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>нед: {r.totalWeeks} · риск: {Math.round(r.risk)}%</div>
                  </div>
                ))}
              </div>
            )}
            {!courseReportGenerated && courseArchive.length === 0 && (
              <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>Нажмите «Сгенерировать отчёт» для создания отчёта по курсу</div>
            )}
          </div>
        );
      })()}
      {page === 'calculators' && subTab === 'pkpd' && <PKPDSimulationTab />}
      {page === 'calculators' && subTab === 'dosage' && <DosageCalculatorTab />}
      {page === 'info' && subTab === 'catalog' && <CatalogTab />}
      {page === 'info' && subTab === 'interactions' && <InteractionCheckerTab />}
    </div>
  );
};

const SYSTEM_LABELS_INVEST: Record<string, string> = {
  hepatic: '', cardio: '', endocrine: '',
  lipid: '', renal: '', hematic: '', immune: '',
  neuro: '', reproductive: '', musculoskeletal: ''
};

interface Investigation {
  id: string;
  name: string;
  system: string;
  freq: string;
  markers: string;
  reason: string;
}

const INVESTIGATIONS_DATA: Investigation[] = [
  { id: 'echo_kg', name: '', system: 'cardio', freq: '', markers: '', reason: '' },
  { id: 'ekg', name: '', system: 'cardio', freq: '', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: '' },
  { id: 'usg_abd', name: '', system: 'hepatic', freq: '', markers: '', reason: '' },
  { id: 'usg_kidney', name: '', system: 'renal', freq: '', markers: '', reason: '' },
  { id: 'usg_prostate', name: '', system: 'reproductive', freq: '', markers: '', reason: '' },
  { id: 'usg_thyroid', name: '', system: 'endocrine', freq: '', markers: '', reason: '' },
  { id: 'usg_heart_24h', name: '', system: 'cardio', freq: '', markers: '', reason: '' },
  { id: 'mri_brain', name: '', system: 'neuro', freq: '', markers: '', reason: '' },
  { id: 'densitometry', name: '', system: 'musculoskeletal', freq: '', markers: '', reason: '' },
  { id: 'usg_joints', name: '', system: 'musculoskeletal', freq: '', markers: '', reason: '' },
  { id: 'spirometry', name: '', system: 'cardio', freq: '', markers: 'FEV1, FVC, FEV1/FVC (индекс Тиффно), PEF', reason: '' },
  { id: 'abd_ct', name: '', system: 'hepatic', freq: '', markers: '', reason: '' },
  { id: 'ambp', name: '', system: 'cardio', freq: '', markers: '', reason: '' },
];

const InvestigationsTab: React.FC = () => {
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});
  const [invDone, setInvDone] = useState<Record<string, boolean>>({});

  const toggleSystem = (system: string) => {
    setCollapsedSystems(prev => ({ ...prev, [system]: !prev[system] }));
  };

  const toggleInv = (id: string) => {
    setInvDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedBySystem = INVESTIGATIONS_DATA.reduce((acc, inv) => {
    if (!acc[inv.system]) acc[inv.system] = [];
    acc[inv.system].push(inv);
    return acc;
  }, {} as Record<string, Investigation[]>);

  return (
    <div className="card" style={{ fontSize: 12 }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Исследования и обследования</h3>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>Инструктивные и аппаратные исследования для мониторинга на курсе и в ПКТ</p>

      <div style={{ display: 'grid', gap: 8 }}>
        {Object.entries(groupedBySystem).map(([system, investigations]) => {
          const isCollapsed = collapsedSystems[system] || false;
          return (
            <div key={system} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              <div 
                style={{ 
                  padding: '10px 12px', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                }}
                onClick={() => toggleSystem(system)}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  {SYSTEM_LABELS_INVEST[system] || system} 
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>({investigations.length} исслед.)</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {isCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!isCollapsed && (
                <div style={{ padding: '8px 12px' }}>
                  {investigations.map(inv => {
                    const isDone = invDone[inv.id] ?? false;
                    return (
                      <div key={inv.id} style={{ 
                        background: isDone ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)',
                        borderRadius: 8, 
                        padding: '10px 12px', 
                        border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                        marginBottom: 8,
                        transition: 'all .2s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: isDone ? 'var(--success)' : 'var(--text)', marginBottom: 2 }}>{inv.name}</div>
                            <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'inline-block' }}>{SYSTEM_LABELS_INVEST[inv.system] || inv.system}</div>
                          </div>
                          <button onClick={() => toggleInv(inv.id)} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            background: isDone ? 'var(--success-dim)' : 'var(--bg-tertiary)',
                            color: isDone ? 'var(--success)' : 'var(--text-dim)',
                            border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                          }}>
                            {isDone ? '' : ''}
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 2, fontWeight: 500 }}>Зачастота: {inv.freq}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}><b>Параметры:</b> {inv.markers}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4 }}>{inv.reason}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CatalogTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const groupedByClass = useMemo(() => {
    const map: Record<string, typeof pharmaSubstances> = {};
    for (const s of pharmaSubstances) {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    }
    return map;
  }, [pharmaSubstances]);

  const filteredList = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return pharmaSubstances.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q) || (s.class && s.class.toLowerCase().includes(q)));
    }
    if (filterClass === 'all') return pharmaSubstances;
    return pharmaSubstances.filter(s => s.class === filterClass);
  }, [filterClass, searchQuery, pharmaSubstances]);

  const toggleClass = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const filteredGrouped = useMemo(() => {
    if (filterClass !== 'all' || searchQuery) return null;
    return groupedByClass;
  }, [filterClass, searchQuery, groupedByClass]);

  const selected = selectedId ? getPharmaDetail(selectedId) : null;
  const detail = selectedId ? PHARMA_DETAILS[selectedId] : undefined;

  return (
    <div>
      <input type="text" placeholder="Поиск по названию..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        <button onClick={() => setFilterClass('all')} style={{
          padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
          background: filterClass === 'all' ? 'rgba(0,230,138,0.15)' : 'transparent',
          color: filterClass === 'all' ? 'var(--accent)' : 'var(--text-dim)',
          border: `1px solid ${filterClass === 'all' ? 'var(--accent)' : 'var(--border)'}`,
          fontWeight: filterClass === 'all' ? 700 : 400,
        }}>Все</button>
        {PHARMA_CLASSES.map(cls => (
          <button key={cls} onClick={() => setFilterClass(cls)} style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
            background: filterClass === cls ? 'rgba(0,230,138,0.15)' : 'transparent',
            color: filterClass === cls ? 'var(--accent)' : 'var(--text-dim)',
            border: `1px solid ${filterClass === cls ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: filterClass === cls ? 700 : 400,
          }}>{CLASS_LABELS[cls] || cls}</button>
        ))}
      </div>

      {/* Grouped view when "Все" */}
      {filteredGrouped ? (
        <div>
          {Object.entries(filteredGrouped).map(([cls, substances]) => {
            const isCollapsed = collapsedClasses[cls] ?? false;
            return (
              <div key={cls} style={{ marginBottom: 6 }}>
                <div onClick={() => toggleClass(cls)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  background: 'var(--bg-secondary)', marginBottom: 2,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                    {CLASS_LABELS[cls] || cls}
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 400 }}>
                      {substances.length}
                    </span>
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {!isCollapsed && substances.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 10px 5px 16px', borderRadius: 4, cursor: 'pointer',
                    background: selectedId === s.id ? 'rgba(0,230,138,0.12)' : 'transparent',
                    borderLeft: selectedId === s.id ? '3px solid var(--accent)' : '3px solid transparent',
                    marginBottom: 1,
                  }} onClick={() => setSelectedId(s.id)}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => {
                        const dr = s.dosageRange; const val = dr ? Math.round((dr.min+dr.max)/2) : 250; const unit = dr?.unit||'mg/wk';
                        db.put('course_log', { id:crypto.randomUUID(), substanceId:s.id, doseValue:val, doseUnit:unit, frequency:dr?.frequency||'2x/wk', startWeek:1, endWeek:12 }).catch(()=>{});
                      }} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+</button>
                      <button onClick={() => {
                        try { const e=JSON.parse(localStorage.getItem('supportCart')||'[]'); if(!e.some((x:any)=>x.id===s.id)) localStorage.setItem('supportCart', JSON.stringify([...e,{id:s.id,name:s.name,dose:'—',timing:'daily'}])); } catch{}
                      }} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat list when filter is specific class or search is active */
        filteredList.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
            background: selectedId === s.id ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
            border: selectedId === s.id ? '1px solid var(--accent)' : '1px solid transparent',
          }} onClick={() => setSelectedId(s.id)}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{CLASS_LABELS[s.class] || s.class}</div>
            </div>
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => {
                const dr = s.dosageRange; const val = dr ? Math.round((dr.min+dr.max)/2) : 250; const unit = dr?.unit||'mg/wk';
                db.put('course_log', { id:crypto.randomUUID(), substanceId:s.id, doseValue:val, doseUnit:unit, frequency:dr?.frequency||'2x/wk', startWeek:1, endWeek:12 }).catch(()=>{});
              }} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+</button>
              <button onClick={() => {
                try { const e=JSON.parse(localStorage.getItem('supportCart')||'[]'); if(!e.some((x:any)=>x.id===s.id)) localStorage.setItem('supportCart', JSON.stringify([...e,{id:s.id,name:s.name,dose:'—',timing:'daily'}])); } catch{}
              }} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
            </div>
          </div>
        ))
      )}
      {filteredList.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          {searchQuery ? 'Ничего не найдено' : ''}
        </div>
      )}

      {/* Popup detail modal — same style as supplements catalog */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }} onClick={() => setSelectedId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '92%', maxWidth: 480, maxHeight: '85vh',
            borderRadius: 16, background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), #00c853)' }} />
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{selected.name}</span>
                <button onClick={() => setSelectedId(null)} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}>✕ Закрыть</button>
              </div>
              <DrugDetailCard sub={selected} detail={detail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DrugDetailCard: React.FC<{ sub: PharmaSubstance; detail?: PharmaDetail }> = ({ sub, detail }) => {
  const pd = sub.pd || {} as PharmaSubstance['pd'];
  const pdEntries = Object.entries(pd) as [keyof PD, number][];
  const [expandedPD, setExpandedPD] = useState<string | null>(null);

  const riskLabels: string[] = [];
  if (pd.hepatotoxicity >= 2) riskLabels.push('Гепатотоксичен');
  if (pd.aromatization >= 0.7) riskLabels.push('Ароматизируется');
  if (pd.progestogenic >= 0.3) riskLabels.push('Прогестагенный');
  if (pd.neuro_toxicity >= 0.3) riskLabels.push('Нейротоксичен');
  if (pd.lipid_impact <= -0.5) riskLabels.push('Ухудшает липиды');
  if (pd.hct_impact >= 4) riskLabels.push('Повышает HCT');

  const effectLabels: string[] = [];
  if (pd.AR_affinity >= 1.0) effectLabels.push('Высокая андрогенность');
  else if (pd.AR_affinity >= 0.7) effectLabels.push('Средняя андрогенность');
  if (pd.five_alpha_reduction >= 0.5) effectLabels.push('Восст. в ДГТ');
  if (pd.aromatization === 0) effectLabels.push('Не ароматизируется');
  if (sub.class === 'sarm') effectLabels.push('SARM (селективный)');

  return (
    <div className="card" style={{ fontSize: 12, lineHeight: 1.6 }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--accent)' }}>{sub.name}</h3>
      <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        <span>Класс:</span><span style={{ fontWeight: 600 }}>{CLASS_LABELS[sub.class] || sub.class}</span>
        <span>T½:</span><span style={{ fontWeight: 600 }}>{sub.pk ? formatHalfLife(sub.pk.halfLifeHours) : '—'}</span>
        <span>Биодоступность:</span><span style={{ fontWeight: 600 }}>{sub.pk ? (sub.pk.bioavailability * 100).toFixed(0) : '—'}%</span>
        <span>Vd:</span><span style={{ fontWeight: 600 }}>{sub.pk ? sub.pk.Vd + ' л' : '—'}</span>
        <span>Эстеры:</span><span style={{ fontWeight: 600 }}>{sub.esters?.join(', ') || '—'}</span>
      </div>

      {/* target systems chips */}
      {sub.targetSystems && sub.targetSystems.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Системы-мишени</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.targetSystems.map(s => (
              <span key={s} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 500 }}>{SYSTEM_LABELS[s] || s}</span>
            ))}
          </div>
        </div>
      )}

      {/* cv profile chips */}
      {sub.cvProfile && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Сердечно-сосудистый профиль</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {Object.entries(sub.cvProfile).map(([key, val]) => {
              const lbl = CV_VALUE_LABELS[key]?.[val] || val;
              const clr = CV_VALUE_COLORS[key]?.[val] || '#9e9e9e';
              return (
                <span key={key} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${clr}18`, color: clr, fontWeight: 500 }}>{CV_LABELS[key] || key}: {lbl}</span>
              );
            })}
          </div>
        </div>
      )}
      {(() => { const m = getPharmaLabMarkers(sub.id); return m.length > 0 ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>🩸 Контролировать анализы</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {m.map((marker: string) => (
              <span key={marker} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,152,0,0.12)', color: '#ff9800', fontWeight: 500 }}>{marker}</span>
            ))}
          </div>
        </div>
      ) : null; })()}

      {/* linked risks chips */}
      {sub.linkedRisks && sub.linkedRisks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Связанные риски</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.linkedRisks.map((r, i) => (
              <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: r.direction === 'down' ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)', color: r.direction === 'down' ? '#4caf50' : '#f44336', fontWeight: 500 }}>
                {SYSTEM_LABELS[r.system] || r.system} {r.direction === 'up' ? '↑' : '↓'} {Math.round(r.strength * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* linked substances chips */}
      {sub.linkedSubstances && sub.linkedSubstances.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Связанные вещества</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.linkedSubstances.map((ls, i) => {
              const linked = PHARMA_DB[ls.id];
              const clr = ls.type === 'synergy' ? '#00e68a' : '#ff1744';
              return (
                <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${clr}18`, color: clr, fontWeight: 500 }}>
                  {ls.type === 'synergy' ? '⊕' : '⊖'} {linked?.name || ls.id} ({ls.mechanism})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* conflicts */}
      {sub.conflicts && sub.conflicts.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>🔴 Конфликты</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.conflicts.map((c, i) => (
              <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)', color: c.severity === 'HIGH' ? '#ef4444' : '#eab308', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.with}: {c.effect}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* special instructions */}
      {sub.specialInstructions && sub.specialInstructions.length > 0 && (
        <div style={{ marginBottom: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>📋 Особые указания</div>
          {sub.specialInstructions.map((si, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, paddingLeft: 8, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#f59e0b' }}>•</span>
              {si}
            </div>
          ))}
        </div>
      )}

      {/* contraindications */}
      {(sub.contraindications || detail?.contraindications) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>🚫 Противопоказания</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(sub.contraindications || detail?.contraindications || []).map((c: string, i: number) => (
              <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* side effects */}
      {(sub.sideEffects || detail?.sideEffects) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>⚠ Побочные эффекты</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(sub.sideEffects || detail?.sideEffects || []).map((se: any, i: number) => {
              if (typeof se === 'string') return <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>{se}</span>;
              return <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: se.frequency === 'common' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)', color: se.frequency === 'common' ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>{se.effect}</span>;
            })}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Фармакодинамика</div>
            {pdEntries.map(([key, val]) => {
              const absVal = Math.abs(val);
              const maxScale = key === 'AR_affinity' ? 2 : key === 'hct_impact' ? 6 : key === 'hepatotoxicity' ? 4 : 1.2;
              const pct = Math.min(100, (absVal / maxScale) * 100);
              const mechanism = PD_MECHANISMS[key] || '';
              const isExpanded = expandedPD === key;
              return (
                <div key={key} style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedPD(isExpanded ? null : key)}>
                    <span style={{ fontSize: 11 }}>{PD_LABELS[key] || key} {isExpanded ? '▾' : '▸'}</span>
                    <span style={{ color: pdBarColor(key, val), fontWeight: 600 }}>{val.toFixed(2)}</span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 2, height: 4 }}>
                    <div style={{ width: `${pct}%`, background: pdBarColor(key, val), height: 4, borderRadius: 2, minWidth: 2 }} />
                  </div>
                  {isExpanded && mechanism && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4, marginTop: 2, padding: '3px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                      {mechanism}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {effectLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Эффекты: </span>
          <span style={{ color: '#4caf50' }}>{effectLabels.join(' · ')}</span>
        </div>
      )}
      {riskLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Риски: </span>
          <span style={{ color: '#ff5252' }}>{riskLabels.join(' · ')}</span>
        </div>
      )}

      {/* ── ТЗ механизмы ── */}
      {(() => {
        const tzMechs = getDrugTzMechanisms(sub.id);
        if (!tzMechs.length) return null;
        const grouped: Record<string, { mechId: string; label: string; weight: number }[]> = {};
        for (const m of tzMechs) {
          if (!grouped[m.organId]) grouped[m.organId] = [];
          grouped[m.organId].push({ mechId: m.mechId, label: TZ_MECH_LABELS[m.mechId] || m.mechId, weight: m.weight });
        }
        return (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>🧬 Механизм-ориентированная модель (ТЗ)</div>
            {Object.entries(grouped).map(([organId, mechs]) => (
              <details key={organId} style={{ marginBottom: 4 }}>
                <summary style={{ cursor:'pointer', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', fontSize:10, fontWeight:600, listStyle:'none', display:'flex', alignItems:'center', gap:4 }}>
                  {TZ_SYSTEM_ICONS[organId] || '•'} {TZ_SYSTEM_LABELS[organId] || organId}
                  <span style={{ marginLeft:'auto', fontSize:8, color:'rgba(255,255,255,0.4)' }}>{mechs.length} мех.</span>
                </summary>
                <div style={{ padding:'4px 0 0 8px', display:'flex', flexDirection:'column', gap:2 }}>
                  {mechs.map(m => (
                    <div key={m.mechId} style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4, fontSize:9, background:'rgba(255,255,255,0.02)' }}>
                      <span style={{ color:'rgba(255,255,255,0.8)', flex:1 }}>{m.label}</span>
                      <span style={{ fontWeight:700, color:m.weight >= 4 ? '#ef4444' : m.weight >= 3 ? '#f97316' : m.weight >= 2 ? '#eab308' : '#22c55e' }}>
                        w={m.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        );
      })()}

      {(sub.description || (detail?.description)) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Описание</div>
          <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{decodeGarbled((detail?.description || sub.description) || '')}</div>
        </div>
      )}
      {(detail?.mechanism || sub.mechanisms?.length) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Механизм действия</div>
          {detail?.mechanism ? (
            <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{decodeGarbled(detail.mechanism)}</div>
          ) : sub.mechanisms?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {sub.mechanisms.map((m, i) => (
                <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>{PHARMA_MECH_LABELS[m] || m.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {(detail?.dosageRange || sub.dosageRange) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Диапазон дозировок</div>
          <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
            {(() => { const dr = detail?.dosageRange || sub.dosageRange; if (!dr) return null; return <>
              <span>Минимум:</span><span>{dr.min} {dr.unit}</span>
              <span>Максимум:</span><span style={{ color: '#ff9100' }}>{dr.max} {dr.unit}</span>
              <span>Частота:</span><span>{dr.frequency}</span>
            </>; })()}
          </div>
        </div>
      )}
      {(detail?.synergies && detail.synergies.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Синергия и комбинации</div>
          {(() => { try { return detail!.synergies.map((s: any, i: number) => {
            const linkedName = (typeof s.with === 'string' && PHARMA_DB[s.with]) ? PHARMA_DB[s.with].name : s.with || '—';
            return (
              <div key={i} style={{ marginBottom: 4, padding: '4px 8px', borderRadius: 4, background: s.type === 'synergistic' ? 'rgba(0,230,138,0.08)' : s.type === 'antagonistic' ? 'rgba(255,23,68,0.08)' : 'rgba(41,121,255,0.08)' }}>
                <span style={{ fontWeight: 600, color: s.type === 'synergistic' ? '#00e68a' : s.type === 'antagonistic' ? '#ff1744' : '#2979ff' }}>
                  {s.type === 'synergistic' ? '⊕' : s.type === 'antagonistic' ? '⊖' : '→'} {linkedName}
                </span>
                <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{s.desc || ''}</span>
              </div>
            );
          }); } catch { return null; }})()}
        </div>
      )}
      {((detail?.sideEffects && detail.sideEffects.length > 0) || (sub.sideEffects && sub.sideEffects.length > 0)) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Побочные эффекты</div>
          {(detail?.sideEffects || sub.sideEffects || []).map((se, i) => (
            <div key={i} style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{se.effect}</span>
              <span style={{ color: se.frequency === 'common' ? '#ff9100' : se.frequency === 'rare' ? '#2979ff' : '#ff1744', fontWeight: 600, fontSize: 11 }}>
                {se.frequency === 'common' ? 'часто' : se.frequency === 'rare' ? 'редко' : se.frequency === 'very_rare' ? 'очень редко' : se.frequency}
              </span>
            </div>
          ))}
        </div>
      )}
      {sub.contraindications && sub.contraindications.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Противопоказания</div>
          {sub.contraindications.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ff5252', marginBottom: 2 }}>• {c}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => {
          const dr = (detail?.dosageRange || sub.dosageRange);
          const val = dr ? Math.round((dr.min + dr.max) / 2) : 250;
          const unit = dr?.unit || 'mg/wk';
          db.put('course_log', {
            id: crypto.randomUUID(), substanceId: sub.id,
            doseValue: val, doseUnit: unit,
            frequency: dr?.frequency || '2x/wk',
            startWeek: 1, endWeek: 12,
          }).catch(() => {});
        }} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, background: 'rgba(0,230,138,0.12)', color: '#00e68a',
        }}>+ В план</button>
        <button onClick={() => {
          try {
            const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
            if (!existing.some((x: any) => x.id === sub.id)) {
              localStorage.setItem('supportCart', JSON.stringify([...existing, { id: sub.id, name: sub.name, dose: (detail?.dosageRange || sub.dosageRange)?.min ? `${(detail?.dosageRange || sub.dosageRange)!.min} ${(detail?.dosageRange || sub.dosageRange)!.unit}` : '—', timing: 'daily' }]));
            }
          } catch {}
        }} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
        }}>🛒 В корзину</button>
      </div>
    </div>
  );
};

interface DrugDose {
  substanceId: string;
  doseMg: number;
  frequencyDays: number[];
  totalWeeks: number;
}

const DRUG_COLORS = ['#7c4dff', '#ff1744', '#00e68a', '#ff9100', '#3b82f6', '#f44336', '#4caf50', '#9c27b0', '#ff5722', '#2196f3'];
const DAY_SHORT = ['', '', '', '', '', '', '', ''];
const parseFreqToDays = (freq: string): number[] => {
  const match = freq.match(/(\d+)\s*x\s*\/\s*week/i);
  if (match) {
    const n = parseInt(match[1]);
    if (n <= 0) return [1];
    if (n >= 7) return [1, 2, 3, 4, 5, 6, 7];
    const days = [];
    for (let i = 0; i < n; i++) days.push(i + 1);
    return days;
  }
  return [1, 4];
};

const PKPDSimulationTab: React.FC = () => {
  const linked = useDataLink();
  const [drugDoses, setDrugDoses] = useState<DrugDose[]>(() => {
    const courseDrugs = linked.course.slice(0, 5).map(c => ({
      substanceId: c.substanceId,
      doseMg: c.doseValue ?? 250,
      frequencyDays: c.frequency ? parseFreqToDays(String(c.frequency)) : [1, 4],
      totalWeeks: (c.endWeek ?? 12) - (c.startWeek ?? 0),
    }));
    return courseDrugs.length > 0 ? courseDrugs : [
      { substanceId: 'test_enan', doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 },
    ];
  });
  const [simResult, setSimResult] = useState<{
    points: { week: number; cp: number; effect: number; tol: number }[];
    perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[];
    peak: number; trough: number; ssDays: number;
  } | null>(null);
  const [pkSearch, setPkSearch] = useState('');
  const [pkClass, setPkClass] = useState<string>('');
  const [showAllDrugs, setShowAllDrugs] = useState(true);
  const [visibleDrugs, setVisibleDrugs] = useState<Set<string>>(new Set());
  const [pkEsterPopup, setPkEsterPopup] = useState<{ baseClass: string; label: string } | null>(null);

  const allSubstances = useMemo(() => {
    const PKPD_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','insulin']);
    return Object.values(PHARMA_DB).filter(s => !!s?.name && PKPD_CLASSES.has(s.class));
  }, []);

  // Show unused (not in current simulation) by default
  const unusedSubstances = useMemo(() => {
    const used = new Set(drugDoses.map(d => d.substanceId));
    return allSubstances.filter(s => !used.has(s.id));
  }, [drugDoses, allSubstances]);

  const pkFiltered = useMemo(() => {
    if (pkSearch.trim() || pkClass) {
      const q = pkSearch.toLowerCase();
      let list = allSubstances;
      if (pkClass) list = list.filter(s => s.class === pkClass);
      if (pkSearch.trim()) list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q));
      return list;
    }
    return unusedSubstances;
  }, [pkSearch, pkClass, allSubstances, unusedSubstances]);

  // Class-grouped substances for quick-pick
  const substancesByClass = useMemo(() => {
    const map: Record<string, typeof allSubstances> = {};
    for (const s of allSubstances) {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    }
    return map;
  }, [allSubstances]);

  const addDrug = (id: string) => {
    setDrugDoses([...drugDoses, { substanceId: id, doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 }]);
    setPkSearch('');
    setVisibleDrugs(prev => { const n = new Set(prev); n.add(id); return n; });
  };

  const removeDrug = (idx: number) => {
    const removed = drugDoses[idx];
    setDrugDoses(drugDoses.filter((_, i) => i !== idx));
    if (removed) setVisibleDrugs(prev => { const n = new Set(prev); n.delete(removed.substanceId); return n; });
  };

  const updateDrug = (idx: number, field: keyof DrugDose, value: string | number | number[]) => {
    const updated = [...drugDoses];
    updated[idx] = { ...updated[idx], [field]: value };
    setDrugDoses(updated);
  };

  const buildEntries = (doses: DrugDose[]): CourseEntry[] => {
    const result: CourseEntry[] = [];
    doses.forEach((dd) => {
      const weeklyDose = dd.doseMg * dd.frequencyDays.length;
      for (let w = 0; w < dd.totalWeeks; w++) {
        result.push({
          id: `${dd.substanceId}-w${w}`,
          substanceId: dd.substanceId,
          doseValue: weeklyDose,
          doseUnit: 'mg/wk',
          frequency: `${dd.frequencyDays.length}x/week`,
          startWeek: w,
          endWeek: w + 1,
        });
      }
    });
    return result;
  };

  const runSimulation = () => {
    const maxWeeks = Math.max(...drugDoses.map(d => d.totalWeeks), 1);
    const allEntries = buildEntries(drugDoses);
    if (allEntries.length === 0) return;

    const superpositionResult = calculateMultiSubstancePKPD(allEntries, maxWeeks);

    const perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[] = [];
    drugDoses.forEach((dd) => {
      const singleEntries = buildEntries([dd]);
      const singleResult = calculateMultiSubstancePKPD(singleEntries, maxWeeks);
      const sub = PHARMA_DB[dd.substanceId];
      perDrug.push({
        substanceId: dd.substanceId,
        name: sub?.name || dd.substanceId,
        points: singleResult.map(p => ({ week: p.week, cp: p.cp })),
      });
    });
    setVisibleDrugs(new Set(drugDoses.map(d => d.substanceId)));

    const firstDrug = PHARMA_DB[drugDoses[0].substanceId];
    let peak = 0;
    let trough = Infinity;
    let ssDays = 0;

    if (firstDrug && drugDoses[0].frequencyDays.length > 0) {
      const intervalH = (168 / drugDoses[0].frequencyDays.length);
      try {
        peak = steadyStatePeak({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
        trough = steadyStateTrough({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
      } catch { peak = 0; trough = 0; }

      const k = eliminationConstant(firstDrug.pk.halfLifeHours);
      ssDays = Math.ceil(5 * (firstDrug.pk.halfLifeHours / 24));
    }

    setSimResult({ points: superpositionResult, perDrug, peak, trough, ssDays });
  };

  const toggleDrugVisibility = (id: string) => {
    setVisibleDrugs(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const chart = useMemo(() => {
    if (!simResult || simResult.points.length === 0) return null;
    const W = 700;
    const H = 280;
    const PAD = 40;
    const pts = simResult.points;
    const visiblePerDrug = simResult.perDrug.filter(d => showAllDrugs || visibleDrugs.has(d.substanceId));
    const allCp = [...pts.map(p => p.cp), ...visiblePerDrug.flatMap(d => (d.points || []).map(p => p.cp))];
    const maxCp = Math.max(...allCp, 1);
    const maxWeek = pts[pts.length - 1].week;

    const toX = (w: number) => PAD + (w / maxWeek) * (W - 2 * PAD);
    const toY = (cp: number) => H - PAD - (cp / maxCp) * (H - 2 * PAD);

    const totalPathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
    const effectPathD = pts.map((p, i) => {
      const ey = H - PAD - (p.effect / 100) * (H - 2 * PAD);
      return `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${ey.toFixed(1)}`;
    }).join(' ');

    const perDrugPaths = visiblePerDrug.map((drug, di) => {
      const idx = simResult.perDrug.findIndex(d => d.substanceId === drug.substanceId);
      const color = DRUG_COLORS[idx % DRUG_COLORS.length];
      const d = (drug.points || []).map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
      return { substanceId: drug.substanceId, name: drug.name, d, color };
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const y = H - PAD - frac * (H - 2 * PAD);
      const label = (maxCp * frac).toFixed(1);
      return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>
        <text x="${PAD - 4}" y="${y + 3}" fill="var(--text-dim)" font-size="8" text-anchor="end">${label}</text>`;
    });

    const weekMarkers: string[] = [];
    const step = maxWeek <= 12 ? 1 : maxWeek <= 24 ? 2 : 4;
    for (let w = 0; w <= maxWeek; w += step) {
      const x = toX(w);
      weekMarkers.push(`<text x="${x}" y="${H - 3}" fill="var(--text-dim)" font-size="9" text-anchor="middle">${w}</text>`);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        {gridLines.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        {perDrugPaths.map((pd) => (
          <g key={pd.substanceId}>
            <path d={pd.d} fill="none" stroke={pd.color} strokeWidth="2" strokeDasharray="4 2" opacity={0.7} />
          </g>
        ))}
        <path d={totalPathD} fill="none" stroke="var(--accent)" strokeWidth="3" opacity={0.95} />
        <path d={effectPathD} fill="none" stroke="#4caf50" strokeWidth="2" strokeDasharray="6 3" opacity={0.85} />
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        <text x={W / 2} y={H - 1} fill="var(--text-dim)" fontSize="10" textAnchor="middle">Недели</text>
      </svg>
    );
  }, [simResult, showAllDrugs, visibleDrugs]);

  return (
    <div>
      {/* Current simulation drugs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {drugDoses.map((dd, idx) => {
          const sub = PHARMA_DB[dd.substanceId];
          return (
            <div key={idx} style={{
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 12, padding: '10px 12px', fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                    {sub?.name || dd.substanceId}
                  </span>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(0,230,138,0.12)', color: 'var(--accent)' }}>
                    {CLASS_LABELS[sub?.class as string] || sub?.class}
                  </span>
                </div>
                {drugDoses.length > 1 && (
                  <button onClick={() => removeDrug(idx)} style={{
                    width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                )}
              </div>
              {/* Row 1: Dose + Weeks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Доза (мг)</label>
                  <input type="number" value={dd.doseMg} onChange={(e) => updateDrug(idx, 'doseMg', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Недель</label>
                  <input type="number" value={dd.totalWeeks} onChange={(e) => updateDrug(idx, 'totalWeeks', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Row 2: Days — full width */}
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Дни инъекций:</label>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7].map(d => {
                    const active = (dd.frequencyDays || []).includes(d);
                    return (
                      <button key={d} type="button" onClick={() => {
                        const fDays = dd.frequencyDays || [];
                        const next = active ? fDays.filter(x => x !== d) : [...fDays, d].sort();
                        updateDrug(idx, 'frequencyDays', next);
                      }} style={{
                        flex: 1, minWidth: 36, height: 28, borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--bg-secondary)', color: active ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d]}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drug selector */}
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 12,
      }}>
        <input type="text" value={pkSearch} onChange={e => setPkSearch(e.target.value)}
          placeholder={drugDoses.length === 0 ? 'Начните вводить название...' : 'Поиск препарата...'}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, marginBottom: 6,
            boxSizing: 'border-box' }} />

        {/* Drug grid with ester grouping */}
        {(() => {
          const pkGrouped: { cls: string; label: string }[] = [];
          const pkSingles: typeof allSubstances = [];
          const seenCls = new Set<string>();
          for (const s of pkFiltered) {
            if (INJECTABLE_WITH_ESTERS.has(s.class)) {
              if (!seenCls.has(s.class)) { seenCls.add(s.class); pkGrouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
            } else { pkSingles.push(s); }
          }
          return (<>
            {(showAllDrugs || pkClass || pkSearch) && (pkGrouped.length + pkSingles.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {pkGrouped.map(g => (
                  <div key={g.cls} onClick={() => setPkEsterPopup({ baseClass: g.cls, label: g.label })} style={{
                    padding:'8px 9px', borderRadius:8, cursor:'pointer',
                    background:'var(--bg-secondary)', border:'1px solid var(--accent)',
                  }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Эфиры</div>
                  </div>
                ))}
                {pkSingles.map(s => (
                  <div key={s.id} onClick={() => addDrug(s.id)} style={{
                    padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                      <span>{CLASS_LABELS[s.class] || s.class}</span>
                      <span>{s.pk?.halfLifeHours ? `${(s.pk.halfLifeHours / 24).toFixed(1)} дн` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showAllDrugs && !pkClass && !pkSearch && drugDoses.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                Выберите класс или начните поиск
              </div>
            )}

            {pkFiltered.length === 0 && (pkClass || pkSearch) && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                Все препараты этого класса уже добавлены
              </div>
            )}
          </>);
        })()}

        {/* PK ester popup */}
        {pkEsterPopup && (
          <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setPkEsterPopup(null)}>
            <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{pkEsterPopup.label} — выберите эфир</h3>
              {allSubstances.filter(p => p.class === pkEsterPopup.baseClass).map(p => (
                <div key={p.id} onClick={() => { addDrug(p.id); setPkEsterPopup(null); }} style={{
                  padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                  background:'var(--bg-secondary)', border:'1px solid var(--border)',
                }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                    T½={(p.pk.halfLifeHours/24).toFixed(1)}дн {p.esters?.[0] ? `| ${p.esters[0]}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Run simulation */}
      <div style={{ marginBottom: 12 }}>
        <button onClick={runSimulation} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
          cursor: 'pointer',
        }}>▶ Запустить симуляцию</button>
      </div>

      {simResult && (
        <div>
          {/* PK metrics */}
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 8, fontSize: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Cmax</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{simResult.peak.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг/л</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Cmin</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{simResult.trough.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг/л</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>SS</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>≈{simResult.ssDays}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>дн</div>
              </div>
            </div>
            {simResult.peak > 50 && (
              <div style={{ color: '#ff1744', fontWeight: 600, fontSize: 10, textAlign: 'center', padding: '4px 8px', background: 'rgba(255,23,68,0.08)', borderRadius: 6 }}>
                ⚠ Высокая пиковая концентрация — риск побочных эффектов
              </div>
            )}
            {simResult.points.length > 0 && simResult.points[simResult.points.length - 1].tol > 0.3 && (
              <div style={{ color: '#ff9100', fontWeight: 600, fontSize: 10, textAlign: 'center', padding: '4px 8px', background: 'rgba(255,145,0,0.08)', borderRadius: 6, marginTop: 4 }}>
                ⚠ Толерантность {(simResult.points[simResult.points.length - 1].tol * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {/* Chart */}
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: 8, marginBottom: 8,
          }}>
            {chart}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
              <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>━</span> Суммарная</span>
              {simResult.perDrug.map((d, i) => (
                <span key={d.substanceId}><span style={{ color: DRUG_COLORS[i % DRUG_COLORS.length], fontWeight: 700 }}>- -</span> {d.name}</span>
              ))}
              <span><span style={{ color: '#4caf50', fontWeight: 700 }}>━</span> Эффект</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DosageCalculatorTab: React.FC = () => {
  const [dosageSub, setDosageSub] = useState<'dosage' | 'androgen' | 'peptides'>('dosage');
  const allPharma = Object.values(PHARMA_DB).filter((s) => PHARMA_CLASSES.includes(s.class as PharmaClass));
  const [drug, setDrug] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dosageClass, setDosageClass] = useState('');
  const [doseMode, setDoseMode] = useState<'per_kg' | 'weekly'>('per_kg');
  const [mgKg, setMgKg] = useState(2);
  const [weeklyMg, setWeeklyMg] = useState(500);
  const [weight, setWeight] = useState(90);
  const [injectionsPerWeek, setInjectionsPerWeek] = useState(2);
  const [concentration, setConcentration] = useState(250);
  const [vialMl, setVialMl] = useState(10);
  const [syringeMl, setSyringeMl] = useState(1);
  const [doseResult, setDoseResult] = useState<ReturnType<typeof calculateDose> | null>(null);
  const [esterPopup, setEsterPopup] = useState<{ baseClass: string; label: string } | null>(null);

  const subDetail = drug ? getPharmaDetail(drug) : null;
  const handleDrugChange = (id: string) => {
    setDrug(id);
    setEsterPopup(null);
    const sub = PHARMA_DB[id];
    if ((sub as any)?.concentration) setConcentration(Number((sub as any).concentration));
  };

  const run = () => {
    if (!drug) return;
    const baseMg = doseMode === 'per_kg' ? mgKg * weight : weeklyMg;
    const perInjectionMg = baseMg / Math.max(1, injectionsPerWeek);
    const dose = calculateDose({
      targetDoseMg: perInjectionMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: syringeMl,
      vialVolumeMl: vialMl,
      divisionsPerMl: 100,
    });
    setDoseResult(dose);
  };

  useEffect(() => { run(); }, [drug, doseMode, mgKg, weeklyMg, weight, injectionsPerWeek, concentration, vialMl, syringeMl]);

  const weeklyTotal = doseMode === 'per_kg' ? mgKg * weight : weeklyMg;
  const perInjectionMg = weeklyTotal / Math.max(1, injectionsPerWeek);
  const wastePerVial = vialMl && doseResult ? Math.max(0, vialMl - (doseResult?.dosesPerVial || 0) * doseResult.volumeMl) : 0;

  const KEEP_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','pct_gonadotropin']);
  const pharmaFiltered = allPharma.filter(p => KEEP_CLASSES.has(p.class));
  const grouped: { type: 'class'; cls: string; label: string }[] = [];
  const singles: typeof pharmaFiltered = [];
  const seenClasses = new Set<string>();
  for (const p of pharmaFiltered) {
    if (INJECTABLE_WITH_ESTERS.has(p.class)) {
      if (!seenClasses.has(p.class)) { seenClasses.add(p.class); grouped.push({ type:'class', cls: p.class, label: CLASS_LABELS[p.class] || p.class }); }
    } else { singles.push(p); }
  }

  return (
    <div>
      {/* Ester popup */}
      {esterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setEsterPopup(null)}>
          <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{esterPopup.label} — выберите эфир</h3>
            {pharmaFiltered.filter(p => p.class === esterPopup.baseClass).map(p => (
              <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
              }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  T½={(p.pk.halfLifeHours/24).toFixed(1)}дн {p.esters?.[0] ? `| Эфир: ${p.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab pills */}
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {(['dosage','androgen','peptides'] as const).map(t => (
          <button key={t} onClick={() => setDosageSub(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: dosageSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: dosageSub === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${dosageSub === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'dosage' ? '💉 Фармакология' : t === 'androgen' ? '🧬 Андрогенный индекс' : '🧪 Пептиды'}</button>
        ))}
      </div>

      {dosageSub === 'dosage' && <><div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 12,
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--accent)' }}>💉 Фармакология</h3>

        {/* Drug cards grid: grouped injectable classes + singles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 5, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
          {grouped.map(g => (
            <div key={g.cls} onClick={() => setEsterPopup({ baseClass: g.cls, label: g.label })} style={{
              padding:'10px 10px', borderRadius:8, cursor:'pointer',
              background:'var(--bg-secondary)', border:'1px solid var(--accent)',
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Выбрать эфир</div>
            </div>
          ))}
          {singles.map(p => {
            const isSelected = drug === p.id;
            return (
              <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                padding:'8px 10px', borderRadius:8, cursor:'pointer',
                background: isSelected ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                border: isSelected ? '1.5px solid #00e68a' : '1px solid var(--border)',
              }}>
                <div style={{ fontSize:11, fontWeight:600, color: isSelected ? '#00e68a' : 'var(--text)', marginBottom:2 }}>{p.name}</div>
                <div style={{ fontSize:9, color:'var(--text-dim)' }}>{CLASS_LABELS[p.class] || p.class}</div>
              </div>
            );
          })}
        </div>

        {drug && subDetail && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}><b style={{ color: 'var(--text)' }}>Концентрация:</b> {(subDetail as any).concentration || '—'} мг/мл</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}><b style={{ color: 'var(--text)' }}>Период полувыведения:</b> {subDetail.pk?.halfLifeHours ? formatHalfLife(subDetail.pk.halfLifeHours) : '—'}</div>
          </div>
        )}

        {/* Pill toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => setDoseMode('per_kg')} style={{
            flex: 1, padding: '7px 0', borderRadius: 20, fontSize: 11, fontWeight: doseMode === 'per_kg' ? 700 : 400, cursor: 'pointer',
            background: doseMode === 'per_kg' ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            border: doseMode === 'per_kg' ? '1.5px solid #00e68a' : '1px solid var(--border)',
            color: doseMode === 'per_kg' ? '#00e68a' : 'var(--text-dim)',
          }}>мг/кг/нед</button>
          <button onClick={() => setDoseMode('weekly')} style={{
            flex: 1, padding: '7px 0', borderRadius: 20, fontSize: 11, fontWeight: doseMode === 'weekly' ? 700 : 400, cursor: 'pointer',
            background: doseMode === 'weekly' ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            border: doseMode === 'weekly' ? '1.5px solid #00e68a' : '1px solid var(--border)',
            color: doseMode === 'weekly' ? '#00e68a' : 'var(--text-dim)',
          }}>мг/нед</button>
        </div>

        {/* Input fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {doseMode === 'per_kg' ? (
            <>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>мг/кг/нед</label>
                <input type="number" value={mgKg} onChange={(e) => setMgKg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Вес (кг)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </>
          ) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Недельная доза (мг/нед)</label>
              <input type="number" value={weeklyMg} onChange={(e) => setWeeklyMg(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Инъекций/нед</label>
            <select value={injectionsPerWeek} onChange={(e) => setInjectionsPerWeek(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(v => <option key={v} value={v}>{v}x/нед</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Конц-ция (мг/мл)</label>
            <input type="number" value={concentration} onChange={(e) => setConcentration(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Флакон (мл)</label>
            <input type="number" value={vialMl} onChange={(e) => setVialMl(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Шприц (мл)</label>
            <select value={syringeMl} onChange={(e) => setSyringeMl(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
              {[0.3, 0.5, 1, 3, 5, 10, 20].map(v => <option key={v} value={v}>{v} мл</option>)}
            </select>
          </div>
        </div>
      </div>

      {doseResult ? (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--accent)' }}>📋 Результат</h3>
            <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Недельная доза</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{weeklyTotal.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>мг/нед</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>На инъекцию</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{perInjectionMg.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>мг × {injectionsPerWeek}/нед</div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Объём инъекции</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)' }}>{doseResult.volumeMl}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>мл</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Деления шприца</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{doseResult.divisions}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Доз / флакон</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{doseResult.dosesPerVial || '—'}</div>
              </div>
            </div>
            {doseResult.flags.length > 0 ? (
              <div style={{ background: 'rgba(255,152,0,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#ff9800' }}>
                ⚠ {doseResult.flags.join(', ')}
              </div>
            ) : (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#00e68a', textAlign: 'center' }}>
                ✓ Готово к введению
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 180, color: 'var(--text-dim)', fontSize: 12,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💉</div>
            <div>Выберите препарат и дозировку,</div>
            <div>чтобы рассчитать объём инъекции</div>
          </div>
        </div>
      )}

      {/* ═══ Androgenic Index Calculator ═══ */}
      </>}
      {dosageSub === 'androgen' && <AndrogenicIndexCalculator />}
      {dosageSub === 'peptides' && <PeptideCalcTab />}
    </div>
  );
};

const DRUG_OPTIONS = Object.keys(DRUG_THRESHOLDS);

const AndrogenicIndexCalculator: React.FC = () => {
  const [entries, setEntries] = useState<{ drug: string; doseMgWeek: number }[]>([
    { drug: 'testosterone_enanthate', doseMgWeek: 300 }
  ]);
  const [aiResult, setAiResult] = useState<number | null>(null);
  const [aiEsterPopup, setAiEsterPopup] = useState<{ baseClass: string; label: string; entryIdx: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);

  const allAiDrugs = useMemo(() => {
    return DRUG_OPTIONS.filter(d => PHARMA_DB[d]?.name && DRUG_THRESHOLDS[d]?.androgenicity);
  }, []);

  const aiFiltered = allAiDrugs.map(d => PHARMA_DB[d]).filter((s): s is NonNullable<typeof s> => !!s);
  const aiKeepClasses = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','dht_derivative','pct_gonadotropin','insulin','igf1','mgf']);
  const aiKeep = aiFiltered.filter(s => aiKeepClasses.has(s.class));
  const aiGrouped: { cls: string; label: string }[] = [];
  const aiSingles = new Set<string>();
  const seenCls = new Set<string>();
  for (const s of aiKeep) {
    if (INJECTABLE_WITH_ESTERS.has(s.class)) {
      if (!seenCls.has(s.class)) { seenCls.add(s.class); aiGrouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
    } else { aiSingles.add(s.id); }
  }

  const addEntry = () => setEntries([...entries, { drug: 'testosterone_enanthate', doseMgWeek: 300 }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const setDrugFor = (i: number, drugId: string) => {
    const next = [...entries];
    next[i] = { ...next[i], drug: drugId };
    setEntries(next);
    setShowGrid(false);
  };
  const setDoseFor = (i: number, val: number) => {
    const next = [...entries];
    next[i] = { ...next[i], doseMgWeek: val };
    setEntries(next);
  };

  const calcAI = () => {
    let total = 0;
    entries.forEach(e => {
      const dt = DRUG_THRESHOLDS[e.drug];
      if (dt) total += e.doseMgWeek * dt.androgenicity / 100;
    });
    setAiResult(total);
  };

  return (
    <div style={{
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 12, padding: '14px 16px', marginTop: 8,
    }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>📊 Андрогенный индекс стека</h3>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.4 }}>
        Σ (доза × AR_affinity / 100) — выберите препараты из каталога ниже
      </div>

      {/* Drug selection grid (like Фармакология) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 5, maxHeight: 160, overflowY: 'auto', marginBottom: 12 }}>
        {aiGrouped.map(g => (
          <div key={g.cls} onClick={() => setAiEsterPopup({ baseClass: g.cls, label: g.label, entryIdx: entries.length - 1 })} style={{
            padding:'10px 8px', borderRadius:8, cursor:'pointer',
            background:'var(--bg-secondary)', border:'1px solid var(--accent)',
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Выбрать эфир</div>
          </div>
        ))}
        {Array.from(aiSingles).slice(0, 20).map(id => {
          const s = PHARMA_DB[id];
          if (!s) return null;
          return (
            <div key={id} onClick={() => setDrugFor(0, id)} style={{
              padding:'8px 8px', borderRadius:8, cursor:'pointer',
              background:'var(--bg-secondary)', border:'1px solid var(--border)',
            }}>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{s.name}</div>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>AR {DRUG_THRESHOLDS[id]?.androgenicity}%</div>
            </div>
          );
        })}
      </div>

      {/* Selected entries with dose inputs */}
      {entries.map((entry, i) => (
        <div key={i} style={{
          background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px',
          marginBottom: 8, border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', minWidth: 16 }}>#{i + 1}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
              {PHARMA_DB[entry.drug]?.name || entry.drug}
            </span>
            {entries.length > 1 && (
              <button onClick={() => removeEntry(i)} style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 11,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" value={entry.doseMgWeek} onChange={e => setDoseFor(i, parseFloat(e.target.value) || 0)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12,
                boxSizing: 'border-box' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>мг/нед</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
            AR {DRUG_THRESHOLDS[entry.drug]?.androgenicity}% · Вклад: {(entry.doseMgWeek * (DRUG_THRESHOLDS[entry.drug]?.androgenicity || 0) / 100).toFixed(1)}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={addEntry} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11,
          border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)',
        }}>+ Добавить препарат</button>
        <button onClick={calcAI} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11,
        }}>Рассчитать</button>
      </div>

      {aiResult !== null && (
        <div style={{ marginTop: 10, background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Андрогенный индекс стека</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: aiResult > 3 ? '#ef4444' : aiResult > 1.5 ? '#f59e0b' : 'var(--accent)' }}>{aiResult.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            {aiResult > 3 ? '⚡ Высокая андрогенная нагрузка' : aiResult > 1.5 ? '⚠ Умеренная' : '✓ Низкая'}
          </div>
        </div>
      )}

      {/* AI ester popup */}
      {aiEsterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setAiEsterPopup(null)}>
          <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{aiEsterPopup.label} — выберите эфир</h3>
            {aiKeep.filter(s => s.class === aiEsterPopup.baseClass).map(s => (
              <div key={s.id} onClick={() => { setDrugFor(aiEsterPopup.entryIdx, s.id); setAiEsterPopup(null); }} style={{
                padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
              }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  AR {DRUG_THRESHOLDS[s.id]?.androgenicity}% {s.esters?.[0] ? `| ${s.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PeptideCalcTab: React.FC = () => {
  const [pepTab, setPepTab] = useState<'peptides' | 'growth'>('peptides');
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [pepAmount, setPepAmount] = useState(2);
  const [pepAmountUnit, setPepAmountUnit] = useState<'mg' | 'mcg'>('mg');
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepDoseUnit, setPepDoseUnit] = useState<'mg' | 'mcg'>('mcg');
  const [pepSyringe, setPepSyringe] = useState<'U100_1ml' | 'U100_05ml' | 'U100_03ml' | 'U40_1ml'>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Mon', 'Wed', 'Fri']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepResult, setPepResult] = useState<{ dilution: DilutionResult; effective: BioavailabilityResult; pk: PKResult } | null>(null);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const runPepCalc = () => {
    const p = PEPTIDE_DB[peptideId];
    if (!p) return;
    const bio = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    const dilInput: DilutionInput = {
      amountValue: pepAmount, amountUnit: pepAmountUnit,
      dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: pepDoseUnit,
      syringeType: pepSyringe,
    };
    const dilution = computeDilution(dilInput);
    const effective = computeEffectiveDose(dilution.doseMcg, bio);
    const pk = computePK({
      doseMcg: dilution.doseMcg, bioAvg: bio.avg,
      tHalfHours: p.tHalfHours, scheduleDays: pepSchedule, totalDays: pepTotalDays,
    });
    setPepResult({ dilution, effective, pk });
  };

  const growthSel = growthId ? getPharmaDetail(growthId) : null;

  return (
    <div>
      <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
        <h3 style={{ margin:'0 0 4px 0', fontSize:14, color:'var(--accent)' }}>🧪 Калькулятор пептидов</h3>
        <p style={{ fontSize:11, color:'var(--text-dim)', margin:0 }}>Разведение, PK‑модель, риски и протоколы</p>
      </div>

      {/* Unified peptide + growth factor selector */}
      <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
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
            const GROWTH_CLASSES = new Set(['peptide_ghrh','peptide_ghrp','igf1','mgf','insulin','peptide_gnrh','peptide_fat_loss','peptide_other']);
            const inPeptideDb = new Set(PEPTIDE_LIST.map(p => (PEPTIDE_DB[p.id]?.name||'').toLowerCase()));
            return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has((s.name||'').toLowerCase())).map(s => {
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
            <b>{PHARMA_DB[growthId].name}</b> — T½ {(PHARMA_DB[growthId].pk?.halfLifeHours ?? 0).toFixed(0)}ч, био {((PHARMA_DB[growthId].pk?.bioavailability ?? 0) * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Dilution calculator */}
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>💧 Разведение</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Во флаконе</label>
              <div style={{ display:'flex', gap:4 }}>
                <input type="number" value={pepAmount} onChange={e => setPepAmount(parseFloat(e.target.value) || 0)} style={{ width:'60%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12 }} />
                <select value={pepAmountUnit || ''} onChange={e => setPepAmountUnit(e.target.value as 'mg'|'mcg')} style={{ flex:1, padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                  <option value="mg">мг</option><option value="mcg">мкг</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Растворитель (мл)</label>
              <input type="number" step="0.1" value={pepDilution} onChange={e => setPepDilution(parseFloat(e.target.value) || 0)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Доза</label>
              <div style={{ display:'flex', gap:4 }}>
                <input type="number" value={pepDose} onChange={e => setPepDose(parseFloat(e.target.value) || 0)} style={{ width:'60%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12 }} />
                <select value={pepDoseUnit || ''} onChange={e => setPepDoseUnit(e.target.value as 'mg'|'mcg')} style={{ flex:1, padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                  <option value="mcg">мкг</option><option value="mg">мг</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Шприц</label>
              <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as 'U100_1ml' | 'U100_05ml' | 'U100_03ml' | 'U40_1ml')} style={{ width:'100%', padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Способ введения</label>
              <select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width:'100%', padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Course params */}
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📅 Параметры курса</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
            {WEEK.map(d => (
              <button key={d} onClick={() => setPepSchedule(pepSchedule.includes(d) ? pepSchedule.filter(x => x !== d) : [...pepSchedule, d].sort((a,b) => WEEK.indexOf(a)-WEEK.indexOf(b)))} style={{
                padding:'5px 10px', borderRadius:16, fontSize:10, cursor:'pointer',
                background: pepSchedule.includes(d) ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                border: pepSchedule.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: pepSchedule.includes(d) ? '#00e68a' : 'var(--text-dim)', fontWeight: pepSchedule.includes(d) ? 700 : 400,
              }}>{d === 'Mon' ? 'Пн' : d === 'Tue' ? 'Вт' : d === 'Wed' ? 'Ср' : d === 'Thu' ? 'Чт' : d === 'Fri' ? 'Пт' : d === 'Sat' ? 'Сб' : 'Вс'}</button>
            ))}
          </div>
          <div>
            <label style={{ fontSize:9, color:'var(--text-dim)' }}>Длительность (дней)</label>
            <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(parseFloat(e.target.value) || 0)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
          </div>
        </div>

        <button onClick={runPepCalc} style={{
          width:'100%', padding:12, borderRadius:8, border:'none', cursor:'pointer',
          background:'linear-gradient(135deg, #00e68a, #00c853)', color:'#000', fontWeight:700, fontSize:13, marginBottom:12,
        }}>🧬 Рассчитать</button>

        {/* Results */}
        {pepResult && (<>
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📊 Результаты разведения</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', fontSize:11 }}>
              <span style={{ color:'var(--text-dim)' }}>Концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</span>
              <span style={{ color:'var(--text-dim)' }}>Объём дозы:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.doseVolumeMl.toFixed(3)} мл</span>
              <span style={{ color:'var(--text-dim)' }}>Деления шприца:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.syringeUnitsDisplay}</span>
              <span style={{ color:'var(--text-dim)' }}>Доз во флаконе:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.dosesPerVial.toFixed(1)}</span>
            </div>
          </div>

          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>💉 Биодоступность ({ROUTE_LABELS[pepRoute]})</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:11 }}>
              <div style={{ textAlign:'center', background:'var(--bg-secondary)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Мин</div>
                <div style={{ fontWeight:600 }}>{pepResult.effective.effectiveMinMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ textAlign:'center', background:'rgba(0,230,138,0.1)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Средняя</div>
                <div style={{ fontWeight:700, color:'#00e68a' }}>{pepResult.effective.effectiveAvgMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ textAlign:'center', background:'var(--bg-secondary)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Макс</div>
                <div style={{ fontWeight:600 }}>{pepResult.effective.effectiveMaxMcg.toFixed(0)} мкг</div>
              </div>
            </div>
          </div>

          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>📈 PK‑модель</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', fontSize:10, marginBottom:8 }}>
              <span style={{ color:'var(--text-dim)' }}>Макс. концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.pk.maxConcentration.toFixed(1)}</span>
              <span style={{ color:'var(--text-dim)' }}>Средняя концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.pk.avgConcentration.toFixed(1)}</span>
              <span style={{ color:'var(--text-dim)' }}>Steady-state (день):</span><span style={{ fontWeight:600 }}>~{pepResult.pk.steadyStateDay}</span>
              <span style={{ color:'var(--text-dim)' }}>t½ (дни):</span><span style={{ fontWeight:600 }}>{pepResult.pk.halfLifeDays.toFixed(2)}</span>
            </div>
            <div style={{ maxHeight:140, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
              <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--bg-secondary)', position:'sticky', top:0 }}>
                    <th style={{ padding:'2px 4px', textAlign:'left' }}>День</th>
                    <th style={{ padding:'2px 4px' }}>Инъекция</th>
                    <th style={{ padding:'2px 4px', textAlign:'right' }}>Конц.</th>
                  </tr>
                </thead>
                <tbody>
                  {pepResult.pk.days.map(d => (
                    <tr key={d.day} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:d.inject ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                      <td style={{ padding:'2px 4px' }}>{d.day}</td>
                      <td style={{ padding:'2px 4px', textAlign:'center' }}>{d.inject ? '💉' : ''}</td>
                      <td style={{ padding:'2px 4px', textAlign:'right', fontFamily:'monospace' }}>{d.concentration.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risks */}
          {PEPTIDE_DB[peptideId] && (
            <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>⚠ Риски: {PEPTIDE_DB[peptideId].shortName}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {computePeptideRisks(PEPTIDE_DB[peptideId]).map((r, i) => (
                  <div key={i} style={{
                    padding:'4px 8px', borderRadius:6, fontSize:10,
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
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>🔗 Синергии и конфликты</div>
            {getPeptideSynergiesFor(peptideId).length > 0 && (
              <div style={{ marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#22c55e', fontWeight:600 }}>Синергии:</span>
                {getPeptideSynergiesFor(peptideId).map(s => (
                  <span key={s.partner} style={{ fontSize:9, marginLeft:6, color:'#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                ))}
              </div>
            )}
            {getPeptideConflictsFor(peptideId).length > 0 && (
              <div>
                <span style={{ fontSize:10, color:'#ef4444', fontWeight:600 }}>Конфликты:</span>
                {getPeptideConflictsFor(peptideId).map(c => (
                  <span key={c.partner} style={{ fontSize:9, marginLeft:6, color:'#ef4444' }}>{c.partnerName} ({c.severity})</span>
                ))}
              </div>
            )}
            {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
              <span style={{ fontSize:10, color:'var(--text-dim)' }}>Нет данных</span>
            )}
          </div>

          {/* Protocol generator */}
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>🎯 Генератор протокола по цели</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
                <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                  padding:'5px 10px', borderRadius:6, fontSize:10, cursor:'pointer',
                  background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', fontWeight:500,
                }}>
                  {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
                </button>
              ))}
            </div>
            {pepProtocol && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:10 }}>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>{pepProtocol.goal}: оценка синергии <span style={{ color:'#8b5cf6' }}>{pepProtocol.synergyScore.toFixed(1)}</span></div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {pepProtocol.peptides.map(p => (
                    <span key={p.id} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontWeight:600 }}>
                      {p.shortName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>)}
      {/* ─── GROWTH FACTOR DETAIL (always visible when selected) ─── */}
      {growthId && growthSel && (
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>{growthSel.name}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10, color:'var(--text-dim)', lineHeight:1.6 }}>
            <span><b>Класс:</b> {CLASS_LABELS[growthSel.class] || growthSel.class}</span>
            <span><b>T½:</b> {growthSel.pk?.halfLifeHours ? `${(growthSel.pk.halfLifeHours).toFixed(0)}ч` : '—'}</span>
            <span><b>Биодоступность:</b> {growthSel.pk?.bioavailability ? `${(growthSel.pk.bioavailability * 100).toFixed(0)}%` : '—'}</span>
            <span><b>Vd:</b> {growthSel.pk?.Vd ? `${growthSel.pk.Vd} л` : '—'}</span>
          </div>

        </div>
      )}
    </div>
  );
};

const InteractionCheckerTab: React.FC = () => {
  const linked = useDataLink();
  const [interactSub, setInteractSub] = useState<'interactions' | 'synergies'>('interactions');
  // Filter to show only pharma core substances (AAS, PCT, peptides — everything in PHARMA_DB)
  const PHARMA_INTERACT_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','peptide_ghrh','peptide_ghrp','peptide_gnrh','peptide_fat_loss','peptide_other']);
  const allSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      !!s?.name && PHARMA_INTERACT_FILTER.has(s.class)
    );
  }, []);
  // Pharma-only synergy pairs (AAS + peptides + PCT)
  const PHARMA_INTERACT_FILTER_SYNERGY = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','peptide_ghrh','peptide_ghrp','peptide_gnrh','peptide_fat_loss','peptide_other']);
  // Map SYNERGY_PAIRS substance IDs to PHARMA_DB keys
  const synergyToPharmaId = (id: string): string => {
    const map: Record<string, string> = {
      testosterone_enanthate: 'test_enan', testosterone_cypionate: 'test_cyp', testosterone_propionate: 'test_prop',
      trenbolone_acetate: 'tren_acet', trenbolone_enanthate: 'tren_enan', nandrolone_decanoate: 'deca',
      nandrolone_phenylprop: 'npp', boldenone_undecylenate: 'bold_undec', methenolone_enanthate: 'prim_enan',
      methandienone: 'methand', oxandrolone: 'oxan', oxymetholone: 'anadrol', stanozolol: 'stan',
      drostanolone_propionate: 'masteron', drostanolone_enanthate: 'masteron_enan',
      cabergoline: 'caberg', anastrozole: 'anastro', hcg: 'hcg', tamoxifen: 'tamox',
      clomiphene: 'clomi', letrozole: 'letrozole', raloxifene: 'raloxifene',
    };
    return map[id] || id;
  };

  // Build per-substance synergy map: substanceId → list of synergy pairs
  const pharmaSynergyMap = useMemo(() => {
    const map: Record<string, Array<{ partnerId: string; partnerName: string; pair: typeof SYNERGY_PAIRS[0] }>> = {};
    const pharmaIds = new Set(allSubstances.map(s => s.id));
    for (const p of SYNERGY_PAIRS) {
      const aKey = synergyToPharmaId(p.substanceA);
      const bKey = synergyToPharmaId(p.substanceB);
      if (!pharmaIds.has(aKey) || !pharmaIds.has(bKey)) continue;
      if (!map[aKey]) map[aKey] = [];
      if (!map[bKey]) map[bKey] = [];
      const aName = (PHARMA_DB[aKey]?.name || p.substanceA).replace(/\(.*\)/, '').trim();
      const bName = (PHARMA_DB[bKey]?.name || p.substanceB).replace(/\(.*\)/, '').trim();
      map[aKey].push({ partnerId: bKey, partnerName: bName, pair: p });
      map[bKey].push({ partnerId: aKey, partnerName: aName, pair: p });
    }
    return map;
  }, []);

  const pharmaSubstancesWithSynergies = useMemo(() => {
    return allSubstances.filter(s => pharmaSynergyMap[s.id]?.length > 0).sort((a, b) => (b.name||'').localeCompare(a.name||''));
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>(['', '']);
  const [doseMgWk, setDoseMgWk] = useState(300);
  const [interactSearch, setInteractSearch] = useState('');
  useEffect(() => {
    const courseIds = (linked.course || []).map(c => c.substanceId).filter(Boolean);
    if (courseIds.length > 0 && selectedIds.every(id => !id)) {
      setSelectedIds(courseIds.slice(0, Math.min(4, courseIds.length)));
    }
  }, [(linked.course || []).length]);

  const addDrug = () => setSelectedIds([...selectedIds, '']);
  const removeDrug = (idx: number) => setSelectedIds(selectedIds.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, value: string) => {
    const updated = [...selectedIds];
    updated[idx] = value;
    setSelectedIds(updated);
  };

  const validIds = selectedIds.filter(Boolean);

  const interactFiltered = interactSearch
    ? allSubstances.filter(p => (p.name||'').toLowerCase().includes(interactSearch.toLowerCase()) || (p.class||'').toLowerCase().includes(interactSearch.toLowerCase()))
    : allSubstances;

  const unusedSubstances = useMemo(() => {
    return interactFiltered.filter(p => !selectedIds.includes(p.id));
  }, [interactFiltered, selectedIds]);

  const alerts = useMemo(() => {
    if (validIds.length < 2) return null;

    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: doseMgWk,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));

    try {
      return checkDrugInteractions(course);
    } catch (e) {
      return [];
    }
  }, [selectedIds, doseMgWk]);

  const hasAlerts = alerts && alerts.length > 0;

  // Support DB cross-interactions
  const supportCrossAlerts = useMemo(() => {
    if (validIds.length < 2) return [];
    const results: SupportInteraction[] = [];
    for (const id of validIds) {
      const interactions = findInteractionsForSubstance(id);
      for (const inter of interactions) {
        const other = inter.substanceA === id ? inter.substanceB : inter.substanceA;
        if (validIds.includes(other) && !results.some(r => r.interactionId === inter.interactionId)) {
          results.push(inter);
        }
      }
    }
    return results;
  }, [validIds]);

  const hasSupportAlerts = supportCrossAlerts.length > 0;

  return (
    <div>
      {/* Sub-tab pills */}
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {(['interactions','synergies'] as const).map(t => (
          <button key={t} onClick={() => setInteractSub(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: interactSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: interactSub === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${interactSub === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'interactions' ? '⚡ Взаимодействия' : '💥 Синергии и комбинации'}</button>
        ))}
      </div>

      {interactSub === 'synergies' ? (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>💥 Синергии по препаратам</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
            Синергетические пары для каждого препарата каталога фармакологии и пептидов
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pharmaSubstancesWithSynergies.map(sub => {
              const synergies = pharmaSynergyMap[sub.id] || [];
              return (
                <div key={sub.id} style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                    💊 {sub.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {synergies.map((s, i) => {
                      const p = s.pair;
                      const stColor = p.synergyType === 'synergistic' ? '#00e68a' : p.synergyType === 'additive' ? '#3b82f6' : p.synergyType === 'potentiative' ? '#f97316' : '#a855f7';
                      const stBg = p.synergyType === 'synergistic' ? 'rgba(0,230,138,0.08)' : p.synergyType === 'additive' ? 'rgba(59,130,246,0.08)' : p.synergyType === 'potentiative' ? 'rgba(249,115,22,0.08)' : 'rgba(168,85,247,0.08)';
                      return (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: stBg, border: `1px solid ${stColor}30` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${stColor}20`, color: stColor }}>
                              {p.synergyType === 'synergistic' ? '⊕ Синергия' : p.synergyType === 'additive' ? '+ Аддитивно' : p.synergyType === 'potentiative' ? '↗ Усиление' : '↔ Дополнение'}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: stColor }}>{Math.round(p.strength * 100)}%</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>+ {s.partnerName}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>{decodeGarbled(p.mechanism).slice(0, 150)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pharmaSubstancesWithSynergies.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 12 }}>
                Нет синергий для отображения
              </div>
            )}
          </div>
        </div>
      ) : (<>
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '14px 16px',
      }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>⚡ Взаимодействия по препаратам</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
          Информация о взаимодействиях для каждого препарата каталога фармакологии и пептидов
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allSubstances.map(sub => {
            const conflicts = sub.conflicts || [];
            const linkedSubs = (sub.linkedSubstances || []).filter(ls => PHARMA_DB[ls.id]);
            const instructions = sub.specialInstructions || [];
            if (conflicts.length === 0 && linkedSubs.length === 0 && instructions.length === 0) return null;
            return (
              <div key={sub.id} style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                  💊 {sub.name}
                </div>
                {conflicts.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>🔴 Конфликты</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {conflicts.map((c, i) => (
                        <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.15)` }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>{c.with}</div>
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>{c.effect}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {linkedSubs.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>🟢 Связанные вещества</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {linkedSubs.map((ls, i) => (
                        <span key={i} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4,
                          background: ls.type === 'synergy' ? 'rgba(34,197,94,0.08)' : 'rgba(255,23,68,0.08)',
                          border: `1px solid ${ls.type === 'synergy' ? 'rgba(34,197,94,0.2)' : 'rgba(255,23,68,0.2)'}`,
                          color: ls.type === 'synergy' ? '#22c55e' : '#ff1744',
                        }}>
                          {ls.type === 'synergy' ? '⊕' : '⊖'} {PHARMA_DB[ls.id]?.name || ls.id}: {ls.mechanism}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {instructions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>📋 Указания</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>{instructions.join(' · ')}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      </>)}
    </div>
  );
};

// ── MapperTab — Drug Stack → Pathology Mapper ──
const MapperTab: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const [manualDrugs, setManualDrugs] = useState<DrugEntry[]>([]);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugDose, setNewDrugDose] = useState(0);
  const [mapperResult, setMapperResult] = useState<MapperResult | null>(null);
  const [clinicalResult, setClinicalResult] = useState<any>(null);
  const [useCourse, setUseCourse] = useState(true);

  const knownNames = useMemo(() => getKnownDrugNames(), []);

  useEffect(() => {
    if (course.length > 0) {
      const drugs: DrugEntry[] = course.map(c => ({
        name: (c.substanceId||'').toLowerCase(),
        dosageMg: c.doseUnit === 'mg/wk'
          ? c.doseValue
          : c.doseUnit === 'mg' ? c.doseValue : c.doseValue * 1000,
      }));
      setMapperResult(mapStackToPathologies(drugs));
    }
  }, [course]);

  const handleRunManual = () => {
    const drugs = useCourse && course.length > 0
      ? course.map(c => ({ name: (c.substanceId||'').toLowerCase(), dosageMg: c.doseValue }))
      : [...manualDrugs];
    if (drugs.length === 0) return;
    setMapperResult(mapStackToPathologies(drugs));

    // Lazy-load clinical analysis
    import('../../engines/clinical-analyzer.engine').then(({ analyzeClinicalRisks }) => {
      const compoundNames = course.length > 0
        ? course.map(c => (c.substanceId||'').toLowerCase())
        : manualDrugs.map(d => d.name);
      const markers = (linked.labs || []).map(l => ({ code: l.code || l.name, value: l.value }));
      const s2 = linked.profile?.settings;
      const genetics = Object.keys(s2?.genetics || {}).filter(k => !!(s2?.genetics as any)?.[k]);
      const labDates = (linked.labs || []).map(l => l.date).filter(Boolean).sort().reverse();
      const weeksSinceLab = labDates[0] ? (Date.now() - new Date(labDates[0]).getTime()) / (7 * 24 * 3600 * 1000) : 52;
      const tWeeks = course.length > 0 ? course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0) : 4;

      setClinicalResult(analyzeClinicalRisks({ compounds: compoundNames, markers, tWeeks: Math.max(1, tWeeks), weeksSinceLab, genetics }));
    }).catch(console.error);
  };

  const addManualDrug = () => {
    const name = newDrugName.trim().toLowerCase();
    if (!name || manualDrugs.some(d => d.name === name)) return;
    setManualDrugs([...manualDrugs, { name, dosageMg: newDrugDose || 100 }]);
    setNewDrugName('');
    setNewDrugDose(0);
  };

  const removeManualDrug = (name: string) => {
    setManualDrugs(manualDrugs.filter(d => d.name !== name));
  };

  const markerInLabs = (marker: string): boolean => {
    return !!linked.labs?.some(l => l.code === marker || l.name === marker);
  };

  const getSeverityClass = (strength: number): string => {
    if (strength >= 2.0) return 'high';
    if (strength >= 1.2) return 'medium';
    return 'low';
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🧬 Маппер: Стек препаратов → Патологии органов</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          Алгоритм ищет в графе знаний все патологии для вашего стека.
          Стек-синергия: если 2+ препарата бьют по одной системе → кумулятивный удар.
          <br />
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setUseCourse(true)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, border: useCourse ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: useCourse ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            💊 Из курса ({course.length} преп.)
          </button>
          <button onClick={() => setUseCourse(false)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, border: !useCourse ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: !useCourse ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            ✏️ Вручную ({manualDrugs.length} преп.)
          </button>
        </div>

        {!useCourse && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={newDrugName} onChange={e => setNewDrugName(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
                <option value="">Выбрать препарат...</option>
                {knownNames.map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
              <input type="number" placeholder="" value={newDrugDose || ''}
                onChange={e => setNewDrugDose(parseFloat(e.target.value) || 0)}
                style={{ width: 80, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
              <button onClick={addManualDrug} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>+</button>
            </div>
            {manualDrugs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {manualDrugs.map(d => (
                  <span key={d.name} onClick={() => removeManualDrug(d.name)} style={{
                    padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                    fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  }}>{d.name} {d.dosageMg}мг ✕</span>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={handleRunManual} style={{
          width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', marginTop: 4,
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: 14,
        }}>▶ Запустить маппинг стека</button>
      </div>

      {mapperResult && (
        <>
          <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{mapperResult.activePathologies?.length ?? 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Патологии</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{mapperResult.requiredBiomarkers?.length ?? 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Биомаркеры</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: (mapperResult.unknownDrugs?.length ?? 0) > 0 ? '#f97316' : 'var(--text-dim)' }}>
                {mapperResult.knownDrugs}/{mapperResult.totalDrugs}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Распознано</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-dim)' }}>Активные патологии (по убыванию тяжести)</div>
          {(mapperResult.activePathologies || []).map(p => {
            const sev = getSeverityClass(p.cumulativeTriggerStrength);
            const ZONE_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f97316', low: '#eab308' };
            return (
              <div key={p.pathologyId} className="card" style={{ marginBottom: 8, borderLeft: `4px solid ${ZONE_COLORS[sev]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.pathologyLabel}</span>
                    <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: `${ZONE_COLORS[sev]}22`, color: ZONE_COLORS[sev], fontSize: 10, fontWeight: 600 }}>
                      {p.cumulativeTriggerStrength} ОЈ
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(p.contributingDrugs || []).map(d => (
                      <span key={d} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontSize: 10 }}>{d}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${Math.min(100, p.cumulativeTriggerStrength * 35)}%`, height: '100%', background: ZONE_COLORS[sev], borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {(p.contributingDrugs?.length ?? 0) > 1
                    ? ``
                    : ``}
                </div>
              </div>
            );
          })}

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-dim)' }}>
              🧪 Требуемые биомаркеры ({mapperResult.requiredBiomarkers?.length ?? 0})
            </div>
            <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>
              Зелёные — есть в ваших анализах, серые — необходимо сдать
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(mapperResult.requiredBiomarkers || []).map(m => {
                const has = markerInLabs(m);
                return (
                  <span key={m} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: has ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                    color: has ? '#00e68a' : 'var(--text-dim)',
                    border: `1px solid ${has ? 'rgba(0,230,138,0.3)' : 'var(--border)'}`,
                  }}>{has ? '✅ ' : '⬜ '}{m}</span>
                );
              })}
            </div>
          </div>

          {(mapperResult.unknownDrugs?.length ?? 0) > 0 && (
            <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                Неизвестные препараты: {(mapperResult.unknownDrugs || []).join(', ')}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                Эти препараты отсутствуют в графе знаний. Они исключены из расчёта.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Clinical Pathology Analysis ── */}
      {clinicalResult?.results?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#ec4899' }}>
            🏥 Клинические патологии ({clinicalResult.results.length})
          </div>

          {/* Summary */}
          <div className="card" style={{
            marginBottom: 10, padding: '8px 12px',
            background: (clinicalResult.overallMaxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.08)' :
              (clinicalResult.overallMaxRisk ?? 0) >= 50 ? 'rgba(249,115,22,0.06)' : 'rgba(0,230,138,0.04)',
            borderLeft: `3px solid ${(clinicalResult.overallMaxRisk ?? 0) >= 80 ? '#ef4444' : (clinicalResult.overallMaxRisk ?? 0) >= 50 ? '#f97316' : '#00e68a'}`,
          }}>
            <div style={{ fontSize: 11 }}>{clinicalResult.summary}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 9, color: 'var(--text-dim)' }}>
              <span>🧪 {clinicalResult.markersAnalyzed ?? 0} маркеров</span>
              <span>📋 {(clinicalResult.requiredLabPanel?.length ?? 0)} в панели</span>
              <span>🔬 {(clinicalResult.requiredInstrumental?.length ?? 0)} исследований</span>
            </div>
          </div>

          {/* Per-system accordion */}
          {(clinicalResult.systems || []).map((system: any) => (
            <details key={system?.systemKey || Math.random()} style={{ marginBottom: 6 }}>
              <summary style={{
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 600, listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {system?.icon || ''} {system?.systemName || ''}
                <span style={{
                  marginLeft: 'auto', padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  background: (system?.maxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.15)' :
                    (system?.maxRisk ?? 0) >= 50 ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.10)',
                  color: (system?.maxRisk ?? 0) >= 80 ? '#ef4444' : (system?.maxRisk ?? 0) >= 50 ? '#f97316' : '#00e68a',
                }}>{Math.round(system?.maxRisk ?? 0)}%</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({(system?.pathologies?.length ?? 0)})</span>
              </summary>
              <div style={{ padding: '4px 0 0 8px' }}>
                {(system?.pathologies || []).map((r: any) => {
                  const zoneColor = (r?.alertLevel ?? 0) >= 3 ? '#ef4444' : (r?.alertLevel ?? 0) >= 2 ? '#f97316' : (r?.alertLevel ?? 0) >= 1 ? '#eab308' : '#22c55e';
                  return (
                    <div key={r?.pathologyId || Math.random()} style={{
                      marginBottom: 6, padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${zoneColor}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{r?.pathologyName || ''}</span>
                        <span style={{ padding: '1px 5px', borderRadius: 3, background: `${zoneColor}20`, color: zoneColor, fontWeight: 600, fontSize: 9 }}>
                          {(r?.riskPercent ?? 0)}% — {(r?.status || '').split('(')[0].trim()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 8, color: 'var(--text-dim)' }}>
                        <span>Hill: {r?.hillScore ?? '—'}</span>
                        <span>MC95: {r?.severity95 ?? '—'}</span>
                        {(r?.contributingCompounds?.length ?? 0) > 0 && (
                          <span>Препараты: {(r?.contributingCompounds || []).join(', ')}</span>
                        )}
                      </div>
                      {(r?.alertLevel ?? 0) >= 2 && (
                        <div style={{ marginTop: 3, fontSize: 9, color: '#f97316' }}>
                          🔬 {r?.instrumental || ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      {!mapperResult && !clinicalResult && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧬</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {course.length > 0
              ? ``
              : ''}
          </div>
        </div>
      )}
    </div>
  );
};

// ── DiagnosticsTab — 5-Engine Advanced Diagnostics ──
const DiagnosticsTab: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const profile = linked.profile;

  // Drug stack
  const [diagDrugs, setDiagDrugs] = useState<DrugDoseInput[]>([]);
  const [useCourseDrugs, setUseCourseDrugs] = useState(true);

  // Manual drug entry
  const [manName, setManName] = useState('');
  const [manEster, setManEster] = useState('enanthate');
  const [manMg, setManMg] = useState(250);
  const [manFreq, setManFreq] = useState(2);

  // Vitals
  const [hrv, setHrv] = useState(55);
  const [rhr, setRhr] = useState(62);
  const [bpSys, setBpSys] = useState(125);
  const [bpDia, setBpDia] = useState(80);

  // Patient
  const s = profile?.settings;
  const dob = s?.dateOfBirth ? new Date(s.dateOfBirth) : null;
  const calcAge = dob ? Math.floor((Date.now() - dob.getTime()) / 31556952000) : 30;
  const [age, setAge] = useState(calcAge);
  const [has19Nor, setHas19Nor] = useState(false);

  // Results
  const [result, setResult] = useState<AdvancedDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const esterOptions = Object.keys(ESTER_HALF_LIFE_DAYS);

  // Auto-fill from course
  useEffect(() => {
    if (useCourseDrugs && course.length > 0) {
      const mapped: DrugDoseInput[] = course.map(c => {
        const ester = c.substanceId.includes('enan') ? 'enanthate'
          : c.substanceId.includes('prop') ? 'propionate'
          : c.substanceId.includes('cyp') ? 'cypionate'
          : c.substanceId.includes('undec') ? 'undecanoate'
          : c.substanceId.includes('acet') ? 'acetate'
          : c.substanceId.includes('deca') || c.substanceId === 'deca' ? 'decanoate'
          : c.substanceId.includes('oral') ? 'oral'
          : 'enanthate';
        return {
          name: c.substanceId,
          ester,
          mgPerWeek: c.doseUnit === 'mg/wk' ? c.doseValue : c.doseValue,
          injectionsPerWeek: typeof c.frequency === 'number' ? c.frequency : 2,
        };
      });
      setDiagDrugs(mapped);
    }
  }, [course, useCourseDrugs]);

  const addManual = () => {
    if (!manName.trim()) return;
    setDiagDrugs([...diagDrugs, { name: manName.trim().toLowerCase(), ester: manEster, mgPerWeek: manMg, injectionsPerWeek: manFreq }]);
    setManName('');
  };

  const removeDrug = (idx: number) => {
    setDiagDrugs(diagDrugs.filter((_, i) => i !== idx));
  };

  const handleRun = () => {
    setLoading(true);
    const vitals: VitalsInput = { hrv, rhr, bpSys, bpDia };
    const res = runAdvancedDiagnostics(age, diagDrugs, vitals, has19Nor);
    setResult(res);
    setLoading(false);
  };

  const SEV_COLORS: Record<string, string> = { critical: '#ef4444', warning: '#f97316' };
  const BIO_DANGER = '#ef4444';
  const BIO_SAFE = '#00e68a';

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🔬 5-Engine Advanced Diagnostics</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          PK/PD · Межлекарственные конфликты · Витальные показатели · BioAge · ПКТ-Таймер
          <br />
        </p>
      </div>

      {/* Drug stack */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setUseCourseDrugs(true)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: useCourseDrugs ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: useCourseDrugs ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
          }}>
            💊 Из курса ({course.length})
          </button>
          <button onClick={() => setUseCourseDrugs(false)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: !useCourseDrugs ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: !useCourseDrugs ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
          }}>
            ✏️ Вручную ({diagDrugs.length})
          </button>
        </div>

        {!useCourseDrugs && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            <input value={manName} onChange={e => setManName(e.target.value)} placeholder="" style={{ width: 100, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <select value={manEster} onChange={e => setManEster(e.target.value)} style={{ width: 110, padding: '5px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }}>
              {esterOptions.map(e => (<option key={e} value={e}>{e} ({ESTER_HALF_LIFE_DAYS[e]}д)</option>))}
            </select>
            <input type="number" value={manMg} onChange={e => setManMg(parseFloat(e.target.value) || 0)} placeholder="" style={{ width: 70, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <input type="number" value={manFreq} onChange={e => setManFreq(parseFloat(e.target.value) || 0)} placeholder="" style={{ width: 60, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <button onClick={addManual} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+</button>
          </div>
        )}

        {diagDrugs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {diagDrugs.map((d, i) => (
              <span key={i} onClick={() => removeDrug(i)} style={{
                padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)',
                fontSize: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                {d.name} [{d.ester}] {d.mgPerWeek}мг {d.injectionsPerWeek}×/нед ✕
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Vitals + Patient */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-dim)' }}>Витальные показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>HRV (мс)</label>
            <input type="number" value={hrv} onChange={e => setHrv(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RHR (уд/мин)</label>
            <input type="number" value={rhr} onChange={e => setRhr(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>АД сист.</label>
            <input type="number" value={bpSys} onChange={e => setBpSys(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>АД диаст.</label>
            <input type="number" value={bpDia} onChange={e => setBpDia(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Возраст (лет)</label>
            <input type="number" value={age} onChange={e => setAge(parseFloat(e.target.value) || 0)}
              style={{ width: 80, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={has19Nor} onChange={e => setHas19Nor(e.target.checked)}
              style={{ accentColor: '#ef4444' }} />
            19-nor в анамнезе
          </label>
        </div>
      </div>

      {/* Run button */}
      <button onClick={handleRun} disabled={diagDrugs.length === 0 || loading} style={{
        width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: diagDrugs.length === 0 ? 'not-allowed' : 'pointer', marginBottom: 12,
        background: diagDrugs.length === 0 ? 'var(--border)' : 'linear-gradient(135deg, #ef4444, #8b5cf6)',
        color: '#fff', fontWeight: 700, fontSize: 15, opacity: diagDrugs.length === 0 ? 0.5 : 1,
      }}>
        {loading ? '⏳ Анализ...' : ''}
        <span style={{ fontSize: 10, display: 'block', fontWeight: 400, opacity: 0.7 }}>
          PK/PD + Взаимодействия + Виталы + BioAge + ПКТ-Таймер
        </span>
      </button>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="card" style={{
            marginBottom: 12, padding: '10px 14px',
            background: result.summary.startsWith('✅') ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.08)',
            borderLeft: `3px solid ${result.summary.startsWith('✅') ? '#00e68a' : '#ef4444'}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Итоговая оценка</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{result.summary}</div>
          </div>

          {/* ── Engine 1: PK/PD ── */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>1. PK/PD — Концентрации и качели</div>
            {result.pkpd.map((r, i) => (
              <div key={i} style={{
                marginBottom: 8, padding: '8px 10px', borderRadius: 6,
                background: r.hormonalSwingFlag ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${r.hormonalSwingFlag ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{r.drugName} [{r.ester}]</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>T½ = {r.halfLifeDays} дн</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
                  <span style={{ color: '#00e68a' }}>Пик: {r.peakConcMg}мг</span>
                  <span style={{ color: '#60a5fa' }}>Спад: {r.troughConcMg}мг</span>
                  <span style={{ color: r.hormonalSwingFlag ? '#ef4444' : 'var(--text-dim)', fontWeight: 600 }}>
                    О”{r.peakTroughDeltaPct}%
                  </span>
                </div>
                {r.hormonalSwingFlag && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                    🔴 Красный флаг: Гормональные качели! Частота инъекций должна быть увеличена.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Engine 2: Interactions ── */}
          {result.interactions.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>2. Межлекарственные конфликты</div>
              {result.interactions.map((r, i) => (
                <div key={i} style={{
                  marginBottom: 6, padding: '8px 10px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.06)', borderLeft: `3px solid ${SEV_COLORS[r.severity]}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: SEV_COLORS[r.severity] }}>
                    {r.severity.toUpperCase()} — {r.drugsInvolved.join(' + ')}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{r.message}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{r.mechanism}</div>
                </div>
              ))}
            </div>
          )}
          {result.interactions.length === 0 && (
            <div className="card" style={{ marginBottom: 10, textAlign: 'center', padding: 8 }}>
              <div style={{ fontSize: 11, color: '#00e68a' }}>✅ Конфликтов не обнаружено</div>
            </div>
          )}

          {/* ── Engine 3: Vitals ── */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>3. Витальные показатели</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>HRV: </span>
                <span style={{ fontWeight: 600, color: result.vitals.hrv < 35 ? '#ef4444' : 'var(--accent)' }}>{result.vitals.hrv} мс</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>RHR: </span>
                <span style={{ fontWeight: 600, color: result.vitals.rhr > 75 ? '#ef4444' : 'var(--accent)' }}>{result.vitals.rhr} уд/мин</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>АД: </span>
                <span style={{ fontWeight: 600, color: result.vitals.bpSys > 140 || result.vitals.bpDia > 90 ? '#ef4444' : 'var(--accent)' }}>
                  {result.vitals.bpSys}/{result.vitals.bpDia}
                </span>
              </div>
            </div>
            {result.vitals.alerts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.vitals.alerts.map((a, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#f97316', padding: '4px 0' }}>⚠ {a}</div>
                ))}
              </div>
            )}
            {result.vitals.alerts.length === 0 && (
              <div style={{ marginTop: 4, fontSize: 10, color: '#00e68a' }}>✅ Витальные показатели в норме</div>
            )}
          </div>

          {/* ── Engine 4: BioAge ── */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>4. BioAge — Биологическое старение</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Хронологический</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{result.bioage.chronologicalAge}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Биологический</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: result.bioage.ageAcceleration > 2 ? '#ef4444' : '#00e68a' }}>
                  {result.bioage.biologicalAge}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)' }}>
              <div>АД-штраф: +{result.bioage.bpPenalty} лет</div>
              <div>HRV-штраф: +{result.bioage.hrvPenalty} лет</div>
              <div>Токс. нагрузка: +{result.bioage.toxicLoadPenalty} лет</div>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: result.bioage.ageAcceleration > 2 ? '#f97316' : 'var(--accent)' }}>
              {result.bioage.agingRate}
            </div>
          </div>

          {/* ── Engine 5: PCT Reboot ── */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>5. ПКТ-Таймер и HPTA Ребут</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Начало ПКТ</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899' }}>День {result.pctReboot.pctStartDay}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  от {result.pctReboot.longestHalfLifeDrug} (T½={result.pctReboot.longestHalfLifeDays}д)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вероятность ребута</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: result.pctReboot.rebootSuccessProbability >= 70 ? '#00e68a' : result.pctReboot.rebootSuccessProbability >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {result.pctReboot.rebootSuccessProbability}%
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {result.pctReboot.has19Nor ? '19-nor: -40%' : ''}
                </div>
              </div>
            </div>
            <div style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 11,
              background: 'rgba(236,72,153,0.06)', borderLeft: '3px solid #ec4899',
            }}>
              {result.pctReboot.recommendation}
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {diagDrugs.length > 0
              ? ``
              : ''}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Course Risk Tab (Info Page) ─── */
