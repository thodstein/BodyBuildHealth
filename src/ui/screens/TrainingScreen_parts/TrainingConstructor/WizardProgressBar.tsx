import React from 'react';
import { ACCENT, DIM } from './types';

const STEPS = [
  { id: 1, icon: '👤', label: 'Профиль' },
  { id: 2, icon: '🏗️', label: 'Сплит' },
  { id: 3, icon: '📈', label: 'Методы' },
  { id: 4, icon: '🔧', label: 'Настройка' },
  { id: 5, icon: '📊', label: 'Анализ' },
  { id: 6, icon: '✅', label: 'Программа' },
];

interface Props {
  currentStep: number;
  onStepClick: (step: number) => void;
  hasResult: boolean;
}

export const WizardProgressBar: React.FC<Props> = ({ currentStep, onStepClick, hasResult }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 0,
    padding: '6px 4px', borderRadius: 12,
    background: 'rgba(24,24,27,0.3)',
    border: '1px solid rgba(255,255,255,0.03)',
    marginBottom: 8,
    overflow: 'hidden',
  }}>
    {STEPS.map((s, i) => {
      const isDone = s.id < currentStep;
      const isCurrent = s.id === currentStep;
      const clickable = isDone || (s.id === 6 && hasResult) || s.id <= currentStep;
      return (
        <React.Fragment key={s.id}>
          <div onClick={() => { if (clickable) onStepClick(s.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '5px 6px', borderRadius: 8,
              cursor: clickable ? 'pointer' : 'default',
              background: isCurrent ? 'rgba(0,230,138,0.12)' : 'transparent',
              opacity: isCurrent || isDone ? 1 : 0.35,
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              position: 'relative' as const,
              flexShrink: 0,
            }}>
            <span style={{
              fontSize: 11, lineHeight: 1,
              filter: isDone ? 'none' : 'none',
              transition: 'transform 0.3s',
            }}>{s.icon}</span>
            <span style={{
              fontSize: 8, fontWeight: isCurrent ? 800 : 600,
              color: isCurrent || isDone ? '#fff' : 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap',
              transition: 'color 0.25s',
              letterSpacing: '-0.01em',
            }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '0 1px',
              borderRadius: 1,
              background: isDone ? ACCENT : 'rgba(255,255,255,0.06)',
              transition: 'background 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);
