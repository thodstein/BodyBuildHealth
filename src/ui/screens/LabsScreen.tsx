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
import { LabsCatalog } from './LabsScreen_parts/LabsCatalog';
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
  baseline: '📋 Базовые',
  on_cycle: '💊 На курсе',
  bridge: '🌉 Мост',
  pct: '🔄 ПКТ',
  post_pct: '✅ После ПКТ',
  course_bridge_course: '🔁 К-М-К',
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
  cardio: '❤️ Сердце', hepatic: '🪱 Печень', renal: '🫨 Почки',
  neuro: '🧠 Нервная', endocrine: '🦋 Эндокр.', hematologic: '🩸 Кровь',
  reproductive: '🔬 Репродук.', musculoskeletal: '🦴 Кости', metabolic: '🍬 Метаболизм',
};

const LAB_SYSTEM_GROUPS: Record<string, string[]> = {
  'Печень': ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB','LDH','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT'],
  'Почки': ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR','K','NA','CA','P','MG'],
  'Эндокринная': ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1','TOTAL_T3','TOTAL_T4','TG_AB','TPO_AB','THYROGLOBULIN'],
  'Кроветворение': ['HGB','HCT','PLT','WBC','RBC','MCV','MCH','MCHC','RDW','IRON','TRANSFERRIN','TIBC','IRON_SAT','FERRITIN'],
  'Липиды': ['LDL','HDL','TG','APOB','APOA1','NON_HDL','LP_A'],
  'Воспаление': ['CRP','hsCRP','FIBRINOGEN','D_DIMER'],
  'Углеводный обмен': ['GLUCOSE','GLU','HBA1C','INSULIN','HOMA_IR'],
  'Витамины': ['VITD','VITAMIN_D','CALCIDIOL','B12','VITAMIN_B12','FOLATE'],
  'Репродуктивная': ['PSA','DHEA_S','AMH','INHIBIN_B','PROGESTERONE','DHT','FT','TESTOSTERONE','ESTRADIOL'],
  'Нервная': ['HOMOCYSTEINE','BDNF','SEROTONIN','DOPAMINE','GABA','VITAMIN_B12','FOLATE'],
};

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  // Read phase from profile on mount, fall back to 'baseline'
  const profilePhase = linked.profile?.settings?.phase || '';
  const initialLabsPhase = PROFILE_PHASE_TO_LABS_PHASE[profilePhase] || 'baseline';
  const [tab, setTab] = useState<'results' | 'schedule' | 'catalog' | 'investigations'>('results');
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
        if (!groups['Другие']) groups['Другие'] = [];
        groups['Другие'].push(code);
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
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['Ошибка: ' + (e?.message || String(e))] });
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

  return (
    <div className="screen labs">
      <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>🧪 Анализы</h2>

      {/* Phase selector */}
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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['results', 'schedule', 'investigations', 'catalog'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
            background: tab === t ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            color: tab === t ? '#00e68a' : 'var(--text-dim)',
            border: tab === t ? '1px solid #00e68a' : '1px solid var(--border)',
          }}>
            {t === 'results' ? '📊 Результаты' : t === 'schedule' ? '📅 График' : t === 'investigations' ? '🔬 Исследования' : '📖 Каталог'}
          </button>
        ))}
      </div>

      {/* ≡≡≡ RESULTS TAB ≡≡≡ */}
      {tab === 'results' && (
        <div>
          {/* Required labs progress */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 13 }}>{PHASE_LABELS[selectedPhase]}</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444' }}>
                {submittedCount}/{requiredLabs.length}
              </span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
            {Object.entries(labsBySystem).map(([system, codes]) => (
              <div key={system} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>{system}</div>
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

            {/* Import buttons */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
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
              <button onClick={() => setShowLabInput(true)} style={{
                flex: 1, padding: 7, borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
              }}>✏️ Вручную</button>
            </div>
          </div>

          {/* Entered results */}
          <LabsResults labs={labs} />

          {/* Lab Analysis Composite Scores */}
          {labAnalysisResult && (
            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧪 Композитные индексы</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '2px 6px', fontSize: 10, alignItems: 'center' }}>
                {labAnalysisResult.homaIR !== null && <><span style={{ color: 'var(--text-dim)' }}>HOMA-IR</span><span><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, labAnalysisResult.homaIR * 40)}%`, height: '100%', background: labAnalysisResult.homaIR > 2.5 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></span><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.homaIR > 2.5 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.homaIR.toFixed(2)}</span></>}
                <span style={{ color: 'var(--text-dim)' }}>Печень</span><div><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${labAnalysisResult.liverStress}%`, height: '100%', background: labAnalysisResult.liverStress > 60 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></div><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.liverStress > 60 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.liverStress}%</span>
                <span style={{ color: 'var(--text-dim)' }}>Кардио</span><div><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${labAnalysisResult.cardioRisk}%`, height: '100%', background: labAnalysisResult.cardioRisk > 60 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></div><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.cardioRisk > 60 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.cardioRisk}%</span>
                <span style={{ color: 'var(--text-dim)' }}>Воспаление</span><div><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, labAnalysisResult.inflammation * 15)}%`, height: '100%', background: labAnalysisResult.inflammation > 6 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></div><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.inflammation > 6 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.inflammation.toFixed(1)}</span>
                <span style={{ color: 'var(--text-dim)' }}>Почки</span><div><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${labAnalysisResult.kidneyStress}%`, height: '100%', background: labAnalysisResult.kidneyStress > 60 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></div><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.kidneyStress > 60 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.kidneyStress}%</span>
                <span style={{ color: 'var(--text-dim)' }}>Гормоны</span><div><div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}><div style={{ width: `${labAnalysisResult.hormoneScore}%`, height: '100%', background: labAnalysisResult.hormoneScore > 60 ? '#ef4444' : '#22c55e', borderRadius: 3 }} /></div></div><span style={{ fontWeight: 600, textAlign: 'right', color: labAnalysisResult.hormoneScore > 60 ? '#ef4444' : '#22c55e' }}>{labAnalysisResult.hormoneScore}%</span>
              </div>
            </div>
          )}

          {/* Lab-Pharma Correlation */}
          {labPharmaAlerts.length > 0 && (
            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>💊 Связь анализы↔препараты ({labPharmaAlerts.length})</h4>
              {labPharmaAlerts.map((a,i) => <div key={i} style={{ fontSize:9, padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex',justifyContent:'space-between' }}>
                <span>{a.marker} {a.actualStatus === 'high' ? '↑' : a.actualStatus === 'low' ? '↓' : ''} {a.value}{a.unit}</span>
                <span style={{ color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#22c55e' }}>{a.drugCause?.join(', ')} — {a.recommendation}</span>
              </div>)}
            </div>
          )}

          {/* Lab Risks + Deviations */}
          {labRisks && (
            <div className="card" style={{ marginTop: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>🔬 Риски из анализов</h3>
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

              {/* Per-marker deviations */}
              {deviationCount > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: 'var(--text-dim)' }}>Маркеры с отклонениями:</div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    {labRisks.markerDeviations.slice(0, 10).map(m => {
                      const isHigh = m.deviation > 0;
                      const color = isHigh ? '#ef4444' : '#f97316';
                      return (
                        <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', background: 'var(--bg-secondary)', borderRadius: 4 }}>
                          <span style={{ fontSize: 8, color: 'var(--accent)', minWidth: 50 }}>{m.system}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, flex: 1 }}>{m.name}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>норма {m.lln}–{m.uln}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color }}>{m.value} ({isHigh ? '↑' : '↓'}{Math.abs(m.deviation)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Systems breakdown */}
              {Object.entries(labRisks.systemBreakdown).filter(([_, v]) => v.net > 0).length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: 'var(--text-dim)' }}>По системам:</div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    {Object.entries(labRisks.systemBreakdown)
                      .filter(([_, v]) => v.net > 0)
                      .sort(([_, a], [__, b]) => b.net - a.net)
                      .slice(0, 8)
                      .map(([sys, val]) => (
                        <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', background: 'var(--bg-secondary)', borderRadius: 4 }}>
                          <span style={{ fontSize: 9, minWidth: 60, color: 'var(--text-dim)' }}>{sysLabels[sys] || sys}</span>
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                            <div style={{ width: Math.min(100, val.net) + '%', height: '100%', background: getRiskColor(val.net), borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: getRiskColor(val.net), minWidth: 22, textAlign: 'right' }}>{Math.round(val.net)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {deviationCount === 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>Все показатели в норме</div>
              )}
            </div>
          )}

          {/* Indices */}
          {indexEntries.length > 0 && (
            <div className="card" style={{ marginTop: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>📊 Индексы</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {indexEntries.map(d => (
                  <div key={d.key} style={{ background: 'var(--bg-secondary)', padding: 5, borderRadius: 5, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10 }}>{d.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 11, color: getRiskColor(d.value) }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
      {tab === 'catalog' && (
        <div>
          <LabsCatalog />
        </div>
      )}

      {/* Penalty section — shown on all tabs */}
      <div className="card" style={{ marginTop: 8, background: anyNoLabs ? 'rgba(239,68,68,0.08)' : 'var(--glass-bg)', borderColor: anyNoLabs ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)' }}>
        <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>⚠️ Штраф за отсутствие анализов</h3>
        <div style={{ fontSize: 10, marginBottom: 6 }}>
          {anyNoLabs ? (
            <div>
              <div>Множитель: <strong style={{ color: '#ef4444' }}>×{penalty.totalMultiplier.toFixed(2)}</strong></div>
              <div>Лабы: {Math.round(penalty.labPenalty * 100)}% • Диагностика: {Math.round(penalty.diagnosticPenalty * 100)}%</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Штраф не применён.</div>
          )}
        </div>
        <button onClick={toggleGlobalNoLabs} style={{
          width: '100%', padding: 8, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11,
          background: globalNoLabs ? 'var(--accent)' : '#ef4444', color: globalNoLabs ? '#000' : '#fff',
          border: 'none', marginBottom: 4,
        }}>
          {globalNoLabs ? '✅ Отменить глобальный штраф' : '🚫 БЕЗ ВСЕХ АНАЛИЗОВ (Штраф)'}
        </button>
        {!globalNoLabs && (
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Или по системе:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {RISK_SYSTEMS.map(sys => {
                const isActive = noLabsSystems.includes(sys);
                return (
                  <button key={sys} onClick={() => toggleSystemNoLabs(sys)} style={{
                    padding: '2px 6px', borderRadius: 8, fontSize: 8, cursor: 'pointer',
                    background: isActive ? 'rgba(239,68,68,0.2)' : 'var(--bg-secondary)',
                    border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    color: isActive ? '#ef4444' : 'var(--text-dim)', fontWeight: isActive ? 700 : 400,
                  }}>
                    {isActive ? '✕ ' : ''}{sysLabels[sys] || sys}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
                        placeholder="Или вставьте текст результатов (скопируйте из PDF/сайта)..."
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
                          setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['Ошибка: ' + (e?.message || String(e))] });
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowLabInput(false)}>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
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