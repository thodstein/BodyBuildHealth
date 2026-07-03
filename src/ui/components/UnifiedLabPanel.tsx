import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { UCUM_MAP, REQUIRED_LABS_PER_PHASE } from '../../core/constants';
import type { LabPoint } from '../../core/types';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';

const PHASES = [
  { id: 'baseline', label: 'Базовый', icon: '📋', color: '#8b5cf6' },
  { id: 'on_cycle', label: 'На курсе', icon: '💉', color: '#ef4444' },
  { id: 'bridge', label: 'Мост', icon: '🔄', color: '#f59e0b' },
  { id: 'pct', label: 'ПКТ', icon: '🛡', color: '#22c55e' },
  { id: 'post_pct', label: 'После ПКТ', icon: '✅', color: '#3b82f6' },
  { id: 'fertility', label: 'Фертильность', icon: '🧬', color: '#ec4899' },
] as const;

const FERTILITY_MARKERS = ['INHB','AMH','LH','FSH','TT','FT','E2','PRL','SHBG','PROG','SPERM_VOL','SPERM_CONC','SPERM_PR','SPERM_NP','SPERM_MORPH','SPERM_MAR','SPERM_DFI','SPERM_VIT','SPERM_PH','SPERM_FRUCT','SPERM_ZINC','SPERM_LEUK'];

const SPERM_MARKERS: Record<string, { name: string; range: string; unit: string }> = {
  SPERM_VOL: { name: 'Объём эякулята', range: '≥1.5', unit: 'мл' },
  SPERM_CONC: { name: 'Концентрация сперматозоидов', range: '≥16', unit: 'млн/мл' },
  SPERM_TOTAL: { name: 'Общее количество', range: '≥39', unit: 'млн' },
  SPERM_PR: { name: 'Прогрессивно-подвижные (PR)', range: '≥30', unit: '%' },
  SPERM_NP: { name: 'Непрогрессивно-подвижные (NP)', range: '—', unit: '%' },
  SPERM_IM: { name: 'Неподвижные (IM)', range: '—', unit: '%' },
  SPERM_MORPH: { name: 'Морфология (Крюгер)', range: '≥4', unit: '%' },
  SPERM_VIT: { name: 'Жизнеспособность', range: '≥58', unit: '%' },
  SPERM_PH: { name: 'pH', range: '7.2-8.0', unit: '' },
  SPERM_FRUCT: { name: 'Фруктоза', range: '≥13', unit: 'мкмоль/л' },
  SPERM_ZINC: { name: 'Цинк семенной', range: '≥2', unit: 'ммоль/л' },
  SPERM_MAR: { name: 'MAR-тест', range: '<50', unit: '%' },
  SPERM_LEUK: { name: 'Лейкоциты', range: '<1', unit: 'млн/мл' },
  SPERM_DFI: { name: 'DFI (фрагментация ДНК)', range: '<15', unit: '%' },
};

const SYSTEM_GROUPS: Record<string, { label: string; icon: string; color: string; codes: string[] }> = {
  hepatic: { label: 'Печень', icon: '🫁', color: '#f59e0b', codes: ['ALT','AST','GGT','ALP','BIL','DBIL','ALB','TP','LDH','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT','CHOLINESTERASE','BILE_ACIDS','AMMONIA','LACTATE'] },
  cardio: { label: 'ССС', icon: '❤️', color: '#ef4444', codes: ['LDL','HDL','TG','APO_B','APO_A1','LP_A','CRP','CK','CK_MB','TROPONIN','TROPONIN_I','NT_PROBNP','BNP','BP_SYSTOLIC','BP_DIASTOLIC','HR','ENDOTHELIN1','NO_MARKER','HOMOCYSTEINE'] },
  endocrine: { label: 'Эндокринная', icon: '🧬', color: '#8b5cf6', codes: ['TT','FT','E2','PRL','LH','FSH','SHBG','TSH','FT3','FT4','CORTISOL','DHEA_S','DHT','PROG','PROGESTERONE','IGF1','IGFBP3','GH','ANDROSTENEDIONE','AMH','INHB','INHIBIN_B'] },
  hematologic: { label: 'Кровь', icon: '🩸', color: '#ec4899', codes: ['HCT','HGB','PLT','WBC','RBC','MCV','MCH','MCHC','RDW','FERRITIN','IRON','TRANSFERRIN','TIBC','RETICULOCYTES','ERYTHROPOIETIN','HAPTOGLOBIN','ESR','D_DIMER','FIBRINOGEN','INR','APTT'] },
  renal: { label: 'Почки', icon: '💧', color: '#06b6d4', codes: ['CREATININE','UREA','EGFR','UA','URIC_ACID','CYSTATIN_C','NGAL','KIM1','PROTEIN_URINE','MICROALB'] },
  metabolic: { label: 'Метаболизм', icon: '⚡', color: '#22c55e', codes: ['GLU','INS','HOMA','HOMAIR','HbA1c','FRUCTOSAMINE','C_PEPTIDE','PROINSULIN'] },
  minerals: { label: 'Мин./Витамины', icon: '💊', color: '#0ea5e9', codes: ['K','NA','CA','P','MG','B12','FOL','VITD','VITAMIN_E','VITAMIN_A','ZINC','SELENIUM','COPPER','CHLORIDE','OSMOLALITY','ANION_GAP'] },
  inflammation: { label: 'Воспаление', icon: '🔥', color: '#f97316', codes: ['CRP','ESR','FIBRINOGEN','TNF_ALPHA','IL6','IL1B','HAPTOGLOBIN'] },
  reproductive: { label: 'Репродуктивная', icon: '🔬', color: '#ec4899', codes: ['PSA','DHEA_S','AMH','INHB','INHIBIN_B','PROG','PROGESTERONE','DHT','ANDROSTENEDIONE'] },
  neuro: { label: 'Нервная', icon: '🧠', color: '#a855f7', codes: ['CORTISOL','HOMOCYSTEINE','TNF_ALPHA','IL6','SEROTONIN','DOPAMINE','GABA','BDNF'] },
};

