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
import React, { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { colors, BoolChip } from './ui';
import { todayIso } from './diary-helpers';
import { getWeightLog } from '../../../engines/profile-store';
import { readDiaryEntries as readDiaryEntriesFromStorage } from '../../../engines/diary-storage';
import { INJECTION_ZONES, NEEDLE_GAUGES, TECHNIQUES } from '../../../engines/injection-diary.engine';

export interface UndoAction {
  id: number;
  label: string;
  undo: () => void;
  expiresAt: number;
}

export const UNDO_TTL_MS = 5000;

/** Очередь undo-действий: последний добавленный — верхний (показывается первым). Кап 5. */
export const pushUndoAction = (queue: UndoAction[], label: string, undo: () => void): UndoAction[] => [
  ...queue.slice(-4),
  { id: Date.now() + Math.random(), label, undo, expiresAt: Date.now() + UNDO_TTL_MS },
];
export const topUndo = (queue: UndoAction[]): UndoAction | null => (queue.length ? queue[queue.length - 1] : null);
export const dismissTopUndo = (queue: UndoAction[]): UndoAction[] => queue.slice(0, -1);

/** @deprecated Используй routineNextStep(kind, step) — v2 рутинг с evening/health шагами. */
export const nextRoutineStep = (r: 'sleep' | 'bp' | 'weight'): 'sleep' | 'bp' | 'weight' | null =>
  r === 'sleep' ? 'bp' : r === 'bp' ? 'weight' : null;

/* ── Утренний/вечерний рутинг (v2) ── */

export type RoutineKind = 'morning' | 'evening';
export type RoutineStepId = 'sleep' | 'bp' | 'weight' | 'health';

export const ROUTINE_STEPS: Record<RoutineKind, RoutineStepId[]> = {
  // ЧСС ведётся В АД (поле «Пульс»): утренний и вечерний АД-шаги включают пульс в покое.
  morning: ['sleep', 'bp', 'weight', 'health'],
  evening: ['bp'],
};

export interface ActiveRoutine {
  kind: RoutineKind;
  step: RoutineStepId;
}

/** Следующий шаг рутинга; null — рутинг завершён. */
export const routineNextStep = (kind: RoutineKind, step: RoutineStepId): RoutineStepId | null => {
  const steps = ROUTINE_STEPS[kind];
  const idx = steps.indexOf(step);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
};

export const routineStepIndex = (kind: RoutineKind, step: RoutineStepId): number =>
  ROUTINE_STEPS[kind].indexOf(step);

export const ROUTINE_STEP_LABELS: Record<RoutineStepId, string> = {
  sleep: 'Сон',
  bp: 'Давление и ЧСС',
  weight: 'Вес',
  health: 'Здоровье',
};

export const ROUTINE_KIND_LABELS: Record<RoutineKind, string> = {
  morning: 'Утренний лог',
  evening: 'Вечерний лог',
};

/** Миграция legacy-значения рутинга ('sleep'|'bp'|'weight') в v2. */
export const migrateLegacyRoutine = (raw: string | null): ActiveRoutine | null => {
  if (!raw) return null;
  if (raw === 'sleep' || raw === 'bp' || raw === 'weight') return { kind: 'morning', step: raw };
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.kind === 'morning' || parsed.kind === 'evening') &&
      typeof parsed.step === 'string' &&
      ROUTINE_STEPS[parsed.kind as RoutineKind].includes(parsed.step as RoutineStepId)
    ) {
      return { kind: parsed.kind, step: parsed.step };
    }
  } catch {}
  return null;
};

