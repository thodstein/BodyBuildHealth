/** BbToolsHub.tsx — унифицированный калькулятор.
 * Объединяет: Темп/техники, Целевая мышца.
 * Специализация перенесена в Библиотеку → Методики (категория Специализация). */
import React, { useState } from 'react';
import { BbToolsCard } from './BbToolsCard';
import TechniqueTab from './ExerciseLabTechnique';

const ACCENT = '#00e68a';
const DIM = '#fff';
type BbToolsHubMode = 'tools' | 'target';

const MODE_DEFS: Array<{ m: BbToolsHubMode; label: string; icon: string }> = [
  { m: 'tools', label: 'Темп/техники', icon: '⏱️' },
  { m: 'target', label: 'Целевая мышца', icon: '🎯' },
];

export const BbToolsHub: React.FC = () => {
  const [mode, setMode] = useState<BbToolsHubMode>('tools');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>💪 ББ-инструменты</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>Темп/отдых/техники интенсификации, целевая мышца и демография для бодибилдинга.</div>

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

      {mode === 'tools' && <BbToolsCard />}
      {mode === 'target' && <TechniqueTab />}
    </div>
  );
};

export default BbToolsHub;
