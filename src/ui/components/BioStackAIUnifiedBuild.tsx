/**
 * BioStackAIUnifiedBuild.tsx — Единый экран сборки и управления стеком
 *
 * Объединяет:
 *   - Multi-stack switcher (из BioStackAIScreen)
 *   - Фильтры + сборка (контекст-индикатор, пресеты, 8 органов, расширенная секция)
 *   - Результат с клиническим контекстом
 *   - Таб-бар анализа стека (взаимод./дозы/время/клиника/ЛС/экспорт)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard, PillBtn, showToast, initBioToast, SubstanceMechanismCard, SubstanceTzCard } from './BioStackAIConstants';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import { buildClinicalStack, type ClinicalStackResult } from '../../engines/biostack-clinical-recommender';
import { findMeaningfulReplacement } from '../../engines/biostack-clinical-v2.engine';
import type { StackStrategy } from '../../engines/biostack-clinical-v2.engine';
import { TZ_SYSTEM_LABELS, TZ_MECH_LABELS } from '../../data/support-db';
import { StackPicker } from '../screens/SupplementClinicScreen_parts/StackPicker';
import { InteractionPanel } from '../screens/SupplementClinicScreen_parts/InteractionPanel';
import { DosePanel } from '../screens/SupplementClinicScreen_parts/DosePanel';
import { TimingPanel } from '../screens/SupplementClinicScreen_parts/TimingPanel';
import { ClinicalPanel } from '../screens/SupplementClinicScreen_parts/ClinicalPanel';
import { DrugCheckTab } from './BioStackAIDrugCheck';
import { ExportTab } from './BioStackAIExport';

/* ════════════════════════════════════════════════════════════════
   Константы
   ════════════════════════════════════════════════════════════════ */

const ORGAN_OPTIONS: { id: string; label: string; icon: string; pseudo?: boolean; group?: string }[] = [
  { id: 'cardio', label: 'Сердечно-сосудистая', icon: '❤️', group: 'tz' },
  { id: 'hepatic', label: 'Печень', icon: '🟤', group: 'tz' },
  { id: 'renal', label: 'Почки', icon: '💧', group: 'tz' },
  { id: 'cns', label: 'ЦНС', icon: '🧠', group: 'tz' },
  { id: 'reproductive', label: 'Репродуктивная', icon: '🔬', group: 'tz' },
  { id: 'hematologic', label: 'Гематология/метаболизм', icon: '🩸', group: 'tz' },
  { id: 'joints', label: 'Суставы и связки', icon: '🦴', pseudo: true, group: 'extra' },
  { id: 'neurotox', label: 'Нейротоксичность', icon: '☠️', pseudo: true, group: 'extra' },
];

const MECH_OPTIONS = Object.entries(TZ_MECH_LABELS).map(([id, label]) => ({ id, label }));

const MARKER_OPTIONS: { id: string; label: string; organ?: string }[] = [
  { id: 'ALT', label: 'АЛТ', organ: 'hepatic' }, { id: 'AST', label: 'АСТ', organ: 'hepatic' },
  { id: 'GGT', label: 'ГГТ', organ: 'hepatic' }, { id: 'Bilirubin', label: 'Билирубин', organ: 'hepatic' },
  { id: 'Creatinine', label: 'Креатинин', organ: 'renal' }, { id: 'Urea', label: 'Мочевина', organ: 'renal' },
  { id: 'URIC_ACID', label: 'Мочевая кислота', organ: 'renal' }, { id: 'EGFR', label: 'рСКФ', organ: 'renal' },
  { id: 'LDL', label: 'ЛПНП', organ: 'cardio' }, { id: 'HDL', label: 'ЛПВП', organ: 'cardio' },
  { id: 'Triglycerides', label: 'Триглицериды', organ: 'cardio' }, { id: 'HCT', label: 'Гематокрит', organ: 'hematologic' },
  { id: 'HGB', label: 'Гемоглобин', organ: 'hematologic' }, { id: 'PLT', label: 'Тромбоциты', organ: 'hematologic' },
  { id: 'D-dimer', label: 'D-димер', organ: 'hematologic' }, { id: 'TT', label: 'Тестостерон общ.', organ: 'reproductive' },
  { id: 'FT', label: 'Тестостерон своб.', organ: 'reproductive' }, { id: 'E2', label: 'Эстрадиол', organ: 'reproductive' },
  { id: 'PRL', label: 'Пролактин', organ: 'reproductive' }, { id: 'LH', label: 'ЛГ', organ: 'reproductive' },
  { id: 'FSH', label: 'ФСГ', organ: 'reproductive' }, { id: 'SHBG', label: 'ГСПГ', organ: 'reproductive' },
  { id: 'DHT', label: 'ДГТ', organ: 'reproductive' }, { id: 'TSH', label: 'ТТГ', organ: 'endocrine' },
  { id: 'FT3', label: 'Т3 своб.', organ: 'endocrine' }, { id: 'FT4', label: 'Т4 своб.', organ: 'endocrine' },
  { id: 'GLU', label: 'Глюкоза', organ: 'metabolic' }, { id: 'HbA1c', label: 'HbA1c', organ: 'metabolic' },
  { id: 'INS', label: 'Инсулин', organ: 'metabolic' }, { id: 'HOMAIR', label: 'HOMA-IR', organ: 'metabolic' },
  { id: 'HOMOCYSTEINE', label: 'Гомоцистеин', organ: 'cardio' }, { id: 'CRP', label: 'СРБ', organ: 'immune' },
  { id: 'VITD', label: 'Вит. D', organ: 'metabolic' }, { id: 'B12', label: 'B12', organ: 'metabolic' },
  { id: 'FOL', label: 'Фолат', organ: 'metabolic' }, { id: 'FERRITIN', label: 'Ферритин', organ: 'hematologic' },
  { id: 'IRON', label: 'Железо', organ: 'hematologic' }, { id: 'MAGNESIUM', label: 'Магний', organ: 'metabolic' },
  { id: 'ZINC', label: 'Цинк', organ: 'metabolic' }, { id: 'POTASSIUM', label: 'Калий', organ: 'renal' },
  { id: 'CORTISOL', label: 'Кортизол', organ: 'cns' }, { id: 'PSA', label: 'ПСА', organ: 'reproductive' },
];

