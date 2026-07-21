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

  // Адаптивные размеры: < 360px (мобильный) → чуть крупнее для тач-интерфейса
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
  const baseFontSize = isMobile ? 12 : 11;
  const headerFontSize = isMobile ? 13 : 12;
  const badgeFontSize = isMobile ? 10 : 9;
  const smallFontSize = isMobile ? 11 : 10;
  const padding = isMobile ? '14px 16px' : '12px 14px';

  return (
    <div
      onClick={onClick}
      className="unified-interaction-card"
      style={{
        padding,
        borderRadius: 10,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 6,
        // Минимум 44px тап-зона для мобильных
        minHeight: isMobile ? 44 : undefined,
      }}
    >
      {/* Header: severity + type + source */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: badgeFontSize, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
          background: `${meta.color}25`, color: meta.color, letterSpacing: 1,
        }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: badgeFontSize, fontWeight: 600, color: meta.color }}>{typeLabel}</span>
        {showSource && (
          <span style={{ fontSize: smallFontSize - 1, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>
            {sourceLabel}
          </span>
        )}
      </div>

      {/* Heading: a + b */}
      <div style={{ fontSize: headerFontSize, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        {heading}
      </div>

      {/* Effect (короткая суть) */}
      {item.effect && (
        <div style={{ fontSize: baseFontSize, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{SECTION_LABELS.fieldEffect}: </span>
          {item.effect}
        </div>
      )}

      {/* Mechanism (если есть) */}
      {item.mechanism && item.mechanism !== item.effect && (
        <div style={{ fontSize: smallFontSize, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>⚙️ {SECTION_LABELS.fieldMechanismShort}: </span>
          {item.mechanism}
        </div>
      )}

      {/* Recommendation + timing chips */}
      {item.recommendation && (
        <div style={{ fontSize: baseFontSize, color: meta.color, lineHeight: 1.5, padding: isMobile ? '10px 12px' : '8px 10px', borderRadius: 6, background: `${meta.color}0a`, border: `1px solid ${meta.border}` }}>
          <span style={{ fontWeight: 700 }}>💊 {SECTION_LABELS.fieldRecommendationShort}: </span>
          {item.recommendation}
          {item.timing && <TimingChip timing={item.timing} />}
        </div>
      )}
    </div>
  );
};
