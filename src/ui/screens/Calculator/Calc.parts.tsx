import React, { useState } from 'react';
import { LABEL, SEV_OPTS, GLASS } from './Calc.types';

export function SevSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={LABEL}>{label}</span>
      <PopupSelect label={label} value={value} options={SEV_OPTS} onChange={onChange} />
    </div>
  );
}

export function Card({
  icon,
  title,
  defaultOpen,
  cols,
  children,
}: {
  icon: string;
  title: string;
  defaultOpen?: boolean;
  cols?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div
      className="calc-card"
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 14,
        border: '2px solid rgba(0,230,138,0.25)',
        marginBottom: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(135deg, rgba(0,230,138,0.02), rgba(0,198,83,0.02))',
          pointerEvents: 'none',
        }}
      />
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          marginBottom: open ? 8 : 0,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </div>
      {open && (
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: cols ? `repeat(${cols},1fr)` : '1fr',
            gap: 4,
            gridAutoRows: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function PopupSelect({
  label,
  value,
  options,
  onChange,
  style,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 9,
          cursor: 'pointer',
          background: value ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: value ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
          textAlign: 'left' as const,
          ...style,
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '88%',
              maxWidth: 360,
              maxHeight: '70vh',
              borderRadius: 16,
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: 'linear-gradient(90deg, #00e68a, #00c853)' }} />
            <div
              style={{
                padding: '14px 16px',
                maxHeight: 'calc(70vh - 3px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                {label}
              </div>
              {options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    marginBottom: 3,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: value === o.id ? 700 : 400,
                    textAlign: 'left' as const,
                    background:
                      value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                    border:
                      value === o.id
                        ? '1px solid rgba(0,230,138,0.3)'
                        : '1px solid rgba(255,255,255,0.06)',
                    color: value === o.id ? '#00e68a' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  {o.label}
                  {value === o.id ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PopupBool({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          textAlign: 'center',
          background: value ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
          border: value ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
          color: value ? '#000' : 'var(--text-dim)',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80%',
              maxWidth: 300,
              borderRadius: 16,
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                {label}
              </div>
              <button
                onClick={() => {
                  onChange(true);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 14px',
                  marginBottom: 3,
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'left',
                  background: value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                  border: value ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: value ? '#00e68a' : 'rgba(255,255,255,0.8)',
                }}
              >
                ✓ Да {value ? ' ✓' : ''}
              </button>
              <button
                onClick={() => {
                  onChange(false);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'left',
                  background: !value ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                  border: !value ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: !value ? '#ef4444' : 'rgba(255,255,255,0.8)',
                  marginBottom: 6,
                }}
              >
                ✗ Нет {!value ? ' ✓' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PopupNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));
  return (
    <>
      <button
        onClick={() => {
          setEdit(String(value));
          setOpen(true);
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          textAlign: 'center',
          background: 'rgba(0,230,138,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--text-light)',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80%',
              maxWidth: 300,
              borderRadius: 16,
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                {label}
              </div>
              <input
                type="range"
                min={min ?? 0}
                max={max ?? 300}
                step={step ?? 1}
                value={parseInt(edit) || 0}
                onChange={(e) => setEdit(e.target.value)}
                style={{
                  width: '100%',
                  height: 4,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                  marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number"
                  value={edit}
                  onChange={(e) => setEdit(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                />
                <button
                  onClick={() => {
                    const v = parseFloat(edit);
                    if (!isNaN(v)) onChange(v);
                    setOpen(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg,#00e68a,#00c853)',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PopupText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(value);
  return (
    <>
      <button
        onClick={() => {
          setEdit(value);
          setOpen(true);
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          textAlign: 'center',
          background: 'rgba(0,230,138,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: value ? 'var(--text-light)' : 'var(--text-dim)',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80%',
              maxWidth: 300,
              borderRadius: 16,
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                {label}
              </div>
              <input
                type="text"
                value={edit}
                onChange={(e) => setEdit(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  marginBottom: 10,
                }}
              />
              <button
                onClick={() => {
                  onChange(edit);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,#00e68a,#00c853)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PopupPEDInput — кнопка-карточка с попапом для ввода PED-дозы
// ════════════════════════════════════════════════════════════════════
interface PedConfig {
  icon: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  presets: number[];
  color: string;
  gradient: string;
}

export const PED_CONFIGS: Record<string, PedConfig> = {
  ghIU: { icon:'🧬', label:'GH', unit:'МЕ/день', min:0, max:20, step:0.5, presets:[2,4,6,8,10], color:'#60a5fa', gradient:'linear-gradient(135deg,#3b82f6,#2563eb)' },
  insulinIU: { icon:'💉', label:'Инсулин', unit:'МЕ/день', min:0, max:50, step:1, presets:[5,10,15,20,30], color:'#fb923c', gradient:'linear-gradient(135deg,#f97316,#ea580c)' },
  igfMcg: { icon:'🔬', label:'IGF-1 LR3', unit:'мкг/день', min:0, max:200, step:10, presets:[20,40,60,80,100], color:'#a78bfa', gradient:'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  clenMcg: { icon:'🔥', label:'Clenbuterol', unit:'мкг/день', min:0, max:200, step:10, presets:[20,40,60,80,120], color:'#f87171', gradient:'linear-gradient(135deg,#ef4444,#dc2626)' },
  t3Mcg: { icon:'⚡', label:'T3', unit:'мкг/день', min:0, max:100, step:5, presets:[12.5,25,37.5,50,75], color:'#fbbf24', gradient:'linear-gradient(135deg,#f59e0b,#d97706)' },
};

export function PopupPEDInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const cfg = PED_CONFIGS[id]!;
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));

  const active = value > 0;

  return (
    <>
      <button
        onClick={() => { setEdit(String(value)); setOpen(true); }}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '7px 6px',
          borderRadius: 10,
          cursor: 'pointer',
          background: active ? `${cfg.color}12` : 'rgba(255,255,255,0.03)',
          border: active ? `1.5px solid ${cfg.color}40` : '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: active ? cfg.color : 'var(--text-dim)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.label}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>{cfg.unit}</div>
        </div>
        {active ? (
          <div style={{
            fontSize: 9, fontWeight: 800, color: '#fff',
            background: cfg.gradient,
            padding: '2px 5px',
            borderRadius: 6,
            lineHeight: 1.4,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {value}{cfg.unit.startsWith('мкг') ? ' мкг' : ''}
          </div>
        ) : (
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>0</div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '88%', maxWidth: 340,
              borderRadius: 18,
              background: '#1a1a1d',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              boxShadow: `0 8px 40px ${cfg.color}20`,
            }}
          >
            {/* Верхняя полоса */}
            <div style={{ height: 3, background: cfg.gradient }} />

            <div style={{ padding: '16px 18px' }}>
              {/* Заголовок */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${cfg.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{cfg.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color, letterSpacing: '-0.3px' }}>{cfg.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{cfg.unit}</div>
                </div>
              </div>

              {/* Большое число */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{
                  fontSize: 36, fontWeight: 800,
                  color: active ? cfg.color : 'rgba(255,255,255,0.15)',
                  letterSpacing: '-1px',
                }}>
                  {parseInt(edit) || 0}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
                  {cfg.unit.replace('/день','')}
                </span>
              </div>

              {/* Ползунок */}
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={parseFloat(edit) || 0}
                onChange={e => setEdit(e.target.value)}
                style={{
                  width: '100%', height: 5, cursor: 'pointer',
                  accentColor: cfg.color,
                  marginBottom: 12, borderRadius: 3,
                }}
              />

              {/* Быстрые пресеты */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
                {cfg.presets.map(p => (
                  <button
                    key={p}
                    onClick={() => setEdit(String(p))}
                    style={{
                      flex: 1, minWidth: 48, padding: '5px 0',
                      borderRadius: 6, cursor: 'pointer',
                      fontSize: 8, fontWeight: 700,
                      background: (parseFloat(edit) || 0) === p ? `${cfg.color}20` : 'rgba(255,255,255,0.04)',
                      border: (parseFloat(edit) || 0) === p ? `1px solid ${cfg.color}40` : '1px solid rgba(255,255,255,0.06)',
                      color: (parseFloat(edit) || 0) === p ? cfg.color : 'rgba(255,255,255,0.6)',
                      textAlign: 'center',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Ручной ввод + кнопки */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={edit}
                  onChange={e => setEdit(e.target.value)}
                  placeholder="0"
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box',
                    border: `1px solid ${cfg.color}30`,
                    background: 'rgba(0,0,0,0.4)', color: '#fff',
                    fontSize: 14, fontWeight: 700, textAlign: 'center',
                  }}
                />
                <button
                  onClick={() => { const v = parseFloat(edit); if (!isNaN(v) && v >= 0) onChange(v); setOpen(false); }}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: cfg.gradient, color: '#fff',
                    fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
                  }}
                >
                  OK
                </button>
              </div>

              {/* Сбросить */}
              {active && (
                <button
                  onClick={() => { onChange(0); setOpen(false); }}
                  style={{
                    width: '100%', marginTop: 8, padding: '6px',
                    borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', color: '#f87171',
                    fontSize: 8, fontWeight: 600,
                  }}
                >
                  ✕ Сбросить (0)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}