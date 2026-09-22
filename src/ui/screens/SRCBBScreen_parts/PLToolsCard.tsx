import React, { useMemo, useState } from 'react';
import { planFrequency } from '../../../engines/pro/frequency-planner.engine';
import { velocityAttempts } from '../../../engines/lms/attempt-calculator.engine';
import { trafficLight } from '../../../engines/pro/training-load.engine';
import { fetchOPLHistory, oplToDotsHistory, type OPLMeet } from '../../../engines/openpowerlifting-import.engine';
import { dailyReadinessCheck, mvtForLift, velocityForPct, calibrateLVP, trainingMax } from '../../../engines/pro/vbt.engine';
import { avgIntensity, checkTonnageGate } from '../../../engines/lms/pl-tonnage-gate.engine';
import { dotsScore } from '../../../engines/pro/relative-strength.engine';
import { calibrateLVP as calibrateLVPCanonical, saveLVPProfile } from '../../../engines/strength-sport/strength-sport-lvp-calibration.engine';
import type { VBTLift } from '../../../engines/pro/vbt.engine';
import { BbCard, BbFoldCard } from '../TrainingScreen_parts/training-ui';

export const PLToolsCard: React.FC<{ level: string; days: number; totalSets: Record<string, number>; e1RM: Record<string, number>; hrvRatio?: number; acwr?: number; rpeDelta?: number; bodyWeight?: number; sex?: string; onApplyFrequency?: (plans: ReturnType<typeof planFrequency>[]) => void; plan?: { weeks: Array<{ week: number; days: Array<{ exercises: Array<{ workSets: Array<{ weight: number; reps: number; sets: number; pct: number }> }> }> }> } | null }> = ({ level, days, totalSets, e1RM, hrvRatio, acwr, rpeDelta, bodyWeight, sex, onApplyFrequency, plan }) => {
  const freqs = useMemo(() => Object.keys(totalSets).map(m => planFrequency(m, totalSets[m], days, level)), [totalSets, days, level]);
  const [lift, setLift] = useState<VBTLift>('squat');
  const attempts = useMemo(() => {
    const e = e1RM[lift] ?? 180;
    return velocityAttempts(e, lift, 'balanced');
  }, [e1RM, lift]);
  const light = useMemo(() => trafficLight(hrvRatio ?? null, acwr ?? 1.0, rpeDelta ?? 0), [hrvRatio, acwr, rpeDelta]);
  const [oplName, setOplName] = useState('');
  const [oplRes, setOplRes] = useState<string>('');
  // P2-3: история OPL больше не write-only — сохранённые старты читаются при
  // монтировании и рисуются графиком DOTS (битый/чужой стор → честно пусто).
  const [oplMeets, setOplMeets] = useState<OPLMeet[]>(() => {
    try {
      const raw = localStorage.getItem('he_opl_history');
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed)
        ? (parsed as OPLMeet[]).filter(m => m && typeof m.date === 'string' && typeof m.dots === 'number')
        : [];
    } catch { return []; }
  });
  const [vExp, setVExp] = useState(0.60);
  const [vAct, setVAct] = useState(0.55);
  const readiness = useMemo(() => dailyReadinessCheck(vExp, vAct), [vExp, vAct]);
  const [lvp60, setLvp60] = useState(0.85);
  const [lvp70, setLvp70] = useState(0.75);
  const [lvp80, setLvp80] = useState(0.60);
  const lvpCal = useMemo(() => calibrateLVP([{pct:0.6, velocity:lvp60},{pct:0.7, velocity:lvp70},{pct:0.8, velocity:lvp80}]), [lvp60, lvp70, lvp80]);
  const [lvpSaveMsg, setLvpSaveMsg] = useState('');
  const [compMax, setCompMax] = useState(200);

  return (
    <div className="pl-tools" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <BbFoldCard icon="🏋️" accent="#a78bfa" title="OpenPowerlifting импорт" className="pl-tools-opl">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={oplName} onChange={e=>setOplName(e.target.value)} placeholder="Имя атлета" style={{ flex: 1, minWidth: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 10 }} />
          <button onClick={async()=>{ const r=await fetchOPLHistory(oplName); if(r.length){ setOplMeets(r); try{ localStorage.setItem('he_opl_history', JSON.stringify(r)); }catch{} setOplRes(`Найдено ${r.length} стартов — история DOTS ниже (локально в этом браузере)`); } else setOplRes(`Нет данных / не найдено`); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#a78bfa', color: '#000', border: 'none', cursor: 'pointer' }}>Найти</button>
          {oplRes && <span style={{ fontSize: 10, color: '#fff' }}>{oplRes}</span>}
        </div>
        {oplMeets.length > 0 && (() => {
          const hist = oplToDotsHistory(oplMeets).filter(p => Number.isFinite(p.dots) && p.dots > 0);
          if (hist.length === 0) return null;
          const W = 260, H = 48;
          const min = Math.min(...hist.map(p => p.dots)), max = Math.max(...hist.map(p => p.dots));
          const range = Math.max(1, max - min);
          const px = (i: number) => (i / Math.max(1, hist.length - 1)) * (W - 8) + 4;
          const py = (v: number) => H - 6 - ((v - min) / range) * (H - 12);
          const best = oplMeets.reduce((a, b) => (b.dots > a.dots ? b : a), oplMeets[0]);
          return (
            <div data-pl="opl-history" style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>
                📈 История DOTS ({hist.length} стартов{oplName ? ` · ${oplName}` : ''}): лучший {Math.round(best.dots)} · {best.date}
              </div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="История DOTS со стартов" style={{ display: 'block' }}>
                <polyline points={hist.map((p, i) => `${px(i)},${py(p.dots)}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth={1.6} />
                {hist.map((p, i) => <circle key={i} cx={px(i)} cy={py(p.dots)} r={2.4} fill="#a78bfa" />)}
              </svg>
              <div style={{ fontSize: 9, color: '#fff' }}>
                {hist.length >= 2 ? `${hist[0].date} → ${hist[hist.length - 1].date}` : hist[0].date} · источник OpenPowerlifting, хранение — localStorage браузера
              </div>
            </div>
          );
        })()}
      </BbFoldCard>
      <BbFoldCard icon="📊" accent="#60a5fa" title="Frequency Planner (MEV/MRV)" defaultOpen
        right={<button onClick={() => onApplyFrequency?.(freqs)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#60a5fa', color: '#000', border: 'none', cursor: 'pointer' }}>Применить в план</button>}>
        {freqs.length === 0 && (
          <div style={{ fontSize: 10, color: '#fff' }}>Объёмы берутся из собранного плана — постройте план, чтобы увидеть частоту.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 6 }}>
          {freqs.map(f => (
            <div key={f.muscle} style={{ padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 10 }}>
              <b style={{ color: f.status === 'over' ? '#ef4444' : f.status === 'high' ? '#f59e0b' : '#22c55e' }}>{f.muscle} {f.totalSets}п/нед → {f.frequency}×</b>
              <div style={{ color: '#fff' }}>{f.perSession.join(' / ')} сеты</div>
              <div style={{ color: '#fff' }}>{f.note}</div>
            </div>
          ))}
        </div>
      </BbFoldCard>
      <BbCard icon="🏁" accent="#22c55e" title="Attempt Calculator (velocity)">
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
      </BbCard>
      <BbCard icon="🚦" accent={light === 'red' ? '#ef4444' : light === 'yellow' ? '#f59e0b' : '#22c55e'}
        title={`Traffic Light: ${light.toUpperCase()} (HRV ${hrvRatio?.toFixed(2) ?? '—'}, ACWR ${acwr?.toFixed(2) ?? '—'}, RPEΔ ${rpeDelta ?? 0})`}>
        <div style={{ fontSize: 9, color: '#fff' }}>Green=как план, Yellow=осторожно (-10% объём), Red=делод</div>
      </BbCard>
      <BbFoldCard icon="⚡" accent="#a78bfa" title="VBT Daily Readiness (60% присед)" defaultOpen>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#fff' }}>Ожидаемо м/с</span>
          <input type="number" step={0.05} value={vExp} onChange={e=>setVExp(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 10 }} />
          <span style={{ fontSize: 10, color: '#fff' }}>Факт</span>
          <input type="number" step={0.05} value={vAct} onChange={e=>setVAct(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 10 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: readiness.action==='deload'?'#ef4444':readiness.action==='reduce-volume-20'?'#f59e0b':'#22c55e' }}>{readiness.dropPct}% → {readiness.action==='as-planned'?'как план':readiness.action==='reduce-volume-20'?' -20% объём':'делод'}</span>
        </div>
        <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>MVT squat {mvtForLift('squat').toFixed(2)} м/с, bench {mvtForLift('bench').toFixed(2)} м/с | 60% squat ожидаемо {velocityForPct('squat',0.6).toFixed(2)} м/с</div>
        <div style={{ fontSize: 9, color: '#fff', marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>LVP 60%:</span><input type="number" step={0.05} value={lvp60} onChange={e=>setLvp60(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>70%:</span><input type="number" step={0.05} value={lvp70} onChange={e=>setLvp70(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>80%:</span><input type="number" step={0.05} value={lvp80} onChange={e=>setLvp80(Number(e.target.value))} style={{ width: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span style={{ color: lvpCal ? '#22c55e' : '#ef4444' }}>{lvpCal ? `R² ${lvpCal.r2.toFixed(2)} slope ${lvpCal.slope.toFixed(2)}` : 'нужно 3 точки'}</span>
          <button onClick={()=>{
            if (!lvpCal) { setLvpSaveMsg('⚠ не сохранено: нужно 3 точки'); return; }
            // Канонический профиль (he_lv_profile_ss_v1 = { [lift]: LVPProfile }) —
            // прежний плоский формат не читался VBT/WL-хабом.
            const profile = calibrateLVPCanonical('squat', [
              { pct: 0.6, velocity: lvp60 },
              { pct: 0.7, velocity: lvp70 },
              { pct: 0.8, velocity: lvp80 },
            ]);
            if (!profile) { setLvpSaveMsg('⚠ не сохранено: наклон/разброс вне нормы'); return; }
            saveLVPProfile(profile);
            setLvpSaveMsg(`✓ сохранено (squat, R² ${profile.r2.toFixed(2)})`);
          }} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, background: '#a78bfa', color: '#000', border: 'none', cursor: 'pointer' }}>Сохранить LVP</button>
          {lvpSaveMsg && <span style={{ color: lvpSaveMsg.startsWith('✓') ? '#22c55e' : '#f59e0b' }}>{lvpSaveMsg}</span>}
        </div>
        <div style={{ fontSize: 9, color: '#fff', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>Соревн. макс</span><input type="number" value={compMax} onChange={e=>setCompMax(Number(e.target.value))} style={{ width: 70, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '2px 4px', fontSize: 9 }} />
          <span>→ TM 90% = {trainingMax(compMax,0.90)}кг, 92% = {trainingMax(compMax,0.92)}кг (буфер Шейко)</span>
        </div>
      </BbFoldCard>
      {plan && (() => {
        const avg = avgIntensity(plan as never);
        const gates = checkTonnageGate(plan as never);
        const danger = gates.filter(g=>g.flag==='danger').length;
        const warn = gates.filter(g=>g.flag==='warn').length;
        const total = Object.values(e1RM).reduce((a,b)=>a+(b||0),0);
        // Честный DOTS: реальный вес из профиля (83 кг — только явный фолбэк) и пол.
        const bwForDots = bodyWeight && bodyWeight > 0 ? bodyWeight : 83;
        const sexForDots = sex === 'female' ? 'female' : 'male';
        const dots = total>0 ? dotsScore(total, bwForDots, sexForDots) : 0;
        return (
          <BbCard icon="📈" accent="#f59e0b" title="Sheiko Gate + DOTS">
            <div style={{ fontSize: 10, color: '#fff' }}>Средняя интенсивность: <b>{avg}%</b> {avg>=73 && avg<=77 ? <span style={{color:'#22c55e'}}>✓ Шейко-норма 75%</span> : <span style={{color:'#ef4444'}}>⚠ вне 75%±2%</span>} | Тоннаж гейт: {danger? <span style={{color:'#ef4444'}}>{danger}× danger</span> : warn? <span style={{color:'#f59e0b'}}>{warn}× warn</span> : <span style={{color:'#22c55e'}}>ок</span>}</div>
            <div data-pl="dots-line" style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Тотал e1RM {total}кг → DOTS <b>{dots}</b> ({bwForDots}кг {sexForDots}{!bodyWeight || bodyWeight <= 0 ? ' — профиль не заполнен' : ''}) {dots>=400 ? '— МС' : dots>=350 ? '— КМС' : ''}</div>
            {gates.filter(g=>g.flag!=='ok').slice(0,3).map(g=>(
              <div key={g.week} style={{ fontSize: 9, color: g.flag==='danger'?'#ef4444':'#f59e0b' }}>Нед {g.week}: {g.changePct}% {g.note}</div>
            ))}
          </BbCard>
        );
      })()}
    </div>
  );
};
