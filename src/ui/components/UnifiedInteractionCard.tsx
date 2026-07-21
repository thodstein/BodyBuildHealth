import React from 'react';
import type { UnifiedInteraction } from '../../engines/interactions-calculator';
import { SEVERITY_META, TYPE_LABELS, SOURCE_LABELS, SECTION_LABELS } from '../../data/interactions-labels';
import { TimingChip } from './TimingChip';
import styles from './UnifiedInteractionCard.module.css';

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
      className={styles.card}
      style={{
        background: meta.bg,
        borderColor: meta.border,
      }}
    >
      {/* Header: severity + type + source */}
      <div className={styles.header}>
        <span className={`${styles.badge} ${styles[`badge_${item.severity.toLowerCase()}`]}`}>
          {meta.icon} {meta.label}
        </span>
        <span className={styles.typeLabel}>{typeLabel}</span>
        {showSource && (
          <span className={styles.sourceLabel}>
            {SOURCE_LABELS[item.source] || item.source}
          </span>
        )}
      </div>

      {/* Heading: a + b */}
      <div className={styles.title}>
        {heading}
      </div>

      {/* Effect (короткая суть) */}
      {item.effect && (
        <div className={styles.effect}>
          <span className={styles.effectLabel}>{SECTION_LABELS.fieldEffect}: </span>
          {item.effect}
        </div>
      )}

      {/* Mechanism (если есть) */}
      {item.mechanism && item.mechanism !== item.effect && (
        <div className={styles.mechanism}>
          <span className={styles.mechanismLabel}>⚙️ {SECTION_LABELS.fieldMechanismShort}: </span>
          {item.mechanism}
        </div>
      )}

      {/* Recommendation + timing chips */}
      {item.recommendation && (
        <div className={styles.recommendation}
          style={{
            color: meta.color,
            borderColor: meta.border,
            background: `${meta.color}0a`,
          }}
        >
          <span className={styles.recommendationLabel}>💊 {SECTION_LABELS.fieldRecommendationShort}: </span>
          {item.recommendation}
          {item.timing && <TimingChip timing={item.timing} />}
        </div>
      )}
    </div>
  );
};
