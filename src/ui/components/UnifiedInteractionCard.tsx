import React from 'react';
import type { UnifiedInteraction, UnifiedSeverity } from '../../engines/interactions-calculator';
import { TimingChip } from './TimingChip';

const SEVERITY_META: Record<UnifiedSeverity, { label: string; color: string; bg: string; border: string; icon: string }> = {
  CRITICAL: { label: 'КРИТИЧНО', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.30)', icon: '🛑' },
  HIGH:     { label: 'ПРЕДУПРЕЖДЕНИЕ', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)', icon: '⚠️' },
  MEDIUM:   { label: 'ВНИМАНИЕ', color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.25)', icon: '⚡' },
  LOW:      { label: 'СИНЕРГИЯ', color: '#00e68a', bg: 'rgba(0,230,138,0.06)', border: 'rgba(0,230,138,0.25)', icon: '✨' },
  INFO:     { label: 'ИНФО', color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.20)', icon: 'ℹ️' },
};

const TYPE_LABELS: Record<UnifiedInteraction['type'], string> = {
  synergy: '⊕ Синергия',
  conflict: '⚡ Конфликт',
  caution: '⚠ Осторожно',
  danger: '🛑 Опасно',
  block: '🛑 Блок',
  warn: '⚠ Предупреждение',
  monitor: '👁 Мониторинг',
  info: 'ℹ Инфо',
};

const SOURCE_LABELS: Record<UnifiedInteraction['source'], string> = {
  support_db: 'БАД-каталог',
  drug_interactions: 'Drug-каталог',
  pharma_rules: 'AAS/PED правила',
};

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
          <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>Суть: </span>
          {item.effect}
        </div>
      )}

      {/* Mechanism (если есть) */}
      {item.mechanism && item.mechanism !== item.effect && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>⚙️ Механизм: </span>
          {item.mechanism}
        </div>
      )}

      {/* Recommendation + timing chips */}
      {item.recommendation && (
        <div style={{ fontSize: 11, color: meta.color, lineHeight: 1.5, padding: '8px 10px', borderRadius: 6, background: `${meta.color}0a`, border: `1px solid ${meta.border}` }}>
          <span style={{ fontWeight: 700 }}>💊 Действие: </span>
          {item.recommendation}
          {item.timing && <TimingChip timing={item.timing} />}
        </div>
      )}
    </div>
  );
};
