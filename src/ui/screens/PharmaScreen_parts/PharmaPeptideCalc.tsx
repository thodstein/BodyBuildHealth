import React, { useState, useMemo } from 'react';
import { PopupNumber, PopupSelect } from '../../components/PopupXxx';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES,
} from '../../../engines/peptide-calculator.engine';
import { CLASS_LABELS } from './constants';

export const PharmaPeptideCalc: React.FC = () => {
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [pepAmount, setPepAmount] = useState(2);
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepSyringe, setPepSyringe] = useState<string>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Пн', 'Ср', 'Пт']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  const WEEK_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const scheduleEn = pepSchedule.map(d => WEEK_EN[WEEK_RU.indexOf(d)] || d);

  const dilution = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p) return null;
    return computeDilution({
      amountValue: pepAmount, amountUnit: 'mg',
      dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: 'mcg',
      syringeType: pepSyringe as any,
    });
  }, [peptideId, pepAmount, pepDilution, pepDose, pepSyringe]);

  const bio = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p || !dilution) return null;
    const b = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    return computeEffectiveDose(dilution.doseMcg, b);
  }, [peptideId, pepRoute, dilution]);

  const pk = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p || !dilution) return null;
    const b = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    return computePK({
      doseMcg: dilution.doseMcg, bioAvg: b.avg,
      tHalfHours: p.tHalfHours, scheduleDays: scheduleEn, totalDays: pepTotalDays,
    });
  }, [peptideId, pepRoute, dilution, pepSchedule, pepTotalDays]);

  const sel = PEPTIDE_DB[peptideId];
  const growthSel = growthId ? getPharmaDetail(growthId) : null;
  const GROWTH_CLASSES = new Set(['peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin', 'peptide_gnrh', 'peptide_fat_loss', 'peptide_other']);
  const growthSubstances = useMemo(() => {
    const inPeptideDb = new Set(PEPTIDE_LIST.map(p => (PEPTIDE_DB[p.id]?.name || '').toLowerCase()));
    return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has((s.name || '').toLowerCase()));
  }, []);

  const cardStyle: React.CSSProperties = { background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:14, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(59,130,246,0.06))', border:'1px solid rgba(167,139,250,0.16)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(167,139,250,0.14)', border:'1px solid rgba(167,139,250,0.18)', fontSize:12 }}>🧬</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Пептидный калькулятор</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.52)', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>{PEPTIDE_LIST.length} пептидов</span>
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.62)', marginTop:6, lineHeight:1.45 }}>Разведение, биодоступность, PK-модель, риски и синергии. Выбери пептид — всё пересчитается.</div>
      </div>

      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>🧪 Пептид / фактор роста</span>
          {sel && <span style={{ marginLeft:'auto', fontSize:10, color:'#a78bfa', background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.14)', padding:'2px 7px', borderRadius:20, fontWeight:700 }}>{sel.shortName || sel.name}</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {PEPTIDE_LIST.map((p: any) => (
            <button key={p.id} onClick={() => { setPeptideId(p.id); setGrowthId(null); setPepAmount(p.amountMg || 2); setPepRoute(p.routes?.[0] || 'sc'); setPepProtocol(null); }} style={{
              padding:'6px 11px', borderRadius:20, fontSize:11, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer',
              background: peptideId === p.id && !growthId ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)' : 'rgba(255,255,255,0.05)',
              color: peptideId === p.id && !growthId ? '#fff' : 'rgba(255,255,255,0.62)',
              border:`1px solid ${peptideId === p.id && !growthId ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: peptideId===p.id && !growthId ? '0 4px 12px rgba(139,92,246,0.18)' : 'none',
            }}>{p.name}</button>
          ))}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {growthSubstances.slice(0,18).map((s: any) => {
            const selG = growthId === s.id;
            return (
              <button key={s.id} onClick={() => { setGrowthId(s.id); setPeptideId(''); setPepProtocol(null); }} style={{
                padding:'5px 9px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                background: selG ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.04)',
                color: selG ? '#fff' : 'rgba(255,255,255,0.52)',
                border:`1px solid ${selG ? 'rgba(139,92,246,0.32)' : 'rgba(255,255,255,0.06)'}`,
              }}>{s.name}</button>
            );
          })}
        </div>

        {sel && (
          <div style={{ marginTop:10, padding:'11px', borderRadius:12, background:'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(167,139,250,0.03))', border:'1px solid rgba(167,139,250,0.14)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#c4b5fd', marginBottom:4 }}>{sel.name || sel.shortName}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.62)', lineHeight:1.4 }}><b style={{ color:'rgba(255,255,255,0.84)' }}>Эффекты:</b> {(sel.effects || []).join(', ') || '—'}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.52)', marginTop:4, display:'flex', gap:10, flexWrap:'wrap' }}>
              <span><b style={{ color:'#a78bfa' }}>T½</b> {sel.tHalfHours || '—'} ч</span>
              <span><b style={{ color:'#a78bfa' }}>Класс</b> {sel.className || '—'}</span>
              <span><b style={{ color:'#a78bfa' }}>Пути</b> {(sel.routes || []).map((r: any) => ROUTE_LABELS[r] || r).join(', ') || '—'}</span>
            </div>
            {(sel.mechanisms || []).length>0 && <div style={{ fontSize:10, color:'rgba(255,255,255,0.58)', marginTop:6 }}><b style={{ color:'#c4b5fd' }}>Механизмы:</b> {(sel.mechanisms || []).join(', ')}</div>}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, fontSize:10 }}>
              <span style={{ background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 8px', borderRadius:20, color:'rgba(255,255,255,0.62)' }}><b style={{ color:'rgba(255,255,255,0.84)' }}>Во флаконе</b> {sel.amountMg || '—'} мг</span>
              <span style={{ background: sel.riskLevel==='high'?'rgba(239,68,68,0.10)': sel.riskLevel==='medium'?'rgba(245,158,11,0.10)':'rgba(34,197,94,0.10)', border:`1px solid ${sel.riskLevel==='high'?'rgba(239,68,68,0.16)': sel.riskLevel==='medium'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.16)'}`, padding:'3px 8px', borderRadius:20, color: sel.riskLevel==='high'?'#f87171': sel.riskLevel==='medium'?'#fbbf24':'#4ade80', fontWeight:700 }}>
                Риск: {sel.riskLevel==='high'?'Высокий': sel.riskLevel==='medium'?'Средний': sel.riskLevel==='low'?'Низкий':'—'}
              </span>
            </div>
            {(sel.riskNotes || []).length>0 && <div style={{ fontSize:10, color:'#fbbf24', marginTop:6, background:'rgba(245,158,11,0.08)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(245,158,11,0.12)' }}>⚠ {(sel.riskNotes || []).slice(0,2).join(' • ')}</div>}
          </div>
        )}
        {growthId && growthSel && (
          <div style={{ marginTop:10, padding:'11px', borderRadius:12, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.14)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#c4b5fd', marginBottom:6 }}>{growthSel.name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11, color:'rgba(255,255,255,0.62)', lineHeight:1.4 }}>
              <span><b style={{ color:'#a78bfa' }}>Класс</b> {CLASS_LABELS[growthSel.class] || growthSel.class}</span>
              <span><b style={{ color:'#a78bfa' }}>T½</b> {growthSel.pk?.halfLifeHours ? `${(growthSel.pk.halfLifeHours).toFixed(0)} ч` : '—'}</span>
              <span><b style={{ color:'#a78bfa' }}>Биодост.</b> {growthSel.pk?.bioavailability ? `${(growthSel.pk.bioavailability * 100).toFixed(0)}%` : '—'}</span>
              <span><b style={{ color:'#a78bfa' }}>Vd</b> {growthSel.pk?.Vd ? `${growthSel.pk.Vd} л` : '—'}</span>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
          <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.18)', fontSize:11 }}>💧</span>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Калькулятор разведения</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <PopupNumber label="💊 Кол-во пептида" value={pepAmount} min={0.1} max={100} step={0.1} suffix="мг" onChange={v => setPepAmount(Math.max(0.1, v))} />
          <PopupNumber label="💧 Объём бака" value={pepDilution} min={0.1} max={50} step={0.1} suffix="мл" onChange={v => setPepDilution(Math.max(0.1, v))} />
          <PopupNumber label="💉 Дозировка" value={pepDose} min={1} max={10000} step={10} suffix="мкг" onChange={v => setPepDose(Math.max(1, v))} />
          <PopupSelect label="💉 Шприц" value={pepSyringe} options={Object.entries(SYRINGE_TYPES).map(([k, v]: [any, any]) => ({ id: k, label: v.label }))} onChange={v => setPepSyringe(v as string)} />
          <div style={{ gridColumn:'1 / -1' }}>
            <PopupSelect label="🩹 Путь введения" value={pepRoute} options={Object.entries(ROUTE_LABELS).map(([k, v]) => ({ id: k, label: v }))} onChange={v => setPepRoute(v)} />
          </div>
        </div>
        {dilution && (
          <div style={{ marginTop:10, padding:'11px', borderRadius:12, background:'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))', border:'1px solid rgba(59,130,246,0.14)' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.52)', marginBottom:6, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Результат разведения</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Конц. <b style={{ color:'#60a5fa' }}>{dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</b></div>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Объём <b style={{ color:'#60a5fa' }}>{dilution.doseVolumeMl.toFixed(3)} мл</b></div>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Единиц <b style={{ color:'#60a5fa' }}>{dilution.syringeUnitsDisplay}</b></div>
              <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Доз/флакон <b style={{ color:'#60a5fa' }}>{dilution.dosesPerVial.toFixed(1)}</b></div>
            </div>
          </div>
        )}
      </div>

      {pk && (
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
            <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.18)', fontSize:11 }}>📈</span>
            <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Фармакокинетика (PK)</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'#a78bfa', background:'rgba(167,139,250,0.10)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(167,139,250,0.14)' }}>T½ {sel ? sel.tHalfHours.toFixed(1) : '—'} ч</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            {[
              { l:'Cmax', v: pk.maxConcentration.toFixed(1) },
              { l:'Средняя', v: pk.avgConcentration.toFixed(1) },
              { l:'Steady-state', v:`~${pk.steadyStateDay} дн` },
              { l:'T½ (введёно)', v: sel ? `${sel.tHalfHours.toFixed(1)} ч` : '—' },
            ].map(c=>(
              <div key={c.l} style={{ padding:'10px', borderRadius:11, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.10)', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.52)', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>{c.l}</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#c4b5fd', marginTop:2 }}>{c.v}</div>
              </div>
            ))}
          </div>
          {pk.days.length > 0 && (
            <div style={{ marginTop:10, maxHeight:140, overflowY:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, background:'rgba(0,0,0,0.16)' }}>
              <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.04)', position:'sticky', top:0 }}>
                    <th style={{ padding:'6px 8px', textAlign:'left', color:'rgba(255,255,255,0.62)', fontSize:10 }}>День</th>
                    <th style={{ padding:'6px 8px', color:'rgba(255,255,255,0.62)' }}>💉</th>
                    <th style={{ padding:'6px 8px', textAlign:'right', color:'rgba(255,255,255,0.62)' }}>Конц.</th>
                  </tr>
                </thead>
                <tbody>
                  {pk.days.slice(0,60).map(d => (
                    <tr key={d.day} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: d.inject ? 'rgba(167,139,250,0.06)' : 'transparent' }}>
                      <td style={{ padding:'5px 8px', color:'rgba(255,255,255,0.72)', fontWeight:600 }}>{d.day}</td>
                      <td style={{ padding:'5px 8px', textAlign:'center' }}>{d.inject ? '💉' : ''}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'monospace', color:'#c4b5fd', fontWeight:700 }}>{d.concentration.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {bio && (
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
            <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.18)', fontSize:11 }}>💉</span>
            <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Биодоступность <span style={{ color:'rgba(255,255,255,0.42)', fontWeight:600 }}>· {ROUTE_LABELS[pepRoute] || pepRoute}</span></span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7 }}>
            {[
              { l:'Мин', v: bio.effectiveMinMcg.toFixed(0), bg:'rgba(34,197,94,0.06)', border:'rgba(34,197,94,0.10)', c:'#86efac', fs:13 },
              { l:'Средняя', v: bio.effectiveAvgMcg.toFixed(0), bg:'rgba(34,197,94,0.10)', border:'rgba(34,197,94,0.16)', c:'#22c55e', fs:17 },
              { l:'Макс', v: bio.effectiveMaxMcg.toFixed(0), bg:'rgba(34,197,94,0.06)', border:'rgba(34,197,94,0.10)', c:'#86efac', fs:13 },
            ].map(b=>(
              <div key={b.l} style={{ padding:'10px', borderRadius:11, textAlign:'center', background:b.bg, border:`1px solid ${b.border}` }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.52)', fontWeight:700 }}>{b.l}</div>
                <div style={{ fontSize:b.fs, fontWeight:900, color:b.c, marginTop:2 }}>{b.v} <span style={{ fontSize:10 }}>мкг</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
          <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.18)', fontSize:11 }}>📅</span>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>График дозирования</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
          {WEEK_RU.map(day => {
            const active = pepSchedule.includes(day);
            return (
              <button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter(d => d !== day) : [...pepSchedule, day])} style={{
                padding:'7px 11px', borderRadius:10, fontSize:11, fontWeight:800, cursor:'pointer',
                background: active ? 'linear-gradient(135deg, #f59e0b, #e07b00)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                border:`1px solid ${active ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: active ? '0 4px 12px rgba(245,158,11,0.18)' : 'none',
              }}>{day}</button>
            );
          })}
        </div>
        <div style={{ marginBottom:10 }}>
          <PopupNumber label="📅 Длительность" value={pepTotalDays} min={1} max={365} step={1} suffix="дн" onChange={v => setPepTotalDays(Math.max(1, v))} />
        </div>
        <div style={{ padding:'10px 11px', borderRadius:12, background:'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', border:'1px solid rgba(245,158,11,0.14)' }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.52)', marginBottom:6, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Итого</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
            <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Доз/нед: <b style={{ color:'#fbbf24' }}>{pepSchedule.length}</b></div>
            <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Всего доз: <b style={{ color:'#fbbf24' }}>{Math.round(pepTotalDays / 7 * pepSchedule.length)}</b></div>
            <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Нед. расход: <b style={{ color:'#fbbf24' }}>{(pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
            <div style={{ background:'rgba(0,0,0,0.18)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>Общий: <b style={{ color:'#fbbf24' }}>{(pepTotalDays / 7 * pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
          </div>
        </div>
      </div>

      {sel && (
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
            <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.18)', fontSize:11 }}>⚠</span>
            <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Риски: {sel.shortName}</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {computePeptideRisks(sel).map((r: any, i: number) => (
              <div key={i} style={{
                padding:'6px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                background: r.riskPercent > 25 ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
                border:`1px solid ${r.riskPercent > 25 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`,
                color: r.riskPercent > 25 ? '#f87171' : '#fbbf24',
              }}>
                {r.label}: {r.riskPercent}%
              </div>
            ))}
          </div>
        </div>
      )}

      {sel && (
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
            <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.18)', fontSize:11 }}>🔗</span>
            <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Синергии и конфликты</span>
          </div>
          {getPeptideSynergiesFor(peptideId).length > 0 && (
            <div style={{ marginBottom:7, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#22c55e', fontWeight:800 }}>Синергии:</span>
              {getPeptideSynergiesFor(peptideId).map((s: any) => (
                <span key={s.partner} style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.16)', color:'#86efac', fontWeight:700 }}>{s.partnerName} +{s.strength}</span>
              ))}
            </div>
          )}
          {getPeptideConflictsFor(peptideId).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#ef4444', fontWeight:800 }}>Конфликты:</span>
              {getPeptideConflictsFor(peptideId).map((c: any) => (
                <span key={c.partner} style={{ fontSize:11, padding:'4px 8px', borderRadius:20, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.16)', color:'#fca5a5', fontWeight:700 }}>{c.partnerName} • {c.severity}</span>
              ))}
            </div>
          )}
          {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>Нет данных по комбинациям — проверь поддержку.</span>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
          <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.18)', fontSize:11 }}>🎯</span>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Генератор протокола по цели</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
          {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
            <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
              padding:'7px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:700,
              background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.18)', color:'#c4b5fd',
            }}>
              {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
            </button>
          ))}
        </div>
        {pepProtocol && (
          <div style={{ background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(139,92,246,0.04))', borderRadius:12, padding:11, border:'1px solid rgba(139,92,246,0.16)' }}>
            <div style={{ fontSize:11, fontWeight:800, marginBottom:7, color:'#c4b5fd', display:'flex', alignItems:'center', gap:6 }}>
              {pepProtocol.goal} <span style={{ background:'rgba(139,92,246,0.16)', padding:'2px 7px', borderRadius:20, fontSize:11, color:'#fff' }}>синергия {pepProtocol.synergyScore.toFixed(1)}</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {pepProtocol.peptides.map((p: any) => (
                <span key={p.id} style={{ fontSize:11, padding:'5px 9px', borderRadius:20, background:'rgba(139,92,246,0.16)', border:'1px solid rgba(139,92,246,0.22)', color:'#fff', fontWeight:700 }}>
                  {p.shortName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
