/** ToolsHub.tsx — единый хаб инструментов сборки.
 * Объединяет: PriRepPatternCard (PRI/паттерн) + PlateCalcTab (блины) + BBFoundationCard (5 пилларов).
 * Структура как в MixHub / RirForecastHub / VolumeHub — единый расчёт, без дублей. */
import React, { useState } from 'react';
import { PriRepPatternCard } from './PriRepPatternCard';
import { PlateCalcTab } from './PlateCalcTab';
import { BBFoundationCard } from './BBFoundationCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type ToolsHubMode = 'pri' | 'plates' | 'foundation';

const MODE_DEFS: Array<{ m: ToolsHubMode; label: string; icon: string; desc: string }> = [
  { m: 'pri', label: 'PRI/паттерн', icon: '🧠', desc: 'PRI готовность → объём/RIR + схема повторов' },
  { m: 'plates', label: 'Блины', icon: '🥞', desc: 'Грифы 8 типов, блины, %1RM, разминка' },
  { m: 'foundation', label: 'Основа ББ', icon: '🏛', desc: '5 пилларов, MEV/MAV/MRV, RIR/темп' },
];

export const ToolsHub: React.FC<{ initialMode?: ToolsHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<ToolsHubMode>(initialMode ?? 'pri');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🛠 Инструменты сборки — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>PRI/паттерн</b> (готовность → объём/RIR) + <b style={{ color: '#fff' }}>блины</b> (гриф/блины/1RM) + <b style={{ color: '#fff' }}>основа ББ</b> (5 пилларов, MEV/MAV/MRV) — в одном месте. Ранее разнесены в `pri_reppat`/`calc_plates`/`bb_foundation` с дублем логики — теперь единый хаб.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «PRI» — ввод восстановления/усталости/DOMS/сна/стресса → PRI и порог + авто-рекомендации. «Блины» — подбор блинов под гриф/вес, 1RM-% пресеты, SVG. «Основа» — пиллары гипертрофии, объёмные ориентиры по уровню, RIR/темп/отдых.
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

      {mode === 'pri' && <PriRepPatternCard />}
      {mode === 'plates' && <PlateCalcTab />}
      {mode === 'foundation' && <BBFoundationCard />}
    </div>
  );
};

export default ToolsHub;
