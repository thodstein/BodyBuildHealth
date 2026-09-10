import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PROBLEM_PANELS, formatPanelAsReferral, type ProblemPanel } from '../../../data/labs-problem-panels';
import { getProblemPanelsForSymptoms } from '../../../engines/symptom-lab-link';
import { SYMPTOM_DB, findSymptomById, type SymptomEntry } from '../../../engines/symptom-solver.engine';
import { copyOrShareText } from '../../../core/apk-share';

const URGENCY_LABELS: Record<string, string> = {
  routine: 'Планово',
  urgent: 'Срочно',
  emergency: 'Экстренно',
};
const URGENCY_COLORS: Record<string, string> = {
  routine: '#3b82f6',
  urgent: '#f97316',
  emergency: '#ef4444',
};
const PHASE_LABELS: Record<string, string> = {
  baseline: 'До курса',
  on_cycle: 'На курсе',
  pct: 'ПКТ',
  fertility: 'Фертильность',
  any: 'Любая фаза',
};
const IMPORTANCE_COLORS: Record<string, string> = {
  critical: '#ef4444',
  important: '#f97316',
  optional: '#6b7280',
};
const IMPORTANCE_LABELS: Record<string, string> = {
  critical: 'Обязательно',
  important: 'Важно',
  optional: 'Опционально',
};

