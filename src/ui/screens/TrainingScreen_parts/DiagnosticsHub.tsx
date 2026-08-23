/** DiagnosticsHub.tsx — ДИАГНОСТИКА ДВИЖЕНИЯ.
 *  Единый инструмент — Мастер движения (LiftMasterCard): 9 лифтов × 10 блоков,
 *  включая срывы (дневник), RIR-калибровку и коррекцию мезоцикла.
 *  Суставы/ортопедия — в отдельной вкладке «Суставы и ортопедия» (joints_ortho). */
import React, { useMemo } from 'react';
import { LiftMasterCard } from './LiftMasterCard';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony } from '../../../engines/pro/training-load.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.85)';

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
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔬 Диагностика движения</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12, lineHeight: 1.45 }}>
        Единый инструмент: слабые мышцы → слабые точки → мёртвые точки → движение штанги → геометрия техники → VBT → <b style={{ color: '#fbbf24' }}>срывы (дневник RPE≥8)</b> → <b style={{ color: '#60a5fa' }}>RIR-калибровка</b> → <b style={{ color: '#a78bfa' }}>коррекция мезоцикла</b> → остальные лимитирующие. Все 9 движений. Суставы/ортопедия — во вкладке <b style={{ color: '#f43f5e' }}>«Суставы и ортопедия»</b>.
      </div>
      <LiftMasterCard
        sessions={sessions}
        profile={tprofile}
        acwr={acwrData.acwr}
        monotony={acwrData.monotony}
        readinessRecovery={readinessRecovery}
        readinessFatigue={readinessFatigue}
        mesoWeeks={mesoWeeks}
        missedSessions={missedSessions}
        currentVolume={currentVolume}
        currentRir={currentRir}
        exercises={readinessExercises}
      />
    </div>
  );
};

export default DiagnosticsHub;
