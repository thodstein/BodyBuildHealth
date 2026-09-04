import React, { useMemo, useState } from 'react';
import { planFrequency } from '../../../engines/pro/frequency-planner.engine';
import { velocityAttempts } from '../../../engines/lms/attempt-calculator.engine';
import { trafficLight } from '../../../engines/pro/training-load.engine';
import { fetchOPLHistory } from '../../../engines/openpowerlifting-import.engine';
import { dailyReadinessCheck, mvtForLift, velocityForPct, calibrateLVP, trainingMax } from '../../../engines/pro/vbt.engine';
import { avgIntensity, checkTonnageGate } from '../../../engines/lms/pl-tonnage-gate.engine';
import { dotsScore } from '../../../engines/pro/relative-strength.engine';
import type { VBTLift } from '../../../engines/pro/vbt.engine';

export const PLToolsCard: React.FC<{ level: string; days: number; totalSets: Record<string, number>; e1RM: Record<string, number>; hrvRatio?: number; acwr?: number; rpeDelta?: number; onApplyFrequency?: (plans: ReturnType<typeof planFrequency>[]) => void; plan?: { weeks: Array<{ week: number; days: Array<{ exercises: Array<{ workSets: Array<{ weight: number; reps: number; sets: number; pct: number }> }> }> }> } | null }> = ({ level, days, totalSets, e1RM, hrvRatio, acwr, rpeDelta, onApplyFrequency, plan }) => {
  const freqs = useMemo(() => Object.keys(totalSets).map(m => planFrequency(m, totalSets[m], days, level)), [totalSets, days, level]);
  const [lift, setLift] = useState<VBTLift>('squat');
  const attempts = useMemo(() => {
    const e = e1RM[lift] ?? 180;
    return velocityAttempts(e, lift, 'balanced');
  }, [e1RM, lift]);
  const light = useMemo(() => trafficLight(hrvRatio ?? null, acwr ?? 1.0, rpeDelta ?? 0), [hrvRatio, acwr, rpeDelta]);
  const [oplName, setOplName] = useState('');
  const [oplRes, setOplRes] = useState<string>('');
  const [vExp, setVExp] = useState(0.60);
  const [vAct, setVAct] = useState(0.55);
  const readiness = useMemo(() => dailyReadinessCheck(vExp, vAct), [vExp, vAct]);
  const [lvp60, setLvp60] = useState(0.85);
  const [lvp70, setLvp70] = useState(0.75);
  const [lvp80, setLvp80] = useState(0.60);
  const lvpCal = useMemo(() => calibrateLVP([{pct:0.6, velocity:lvp60},{pct:0.7, velocity:lvp70},{pct:0.8, velocity:lvp80}]), [lvp60, lvp70, lvp80]);
  const [compMax, setCompMax] = useState(200);

  return (
    <div className="pl-tools" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>🏋️ OpenPowerlifting импорт</span>
        <input value={oplName} onChange={e=>setOplName(e.target.value)} placeholder="Имя атлета" style={{ flex: 1, minWidth: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 10 }} />
        <button onClick={async()=>{ const r=await fetchOPLHistory(oplName); if(r.length){ try{ localStorage.setItem('he_opl_history', JSON.stringify(r)); localStorage.setItem('he_opl_name', oplName); }catch{} setOplRes(`Найдено ${r.length} стартов → сохранено в профиль, график DOTS обновится`); } else setOplRes(`Нет данных / не найдено`); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#a78bfa', color: '#000', border: 'none', cursor: 'pointer' }}>Найти</button>
        {oplRes && <span style={{ fontSize: 10, color: '#fff' }}>{oplRes}</span>}
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>📊 Frequency Planner (MEV/MRV)</div>
          <button onClick={() => onApplyFrequency?.(freqs)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#60a5fa', color: '#000', border: 'none', cursor: 'pointer' }}>Применить в план</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 6 }}>
          {freqs.map(f => (
            <div key={f.muscle} style={{ padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 10 }}>
              <b style={{ color: f.status === 'over' ? '#ef4444' : f.status === 'high' ? '#f59e0b' : '#22c55e' }}>{f.muscle} {f.totalSets}п/нед → {f.frequency}×</b>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>{f.perSession.join(' / ')} сеты</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{f.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>🏁 Attempt Calculator (velocity)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {(['squat','bench','deadlift'] as VBTLift[]).map(l => (
            <button key={l} onClick={() => setLift(l)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: l === lift ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)', background: l === lift ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', color: '#fff' }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, lineHeight: 1.5 }}>
          <div>Opener: <b>{attempts.opener.weight}кг</b> {attempts.opener.pct}% @ {attempts.opener.velocity} м/с — {attempts.opener.note}</div>
          <div>Second: <b>{attempts.second.weight}кг</b> {attempts.second.pct}% @ {attempts.second.velocity} м/с</div>
          <div>Third: <b>{attempts.third.weight}кг</b> {attempts.third.pct}% @ {attempts.third.velocity} м/с</div>
        </div>
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: light === 'red' ? 'rgba(239,68,68,0.15)' : light === 'yellow' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)', border: `1px solid ${light === 'red' ? '#ef4444' : light === 'yellow' ? '#f59e0b' : '#22c55e'}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: light === 'red' ? '#ef4444' : light === 'yellow' ? '#f59e0b' : '#22c55e' }}>🚦 Traffic Light: {light.toUpperCase()} (HRV {hrvRatio?.toFixed(2) ?? '—'}, ACWR {acwr?.toFixed(2) ?? '—'}, RPEΔ {rpeDelta ?? 0})</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>Green=как план, Yellow=осторожно (-10% объём), Red=делод</div>
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>⚡ VBT Daily Readiness (60% присед)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#fff' }}>Ожидаемо м/с</span>
          <input type="number" step={0.05} value={vExp} onChange={e=>setVExp(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 10 }} />
          <span style={{ fontSize: 10, color: '#fff' }}>Факт</span>
          <input type="number" step={0.05} value={vAct} onChange={e=>setVAct(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 10 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: readiness.action==='deload'?'#ef4444':readiness.action==='reduce-volume-20'?'#f59e0b':'#22c55e' }}>{readiness.dropPct}% → {readiness.action==='as-planned'?'как план':readiness.action==='reduce-volume-20'?' -20% объём':'делод'}</span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>MVT squat {mvtForLift('squat').toFixed(2)} м/с, bench {mvtForLift('bench').toFixed(2)} м/с | 60% squat ожидаемо {velocityForPct('squat',0.6).toFixed(2)} м/с</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>LVP 60%:</span><input type="number" step={0.05} value={lvp60} onChange={e=>setLvp60(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>70%:</span><input type="number" step={0.05} value={lvp70} onChange={e=>setLvp70(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>80%:</span><input type="number" step={0.05} value={lvp80} onChange={e=>setLvp80(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span style={{ color: lvpCal ? '#22c55e' : '#ef4444' }}>{lvpCal ? `R² ${lvpCal.r2.toFixed(2)} slope ${lvpCal.slope.toFixed(2)}` : 'нужно 3 точки'}</span>
          <button onClick={()=>{ if(lvpCal) localStorage.setItem('he_lv_profile_ss_v1', JSON.stringify({60:lvp60,70:lvp70,80:lvp80, slope:lvpCal.slope, intercept:lvpCal.intercept})); }} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, background: '#a78bfa', color: '#000', border: 'none', cursor: 'pointer' }}>Сохранить LVP</button>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>Соревн. макс</span><input type="number" value={compMax} onChange={e=>setCompMax(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>→ TM 90% = {trainingMax(compMax,0.90)}кг, 92% = {trainingMax(compMax,0.92)}кг (буфер Шейко)</span>
        </div>
      </div>
      {plan && (() => {
        const avg = avgIntensity(plan as never);
        const gates = checkTonnageGate(plan as never);
        const danger = gates.filter(g=>g.flag==='danger').length;
        const warn = gates.filter(g=>g.flag==='warn').length;
        const total = Object.values(e1RM).reduce((a,b)=>a+(b||0),0);
        const dots = total>0 ? dotsScore(total, 83, 'male') : 0;
        return (
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>📈 Sheiko Gate + DOTS</div>
            <div style={{ fontSize: 10, color: '#fff' }}>Средняя интенсивность: <b>{avg}%</b> {avg>=73 && avg<=77 ? <span style={{color:'#22c55e'}}>✓ Шейко-норма 75%</span> : <span style={{color:'#ef4444'}}>⚠ вне 75%±2%</span>} | Тоннаж гейт: {danger? <span style={{color:'#ef4444'}}>{danger}× danger</span> : warn? <span style={{color:'#f59e0b'}}>{warn}× warn</span> : <span style={{color:'#22c55e'}}>ок</span>}</div>
            <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Тотал e1RM {total}кг → DOTS <b>{dots}</b> (83кг male) {dots>=400 ? '— МС' : dots>=350 ? '— КМС' : ''}</div>
            {gates.filter(g=>g.flag!=='ok').slice(0,3).map(g=>(
              <div key={g.week} style={{ fontSize: 9, color: g.flag==='danger'?'#ef4444':'#f59e0b' }}>Нед {g.week}: {g.changePct}% {g.note}</div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};
