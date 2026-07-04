/**
 * TaperPlannerTab.tsx — Тапер-планер: план снижения объёма/интенсивности по неделям до старта.
 * Использует pro/taper.engine: taperPlan, warmupSequence, peakWeekAttempts, taperCurve.
 */
import React, { useMemo, useState } from 'react';
import {
  taperPlan,
  warmupSequence,
  taperWeeksForFatigue,
  type AttemptStrategy,
  type Lift,
  type TaperPlan,
} from '../../../engines/pro/taper.engine';
import { PopupNumber, PopupSelect, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const LIFT_RU: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Тяга' };
const LIFT_COLOR: Record<Lift, string> = { squat: '#ef4444', bench: '#3b82f6', deadlift: '#f59e0b' };

const fatigueOpts = [
  { id: 'low', label: 'Низкая (8-9)', desc: 'Лёгкий taper 1 неделя' },
  { id: 'med', label: 'Средняя (5-7)', desc: 'Taper 2 недели' },
  { id: 'high', label: 'Высокая (>8)', desc: 'Длительный taper 3 недели' },
];
const strategyOpts: { id: AttemptStrategy; label: string; desc: string }[] = [
  { id: 'conservative', label: 'Консервативная', desc: 'Опенер 90%, 2nd 95.5%, 3rd 100%' },
  { id: 'balanced', label: 'Сбалансированная', desc: 'Опенер 92%, 2nd 96%, 3rd 102%' },
  { id: 'aggressive', label: 'Агрессивная', desc: 'Опенер 93%, 2nd 97%, 3rd 105%' },
];

export const TaperPlannerTab: React.FC = () => {
  const [meetDate, setMeetDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().slice(0, 10);
  });
  const [squat1RM, setSquat1RM] = useState(180);
  const [bench1RM, setBench1RM] = useState(120);
  const [deadlift1RM, setDeadlift1RM] = useState(220);
  const [fatigueRaw, setFatigueRaw] = useState<string>('');
  const [fatigueNum, setFatigueNum] = useState(7);
  const [strategy, setStrategy] = useState<AttemptStrategy>('balanced');
  const [saved, setSaved] = useState(false);

  const fatigue = fatigueRaw === 'low' ? 8 : fatigueRaw === 'med' ? 6 : fatigueRaw === 'high' ? 9 : fatigueNum;

  const plan: TaperPlan | null = useMemo(() => {
    if (squat1RM <= 0 || bench1RM <= 0 || deadlift1RM <= 0) return null;
    try {
      return taperPlan(meetDate, { squat: squat1RM, bench: bench1RM, deadlift: deadlift1RM }, fatigue, strategy);
    } catch { return null; }
  }, [meetDate, squat1RM, bench1RM, deadlift1RM, fatigue, strategy]);

  const daysUntil = React.useMemo(() => {
    const d = new Date(meetDate).getTime() - Date.now();
    return Math.max(0, Math.round(d / 86400000));
  }, [meetDate]);

  const handleSave = () => {
    if (!plan) return;
    localStorage.setItem('he_taper_plan', JSON.stringify({ meetDate, squat1RM, bench1RM, deadlift1RM, fatigue, strategy, savedAt: Date.now() }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const warmup = plan ? warmupSequence(plan.attempts.squat.opener) : [];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🔻 Тапер-планер (подготовка к соревнованиям)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        План снижения объёма/интенсивности по неделям до старта. Объём ↓40-60% за 1-3 нед (по усталости),
        удержание интенсивности, нейромышечный прайминг, peak-week прикиды (opener/2nd/3rd), тайминг последних тяжёлых,
        план соревновательного дня.
      </div>

      {/* Входные данные */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label="Присед 1RM" value={squat1RM} min={20} max={600} suffix=" кг" onChange={setSquat1RM} />
          <PopupNumber label="Жим 1RM" value={bench1RM} min={20} max={400} suffix=" кг" onChange={setBench1RM} />
          <PopupNumber label="Тяга 1RM" value={deadlift1RM} min={20} max={600} suffix=" кг" onChange={setDeadlift1RM} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>📅 Дата старта</div>
            <input type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 }} />
          </div>
          <PopupSelect label="Усталость (RPE-пресс)" value={fatigueRaw || 'med'} options={fatigueOpts} onChange={v => setFatigueRaw(v)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label="Усталость число (опц)" value={fatigueNum} min={1} max={10} hint="0-10: текущая накопленная усталость (большая → длиннее taper)" onChange={setFatigueNum} />
          <PopupSelect label="Стратегия прикидов" value={strategy} options={strategyOpts} onChange={v => setStrategy(v as AttemptStrategy)} />
        </div>
        {daysUntil > 0 && <div style={{ ...SMALL, color: ACCENT }}>До старта: <b>{daysUntil}</b> дн.</div>}
      </div>

      {/* Сводка */}
      {plan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          <MetricCard title="Длительность" icon="📅" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{plan.taperWeeks} нед</div>
            <div style={SMALL}>{taperWeeksForFatigue(fatigue)} нед по усталости</div>
          </MetricCard>
          <MetricCard title="Тотал (имп.)" icon="🏋️" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{squat1RM + bench1RM + deadlift1RM}</div>
            <div style={SMALL}>сум 3 движ.</div>
          </MetricCard>
          <MetricCard title="Цель 3rd SQ" icon="🥇" accent="#f59e0b">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{plan.attempts.squat.third}</div>
            <div style={SMALL}>{plan.attempts.squat.rpeNote}</div>
          </MetricCard>
          <MetricCard title="Цель 3rd DL" icon="🥇" accent="#f59e0b">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{plan.attempts.deadlift.third}</div>
            <div style={SMALL}>{plan.attempts.deadlift.rpeNote}</div>
          </MetricCard>
        </div>
      )}

      {/* Taper кривая (объём/интенсивность/RIR по неделям) */}
      {plan && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Кривая taper (объём % / интенсивность % / RIR)</div>
          {plan.taperCurve.map(tw => (
            <div key={tw.week} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>Нед {tw.week}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Объём: <b style={{ color: '#fff' }}>{Math.round(tw.volumePctOfPeak * 100)}%</b></span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Инт.: <b style={{ color: '#fff' }}>{Math.round(tw.intensityPct * 100)}%</b></span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>RIR: <b style={{ color: '#fff' }}>{tw.rir}</b></span>
              <div style={{ gridColumn: '1 / -1', fontSize: 10, color: DIM, marginTop: 2 }}>{tw.rationale}</div>
            </div>
          ))}
        </div>
      )}

      {/* Понедельный план сессий */}
      {plan && plan.weeks.map(w => (
        <div key={w.week} style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📅 Неделя {w.week} — {w.sessions.length} сессии</div>
          {w.sessions.map((s, si) => (
            <div key={si} style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.dayName}</span>
                <span style={{ fontSize: 10, color: ACCENT }}>{s.daysUntilMeet} дн. до старта</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>{s.focus}</div>
              {s.exercises.map((ex, ei) => {
                const weight = ex.lift === 'squat' ? squat1RM : ex.lift === 'bench' ? bench1RM : deadlift1RM;
                const wkg = Math.round(weight * ex.percent * 10) / 10;
                return (
                  <div key={ei} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr', gap: 6, fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>
                    <span style={{ color: LIFT_COLOR[ex.lift], fontWeight: 700 }}>{LIFT_RU[ex.lift]}</span>
                    <span>{Math.round(ex.percent * 100)}% × {ex.reps}</span>
                    <span style={{ color: ACCENT, fontWeight: 700 }}>{wkg} кг × {ex.sets}</span>
                    <span style={{ gridColumn: '4 / -1' }}>{ex.note}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      {/* Прикиды peak week */}
      {plan && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏆 Прикиды соревновательного дня ({strategyOpts.find(s => s.id === strategy)?.label})</div>
          {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LIFT_COLOR[l], marginBottom: 4 }}>{LIFT_RU[l]}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['opener', 'second', 'third', 'target'] as const).map(a => (
                  <div key={a} style={{ padding: 8, borderRadius: 8, textAlign: 'center', background: a === 'target' ? 'rgba(245,158,11,0.06)' : 'rgba(24,24,27,0.6)', border: a === 'target' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 9, color: DIM }}>{a === 'opener' ? 'Опенер' : a === 'second' ? 'Вторая' : a === 'third' ? 'Третья' : 'Цель'}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: a === 'target' ? '#f59e0b' : '#fff' }}>{plan.attempts[l][a]} кг</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Разминка под опенер */}
      {plan && warmup.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🔥 Разминка под опенер приседа ({plan.attempts.squat.opener} кг)</div>
          {warmup.map((w, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>
              <span>{Math.round(w.percent * 100)}%</span>
              <b style={{ color: ACCENT }}>{w.weight} кг × {w.reps} повт.</b>
            </div>
          ))}
        </div>
      )}

      {/* Последние тяжёлые дни */}
      {plan && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>⏱ Тайминг последних тяжёлых движений (дн. до старта)</div>
          {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: LIFT_COLOR[l], fontWeight: 700 }}>{LIFT_RU[l]}</span>
              <span style={{ color: '#fff' }}><b>{plan.lastHeavyDays[l]}</b> дн. до старта</span>
            </div>
          ))}
        </div>
      )}

      {/* Инструкции соревновательного дня */}
      {plan && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📋 План соревновательного дня</div>
          {plan.meetDayInstructions.map((m, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', padding: '4px 0', lineHeight: 1.45 }}>• {m}</div>
          ))}
        </div>
      )}

      {/* Сохранить */}
      {plan && (
        <button
          onClick={handleSave}
          disabled={saved}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: saved ? 'not-allowed' : 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, opacity: saved ? 0.4 : 1, transition: 'all 0.2s' }}
        >
          {saved ? '✓ План сохранён' : '💾 Сохранить taper-план'}
        </button>
      )}
    </div>
  );
};

export default TaperPlannerTab;