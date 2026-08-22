/**
 * ProfileDiariesTab — вкладка "Дневники".
 * Встроенные дневники (в Профиле) с кнопками добавления записей + быстрый доступ
 * к дневникам в других блоках (открывает конкретный дневник/отчёт).
 */
import React, { useState, useEffect } from 'react';
import { getWeightLog, saveWeightLog, WEIGHT_LOG_KEY } from '../../../engines/profile-store';
import { readDiaryEntries, saveDiaryEntries } from '../../../engines/diary-storage';
import { useProfileRefresh } from '../../../core/profile-manager';
import { AccordionSection, colors } from './ui';
import {
  dailyCompletion,
  computePace,
  currentStreak,
  todayIso,
  type DiaryKey,
} from './diary-helpers';
import { SleepDiary } from './diaries/SleepDiary/SleepDiary';
import { BPDiary } from './diaries/BPDiary/BPDiary';
import { WeightDiary } from './diaries/WeightDiary/WeightDiary';
import { InjectionDiary } from './diaries/InjectionDiary/InjectionDiary';
import { HealthDiary } from './diaries/HealthDiary/HealthDiary';
import { CardioDiary } from './diaries/CardioDiary/CardioDiary';
import {
  AddSleepModal,
  AddBPModal,
  AddBodyMeasurementsModal,
  AddInjectionModal,
  AddHealthModal,
  PAIN_ZONES,
  NEURO_SYMPTOMS,
  ACNE_AREAS,
  HEMATO_SYMPTOMS,
  DIARY_META,
  pushUndoAction,
  topUndo,
  dismissTopUndo,
  ROUTINE_STEPS,
  routineNextStep,
  routineStepIndex,
  ROUTINE_STEP_LABELS,
  ROUTINE_KIND_LABELS,
  migrateLegacyRoutine,
  type ActiveRoutine,
  type UndoAction,
} from './diary-modals';
import {
  getUnifiedHealthEntries,
  saveUnifiedHealthEntries,
  mergeHealthEntry,
  type UnifiedHealthEntry,
} from '../../../engines/health-diary.engine';
import {
  commitBpEntries,
  getBpEntries,
  generateEntryId,
  type BPEntry as CoreBPEntry,
} from '../../../core/bp-hr-data';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';

/* ── Типы для встроенных дневников ── */

const SLEEP_DIARY_KEY = 'he_sleep_diary';
interface SleepEntry {
  date: string;
  hours: number;
  quality: number;
  awakenings: number;
  bedtime: string;
  wakeTime: string;
  notes?: string;
}
const BP_DIARY_KEY = 'he_bp_diary';
interface BPEntry {
  id?: string;
  date: string;
  timestamp?: number;
  systolic: number;
  diastolic: number;
  hr?: number;
  pulse?: number;
  timeOfDay?: string;
  arm?: 'left' | 'right' | string;
  position?: 'sitting' | 'lying' | 'standing' | string;
  symptoms?: string[];
  medicationTaken?: boolean;
  notes?: string;
}
const INJECTION_DIARY_KEY = 'he_injection_diary';
interface InjectionEntry {
  date: string;
  substance: string;
  dose: string;
  site: string;
  notes?: string;
}
const SYMPTOMS_DIARY_KEY = 'he_symptoms_diary';
export interface SymptomEntry {
  date: string;
  name: string;
  severity: 1 | 2 | 3 | 4 | 5;
  duration?: string;
  notes?: string;
}
const PAIN_DIARY_KEY = 'he_pain_diary';
export interface PainEntry {
  date: string;
  zones: Record<string, number>;
  totalScore: number;
  notes?: string;
}
const NEURO_DIARY_KEY = 'he_neuro_diary';
export interface NeuroEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}
const ACNE_DIARY_KEY = 'he_acne_diary';
export interface AcneEntry {
  date: string;
  areas: Record<string, number>;
  totalScore: number;
  notes?: string;
}
const HEMATO_DIARY_KEY = 'he_hemato_diary';
export interface HematoEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}
const HEALTH_DIARY_KEY = 'he_health_diary';

interface BuiltInDiaryRow {
  key: DiaryKey;
  count: number;
  last: string;
}

/* ── Хелперы localStorage (единый слой — diary-storage.ts) ── */

function loadDiary<T>(key: string): T[] {
  return readDiaryEntries<T>(key);
}
function saveDiary<T>(key: string, data: T[]): void {
  saveDiaryEntries<T>(key, data);
}

function latestDiaryDate(arr: { date: string; timestamp?: number }[]): string {
  return [...arr]
    .sort((a, b) => (b.timestamp ?? new Date(b.date).getTime()) - (a.timestamp ?? new Date(a.date).getTime()))[0]?.date || '';
}

/* ── Модалки добавления записей ── */
const DiaryCard: React.FC<{
  diaryKey: DiaryKey;
  count: number;
  last: string;
  daysSinceLast: number | null;
  loggedToday: boolean;
  onAdd: () => void;
  onOpen: () => void;
  extra?: string;
}> = ({ diaryKey, count, last, daysSinceLast, loggedToday, onAdd, onOpen, extra }) => {
  const meta = DIARY_META[diaryKey];
  const stale = daysSinceLast !== null && daysSinceLast >= 3 && !loggedToday;
  const staleColor =
    daysSinceLast !== null && daysSinceLast >= 14
      ? '#ef4444'
      : daysSinceLast !== null && daysSinceLast >= 7
        ? '#f97316'
        : daysSinceLast !== null && daysSinceLast >= 3
          ? '#f59e0b'
          : meta.color;
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Открыть дневник «${meta.title}»`}
      style={{
        background: stale ? `${staleColor}14` : 'rgba(28,28,32,0.75)',
        border: `1px solid ${stale ? `${staleColor}77` : `${meta.color}44`}`,
        borderRadius: 14,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        minHeight: 110,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
        position: 'relative',
        overflow: 'hidden',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${meta.color}28`,
            border: `1px solid ${meta.color}55`,
            fontSize: 20,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: colors.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meta.title}
          </div>
          <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 1 }}>{meta.unit || '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: meta.color,
              background: `${meta.color}22`,
              padding: '2px 7px',
              borderRadius: 5,
              border: `1px solid ${meta.color}33`,
            }}
          >
            {count}
          </span>
          {loggedToday && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(34,197,94,0.18)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              ✓ сегодня
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, minHeight: 14, lineHeight: 1.3 }}>
        {last ? (
          <>
            📅 {last}
            {meta.unit ? ' ' + meta.unit : ''}
            {daysSinceLast !== null && daysSinceLast > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: staleColor }}>
                ·{' '}
                {daysSinceLast === 1
                  ? 'вчера'
                  : daysSinceLast < 5
                    ? `${daysSinceLast} дн. назад`
                    : `${daysSinceLast} дней назад`}
              </span>
            )}
          </>
        ) : (
          'Нет записей'
        )}
      </div>
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
            color: colors.text,
            border: `1px solid ${colors.border}`,
            cursor: 'pointer',
          }}
        >
          📋 Открыть
        </button>
      </div>
    </div>
  );
};

/* ── Быстрые ссылки на дневники в других блоках ── */

interface QuickLink {
  icon: string;
  label: string;
  target: string;
  color: string;
  desc?: string;
}

