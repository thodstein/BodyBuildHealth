import React from 'react';
import { colors } from '../../ui';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { FIELD_COLORS, FIELD_LABELS } from './WeightChart';

interface CompletenessIndicatorProps {
  entry: WeightEntry;
}

const FIELDS = ['weight', 'bodyFat', 'waistCm', 'chestCm', 'hipCm', 'bicepCm', 'bicepLeftCm', 'bicepRightCm', 'thighCm', 'thighLeftCm', 'thighRightCm', 'calfCm', 'calfLeftCm', 'calfRightCm', 'neckCm', 'forearmCm', 'muscleMass', 'waterMass'] as const;

export const CompletenessIndicator: React.FC<CompletenessIndicatorProps> = ({ entry }) => {
  const filled = FIELDS.filter(f => typeof entry[f as keyof WeightEntry] === 'number').length;
  const pct = Math.round((filled / FIELDS.length) * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <small style={{ color, fontSize: 11, minWidth: 32, textAlign: 'right' }}>{pct}%</small>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
        {FIELDS.map(f => {
          const has = typeof entry[f as keyof WeightEntry] === 'number';
          return (
            <span
              key={f}
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: has ? (FIELD_COLORS[f] || '#888') + '33' : '#27272a',
                color: has ? (FIELD_COLORS[f] || '#888') : '#6b7280',
                border: `1px solid ${has ? (FIELD_COLORS[f] || '#888') + '66' : '#3f3f46'}`,
              }}
            >
              {FIELD_LABELS[f] || f}
            </span>
          );
        })}
      </div>
    </div>
  );
};
