/** LoadSafetyCard.tsx — здоровье/нагрузка/авторегуляция.
 * Раньше 4 разных инструмента были в одном полотне с 1 кнопкой применения.
 * Теперь: подвкладки (Кардио / Ортопедия / Неделя / Авторегуляция) —
 * каждый блок имеет собственную кнопку «Применить к планировщику». */
import React, { useState, useMemo } from 'react';
import { buildCardioPlan, type CardioType } from '../../../engines/lms/cardio.engine';
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
const BTN: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 };
const APPLY_BOX: React.CSSProperties = { marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' };
const APPLY_HINT: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 };

const TYPE_RU: Record<CardioType, string> = { zone2: 'Zone 2 (аэробная)', hiit: 'HIIT (интервалы)', miss: 'Умеренная', recovery: 'Восстановительная' };

type SubTab = 'cardio' | 'ortho' | 'weekly' | 'autoreg';
const SUBTABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'cardio', label: 'Кардио', icon: '🏃' },
  { id: 'ortho', label: 'Ортопедия', icon: '🦴' },
  { id: 'weekly', label: 'Неделя', icon: '📅' },
  { id: 'autoreg', label: 'Авторег', icon: '⚙️' },
];

// Маппинг травма → группа мышц (для приоритета/исключения в плане)
const INJURY_TO_GROUP: Record<string, string> = {
  knee: 'legs', shin: 'legs', ankle: 'legs', hip: 'legs', groin: 'legs',
  shoulder: 'shoulders', rotator: 'shoulders', cuff: 'shoulders',
  elbow: 'arms', biceps: 'arms', triceps: 'arms',
  wrist: 'arms', forearm: 'arms',
  lower_back: 'back', lumbar: 'back', spine: 'back', disc: 'back',
  neck: 'back', trap: 'back',
  chest: 'chest', pec: 'chest',
};

