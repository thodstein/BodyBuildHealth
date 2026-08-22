/** PeriodizationHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: Дизайнер, Прогрессия, Трекер, Микроциклы, Делод, Пик, Taper + Сплиты.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { PeriodizationDesignerTab } from './PeriodizationDesignerTab';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { MesocycleTrackerTab } from './MesocycleTrackerTab';
import { MicrocyclePlannerCard } from './MicrocyclePlannerCard';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import { TaperPlannerTab } from './TaperPlannerTab';
import { SplitGenCard } from './SplitGenCard';
const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type PeriodizationHubMode = 'designer' | 'progression' | 'tracker' | 'micro' | 'deload' | 'taper' | 'splits';

const MODE_DEFS: Array<{ m: PeriodizationHubMode; label: string; icon: string; desc: string }> = [
  { m: 'designer', label: 'Дизайнер', icon: '🏗️', desc: 'Блоки макроцикла (недели/фаза/объём)' },
  { m: 'progression', label: 'Прогрессия', icon: '📈', desc: 'Кривая объёма/интенсивности по неделям' },
  { m: 'tracker', label: 'Трекер', icon: '📊', desc: 'Факт vs план' },
  { m: 'micro', label: 'Микроциклы', icon: '🗓️', desc: 'Недельный план (дни/упражнения)' },
  { m: 'deload', label: 'Делод', icon: '🧘', desc: 'Снижение объёма 40-60% для восстановления' },
  { m: 'taper', label: 'Тейпер/Пик', icon: '🔻', desc: 'PL 3 нед / BB 4 нед + шоу-пик, учёт ПЛ/ББ циклов, возраста, пола' },
  { m: 'splits', label: 'Сплиты', icon: '🧩', desc: '9 сплитов, календарь, сравнение, объём' },
];

export const PeriodizationHub: React.FC<{ initialMode?: PeriodizationHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<PeriodizationHubMode>(initialMode ?? 'designer');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔄 Периодизация и тапер</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: дизайнер макроцикла + прогрессия мезо + трекер + микроциклы + делод + <b style={{ color: '#fff' }}>тейпер/пик</b> (PL 3 нед, BB 4 нед, учёт ПЛ/ББ циклов, возраста, пола, федерации) + <b style={{ color: '#fff' }}>сплиты</b> (9 типов) — в одном месте. Источники: Bompa, Issurin, Mujika — без выдумок.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Дизайнер» — блоки макроцикла (недели/фаза/объём). «Прогрессия» — кривая объёма/интенсивности по неделям. «Трекер» — факт vs план. «Микроциклы» — недельный план. «Делод» — снижение объёма 40-60% для восстановления. «Тейпер/Пик» — taper 7-14д + суперкомпенсация (отдельный калькулятор PL/BB, внутри хаба). «Сплиты» — календарь недели + объём по группам + сравнение A−B. Все графики с пояснениями внутри.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
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
      {mode === 'taper' && <TaperPlannerTab />}
      {mode === 'splits' && <SplitGenCard />}
    </div>
  );
};

/** Алиас для нового id — периодзационный тейпер-хаб (аналог VolumeHub) */
export const PeriodizationTaperHub = PeriodizationHub;

export default PeriodizationHub;
