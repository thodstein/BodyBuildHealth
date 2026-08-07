import React from 'react';
import { ReportSparkline } from './ReportSparkline';

export interface MetricCardProps {
  label: string;
  unit?: string;
  prev?: number | string | null | undefined;
  current?: number | string | null | undefined;
  delta?: number | null;
  deltaPct?: number | null;
  trend?: 'up' | 'down' | 'stable' | 'new' | 'no_data';
  status?: 'normal' | 'warning' | 'critical' | 'info';
  sparkline?: number[];
  note?: string;
  refLow?: number | null | undefined;
  refHigh?: number | null | undefined;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  normal:   { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  warning:  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  critical: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  info:     { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.15)' },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label, unit, prev, current, delta, deltaPct, trend, status, sparkline, note, refLow, refHigh, compact = false,
}) => {
  const sc = status ? STATUS_COLORS[status] : STATUS_COLORS.info;

  const formatNum = (v: number | string | null | undefined): string => {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'number') return v % 1 === 0 ? String(v) : v.toFixed(1);
    return String(v);
  };

  const deltaStr = delta !== undefined && delta !== null
    ? `${delta > 0 ? '+' : ''}${formatNum(delta)}${unit ? ` ${unit}` : ''}`
    : null;
  const deltaPctStr = deltaPct !== undefined && deltaPct !== null
    ? `(${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`
    : null;

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'stable' ? '→' : '';

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '6px 8px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{label}</span>
          {unit && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>{unit}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {prev !== undefined && prev !== null && (
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{formatNum(prev)}</span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{formatNum(current)}</span>
          {deltaStr && (
            <span style={{
              color: sc.text, fontWeight: 600, fontSize: 11,
              background: sc.bg, padding: '1px 6px', borderRadius: 4,
            }}>
              {trendIcon} {deltaStr} {deltaPctStr}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 13 }}>{label}</span>
          {unit && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4, fontSize: 11 }}>{unit}</span>}
        </div>
        {status && status !== 'info' && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: 'uppercase',
          }}>
            {status === 'normal' ? 'НОРМА' : status === 'warning' ? 'ВНИМАНИЕ' : 'КРИТИЧНО'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {prev !== undefined && prev !== null && (
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{formatNum(prev)}</span>
        )}
        {prev !== undefined && prev !== null && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>→</span>
        )}
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{formatNum(current)}</span>
        {deltaStr && (
          <span style={{
            color: sc.text, fontWeight: 600, fontSize: 12,
            background: sc.bg, padding: '2px 8px', borderRadius: 4,
          }}>
            {trendIcon} {deltaStr} {deltaPctStr}
          </span>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div style={{ marginTop: 2 }}>
          <ReportSparkline data={sparkline} color={sc.text} height={28} width={120} showDots={false} showArea />
        </div>
      )}

      {note && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{note}</div>
      )}

      {refLow !== undefined && refHigh !== undefined && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
          Референс: {formatNum(refLow)} – {formatNum(refHigh)}
        </div>
      )}
    </div>
  );
};
