/** LoadManagementHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: sRPE/ACWR, Усталость, MRV, Объём↔Восст, What-if, Чек-ин.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { TrainingLoadCalculator } from './TrainingLoadCalculator';
import { FatigueIndexTab } from './FatigueIndexTab';
import { MRVEstimatorTab } from './MRVEstimatorTab';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import { WhatIfCard } from './WhatIfCard';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type LoadManagementHubMode = 'load' | 'fatigue' | 'mrv' | 'volrec' | 'whatif' | 'checkin';

const MODE_DEFS: Array<{ m: LoadManagementHubMode; label: string; icon: string }> = [
  { m: 'load', label: 'sRPE/ACWR', icon: '📊' },
  { m: 'fatigue', label: 'Усталость', icon: '📉' },
  { m: 'mrv', label: 'MRV', icon: '🎯' },
  { m: 'volrec', label: 'Объём↔Восст', icon: '🔄' },
  { m: 'whatif', label: 'What-if', icon: '🔮' },
  { m: 'checkin', label: 'Чек-ин', icon: '📋' }
];

export interface LoadManagementHubProps {
  sessions: WorkoutLog[];
  baseRisk: number;
  baseReadiness: number;
}

export const LoadManagementHub: React.FC<LoadManagementHubProps> = ({
  sessions, baseRisk, baseReadiness,
}) => {
  const [mode, setMode] = useState<LoadManagementHubMode>('load');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>📊 Управление нагрузкой</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>sRPE/ACWR, индекс усталости, MRV-оценщик, корреляция объём↔восстановление, what-if сценарии, чек-ин метрик.</div>

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

      {mode === 'load' && <TrainingLoadCalculator />}
      {mode === 'fatigue' && <FatigueIndexTab />}
      {mode === 'mrv' && <MRVEstimatorTab />}
      {mode === 'volrec' && <VolumeRecoveryCorrelationCard sessions={sessions} />}
      {mode === 'whatif' && <WhatIfCard baseRisk={baseRisk} baseReadiness={baseReadiness} />}
      {mode === 'checkin' && <CheckinMetricsCard />}
    </div>
  );
};

export default LoadManagementHub;
