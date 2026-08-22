/**
 * TrainingSafetyHub.tsx — единый инструмент «Безопасность и нагрузка».
 *
 * КОНТЕЙНЕР без дублей формул: собирает существующие калькуляторы в один экран.
 * Суставы/ортопедия + оценка техники упражнения — в отдельной вкладке «Суставы и ортопедия»
 * (joints_ortho, единый инструмент с подвкладками). Здесь — только быстрый орто-чек (LoadSafetyCard ortho).
 */
import React, { useState } from 'react';

import { LoadSafetyCard } from './LoadSafetyCard';
import { TrainingLoadCalculator } from './TrainingLoadCalculator';
import { FatigueIndexTab } from './FatigueIndexTab';
import { AutoregPanel } from '../SRCBBScreen_parts/AutoregPanel';
import { RecoveryPanel } from '../SRCBBScreen_parts/RecoveryPanel';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { WhatIfCard } from './WhatIfCard';
import { PriRepPatternCard } from './PriRepPatternCard';
import type { WorkoutLog } from '../../../core/types';

type SectionId = 'ortho' | 'load' | 'autoreg' | 'recovery';

const SECTIONS: Array<{ id: SectionId; label: string; icon: string; desc: string }> = [
  { id: 'ortho', label: 'Ортопедия', icon: '🦴', desc: 'Быстрый орто-чек: травмы → ограничения, недельное распределение нагрузки' },
  { id: 'load', label: 'Нагрузка', icon: '📊', desc: 'sRPE/ACWR/Banister, индекс усталости, монотонность' },
  { id: 'autoreg', label: 'Авторегуляция', icon: '⚙️', desc: 'RPE/e1RM, готовность, PRI, рабочий вес' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', desc: 'Сон, HRV, готовность, чек-ин, сценарий «что-если»' },
];

export const TrainingSafetyHub: React.FC<{ initialSection?: SectionId; sessions?: WorkoutLog[] }> = ({ initialSection = 'ortho', sessions = [] }) => {
  const [section, setSection] = useState<SectionId>(initialSection);

  return (
    <div style={{ color: '#fff', padding: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginBottom: 2 }}>🛡 Безопасность и нагрузка</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.4 }}>
        Единый контейнер без дублей формул: ортопедия (быстрый чек) + нагрузка + авторегуляция + восстановление. Полный разбор сустава и техники упражнения → <b style={{ color: '#fff' }}>«Суставы и ортопедия»</b> (вкладка рядом, единый инструмент). Кардио-цикл → <b style={{ color: '#fff' }}>Кардио-конструктор</b> (Планировщик), объём → <b style={{ color: '#fff' }}>Объём-хаб</b> (MEV/MAV/MRV). Источники: Foster/Banister/Helms/McGill.
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

      {section === 'ortho' && (
        <>
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.14)', fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
            🦴 Глубокий анализ сустава (JSI, 8 блоков, FMS) и оценка техники упражнения — во вкладке <b style={{ color: '#f43f5e' }}>«Суставы и ортопедия»</b> (единый инструмент, без дублей). Здесь — быстрый орто-чек.
          </div>
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
    </div>
  );
};

export default TrainingSafetyHub;
