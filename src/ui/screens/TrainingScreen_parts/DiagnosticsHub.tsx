/** DiagnosticsHub.tsx — ПОЛНЫЙ КАЛЬКУЛЯТОР ДИАГНОСТИКИ.
 *  Режимы: Диагностика движения (единый блок «Мёртвые точки → Слабые точки →
 *  Движение штанги»), Срывы (дневник), RIR-калибр., Коррекция мезо.
 *  Ранее было 6 режимов — weakpoints/deadpoints/biomechanics объединены в единый
 *  калькулятор PlDeadpointsBarPathCard (дом здесь). */
import React, { useState, useMemo } from 'react';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { PlDeadpointsBarPathCard } from './PlDeadpointsBarPathCard';
import { LimiterCalculatorCard } from './LimiterCalculatorCard';
import { LiftMasterCard } from './LiftMasterCard';
import { JointMasterCard } from './JointMasterCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

type DiagnosticsHubMode = 'master' | 'movement' | 'limiter' | 'joint' | 'sticking' | 'rir' | 'mesocorr';

const MODE_DEFS: Array<{ m: DiagnosticsHubMode; label: string; icon: string }> = [
  { m: 'master', label: 'Жим лёжа — единый инструмент', icon: '🏋️' },
  { m: 'movement', label: 'Мёртвые точки → Слабые точки → Движение штанги', icon: '🎯' },
  { m: 'limiter', label: 'Лимитирующие факторы движения', icon: '🧩' },
  { m: 'joint', label: 'Суставно-связочный (поясница+)', icon: '🦴' },
  { m: 'sticking', label: 'Срывы (дневник)', icon: '🔬' },
  { m: 'rir', label: 'RIR-калибр.', icon: '🎯' },
  { m: 'mesocorr', label: 'Коррекция мезо', icon: '🔧' },
];

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
  const [mode, setMode] = useState<DiagnosticsHubMode>('master');

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
        <b style={{ color: ACCENT }}>Новое: «Жим — единый инструмент» + «Суставно-связочный (поясница+)»</b> — один экран на всё (слабые → мёртвые → bar-path → геометрия → VBT, и суставы L4-S1/плечо/колено). Старые калькуляторы помечены @deprecated — прячем через 1 релиз, пока доступны как эксперт.
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

      {mode === 'master' && <LiftMasterCard sessions={sessions} />}
      {mode === 'joint' && <JointMasterCard />}
      {mode === 'movement' && <PlDeadpointsBarPathCard sessions={sessions as any} />}
      {mode === 'limiter' && <LimiterCalculatorCard />}
      {mode === 'sticking' && <StickingPointAnalysisCard sessions={sessions} />}
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