const ALL_CODES = new Set(Object.values(SYSTEM_GROUPS).flatMap(g => g.codes));

const PHASE_MARKER_MAP: Record<string, string[]> = {
  ...REQUIRED_LABS_PER_PHASE,
  fertility: FERTILITY_MARKERS,
};

const SYSTEM_LABEL_REQUIRED = 'Этот маркер рекомендуется сдать в выбранной фазе';

interface UnifiedLabPanelProps {
  hidePhase?: boolean;
  hideSpermogram?: boolean;
  showFertilityPhase?: boolean;
  onValuesChange?: (values: Record<string, string>) => void;
  externalValues?: Record<string, string>;
}

export const UnifiedLabPanel: React.FC<UnifiedLabPanelProps> = ({ hidePhase, hideSpermogram, showFertilityPhase, onValuesChange, externalValues }) => {
  const [selectedPhase, setSelectedPhase] = useState('baseline');
  const [searchQ, setSearchQ] = useState('');
  const [labValues, setLabValues] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [allLabs, setAllLabs] = useState<LabPoint[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phases = useMemo(() => {
    if (showFertilityPhase) return PHASES;
    return PHASES.filter(p => p.id !== 'fertility');
  }, [showFertilityPhase]);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = getProfile();
        const entries = await db.getAll<LabPoint>('labs_log');
        setAllLabs(entries);
        const vals: Record<string, string> = {};
        const pid = profile.id || 'current-user';
        entries
          .filter(e => e.patientId === pid)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .forEach(e => {
            if (e.value !== undefined && !vals[e.code]) vals[e.code] = String(e.value);
          });
        setLabValues(prev => {
          const merged = { ...prev };
          Object.entries(vals).forEach(([k, v]) => { if (!merged[k]) merged[k] = v; });
          return merged;
        });
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (externalValues) {
      setLabValues(prev => ({ ...prev, ...externalValues }));
    }
  }, [externalValues]);

  const requiredCodes = useMemo(() => {
    if (selectedPhase === 'fertility') return new Set(FERTILITY_MARKERS);
    return new Set(PHASE_MARKER_MAP[selectedPhase] || []);
  }, [selectedPhase]);

  const availablePhases = phases;

  const setValue = useCallback((code: string, value: string) => {
    setLabValues(prev => ({ ...prev, [code]: value }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        const profile = getProfile();
        const ucum = UCUM_MAP[code];
        await db.put('labs_log', {
          id: crypto.randomUUID(),
          code,
          name: ucum?.name || code,
          value: parseFloat(value) || 0,
          unit: ucum?.prefUnit || '',
          date: new Date().toISOString().split('T')[0],
          phase: selectedPhase,
          patientId: profile.id || 'current-user',
        } as LabPoint);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch { setSaveStatus('idle'); }
    }, 800);
  }, [selectedPhase]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    if (onValuesChange && Object.keys(labValues).length > 0) {
      onValuesChange(labValues);
    }
  }, [labValues]);

  const filteredGroups = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return Object.entries(SYSTEM_GROUPS).map(([key, group]) => {
      const codes = group.codes.filter(c => ALL_CODES.has(c));
      const markers = codes.map(code => {
        const ucum = UCUM_MAP[code];
        const sperm = SPERM_MARKERS[code];
        const name = ucum?.name || sperm?.name || code;
        const unit = ucum?.prefUnit || sperm?.unit || '';
        const range = ucum ? `${ucum.lln}-${ucum.uln}` : (sperm?.range || '');
        const val = labValues[code] || '';
        const hasData = !!val;
        const isRequired = requiredCodes.has(code);
        const isHl = isRequired && (searchQ === '' || name.toLowerCase().includes(q));
        return { code, name, unit, range, val, hasData, isRequired, isHl };
      }).filter(m => !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));

      const label = group.label;
      const icon = group.icon;
      const color = group.color;
      const total = codes.length;
      const filled = markers.filter(m => m.hasData).length;
      return { key, label, icon, color, markers, total, filled };
    }).filter(g => g.markers.length > 0);
  }, [searchQ, labValues, requiredCodes]);

  const totalMarkers = useMemo(() => filteredGroups.reduce((a, g) => a + g.markers.length, 0), [filteredGroups]);
  const filledMarkers = useMemo(() => filteredGroups.reduce((a, g) => a + g.filled, 0), [filteredGroups]);
  const requiredInPhase = useMemo(() => filteredGroups.reduce((a, g) => a + g.markers.filter(m => m.isRequired).length, 0), [filteredGroups]);
  const filledRequired = useMemo(() => filteredGroups.reduce((a, g) => a + g.markers.filter(m => m.isRequired && m.hasData).length, 0), [filteredGroups]);

  const toggleGroup = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const getStatusColor = (code: string, val: string): string | null => {
    if (!val) return null;
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    const ucum = UCUM_MAP[code];
    if (!ucum) {
      const sperm = SPERM_MARKERS[code];
      if (!sperm) return null;
      const r = parseFloat(sperm.range.replace(/[≥<>=]/g, ''));
      if (isNaN(r)) return null;
      if (code === 'SPERM_MAR' || code === 'SPERM_LEUK' || code === 'SPERM_DFI') {
        return n > r ? '#ef4444' : '#22c55e';
      }
      return n < r ? '#ef4444' : '#22c55e';
    }
    if (n < ucum.lln) return '#f59e0b';
    if (n > ucum.uln) return '#ef4444';
    return '#22c55e';
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 12, boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div>
      {/* Phase buttons */}
      {!hidePhase && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display:'flex', gap:4, marginBottom:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
            {availablePhases.map(p => {
              const active = selectedPhase === p.id;
              return (
                <button key={p.id} onClick={() => setSelectedPhase(p.id)} style={{
                  flexShrink:0, whiteSpace:'nowrap', padding:'6px 12px', borderRadius:16, fontSize:10, cursor:'pointer',
                  background: active ? p.color : 'rgba(255,255,255,0.05)',
                  color: active ? '#000' : 'var(--text-dim)',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  fontWeight: active ? 700 : 400,
                  transition: 'all 0.2s',
                }}>
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
          {/* Progress bar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:9, color:'var(--text-dim)' }}>
            <span>{filledMarkers}/{totalMarkers} всего</span>
            {requiredInPhase > 0 && (
              <span style={{ color: filledRequired >= requiredInPhase ? '#22c55e' : '#f59e0b' }}>
                · {filledRequired}/{requiredInPhase} обязательных
              </span>
            )}
            {saveStatus === 'saving' && <span style={{ color:'#f59e0b' }}>💾</span>}
            {saveStatus === 'saved' && <span style={{ color:'#22c55e' }}>✓ сохранено</span>}
          </div>
          {requiredInPhase > 0 && (
            <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginTop:4, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, background:'#22c55e', width:`${Math.min(100, (filledRequired/requiredInPhase)*100)}%`, transition:'width 0.3s' }} />
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom:8 }}>
        <input type="text" placeholder="🔍 Поиск маркера..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{
          width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)',
          background:'rgba(0,0,0,0.15)', color:'#fff', fontSize:11, boxSizing:'border-box', outline:'none',
        }} />
      </div>

      {/* Groups */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {filteredGroups.map(group => {
          const isOpen = collapsed[group.key] !== true;
          const green = Math.round(group.filled / Math.max(1, group.total) * 100);
          return (
            <div key={group.key} style={{
              borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.04)',
              background:'rgba(24,24,27,0.12)',
            }}>
              {/* Group header */}
              <div onClick={() => toggleGroup(group.key)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'8px 10px',
                borderBottom: isOpen ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor:'pointer', userSelect:'none',
              }}>
                <span style={{ fontSize:14 }}>{group.icon}</span>
                <span style={{ fontSize:11, fontWeight:600, color:group.color, flex:1 }}>{group.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'var(--text-dim)' }}>
                  <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ height:'100%', background: group.filled === group.total ? '#22c55e' : group.color, width:`${green}%`, borderRadius:2 }} />
                  </div>
                  <span>{group.filled}/{group.total}</span>
                </div>
                <span style={{ fontSize:10, color:'var(--text-dim)', transition:'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </div>

              {/* Markers */}
              {isOpen && (
                <div style={{ padding:'4px 8px 8px' }}>
                  {group.markers.map(m => {
                    const statusColor = getStatusColor(m.code, m.val);
                    return (
                      <div key={m.code} style={{
                        display:'flex', alignItems:'center', gap:4, padding:'5px 6px', marginTop:2,
                        borderRadius:6,
                        background: m.isRequired ? 'rgba(255,255,255,0.03)' : 'transparent',
                        border: m.isRequired ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                        flexWrap:'wrap',
                      }}>
                        {/* Required indicator */}
                        {m.isRequired && <span style={{ fontSize:8, color:'#22c55e', flexShrink:0 }}>●</span>}

                        {/* Name */}
                        <span style={{ fontSize:10, fontWeight:m.isRequired?600:400, color:'var(--text-light)', minWidth:80, flex:1 }}>
                          {m.name}
                        </span>

                        {/* Range */}
                        <span style={{ fontSize:8, color:'var(--text-dim)', marginRight:4, flexShrink:0 }}>
                          {m.range}{m.unit && ` ${m.unit}`}
                        </span>

                        {/* Input */}
                        <div style={{ width:70, flexShrink:0, position:'relative' }}>
                          <input type="number" step="0.01" value={m.val} onChange={e => setValue(m.code, e.target.value)}
                            placeholder="—"
                            style={{
                              ...inputStyle,
                              borderColor: statusColor ? `${statusColor}44` : 'rgba(255,255,255,0.08)',
                              paddingRight: 20,
                              fontWeight: m.val ? 600 : 400,
                              color: statusColor || 'var(--text-light)',
                            }}
                          />
                          {/* Status dot */}
                          {statusColor && (
                            <span style={{
                              position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                              width:8, height:8, borderRadius:'50%', background:statusColor,
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spermogram section */}
      {!hideSpermogram && (searchQ === '' || Object.values(SPERM_MARKERS).some(m => m.name.toLowerCase().includes(searchQ.toLowerCase()))) && (
        <div style={{ marginTop:8, borderRadius:10, border:'1px solid rgba(34,197,94,0.15)', overflow:'hidden' }}>
          <div style={{
            padding:'8px 10px', background:'rgba(34,197,94,0.06)',
            borderBottom:'1px solid rgba(34,197,94,0.1)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>🧪</span>
              <span style={{ fontSize:11, fontWeight:600, color:'#22c55e', flex:1 }}>Спермограмма (ВОЗ 2021)</span>
              <span style={{ fontSize:9, color:'var(--text-dim)' }}>
                {Object.keys(SPERM_MARKERS).filter(c => labValues[c]).length}/{Object.keys(SPERM_MARKERS).length}
              </span>
            </div>
          </div>
          <div style={{ padding:'4px 8px 8px', background:'rgba(24,24,27,0.08)' }}>
            {Object.entries(SPERM_MARKERS).filter(([code, m]) => !searchQ || m.name.toLowerCase().includes(searchQ.toLowerCase())).map(([code, m]) => {
              const val = labValues[code] || '';
              const statusColor = getStatusColor(code, val);
              const isReq = selectedPhase === 'fertility';
              return (
                <div key={code} style={{
                  display:'flex', alignItems:'center', gap:4, padding:'5px 6px', marginTop:2, borderRadius:6,
                  background: isReq ? 'rgba(34,197,94,0.04)' : 'transparent',
                  border: isReq ? '1px solid rgba(34,197,94,0.1)' : '1px solid transparent',
                  flexWrap:'wrap',
                }}>
                  {isReq && <span style={{ fontSize:8, color:'#22c55e', flexShrink:0 }}>●</span>}
                  <span style={{ fontSize:10, fontWeight:500, color:'var(--text-light)', flex:1, minWidth:80 }}>{m.name}</span>
                  <span style={{ fontSize:8, color:'var(--text-dim)', marginRight:4, flexShrink:0 }}>{m.range} {m.unit}</span>
                  <div style={{ width:70, flexShrink:0, position:'relative' }}>
                    <input type="number" step="0.01" value={val} onChange={e => setValue(code, e.target.value)}
                      placeholder="—" style={{
                        ...inputStyle,
                        borderColor: statusColor ? `${statusColor}44` : 'rgba(255,255,255,0.08)',
                        paddingRight:20, fontWeight: val?600:400, color: statusColor || 'var(--text-light)',
                      }}
                    />
                    {statusColor && <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:8, height:8, borderRadius:'50%', background:statusColor }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalMarkers === 0 && (
        <div style={{ textAlign:'center', padding:20, fontSize:11, color:'var(--text-dim)' }}>
          {searchQ ? 'Нет маркеров по запросу' : 'Нет маркеров для отображения'}
        </div>
      )}
    </div>
  );
};

export default UnifiedLabPanel;
