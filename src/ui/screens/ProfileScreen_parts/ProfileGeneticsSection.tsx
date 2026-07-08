import React, { useState } from 'react';
import type { UserProfile } from '../../../core/types';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
}

const GENES = [
  { key: 'COMT', label: 'COMT', icon: '🧬', color: '#c084fc', options: ['Met/Met', 'Val/Met', 'Val/Val'] },
  { key: 'MTHFR', label: 'MTHFR', icon: '🧬', color: '#f97316', options: ['C677T/C677T', 'C677T/A1298C', 'A1298C/A1298C', 'C677T/+', 'A1298C/+', '+/+'] },
  { key: 'ESR1', label: 'ESR1', icon: '🧬', color: '#34d399', options: ['PvuII TT', 'PvuII TC', 'PvuII CC'] },
  { key: 'AGTR1', label: 'AGTR1', icon: '🧬', color: '#f87171', options: ['1166CC', '1166AC', '1166AA'] },
  { key: 'NOS3', label: 'NOS3', icon: '🧬', color: '#38bdf8', options: ['Glu298Glu', 'Glu298Asp', 'Asp298Asp'] },
  { key: 'SRD5A2', label: 'SRD5A2', icon: '🧬', color: '#e879f9', options: ['V89L V/V', 'V89L V/L', 'V89L L/L'], desc: '5α-редуктаза' },
  { key: 'CYP3A4', label: 'CYP3A4', icon: '🧬', color: '#fbbf24', options: ['*1/*1 (WT)', '*1/*22', '*22/*22'] },
];

const cardBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
  borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
  background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)', transition: 'all 0.15s',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.85)',
};
const sheet: React.CSSProperties = {
  width: '85%', maxWidth: 320, borderRadius: 16, background: '#18181b',
  border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
};

const GeneCard: React.FC<{ gene: typeof GENES[0]; value: string | undefined; onChange: (v: string | undefined) => void }> = ({ gene, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} style={cardBtn}>
      <span style={{ fontSize: 14 }}>{gene.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: gene.color }}>{gene.label}</div>
        <div style={{ fontSize: 9, color: value ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || 'Не знаю'}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>▾</span>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${gene.color},${gene.color}88)` }} />
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: gene.color, marginBottom: 2 }}>{gene.label}</div>
          {gene.desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{gene.desc}</div>}
          <div style={{ marginTop: 8 }}>
            <button key="unknown" onClick={() => { onChange(undefined); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 4, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: value === undefined ? 700 : 400, background: value === undefined ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: value === undefined ? `1px solid ${gene.color}` : '1px solid rgba(255,255,255,0.06)', color: value === undefined ? gene.color : 'rgba(255,255,255,0.85)' }}>
              🤷 Не знаю {value === undefined ? ' ✓' : ''}
            </button>
            {gene.options.map(opt => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 4, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: value === opt ? 700 : 400, background: value === opt ? `${gene.color}18` : 'rgba(255,255,255,0.03)', border: value === opt ? `1px solid ${gene.color}44` : '1px solid rgba(255,255,255,0.06)', color: value === opt ? gene.color : 'rgba(255,255,255,0.85)' }}>
                {opt}{value === opt ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>}
  </>;
};

export const ProfileGeneticsSection: React.FC<Props> = ({ settings, save }) => {
  const genetics = settings.genetics ?? {};
  return (
    <div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 6, lineHeight: 1.4 }}>
        Выберите генотип для каждого гена. Данные используются в расчётах рисков и поддержки.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {GENES.map(gene => {
          const currentVal = genetics[gene.key];
          return (
            <GeneCard key={gene.key} gene={gene} value={currentVal}
              onChange={(v) => {
                const g = { ...genetics };
                if (v === undefined) delete g[gene.key];
                else g[gene.key] = v;
                save({ genetics: g });
              }} />
          );
        })}
      </div>
    </div>
  );
};
