/** LoadSafetyCard.tsx — здоровье/нагрузка/авторегуляция (ранее неиспользуемые движки).
 * REUSE: lms/cardio (buildCardioPlan/kcalForCardio), orthopedic-load-engines
 * (computeOrthopedicConstraints/distributeWeeklyLoad), pro/autoregulation-pro
 * (autoRegulate/loadForRPE/rpeFromLoad). */
import React, { useState, useMemo } from 'react';
import { buildCardioPlan, kcalForCardio, type CardioType } from '../../../engines/lms/cardio.engine';
import { computeOrthopedicConstraints, distributeWeeklyLoad } from '../../../engines/orthopedic-load-engines';
import { autoRegulate, loadForRPE, rpeFromLoad } from '../../../engines/pro/autoregulation-pro.engine';
import { loadTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const SEL = (extra?: React.CSSProperties): React.CSSProperties => ({ ...IN, ...extra });

const TYPE_RU: Record<CardioType, string> = { zone2: 'Zone 2 (аэробная)', hiit: 'HIIT (интервалы)', miss: 'Умеренная', recovery: 'Восстановительная' };

export const LoadSafetyCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [cardioGoal, setCardioGoal] = useState<'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery'>('cut');
  const [cardioDays, setCardioDays] = useState(2);
  const [injuries, setInjuries] = useState<string>('knee, shoulder');
  const [jointLim, setJointLim] = useState<string>('knee:mild, shoulder:none');
  const [sessions, setSessions] = useState(4);
  const [pri, setPri] = useState(70);
  const [risk, setRisk] = useState('low');
  const [e1rm, setE1rm] = useState(120);
  const [rpe, setRpe] = useState(8);
  const [reps, setReps] = useState(5);
  const [readiness, setReadiness] = useState(75);
  const [acwr, setAcwr] = useState(1.0);

  const cardioPlan = useMemo(() => buildCardioPlan({ goal: cardioGoal, bodyWeight: prof.bodyWeight, daysAvailable: cardioDays }), [cardioGoal, cardioDays, prof.bodyWeight]);
  const ortho = useMemo(() => computeOrthopedicConstraints({
    injuryHistory: injuries.split(',').map(s => s.trim()).filter(Boolean),
    jointLimitations: Object.fromEntries(jointLim.split(',').map(p => { const [j, l] = p.split(':').map(x => (x || '').trim()); return [j, l || 'none']; }).filter(p => p[0])),
    techniqueIssues: [], currentPain: [],
  }), [injuries, jointLim]);
  const dist = useMemo(() => distributeWeeklyLoad({ weeklySessions: sessions, goal: prof.goal || 'strength', volumeCapacity: 0.8, intensityCapacity: 0.85, priScore: pri, riskLevel: risk }), [sessions, prof.goal, pri, risk]);
  const reg = useMemo(() => autoRegulate({ readiness, acwr: { ratio: acwr, zone: acwr > 1.5 ? 'dangerous' : acwr > 1.3 ? 'caution' : acwr < 0.8 ? 'undertrained' : 'optimal' } }), [readiness, acwr]);
  const workWeight = useMemo(() => loadForRPE(e1rm, rpe, reps), [e1rm, rpe, reps]);
  const rpeBack = useMemo(() => rpeFromLoad(e1rm, workWeight, reps), [e1rm, workWeight, reps]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🫀 Кардио / нагрузка / авторегуляция</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Кардио-план, ортопедические ограничения, распределение недельной нагрузки и RPE-авторегуляция — ранее эти движки не использовались в UI.
      </div>

      <div style={CARD}>
        <div style={H}>🏃 Кардио-план</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Цель кардио</div>
            <select style={SEL()} value={cardioGoal} onChange={e => setCardioGoal(e.target.value as any)}>
              {['cut', 'mass', 'recomp', 'maintenance', 'recovery'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Дней кардио/нед</div><input type="number" min={0} max={6} style={IN} value={cardioDays} onChange={e => setCardioDays(parseInt(e.target.value) || 0)} /></div>
        </div>
        {cardioPlan.sessions.length === 0
          ? <div style={{ fontSize: 10, color: DIM }}>Для этой цели кардио не назначается.</div>
          : cardioPlan.sessions.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 4, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{TYPE_RU[s.type] || s.type}</span>
              <span style={{ color: DIM }}>{s.durationMin} мин ×{s.weeklyFrequency}/нед</span>
              <span style={{ color: DIM }}>{s.kcalPerSession} ккал/сесс</span>
              <span style={{ color: '#fff' }}>{s.purpose}</span>
            </div>
          ))}
        <div style={{ fontSize: 10, color: ACCENT, marginTop: 6 }}>Σ {cardioPlan.totalKcalPerWeek} ккал/нед</div>
      </div>

      <div style={CARD}>
        <div style={H}>🦴 Ортопедические ограничения</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Травмы (через запятую)</div><input type="text" style={IN} value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="knee, shoulder" /></div>
          <div><div style={LABEL}>Суставы: лимиты</div><input type="text" style={IN} value={jointLim} onChange={e => setJointLim(e.target.value)} placeholder="knee:mild, shoulder:none" /></div>
        </div>
        <div style={{ fontSize: 10, marginBottom: 4 }}><b style={{ color: '#ef4444' }}>Заблокированные паттерны:</b> {ortho.blockedPatterns.length ? ortho.blockedPatterns.join(', ') : 'нет'}</div>
        <div style={{ fontSize: 10, marginBottom: 4 }}><b style={{ color: '#22c55e' }}>Разрешённые:</b> {ortho.allowedPatterns.join(', ')}</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Фаза: <b style={{ color: ACCENT }}>{ortho.phase}</b></div>
        {ortho.recommendations.slice(0, 4).map((r, i) => <div key={i} style={{ fontSize: 9, color: DIM, marginTop: 2 }}>• {r}</div>)}
      </div>

      <div style={CARD}>
        <div style={H}>📅 Распределение недельной нагрузки</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Сессий/нед</div><input type="number" min={2} max={7} style={IN} value={sessions} onChange={e => setSessions(parseInt(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>PRI (0-100)</div><input type="number" min={0} max={100} style={IN} value={pri} onChange={e => setPri(parseInt(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Риск</div>
            <select style={SEL()} value={risk} onChange={e => setRisk(e.target.value)}>
              {['low', 'medium', 'high'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
          {dist.weekPlan.map((d, i) => (
            <div key={i} style={{ padding: '4px 6px', borderRadius: 6, background: d.difficulty === 'hard' ? 'rgba(239,68,68,0.08)' : d.difficulty === 'off' ? 'rgba(255,255,255,0.03)' : 'rgba(0,230,138,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>Д{d.day + 1}</span> <span style={{ color: DIM }}>{d.difficulty}</span>
              <div style={{ color: DIM, fontSize: 9 }}>V{d.volumeTarget.toFixed(2)} I{d.intensityTarget.toFixed(2)} · {d.focus}</div>
            </div>
          ))}
        </div>
        {dist.warnings.map((w, i) => <div key={i} style={{ fontSize: 9, color: '#eab308', marginTop: 4 }}>⚠ {w}</div>)}
      </div>

      <div style={CARD}>
        <div style={H}>⚙️ RPE-авторегуляция</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>e1RM, кг</div><input type="number" style={IN} value={e1rm} onChange={e => setE1rm(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Целевое RPE</div><input type="number" min={1} max={10} style={IN} value={rpe} onChange={e => setRpe(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Повторений</div><input type="number" style={IN} value={reps} onChange={e => setReps(parseInt(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Readiness (0-100)</div><input type="number" style={IN} value={readiness} onChange={e => setReadiness(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>ACWR (соот. нагрузки)</div><input type="number" step="0.1" style={IN} value={acwr} onChange={e => setAcwr(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 10, fontSize: 10 }}>
          <div>Рабочий вес для {reps}×@RPE {rpe}: <b style={{ color: ACCENT, fontSize: 14 }}>{workWeight} кг</b> (≈{Math.round(workWeight/e1rm*100)}% ПМ, обратный RPE {rpeBack.toFixed(1)})</div>
          <div style={{ marginTop: 6 }}><b>Корректировка плана по готовности:</b></div>
          <div style={{ color: DIM }}>Множитель топ-сета: ×{reg.topSetPctMultiplier.toFixed(2)} · объём: ×{reg.volumeMultiplier.toFixed(2)} · сдвиг RIR: {reg.rirShift > 0 ? '+' : ''}{reg.rirShift}{reg.deload ? ' · ДЕЛОД' : ''}</div>
          {reg.decisions.slice(0, 4).map((d, i) => <div key={i} style={{ color: DIM, marginTop: 2 }}>• {d}</div>)}
        </div>
      </div>
      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить авторегуляцию к планировщику: объём ×{reg.volumeMultiplier.toFixed(2)}, RIR +{reg.rirShift}, топ-сет ×{reg.topSetPctMultiplier.toFixed(2)} (готовность {readiness}, ACWR {acwr}).</div>
        <button onClick={() => applyToPlanner({ kind: 'pri', label: 'Авторег: объём ×' + reg.volumeMultiplier.toFixed(2) + ', RIR +' + reg.rirShift, data: { volumeMult: reg.volumeMultiplier, rirShift: reg.rirShift } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить авторегуляцию к планировщику</button>
      </div>
    </div>
  );
};
