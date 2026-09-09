/**
 * diary-ui.tsx — единый дизайн-система для дневников Профиля v2
 * Централизованные UI-компоненты, стили и темы для всех дневников
 */

import React from 'react';
import { colors, withAlpha } from './ui';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';
import type { DiaryKey } from './diary-helpers';

/* ── Цветовые токены для дневников ───────────────────────────────────────── */

export const DIARY_COLORS: Record<DiaryKey, { primary: string; background: string; border: string; icon: NativeIconName }> = {
  sleep: { primary: '#a78bfa', background: '#a78bfa28', border: '#a78bfa55', icon: 'moon' },
  bp: { primary: '#ef4444', background: '#ef444428', border: '#ef444455', icon: 'heart' },
  weight: { primary: '#22c55e', background: '#22c55e28', border: '#22c55e55', icon: 'kettlebell' },
  injection: { primary: '#f59e0b', background: '#f59e0b28', border: '#f59e0b55', icon: 'syringe' },
  health: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: 'cross' },
  cardio: { primary: '#4ade80', background: '#4ade8028', border: '#4ade8055', icon: 'activity' },
  measurements: { primary: '#22c55e', background: '#22c55e28', border: '#22c55e55', icon: 'ruler' },
  symptoms: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: 'eye' },
  pain: { primary: '#f59e0b', background: '#f59e0b28', border: '#f59e0b55', icon: 'zap' },
  neuro: { primary: '#a78bfa', background: '#a78bfa28', border: '#a78bfa55', icon: 'cpu' },
  acne: { primary: '#ec4899', background: '#ec489928', border: '#ec489955', icon: 'dot' },
  hemato: { primary: '#3b82f6', background: '#3b82f628', border: '#3b82f655', icon: 'droplet' },
};

export const DIARY_META: Record<DiaryKey, { title: string; unit: string; icon: NativeIconName; color: string; storageKey?: string }> = {
  sleep: { title: 'Сон', unit: 'ч', icon: 'moon', color: '#a78bfa', storageKey: 'he_sleep_diary' },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: 'heart', color: '#ef4444', storageKey: 'he_bp_diary' },
  weight: { title: 'Вес и замеры', unit: 'кг / см', icon: 'kettlebell', color: '#22c55e' },
  injection: { title: 'Инъекции', unit: '', icon: 'syringe', color: '#f59e0b', storageKey: 'he_injection_diary' },
  health: { title: 'Здоровье', unit: '', icon: 'cross', color: '#ec4899', storageKey: 'he_health_diary' },
  cardio: { title: 'Кардио', unit: 'мин', icon: 'activity', color: '#4ade80', storageKey: 'he_cardio_sessions' },
  measurements: { title: 'Замеры', unit: 'см', icon: 'ruler', color: '#22c55e' },
  symptoms: { title: 'Симптомы', unit: '', icon: 'eye', color: '#ec4899', storageKey: 'he_symptoms_diary' },
  pain: { title: 'Боль', unit: '', icon: 'zap', color: '#f59e0b', storageKey: 'he_pain_diary' },
  neuro: { title: 'Нейро', unit: '', icon: 'cpu', color: '#a78bfa', storageKey: 'he_neuro_diary' },
  acne: { title: 'Акне', unit: '', icon: 'dot', color: '#ec4899', storageKey: 'he_acne_diary' },
  hemato: { title: 'Гематология', unit: '', icon: 'droplet', color: '#3b82f6', storageKey: 'he_hemato_diary' },
};

/* ── Общие стили ─────────────────────────────────────────────────────────── */