export const daysAgoLabel = (days: number): string =>
  days <= 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`;
export const staleColorFor = (days: number, base: string): string =>
  days >= 14 ? '#ef4444' : days >= 7 ? '#f97316' : days >= 3 ? '#f59e0b' : base;

/** Дней с последней записи (0 = сегодня, null — записей нет). */
export const daysSince = (lastDate: string | undefined): number | null => {
  if (!lastDate) return null;
  const last = new Date(lastDate);
  if (isNaN(last.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86400000));
};

/* ── Legacy style exports (backward-compat) ── */

export const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
  fontWeight: 700,
  marginBottom: 5,
  display: 'block',
  letterSpacing: 0.5,
};
export const fieldInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 14,
  padding: '12px 14px',
  color: colors.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: 46,
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
};
export const btnPrimary = (color: string): React.CSSProperties => ({
  flex: 1,
  minHeight: 46,
  padding: '10px 18px',
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 800,
  background: `linear-gradient(135deg, ${color}, ${color}99)`,
  color: '#08120c',
  border: 'none',
  cursor: 'pointer',
  boxShadow: `0 5px 18px ${color}38, inset 0 1px 0 rgba(255,255,255,0.32)`,
  transition: 'transform 0.15s, box-shadow 0.15s, filter 0.15s',
});
export const btnGhost: React.CSSProperties = {
  flex: 1,
  minHeight: 46,
  padding: '10px 18px',
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 700,
  background: 'rgba(255,255,255,0.055)',
  color: colors.text,
  border: `1px solid ${colors.borderHover}`,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
};

export const styles = { fieldLabel, fieldInput, btnGhost, btnPrimary };

/* ── Хелперы дневников ── */

/** Единый слой чтения — diary-storage.ts (реэкспорт для обратной совместимости). */
export function readDiaryEntries<T>(key: string): T[] {
  return readDiaryEntriesFromStorage<T>(key);
}

export function lastEntryOf<T extends { date?: string; timestamp?: number }>(arr: T[]): T | undefined {
  return [...arr].sort(
    (a, b) =>
      (b.timestamp ?? new Date(String(b.date || '')).getTime()) -
      (a.timestamp ?? new Date(String(a.date || '')).getTime()),
  )[0];
}

/** Запись за конкретную дату (используется для предупреждения о замене). */
export function findByDate<T extends { date?: string }>(entries: T[], date: string): T | undefined {
  return entries.find((e) => e.date === date);
}

/** Запись за дату с тем же препаратом (инъекции: несколько уколов в день допустимы). */
export function findByDateAndSubstance<T extends { date?: string; substance?: string | number }>(
  entries: T[],
  date: string,
  substance: string,
): T | undefined {
  const sub = String(substance || '').trim().toLowerCase();
  if (!sub) return undefined;
  return entries.find(
    (e) => e.date === date && String(e.substance ?? '').trim().toLowerCase() === sub,
  );
}

/** Черновик модалки в sessionStorage: переживает переключение вкладок профиля.
 *  Третий элемент — reset(next?): очищает storage и сбрасывает состояние,
 *  следующая запись persist пропускается (guard от мусорной перезаписи свежим дефолтом). */
export function useDiaryDraft<T extends object>(
  storageKey: string,
  initial: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>, (next?: T) => void] {
  const skipPersist = useRef(false);
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
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);
  const reset = useCallback(
    (next?: T) => {
      skipPersist.current = true;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setState(next ?? initial());
    },
    [storageKey],
  );
  return [state, setState, reset];
}

/* ── Шкалы, пресеты, метаданные (сохранены как есть) ── */

export const PAIN_ZONES = [
  { id: 'neck', label: 'Шея' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'elbows', label: 'Локти' },
  { id: 'wrists', label: 'Запястья' },
  { id: 'upper_back', label: 'Грудной отдел' },
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
  cardio: { title: 'Кардио', unit: 'мин', icon: '❤️', color: '#4ade80', storageKey: 'he_cardio_sessions' },
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
      borderRadius: 18,
      background: `linear-gradient(180deg, ${color}14, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.025))`,
      border: `1px solid ${color}34`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 0 rgba(0,0,0,0.2)`,
      padding: 16,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -44,
        right: -44,
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}22, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, position: 'relative' }}>
      {icon && (
        <span
          aria-hidden="true"
          style={{
            fontSize: icon === '⚖️' ? 20 : 16,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${color}40, ${color}14)`,
            border: `1px solid ${color}50`,
            boxShadow: `0 3px 10px ${color}26, inset 0 1px 0 rgba(255,255,255,0.14)`,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.9 }}>{title}</span>
      {badge && (
        <span
          style={{
        fontSize: 11, fontWeight: 800, color, background: `${color}2c`,
        padding: '3px 10px', borderRadius: 999, marginLeft: 'auto',
        border: `1px solid ${color}50`,
          }}
        >
          {badge}
        </span>
      )}
    </div>
    {children}
    {hint && <div style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 8 }}>{hint}</div>}
  </div>
);

/** Живой бейдж-индикатор (категория АД, дельта веса и т.п.) */
export const LiveBadge: React.FC<{ color: string; icon?: string; children: React.ReactNode }> = ({ color, icon, children }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: 12, fontWeight: 800, color,
      background: `linear-gradient(135deg, ${color}2c, ${color}12)`,
      border: `1px solid ${color}5c`,
      borderRadius: 999, padding: '7px 16px',
      boxShadow: `0 4px 14px ${color}2e, inset 0 1px 0 rgba(255,255,255,0.12)`,
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
        padding: '11px 15px',
        borderRadius: 15,
        background: m.bg,
        border: `1px solid ${m.color}55`,
        color: m.color,
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: `0 2px 14px ${m.color}18`,
        animation: 'diary-badge-in 0.2s ease-out',
      }}
    >
      <span>{m.icon}</span>
      <span style={{ lineHeight: 1.35 }}>{children}</span>
    </div>
  );
};

/** Мини-спарклайн последних значений с градиентной заливкой */
export const Sparkline: React.FC<{ data: (number | null)[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 64,
  height = 22,
}) => {
  const gid = useId();
  const pts = data.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const x = (i: number) => ((i * (width - 4)) / (pts.length - 1) + 2).toFixed(1);
  const y = (v: number) => (height - 3 - ((v - min) / range) * (height - 6)).toFixed(1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${height - 1} L${x(0)},${height - 1} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: 0.95, flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="2.4" fill={color} />
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
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(30px, 1fr))',
        gap: 3,
      }}
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
              minHeight: height || (dense ? 40 : 48),
              padding: '4px 2px',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: dense ? 11 : 12,
              fontWeight: 800,
              border: `1px solid ${active ? c : 'rgba(255,255,255,0.1)'}`,
              background: active ? `${c}32` : 'rgba(255,255,255,0.035)',
              color: active ? c : colors.textMuted,
              transition: 'all 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: active ? 'translateY(-2px) scale(1.05)' : undefined,
              boxShadow: active ? `0 5px 18px ${c}52, inset 0 1px 0 rgba(255,255,255,0.16)` : undefined,
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
  invalid?: boolean;
}> = ({ value, onChange, step = 1, min, max, unit, large, compact, invalid }) => {
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
    width: compact ? 42 : 50,
    minHeight: compact ? 40 : 50,
    borderRadius: 14,
    border: `1px solid ${colors.borderHover}`,
    background: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: large ? 22 : 17,
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
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...fieldInput,
            textAlign: 'center',
            fontSize: large ? 30 : 16,
            fontWeight: 800,
            color: colors.text,
            background: 'rgba(255,255,255,0.04)',
            paddingRight: unit ? 34 : 12,
            borderColor: invalid ? '#ef444466' : undefined,
            boxShadow: invalid ? '0 0 0 3px rgba(239,68,68,0.12)' : undefined,
          }}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: colors.textSubtle, pointerEvents: 'none',
          }}>
            {invalid ? '⚠' : unit}
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
              minHeight: 44,
              padding: '9px 11px',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'left',
              border: `1px solid ${on ? c : 'rgba(255,255,255,0.1)'}`,
              background: on ? `${c}2e` : 'rgba(255,255,255,0.04)',
              color: on ? c : colors.textMuted,
              boxShadow: on ? `0 3px 14px ${c}36` : undefined,
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
  invalid?: boolean;
}> = ({ label, value, onChange, type = 'text', placeholder, unit, min, max, step, options, hint, accent, invalid }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </span>
    {type === 'select' && options ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...fieldInput,
          cursor: 'pointer',
          borderColor: invalid ? '#ef444466' : undefined,
          boxShadow: invalid ? '0 0 0 3px rgba(239,68,68,0.12)' : undefined,
        }}
      >
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
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...fieldInput,
            colorScheme: 'dark',
            borderColor: invalid ? '#ef444466' : accent ? `${accent}66` : undefined,
            boxShadow: invalid ? '0 0 0 3px rgba(239,68,68,0.12)' : undefined,
            paddingRight: unit || invalid ? 30 : 12,
          }}
        />
        {(unit || invalid) && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: invalid ? '#ef4444' : colors.textSubtle, pointerEvents: 'none',
          }}>
            {invalid ? '⚠' : unit}
          </span>
        )}
      </div>
    )}
    {hint && <span style={{ fontSize: 10.5, color: colors.textSubtle }}>{hint}</span>}
  </label>
);

/** Стеклянный контейнер модалки: шапка в цвет дневника, bottom-sheet на мобильных,
 *  фокус-трап, блокировка скролла, autofocus, Escape, спарклайн, stale-чип. */
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
  stale?: { days: number } | null;
  fill?: { current: number; total: number } | null;
  children: React.ReactNode;
}> = ({ open, onClose, title, icon, color, subtitle, width = 420, onSubmit, footer, spark, stale, fill, children }) => {
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
  const staleColor = stale ? staleColorFor(stale.days, color) : null;
  return (
    <>
      <style>{`
        @keyframes diary-badge-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes dm-pop { from { transform: scale(0.96) translateY(14px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes dm-slide-up { from { transform: translateY(48px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes dm-slide-down { from { transform: translateY(-32px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes dm-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dm-aurora {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.75; }
          50% { transform: translate(14px, -10px) scale(1.18); opacity: 1; }
        }
        .dm-overlay { animation: dm-fade-in 0.2s ease-out; }
        .dm-body { scrollbar-width: thin; scrollbar-color: ${color}55 transparent; }
        .dm-body::-webkit-scrollbar { width: 6px; }
        .dm-body::-webkit-scrollbar-track { background: transparent; }
        .dm-body::-webkit-scrollbar-thumb { background: ${color}44; border-radius: 999px; }
        .dm-body::-webkit-scrollbar-thumb:hover { background: ${color}77; }
        .dm-card input, .dm-card select, .dm-card textarea {
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
        }
        .dm-card input:focus, .dm-card select:focus, .dm-card textarea:focus {
          border-color: rgba(0,230,138,0.5) !important;
          box-shadow: 0 0 0 3px rgba(0,230,138,0.10);
          background: rgba(255,255,255,0.065) !important;
        }
        .dm-card button:focus-visible { outline: 2px solid rgba(0,230,138,0.55); outline-offset: 2px; }
        .dm-card .dm-icon-box {
          background: linear-gradient(135deg, ${color}3c, ${color}14);
          border: 1px solid ${color}5c;
          box-shadow: 0 6px 18px ${color}30, inset 0 1px 0 rgba(255,255,255,0.16);
        }
        .dm-card .dm-close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .dm-card .dm-ghost-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.3); }
        .dm-card .dm-primary-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .dm-card .dm-primary-btn:hover .dm-save-arrow { transform: translateX(3px); }
        .dm-card .dm-primary-btn:active { transform: translateY(0); }
        .dm-card { max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); }
        .dm-card form { max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); }
        @media (max-width: 480px) {
          .dm-overlay { align-items: flex-start !important; padding: 0 !important; }
          .dm-card { width: 100vw !important; max-width: 100vw !important; max-height: 100vh !important; max-height: 100dvh !important; border-radius: 0 0 26px 26px !important; margin: 0 auto !important; animation: dm-slide-down 0.26s cubic-bezier(0.32, 0.72, 0.28, 1) !important; }
          .dm-card form { max-height: 100vh !important; max-height: 100dvh !important; }
          .dm-grabber { display: none !important; }
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
          overflowY: 'auto',
          padding: 12,
          background:
            'radial-gradient(1000px 500px at 50% -8%, rgba(0,230,138,0.05), transparent 60%), rgba(5,5,9,0.66)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div
          ref={cardRef}
          className="dm-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: `min(${width}px, 94vw)`,
            overflow: 'hidden',
            margin: 'auto',
            background:
              'linear-gradient(165deg, rgba(36,36,48,0.98), rgba(19,19,26,0.98) 55%, rgba(13,13,18,0.99))',
            border: `1px solid ${color}42`,
            borderRadius: 26,
            padding: 0,
            color: colors.text,
            animation: 'dm-pop 0.22s cubic-bezier(0.32, 0.72, 0.28, 1)',
            boxShadow: `0 0 0 1px ${color}14, 0 30px 90px rgba(0,0,0,0.68), 0 0 60px ${color}1a, inset 0 1px 0 rgba(255,255,255,0.09)`,
          }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            <div
              className="dm-grabber"
              aria-hidden="true"
              style={{
                display: 'none',
                width: 40,
                height: 4,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.28)',
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -70,
                right: -30,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color}26, transparent 70%)`,
                filter: 'blur(24px)',
                pointerEvents: 'none',
                animation: 'dm-aurora 6s ease-in-out infinite',
              }}
            />
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '26px 26px 0 0',
                background: `linear-gradient(135deg, ${color}2e, ${color}10 45%, transparent)`,
                borderBottom: `1px solid ${color}24`,
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: `linear-gradient(90deg, ${color}, transparent)`,
                  opacity: 0.7,
                }}
              />
              <div
                className="dm-icon-box"
                aria-hidden="true"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: -0.3 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>{subtitle}</div>}
              </div>
              {spark && <Sparkline data={spark.data} color={spark.color || color} />}
              {stale && staleColor && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '5px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    color: staleColor,
                    background: `${staleColor}1c`,
                    border: `1px solid ${staleColor}44`,
                    animation: 'diary-badge-in 0.25s ease-out',
                  }}
                  title="Давность последней записи"
                >
                  🕒 {daysAgoLabel(stale.days)}
                </span>
              )}
              <button
                type="button"
                className="dm-close-btn"
                onClick={onClose}
                aria-label="Закрыть"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${colors.borderHover}`,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  flexShrink: 0,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                ✕
              </button>
            </div>
            <div className="dm-body" style={{ padding: 18, overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>{children}</div>
            {footer ?? (
              <div style={{ display: 'flex', gap: 10, padding: '16px 20px 20px', borderTop: `1px solid ${color}24`, flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
                {fill && fill.total > 0 && (
                  <div
                    title={`Заполнено ${fill.current}/${fill.total}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, marginRight: 4,
                    }}
                  >
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (fill.current / fill.total) * 100)}%`,
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${color}88, ${color})`,
                          transition: 'width 0.35s cubic-bezier(0.32, 0.72, 0.28, 1)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted, whiteSpace: 'nowrap' }}>
                      {fill.current}/{fill.total}
                    </span>
                  </div>
                )}
                <button type="button" className="dm-ghost-btn" onClick={onClose} style={btnGhost}>Отмена</button>
                <button type="submit" className="dm-primary-btn" style={btnPrimary(color)}>
                  💾 Сохранить <span className="dm-save-arrow" style={{ display: 'inline-block', transition: 'transform 0.15s' }}>→</span>
                </button>
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
        padding: '9px 13px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        cursor: isToday ? 'default' : 'pointer',
        border: `1px solid ${isToday ? 'rgba(34,197,94,0.35)' : colors.border}`,
        background: isToday ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
        color: isToday ? '#22c55e' : colors.textMuted,
        flexShrink: 0,
        minHeight: 46,
        transition: 'all 0.15s',
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
        gap: 7,
        padding: '8px 13px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        border: `1px solid ${colors.border}`,
        background: 'rgba(255,255,255,0.04)',
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
export { AddBodyMeasurementsModal, AddWeightModal } from './body-measurements-modal';
export { AddInjectionModal } from './injection-diary-modal';
export { AddHealthModal } from './health-diary-modal';
export { AddCardioModal } from './cardio-diary-modal';
