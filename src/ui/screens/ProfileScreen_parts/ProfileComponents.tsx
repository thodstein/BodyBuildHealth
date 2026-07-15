import React from 'react';

/* ── Design tokens ── */
export const theme = {
  glassBg: 'rgba(28,28,32,0.55)',
  glassBorder: '1px solid rgba(255,255,255,0.10)',
  cardRadius: 16,
  accent: '#00e68a',
  accentDim: 'rgba(0,230,138,0.15)',
  accentBorder: '1px solid rgba(0,230,138,0.3)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: '1px solid rgba(255,255,255,0.08)',
  inputFocus: '1px solid rgba(0,230,138,0.4)',
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.9)',
  textDim: 'rgba(255,255,255,0.6)',
  pillBg: 'rgba(255,255,255,0.06)',
  pillActiveBg: 'rgba(0,230,138,0.12)',
  gradientGreen: 'linear-gradient(135deg, #00e68a, #00b864)',
  gradientBlue: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  gradientOrange: 'linear-gradient(135deg, #f59e0b, #f97316)',
  gradientRed: 'linear-gradient(135deg, #ef4444, #dc2626)',
  gradientPurple: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
  blur: 'blur(20px) saturate(160%)',
  shadowSm: '0 4px 16px rgba(0,0,0,0.25)',
  shadowMd: '0 10px 30px rgba(0,0,0,0.35)',
} as const;

/* ── Styles ── */
export const glassCardStyle: React.CSSProperties = {
  background: theme.glassBg,
  backdropFilter: theme.blur,
  WebkitBackdropFilter: theme.blur,
  borderRadius: theme.cardRadius,
  border: theme.glassBorder,
  boxShadow: theme.shadowSm,
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
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
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
        onClick={e => e.stopPropagation()}
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
      onClick={e => e.stopPropagation()}
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

/* ── PopupCard — clickable card → modal popup ── */
interface PopupCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  children: React.ReactNode;
  wide?: boolean;
}
export const PopupCard: React.FC<PopupCardProps> = ({ label, value, icon, color = theme.accent, children, wide }) => {
  const [open, setOpen] = React.useState(false);
  const isFilled = !!value && value !== '—' && value !== 'Нет' && value !== 'Нет данных' && value !== 'не указан' && !/^—/.test(String(value));
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{
          display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', borderRadius:theme.cardRadius, cursor:'pointer', textAlign:'left',
          background:'rgba(255,255,255,0.04)', border:`1px solid ${color}33`, borderLeft:`3px solid ${color}`, color:theme.textPrimary,
          transition:'all 0.15s', boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
        }}
        onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
        onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        {icon && <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, color:theme.textDim, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.3px' }}>{label}</div>
          <div style={{ fontSize:14, fontWeight:700, color: isFilled ? color : 'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
        </div>
        <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: isFilled ? color : 'rgba(255,255,255,0.15)' }} />
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: wide ? '100%' : 320, maxHeight:'82vh', overflowY:'auto', background:'#18181b', borderRadius:20, border:'1px solid rgba(255,255,255,0.12)', padding:20, boxShadow:theme.shadowMd }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
              {icon && <span style={{ width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background: color + '22' }}>{icon}</span>}
              <span>{label}</span>
            </div>
            {children}
            <button onClick={() => setOpen(false)}
              style={{ width:'100%', padding:'11px 0', marginTop:16, borderRadius:12, border:'none', background:'rgba(255,255,255,0.06)', cursor:'pointer', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>
              Готово
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/* ── NumberPc — PopupCard for a single number input ── */
interface NumberPcProps {
  label: string;
  value: string | number;
  icon?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  color?: string;
}
export const NumberPc: React.FC<NumberPcProps> = ({ label, value, icon, onChange, placeholder, min, max, step, suffix, color }) => {
  const display = value !== undefined && value !== '' ? `${value}${suffix ? ' ' + suffix : ''}` : '—';
  return (
    <PopupCard label={label} value={display} icon={icon || '#'} color={color}>
      <input type="number" min={min} max={max} step={step || 1}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:20, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
    </PopupCard>
  );
};

/* ── SliderPc — PopupCard with slider ── */
interface SliderPcProps {
  label: string;
  value: number;
  icon?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
}
export const SliderPc: React.FC<SliderPcProps> = ({ label, value, icon, min=1, max=10, step=1, onChange, color }) => {
  return (
    <PopupCard label={label} value={`${value}/${max}`} icon={icon} color={color}>
      <div style={{ textAlign:'center', marginBottom:12 }}>
        <span style={{ fontSize:36, fontWeight:800, color: color || (value <= 3 ? '#00e68a' : value <= 6 ? '#f59e0b' : '#ef4444') }}>{value}</span>
        <span style={{ fontSize:16, color:'rgba(255,255,255,0.3)', marginLeft:4 }}>/ {max}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width:'100%', accentColor: theme.accent }} />
    </PopupCard>
  );
};

/* ── TextPc — PopupCard for text input ── */
interface TextPcProps {
  label: string;
  value: string;
  icon?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  color?: string;
}
export const TextPc: React.FC<TextPcProps> = ({ label, value, icon, onChange, placeholder, multiline, color }) => {
  const display = value || '—';
  return (
    <PopupCard label={label} value={display} icon={icon} color={color} wide>
      {multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          autoFocus
          style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:14, minHeight:100, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
      ) : (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          autoFocus
          style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:18, fontWeight:600, boxSizing:'border-box', outline:'none' }} />
      )}
    </PopupCard>
  );
};

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
  const isControlled = controlledOpen !== undefined && onToggle !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const handleToggle = isControlled ? onToggle! : (() => setInternalOpen(p => !p));
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

/* ── SectionTitle ── */
export const SectionTitle: React.FC<{ icon?: string; title: string; subtitle?: string; color?: string }> = ({ icon, title, subtitle, color = theme.accent }) => (
  <div style={{ display:'flex', alignItems:'center', gap:10, margin:'2px 0 12px' }}>
    {icon && (
      <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, background: (color || theme.accent) + '22', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>{icon}</div>
    )}
    <div>
      <div style={{ fontSize:17, fontWeight:800, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize:11, color:theme.textDim, marginTop:2, lineHeight:1.3 }}>{subtitle}</div>}
    </div>
  </div>
);

/* ── ValueChip ── */
export const ValueChip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = theme.accent }) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, color, background: color + '1a', border:`1px solid ${color}33` }}>{children}</span>
);
