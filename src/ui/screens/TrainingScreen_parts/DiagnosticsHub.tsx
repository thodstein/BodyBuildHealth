/** DiagnosticsHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: Слабые точки ПЛ, Срывы, RIR-калибр., Коррекция мезо.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { PlWeakpointsCard } from './PlWeakpointsCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type DiagnosticsHubMode = 'weakpoints' | 'sticking' | 'rir' | 'mesocorr';

const MODE_DEFS: Array<{ m: DiagnosticsHubMode; label: string; icon: string }> = [
  { m: 'weakpoints', label: 'Слабые точки ПЛ', icon: '🎯' },
  { m: 'sticking', label: 'Срывы', icon: '🔬' },
  { m: 'rir', label: 'RIR-калибр.', icon: '🎯' },
  { m: 'mesocorr', label: 'Коррекция мезо', icon: '🔧' }
];

export const DiagnosticsHub: React.FC = () => {
  const [mode, setMode] = useState<DiagnosticsHubMode>('weakpoints');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔬 Диагностика</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>Слабые точки движений, анализ срывов, RIR-калибровка и автоматическая коррекция мезоцикла.</div>

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
      {mode === 'sticking' && <StickingPointAnalysisCard sessions={[]} />}
      {mode === 'rir' && <RIRCalibrationCard />}
      {mode === 'mesocorr' && <MesoCorrectionCard profile={{} as any} acwr={1} monotony={1} avgReadiness={80} mesoWeeks={12} missedSessions={0} exercises={[]} currentVolume={18} currentRir={2} />}
    </div>
  );
};

export default DiagnosticsHub;
