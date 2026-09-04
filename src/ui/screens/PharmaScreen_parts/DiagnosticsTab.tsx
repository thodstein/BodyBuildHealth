import React, { useState, useEffect, useMemo } from 'react';
import { runAdvancedDiagnostics, ESTER_HALF_LIFE_DAYS } from '../../../engines/advanced-diagnostics.engine';
import type { DrugDoseInput, VitalsInput, AdvancedDiagnosticsResult } from '../../../engines/advanced-diagnostics.engine';
import { useDataLink } from '../../../core/data-link';

export const DiagnosticsTab: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const profile = linked.profile;

  const [diagDrugs, setDiagDrugs] = useState<DrugDoseInput[]>([]);
  const [useCourseDrugs, setUseCourseDrugs] = useState(true);

  const [manName, setManName] = useState('');
  const [manEster, setManEster] = useState('enanthate');
  const [manMg, setManMg] = useState(250);
  const [manFreq, setManFreq] = useState(2);

  const [hrv, setHrv] = useState(55);
  const [rhr, setRhr] = useState(62);
  const [bpSys, setBpSys] = useState(125);
  const [bpDia, setBpDia] = useState(80);

  const s = profile?.settings;
  const dob = s?.dateOfBirth ? new Date(s.dateOfBirth) : null;
  const calcAge = dob ? Math.floor((Date.now() - dob.getTime()) / 31556952000) : 30;
  const [age, setAge] = useState(calcAge);
  const [has19Nor, setHas19Nor] = useState(false);

  const [result, setResult] = useState<AdvancedDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const esterOptions = Object.keys(ESTER_HALF_LIFE_DAYS);

  useEffect(() => {
    if (useCourseDrugs && course.length > 0) {
      const mapped: DrugDoseInput[] = course.map((c: any) => {
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

  const SEV_COLORS: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b' };
  const card: React.CSSProperties = { background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:14, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' };

  return (
    <div className="pharma-diag" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(139,92,246,0.06))', border:'1px solid rgba(239,68,68,0.14)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.18)', fontSize:12 }}>🔬</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>5-Engine Advanced Diagnostics</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.45 }}>
          PK/PD · Конфликты · Виталы · BioAge · ПКТ-таймер — полный чек курса по 5 движкам. Подставь виталы и запусти.
        </div>
      </div>

      <div style={card}>
        <div style={{ display:'flex', gap:7, marginBottom:10 }}>
          <button onClick={() => setUseCourseDrugs(true)} style={{
            flex:1, padding:'9px 10px', borderRadius:11, fontSize:12, fontWeight:800, cursor:'pointer',
            border:`1px solid ${useCourseDrugs ? 'rgba(139,92,246,0.32)' : 'rgba(255,255,255,0.07)'}`,
            background: useCourseDrugs ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.04)', color: useCourseDrugs ? '#fff' : 'rgba(255,255,255,0.62)',
          }}>
            💊 Из курса ({course.length})
          </button>
          <button onClick={() => setUseCourseDrugs(false)} style={{
            flex:1, padding:'9px 10px', borderRadius:11, fontSize:12, fontWeight:800, cursor:'pointer',
            border:`1px solid ${!useCourseDrugs ? 'rgba(139,92,246,0.32)' : 'rgba(255,255,255,0.07)'}`,
            background: !useCourseDrugs ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.04)', color: !useCourseDrugs ? '#fff' : 'rgba(255,255,255,0.62)',
          }}>
            ✏️ Вручную ({diagDrugs.length})
          </button>
        </div>

        {!useCourseDrugs && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
            <input value={manName} onChange={e => setManName(e.target.value)} placeholder="Название" style={{ flex:'1 1 110px', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:600, outline:'none' }} />
            <select value={manEster} onChange={e => setManEster(e.target.value)} style={{ flex:'1 1 120px', padding:'8px 8px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, fontWeight:600, outline:'none' }}>
              {esterOptions.map(e => (<option key={e} value={e} style={{ background:'#1a1a1f' }}>{e} ({ESTER_HALF_LIFE_DAYS[e]}д)</option>))}
            </select>
            <input type="number" value={manMg} onChange={e => setManMg(parseFloat(e.target.value) || 0)} placeholder="мг/нед" style={{ width:78, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, outline:'none' }} />
            <input type="number" value={manFreq} onChange={e => setManFreq(parseFloat(e.target.value) || 0)} placeholder="×/нед" style={{ width:64, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, outline:'none' }} />
            <button onClick={addManual} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid rgba(139,92,246,0.22)', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>+</button>
          </div>
        )}

        {diagDrugs.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
            {diagDrugs.map((d, i) => (
              <span key={i} onClick={() => removeDrug(i)} style={{
                padding:'6px 9px', borderRadius:20, background:'rgba(139,92,246,0.12)', color:'#c4b5fd',
                fontSize:11, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(139,92,246,0.18)',
              }}>
                {d.name} <span style={{ background:'rgba(0,0,0,0.18)', padding:'1px 6px', borderRadius:10, fontSize:10 }}>{d.ester}</span> {d.mgPerWeek}мг {d.injectionsPerWeek}×/нед ✕
              </span>
            ))}
          </div>
        )}
        {diagDrugs.length===0 && <div style={{ fontSize:11, color:'#fff', textAlign:'center', padding:8, background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px dashed rgba(255,255,255,0.06)' }}>Добавь препараты — из курса или вручную</div>}
      </div>

      <div style={card}>
        <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:20, height:20, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.12)', fontSize:11 }}>❤️</span> Витальные показатели
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>HRV (мс)</label>
            <input type="number" value={hrv} onChange={e => setHrv(parseFloat(e.target.value) || 0)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>RHR (уд/мин)</label>
            <input type="number" value={rhr} onChange={e => setRhr(parseFloat(e.target.value) || 0)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>АД сист.</label>
            <input type="number" value={bpSys} onChange={e => setBpSys(parseFloat(e.target.value) || 0)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>АД диаст.</label>
            <input type="number" value={bpDia} onChange={e => setBpDia(parseFloat(e.target.value) || 0)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>Возраст</label>
            <input type="number" value={age} onChange={e => setAge(parseFloat(e.target.value) || 0)}
              style={{ width:96, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#fff', cursor:'pointer', marginTop:18, background:'rgba(239,68,68,0.08)', padding:'7px 10px', borderRadius:10, border:'1px solid rgba(239,68,68,0.14)' }}>
            <input type="checkbox" checked={has19Nor} onChange={e => setHas19Nor(e.target.checked)} style={{ accentColor:'#ef4444', width:16, height:16 }} />
            19-nor в анамнезе
          </label>
        </div>
      </div>

      <button onClick={handleRun} disabled={diagDrugs.length === 0 || loading} style={{
        width:'100%', padding:'13px 0', borderRadius:14, border:'1px solid rgba(239,68,68,0.22)', cursor: diagDrugs.length === 0 ? 'not-allowed' : 'pointer',
        background: diagDrugs.length === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #ef4444, #8b5cf6)',
        color:'#fff', fontWeight:800, fontSize:14, opacity: diagDrugs.length === 0 ? 0.5 : 1, boxShadow: diagDrugs.length ? '0 8px 20px rgba(239,68,68,0.18)' : 'none',
      }}>
        {loading ? '⏳ Анализ...' : '🔍 Запустить диагностику'}
        <span style={{ fontSize:10, display:'block', fontWeight:600, opacity:0.82, marginTop:2 }}>
          PK/PD + Взаимодействия + Виталы + BioAge + ПКТ-таймер
        </span>
      </button>

      {result && (
        <>
          <div style={{ ...card,
            background: result.summary.startsWith('✅') ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,230,138,0.03))' : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
            borderLeft:`3px solid ${result.summary.startsWith('✅') ? '#00e68a' : '#ef4444'}`,
          }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:4, letterSpacing:0.3, textTransform:'uppercase' as const }}>Итоговая оценка</div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.45, fontWeight:600 }}>{result.summary}</div>
          </div>

          <div style={card}>
            <div style={{ fontSize:12, fontWeight:800, color:'#60a5fa', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>1. PK/PD — концентрации и качели <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>{result.pkpd.length} преп.</span></div>
            {result.pkpd.map((r, i) => (
              <div key={i} style={{
                marginBottom:8, padding:'10px', borderRadius:12,
                background: r.hormonalSwingFlag ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))' : 'rgba(0,0,0,0.18)',
                border:`1px solid ${r.hormonalSwingFlag ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:800, fontSize:12, color:'#fff' }}>{r.drugName} <span style={{ fontWeight:600, color:'#fff', fontSize:11 }}>[{r.ester}]</span></span>
                  <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>T½ {r.halfLifeDays} дн</span>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  <div style={{ flex:1, textAlign:'center', padding:'6px 4px', background:'rgba(0,230,138,0.08)', borderRadius:9, border:'1px solid rgba(0,230,138,0.12)' }}>
                    <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>Пик</div><div style={{ fontSize:13, fontWeight:800, color:'#00e68a' }}>{r.peakConcMg}</div>
                  </div>
                  <div style={{ flex:1, textAlign:'center', padding:'6px 4px', background:'rgba(59,130,246,0.08)', borderRadius:9, border:'1px solid rgba(59,130,246,0.12)' }}>
                    <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>Спад</div><div style={{ fontSize:13, fontWeight:800, color:'#60a5fa' }}>{r.troughConcMg}</div>
                  </div>
                  <div style={{ flex:1, textAlign:'center', padding:'6px 4px', background: r.hormonalSwingFlag ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', borderRadius:9, border:`1px solid ${r.hormonalSwingFlag ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>Δ</div><div style={{ fontSize:13, fontWeight:800, color: r.hormonalSwingFlag ? '#f87171' : 'rgba(255,255,255,0.72)' }}>{r.peakTroughDeltaPct}%</div>
                  </div>
                </div>
                {r.hormonalSwingFlag && (
                  <div style={{ marginTop:8, fontSize:11, color:'#f87171', fontWeight:700, background:'rgba(239,68,68,0.10)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(239,68,68,0.16)', textAlign:'center' }}>
                    🔴 Качели! Увеличь частоту инъекций — сгладишь пик/провал
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.interactions.length > 0 ? (
            <div style={card}>
              <div style={{ fontSize:12, fontWeight:800, color:'#f87171', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>2. Конфликты <span style={{ background:'rgba(239,68,68,0.12)', padding:'2px 7px', borderRadius:20, fontSize:10, color:'#f87171', border:'1px solid rgba(239,68,68,0.16)' }}>{result.interactions.length}</span></div>
              {result.interactions.map((r, i) => (
                <div key={i} style={{
                  marginBottom:6, padding:'10px', borderRadius:12,
                  background:'rgba(239,68,68,0.06)', borderLeft:`3px solid ${SEV_COLORS[r.severity]}`, borderTop:'1px solid rgba(255,255,255,0.04)', borderRight:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontSize:10, fontWeight:800, color: SEV_COLORS[r.severity], letterSpacing:0.3 }}>{r.severity.toUpperCase()} — {r.drugsInvolved.join(' + ')}</div>
                  <div style={{ fontSize:11, marginTop:4, color:'#fff', lineHeight:1.4, fontWeight:600 }}>{r.message}</div>
                  <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>{r.mechanism}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, textAlign:'center', padding:12 }}>
              <div style={{ fontSize:11, color:'#00e68a', fontWeight:700 }}>✅ Конфликтов не обнаружено</div>
            </div>
          )}

          <div style={card}>
            <div style={{ fontSize:12, fontWeight:800, color:'#fbbf24', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>3. Витальные показатели</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, fontSize:11 }}>
              <div style={{ textAlign:'center', padding:'8px 4px', background:'rgba(0,0,0,0.18)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>HRV</div><div style={{ fontWeight:800, fontSize:13, color: result.vitals.hrv < 35 ? '#f87171' : '#a78bfa' }}>{result.vitals.hrv} мс</div>
              </div>
              <div style={{ textAlign:'center', padding:'8px 4px', background:'rgba(0,0,0,0.18)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>RHR</div><div style={{ fontWeight:800, fontSize:13, color: result.vitals.rhr > 75 ? '#f87171' : '#a78bfa' }}>{result.vitals.rhr}</div>
              </div>
              <div style={{ textAlign:'center', padding:'8px 4px', background:'rgba(0,0,0,0.18)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:9, color:'#fff', fontWeight:700 }}>АД</div><div style={{ fontWeight:800, fontSize:13, color: result.vitals.bpSys > 140 || result.vitals.bpDia > 90 ? '#f87171' : '#a78bfa' }}>{result.vitals.bpSys}/{result.vitals.bpDia}</div>
              </div>
            </div>
            {result.vitals.alerts.length > 0 ? (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:5 }}>
                {result.vitals.alerts.map((a, i) => (
                  <div key={i} style={{ fontSize:11, color:'#fbbf24', padding:'6px 8px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.14)', borderRadius:9 }}>⚠ {a}</div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop:8, fontSize:11, color:'#00e68a', fontWeight:700, textAlign:'center', background:'rgba(0,230,138,0.08)', padding:'6px 8px', borderRadius:9, border:'1px solid rgba(0,230,138,0.14)' }}>✅ Витальные показатели в норме</div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize:12, fontWeight:800, color:'#c4b5fd', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>4. BioAge — биологическое старение</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, textAlign:'center' }}>
              <div style={{ background:'rgba(0,0,0,0.18)', borderRadius:12, padding:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:10, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Хронологический</div>
                <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginTop:2 }}>{result.bioage.chronologicalAge}</div>
              </div>
              <div style={{ background: result.bioage.ageAcceleration > 2 ? 'rgba(239,68,68,0.08)' : 'rgba(0,230,138,0.08)', borderRadius:12, padding:'10px', border:`1px solid ${result.bioage.ageAcceleration > 2 ? 'rgba(239,68,68,0.14)' : 'rgba(0,230,138,0.14)'}` }}>
                <div style={{ fontSize:10, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Биологический</div>
                <div style={{ fontSize:24, fontWeight:900, color: result.bioage.ageAcceleration > 2 ? '#f87171' : '#00e68a', marginTop:2 }}>
                  {result.bioage.biologicalAge}
                </div>
              </div>
            </div>
            <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:10, color:'#fff' }}>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'6px 6px', borderRadius:8, textAlign:'center', border:'1px solid rgba(255,255,255,0.04)' }}>АД-штраф <b style={{ color:'#fff' }}>+{result.bioage.bpPenalty}</b></div>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'6px 6px', borderRadius:8, textAlign:'center', border:'1px solid rgba(255,255,255,0.04)' }}>HRV-штраф <b style={{ color:'#fff' }}>+{result.bioage.hrvPenalty}</b></div>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'6px 6px', borderRadius:8, textAlign:'center', border:'1px solid rgba(255,255,255,0.04)' }}>Токс. <b style={{ color:'#fff' }}>+{result.bioage.toxicLoadPenalty}</b></div>
            </div>
            <div style={{ marginTop:8, fontSize:11, fontWeight:800, color: result.bioage.ageAcceleration > 2 ? '#fbbf24' : '#00e68a', textAlign:'center', background: result.bioage.ageAcceleration > 2 ? 'rgba(245,158,11,0.08)' : 'rgba(0,230,138,0.08)', padding:'6px 8px', borderRadius:9, border:`1px solid ${result.bioage.ageAcceleration>2?'rgba(245,158,11,0.14)':'rgba(0,230,138,0.14)'}` }}>
              {result.bioage.agingRate}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize:12, fontWeight:800, color:'#f472b6', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>5. ПКТ-таймер и HPTA рестарт</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ textAlign:'center', background:'rgba(236,72,153,0.08)', borderRadius:12, padding:'10px', border:'1px solid rgba(236,72,153,0.14)' }}>
                <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Начало ПКТ</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#f472b6' }}>День {result.pctReboot.pctStartDay}</div>
                <div style={{ fontSize:10, color:'#fff' }}>
                  {result.pctReboot.longestHalfLifeDrug} (T½ {result.pctReboot.longestHalfLifeDays}д)
                </div>
              </div>
              <div style={{ textAlign:'center', background: result.pctReboot.rebootSuccessProbability >=70 ? 'rgba(0,230,138,0.08)' : result.pctReboot.rebootSuccessProbability >=40 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', borderRadius:12, padding:'10px', border:`1px solid ${result.pctReboot.rebootSuccessProbability>=70?'rgba(0,230,138,0.14)':result.pctReboot.rebootSuccessProbability>=40?'rgba(245,158,11,0.14)':'rgba(239,68,68,0.14)'}` }}>
                <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Вероятность ребута</div>
                <div style={{ fontSize:22, fontWeight:900, color: result.pctReboot.rebootSuccessProbability >= 70 ? '#00e68a' : result.pctReboot.rebootSuccessProbability >= 40 ? '#fbbf24' : '#f87171' }}>
                  {result.pctReboot.rebootSuccessProbability}%
                </div>
                <div style={{ fontSize:10, color:'#f87171', fontWeight:700 }}>
                  {result.pctReboot.has19Nor ? '19-nor −40%' : 'без 19-nor'}
                </div>
              </div>
            </div>
            <div style={{
              padding:'9px 10px', borderRadius:10, fontSize:11, lineHeight:1.45, fontWeight:600,
              background:'rgba(236,72,153,0.06)', borderLeft:'3px solid #ec4899', borderTop:'1px solid rgba(255,255,255,0.04)', borderRight:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)', color:'#fff',
            }}>
              {result.pctReboot.recommendation}
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div style={{ ...card, textAlign:'center', padding:24, borderStyle:'dashed', background:'rgba(22,22,26,0.32)' }}>
          <div style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.14)', fontSize:18 }}>🔬</div>
          <div style={{ fontSize:12, color:'#fff', fontWeight:600, lineHeight:1.4 }}>
            {diagDrugs.length > 0
              ? 'Нажми «Запустить диагностику» — получишь разбор по 5 движкам'
              : 'Добавь препараты из курса или вручную — затем запусти анализ'}
          </div>
        </div>
      )}
    </div>
  );
};
