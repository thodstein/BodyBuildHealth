import React from 'react';

/* ── Design tokens ── */
export const theme = {
  glassBg: 'rgba(24,24,27,0.12)',
  glassBorder: '1px solid rgba(255,255,255,0.04)',
  cardRadius: 14,
  accent: '#00e68a',
  accentDim: 'rgba(0,230,138,0.15)',
  accentBorder: '1px solid rgba(0,230,138,0.3)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: '1px solid rgba(255,255,255,0.08)',
  inputFocus: '1px solid rgba(0,230,138,0.4)',
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.9)',
  textDim: 'rgba(255,255,255,0.85)',
  pillBg: 'rgba(255,255,255,0.06)',
  pillActiveBg: 'rgba(0,230,138,0.12)',
  gradientGreen: 'linear-gradient(135deg, #00e68a, #00b864)',
  gradientBlue: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  gradientOrange: 'linear-gradient(135deg, #f59e0b, #f97316)',
  gradientRed: 'linear-gradient(135deg, #ef4444, #dc2626)',
  gradientPurple: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
} as const;

/* ── Styles ── */
export const glassCardStyle: React.CSSProperties = {
  background: theme.glassBg,
  borderRadius: theme.cardRadius,
  border: theme.glassBorder,
  padding: 16,
  marginBottom: 10,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: theme.inputBorder,
  background: theme.inputBg,
  color: theme.textPrimary,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

export const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: theme.accent,
  height: 6,
  borderRadius: 3,
  outline: 'none',
};

export const pillBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: active ? theme.accentBorder : theme.glassBorder,
  background: active ? theme.accentDim : theme.glassBg,
  color: active ? theme.accent : theme.textSecondary,
  transition: 'all 0.15s',
});

export const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.textDim,
  marginBottom: 4,
};

/* ── ProfileCard: expandable card ── */
interface ProfileCardProps {
  icon: string;
  title: string;
  color?: string;
  summary?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}
export const ProfileCard: React.FC<ProfileCardProps> = ({ icon, title, color = theme.accent, summary, children, defaultOpen }) => {
  const [open, setOpen] = React.useState(defaultOpen ?? false);
  return (
    <div
      style={{ ...glassCardStyle, cursor: 'pointer', borderColor: open ? color : undefined }}
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{title}</div>
          {summary && (
            <div style={{ fontSize: 9, color: theme.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {summary}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 12, color: 'rgba(255,255,255,0.3)',
          transition: 'transform .2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

/* ── MiniStatCard ── */
interface MiniStatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
}
export const MiniStatCard: React.FC<MiniStatCardProps> = ({ label, value, color, subtitle }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: '8px 4px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: color || theme.textPrimary }}>{value}</div>
    {subtitle && <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 1 }}>{subtitle}</div>}
  </div>
);

/* ── HealthBool ── */
interface HealthBoolProps {
  label: string;
  active: boolean;
  onClick: () => void;
}
export const HealthBool: React.FC<HealthBoolProps> = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '5px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    background: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
    color: active ? '#fca5a5' : 'rgba(255,255,255,0.5)',
  }}>
    {active ? '✓ ' : ''}{label}
  </button>
);

/* ── HealthNumber ── */
interface HealthNumberProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  suffix?: string;
}
export const HealthNumber: React.FC<HealthNumberProps> = ({ label, value, onChange, placeholder, min, max, suffix }) => (
  <div>
    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        style={{
          flex: 1, padding: '6px 8px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box',
        }}
        type="number" min={min} max={max}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {suffix && <span style={{ fontSize: 9, color: theme.textDim, width: 20 }}>{suffix}</span>}
    </div>
  </div>
);

/* ── HealthSlider ── */
interface HealthSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
}
export const HealthSlider: React.FC<HealthSliderProps> = ({ label, value, min = 1, max = 10, step = 1, onChange, color }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: color || (value <= 3 ? '#00e68a' : value <= 6 ? '#f59e0b' : '#ef4444') }}>
        {value}/{max}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: '100%', accentColor: theme.accent }}
    />
  </div>
);

/* ── PillGroup ── */
interface PillGroupProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
}
export const PillGroup: React.FC<PillGroupProps> = ({ options, value, onChange, columns }) => (
  <div style={{ display: 'grid', gridTemplateColumns: columns ? `repeat(${columns},1fr)` : undefined, gap: 3 }}>
    {options.map(opt => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        style={{
          padding: '5px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontSize: 9, fontWeight: 600,
          background: value === opt.id ? '#3b82f6' : 'rgba(255,255,255,0.06)',
          color: value === opt.id ? '#fff' : 'rgba(255,255,255,0.5)',
        }}
      >{opt.label}</button>
    ))}
  </div>
);

/* ── ExpandableCard ── */
interface ExpandableCardProps {
  icon: string;
  title: string;
  color?: string;
  summary?: string;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}
export const ExpandableCard: React.FC<ExpandableCardProps> = ({ icon, title, color = theme.accent, summary, open: controlledOpen, onToggle, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleToggle = onToggle || (() => setInternalOpen(p => !p));
  return (
    <div style={{ ...glassCardStyle, cursor: 'pointer', borderColor: isOpen ? color : undefined }} onClick={handleToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{title}</div>
          {summary && <div style={{ fontSize: 9, color: theme.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>}
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>
      {isOpen && <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>{children}</div>}
    </div>
  );
};
