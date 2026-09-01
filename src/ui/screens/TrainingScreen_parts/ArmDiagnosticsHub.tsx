/** ArmDiagnosticsHub.tsx — ХАБ диагностики армрестлинга/армлифтинга (PRO, уровень движения).
 *  Аналог DiagnosticsHub (9 лифтов, BlazePose, VBT) но для 8 арм-движений.
 *  4 подвкладки: Grip | Wrist/Rotation | Pressure | Tendon/Recovery
 *  - Углы РУ/РА/РН (motion-capture) + VBT + Force + EMG(опц) + дневник ACWR + видео
 *  - Score 0-100 + findings (ok/warn/critical) + verification + humerus/balance + table 3/2/1
 *  - Вывод в Арм-конструктор via planner-bridge (weakpoints, limiter, taper)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { getArmLandmarks } from '../../../engines/arm/arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from '../../../engines/arm/arm-injury-guard.engine';
import { tableWeekKind } from '../../../engines/arm/arm-table.engine';
import { buildArmDiagnosticsReport } from '../../../engines/arm/arm-diagnostics-hub.engine';
import { estimateArmAngles, validateArmAngles, recommendAnglesForTechnique } from '../../../engines/arm/arm-motion-capture.engine';
import { recordGripForce, estimateForceVector } from '../../../engines/arm/arm-force-capture.engine';
import { diagnoseVbt } from '../../../engines/arm/arm-vbt-capture.engine';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';

const STORAGE_KEY = 'he_arm_diagnostics_hub_v2';

type HubTab = 'grip' | 'wrist' | 'pressure' | 'recovery';

type ArmDiagState = {
  rtKg: string;
  axleKg: string;
  pinchSec: string;
  sideKg: string;
  backKg: string;
  cup: boolean;
  rising: boolean;
  pron: boolean;
  sup: boolean;
  side: boolean;
  back: boolean;
  technique: string;
  level: string;
  elbowDeg: string;
  forearmDeg: string;
  wristDeg: string;
  direction: 'to_little' | 'to_middle' | 'to_thumb';
  vbtWeight: string;
  vbtReps: string;
  vbtVel: string;
};

const DEFAULT_STATE: ArmDiagState = {
  rtKg: '', axleKg: '', pinchSec: '', sideKg: '', backKg: '',
  cup: false, rising: false, pron: false, sup: false, side: false, back: false,
  technique: 'balanced', level: 'intermediate',
  elbowDeg: '110', forearmDeg: '90', wristDeg: '10', direction: 'to_middle',
  vbtWeight: '', vbtReps: '', vbtVel: '',
};

const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
  { id: 'enhanced', label: 'Enhanced' },
];

const TAB_DEFS: Array<{ id: HubTab; label: string; icon: string; desc: string }> = [
  { id: 'grip', label: 'Хват', icon: '✊', desc: 'RT/Axle/Pinch + нормы' },
  { id: 'wrist', label: 'Кисть/Ротация', icon: '🤚', desc: 'Cup/Rising/Pron/Sup + РУ/РА + VBT' },
  { id: 'pressure', label: 'Давление', icon: '💥', desc: 'Side/Back + humerus + table 3/2/1' },
  { id: 'recovery', label: 'Сухожилие/Восстановление', icon: '🛡️', desc: 'Tendon + ACWR + дневник' },
];

export const ArmDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<ArmDiagState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<HubTab>('grip');
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // ACWR from diary
  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      return acuteChronicRatio(toDailyLoads(srpe as any));
    } catch { return null; }
  }, []);

  const diag = useMemo(() => diagnoseArmWeakPoint({
    weakTest: {
      cupFails: state.cup,
      risingFails: state.rising,
      pronationFails: state.pron,
      supinationFails: state.sup,
      sidePressureFails: state.side,
      backPressureFails: state.back,
      gripSupportMaxKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
      gripAxleMaxKg: state.axleKg ? parseFloat(state.axleKg) : undefined,
      pinchHoldSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined,
    },
    technique: state.technique,
  }), [state]);

  const forceVec = useMemo(() => estimateForceVector(recordGripForce({
    rtKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
    axleKg: state.axleKg ? parseFloat(state.axleKg) : undefined,
    pinchSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined,
    sideKg: state.sideKg ? parseFloat(state.sideKg) : undefined,
    backKg: state.backKg ? parseFloat(state.backKg) : undefined,
  })), [state.rtKg, state.axleKg, state.pinchSec, state.sideKg, state.backKg]);

  const angles = useMemo(() => estimateArmAngles({
    elbowDeg: parseFloat(state.elbowDeg) || 110,
    forearmDeg: parseFloat(state.forearmDeg) || 90,
    wristDeg: parseFloat(state.wristDeg) || 10,
    direction: state.direction,
  }), [state.elbowDeg, state.forearmDeg, state.wristDeg, state.direction]);

  const angleValid = useMemo(() => validateArmAngles(angles), [angles]);
  const recAngles = useMemo(() => recommendAnglesForTechnique(state.technique), [state.technique]);

  const vbt = useMemo(() => {
    const w = parseFloat(state.vbtWeight);
    const r = parseInt(state.vbtReps, 10);
    const v = parseFloat(state.vbtVel);
    if (!Number.isFinite(w) || !Number.isFinite(r) || !Number.isFinite(v)) return diagnoseVbt([]);
    // два замера: лучший и последний (симуляция)
    return diagnoseVbt([{ weight: w, reps: r, velocityMs: v + 0.2 }, { weight: w, reps: r, velocityMs: v }]);
  }, [state.vbtWeight, state.vbtReps, state.vbtVel]);

  const report = useMemo(() => buildArmDiagnosticsReport({
    weakTest: {
      cupFails: state.cup, risingFails: state.rising, pronationFails: state.pron, supinationFails: state.sup, sidePressureFails: state.side, backPressureFails: state.back,
    },
    grip: { rtKg: state.rtKg ? parseFloat(state.rtKg) : undefined, axleKg: state.axleKg ? parseFloat(state.axleKg) : undefined, pinchSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined, sideKg: state.sideKg ? parseFloat(state.sideKg) : undefined, backKg: state.backKg ? parseFloat(state.backKg) : undefined },
    vbtRecords: (state.vbtWeight && state.vbtVel) ? [{ weight: parseFloat(state.vbtWeight), reps: parseInt(state.vbtReps||'5',10), velocityMs: parseFloat(state.vbtVel) }] : [],
    level: state.level,
    technique: state.technique,
    tableSessions: 2, totalSessions: 4, tendonSets: (state.cup?4:0)+(state.pron?6:0)+(state.sup?4:0)+8,
  }), [state]);

  const mockGuard = useMemo(() => {
    const mockPlan: any = {
      weeks: [
        { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: state.side ? 8 : 3 }] }] },
        { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: state.side ? 8 : 3 }] }] },
      ],
    };
    return {
      humerus: checkHumerusGuard(mockPlan),
      balance: checkWristBalance({ weeks: [{ sessions: [{ exercises: [{ muscle: 'pronators', sets: state.pron ? 6 : 4 }, { muscle: 'supinators', sets: state.sup ? 2 : 4 }] }] }] } as any),
    };
  }, [state.side, state.pron, state.sup]);

  const landmarks = useMemo(() => {
    const lvl = state.level as any;
    return {
      wrist: getArmLandmarks(lvl, 'wrist_flexors'),
      pron: getArmLandmarks(lvl, 'pronators'),
      side: getArmLandmarks(lvl, 'side_pressure'),
      grip: getArmLandmarks(lvl, 'grip_support'),
    };
  }, [state.level]);

  const applyToConstructor = () => {
    const groups = diag.weakMuscles.slice(0, 2);
    if (groups.length === 0) {
      setToast('Слабые зоны не выявлены — нечего применять');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    applyToPlanner({
      kind: 'weakpoints',
      label: `Арм диагностика: ${groups.join(', ')}`,
      data: { groups, armTechnique: state.technique, armDiag: state, armAngles: angles, armForce: forceVec, armVbt: vbt } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в Арм-конструктор: ${groups.map(g=>ARM_MUSCLE_RU[g as any]||g).join(', ')}`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'arm' } as any));
      localStorage.setItem('he_training_planning_track', 'arm');
    } catch {}
  };

  const toggle = (k: keyof ArmDiagState) => setState(s => ({ ...s, [k]: !s[k] as any }));

  const tablePreview = Array.from({ length: 6 }, (_, i) => {
    const wk = i + 1;
    const kind = tableWeekKind(wk, 12);
    return { wk, kind };
  });

  // Score color
  const scoreColor = report.score >= 80 ? '#22c55e' : report.score >= 50 ? '#f59e0b' : '#ef4444';
  const verText = report.verification === 1 ? 'верифицировано' : report.verification === 0.5 ? 'частично' : 'не верифицировано';

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      {/* Header score */}
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(245,158,11,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Арм-диагностика — хаб движения PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>8 движений × РУ/РА/РН × VBT × Force × EMG(опц) × ACWR. Как диагностика движения 9 лифтов — с углами, скоростью и видео.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${scoreColor} ${report.score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${scoreColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{report.score}</div>
            <div style={{ fontSize: 9, color: scoreColor, fontWeight: 700, marginTop: 2 }}>{report.level === 'ok' ? 'ОК' : report.level === 'warn' ? 'WARN' : 'CRITICAL'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: report.verification===1?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', border:`1px solid ${report.verification===1?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, color: report.verification===1?'#22c55e':'#ef4444' }}>{verText} · {Math.round(report.verification*100)}% {hasGrip => hasGrip}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone==='dangerous'?'🔴': acwr.zone==='caution'?'🟠':'🟢') : ''}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>Table {(report.tableRatio*100).toFixed(0)}%</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>Tendon {report.tendonLoad}</span>
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери провалы + хват + углы + VBT → получи слабые мышцы, MEV/MRV, humerus-risk и точечные коррекции. Кнопка <b style={{ color: '#f59e0b' }}>«Применить в Арм-конструктор»</b> отправит слабые зоны в планировщик (via <code>planner-bridge</code>). Видео — опционально (BlazePose).
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      {/* Controls */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: DIM }}>Уровень<br/>
            <select value={state.level} onChange={e=>setState(s=>({...s, level:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              {LEVEL_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: DIM }}>Техника<br/>
            <select value={state.technique} onChange={e=>setState(s=>({...s, technique:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="balanced">Сбалансировано</option><option value="hook">Хук</option><option value="toproll">Топролл</option><option value="press">Пресс</option>
            </select>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={applyToConstructor} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>→ Применить в Арм-конструктор</button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id} style={{ padding:'6px 12px', borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#f59e0b' : '#1f3a5f', background: tab===t.id ? 'rgba(245,158,11,0.14)' : '#0a1629', color: tab===t.id ? '#f59e0b' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='grip' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: DIM }}>Rolling Thunder кг<br/><input value={state.rtKg} onChange={e=>setState(s=>({...s, rtKg:e.target.value}))} placeholder="60" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Axle кг<br/><input value={state.axleKg} onChange={e=>setState(s=>({...s, axleKg:e.target.value}))} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Pinch сек<br/><input value={state.pinchSec} onChange={e=>setState(s=>({...s, pinchSec:e.target.value}))} placeholder="15" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Force Vector</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Support {forceVec.gripSupport} · Pinch {forceVec.gripPinch} · Side {forceVec.sidePressure} · Back {forceVec.backPressure} → <b style={{color:ACCENT}}>{forceVec.totalScore}</b></div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>VBT</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{vbt.advice} {vbt.e1RM? `· e1RM ${vbt.e1RM}кг` : ''}</div>
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  <input value={state.vbtWeight} onChange={e=>setState(s=>({...s, vbtWeight:e.target.value}))} placeholder="кг" style={{ flex:1, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                  <input value={state.vbtReps} onChange={e=>setState(s=>({...s, vbtReps:e.target.value}))} placeholder="повт" style={{ width:60, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                  <input value={state.vbtVel} onChange={e=>setState(s=>({...s, vbtVel:e.target.value}))} placeholder="м/с" style={{ width:60, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize:10, color:DIM }}>Нормы IronMind: RT 55 avg /84 accomplished /113 world-class. Axle 150 world-class.</div>
          </div>
        )}

        {tab==='wrist' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Локоть°<br/><input value={state.elbowDeg} onChange={e=>setState(s=>({...s, elbowDeg:e.target.value}))} placeholder="110" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Предплечье°<br/><input value={state.forearmDeg} onChange={e=>setState(s=>({...s, forearmDeg:e.target.value}))} placeholder="90" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Кисть°<br/><input value={state.wristDeg} onChange={e=>setState(s=>({...s, wristDeg:e.target.value}))} placeholder="10" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Направление<br/>
                <select value={state.direction} onChange={e=>setState(s=>({...s, direction:e.target.value as any}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }}>
                  <option value="to_little">К мизинцу</option><option value="to_middle">К среднему</option><option value="to_thumb">К большому</option>
                </select>
              </label>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background: angleValid.valid? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${angleValid.valid?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color: angleValid.valid?'#22c55e':'#ef4444' }}>РУ: {angles.elbowDeg}° · {angles.direction} · pron {angles.pronDeg}° sup {angles.supDeg}°</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{angleValid.valid? '✓ В допуске' : angleValid.warnings.join(' · ')}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Рекомендация для {state.technique}: {recAngles.elbowDeg}° {recAngles.direction} (как в DiagnosticsHub — углы из цикла)</div>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео (BlazePose) — опционально</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Загрузи видео спарринга — углы посчитаются автоматически (как в Диагностике движения). Сейчас — ручной ввод.</div>
              <div style={{ marginTop:6, width:'100%', height:80, background:'rgba(255,255,255,0.03)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:11, border:'1px solid rgba(255,255,255,0.04)' }}>video preview — PRO TODO: BlazePose</div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
              {[
                ['cup','Кисть открывается (cup)'],
                ['rising','Пальцы уходят (rising)'],
                ['pron','Топролл не держит (pron)'],
                ['sup','Хук проваливается (sup)'],
              ].map(([k,label]) => (
                <button key={k} onClick={()=>toggle(k as any)} aria-pressed={!!(state as any)[k]} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor:(state as any)[k] ? '#f59e0b' : '#1f3a5f', background:(state as any)[k] ? 'rgba(245,158,11,0.14)' : '#0a1629', color:(state as any)[k] ? '#f59e0b' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab==='pressure' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Side кг (блок)<br/><input value={state.sideKg} onChange={e=>setState(s=>({...s, sideKg:e.target.value}))} placeholder="30" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Back кг (тяга)<br/><input value={state.backKg} onChange={e=>setState(s=>({...s, backKg:e.target.value}))} placeholder="50" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {[
                ['side','Не дожимает боком (side)'],
                ['back','Тяга слабая (back)'],
              ].map(([k,label]) => (
                <button key={k} onClick={()=>toggle(k as any)} aria-pressed={!!(state as any)[k]} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor:(state as any)[k] ? '#ef4444' : '#1f3a5f', background:(state as any)[k] ? 'rgba(239,68,68,0.12)' : '#0a1629', color:(state as any)[k] ? '#ef4444' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background: mockGuard.humerus.length? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mockGuard.humerus.length?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: mockGuard.humerus.length?'#ef4444':'#22c55e' }}>Humerus (side)</div>
                <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{mockGuard.humerus.length? mockGuard.humerus.join(' · ') : '✓ Нет риска: side ≤3, RIR≥2, прогрессия ≤10%/нед'}</div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Force Vector</div>
                <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Side {forceVec.sidePressure} · Back {forceVec.backPressure} · Total {forceVec.totalScore}</div>
              </div>
            </div>
          </div>
        )}

        {tab==='recovery' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background: acwr && acwr.zone==='dangerous' ? 'rgba(239,68,68,0.08)' : acwr && acwr.zone==='caution' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${acwr && acwr.zone==='dangerous'?'rgba(239,68,68,0.2)': acwr && acwr.zone==='caution'?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: acwr && acwr.zone==='dangerous'?'#ef4444': acwr && acwr.zone==='caution'?'#f59e0b':'#22c55e' }}>ACWR {acwr? acwr.ratio.toFixed(2) : '—'}</div>
                <div style={{ fontSize:10, color:DIM }}>{acwr? acwr.zone : 'нет данных (нужен дневник sRPE)'}</div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Tendon Load</div>
                <div style={{ fontSize:10, color:DIM }}>{report.tendonLoad} сетов/нед {report.tendonLoad>18?'⚠ >18':''} · Side MRV {landmarks.side.mrv}</div>
              </div>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background: report.verification===1?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${report.verification===1?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color: report.verification===1?'#22c55e':'#ef4444' }}>Верификация {Math.round(report.verification*100)}% — {verText}</div>
              <div style={{ fontSize:10, color:DIM }}>Хват + углы + VBT: чем больше вводов, тем точнее. Как в diagnostics — 0% = по фармакологии, 100% = по анализам.</div>
            </div>
            <div style={{ fontSize:10, color:DIM, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <b style={{ color:'#fff' }}>Рекомендация ACWR:</b> {acwr && acwr.zone==='dangerous' ? 'снизь объём ×0.65, RIR+2, делод' : acwr && acwr.zone==='caution' ? '×0.85, RIR+1' : 'оптимум — держи курс (taper 0.65/0.45)'}
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics output */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🔬 Диагностика — слабые звенья + score</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ width:44, height:44, borderRadius:22, background: `conic-gradient(${scoreColor} ${report.score}%, rgba(255,255,255,0.06) 0)`, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${scoreColor}`, fontWeight:900, color:'#fff', fontSize:13 }}>{report.score}</div>
          <div style={{ fontSize:11, color:DIM }}>Уровень <b style={{color:scoreColor}}>{report.level}</b> · {report.findings.slice(0,2).map(f=>f.text).join(' · ')}</div>
        </div>
        {diag.priorities.length===0 ? <div style={{ fontSize:11, color:DIM }}>Слабые зоны не выявлены — баланс.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {diag.priorities.map((p,i)=>(
              <div key={i} style={{ padding:'10px 12px', borderRadius:10, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ARM_MUSCLE_RU[p.muscle as any] || p.muscle}</span>
                  <span style={{ fontSize:10, color:DIM }}>{p.reason}</span>
                </div>
                <div style={{ fontSize:11, color:'#5ee', marginBottom:6 }}>{p.exercises.join(' · ')}</div>
                <div style={{ fontSize:10, color:DIM }}>MEV {getArmLandmarks(state.level, p.muscle).mev} · MAV {getArmLandmarks(state.level, p.muscle).mav} · MRV <b style={{color:'#fff'}}>{getArmLandmarks(state.level, p.muscle).mrv}</b></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table periodization */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🗓 Стол — периодизация 3/2/1 (Кузнецов VIII)</div>
        <div style={{ display:'flex', gap:2, marginBottom:6 }}>
          {tablePreview.map(({ wk, kind }) => {
            const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
            return <div key={wk} style={{ flex:1, height:18, background:col, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:700 }}>{wk}</div>;
          })}
        </div>
        <div style={{ fontSize:10, color:DIM }}>≥50% тренировок — стол. Тейпер 2–3 нед: 0.65/0.45, side×0.5, RIR+1/+2.</div>
      </div>

      {/* Action */}
      <div style={{ ...CARD, padding: 12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)' }}>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Арм-конструктор ({diag.weakMuscles.slice(0,2).join(', ') || 'баланс'})</button>
        <div style={{ fontSize:10, color:DIM, marginTop:6, textAlign:'center' }}>Bridge: <code>weakpoints</code> → <code>ArmAutoConstructor</code> via <code>planner-bridge</code></div>
      </div>
    </div>
  );
};

export default ArmDiagnosticsHub;
