/**
 * AutoregPanel.tsx — T6/BB14: авторегуляция плана по readiness/fatigue (Этап INT4).
 * REUSE autoregulation-engine.autoregulate. Ввод ключевых метрик готовности -> решения
 * (интенсивность/объём/частота/выбор упражнений, отмена/даунгрейд сессии).
 */
import React, { useMemo, useState } from 'react';
import { autoregulate, type AutoregOutput } from '../../../engines/autoregulation-engine';
import { getProfile, updateSection } from '../../../core/profile-manager';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const SEL: React.CSSProperties = { ...IN, minHeight: 40 };
const LABEL: React.CSSProperties = { color: '#fff', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 12, lineHeight: 1.4 };

const dirColor = (d: string) => d === 'increase' ? ACCENT : d === 'decrease' ? '#ef4444' : '#a1a1aa';
const dirLabel = (d: string) => d === 'increase' ? '↑ увеличить' : d === 'decrease' ? '↓ уменьшить' : '→ держать';

export const AutoregPanel: React.FC = () => {
  // ── Локальный state ──
  const [readiness, setReadiness] = useState(70);   // 0-100
  const [fatigue, setFatigue] = useState(30);
  const [recovery, setRecovery] = useState(70);
  const [goal, setGoal] = useState<'strength' | 'hypertrophy'>('strength');
  const [intensity, setIntensity] = useState(80);  // %1RM
  const [sets, setSets] = useState(5);
  const [reps, setReps] = useState(5);
  const [freq, setFreq] = useState(4);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // ── Кнопка «📋 Из профиля» ──
  const autofillFromProfile = () => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      if (s.training?.recovery !== undefined) setRecovery(Math.min(100, s.training.recovery * 10));
      if (s.lifestyle?.fatigueLevel !== undefined) setFatigue(Math.min(100, s.lifestyle.fatigueLevel * 10));
      if (s.training?.primaryGoal) {
        if (s.training.primaryGoal === 'strength') setGoal('strength');
        else setGoal('hypertrophy');
      }
      if (s.training?.daysPerWeek) setFreq(s.training.daysPerWeek);
    } catch (e) { console.error('[AutoregPanel.autofillFromProfile]', e); }
  };

  // ── Кнопка «💾 Сохранить в профиль» — пишет readiness/fatigue в lifestyle ──
  const saveToProfile = () => {
    try {
      updateSection('lifestyle', {
        fatigueLevel: Math.min(10, Math.max(1, Math.round(fatigue / 10))),
        // readiness в profile не хранится явно — но recovery (lifestyle) можно проксировать
      });
      updateSection('training', {
        recovery: Math.min(10, Math.max(1, Math.round(recovery / 10))),
      });
      setLastSavedAt(Date.now());
      const toast = (window as any).showToast;
      if (typeof toast === 'function') toast('✓ Сохранено в профиль', 'success');
      else alert('✓ Сохранено в профиль');
    } catch (e) {
      console.error('[AutoregPanel.saveToProfile]', e);
      alert('Ошибка сохранения: ' + (e as Error).message);
    }
  };

  const out: AutoregOutput | null = useMemo(() => {
    try {
      const risk = fatigue > 70 ? 'high' : fatigue > 45 ? 'medium' : 'low';
      return autoregulate({
        priScore: readiness / 100,
        fatigueScore: fatigue / 100,
        recoveryScore: recovery / 100,
        jointFatigue: { spine: fatigue / 120, knee: fatigue / 130, shoulder: fatigue / 140 },
        cumulativeLoad: { overload: fatigue > 75, monotony: 1 + fatigue / 200, strain: fatigue / 100 },
        riskLevel: risk as 'low' | 'medium' | 'high',
        techniqueScore: 0.8,
        velocityTrend: readiness > fatigue ? 1 : -1,
        goal,
        plannedIntensity: intensity,
        plannedSets: sets,
        plannedReps: reps,
        plannedFrequency: freq,
        exerciseJointStress: { squat: 0.7, bench: 0.4, deadlift: 0.8 },
      });
    } catch { return null; }
  }, [readiness, fatigue, recovery, goal, intensity, sets, reps, freq]);

  return (
    <div className="pl-autoreg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><div style={LABEL}>Готовность (PRI), %</div><input style={IN} type="number" min={0} max={100} value={readiness} onChange={e => setReadiness(+e.target.value)} /></div>
        <div><div style={LABEL}>Усталость, %</div><input style={IN} type="number" min={0} max={100} value={fatigue} onChange={e => setFatigue(+e.target.value)} /></div>
        <div><div style={LABEL}>Восстановление, %</div><input style={IN} type="number" min={0} max={100} value={recovery} onChange={e => setRecovery(+e.target.value)} /></div>
        <div><div style={LABEL}>Цель</div><select style={SEL} value={goal} onChange={e => setGoal(e.target.value as any)}>
          <option value="strength">Сила</option>
          <option value="hypertrophy">Гипертрофия</option>
        </select></div>
        <div><div style={LABEL}>План. интенсивность %1RM</div><input style={IN} type="number" min={50} max={100} value={intensity} onChange={e => setIntensity(+e.target.value)} /></div>
        <div><div style={LABEL}>План. сеты/упр</div><input style={IN} type="number" min={1} max={10} value={sets} onChange={e => setSets(+e.target.value)} /></div>
        <div><div style={LABEL}>План. повт</div><input style={IN} type="number" min={1} max={20} value={reps} onChange={e => setReps(+e.target.value)} /></div>
        <div><div style={LABEL}>План. частота дн/нед</div><input style={IN} type="number" min={1} max={7} value={freq} onChange={e => setFreq(+e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
        <button
          onClick={autofillFromProfile}
          aria-label="Загрузить из Профиля"
          style={{
            flex: 1, minHeight: 40, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 700, fontSize: 12,
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >📋 Из профиля</button>
        <button
          onClick={saveToProfile}
          aria-label="Сохранить в Профиль"
          style={{
            flex: 1, minHeight: 40, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontWeight: 700, fontSize: 12,
            border: '1px solid rgba(0,230,138,0.3)',
          }}
        >💾 Сохранить в профиль</button>
      </div>
      {lastSavedAt && (
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
          ✓ Сохранено: {new Date(lastSavedAt).toLocaleTimeString('ru')}
        </div>
      )}

      {out && (
        <div>
          {out.sessionCancelled && <div style={{ ...CARD, borderColor: '#ef4444' }}><div style={{ color: '#ef4444', fontWeight: 700 }}>🛑 Сессия отменена — критическая неготовность.</div></div>}
          {out.sessionDowngraded && !out.sessionCancelled && <div style={{ ...CARD, borderColor: '#f59e0b' }}><div style={{ color: '#f59e0b', fontWeight: 700 }}>⚠ Сессия даунгрейдится — высокая суставная/накопленная усталость.</div></div>}

          <div style={CARD}>
            <div style={H}>📋 Решения авто-регуляции</div>
            <div style={{ ...SMALL, marginBottom: 6 }}>{out.summary}</div>
            <DecisionRow label="Интенсивность" dir={out.intensity.adjustment} extra={`цель ${out.intensity.targetIntensity}%1RM · RPE ${out.intensity.targetRPE} · RIR ${out.intensity.targetRIR}`} reasons={out.intensity.reasons} />
            <DecisionRow label="Объём" dir={out.volume.adjustment} extra={`${out.volume.targetSets}×${out.volume.targetReps}`} reasons={out.volume.reasons} />
            <DecisionRow label="Частота" dir={out.frequency.adjustment} extra={`${out.frequency.targetFrequency} дн/нед`} reasons={out.frequency.reasons} />
            <DecisionRow label="Выбор упражнений" dir={out.exercise.adjustment} extra={out.exercise.replaceExercises.length ? `заменить: ${out.exercise.replaceExercises.join(', ')}` : 'без замен'} reasons={out.exercise.reasons} />
          </div>
        </div>
      )}
    </div>
  );
};

const DecisionRow: React.FC<{ label: string; dir: string; extra: string; reasons: string[] }> = ({ label, dir, extra, reasons }) => (
  <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span style={{ color: dirColor(dir), fontSize: 12, fontWeight: 700 }}>{dirLabel(dir)}</span>
    </div>
    <div style={{ ...SMALL, marginTop: 2 }}>{extra}</div>
    {reasons.length > 0 && <div style={{ ...SMALL, color: '#fff', marginTop: 2 }}>• {reasons.join(' • ')}</div>}
  </div>
);

export default AutoregPanel;
