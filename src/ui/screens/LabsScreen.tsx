import React, { useState, useMemo, useCallback } from 'react';
import { RISK_SYSTEMS, REQUIRED_LABS_PER_PHASE, UCUM_MAP } from '../../core/constants';
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
  baseline: '📋 Базовые (до курса)',
  on_cycle: '💊 На курсе',
  bridge: '🌉 Мост',
  pct: '🔄 ПКТ',
  post_pct: '✅ После ПКТ',
  course_bridge_course: '🔁 Курс→Мост→Курс',
};

const PHASE_ICONS: Record<string, string> = {
  baseline: '📋', on_cycle: '💊', bridge: '🌉', pct: '🔄', post_pct: '✅', course_bridge_course: '🔁',
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

  const hasLabs = linked.labs && linked.labs.length > 0;
  const labs: LabPoint[] = linked.labs || [];

  // Required labs for selected phase
  const requiredLabs = useMemo(() => {
    return (REQUIRED_LABS_PER_PHASE as Record<string, string[]>)[selectedPhase] || [];
  }, [selectedPhase]);

  // Group required labs by system
  const labsBySystem = useMemo(() => {
    const systemMap: Record<string, string[]> = {
      'Печень': ['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB'],
      'Почки': ['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA'],
      'Эндокринная': ['TT','TSH','FT3','FT4','E2','PRL','LH','FSH','SHBG','CORTISOL','INS','HOMA','IGF1'],
      'Кроветворение': ['HGB','HCT','PLT','WBC','RBC','MCV'],
      'Липиды': ['LDL','HDL','TG','GLU','HBA1C'],
      'Воспаление': ['CRP','FERRITIN','HOMOCYSTEINE'],
      'Витамины': ['VITD','CALCIDIOL','B12'],
      'Репродуктивная': ['PSA','DHEA_S','AMH','INHB','PROGESTERONE','DHT','FT'],
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
        if (!groups['Другие']) groups['Другие'] = [];
        groups['Другие'].push(code);
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

  return (
    <div className="screen labs">
      <h2>🧪 Анализы</h2>

      {/* Phase selector */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none' }}>
        {Object.entries(PHASE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setSelectedPhase(key)} style={{
            padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
            background: selectedPhase === key ? 'var(--accent)' : 'var(--bg-secondary)',
            color: selectedPhase === key ? '#000' : 'var(--text-dim)',
            border: `1px solid ${selectedPhase === key ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {(['results', 'schedule', 'catalog', 'investigations'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'results' ? '📊 Результаты' : t === 'schedule' ? '📅 График' : t === 'investigations' ? '🔬 Исследования' : '📋 Каталог'}
          </button>
        ))}
      </div>

      {/* Required labs progress for phase */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{PHASE_ICONS[selectedPhase]} {PHASE_LABELS[selectedPhase]}</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: completionPct === 100 ? 'var(--accent)' : completionPct > 50 ? '#eab308' : '#ef4444' }}>
            {submittedCount}/{requiredLabs.length}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--accent)' : '#eab308', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>

        {/* Labs by system */}
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(labsBySystem).map(([system, codes]) => (
            <div key={system}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>{system}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {codes.map(code => {
                  const info = UCUM_MAP[code.toUpperCase()];
                  const isSubmitted = submittedCodes.has(code.toUpperCase());
                  const latest = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
                  const isHigh = latest && info ? latest.value > info.uln : false;
                  const isLow = latest && info ? latest.value < info.lln : false;
                  return (
                    <button key={code} onClick={() => { setInputCode(code); setInputUnit(info?.prefUnit || ''); setShowLabInput(true); }} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      background: isSubmitted ? (isHigh ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.1)') : 'var(--bg-secondary)',
                      border: `1px solid ${isSubmitted ? (isHigh ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(249,115,22,0.3)' : 'rgba(0,230,138,0.2)') : 'var(--border)'}`,
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
        </div>

        {/* Missing labs */}
        {missingLabs.length > 0 && missingLabs.length < requiredLabs.length && (
          <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 10, color: 'var(--text-dim)' }}>
            Не сдано: {missingLabs.slice(0, 10).join(', ')}{missingLabs.length > 10 ? ` +${missingLabs.length - 10}` : ''}
          </div>
        )}
      </div>

      {/* Tab content */}
      {renderContent()}

      {/* Lab Risks + Indices */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3>🔬 Риски из анализов</h3>
        {labRisks && labRisks.overallNet > 0 ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Общий риск</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(labRisks.overallNet) }}>{Math.round(labRisks.overallNet)}%</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Отклонения</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {labRisks.systemBreakdown ? Object.keys(labRisks.systemBreakdown).filter(k => labRisks.systemBreakdown[k].net > 0).length : 0}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Введите данные анализов для оценки рисков</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h3>📊 Индексы</h3>
        {indexEntries.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {indexEntries.map(d => (
              <div key={d.key} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11 }}>{d.label}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: getRiskColor(d.value) }}>{d.value}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Нет данных</div>
        )}
      </div>

      {/* PENALTY SECTION - unified */}
      <div className="card" style={{ marginTop: 8, background: anyNoLabs ? 'rgba(239,68,68,0.08)' : 'var(--glass-bg)', borderColor: anyNoLabs ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)' }}>
        <h3>⚠️ Штраф за отсутствие анализов</h3>
        <div style={{ fontSize: 11, marginBottom: 8 }}>
          {anyNoLabs ? (
            <div>
              <div>Множитель: <strong style={{ color: '#ef4444' }}>×{penalty.totalMultiplier.toFixed(2)}</strong></div>
              <div>Лабы: {Math.round(penalty.labPenalty * 100)}% • Диагностика: {Math.round(penalty.diagnosticPenalty * 100)}%</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Штраф не применён. Все риски рассчитаны без понижающего коэффициента.</div>
          )}
        </div>

        {/* Global no-labs button */}
        <button onClick={toggleGlobalNoLabs} style={{
          width: '100%', padding: 10, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: globalNoLabs ? 'var(--accent)' : '#ef4444', color: globalNoLabs ? '#000' : '#fff',
          border: 'none', marginBottom: 6,
        }}>
          {globalNoLabs ? '✅ Глобальный штраф применён — отменить' : '🚫 БЕЗ ВСЕХ АНАЛИЗОВ (Штраф на всё)'}
        </button>

        {/* Per-system penalty buttons */}
        {!globalNoLabs && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Или штраф по отдельной системе:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {RISK_SYSTEMS.map(sys => {
                const isActive = noLabsSystems.includes(sys);
                const sysLabels: Record<string, string> = {
                  cardio: '❤️ Сердце', hepatic: '🫁 Печень', renal: '🫘 Почки',
                  neuro: '🧠 Нервная', endocrine: '🦋 Эндокр.', hematologic: '🩸 Кровь',
                  reproductive: '🔬 Репрод.', musculoskeletal: '🦴 Кости',
                };
                return (
                  <button key={sys} onClick={() => toggleSystemNoLabs(sys)} style={{
                    padding: '3px 8px', borderRadius: 12, fontSize: 9, cursor: 'pointer',
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

      {/* Lab Input Modal */}
      {showLabInput && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }} onClick={() => setShowLabInput(false)}>
          <div style={{
            position: 'fixed', bottom: '72px', left: 0, right: 0, zIndex: 201,
            background: 'var(--bg)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '12px 14px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🧪 Ввести результат</span>
              <button onClick={() => setShowLabInput(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>

            {(() => { const info = UCUM_MAP[inputCode.toUpperCase()]; return info ? (
              <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>
                {info.name} • Норма: {info.lln}–{info.uln} {info.prefUnit}
              </div>
            ) : null; })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Код</label>
                <input value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="ALT"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Значение</label>
                <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="40"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Единица</label>
                <input value={inputUnit} onChange={e => setInputUnit(e.target.value)} placeholder="U/L"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Дата</label>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>

            <button onClick={addLab} style={{
              width: '100%', marginTop: 8, padding: 10, background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              ✓ Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
