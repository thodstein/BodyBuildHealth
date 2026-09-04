import React, { useState, useMemo, useEffect } from 'react';
import { mapStackToPathologies, getKnownDrugNames, DRUG_DATABASE } from '../../../engines/drug-mapper.engine';
import type { DrugEntry, MapperResult } from '../../../engines/drug-mapper.engine';
import { useDataLink } from '../../../core/data-link';

export const MapperTab: React.FC = () => {
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
    import('../../../engines/clinical-analyzer.engine').then(({ analyzeClinicalRisks }) => {
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

  const card: React.CSSProperties = { background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:14, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' };

  return (
    <div className="pharma-mapper" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.06))', border:'1px solid rgba(139,92,246,0.16)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', fontSize:12 }}>🧬</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Маппер: стек → патологии</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.45 }}>
          Граф знаний находит патологии для твоего стека. Кумулятивный удар: 2+ препарата по одной системе усиливают риск.
        </div>
      </div>

      <div style={card}>
        <div style={{ display:'flex', gap:7, marginBottom:10 }}>
          <button onClick={() => setUseCourse(true)} style={{
            flex:1, padding:'9px 10px', borderRadius:11, fontSize:12, fontWeight:800, cursor:'pointer',
            border:`1px solid ${useCourse ? 'rgba(139,92,246,0.32)' : 'rgba(255,255,255,0.07)'}`,
            background: useCourse ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.04)', color: useCourse ? '#fff' : 'rgba(255,255,255,0.62)',
          }}>
            💊 Из курса ({course.length})
          </button>
          <button onClick={() => setUseCourse(false)} style={{
            flex:1, padding:'9px 10px', borderRadius:11, fontSize:12, fontWeight:800, cursor:'pointer',
            border:`1px solid ${!useCourse ? 'rgba(139,92,246,0.32)' : 'rgba(255,255,255,0.07)'}`,
            background: !useCourse ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.04)', color: !useCourse ? '#fff' : 'rgba(255,255,255,0.62)',
          }}>
            ✏️ Вручную ({manualDrugs.length})
          </button>
        </div>

        {!useCourse && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <select value={newDrugName} onChange={e => setNewDrugName(e.target.value)}
                style={{ flex:1, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:600, outline:'none' }}>
                <option value="" style={{ background:'#1a1a1f' }}>Выбрать препарат...</option>
                {knownNames.map(n => (<option key={n} value={n} style={{ background:'#1a1a1f' }}>{n}</option>))}
              </select>
              <input type="number" placeholder="мг" value={newDrugDose || ''}
                onChange={e => setNewDrugDose(parseFloat(e.target.value) || 0)}
                style={{ width:72, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, outline:'none' }} />
              <button onClick={addManualDrug} style={{
                padding:'8px 12px', borderRadius:10, border:'1px solid rgba(139,92,246,0.22)', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer', boxShadow:'0 4px 12px rgba(139,92,246,0.22)',
              }}>+</button>
            </div>
            {manualDrugs.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                {manualDrugs.map(d => (
                  <span key={d.name} onClick={() => removeManualDrug(d.name)} style={{
                    padding:'5px 9px', borderRadius:20, background:'rgba(139,92,246,0.12)', color:'#c4b5fd', border:'1px solid rgba(139,92,246,0.18)',
                    fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer',
                  }}>{d.name} <span style={{ background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:10, fontSize:10 }}>{d.dosageMg}мг</span> ✕</span>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={handleRunManual} style={{
          width:'100%', padding:'11px 0', borderRadius:12, border:'1px solid rgba(139,92,246,0.28)', cursor:'pointer', marginTop:6,
          background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontWeight:800, fontSize:13, boxShadow:'0 6px 16px rgba(139,92,246,0.22)',
        }}>▶ Запустить маппинг</button>
      </div>

      {mapperResult && (
        <>
          <div style={{ ...card, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, textAlign:'center', padding:12 }}>
            <div style={{ background:'rgba(0,0,0,0.18)', borderRadius:12, padding:'10px 6px', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:20, fontWeight:900, color:'#a78bfa' }}>{mapperResult.activePathologies?.length ?? 0}</div>
              <div style={{ fontSize:10, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Патологии</div>
            </div>
            <div style={{ background:'rgba(0,0,0,0.18)', borderRadius:12, padding:'10px 6px', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:20, fontWeight:900, color:'#60a5fa' }}>{mapperResult.requiredBiomarkers?.length ?? 0}</div>
              <div style={{ fontSize:10, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Биомаркеры</div>
            </div>
            <div style={{ background:'rgba(0,0,0,0.18)', borderRadius:12, padding:'10px 6px', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:20, fontWeight:900, color: (mapperResult.unknownDrugs?.length ?? 0) > 0 ? '#f59e0b' : 'rgba(255,255,255,0.72)' }}>
                {mapperResult.knownDrugs}/{mapperResult.totalDrugs}
              </div>
              <div style={{ fontSize:10, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Распознано</div>
            </div>
          </div>

          <div style={{ fontSize:11, fontWeight:800, color:'#fff', letterSpacing:0.3, textTransform:'uppercase' as const, padding:'0 2px' }}>Активные патологии — по тяжести</div>
          {(mapperResult.activePathologies || []).map(p => {
            const sev = getSeverityClass(p.cumulativeTriggerStrength);
            const ZONE_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#eab308' };
            const c = ZONE_COLORS[sev];
            return (
              <div key={p.pathologyId} style={{ ...card, borderLeft:`3px solid ${c}`, padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:800, fontSize:13, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.pathologyLabel}</span>
                    <span style={{ padding:'2px 7px', borderRadius:20, background:`${c}16`, color:c, fontSize:10, fontWeight:800, border:`1px solid ${c}22`, flexShrink:0 }}>
                      {p.cumulativeTriggerStrength} Σ
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', flexShrink:0 }}>
                    {(p.contributingDrugs || []).slice(0,3).map(d => (
                      <span key={d} style={{ padding:'3px 7px', borderRadius:20, background:'rgba(139,92,246,0.10)', color:'#c4b5fd', fontSize:10, fontWeight:700, border:'1px solid rgba(139,92,246,0.14)' }}>{d}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, height:6, overflow:'hidden', marginBottom:4 }}>
                  <div style={{ width:`${Math.min(100, p.cumulativeTriggerStrength * 35)}%`, height:'100%', background:`linear-gradient(90deg, ${c}88, ${c})`, borderRadius:20, transition:'width 0.5s', boxShadow:`0 0 8px ${c}55` }} />
                </div>
              </div>
            );
          })}

          <div style={card}>
            <div style={{ fontSize:11, fontWeight:800, marginBottom:4, color:'#fff', display:'flex', alignItems:'center', gap:6 }}>
              🧪 Требуемые биомаркеры <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>{mapperResult.requiredBiomarkers?.length ?? 0} шт</span>
            </div>
            <div style={{ fontSize:10, color:'#a78bfa', marginBottom:8, background:'rgba(139,92,246,0.06)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(139,92,246,0.10)' }}>
              Зелёные — есть в анализах, серые — нужно сдать
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(mapperResult.requiredBiomarkers || []).map(m => {
                const has = markerInLabs(m);
                return (
                  <span key={m} style={{
                    padding:'5px 9px', borderRadius:20, fontSize:10, fontWeight:700,
                    background: has ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)',
                    color: has ? '#00e68a' : 'rgba(255,255,255,0.52)',
                    border:`1px solid ${has ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.06)'}`,
                  }}>{has ? '✓ ' : '○ '}{m}</span>
                );
              })}
            </div>
          </div>

          {(mapperResult.unknownDrugs?.length ?? 0) > 0 && (
            <div style={{ ...card, borderLeft:'3px solid #f59e0b', background:'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))' }}>
              <div style={{ fontSize:11, color:'#fbbf24', fontWeight:800 }}>
                Неизвестные препараты: {(mapperResult.unknownDrugs || []).join(', ')}
              </div>
              <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>
                Отсутствуют в графе знаний — исключены из расчёта. Проверь написание.
              </div>
            </div>
          )}
        </>
      )}

      {clinicalResult?.results?.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#ec4899', letterSpacing:0.3, textTransform:'uppercase' as const }}>🏥 Клинические патологии ({clinicalResult.results.length})</div>

          <div style={{ ...card,
            background: (clinicalResult.overallMaxRisk ?? 0) >= 80 ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))' :
              (clinicalResult.overallMaxRisk ?? 0) >= 50 ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))' : 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,230,138,0.02))',
            borderLeft:`3px solid ${(clinicalResult.overallMaxRisk ?? 0) >= 80 ? '#ef4444' : (clinicalResult.overallMaxRisk ?? 0) >= 50 ? '#f59e0b' : '#00e68a'}`,
          }}>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.4, fontWeight:600 }}>{clinicalResult.summary}</div>
            <div style={{ display:'flex', gap:8, marginTop:8, fontSize:10, color:'#fff', flexWrap:'wrap' }}>
              <span style={{ background:'rgba(0,0,0,0.18)', padding:'3px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>🧪 {clinicalResult.markersAnalyzed ?? 0} маркеров</span>
              <span style={{ background:'rgba(0,0,0,0.18)', padding:'3px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>📋 {clinicalResult.requiredLabPanel?.length ?? 0} в панели</span>
              <span style={{ background:'rgba(0,0,0,0.18)', padding:'3px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>🔬 {clinicalResult.requiredInstrumental?.length ?? 0} иссл.</span>
            </div>
          </div>

          {(clinicalResult.systems || []).map((system: any) => (
            <details key={system?.systemKey || Math.random()} style={{ ...card, padding:0, overflow:'hidden' }}>
              <summary style={{
                padding:'10px 12px', cursor:'pointer',
                background:'linear-gradient(90deg, rgba(255,255,255,0.03), transparent)',
                fontSize:11, fontWeight:800, listStyle:'none',
                display:'flex', alignItems:'center', gap:7, color:'#fff',
              }}>
                <span>{system?.icon || ''} {system?.systemName || ''}</span>
                <span style={{
                  marginLeft:'auto', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:800,
                  background: (system?.maxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.14)' :
                    (system?.maxRisk ?? 0) >= 50 ? 'rgba(245,158,11,0.14)' : 'rgba(0,230,138,0.12)',
                  color: (system?.maxRisk ?? 0) >= 80 ? '#f87171' : (system?.maxRisk ?? 0) >= 50 ? '#fbbf24' : '#00e68a',
                  border:`1px solid ${(system?.maxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.18)' : (system?.maxRisk ?? 0) >= 50 ? 'rgba(245,158,11,0.18)' : 'rgba(0,230,138,0.18)'}`,
                }}>{Math.round(system?.maxRisk ?? 0)}%</span>
                <span style={{ fontSize:10, color:'#fff' }}>({(system?.pathologies?.length ?? 0)})</span>
              </summary>
              <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:6 }}>
                {(system?.pathologies || []).map((r: any) => {
                  const zoneColor = (r?.alertLevel ?? 0) >= 3 ? '#ef4444' : (r?.alertLevel ?? 0) >= 2 ? '#f59e0b' : (r?.alertLevel ?? 0) >= 1 ? '#eab308' : '#22c55e';
                  return (
                    <div key={r?.pathologyId || Math.random()} style={{
                      padding:'8px 10px', borderRadius:11,
                      background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.05)', borderLeft:`3px solid ${zoneColor}`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:11, color:'#fff' }}>{r?.pathologyName || ''}</span>
                        <span style={{ padding:'2px 7px', borderRadius:20, background:`${zoneColor}16`, color:zoneColor, fontWeight:800, fontSize:10, border:`1px solid ${zoneColor}22`, whiteSpace:'nowrap' }}>
                          {(r?.riskPercent ?? 0)}% — {(r?.status || '').split('(')[0].trim()}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:6, fontSize:10, color:'#fff', flexWrap:'wrap' }}>
                        <span>Hill: {r?.hillScore ?? '—'}</span>
                        <span>MC95: {r?.severity95 ?? '—'}</span>
                        {(r?.contributingCompounds?.length ?? 0) > 0 && (
                          <span>Препараты: {(r?.contributingCompounds || []).join(', ')}</span>
                        )}
                      </div>
                      {(r?.alertLevel ?? 0) >= 2 && r?.instrumental && (
                        <div style={{ marginTop:6, fontSize:10, color:'#fbbf24', background:'rgba(245,158,11,0.08)', padding:'5px 8px', borderRadius:8, border:'1px solid rgba(245,158,11,0.12)' }}>
                          🔬 {r?.instrumental}
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
        <div style={{ ...card, textAlign:'center', padding:24, borderStyle:'dashed', background:'rgba(22,22,26,0.32)' }}>
          <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.14)', fontSize:20 }}>🧬</div>
          <div style={{ fontSize:12, color:'#fff', fontWeight:600 }}>{course.length > 0 ? 'Нажми «Запустить маппинг» — увидишь патологии и маркеры' : 'Добавь препараты в курс или вручную — затем запусти маппинг'}</div>
        </div>
      )}
    </div>
  );
};
