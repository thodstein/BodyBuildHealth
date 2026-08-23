/** QualityJointHub.tsx — DEPRECATED алиас. Разделён на два инструмента:
 *  - QualityHub (⭐ Качество — отдельный)
 *  - DiagnosticsHub (🔬 Диагностика — отдельный)
 *  Оставлен для обратной совместимости TAB_TO_ZONE алиасов.
 */
import React from 'react';
import { QualityHub } from './QualityHub';
import { DiagnosticsHub } from './DiagnosticsHub';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';

export interface QualityJointHubProps { sessions: WorkoutLog[]; tprofile: TrainingProfile; readinessRecovery: number; readinessFatigue: number; mesoWeeks: number; missedSessions: number; currentVolume: number; currentRir: number; onBuildPlan: () => void; }

export const QualityJointHub: React.FC<QualityJointHubProps> = (props) => {
  // По умолчанию показываем качество (диагностика — в своей вкладке)
  return <QualityHub onBuildPlan={props.onBuildPlan} />;
};

export default QualityJointHub;
