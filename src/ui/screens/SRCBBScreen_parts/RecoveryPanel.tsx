/**
 * RecoveryPanel.tsx — T8/BB13: восстановление + readiness + мобилити/преабил (Этап INT5).
 * REUSE recovery-optimization.engine (analyzeRecovery/shouldTrain) + federation-grip-mobility.engine (getMobilityFlows/getAllCorrectives).
 */
import React, { useMemo, useState } from 'react';
import { analyzeRecovery, shouldTrain, type RecoveryOutput } from '../../../engines/recovery-optimization.engine';
import { getMobilityFlows, getAllCorrectives } from '../../../engines/federation-grip-mobility.engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const SEL: React.CSSProperties = { ...IN, minHeight: 40 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

const labelColor = (l: string) => l === 'Отлично' ? ACCENT : l === 'Хорошо' ? '#84cc16' : l === 'Средне' ? '#f59e0b' : l === 'Низко' ? '#f97316' : '#ef4444';

export const RecoveryPanel: React.FC = () => {
  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [rmssd, setRmssd] = useState(55);
  const [restingHR, setRestingHR] = useState(58);
  const [readiness, setReadiness] = useState(70);
  const [fatigue, setFatigue] = useState(30);
  const [trainDays, setTrainDays] = useState(4);
  const [phase, setPhase] = useState<'accumulation' | 'intensification' | 'peaking' | 'deload'>('accumulation');
  const [recentPR, setRecentPR] = useState(false);
  const [injuries, setInjuries] = useState('');

  const flows = useMemo(() => getMobilityFlows(), []);
  const correctives = useMemo(() => getAllCorrectives().slice(0, 12), []);

  const out: RecoveryOutput | null = useMemo(() => {
    try {
      return analyzeRecovery({
        sleep: { hours: sleepHours, quality: sleepQuality, bedtime: '23:00', wakeTime: '07:00', latencyMin: 10, awakenings: 1 },
        hrv: { rmssd, sdnn: 50, restingHR, readinessScore: readiness },
        fatigueScore: fatigue / 100,
        trainingDaysThisWeek: trainDays,
        currentWeek: 4,
        periodizationPhase: phase,
        recentPR,
        injuryHistory: injuries.split(',').map(s => s.trim()).filter(Boolean),
      });
    } catch { return null; }
  }, [sleepHours, sleepQuality, rmssd, restingHR, readiness, fatigue, trainDays, phase, recentPR, injuries]);

  const verdict = useMemo(() => out ? shouldTrain(out.overallRecoveryIndex, fatigue / 100) : null, [out, fatigue]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><div style={LABEL}>Сон, часы</div><input style={IN} type="number" min={0} max={12} step={0.5} value={sleepHours} onChange={e => setSleepHours(+e.target.value)} /></div>
        <div><div style={LABEL}>Качество сна 1-5</div><input style={IN} type="number" min={1} max={5} value={sleepQuality} onChange={e => setSleepQuality(+e.target.value)} /></div>
        <div><div style={LABEL}>HRV (rmssd), мс</div><input style={IN} type="number" value={rmssd} onChange={e => setRmssd(+e.target.value)} /></div>
        <div><div style={LABEL}>Пульс покоя</div><input style={IN} type="number" value={restingHR} onChange={e => setRestingHR(+e.target.value)} /></div>
        <div><div style={LABEL}>Readiness 0-100</div><input style={IN} type="number" min={0} max={100} value={readiness} onChange={e => setReadiness(+e.target.value)} /></div>
        <div><div style={LABEL}>Усталость 0-100</div><input style={IN} type="number" min={0} max={100} value={fatigue} onChange={e => setFatigue(+e.target.value)} /></div>
        <div><div style={LABEL}>Тренировок на неделе</div><input style={IN} type="number" min={0} max={7} value={trainDays} onChange={e => setTrainDays(+e.target.value)} /></div>
        <div><div style={LABEL}>Фаза</div><select style={SEL} value={phase} onChange={e => setPhase(e.target.value as any)}>
          {['accumulation','intensification','peaking','deload'].map(p => <option key={p} value={p}>{p}</option>)}
        </select></div>
        <div><div style={LABEL}>Недавний PR</div><select style={SEL} value={recentPR ? '1' : '0'} onChange={e => setRecentPR(e.target.value === '1')}><option value="0">Нет</option><option value="1">Да</option></select></div>
        <div style={{ gridColumn: 'span 3' }}><div style={LABEL}>Травмы (через запятую: knee, spine, shoulder…)</div><input style={IN} value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="например: knee, lower_back" /></div>
      </div>

      {out && verdict && (
        <div>
          <div style={{ ...CARD, borderColor: labelColor(out.readinessLabel) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={H}>🔋 Восстановление</div>
              <div style={{ color: labelColor(out.readinessLabel), fontWeight: 700, fontSize: 16 }}>{out.overallRecoveryIndex}/100 · {out.readinessLabel}</div>
            </div>
            <div style={ROW}><span>Сон</span><span style={{ color: ACCENT }}>{out.sleepScore}</span></div>
            <div style={ROW}><span>HRV</span><span style={{ color: ACCENT }}>{out.hrvScore}</span></div>
            <div style={ROW}><span>Readiness</span><span style={{ color: ACCENT }}>{out.readinessScore}</span></div>
            <div style={ROW}><span>Риск перетрена</span><span style={{ color: out.overtrainingRisk > 60 ? '#ef4444' : ACCENT }}>{out.overtrainingRisk}/100</span></div>
            <div style={ROW}><span>Суперкомпенсация</span><span>~{out.supercompensationHours}ч</span></div>
            {out.deloadRecommended && <div style={{ ...SMALL, color: '#f59e0b', marginTop: 6 }}>⚠ Разгрузка рекомендована: {out.deloadReason}</div>}
          </div>

          <div style={{ ...CARD, borderColor: verdict.train ? ACCENT : '#ef4444' }}>
            <div style={H}>{verdict.train ? '✅ Тренироваться' : '🛑 Отдых'}</div>
            <div style={SMALL}>{verdict.message}</div>
            {verdict.train && <div style={SMALL}>Модификатор интенсивности: {verdict.intensityMod > 0 ? '+' : ''}{Math.round(verdict.intensityMod * 100)}%</div>}
          </div>

          {out.recommendations.length > 0 && <div style={CARD}><div style={H}>📋 Рекомендации</div>{out.recommendations.map((r, i) => <div key={i} style={SMALL}>• {r}</div>)}</div>}

          <div style={CARD}>
            <div style={H}>🤸 Мобилити-флоу (разминка/преабил)</div>
            {flows.slice(0, 4).map(f => (
              <div key={f.name} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{f.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {f.durationMin}мин · {f.targetAreas.join(', ')}</span></div>
                <div style={{ ...SMALL, color: 'rgba(255,255,255,0.4)' }}>{f.exercises.slice(0, 4).map(e => e.name).join(' · ')}</div>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <div style={H}>🩹 Корректирующие упражнения</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {correctives.map((c, i) => <span key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.08)', color: ACCENT }}>{c}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecoveryPanel;
