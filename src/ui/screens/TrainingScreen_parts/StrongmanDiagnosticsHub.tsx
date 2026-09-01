/** StrongmanDiagnosticsHub.tsx — ХАБ диагностики стронгмена (PRO).
 *  4 подвкладки: Жим | Переноски | Загрузки | Хват/Кор
 *  - Ивенты: log/axle/yoke/farmers/frame/stone/sandbag/keg/carDeadlift (из EVENT_META)
 *  - Grip, core, conditioning, injury (yoke — колено/спина), VBT
 *  - Вывод в конструктор Стронг+ТА via planner-bridge (mode:strongman)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { EVENT_META } from '../../../engines/strength-sport/strength-sport-event-types';
import { CONTEST_PRESETS } from '../../../engines/strength-sport/strength-sport-contest.types';
import { WL_WEAKPOINT_LABELS } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';

const STORAGE_KEY = 'he_strongman_diagnostics_hub_v1';

type SMTab = 'press' | 'carry' | 'load' | 'grip';

type SMState = {
  pressWeak: string[];
  carryWeak: string[];
  loadWeak: string[];
  gripWeak: string[];
  yokeKg: string;
  farmersKg: string;
  stoneKg: string;
  logKg: string;
  gripHoldSec: string;
  corePlankSec: string;
};

const DEFAULT_STATE: SMState = {
  pressWeak: [], carryWeak: [], loadWeak: [], gripWeak: [],
  yokeKg: '', farmersKg: '', stoneKg: '', logKg: '', gripHoldSec: '', corePlankSec: '',
};

const TAB_DEFS: Array<{ id: SMTab; label: string; icon: string; desc: string }> = [
  { id: 'press', label: 'Жим', icon: '🏋️', desc: 'лог/аксель/жим' },
  { id: 'carry', label: 'Переноски', icon: '🚜', desc: 'йок/фермер/рама' },
  { id: 'load', label: 'Загрузки', icon: '🪨', desc: 'камни/мешок/кега' },
  { id: 'grip', label: 'Хват/Кор', icon: '✊', desc: 'хват + кор + кондиция' },
];

const PRESS_OPTS = [
  { id: 'press_start', label: WL_WEAKPOINT_LABELS.press_start },
  { id: 'jerk_lockout', label: WL_WEAKPOINT_LABELS.jerk_lockout },
  { id: 'jerk_drive', label: WL_WEAKPOINT_LABELS.jerk_drive },
];
const CARRY_OPTS = [
  { id: 'squat_bottom', label: 'Йок: низ (глубина)' },
  { id: 'squat_mid', label: 'Йок: середина' },
  { id: 'pull_start', label: 'Фермер: старт' },
];
const LOAD_OPTS = [
  { id: 'pull_start', label: 'Камень: отрыв' },
  { id: 'squat_bottom', label: 'Камень: загрузка' },
  { id: 'press_start', label: 'Мешок: жим' },
];
const GRIP_OPTS = [
  { id: 'grip', label: 'Хват слаб' },
  { id: 'core', label: 'Кор слаб' },
  { id: 'conditioning', label: 'Кондиция' },
];

export const StrongmanDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<SMState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<SMTab>('press');
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
    const all = [...state.pressWeak, ...state.carryWeak, ...state.loadWeak, ...state.gripWeak];
    return Array.from(new Set(all)).slice(0, 3);
  }, [state.pressWeak, state.carryWeak, state.loadWeak, state.gripWeak]);

  const score = useMemo(() => {
    let s = 100;
    s -= weakPoints.length * 12;
    if (state.yokeKg && parseFloat(state.yokeKg) < 200) s -= 10;
    if (state.farmersKg && parseFloat(state.farmersKg) < 100) s -= 10;
    if (state.gripHoldSec && parseFloat(state.gripHoldSec) < 30) s -= 10;
    return Math.max(0, Math.min(100, Math.round(s)));
  }, [weakPoints, state.yokeKg, state.farmersKg, state.gripHoldSec]);

  const level: 'ok'|'warn'|'critical' = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';
  const scoreColor = level === 'ok' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444';

  const toggle = (key: keyof Pick<SMState, 'pressWeak'|'carryWeak'|'loadWeak'|'gripWeak'>, id: string) => {
    setState(s => {
      const arr = (s as any)[key] as string[];
      const has = arr.includes(id);
      const next = has ? arr.filter(x=>x!==id) : [...arr, id].slice(0,2);
      return { ...s, [key]: next };
    });
  };

  const applyToConstructor = () => {
    if (weakPoints.length===0) {
      setToast('Слабые зоны не выбраны');
      setTimeout(()=>setToast(''),2500);
      return;
    }
    applyToPlanner({
      kind: 'weakpoints',
      label: `Стронг диагностика: ${weakPoints.join(', ')}`,
      data: { groups: weakPoints, smWeakPoints: weakPoints, smContest: CONTEST_PRESETS[0] } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в Стронг-конструктор: ${weakPoints.join(', ')}`);
    setTimeout(()=>setToast(''),3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'strength' } as any));
      localStorage.setItem('he_training_planning_track', 'strength');
      localStorage.setItem('he_strength_sport_mode', 'strongman');
    } catch {}
  };

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.12))', border: '1px solid rgba(239,68,68,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(239,68,68,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🏋️‍♂️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Стронгмен-диагностика — хаб PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>4 ивента (жим/переноски/загрузки/хват) × углы + VBT + кондиция + травмы. Как диагностика — с видео и коррекциями.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${scoreColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${scoreColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: scoreColor, fontWeight: 700, marginTop: 2 }}>{level==='ok'?'ОК':level==='warn'?'WARN':'CRITICAL'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{weakPoints.length? `${weakPoints.length} слабые` : 'баланс'}</span>
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые ивенты + введи максимумы → получи коррекции. Кнопка <b style={{ color: '#f59e0b' }}>«Применить в Стронг-конструктор»</b> отправит в планировщик (mode:strongman).
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id} style={{ padding:'6px 12px', borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#ef4444' : '#1f3a5f', background: tab===t.id ? 'rgba(239,68,68,0.14)' : '#0a1629', color: tab===t.id ? '#ef4444' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>→ Применить в Стронг</button>
        </div>

        {tab==='press' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Жим — лог/аксель</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {PRESS_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('pressWeak', o.id)} aria-pressed={state.pressWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.pressWeak.includes(o.id) ? '#ef4444' : '#1f3a5f', background: state.pressWeak.includes(o.id) ? 'rgba(239,68,68,0.14)' : '#0a1629', color: state.pressWeak.includes(o.id) ? '#ef4444' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Лог кг<br/><input value={state.logKg} onChange={e=>setState(s=>({...s, logKg:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Аксель кг<br/><input value={state.stoneKg} onChange={e=>setState(s=>({...s, stoneKg:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Ивенты: {Object.keys(EVENT_META).slice(0,4).join(', ')} — берётся из <code>EVENT_META</code></div>
          </div>
        )}

        {tab==='carry' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Переноски — йок/фермер/рама</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {CARRY_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('carryWeak', o.id)} aria-pressed={state.carryWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.carryWeak.includes(o.id) ? '#f59e0b' : '#1f3a5f', background: state.carryWeak.includes(o.id) ? 'rgba(245,158,11,0.14)' : '#0a1629', color: state.carryWeak.includes(o.id) ? '#f59e0b' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Йок кг<br/><input value={state.yokeKg} onChange={e=>setState(s=>({...s, yokeKg:e.target.value}))} placeholder="300" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Фермер кг (на руку)<br/><input value={state.farmersKg} onChange={e=>setState(s=>({...s, farmersKg:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео переноски — опционально</div>
              <div style={{ marginTop:6, width:'100%', height:80, background:'rgba(255,255,255,0.03)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:11, border:'1px solid rgba(255,255,255,0.04)' }}>video preview — BlazePose TODO</div>
            </div>
          </div>
        )}

        {tab==='load' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Загрузки — камни/мешок/кега/автотяга</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {LOAD_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('loadWeak', o.id)} aria-pressed={state.loadWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.loadWeak.includes(o.id) ? '#22c55e' : '#1f3a5f', background: state.loadWeak.includes(o.id) ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.loadWeak.includes(o.id) ? '#22c55e' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Камень кг<br/><input value={state.stoneKg} onChange={e=>setState(s=>({...s, stoneKg:e.target.value}))} placeholder="140" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Мешок кг<br/><input value={state.yokeKg} onChange={e=>setState(s=>({...s, yokeKg:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Контест пресеты: {Object.values(CONTEST_PRESETS as any).slice(0,3).map((c:any)=>c.name).join(', ')}</div>
          </div>
        )}

        {tab==='grip' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Хват / Кор / Кондиция</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {GRIP_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('gripWeak', o.id)} aria-pressed={state.gripWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.gripWeak.includes(o.id) ? '#a855f7' : '#1f3a5f', background: state.gripWeak.includes(o.id) ? 'rgba(168,85,247,0.14)' : '#0a1629', color: state.gripWeak.includes(o.id) ? '#a855f7' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Хват удержание сек<br/><input value={state.gripHoldSec} onChange={e=>setState(s=>({...s, gripHoldSec:e.target.value}))} placeholder="60" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Планка сек<br/><input value={state.corePlankSec} onChange={e=>setState(s=>({...s, corePlankSec:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>ACWR {acwr? `${acwr.ratio.toFixed(2)} ${acwr.zone}` : '—'} · grip/core/conditioning — как в `strength-sport-conditioning`</div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.16)' }}>
        <div style={{ fontSize:11, color:DIM, marginBottom:6 }}>Выбрано: {weakPoints.length? weakPoints.join(' · ') : '— баланс'}</div>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Стронг-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
      </div>
    </div>
  );
};

export default StrongmanDiagnosticsHub;