export const LoadSafetyCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [subTab, setSubTab] = useState<SubTab>('cardio');
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

  // === Кнопки применения для каждого блока ===
  const applyCardio = () => {
    const totalKcal = cardioPlan.totalKcalPerWeek;
    const sessionsCount = cardioPlan.sessions.length;
    // кардио добавляет усталость → лёгкое снижение объёма (5-10% при 3+ сессиях)
    const mult = sessionsCount >= 3 ? 0.9 : sessionsCount > 0 ? 0.95 : 1;
    applyToPlanner({ kind: 'pri', label: 'Кардио: ' + sessionsCount + ' сессий, ' + totalKcal + ' ккал/нед → объём ×' + mult, data: { volumeMult: mult, rirShift: 0 } });
  };
  const applyOrtho = () => {
    const groups = Array.from(new Set(
      injuries.split(',').map(s => s.trim().toLowerCase()).map(inj => INJURY_TO_GROUP[inj]).filter(Boolean)
    )) as string[];
    applyToPlanner({ kind: 'weakpoints', label: 'Ортопедия: травмы → аккуратность с группами ' + (groups.join(', ') || 'не указаны'), data: { groups, lift: undefined } });
  };
  const applyWeekly = () => {
    // средняя сложность недели → volumeMult
    const hardDays = dist.weekPlan.filter(d => d.difficulty === 'hard').length;
    const mult = hardDays >= 4 ? 0.85 : hardDays >= 3 ? 0.9 : 1;
    applyToPlanner({ kind: 'pri', label: 'Распределение недели: ' + sessions + ' сессий, ' + hardDays + ' тяж. дней → объём ×' + mult, data: { volumeMult: mult, rirShift: 0 } });
  };
  const applyAutoreg = () => {
    applyToPlanner({ kind: 'pri', label: 'Авторег: объём ×' + reg.volumeMultiplier.toFixed(2) + ', RIR +' + reg.rirShift, data: { volumeMult: reg.volumeMultiplier, rirShift: reg.rirShift } });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🫀 Нагрузка и безопасность</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Кардио-план, ортопедические ограничения, распределение недельной нагрузки и RPE-авторегуляция. Каждая подвкладка имеет собственную кнопку применения к планировщику.
      </div>

      {/* Подвкладки */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            border: subTab === t.id ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: subTab === t.id ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: subTab === t.id ? ACCENT : DIM,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── КАРДИО ── */}
      {subTab === 'cardio' && (
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
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 4, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, minWidth: 360, overflowX: 'auto' }}>
                <span style={{ color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>{TYPE_RU[s.type] || s.type}</span>
                <span style={{ color: DIM, whiteSpace: 'nowrap' }}>{s.durationMin} мин ×{s.weeklyFrequency}/нед</span>
                <span style={{ color: DIM, whiteSpace: 'nowrap' }}>{s.kcalPerSession} ккал/сесс</span>
                <span style={{ color: '#fff', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{s.purpose}</span>
              </div>
            ))}
          <div style={{ fontSize: 10, color: ACCENT, marginTop: 6 }}>Σ {cardioPlan.totalKcalPerWeek} ккал/нед</div>
          <div style={APPLY_BOX}>
            <div style={APPLY_HINT}>🔗 Применить кардио-нагрузку к планировщику: кардио добавляет усталость → объём силовых снижается (3+ сессий = −10%, 1-2 = −5%).</div>
            <button onClick={applyCardio} style={BTN}>🛠 Применить кардио к планировщику</button>
          </div>
        </div>
      )}

      {/* ── ОРТОПЕДИЯ ── */}
      {subTab === 'ortho' && (
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
          <div style={APPLY_BOX}>
            <div style={APPLY_HINT}>🔗 Применить ограничения к планировщику: травмированные группы получат приоритет на аккуратную нагрузку (↓RIR, изоляция вместо компаунда).</div>
            <button onClick={applyOrtho} style={BTN}>🛠 Применить ортопедию к планировщику</button>
          </div>
        </div>
      )}

      {/* ── РАСПРЕДЕЛЕНИЕ НЕДЕЛИ ── */}
      {subTab === 'weekly' && (
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
          <div style={APPLY_BOX}>
            <div style={APPLY_HINT}>🔗 Применить распределение недели к планировщику: 3+ тяжёлых дней → объём ×0.85-0.9 (восстановление между сессиями).</div>
            <button onClick={applyWeekly} style={BTN}>🛠 Применить распределение к планировщику</button>
          </div>
        </div>
      )}

      {/* ── АВТОРЕГУЛЯЦИЯ ── */}
      {subTab === 'autoreg' && (
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
            <div>Рабочий вес для {reps}×@RPE {rpe}: <b style={{ color: ACCENT, fontSize: 14 }}>{workWeight} кг</b> (≈{Math.round(workWeight / e1rm * 100)}% ПМ, обратный RPE {rpeBack.toFixed(1)})</div>
            <div style={{ marginTop: 6 }}><b>Корректировка плана по готовности:</b></div>
            <div style={{ color: DIM }}>Множитель топ-сета: ×{reg.topSetPctMultiplier.toFixed(2)} · объём: ×{reg.volumeMultiplier.toFixed(2)} · сдвиг RIR: {reg.rirShift > 0 ? '+' : ''}{reg.rirShift}{reg.deload ? ' · ДЕЛОД' : ''}</div>
            {reg.decisions.slice(0, 4).map((d, i) => <div key={i} style={{ color: DIM, marginTop: 2 }}>• {d}</div>)}
          </div>
          <div style={APPLY_BOX}>
            <div style={APPLY_HINT}>🔗 Применить авторегуляцию к планировщику: объём ×{reg.volumeMultiplier.toFixed(2)}, RIR +{reg.rirShift}, топ-сет ×{reg.topSetPctMultiplier.toFixed(2)} (готовность {readiness}, ACWR {acwr}).</div>
            <button onClick={applyAutoreg} style={BTN}>🛠 Применить авторегуляцию к планировщику</button>
          </div>
        </div>
      )}
    </div>
  );
};