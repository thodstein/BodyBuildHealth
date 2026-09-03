/**
 * diary-ui.tsx — единый дизайн-система для дневников Профиля v2
 * Централизованные UI-компоненты, стили и темы для всех дневников
 */

import React from 'react';
import { colors } from './ui';
import type { DiaryKey } from './diary-helpers';

/* ── Цветовые токены для дневников ───────────────────────────────────────── */

export const DIARY_COLORS: Record<DiaryKey, { primary: string; background: string; border: string; icon: string }> = {
  sleep: { primary: '#a78bfa', background: '#a78bfa28', border: '#a78bfa55', icon: '💤' },
  bp: { primary: '#ef4444', background: '#ef444428', border: '#ef444455', icon: '❤️' },
  weight: { primary: '#22c55e', background: '#22c55e28', border: '#22c55e55', icon: '⚖️' },
  injection: { primary: '#f59e0b', background: '#f59e0b28', border: '#f59e0b55', icon: '💉' },
  health: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: '🩺' },
  cardio: { primary: '#4ade80', background: '#4ade8028', border: '#4ade8055', icon: '❤️' },
  measurements: { primary: '#22c55e', background: '#22c55e28', border: '#22c55e55', icon: '⚖️' },
  symptoms: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: '🩺' },
  pain: { primary: '#f59e0b', background: '#f59e0b28', border: '#f59e0b55', icon: '🦴' },
  neuro: { primary: '#a78bfa', background: '#a78bfa28', border: '#a78bfa55', icon: '🧠' },
  acne: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: '🔴' },
  hemato: { primary: '#3b82f6', background: '#3b82f628', border: '#3b82f655', icon: '🩸' },
};

export const DIARY_META: Record<DiaryKey, { title: string; unit: string; icon: string; color: string; storageKey?: string }> = {
  sleep: { title: 'Сон', unit: 'ч', icon: '💤', color: '#a78bfa', storageKey: 'he_sleep_diary' },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: '❤️', color: '#ef4444', storageKey: 'he_bp_diary' },
  weight: { title: 'Вес и замеры', unit: 'кг / см', icon: '⚖️', color: '#22c55e' },
  injection: { title: 'Инъекции', unit: '', icon: '💉', color: '#f59e0b', storageKey: 'he_injection_diary' },
  health: { title: 'Здоровье', unit: '', icon: '🩺', color: '#ec4899', storageKey: 'he_health_diary' },
  cardio: { title: 'Кардио', unit: 'мин', icon: '❤️', color: '#4ade80', storageKey: 'he_cardio_sessions' },
  measurements: { title: 'Замеры', unit: 'см', icon: '⚖️', color: '#22c55e' },
  symptoms: { title: 'Симптомы', unit: '', icon: '🩺', color: '#ec4899', storageKey: 'he_symptoms_diary' },
  pain: { title: 'Боль', unit: '', icon: '🦴', color: '#f59e0b', storageKey: 'he_pain_diary' },
  neuro: { title: 'Нейро', unit: '', icon: '🧠', color: '#a78bfa', storageKey: 'he_neuro_diary' },
  acne: { title: 'Акне', unit: '', icon: '🔴', color: '#ec4899', storageKey: 'he_acne_diary' },
  hemato: { title: 'Гематология', unit: '', icon: '🩸', color: '#3b82f6', storageKey: 'he_hemato_diary' },
};

/* ── Общие стили ─────────────────────────────────────────────────────────── */

