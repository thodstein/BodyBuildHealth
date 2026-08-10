/**
 * DiaryModals — shared add-entry modal components for all diary types.
 * Used by both ProfileDiariesTab and DiaryWindow.
 *
 * Redesign v2 (Aug 10 2026): стеклянный дизайн-слой + полный план улучшений —
 *  - умные дефолты из последней записи + «Повторить последнюю»
 *  - черновики в sessionStorage (не теряются при переключении вкладок)
 *  - живая валидация с баннерами вместо тихого отказа
 *  - ассистент ротации инъекций + память дозы по препарату
 *  - bottom-sheet на мобильных, фокус-трап, блокировка скролла, автозаполнение фокуса
 *  - лонг-пресс степперов, клавиатура в шкалах, спарклайн в шапке
 * Public API (open/onClose/onSave и экспорты) сохранён для обратной совместимости.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { colors, BoolChip } from './ui';
import { todayIso } from './diary-helpers';
import { getWeightLog } from '../../../engines/profile-store';
import { INJECTION_ZONES, NEEDLE_GAUGES, TECHNIQUES } from '../../../engines/injection-diary.engine';

export interface UndoAction {
  label: string;
  undo: () => void;
  expiresAt: number;
}

/* ── Legacy style exports (backward-compat) ── */

export const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
};
export const fieldInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 12px',
  color: colors.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: 44,
};
export const btnPrimary = (color: string): React.CSSProperties => ({
  flex: 1,
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  background: color,
  color: '#000',
  border: 'none',
  cursor: 'pointer',
});
export const btnGhost: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  background: 'rgba(255,255,255,0.03)',
  color: colors.text,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
};

export const styles = { fieldLabel, fieldInput, btnGhost, btnPrimary };

/* ── Хелперы дневников ── */

export function readDiaryEntries<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function lastEntryOf<T extends { date?: string; timestamp?: number }>(arr: T[]): T | undefined {
  return [...arr].sort(
    (a, b) =>
      (b.timestamp ?? new Date(String(b.date || '')).getTime()) -
      (a.timestamp ?? new Date(String(a.date || '')).getTime()),
  )[0];
}

/** Черновик модалки в sessionStorage: переживает переключение вкладок профиля. */
export function useDiaryDraft<T extends object>(
  storageKey: string,
  initial: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const s = sessionStorage.getItem(storageKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') return { ...initial(), ...parsed };
      }
    } catch {}
    return initial();
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);
  return [state, setState, clear];
}

/* ── Шкалы, пресеты, метаданные (сохранены как есть) ── */

export const PAIN_ZONES = [
  { id: 'shoulders', label: 'Плечи' },
  { id: 'elbows', label: 'Локти' },
  { id: 'wrists', label: 'Запястья' },
  { id: 'lower_back', label: 'Поясница' },
  { id: 'hips', label: 'ТБС' },
  { id: 'knees', label: 'Колени' },
  { id: 'ankles', label: 'Голеностоп' },
];
export const NEURO_SYMPTOMS = [
  { id: 'anxiety', label: 'Тревожность' },
  { id: 'insomnia', label: 'Бессонница' },
  { id: 'mood_swings', label: 'Перепады настроения' },
  { id: 'irritability', label: 'Раздражительность' },
  { id: 'headache', label: 'Головная боль' },
  { id: 'low_libido', label: 'Снижение либидо' },
  { id: 'fatigue', label: 'Усталость' },
  { id: 'concentration', label: 'Трудности с концентрацией' },
  { id: 'depression', label: 'Подавленное настроение' },
  { id: 'sweating', label: 'Потливание' },
];
export const ACNE_AREAS = [
  { id: 'face', label: 'Лицо' },
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'shoulders_acne', label: 'Плечи' },
];
export const HEMATO_SYMPTOMS = [
  { id: 'nosebleeds', label: 'Носовые кровотечения' },
  { id: 'gum_bleeding', label: 'Кровоточивость дёсен' },
  { id: 'bruising', label: 'Синяки без причины' },
  { id: 'headache_h', label: 'Головная боль' },
  { id: 'flushing', label: 'Покраснение лица' },
  { id: 'vision', label: 'Нарушения зрения' },
  { id: 'itching', label: 'Кожный зуд' },
  { id: 'numbness', label: 'Онемение конечностей' },
];

export const DIARY_META: Record<
  string,
  { title: string; unit: string; icon: string; color: string; storageKey?: string }
