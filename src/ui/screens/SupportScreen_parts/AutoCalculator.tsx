import React, { useMemo, useState, useCallback } from 'react';
import type { CalculatorState, CalculatorResult, LabDelta, SystemRisk, ScheduleItem, PowerLevel, SynergyId, Sex, LabSlice } from '../../../engines/support-calculator.types';
import { calculateSupportTZ, hydrateState } from '../../../engines/support-calculator.engine';
import { SYNERGY_ID_LABELS } from '../../../engines/support-calculator.types';
import { PHARMA_DB, PHARMA_CLASSES } from '../../../core/pharma-database';
import { SUPPORT_COVERAGE_MAP } from '../../../data/support-coverage-map';
import { evaluateRecommendations, applyBudget, computeBudgetRisk, buildPreApplyCard } from '../../../engines/recommendation-engine';
import { calculateWeeklyRiskDynamics } from '../../../engines/weekly-risk-dynamics.engine';

interface AutoCalculatorProps { onApply: (result: { level: string; subs: string[]; result: CalculatorResult }) => void; embedded?: boolean; courseWeek?: number; }
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 12 };
const PILL: React.CSSProperties = { padding: '6px 14px', borderRadius: 22, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const INPUT: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { fontSize: 9, color: 'var(--text-dim)', marginBottom: 2, display: 'block' };
const BADGE = (bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 8, fontWeight: 700, background: bg, color: '#000' });

const SEV_OPTS = [{id:'none',label:'Нет'},{id:'mild',label:'Лёгкая'},{id:'moderate',label:'Средняя'},{id:'severe',label:'Тяжёлая'}];

const DEFAULT_STATE: CalculatorState = {
  profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
  neuro: { dopamineScore: 1, serotoninScore: 1, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 1, headaches: false, weatherDependent: false, sleepQuality: 'good' },
  pharma: { phase: 'course', aas: [], hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false },
  goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
  hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
  urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
  cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
  nutrition: { calories: 2500, proteinG: 160, fatG: 80, carbsG: 300, waterL: 2, saltIntake: 'normal', omega3: false, fiberG: 25 },
  contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
  journal: { positive: [], negative: [] },
  epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
  toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
  dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
  genetics: { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'normal' },
  gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
  psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
  injection: { glutes: '', quads: '', delts: '', localAreas: '' },
  powerLevel: 'mid',
};

function SevSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div style={{ marginBottom: 4 }}><span style={LABEL}>{label}</span>
    <PopupSelect label={label} value={value} options={SEV_OPTS} onChange={onChange} />
  </div>;
}

function Card({ icon, title, defaultOpen, cols, children }: { icon: string; title: string; defaultOpen?: boolean; cols?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen || false);
  return <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'2px solid rgba(0,230,138,0.25)', marginBottom:6, position:'relative', overflow:'hidden' }}>
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg, rgba(0,230,138,0.02), rgba(0,198,83,0.02))', pointerEvents:'none' }} />
    <div onClick={() => setOpen(!open)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none', marginBottom: open ? 8 : 0, position:'relative' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{title}</span>
      </div>
      <span style={{ fontSize:9, color:'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
    </div>
    {open && <div style={{ position:'relative', display:'grid', gridTemplateColumns: cols ? `repeat(${cols},1fr)` : '1fr', gap:4, gridAutoRows:'auto' }}>{children}</div>}
  </div>;
}

function PopupSelect({ label, value, options, onChange, style }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);
  return <>
    <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: 9, cursor: 'pointer', background: value ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: value ? 'var(--accent)' : 'rgba(255,255,255,0.5)', textAlign: 'left' as const, ...style }}>
      {selected ? selected.label : `▸ ${label}`}
    </button>
    {open && <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width: '88%', maxWidth: 360, maxHeight: '70vh', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #00e68a, #00c853)' }} />
        <div style={{ padding: '14px 16px', maxHeight: 'calc(70vh - 3px)', overflowY: 'auto' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>{label}</div>
          {options.map(o => <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 14px', marginBottom: 3, borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: value === o.id ? 700 : 400, textAlign: 'left' as const, background: value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border: value === o.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)', color: value === o.id ? '#00e68a' : 'rgba(255,255,255,0.8)' }}>{o.label}{value === o.id ? ' ✓' : ''}</button>)}
        </div>
      </div>
    </div>}
  </>;
}

// 🔘 PopupBool — кнопка-карточка с попапом для boolean
function PopupBool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} style={{
      width:'100%', padding:'8px 10px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700, textAlign:'center',
      background: value ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
      border: value ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
      color: value ? '#000' : 'var(--text-dim)',
    }}>
      {value ? '✓ ' : '✗ '}{label}
    </button>
    {open && <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width:'80%', maxWidth:300, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>{label}</div>
          <button onClick={() => { onChange(true); setOpen(false); }} style={{ display:'block', width:'100%', padding:'10px 14px', marginBottom:3, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, textAlign:'left', background: value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border: value ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)', color: value ? '#00e68a' : 'rgba(255,255,255,0.8)' }}>✓ Да {value ? ' ✓' : ''}</button>
          <button onClick={() => { onChange(false); setOpen(false); }} style={{ display:'block', width:'100%', padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, textAlign:'left', background: !value ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)', border: !value ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)', color: !value ? '#ef4444' : 'rgba(255,255,255,0.8)', marginBottom:6 }}>✗ Нет {!value ? ' ✓' : ''}</button>
        </div>
      </div>
    </div>}
  </>;
}

// 🔢 PopupNumber — кнопка-карточка с попапом для чисел
function PopupNumber({ label, value, min, max, step, onChange, suffix }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));
  const display = value + (suffix ? ' ' + suffix : '');
  return <>
    <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={{
      width:'100%', padding:'8px 10px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700, textAlign:'center',
      background: 'rgba(0,230,138,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text-light)',
    }}>
      {label}: <span style={{ color:'var(--accent)' }}>{display}</span>
    </button>
    {open && <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width:'80%', maxWidth:300, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>{label}</div>
          <input type="range" min={min ?? 0} max={max ?? 300} step={step ?? 1} value={parseInt(edit) || 0}
            onChange={e => setEdit(e.target.value)}
            style={{ width:'100%', height:4, accentColor:'var(--accent)', cursor:'pointer', marginBottom:6 }} />
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="number" value={edit} onChange={e => setEdit(e.target.value)}
              style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:16, fontWeight:700, textAlign:'center' }} />
            <button onClick={() => { const v = parseFloat(edit); if (!isNaN(v)) onChange(v); setOpen(false); }} style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12 }}>OK</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}

// 📝 PopupText — кнопка-карточка с попапом для текста
function PopupText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(value);
  const display = value || '—';
  return <>
    <button onClick={() => { setEdit(value); setOpen(true); }} style={{
      width:'100%', padding:'8px 10px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700, textAlign:'center',
      background: 'rgba(0,230,138,0.04)', border:'1px solid rgba(255,255,255,0.06)', color: value ? 'var(--text-light)' : 'var(--text-dim)',
    }}>
      {label}: <span style={{ color: value ? 'var(--accent)' : 'var(--text-dim)' }}>{display}</span>
    </button>
    {open && <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width:'80%', maxWidth:300, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>{label}</div>
          <input type="text" value={edit} onChange={e => setEdit(e.target.value)} placeholder={placeholder}
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:14, boxSizing:'border-box', marginBottom:10 }} />
          <button onClick={() => { onChange(edit); setOpen(false); }} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12 }}>OK</button>
        </div>
      </div>
    </div>}
  </>;
}

