/** CompetitionCard.tsx — соревнования (ранее неиспользуемые gym-competition).
 * REUSE: selectWeightClass, generateAttemptStrategy, generateCompetitionTimeline,
 * getRecoveryProtocols, getMentalRoutines. */
import React, { useState, useMemo } from 'react';
import {
  selectWeightClass, generateAttemptStrategy, generateCompetitionTimeline,
  getRecoveryProtocols, getMentalRoutines,
} from '../../../engines/gym-competition.engine';
import { loadTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

export const CompetitionCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [bw, setBw] = useState(prof.bodyWeight || 80);
  const [fed, setFed] = useState('IPF');
  const [squat, setSquat] = useState(prof.pmSquat || 120);
  const [bench, setBench] = useState(prof.pmBench || 90);
  const [dead, setDead] = useState(prof.pmDead || 150);
  const [weighIn, setWeighIn] = useState('08:00');
  const [start, setStart] = useState('11:00');

  const cls = useMemo(() => selectWeightClass(bw, fed), [bw, fed]);
  const attempts = useMemo(() => generateAttemptStrategy(squat, bench, dead), [squat, bench, dead]);
  const timeline = useMemo(() => generateCompetitionTimeline(weighIn, start), [weighIn, start]);
  const recovery = useMemo(() => getRecoveryProtocols(), []);
  const mental = useMemo(() => getMentalRoutines(), []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🏆 Соревнование (ПЛ)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Весовая категория, стратегия подходов, таймлайн дня, восстановление и ментальные рутины. Ранее gym-competition не использовался в UI.
      </div>

      <div style={CARD}>
        <div style={H}>⚖️ Весовая категория</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Вес тела, кг</div><input type="number" style={IN} value={bw} onChange={e => setBw(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Федерация</div>
            <select style={{ ...IN }} value={fed} onChange={e => setFed(e.target.value)}>
              {['IPF', 'other'].map(f => <option key={f} value={f}>{f === 'IPF' ? 'IPF (офиц.)' : 'Другая'}</option>)}
            </select>
          </div>
        </div>
        <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Категория до {cls.weightClass} кг</div>
          {cls.cuttingRequired && <div style={{ fontSize: 10, color: '#eab308' }}>Сушка: {cls.cuttingAmount} кг</div>}
          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{cls.recommendation}</div>
        </div>
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить ПМ (присед {squat} / жим {bench} / тяга {dead} кг, вес {bw} кг) к планировщику — план пересчитает веса.</div>
          <button onClick={() => applyToPlanner({ kind: 'pm', label: 'Соревнование: ПМ ' + squat + '/' + bench + '/' + dead + ' кг', data: { squat, bench, dead } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить ПМ к планировщику</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📋 Стратегия подходов</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Присед ПМ</div><input type="number" style={IN} value={squat} onChange={e => setSquat(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Жим ПМ</div><input type="number" style={IN} value={bench} onChange={e => setBench(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Тяга ПМ</div><input type="number" style={IN} value={dead} onChange={e => setDead(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Прогноз тотала: {squat + bench + dead} кг</div>
        {attempts.map((a, i) => (
          <div key={i} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{a.lift}</div>
            <div style={{ fontSize: 10, color: DIM }}>1: {a.opener}</div>
            <div style={{ fontSize: 10, color: DIM }}>2: {a.second}</div>
            <div style={{ fontSize: 10, color: DIM }}>3: {a.third}</div>
            <div style={{ fontSize: 9, color: ACCENT, marginTop: 2 }}>{a.warmupRoom}</div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить пиковый протокол (соревнование) к планировщику: объём ×0.5, RIR→0 — выход на пик.</div>
          <button onClick={() => applyToPlanner({ kind: 'peak', label: 'Соревнование: пик (объём ×0.5, RIR→0)', data: { volumeMult: 0.5, rirTarget: 0 } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить пик к планировщику</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>⏰ Таймлайн соревновательного дня</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Взвешивание</div><input type="time" style={IN} value={weighIn} onChange={e => setWeighIn(e.target.value)} /></div>
          <div><div style={LABEL}>Старт потока</div><input type="time" style={IN} value={start} onChange={e => setStart(e.target.value)} /></div>
        </div>
        {timeline.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
            <span style={{ color: ACCENT, fontWeight: 700 }}>{t.time}</span>
            <span style={{ color: DIM }}>{t.action}</span>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={H}>🔄 Протоколы восстановления</div>
        {recovery.map((r, i) => (
          <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{r.name} <span style={{ fontSize: 9, color: DIM }}>({r.type}, {r.durationMin} мин)</span></div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Когда: {r.whenToUse}</div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 1 }}>{r.instructions.join(' · ')}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={H}>🧠 Ментальные рутины</div>
        {mental.map((m, i) => (
          <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>{m.name}</div>
            <div style={{ fontSize: 9, color: DIM }}>Когда: {m.whenToUse}</div>
            {m.steps.map((s, j) => (
              <div key={j} style={{ fontSize: 9, color: DIM, marginTop: 2 }}>• {s.action} ({s.duration}) {s.notes}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
