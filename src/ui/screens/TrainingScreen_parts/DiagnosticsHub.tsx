/** DiagnosticsHub.tsx — ПОЛНЫЙ КАЛЬКУЛЯТОР ДИАГНОСТИКИ (5 режимов).
 * Объединяет: Слабые точки ПЛ, Срывы, Биомеханика+Bar-path, RIR-калибр., Коррекция мезо.
 * Ранее было 2 отдельных компонента (DiagnosticsHub + ProPlToolsTab diag) — теперь всё здесь. */
import React, { useState, useMemo } from 'react';
import { PlWeakpointsCard } from './PlWeakpointsCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import { diagnoseLift, stickingPhases, barPathAnalysis, type BarPathIssue } from '../../../engines/pro/lift-diagnostics.engine';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony } from '../../../engines/pro/training-load.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };
const LIFT_RU: Record<string, string> = { squat: 'Присед', bench: 'Жим', deadlift: 'Тяга' };

type DiagnosticsHubMode = 'weakpoints' | 'sticking' | 'biomechanics' | 'rir' | 'mesocorr';

const MODE_DEFS: Array<{ m: DiagnosticsHubMode; label: string; icon: string }> = [
  { m: 'weakpoints', label: 'Слабые точки ПЛ', icon: '🎯' },
  { m: 'sticking', label: 'Срывы', icon: '🔬' },
  { m: 'biomechanics', label: 'Биомеханика+Bar-path', icon: '🔧' },
  { m: 'rir', label: 'RIR-калибр.', icon: '🎯' },
  { m: 'mesocorr', label: 'Коррекция мезо', icon: '🔧' }
];

/** Внутренний компонент биомеханики + bar-path (из ProPlToolsTab diag). */
const DiagnosticsBiomechanicsCard: React.FC = () => {
  const [diagLift, setDiagLift] = useState<Lift>('squat');
  const phases = useMemo(() => stickingPhases(diagLift), [diagLift]);
  const [diagPhase, setDiagPhase] = useState('');
  const [barIssues, setBarIssues] = useState<BarPathIssue[]>([]);
  const diag = useMemo(() => diagPhase ? diagnoseLift(diagLift, diagPhase as any) : null, [diagLift, diagPhase]);
  const barPath = useMemo(() => barIssues.length > 0 ? barPathAnalysis(diagLift, barIssues) : null, [diagLift, barIssues]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px', color: '#fff' }}>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>Диагностика мёртвых точек (sticking points) по биомеханике: где срыв, почему, что делать.</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
          <button key={l} onClick={() => { setDiagLift(l); setDiagPhase(''); }} style={{
            flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            border: diagLift === l ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: diagLift === l ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
            color: diagLift === l ? ACCENT : DIM
          }}>{LIFT_RU[l]}</button>
        ))}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, color: DIM }}>Слабая фаза</label>
        <select value={diagPhase} onChange={e => setDiagPhase(e.target.value)} style={{ ...IN, textAlign: 'left', marginTop: 3 }}>
          <option value="">Выберите фазу...</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {diag && (
        <div style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{LIFT_RU[diag.lift]} — {diag.phaseLabel}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>📍 Угол: {diag.angleRangeDeg[0]}°-{diag.angleRangeDeg[1]}° · сустав: {diag.keyJoint}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>🧠 Причина: {diag.biomechanicalReason}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>💪 Слабые мышцы: {diag.weakMuscles.join(', ')}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginTop: 6 }}>Коррекции:</div>
          {diag.corrections.map((c, i) => <div key={i} style={{ fontSize: 10, color: DIM, marginBottom: 1 }}>• {c}</div>)}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginTop: 6 }}>Ассистентные: {diag.assistance.join(', ')} @ {Math.round(diag.assistanceIntensityPct * 100)}%</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 3 }}>💡 Кью: {diag.loadCues}</div>
        </div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>📊 Bar-path анализ</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {(['forward_drift', 'hips_shoot_up', 'good_morning', 'bar_loops', 'asymmetric'] as BarPathIssue[]).map(iss => (
            <button key={iss} onClick={() => setBarIssues(prev => prev.includes(iss) ? prev.filter(x => x !== iss) : [...prev, iss])} style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer',
              border: barIssues.includes(iss) ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
              background: barIssues.includes(iss) ? 'rgba(168,85,247,0.12)' : 'transparent',
              color: barIssues.includes(iss) ? '#a855f7' : DIM
            }}>{iss.replace(/_/g, ' ')}</button>
          ))}
        </div>
        {barPath?.diagnoses.map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>
            <b style={{ color: '#a855f7' }}>{d.issue.replace(/_/g, ' ')}:</b> {d.cause} <span style={{ color: ACCENT }}>→ {d.correction}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface DiagnosticsHubProps {
  sessions: WorkoutLog[];
  tprofile: TrainingProfile;
  readinessRecovery: number;
  readinessFatigue: number;
  mesoWeeks: number;
  missedSessions: number;
  currentVolume: number;
  currentRir: number;
}

export const DiagnosticsHub: React.FC<DiagnosticsHubProps> = ({
  sessions, tprofile, readinessRecovery, readinessFatigue,
  mesoWeeks, missedSessions, currentVolume, currentRir,
}) => {
  const [mode, setMode] = useState<DiagnosticsHubMode>('weakpoints');

  const acwrData = useMemo(() => {
    const s = loadSRPESessions();
    if (s.length < 2) return { acwr: 1, monotony: 1 };
    const d = toDailyLoads(s);
    return {
      acwr: acuteChronicRatio(d).ratio,
      monotony: weeklyMonotony(d).monotony,
    };
  }, []);

  const readinessExercises = useMemo(() => sessions.slice(0, 20).flatMap((w: any) =>
    (w.exercises || []).map((e: any) => {
      const sets = e.sets || [];
      const e1rmBefore = sets[0]
        ? Math.round((sets[0].weight || 0) * (1 + (sets[0].reps || 0) / 30))
        : 0;
      const lastSet = sets[sets.length - 1] || sets[0];
      const e1rmAfter = lastSet
        ? Math.round((lastSet.weight || 0) * (1 + (lastSet.reps || 0) / 30))
        : 0;
      return {
        name: e.exerciseName || e.exerciseId || '',
        e1rmBefore,
        e1rmAfter,
      };
    })
  ), [sessions]);

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔬 Диагностика</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Слабые точки движений, анализ срывов, биомеханика+bar-path, RIR-калибровка и автоматическая коррекция мезоцикла.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon }) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 16px', borderRadius: 8,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'weakpoints' && <PlWeakpointsCard />}
      {mode === 'sticking' && <StickingPointAnalysisCard sessions={sessions} />}
      {mode === 'biomechanics' && <DiagnosticsBiomechanicsCard />}
      {mode === 'rir' && <RIRCalibrationCard />}
      {mode === 'mesocorr' && (
        <MesoCorrectionCard
          profile={tprofile}
          acwr={acwrData.acwr}
          monotony={acwrData.monotony}
          avgReadiness={readinessRecovery}
          mesoWeeks={mesoWeeks}
          missedSessions={missedSessions}
          exercises={readinessExercises}
          currentVolume={currentVolume}
          currentRir={currentRir}
        />
      )}
    </div>
  );
};

export default DiagnosticsHub;
