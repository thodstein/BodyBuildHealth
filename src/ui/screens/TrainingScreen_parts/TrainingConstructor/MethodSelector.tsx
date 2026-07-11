import React, { useState } from 'react';
import { PopupSelect } from '../../SRCBBScreen_parts/TrainingPopups';
import { getMethodsByCategory, type TrainingMethod } from '../../../../engines/training-methodology.engine';
import { DIM, ACCENT } from './types';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  category: string;
}

const EVIDENCE_COLORS: Record<string, string> = { A: '#22c55e', B: '#f59e0b', C: '#ef4444' };

export const MethodSelector: React.FC<Props> = ({ label, value, onChange, category }) => {
  const [selectedDesc, setSelectedDesc] = useState<string | null>(null);
  const methods = getMethodsByCategory(category);
  const selected = methods.find((m: TrainingMethod) => m.name === value);

  return (
    <div>
      <PopupSelect label={label} value={value}
        onChange={(v: string) => {
          onChange(v);
          const m = methods.find((mm: TrainingMethod) => mm.name === v);
          setSelectedDesc(m ? (m.description || m.bestFor || '') : null);
        }}
        options={methods.map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      {selected && (
        <div style={{
          marginTop: 4, padding: '6px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          fontSize: 9, lineHeight: 1.5,
        }}>
          {selected.description && <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>{selected.description}</div>}
          {selected.bestFor && <div style={{ color: DIM }}>🎯 {selected.bestFor}</div>}
          {selected.evidenceLevel && (
            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                background: (EVIDENCE_COLORS[selected.evidenceLevel] || '#666') + '20',
                color: EVIDENCE_COLORS[selected.evidenceLevel] || '#ccc',
              }}>Ур.{selected.evidenceLevel}</span>
              {selected.popularizedBy && <span style={{ color: DIM, fontSize: 8 }}>Поп.: {selected.popularizedBy}</span>}
            </div>
          )}
          {selected.howItWorks && (
            <details style={{ marginTop: 2 }}>
              <summary style={{ fontSize: 8, color: ACCENT, cursor: 'pointer' }}>Как работает</summary>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.5 }}>{selected.howItWorks}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