> = {
  sleep: { title: 'Сон', unit: 'ч', icon: '💤', color: '#a78bfa', storageKey: 'he_sleep_diary' },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: '❤️', color: '#ef4444', storageKey: 'he_bp_diary' },
  weight: { title: 'Вес и замеры', unit: 'кг / см', icon: '⚖️', color: '#22c55e' },
  injection: { title: 'Инъекции', unit: '', icon: '💉', color: '#f59e0b', storageKey: 'he_injection_diary' },
  health: { title: 'Здоровье', unit: '', icon: '🩺', color: '#ec4899', storageKey: 'he_health_diary' },
};

export const painZoneColor = (v: number) => (v <= 2 ? '#22c55e' : v <= 4 ? '#f59e0b' : v <= 7 ? '#f97316' : '#ef4444');
export const acneAreaColor = (v: number) =>
  v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';

/* ── Дизайн-слой ── */

/** Внутренняя карточка-секция с цветным заголовком */
export const SectionCard: React.FC<{
  icon?: string;
  title: string;
  color: string;
  badge?: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ icon, title, color, badge, hint, children, style }) => (
  <div
    style={{
      borderRadius: 12,
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${color}22`,
      padding: 12,
      marginBottom: 10,
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</span>
      {badge && (
        <span
          style={{
            fontSize: 9, fontWeight: 800, color, background: `${color}26`,
            padding: '1px 7px', borderRadius: 8, marginLeft: 'auto',
          }}
        >
          {badge}
        </span>
      )}
    </div>
    {children}
    {hint && <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 6 }}>{hint}</div>}
  </div>
);

/** Живой бейдж-индикатор (категория АД, дельта веса и т.п.) */
export const LiveBadge: React.FC<{ color: string; icon?: string; children: React.ReactNode }> = ({ color, icon, children }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color,
      background: `${color}1c`, border: `1px solid ${color}55`,
      borderRadius: 999, padding: '5px 12px',
      animation: 'diary-badge-in 0.25s ease-out',
    }}
  >
    {icon && <span>{icon}</span>}
    {children}
  </div>
);

/** Баннер валидации / подсказки */
export const FormBanner: React.FC<{ tone: 'error' | 'warning' | 'info'; children: React.ReactNode }> = ({ tone, children }) => {
  const map = {
    error: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '⛔' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', icon: '⚠️' },
    info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', icon: 'ℹ️' },
  } as const;
  const m = map[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        padding: '9px 12px',
        borderRadius: 10,
        background: m.bg,
        border: `1px solid ${m.color}55`,
        color: m.color,
        fontSize: 11,
        fontWeight: 700,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        animation: 'diary-badge-in 0.2s ease-out',
      }}
    >
      <span>{m.icon}</span>
      <span style={{ lineHeight: 1.35 }}>{children}</span>
    </div>
  );
};

/** Мини-спарклайн последних значений */
export const Sparkline: React.FC<{ data: (number | null)[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 64,
  height = 22,
}) => {
  const pts = data.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const path = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i * (width - 4)) / (pts.length - 1) + 2).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: 0.9, flexShrink: 0 }} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** Сегментированная шкала (VAS 0-10, качество 1-5, акне 0-3) + клавиатура */
export const ScalePicker: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  labels?: (v: number) => string;
  toneFn?: (v: number) => string;
  dense?: boolean;
  height?: number;
}> = ({ value, onChange, min = 0, max, labels, toneFn, dense, height }) => {
  const steps: number[] = [];
  for (let v = min; v <= max; v++) steps.push(v);
  const tone = toneFn || ((v: number) => {
    const pct = max <= min ? 1 : (v - min) / (max - min);
    return pct <= 0.25 ? '#22c55e' : pct <= 0.5 ? '#f59e0b' : pct <= 0.75 ? '#f97316' : '#ef4444';
  });
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(value - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(value + 1);
    else if (/^[0-9]$/.test(e.key)) next = clamp(Number(e.key));
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };
  return (
    <div
      style={{ display: 'flex', gap: 3 }}
      role="radiogroup"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Шкала оценки"
      aria-valuenow={value}
    >
      {steps.map((v) => {
        const c = tone(v);
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              minHeight: height || (dense ? 36 : 44),
              padding: '4px 2px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: dense ? 10 : 12,
              fontWeight: 800,
              border: `1px solid ${active ? c : 'rgba(255,255,255,0.07)'}`,
              background: active ? `${c}30` : 'rgba(255,255,255,0.02)',
              color: active ? c : colors.textMuted,
              transition: 'all 0.15s',
              transform: active ? 'translateY(-1px)' : undefined,
              boxShadow: active ? `0 2px 8px ${c}40` : undefined,
            }}
          >
            {labels ? labels(v) : v}
          </button>
        );
      })}
    </div>
  );
};

/** Степпер − / + с лонг-пресс повтором */
export const StepperInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  large?: boolean;
  compact?: boolean;
}> = ({ value, onChange, step = 1, min, max, unit, large, compact }) => {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const timerRef = useRef<{ timeout: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({
    timeout: null,
    interval: null,
  });
  const stopRepeat = useCallback(() => {
    if (timerRef.current.timeout) clearTimeout(timerRef.current.timeout);
    if (timerRef.current.interval) clearInterval(timerRef.current.interval);
    timerRef.current = { timeout: null, interval: null };
  }, []);
  useEffect(() => stopRepeat, [stopRepeat]);

  const apply = useCallback(
    (dir: 1 | -1) => {
      const n = Number(valueRef.current);
      if (!Number.isFinite(n)) return;
      let v = n + step * dir;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(String(Number(v.toFixed(2))));
    },
    [step, min, max, onChange],
  );
  const startRepeat = (dir: 1 | -1) => {
    apply(dir);
    stopRepeat();
    timerRef.current.timeout = setTimeout(() => {
      timerRef.current.interval = setInterval(() => apply(dir), 70);
    }, 380);
  };
  const btn: React.CSSProperties = {
    width: compact ? 36 : 44,
    minHeight: compact ? 32 : 44,
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: 'rgba(255,255,255,0.04)',
    color: colors.text,
    fontSize: large ? 20 : 16,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    touchAction: 'none',
    userSelect: 'none',
    transition: 'all 0.15s',
  };
  const holdProps = (dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      startRepeat(dir);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
      <button type="button" style={btn} {...holdProps(-1)} aria-label="Уменьшить">−</button>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...fieldInput,
            textAlign: 'center',
            fontSize: large ? 26 : 16,
            fontWeight: 800,
            color: colors.text,
            background: 'rgba(255,255,255,0.03)',
            paddingRight: unit ? 30 : 12,
          }}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11, color: colors.textSubtle, pointerEvents: 'none',
          }}>
            {unit}
          </span>
        )}
      </div>
      <button type="button" style={btn} {...holdProps(1)} aria-label="Увеличить">+</button>
    </div>
  );
};

/** Группа чипов множественного выбора */
export const ChipGroup: React.FC<{
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  color?: string;
  columns?: number;
  single?: boolean;
}> = ({ options, selected, onChange, color, columns = 2, single }) => {
  const c = color || colors.primary;
  const toggle = (id: string) => {
    if (single) { onChange([id]); return; }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 5 }}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            style={{
              minHeight: 40,
              padding: '7px 8px',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'left',
              border: `1px solid ${on ? c : 'rgba(255,255,255,0.08)'}`,
              background: on ? `${c}24` : 'rgba(255,255,255,0.03)',
              color: on ? c : colors.textMuted,
              transition: 'all 0.15s',
            }}
          >
            {on ? '✓ ' : ''}{o.label}
          </button>
        );
      })}
    </div>
  );
};

/** Единое поле ввода с лейблом */
export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'time' | 'date' | 'select';
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { id: string; label: string }[];
  hint?: string;
  accent?: string;
}> = ({ label, value, onChange, type = 'text', placeholder, unit, min, max, step, options, hint, accent }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {label}
    </span>
    {type === 'select' && options ? (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldInput, cursor: 'pointer' }}>
        {options.map((o) => (
          <option key={o.id} value={o.id} style={{ background: '#1c1c20' }}>{o.label}</option>
        ))}
      </select>
    ) : (
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={value}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...fieldInput,
            colorScheme: 'dark',
            borderColor: accent ? `${accent}66` : undefined,
            paddingRight: unit ? 30 : 12,
          }}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: colors.textSubtle, pointerEvents: 'none',
          }}>
            {unit}
          </span>
        )}
      </div>
    )}
    {hint && <span style={{ fontSize: 9, color: colors.textSubtle }}>{hint}</span>}
  </label>
);

/** Стеклянный контейнер модалки: шапка в цвет дневника, bottom-sheet на мобильных,
 *  фокус-трап, блокировка скролла, autofocus, Escape, спарклайн. */
export const DiaryModalShell: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  color: string;
  subtitle?: string;
  width?: number;
  onSubmit: () => void;
  footer?: React.ReactNode;
  spark?: { data: (number | null)[]; color?: string };
  children: React.ReactNode;
}> = ({ open, onClose, title, icon, color, subtitle, width = 420, onSubmit, footer, spark, children }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')?.focus();
    }, 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <style>{`
        @keyframes diary-badge-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes dm-slide-up { from { transform: translateY(48px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 480px) {
          .dm-overlay { align-items: flex-end !important; padding: 0 !important; }
          .dm-card { width: 100vw !important; max-width: 100vw !important; max-height: 88dvh !important; border-radius: 20px 20px 0 0 !important; animation: dm-slide-up 0.25s ease-out !important; }
          .dm-card form { max-height: 88dvh !important; }
        }
      `}</style>
      <div
        className="dm-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div
          ref={cardRef}
          className="dm-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: `min(${width}px, 94vw)`,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'rgba(24,24,28,0.96)',
            border: `1px solid ${color}44`,
            borderRadius: 18,
            padding: 0,
            color: colors.text,
            boxShadow: `0 16px 60px rgba(0,0,0,0.6), 0 0 0 1px ${color}11, inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '18px 18px 0 0',
                background: `linear-gradient(135deg, ${color}1f, rgba(255,255,255,0.02) 55%)`,
                borderBottom: `1px solid ${color}22`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${color}2a`,
                  border: `1px solid ${color}55`,
                  fontSize: 20,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color }}>{title}</div>
                {subtitle && <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>}
              </div>
              {spark && <Sparkline data={spark.data} color={spark.color || color} />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>{children}</div>
            {footer ?? (
              <div style={{ display: 'flex', gap: 8, padding: '12px 18px 16px', borderTop: `1px solid ${colors.border}`, flexShrink: 0 }}>
                <button type="button" onClick={onClose} style={btnGhost}>Отмена</button>
                <button type="submit" style={btnPrimary(color)}>Сохранить</button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
};

/** Backward-compat обёртка старого Modal */
export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({
  open,
  onClose,
  title,
  children,
}) => (
  <DiaryModalShell open={open} onClose={onClose} title={title} icon="📓" color={colors.primary} onSubmit={onClose}>
    {children}
  </DiaryModalShell>
);

export const DateInput: React.FC<{ value: string; onChange: (v: string) => void; style?: React.CSSProperties }> = ({
  value,
  onChange,
  style,
}) => (
  <input
    type="date"
    value={value}
    max={todayIso()}
    onChange={(e) => onChange(e.target.value)}
    style={{ ...fieldInput, colorScheme: 'dark', ...style }}
  />
);

/** Кнопка-бейдж «Сегодня» у даты */
export const TodayChip: React.FC<{ date: string; onToday: () => void }> = ({ date, onToday }) => {
  const isToday = date === todayIso();
  return (
    <button
      type="button"
      onClick={onToday}
      disabled={isToday}
      style={{
        padding: '7px 10px',
        borderRadius: 8,
        fontSize: 10,
        fontWeight: 700,
        cursor: isToday ? 'default' : 'pointer',
        border: `1px solid ${isToday ? 'rgba(34,197,94,0.35)' : colors.border}`,
        background: isToday ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.03)',
        color: isToday ? '#22c55e' : colors.textMuted,
        flexShrink: 0,
      }}
    >
      {isToday ? '✓ Сегодня' : '📅 Сегодня'}
    </button>
  );
};

/** Чип «Повторить последнюю запись» */
export const RepeatLastChip: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 10px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      cursor: 'pointer',
      border: `1px solid ${colors.border}`,
      background: 'rgba(255,255,255,0.03)',
      color: colors.textMuted,
      marginBottom: 10,
      transition: 'all 0.15s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderHover; e.currentTarget.style.color = colors.text; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textMuted; }}
  >
    ↩ {label}
  </button>
);

/* ── Модалки быстрого добавления (вынесены в отдельные файлы) ── */

export { AddSleepModal } from './sleep-diary-modal';
export { AddBPModal, bpCategory } from './bp-diary-modal';
export { AddBodyMeasurementsModal } from './body-measurements-modal';
export { AddInjectionModal } from './injection-diary-modal';
export { AddHealthModal } from './health-diary-modal';