let undoTimer: ReturnType<typeof setTimeout> | null = null;

const Snackbar: React.FC<{ action: UndoAction | null; onUndo: () => void; onDismiss: () => void }> = ({
  action,
  onUndo,
  onDismiss,
}) => {
  useEffect(() => {
    if (!action) return;
    if (undoTimer) clearTimeout(undoTimer);
    const remaining = Math.max(0, action.expiresAt - Date.now());
    undoTimer = setTimeout(onDismiss, remaining);
    return () => {
      if (undoTimer) {
        clearTimeout(undoTimer);
        undoTimer = null;
      }
    };
  }, [action, onDismiss]);
  if (!action) return null;
  const remaining = Math.max(0, action.expiresAt - Date.now());
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 80,
        zIndex: 1100,
        maxWidth: 480,
        margin: '0 auto',
        background: 'rgba(22,22,28,0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 16,
        padding: '10px 14px 8px',
        boxShadow: '0 14px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'snackbar-in 0.28s cubic-bezier(0.32, 0.72, 0.28, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: 600 }}>{action.label}</span>
        <button
          onClick={onUndo}
          style={{
            background: 'linear-gradient(135deg, #00e68a, #00c478)',
            border: 'none',
            color: '#04120c',
            padding: '7px 14px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            minHeight: 36,
            boxShadow: '0 3px 12px rgba(0,230,138,0.3)',
            flexShrink: 0,
          }}
        >
          ↩ Отменить
        </button>
        <button
          onClick={onDismiss}
          aria-label="Закрыть уведомление"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            cursor: 'pointer',
            minWidth: 32,
            minHeight: 36,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.07)',
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #00e68a, #60a5fa)',
            animation: `snackbar-shrink ${Math.max(200, remaining)}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};

const QUICK_DIARY_LINKS: QuickLink[] = [
  {
    icon: '🍽',
    label: 'Дневник питания',
    target: 'nutrition-diary',
    color: colors.green,
    desc: 'Питание: КБЖУ, приёмы, анализ рациона',
  },
  {
    icon: '🏋️',
    label: 'Журнал тренировок',
    target: 'workout-log',
    color: colors.blue,
    desc: 'Тренировочный дневник со снарядами',
  },
  {
    icon: '💊',
    label: 'Мой курс',
    target: 'pharma-course',
    color: colors.warning,
    desc: 'Текущий курс, фазы, дозировки',
  },
  {
    icon: '🛡',
    label: 'Дневник поддержки',
    target: 'support-diary',
    color: colors.purple,
    desc: 'Приём БАДов, протоколы, побочки',
  },
  {
    icon: '🧪',
    label: 'Анализы',
    target: 'labs-diary',
    color: colors.teal,
    desc: 'Результаты лабораторных исследований',
  },
];

const QUICK_REPORT_LINKS: QuickLink[] = [
  {
    icon: '🏋️',
    label: 'Тренер-отчёт',
    target: 'training-analytics',
    color: colors.blue,
    desc: 'Анализ тренировок, прогрессии',
  },
  {
    icon: '💊',
    label: 'Фарма-отчёт',
    target: 'pharma-reports',
    color: colors.warning,
    desc: 'Курс, фазы, перекрёстные риски',
  },
  {
    icon: '🩺',
    label: 'Врач-отчёт',
    target: 'labs-reports',
    color: colors.danger,
    desc: 'Анализы: отклонения, динамика',
  },
  {
    icon: '🍽',
    label: 'Отчёт по питанию',
    target: 'nutrition-reports',
    color: colors.green,
    desc: 'КБЖУ за день/неделю/месяц',
  },
  {
    icon: '🛡',
    label: 'Отчёт поддержки',
    target: 'support-reports',
    color: colors.purple,
    desc: 'Совместимость, побочки',
  },
  { icon: '⚠️', label: 'Отчёт по рискам', target: 'risk-reports', color: '#f97316', desc: 'Риск по системам органов' },
  {
    icon: '📊',
    label: 'Кастомный отчёт',
    target: 'custom-report',
    color: colors.orange,
    desc: 'Сводный отчёт по разделам',
  },
];

/* ── QuickLinkRow (вынесен из тела компонента для предотвращения ре-маунта) ── */

const QuickLinkRow: React.FC<{ links: QuickLink[]; ariaLabel: string; onNavigate?: (s: string) => void }> = ({ links, ariaLabel, onNavigate }) => (
  <div
    role="navigation"
    aria-label={ariaLabel}
    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}
  >
    {links.map((link) => (
      <button
        key={link.target}
        onClick={() => onNavigate?.(link.target)}
        aria-label={`Открыть ${link.label}: ${link.desc || ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 56,
          background: `${link.color}14`,
          border: `1px solid ${link.color}55`,
          color: colors.text,
          transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
          e.currentTarget.style.background = `${link.color}22`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.background = `${link.color}14`;
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${link.color}33`,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {link.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: link.color }}>{link.label}</div>
          {link.desc && (
            <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2, lineHeight: 1.3 }}>{link.desc}</div>
          )}
        </div>
        <span style={{ color: link.color, fontSize: 16, opacity: 0.7 }}>→</span>
      </button>
    ))}
  </div>
);

/* ── Главный компонент ── */

export const ProfileDiariesTab: React.FC<{
  onNavigate?: (screen: string) => void;
  initialView?: string;
}> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const pharmaPhase = (profile.settings as any)?.pharma?.phase as
    'baseline' | 'course' | 'bridge' | 'pct' | 'post_pct' | 'fertility' | undefined;
  const courseStartDate = (profile.settings as any)?.pharma?.courseStartDate as string | undefined;
  const PHASE_LABELS: Record<string, { label: string; color: string }> = {
    baseline: { label: 'Базовая линия', color: '#6b7280' },
    course: { label: 'Курс', color: '#f59e0b' },
    bridge: { label: 'Мост', color: '#a78bfa' },
    pct: { label: 'ПКТ', color: '#8b5cf6' },
    post_pct: { label: 'После ПКТ', color: '#3b82f6' },
    fertility: { label: 'Фертильность', color: '#ec4899' },
  };
  const currentPhase = pharmaPhase ? PHASE_LABELS[pharmaPhase] : null;
  const courseWeek = (() => {
    if (pharmaPhase !== 'course' || !courseStartDate) return null;
    const start = new Date(courseStartDate);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffMs / (7 * 86400000)) + 1);
  })();
  const [activeDiary, setActiveDiary] = useState<DiaryKey | null>(null);

  useEffect(() => {
    if (!activeDiary) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDiary(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDiary]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>([]);
  const [injectionEntries, setInjectionEntries] = useState<InjectionEntry[]>([]);
  const [symptomEntries, setSymptomEntries] = useState<SymptomEntry[]>([]);
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [neuroEntries, setNeuroEntries] = useState<NeuroEntry[]>([]);
  const [acneEntries, setAcneEntries] = useState<AcneEntry[]>([]);
  const [hematoEntries, setHematoEntries] = useState<HematoEntry[]>([]);
  const [healthEntries, setHealthEntries] = useState<UnifiedHealthEntry[]>([]);
  const [weights, setWeights] = useState<ReturnType<typeof getWeightLog>>([]);
  const [cardioLog, setCardioLog] = useState<ReturnType<typeof loadCardioLog>>([]);

  const [addSleepOpen, setAddSleepOpen] = useState(false);
  const [addBPOpen, setAddBPOpen] = useState(false);
  const [addInjectionOpen, setAddInjectionOpen] = useState(false);
  const [addHealthOpen, setAddHealthOpen] = useState(false);
  const [addBodyMeasurementsOpen, setAddBodyMeasurementsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [undoQueue, setUndoQueue] = useState<UndoAction[]>([]);

  const ROUTINE_KEY = 'he_routine_active';
  const [routine, setRoutine] = useState<ActiveRoutine | null>(() => {
    try {
      return migrateLegacyRoutine(sessionStorage.getItem(ROUTINE_KEY));
    } catch {
      return null;
    }
  });
  /** Рутинг персистентен: переживает переключение вкладок и перезагрузку. */
  const setRoutinePersist = (r: ActiveRoutine | null) => {
    setRoutine(r);
    try {
      if (r) sessionStorage.setItem(ROUTINE_KEY, JSON.stringify(r));
      else sessionStorage.removeItem(ROUTINE_KEY);
    } catch {}
  };
  const routineTotal = routine ? ROUTINE_STEPS[routine.kind].length : 0;
  const routineIdx = routine ? Math.max(0, routineStepIndex(routine.kind, routine.step)) : 0;

  /** Завершить текущий шаг рутинга: сохранить, перейти к следующему (открыв его) или закрыть. */
  const advanceRoutine = () => {
    if (!routine) return;
    const next = routineNextStep(routine.kind, routine.step);
    const r = next ? { kind: routine.kind, step: next } : null;
    setRoutinePersist(r);
    if (r) openRoutineStepModal(r);
  };
  /** Открыть модалку текущего шага рутинга. */
  const openRoutineStepModal = (r: ActiveRoutine) => {
    if (r.step === 'sleep') setAddSleepOpen(true);
    else if (r.step === 'bp') setAddBPOpen(true);
    else if (r.step === 'weight') setAddBodyMeasurementsOpen(true);
    else if (r.step === 'health') setAddHealthOpen(true);
  };
  const routineUndoLabel = (action: string) =>
    routine ? `${ROUTINE_KIND_LABELS[routine.kind]} · ${ROUTINE_STEP_LABELS[routine.step]}: ${action}` : action;

  const pushUndo = (label: string, undo: () => void) => {
    setUndoQueue((q) => pushUndoAction(q, label, undo));
  };
  const dismissTopUndoAction = () => {
    setUndoQueue((q) => dismissTopUndo(q));
  };
  const applyTopUndo = () => {
    const top = topUndo(undoQueue);
    if (!top) return;
    top.undo();
    dismissTopUndoAction();
  };

  const setAddXxxOpenForKey = (key: DiaryKey) => {
    if (key === 'sleep') setAddSleepOpen(true);
    else if (key === 'bp') setAddBPOpen(true);
    else if (key === 'weight' || key === 'measurements') setAddBodyMeasurementsOpen(true);
    else if (key === 'injection') setAddInjectionOpen(true);
    else if (key === 'cardio') setActiveDiary('cardio');
    else if (
      key === 'health' ||
      key === 'symptoms' ||
      key === 'pain' ||
      key === 'neuro' ||
      key === 'acne' ||
      key === 'hemato'
    )
      setAddHealthOpen(true);
  };

  interface DiaryGoals {
    sleepHours: number;
    weightKg: number;
    systolicTarget: number;
  }
  const GOALS_KEY = 'he_diary_goals';
  const [goals, setGoals] = useState<DiaryGoals>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || '{}');
      return {
        sleepHours: Number(raw.sleepHours) || 0,
        weightKg: Number(raw.weightKg) || 0,
        systolicTarget: Number(raw.systolicTarget) || 0,
      };
    } catch {
      return { sleepHours: 0, weightKg: 0, systolicTarget: 0 };
    }
  });
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const saveGoals = (next: DiaryGoals) => {
    setGoals(next);
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
    } catch {}
  };

  const refresh = () => {
    try {
      setSleepEntries(loadDiary<SleepEntry>(SLEEP_DIARY_KEY));
    } catch {}
    try {
      setBpEntries(getBpEntries().map((entry): BPEntry => ({
        id: entry.id,
        date: entry.date,
        timestamp: entry.timestamp,
        systolic: entry.systolic,
        diastolic: entry.diastolic,
        hr: entry.hr,
        pulse: entry.hr,
        timeOfDay: entry.timeOfDay,
        arm: entry.arm,
        position: entry.position,
        symptoms: entry.symptoms,
        medicationTaken: entry.medicationTaken,
        notes: entry.notes,
      })));
    } catch {}
    try {
      setInjectionEntries(loadDiary<InjectionEntry>(INJECTION_DIARY_KEY));
    } catch {}
    try {
      setSymptomEntries(loadDiary<SymptomEntry>(SYMPTOMS_DIARY_KEY));
    } catch {}
    try {
      setPainEntries(loadDiary<PainEntry>(PAIN_DIARY_KEY));
    } catch {}
    try {
      setNeuroEntries(loadDiary<NeuroEntry>(NEURO_DIARY_KEY));
    } catch {}
    try {
      setAcneEntries(loadDiary<AcneEntry>(ACNE_DIARY_KEY));
    } catch {}
    try {
      setHematoEntries(loadDiary<HematoEntry>(HEMATO_DIARY_KEY));
    } catch {}
    try {
      setWeights(getWeightLog());
    } catch {}
    setHealthEntries(getUnifiedHealthEntries());
    setCardioLog(loadCardioLog());
  };

  useEffect(() => {
    refresh();
  }, []);

  const lastDate = (arr: { date: string }[]): string => {
    if (arr.length === 0) return '';
    return latestDiaryDate(arr);
  };

  const getEntryArray = (key: DiaryKey): { date: string }[] => {
    if (key === 'sleep') return sleepEntries;
    if (key === 'bp') return bpEntries;
    if (key === 'weight') return weights;
    if (key === 'injection') return injectionEntries;
    if (
      key === 'health' ||
      key === 'symptoms' ||
      key === 'pain' ||
      key === 'neuro' ||
      key === 'acne' ||
      key === 'hemato'
    )
      return healthEntries;
    return [];
  };

  const daysSinceLast = (arr: { date: string }[]): number | null => {
    if (arr.length === 0) return null;
    const last = new Date(latestDiaryDate(arr));
    if (isNaN(last.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - last.getTime()) / 86400000);
  };

  const todayEntry = (arr: { date: string }[]): boolean => {
    if (arr.length === 0) return false;
    return latestDiaryDate(arr) === todayIso();
  };

  const buildTodayOverview = () => {
    const today = todayIso();
    const overview: { label: string; value: string; color: string }[] = [];
    if (sleepEntries.length) {
      const e = [...sleepEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (e.date === today) overview.push({ label: 'Сон', value: `${e.hours} ч`, color: '#a78bfa' });
    }
    if (bpEntries.length) {
      const e = [...bpEntries].sort((a, b) => (b.timestamp ?? new Date(b.date).getTime()) - (a.timestamp ?? new Date(a.date).getTime()))[0];
      if (e.date === today) overview.push({ label: 'АД', value: `${e.systolic}/${e.diastolic}`, color: '#ef4444' });
      // ЧСС ведётся в записях АД (поле «Пульс»): утро/вечер отдельными замерами.
      const todayBp = bpEntries.filter((x) => x.date === today);
      const morningPulse = todayBp.find((x) => x.timeOfDay === 'morning' && (x.hr ?? x.pulse ?? 0) > 0);
      const eveningPulse = todayBp.find((x) => x.timeOfDay === 'evening' && (x.hr ?? x.pulse ?? 0) > 0);
      if (morningPulse) overview.push({ label: 'ЧСС утро', value: `${morningPulse.hr ?? morningPulse.pulse} уд/мин`, color: '#f472b6' });
      if (eveningPulse) overview.push({ label: 'ЧСС вечер', value: `${eveningPulse.hr ?? eveningPulse.pulse} уд/мин`, color: '#f472b6' });
    }
    if (weights.length) {
      const e = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (e.date === today) overview.push({ label: 'Вес', value: `${e.weight} кг`, color: '#22c55e' });
    }
    if (painEntries.length) {
      const e = [...painEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (e.date === today)
        overview.push({
          label: 'Суставы Σ',
          value: `${e.totalScore}/70`,
          color: e.totalScore < 20 ? '#22c55e' : e.totalScore < 40 ? '#f59e0b' : '#ef4444',
        });
    }
    if (neuroEntries.length) {
      const e = [...neuroEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (e.date === today)
        overview.push({
          label: 'Нейро',
          value: `${e.totalScore}/10`,
          color: e.totalScore >= 4 ? '#ef4444' : e.totalScore >= 2 ? '#f59e0b' : '#22c55e',
        });
    }
    if (acneEntries.length) {
      const e = [...acneEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (e.date === today)
        overview.push({
          label: 'Акне Σ',
          value: `${e.totalScore}/12`,
          color: e.totalScore >= 7 ? '#ef4444' : e.totalScore >= 4 ? '#f59e0b' : '#22c55e',
        });
    }
    if (hematoEntries.length) {
      const e = [...hematoEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (e.date === today)
        overview.push({ label: 'Гемат', value: `${e.totalScore}/8`, color: e.totalScore >= 2 ? '#ef4444' : '#22c55e' });
    }
    if (cardioLog.length) {
      const e = cardioLog[0];
      if (e.date === today) overview.push({ label: 'Кардио', value: `${e.durationMin} мин`, color: '#4ade80' });
    }
    return overview;
  };
  const todayOverview = buildTodayOverview();

  const builtInDiaries: BuiltInDiaryRow[] = [
    { key: 'sleep', count: sleepEntries.length, last: lastDate(sleepEntries) },
    {
      key: 'bp',
      count: bpEntries.length,
      last: (() => {
        if (!bpEntries.length) return '';
        const latest = [...bpEntries].sort((a, b) => (b.timestamp ?? new Date(b.date).getTime()) - (a.timestamp ?? new Date(a.date).getTime()))[0];
        return `${latest.systolic}/${latest.diastolic}`;
      })(),
    },
    { key: 'weight', count: weights.length, last: lastDate(weights) },
    { key: 'injection', count: injectionEntries.length, last: lastDate(injectionEntries) },
    { key: 'health', count: healthEntries.length, last: healthEntries.length ? healthEntries[0].date : '' },
    { key: 'cardio', count: cardioLog.length, last: cardioLog.length ? cardioLog[0].date : '' },
  ];

  const exportAllDiaries = () => {
    const payload: Record<string, any> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      goals,
      diaries: {
        [SLEEP_DIARY_KEY]: sleepEntries,
        [BP_DIARY_KEY]: bpEntries,
        [INJECTION_DIARY_KEY]: injectionEntries,
        [HEALTH_DIARY_KEY]: healthEntries,
        [SYMPTOMS_DIARY_KEY]: symptomEntries,
        [PAIN_DIARY_KEY]: painEntries,
        [NEURO_DIARY_KEY]: neuroEntries,
        [ACNE_DIARY_KEY]: acneEntries,
        [HEMATO_DIARY_KEY]: hematoEntries,
        [WEIGHT_LOG_KEY]: weights,
        he_cardio_sessions: cardioLog,
      },
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diaries-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if ((window as any).showToast) (window as any).showToast('📦 Все дневники экспортированы в JSON');
  };

  const exportAllDiariesPdf = () => {
    const esc = (v: unknown) =>
      String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
    const table = (title: string, headers: string[], rowsArr: string[][]) =>
      rowsArr.length
        ? `<h2>${esc(title)}</h2><table><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rowsArr
            .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
            .join('')}</table>`
        : '';
    const sortedDesc = <T extends { date: string }>(arr: T[]) => [...arr].sort((a, b) => b.date.localeCompare(a.date));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Все дневники</title>
<style>body{font:12px 'Segoe UI',Arial,sans-serif;padding:20px;color:#111}h1{color:#0f766e;border-bottom:2px solid #0f766e;padding-bottom:6px}h2{color:#0f766e;margin-top:18px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #ccc;padding:4px;text-align:left;font-size:11px}th{background:#e6f4f1}.meta{color:#666;font-size:11px}@media print{body{padding:8px}}</style></head><body>
<h1>📓 Все дневники</h1>
<p class="meta">Экспорт: ${new Date().toLocaleDateString('ru-RU')} · Записей: ${sleepEntries.length + bpEntries.length + weights.length + injectionEntries.length + healthEntries.length}</p>
${table('💤 Сон', ['Дата', 'Часы', 'Качество', 'Пробуждений', 'Легли', 'Подъём', 'Заметки'],
  sortedDesc(sleepEntries).map((e) => [e.date, String(e.hours), String(e.quality), String(e.awakenings), e.bedtime, e.wakeTime, e.notes || '']))}
${table('❤️ Давление (с ЧСС)', ['Дата', 'Систола', 'Диастола', 'Пульс', 'Время', 'Лекарство', 'Заметки'],
  sortedDesc(bpEntries).map((e) => [e.date, String(e.systolic), String(e.diastolic), String(e.hr ?? e.pulse ?? ''), e.timeOfDay || '', e.medicationTaken ? 'да' : '', e.notes || '']))}
${table('⚖️ Вес', ['Дата', 'Вес', 'Жир %', 'Мышцы', 'Талия', 'Заметки'],
  sortedDesc(weights).map((e) => [e.date, String(e.weight), e.bodyFat !== undefined ? String(e.bodyFat) : '', e.muscleMass !== undefined ? String(e.muscleMass) : '', e.waistCm !== undefined ? String(e.waistCm) : '', e.notes || '']))}
${table('💉 Инъекции', ['Дата', 'Препарат', 'Доза', 'Зона', 'Сторона', 'Боль', 'PIP', 'Заметки'],
  sortedDesc(injectionEntries).map((e) => [e.date, e.substance, e.dose, e.site || '', e.notes || '', '', '', e.notes || '']))}
${table('🩺 Здоровье', ['Дата', 'Боль', 'Симптомы', 'Нейро', 'Акне', 'Гемат', 'Заметки'],
  sortedDesc(healthEntries).map((e) => [
    e.date,
    e.pain && e.pain.totalScore > 0 ? `${e.pain.totalScore}/70` : '',
    Array.isArray(e.symptoms) ? String(e.symptoms.length) : '0',
    e.neuro && e.neuro.totalScore > 0 ? `${e.neuro.totalScore}/10` : '',
    e.acne && e.acne.totalScore > 0 ? `${e.acne.totalScore}/12` : '',
    e.hemato && e.hemato.totalScore > 0 ? `${e.hemato.totalScore}/8` : '',
    e.notes || '',
  ]))}
${table('❤️ Кардио', ['Дата', 'Тип', 'Минуты', 'ЧСС', 'RPE', 'Статус', 'Заметки'],
  sortedDesc(cardioLog).map((e) => [
    e.date,
    String(e.type).toUpperCase(),
    String(e.durationMin),
    e.avgHr != null ? String(e.avgHr) : '',
    e.rpe != null ? String(e.rpe) : '',
    e.completed ? 'выполнена' : 'пропущена',
    e.notes || '',
  ]))}
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 120);
  };

  const importAllDiaries = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const diaries = data.diaries || {};
        if (diaries[SLEEP_DIARY_KEY] && Array.isArray(diaries[SLEEP_DIARY_KEY])) {
          saveDiary(SLEEP_DIARY_KEY, diaries[SLEEP_DIARY_KEY]);
          setSleepEntries(diaries[SLEEP_DIARY_KEY]);
        }
        if (diaries[BP_DIARY_KEY] && Array.isArray(diaries[BP_DIARY_KEY])) {
          saveDiary(BP_DIARY_KEY, diaries[BP_DIARY_KEY]);
          setBpEntries(diaries[BP_DIARY_KEY]);
        }
        if (diaries[INJECTION_DIARY_KEY] && Array.isArray(diaries[INJECTION_DIARY_KEY])) {
          saveDiary(INJECTION_DIARY_KEY, diaries[INJECTION_DIARY_KEY]);
          setInjectionEntries(diaries[INJECTION_DIARY_KEY]);
        }
        if (diaries[HEALTH_DIARY_KEY] && Array.isArray(diaries[HEALTH_DIARY_KEY])) {
          saveUnifiedHealthEntries(diaries[HEALTH_DIARY_KEY]);
          setHealthEntries(
            [...diaries[HEALTH_DIARY_KEY]].sort((a, b) => String(b.date).localeCompare(String(a.date))),
          );
        }
        if (diaries[SYMPTOMS_DIARY_KEY] && Array.isArray(diaries[SYMPTOMS_DIARY_KEY])) {
          saveDiary(SYMPTOMS_DIARY_KEY, diaries[SYMPTOMS_DIARY_KEY]);
          setSymptomEntries(diaries[SYMPTOMS_DIARY_KEY]);
        }
        if (diaries[PAIN_DIARY_KEY] && Array.isArray(diaries[PAIN_DIARY_KEY])) {
          saveDiary(PAIN_DIARY_KEY, diaries[PAIN_DIARY_KEY]);
          setPainEntries(diaries[PAIN_DIARY_KEY]);
        }
        if (diaries[NEURO_DIARY_KEY] && Array.isArray(diaries[NEURO_DIARY_KEY])) {
          saveDiary(NEURO_DIARY_KEY, diaries[NEURO_DIARY_KEY]);
          setNeuroEntries(diaries[NEURO_DIARY_KEY]);
        }
        if (diaries[ACNE_DIARY_KEY] && Array.isArray(diaries[ACNE_DIARY_KEY])) {
          saveDiary(ACNE_DIARY_KEY, diaries[ACNE_DIARY_KEY]);
          setAcneEntries(diaries[ACNE_DIARY_KEY]);
        }
        if (diaries[HEMATO_DIARY_KEY] && Array.isArray(diaries[HEMATO_DIARY_KEY])) {
          saveDiary(HEMATO_DIARY_KEY, diaries[HEMATO_DIARY_KEY]);
          setHematoEntries(diaries[HEMATO_DIARY_KEY]);
        }
        if (diaries[WEIGHT_LOG_KEY] && Array.isArray(diaries[WEIGHT_LOG_KEY])) {
          saveWeightLog(diaries[WEIGHT_LOG_KEY]);
          setWeights(diaries[WEIGHT_LOG_KEY]);
        }
        if (diaries['he_cardio_sessions'] && Array.isArray(diaries['he_cardio_sessions'])) {
          try { localStorage.setItem('he_cardio_sessions', JSON.stringify(diaries['he_cardio_sessions'].slice(0, 500))); } catch {}
          setCardioLog(diaries['he_cardio_sessions']);
        }
        if (diaries['he_injection_schedule'] && Array.isArray(diaries['he_injection_schedule'])) {
          try { localStorage.setItem('he_injection_schedule', JSON.stringify(diaries['he_injection_schedule'])); } catch {}
        }
        if (diaries['he_sleep_goals'] && typeof diaries['he_sleep_goals'] === 'object') {
          try { localStorage.setItem('he_sleep_goals', JSON.stringify(diaries['he_sleep_goals'])); } catch {}
        }
        if (data.goals && typeof data.goals === 'object') {
          setGoals({ ...goals, ...data.goals });
          localStorage.setItem(GOALS_KEY, JSON.stringify({ ...goals, ...data.goals }));
        }
        if ((window as any).showToast) (window as any).showToast('📥 Дневники импортированы');
      } catch (e) {
        if ((window as any).showToast)
          (window as any).showToast('❌ Ошибка импорта: ' + (e instanceof Error ? e.message : 'неверный формат'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {activeDiary === 'sleep' ? (
        <SleepDiary open onClose={() => setActiveDiary(null)} diaryKey="sleep" goals={goals} onDataChange={refresh} />
      ) : activeDiary === 'bp' ? (
        <BPDiary open onClose={() => setActiveDiary(null)} diaryKey="bp" goals={goals} onDataChange={refresh} />
      ) : activeDiary === 'weight' || activeDiary === 'measurements' ? (
        <WeightDiary open onClose={() => setActiveDiary(null)} goals={goals} onDataChange={refresh} diaryKey="weight" />
      ) : activeDiary === 'injection' ? (
        <InjectionDiary open onClose={() => setActiveDiary(null)} diaryKey="injection" goals={goals} onDataChange={refresh} />
      ) : activeDiary === 'health' ? (
        <HealthDiary open onClose={() => setActiveDiary(null)} goals={goals} diaryKey="health" onDataChange={refresh} onNavigate={onNavigate} />
      ) : activeDiary === 'cardio' ? (
        <CardioDiary open onClose={() => setActiveDiary(null)} goals={goals} diaryKey="cardio" onDataChange={refresh} onNavigate={onNavigate} />
      ) : (
        <>
          {/* Виджет «Сегодня заполнено» */}
          {(() => {
            const completionKeys = builtInDiaries.map((d) => {
              const arr = getEntryArray(d.key);
              return {
                key: d.key,
                hasEntry: arr.length > 0,
                lastDate: arr.length > 0 ? latestDiaryDate(arr) : undefined,
              };
            });
            const completion = dailyCompletion(completionKeys);
            const todayStr = new Date().toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              weekday: 'short',
            });
            const ringColor =
              completion.pct >= 80
                ? '#22c55e'
                : completion.pct >= 50
                  ? '#f59e0b'
                  : completion.pct > 0
                    ? '#f97316'
                    : '#ef4444';
            return (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(96,165,250,0.06))',
                  border: `1px solid ${ringColor}33`,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                    <svg viewBox="0 0 64 64" width="64" height="64" style={{ filter: `drop-shadow(0 0 6px ${ringColor}55)` }}>
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="6"
                        strokeDasharray={`${(completion.pct / 100) * 175.93} 175.93`}
                        strokeLinecap="round"
                        transform="rotate(-90 32 32)"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 900,
                        color: ringColor,
                      }}
                    >
                      {completion.pct}%
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      📅 Сегодня · {todayStr}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginTop: 2 }}>
                      Заполнено {completion.filled} из {completion.total} дневников
                    </div>
                    {completion.missing.length > 0 && (
                      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                        Не заполнено: {completion.missing.map((k) => DIARY_META[k as DiaryKey].title).join(', ')}
                      </div>
                    )}
                    {completion.pct === 100 && (
                      <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginTop: 4 }}>
                        🎉 Все дневники заполнены на сегодня!
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                  {completionKeys.map((k) => {
                    const filled = k.hasEntry && k.lastDate === todayIso();
                    return (
                      <div
                        key={k.key}
                        onClick={() => setAddXxxOpenForKey(k.key)}
                        title={`${DIARY_META[k.key].title}${filled ? ' ✓' : ' — нажмите, чтобы заполнить'}`}
                        role="button"
                        tabIndex={0}
                        aria-label={DIARY_META[k.key].title}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: filled ? `${DIARY_META[k.key].color}33` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${filled ? DIARY_META[k.key].color : colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {DIARY_META[k.key].icon}
                      </div>
                    );
                  })}
                </div>
                {routine ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      padding: '9px 11px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                      border: '1px solid rgba(245,158,11,0.4)',
                      boxShadow: '0 4px 14px rgba(245,158,11,0.10)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', whiteSpace: 'nowrap' }}>
                      {routine.kind === 'morning' ? '🌅' : '🌆'} {ROUTINE_KIND_LABELS[routine.kind]} · {ROUTINE_STEP_LABELS[routine.step]} ({routineIdx + 1}/{routineTotal})
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${((routineIdx + 1) / routineTotal) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                          borderRadius: 2,
                          transition: 'width 0.35s ease',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openRoutineStepModal(routine)}
                      aria-label={`Заполнить: ${ROUTINE_STEP_LABELS[routine.step]}`}
                      style={{
                        background: 'rgba(245,158,11,0.18)',
                        border: '1px solid rgba(245,158,11,0.45)',
                        color: '#fbbf24',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '6px 12px',
                        borderRadius: 9,
                        flexShrink: 0,
                        minHeight: 32,
                      }}
                    >
                      ✍ Заполнить
                    </button>
                    <button
                      type="button"
                      onClick={advanceRoutine}
                      aria-label="Пропустить шаг"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        color: '#d4d4d8',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '6px 12px',
                        borderRadius: 9,
                        flexShrink: 0,
                        minHeight: 32,
                      }}
                    >
                      ⏭ Пропустить
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoutinePersist(null)}
                      aria-label="Отменить лог"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fbbf24',
                        cursor: 'pointer',
                        fontSize: 12,
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRoutinePersist({ kind: 'morning', step: 'sleep' });
                        openRoutineStepModal({ kind: 'morning', step: 'sleep' });
                      }}
                      style={{
                        flex: 1,
                        minWidth: 180,
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))',
                        border: '1px solid rgba(245,158,11,0.4)',
                        color: '#fbbf24',
                        boxShadow: '0 4px 16px rgba(245,158,11,0.12)',
                        transition: 'all 0.2s',
                      }}
                    >
                      🌅 Утренний лог: сон → АД (с ЧСС) → вес → здоровье
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRoutinePersist({ kind: 'evening', step: 'bp' });
                        openRoutineStepModal({ kind: 'evening', step: 'bp' });
                      }}
                      style={{
                        flex: 1,
                        minWidth: 150,
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06))',
                        border: '1px solid rgba(99,102,241,0.4)',
                        color: '#a5b4fc',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.12)',
                        transition: 'all 0.2s',
                      }}
                    >
                      🌆 Вечерний лог: АД (с ЧСС)
                    </button>
                  </div>
                )}
                {/* Темп-цели и streak-карта */}
                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: 4,
                  }}
                >
                  {(() => {
                    const items: {
                      key: DiaryKey;
                      label: string;
                      icon: string;
                      color: string;
                      streak: number;
                      pace: { achieved: number; needed: number; pct: number; ok: boolean } | null;
                    }[] = [];
                    for (const k of completionKeys) {
                      if (k.key === 'injection' || k.key === 'symptoms') continue;
                      const arr = getEntryArray(k.key);
                      const streak = currentStreak(arr);
                      const pace = computePace(k.key, arr);
                      if (pace || streak > 0) {
                        items.push({
                          key: k.key,
                          label: DIARY_META[k.key].title,
                          icon: DIARY_META[k.key].icon,
                          color: DIARY_META[k.key].color,
                          streak,
                          pace: pace
                            ? { achieved: pace.achieved, needed: pace.needed, pct: pace.pct, ok: pace.ok }
                            : null,
                        });
                      }
                    }
                    return items.map((it) => (
                      <div
                        key={it.key}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${it.color}22`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12 }}>{it.icon}</span>
                          <span
                            style={{
                              fontSize: 9,
                              color: colors.textMuted,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                            }}
                          >
                            {it.label}
                          </span>
                        </div>
                        {it.streak > 0 && (
                          <div style={{ fontSize: 10, color: it.color, fontWeight: 700, marginTop: 2 }}>
                            🔥 Серия: {it.streak} дн.
                          </div>
                        )}
                        {it.pace && (
                          <div style={{ marginTop: 3 }}>
                            <div style={{ fontSize: 8, color: colors.textMuted }}>
                              Темп: {it.pace.achieved}/{it.pace.needed} дн.
                            </div>
                            <div
                              style={{
                                height: 4,
                                borderRadius: 2,
                                background: 'rgba(255,255,255,0.06)',
                                overflow: 'hidden',
                                marginTop: 2,
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, it.pace.pct)}%`,
                                  background: it.pace.ok ? '#22c55e' : it.color,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            );
          })()}

          <AccordionSection
            title="📓 Встроенные дневники"
            subtitle="5 дневников: сон, давление, вес и замеры, инъекции, здоровье. Клик — раскрыть содержимое"
            icon="📓"
            color={colors.orange}
            defaultOpen
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Поиск дневника…"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: '8px 10px',
                color: colors.text,
                fontSize: 12,
                outline: 'none',
                marginBottom: 8,
                boxSizing: 'border-box',
              }}
              aria-label="Поиск дневника"
            />
            <div
              role="list"
              aria-label="Встроенные дневники"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}
            >
              {builtInDiaries
                .filter(
                  (d) =>
                    !searchQuery.trim() ||
                    DIARY_META[d.key].title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    d.last.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((d) => (
                  <DiaryCard
                    key={d.key}
                    diaryKey={d.key}
                    count={d.count}
                    last={d.last}
                    daysSinceLast={daysSinceLast(getEntryArray(d.key))}
                    loggedToday={todayEntry(getEntryArray(d.key))}
                    extra={
                      d.key === 'health' && healthEntries[0]
                        ? (() => {
                            const e = healthEntries[0];
                            const parts: string[] = [];
                            if (e.pain && e.pain.totalScore > 0) parts.push(`🦴 ${e.pain.totalScore}/70`);
                            if (Array.isArray(e.symptoms) && e.symptoms.length) parts.push(`🩺 ${e.symptoms.length}`);
                            if (e.neuro && e.neuro.totalScore > 0) parts.push(`🧠 ${e.neuro.totalScore}/10`);
                            if (e.acne && e.acne.totalScore > 0) parts.push(`🔴 ${e.acne.totalScore}/12`);
                            if (e.hemato && e.hemato.totalScore > 0) parts.push(`🩸 ${e.hemato.totalScore}/8`);
                            return parts.length ? parts.join(' · ') : undefined;
                          })()
                        : undefined
                    }
                    onAdd={() => {
                      if (d.key === 'sleep') setAddSleepOpen(true);
                      else if (d.key === 'bp') setAddBPOpen(true);
                      else if (d.key === 'weight' || d.key === 'measurements') setAddBodyMeasurementsOpen(true);
                      else if (d.key === 'injection') setAddInjectionOpen(true);
                      else if (d.key === 'cardio') setActiveDiary('cardio');
                      else if (
                        d.key === 'symptoms' ||
                        d.key === 'pain' ||
                        d.key === 'neuro' ||
                        d.key === 'acne' ||
                        d.key === 'hemato' ||
                        d.key === 'health'
                      )
                        setAddHealthOpen(true);
                    }}
                    onOpen={() => setActiveDiary(d.key)}
                  />
                ))}
            </div>
            {searchQuery.trim() &&
              builtInDiaries.filter((d) => DIARY_META[d.key].title.toLowerCase().includes(searchQuery.toLowerCase()))
                .length === 0 && (
                <div style={{ color: colors.textMuted, fontSize: 12, padding: 12, textAlign: 'center' }}>
                  Дневников по запросу «{searchQuery}» не найдено.
                </div>
              )}
          </AccordionSection>

          <AccordionSection
            title="💾 Данные"
            subtitle="Импорт, экспорт и сброс всех дневников"
            icon="💾"
            color={colors.blue}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={exportAllDiaries}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(96,165,250,0.14)',
                  border: '1px solid rgba(96,165,250,0.4)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📤 Экспорт всех дневников (JSON)
              </button>
              <button
                onClick={exportAllDiariesPdf}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🖨 Экспорт всех дневников (PDF)
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importAllDiaries(f);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
                aria-label="Импорт файла"
              />
              <button
                onClick={() => importInputRef.current?.click()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(34,197,94,0.14)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📥 Импорт
              </button>
              <button
                onClick={() => {
                  if (!confirm('Удалить ВСЕ записи ВСЕХ встроенных дневников?')) return;
                  const snap = {
                    [SLEEP_DIARY_KEY]: [...sleepEntries] as any[],
                    [BP_DIARY_KEY]: [...bpEntries] as any[],
                    [INJECTION_DIARY_KEY]: [...injectionEntries] as any[],
                    [SYMPTOMS_DIARY_KEY]: [...symptomEntries] as any[],
                    [PAIN_DIARY_KEY]: [...painEntries] as any[],
                    [NEURO_DIARY_KEY]: [...neuroEntries] as any[],
                    [ACNE_DIARY_KEY]: [...acneEntries] as any[],
                    [HEMATO_DIARY_KEY]: [...hematoEntries] as any[],
                    [HEALTH_DIARY_KEY]: [...healthEntries] as any[],
                    [WEIGHT_LOG_KEY]: [...weights] as any[],
                    he_cardio_sessions: [...cardioLog] as any[],
                  };
                  const total = Object.values(snap).reduce((s, a) => s + a.length, 0);
                  [
                    SLEEP_DIARY_KEY,
                    BP_DIARY_KEY,
                    INJECTION_DIARY_KEY,
                    SYMPTOMS_DIARY_KEY,
                    PAIN_DIARY_KEY,
                    NEURO_DIARY_KEY,
                    ACNE_DIARY_KEY,
                    HEMATO_DIARY_KEY,
                    HEALTH_DIARY_KEY,
                    WEIGHT_LOG_KEY,
                    'he_cardio_sessions',
                  ].forEach((k) => saveDiary(k, []));
                  setSleepEntries([]);
                  setBpEntries([]);
                  setInjectionEntries([]);
                  setSymptomEntries([]);
                  setPainEntries([]);
                  setNeuroEntries([]);
                  setAcneEntries([]);
                  setHematoEntries([]);
                  setHealthEntries([]);
                  setWeights([]);
                  setCardioLog([]);
                  pushUndo(`🧹 Очищены все встроенные дневники (${total})`, () => {
                    setSleepEntries(snap[SLEEP_DIARY_KEY] as SleepEntry[]);
                    setBpEntries(snap[BP_DIARY_KEY] as BPEntry[]);
                    setInjectionEntries(snap[INJECTION_DIARY_KEY] as InjectionEntry[]);
                    setSymptomEntries(snap[SYMPTOMS_DIARY_KEY] as SymptomEntry[]);
                    setPainEntries(snap[PAIN_DIARY_KEY] as PainEntry[]);
                    setNeuroEntries(snap[NEURO_DIARY_KEY] as NeuroEntry[]);
                    setAcneEntries(snap[ACNE_DIARY_KEY] as AcneEntry[]);
                    setHematoEntries(snap[HEMATO_DIARY_KEY] as HematoEntry[]);
                    setHealthEntries(snap[HEALTH_DIARY_KEY] as UnifiedHealthEntry[]);
                    setWeights(snap[WEIGHT_LOG_KEY] as ReturnType<typeof getWeightLog>);
                    setCardioLog(snap['he_cardio_sessions'] as ReturnType<typeof loadCardioLog>);
                    Object.entries(snap).forEach(([k, v]) => saveDiary(k, v as any[]));
                  });
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🗑 Сбросить всё
              </button>
            </div>
          </AccordionSection>

          <AccordionSection
            title="🔗 Дневники в других блоках"
            subtitle="Быстрый переход к дневнику нужного блока (с подтверждением)"
            icon="🔗"
            color={colors.blue}
          >
            <QuickLinkRow links={QUICK_DIARY_LINKS} ariaLabel="Дневники в других блоках" onNavigate={onNavigate} />
          </AccordionSection>

          {/* ── Модальные окна для быстрого добавления из карточек дневников ── */}
          <AddSleepModal
            open={addSleepOpen}
            onClose={() => setAddSleepOpen(false)}
            onSave={(e) => {
              const prev = sleepEntries;
              const replaced = prev.some((x) => x.date === e.date);
              const updated = [...sleepEntries.filter((x) => x.date !== e.date), e].sort((a, b) =>
                a.date.localeCompare(b.date),
              );
              saveDiary(SLEEP_DIARY_KEY, updated);
              setSleepEntries(updated);
              pushUndo(routineUndoLabel(replaced ? 'запись обновлена' : 'запись добавлена'), () => {
                saveDiary(SLEEP_DIARY_KEY, prev);
                setSleepEntries(prev);
              });
              if (routine?.step === 'sleep') advanceRoutine();
            }}
          />
          <AddBPModal
            open={addBPOpen}
            presetTimeOfDay={routine?.step === 'bp' ? (routine.kind === 'evening' ? 'evening' : 'morning') : undefined}
            onClose={() => setAddBPOpen(false)}
            onSave={(e) => {
              const entry: CoreBPEntry = {
                id: e.id || generateEntryId(),
                date: e.date,
                timestamp: e.timestamp || Date.now(),
                systolic: Number(e.systolic),
                diastolic: Number(e.diastolic),
                hr: Number(e.hr ?? e.pulse),
                timeOfDay: e.timeOfDay,
                arm: e.arm,
                position: e.position,
                symptoms: Array.isArray(e.symptoms) ? e.symptoms : undefined,
                medicationTaken: !!e.medicationTaken,
                notes: e.notes,
              };
              const prev = getBpEntries();
              const existing = prev.filter((x) => x.id !== entry.id);
              const updated = commitBpEntries([...existing, entry]);
              setBpEntries(updated.map((x) => ({ ...x, pulse: x.hr })));
              pushUndo(routineUndoLabel('давление записано'), () => {
                const restored = commitBpEntries(prev);
                setBpEntries(restored.map((x) => ({ ...x, pulse: x.hr })));
              });
              if (routine?.step === 'bp') advanceRoutine();
            }}
          />
          <AddBodyMeasurementsModal
            open={addBodyMeasurementsOpen}
            onClose={() => setAddBodyMeasurementsOpen(false)}
            onSave={(e) => {
              const prev = getWeightLog() || [];
              const replaced = prev.some((x) => x.date === e.date);
              const updated = [...prev.filter((x) => x.date !== e.date), e].sort((a, b) =>
                a.date.localeCompare(b.date),
              );
              saveWeightLog(updated);
              setWeights(updated);
              pushUndo(
                routine?.step === 'weight'
                  ? routineUndoLabel('вес записан')
                  : replaced
                    ? 'Запись веса обновлена'
                    : 'Запись веса добавлена',
                () => {
                  saveWeightLog(prev);
                  setWeights(prev);
                },
              );
              if (routine?.step === 'weight') advanceRoutine();
            }}
          />
          <AddInjectionModal
            open={addInjectionOpen}
            onClose={() => setAddInjectionOpen(false)}
            onSave={(e) => {
              const prev = injectionEntries;
              const sub = (x: { substance?: unknown }) => String(x.substance ?? '').trim().toLowerCase();
              const replaced = prev.some((x) => x.date === e.date && sub(x) === sub(e));
              const updated = [...injectionEntries.filter((x) => !(x.date === e.date && sub(x) === sub(e))), e].sort((a, b) =>
                a.date.localeCompare(b.date),
              );
              saveDiary(INJECTION_DIARY_KEY, updated);
              setInjectionEntries(updated);
              pushUndo(replaced ? 'Запись инъекции обновлена' : 'Запись инъекции добавлена', () => {
                saveDiary(INJECTION_DIARY_KEY, prev);
                setInjectionEntries(prev);
              });
            }}
          />
          <AddHealthModal
            open={addHealthOpen}
            onClose={() => setAddHealthOpen(false)}
            onSave={(e) => {
              const prevUnified = healthEntries;
              const prevPain = painEntries;
              const prevNeuro = neuroEntries;
              const prevAcne = acneEntries;
              const prevHemato = hematoEntries;
              const prevSymptoms = symptomEntries;
              const existingForDate = healthEntries.find((x) => x.date === e.date);
              // МЕРЖ вместо замены: сохраняем разделы, которые не заполнены в новой записи
              // (например, боль с 3D-карты при добавлении нейро через quick-add).
              const mergedEntry = mergeHealthEntry(existingForDate, e);
              const replacedHealth = !!existingForDate;
              const updated = [...healthEntries.filter((x) => x.date !== e.date), mergedEntry].sort((a, b) =>
                b.date.localeCompare(a.date),
              );
              saveUnifiedHealthEntries(updated);
              setHealthEntries(updated);
              if (e.pain) {
                const p = [...painEntries.filter((x) => x.date !== e.date), { date: e.date, ...e.pain }].sort((a, b) =>
                  a.date.localeCompare(b.date),
                );
                saveDiary(PAIN_DIARY_KEY, p);
                setPainEntries(p);
              }
              if (e.neuro) {
                const n = [...neuroEntries.filter((x) => x.date !== e.date), { date: e.date, ...e.neuro }].sort(
                  (a, b) => a.date.localeCompare(b.date),
                );
                saveDiary(NEURO_DIARY_KEY, n);
                setNeuroEntries(n);
              }
              if (e.acne) {
                const a = [...acneEntries.filter((x) => x.date !== e.date), { date: e.date, ...e.acne }].sort((a, b) =>
                  a.date.localeCompare(b.date),
                );
                saveDiary(ACNE_DIARY_KEY, a);
                setAcneEntries(a);
              }
              if (e.hemato) {
                const h = [...hematoEntries.filter((x) => x.date !== e.date), { date: e.date, ...e.hemato }].sort(
                  (a, b) => a.date.localeCompare(b.date),
                );
                saveDiary(HEMATO_DIARY_KEY, h);
                setHematoEntries(h);
              }
              if (e.symptoms && e.symptoms.length > 0) {
                const s = [
                  ...symptomEntries.filter((x) => x.date !== e.date),
                  ...e.symptoms.map((s: any) => ({ date: e.date, ...s })),
                ].sort((a, b) => a.date.localeCompare(b.date));
                saveDiary(SYMPTOMS_DIARY_KEY, s);
                setSymptomEntries(s);
              }
              pushUndo(routineUndoLabel(replacedHealth ? 'запись обновлена' : 'запись добавлена'), () => {
                saveUnifiedHealthEntries(prevUnified);
                setHealthEntries(prevUnified);
                if (e.pain) { saveDiary(PAIN_DIARY_KEY, prevPain); setPainEntries(prevPain); }
                if (e.neuro) { saveDiary(NEURO_DIARY_KEY, prevNeuro); setNeuroEntries(prevNeuro); }
                if (e.acne) { saveDiary(ACNE_DIARY_KEY, prevAcne); setAcneEntries(prevAcne); }
                if (e.hemato) { saveDiary(HEMATO_DIARY_KEY, prevHemato); setHematoEntries(prevHemato); }
                if (e.symptoms && e.symptoms.length > 0) { saveDiary(SYMPTOMS_DIARY_KEY, prevSymptoms); setSymptomEntries(prevSymptoms); }
              });
              if (routine?.step === 'health') advanceRoutine();
            }}
          />
        </>
      )}

      <style>{`
        @keyframes snackbar-in {
          from { transform: translateY(20px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes snackbar-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes diary-row-in {
          from { transform: translateX(-8px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes diary-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
      <Snackbar action={topUndo(undoQueue)} onUndo={applyTopUndo} onDismiss={dismissTopUndoAction} />
    </div>
  );
};
