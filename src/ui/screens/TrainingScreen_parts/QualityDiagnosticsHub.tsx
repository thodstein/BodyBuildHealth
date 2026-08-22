/** QualityDiagnosticsHub.tsx — ЕДИНЫЙ хаб «Качество + Диагностика» без дублей.
 *  Объединяет CalcQualityTab (оценка плана 0-100, MEV/MAV/MRV) и DiagnosticsHub (мастер движения 9 лифтов, суставы AI, срывы, RIR, мезо).
 *  Внутри — 2 подвкладки, общий хедер с пояснениями. Полные инструменты сохранены, дубли убраны.
 *  Старые tab ID calc_quality / diagnostics остаются алиасами → quality_diagnostics.
 */
import React, { useState } from 'react';
import { CalcQualityTab } from './CalcQualityTab';
import { DiagnosticsHub } from './DiagnosticsHub';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

type HubMode = 'quality' | 'diagnostics';

const MODE_DEFS: Array<{ m: HubMode; label: string; icon: string; desc: string }> = [
  { m: 'quality', label: 'Качество', icon: '⭐', desc: 'Оценка плана 0-100: MEV/MAV/MRV по группам, PED/лаб коррекция' },
  { m: 'diagnostics', label: 'Диагностика', icon: '🔬', desc: 'Мастер движения (9 лифтов) + суставы AI + срывы (дневник RPE≥8) + RIR + мезо-коррекция' },
];

export interface QualityDiagnosticsHubProps {
  sessions: WorkoutLog[];
  tprofile: TrainingProfile;
  readinessRecovery: number;
  readinessFatigue: number;
  mesoWeeks: number;
  missedSessions: number;
  currentVolume: number;
  currentRir: number;
  onBuildPlan: () => void;
}

export const QualityDiagnosticsHub: React.FC<QualityDiagnosticsHubProps> = (props) => {
  const [mode, setMode] = useState<HubMode>('quality');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🎯 Качество и диагностика — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: слева — <b style={{ color: '#fff' }}>оценка плана</b> (0-100, объём по группам), справа — <b style={{ color: '#fff' }}>диагностика</b> (мастер движения 9 лифтов, суставы AI-ортопед, срывы дневник, RIR, мезо). Полные инструменты сохранены, переключение без потери контекста.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Качество» — полоса 0-100 (≥80 зел/≥50 жёлт), ниже — группы: сеты vs MEV/MAV/MRV, % от MRV, статус low/high/over. «Диагностика» — 5 подвкладок: мастер движения (9 лифтов: вес×объём×темп×анатомия→тепловая карта), суставы (JSI — вес×темп×геометрия×фарма×боль), срывы (авто из дневника RPE≥8, не ручной ввод), RIR (калибровка), мезо (ACWR/монотония). Все графики с пояснениями внутри.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => {
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc} style={{
              padding: '8px 14px', borderRadius: 8,
              border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
              background: active ? 'rgba(0,230,138,0.12)' : 'rgba(0,0,0,0.3)',
              color: active ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {icon} {label}
            </button>
          );
        })}
      </div>

      {mode === 'quality' && <CalcQualityTab onBuildPlan={props.onBuildPlan} />}
      {mode === 'diagnostics' && (
        <DiagnosticsHub
          sessions={props.sessions}
          tprofile={props.tprofile}
          readinessRecovery={props.readinessRecovery}
          readinessFatigue={props.readinessFatigue}
          mesoWeeks={props.mesoWeeks}
          missedSessions={props.missedSessions}
          currentVolume={props.currentVolume}
          currentRir={props.currentRir}
        />
      )}
    </div>
  );
};

export default QualityDiagnosticsHub;