function LabSliceInput({ label, slice, onChange }: { label: string; slice: { date: string; panelSex: Record<string,string>; panelBiochem: Record<string,string>; panelHematology: Record<string,string>; panelThyroid: Record<string,string>; panelLipid: Record<string,string>; panelIron: Record<string,string>; panelVitamin: Record<string,string>; panelCardiac: Record<string,string>; panelCoagulation: Record<string,string>; panelInflammatory: Record<string,string>; panelAdrenal: Record<string,string>; panelMineral: Record<string,string>; panelTumor: Record<string,string>; panelUrinalysis: Record<string,string> } | null; onChange: (v: any) => void; fullSpectrum?: boolean }) {
  return <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <input type="date" value={slice?.date || ''} onChange={e => onChange(e.target.value ? { date: e.target.value, panelSex: {}, panelBiochem: {}, panelHematology: {}, panelThyroid: {} } : null)} style={{ ...INPUT, width: 130, fontSize: 9 }} />
      <button onClick={() => onChange(null)} style={{ ...PILL, fontSize: 8, background: '#ef4444', color: '#fff', padding: '3px 8px' }}>✕</button>
    </div>
    {slice && <>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#818cf8', marginBottom: 2 }}>Половые гормоны</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{m}</span>
            <input value={slice.panelSex?.[m] || ''} onChange={e => onChange({ ...slice, panelSex: { ...slice.panelSex, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#22c55e', marginBottom: 2 }}>Биохимия</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['ALT','AST','GGT','Bilirubin','Glucose','Creatinine','Urea','Uric acid','CRP','Homocysteine'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{m}</span>
            <input value={slice.panelBiochem?.[m] || ''} onChange={e => onChange({ ...slice, panelBiochem: { ...slice.panelBiochem, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>Гематология</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{m}</span>
            <input value={slice.panelHematology?.[m] || ''} onChange={e => onChange({ ...slice, panelHematology: { ...slice.panelHematology, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#a855f7', marginBottom: 2 }}>Тиреоидные</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {['TSH','T3 free','T4 free','Anti-TPO','Anti-TG'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{m}</span>
            <input value={slice.panelThyroid?.[m] || ''} onChange={e => onChange({ ...slice, panelThyroid: { ...slice.panelThyroid, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
    </>}
  </div>;
}

const FULL_PANELS: { key: keyof LabSlice; label: string; color: string; markers: string[] }[] = [
  { key:'panelSex', label:'Половые гормоны', color:'#818cf8', markers:['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'] },
  { key:'panelBiochem', label:'Биохимия', color:'#22c55e', markers:['ALT','AST','GGT','Bilirubin','Glucose','Creatinine','Urea','Uric acid','CRP','Homocysteine'] },
  { key:'panelHematology', label:'Гематология', color:'#fbbf24', markers:['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes'] },
  { key:'panelThyroid', label:'Тиреоидные', color:'#a855f7', markers:['TSH','T3 free','T4 free','Anti-TPO','Anti-TG'] },
  { key:'panelLipid', label:'Липидный профиль', color:'#f97316', markers:['Total Cholesterol','LDL','HDL','Triglycerides','VLDL','ApoB','ApoA1','Lp(a)'] },
  { key:'panelIron', label:'Железо / Анемия', color:'#dc2626', markers:['Ferritin','Iron','TIBC','Transferrin Sat','Transferrin'] },
  { key:'panelVitamin', label:'Витамины', color:'#eab308', markers:['B12','Folate','Vitamin D (25-OH)','Vitamin A','Vitamin E','Vitamin K'] },
  { key:'panelCardiac', label:'Кардиомаркеры', color:'#ef4444', markers:['CK','CK-MB','Troponin I','Troponin T','NT-proBNP'] },
  { key:'panelCoagulation', label:'Гемостаз', color:'#ec4899', markers:['D-dimer','Fibrinogen','PT','APTT','INR'] },
  { key:'panelInflammatory', label:'Воспаление', color:'#f59e0b', markers:['IL-6','TNF-alpha','hsCRP'] },
  { key:'panelAdrenal', label:'Надпочечники / Андрогены', color:'#8b5cf6', markers:['DHEA-S','Androstenedione','3a-ADG','Aldosterone','Renin','PTH'] },
  { key:'panelMineral', label:'Минералы / Электролиты', color:'#06b6d4', markers:['Calcium','Phosphorus','Magnesium','Sodium','Potassium','Chloride'] },
  { key:'panelTumor', label:'Онкомаркеры', color:'#be123c', markers:['PSA total','PSA free','CA-125','CEA','AFP'] },
  { key:'panelUrinalysis', label:'Общий анализ мочи', color:'#65a30d', markers:['pH','Protein','Glucose','Ketones','Leukocytes','Nitrite'] },
];

function FullLabInput({ values, onChange }: { values: LabSlice | null; onChange: (v: LabSlice) => void }) {
  const s = values || { date:'', panelSex:{}, panelBiochem:{}, panelHematology:{}, panelThyroid:{}, panelLipid:{}, panelIron:{}, panelVitamin:{}, panelCardiac:{}, panelCoagulation:{}, panelInflammatory:{}, panelAdrenal:{}, panelMineral:{}, panelTumor:{}, panelUrinalysis:{} };
  const upd = (panel: keyof LabSlice, marker: string, val: string) => {
    const pv = s[panel] as Record<string,string> || {};
    onChange({ ...s, [panel]: { ...pv, [marker]: val } });
  };
  return <div>
    {FULL_PANELS.map(pan => <div key={pan.key} style={{ marginBottom:6 }}>
      <div style={{ fontSize:8, fontWeight:600, color:pan.color, marginBottom:2 }}>{pan.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
        {pan.markers.map(m => <div key={m}><span style={{ fontSize:7, color:'var(--text-dim)' }}>{m}</span>
          <input value={(s[pan.key] as Record<string,string>)?.[m] || ''} onChange={e => upd(pan.key, m, e.target.value)} style={{ ...INPUT, padding:'3px 6px', fontSize:9 }} />
        </div>)}
      </div>
    </div>)}
  </div>;
}

function RiskBar({ label, icon, value }: { label: string; icon: string; value: number }) {
  const c = value >= 60 ? '#ef4444' : value >= 30 ? '#fbbf24' : '#22c55e';
  return <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
          <span style={{ color: c, fontWeight: 800 }}>{value}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: c, borderRadius: 2 }} />
        </div>
      </div>
    </div>
  </div>;
}

function MechanismView({ sys }: { sys: SystemRisk }) {
  const [open, setOpen] = useState(false);
  return <div>
    <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0' }}>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{sys.icon} {sys.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: sys.rawScore >= 60 ? '#ef4444' : sys.rawScore >= 30 ? '#fbbf24' : '#22c55e' }}>{sys.rawScore}% → {sys.afterSupport}%</span>
      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
    </div>
    {open && <div style={{ paddingLeft: 12 }}>{sys.mechanisms.map(m =>
      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, fontSize: 8, color: m.active ? 'var(--text)' : 'var(--text-dim)' }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.active ? '#fbbf24' : 'rgba(255,255,255,0.15)' }} />
        <span style={{ flex: 1 }}>{m.name}</span>
        <span style={{ color: m.contribution > 30 ? '#ef4444' : '#fbbf24' }}>{m.contribution}%</span>
      </div>
    )}</div>}
  </div>;
}

function SchedBlock({ items, title }: { items: ScheduleItem[]; title: string }) {
  if (items.length === 0) return null;
  return <div style={{ marginBottom: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
    {items.map(item =>
      <div key={item.substanceId} style={{ ...GLASS, padding: '5px 10px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>💊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{item.instructions}</div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.dose}</span>
        {item.synergyGroup && <span style={BADGE('#818cf8')}>{SYNERGY_ID_LABELS[item.synergyGroup]?.slice(0, 10)}</span>}
      </div>
    )}
  </div>;
}

function LabDeltaView({ deltas }: { deltas: LabDelta[] }) {
  if (deltas.length === 0) return <div style={{ ...GLASS, padding: 12, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>Нет данных</div>;
  const critical = deltas.filter(d => d.trend === 'critical');
  const worsening = deltas.filter(d => d.trend === 'worsening');
  return <div>
    {critical.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444' }}>⚠ Критические: {critical.map(d => d.marker).join(', ')}</span></div>}
    {worsening.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>⚠ Ухудшение: {worsening.map(d => d.marker).join(', ')}</span></div>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {deltas.slice(0, 16).map(d =>
        <div key={d.marker} style={{ ...GLASS, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 7 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', width: 60 }}>{d.marker}</span>
          <span style={{ color: 'var(--text-dim)' }}>{d.sliceValues.map(v => v ?? '—').join('→')}</span>
          <span style={{ marginLeft: 'auto', color: d.trend === 'critical' ? '#ef4444' : d.trend === 'worsening' ? '#fbbf24' : '#22c55e' }}>{d.trend === 'critical' ? '❗' : d.trend === 'worsening' ? '⚠' : '✓'}</span>
        </div>
      )}
    </div>
  </div>;
}

export const AutoCalculator: React.FC<AutoCalculatorProps> = ({ onApply, embedded, courseWeek: propWeek }) => {
  const [state, setState] = useState<CalculatorState>(() => {
    const h = hydrateState();
    return { ...DEFAULT_STATE, ...h, profile: { ...DEFAULT_STATE.profile, ...(h.profile || {}) }, pharma: { ...DEFAULT_STATE.pharma, ...(h.pharma || {}) }, labs: { ...DEFAULT_STATE.labs, ...(h.labs || {}), fullPanel: h.labs?.fullPanel || DEFAULT_STATE.labs.fullPanel } };
  });
  const [tab, setTab] = useState<'cards'|'labs'|'risk'|'schedule'>('cards');
  const [copied, setCopied] = useState(false);
  const [aasEditor, setAasEditor] = useState({ id: 'test_enan', doseMgWeek: 500, weeks: 12 });
  const [negSubId, setNegSubId] = useState('');
  const [showPharmaPicker, setShowPharmaPicker] = useState(false);
  const [showNegPicker, setShowNegPicker] = useState(false);
  const [pharmaSearch, setPharmaSearch] = useState('');
  const [budget, setBudget] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [boostOverride, setBoostOverride] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');


  const effectiveWeek = propWeek || Math.min(state.goals.cycleWeeks || 12, Math.max(1, ...state.pharma.aas.map(a => a.weeks || 12), 6));

  const result = useMemo<CalculatorResult>(() => calculateSupportTZ(state), [state]);

  // Weekly risk dynamics
  const weeklyDynamics = useMemo(() => {
    const course: { id: string; substanceId: string; doseValue: number; doseUnit: string; frequency: number; startWeek: number; endWeek: number }[] = state.pharma.aas.map(a => ({
      id: a.id, substanceId: a.id, doseValue: a.doseMgWeek, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: a.weeks || state.goals.cycleWeeks || 12
    }));
    const activeDrugs: Record<string, { dosePerWeek: number }> = {};
    for (const a of state.pharma.aas) activeDrugs[a.id] = { dosePerWeek: a.doseMgWeek };
    const supCov: Record<string, number> = {};
    for (const sys of result.risk.systems) {
      if (sys.rawScore > 0 && sys.afterSupport < sys.rawScore) supCov[sys.id] = 1 - sys.afterSupport / Math.max(1, sys.rawScore);
    }
    return calculateWeeklyRiskDynamics({ genetics: state.genetics as any, nutritionFactor: state.nutrition.calories / 2500, trainingFactor: Math.min(1.5, state.profile.workoutsPerWeek * state.profile.avgWorkoutMinutes / 420), activeDrugs, supportCoverage: supCov }, course);
  }, [state, result]);

  // Lab forecast (heuristic: current value + drug-induced trend × weeks)
  const labForecast = useMemo(() => {
    const fp = state.labs.fullPanel;
    if (!fp) return null;
    const trend = (now: number | null, per4wk: number): { w4: number; w8: number; w12: number } | null => {
      if (now === null) return null;
      return { w4: now + per4wk, w8: now + per4wk * 2, w12: now + per4wk * 3 };
    };
    const getV = (panel: keyof typeof fp, key: string): number | null => {
      const pv = fp[panel] as Record<string, string> | undefined;
      if (!pv) return null;
      const v = parseFloat(pv[key]);
      return isNaN(v) ? null : v;
    };
    const totalDose = state.pharma.aas.reduce((s, a) => s + (a.doseMgWeek || 0), 0);
    const toxicityFactor = Math.min(2, totalDose / 1000);
    const hasOral = state.pharma.aas.some(a => a.id.includes('oxan') || a.id.includes('meth') || a.id.includes('stan') || a.id.includes('halo') || a.id.includes('trena'));
    const alt = getV('panelBiochem', 'ALT');
    const ast = getV('panelBiochem', 'AST');
    const hct = getV('panelHematology', 'HCT');
    const ldl = getV('panelLipid', 'LDL');
    const hdl = getV('panelLipid', 'HDL');
    const tg = getV('panelLipid', 'Triglycerides');
    const creat = getV('panelBiochem', 'Creatinine');
    const ggt = getV('panelBiochem', 'GGT');
    return {
      ALT: trend(alt, 8 * toxicityFactor * (hasOral ? 1.5 : 1)),
      AST: trend(ast, 5 * toxicityFactor),
      HCT: trend(hct, 1.5 * toxicityFactor),
      LDL: trend(ldl, 0.3 * toxicityFactor),
      HDL: trend(hdl, -0.1 * toxicityFactor),
      TG: trend(tg, 0.2 * toxicityFactor),
      Creatinine: trend(creat, 2 * toxicityFactor),
      GGT: trend(ggt, 6 * toxicityFactor * (hasOral ? 1.5 : 1)),
    };
  }, [state]);

  // Auto-save state to localStorage (data feeds into calcSupport() via hydrateState)
  React.useEffect(() => {
    try {
      localStorage.setItem('he_autocalc_state', JSON.stringify(state));
    } catch {}
  }, [state]);

  const update = <K extends keyof CalculatorState>(key: K, val: CalculatorState[K]) => setState(s => ({ ...s, [key]: val }));
  const uProf = (v: Partial<CalculatorState['profile']>) => setState(s => ({ ...s, profile: { ...s.profile, ...v } }));
  const uPharm = (v: Partial<CalculatorState['pharma']>) => setState(s => ({ ...s, pharma: { ...s.pharma, ...v } }));
  const uNeuro = (v: Partial<CalculatorState['neuro']>) => setState(s => ({ ...s, neuro: { ...s.neuro, ...v } }));
  const uGoals = (v: Partial<CalculatorState['goals']>) => setState(s => ({ ...s, goals: { ...s.goals, ...v } }));
  const uHep = (v: Partial<CalculatorState['hepatobiliary']>) => setState(s => ({ ...s, hepatobiliary: { ...s.hepatobiliary, ...v } }));
  const uUrin = (v: Partial<CalculatorState['urinary']>) => setState(s => ({ ...s, urinary: { ...s.urinary, ...v } }));
  const uCard = (v: Partial<CalculatorState['cardio']>) => setState(s => ({ ...s, cardio: { ...s.cardio, ...v } }));
  const uODA = (v: Partial<CalculatorState['oda']>) => setState(s => ({ ...s, oda: { ...s.oda, ...v } }));
  const uNutr = (v: Partial<CalculatorState['nutrition']>) => setState(s => ({ ...s, nutrition: { ...s.nutrition, ...v } }));
  const uContr = (v: Partial<CalculatorState['contraindications']>) => setState(s => ({ ...s, contraindications: { ...s.contraindications, ...v } }));
  const uEpic = (v: Partial<CalculatorState['epicrisis']>) => setState(s => ({ ...s, epicrisis: { ...s.epicrisis, ...v } }));
  const uToxic = (v: Partial<CalculatorState['toxicLoad']>) => setState(s => ({ ...s, toxicLoad: { ...s.toxicLoad, ...v } }));
  const uDent = (v: Partial<CalculatorState['dental']>) => setState(s => ({ ...s, dental: { ...s.dental, ...v } }));
  const uGen = (v: Partial<CalculatorState['genetics']>) => setState(s => ({ ...s, genetics: { ...s.genetics, ...v } }));
  const uGI = (v: Partial<CalculatorState['gi']>) => setState(s => ({ ...s, gi: { ...s.gi, ...v } }));
  const uPsych = (v: Partial<CalculatorState['psych']>) => setState(s => ({ ...s, psych: { ...s.psych, ...v } }));
  const uInj = (v: Partial<CalculatorState['injection']>) => setState(s => ({ ...s, injection: { ...s.injection, ...v } }));

  const handleCopy = useCallback(() => {
    const lines = [
      `🧬 КАЛЬКУЛЯТОР ПОДДЕРЖКИ — ПОЛНЫЙ ОТЧЁТ`,
      `📅 ${new Date().toLocaleString('ru-RU')}`,
      `👤 ${state.profile.weight}кг · ${state.profile.age}лет · ${state.profile.sex === 'male' ? 'М' : 'Ж'}`,
      `${'─'.repeat(40)}`,
      `📊 ОБЩИЙ РИСК: ${result.overallRiskBefore}% → ${result.overallRiskAfter}% (уровень: ${state.powerLevel})`,
      ``,
      `⚠ СИСТЕМЫ РИСКА:`,
      ...result.risk.systems.filter(s => s.rawScore > 0).map(s => `  ${s.icon} ${s.label}: ${s.rawScore}% → ${s.afterSupport}%`),
    ];
    if (result.labDeltas.length > 0) {
      lines.push(``, `🧪 ЛАБОРАТОРИЯ:`);
      for (const d of result.labDeltas.filter(d => d.trend !== 'stable')) lines.push(`  ${d.marker}: ${d.trend} `);
    }
    lines.push(``, `💊 ПЛАН ПОДДЕРЖКИ (${result.schedule.length} позиций):`);
    for (const item of result.schedule) lines.push(`  ${item.timeBlock === 'morning' ? '🌅' : item.timeBlock === 'afternoon' ? '☀️' : '🌙'} ${item.name} — ${item.dose} (${item.instructions})`);
    if (Object.keys(result.titrationApplied).length > 0) lines.push(``, `⚖ ТИТРАЦИЯ: ${Object.entries(result.titrationApplied).map(([k, v]) => `${k}=${v}мг`).join(', ')}`);
    lines.push(``, `🔗 СИНЕРГИИ: ${result.synergyIdsUsed.map(id => SYNERGY_ID_LABELS[id]).join(', ')}`);
    if (result.contraindicationAlerts.length > 0) lines.push(``, `⚠ ПРОТИВОПОКАЗАНИЯ:`, ...result.contraindicationAlerts);
    if (result.negativeBlocks.length > 0) lines.push(``, `🚫 ЗАБЛОКИРОВАНО (негативный опыт): ${result.negativeBlocks.join(', ')}`);
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }, [state, result]);

  const tabs = [
    { id: 'cards', label: '📝 Данные' },
  ] as const;

  return (
    <div style={embedded ? {} : { padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      {!embedded && <div style={{ marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🧮 Калькулятор поддержки</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight:1.4 }}>Подбор рекомендуемой поддержки на основе данных пользователя, анализов, фармакологии и расчёта рисков</div>
      </div>}

      {tab === 'cards' && <div>

        <Card icon="👤" title="Профиль" defaultOpen cols={3}>
          <PopupNumber label="Вес" value={state.profile.weight} min={30} max={250} suffix="кг" onChange={v => uProf({ weight: v })} />
          <PopupNumber label="Возраст" value={state.profile.age} min={14} max={90} suffix="лет" onChange={v => uProf({ age: v })} />
          <PopupSelect label="Пол" value={state.profile.sex} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} onChange={v => uProf({ sex: v as Sex })} />
          <PopupNumber label="Рост" value={state.profile.height || 175} min={140} max={220} suffix="см" onChange={v => uProf({ height: v })} />
          <PopupNumber label="Жир" value={state.profile.bodyfat || 15} min={4} max={50} suffix="%" onChange={v => uProf({ bodyfat: v })} />
          <PopupNumber label="Тренировки/нед" value={state.profile.workoutsPerWeek} min={0} max={14} suffix="раз" onChange={v => uProf({ workoutsPerWeek: v })} />
          <PopupNumber label="Длит. тренировки" value={state.profile.avgWorkoutMinutes} min={15} max={180} suffix="мин" onChange={v => uProf({ avgWorkoutMinutes: v })} />
          <PopupNumber label="Сон" value={state.profile.sleepHours} min={3} max={12} suffix="ч" onChange={v => uProf({ sleepHours: v })} />
          <PopupNumber label="Стресс (1-10)" value={state.profile.stressLevel} min={1} max={10} onChange={v => uProf({ stressLevel: v })} />
          <PopupBool label="Курение" value={state.profile.smoker} onChange={v => uProf({ smoker: v })} />
          <PopupSelect label="Алкоголь" value={state.profile.alcohol} options={[{id:'never',label:'Никогда'},{id:'rare',label:'Редко'},{id:'sometimes',label:'Иногда'},{id:'regular',label:'Регулярно'}]} onChange={v => uProf({ alcohol: v as any })} />
          <PopupNumber label="Кофеин" value={state.profile.caffeineMg} min={0} max={2000} step={50} suffix="мг" onChange={v => uProf({ caffeineMg: v })} />
        </Card>

        <Card icon="🧠" title="Неврологический статус" cols={2}>
          <PopupNumber label="Дофамин" value={state.neuro.dopamineScore} min={1} max={5} onChange={v => uNeuro({ dopamineScore: v })} />
          <PopupNumber label="Серотонин" value={state.neuro.serotoninScore} min={1} max={5} onChange={v => uNeuro({ serotoninScore: v })} />
          <PopupNumber label="Агрессия" value={state.neuro.aggressionScore} min={1} max={5} onChange={v => uNeuro({ aggressionScore: v })} />
          <PopupSelect label="ГАМК баланс" value={state.neuro.gabaBalance} options={[{id:'balance',label:'Норма'},{id:'overexcited',label:'Возбуждение'},{id:'inhibited',label:'Заторможенность'}]} onChange={v => uNeuro({ gabaBalance: v as any })} />
          <PopupSelect label="Качество сна" value={state.neuro.sleepQuality} options={[{id:'good',label:'Хорошее'},{id:'fair',label:'Среднее'},{id:'poor',label:'Плохое'}]} onChange={v => uNeuro({ sleepQuality: v as any })} />
          <PopupBool label="Проблемы с памятью" value={state.neuro.memoryIssues} onChange={v => uNeuro({ memoryIssues: v })} />
          <PopupBool label="Проблемы с фокусом" value={state.neuro.focusIssues} onChange={v => uNeuro({ focusIssues: v })} />
          <PopupBool label="Замедленное мышление" value={state.neuro.slowThinking} onChange={v => uNeuro({ slowThinking: v })} />
          <PopupBool label="Координация" value={state.neuro.coordinationIssues} onChange={v => uNeuro({ coordinationIssues: v })} />
          <PopupBool label="Головные боли" value={state.neuro.headaches} onChange={v => uNeuro({ headaches: v })} />
          <PopupBool label="Метеозависимость" value={state.neuro.weatherDependent} onChange={v => uNeuro({ weatherDependent: v })} />
        </Card>

        <Card icon="💉" title="Фарма стек / Курс" cols={2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupSelect label="Фаза курса" value={state.pharma.phase} options={[{id:'course',label:'Курс'},{id:'bridge',label:'Бридж'},{id:'pct',label:'ПКТ'},{id:'base',label:'База'}]} onChange={v => uPharm({ phase: v as any })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>ААС препараты</div>
            {state.pharma.aas.length > 0 && <div style={{ marginBottom: 4 }}>
              {state.pharma.aas.map((a, i) =>
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, padding: '3px 8px', marginBottom: 2, display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                  <span style={{ color: 'var(--text)' }}>{a.id} — {a.doseMgWeek} мг/нед × {a.weeks} нед</span>
                  <button onClick={() => uPharm({ aas: state.pharma.aas.filter((_, j) => j !== i) })} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </div>
              )}
            </div>}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowPharmaPicker(true)} style={{ padding:'6px 10px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a' }}>+ Добавить препарат</button>
              <input type="number" value={aasEditor.doseMgWeek || ''} onChange={e => setAasEditor(p => ({ ...p, doseMgWeek: +e.target.value }))} style={{ ...INPUT, width: 64, fontSize: 9 }} placeholder="мг/нед" />
              <input type="number" value={aasEditor.weeks || ''} onChange={e => setAasEditor(p => ({ ...p, weeks: +e.target.value }))} style={{ ...INPUT, width: 44, fontSize: 9 }} placeholder="нед" />
            </div>
          </div>
          <div style={{ fontSize:8, fontWeight:600, color:'var(--text-dim)', gridColumn:'1 / -1', marginTop:2, marginBottom:4 }}>— Флаги —</div>
          <PopupBool label="ГР" value={state.pharma.hasGH} onChange={v => uPharm({ hasGH: v })} />
          <PopupBool label="ИГФ-1" value={state.pharma.hasIGF} onChange={v => uPharm({ hasIGF: v })} />
          <PopupBool label="Инсулин" value={state.pharma.hasInsulin} onChange={v => uPharm({ hasInsulin: v })} />
          <PopupBool label="ХГЧ" value={state.pharma.hasHCG} onChange={v => uPharm({ hasHCG: v })} />
          <PopupBool label="АИ" value={state.pharma.hasAI} onChange={v => uPharm({ hasAI: v })} />
          <PopupBool label="Каберголин" value={state.pharma.hasCaber} onChange={v => uPharm({ hasCaber: v })} />
          <PopupBool label="СЕРМ" value={state.pharma.hasSERM} onChange={v => uPharm({ hasSERM: v })} />
          <PopupBool label="SARMs" value={state.pharma.hasSARMs} onChange={v => uPharm({ hasSARMs: v })} />
          {/* Анализ курса */}
          {state.pharma.aas.length > 0 && (() => {
            const countOral = state.pharma.aas.filter(a => a.id.includes('stan')||a.id.includes('oxan')||a.id.includes('meth')||a.id.includes('trena')||a.id.includes('halo')||a.id.includes('superdrol')||a.id.includes('anadrol')).length;
            const totalDose = state.pharma.aas.reduce((s,a) => s + a.doseMgWeek, 0);
            const toxLevel = totalDose > 1500 ? 'Высокий' : totalDose > 700 ? 'Средний' : 'Низкий';
            const toxColor = totalDose > 1500 ? '#ef4444' : totalDose > 700 ? '#f59e0b' : '#22c55e';
            return <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>📊 Анализ курса</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, fontSize:8 }}>
                <div>Препаратов: <b style={{color:'var(--accent)'}}>{state.pharma.aas.length}</b></div>
                <div>Суммарно: <b style={{color:'var(--accent)'}}>{totalDose} мг/нед</b></div>
                {countOral > 0 && <div>Оральных: <b style={{color:'#ef4444'}}>{countOral}</b></div>}
                <div>Токсичность: <b style={{color:toxColor}}>{toxLevel}</b></div>
              </div>
            </div>;
          })()}
        </Card>

        <Card icon="🎯" title="Цели / Цикл" cols={2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupSelect label="Тип цикла" value={state.goals.trainingCycle} options={[{id:'mass',label:'Масса'},{id:'cut',label:'Сушка'},{id:'maintenance',label:'Поддержка'},{id:'endurance',label:'Выносливость'}]} onChange={v => uGoals({ trainingCycle: v as any })} />
          </div>
          <PopupBool label="Здоровье" value={state.goals.healthMaintenance} onChange={v => uGoals({ healthMaintenance: v })} />
          <PopupBool label="Подготовка к соревн." value={state.goals.competitionPrep} onChange={v => uGoals({ competitionPrep: v })} />
          <PopupBool label="Восстановление сна" value={state.goals.sleepRecovery} onChange={v => uGoals({ sleepRecovery: v })} />
          <PopupBool label="Коррекция липидов" value={state.goals.lipidCorrection} onChange={v => uGoals({ lipidCorrection: v })} />
          <PopupBool label="Разжижение крови" value={state.goals.bloodThinning} onChange={v => uGoals({ bloodThinning: v })} />
          <PopupBool label="Детокс печени" value={state.goals.liverDetox} onChange={v => uGoals({ liverDetox: v })} />
          <PopupBool label="Контроль АД" value={state.goals.bpControl} onChange={v => uGoals({ bpControl: v })} />
          <PopupNumber label="Длит. цикла" value={state.goals.cycleWeeks} min={1} max={52} suffix="нед" onChange={v => uGoals({ cycleWeeks: v })} />
          <PopupNumber label="Прошло циклов" value={state.goals.previousCycles} min={0} max={20} suffix="раз" onChange={v => uGoals({ previousCycles: v })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupSelect label="Время с последнего цикла" value={state.goals.timeSinceLastCycle} options={[{id:'none',label:'Первый'},{id:'<3mo',label:'<3 мес'},{id:'3-6mo',label:'3-6 мес'},{id:'>6mo',label:'>6 мес'},{id:'trt',label:'TRT'}]} onChange={v => uGoals({ timeSinceLastCycle: v as any })} />
          </div>
        </Card>

        <Card icon="🫁" title="Гепатобилиарная" cols={2}>
          <SevSelect label="АЛТ/АСТ" value={state.hepatobiliary.altAstElevation} onChange={v => uHep({ altAstElevation: v as any })} />
          <SevSelect label="ГГТ" value={state.hepatobiliary.ggtElevation} onChange={v => uHep({ ggtElevation: v as any })} />
          <SevSelect label="Билирубин" value={state.hepatobiliary.bilirubinElevation} onChange={v => uHep({ bilirubinElevation: v as any })} />
          <PopupBool label="Жировой гепатоз" value={state.hepatobiliary.fattyLiver} onChange={v => uHep({ fattyLiver: v })} />
          <PopupBool label="Холецистит" value={state.hepatobiliary.cholecystitis} onChange={v => uHep({ cholecystitis: v })} />
          <PopupSelect label="Алкогольная история" value={state.hepatobiliary.alcoholHistory} options={[{id:'none',label:'Нет'},{id:'past',label:'В прошлом'},{id:'current',label:'Сейчас'}]} onChange={v => uHep({ alcoholHistory: v as any })} />
        </Card>

        <Card icon="💧" title="Мочевыделительная" cols={2}>
          <SevSelect label="Креатинин" value={state.urinary.creatinineElevation} onChange={v => uUrin({ creatinineElevation: v as any })} />
          <SevSelect label="Мочевина" value={state.urinary.ureaElevation} onChange={v => uUrin({ ureaElevation: v as any })} />
          <PopupBool label="Протеинурия" value={state.urinary.proteinuria} onChange={v => uUrin({ proteinuria: v })} />
          <PopupBool label="Нефротокс. препараты" value={state.urinary.nephrotoxicDrugs} onChange={v => uUrin({ nephrotoxicDrugs: v })} />
          <PopupBool label="Гипертензия" value={state.urinary.hypertension} onChange={v => uUrin({ hypertension: v })} />
          <PopupBool label="Диабет" value={state.urinary.diabetes} onChange={v => uUrin({ diabetes: v })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupSelect label="Характер мочеиспускания" value={state.urinary.urinationPattern} options={[{id:'normal',label:'Норма'},{id:'frequent',label:'Частое'},{id:'nocturia',label:'Ночное'},{id:'painful',label:'Болезненное'}]} onChange={v => uUrin({ urinationPattern: v as any })} />
          </div>
        </Card>

        <Card icon="❤️" title="Сердечно-сосудистая" cols={2}>
          <PopupSelect label="АД стадия" value={state.cardio.bpStage} options={[{id:'normal',label:'Норма'},{id:'prehypertension',label:'Прегипертензия'},{id:'hypertension1',label:'Гипертензия 1'},{id:'hypertension2',label:'Гипертензия 2'}]} onChange={v => uCard({ bpStage: v as any })} />
          <PopupNumber label="ЧСС" value={state.cardio.heartRate} min={40} max={120} suffix="уд/мин" onChange={v => uCard({ heartRate: v })} />
          <SevSelect label="ЛПНП" value={state.cardio.ldlElevation} onChange={v => uCard({ ldlElevation: v as any })} />
          <SevSelect label="Гематокрит" value={state.cardio.hctElevation} onChange={v => uCard({ hctElevation: v as any })} />
          <PopupBool label="Низкий ЛПВП" value={state.cardio.hdlLow} onChange={v => uCard({ hdlLow: v })} />
          <PopupSelect label="Триглицериды" value={state.cardio.triglycerides} options={[{id:'normal',label:'Норма'},{id:'elevated',label:'Повышены'},{id:'high',label:'Высокие'}]} onChange={v => uCard({ triglycerides: v as any })} />
          <PopupBool label="ССЗ в анамнезе" value={state.cardio.previousCVD} onChange={v => uCard({ previousCVD: v })} />
          <PopupBool label="ССЗ в семье" value={state.cardio.familyCVD} onChange={v => uCard({ familyCVD: v })} />
        </Card>

        <Card icon="🦴" title="ОДА / Суставы" cols={2}>
          <SevSelect label="Боль в суставах" value={state.oda.jointPain} onChange={v => uODA({ jointPain: v as any })} />
          <PopupBool label="Проблемы со связками" value={state.oda.ligamentIssues} onChange={v => uODA({ ligamentIssues: v })} />
          <PopupBool label="Боль в спине" value={state.oda.backPain} onChange={v => uODA({ backPain: v })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={LABEL}>Травмы</span>
            <input value={state.oda.injuries.join(', ')} onChange={e => uODA({ injuries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={INPUT} />
          </div>
        </Card>

        <Card icon="🥗" title="Питание / Метаболизм" cols={3}>
          <PopupNumber label="Калории" value={state.nutrition.calories} min={800} max={8000} step={50} suffix="ккал" onChange={v => uNutr({ calories: v })} />
          <PopupNumber label="Белок" value={state.nutrition.proteinG} min={0} max={500} suffix="г" onChange={v => uNutr({ proteinG: v })} />
          <PopupNumber label="Жиры" value={state.nutrition.fatG} min={0} max={300} suffix="г" onChange={v => uNutr({ fatG: v })} />
          <PopupNumber label="Углеводы" value={state.nutrition.carbsG} min={0} max={1000} suffix="г" onChange={v => uNutr({ carbsG: v })} />
          <PopupNumber label="Вода" value={state.nutrition.waterL} min={0.5} max={6} step={0.1} suffix="л" onChange={v => uNutr({ waterL: v })} />
          <PopupNumber label="Клетчатка" value={state.nutrition.fiberG} min={0} max={100} suffix="г" onChange={v => uNutr({ fiberG: v })} />
          <PopupBool label="Омега-3" value={state.nutrition.omega3} onChange={v => uNutr({ omega3: v })} />
          <PopupSelect label="Соль" value={state.nutrition.saltIntake} options={[{id:'low',label:'Мало'},{id:'normal',label:'Норма'},{id:'high',label:'Много'}]} onChange={v => uNutr({ saltIntake: v as any })} />
        </Card>

        <Card icon="🩺" title="Медицинские противопоказания" cols={3}>
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupText label="Аллергии" value={state.contraindications.allergies} onChange={v => uContr({ allergies: v })} placeholder="укажите" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <PopupBool label="ССЗ" value={state.contraindications.hasCVD} onChange={v => uContr({ hasCVD: v })} />
            <PopupBool label="Тромбофилия" value={state.contraindications.hasThrombophilia} onChange={v => uContr({ hasThrombophilia: v })} />
            <PopupBool label="Диабет" value={state.contraindications.hasDiabetes} onChange={v => uContr({ hasDiabetes: v })} />
            <PopupBool label="Эпилепсия" value={state.contraindications.hasEpilepsy} onChange={v => uContr({ hasEpilepsy: v })} />
            <PopupBool label="Психические расстройства" value={state.contraindications.hasMentalIllness} onChange={v => uContr({ hasMentalIllness: v })} />
            <PopupBool label="Болезни печени" value={state.contraindications.hasLiverDisease} onChange={v => uContr({ hasLiverDisease: v })} />
            <PopupBool label="Болезни почек" value={state.contraindications.hasKidneyDisease} onChange={v => uContr({ hasKidneyDisease: v })} />
            <PopupBool label="ЖКТ заболевания" value={state.contraindications.hasGI} onChange={v => uContr({ hasGI: v })} />
            <PopupBool label="Простата" value={state.contraindications.hasProstateIssues} onChange={v => uContr({ hasProstateIssues: v })} />
          </div>
        </Card>

        <Card icon="📓" title="Журнал негативного опыта">
          <button onClick={() => setShowNegPicker(true)} style={{ width:'100%', padding:'6px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', marginBottom:4 }}>
            🚫 Добавить негативный опыт
          </button>
          {state.journal.negative.length > 0 && <div>
            {state.journal.negative.map((n, i) =>
              <div key={i} style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', borderRadius:6, padding: '3px 8px', marginBottom: 2, display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                <span style={{ color: '#ef4444' }}>🚫 {n.substanceId}</span>
                <button onClick={() => setState(s => ({ ...s, journal: { ...s.journal, negative: s.journal.negative.filter((_, j) => j !== i) } }))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}
          </div>}
        </Card>

        <Card icon="📋" title="Эпикриз / Фарм. анамнез" cols={2}>
          <PopupBool label="Гинекомастия в прошлом" value={state.epicrisis.pastGyno} onChange={v => uEpic({ pastGyno: v })} />
          <PopupBool label="Падение либидо" value={state.epicrisis.pastLibidoDrop} onChange={v => uEpic({ pastLibidoDrop: v })} />
          <PopupBool label="Скачок гематокрита" value={state.epicrisis.pastHctSpike} onChange={v => uEpic({ pastHctSpike: v })} />
          <PopupBool label="Проблемы с печенью" value={state.epicrisis.pastLiverIssues} onChange={v => uEpic({ pastLiverIssues: v })} />
          <PopupBool label="Проблемы с почками" value={state.epicrisis.pastKidneyIssues} onChange={v => uEpic({ pastKidneyIssues: v })} />
        </Card>

        <Card icon="☣️" title="Токсическая нагрузка / Детокс" cols={2}>
          <PopupBool label="Вредное производство" value={state.toxicLoad.hazardousWork} onChange={v => uToxic({ hazardousWork: v })} />
          <PopupBool label="Регулярные НПВС" value={state.toxicLoad.regularNSAIDs} onChange={v => uToxic({ regularNSAIDs: v })} />
          <PopupBool label="Другие тяжёлые препараты" value={state.toxicLoad.otherHeavyDrugs} onChange={v => uToxic({ otherHeavyDrugs: v })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <PopupSelect label="Частота стула" value={state.toxicLoad.bowelFrequency} options={[{id:'regular',label:'Регулярный'},{id:'constipation',label:'Запоры'}]} onChange={v => uToxic({ bowelFrequency: v as any })} />
          </div>
        </Card>

        <Card icon="🦷" title="Стоматология / Минеральный обмен" cols={2}>
          <PopupBool label="Кровоточивость дёсен" value={state.dental.bleedingGums} onChange={v => uDent({ bleedingGums: v })} />
          <PopupBool label="Шатаются зубы" value={state.dental.looseTeeth} onChange={v => uDent({ looseTeeth: v })} />
          <PopupBool label="Бруксизм (скрежет)" value={state.dental.nightGrinding} onChange={v => uDent({ nightGrinding: v })} />
          <PopupBool label="Переломы костей" value={state.dental.boneFractures} onChange={v => uDent({ boneFractures: v })} />
          <PopupBool label="Судороги (крампи)" value={state.dental.cramps} onChange={v => uDent({ cramps: v })} />
        </Card>

        <Card icon="🧬" title="Генетические полиморфизмы" cols={2}>
          <PopupSelect label="CYP19A1" value={state.genetics.cyp19a1} options={[{id:'high',label:'Высокая активность'},{id:'normal',label:'Норма'},{id:'unknown',label:'Неизвестно'}]} onChange={v => uGen({ cyp19a1: v as any })} />
          <PopupSelect label="SRD5A2" value={state.genetics.srd5a2} options={[{id:'hypersensitive',label:'Гиперчувствительность'},{id:'normal',label:'Норма'},{id:'unknown',label:'Неизвестно'}]} onChange={v => uGen({ srd5a2: v as any })} />
          <PopupSelect label="Чувствительность АР" value={state.genetics.arSensitivity} options={[{id:'high',label:'Высокая'},{id:'normal',label:'Норма'},{id:'low',label:'Низкая'},{id:'unknown',label:'Неизвестно'}]} onChange={v => uGen({ arSensitivity: v as any })} />
          <PopupSelect label="MTHFR" value={state.genetics.mthfr} options={[{id:'c677t',label:'C677T (мутация)'},{id:'normal',label:'Норма'},{id:'unknown',label:'Неизвестно'}]} onChange={v => uGen({ mthfr: v as any })} />
        </Card>

        <Card icon="🫀" title="ЖКТ / Микробиом" cols={2}>
          <PopupBool label="Вздутие" value={state.gi.bloating} onChange={v => uGI({ bloating: v })} />
          <PopupBool label="Изжога" value={state.gi.heartburn} onChange={v => uGI({ heartburn: v })} />
          <PopupBool label="Диарея" value={state.gi.diarrhea} onChange={v => uGI({ diarrhea: v })} />
          <PopupBool label="Запоры" value={state.gi.constipation} onChange={v => uGI({ constipation: v })} />
          <PopupBool label="СРК (диагноз)" value={state.gi.diagnosedIBS} onChange={v => uGI({ diagnosedIBS: v })} />
          <PopupBool label="Ферментная поддержка" value={state.gi.enzymeSupport} onChange={v => uGI({ enzymeSupport: v })} />
          <PopupBool label="Пробиотики" value={state.gi.probioticUse} onChange={v => uGI({ probioticUse: v })} />
        </Card>

        <Card icon="🧘" title="Психологическая зависимость" cols={3}>
          <PopupNumber label="Страх потери" value={state.psych.fearOfLoss} min={1} max={5} onChange={v => uPsych({ fearOfLoss: v })} />
          <PopupNumber label="Одержимость зеркалом" value={state.psych.mirrorObsession} min={1} max={5} onChange={v => uPsych({ mirrorObsession: v })} />
          <PopupNumber label="Апатия вне курса" value={state.psych.apathyOffCycle} min={1} max={5} onChange={v => uPsych({ apathyOffCycle: v })} />
        </Card>

        <Card icon="💉" title="Мониторинг зон инъекций" cols={2}>
          <PopupSelect label="Ягодицы" value={state.injection.glutes} options={[{id:'',label:'—'},{id:'ok',label:'OK'},{id:'уплотнение',label:'Уплотнение'},{id:'боль',label:'Боль'},{id:'гематома',label:'Гематома'}]} onChange={v => uInj({ glutes: v })} />
          <PopupSelect label="Квадрицепсы" value={state.injection.quads} options={[{id:'',label:'—'},{id:'ok',label:'OK'},{id:'уплотнение',label:'Уплотнение'},{id:'боль',label:'Боль'},{id:'гематома',label:'Гематома'}]} onChange={v => uInj({ quads: v })} />
          <PopupSelect label="Дельты" value={state.injection.delts} options={[{id:'',label:'—'},{id:'ok',label:'OK'},{id:'уплотнение',label:'Уплотнение'},{id:'боль',label:'Боль'},{id:'гематома',label:'Гематома'}]} onChange={v => uInj({ delts: v })} />
          <PopupSelect label="Локальные зоны" value={state.injection.localAreas} options={[{id:'',label:'—'},{id:'ok',label:'OK'},{id:'уплотнение',label:'Уплотнение'},{id:'боль',label:'Боль'},{id:'гематома',label:'Гематома'}]} onChange={v => uInj({ localAreas: v })} />
        </Card>

        {/* Лаборатория — полный спектр */}
        <Card icon="🧪" title="Лаборатория (полный спектр)">
          <FullLabInput values={state.labs.fullPanel} onChange={v => update('labs', { ...state.labs, fullPanel: v })} />
          {result.labDeltas.length > 0 && (
            <div style={{ marginTop: 4, padding:'4px 6px', borderRadius:4, background:'rgba(96,165,250,0.06)' }}>
              <div style={{ fontSize:8, fontWeight:600, color:'#60a5fa', marginBottom:2 }}>📊 Динамика показателей</div>
              <LabDeltaView deltas={result.labDeltas} />
            </div>
          )}
        </Card>

        {/* 💾 Сохранить / загрузить ВВОДНЫЕ данные калькулятора (не результат расчёта) */}
        <div style={{ marginTop:6, padding:'4px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.08)', fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>
          💡 Сохраняются только введённые параметры (профиль, курс, анализы). Результат расчёта сохраняется отдельно — в плане.
        </div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={() => {
            const saveData = { state, budget, boostOverride, timestamp: new Date().toISOString() };
            try { localStorage.setItem('he_autocalc_save', JSON.stringify(saveData)); setSaveStatus('✅ Вводные сохранены'); setTimeout(() => setSaveStatus(''), 2000); } catch { setSaveStatus('❌ Ошибка'); }
          }} style={{
            flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
            background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', color:'var(--accent)',
          }}>
            💾 Сохранить вводные
          </button>
          <button onClick={() => {
            try {
              const raw = localStorage.getItem('he_autocalc_save');
              if (!raw) { setSaveStatus('❌ Нет сохранения вводных'); setTimeout(() => setSaveStatus(''), 2000); return; }
              const data = JSON.parse(raw);
              if (data.state) setState(data.state);
              if (data.budget) setBudget(data.budget);
              if (data.boostOverride !== undefined) setBoostOverride(data.boostOverride);
              setSaveStatus('✅ Вводные восстановлены');
              setTimeout(() => setSaveStatus(''), 2000);
            } catch { setSaveStatus('❌ Ошибка'); }
          }} style={{
            flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
            background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.15)', color:'#60a5fa',
          }}>
            📂 Восстановить вводные
          </button>
        </div>
        {saveStatus && <div style={{ fontSize:8, color:'var(--accent)', textAlign:'center', marginTop:4 }}>{saveStatus}</div>}

      </div>}

      {/* ─── TAB: LABS ── */}
      {tab === 'labs' && <div>
        <div style={{ ...GLASS, marginBottom: 6, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>🧪 Лаборатория — 3 среза, 4 панели</div>
          <LabSliceInput label="🔵 До курса" slice={state.labs.preCourse} onChange={v => update('labs', { ...state.labs, preCourse: v })} />
          <LabSliceInput label="🔴 На курсе" slice={state.labs.midCourse} onChange={v => update('labs', { ...state.labs, midCourse: v })} />
          <LabSliceInput label="🟢 После ПКТ" slice={state.labs.postPCT} onChange={v => update('labs', { ...state.labs, postPCT: v })} />
        </div>
        <div style={{ ...GLASS, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>📊 Динамика</div>
          <LabDeltaView deltas={result.labDeltas} />
        </div>
      </div>}

      {/* ─── TAB: RISK ── */}
      {tab === 'risk' && <div>
        <div style={{ ...GLASS, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {result.risk.systems.map(sys =>
            <RiskBar key={sys.id} label={sys.label} icon={sys.icon} value={sys.rawScore} />
          )}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🔍 Механизмы риска</div>
        {result.risk.systems.filter(s => s.rawScore > 0).map(sys =>
          <div key={sys.id} style={{ ...GLASS, padding: '4px 10px', marginBottom: 3 }}>
            <MechanismView sys={sys} />
          </div>
        )}
        {result.contraindicationAlerts.length > 0 && <div style={{ ...GLASS, padding: 8, marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>⚠ Противопоказания</div>
          {result.contraindicationAlerts.map((a, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text)', marginBottom: 2 }}>{a}</div>)}
        </div>}
        {result.negativeBlocks.length > 0 && <div style={{ ...GLASS, padding: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🚫 Заблокировано (негативный опыт)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{result.negativeBlocks.map(id =>
            <span key={id} style={BADGE('#ef4444')}>{id}</span>
          )}</div>
        </div>}
      </div>}

      {/* ─── TAB: SCHEDULE ── */}
      {tab === 'schedule' && <div>
        <div style={{ ...GLASS, padding: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🔗 Synergy_ID ({result.synergyIdsUsed.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {result.synergyIdsUsed.map(id =>
              <span key={id} style={BADGE('#818cf8')}>{SYNERGY_ID_LABELS[id]}</span>
            )}
          </div>
        </div>
        {Object.keys(result.titrationApplied).length > 0 && <div style={{ ...GLASS, padding: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>⚖ Титрация</div>
          {Object.entries(result.titrationApplied).map(([k, v]) =>
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, fontSize: 9 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{k}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{v} мг</span>
            </div>
          )}
        </div>}
        <SchedBlock items={result.schedule} title="🌅 Утро" />
        <SchedBlock items={result.schedule} title="☀️ День" />
        <SchedBlock items={result.schedule} title="🌙 Вечер" />
        <div style={{ ...GLASS, padding: 8, fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
          {result.schedule.length} позиций · {result.synergyIdsUsed.length} синергий · риск {result.overallRiskBefore}% → {result.overallRiskAfter}%
          {result.negativeBlocks.length > 0 && ` · 🚫 ${result.negativeBlocks.length} заблокировано`}
        </div>
      </div>}

      {copied && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 12, padding: '8px 16px', fontSize: 10, color: 'var(--accent)', zIndex: 999 }}>📋 Отчёт скопирован</div>}

      {/* Pharma picker popup */}
      {showPharmaPicker && <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowPharmaPicker(false)}>
        <div onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: 400, maxHeight: '75vh', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #00e68a, #00c853)' }} />
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>💉 Выбор препарата</div>
            <input value={pharmaSearch} onChange={e => setPharmaSearch(e.target.value)} placeholder="Поиск..." style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, marginBottom: 8, boxSizing: 'border-box' }} />
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {Object.entries(PHARMA_DB)
                .filter(([id, ph]) => !pharmaSearch || (ph.name||'').toLowerCase().includes(pharmaSearch.toLowerCase()) || id.toLowerCase().includes(pharmaSearch.toLowerCase()))
                .filter(([id]) => PHARMA_CLASSES.includes((PHARMA_DB[id] as any)?.class))
                .slice(0, 40)
                .map(([id, ph]) => (
                <button key={id} onClick={() => { setAasEditor(p => ({ ...p, id })); setShowPharmaPicker(false); }} style={{
                  display: 'block', width: '100%', padding: '8px 10px', marginBottom: 2, borderRadius: 8, cursor: 'pointer', fontSize: 10, textAlign: 'left',
                  background: aasEditor.id === id ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                  border: aasEditor.id === id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: aasEditor.id === id ? '#00e68a' : 'rgba(255,255,255,0.8)',
                }}>
                  <div style={{ fontWeight: 700 }}>{ph.name || id}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{id} · класс: {(ph as any).class}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>}

      {/* Negative experience picker popup */}
      {showNegPicker && <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowNegPicker(false)}>
        <div onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: 400, maxHeight: '75vh', borderRadius: 16, background: '#18181b', border: '1px solid rgba(239,68,68,0.2)', overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🚫 Негативный опыт</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Выберите вещество, на которое была негативная реакция</div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {[...new Set([...Object.keys(PHARMA_DB).filter(id => PHARMA_CLASSES.includes((PHARMA_DB[id] as any)?.class)), ...Object.keys(SUPPORT_COVERAGE_MAP || {}).slice(0, 60)])].sort().slice(0, 60).map(id => {
                const ph = PHARMA_DB[id] as any;
                const name = ph?.name || id;
                return <button key={id} onClick={() => { setState(s => ({ ...s, journal: { ...s.journal, negative: [...s.journal.negative, { substanceId: id, symptom: 'reaction', comment: '' }] } })); setShowNegPicker(false); }} style={{
                  display: 'block', width: '100%', padding: '7px 10px', marginBottom: 2, borderRadius: 8, cursor: 'pointer', fontSize: 10, textAlign: 'left',
                  background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', color: 'rgba(255,255,255,0.8)',
                }}>{name} <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{id}</span></button>;
              })}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
};

export default AutoCalculator;
