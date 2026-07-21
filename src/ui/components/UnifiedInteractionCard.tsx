import React from 'react';
import type { UnifiedInteraction } from '../../engines/interactions-calculator';
import { SEVERITY_META, TYPE_LABELS, SOURCE_LABELS, SECTION_LABELS } from '../../data/interactions-labels';
import { TimingChip } from './TimingChip';

export interface UnifiedInteractionCardProps {
  /** Unified interaction item from calculateInteractions() */
  item: UnifiedInteraction;
  /** Show source badge (default: true) */
  showSource?: boolean;
  /** Custom title (otherwise auto-generated: a + b) */
  title?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Универсальная карточка взаимодействия с разделением effect / mechanism / recommendation,
 * timing-chip'ами и severity badge. Используется для рендера UnifiedInteraction[].all.
 */
export const UnifiedInteractionCard: React.FC<UnifiedInteractionCardProps> = ({
  item,
  showSource = true,
  title,
  onClick,
}) => {
  const meta = SEVERITY_META[item.severity];
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const sourceLabel = SOURCE_LABELS[item.source] || item.source;
  const heading = title || `${item.a} + ${item.b}`;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 6,
      }}
    >
      {/* Header: severity + type + source */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
          background: `${meta.color}25`, color: meta.color, letterSpacing: 1,
        }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: meta.color }}>{typeLabel}</span>
        {showSource && (
          <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>
            {sourceLabel}
          </span>
        )}
      </div>

      {/* Heading: a + b */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        {heading}
      </div>

      {/* Effect (короткая суть) */}
      {item.effect && (
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{SECTION_LABELS.fieldEffect}: </span>
          {item.effect}
        </div>
      )}

      {/* Mechanism (если есть) */}
      {item.mechanism && item.mechanism !== item.effect && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>⚙️ {SECTION_LABELS.fieldMechanismShort}: </span>
          {item.mechanism}
        </div>
      )}

      {/* Recommendation + timing chips */}
      {item.recommendation && (
        <div style={{ fontSize: 11, color: meta.color, lineHeight: 1.5, padding: '8px 10px', borderRadius: 6, background: `${meta.color}0a`, border: `1px solid ${meta.border}` }}>
          <span style={{ fontWeight: 700 }}>💊 {SECTION_LABELS.fieldRecommendationShort}: </span>
          {item.recommendation}
          {item.timing && <TimingChip timing={item.timing} />}
        </div>
      )}
    </div>
  );
};
