import React from 'react';
import type { UserProfile } from '../../../core/types';
import { ExpandableCard, HealthBool, HealthNumber } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
}

const GENES = [
  { key: 'COMT', label: 'COMT', options: ['Met/Met', 'Val/Met', 'Val/Val'] },
  { key: 'MTHFR', label: 'MTHFR', options: ['C677T/C677T', 'C677T/A1298C', 'A1298C/A1298C', 'C677T/+', 'A1298C/+', '+/+'] },
  { key: 'ESR1', label: 'ESR1', options: ['PvuII TT', 'PvuII TC', 'PvuII CC'] },
  { key: 'AGTR1', label: 'AGTR1', options: ['1166CC', '1166AC', '1166AA'] },
  { key: 'NOS3', label: 'NOS3', options: ['Glu298Glu', 'Glu298Asp', 'Asp298Asp'] },
  { key: 'SRD5A2', label: 'SRD5A2', options: ['V89L V/V', 'V89L V/L', 'V89L L/L'], desc: '5α-редуктаза' },
  { key: 'CYP3A4', label: 'CYP3A4', options: ['*1/*1 (WT)', '*1/*22', '*22/*22'] },
];

export const ProfileGeneticsSection: React.FC<Props> = ({ settings, save }) => {
  return (
    <div>
      {GENES.map(gene => {
        const currentVal = (settings.genetics ?? {})[gene.key];
        return (
          <ExpandableCard key={gene.key} icon="🧬" title={gene.label} color="#c084fc" open={false}
            summary={currentVal || 'Не знаю' + ((gene as any).desc ? ' · ' + (gene as any).desc : '')}>
            {(gene as any).desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{(gene as any).desc}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <HealthBool label="Не знаю" active={!currentVal}
                onClick={() => { const g = { ...(settings.genetics ?? {}) }; delete g[gene.key]; save({ genetics: g }); }} />
              {gene.options.map(opt => (
                <HealthBool key={opt} label={opt} active={currentVal === opt}
                  onClick={() => { const g = { ...(settings.genetics ?? {}) }; g[gene.key] = opt; save({ genetics: g }); }} />
              ))}
            </div>
          </ExpandableCard>
        );
      })}
    </div>
  );
};
