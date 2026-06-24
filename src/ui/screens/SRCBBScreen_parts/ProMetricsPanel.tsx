/**
 * ProMetricsPanel.tsx — P12: UI-интеграция проф-движков.
 * REUSE P1/P3/P4/P6/P9. Калькулятор относительной силы + монитор тренировочной нагрузки (sRPE/ACWR/fitness-fatigue)
 * + панель проф-авторегуляции (readiness/ACWR/velocity-loss → корректировка плана).
 */
import React, { useMemo, useState } from 'react';
import { relativeStrengthReport } from '../../../engines/pro/relative-strength.engine';
import { trainingLoadReport, toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { autoRegulate } from '../../../engines/pro/autoregulation-pro.engine';
import { listSchemes, generateProgression } from '../../../engines/pro/progression-pro.engine';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const zoneColor = (z: string) => z === 'dangerous' ? '#ef4444' : z === 'caution' ? '#f59e0b' : z === 'undertrained' ? '#60a5fa' : ACCENT;

export const ProMetricsPanel: React.FC = () => {
  // ── Относительная сила ──
  const [total, setTotal] = useState<number>(600);
  const [bw, setBw] = useState<number>(90);
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const rs = useMemo(() => relativeStrengthReport(total, bw, sex), [total, bw, sex]);

  // ── Монитор нагрузки (sRPE × длительность) ──
  const [sessions, setSessions] = useState<{ sRPE: number; duration: number }[]>([
    { sRPE: 8, duration: 70 }, { sRPE: 7, duration: 60 }, { sRPE: 8, duration: 75 },
    { sRPE: 9, duration: 80 }, { sRPE: 7, duration: 65 }, { sRPE: 8, duration: 70 },
    { sRPE: 8, duration: 75 }, { sRPE: 9, duration: 85 },
  ]);
  const tlReport = useMemo(() => {
    const today = new Date();
    const mapped = sessions.map((s, i) => { const d = new Date(today); d.setDate(d.getDate() - (sessions.length - 1 - i)); return { date: d.toISOString().slice(0, 10), sRPE: s.sRPE, durationMin: s.duration }; });
    return trainingLoadReport(mapped);
  }, [sessions]);

  // ── Проф-авторегуляция ──
  const [readiness, setReadiness] = useState<number>(75);
  const [fatigue, setFatigue] = useState<number>(40);
  const [lastRPE, setLastRPE] = useState<number>(8);
  const [vlPct, setVlPct] = useState<number>(15);
  const ar = useMemo(() => autoRegulate({
    readiness, acwr: { ratio: tlReport.acwr.ratio, zone: tlReport.acwr.zone },
    fatigue, lastSessionRPE: lastRPE, lastVelocityLossPct: vlPct,
    plannedTopSetPct: 0.85, plannedRIR: 2, plannedVolumeMult: 1,
  }), [readiness, fatigue, lastRPE, vlPct, tlReport.acwr]);

  // ── Прогрессии (список схем) ──
  const schemes = useMemo(() => listSchemes(), []);
  const [schemeId, setSchemeId] = useState<string>('531');
  const [e1rm, setE1rm] = useState<number>(120);
  const prog = useMemo(() => generateProgression(schemeId as any, e1rm), [schemeId, e1rm]);

  return (
    <div>
      <div style={H}>🧮 Pro-метрики</div>

      {/* Относительная сила */}
      <div style={CARD}>
        <div style={{ ...H, margin: 0 }}>Относительная сила</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><div style={LABEL}>Тотал, кг</div><input style={IN} type="number" value={total} onChange={e => setTotal(+e.target.value)} /></div>
          <div><div style={LABEL}>Вес тела, кг</div><input style={IN} type="number" value={bw} onChange={e => setBw(+e.target.value)} /></div>
          <div><div style={LABEL}>Пол</div><select style={IN} value={sex} onChange={e => setSex(e.target.value as any)}><option value="male">М</option><option value="female">Ж</option></select></div>
        </div>
        <div style={ROW}><span>Wilks</span><b style={{ color: '#fff' }}>{rs.wilks}</b></div>
        <div style={ROW}><span>DOTS</span><b style={{ color: ACCENT }}>{rs.dots} — {rs.classification.label}</b></div>
        <div style={ROW}><span>IPF GLI</span><b style={{ color: '#fff' }}>{rs.ipfGL}</b></div>
        <div style={ROW}><span>Allometric (×bw^⅔)</span><b style={{ color: '#fff' }}>{rs.allometric}</b></div>
        <div style={ROW}><span>Относит. (тотал/вес)</span><b style={{ color: '#fff' }}>{rs.relative}×</b></div>
      </div>

      {/* Монитор нагрузки */}
      <div style={CARD}>
        <div style={{ ...H, margin: 0 }}>Монитор нагрузки (sRPE × длительность)</div>
        <div style={SMALL}>ACWR (7/28д EWMA), monotony/strain, fitness-fatigue (Banister)</div>
        <div style={ROW}><span>ACWR</span><span style={{ color: zoneColor(tlReport.acwr.zone) }}>{tlReport.acwr.ratio} · {tlReport.acwr.zone}</span></div>
        <div style={ROW}><span>Острая / хроническая (AU)</span><b style={{ color: '#fff' }}>{Math.round(tlReport.acwr.acute)} / {Math.round(tlReport.acwr.chronic)}</b></div>
        <div style={ROW}><span>Monotony / Strain</span><b style={{ color: '#fff' }}>{tlReport.monotony.monotony} / {tlReport.monotony.strain}</b></div>
        {tlReport.banister.current && <div style={ROW}><span>Fitness − Fatigue (perf.)</span><b style={{ color: tlReport.banister.current.performance > 0 ? ACCENT : '#ef4444' }}>{tlReport.banister.current.fitness} − {tlReport.banister.current.fatigue} = {tlReport.banister.current.performance}</b></div>}
        {tlReport.recommendations.map((r, i) => <div key={i} style={{ ...SMALL, marginTop: 4, color: 'rgba(255,255,255,0.7)' }}>• {r}</div>)}
      </div>

      {/* Проф-авторегуляция */}
      <div style={CARD}>
        <div style={{ ...H, margin: 0 }}>Проф-авторегуляция плана</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div><div style={LABEL}>Готовность</div><input style={IN} type="number" value={readiness} onChange={e => setReadiness(+e.target.value)} /></div>
          <div><div style={LABEL}>Усталость</div><input style={IN} type="number" value={fatigue} onChange={e => setFatigue(+e.target.value)} /></div>
          <div><div style={LABEL}>Посл. RPE</div><input style={IN} type="number" step="0.5" value={lastRPE} onChange={e => setLastRPE(+e.target.value)} /></div>
          <div><div style={LABEL}>VLoss %</div><input style={IN} type="number" value={vlPct} onChange={e => setVlPct(+e.target.value)} /></div>
        </div>
        <div style={{ ...SMALL, marginTop: 6 }}>На входе ACWR = {tlReport.acwr.ratio} ({tlReport.acwr.zone}). Рекомендация:</div>
        <div style={ROW}><span>Топ-сет множитель</span><b style={{ color: ar.topSetPctMultiplier >= 1 ? ACCENT : '#f59e0b' }}>×{ar.topSetPctMultiplier}</b></div>
        <div style={ROW}><span>Объём множитель</span><b style={{ color: ar.volumeMultiplier >= 1 ? ACCENT : '#f59e0b' }}>×{ar.volumeMultiplier}</b></div>
        <div style={ROW}><span>RIR-сдвиг</span><b style={{ color: '#fff' }}>+{ar.rirShift}</b></div>
        <div style={ROW}><span>Deload-триггер</span><b style={{ color: ar.deload ? '#ef4444' : ACCENT }}>{ar.deload ? 'да' : 'нет'}</b></div>
        {ar.decisions.map((d, i) => <div key={i} style={{ ...SMALL, marginTop: 3, color: 'rgba(255,255,255,0.65)' }}>• {d}</div>)}
      </div>

      {/* Прогрессии */}
      <div style={CARD}>
        <div style={{ ...H, margin: 0 }}>Прогрессии ({schemes.length} схем)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 6 }}>
          {schemes.map(sc => <button key={sc.id} onClick={() => setSchemeId(sc.id)} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: schemeId===sc.id?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: schemeId===sc.id?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.02)', color: schemeId===sc.id?'#00e68a':'var(--text-dim)' }}>{sc.name}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><div style={LABEL}>e1RM:</div><input style={{ ...IN, width: 80 }} type="number" value={e1rm} onChange={e => setE1rm(+e.target.value)} /></div>
        {prog && <div style={SMALL}>TM = {prog[0].trainingMax} кг · {prog.length} нед</div>}
        {prog && prog.slice(0, 3).map(wk => <div key={wk.week} style={{ ...SMALL, marginTop: 4 }}><b>Нед {wk.week}:</b> {wk.days[0].sets.map(s => `${s.sets}×${s.reps}×${s.weight}кг`).join(' · ')}</div>)}
      </div>
    </div>
  );
};
export default ProMetricsPanel;
