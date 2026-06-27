import React, { useMemo, useState, useCallback } from 'react';
import type { CalculatorState, CalculatorResult, LabDelta, SystemRisk, ScheduleItem, PowerLevel, SynergyId, Sex } from '../../../engines/support-calculator.types';
import { calculateSupportTZ, hydrateState } from '../../../engines/support-calculator.engine';
import { SYNERGY_ID_LABELS, TITRATION_RULES } from '../../../engines/support-calculator.types';

interface AutoCalculatorProps { onApply: (result: { level: string; subs: string[]; result: CalculatorResult }) => void; }
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 12 };
const PILL: React.CSSProperties = { padding: '6px 14px', borderRadius: 22, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const INPUT: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, boxSizing: 'border-box' };
const SELECT: React.CSSProperties = { ...INPUT, appearance: 'none' as const };
const LABEL: React.CSSProperties = { fontSize: 9, color: 'var(--text-dim)', marginBottom: 2, display: 'block' };
const BADGE = (bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 8, fontWeight: 700, background: bg, color: '#000' });

const SEV = ['none','mild','moderate','severe'] as const;
const SEV_LABEL = (o: string) => o === 'none' ? 'Нет' : o === 'mild' ? 'Лёгкая' : o === 'moderate' ? 'Средняя' : 'Тяжёлая';

const DEFAULT_STATE: CalculatorState = {
  profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
  neuro: { dopamineScore: 1, serotoninScore: 1, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 1, headaches: false, weatherDependent: false, sleepQuality: 'good' },
  pharma: { phase: 'course', aas: [], hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false },
  goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
  hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
  urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
  cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null },
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
    <div style={{ display: 'flex', gap: 3 }}>{SEV.map(o =>
      <button key={o} onClick={() => onChange(o)} style={{
        ...PILL, flex: 1, fontSize: 9, background: value === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
        color: value === o ? '#000' : 'var(--text-dim)',
      }}>{SEV_LABEL(o)}</button>)}
    </div></div>;
}

function BoolToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
    <button onClick={() => onChange(!value)} style={{
      width: 18, height: 18, borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
      background: value ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{value ? '✓' : ''}</button>
    <span style={{ fontSize: 10, color: 'var(--text)' }}>{label}</span>
  </div>;
}

function Card({ icon, title, defaultOpen, children }: { icon: string; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen || false);
  return <div style={{ ...GLASS, marginBottom: 6 }}>
    <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
      <span>{icon}</span>
      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
    </div>
    {open && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>}
  </div>;
}

function LabSliceInput({ label, slice, onChange }: { label: string; slice: { date: string; panelSex: Record<string,string>; panelBiochem: Record<string,string>; panelHematology: Record<string,string>; panelThyroid: Record<string,string> } | null; onChange: (v: any) => void }) {
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

export const AutoCalculator: React.FC<AutoCalculatorProps> = ({ onApply }) => {
  const [state, setState] = useState<CalculatorState>(() => {
    const h = hydrateState();
    return { ...DEFAULT_STATE, ...h, profile: { ...DEFAULT_STATE.profile, ...(h.profile || {}) }, pharma: { ...DEFAULT_STATE.pharma, ...(h.pharma || {}) }, labs: { ...DEFAULT_STATE.labs, ...(h.labs || {}) } };
  });
  const [tab, setTab] = useState<'cards'|'labs'|'risk'|'schedule'>('cards');
  const [copied, setCopied] = useState(false);
  const [aasEditor, setAasEditor] = useState({ id: 'test_enan', doseMgWeek: 500, weeks: 12 });
  const [negSubId, setNegSubId] = useState('');

  const result = useMemo<CalculatorResult>(() => calculateSupportTZ(state), [state]);

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
    { id: 'labs', label: '🧪 Анализы' },
    { id: 'risk', label: `⚠ Риск ${result.overallRiskBefore}%` },
    { id: 'schedule', label: `💊 План (${result.schedule.length})` },
  ] as const;

  return (
    <div style={{ padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>🧮 Калькулятор поддержки</div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>по ТЗ — 22 блока · Synergy_ID · титрация</div>
      </div>

      <div style={{ ...GLASS, padding: '6px 14px', marginBottom: 6, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{state.profile.weight}кг</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{state.profile.age}л</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{state.profile.sex === 'male' ? 'М' : 'Ж'}</span>
        {result.negativeBlocks.length > 0 && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>🚫 {result.negativeBlocks.length} блок.</span>}
        {result.contraindicationAlerts.length > 0 && <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700 }}>⚠ {result.contraindicationAlerts.length} пред.</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {(['basic','mid','max','boost'] as PowerLevel[]).map(l =>
            <button key={l} onClick={() => update('powerLevel', l)} style={{
              ...PILL, fontSize: 9, padding: '3px 8px',
              background: state.powerLevel === l ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: state.powerLevel === l ? '#000' : 'var(--text-dim)',
            }}>{l === 'basic' ? 'Базовый' : l === 'mid' ? 'Средний' : l === 'max' ? 'Макс' : 'Буст'}</button>
          )}
        </div>
      </div>

      <div style={{ ...GLASS, padding: '8px 14px', marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>📊 Общий риск</span>
          <span style={{ fontWeight: 800, color: result.overallRiskBefore >= 60 ? '#ef4444' : result.overallRiskBefore >= 30 ? '#fbbf24' : '#22c55e' }}>
            {result.overallRiskBefore}% → {result.overallRiskAfter}%
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.min(result.overallRiskBefore, 100)}%`, background: result.overallRiskBefore >= 60 ? '#ef4444' : result.overallRiskBefore >= 30 ? '#fbbf24' : '#22c55e', borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(result.overallRiskAfter, 100)}%`, background: '#22c55e', borderRadius: 3, opacity: 0.5 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            ...PILL, fontSize: 10, padding: '4px 10px',
            background: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: tab === t.id ? '#000' : 'var(--text-dim)',
          }}>{t.label}</button>
        ))}
        <button onClick={handleCopy} style={{ ...PILL, fontSize: 10, padding: '4px 10px', marginLeft: 'auto', background: '#818cf8', color: '#fff' }}>
          {copied ? '✅' : '📋'}
        </button>
      </div>

      {/* ─── TAB: DATA CARDS ───────────────────────────────── */ }
      {tab === 'cards' && <div>

        <Card icon="👤" title="1. Профиль" defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>Вес (кг)</span><input type="number" value={state.profile.weight} onChange={e => uProf({ weight: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Возраст</span><input type="number" value={state.profile.age} onChange={e => uProf({ age: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Пол</span><select value={state.profile.sex} onChange={e => uProf({ sex: e.target.value as Sex })} style={SELECT}><option value="male">М</option><option value="female">Ж</option></select></div>
            <div><span style={LABEL}>Рост (см)</span><input type="number" value={state.profile.height || ''} onChange={e => uProf({ height: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Жир (%)</span><input type="number" value={state.profile.bodyfat || ''} onChange={e => uProf({ bodyfat: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Тренировок/нед</span><input type="number" value={state.profile.workoutsPerWeek} onChange={e => uProf({ workoutsPerWeek: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Длит. тренировки (мин)</span><input type="number" value={state.profile.avgWorkoutMinutes} onChange={e => uProf({ avgWorkoutMinutes: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Сон (ч)</span><input type="number" value={state.profile.sleepHours} onChange={e => uProf({ sleepHours: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Стресс (1-10)</span><input type="number" min={1} max={10} value={state.profile.stressLevel} onChange={e => uProf({ stressLevel: +e.target.value })} style={INPUT} /></div>
          </div>
          <BoolToggle label="Курение" value={state.profile.smoker} onChange={v => uProf({ smoker: v })} />
          <div style={{ display: 'flex', gap: 3 }}><span style={LABEL}>Алкоголь</span>
            {(['never','rare','sometimes','regular'] as const).map(o =>
              <button key={o} onClick={() => uProf({ alcohol: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', background: state.profile.alcohol === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.profile.alcohol === o ? '#000' : 'var(--text-dim)' }}>{o === 'never' ? 'Никогда' : o === 'rare' ? 'Редко' : o === 'sometimes' ? 'Иногда' : 'Регулярно'}</button>
            )}
          </div>
          <div><span style={LABEL}>Кофеин (мг/день)</span><input type="number" value={state.profile.caffeineMg} onChange={e => uProf({ caffeineMg: +e.target.value })} style={INPUT} /></div>
        </Card>

        <Card icon="🧠" title="2. Неврологический статус">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>Дофамин (1-5)</span><input type="number" min={1} max={5} value={state.neuro.dopamineScore} onChange={e => uNeuro({ dopamineScore: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Серотонин (1-5)</span><input type="number" min={1} max={5} value={state.neuro.serotoninScore} onChange={e => uNeuro({ serotoninScore: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Агрессия (1-5)</span><input type="number" min={1} max={5} value={state.neuro.aggressionScore} onChange={e => uNeuro({ aggressionScore: +e.target.value })} style={INPUT} /></div>
          </div>
          <div style={{ marginBottom: 4 }}><span style={LABEL}>ГАМК баланс</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['balance','overexcited','inhibited'] as const).map(o =>
              <button key={o} onClick={() => uNeuro({ gabaBalance: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.neuro.gabaBalance === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.neuro.gabaBalance === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'balance' ? 'Норма' : o === 'overexcited' ? 'Возбуждение' : 'Заторможен'}
              </button>
            )}</div>
          </div>
          <div style={{ marginBottom: 4 }}><span style={LABEL}>Качество сна</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['good','fair','poor'] as const).map(o =>
              <button key={o} onClick={() => uNeuro({ sleepQuality: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.neuro.sleepQuality === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.neuro.sleepQuality === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'good' ? 'Хорошее' : o === 'fair' ? 'Среднее' : 'Плохое'}
              </button>
            )}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="Проблемы с памятью" value={state.neuro.memoryIssues} onChange={v => uNeuro({ memoryIssues: v })} />
            <BoolToggle label="Проблемы с фокусом" value={state.neuro.focusIssues} onChange={v => uNeuro({ focusIssues: v })} />
            <BoolToggle label="Замедленное мышление" value={state.neuro.slowThinking} onChange={v => uNeuro({ slowThinking: v })} />
            <BoolToggle label="Координация" value={state.neuro.coordinationIssues} onChange={v => uNeuro({ coordinationIssues: v })} />
            <BoolToggle label="Головные боли" value={state.neuro.headaches} onChange={v => uNeuro({ headaches: v })} />
            <BoolToggle label="Метеозависимость" value={state.neuro.weatherDependent} onChange={v => uNeuro({ weatherDependent: v })} />
          </div>
        </Card>

        <Card icon="💉" title="3. Фарма стек / Курс">
          <div style={{ marginBottom: 4 }}><span style={LABEL}>Фаза</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['course','bridge','pct','base'] as const).map(o =>
              <button key={o} onClick={() => uPharm({ phase: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.pharma.phase === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.pharma.phase === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'course' ? 'Курс' : o === 'bridge' ? 'Бридж' : o === 'pct' ? 'ПКТ' : 'База'}
              </button>
            )}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={LABEL}>ААС препараты</span>
            {state.pharma.aas.length > 0 && <div style={{ marginBottom: 4 }}>
              {state.pharma.aas.map((a, i) =>
                <div key={i} style={{ ...GLASS, padding: '3px 8px', marginBottom: 2, display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                  <span style={{ color: 'var(--text)' }}>{a.id} — {a.doseMgWeek} мг/нед × {a.weeks} нед</span>
                  <button onClick={() => uPharm({ aas: state.pharma.aas.filter((_, j) => j !== i) })} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </div>
              )}
            </div>}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <input value={aasEditor.id} onChange={e => setAasEditor(p => ({ ...p, id: e.target.value }))} style={{ ...INPUT, flex: 1, fontSize: 9 }} placeholder="id" />
              <input type="number" value={aasEditor.doseMgWeek || ''} onChange={e => setAasEditor(p => ({ ...p, doseMgWeek: +e.target.value }))} style={{ ...INPUT, width: 60, fontSize: 9 }} placeholder="мг/нед" />
              <input type="number" value={aasEditor.weeks || ''} onChange={e => setAasEditor(p => ({ ...p, weeks: +e.target.value }))} style={{ ...INPUT, width: 50, fontSize: 9 }} placeholder="нед" />
              <button onClick={() => { if (aasEditor.doseMgWeek > 0 && aasEditor.weeks > 0) { uPharm({ aas: [...state.pharma.aas, { ...aasEditor }] }); } }} style={{ ...PILL, background: 'var(--accent)', color: '#000', fontSize: 9, padding: '4px 8px' }}>+</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="ГР" value={state.pharma.hasGH} onChange={v => uPharm({ hasGH: v })} />
            <BoolToggle label="ИГФ-1" value={state.pharma.hasIGF} onChange={v => uPharm({ hasIGF: v })} />
            <BoolToggle label="Инсулин" value={state.pharma.hasInsulin} onChange={v => uPharm({ hasInsulin: v })} />
            <BoolToggle label="ХГЧ" value={state.pharma.hasHCG} onChange={v => uPharm({ hasHCG: v })} />
            <BoolToggle label="АИ" value={state.pharma.hasAI} onChange={v => uPharm({ hasAI: v })} />
            <BoolToggle label="Каберголин" value={state.pharma.hasCaber} onChange={v => uPharm({ hasCaber: v })} />
            <BoolToggle label="СЕРМ" value={state.pharma.hasSERM} onChange={v => uPharm({ hasSERM: v })} />
            <BoolToggle label="SARMs" value={state.pharma.hasSARMs} onChange={v => uPharm({ hasSARMs: v })} />
          </div>
        </Card>

        <Card icon="🎯" title="4. Цели / Цикл">
          <div style={{ marginBottom: 4 }}><span style={LABEL}>Тренировочный цикл</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['mass','cut','maintenance','endurance'] as const).map(o =>
              <button key={o} onClick={() => uGoals({ trainingCycle: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.goals.trainingCycle === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.goals.trainingCycle === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'mass' ? 'Масса' : o === 'cut' ? 'Сушка' : o === 'maintenance' ? 'Поддержка' : 'Выносливость'}
              </button>
            )}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="Здоровье" value={state.goals.healthMaintenance} onChange={v => uGoals({ healthMaintenance: v })} />
            <BoolToggle label="Подготовка к соревн." value={state.goals.competitionPrep} onChange={v => uGoals({ competitionPrep: v })} />
            <BoolToggle label="Восстановление сна" value={state.goals.sleepRecovery} onChange={v => uGoals({ sleepRecovery: v })} />
            <BoolToggle label="Коррекция липидов" value={state.goals.lipidCorrection} onChange={v => uGoals({ lipidCorrection: v })} />
            <BoolToggle label="Разжижение крови" value={state.goals.bloodThinning} onChange={v => uGoals({ bloodThinning: v })} />
            <BoolToggle label="Детокс печени" value={state.goals.liverDetox} onChange={v => uGoals({ liverDetox: v })} />
            <BoolToggle label="Контроль АД" value={state.goals.bpControl} onChange={v => uGoals({ bpControl: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 4 }}>
            <div><span style={LABEL}>Длит. цикла (нед)</span><input type="number" value={state.goals.cycleWeeks} onChange={e => uGoals({ cycleWeeks: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Прошло циклов</span><input type="number" value={state.goals.previousCycles} onChange={e => uGoals({ previousCycles: +e.target.value })} style={INPUT} /></div>
          </div>
          <div style={{ marginTop: 2 }}><span style={LABEL}>Время с последнего</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {(['none','<3mo','3-6mo','>6mo','trt'] as const).map(o =>
                <button key={o} onClick={() => uGoals({ timeSinceLastCycle: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', background: state.goals.timeSinceLastCycle === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.goals.timeSinceLastCycle === o ? '#000' : 'var(--text-dim)' }}>
                  {o === 'none' ? 'Первый' : o === '<3mo' ? '<3 мес' : o === '3-6mo' ? '3-6 мес' : o === '>6mo' ? '>6 мес' : 'TRT'}
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card icon="🫁" title="5. Гепатобилиарная">
          <SevSelect label="АЛТ/АСТ" value={state.hepatobiliary.altAstElevation} onChange={v => uHep({ altAstElevation: v as any })} />
          <SevSelect label="ГГТ" value={state.hepatobiliary.ggtElevation} onChange={v => uHep({ ggtElevation: v as any })} />
          <SevSelect label="Билирубин" value={state.hepatobiliary.bilirubinElevation} onChange={v => uHep({ bilirubinElevation: v as any })} />
          <BoolToggle label="Жировой гепатоз" value={state.hepatobiliary.fattyLiver} onChange={v => uHep({ fattyLiver: v })} />
          <BoolToggle label="Холецистит" value={state.hepatobiliary.cholecystitis} onChange={v => uHep({ cholecystitis: v })} />
          <div><span style={LABEL}>Алкоголь</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['none','past','current'] as const).map(o =>
              <button key={o} onClick={() => uHep({ alcoholHistory: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.hepatobiliary.alcoholHistory === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.hepatobiliary.alcoholHistory === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'none' ? 'Нет' : o === 'past' ? 'В прошлом' : 'Сейчас'}
              </button>
            )}</div>
          </div>
        </Card>

        <Card icon="💧" title="6. Мочевыделительная">
          <SevSelect label="Креатинин" value={state.urinary.creatinineElevation} onChange={v => uUrin({ creatinineElevation: v as any })} />
          <SevSelect label="Мочевина" value={state.urinary.ureaElevation} onChange={v => uUrin({ ureaElevation: v as any })} />
          <BoolToggle label="Протеинурия" value={state.urinary.proteinuria} onChange={v => uUrin({ proteinuria: v })} />
          <BoolToggle label="Нефротоксичные препараты" value={state.urinary.nephrotoxicDrugs} onChange={v => uUrin({ nephrotoxicDrugs: v })} />
          <BoolToggle label="Гипертензия" value={state.urinary.hypertension} onChange={v => uUrin({ hypertension: v })} />
          <BoolToggle label="Диабет" value={state.urinary.diabetes} onChange={v => uUrin({ diabetes: v })} />
          <div><span style={LABEL}>Мочеиспускание</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['normal','frequent','nocturia','painful'] as const).map(o =>
              <button key={o} onClick={() => uUrin({ urinationPattern: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.urinary.urinationPattern === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.urinary.urinationPattern === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'normal' ? 'Норма' : o === 'frequent' ? 'Частое' : o === 'nocturia' ? 'Ночное' : 'Болезненное'}
              </button>
            )}</div>
          </div>
        </Card>

        <Card icon="❤️" title="7. Сердечно-сосудистая">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>АД стадия</span>
              <select value={state.cardio.bpStage} onChange={e => uCard({ bpStage: e.target.value })} style={SELECT}>
                <option value="normal">Норма</option><option value="prehypertension">Прегипертензия</option>
                <option value="hypertension1">Гипертензия 1</option><option value="hypertension2">Гипертензия 2</option>
              </select>
            </div>
            <div><span style={LABEL}>ЧСС</span><input type="number" value={state.cardio.heartRate} onChange={e => uCard({ heartRate: +e.target.value })} style={INPUT} /></div>
          </div>
          <SevSelect label="ЛПНП" value={state.cardio.ldlElevation} onChange={v => uCard({ ldlElevation: v as any })} />
          <SevSelect label="Гематокрит" value={state.cardio.hctElevation} onChange={v => uCard({ hctElevation: v as any })} />
          <BoolToggle label="Низкий ЛПВП" value={state.cardio.hdlLow} onChange={v => uCard({ hdlLow: v })} />
          <div><span style={LABEL}>Триглицериды</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['normal','elevated','high'] as const).map(o =>
              <button key={o} onClick={() => uCard({ triglycerides: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.cardio.triglycerides === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.cardio.triglycerides === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'normal' ? 'Норма' : o === 'elevated' ? 'Повышены' : 'Высокие'}
              </button>
            )}</div>
          </div>
          <BoolToggle label="ССЗ в анамнезе" value={state.cardio.previousCVD} onChange={v => uCard({ previousCVD: v })} />
          <BoolToggle label="ССЗ в семье" value={state.cardio.familyCVD} onChange={v => uCard({ familyCVD: v })} />
        </Card>

        <Card icon="🦴" title="8. ОДА / Суставы">
          <SevSelect label="Боль в суставах" value={state.oda.jointPain} onChange={v => uODA({ jointPain: v as any })} />
          <BoolToggle label="Проблемы со связками" value={state.oda.ligamentIssues} onChange={v => uODA({ ligamentIssues: v })} />
          <BoolToggle label="Боль в спине" value={state.oda.backPain} onChange={v => uODA({ backPain: v })} />
          <div><span style={LABEL}>Травмы (через запятую)</span>
            <input value={state.oda.injuries.join(', ')} onChange={e => uODA({ injuries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={INPUT} />
          </div>
        </Card>

        <Card icon="🥗" title="11. Питание / Метаболизм">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>Калории (ккал)</span><input type="number" value={state.nutrition.calories} onChange={e => uNutr({ calories: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Белок (г)</span><input type="number" value={state.nutrition.proteinG} onChange={e => uNutr({ proteinG: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Жиры (г)</span><input type="number" value={state.nutrition.fatG} onChange={e => uNutr({ fatG: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Углеводы (г)</span><input type="number" value={state.nutrition.carbsG} onChange={e => uNutr({ carbsG: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Вода (л)</span><input type="number" step={0.1} value={state.nutrition.waterL} onChange={e => uNutr({ waterL: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Клетчатка (г)</span><input type="number" value={state.nutrition.fiberG} onChange={e => uNutr({ fiberG: +e.target.value })} style={INPUT} /></div>
          </div>
          <BoolToggle label="Омега-3" value={state.nutrition.omega3} onChange={v => uNutr({ omega3: v })} />
          <div><span style={LABEL}>Соль</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['low','normal','high'] as const).map(o =>
              <button key={o} onClick={() => uNutr({ saltIntake: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.nutrition.saltIntake === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.nutrition.saltIntake === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'low' ? 'Мало' : o === 'normal' ? 'Норма' : 'Много'}
              </button>
            )}</div>
          </div>
        </Card>

        <Card icon="🩺" title="12. Медицинские противопоказания">
          <div><span style={LABEL}>Аллергии</span><input value={state.contraindications.allergies} onChange={e => uContr({ allergies: e.target.value })} style={INPUT} placeholder="укажите" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="ССЗ" value={state.contraindications.hasCVD} onChange={v => uContr({ hasCVD: v })} />
            <BoolToggle label="Тромбофилия" value={state.contraindications.hasThrombophilia} onChange={v => uContr({ hasThrombophilia: v })} />
            <BoolToggle label="Диабет" value={state.contraindications.hasDiabetes} onChange={v => uContr({ hasDiabetes: v })} />
            <BoolToggle label="Эпилепсия" value={state.contraindications.hasEpilepsy} onChange={v => uContr({ hasEpilepsy: v })} />
            <BoolToggle label="Психические расстройства" value={state.contraindications.hasMentalIllness} onChange={v => uContr({ hasMentalIllness: v })} />
            <BoolToggle label="Болезни печени" value={state.contraindications.hasLiverDisease} onChange={v => uContr({ hasLiverDisease: v })} />
            <BoolToggle label="Болезни почек" value={state.contraindications.hasKidneyDisease} onChange={v => uContr({ hasKidneyDisease: v })} />
            <BoolToggle label="ЖКТ заболевания" value={state.contraindications.hasGI} onChange={v => uContr({ hasGI: v })} />
            <BoolToggle label="Простата" value={state.contraindications.hasProstateIssues} onChange={v => uContr({ hasProstateIssues: v })} />
          </div>
        </Card>

        <Card icon="📓" title="13. Журнал негативного опыта">
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
            <input value={negSubId} onChange={e => setNegSubId(e.target.value)} style={{ ...INPUT, flex: 1, fontSize: 9 }} placeholder="id вещества" />
            <button onClick={() => { if (negSubId.trim()) { setState(s => ({ ...s, journal: { ...s.journal, negative: [...s.journal.negative, { substanceId: negSubId.trim(), symptom: 'reaction', comment: '' }] } })); setNegSubId(''); } }} style={{ ...PILL, background: 'var(--accent)', color: '#000', fontSize: 9, padding: '4px 8px' }}>+</button>
          </div>
          {state.journal.negative.length > 0 && <div>
            {state.journal.negative.map((n, i) =>
              <div key={i} style={{ ...GLASS, padding: '3px 8px', marginBottom: 2, display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                <span style={{ color: '#ef4444' }}>🚫 {n.substanceId}</span>
                <button onClick={() => setState(s => ({ ...s, journal: { ...s.journal, negative: s.journal.negative.filter((_, j) => j !== i) } }))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}
          </div>}
        </Card>

        <Card icon="📋" title="Эпикриз / Фарм. анамнез">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="Гинекомастия в прошлом" value={state.epicrisis.pastGyno} onChange={v => uEpic({ pastGyno: v })} />
            <BoolToggle label="Падение либидо" value={state.epicrisis.pastLibidoDrop} onChange={v => uEpic({ pastLibidoDrop: v })} />
            <BoolToggle label="Скачок гематокрита" value={state.epicrisis.pastHctSpike} onChange={v => uEpic({ pastHctSpike: v })} />
            <BoolToggle label="Проблемы с печенью" value={state.epicrisis.pastLiverIssues} onChange={v => uEpic({ pastLiverIssues: v })} />
            <BoolToggle label="Проблемы с почками" value={state.epicrisis.pastKidneyIssues} onChange={v => uEpic({ pastKidneyIssues: v })} />
          </div>
        </Card>

        <Card icon="☣️" title="Токсическая нагрузка / Детокс">
          <BoolToggle label="Вредное производство" value={state.toxicLoad.hazardousWork} onChange={v => uToxic({ hazardousWork: v })} />
          <BoolToggle label="Регулярные НПВС" value={state.toxicLoad.regularNSAIDs} onChange={v => uToxic({ regularNSAIDs: v })} />
          <BoolToggle label="Другие тяжёлые препараты" value={state.toxicLoad.otherHeavyDrugs} onChange={v => uToxic({ otherHeavyDrugs: v })} />
          <div><span style={LABEL}>Стул</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['regular','constipation'] as const).map(o =>
              <button key={o} onClick={() => uToxic({ bowelFrequency: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.toxicLoad.bowelFrequency === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.toxicLoad.bowelFrequency === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'regular' ? 'Регулярный' : 'Запоры'}
              </button>
            )}</div>
          </div>
        </Card>

        <Card icon="🦷" title="Стоматология / Минеральный обмен">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="Кровоточивость дёсен" value={state.dental.bleedingGums} onChange={v => uDent({ bleedingGums: v })} />
            <BoolToggle label="Шатаются зубы" value={state.dental.looseTeeth} onChange={v => uDent({ looseTeeth: v })} />
            <BoolToggle label="Бруксизм (скрежет)" value={state.dental.nightGrinding} onChange={v => uDent({ nightGrinding: v })} />
            <BoolToggle label="Переломы костей" value={state.dental.boneFractures} onChange={v => uDent({ boneFractures: v })} />
            <BoolToggle label="Судороги (крампи)" value={state.dental.cramps} onChange={v => uDent({ cramps: v })} />
          </div>
        </Card>

        <Card icon="🧬" title="Генетические полиморфизмы">
          <div style={{ marginBottom: 4 }}><span style={LABEL}>CYP19A1 (ароматаза)</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['high','normal','unknown'] as const).map(o =>
              <button key={o} onClick={() => uGen({ cyp19a1: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.genetics.cyp19a1 === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.genetics.cyp19a1 === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'high' ? 'Высокая' : o === 'normal' ? 'Норма' : 'Неизвестно'}
              </button>
            )}</div>
          </div>
          <div style={{ marginBottom: 4 }}><span style={LABEL}>SRD5A2 (5α-редуктаза)</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['hypersensitive','normal','unknown'] as const).map(o =>
              <button key={o} onClick={() => uGen({ srd5a2: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.genetics.srd5a2 === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.genetics.srd5a2 === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'hypersensitive' ? 'Гиперчувств.' : o === 'normal' ? 'Норма' : 'Неизвестно'}
              </button>
            )}</div>
          </div>
          <div style={{ marginBottom: 4 }}><span style={LABEL}>Чувствительность АР</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['high','normal','low','unknown'] as const).map(o =>
              <button key={o} onClick={() => uGen({ arSensitivity: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.genetics.arSensitivity === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.genetics.arSensitivity === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'high' ? 'Высокая' : o === 'normal' ? 'Норма' : o === 'low' ? 'Низкая' : 'Неизвестно'}
              </button>
            )}</div>
          </div>
          <div><span style={LABEL}>MTHFR</span>
            <div style={{ display: 'flex', gap: 3 }}>{(['c677t','normal','unknown'] as const).map(o =>
              <button key={o} onClick={() => uGen({ mthfr: o })} style={{ ...PILL, fontSize: 8, padding: '2px 6px', flex: 1, background: state.genetics.mthfr === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: state.genetics.mthfr === o ? '#000' : 'var(--text-dim)' }}>
                {o === 'c677t' ? 'C677T' : o === 'normal' ? 'Норма' : 'Неизвестно'}
              </button>
            )}</div>
          </div>
        </Card>

        <Card icon="🫀" title="ЖКТ / Микробиом">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <BoolToggle label="Вздутие" value={state.gi.bloating} onChange={v => uGI({ bloating: v })} />
            <BoolToggle label="Изжога" value={state.gi.heartburn} onChange={v => uGI({ heartburn: v })} />
            <BoolToggle label="Диарея" value={state.gi.diarrhea} onChange={v => uGI({ diarrhea: v })} />
            <BoolToggle label="Запоры" value={state.gi.constipation} onChange={v => uGI({ constipation: v })} />
            <BoolToggle label="СРК (диагноз)" value={state.gi.diagnosedIBS} onChange={v => uGI({ diagnosedIBS: v })} />
            <BoolToggle label="Ферментная поддержка" value={state.gi.enzymeSupport} onChange={v => uGI({ enzymeSupport: v })} />
            <BoolToggle label="Пробиотики" value={state.gi.probioticUse} onChange={v => uGI({ probioticUse: v })} />
          </div>
        </Card>

        <Card icon="🧘" title="Психологическая зависимость">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>Страх потери (1-5)</span><input type="number" min={1} max={5} value={state.psych.fearOfLoss} onChange={e => uPsych({ fearOfLoss: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Одержимость зеркалом (1-5)</span><input type="number" min={1} max={5} value={state.psych.mirrorObsession} onChange={e => uPsych({ mirrorObsession: +e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Апатия вне курса (1-5)</span><input type="number" min={1} max={5} value={state.psych.apathyOffCycle} onChange={e => uPsych({ apathyOffCycle: +e.target.value })} style={INPUT} /></div>
          </div>
        </Card>

        <Card icon="💉" title="Мониторинг зон инъекций">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <div><span style={LABEL}>Ягодицы</span><input value={state.injection.glutes} onChange={e => uInj({ glutes: e.target.value })} style={INPUT} placeholder="ok / уплотнение / боль" /></div>
            <div><span style={LABEL}>Квадрицепсы</span><input value={state.injection.quads} onChange={e => uInj({ quads: e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Дельты</span><input value={state.injection.delts} onChange={e => uInj({ delts: e.target.value })} style={INPUT} /></div>
            <div><span style={LABEL}>Локальные зоны</span><input value={state.injection.localAreas} onChange={e => uInj({ localAreas: e.target.value })} style={INPUT} /></div>
          </div>
        </Card>

        <Card icon="📊" title="Before/After — проекция снижения риска">
          {result.comparisonBeforeAfter.map(c => {
            const diff = c.before - c.after;
            return <div key={c.system} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, fontSize: 9 }}>
              <span style={{ width: 90, color: 'var(--text-dim)' }}>{c.system}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', height: '100%', width: `${c.before}%`, background: '#ef4444', borderRadius: 2 }} />
                <div style={{ position: 'absolute', height: '100%', width: `${c.after}%`, background: '#22c55e', borderRadius: 2, opacity: 0.6 }} />
              </div>
              <span style={{ fontWeight: 700, color: diff > 0 ? '#22c55e' : '#666', width: 40, textAlign: 'right' }}>{c.before}→{c.after}</span>
            </div>;
          })}
        </Card>

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
    </div>
  );
};

export default AutoCalculator;
