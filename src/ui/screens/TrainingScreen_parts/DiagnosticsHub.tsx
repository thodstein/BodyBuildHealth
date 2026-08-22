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
import { LiftMasterCard } from './LiftMasterCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

// Дедуп: единый инструмент покрывает старые movement/limiter — они скрыты, остались как алиасы для совместимости. Суставы/ортопедия — в отдельной вкладке «Суставы и ортопедия» (joints_ortho).
type DiagnosticsHubMode = 'master' | 'sticking' | 'rir' | 'mesocorr';
type LegacyMode = 'movement' | 'limiter' | 'jsi';

const MODE_DEFS: Array<{ m: DiagnosticsHubMode; label: string; icon: string }> = [
  { m: 'master', label: 'Мастер движения', icon: '🏋️' },
  { m: 'sticking', label: 'Срывы (дневник)', icon: '🔬' },
  { m: 'rir', label: 'RIR', icon: '🎯' },
  { m: 'mesocorr', label: 'Мезо', icon: '🔧' },
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
  const [modeRaw, setModeRaw] = useState<DiagnosticsHubMode | LegacyMode>('master');
  // алиас старых режимов на единый инструмент (jsi → Мастер движения; суставы — в отдельной вкладке joints_ortho)
  const mode: DiagnosticsHubMode = modeRaw === 'movement' || modeRaw === 'limiter' || modeRaw === 'jsi' ? 'master' : modeRaw as DiagnosticsHubMode;
  const setMode = (m: DiagnosticsHubMode | LegacyMode) => setModeRaw(m);

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
        <b style={{ color: ACCENT }}>Новое: Мастер движения (9 лифтов)</b> — вес×объём×темп×анатомия×фарма×боль → тепловая карта + deadly combos + тюнинг + нутрицевтики. «Срывы» — авто-анализ дневника (RPE≥8), не ручной ввод. Суставы/ортопедия — в отдельной вкладке <b style={{ color: '#f43f5e' }}>«Суставы и ортопедия»</b> (единый инструмент). Старые помечены @deprecated.
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

      {mode === 'master' && (
        <>
          <LiftMasterCard sessions={sessions} />
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: DIM, marginBottom: 4 }}>🔬 Срывы (из дневника) — кратко; полный анализ в отдельной вкладке</div>
            <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4, marginBottom: 6 }}>Авто-детект тяжёлых подходов RPE≥8 (фаза по phaseForReps, ≥6 повт. = неопределена). Ручной ввод фаз — в блоке выше; срывы — только факт дневника.</div>
            <StickingPointAnalysisCard sessions={sessions} />
            <button onClick={() => setMode('sticking')} style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: DIM, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Открыть полный режим «Срывы (дневник)» →</button>
          </div>
        </>
      )}
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