const MECH_BY_ORGAN: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  const p2o: Record<string, string> = { cv:'cardio', liv:'hepatic', ren:'renal', cns:'cns', rep:'reproductive', hem:'hematologic' };
  for (const mechId of Object.keys(TZ_MECH_LABELS)) {
    const pf = mechId.match(/^[a-z]+/)?.[0];
    const o = pf ? p2o[pf] : '';
    if (o) (map[o] = map[o] || []).push(mechId);
  }
  map.joints = ['hem1','hem2','cns2','cns3','rep4'];
  map.neurotox = ['cns1','cns2','cns3','cns4','cns5','cns6'];
  return map;
})();

const GRADE_OPTIONS = [
  { id: 'A' as const, label: 'A', color: '#22c55e' },
  { id: 'B' as const, label: 'A+B', color: '#f59e0b' },
  { id: 'C' as const, label: 'Все', color: '#60a5fa' },
];
const STRATEGIES: { id: StackStrategy; label: string }[] = [
  { id: 'comprehensive', label: 'Полный' }, { id: 'safe', label: 'Безопасный' }, { id: 'budget', label: 'Бюджет' },
];
const COUNT_PRESETS = [5, 8, 10, 12, 15, 20, 0];
const PRESETS = [
  { label:'🛡️ Курс ААС', organs:['cardio','hepatic','renal','cns','reproductive','hematologic'], mechs:['cv1','cv2','cv4','cv5','liv1','liv2','ren1','ren2','rep1','rep2','rep4','hem1','hem2'], markers:['ALT','AST','GGT','LDL','HDL','Triglycerides','HCT','Creatinine','E2','PRL','TT','LH','FSH'] },
  { label:'🔄 ПКТ', organs:['reproductive','cardio','cns'], mechs:['rep1','rep2','rep3','rep5','cv2','cns1','cns4'], markers:['TT','FT','LH','FSH','E2','PRL','CORTISOL'] },
  { label:'🌉 Мост', organs:['cardio','hepatic','cns'], mechs:['cv1','cv2','cv5','liv1','cns1','cns4'], markers:['ALT','AST','LDL','HDL','CORTISOL','HCT'] },
  { label:'🩸 База', organs:['cardio','hematologic'], mechs:['cv2','cv4','hem1','hem2'], markers:['LDL','HDL','Triglycerides','HCT','GLU','CRP','VITD'] },
];

const SEV_META: Record<string, { title: string; icon: string; color: string; note: string }> = {
  hard: { title:'Абсолютные противопоказания', icon:'🛑', color:'#f87171', note:'Удалены — приём недопустим' },
  drug: { title:'Конфликты с лекарствами', icon:'💊', color:'#fb7185', note:'Удалены из-за взаимодействия с ЛС' },
  ul: { title:'Превышен UL', icon:'⚠️', color:'#f59e0b', note:'Удалены во избежание передозировки' },
  titration: { title:'Требуется титрация', icon:'🔧', color:'#fbbf24', note:'Снизьте/подберите дозу' },
  redundant: { title:'Избыточно', icon:'🔁', color:'#9ca3af', note:'Убраны как дубли механизмов' },
};
const EXCL_ORDER: Array<keyof typeof SEV_META> = ['hard','drug','ul','titration','redundant'];

/* ════════════════════════════════════════════════════════════════
   UI примитивы
   ════════════════════════════════════════════════════════════════ */

function MultiChips({ options, selected, onToggle, color }: { options:{id:string;label:string}[]; selected:string[]; onToggle:(id:string)=>void; color:string }) {
  return <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
    {options.map(o => {
      const active = selected.includes(o.id);
      return <button key={o.id} onClick={()=>onToggle(o.id)} style={{ fontSize:11, padding:'6px 10px', borderRadius:10, cursor:'pointer', border:`1px solid ${active?color:'rgba(255,255,255,0.12)'}`, background:active?`${color}22`:'rgba(255,255,255,0.04)', color:active?color:'rgba(255,255,255,0.6)', fontWeight:active?700:500 }}>{o.label}</button>;
    })}
  </div>;
}