export const cardStyles = {
  base: {
    borderRadius: 14,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    cursor: 'pointer',
    minHeight: 110,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'transform 0.18s cubic-bezier(0.32,0.72,0.28,1), box-shadow 0.18s, background 0.18s',
    position: 'relative',
    overflow: 'hidden',
  } as React.CSSProperties,
  stale: (color: string) => ({
    background: `linear-gradient(135deg, ${color}14, transparent)`,
    border: `1px solid ${color}77`,
    borderLeft: `3px solid ${color}`,
    boxShadow: `0 4px 14px ${color}22, 0 2px 8px rgba(0,0,0,0.3)`,
  } as React.CSSProperties),
  normal: (color: string) => ({
    background: 'rgba(28,28,32,0.85)',
    border: `1px solid ${color}44`,
    borderLeft: `3px solid ${color}`,
    boxShadow: '0 4px 14px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25)',
  } as React.CSSProperties),
  hover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
  leave: {
    transform: 'translateY(0)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  } as React.CSSProperties,
};

/* ── Иконки-бейджи ───────────────────────────────────────────────────────── */

export const isWeightDiaryKey = (_k: string) => false;

export const iconBadge = (color: string, _diaryKey?: string) => ({
  width: 40,
  height: 40,
  borderRadius: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `${color}22`,
  border: `1px solid ${color}44`,
  fontSize: 20,
  lineHeight: 1,
  flexShrink: 0,
  boxShadow: `0 2px 10px ${color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
} as React.CSSProperties);

/* ── Статус-чипы (заполнено/сегодня/устарело) ────────────────────────────── */

export const statusChip = (color: string, filled: boolean) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: 'pointer',
  background: filled ? `${color}33` : 'rgba(255,255,255,0.04)',
  border: `1px solid ${filled ? color : 'rgba(255,255,255,0.08)'}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  transition: 'all 0.15s',
} as React.CSSProperties);

/* ── Прогресс-бар (для WeeklyHistogram с целями) ─────────────────────────── */

export const progressBar = (status: 'met' | 'exceeded' | 'below' | undefined, color: string) => ({
  height: '100%',
  borderRadius: 4,
  transition: 'height 0.3s',
  background:
    status === 'met' ? `linear-gradient(180deg, #22c55e, #16a34a)` :
    status === 'exceeded' ? `linear-gradient(180deg, #4ade80, #22c55e)` :
    status === 'below' ? `linear-gradient(180deg, #f59e0b, #d97706)` :
    `linear-gradient(180deg, ${color}, ${color}dd)`,
  opacity: 0.9,
} as React.CSSProperties);

/* ── Форма-баннеры (warning/info/error) ──────────────────────────────────── */

export const formBanner = (tone: 'info' | 'warning' | 'error', children: React.ReactNode) => (
  <div
    style={{
      padding: '8px 10px',
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 600,
      background:
        tone === 'warning' ? 'rgba(245,158,11,0.12)' :
        tone === 'error' ? 'rgba(239,68,68,0.12)' :
        'rgba(59,130,246,0.12)',
      border: `1px solid ${tone === 'warning' ? '#f59e0b44' : tone === 'error' ? '#ef444444' : '#3b82f644'}`,
      color: tone === 'warning' ? '#fbbf24' : tone === 'error' ? '#fca5a5' : '#93c5fd',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    {tone === 'warning' && <span>⚠</span>}
    {tone === 'error' && <span>✕</span>}
    {tone === 'info' && <span>ℹ</span>}
    {children}
  </div>
);

/* ── Кнопки ──────────────────────────────────────────────────────────────── */

export const btnPrimary = (color: string) => ({
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
} as React.CSSProperties);

export const btnGhost = {
  flex: 1,
  minHeight: 46,
  padding: '10px 18px',
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 700,
  background: 'rgba(255,255,255,0.055)',
  color: '#ffffff',
  border: `1px solid rgba(255,255,255,0.16)`,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
} as React.CSSProperties;

export const btnDanger = {
  ...btnPrimary('#ef4444'),
  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
} as React.CSSProperties;

/* ── Поля ввода ──────────────────────────────────────────────────────────── */

export const fieldLabel = {
  fontSize: 11,
  color: '#ffffff',
  fontWeight: 700,
  marginBottom: 5,
  display: 'block',
  letterSpacing: 0.5,
} as React.CSSProperties;

export const fieldInput = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 14,
  padding: '12px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: 46,
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
} as React.CSSProperties;

/* ── SectionCard ────────────────────────────────────────────────────────── */

export interface SectionCardProps {
  icon?: string;
  title: string;
  color: string;
  badge?: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  icon,
  title,
  color,
  badge,
  hint,
  children,
  style,
}) => (
  <div
    className="diary-section"
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 18, display: 'inline-block', lineHeight: 1 }}>{icon}</span>}
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: `${color}33`, color }}>{badge}</span>}
    </div>
    {hint && <div style={{ fontSize: 11, color: '#ffffff', marginBottom: 10 }}>{hint}</div>}
    {children}
  </div>
);

