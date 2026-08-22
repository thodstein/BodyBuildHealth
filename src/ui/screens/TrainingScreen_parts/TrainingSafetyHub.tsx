/**
 * TrainingSafetyHub.tsx — единый инструмент «Безопасность и нагрузка».
 *
 * КОНТЕЙНЕР без дублей формул: собирает существующие калькуляторы в один экран.
 * Суставы (50% безопасности) вынесены в отдельный раздел «Суставы» — 8-блочный мастер + JSI
 * (joint-load-master + joint-jsi) — тот же движок что и в «Качество+Диагностика», без второго расчёта.
 * Лёгкая ортопедия в Safety — быстрый чек; глубокий анализ — в Суставах.
 */
import React, { useState } from 'react';

import { ExerciseSafetyPanel } from '../SRCBBScreen_parts/ExerciseSafetyPanel';
import { LoadSafetyCard } from './LoadSafetyCard';
import { TrainingLoadCalculator } from './TrainingLoadCalculator';
import { FatigueIndexTab } from './FatigueIndexTab';
import { AutoregPanel } from '../SRCBBScreen_parts/AutoregPanel';
import { RecoveryPanel } from '../SRCBBScreen_parts/RecoveryPanel';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { WhatIfCard } from './WhatIfCard';
import { PriRepPatternCard } from './PriRepPatternCard';
import { JointMasterCard } from './JointMasterCard';
import type { WorkoutLog } from '../../../core/types';

type SectionId = 'safety' | 'joints' | 'load' | 'autoreg' | 'recovery' | 'cardio';

const SECTIONS: Array<{ id: SectionId; label: string; icon: string; desc: string }> = [
  { id: 'safety', label: 'Безопасность', icon: '🛡', desc: 'Общая оценка упражнения: паттерн/синергия/суставной стресс/противопоказания (быстрый чек)' },
  { id: 'joints', label: 'Суставы', icon: '🦴', desc: '8 блоков + JSI: анатомия риска → нагрузка → геометрия→сустав → недельный план → прехаб → FMS → замены + тепловая карта (50% безопасности)' },
  { id: 'load', label: 'Нагрузка', icon: '📊', desc: 'sRPE/ACWR/Banister, индекс усталости, монотонность' },
  { id: 'autoreg', label: 'Авторегуляция', icon: '⚙️', desc: 'RPE/e1RM, готовность, PRI, рабочий вес' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', desc: 'Сон, HRV, готовность, чек-ин, сценарий «что-если»' },
  { id: 'cardio', label: 'Кардио', icon: '🏃', desc: 'Кардио-план по цели, весу и доступным дням' },
];

export const TrainingSafetyHub: React.FC<{ initialSection?: SectionId; sessions?: WorkoutLog[] }> = ({ initialSection = 'safety', sessions = [] }) => {
  const [section, setSection] = useState<SectionId>(initialSection);

  return (
    <div style={{ color: '#fff', padding: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginBottom: 2 }}>🛡 Безопасность и нагрузка</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.4 }}>
        Единый контейнер без дублей формул: безопасность (общая) + <b style={{ color: '#fff' }}>суставы (50% — 8 блоков + JSI)</b> + нагрузка + авторегуляция + восстановление + кардио. Объём → <b style={{ color: '#fff' }}>Объём-хаб</b> (MEV/MAV/MRV), разгрузка → <b style={{ color: '#fff' }}>Периодизация-хаб</b>. Источники: Foster/Banister/Helms/McGill + JSI (вес×темп×геометрия×фарма×боль).
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
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.14)', fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
            🦴 Глубокий анализ сустава (JSI, 8 блоков) — в разделе <b style={{ color: '#f43f5e' }}>«Суставы»</b> этого хаба и также в «Качество+Диагностика → Суставы». Дубли нет — один движок <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>joint-load-master + joint-jsi</code>.
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Быстрый орто-чеk (лёгкий):</div>
          <LoadSafetyCard initialSubTab="ortho" />
        </>
      )}
      {section === 'joints' && <JointMasterCard />}
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
      {section === 'cardio' && <LoadSafetyCard initialSubTab="cardio" />}
    </div>
  );
};

export default TrainingSafetyHub;