function Popup({ title, color, show, onClose, children }: { title:string; color:string; show:boolean; onClose:()=>void; children:React.ReactNode }) {
  if (!show) return null;
  return <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
    <div style={{ width:'94%', maxWidth:520, maxHeight:'90vh', overflow:'auto', padding:20, borderRadius:18, background:'rgba(18,18,22,0.98)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:15, fontWeight:700, color }}>{title}</div>
        <button onClick={onClose} style={{ fontSize:16, padding:'4px 8px', borderRadius:8, cursor:'pointer', background:'transparent', border:'none', color:'rgba(255,255,255,0.5)' }}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

/* ════════════════════════════════════════════════════════════════
   Props
   ════════════════════════════════════════════════════════════════ */

interface SavedStackV2 {
  id: string;
  name: string;
  ids: string[];
  profileSnapshot: BioStackProfile | null;
  createdAt: string;
  version: number;
  notes?: string;
}

interface Props {
  profile: BioStackProfile;
  labAnalysis?: LabCompositeResult | null;
  linked?: any;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  allStacks: SavedStackV2[];
  activeStackIdx: number;
  saveStacks: (stks: SavedStackV2[], idx: number) => void;
  setActiveStackIdx: (idx: number) => void;
  stopIds: Set<string>;
  clearStops: () => void;
  replaceStop: (orig: string, rep: string) => void;
}

/* ════════════════════════════════════════════════════════════════
   Компонент
   ════════════════════════════════════════════════════════════════ */

export const BioStackAIUnifiedBuild: React.FC<Props> = ({
  profile, labAnalysis, linked, stackIds, setStackIds,
  allStacks, activeStackIdx, saveStacks, setActiveStackIdx,
  stopIds, clearStops, replaceStop,
}) => {
  // Filter state
  const [popup, setPopup] = useState<'organs'|'mechs'|'markers'|'advanced'|null>(null);
  const [filterOrgans, setFilterOrgans] = useState<string[]>([]);
  const [filterMechanisms, setFilterMechanisms] = useState<string[]>([]);
  const [filterMarkers, setFilterMarkers] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'balanced'|'strict'>('balanced');
  const [grade, setGrade] = useState<'A'|'B'|'C'>('C');
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [maxStackSize, setMaxStackSize] = useState(0);
  const [useCourse, setUseCourse] = useState(true);
  const [useLabs, setUseLabs] = useState(true);
  const [useProfile, setUseProfile] = useState(true);
  const [result, setResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [replacements, setReplacements] = useState<Record<string, string|null|undefined>>({});
  
  // Tab bar
  const [analysisTab, setAnalysisTab] = useState<string>('composition');
  
  initBioToast();
  const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id];
  const hasAnyFilter = filterOrgans.length>0 || filterMechanisms.length>0 || filterMarkers.length>0 || grade!=='C' || maxStackSize>0;

  // ── Filter children (memoized) ──
  const organChildren = useMemo(() => (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6, textTransform:'uppercase' }}>Системы ТЗ (6)</div>
        <MultiChips options={ORGAN_OPTIONS.filter(o=>o.group==='tz').map(o=>({id:o.id, label:`${o.icon} ${o.label}`}))} selected={filterOrgans} onToggle={id=>setFilterOrgans(toggle(filterOrgans,id))} color="#00e68a"/>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:6, textTransform:'uppercase' }}>Дополнительно</div>
        <MultiChips options={ORGAN_OPTIONS.filter(o=>o.group==='extra').map(o=>({id:o.id, label:`${o.icon} ${o.label}`}))} selected={filterOrgans} onToggle={id=>setFilterOrgans(toggle(filterOrgans,id))} color="#f59e0b"/>
      </div>
    </div>
  ), [filterOrgans]);

  const mechGroups = useMemo(() => {
    if (!filterOrgans.length) return MECH_OPTIONS;
    const allowed = new Set<string>();
    for (const org of filterOrgans) for (const mech of MECH_BY_ORGAN[org]||[]) allowed.add(mech);
    return MECH_OPTIONS.filter(o=>allowed.has(o.id));
  }, [filterOrgans]);
  
  const mechByOrgan = useMemo(() => {
    const groups: Record<string,{id:string;label:string}[]> = {};
    const p2o: Record<string,string> = { cv:'cardio', liv:'hepatic', ren:'renal', cns:'cns', rep:'reproductive', hem:'hematologic' };
    const labels: Record<string,string> = { cardio:'❤️ ССС', hepatic:'🟤 Печень', renal:'💧 Почки', cns:'🧠 ЦНС', reproductive:'🔬 Репродуктивная', hematologic:'🩸 Гематология' };
    for (const mech of mechGroups) {
      const pf = mech.id.match(/^[a-z]+/)?.[0];
      const o = pf ? p2o[pf] : 'other';
      (groups[labels[o]||o] = groups[labels[o]||o] || []).push(mech);
    }
    return groups;
  }, [mechGroups]);

  const mechChildren = useMemo(() => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {Object.entries(mechByOrgan).map(([organ, mechs]) => (
        <div key={organ}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', marginBottom:4 }}>{organ}</div>
          <MultiChips options={mechs} selected={filterMechanisms} onToggle={id=>setFilterMechanisms(toggle(filterMechanisms,id))} color="#a78bfa"/>
        </div>
      ))}
    </div>
  ), [filterMechanisms, mechByOrgan]);

  const availableMarkers = useMemo(() => {
    if (!filterOrgans.length) return MARKER_OPTIONS;
    const allowed = new Set(filterOrgans);
    return MARKER_OPTIONS.filter(m => allowed.has(m.organ||''));
  }, [filterOrgans]);

  const markerGroups = useMemo(() => {
    const groups: Record<string, typeof MARKER_OPTIONS> = {};
    const ol: Record<string,string> = { hepatic:'🟤 Печень', cardio:'❤️ ССС', renal:'💧 Почки', metabolic:'⚡ Метаболизм', immune:'🛡️ Иммунная', hematologic:'🩸 Гематология', endocrine:'⚖️ Эндокринная', reproductive:'🔬 Репродуктивная', cns:'🧠 ЦНС' };
    for (const m of availableMarkers) { (groups[ol[m.organ||'']||'Другое'] = groups[ol[m.organ||'']||'Другое'] || []).push(m); }
    return groups;
  }, [availableMarkers]);

  const markerChildren = useMemo(() => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {Object.entries(markerGroups).map(([organ, markers]) => (
        <div key={organ}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', marginBottom:4 }}>{organ}</div>
          <MultiChips options={markers} selected={filterMarkers} onToggle={id=>setFilterMarkers(toggle(filterMarkers,id))} color="#f59e0b"/>
        </div>
      ))}
    </div>
  ), [filterMarkers, markerGroups]);

  // ── Build ──
  const onBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy, lab: useLabs?(labAnalysis??null):null, courseWeek: linked?.pharma?.week ?? 1,
          filterOrgans: filterOrgans.length?filterOrgans:undefined,
          filterMechanisms: filterMechanisms.length?filterMechanisms:undefined,
          filterMarkers: filterMarkers.length?filterMarkers:undefined,
          evidenceLevel: grade!=='C'?grade:undefined,
          maxStackSize: maxStackSize>0?maxStackSize:undefined,
          useCourse, useLabs, useProfile, filterMode,
        });
        setResult(r);
      } catch (e: any) { showToast('Ошибка: '+(e?.message||e), 'error'); }
      finally { setBuilding(false); }
    }, 10);
  };

  // Умный Quick-build: авто-определение органов из профиля
  const smartQuickBuild = () => {
    if (filterOrgans.length > 0 || filterMechanisms.length > 0 || filterMarkers.length > 0) {
      onBuild(); return; // фильтры уже заданы вручную — просто собираем
    }
    const autoOrgans: string[] = [];
    const symp = profile.jointSymptoms?.filter(Boolean) || [];
    const neuro = [...(profile.neuroSymptoms||[]), ...(profile.cnsSymptoms||[])].filter(Boolean);
    // Симптомы → органы
    if (symp.length > 0) autoOrgans.push('joints');
    if (neuro.length > 0) autoOrgans.push('neurotox');
    // Проверяем наличие курса → если есть, все органы нужны
    try {
      const raw = localStorage.getItem('he_course_data');
      if (raw) { const c = JSON.parse(raw); if (c.aas?.length > 0) { autoOrgans.push('cardio','hepatic','renal','cns','reproductive','hematologic'); } }
    } catch {}
    // Если ничего не нашли — берём базу (ССС + гематология)
    if (autoOrgans.length === 0) autoOrgans.push('cardio','hematologic');
    // Дедупликация и установка
    const uniq = [...new Set(autoOrgans)];
    setFilterOrgans(uniq);
    setUseCourse(true);
    // Запускаем сборку с авто-органами
    setBuilding(true);
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy, lab: useLabs?(labAnalysis??null):null, courseWeek: linked?.pharma?.week ?? 1,
          filterOrgans: uniq, filterMechanisms: undefined, filterMarkers: undefined,
          evidenceLevel: undefined, maxStackSize: maxStackSize>0?maxStackSize:undefined,
          useCourse: true, useLabs, useProfile, filterMode,
        });
        setResult(r);
      } catch (e: any) { showToast('Ошибка: '+(e?.message||e), 'error'); }
      finally { setBuilding(false); }
    }, 10);
  };

  const onToPlan = () => {
    if (!result) return;
    const ids = result.substances.map(s=>s.id);
    localStorage.setItem('he_biostack_to_plan', JSON.stringify({ stackIds: ids, name: 'Клинический подбор (BioStack)' }));
    if (result.gate) localStorage.setItem('he_biostack_gate_cache', JSON.stringify(result.gate));
    setStackIds(ids);
    window.dispatchEvent(new CustomEvent('he_biostack_to_plan', { detail: { stackIds: ids } }));
    showToast(`Стек (${ids.length}) отправлен в план поддержки`, 'success');
  };

  const handleReplace = (excludedId: string) => {
    if (replacements[excludedId] !== undefined) return;
    setReplacements(p=>({...p,[excludedId]:undefined}));
    try {
      const rep = findMeaningfulReplacement(excludedId, profile, result?.substances.map(s=>s.id)||[]);
      setReplacements(p=>({...p,[excludedId]:rep?.replacementId||null}));
      if (rep?.replacementId) { setStackIds([...new Set([...result!.substances.map(s=>s.id), rep.replacementId])]); showToast(`Заменено → ${rep.replacementName||rep.replacementId}`, 'success'); }
    } catch { setReplacements(p=>({...p,[excludedId]:null})); }
  };

  const resetAll = () => { setFilterOrgans([]); setFilterMechanisms([]); setFilterMarkers([]); setFilterMode('balanced'); setGrade('C'); setStrategy('comprehensive'); setMaxStackSize(0); setResult(null); };
  const applyPreset = (p: typeof PRESETS[0]) => { setFilterOrgans(p.organs); setFilterMechanisms(p.mechs); setFilterMarkers(p.markers); setGrade('C'); };
  const isPresetActive = (p: typeof PRESETS[0]): boolean => {
    const so = new Set(p.organs), sm = new Set(p.mechs), smk = new Set(p.markers);
    return so.size === filterOrgans.length && sm.size === filterMechanisms.length && smk.size === filterMarkers.length
      && filterOrgans.every(x => so.has(x)) && filterMechanisms.every(x => sm.has(x)) && filterMarkers.every(x => smk.has(x));
  };

  // Слушаем кастомное событие «умная сборка» (от кнопки в Stack.tsx)
  useEffect(() => {
    const handler = () => smartQuickBuild();
    window.addEventListener('he_biostack_smart_build', handler);
    return () => window.removeEventListener('he_biostack_smart_build', handler);
  }, [profile, labAnalysis, linked, useLabs, useProfile, filterMode, maxStackSize]);

  // ── Result pane (memoized) ──
  const resultPane = useMemo(() => {
    if (!result) return null;
    return <>
      {result.isOrientational && (
        <div style={{ padding:'10px 14px', borderRadius:12, marginBottom:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Стек ориентировочный</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:4 }}>Собран без учёта курса и анализов. Включите «Курс» и/или «Анализы» для точного подбора.</div>
        </div>
      )}

      <GlassCard title="📋 Описание стека" icon="📝" color="#a78bfa" style={{ marginTop:8 }}>
        <div style={{ fontSize:12, color:'rgba(235,235,245,0.8)', lineHeight:1.6, whiteSpace:'pre-line' }}>
          {result.stackDescription.split('\n').map((line,i) => {
            const t = line.trim();
            if (!t) return null;
            if (t==='Принцип:'||t==='Покрытие систем:') return <div key={i} style={{ fontSize:11, fontWeight:700, color:'#c084fc', marginTop:4 }}>{t}</div>;
            if (t.startsWith('• ')) return <div key={i} style={{ fontSize:11, color:'rgba(235,235,245,0.75)', paddingLeft:8 }}>{t}</div>;
            return <div key={i} style={{ fontSize:12, fontWeight:600, color:'#fff' }}>{t}</div>;
          })}
        </div>
      </GlassCard>

      {result.stackSynergies.length > 0 && (
        <GlassCard title={`🔗 Синергии (${result.stackSynergies.length})`} icon="⚡" color="#c084fc" style={{ marginTop:8 }}>
          {result.stackSynergies.map((syn,i) => (
            <div key={i} style={{ padding:'10px 12px', marginBottom:6, borderRadius:12, background:'rgba(192,132,252,0.04)', border:'1px solid rgba(192,132,252,0.1)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#fff', lineHeight:1.3 }}>{syn.effect}</div>
                  <div style={{ fontSize:10, color:'#a78bfa', marginTop:2 }}>{syn.ids[0]} + {syn.ids[1]}</div>
                </div>
                <span style={{ fontSize:10, padding:'3px 8px', borderRadius:6, fontWeight:700, whiteSpace:'nowrap', background:syn.strength==='HIGH'?'rgba(34,197,94,0.15)':syn.strength==='MEDIUM'?'rgba(245,158,11,0.15)':'rgba(100,116,139,0.15)', color:syn.strength==='HIGH'?'#22c55e':syn.strength==='MEDIUM'?'#fbbf24':'#94a3b8' }}>{syn.strength==='HIGH'?'Сильная':syn.strength==='MEDIUM'?'Средняя':'Слабая'}</span>
              </div>
              {syn.mechanism && <div style={{ fontSize:11, color:'rgba(235,235,245,0.7)', marginTop:6, lineHeight:1.4 }}>{syn.mechanism}</div>}
            </div>
          ))}
        </GlassCard>
      )}

      <GlassCard title={`💊 Состав (${result.substances.length})`} icon="💊" color="#a78bfa" style={{ marginTop:8 }}>
        {result.substances.map(s => (
          <div key={s.id} style={{ padding:'10px 12px', marginBottom:4, borderRadius:12, background:'rgba(167,139,250,0.04)', border:'1px solid rgba(167,139,250,0.08)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
              <div>
                <span style={{ fontWeight:700, fontSize:14, color:'#fff' }}>{s.name}</span>
                <span style={{ marginLeft:6, fontSize:9, padding:'2px 6px', borderRadius:4, background:s.tier==='core'?'rgba(34,197,94,0.15)':s.tier==='standard'?'rgba(96,165,250,0.15)':'rgba(167,139,250,0.1)', color:s.tier==='core'?'#22c55e':s.tier==='standard'?'#60a5fa':'#a78bfa' }}>{s.tier}</span>
                {s.source && <span style={{ marginLeft:4, fontSize:8, padding:'2px 6px', borderRadius:4, background:s.source==='mandatory'?'rgba(239,68,68,0.12)':s.source==='greedy'?'rgba(168,85,247,0.12)':'rgba(96,165,250,0.12)', color:s.source==='mandatory'?'#f87171':s.source==='greedy'?'#c084fc':'#93c5fd' }}>{s.source==='mandatory'?'обяз.':s.source==='greedy'?'синергия':'ТЗ'}</span>}
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'#00e68a' }}>{s.doseDisplay||`${s.doseMg} мг`}</div>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{s.timing}</div>
            {s.tzMechanisms.length>0 && <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap' }}>{s.tzMechanisms.slice(0,5).map(m=><span key={m.mechId} style={{ fontSize:9, padding:'3px 8px', borderRadius:6, background:'rgba(96,165,250,0.15)', color:'#93c5fd', fontWeight:600 }}>{m.label}</span>)}</div>}
          </div>
        ))}
      </GlassCard>

      <GlassCard title="📊 Риск" icon="📈" color="#60a5fa" style={{ marginTop:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
          <div style={{ padding:'10px', borderRadius:12, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>Сейчас</div><div style={{ fontSize:28, fontWeight:800, color:'#fff' }}>{result.riskBefore}</div></div>
          <div style={{ fontSize:20, color:'rgba(255,255,255,0.3)' }}>→</div>
          <div style={{ padding:'10px', borderRadius:12, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)', textAlign:'center' }}><div style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>Прогноз</div><div style={{ fontSize:28, fontWeight:800, color:'#22c55e' }}>{result.riskAfter}</div></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <div style={{ flex:1, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', textAlign:'center', fontSize:18, fontWeight:800, color:'#22c55e' }}>−{Math.round((result.riskBefore-result.riskAfter)*10)/10}</div>
          <div style={{ flex:1, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', textAlign:'center', fontSize:18, fontWeight:800, color:'#60a5fa' }}>{result.coveragePercent}%</div>
        </div>
      </GlassCard>

      {result.excluded.length>0 && (() => {
        const groups = EXCL_ORDER.map(sev=>({ sev, meta:SEV_META[sev], items:result.excluded.filter(x=>x.severity===sev) })).filter(g=>g.items.length>0);
        return groups.map(g => (
          <GlassCard key={g.sev} title={`${g.meta.title} (${g.items.length})`} icon={g.meta.icon} color={g.meta.color} style={{ marginTop:10 }}>
            <div style={{ fontSize:10, color:g.meta.color, marginBottom:4, fontWeight:600 }}>{g.meta.note}</div>
            {g.items.map((x,i) => {
              const repState = replacements[x.id as string];
              const canReplace = g.sev==='hard'||g.sev==='drug';
              return <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight:600, fontSize:12 }}>{x.name}</div>
                <div style={{ fontSize:10, color:'rgba(235,235,245,0.6)' }}>{x.reason}</div>
                {canReplace && <div style={{ marginTop:4 }}>
                  {repState===undefined ? <button onClick={e=>{e.stopPropagation();handleReplace(x.id as string)}} style={{ fontSize:10, padding:'4px 10px', borderRadius:8, cursor:'pointer', background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', color:'#c084fc', fontWeight:600 }}>↻ Найти замену</button>
                  : repState===null ? <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>Нет замены</span>
                  : <span style={{ fontSize:10, color:'#22c55e', fontWeight:600 }}>✓ Заменён на {repState}</span>}
                </div>}
              </div>;
            })}
          </GlassCard>
        ));
      })()}

      {result.safety.drugTitrations.length>0 && (
        <GlassCard title={`🔧 Титрация (${result.safety.drugTitrations.length})`} icon="🔧" color="#fbbf24" style={{ marginTop:10 }}>
          {result.safety.drugTitrations.map((t:any,i:number)=><div key={i} style={{ padding:'6px 0', fontSize:11, color:'rgba(235,235,245,0.75)' }}>• {t.substanceName}{t.recommendation?` → ${t.recommendation}`:''}</div>)}
        </GlassCard>
      )}

      <button onClick={onToPlan} style={{ marginTop:10, width:'100%', padding:'12px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#00e68a,#00b4d8)', color:'#00120c', fontWeight:800, fontSize:14, cursor:'pointer' }}>
        ➕ Отправить в план поддержки ({result.substances.length})
      </button>
    </>;
  }, [result, replacements]);

  // ── Analysis tab content ──
  const analysisContent = useMemo(() => {
    if (stackIds.length === 0) return <div style={{ padding:20, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:12 }}>Стек пуст — соберите или выберите существующий</div>;
    switch (analysisTab) {
      case 'composition': return <StackPicker stackIds={stackIds} onChange={setStackIds} />;
      case 'interactions': return <div><StackPicker stackIds={stackIds} onChange={setStackIds} /><InteractionPanel stackIds={stackIds} /></div>;
      case 'dose': return <div><StackPicker stackIds={stackIds} onChange={setStackIds} /><DosePanel stackIds={stackIds} /></div>;
      case 'timing': return <div><StackPicker stackIds={stackIds} onChange={setStackIds} /><TimingPanel stackIds={stackIds} /></div>;
      case 'clinical': return <div><StackPicker stackIds={stackIds} onChange={setStackIds} /><ClinicalPanel stackIds={stackIds} labAnalysis={labAnalysis} onClearStops={clearStops} onReplace={replaceStop} /></div>;
      case 'drugcheck': return <DrugCheckTab profile={profile} stackIds={stackIds} />;
      case 'export': return <ExportTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} linked={linked} />;
      default: return null;
    }
  }, [analysisTab, stackIds, profile, labAnalysis, clearStops, replaceStop, linked, setStackIds]);

  const ANAL_TABS = [
    { id:'composition', label:'📋 Состав' }, { id:'interactions', label:'⚗️ Взаимод.' },
    { id:'dose', label:'💊 Дозы' }, { id:'timing', label:'⏰ Время' },
    { id:'clinical', label:'🩺 Клиника' }, { id:'drugcheck', label:'💊 ЛС' },
    { id:'export', label:'📤 Экспорт' },
  ];

  return (
    <div style={{ padding:12 }}>
      {/* ── Multi-stack switcher ── */}
      <div style={{ display:'flex', gap:4, marginBottom:10, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {allStacks.map((stk, i) => {
          const name = stk.name || `Стек ${i+1}`;
          return (
            <button key={i} onClick={() => setActiveStackIdx(i)} style={{
              flexShrink:0, minHeight:32, padding:'6px 14px', borderRadius:12, fontSize:11, fontWeight:700,
              cursor:'pointer', transition:'all 0.2s',
              background: i===activeStackIdx ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${i===activeStackIdx ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: i===activeStackIdx ? '#00e68a' : 'rgba(255,255,255,0.5)',
            }}>{name} ({stk.ids.length})</button>
          );
        })}
        <button onClick={() => saveStacks([...allStacks, { id: crypto.randomUUID(), name: `Стек ${allStacks.length + 1}`, ids: [], profileSnapshot: null, createdAt: new Date().toISOString(), version: 1, notes: '' }], allStacks.length)} style={{
          flexShrink:0, minHeight:32, padding:'6px 12px', borderRadius:12, fontSize:11, fontWeight:600,
          cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)',
        }}>+</button>
        {allStacks.length > 1 && activeStackIdx > 0 && (
          <button onClick={() => { const n = allStacks.filter((_,j)=>j!==activeStackIdx); saveStacks(n.length?n:[{ id: crypto.randomUUID(), name: 'Стек 1', ids: [], profileSnapshot: null, createdAt: new Date().toISOString(), version: 1, notes: '' }], Math.min(activeStackIdx, n.length-1)); }} style={{
            flexShrink:0, minHeight:32, padding:'6px 12px', borderRadius:12, fontSize:11, fontWeight:600,
            cursor:'pointer', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171',
          }}>🗑</button>
        )}
      </div>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, marginBottom:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.1)' }}>
        <span style={{ fontSize:24 }}>⚕️</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>Сборка и управление стеком</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.4, marginTop:2 }}>Движок калькулятора поддержки · ТЗ-механизмы (28) · клинический шлюз безопасности</div>
        </div>
      </div>

      {/* ── Контекст-индикатор источников (с переключением) ── */}
      <div style={{ display:'flex', gap:6, alignItems:'center', padding:'8px 12px', borderRadius:12, marginBottom:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', flexWrap:'wrap' }}>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontWeight:700, marginRight:2 }}>Источники:</span>
        {([['💊','Курс',useCourse,setUseCourse,'#00e68a'],['🧪','Анализы',useLabs,setUseLabs,'#f59e0b'],['👤','Профиль',useProfile,setUseProfile,'#a78bfa']] as [string,string,boolean,(v:boolean)=>void,string][]).map(([icon,label,v,s,c]) => (
          <button key={label} onClick={()=>s(!v)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:600, background:v?`${c}22`:'rgba(255,255,255,0.04)', border:`1px solid ${v?c+'66':'rgba(255,255,255,0.08)'}`, color:v?c:'rgba(255,255,255,0.4)' }}>
            <span style={{ fontSize:13 }}>{icon}</span>
            <span>{label}</span>
            <span style={{ fontSize:13, marginLeft:2 }}>{v?'✅':'⊘'}</span>
          </button>
        ))}
      </div>

      {/* ── 4 пресета стратегий (главный уровень) ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
        {PRESETS.map(p => {
          const active = isPresetActive(p);
          return (
            <button key={p.label} onClick={() => applyPreset(p)} style={{
              padding:'10px 6px', borderRadius:12, cursor:'pointer', fontSize:11, fontWeight:700,
              background: active ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${active ? '#00e68a' : 'rgba(255,255,255,0.1)'}`,
              color: active ? '#00e68a' : 'rgba(255,255,255,0.75)',
              transition: 'all 0.15s', minHeight: 56, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            }}>
              <div style={{ fontSize:18 }}>{p.label.split(' ')[0]}</div>
              <div style={{ fontSize:10 }}>{p.label.split(' ').slice(1).join(' ')}</div>
            </button>
          );
        })}
      </div>

      {/* ── 8 органов (chips) ── */}
      <GlassCard title="🫀 Органы и системы" icon="" color="#00e68a" style={{ marginBottom:8 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
          {ORGAN_OPTIONS.map(o => {
            const active = filterOrgans.includes(o.id);
            const color = o.group==='tz' ? '#00e68a' : '#f59e0b';
            return (
              <button key={o.id} onClick={() => setFilterOrgans(toggle(filterOrgans, o.id))} style={{
                padding:'8px 4px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:600,
                background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? color+'88' : 'rgba(255,255,255,0.1)'}`,
                color: active ? color : 'rgba(255,255,255,0.7)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:2, minHeight: 52,
              }}>
                <div style={{ fontSize:18 }}>{o.icon}</div>
                <div style={{ fontSize:10, lineHeight:1.1, textAlign:'center' }}>{o.label}</div>
              </button>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Выбрано: {filterOrgans.length} / 8</span>
          {filterOrgans.length > 0 && (
            <button onClick={() => setFilterOrgans([])} style={{ fontSize:10, padding:'3px 8px', borderRadius:8, cursor:'pointer', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)' }}>✕ Сбросить органы</button>
          )}
        </div>
      </GlassCard>

      {/* ── Большая кнопка сборки (всегда видна) ── */}
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <button
          onClick={filterOrgans.length === 0 ? smartQuickBuild : onBuild}
          disabled={building}
          style={{ flex:1, padding:'14px 0', borderRadius:14, border:'none', background:building?'rgba(0,230,138,0.4)':'linear-gradient(135deg,#00e68a,#00b4d8)', color:'#00120c', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:building?'none':'0 4px 16px rgba(0,230,138,0.2)' }}
        >
          {building ? '⚙️ Собираю…' : filterOrgans.length === 0 ? '🤖 Умная сборка (без фильтров)' : `⚡ Собрать стек (${filterOrgans.length} орган${filterOrgans.length===1?'':'ов'})`}
        </button>
        {filterOrgans.length > 0 && (
          <button onClick={() => { setFilterOrgans([]); setFilterMechanisms([]); setFilterMarkers([]); setResult(null); }} style={{ padding:'12px 14px', borderRadius:14, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', fontWeight:600, fontSize:12, cursor:'pointer' }}>✕</button>
        )}
      </div>

      {/* ── Расширенная секция (свёрнута по умолчанию) ── */}
      <div style={{ marginBottom:8 }}>
        <button onClick={() => setPopup(popup==='advanced'?null:'advanced')} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>▶ Расширенные фильтры</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{popup==='advanced'?'▼':'▸'}</span>
        </button>
        {popup === 'advanced' && (
          <div style={{ marginTop:6, padding:8, background:'rgba(255,255,255,0.02)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
            {/* Механизмы ТЗ */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, marginBottom:6, textTransform:'uppercase' }}>⚙️ Механизмы ТЗ (28) — выбрано: {filterMechanisms.length}</div>
              <Popup title="Механизмы ТЗ" color="#a78bfa" show={false} onClose={()=>null}>
                <></>
              </Popup>
              <button onClick={() => setPopup('mechs')} style={{ width:'100%', padding:'8px 12px', borderRadius:10, cursor:'pointer', fontSize:11, background: filterMechanisms.length?'rgba(167,139,250,0.14)':'rgba(255,255,255,0.04)', border: filterMechanisms.length?'1px solid #a78bfa88':'1px solid rgba(255,255,255,0.1)', color: filterMechanisms.length?'#a78bfa':'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:6 }}>
                {filterMechanisms.length ? `Выбрано: ${filterMechanisms.length} (изменить)` : 'Открыть выбор механизмов'}
              </button>
              {mechGroups.length === 0 && <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'center', padding:6 }}>Выберите органы для отображения связанных механизмов</div>}
            </div>
            {/* Маркеры */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, marginBottom:6, textTransform:'uppercase' }}>🧪 Лаб-маркеры (40) — выбрано: {filterMarkers.length}</div>
              <button onClick={() => setPopup('markers')} style={{ width:'100%', padding:'8px 12px', borderRadius:10, cursor:'pointer', fontSize:11, background: filterMarkers.length?'rgba(245,158,11,0.14)':'rgba(255,255,255,0.04)', border: filterMarkers.length?'1px solid #f59e0b88':'1px solid rgba(255,255,255,0.1)', color: filterMarkers.length?'#f59e0b':'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:6 }}>
                {filterMarkers.length ? `Выбрано: ${filterMarkers.length} (изменить)` : 'Открыть выбор маркеров'}
              </button>
            </div>
            {/* Доп. параметры */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontWeight:700 }}>📚 Док-ть:</span>
              {GRADE_OPTIONS.map(g => <button key={g.id} onClick={()=>setGrade(g.id)} style={{ padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'none', fontSize:11, fontWeight:700, background:grade===g.id?g.color+'22':'rgba(255,255,255,0.04)', color:grade===g.id?g.color:'rgba(255,255,255,0.5)' }}>{g.label}</button>)}
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:6 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontWeight:700 }}>🎯 Стратегия:</span>
              {STRATEGIES.map(s => <button key={s.id} onClick={()=>setStrategy(s.id)} style={{ padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'none', fontSize:11, fontWeight:600, background:strategy===s.id?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.04)', color:strategy===s.id?'#00e68a':'rgba(255,255,255,0.5)' }}>{s.label}</button>)}
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:6 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontWeight:700 }}>📦 Размер:</span>
              {COUNT_PRESETS.map(n => <button key={n} onClick={()=>setMaxStackSize(n)} style={{ padding:'4px 8px', borderRadius:10, cursor:'pointer', border:'none', fontSize:11, fontWeight:600, background:maxStackSize===n?'rgba(232,121,249,0.15)':'rgba(255,255,255,0.04)', color:maxStackSize===n?'#e879f9':'rgba(255,255,255,0.5)' }}>{n===0?'∞':n}</button>)}
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:6 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', fontWeight:700 }}>🎚 Режим:</span>
              {(['balanced','strict'] as const).map(m => <button key={m} onClick={()=>setFilterMode(m)} style={{ padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'none', fontSize:11, fontWeight:600, background:filterMode===m?(m==='strict'?'rgba(245,158,11,0.15)':'rgba(96,165,250,0.15)'):'rgba(255,255,255,0.04)', color:filterMode===m?(m==='strict'?'#f59e0b':'#60a5fa'):'rgba(255,255,255,0.5)' }}>{m}</button>)}
            </div>
          </div>
        )}
      </div>

      {/* ── Popups (механизмы, маркеры) — открываются из расширенной секции ── */}
      <Popup title="Механизмы ТЗ" color="#a78bfa" show={popup==='mechs'} onClose={()=>setPopup('advanced')}>{mechChildren}</Popup>
      <Popup title="Лабораторные анализы" color="#f59e0b" show={popup==='markers'} onClose={()=>setPopup('advanced')}>{markerChildren}</Popup>

      {/* ── Индикатор ориентировочности (если отключены источники) ── */}
      {(!useCourse || !useLabs) && (
        <div style={{ display:'flex', gap:6, marginBottom:6, padding:'6px 10px', borderRadius:10, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.18)', fontSize:11, color:'#f59e0b', alignItems:'center' }}>
          ⚠️ Без {(!useCourse && !useLabs) ? 'курса и анализов' : (!useCourse ? 'курса' : 'анализов')} стек будет ориентировочным
        </div>
      )}

      {/* ── RESULT ── */}
      {resultPane}

      {/* ── Analysis tab bar ── */}
      <div style={{ display:'flex', gap:2, marginTop:12, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {ANAL_TABS.map(t => (
          <button key={t.id} onClick={()=>setAnalysisTab(t.id)} style={{
            flexShrink:0, minHeight:32, padding:'6px 10px', borderRadius:10, fontSize:11, fontWeight:600,
            cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.2s',
            background: analysisTab===t.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
            color: analysisTab===t.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${analysisTab===t.id ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ marginTop:6 }}>{analysisContent}</div>
    </div>
  );
};
