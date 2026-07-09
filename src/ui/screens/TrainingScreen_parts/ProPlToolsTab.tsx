import React, { useMemo, useState } from 'react';
import { taperPlan, warmupSequence, type AttemptStrategy, type Lift } from '../../../engines/pro/taper.engine';
import { diagnoseLift, stickingPhases, barPathAnalysis, type BarPathIssue } from '../../../engines/pro/lift-diagnostics.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };
const LIFT_RU: Record<string, string> = { squat: 'Присед', bench: 'Жим', deadlift: 'Тяга' };

export const ProPlToolsTab: React.FC = () => {
  const [tab, setTab] = useState<'taper' | 'diag'>('taper');

  // Taper
  const [meetDate, setMeetDate] = useState('');
  const [squat1RM, setSquat1RM] = useState(140);
  const [bench1RM, setBench1RM] = useState(100);
  const [deadlift1RM, setDeadlift1RM] = useState(180);
  const [fatigue, setFatigue] = useState(7);
  const [strategy, setStrategy] = useState<AttemptStrategy>('balanced');
  const taper = useMemo(() => {
    if (!meetDate) return null;
    return taperPlan(meetDate, { squat: squat1RM, bench: bench1RM, deadlift: deadlift1RM }, fatigue, strategy);
  }, [meetDate, squat1RM, bench1RM, deadlift1RM, fatigue, strategy]);

  // Diagnostics
  const [diagLift, setDiagLift] = useState<Lift>('squat');
  const phases = useMemo(() => stickingPhases(diagLift), [diagLift]);
  const [diagPhase, setDiagPhase] = useState('');
  const [barIssues, setBarIssues] = useState<BarPathIssue[]>([]);
  const diag = useMemo(() => diagPhase ? diagnoseLift(diagLift, diagPhase as any) : null, [diagLift, diagPhase]);
  const barPath = useMemo(() => barIssues.length > 0 ? barPathAnalysis(diagLift, barIssues) : null, [diagLift, barIssues]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🏋️ Pro ПЛ-инструменты</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>🧮 Калькулятор блинов перенесён в зону «Калькуляторы» → вкладка «🧮 Калькулятор блинов» (там все системы единиц, типы грифов, визуализация, пресеты).</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['taper', '🏁 Тапер'], ['diag', '🔬 Диагностика']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, border: tab === k ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: tab === k ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: tab === k ? ACCENT : 'var(--text-dim)' }}>{l}</button>
        ))}
      </div>

      {tab === 'taper' && (<>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Тапер к соревнованиям: снижение объёма 40-60%, удержание интенсивности, peak-week прикиды.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Дата старта</label><input type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={IN} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Усталость (1-10)</label><input type="number" min={1} max={10} value={fatigue} onChange={e => setFatigue(+e.target.value)} style={IN} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Стратегия</label><select value={strategy} onChange={e => setStrategy(e.target.value as AttemptStrategy)} style={{ ...IN, textAlign: 'left' }}><option value="conservative">Консервативная</option><option value="balanced">Сбалансированная</option><option value="aggressive">Агрессивная</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Присед 1RM</label><input type="number" value={squat1RM} onChange={e => setSquat1RM(+e.target.value)} style={IN} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Жим 1RM</label><input type="number" value={bench1RM} onChange={e => setBench1RM(+e.target.value)} style={IN} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Тяга 1RM</label><input type="number" value={deadlift1RM} onChange={e => setDeadlift1RM(+e.target.value)} style={IN} /></div>
        </div>
        {taper && (<>
          <div style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🏁 План тапера ({taper.taperWeeks} нед до {taper.meetDate})</div>
            {taper.weeks.map(w => (
              <div key={w.week} style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Неделя {w.week}</div>
                {w.sessions.map((s, si) => (
                  <div key={si} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                    <b>{s.dayName}</b> — {s.focus} (за {s.daysUntilMeet} дн): {s.exercises.map(ex => `${LIFT_RU[ex.lift]} ${Math.round(ex.percent * 100)}% ×${ex.reps}×${ex.sets}`).join(', ')}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>🏆 Прикиды (стратегия: {strategy})</div>
            {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => {
              const a = taper.attempts[l];
              return <div key={l} style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}><b>{LIFT_RU[l]}:</b> опенер {a.opener} → 2-й {a.second} → 3-й {a.third} кг <span style={{ color: 'var(--text-dim)' }}>({a.rpeNote})</span></div>;
            })}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>Последние тяжёлые: присед за {taper.lastHeavyDays.squat} дн, жим за {taper.lastHeavyDays.bench} дн, тяга за {taper.lastHeavyDays.deadlift} дн до старта.</div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>📋 Соревновательный день</div>
            {taper.meetDayInstructions.map((inst, i) => <div key={i} style={{ ...SMALL, marginBottom: 3 }}>{inst}</div>)}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginTop: 6 }}>Разминочная последовательность (опенер присед {taper.attempts.squat.opener} кг):</div>
            {warmupSequence(taper.attempts.squat.opener).map((s, i) => <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginRight: 12 }}>{Math.round(s.percent * 100)}%→{s.weight}кг×{s.reps}</span>)}
          </div>
        </>)}
      </>)}

      {tab === 'diag' && (<>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Диагностика мёртвых точек (sticking points) по биомеханике: где срыв, почему, что делать.</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
            <button key={l} onClick={() => { setDiagLift(l); setDiagPhase(''); }} style={{ flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, border: diagLift === l ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: diagLift === l ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: diagLift === l ? ACCENT : 'var(--text-dim)' }}>{LIFT_RU[l]}</button>
          ))}
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Слабая фаза</label>
          <select value={diagPhase} onChange={e => setDiagPhase(e.target.value)} style={{ ...IN, textAlign: 'left' }}>
            <option value="">Выберите фазу...</option>
            {phases.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {diag && (
          <div style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{LIFT_RU[diag.lift]} — {diag.phaseLabel}</div>
            <div style={{ ...SMALL, marginBottom: 4 }}>📍 Угол: {diag.angleRangeDeg[0]}°-{diag.angleRangeDeg[1]}° · сустав: {diag.keyJoint}</div>
            <div style={{ ...SMALL, marginBottom: 4 }}>🧠 Причина: {diag.biomechanicalReason}</div>
            <div style={{ ...SMALL, marginBottom: 4 }}>💪 Слабые мышцы: {diag.weakMuscles.join(', ')}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginTop: 6 }}>Коррекции:</div>
            {diag.corrections.map((c, i) => <div key={i} style={{ ...SMALL, marginBottom: 2 }}>• {c}</div>)}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginTop: 6 }}>Ассистентные: {diag.assistance.join(', ')} @ {diag.assistanceIntensityPct}%</div>
            <div style={{ ...SMALL, marginTop: 4 }}>💡 Кью: {diag.loadCues}</div>
          </div>
        )}
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>📊 Bar-path анализ</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {(['forward_drift', 'hips_shoot_up', 'good_morning', 'bar_loops', 'asymmetric'] as BarPathIssue[]).map(iss => (
              <button key={iss} onClick={() => setBarIssues(prev => prev.includes(iss) ? prev.filter(x => x !== iss) : [...prev, iss])} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: barIssues.includes(iss) ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: barIssues.includes(iss) ? 'rgba(168,85,247,0.12)' : 'transparent', color: barIssues.includes(iss) ? '#a855f7' : 'var(--text-dim)' }}>{iss.replace(/_/g, ' ')}</button>
            ))}
          </div>
          {barPath?.diagnoses.map((d, i) => (
            <div key={i} style={{ ...SMALL, marginBottom: 6 }}><b style={{ color: '#a855f7' }}>{d.issue.replace(/_/g, ' ')}:</b> {d.cause} <span style={{ color: ACCENT }}>→ {d.correction}</span></div>
          ))}
        </div>
      </>)}

    </div>
  );
};

export default React.memo(ProPlToolsTab);