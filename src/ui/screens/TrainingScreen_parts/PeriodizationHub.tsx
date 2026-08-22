/** PeriodizationHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: Дизайнер, Прогрессия, Трекер, Микроциклы, Делод, Пик, Taper.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { PeriodizationDesignerTab } from './PeriodizationDesignerTab';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { MesocycleTrackerTab } from './MesocycleTrackerTab';
import { MicrocyclePlannerCard } from './MicrocyclePlannerCard';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import PeakingProtocolTab from './PeakingProtocolTab';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type PeriodizationHubMode = 'designer' | 'progression' | 'tracker' | 'micro' | 'deload' | 'peaking';

const MODE_DEFS: Array<{ m: PeriodizationHubMode; label: string; icon: string }> = [
  { m: 'designer', label: 'Дизайнер', icon: '🏗️' },
  { m: 'progression', label: 'Прогрессия', icon: '📈' },
  { m: 'tracker', label: 'Трекер', icon: '📊' },
  { m: 'micro', label: 'Микроциклы', icon: '🗓️' },
  { m: 'deload', label: 'Делод', icon: '🧘' },
  { m: 'peaking', label: 'Пик', icon: '⚡' },
];

export const PeriodizationHub: React.FC = () => {
  const [mode, setMode] = useState<PeriodizationHubMode>('designer');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔄 Периодизация — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: дизайнер макроцикла + прогрессия мезо + трекер + микроциклы + делод + пик-протокол — в одном месте. Ранее делод/пик дублировались в `TaperPlannerTab` — теперь единый расчёт.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Дизайнер» — блоки макроцикла (недели/фаза/объём). «Прогрессия» — кривая объёма/интенсивности по неделям. «Трекер» — факт vs план. «Микроциклы» — недельный план. «Делод» — снижение объёма 40-60% для восстановления. «Пик» — taper 7-14д + суперкомпенсация. Все графики с пояснениями внутри.
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

      {mode === 'designer' && <PeriodizationDesignerTab />}
      {mode === 'progression' && <MesocycleProgressionCard />}
      {mode === 'tracker' && <MesocycleTrackerTab />}
      {mode === 'micro' && <MicrocyclePlannerCard />}
      {mode === 'deload' && <DeloadSchedulerTab />}
      {mode === 'peaking' && <PeakingProtocolTab />}
    </div>
  );
};

export default PeriodizationHub;