const LabsProblemPanelsTab: React.FC = () => {
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [symptomLinkedPanels, setSymptomLinkedPanels] = useState<string[]>([]);
  const [showSymptomLink, setShowSymptomLink] = useState(false);
  const [symptomSearchQ, setSymptomSearchQ] = useState('');
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allPanels = useMemo(() => PROBLEM_PANELS, []);

  const allSymptoms = useMemo(() => SYMPTOM_DB, []);

  const filteredSymptoms = useMemo(() => {
    const q = symptomSearchQ.toLowerCase().trim();
    if (!q) return [];
    return allSymptoms
      .filter(s => s.symptom.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .slice(0, 12);
  }, [symptomSearchQ, allSymptoms]);

  const selectedSymptoms = useMemo(() => {
    return selectedSymptomIds
      .map(id => findSymptomById(id))
      .filter((s): s is SymptomEntry => s !== undefined);
  }, [selectedSymptomIds]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addSymptom = useCallback((id: string) => {
    setSelectedSymptomIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSymptomSearchQ('');
    setDropdownOpen(false);
  }, []);

  const removeSymptom = useCallback((id: string) => {
    setSelectedSymptomIds(prev => prev.filter(x => x !== id));
  }, []);

  // Auto-search when selection changes
  const handleSymptomSearch = useCallback(() => {
    if (selectedSymptomIds.length === 0) { setSymptomLinkedPanels([]); return; }
    const panels = getProblemPanelsForSymptoms(selectedSymptomIds);
    setSymptomLinkedPanels(panels);
  }, [selectedSymptomIds]);

  useEffect(() => {
    if (showSymptomLink && selectedSymptomIds.length > 0) {
      handleSymptomSearch();
    }
  }, [selectedSymptomIds, showSymptomLink, handleSymptomSearch]);

  const filteredPanels = useMemo(() => {
    let panels = allPanels;
    if (filterPhase !== 'all') {
      panels = panels.filter(p => p.phase === filterPhase || p.phase === 'any');
    }
    if (filterUrgency !== 'all') {
      panels = panels.filter(p => p.urgency === filterUrgency);
    }
    return panels;
  }, [allPanels, filterPhase, filterUrgency]);

  const selectedPanel = useMemo(() => {
    if (!selectedPanelId) return null;
    return allPanels.find(p => p.id === selectedPanelId) || null;
  }, [allPanels, selectedPanelId]);

  const handleCopyReferral = useCallback((panel: ProblemPanel) => {
    const text = formatPanelAsReferral(panel);
    void copyOrShareText(text, 'Направление на анализы').then(o => {
      if (o === 'failed') return;
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    });
  }, []);

  const handleSymptomLinkClick = useCallback(() => {
    setShowSymptomLink(prev => !prev);
    setSymptomSearchQ('');
  }, []);

  // Detail view for a specific panel
  if (selectedPanel) {
    return (
      <div className="labs-problems" style={{ padding:'8px 0 60px', display:'flex', flexDirection:'column', gap:10 }}>
        <button onClick={() => setSelectedPanelId(null)} style={{
          padding:'10px 16px', borderRadius:999, cursor:'pointer', fontWeight:800, fontSize:12, minHeight:44,
          background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff',
          marginBottom:2, alignSelf:'flex-start',
        }}>← Назад к списку</button>

        {/* Header */}
        <div style={{
          padding: '12px 14px', borderRadius: 14, marginBottom: 10,
          background: 'rgba(20,22,30,0.6)', border: '1px solid var(--glass-border)',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: `${URGENCY_COLORS[selectedPanel.urgency]}18`,
              color: URGENCY_COLORS[selectedPanel.urgency],
              border: `1px solid ${URGENCY_COLORS[selectedPanel.urgency]}30`,
            }}>
              {URGENCY_LABELS[selectedPanel.urgency]}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border)',
            }}>
              {PHASE_LABELS[selectedPanel.phase] || selectedPanel.phase}
            </span>
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {selectedPanel.title}
          </h3>
          <p style={{ margin: 0, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
            {selectedPanel.problem}
          </p>
        </div>

        {/* Markers */}
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
            🔬 Лабораторные маркеры
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {selectedPanel.markers.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8,
                background: 'var(--bg-secondary)', border: `1px solid ${IMPORTANCE_COLORS[m.importance]}20`,
                borderLeft: `3px solid ${IMPORTANCE_COLORS[m.importance]}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 100 }}>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:999,
                    background:`${IMPORTANCE_COLORS[m.importance]}22`, color:IMPORTANCE_COLORS[m.importance], border:`1px solid ${IMPORTANCE_COLORS[m.importance]}35`,
                  }}>{IMPORTANCE_LABELS[m.importance]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{m.label}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {m.target && (
                    <span style={{ fontSize: 10, color: 'var(--accent)' }}>Цель: {m.target}</span>
                  )}
                  {m.highMeaning && (
                    <span style={{ fontSize: 10, color: '#f97316' }}>↑ {m.highMeaning}</span>
                  )}
                  {m.lowMeaning && (
                    <span style={{ fontSize: 10, color: '#3b82f6' }}>↓ {m.lowMeaning}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical notes */}
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#f97316' }}>
            🩺 Клинический комментарий
          </h4>
          <p style={{ margin: 0, fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
            {selectedPanel.clinicalNotes}
          </p>
        </div>

        {/* Recommended actions */}
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
            📋 Рекомендуемые действия
          </h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#fff', lineHeight: 1.6 }}>
            {selectedPanel.recommendedActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>

        {/* Copy referral button */}
        <button onClick={() => handleCopyReferral(selectedPanel)} style={{
          width: '100%', padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12,
          background: referralCopied ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.15)' : 'linear-gradient(135deg, rgba(var(--labs-accent-rgb, 0,230,138),0.12), rgba(var(--labs-accent-rgb, 0,230,138),0.04))',
          border: `1px solid ${referralCopied ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.5)' : 'rgba(var(--labs-accent-rgb, 0,230,138),0.25)'}`,
          color: 'var(--accent)', transition: 'all 0.2s',
        }}>
          {referralCopied ? '✓ Скопировано' : '📋 Сформировать направление (копировать в буфер)'}
        </button>
      </div>
    );
  }

  // List view
  return (
    <div className="labs-problems" style={{ padding: '8px 0 60px' }}>
      {/* Header + symptom link */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
          Выберите клинический сценарий для получения персонального перечня лабораторных маркеров,
          референсных значений и расшифровки отклонений.
        </p>
        <button onClick={handleSymptomLinkClick} style={{
          padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 11,
          background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))',
          border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🔍 У меня есть симптомы — найти нужные анализы
        </button>
      </div>

      {/* Symptom link popup */}
      {showSymptomLink && (
        <div className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid rgba(168,85,247,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#a855f7' }}>🔍 Симптом → анализы</span>
            <button onClick={() => { setShowSymptomLink(false); setSymptomLinkedPanels([]); setSymptomSearchQ(''); setSelectedSymptomIds([]); }} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: '#fff',
              borderRadius: 8, padding: '3px 10px', fontSize: 10, cursor: 'pointer',
            }}>✕</button>
          </div>
          <p style={{ fontSize: 10, color: '#fff', margin: '0 0 8px' }}>
            Введите название симптома на русском — например «головная боль», «отёки», «тошнота»
          </p>

          {/* Selected symptom chips */}
          {selectedSymptoms.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {selectedSymptoms.map(s => (
                <span key={s.id} onClick={() => removeSymptom(s.id)} style={{
                  padding: '4px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  background: 'rgba(var(--labs-accent-rgb, 0,230,138),0.12)', border: '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.25)',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  ✓ {s.symptom} <span style={{ fontSize:11, opacity:0.7 }}>✕</span>
                </span>
              ))}
            </div>
          )}

          {/* Search input with dropdown */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={symptomSearchQ}
              onChange={e => { setSymptomSearchQ(e.target.value); setDropdownOpen(true); }}
              onFocus={() => symptomSearchQ.trim() && setDropdownOpen(true)}
              placeholder="Начните вводить симптом..."
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 12,
              }}
            />
            {dropdownOpen && filteredSymptoms.length > 0 && (
              <div ref={dropdownRef} style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                marginTop: 4, borderRadius: 10, overflow: 'hidden',
                background: 'var(--bg)', border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 220, overflowY: 'auto',
              }}>
                {filteredSymptoms.map(s => (
                  <button key={s.id} onClick={() => addSymptom(s.id)} style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                    background: selectedSymptomIds.includes(s.id) ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.06)' : 'transparent',
                    border: 'none', fontSize: 11, color: 'var(--text)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{s.symptom}</span>
                    <span style={{ fontSize:11, color:'#fff', fontWeight:600 }}>{s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSymptomSearch} style={{
            width: '100%', padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 11,
            background: selectedSymptomIds.length > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
            border: selectedSymptomIds.length > 0 ? 'none' : '1px solid var(--border)',
            color: selectedSymptomIds.length > 0 ? '#000' : '#fff',
          }}>
            🔍 Найти анализы для {selectedSymptomIds.length > 0 ? `${selectedSymptomIds.length} симптомов` : 'симптомов'}
          </button>

          {symptomLinkedPanels.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>Рекомендуемые панели:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {symptomLinkedPanels.map(id => {
                  const p = allPanels.find(pp => pp.id === id);
                  return p ? (
                    <button key={id} onClick={() => { setSelectedPanelId(id); setShowSymptomLink(false); }} style={{
                      padding: '4px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      background: 'rgba(var(--labs-accent-rgb, 0,230,138),0.08)', border: '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.2)', color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                    }}>
                      {p.title}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {selectedSymptomIds.length > 0 && symptomLinkedPanels.length === 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#fff', textAlign: 'center' }}>
              Нет панелей для выбранных симптомов
            </div>
          )}
        </div>
      )}

      {/* Phase filter pills — TOP APK 44px */}
      <div className="labs-filter-row" style={{ display:'flex', gap:8, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', padding:'2px 2px 4px' }}>
        {['all', 'baseline', 'on_cycle', 'pct', 'fertility'].map(ph => {
          const active = filterPhase === ph;
          return (
            <button key={ph} onClick={() => setFilterPhase(ph)} aria-pressed={active} style={{
              padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
              whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, minHeight:44,
              transition:'all 0.2s',
              background: active ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(21,38,66,0.60)',
              color: active ? '#0a1a08' : '#fff',
              border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
              boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
            }}>
              {ph === 'all' ? 'Все фазы' : PHASE_LABELS[ph] || ph}
            </button>
          );
        })}
      </div>
      {/* Urgency filter pills — TOP APK 44px */}
      <div className="labs-filter-row" style={{ display:'flex', gap:8, marginBottom:10, overflowX:'auto', scrollbarWidth:'none', padding:'2px 2px 6px' }}>
        {['all', 'routine', 'urgent', 'emergency'].map(ur => {
          const active = filterUrgency === ur;
          return (
            <button key={ur} onClick={() => setFilterUrgency(ur)} aria-pressed={active} style={{
              padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
              whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, minHeight:44,
              transition:'all 0.2s',
              background: active ? 'var(--accent)' : 'rgba(21,38,66,0.60)',
              color: active ? '#000' : '#fff',
              border: active ? '1px solid var(--accent)' : '1px solid rgba(140,190,255,0.14)',
            }}>
              {ur === 'all' ? 'Все срочности' : URGENCY_LABELS[ur] || ur}
            </button>
          );
        })}
      </div>

      {/* Panel cards — TOP APK 64px+ */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filteredPanels.map(panel => (
          <button key={panel.id} onClick={() => setSelectedPanelId(panel.id)} style={{
            padding:'14px 14px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%', minHeight:72,
            background:'linear-gradient(180deg, rgba(21,38,66,0.72), rgba(12,23,40,0.72))', border:`1px solid ${URGENCY_COLORS[panel.urgency]}30`,
            borderLeft:`3px solid ${URGENCY_COLORS[panel.urgency]}`,
            boxShadow:'0 8px 22px rgba(0,0,0,0.35)',
            color:'#fff', transition:'all 0.2s',
            display:'flex', gap:10, alignItems:'center',
          }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{
                  padding:'3px 8px', borderRadius:999, fontSize:10, fontWeight:800,
                  background:`${URGENCY_COLORS[panel.urgency]}1E`,
                  color:URGENCY_COLORS[panel.urgency], border:`1px solid ${URGENCY_COLORS[panel.urgency]}30`,
                }}>
                  {URGENCY_LABELS[panel.urgency]}
                </span>
                <span style={{
                  padding:'3px 8px', borderRadius:999, fontSize:10, fontWeight:800,
                  background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.10)',
                }}>
                  {PHASE_LABELS[panel.phase]}
                </span>
                <span style={{
                  padding:'3px 8px', borderRadius:999, fontSize:10, fontWeight:800,
                  background:'rgba(var(--labs-accent-rgb, 0,230,138),0.10)', color:'var(--accent)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.20)',
                }}>
                  {panel.markers.length} маркеров
                </span>
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:4 }}>{panel.title}</div>
              <div style={{ fontSize:12, color:'#fff', lineHeight:1.5 }}>{panel.problem}</div>
            </div>
            <span style={{ color:URGENCY_COLORS[panel.urgency], fontSize:16, flexShrink:0 }}>→</span>
          </button>
        ))}
      </div>

      {filteredPanels.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#fff', fontSize: 12 }}>
          Нет панелей для выбранных фильтров
        </div>
      )}
    </div>
  );
};

export default LabsProblemPanelsTab;
