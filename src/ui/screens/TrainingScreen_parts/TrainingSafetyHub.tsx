/**
 * TrainingSafetyHub.tsx — единый инструмент «Безопасность и нагрузка».
 *
 * Это КОНТЕЙНЕР, а не новый расчёт: он собирает существующие калькуляторы
 * (безопасность / восстановление / регуляция нагрузки) в один экран с секциями.
 * Каждая секция рендерит уже существующий компонент как есть — формулы не дублируются.
 */
import React, { useState } from 'react';

import { ExerciseSafetyPanel } from '../SRCBBScreen_parts/ExerciseSafetyPanel';
import { LoadSafetyCard } from './LoadSafetyCard';
import { TrainingLoadCalculator } from './TrainingLoadCalculator';
import { FatigueIndexTab } from './FatigueIndexTab';
import { MRVEstimatorTab } from './MRVEstimatorTab';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';
import { AutoregPanel } from '../SRCBBScreen_parts/AutoregPanel';
import { RecoveryPanel } from '../SRCBBScreen_parts/RecoveryPanel';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { WhatIfCard } from './WhatIfCard';
import { PriRepPatternCard } from './PriRepPatternCard';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import type { WorkoutLog } from '../../../core/types';

type SectionId = 'safety' | 'load' | 'volume' | 'autoreg' | 'recovery' | 'cardio' | 'deload';

const SECTIONS: Array<{ id: SectionId; label: string; icon: string; desc: string }> = [
  { id: 'safety', label: 'Безопасность', icon: '🛡', desc: 'Оценка упражнений, суставной стресс, ортопедические ограничения' },
  { id: 'load', label: 'Нагрузка', icon: '📊', desc: 'sRPE/ACWR/Banister, индекс усталости, монотонность' },
  { id: 'volume', label: 'Объём', icon: '🎯', desc: 'MRV-оценщик и оптимизатор объёма (MEV/MAV/MRV)' },
  { id: 'autoreg', label: 'Авторегуляция', icon: '⚙️', desc: 'RPE/e1RM, готовность, PRI, рабочий вес' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', desc: 'Сон, HRV, готовность, чек-ин, what-if' },
  { id: 'cardio', label: 'Кардио', icon: '🏃', desc: 'Кардио-план по цели, весу и доступным дням' },
  { id: 'deload', label: 'Разгрузка', icon: '🧘', desc: 'Планировщик разгрузочных недель' },
];

export const TrainingSafetyHub: React.FC<{ initialSection?: SectionId; sessions?: WorkoutLog[] }> = ({ initialSection = 'safety', sessions = [] }) => {
  const [section, setSection] = useState<SectionId>(initialSection);

  return (
    <div style={{ color: '#fff', padding: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginBottom: 2 }}>🛡 Безопасность и нагрузка</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.4 }}>
        Единый инструмент: безопасность упражнений и плана, тренировочная нагрузка, объём, авторегуляция, восстановление, кардио и разгрузка.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} aria-label={s.label}
            style={{
              padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border: section === s.id ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
              background: section === s.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
              color: section === s.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
            }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
        {SECTIONS.find(s => s.id === section)?.desc}
      </div>

      {section === 'safety' && (
        <>
          <ExerciseSafetyPanel />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <LoadSafetyCard initialSubTab="ortho" />
        </>
      )}
      {section === 'load' && (
        <>
          <TrainingLoadCalculator />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <FatigueIndexTab />
        </>
      )}
      {section === 'volume' && (
        <>
          <MRVEstimatorTab />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <VolumeOptimizerTab />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <VolumeRecoveryCorrelationCard sessions={sessions} />
        </>
      )}
      {section === 'autoreg' && (
        <>
          <AutoregPanel />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <LoadSafetyCard initialSubTab="autoreg" />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <PriRepPatternCard />
        </>
      )}
      {section === 'recovery' && (
        <>
          <RecoveryPanel />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <CheckinMetricsCard />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <WhatIfCard baseRisk={20} baseReadiness={75} />
        </>
      )}
      {section === 'cardio' && <LoadSafetyCard initialSubTab="cardio" />}
      {section === 'deload' && <DeloadSchedulerTab />}
    </div>
  );
};

export default TrainingSafetyHub;
