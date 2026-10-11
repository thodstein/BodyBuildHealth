/**
 * bb-hub-controls.tsx — W6: общие контролы хаба ББ-диагностики (вынесены при разрезе).
 *
 * BbCheckCard / BbNum / BbSheetSelect / bbNum жили внутри BBDiagnosticsHub и
 * требовались вынесенному скрининг-табу. Перенос БЕЗ изменений поведения.
 */
import React, { useState, useEffect } from 'react';

/** Компактная кнопка-карточка вместо галочки (44px, АПК-тап). */
export const BbCheckCard: React.FC<{ active: boolean; title: string; desc?: string; onToggle: () => void; accent?: string }> = ({ active, title, desc, onToggle, accent = '#00e68a' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-pressed={active}
    aria-label={title}
    data-bb="check-card"
    data-on={active ? '1' : '0'}
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 10px', borderRadius: 12,
      border: `1px solid ${active ? accent : 'rgba(255,255,255,0.10)'}`, cursor: 'pointer', textAlign: 'left',
      background: active ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 12, fontWeight: 700,
    }}
  >
    <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? accent : 'rgba(255,255,255,0.08)', color: active ? '#06281c' : '#fff', fontSize: 13, fontWeight: 900 }}>{active ? '✓' : ''}</span>
    <span style={{ lineHeight: 1.25 }}>{title}{desc ? <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.85 }}>{desc}</span> : null}</span>
  </button>
);

/**
 * Русская десятичная запятая: keyboard inputMode="decimal" на RU-раскладке отдаёт «5,5»,
 * а parseFloat резал её до 5 (КТС 12,5 → 12). Один парсер на все поля хаба.
 */
export const bbNum = (v: string | number | null | undefined): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const posNum = (v: string | number | null | undefined): number | null => {
  const n = bbNum(v);
  return n != null && n > 0 ? n : null;
};

/** Красивое числовое поле: подпись + инпут 44px/16px + степпер. */
export const BbNum: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string; step?: number; testId?: string }> = ({ label, value, onChange, placeholder, width = '100%', step, testId }) => (
  <label data-bb="num-field" style={{ fontSize: 11, color: '#fff', display: 'block', minWidth: 0 }}>
    <span style={{ display: 'block', marginBottom: 3, lineHeight: 1.2 }}>{label}</span>
    <span style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
      {step ? (
        <button type="button" data-bb="num-minus" aria-label={`Уменьшить ${label}`} onClick={() => { const n = bbNum(value); onChange(n != null ? String(Math.max(0, Math.round((n - step) * 10) / 10)) : ''); }} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>−</button>
      ) : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        data-bb="num-input"
        data-testid={testId}
        aria-label={label}
        style={{ flex: 1, width, minHeight: 44, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 10px', fontSize: 16 }}
      />
      {step ? (
        <button type="button" data-bb="num-plus" aria-label={`Увеличить ${label}`} onClick={() => { const n = bbNum(value); onChange(n != null ? String(Math.round((n + step) * 10) / 10) : String(step)); }} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: '1px solid rgba(0,230,138,0.30)', background: 'rgba(0,230,138,0.12)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
      ) : null}
    </span>
  </label>
);

/** Красивый попап-выбор вместо нативного селекта (кнопка 44px + шит). */
export const BbSheetSelect: React.FC<{ label: string; value: string; options: Array<{ id: string; label: string; hint?: string }>; onChange: (id: string) => void; testId?: string }> = ({ label, value, options, onChange, testId }) => {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value) || null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);
  return (
    <span data-bb="sheet-select" style={{ display: 'block', minWidth: 0 }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${cur ? cur.label : 'не выбрано'}`}
        data-bb="sheet-trigger"
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.8 }}>{label}</span>
        <span style={{ flex: 1 }}>{cur ? cur.label : '— выбери —'}</span>
        <span aria-hidden style={{ color: '#fff', opacity: 0.8 }}>▾</span>
      </button>
      {open && (
        <span data-bb="sheet-backdrop" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span role="dialog" aria-modal="true" aria-label={label} data-bb="sheet-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '70vh', overflowY: 'auto', background: '#101827', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none', borderRadius: '18px 18px 0 0', padding: '12px 12px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <span style={{ display: 'block', width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)', margin: '0 auto 10px' }} />
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{label}</span>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={value === o.id}
                data-bb="sheet-option"
                data-active={value === o.id ? '1' : '0'}
                onClick={() => { onChange(o.id); setOpen(false); }}
                style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 6, borderRadius: 12, border: `1px solid ${value === o.id ? 'rgba(0,230,138,0.45)' : 'rgba(255,255,255,0.10)'}`, background: value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{value === o.id ? '●' : ''}</span>
                <span style={{ flex: 1 }}>{o.label}{o.hint ? <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.8 }}>{o.hint}</span> : null}</span>
              </button>
            ))}
            <button type="button" data-bb="sheet-done" onClick={() => setOpen(false)} style={{ width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Готово</button>
          </span>
        </span>
      )}
    </span>
  );
};
