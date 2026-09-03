import React from 'react';

// ═══════════════════════════════════════════════════════════════
// LabsUI — единая дизайн-система блока «Анализы»
// Glass + accent (#00e68a) + системные цвета · без потери информации
// ═══════════════════════════════════════════════════════════════

export const LABS_ACCENT = '#00e68a';
export const LABS_ACCENT_DIM = 'rgba(0,230,138,0.12)';
export const LABS_ACCENT_BORDER = 'rgba(0,230,138,0.22)';
export const LABS_ACCENT_SOFT = 'rgba(0,230,138,0.06)';

export const LABS_SYS_COLOR: Record<string, string> = {
  hepatic: '#22c55e', renal: '#3b82f6', endocrine: '#a855f7',
  hematologic: '#ef4444', cardio: '#f97316', metabolic: '#eab308',
  reproductive: '#ec4899', neuro: '#14b8a6', other: '#6b7280',
  blood: '#ef4444', vessels: '#fb923c', ghigf: '#8b5cf6', ins_axis: '#f59e0b',
  thyroid: '#06b6d4', prostate: '#ec4899', skin: '#f97316', immunity: '#22c55e',
  musculoskeletal: '#84cc16', neuro_toxicity: '#14b8a6',
};

export const LABS_SYS_LABEL: Record<string, string> = {
  cardio: 'Сердце и сосуды', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кровь',
  reproductive: 'Репродуктивная', musculoskeletal: 'Опорно-двиг.', metabolic: 'Метаболизм',
  ghigf: 'GH/IGF-1', ins_axis: 'Инсулин', neuro_toxicity: 'Нейротокс.', blood: 'Кровь',
  vessels: 'Сосуды', immunity: 'Иммунитет', thyroid: 'Щитовидная', prostate: 'Простата', skin: 'Кожа',
  other: 'Прочее',
};

export const LABS_SYS_ICON: Record<string, string> = {
  hepatic: '🫁', renal: '🫘', endocrine: '🧬', hematologic: '🩸',
  cardio: '❤️', metabolic: '⚡', reproductive: '🧫', neuro: '🧠', other: '📋',
  blood: '🩸', vessels: '🫀', ghigf: '🧪', ins_axis: '🍬', thyroid: '🦋',
  prostate: '🔬', skin: '✨', immunity: '🛡️', musculoskeletal: '🦴', neuro_toxicity: '🧠',
};

// ── Карточки ──
export const LABS_CARD: React.CSSProperties = {
  background: 'rgba(20,22,30,0.45)',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.06))',
  borderRadius: 16,
  padding: 14,
  backdropFilter: 'blur(8px)',
};

export const LABS_CARD_FLAT: React.CSSProperties = {
  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
  border: '1px solid var(--border, rgba(255,255,255,0.06))',
  borderRadius: 14,
  padding: 12,
};

export const LABS_GLASS_HERO: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(0,230,138,0.14) 0%, rgba(59,130,246,0.10) 50%, rgba(168,85,247,0.08) 100%)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
};

// ── Пилюли / табы ──
export const pillStyle = (active: boolean, color = LABS_ACCENT): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'all 0.2s',
  flexShrink: 0,
  background: active ? color : 'var(--bg-secondary)',
  color: active ? '#000' : 'var(--text-dim)',
  border: `1px solid ${active ? color : 'var(--border)'}`,
  letterSpacing: active ? 0.2 : 0,
});

export const sysPillStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  flexShrink: 0,
  background: active ? color + '18' : 'var(--bg-secondary)',
  color: active ? color : 'var(--text-dim)',
  border: `1px solid ${active ? color + '40' : 'var(--border)'}`,
  transition: 'all 0.15s',
});

// ── Мини-компоненты ──

export const LabsSectionHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; accent?: string }> = ({ icon, title, subtitle, right, accent = LABS_ACCENT }) => (
  <div className="labs-sec-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
    <div style={{
      width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: accent + '18', border: `1px solid ${accent}30`, fontSize: 15, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const LabsKpiCard: React.FC<{ icon: string; label: string; value: string | number; sub?: string; color: string; accent?: string }> = ({ icon, label, value, sub, color }) => (
  <div className="labs-kpi" style={{
    background: color + '0F',
    border: `1px solid ${color}22`,
    borderRadius: 14,
    padding: '10px 10px 9px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, borderRadius: '50%', background: color + '12' }} />
    <div style={{ fontSize: 13, marginBottom: 2 }}>{icon}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 9, fontWeight: 700, color, marginTop: 2, letterSpacing: 0.3 }}>{label}</div>
    {sub && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export const LabsProgressBar: React.FC<{ value: number; color?: string; height?: number; showPct?: boolean }> = ({ value, color = LABS_ACCENT, height = 6, showPct }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
    <div style={{ flex: 1, height, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
    </div>
    {showPct && <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>{Math.round(value)}%</span>}
  </div>
);

export const LabsRing: React.FC<{ value: number; size?: number; stroke?: number; color?: string; bg?: string; children?: React.ReactNode }> = ({ value, size = 52, stroke = 5, color = LABS_ACCENT, bg = 'rgba(255,255,255,0.07)', children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
};

export const LabsBadge: React.FC<{ color: string; bg?: string; children: React.ReactNode; small?: boolean }> = ({ color, bg, children, small }) => (
  <span style={{
    fontSize: small ? 8 : 9, fontWeight: 700, padding: small ? '1px 5px' : '2px 7px', borderRadius: 999,
    background: bg || color + '18', color, border: `1px solid ${color}30`, whiteSpace: 'nowrap',
  }}>{children}</span>
);

export const LabsEmpty: React.FC<{ icon: string; title: string; desc: string; action?: React.ReactNode }> = ({ icon, title, desc, action }) => (
  <div className="labs-empty" style={{ ...LABS_CARD_FLAT, textAlign: 'center', padding: 22 }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: action ? 10 : 0 }}>{desc}</div>
    {action}
  </div>
);

export function labsStatusColor(v: number, invert?: boolean): string {
  if (!invert) { if (v <= 25) return '#22c55e'; if (v <= 50) return '#eab308'; if (v <= 75) return '#f97316'; return '#ef4444'; }
  if (v >= 70) return '#22c55e'; if (v >= 40) return '#eab308'; return '#ef4444';
}
export function labsRiskLevel(v: number): 'low' | 'medium' | 'high' | 'critical' {
  if (v <= 25) return 'low'; if (v <= 50) return 'medium'; if (v <= 75) return 'high'; return 'critical';
}
export const labsRiskBg: Record<string, string> = {
  low: 'rgba(34,197,94,0.10)', medium: 'rgba(234,179,8,0.10)', high: 'rgba(249,115,22,0.10)', critical: 'rgba(239,68,68,0.10)',
};
export const labsRiskColor: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
};
