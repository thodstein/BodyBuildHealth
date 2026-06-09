import React, { useState, useMemo, useCallback, useRef } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { db } from '../../core/db';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsCatalog } from './LabsScreen_parts/LabsCatalog';
import { LabsInvestigations } from './LabsScreen_parts/LabsInvestigations';
import { processUploadedFile, saveParsedLabs, type ParsedLabValue, type OCRResult } from '../../core/ocr-engine';
import { SYSTEM_MECHANISMS } from '../../core/system-mechanisms';
import { SYSTEM_ORGANS } from '../../core/risk-info';

// Global penalty state shared with RiskScreen via localStorage
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
  baseline: 'рџ“‹ Р‘Р°Р·РѕРІС‹Рµ',
  on_cycle: 'рџ’Љ РќР° РєСѓСЂСЃРµ',
  bridge: 'рџЊ‰ РњРѕСЃС‚',
  pct: 'рџ”„ РџРљРў',
  post_pct: 'вњ… РџРѕСЃР»Рµ РџРљРў',
  course_bridge_course: 'рџ”Ѓ Рљ-Рњ-Рљ',
};

const PHASE_ICONS: Record<string, string> = {
  baseline: 'рџ“‹', on_cycle: 'рџ’Љ', bridge: 'рџЊ‰', pct: 'рџ”„', post_pct: 'вњ…', course_bridge_course: 'рџ”Ѓ',
};