export const cardStyles = {
  base: {
    borderRadius: 18,
    padding: '15px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    cursor: 'pointer',
    minHeight: 124,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    transition: 'transform 0.18s cubic-bezier(0.32,0.72,0.28,1), box-shadow 0.18s, background 0.18s',
    position: 'relative',
    overflow: 'hidden',
  } as React.CSSProperties,
  stale: (color: string) => ({
    background: `linear-gradient(135deg, ${withAlpha(color, '16')}, ${withAlpha(color, '05')} 55%, rgba(255,255,255,0.02))`,
    border: `1px solid ${withAlpha(color, '55')}`,
    borderLeft: `3px solid ${color}`,
    boxShadow: `0 8px 24px ${withAlpha(color, '20')}, 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
  } as React.CSSProperties),
  normal: (color: string) => ({
    background: 'linear-gradient(180deg, rgba(30,30,36,0.9), rgba(18,18,22,0.9))',
    border: `1px solid ${withAlpha(color, '38')}`,
    borderLeft: `3px solid ${color}`,
    boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px ${withAlpha(color, '08')}, inset 0 1px 0 rgba(255,255,255,0.06)`,
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
  width: 44,
  height: 44,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${withAlpha(color, '30')}, ${withAlpha(color, '10')})`,
  border: `1px solid ${withAlpha(color, '45')}`,
  fontSize: 20,
  lineHeight: 1,
  flexShrink: 0,
  color: '#fff',
  boxShadow: `0 4px 14px ${withAlpha(color, '25')}, inset 0 1px 0 rgba(255,255,255,0.12)`,
} as React.CSSProperties);

/* ── Статус-чипы (заполнено/сегодня/устарело) ────────────────────────────── */

export const statusChip = (color: string, filled: boolean) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: 'pointer',
  background: filled ? `${withAlpha(color, '33')}` : 'rgba(255,255,255,0.04)',
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
    `linear-gradient(180deg, ${color}, ${withAlpha(color, 'dd')})`,
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
  background: `linear-gradient(135deg, ${color}, ${withAlpha(color, '99')})`,
  color: '#08120c',
  border: 'none',
  cursor: 'pointer',
  boxShadow: `0 5px 18px ${withAlpha(color, '38')}, inset 0 1px 0 rgba(255,255,255,0.32)`,
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
  fontSize: 12,
  color: '#ffffff',
  fontWeight: 800,
  marginBottom: 6,
  display: 'block',
  letterSpacing: 0.2,
} as React.CSSProperties;

export const fieldInput = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 14,
  padding: '12px 14px',
  color: '#fff',
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: 48,
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
      borderRadius: 20,
      background: `linear-gradient(180deg, ${withAlpha(color, '13')}, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.025))`,
      border: `1px solid ${withAlpha(color, '30')}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.25)`,
      padding: 17,
      marginBottom: 13,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      {icon && <span style={{ fontSize: 19, display: 'inline-block', lineHeight: 1 }}>{icon}</span>}
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</h3>
      {badge && <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: `${withAlpha(color, '30')}`, color: '#fff', border: `1px solid ${withAlpha(color, '40')}` }}>{badge}</span>}
    </div>
    {hint && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginBottom: 11, lineHeight: 1.5 }}>{hint}</div>}
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
  const meta = DIARY_META[diaryKey] || { title: diaryKey, color: colors.textMuted, icon: 'notebook' as NativeIconName };
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
            <span style={{ display: 'inline-block', lineHeight: 1 }}><NativeIcon name={meta.icon} size={32} /></span>
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
              className="diary-card-add"
              style={{
                flex: 1,
                minHeight: 44,
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
            >
              + Добавить первую запись
            </button>
            <button
              onClick={onOpen}
              aria-label={`Открыть дневник ${meta.title}`}
              className="diary-card-open"
              style={{
                flex: 1,
                minHeight: 44,
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
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div aria-hidden="true" style={iconBadge(meta.color, diaryKey)}>
              <span style={{ display: 'inline-block', lineHeight: 1 }}><NativeIcon name={meta.icon} size={21} /></span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{meta.title}</span>
                {stale && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: `${staleColor}22`,
                      color: '#fff',
                      border: `1px solid ${staleColor}55`,
                      letterSpacing: '0.2px',
                    }}
                  >
                    {daysSinceLast !== null ? `${daysSinceLast} дн. назад` : 'устарел'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                {count} {count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}
                {last ? ` · ${last}` : ''}
              </div>
            </div>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${meta.color}14`, border: `1px solid ${meta.color}30`, color: '#fff' }}>
              <span style={{ display: 'inline-block', lineHeight: 1 }}><NativeIcon name={meta.icon} size={16} /></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            <span style={{ ...statusChip(meta.color, true), flexShrink: 0 }}>
              {count > 0 ? '✓' : '+'}
            </span>
            {extra && <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', flex: 1, lineHeight: 1.45 }}>{extra}</span>}
          </div>

          {history && history.length > 0 && (
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.7px', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>ИСТОРИЯ · ПОСЛЕДНИЕ 5</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {history.slice(0, 5).map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '4px 9px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'rgba(255,255,255,0.8)',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {h.date}
                  </div>
                ))}
              </div>
            </div>
          )}

          {extra && (
            <div style={{ fontSize: 10, color: meta.color, lineHeight: 1.4, marginTop: -4 }}>{extra}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 2 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onAdd}
              aria-label={`Добавить запись в дневник ${meta.title}`}
              className="diary-card-add"
              style={{
                flex: 1,
                minHeight: 44,
                padding: '9px 10px',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}12)`,
                color: '#fff',
                border: `1px solid ${meta.color}55`,
                boxShadow: `0 4px 14px ${meta.color}22, inset 0 1px 0 rgba(255,255,255,0.1)`,
                cursor: 'pointer',
              }}
            >
              + Добавить
            </button>
            <button
              onClick={onOpen}
              aria-label={`Открыть дневник ${meta.title}`}
              className="diary-card-open"
              style={{
                flex: 1,
                minHeight: 44,
                padding: '9px 10px',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 700,
                background: 'rgba(255,255,255,0.05)',
                color: '#ffffff',
                border: `1px solid rgba(255,255,255,0.13)`,
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