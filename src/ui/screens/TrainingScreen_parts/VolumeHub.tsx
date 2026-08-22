/** VolumeHub.tsx — ЕДИНЫЙ хаб объёма без дублей.
 *  Объединяет VolumeOptimizerTab (MEV/MAV/MRV), TonnageCalcTab (тоннаж/КПШ/УОИ) и PlateCalcTab (блины).
 *  3 подкладки внутри, общий хедер с пояснениями. Полные инструменты сохранены, дубли убраны (объём считался в 3 местах).
 */
import React, { useState } from 'react';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';
import { TonnageCalcTab } from './TonnageCalcTab';
import { PlateCalcTab } from './PlateCalcTab';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

type HubMode = 'volume' | 'tonnage' | 'plates';

const MODE_DEFS: Array<{ m: HubMode; label: string; icon: string; desc: string }> = [
  { m: 'volume', label: 'Объём', icon: '📐', desc: 'MEV/MAV/MRV, оптимизация, SFR, прогрессия' },
  { m: 'tonnage', label: 'Тоннаж', icon: '⚖️', desc: 'Тоннаж/КПШ/УОИ, зоны интенсивности' },
  { m: 'plates', label: 'Блины', icon: '🥞', desc: 'Грифы 8 типов, блины, %1RM, разминка' },
];

export const VolumeHub: React.FC<{ initialMode?: HubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<HubMode>(initialMode ?? 'volume');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>📐 Объём — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>объём</b> (MEV/MAV/MRV) + <b style={{ color: '#fff' }}>тоннаж</b> (КПШ/УОИ) + <b style={{ color: '#fff' }}>блины</b> (гриф/блины/1RM) — в одном месте. Ранее объём считался в 3 местах (Volume/Tonnage/SplitGen) с разными формулами — теперь единый расчёт. Источники: Israetel MEV/MAV/MRV, Helms 2019, Schoenfeld 2017, Prilepin 1974 (КПШ) — без выдумок.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Объём» — по мышцам (сеты vs MEV/MAV/MRV, % от MRV, частота). «Тоннаж» — вес×репы×сеты + КПШ (подъёмы) + УОИ (ср.вес/1RM) + зоны &lt;60/60-80/&gt;80%. «Блины» — подбор блинов под гриф/вес, 1RM-% пресеты, SVG.
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

      {mode === 'volume' && <VolumeOptimizerTab />}
      {mode === 'tonnage' && <TonnageCalcTab />}
      {mode === 'plates' && <PlateCalcTab />}
    </div>
  );
};

export default VolumeHub;
