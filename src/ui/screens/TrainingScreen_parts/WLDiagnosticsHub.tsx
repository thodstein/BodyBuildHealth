/** WLDiagnosticsHub.tsx — ХАБ диагностики тяжёлой атлетики (PRO, уровень движения).
 *  Аналог DiagnosticsHub (9 лифтов) и ArmDiagnosticsHub (8 движений) — для ТА двоеборья.
 *  4 подвкладки: Рывок | Взятие | Толчок | Мобильность/VBT
 *  - 7 фаз рывка, 5 фаз толчка, углы (таз/колено/плечо), VBT, bar path, асимметрия
 *  - Вывод в конструктор Стронг+ТА via planner-bridge (weakpoints → StrengthSportConstructor mode:weightlifting)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { WL_WEAKPOINT_LABELS, WL_WEAKPOINT_ANGLE, WL_WEAKPOINT_CORRECTION, type WLWeakPoint } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { diagnoseBarPath, type BarPathDeviation, BAR_PATH_LABELS } from '../../../engines/strength-sport/strength-sport-diagnostics';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';

const STORAGE_KEY = 'he_wl_diagnostics_hub_v1';

type WLTab = 'snatch' | 'clean' | 'jerk' | 'mobility';

type WLState = {
  snatchWeak: WLWeakPoint[];
  cleanWeak: WLWeakPoint[];
  jerkWeak: WLWeakPoint[];
  barPath: BarPathDeviation | '';
  barLift: string;
  leftMax: string;
  rightMax: string;
  vbtWeight: string;
  vbtVel: string;
  overheadSquat: string; // мобильность: см глубины
  ankleDorsiflex: string;
};

const DEFAULT_STATE: WLState = {
  snatchWeak: [], cleanWeak: [], jerkWeak: [],
  barPath: '', barLift: 'snatch',
  leftMax: '', rightMax: '',
  vbtWeight: '', vbtVel: '',
  overheadSquat: '', ankleDorsiflex: '',
};

const TAB_DEFS: Array<{ id: WLTab; label: string; icon: string; desc: string }> = [
  { id: 'snatch', label: 'Рывок', icon: '🏋️', desc: '5 фаз + bar path' },
  { id: 'clean', label: 'Взятие', icon: '🏋️‍♂️', desc: '3 фазы + тяга' },
  { id: 'jerk', label: 'Толчок', icon: '🦾', desc: '3 фазы + VBT' },
  { id: 'mobility', label: 'Мобильность', icon: '🧘', desc: 'оверхед/голеностоп + асимметрия' },
];

export const WLDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<WLState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<WLTab>('snatch');
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      return acuteChronicRatio(toDailyLoads(srpe as any));
    } catch { return null; }
  }, []);

  const weakPoints = useMemo(() => {
    const all: WLWeakPoint[] = [...state.snatchWeak, ...state.cleanWeak, ...state.jerkWeak];
    return Array.from(new Set(all)).slice(0, 3);
  }, [state.snatchWeak, state.cleanWeak, state.jerkWeak]);

  const barPathDiag = useMemo(() => {
    if (!state.barPath) return null;
    return diagnoseBarPath(state.barLift, state.barPath as BarPathDeviation);
  }, [state.barPath, state.barLift]);

  const asymmetry = useMemo(() => {
    const l = parseFloat(state.leftMax);
    const r = parseFloat(state.rightMax);
    if (!Number.isFinite(l) || !Number.isFinite(r) || !l || !r) return null;
    const diff = Math.abs(l - r) / Math.max(l, r) * 100;
    return { diff: Math.round(diff * 10) / 10, isAsym: diff >= 10, weaker: l < r ? 'left' : 'right' };
  }, [state.leftMax, state.rightMax]);

  const score = useMemo(() => {
    let s = 100;
    s -= weakPoints.length * 12;
    if (asymmetry?.isAsym) s -= 15;
    if (state.barPath) s -= 10;
    if (state.vbtVel && parseFloat(state.vbtVel) < 0.5) s -= 10;
    return Math.max(0, Math.min(100, Math.round(s)));
  }, [weakPoints, asymmetry, state.barPath, state.vbtVel]);

  const level: 'ok'|'warn'|'critical' = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';
  const scoreColor = level === 'ok' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444';

  const toggleWeak = (group: 'snatch' | 'clean' | 'jerk', wp: WLWeakPoint) => {
    setState(s => {
      const key = group === 'snatch' ? 'snatchWeak' : group === 'clean' ? 'cleanWeak' : 'jerkWeak';
      const arr = (s as any)[key] as WLWeakPoint[];
      const has = arr.includes(wp);
      const next = has ? arr.filter(x => x !== wp) : [...arr, wp].slice(0, 2);
      return { ...s, [key]: next };
    });
  };

  const applyToConstructor = () => {
    if (weakPoints.length === 0) {
      setToast('Слабые фазы не выбраны — нечего применять');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    applyToPlanner({
      kind: 'weakpoints',
      label: `ТА диагностика: ${weakPoints.join(', ')}`,
      data: { groups: weakPoints, plWeakPoints: weakPoints.map(wp => ({ lift: wp.split('_')[0], weakPoint: wp })), wlWeakPoints: weakPoints, barPath: state.barPath, vbt: state.vbtVel } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в ТА-конструктор: ${weakPoints.map(w=>WL_WEAKPOINT_LABELS[w]||w).join(', ')}`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'strength' } as any));
      localStorage.setItem('he_training_planning_track', 'strength');
      // strength-sport mode hint
      localStorage.setItem('he_strength_sport_mode', 'weightlifting');
    } catch {}
  };

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(59,130,246,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(59,130,246,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3b82f6,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🏋️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>ТА-диагностика — хаб движения PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>Рывок 5 фаз + взятие 3 + толчок 3 × углы + bar path + VBT + мобильность. Как диагностика 9 лифтов — с видео и коррекциями.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${scoreColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${scoreColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: scoreColor, fontWeight: 700, marginTop: 2 }}>{level === 'ok' ? 'ОК' : level === 'warn' ? 'WARN' : 'CRITICAL'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone==='dangerous'?'🔴': acwr.zone==='caution'?'🟠':'🟢') : ''}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{weakPoints.length? `${weakPoints.length} слабые фазы` : 'баланс'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{state.barPath ? BAR_PATH_LABELS[state.barPath as BarPathDeviation] : 'bar path —'}</span>
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые фазы + bar path + VBT → получи углы, коррекции и точечные упражнения. Кнопка <b style={{ color: '#60a5fa' }}>«Применить в ТА-конструктор»</b> отправит фазы в планировщик (mode:weightlifting).
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      {/* Tabs */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)} aria-pressed={tab===t.id} style={{ padding:'6px 12px', borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#3b82f6' : '#1f3a5f', background: tab===t.id ? 'rgba(59,130,246,0.14)' : '#0a1629', color: tab===t.id ? '#3b82f6' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#a855f7)', color:'#fff', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>→ Применить в ТА-конструктор</button>
        </div>

        {tab==='snatch' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Рывок — 5 фаз (углы + мышцы)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {(['snatch_off_floor','snatch_mid','snatch_pull_under','snatch_catch','snatch_overhead'] as WLWeakPoint[]).map(wp=>(
                <button key={wp} onClick={()=>toggleWeak('snatch', wp)} aria-pressed={state.snatchWeak.includes(wp)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.snatchWeak.includes(wp) ? '#3b82f6' : '#1f3a5f', background: state.snatchWeak.includes(wp) ? 'rgba(59,130,246,0.14)' : '#0a1629', color: state.snatchWeak.includes(wp) ? '#3b82f6' : DIM, fontSize:11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            {state.snatchWeak.map(wp=>(
              <div key={wp} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{WL_WEAKPOINT_LABELS[wp]} <span style={{ color:DIM }}>· {WL_WEAKPOINT_ANGLE[wp]?.joint} {WL_WEAKPOINT_ANGLE[wp]?.angle}</span></div>
                <div style={{ fontSize:10, color:DIM }}>{WL_WEAKPOINT_ANGLE[wp]?.muscles.join(', ')}</div>
                <div style={{ fontSize:11, color:'#5ee', marginTop:4 }}>{(WL_WEAKPOINT_CORRECTION[wp]||[]).join(' · ')}</div>
              </div>
            ))}
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Bar path — рывок</div>
              <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                <select value={state.barLift} onChange={e=>setState(s=>({...s, barLift:e.target.value}))} style={{ background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}>
                  <option value="snatch">Рывок</option><option value="clean">Взятие</option><option value="jerk">Толчок</option><option value="squat">Присед</option>
                </select>
                <select value={state.barPath} onChange={e=>setState(s=>({...s, barPath:e.target.value as any}))} style={{ background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}>
                  <option value="">— нет отклонения</option>
                  <option value="forward">Уход вперёд</option><option value="backward">Уход назад</option><option value="loop">Петля</option><option value="early_pull">Ранняя тяга</option><option value="soft_lockout">Мягкий замок</option>
                </select>
              </div>
              {barPathDiag?.weak && <div style={{ fontSize:11, color:'#f59e0b', marginTop:6 }}>→ {WL_WEAKPOINT_LABELS[barPathDiag.weak]} · {barPathDiag.corrections.join(' · ')}</div>}
            </div>
          </div>
        )}

        {tab==='clean' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Взятие — 3 фазы</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {(['clean_off_floor','clean_mid','clean_catch'] as WLWeakPoint[]).map(wp=>(
                <button key={wp} onClick={()=>toggleWeak('clean', wp)} aria-pressed={state.cleanWeak.includes(wp)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.cleanWeak.includes(wp) ? '#22c55e' : '#1f3a5f', background: state.cleanWeak.includes(wp) ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.cleanWeak.includes(wp) ? '#22c55e' : DIM, fontSize:11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            {state.cleanWeak.map(wp=>(
              <div key={wp} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{WL_WEAKPOINT_LABELS[wp]}</div>
                <div style={{ fontSize:11, color:'#5ee' }}>{(WL_WEAKPOINT_CORRECTION[wp]||[]).join(' · ')}</div>
              </div>
            ))}
          </div>
        )}

        {tab==='jerk' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Толчок — 3 фазы + VBT</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {(['jerk_dip','jerk_drive','jerk_lockout'] as WLWeakPoint[]).map(wp=>(
                <button key={wp} onClick={()=>toggleWeak('jerk', wp)} aria-pressed={state.jerkWeak.includes(wp)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.jerkWeak.includes(wp) ? '#a855f7' : '#1f3a5f', background: state.jerkWeak.includes(wp) ? 'rgba(168,85,247,0.14)' : '#0a1629', color: state.jerkWeak.includes(wp) ? '#a855f7' : DIM, fontSize:11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Вес штанги кг<br/><input value={state.vbtWeight} onChange={e=>setState(s=>({...s, vbtWeight:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Скорость м/с<br/><input value={state.vbtVel} onChange={e=>setState(s=>({...s, vbtVel:e.target.value}))} placeholder="0.8" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>VBT: скорость толчка (0.5–1.2 м/с). Потеря ≥20% → warn.</div>
          </div>
        )}

        {tab==='mobility' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Оверхед присед (см глубины)<br/><input value={state.overheadSquat} onChange={e=>setState(s=>({...s, overheadSquat:e.target.value}))} placeholder="5" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Голеностоп дорсифлексия (°)<br/><input value={state.ankleDorsiflex} onChange={e=>setState(s=>({...s, ankleDorsiflex:e.target.value}))} placeholder="35" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Левая макс кг<br/><input value={state.leftMax} onChange={e=>setState(s=>({...s, leftMax:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Правая макс кг<br/><input value={state.rightMax} onChange={e=>setState(s=>({...s, rightMax:e.target.value}))} placeholder="102" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {asymmetry && (
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background: asymmetry.isAsym ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${asymmetry.isAsym?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: asymmetry.isAsym ? '#ef4444' : '#22c55e' }}>Асимметрия {asymmetry.diff}% {asymmetry.isAsym ? `→ слабее ${asymmetry.weaker}` : '— в допуске'}</div>
                <div style={{ fontSize:10, color:DIM }}>Порог 10% (как в strength-sport-diagnostics).</div>
              </div>
            )}
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео (BlazePose) — опционально</div>
              <div style={{ marginTop:6, width:'100%', height:80, background:'rgba(255,255,255,0.03)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:11, border:'1px solid rgba(255,255,255,0.04)' }}>video preview — PRO TODO: BlazePose</div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ ...CARD, padding: 12, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.16)' }}>
        <div style={{ fontSize:11, color:DIM, marginBottom:6 }}>Выбрано: {weakPoints.length? weakPoints.map(w=>WL_WEAKPOINT_LABELS[w]||w).join(' · ') : '— баланс'} {asymmetry?.isAsym ? `· асимметрия ${asymmetry.diff}%` : ''}</div>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#a855f7)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в ТА-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
      </div>
    </div>
  );
};

export default WLDiagnosticsHub;
