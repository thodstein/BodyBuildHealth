import React, { useState } from 'react';
import { UnifiedSynergyCalculator } from './UnifiedSynergyCalculator';
import { SupportTimingPlanner } from './SupportTimingPlanner';

type CalcTab = 'synergy' | 'timing';

export const SupportCalculatorsView: React.FC<{ s?: Record<string, any> }> = ({ s }) => {
  const [calcTab, setCalcTab] = useState<CalcTab>('synergy');

  const pills: { id: CalcTab; label: string }[] = [
    { id: 'synergy', label: '🧬 Синергия и взаимодействия' },
    { id: 'timing', label: '⏰ Тайминг-планировщик' },
  ];

  return (
    <div style={{ padding: '4px 0 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {pills.map(p => (
          <button key={p.id} onClick={() => setCalcTab(p.id)}
            style={{ padding: '6px 14px', borderRadius: 22, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
              background: calcTab === p.id ? 'var(--accent)' : 'var(--bg-secondary)',
              color: calcTab === p.id ? '#000' : 'var(--text-dim)',
              border: '1px solid ' + (calcTab === p.id ? 'var(--accent)' : 'var(--border)'),
            }}>{p.label}</button>
        ))}
      </div>

      {calcTab === 'synergy' && <UnifiedSynergyCalculator s={s} />}
      {calcTab === 'timing' && <SupportTimingPlanner />}
    </div>
  );
};

export default SupportCalculatorsView;