import React, { useState, useMemo } from 'react';
import { getProfile } from '../../../core/profile-manager';

interface WeightEntry { date: string; weight: number; fatPct?: number; }

const N = 12;

export const ProgressTracker: React.FC = () => {
  const [entries, setEntries] = useState<WeightEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_progress_entries') || '[]'); } catch { return []; }
  });
  const [weightInput, setWeightInput] = useState('');
  const [fatInput, setFatInput] = useState('');

  const addEntry = () => {
    if (!weightInput) return;
    const today = new Date().toISOString().slice(0, 10);
    const copy = [...entries];
    const existing = copy.findIndex(e => e.date === today);
    if (existing >= 0) copy[existing] = { date: today, weight: parseFloat(weightInput), fatPct: fatInput ? parseFloat(fatInput) : copy[existing].fatPct };
    else copy.push({ date: today, weight: parseFloat(weightInput), fatPct: fatInput ? parseFloat(fatInput) : undefined });
    copy.sort((a, b) => a.date.localeCompare(b.date));
    const latest = copy.slice(-N);
    setEntries(latest);
    localStorage.setItem('he_progress_entries', JSON.stringify(latest));
    setWeightInput('');
    setFatInput('');
  };

  const profile = getProfile();
  const startWeight = profile?.settings?.weight || 80;

  const maxW = Math.max(...entries.map(e => e.weight), startWeight);
  const minW = Math.min(...entries.map(e => e.weight), startWeight);
  const range = maxW - minW || 1;

  const barH = (w: number): number => Math.max(10, ((w - minW + 0.5) / (range + 1)) * 80);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>📈 Трекер прогресса</div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <input value={weightInput} onChange={e => setWeightInput(e.target.value)} type="number" step="0.1" placeholder="Вес (кг)" style={{
            flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: '#202023',
            border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none',
          }} />
          <input value={fatInput} onChange={e => setFatInput(e.target.value)} type="number" step="0.1" placeholder="%жира" style={{
            width: 70, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: '#202023',
            border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none',
          }} />
          <button onClick={addEntry} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000',
          }}>✓</button>
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
          {entries.length > 0 ? `Последняя запись: ${entries[entries.length - 1].date} — ${entries[entries.length - 1].weight} кг` : 'Нет записей'}
        </div>
      </div>

      {/* Weight chart */}
      {entries.length > 1 && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#00e68a', marginBottom: 4 }}>📊 Динамика веса</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '4px 0' }}>
            {entries.map((e, i) => (
              <div key={e.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div title={`${e.date}: ${e.weight} кг`} style={{
                  width: '100%', maxWidth: 30, height: `${barH(e.weight)}%`,
                  borderRadius: '4px 4px 0 0', background: e.weight > entries[Math.max(0, i - 1)].weight ? '#ef4444' : '#22c55e',
                  opacity: 0.8, transition: 'height 0.2s',
                }} />
                <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 2, writingMode: 'vertical-lr' as any }}>{e.weight}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
            <span>{entries[0].date.slice(5)}</span>
            <span>{entries[entries.length - 1].date.slice(5)}</span>
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
            <span>Старт: <b>{entries[0].weight} кг</b></span>
            <span>Текущий: <b style={{ color: entries[entries.length - 1].weight <= entries[0].weight ? '#22c55e' : '#ef4444' }}>{entries[entries.length - 1].weight} кг</b></span>
            <span>Δ: <b style={{ color: (entries[entries.length - 1].weight - entries[0].weight) <= 0 ? '#22c55e' : '#ef4444' }}>{(entries[entries.length - 1].weight - entries[0].weight).toFixed(1)} кг</b></span>
          </div>
        </div>
      )}

      {/* Smart metrics */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>🎯 Умные показатели</div>
        {(() => {
          try {
            const report = JSON.parse(localStorage.getItem('he_nutrition_report_current') || 'null');
            if (report && report.riskAnalysis) {
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {report.riskAnalysis.map((r: any, i: number) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:7, padding:'3px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                      <span style={{ color:'rgba(255,255,255,0.7)' }}>{r.system}</span>
                      <span style={{ fontWeight:600, color: r.score / r.maxScore > 0.7 ? '#ef4444' : r.score / r.maxScore > 0.4 ? '#f59e0b' : '#22c55e' }}>
                        {Math.round(r.score / r.maxScore * 100)}% ({r.score}/{r.maxScore})
                      </span>
                    </div>
                  ))}
                  {report.foodQualityScore && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, padding:'3px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                      <span style={{ color:'rgba(255,255,255,0.7)' }}>⭐ Качество продуктов</span>
                      <span style={{ fontWeight:600, color:'#00e68a' }}>{report.foodQualityScore.toFixed(1)}</span>
                    </div>
                  )}
                  {report.microDeficiencies?.length > 0 && (
                    <div style={{ fontSize:7, color:'#f59e0b' }}>
                      ⚠️ Дефициты: {report.microDeficiencies.join(', ')}
                    </div>
                  )}
                </div>
              );
            }
          } catch {}
          return <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', textAlign:'center', padding:8 }}>
            Нет данных. Сгенерируйте отчёт в Планировщике питания → Отчёт
          </div>;
        })()}
      </div>
    </div>
  );
};