/* ── DiaryCard — единая карточка дневника ────────────────────────────────── */

export interface DiaryCardProps {
  diaryKey: DiaryKey;
  count: number;
  last: string;
  daysSinceLast: number | null;
  loggedToday: boolean;
  onAdd: () => void;
  onOpen: () => void;
  extra?: string;
  history?: { date: string }[];
  largeIcon?: boolean;
}

export const DiaryCard: React.FC<DiaryCardProps> = ({
  diaryKey,
  count,
  last,
  daysSinceLast,
  loggedToday,
  onAdd,
  onOpen,
  extra,
  history,
  largeIcon = false,
}) => {
  const meta = DIARY_META[diaryKey] || { title: diaryKey, color: colors.textMuted, icon: '📓' };
  const stale = daysSinceLast !== null && daysSinceLast >= 3 && !loggedToday;
  const staleColor =
    daysSinceLast !== null && daysSinceLast >= 14
      ? '#ef4444'
      : daysSinceLast !== null && daysSinceLast >= 7
        ? '#f97316'
        : daysSinceLast !== null && daysSinceLast >= 3
          ? '#f59e0b'
          : meta.color;

  const showLargeIcon = largeIcon || count === 0;

  return (
    showLargeIcon ? (
      // Large icon state (empty or forced for weight/measurements)
      <div
        onClick={onOpen}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Открыть дневник «${meta.title}»`}
        className="diary-card"
        data-diary={diaryKey}
        data-stale={stale}
        style={{
          ...cardStyles.base,
          ...cardStyles.normal(meta.color),
          borderLeftColor: meta.color,
          borderColor: `${meta.color}44`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '26px 16px 20px', gap: 12 }}>
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `radial-gradient(120% 120% at 30% 20%, ${meta.color}22, ${meta.color}10 55%, transparent 75%)`,
              border: `1px solid ${meta.color}2a`,
              boxShadow: `0 8px 24px ${meta.color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
              fontSize: 32,
              lineHeight: 1,
            }}
          >
            <span style={{ display: 'inline-block', lineHeight: 1 }}>{meta.icon}</span>
          </div>
          <div style={{ textAlign: 'center', gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{meta.title}</div>
            {count === 0 ? (
              <>
                <div style={{ fontSize: 12, color: '#ffffff' }}>
                  {meta.unit ? `Единицы: ${meta.unit}` : 'Ещё нет записей'}
                </div>
                <div style={{ fontSize: 11, color: '#ffffff', marginTop: 8 }}>
                  Нажмите «+ Добавить» для первой записи
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#ffffff' }}>
                  {count} {count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}
                </div>
                <div style={{ fontSize: 11, color: '#ffffff', marginTop: 4 }}>
                  Последняя: {last}
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, width: '100%', justifyContent: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              aria-label={`Добавить запись в дневник ${meta.title}`}
              style={{
                flex: 1,
                minHeight: 40,
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                background: `${meta.color}26`,
                color: meta.color,
                border: `1px solid ${meta.color}55`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${meta.color}44`;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              + Добавить первую запись
            </button>
            <button
              onClick={onOpen}
              aria-label={`Открыть дневник ${meta.title}`}
              style={{
                flex: 1,
                minHeight: 40,
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.04)',
                color: '#ffffff',
                border: `1px solid rgba(255,255,255,0.16)`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              📋 Открыть дневник
            </button>
          </div>
        </div>
      </div>
      ) : (
        <div
          onClick={onOpen}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Открыть дневник «${meta.title}»`}
          className="diary-card"
          data-diary={diaryKey}
          data-stale={stale}
          style={{
            ...cardStyles.base,
            ...(stale ? cardStyles.stale(staleColor) : cardStyles.normal(meta.color)),
            borderLeftColor: stale ? staleColor : meta.color,
            borderColor: stale ? `${staleColor}77` : `${meta.color}44`,
            background: stale ? `linear-gradient(135deg, ${staleColor}14, transparent)` : 'rgba(28,28,32,0.85)',
            boxShadow: stale
              ? `0 4px 14px ${staleColor}22, 0 2px 8px rgba(0,0,0,0.3)`
              : '0 4px 14px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25)',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div aria-hidden="true" style={iconBadge(meta.color, diaryKey)}>
              <span style={{ display: 'inline-block', lineHeight: 1 }}>{meta.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{meta.title}</span>
                {stale && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: `${staleColor}22`,
                      color: staleColor,
                      border: `1px solid ${staleColor}44`,
                    }}
                  >
                    {daysSinceLast !== null ? `${daysSinceLast} дн. назад` : 'устарел'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#ffffff', marginTop: 2 }}>
                {count} {count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <span style={{ fontSize: 18, display: 'inline-block', lineHeight: 1 }}>{meta.icon}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ ...statusChip(meta.color, true), flexShrink: 0 }}>
              {count > 0 ? '✓' : '+'}
            </span>
            {extra && <span style={{ fontSize: 11, color: '#ffffff', flex: 1 }}>{extra}</span>}
          </div>

          {history && history.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: '#ffffff', marginBottom: 4 }}>История (последние 5):</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {history.slice(0, 5).map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.date}
                  </div>
                ))}
              </div>
            </div>
          )}

          {extra && (
            <div style={{ fontSize: 9.5, color: meta.color, lineHeight: 1.35, marginTop: -4 }}>{extra}</div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onAdd}
              aria-label={`Добавить запись в дневник ${meta.title}`}
              style={{
                flex: 1,
                minHeight: 30,
                padding: '6px 8px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                background: `${meta.color}26`,
                color: meta.color,
                border: `1px solid ${meta.color}55`,
                cursor: 'pointer',
              }}
            >
              + Добавить
            </button>
            <button
              onClick={onOpen}
              aria-label={`Открыть дневник ${meta.title}`}
              style={{
                flex: 1,
                minHeight: 30,
                padding: '6px 8px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                background: 'transparent',
                color: '#ffffff',
                border: `1px solid rgba(255,255,255,0.16)`,
                cursor: 'pointer',
              }}
            >
              📋 Открыть
            </button>
          </div>
        </div>
      )
    );
};

/* ── Export ──────────────────────────────────────────────────────────────── */

export * from './diary-helpers';
// ВНИМАНИЕ: `export * from './diary-modals'` здесь ЗАПРЕЩЁН.
// diary-modals дублирует 6 имён этого файла (DIARY_META, SectionCard,
// btnGhost, btnPrimary, fieldInput, fieldLabel): звезда резолвится
// по-разному в dev-SSR и прод-бандле (тесты видели чужой SectionCard).
// Канон — ЛОКАЛЬНЫЕ версии ниже; из diary-modals реэкспортим всё остальное явно.
export type {
  UndoAction,
  RoutineKind,
  RoutineStepId,
  ActiveRoutine,
} from './diary-modals';
export {
  pushUndoAction,
  topUndo,
  dismissTopUndo,
  nextRoutineStep,
  ROUTINE_STEPS,
  routineNextStep,
  routineStepIndex,
  ROUTINE_STEP_LABELS,
  ROUTINE_KIND_LABELS,
  migrateLegacyRoutine,
  daysAgoLabel,
  staleColorFor,
  daysSince,
  readDiaryEntries,
  lastEntryOf,
  findByDate,
  findByDateAndSubstance,
  useDiaryDraft,
  PAIN_ZONES,
  NEURO_SYMPTOMS,
  ACNE_AREAS,
  HEMATO_SYMPTOMS,
  painZoneColor,
  acneAreaColor,
  LiveBadge,
  FormBanner,
  Sparkline,
  ScalePicker,
  StepperInput,
  ChipGroup,
  TextField,
  DiaryModalShell,
  Modal,
  DateInput,
  TodayChip,
  RepeatLastChip,
  AddSleepModal,
  AddBPModal,
  bpCategory,
  AddBodyMeasurementsModal,
  AddWeightModal,
  AddInjectionModal,
  AddHealthModal,
  AddCardioModal,
} from './diary-modals';