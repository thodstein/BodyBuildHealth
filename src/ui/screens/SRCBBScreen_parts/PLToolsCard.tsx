import React, { useMemo, useState } from 'react';
import { planFrequency } from '../../../engines/pro/frequency-planner.engine';
import { velocityAttempts } from '../../../engines/lms/attempt-calculator.engine';
import { trafficLight } from '../../../engines/pro/training-load.engine';
import { fetchOPLHistory } from '../../../engines/openpowerlifting-import.engine';
import type { VBTLift } from '../../../engines/pro/vbt.engine';

export const PLToolsCard: React.FC<{ level: string; days: number; totalSets: Record<string, number>; e1RM: Record<string, number>; hrvRatio?: number; acwr?: number; rpeDelta?: number }> = ({ level, days, totalSets, e1RM, hrvRatio, acwr, rpeDelta }) => {
  const freqs = useMemo(() => Object.keys(totalSets).map(m => planFrequency(m, totalSets[m], days, level)), [totalSets, days, level]);
  const [lift, setLift] = useState<VBTLift>('squat');
  const attempts = useMemo(() => {
    const e = e1RM[lift] ?? 180;
    return velocityAttempts(e, lift, 'balanced');
  }, [e1RM, lift]);
  const light = useMemo(() => trafficLight(hrvRatio ?? null, acwr ?? 1.0, rpeDelta ?? 0), [hrvRatio, acwr, rpeDelta]);
  const [oplName, setOplName] = useState('');
  const [oplRes, setOplRes] = useState<string>('');

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>🏋️ OpenPowerlifting импорт</span>
        <input value={oplName} onChange={e=>setOplName(e.target.value)} placeholder="Имя атлета" style={{ flex: 1, minWidth: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 10 }} />
        <button onClick={async()=>{ const r=await fetchOPLHistory(oplName); setOplRes(r.length?`Найдено ${r.length} стартов`:`Нет данных / не найдено`); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#a78bfa', color: '#000', border: 'none', cursor: 'pointer' }}>Найти</button>
        {oplRes && <span style={{ fontSize: 10, color: '#fff' }}>{oplRes}</span>}
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📊 Frequency Planner (MEV/MRV)</div>
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
    </div>
  );
};
