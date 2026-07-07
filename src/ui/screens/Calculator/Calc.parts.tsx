import React, { useState } from 'react';
import { LABEL, SEV_OPTS } from './Calc.types';

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