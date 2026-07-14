import React, { useMemo, useState } from 'react';
import { generatePeriodization, type GoalType, type PhaseType, type PhaseParams } from '../../../engines/cycle-periodization.engine';
import { PHASE_LABELS, PHASE_HINTS } from './shared';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };

const GOAL_OPTS: { id: GoalType; label: string }[] = [
  { id: 'hypertrophy', label: 'Масса' },
  { id: 'strength', label: 'Сила' },
  { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'bodybuilding', label: 'Бодибилдинг' },
  { id: 'conditioning', label: 'Выносливость' },
  { id: 'technique', label: 'Техника' },
  { id: 'rehab', label: 'Реабилитация' },
];

const volColor: Record<string, string> = { very_low: '#60a5fa', low: '#22c55e', medium: '#eab308', high: '#f59e0b', very_high: '#ef4444' };
const phaseColor: Record<PhaseType, string> = { accumulation: '#22c55e', intensification: '#f59e0b', peaking: '#ef4444', deload: '#60a5fa', gpp: '#a855f7', spp: '#a855f7' };

const MicrocyclePlannerCardBase: React.FC = () => {
  const [weeks, setWeeks] = useState<number>(8);
  const [selGoal, setSelGoal] = useState<GoalType>('hypertrophy');

  const plan = useMemo(() => generatePeriodization(weeks, selGoal), [weeks, selGoal]);

  const styleLabel = weeks <= 4 ? 'Линейная (одна фаза)' : weeks <= 8 ? 'Линейная 2 фазы + делод' : 'Блочная (накопление → интенсификация → пик → делод)';

  // expand phases to per-week rows
  let weekCursor = 0;
  const rows: { week: number; phase: PhaseType; params: PhaseParams }[] = [];
  plan.phases.forEach(ph => { for (let i = 0; i < ph.weeks; i++) { weekCursor++; rows.push({ week: weekCursor, phase: ph.phase, params: ph.params }); } });

  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(0,230,138,0.15)', marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🗓️ Планер микроциклов</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Задайте длительность и цель — получите готовую последовательность фаз/микроциклов с варьирующейся интенсивностью.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Недель: <b style={{ color: ACCENT }}>{weeks}</b></label>
          <input type="range" min={4} max={16} step={1} value={weeks} onChange={e => setWeeks(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Цель</label>
          <select value={selGoal} onChange={e => setSelGoal(e.target.value as GoalType)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, fontSize: 11 }}>
            {GOAL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Модель периодизации: <b style={{ color: ACCENT }}>{styleLabel}</b>. Фаз: {plan.phases.length}.</div>

      {/* Phase blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.phases.map((ph, i) => (
          <div key={i} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${phaseColor[ph.phase]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: phaseColor[ph.phase] }}>{PHASE_LABELS[ph.phase] || ph.phase}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>нед {rows.filter(r => r.phase === ph.phase)[0]?.week}–{rows.filter(r => r.phase === ph.phase).slice(-1)[0]?.week} ({ph.weeks} нед)</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 1.5 }}>{PHASE_HINTS[ph.phase] || ''}</div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 6, flexWrap: 'wrap' }}>
              <span>📊 Объём: <b style={{ color: volColor[ph.params.volumeLevel] }}>{ph.params.volumeLevel}</b></span>
              <span>🔥 Интенсивность: <b>{ph.params.intensityLevel}</b></span>
              <span>🔁 Частота: <b>{ph.params.frequencyLevel}</b></span>
              <span>🎯 Приоритет: <b>{ph.params.priority}</b></span>
              <span>⚠ Усталость ≤ {ph.params.fatigueCeiling}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-week timeline */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Таймлайн по неделям</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {rows.map(r => (
            <div key={r.week} title={`Нед ${r.week}: ${PHASE_LABELS[r.phase] || r.phase} · объём ${r.params.volumeLevel}`} style={{ flex: '1 0 28px', minWidth: 28, padding: '6px 4px', borderRadius: 6, textAlign: 'center', background: phaseColor[r.phase] + '18', border: `1px solid ${phaseColor[r.phase]}40` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: phaseColor[r.phase] }}>{r.week}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{PHASE_LABELS[r.phase] || ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить первую фазу «{PHASE_LABELS[plan.phases[0].phase] || plan.phases[0].phase}» (объём {plan.phases[0].params.volumeLevel}) к планировщику. Последовательность: {plan.phases.map(ph => (PHASE_LABELS[ph.phase] || ph.phase) + ' ' + ph.weeks + 'нед').join(' → ')}.</div>
        <button onClick={() => { const p = plan.phases[0]; const vmap: Record<string, number> = { very_low: 0.7, low: 0.85, medium: 1, high: 1.15, very_high: 1.3 }; const imap: Record<string, number> = { very_low: 2, low: 1, medium: 0, high: -1, very_high: -2 }; applyToPlanner({ kind: 'pri', label: 'Микроциклы: ' + plan.phases.map(ph => (PHASE_LABELS[ph.phase] || ph.phase) + ' ' + ph.weeks + 'нед').join(' → '), data: { volumeMult: vmap[p.params.volumeLevel] ?? 1, rirShift: imap[p.params.intensityLevel] ?? 0 } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить периодизацию к планировщику</button>
      </div>
    </div>
  );
};

export const MicrocyclePlannerCard = React.memo(MicrocyclePlannerCardBase);
export default MicrocyclePlannerCard;