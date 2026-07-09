/** PeakingPanel.tsx — ПОЛНЫЙ ИНСТРУМЕНТ: пиковая фаза + соревнование.
 *  Объединяет бывшие PeakingPanel + CompetitionCard в один компонент.
 *  Режимы: 🏋️ Соревнование (тэйпер + стратегия + вес/категория + таймлайн + восстановление + ментал)
 *          🏆 Шоу (BB: неделя пика, загрузка, кондиция) */
import React, { useMemo, useState } from 'react';
import {
  selectWeightClass, generateAttemptStrategy, generateCompetitionTimeline,
  getRecoveryProtocols, getMentalRoutines,
} from '../../../engines/gym-competition.engine';
import { generatePLPeaking, generateBBPeaking, type PLPeakingOutput, type BBPeakingOutput } from '../../../engines/peaking-engine';
import { loadTrainingProfile } from '../TrainingScreen_parts/training-profile';
import { applyToPlanner } from '../TrainingScreen_parts/planner-bridge';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const TITLE: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const DIM = 'rgba(255,255,255,0.5)';
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

const today = () => new Date();
const addDays = (n: number) => { const d = today(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export const PeakingPanel: React.FC<{ defaultKind?: 'pl' | 'bb' }> = ({ defaultKind }) => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [kind, setKind] = useState<'pl' | 'bb'>(defaultKind || 'pl');

  // ── PL: тэйпер + соревнование ──
  const [meetDate, setMeetDate] = useState<string>(addDays(28));
  const [squat, setSquat] = useState(prof.pmSquat || 140);
  const [bench, setBench] = useState(prof.pmBench || 100);
  const [deadlift, setDeadlift] = useState(prof.pmDead || 180);
  const [plFatigue, setPlFatigue] = useState(30);
  const [plPri, setPlPri] = useState(70);

  // Соревнование: весовая категория + таймлайн
  const [bw, setBw] = useState(prof.bodyWeight || 80);
  const [fed, setFed] = useState('IPF');
  const [weighIn, setWeighIn] = useState('08:00');
  const [start, setStart] = useState('11:00');

  const pl: PLPeakingOutput | null = useMemo(() => {
    try { return generatePLPeaking({ meetDate, current1RM: { squat, bench, deadlift }, fatigue: plFatigue / 100, pri: plPri / 100 }); }
    catch { return null; }
  }, [meetDate, squat, bench, deadlift, plFatigue, plPri]);

  const strategy = useMemo(() => {
    try { return generateAttemptStrategy(squat, bench, deadlift); }
    catch { return null; }
  }, [squat, bench, deadlift]);

  const cls = useMemo(() => selectWeightClass(bw, fed), [bw, fed]);
  const timeline = useMemo(() => generateCompetitionTimeline(weighIn, start), [weighIn, start]);
  const recovery = useMemo(() => getRecoveryProtocols(), []);
  const mental = useMemo(() => getMentalRoutines(), []);

  // ── BB: шоу ──
  const [showDate, setShowDate] = useState<string>(addDays(7));
  const [conditioning, setConditioning] = useState(0.7);
  const [fullness, setFullness] = useState(0.6);
  const [dryness, setDryness] = useState(0.6);
  const [carbTol, setCarbTol] = useState(0.7);

  const bb: BBPeakingOutput | null = useMemo(() => {
    try { return generateBBPeaking({ showDate, conditioning, fullness, dryness, carbTolerance: carbTol }); }
    catch { return null; }
  }, [showDate, conditioning, fullness, dryness, carbTol]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button style={kind === 'pl' ? BTN : BTN_GHOST} onClick={() => setKind('pl')}>🏋️ Соревнование (ПЛ)</button>
        <button style={kind === 'bb' ? BTN : BTN_GHOST} onClick={() => setKind('bb')}>🏆 Шоу (BB)</button>
      </div>

      {/* ════════════════ ПЛ: Тэйпер + Соревнование ════════════════ */}
      {kind === 'pl' && (
        <div>
          {/* ─── Параметры ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>Дата соревнований</div><input style={IN} type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} /></div>
            <div><div style={LABEL}>Готовность (PRI), %</div><input style={IN} type="number" min={0} max={100} value={plPri} onChange={e => setPlPri(+e.target.value)} /></div>
            <div><div style={LABEL}>Усталость, %</div><input style={IN} type="number" min={0} max={100} value={plFatigue} onChange={e => setPlFatigue(+e.target.value)} /></div>
            <div><div style={LABEL}>1RM Присед</div><input style={IN} type="number" value={squat} onChange={e => setSquat(+e.target.value)} /></div>
            <div><div style={LABEL}>1RM Жим</div><input style={IN} type="number" value={bench} onChange={e => setBench(+e.target.value)} /></div>
            <div><div style={LABEL}>1RM Тяга</div><input style={IN} type="number" value={deadlift} onChange={e => setDeadlift(+e.target.value)} /></div>
          </div>

          {/* ─── Весовая категория ─── */}
          <div style={CARD}>
            <div style={TITLE}>⚖️ Весовая категория</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><div style={LABEL}>Вес тела, кг</div><input type="number" style={IN} value={bw} onChange={e => setBw(parseFloat(e.target.value) || 0)} /></div>
              <div><div style={LABEL}>Федерация</div>
                <select style={IN} value={fed} onChange={e => setFed(e.target.value)}>
                  {['IPF', 'other'].map(f => <option key={f} value={f}>{f === 'IPF' ? 'IPF (офиц.)' : 'Другая'}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Категория до {cls.weightClass} кг</div>
              {cls.cuttingRequired && <div style={{ fontSize: 10, color: '#eab308' }}>Сушка: {cls.cuttingAmount} кг</div>}
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{cls.recommendation}</div>
            </div>
          </div>

          {/* ─── Тэйпер ─── */}
          {pl && (
            <div style={CARD}>
              <div style={H}>⬇ Тэйпер к соревнованиям (недель тэйпера: {pl.taperWeeks})</div>
              <div style={{ ...SMALL, marginBottom: 6 }}>Последние тяжёлые: присед {pl.lastHeavySquat}, жим {pl.lastHeavyBench}, тяга {pl.lastHeavyDeadlift}</div>
              {pl.plan.map((wk, wi) => (
                <div key={wi} style={{ marginTop: 6, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: ACCENT, fontSize: 12, fontWeight: 600 }}>{wk.weekLabel} (−{wk.daysUntilMeet} дн)</div>
                  {wk.sessions.map((s, si) => (
                    <div key={si} style={{ ...SMALL, marginLeft: 8, marginTop: 2 }}>
                      <b>{s.dayName}:</b> {s.exercises.map(ex => `${ex.name} ${ex.sets}×${ex.reps}@${Math.round(ex.percent * 100)}% (RPE${ex.rpe})`).join(' · ')}
                    </div>
                  ))}
                </div>
              ))}
              {pl.meetDayInstructions.length > 0 && (
                <div style={{ ...CARD, marginTop: 8, borderColor: ACCENT }}>
                  <div style={H}>🏆 День соревнований</div>
                  {pl.meetDayInstructions.map((x, i) => <div key={i} style={SMALL}>• {x}</div>)}
                </div>
              )}
            </div>
          )}

          {/* ─── Стратегия подходов ─── */}
          {strategy && (
            <div style={CARD}>
              <div style={H}>📋 Стратегия подходов (opener/second/third)</div>
              <div style={ROW}><span>Прогноз тотала (S+B+D)</span><span style={{ color: ACCENT }}>{squat + bench + deadlift} кг</span></div>
              {strategy.map((a: { lift: string; opener: string; second: string; third: string; warmupRoom: string }, i: number) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{a.lift}</div>
                  <div style={SMALL}>opener {a.opener} · 2nd {a.second} · 3rd {a.third}</div>
                  <div style={{ ...SMALL, color: 'rgba(255,255,255,0.4)' }}>разминка: {a.warmupRoom}</div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Таймлайн дня ─── */}
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

          {/* ─── Восстановление ─── */}
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

          {/* ─── Ментал ─── */}
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

          {/* ─── Применить ─── */}
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
              🔗 Применить ПМ к планировщику (присед {squat} / жим {bench} / тяга {deadlift}) и пиковый протокол (объём ×0.5, RIR→0).
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => applyToPlanner({ kind: 'pm', label: 'Соревнование: ПМ ' + squat + '/' + bench + '/' + deadlift + ' кг', data: { squat, bench, deadlift } })}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>
                🛠 Применить ПМ
              </button>
              <button onClick={() => applyToPlanner({ kind: 'peak', label: 'Соревнование: пик (объём ×0.5, RIR→0)', data: { volumeMult: 0.5, rirTarget: 0 } })}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, minHeight: 44 }}>
                🛠 Применить пик
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ BB: Шоу ════════════════ */}
      {kind === 'bb' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>Дата шоу</div><input style={IN} type="date" value={showDate} onChange={e => setShowDate(e.target.value)} /></div>
            <div><div style={LABEL}>Кондиция (0-1)</div><input style={IN} type="number" min={0} max={1} step={0.05} value={conditioning} onChange={e => setConditioning(+e.target.value)} /></div>
            <div><div style={LABEL}>Наполненность (0-1)</div><input style={IN} type="number" min={0} max={1} step={0.05} value={fullness} onChange={e => setFullness(+e.target.value)} /></div>
            <div><div style={LABEL}>Сухость (0-1)</div><input style={IN} type="number" min={0} max={1} step={0.05} value={dryness} onChange={e => setDryness(+e.target.value)} /></div>
            <div><div style={LABEL}>Толерантность к углеводам</div><input style={IN} type="number" min={0} max={1} step={0.05} value={carbTol} onChange={e => setCarbTol(+e.target.value)} /></div>
          </div>
          {bb && (
            <div style={CARD}>
              <div style={H}>⬇ Неделя пика (шоу)</div>
              <div style={ROW}><span>День</span><span>Тренировка · Углеводы · Вода · Na · Поза</span></div>
              {bb.weekPlan.map(d => (
                <div key={d.day} style={{ ...ROW, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ color: ACCENT, fontWeight: 700, width: 28 }}>Д{d.day}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{d.training} · {d.carbs} · {d.water} · {d.sodium} · {d.posing}</span>
                </div>
              ))}
              {bb.recommendations.length > 0 && <div style={{ marginTop: 8 }}><div style={LABEL}>Рекомендации:</div>{bb.recommendations.map((r, i) => <div key={i} style={SMALL}>• {r}</div>)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PeakingPanel;