const SYSTEM_LABELS: Record<string, string> = {
  'РџРµС‡РµРЅСЊ': 'рџ«Ѓ', 'РџРѕС‡РєРё': 'рџ«', 'Р­РЅРґРѕРєСЂРёРЅРЅР°СЏ': 'рџ¦‹', 'РљСЂРѕРІРµС‚РІРѕСЂРµРЅРёРµ': 'рџ©ё',
  'Р›РёРїРёРґС‹': 'рџ«Ђ', 'Р’РѕСЃРїР°Р»РµРЅРёРµ': 'рџ”Ґ', 'Р’РёС‚Р°РјРёРЅС‹': 'вЂпёЏ', 'Р РµРїСЂРѕРґСѓРєС‚РёРІРЅР°СЏ': 'рџ”¬',
  'РЈРіР»РµРІРѕРґРЅС‹Р№ РѕР±РјРµРЅ': 'рџЌ¬', 'РЎРѕСЃСѓРґС‹': 'рџ©ё', 'Р–РµР»РµР·Рѕ': 'вљ™пёЏ', 'Р”СЂСѓРіРёРµ': 'рџ“‹',
};

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'results' | 'schedule' | 'catalog' | 'investigations'>('results');
  const [globalNoLabs, setGlobalNoLabs] = useState(getGlobalNoLabs());
  const [noLabsSystems, setNoLabsSystemsState] = useState<string[]>(getNoLabsSystems());
  const [selectedPhase, setSelectedPhase] = useState('baseline');
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

  // Required labs for selected phase
  const requiredLabs = useMemo(() => {
    return (REQUIRED_LABS_PER_PHASE as Record<string, string[]>)[selectedPhase] || [];
  }, [selectedPhase]);

  // Group required labs by system
  const labsBySystem = useMemo(() => {
    const systemMap: Record<string, string[]> = {
      'РџРµС‡РµРЅСЊ': ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB'],
      'РџРѕС‡РєРё': ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA'],
      'Р­РЅРґРѕРєСЂРёРЅРЅР°СЏ': ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1'],
      'РљСЂРѕРІРµС‚РІРѕСЂРµРЅРёРµ': ['HGB','HCT','PLT','WBC','RBC','MCV'],
      'Р›РёРїРёРґС‹': ['LDL','HDL','TG','GLU','HBA1C'],
      'Р’РѕСЃРїР°Р»РµРЅРёРµ': ['CRP','FERRITIN','HOMOCYSTEINE'],
      'Р’РёС‚Р°РјРёРЅС‹': ['VITD','CALCIDIOL','B12'],
      'Р РµРїСЂРѕРґСѓРєС‚РёРІРЅР°СЏ': ['PSA','DHEA_S','AMH','INHB','PROGESTERONE','DHT','FT'],
    };
    const groups: Record<string, string[]> = {};
    for (const code of requiredLabs) {
      let found = false;
      for (const [sys, codes] of Object.entries(systemMap)) {
        if (codes.includes(code.toUpperCase())) {
          if (!groups[sys]) groups[sys] = [];
          groups[sys].push(code);
          found = true;
          break;
        }
      }
      if (!found) {
        if (!groups['Р”СЂСѓРіРёРµ']) groups['Р”СЂСѓРіРёРµ'] = [];
        groups['Р”СЂСѓРіРёРµ'].push(code);
      }
    }
    return groups;
  }, [requiredLabs]);

  // Submitted labs per code
  const submittedCodes = useMemo(() => {
    const set = new Set(labs.map(l => l.code.toUpperCase()));
    return set;
  }, [labs]);

  // Calculate missing
  const missingLabs = useMemo(() => {
    return requiredLabs.filter(code => !submittedCodes.has(code.toUpperCase()));
  }, [requiredLabs, submittedCodes]);

  const submittedCount = requiredLabs.length - missingLabs.length;
  const completionPct = requiredLabs.length > 0 ? Math.round(submittedCount / requiredLabs.length * 100) : 0;

  // Penalty
  const penalty = useMemo(() => {
    const phase = linked.profile?.settings?.phase || selectedPhase;
    return calculatePenaltyCoefficients(phase, labs, [], 1, linked.course, globalNoLabs);
  }, [linked.profile, selectedPhase, labs, linked.course, globalNoLabs]);

  // Lab risks
  const labRisks = useMemo<RiskResult | null>(() => {
    if (!hasLabs) return null;
    const labData = labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    return calculateRiskFromAnalyses({ overallRaw: 0, overallNet: 0, systemBreakdown: {} }, labData);
  }, [hasLabs, labs]);

  // Lab indices
  const labIndexDetails = useMemo(() => {
    if (!hasLabs) return {} as Record<string, LabIndexDetail>;
    return computeLabIndexDetails(labs);
  }, [hasLabs, labs]);

  const indexEntries = useMemo(() => {
    return Object.entries(labIndexDetails).map(([key, detail]) => ({
      key, label: detail.label, value: Math.round(detail.value * 100),
      interpretation: detail.interpretation,
    }));
  }, [labIndexDetails]);

  // Toggle global no-labs
  const toggleGlobalNoLabs = useCallback(() => {
    const next = !globalNoLabs;
    setGlobalNoLabs(next);
    setGlobalNoLabs(next);
    if (next) setNoLabsSystemsState([]); // clear per-system when global
    notifyDataChange();
    setTick(t => t + 1);
  }, [globalNoLabs]);

  // Toggle per-system no-labs
  const toggleSystemNoLabs = useCallback((sys: string) => {
    let next = [...noLabsSystems];
    if (next.includes(sys)) {
      next = next.filter(s => s !== sys);
    } else {
      next.push(sys);
    }
    setNoLabsSystems(next);
    setNoLabsSystemsState(next);
    // If all systems selected, switch to global
    if (next.length >= RISK_SYSTEMS.length) {
      setGlobalNoLabs(true);
      setGlobalNoLabs(true);
      next = [];
      setNoLabsSystems(next);
      setNoLabsSystemsState(next);
    }
    notifyDataChange();
    setTick(t => t + 1);
  }, [noLabsSystems]);

  // Add a lab entry
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
  // Handle file upload for OCR
  const handleFileUpload = useCallback(async (file: File) => {
    setOcrLoading(true);
    setOcrResult(null);
    setSelectedLabs(new Set());
    try {
      const result = await processUploadedFile(file);
      setOcrResult(result);
      if (result.labs.length > 0) {
        setSelectedLabs(new Set(result.labs.map(l => l.code)));
      }
    } catch (e: any) {
      setOcrResult({ text: '', labs: [], meals: [], source: 'text', confidence: 0, warnings: ['РћС€РёР±РєР°: ' + (e?.message || String(e))] });
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

  const renderContent = () => {
    switch (tab) {
      case 'results': return <LabsResults labs={labs} />;
      case 'schedule': return <LabsSchedule />;
      case 'catalog': return <LabsCatalog />;
      case 'investigations': return <LabsInvestigations />;
      default: return <LabsResults labs={labs} />;
    }
  };

  const anyNoLabs = globalNoLabs || noLabsSystems.length > 0;

  const sysLabels: Record<string, string> = {
    cardio: 'вќ¤пёЏ РЎРµСЂРґС†Рµ', hepatic: 'рџ«Ѓ РџРµС‡РµРЅСЊ', renal: 'рџ« РџРѕС‡РєРё',
    neuro: 'рџ§  РќРµСЂРІРЅР°СЏ', endocrine: 'рџ¦‹ Р­РЅРґРѕРєСЂ.', hematologic: 'рџ©ё РљСЂРѕРІСЊ',
    reproductive: 'рџ”¬ Р РµРїСЂРѕРґ.', musculoskeletal: 'рџ¦ґ РљРѕСЃС‚Рё',
  };

  return (
    <div className="screen labs">
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>рџ§Є РђРЅР°Р»РёР·С‹</h2>

      {/* Phase selector - compact pills */}
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 8, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {Object.entries(PHASE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setSelectedPhase(key)} style={{
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
      <div className="tab-bar" style={{ gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {(['results', 'schedule', 'investigations', 'catalog'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'results' ? 'рџ“Љ Р РµР·-С‚С‹' : t === 'schedule' ? 'рџ“… Р“СЂР°С„РёРє' : t === 'investigations' ? 'рџ”¬ РСЃСЃР»РµРґ.' : 'рџ“– РљР°С‚Р°Р»РѕРі'}
          </button>
        ))}
      </div>

      
{/* IMPORT BUTTONS */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button onClick={() => { setShowImport(true); setTimeout(() => fileInputRef.current?.click(), 100); }} style={{
          flex: 1, padding: 9, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>рџ“„ PDF</button>
        <button onClick={() => { setShowImport(true); setTimeout(() => { if (cameraInputRef.current) cameraInputRef.current.click(); }, 100); }} style={{
          flex: 1, padding: 9, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>рџ“ё Р¤РѕС‚Рѕ</button>
        <button onClick={() => setShowLabInput(true)} style={{
          flex: 1, padding: 9, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>вњЏпёЏ Р СѓС‡РЅРѕР№</button>
      </div>
      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />

      {/* Required labs progress for phase */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>{PHASE_ICONS[selectedPhase]} {PHASE_LABELS[selectedPhase]}</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444' }}>
            {submittedCount}/{requiredLabs.length}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>

        {/* Labs by system */}
        <div style={{ display: 'grid', gap: 5 }}>
          {Object.entries(labsBySystem).map(([system, codes]) => (
            <div key={system}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>{system}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {codes.map(code => {
                  const info = UCUM_MAP[code.toUpperCase()];
                  const isSubmitted = submittedCodes.has(code.toUpperCase());
                  const latest = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
                  const isHigh = latest && info ? latest.value > info.uln : false;
                  const isLow = latest && info ? latest.value < info.lln : false;
                  return (
                    <button key={code} onClick={() => { setInputCode(code); setInputUnit(info?.prefUnit || ''); setShowLabInput(true); }} style={{
                      padding: '2px 7px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                      background: isSubmitted ? (isHigh ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.1)') : 'var(--bg-secondary)',
                      border: `1px solid ${isSubmitted ? (isHigh ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(249,115,22,0.3)' : 'rgba(0,230,138,0.2)') : 'var(--border)'}`,
                      color: isSubmitted ? (isHigh ? '#ef4444' : isLow ? '#f97316' : 'var(--accent)') : 'var(--text-dim)',
                      fontWeight: isSubmitted ? 600 : 400,
                    }}>
                      {isSubmitted ? (isHigh ? 'в†‘' : isLow ? 'в†“' : 'вњ“') : 'в—‹'} {info?.name || code}
                      {latest && <span style={{ marginLeft: 2, fontWeight: 700 }}>{latest.value}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Missing labs */}
        {missingLabs.length > 0 && missingLabs.length < requiredLabs.length && (
          <div style={{ marginTop: 6, padding: '5px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 5, fontSize: 10, color: 'var(--text-dim)' }}>
            РќРµ СЃРґР°РЅРѕ: {missingLabs.slice(0, 8).join(', ')}{missingLabs.length > 8 ? ` +${missingLabs.length - 8}` : ''}
          </div>
        )}
      </div>

      {/* Tab content */}
      {renderContent()}

      {/* Lab Risks + Indices */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 14 }}>рџ”¬ Р РёСЃРєРё РёР· Р°РЅР°Р»РёР·РѕРІ</h3>
        {labRisks && labRisks.overallNet > 0 ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: 7, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РћР±С‰РёР№ СЂРёСЃРє</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: getRiskColor(labRisks.overallNet) }}>{Math.round(labRisks.overallNet)}%</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: 7, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РћС‚РєР»РѕРЅРµРЅРёСЏ</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {labRisks.systemBreakdown ? Object.keys(labRisks.systemBreakdown).filter(k => labRisks.systemBreakdown[k].net > 0).length : 0}
                </div>
              </div>
            </div>
            {/* System breakdown with mechanism markers */}
            {labRisks.systemBreakdown && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: 'var(--text-dim)' }}>РџРѕ СЃРёСЃС‚РµРјР°Рј:</div>
                <div style={{ display: 'grid', gap: 3 }}>
                  {Object.entries(labRisks.systemBreakdown)
                    .filter(([_, v]) => (v as any).net > 0)
                    .sort(([_, a], [__, b]) => (b as any).net - (a as any).net)
                    .slice(0, 8)
                    .map(([sys, val]) => {
                      const bd = val as { raw: number; net: number };
                      const mechCount = (SYSTEM_MECHANISMS[sys] || []).length;
                      const markers = (SYSTEM_MECHANISMS[sys] || []).flatMap(m => m.markers || []).slice(0, 3);
                      return (
                        <div key={sys} style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, minWidth: 70, color: 'var(--text-dim)' }}>{sysLabels[sys] || sys}</span>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                              <div style={{ width: Math.min(100, bd.net) + '%', height: '100%', background: getRiskColor(bd.net), borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: getRiskColor(bd.net), minWidth: 24, textAlign: 'right' }}>{Math.round(bd.net)}%</span>
                            {mechCount > 0 && <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{mechCount}Рј</span>}
                          </div>
                          {markers.length > 0 && (
                            <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>
                              рџ“Љ {markers.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Р’РІРµРґРёС‚Рµ РґР°РЅРЅС‹Рµ Р°РЅР°Р»РёР·РѕРІ РґР»СЏ РѕС†РµРЅРєРё СЂРёСЃРєРѕРІ</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 14 }}>рџ“Љ РРЅРґРµРєСЃС‹</h3>
        {indexEntries.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {indexEntries.map(d => (
              <div key={d.key} style={{ background: 'var(--bg-secondary)', padding: 5, borderRadius: 5, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10 }}>{d.label}</span>
                <span style={{ fontWeight: 700, fontSize: 11, color: getRiskColor(d.value) }}>{d.value}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>РќРµС‚ РґР°РЅРЅС‹С…</div>
        )}
      </div>

      {/* PENALTY SECTION */}
      <div className="card" style={{ marginTop: 8, background: anyNoLabs ? 'rgba(239,68,68,0.08)' : 'var(--glass-bg)', borderColor: anyNoLabs ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)' }}>
        <h3 style={{ fontSize: 14 }}>вљ пёЏ РЁС‚СЂР°С„ Р·Р° РѕС‚СЃСѓС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ</h3>
        <div style={{ fontSize: 10, marginBottom: 6 }}>
          {anyNoLabs ? (
            <div>
              <div>РњРЅРѕР¶РёС‚РµР»СЊ: <strong style={{ color: '#ef4444' }}>Г—{penalty.totalMultiplier.toFixed(2)}</strong></div>
              <div>Р›Р°Р±С‹: {Math.round(penalty.labPenalty * 100)}% вЂў Р”РёР°РіРЅРѕСЃС‚РёРєР°: {Math.round(penalty.diagnosticPenalty * 100)}%</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>РЁС‚СЂР°С„ РЅРµ РїСЂРёРјРµРЅС‘РЅ. Р’СЃРµ СЂРёСЃРєРё СЂР°СЃСЃС‡РёС‚Р°РЅС‹ Р±РµР· РїРѕРЅРёР¶Р°СЋС‰РµРіРѕ РєРѕСЌС„С„РёС†РёРµРЅС‚Р°.</div>
          )}
        </div>

        {/* Global no-labs button */}
        <button onClick={toggleGlobalNoLabs} style={{
          width: '100%', padding: 9, borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 12,
          background: globalNoLabs ? 'var(--accent)' : '#ef4444', color: globalNoLabs ? '#000' : '#fff',
          border: 'none', marginBottom: 5,
        }}>
          {globalNoLabs ? 'вњ… Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ С€С‚СЂР°С„ РїСЂРёРјРµРЅС‘РЅ вЂ” РѕС‚РјРµРЅРёС‚СЊ' : 'рџљ« Р‘Р•Р— Р’РЎР•РҐ РђРќРђР›РР—РћР’ (РЁС‚СЂР°С„)'}
        </button>

        {/* Per-system penalty buttons */}
        {!globalNoLabs && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>РР»Рё С€С‚СЂР°С„ РїРѕ РѕС‚РґРµР»СЊРЅРѕР№ СЃРёСЃС‚РµРјРµ:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {RISK_SYSTEMS.map(sys => {
                const isActive = noLabsSystems.includes(sys);
                return (
                  <button key={sys} onClick={() => toggleSystemNoLabs(sys)} style={{
                    padding: '2px 7px', borderRadius: 10, fontSize: 9, cursor: 'pointer',
                    background: isActive ? 'rgba(239,68,68,0.2)' : 'var(--bg-secondary)',
                    border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    color: isActive ? '#ef4444' : 'var(--text-dim)', fontWeight: isActive ? 700 : 400,
                  }}>
                    {isActive ? 'вњ• ' : ''}{sysLabels[sys] || sys}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      
      {/* OCR Import Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={() => { setShowImport(false); setOcrResult(null); }}>
          <div style={{ position: 'fixed', top: '8%', left: '4%', right: '4%', zIndex: 201, background: 'var(--bg)', borderRadius: 20, maxHeight: '84vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>рџ“„ РРјРїРѕСЂС‚ Р°РЅР°Р»РёР·РѕРІ</span>
              <button onClick={() => { setShowImport(false); setOcrResult(null); }} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>вњ•</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {ocrLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Р Р°СЃРїРѕР·РЅР°СЋ РґРѕРєСѓРјРµРЅС‚...</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>OCR РѕР±СЂР°Р±РѕС‚РєР° (10-30 СЃРµРє)</div>
                </div>
              )}
              {!ocrLoading && !ocrResult && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Р—Р°РіСЂСѓР·РёС‚Рµ PDF РёР»Рё С„РѕС‚Рѕ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ Р°РЅР°Р»РёР·РѕРІ РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ.</p>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding: 16, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 28 }}>рџ“„</span><span>Р’С‹Р±СЂР°С‚СЊ PDF РёР»Рё С„РѕС‚Рѕ</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>PDF, PNG, JPG, WEBP</span>
                    </button>
                    <button onClick={() => { if (cameraInputRef.current) cameraInputRef.current.click(); }} style={{ padding: 16, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 28 }}>рџ“ё</span><span>РЎС„РѕС‚РѕРіСЂР°С„РёСЂРѕРІР°С‚СЊ</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>РљР°РјРµСЂР° СѓСЃС‚СЂРѕР№СЃС‚РІР°</span>
                    </button>
                  </div>
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(0,230,138,0.08)', borderRadius: 8, fontSize: 10, color: 'var(--text-dim)' }}>
                    рџ’Ў <strong>РЎРѕРІРµС‚:</strong> PDF РѕС‚ Р»Р°Р±РѕСЂР°С‚РѕСЂРёР№ (Р“РµРјРѕС‚РµСЃС‚, РРЅРІРёС‚СЂРѕ, РҐРµР»РёРєСЃ, KDL) СЂР°СЃРїРѕР·РЅР°СЋС‚СЃСЏ Р»СѓС‡С€Рµ РІСЃРµРіРѕ. Р§С‘С‚РєРёРµ С„РѕС‚Рѕ Р±РµР· Р±Р»РёРєРѕРІ.
                  </div>
                </div>
              )}
              {ocrResult && !ocrLoading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{ocrResult.labs.length > 0 ? 'вњ…' : 'вљ пёЏ'}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{ocrResult.labs.length > 0 ? `РќР°Р№РґРµРЅРѕ: ${ocrResult.labs.length} РїРѕРєР°Р·Р°С‚РµР»РµР№` : 'РџРѕРєР°Р·Р°С‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹'}</span>
                    </div>
                    <span style={{ fontSize: 10, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-dim)' }}>
                      {ocrResult.source === 'pdf' ? 'PDF' : ocrResult.source === 'image' ? 'Р¤РѕС‚Рѕ' : 'РўРµРєСЃС‚'} вЂў {Math.round(ocrResult.confidence * 100)}%
                    </span>
                  </div>
                  {ocrResult.warnings.length > 0 && (
                    <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      {ocrResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: '#eab308' }}>вљ пёЏ {w}</div>)}
                    </div>
                  )}
                  {ocrResult.labs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Р’С‹Р±РµСЂРёС‚Рµ РїРѕРєР°Р·Р°С‚РµР»Рё РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РІ С„Р°Р·Сѓ В«{PHASE_LABELS[selectedPhase]}В»:</div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        {ocrResult.labs.map(lab => {
                          const isSelected = selectedLabs.has(lab.code);
                          const ucumInfo = UCUM_MAP[lab.code.toUpperCase()];
                          return (
                            <button key={lab.code} onClick={() => toggleLabSelection(lab.code)} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                              background: isSelected ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              transition: 'all 0.15s',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>{isSelected ? 'вњ“ ' : 'в—‹ '}{lab.name || lab.code}</div>
                                {ucumInfo && <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РќРѕСЂРјР°: {ucumInfo.lln}вЂ“{ucumInfo.uln} {ucumInfo.prefUnit}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: lab.isAbnormal ? '#ef4444' : 'var(--accent)' }}>{lab.value}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 3 }}>{lab.unit}</span>
                                {lab.isAbnormal && <span style={{ marginLeft: 4, color: '#ef4444', fontSize: 11 }}>вљ пёЏ</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={confirmOcrLabs} disabled={selectedLabs.size === 0} style={{
                        width: '100%', marginTop: 12, padding: 12,
                        background: selectedLabs.size > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: selectedLabs.size > 0 ? '#000' : 'var(--text-dim)',
                        border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: selectedLabs.size > 0 ? 'pointer' : 'not-allowed',
                      }}>вњ“ РЎРѕС…СЂР°РЅРёС‚СЊ {selectedLabs.size} РїРѕРєР°Р·Р°С‚РµР»РµР№</button>
                    </div>
                  )}
                  {ocrResult.text.length > 0 && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>рџ“„ Р Р°СЃРїРѕР·РЅР°РЅРЅС‹Р№ С‚РµРєСЃС‚ ({ocrResult.text.length} СЃРёРјРІ.)</summary>
                      <pre style={{ fontSize: 9, color: 'var(--text-dim)', background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{ocrResult.text.slice(0, 2000)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}{/* Lab Input Modal */}
      {showLabInput && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }} onClick={() => setShowLabInput(false)}>
          <div style={{
            position: 'fixed', bottom: '76px', left: 0, right: 0, zIndex: 201,
            background: 'var(--bg)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '12px 14px',
            maxHeight: '50vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>рџ§Є Р’РІРµСЃС‚Рё СЂРµР·СѓР»СЊС‚Р°С‚</span>
              <button onClick={() => setShowLabInput(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>вњ•</button>
            </div>

            {(() => { const info = UCUM_MAP[inputCode.toUpperCase()]; return info ? (
              <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>
                {info.name} вЂў РќРѕСЂРјР°: {info.lln}вЂ“{info.uln} {info.prefUnit}
              </div>
            ) : null; })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>РљРѕРґ</label>
                <input value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="ALT"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р—РЅР°С‡РµРЅРёРµ</label>
                <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="40"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р•РґРёРЅРёС†Р°</label>
                <input value={inputUnit} onChange={e => setInputUnit(e.target.value)} placeholder="U/L"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р”Р°С‚Р°</label>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>

            <button onClick={addLab} style={{
              width: '100%', marginTop: 8, padding: 10, background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              вњ“ РЎРѕС…СЂР°РЅРёС‚СЊ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};




