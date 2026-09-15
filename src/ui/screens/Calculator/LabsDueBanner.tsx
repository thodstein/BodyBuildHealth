// ════════════════════════════════════════════════════════════════════════════
//  LABS DUE BANNER — Sticky-баннер «Сдайте анализы» в калькуляторе поддержки.
//  Группировка по системам органов. Не перекрывает нижние кнопки.
//  ════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { SystemOverdue } from '../../../engines/labs-overdue';

const PIN_KEY = 'he_calc_labs_banner_pinned';

export interface LabsDueBannerProps {
  systems: SystemOverdue[];
  onOpenLabs?: () => void;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const LabsDueBanner: React.FC<LabsDueBannerProps> = ({ systems, onOpenLabs, onDismiss, dismissed }) => {
  const [expanded, setExpanded] = useState(false);
  // 📌 Закрепление: по умолчанию карточка закреплена (sticky под шапкой).
  // Персист — чтобы выбор переживал перезапуск.
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem(PIN_KEY) !== '0'; }
    catch { return true; }
  });

  if (dismissed || systems.length === 0) return null;

  const totalMarkers = systems.reduce((s, x) => s + x.count, 0);

  const togglePin = () => {
    setPinned((v) => {
      const next = !v;
      try { localStorage.setItem(PIN_KEY, next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  return (
    <div
      className="calc-labsdue"
      role="alert"
      data-labsdue={pinned ? 'pinned' : 'unpinned'}
      style={{
        position: pinned ? 'sticky' : 'static',
        top: pinned ? 'calc(env(safe-area-inset-top, 0px) + 56px)' : undefined,
        zIndex: pinned ? 200 : undefined,
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
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>
              · {totalMarkers} {totalMarkers === 1 ? 'маркер' : totalMarkers < 5 ? 'маркера' : 'маркеров'}
            </span>
          </div>
        </div>
        <button
          onClick={togglePin}
          aria-label={pinned ? 'Открепить карточку анализов' : 'Закрепить карточку анализов'}
          aria-pressed={pinned}
          title={pinned ? 'Открепить' : 'Закрепить'}
          data-labsdue="pin"
          style={{
            background: pinned ? 'rgba(245,158,11,0.18)' : 'transparent',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 8,
            color: '#fbbf24',
            fontSize: 14,
            lineHeight: 1,
            padding: 4,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >📌</button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Скрыть до обновления анализов"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
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
        {systems.map((s, idx) => (
          <span
            key={s.system ?? `sys-${idx}`}
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
              color: '#fff',
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
              minHeight: 44,
            }}
          >
            <span style={{ fontSize: 12 }}>🧪</span>
            <span>Открыть Лабораторию</span>
          </button>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Свернуть список маркеров' : 'Развернуть список маркеров'}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
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
          {systems.map((s, idx) => (
            <div key={s.system ?? `sys-${idx}`} style={{ marginBottom: 5 }}>
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
                color: '#fff',
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
