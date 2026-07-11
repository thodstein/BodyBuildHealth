import React from 'react';
import { TRAINING_SPLITS } from '../../../../engines/training.engine';
import { DIM, ACCENT, GROUP_RU } from './types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  daysPerWeek: number;
}

const GROUP_COLORS: Record<string, string> = {
  chest: '#ef4444', back: '#3b82f6', legs: '#22c55e', shoulders: '#f59e0b',
  arms: '#a855f7', core: '#ec4899', full: '#06b6d4',
};

export const SplitSelectorCards: React.FC<Props> = ({ value, onChange, daysPerWeek }) => {
  const entries = Object.entries(TRAINING_SPLITS).filter(([, s]: [string, any]) => s.groupsPerDay.length <= daysPerWeek + 1);
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {entries.map(([id, s]: [string, any]) => {
        const isSelected = value === id;
        const fits = s.groupsPerDay.length <= daysPerWeek;
        return (
          <button key={id} onClick={() => fits && onChange(id)}
            style={{
              textAlign: 'left', padding: 10, borderRadius: 10, cursor: fits ? 'pointer' : 'default',
              border: isSelected ? `1.5px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
              background: isSelected ? 'rgba(0,230,138,0.08)' : 'rgba(24,24,27,0.4)',
              opacity: fits ? 1 : 0.35, transition: 'all 0.2s',
              ...((fits && !isSelected) ? { ':hover': { borderColor: 'rgba(0,230,138,0.3)' } } : {}),
            } as React.CSSProperties}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? ACCENT : '#fff', marginBottom: 4 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 6, lineHeight: 1.3 }}>
              {s.desc?.slice(0, 60)}{s.desc?.length > 60 ? '…' : ''}
            </div>
            {s.level && (
              <div style={{ marginBottom: 6, display: 'flex', gap: 3 }}>
                {(s.level as string[]).map((l: string) => (
                  <span key={l} style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 4,
                    background: l === 'beginner' ? 'rgba(34,197,94,0.15)' : l === 'intermediate' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                    color: l === 'beginner' ? '#22c55e' : l === 'intermediate' ? '#f59e0b' : '#ef4444',
                    fontWeight: 600,
                  }}>
                    {l === 'beginner' ? 'Нов' : l === 'intermediate' ? 'Сред' : 'Про'}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(s.groupsPerDay as string[][]).slice(0, Math.min(5, s.groupsPerDay.length)).map((day: string[], di: number) => (
                <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 7, fontWeight: 700, color: DIM, minWidth: 12 }}>Д{di + 1}</span>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {day.map((g: string) => (
                      <span key={g} style={{
                        fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                        background: (GROUP_COLORS[g] || '#666') + '20',
                        color: GROUP_COLORS[g] || '#ccc',
                        border: `0.5px solid ${(GROUP_COLORS[g] || '#666') + '30'}`,
                      }}>{GROUP_RU[g] || g}</span>
                    ))}
                  </div>
                </div>
              ))}
              {s.groupsPerDay.length > 5 && (
                <div style={{ fontSize: 8, color: DIM }}>+{s.groupsPerDay.length - 5} дней</div>
              )}
            </div>
            {!fits && <div style={{ fontSize: 8, color: '#ef4444', marginTop: 4 }}>⚠ Нужно {s.groupsPerDay.length} дн/нед</div>}
          </button>
        );
      })}
    </div>
  );
};
