// ════════════════════════════════════════════════════════════════════════════
//  LABS DUE BANNER — Sticky-баннер «Сдайте анализы» в калькуляторе поддержки.
//  Группировка по системам органов. Не перекрывает нижние кнопки.
//  ════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { SystemOverdue } from '../../../engines/labs-overdue';

export interface LabsDueBannerProps {
  systems: SystemOverdue[];
  onOpenLabs?: () => void;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const LabsDueBanner: React.FC<LabsDueBannerProps> = ({ systems, onOpenLabs, onDismiss, dismissed }) => {
  const [expanded, setExpanded] = useState(false);

  if (dismissed || systems.length === 0) return null;

  const totalMarkers = systems.reduce((s, x) => s + x.count, 0);

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        marginBottom: 8,
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(239,68,68,0.06))',
        border: '1px solid rgba(245,158,11,0.35)',
        padding: '8px 10px',
        boxShadow: '0 4px 16px rgba(245,158,11,0.10)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>⏰</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>
              Сдайте анализы
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              · {totalMarkers} {totalMarkers === 1 ? 'маркер' : totalMarkers < 5 ? 'маркера' : 'маркеров'}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Скрыть до обновления анализов"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              cursor: 'pointer',
              minWidth: 28,
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 6,
        }}
      >
        {systems.map(s => (
          <span
            key={s.system}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '3px 7px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${s.color}55`,
              fontSize: 10,
              fontWeight: 600,
              color: s.color,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 11 }}>{s.icon}</span>
            <span>{s.name}</span>
            <span style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '0 5px',
              minWidth: 16,
              textAlign: 'center',
            }}>{s.count}</span>
          </span>
        ))}
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 7,
        flexWrap: 'wrap',
      }}>
        {onOpenLabs && (
          <button
            onClick={onOpenLabs}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(245,158,11,0.18)',
              border: '1px solid rgba(245,158,11,0.5)',
              color: '#fbbf24',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 32,
            }}
          >
            <span style={{ fontSize: 12 }}>🧪</span>
            <span>Открыть Лабораторию</span>
          </button>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            fontWeight: 600,
              cursor: 'pointer',
              minHeight: 32,
            }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 7,
          paddingTop: 7,
          borderTop: '1px solid rgba(245,158,11,0.2)',
        }}>
          {systems.map(s => (
            <div key={s.system} style={{ marginBottom: 5 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
              }}>
                <span style={{ fontSize: 10 }}>{s.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>
                  {s.name}:
                </span>
              </div>
              <div style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.5,
                paddingLeft: 18,
              }}>
                {s.markers.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LabsDueBanner;
